// fruit-compare-page.js — post the whole fruit deck into the chat's Compare tab.
//
//   node scripts/fruit-compare-page.js [--chat favorite-fruit-chart] [--dry]
//
// Built from public/compare-shell.html: /compare.css + /compare.js only, no
// hand-rolled look and no hand-rolled pill. Every fruit carries data-item, so
// __compareNotes gives each one its own note box — that is how "redo the
// banana" gets said on the banana.
//
// The two groups are kept apart on purpose. They were made differently and
// they are not the same resolution, which is the one thing worth deciding
// from this page, so the headings say which is which rather than mixing them
// into one wall of fruit.

const fs = require('fs');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const CHAT = flag('chat', 'favorite-fruit-chart');
const BASE = flag('base', 'https://imageforge-q125.onrender.com');
const SHEET = 'all-fruit-v1';
const DRY = args.includes('--dry');

const singles = JSON.parse(fs.readFileSync(__dirname + '/fruit-chart/uploaded.json', 'utf8'));
const cells = JSON.parse(fs.readFileSync('/home/user/out/fruit2/uploaded.json', 'utf8'));
const GRID = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/fruit/sheets/sheet-2.webp';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// width/height on every img: without them a lazy image lays out at 0px, the
// document collapses below the viewport, and the autoscroll pill has nothing
// to scroll (the note at the top of compare.css — Sophie hit it for real).
const fig = f => `<figure data-item="${esc(f.id)}">`
  + `<img src="${esc(f.url)}" alt="${esc(f.name)}" width="512" height="512" loading="lazy">`
  + `<figcaption>${esc(f.name)}</figcaption></figure>`;

const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>All 36 fruits — the swipe deck</title>
<link rel="stylesheet" href="/compare.css">

<div class="wrap">
  <h1>All 36 fruits — the swipe deck</h1>

  <div class="card">
    <h2>The grid sheet — nine at once</h2>
    <div class="imgrow"><img src="${esc(GRID)}" alt="the nine-fruit grid sheet" width="1024" height="1024"></div>
  </div>

  <div class="card">
    <h2>Cut from that grid — about 290px each</h2>
    <div class="imgrow three">${cells.map(fig).join('')}</div>
  </div>

  <div class="card">
    <h2>Drawn one at a time — 1024px each</h2>
    <div class="imgrow three">${singles.map(fig).join('')}</div>
  </div>
</div>

<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(SHEET)} });
  window.__compareHelp({ html: '<b>Every fruit in the deck.</b> The nine at the '
    + 'top were drawn as one grid and cut apart; the rest were drawn one at a '
    + 'time, which is why they are sharper. Tap the + under any fruit to say '
    + 'what to redo.' });
})();
</script>`;

if (DRY) { fs.writeFileSync('/home/user/out/fruit2/compare.html', html); console.log('wrote /home/user/out/fruit2/compare.html (' + html.length + ' bytes)'); return; }

fetch(`${BASE}/api/chatfeed/page`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat: CHAT, title: 'All 36 fruits — the swipe deck', html }),
}).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 1)));
