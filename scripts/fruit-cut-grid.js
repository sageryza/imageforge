// fruit-cut-grid.js — cut a 3x3 fruit sheet into nine card images.
//
//   node scripts/fruit-cut-grid.js <sheet.webp> <names.json> <outdir>
//
// names.json is nine entries in READING ORDER (left→right, top→bottom):
//   [{ "id": "28-cherimoya", "name": "Cherimoya" }, …]
//
// The sheet is cut into nine equal thirds, then each cell is TRIMMED to its
// drawing and re-padded square on the same white. Equal thirds alone leave
// each fruit sitting wherever the model happened to place it in its cell, so
// a deck of them jitters card to card; trimming and re-centring makes them
// sit like the individually-drawn ones. The trim is on a white threshold, so
// the paper texture around a drawing survives it.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const [sheet, namesFile, outdir] = process.argv.slice(2);
if (!sheet || !namesFile || !outdir) {
  console.error('usage: fruit-cut-grid.js <sheet.webp> <names.json> <outdir>');
  process.exit(1);
}
const names = JSON.parse(fs.readFileSync(namesFile, 'utf8'));
if (names.length !== 9) { console.error('names.json must hold exactly 9 entries'); process.exit(1); }
fs.mkdirSync(outdir, { recursive: true });

(async () => {
  const meta = await sharp(sheet).metadata();
  const cw = Math.floor(meta.width / 3), ch = Math.floor(meta.height / 3);
  const out = [];

  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 3), col = i % 3;
    const cell = await sharp(sheet)
      .extract({ left: col * cw, top: row * ch, width: cw, height: ch })
      .toBuffer();

    // Trim the cell's white margin, then re-pad to a square with a small
    // even border so every card frames its fruit the same way.
    const trimmed = await sharp(cell).trim({ threshold: 12 }).toBuffer();
    const tm = await sharp(trimmed).metadata();
    const side = Math.max(tm.width, tm.height);
    const pad = Math.round(side * 0.10);
    const box = side + pad * 2;

    const dest = path.join(outdir, names[i].id + '.webp');
    await sharp({
      create: { width: box, height: box, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .composite([{ input: trimmed, left: Math.round((box - tm.width) / 2), top: Math.round((box - tm.height) / 2) }])
      .webp({ quality: 92 })
      .toFile(dest);

    out.push({ ...names[i], file: dest, cell: `${cw}x${ch}`, box });
    console.log(`  ${names[i].name.padEnd(14)} ${box}x${box}  ${dest}`);
  }

  fs.writeFileSync(path.join(outdir, 'cells.json'), JSON.stringify(out, null, 1));
  console.log(`\n9 cells → ${outdir}`);
})().catch(e => { console.error(e); process.exit(1); });
