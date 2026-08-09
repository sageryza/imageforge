#!/usr/bin/env node
// The HIDDEN bar (Aug 2026, Sophie: "a little red bar at the top of where the
// chats live called hidden where I can hide chats that I want to come back to
// and I don't wanna see them because I wanna see the rest of the chats").
// Drives the REAL public/chats.html in a headless browser against a stub API
// and asserts the whole loop:
//   1. no bar at all while nothing is hidden,
//   2. the ⊖ on a chat row takes it out of the list and POSTs /hide,
//   3. the bar appears, counts what is behind it, and names anything unread
//      there ("Hidden 1 · 1 new") — a hidden chat that replied must not be
//      invisible everywhere,
//   4. tapping the bar opens the pile in place and the masthead says HIDDEN;
//      tapping it again closes it and the masthead goes back to Chats,
//   5. the ⊕ inside the pile puts the chat back and the bar goes away,
//   6. a chat the registry already has hidden starts out of the list, and
//      leads Status's WAITING ON YOU (hiding took the ! flag's place),
//   7. a hidden chat that ANSWERS pops back out on its own (Sophie, Aug 2026:
//      hiding is "not now", not "away for good").
//
//   npm install playwright-core --no-save && node scripts/test-chats-hidden.js
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

const MSGS = [
  { id: 'm1', chat: 'chat-a', from: 'claude', text: 'first reply', tldr: 'a done', created: iso(T0 - 3600000), postedAt: iso(T0 - 3600000) },
  { id: 'm2', chat: 'chat-b', from: 'claude', text: 'second reply', tldr: 'b done', created: iso(T0 - 7200000), postedAt: iso(T0 - 7200000) },
  { id: 'm3', chat: 'chat-parked', from: 'claude', text: 'parked reply', tldr: 'parked', created: iso(T0 - 10800000), postedAt: iso(T0 - 10800000) },
];
const hidePosts = [];
// flipped by the test to make chat-parked answer while it is hidden
let answered = false;
const ANSWER = { id: 'm4', chat: 'chat-parked', from: 'claude', text: 'it answered', tldr: 'answered', created: iso(T0 + 3600000), postedAt: iso(T0 + 3600000) };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1',
      chats: {
        'chat-a': { lastSeen: MSGS[0].created },
        'chat-b': { lastSeen: MSGS[1].created },
        // already hidden before she opens the page. hiddenAt is NEWER than its
        // last message, which is what "hidden" means now — a stamp, not a flag.
        // (The v1 boolean `hidden:true` is gone and no longer read: it could
        // never pop out, which is the bug that retired it.)
        'chat-parked': { lastSeen: MSGS[2].created, hiddenAt: iso(T0) },
      },
      settings: {}, truncated: [],
      messages: since ? (answered ? [ANSWER] : []) : MSGS.concat(answered ? [ANSWER] : []),
      delta: !!since,
    }));
  }
  if (url.pathname === '/api/chatfeed/hide' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      const p = JSON.parse(body || '{}');
      hidePosts.push(p);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, hidden: !!p.hidden }));
    });
    return;
  }
  if (url.pathname === '/api/gallery/assets/recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ assets: [] }));
  }
  if (url.pathname === '/api/chatfeed/pages-recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ pages: [] }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({}));
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
// the MAIN list only: the hidden pile renders its own .clist inside .hidelist,
// so a plain '#grid .clist' would count hidden rows whenever the pile is open
const listed = (page) => page.$$eval('#grid > .clist .crow[data-chat]', (ns) => ns.map((n) => n.dataset.chat));

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage();

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="chat-a"]');

  // 6a. the already-hidden chat is out of the list from the first paint, and
  //     the bar carries it (with its unread, since she has never opened it)
  let rows = await listed(page);
  if (rows.indexOf('chat-parked') >= 0) fail('a chat the registry has hidden was still in the list');
  let barTxt = await page.$eval('.hidebar .hb-n', (n) => n.textContent.replace(/\s+/g, ' ').trim());
  if (!/^Hidden 1\b/.test(barTxt)) fail('bar did not count the pre-hidden chat: ' + barTxt);
  if (!/1 new/.test(barTxt)) fail('bar did not name the unread behind it: ' + barTxt);

  // 2 + 3. hiding chat-b from its row takes it out and bumps the bar
  await page.click('#grid > .clist .crow[data-chat="chat-b"] .hidebtn');
  await page.waitForFunction(() => !document.querySelector('#grid > .clist .crow[data-chat="chat-b"]'),
    null, { timeout: 4000 }).catch(() => fail('hiding a chat did not take it out of the list'));
  rows = await listed(page);
  if (JSON.stringify(rows) !== JSON.stringify(['chat-a'])) fail('list after hiding is wrong: ' + rows.join(','));
  barTxt = await page.$eval('.hidebar .hb-n', (n) => n.textContent.replace(/\s+/g, ' ').trim());
  if (!/^Hidden 2\b/.test(barTxt)) fail('bar count did not go up: ' + barTxt);
  if (!hidePosts.some((p) => p.chat === 'chat-b' && p.hidden === true)) fail('POST /hide never fired for chat-b');

  // hiding must NOT open the pile — that would undo what she just asked for
  if (await page.$('#grid .hidelist')) fail('hiding a chat opened the hidden pile');

  // 4. the bar opens the pile in place, and closes it again
  await page.click('.hidebar');
  await page.waitForSelector('#grid .hidelist .crow[data-chat="chat-b"]', { timeout: 4000 })
    .catch(() => fail('tapping the bar never showed the hidden chats'));
  // the masthead names the place she is in, in the bar's red
  const openTitle = await page.$eval('#htitle', (n) => n.textContent.trim() + '|' + n.classList.contains('hid'));
  if (openTitle !== 'Hidden|true') fail('masthead did not say HIDDEN in red: ' + openTitle);
  const pile = await page.$$eval('#grid .hidelist .crow[data-chat]', (ns) => ns.map((n) => n.dataset.chat));
  if (pile.length !== 2 || pile.indexOf('chat-parked') < 0) fail('pile contents wrong: ' + pile.join(','));
  await page.click('.hidebar');
  if (await page.$('#grid .hidelist')) fail('tapping the bar again did not close the pile');
  const shutTitle = await page.$eval('#htitle', (n) => n.textContent.trim() + '|' + n.classList.contains('hid'));
  if (shutTitle !== 'Chats|false') fail('masthead stayed on HIDDEN after closing: ' + shutTitle);

  // 5. the ⊕ inside the pile puts a chat back, and with nothing left hidden
  //    the bar disappears entirely
  await page.click('.hidebar');
  await page.waitForSelector('#grid .hidelist .crow[data-chat="chat-b"]');
  await page.click('#grid .hidelist .crow[data-chat="chat-b"] .hidebtn');
  await page.waitForFunction(() => !!document.querySelector('#grid > .clist .crow[data-chat="chat-b"]'),
    null, { timeout: 4000 }).catch(() => fail('putting a chat back did not return it to the list'));
  if (!hidePosts.some((p) => p.chat === 'chat-b' && p.hidden === false)) fail('POST /hide {hidden:false} never fired');
  await page.click('#grid .hidelist .crow[data-chat="chat-parked"] .hidebtn');
  await page.waitForFunction(() => !document.querySelector('.hidebar'),
    null, { timeout: 4000 }).catch(() => fail('bar stayed after everything was put back'));

  // 1. with nothing hidden there is no bar at all
  if (await page.$('.hidebar')) fail('bar drawn with nothing hidden');

  // 6b. a hidden chat leads Status's WAITING ON YOU (the slot the ! flag had)
  await page.click('#grid > .clist .crow[data-chat="chat-parked"] .hidebtn');
  await page.waitForFunction(() => !!document.querySelector('.hidebar'));
  await page.evaluate(() => window.__setHomeView('status'));
  await page.waitForFunction(() => document.getElementById('htitle').textContent === 'Status');
  const stRows = await page.$$eval('#grid .crow[data-chat]', (ns) => ns.map((n) => n.dataset.chat));
  if (stRows[0] !== 'chat-parked') fail('hidden chat does not lead Waiting on you: ' + stRows.join(','));

  // 7. a hidden chat that answers pops back out into the list by itself.
  //    Back to the live list first — Status's rows are .clist .crow as well,
  //    so asserting from there would pass on the wrong element.
  await page.evaluate(() => window.__setHomeView('status'));
  // the pile is still open from step 5, so the masthead reads HIDDEN here —
  // wait for "not Status" rather than for the word Chats
  await page.waitForFunction(() => document.getElementById('htitle').textContent !== 'Status');
  if (!(await page.$('.hidebar'))) fail('chat-parked was not hidden going into the pop-out check');
  answered = true;
  await page.click('#refresh');
  await page.waitForFunction(() => !!document.querySelector('#grid > .clist .crow[data-chat="chat-parked"]'),
    null, { timeout: 6000 }).catch(() => fail('a hidden chat that answered did not pop out'));
  if (await page.$('.hidebar')) fail('bar stayed after the last hidden chat popped out');

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures' : 'OK: hidden bar counts, opens, restores and leads Status');
})().catch((e) => { console.error(e); process.exit(1); });
