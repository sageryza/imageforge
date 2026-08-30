#!/usr/bin/env node
// Cut a scanned/drawn PANEL SHEET into its individual panels.
//
// Not the Playground's `cutSheet`: that one knows the grid it asked for and
// slices by arithmetic. This is for a sheet NOBODY laid out for us — a comic
// page, a contact sheet, a scan of hand-drawn strips — where the panels are
// hand-ruled, slightly wavy, unevenly spaced, and the row may hold a different
// number of panels than the row above it.
//
// The rule: a panel's border is a closed dark rectangle, and any drawing that
// touches it joins the same connected component — so ONE dark component's
// bounding box IS the panel, drawing or no drawing. Titles and the little
// "1./2./3." numbers are their own small components and fall out by size.
// Two components overlapping are one panel whose border broke into two pieces
// (hand-drawn ink does that) and are merged rather than cut twice.
//
// Deliberately NOT a projection/line detector: measured on a real sheet, a
// wavy hand-ruled border never produces a full-height dark run, so vertical
// line detection found ~60% of the borders while the component pass found
// 69 of 69.
//
//   node scripts/cut-panel-grid.js <sheet.png> [outDir] [--min 78] [--max 150]
//
// Prints one JSON line per panel (row, col, box, file) so a caller can label
// them. Lossless: every panel is an `extract` of the original bytes, never a
// re-encode of a resized copy (the house rule — a derived copy may be small,
// a cut of her original may not be lossy).

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function panelBoxes(src, { min = 78, max = 150, pad = 2, thresh = 150 } = {}) {
  const { data, info } = await sharp(src).greyscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const dark = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) dark[i] = data[i] < thresh ? 1 : 0;

  const lab = new Int32Array(W * H).fill(-1);
  const stack = new Int32Array(W * H);
  const boxes = [];
  for (let i = 0; i < W * H; i++) {
    if (!dark[i] || lab[i] >= 0) continue;
    const id = boxes.length; let sp = 0; stack[sp++] = i; lab[i] = id;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
    while (sp) {
      const p = stack[--sp], x = p % W, y = (p - x) / W; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (dark[q] && lab[q] < 0) { lab[q] = id; stack[sp++] = q; }
      }
    }
    boxes.push({ x0, y0, x1, y1, n, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }

  // Panel-sized components, biggest first so a merge grows onto the real border.
  const cand = boxes
    .filter(b => b.w >= min && b.w <= max && b.h >= min && b.h <= max && b.n > 200)
    .sort((a, b) => b.n - a.n);
  const keep = [];
  for (const b of cand) {
    const hit = keep.find(k => !(b.x1 < k.x0 || b.x0 > k.x1 || b.y1 < k.y0 || b.y0 > k.y1));
    if (hit) {
      hit.x0 = Math.min(hit.x0, b.x0); hit.y0 = Math.min(hit.y0, b.y0);
      hit.x1 = Math.max(hit.x1, b.x1); hit.y1 = Math.max(hit.y1, b.y1);
    } else keep.push({ ...b });
  }

  // Rows: panels within ~a third of a panel height of each other share a row.
  keep.sort((a, b) => a.y0 - b.y0);
  const rows = [];
  keep.forEach(b => {
    const r = rows.find(r => Math.abs(r[0].y0 - b.y0) < min / 2);
    if (r) r.push(b); else rows.push([b]);
  });
  rows.forEach(r => r.sort((a, b) => a.x0 - b.x0));

  // A row is cut on ONE top and ONE bottom, so the cards line up even though
  // each panel's own ink stops a pixel or two short.
  const out = [];
  rows.forEach((r, ri) => {
    const top = Math.max(0, Math.min(...r.map(b => b.y0)) - pad);
    const bot = Math.min(H - 1, Math.max(...r.map(b => b.y1)) + pad);
    r.forEach((b, ci) => {
      const left = Math.max(0, b.x0 - pad);
      out.push({
        row: ri + 1, col: ci + 1,
        left, top,
        width: Math.min(W - left, b.x1 - b.x0 + 1 + pad * 2),
        height: Math.min(H - top, bot - top + 1),
      });
    });
  });
  return { W, H, rows: rows.map(r => r.length), panels: out };
}

async function main() {
  const args = process.argv.slice(2);
  const src = args[0];
  if (!src) { console.error('usage: cut-panel-grid.js <sheet.png> [outDir] [--min N] [--max N]'); process.exit(1); }
  const outDir = args[1] && !args[1].startsWith('--') ? args[1] : 'panels';
  const num = f => { const i = args.indexOf(f); return i < 0 ? undefined : Number(args[i + 1]); };
  const { rows, panels } = await panelBoxes(src, { min: num('--min'), max: num('--max') });
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
