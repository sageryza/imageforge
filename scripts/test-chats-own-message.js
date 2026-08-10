#!/usr/bin/env node
// HER OWN MESSAGE MUST NOT RAISE THE "NEW MESSAGE" BAR (Aug 2026, Sophie: "it
// notifies me when my own message comes in — that's a bug").
// The hook lifts what she types in the Claude app into the feed, so it arrives
// on a delta poll like anything else. The row dot and the answered badges have
// always excluded her (from!=='sophie'); the bar was the one path that didn't,
// which made the one signal meaning "something came back" cry wolf.
//
// Drives the REAL public/chats.html headless against a stub feed and asserts:
//   1. a polled message from HER raises no bar — on the home list and inside
//      an open thread,
//   2. it is still merged, so it appears at the next natural render (nothing
//      is dropped just because it was silent),
//   3. a polled message from a CHAT still raises the bar (the fix must not
//      silence the real thing), and
//   4. a mixed poll counts only the chat's message.
//
//   npm install playwright-core --no-save && node scripts/test-chats-own-message.js
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

// enough messages that the page is scrollable — the bar only buffers when she
// is NOT parked at the top (at the top there is no place to lose, so new
// messages just render)
const MSGS = [];
for (let i = 0; i < 25; i++) {
  MSGS.push({ id: 'm' + i, chat: 'reader', from: 'claude', text: 'Message ' + i + '\n\nwith a second line so the rows have height.', tldr: 'msg ' + i, created: iso(T0 - 100000 + i * 1000), postedAt: iso(T0 - 100000 + i * 1000) });
}
// what the poll will hand back, set per phase by the test
let DELTA = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1',
      chats: { reader: { account: '1', lastSeen: MSGS[MSGS.length - 1].created } },
      settings: { appAccount: '1' }, truncated: [],
      messages: since ? DELTA : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, messages: [], todos: [], bookmarks: [] }));
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const barUp = (page) => page.evaluate(() => document.getElementById('newbar').classList.contains('show'));
const held = (page) => page.evaluate(() => window.__msgIds().length);

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid .crow[data-chat="reader"]');
  await page.click('#grid .crow[data-chat="reader"]');
  await page.waitForSelector('#thread .msg');
  // scroll off the top, or new messages render instead of buffering
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(100);

  const before = await held(page);

  // 1. HER message, polled into the open thread — no bar
  DELTA = [{ id: 'hers', chat: 'reader', from: 'sophie', text: 'do the images', created: iso(T0 + 1000), postedAt: iso(T0 + 1000) }];
  await page.evaluate(() => window.__poll());
  await page.waitForFunction((n) => window.__msgIds().length > n, before, { timeout: 4000 })
    .catch(() => fail('her own message never arrived at all'));
  if (await barUp(page)) fail('her own message raised the New message bar in an open thread');

  // 2. …but it IS held, so it shows at the next natural render
  const ids = await page.evaluate(() => window.__msgIds());
  if (ids.indexOf('hers') < 0) fail('her own message was dropped instead of just being silent');
  await page.evaluate(() => window.__openChat('reader'));
  await page.waitForFunction(() => !!document.querySelector('#thread .msg[data-mid="hers"]'), null, { timeout: 4000 })
    .catch(() => fail('her own message never rendered in the thread'));

  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(100);

  // 3. a message from the CHAT still raises the bar — the fix must not
  //    silence the one signal that means "something came back"
  DELTA = [{ id: 'reply', chat: 'reader', from: 'claude', text: 'here you go', tldr: 'done', created: iso(T0 + 2000), postedAt: iso(T0 + 2000) }];
  await page.evaluate(() => window.__poll());
  await page.waitForFunction(() => document.getElementById('newbar').classList.contains('show'), null, { timeout: 4000 })
    .catch(() => fail('a real reply did NOT raise the New message bar'));

  // 4. a mixed poll counts only the chat's message
  await page.click('#newbar');                       // clears the count
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(100);
  if (await barUp(page)) fail('the bar did not clear when she tapped it');
  DELTA = [
    { id: 'hers2', chat: 'reader', from: 'sophie', text: 'and one more', created: iso(T0 + 3000), postedAt: iso(T0 + 3000) },
    { id: 'reply2', chat: 'reader', from: 'claude', text: 'on it', tldr: 'ok', created: iso(T0 + 4000), postedAt: iso(T0 + 4000) },
  ];
  await page.evaluate(() => window.__poll());
  await page.waitForFunction(() => document.getElementById('newbar').classList.contains('show'), null, { timeout: 4000 })
    .catch(() => fail('a mixed poll raised no bar at all'));
  const label = await page.$eval('#newtxt', (n) => n.textContent.trim());
  if (label !== 'New message') fail('the mixed poll counted her own message too: "' + label + '"');

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('PASS: her own message never notifies her; a real reply still does');
})().catch((e) => { console.error(e); process.exit(1); });
