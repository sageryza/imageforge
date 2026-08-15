// Animate a Science School card — or the span between TWO cards — into a short
// looping clip, on APIFRAME's credits rather than new money.
//
//   node scripts/science-animate.js --start dn-05 --end dn-06 \
//     --prompt "the two ribbons peel apart from the top downward…" \
//     [--model seedance-2-mini] [--res 480p] [--out unzip]
//
// WHY APIFRAME AND NOT REPLICATE (Sophie, 2026-08-15: "we have a bunch of
// credits built up with API frame that we're probably not gonna be able to use
// anyway"). Her team held 4,000 credits on the af_basic plan (measured that day
// via GET /v2/me), so this whole line of work spends nothing new. Replicate's
// wan-2.2-i2v-fast would also do it (it has `last_image`, ~6c a clip), and is
// the fallback if the credits ever run out; it is not the default while there
// are credits sitting unused.
//
// WHAT A CLIP ACTUALLY COSTS, measured rather than read off the price list: an
// 8.1s seedance-2-mini clip at 480p charged 48 credits, so reckon ~6 a second
// and about 24 for the 4s default. The catalogue's `costMin: 6` is not what a
// short run comes to. Credits are charged UP FRONT, at submit, not on delivery.
// A FAILED job is refunded (one died on "No available capacity for model" and
// its 24 came back), and there is NO cancel route — nothing submitted can be
// called back.
//
// SO DO NOT PROBE POST /videos/generate. Finding wan-2.7's parameter key by
// POSTing candidate shapes until one stopped erroring SUBMITTED A REAL JOB on
// the shape that worked — 130 credits for a clip generated from the prompt
// "test". Same rule as the Chats app's "confirm a route with a READ, never by
// calling the write", and it cost real money here. GET /v2/models lists every
// model with its controls, durations and aspect ratios; read that instead.
//
// THE PARAMS KEY IS PER MODEL FAMILY, and it is not guessable from the id:
// seedance-* -> `seedanceParams`, wan-2.7 -> `wan27Params` (not `wanParams`),
// Midjourney -> `midjourneyParams`. Flat options are rejected outright.
//
// `end_image` ON SEEDANCE IS A HINT, NOT A TARGET. Neither the 4s nor the 8s
// unzip ended on dn-06: the 8s straightened both ribbons into vertical lines,
// the 4s shrank them and drifted them apart. The MIDDLE of the motion is
// faithful and the ends wander, which is worth knowing before building
// anything that needs to land on a specific frame — wan-2.7's `last_frame`
// (real first-last-frame conditioning) is the thing to try there.
//
// THE END FRAME IS THE POINT. Both ends of the DNA unwinding already exist as
// drawings — dn-05 is the intact helix, dn-06 the unzipped one — so the model
// is only asked to invent the middle, which is where an image-to-video model
// otherwise wanders off and redraws the art. Any pair of cards that are the
// same picture in two states can be animated this way.
//
// SHORT, BECAUSE IT IS A LOOP (Sophie: "five seconds seems like a lot. My
// intention is probably to just have it run as a GIF"). seedance-2-mini's
// shortest is 4s; wan-2.7 goes to 2s but costs ~17 credits and starts at 720p.
//
// Env: APIFRAME_KEY (or APIFRAME_API_KEY), FIREBASE_SERVICE_ACCOUNT.
// Output: the mp4 mirrored to witch-school/clips/<out>.mp4 (APIFRAME's own URLs
// expire) and a GIF beside it when ffmpeg is available.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');

// The bundled binary, the way movies.js and scratchpad.js resolve it — a bare
// `ffmpeg` is not on PATH in a session container, which is how the first run
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
const ART = `https://storage.googleapis.com/${BUCKET}/witch-school/assets/`;

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const startId = arg('start');
const endId = arg('end');
const prompt = arg('prompt');
const model = arg('model', 'seedance-2-mini');
const resolution = arg('res', '480p');
// BOTH OF THESE MUST BE SENT. The first run passed neither and seedance used
// its own defaults — 8.1 seconds at 864x496 — which is twice the length Sophie
// asked for and the wrong shape for a square card (48 credits instead of ~24).
// seedance-2-mini's durations are 4, 6, 8, 10, 12, 15; the cards are square.
const secs = Number(arg('secs', 4));
const aspect = arg('ar', '1:1');
const out = arg('out', startId + (endId ? '-' + endId : ''));

if (!startId || !prompt) {
  console.error('usage: node scripts/science-animate.js --start <card-id> [--end <card-id>] --prompt "<motion only>"');
  process.exit(1);
}
if (!KEY) { console.error('APIFRAME_KEY required'); process.exit(1); }

// The art is held still by this line and nothing else — the prompt itself says
// only what MOVES. Copied in spirit from movies.js's ART_LOCK, which learned
// the hard way that house motion vocabulary in the prefix overrides the scene.
const ART_LOCK = ' The illustration style, linework, colors and line thickness are preserved exactly. '
  + 'The plain white background does not move and nothing is redrawn.';

async function api(p, opts = {}) {
  const res = await fetch(BASE + p, {
    method: opts.method || 'GET',
    headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json', 'User-Agent': UA, Accept: 'application/json' },
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

(async () => {
  const params = { resolution, duration: secs, aspect_ratio: aspect, start_image: ART + startId + '.png' };
  if (endId) params.end_image = ART + endId + '.png';
  // The camera is not the thing moving — the drawing is.
  params.camera_fixed = true;

  const before = (await api('/me')).team.credits;
  console.log(`credits before: ${before}`);
  console.log(`${model} · ${resolution} · ${aspect} · ${secs}s · ${startId}${endId ? ' → ' + endId : ''}`);

  const r = await api('/videos/generate', {
    method: 'POST',
    body: { prompt: prompt + ART_LOCK, model, seedanceParams: params },
  });
  const id = r.jobId || r.id || r.task_id;
  if (!id) throw new Error('no job id: ' + JSON.stringify(r).slice(0, 200));
  console.log('job', id);

  let url = null;
  for (let i = 0; i < 120; i++) {
    await new Promise(s => setTimeout(s, 5000));
    const j = await api('/jobs/' + id);
    const status = j.status || (j.job && j.job.status);
    if (i % 4 === 0) console.log('  ', status);
    if (/fail|error/i.test(String(status))) throw new Error('job failed: ' + JSON.stringify(j).slice(0, 300));
    url = videoUrlOf(j.result || j.output || (j.job && j.job.result) || j);
    if (url) break;
  }
  if (!url) throw new Error('timed out waiting for the clip');
  console.log('clip:', url);

  const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  const local = path.join('/tmp', out + '.mp4');
  fs.writeFileSync(local, buf);
  console.log('mp4', (buf.length / 1024 / 1024).toFixed(2) + 'MB');

  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)), storageBucket: BUCKET });
  const bucket = getStorage().bucket();
  const saved = [];
  for (const [file, type] of [[local, 'video/mp4']]) {
    const name = `witch-school/clips/${path.basename(file)}`;
    await bucket.file(name).save(fs.readFileSync(file), { metadata: { contentType: type } });
    await bucket.file(name).makePublic();
    saved.push(`https://storage.googleapis.com/${BUCKET}/${name}`);
  }

  // A GIF because that is how she wants to watch it. Two-pass palette, or the
  // flat pastels band badly against the white.
  try {
    const gif = path.join('/tmp', out + '.gif');
    const pal = path.join('/tmp', out + '-pal.png');
    execFileSync(FFMPEG, ['-y', '-i', local, '-vf', 'fps=12,scale=480:-1:flags=lanczos,palettegen=stats_mode=diff', pal], { stdio: 'ignore' });
    execFileSync(FFMPEG, ['-y', '-i', local, '-i', pal, '-lavfi', 'fps=12,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3', gif], { stdio: 'ignore' });
    const name = `witch-school/clips/${out}.gif`;
    await bucket.file(name).save(fs.readFileSync(gif), { metadata: { contentType: 'image/gif' } });
    await bucket.file(name).makePublic();
    saved.push(`https://storage.googleapis.com/${BUCKET}/${name}`);
    console.log('gif', (fs.statSync(gif).size / 1024 / 1024).toFixed(2) + 'MB');
  } catch (e) { console.log('no gif (ffmpeg):', e.message.slice(0, 80)); }

  const after = (await api('/me')).team.credits;
  console.log(`credits after: ${after}  (spent ${before - after})`);
  saved.forEach(u => console.log(u));
})().catch(e => { console.error(e.message); process.exit(1); });
