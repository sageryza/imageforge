#!/usr/bin/env node
/* HER PLAYGROUND TRIANGLE HEARTS, AS A STANDING PAGE (2026-09-03, Sophie:
 * "upgrade ur playground hearts page to auto update as i add new cards,
 * showing newest first"). likesPlan is pure, so the whole contract is
 * testable with no network:
 *
 *   1. only HEARTED images — a ✕, a clear and an unmarked picture stay off
 *   2. NEWEST FIRST, her ask, by the run's createdAt
 *   3. one item per hearted IMAGE, not per run
 *   4. the id is `<run>-<index>` and is STABLE — a mark she leaves survives
 *      every rebuild, which is the whole reason the page can be rewritten
 *   5. a non-triangle run never appears, whatever she hearted there
 *   6. the hike run is skipped by id (her word: "hike one was an accident")
 *   7. the prompt halves ride along, with [content] marking the seam
 *
 * Pure, no Firestore, no network:  node scripts/test-triset-likes.js */
const triset = require('../triset');
let fail = 0, ran = 0;
const ok = (c, m) => { ran++; console.log((c ? 'PASS: ' : 'FAIL: ') + m); if (!c) fail++; };

const run = (id, at, over) => ({ id, gptStyle: 'triangle', createdAt: at, quality: 'low',
  prompt: 'a snail crossing a windowpane', fullPrompt: 'STYLE. a snail crossing a windowpane TAIL.',
  images: ['https://x/one.webp'], votes: { 0: 'like' }, ...over });

const plan = triset.likesPlan([
  run('old', 1000),
  run('new', 3000, { prompt: 'a house of cards', fullPrompt: 'STYLE. a house of cards TAIL.' }),
  run('mid', 2000, { images: ['https://x/a.webp', 'https://x/b.webp', 'https://x/c.webp'],
    votes: { 0: 'like', 1: 'dislike', 2: 'like' }, panels: ['first', 'second', 'third'] }),
  run('none', 4000, { votes: {} }),
  run('crossed', 5000, { votes: { 0: 'dislike' } }),
  run('other', 6000, { gptStyle: 'dreamy' }),
  run('bom9yqioA7NshqaC9X9p', 7000),           // the hike
]);

ok(plan.length === 4, `only hearted triangles: 4 items, got ${plan.length}`);
ok(!plan.some(i => i.id.startsWith('none') || i.id.startsWith('crossed')),
  'an unmarked and an ✕d picture stay off');
ok(!plan.some(i => i.id.startsWith('other')), 'a non-triangle run never appears');
ok(!plan.some(i => i.id.startsWith('bom9')), 'the hike run is skipped by id');
ok(plan[0].id === 'new-0', `newest first: ${plan[0].id}`);
ok(plan[1].id === 'mid-0' && plan[2].id === 'mid-2', 'one item per hearted IMAGE, in index order');
ok(plan[3].id === 'old-0', 'the oldest heart is last');
ok(plan[1].label === 'first' && plan[2].label === 'third',
  'a panels run labels each picture with ITS OWN words');
ok(plan.every(i => /^[^ ]+-\d+$/.test(i.id)), 'every id is <run>-<index>');
ok(plan[0].promptContent === 'a house of cards'
  && plan[0].promptStyle === 'STYLE. [content] TAIL.',
  'the prompt halves ride along with the [content] seam');
ok(plan[0].img === plan[0].url && !!plan[0].url, 'the picture is both img and url');
ok(!('at' in plan[0]), 'the sort key does not ride into the page data');

// the SAME hearts in a different read order give the same page, ids included —
// what makes "rewritten only when the set changes" true rather than hopeful
const again = triset.likesPlan([run('mid', 2000, { images: ['https://x/a.webp', 'https://x/b.webp', 'https://x/c.webp'],
  votes: { 0: 'like', 1: 'dislike', 2: 'like' }, panels: ['first', 'second', 'third'] }), run('old', 1000),
  run('new', 3000, { prompt: 'a house of cards', fullPrompt: 'STYLE. a house of cards TAIL.' })]);
ok(JSON.stringify(again) === JSON.stringify(plan), 'the plan is stable whatever order the runs are read in');

// a heart she adds later goes to the TOP and moves nobody else's id
const withNew = triset.likesPlan([run('old', 1000), run('newest', 9000)]);
ok(withNew[0].id === 'newest-0' && withNew[1].id === 'old-0',
  'a new heart lands on top and the older one keeps its id');

// a run whose image went missing must not put a broken tile on her page
ok(triset.likesPlan([run('gone', 1, { images: [null] })]).length === 0,
  'a hearted index with no url is dropped rather than drawn empty');

console.log(fail ? `\n${fail} of ${ran} FAILED` : `\nall ${ran} checks passed`);
process.exit(fail ? 1 : 0);
