#!/usr/bin/env node
// THE SEARCH BOX TAKES ITS OWN LINE WHILE SHE IS SEARCHING (2026-08-28,
// Sophie: "search way too small. why can't it show behind pill column").
//
// It cannot go behind the pill — `.feedbar` is sticky at top:0, so it sits
// inside the pill's fixed corner permanently rather than passing under it, and
// the ✕ and the caret live at the right end of that box. So the room comes
// from a second line, and NOTHING is hidden to pay for it. Drives the REAL
// public/promptlab.html in headless Chromium at 390pt and MEASURES the box in
// every state, because "way too small" is a width and nothing else:
//   1. at rest the row is one line and every control is on it,
//   2. focused, the box takes a full line of its own and is 3-4x wider,
//   3. the view switch and the filter chips are still there and still take a
//      tap (asked with elementFromPoint) — switching view over the hits and
//      lighting the heart on them are two of the things a search is FOR,
//   4. a query with the keyboard down keeps the line — she is still reading
//      the answer to it,
//   5. cleared and blurred, the row is exactly what it was, to the pixel,
//   6. the 56px the injected autoscroll pill owns is never eaten, on either
//      line.
//
//   npm install playwright --no-save && node scripts/test-playground-search-room.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const servePublic = require('./lib/public-asset');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const T0 = 1786000000000;
const PILL = 56;          // the column the row reserves for the injected pill
const RUNS = [0, 1, 2].map((i) => ({
  id: 'run' + i, prompt: 'prompt number ' + i, status: 'done', engine: 'gptimage',
  model: 'gpt-image-2', quality: 'medium', aspectRatio: '2:3',
  images: ['/px.png?i=' + i], votes: i === 0 ? { 0: 'like' } : {}, createdAt: T0 - i * 60000,
}));

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/promptlab') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs: RUNS, more: false }));
  }
  if (url.pathname === '/px.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'));
  }
  if (url.pathname === '/' || url.pathname === '/playground') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8'));
  }
  res.writeHead(404).end();
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const ok = (c, m) => { if (c) console.log('  ok  ' + m); else fail(m); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://127.0.0.1:' + port + '/playground');
  await page.waitForSelector('#tiles .tile, #runs .run', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);

  const snap = () => page.evaluate(() => {
    const box = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { w: Math.round(r.width), right: Math.round(r.right), shown: r.width > 0 };
    };
    const bar = document.querySelector('.feedbar');
    const br = bar.getBoundingClientRect();
    return {
      barRight: Math.round(br.right), barTop: Math.round(br.top),
      view: box('.viewtog'), filt: box('.filttog'), search: box('.feedsearch'),
      lines: new Set(Array.from(bar.children).filter((c) => c.getBoundingClientRect().width)
        .map((c) => Math.round(c.getBoundingClientRect().top))).size,
    };
  });
  const focus = () => page.focus('#q');
  const blur = () => page.evaluate(() => document.getElementById('q').blur());

  // 1 ── at rest
  let s = await snap();
  const rest = s.search.w;
  ok(s.view.shown && s.filt.shown, 'at rest the view switch and the filters are on the row');
  ok(s.lines === 1, 'at rest the row is one line');
  ok(s.search.right <= s.barRight - PILL + 1, 'at rest the box stops before the pill column');

  // 2 ── focused: the box takes its own line
  await focus(); await page.waitForTimeout(150);
  s = await snap();
  ok(s.lines === 2, 'focused, the search is on a line of its own');
  ok(s.search.w > rest * 3, 'focused, the box is 3x wider than at rest (' + rest + ' → ' + s.search.w + ')');
  ok(s.search.w > 250, 'focused, the box is a real search field (' + s.search.w + 'px)');
  ok(s.search.right <= s.barRight - PILL + 1, 'focused, the second line still stops before the pill column');

  // 3 ── nothing was hidden to pay for it
  ok(s.view.shown && s.filt.shown, 'focused, the view switch and the filters are still on the row');
  const reachable = () => page.evaluate(() => ['v-list', 'v-tiles', 'v-liked', 'v-hidex'].every((id) => {
    const r = document.getElementById(id).getBoundingClientRect();
    const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!(e && e.closest('#' + id));
  }));
  ok(await reachable(), 'and every one of them really takes a tap there (elementFromPoint)');
  await page.click('#v-liked'); await page.waitForTimeout(150);
  ok(await page.evaluate(() => !!document.querySelector('#v-liked.on')),
     'the heart can be lit mid-search without leaving the box');
  await page.click('#v-liked'); await page.waitForTimeout(150);
  await page.click('#v-tiles'); await page.waitForTimeout(150);
  ok(await page.evaluate(() => !!document.querySelector('#v-tiles.on')),
     'and the view can be switched over the hits');
  await page.click('#v-list'); await page.waitForTimeout(150);

  // 4 ── a query with the keyboard down keeps the line
  await focus();
  await page.type('#q', 'prompt');
  await page.waitForTimeout(500);
  await blur(); await page.waitForTimeout(150);
  s = await snap();
  ok(s.lines === 2, 'blurred with a query, the line stays — she is still reading the answer');
  ok(s.search.w > rest * 3, 'and the box is still wide (' + s.search.w + ')');
  ok(await reachable(), 'and every control is still reachable');

  // 5 ── cleared and blurred: back to exactly what it was
  await page.click('#qclear'); await blur(); await page.waitForTimeout(300);
  s = await snap();
  ok(s.lines === 1, 'cleared, the row is one line again');
  ok(s.search.w === rest, 'cleared, the row is exactly what it was (' + s.search.w + ' = ' + rest + ')');

  await b.close(); server.close();
  if (!process.exitCode) console.log('\nAll good.');
})().catch((e) => { console.error(e); process.exit(1); });
