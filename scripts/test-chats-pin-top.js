#!/usr/bin/env node
// PIN A CHAT TO THE TOP (Aug 2026, Sophie: "an option to pin chat to the top
// so they always show first when they come out of hiding and they never
// disappeared to the bottom if I don't look at them for a while, and I guess I
// can just unpin them if necessary … can you use the little dot pin for like
// Maps that people put on Maps, and make just the top part turn red when it's
// pinned and click it again to unpin").
//
// Drives the REAL public/chats.html against a stub API and asserts:
//   1. the pin sits in the thread header beside the bell, and is OFF on a chat
//      she has never pinned,
//   2. it lights on a chat carrying `pinTop:true` from the registry,
//   3. tapping it POSTs /api/chatfeed/pin-top with the flipped value and lights,
//   4. tapping again turns it back off (and POSTs `pinTop:false`),
//   5. a failed POST rolls the light back — nothing lies about being pinned,
//   6. ONLY THE TOP PART IS RED: the head circle is filled in the red and the
//      tail outline is NOT — her exact ask, and the one thing a single-path
//      map-pin glyph could not do,
//   7. nothing is red at rest,
//   8. THE POINT OF ALL OF IT — a pinned chat leads the home list even when its
//      newest message is the OLDEST on the screen, including a chat that has
//      just come back out of the hidden pile,
//   9. the pinned row carries the pin mark and no other row does,
//  10. the pin is tappable where it is drawn (the autoscroll pill owns the
//      top-right corner and has buried real controls before).
//
//   npm install playwright-core --no-save && node scripts/test-chats-pin-top.js
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }

const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const HOUR = 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();
// `sunk` is the oldest thing on the screen AND it is pinned — that is the
// whole feature: without the pin it sorts last, with it, first. Its `hiddenAt`
// is older than its own newest message, which is how the page reads "this one
// came back out of the hidden pile".
const MSGS = [
  { id: 'm1', chat: 'sunk', from: 'claude', text: 'quiet for days', tldr: 'quiet', created: iso(T0 - 72 * HOUR), postedAt: iso(T0 - 72 * HOUR) },
  { id: 'm2', chat: 'middle', from: 'claude', text: 'an hour ago', tldr: 'middle', created: iso(T0 - HOUR), postedAt: iso(T0 - HOUR) },
  { id: 'm3', chat: 'newest', from: 'claude', text: 'just now', tldr: 'newest', created: iso(T0 - 1000), postedAt: iso(T0 - 1000) },
];
const posted = [];
let pinFails = false;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'test', settings: {}, truncated: [], messages: MSGS, delta: false,
      chats: {
        sunk: { lastSeen: MSGS[0].created, pinTop: true, hiddenAt: iso(T0 - 96 * HOUR) },
        middle: { lastSeen: MSGS[1].created },
        newest: { lastSeen: MSGS[2].created },
      } }));
  }
  if (url.pathname === '/api/chatfeed/pin-top' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      posted.push(JSON.parse(body || '{}'));
      res.writeHead(pinFails ? 500 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(pinFails ? { error: 'nope' } : { ok: true }));
    });
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}');
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
let checks = 0;
const ok = () => { checks++; };
const RED = /rgb\(179,\s*68,\s*63\)/;

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const pre = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(pre ? { executablePath: pre } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const home = async () => {
    await page.goto(base + '/chats');
    await page.waitForSelector('#grid .crow[data-chat="newest"]');
  };
  const open = async (chat) => {
    await home();
    await page.click('#grid .crow[data-chat="' + chat + '"]');
    await page.waitForSelector('#thread header .no .pinbtn', { timeout: 4000 });
  };

  // ── 8/9. the sort, which is the whole ask ─────────────────────────────────
  await home();
  const order = await page.$$eval('#grid .crow', (ns) => ns.map((n) => n.dataset.chat));
  if (order[0] !== 'sunk') {
    fail('the pinned chat did not lead the list — ' + JSON.stringify(order));
  } else ok();
  // …and the rest still sort by recency underneath it.
  if (order.slice(1).join(',') !== 'newest,middle') {
    fail('pinning disturbed the recency sort under it — ' + JSON.stringify(order));
  } else ok();
  if (!await page.$('#grid .crow[data-chat="sunk"] .cr-pin')) {
    fail('the pinned row carries no pin mark — nothing says why it is at the top');
  } else ok();
  const strayMarks = await page.$$('#grid .crow:not([data-chat="sunk"]) .cr-pin');
  if (strayMarks.length) fail('an unpinned row drew a pin mark');
  else ok();

  // ── 1/7. off by default, beside the bell, nothing red ─────────────────────
  await open('newest');
  if (!await page.$('#thread header .no .pinbtn')) fail('no pin in the header');
  else ok();
  const row = await page.$$eval('#thread header .no > *', (ns) => ns.map((n) => n.className));
  const iBell = row.findIndex((c) => /bellbtn/.test(c));
  const iPin = row.findIndex((c) => /pinbtn/.test(c));
  if (iBell < 0 || iPin !== iBell + 1) fail('the pin is not beside the bell: ' + JSON.stringify(row));
  else ok();
  if (await page.$('#thread header .no .pinbtn.on')) fail('an unpinned chat drew a lit pin');
  else ok();
  const restPaint = await page.$eval('#thread header .no .pinbtn', (n) => ({
    outline: getComputedStyle(n.querySelector('path')).stroke,
    head: getComputedStyle(n.querySelector('.pinhead')).fill,
    color: getComputedStyle(n).color,
  }));
  if (RED.test(restPaint.outline) || RED.test(restPaint.head) || RED.test(restPaint.color)) {
    fail('the pin is red at rest: ' + JSON.stringify(restPaint));
  } else ok();
  // The head must not be painted at all until it is pinned — a filled grey
  // head would read as a solid blob at 16px, which is the failure the
  // two-piece glyph exists to avoid.
  if (!/none/.test(restPaint.head)) fail('the head is filled while unpinned: ' + restPaint.head);
  else ok();

  await (async () => {                              // 10. tappable where drawn
    const box = await page.$eval('#thread header .no .pinbtn', (n) => {
      const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const hit = await page.evaluate(({ x, y }) => {
      const e = document.elementFromPoint(x, y);
      return e && e.closest('.pinbtn') ? 'ok' : (e ? (e.className || e.tagName) : 'none');
    }, box);
    if (hit !== 'ok') fail('the pin is buried under ' + hit); else ok();
  })();

  // ── 3/4. tapping writes it, both ways ─────────────────────────────────────
  await page.click('#thread header .no .pinbtn');
  await page.waitForSelector('#thread header .no .pinbtn.on', { timeout: 2000 })
    .catch(() => fail('tapping the pin did not light it'));
  ok();
  if (!posted.length || posted[0].chat !== 'newest' || posted[0].pinTop !== true) {
    fail('the pin did not POST pinTop:true — ' + JSON.stringify(posted[0] || null));
  } else ok();
  await page.click('#thread header .no .pinbtn');
  await page.waitForFunction(() => !document.querySelector('#thread header .no .pinbtn.on'), null, { timeout: 2000 })
    .catch(() => fail('tapping the lit pin did not unpin it'));
  ok();
  if (posted.length !== 2 || posted[1].pinTop !== false) {
    fail('unpinning did not POST pinTop:false — ' + JSON.stringify(posted[1] || null));
  } else ok();

  // ── 2/6. a pinned chat arrives lit, and ONLY ITS HEAD IS RED ──────────────
  await open('sunk');
  if (!await page.$('#thread header .no .pinbtn.on')) fail('a chat carrying pinTop:true drew an unlit pin');
  else ok();
  const litPaint = await page.$eval('#thread header .no .pinbtn', (n) => ({
    outline: getComputedStyle(n.querySelector('path')).stroke,
    head: getComputedStyle(n.querySelector('.pinhead')).fill,
    headStroke: getComputedStyle(n.querySelector('.pinhead')).stroke,
    body: getComputedStyle(n.querySelector('path')).fill,
  }));
  if (!RED.test(litPaint.head)) fail('the pinned head is not red: ' + JSON.stringify(litPaint));
  else ok();
  if (RED.test(litPaint.outline)) {
    fail('the whole pin went red — she asked for just the top part: ' + JSON.stringify(litPaint));
  } else ok();
  // The tail stays an OUTLINE. A `.bmk`-style blanket fill rule landing on
  // this glyph would flood the teardrop into a solid shape and lose the pin.
  if (!/none/.test(litPaint.body)) fail('the pin body got filled: ' + litPaint.body);
  else ok();
  // The head circle must never be stroked: it would draw a line straight
  // across the pin's neck.
  if (!/none/.test(litPaint.headStroke)) fail('the head circle is stroked: ' + litPaint.headStroke);
  else ok();

  // ── 5. a failed POST rolls the light back ─────────────────────────────────
  pinFails = true;
  await open('newest');
  await page.click('#thread header .no .pinbtn');
  await page.waitForFunction(() => !document.querySelector('#thread header .no .pinbtn.on'), null, { timeout: 3000 })
    .catch(() => fail('a failed save left the pin lit — it would lie about being pinned'));
  ok();
  pinFails = false;

  await browser.close();
  server.close();
  if (process.exitCode) console.error('\n' + checks + ' checks passed, some FAILED');
  else console.log('OK — ' + checks + ' checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
