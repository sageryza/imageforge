#!/usr/bin/env node
// THE TAGS ROW: folded behind one word, split into TWO GROUPS, and running the
// FULL WIDTH of the screen (Aug 2026, Sophie — three asks, one row):
//  · "just have a button that says tags and then once I click it that's when
//    it shows all the categories" (the fold, #1273);
//  · "there are two different types of tags — category tags like witch and
//    dream app, and task tags like in progress and come back to … the default
//    view should only show the progress tags, but there can be a see more
//    button that shows the category tags also, and if they're both shown
//    there should be some sort of distinction between them like a small red
//    line or a label";
//  · "the tags are going really far down because they are not allowed to go
//    into the left most part … get rid of the refresh button … make the tags
//    take up the full width but skip where the auto scroll pill is."
//
// Drives the REAL public/chats.html headless against a stub API and asserts:
//   1. the row starts SHUT — ★ and TAGS, no folder chips — and TAGS carries
//      the sum of every folder's red unread number,
//   2. the refresh icon is GONE from the tool row,
//   3. opening TAGS shows ONLY the task words, plus a SEE MORE chip carrying
//      the folded categories' unread sum — no category chip, no divider,
//   4. SEE MORE unfolds the categories under the red CATEGORIES line, and the
//      chip itself goes,
//   5. closing TAGS resets everything: reopening lands back on the task-only
//      default (catsMore is not sticky),
//   6. closing on a LIT category clears the filter — never a hidden filter,
//   7. LAYOUT: chips wrap to the full width (a wrapped line starts at the
//      left edge, under the select icon) and the pill's fixed corner
//      (x 324-374, y 14-192) stays clear while lines below it run past it,
//   8. the UPDATE screen still owns the row with its own boxes — no TAGS —
//      and select mode's filing chips still carry the whole vocabulary.
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

// Three category-filed chats (stories ×2, tech ×1) and one task-filed chat
// (come back to), all answered and none opened — so TAGS shut says 4, the
// task view says 1 on its chip and 3 on SEE MORE.
const MSGS = [
  { id: 'm1', chat: 'alpha', from: 'claude', text: 'a', tldr: 'a', created: iso(T0 - 4 * HOUR), postedAt: iso(T0 - 4 * HOUR) },
  { id: 'm2', chat: 'beta', from: 'claude', text: 'b', tldr: 'b', created: iso(T0 - 3 * HOUR), postedAt: iso(T0 - 3 * HOUR) },
  { id: 'm3', chat: 'gamma', from: 'claude', text: 'g', tldr: 'g', created: iso(T0 - 2 * HOUR), postedAt: iso(T0 - 2 * HOUR) },
  { id: 'm4', chat: 'delta', from: 'claude', text: 'd', tldr: 'd', created: iso(T0 - 90 * 60000), postedAt: iso(T0 - 90 * 60000) },
  { id: 'm5', chat: 'unfiled', from: 'claude', text: 'u', tldr: 'u', created: iso(T0 - HOUR), postedAt: iso(T0 - HOUR) },
];
const FILED = iso(T0 - 60000);
// Enough category words that the open row must wrap several lines at 390px —
// the layout half of the test needs real wrapping to measure.
const EXTRA = ['witch', 'xi', 'just for fun', 'weird games', 'meta', 'dream app', 'chunk making'];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1',
      chats: {
        alpha: { category: 'story', filedAt: FILED },
        beta: { category: 'story', filedAt: FILED },
        gamma: { category: 'tech', filedAt: FILED },
        delta: { category: 'come back to', filedAt: FILED },
        unfiled: {},
      },
      settings: { categories: EXTRA }, truncated: [],
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
const folders = (page) => page.$$eval('#catrow .catchip:not(.starchip):not(.tagsbtn):not(.morechip)',
  (ns) => ns.map((n) => n.firstChild.textContent.trim()));
const badge = (page, sel) => page.$eval(sel, (n) => (n.querySelector('.cc-new') || {}).textContent || '');
const clickFolder = (page, label) => page.$$eval('#catrow .catchip',
  (ns, l) => { ns.find((n) => n.firstChild && n.firstChild.textContent.trim() === l).click(); }, label);

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="unfiled"]');

  // 1. shut on arrival, sum on TAGS
  if ((await folders(page)).length) fail('folder chips on screen before TAGS was tapped');
  if (await badge(page, '#catrow .tagsbtn') !== '4') fail('TAGS did not carry the whole unread sum: ' + await badge(page, '#catrow .tagsbtn'));

  // 2. the refresh icon is gone
  if (await page.$('#toolrow #refresh')) fail('the refresh icon is still in the tool row');

  // 3. open → task words only + SEE MORE with the categories' sum
  await page.click('#catrow .tagsbtn');
  let open = await folders(page);
  if (JSON.stringify(open) !== JSON.stringify(['Come back to'])) fail('the default open view is not the task words alone: ' + open.join(','));
  if (!(await page.$('#catrow .morechip'))) fail('no SEE MORE chip beside the task words');
  if (await badge(page, '#catrow .morechip') !== '3') fail('SEE MORE did not carry the folded categories\' sum: ' + await badge(page, '#catrow .morechip'));
  if (await page.$('#catrow .catdiv')) fail('the CATEGORIES divider is on screen before SEE MORE was tapped');

  // 4. SEE MORE unfolds the categories under the red line
  await page.click('#catrow .morechip');
  const div = await page.$eval('#catrow .catdiv', (n) => n.textContent.trim()).catch(() => '');
  if (!/categories/i.test(div)) fail('no CATEGORIES line between the groups: "' + div + '"');
  open = await folders(page);
  if (open[0] !== 'Come back to') fail('the task group lost its lead spot: ' + open.join(','));
  ['Story', 'Tech', 'Witch', 'Dream app'].forEach((c) => {
    if (open.indexOf(c) < 0) fail('a category is missing after SEE MORE: ' + c);
  });
  if (await page.$('#catrow .morechip')) fail('SEE MORE stayed on the row after opening');
  // the task chip and the category chips carry their own numbers now
  const perChip = await page.$$eval('#catrow .catchip:not(.starchip):not(.tagsbtn)',
    (ns) => ns.filter((n) => n.querySelector('.cc-new'))
      .map((n) => n.firstChild.textContent.trim() + ':' + n.querySelector('.cc-new').textContent));
  if (JSON.stringify(perChip.sort()) !== JSON.stringify(['Come back to:1', 'Story:2', 'Tech:1']))
    fail('the per-chip numbers are wrong: ' + perChip.join(','));

  // 7. LAYOUT, measured while everything is open: full width below the pill's
  //    band, the corner clear inside it, wrapped lines starting at the left.
  const geo = await page.$$eval('#catrow .catchip', (ns) => ns.map((n) => {
    const r = n.getBoundingClientRect();
    return { l: r.left, r: r.right, t: r.top, w: r.width };
  }));
  const rowRight = await page.$eval('#toolrow', (n) => n.getBoundingClientRect().right);
  const below = geo.filter((g) => g.t >= 192);
  if (!below.length) fail('the open row never wrapped below the pill band — the layout half of this test measured nothing');
  // FULL WIDTH means a line only breaks because the next chip truly would not
  // fit the row's whole width — under the old flex layout the boundary sat
  // 64px early on every line. Wrapping is ragged, so the test is on the BREAK,
  // not on where the last chip happens to end.
  const lines = [];
  below.forEach((g) => {
    const ln = lines.find((x) => Math.abs(x.top - g.t) < 4);
    if (ln) { ln.right = Math.max(ln.right, g.r); ln.chips.push(g); }
    else lines.push({ top: g.t, right: g.r, chips: [g] });
  });
  lines.sort((x, y) => x.top - y.top);
  let honest = 0;
  for (let i = 0; i + 1 < lines.length; i++) {
    const first = lines[i + 1].chips.slice().sort((a, b) => a.l - b.l)[0];
    if (lines[i].right + 6 + first.w > rowRight - 2) honest++;
    else fail('a line below the pill band broke early: ends at ' + lines[i].right + ' with room to ' + rowRight + ' for a ' + first.w + 'px chip');
  }
  if (!honest) fail('never saw a genuine full-width line break below the pill band');
  if (Math.min.apply(null, geo.map((g) => g.l)) > 60) fail('no wrapped line starts at the left edge — the chips are still penned right of the icons');
  const inBand = geo.filter((g) => g.t < 192);
  inBand.forEach((g) => { if (g.r > 328) fail('a chip inside the pill band runs under the pill (right ' + g.r + ', top ' + g.t + ')'); });

  // 5. closing resets to the default; 6. and clears a lit category
  await clickFolder(page, 'Story');
  let rows = await listed(page);
  if (JSON.stringify(rows.slice().sort()) !== JSON.stringify(['alpha', 'beta'])) fail('the Story folder did not filter the list: ' + rows.join(','));
  await page.click('#catrow .tagsbtn');
  if ((await folders(page)).length) fail('closing on a lit folder left the row open');
  rows = await listed(page);
  if (rows.indexOf('unfiled') < 0 || rows.indexOf('alpha') >= 0) fail('closing TAGS left a silent filter behind: ' + rows.join(','));
  await page.click('#catrow .tagsbtn');
  if ((await folders(page)).some((c) => c === 'Story')) fail('SEE MORE state survived the close — reopening must land on the task-only default');
  if (!(await page.$('#catrow .morechip'))) fail('SEE MORE missing after a reopen');
  await page.click('#catrow .tagsbtn');

  // 8. the UPDATE row keeps its own boxes, select mode keeps the vocabulary
  // The row takes turns with the three lists (2026-08-28) and opens on the
  // LISTS, so the account row — the UPDATE tab's own home — is one tap away.
  if (!await page.isVisible('#accrow')) await page.click('#rowtog');
  await page.click('#accrow .acctab[data-acct="new"]');
  await page.waitForFunction(() => !document.querySelector('#catrow .tagsbtn'), null, { timeout: 4000 })
    .catch(() => fail('TAGS is on the UPDATE screen, which has its own boxes'));
  await page.click('#accrow .acctab[data-acct="new"]');
  await page.waitForSelector('#catrow .tagsbtn');
  await page.click('#selbtn');
  await page.waitForSelector('#selbar', { timeout: 4000 }).catch(() => fail('select mode never opened its bar'));
  const selChips = await page.$$eval('#selbar .catchip', (ns) => ns.map((n) => n.textContent.trim()));
  ['Story', 'Tech', 'Come back to', 'Witch'].forEach((f) => {
    if (selChips.indexOf(f) < 0) fail('select mode lost the ' + f + ' chip: ' + selChips.join(','));
  });

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures' : 'OK: task words by default, categories behind SEE MORE under the red line, full-width wrap that skips the pill');
})().catch((e) => { console.error(e); process.exit(1); });
