#!/usr/bin/env node
// META ASSETS — drives the REAL public/assets.html against a stub API.
//   1. the grid renders every asset in the order the server sent (filing
//      order), each tile carrying its label AND its origin chat's name;
//   2. THE SYNC: tapping ♥ POSTs to /api/gallery/assets/vote with the item's
//      ORIGIN chat — the same doc that chat's own Assets tab reads/writes —
//      so a heart here is the heart there with no mirroring machinery;
//   3. a vote already on file paints (♥ lit, ✕'d tile dimmed via .nay);
//   4. the ♥ filter narrows to hearted tiles; search finds by chat name;
//   5. the lightbox freezes the page (overflow hidden) and restores the exact
//      scroll position on close — the house overlay rule;
//   6. the PROMPT overlay opens on the Content side (Sophie's default).
//
//   npm install playwright-core --no-save && node scripts/test-meta-assets-page.js
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
// 1×1 transparent PNG so tiles and the lightbox load a real image.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQAB'
  + 'h6FO1AAAAABJRU5ErkJggg==', 'base64');

const ASSETS = [
  { chat: 'evan-film', name: 'Evan', url: 'http://127.0.0.1:PORT/i/newest.png',
    prompt: 'gpt-image-2 · medium', description: 'Evan — hospital window',
    promptStyle: 'wtr watercolor drawing', promptContent: 'a man at a hospital window at dusk',
    created: iso(T0 - 1000) },
  { chat: 'dating-book', name: 'Dating Book', url: 'http://127.0.0.1:PORT/i/mid.png',
    prompt: 'from dating-book', description: 'Penny — the blue Kleenex',
    created: iso(T0 - 2000), vote: 'like' },
  { chat: 'witch-school', name: 'Witch School', url: 'http://127.0.0.1:PORT/i/oldest.png',
    description: 'Moon lesson card', created: iso(T0 - 3000), vote: 'dislike' },
];

const votes = [];   // every vote POST the page sends, captured
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/gallery/assets/all') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ assets: ASSETS, total: ASSETS.length, offset: 0, limit: 150 }));
  }
  if (url.pathname === '/api/gallery/assets/vote' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      votes.push(JSON.parse(body));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
    return;
  }
  if (url.pathname.startsWith('/i/') || url.pathname.startsWith('/api/story/thumb')) {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(PNG);
  }
  if (url.pathname === '/assets') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'assets.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}');
});

(async () => {
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const port = server.address().port;
  ASSETS.forEach((a) => { a.url = a.url.replace('PORT', String(port)); });
  // The house preinstalled-chromium hunt (test-brief-page.js's exe()) — the
  // installed playwright-core may want a newer build than the box carries.
  const exe = (() => {
    for (const k of (() => { try { return fs.readdirSync('/opt/pw-browsers'); } catch { return []; } })()
      .filter((n) => /^chromium-\d/.test(n))) {
      const p = path.join('/opt/pw-browsers', k, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
    return null;
  })();
  const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fail = (m) => { console.error('FAIL:', m); process.exit(1); };
  try {
    await page.goto(`http://127.0.0.1:${port}/assets`);
    await page.waitForSelector('.assetgrid .acell');

    // 1 — order + label + chat name on the tiles
    const caps = await page.$$eval('.assetgrid .acell .lbl', (es) => es.map((e) => e.textContent));
    if (caps[0] !== 'Evan — hospital window' || caps[2] !== 'Moon lesson card') {
      fail('tiles not in filing order: ' + JSON.stringify(caps));
    }
    const whos = await page.$$eval('.assetgrid .acell .who', (es) => es.map((e) => e.textContent));
    if (whos.join('|') !== 'Evan|Dating Book|Witch School') {
      fail('origin chat names missing from tiles: ' + JSON.stringify(whos));
    }

    // 3 — a vote already on file paints
    const lit = await page.$eval('.assetgrid .acell:nth-child(2) .vote.heart',
      (e) => e.classList.contains('on'));
    if (!lit) fail('pre-existing ♥ not painted');
    const dim = await page.$eval('.assetgrid .acell:nth-child(3)',
      (e) => e.classList.contains('nay'));
    if (!dim) fail('✕’d tile not dimmed');

    // 2 — THE SYNC: hearting the newest tile posts against ITS origin chat
    await page.click('.assetgrid .acell:nth-child(1) .vote.heart');
    await page.waitForFunction(() => document.querySelector('.assetgrid .acell:nth-child(1) .vote.heart.on'));
    if (votes.length !== 1 || votes[0].chat !== 'evan-film' || votes[0].vote !== 'like') {
      fail('vote did not carry the origin chat: ' + JSON.stringify(votes));
    }

    // 4 — the ♥ filter narrows to hearted tiles…
    await page.click('.afilter button[data-f="like"]');
    const visible = await page.$$eval('.assetgrid .acell',
      (es) => es.filter((e) => e.style.display !== 'none').length);
    if (visible !== 2) fail('♥ filter shows ' + visible + ' tiles, wanted 2');
    await page.click('.afilter button[data-f="like"]');   // filter off again
    // …and search finds by the origin chat's name
    await page.fill('.asearch input', 'witch');
    await page.waitForFunction(() => {
      const es = [...document.querySelectorAll('.assetgrid .acell')];
      return es.filter((e) => e.style.display !== 'none').length === 1;
    });
    await page.fill('.asearch input', '');
    await page.waitForFunction(() => {
      const es = [...document.querySelectorAll('.assetgrid .acell')];
      return es.filter((e) => e.style.display !== 'none').length === 3;
    });

    // 5 — lightbox freezes the page and restores scrollY
    // Click via the DOM, not page.click — playwright would scroll the tile
    // into view first, moving scrollY before the lightbox records it.
    await page.evaluate(() => {
      document.body.style.minHeight = '3000px';
      window.scrollTo(0, 400);
      document.querySelector('.assetgrid .acell:nth-child(1) > button').click();
    });
    await page.waitForSelector('#clightbox[style*="flex"]');
    const locked = await page.evaluate(() => document.body.style.overflow === 'hidden');
    if (!locked) fail('lightbox did not lock the background');

    // 6 — PROMPT opens on the Content side
    await page.click('.promptbtn');
    const side = await page.$eval('.lbptog button.on', (e) => e.textContent);
    if (side !== 'Content') fail('prompt overlay opened on ' + side + ', wanted Content');
    const ptext = await page.$eval('.lbptext', (e) => e.textContent);
    if (ptext !== 'a man at a hospital window at dusk') fail('wrong prompt text: ' + ptext);

    await page.click('#clightbox', { position: { x: 10, y: 700 } });
    await page.waitForFunction(() => document.getElementById('clightbox').style.display === 'none');
    const y = await page.evaluate(() => new Promise((ok) =>
      requestAnimationFrame(() => requestAnimationFrame(() => ok(window.scrollY)))));
    if (Math.abs(y - 400) > 2) fail('scroll not restored after lightbox: ' + y);

    console.log('test-meta-assets-page: all good — order, sync-to-origin-chat, filters, lightbox contract');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error('FAIL:', e); process.exit(1); });
