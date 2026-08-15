#!/usr/bin/env node
/**
 * storybook-draw.js — draw scenes for ANY of the queued storybooks.
 *
 * marla-revise.js knows Marla's 36 numbered pages and nothing else, and
 * marla-extra.js hard-codes her sheet. The three queued books (Jonas, Juan,
 * Baby) each need the same recipe against their OWN character sheet, so this
 * is the one drawer they share: gpt-image-2 edits, refs/sage-sandy-mirror.png
 * attached FIRST as a pure style reference, the book's sheet second, medium,
 * 1024x1536, and NO written style block (docs/evan-film-style.md).
 *
 *   node scripts/storybook-draw.js --book jonas [--only 1,2,3] [--dry-run]
 *
 * Scenes and the per-book character line live in docs/storybooks/scenes.json.
 * Each picture FILES ITSELF the moment it exists (label + MODEL · QUALITY
 * caption + the exact prompt split) — never in a later step, which is how a
 * whole sampled batch once failed to reach Sophie's Assets tab.
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
const DRY = process.argv.includes('--dry-run');
const arg = (n) => { const i = process.argv.indexOf('--' + n); return i === -1 ? null : process.argv[i + 1]; };

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/storybooks/scenes.json'), 'utf8'));
const BOOK = arg('book');
const book = cfg.books[BOOK];
if (!book) throw new Error(`no book "${BOOK}" — have: ${Object.keys(cfg.books).join(', ')}`);

const STYLE_MANY = 'Use the first attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.';
const CARD = (who) => `The second attached image is a reference sheet for ${who} — the same child seen from more than one angle. Draw him or her as that child, in whatever pose this scene needs.`;
const NO_TEXT = 'Do not put any text, words, letters, numbers, captions or watermarks anywhere in the image.';

const who = book.title.split(' ')[0];
const buildPrompt = (scene) => [STYLE_MANY, CARD(who), '', `Draw: ${scene}`, book.character, '', NO_TEXT]
  .join('\n').replace(/\n{3,}/g, '\n\n').trim();

async function draw(prompt, cardBuf) {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', prompt);
  form.append('size', '1024x1536');
  form.append('quality', 'medium');
  form.append('output_format', 'png');
  form.append('image[]', fs.readFileSync(STYLE_REF), { filename: 'style.png', contentType: 'image/png' });
  if (cardBuf) form.append('image[]', cardBuf, { filename: 'card.png', contentType: 'image/png' });
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() }, body: form.getBuffer(),
  });
  const data = await r.json();
  if (data.error) { const e = new Error(data.error.message || 'edit error'); e.refusal = /safety|content policy|rejected as a result/i.test(e.message); throw e; }
  if (!data.data?.[0]?.b64_json) throw new Error('no image returned');
  return Buffer.from(data.data[0].b64_json, 'base64');
}
async function drawWithRetry(prompt, card, label) {
  let last;
  for (let a = 1; a <= 3; a++) {
    try { return await draw(prompt, card); }
    catch (e) { last = e; if (e.refusal) throw e; console.log(`   ${label}: ${e.message} — retry ${a}/3`); await new Promise((r) => setTimeout(r, 4000 * a)); }
  }
  throw last;
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

(async () => {
  const only = (arg('only') || Object.keys(book.scenes).join(',')).split(',').map((s) => s.trim()).filter(Boolean);
  console.log(`${book.title} — ${only.length} picture(s) · about $${(only.length * 0.06).toFixed(2)} · gpt-image-2 medium 1024x1536`);
  if (DRY) { for (const k of only) console.log(`\n--- ${k} ---\n` + buildPrompt(book.scenes[k])); return; }
  if (!process.env.OPENAI_API_KEY) throw new Error('No OPENAI_API_KEY.');
  initAdmin();

  const bucket = admin.storage().bucket();
  const cardBuf = book.sheet ? (await bucket.file(book.sheet).download())[0] : null;
  if (book.sheet && !cardBuf) throw new Error(`no sheet at ${book.sheet}`);

  const statePath = path.join(ROOT, 'docs/storybooks/draw-state.json');
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
  if (!state[BOOK]) state[BOOK] = {};

  for (const k of only) {
    const scene = book.scenes[k];
    if (!scene) { console.log(`${k}: no scene on file`); continue; }
    const prompt = buildPrompt(scene);
    process.stdout.write(`\n${k} … `);
    try {
      const art = await drawWithRetry(prompt, cardBuf, k);
      const url = await upload(art, `storybooks/${BOOK}/pages/p${String(k).padStart(2, '0')}.png`);
      state[BOOK][k] = { k, prompt, scene, url, at: Date.now() };
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
      console.log('✓');
      const label = `${book.title} — ${scene.split(/[.,]/)[0].slice(0, 70)}`;
      await fetch(`${BASE}/api/gallery`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetsOnly: true, chat: CHAT, url, description: label, prompt: 'gpt-image-2 · medium' }),
      });
      await fetch(`${BASE}/api/gallery/assets/prompt`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: CHAT, url,
          style: prompt.replace(`Draw: ${scene}`, 'Draw: [content]')
            + `\n\nAttached: refs/sage-sandy-mirror.png as the style reference`
            + (book.sheet ? `, then ${book.sheet.split('/').pop()} as ${who}'s character card${book.sheetNote ? ` (${book.sheetNote})` : ''}` : ' (no character card)')
            + '. gpt-image-2 edits, size 1024x1536, quality medium.',
          content: scene }),
      });
      console.log(`   ${url}`);
    } catch (e) { console.log(`FAILED — ${e.message}${e.refusal ? ' (safety refusal)' : ''}`); }
  }
  process.exit(0);
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
