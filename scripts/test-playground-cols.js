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
//   4. it SAYS THE NUMBER — "3" or "4". It first drew the count as N bars, on
//      the pyramid's reasoning that a mark should picture how many; Sophie
//      asked for the number instead ("I asked for the button to say three or
//      four, not a picture"), and at 16px the two bar counts really are one
//      grey smudge,
//   5. IT LIVES IN THE VIEW SWITCH — the third segment after Tiles
//      (2026-08-25, Sophie: "the 3/4 switch button is in a weird place. It
//      should not be in the auto scroll roll row"). So: it is inside
//      `.viewtog`, out of the pill's rail entirely (nothing fixed), the same
//      height as List/Tiles, the feed row stays one line, the search box
//      still holds its whole placeholder, and it is reachable at its own
//      centre (the pill must not be sitting on it).
//
// The COLUMN COUNT IS MEASURED off the real cells, never read off the CSS: a
// wrong `--cols` and a wrong `repeat()` both compute to plausible-looking
// text, and only the boxes say how many actually sit on a row.
//
//   npm install playwright --no-save && node scripts/test-playground-cols.js
const http = require('http');
const servePublic = require('./lib/public-asset');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const T0 = 1786000000000;

// TWELVE pictures a run: twelve divides by both 3 and 4, so every row is full
// at either setting and a miscount cannot hide in a ragged last row. Several
// runs, because the rail's placement is only interesting on a page long enough
// to scroll — that is when the back-to-top joins the column.
const RUNS = Array.from({ length: 6 }, (_, r) => ({
  id: 'run' + r,
  prompt: 'a fox asleep on a radiator ' + r,
  status: 'done',
  engine: 'gptimage',
  model: 'gpt-image-2',
  quality: 'medium',
  aspectRatio: '2:3',
  images: Array.from({ length: 12 }, (_, i) => '/px.png?r=' + r + '&i=' + i),
  votes: {},
  createdAt: T0 - r * 60000,
}));

const server = http.createServer((req, res) => {
  // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
  if (servePublic(req, res)) return;
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
    // Served the way serveGated serves it — the shared pill appended — because
    // the button's whole placement is measured against that pill's rail.
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8')
      + fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8'));
  }
  if (url.pathname === '/tritoggle.css' || url.pathname === '/tritoggle.js'
      || url.pathname === '/playground-port.js') {
    const f = path.join(PUB, url.pathname.slice(1));
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return res.end(fs.readFileSync(f));
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
  const says = () => page.locator('#v-cols').evaluate(e => e.textContent.trim());

  console.log('THREE, AND THE TAP THAT MAKES IT FOUR');
  ok(await listAcross() === 3, 'it opens on three across');
  ok(await says() === '3', 'and the button says 3');
  await page.click('#v-cols');
  ok(await listAcross() === 4, 'one tap: four across');
  ok(await says() === '4', 'and says 4');
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
  ok(await says() === '3', 'and the button says so');

  console.log('THE VIEW SWITCH, AND THE RAIL IT LEFT');
  const home = await page.evaluate(() => {
    const b = document.getElementById('v-cols');
    const tiles = document.getElementById('v-tiles');
    const bb = b.getBoundingClientRect(), tb = tiles.getBoundingClientRect();
    const hit = document.elementFromPoint(bb.x + bb.width / 2, bb.y + bb.height / 2);
    const q = document.getElementById('q');
    const cs = getComputedStyle(q);
    const c = document.createElement('canvas').getContext('2d');
    c.font = cs.font;
    return {
      inSwitch: !!b.closest('.viewtog'),
      afterTiles: tiles.nextElementSibling === b,
      fixed: getComputedStyle(b).position === 'fixed',
      h: Math.round(bb.height), sibH: Math.round(tb.height),
      lit: b.classList.contains('on'),
      reachable: !!(hit && hit.closest('#v-cols')),
      barH: Math.round(document.querySelector('.feedbar').getBoundingClientRect().height),
      need: c.measureText(q.placeholder).width,
      have: q.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
    };
  });
  ok(home.inSwitch, 'it is a segment of the List/Tiles box');
  ok(home.afterTiles, 'directly after Tiles');
  ok(!home.fixed, 'nothing fixed — the pill\'s rail is left to the pill');
  ok(home.h === home.sibH, `the same height as its siblings (${home.h} vs ${home.sibH})`);
  ok(!home.lit, 'it never wears .on — it is not a third view');
  ok(home.reachable, 'a tap at its own centre reaches it');
  ok(home.have >= home.need,
    `"Search" fits (needs ${Math.round(home.need)}px, has ${Math.round(home.have)}px)`);
  ok(home.barH <= 48, `the feed row is one line (${home.barH}px)`);

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('\nAll good.');
})();
