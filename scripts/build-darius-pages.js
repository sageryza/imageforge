#!/usr/bin/env node
/* build-darius-pages.js — build the three Darius pages from the banked
   transcripts (Aug 2026).

   Two of the three are CUT PICKERS (public/picker-shell.html + /picker.js):
   PROOF and THE HEART. Each candidate moment gets its own small mount holding
   a window of transcript with the suggested span already seeded, so a page is
   a short list of playable spans rather than a 10,000-word wall she has to
   scroll. The third page is a reading pass over the speculative material —
   Sophie asked for a transcript pass there, not clips.

   Word times are SEGMENT-INTERPOLATED (YouTube captions carry no word times).
   That is fine for the picker: the ▶ pads each side and the real cut still
   goes through editor.js's precise cutter.

     node scripts/build-darius-pages.js            # write the html
     node scripts/build-darius-pages.js --post     # …and POST them as pages

   Transcripts come from GET /api/nde/videos/:id, cached under
   .darius-cache/ so a rebuild costs nothing.
*/
const fs = require('fs');
const path = require('path');

const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'darius-interview-videos';
const ROOT = path.join(__dirname, '..');
const CACHE = path.join(ROOT, '.darius-cache');
const OUT = path.join(ROOT, '.darius-pages');
const SPEC = require('./darius-moments.json');
const SPECULATIVE = require('./darius-speculative.json');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hms = (t) => Math.floor(t / 60) + ':' + String(Math.round(t % 60)).padStart(2, '0');

async function transcript(videoId) {
  fs.mkdirSync(CACHE, { recursive: true });
  const p = path.join(CACHE, videoId + '.json');
  if (!fs.existsSync(p)) {
    const r = await fetch(BASE + '/api/nde/videos/' + videoId);
    if (!r.ok) throw new Error('fetch ' + videoId + ': ' + r.status);
    fs.writeFileSync(p, await r.text());
  }
  const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  return (doc.video || doc).transcript.segments;
}

/* Every word in the file, with an interpolated absolute time. [Music] cues and
   the caption tracks' ">>" speaker arrows are dropped — neither is speech, and
   both would be tappable words she could accidentally pick. */
function wordsOf(segments) {
  const out = [];
  for (const s of segments) {
    const toks = String(s.text).replace(/\[[^\]]*\]/g, ' ').replace(/>>/g, ' ')
      .split(/\s+/).filter(Boolean);
    const dur = s.dur || 2;
    toks.forEach((w, i) => out.push({ w, t: +(s.start + (i / toks.length) * dur).toFixed(2) }));
  }
  return out;
}

/* The window she sees, plus the seeded pick expressed as indexes into it. */
function windowFor(all, m) {
  const words = all.filter((x) => x.t >= m.ctx0 && x.t <= m.ctx1);
  if (!words.length) throw new Error('empty window for ' + m.id);
  let a = words.findIndex((x) => x.t >= m.pick0);
  let z = -1;
  for (let i = 0; i < words.length; i++) if (words[i].t <= m.pick1) z = i;
  if (a < 0) a = 0;
  if (z <= a) z = words.length - 1;
  return { words, seed: { a, z } };
}

function pickerPage(title, intro, moments, built) {
  const sheet = intro.sheet;
  const blocks = moments.map((m, i) => {
    const s = SPEC.sources[m.src];
    return '<div class="mom">\n' +
      '  <h2>' + (i + 1) + '. ' + esc(m.label) + '</h2>\n' +
      '  <div class="meta">' + esc(s.title) + ' · ' + hms(m.pick0) + '</div>\n' +
      '  <div class="why">' + esc(m.why) + '</div>\n' +
      '  <div id="m-' + m.id + '"></div>\n' +
      '</div>';
  }).join('\n');

  const calls = moments.map((m) => {
    const b = built[m.id];
    return '  window.__cutPicker({ mount:"#m-' + m.id + '", id:' + JSON.stringify(m.id) +
      ', chat:' + JSON.stringify(CHAT) + ', sheet:' + JSON.stringify(sheet) +
      ', src:' + JSON.stringify(SPEC.sources[m.src].videoId) +
      ', words:' + JSON.stringify(b.words) +
      ', seed:[' + JSON.stringify(b.seed) + '] });';
  }).join('\n');

  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  .mom{margin:0 0 30px;}
  .mom h2{font-size:1.08em; margin:0 0 2px; padding-right:56px;}
  .mom .meta{font:11px/1.4 -apple-system,system-ui,sans-serif; letter-spacing:.04em;
    text-transform:uppercase; color:var(--ink2); margin:0 0 6px;}
  .mom .why{font-size:14.5px; color:var(--ink2); margin:0 0 8px;}
</style>

<div class="wrap">
  <h1>${esc(title)}</h1>
${blocks}
</div>

<script src="/compare.js"></script>
<script src="/picker.js"></script>
<script>
(function () {
${calls}
})();
</script>
`;
}

/* Quotes are lifted from the captions by time range, never retyped — the
   speculative page's whole value is that it says what he actually said. Whole
   CAPTION LINES, not interpolated words: word times are estimates, and a quote
   that opens mid-word reads as a transcription error rather than a cut. */
function readingPage(title, groups, segs) {
  const blocks = groups.map((g, i) => {
    const quotes = g.quotes.map((q) => {
      const text = segs[q.src]
        .filter((s) => s.start + (s.dur || 0) > q.t0 && s.start < q.t1)
        .map((s) => String(s.text).replace(/\[[^\]]*\]/g, ' ').replace(/>>/g, ' '))
        .join(' ').replace(/\s+/g, ' ').trim();
      return '    <div class="q"><span class="at">' + esc(SPEC.sources[q.src].title) + ' · ' +
        hms(q.t0) + '</span>' + esc(text) + '</div>';
    }).join('\n');
    return '  <div class="topic" data-item="' + esc(g.id) + '">\n' +
      '    <h2>' + (i + 1) + '. ' + esc(g.label) + '</h2>\n' +
      '    <div class="draw">' + esc(g.draw) + '</div>\n' +
      quotes + '\n  </div>';
  }).join('\n');

  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  .topic{position:relative; border:1px solid var(--line,#d8cfc0); border-radius:6px;
    background:var(--paper); padding:12px 12px 14px; margin:0 0 14px;}
  .topic h2{font-size:1.05em; margin:0 0 8px; padding-right:56px;}
  .q{font-size:15px; line-height:1.55; margin:0 0 10px;}
  .q:last-child{margin-bottom:0;}
  .at{display:block; font:11px/1.4 -apple-system,system-ui,sans-serif;
    letter-spacing:.04em; text-transform:uppercase; color:var(--ink2); margin:0 0 2px;}
  .draw{font-size:13.5px; color:var(--ink2); margin:0 0 10px;}
</style>

<div class="wrap">
  <h1>${esc(title)}</h1>
${blocks}
</div>

<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(SPECULATIVE.sheet)} });
})();
</script>
`;
}

async function post(title, html) {
  const r = await fetch(BASE + '/api/chatfeed/page', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title, html }),
  });
  const j = await r.json().catch(() => ({}));
  console.log(r.ok ? 'posted' : 'FAILED', '·', title, '·', JSON.stringify(j));
  return j;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const segs = {};   // raw caption lines, for the reading page
  const words = {};  // interpolated word times, for the pickers
  for (const k of Object.keys(SPEC.sources)) {
    segs[k] = await transcript(SPEC.sources[k].videoId);
    words[k] = wordsOf(segs[k]);
  }

  const built = {};
  for (const m of [...SPEC.proof, ...SPEC.heart]) built[m.id] = windowFor(words[m.src], m);

  const pages = [
    ['Proof — the two Darius interviews (v1)',
      pickerPage('Proof — the two Darius interviews (v1)', { sheet: 'darius-proof-v1' }, SPEC.proof, built)],
    ['The heart — how an out-of-body experience works (v1)',
      pickerPage('The heart — how an out-of-body experience works (v1)', { sheet: 'darius-heart-v1' }, SPEC.heart, built)],
    [SPECULATIVE.title, readingPage(SPECULATIVE.title, SPECULATIVE.groups, segs)],
  ];

  for (const [title, html] of pages) {
    const f = path.join(OUT, title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.html');
    fs.writeFileSync(f, html);
    console.log('wrote', path.relative(ROOT, f), (html.length / 1024).toFixed(0) + 'KB');
    if (process.argv.includes('--post')) await post(title, html);
  }
})().catch((e) => { console.error(e); process.exit(1); });
