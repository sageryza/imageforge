#!/usr/bin/env node
// test-storylink.js — the Story Link's pure half, driven for real.
//
// Everything here runs against storylink-plan.js itself with NO dependencies
// installed — no express, no firebase-admin — which is the whole reason that
// file is separate. The two promises the routes make are the two things this
// pins hardest:
//
//   a pull ONLY EVER ADDS   — no beat is dropped, moved or reworded
//   an order ONLY EVER PERMUTES — every beat in, every beat out
//
// Plus the matcher, against the REAL titles measured live in her three rooms
// on 2026-08-26, including the pairs that must NOT match.

const p = require('../storylink-plan');

let pass = 0; const fails = [];
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fails.push(name + (extra ? ` — ${extra}` : ''));
}
function eq(name, got, want) {
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}

/* ------------------------------------------------------------ the matcher */
// Her real titles, read live from the three rooms the day this shipped.
const REAL = {
  timeline: [
    { id: 't1', title: 'PROOF — reel beats' },
    { id: 't2', title: 'The white gloves' },
    { id: 't3', title: 'The dance I joined by accident' },
    { id: 't4', title: 'Reflections on Science and Belief' },
    { id: 't5', title: 'Spellcasting' },
    { id: 't6', title: 'The house' },
  ],
  pad: [
    { id: 'p1', title: 'Reflections on Science and Belief' },
    { id: 'p2', title: 'The white gloves' },
    { id: 'p3', title: 'The dance I joined by accident' },
    { id: 'p4', title: 'The house' },
    { id: 'p5', title: 'Spellcasting' },
    { id: 'p6', title: 'Charlie — as it is now' },
    { id: 'p7', title: 'Charlie — as it used to be' },
    { id: 'p8', title: 'Eyes as Wide as a Fishbowl' },
  ],
  blocks: [
    { id: 'b1', title: 'PROOF — reel cut (no Nancy)' },
    { id: 'b2', title: 'Spellcasting VO' },
    { id: 'b3', title: 'Discussion on Coincidence and Science — yeah well — precise re-cut' },
  ],
};

const groups = p.matchRooms(REAL);
const byTitle = Object.fromEntries(groups.map((g) => [g.title, g]));

ok('every timeline story finds its pad or its cut', groups.length === 6, `${groups.length} groups`);

const spell = byTitle['Spellcasting'];
eq('Spellcasting spans all three rooms',
  (spell ? spell.members.map((m) => `${m.room}:${m.doc}`) : []),
  ['timeline:t5', 'pad:p5', 'blocks:b2']);

const proof = byTitle['PROOF — reel beats'];
eq('PROOF finds its cut and has no pad',
  (proof ? proof.members.map((m) => m.room) : []), ['timeline', 'blocks']);

// The false friend: "…Science…" appears in both, and they are different work.
const sci = byTitle['Reflections on Science and Belief'];
ok('the Science cut is NOT swept into the Science story',
  !!sci && !sci.members.some((m) => m.room === 'blocks'),
  JSON.stringify(sci && sci.members.map((m) => m.doc)));

// Two deliberate versions of one story are two pads, and a story that only
// exists in one room needs no link at all.
ok('a pad with no timeline is not a group of its own',
  !groups.some((g) => g.members.length === 1));
ok('the two Charlies are not merged into each other',
  !groups.some((g) => g.members.filter((m) => m.room === 'pad').length > 1));

// A room word is what tells the copies apart, so it must not tell the STORIES
// apart: these two are the same title once "VO" is gone.
ok('a room word does not defeat an exact title', p.score('Spellcasting', 'Spellcasting VO') === 1);
ok('two different stories score zero', p.score('The white gloves', 'The dance I joined by accident') === 0);
ok('a shared common word is not a match', p.score('Reflections on Science and Belief', 'Spellcasting') < p.THRESHOLD);
ok('an empty title never matches anything', p.score('', 'Spellcasting') === 0 && p.score('Untitled', '') === 0);
ok('a version tail is not part of the name', p.score('Evan v6', 'Evan') === 1);

// A one-room world proposes nothing — there is nothing to link.
eq('nothing to link when only one room has anything',
  p.matchRooms({ timeline: REAL.timeline, pad: [], blocks: [] }), []);
eq('no rooms at all is not a crash', p.matchRooms({}), []);

/* --------------------------------------------------------------- the pull */
const story = {
  moments: { m1: { text: 'she opens the door' }, m2: { text: 'the dog is gone' }, m3: { text: 'the phone rings' } },
  units: [['m1'], ['m2', 'm3']],
};

let r = p.planPull(story, []);
eq('an empty pad takes every moment, in the timeline order',
  r.add.map((a) => a.moment), ['m1', 'm2', 'm3']);
eq('and carries her words across verbatim', r.add[1].text, 'the dog is gone');

r = p.planPull(story, [
  { id: 'b1', fromMoment: 'm1' },
  { id: 'bx' },                                   // a picture she added herself
  { id: 'b3', fromMoment: 'm3' },
]);
eq('a moment that already has a beat is not brought across again',
  r.add.map((a) => a.moment), ['m2']);
eq('the ones that are there are reported as matched',
  r.matched.map((m) => m.moment), ['m1', 'm3']);
eq('a beat of her own is reported as extra, never as a delete', r.extra, ['bx']);

// The drift she actually has: more moments than beats, and the other way round.
r = p.planPull({ moments: {}, units: [] }, [{ id: 'a' }, { id: 'b' }]);
eq('a story with no moments proposes no adds at all', r.add, []);
eq('and every beat is left alone', r.extra, ['a', 'b']);

// A beat pointing at a moment she has since deleted is hers, not garbage.
r = p.planPull(story, [{ id: 'bz', fromMoment: 'gone' }]);
ok('a beat from a deleted moment is extra, not re-pulled', r.extra.includes('bz'));
eq('and its moment is not resurrected', r.add.map((a) => a.moment), ['m1', 'm2', 'm3']);

// A moment in `moments` but in no unit is still hers.
r = p.planPull({ moments: { m1: { text: 'a' }, m9: { text: 'orphan' } }, units: [['m1']] }, []);
eq('a moment in no unit still comes across, last', r.add.map((a) => a.moment), ['m1', 'm9']);

/* ------------------------------------------------------------ the re-order */
const beats = [
  { id: 'b3', fromMoment: 'm3' },
  { id: 'bx' },                                   // rides with b3
  { id: 'b1', fromMoment: 'm1' },
  { id: 'b2', fromMoment: 'm2' },
];
let next = p.planOrder(story, beats);
eq('the timeline order is applied', next.map((b) => b.id), ['b1', 'b2', 'b3', 'bx']);
ok('nothing is added or dropped', next.length === beats.length);
ok('every beat that went in comes out',
  beats.every((b) => next.includes(b)));

// The rule that makes this safe to tap.
next = p.planOrder(story, [
  { id: 'b1', fromMoment: 'm1' }, { id: 'hers' }, { id: 'b2', fromMoment: 'm2' },
]);
eq('a hand-added beat rides with the beat above it',
  next.map((b) => b.id), ['b1', 'hers', 'b2']);

next = p.planOrder(story, [{ id: 'top' }, { id: 'b2', fromMoment: 'm2' }, { id: 'b1', fromMoment: 'm1' }]);
eq('a beat before any linked one keeps the front of the pad',
  next.map((b) => b.id), ['top', 'b1', 'b2']);

next = p.planOrder(story, [{ id: 'x' }, { id: 'y' }]);
eq('a pad with nothing linked is not touched at all', next.map((b) => b.id), ['x', 'y']);
ok('and says so', p.sameOrder([{ id: 'x' }, { id: 'y' }], next));

ok('an already-correct pad reports no change',
  p.sameOrder(
    [{ id: 'b1', fromMoment: 'm1' }, { id: 'b2', fromMoment: 'm2' }],
    p.planOrder(story, [{ id: 'b1', fromMoment: 'm1' }, { id: 'b2', fromMoment: 'm2' }]),
  ));
ok('a different length is never the same order', !p.sameOrder([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }]));

// The invariant, over a shuffled pad: a permutation, always.
const many = [];
for (let i = 0; i < 40; i++) many.push({ id: `n${i}`, ...(i % 3 ? {} : { fromMoment: `m${(i % 3) + 1}` }) });
const shuffled = many.slice().reverse();
const out = p.planOrder(story, shuffled);
ok('a big shuffled pad still comes back the same size', out.length === shuffled.length);
ok('with the same beats in it', new Set(out.map((b) => b.id)).size === shuffled.length);

/* ---------------------------------------------------------------- report */
console.log(`\nstorylink: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log('  ✗', f)); process.exit(1); }
