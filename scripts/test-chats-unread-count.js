#!/usr/bin/env node
// HOW MANY CHATS HAVE ANSWERED HER — the number on the row that is actually on
// screen (2026-09-15, Sophie: "add number new chats unread").
//
// The badge itself is old: the ACCOUNT tabs have carried "N answered you" since
// Aug 2026. What broke is which row is on screen — `rowMode` defaults to the
// THREE LISTS, and on 2026-09-15 the account row stopped being shown or applied
// at all on the default screen, which took the only count of unread chats off
// it. So the lists row carries it now, per pile.
//
// Drives the REAL public/chats.html against a stub API. Every assertion is a
// MEASUREMENT read off the rendered row, because a count computed correctly and
// painted nowhere, a count painted on a tab that is hidden, and a count that is
// simply wrong all look identical in the source.
//
//   1. the ALL tab says how many live chats answered her and are unopened,
//   2. a chat SHE has opened is not in it, and neither is one whose last
//      message is her own,
//   3. an ARCHIVED and a DELETED chat never count — those are their own rooms,
//   4. a BUG-FIX chat counts on BUG FIXES and NOT on ALL, which is the ALL
//      branch's own carve-out — so one reply is counted once, on the tab that
//      would actually show it,
//   5. MY TRAY counts today's tray,
//   6. DELIVERED never carries one — its rows are films and pictures,
//   7. opening a chat drops the number by one, and the last one takes the
//      badge away rather than leaving a 0,
//   8. no tab's word wraps and the row does not get taller at 375/390/430 —
//      a badge that makes this hairline row two lines tall is the failure
//      that was measured while building it.
//
//   npm install playwright-core --no-save && node scripts/test-chats-unread-count.js
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }

const PUB = path.join(__dirname, '..', 'public');
const dayCut = require('../day-cut');   // the 5am Pacific cut, so the tray fixture lands on TODAY
const T0 = Date.now();
const HOUR = 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();
const TODAY = dayCut.today(iso(T0));

// m<N> is chat<N>'s only message. `mine` answers last HERSELF; `read` is
// answered but already opened (seeded into localStorage below).
const MSGS = [
  { id: 'm1', chat: 'one',   from: 'claude', text: 'answered you',   tldr: 'one',   created: iso(T0 - 1 * HOUR), postedAt: iso(T0 - 1 * HOUR) },
  { id: 'm2', chat: 'two',   from: 'claude', text: 'answered you',   tldr: 'two',   created: iso(T0 - 2 * HOUR), postedAt: iso(T0 - 2 * HOUR) },
  { id: 'm3', chat: 'three', from: 'claude', text: 'answered you',   tldr: 'three', created: iso(T0 - 3 * HOUR), postedAt: iso(T0 - 3 * HOUR) },
  { id: 'm4', chat: 'read',  from: 'claude', text: 'already opened', tldr: 'read',  created: iso(T0 - 4 * HOUR), postedAt: iso(T0 - 4 * HOUR) },
  { id: 'm5', chat: 'mine',  from: 'sophie', text: 'my own word',    tldr: 'mine',  created: iso(T0 - 5 * HOUR), postedAt: iso(T0 - 5 * HOUR) },
  { id: 'm6', chat: 'gone',  from: 'claude', text: 'archived',       tldr: 'gone',  created: iso(T0 - 6 * HOUR), postedAt: iso(T0 - 6 * HOUR) },
  { id: 'm7', chat: 'binned', from: 'claude', text: 'deleted',       tldr: 'binned', created: iso(T0 - 7 * HOUR), postedAt: iso(T0 - 7 * HOUR) },
  { id: 'm8', chat: 'bug1',  from: 'claude', text: 'fixed a thing',  tldr: 'bug1',  created: iso(T0 - 8 * HOUR), postedAt: iso(T0 - 8 * HOUR) },
  { id: 'm9', chat: 'bug2',  from: 'claude', text: 'fixed another',  tldr: 'bug2',  created: iso(T0 - 9 * HOUR), postedAt: iso(T0 - 9 * HOUR) },
  { id: 'm10', chat: 'tray1', from: 'claude', text: 'on her tray',   tldr: 'tray1', created: iso(T0 - 10 * HOUR), postedAt: iso(T0 - 10 * HOUR) },
];
const CHATS = {
  one:    { lastSeen: MSGS[0].created },
  two:    { lastSeen: MSGS[1].created },
  three:  { lastSeen: MSGS[2].created },
  read:   { lastSeen: MSGS[3].created },
  mine:   { lastSeen: MSGS[4].created },
  gone:   { lastSeen: MSGS[5].created, archived: true },
  binned: { lastSeen: MSGS[6].created, deletedAt: iso(T0 - 7 * HOUR) },
  bug1:   { lastSeen: MSGS[7].created, labels: ['bug fix'] },
  bug2:   { lastSeen: MSGS[8].created, labels: ['bug fix'] },
  // On today's tray AND on ALL — the tray is a subset, so both tabs may light.
  tray1:  { lastSeen: MSGS[9].created, trayDays: { [TODAY]: iso(T0 - 60 * 1000) } },
};
// So ALL = one, two, three, tray1 (read is opened, mine answered herself,
// gone/binned are away, bug1/bug2 are the bug tab's) = 4.
// BUG FIXES = 2. MY TRAY = 1.

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'test', truncated: [], messages: MSGS, delta: false,
      settings: { categories: ['bug fix'], pileLabels: [] }, chats: CHATS }));
  }
  if (url.pathname === '/api/deliverables/feed') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, items: [] }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  const f = path.join(PUB, url.pathname.replace(/^\//, ''));
  if (fs.existsSync(f) && fs.statSync(f).isFile()) {
    res.writeHead(200, { 'Content-Type': /\.css$/.test(f) ? 'text/css' : 'application/javascript' });
    return res.end(fs.readFileSync(f));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}');
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
let checks = 0;
const ok = () => { checks++; };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const pre = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(pre ? { executablePath: pre } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // `read` is opened already — the same shape markSeen() writes.
  await page.goto(base + '/chats');
  await page.evaluate((v) => localStorage.setItem('chats-seen-v1', JSON.stringify({ read: v })), MSGS[3].created);
  await page.goto(base + '/chats');
  await page.waitForSelector('#grid .crow');
  await page.waitForTimeout(250);

  // The badge as she would read it: the tab's word, and the number on it.
  const badges = () => page.$$eval('#listrow .acctab', (bs) => {
    const o = {};
    bs.forEach((b) => {
      const n = b.querySelector('.cc-new');
      o[b.dataset.list] = n ? n.textContent.trim() : null;
    });
    return o;
  });

  let b = await badges();

  // ── 1/2/3/4. the counts ───────────────────────────────────────────────────
  if (b.all !== '4') fail('ALL says ' + b.all + ', expected 4 (one, two, three, tray1)');
  else ok();
  if (b.bugs !== '2') fail('BUG FIXES says ' + b.bugs + ', expected 2');
  else ok();
  if (b.tray !== '1') fail('MY TRAY says ' + b.tray + ', expected 1');
  else ok();
  // ── 6. DELIVERED holds films and pictures, never chats ────────────────────
  if (b.delivered !== null) fail('DELIVERED carries a badge (' + b.delivered + ') — its rows are not chats');
  else ok();

  // The number is the one the LIST really shows: count the rows on ALL that
  // wear the unread dot, and the two must agree. A badge that disagrees with
  // the list under it is the bug this whole file is about, one screen down.
  const dots = await page.$$eval('#grid .crow', (rows) => rows.filter((r) => r.querySelector('.cr-dot')).length);
  if (String(dots) !== b.all) fail('ALL says ' + b.all + ' but ' + dots + ' rows wear the unread dot');
  else ok();

  // ── 7. opening a chat drops it ────────────────────────────────────────────
  await page.click('#grid .crow[data-chat="one"]');
  await page.waitForTimeout(250);
  await page.click('#back').catch(() => {});
  await page.waitForTimeout(300);
  b = await badges();
  if (b.all !== '3') fail('after opening one chat ALL says ' + b.all + ', expected 3');
  else ok();

  // …and the bug pile empties to NO badge rather than a 0.
  await page.evaluate((seen) => {
    localStorage.setItem('chats-seen-v1', JSON.stringify(seen));
  }, { read: MSGS[3].created, one: MSGS[0].created, bug1: MSGS[7].created, bug2: MSGS[8].created });
  await page.goto(base + '/chats');
  await page.waitForSelector('#grid .crow');
  await page.waitForTimeout(250);
  b = await badges();
  if (b.bugs !== null) fail('an empty bug pile still shows a badge: ' + b.bugs);
  else ok();
  if (b.all !== '3') fail('ALL says ' + b.all + ' after the bug chats were read, expected 3');
  else ok();

  // ── 8. the row stays ONE line, at every width she uses ────────────────────
  // MEASURED both ways while building this: the account row's 15px badge plus
  // its 5px gap wants 80.5px where a 390pt tab has 79.8px, which wrapped
  // "BUG FIXES" and made this hairline row 11px taller. A width assertion
  // cannot see a wrap — the range goes around the label's own TEXT NODE.
  await page.evaluate(() => localStorage.removeItem('chats-seen-v1'));
  await page.goto(base + '/chats');
  await page.waitForSelector('#listrow .acctab');
  await page.waitForTimeout(250);
  for (const w of [375, 390, 430]) {
    await page.setViewportSize({ width: w, height: 844 });
    await page.waitForTimeout(150);
    const wrapped = await page.$$eval('#listrow .acctab', (bs) => bs.filter((x) => {
      const t = Array.prototype.find.call(x.childNodes, (n) => n.nodeType === 3);
      if (!t) return false;
      const r = document.createRange(); r.selectNodeContents(t);
      return r.getClientRects().length > 1;
    }).map((x) => (x.dataset.label || x.textContent).trim()));
    if (wrapped.length) fail('a tab word wraps at ' + w + 'pt with a badge on it: ' + wrapped.join(', '));
    else ok();
    const h = await page.$eval('#listrow', (e) => e.getBoundingClientRect().height);
    if (h > 34) fail('the lists row is ' + h.toFixed(1) + 'px tall at ' + w + 'pt — a badge must not make it two lines');
    else ok();
    // …and no two tabs' contents overlap: nowrap means a tab can overflow its
    // own box instead of wrapping, and at 320 that really did put BUG FIXES on
    // top of DELIVERED (PHOTOgraphed) — which is why the narrow phone gets a
    // dot instead of digits.
    const rects = await page.$$eval('#listrow .acctab', (bs) => bs.map((x) => {
      const r = document.createRange(); r.selectNodeContents(x);
      const q = r.getBoundingClientRect();
      return [q.left, q.right];
    }));
    const clash = rects.some((r, i) => i > 0 && r[0] < rects[i - 1][1] + 1);
    if (clash) fail('two tabs overlap at ' + w + 'pt: ' + JSON.stringify(rects.map((r) => r.map((n) => +n.toFixed(1)))));
    else ok();
  }

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('OK — ' + checks + ' checks');
})();
