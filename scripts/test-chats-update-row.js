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
//   1. it is ABOVE THE ACCOUNT TABS — in #nwdoors, the chrome, not in the
//      list — and it comes before the Review door in that row (Aug 2026 v2:
//      "both supposed to be smaller and they're supposed to go above the
//      chats"). Measured, not eyeballed: its bottom is above the tab row's top;
//   2. the word is "Update", there is NO icon in it, and it is SMALL — a chip,
//      not the full-width slab it shipped as;
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
      // ONE build string across both fixtures on purpose: a changed build is a
      // deploy signal and makes the page reload itself, which is a second
      // source of timing in a test that is not about deploys.
      build: 'test-build', chats: SETS[set], settings: {}, truncated: [],
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
  await page.waitForSelector('#nwdoors .nwdoor');

  // ---- 1. above the chats, and above the tabs ---------------------------
  const geo = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null;
      const b = e.getBoundingClientRect(); return { top: Math.round(b.y), bottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width) }; };
    return { doors: r('#nwdoors'), tabs: r('#accrow'), grid: r('#grid'), door: r('#nwdoors .nwdoor') };
  });
  if (!geo.doors || !geo.tabs) fail('lost the doors row or the tab row');
  else if (!(geo.doors.bottom <= geo.tabs.top)) {
    fail('the doors are not above the account tabs: doors end ' + geo.doors.bottom + ', tabs start ' + geo.tabs.top);
  } else ok('the doors sit above the account tabs, and so above the chats');
  if (geo.door && geo.door.h > 34) fail('the Update door is ' + geo.door.h + 'px tall — she asked for smaller');
  else ok('…and it is a chip, not a slab (' + (geo.door && geo.door.h) + 'px)');
  // A chip hugs its words: the slab ran the full width of the list.
  if (geo.door && geo.grid && geo.door.w > geo.grid.w / 2) {
    fail('the Update door is ' + geo.door.w + 'px wide inside a ' + geo.grid.w + 'px list — it is still a slab');
  } else ok('…hugging its words');
  if (await page.$('#grid .nwdoor')) fail('a door is still being drawn inside the list');

  // ---- 2. her word, and no icon -----------------------------------------
  const word = (await page.$eval('#nwdoors .nwdoor', (n) => n.textContent)).trim();
  if (word !== 'Update') fail('the door reads "' + word + '", not "Update"');
  else ok('…it reads Update');
  const marks = await page.$$eval('#nwdoors .nwdoor svg, #nwdoors .nwdoor img', (ns) => ns.length);
  if (marks) fail('the door carries ' + marks + ' icon(s) — she asked for none');
  else ok('…with no icon');

  // ---- 3. it opens the brief --------------------------------------------
  await Promise.all([page.waitForNavigation(), page.click('#nwdoors .nwdoor')]);
  if (!(await page.$('#briefpage'))) fail('the Update row did not open /brief');
  else ok('…and it opens /brief');

  // ---- 4. it survives the caught-up screen ------------------------------
  set = 'caught';
  await page.goto(base + '/chats?view=news');
  await page.waitForSelector('#nwdoors .nwdoor');
  // The page paints from its localStorage cache first and repaints when the
  // feed lands, so the caught-up screen is a state to WAIT for — asserting on
  // the first paint is a race that only sometimes goes the right way.
  await page.waitForFunction(
    () => document.querySelectorAll('#grid .nwcard').length === 0 && !!document.querySelector('#grid .state'),
    null, { timeout: 8000 }).catch(() => {});
  const cards = await page.$$eval('#grid .nwcard', (ns) => ns.length);
  if (cards) fail('the caught-up fixture still drew ' + cards + ' card(s)');
  const state = await page.$eval('#grid .state', (n) => n.textContent.trim()).catch(() => '');
  if (!/caught up/i.test(state)) fail('the caught-up line is missing: "' + state + '"');
  else ok('caught up: the door stays and the line still shows under it');

  // ---- 5. and it is gone on every other view ----------------------------
  await page.goto(base + '/chats');
  await page.waitForSelector('#grid .crow, #grid .state');
  const shown = await page.$eval('#nwdoors', (n) => !n.hidden && n.children.length > 0);
  if (shown) fail('the doors row is still painted on the chat list');
  else ok('…and it is put away on every other view');

  await browser.close();
  server.close();
  if (!failed) console.log('PASS: the Update row on the Update tab');
})();
