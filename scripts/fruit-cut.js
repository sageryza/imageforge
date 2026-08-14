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

(async () => {
  const meta = await sharp(sheet).metadata();
  const cw = Math.floor(meta.width / COLS), ch = Math.floor(meta.height / ROWS);
  const out = [];

  for (let i = 0; i < names.length; i++) {
    const row = Math.floor(i / COLS), col = i % COLS;
    const cell = await sharp(sheet)
      .extract({ left: col * cw, top: row * ch, width: cw, height: ch })
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
