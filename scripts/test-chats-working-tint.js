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
// and asserts the legs of the loop as of v3 (Aug 2026 — honest signals only,
// and the tint lives WITH auto-parking, inside the hidden pile):
//   1. no tint when nothing is working — INCLUDING a chat whose newest
//      message is hers with no ping (the "skill" false positive, removed),
//   1b. a parked chat with a live ping glows inside the pile, and the closed
//      bar carries "· 1 working" so the glow isn't a secret,
//   2. a poll that brings ONLY a fresh workingAt (no messages) tints that
//      chat's tile — the fixed repaint bug,
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
  // the "skill" regression: her message is the NEWEST thing here and there is
  // NO ping — that chat is waiting, not working, and must never tint
  { id: 'm3', chat: 'chat-s', text: 'reply', tldr: 's', created: iso(T0 - 3400000), postedAt: iso(T0 - 3400000) },
  { id: 'm4', chat: 'chat-s', from: 'sophie', text: 'do the thing', tldr: '', created: iso(T0 - 60000), postedAt: iso(T0 - 60000) },
  // parked AND working: answering parks a chat, and while it works its row
  // inside the hidden pile glows (Sophie, v3) — the bar counts it too
  { id: 'm5', chat: 'chat-p', text: 'parked reply', tldr: 'p', created: iso(T0 - 3300000), postedAt: iso(T0 - 3300000) },
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
      'chat-s': { lastSeen: MSGS[2].created },
      'chat-p': { lastSeen: MSGS[4].created, hiddenAt: iso(T0), workingAt: iso(T0) },
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
  // TINT defaults true on the live page since v3; forcing it keeps this test
  // meaningful even if the default ever flips again.
  await page.evaluate(() => window.__setTint(true));
  await page.evaluate(() => window.__repaintLive && window.__repaintLive());

  // 1. nothing working → no tint on the main list, and in particular NOT on
  //    chat-s, whose newest message is hers with no ping (the "skill" bug)
  let live = await liveChats();
  if (live.length) fail('expected no live tint at rest, got: ' + live.join(','));

  // 1b. the parked working chat: the bar counts it while closed, and its row
  //     inside the pile glows once opened (Sophie, v3 — tint lives WITH
  //     parking, inside the hidden area)
  const barTxt = await page.$eval('.hidebar', (n) => n.textContent.replace(/\s+/g, ' ').trim());
  if (!/1 working/.test(barTxt)) fail('the closed bar does not count the working parked chat: ' + barTxt);
  await page.click('.hidebar');
  await page.waitForSelector('.hidelist [data-chat="chat-p"]');
  const pRow = await page.$eval('.hidelist [data-chat="chat-p"]', (n) => n.classList.contains('live'));
  if (!pRow) fail('the parked working chat does not glow inside the pile');
  await page.click('.hidebar');   // close it again for the steps below

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
  console.log(process.exitCode ? "DONE with failures" : "OK: honest tint only — parked chats glow in the pile, her-message-newest never tints");
})().catch((e) => { console.error(e); process.exit(1); });
