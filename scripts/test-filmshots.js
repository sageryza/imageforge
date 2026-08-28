#!/usr/bin/env node
// The shot map — the pure rules, no network, no Firestore, no ffmpeg.
//
//   1. secondsOf()   — a time may be seconds or the m:ss a chat has in front
//      of it; both are the same second.
//   2. cleanShots()  — sorted, capped, a shot with no picture dropped, two
//      entries on one second collapsed to the later (corrected) one.
//   3. withEnds()    — a shot holds the screen until the next one starts.
//   4. shotAt()      — the LAST shot that has started; -1 before the first,
//      which is what keeps a film opening on an unmapped title card silent.
//   5. joinPrompts() — the WORDS come from the chat's filed pictures, joined
//      by url and then by FILENAME (one picture, two roads — asset-union.js).
//      A "from <chat>" caption is the hook's catch, not a made-with tag.
//   6. the detector's pure halves — boundsFrom() and assign() — including
//      that a frame matching NOTHING closely is LEFT OUT rather than guessed
//      in, the one failure this feature must not have.
//
// Run: node scripts/test-filmshots.js
'use strict';
const { _internals } = require('../filmshots');
const { secondsOf, cleanShots, withEnds, shotAt, joinPrompts } = _internals;
const { boundsFrom, hamming, assign, planShots } = require('./film-shots-detect');

let fails = 0;
function ok(name, cond, extra) {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra !== undefined ? '\n       ' + JSON.stringify(extra) : ''));
}
const U = (n) => `https://storage.googleapis.com/b/promptlab/pic-${n}.webp`;

console.log('secondsOf — seconds or m:ss, one second either way');
{
  ok('a number is itself', secondsOf(12.5) === 12.5);
  ok('m:ss', secondsOf('1:04') === 64);
  ok('m:ss with a fraction', secondsOf('1:04.5') === 64.5);
  ok('a numeric string', secondsOf('90') === 90);
  ok('nothing is null', secondsOf('') === null && secondsOf(undefined) === null);
  ok('words are null', secondsOf('halfway') === null);
  ok('negative clamps to 0', secondsOf(-4) === 0);
}

console.log('cleanShots — the map as it is stored');
{
  const list = cleanShots([
    { at: 20, url: U(2), title: '  the   veil ' },
    { at: 0, url: U(1) },
    { at: 12, url: '' },                 // no picture — not a shot
    { at: 'nonsense', url: U(9) },
    { at: '0:30', url: U(3) },
  ]);
  ok('sorted by time', list.map((s) => s.at).join(',') === '0,20,30', list);
  ok('a shot with no picture is dropped', list.length === 3);
  ok('a title is squeezed and kept', list[1].title === 'the veil');
  ok('m:ss became seconds', list[2].at === 30);
  const dup = cleanShots([{ at: 5, url: U(1) }, { at: 5.001, url: U(2) }]);
  ok('two entries on one second collapse', dup.length === 1);
  ok('…to the later one — the correction wins', dup[0].url === U(2));
  ok('a runaway list is capped', cleanShots(
    Array.from({ length: 900 }, (_, i) => ({ at: i, url: U(i) }))).length === 600);
  ok('rubbish in, empty out', cleanShots(null).length === 0 && cleanShots('x').length === 0);
}

console.log('withEnds — a shot holds the screen until the next one');
{
  const e = withEnds(cleanShots([{ at: 0, url: U(1) }, { at: 10, url: U(2) }]), 25);
  ok('the first ends where the second starts', e[0].end === 10);
  ok('the last runs to the end of the film', e[1].end === 25);
  const noLen = withEnds(cleanShots([{ at: 0, url: U(1) }]), null);
  ok('with no length, the last shot has no end rather than a made-up one', noLen[0].end === undefined);
  const short = withEnds(cleanShots([{ at: 0, url: U(1) }, { at: 10, url: U(2) }]), 4);
  ok('a length BEFORE the last shot is not used', short[1].end === undefined, short);
}

console.log('shotAt — which picture is on screen');
{
  const s = cleanShots([{ at: 5, url: U(1) }, { at: 10, url: U(2) }, { at: 20, url: U(3) }]);
  ok('before the first shot: nothing', shotAt(s, 0) === -1);
  ok('on the first shot', shotAt(s, 5) === 0);
  ok('mid-shot', shotAt(s, 9.9) === 0);
  ok('exactly on a cut is the NEW shot', shotAt(s, 10) === 1);
  // the boundary carries ONE millisecond of tolerance, so a playhead reported
  // as 9.9999 at a cut on 10 is not read as the previous picture
  ok('a hair before a cut is still the old one', shotAt(s, 9.99) === 0);
  ok('…and a millisecond of float error at the cut is not', shotAt(s, 9.9999) === 1);
  ok('past the last shot stays on it', shotAt(s, 900) === 2);
  ok('an empty map answers nothing', shotAt([], 4) === -1);
}

console.log('joinPrompts — the words are the ASSETS’, never a copy');
{
  const assets = [
    { url: U(1), description: 'The veil (beat 1)', prompt: 'gpt-image-2 · medium · 1/4 (4K)',
      promptStyle: 'STYLE reference…', promptContent: 'a gauzy veil drifting down' },
    { url: 'https://storage.googleapis.com/b/claude-deliveries/99-x.webp', description: 'twin',
      alts: [U(2)], promptContent: 'the second picture' },
    { url: U(4), prompt: 'from some-chat', promptContent: 'caught in the background' },
    { url: U(5), description: 'a label and nothing else' },
  ];
  const shots = withEnds(cleanShots([
    { at: 0, url: U(1) }, { at: 5, url: U(2) }, { at: 9, url: U(4) },
    { at: 12, url: U(5) }, { at: 15, url: U(7), title: 'not filed anywhere' },
  ]), 20);
  const j = joinPrompts(shots, assets);
  ok('the label she reviews by', j[0].label === 'The veil (beat 1)');
  ok('the MODEL · QUALITY · SIZE caption', j[0].caption === 'gpt-image-2 · medium · 1/4 (4K)');
  ok('both halves of the exact prompt', j[0].content === 'a gauzy veil drifting down' && !!j[0].style);
  ok('the same picture by its OTHER path still joins', j[1].content === 'the second picture', j[1]);
  ok('a "from <chat>" caption is not a made-with tag', j[2].caption === undefined, j[2]);
  ok('…but its prompt still shows', j[2].content === 'caught in the background');
  ok('a picture with only a label has no words', !j[3].content && !j[3].style && j[3].label);
  ok('a picture filed nowhere keeps the map’s own title', j[4].label === 'not filed anywhere');
  ok('…and offers no prompt', !j[4].content && !j[4].style);
  ok('the times ride through untouched', j.map((s) => s.at).join(',') === '0,5,9,12,15');
}

console.log('joinPrompts — a filename join, for a picture copied under a new name');
{
  const j = joinPrompts([{ at: 0, url: 'https://other.host/x/pic-1.webp' }],
    [{ url: U(1), description: 'the veil', promptContent: 'a gauzy veil' }]);
  ok('same filename, other host → joined', j[0].content === 'a gauzy veil', j[0]);
}

console.log('the detector — bounds');
{
  const b = boundsFrom([20.7, 28.4, 36.8], 45);
  ok('cuts become shots', b.length === 4);
  ok('the first starts at 0', b[0][0] === 0);
  ok('the last runs to the end', b[3][1] === 45);
  ok('a cut past the end is ignored', boundsFrom([10, 90], 45).length === 2);
  ok('a flash is not a shot', boundsFrom([10, 10.05], 45).length === 2, boundsFrom([10, 10.05], 45));
  ok('no cuts at all is one shot', boundsFrom([], 45).length === 1);
}

console.log('the detector — matching, and what it refuses to guess');
{
  const bits = (seed) => Array.from({ length: 64 }, (_, i) => ((i * 7 + seed * 13) % 5) < 2 ? 1 : 0);
  const cands = [{ url: U(1), description: 'one' }, { url: U(2), description: 'two' }, { url: U(3), description: 'three' }];
  const hashes = [bits(1), bits(2), bits(3)];
  const near = hashes[1].slice(); near[0] ^= 1; near[5] ^= 1;         // the same picture, off by 2
  const noise = Array.from({ length: 64 }, (_, i) => (i % 2 ? 1 : 0)); // a frame of something else
  const picks = assign([near, noise], hashes);
  ok('a frame finds its own picture', picks[0].best === 1 && picks[0].dist === 2, picks[0]);
  ok('hamming is symmetric', hamming(hashes[0], hashes[1]) === hamming(hashes[1], hashes[0]));
  const plan = planShots([[0, 10], [10, 20]], picks, cands, { max: 26, margin: 4 });
  ok('a sure match is kept', plan[0].keep === true && plan[0].url === U(2));
  ok('it carries the picture’s label as the map’s title', plan[0].title === 'two');
  ok('an unsure frame is LEFT OUT, never guessed in', plan[1].keep === false, plan[1]);
  const tight = planShots([[0, 10]], [{ best: 0, dist: 8, margin: 1 }], cands, { max: 26, margin: 4 });
  ok('a close second-best is also left out', tight[0].keep === false);
  const far = planShots([[0, 10]], [{ best: 0, dist: 40, margin: 12 }], cands, { max: 26, margin: 4 });
  ok('a distant best is left out however clear the margin', far[0].keep === false);
}

console.log(fails ? `\n${fails} FAILED` : '\nall good');
process.exit(fails ? 1 : 0);
