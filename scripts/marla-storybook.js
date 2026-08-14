#!/usr/bin/env node
/**
 * marla-storybook.js — turn Sophie's 2016 story "Eyes as Wide as a Fishbowl"
 * (the full long version, out of Google Drive) into a picture book that lands
 * in the iOS app's **Storybook** tool.
 *
 * WHAT THE STORYBOOK TOOL READS (StorybookView.swift)
 *   ForgeService.fetchCreations(limit: 90) → the newest creations in
 *   membry-df528 `users/{uid}/creations`, filtered to `type === "storybook"`,
 *   then REVERSED — so a book reads oldest-first. Page 1 therefore needs the
 *   OLDEST createdAt; this script stamps them one second apart in page order.
 *
 * THE ART — the settled Evan recipe (docs/evan-film-style.md), which is what
 * Sophie picked for this book:
 *   - gpt-image-2, the image EDITS endpoint
 *   - refs/sage-sandy-mirror.png attached FIRST as a pure style reference
 *   - quality medium (not high — high reads more finished, less sketchbook)
 *   - size 1024x1536
 *   - **NO written style description.** That is the headline rule of that doc:
 *     every style block tested made it worse. Do not "improve" the prompt by
 *     adding ink/watercolour/palette language.
 *   The only things appended to her scene are a no-text line (we composite the
 *   caption ourselves, so lettering in the picture is a defect) and a
 *   keep-the-bottom-calm composition note, because the caption band sits there.
 *
 * CHARACTER CONTINUITY — Marla and Tommy carry the whole book, so their two
 * pages are drawn FIRST and then ride along as character cards on every page
 * they appear in (the anchor technique the movies/dream pipelines use). The
 * likeness line is ONE sentence on purpose: docs/nde-watercolor.md measured
 * that a "same face, same hair" preserve-list over-weights the face and the
 * drawing comes out as a rendered photograph. The grown-ups are held together
 * by a one-line written description instead (they appear a handful of times).
 *
 * THE CAPTION is composited here, not drawn — same look as the house renderer
 * in memory-library-react functions/index.js (captionStorybookPage: cream band,
 * hairline rule, Georgia italic), with the type scaled down because this is a
 * literary story with real paragraphs, not a six-word children's line.
 *
 * RESUMABLE. Every finished page is written to docs/marla/state.json the moment
 * it lands, so a crash keeps what it already paid for. Re-running only draws
 * what is missing; --only re-draws named pages.
 *
 * USAGE
 *   GALLERY_UID=<uid> node scripts/marla-storybook.js --dry-run
 *   GALLERY_UID=<uid> node scripts/marla-storybook.js            # draw + file
 *   GALLERY_UID=<uid> node scripts/marla-storybook.js --only 7,12 --force
 *   GALLERY_UID=<uid> node scripts/marla-storybook.js --post-only
 * Needs OPENAI_API_KEY and STORY_FIREBASE_SERVICE_ACCOUNT (the membry account).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');
const sharp = require('sharp');
const FormData = require('form-data');

const ROOT = path.join(__dirname, '..');
const PLAN = path.join(ROOT, 'docs/marla/pages.json');
const STATE = path.join(ROOT, 'docs/marla/state.json');
const STYLE_REF = path.join(ROOT, 'refs/sage-sandy-mirror.png');

const QUALITY = 'medium';
const MODEL = 'gpt-image-2';
const SIZE = '1024x1536';
const W = 1024, H = 1536;

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : def;
}
const has = (name) => process.argv.includes(`--${name}`);

const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { pages: {} };
function saveState() { fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n'); }

// --- the prompt -----------------------------------------------------------
// Attachment 1 is always the style reference; character cards follow in the
// order they are appended, and the prompt numbers them so the model can tell
// them apart.
const NO_TEXT = 'Do not put any text, words, letters, numbers, captions or '
  + 'watermarks anywhere in the image.';
const CALM_BOTTOM = 'Keep the lower third of the picture calm and uncluttered.';

function buildPrompt(page, cards) {
  const styleLine = cards.length
    ? 'Use the first attached image as a style reference. Only use its style, '
      + 'not its content — do not copy anything depicted in it. You do not have '
      + 'to copy its colors.'
    : 'Use the attached image as a style reference. Only use its style, not its '
      + 'content — do not copy anything depicted in it. You do not have to copy '
      + 'its colors.';
  const ordinals = ['second', 'third', 'fourth'];
  const cardLines = cards.map((name, i) =>
    name === 'marla'
      ? `The ${ordinals[i]} attached image is Marla. Draw her as that girl.`
      : `The ${ordinals[i]} attached image is Tommy. Draw him as that boy.`);
  const who = (plan.cast[String(page.n)] || []);
  const notes = who
    .filter((w) => plan.continuity[w])
    .map((w) => plan.continuity[w]);
  return [
    styleLine,
    cardLines.join(' '),
    '',
    `Draw: ${page.scene}`,
    notes.join(' '),
    '',
    `${CALM_BOTTOM} ${NO_TEXT}`,
  ].filter((s) => s !== null && s !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// --- drawing --------------------------------------------------------------
async function draw(prompt, cardFiles) {
  const form = new FormData();
  form.append('model', MODEL);
  form.append('prompt', prompt);
  form.append('size', SIZE);
  form.append('quality', QUALITY);
  form.append('output_format', 'png');
  form.append('image[]', fs.readFileSync(STYLE_REF), { filename: 'style.png', contentType: 'image/png' });
  cardFiles.forEach((f, i) =>
    form.append('image[]', fs.readFileSync(f), { filename: `card${i + 1}.png`, contentType: 'image/png' }));

  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() },
    body: form.getBuffer(),
  });
  const data = await r.json();
  if (data.error) {
    const err = new Error(data.error.message || 'gpt-image-2 edit error');
    // A safety refusal is deterministic — retrying it only burns time (the
    // dream pipeline learned this the expensive way).
    err.refusal = /safety|moderation|content policy|rejected as a result of/i.test(err.message);
    throw err;
  }
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('gpt-image-2 returned no image');
  return Buffer.from(b64, 'base64');
}

async function drawWithRetry(prompt, cardFiles, label) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await draw(prompt, cardFiles); }
    catch (e) {
      last = e;
      if (e.refusal) throw e;
      console.log(`   ${label}: ${e.message} — retry ${attempt}/3`);
      await new Promise((r) => setTimeout(r, 4000 * attempt));
    }
  }
  throw last;
}

// --- the caption band -----------------------------------------------------
// Mirrors captionStorybookPage in the Cloud Functions (cream band, 3px rule,
// Georgia italic, centred) with the type scaled for real paragraphs: 36px over
// a ~40-character wrap instead of 46px over 30.
const escapeXml = (s) => String(s).replace(/[<>&'"]/g, (c) =>
  ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

function wrap(text, max) {
  const lines = [];
  let cur = '';
  for (const w of String(text).trim().split(/\s+/).filter(Boolean)) {
    if ((cur + ' ' + w).trim().length > max) { if (cur) lines.push(cur.trim()); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur.trim());
  return lines;
}

async function captionPage(imgBuffer, text) {
  const lines = wrap(text, 40);
  const fontSize = 36, lineH = Math.round(fontSize * 1.34), padY = 44;
  const bandH = Math.max(150, lines.length * lineH + padY * 2);
  const top = H - bandH;
  const tspans = lines.map((l, i) =>
    `<tspan x="${W / 2}" y="${top + padY + fontSize + i * lineH}">${escapeXml(l)}</tspan>`).join('');
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`
    + `<rect x="0" y="${top}" width="${W}" height="${bandH}" fill="#fffdf6"/>`
    + `<rect x="0" y="${top}" width="${W}" height="3" fill="#e7e0cf"/>`
    + `<text font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" fill="#2c2622" `
    + `text-anchor="middle" font-style="italic">${tspans}</text></svg>`;
  return sharp(imgBuffer).resize(W, H, { fit: 'cover' })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .webp({ quality: 92 }).toBuffer();
}

// --- storage + gallery ----------------------------------------------------
function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.STORY_FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Set STORY_FIREBASE_SERVICE_ACCOUNT (the membry account).');
  const pid = JSON.parse(raw).project_id;
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(raw)),
    storageBucket: `${pid}.firebasestorage.app`,
  });
}

async function upload(buffer, dest, contentType) {
  const bucket = admin.storage().bucket();
  const tmp = path.join(os.tmpdir(), path.basename(dest));
  fs.writeFileSync(tmp, buffer);
  await bucket.upload(tmp, { destination: dest, metadata: { contentType } });
  await bucket.file(dest).makePublic();
  fs.unlink(tmp, () => {});
  return `https://storage.googleapis.com/${bucket.name}/${dest}`;
}

// --- main -----------------------------------------------------------------
async function renderPage(page, cardPaths, cardNames) {
  const prompt = buildPrompt(page, cardNames);
  const label = `page ${page.n}`;
  const art = await drawWithRetry(prompt, cardPaths, label);

  // The bare drawing is kept too: it is the character card for later pages,
  // and a re-typeset of the book must never need re-paying for the art.
  const artUrl = await upload(art, `storybook/marla/art/p${String(page.n).padStart(2, '0')}.png`, 'image/png');
  const composed = await captionPage(art, page.words);
  const pageUrl = await upload(composed, `storybook/marla/pages/p${String(page.n).padStart(2, '0')}.webp`, 'image/webp');

  const cache = path.join(os.tmpdir(), `marla-art-${page.n}.png`);
  fs.writeFileSync(cache, art);

  state.pages[page.n] = { n: page.n, words: page.words, scene: page.scene, prompt, artUrl, pageUrl, cards: cardNames, at: Date.now() };
  saveState();
  console.log(`   page ${page.n} ✓  ${pageUrl}`);
  return cache;
}

async function main() {
  const dry = has('dry-run');
  const force = has('force');
  const onlyArg = arg('only');
  const only = onlyArg ? new Set(onlyArg.split(',').map((s) => Number(s.trim()))) : null;

  const pages = plan.pages.filter((p) => (only ? only.has(p.n) : true));
  const todo = pages.filter((p) => force || !state.pages[p.n]);

  console.log(`${plan.title} — ${plan.pages.length} pages; ${todo.length} to draw`);
  console.log(`recipe: ${MODEL} · ${QUALITY} · ${SIZE} · style ref sage-sandy-mirror.png · no written style block`);
  console.log(`estimated cost: about $${(todo.length * 0.06).toFixed(2)}`);
  if (dry) {
    for (const sample of [plan.pages[0], plan.pages[11]]) {
      const anchorPage = Object.values(plan.anchors).includes(sample.n);
      const names = anchorPage ? []
        : (plan.cast[String(sample.n)] || []).filter((w) => plan.anchors[w]);
      console.log(`\n--- prompt for page ${sample.n} ---\n${buildPrompt(sample, names)}`);
    }
    return;
  }
  if (!process.env.OPENAI_API_KEY) throw new Error('No OPENAI_API_KEY.');
  initAdmin();

  // 1. The two anchor pages first — they become the character cards.
  const cardFile = {};
  for (const [who, n] of Object.entries(plan.anchors)) {
    const cached = path.join(os.tmpdir(), `marla-art-${n}.png`);
    if (state.pages[n] && fs.existsSync(cached) && !(force && (!only || only.has(n)))) {
      cardFile[who] = cached; continue;
    }
    if (state.pages[n] && !force) {
      // Rendered in an earlier run whose tmp file is gone — pull the art back.
      const r = await fetch(state.pages[n].artUrl);
      fs.writeFileSync(cached, Buffer.from(await r.arrayBuffer()));
      cardFile[who] = cached; continue;
    }
    console.log(`\nanchor: ${who} (page ${n})`);
    const page = plan.pages.find((p) => p.n === n);
    cardFile[who] = await renderPage(page, [], []);
  }

  // 2. Everything else, with the cards for whoever is in the scene.
  for (const page of todo) {
    if (Object.values(plan.anchors).includes(page.n)) continue;
    const names = (plan.cast[String(page.n)] || []).filter((w) => cardFile[w]);
    console.log(`\npage ${page.n}${names.length ? ` (${names.join(' + ')})` : ''}`);
    try {
      await renderPage(page, names.map((w) => cardFile[w]), names);
    } catch (e) {
      console.log(`   page ${page.n} FAILED: ${e.message}${e.refusal ? ' (safety refusal — not retried)' : ''}`);
      state.pages[page.n] = { n: page.n, error: e.message, at: Date.now() };
      saveState();
    }
  }

  const done = plan.pages.filter((p) => state.pages[p.n]?.pageUrl).length;
  console.log(`\n${done} of ${plan.pages.length} pages drawn. Run --post-only to file them.`);
}

// --- filing the book into the gallery -------------------------------------
async function post() {
  initAdmin();
  const uid = process.env.GALLERY_UID;
  if (!uid) throw new Error('Set GALLERY_UID.');
  const db = admin.firestore();
  const col = db.collection('users').doc(uid).collection('creations');

  // Page 1 must be the OLDEST doc: the tool reverses a newest-first list.
  const base = Number(arg('base', String(Date.now() - plan.pages.length * 1000)));
  let n = 0;
  for (const page of plan.pages) {
    const s = state.pages[page.n];
    if (!s?.pageUrl) { console.log(`page ${page.n}: not drawn, skipped`); continue; }
    if (s.creationId) { console.log(`page ${page.n}: already filed (${s.creationId})`); continue; }
    const ref = await col.add({
      type: 'storybook',
      url: s.pageUrl,
      prompt: page.words,
      stickers: null,
      createdAt: admin.firestore.Timestamp.fromMillis(base + page.n * 1000),
      source: 'claude',
      model: MODEL,
      quality: QUALITY,
      style: 'sage-sandy-mirror',
      book: 'Eyes as Wide as a Fishbowl',
      page: page.n,
    });
    s.creationId = ref.id;
    saveState();
    n++;
  }
  console.log(`filed ${n} pages into users/${uid}/creations as type "storybook"`);
}

(has('post-only') ? post() : main())
  .then(() => process.exit(0))
  .catch((e) => { console.error(e.stack || e.message); process.exit(1); });
