#!/usr/bin/env node
// THE COMPOSER + THE WAKE DOORBELL in a chat's thread (Aug 2026 — the Chats
// app stops being read-only: she messages a chat from its thread and the chat
// is woken to answer; chat-wake.js and docs/chats-wake-doorbell.md).
//
// Drives the REAL public/chats.html against a stub API and asserts:
//   1. the thread shows a composer — textarea + a Send button (rounded
//      rectangle, never a pill),
//   2. Send POSTs /api/chatfeed/reply {chat, text} and THEN /api/chatfeed/wake
//      {chat} — the message must be in the feed before the chat is woken,
//   3. her message appears in the thread immediately, as "me",
//   4. the status line reads the honest wake outcome ("waking them up…"),
//   5. a not-wakeable chat gets the softer line, and the send still succeeded,
//   6. the Send button is tappable where it is drawn (the injected pill has
//      buried real controls before).
//
//   npm install playwright-core --no-save && node scripts/test-chats-composer.js
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
  { id: 'm1', chat: 'talky', from: 'claude', text: 'hello from the chat', tldr: 'hello', created: iso(T0 - 5000), postedAt: iso(T0 - 5000) },
];
const posted = [];           // [{path, body}] in arrival order
let wakeStatus = 'fired';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'test', settings: {}, truncated: [], messages: MSGS, delta: false,
      chats: { talky: { lastSeen: MSGS[0].created } } }));
  }
  if ((url.pathname === '/api/chatfeed/reply' || url.pathname === '/api/chatfeed/wake') && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      posted.push({ path: url.pathname, body: JSON.parse(body || '{}') });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(url.pathname.endsWith('/wake')
        ? { ok: true, status: wakeStatus, chat: 'talky' }
        : { ok: true, id: 'r1' }));
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
    await page.waitForSelector('#thread .composer textarea', { timeout: 4000 });
  };

  // ── 1. the composer exists, and Send is a rounded rectangle ──────────────
  await open('talky');
  if (!await page.$('#thread .composer .comp-send')) fail('no Send button in the composer');
  else ok();
  const br = await page.$eval('#thread .composer .comp-send', (n) => getComputedStyle(n).borderRadius);
  if (parseInt(br, 10) > 12) fail('Send looks like a pill (border-radius ' + br + ')');
  else ok();

  // ── 2/3/4. send → reply first, wake second, message painted, honest line ──
  await page.fill('#thread .composer textarea', 'good morning, are you up?');
  await page.click('#thread .composer .comp-send');
  await page.waitForFunction(() => document.querySelector('#thread .composer .comp-status')
    && /waking/i.test(document.querySelector('#thread .composer .comp-status').textContent), null, { timeout: 4000 });
  if (posted.length !== 2) fail('expected 2 POSTs, saw ' + JSON.stringify(posted));
  else ok();
  if (posted[0].path !== '/api/chatfeed/reply' || posted[0].body.chat !== 'talky'
      || posted[0].body.text !== 'good morning, are you up?') fail('reply POST wrong: ' + JSON.stringify(posted[0]));
  else ok();
  if (posted[1].path !== '/api/chatfeed/wake' || posted[1].body.chat !== 'talky') fail('wake POST wrong: ' + JSON.stringify(posted[1]));
  else ok();
  const mine = await page.$$eval('#thread .msg .m-chat.sophie', (ns) => ns.length);
  if (!mine) fail('her sent message did not appear in the thread');
  else ok();
  const cleared = await page.$eval('#thread .composer textarea', (n) => n.value);
  if (cleared !== '') fail('the box kept the sent text');
  else ok();

  // ── 5. a not-wakeable chat: send still lands, softer status ───────────────
  wakeStatus = 'not-wakeable';
  posted.length = 0;
  await page.fill('#thread .composer textarea', 'second try');
  await page.click('#thread .composer .comp-send');
  await page.waitForFunction(() => /isn.t wakeable/i.test(
    (document.querySelector('#thread .composer .comp-status') || {}).textContent || ''), null, { timeout: 4000 });
  ok();
  if (posted.length !== 2) fail('second send did not make both POSTs');
  else ok();

  // ── 6. tappable where drawn ───────────────────────────────────────────────
  const box = await page.$eval('#thread .composer .comp-send', (n) => { const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const hit = await page.evaluate(({ x, y }) => {
    const e = document.elementFromPoint(x, y);
    return e && e.closest('.comp-send') ? 'ok' : (e ? (e.className || e.tagName) : 'none');
  }, box);
  if (hit !== 'ok') fail('Send is buried under ' + hit);
  else ok();

  await browser.close();
  server.close();
  if (process.exitCode) { console.error('\n✗ composer test failed'); }
  else console.log('\nAll ' + checks + ' checks passed.');
})().catch((e) => { console.error('FAIL (harness): ' + (e && e.message)); process.exit(1); });
