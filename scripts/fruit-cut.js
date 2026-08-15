// fruit-cut.js — cut a multi-up sheet into square card images.
//
//   node scripts/fruit-cut.js <sheet> <names.json> <outdir> [--cols 2] [--rows 1]
//
// names.json is one entry per cell in READING ORDER (left→right, top→bottom):
//   [{ "id": "39-asparagus", "name": "Asparagus" }, …]
//
// Generalises fruit-cut-grid.js (which was 3x3 only) so the two-up LANDSCAPE
// sheet works: 1536x1024 split into two 768x1024 cells is the largest per-cell
// pixel budget any multi-up layout can give, because gpt-image-2's biggest
// canvas is 1536 on the long edge. Two-up lands at ~92% of what a phone card
// can show, against ~35% for a 3x3 — which is why the 3x3 read soft.
//
// EVERY CARD COMES OUT SQUARE (Sophie's ask), and squareness is why the cells
// are trimmed rather than just divided: a 768x1024 cell padded straight to a
// square would carry whatever off-centre white the model left, so each card
// would frame its subject differently.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? Number(args[i + 1]) : d; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const [sheet, namesFile, outdir] = positional;
const COLS = flag('cols', 2), ROWS = flag('rows', 1);

if (!sheet || !namesFile || !outdir) {
  console.error('usage: fruit-cut.js <sheet> <names.json> <outdir> [--cols N] [--rows N]');
  process.exit(1);
}
const names = JSON.parse(fs.readFileSync(namesFile, 'utf8'));
if (names.length !== COLS * ROWS) {
  console.error(`names.json holds ${names.length} entries but the layout is ${COLS}x${ROWS}`);
  process.exit(1);
}
fs.mkdirSync(outdir, { recursive: true });

// CUT AT THE GUTTER, NOT AT THE MIDPOINT.
//
// Dividing the sheet into equal parts assumes the model centred the gap, and it
// does not. Measured on the vegetable pairs: the exact midpoint of the
// asparagus/broccoli sheet had 70 pixels of ink running through it — the cut
// went straight through the broccoli, so a fragment of it landed in the
// asparagus card AND pushed the asparagus off-centre, because the trim box then
// grew to include the stray. The real gap was 64px wide, 90px to the left.
// Sophie caught both symptoms ("a little bit of the other fruit cutting into
// it", "some of them weren't centered") and offered to fix it by hand; this is
// the same fix done by measurement.
//
// Returns the cut positions along one axis: the centre of the widest run of
// entirely blank lines near each ideal boundary, or the ideal boundary itself
// when no blank run exists (touching drawings — nothing can separate those, and
// an even cut is the honest fallback).
function cuts(profile, n, span) {
  const out = [];
  for (let k = 1; k < n; k++) {
    const ideal = Math.round((span * k) / n);
    const lo = Math.max(0, ideal - Math.round(span / (n * 2)));
    const hi = Math.min(span - 1, ideal + Math.round(span / (n * 2)));
    let best = { len: 0, at: -1 }, run = 0;
    for (let x = lo; x <= hi; x++) {
      if (profile[x] === 0) { run++; if (run > best.len) best = { len: run, at: x - run + 1 }; }
      else run = 0;
    }
    out.push(best.len ? best.at + Math.floor(best.len / 2) : ideal);
  }
  return [0, ...out, span];
}

(async () => {
  const meta = await sharp(sheet).metadata();
  // Ink profiles along each axis: a line counts as blank only if NOTHING on it
  // is darker than near-white, so a stray pen flick still blocks a gutter.
  const { data, info } = await sharp(sheet).greyscale().raw().toBuffer({ resolveWithObject: true });
  const colInk = new Array(info.width).fill(0);
  const rowInk = new Array(info.height).fill(0);
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[y * info.width + x] < 235) { colInk[x]++; rowInk[y]++; }
    }
  }
  const xs = cuts(colInk, COLS, info.width);
  const ys = cuts(rowInk, ROWS, info.height);
  if (COLS > 1) console.log(`  cuts at x: ${xs.slice(1, -1).join(', ')} (even would be ${
    Array.from({ length: COLS - 1 }, (_, k) => Math.round(info.width * (k + 1) / COLS)).join(', ')})`);
  const out = [];

  for (let i = 0; i < names.length; i++) {
    const row = Math.floor(i / COLS), col = i % COLS;
    const cell = await sharp(sheet)
      .extract({ left: xs[col], top: ys[row], width: xs[col + 1] - xs[col], height: ys[row + 1] - ys[row] })
      .toBuffer();

    const trimmed = await sharp(cell).trim({ threshold: 12 }).toBuffer();
    const tm = await sharp(trimmed).metadata();
    const side = Math.max(tm.width, tm.height);
    const pad = Math.round(side * 0.10);
    const box = side + pad * 2;

    const dest = path.join(outdir, names[i].id + '.webp');
    await sharp({ create: { width: box, height: box, channels: 3, background: { r: 255, g: 255, b: 255 } } })
      .composite([{ input: trimmed, left: Math.round((box - tm.width) / 2), top: Math.round((box - tm.height) / 2) }])
      .webp({ quality: 92 })
      .toFile(dest);

    out.push({ ...names[i], file: dest, box });
    console.log(`  ${names[i].name.padEnd(18)} ${box}x${box}`);
  }

  // Named after the SHEET, not just "cells.json" — cutting several sheets into
  // one outdir (the fourteen vegetable pairs) had each run overwrite the last,
  // so the manifest ended up describing only the final two cards while all 28
  // images sat there correctly. The images were never the problem; the record
  // of them was.
  const stem = path.basename(sheet).replace(/\.[^.]+$/, '');
  fs.writeFileSync(path.join(outdir, stem + '-cells.json'), JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
