#!/usr/bin/env node
// COME BACK TO IS ONE BUCKET (Aug 2026, Sophie: "can you combine the come back
// to and later categories" — confirmed as the chat-list FOLDER and the UPDATE
// screen's BOX, which meant the same thing under two names).
//
// One word and one pile, deliberately NOT one field: `category` files a chat
// forever, `newsQueue` files one update until something newer lands, and
// folding either into the other loses something real (see the comment block in
// chats.html).
//
// Drives the REAL public/chats.html headless against a stub API and asserts:
//   1. the UPDATE screen's left box reads COME BACK TO, not Later,
//   2. filing from it still POSTs the STORED value `later` — the rename is a
//      word, not a migration, so nothing older breaks,
//   3. the chat list's COME BACK TO folder holds BOTH: the chats filed into
//      the folder AND the chats sitting in that box,
//   4. its red unread number counts both too,
//   5. a chat whose card has been SUPERSEDED (it delivered something newer
//      than the moment she boxed it) is out of the pile again — the box's own
//      auto-return rule, which the folder must not contradict,
//   6. a chat deferred on the Update screen STILL SHOWS on the main list:
//      deferring one update is not filing the whole chat away,
//   7. no other folder picked up strays from the box.
//
//   npm install playwright-core --no-save && node scripts/test-chats-come-back-to.js
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
const H = 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();

// filed      — in the FOLDER (category), the old way
// boxed      — in the BOX (newsQueue), deferred from the Update screen
// superseded — was boxed, but delivered something newer since, so its card
//              came back out on its own and it must be out of the pile too
// plain      — neither, and the control for "nothing leaked"
const MSGS = [
  { id: 'm1', chat: 'filed', from: 'claude', text: 'f', tldr: 'f', created: iso(T0 - 5 * H), postedAt: iso(T0 - 5 * H) },
  { id: 'm2', chat: 'boxed', from: 'claude', text: 'b', tldr: 'b', created: iso(T0 - 4 * H), postedAt: iso(T0 - 4 * H) },
  { id: 'm3', chat: 'superseded', from: 'claude', text: 's', tldr: 's', created: iso(T0 - 30000), postedAt: iso(T0 - 30000) },
  { id: 'm4', chat: 'plain', from: 'claude', text: 'p', tldr: 'p', created: iso(T0 - 3 * H), postedAt: iso(T0 - 3 * H) },
];
const posts = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1',
      chats: {
        // filedAt after its own message, or the chat pops back onto the main
        // list and this test measures chatBack instead of the folder.
        filed: { category: 'come back to', filedAt: iso(T0 - 60000) },
        boxed: { newsQueue: 'later', newsQueuedAt: iso(T0 - 2 * H) },
        // boxed 3h ago, delivered 30s ago → newer than the boxing, so out
        superseded: { newsQueue: 'later', newsQueuedAt: iso(T0 - 3 * H) },
        plain: {},
      },
      settings: { categories: ['come back to', 'stories'] }, truncated: [],
      messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/api/chatfeed/news-queue' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      posts.push(JSON.parse(body || '{}'));
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
  res.end(JSON.stringify({}));
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const listed = (page) => page.$$eval('#grid > .clist .crow[data-chat]', (ns) => ns.map((n) => n.dataset.chat).sort());
const openTags = async (page) => {
  await page.waitForSelector('#catrow .tagsbtn');
  if (!(await page.$('#catrow .tagsbtn.on'))) await page.click('#catrow .tagsbtn');
  // Category words live behind SEE MORE now (Aug 2026) — unfold them too.
  if (await page.$('#catrow .morechip')) await page.click('#catrow .morechip');
};
const chipText = (page, label) => page.$$eval('#catrow .catchip',
  (ns, l) => (ns.find((n) => n.firstChild && n.firstChild.textContent.trim() === l) || {}).textContent || '', label);
const clickChip = (page, label) => page.$$eval('#catrow .catchip',
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
  await page.waitForSelector('#grid [data-chat="plain"]');

  // 6. the boxed chat is still on the main list — deferring one update is not
  //    filing the whole chat away. `filed` is in a folder, so it is not.
  const rows = await listed(page);
  if (rows.indexOf('boxed') < 0) fail('a chat deferred on the Update screen fell off the main list: ' + rows.join(','));
  if (rows.indexOf('filed') >= 0) fail('a chat filed in the folder is still on the main list: ' + rows.join(','));

  // 3 + 4. the folder holds the filed one AND the boxed one, and its red
  //        number counts both (neither has been opened). `superseded` is out.
  await openTags(page);
  const txt = await chipText(page, 'Come back to');
  if (!txt) fail('no Come back to chip on the row');
  if (!/2$/.test(txt.replace(/\s+/g, ''))) fail('the folder did not badge both the filed and the boxed chat: "' + txt + '"');
  await clickChip(page, 'Come back to');
  const pile = await listed(page);
  if (JSON.stringify(pile) !== JSON.stringify(['boxed', 'filed'])) fail('the merged pile is wrong: ' + pile.join(','));
  // 5. spelled out: the superseded one is deliberately absent
  if (pile.indexOf('superseded') >= 0) fail('a chat whose card came back out of the box is still in the folder');
  // 7. and nothing leaked into another folder
  await clickChip(page, 'Come back to');
  await clickChip(page, 'Stories');
  if (await page.$('#grid > .clist')) fail('Stories picked up a chat from the Come back to box');
  await clickChip(page, 'Stories');

  // 1 + 2. the Update screen's left box reads COME BACK TO, and files `later`
  await page.click('#accrow .acctab[data-acct="new"]');
  await page.waitForFunction(() => !!document.querySelector('#catrow .catchip'), null, { timeout: 4000 })
    .catch(() => fail('the UPDATE view drew no boxes'));
  const boxes = await page.$$eval('#catrow .catchip', (ns) => ns.map((n) => n.textContent.trim()));
  if (!/^Come back to/.test(boxes[0] || '')) fail('the left box is not COME BACK TO: ' + boxes.join(' | '));
  if (boxes.some((t) => /^Later/.test(t))) fail('the old LATER label is still on the row: ' + boxes.join(' | '));
  await page.click('.nwcard[data-chat="plain"] .nwck')
    .catch(() => fail('no card for `plain` to file on the Update screen'));
  await page.$$eval('#catrow .catchip',
    (ns) => { ns.find((n) => /^Come back to/.test(n.textContent.trim())).click(); });
  await page.waitForFunction(() => true);
  const post = posts[posts.length - 1];
  if (!post || post.queue !== 'later') fail('the renamed box stopped POSTing the stored value `later`: ' + JSON.stringify(post));

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures' : 'OK: one word on both screens, one pile in the folder, and `later` still the stored value');
})().catch((e) => { console.error(e); process.exit(1); });
