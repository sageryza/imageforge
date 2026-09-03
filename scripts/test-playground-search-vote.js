#!/usr/bin/env node
// A ♥ CAST WHILE A SEARCH IS ACTIVE HAS TO REACH THE WALL (2026-09-03,
// Sophie: "hearts…", with two screenshots taken a second apart — the tile wall
// showing hearts on two patchwork triangles, and the lightbox on one of those
// same pictures showing no heart at all).
//
// `hits` is the array of run objects the search answered with, and it was the
// one store on the page nothing ever refreshed: castLB mutates runsById[id],
// and mergeRuns (which every vote reaches through loadRuns) REPLACES
// runsById[id] with a fresh doc, breaking the identity the two shared at
// search time. So for as long as her query stood, the wall painted the votes
// the search had frozen — a ♥ she cast never appeared and one she CLEARED
// never came off. Measured against her real data that afternoon: four taps,
// two likes and two clears, and the wall showed the opposite of all four.
//
// Every assertion here is a MEASUREMENT of the rendered badge against what the
// stub server really received, because the two look identical in the source:
// both read `(r.votes||{})[i]`, and the bug is that they read it off different
// objects.
//
//   npm install playwright --no-save && node scripts/test-playground-search-vote.js
const http = require('http');
const servePublic = require('./lib/public-asset');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const FILE = process.env.PL_FILE || path.join(PUB, 'promptlab.html');
const T0 = 1788394900000;

// Her three patchwork triangles, newest first, one picture each. r1 arrives
// already hearted — that is what makes the CLEAR half of this testable.
const RUNS = [
  { id: 'r1', quality: 'low', votes: { 0: 'like' } },
  { id: 'r2', quality: 'medium', votes: {} },
  { id: 'r3', quality: 'high', votes: {} },
].map((r, n) => Object.assign({
  prompt: 'a patchwork of rolling hills',
  status: 'done', engine: 'gptimage', model: 'gpt-image-2',
  gptStyle: 'triangle', aspectRatio: '1:1',
  images: ['/px.png?r=' + r.id], createdAt: T0 - n * 3000,
}, r));
// One run the query must NOT match, so "the search is still narrowing" is a
// real assertion rather than a tautology.
RUNS.push({
  id: 'other', quality: 'medium', votes: {}, prompt: 'a black cat behind leaves',
  status: 'done', engine: 'gptimage', model: 'gpt-image-2', gptStyle: 'triangle',
  aspectRatio: '1:1', images: ['/px.png?r=other'], createdAt: T0 - 20000,
});

const posts = [];
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/promptlab') {
    // The real route answers a `q` over the whole collection; the stub filters
    // the same way so the page gets a genuine server-side hit list.
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const runs = q ? RUNS.filter(r => r.prompt.toLowerCase().includes(q)) : RUNS;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs, more: false, matched: runs.length }));
  }
  if (/^\/api\/promptlab\/[^/]+\/vote$/.test(url.pathname)) {
    let b = '';
    req.on('data', d => { b += d; });
    return req.on('end', () => {
      const id = url.pathname.split('/')[3];
      const j = JSON.parse(b || '{}');
      posts.push({ id, image: j.image, vote: j.vote });
      const r = RUNS.find(x => x.id === id);
      if (r) { if (j.vote) r.votes[j.image] = j.vote; else delete r.votes[j.image]; }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
    });
  }
  if (url.pathname === '/px.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'));
  }
  if (url.pathname === '/api/story/thumb') { res.writeHead(302, { Location: '/px.png' }); return res.end(); }
  if (url.pathname === '/' || url.pathname === '/playground') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(FILE, 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}');
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
  await page.click('#v-tiles');
  await page.waitForFunction(() => document.querySelectorAll('#tiles .cell img').length > 0);

  // The badge as it RENDERS, per tile, keyed by the run the tile points at.
  const wall = () => page.evaluate(() => Array.from(document.querySelectorAll('#tiles .cell')).map((c) => {
    const im = c.querySelector('img');
    const b = c.querySelector('.badge');
    return (im && im.getAttribute('data-run')) + ':' +
      (b ? (b.classList.contains('like') ? 'like' : 'x') : '-');
  }).join(' '));
  const lit = () => page.$eval('#clightbox .vote.heart', n => n.classList.contains('on'));
  const closeLB = async () => { await page.evaluate(() => window.__assetLightboxClose()); await page.waitForTimeout(250); };
  // Tap the ♥ on the tile at 1-based position `n`, then read the wall back.
  const heartTile = async (n) => {
    await page.click(`#tiles .cell:nth-child(${n}) img`);
    await page.waitForSelector('#clightbox .vote.heart');
    const before = await lit();
    await page.click('#clightbox .vote.heart');
    await page.waitForTimeout(500);
    const after = await lit();
    await closeLB();
    await page.waitForTimeout(350);
    return { before, after };
  };

  console.log('THE SEARCH');
  await page.fill('#q', 'patchwork');
  await page.waitForTimeout(900);
  ok(await wall() === 'r1:like r2:- r3:-',
    'the query narrows the wall to the three patchwork runs, r1 already hearted');

  console.log('\nA ♥ CAST WITH THE SEARCH ACTIVE REACHES THE WALL');
  let t = await heartTile(2);
  ok(t.before === false && t.after === true, 'the lightbox lights on the tap');
  ok(JSON.stringify(posts[posts.length - 1]) === JSON.stringify({ id: 'r2', image: 0, vote: 'like' }),
    'and the server was told r2 is liked');
  ok(await wall() === 'r1:like r2:like r3:-', 'and the badge is on the wall');

  console.log('\nAND A ♥ CLEARED WITH THE SEARCH ACTIVE COMES OFF IT');
  t = await heartTile(1);
  ok(t.before === true && t.after === false, 'the lightbox reads r1 as hearted and clears it');
  ok(JSON.stringify(posts[posts.length - 1]) === JSON.stringify({ id: 'r1', image: 0, vote: '' }),
    'and the server was told to clear it');
  ok(await wall() === 'r1:- r2:like r3:-',
    'and the badge is GONE from the wall — the half her screenshot caught');

  console.log('\nTHE SEARCH IS STILL A SEARCH');
  ok(!(await wall()).includes('other'), 'the run the query does not match is still out');
  const q = await page.$eval('#q', n => n.value);
  ok(q === 'patchwork', 'and her words are still in the box');

  console.log('\nTHE ♥ FILTER, WITH A SEARCH ACTIVE');
  // The filters live inside the drawer since #2058 — open it, tap the chip.
  await page.click('#feedfilters .filtchip');
  await page.waitForSelector('#feedfilters .filtdrawer:not([hidden])');
  await page.click('#feedfilters .filtcbtn[data-v="like"]');
  await page.waitForTimeout(400);
  ok(await wall() === 'r2:like', 'hearts only shows exactly the one she just hearted');
  await page.click('#feedfilters .filtcbtn[data-v="like"]');
  await page.waitForTimeout(400);

  console.log('\nAND NOTHING MOVED WITH NO SEARCH');
  await page.fill('#q', '');
  await page.waitForTimeout(900);
  ok(await wall() === 'r1:- r2:like r3:- other:-',
    'the unsearched wall says the same thing the server does');

  await browser.close();
  server.close();
  console.log(process.exitCode ? '\nFAILED' : '\nAll good.');
})();
