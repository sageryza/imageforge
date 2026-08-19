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

const hits = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) { walk(full); continue; }
    if (!name.endsWith('.js') || full === __filename) continue;
    fs.readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
      if (CALL.test(line)) hits.push(`${path.relative(ROOT, full)}:${i + 1}  ${line.trim()}`);
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
console.log('PASS: no generation call sets output_compression (originals stay full quality)');
