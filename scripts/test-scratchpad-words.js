#!/usr/bin/env node
// A BEAT WITH A PROMPT AND NO CAPTION SAYS ITS PROMPT (2026-09-06, Sophie,
// on her "Mental hospital" story — 39 beats carrying their words as `prompt`
// with an empty `text`: "if i put no caption, use the drawing prompt").
// promptFor already fell the other way (no prompt → the caption); this is the
// mirror, at READ time only. Pins:
//   1. wordsFor: the caption wins; an empty/blank caption falls back to the
//      prompt; nothing anywhere is ''. Storage is untouched — it is a reader.
//   2. The page's wordsOf is the SAME rule — extracted out of the built page
//      and driven over the same cases, so the two copies cannot drift.
//   3. Every server reader of "what does this beat say" goes through it: the
//      film's per-beat words (ttsFor and the film loop), the /tts route's
//      refusal, the shoebox title, the filed-art label.
//   4. The page's readers too: the tile caption (capFor), the repaint
//      signature (a prompt change on a caption-less beat must repaint the
//      tile), the card's words (capShown), the Playground trip's `t`.
//   5. The caption EDITOR is still seeded from `text` alone — her rule, never
//      pre-written text in a box she writes in.
//
//   node scripts/test-scratchpad-words.js
const fs = require('fs');
const path = require('path');
const { wordsFor, promptFor } = require('../scratchpad.js');

let fails = 0;
function ok(name, cond) {
  console.log((cond ? '  ok  ' : 'FAIL  ') + name);
  if (!cond) fails++;
}

const cases = [
  [{ text: 'the caption', prompt: 'the prompt' }, 'the caption'],
  [{ text: '   ', prompt: '  a red door in the snow ' }, 'a red door in the snow'],
  [{ text: '', prompt: 'the prompt' }, 'the prompt'],
  [{ prompt: 'the prompt' }, 'the prompt'],
  [{ text: 'words [pause] here', prompt: 'the prompt' }, 'words [pause] here'],
  [{ text: '', prompt: '' }, ''],
  [{}, ''],
  [null, ''],
];

// 1. the server rule
for (const [b, want] of cases) ok(`wordsFor(${JSON.stringify(b)}) → ${JSON.stringify(want)}`, wordsFor(b) === want);
ok('the two fallbacks are mirrors: promptFor on a caption-less beat is its prompt',
  promptFor({ text: '', prompt: 'the prompt' }) === 'the prompt' && wordsFor({ text: 'w', prompt: '' }) === 'w');
const frozen = Object.freeze({ prompt: 'p' });
ok('wordsFor reads and never writes', wordsFor(frozen) === 'p' && frozen.text === undefined);

// 2. the page's copy, lifted out of the built page and run over the same cases
const page = fs.readFileSync(path.join(__dirname, '..', 'public', 'scratchpad.html'), 'utf8');
const gen = fs.readFileSync(path.join(__dirname, 'gen-scratchpad.py'), 'utf8');
const srv = fs.readFileSync(path.join(__dirname, '..', 'scratchpad.js'), 'utf8');
const m = page.match(/function wordsOf\(b\)\{[\s\S]*?\n\}/);
ok('the page carries wordsOf', Boolean(m));
const wordsOf = m ? new Function(m[0] + '; return wordsOf;')() : () => undefined;
for (const [b, want] of cases) ok(`page wordsOf agrees on ${JSON.stringify(b)}`, wordsOf(b) === want);
ok('generator matches the built page (wordsOf present)', gen.indexOf('function wordsOf(b){') > 0);

// 3. the server's readers
const flat = srv.replace(/\n\s*/g, ' ');
ok('ttsFor speaks wordsFor', /async function ttsFor\(padId, beat\) \{ const text = wordsFor\(beat\);/.test(flat));
ok('the film loop asks wordsFor before reading a line', /if \(!audio && wordsFor\(lead\)\)/.test(flat));
ok('/tts refuses on wordsFor, not on text alone', /if \(!wordsFor\(beat\)\) return res\.status\(400\)/.test(flat));
ok('the shoebox title is wordsFor', /shoeboxPut\(art, wordsFor\(beat\)/.test(flat));
ok('the filed-art label is wordsFor', /fileBeatArt\(url, src, wordsFor\(placed\)\)/.test(flat));
ok('no server reader is left on a bare beat.text for words (only wordsFor itself reads it)',
  (srv.match(/String\(\(beat && beat\.text\) \|\| ''\)\.trim\(\)/g) || []).length === 1 && !/String\(lead\.text \|\| ''\)\.trim\(\)/.test(srv));
ok('wordsFor is exported', /module\.exports = \{[^}]*\bwordsFor\b/.test(srv));

// 4. the page's readers
const pflat = page.replace(/\n\s*/g, ' ');
ok('the tile caption reads wordsOf', /function capFor\(wrap, b\)\{ var words=wordsOf\(b\); if\(!words\)return;/.test(pflat));
ok('the repaint signature reads wordsOf (a prompt change repaints a caption-less tile)',
  /clipOf\(m\)\?1:0, wordsOf\(m\)\]\.join/.test(page));
ok('the card paints its words through capShown', (page.match(/getElementById\('captext'\)\.textContent=capShown\(/g) || []).length >= 4);
ok('capShown: the box, else the live prompt box, else wordsOf',
  /function capShown\(b\)\{ var v=document\.getElementById\('pnote'\)\.value; if\(v\.trim\(\)\)return v; var p=document\.getElementById\('dprompt'\)\.value\.trim\(\); return p\|\|wordsOf\(b\|\|popBeat\); \}/.test(pflat));
ok('the Playground trip names the beat by wordsOf', /var t=wordsOf\(b\)\.replace/.test(page));

// 5. the editor is never seeded from the prompt
ok('#pnote is seeded from text alone', page.indexOf("getElementById('pnote').value=b.text||'';") > 0);
ok('nothing seeds #pnote from the prompt', !/getElementById\('pnote'\)\.value=[^;]*prompt/.test(page));
ok('/text still stores what she typed, prompt untouched', /b\.text = text;/.test(srv) && !/b\.text = (wordsFor|promptFor)/.test(srv));

console.log(fails ? `\n${fails} FAILED` : '\nall good');
process.exit(fails ? 1 : 0);
