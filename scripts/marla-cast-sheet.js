#!/usr/bin/env node
/**
 * marla-cast-sheet.js — a three-view character sheet drawn FROM a person who
 * already exists in one of the book's pictures.
 *
 * Sophie pointed at the page-13 test image and said "can you make this the dad
 * character? and this can be the mom also" — so the reference is a CROP of that
 * drawing, not a written description. That is the opposite direction from
 * char-sheet.js (words -> sheet) and it is the better one whenever she has
 * already seen someone she likes.
 *
 * THE LIKENESS LINE IS ONE SENTENCE AND MUST NOT GROW (docs/nde-watercolor.md):
 * "The SECOND attached image shows the person to draw." A preserve-list —
 * "same face, same hair, do not redesign" — over-weights the face and the
 * result comes back as a rendered photograph instead of a drawing. Learned on
 * the NDE cards; do not re-add it here.
 *
 * NEVER put a shell variable inside a Storage URL in a command — `for k in …;
 * do curl ".../$k.png"` files the UNEXPANDED text as a phantom image tile in
 * her Assets tab (done three times in one session). Loop in node instead.
 *
 *   node scripts/marla-cast-sheet.js --key dad-sheet --ref crop-dad.png \
 *     --who man --wears "a white shirt, a dark necktie…" [--dry-run]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');
const FormData = require('form-data');

const ROOT = path.join(__dirname, '..');
const STYLE_REF = path.join(ROOT, 'refs/sage-sandy-mirror.png');
const CHAT = 'marlas-eyes-fishbowl-storybook';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const MODEL = 'gpt-image-2', QUALITY = 'medium', SIZE = '1024x1536';
const arg = (n) => { const i = process.argv.indexOf('--' + n); return i === -1 ? null : process.argv[i + 1]; };
const DRY = process.argv.includes('--dry-run');

const STYLE_LINE = 'Use the FIRST attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.';
const REF_LINE = 'The SECOND attached image shows the person to draw.';
const NO_TEXT = 'Do not put any text, words, letters, numbers, captions or watermarks anywhere in the image.';

function scenePart(who, wears) {
  return `A character reference sheet of that ${who} on a single cream page: three views of the SAME ${who}, `
    + 'side by side — a front view, a three-quarter view, and a side profile looking left. '
    + `Plain empty background, nothing else on the page. In all three views ${who === 'man' ? 'he' : 'she'} wears ${wears}.`;
}
const buildPrompt = (scene) => [STYLE_LINE, REF_LINE, '', `Draw: ${scene}`, '', NO_TEXT].join('\n');

async function draw(prompt, refBuf) {
  const form = new FormData();
  form.append('model', MODEL);
  form.append('prompt', prompt);
  form.append('size', SIZE);
  form.append('quality', QUALITY);
  form.append('output_format', 'png');
  form.append('image[]', fs.readFileSync(STYLE_REF), { filename: 'style.png', contentType: 'image/png' });
  form.append('image[]', refBuf, { filename: 'person.png', contentType: 'image/png' });
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() }, body: form.getBuffer(),
  });
  const data = await r.json();
  if (data.error) { const e = new Error(data.error.message || 'edit error'); e.refusal = /safety|content policy|rejected as a result/i.test(e.message); throw e; }
  if (!data.data?.[0]?.b64_json) throw new Error('no image returned');
  return Buffer.from(data.data[0].b64_json, 'base64');
}

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.STORY_FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
  const pid = JSON.parse(raw).project_id;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)), storageBucket: `${pid}.firebasestorage.app` });
}
async function upload(buf, dest) {
  const bucket = admin.storage().bucket();
  const tmp = path.join(os.tmpdir(), path.basename(dest));
  fs.writeFileSync(tmp, buf);
  await bucket.upload(tmp, { destination: dest, metadata: { contentType: 'image/png' } });
  await bucket.file(dest).makePublic();
  fs.unlink(tmp, () => {});
  return `https://storage.googleapis.com/${bucket.name}/${dest}`;
}

// MERGE ON WRITE — two of these scripts can run at once (see marla-revise.js).
function saveExtra(key, rec) {
  const f = path.join(ROOT, 'docs/marla/state.json');
  const disk = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!disk.extra) disk.extra = {};
  disk.extra[key] = rec;
  fs.writeFileSync(f, JSON.stringify(disk, null, 2) + '\n');
}

(async () => {
  const key = arg('key'), ref = arg('ref'), who = arg('who') || 'man', wears = arg('wears') || '';
  const label = arg('label') || key;
  if (!key || !ref) throw new Error('--key and --ref are required');
  const scene = scenePart(who, wears);
  const prompt = buildPrompt(scene);
  if (DRY) { console.log(prompt); return; }
  if (!process.env.OPENAI_API_KEY) throw new Error('No OPENAI_API_KEY.');
  console.log(`${key} · about $0.06 · ${MODEL} ${QUALITY} ${SIZE}`);
  initAdmin();

  const refBuf = fs.readFileSync(ref);
  let art, last;
  for (let a = 1; a <= 3 && !art; a++) {
    try { art = await draw(prompt, refBuf); }
    catch (e) { last = e; if (e.refusal) throw e; console.log(`   ${e.message} — retry ${a}/3`); await new Promise((r) => setTimeout(r, 4000 * a)); }
  }
  if (!art) throw last;

  const url = await upload(art, `storybook/marla/extra/${key}.png`);
  saveExtra(key, { k: key, prompt, scene, url, ref, card: true, at: Date.now() });
  // FILE IT NOW — an unfiled picture is one she never sees.
  await fetch(`${BASE}/api/gallery`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetsOnly: true, chat: CHAT, url, description: label, prompt: `${MODEL} · ${QUALITY}` }),
  });
  await fetch(`${BASE}/api/gallery/assets/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, url,
      style: prompt.replace(`Draw: ${scene}`, 'Draw: [content]')
        + `\n\nAttached: refs/sage-sandy-mirror.png as the style reference, then a crop of ${path.basename(ref)} as the person. ${MODEL} edits, size ${SIZE}, quality ${QUALITY}.`,
      content: scene }),
  });
  console.log('✓ ' + url);
  process.exit(0);
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
