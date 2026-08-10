#!/usr/bin/env node
// ACCOUNT 1 / ACCOUNT 2 tabs on the /chats home (Aug 2026, Sophie: "look at
// the Secretly a Witch app and see the pattern for where it says reviews
// versus description, then follow that same pattern for account 1 and
// account 2 so that on the main page of the chats app I can only see one
// account at a time").
// Drives the REAL public/chats.html headless against a stub API and asserts:
//   1. the tabs exist as the witch sheet's shape — two half-width labels over
//      a hairline — sitting directly ABOVE the hidden bar (Sophie moved them
//      down there), with a gray line closing the hidden block off below,
//   2. the home shows ONE account: tapping a tab swaps which chats are listed,
//      and the lit tab + sliding line say which one she is in,
//   3. an UNTAGGED chat shows on BOTH tabs (it can never fall off the screen),
//   4. the filter reaches the HIDDEN pile, the ★ pile and the ARCHIVE too,
//   5. the tabs default to the app account and follow the App/Web switch,
//   6. the red badge counts chats in THAT account that answered her — so the
//      tab she is not on can still say there is something waiting,
//   7. the tabs are gone in To do / Bookmarks (not lists of chats) and the
//      masthead rule comes back there,
//   8. BOTH tabs are really tappable at 375/390/430 — they sit inside the
//      autoscroll pill's y 14-192 band, so this hit-tests with
//      elementFromPoint rather than trusting the padding number.
//
//   npm install playwright-core --no-save && node scripts/test-chats-accounts.js
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

// one chat per case: two on account 1, two on account 2, one untagged, plus a
// hidden / a starred / an archived one so the piles can be checked too
const MSGS = [
  { id: 'm1', chat: 'one-a', from: 'claude', text: 'a', tldr: 'a', created: iso(T0 - 1000), postedAt: iso(T0 - 1000) },
  { id: 'm2', chat: 'one-b', from: 'claude', text: 'b', tldr: 'b', created: iso(T0 - 2000), postedAt: iso(T0 - 2000) },
  { id: 'm3', chat: 'two-a', from: 'claude', text: 'c', tldr: 'c', created: iso(T0 - 3000), postedAt: iso(T0 - 3000) },
  { id: 'm4', chat: 'two-b', from: 'claude', text: 'd', tldr: 'd', created: iso(T0 - 4000), postedAt: iso(T0 - 4000) },
  { id: 'm5', chat: 'untagged', from: 'claude', text: 'e', tldr: 'e', created: iso(T0 - 5000), postedAt: iso(T0 - 5000) },
  { id: 'm6', chat: 'one-hid', from: 'claude', text: 'f', tldr: 'f', created: iso(T0 - 6000), postedAt: iso(T0 - 6000) },
  { id: 'm7', chat: 'two-hid', from: 'claude', text: 'g', tldr: 'g', created: iso(T0 - 7000), postedAt: iso(T0 - 7000) },
  { id: 'm8', chat: 'one-arch', from: 'claude', text: 'h', tldr: 'h', created: iso(T0 - 8000), postedAt: iso(T0 - 8000) },
  { id: 'm9', chat: 'two-arch', from: 'claude', text: 'i', tldr: 'i', created: iso(T0 - 9000), postedAt: iso(T0 - 9000) },
  { id: 'm10', chat: 'one-star', from: 'claude', text: 'j', tldr: 'j', created: iso(T0 - 10000), postedAt: iso(T0 - 10000) },
  { id: 'm11', chat: 'two-star', from: 'claude', text: 'k', tldr: 'k', created: iso(T0 - 11000), postedAt: iso(T0 - 11000) },
];
const CHATS = {
  'one-a': { account: '1' },
  'one-b': { account: '1' },
  'two-a': { account: '2' },
  'two-b': { account: '2' },
  'untagged': {},
  'one-hid': { account: '1', hiddenAt: iso(T0) },
  'two-hid': { account: '2', hiddenAt: iso(T0) },
  'one-arch': { account: '1', archived: true },
  'two-arch': { account: '2', archived: true },
  'one-star': { account: '1', starred: true },
  'two-star': { account: '2', starred: true },
};
Object.keys(CHATS).forEach((n) => {
  CHATS[n].lastSeen = (MSGS.find((m) => m.chat === n) || {}).created;
});
const acctPosts = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1', chats: CHATS, settings: { appAccount: '1' },
      truncated: [], messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/api/chatfeed/app-account' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      acctPosts.push(JSON.parse(body || '{}'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, todos: [], bookmarks: [] }));
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
// the MAIN list only — the hidden pile renders its own .clist inside .hidelist
const listed = (page) => page.$$eval('#grid > .clist .crow[data-chat]', (ns) => ns.map((n) => n.dataset.chat));
const hiddenRows = (page) => page.$$eval('#grid .hidelist .crow[data-chat]', (ns) => ns.map((n) => n.dataset.chat));
const same = (a, b) => JSON.stringify(a.slice().sort()) === JSON.stringify(b.slice().sort());

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="one-a"]');

  // 1. the witch sheet's shape, in its place: two labels over a hairline,
  //    sitting directly above the hidden bar (Sophie, Aug 2026 — it shipped
  //    under the masthead and she moved it down to the list it governs)
  // (the row grew a third tab in Aug 2026 — NEW, the notifications view; it
  // is not an account, so everything below still asks about the first two)
  const tabs = await page.$$eval('#accrow .acctab', (ns) => ns.map((n) => n.textContent.trim()));
  if (tabs.length !== 3) fail('expected two account tabs + New, got ' + tabs.length);
  if (!/^Account 1/.test(tabs[0]) || !/^Account 2/.test(tabs[1])) fail('tab labels wrong: ' + tabs.join(' | '));
  if (!/^New/.test(tabs[2] || '')) fail('third tab is not New: ' + tabs[2]);
  if (await page.$eval('#accrow', (n) => getComputedStyle(n).borderBottomStyle === 'none')) {
    fail('the tab row has no hairline of its own');
  }
  const order = await page.evaluate(() => {
    const y = (s) => { const n = document.querySelector(s); return n ? n.getBoundingClientRect().top : null; };
    return { search: y('.searchrow'), tabs: y('#accrow'), bar: y('#grid .hidebar'), row: y('#grid > .clist .crow') };
  });
  if (!(order.search < order.tabs && order.tabs < order.bar)) {
    fail('the tabs are not between the search row and the hidden bar: ' + JSON.stringify(order));
  }

  // 1b. a gray line closes the hidden block off from the first chat, and it
  //     is BETWEEN them — the pile shut, so it follows the bar
  const sep = await page.evaluate(() => {
    const n = document.querySelector('#grid .hbsep');
    if (!n) return null;
    const prev = n.previousElementSibling, next = n.nextElementSibling;
    return { top: n.getBoundingClientRect().top, prev: prev && prev.className, next: next && next.className };
  });
  if (!sep) fail('no gray line under the hidden bar');
  else {
    if (!/hidebar/.test(sep.prev || '')) fail('the gray line does not follow the hidden bar: ' + sep.prev);
    if (!(sep.top > order.bar && sep.top < order.row)) fail('the gray line is not between the bar and the first chat');
  }
  // …and when the pile is OPEN it closes the WHOLE block, with no doubled
  // line against the last hidden row's own border
  await page.click('#grid .hidebar');
  const openSep = await page.evaluate(() => {
    const n = document.querySelector('#grid .hbsep');
    const last = document.querySelector('#grid .hidelist .clist .crow:last-child');
    return {
      prev: n && n.previousElementSibling && n.previousElementSibling.className,
      lastBorder: last && getComputedStyle(last).borderBottomWidth,
    };
  });
  if (!/hidelist/.test(openSep.prev || '')) fail('with the pile open the line does not follow it: ' + openSep.prev);
  if (openSep.lastBorder !== '0px') fail('the last hidden row still draws a border under the line: ' + openSep.lastBorder);
  await page.click('#grid .hidebar');

  // 2. ONE account on screen, and the tabs say which — plus 3. the untagged
  //    chat rides on BOTH tabs so it can never fall off the screen
  let rows = await listed(page);
  if (!same(rows, ['one-a', 'one-b', 'untagged', 'one-star'])) fail('account 1 list wrong: ' + rows.join(','));
  let on = await page.$eval('#accrow', (n) => n.dataset.on);
  if (on !== '1') fail('tab row did not mark account 1 (the app account) as the one showing');

  await page.$$eval('#accrow .acctab', (ns) => ns.find((n) => n.dataset.acct === '2').click());
  rows = await listed(page);
  if (!same(rows, ['two-a', 'two-b', 'untagged', 'two-star'])) fail('account 2 list wrong: ' + rows.join(','));
  on = await page.$eval('#accrow', (n) => n.dataset.on);
  if (on !== '2') fail('the sliding line did not move to account 2');
  const lit = await page.$$eval('#accrow .acctab.on', (ns) => ns.map((n) => n.dataset.acct));
  if (lit.length !== 1 || lit[0] !== '2') fail('exactly one tab must read as lit, got: ' + lit.join(','));

  // 4a. the HIDDEN pile is narrowed too — a bar counting the other account's
  //     parked chats is noise
  await page.click('#grid .hidebar');
  let hid = await hiddenRows(page);
  if (!same(hid, ['two-hid'])) fail('hidden pile not narrowed to the account: ' + hid.join(','));
  await page.click('#grid .hidebar');

  // 4b. the ARCHIVE view
  await page.click('#archlink');
  rows = await listed(page);
  if (!same(rows, ['two-arch'])) fail('archive not narrowed to the account: ' + rows.join(','));
  await page.click('#archlink');

  // 4c. the ★ pile (which reaches into the archive, so it must still narrow)
  await page.click('#catrow .starchip');
  rows = await listed(page);
  if (!same(rows, ['two-star'])) fail('star pile not narrowed to the account: ' + rows.join(','));
  await page.click('#catrow .starchip');

  // 5. the tabs default to the app account, and the App/Web switch moves them
  //    (that switch is what "which account am I signed into" means)
  await page.evaluate(() => window.__setAcct(''));
  rows = await listed(page);
  if (!same(rows, ['one-a', 'one-b', 'untagged', 'one-star'])) fail('the default tab is not the app account: ' + rows.join(','));
  await page.click('#acctog');
  await page.waitForFunction(() => document.getElementById('accrow').dataset.on === '2', null, { timeout: 4000 })
    .catch(() => fail('flipping the App/Web switch did not move the account tabs'));
  rows = await listed(page);
  if (!same(rows, ['two-a', 'two-b', 'untagged', 'two-star'])) fail('switch flip did not re-list: ' + rows.join(','));
  if (!acctPosts.length) fail('the App/Web switch stopped POSTing /app-account');
  await page.click('#acctog');
  await page.evaluate(() => window.__setAcct(''));

  // 6. the red badge counts chats in THAT account that answered her, so the
  //    tab she is not on is never silent. Nothing has been opened, so every
  //    non-archived chat counts: account 1 = one-a, one-b, one-hid, one-star,
  //    untagged (5); account 2 = two-a, two-b, two-hid, two-star, untagged (5).
  const badges = await page.$$eval('#accrow .acctab',
    (ns) => ns.map((n) => (n.querySelector('.cc-new') || {}).textContent || ''));
  if (badges[0] !== '5' || badges[1] !== '5') fail('tab badges wrong: ' + JSON.stringify(badges));

  // 7. gone where the list is not chats — and the masthead rule comes back
  for (const [btn, what] of [['#todolink', 'To do'], ['#bmklink', 'Bookmarks']]) {
    await page.click(btn);
    if (await page.$eval('#accrow', (n) => getComputedStyle(n).display !== 'none')) {
      fail('the account tabs are still up in ' + what);
    }
    if (await page.$eval('.rule', (n) => getComputedStyle(n).display === 'none')) {
      fail('the masthead rule did not come back in ' + what);
    }
    await page.click(btn);
  }
  if (await page.$eval('#accrow', (n) => getComputedStyle(n).display === 'none')) {
    fail('the account tabs did not come back on the chat list');
  }

  // 8. BOTH tabs must really be tappable: this row sits inside the autoscroll
  //    pill's y 14-192 band, so a missing corner reserve buries the right-hand
  //    one exactly the way it buried the to-do list's Add button. Hit-test the
  //    real centre of each tab rather than trusting the padding number.
  for (const width of [375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const buried = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('#accrow .acctab').forEach((b) => {
        const r = b.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!hit || !hit.closest('.acctab')) out.push(b.dataset.acct);
      });
      return out;
    });
    if (buried.length) fail('account tab(s) ' + buried.join(',') + ' untappable at ' + width + 'px');
  }

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('PASS: account tabs — one account at a time, both tappable');
})().catch((e) => { console.error(e); process.exit(1); });
