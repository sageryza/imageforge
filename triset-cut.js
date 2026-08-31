// Triset — the DIE-CUT (2026-08-30, Sophie: "they shud have a cream border ·
// equilateral · the whole image plus outline needs to fit in the triangle ·
// fix the cutting" — and 2026-08-31, the settled rule, after the contain-fit
// version shipped wobbly shapes onto her print sheets: "the original cream
// cut is wrong which makes these extra wrong. original cut shud all be
// perfect equilateral").
//
// The model draws each card WITH its own cream paper border and hand-drawn
// frame line, on a plain white background — but at a slightly different
// size, position and steepness every time. The first cut (c1) preserved the
// drawn shape exactly: flood-fill the white away, contain-fit the wobbly
// content inside the slot at 0.96. That is faithful to the drawing and WRONG
// for a card: every cut came out a slightly different triangle, and on a
// printed cut-sheet the differences compound. HER RULE: the cut is a perfect
// equilateral, every time —
//   1. Flood-fill the white background transparent from the edges, exactly
//      as before (interior white highlights survive — flood, not chroma).
//   2. COVER-FIT: scale the drawn card UP just enough that the ideal slot
//      triangle (1000x866, point-up or point-down per flip) is entirely
//      inside the drawing — coverPlan searches the smallest scale and the
//      placement that covers, preferring centered/base-anchored. This is
//      what a physical die does: it cuts a perfect triangle out of an
//      imperfect drawing, and the slivers past the die are what you lose.
//   3. Mask HARD with the exact slot triangle. The cut edge IS the
//      equilateral; the drawn cream rim survives wherever it falls inside.
//      Transparent outside — page paper shows through the corners of the
//      square canvas exactly as before.
//
// A full-bleed draw (no white paper to remove) goes through the same cover
// path — the whole frame covers trivially — so there is ONE geometry.
//
// The c1 contain-fit (fitBox, FIT 0.96) is HISTORY, not a rule — do not
// bring it back for the gap between cards on the board; the gap is the
// board's spacing to provide.
//
// Bakes run server-side for a made card (render(), right after the paid
// bytes are banked) and via POST /api/triset/recut for the pool;
// scripts/triset-recut.js runs the same bake from a container. ~1MP decode,
// nothing like the 4K sheet cuts — no gate needed.
//
// Tests: node scripts/test-triset.js (dieCutAlpha + coverPlan pure on
// synthetic images, bakeCut end-to-end through real sharp).

const CUT_W = 1000;
const CUT_H = 866;              // 1000 * sqrt(3)/2 — exactly equilateral
const NEAR_WHITE = 238;         // r,g,b all >= this reads as the paper behind the card
const MIN_REMOVED = 0.08;       // less background than this = a full-bleed draw
const CUT_VERSION = 'c2';       // objects are immutable — bump to re-bake past the CDN
                                // c1 = contain-fit (shape preserved); c2 = perfect equilateral

const cutPath = (id) => `triset/cuts/${id}.${CUT_VERSION}.webp`;

// ── pure: the flood fill ───────────────────────────────────────────────────
// RGBA in place: every near-white pixel REACHABLE FROM THE EDGES goes
// transparent. Interior whites (a highlight inside the frame) are unreachable
// and keep — nothing stands between the source and the output but the cut.
// Returns { removed (fraction), bbox (of what remains) | null }.
function dieCutAlpha(data, w, h) {
  const isBg = (p) => {
    const i = p * 4;
    return data[i] >= NEAR_WHITE && data[i + 1] >= NEAR_WHITE && data[i + 2] >= NEAR_WHITE;
  };
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let top = 0;
  const push = (p) => { if (!seen[p] && isBg(p)) { seen[p] = 1; stack[top++] = p; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  let removed = 0;
  while (top > 0) {
    const p = stack[--top];
    data[p * 4 + 3] = 0;
    removed++;
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { removed: removed / (w * h), bbox: x1 < 0 ? null : { x0, y0, x1, y1 } };
}

// ── pure: the smallest cover of the slot triangle ──────────────────────────
// coverPlan(data, w, h, bbox, { flip }) → { scale, left, top, covered }
// The transform (uniform scale, slot-px position of the bbox's top-left)
// under which every point of the slot triangle lands on OPAQUE content —
// found by growing the scale from the bbox-cover baseline and scanning
// placements from the natural anchor outward (centered; base-anchored for a
// point-up card, top-anchored for a point-down one). The test triangle is
// eroded slightly (TEST_INSET) so an anti-aliased drawn edge cannot make
// coverage impossible; the RENDER mask is the exact triangle.
// If nothing covers by MAX_COVER x the baseline, the best placement found is
// returned with covered < 1 — the uncovered slivers mask to transparent,
// which on paper and on the page reads as the white they were.
const TEST_INSET = 0.985;
const MAX_COVER = 2.2;
const ALPHA_ON = 60;

function triPoints(flip, inset, W = CUT_W, H = CUT_H) {
  const pts = flip
    ? [[0, 0], [W, 0], [W / 2, H]]
    : [[W / 2, 0], [W, H], [0, H]];
  const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
  const cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
  return pts.map(([x, y]) => [cx + (x - cx) * inset, cy + (y - cy) * inset]);
}

function coverPlan(data, w, h, bbox, { flip = false, W = CUT_W, H = CUT_H } = {}) {
  const bw = bbox.x1 - bbox.x0 + 1;
  const bh = bbox.y1 - bbox.y0 + 1;
  const s0 = Math.max(W / bw, H / bh);

  // the eroded test triangle, sampled on a coarse grid
  const [[ax, ay], [bx, by], [cx, cy]] = triPoints(flip, TEST_INSET, W, H);
  const edge = (px, py, x0, y0, x1, y1) => (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0);
  const grid = [];
  const STEP = 6;
  for (let y = 0; y < H; y += STEP) {
    for (let x = 0; x < W; x += STEP) {
      const e0 = edge(x, y, ax, ay, bx, by);
      const e1 = edge(x, y, bx, by, cx, cy);
      const e2 = edge(x, y, cx, cy, ax, ay);
      if ((e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0)) grid.push([x, y]);
    }
  }
  const opaque = (sx, sy) => sx >= 0 && sy >= 0 && sx < w && sy < h
    && data[(sy * w + sx) * 4 + 3] > ALPHA_ON;

  const coverage = (k, left, top) => {
    let hit = 0;
    for (const [px, py] of grid) {
      const sx = bbox.x0 + Math.round((px - left) / k);
      const sy = bbox.y0 + Math.round((py - top) / k);
      if (opaque(sx, sy)) hit += 1;
    }
    return hit / grid.length;
  };

  // placements ordered from the natural anchor outward
  const spots = (lo, hi, anchor) => {
    const vals = [];
    const n = 9;
    for (let i = 0; i < n; i += 1) vals.push(lo + ((hi - lo) * i) / (n - 1));
    vals.sort((a, u) => Math.abs(a - anchor) - Math.abs(u - anchor));
    return vals;
  };

  let best = { scale: s0, left: (W - bw * s0) / 2, top: flip ? 0 : H - bh * s0, covered: 0 };
  for (let g = 1; g <= MAX_COVER + 1e-9; g *= 1.025) {
    const k = s0 * g;
    const cw = bw * k; const ch = bh * k;
    const lefts = spots(W - cw, 0, (W - cw) / 2);
    const tops = spots(H - ch, 0, flip ? 0 : H - ch);
    for (const t of tops) {
      for (const l of lefts) {
        const c = coverage(k, l, t);
        if (c > best.covered) best = { scale: k, left: l, top: t, covered: c };
        if (c === 1) return { scale: k, left: l, top: t, covered: 1 };
      }
    }
  }
  return best;
}

// ── the bake (sharp) ───────────────────────────────────────────────────────
async function bakeCut(buf, { flip = false } = {}) {
  const sharp = require('sharp');
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width; const h = info.height;
  let cut = dieCutAlpha(data, w, h);
  let fullBleed = false;
  if (!cut.bbox || cut.removed < MIN_REMOVED) {
    // full-bleed draw — nothing to measure; restore the alpha the partial
    // fill touched and let the whole frame cover, same geometry as everyone
    fullBleed = true;
    for (let p = 3; p < data.length; p += 4) data[p] = 255;
    cut = { removed: 0, bbox: { x0: 0, y0: 0, x1: w - 1, y1: h - 1 } };
  }
  const plan = coverPlan(data, w, h, cut.bbox, { flip });
  const bw = cut.bbox.x1 - cut.bbox.x0 + 1;
  const bh = cut.bbox.y1 - cut.bbox.y0 + 1;
  const sw = Math.max(CUT_W, Math.round(bw * plan.scale));
  const sh = Math.max(CUT_H, Math.round(bh * plan.scale));
  // the scaled drawing is LARGER than the canvas (that is what cover means),
  // so the canvas window is cut out of it rather than composited at a
  // negative offset, which sharp refuses
  const wx = Math.min(Math.max(0, Math.round(-plan.left)), sw - CUT_W);
  const wy = Math.min(Math.max(0, Math.round(-plan.top)), sh - CUT_H);
  const window = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: cut.bbox.x0, top: cut.bbox.y0, width: bw, height: bh })
    .resize(sw, sh, { fit: 'fill' })
    .extract({ left: wx, top: wy, width: CUT_W, height: CUT_H })
    .png().toBuffer();
  // the cut edge IS the perfect equilateral — the exact slot triangle
  const pts = flip ? `0,0 ${CUT_W},0 ${CUT_W / 2},${CUT_H}` : `${CUT_W / 2},0 ${CUT_W},${CUT_H} 0,${CUT_H}`;
  const mask = Buffer.from(
    `<svg width="${CUT_W}" height="${CUT_H}" xmlns="http://www.w3.org/2000/svg"><polygon points="${pts}" fill="#fff"/></svg>`);
  const out = await sharp(window)
    .composite([{ input: mask, blend: 'dest-in' }])
    .webp({ quality: 90 }).toBuffer();
  return { buf: out, fullBleed, covered: plan.covered };
}

module.exports = { dieCutAlpha, coverPlan, triPoints, bakeCut, cutPath, CUT_W, CUT_H, NEAR_WHITE, MIN_REMOVED, CUT_VERSION };
