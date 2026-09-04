// Animate a still into a short clip on Replicate — the Replicate sibling of
// scripts/reel-animate.js (which spends APIFRAME credits). Takes a local file
// or a url, mirrors the still and the clip to Storage, prints the clip url and
// the prediction's own metrics. Nothing is cached: every run is a paid draw.
//
//   node scripts/replicate-animate.js --img <path|url> --prompt "<motion only>" \
//     [--model bytedance/seedance-2.0-mini] [--secs 3] [--res 720p] \
//     [--ar adaptive] [--audio 1] [--prefix desk-sweep] [--out sweep-v1] [--dry]
//
// THE INPUT KEYS ARE READ OFF THE MODEL'S SCHEMA BEFORE THE POST, never
// guessed: a wrong key does not fail loudly — the model ignores it, draws
// something unconditioned, and the bill arrives anyway (movies.js's own rule).
// Only keys the schema declares are sent, and `--dry` prints the input and
// stops. Prices (per second, image in, 2026-09-04) are in
// docs/modules/audio-and-film.md.
//
// Env: REPLICATE_API_TOKEN, FIREBASE_SERVICE_ACCOUNT (Deck Factory).

const fs = require('fs');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');

const BUCKET = 'deckfactory-43176.firebasestorage.app';
const TOKEN = process.env.REPLICATE_API_TOKEN || '';
const API = 'https://api.replicate.com/v1';

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}
const img = arg('img');
const prompt = arg('prompt');
const model = arg('model', 'bytedance/seedance-2.0-mini');
const secs = Number(arg('secs', 3));
const res = arg('res', '720p');
const ar = arg('ar', 'adaptive');
const audio = String(arg('audio', '1')) !== '0';
const prefix = arg('prefix', 'replicate-animate');
const out = arg('out', 'clip-' + Date.now());
const dry = arg('dry', false) === true;
if (!img || !prompt) { console.error('need --img and --prompt'); process.exit(2); }
if (!TOKEN) { console.error('REPLICATE_API_TOKEN missing'); process.exit(2); }

function bucket() {
  if (!getApps().length) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    initializeApp({ credential: cert(sa), storageBucket: BUCKET });
  }
  return getStorage().bucket(BUCKET);
}
async function mirror(localPath, dest, contentType) {
  const b = bucket();
  await b.upload(localPath, { destination: dest, metadata: { contentType, cacheControl: 'public, max-age=31536000' } });
  await b.file(dest).makePublic();
  return `https://storage.googleapis.com/${BUCKET}/${dest}`;
}
async function rep(url, opts = {}) {
  const r = await fetch(url.startsWith('http') ? url : API + url, {
    ...opts, headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

(async () => {
  // 1. The still, at a url the model can fetch.
  let imageUrl = img;
  if (!/^https?:\/\//.test(img)) {
    const ext = path.extname(img).replace('.', '') || 'png';
    imageUrl = await mirror(img, `${prefix}/${out}-still.${ext}`, ext === 'png' ? 'image/png' : 'image/jpeg');
    console.log('still:', imageUrl);
  }
  // 2. The schema decides the keys.
  const m = await rep(`/models/${model}`);
  const props = m.latest_version.openapi_schema.components.schemas.Input.properties;
  // enable_prompt_expansion is the model rewriting her words before it draws
  // (wan-2.7 and wan-3 default it ON); off wherever the schema offers it —
  // nothing stands between the prompt and the model.
  const want = { image: imageUrl, prompt, duration: secs, resolution: res, aspect_ratio: ar, generate_audio: audio, enable_prompt_expansion: false };
  const input = {};
  for (const [k, v] of Object.entries(want)) if (k in props) input[k] = v; else console.log('schema has no', k, '— not sent');
  console.log('input:', JSON.stringify({ ...input, image: '<still>' }));
  if (dry) return;
  // 3. Draw.
  const p = await rep(`/models/${model}/predictions`, { method: 'POST', body: JSON.stringify({ input }) });
  console.log('prediction:', p.id);
  let cur = p;
  while (!['succeeded', 'failed', 'canceled'].includes(cur.status)) {
    await new Promise(r => setTimeout(r, 4000));
    cur = await rep(cur.urls.get);
  }
  if (cur.status !== 'succeeded') { console.error('FAILED:', cur.error || cur.status); process.exit(1); }
  const outUrl = Array.isArray(cur.output) ? cur.output[0] : cur.output;
  console.log('replicate url:', outUrl, 'predict_time:', cur.metrics && cur.metrics.predict_time);
  // 4. Mirror — Replicate's urls expire.
  const tmp = path.join(require('os').tmpdir(), out + '.mp4');
  const bytes = Buffer.from(await (await fetch(outUrl)).arrayBuffer());
  fs.writeFileSync(tmp, bytes);
  const clip = await mirror(tmp, `${prefix}/${out}.mp4`, 'video/mp4');
  console.log('clip:', clip, 'bytes:', bytes.length);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
