#!/usr/bin/env node
// MORE — the chats she hasn't touched in over seven days (Aug 2026, Sophie:
// "if there's a chat that I haven't touched in over seven days, can you add a
// new section underneath all the chats called more, and it's just an arrow
// that opens up the rest").
//
// Drives the REAL public/chats.html in headless Chromium against a stub feed
// and asserts:
//   1. a chat whose last message is over 7 days old leaves the main list,
//   2. the bar sits UNDERNEATH the list (not above it) and counts what is
//      folded, naming anything unread there,
//   3. tapping it appends those rows below; tapping again folds them away,
//   4. the fold starts CLOSED on every load,
//   5. a chat that is WORKING right now never folds, however old its last
//      message is — it is being touched at this second,
//   6. a chat with NO messages counts as untouched,
//   7. no bar at all when nothing is stale,
//   8. the seven-day boundary itself (chatStale, run for real),
//   9. tapping the bar LEAVES HER WHERE SHE IS (Aug 2026, Sophie: "when I
//      clicked the more button in the chat app, it takes me all the way back
//      to the top. It should stay where I am") — measured on a list long
//      enough to scroll, on the way open AND on the way closed.
//
//   npm install playwright-core --no-save && node scripts/test-chats-more.js
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
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();

// two fresh, three stale. `old-unread` is stale AND never opened, so the bar
// has to say so; `working` is ancient but mid-turn, so it must stay up top.
const MSGS = [
  { id: 'm1', chat: 'fresh-a', from: 'claude', text: 'today', tldr: 'a', created: iso(T0 - 3600000), postedAt: iso(T0 - 3600000) },
  { id: 'm2', chat: 'fresh-b', from: 'claude', text: 'two days ago', tldr: 'b', created: iso(T0 - 2 * DAY), postedAt: iso(T0 - 2 * DAY) },
  { id: 'm3', chat: 'old-read', from: 'claude', text: 'nine days ago', tldr: 'c', created: iso(T0 - 9 * DAY), postedAt: iso(T0 - 9 * DAY) },
  { id: 'm4', chat: 'old-unread', from: 'claude', text: 'twenty days ago', tldr: 'd', created: iso(T0 - 20 * DAY), postedAt: iso(T0 - 20 * DAY) },
  { id: 'm5', chat: 'working', from: 'claude', text: 'a month ago', tldr: 'e', created: iso(T0 - 30 * DAY), postedAt: iso(T0 - 30 * DAY) },
];

const CHATS = {
  'fresh-a': { lastSeen: MSGS[0].created },
  'fresh-b': { lastSeen: MSGS[1].created },
  'old-read': { lastSeen: MSGS[2].created },
  'old-unread': { lastSeen: MSGS[3].created },
  // ancient last message, but the hook says it is working RIGHT NOW
  'working': { lastSeen: MSGS[4].created, workingAt: iso(T0 - 20000) },
  // in the registry, has never posted anything at all
  'never-spoke': {},
};

// flipped by §7 to serve a feed in which nothing is stale
let freshOnly = false;
// flipped by §9: the same three stale chats behind a list long enough that the
// bar is well below the fold — the only shape in which her bug is visible
let bulk = false;
const BULK = [];
for (let i = 0; i < 40; i++) BULK.push({
  id: 'b' + i, chat: 'bulk-' + i, from: 'claude', text: 'x', tldr: 'x',
  created: iso(T0 - 3600000 - i * 1000), postedAt: iso(T0 - 3600000 - i * 1000),
});

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    let msgs = freshOnly ? MSGS.slice(0, 2) : MSGS;
    let chats = freshOnly ? { 'fresh-a': CHATS['fresh-a'], 'fresh-b': CHATS['fresh-b'] } : CHATS;
    if (bulk) {
      msgs = MSGS.concat(BULK);
      chats = Object.assign({}, CHATS);
      BULK.forEach((m) => { chats[m.chat] = { lastSeen: m.created }; });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1', chats, settings: {}, truncated: [],
      messages: since ? [] : msgs, delta: !!since,
    }));
  }
  if (url.pathname === '/api/gallery/assets/recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ assets: [] }));
  }
  if (url.pathname === '/api/chatfeed/pages-recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ pages: [] }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({}));
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
// the MAIN list only — the folded rows render into their own .clist inside
// .morelist, so a plain '#grid .clist' would count both
const listed = (page) => page.$$eval('#grid > .clist .crow[data-chat]', (ns) => ns.map((n) => n.dataset.chat));
const folded = (page) => page.$$eval('#grid .morelist .crow[data-chat]', (ns) => ns.map((n) => n.dataset.chat));

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage();

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="fresh-a"]');
  await page.evaluate(() => window.__setTint && window.__setTint(true));

  // 1 + 5 + 6. only the recently-touched chats are on the main list
  let rows = await listed(page);
  const want = ['fresh-a', 'fresh-b', 'working'];
  for (const n of want) if (rows.indexOf(n) < 0) fail(n + ' should be on the main list, got: ' + rows.join(','));
  for (const n of ['old-read', 'old-unread', 'never-spoke'])
    if (rows.indexOf(n) >= 0) fail(n + ' should have folded into More, got: ' + rows.join(','));

  // 4 + 2. the fold starts CLOSED and the bar counts what is behind it
  if (await page.$('#grid .morelist')) fail('the More fold was open on load');
  let bar = await page.$('.morebar');
  if (!bar) return void fail('no More bar drawn at all'), browser.close(), server.close();
  let txt = await page.$eval('.morebar .mb-n', (n) => n.textContent.replace(/\s+/g, ' ').trim());
  if (!/^More 3\b/.test(txt)) fail('More bar count is wrong: ' + txt);
  // both old chats are unread (nothing has been opened in this session)
  if (!/2 new/.test(txt)) fail('More bar did not name the unread behind it: ' + txt);

  // 2. it sits UNDERNEATH the chats — her exact ask
  const order = await page.evaluate(() => {
    const kids = Array.from(document.getElementById('grid').children);
    return { bar: kids.findIndex(k => k.classList.contains('morebar')),
             list: kids.findIndex(k => k.classList.contains('clist')) };
  });
  if (order.list < 0 || order.bar < 0) fail('grid is missing the list or the bar');
  if (order.bar < order.list) fail('the More bar was drawn ABOVE the chats');

  // 3. tapping opens the rest underneath, tapping again folds it away
  await page.click('.morebar');
  await page.waitForSelector('#grid .morelist .crow[data-chat="old-read"]', { timeout: 4000 })
    .catch(() => fail('tapping More never showed the folded chats'));
  const inFold = await folded(page);
  for (const n of ['old-read', 'old-unread', 'never-spoke'])
    if (inFold.indexOf(n) < 0) fail(n + ' missing from the opened fold: ' + inFold.join(','));
  // the list above it is UNTOUCHED — More continues the list, it is not a
  // place she goes (that is the hidden pile's contract, deliberately not this)
  rows = await listed(page);
  for (const n of want) if (rows.indexOf(n) < 0) fail('opening More hid ' + n + ' from the main list');

  await page.click('.morebar');
  await page.waitForFunction(() => !document.querySelector('#grid .morelist'), null, { timeout: 4000 })
    .catch(() => fail('tapping More again did not fold it away'));

  // 8. the boundary itself, run for real
  const edges = await page.evaluate((t0) => {
    const D = 86400000;
    const at = (ms) => ({ from: 'claude', created: new Date(ms).toISOString(), postedAt: new Date(ms).toISOString() });
    return {
      sixDays: window.__chatStale('fresh-a', at(t0 - 6 * D)),
      eightDays: window.__chatStale('fresh-a', at(t0 - 8 * D)),
      none: window.__chatStale('fresh-a', null),
      junk: window.__chatStale('fresh-a', { from: 'claude', created: 'not a date' }),
    };
  }, T0);
  if (edges.sixDays) fail('a chat touched six days ago was called stale');
  if (!edges.eightDays) fail('a chat untouched for eight days was not called stale');
  if (!edges.none) fail('a chat with no messages was not called stale');
  if (!edges.junk) fail('an unparseable timestamp was not treated as untouched');

  // 7. nothing stale → no bar at all (there is nothing to explain, and an
  //    empty "More 0" row would spend a line of her screen saying nothing).
  //    A FRESH CONTEXT, because the page caches the feed in localStorage and
  //    the delta poll would never take the stale chats back out.
  freshOnly = true;
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(base + '/chats');
  await p2.waitForSelector('#grid [data-chat="fresh-a"]');
  if (await p2.$('.morebar')) fail('a More bar was drawn with nothing stale behind it');
  const freshRows = await listed(p2);
  if (freshRows.indexOf('fresh-b') < 0) fail('the all-fresh list lost a chat: ' + freshRows.join(','));
  await ctx2.close();

  // 9. IT LEAVES HER WHERE SHE IS. renderHome() empties #grid and rebuilds it,
  //    so before repaintKeepingBar the page height collapsed mid-repaint and the
  //    browser clamped her scroll to 0 — with the bar at the bottom of a long
  //    list, the whole list scrolled away under her thumb. Measured on a phone
  //    viewport with 40 extra chats above the bar; a short list cannot show it.
  freshOnly = false; bulk = true;
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 640 } });
  const p3 = await ctx3.newPage();
  await p3.goto(base + '/chats');
  await p3.waitForSelector('.morebar');
  // down to the bar, the way she gets there
  await p3.$eval('.morebar', (n) => n.scrollIntoView({ block: 'center' }));
  await p3.waitForTimeout(120);
  const before = await p3.evaluate(() => ({
    y: window.scrollY, top: document.querySelector('.morebar').getBoundingClientRect().top,
  }));
  if (before.y < 100) fail('§9 fixture is not tall enough to test the scroll (y=' + before.y + ')');
  await p3.click('.morebar');
  await p3.waitForSelector('#grid .morelist .crow[data-chat="old-read"]', { timeout: 4000 })
    .catch(() => fail('§9 tapping More never opened the fold'));
  await p3.waitForTimeout(120);
  const after = await p3.evaluate(() => ({
    y: window.scrollY, top: document.querySelector('.morebar').getBoundingClientRect().top,
  }));
  if (after.y < before.y - 4)
    fail('opening More scrolled the page back up: ' + before.y + ' → ' + after.y);
  if (Math.abs(after.top - before.top) > 4)
    fail('the More bar moved on screen when it opened: ' + before.top + ' → ' + after.top);
  // and folding it away again leaves the bar where it is too
  await p3.click('.morebar');
  await p3.waitForFunction(() => !document.querySelector('#grid .morelist'), null, { timeout: 4000 })
    .catch(() => fail('§9 tapping More again did not fold it away'));
  await p3.waitForTimeout(120);
  const shut = await p3.evaluate(() => ({
    y: window.scrollY, top: document.querySelector('.morebar').getBoundingClientRect().top,
  }));
  // closing shortens the page, so the browser may clamp the scroll — the bar
  // must still be on screen, never jumped to the top of the list
  if (shut.y === 0 && before.y > 0) fail('closing More threw her back to the top');
  if (shut.top < 0 || shut.top > 640) fail('the More bar left the screen when it closed: ' + shut.top);
  await ctx3.close();

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('OK: More fold — 7-day split, count, order, open/close, working exempt, scroll held');
})();
