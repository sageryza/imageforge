#!/usr/bin/env node
// THE BELL AND THE TWO PICTURE BUTTONS in a chat's header (Aug 2026, Sophie:
// "add a little bell next to the star that I can click in. This will enable
// notifications for this chat and un-click and it will turn them off — only
// the ones I clicked the bell on will notify me. Also, can you make the delete
// button a picture of a trash can and the hide button a picture of an eye
// that's crossed out if it's hidden").
//
// Drives the REAL public/chats.html against a stub API and asserts:
//   1. the bell sits beside the star, and is OFF on a chat she has never belled,
//   2. it lights on a chat carrying `notify:true` from the registry,
//   3. tapping it POSTs /api/chatfeed/notify with the flipped value and lights,
//   4. tapping again turns it back off (and POSTs `notify:false`),
//   5. a failed POST rolls the light back — nothing lies about being on,
//   6. HIDE is an eye, OPEN on a live chat and CROSSED on a hidden one,
//   7. DELETE is a trash can, and neither word is left in the row,
//   8. every one of them is tappable where it is drawn (the autoscroll pill
//      owns the top-right corner and has buried real controls before).
//
//   npm install playwright-core --no-save && node scripts/test-chats-bell.js
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
const MSGS = [
  { id: 'm1', chat: 'no-bell', from: 'claude', text: 'quiet chat', tldr: 'quiet', created: iso(T0 - 1000), postedAt: iso(T0 - 1000) },
  { id: 'm2', chat: 'belled', from: 'claude', text: 'loud chat', tldr: 'loud', created: iso(T0 - 2000), postedAt: iso(T0 - 2000) },
  { id: 'm3', chat: 'parked', from: 'claude', text: 'in the hidden pile', tldr: 'parked', created: iso(T0 - 3000), postedAt: iso(T0 - 3000) },
];
// What the page POSTed, in order, so the test can assert the wire and not just
// the paint.
const posted = [];
let notifyFails = false;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'test', settings: {}, truncated: [], messages: MSGS, delta: false,
      chats: {
        'no-bell': { lastSeen: MSGS[0].created },
        // Belled, and hidden LONG ago so it still reads as live (hiddenAt older
        // than its newest message is how the page decides it came back).
        belled: { lastSeen: MSGS[1].created, notify: true },
        parked: { lastSeen: MSGS[2].created, hiddenAt: iso(T0) },
      } }));
  }
  if (url.pathname === '/api/chatfeed/notify' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      posted.push(JSON.parse(body || '{}'));
      res.writeHead(notifyFails ? 500 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(notifyFails ? { error: 'nope' } : { ok: true }));
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

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const pre = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(pre ? { executablePath: pre } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const open = async (chat) => {
    await page.goto(base + '/chats');
    await page.waitForSelector('#grid [data-chat="' + chat + '"]');
    await page.click('#grid .crow[data-chat="' + chat + '"]');
    await page.waitForSelector('#thread header .no .starbtn', { timeout: 4000 });
  };
  // Tappable where drawn, or something is sitting on top of it.
  const hitTest = async (sel, what) => {
    const box = await page.$eval(sel, (n) => { const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const hit = await page.evaluate(({ x, y, s }) => {
      const e = document.elementFromPoint(x, y);
      return e && e.closest(s) ? 'ok' : (e ? (e.className || e.tagName) : 'none');
    }, { ...box, s: sel });
    if (hit !== 'ok') fail(what + ' is buried under ' + hit); else ok();
  };

  // ── 1. off by default, and next to the star ───────────────────────────────
  await open('no-bell');
  if (!await page.$('#thread header .no .bellbtn')) fail('no bell in the header');
  else ok();
  const order = await page.$$eval('#thread header .no > *', (ns) => ns.map((n) => n.className));
  const iStar = order.findIndex((c) => /starbtn/.test(c));
  const iBell = order.findIndex((c) => /bellbtn/.test(c));
  if (iStar < 0 || iBell !== iStar + 1) fail('the bell is not beside the star: ' + JSON.stringify(order));
  else ok();
  if (await page.$('#thread header .no .bellbtn.on')) fail('an unbelled chat drew a lit bell');
  else ok();

  // ── 6/7. the two picture buttons, and no words left behind ────────────────
  if (!await page.$('#thread header .no .eyebtn svg')) fail('HIDE is not a picture');
  else ok();
  if (!await page.$('#thread header .no .trashbtn.delbtn svg')) fail('DELETE is not a picture');
  else ok();
  const words = await page.$eval('#thread header .no', (n) => n.textContent.replace(/\s+/g, ' ').trim());
  if (/hide|delete/i.test(words)) fail('the row still carries a word: ' + words);
  else ok();
  // ARCHIVE is deliberately still a word — she only asked for the other two.
  if (!/archive/i.test(words)) fail('the Archive word went missing: ' + words);
  else ok();
  // A live chat's eye is OPEN: the crossing stroke (m2 2 20 20) is the tell.
  const liveEye = await page.$eval('#thread header .no .eyebtn', (n) => n.innerHTML);
  if (/m2 2 20 20/.test(liveEye)) fail('a live chat drew the CROSSED eye');
  else ok();

  await hitTest('#thread header .no .bellbtn', 'the bell');
  await hitTest('#thread header .no .eyebtn', 'the eye');
  await hitTest('#thread header .no .trashbtn.delbtn', 'the trash can');

  // ── 3/4. tapping writes it, both ways ─────────────────────────────────────
  await page.click('#thread header .no .bellbtn');
  await page.waitForSelector('#thread header .no .bellbtn.on', { timeout: 2000 })
    .catch(() => fail('tapping the bell did not light it'));
  ok();
  if (!posted.length || posted[0].chat !== 'no-bell' || posted[0].notify !== true) {
    fail('the bell did not POST notify:true — ' + JSON.stringify(posted[0] || null));
  } else ok();
  await page.click('#thread header .no .bellbtn');
  await page.waitForFunction(() => !document.querySelector('#thread header .no .bellbtn.on'), null, { timeout: 2000 })
    .catch(() => fail('tapping the lit bell did not turn it off'));
  ok();
  if (posted.length !== 2 || posted[1].notify !== false) {
    fail('turning it off did not POST notify:false — ' + JSON.stringify(posted[1] || null));
  } else ok();

  // ── 2. a belled chat arrives lit ──────────────────────────────────────────
  await open('belled');
  if (!await page.$('#thread header .no .bellbtn.on')) fail('a chat carrying notify:true drew an unlit bell');
  else ok();

  // ── 5. a failed POST rolls the light back ─────────────────────────────────
  notifyFails = true;
  await open('no-bell');
  await page.click('#thread header .no .bellbtn');
  await page.waitForFunction(() => !document.querySelector('#thread header .no .bellbtn.on'), null, { timeout: 3000 })
    .catch(() => fail('a failed save left the bell lit — it would lie about being on'));
  ok();
  notifyFails = false;

  // ── 6b. the hidden pile's chat draws the CROSSED eye ──────────────────────
  // A hidden chat is not on the live list, so go in the way she does: tap the
  // red HIDDEN bar to open the pile, then its row.
  await page.goto(base + '/chats');
  await page.waitForSelector('.hidebar', { timeout: 4000 }).catch(() => fail('no hidden bar to open the pile with'));
  await page.click('.hidebar');
  await page.waitForSelector('#grid .crow[data-chat="parked"]', { timeout: 4000 })
    .catch(() => fail('the hidden pile never showed its chat'));
  await page.click('#grid .crow[data-chat="parked"]');
  await page.waitForSelector('#thread header .no .eyebtn', { timeout: 4000 });
  const eye = await page.$eval('#thread header .no .eyebtn', (n) => n.innerHTML);
  if (!/m2 2 20 20/.test(eye)) fail('a hidden chat did not draw the crossed eye');
  else ok();

  await browser.close();
  server.close();
  if (process.exitCode) console.error(`\n${checks} checks passed before the failure(s) above`);
  else console.log(`chats bell + picture buttons: ${checks} checks passed`);
})().catch((e) => { console.error(e); process.exit(1); });
