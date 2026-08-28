#!/usr/bin/env node
// A BUG-FIX CHAT WEARS A BUG, AND THE HEADER HAS ITS BUTTON (2026-08-27,
// Sophie: "add a tag on the chat ex bug fix - a picture of a bug in the list.
// start w just bugs" · "also a bug fix tag button on the right in the header
// on all 3 account pages").
//
// Drives the REAL public/chats.html against a stub API and asserts:
//   1. a chat labelled `bug fix` draws `.cr-tag.cr-bug` on its home row, and
//      a chat carrying nothing does not,
//   2. the vocabulary's own spelling variant `bugfix` draws it too — TAG_MARKS
//      matches the words, not one string,
//   3. the glyph is the Lucide bug: a stroked line glyph, not filled, with the
//      bug's own antennae/legs paths — checked by path data because a
//      wrong-but-valid glyph renders perfectly,
//   4. it is the QUIET ink, not the marks' red — a bug fix is what the chat
//      IS, never a debt she is owed,
//   5. it is a <span>, never a button — a nested button inside the row button
//      would eat the tap,
//   6. the bug BUTTON shows on the chat list (all three account tabs are views
//      of it) and hides on the Update view, where the Instagram icon lives,
//   7. tapping it narrows the screen to the OPEN bug-fix chats and lights the
//      button — an archived one stays archived (2026-08-28, Sophie: "archive
//      doesn't pop out ur insane that's the point of archive"; it reached in
//      for one day, and the emptying IS the feature — a finished bug chat is
//      in the archive, which has its own `bug fix` chip),
//   8. tapping it again puts the whole list back.
//
//   npm install playwright-core --no-save && node scripts/test-chats-bug-tag.js
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
  { id: 'm1', chat: 'bugged', from: 'claude', text: 'fixed the thing', tldr: 'fixed', created: iso(T0 - 3 * HOUR), postedAt: iso(T0 - 3 * HOUR) },
  { id: 'm2', chat: 'varian', from: 'claude', text: 'other spelling', tldr: 'spelling', created: iso(T0 - 2 * HOUR), postedAt: iso(T0 - 2 * HOUR) },
  { id: 'm3', chat: 'plain', from: 'claude', text: 'nothing tagged', tldr: 'plain', created: iso(T0 - HOUR), postedAt: iso(T0 - HOUR) },
  { id: 'm4', chat: 'putaway', from: 'claude', text: 'archived itself', tldr: 'done', created: iso(T0 - 4 * HOUR), postedAt: iso(T0 - 4 * HOUR) },
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    // `bug fix` is a TAG word, not a pile word, so the tagged chats stay on
    // the unfiled home list. `putaway` is the auto-archived one: off the main
    // list, but the bug button must still find it.
    return res.end(JSON.stringify({ build: 'test', truncated: [], messages: MSGS, delta: false,
      settings: { categories: ['bug fix'] },
      chats: {
        bugged: { lastSeen: MSGS[0].created, labels: ['bug fix'], filedAt: iso(T0 - 3 * HOUR) },
        varian: { lastSeen: MSGS[1].created, labels: ['bugfix'], filedAt: iso(T0 - 2 * HOUR) },
        plain: { lastSeen: MSGS[2].created },
        putaway: { lastSeen: MSGS[3].created, labels: ['bug fix'], filedAt: iso(T0 - 4 * HOUR), archived: true },
      } }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
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

  await page.goto(base + '/chats');
  await page.waitForSelector(row('plain'));

  // ── 1/2. who wears it ─────────────────────────────────────────────────────
  if (!await page.$(row('bugged') + ' .cr-tag.cr-bug')) fail('the `bug fix` chat has no bug on its row');
  else ok();
  if (!await page.$(row('varian') + ' .cr-tag.cr-bug')) fail('the `bugfix` spelling drew no bug — TAG_MARKS must match her vocabulary, not one string');
  else ok();
  if (await page.$(row('plain') + ' .cr-tag')) fail('an untagged chat drew a tag mark');
  else ok();

  // ── 3. the glyph ─────────────────────────────────────────────────────────
  const svg = await page.$eval(row('bugged') + ' .cr-tag svg', (n) => ({
    fill: n.getAttribute('fill'),
    stroke: n.getAttribute('stroke'),
    d: [].map.call(n.querySelectorAll('path'), (p) => p.getAttribute('d')).join(' '),
  })).catch(() => ({ fill: null, stroke: null, d: '' }));
  if (svg.fill !== 'none' || svg.stroke !== 'currentColor') {
    fail('the bug is not a house line glyph — fill=' + svg.fill + ' stroke=' + svg.stroke);
  } else ok();
  if (!/m8 2 1\.88 1\.88/.test(svg.d) || !/M12 20v-9/.test(svg.d)) {
    fail('the glyph is not the Lucide bug — no antennae/spine in ' + svg.d);
  } else ok();
  // Not the wristwatch it shares the slot with.
  if (/16\.13 7\.66/.test(svg.d)) fail('the tag mark is drawing the WATCH');
  else ok();

  // ── 4. the quiet ink, not the marks' red ─────────────────────────────────
  const col = await page.$eval(row('bugged') + ' .cr-tag', (n) => getComputedStyle(n).color).catch(() => 'none');
  if (/rgb\(179,\s*68,\s*63\)/.test(col)) fail('the bug wears the marks’ red — it is a description, not a debt');
  else ok();

  // ── 5. a mark, never a button ────────────────────────────────────────────
  const tag = await page.$eval(row('bugged') + ' .cr-tag', (n) => n.tagName.toLowerCase()).catch(() => 'nothing');
  if (tag !== 'span') fail('the mark is a <' + tag + '> — a nested button inside the row button would eat the tap');
  else ok();

  // ── 6. the button lives on the chat list and leaves with it ──────────────
  const btn = await page.$('#bugbtn');
  if (!btn) fail('#bugbtn is not in the page');
  else ok();
  if (await page.$eval('#bugbtn', (n) => n.hidden)) fail('the bug button is hidden on the chat list');
  else ok();
  // The UPDATE tab lives on the ACCOUNT row, and since 2026-08-28 that row
  // takes turns with the three lists — so this reaches it the way she does,
  // through the toggle beside the account switcher.
  await page.click('#rowtog');
  await page.waitForTimeout(50);
  await page.click('.acctab[data-acct="new"]');   // the Update view
  await page.waitForTimeout(150);
  if (!await page.$eval('#bugbtn', (n) => n.hidden)) fail('the bug button stayed on the Update view — it belongs to the chat list');
  else ok();
  await page.click('.acctab[data-acct="1"]');     // back to an account page
  await page.waitForSelector(row('plain'));

  // ── 7. the tap narrows, LEAVES the archive alone, and lights ─────────────
  await page.click('#bugbtn');
  await page.waitForTimeout(150);
  if (await page.$(row('plain'))) fail('the bug filter left an untagged chat on screen');
  else ok();
  if (!await page.$(row('bugged')) || !await page.$(row('varian'))) fail('the bug filter dropped a tagged chat');
  else ok();
  // AN ARCHIVED CHAT STAYS ARCHIVED (2026-08-28, Sophie: "archive doesn't pop
  // out ur insane that's the point of archive"). This asserted the opposite
  // for a day; her word retired that.
  if (await page.$(row('putaway'))) fail('the bug pile handed back an ARCHIVED chat — the archive is where she put it');
  else ok();
  if (!await page.$eval('#bugbtn', (n) => n.classList.contains('on'))) fail('the button is not lit while the filter is on');
  else ok();

  // ── 8. …and the second tap puts the list back ────────────────────────────
  await page.click('#bugbtn');
  await page.waitForTimeout(150);
  if (!await page.$(row('plain'))) fail('tapping the bug button again did not bring the whole list back');
  else ok();
  if (await page.$(row('putaway'))) fail('the archived chat stayed on the live list after the filter came off');
  else ok();

  await browser.close();
  server.close();
  if (process.exitCode) console.log('\n' + checks + ' passed, with failures above');
  else console.log('\nOK — ' + checks + ' checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
