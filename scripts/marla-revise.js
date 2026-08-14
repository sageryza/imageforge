#!/usr/bin/env node
/**
 * marla-revise.js — round 2 of "Eyes as Wide as a Fishbowl": redraw pages from
 * Sophie's notes, with a rebuilt Marla character reference.
 *
 * HER PAGE 13 NOTE IS THE WHOLE REASON THIS EXISTS. The round-1 card was a
 * head-on portrait, so the model kept giving her head-on portraits — a
 * character card teaches POSE as much as face. The new card is a three-view
 * sheet (front, three-quarter, profile), and it also nails down what the old
 * one left free: she is eleven (page 18 read about fifteen), hazel-eyed, in
 * big loose curls, and in the SAME white-and-blue frock every time (she was in
 * a different dress on every page).
 *
 * A REDRAW REPLACES THE PAGE IN THE BOOK BUT KEEPS THE OLD PICTURE.
 * The gallery creation doc is the page SLOT — its url is repointed, so the
 * book stays 36 pages in order instead of growing a second copy of itself.
 * The superseded picture is never deleted: it stays in Storage and stays in
 * the Assets tab, relabeled "… v1 — superseded", which is where the house
 * re-roll rule wants history to live.
 *
 * Everything else — the Evan recipe, no written style block, the caption
 * compositor, resumability — is unchanged from scripts/marla-storybook.js.
 *
 * USAGE
 *   node scripts/marla-revise.js --sheet                 # rebuild Marla's card only
 *   node scripts/marla-revise.js --only 1,18 --sample    # try a few, file nothing
 *   GALLERY_UID=<uid> node scripts/marla-revise.js       # redraw + repoint the book
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');
const sharp = require('sharp');
const FormData = require('form-data');

const ROOT = path.join(__dirname, '..');
const PLAN = path.join(ROOT, 'docs/marla/pages.json');
const REV = path.join(ROOT, 'docs/marla/revisions.json');
const STATE = path.join(ROOT, 'docs/marla/state.json');
const STYLE_REF = path.join(ROOT, 'refs/sage-sandy-mirror.png');
const SHEET = path.join(os.tmpdir(), 'marla-sheet-v2.png');

const QUALITY = 'medium', MODEL = 'gpt-image-2', SIZE = '1024x1536', W = 1024, H = 1536;
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = 'marlas-eyes-fishbowl-storybook';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes(`--${n}`);

const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
const rev = JSON.parse(fs.readFileSync(REV, 'utf8'));
const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
if (!state.v2) state.v2 = {};
const saveState = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');

const NO_TEXT = 'Do not put any text, words, letters, numbers, captions or watermarks anywhere in the image.';
const CALM = 'Keep the lower third of the picture calm and uncluttered.';
const STYLE_ONE = 'Use the attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.';
const STYLE_MANY = 'Use the first attached image as a style reference. Only use its style, not its content — do not copy anything depicted in it. You do not have to copy its colors.';

// The scene as it stands after her notes: a rewritten one where she asked for a
// change, otherwise the original.
const sceneFor = (n) => rev.scenes[String(n)] || plan.pages.find((p) => p.n === n).scene;

function buildPrompt(n, cards) {
  const who = plan.cast[String(n)] || [];
  const ordinals = ['second', 'third', 'fourth'];
  const cardLines = cards.map((name, i) => name === 'marla'
    ? `The ${ordinals[i]} attached image is a reference sheet for Marla — three views of the same girl. Draw her as that girl, in whatever pose this scene needs.`
    : `The ${ordinals[i]} attached image is Tommy. Draw him as that boy.`);
  const notes = who.filter((w) => plan.continuity[w]).map((w) => plan.continuity[w]);
  if (who.includes('marla')) {
    notes.unshift(rev.character.line + (rev.beachPages.includes(n) ? ' ' + rev.beachHat : ''));
  }
  return [
    cards.length ? STYLE_MANY : STYLE_ONE,
    cardLines.join(' '),
    '',
    `Draw: ${sceneFor(n)}`,
    notes.join(' '),
    '',
    `${CALM} ${NO_TEXT}`,
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function draw(prompt, cardFiles) {
  const form = new FormData();
  form.append('model', MODEL);
  form.append('prompt', prompt);
  form.append('size', SIZE);
  form.append('quality', QUALITY);
  form.append('output_format', 'png');
  form.append('image[]', fs.readFileSync(STYLE_REF), { filename: 'style.png', contentType: 'image/png' });
  cardFiles.forEach((f, i) => form.append('image[]', fs.readFileSync(f), { filename: `card${i + 1}.png`, contentType: 'image/png' }));
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
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('gpt-image-2 returned no image');
  return Buffer.from(b64, 'base64');
}

async function drawWithRetry(prompt, cards, label) {
  let last;
  for (let a = 1; a <= 3; a++) {
    try { return await draw(prompt, cards); }
    catch (e) { last = e; if (e.refusal) throw e; console.log(`   ${label}: ${e.message} — retry ${a}/3`); await new Promise((r) => setTimeout(r, 4000 * a)); }
  }
  throw last;
}

const escapeXml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
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
  const tspans = lines.map((l, i) => `<tspan x="${W / 2}" y="${top + padY + fontSize + i * lineH}">${escapeXml(l)}</tspan>`).join('');
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

async function buildSheet() {
  const prompt = [STYLE_ONE, '', `Draw: ${rev.character.sheetScene}`, '', NO_TEXT].join('\n');
  console.log('drawing Marla character sheet v2…');
  const buf = await drawWithRetry(prompt, [], 'sheet');
  fs.writeFileSync(SHEET, buf);
  const url = await upload(buf, 'storybook/marla/refs/marla-v2.png', 'image/png');
  state.marlaSheetV2 = { url, prompt, at: Date.now() };
  saveState();
  console.log(`   sheet ✓  ${url}`);
  return SHEET;
}

async function ensureSheet() {
  if (fs.existsSync(SHEET)) return SHEET;
  if (state.marlaSheetV2?.url) {
    const r = await fetch(state.marlaSheetV2.url);
    fs.writeFileSync(SHEET, Buffer.from(await r.arrayBuffer()));
    return SHEET;
  }
  return buildSheet();
}
async function ensureTommy() {
  const f = path.join(os.tmpdir(), 'marla-art-19.png');
  if (!fs.existsSync(f)) {
    const r = await fetch(state.pages[19].artUrl);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  return f;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error('No OPENAI_API_KEY.');
  initAdmin();
  if (has('sheet')) { await buildSheet(); return; }

  const onlyArg = arg('only');
  const only = onlyArg ? onlyArg.split(',').map((s) => Number(s.trim())) : rev.redraw;
  const sample = has('sample');            // draw + upload, but don't touch the book
  const force = has('force');

  const marlaCard = await ensureSheet();
  const tommyCard = await ensureTommy();

  console.log(`redrawing ${only.length} page(s) · about $${(only.length * 0.06).toFixed(2)}`);
  for (const n of only) {
    if (state.v2[n]?.pageUrl && !force) { console.log(`page ${n}: already redrawn`); continue; }
    const page = plan.pages.find((p) => p.n === n);
    const names = (plan.cast[String(n)] || []).filter((w) => w === 'marla' || w === 'tommy');
    const cards = names.map((w) => (w === 'marla' ? marlaCard : tommyCard));
    const prompt = buildPrompt(n, names);
    console.log(`\npage ${n}${names.length ? ` (${names.join(' + ')})` : ''}${rev.scenes[String(n)] ? ' · scene rewritten' : ''}`);
    try {
      const art = await drawWithRetry(prompt, cards, `page ${n}`);
      const stamp = String(n).padStart(2, '0');
      const artUrl = await upload(art, `storybook/marla/art/p${stamp}-v2.png`, 'image/png');
      const pageUrl = await upload(await captionPage(art, page.words), `storybook/marla/pages/p${stamp}-v2.webp`, 'image/webp');
      state.v2[n] = { n, prompt, scene: sceneFor(n), artUrl, pageUrl, cards: names, at: Date.now() };
      saveState();
      console.log(`   ✓ ${pageUrl}`);
    } catch (e) {
      console.log(`   FAILED: ${e.message}${e.refusal ? ' (safety refusal — not retried)' : ''}`);
    }
  }
  if (sample) { console.log('\n--sample: the book is untouched.'); return; }
  await repoint(only);
}

// Repoint each page's EXISTING creation doc at the v2 image, so the book stays
// 36 pages in the same order. The v1 picture is kept and relabeled in Assets.
async function repoint(nums) {
  const uid = process.env.GALLERY_UID;
  if (!uid) throw new Error('Set GALLERY_UID.');
  const col = admin.firestore().collection('users').doc(uid).collection('creations');
  const snap = await col.where('type', '==', 'storybook').get();
  const byPage = new Map(snap.docs.map((d) => [d.get('page'), d]));

  let moved = 0;
  for (const n of nums) {
    const v2 = state.v2[n];
    if (!v2?.pageUrl) continue;
    const doc = byPage.get(n);
    if (!doc) { console.log(`page ${n}: no creation doc, skipped`); continue; }
    const v1Url = doc.get('url');
    if (v1Url === v2.pageUrl) continue;
    await doc.ref.update({ url: v2.pageUrl, version: 2, supersededUrl: v1Url });
    // History: relabel the old picture in Assets, then file the new one.
    await fetch(`${BASE}/api/gallery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetsOnly: true, chat: CHAT, url: v1Url,
        description: `Page ${n} v1 — superseded`, prompt: 'gpt-image-2 · medium' }),
    });
    const page = plan.pages.find((p) => p.n === n);
    const w = page.words.replace(/\s+/g, ' ').trim();
    const short = w.length > 56 ? w.slice(0, 56).replace(/[\s,;:.—-]+\S*$/, '') + '…' : w;
    await fetch(`${BASE}/api/gallery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetsOnly: true, chat: CHAT, url: v2.pageUrl,
        description: `Page ${n} v2 — ${short}`, prompt: 'gpt-image-2 · medium' }),
    });
    const style = v2.prompt.replace(`Draw: ${v2.scene}`, 'Draw: [content]')
      + '\n\nAttached: refs/sage-sandy-mirror.png as the style reference'
      + (v2.cards.length ? `, then the ${v2.cards.join(' and ')} character card${v2.cards.length > 1 ? 's' : ''} (Marla is the v2 three-view sheet)` : '')
      + '. gpt-image-2 edits, size 1024x1536, quality medium.';
    await fetch(`${BASE}/api/gallery/assets/prompt`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: CHAT, url: v2.pageUrl, style, content: v2.scene }),
    });
    moved++;
  }
  console.log(`\nrepointed ${moved} page(s); the book is still ${snap.size} pages.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.stack || e.message); process.exit(1); });
