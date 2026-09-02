#!/usr/bin/env node
// THE PROJECT PAGE (2026-09-02, Sophie: "i'd like it so projects could auto
// group themselves, like all the triset chats, grouped in reverse
// chronological order, so i can go back and see all the triset chats from a
// single icon button on that chat page header · probably 3-4 stacked square
// cards · opens a page w hairline icon or list view · default icon, 3-up").
//
// Drives the REAL public/chats.html against a stub API and asserts:
//   1. a chat with siblings carries the stacked-cards button in its header,
//      and a chat with none carries NO button (a group of one is a dead
//      control),
//   2. the tap opens a page titled by the project, with a hairline
//      ICONS · LIST row opening on ICONS,
//   3. the pile is every chat on the project — the slug-led ones, the one the
//      sorter FILED under a new name, the ARCHIVED one (dimmed and counted),
//      the one on the OTHER account — newest first, and nothing else,
//   4. three across, MEASURED off the real cells,
//   5. LIST draws the list, and the choice is sticky across a reload,
//   6. a tile opens its chat and BACK returns to the project page,
//   7. a chat on two things opens on its FIRST and offers the other as a chip,
//   8. the title tap leaves the page for the chat list,
//   9. nothing on the tabs row or the first tile row is under the pill.
//
//   npm install playwright-core --no-save && node scripts/test-chats-project.js
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }
const servePublic = require('./lib/public-asset');

const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const HOUR = 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();

const msg = (id, chat, hoursAgo, text) => ({ id, chat, from: 'claude', text, tldr: text,
  created: iso(T0 - hoursAgo * HOUR), postedAt: iso(T0 - hoursAgo * HOUR) });
const MSGS = [
  msg('m1', 'triset-nature-classification', 1, 'newest triset'),
  msg('m2', 'triset-color-edition', 5, 'archived triset'),
  msg('m3', 'triset-chat-triangle-border', 9, 'account-two triset'),
  msg('m4', 'similitude-rules', 3, 'renamed, filed'),
  msg('m5', 'triangle-playground-style', 2, 'two projects'),
  msg('m6', 'triangle-card-cut', 4, 'triangle'),
  msg('m7', 'triangle-x', 6, 'triangle'),
  msg('m8', 'playground-a', 7, 'playground'),
  msg('m9', 'playground-b', 8, 'playground'),
  msg('m10', 'playground-c', 10, 'playground'),
  msg('m11', 'lonely-chat-about-cats', 11, 'alone'),
  msg('m12', 'triset-binned', 12, 'deleted'),
];
const CHATS = {
  'triset-nature-classification': { lastSeen: MSGS[0].created },
  'triset-color-edition': { lastSeen: MSGS[1].created, archived: true },
  'triset-chat-triangle-border': { lastSeen: MSGS[2].created, account: '2' },
  'similitude-rules': { lastSeen: MSGS[3].created, project: 'triset', projectBy: 'auto', displayName: 'Similitude rules' },
  'triangle-playground-style': { lastSeen: MSGS[4].created },
  'triangle-card-cut': { lastSeen: MSGS[5].created },
  'triangle-x': { lastSeen: MSGS[6].created },
  'playground-a': { lastSeen: MSGS[7].created },
  'playground-b': { lastSeen: MSGS[8].created },
  'playground-c': { lastSeen: MSGS[9].created },
  'lonely-chat-about-cats': { lastSeen: MSGS[10].created },
  'triset-binned': { lastSeen: MSGS[11].created, deletedAt: MSGS[11].created },
};
const TRISET = ['triset-nature-classification', 'similitude-rules', 'triset-color-edition', 'triset-chat-triangle-border'];

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'test', truncated: [], messages: MSGS, delta: false,
      settings: { categories: ['witch'], pileLabels: [] }, chats: CHATS }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true,"messages":[]}');
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
  page.on('pageerror', (e) => fail('page error: ' + e.message));

  const title = () => page.$eval('#htxt', (n) => n.textContent.trim());
  const chatsShown = () => page.$$eval('#grid [data-chat]', (n) => n.map((x) => x.dataset.chat));

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat]');
  // ALL tab so every fixture chat is reachable
  await page.click('#listrow .acctab[data-list="all"]').catch(() => {});
  await page.waitForTimeout(200);

  // ── 1. the button, and its absence ────────────────────────────────────────
  await page.click('[data-chat="triset-nature-classification"]');
  await page.waitForSelector('#thread .projbtn');
  const key = await page.$eval('#thread .projbtn', (b) => b.dataset.project);
  if (key !== 'triset') fail('the button opens ' + key + ', expected triset');
  else ok();
  const glyph = await page.$eval('#thread .projbtn svg', (s) => s.querySelectorAll('rect,path').length);
  if (glyph < 3) fail('the button is not three stacked cards');
  else ok();
  await page.click('#back');
  await page.waitForTimeout(200);
  await page.click('[data-chat="lonely-chat-about-cats"]');
  await page.waitForSelector('#thread h1');
  if (await page.$('#thread .projbtn')) fail('a chat with no siblings carries the button — a group of one is a dead control');
  else ok();
  await page.click('#back');
  await page.waitForTimeout(200);

  // ── 2. the page: title, hairline row, icons by default ────────────────────
  await page.click('[data-chat="triset-nature-classification"]');
  await page.waitForSelector('#thread .projbtn');
  await page.click('#thread .projbtn');
  await page.waitForSelector('#projtabs');
  if ((await title()) !== 'Triset') fail('the page is titled ' + (await title()) + ', expected Triset');
  else ok();
  const tabs = await page.$$eval('#projtabs .acctab', (b) => b.map((x) => x.textContent.trim() + (x.classList.contains('on') ? '*' : '')));
  if (tabs.join('|') !== 'Icons*|List') fail('the row reads ' + tabs.join('|') + ', expected Icons* | List');
  else ok();
  if (!(await page.$('#grid #chatgrid'))) fail('the page did not open on the icon wall');
  else ok();
  // the tabs row's underline really measured (the row has been laid out)
  const tw = await page.$eval('#projtabs', (r) => parseFloat(r.style.getPropertyValue('--tw')) || 0);
  if (!(tw > 20)) fail('the hairline row drew no underline (--tw ' + tw + ')');
  else ok();

  // ── 3. the pile — every triset chat, newest first, nothing else ───────────
  const shown = await chatsShown();
  if (shown.join(',') !== TRISET.join(',')) fail('the pile is ' + shown.join(',') + '\n      expected ' + TRISET.join(','));
  else ok();
  const arch = await page.$eval('#grid [data-chat="triset-color-edition"]', (n) => n.classList.contains('archd'));
  if (!arch) fail('the archived sibling is not marked as put away');
  else ok();
  const cover = await page.$eval('#grid [data-chat="triset-color-edition"] .t-cover', (n) => parseFloat(getComputedStyle(n).opacity));
  if (!(cover < 0.9)) fail('the archived cover is not dimmed (opacity ' + cover + ')');
  else ok();
  const count = await page.$eval('#projcount', (n) => n.textContent.trim());
  if (count !== '4 chats · 1 archived') fail('the count reads "' + count + '"');
  else ok();

  // ── 4. three across, measured ─────────────────────────────────────────────
  const rects = await page.$$eval('#chatgrid .tile', (n) => n.slice(0, 4).map((x) => { const r = x.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; }));
  const firstRow = rects.filter((r) => r[1] === rects[0][1]);
  if (firstRow.length !== 3) fail('the first row holds ' + firstRow.length + ' tiles, expected 3 — ' + JSON.stringify(rects));
  else ok();
  // …and no day heading breaks the wall into a column (the fixture's four
  // chats span three "days" under the 5am rule only if hours differ enough —
  // so the check is structural: the wall carries no rule at all, and each
  // tile carries its own date instead).
  if (await page.$('#chatgrid .dayrule')) fail('the icon wall carries day headings — four chats on three days draw as a column');
  else ok();
  const dated = await page.$$eval('#chatgrid .tile', (n) => n.every((x) => x.querySelector('.t-meta') && x.querySelector('.t-meta').textContent.trim()));
  if (!dated) fail('an icon tile carries no date — "go back and see" is a question about when');
  else ok();

  // ── 9. nothing under the pill ─────────────────────────────────────────────
  const covered = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#projtabs .acctab, #chatgrid .tile').forEach((el, i) => {
      if (i > 4) return;
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 30));
      if (hit && !el.contains(hit) && !hit.contains(el)) out.push((el.textContent || el.dataset.chat || '').trim().slice(0, 30) + ' ← ' + (hit.id || hit.className));
    });
    return out;
  });
  if (covered.length) fail('covered: ' + covered.join('; '));
  else ok();

  // ── 5. LIST, and it is sticky ─────────────────────────────────────────────
  await page.click('#projtabs .acctab[data-pv="list"]');
  await page.waitForSelector('#grid .clist');
  const rows = await chatsShown();
  if (rows.join(',') !== TRISET.join(',')) fail('the list is ' + rows.join(','));
  else ok();
  await page.reload();
  await page.waitForSelector('#grid [data-chat]');
  await page.click('#listrow .acctab[data-list="all"]').catch(() => {});
  await page.waitForTimeout(200);
  await page.click('[data-chat="triset-nature-classification"]');
  await page.waitForSelector('#thread .projbtn');
  await page.click('#thread .projbtn');
  await page.waitForSelector('#projtabs');
  const lit = await page.$eval('#projtabs .acctab.on', (b) => b.dataset.pv);
  if (lit !== 'list') fail('the view is not sticky across a reload (lit: ' + lit + ')');
  else ok();
  await page.click('#projtabs .acctab[data-pv="icons"]');
  await page.waitForSelector('#grid #chatgrid');

  // ── 6. a tile opens its chat, back returns to the page ────────────────────
  await page.click('#chatgrid .tile[data-chat="similitude-rules"]');
  await page.waitForSelector('#thread h1');
  const h1 = await page.$eval('#thread h1', (n) => n.textContent.trim());
  if (h1 !== 'Similitude rules') fail('the tile opened ' + h1);
  else ok();
  await page.click('#back');
  await page.waitForTimeout(250);
  if (!(await page.$('#projtabs')) || (await title()) !== 'Triset') fail('back did not return to the project page');
  else ok();

  // ── 7. a chat on two things ───────────────────────────────────────────────
  await page.evaluate(function(){ return window.__titleBack(); });   // the title's tap (its hit-test is the hrow's)
  await page.waitForTimeout(200);
  await page.click('#listrow .acctab[data-list="all"]').catch(() => {});
  await page.waitForTimeout(200);
  await page.click('[data-chat="triangle-playground-style"]');
  await page.waitForSelector('#thread .projbtn');
  await page.click('#thread .projbtn');
  await page.waitForSelector('#projtabs');
  if ((await title()) !== 'Triangle') fail('a two-project chat opened on ' + (await title()) + ', expected Triangle (its lead word)');
  else ok();
  const chips = await page.$$eval('.projchips .catchip', (b) => b.map((x) => x.dataset.project + (x.classList.contains('on') ? '*' : '')));
  if (chips.join('|') !== 'triangle*|playground') fail('the chips read ' + chips.join('|'));
  else ok();
  await page.click('.projchips .catchip[data-project="playground"]');
  await page.waitForTimeout(200);
  const pg = await chatsShown();
  if ((await title()) !== 'Playground' || pg.length !== 4 || pg[0] !== 'triangle-playground-style')
    fail('the playground chip shows ' + (await title()) + ' with ' + pg.join(','));
  else ok();

  // ── 8. the title leaves the page ──────────────────────────────────────────
  await page.evaluate(function(){ return window.__titleBack(); });
  await page.waitForTimeout(200);
  if ((await title()) !== 'Chats' || (await page.$('#projtabs'))) fail('the title tap did not return to the chat list');
  else ok();

  await browser.close();
  server.close();
  if (process.exitCode) console.error('project page: FAILED (' + checks + ' passed before)');
  else console.log('project page: ' + checks + ' checks passed');
})().catch((e) => { fail(e.stack || String(e)); server.close(); process.exit(1); });
