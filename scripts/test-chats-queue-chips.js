#!/usr/bin/env node
// ALL THREE UPDATE BOXES GET A CHIP (Aug 2026, Sophie, pointing at the labels
// row: "'maybe never' isn't on the tag list in the account area" → "give them
// both a chip").
//
// Only `later` had ever been joined to a word on that row, because only
// `later` already HAD one — she had been filing chats into a "come back to"
// folder by hand long before the Update screen existed. `in a minute` and
// `maybe never` were invented as boxes and never got a chip, so a card she put
// in one was reachable from exactly one screen.
//
// Drives the REAL public/chats.html headless against a stub API and asserts:
//   1. all three words are on the row, in NEWS_QS's order, each badged with
//      what is actually sitting in its box,
//   2. tapping one shows exactly that box's chats,
//   3. they are TASK words — on the row as soon as TAGS opens, not buried
//      behind SEE MORE with the topic tags,
//   4. a word with an EMPTY box is not on the row at all: these two are not in
//      her folder vocabulary and must not squat there when unused (`come back
//      to` is hers and stays, which is the difference),
//   5. a chat deferred into any box STILL SHOWS on the main list — deferring
//      one update is not filing the whole chat away,
//   6. nothing leaked between the three boxes or into another folder.
//
//   npm install playwright-core --no-save && node scripts/test-chats-queue-chips.js
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
const H = 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();

const MSGS = ['later1', 'later2', 'soon1', 'never1', 'plain'].map((c, i) => ({
  id: 'm' + i, chat: c, from: 'claude', text: c, tldr: c,
  created: iso(T0 - (5 - i) * H), postedAt: iso(T0 - (5 - i) * H),
}));

// `full` has all three boxes occupied; `sparse` has only `later`, which is how
// assertion 4 measures that an empty box leaves the row rather than sitting
// there as a chip that finds nothing.
const SETS = {
  full: {
    later1: { newsQueue: 'later', newsQueuedAt: iso(T0 - 2 * H) },
    later2: { newsQueue: 'later', newsQueuedAt: iso(T0 - 2 * H) },
    soon1: { newsQueue: 'soon', newsQueuedAt: iso(T0 - 2 * H) },
    never1: { newsQueue: 'never', newsQueuedAt: iso(T0 - 2 * H) },
    plain: {},
  },
  sparse: {
    later1: { newsQueue: 'later', newsQueuedAt: iso(T0 - 2 * H) },
    later2: {}, soon1: {}, never1: {}, plain: {},
  },
};
let set = 'full';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-' + set,
      chats: SETS[set],
      settings: { categories: ['stories'] }, truncated: [],
      messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  // Real assets out of public/ — the page loads /asset-lightbox.js, and
  // answering that with the JSON fallthrough hands the browser an object as a
  // SCRIPT, which kills the page before any assertion runs.
  const asset = path.join(PUB, url.pathname.replace(/^\/+/, ''));
  if (/\.(js|css|svg|png|webp)$/.test(url.pathname) && asset.startsWith(PUB) && fs.existsSync(asset)) {
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return res.end(fs.readFileSync(asset));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({}));
});

let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; process.exitCode = 1; };
const listed = (page) => page.$$eval('#grid > .clist .crow[data-chat]', (ns) => ns.map((n) => n.dataset.chat).sort());
const chipWords = (page) => page.$$eval('#catrow .catchip',
  (ns) => ns.filter((n) => !n.classList.contains('starchip'))
    .map((n) => (n.firstChild && n.firstChild.textContent || '').trim()).filter(Boolean));
const chipText = (page, label) => page.$$eval('#catrow .catchip',
  (ns, l) => (ns.find((n) => n.firstChild && n.firstChild.textContent.trim() === l) || {}).textContent || '', label);
const clickChip = (page, label) => page.$$eval('#catrow .catchip',
  (ns, l) => { const b = ns.find((n) => n.firstChild && n.firstChild.textContent.trim() === l); if (b) b.click(); }, label);
const openTags = async (page) => {
  await page.waitForSelector('#catrow .tagsbtn');
  if (!(await page.$('#catrow .tagsbtn.on'))) await page.click('#catrow .tagsbtn');
};

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => fail('the page threw: ' + e.message));

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="plain"]');

  // ---- 5. deferring is not filing --------------------------------------
  const rows = await listed(page);
  ['later1', 'soon1', 'never1'].forEach((c) => {
    if (rows.indexOf(c) < 0) fail(c + ' fell off the main list just for being in a box: ' + rows.join(','));
  });

  // ---- 1 + 3. all three words, in her order, on the TASK row ------------
  await openTags(page);
  const words = await chipWords(page);
  const want = ['Come back to', 'In a minute', 'Maybe never'];
  want.forEach((w) => { if (words.indexOf(w) < 0) fail('no ' + w + ' chip on the row: ' + words.join(' | ')); });
  const at = want.map((w) => words.indexOf(w));
  if (!(at[0] < at[1] && at[1] < at[2])) {
    fail('the three boxes are not in NEWS_QS order on the row: ' + words.join(' | '));
  }
  // They must be on the row BEFORE See more — task words, not topic tags.
  if (await page.$('#catrow .morechip')) {
    const more = await page.$$eval('#catrow .catchip', (ns) => {
      const i = ns.findIndex((n) => n.classList.contains('morechip'));
      return ns.slice(i).map((n) => (n.firstChild && n.firstChild.textContent || '').trim());
    });
    want.forEach((w) => { if (more.indexOf(w) > -1) fail(w + ' is buried behind See more'); });
  }

  // ---- 1 (counts) + 2. each chip finds exactly its own box --------------
  const expect = { 'Come back to': ['later1', 'later2'], 'In a minute': ['soon1'], 'Maybe never': ['never1'] };
  for (const [label, chats] of Object.entries(expect)) {
    const t = (await chipText(page, label)).replace(/\s+/g, '');
    if (!new RegExp(String(chats.length) + '$').test(t)) {
      fail(label + ' badged the wrong number (want ' + chats.length + '): "' + t + '"');
    }
    await clickChip(page, label);
    const pile = await listed(page);
    if (JSON.stringify(pile) !== JSON.stringify(chats.slice().sort())) {
      fail(label + ' showed ' + pile.join(',') + ' — wanted ' + chats.join(','));   // 6, spelled out
    }
    await clickChip(page, label);
  }

  // ---- 6. and nothing reached an unrelated folder -----------------------
  if (await page.$('#catrow .morechip')) await page.click('#catrow .morechip');
  await clickChip(page, 'Stories');
  if (await page.$('#grid > .clist')) fail('Stories picked up a chat from one of the boxes');
  await clickChip(page, 'Stories');

  // ---- 4. an empty box takes its word back off the row ------------------
  set = 'sparse';
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="plain"]');
  await openTags(page);
  const left = await chipWords(page);
  if (left.indexOf('Come back to') < 0) fail('Come back to left the row while its box still had something in it');
  ['In a minute', 'Maybe never'].forEach((w) => {
    if (left.indexOf(w) > -1) fail(w + ' is still on the row with an empty box: ' + left.join(' | '));
  });

  await browser.close();
  server.close();
  if (!failed) console.log('PASS: all three Update boxes have a chip, badged and filtered, and an empty one leaves the row');
})().catch((e) => { console.error('FAIL: ' + e.message); process.exit(1); });
