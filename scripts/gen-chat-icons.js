#!/usr/bin/env node
/* Draw the little picture that sits beside a chat's name in the Chats app.
 *
 *   node scripts/gen-chat-icons.js --sheet 1          one sheet of 25  (~6c)
 *   node scripts/gen-chat-icons.js --all              every sheet
 *   node scripts/gen-chat-icons.js --sheet 1 --recut  free: re-cut the sheet
 *                                                     already on file
 *   node scripts/gen-chat-icons.js --list             what would be drawn
 *
 * WHY IT GOES THROUGH /api/vector INSTEAD OF CALLING gpt-image-2 ITSELF
 * The vector pipeline already does this exact job debugged — 25 descriptions
 * to ONE 5x5 sheet in the pastel house style, cut on the grid, each cell
 * lifted off its paper — and the 18 icons that already existed were drawn in
 * that same style (black ink outline, flat lilac/pink/mint, no gradients), so
 * a new one lands beside them looking like it belongs. See
 * docs/vector-pipeline.md. A sheet of 25 costs ~6c at medium, i.e. 0.24c an
 * icon; the trace and the cut are free.
 *
 * WHAT IS SAVED WHERE
 * Each sheet's url is written into scripts/chat-icons/sheets.json, because a
 * re-cut of a sheet already drawn costs NOTHING (`sheet` on POST /sheet). If
 * the cut-outs ever want re-doing — a different size, a white background
 * instead of transparent — that is free and must never re-bill the model.
 *
 * The finished cell is POSTed to /api/chatfeed/icon, which puts it in Storage
 * at chat-feed/icons/<chat>.png and writes `icon` on the chat's registry doc.
 * Re-running overwrites in place, so a chat that gets a better drawing later
 * keeps its one file.
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const TOKEN = process.env.STUDIO_TOKEN || '';
const DIR = path.join(__dirname, 'chat-icons');
const SUBJECTS = path.join(DIR, 'subjects.json');
const SHEETS = path.join(DIR, 'sheets.json');
const PER_SHEET = 25;              // the 5x5 the vector route tops out at
const QUALITY = process.env.ICON_QUALITY || 'medium';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i < 0 ? null : argv[i + 1]; };

function headers(extra) {
  return Object.assign({ 'content-type': 'application/json' }, TOKEN ? { 'x-studio-token': TOKEN } : {}, extra || {});
}
async function post(route, body) {
  const r = await fetch(BASE + route, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${route} ${r.status} ${j.error || ''}`);
  return j;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function load() {
  const subjects = JSON.parse(fs.readFileSync(SUBJECTS, 'utf8'));
  const sheets = [];
  for (let i = 0; i < subjects.length; i += PER_SHEET) sheets.push(subjects.slice(i, i + PER_SHEET));
  return { subjects, sheets };
}
function ledger() {
  try { return JSON.parse(fs.readFileSync(SHEETS, 'utf8')); } catch (e) { return {}; }
}
function bank(n, rec) {
  const all = ledger();
  all[String(n)] = rec;
  fs.writeFileSync(SHEETS, JSON.stringify(all, null, 2) + '\n');
}

// How many columns and rows the vector route lays a count out in. Same table as
// LAYOUT in vector.js — the sheet is cut on the grid it was drawn on, so the two
// have to agree; only the counts this script uses are listed.
const LAYOUT = { 1: [1, 1], 2: [2, 1], 3: [3, 1], 4: [2, 2], 25: [5, 5] };

/** Every cell of the sheet, each lifted off its paper, as small PNGs.
 *
 *  `slice` and `cutout` are the REPO'S OWN, imported from vectorize.js rather
 *  than re-written here — the same two the vector route calls, so a chat icon
 *  is cut exactly like a vector card. Both carry findings a fresh
 *  implementation would have to re-earn: `slice` cuts on the widest white
 *  GUTTER near each grid line rather than on the arithmetic line, and `cutout`
 *  floods in from the corners (the drawings have white INSIDE them — an eye, a
 *  page — so a global white threshold would punch holes through all of it) and
 *  then drops a small fragment that touches the border, which is what a
 *  neighbour bleeding across the cut looks like. A hand-rolled version of this
 *  was written first and shipped both bugs. */
async function cutCells(sheetBuf, cols, rows) {
  const sharp = require('sharp');
  const { slice, cutout } = require(path.join(__dirname, '..', 'vectorize'));
  const cells = await slice(sheetBuf, cols, rows);
  return Promise.all(cells.map(async (cell) => {
    let lifted = cell;
    try { lifted = await cutout(cell); } catch (e) { /* keep the raw cell */ }
    return sharp(lifted)
      .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
  }));
}

/** One sheet: draw (or re-cut), then hand each cell to its chat. */
async function runSheet(n, cells, recut) {
  const name = `chat-icons-s${n}`;
  const banked = ledger()[String(n)];
  // The cell ids are POSITIONAL, never the chat name: the route slugifies an
  // id, and a chat called "Voice Memos" would collide with a slug that is
  // already "voice-memos". Items come back in order, so position is the map.
  // `--ink <n>` pins the trace threshold instead of letting it probe. An icon
  // only ever needs the CUT — the SVG is a free side product here — and the
  // auto probe runs about three traces per cell, which is where sheet 2 hung:
  // a shelf of small repeated objects, stuck on one cell for half an hour with
  // the other 24 already done. A fixed threshold is one trace, so a re-cut
  // gets past it. `--fills <n>` caps the colour count for the same reason.
  const ink = val('--ink');
  const fills = val('--fills');
  const body = {
    name,
    quality: QUALITY,
    cells: cells.map((c, i) => Object.assign(
      { id: `c${String(i + 1).padStart(2, '0')}`, draw: c.draw },
      ink ? { ink: Number(ink) } : {},
      fills ? { fills: Number(fills) } : {},
    )),
  };
  if (recut) {
    if (!banked || !banked.sheet) throw new Error(`sheet ${n} has never been drawn — nothing to re-cut`);
    body.sheet = banked.sheet;
  }
  const job = await post('/api/vector/sheet', body);
  console.log(`sheet ${n}: ${job.id} (${job.cost === 0 ? 'free re-cut' : '$' + job.cost})`);

  // WAIT FOR THE SHEET, NOT FOR THE JOB. The route draws, uploads, then traces
  // every cell to SVG — and the TRACE is what hangs: sheet 2 stuck on a shelf
  // of cassette tapes and sheet 12 on a phone-and-fries, each with the other 24
  // cells already done, each for half an hour, and pinning `ink` did not stop
  // the second one. An icon never needed the SVG; it needs the CUT. So this
  // takes the sheet the moment it is uploaded and cuts it HERE, and the tracer
  // is off the critical path for good. (The job keeps tracing behind us and is
  // welcome to; nothing waits on it.)
  let sheetUrl = '';
  for (let i = 0; i < 200; i++) {
    await sleep(3000);
    const r = await fetch(`${BASE}/api/vector/job/${job.id}`, { headers: headers() });
    const doc = await r.json();
    if (doc.sheet) { sheetUrl = doc.sheet; break; }
    if (doc.status === 'failed') throw new Error(`sheet ${n} failed: ${doc.error}`);
    if (i % 5 === 0) process.stdout.write(`  ${doc.step || doc.status}\n`);
  }
  if (!sheetUrl) throw new Error(`sheet ${n}: no sheet came back`);
  bank(n, { sheet: sheetUrl, job: job.id, at: new Date().toISOString(), chats: cells.map((c) => c.chat) });

  const [cols, rows] = LAYOUT[cells.length] || [5, 5];
  const sheetBuf = Buffer.from(await (await fetch(sheetUrl)).arrayBuffer());
  const cuts = await cutCells(sheetBuf, cols, rows);
  for (let i = 0; i < cells.length; i++) {
    const buf = cuts[i];
    const out = await post('/api/chatfeed/icon', {
      chat: cells[i].chat,
      image: `data:image/png;base64,${buf.toString('base64')}`,
    });
    console.log(`  ${cells[i].chat} <- ${Math.round(buf.length / 1024)}KB ${out.ok ? 'ok' : 'FAILED'}`);
  }
}

(async () => {
  const { subjects, sheets } = load();
  if (has('--list')) {
    sheets.forEach((s, i) => {
      console.log(`\n--- sheet ${i + 1} (${s.length}) ---`);
      s.forEach((c) => console.log(`  ${c.chat.padEnd(42)} ${c.draw}`));
    });
    console.log(`\n${subjects.length} chats, ${sheets.length} sheets, ~$${(sheets.length * 0.06).toFixed(2)} at medium`);
    return;
  }
  const only = val('--sheet');
  const list = only ? [Number(only)] : sheets.map((_, i) => i + 1);
  if (!only && !has('--all')) { console.log('pass --sheet <n>, --all or --list'); return; }
  for (const n of list) {
    if (!sheets[n - 1]) { console.log(`no sheet ${n}`); continue; }
    await runSheet(n, sheets[n - 1], has('--recut'));
  }
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
