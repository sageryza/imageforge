#!/usr/bin/env node
// The EMBEDDED Compare page — chats.html's iframe viewer + parent pill (Aug
// 2026, Sophie caught the gap on the judge demo: the standalone-page tests
// all passed while the app's own tap-to-toggle gesture started the autoscroll
// from taps on images and on the lightbox backdrop).
//
// Drives the REAL public/chats.html in a headless browser against a stub API,
// opens a page in the real openPage() viewer, and asserts the embedded tap
// contract:
//   1. a tap on bare page content TOGGLES the parent pill (the gesture works),
//   2. a tap on an IMAGE opens the lightbox and never starts the scroll,
//   3. closing the lightbox from its backdrop never starts the scroll,
//   4. while scrolling, a tap on an image PAUSES (the house any-tap rule),
//   5. a tap inside [data-nostop] never starts the scroll,
//   6. __scrollStop is forwarded into the iframe, so compare.js's own
//      tap-pauses handler stops the PARENT pill (a button tap pauses).
//
//   npm install playwright-core --no-save && node scripts/test-page-embed.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed (npm install playwright-core --no-save)'); process.exit(0); }
}

const PUB = path.join(__dirname, '..', 'public');
const IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='60'%3E%3Crect width='40' height='60' fill='%23c99'/%3E%3C/svg%3E";

const EMBED_PAGE = `<!doctype html><meta charset="utf-8"><title>embed test page</title>
<link rel="stylesheet" href="/compare.css">
<div class="wrap">
  <div class="eyebrow">TEST</div><h1>Embedded page</h1>
  <p id="bare">bare content — tapping here is the toggle gesture</p>
  <div class="duo">
    <figure><span class="tag">medium</span><img id="pic" src="${IMG}" alt="m"></figure>
    <figure><span class="tag">high</span><img src="${IMG}" alt="h"></figure>
  </div>
  <div data-nostop id="nostop"><p>a tappable word-picker-ish region</p></div>
  <button id="btn">a page button</button>
  ${'<p>filler so the iframe can scroll</p>'.repeat(80)}
</div>
<script src="/compare.js"></script>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const send = (type, body) => { res.writeHead(200, { 'Content-Type': type }); res.end(body); };
  if (p === '/' || p === '/chats') {
    return send('text/html; charset=utf-8', fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  if (p.startsWith('/api/chatfeed/page/')) return send('text/html; charset=utf-8', EMBED_PAGE);
  if (p === '/api/chatfeed') {
    const t = new Date(Date.now() - 3600000).toISOString();
    return send('application/json', JSON.stringify({
      build: 'test', settings: {}, truncated: [], delta: false,
      chats: { 'chat-a': { lastSeen: t } },
      messages: [{ id: 'm1', chat: 'chat-a', from: 'claude', text: 'hi', tldr: 'hi', created: t, postedAt: t }],
    }));
  }
  if (p === '/api/chatfeed/pages') {
    return send('application/json', JSON.stringify({
      pages: [{ id: 'demo', title: 'embed test', created: new Date().toISOString() }],
    }));
  }
  if (p.startsWith('/api/')) return send('application/json', '{"ok":true,"assets":[],"items":{},"texts":{},"pages":[]}');
  const file = path.join(PUB, p.slice(1));
  if (file.startsWith(PUB) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    const type = p.endsWith('.css') ? 'text/css' : p.endsWith('.js') ? 'application/javascript' : 'text/html';
    return send(type, fs.readFileSync(file, 'utf8'));
  }
  res.writeHead(404); res.end('nope');
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox'],
  }).catch(async () => chromium.launch({ channel: undefined, args: ['--no-sandbox'] }));

  const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
  let failures = 0;
  const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + ': ' + m); if (!c) failures++; };

  // the honest route in: home list → thread → Compare tab → page row
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.crow[data-chat="chat-a"]', { timeout: 8000 });
  await page.click('.crow[data-chat="chat-a"]');
  await page.waitForSelector('.tg-compare', { timeout: 8000 });
  await page.click('.tg-compare');
  await page.waitForSelector('.pagerow', { timeout: 8000 });
  await page.click('.pagerow');
  await page.waitForSelector('.pv-frame', { timeout: 8000 });
  const frame = page.frames().find((f) => f.url().includes('/api/chatfeed/page/'));
  await frame.waitForSelector('#bare');
  await page.waitForTimeout(200);

  const playing = () => page.evaluate(() => !!document.querySelector('.pageview .ppm.on'));
  // dispatched taps: the pill may be actively scrolling the iframe, so real
  // mouse clicks never see a "stable" target — dispatch the same events the
  // handlers listen for (pointerdown for compare.js, click for the parent
  // toggle), the test-compare-shell.js approach.
  const tap = (sel) => frame.$eval(sel, (el) => {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  // 1 — bare tap toggles on, then off
  await tap('#bare');
  ok(await playing(), 'a tap on bare content starts the parent pill');
  await tap('#bare');
  ok(!(await playing()), 'a second bare tap stops it');

  // 2 — an image tap opens the lightbox and never starts the scroll
  await tap('#pic');
  const lbOpen = await frame.evaluate(() => {
    const lb = document.querySelector('.cmp-lb');
    return !!lb && !lb.hasAttribute('hidden');
  });
  ok(lbOpen, 'tapping an image opens the lightbox');
  ok(!(await playing()), 'tapping an image never starts the scroll');

  // 3 — closing from the backdrop never starts the scroll
  await tap('.cmp-lb');
  const lbClosed = await frame.evaluate(() => document.querySelector('.cmp-lb').hasAttribute('hidden'));
  ok(lbClosed, 'tapping the backdrop closes the lightbox');
  ok(!(await playing()), 'closing the lightbox never starts the scroll');

  // 4 — while scrolling, an image tap PAUSES (any-tap rule)
  await tap('#bare');                       // start
  await tap('#pic');                        // image tap
  ok(!(await playing()), 'while scrolling, an image tap pauses the pill');
  await frame.evaluate(() => document.querySelector('.cmp-lb').click()); // tidy up

  // 5 — data-nostop never starts
  await tap('#nostop p');
  ok(!(await playing()), 'a tap inside [data-nostop] never starts the scroll');

  // 6 — forwarded __scrollStop: compare.js's pointerdown pauses the PARENT
  await tap('#bare');                       // start
  ok(await playing(), '(setup) scroll running again');
  await tap('#btn');                        // button: parent toggle skips it,
  ok(!(await playing()), "a button tap pauses via the forwarded __scrollStop");

  await browser.close();
  server.close();
  if (failures) { console.error(failures + ' failed'); process.exit(1); }
  console.log('all checks passed');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
