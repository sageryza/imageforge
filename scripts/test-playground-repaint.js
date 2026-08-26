#!/usr/bin/env node
/*
 * test-playground-repaint.js — the two halves of "the playground flashes a
 * lot and sometimes things don't load" (Aug 2026, Sophie).
 *
 * SLOW: a ~90-190px tile used to load the FULL-SIZE original (1024x1536), so
 * the first page pulled tens of MB over cell. Tiles now load the house thumb
 * service (`/api/story/thumb`, the Assets tab's own pattern) while the
 * lightbox and Save keep the untouched original. A temp Replicate/OpenAI url
 * or a data: url has no derived copy and passes through.
 *
 * FLASHING: every repaint used to be `innerHTML = …` over the whole feed,
 * destroying and recreating every <img> — the browser blanked and re-decoded
 * the wall on every ♥, search keystroke and poll transition. Repaints
 * reconcile now: an unchanged picture keeps its ELEMENT. The honest test is
 * element identity — mark the live <img> nodes with a property, repaint, and
 * ask whether the same objects are still standing.
 *
 *   node scripts/test-playground-repaint.js
 *   (the page half needs: npm install playwright --no-save)
 */
const fs = require('fs');
const servePublic = require('./lib/public-asset');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');
const gallerySrc = fs.readFileSync(path.join(ROOT, 'public', 'gallery.html'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

console.log('the source carries both fixes');
ok(/function thumbFor\(/.test(pageSrc), 'promptlab has thumbFor');
ok((pageSrc.match(/thumbFor\(u\)/g) || []).length >= 2,
  'both the list cells and the tile wall go through it');
// BOTH FIXES LIVE IN /feedkit.js SINCE 2026-08-26 — one copy, because a
// second hand-copy of the reconcile is exactly how the flashing comes back.
// So the page is pinned to USING them and the kit to HAVING them; a page that
// went back to its own copy fails the last check here.
const kitSrc = fs.readFileSync(path.join(ROOT, 'public', 'feedkit.js'), 'utf8');
ok(/\/api\/story\/thumb\?w=/.test(kitSrc), 'and it points at the house thumb service');
ok(!/innerHTML = groups\.map/.test(pageSrc.slice(pageSrc.indexOf('function renderFeed'))),
  'renderFeed no longer rebuilds the whole feed as one innerHTML');
ok(/function syncChildren\(/.test(kitSrc) && /FeedKit\.syncChildren/.test(pageSrc),
  'repaints reconcile (the shared syncChildren)');
ok(/<script src="\/feedkit\.js">/.test(pageSrc),
  'and the feed links the one kit rather than keeping its own copy');
ok(/function thumbFor\(/.test(gallerySrc) && /thumbFor\(img\.url\)/.test(gallerySrc),
  '/gallery tiles load the derived copy too');
ok(/openLightbox\('\$\{img\.url\}'\)/.test(gallerySrc),
  'and its lightbox still opens the ORIGINAL');

// ── the real page ────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

const GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const STORED = 'https://storage.googleapis.com/some-bucket/promptlab/1755-abc.webp';
const RUNS = [
  { id: 'r1', prompt: 'a brown horse in the desert', engine: 'gptimage', model: 'gpt-image-2',
    gptStyle: 'dreamy', quality: 'medium', aspectRatio: '2:3', status: 'done',
    images: [STORED], createdAt: 2000 },
  { id: 'r2', prompt: 'a crow on a fence', engine: 'gptimage', model: 'gpt-image-2',
    gptStyle: 'evan', quality: 'low', aspectRatio: '1:1', status: 'done',
    images: [GIF], createdAt: 1000 },
];

(async () => {
  const server = http.createServer((req, res) => {
    // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: RUNS, more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ styles: {} }));
    }
    if (url.pathname === '/api/story/thumb') {
      // The real route 302s to a cached webp; a tiny gif is fine for a test.
      res.writeHead(200, { 'Content-Type': 'image/gif' });
      return res.end(Buffer.from(GIF.split(',')[1], 'base64'));
    }
    if (url.pathname === '/playground-port.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(fs.readFileSync(path.join(ROOT, 'public', 'playground-port.js')));
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#runs .run').length === 2);

  console.log('\nwhat a tile actually loads');
  const srcs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#runs img[data-run]')).map((im) => im.getAttribute('src')));
  ok(srcs.some((s) => s.indexOf('/api/story/thumb?w=480&url=') === 0),
    'a Storage picture loads the derived thumb, not the original');
  ok(srcs.some((s) => s.indexOf('data:image/gif') === 0),
    'a url with no derived copy passes through untouched');

  // THE THUMB IS THE FIRST FRAME, THE ORIGINAL IS THE ONE SHE LOOKS AT
  // (2026-08-26, Sophie: "it takes quite a while to load the images in light
  // box view"). The old contract was "the lightbox src IS the original", which
  // meant a 1-3MB download before anything appeared. The picture she just
  // tapped is already in the cache at 480px, so it paints in the same frame
  // and the original swaps in behind it — but it must never STAY at 480px,
  // and Save must never be handed the derived copy.
  console.log('\nthe lightbox opens on the cached thumb, then the original');
  await page.click('#runs img[data-run="r1"]');
  const firstPaint = await page.getAttribute('#clightbox .clwrap img', 'src');
  ok(firstPaint.indexOf('/api/story/thumb?w=480&url=') === 0,
    'the first frame is the thumb the wall had already loaded');
  ok(await page.evaluate(() => lbSrc) === STORED,
    'Save and the app bridge still get the untouched original');
  await page.waitForFunction(
    () => document.querySelector('#clightbox .clwrap img').getAttribute('src').indexOf('/api/story/thumb') !== 0);
  const settled = await page.getAttribute('#clightbox .clwrap img', 'src');
  ok(settled === STORED || settled.indexOf('blob:') === 0,
    'and it settles on the original rather than staying at 480px');
  await page.evaluate(() => window.__assetLightboxClose());   // the shared way out

  console.log('\na repaint keeps the pictures\' ELEMENTS — the flash test');
  // Mark every live <img>; anything rebuilt loses the mark.
  await page.evaluate(() => {
    document.querySelectorAll('#runs img[data-run]').forEach((im) => { im.__kept = true; });
  });
  const afterNoop = await page.evaluate(() => {
    renderFeed();                                   // a repaint with nothing changed
    const imgs = Array.from(document.querySelectorAll('#runs img[data-run]'));
    return { total: imgs.length, kept: imgs.filter((im) => im.__kept).length };
  });
  ok(afterNoop.total === 2 && afterNoop.kept === 2,
    'a no-change repaint recreates nothing (' + afterNoop.kept + '/' + afterNoop.total + ' kept)');

  const afterVote = await page.evaluate(() => {
    runsById.r1.votes = { 0: 'like' };              // what a ♥ round-trip writes
    feed.forEach((r) => { if (r.id === 'r1') r.votes = { 0: 'like' }; });
    renderFeed();
    const imgs = Array.from(document.querySelectorAll('#runs img[data-run]'));
    return {
      total: imgs.length,
      kept: imgs.filter((im) => im.__kept).length,
      badges: document.querySelectorAll('#runs .badge.like').length,
    };
  });
  ok(afterVote.kept === 2 && afterVote.badges === 1,
    'a ♥ paints its badge without recreating any picture');

  const afterSearch = await page.evaluate(() => {
    const box = document.getElementById('q');
    box.value = 'horse';
    readSearch();                                   // the instant client filter
    const imgs = Array.from(document.querySelectorAll('#runs img[data-run]'));
    return { total: imgs.length, kept: imgs.filter((im) => im.__kept).length };
  });
  ok(afterSearch.total === 1 && afterSearch.kept === 1,
    'a search drops the others and keeps the matching picture\'s element');

  const afterClear = await page.evaluate(() => {
    const box = document.getElementById('q');
    box.value = '';
    readSearch();
    const imgs = Array.from(document.querySelectorAll('#runs img[data-run]'));
    return { total: imgs.length, kept: imgs.filter((im) => im.__kept).length };
  });
  ok(afterClear.total === 2 && afterClear.kept >= 1,
    'clearing it brings the wall back, the surviving element still standing');

  console.log('\nthe tile wall reconciles the same way');
  await page.click('#v-tiles');
  await page.waitForSelector('#tiles img[data-run]');
  const tiles = await page.evaluate(() => {
    document.querySelectorAll('#tiles img[data-run]').forEach((im) => { im.__kept = true; });
    renderTiles();
    const imgs = Array.from(document.querySelectorAll('#tiles img[data-run]'));
    return {
      total: imgs.length,
      kept: imgs.filter((im) => im.__kept).length,
      thumbed: imgs.some((im) => im.getAttribute('src').indexOf('/api/story/thumb?w=480&url=') === 0),
    };
  });
  ok(tiles.total === 2 && tiles.kept === 2, 'a tiles repaint recreates nothing');
  ok(tiles.thumbed, 'and tiles load the derived thumb too');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
