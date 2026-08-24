#!/usr/bin/env node
// ACCOUNT 1 / 2 / 3 tabs on the /chats home (Aug 2026, Sophie: "look at
// the Secretly a Witch app and see the pattern for where it says reviews
// versus description, then follow that same pattern for account 1 and
// account 2 so that on the main page of the chats app I can only see one
// account at a time").
// A THIRD ACCOUNT ARRIVED (Aug 2026, Sophie: "can you make account three as
// another toggle tab … and maybe just call them 1 2 3 with the numbers rather
// than account so it fits" · "make it a three-way toggle now so there's a
// left, right and middle option"). So this also asserts that nothing here
// counts accounts by hand: the tabs, the header switch and the thread's
// picker are all built from ACCOUNTS, and the tab labels are bare digits.
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
  { id: 'm12', chat: 'three-a', from: 'claude', text: 'l', tldr: 'l', created: iso(T0 - 12000), postedAt: iso(T0 - 12000) },
  { id: 'm13', chat: 'three-hid', from: 'claude', text: 'm', tldr: 'm', created: iso(T0 - 13000), postedAt: iso(T0 - 13000) },
  { id: 'm14', chat: 'three-arch', from: 'claude', text: 'n', tldr: 'n', created: iso(T0 - 14000), postedAt: iso(T0 - 14000) },
  { id: 'm15', chat: 'three-star', from: 'claude', text: 'o', tldr: 'o', created: iso(T0 - 15000), postedAt: iso(T0 - 15000) },
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
  'three-a': { account: '3' },
  'three-hid': { account: '3', hiddenAt: iso(T0) },
  'three-arch': { account: '3', archived: true },
  'three-star': { account: '3', starred: true },
};
Object.keys(CHATS).forEach((n) => {
  CHATS[n].lastSeen = (MSGS.find((m) => m.chat === n) || {}).created;
});
const acctPosts = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  // /tritoggle.css — the shared three-way toggle shell (Aug 2026). The
  // account switch IS one, so a stub that does not serve this renders it as a
  // 4px sliver and every stop reads as the same place.
  if (url.pathname === '/tritoggle.css') {
    res.writeHead(200, { 'Content-Type': 'text/css' });
    return res.end(fs.readFileSync(path.join(__dirname, '..', 'public', 'tritoggle.css')));
  }
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1', chats: CHATS, settings: { appAccount: '1' },
      truncated: [], messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  // /tritoggle.js — the shared AIM rule (2026-08-24). express.static serves it
  // in production; a stub that does not falls back to the old CYCLE and would
  // green-light the very bug this pins.
  if (url.pathname === '/tritoggle.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    return res.end(fs.readFileSync(path.join(__dirname, '..', 'public', 'tritoggle.js')));
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
  // (the row grew a third tab in Aug 2026 — UPDATE, the notifications view,
  // which LEADS the row at her ask; it is not an account, so everything below
  // still asks about the two that are)
  const tabs = await page.$$eval('#accrow .acctab', (ns) => ns.map((n) => n.textContent.trim()));
  if (tabs.length !== 4) fail('expected Update + three account tabs, got ' + tabs.length);
  if (!/^Update/.test(tabs[0] || '')) fail('Update does not lead the row: ' + tabs.join(' | '));
  // BARE DIGITS, not "Account 1" (her ask, so four tabs fit a 390pt phone).
  // The text starts with the digit; a red badge may follow it in the same node.
  if (!/^1/.test(tabs[1]) || !/^2/.test(tabs[2]) || !/^3/.test(tabs[3])) {
    fail('tab labels are not bare digits: ' + tabs.join(' | '));
  }
  if (tabs.slice(1).some((t) => /account/i.test(t))) fail('a tab still says the word Account: ' + tabs.join(' | '));
  // …and the word is not lost — it is what the tab reads out as
  const alabels = await page.$$eval('#accrow .acctab', (ns) => ns.map((n) => n.getAttribute('aria-label') || ''));
  if (!/^Account 1/.test(alabels[1]) || !/^Account 3/.test(alabels[3])) {
    fail('the account tabs lost their spoken label: ' + alabels.join(' | '));
  }
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

  await page.$$eval('#accrow .acctab', (ns) => ns.find((n) => n.dataset.acct === '3').click());
  rows = await listed(page);
  if (!same(rows, ['three-a', 'untagged', 'three-star'])) fail('account 3 list wrong: ' + rows.join(','));
  on = await page.$eval('#accrow', (n) => n.dataset.on);
  if (on !== '3') fail('the sliding line did not move to account 3');
  let lit = await page.$$eval('#accrow .acctab.on', (ns) => ns.map((n) => n.dataset.acct));
  if (lit.length !== 1 || lit[0] !== '3') fail('exactly one tab must read as lit, got: ' + lit.join(','));

  await page.$$eval('#accrow .acctab', (ns) => ns.find((n) => n.dataset.acct === '2').click());
  rows = await listed(page);
  if (!same(rows, ['two-a', 'two-b', 'untagged', 'two-star'])) fail('account 2 list wrong: ' + rows.join(','));
  on = await page.$eval('#accrow', (n) => n.dataset.on);
  if (on !== '2') fail('the sliding line did not move to account 2');
  lit = await page.$$eval('#accrow .acctab.on', (ns) => ns.map((n) => n.dataset.acct));
  if (lit.length !== 1 || lit[0] !== '2') fail('exactly one tab must read as lit, got: ' + lit.join(','));

  // 4a. the HIDDEN pile is narrowed too — a bar counting the other account's
  //     parked chats is noise
  await page.click('#grid .hidebar');
  let hid = await hiddenRows(page);
  if (!same(hid, ['two-hid'])) fail('hidden pile not narrowed to the account: ' + hid.join(','));
  await page.click('#grid .hidebar');

  // 4b. the ARCHIVE is the ONE list of chats the tabs do NOT narrow (Aug 2026,
  //     Sophie: "I noticed there's an update and account one account two tab
  //     in the archive"). It grew its own BUILT / OTHER hairline row, and two
  //     stacked tab rows was one question too many — so the account row is
  //     hidden there, and the filter goes with it rather than becoming a
  //     silent one. Both accounts' archived chats show.
  await page.click('#archlink');
  rows = await listed(page);
  if (!same(rows, ['one-arch', 'two-arch', 'three-arch'])) fail('archive should show EVERY account: ' + rows.join(','));
  const accVisible = await page.evaluate(() => {
    const n = document.getElementById('accrow');
    return !!(n && getComputedStyle(n).display !== 'none');
  });
  if (accVisible) fail('the account row is still showing in the archive');
  // …and never TWO stacked hairline rows, which is the reason the account row
  // is hidden here at all. (It used to be exactly one — the archive's own
  // BUILT / OTHER tabs — but those were replaced by the tag chip row, so zero
  // is the right answer now and the rule is the ceiling, not the count.)
  const tabRows = await page.$$eval('.acctabs', (ns) => ns.filter(
    (n) => getComputedStyle(n).display !== 'none' && n.getBoundingClientRect().width > 0).length);
  if (tabRows > 1) fail('the archive is showing stacked tab rows, saw ' + tabRows);
  await page.click('#archlink');

  // 4c. the ★ pile (which reaches into the archive, so it must still narrow)
  await page.click('#catrow .starchip');
  rows = await listed(page);
  if (!same(rows, ['two-star'])) fail('star pile not narrowed to the account: ' + rows.join(','));
  await page.click('#catrow .starchip');

  // 5. the tabs default to the app account, and the header switch moves them
  //    (that switch is what "which account am I signed into" means). It is a
  //    THREE-POSITION control now (Aug 2026) — one slot per account, the lit
  //    one is the one she is signed in on, and every other account's chats
  //    open on the web.
  await page.evaluate(() => window.__setAcct(''));
  rows = await listed(page);
  if (!same(rows, ['one-a', 'one-b', 'untagged', 'one-star'])) fail('the default tab is not the app account: ' + rows.join(','));
  // It is the SAME iOS switch it always was, with a third notch: one tap moves
  // the knob to the next account and the last one wraps back to the first.
  if (await page.$('#acctog .sw3')) fail('the switch is a row of digit slots again, not the toggle');
  if (await page.$eval('#acctog', (n) => n.tagName) !== 'BUTTON') fail('the switch is not one tappable control');
  if (await page.$eval('#acctog', (n) => n.dataset.a) !== '1') fail('the switch did not start on the app account');
  // the knob really MOVES, and to three distinguishable places — read the
  // rendered transform rather than trusting the CSS
  // (read it AFTER the .18s slide, or every stop reads as the identity matrix
  // it is still transitioning away from)
  // The STOP is `data-n` since the geometry moved into /tritoggle.css (Aug
  // 2026) — zero-based, and shared with the Playground's toggles. `data-a` is
  // still written beside it and is still the account itself, which is what
  // every other read in this file asks for.
  const knob = async (want) => {
    await page.$eval('#acctog', (n, w) => n.setAttribute('data-n', w), want);
    await page.waitForTimeout(260);
    return page.$eval('#acctog', (n) => getComputedStyle(n, '::after').transform);
  };
  const spots = [await knob('0'), await knob('1'), await knob('2')];
  if (new Set(spots).size !== 3) fail('the three notches do not sit apart: ' + spots.join(' | '));
  await page.evaluate(() => document.getElementById('acctog').setAttribute('data-n', '0'));

  // EVERY ACCOUNT IS ONE AIMED TAP, from wherever it is (2026-08-24, Sophie:
  // "none of them should cycle — that's a really stupid pattern"). This used to
  // tap the element's CENTRE three times and read 1 → 2 → 3 → 1 off the cycle,
  // which is the behaviour she retired: it made account 3 two taps from account
  // 1 and gave her no way to say "that one". The order below is deliberately
  // NOT sequential — 3 straight from 1 is the case a cycle cannot do.
  const tapAcct = async (n) => {
    const box = await page.locator('#acctog').boundingBox();
    await page.mouse.click(box.x + box.width * ((n + 0.5) / 3), box.y + box.height / 2);
  };
  for (const [tap, want, rows2] of [
    [1, '3', ['three-a', 'untagged', 'three-star']],
    [2, '2', ['two-a', 'two-b', 'untagged', 'two-star']],
    [3, '1', ['one-a', 'one-b', 'untagged', 'one-star']],
  ]) {
    const before = acctPosts.length;
    await tapAcct(Number(want) - 1);
    await page.waitForFunction((w) => document.getElementById('accrow').dataset.on === w, want, { timeout: 4000 })
      .catch(() => fail('tap ' + tap + ' on the switch did not move the account tabs to ' + want));
    if (await page.$eval('#acctog', (n) => n.dataset.a) !== want) fail('tap ' + tap + ': the knob did not land on ' + want);
    rows = await listed(page);
    if (!same(rows, rows2)) fail('tap ' + tap + ' did not re-list: ' + rows.join(','));
    if (acctPosts.length !== before + 1) fail('tap ' + tap + ' did not POST /app-account once');
    if (acctPosts[acctPosts.length - 1].account !== want) fail('tap ' + tap + ' POSTed the wrong account: ' + JSON.stringify(acctPosts));
  }

  // A TAP ON THE ACCOUNT SHE IS ALREADY ON IS NOT A SWITCH — no POST, no toast.
  {
    const before = acctPosts.length;
    await tapAcct(0);                    // it is already on 1
    await page.waitForTimeout(300);
    if (acctPosts.length !== before) fail('tapping the account it is already on POSTed anyway');
    if (await page.$eval('#acctog', (n) => n.dataset.a) !== '1') fail('…and it moved off the account it was on');
  }

  // …and a chat on an account she is NOT signed into opens on the WEB
  await tapAcct(2);                      // straight to 3, one tap
  await page.waitForFunction(() => document.getElementById('acctog').dataset.a === '3', null, { timeout: 4000 })
    .catch(() => fail('could not get the switch to 3 in one aimed tap'));
  const hrefs = await page.evaluate(() => ({
    live: window.__openHref('three-a', 'https://claude.ai/chat/x'),
    other: window.__openHref('one-a', 'https://claude.ai/chat/x'),
  }));
  if (/no_universal_links/.test(hrefs.live)) fail('the signed-in account was pushed to the web: ' + hrefs.live);
  if (!/no_universal_links/.test(hrefs.other)) fail('a chat on another account did not route to the web: ' + hrefs.other);

  await tapAcct(0);                      // and back to 1, also one tap
  await page.waitForFunction(() => document.getElementById('accrow').dataset.on === '1', null, { timeout: 4000 })
    .catch(() => fail('the switch did not come back to account 1'));
  await page.evaluate(() => window.__setAcct(''));

  // 6. the red badge counts chats in THAT account that answered her, so the
  //    tab she is not on is never silent. Nothing has been opened, so every
  //    non-archived chat counts: account 1 = one-a, one-b, one-hid, one-star,
  //    untagged (5); account 2 = two-a, two-b, two-hid, two-star, untagged (5);
  //    account 3 = three-a, three-hid, three-star, untagged (4).
  //    (badges[0] is UPDATE's own count, which is not account-scoped — see
  //    scripts/test-chats-news.js; the account tabs follow it)
  const badges = await page.$$eval('#accrow .acctab',
    (ns) => ns.map((n) => (n.querySelector('.cc-new') || {}).textContent || ''));
  if (badges[1] !== '5' || badges[2] !== '5' || badges[3] !== '4') fail('account tab badges wrong: ' + JSON.stringify(badges));

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
    // 8b. the header switch grew a notch when the third account arrived, and
    //     the masthead is the one row in this app that has run out of room
    //     before (five controls plus the title put the bookmark button under
    //     the word "Chats" and tapping the title opened Bookmarks). So: the
    //     switch has to stay reachable, and the title must not be sitting
    //     under the controls.
    const swBuried = await page.evaluate(() => {
      const b = document.getElementById('acctog');
      const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !hit || hit.id !== 'acctog';
    });
    if (swBuried) fail('the account switch is untappable at ' + width + 'px');
    // The failure mode is a CONTROL WINNING THE TITLE'S TAP (that is how the
    // trash shipped as a fifth word and tapping "Chats" opened Bookmarks), so
    // ask elementFromPoint rather than compare rectangles — the two boxes have
    // always touched at 375 by a fraction of a pixel.
    const head = await page.evaluate(() => {
      const t = document.getElementById('htxt').getBoundingClientRect();
      const c = document.querySelector('.hctl').getBoundingClientRect();
      const at = (x) => {
        const n = document.elementFromPoint(x, t.top + t.height / 2);
        if (!n) return 'nothing';
        return n.closest('.hctl') ? ('CONTROL:' + (n.id || n.className)) : (n.id || n.className || n.tagName);
      };
      return { w: innerWidth, ctlRight: c.right, mid: at(t.left + t.width / 2), end: at(t.right - 3) };
    });
    for (const [where, hit] of [['middle', head.mid], ['end', head.end]]) {
      if (/^CONTROL:/.test(String(hit))) {
        fail('a header control took the title\'s tap at its ' + where + ' at ' + width + 'px: ' + hit);
      }
    }
    if (head.ctlRight > head.w) fail('the header controls run off the screen at ' + width + 'px: ' + JSON.stringify(head));
  }

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('PASS: account tabs 1·2·3 — one account at a time, all tappable, three-way switch');
})().catch((e) => { console.error(e); process.exit(1); });
