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

  const heart = page.locator('#v-liked');
  const wall = () => page.locator('#tiles .cell:not(.ph) img').evaluateAll(
    els => els.map(e => e.getAttribute('data-run') + '#' + e.getAttribute('data-i')));
  const listWall = () => page.locator('#runs .cell img').evaluateAll(
    els => els.map(e => e.getAttribute('data-run') + '#' + e.getAttribute('data-i')));

  // The heart is beside the view switch, in the same bar.
  if (await heart.count() !== 1) fail('no heart button in the feed bar');
  const [bar, hbox] = await Promise.all([
    page.locator('.feedbar .viewtog').boundingBox(), heart.boundingBox()]);
  if (!(hbox.x > bar.x + bar.width - 2)) fail('the heart is not beside the List/Tiles switch');

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
  if (!(await heart.evaluate(el => el.classList.contains('on')))) fail('the heart filter did not survive a reload');
  await page.locator('#v-list').click();   // the init script re-pins tiles on every load

  // 3 — the arrows walk the filtered order. Open the middle picture.
  await page.locator('#runs .cell img[data-run="run2"][data-i="0"]').click();
  await page.waitForSelector('#lb.on');
  const prev = page.locator('#lbprev'), next = page.locator('#lbnext');
  const cur = () => page.evaluate(() => lbCur.id + '#' + lbCur.i);
  if (await prev.isHidden()) fail('no back arrow from the middle of the feed');
  if (await next.isHidden()) fail('no forward arrow from the middle of the feed');

  // 5 — the zone is the whole control and NOTHING is drawn in it. No chip, no
  // glyph, no plate: the zone runs the full height of the image area and
  // reaches well over the picture (which is what "tap anywhere on the right
  // or left" means) while covering none of it.
  const [pb, nb, img] = await Promise.all([
    prev.boundingBox(), next.boundingBox(), page.locator('#lbimg').boundingBox()]);
  const drawn = await page.evaluate(() => ['lbprev', 'lbnext'].map(id => {
    const el = document.getElementById(id), cs = getComputedStyle(el);
    return {
      id,
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
    return el && el.closest('.lbnav') ? el.closest('.lbnav').id : (el && el.id);
  }, [Math.round(img.x + 24), Math.round(img.y + img.height / 2)]);
  if (atEdge !== 'lbprev') fail(`a tap 24px inside the picture's left edge reaches ${atEdge}, not the back zone`);

  // 6 — a tap steps, and does NOT close the lightbox.
  await next.click();
  if (await page.locator('#lb.on').count() !== 1) fail('tapping an arrow closed the lightbox');
  if (await cur() !== 'run2#1') fail('the forward arrow landed on ' + await cur() + ', expected run2#1');
  // 4 — that is the end of the (filtered) feed.
  if (await next.isVisible()) fail('the forward arrow is still offered at the end of the feed');
  await prev.click();
  await prev.click();
  if (await cur() !== 'run0#1') fail('stepping back twice landed on ' + await cur() + ', expected run0#1');
  if (await prev.isVisible()) fail('the back arrow is still offered at the start of the feed');
  // It skipped the un-hearted pictures entirely — that IS the filtered order.

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('PASS: heart filters both views and sticks; invisible full-height tap zones step the shown order');
})().catch(e => { console.error(e); process.exit(1); });
