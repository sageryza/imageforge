#!/usr/bin/env node
// test-pad-take.js — ONE TAKE OVER THE WHOLE STORY (pad-take.js), pure.
// The fixture is her real "night" take (2026-09-06), whisper-1 word times.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { alignTake } = require('../pad-take');

const words = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/night-take-words.json'), 'utf8'));
const lines = [
  'it was 10:00 at night',
  'the city gets very hot, at night, in the summer',
  'there was nowhere to go, really, was there?',
  'i was walking around in circles',
  'trying to get my mind right',
  'back and forth, back and forth. go this way, no go this way. no',
  'what did it matter?',
  'which way i went',
  '',                                   // the closer panel — a picture, no words
];
const beats = lines.map((text) => ({ text }));
const near = (a, b, eps = 0.05) => Math.abs(a - b) <= eps;
let n = 0; const ok = (c, m) => { assert(c, m); n++; };

// 1 — every line lands on its own words, in order, and the closer follows.
const p = alignTake(beats, words, { closer: 2, tail: 0.35, lead: 0.08 });
ok(p && p.matched === 8, 'eight lines found');
ok(p.audioAt === 0, 'no leading wordless picture → the take starts at 0');
ok(p.shots[0].start === 0 && p.shots[0].kind === 'line', 'first picture at 0');
ok(near(p.shots[1].start, 2.44 - 0.08), '"the city" where she says it (' + p.shots[1].start + ')');
ok(near(p.shots[5].start, 12.88 - 0.08), '"back and forth" where she says it');
ok(near(p.shots[7].start, 19.30 - 0.08), '"which way" where she says it');
for (let i = 1; i < 8; i++) ok(p.shots[i].start > p.shots[i - 1].start, 'in order at ' + i);
ok(p.shots[8].kind === 'closer' && near(p.shots[8].hold, 2), 'the wordless last picture is a 2s closer');
ok(near(p.shots[7].start + p.shots[7].hold, p.takeEnd + 0.35), 'the last line runs to the end of the take + tail');
ok(near(p.total, p.shots[8].start + 2), 'total is the closer\'s end');
// holds are contiguous: each shot ends where the next starts
for (let i = 0; i < 8; i++) ok(near(p.shots[i].start + p.shots[i].hold, p.shots[i + 1].start), 'contiguous at ' + i);

// 2 — a wordless picture BETWEEN two lines shares the line before it, and
//     moves no later line off its words.
const withGap = beats.slice(0, 3).concat([{ text: '' }], beats.slice(3));
const g = alignTake(withGap, words, { closer: 2, tail: 0.35, lead: 0.08 });
ok(g.matched === 8, 'still eight lines');
ok(g.shots[3].kind === 'shared', 'the inserted picture is shared');
ok(near(g.shots[2].hold, g.shots[3].hold), 'it splits the line\'s span evenly');
ok(near(g.shots[4].start, p.shots[3].start), '"i was walking" did not move');
ok(near(g.total, p.total), 'the film is the same length');

// 3 — a wordless picture BEFORE the first line delays the take.
const lead = [{ text: '' }].concat(beats);
const l = alignTake(lead, words, { closer: 2, tail: 0.35, lead: 0.08 });
ok(l.audioAt === 2, 'the take waits 2s for the opening picture');
ok(l.shots[0].kind === 'closer' && l.shots[0].hold === 2, 'opening picture holds 2s');
ok(near(l.shots[2].start, p.shots[1].start + 2), 'every line moved with the take');

// 4 — a line the take never says is shared, not invented; whisper mishearing
//     one word is survived (two of three in order).
const odd = beats.map((b, i) => (i === 4 ? { text: 'something she never said here' } : b));
const o = alignTake(odd, words, { closer: 2, tail: 0.35, lead: 0.08 });
ok(o.matched === 7 && o.shots[4].kind === 'shared', 'an unsaid line shares the previous span');
const mis = beats.map((b, i) => (i === 3 ? { text: 'i wuz walking around' } : b));
ok(alignTake(mis, words).matched === 8, 'one misheard word does not lose the line');

// 5 — nothing matches → null (the caller falls back to the per-beat film).
ok(alignTake([{ text: 'entirely other words' }, { text: '' }], words) === null, 'no lines found → null');
ok(alignTake(beats, []) === null, 'no words → null');

// 6 — source pins: the renderer reads the take, and keeps the per-beat shape.
const src = fs.readFileSync(path.join(__dirname, '../scratchpad.js'), 'utf8');
ok(/require\('\.\/pad-take'\)/.test(src), 'scratchpad.js reads pad-take.js');
ok(/pad\.voiceover[\s\S]{0,80}\.url/.test(src), 'the film reads the story\'s own voiceover');
ok(/let track = takeFile;/.test(src), 'the take is the whole track');
ok(/audio = await ttsFor\(padId, lead\)/.test(src), 'the per-beat film (TTS per line) is still there for a story with no take');
ok(/scratchpad\/take-words\//.test(src), 'the take\'s words are banked once per url');

console.log(`test-pad-take: ${n} ok`);
