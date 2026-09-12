#!/usr/bin/env node
// THE LIST · TILES · 3/4 SWITCH — /viewswitch.js + /viewswitch.css (2026-09-12,
// Sophie, on Stitch: "could you reuse the shell so I can switch between tiles
// and list view?").
//
// The switch had been hand-copied once already (Playground → Footage) and
// Stitch would have been the third copy — the tritoggle shape. ONE file now,
// and the checks are the tritoggle test's: (1) nobody keeps a second copy —
// no page carries its own `.viewtog` paint or its own curView/localStorage
// reader, (2) every page that has the box links both halves, and (3) the box
// really works in a browser: the ids the older tests tap, the number segment
// stepping 3 → 4 → 3, `--cols` landing on the root, the page's own storage
// key, and an adopted box wired exactly like a built one.
//
//   node scripts/test-viewswitch.js
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
let fails = 0;
const ok = (cond, what) => { if (cond) console.log('  ok   ' + what); else { console.log('  FAIL ' + what); fails++; } };

const PAGES = ['promptlab.html', 'footage.html', 'stitch.html'];
for (const f of PAGES) {
  const s = fs.readFileSync(path.join(PUB, f), 'utf8');
  ok(/<link rel="stylesheet" href="\/viewswitch\.css">/.test(s) && /<script src="\/viewswitch\.js"><\/script>/.test(s), f + ' links both halves');
  ok(!/\.viewtog\s*\{/.test(s), f + ' keeps no paint of its own');
  ok(!/localStorage\.getItem\('[a-z]+_view'\)/.test(s) && !/localStorage\.setItem\('[a-z]+_cols'/.test(s), f + ' keeps no reader of its own');
  ok(/window\.__viewSwitch\(\{/.test(s), f + ' asks the shared file');
}
ok((fs.readFileSync(path.join(PUB, 'viewswitch.css'), 'utf8').match(/\.viewtog\s*\{/g) || []).length === 1, 'viewswitch.css is the one paint');

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) { console.log('viewswitch: playwright not installed — browser half skipped'); process.exit(fails ? 1 : 0); }
}
function exe() {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  for (const d of fs.readdirSync(root).filter((n) => /^chromium-\d/.test(n))) {
    const p = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}
// two mounts on one page: an EMPTY one the file builds into, and one that
// already carries the markup the older pages keep (adopted, ids and all)
const HTML = `<!doctype html><html><head><link rel="stylesheet" href="/viewswitch.css"><script src="/viewswitch.js"></script></head>
<body style="width:390px">
<div id="built"></div>
<div id="kept"><div class="viewtog" role="group"><button type="button" id="v-list">List</button><button type="button" id="v-tiles">Tiles</button><button type="button" class="colseg" id="v-cols"></button></div></div>
<div id="a"></div><div id="b" hidden></div>
<script>
  window.__seen = [];
  window.__built = window.__viewSwitch({ mount: '#built', key: 'tvs', cols: [3, 4], view: 'tiles', onView: function (v) { window.__seen.push(v); } });
</script></body></html>`;
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML);
});
(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  try {
    await page.goto(base + '/x', { waitUntil: 'load' });
    ok(await page.evaluate(() => !!document.querySelector('#built .viewtog') && document.querySelectorAll('#built .viewtog button').length === 3), 'an empty mount gets the one box built, three segments');
    ok(await page.evaluate(() => document.querySelector('#built #v-tiles').classList.contains('on') && window.__seen[0] === 'tiles'), 'it opens on the view the page asked for and says so');
    ok(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cols').trim() === '3' && document.querySelector('#built #v-cols').textContent === '3'), '`--cols` lands on the root and the segment says the number');
    const m = await page.evaluate(() => {
      const b = document.querySelector('#built .viewtog'), cs = getComputedStyle(b);
      return { radius: cs.borderTopLeftRadius, border: cs.borderTopWidth, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height };
    });
    ok(m.radius === '6px' && m.border === '1px', 'a rounded rectangle at the house 6px, one line (' + m.radius + ', ' + m.border + ')');
    ok(m.h > 26 && m.h < 40 && m.w > 100, 'the box is one 30-ish px row (' + Math.round(m.w) + 'x' + Math.round(m.h) + ')');
    await page.click('#built #v-cols');
    ok(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cols').trim() === '4' && localStorage.getItem('tvs_cols') === '4'), 'the number segment steps to 4 and remembers it under the page\'s own key');
    await page.click('#built #v-cols');
    ok(await page.evaluate(() => document.querySelector('#built #v-cols').textContent === '3'), 'and back to 3 — two stops');
    await page.click('#built #v-list');
    ok(await page.evaluate(() => localStorage.getItem('tvs_view') === 'list' && window.__seen.join(',') === 'tiles,list' && document.querySelector('#built #v-list').classList.contains('on')), 'a tap on List calls the page back and remembers it');
    // adopt
    const adopted = await page.evaluate(() => {
      const kept = document.querySelector('#kept .viewtog');
      const vs = window.__viewSwitch({ mount: '#kept', key: 'tvk', onView: function (v) { document.getElementById('a').hidden = v === 'tiles'; document.getElementById('b').hidden = v !== 'tiles'; } });
      return { same: vs.box === kept, boxes: document.querySelectorAll('#kept .viewtog').length, view: vs.view(), cols: vs.cols() };
    });
    ok(adopted.same && adopted.boxes === 1, 'a mount already carrying the box is ADOPTED, never doubled');
    ok(adopted.view === 'list' && adopted.cols === 3, 'with nothing remembered it opens on list, three across');
    await page.click('#kept #v-tiles');
    ok(await page.evaluate(() => document.getElementById('a').hidden && !document.getElementById('b').hidden && localStorage.getItem('tvk_view') === 'tiles'), 'the adopted box swaps the page\'s two surfaces through the callback');
    ok(errors.length === 0, 'no page errors');
  } finally {
    await browser.close(); server.close();
  }
  console.log(fails ? `\n${fails} FAILED` : '\nAll good.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
