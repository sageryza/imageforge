#!/usr/bin/env node
// Regression test for the 2026-08-08 report: "a lot of my older images are gone
// from the playground." Nothing was deleted — the page asked for the newest 40
// runs and had no way to ask for any more, so run 41 and everything behind it
// was simply unreachable (213 runs existed, 40 could be seen).
//
// Drives the REAL public/promptlab.html in a headless browser against a stub
// API and asserts the four things the fix has to get right:
//   1. the feed opens on one page and offers "Older" when there is more,
//   2. Older appends the page BEHIND the oldest run held — no gaps, no repeats,
//   3. Older disappears once the feed has reached the end,
//   4. a head refresh (what every finished run triggers) KEEPS what she has
//      already paged back to — the whole point, and the easiest thing to break.
//
//   npm install playwright --no-save && node scripts/test-playground-paging.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const servePublic = require('./lib/public-asset');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const TOTAL = 95;          // 3 pages at the page's PAGE of 40
const PAGE = 40;
const T0 = 1786000000000;  // fixed clock — the script never reads the real one

// Newest first, one image each, a minute apart. Distinct prompts so the feed's
// identical-runs grouping can't merge them into one box and hide the count.
const ALL = Array.from({ length: TOTAL }, (_, i) => ({
  id: 'run' + String(i).padStart(3, '0'),
  prompt: 'prompt number ' + i,
  status: 'done',
  engine: 'gptimage',
  model: 'gpt-image-2',
  quality: 'medium',
  aspectRatio: '2:3',
  images: ['/px.png?i=' + i],
  createdAt: T0 - i * 60000,
}));

let apiCalls = 0;
const server = http.createServer((req, res) => {
  // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/promptlab') {
    apiCalls++;
    const limit = Math.min(Number(url.searchParams.get('limit')) || PAGE, 100);
    const before = Number(url.searchParams.get('before')) || 0;
    const pool = before ? ALL.filter(r => r.createdAt < before) : ALL;
    const runs = pool.slice(0, limit);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs, more: runs.length === limit }));
  }
  if (url.pathname === '/px.png') {
    // 1x1 transparent png, so a tile is a real decoded image and not a broken one
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64');
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(png);
  }
  if (url.pathname === '/' || url.pathname === '/playground') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8'));
  }
  res.writeHead(404).end();
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  // Use whatever Chromium the host already has when playwright's pinned build
  // isn't downloaded (the cloud sessions ship one under /opt/pw-browsers).
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find(p => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });   // iPhone 13
  // Tiles view is the wall of every picture — the honest count of what she can
  // actually reach. localStorage has to be set before the page script runs.
  await page.addInitScript(() => localStorage.setItem('promptlab_view', 'tiles'));
  await page.goto(base + '/playground');

  const tiles = () => page.locator('#tiles .cell:not(.ph)').count();
  const boxes = () => page.locator('#runs .run').count();
  const older = () => page.locator('#more .morebtn');
  const ids = () => page.locator('#tiles .cell:not(.ph) img').evaluateAll(
    els => els.map(e => e.getAttribute('data-run')));

  await page.waitForFunction(() => document.querySelectorAll('#tiles .cell').length > 0);

  // 1 — one page, and an Older button because there is more behind it.
  if (await tiles() !== PAGE) fail(`first load showed ${await tiles()} pictures, expected ${PAGE}`);
  if (await older().count() !== 1) fail('no Older button on a feed with more behind it');

  // 2 — Older appends the page behind the oldest, with no gap and no repeat.
  await older().click();
  await page.waitForFunction(n => document.querySelectorAll('#tiles .cell:not(.ph)').length > n, PAGE);
  if (await tiles() !== PAGE * 2) fail(`after one Older: ${await tiles()} pictures, expected ${PAGE * 2}`);
  let seen = await ids();
  if (new Set(seen).size !== seen.length) fail('a run appeared twice after paging');
  if (seen.join() !== ALL.slice(0, PAGE * 2).map(r => r.id).join()) fail('paged runs are out of order or have a gap');

  // 4 (checked here, while there is still more to load) — a head refresh must
  // not throw away the older runs she has already paged back to.
  await page.evaluate(() => loadRuns());
  await page.waitForTimeout(300);
  if (await tiles() !== PAGE * 2) fail(`a refresh dropped older runs: ${await tiles()} left of ${PAGE * 2}`);
  if (await older().count() !== 1) fail('a refresh lost the Older button');

  // 3 — page to the end; the last page is short, and Older goes away.
  await older().click();
  await page.waitForFunction(n => document.querySelectorAll('#tiles .cell:not(.ph)').length > n, PAGE * 2);
  if (await tiles() !== TOTAL) fail(`after paging to the end: ${await tiles()} pictures, expected ${TOTAL}`);
  if (await boxes() !== TOTAL) fail(`list view shows ${await boxes()} boxes, expected ${TOTAL}`);
  if (await older().count() !== 0) fail('Older is still offered at the end of the feed');

  seen = await ids();
  if (seen.join() !== ALL.map(r => r.id).join()) fail('the full feed is not every run in order');

  await browser.close();
  server.close();
  if (!process.exitCode) console.log(`PASS: all ${TOTAL} runs reachable in ${apiCalls} requests, refresh keeps them`);
})().catch(e => { console.error(e); process.exit(1); });
