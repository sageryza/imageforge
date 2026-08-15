#!/usr/bin/env node
/**
 * The walkthrough page — the image pipeline actually walked, one idea, shown
 * as the three comparisons it really is.
 *
 *   node scripts/build-walkthrough-page.js [--dry-run]
 *
 * Sophie asked to be walked through the pipeline with an example rather than
 * told about it. This builds the page out of what the runs really produced —
 * docs/pipeline-walkthrough.json for the words, out/pipeline-walkthrough/
 * manifest-*.json for the pictures — so nothing on it is written from memory.
 *
 * V2 IS A DIFFERENT SHAPE, AND SOPHIE'S NOTE IS WHY: "if you make a compare
 * page, it might show what we're comparing things better." V1 walked the road
 * in order — round 1 in one card, round 2 in a card further down — so the two
 * things you are meant to weigh against each other were a scroll apart. That
 * is exactly the house rule about compared things sitting SIDE BY SIDE.
 *
 * So the page is now three comparisons, each a column of `.duo` pairs, one per
 * hairline tab — because these are three separate questions and she switches
 * between them rather than reading them in a row:
 *
 *   BEFORE / AFTER   what one lap of the loop bought      (the same words, rewritten)
 *   TWO STYLES       what the content/style split bought  (the same words, new reference)
 *   TWO PRICES       what a rung up the ladder bought     (the same words, more money)
 *
 * Every pair holds ONE variable still and moves ONE — which is the only way a
 * comparison says anything. The prompt sits under the pair it belongs to,
 * because on this road the prompt IS the thing being compared; the pictures
 * are just how you read it.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'out', 'pipeline-walkthrough');
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'image-pipeline-design';
// The sheet name carries the SHAPE of the item set: v1 was four single cards,
// v2 is nine pairs. A rebuild under the old name would silently re-point any
// note she left onto different content.
const SHEET = 'walkthrough-carry-pairs-s10';
const VERSION = 'v2';
const DRY = process.argv.includes('--dry-run');

const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'pipeline-walkthrough.json'), 'utf8'));
const run = (id) => spec.runs.find((r) => r.id === id);
const mf = (id) => JSON.parse(fs.readFileSync(path.join(OUT, `manifest-${id}.json`), 'utf8'));
const pic = (id, cell) => mf(id).find((x) => x.cell === cell);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ORDER = ['books', 'groceries', 'laundry', 'boxes'];
const NAME = { books: 'Books', groceries: 'Groceries', laundry: 'Laundry', boxes: 'Boxes' };
const text = (id, cell) => run(id).cells.find((c) => c.id === cell).text;

/* What changed between v1 and v2, per subject — written by looking at the two
   pictures, not by summarising the prompt. One line each: what the first try
   did wrong, and the words that fixed it. */
const CHANGED = {
  books: 'The first is a woman holding books — nothing is going wrong. The rewrite makes the stack taller than her head and drops three off the front.',
  groceries: 'Four full bags, under control. The rewrite splits the bag, so the fruit is already on the floor.',
  laundry: 'Nobody asked for a basket; the model added one, and a basket is tidy. The rewrite bans it, so the pile swallows her face.',
  boxes: 'A calm walk upstairs. The rewrite tilts the top box off the stack and moves the camera above and behind him.',
};

/** one comparison row: a .duo pair, its own note handle, its own words under it */
function pair(id, aUrl, aTag, aAlt, bUrl, bTag, bAlt, head, under) {
  return `<div class="card" data-item="${id}">
    <h3>${esc(head)}</h3>
    <div class="duo">
      <figure><span class="tag">${esc(aTag)}</span><img src="${aUrl}" alt="${esc(aAlt)}" loading="lazy"></figure>
      <figure><span class="tag">${esc(bTag)}</span><img src="${bUrl}" alt="${esc(bAlt)}" loading="lazy"></figure>
    </div>
    ${under}
  </div>`;
}

const words = (label, body, dim) =>
  `<div class="half${dim ? ' was' : ''}"><b>${esc(label)}</b><p>${esc(body)}</p></div>`;

// ── tab 1: what one lap bought ────────────────────────────────────────────
const lap = ORDER.map((c) => pair(
  `lap-${c}`,
  pic('round1', c).url, 'first try', `${NAME[c]} — first try`,
  pic('round2', c).url, 'after', `${NAME[c]} — after the rewrite`,
  NAME[c],
  `<p class="changed">${esc(CHANGED[c])}</p>`
  + `<div class="halves">${words('Was', text('round1', c), true)}`
  + `${words('Now', text('round2', c))}</div>`,
)).join('');

// ── tab 2: what the split bought ──────────────────────────────────────────
const styles = ORDER.map((c) => pair(
  `style-${c}`,
  pic('round2', c).url, 'watercolour', `${NAME[c]} — watercolour`,
  pic('spread', c).url, 'pastel', `${NAME[c]} — pastel`,
  NAME[c],
  '',
)).join('');

// ── tab 3: what a rung bought ─────────────────────────────────────────────
const prices = pair(
  'price-books',
  pic('round2', 'books').url, 'half a cent', 'Books — the quarter-sheet cell',
  pic('ladder', 'books').url, 'six cents', 'Books — the medium render',
  'Books',
  `<p class="changed">Not the same picture bigger — a different drawing of the same sentence. She stands `
  + `beside the stack instead of behind it, and her face does something. A rung up the ladder buys the `
  + `PROMPT a better draw, never a picture you already liked.</p>`,
);

const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Too much to carry</title>
<link rel="stylesheet" href="/compare.css">
<style>
  /* the hairline tab row. The 56px reserve is load-bearing — the injected
     autoscroll pill owns the top-right corner — and the sliding line measures
     (100% - 56px)/3 because an abspos child resolves against the PADDING box
     and there are THREE tabs. */
  .tabs {
    position: relative; display: flex; border-bottom: 1px solid var(--line);
    margin: 0 0 6px; padding-right: 56px;
  }
  .tab {
    flex: 1 1 0; min-width: 0; padding: 7px 4px 9px;
    border: none; background: none; cursor: pointer;
    font: 10px/1 -apple-system, sans-serif; letter-spacing: .08em;
    text-transform: uppercase; color: var(--ink2);
    -webkit-tap-highlight-color: transparent;
  }
  .tab.on { color: var(--ink); }
  .tabs::after {
    content: ''; position: absolute; left: 0; bottom: -1px; height: 2px;
    width: calc((100% - 56px) / 3); background: var(--ink);
    transform: translateX(0); transition: transform .2s ease;
  }
  .tabs[data-on="1"]::after { transform: translateX(100%); }
  .tabs[data-on="2"]::after { transform: translateX(200%); }
  /* what MOVED between the two sides, said once per tab, above the pairs */
  .moved {
    font: 13px/1.45 Georgia, serif; color: var(--ink2);
    margin: 10px 2px 4px; padding-right: 56px;
  }
  .moved b { color: var(--ink); }
  .card h3 { font-size: 16px; margin-bottom: 6px; }
  .changed { font: 13px/1.45 Georgia, serif; color: var(--ink2); margin: 8px 0 0; }
  .halves { margin: 10px 0 0; }
  .half { margin-bottom: 9px; }
  .half b {
    display: block; font: 600 9px/1 -apple-system, sans-serif;
    letter-spacing: .1em; text-transform: uppercase; color: var(--ink2);
    margin-bottom: 3px;
  }
  .half p { font: 13px/1.4 Georgia, serif; margin: 0; }
  .half.was p { color: var(--ink2); }
</style>

<div class="wrap">
  <h1>Too much to carry — one idea, three comparisons (${VERSION})</h1>

  <div class="tabs" id="tabs" data-on="0" data-nostop>
    <button class="tab on" data-tab="0" type="button">Before / after</button>
    <button class="tab" data-tab="1" type="button">Two styles</button>
    <button class="tab" data-tab="2" type="button">Two prices</button>
  </div>

  <div id="view-0">
    <p class="moved">Same subject, same style, same 2¢ a sheet. <b>Only the words moved.</b></p>
    ${lap}
  </div>

  <div id="view-1" hidden>
    <p class="moved">Same words on both sides, character for character. <b>Only the style reference moved</b> — 2¢ for all four.</p>
    ${styles}
  </div>

  <div id="view-2" hidden>
    <p class="moved">Same words, same style. <b>Only the money moved.</b></p>
    ${prices}
  </div>
</div>

<script src="/compare.js"></script>
<script>
(function () {
  var tabs = document.getElementById('tabs');
  tabs.addEventListener('click', function (e) {
    var b = e.target.closest('.tab'); if (!b) return;
    var n = b.getAttribute('data-tab');
    tabs.setAttribute('data-on', n);
    tabs.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('on', t === b); });
    for (var i = 0; i < 3; i++) document.getElementById('view-' + i).hidden = String(i) !== n;
    window.scrollTo(0, 0);
  });

  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(SHEET)} });
  window.__compareHelp({ html:
    '<p><b>One idea walked down the whole road.</b> Everything here cost 12¢ together.</p>'
    + '<p>Each tab holds one comparison, and each pair holds everything still but one thing:</p>'
    + '<p><b>Before / after</b> — what one lap of the loop bought. Four short first-try prompts, '
    + 'then the same four rewritten after looking. Two low sheets, 2¢ each, half a cent a picture.</p>'
    + '<p><b>Two styles</b> — the same words with a different reference attached. Nothing was '
    + 'retyped. This is the one that pays off when the direction changes.</p>'
    + '<p><b>Two prices</b> — the winning prompt as a quarter of a cheap sheet, and bought properly '
    + 'at six cents.</p>'
    + '<p>Tap any picture to see it big. Leave a note on anything with the + in its corner.</p>' });
})();
</script>
<style>[hidden]{display:none !important}</style>
`;

if (DRY) { console.log(html); process.exit(0); }

const title = `Too much to carry — one idea, three comparisons (${VERSION})`;
fetch(`${BASE}/api/chatfeed/page`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat: CHAT, title, html, reference: true, topic: 'pipelines' }),
}).then((r) => r.json()).then((j) => {
  console.log(JSON.stringify(j, null, 1));
  if (j.warnings) console.warn('\n⚠ fix these and re-post before finishing the turn');
}).catch((e) => { console.error(e); process.exit(1); });
