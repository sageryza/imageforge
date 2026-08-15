#!/usr/bin/env node
/**
 * marla-extra.js — draw a NAMED scene from docs/marla/revisions.json.
 *
 * marla-revise.js only knows numbered book pages, so a variant or a half of a
 * page ("3a" = just the bathtub city, "32e" = the diagram with her circles)
 * has nowhere to live there. Same recipe exactly: gpt-image-2 edits, the style
 * ref first, sheet 1 as Marla's card when the scene has her in it, medium,
 * 1024x1536 — and NO caption band, because these are pieces to look at, not
 * finished pages.
 *
 *   node scripts/marla-extra.js --only 3a,3b,32e [--no-card] [--dry-run]
 *
 * Each one files itself into the Assets tab the moment it exists (label +
 * MODEL · QUALITY caption + the exact prompt split) — see the note in
 * marla-revise.js about why filing never waits for a later step.
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
const NO_CARD = process.argv.includes('--no-card');
const arg = (n) => { const i = process.argv.indexOf('--' + n); return i === -1 ? null : process.argv[i + 1]; };
// Sophie on the armchair page: 'more of the windows showing which means the
// image aspect ratio might need to change'. Every other surface here is locked
// to 2:3 portrait; a scene that wants width has nowhere else to go.
const SIZES = { portrait: '1024x1536', landscape: '1536x1024', square: '1024x1024' };
const SIZE = SIZES[arg('shape') || 'portrait'] || SIZES.portrait;

const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/marla/state.json'), 'utf8'));
const rev = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/marla/revisions.json'), 'utf8'));
const SHEET = state.marlaSheetV2;                       // sheet 1, the one she picked

const STYLE_MANY = 'Use the first attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.';
const STYLE_ONE = 'Use the attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.';
const CARD_LINE = 'The second attached image is a reference sheet for Marla — three views of the same girl. Draw her as that girl, in whatever pose this scene needs.';
const NO_TEXT = 'Do not put any text, words, letters, numbers, captions or watermarks anywhere in the image.';

const hasMarla = (scene) => /\bgirl\b|\bMarla\b|\bher\b/i.test(scene);

// A variant key carries its page number ("32e" -> 32), so a beach variant gets
// the same sun-hat continuity line the numbered page would. Without this, 32e
// drew her bare-headed on the sand while page 32 itself wears the hat — the
// kind of drift that is invisible until the two sit side by side.
const pageOf = (key) => Number(String(key).replace(/[a-z]+$/i, '')) || null;
function extraLines(key, scene) {
  const out = [];
  if (hasMarla(scene)) {
    out.push(rev.character.line);
    const n = pageOf(key);
    if (n && (rev.beachPages || []).includes(n) && rev.beachHat) out.push(rev.beachHat);
  }
  return out.filter(Boolean);
}

function buildPrompt(scene, card, key) {
  return [card ? STYLE_MANY : STYLE_ONE, card ? CARD_LINE : '', '', `Draw: ${scene}`,
    ...(card ? extraLines(key, scene) : []), '', NO_TEXT]
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function draw(prompt, cardBuf) {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', prompt);
  form.append('size', SIZE);
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

const LABELS = {
  '3e': 'Page 3 split — the storm INSIDE her chest, seen through her, not on the dress',
  '3f': 'Page 3 split — the bathtub, city only just peeking over the rim',
  '32h': 'Page 32 — the diagram, her eye straight on with space around it',
  '23w': 'Page 23 — the red armchair, wider frame with more window',
  'mother-sheet': "Marla's mother — character sheet, three views, black dress",
  '3d': 'Page 3 split — the bathtub with gold feet, tiles, and the city rising higher',
  '32g': 'Page 32 — the diagram with each circle pointing at the thing it shows',
  '3c': 'Page 3 split — Marla at the window, storm drawn large enough to read',
  '3a': 'Page 3 split — the city sitting in a real bathtub, on its own',
  '3b': "Page 3 split — Marla at the window with the storm on her chest, on its own",
  '3c': "Page 3 split — Marla at the window, storm drawn large enough to read",
  '32f': 'Page 32 — the diagram with your three circles, and her sun hat back on',
  '32e': 'Page 32 — the diagram with your three circles: rain, ocean, and her eye with a tear starting',
};

// MERGE ON WRITE, never stamp the whole file. Two of these scripts running at
// once each read state.json at startup and wrote their whole in-memory copy
// back, so the last writer silently dropped the other's entries — 3d, 32g and
// 23w vanished from the bookkeeping while the pictures themselves sat safely
// in Storage and in the Assets tab. Re-read immediately before writing.
function saveExtra(key, rec) {
  const f = path.join(ROOT, 'docs/marla/state.json');
  const disk = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!disk.extra) disk.extra = {};
  disk.extra[key] = rec;
  fs.writeFileSync(f, JSON.stringify(disk, null, 2) + '\n');
}

(async () => {
  const only = (arg('only') || Object.keys(rev.scenes).filter((k) => /[a-z]$/.test(k))).split(',').map((s) => s.trim());
  if (!process.env.OPENAI_API_KEY) throw new Error('No OPENAI_API_KEY.');
  console.log(`${only.length} drawing(s) · about $${(only.length * 0.06).toFixed(2)} · gpt-image-2 medium ${SIZE}`);
  if (DRY) { for (const k of only) console.log(`\n--- ${k} ---\n` + buildPrompt(rev.scenes[k], !NO_CARD && hasMarla(rev.scenes[k]) ? {} : null, k)); return; }

  initAdmin();
  const cardBuf = Buffer.from(await (await fetch(SHEET.url)).arrayBuffer());
  if (!state.extra) state.extra = {};

  for (const k of only) {
    const scene = rev.scenes[k];
    if (!scene) { console.log(`${k}: no scene on file`); continue; }
    const useCard = !NO_CARD && hasMarla(scene);
    const prompt = buildPrompt(scene, useCard ? cardBuf : null, k);
    process.stdout.write(`\n${k} … `);
    try {
      const art = await drawWithRetry(prompt, useCard ? cardBuf : null, k);
      const url = await upload(art, `storybook/marla/extra/${k}.png`);
      state.extra[k] = { k, prompt, scene, url, card: useCard, at: Date.now() };
      saveExtra(k, state.extra[k]);
      console.log('✓');
      // file it NOW — an unfiled picture is one she never sees
      await fetch(`${BASE}/api/gallery`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetsOnly: true, chat: CHAT, url, description: LABELS[k] || `Marla — ${k}`, prompt: 'gpt-image-2 · medium' }),
      });
      await fetch(`${BASE}/api/gallery/assets/prompt`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: CHAT, url,
          style: prompt.replace(`Draw: ${scene}`, 'Draw: [content]')
            + '\n\nAttached: refs/sage-sandy-mirror.png as the style reference'
            + (useCard ? ", then marla-v2.png (sheet option 1) as Marla's character card" : ' (no character card)')
            + `. gpt-image-2 edits, size ${SIZE}, quality medium.`,
          content: scene }),
      });
      console.log(`   ${url}`);
    } catch (e) { console.log(`FAILED — ${e.message}${e.refusal ? ' (safety refusal)' : ''}`); }
  }
  process.exit(0);
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
