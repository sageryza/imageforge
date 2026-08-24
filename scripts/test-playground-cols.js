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
//   5. IT LIVES IN THE PILL'S RAIL, not in the feed row ("it can go in the
//      same column as the auto scroll pill that way the search thing can go
//      back to the size it was"). So: it is out of `.feedbar` entirely, the
//      search box measures what it did before the button ever existed, the
//      button is centred in the rail's column, it sits BELOW the pill without
//      overlapping it, it MOVES when the back-to-top arrives under the pill,
//      and it is reachable at its own centre.
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

  console.log('THE RAIL, AND THE ROW IT LEFT');
  const rail = await page.evaluate(() => {
    const b = document.getElementById('v-cols');
    const f = document.querySelector('.float');
    const bb = b.getBoundingClientRect(), fb = f.getBoundingClientRect();
    const hit = document.elementFromPoint(bb.x + bb.width / 2, bb.y + bb.height / 2);
    const q = document.getElementById('q');
    const cs = getComputedStyle(q);
    const c = document.createElement('canvas').getContext('2d');
    c.font = cs.font;
    return {
      inRow: !!b.closest('.feedbar'),
      w: Math.round(bb.width), h: Math.round(bb.height),
      radius: getComputedStyle(b).borderRadius,
      centre: Math.round(bb.x + bb.width / 2), railCentre: Math.round(fb.x + fb.width / 2),
      below: Math.round(bb.top - fb.bottom),
      reachable: !!(hit && hit.closest('#v-cols')),
      barH: Math.round(document.querySelector('.feedbar').getBoundingClientRect().height),
      searchW: Math.round(q.getBoundingClientRect().width),
      need: c.measureText(q.placeholder).width,
      have: q.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
    };
  });
  ok(!rail.inRow, 'it is out of the feed row entirely');
  ok(rail.w === rail.h, `still square (${rail.w}x${rail.h})`);
  ok(rail.radius === '6px', `a rounded square at the house 6px, never a circle (${rail.radius})`);
  ok(Math.abs(rail.centre - rail.railCentre) <= 2,
    `centred in the pill's own column (${rail.centre} vs ${rail.railCentre})`);
  ok(rail.below >= 0 && rail.below <= 16, `it sits just under the pill, clear of it (${rail.below}px)`);
  ok(rail.reachable, 'a tap at its own centre reaches it');
  // The row is back to what it was before this button ever sat in it — the
  // search box's old width, and its placeholder with the old room to spare.
  ok(rail.searchW === 94, `the search box is its old width again (${rail.searchW}px)`);
  ok(rail.have >= rail.need,
    `"Search" fits (needs ${Math.round(rail.need)}px, has ${Math.round(rail.have)}px)`);
  ok(rail.barH <= 48, `the feed row is one line (${rail.barH}px)`);

  // THE RAIL IS NOT A FIXED HEIGHT: the back-to-top button appears under the
  // pill once she is a screen down, and the safe-area inset moves the whole
  // column on her phone. A typed offset is wrong in one of those states, so
  // the placement is measured — this is what proves it follows.
  const moved = await page.evaluate(async () => {
    const at = () => Math.round(document.getElementById('v-cols').getBoundingClientRect().top);
    const before = at();
    window.scrollTo(0, 4000);
    await new Promise(r => setTimeout(r, 400));
    const ptop = document.getElementById('ptop');
    const shown = ptop && ptop.getBoundingClientRect().height > 0;
    const after = at();
    const overlap = shown
      ? after < Math.round(ptop.getBoundingClientRect().bottom) : false;
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 400));
    return { before, after, shown, overlap, home: at() };
  });
  ok(moved.shown, 'a screen down, the back-to-top joins the rail');
  ok(moved.after > moved.before, `and the button moves down with it (${moved.before} → ${moved.after})`);
  ok(!moved.overlap, 'never on top of it');
  ok(moved.home === moved.before, 'back at the top, it comes back');

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('\nAll good.');
})();
