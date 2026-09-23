// pattern-seed.js — put the animals and fruits already drawn onto the Pattern
// tool's shelf (forge-pattern-pieces), cut out, from a container.
//
//   node scripts/pattern-seed.js [--dry] [--min 500] [--only bear,01-strawberry]
//   node scripts/pattern-seed.js --rough      give every piece on the list its
//                                            scissors cut (the ones without one)
//
// Reads the fruit chart's own records (scripts/fruit-chart/*-uploaded.json) and
// files every picture that has a FULL-SIZE copy: the 27 fruits, the animals,
// the redrawn and hq fruits. A picture only on file as a 278px card is skipped
// (`--min`), because a piece that small pixelates the moment it is bigger than
// a thumbnail on the tile. Runs pattern.js's own filePiece with the Admin SDK
// (FIREBASE_SERVICE_ACCOUNT, deckfactory-43176) so the cut-outs exist before
// the page is deployed. Re-running is safe: a piece is keyed by its source
// url and one already cut is left alone.
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const sharp = require('sharp');
const fetch = require('node-fetch');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const MIN = Number(flag('min', 500));
const ONLY = (flag('only', '') || '').split(',').filter(Boolean);
const ROOT = path.join(__dirname, '..');
const CHART = path.join(ROOT, 'scripts', 'fruit-chart');
const DECKS = path.join(ROOT, 'scripts');

// Which records, and what they are. `full` is preferred, `url` (the card) is
// the fallback and is what `--min` filters out.
// IN ORDER OF PREFERENCE: the first picture seen under a name wins, and a
// later twin is HIDDEN on the shelf rather than filed beside it. Her picked,
// finished fruit (decks/fruits-finished.json, 2026-09-22) lead the fruit; the
// animal deck (72 drawn animals) and the plant deck are the card-pattern
// chat's own lists.
const SOURCES = [
  { file: 'decks/animals-drawn.json', kind: 'animal' },
  { file: 'animals-uploaded.json', kind: 'animal' },
  { file: 'decks/fruits-finished.json', kind: 'fruit' },
  { file: 'uploaded.json', kind: 'fruit' },
  { file: 'hq3-uploaded.json', kind: 'fruit' },
  { file: 'redo-uploaded.json', kind: 'fruit' },
  { file: 'grid-2-uploaded.json', kind: 'fruit' },
  { file: 'v3-uploaded.json', kind: 'fruit' },
  { file: 'veg-v4-uploaded.json', kind: 'vegetable' },
  { file: 'decks/plants-drawn.json', kind: 'plant' },
  // New pieces drawn for a set by scripts/piece-draw.js; a record may carry its own kind.
  { file: 'decks/exotic-drawn.json', kind: 'other' },
];

async function head(url) {
  const r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
  return r.ok;
}
async function widthOf(url) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) return 0;
  const buf = Buffer.from(await r.arrayBuffer());
  try { return (await sharp(buf).metadata()).width || 0; } catch { return 0; }
}

async function roughAll() {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
  const { roughPiece } = require(path.join(ROOT, 'pattern.js'));
  const snap = await admin.firestore().collection('forge-pattern-pieces').get();
  const todo = [];
  snap.forEach((d) => { const p = d.data(); if (p.status === 'ready' && p.src && (!p.rough || args.includes('--force'))) todo.push({ id: d.id, ...p }); });
  console.log(`${todo.length} to cut roughly`);
  let n = 0, bad = 0;
  for (const p of todo) {
    const r = await roughPiece(p.id, p.src);
    if (r) { n++; console.log(`  ✓ ${p.name} ${r.rw}x${r.rh}`); } else { bad++; console.log(`  ✗ ${p.name}`); }
  }
  console.log(`rough-cut ${n}, failed ${bad}`);
}

(async () => {
  if (args.includes('--rough')) return roughAll();
  const rows = [];
  for (const s of SOURCES) {
    const j = JSON.parse(fs.readFileSync(path.join(s.file.startsWith('decks/') ? DECKS : CHART, s.file), 'utf8'));
    for (const r of (Array.isArray(j) ? j : Object.values(j))) {
      if (!r.id || !(r.full || r.url)) continue;
      if (ONLY.length && !ONLY.includes(r.id)) continue;
      let name = String(r.name || r.id).replace(/^\d+-/, '').replace(/-/g, ' ').toLowerCase();
      // The redraw batch holds two SHAPES of a thing — cut open, or a few of
      // them — which are different pictures and deserve their own names.
      if (/-cut\d$/.test(r.id)) name += ', cut open';
      else if (/-few\d$/.test(r.id)) name = 'a few ' + name;
      // …and it mixes vegetables in under the fruit chart; the url says which.
      const kind = r.kind || (/\/veg\//.test(r.full || r.url) ? 'vegetable' : s.kind);
      rows.push({ id: r.id, name, kind, full: r.full, card: r.url, from: s.file });
    }
  }
  console.log(`${rows.length} candidates`);
  const keep = [];
  for (const r of rows) {
    let src = r.full && r.full !== r.card && await head(r.full) ? r.full : r.card;
    const w = await widthOf(src);
    if (w < MIN) { console.log(`  skip ${r.id} — ${w}px (${r.from})`); continue; }
    keep.push({ ...r, src, w });
  }
  // ONE PIECE PER NAME, the FIRST source's picture of it (the order above is
  // the preference): the chart drew some fruits several times and a shelf with
  // two strawberries is a shelf she has to squint at.
  const byName = new Map();
  for (const r of keep) {
    const k = r.kind + ':' + r.name;
    if (!byName.has(k)) byName.set(k, r);
  }
  keep.length = 0; keep.push(...byName.values());
  console.log(`${keep.length} to file`);
  if (DRY) { keep.forEach((r) => console.log(`  ${r.kind} · ${r.name} · ${r.w}px · ${r.src}`)); return; }

  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
  const { filePiece } = require(path.join(ROOT, 'pattern.js'));
  let n = 0, dup = 0, bad = 0;
  for (const r of keep) {
    const out = await filePiece({ name: r.name, kind: r.kind, src: r.src });
    if (out.duplicate) { dup++; console.log(`  = ${r.name} (already cut)`); continue; }
    if (out.status !== 'ready') { bad++; console.log(`  ✗ ${r.name} — ${out.error}`); continue; }
    n++; console.log(`  ✓ ${r.name} ${out.w}x${out.h}`);
  }
  console.log(`filed ${n}, already there ${dup}, failed ${bad}`);
  // A twin already on the shelf under a name a preferred picture now holds is
  // hidden (never deleted — PATCH hidden:false brings it back).
  const crypto = require('crypto');
  const keptIds = new Set(keep.map((r) => crypto.createHash('sha1').update(r.src).digest('hex').slice(0, 20)));
  const keptNames = new Set(keep.map((r) => r.kind + ':' + r.name));
  const snap = await admin.firestore().collection('forge-pattern-pieces').get();
  let hid = 0;
  for (const d of snap.docs) {
    const p = d.data();
    if (p.drawn || keptIds.has(d.id) || p.hidden) continue;
    if (keptNames.has(p.kind + ':' + p.name)) { hid++; await d.ref.set({ hidden: true }, { merge: true }); console.log(`  – hid the older ${p.name}`); }
  }
  console.log(`hid ${hid} older twins`);
})().catch((e) => { console.error(e); process.exit(1); });
