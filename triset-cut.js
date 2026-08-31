// Triset — the DIE-CUT (2026-08-30, Sophie, looking at the fixed-geometry
// page cut cropping into the art: "they shud have a cream border ·
// equilateral · the whole image plus outline needs to fit in the triangle ·
// fix the cutting").
//
// The model draws each card WITH its own cream paper border and hand-drawn
// frame line, on a plain white background — but it draws the triangle at a
// slightly different size, position and steepness every time, so any fixed
// mapping (the first cut assumed apex 50%/19.3%, base 92%) crops into some
// cards' art and zooms past other cards' borders. The page cannot know where
// the drawn triangle is; the CUT has to be measured per image.
//
// So every card gets a baked cut copy — a derived display copy, the webp
// rule; the original is never touched:
//   1. Flood-fill the white background to transparent from the edges (the
//      fill stops at the drawn card's own painted edge, so wobbly hand-drawn
//      sides survive exactly — no ideal-triangle mask shaving them).
//   2. Measure the remaining content's bbox — the whole drawn card, cream
//      border and outline included.
//   3. Fit that bbox inside an equilateral-triangle canvas (1000x866, the
//      board slot's exact aspect), scaled to FIT of the slot triangle about
//      its centroid, base-aligned (point-up) or top-aligned (point-down).
//      Contain-fit: a steeper or flatter drawn card is scaled DOWN to fit,
//      never cropped — the whole image plus outline fits in the triangle.
//   4. Transparent everywhere else — the page paper shows through, which
//      reads as the gap between cards. THE ONLY CREAM BORDER IS THE PAPER
//      RIM THE MODEL DREW INTO THE PICTURE (2026-08-31, Sophie: "there shud
//      be no cream border aside from the one built into the images"); a mat
//      behind the card would be a second band of a different cream around
//      the one that is already there. So the cut must keep the drawn rim —
//      that is what step 1's flood fill stops at, and what FIT leaves room
//      for — and the page must put nothing behind it.
//
// A card with no white background to remove (a full-bleed draw — the model
// ignored the border clause) falls back to masking with the ideal triangle:
// a guaranteed triangle beats a square on the board, and nothing is lost —
// the original is still on the doc.
//
// Bakes run server-side for a made card (render(), right after the paid
// bytes are banked) and via POST /api/triset/recut for the pool;
// scripts/triset-recut.js runs the same bake from a container. ~1MP decode,
// nothing like the 4K sheet cuts — no gate needed.
//
// Tests: node scripts/test-triset.js (dieCutAlpha + fitBox pure on synthetic
// images, bakeCut end-to-end through real sharp).

const CUT_W = 1000;
const CUT_H = 866;              // 1000 * sqrt(3)/2 — exactly equilateral
const FIT = 0.96;               // the drawn card's share of the slot triangle
const NEAR_WHITE = 238;         // r,g,b all >= this reads as the paper behind the card
const MIN_REMOVED = 0.08;       // less background than this = a full-bleed draw
const CUT_VERSION = 'c1';       // objects are immutable — bump to re-bake past the CDN

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

// ── pure: where the measured card lands on the triangle canvas ─────────────
// Contain-fit the content bbox inside the slot triangle scaled by FIT about
// its centroid; centered, base-aligned (up) / top-aligned (down) — a wobbly
// base sits ON the mat's base line, and a narrower/steeper card centers with
// even cream at its sides.
function fitBox(bbox, { flip = false, W = CUT_W, H = CUT_H, fit = FIT } = {}) {
  const bw = bbox.x1 - bbox.x0 + 1;
  const bh = bbox.y1 - bbox.y0 + 1;
  const scale = Math.min((W * fit) / bw, (H * fit) / bh);
  const width = Math.max(1, Math.round(bw * scale));
  const height = Math.max(1, Math.round(bh * scale));
  const left = Math.round((W - width) / 2);
  // centroid: up (base at H) sits at 2H/3; down (base at 0) at H/3
  const top = flip
    ? Math.round((H / 3) * (1 - fit))                       // inner top edge
    : Math.round(2 * H / 3 + (H / 3) * fit - height);       // inner base, up
  return { left, top, width, height };
}

// ── the bake (sharp) ───────────────────────────────────────────────────────
async function bakeCut(buf, { flip = false } = {}) {
  const sharp = require('sharp');
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width; const h = info.height;
  let cut = dieCutAlpha(data, w, h);
  let fullBleed = false;
  if (!cut.bbox || cut.removed < MIN_REMOVED) {
    // full-bleed draw — mask with the ideal triangle so the board still gets
    // a triangle; alpha back to opaque first (the partial fill is undone)
    fullBleed = true;
    for (let p = 3; p < data.length; p += 4) data[p] = 255;
    const pts = flip ? `0,0 ${w},0 ${w / 2},${h}` : `${w / 2},0 ${w},${h} 0,${h}`;
    const mask = Buffer.from(
      `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><polygon points="${pts}" fill="#fff"/></svg>`);
    const masked = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
      .composite([{ input: mask, blend: 'dest-in' }]).raw().toBuffer();
    masked.copy(data);
    cut = { removed: 0, bbox: { x0: 0, y0: 0, x1: w - 1, y1: h - 1 } };
  }
  const box = fitBox(cut.bbox, { flip });
  const piece = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({
      left: cut.bbox.x0, top: cut.bbox.y0,
      width: cut.bbox.x1 - cut.bbox.x0 + 1, height: cut.bbox.y1 - cut.bbox.y0 + 1,
    })
    .resize(box.width, box.height)
    .png().toBuffer();
  const out = await sharp({
    create: { width: CUT_W, height: CUT_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: piece, left: box.left, top: box.top }])
    .webp({ quality: 90 }).toBuffer();
  return { buf: out, fullBleed };
}

module.exports = { dieCutAlpha, fitBox, bakeCut, cutPath, CUT_W, CUT_H, FIT, NEAR_WHITE, MIN_REMOVED, CUT_VERSION };
