#!/usr/bin/env node
// THE DRIBBLE FOLD (2026-09-02, Sophie, looking at four CLAUDE rows in ten
// minutes: "why do these all show as separate messages"). They are separate
// TURNS — a chat that backgrounded a deploy watcher and subscribed to its own
// PR wakes once per event, and the hook posts one message per turn. The data
// stays as it is (a doc is keyed by session+turn; a silent turn reads as a
// dead hook); the THREAD folds a run of replies with nothing from her between
// them behind "N earlier replies", the house underlined opener.
//
// Every assertion here is a MEASUREMENT (offsetParent), because a row hidden
// by class and a row that was never rendered look the same to a DOM count —
// and the fold's whole job is to hide rows that must still be there.
//
//   npm install playwright-core --no-save && node scripts/test-chats-dribble-fold.js
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
const M = 60 * 1000, H = 60 * M;
const c = (id, at, extra) => Object.assign({ id, chat: 'watcher', from: 'claude', text: 'reply ' + id + ' body', tldr: 'reply ' + id, created: iso(at), postedAt: iso(at) }, extra || {});
// Newest first, as the thread draws them:
//   m4 leads m3 m2 m1 (3-4 min apart)       → one fold of three
//   s1 is hers                                → visible, ends the run
//   m0 is alone (z is five hours older)       → visible, no fold
//   z  leads nothing: bk is bookmarked        → both visible
//   y  after bk, alone                        → visible
//   w  is a live draft over v (2 min)         → both visible: a draft folds nothing
const MSGS = [
  c('m4', T0), c('m3', T0 - 4 * M), c('m2', T0 - 7 * M), c('m1', T0 - 10 * M),
  { id: 's1', chat: 'watcher', from: 'sophie', text: 'ok', created: iso(T0 - 30 * M), postedAt: iso(T0 - 30 * M) },
  c('m0', T0 - 40 * M),
  c('z', T0 - 5 * H), c('bk', T0 - 5 * H - 2 * M, { bookmarked: true }), c('y', T0 - 5 * H - 3 * M),
];
// the draft case lives in its own chat so it sits at the top of a thread
const DRAFT = [c('w', T0, { chat: 'writing', working: true }), c('v', T0 - 2 * M, { chat: 'writing' })];
const ALL = MSGS.concat(DRAFT);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'b1', chats: { watcher: { account: '1' }, writing: { account: '1' } }, settings: {}, truncated: [], messages: since ? [] : ALL, delta: !!since }));
  }
  if (url.pathname === '/api/chatfeed/thread') {
    const chat = url.searchParams.get('chat');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ messages: ALL.filter((m) => m.chat === chat) }));
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
  res.end(JSON.stringify({ ok: true, messages: [], todos: [], bookmarks: [], questions: [] }));
});

let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; process.exitCode = 1; };
const ok = (m) => console.log('ok - ' + m);
const shown = (page) => page.evaluate(() =>
  [...document.querySelectorAll('#thread .msg')].filter((r) => r.offsetParent).map((r) => r.dataset.mid));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => fail('page error: ' + e.message));
  await page.goto(base + '/chats?chat=watcher', { waitUntil: 'load' });
  await page.waitForSelector('#thread .msg', { timeout: 6000 });
  await page.waitForTimeout(400);

  // 1. the fold: the three under m4 are hidden, everything else is on screen
  let vis = await shown(page);
  const want = ['m4', 's1', 'm0', 'z', 'bk', 'y'];
  if (same(vis, want)) ok('the run folds to its newest, her message ends it, a five-hour gap and a bookmark never fold');
  else fail('visible rows ' + JSON.stringify(vis) + ', wanted ' + JSON.stringify(want));
  const total = await page.$$eval('#thread .msg', (ns) => ns.length);
  if (total === 9) ok('all nine docs are still in the DOM — a fold hides, it never drops');
  else fail('expected 9 rows in the DOM, found ' + total);

  // 2. the opener: one, right under m4, saying how many, the house underline
  const opener = await page.evaluate(() => {
    const bs = [...document.querySelectorAll('#thread .foldmore')].filter((b) => b.offsetParent);
    if (bs.length !== 1) return { n: bs.length };
    const b = bs[0], cs = getComputedStyle(b);
    const lead = document.querySelector('#thread .msg[data-mid="m4"]');
    return { n: 1, text: b.textContent, under: b.closest('.foldrow').previousElementSibling === lead,
      underline: cs.textDecorationLine.includes('underline'), border: cs.borderStyle, bg: cs.backgroundColor };
  });
  if (opener.n === 1 && opener.text === '3 earlier replies' && opener.under) ok('one opener, "3 earlier replies", directly under the newest');
  else fail('opener wrong: ' + JSON.stringify(opener));
  if (opener.underline && opener.border === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(opener.bg)) ok('the opener is the underlined word, not a button');
  else fail('opener paint: ' + JSON.stringify(opener));

  // 3. tap opens, tap closes
  await page.click('#thread .foldmore');
  vis = await shown(page);
  if (same(vis, ['m4', 'm3', 'm2', 'm1', 's1', 'm0', 'z', 'bk', 'y'])) ok('tapping the opener shows the three, in order');
  else fail('after open: ' + JSON.stringify(vis));
  const lab = await page.$eval('#thread .foldmore', (b) => b.textContent);
  if (lab === 'hide the earlier replies') ok('the open opener says how to put them back'); else fail('open label: ' + lab);
  await page.click('#thread .foldmore');
  if (same(await shown(page), want)) ok('tapping again folds them back'); else fail('did not refold');

  // 4. a search lifts the fold: a hit inside it must show, and clearing refolds
  await page.click('.threadsearch');            // the box is folded until the glass is tapped
  await page.waitForSelector('.msgsearch.open input');
  await page.fill('.msgsearch input', 'm2');
  await page.waitForTimeout(500);
  vis = await shown(page);
  const openerHidden = await page.evaluate(() => ![...document.querySelectorAll('#thread .foldmore')].some((b) => b.offsetParent));
  if (same(vis, ['m2']) && openerHidden) ok('a search finds the folded reply and hides the opener');
  else fail('search: visible ' + JSON.stringify(vis) + ', opener hidden ' + openerHidden);
  await page.fill('.msgsearch input', '');
  await page.waitForTimeout(500);
  if (same(await shown(page), want)) ok('clearing the search puts the fold back'); else fail('clear did not refold: ' + JSON.stringify(await shown(page)));

  // 5. a jump into a folded row opens its fold (a search hit / the keep-pile)
  await page.goto(base + '/chats?chat=watcher&msg=m1', { waitUntil: 'load' }).catch(() => {});
  await page.waitForSelector('#thread .msg', { timeout: 6000 });
  await page.waitForTimeout(400);
  // the url form may not be a door; drive focusMessage's contract directly
  // through the row hook it relies on
  const jumped = await page.evaluate(() => {
    const row = document.querySelector('#thread .msg[data-mid="m1"]');
    if (!row || !row._fold) return { hooked: false };
    row._fold.show();
    return { hooked: true, shown: !!row.offsetParent };
  });
  if (jumped.hooked && jumped.shown) ok('a folded row carries its fold, and showing it puts the row on screen');
  else fail('jump hook: ' + JSON.stringify(jumped));

  // 6. a live draft folds nothing — the reply under it stays
  await page.goto(base + '/chats?chat=writing', { waitUntil: 'load' });
  await page.waitForSelector('#thread .msg', { timeout: 6000 });
  await page.waitForTimeout(400);
  vis = await shown(page);
  const noOpener = await page.evaluate(() => !document.querySelector('#thread .foldmore'));
  if (same(vis, ['w', 'v']) && noOpener) ok('a still-writing draft folds nothing under it');
  else fail('draft: visible ' + JSON.stringify(vis) + ', no opener ' + noOpener);

  await browser.close();
  server.close();
  console.log(failed ? failed + ' FAILED' : 'all good');
})().catch((e) => { console.error(e); process.exit(1); });
