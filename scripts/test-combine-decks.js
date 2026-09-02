#!/usr/bin/env node
// The union rules behind scripts/combine-decks.js — pure, no network.
const { combineItems, combineVerdicts } = require('./combine-decks.js');

let pass = 0; let fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass += 1; return; }
  fail += 1;
  console.log('FAIL', name, extra === undefined ? '' : extra);
}

const A = { items: [{ id: 'a-1', img: 'A1' }, { id: 'a-2', img: 'A2' }] };
const B = { items: [{ id: 'a-2', img: 'A2' }, { id: 'b-1', img: 'B1' }] };

// The union dedupes by id and keeps the first page's order.
{
  const r = combineItems([A, B]);
  ok('union order', r.items.map((i) => i.id).join(',') === 'a-1,a-2,b-1',
    r.items.map((i) => i.id).join(','));
  ok('no clash on identical duplicates', r.clashes.length === 0);
}

// A duplicate deck posted into two chats is one deck, not two.
{
  const r = combineItems([B, B]);
  ok('identical pages collapse', r.items.length === 2);
}

// AN ID THAT MEANS TWO DIFFERENT PICTURES IS THE ONE THING THIS MUST NOT
// SILENTLY JOIN — a verdict would land on the wrong picture forever.
{
  const r = combineItems([A, { items: [{ id: 'a-1', img: 'SOMETHING ELSE' }] }]);
  ok('clash is reported', r.clashes.length === 1 && r.clashes[0].id === 'a-1');
}

// url stands in for img on an item that only carries one.
{
  const r = combineItems([{ items: [{ id: 'z', url: 'U' }] }, { items: [{ id: 'z', url: 'U' }] }]);
  ok('url compared when img absent', r.clashes.length === 0 && r.items.length === 1);
}

const IDS = new Set(['a-1', 'a-2', 'b-1']);

// Marks are carried, and the later source wins a contested id.
{
  const v = combineVerdicts([
    { items: { 'a-1': true, 'a-2': false }, texts: { 'a-1': 'keep' } },
    { items: { 'a-1': 'maybe', 'b-1': true } },
  ], IDS);
  ok('every mark carried', Object.keys(v.items).length === 3);
  ok('later source wins', v.items['a-1'] === 'maybe', v.items['a-1']);
  ok('booleans stay booleans', v.items['a-2'] === false && v.items['b-1'] === true);
  ok('string verdicts survive', v.items['a-1'] === 'maybe');
  ok('notes carried', v.texts['a-1'] === 'keep');
  ok('nothing dropped', v.dropped.length === 0);
}

// A mark for a card the combined deck does not hold is DROPPED AND NAMED —
// never carried onto whatever id happens to sit near it.
{
  const v = combineVerdicts([{ items: { 'a-1': true, 'ghost-9': false } }], IDS);
  ok('stray mark dropped', !('ghost-9' in v.items));
  ok('stray mark named', v.dropped.join(',') === 'ghost-9', v.dropped.join(','));
}

// A note whose card is gone goes with it.
{
  const v = combineVerdicts([{ texts: { 'ghost-9': 'x' } }], IDS);
  ok('stray note dropped', Object.keys(v.texts).length === 0);
}

// A source with no verdict doc at all contributes nothing and breaks nothing.
{
  const v = combineVerdicts([{}, { items: { 'a-1': true } }], IDS);
  ok('empty source is fine', Object.keys(v.items).length === 1);
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
