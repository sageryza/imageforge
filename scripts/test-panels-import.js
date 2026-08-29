'use strict';
// test-panels-import.js — the container-sheet import's decision table
// (2026-08-28, Sophie: "the playground is for me, but panels should go in
// panels"). Pure, no network. Run: node scripts/test-panels-import.js
const assert = require('assert');
const { buildImportRun } = require('../panels-import');

const NOW = Date.parse('2026-08-28T22:00:00Z');
const OPTS = { styleIds: ['evan', 'dreamy', 'plain'], now: NOW };
const IMG = (n) => Array.from({ length: n }, (_, i) => `https://x/cut-${i}.webp`);
const ok = (over) => buildImportRun(Object.assign({
  panels: ['a', 'b', 'c', 'd'], images: IMG(4), grid: { across: 2, down: 2 },
  style: 'dreamy', quality: 'medium', res: '4k', size: '1920x1920',
  aspectRatio: '1:1', createdAt: NOW - 1000,
}, over), OPTS);

// the happy path — a done panels run the tabs can tell apart
{
  const { run, createdMs, error } = ok({});
  assert.ok(!error, 'valid import builds: ' + error);
  assert.strictEqual(run.status, 'done', 'imported runs are done — nothing left to do');
  assert.strictEqual(run.imported, true, 'the record says it was imported');
  assert.strictEqual(run.grid.count, 4);
  assert.strictEqual(run.prompt, 'a\nb\nc\nd', 'prompt joins the panels, like a real run');
  assert.strictEqual(run.images.length, 4);
  assert.strictEqual(createdMs, NOW - 1000, 'the real draw time is kept');
  // the kind rule that keeps this OUT of her Picture tab and IN the Panels tab
  const isPanels = !!(run.grid && run.grid.count) || !!(run.panels && run.panels.length);
  assert.ok(isPanels, 'an imported run reads as a panels run to both kind filters');
}

// PAIRING IS SACRED — a count mismatch is refused, never padded or truncated
assert.ok(/pair up/.test(ok({ images: IMG(3) }).error),
  'fewer images than panels is refused');
assert.ok(/pair up/.test(ok({ panels: ['a', 'b', 'c'] }).error),
  'fewer panels than images is refused');

// NEVER STAMPED AHEAD OF NOW (the playground-bump lesson)
assert.ok(/future/.test(ok({ createdAt: NOW + 60000 }).error),
  'a future createdAt is refused');
assert.strictEqual(ok({ createdAt: undefined }).createdMs, NOW,
  'absent createdAt lands on now');
assert.ok(ok({ createdAt: 123 }).error, 'a nonsense epoch is refused');

// THE STYLE IS VALIDATED, NEVER GUESSED
assert.ok(/unknown style/.test(ok({ style: 'watercolour' }).error),
  'an unknown style is refused, not defaulted');
assert.ok(/quality/.test(ok({ quality: 'max' }).error), 'a made-up quality is refused');

// urls must be real
assert.ok(/https/.test(ok({ images: ['https://x/a.webp', 'http://x/b.webp', 'https://x/c.webp', 'https://x/d.webp'] }).error),
  'a non-https image is refused');
assert.ok(/https/.test(ok({ sheetUrl: 'ftp://x/sheet' }).error), 'a bad sheetUrl is refused');

// grid sanity: panels may be fewer than the cells (discarded fillers), never more
{
  const r = ok({ panels: ['a', 'b', 'c'], images: IMG(3), grid: { across: 2, down: 2 } });
  assert.ok(!r.error, 'three kept panels from a 2x2 sheet is fine (a filler cut was dropped)');
  assert.strictEqual(r.run.grid.count, 4, 'the grid stays the sheet’s own');
}
assert.ok(ok({ grid: { across: 3, down: 1 }, panels: ['a', 'b', 'c', 'd'], images: IMG(4) }).error,
  'more panels than cells is refused');

// optional fields stay absent, never empty strings on the doc
{
  const { run } = buildImportRun({
    panels: ['a'], images: IMG(1), grid: { across: 1, down: 1 },
    style: 'plain', quality: 'low',
  }, OPTS);
  ['res', 'size', 'sheet', 'aspectRatio', 'sheetUrl', 'fullPrompt', 'chat', 'cast']
    .forEach((k) => assert.ok(!(k in run), `absent ${k} is left off the doc`));
}

// fullPrompt rides verbatim when given; chat attribution is kept
{
  const { run } = ok({ fullPrompt: 'THE EXACT TEXT', chat: 'meteorite-story' });
  assert.strictEqual(run.fullPrompt, 'THE EXACT TEXT');
  assert.strictEqual(run.chat, 'meteorite-story');
}

console.log('test-panels-import: all good — pairing, time, style and url rules hold');
