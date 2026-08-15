// test-editor-cutter.js — regression tests for the Episode Editor's span
// matcher (editor.js phraseSpan).
//
// The bug these pin down (Aug 2026, Sophie's report — the Sheldrake episode's
// doubled "coincidence"): a phrase word the audio never says ("uh", caption
// garble) made a window shifted one word early score the SAME difflib ratio as
// the true one, and the tie broke toward the earlier start — so the cut opened
// on a stray word from the previous sentence, heard as the previous clip's
// last word played twice. phraseSpan now snaps the span's edges to the words
// that actually matched the phrase; strays on either edge are trimmed.
//
// Pure logic — no network, no ffmpeg, no keys. Run: node scripts/test-editor-cutter.js

const { phraseSpan } = require('../editor.js');

let failures = 0;
function check(name, got, want) {
  const ok = got === want;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
  if (!ok) failures++;
}

// Audio words as whisper heard them (the real Sheldrake window, b6LNceIaz1Q
// around 38:00 — note whisper hears no "uh" anywhere).
const HEARD = ('And so I decided to test that hypothesis by finding ways of doing experiments where you could ' +
  'actually evaluate the chance coincidence theory and see whether this happened more than chance coincidence ' +
  'The basic experiment involves finding people who say this happens to them and then they give me the names ' +
  'and phone numbers of four friends people they know well or family members They sit at home with a landline ' +
  'telephone no caller ID system being filmed on videotape').split(' ');
const words = HEARD.map((w, i) => ({ word: w, start: i, end: i + 0.5 }));
const at = i => HEARD[i];

// The real snippet texts from episode ep0edeb8c7e2 (transcript has "uh"s the
// audio doesn't).
{
  const s = phraseSpan(words, 'The basic experiment involves uh finding people who say this happens to them');
  check('clip 2 starts on "The", not the stray "coincidence"', at(s.start), 'The');
  check('clip 2 ends on "them", not a stray "and"', at(s.end), 'them');
}
{
  const s = phraseSpan(words, 'They sit at home uh with a landline telephone,');
  check('clip 3 starts on "They", not the stray "members"', at(s.start), 'They');
  check('clip 3 ends on "telephone"', at(s.end), 'telephone');
}
{
  // An exact match (no missing words) must be untouched by the edge snap.
  const s = phraseSpan(words, 'And so, I decided to test that hypothesis by finding ways of doing experiments where you could actually evaluate the chance coincidence theory and see whether this happened more than chance coincidence.');
  check('exact-match clip 1 starts on "And"', at(s.start), 'And');
  check('exact-match clip 1 ends on "coincidence"', at(s.end), 'coincidence');
  check('exact-match clip 1 scores 1.0', s.score, 1);
}
{
  // The clip-5 shape: the phrase CONTAINS a run of words ("they pick it up")
  // that also occurs just before its true start — the leading occurrence must
  // not be included in the span.
  const heard2 = ('and the phone rings four times they pick it up so they say it rings I think ' +
    "it's John they pick it up hello John they're right or they're wrong a one in four chance").split(' ');
  const words2 = heard2.map((w, i) => ({ word: w, start: i, end: i + 0.5 }));
  const s = phraseSpan(words2, "So, they say the rings they I think it's John. They pick it up. Hello, John. They're right or they're wrong.");
  check('clip 5 starts on "so", not the earlier "they pick it up"', heard2[s.start], 'so');
  check('clip 5 ends on "wrong"', heard2[s.end], 'wrong');
}
{
  // Way-off text still answers null.
  const s = phraseSpan(words, 'completely unrelated sentence about gardening tulips in spring rain');
  check('unrelated phrase returns null', s, null);
}

// ─── the OTHER copies of this matcher must agree ────────────────────
// editor.js is the live implementation, but two standalone copies exist and
// cannot import it (one is Python). They drifted silently once already: the
// meteorite copy claimed to be "verbatim from editor.js" while missing
// matchingBlocks' final sort, which ratio() never noticed because it only
// sums block sizes. This pins all three to the same answers.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HEARD_LINE = HEARD.join(' ');
const CASES = [
  ['The basic experiment involves uh finding people who say this happens to them', 'The', 'them'],
  ['They sit at home uh with a landline telephone,', 'They', 'telephone'],
  ['And so, I decided to test that hypothesis by finding ways of doing experiments where you could actually evaluate the chance coincidence theory and see whether this happened more than chance coincidence.', 'And', 'coincidence'],
];

// 1. scripts/story-short-meteorite/02-cut-beats.js — its own JS copy.
{
  const src = fs.readFileSync(path.join(__dirname, 'story-short-meteorite', '02-cut-beats.js'), 'utf8');
  const grab = (name) => {
    const i = src.indexOf('function ' + name);
    let d = 0, j = i;
    for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) break; } }
    return src.slice(i, j + 1);
  };
  const sandbox = {};
  const load = new Function(grab('matchingBlocks') + grab('ratio') + grab('normWords') + grab('phraseSpan')
    + '; return phraseSpan;');
  const theirs = load();
  for (const [text, wantStart, wantEnd] of CASES) {
    const s = theirs(words, text);
    check(`meteorite 02-cut-beats.js opens on "${wantStart}"`, s && at(s.start), wantStart);
    check(`meteorite 02-cut-beats.js ends on "${wantEnd}"`, s && at(s.end), wantEnd);
  }
}

// 2. scripts/nde-supercut-precise.py — the Python original.
{
  const py = `
import difflib, re, json, sys
src = open(${JSON.stringify(path.join(__dirname, 'nde-supercut-precise.py'))}).read()
ns = {'difflib': difflib, 're': re}
exec(src[src.index('def norm'):src.index('def find_quote_sentence')], ns)
heard = ${JSON.stringify(HEARD_LINE)}.split()
wj = {'words': [{'word': w, 'start': i, 'end': i + 0.5} for i, w in enumerate(heard)]}
out = []
for text, _s, _e in json.loads(sys.argv[1]):
    sp = ns['_phrase_span'](wj, text)
    out.append([heard[sp[0]], heard[sp[1]]] if sp else [None, None])
print(json.dumps(out))
`;
  try {
    const raw = execFileSync('python3', ['-c', py, JSON.stringify(CASES)], { encoding: 'utf8' });
    const got = JSON.parse(raw.trim().split('\n').pop());
    CASES.forEach(([text, wantStart, wantEnd], i) => {
      check(`nde-supercut-precise.py opens on "${wantStart}"`, got[i][0], wantStart);
      check(`nde-supercut-precise.py ends on "${wantEnd}"`, got[i][1], wantEnd);
    });
  } catch (err) {
    console.log('skip  nde-supercut-precise.py (python3 unavailable: ' + String(err.message).split('\n')[0] + ')');
  }
}

console.log(failures ? `\n${failures} failure(s)` : '\nall good');
process.exit(failures ? 1 : 0);
