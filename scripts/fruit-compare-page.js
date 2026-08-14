// fruit-compare-page.js — post the fruit and vegetable decks into the Compare tab.
//
//   node scripts/fruit-compare-page.js [--chat favorite-fruit-chart] [--dry]
//                                      [--supersede <pageId>]
//
// Built from public/compare-shell.html: /compare.css + /compare.js only, no
// hand-rolled look and no hand-rolled pill. Every item carries data-item, so
// __compareNotes gives each one its own note box — that is how "redo the
// banana" gets said on the banana.
//
// THE LINKS SIT AT THE TOP, WRITTEN OUT AS URLS (Aug 2026, Sophie: "put the
// link in the compare page with the URL so it reads as what it is"). The
// pickers are ordinary web pages, not something this page can embed: the
// Compare tab drives its own autoscroll and a tap is how it pauses, so a
// deck's own taps and drags would fight it. A link costs nothing and works.

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const CHAT = flag('chat', 'favorite-fruit-chart');
const BASE = flag('base', 'https://imageforge-q125.onrender.com');
const SUPERSEDE = flag('supersede');
const SHEET = 'all-food-v2';
const DRY = args.includes('--dry');

const read = f => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const RETIRED = new Set(['27-dragonfruit']);

function deck(sources) {
  const byId = new Map();
  for (const s of sources) for (const f of read(s)) byId.set(f.id, f);
  for (const id of RETIRED) byId.delete(id);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}
const fruits = deck(['fruit-chart/uploaded.json', 'fruit-chart/v2-uploaded.json', 'fruit-chart/v3-uploaded.json']);
const veg = deck(['fruit-chart/veg-uploaded.json']);

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// width/height on every img: without them a lazy image lays out at 0px, the
// document collapses below the viewport, and the autoscroll pill has nothing
// to scroll (the note at the top of compare.css — Sophie hit it for real).
const fig = f => `<figure data-item="${esc(f.id)}">`
  + `<img src="${esc(f.url)}" alt="${esc(f.name)}" width="512" height="512" loading="lazy">`
  + `<figcaption>${esc(f.name)}</figcaption></figure>`;

const LINKS = [
  ['Fruit', `${BASE}/fruit?p=fruit-test&who=b3d9753954d3`],
  ['Vegetables', `${BASE}/fruit?p=veg-test&who=aebd6ca1cd7a`],
  ['The chart', `${BASE}/fruitchart?p=fridge-fruit`],
];

const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>The decks — ${fruits.length} fruit, ${veg.length} vegetables</title>
<link rel="stylesheet" href="/compare.css">

<div class="wrap">
  <h1>The decks — ${fruits.length} fruit, ${veg.length} vegetables</h1>

  <div class="card">
    ${LINKS.map(([label, url]) =>
      `<p style="margin:0 0 12px"><b>${esc(label)}</b><br>`
      + `<a href="${esc(url)}" style="word-break:break-all">${esc(url)}</a></p>`).join('')}
  </div>

  <div class="card">
    <h2>Vegetables — two per sheet, cut apart</h2>
    <div class="imgrow three">${veg.map(fig).join('')}</div>
  </div>

  <div class="card">
    <h2>Fruit</h2>
    <div class="imgrow three">${fruits.map(fig).join('')}</div>
  </div>
</div>

<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(SHEET)} });
  window.__compareHelp({ html: '<b>Every card in both decks.</b> The links at '
    + 'the top open the real pickers — they are ordinary web pages, so they '
    + 'cannot live inside this one. Tap the + under any picture to say what to '
    + 'redo.' });
})();
</script>`;

if (DRY) {
  fs.writeFileSync('/home/user/out/veg/compare.html', html);
  console.log(`wrote /home/user/out/veg/compare.html (${html.length} bytes) · ${fruits.length} fruit, ${veg.length} veg`);
  return;
}

(async () => {
  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title: `The decks — ${fruits.length} fruit, ${veg.length} vegetables`, html }),
  });
  const d = await r.json();
  console.log(JSON.stringify(d, null, 1));
  // A new version is a NEW page; the one it replaces is superseded, never
  // deleted (compare-pages contract).
  if (SUPERSEDE) {
    const s = await fetch(`${BASE}/api/chatfeed/page/${SUPERSEDE}/supersede`, { method: 'POST' });
    console.log('superseded', SUPERSEDE, s.status);
  }
})();
