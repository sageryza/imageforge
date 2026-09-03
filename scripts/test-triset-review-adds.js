#!/usr/bin/env node
// A REVIEW DECK'S ▲ ADDS TO THE DEAL — the pure plan (2026-09-03, Sophie:
// "just find the ones i marked add and add them"). No network: the cards,
// the page's items and her verdicts are fixtures.
//   node scripts/test-triset-review-adds.js
const T = require('../triset.js');
let pass = 0; const fails = [];
const is = (n, got, want) => { if (JSON.stringify(got) === JSON.stringify(want)) pass++; else fails.push(`${n}\n    want ${JSON.stringify(want)}\n    got  ${JSON.stringify(got)}`); };
const B = 'https://storage.googleapis.com/b/';
const cards = [
  { id: 'c1', url: B + 'triset/cards/s1-mountain-goat.webp', edition: '', hidden: true },   // pool, in nature vocab, out
  { id: 'c2', url: B + 'triset/cards/s1-teacup-tower.webp', edition: 'everyday', hidden: false }, // pool, dealt
  { id: 'c3', url: B + 'triset/cards/s1-oddity.webp', edition: '', hidden: true },          // pool, in no vocabulary
  { id: 'c4', url: B + 'triset/cards/pl-a-pile-of-seashells.webp', edition: 'everyday', hidden: false, from: { url: B + 'promptlab/x1.webp' } }, // imported earlier
];
const items = [
  { id: 'ts-c1', url: cards[0].url, label: 'a mountain goat' },
  { id: 'ts-c2', url: cards[1].url, label: 'a wobbling tower of teacups' },
  { id: 'ts-c3', url: cards[2].url, label: 'an oddity' },
  { id: 'pl-r1-0', url: B + 'promptlab/x1.webp', label: 'a pile of seashells' },        // the imported one's source
  { id: 'pl-r2-0', url: B + 'promptlab/x2.webp', label: 'a black cat hiding behind monstera leaves' },
  { id: 'pl-r3-0', url: B + 'promptlab/x3.webp', label: 'a pile of seashells' },        // a twin of an imported slug
  { id: 'pl-r4-0', url: B + 'promptlab/x4.webp', label: 'never marked' },
];
const plan = T.reviewPlan(cards, items, {
  'ts-c1': true, 'ts-c2': false, 'ts-c3': true, 'pl-r1-0': false, 'pl-r2-0': true, 'pl-r3-0': true, 'pl-r4-0': 'maybe',
}, new Set());
is('a ▲ on a pool card puts it in its own edition, un-hidden', plan.adopt.find((a) => a.id === 'c1'), { id: 'c1', patch: { edition: 'nature', hidden: false } });
is('a ▲ on a pool card in no vocabulary adopts it into everyday', plan.adopt.find((a) => a.id === 'c3'), { id: 'c3', patch: { edition: 'everyday', hidden: false } });
is('a ✕ on a dealt pool card takes it out', plan.hide, [{ id: 'c2', patch: { hidden: true } }, { id: 'c4', patch: { hidden: true } }]);
is('a ✕ on a Playground picture already imported hides the card it became', !!plan.hide.find((h) => h.id === 'c4'), true);
is('a ▲ on a Playground picture imports it with a slug from its words', plan.import.map((i) => i.slug), ['a-black-cat-hiding-behind-monstera-leave', 'a-pile-of-seashells-2']);
is('…a slug already in the pool is not reused', plan.import[1].slug !== 'a-pile-of-seashells', true);
is('a maybe does nothing', plan.import.concat(plan.adopt, plan.hide).some((x) => (x.item && x.item.id === 'pl-r4-0') || x.id === 'pl-r4-0'), false);
// a settled deck plans nothing
const settled = T.reviewPlan(cards, items, { 'ts-c2': true, 'pl-r1-0': true }, new Set());
is('a card already dealt and a picture already imported plan nothing', [settled.adopt.length, settled.import.length, settled.hide.length], [0, 0, 0]);
console.log(`triset review adds: ${pass} passed, ${fails.length} failed`);
fails.forEach((f) => console.log('  ✗ ' + f));
process.exit(fails.length ? 1 : 0);
