#!/usr/bin/env node
// test-blocks.js — the pure halves of blocks.js, no network, no Firebase.
//
// What it pins, and why each one earned a test:
//   makeBlocks   — a line ends on punctuation, on a real gap, or on the word
//                  cap, and EVERY block remembers its word range in the source
//                  (wi0/wi1). That range is what the render walks back through
//                  to re-listen to the right words; a block that lost it would
//                  still LOOK right on the page and cut the wrong audio.
//   makeSections — paragraphs break at the LONGEST pauses and cover every
//                  block exactly once, in order. A dropped block is invisible
//                  until she notices a line missing from her cut.
//   rangesOf     — a card's segments become CONTIGUOUS source word ranges, so
//                  a line she split and never moved is cut as ONE clip and
//                  never picks up a join in the middle of a sentence.
//   parseCards   — the render refuses junk rather than half-rendering it, and
//                  a tts part must be one of our own Storage urls.
//
// Run: node scripts/test-blocks.js

const blocks = require('../blocks');

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass += 1; console.log(`  ok  ${name}`); }
  else { fail += 1; console.log(`FAIL  ${name}${extra ? ` — ${extra}` : ''}`); }
}
function eq(name, got, want) {
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}

// ── a little transcript, hand-timed so every boundary rule fires once ──
// "one two three." ends on punctuation · a 1.2s gap before "five" · then a run
// with no punctuation and no gap, which only the word cap can end.
function words(spec) {
  // spec: [word, start, end]
  return spec.map(([word, start, end]) => ({ word, start, end }));
}
const T = words([
  ['one', 0.0, 0.3], ['two', 0.3, 0.6], ['three.', 0.6, 1.0],
  ['four', 1.1, 1.4],                       // 0.1s gap — same line
  ['five', 2.6, 2.9],                       // 1.2s gap — new line
  ['six', 2.9, 3.2], ['seven', 3.2, 3.5],
]);

console.log('makeBlocks');
{
  const b = blocks.makeBlocks(T);
  eq('three lines', b.map((x) => x.words.join(' ')), ['one two three.', 'four', 'five six seven']);
  eq('ids run in order', b.map((x) => x.id), ['b00', 'b01', 'b02']);
  eq('word ranges cover the source exactly once', b.map((x) => [x.wi0, x.wi1]), [[0, 2], [3, 3], [4, 6]]);
  ok('t0/t1 come from the words', b[2].t0 === 2.6 && b[2].t1 === 3.5, JSON.stringify(b[2]));
  ok('every word is in exactly one block',
    b.reduce((n, x) => n + x.words.length, 0) === T.length);
}
{
  // the word cap: 70 words, no punctuation, no gaps — nothing but the cap can
  // end a line, and a page of one 70-word line is untappable
  const long = words(Array.from({ length: 70 }, (_, i) => [`w${i}`, i * 0.3, i * 0.3 + 0.28]));
  const b = blocks.makeBlocks(long);
  ok('the word cap breaks a run-on', b.length >= 2, `got ${b.length} lines`);
  ok('no line runs past the cap', b.every((x) => x.words.length <= 30));
  eq('the ranges still tile the source', b.map((x) => [x.wi0, x.wi1])[0], [0, 29]);
}
eq('no words, no blocks', blocks.makeBlocks([]), []);

console.log('makeSections');
{
  // eight lines, one obviously huge pause in the middle
  const spec = [];
  for (let i = 0; i < 8; i += 1) {
    const base = i * 2 + (i >= 4 ? 30 : 0);   // the gap before line 5 is ~30s
    spec.push([`a${i}.`, base, base + 0.5]);
  }
  const b = blocks.makeBlocks(words(spec));
  const secs = blocks.makeSections(b);
  ok('at least one paragraph', secs.length >= 1);
  const covered = secs.flatMap((s) => s.blocks);
  eq('every block is in exactly one paragraph, in order', covered, b.map((x) => x.id));
  ok('keys run in order', secs.every((s, i) => s.key === `s${i}`));
  ok('a title is the paragraph’s own first words, never invented',
    secs.every((s) => b.find((x) => x.id === s.blocks[0]).words.join(' ').startsWith(s.title.split(' ')[0])));
}
eq('no blocks, no paragraphs', blocks.makeSections([]), []);

console.log('rangesOf');
{
  const byId = {
    b00: { id: 'b00', wi0: 0, wi1: 4, words: ['a', 'b', 'c', 'd', 'e'] },
    b01: { id: 'b01', wi0: 5, wi1: 7, words: ['f', 'g', 'h'] },
  };
  eq('a whole block is one range',
    blocks.rangesOf({ segs: [{ b: 'b00', a: 0, z: 5 }] }, byId), [[0, 4]]);
  eq('two ADJACENT segments join into one range — no join mid-sentence',
    blocks.rangesOf({ segs: [{ b: 'b00', a: 0, z: 2 }, { b: 'b00', a: 2, z: 5 }] }, byId), [[0, 4]]);
  eq('a segment spanning two blocks that touch is still one range',
    blocks.rangesOf({ segs: [{ b: 'b00', a: 3, z: 5 }, { b: 'b01', a: 0, z: 2 }] }, byId), [[3, 6]]);
  eq('a real hole stays two ranges',
    blocks.rangesOf({ segs: [{ b: 'b00', a: 0, z: 2 }, { b: 'b01', a: 1, z: 3 }] }, byId), [[0, 1], [6, 7]]);
  eq('out-of-order segments are sorted, not trusted',
    blocks.rangesOf({ segs: [{ b: 'b01', a: 0, z: 1 }, { b: 'b00', a: 0, z: 1 }] }, byId), [[0, 0], [5, 5]]);
}

console.log('parseCards');
{
  const B = [{ id: 'b00', wi0: 0, wi1: 2, words: ['a', 'b', 'c'] }];
  const good = blocks.parseCards({ cards: [{ key: 'b00', segs: [{ b: 'b00', a: 0, z: 3 }] }] }, B);
  eq('a span card survives', good.map((c) => c.kind), ['span']);
  const tts = blocks.parseCards({ cards: [{ key: 'n0', tts: 'https://storage.googleapis.com/x/y.mp3' }] }, B);
  eq('a tts card survives', tts.map((c) => c.kind), ['tts']);

  const refuses = (name, body) => {
    let threw = false;
    try { blocks.parseCards(body, B); } catch { threw = true; }
    ok(name, threw);
  };
  refuses('nothing marked in is refused', { cards: [] });
  refuses('a card with no words is refused', { cards: [{ key: 'x', segs: [] }] });
  refuses('a zero-width segment is refused', { cards: [{ key: 'x', segs: [{ b: 'b00', a: 2, z: 2 }] }] });
  refuses('a segment on an unknown block is refused', { cards: [{ key: 'x', segs: [{ b: 'zz', a: 0, z: 2 }] }] });
  // the route does real work and the token is off on the live server, so it
  // must never become a generic fetch-and-transcode for arbitrary urls
  refuses('a tts url off our own Storage is refused', { cards: [{ key: 'n0', tts: 'https://evil.example/x.mp3' }] });
  refuses('too many pieces at once is refused',
    { cards: Array.from({ length: 221 }, () => ({ segs: [{ b: 'b00', a: 0, z: 3 }] })) });
}

console.log('projectId');
{
  const a = blocks.projectId('https://storage.googleapis.com/b/one.mp3');
  ok('content-addressed: the same recording is the same project',
    a === blocks.projectId('https://storage.googleapis.com/b/one.mp3'));
  ok('a different recording is a different project',
    a !== blocks.projectId('https://storage.googleapis.com/b/two.mp3'));
  ok('16 hex chars', /^[a-f0-9]{16}$/.test(a), a);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
