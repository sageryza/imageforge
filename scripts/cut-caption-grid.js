#!/usr/bin/env node
// Cut a REGULAR panel sheet into cells that each keep their CAPTION BOX.
//
//   node scripts/cut-caption-grid.js <sheet.(jpg|png|webp)> <outDir> [--pad 6]
//
// The sheet this is for: a printed-looking grid where every cell is TWO ruled
// boxes stacked — the picture, then a thin box under it holding the caption in
// hand lettering ("UP ALL NIGHT AGAIN"). The caption is the panel's whole
// point, so a cut that keeps only the picture throws the writing away.
//
// Not `cutSheet` in server.js: that one knows the grid it asked gpt-image-2 for
// and slices by arithmetic. Not `scripts/cut-panel-grid.js` either: that one is
// for hand-ruled sheets with SLANTED rows and uneven panels, and it finds the
// picture's own border, which is exactly the box that excludes the caption.
//
// (A sibling cutter was written the same night in the `tinder-compare-sheet`
// chat for its dream-factory sheets — "ink-band detection so each panel keeps
// its caption box". It was not on main when this was written, so this is a
// second implementation rather than a reuse. If both land, MERGE them; do not
// leave the repo with three cutters that disagree about where a panel stops.)
//
// ── How it finds a cell ────────────────────────────────────────────────────
//
// Two projections and one rule about height.
//
//   1. COLUMNS over the whole page. Dark pixels per column; a column of cells
//      is dense (>=8% of the height) and the cream gutter between two of them
//      is not. Three runs on a 3-wide sheet, and nothing here assumes three.
//   2. ROW BANDS over the whole page, the same way. A cell does NOT come out as
//      one band: the picture is one, the caption box's lettering is a second,
//      and the caption box's bottom rule is a thin third, because the box's
//      SIDE borders are two pixels wide and never reach the 8% bar. Measured on
//      her sheet: 44-425 (picture), 436-462 (caption), 474-483 (bottom rule).
//   3. THE TALL BAND IS THE PICTURE. A cell starts at each band taller than
//      12% of the page and runs to the end of the last band before the next
//      tall one. That is what glues a caption to the picture it belongs to,
//      and it needs no gap threshold — which matters, because on her sheet the
//      gap INSIDE a cell (11px) and the gap BETWEEN cells (17px) are close
//      enough that any threshold between them is luck rather than a rule.
//
// The cut is a lossless `extract` of the original bytes, written as PNG: a
// derived DISPLAY copy may be small, a cut of her own picture may not be
// (the house rule — nothing stands between the source and the output).

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DARK = 170;      // her ink runs light in places; 128 loses thin rules
const AXIS_FRAC = 0.08; // a band/column is "on" at 8% of the crossing extent
const TALL_FRAC = 0.12; // a band this tall is a PICTURE, not a caption

function runs(counts, extent, frac) {
  const out = [];
  let start = -1;
  for (let i = 0; i < counts.length; i++) {
    const on = counts[i] >= frac * extent;
    if (on && start < 0) start = i;
    if (!on && start >= 0) { out.push([start, i - 1]); start = -1; }
  }
  if (start >= 0) out.push([start, counts.length - 1]);
  return out;
}

// Bands -> cells: each tall band opens a cell, everything after it up to the
// next tall band rides along (that is the caption and its bottom rule).
function cells(bands, tallMin) {
  const out = [];
  for (const b of bands) {
    const tall = b[1] - b[0] + 1 >= tallMin;
    if (tall) out.push([b[0], b[1]]);
    else if (out.length) out[out.length - 1][1] = b[1];
  }
  return out;
}

async function cut(file, outDir, pad = 6) {
  const img = sharp(file);
  const { data, info } = await img.clone().greyscale().raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const colCounts = new Array(W).fill(0);
  const rowCounts = new Array(H).fill(0);
  for (let y = 0; y < H; y++) {
    const off = y * W;
    for (let x = 0; x < W; x++) {
      if (data[off + x] < DARK) { colCounts[x]++; rowCounts[y]++; }
    }
  }
  const cols = runs(colCounts, H, AXIS_FRAC);
  const rows = cells(runs(rowCounts, W, AXIS_FRAC), Math.round(H * TALL_FRAC));

  fs.mkdirSync(outDir, { recursive: true });
  const base = path.basename(file).replace(/\.[^.]+$/, '');
  const made = [];
  let n = 0;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      const left = Math.max(0, cols[c][0] - pad);
      const top = Math.max(0, rows[r][0] - pad);
      const width = Math.min(W - left, cols[c][1] - cols[c][0] + 1 + pad * 2);
      const height = Math.min(H - top, rows[r][1] - rows[r][0] + 1 + pad * 2);
      n++;
      const out = path.join(outDir, `${base}-p${String(n).padStart(2, '0')}.png`);
      await sharp(file).extract({ left, top, width, height }).png().toFile(out);
      made.push({ n, row: r + 1, col: c + 1, box: { left, top, width, height }, file: out });
    }
  }
  return { sheet: file, size: `${W}x${H}`, cols: cols.length, rows: rows.length, panels: made };
}

if (require.main === module) {
  const args = process.argv.slice(2).filter(a => a !== '--');
  const padIx = args.indexOf('--pad');
  const pad = padIx >= 0 ? Number(args[padIx + 1]) : 6;
  const rest = padIx >= 0
    ? args.filter((a, i) => i !== padIx && i !== padIx + 1)
    : args;
  const [file, outDir] = rest;
  if (!file || !outDir) {
    console.error('usage: cut-caption-grid.js <sheet> <outDir> [--pad 6]');
    process.exit(1);
  }
  cut(file, outDir, pad)
    .then(r => console.log(JSON.stringify(r, null, 1)))
    .catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { cut, runs, cells };
