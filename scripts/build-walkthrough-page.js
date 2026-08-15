#!/usr/bin/env node
/**
 * The walkthrough page — the image pipeline actually walked, one idea, in
 * order, with the real pictures at every stop.
 *
 *   node scripts/build-walkthrough-page.js [--dry-run]
 *
 * Sophie asked to be walked through the pipeline with an example rather than
 * told about it. This builds the page out of what the runs really produced —
 * docs/pipeline-walkthrough.json for the words, out/pipeline-walkthrough/
 * manifest-*.json for the pictures — so nothing on it is written from memory.
 *
 * THE SHAPE, and why: the finished picture goes at the TOP (house rule — the
 * deliverable is what she opens the page for), and everything under it is how
 * 12¢ got there. Pictures in rows of two, the a-vs-b pair as a `.duo`, and
 * every explanation behind the "?" rather than on the page.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'out', 'pipeline-walkthrough');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'image-pipeline-design';
const SHEET = 'walkthrough-carry-s4';         // carries the SHAPE of the item set
const VERSION = 'v1';
const DRY = process.argv.includes('--dry-run');

const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'pipeline-walkthrough.json'), 'utf8'));
const run = (id) => spec.runs.find((r) => r.id === id);
const mf = (id) => JSON.parse(fs.readFileSync(path.join(OUT, `manifest-${id}.json`), 'utf8'));
const pic = (id, cell) => mf(id).find((x) => x.cell === cell);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ORDER = ['books', 'groceries', 'laundry', 'boxes'];

/** four cells of one run, two to a row */
const grid = (id) => `<div class="imgrow">`
  + ORDER.map((c) => {
    const p = pic(id, c);
    return `<img src="${p.url}" alt="${esc(p.label)}" loading="lazy">`;
  }).join('')
  + `</div>`;

/** the findings of a run, as short lines — this IS the READ stop */
const found = (id) => `<ul class="found">`
  + run(id).findings.map((f) => `<li>${esc(f)}</li>`).join('')
  + `</ul>`;

const r1 = run('round1'), r2 = run('round2');
const cell1 = (c) => r1.cells.find((x) => x.id === c).text;
const cell2 = (c) => r2.cells.find((x) => x.id === c).text;

const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Too much to carry</title>
<link rel="stylesheet" href="/compare.css">
<style>
  /* The stop names are the map's own language — same road, seen from inside a
     single walk. Gold, small caps, the way the map labels a stop. */
  .stopname {
    font: 600 10px/1 -apple-system, sans-serif; letter-spacing: .14em;
    text-transform: uppercase; color: var(--gold);
    display: flex; align-items: center; gap: 8px; margin: 26px 0 6px;
  }
  .stopname::after { content: ''; flex: 1 1 auto; height: 1px; background: var(--line); }
  .price {
    font: 700 10px/1 -apple-system, sans-serif; letter-spacing: .06em;
    color: var(--ink2); border: 1px solid var(--line); border-radius: 3px;
    padding: 3px 5px; text-transform: none;
  }
  .found { margin: 8px 0 0; padding-left: 18px; }
  .found li { font: 14px/1.45 Georgia, serif; color: var(--ink2); margin-bottom: 7px; }
  /* the prompt halves, so the words that changed are readable as words */
  .halves { margin: 8px 0 0; }
  .half { margin-bottom: 10px; }
  .half b {
    display: block; font: 600 9.5px/1 -apple-system, sans-serif;
    letter-spacing: .1em; text-transform: uppercase; color: var(--ink2);
    margin-bottom: 3px;
  }
  .half p { font: 14px/1.45 Georgia, serif; margin: 0; }
  .half.was p { color: var(--ink2); }
  /* the lap is the loop, so the three stops inside it carry the map's spine */
  .lap { border-left: 2px solid var(--gold); padding-left: 12px; margin-left: 2px; }
</style>

<div class="wrap">
  <h1>Too much to carry — the pipeline walked (${VERSION})</h1>

  <div class="card" data-item="finished">
    <div class="stopname">The picture at the end <span class="price">12¢ all in</span></div>
    <img src="${pic('ladder', 'books').url}" alt="Books — the finished picture, medium"
         style="width:100%;height:auto;border-radius:6px;display:block">
  </div>

  <div class="lap">
    <div class="card" data-item="split">
      <div class="stopname">The split</div>
      <div class="halves">
        <div class="half"><b>Style — the same for all four, never retyped</b>
          <p>${esc(mf('round1')[0].promptStyle.split('\n\n')[0])}</p></div>
        <div class="half"><b>Content — one per picture, and the only thing that moves</b>
          <p>${esc(cell1('books'))}</p></div>
      </div>
    </div>

    <div class="card" data-item="fourup-1">
      <div class="stopname">Four-up, first lap <span class="price">2¢ · half a cent each</span></div>
      ${grid('round1')}
    </div>

    <div class="card" data-item="read-1">
      <div class="stopname">Read</div>
      ${found('round1')}
    </div>

    <div class="card" data-item="rewrite">
      <div class="stopname">Rewrite <span class="price">free</span></div>
      <div class="halves">
        <div class="half was"><b>Was</b><p>${esc(cell1('books'))}</p></div>
        <div class="half"><b>Now</b><p>${esc(cell2('books'))}</p></div>
      </div>
    </div>

    <div class="card" data-item="fourup-2">
      <div class="stopname">Four-up, second lap <span class="price">2¢ · half a cent each</span></div>
      ${grid('round2')}
    </div>

    <div class="card" data-item="read-2">
      <div class="stopname">Read again</div>
      ${found('round2')}
    </div>
  </div>

  <div class="card" data-item="spread">
    <div class="stopname">Spread — the same four prompts, one new style <span class="price">2¢</span></div>
    ${grid('spread')}
  </div>

  <div class="card" data-item="ladder">
    <div class="stopname">Ladder — the survivor only <span class="price">0.5¢ → 6¢</span></div>
    <div class="duo">
      <figure><span class="tag">half a cent</span><img src="${pic('round2', 'books').url}" alt="Books — the quarter-sheet cell"></figure>
      <figure><span class="tag">six cents</span><img src="${pic('ladder', 'books').url}" alt="Books — the medium render"></figure>
    </div>
  </div>
</div>

<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(SHEET)} });
  window.__compareHelp({ html:
    '<p><b>One idea walked down the whole road.</b> Everything on this page cost 12¢ together.</p>'
    + '<p>The gold line down the left is <b>the lap</b> — four-up, read, rewrite, and round again. '
    + 'That part is half a cent a look and free to think in, and it is where the prompt actually gets good.</p>'
    + '<p>The two stops under the lap are the ones that cost money, and nothing reaches them without '
    + 'earning it: <b>spread</b> is the same words in a new style, and <b>ladder</b> is one picture '
    + 'bought properly.</p>'
    + '<p>Tap any picture to see it big. Leave a note on anything with the + in its corner.</p>' });
})();
</script>
<style>[hidden]{display:none !important}</style>
`;

if (DRY) { console.log(html); process.exit(0); }

const title = `Too much to carry — the pipeline walked (${VERSION})`;
fetch(`${BASE}/api/chatfeed/page`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat: CHAT, title, html, reference: true, topic: 'pipelines' }),
}).then((r) => r.json()).then((j) => {
  console.log(JSON.stringify(j, null, 1));
  if (j.warnings) console.warn('\n⚠ fix these and re-post before finishing the turn');
}).catch((e) => { console.error(e); process.exit(1); });
