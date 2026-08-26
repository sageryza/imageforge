#!/usr/bin/env node
// WHICH SIDE A PLACED PICTURE LANDS ON — pad-side.js, pure, no node_modules.
// (2026-08-26, Sophie: "the dance one went into the watercolor one, but it
// should be dreamy — isn't there some way that it could look at the metadata
// or the prompt to figure out which style it is".)
//
// The rules:
//   1. a side is claimed only by the picture's own run record — Panels'
//      `style`, the Playground's `gptStyle` — and only when that value IS a
//      pad side; anything else (evan, plain, a Replicate run with no style
//      field at all) answers null, the pad's original side by default,
//   2. a DERIVED placement may flip the toggle onto its side, but only when
//      the showing side holds no art at all — a side she is using is never
//      flipped away from under her,
//   3. and the wiring: both placement routes ask styleNamed first (the page
//      always names the side she is showing) and derive only when nothing
//      was named — pinned against the source, or a refactor could quietly
//      put the watercolor default back.
//
//   node scripts/test-pad-side.js
const fs = require('fs');
const path = require('path');
const { padSideOf, shouldReveal } = require('../pad-side');

let failures = 0;
function ok(cond, name) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}
const STYLES = ['watercolor', 'dreamy', 'pastel'];

// ── 1. the run record claims a side, or honestly doesn't ────────────
ok(padSideOf({ style: 'dreamy' }, STYLES) === 'dreamy',
  'a Panels run drawn in dreamy claims the dreamy side (the dance case)');
ok(padSideOf({ gptStyle: 'dreamy' }, STYLES) === 'dreamy',
  'a Playground dreamy run claims it too (gptStyle)');
ok(padSideOf({ gptStyle: 'pastel' }, STYLES) === 'pastel',
  'pastel claims pastel');
ok(padSideOf({ gptStyle: 'evan' }, STYLES) === null,
  'sandy mirror (evan) names no side — null, the caller defaults');
ok(padSideOf({ gptStyle: 'plain' }, STYLES) === null,
  'the plain ChatGPT tile names no side');
ok(padSideOf({ engine: 'replicate', model: 'sageryza/watercolordrawings' }, STYLES) === null,
  'a Replicate run has no style field at all — null, never a guess');
ok(padSideOf(null, STYLES) === null, 'no run doc is no evidence');
ok(padSideOf({ style: 'dreamy' }, null) === null, 'no styles list answers null');
ok(padSideOf({ style: 'dreamy; DROP' }, STYLES) === null,
  'an unknown value is refused, never passed through');

// ── 2. the reveal flip is narrow ────────────────────────────────────
ok(shouldReveal({ showing: 'watercolor', landed: 'dreamy', showingHasArt: false, landedHasArt: true }) === true,
  'a fresh story showing a blank side flips to the side the art landed on');
ok(shouldReveal({ showing: 'watercolor', landed: 'dreamy', showingHasArt: true, landedHasArt: true }) === false,
  'a showing side with ANY art is never flipped away from');
ok(shouldReveal({ showing: 'dreamy', landed: 'dreamy', showingHasArt: false, landedHasArt: true }) === false,
  'landing on the side already showing flips nothing');
ok(shouldReveal({ showing: 'watercolor', landed: null, showingHasArt: false, landedHasArt: false }) === false,
  'no derived side, no flip');

// ── 3. the wiring in scratchpad.js ──────────────────────────────────
const src = fs.readFileSync(path.join(__dirname, '..', 'scratchpad.js'), 'utf8');
ok(/require\('\.\/pad-side'\)/.test(src), 'scratchpad.js reads the ONE copy of the rules');
const addRoute = src.slice(src.indexOf("router.post('/add'"), src.indexOf("router.post('/image'"));
const imgRoute = src.slice(src.indexOf("router.post('/image'"), src.indexOf('async function placeOnBeat'));
ok(/styleNamed\(req\)/.test(addRoute) && /sideFromEvidence\(/.test(addRoute),
  '/add asks styleNamed first and derives only when nothing was named');
ok(/styleNamed\(req\)/.test(imgRoute) && /sideFromEvidence\(/.test(imgRoute),
  '/image does the same');
ok(!/styleOf\(req\)/.test(addRoute) && !/styleOf\(req\)/.test(imgRoute),
  'neither placement route silently defaults through styleOf any more');
const evid = src.slice(src.indexOf('async function sideFromEvidence'), src.indexOf('function revealPatch'));
ok(/forge-panels/.test(src) && /PROMPTLAB/.test(evid),
  'the evidence reads the real run collections (panels + promptlab)');
ok(/catch/.test(evid), 'evidence is best-effort — a failed read never fails a placement');

process.exit(failures ? 1 : 0);
