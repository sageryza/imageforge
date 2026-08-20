#!/usr/bin/env node
// THE UPDATE ROW ON THE UPDATE TAB (Aug 2026, Sophie: "a couple days ago we
// added a what's new button to the main screen, but I wanted it to go on the
// update screen — could you rename it update, no icon, and put it on the update
// screen").
//
// The button moved off the iOS home grid, where it was "What's new" with a list
// icon, and became a row at the top of the Chats app's UPDATE tab. Driven for
// real against the REAL public/chats.html in headless Chromium, this pins the
// four things that made it what she asked for:
//
//   1. it is the FIRST thing on the tab — above the Review row, above every
//      section, so it is what she sees when she opens the screen;
//   2. the word is "Update" and there is NO icon in it (her ask, and the one
//      part of the move that is easy to lose to a copy-paste from the Review
//      row, which has a fold arrow);
//   3. it opens /brief;
//   4. it is there on the CAUGHT-UP screen too — the page behind it answers a
//      different question from the cards, so an empty list is no reason to take
//      the door away — and "you're all caught up" still shows underneath it
//      (the empty state used to write over the whole container).
//
//   npm install playwright-core --no-save && node scripts/test-chats-update-row.js
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

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();

let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; process.exitCode = 1; };
const ok = (m) => console.log('  ok   ' + m);

// One chat that has spoken since her ✓ (a card), and the same registry with
// nothing new (the caught-up screen). Two sets, one stub.
const MSGS = [{
  id: 'm1', chat: 'talky', from: 'claude', text: 'talky said something',
  tldr: 'talky tldr', created: iso(T0 - 3600e3), postedAt: iso(T0 - 3600e3),
}];
const SETS = {
  news:   { talky: {} },
  caught: { talky: { notifSeenAt: iso(T0) } },
};
let set = 'news';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-' + set, chats: SETS[set], settings: {}, truncated: [],
      messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/brief') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<!doctype html><title>Update</title><body id="briefpage">brief</body>');
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  const asset = path.join(PUB, url.pathname.replace(/^\/+/, ''));
  if (/\.(js|css|svg|png|webp)$/.test(url.pathname) && asset.startsWith(PUB) && fs.existsSync(asset)) {
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return res.end(fs.readFileSync(asset));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => fail('the page threw: ' + e.message));

  await page.goto(base + '/chats?view=news');
  await page.waitForSelector('#grid .nwupd');

  // ---- 1. first on the screen -------------------------------------------
  const firstClass = await page.$eval('#grid > *', (n) => n.className);
  if (!/\bnwupd\b/.test(firstClass)) fail('the Update row is not the first thing on the tab: "' + firstClass + '"');
  else ok('the Update row leads the tab');

  // ---- 2. her word, and no icon -----------------------------------------
  const word = (await page.$eval('.nwupdgo', (n) => n.textContent)).trim();
  if (word !== 'Update') fail('the row reads "' + word + '", not "Update"');
  else ok('…it reads Update');
  const marks = await page.$$eval('.nwupd svg, .nwupd img', (ns) => ns.length);
  if (marks) fail('the row carries ' + marks + ' icon(s) — she asked for none');
  else ok('…with no icon');

  // ---- 3. it opens the brief --------------------------------------------
  await Promise.all([page.waitForNavigation(), page.click('.nwupdgo')]);
  if (!(await page.$('#briefpage'))) fail('the Update row did not open /brief');
  else ok('…and it opens /brief');

  // ---- 4. it survives the caught-up screen ------------------------------
  set = 'caught';
  await page.goto(base + '/chats?view=news');
  await page.waitForSelector('#grid .nwupd');
  const cards = await page.$$eval('#grid .nwcard', (ns) => ns.length);
  if (cards) fail('the caught-up fixture still drew ' + cards + ' card(s)');
  const state = await page.$eval('#grid .state', (n) => n.textContent.trim()).catch(() => '');
  if (!/caught up/i.test(state)) fail('the caught-up line is missing: "' + state + '"');
  else ok('caught up: the row stays and the line still shows under it');

  await browser.close();
  server.close();
  if (!failed) console.log('PASS: the Update row on the Update tab');
})();
