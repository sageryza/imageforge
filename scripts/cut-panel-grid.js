#!/usr/bin/env node
// Cut a scanned/drawn PANEL SHEET into its individual panels.
//
// Not the Playground's `cutSheet`: that one knows the grid it asked for and
// slices by arithmetic. This is for a sheet NOBODY laid out for us — a comic
// page, a contact sheet, a scan of hand-drawn strips — where the panels are
// hand-ruled, unevenly wide, and a row may hold a different number of panels
// than the row above it. On the sheet this was built for, the rows are also
// SLANTED (row 4's panels start at y=609 on the left and y=623 on the right)
// and the panels get shorter down the page, so nothing here may assume one
// top edge per row, one width, or one height.
//
//   node scripts/cut-panel-grid.js <sheet.png> [outDir] [--pad 2]
//
// Prints one JSON object per panel (row, col, box, file). Lossless: every
// panel is an `extract` of the original bytes (the house rule — a derived
// display copy may be small, a cut of her original may not be lossy).
//
// ── How it finds a panel, and the wrong way that shipped first ──────────────
//
// The first version took CONNECTED COMPONENTS of the dark pixels, on the
// theory that a panel's border is a closed rectangle and any drawing touching
// it joins the same blob, so one blob's bounding box IS the panel. It counted
// 69 of 69 panels and was still WRONG, in the way that matters: where the ink
// of a border is broken — and hand-drawn ink is broken constantly — the blob
// is only PART of the panel, so the box came in tight and the crop sliced
// through the drawing. Sophie's word for the result was "cut wrong". A count
// that comes out right is not the same as boxes that come out right; check
// the crops, not the tally.
//
// What works is projections, in three passes, each one narrowing the last:
//
//   1. ROWS. Count dark pixels per scanline over the whole width. A row of
//      panels is dense (>15% of the width); the titles between them are not.
//      That gives a rough band per row of panels.
//   2. COLUMNS, inside one band. Count dark pixels per column. Between two
//      panels the count falls to ZERO — the gap is white all the way down the
//      band — so the panels are simply the non-zero runs wider than 60px.
//      This is why it survives a broken border: a gap in the ink still leaves
//      the panel's own drawing in that column.
//   3. THE PANEL'S OWN TOP AND BOTTOM. Within its x-range, a border is a
//      near-solid line, so the first scanline covering >=55% of the panel's
//      width IS the top edge. Title text never reaches 55%. Done per panel,
//      which is what follows a slanted row.
//
// Pass 3 runs TWICE and that is load-bearing: a wide search window reaches
// into the row above (a title, or the previous row's bottom border) and finds
// a false edge tens of pixels out. So it searches tight first (+-18px of the
// band), takes the MEDIAN top and bottom of the row — robust to a panel or
// two missing an edge — and then searches each panel again within +-20px of
// that median. The row's own geometry becomes the window for its panels.
//
// The threshold is 200, not 128: the lighter passages of hand-drawn ink are
// well above mid-grey, and at 150 two panels in the test sheet lost their
// side borders and came out 30% narrow.

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const MIN_PANEL = 60;      // px — narrower than this is a stray mark, not a panel
const MIN_BAND = 60;       // px — shorter than this is a title line, not a row
const DARK = 200;          // grey level counted as ink
const BAND_DENSITY = 0.15; // share of the sheet's width that makes a row "dense"
const EDGE_COVER = 0.55;   // share of a panel's width that makes a scanline its border
const ROUGH = 18;          // px — pass-1 search either side of the band
const FINE = 20;           // px — pass-2 search either side of the row's median edge

const median = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function panelBoxes(src, { pad = 2 } = {}) {
  const { data, info } = await sharp(src).greyscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const ink = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) ink[i] = data[i] < DARK ? 1 : 0;

  // 1. Rows of panels: the dense scanlines.
  const bands = [];
  let start = -1;
  for (let y = 0; y <= H; y++) {
    let dense = 0;
    if (y < H) { let c = 0; for (let x = 0; x < W; x++) c += ink[y * W + x]; dense = c > W * BAND_DENSITY ? 1 : 0; }
    if (dense && start < 0) start = y;
    else if (!dense && start >= 0) { if (y - start > MIN_BAND) bands.push([start, y - 1]); start = -1; }
  }

  const panels = [];
  bands.forEach(([a, b], bi) => {
    // 2. Panels within the band: the non-zero column runs.
    const runs = [];
    let t = -1;
    for (let x = 0; x <= W; x++) {
      let on = 0;
      if (x < W) { for (let y = a; y <= b && !on; y++) if (ink[y * W + x]) on = 1; }
      if (on && t < 0) t = x;
      else if (!on && t >= 0) { if (x - t >= MIN_PANEL) runs.push([t, x - 1]); t = -1; }
    }

    // 3. Each panel's own top and bottom border.
    const cover = (y, x0, x1) => { let c = 0; for (let x = x0; x <= x1; x++) c += ink[y * W + x]; return c; };
    const edge = (x0, x1, lo, hi, downward) => {
      const need = Math.round((x1 - x0 + 1) * EDGE_COVER);
      lo = Math.max(0, lo); hi = Math.min(H - 1, hi);
      if (downward) { for (let y = lo; y <= hi; y++) if (cover(y, x0, x1) >= need) return y; }
      else { for (let y = hi; y >= lo; y--) if (cover(y, x0, x1) >= need) return y; }
      return null;
    };

    const tops = [], bots = [];
    runs.forEach(([x0, x1]) => {
      const t0 = edge(x0, x1, a - ROUGH, a + ROUGH, true); if (t0 !== null) tops.push(t0);
      const b0 = edge(x0, x1, b - ROUGH, b + ROUGH, false); if (b0 !== null) bots.push(b0);
    });
    const mt = tops.length ? median(tops) : a;
    const mb = bots.length ? median(bots) : b;

    runs.forEach(([x0, x1], ci) => {
      const top = edge(x0, x1, mt - FINE, mt + FINE, true) ?? mt;
      const bot = edge(x0, x1, mb - FINE, mb + FINE, false) ?? mb;
      const left = Math.max(0, x0 - pad), y = Math.max(0, top - pad);
      panels.push({
        row: bi + 1, col: ci + 1,
        left, top: y,
        width: Math.min(W - left, x1 - x0 + 1 + pad * 2),
        height: Math.min(H - y, bot - top + 1 + pad * 2),
      });
    });
  });
  return { width: W, height: H, rows: bands.map((_, i) => panels.filter(p => p.row === i + 1).length), panels };
}

async function main() {
  const args = process.argv.slice(2);
  const src = args[0];
  if (!src) { console.error('usage: cut-panel-grid.js <sheet.png> [outDir] [--pad N]'); process.exit(1); }
  const outDir = args[1] && !args[1].startsWith('--') ? args[1] : 'panels';
  const pi = args.indexOf('--pad');
  const { rows, panels } = await panelBoxes(src, { pad: pi < 0 ? undefined : Number(args[pi + 1]) });
  fs.mkdirSync(outDir, { recursive: true });
  for (const p of panels) {
    p.file = path.join(outDir, `r${p.row}c${p.col}.png`);
    await sharp(src).extract({ left: p.left, top: p.top, width: p.width, height: p.height })
      .png({ compressionLevel: 9 }).toFile(p.file);
  }
  console.error(`${panels.length} panels · rows ${rows.join(',')}`);
  console.log(JSON.stringify(panels, null, 1));
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { panelBoxes };
