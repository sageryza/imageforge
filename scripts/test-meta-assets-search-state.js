#!/usr/bin/env node
// META ASSETS — the search's EMPTY STATE tells the truth (2026-09-01, Sophie's
// screenshot: "mirror" → "No images match that." over a list that held 1,378
// hits). Drives the REAL public/assets.html against a stub whose q= answers
// are SLOW and paged, and asks what the page SAYS at each moment:
//   1. while the server is being asked, the line reads "Searching…", never
//      "No images match that." — the client filter over the 150 loaded tiles
//      answers instantly and used to write the verdict before the server spoke;
//   2. the FIRST page of hits PAINTS before the second page has landed —
//      a common word is many pages and she was shown nothing until the last;
//   3. once every page is in, the line is gone and every hit is a tile;
//   4. a server search that FAILS says so on the line, and never claims that
//      nothing matched.
// Every assertion is a MEASUREMENT of the rendered page at a moment; a source
// grep passes against the pre-fix page (the words were always in the file).
//   npm install playwright-core --no-save && node scripts/test-meta-assets-search-state.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }

const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQAB'
  + 'h6FO1AAAAABJRU5ErkJggg==', 'base64');

// what the browse walk loads: nothing here says "mirror"
const LOADED = [
  { chat: 'evan-film', name: 'Evan', url: 'http://127.0.0.1:PORT/i/a.png',
    description: 'Evan — hospital window', created: iso(T0 - 1000) },
  { chat: 'dating-book', name: 'Dating Book', url: 'http://127.0.0.1:PORT/i/b.png',
    description: 'Penny — the blue Kleenex', created: iso(T0 - 2000) },
];
// the hits only the server knows — two PAGES of them
const HITS = [];
for (let i = 0; i < 7; i++) {
  HITS.push({ chat: 'triset', name: 'Triset', url: 'http://127.0.0.1:PORT/i/m' + i + '.png',
    description: 'Triset card — a broken mirror ' + i, created: iso(T0 - 9000 - i) });
}
const SEARCH_PAGE = 4;         // the stub pages its answer 4 at a time
let searchDelay = 700;         // ms before a q= page answers
let searchFails = false;
const servePublic = require('./lib/public-asset');
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/gallery/assets/all') {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    if (q) {
      const off = parseInt(url.searchParams.get('offset'), 10) || 0;
      const hit = HITS.filter((a) => a.description.indexOf(q) >= 0);
      return setTimeout(() => {
        if (searchFails) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end('{"error":"down"}'); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ assets: hit.slice(off, off + SEARCH_PAGE), total: hit.length, offset: off, limit: SEARCH_PAGE }));
      }, searchDelay);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const off = parseInt(url.searchParams.get('offset'), 10) || 0;
    return res.end(JSON.stringify({ assets: off ? [] : LOADED, total: LOADED.length, offset: off, limit: 150 }));
  }
  if (servePublic(req, res)) return;
  if (url.pathname.startsWith('/i/') || url.pathname.startsWith('/api/story/thumb')) {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(PNG);
  }
  if (url.pathname === '/assets') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'assets.html'), 'utf8')
      + fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}');
});

let fails = 0;
const fail = (m) => { fails++; console.log('FAIL: ' + m); };
const ok = (m) => console.log('ok   ' + m);

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const fix = (a) => Object.assign({}, a, { url: a.url.replace('PORT', port) });
  LOADED.forEach((a, i) => { LOADED[i] = fix(a); });
  HITS.forEach((a, i) => { HITS[i] = fix(a); });
  const exe = (() => {
    if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
    for (const k of (() => { try { return fs.readdirSync('/opt/pw-browsers'); } catch { return []; } })()
      .filter((n) => /^chromium-\d/.test(n))) {
      const p = path.join('/opt/pw-browsers', k, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
    return null;
  })();
  const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => fail('page error: ' + e.message));
  await page.goto('http://127.0.0.1:' + port + '/assets');
  await page.waitForSelector('.assetgrid .acell');
  const state = () => page.evaluate(() => {
    const n = document.querySelector('.state:not(.more)');
    const shown = [...document.querySelectorAll('.assetgrid .acell')].filter((e) => e.style.display !== 'none').length;
    return { text: n && n.style.display !== 'none' ? n.textContent : '', shown };
  });

  // 1 — the moment after typing: the client filter has emptied the grid and
  // the server has not answered. The line must NOT read "No images match that."
  await page.fill('.asearch input', 'mirror');
  await page.waitForFunction(() => [...document.querySelectorAll('.assetgrid .acell')]
    .every((e) => e.style.display === 'none'));
  await page.waitForTimeout(450);   // past the 350ms debounce, inside the 700ms answer
  let s = await state();
  if (/No images match/.test(s.text)) fail('while the server is still being asked the page says: ' + JSON.stringify(s.text));
  else if (!/Searching/.test(s.text)) fail('while searching the line reads ' + JSON.stringify(s.text) + ', wanted Searching…');
  else ok('while the server is being asked the line says Searching…');

  // 2 — the first page paints before the second lands
  await page.waitForFunction(() => [...document.querySelectorAll('.assetgrid .acell')]
    .filter((e) => e.style.display !== 'none').length > 0);
  s = await state();
  if (s.shown !== SEARCH_PAGE) fail('first page painted ' + s.shown + ' tiles, wanted ' + SEARCH_PAGE + ' (the first page alone)');
  else ok('the first page of hits paints before the second lands (' + s.shown + ' tiles)');
  if (/No images match/.test(s.text)) fail('the no-match line shows over a grid of hits');

  // 3 — the walk finishes: every hit a tile, no line
  await page.waitForFunction((n) => [...document.querySelectorAll('.assetgrid .acell')]
    .filter((e) => e.style.display !== 'none').length === n, HITS.length);
  s = await state();
  if (s.text) fail('after the walk the line still reads ' + JSON.stringify(s.text));
  else ok('all ' + HITS.length + ' hits are tiles and the line is gone');

  // clearing puts the browse list back, quietly
  await page.fill('.asearch input', '');
  await page.waitForFunction((n) => [...document.querySelectorAll('.assetgrid .acell')]
    .filter((e) => e.style.display !== 'none').length === n, LOADED.length);
  s = await state();
  if (s.text) fail('cleared box still shows a line: ' + JSON.stringify(s.text));
  else ok('clearing the box restores the browse list with no line');

  // 4 — the server search FAILS: the line says so, never "no images"
  searchFails = true; searchDelay = 50;
  await page.fill('.asearch input', 'mirror');
  await page.waitForFunction(() => {
    const n = document.querySelector('.state:not(.more)');
    return n && n.style.display !== 'none' && !/Searching/.test(n.textContent);
  });
  s = await state();
  if (/No images match/.test(s.text)) fail('a failed server search claims nothing matched');
  else if (!/server/.test(s.text)) fail('a failed server search reads ' + JSON.stringify(s.text) + ', wanted a line naming the server');
  else ok('a failed server search says so: ' + JSON.stringify(s.text));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL GREEN');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('FAIL: ' + (e.stack || e)); process.exit(1); });
