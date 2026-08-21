#!/usr/bin/env node
/**
 * gen-panels.js — draw the witchcraft-reel stills as 2x2 PANEL SHEETS.
 *
 * Sophie's ask (2026-08-21): don't draw 47 separate pictures — group them four
 * to a sheet, "panel one: <the exact image prompt they came up with>, panel
 * two: …", at LOW quality on gpt-image-2. That is the house panel trick
 * (`movies.js` renderSketchGrid, `scripts/nde-split-panels.py`): one 1024x1536
 * low render draws four 2:3 portrait scenes, sliced into 512x768 panels, so a
 * ~0.5c sheet is ~0.125c a panel and every panel comes out in the reel aspect.
 *
 * THE SCRIPTS AND THE PROMPTS ARE NOT THIS SCRIPT'S — they are the
 * `witchcraft-reels-scripts` chat's, verbatim from
 * docs/witchcraft-reels/scripts-and-image-prompts.md. `stills.json` is that
 * doc's 47 stills copied character for character. Nothing here rewords one.
 *
 * THE ONE DELIBERATE CHANGE TO THEIR STYLE BLOCK, and it is unavoidable: their
 * suffix ends "Render as a single full-bleed illustration, no borders, no
 * panels" — which is the exact opposite of a 2x2 sheet. Same collision
 * `scripts/style-triptych-sheet.js` hit; same resolution: for a SHEET run that
 * clause is replaced by the grid instruction, and the no-text ban is kept
 * whole. Their prefix, their palette line and their character line are sent
 * word for word.
 *
 *   node scripts/witch-reels/gen-panels.js [--sheets 1,2] [--quality low] [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');
const admin = require('firebase-admin');

const HERE = __dirname;
const STILLS = JSON.parse(fs.readFileSync(path.join(HERE, 'stills.json'), 'utf8'));
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'witchcraft-reels-panels';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const DRY = argv.includes('--dry-run');
const QUALITY = flag('quality', 'low');
const SIZE = '1024x1536';
const MODEL = 'gpt-image-2';
const ONLY = (flag('sheets', '') || '').split(',').filter(Boolean).map(Number);

// ─── Their style block, verbatim ────────────────────────────────────
const PREFIX =
  'Hand-drawn dark storybook illustration in ink and gouache, deep plum and ' +
  'ink palette warmed by generous golden candlelight and a soft ambient fill ' +
  'so every detail stays readable in the shadows, gentle chiaroscuro. ' +
  'Vertical composition with breathing room at the top and bottom of the frame.';

const CHARACTER =
  'The witch is a woman in her late twenties with dark shoulder-length wavy ' +
  'hair and bangs, wearing an olive-green cardigan over a black dress and a ' +
  'small silver crescent-moon pendant — the same character, same face, same ' +
  'outfit in every scene.';

// The grid instruction, in the house wording: emphatic about the gutters,
// because a sheet whose drawings touch cannot be sliced.
const GRID =
  'Draw a 2x2 grid of four EQUAL rectangular panels that exactly quarter the ' +
  'image, separated by thin clean gutters. Each panel is its own completely ' +
  'separate illustration, sitting well inside its own quarter, nothing ' +
  'crossing or touching between the cells.';

const NOTEXT = 'No text, no lettering, no captions, no numbers anywhere in the image.';

const POSITIONS = ['top left', 'top right', 'bottom left', 'bottom right'];

/** Sheets of four, in the doc's own order. 47 stills → 11 full + one of 3. */
function buildSheets() {
  const out = [];
  for (let i = 0; i < STILLS.length; i += 4) {
    const cells = STILLS.slice(i, i + 4);
    out.push({ n: out.length + 1, id: `sheet-${String(out.length + 1).padStart(2, '0')}`, cells });
  }
  return out;
}

/** The literal text sent to the model, and the style half filed against it. */
function promptFor(sheet) {
  const body = sheet.cells
    .map((c, i) => `Panel ${i + 1} (${POSITIONS[i]}): ${c.content}`).join(' ');
  // A short sheet still asks for a 2x2 so the geometry — and therefore the
  // slice — stays identical; the spare quarter is asked for empty and dropped.
  const spare = sheet.cells.length < 4
    ? ` Panel 4 (${POSITIONS[3]}): empty — plain dark background, nothing drawn in this quarter.`
    : '';
  const character = sheet.cells.some(c => c.character) ? ' ' + CHARACTER : '';
  const prompt = `${PREFIX} ${GRID} ${body}${spare}${character} ${NOTEXT}`;
  const style = `${PREFIX} ${GRID} [content — this cell is the {position} quarter of a 2x2 sheet]` +
    `${character} ${NOTEXT}\n\n[${MODEL} · ${SIZE} · quality ${QUALITY} · no reference images attached; ` +
    `the panel is cropped out of the sheet at 512x768]`;
  return { prompt, style };
}

// ─── OpenAI ─────────────────────────────────────────────────────────
async function draw(prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL, prompt, size: SIZE, quality: QUALITY,
      output_format: 'webp', n: 1,
    }),
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error.message);
  return Buffer.from(d.data[0].b64_json, 'base64');
}

// ─── Storage (deckfactory — the chat feed's own project) ────────────
let bucket = null;
function initFirebase() {
  if (admin.apps.length) return;
  const creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(creds),
    storageBucket: `${creds.project_id}.firebasestorage.app`,
  });
  bucket = admin.storage().bucket();
}
async function upload(buf, name) {
  const file = bucket.file(`witch-reels/${name}`);
  await file.save(buf, {
    metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
  });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/witch-reels/${name}`;
}

/**
 * Cut the sheet into its four panels — ON THE GUTTERS THE MODEL ACTUALLY DREW,
 * not on the geometric halves.
 *
 * THIS IS THE WHOLE BUG THE FIRST TEST SHEET FOUND. gpt-image-2 does not
 * quarter the canvas exactly: on sheet 1 the horizontal gutter landed at
 * y≈723 of 1536, so a cut at 768 left a 45px band of the BOTTOM panel along
 * the bottom of each top panel — a sliver of a different scene inside a
 * finished still. A fixed inset cannot fix that; only measuring can.
 *
 * The measure: a gutter row/column is one where the BRIGHTEST pixel across the
 * whole span is still dark (max < 70). Mean brightness does not work — these
 * are night scenes, and a row of dim artwork averages as dark as a real
 * gutter. Falls back to the geometric halves if a sheet's gutter can't be
 * found (a pale background would have no dark band at all).
 */
async function cellBoxes(buf) {
  const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const DARK = 70;

  const darkRuns = (n, maxAt) => {
    const runs = [];
    let start = null;
    for (let i = 0; i < n; i++) {
      const isDark = maxAt(i) < DARK;
      if (isDark && start === null) start = i;
      if (!isDark && start !== null) { runs.push([start, i - 1]); start = null; }
    }
    if (start !== null) runs.push([start, n - 1]);
    return runs;
  };
  const rowMax = y => { let m = 0; for (let x = 0; x < W; x++) if (data[y * W + x] > m) m = data[y * W + x]; return m; };
  const colMax = x => { let m = 0; for (let y = 0; y < H; y++) if (data[y * W + x] > m) m = data[y * W + x]; return m; };

  // Split one axis: the outer margin at each end, and the middle gutter —
  // the dark band whose centre lands nearest the middle, within 15% of it.
  const axis = (n, runs) => {
    const lead = runs.find(r => r[0] === 0);
    const tail = runs.find(r => r[1] === n - 1);
    const lo = lead ? lead[1] + 1 : 0;
    const hi = tail ? tail[0] - 1 : n - 1;
    const mid = runs
      .filter(r => r !== lead && r !== tail)
      .map(r => ({ r, d: Math.abs((r[0] + r[1]) / 2 - n / 2) }))
      .filter(o => o.d < n * 0.15)
      .sort((a, b) => a.d - b.d)[0];
    return mid
      ? [[lo, mid.r[0] - 1], [mid.r[1] + 1, hi]]
      : [[lo, Math.floor(n / 2) - 1], [Math.floor(n / 2), hi]];
  };

  const cols = axis(W, darkRuns(W, colMax));
  const rows = axis(H, darkRuns(H, rowMax));
  const boxes = [];
  for (const [y0, y1] of rows) {
    for (const [x0, x1] of cols) {
      boxes.push({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 });
    }
  }
  return boxes;
}

async function slice(buf) {
  const boxes = await cellBoxes(buf);
  const out = [];
  for (const box of boxes) {
    out.push(await sharp(buf).extract(box).webp({ quality: 92 }).toBuffer());
  }
  return out;
}

// ─── Filing ─────────────────────────────────────────────────────────
async function post(route, body) {
  const res = await fetch(`${BASE}${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return { error: txt.slice(0, 200) }; }
}

async function main() {
  const sheets = buildSheets().filter(s => !ONLY.length || ONLY.includes(s.n));
  const cost = (sheets.length * (QUALITY === 'low' ? 0.005 : QUALITY === 'medium' ? 0.041 : 0.165));
  console.log(`${sheets.length} sheets · ${MODEL} · ${SIZE} · 2x2 · quality=${QUALITY} · ~$${cost.toFixed(3)}\n`);

  if (DRY) {
    for (const s of sheets) {
      console.log(`── ${s.id} (${s.cells.length} panels: ${s.cells.map(c => c.id).join(', ')})`);
      console.log(promptFor(s).prompt + '\n');
    }
    return;
  }

  initFirebase();
  const outDir = flag('out', path.join(os.tmpdir(), 'witch-reel-panels'));
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = [];

  for (const sheet of sheets) {
    const { prompt, style } = promptFor(sheet);
    process.stdout.write(`${sheet.id} (${sheet.cells.map(c => c.id).join(', ')}) … `);
    let buf;
    try { buf = await draw(prompt); }
    catch (e) { console.log(`ERR ${String(e.message).slice(0, 160)}`); continue; }
    const madeAt = Date.now();
    fs.writeFileSync(path.join(outDir, `${sheet.id}.webp`), buf);

    const sheetUrl = await upload(buf, `${sheet.id}-${madeAt}.webp`);
    const panels = await slice(buf);
    const rec = { sheet: sheet.id, sheetUrl, madeAt, prompt, panels: [] };

    // The full sheet, labeled — an unlabeled source sheet behind labeled
    // cut-outs still files itself, and a nameless tile is the thing to avoid.
    await post('/api/gallery', {
      assetsOnly: true, chat: CHAT, url: sheetUrl,
      description: `Sheet ${sheet.n} — the full 2x2 (${sheet.cells.map(c => c.id).join(', ')})`,
      prompt: `${MODEL} · ${QUALITY}`,
    });
    await post('/api/gallery/assets/prompt', {
      chat: CHAT, url: sheetUrl, style: `${PREFIX} ${GRID}\n\n[${MODEL} · ${SIZE} · quality ${QUALITY}]`,
      content: prompt,
    });

    for (let i = 0; i < sheet.cells.length; i++) {
      const c = sheet.cells[i];
      const url = await upload(panels[i], `${c.id}-${madeAt}.webp`);
      const description = `${c.reelTitle} — ${c.label} (${c.id})`;
      await post('/api/gallery', {
        assetsOnly: true, chat: CHAT, url, description, prompt: `${MODEL} · ${QUALITY}`,
      });
      await post('/api/gallery/assets/prompt', {
        chat: CHAT, url,
        style: style.replace('{position}', POSITIONS[i]),
        content: c.content,
      });
      fs.writeFileSync(path.join(outDir, `${c.id}.webp`), panels[i]);
      rec.panels.push({ id: c.id, url, description, content: c.content, reel: c.reel, madeAt });
    }
    manifest.push(rec);
    console.log(`OK ${Math.round(buf.length / 1024)}KB → ${sheet.cells.length} panels`);
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  }
  console.log(`\n${manifest.length} sheets · ${manifest.reduce((n, m) => n + m.panels.length, 0)} panels → ${outDir}`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
