#!/usr/bin/env node
// The Playground's HEART FILTER and the lightbox's SIDE ARROWS (Aug 2026,
// Sophie: "next to tiles and list toggle, can u put a heart, that shows only
// the liked ones" · "add arrows to the left and right sides, so i can scroll
// through the playground made assets left and right by tapping. make the
// arrows tall but narrow so they don't overlap the picture" — then, Aug 2026:
// "the side arrow bars - buttons shud be smaller, tap targets bigger. tap
// anywhere on the right or left of the screen in the image area and it
// switches left or right. arrow bars are just about an inch tall" — and
// finally, 2026-08-24: "the top left and right bars cover part of the image.
// Can you just make it tap and no buttons showing", so the mark is GONE and
// the zone is the whole control).
//
// Drives the REAL public/promptlab.html in headless Chromium against a stub
// API and asserts:
//   1. the heart sits beside the view switch and filters BOTH views to the
//      hearted pictures only — and a run with nothing hearted drops out,
//   2. it is sticky across a reload,
//   3. the arrows step through the pictures in the order the view behind the
//      lightbox is showing them, the filter included,
//   4. they are hidden at the two ends of the feed,
//   5. NOTHING is drawn in the zone — no chip, no glyph, no plate, no
//      background — while the TAP ZONE is still the whole side of the image
//      area, the picture included; measured with real boxes and with
//      elementFromPoint, the only honest way to ask what a tap reaches,
//   6. tapping one steps rather than closing the lightbox.
//
// Since 2026-08-26 the lightbox is THE SHARED ONE (asset-lightbox.js) and the
// zones are its `nav` hook — a null side draws NOTHING, so "hidden at the
// ends" means the zone is not there at all and a tap there closes.
//
//   npm install playwright --no-save && node scripts/test-playground-liked-arrows.js
const http = require('http');
const servePublic = require('./lib/public-asset');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const T0 = 1786000000000;

// Four runs, two images each. Hearts on run0/img1, run2/img0 and run2/img1 —
// so one run has NOTHING hearted and must disappear when the heart is lit.
const ALL = [
  { id: 'run0', votes: { 1: 'like' } },
  { id: 'run1', votes: { 0: 'dislike' } },
  { id: 'run2', votes: { 0: 'like', 1: 'like' } },
  { id: 'run3', votes: {} },
].map((r, i) => ({
  id: r.id,
  prompt: 'prompt number ' + i,
  status: 'done',
  engine: 'gptimage',
  model: 'gpt-image-2',
  quality: 'medium',
  aspectRatio: '2:3',
  images: ['/px.png?r=' + r.id + '&i=0', '/px.png?r=' + r.id + '&i=1'],
  votes: r.votes,
  createdAt: T0 - i * 60000,
}));
// Newest first, oldest-first WITHIN a run's box (the list view reverses the
// group) — the hearted pictures in the order the wall shows them.
const LIKED = [['run0', 1], ['run2', 0], ['run2', 1]];

const server = http.createServer((req, res) => {
  // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/promptlab') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs: ALL, more: false }));
  }
  // A REAL-SIZED 2:3 picture, not a 1x1 pixel: the lightbox sizes itself to
  // the picture, so a pixel-wide fixture would put the arrow zones nowhere
  // near it and the tap-on-the-edge question could not be asked at all.
  if (url.pathname === '/px.png') {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536">' +
      '<rect width="1024" height="1536" fill="#8a7f70"/></svg>');
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
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find(p => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });   // iPhone 13
  await page.addInitScript(() => localStorage.setItem('promptlab_view', 'tiles'));
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#tiles .cell').length > 0);

  // THE HEART LIVES INSIDE THE FILTERS DRAWER SINCE 2026-09-02 (Sophie: "you
  // can put the heart x thing within the toggle") — /searchfilters.js. The
  // drawer is opened once and left open, which is also how she uses it.
  const openFilt = async () => {
    if (await page.locator('#feedfilters .filtdrawer').isVisible()) return;
    await page.click('#feedfilters .filtchip');
    await page.waitForSelector('#feedfilters .filtdrawer:not([hidden])');
  };
  await openFilt();
  const heart = page.locator('#feedfilters .filtcbtn[data-v="like"]');
  const wall = () => page.locator('#tiles .cell:not(.ph) img').evaluateAll(
    els => els.map(e => e.getAttribute('data-run') + '#' + e.getAttribute('data-i')));
  const listWall = () => page.locator('#runs .cell img').evaluateAll(
    els => els.map(e => e.getAttribute('data-run') + '#' + e.getAttribute('data-i')));

  // The heart is in the drawer that hangs off the feed bar, and the chip that
  // opens it is beside the view switch — where the loose heart used to be.
  if (await heart.count() !== 1) fail('no heart chip in the filters drawer');
  const [bar, cbox] = await Promise.all([
    page.locator('.feedbar .viewtog').boundingBox(),
    page.locator('#feedfilters .filtchip').boundingBox()]);
  if (!(cbox.x > bar.x + bar.width - 2)) fail('the filters chip is not beside the List/Tiles switch');

  // 1 — unlit, everything shows.
  if ((await wall()).length !== 8) fail(`unfiltered wall shows ${(await wall()).length} pictures, expected 8`);

  // 1 — lit, hearts only, in the same order, and the run with none drops out.
  await heart.click();
  await page.waitForFunction(() => document.querySelectorAll('#tiles .cell:not(.ph) img').length === 3);
  const shown = await wall();
  if (shown.join() !== LIKED.map(([r, i]) => r + '#' + i).join())
    fail('the heart filter shows ' + shown.join() + ', expected ' + LIKED.map(([r, i]) => r + '#' + i).join());
  if (!(await heart.evaluate(el => el.classList.contains('on')))) fail('the lit heart does not read as lit');

  // 1 — the list view obeys the same filter, and only two boxes survive.
  await page.locator('#v-list').click();
  const inList = await listWall();
  if (inList.join() !== LIKED.map(([r, i]) => r + '#' + i).join())
    fail('list view under the filter shows ' + inList.join());
  if (await page.locator('#runs .run').count() !== 2)
    fail(`${await page.locator('#runs .run').count()} run boxes under the filter, expected 2`);

  // 2 — sticky across a reload.
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length === 3);
  await openFilt();
  if (!(await heart.evaluate(el => el.classList.contains('on')))) fail('the heart filter did not survive a reload');
  await page.locator('#v-list').click();   // the init script re-pins tiles on every load

  // 3 — the arrows walk the filtered order. Open the middle picture.
  await page.locator('#runs .cell img[data-run="run2"][data-i="0"]').click();
  await page.waitForFunction(() => {
    const lb = document.getElementById('clightbox');
    return !!lb && lb.style.display !== 'none';
  });
  const prev = page.locator('#clightbox .lbzone.prev'), next = page.locator('#clightbox .lbzone.next');
  const cur = () => page.evaluate(() => lbCur.id + '#' + lbCur.i);
  if (!(await prev.count())) fail('no back zone from the middle of the feed');
  if (!(await next.count())) fail('no forward zone from the middle of the feed');

  // 5 — the zone is the whole control and NOTHING is drawn in it. No chip, no
  // glyph, no plate: the zone runs the full height of the image area and
  // reaches well over the picture (which is what "tap anywhere on the right
  // or left" means) while covering none of it.
  const [pb, nb, img] = await Promise.all([
    prev.boundingBox(), next.boundingBox(),
    page.locator('#clightbox .clwrap img').boundingBox()]);
  const drawn = await page.evaluate(() => ['.lbzone.prev', '.lbzone.next'].map(sel => {
    const el = document.querySelector('#clightbox ' + sel), cs = getComputedStyle(el);
    return {
      id: sel,
      kids: el.childElementCount,
      text: el.textContent.trim().length,
      bg: cs.backgroundColor,
      border: cs.borderTopWidth,
    };
  }));
  const seeThrough = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
  for (const d of drawn) {
    if (d.kids || d.text) fail(`${d.id} draws something on the picture (${d.kids} nodes, ${d.text} chars)`);
    if (!seeThrough(d.bg)) fail(`${d.id} paints a background (${d.bg}) over the picture`);
    if (parseFloat(d.border) > 0) fail(`${d.id} draws a border (${d.border}) over the picture`);
  }
  if (await page.locator('.lbbar').count() !== 0) fail('the old arrow bar chip is still drawn');
  for (const [name, b] of [['prev', pb], ['next', nb]]) {
    if (b.width < 80) fail(`the ${name} tap zone is only ${b.width}px wide`);
    if (b.height < img.height - 1) fail(`the ${name} tap zone is ${b.height}px against ${img.height}px of picture`);
  }
  if (pb.x + pb.width <= img.x) fail('the back tap zone does not reach the picture');
  if (nb.x >= img.x + img.width) fail('the forward tap zone does not reach the picture');

  // A tap well INSIDE the picture, near its left edge, must step — not close.
  // elementFromPoint, because "is the zone visible" was never the question.
  const atEdge = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el && el.closest('.lbzone') ? el.closest('.lbzone').className : (el && (el.id || el.className));
  }, [Math.round(img.x + 24), Math.round(img.y + img.height / 2)]);
  if (String(atEdge).indexOf('prev') < 0)
    fail(`a tap 24px inside the picture's left edge reaches ${atEdge}, not the back zone`);

  const openNow = () => page.evaluate(() => {
    const lb = document.getElementById('clightbox');
    return !!lb && lb.style.display !== 'none';
  });
  // 6 — a tap steps, and does NOT close the lightbox.
  await next.click();
  if (!(await openNow())) fail('tapping an arrow closed the lightbox');
  if (await cur() !== 'run2#1') fail('the forward arrow landed on ' + await cur() + ', expected run2#1');
  // 4 — that is the end of the (filtered) feed: a null side draws NO zone, so
  // a tap there is dead space and closes.
  if (await next.count()) fail('the forward zone is still drawn at the end of the feed');
  await prev.click();
  await prev.click();
  if (await cur() !== 'run0#1') fail('stepping back twice landed on ' + await cur() + ', expected run0#1');
  if (await prev.count()) fail('the back zone is still drawn at the start of the feed');
  // It skipped the un-hearted pictures entirely — that IS the filtered order.

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('PASS: heart filters both views and sticks; invisible full-height tap zones step the shown order');
})().catch(e => { console.error(e); process.exit(1); });
