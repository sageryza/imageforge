#!/usr/bin/env node
// The running to-do list + the account number on each row (Aug 2026, Sophie:
// "I kind of wanna do like a running to-do list", and "put a one or two based
// on which account it's from at the front of each chat"). Drives the REAL
// public/chats.html headless against a stub API and asserts:
//   1. each row carries its account digit at the front, and an untagged chat
//      gets a blank of the same width so the names still line up,
//   2. the "To do" word opens the list and the masthead says To do,
//   3. typing something adds it optimistically and POSTs it,
//   4. the ✓ crosses an item off (PATCH done:true) and it sinks below the
//      open ones, struck through,
//   5. the word STAYS "To do" and tapping it again is the way back (the
//      "← Chats" relabel came off at Sophie's ask — each word is its own
//      toggle now),
//   6. the Add button clears the autoscroll pill's corner and is really
//      tappable (this view hides the tool row and the search bar, so the add
//      row rides up into the pill's band — the button landed under it).
//
//   npm install playwright-core --no-save && node scripts/test-chats-todo.js
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
  { id: 'm1', chat: 'chat-one', from: 'claude', text: 'a', tldr: 'a', created: iso(T0 - 3600000), postedAt: iso(T0 - 3600000) },
  { id: 'm2', chat: 'chat-two', from: 'claude', text: 'b', tldr: 'b', created: iso(T0 - 7200000), postedAt: iso(T0 - 7200000) },
  { id: 'm3', chat: 'chat-none', from: 'claude', text: 'c', tldr: 'c', created: iso(T0 - 10800000), postedAt: iso(T0 - 10800000) },
];
// one item already on the list, so the view has something on first paint
const TODOS = [{ id: 't1', text: 'an older note', done: false, createdAt: iso(T0 - 86400000) }];
const posts = [];
const patches = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    return json({
      build: 'test-build-1',
      chats: {
        'chat-one': { lastSeen: MSGS[0].created, account: '1' },
        'chat-two': { lastSeen: MSGS[1].created, account: '2' },
        'chat-none': { lastSeen: MSGS[2].created },        // never tagged
      },
      settings: {}, truncated: [],
      messages: since ? [] : MSGS, delta: !!since,
    });
  }
  if (url.pathname === '/api/chatfeed/todos') return json({ items: TODOS });
  if (url.pathname === '/api/chatfeed/todo' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      const p = JSON.parse(body || '{}');
      posts.push(p);
      const item = { id: 't' + (TODOS.length + 1), text: p.text, done: false, createdAt: iso(Date.now()) };
      TODOS.push(item);
      json({ ok: true, id: item.id, item });
    });
    return;
  }
  if (url.pathname.indexOf('/api/chatfeed/todo/') === 0 && req.method === 'PATCH') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      patches.push({ id: url.pathname.split('/').pop(), body: JSON.parse(body || '{}') });
      json({ ok: true });
    });
    return;
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  json({});
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="chat-one"]');

  // 1. the account digit, and the names still lining up without one
  const accts = await page.$$eval('#grid > .clist .crow[data-chat]', (ns) => ns.map((n) => ({
    chat: n.dataset.chat,
    digit: (n.querySelector('.cr-acct') || {}).textContent,
    x: n.querySelector('.cr-name').getBoundingClientRect().x,
  })));
  const one = accts.find((a) => a.chat === 'chat-one');
  const two = accts.find((a) => a.chat === 'chat-two');
  const none = accts.find((a) => a.chat === 'chat-none');
  if (!one || one.digit !== '1') fail('account 1 not shown: ' + JSON.stringify(one));
  if (!two || two.digit !== '2') fail('account 2 not shown: ' + JSON.stringify(two));
  if (!none || none.digit !== '') fail('an untagged chat invented a digit: ' + JSON.stringify(none));
  if (Math.abs(one.x - none.x) > 0.5) fail('names do not line up across tagged/untagged: ' + one.x + ' vs ' + none.x);

  // 2. the word opens the list
  await page.click('#todolink');
  await page.waitForFunction(() => document.getElementById('htitle').textContent === 'To do', null, { timeout: 4000 })
    .catch(() => fail('the To do word did not open the list'));
  await page.waitForSelector('#todolist .todorow', { timeout: 4000 })
    .catch(() => fail('the existing item never rendered'));

  // 3. typing adds it — optimistically, then POSTed
  await page.fill('.todoadd input', 'try the muted palette');
  await page.press('.todoadd input', 'Enter');
  await page.waitForFunction(
    () => [...document.querySelectorAll('#todolist .todotext')].some((n) => n.textContent === 'try the muted palette'),
    null, { timeout: 4000 }).catch(() => fail('the new item never appeared'));
  if (!posts.some((p) => p.text === 'try the muted palette')) fail('POST /todo never fired');
  const texts = await page.$$eval('#todolist .todotext', (ns) => ns.map((n) => n.textContent));
  if (texts[0] !== 'try the muted palette') fail('the newest item is not at the top: ' + texts.join(' | '));

  // 4. crossing one off strikes it through, sinks it, and PATCHes
  await page.click('#todolist .todorow:first-child .ckbtn');
  await page.waitForFunction(
    () => document.querySelectorAll('#todolist .todorow.done').length === 1,
    null, { timeout: 4000 }).catch(() => fail('the ✓ did not cross the item off'));
  const after = await page.$$eval('#todolist .todorow', (ns) => ns.map((n) => ({
    t: n.querySelector('.todotext').textContent, done: n.classList.contains('done'),
  })));
  if (after[after.length - 1].t !== 'try the muted palette' || !after[after.length - 1].done) {
    fail('a crossed-off item did not sink below the open ones: ' + JSON.stringify(after));
  }
  if (!patches.some((p) => p.body.done === true)) fail('PATCH /todo/:id never fired');

  // 6. the Add button is not under the pill — asserted by hit-testing, not by
  //    arithmetic, so a future layout change cannot quietly re-bury it
  const addHit = await page.evaluate(() => {
    const b = document.querySelector('.todoadd .tbtn').getBoundingClientRect();
    const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return el && el.closest && el.closest('.todoadd .tbtn') ? 'ok' : 'blocked';
  });
  if (addHit !== 'ok') fail('the Add button is covered (the autoscroll pill?)');

  // 5. the word is the way back out, and it never renames itself
  const label = await page.$eval('#todolink', (n) => n.textContent.trim());
  if (label !== 'To do') fail('the To do word renamed itself: ' + label);
  if (!(await page.$eval('#todolink', (n) => n.classList.contains('on')))) fail('the To do word is not lit while she is in the list');
  await page.click('#todolink');
  await page.waitForFunction(() => document.getElementById('htitle').textContent === 'Chats', null, { timeout: 4000 })
    .catch(() => fail('could not get back to the chats list'));

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures' : 'OK: account digits line up; the to-do list adds, crosses off and returns');
})().catch((e) => { console.error(e); process.exit(1); });
