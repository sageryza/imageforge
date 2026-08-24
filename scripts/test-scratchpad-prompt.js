#!/usr/bin/env node
// THE BEAT'S DRAWING PROMPT IS ITS OWN FIELD (Aug 2026, Sophie: the one
// text was caption, script, film timing AND prompt seed at once — "do 1, 2,
// and 5, but it shud save automatically, no save button"). Pins:
//   1. promptFor: a stored prompt wins; else the words with speech markup
//      stripped — [pause]-style tags and <break/> are voice directions.
//   2. The page carries the SAME fallback (promptOf) and the SAME strip
//      (stripSpeech) — two copies by necessity, pinned equal here.
//   3. The wand (/drawall) draws through promptFor, so a tuned prompt stays
//      tuned in the bulk pass.
//   4. The page saves the prompt ITSELF — blur, closing the popup, drawing —
//      and there is no Save button.
//   5. /prompt stores only a DIVERGED prompt: one equal to the words'
//      drawable form is cleared, so the beat keeps following its note.
//
//   node scripts/test-scratchpad-prompt.js
const fs = require('fs');
const path = require('path');
const { drawablePrompt, promptFor } = require('../scratchpad.js');

let fails = 0;
function ok(name, cond) {
  console.log((cond ? '  ok  ' : 'FAIL  ') + name);
  if (!cond) fails++;
}

// 1. the fallback chain
ok('strips [pause] and <break/> from words',
  promptFor({ text: 'a dog [pause] runs <break time="1s" /> home' }) === 'a dog runs home');
ok('a stored prompt wins, trimmed',
  promptFor({ text: 'the words', prompt: '  a red door  ' }) === 'a red door');
ok('a blank prompt falls back to the words',
  promptFor({ text: 'the words', prompt: '   ' }) === 'the words');
ok('nothing anywhere is empty', promptFor({}) === '' && promptFor(null) === '');
ok('a [very long bracketed run over forty characters] is left alone',
  drawablePrompt('x [this bracketed stretch runs well past the forty character cap on stage directions] y')
    .indexOf('bracketed stretch') > 0);

// 2. the page's copies stay in step with the server's
const srv = fs.readFileSync(path.join(__dirname, '..', 'scratchpad.js'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, '..', 'public', 'scratchpad.html'), 'utf8');
const gen = fs.readFileSync(path.join(__dirname, 'gen-scratchpad.py'), 'utf8');
const stripRe = /replace\(\/<break\[\^>\]\*>\/gi,\s*' '\)\s*\.?replace\(\/\\\[\[\^\\\]\\n\]\{1,40\}\\\]\/g,\s*' '\)/;
ok('server drawablePrompt strips break + bracket tags', stripRe.test(srv.replace(/\n\s*/g, ' ')));
ok('page stripSpeech strips the same two', stripRe.test(page.replace(/\n\s*/g, ' ')));
ok('page has promptOf (stored prompt, else stripped words)',
  /function promptOf\(b\)\{[^}]*b\.prompt[^}]*stripSpeech\(b&&b\.text\)/.test(page.replace(/\n\s*/g, '')));

// 3. the wand draws through promptFor, both halves
ok('/drawall filters and maps by promptFor', (srv.match(/promptFor\(b\)/g) || []).length >= 3);
ok('page wand count uses promptOf', page.indexOf("s.gen.status==='drawing') && promptOf(b)") > 0);

// 4. auto-save, no button
ok('prompt saves on blur', page.indexOf("getElementById('dprompt').onblur") > 0);
ok('prompt saves on closing the popup', /function closeBeat\(\)\{[^}]*savePrompt\(\)/.test(page));
ok('prompt saves on Draw', /saveNote\(\); savePrompt\(\);\s*\n\s*api\('\/generate'/.test(page));
ok('no Save button appeared in the draw box',
  !/id="dsave"|>\s*Save\s*</i.test(page.slice(page.indexOf('id="drawbox"'), page.indexOf('id="pnote"'))));
ok('generator matches the built page (promptOf present)', gen.indexOf('function promptOf(b){') > 0);

// 5. the /prompt route's store-vs-clear rule
ok('/prompt clears a prompt equal to drawablePrompt(text)',
  /if \(!prompt \|\| prompt === drawablePrompt\(b\.text\)\) delete b\.prompt;/.test(srv));
ok('/prompt stores a diverged prompt', /else b\.prompt = prompt;/.test(srv));

console.log(fails ? `\n${fails} FAILED` : '\nall good');
process.exit(fails ? 1 : 0);
