'use strict';
// pad-side.js — which SIDE of a beat a picture belongs on when the placing
// request names none (2026-08-26, Sophie: "the dance one went into the
// watercolor one, but it should be dreamy — isn't there some way that it
// could look at the metadata or the prompt to figure out which style it is").
//
// The case this exists for: the Story Room PAGE always sends the side she is
// showing, so a placement with no `style` at all is a CHAT seeding a story —
// and until this, styleOf() silently defaulted every one of those to
// watercolor. That is exactly how the nine dreamy Panels cuts of "The dance I
// joined by accident" (run bq7OvSE8uSjFDk7uKGgm, style:'dreamy') all landed
// on the watercolor side.
//
// The rule is playground-port's: a side is claimed by EVIDENCE — the
// picture's own run record (the Playground or Panels doc that drew it),
// never a guess from words. This file is the pure decision, dependency-free
// so `node scripts/test-pad-side.js` needs no node_modules; the Firestore
// reads that fetch the run docs live in scratchpad.js (sideFromEvidence).
//
// `styles` is scratchpad.js's own STYLES list — NOTHING COUNTS THE STYLES
// BUT THAT LIST, so this file holds no copy of it. A run style that names no
// pad side (evan, plain, scarry, hoonies — or a Replicate run, which has no
// gptStyle at all) answers null, which the caller reads as the pad's
// original side: the honest default, not a claim.

// The run doc's own style field: Panels stores `style`, a Playground
// gpt-image-2 run stores `gptStyle`. Only a value that IS a pad side counts.
function padSideOf(run, styles) {
  if (!run || !Array.isArray(styles)) return null;
  const s = String(run.style || run.gptStyle || '');
  return styles.includes(s) ? s : null;
}

// After a DERIVED placement (no side named), should the pad flip to show the
// side the art just landed on? Only when the story is showing a side with no
// art on any beat while the landed side now has some — a chat seeding a
// fresh story must not leave her opening it onto blank tiles, and a side she
// is actually using must never be flipped away from under her.
// `showingHasArt` / `landedHasArt` are booleans the caller measures off the
// real beats (slotFace over every beat's slot for that side).
function shouldReveal({ showing, landed, showingHasArt, landedHasArt }) {
  if (!landed || landed === showing) return false;
  return Boolean(landedHasArt) && !showingHasArt;
}

module.exports = { padSideOf, shouldReveal };
