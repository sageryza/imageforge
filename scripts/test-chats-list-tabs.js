#!/usr/bin/env node
// THE CHAT AREA IS THREE LISTS (2026-08-28, Sophie: "i'm thinking about
// restructuring chat area based on bug fixes and deliverables, so they're on
// two separate lists" → "one tab ALL chats, in timing order · one - list of
// deliverables AS they're delivered ... · bug fix tab third" · "just three
// images, like the update tab" · "also have a toggle next to account switcher
// that goes back to 3 tabs 1 per account").
//
// Drives the REAL public/chats.html against a stub API and asserts:
//   1. the three tabs stand in the ACCOUNT row's place — one row on screen,
//      never two stacked, and the account row is the one that gave way,
//   2. ALL is not the home inbox: a FILED chat (one carrying a pile word) is
//      on it, where the ordinary list hides it — that is the whole tab,
//   3. …and the archive and the trash stay their own rooms,
//   4. the rows are in timing order, newest first,
//   5. DELIVERED draws the films as rows and the pictures three across, and a
//      picture row says how many there really were,
//   6. BUG FIXES is the header button's own pile — tapping the button lights
//      the third TAB, because one state must not have two spellings,
//   7. the toggle beside the account switcher swaps the row back to the
//      accounts, and swaps back,
//   8. the choice is sticky across a reload,
//   9. nothing in the row is under the autoscroll pill's fixed corner,
//  10. the HIDDEN pile is on ALL, behind the SAME fold bar as the live list
//      (2026-08-28, Sophie: "put hidden back in the new tab structure · same
//      ui") — it went missing because this tab renders its own list.
//
//   npm install playwright-core --no-save && node scripts/test-chats-list-tabs.js
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

const MSGS = [
  { id: 'm1', chat: 'plain',  from: 'claude', text: 'nothing tagged', tldr: 'plain',  created: iso(T0 - HOUR),     postedAt: iso(T0 - HOUR) },
  { id: 'm2', chat: 'filed',  from: 'claude', text: 'filed away',     tldr: 'filed',  created: iso(T0 - 2 * HOUR), postedAt: iso(T0 - 2 * HOUR) },
  { id: 'm3', chat: 'bugged', from: 'claude', text: 'fixed a thing',  tldr: 'fixed',  created: iso(T0 - 3 * HOUR), postedAt: iso(T0 - 3 * HOUR) },
  { id: 'm4', chat: 'gone',   from: 'claude', text: 'archived',       tldr: 'gone',   created: iso(T0 - 4 * HOUR), postedAt: iso(T0 - 4 * HOUR) },
  { id: 'm5', chat: 'binned', from: 'claude', text: 'deleted',        tldr: 'binned', created: iso(T0 - 5 * HOUR), postedAt: iso(T0 - 5 * HOUR) },
  { id: 'm6', chat: 'parked', from: 'claude', text: 'parked for now',  tldr: 'parked', created: iso(T0 - 6 * HOUR), postedAt: iso(T0 - 6 * HOUR) },
];

const FEED = [
  { kind: 'video', at: iso(T0 - HOUR), chat: 'filmy', chatName: 'Films', title: 'Evan — v18 (4:23)',
    url: 'https://example.test/film-v18.mp4', versions: 2, older: [] },
  { kind: 'images', at: iso(T0 - 2 * HOUR), chat: 'panels', chatName: 'Panels', title: 'The rat in the alley',
    count: 9, images: [
      { url: 'https://example.test/a.png', label: 'The rat in the alley', caption: 'gpt-image-2 · medium · 4K' },
      { url: 'https://example.test/b.png', label: 'The doorway', caption: '' },
      { url: 'https://example.test/c.png', label: 'The window', caption: '' }] },
  { kind: 'audio', at: iso(T0 - 3 * HOUR), chat: 'cuts', chatName: 'Cuts', title: 'Her VO v3 (0:30)',
    url: 'https://example.test/vo.m4a', versions: 1, older: [] },
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    // `witch` is a PILE word, so `filed` is off the ordinary home list and
    // must still be on ALL. `bug fix` is a plain tag and stays.
    return res.end(JSON.stringify({ build: 'test', truncated: [], messages: MSGS, delta: false,
      settings: { categories: ['witch', 'bug fix'], pileLabels: ['witch'] },
      chats: {
        plain:  { lastSeen: MSGS[0].created },
        filed:  { lastSeen: MSGS[1].created, labels: ['witch'], filedAt: iso(T0 - 2 * HOUR), catBy: 'sophie' },
        bugged: { lastSeen: MSGS[2].created, labels: ['bug fix'] },
        gone:   { lastSeen: MSGS[3].created, archived: true },
        binned: { lastSeen: MSGS[4].created, deletedAt: iso(T0 - 5 * HOUR) },
        // hidden AFTER its last message, so it is really parked
        parked: { lastSeen: MSGS[5].created, hiddenAt: iso(T0 - 5.5 * HOUR) },
      } }));
  }
  if (url.pathname === '/api/deliverables/feed') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, items: FEED }));
  }
  if (url.pathname === '/api/story/thumb') {                 // the derived copy
    res.writeHead(302, { Location: '/px.png' }); return res.end();
  }
  if (url.pathname === '/px.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(Buffer.from('89504e470d0a1a0a0000000d494844520000000100000001080600000' +
      '01f15c4890000000a49444154789c6300010000050001', 'hex'));
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
  const row = (c) => '#grid .crow[data-chat="' + c + '"]';
  const shown = (sel) => page.$eval(sel, (e) => {
    const s = getComputedStyle(e);
    return s.display !== 'none' && s.visibility !== 'hidden' && e.getBoundingClientRect().height > 0;
  }).catch(() => false);

  await page.goto(base + '/chats');
  await page.waitForSelector(row('plain'));

  // ── 1. one row, and it is the lists ───────────────────────────────────────
  if (!await shown('#listrow')) fail('the three lists row is not on screen');
  else ok();
  if (await shown('#accrow')) fail('both hairline rows are on screen at once — it is ONE row, two modes');
  else ok();
  const tabs = await page.$$eval('#listrow .acctab', (b) => b.map((x) => x.textContent.trim()));
  if (tabs.join('|') !== 'All|Delivered|Bug fixes') fail('the tabs read ' + tabs.join('|'));
  else ok();

  // ── 2/3. ALL is not the inbox ─────────────────────────────────────────────
  if (!await page.$(row('filed'))) fail('a FILED chat is missing from ALL — that is the whole tab');
  else ok();
  if (!await page.$(row('plain'))) fail('an unfiled chat is missing from ALL');
  else ok();
  if (await page.$(row('gone'))) fail('an ARCHIVED chat is on ALL — the archive is its own room');
  else ok();
  if (await page.$(row('binned'))) fail('a DELETED chat is on ALL — the trash is its own room');
  else ok();

  // ── 4. timing order ───────────────────────────────────────────────────────
  const order = await page.$$eval('#grid .crow', (r) => r.map((x) => x.dataset.chat));
  if (order.slice(0, 3).join(',') !== 'plain,filed,bugged') fail('not in timing order: ' + order.join(','));
  else ok();

  // ── 4a. THE HIDDEN PILE, SAME BAR ────────────────────────────────────────
  if (await page.$(row('parked'))) fail('a hidden chat is loose in the ALL list — it belongs behind the bar');
  else ok();
  const bar = await page.$('#grid .hidebar');
  if (!bar) fail('no hidden bar on ALL — the pile has nowhere to live');
  else ok();
  if (bar) {
    const label = await page.$eval('#grid .hidebar', (b) => b.textContent.replace(/\s+/g, ' ').trim());
    if (!/Hidden 1/.test(label)) fail('the bar does not count the pile: ' + label);
    else ok();
    await page.click('#grid .hidebar');
    await page.waitForTimeout(150);
    if (!await page.$(row('parked'))) fail('opening the bar did not show the hidden chat');
    else ok();
    // the open pile is the whole screen, exactly as on the live list
    if (await page.$(row('plain'))) fail('the open pile still shows the rest of the list');
    else ok();
    await page.click('#grid .hidebar');
    await page.waitForTimeout(150);
    if (!await page.$(row('plain'))) fail('closing the bar did not bring the list back');
    else ok();
  }

  // ── 4b. NEVER BOTH ROWS, THROUGH A REPAINT ───────────────────────────────
  // Her screenshot, 2026-08-28: the lists row AND the account row stacked. The
  // cause was two writers — paintHomeChrome un-hides the account row on every
  // repaint, and only the four list branches put it back, so the poll, a note
  // save or a search left both on screen. So this asks again AFTER a repaint
  // that does not go through those branches.
  // `_resetSearch` is a REAL path — leaving a search calls paintHomeChrome and
  // nothing else, which is exactly the shape that put the row back.
  await page.evaluate(() => window._resetSearch && window._resetSearch());
  await page.waitForTimeout(120);
  if (await shown('#accrow')) fail('a bare chrome repaint put the account row back UNDER the lists — two rows at once');
  else ok();

  // ── 5. DELIVERED ──────────────────────────────────────────────────────────
  await page.click('#listrow .acctab[data-list="delivered"]');
  await page.waitForSelector('#grid .dvrow');
  const rows = await page.$$eval('#grid .dvrow', (r) => r.map((x) => x.querySelector('.dv-t').textContent.trim()));
  if (rows[0] !== 'Evan — v18 (4:23)') fail('the newest film is not the first row: ' + rows.join(' | '));
  else ok();
  if (rows.length !== 3) fail('expected three delivered rows, got ' + rows.length);
  else ok();
  const pics = await page.$$('#grid .dvrow .dvpic img');
  if (pics.length !== 3) fail('a picture row must show three, like the Update tab — got ' + pics.length);
  else ok();
  const meta = await page.$$eval('#grid .dv-m', (m) => m.map((x) => x.textContent));
  if (!/9 pictures/.test(meta.join(' '))) fail('the picture row does not say how many there really were');
  else ok();
  // the three thumbs sit across ONE row, not stacked
  const tops = await page.$$eval('#grid .dvpic', (b) => b.map((x) => Math.round(x.getBoundingClientRect().top)));
  if (new Set(tops).size !== 1) fail('the three pictures are not on one row');
  else ok();
  // BACK TO THE CHAT — a film row's own tap plays the film, so the icon is the
  // only way from a delivery to the chat that made it.
  const chats = await page.$$('#grid .dvrow .dvchat');
  if (chats.length !== 3) fail('every delivered row needs a way back to its chat — found ' + chats.length);
  else ok();
  // it must be reachable, not sitting under the row's own button
  const hit = await page.$eval('#grid .dvrow:first-child .dvchat', (b) => {
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el && el.closest('.dvchat') ? 'ok' : (el ? el.className : 'nothing');
  });
  if (hit !== 'ok') fail('the back-to-chat icon is covered by ' + hit);
  else ok();
  await page.click('#grid .dvrow:first-child .dvchat');
  await page.waitForTimeout(200);
  if (await page.$('#pinfull')) fail('the chat icon started the film instead — the tap bubbled into the row');
  else ok();
  if (await page.$eval('#thread', (e) => e.style.display === 'none')) fail('the chat icon did not open the chat');
  else ok();
  await page.click('#back');
  await page.waitForSelector('#grid .dvrow');

  // a film row opens the house player rather than navigating away
  await page.click('#grid .dvrow:first-child .dvhead');
  if (!await page.$('#pinfull video')) fail('tapping a film did not open the player');
  else ok();
  await page.click('#pinfull .x');

  // ── 6. the bug button and the third tab are ONE state ─────────────────────
  await page.click('#bugbtn');
  await page.waitForSelector(row('bugged'));
  const lit = await page.$eval('#listrow .acctab.on', (e) => e.dataset.list).catch(() => '');
  if (lit !== 'bugs') fail('the header bug button did not light the Bug fixes TAB (lit: ' + lit + ')');
  else ok();
  if (await page.$(row('plain'))) fail('the bug pile is showing chats with no bug tag');
  else ok();

  // ── 7. the row toggle ─────────────────────────────────────────────────────
  await page.click('#rowtog');
  if (!await shown('#accrow')) fail('the toggle did not bring the account tabs back');
  else ok();
  if (await shown('#listrow')) fail('both rows are on screen after the toggle');
  else ok();
  const accTabs = await page.$$eval('#accrow .acctab', (b) => b.length);
  if (accTabs !== 4) fail('the account row is not itself (' + accTabs + ' tabs)');
  else ok();
  await page.click('#rowtog');
  if (!await shown('#listrow')) fail('the toggle does not swap back');
  else ok();

  // ── 8. sticky ─────────────────────────────────────────────────────────────
  await page.click('#listrow .acctab[data-list="delivered"]');
  await page.reload();
  await page.waitForSelector('#grid .dvrow');
  const still = await page.$eval('#listrow .acctab.on', (e) => e.dataset.list);
  if (still !== 'delivered') fail('the tab did not survive a reload (' + still + ')');
  else ok();

  // ── 9. nothing under the pill's corner ────────────────────────────────────
  // The pill is injected in production; the page reserves the corner for it,
  // so ask where the row's last tab really ends against that column.
  const box = await page.$eval('#listrow .acctab:last-child', (e) => {
    const r = e.getBoundingClientRect(); return { right: r.right, top: r.top, bottom: r.bottom };
  });
  if (box.right > 390 - 56 && box.top < 192) fail('the last tab runs into the autoscroll pill\'s column');
  else ok();

  await browser.close();
  server.close();
  if (process.exitCode) console.error('\n' + checks + ' checks passed before the failures above');
  else console.log('OK — ' + checks + ' checks');
})().catch((e) => { console.error(e); process.exit(1); });
