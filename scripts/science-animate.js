// Animate a Science School card — or the span between TWO cards — into a short
// looping clip, on APIFRAME's credits rather than new money.
//
//   node scripts/science-animate.js --start dn-05 --end dn-06 \
//     --prompt "the two ribbons peel apart from the top downward…" \
//     [--model seedance-2-mini] [--res 480p] [--out unzip]
//
// WHY APIFRAME AND NOT REPLICATE (Sophie, 2026-08-15: "we have a bunch of
// credits built up with API frame that we're probably not gonna be able to use
// anyway"). Her team holds 4,000 credits on the af_basic plan (measured that
// day via GET /v2/me) and a 4-second seedance-2-mini clip at 480p costs about
// SIX of them — so this whole line of work spends nothing new. Replicate's
// wan-2.2-i2v-fast would also do it (it has `last_image`, ~6c a clip), and is
// the fallback if the credits ever run out; it is not the default while there
// are credits sitting unused.
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
  const params = { resolution, start_image: ART + startId + '.png' };
  if (endId) params.end_image = ART + endId + '.png';
  // The camera is not the thing moving — the drawing is.
  params.camera_fixed = true;

  const before = (await api('/me')).team.credits;
  console.log(`credits before: ${before}`);
  console.log(`${model} · ${resolution} · ${startId}${endId ? ' → ' + endId : ''}`);

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
    execFileSync('ffmpeg', ['-y', '-i', local, '-vf', 'fps=12,scale=480:-1:flags=lanczos,palettegen=stats_mode=diff', pal], { stdio: 'ignore' });
    execFileSync('ffmpeg', ['-y', '-i', local, '-i', pal, '-lavfi', 'fps=12,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3', gif], { stdio: 'ignore' });
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
