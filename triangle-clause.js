'use strict';
/*
 * triangle-clause.js — the equilateral-triangle-card wording, ONE copy
 * (2026-08-31, Sophie: "add triangle as a new playground style · w image and
 * prompt w new equilateral").
 *
 * Two surfaces draw triangular cards and they must say the same thing:
 *   • TRISET (triset.js) — the matching game's own cards, where a MADE card
 *     (the venn center, the middle slot) is drawn point DOWN, so the clause
 *     takes an `invert`.
 *   • THE PLAYGROUND's Triangle tile — PL_GPT_STYLES.triangle in server.js,
 *     always point up, her words for the subject.
 * The wording lived in triset.js until the tile existed. It is here now so
 * neither surface holds a copy: a triangle card she likes in the game and one
 * she draws in the Playground are the same recipe, and a reword reaches both.
 *
 * BOTH ARE THE DREAMY RECIPE with its BORDER clause swapped for this one —
 * dreamy's tail names a rectangular hand-drawn frame and a triangle card needs
 * a triangle. That is the house swap-never-argue mechanism (never a second
 * sentence arguing with the first), and `swapTail` is its one implementation:
 * when server.js rewords the tail and the anchor stops matching, the triangle
 * clause is PREPENDED rather than lost, and the caller is told which happened.
 *
 * Pure — no express, no firebase, no network. Required by triset.js, by
 * server.js (for the tile), and by the tests.
 */

// EQUILATERAL is spelled out twice (2026-08-30, Sophie: "u didn't specify
// equalateral so the shapes are off") — the first batch came back as steep
// isosceles cards.
const ONE_ILLO = 'Render as ONE single illustration — NOT a grid, NOT split panels. ';
const IS_A = 'The illustration is an ';
const TRIANGLE_UP = 'point up — the flat side on the bottom, one corner at the top';
const TRIANGLE_DOWN = 'point down, upside down — the flat side on TOP, one corner at the bottom';

// `invert` draws the card point down — triset's made card (her rule: "the
// middle card has to be upside down"). The Playground tile never inverts.
function triangleClause(invert) {
  return ONE_ILLO + IS_A
    + 'EQUILATERAL TRIANGLE-SHAPED CARD, all three '
    + 'sides exactly the same length, ' + (invert ? TRIANGLE_DOWN : TRIANGLE_UP)
    + ': a triangle with a plain paper border and a hand-drawn frame line, '
    + 'like the frames in the style reference but triangular, on a plain '
    + 'white background, the whole composition inside the triangle. '
    // USE THE TRIANGLE (2026-08-31, Sophie on the redwood card: "perfect ·
    // use of triangle"). The one card she called perfect is the one whose
    // subject tapers into the shape — so the frame is not just a crop, it is
    // the composition. Cards drawn before this read as square pictures with
    // their corners cut off.
    + 'Compose the subject to USE the triangle: let it follow the sloping '
    + 'sides and reach into the corners, so the picture could not have been '
    + 'drawn square. ';
}
const TRIANGLE_CLAUSE = triangleClause(false);

// THE TILE'S OWN PANELS SWAP. Every gpt tile offers the Panels tab, and a
// sheet run swaps the style's anti-grid sentence for the grid one — dreamy's
// anchor is the border clause this module just consumed, so the Triangle tile
// needs its own or a panels run would ship two sentences arguing about the
// layout (applySheet no-ops on a missed anchor, which is the safe direction
// but leaves "NOT a grid" in a sheet prompt). `from` is BUILT from the same
// two constants the clause opens with, so it can never drift out of it.
const SHEET = {
  from: ONE_ILLO + IS_A,
  to: 'Render as {layout}. Each panel is its own separate complete '
    + 'illustration, and each one is an ',
};

/**
 * Swap `anchor` out of a tail for `replacement`, or PREPEND when the anchor is
 * gone (a reword in server.js, or her own edited tail — the clause is never
 * lost either way). → { tail, swapped }, because a caller that cares whether
 * the anchor still matches should be able to say so rather than guess.
 */
function swapTail(tail, anchor, replacement) {
  const s = String(tail == null ? '' : tail);
  if (anchor && s.includes(anchor)) {
    return { tail: s.split(anchor).join(replacement), swapped: true };
  }
  return { tail: replacement + s, swapped: false };
}

/**
 * THE PLAYGROUND TILE — PL_GPT_STYLES.triangle, derived from the dreamy entry
 * rather than transcribed beside it, so a reword of hers reaches this tile the
 * day she makes it (the same reason triset is handed the table instead of
 * copying it).
 *
 * What it keeps from dreamy: the REFERENCE IMAGE (refs/dream-mystery.jpg — her
 * ask, "w image"), the anti-content prefix, the rest of the tail (its own
 * anti-content bookend and the green-tank-top ban), and her no-text toggle,
 * whose clause sits after the border one and so survives the swap untouched.
 * What it replaces: the border clause → the equilateral triangle card.
 * noCharacter, like dreamy: her Sophie card is the watercolor look, and a
 * second reference in another style is what this prefix forbids.
 */
function triangleStyle(dreamy) {
  if (!dreamy) return null;
  const swap = swapTail(dreamy.suffix, dreamy.sheet && dreamy.sheet.from, TRIANGLE_CLAUSE);
  return {
    label: 'Triangle',
    refFiles: Array.isArray(dreamy.refFiles) ? dreamy.refFiles.slice() : [],
    prefix: String(dreamy.prefix || ''),
    suffix: swap.tail,
    noText: dreamy.noText ? { from: dreamy.noText.from, to: dreamy.noText.to } : null,
    sheet: { from: SHEET.from, to: SHEET.to },
    noCharacter: true,
    swapped: swap.swapped,
  };
}

module.exports = {
  ONE_ILLO, IS_A, TRIANGLE_UP, TRIANGLE_DOWN,
  triangleClause, TRIANGLE_CLAUSE, SHEET, swapTail, triangleStyle,
};
