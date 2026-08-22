#!/usr/bin/env node
/**
 * Re-run a Playground run at a DIFFERENT resolution — same prompt, same style
 * reference, same quality — and report what the bigger canvas actually cost.
 *
 * Why this exists (Aug 2026, Sophie: "how come all the images that we ever make
 * ... are not high resolution?"). Every image surface in the repo hardcodes
 * 1024x1536 or 1024x1024 — the only three sizes the OLD gpt-image-1 accepted.
 * gpt-image-2 takes any resolution up to 3840px / 8,294,400 px, and the
 * Playground's own toggle was never widened. This script is the way to render
 * an existing run at a bigger size without touching the live page, and it
 * PRINTS THE `usage` BLOCK — OpenAI publishes per-image prices for only nine
 * standard sizes, so the token counts it reports are the only honest source of
 * cost for anything else.
 *
 *   node scripts/playground-rerun-size.js <runId> --size 1568x2352
 *     [--quality medium] [--folder promptlab] [--dry-run]
 *
 * The prompt is taken VERBATIM from the stored run's `fullPrompt` (what was
 * really sent, including any prefix/suffix override she had saved that day) —
 * never rebuilt from today's baked style text, which drifts. Same rule as the
 * Assets-tab prompt filing: the exact text or nothing.
 *
 * NO output_compression, ever — see openaiImageEditRefs in server.js.
 *
 * Needs OPENAI_API_KEY and FIREBASE_SERVICE_ACCOUNT (Deck Factory).
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const PROMPTLAB = 'forge-promptlab';
// gpt-image-2 rates, verified 2026-08-16 (docs/modules/pictures.md).
const RATE = { textIn: 5 / 1e6, imageIn: 8 / 1e6, imageOut: 30 / 1e6 };

const args = process.argv.slice(2);
const runId = args.find(a => !a.startsWith('--'));
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const dry = args.includes('--dry-run');
const size = flag('size', '1568x2352');
const folder = flag('folder', 'promptlab');

if (!runId) {
  console.error('usage: node scripts/playground-rerun-size.js <runId> --size WxH [--quality q] [--dry-run]');
  process.exit(1);
}

// The constraints from OpenAI's image-generation guide. Checked here rather
// than discovered as a 400 after the refs have already been uploaded.
function checkSize(s) {
  const m = /^(\d+)x(\d+)$/.exec(s);
  if (!m) throw new Error(`size must look like 1568x2352, got "${s}"`);
  const w = Number(m[1]), h = Number(m[2]);
  const px = w * h, long = Math.max(w, h), short = Math.min(w, h);
  const bad = [];
  if (long > 3840) bad.push(`long edge ${long} > 3840`);
  if (w % 16 || h % 16) bad.push('both edges must be a multiple of 16');
  if (long / short > 3) bad.push(`ratio ${(long / short).toFixed(2)}:1 > 3:1`);
  if (px > 8294400) bad.push(`${px.toLocaleString()} px > 8,294,400`);
  if (px < 655360) bad.push(`${px.toLocaleString()} px < 655,360`);
  if (bad.length) throw new Error(`bad size ${s}: ${bad.join('; ')}`);
  return { w, h, px, experimental: px > 3686400 };
}

(async () => {
  const dim = checkSize(size);
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (!sa.project_id) throw new Error('FIREBASE_SERVICE_ACCOUNT (Deck Factory) not set');
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    storageBucket: `${sa.project_id}.firebasestorage.app`,
  });
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  const snap = await db.collection(PROMPTLAB).doc(runId).get();
  if (!snap.exists) throw new Error(`run ${runId} not found in ${PROMPTLAB}`);
  const run = snap.data();
  const quality = flag('quality', run.quality || 'medium');

  console.log(`run      ${runId}  (${new Date(run.createdAt?.toMillis?.() || run.createdAt)
    .toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT)`);
  console.log(`style    ${run.gptStyle}   ref ${run.styleRef}   edited:${!!run.promptEdited}`);
  console.log(`was      ${run.size} ${run.quality}   →   now ${size} ${quality}` +
    `  (${(dim.px / (1024 * 1536)).toFixed(2)}x the pixels of 1024x1536)`);
  if (dim.experimental) console.log('NOTE     over 2K (3,686,400 px) — OpenAI calls this size experimental');
  console.log('\n--- fullPrompt, sent verbatim ---\n' + run.fullPrompt + '\n---');
  if (dry) return process.exit(0);

  // The style reference, exactly as playgroundRefs() loads it.
  const refFile = run.styleRef || 'dream-mystery.jpg';
  const refBuf = fs.readFileSync(path.join(__dirname, '..', 'refs', refFile));

  // Node's own FormData, NOT the `form-data` package: server.js pairs that
  // package with node-fetch, and handing its stream to the global (undici)
  // fetch makes OpenAI answer "failed to parse multipart/form-data value".
  const form = new FormData();
  form.append('model', run.model || 'gpt-image-2');
  form.append('prompt', run.fullPrompt);
  form.append('size', size);
  form.append('quality', quality);
  form.append('output_format', 'webp');
  form.append('image[]', new Blob([refBuf], { type: 'image/png' }), 'ref1.png');

  console.log('\ndrawing…');
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('no image came back');
  const buf = Buffer.from(b64, 'base64');
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s — ${(buf.length / 1024).toFixed(0)}KB`);

  // The whole point of the script: what it actually cost, from the API's own
  // token counts rather than a price table that only covers nine sizes.
  const u = data.usage || {};
  const inT = u.input_tokens_details || {};
  const outT = u.output_tokens_details || {};
  const imgIn = inT.image_tokens || 0, txtIn = inT.text_tokens || 0;
  const imgOut = outT.image_tokens || u.output_tokens || 0;
  const cost = imgOut * RATE.imageOut + imgIn * RATE.imageIn + txtIn * RATE.textIn;
  console.log('\nusage    ' + JSON.stringify(u));
  console.log(`cost     output ${imgOut} tok = ${(imgOut * RATE.imageOut * 100).toFixed(2)}c` +
    ` · refs ${imgIn} tok = ${(imgIn * RATE.imageIn * 100).toFixed(2)}c` +
    ` · text ${txtIn} tok = ${(txtIn * RATE.textIn * 100).toFixed(2)}c`);
  console.log(`TOTAL    ${(cost * 100).toFixed(2)}c`);

  const name = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const file = bucket.file(name);
  await file.save(buf, { metadata: { contentType: 'image/webp' } });
  await file.makePublic();
  console.log(`\nurl      https://storage.googleapis.com/${bucket.name}/${name}`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
