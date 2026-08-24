#!/usr/bin/env node
// THREE OR FOUR ACROSS (Aug 2026, Sophie: "add a 3 to a row vs. 4 to a row
// toggle to the right of search in playground. square button that cycles
// between 3 and 4").
//
// Drives the REAL public/promptlab.html in headless Chromium against a stub
// API and asserts:
//   1. it opens on THREE — where the wall already stood — and a tap cycles
//      3 → 4 → 3, with nowhere else to land,
//   2. ONE number drives BOTH grids: the tile wall and a run's own row of
//      pictures in list view. `--cols` exists so those two can never disagree
//      about what "3 to a row" means, and this is what pins it,
//   3. it is sticky across a reload, like the view and the two filters,
//   4. the glyph is a picture of the count — N bars, never a word,
//   5. THE ROW STILL FITS ONE LINE on a 390pt phone with it added, the button
//      is REACHABLE at its own centre and clear of the injected pill's column,
//      and the search box still holds its own placeholder. That last one is
//      the measurement the row has failed before (two 38px filter boxes once
//      clipped "Search" to "Searc"), and this button costs the row another
//      38px — which is why the view switch gave back its padding and the ✕'s
//      clearance became conditional.
//
// The COLUMN COUNT IS MEASURED off the real cells, never read off the CSS: a
// wrong `--cols` and a wrong `repeat()` both compute to plausible-looking
// text, and only the boxes say how many actually sit on a row.
//
//   npm install playwright --no-save && node scripts/test-playground-cols.js
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const T0 = 1786000000000;

// ONE run of twelve pictures: twelve divides by both 3 and 4, so every row is
// full at either setting and a miscount cannot hide in a ragged last row.
const RUNS = [{
  id: 'run0',
  prompt: 'a fox asleep on a radiator',
  status: 'done',
  engine: 'gptimage',
  model: 'gpt-image-2',
  quality: 'medium',
  aspectRatio: '2:3',
  images: Array.from({ length: 12 }, (_, i) => '/px.png?i=' + i),
  votes: {},
  createdAt: T0,
}];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/promptlab') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs: RUNS, more: false }));
  }
  if (url.pathname === '/px.png') {
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
const ok = (c, m) => { if (c) console.log('  ok  ' + m); else fail(m); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find(p => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });   // iPhone 13
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length > 0);

  // How many cells share the first row's top edge — the honest question.
  const across = (sel) => page.evaluate((s) => {
    const cells = [...document.querySelectorAll(s)];
    if (!cells.length) return 0;
    const top = Math.round(cells[0].getBoundingClientRect().top);
    return cells.filter(c => Math.round(c.getBoundingClientRect().top) === top).length;
  }, sel);
  const listAcross = () => across('#runs .cell');
  const wallAcross = () => across('#tiles .cell');
  const bars = () => page.locator('#v-cols rect').count();

  console.log('THREE, AND THE TAP THAT MAKES IT FOUR');
  ok(await listAcross() === 3, 'it opens on three across');
  ok(await bars() === 3, 'and the button draws three bars');
  await page.click('#v-cols');
  ok(await listAcross() === 4, 'one tap: four across');
  ok(await bars() === 4, 'and four bars');
  await page.click('#v-cols');
  ok(await listAcross() === 3, 'the next tap comes back to three — there is nowhere else to go');

  console.log('ONE NUMBER, BOTH GRIDS');
  await page.click('#v-tiles');
  await page.waitForFunction(() => document.querySelectorAll('#tiles .cell img').length > 0);
  ok(await wallAcross() === 3, 'the tile wall is three across too');
  await page.click('#v-cols');
  ok(await wallAcross() === 4, 'and follows the same tap to four');
  await page.click('#v-list');
  ok(await listAcross() === 4, 'the list view was already four — the count is not per view');

  console.log('STICKY');
  await page.click('#v-cols');                                     // back to three, then reload
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length > 0);
  ok(await listAcross() === 3, 'a reload comes back on the count she left it on');
  ok(await bars() === 3, 'and the button says so');

  console.log('THE ROW');
  const row = await page.evaluate(() => {
    const b = document.getElementById('v-cols').getBoundingClientRect();
    const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    const q = document.getElementById('q');
    const cs = getComputedStyle(q);
    const c = document.createElement('canvas').getContext('2d');
    c.font = cs.font;
    return {
      barH: Math.round(document.querySelector('.feedbar').getBoundingClientRect().height),
      w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right),
      reachable: !!(hit && hit.closest('#v-cols')),
      need: c.measureText(q.placeholder).width,
      have: q.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      groups: [...document.querySelectorAll('.feedbar > *')]
        .map(e => Math.round(e.getBoundingClientRect().top)),
    };
  });
  ok(row.w === row.h, `the button is square (${row.w}x${row.h})`);
  ok(new Set(row.groups).size === 1 && row.barH <= 48,
    `the row is still one line (${row.barH}px, ${row.groups.length} groups on one top edge)`);
  ok(row.reachable, 'a tap at its own centre reaches it');
  // The injected autoscroll pill owns the top-right corner from x 326 on a
  // 390pt phone, and the row reserves 56px for exactly that.
  ok(row.right <= 326, `it stays out of the pill's column (right edge ${row.right} ≤ 326)`);
  ok(row.have >= row.need,
    `"Search" still fits in its own box (needs ${Math.round(row.need)}px, has ${Math.round(row.have)}px)`);
  // The clearance the ✕ needs is paid for only while there is an ✕ — that is
  // what bought the placeholder its room back.
  const pad = await page.evaluate(async () => {
    const q = document.getElementById('q');
    const empty = getComputedStyle(q).paddingRight;
    q.focus(); q.value = 'fox';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    return { empty, typed: getComputedStyle(q).paddingRight, clear: !document.getElementById('qclear').hidden };
  });
  ok(pad.clear && parseFloat(pad.typed) > parseFloat(pad.empty),
    `typed text still clears the ✕ (${pad.empty} → ${pad.typed})`);

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('\nAll good.');
})();
