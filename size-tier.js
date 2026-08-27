/**
 * THE THIRD CAPTION SLOT IS THE TIER, NOT THE PIXELS (Aug 2026, Sophie:
 * "i asked for it to say 1k 2k or 4k"). The first cut of this wrote the raw
 * canvas — "gpt-image-2 · medium · 1568x2352" — which is the FACT but not the
 * thing she reads a caption for: she wants to know which rung it was drawn on.
 *
 * Both are kept. `size` on a record is the tier ("2K") and is what every
 * caption shows; `canvas` is the exact "1568x2352", because 2K portrait and 2K
 * square are different canvases at different prices and throwing that away
 * would lose real information.
 *
 * The tier is DERIVED FROM PIXEL COUNT, never a lookup table, so a canvas
 * nobody has drawn before still lands on a rung. The boundaries are the
 * geometric midpoints between the tiers as measured in docs/modules/pictures.md
 * (1K ≈ 1.0-1.6MP, 2K ≈ 3.69MP, 4K ≈ 8.2-8.3MP), which is what puts every
 * shape of a tier on the same rung: 1568x2352, 1920x1920 and 2560x1440 are all
 * 3.69 megapixels and all read "2K".
 *
 * SERVED TO THE PAGE AS WELL (2026-08-27, at `/size-tier.js` — the
 * `pause-plan.js` pattern). The Playground draws its own caption client-side
 * from the run doc, and for four days it drew one with no size slot at all
 * while the pictures it FILED carried the right one — the required slot was
 * built into the filing path and the on-screen caption was never in scope.
 * A hand-copied tier table in the page would drift from these boundaries the
 * day they move, so the page calls this file rather than a transcript of it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.__sizeTier = factory();
}(typeof self !== 'undefined' ? self : this, function () {
const T1 = 2_400_000;   // sqrt(1.57M × 3.69M) — the 1K|2K midpoint
const T2 = 5_500_000;   // sqrt(3.69M × 8.19M) — the 2K|4K midpoint

/** "1568x2352" → "2K". Anything unparseable → null, never a guess. */
function tierOf(canvas) {
  const m = /^\s*(\d+)\s*[x×]\s*(\d+)\s*$/i.exec(String(canvas || ''));
  if (!m) return null;
  const px = Number(m[1]) * Number(m[2]);
  if (!px) return null;
  return px < T1 ? '1K' : px < T2 ? '2K' : '4K';
}

/**
 * What the caption's third slot shows, given whatever is on the record.
 * Accepts a canvas ("1568x2352" → "2K"), a tier already ("2k" → "2K"), or
 * nothing. An unrecognised value is passed through rather than dropped — a
 * record that says something we did not anticipate should still say it.
 */
function captionSize(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (/^[124]k$/i.test(s)) return s.toUpperCase();
  return tierOf(s) || s;
}

/**
 * A PANEL CUT OUT OF A SHEET SAYS SO (Aug 2026, Sophie: "1/4 panel could say
 * 1/4 (4k)"). Deriving the tier from the panel's OWN pixels is true but
 * useless here — a quarter of a 4K sheet is 1168x1752, which lands on the 1K
 * rung and reads as an ordinary small picture, losing the one fact that
 * explains what it is and what it cost. So a cut panel's slot is the fraction
 * and the SHEET's tier: "1/4 (4K)".
 *
 * It passes through `captionSize` untouched (it is neither a bare tier nor a
 * canvas), so nothing downstream has to know about it — the auto-compare rows
 * print it as-is, which is what makes "1/4 (4K)" vs "1/4 (2K)" the diff on a
 * sheet comparison.
 *
 *   cutSize('2336x3504', 4)  →  '1/4 (4K)'
 */
function cutSize(sheetCanvas, parts) {
  const n = Math.round(Number(parts) || 0);
  if (n < 2) return captionSize(sheetCanvas);   // not a cut — it IS the sheet
  const tier = tierOf(sheetCanvas);
  return tier ? `1/${n} (${tier})` : `1/${n}`;
}

/**
 * The caption's third slot for a whole RUN, given the run doc the Playground
 * already stores. One reader for both shapes, because the page and the server
 * must never disagree about what a picture is: a panels run is a cut of its
 * SHEET ("1/4 (4K)"), anything else is its own tier ("2K").
 *
 * A run whose cut FAILED is the sheet itself — one picture, uncut — so it takes
 * the sheet's own tier rather than a fraction of a thing that was never cut.
 *
 *   runSize({ res:'4k' })                                   → '4K'
 *   runSize({ size:'2336x3504', grid:{count:4} })           → '1/4 (4K)'
 *   runSize({ size:'2336x3504', grid:{count:4}, cutFailed:true }) → '4K'
 */
function runSize(run) {
  const r = run || {};
  const sheet = r.size || r.canvas || '';
  const n = r.grid && r.grid.count;
  if (n > 1 && !r.cutFailed) return cutSize(sheet, n);
  return captionSize(r.res || sheet);
}

return { tierOf, captionSize, cutSize, runSize };
}));
