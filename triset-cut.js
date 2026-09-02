// Triset — the DIE-CUT (2026-08-30 "fix the cutting"; settled 2026-08-31
// after four rounds, her words: "just recut the original").
//
// The model draws each card — art, frame line, cream paper rim — on a plain
// white square, at a slightly different size/steepness every time. The cut
// is a PERFECT EQUILATERAL WINDOW INTO THAT ORIGINAL: find the drawn card,
// choose the largest window placement that keeps every drawn pixel at least
// MIN_BORDER inside the triangle (base-anchored, centered — a narrow card
// gets its extra room at the sides, a squat one at the top, her rule), then
// extract that triangular region of the original square and mask it. The
// border around the drawn rim is the original's own paper — real pixels,
// real grain, no seam, because nothing is synthesized and nothing is
// composited.
//
// The roads not taken, each shipped for a day and rejected on sight:
//   c1 preserved the drawn shape (every cut a different triangle);
//   c2 cover-fit (a perfect triangle that CROPPED art — "cut straight to
//      the line");
//   c3/c4 contained the card and filled the triangle with sampled flat
//      cream ("did he just fill w flat color?" — yes, it was flat, and the
//      seam against the drawn rim showed as white lines until c4 hid it).
// Do not bring any of them back. The window IS the settled design: the one
// picture, recut.
//
// A full-bleed draw (art to the frame's edge, no paper to give) is
// cover-fit + mask — a guaranteed triangle with no border, honestly.
//
// Bakes run server-side for a made card (render(), right after the paid
// bytes are banked) and via POST /api/triset/recut for the pool;
// scripts/triset-recut.js runs the same bake from a container. ~1MP decode,
// nothing like the 4K sheet cuts — no gate needed.
//
// Tests: node scripts/test-triset.js (dieCutAlpha + inscribePlan pure,
// bakeCut end-to-end through real sharp, window fidelity checked against
// the source's own pixels).

const CUT_W = 1000;
const CUT_H = 866;              // 1000 * sqrt(3)/2 — exactly equilateral
const NEAR_WHITE = 238;         // r,g,b all >= this reads as the paper behind the card
const MIN_REMOVED = 0.08;       // less background than this = a full-bleed draw
const CUT_VERSION = 'c5';       // objects are immutable — bump to re-bake past the CDN
                                // c1 shape-preserving · c2 cover (cropped) · c3/c4 synthetic cream
                                // c5 = the equilateral WINDOW into the original

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

// ── pure: the fringe erode ─────────────────────────────────────────────────
// The flood fill stops at the first pixel darker than NEAR_WHITE, which
// leaves the ANTI-ALIASED half-white boundary pixels opaque — and once the
// card sits on the cream fill, that 1-2px fringe reads as a thin WHITE LINE
// tracing the original wobbly cut (2026-08-31, Sophie: "the original cut
// shows as white lines"). So the content's outer boundary is eroded a few
// pixels before placement: the fringe goes with it, cream meets clean rim,
// and the rim itself is ~20px deep so nothing that matters is lost. Interior
// highlights are untouched — they have no transparent neighbours.
const ERODE_PX = 3;

function erodeAlpha(data, w, h, n = ERODE_PX) {
  for (let pass = 0; pass < n; pass += 1) {
    const kill = [];
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const p = y * w + x;
        if (data[p * 4 + 3] === 0) continue;
        const clear = (x > 0 && data[(p - 1) * 4 + 3] === 0)
          || (x < w - 1 && data[(p + 1) * 4 + 3] === 0)
          || (y > 0 && data[(p - w) * 4 + 3] === 0)
          || (y < h - 1 && data[(p + w) * 4 + 3] === 0)
          || x === 0 || x === w - 1 || y === 0 || y === h - 1;
        if (clear) kill.push(p);
      }
    }
    for (const p of kill) data[p * 4 + 3] = 0;
  }
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

  // NO hard window-inside-frame constraint: the drawn cards fill ~950 of a
  // 1024 frame (measured on her real pool), so a border-keeping window MUST
  // hang past the frame's edges — bakeCut continues the overhang in the
  // frame's own measured paper colour, which against the flat white the
  // model draws on is invisible. (A hard constraint here sent every real
  // card to the cover fallback, silently — the c2 crop coming back.)
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
  // no bordered placement exists (art to the frame's edge, or the card
  // pressed against it) — fall back to a centered COVER window: the whole
  // triangle still shows original pixels, just without the margin
  const k = Math.max(W / w, H / h);
  const left = bbox.x0 * k - (w * k - W) / 2;
  const top = bbox.y0 * k - (h * k - H) / 2;
  return { scale: k, left, top, cover: true };
}

// ── the bake (sharp) ───────────────────────────────────────────────────────
async function bakeCut(buf, { flip = false } = {}) {
  const sharp = require('sharp');
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width; const h = info.height;
  // the flood fill runs on a COPY only to FIND the drawn card — the output
  // is cut from the untouched original
  const probe = Buffer.from(data);
  let cut = dieCutAlpha(probe, w, h);
  let fullBleed = false;
  if (!cut.bbox || cut.removed < MIN_REMOVED) {
    fullBleed = true;
    cut = { removed: 0, bbox: { x0: 0, y0: 0, x1: w - 1, y1: h - 1 } };
  }
  const plan = fullBleed
    ? (() => {                       // cover the triangle — no paper to give
      const k = Math.max(CUT_W / w, CUT_H / h);
      return { scale: k, left: -(w * k - CUT_W) / 2, top: -(h * k - CUT_H) / 2 };
    })()
    : inscribePlan(probe, w, h, cut.bbox, { flip });
  // the frame's own paper, measured off its outer ring — the window hangs a
  // little past the square frame (the drawn cards nearly fill it), and the
  // overhang continues in this colour: flat against the flat white the model
  // draws on, so the join is invisible and nothing about the look is invented
  const paper = (() => {
    const rs = []; const gs = []; const bs = [];
    const take = (x, y) => { const i = (y * w + x) * 4; rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]); };
    for (let x = 0; x < w; x += 7) { take(x, 2); take(x, h - 3); }
    for (let y = 0; y < h; y += 7) { take(2, y); take(w - 3, y); }
    const med = (a) => { a.sort((m, n) => m - n); return a[a.length >> 1]; };
    return { r: med(rs), g: med(gs), b: med(bs), alpha: 1 };
  })();
  // the slot canvas, mapped back into the source: one rectangular window on
  // the ORIGINAL (extended where it overhangs), resized, masked
  const k = plan.scale;
  const wx0 = Math.round(cut.bbox.x0 - plan.left / k);
  const wy0 = Math.round(cut.bbox.y0 - plan.top / k);
  const ww = Math.round(CUT_W / k);
  const wh = Math.round(CUT_H / k);
  const padL = Math.max(0, -wx0); const padT = Math.max(0, -wy0);
  const padR = Math.max(0, wx0 + ww - w); const padB = Math.max(0, wy0 + wh - h);
  const pts = flip ? `0,0 ${CUT_W},0 ${CUT_W / 2},${CUT_H}` : `${CUT_W / 2},0 ${CUT_W},${CUT_H} 0,${CUT_H}`;
  const mask = Buffer.from(
    `<svg width="${CUT_W}" height="${CUT_H}" xmlns="http://www.w3.org/2000/svg"><polygon points="${pts}" fill="#fff"/></svg>`);
  // two stages: sharp runs extract BEFORE extend inside one pipeline, so the
  // extended frame has to be materialised first
  const extended = await sharp(buf)
    .extend({ left: padL, top: padT, right: padR, bottom: padB, background: paper })
    .png().toBuffer();
  const out = await sharp(extended)
    .extract({ left: wx0 + padL, top: wy0 + padT, width: ww, height: wh })
    .resize(CUT_W, CUT_H, { fit: 'fill' })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .webp({ quality: 90 }).toBuffer();
  return { buf: out, fullBleed };
}

module.exports = { dieCutAlpha, erodeAlpha, rimColor, inscribePlan, insetTri, bakeCut, cutPath,
  CUT_W, CUT_H, NEAR_WHITE, MIN_REMOVED, MIN_BORDER, CREAM, CUT_VERSION };
