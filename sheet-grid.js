/**
 * WHERE A SHEET'S CANVAS COMES FROM — the geometry behind the Panels tool.
 *
 * Sophie, 2026-08-23: "i think we copy the playground code for it's own
 * module. this has four text boxes, one for each panel — or an option for
 * other grid sizes like 9 or 2 (landscape, side by side)".
 *
 * ONE CALL DRAWS ONE SHEET; THE PANELS ARE CUT OUT OF IT LOCALLY, FREE.
 * That is cheaper twice over (docs/modules/pictures.md): output tokens scale
 * sub-linearly with pixels, AND a sheet pays the style reference's ~1.2c once
 * instead of once per picture.
 *
 * THE CANVAS IS DERIVED, NEVER A LOOKUP TABLE — the same rule size-tier.js
 * follows. A grid nobody has drawn before still lands on a legal canvas, and
 * the numbers cannot drift out of step with the constraints they satisfy.
 *
 * Every canvas here satisfies ALL of gpt-image-2's constraints:
 *   both edges a multiple of 16 · long edge <= 3840 · ratio <= 3:1
 *   655,360 <= pixels <= 8,294,400
 * plus the one this tool adds: the sheet must divide into whole-pixel cells,
 * so a cut is a lossless crop of the sheet's own pixels rather than a resample.
 *
 * THE TIER IS A TARGET, NOT A CAP (below the hard 8,294,400 one). We take the
 * canvas CLOSEST to the tier's pixel budget, which is what reproduces the
 * Playground's own tiers exactly — its 2K portrait is 1568x2352 = 3,687,936,
 * i.e. 1,536 pixels OVER the nominal 2K. Rounding down instead would quietly
 * hand her a different, smaller canvas than the same tier draws next door.
 */

// gpt-image-2's own limits. MAX_PX is a hard refusal; the rest are too.
const MAX_PX = 8294400;
const MIN_PX = 655360;
const MAX_EDGE = 3840;
const MULTIPLE = 16;
const MAX_RATIO = 3;

// The tier budgets, matching the Playground's (PL_GPT.res in server.js):
// 1K is the old 1024x1536, and 2K/4K are the pixel budgets its canvases were
// chosen against. Naming them here keeps a sheet's caption on the same rung
// size-tier.js would put it on.
const TIERS = { '1k': 1572864, '2k': 3686400, '4k': MAX_PX };

// THE GRIDS SHE NAMED, and nothing invented beside them. `across`/`down` are
// cells, so the sheet's own shape falls out of the cell shape rather than
// being stated twice.
// Two is SIDE BY SIDE on a landscape sheet (her words), which is the one grid
// whose sheet is a different orientation from its cells — two 2:3 portraits
// shoulder to shoulder make a 4:3 landscape page.
const GRIDS = {
  2: { across: 2, down: 1, label: 'Two, side by side' },
  4: { across: 2, down: 2, label: 'Four' },
  9: { across: 3, down: 3, label: 'Nine' },
};

// The cell shapes, same two the Playground offers.
const SHAPES = {
  portrait: { w: 2, h: 3, aspectRatio: '2:3', label: 'Portrait' },
  square: { w: 1, h: 1, aspectRatio: '1:1', label: 'Square' },
};

// Reading order, which is the order the boxes on the page are in and the order
// the cut writes them out. Named rather than numbered because the prompt says
// these words to the model.
function cellNames(gridId) {
  const g = GRIDS[gridId];
  if (!g) return [];
  if (g.down === 1) return ['left', 'right'].slice(0, g.across);
  if (g.across === 2) return ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  const rows = ['top', 'middle', 'bottom'], cols = ['left', 'centre', 'right'];
  const out = [];
  for (let r = 0; r < g.down; r++) for (let c = 0; c < g.across; c++) out.push(`${rows[r]}-${cols[c]}`);
  return out;
}

/**
 * The sheet for one (grid, cell shape, tier).
 * Returns { sheet:'WxH', width, height, cell:'wxh', cellWidth, cellHeight,
 *           across, down, count, pixels, aspectRatio, cellAspectRatio }
 * or null when no legal canvas exists for that combination.
 */
function sheetFor(gridId, shapeId, tierId) {
  const g = GRIDS[gridId];
  const s = SHAPES[shapeId];
  const budget = TIERS[tierId];
  if (!g || !s || !budget) return null;

  // A cell is (s.w*k, s.h*k) for an integer k, so the sheet is
  // (across*s.w*k, down*s.h*k) and every cut lands on whole pixels by
  // construction. k is what we search.
  const sw = g.across * s.w, sh = g.down * s.h;
  const ratio = Math.max(sw / sh, sh / sw);
  if (ratio > MAX_RATIO) return null;

  let best = null;
  // The upper bound is whichever limit bites first — pixels or the long edge.
  const kMax = Math.min(
    Math.floor(Math.sqrt(MAX_PX / (sw * sh))),
    Math.floor(MAX_EDGE / Math.max(sw, sh)),
  );
  for (let k = 1; k <= kMax; k++) {
    const W = sw * k, H = sh * k;
    if (W % MULTIPLE || H % MULTIPLE) continue;
    const px = W * H;
    if (px > MAX_PX || px < MIN_PX) continue;
    // Closest to the tier's budget — see the header on why this is a target
    // and not a ceiling.
    const gap = Math.abs(px - budget);
    if (!best || gap < best.gap) best = { k, W, H, px, gap };
  }
  if (!best) return null;

  return {
    sheet: `${best.W}x${best.H}`,
    width: best.W, height: best.H,
    cell: `${s.w * best.k}x${s.h * best.k}`,
    cellWidth: s.w * best.k, cellHeight: s.h * best.k,
    across: g.across, down: g.down, count: g.across * g.down,
    pixels: best.px,
    aspectRatio: `${sw / gcd(sw, sh)}:${sh / gcd(sw, sh)}`,
    cellAspectRatio: s.aspectRatio,
  };
}

function gcd(a, b) { return b ? gcd(b, a % b) : a; }

// Every legal cut of the sheet, in reading order — { left, top, width, height }
// boxes for sharp's `extract`. Exact halves/thirds of the sheet's own pixels.
function cutBoxes(plan) {
  if (!plan) return [];
  const out = [];
  for (let r = 0; r < plan.down; r++) {
    for (let c = 0; c < plan.across; c++) {
      out.push({ left: c * plan.cellWidth, top: r * plan.cellHeight,
        width: plan.cellWidth, height: plan.cellHeight });
    }
  }
  return out;
}

module.exports = { GRIDS, SHAPES, TIERS, MAX_PX, MIN_PX, MAX_EDGE, sheetFor, cutBoxes, cellNames };
