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
 */
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

module.exports = { tierOf, captionSize };
