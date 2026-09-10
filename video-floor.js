'use strict';
// video-floor.js — the pure half of "a reference is too small to send".
//
// MEASURED 2026-09-10, off Atlas Cloud's own refusal on her first /footage
// job with a video reference:
//
//   400 InvalidParameter.PixelCountTooSmall:
//   "Pixel count must be between 407696 and 8295044."
//
// The clip was an iPhone recording that iOS had shrunk to 480×360 = 172,800
// pixels on its way out of Photos through the web file picker — the phone's
// doing, not ours (the page sends raw bytes and the Dump stores video
// untouched). So a reference she picked in good faith is refused before
// anything draws, with an error that reads like a bug in the tool.
//
// The floor and the ceiling are ByteDance's, not Atlas's — the same model
// service sits behind all three doors — so this guard is door-agnostic.
//
// WHAT THIS FILE DECIDES AND WHAT IT DOES NOT. It answers one question:
// given a reference's real pixel dimensions, what canvas clears the floor?
// It never touches a file; footage.js bakes the copy. Two rules the plan
// keeps, both house rules rather than preferences:
//   · The ASPECT IS KEPT. A reference argues with the prompt as it is; a
//     guard that stretched it would change what she attached.
//   · The ORIGINAL IS NEVER REPLACED — footage.js sends a DERIVED copy and
//     leaves her Dump file alone (the webp rule, applied to video).
//
// IMAGES ARE DELIBERATELY NOT COVERED. A reference image has its own floor
// and nothing here has measured it; applying this number to stills would be
// a guess wearing a measurement's clothes. When one is refused for the same
// reason, measure it and give it its own entry.

// ByteDance's range, from the refusal text above.
const MIN_PIXELS = 407696;
const MAX_PIXELS = 8295044;

// A little air over the floor, so a rounding-to-even step can never land a
// pixel short of it and spend the round trip for nothing.
const MARGIN = 1.03;

const even = (n) => { const v = Math.round(n); return v % 2 ? v + 1 : v; };

// planUpscale(width, height) → null when the reference already clears the
// floor (the common case — nothing is baked and the original url is sent),
// else { w, h, pixels, from } naming the canvas to bake.
//
// Nonsense in (a probe that failed, a zero) answers null: this guard must
// never invent dimensions for a file it could not read.
function planUpscale(width, height) {
  const w0 = Math.floor(Number(width) || 0);
  const h0 = Math.floor(Number(height) || 0);
  if (w0 <= 0 || h0 <= 0) return null;
  const have = w0 * h0;
  if (have >= MIN_PIXELS) return null;
  // Above the ceiling is a different problem and not this one's; a clip
  // under the floor can never be near it, so nothing here scales down.
  let f = Math.sqrt((MIN_PIXELS * MARGIN) / have);
  let w = even(w0 * f);
  let h = even(h0 * f);
  // Rounding to even can still land short on a very lopsided shape; walk up
  // in even steps rather than trusting the arithmetic.
  let guard = 0;
  while (w * h < MIN_PIXELS && guard++ < 64) { w += 2; h = even((h0 / w0) * w); }
  if (w * h < MIN_PIXELS || w * h > MAX_PIXELS) return null;
  return { w, h, pixels: w * h, from: { w: w0, h: h0, pixels: have } };
}

// The one line the card says when a copy was baked. It is deliberately
// LOUD: a step that silently transforms what she attached is the thing the
// house rule forbids, so the job says what was really sent.
function upscaleNote(plan, name) {
  if (!plan) return '';
  const what = name ? `“${String(name).slice(0, 40)}”` : 'a reference clip';
  return `${what} was ${plan.from.w}×${plan.from.h} — under Seedance's floor, so an upscaled ${plan.w}×${plan.h} copy was sent. Your original is untouched.`;
}

module.exports = { MIN_PIXELS, MAX_PIXELS, MARGIN, planUpscale, upscaleNote };
