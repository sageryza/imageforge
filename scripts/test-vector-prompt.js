#!/usr/bin/env node
// The house prompt must not drift.
//
//   node scripts/test-vector-prompt.js
//
// The whole promise of `HOUSE` in vector.js is that a sheet made today comes
// out in the same style as the Gravity Lock cards. That promise is checkable
// exactly: rebuild the sheet-A prompt from its four descriptions and assert it
// is BYTE-IDENTICAL to the prompt banked in cards-manifest.json.
//
// It is easy to break by accident and it already nearly was — generalising the
// grid clause from four cells to any number changed "its own quarter" to "its
// own cell", which reads like a tidy-up and is a different prompt. A 2x2 says
// "quarter"; every other layout says "cell".
//
// Needs no network, no credential and no model call.
const fs = require('fs');
const path = require('path');
const { sheetPrompt, LAYOUT, positions } = require('../vector');

const MANIFEST = path.join(__dirname, '..', 'docs', 'gravity-lock', 'cards-manifest.json');
let failed = 0;
const ok = (name, cond, detail) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`);
  if (!cond) { failed++; if (detail) console.log('       ' + detail); }
};

// 1 — the 2x2 prompt is exactly the one sheet A was drawn with
const cards = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const sheetA = cards.find((c) => c.sheet === 'a');
const body = sheetA.prompt.split('frames. ')[1]
  .replace(' Absolutely no text, no words, no letters, no numbers, no captions.', '');
const draws = body.split(/(?:TOP LEFT|TOP RIGHT|BOTTOM LEFT|BOTTOM RIGHT): /).slice(1)
  .map((x) => x.replace(/\.\s*$/, ''));
const rebuilt = sheetPrompt(draws.map((d) => ({ draw: d })));
let where = '';
if (rebuilt !== sheetA.prompt) {
  for (let i = 0; i < Math.max(rebuilt.length, sheetA.prompt.length); i++) {
    if (rebuilt[i] !== sheetA.prompt[i]) {
      where = `first difference at ${i}\n         built: ${JSON.stringify(rebuilt.slice(i - 40, i + 40))}\n         card : ${JSON.stringify(sheetA.prompt.slice(i - 40, i + 40))}`;
      break;
    }
  }
}
ok('the 2x2 prompt is byte-identical to the real sheet A', rebuilt === sheetA.prompt, where);

// 2 — every layout tiles, and 5/7/8 round up rather than being refused
for (const [n, [cols, rows]] of Object.entries(LAYOUT)) {
  ok(`${n} drawings -> a ${cols}x${rows} grid that holds them`, cols * rows >= Number(n));
}

// 3 — positions are unique and match the cell count
for (const [n, [cols, rows]] of Object.entries(LAYOUT)) {
  const at = positions(cols, rows);
  ok(`${cols}x${rows} names ${cols * rows} distinct cells`,
    at.length === cols * rows && new Set(at).size === at.length, at.join(' | '));
}

// 4 — the caller's words survive verbatim, and the no-text rule is LAST
const p = sheetPrompt([{ draw: 'a snail with a spiral shell' }, { draw: 'a paper aeroplane' }]);
ok('the caller\'s words are in the prompt unchanged', p.includes('a snail with a spiral shell'));
ok('the no-text suffix is at the very end', p.trim().endsWith('Absolutely no text, no words, no letters, no numbers, no captions.'));

// 5 — one drawing is not a grid of one
const one = sheetPrompt([{ draw: 'a single mushroom' }]);
// "no grid, no borders, no frames" is IN the single clause, so the check is
// that no grid is REQUESTED ("a grid of …"), not that the word never appears.
ok('a single drawing requests no grid layout',
  !/grid of /.test(one) && one.includes('ONE small illustration'));

console.log(failed ? `\n${failed} check(s) failed` : '\nthe house prompt is intact');
process.exit(failed ? 1 : 0);
