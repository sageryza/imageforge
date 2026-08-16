#!/usr/bin/env node
/* gen-story-timeline.js — build Sophie's story timeline Compare page from
   docs/story-timeline/beats.json.
     node scripts/gen-story-timeline.js            # write the html
     node scripts/gen-story-timeline.js --post     # write it AND post the page
   Re-ordering the story is an edit to beats.json + a rebuild — the ids stay
   stuck to their TEXT, so her notes never slide onto a different moment.
   A NEW VERSION IS A NEW PAGE: bump `title` (and the file name) rather than
   re-posting over one she has already read. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'docs/story-timeline/beats.json');
const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s) => esc(s).replace(/"/g, '&quot;');

function beat(b) {
  const tag = b.tag ? ` <span class="x">${esc(b.tag)}</span>` : '';
  return `      <li class="beat" data-item="${attr(b.id)}">`
    + `<span class="num">${esc(b.n)}</span>`
    + `<span class="say">${esc(b.text)}${tag}</span></li>`;
}

function block(x) {
  if (x.kind === 'beat') return beat(x);
  if (x.kind === 'ref') {
    return `      <li class="ref" data-item="${attr(x.id)}">`
      + `<span class="reflab">${esc(x.label)}</span>`
      + `<span class="say">${esc(x.text)}</span></li>`;
  }
  const span = x.beats.length > 1
    ? `${x.beats[0].n}–${x.beats[x.beats.length - 1].n}`
    : String(x.beats[0].n);
  return `      <li class="seq"><span class="seqlab">${esc(x.label)} · ${span}</span>\n`
    + `        <ol>\n${x.beats.map(beat).join('\n')}\n        </ol></li>`;
}

const count = data.blocks.reduce(
  (n, b) => n + (b.kind === 'beat' ? 1 : b.kind === 'seq' ? b.beats.length : 0), 0);

const html = `<!doctype html>
<!-- Built by scripts/gen-story-timeline.js from docs/story-timeline/beats.json.
     Edit the JSON and rebuild; never hand-edit this file. -->
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(data.title)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  /* layout only — every colour is a /compare.css token */
  .tl, .tl ol { list-style: none; }
  .tl li::before { content: none; }
  .tl { margin-top: 14px; }
  .beat {
    display: grid; grid-template-columns: 30px 1fr; gap: 11px;
    align-items: start; padding: 7px 30px 7px 0;
  }
  .num {
    font: 700 12px/22px -apple-system, 'Helvetica Neue', sans-serif;
    text-align: center; height: 22px; border-radius: 6px;
    border: 1px solid var(--line); background: var(--surface); color: var(--ink2);
  }
  .say { font-size: 16px; line-height: 1.45; }
  .x {
    font: 700 10px/1 -apple-system, sans-serif; letter-spacing: .06em;
    color: var(--gold);
    border: 1px solid #e0d6c4; background: #f6f0e4;
    border-radius: 6px; padding: 3px 5px; margin-left: 5px; white-space: nowrap;
  }
  /* a SEQUENCE is one visual chunk — the beats inside keep their own numbers */
  .seq {
    border: 1px solid var(--line); border-left: 3px solid var(--gold);
    background: var(--surface); border-radius: 6px;
    padding: 9px 10px 8px; margin: 12px 0;
  }
  .seq > ol { margin: 0; }
  .seq .beat { padding-top: 5px; padding-bottom: 5px; }
  .seq .num { border-color: #e0d6c4; background: #f6f0e4; color: var(--gold); }
  .seqlab {
    display: block; font: 700 10px/1 -apple-system, 'Helvetica Neue', sans-serif;
    letter-spacing: .16em; text-transform: uppercase;
    color: var(--gold); padding: 1px 0 7px 1px;
  }
  /* the cast note — off the numbered spine, it is not a moment */
  .ref {
    display: block; border: 1px dashed var(--line); border-radius: 6px;
    background: var(--surface); padding: 9px 30px 9px 10px; margin: 12px 0;
  }
  .reflab {
    display: block; font: 700 10px/1 -apple-system, 'Helvetica Neue', sans-serif;
    letter-spacing: .16em; text-transform: uppercase;
    color: var(--ink2); padding-bottom: 6px;
  }
  .ref .say { color: var(--ink2); font-size: 15px; }
</style>

<div class="wrap">
  <h1>${esc(data.title)}</h1>
  <ol class="tl">
${data.blocks.map(block).join('\n')}
  </ol>
</div>

<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: '${data.chat}', sheet: '${data.sheet}' });
  window.__compareHelp({ html: '<b>${esc(count)} drawable moments, in your order.</b> '
    + 'Every one keeps its own number, including the ones inside a bracketed '
    + 'sequence. Tap the + on any moment to say what should move.' });
})();
</script>
`;

const out = path.join(ROOT, 'docs/story-timeline', (data.title.match(/\bv(\d+)\b/) ? 'timeline-v' + data.title.match(/\bv(\d+)\b/)[1] : 'timeline') + '.html');
fs.writeFileSync(out, html);
console.log('wrote ' + path.relative(ROOT, out) + '  (' + count + ' moments, ' + html.length + ' bytes)');

if (process.argv.includes('--post')) {
  const base = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
  fetch(base + '/api/chatfeed/page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: data.chat, title: data.title, html }),
  }).then((r) => r.json()).then((d) => console.log(JSON.stringify(d, null, 2)));
}
