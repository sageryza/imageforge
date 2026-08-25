#!/usr/bin/env node
// WAITING FOR A RESPONSE WEARS A MARK (2026-08-24, Sophie: "are there any
// extra instructions for if I tag a chat waiting for a response? Since I'm
// waiting for it I'd like a chat that's tagged like that to come with some
// extra indication").
//
// The tag already had ONE rule — it pins the chat's card to the top of the
// Update tab (TAG_RULES) — and that was the whole of it. Everywhere else the
// chat looked like every other chat, so the only screen that knew she was
// waiting was the one screen she had to already be on.
//
// Drives the REAL public/chats.html against a stub API and asserts:
//   1. a chat carrying the word draws `.cr-wait` on its home row, and a chat
//      carrying nothing does not,
//   2. the OTHER rule word (`to be reviewed`) draws no mark — the mark is
//      about a debt, not about any tag with a rule behind it,
//   3. the glyph is the WRISTWATCH: stroked, not filled, and not the star, the
//      bookmark or the bell it shares a row and a colour with,
//   4. it is the marks' red (--chg), the colour the star and the bookmark
//      already wear,
//   5. it is a MARK and not a button — a nested <button> inside the row button
//      is invalid markup and the tap would bubble into opening the chat,
//   6. it rides the thread header too, so the chat says it when she is in it,
//   7. taking the tag off in the Organize sheet takes the mark out of that
//      header ON THE SAME TAP (the header is built once, so nothing else
//      would repaint it), and putting it back puts the mark back,
//   8. and the row's mark follows on the way back out to the list.
//
//   npm install playwright-core --no-save && node scripts/test-chats-waiting-mark.js
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
  { id: 'm1', chat: 'owed', from: 'claude', text: 'asked her a thing', tldr: 'asked', created: iso(T0 - 3 * HOUR), postedAt: iso(T0 - 3 * HOUR) },
  { id: 'm2', chat: 'queued', from: 'claude', text: 'a deck to look at', tldr: 'deck', created: iso(T0 - 2 * HOUR), postedAt: iso(T0 - 2 * HOUR) },
  { id: 'm3', chat: 'plain', from: 'claude', text: 'nothing owed', tldr: 'plain', created: iso(T0 - HOUR), postedAt: iso(T0 - HOUR) },
];
const posted = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    // `waiting for a response` and `to be reviewed` are TAG words, not pile
    // words, so all three chats stay on the unfiled home list — which is the
    // screen this test is about.
    return res.end(JSON.stringify({ build: 'test', truncated: [], messages: MSGS, delta: false,
      // Her vocabulary, seeded so the Organize sheet still offers the word
      // after it has been taken OFF the only chat wearing it — the row is
      // built from the words she has, not from the words in use.
      settings: { categories: ['waiting for a response', 'to be reviewed'] },
      chats: {
        owed: { lastSeen: MSGS[0].created, labels: ['waiting for a response'], filedAt: iso(T0 - 3 * HOUR) },
        queued: { lastSeen: MSGS[1].created, labels: ['to be reviewed'], filedAt: iso(T0 - 2 * HOUR) },
        plain: { lastSeen: MSGS[2].created },
      } }));
  }
  if (url.pathname === '/api/chatfeed/labels' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      posted.push(JSON.parse(body || '{}'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
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
const RED = /rgb\(179,\s*68,\s*63\)/;

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
  if (!await page.$(row('owed') + ' .cr-wait')) fail('the tagged chat has no waiting mark on its row');
  else ok();
  if (await page.$(row('plain') + ' .cr-wait')) fail('an untagged chat drew a waiting mark');
  else ok();
  if (await page.$(row('queued') + ' .cr-wait')) {
    fail('`to be reviewed` drew the waiting mark — that word is a queue she can visit, not an answer she is owed');
  } else ok();

  // ── 3. the glyph ─────────────────────────────────────────────────────────
  // A wristwatch: the dial as a <circle r=6>, the two hands, and the two strap
  // paths above and below it. Checked by its own path data rather than by
  // eyeballing, because a wrong-but-valid glyph renders perfectly — and this
  // one replaced an hourglass that was perfectly valid and said the wrong
  // thing (2026-08-24, her ask for a watch).
  const svg = await page.$eval(row('owed') + ' .cr-wait svg', (n) => {
    const c = n.querySelector('circle');
    return {
      fill: n.getAttribute('fill'),
      stroke: n.getAttribute('stroke'),
      dial: c ? c.getAttribute('r') : null,
      d: [].map.call(n.querySelectorAll('path'), (p) => p.getAttribute('d')).join(' '),
    };
  }).catch(() => ({ fill: null, stroke: null, dial: null, d: '' }));
  if (svg.fill !== 'none' || svg.stroke !== 'currentColor') {
    fail('the mark is not a house line glyph — fill=' + svg.fill + ' stroke=' + svg.stroke);
  } else ok();
  if (svg.dial !== '6') fail('the glyph has no r=6 dial — not the wristwatch, saw r=' + svg.dial);
  else ok();
  if (!/M12 10v2\.2l1\.6 1/.test(svg.d) || !/16\.13 7\.66/.test(svg.d)) {
    fail('the glyph is not the wristwatch — no hands and no strap in ' + svg.d);
  } else ok();
  // Not one of the marks it sits beside: the bookmark is a single filled
  // pennant path, the star is many-pointed.
  if (/m19 21-7-4-7 4V5/.test(svg.d)) fail('the waiting mark is drawing the BOOKMARK');
  else ok();

  // ── 4. the marks' red ────────────────────────────────────────────────────
  const col = await page.$eval(row('owed') + ' .cr-wait', (n) => getComputedStyle(n).color).catch(() => 'none');
  if (!RED.test(col)) fail('the waiting mark is not the marks’ red, saw ' + col);
  else ok();

  // ── 5. a mark, never a button ────────────────────────────────────────────
  const tag = await page.$eval(row('owed') + ' .cr-wait', (n) => n.tagName.toLowerCase()).catch(() => 'nothing');
  if (tag !== 'span') fail('the mark is a <' + tag + '> — a nested button inside the row button is invalid and would eat the tap');
  else ok();

  // ── 6. the thread says it too ────────────────────────────────────────────
  await page.click(row('owed'));
  await page.waitForSelector('#thread .thread-head h1');
  if (!await page.$('#thread .thread-head h1 .cr-wait')) {
    fail('the thread header does not carry the mark — the chat she is standing in says nothing');
  } else ok();

  // ── 7. the tap that changes it repaints the header ───────────────────────
  await page.click('#thread header .no .orgbtn');
  await page.waitForSelector('.askwrap .askbox .arctags', { timeout: 3000 })
    .catch(() => fail('the organize button opened nothing'));
  const chip = '.askwrap .arctags button.catchip.on';
  const lit = await page.$$eval(chip, (ns) => ns.map((n) => n.textContent.trim().toLowerCase()));
  if (lit.indexOf('waiting for a response') < 0) {
    fail('the sheet does not show the word as lit — saw ' + JSON.stringify(lit));
  } else ok();
  await page.evaluate((sel) => {
    const b = [].find.call(document.querySelectorAll(sel),
      (n) => n.textContent.trim().toLowerCase() === 'waiting for a response');
    b.click();
  }, chip);
  await page.waitForTimeout(150);
  if (await page.$('#thread .thread-head h1 .cr-wait')) {
    fail('taking the tag off left the mark in the thread header');
  } else ok();
  if (!posted.some((p) => (p.remove || []).indexOf('waiting for a response') > -1)) {
    fail('taking the tag off did not reach /api/chatfeed/labels — ' + JSON.stringify(posted));
  } else ok();
  // …and back on, on the same screen.
  await page.evaluate((sel) => {
    const b = [].find.call(document.querySelectorAll(sel),
      (n) => n.textContent.trim().toLowerCase() === 'waiting for a response');
    b.click();
  }, '.askwrap .arctags button.catchip');
  await page.waitForTimeout(150);
  if (!await page.$('#thread .thread-head h1 .cr-wait')) {
    fail('putting the tag back did not put the mark back in the thread header');
  } else ok();

  // ── 8. …and the row agrees on the way back out ───────────────────────────
  await page.evaluate(() => { const b = document.querySelector('#thread header .no .backbtn, #thread .backbtn'); if (b) b.click(); });
  await page.evaluate(() => { if (window.renderHome) { window.cur = null; } });
  await page.goto(base + '/chats');
  await page.waitForSelector(row('owed'));
  if (!await page.$(row('owed') + ' .cr-wait')) fail('the row lost the mark after a reload');
  else ok();

  await browser.close();
  server.close();
  if (process.exitCode) console.log('\n' + checks + ' passed, with failures above');
  else console.log('\nOK — ' + checks + ' checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
