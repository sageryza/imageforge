// The CANDIDATES half of the listen sheet (Aug 2026, Sophie: "attach them
// behind the wave form, but under a header tag called candidates").
//
// A candidate is a recording a chat GUESSED belongs to a story. It rides the
// same `sources` list and the same player; only the sheet's ordering keeps it
// honest — a guess must never sit among the attached rows as if she had
// already said yes. That ordering is what this pins.
//
// Pure: renderAudios only touches createElement/appendChild, so the real
// function is lifted out of the BUILT page and driven against fixtures. No
// browser, no network — it runs anywhere, unlike the playwright sibling.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'scratchpad.html'), 'utf8');
const m = html.match(/function renderAudios\(\)\{[\s\S]*?\n\}/);
if (!m) { console.error('FAIL: renderAudios not found in the built page'); process.exit(1); }

const box = mkEl('div');
const btn = { hidden: false };
function mkEl(tag) {
  const o = {
    tag, className: '', children: [], _url: null, style: {}, _text: '',
    setAttribute() {}, appendChild(c) { o.children.push(c); },
    querySelector: () => ({ set innerHTML(v) {} }),
    set textContent(v) { o._text = v; }, get textContent() { return o._text; },
    set innerHTML(v) { if (v === '') o.children.length = 0; },
  };
  return o;
}
global.document = {
  createElement: mkEl,
  getElementById: (id) => (id === 'audios' ? box : id === 'audiobtn' ? btn : null),
  querySelectorAll: () => [],
};
global.player = { src: '', paused: true, ended: false };
global.auGlyphs = () => {};
global.AU_PLAY = 'play';
global.AU_PAUSE = 'pause';
global.fmtDur = () => '0:30';
// eslint-disable-next-line no-eval
eval(`${m[0]}; global.__render = renderAudios;`);

const ATTACHED = { title: 'Voiceover — Evan', url: 'a', seconds: 30, date: null };
const MEMO = { title: 'A real memo', url: 'b', seconds: 60, date: '2026-01-01' };
const GUESS1 = { title: 'Guess one', url: 'c', seconds: 90, date: '2026-02-02', candidate: true };
const GUESS2 = { title: 'Guess two', url: 'd', seconds: 10, date: '2026-03-03', candidate: true };

let failed = 0;
function check(name, ok) {
  console.log((ok ? 'ok   ' : 'FAIL ') + name);
  if (!ok) failed++;
}
function render(list) { global.audios = list; global.__render(); return box.children; }
const shape = (kids) => kids.map((c) => (c.className === 'auhead' ? `[${c.textContent}]` : c.className));

// Mixed: every attached row first, then ONE header, then the guesses.
let s = shape(render([ATTACHED, GUESS1, MEMO, GUESS2]));
check('attached rows come first, candidates last',
  JSON.stringify(s) === JSON.stringify(['aurow', 'aurow', '[Candidates]', 'aurow', 'aurow']));
check('exactly one header', s.filter((x) => x === '[Candidates]').length === 1);

// Nothing unconfirmed → the word "Candidates" never appears.
check('no candidates → no header',
  !shape(render([ATTACHED, MEMO])).includes('[Candidates]'));

// All unconfirmed → the header still leads, so she is never shown a guess
// dressed as an attachment.
check('candidates only → header leads', shape(render([GUESS1]))[0] === '[Candidates]');

// The button rule is unchanged by any of this.
render([]);
check('no audio at all → waveform button hidden', btn.hidden === true);
render([GUESS1]);
check('a candidate alone still shows the button', btn.hidden === false);

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
