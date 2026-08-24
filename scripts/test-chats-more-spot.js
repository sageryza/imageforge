#!/usr/bin/env node
// A CHAT BEHIND THE MORE FOLD CAN OPEN EMPTY, AND IT STILL NEEDS THE DOOR
// (Aug 2026, Sophie: "the messages are gone that might be fine but there's
// also no button to get back into that chat").
//
// The Open-in-Claude button has only ever been drawn on a MESSAGE ROW, so a
// thread with nothing in it had no way back into the session at all — and the
// chats behind that fold are exactly the quiet ones whose thread comes back
// empty. The session url is on the REGISTRY doc, not only on the messages.
//
// Drives the REAL public/chats.html in headless Chromium against a stub feed
// whose quiet chats answer /thread with nothing, and asserts:
//   1. that empty thread carries the Open button, pointing at the url on its
//      registry doc,
//   2. it is really TAPPABLE (asked with elementFromPoint — "visible" is not
//      the question when an injected pill owns a corner),
//   3. a chat with no url on file draws NO button — never an invented one,
//   4. a thread that HAS messages is untouched: no second door in an empty
//      state it does not have, and its message rows keep their own.
//
// The fold's SCROLL behaviour lives in scripts/test-chats-more.js (§9).
//
//   npm install playwright-core --no-save && node scripts/test-chats-more-spot.js
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
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();

// a handful of ordinary chats to sit above the fold
const MSGS = [];
const CHATS = {};
for (let i = 0; i < 4; i++) {
  const n = 'fresh-' + String(i).padStart(2, '0');
  MSGS.push({ id: 'f' + i, chat: n, from: 'claude', text: 'today ' + i, tldr: 't' + i,
    created: iso(T0 - 3600000 - i * 1000), postedAt: iso(T0 - 3600000 - i * 1000),
    url: 'https://claude.ai/code/session_fresh' + i });
  CHATS[n] = { lastSeen: MSGS[i].created, url: 'https://claude.ai/code/session_fresh' + i };
}
// stale, with history — folds into MORE and opens with messages (§5)
MSGS.push({ id: 'old1', chat: 'old-talky', from: 'claude', text: 'nine days ago', tldr: 'old',
  created: iso(T0 - 9 * DAY), postedAt: iso(T0 - 9 * DAY), url: 'https://claude.ai/code/session_talky' });
CHATS['old-talky'] = { lastSeen: iso(T0 - 9 * DAY), url: 'https://claude.ai/code/session_talky' };
// in the registry, nothing in the feed, but the session url IS on file — the
// exact shape she hit
CHATS['quiet-with-url'] = { url: 'https://claude.ai/code/session_quiet' };
// nothing in the feed and no url either — nothing to offer, so nothing shown
CHATS['quiet-no-url'] = {};

const TRUNCATED = ['quiet-with-url', 'quiet-no-url'];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    return json({ build: 'test-build-1', chats: CHATS, settings: {}, truncated: TRUNCATED,
      messages: since ? [] : MSGS, delta: !!since });
  }
  // the quiet chats really have nothing — an empty thread that never repairs
  if (url.pathname === '/api/chatfeed/thread') return json({ messages: [] });
  if (url.pathname === '/api/gallery/assets/recent') return json({ assets: [] });
  if (url.pathname === '/api/chatfeed/pages-recent') return json({ pages: [] });
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  json({});
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };

// out of a thread and back to the fold — the title is the way out of a chat
async function backHome(page) {
  await page.evaluate(() => document.getElementById('back').click());
  await page.waitForSelector('#grid .crow[data-chat]', { timeout: 4000 });
  await page.evaluate(() => window.__setMoreOpen(true));
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 664 } });

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="fresh-00"]');

  // open the fold — the quiet chats live behind it
  if (!await page.$('.morebar')) return void fail('no More bar drawn at all'), browser.close(), server.close();
  await page.evaluate(() => window.__setMoreOpen(true));

  // ---- 1 + 2. an empty thread carries the way back in -------------------
  await page.waitForSelector('#grid .morelist .crow[data-chat="quiet-with-url"]', { timeout: 4000 })
    .catch(() => fail('quiet-with-url never showed in the fold'));
  await page.click('#grid .morelist .crow[data-chat="quiet-with-url"]');
  await page.waitForSelector('#thread .state', { timeout: 4000 })
    .catch(() => fail('the quiet chat did not open on an empty state'));
  const doorHref = await page.$eval('#thread .state .openclaude', (a) => a.getAttribute('href'))
    .catch(() => null);
  if (!doorHref) fail('an empty thread had NO way back into the chat');
  else if (doorHref.indexOf('session_quiet') < 0)
    fail('the empty thread’s Open button points somewhere else: ' + doorHref);
  // and it is really tappable, not covered by the injected pill or anything else
  const reachable = await page.evaluate(() => {
    const a = document.querySelector('#thread .state .openclaude');
    if (!a) return false;
    a.scrollIntoView({ block: 'center' });
    const r = a.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(hit && (hit === a || a.contains(hit)));
  });
  if (!reachable) fail('the empty thread’s Open button is on screen but cannot be tapped');

  // ---- 3. no url on file → no button, never an invented one -------------
  await backHome(page);
  await page.waitForSelector('#grid .morelist .crow[data-chat="quiet-no-url"]', { timeout: 4000 })
    .catch(() => fail('quiet-no-url never showed in the fold'));
  await page.click('#grid .morelist .crow[data-chat="quiet-no-url"]');
  await page.waitForSelector('#thread .state', { timeout: 4000 })
    .catch(() => fail('quiet-no-url did not open on an empty state'));
  if (await page.$('#thread .state .openclaude'))
    fail('a chat with no session url on file was given an Open button anyway');

  // ---- 4. a thread with messages is untouched ---------------------------
  await backHome(page);
  await page.click('#grid .morelist .crow[data-chat="old-talky"]');
  await page.waitForSelector('#thread .msg', { timeout: 4000 })
    .catch(() => fail('old-talky did not open on its messages'));
  if (await page.$('#thread .state .openclaude'))
    fail('a thread with messages grew a second Open door in an empty state');
  const onMsg = await page.$$eval('#thread .msg .openclaude', (ns) => ns.length);
  if (!onMsg) fail('the message rows lost their own Open button');

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('OK: an empty thread carries the way back into the chat — and never an invented one');
})();
