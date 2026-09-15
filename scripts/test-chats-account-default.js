#!/usr/bin/env node
// THE CHAT LIST DOES NOT DEFAULT TO ONE ACCOUNT (2026-09-15, Sophie: "does
// chat app default to only current account?" · "shud be chronological").
//
// It did, and invisibly. `rowMode` defaults to the THREE LISTS, which take
// the account row's PLACE — so the row was off screen while its filter went
// on narrowing every pile under it. Measured on her live registry the day she
// asked, with the app signed into account 2: of her 30 most recently active
// chats, 26 are on account 1 and FOUR on account 2, and the ALL pile was 136
// of 401. The rule now is the one the tray and the lit tag already follow in
// this file — the filter lives exactly as long as the row that is its control.
//
// Every assertion here is a MEASUREMENT off the rendered list, because the
// three failures look identical in source: a filter that never ran, a row
// hidden by CSS, and a list that happens to be short. The order is checked
// against the stub's own timestamps rather than the page's arithmetic read
// back to itself.
//
//   npm install playwright-core --no-save && node scripts/test-chats-account-default.js
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
const iso = (ms) => new Date(ms).toISOString();

// INTERLEAVED ON PURPOSE. The accounts alternate down the list, so an account
// filter cannot hide behind a run of one account's chats looking like recency,
// and "chronological" has something to actually be wrong about.
const ORDER = ['one-a', 'two-a', 'three-a', 'one-b', 'two-b', 'three-b', 'untagged'];
const ACCT = { 'one-a': '1', 'two-a': '2', 'three-a': '3', 'one-b': '1', 'two-b': '2', 'three-b': '3' };
const MSGS = ORDER.map((n, i) => ({
  id: 'm' + i, chat: n, from: 'claude', text: 'x', tldr: 'x',
  created: iso(T0 - i * 60000), postedAt: iso(T0 - i * 60000),
}));
const CHATS = {};
ORDER.forEach((n) => {
  CHATS[n] = {};
  if (ACCT[n]) CHATS[n].account = ACCT[n];
  CHATS[n].lastSeen = MSGS.find((m) => m.chat === n).created;
});
// one parked chat per account, so the hidden pile can be measured too
['one-hid', 'two-hid', 'three-hid'].forEach((n, i) => {
  CHATS[n] = { account: String(i + 1), hiddenAt: iso(T0), lastSeen: iso(T0 - 500000) };
  MSGS.push({ id: 'h' + i, chat: n, from: 'claude', text: 'y', tldr: 'y',
    created: iso(T0 - 500000), postedAt: iso(T0 - 500000) });
});

// THE APP IS SIGNED INTO ACCOUNT 2 — her real setting the day this was
// written, and the one that made the bug visible: account 2 is where the
// FEWEST of her recent chats live.
const APP_ACCOUNT = '2';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/tritoggle.css' || url.pathname === '/tritoggle.js') {
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, url.pathname.slice(1))));
  }
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1', chats: CHATS, settings: { appAccount: APP_ACCOUNT },
      truncated: [], messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, todos: [], bookmarks: [] }));
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const listed = (page) => page.$$eval('#grid > .clist .crow[data-chat]', (ns) => ns.map((n) => n.dataset.chat));
const hiddenRows = (page) => page.$$eval('#grid .hidelist .crow[data-chat]', (ns) => ns.map((n) => n.dataset.chat));
const shown = (page, sel) => page.$eval(sel, (n) => {
  if (n.hidden) return false;
  const s = getComputedStyle(n);
  return s.display !== 'none' && s.visibility !== 'hidden' && n.getBoundingClientRect().width > 0;
}).catch(() => false);

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + '/chats');
  await page.waitForSelector('#grid .crow[data-chat]');

  // 1. THE DEFAULT SCREEN — nothing tapped, no stored preference. The three
  //    lists are up, the account row is not, and the list is every account's.
  if (!await shown(page, '#listrow')) fail('the three lists are not the default row');
  if (await shown(page, '#accrow')) fail('the account row is on screen by default — this test assumes it is not');
  let rows = await listed(page);
  if (rows.join(',') !== ORDER.join(',')) {
    fail('the default list is not every chat newest-first: ' + rows.join(',') + '\n  wanted: ' + ORDER.join(','));
  }
  // …and it is really CHRONOLOGICAL, read off the stub's own timestamps
  const times = rows.map((n) => Date.parse(CHATS[n].lastSeen));
  for (let i = 1; i < times.length; i++) {
    if (times[i] > times[i - 1]) fail('the list is out of order at row ' + i + ' (' + rows[i] + ')');
  }
  // …and it really is more than one account (the thing that was hidden)
  const accts = new Set(rows.map((n) => ACCT[n]).filter(Boolean));
  if (accts.size !== 3) fail('the default list is still one account: saw ' + [...accts].join(','));

  // 2. NOTHING IS LOST BUT THE HIDING — every row still carries its account
  //    digit, so a merged list still says which account a chat ran on.
  const digits = await page.$$eval('#grid > .clist .crow[data-chat]',
    (ns) => ns.map((n) => [n.dataset.chat, (n.querySelector('.cr-acct') || {}).textContent || '']));
  for (const [name, d] of digits) {
    if ((ACCT[name] || '') !== d.trim()) fail('row ' + name + ' shows account "' + d.trim() + '", wanted "' + (ACCT[name] || '') + '"');
  }
  // and the digit is actually VISIBLE, not a zero-width span
  const digitW = await page.$eval('#grid > .clist .crow[data-chat] .cr-acct',
    (n) => n.getBoundingClientRect().width);
  if (!(digitW > 4)) fail('the account digit is not visible on a row (width ' + digitW + ')');

  // 3. THE HIDDEN PILE FOLLOWS THE SAME RULE — a bar that counts one account
  //    while the list under it counts three is the drift this closes.
  await page.click('#grid .hidebar');
  let hid = await hiddenRows(page);
  if (hid.length !== 3) fail('the hidden pile is still account-filtered: ' + hid.join(','));
  await page.click('#grid .hidebar');

  // 4. THE ROW IS THE CONTROL. Tapping #rowtog brings the account tabs back
  //    AND the filter with them — that is what the row is for.
  await page.click('#rowtog');
  if (!await shown(page, '#accrow')) fail('#rowtog did not bring the account row back');
  if (await shown(page, '#listrow')) fail('both rows are on screen at once');
  rows = await listed(page);
  const want2 = ORDER.filter((n) => !ACCT[n] || ACCT[n] === APP_ACCOUNT);
  if (rows.join(',') !== want2.join(',')) {
    fail('with the row up the list is not the app account: ' + rows.join(',') + '\n  wanted: ' + want2.join(','));
  }
  const on = await page.$eval('#accrow', (n) => n.dataset.on);
  if (on !== APP_ACCOUNT) fail('the lit tab is not the app account: ' + on);

  // 4b. and a tab of her own still narrows to that account
  await page.$$eval('#accrow .acctab', (ns) => ns.find((n) => n.dataset.acct === '3').click());
  rows = await listed(page);
  if (rows.join(',') !== ORDER.filter((n) => !ACCT[n] || ACCT[n] === '3').join(',')) {
    fail('tapping account 3 did not narrow the list: ' + rows.join(','));
  }

  // 5. AND BACK. Flipping to the lists takes the filter off with the row —
  //    including the account she had tapped, which would otherwise be a
  //    filter with no control left on screen.
  await page.click('#rowtog');
  if (await shown(page, '#accrow')) fail('the account row did not go away again');
  rows = await listed(page);
  if (rows.join(',') !== ORDER.join(',')) {
    fail('the list did not widen back out: ' + rows.join(','));
  }

  // 6. AN EMPTY STATE NEVER NAMES A FILTER THAT IS NOT APPLIED. Nothing in
  //    this fixture is starred, so the ★ pile is the empty screen — and its
  //    words must not blame an account while the account row is off.
  await page.click('#catrow .starchip');
  await page.waitForSelector('#grid .state', { timeout: 4000 }).catch(() => {});
  let state = await page.$eval('#grid .state', (n) => n.textContent).catch(() => '');
  if (!state) fail('the star pile did not render an empty state; grid was: '
    + (await page.$eval('#grid', (n) => n.innerHTML.slice(0, 200))));
  if (/on account/.test(state)) {
    fail('the empty state blames an account while the account row is off: ' + state);
  }
  //    …and it DOES name the account once the row is back, because then the
  //    filter is real and "they are on another tab" is the true answer.
  await page.click('#rowtog');
  await page.$$eval('#accrow .acctab', (ns) => ns.find((n) => n.dataset.acct === '2').click());
  state = await page.$eval('#grid .state', (n) => n.textContent).catch(() => '');
  if (!/on account 2/.test(state)) {
    fail('with the account row up the empty state does not say which account: ' + state);
  }
  await page.click('#rowtog');
  await page.click('#catrow .starchip');

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('PASS: the chat list defaults to every account, newest first');
})().catch((e) => { console.error(e); process.exit(1); });
