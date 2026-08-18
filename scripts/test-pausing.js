#!/usr/bin/env node
// test-pausing.js — the pure halves of the Pausing tool, no network, no
// Firebase, no ffmpeg.
//
// What it pins, and why each one earned a test:
//   pausesFrom  — the imported detection hands back ranges to REMOVE, already
//                 inset by KEEP/2 on both sides. This tool wants the GAP, so
//                 the inset comes back off. Get that arithmetic wrong and
//                 every pause she is shown is 0.28s shorter than the one she
//                 hears — the tool's whole job, silently off by a beat.
//   pickRoom    — an ADDED pause has no gap of its own to borrow from, so it
//                 is built out of the quietest stretch of the recording.
//                 Picking a loud one puts a half second of speech in the
//                 middle of her pause.
//   planEdit    — the shared plan, loaded by the render on the server AND by
//                 the page in the browser. Its pieces must TILE the original
//                 timeline exactly: a gap in them is audio silently dropped
//                 out of her recording, an overlap is audio played twice.
//   the sharing — that pause-plan.js really is one file both halves load,
//                 because the moment there are two the preview she approves
//                 by ear stops being the take she gets.
//
// Run: node scripts/test-pausing.js

const fs = require('fs');
const path = require('path');
const pausing = require('../pausing');
const { planEdit, clampLen, addAt, LEN_MIN, LEN_MAX } = require('../pause-plan');
const cutroom = require('../cuttingroom');

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass += 1; console.log(`  ok  ${name}`); }
  else { fail += 1; console.log(`FAIL  ${name}${extra ? ` — ${extra}` : ''}`); }
}
function eq(name, got, want) {
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}
const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 0.005 : tol);

const KEEP = cutroom.KEEP;
function words(spec) { return spec.map(([word, start, end]) => ({ word, start, end })); }

// A little transcript with three real gaps in it: a long one, a short one
// (below the rhythm floor), and one at the very end that is trailing air.
const T = words([
  ['one', 0.0, 0.30], ['two', 0.30, 0.60],
  ['three', 2.00, 2.30],          // 1.40s gap after "two"
  ['four', 2.75, 3.00],           // 0.45s gap after "three"
  ['five', 3.20, 3.50],           // 0.20s gap after "four"
]);

console.log('pausesFrom — the gap, not the cut');
{
  // What the imported passes hand back: [s, e], inset by KEEP/2 each side.
  const merged = [[0.60 + KEEP / 2, 2.00 - KEEP / 2]];
  const p = pausing.pausesFrom(merged, T);
  ok('one pause', p.length === 1, JSON.stringify(p));
  ok('the inset comes back off — a=0.60', near(p[0].a, 0.60), String(p[0].a));
  ok('the inset comes back off — b=2.00', near(p[0].b, 2.00), String(p[0].b));
  ok('length is the whole gap, not the cut', near(p[0].len, 1.40), String(p[0].len));
  eq('it sits after the word it follows', p[0].wi, 1);
  eq('ids are stable and ordered', p.map((x) => x.id), ['p00']);
}
{
  // 0.20s of air after a comma is articulation, not a decision she will ever
  // make — a chip on every one of them buries the pauses that matter.
  const merged = [[3.00 + KEEP / 2, 3.20 - KEEP / 2]];
  eq('below the rhythm floor, no chip', pausing.pausesFrom(merged, T).length, 0);
  ok('the floor is 0.35s', pausing.MIN_PAUSE === 0.35, String(pausing.MIN_PAUSE));
}
{
  // Head and tail air is a TRIM, and trimming is the Cutting Room's job.
  const lead = [[0 + KEEP / 2, 0.0 - KEEP / 2]];
  eq('nothing before the first word', pausing.pausesFrom(lead, T).length, 0);
  const tail = [[3.50 + KEEP / 2, 6.00 - KEEP / 2]];
  eq('nothing after the last word', pausing.pausesFrom(tail, T).length, 0);
}
{
  // Two detections inside ONE gap would stack two buttons on one word and the
  // second could never be tapped.
  const merged = [
    [0.60 + KEEP / 2, 1.30 - KEEP / 2],
    [1.30 + KEEP / 2, 2.00 - KEEP / 2],
  ];
  eq('one chip per word, whatever detection found', pausing.pausesFrom(merged, T).length, 1);
}
{
  eq('no words, no pauses', pausing.pausesFrom([[1, 2]], []).length, 0);
}

console.log('\npickRoom — where an added pause comes from');
{
  // A profile in dB: mostly speech at -20, with two quiet runs — one at -55
  // (0.6s) and a quieter one at -70 (0.5s). The quieter long one wins.
  const prof = new Float32Array(400).fill(-20);
  for (let i = 50; i < 80; i++) prof[i] = -55;     // 1.00s → 1.60s
  for (let i = 200; i < 225; i++) prof[i] = -70;   // 4.00s → 4.50s
  const ranges = [[1.0, 1.6], [4.0, 4.5]];
  const r = pausing.pickRoom(prof, ranges);
  ok('the QUIETEST long run wins', near(r.a, 4.0), JSON.stringify(r));
  ok('and it is long enough to loop from', r.b - r.a >= 0.4, JSON.stringify(r));
}
{
  // A run shorter than 0.4s is not usable room tone, so the scan falls back.
  const prof = new Float32Array(200).fill(-20);
  for (let i = 100; i < 118; i++) prof[i] = -68;
  const r = pausing.pickRoom(prof, [[2.0, 2.2]]);
  ok('too-short runs are skipped, the scan finds the quiet stretch',
    r.a >= 1.98 && r.a <= 2.2, JSON.stringify(r));
  ok('the fallback still returns something usable', r.b > r.a, JSON.stringify(r));
}
{
  const prof = new Float32Array(100).fill(-20);
  const r = pausing.pickRoom(prof, []);
  ok('a recording that never goes quiet still yields a span', r.b > r.a, JSON.stringify(r));
}

console.log('\nclampLen — what an answer means');
{
  eq('"leave it" is not a change', clampLen('keep'), null);
  eq('empty is not a change', clampLen(''), null);
  eq('a number is a length', clampLen(1.2), 1.2);
  eq('a string number is a length', clampLen('0.8'), 0.8);
  // "out" is an ELISION, not a splice — taking a beat to zero is a cut, and
  // cutting is the Cutting Room's and Cutting Blocks' job.
  eq('nothing goes to zero', clampLen(0.001), LEN_MIN);
  eq('and nothing runs away', clampLen(99), LEN_MAX);
  eq('junk is not a change', clampLen('soon'), null);
}

console.log('\naddAt — where a new pause sits');
{
  // Never on the tail of the word she tapped: a pause spliced into the decay
  // of a consonant sounds like a stutter, not a beat.
  ok('nudged into the air that already follows', near(addAt(T, 1), 0.66), String(addAt(T, 1)));
  ok('never before the word ends', addAt(T, 1) >= T[1].end);
  eq('after the last word it sits at its end', addAt(T, 4), 3.5);
  eq('a word that does not exist has no place', addAt(T, 99), null);
}

console.log('\nplanEdit — the shared plan');
const PAUSES = [
  { id: 'p00', a: 0.60, b: 2.00, len: 1.40, wi: 1 },
  { id: 'p01', a: 2.30, b: 2.75, len: 0.45, wi: 2 },
];
const DUR = 4.0;
function tiles(name, plan, dur) {
  // The pieces must consume the ORIGINAL timeline end to end, in order, with
  // no gap and no overlap: a gap is audio silently dropped out of her
  // recording, an overlap is audio played twice. An audio piece consumes
  // [a,b]; a SET pause consumes the gap it replaces (its `src`); an ADDED
  // pause consumes nothing, because it is new air between two words.
  let t = 0;
  let bad = '';
  plan.pieces.forEach((pc, i) => {
    const from = pc.type === 'audio' ? pc.a : (pc.src ? pc.src.a : t);
    const to = pc.type === 'audio' ? pc.b : (pc.src ? pc.src.b : t);
    if (!near(from, t)) bad = bad || `piece ${i} starts at ${from}, expected ${t}`;
    t = to;
  });
  ok(name, !bad && near(t, dur), bad || `ended at ${t}, want ${dur}`);
}
{
  const p = planEdit({ pauses: PAUSES, set: { p00: 0.4 }, added: {}, words: T, dur: DUR });
  eq('one change', p.items.length, 1);
  eq('the pieces alternate', p.pieces.map((x) => x.type), ['audio', 'pause', 'audio']);
  eq('speech up to the gap', [p.pieces[0].a, p.pieces[0].b], [0, 0.6]);
  eq('the gap lends its OWN room tone', p.pieces[1].src, { a: 0.6, b: 2.0 });
  eq('at the length she picked', p.pieces[1].len, 0.4);
  eq('speech resumes past the gap', [p.pieces[2].a, p.pieces[2].b], [2.0, DUR]);
  tiles('the audio pieces tile the original', p, DUR);
  // 1.40s of air became 0.40s
  ok('delta is what the edit does to the length', near(p.delta, -1.0), String(p.delta));
  ok('total is what comes out', near(p.total, DUR - 1.0), String(p.total));
}
{
  // A no-op must not become a re-cut. She taps 1.4 on a 1.40s gap — that is
  // her saying "leave it", and re-cutting a gap to itself would put two
  // fade-joins into audio that needed none.
  const p = planEdit({ pauses: PAUSES, set: { p00: 1.4 }, added: {}, words: T, dur: DUR });
  eq('picking the length it already was is not a change', p.items.length, 0);
  eq('and nothing is spliced', p.pieces.map((x) => x.type), ['audio']);
}
{
  const p = planEdit({ pauses: PAUSES, set: { p00: 'keep', p01: '' }, added: {}, words: T, dur: DUR });
  eq('"leave it" answers are not changes', p.items.length, 0);
}
{
  const p = planEdit({ pauses: PAUSES, set: {}, added: { a3: 1.2 }, words: T, dur: DUR });
  eq('an added pause is an item', p.items.length, 1);
  eq('it has no gap to borrow from', p.pieces[1].src, null);
  eq('so it takes no audio out', [p.items[0].a, p.items[0].b], [p.items[0].a, p.items[0].a]);
  ok('and it makes the recording longer', near(p.delta, 1.2), String(p.delta));
  tiles('an added pause still tiles', p, DUR);
}
{
  const p = planEdit({
    pauses: PAUSES, set: { p00: 0.3, p01: 2.5 }, added: { a0: 0.8 }, words: T, dur: DUR,
  });
  eq('every kind at once, in time order', p.items.map((x) => x.id), ['a0', 'p00', 'p01']);
  tiles('all three tile the original', p, DUR);
  ok('the arithmetic adds up',
    near(p.delta, 0.8 + (0.3 - 1.4) + (2.5 - 0.45)), String(p.delta));
}
{
  // Overlaps are DROPPED, never merged — two items over the same stretch
  // would each consume it and the second would eat audio the first replaced.
  // Reachable by adding a pause inside a gap she has also set: a1 lands at
  // 0.66, inside p00's [0.60, 2.00].
  const p = planEdit({ pauses: PAUSES, set: { p00: 0.5 }, added: { a1: 0.8 }, words: T, dur: DUR });
  eq('the overlapping item is dropped', p.dropped.map((x) => x.id), ['a1']);
  eq('the one that starts first survives', p.items.map((x) => x.id), ['p00']);
  tiles('and the plan still tiles', p, DUR);
}
{
  const p = planEdit({ pauses: [], set: {}, added: {}, words: T, dur: DUR });
  eq('nothing set is one span of untouched audio', p.pieces.length, 1);
  eq('and no change to the length', p.delta, 0);
  const q = planEdit({ pauses: PAUSES, set: { zz: 0.5 }, added: { a999: 1 }, words: T, dur: DUR });
  eq('answers about things that are not there are ignored', q.items.length, 0);
}

console.log('\none plan, two halves');
{
  // The render loads pause-plan.js; the page loads /pause-plan.js, which is
  // the same file off disk. If either ever grows its own copy, the length she
  // approved by ear stops being the length that gets baked.
  const server = fs.readFileSync(path.join(__dirname, '..', 'pausing.js'), 'utf8');
  const page = fs.readFileSync(path.join(__dirname, '..', 'public', 'pausing.html'), 'utf8');
  const route = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  ok('the render loads the shared plan', /require\('\.\/pause-plan'\)/.test(server));
  ok('the page loads the shared plan', /<script src="\/pause-plan\.js">/.test(page));
  ok('and the server serves that very file',
    /app\.get\('\/pause-plan\.js'/.test(route) && /pause-plan\.js'\)/.test(route));
  ok('the page never re-derives one', !/function planEdit/.test(page));
  // Detection is imported, never re-implemented: a second copy would find
  // DIFFERENT pauses and the same recording would read differently in two rooms.
  ok('detection is imported from the Cutting Room',
    /cutroom\.breathCuts/.test(server) && /cutroom\.roomToneCuts/.test(server)
    && /cutroom\.mergeRanges/.test(server) && /cutroom\.rmsProfile/.test(server));
  ok('and none of it is re-implemented here',
    !/function breathCuts/.test(server) && !/function roomToneCuts/.test(server));
  // The whole finding behind the tool.
  ok('a pause is never digital silence', /room/i.test(server) && !/createBuffer\(1, 0/.test(page));
}

console.log('\nprojectId');
{
  const a = pausing.projectId('https://storage.googleapis.com/b/one.mp3');
  ok('content-addressed: the same recording is the same project',
    a === pausing.projectId('https://storage.googleapis.com/b/one.mp3'));
  ok('a different recording is a different project',
    a !== pausing.projectId('https://storage.googleapis.com/b/two.mp3'));
  ok('16 hex chars', /^[a-f0-9]{16}$/.test(a), a);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
