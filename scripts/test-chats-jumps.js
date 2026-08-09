#!/usr/bin/env node
// The floating jump pair (Aug 2026, Sophie: "right now I can go all the way
// back up to the top with that little floating arrow at the bottom — could you
// make another arrow next to it that brings me all the way down to the
// bottom"). Drives the REAL public/chats.html headless against a stub API and
// asserts:
//   1. at the top of a long list only the DOWN arrow shows — neither floats
//      over the page when it has nowhere to go,
//   2. tapping it lands at the bottom, where only the UP arrow shows,
//   3. tapping that lands back at the top,
//   4. a short list shows NEITHER,
//   5. both stop the autoscroll first, or the page keeps creeping after it
//      arrives,
//   6. they are hidden in select mode, where the filing bar owns the bottom.
//
//   npm install playwright-core --no-save && node scripts/test-chats-jumps.js
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

// enough chats to make the page much taller than the screen
const MANY = 40;
const MSGS = [];
const CHATS = {};
for (let i = 0; i < MANY; i++) {
  const c = 'chat-' + String(i).padStart(2, '0');
  MSGS.push({ id: 'm' + i, chat: c, from: 'claude', text: 'reply ' + i, tldr: 'tldr ' + i,
              created: iso(T0 - i * 60000), postedAt: iso(T0 - i * 60000) });
  CHATS[c] = { lastSeen: MSGS[i].created };
}
let few = false;   // flipped to serve a short list

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    const msgs = few ? MSGS.slice(0, 2) : MSGS;
    const chats = {};
    msgs.forEach((m) => { chats[m.chat] = CHATS[m.chat]; });
    return json({ build: 'test-build-1', chats, settings: {}, truncated: [],
                  messages: since ? [] : msgs, delta: !!since });
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  json({});
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const shown = (page) => page.evaluate(() => ({
  up: document.getElementById('totop').classList.contains('show'),
  down: document.getElementById('tobot').classList.contains('show'),
}));

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="chat-00"]');

  // 1. at the top of a long list: down only
  let s = await shown(page);
  if (s.up) fail('the up arrow shows at the top of the page');
  if (!s.down) fail('the down arrow is missing on a long list');

  // 5a. tapping stops the autoscroll — start it for real, and prove it really
  //     started, or 5b below would pass on a page that was never moving
  await page.evaluate(() => window.__scrollStart(1));   // 1 = downward
  const moved = await page.evaluate(async () => {
    const a = window.scrollY;
    await new Promise((r) => setTimeout(r, 500));
    return window.scrollY - a;
  });
  if (moved <= 2) fail('the autoscroll never actually started, so the stop is untested');
  // 2. down lands at the bottom, and only the up arrow remains
  await page.click('#tobot');
  await page.waitForFunction(() => {
    const left = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
    return left < 4;
  }, null, { timeout: 6000 }).catch(() => fail('the down arrow did not reach the bottom'));
  s = await shown(page);
  if (!s.up) fail('the up arrow is missing at the bottom');
  if (s.down) fail('the down arrow still shows at the bottom');

  // 3. up lands back at the top
  await page.click('#totop');
  await page.waitForFunction(() => window.scrollY < 4, null, { timeout: 6000 })
    .catch(() => fail('the up arrow did not reach the top'));
  s = await shown(page);
  if (s.up) fail('the up arrow still shows at the top');

  // 5b. nothing is still scrolling the page after the jump
  const y1 = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(700);
  const y2 = await page.evaluate(() => window.scrollY);
  if (Math.abs(y2 - y1) > 2) fail('the page kept moving after the jump — the autoscroll was not stopped');

  // 6. hidden while she is picking chats (the filing bar owns the bottom)
  await page.click('#selbtn');
  await page.waitForSelector('#selbar');
  const vis = await page.evaluate(() => getComputedStyle(document.querySelector('.jumps')).display);
  if (vis !== 'none') fail('the jump arrows sit over the select bar: ' + vis);
  await page.click('#selbtn');

  // 4. a short list shows neither
  few = true;
  await page.click('#refresh');
  await page.waitForFunction(() => document.querySelectorAll('#grid .crow[data-chat]').length <= 2,
    null, { timeout: 6000 }).catch(() => fail('the short list never rendered'));
  await page.waitForTimeout(150);
  s = await shown(page);
  if (s.up || s.down) fail('an arrow floats over a list that already fits: ' + JSON.stringify(s));

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures' : 'OK: the jump pair goes both ways and hides when it has nowhere to go');
})().catch((e) => { console.error(e); process.exit(1); });
