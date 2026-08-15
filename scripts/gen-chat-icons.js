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

/** One sheet: draw (or re-cut), then hand each cell to its chat. */
async function runSheet(n, cells, recut) {
  const name = `chat-icons-s${n}`;
  const banked = ledger()[String(n)];
  // The cell ids are POSITIONAL, never the chat name: the route slugifies an
  // id, and a chat called "Voice Memos" would collide with a slug that is
  // already "voice-memos". Items come back in order, so position is the map.
  const body = {
    name,
    quality: QUALITY,
    cells: cells.map((c, i) => ({ id: `c${String(i + 1).padStart(2, '0')}`, draw: c.draw })),
  };
  if (recut) {
    if (!banked || !banked.sheet) throw new Error(`sheet ${n} has never been drawn — nothing to re-cut`);
    body.sheet = banked.sheet;
  }
  const job = await post('/api/vector/sheet', body);
  console.log(`sheet ${n}: ${job.id} (${job.cost === 0 ? 'free re-cut' : '$' + job.cost})`);

  let doc = null;
  for (let i = 0; i < 400; i++) {
    await sleep(3000);
    const r = await fetch(`${BASE}/api/vector/job/${job.id}`, { headers: headers() });
    doc = await r.json();
    if (doc.status === 'done') break;
    if (doc.status === 'failed') throw new Error(`sheet ${n} failed: ${doc.error}`);
    if (i % 5 === 0) process.stdout.write(`  ${doc.step || doc.status}\n`);
  }
  if (!doc || doc.status !== 'done') throw new Error(`sheet ${n} never finished`);
  bank(n, { sheet: doc.sheet, job: doc.id, at: new Date().toISOString(), chats: cells.map((c) => c.chat) });

  const items = doc.items || [];
  for (let i = 0; i < cells.length; i++) {
    const it = items[i];
    if (!it || !it.cut) { console.log(`  ! ${cells[i].chat}: no cut came back`); continue; }
    const buf = Buffer.from(await (await fetch(it.cut)).arrayBuffer());
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
