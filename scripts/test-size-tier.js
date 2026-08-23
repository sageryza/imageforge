#!/usr/bin/env node
/*
 * test-size-tier.js — the caption's third slot is the TIER (Aug 2026, Sophie:
 * "1K 2K 4K should be a third slot in the model/quality required tagging" →
 * then, on the first cut, which wrote the raw canvas: "i asked for it to say
 * 1k 2k or 4k").
 *
 * The rung is derived from pixel count rather than looked up, so the thing to
 * pin is that EVERY shape of a tier lands on the same rung — 1568x2352,
 * 1920x1920 and 2560x1440 are all 3.69 megapixels and must all read "2K" — and
 * that the boundaries sit between the measured tiers rather than on one.
 *
 *   node scripts/test-size-tier.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { tierOf, captionSize } = require(path.join(__dirname, '..', 'size-tier'));

let n = 0;
const is = (got, want, what) => { assert.strictEqual(got, want, what); n++; };

// Every canvas the Playground can draw, all three shapes per tier.
[['1024x1536', '1K'], ['1536x1024', '1K'], ['1024x1024', '1K'], ['1280x720', '1K'],
 ['1568x2352', '2K'], ['2352x1568', '2K'], ['1920x1920', '2K'], ['2560x1440', '2K'],
 ['2336x3504', '4K'], ['3504x2336', '4K'], ['2880x2880', '4K'], ['3840x2160', '4K'],
].forEach(([c, want]) => is(tierOf(c), want, c + ' → ' + want));

// The same megapixels in three shapes are ONE rung — the whole point.
is(new Set(['1568x2352', '1920x1920', '2560x1440'].map(tierOf)).size, 1,
  'the three 3.69MP canvases share a rung');
is(new Set(['2336x3504', '2880x2880', '3840x2160'].map(tierOf)).size, 1,
  'and so do the three at the 8.2MP end');

// Unparseable is NULL, never a guess — the same rule the quality caption obeys.
[null, '', 'big', '1568', 'x', '0x0'].forEach((v) =>
  is(tierOf(v), null, JSON.stringify(v) + ' → null'));

// captionSize takes whatever is on a record: a canvas, a tier already, or junk.
is(captionSize('1568x2352'), '2K', 'a canvas normalises to its tier');
is(captionSize('1568×2352'), '2K', 'and so does the × spelling');
is(captionSize('2k'), '2K', 'a tier already on the record is just cased');
is(captionSize('4K'), '4K', 'already right, left alone');
is(captionSize(''), '', 'nothing in, nothing out — an absent slot is left out');
is(captionSize(null), '', 'null too');
// An unrecognised value is PASSED THROUGH rather than dropped: a record that
// says something we did not anticipate should still say it.
is(captionSize('poster'), 'poster', 'an unknown value survives rather than vanishing');

// The readers agree — meta-assets builds the caption from the same helper.
const meta = fs.readFileSync(path.join(__dirname, '..', 'meta-assets.js'), 'utf8');
assert(/sizeTier\.captionSize\(c\.size\)/.test(meta),
  'meta-assets normalises on READ, so old records need no backfill');
n++;
// …and iOS carries its own copy, because the gallery reads Firestore directly
// and never sees the server's read-side fix.
const swift = fs.readFileSync(
  path.join(__dirname, '..', 'ios', 'ImageForge', 'Models.swift'), 'utf8');
assert(/static func sizeTier/.test(swift) && /2_400_000/.test(swift) && /5_500_000/.test(swift),
  'iOS has the same normaliser with the same boundaries');
assert(/\[model, quality, Creation\.sizeTier\(size\)\]/.test(swift),
  'and madeWith runs the size through it');
n += 2;

console.log('test-size-tier: all good — ' + n + ' assertions');
