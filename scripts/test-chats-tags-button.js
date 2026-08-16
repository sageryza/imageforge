#!/usr/bin/env node
// THE CATEGORY CHIPS FOLD AWAY BEHIND ONE WORD (Aug 2026, Sophie: "take the
// categories — like just for fun, stories, pretty much all of them — off that
// page, just have a button that says tags and then once I click it that's when
// it shows all the categories").
//
// Drives the REAL public/chats.html headless against a stub API and asserts:
//   1. the row starts SHUT — the ★ chip and a button reading TAGS, and not one
//      folder chip beside them,
//   2. TAGS carries the SUM of the folders' red unread numbers while they are
//      away, so filing a chat can never make its reply silent,
//   3. tapping it shows every folder, and the sum comes off TAGS (the per-chip
//      numbers say it better once they are on screen),
//   4. tapping it again puts them away,
//   5. CLOSING CLEARS A LIT FOLDER — the list is back to everything, never a
//      filter with nothing on screen saying it is on,
//   6. the UPDATE screen still owns this row with its own boxes — no TAGS
//      button there,
//   7. select mode's own filing chips are untouched: every folder is there to
//      file into whether or not the row above is open.
//
//   npm install playwright-core --no-save && node scripts/test-chats-tags-button.js
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
const HOUR = 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();

// Three filed chats that have all answered her and none of which she has
// opened — so Stories carries 2, Tech carries 1, and TAGS has to say 3 while
// they are folded away. `unfiled` is the one chat left on the main list.
const MSGS = [
  { id: 'm1', chat: 'alpha', from: 'claude', text: 'a', tldr: 'a', created: iso(T0 - 4 * HOUR), postedAt: iso(T0 - 4 * HOUR) },
  { id: 'm2', chat: 'beta', from: 'claude', text: 'b', tldr: 'b', created: iso(T0 - 3 * HOUR), postedAt: iso(T0 - 3 * HOUR) },
  { id: 'm3', chat: 'gamma', from: 'claude', text: 'g', tldr: 'g', created: iso(T0 - 2 * HOUR), postedAt: iso(T0 - 2 * HOUR) },
  { id: 'm4', chat: 'unfiled', from: 'claude', text: 'u', tldr: 'u', created: iso(T0 - HOUR), postedAt: iso(T0 - HOUR) },
];
// filedAt AFTER each chat's newest message, or the chat pops back onto the
// main list (chatBack) and this test would be measuring that instead.
const FILED = iso(T0 - 60000);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1',
      chats: {
        alpha: { category: 'stories', filedAt: FILED },
        beta: { category: 'stories', filedAt: FILED },
        gamma: { category: 'tech', filedAt: FILED },
        unfiled: {},
      },
      settings: {}, truncated: [],
      messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({}));
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const listed = (page) => page.$$eval('#grid > .clist .crow[data-chat]', (ns) => ns.map((n) => n.dataset.chat));
const folders = (page) => page.$$eval('#catrow .catchip:not(.starchip):not(.tagsbtn)',
  (ns) => ns.map((n) => n.firstChild.textContent.trim()));
const tagsBadge = (page) => page.$eval('#catrow .tagsbtn',
  (n) => (n.querySelector('.cc-new') || {}).textContent || '');
const clickFolder = (page, label) => page.$$eval('#catrow .catchip',
  (ns, l) => { ns.find((n) => n.firstChild && n.firstChild.textContent.trim() === l).click(); }, label);

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage();

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="unfiled"]');

  // 1. shut on arrival — one ★ and one word
  const shutFolders = await folders(page);
  if (shutFolders.length) fail('the folders were on screen before TAGS was tapped: ' + shutFolders.join(','));
  const label = await page.$eval('#catrow .tagsbtn', (n) => n.firstChild.textContent.trim());
  if (label !== 'Tags') fail('the button does not say Tags: ' + label);

  // 2. the sum rides on TAGS while they are away
  if (await tagsBadge(page) !== '3') fail('TAGS did not carry the folders\' unread sum: ' + await tagsBadge(page));

  // 3. one tap opens all of them, and the sum comes off
  await page.click('#catrow .tagsbtn');
  const open = await folders(page);
  if (JSON.stringify(open) !== JSON.stringify(['Stories', 'Tech'])) fail('opening TAGS did not show the folders: ' + open.join(','));
  if (await tagsBadge(page) !== '') fail('the sum stayed on TAGS with the folders open');
  const perChip = await page.$$eval('#catrow .catchip:not(.starchip):not(.tagsbtn)',
    (ns) => ns.map((n) => n.firstChild.textContent.trim() + ':' + ((n.querySelector('.cc-new') || {}).textContent || '')));
  if (JSON.stringify(perChip) !== JSON.stringify(['Stories:2', 'Tech:1'])) fail('the per-folder numbers are wrong: ' + perChip.join(','));

  // 4. and one tap puts them away again
  await page.click('#catrow .tagsbtn');
  if ((await folders(page)).length) fail('tapping TAGS again did not fold the folders away');

  // 5. closing on a LIT folder clears the filter — never a filter she cannot see
  await page.click('#catrow .tagsbtn');
  await clickFolder(page, 'Stories');
  let rows = await listed(page);
  if (JSON.stringify(rows.slice().sort()) !== JSON.stringify(['alpha', 'beta'])) fail('the Stories folder did not filter the list: ' + rows.join(','));
  await page.click('#catrow .tagsbtn');
  if ((await folders(page)).length) fail('closing on a lit folder left the row open');
  rows = await listed(page);
  if (JSON.stringify(rows) !== JSON.stringify(['unfiled'])) fail('closing TAGS left a silent filter behind: ' + rows.join(','));

  // 6. the UPDATE screen owns this row with its own boxes — no TAGS there
  await page.click('#accrow .acctab[data-acct="new"]');
  await page.waitForFunction(() => !document.querySelector('#catrow .tagsbtn'), null, { timeout: 4000 })
    .catch(() => fail('TAGS is on the UPDATE screen, which has its own boxes'));
  await page.click('#accrow .acctab[data-acct="new"]');
  await page.waitForSelector('#catrow .tagsbtn');

  // 7. select mode files into every folder whether the row above is open or not
  if ((await folders(page)).length) fail('the row should be shut going into select mode');
  await page.click('#selbtn');
  await page.waitForSelector('#selbar', { timeout: 4000 }).catch(() => fail('select mode never opened its bar'));
  const selChips = await page.$$eval('#selbar .catchip', (ns) => ns.map((n) => n.textContent.trim()));
  ['Stories', 'Tech'].forEach((f) => {
    if (selChips.indexOf(f) < 0) fail('select mode lost the ' + f + ' chip: ' + selChips.join(','));
  });

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures' : 'OK: the folders fold behind TAGS, the sum rides on it, and closing never hides a live filter');
})().catch((e) => { console.error(e); process.exit(1); });
