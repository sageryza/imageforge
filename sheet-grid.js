/**
 * THE PANEL SHEET'S GEOMETRY — one place that knows how a grid of panels
 * becomes a gpt-image-2 canvas and how that canvas comes apart again.
 * (Aug 2026, Sophie: "we make a picture and cut it into panels … describe
 * each panel individually. It's a way of saving money on the picture,
 * especially if it's done in 2K or 4K — then the pixels come out right too.")
 *
 * THE CANVAS IS DERIVED, NEVER A LOOKUP TABLE — the same rule size-tier.js
 * follows. A cell is an integer multiple of its shape (2:3 portrait → 2u×3u,
 * square → u×u), the sheet is (across·cellW)×(down·cellH), and every sheet
 * must satisfy ALL of gpt-image-2's constraints (both edges %16, long edge
 * ≤ 3840, ratio ≤ 3:1, 655,360 ≤ pixels ≤ 8,294,400) PLUS the one this
 * module adds: whole-pixel cells, so a cut is a lossless crop of the model's
 * own pixels rather than a resample. Among the legal sheets, the one whose
 * pixel count is CLOSEST to the tier's budget wins — the tier is a target,
 * not a ceiling. The budgets are read from the live PL_GPT.res table passed
 * in, never copied here, and the strongest check that the derivation is
 * right is that a 1×1 "grid" reproduces all six of the Playground's own
 * canvases (1024x1536 · 1568x2352 · 2336x3504 · 1024x1024 · 1920x1920 ·
 * 2880x2880) from the constraints alone — scripts/test-sheet-grid.js pins it.
 *
 * One cap worth knowing: the square 2-across sheet at 4K is EDGE-limited to
 * 3840x1920 (7.37MP, ~11% under the 4K budget) — still honestly a 4K sheet
 * by pixel count, but the one combo where the tier name promises slightly
 * more than the edge cap allows.
 *
 * Pure and dependency-free on purpose, so the tests need neither sharp nor
 * a network.
 */
'use strict';

// The grids on offer. 25 later is one { across: 5, down: 5 } entry — nothing
// else in the module counts the panels. (Sophie, 2026-08-26: "2, 4, 9 —
// possible 25 later".)
//
// THE 2 OPTION IS TWO LANDSCAPE PANELS, ONE ABOVE THE OTHER — a grid may PIN
// its cell shape, and this one does (2026-08-27, Sophie: "2 option shud be
// landscape in panels"). It used to be two PORTRAIT panels side by side,
// following the canvas toggle like 4 and 9 — which is the one grid where the
// toggle produced a shape nobody wants: a pair of tall narrow panels on a
// wide sheet. Two wide panels stacked is what a two-panel page is. A pinned
// shape means the canvas toggle decides NOTHING for that grid, so the page
// hides it rather than leaving a control that changes nothing on screen.
const GRIDS = {
  2: { across: 1, down: 2, shape: 'landscape' },
  4: { across: 2, down: 2 },
  9: { across: 3, down: 3 },
};

// Cell shapes mirror the Playground's canvas toggle: the toggle picks what
// shape each PANEL comes out, and the sheet's own shape falls out of the grid.
// `landscape` is the portrait cell rotated, so it has no res row of its own —
// `budget` names the tier table it borrows its pixel budget from, and a
// landscape 2K panel is exactly as many pixels as a portrait 2K one.
const SHAPES = {
  portrait: { w: 2, h: 3, aspectRatio: '2:3' },
  square: { w: 1, h: 1, aspectRatio: '1:1' },
  landscape: { w: 3, h: 2, aspectRatio: '3:2', budget: 'portrait' },
};

// gpt-image-2's published constraints (see PL_GPT.res in server.js).
const EDGE_MULT = 16;
const MAX_EDGE = 3840;
const MAX_RATIO = 3;
const MIN_PX = 655_360;
const MAX_PX = 8_294_400;

function legal(W, H) {
  if (W % EDGE_MULT || H % EDGE_MULT) return false;
  if (W > MAX_EDGE || H > MAX_EDGE) return false;
  const px = W * H;
  if (px < MIN_PX || px > MAX_PX) return false;
  const ratio = Math.max(W, H) / Math.min(W, H);
  return ratio <= MAX_RATIO;
}

/**
 * The best sheet for `across`×`down` cells of shape (shapeW:shapeH), aiming
 * at `budget` pixels. Scans the integer cell unit — the space is tiny (a cell
 * edge can never exceed 3840px) — and returns null when no legal sheet
 * exists, never an invented one.
 */
function derive(shapeW, shapeH, across, down, budget) {
  let best = null;
  for (let u = 1; u * Math.max(shapeW, shapeH) <= MAX_EDGE; u++) {
    const cellW = shapeW * u;
    const cellH = shapeH * u;
    const W = across * cellW;
    const H = down * cellH;
    if (W > MAX_EDGE && H > MAX_EDGE) break;
    if (!legal(W, H)) continue;
    const diff = Math.abs(W * H - budget);
    if (!best || diff < best.diff) best = { W, H, cellW, cellH, diff };
  }
  return best;
}

/**
 * sheetFor('portrait', 9, '2k', PL_GPT.res) → the sheet plan, or null.
 * `resTable` is the live PL_GPT.res so the budgets are the Playground's own
 * canvases, never a copy that can drift.
 */
function sheetFor(shape, grid, tier, resTable) {
  const g = GRIDS[Number(grid)];
  // A grid may PIN its cell shape (the 2 option is landscape), and then the
  // canvas toggle is ignored outright rather than half-applied — a pinned
  // shape borrows its pixel budget from the table named by SHAPES[…].budget,
  // so `sheetFor('square', 2, …)` and `sheetFor('portrait', 2, …)` are the
  // same sheet, which is what lets the page hide the toggle honestly.
  const cellShape = (g && g.shape) || shape;
  const s = SHAPES[cellShape];
  const budgetShape = (s && s.budget) || cellShape;
  const row = resTable && resTable[budgetShape] && resTable[budgetShape].tiers
    && resTable[budgetShape].tiers[tier];
  if (!s || !g || !row) return null;
  const m = /^(\d+)x(\d+)$/.exec(String(row.size || ''));
  if (!m) return null;
  const budget = Number(m[1]) * Number(m[2]);
  const best = derive(s.w, s.h, g.across, g.down, budget);
  if (!best) return null;
  return {
    sheet: `${best.W}x${best.H}`, W: best.W, H: best.H,
    cell: `${best.cellW}x${best.cellH}`, cellW: best.cellW, cellH: best.cellH,
    across: g.across, down: g.down, count: g.across * g.down,
    // The CELL's ratio — it is what each finished panel is, and what the
    // Playground feed renders the run's pictures with.
    aspectRatio: s.aspectRatio, shape: cellShape,
  };
}

/**
 * Panel names, reading order. Number + name is deliberate redundancy in the
 * prompt: the number pins reading order, the name pins geometry. Grids wider
 * or taller than 3 (the future 25) fall back to row/column words, because
 * past three columns there is no natural English name for a cell.
 */
function positions(grid) {
  const g = GRIDS[Number(grid)];
  if (!g) return [];
  const { across, down } = g;
  if (across > 3 || down > 3) {
    const out = [];
    for (let r = 0; r < down; r++) {
      for (let c = 0; c < across; c++) out.push(`row ${r + 1}, column ${c + 1}`);
    }
    return out;
  }
  if (down === 1) {
    return across === 2 ? ['left', 'right']
      : ['left', 'middle', 'right'].slice(0, across);
  }
  // A single COLUMN names its rows and nothing else — "top left" on a grid
  // one panel wide reads as though there were a right-hand one.
  if (across === 1) {
    return down === 2 ? ['top', 'bottom']
      : ['top', 'middle', 'bottom'].slice(0, down);
  }
  const rows = down === 2 ? ['top', 'bottom'] : ['top', 'middle', 'bottom'];
  const cols = across === 2 ? ['left', 'right'] : ['left', 'middle', 'right'];
  const out = [];
  for (let r = 0; r < down; r++) {
    for (let c = 0; c < across; c++) {
      const name = rows[r] === 'middle' && cols[c] === 'middle'
        ? 'center' : `${rows[r]} ${cols[c]}`;
      out.push(name);
    }
  }
  return out;
}

/** 'a single row of 2 panels, side by side' | 'a 3x3 grid of 9 panels'. */
function layoutWords(grid) {
  const g = GRIDS[Number(grid)];
  if (!g) return '';
  const count = g.across * g.down;
  if (g.down === 1) return `a single row of ${count} panels, side by side`;
  if (g.across === 1) return `a single column of ${count} panels, one above the other`;
  return `a ${g.across}x${g.down} grid of ${count} panels`;
}

/**
 * The content block: the grid sentence, then one line per panel with her
 * words VERBATIM. It asks for the geometry the cut assumes — equal
 * rectangles, this many across and down — and says nothing about borders or
 * caption boxes, which are the style's business.
 *
 * THE WORDING IS HERS, dictated 2026-08-27, and it is SHORTER than what
 * shipped: the second geometry clause ("with straight edges exactly on the
 * grid lines, no gutters and no outer margin") is gone at her ask. Nothing
 * depended on it — findSeams below cuts through the middle of the real gutter
 * wherever the model drew it, which is what makes the clause unnecessary
 * rather than load-bearing. Do not "restore" it.
 */
function panelBlock(grid, texts) {
  const g = GRIDS[Number(grid)];
  if (!g) return '';
  const count = g.across * g.down;
  let shape;
  if (g.down === 1) shape = `a single row of ${count} separate panels, side by side`;
  else if (g.across === 1) shape = `a single column of ${count} separate panels, one above the other`;
  else shape = `a ${g.across}x${g.down} grid of ${count} separate panels`;
  const names = positions(grid);
  // The reading order names only the axes that exist — "left to right" on a
  // single column is an instruction about a dimension the page has not got.
  const order = g.down === 1 ? 'left to right'
    : (g.across === 1 ? 'top to bottom' : 'left to right, top to bottom');
  const lines = (texts || []).map(
    (t, i) => `Panel ${i + 1} (${names[i]}): ${String(t || '').trim()}`);
  return [
    `This page is ${shape} — equal rectangles, ${g.across} across and `
    + `${g.down} down. Each panel is its own complete, self-contained `
    + `illustration. In reading order, ${order}:`,
    ...lines,
  ].join('\n');
}

/**
 * The cut boxes, reading order. Exact by construction — the sheet divides
 * into whole-pixel cells, so left/top are plain products and the rects tile
 * the sheet with no gap and no overlap (the test proves it rather than
 * trusting this comment).
 */
function cellRects(W, H, across, down) {
  const cellW = W / across;
  const cellH = H / down;
  if (!Number.isInteger(cellW) || !Number.isInteger(cellH)) return null;
  const out = [];
  for (let r = 0; r < down; r++) {
    for (let c = 0; c < across; c++) {
      out.push({ left: c * cellW, top: r * cellH, width: cellW, height: cellH });
    }
  }
  return out;
}

/**
 * THE CUT IS IMAGE-AWARE — MID-GUTTER, NEVER BLINDLY ON THE MATH LINE
 * (2026-08-26, Sophie, on the first live sheet: "the cut should be in the
 * middle of the tan area, but two of them got one side cut right on the
 * black edge. the framing isn't right"). The model draws the panel grid
 * SLIGHTLY off the exact lines, so a mathematically perfect cut can land on
 * a panel's hand-drawn border instead of the paper gutter beside it.
 *
 * findSeams looks at the picture: near each mathematical line (a window of
 * ±12% of the cell dimension — small on purpose, so a pale patch INSIDE a
 * panel can never drag a seam into the art) it profiles the ink per
 * column/row and takes the light VALLEY — the run of near-paper pixels
 * between the two dark frame edges — cutting through its middle. A valley
 * only qualifies when the window has real contrast (it holds both a border
 * and paper) and the run is at least a few pixels wide; anything less falls
 * back to the exact math line, so on a full-bleed style with no gutters the
 * worst case is byte-for-byte the old behavior.
 *
 * Pure over a plain luminance buffer, so the tests need no sharp and no
 * network — the caller derives `gray` from the raw decode it already has.
 */
const SEAM_WINDOW = 0.12;   // half-width of the search window, as a cell fraction
const SEAM_SMOOTH = 2;      // moving-average radius over the profile
const SEAM_CONTRAST = 60;   // min (hi - lo) ink for a window that can hold a gutter
const SEAM_MIN_RUN = 3;     // px — a "valley" narrower than this is noise

function smooth(arr, r) {
  const out = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    let s = 0, n = 0;
    for (let j = Math.max(0, i - r); j <= Math.min(arr.length - 1, i + r); j++) { s += arr[j]; n++; }
    out[i] = s / n;
  }
  return out;
}

// One seam: the ink profile inside [from, to), the qualifying valley runs,
// and the middle of the run closest to the math line. `null` = fall back.
function findSeam(profile, from, to, mathLine) {
  const win = smooth(profile.slice(from, to), SEAM_SMOOTH);
  let lo = Infinity, hi = -Infinity;
  win.forEach((v) => { if (v < lo) lo = v; if (v > hi) hi = v; });
  if (hi - lo < SEAM_CONTRAST) return null;          // no border+paper here — no gutter
  const cap = lo + Math.max(12, 0.15 * (hi - lo));
  const runs = [];
  let start = -1;
  for (let i = 0; i <= win.length; i++) {
    const inRun = i < win.length && win[i] <= cap;
    if (inRun && start < 0) start = i;
    if (!inRun && start >= 0) {
      if (i - start >= SEAM_MIN_RUN) runs.push({ mid: from + Math.round((start + i - 1) / 2) });
      start = -1;
    }
  }
  if (!runs.length) return null;
  runs.sort((a, b) => Math.abs(a.mid - mathLine) - Math.abs(b.mid - mathLine));
  return runs[0].mid;
}

/**
 * The interior cut positions for an across×down grid over a W×H luminance
 * buffer. Returns { xs, ys } — xs has across-1 entries, ys down-1 — each the
 * mid-gutter position, or the exact math line where no gutter qualifies.
 */
function findSeams(gray, W, H, across, down) {
  // Column ink = mean over y of (255 - gray); row ink likewise. Computed
  // whole — one pass over the buffer, integer adds, cheap even at 8MP.
  const colInk = new Float64Array(W);
  const rowInk = new Float64Array(H);
  for (let y = 0; y < H; y++) {
    const base = y * W;
    for (let x = 0; x < W; x++) {
      const ink = 255 - gray[base + x];
      colInk[x] += ink;
      rowInk[y] += ink;
    }
  }
  for (let x = 0; x < W; x++) colInk[x] /= H;
  for (let y = 0; y < H; y++) rowInk[y] /= W;
  const seams = (profile, len, parts, cell) => {
    const out = [];
    const half = Math.max(4, Math.round(cell * SEAM_WINDOW));
    for (let i = 1; i < parts; i++) {
      const line = Math.round((i * len) / parts);
      const at = findSeam(Array.from(profile), Math.max(0, line - half),
        Math.min(len, line + half), line);
      out.push(at == null ? line : at);
    }
    return out;
  };
  return {
    xs: seams(colInk, W, across, W / across),
    ys: seams(rowInk, H, down, H / down),
  };
}

/**
 * The cut rects from seam positions, reading order — tiles the sheet
 * exactly, whatever the seams did (each panel spans seam to seam, the outer
 * edges are the sheet's own).
 */
function seamBoxes(xs, ys, W, H) {
  const xEdges = [0].concat(xs, [W]);
  const yEdges = [0].concat(ys, [H]);
  const out = [];
  for (let r = 0; r < yEdges.length - 1; r++) {
    for (let c = 0; c < xEdges.length - 1; c++) {
      out.push({
        left: xEdges[c], top: yEdges[r],
        width: xEdges[c + 1] - xEdges[c], height: yEdges[r + 1] - yEdges[r],
      });
    }
  }
  return out;
}

/**
 * A style's tail can FIGHT a sheet — Dreamy's ends "Render as ONE single
 * illustration — NOT a grid, NOT split panels", which is load-bearing on an
 * ordinary run (its reference IS a multi-panel comic page) and poison on a
 * sheet: two sentences arguing about the layout produce one panel with
 * ghosts of the others. The fix is a SWAP, never an appended argument — the
 * same mechanism as the no-text toggle (`applyNoText` in server.js): the
 * style carries `sheet: { from, to }` and the clause is replaced, with
 * `{layout}` in `to` filled from `layoutWords(grid)`.
 *
 * If `from` is not in the tail — she edited it — this NO-OPS. Her wording
 * wins, and the grid sentence in the content block still asks for the grid;
 * the Prompt panel discloses whatever was really sent either way.
 */
function applySheet(suffix, swap, layout) {
  const s = String(suffix || '');
  if (!swap || !swap.from || !s.includes(swap.from)) return s;
  return s.replace(swap.from, String(swap.to || '').replace('{layout}', layout || ''));
}

module.exports = { GRIDS, SHAPES, sheetFor, derive, positions, layoutWords, panelBlock, cellRects, applySheet, findSeams, seamBoxes };
