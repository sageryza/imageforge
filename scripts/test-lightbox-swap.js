#!/usr/bin/env node
// THE ORIGINAL SWAPS IN BEHIND THE THUMB, AND THE NEIGHBOURS ARE FETCHED AHEAD
// — in the ONE shared lightbox (2026-09-03, Sophie, stepping through a deck:
// "why does it fucking flash every time i tap right left" · "do a very broad
// search and fix this everywhere").
//
// Driven on the REAL asset-lightbox.js + asset-view.js in headless Chromium,
// every assertion a MEASUREMENT of what the stub server was asked for and
// what the <img> really carries — a page that paints the original cold and
// one that paints the thumb first are the same markup to a source assertion.
//   • opening a card paints its THUMB at once
//   • the original is requested, and replaces the thumb in place once loaded
//   • the pictures one step either side are requested before she steps
//   • a step to the next picture paints its thumb, and warms the one after
//   • source pins: Freeform and the Story Room hand the lightbox `warm`
//
//   node scripts/test-lightbox-swap.js
const fs = require('fs');
const path = require('path');
let pass = 0; const fails = [];
function is(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fails.push(`${name}\n    want ${JSON.stringify(want)}\n    got  ${JSON.stringify(got)}`);
}
function ok(name, cond) { is(name, Boolean(cond), true); }
const PUB = path.join(__dirname, '..', 'public');
const src = (f) => fs.readFileSync(path.join(PUB, f), 'utf8');
ok('Freeform hands the lightbox the neighbours to fetch ahead', /nav\.warm\s*=/.test(src('freeform.html')));
ok('the Story Room does too', /warm:\s*\[lbVers\[i-1\]/.test(src('scratchpad.html')));
ok('…in its template, not only the page', /warm:\s*\[lbVers\[i-1\]/.test(fs.readFileSync(path.join(__dirname, 'gen-scratchpad.py'), 'utf8')));
ok('the Set Pyramid slots wear no fade', !/\.slot img\{[^}]*animation/.test(src('set.html')));

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log(`lightbox swap: ${pass} passed, ${fails.length} failed (headless skipped)`); process.exit(fails.length ? 1 : 0); }
function exe() {
  for (const k of fs.readdirSync('/opt/pw-browsers')) {
    const p = path.join('/opt/pw-browsers', k, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const card = (n) => ({ id: 'c' + n, label: 'card ' + n, img: '/thumb/c' + n + '.png', full: '/full/c' + n + '.png',
  url: 'https://storage.googleapis.com/x/c' + n + '.webp' });
const DATA = { chat: 't', sheet: 'page-T', aspect: 'square', groups: [1, 2, 3, 4].map((n) => ({ items: [card(n)] })) };
const HTML = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/compare.css">
<div class="wrap"><div id="pageviews"></div></div>
<script src="/compare.js"></script><script src="/asset-lightbox.js"></script><script src="/asset-actions.js"></script>
<script src="/asset-view.js"></script><script src="/judge.js"></script><script src="/grid.js"></script><script src="/page-views.js"></script>
<script>window.__pageViews({ data: ${JSON.stringify(DATA)}, start: 'swipe' });</script>`;

(async () => {
  const browser = await chromium.launch({ executablePath: exe() });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const gets = [];
  await page.route('**/*', async (route) => {
    const req = route.request(); const p = new URL(req.url()).pathname;
    const json = (o) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(o) });
    if (p === '/page') return route.fulfill({ contentType: 'text/html', body: HTML });
    if (p.startsWith('/thumb/') || p.startsWith('/full/')) {
      gets.push(p);
      // the ORIGINAL is slow on purpose — locally both land in one tick, and
      // then a page painting the original cold looks identical to this one
      if (p.startsWith('/full/')) await new Promise((r) => setTimeout(r, 700));
      // cacheable, like the real thumb service — or the stub itself makes every picture a refetch
      return route.fulfill({ contentType: 'image/png', headers: { 'Cache-Control': 'public, max-age=3600' }, body: PNG });
    }
    if (req.method() === 'POST') return json({ ok: true });
    if (p === '/api/chatfeed/verdict') return json({ ok: true, items: {}, texts: {} });
    if (p === '/api/gallery/assets/notes') return json({ notes: [] });
    if (p === '/api/gallery/assets') return json({ assets: [], total: 0 });
    const f = path.join(PUB, p);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ path: f });
    return route.fulfill({ status: 200, body: '' });
  });
  await page.goto('http://swap.test/page');
  await page.waitForTimeout(500);
  for (let i = 0; i < 8; i++) { if (!(await page.$('.cmp-tour'))) break; await page.mouse.click(195, 780); await page.waitForTimeout(120); }
  await page.waitForTimeout(300);
  gets.length = 0;
  await page.click('#judge .jg-card img');
  await page.waitForTimeout(150);
  const first = await page.evaluate(() => (document.querySelector('#clightbox .clwrap img') || {}).getAttribute('src'));
  is('opening a card paints its THUMB at once', first, '/thumb/c1.png');
  ok('…and asks for the original behind it', gets.includes('/full/c1.png'));
  ok('…and for the next card\'s thumb before she steps', gets.includes('/thumb/c2.png'));
  await page.waitForTimeout(900);
  const later = await page.evaluate(() => (document.querySelector('#clightbox .clwrap img') || {}).getAttribute('src'));
  is('once the original lands it replaces the thumb in place', later, '/full/c1.png');
  gets.length = 0;
  await page.evaluate(() => document.querySelector('#clightbox .lbzone.next').click());
  await page.waitForTimeout(150);
  const second = await page.evaluate(() => (document.querySelector('#clightbox .clwrap img') || {}).getAttribute('src'));
  is('a step paints the next thumb', second, '/thumb/c2.png');
  ok('…and the one after is fetched ahead now', gets.includes('/thumb/c3.png'));
  await browser.close();
  console.log(`lightbox swap: ${pass} passed, ${fails.length} failed`);
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(fails.length ? 1 : 0);
})();
