// fruit-quality-page.js — the high-vs-low quality test, as a Compare page.
//
//   node scripts/fruit-quality-page.js [--chat favorite-fruit-chart] [--dry]
//
// Three subjects rendered twice each, same prompt, same size, only `quality`
// changed — the one variable, so the page answers one question. An A-vs-B pair
// is a `.duo` with its labels ON TOP, which is the house comparison unit.
//
// The deck itself runs at MEDIUM; this exists to decide whether that is the
// right rung, so the prices are on the page — high is 12x low.

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const CHAT = flag('chat', 'favorite-fruit-chart');
const BASE = flag('base', 'https://imageforge-q125.onrender.com');
const SHEET = 'quality-ladder-v2';
const DRY = args.includes('--dry');

const shots = JSON.parse(fs.readFileSync(path.join(__dirname, 'fruit-chart/qtest-uploaded.json'), 'utf8'));
// Cheapest first, left to right, so the eye reads the ladder in the direction
// the price climbs. Medium is the rung both decks actually use.
const RUNGS = [['low', '2c'], ['medium', '6c'], ['high', '25c']];
const NAMES = { strawberry: 'Strawberry', pomegranate: 'Pomegranate', broccoli: 'Broccoli' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const subjects = [...new Set(shots.map(s => s.subject))];
const pick = (sub, q) => shots.find(s => s.subject === sub && s.quality === q);

const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Low, medium, high — same prompt, same size</title>
<link rel="stylesheet" href="/compare.css">

<div class="wrap">
  <h1>Low, medium, high — same prompt, same size</h1>
${subjects.map(sub => {
    const cells = RUNGS.map(([q, price]) => [pick(sub, q), q, price]).filter(c => c[0]);
    if (cells.length < 2) return '';
    // .duo is the house comparison unit (labels ON TOP); the only change for a
    // three-way is its column count, so all three sit on ONE line — she asked
    // for medium "on the same line", not underneath.
    return `  <div class="card" data-item="${esc(sub)}">
    <h2>${esc(NAMES[sub] || sub)}</h2>
    <div class="duo" style="grid-template-columns:repeat(${cells.length},1fr)">
${cells.map(([s, q, price]) =>
      `      <figure><span class="tag">${esc(q)} · ${esc(price)}</span><img src="${esc(s.url)}" alt="${esc(sub)} ${esc(q)}" width="1024" height="1024" loading="lazy"></figure>`).join('\n')}
    </div>
  </div>`;
  }).join('\n')}
</div>

<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify(SHEET)} });
  window.__compareHelp({ html: '<b>Only the quality setting changed.</b> Same '
    + 'prompt, same 1024x1024, same style reference. Low is 2c an image, medium '
    + '(what both decks use) is 6c, high is 25c. Tap a picture to see it big.' });
})();
</script>`;

if (DRY) {
  fs.writeFileSync('/home/user/out/qtest/compare.html', html);
  console.log(`wrote /home/user/out/qtest/compare.html (${html.length} bytes), ${subjects.length} pairs`);
  return;
}

fetch(`${BASE}/api/chatfeed/page`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat: CHAT, title: 'Low, medium, high — same prompt, same size', html }),
}).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 1)));
