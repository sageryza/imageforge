// Animate ANY still into a clip on APIFRAME's banked credits — the general
// sibling of scripts/science-animate.js, which is hard-wired to the Witch
// School card art. Takes a plain image URL, so it serves the Universe Reel and
// anything after it.
//
//   node scripts/reel-animate.js --img <url> --prompt "<motion only>" \
//     [--end <url>] [--model seedance-1.5-pro] [--res 1080p] [--secs 12] \
//     [--out shot01] [--prefix reel/universe] [--dry]
//
// WHY APIFRAME AND NOT REPLICATE. Sophie's team holds banked credits on the
// af_basic plan she is already paying for (3,706 measured 2026-08-16 via
// GET /v2/me), so this line of work spends no new money. Replicate is the
// fallback when they run out.
//
// READ costMax, NOT costMin — costMin IS A FLOOR, NOT A PRICE. This cost 245
// credits to learn (2026-08-16): seedance-1.5-pro advertises `costMin: 9` and
// `pricingMode: "flat"`, which reads like "9 credits a clip whatever you ask
// for". It is not. The same entry carries `costMax: 245`, and a 12s/1080p clip
// — the most expensive of its nine duration x resolution combinations — charged
// exactly 245. `costMin` is the cheapest corner of the table (4s/480p).
//
// HOW TO READ THE CATALOGUE'S TWO NUMBERS, which mean different things per mode
// and are the only pricing the API exposes:
//   pricingMode "flat"       -> costMin/costMax are the TOTAL for the cheapest
//                               and dearest combos. seedance-1.5-pro: 9 .. 245.
//   pricingMode "per-second" -> costMin/costMax are the per-second RATE at the
//                               lowest and highest resolution. Multiply by
//                               duration. wan-2.7: 17/s at 720p, 26/s at 1080p,
//                               so a 4s 720p clip is 68 — not 17.
// That reading reproduces both measurements on file: this run's 245, and
// science-animate.js's 8.1s/480p seedance-2-mini run at 48 credits (6/s).
//
// SO SHOOT SHORT AND SHOOT LOW unless the shot needs otherwise. On a flat model
// the duration and resolution you pick are the whole bill, and the reel's shots
// are 2-4 seconds in the cut — 12s at 1080p buys coverage nobody uses at 27x
// the price of the cheapest corner.
//
// DO NOT PROBE POST /videos/generate TO FIND A PARAMETER SHAPE. Credits are
// charged UP FRONT at submit, and a previous chat spent 130 of them
// discovering wan-2.7's key by POSTing candidate shapes until one stopped
// erroring — it submitted a real job from the prompt "test". GET /v2/models
// lists every model with its exact controls; read that and add a FAMILY entry
// below. There is no cancel route. A genuinely FAILED job is refunded.
//
// THE PARAMS KEY IS PER FAMILY and is not guessable from the id: seedance-* ->
// `seedanceParams`, wan-2.7 -> `wan27Params` (not `wanParams`). Flat options
// outside the wrapper are rejected outright.
//
// SEEDANCE 1.5 PRO HAS NO `aspect_ratio` CONTROL, unlike seedance-2-mini/2.5 —
// its shape follows the input image, the way wan-2.7 does. science-animate.js
// sets aspect_ratio unconditionally for /^seedance/, which is why this file
// has its own family table rather than importing that one. Its durations are
// [4, 8, 12] only; 6 or 10 is refused.
//
// Env: APIFRAME_KEY (or APIFRAME_API_KEY), FIREBASE_SERVICE_ACCOUNT.
// Output: the mp4 mirrored to Storage (APIFRAME's own URLs expire), plus a GIF
// beside it when ffmpeg is available.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');

// The bundled binary, the way movies.js and scratchpad.js resolve it — a bare
// `ffmpeg` is not on PATH in a session container, which is how an earlier run
// produced the mp4 and silently skipped the GIF.
const FFMPEG = process.env.FFMPEG_PATH
  || (() => { try { return require('ffmpeg-static'); } catch { return null; } })()
  || 'ffmpeg';

const KEY = process.env.APIFRAME_KEY || process.env.APIFRAME_API_KEY || '';
const BASE = process.env.APIFRAME_BASE || 'https://api.apiframe.ai/v2';
// APIFRAME sits behind Cloudflare, which rejects non-browser signatures.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const BUCKET = 'deckfactory-43176.firebasestorage.app';

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : fallback;
}
const has = name => process.argv.includes('--' + name);

const img = arg('img');
const endImg = arg('end');
const prompt = arg('prompt');
const model = arg('model', 'seedance-1.5-pro');
const resolution = arg('res', '1080p');
const secs = Number(arg('secs', 12));
const prefix = arg('prefix', 'reel/universe');
const out = arg('out', 'clip-' + Date.now());
const dry = has('dry');

if (!img || !prompt) {
  console.error('usage: node scripts/reel-animate.js --img <url> --prompt "<motion only>"');
  process.exit(1);
}
if (!KEY) { console.error('APIFRAME_KEY required'); process.exit(1); }

// The art is held still by this line and nothing else — the prompt itself says
// only what MOVES. Copied in spirit from movies.js's ART_LOCK, which learned
// the hard way that house motion vocabulary in a prefix overrides the scene.
// Pass --raw to send the prompt with nothing appended.
const ART_LOCK = ' The art style, colors, lighting and composition of the source '
  + 'image are preserved exactly. Nothing is redrawn or restyled.';
const fullPrompt = has('raw') ? prompt : prompt + ART_LOCK;

async function api(p, opts = {}) {
  const res = await fetch(BASE + p, {
    method: opts.method || 'GET',
    headers: {
      'X-API-Key': KEY, 'Content-Type': 'application/json',
      'User-Agent': UA, Accept: 'application/json',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  if (!res.ok) throw new Error(`APIFRAME ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

function videoUrlOf(r) {
  if (!r) return null;
  return r.video_url || r.videoUrl || r.url
    || (Array.isArray(r.videos) && r.videos[0])
    || (Array.isArray(r.output) && r.output[0])
    || (typeof r.video === 'string' ? r.video : null);
}

// Each family names its own wrapper key AND its own image fields. Read
// GET /v2/models before adding one — never probe the generate route.
const FAMILIES = [
  {
    // 1.5-pro: flat-priced, durations [4,8,12], no aspect_ratio (shape follows
    // the input image), but it DOES have camera_fixed.
    match: /^seedance-1\.5/, key: 'seedanceParams',
    start: 'start_image', end: 'end_image',
    durations: [4, 8, 12],
    extra: p => { if (has('lock')) p.camera_fixed = true; },
  },
  {
    // seedance 2.x: per-second, and these DO take aspect_ratio.
    match: /^seedance/, key: 'seedanceParams',
    start: 'start_image', end: 'end_image',
    extra: p => { p.aspect_ratio = arg('ar', '9:16'); if (has('lock')) p.camera_fixed = true; },
  },
  {
    // wan-2.7 is the one with REAL first-last-frame conditioning, which is why
    // it earns its higher per-second price when a clip must LAND on a given
    // frame. No camera_fixed, no aspect_ratio, and 480p is not offered.
    match: /^wan-2\.7/, key: 'wan27Params',
    start: 'image', end: 'last_frame',
    res: r => (r === '480p' ? '720p' : r),
    extra: () => {},
  },
];

(async () => {
  const fam = FAMILIES.find(f => f.match.test(model));
  if (!fam) throw new Error(`no parameter shape known for "${model}" — read GET /v2/models and add a FAMILY entry`);
  if (fam.durations && !fam.durations.includes(secs)) {
    throw new Error(`${model} only accepts durations ${fam.durations.join(', ')} — got ${secs}`);
  }
  const res = fam.res ? fam.res(resolution) : resolution;

  const params = { resolution: res, duration: secs };
  params[fam.start] = img;
  if (endImg) params[fam.end] = endImg;
  fam.extra(params);

  const body = { prompt: fullPrompt, model, [fam.key]: params };
  if (dry) { console.log(JSON.stringify(body, null, 2)); return; }

  const before = (await api('/me')).team.credits;
  console.log(`credits before: ${before}`);
  console.log(`${model} · ${res} · ${secs}s${endImg ? ' · first→last' : ''}`);

  const r = await api('/videos/generate', { method: 'POST', body });
  const id = r.jobId || r.id || r.task_id;
  if (!id) throw new Error('no job id: ' + JSON.stringify(r).slice(0, 200));
  console.log('job', id);

  let url = null;
  for (let i = 0; i < 180; i++) {
    await new Promise(s => setTimeout(s, 5000));
    const j = await api('/jobs/' + id);
    const status = j.status || (j.job && j.job.status);
    if (i % 6 === 0) console.log('  ', status);
    if (/fail|error/i.test(String(status))) throw new Error('job failed: ' + JSON.stringify(j).slice(0, 300));
    url = videoUrlOf(j.result || j.output || (j.job && j.job.result) || j);
    if (url) break;
  }
  if (!url) throw new Error('timed out waiting for the clip');

  const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  const local = path.join('/tmp', out + '.mp4');
  fs.writeFileSync(local, buf);
  console.log('mp4', (buf.length / 1024 / 1024).toFixed(2) + 'MB');

  if (!getApps().length) {
    initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
      storageBucket: BUCKET,
    });
  }
  const bucket = getStorage().bucket();
  const saved = [];
  const put = async (file, type) => {
    const name = `${prefix}/${path.basename(file)}`;
    await bucket.file(name).save(fs.readFileSync(file), { metadata: { contentType: type } });
    await bucket.file(name).makePublic();
    saved.push(`https://storage.googleapis.com/${BUCKET}/${name}`);
  };
  await put(local, 'video/mp4');

  // A GIF too, because that is how she watches a short loop.
  try {
    const gif = path.join('/tmp', out + '.gif');
    const pal = path.join('/tmp', out + '-pal.png');
    execFileSync(FFMPEG, ['-y', '-i', local, '-vf', 'fps=12,scale=480:-1:flags=lanczos,palettegen=stats_mode=diff', pal], { stdio: 'ignore' });
    execFileSync(FFMPEG, ['-y', '-i', local, '-i', pal, '-lavfi', 'fps=12,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3', gif], { stdio: 'ignore' });
    await put(gif, 'image/gif');
    console.log('gif', (fs.statSync(gif).size / 1024 / 1024).toFixed(2) + 'MB');
  } catch (e) { console.log('no gif (ffmpeg):', e.message.slice(0, 80)); }

  const after = (await api('/me')).team.credits;
  console.log(`credits after: ${after}  (spent ${before - after})`);
  saved.forEach(u => console.log(u));
})().catch(e => { console.error(e.message); process.exit(1); });
