#!/usr/bin/env node
/**
 * marla-fishbowl-test.js — the ORIGINAL page 1 prompt, run again against the
 * character sheets (Sophie, Aug 2026: "try that fishbowl original one with the
 * same prompt, then two versions with number one and one more with number
 * five").
 *
 * THE POINT IS THAT ONLY THE CARD CHANGES. The scene text is the ORIGINAL
 * page 1 wording — the head-on portrait "as though the whole picture is being
 * looked at through curved glass" — not the rewritten "seen THROUGH the
 * fishbowl" scene the v2/v3e pages use. So the four pictures differ in exactly
 * one thing: which Marla the model was handed, or none at all.
 *
 *   a  no card         the original run, reproduced
 *   b  sheet option 1  (marla-v2.png)
 *   c  sheet option 1  again — same prompt, different draw
 *   d  sheet option 5  (marla-v3e.png, the one she picked)
 *
 * ONE LINE IS ADDED and it has to be, so it is named here and in the reply:
 * when a card is attached the prompt must say what the second image IS, or
 * the model has no idea why it is there. That is CARD_LINE below, lifted
 * verbatim from marla-revise.js. Nothing else is added — no character
 * continuity line, no style words. (docs/evan-film-style.md: no written style
 * block; CLAUDE.md: if you add anything to a prompt she gave, say so.)
 *
 * USAGE
 *   node scripts/marla-fishbowl-test.js [--dry-run]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');
const sharp = require('sharp');
const FormData = require('form-data');

const ROOT = path.join(__dirname, '..');
const STYLE_REF = path.join(ROOT, 'refs/sage-sandy-mirror.png');
const CHAT = 'marlas-eyes-fishbowl-storybook';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const QUALITY = 'medium', MODEL = 'gpt-image-2', SIZE = '1024x1536', W = 1024, H = 1536;
const DRY = process.argv.includes('--dry-run');

const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/marla/state.json'), 'utf8'));
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/marla/pages.json'), 'utf8'));
const rev = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/marla/revisions.json'), 'utf8'));
const PAGE1 = plan.pages.find((p) => p.n === 1);

// WHICH page 1 wording. Default is the ORIGINAL — the head-on portrait "as
// though the whole picture is being looked at through curved glass".
// --second is the REWRITE her note asked for, where the bowl is really in the
// picture and doing the widening, plus the character continuity line that
// rides with it. That rewrite is the one she meant; the original ran first by
// my misreading, and both sets are kept.
const SECOND = process.argv.includes('--second');
const SCENE = SECOND ? rev.scenes['1'] : PAGE1.scene;
const EXTRA = SECOND ? rev.character.line : '';

const STYLE_ONE = 'Use the attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.';
const STYLE_MANY = 'Use the first attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.';
const CARD_LINE = 'The second attached image is a reference sheet for Marla — three views of the same girl. Draw her as that girl, in whatever pose this scene needs.';
const CALM = 'Keep the lower third of the picture calm and uncluttered.';
const NO_TEXT = 'Do not put any text, words, letters, numbers, captions or watermarks anywhere in the image.';

const RUNS = SECOND ? [
  { tag: 'e', sheet: 'marlaSheetV2',   label: 'sheet option 1' },
  { tag: 'f', sheet: 'marlaSheetV2',   label: 'sheet option 1, second draw' },
  { tag: 'g', sheet: 'marlaSheet_v3e', label: 'sheet option 5 — the one you picked' },
] : [
  { tag: 'a', sheet: null,             label: 'no character card — the original run reproduced' },
  { tag: 'b', sheet: 'marlaSheetV2',   label: 'sheet option 1' },
  { tag: 'c', sheet: 'marlaSheetV2',   label: 'sheet option 1, second draw' },
  { tag: 'd', sheet: 'marlaSheet_v3e', label: 'sheet option 5 — the one you picked' },
];

const buildPrompt = (withCard) => [
  withCard ? STYLE_MANY : STYLE_ONE,
  withCard ? CARD_LINE : '',
  '',
  `Draw: ${SCENE}`,
  EXTRA,
  '',
  `${CALM} ${NO_TEXT}`,
].join('\n').replace(/\n{3,}/g, '\n\n').trim();

async function draw(prompt, cardBuf) {
  const form = new FormData();
  form.append('model', MODEL);
  form.append('prompt', prompt);
  form.append('size', SIZE);
  form.append('quality', QUALITY);
  form.append('output_format', 'png');
  form.append('image[]', fs.readFileSync(STYLE_REF), { filename: 'style.png', contentType: 'image/png' });
  if (cardBuf) form.append('image[]', cardBuf, { filename: 'card.png', contentType: 'image/png' });
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() },
    body: form.getBuffer(),
  });
  const data = await r.json();
  if (data.error) {
    const e = new Error(data.error.message || 'gpt-image-2 edit error');
    e.refusal = /safety|moderation|content policy|rejected as a result of/i.test(e.message);
    throw e;
  }
  if (!data.data?.[0]?.b64_json) throw new Error('gpt-image-2 returned no image');
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

// The caption band, identical to marla-revise.js — these are page comparisons,
// so they have to be captioned pages or she is comparing different things.
const esc = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
function wrap(text, max) {
  const lines = []; let cur = '';
  for (const w of String(text).trim().split(/\s+/).filter(Boolean)) {
    if ((cur + ' ' + w).trim().length > max) { if (cur) lines.push(cur.trim()); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur.trim());
  return lines;
}
async function captionPage(img, text) {
  const lines = wrap(text, 40);
  const fontSize = 36, lineH = Math.round(fontSize * 1.34), padY = 44;
  const bandH = Math.max(150, lines.length * lineH + padY * 2), top = H - bandH;
  const tspans = lines.map((l, i) => `<tspan x="${W / 2}" y="${top + padY + fontSize + i * lineH}">${esc(l)}</tspan>`).join('');
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`
    + `<rect x="0" y="${top}" width="${W}" height="${bandH}" fill="#fffdf6"/>`
    + `<rect x="0" y="${top}" width="${W}" height="3" fill="#e7e0cf"/>`
    + `<text font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" fill="#2c2622" `
    + `text-anchor="middle" font-style="italic">${tspans}</text></svg>`;
  return sharp(img).resize(W, H, { fit: 'cover' }).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).webp({ quality: 92 }).toBuffer();
}

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.STORY_FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
  const pid = JSON.parse(raw).project_id;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)), storageBucket: `${pid}.firebasestorage.app` });
}
async function upload(buf, dest, ct) {
  const bucket = admin.storage().bucket();
  const tmp = path.join(os.tmpdir(), path.basename(dest));
  fs.writeFileSync(tmp, buf);
  await bucket.upload(tmp, { destination: dest, metadata: { contentType: ct } });
  await bucket.file(dest).makePublic();
  fs.unlink(tmp, () => {});
  return `https://storage.googleapis.com/${bucket.name}/${dest}`;
}

(async () => {
  if (DRY) {
    console.log('WITHOUT a card:\n' + buildPrompt(false));
    console.log('\n\nWITH a card:\n' + buildPrompt(true));
    return;
  }
  if (!process.env.OPENAI_API_KEY) throw new Error('No OPENAI_API_KEY.');
  initAdmin();
  console.log(`${RUNS.length} runs · about $${(RUNS.length * 0.06).toFixed(2)} · ${MODEL} ${QUALITY} ${SIZE}`);

  const cards = {};
  for (const r of RUNS) {
    if (!r.sheet || cards[r.sheet]) continue;
    const url = state[r.sheet]?.url;
    if (!url) throw new Error(`no sheet on file for ${r.sheet}`);
    cards[r.sheet] = Buffer.from(await (await fetch(url)).arrayBuffer());
  }

  if (!state.fishbowlTest) state.fishbowlTest = {};
  const items = [];
  for (const r of RUNS) {
    const prompt = buildPrompt(!!r.sheet);
    process.stdout.write(`  ${r.tag} — ${r.label} … `);
    try {
      const art = await drawWithRetry(prompt, r.sheet ? cards[r.sheet] : null, r.tag);
      const artUrl = await upload(art, `storybook/marla/fishbowl-test/p01-${r.tag}.png`, 'image/png');
      const pageUrl = await upload(await captionPage(art, PAGE1.words), `storybook/marla/fishbowl-test/p01-${r.tag}.webp`, 'image/webp');
      state.fishbowlTest[r.tag] = { ...r, prompt, artUrl, pageUrl, at: Date.now() };
      fs.writeFileSync(path.join(ROOT, 'docs/marla/state.json'), JSON.stringify(state, null, 2) + '\n');
      console.log('✓');

      const label = `Page 1, the ${SECOND ? 'FISHBOWL rewrite' : 'ORIGINAL'} prompt — ${r.label}`;
      await fetch(`${BASE}/api/gallery`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetsOnly: true, chat: CHAT, url: pageUrl, description: label, prompt: 'gpt-image-2 · medium' }),
      });
      items.push({
        url: pageUrl,
        style: prompt.replace(`Draw: ${SCENE}`, 'Draw: [content]')
          + '\n\nAttached: refs/sage-sandy-mirror.png as the style reference'
          + (r.sheet ? `, then ${state[r.sheet].url.split('/').pop()} as Marla's character card` : ' (no character card)')
          + '. gpt-image-2 edits, size 1024x1536, quality medium.',
        content: SCENE,
      });
    } catch (e) { console.log(`FAILED — ${e.message}${e.refusal ? ' (safety refusal)' : ''}`); }
  }
  if (items.length) {
    const p = await fetch(`${BASE}/api/gallery/assets/prompt`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: CHAT, items }),
    });
    console.log(`prompts filed: ${(await p.json()).saved}`);
  }
  process.exit(0);
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
