#!/usr/bin/env node
// THE PINNED BLOCK FOLDS (2026-09-02, Sophie: "make the pinned panel
// collapsible in chat app").
//
// Measured on her LIVE list at 390x844 before anything was built: the PINNED
// heading sat at y=282 and TODAY at y=741, so her pinned chats filled the whole
// first screen and the current ones started below the fold — with the HIDDEN
// bar right above them already folding and this block, the taller of the two,
// with no way to put it away. Folding it moved TODAY to y=314.
//
// Drives the REAL public/chats.html against a stub API and asserts:
//   1. it opens OPEN — pinned chats exist to lead the list, so folded has to be
//      a state she chose,
//   2. the heading itself is the control (hit-tested with elementFromPoint at
//      its own centre, not "a button exists somewhere"), and a tap really takes
//      the pinned rows OUT OF THE LAYOUT — counted off the rendered list, since
//      a row hidden with CSS and a row that never rendered are the same to any
//      source assertion but not to the page,
//   3. …which really does lift what is under it up the screen,
//   4. the count shows only while it is SHUT (open, the rows are right there —
//      the archive summary's don't-say-it-twice rule),
//   5. the fold is REMEMBERED across a reload,
//   6. tapping it does not move the screen out from under her — the heading
//      stays where it was in the viewport (the `repaintKeepingBar` rule the
//      MORE fold earned),
//   7. it takes NOTHING else with it: every date heading below is still a plain
//      rule with no fold, and their rows still render,
//   8. a pile with no pinned chat draws no foldable heading at all,
//   9. renderTiles folds identically — the page is one IIFE with `view` pinned
//      to 'list', so the second renderer is pinned by SOURCE.
//
//   npm install playwright-core --no-save && node scripts/test-chats-pin-fold.js
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }

const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();
// Three pinned chats and three that are not, all recent enough to be live.
const PINS = ['pin-a', 'pin-b', 'pin-c'];
const PLAIN = ['plain-a', 'plain-b', 'plain-c'];
const ALL = PINS.concat(PLAIN);
const MSGS = ALL.map((c, i) => ({
  id: 'm' + i, chat: c, from: 'claude', text: 'a reply from ' + c, tldr: c,
  created: iso(T0 - (i + 1) * 60000), postedAt: iso(T0 - (i + 1) * 60000),
}));
const chatsDoc = () => {
  const o = {};
  MSGS.forEach((m) => { o[m.chat] = { lastSeen: m.created }; });
  PINS.forEach((c) => { o[c].pinTop = true; });
  return o;
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'test', truncated: [], messages: MSGS, delta: false, settings: {}, chats: chatsDoc() }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}');
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
let checks = 0; const ok = () => { checks++; };

// What the list really renders: the headings, and which rows are in it.
const readList = (page) => page.evaluate(() => {
  const rule = document.querySelector('#grid .clist .pinrule');
  const rules = [...document.querySelectorAll('#grid .clist > .dayrule')].map((n) => ({
    text: n.textContent.trim(), tag: n.tagName, fold: n.classList.contains('pinrule'),
    top: Math.round(n.getBoundingClientRect().top + window.scrollY),
  }));
  return {
    rules,
    rows: [...document.querySelectorAll('#grid .clist .crow')].map((n) => n.dataset.chat),
    pinTop: rule ? Math.round(rule.getBoundingClientRect().top) : null,
    shut: rule ? rule.classList.contains('shut') : null,
    expanded: rule ? rule.getAttribute('aria-expanded') : null,
  };
});
const dayTop = (l, name) => (l.rules.find((r) => r.text === name) || {}).top;

(async () => {
  await new Promise((r) => server.listen(0, r));
  const baseUrl = 'http://127.0.0.1:' + server.address().port;
  const pre = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(pre ? { executablePath: pre } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(baseUrl + '/chats');
  await page.waitForSelector('#grid .crow[data-chat="plain-a"]');

  // ── 1. it opens OPEN, with the pinned rows in the list ────────────────────
  const open = await readList(page);
  if (!open.rules.length || !open.rules[0].fold) fail('the list does not open with a foldable Pinned heading');
  else ok();
  if (open.shut !== false || open.expanded !== 'true') fail('the Pinned block opens folded — the fold has to be a state she chose');
  else ok();
  const missing = PINS.filter((c) => open.rows.indexOf(c) < 0);
  if (missing.length) fail('open, these pinned chats are not in the list: ' + missing.join(', '));
  else ok();

  // ── 4a. no count while it is open ────────────────────────────────────────
  if (/\d/.test(open.rules[0].text)) fail('the open heading reads "' + open.rules[0].text + '" — the rows are right there, so the count says it twice');
  else ok();

  // ── 2. the HEADING is the control, and the tap really lands on it ────────
  const hit = await page.evaluate(() => {
    const r = document.querySelector('#grid .clist .pinrule').getBoundingClientRect();
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { cls: el ? el.className.toString() : null, inside: !!(el && el.closest('.pinrule')) };
  });
  if (!hit.inside) fail('a tap at the middle of the Pinned heading reaches ' + hit.cls + ' instead — the whole heading is the fold');
  else ok();

  const before = await page.evaluate(() => document.querySelector('#grid .clist .pinrule').getBoundingClientRect().top);
  await page.click('#grid .clist .pinrule');
  await page.waitForTimeout(250);
  const shut = await readList(page);

  const still = PINS.filter((c) => shut.rows.indexOf(c) >= 0);
  if (still.length) fail('folded, these pinned rows are still in the list: ' + still.join(', '));
  else ok();
  if (shut.shut !== true || shut.expanded !== 'false') fail('the heading does not read as folded after the tap');
  else ok();

  // ── 3. …and the screen really got shorter ────────────────────────────────
  const todayOpen = dayTop(open, 'Today'), todayShut = dayTop(shut, 'Today');
  if (todayOpen == null || todayShut == null) fail('no Today heading to measure against');
  else if (!(todayShut < todayOpen - 100)) {
    fail('folding moved what is under it by only ' + (todayOpen - todayShut) + 'px — the block is not actually coming out of the layout');
  } else ok();

  // ── 4b. the count shows SHUT, and it is the pile's own count ─────────────
  const n = (shut.rules[0].text.match(/(\d+)/) || [])[1];
  if (+n !== PINS.length) fail('the folded heading reads "' + shut.rules[0].text + '" — expected a count of ' + PINS.length);
  else ok();

  // ── 6. the tap did not move the screen under her ─────────────────────────
  const after = await page.evaluate(() => document.querySelector('#grid .clist .pinrule').getBoundingClientRect().top);
  if (Math.abs(after - before) > 2) fail('the heading jumped ' + Math.round(after - before) + 'px in the viewport when she tapped it');
  else ok();

  // ── 7. nothing else folded, and the other days still have their rows ─────
  const others = shut.rules.slice(1);
  if (!others.length) fail('the fixture drew no other date headings to check');
  else if (others.some((r) => r.fold || r.tag !== 'DIV')) fail('a DATE heading became foldable too — only the pinned block folds');
  else ok();
  const lostPlain = PLAIN.filter((c) => shut.rows.indexOf(c) < 0);
  if (lostPlain.length) fail('folding the pinned block also took these rows: ' + lostPlain.join(', '));
  else ok();

  // ── 5. remembered across a reload ────────────────────────────────────────
  await page.reload();
  await page.waitForSelector('#grid .crow[data-chat="plain-a"]');
  const back = await readList(page);
  if (back.shut !== true) fail('the fold was forgotten on reload — this is a list she comes back to all day');
  else ok();
  if (PINS.some((c) => back.rows.indexOf(c) >= 0)) fail('the heading says folded after a reload but the rows came back');
  else ok();

  // …and tapping it opens the block again.
  await page.click('#grid .clist .pinrule');
  await page.waitForTimeout(250);
  const reopened = await readList(page);
  if (PINS.some((c) => reopened.rows.indexOf(c) < 0)) fail('tapping the folded heading did not bring the pinned rows back');
  else ok();

  // ── 8. no pinned chats → no foldable heading at all ──────────────────────
  server.close();
  const server2 = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
      const c = chatsDoc(); PINS.forEach((k) => { delete c[k].pinTop; });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ build: 'test', truncated: [], messages: MSGS, delta: false, settings: {}, chats: c }));
    }
    if (url.pathname === '/' || url.pathname === '/chats') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}');
  });
  await new Promise((r) => server2.listen(0, r));
  const url2 = 'http://127.0.0.1:' + server2.address().port;
  const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page2.goto(url2 + '/chats');
  await page2.waitForSelector('#grid .crow[data-chat="plain-a"]');
  const none = await readList(page2);
  if (none.rules.some((r) => r.fold)) fail('a pile with no pinned chat still draws a foldable Pinned heading');
  else ok();
  if (ALL.some((c) => none.rows.indexOf(c) < 0)) fail('with nothing pinned, rows went missing from the list');
  else ok();

  // ── 9. the tiles renderer folds the same way ─────────────────────────────
  // `view` is pinned to 'list' inside the page's one IIFE (renderTiles is kept
  // at her ask), so there is no way in from outside: pin it by SOURCE, the way
  // test-chats-day-rules.js already pins its headings.
  const src = fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8');
  const tilesFn = src.slice(src.indexOf('function renderTiles('), src.indexOf('function renderTiles(') + 2000);
  if (!/mkDayRule\(dk\s*,\s*nPin\)/.test(tilesFn) || !/dk===.pin.\s*&&\s*pinShut/.test(tilesFn)) {
    fail('renderTiles does not fold the pinned block — a control that works in one of the two views and not the other is a bug');
  } else ok();

  await browser.close();
  server2.close();
  if (process.exitCode) console.log('\n' + checks + ' passed, with failures above');
  else console.log('\nOK — ' + checks + ' checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
