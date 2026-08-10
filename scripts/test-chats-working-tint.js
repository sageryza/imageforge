#!/usr/bin/env node
// Regression test for the 2026-08-09 report: "the pink working tint on the
// Chats home screen doesn't work." The server side was fine — the hook's
// turn-start ping stamped workingAt on the registry and the reply cleared it —
// but the mark lives on the REGISTRY, not on any message, so it arrives as a
// delta poll with fresh `chats` and ZERO new messages. poll() returned early
// on the empty message list and never repainted, so the mark landed in memory
// and no tile ever turned pink.
//
// Drives the REAL public/chats.html in a headless browser against a stub API
// and asserts the three legs of the loop:
//   1. home renders with no tint when nothing is working,
//   2. a poll that brings ONLY a fresh workingAt (no messages) tints that
//      chat's tile — the fixed bug,
//   3. a poll that brings the cleared mark (again no messages) drops the tint.
//
//   npm install playwright-core --no-save && node scripts/test-chats-working-tint.js
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
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();

// Two chats, one finished reply each — old enough that neither fallback signal
// (live draft / her message newest) can tint on its own. Only workingAt can.
const MSGS = [
  { id: 'm1', chat: 'chat-a', text: 'reply in chat a', tldr: 'a done', created: iso(T0 - 3600000), postedAt: iso(T0 - 3600000) },
  { id: 'm2', chat: 'chat-b', text: 'reply in chat b', tldr: 'b done', created: iso(T0 - 3500000), postedAt: iso(T0 - 3500000) },
];
// Mutable server state: the test flips this between polls, the way the hook's
// ping and the reply's clear flip the real registry doc.
const state = { workingA: false };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const reg = {
      'chat-a': { lastSeen: MSGS[0].created },
      'chat-b': { lastSeen: MSGS[1].created },
    };
    if (state.workingA) reg['chat-a'].workingAt = iso(Date.now());
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1',
      chats: reg,
      settings: {},
      truncated: [],
      messages: since ? [] : MSGS,   // the delta never carries a new message here
      delta: !!since,
    }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  // icons, bookmarks, anything else the page asks for along the way
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({}));
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage();

  // The page polls on visibilitychange when visible — that's the tap on the
  // shoulder the test uses instead of waiting out the 20s timer.
  const forcePoll = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const liveChats = () => page.$$eval('#grid [data-chat]',
    (ns) => ns.filter(n => n.classList.contains('live')).map(n => n.dataset.chat));

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="chat-a"]');
  // THE TINT IS SWITCHED OFF on the live page (Aug 2026 — it could not be made
  // honest: it needs the hook's turn-start ping, and sessions older than the
  // setup-script re-paste never send one, so it missed working chats and lit
  // idle ones). The machinery is all still there behind `TINT`, so this test
  // flips it on the way `__setHomeView` keeps the retained Status view
  // testable — the repaint path stays proven for whenever it comes back.
  await page.evaluate(() => window.__setTint(true));
  await page.evaluate(() => window.__repaintLive && window.__repaintLive());

  // 1. nothing working → no tint anywhere
  let live = await liveChats();
  if (live.length) fail('expected no live tint at rest, got: ' + live.join(','));

  // 2. the hook pings /working → the next poll carries ONLY the registry mark
  state.workingA = true;
  await forcePoll();
  await page.waitForFunction(() =>
    document.querySelector('#grid [data-chat="chat-a"]').classList.contains('live'),
    null, { timeout: 4000 }).catch(() => fail('workingAt arrived on a message-less poll but chat-a never tinted'));
  live = await liveChats();
  if (live.includes('chat-b')) fail('chat-b tinted without a working mark');

  // 3. the reply clears the mark → the next poll (still no messages) drops it
  state.workingA = false;
  await forcePoll();
  await page.waitForFunction(() =>
    !document.querySelector('#grid [data-chat="chat-a"]').classList.contains('live'),
    null, { timeout: 4000 }).catch(() => fail('mark cleared but chat-a stayed tinted'));

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures' : 'OK: working tint paints on a message-less poll and clears the same way');
})().catch((e) => { console.error(e); process.exit(1); });
