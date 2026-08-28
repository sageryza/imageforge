#!/usr/bin/env node
// THE ✕ FILTER beside the heart (Aug 2026, Sophie: "can u also add a button
// next to the heart that hides anything i've 'exed'").
//
// Drives the REAL public/promptlab.html in headless Chromium against a stub
// API and asserts:
//   1. lit, it drops every ✕'d picture from BOTH views, and a run left with
//      nothing showing drops out of the list with them,
//   2. it is sticky across a reload, like the heart and the view,
//   3. it stacks with the heart without arguing (hearts only, still),
//   4. it does not wear the heart's rose — two filters that look identical
//      read as two of the same thing, and these are opposites,
//   5. THE ROW STILL FITS ONE LINE on a 390pt phone with it added, and the
//      search box still holds its own placeholder — measured, because the row
//      already reserves 56px for the injected autoscroll pill: two separate
//      38px filter boxes left the search at 80px and clipped "Search" to
//      "Searc", which is why the two share one box of 34s.
//
//   npm install playwright --no-save && node scripts/test-playground-hide-x.js
const http = require('http');
const servePublic = require('./lib/public-asset');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const T0 = 1786000000000;

// run0: one hearted, one ✕'d.  run1: BOTH ✕'d — it must vanish entirely.
// run2: untouched.
const ALL = [
  { id: 'run0', votes: { 0: 'like', 1: 'dislike' } },
  { id: 'run1', votes: { 0: 'dislike', 1: 'dislike' } },
  { id: 'run2', votes: {} },
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
const ALL_SIX = ['run0#0', 'run0#1', 'run1#0', 'run1#1', 'run2#0', 'run2#1'];
const NO_X = ['run0#0', 'run2#0', 'run2#1'];
const HEARTS = ['run0#0'];

const server = http.createServer((req, res) => {
  // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/promptlab') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs: ALL, more: false }));
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
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

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

  const shot = (sel) => page.locator(sel).evaluateAll(
    els => els.map(e => e.getAttribute('data-run') + '#' + e.getAttribute('data-i')));
  const list = () => shot('#runs .cell img');
  const wall = () => shot('#tiles .cell:not(.ph) img');
  const boxes = () => page.locator('#runs .run').count();

  console.log('THE FILTER');
  ok(same(await list(), ALL_SIX), 'off, every picture is on the page');
  await page.click('#v-hidex');
  ok(same(await list(), NO_X), 'lit, the ✕\'d ones are gone from the list');
  ok(await boxes() === 2, 'the run with both pictures ✕\'d dropped out of the list too');
  await page.click('#v-tiles');
  await page.waitForFunction(() => document.querySelectorAll('#tiles .cell img').length > 0);
  ok(same(await wall(), NO_X), 'and gone from the tile wall');

  console.log('STICKY');
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#tiles .cell img').length > 0);
  ok(same(await wall(), NO_X), 'a reload comes back with it still lit');
  ok(await page.locator('#v-hidex').evaluate(e => e.classList.contains('on')),
    'and the button says so');

  console.log('WITH THE HEART');
  await page.click('#v-liked');
  ok(same(await wall(), HEARTS), 'both lit: hearts only, no argument');
  await page.click('#v-hidex');
  ok(same(await wall(), HEARTS), 'the heart alone is unchanged by turning it off');
  await page.click('#v-liked');
  ok(same(await wall(), ALL_SIX), 'and both off is the whole feed back');

  console.log('THE LOOK, AND THE ROW');
  const colors = await page.evaluate(() => {
    const h = document.getElementById('v-liked'), x = document.getElementById('v-hidex');
    h.classList.add('on'); x.classList.add('on');
    const lit = [getComputedStyle(h).backgroundColor, getComputedStyle(x).backgroundColor];
    h.classList.remove('on'); x.classList.remove('on');
    return lit;
  });
  ok(colors[0] !== colors[1], `lit, the two filters are told apart (${colors.join(' vs ')})`);

  const row = await page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { top: b.top, w: b.width, h: b.height }; };
    return {
      bar: r(document.querySelector('.feedbar')),
      view: r(document.querySelector('.viewtog')),
      filt: r(document.querySelector('.filttog')),
      heart: r(document.getElementById('v-liked')),
      x: r(document.getElementById('v-hidex')),
      search: r(document.querySelector('.feedsearch')),
    };
  });
  // The two control groups share one line; the search has its own line under
  // them since 2026-08-28 ("i don't need to tap"), so the bar is two rows.
  ok(Math.abs(row.view.top - row.filt.top) < 1, 'the two control groups share one line');
  ok(Math.abs(row.heart.top - row.x.top) < 1, 'the heart and the ✕ share their box');
  ok(row.bar.h < 100, `the bar is the controls plus the search line (${Math.round(row.bar.h)}px)`);
  ok(Math.abs(row.x.w - row.heart.w) < 1 && Math.abs(row.x.h - row.heart.h) < 1,
    `the ✕ is the same box as the heart (${Math.round(row.x.w)}x${Math.round(row.x.h)})`);

  // The placeholder measured against the room the input actually has — a
  // clipped field looks fine to `isVisible()` and to a width assertion.
  const room = await page.evaluate(() => {
    const el = document.getElementById('q');
    const cs = getComputedStyle(el);
    const c = document.createElement('canvas').getContext('2d');
    c.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    return { need: c.measureText(el.placeholder).width,
      have: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) };
  });
  ok(room.have >= room.need,
    `"Search" fits in its own box (needs ${Math.round(room.need)}px, has ${Math.round(room.have)}px)`);

  await browser.close();
  server.close();
  console.log(process.exitCode ? '\nFAILED' : '\nAll good.');
})();
