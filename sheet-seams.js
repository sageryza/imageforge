/**
 * WHERE THE SHEET ACTUALLY DIVIDES — image-aware cut lines for Panels.
 *
 * Sophie, 2026-08-25: "the cutting doesn't cut on the right lines because
 * it's using math, but the image generation is not exact so it needs to use
 * some different sort of mechanism that's actually aware and looks at the
 * picture."
 *
 * She is right about the cause: gpt-image-2 draws the gutters ROUGHLY where
 * the grid sentence asks, not exactly — a 2x2 sheet's vertical gutter can sit
 * a few percent off the mathematical half, so an exact-halves crop shaves one
 * panel's border and carries a sliver of its neighbour. This module LOOKS at
 * the sheet: near each mathematical line it finds the drawn gutter — the
 * bright band of paper between the panels — and moves the cut into its
 * middle.
 *
 * HOW: a mean-ink profile per column (and per row), ink = 255 - luminance.
 * Two kinds of drawn boundary exist on her real sheets (both measured live,
 * 2026-08-25):
 *   a GUTTER — a band of paper between framed panels: a VALLEY in the
 *     profile, far lighter than the panels either side (the 9-grid sheets);
 *   a BORDER — full-bleed panels butting on one drawn line: a narrow PEAK,
 *     because that line runs the whole length of the sheet and lifts its
 *     column's mean where no ordinary drawing does (the 2x2 sheet whose row
 *     border sat 8px off the math line at mean ink 184 against a 147 field).
 * The gutter is preferred (a cut through paper costs nothing); the border is
 * cut ON, so each panel keeps half of it.
 *
 * THE QUALIFYING TESTS ARE THE LOAD-BEARING HALF. The extremum alone is not
 * enough: on busy full-bleed art, any lighter patch has darker flanks, and on
 * a hard two-tone step the "minimum" is just the lighter side — both would
 * move the cut INTO a panel (the first cut of this module did exactly that,
 * measured on the cat sheet: a false valley 149px into the picture). So:
 *   a valley must be flanked by markedly darker material on BOTH sides AND
 *     its floor must be genuinely paper-light against the whole profile
 *     (<= PAPER_FRAC of the profile's median);
 *   a peak must stand markedly above BOTH its flanks.
 * Anything less convincing keeps the mathematical line — the old behaviour —
 * so this module's failure mode is "no better than before", never "worse".
 * Flanks are looked for a little beyond the search window on purpose: a
 * gutter drawn right at the window's edge still has its neighbouring panel
 * just outside it.
 *
 * THE CUT LANDS IN THE VALLEY'S MIDDLE, not at its argmin — a gutter is many
 * pixels of near-equal paper and the argmin inside it is noise; the middle
 * splits the gutter evenly between the two panels, which is what makes both
 * keep their drawn border.
 *
 * Pure and dependency-free on purpose: it takes a raw grayscale buffer, so
 * the tests build sheets as bytes and need neither sharp nor the network.
 */

// How far from the mathematical line a gutter is looked for, as a fraction of
// the CELL dimension. 12% of a 1168px cell is ±140px — generous for the drift
// actually seen, small enough that the window cannot reach the middle of a
// panel and mistake a pale sky for the gutter.
const WINDOW_FRAC = 0.12;
// A seam only moves for a real valley: the best column must be at least this
// much lighter (mean-ink units, 0-255) than the darkest column in BOTH of its
// flanks…
const VALLEY_MARGIN = 12;
// …and its floor must read as PAPER against the sheet as a whole. Measured on
// the false valley that shipped first: floor 121 against a median of 145 —
// obviously still drawing; a real gutter's floor sat under half the median.
const PAPER_FRAC = 0.6;
// A border line must stand at least this far above BOTH of its flanks' means.
// Measured: the real one was +37; ordinary drawing never lifts a whole
// column's mean like that.
const PEAK_MARGIN = 18;
// Columns within this of the extremum count as the same gutter/border — the
// run whose MIDDLE the cut lands on.
const FLAT_EPS = 1.5;
// Smoothing radius over the profile, so one noisy column cannot win.
const SMOOTH = 2;

/** Mean ink per column (axis 'x') or per row (axis 'y'). */
function inkProfile(data, width, height, axis) {
  const n = axis === 'x' ? width : height;
  const out = new Float64Array(n);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const ink = 255 - data[row + x];
      if (axis === 'x') out[x] += ink; else out[y] += ink;
    }
  }
  const div = axis === 'x' ? height : width;
  for (let i = 0; i < n; i++) out[i] /= div;
  return out;
}

function smoothed(profile, i) {
  let sum = 0, count = 0;
  for (let d = -SMOOTH; d <= SMOOTH; d++) {
    const j = i + d;
    if (j >= 0 && j < profile.length) { sum += profile[j]; count++; }
  }
  return sum / count;
}

/** The flat run of near-equal ink around an extremum — the gutter's or the
 *  border's own extent. Allowed to run past the window: one drawn at the
 *  window's edge is still real. `dir` is +1 for a valley, -1 for a peak. */
function flatRun(profile, best, bestInk, span, dir) {
  let a = best, b = best;
  const near = (v) => (dir > 0 ? v <= bestInk + FLAT_EPS : v >= bestInk - FLAT_EPS);
  while (a - 1 >= Math.max(1, best - span) && near(smoothed(profile, a - 1))) a--;
  while (b + 1 <= Math.min(profile.length - 2, best + span) && near(smoothed(profile, b + 1))) b++;
  return { a, b };
}

function flankStats(profile, a, b, span) {
  let maxL = -Infinity, maxR = -Infinity, sumL = 0, nL = 0, sumR = 0, nR = 0;
  for (let x = Math.max(1, a - span); x < a; x++) {
    const v = smoothed(profile, x); maxL = Math.max(maxL, v); sumL += v; nL++;
  }
  for (let x = b + 1; x <= Math.min(profile.length - 2, b + span); x++) {
    const v = smoothed(profile, x); maxR = Math.max(maxR, v); sumR += v; nR++;
  }
  return { maxL, maxR, meanL: nL ? sumL / nL : -Infinity, meanR: nR ? sumR / nR : -Infinity };
}

/**
 * One seam: the drawn gutter (or border line) nearest `center`, or `center`
 * itself when the window holds neither convincingly.
 * `median` is the whole profile's median ink — the paper test's yardstick.
 * Returns { at, moved } — `moved` is true only when the picture won.
 */
function findSeam(profile, center, halfWin, median) {
  const lo = Math.max(1, Math.round(center - halfWin));
  const hi = Math.min(profile.length - 2, Math.round(center + halfWin));
  if (hi - lo < 4) return { at: Math.round(center), moved: false };
  const span = Math.round(halfWin * 2);

  let vBest = center, vInk = Infinity, pBest = center, pInk = -Infinity;
  for (let x = lo; x <= hi; x++) {
    const v = smoothed(profile, x);
    // strict improvement, else prefer the candidate nearer the math line
    if (v < vInk - 1e-9
      || (Math.abs(v - vInk) < 1e-9 && Math.abs(x - center) < Math.abs(vBest - center))) {
      vBest = x; vInk = v;
    }
    if (v > pInk + 1e-9
      || (Math.abs(v - pInk) < 1e-9 && Math.abs(x - center) < Math.abs(pBest - center))) {
      pBest = x; pInk = v;
    }
  }

  // FIRST CHOICE: a paper gutter — a valley with dark flanks AND a floor that
  // is honestly paper against the whole sheet.
  if (vInk <= median * PAPER_FRAC) {
    const { a, b } = flatRun(profile, vBest, vInk, span, +1);
    const f = flankStats(profile, a, b, span);
    if (f.maxL >= vInk + VALLEY_MARGIN && f.maxR >= vInk + VALLEY_MARGIN) {
      const at = Math.round((a + b) / 2);
      return { at, moved: at !== Math.round(center) };
    }
  }

  // SECOND CHOICE: a drawn border line — a narrow band standing clear above
  // BOTH flanks' means. Cut ON it, so each panel keeps half the line.
  {
    const { a, b } = flatRun(profile, pBest, pInk, span, -1);
    const f = flankStats(profile, a, b, span);
    if (b - a <= span / 2
      && pInk >= f.meanL + PEAK_MARGIN && pInk >= f.meanR + PEAK_MARGIN) {
      const at = Math.round((a + b) / 2);
      return { at, moved: at !== Math.round(center) };
    }
  }

  return { at: Math.round(center), moved: false };
}

/**
 * Every internal boundary of an across x down grid, looked up in the picture.
 * data = one byte per pixel, grayscale, row-major.
 * Returns { xs, ys, moved } — xs has across+1 entries (0 and width included),
 * ys likewise; `moved` counts the seams the picture repositioned.
 */
function findSeams({ data, width, height, across, down }) {
  if (!data || !width || !height) throw new Error('sheet pixels required');
  const nA = Math.max(1, across | 0), nD = Math.max(1, down | 0);
  const xs = [0], ys = [0];
  let moved = 0;

  if (nA > 1) {
    const cols = inkProfile(data, width, height, 'x');
    const med = median(cols);
    const halfWin = (width / nA) * WINDOW_FRAC;
    for (let c = 1; c < nA; c++) {
      const s = findSeam(cols, (c * width) / nA, halfWin, med);
      xs.push(s.at); if (s.moved) moved++;
    }
  }
  xs.push(width);

  if (nD > 1) {
    const rows = inkProfile(data, width, height, 'y');
    const med = median(rows);
    const halfWin = (height / nD) * WINDOW_FRAC;
    for (let r = 1; r < nD; r++) {
      const s = findSeam(rows, (r * height) / nD, halfWin, med);
      ys.push(s.at); if (s.moved) moved++;
    }
  }
  ys.push(height);

  // seams must stay ordered — a pathological picture cannot produce an
  // inside-out crop, it just falls back to the math lines
  for (let i = 1; i < xs.length; i++) if (xs[i] <= xs[i - 1]) return mathSeams(width, height, nA, nD);
  for (let i = 1; i < ys.length; i++) if (ys[i] <= ys[i - 1]) return mathSeams(width, height, nA, nD);
  return { xs, ys, moved };
}

function median(profile) {
  const a = Array.from(profile).sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : 0;
}

function mathSeams(width, height, across, down) {
  const xs = []; const ys = [];
  for (let c = 0; c <= across; c++) xs.push(Math.round((c * width) / across));
  for (let r = 0; r <= down; r++) ys.push(Math.round((r * height) / down));
  return { xs, ys, moved: 0 };
}

/** Extract boxes in reading order from a seam set — sharp's `extract` shape. */
function seamBoxes({ xs, ys }) {
  const out = [];
  for (let r = 0; r < ys.length - 1; r++) {
    for (let c = 0; c < xs.length - 1; c++) {
      out.push({ left: xs[c], top: ys[r],
        width: xs[c + 1] - xs[c], height: ys[r + 1] - ys[r] });
    }
  }
  return out;
}

module.exports = { findSeams, seamBoxes, inkProfile, findSeam, mathSeams,
  WINDOW_FRAC, VALLEY_MARGIN, PEAK_MARGIN, PAPER_FRAC };
