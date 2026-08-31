// Triset — the DIE-CUT (2026-08-30 "fix the cutting"; 2026-08-31 round two:
// "original cut shud all be perfect equilateral"; 2026-08-31 round three, the
// SETTLED rule, off her print sheets: "nope. they're cut straight to the line
// in some spaces. they all need to have a MINIMUM border of cream space, and
// extra on the sides if it's narrow or extra at the top if squat").
//
// The model draws each card WITH its own cream paper rim and frame line, on
// white, at a slightly different size/steepness every time. Three cuts, two
// of them history:
//   c1 preserved the drawn shape (contain-fit at 0.96) — every cut a
//      different triangle, compounding on a printed cut-sheet.
//   c2 cover-fit + hard mask — a perfect equilateral, but covering means
//      CROPPING, and the cut ran straight through art and rim on any card
//      whose shape differed from the ideal. She rejected it on sight.
//   c3 (this) — perfect equilateral, and the cut NEVER touches art: the
//      drawn card is contained INSIDE the triangle with a guaranteed margin,
//      and the whole triangle is filled with CREAM behind it — sampled from
//      the card's own drawn rim, so the added border reads as the same
//      paper. A narrow card sits base-anchored with extra cream at its
//      sides; a squat card gets its extra at the top — her words exactly,
//      and both fall out of one rule (centered, base-anchored, contained).
//
//   1. Flood-fill the white background transparent from the edges (interior
//      white highlights survive — flood, not chroma).
//   2. rimColor: the median colour of the content's outer band — the drawn
//      cream rim itself. Fallback CREAM for a full-bleed draw with no rim.
//   3. inscribePlan: the LARGEST scale + placement putting every opaque
//      pixel inside the slot triangle inset by MIN_BORDER — anchored to the
//      base (top for a point-down card), centered.
//   4. Fill the exact slot triangle with the rim cream, lay the card over
//      it, mask with the exact triangle. The cut edge is the perfect
//      equilateral and always runs through cream.
//
// A full-bleed draw (no white to remove) goes through the same path — its
// art does get inset cream around it, which is the rule: a minimum border,
// no exceptions.
//
// Bakes run server-side for a made card (render(), right after the paid
// bytes are banked) and via POST /api/triset/recut for the pool;
// scripts/triset-recut.js runs the same bake from a container. ~1MP decode,
// nothing like the 4K sheet cuts — no gate needed.
//
// Tests: node scripts/test-triset.js (dieCutAlpha + inscribePlan pure,
// bakeCut end-to-end through real sharp).

const CUT_W = 1000;
const CUT_H = 866;              // 1000 * sqrt(3)/2 — exactly equilateral
const NEAR_WHITE = 238;         // r,g,b all >= this reads as the paper behind the card
const MIN_REMOVED = 0.08;       // less background than this = a full-bleed draw
const CUT_VERSION = 'c3';       // objects are immutable — bump to re-bake past the CDN
                                // c1 shape-preserving · c2 cover (cropped art) · c3 cream-bordered

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

// ── pure: the card's own cream, read off its rim ───────────────────────────
// The added border must read as the SAME paper the model drew, so the fill
// colour is sampled from the content's outer band: every opaque pixel within
// RIM_BAND of a transparent one, median per channel. A full-bleed draw has no
// band to read and falls back to the house CREAM.
const CREAM = { r: 243, g: 236, b: 221 };
const RIM_BAND = 6;

function rimColor(data, w, h) {
  const rs = []; const gs = []; const bs = [];
  const clear = (x, y) => x < 0 || y < 0 || x >= w || y >= h || data[(y * w + x) * 4 + 3] === 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      if (data[i + 3] === 0) continue;
      let edge = false;
      for (let d = 1; d <= RIM_BAND && !edge; d += 1) {
        if (clear(x - d, y) || clear(x + d, y) || clear(x, y - d) || clear(x, y + d)) edge = true;
      }
      if (!edge) continue;
      rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]);
    }
  }
  if (rs.length < 40) return { ...CREAM };
  const med = (a) => { a.sort((x, y) => x - y); return a[a.length >> 1]; };
  const c = { r: med(rs), g: med(gs), b: med(bs) };
  // a card whose outer band is DARK has no drawn rim to sample (the art runs
  // to the edge) — an art-coloured border would read as a smear, so the
  // house cream steps in. A real drawn rim is light and passes untouched.
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return lum >= 160 ? c : { ...CREAM };
}

// ── pure: the largest card that fits INSIDE the bordered triangle ──────────
// inscribePlan(data, w, h, bbox, { flip }) → { scale, left, top }
// The mirror of a cover: the LARGEST uniform scale and the placement under
// which every opaque pixel lands inside the slot triangle inset by
// MIN_BORDER from each edge — so the cut is always at least that much cream
// from the art. Anchored to the base (the top edge for a point-down card),
// centered; a narrow card ends up with its extra cream at the sides and a
// squat one with its extra at the top, which is her rule verbatim.
const MIN_BORDER = 22;          // slot px ≥ this much ADDED cream past the drawn rim
const ALPHA_ON = 60;

function insetTri(flip, W = CUT_W, H = CUT_H, d = MIN_BORDER) {
  // pull each edge in by d along its normal = shrink about the centroid by
  // (r - d) / r, r the apothem (H/3 for an equilateral of height H)
  const r = H / 3;
  const f = (r - d) / r;
  const pts = flip ? [[0, 0], [W, 0], [W / 2, H]] : [[W / 2, 0], [W, H], [0, H]];
  const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
  const cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
  return pts.map(([x, y]) => [cx + (x - cx) * f, cy + (y - cy) * f]);
}

function inscribePlan(data, w, h, bbox, { flip = false, W = CUT_W, H = CUT_H } = {}) {
  const bw = bbox.x1 - bbox.x0 + 1;
  const bh = bbox.y1 - bbox.y0 + 1;
  // the content's opaque outline, sampled coarsely (a missed 2px spike costs
  // an invisible sliver of the margin, never the art)
  const step = Math.max(1, Math.floor(Math.min(bw, bh) / 90));
  const pts = [];
  for (let y = bbox.y0; y <= bbox.y1; y += step) {
    for (let x = bbox.x0; x <= bbox.x1; x += step) {
      if (data[(y * w + x) * 4 + 3] > ALPHA_ON) pts.push([x, y]);
    }
  }
  const [[ax, ay], [bx, by], [cx2, cy2]] = insetTri(flip, W, H);
  const edge = (px, py, x0, y0, x1, y1) => (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0);
  const s1 = edge(cx2, cy2, ax, ay, bx, by) >= 0 ? 1 : -1;   // orient once
  const inside = (px, py) =>
    s1 * edge(px, py, ax, ay, bx, by) >= 0
    && s1 * edge(px, py, bx, by, cx2, cy2) >= 0
    && s1 * edge(px, py, cx2, cy2, ax, ay) >= 0;

  const fits = (k, left, top) => {
    for (const [sx, sy] of pts) {
      const px = left + (sx - bbox.x0) * k;
      const py = top + (sy - bbox.y0) * k;
      if (!inside(px, py)) return false;
    }
    return true;
  };

  // baseline: the inset triangle's own bbox; descend until a placement fits
  const triW = Math.max(bx, cx2) - Math.min(ax, bx, cx2);
  const k0 = Math.min((W - 2) / bw, (H - 2) / bh);
  const baseY = flip ? Math.min(ay, by) : Math.max(by, cy2);   // the inset base edge
  for (let k = k0; k > k0 * 0.3; k *= 0.985) {
    const cw = bw * k; const ch = bh * k;
    // centered, then anchored: base-on-the-base (top-on-the-top for flip),
    // stepping toward the middle when the anchor spot doesn't fit
    const lefts = [(W - cw) / 2];
    for (let dscan = 8; dscan <= 40; dscan += 8) lefts.push((W - cw) / 2 - dscan, (W - cw) / 2 + dscan);
    const anchor = flip ? baseY : baseY - ch;
    const tops = [anchor];
    for (let dscan = 10; dscan <= 120; dscan += 10) tops.push(flip ? anchor + dscan : anchor - dscan);
    for (const t of tops) {
      for (const l of lefts) {
        if (fits(k, l, t)) return { scale: k, left: l, top: t };
      }
    }
  }
  // pathological content (should not happen) — center it small
  const k = k0 * 0.3;
  return { scale: k, left: (W - bw * k) / 2, top: (H - bh * k) / 2 };
}

// ── the bake (sharp) ───────────────────────────────────────────────────────
async function bakeCut(buf, { flip = false } = {}) {
  const sharp = require('sharp');
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width; const h = info.height;
  let cut = dieCutAlpha(data, w, h);
  let fullBleed = false;
  if (!cut.bbox || cut.removed < MIN_REMOVED) {
    fullBleed = true;
    for (let p = 3; p < data.length; p += 4) data[p] = 255;
    cut = { removed: 0, bbox: { x0: 0, y0: 0, x1: w - 1, y1: h - 1 } };
  }
  const cream = fullBleed ? { ...CREAM } : rimColor(data, w, h);
  const plan = inscribePlan(data, w, h, cut.bbox, { flip });
  const bw = cut.bbox.x1 - cut.bbox.x0 + 1;
  const bh = cut.bbox.y1 - cut.bbox.y0 + 1;
  const piece = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: cut.bbox.x0, top: cut.bbox.y0, width: bw, height: bh })
    .resize(Math.max(1, Math.round(bw * plan.scale)), Math.max(1, Math.round(bh * plan.scale)), { fit: 'fill' })
    .png().toBuffer();
  // the cream ground IS the exact slot triangle; the card lies on it and the
  // final mask re-cuts the same triangle, so the edge is always cream
  const pts = flip ? `0,0 ${CUT_W},0 ${CUT_W / 2},${CUT_H}` : `${CUT_W / 2},0 ${CUT_W},${CUT_H} 0,${CUT_H}`;
  const triSvg = (fill) => Buffer.from(
    `<svg width="${CUT_W}" height="${CUT_H}" xmlns="http://www.w3.org/2000/svg"><polygon points="${pts}" fill="${fill}"/></svg>`);
  const creamHex = '#' + [cream.r, cream.g, cream.b].map((v) => v.toString(16).padStart(2, '0')).join('');
  const out = await sharp({
    create: { width: CUT_W, height: CUT_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: triSvg(creamHex), left: 0, top: 0 },
      { input: piece, left: Math.round(plan.left), top: Math.round(plan.top) },
      { input: triSvg('#fff'), blend: 'dest-in' },
    ])
    .webp({ quality: 90 }).toBuffer();
  return { buf: out, fullBleed };
}

module.exports = { dieCutAlpha, rimColor, inscribePlan, insetTri, bakeCut, cutPath,
  CUT_W, CUT_H, NEAR_WHITE, MIN_REMOVED, MIN_BORDER, CREAM, CUT_VERSION };
