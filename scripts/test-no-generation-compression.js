#!/usr/bin/env node
/**
 * test-no-generation-compression.js — no generation call may compress.
 *
 * WHY. `output_compression` on an OpenAI images call is LOSSY and it is
 * applied by OpenAI BEFORE the bytes come back, so what it throws away is
 * gone for good: the original never existed at full quality on our side, and
 * no later pass can recover it. Only a re-draw can, and a re-draw of the same
 * prompt is a different picture.
 *
 * It was in this repo by a conflation with a rule that is still correct —
 * "never serve a raw generated PNG to a page" (CLAUDE.md). That rule is about
 * DERIVED DISPLAY COPIES: scripts/webp-assets.js, the `thumbs/` service in
 * server.js. Compressing the derivative is right; compressing the original at
 * birth is not. Sophie found it as graininess on fine ink hatching
 * (2026-08-19) — the worst case for lossy webp, and the house style is full
 * of it.
 *
 * Measured that day on one prompt, same words both times:
 *   with output_compression=80 →   281 KB
 *   without it                 → 1,667 KB   (5.9x the data)
 *
 * Pure, no network. Greps the tree so a copy-paste into a new module fails
 * here rather than silently costing a batch of originals.
 *
 *   node scripts/test-no-generation-compression.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'out', 'ios', 'voices', 'refs', 'docs']);
// This file names the parameter in prose; so does any file explaining the rule.
// Only an actual form.append / JSON field counts as a violation.
const CALL = /(?:form\.append\(\s*['"]output_compression['"]|output_compression\s*:)/;

// The FOUR shapes a lossy original sneaks in as (2026-08-19 — the first
// sweep only knew the first one, and the other three were found live the
// same day, on a second and third look Sophie asked for):
//   1  output_compression on an OpenAI images call
//   2  output_quality below 100 on a Replicate input — Flux's webp/jpg
//      encode is lossy at that quality (its default is 80); originals go
//      output_format png instead
//   3  a raw-pixel sharp reconstruction saved without `lossless` — the
//      whitenBackground shape, where the re-encode REPLACES the original
//   4  a bare `.webp()` anywhere — it silently defaults to lossy quality 80
// Display copies (the thumbs/ service, webp-assets.js, poster frames) stay
// lossy on purpose: they are DERIVED, and the original they derive from is
// untouched. Every one of them passes an explicit `quality:` on a resized
// copy, so none of these patterns matches them.
const CHECKS = [
  { name: 'output_compression on a generation call', re: CALL },
  { name: 'lossy output_quality on a Replicate input',
    re: /output_quality\s*:\s*(?!100\b)\d+/ },
  { name: 'raw-pixel re-encode without lossless (whitenBackground shape)',
    re: /raw:\s*\{[^}]*\}\s*\}\s*\)\s*\.webp\(\s*(?!\{\s*lossless)/ },
  { name: 'bare .webp() — silent default quality 80', re: /\.webp\(\s*\)/ },
];

const hits = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) { walk(full); continue; }
    if (!name.endsWith('.js') || full === __filename) continue;
    fs.readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
      for (const c of CHECKS) {
        if (c.re.test(line)) hits.push(`${path.relative(ROOT, full)}:${i + 1}  [${c.name}]  ${line.trim()}`);
      }
    });
  }
})(ROOT);

if (hits.length) {
  console.log('FAIL: a generation call is compressing its output —\n');
  hits.forEach((h) => console.log('  ' + h));
  console.log('\nThe original must come back at full quality. If a page needs a smaller');
  console.log('file, derive one (scripts/webp-assets.js, or the thumbs/ service in');
  console.log('server.js) and leave the original alone.');
  process.exit(1);
}
console.log('PASS: no generation path is lossy — no output_compression, no lossy output_quality, no unguarded raw re-encode, no bare .webp() (originals stay full quality)');
