#!/usr/bin/env node
// ON MY TRAY (2026-08-31, Sophie: "add a tab in chats called 'on my tray'
// where i can pin chats by their icons for what im working on rn — ex xi to do
// · review cards illustrations ideas · triset · review cards").
//
// Drives the REAL public/chats.html against a stub API and asserts:
//   1. the tab is in the lists row, named in her words, LEADING it,
//   2. …and no tab word wraps — a fourth tab narrows every one of them, and a
//      wrapped label makes that row 10px taller than its neighbours' one line,
//   3. the tray draws the chats she marked and ONLY those, as ICONS, four
//      across (MEASURED off the real cells — a wrong `--cols`-style rule and a
//      wrong `repeat()` both render a plausible grid),
//   4. IT DOES NOT RESHUFFLE: the order is `trayAt`, oldest first, NOT the
//      newest-message sort every other pile uses. The fixture's first-added
//      chat carries the OLDEST message, so a recency sort puts it last,
//   5. an ARCHIVED tray chat is not on it (she put it away), nor a deleted one,
//   6. it IGNORES the account filter — the account row is not even on screen
//      here, so a hand-picked chat vanishing would be a filter she cannot see,
//   7. the Organize sheet's tray mark POSTs {tray:true} and the chat lands on
//      the tray — AT THE END, not the front (the optimistic `trayAt` stamp),
//   8. the tile's own lit mark POSTs {tray:false} and the tile goes,
//   9. …and that tap does not also open the chat (a control inside a button),
//  10. an empty tray names the way in rather than being a screen she can only
//      leave,
//  11. the choice is sticky across a reload,
//  12. a lit category chip leaves the tray, the way it leaves the bug pile,
//  13. nothing on the tray's first row is under the autoscroll pill's corner.
//
//   npm install playwright-core --no-save && node scripts/test-chats-tray.js
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }

const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const HOUR = 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();

// The three she named, plus the ones that must NOT show.
const MSGS = [
  // `triset` was put on the tray FIRST and its last message is the OLDEST, so
  // it leads the tray and would come LAST under the house recency sort. That
  // inversion is the whole of assertion 4.
  { id: 'm1', chat: 'triset', from: 'claude', text: 'the venn centre',  tldr: 'triset',  created: iso(T0 - 9 * HOUR), postedAt: iso(T0 - 9 * HOUR) },
  { id: 'm2', chat: 'xitodo', from: 'claude', text: 'review cards',     tldr: 'xi',      created: iso(T0 - 5 * HOUR), postedAt: iso(T0 - 5 * HOUR) },
  { id: 'm3', chat: 'cards',  from: 'claude', text: 'illustrations',    tldr: 'cards',   created: iso(T0 - HOUR),     postedAt: iso(T0 - HOUR) },
  { id: 'm4', chat: 'other',  from: 'claude', text: 'not on the tray',  tldr: 'other',   created: iso(T0 - 2 * HOUR), postedAt: iso(T0 - 2 * HOUR) },
  { id: 'm5', chat: 'shelved', from: 'claude', text: 'archived',        tldr: 'shelved', created: iso(T0 - 3 * HOUR), postedAt: iso(T0 - 3 * HOUR) },
  { id: 'm6', chat: 'binned', from: 'claude', text: 'deleted',          tldr: 'binned',  created: iso(T0 - 4 * HOUR), postedAt: iso(T0 - 4 * HOUR) },
  { id: 'm7', chat: 'acct2',  from: 'claude', text: 'other account',    tldr: 'acct2',   created: iso(T0 - 6 * HOUR), postedAt: iso(T0 - 6 * HOUR) },
];

const CHATS = {
  triset:  { lastSeen: MSGS[0].created, tray: true, trayAt: iso(T0 - 50 * HOUR) },
  xitodo:  { lastSeen: MSGS[1].created, tray: true, trayAt: iso(T0 - 40 * HOUR), displayName: 'Xi to do' },
  cards:   { lastSeen: MSGS[2].created, tray: true, trayAt: iso(T0 - 30 * HOUR), displayName: 'Review cards' },
  // on the tray, on the OTHER account — must still show (assertion 6)
  acct2:   { lastSeen: MSGS[6].created, tray: true, trayAt: iso(T0 - 20 * HOUR), account: '2' },
  other:   { lastSeen: MSGS[3].created },
  shelved: { lastSeen: MSGS[4].created, tray: true, trayAt: iso(T0 - 45 * HOUR), archived: true },
  binned:  { lastSeen: MSGS[5].created, tray: true, trayAt: iso(T0 - 44 * HOUR), deletedAt: iso(T0 - 44 * HOUR) },
};

const posted = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'test', truncated: [], messages: MSGS, delta: false,
      settings: { categories: ['witch'], pileLabels: [] }, chats: CHATS }));
  }
  if (url.pathname === '/api/chatfeed/tray' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      let j = {}; try { j = JSON.parse(body); } catch (e) {}
      posted.push(j);
      // The stub KEEPS the write, the way the real route does — otherwise a
      // reload would silently undo everything this test just did.
      const on = j.tray !== false;
      const at = on ? ((CHATS[j.chat] && CHATS[j.chat].trayAt) || new Date().toISOString()) : null;
      CHATS[j.chat] = CHATS[j.chat] || {};
      if (on) { CHATS[j.chat].tray = true; CHATS[j.chat].trayAt = at; }
      else { delete CHATS[j.chat].tray; delete CHATS[j.chat].trayAt; }
      // ANSWERED SLOWLY ON PURPOSE (600ms — a phone on cell). Without the
      // delay the server's `trayAt` is already in hand by the time she walks
      // to the tray, and the OPTIMISTIC order — the thing assertion 7 is
      // about — is never the thing on screen, so the test would pass against
      // a page that stamps nothing.
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        // The real route stamps the moment it lands — NOW, i.e. after every
        // fixture stamp, which is what puts a fresh add at the END of the tray.
        res.end(JSON.stringify({ ok: true, chat: j.chat, tray: on, trayAt: at }));
      }, 600);
    });
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
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
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

  const openTray = async () => {
    await page.click('#listrow .acctab[data-list="tray"]');
    await page.waitForTimeout(180);
  };
  const trayOrder = () => page.$$eval('#traygrid .traytile', (n) => n.map((x) => x.dataset.chat));

  await page.goto(base + '/chats');
  await page.waitForSelector('#listrow .acctab[data-list="tray"]');

  // ── 1. the tab, in her words, leading the row ─────────────────────────────
  const tabs = await page.$$eval('#listrow .acctab', (b) => b.map((x) => x.textContent.trim()));
  if (tabs[0] !== 'My tray') fail('the tray tab does not lead the row — ' + tabs.join('|'));
  else ok();
  if (tabs.length !== 4) fail('the lists row has ' + tabs.length + ' tabs, expected 4');
  else ok();

  // ── 2. no tab word wraps, at 390 AND at 320 ───────────────────────────────
  // A Range around the label's own text is the only honest question: a width
  // assertion cannot see a wrap, and a wrapped label makes the row taller than
  // every other hairline row in the app.
  for (const w of [390, 320]) {
    await page.setViewportSize({ width: w, height: 844 });
    await page.waitForTimeout(120);
    const wrapped = await page.$$eval('#listrow .acctab', (btns) => btns.filter((b) => {
      const r = document.createRange(); r.selectNodeContents(b);
      return r.getClientRects().length > 1;
    }).map((b) => b.textContent.trim()));
    if (wrapped.length) fail('a tab label wraps at ' + w + 'pt: ' + wrapped.join(', '));
    else ok();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(120);

  // ── 3. only the marked chats, as icons, four across ───────────────────────
  await openTray();
  const names = await trayOrder();
  if (names.indexOf('other') > -1) fail('an unmarked chat is on the tray');
  else ok();
  if (names.length !== 4) fail('the tray holds ' + names.length + ' chats, expected 4 — ' + names.join(','));
  else ok();
  // Every tile really draws its icon (or the blank-letter fallback), and the
  // tray is icons ONLY — no status line, no timestamp.
  const iconed = await page.$$eval('#traygrid .traytile', (n) =>
    n.every((x) => !!x.querySelector('.t-cover img, .t-cover .t-blank')));
  if (!iconed) fail('a tray tile draws no icon — she asked for the icons');
  else ok();
  const extras = await page.$$eval('#traygrid .traytile', (n) =>
    n.some((x) => x.querySelector('.t-meta, .t-tldr, .t-about')));
  if (extras) fail('a tray tile carries a status line or a timestamp — the tray is the icons and the name');
  else ok();
  // FOUR ACROSS, measured off the real cells.
  const perRow = await page.$$eval('#traygrid .traytile', (n) => {
    if (!n.length) return 0;
    const top = Math.round(n[0].getBoundingClientRect().top);
    return n.filter((x) => Math.round(x.getBoundingClientRect().top) === top).length;
  });
  if (perRow !== 4) fail('the tray draws ' + perRow + ' to a row, expected 4');
  else ok();

  // ── 4. the order is hers, not recency ─────────────────────────────────────
  if (names.join(',') !== 'triset,xitodo,cards,acct2')
    fail('the tray is not in trayAt order, oldest first — ' + names.join(','));
  else ok();
  // Named separately, because this is the rule and not a coincidence of the
  // fixture: `triset` has the OLDEST message, so any recency sort sinks it.
  if (names[0] !== 'triset') fail('the tray reshuffled by recency — triset was added first and must lead');
  else ok();

  // ── 5. the archive and the trash stay their own rooms ─────────────────────
  if (names.indexOf('shelved') > -1) fail('an ARCHIVED chat is on the tray');
  else ok();
  if (names.indexOf('binned') > -1) fail('a DELETED chat is on the tray');
  else ok();

  // ── 6. it ignores the account filter ──────────────────────────────────────
  if (names.indexOf('acct2') < 0)
    fail('a tray chat on the other account is missing — the account row is not even on screen here');
  else ok();

  // ── 12. a lit chip leaves the tray (before we start writing) ──────────────
  await page.click('#catrow .tagsbtn');
  await page.waitForTimeout(120);
  const more = await page.$('#catrow .morechip');
  if (more) { await more.click(); await page.waitForTimeout(120); }
  const lit = await page.$$eval('#catrow .catchip', (ns) => {
    const i = ns.findIndex((n) => /witch/i.test(n.textContent));
    if (i > -1) ns[i].click();
    return i > -1;
  });
  if (!lit) fail('no `witch` chip to light');
  else ok();
  await page.waitForTimeout(160);
  const leftTray = await page.$eval('#listrow', (r) => r.getAttribute('data-on'));
  if (leftTray === 'tray') fail('a lit chip left her on the tray, narrowing a hand-picked pile she cannot see the filter on');
  else ok();
  // Back to a clean screen the deterministic way — the tags drawer is open
  // over the row, and untangling it here would be testing the drawer.
  await page.reload();
  await page.waitForTimeout(500);

  // ── 7. the Organize sheet puts a chat ON the tray, at the END ─────────────
  await page.click('#listrow .acctab[data-list="all"]');
  await page.waitForSelector('#grid .crow[data-chat="other"]');
  await page.waitForTimeout(160);
  await page.click('#grid .crow[data-chat="other"]');
  await page.waitForSelector('#thread', { state: 'attached' });
  await page.waitForTimeout(200);
  await page.click('.orgbtn');
  await page.waitForTimeout(220);
  const mark = await page.$('.orgmarks .mk-tray');
  if (!mark) fail('the Organize sheet has no tray mark — that is the way a chat gets on the tray');
  else {
    ok();
    // The mark must sit IN the row, not float out of it: `.orgmarks .markchip`
    // sets the box but declares no `position`, so an unscoped absolute rule on
    // the shared class would lift it out.
    const inRow = await page.$eval('.orgmarks .mk-tray', (b) => {
      const r = b.getBoundingClientRect(), row = b.parentElement.getBoundingClientRect();
      return getComputedStyle(b).position === 'static'
        && r.top >= row.top - 1 && r.bottom <= row.bottom + 1 && r.width > 20;
    });
    if (!inRow) fail('the sheet\'s tray mark is not laid out in the marks row');
    else ok();
    await mark.click();
    await page.waitForTimeout(220);
    // THE LIT TRAY IS NOT FILLED. It shipped filled for one screenshot, like
    // the star and the bookmark beside it, and rendered as a red BLOB — a
    // tray's shape is its opening, so filling the body closes the mouth. `.on`
    // is the red stroke and the red box. Read off the REAL computed style: a
    // class name says nothing about what renders.
    const filled = await page.$$eval('.orgmarks .mk-tray svg path, .orgmarks .mk-tray svg polyline',
      (ns) => ns.some((n) => { const f = getComputedStyle(n).fill; return f && f !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(f); }));
    if (filled) fail('the lit tray glyph is filled — at 17px that closes its mouth and it reads as a blob');
    else ok();
  }
  const add = posted[posted.length - 1];
  if (!add || add.chat !== 'other' || add.tray !== true)
    fail('the sheet did not POST {chat:"other", tray:true} — ' + JSON.stringify(add || null));
  else ok();
  // Leave the thread through the app's own back — NOT a reload. The order the
  // rule is about is the OPTIMISTIC one: a reload would fetch the server's
  // `trayAt` and pass even against a page that stamps nothing.
  await page.click('.askwrap .askbox .go');      // Done — the sheet's own way out
  await page.click('#back');
  await page.click('#listrow .acctab[data-list="tray"]');   // in under the 600ms answer
  const after = await trayOrder();
  if (after.indexOf('other') < 0) fail('the chat she just added is not on the tray');
  else ok();
  if (after[after.length - 1] !== 'other')
    fail('a fresh add did not land at the END of the tray — ' + after.join(',')
      + ' (an unstamped optimistic write sorts under "" and jumps to the front)');
  else ok();

  // …and on the TILE, where the mark is always lit and therefore has only its
  // picture to go on.
  const tileFilled = await page.$$eval('#traygrid .traytile .traybtn svg path, #traygrid .traytile .traybtn svg polyline',
    (ns) => ns.some((n) => { const f = getComputedStyle(n).fill; return f && f !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(f); }));
  if (tileFilled) fail('a tray tile\'s mark is filled — it reads as a blob at 15px');
  else ok();

  // ── 13. nothing on the first tray row is under the pill's corner ──────────
  // The pill is injected in production over x 334-390 / y 14-192.
  const clash = await page.$$eval('#traygrid .traytile', (n) => {
    const top = Math.round(n[0].getBoundingClientRect().top);
    return n.filter((x) => Math.round(x.getBoundingClientRect().top) === top)
      .some((x) => { const r = x.getBoundingClientRect(); return r.right > 334 && r.top < 192; });
  });
  if (clash) fail('a tray tile on the first row sits under the autoscroll pill\'s column');
  else ok();

  // ── 8/9. the tile's own mark takes it off, and does not open the chat ─────
  const before = (await trayOrder()).length;
  await page.click('#traygrid .traytile[data-chat="other"] .traybtn');
  await page.waitForTimeout(250);
  const off = posted[posted.length - 1];
  if (!off || off.chat !== 'other' || off.tray !== false)
    fail('the tile mark did not POST {tray:false} — ' + JSON.stringify(off || null));
  else ok();
  if (await page.$('#traygrid .traytile[data-chat="other"]')) fail('the tile is still on the tray after taking it off');
  else ok();
  if ((await trayOrder()).length !== before - 1) fail('the tray count did not drop by one');
  else ok();
  // `#thread` is a static section of the page and is in the DOM either way, so
  // the honest question is whether she is still LOOKING at the tray.
  const stayed = await page.$eval('#traygrid', (e) => e.getBoundingClientRect().height > 0).catch(() => false);
  if (!stayed) fail('taking a chat off the tray left the tray — the mark is inside the tile\'s button and the tap bubbled');
  else ok();

  // ── 11. sticky across a reload ────────────────────────────────────────────
  await page.reload();
  await page.waitForTimeout(500);
  if (await page.$eval('#listrow', (r) => r.getAttribute('data-on')) !== 'tray')
    fail('the tray tab is not sticky across a reload');
  else ok();

  // ── 10. an empty tray names the way in ────────────────────────────────────
  // Empty it the honest way — take the first tile off, over and over, re-reading
  // between taps because each removal repaints the whole grid.
  for (let i = 0; i < 12 && await page.$('#traygrid .traytile'); i++) {
    await page.$eval('#traygrid .traytile .traybtn', (b) => b.click());
    await page.waitForTimeout(200);
  }
  if (await page.$('#traygrid .traytile')) fail('could not empty the tray — ' + (await trayOrder()).join(','));
  else ok();
  const state = await page.$eval('#grid .state', (e) => e.textContent).catch(() => '');
  if (!/tray/i.test(state) || !/tag/i.test(state))
    fail('an empty tray does not name the way in — it reads: ' + JSON.stringify(state));
  else ok();

  await browser.close();
  server.close();
  if (process.exitCode) console.error('\n' + checks + ' checks passed before the failures above');
  else console.log('OK — ' + checks + ' checks');
})().catch((e) => { console.error(e); process.exit(1); });
