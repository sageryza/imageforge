#!/usr/bin/env node
// The big serif title is the way BACK (Aug 2026, Sophie: "I'm supposed to be
// able to click on the archive title and it goes back to chats and same with
// hidden. Also, can you tint the archive title header that's in a bigger font
// green also"). Drives the REAL public/chats.html headless against a stub API
// and asserts:
//   1. tapping "Archive" returns to the chat list, and that title is GREEN,
//   2. tapping "Hidden" closes the pile (and that title stays red),
//   3. the same works for Bookmarks and To do,
//   4. tapping "Chats" does nothing — she is already there,
//   5. THE REGRESSION GUARD: the title overlaps the buttons on purpose
//      (`width:0` + z-index), so every control under a long title must still
//      be the thing a tap at its own centre lands on. Hit-tested with
//      elementFromPoint at 375/390/430 across every title (six since the
//      UPDATE tab), because
//      comparing numbers is what let the To do Add button ship buried.
//
//   npm install playwright-core --no-save && node scripts/test-chats-title-back.js
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
  { id: 'm2', chat: 'chat-old', from: 'claude', text: 'archived reply', tldr: 'old', created: iso(T0 - 7200000), postedAt: iso(T0 - 7200000) },
  { id: 'm3', chat: 'chat-parked', from: 'claude', text: 'parked reply', tldr: 'parked', created: iso(T0 - 10800000), postedAt: iso(T0 - 10800000) },
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    return json({
      build: 'test-build-1',
      chats: {
        'chat-a': { lastSeen: MSGS[0].created },
        'chat-old': { lastSeen: MSGS[1].created, archived: true },
        'chat-parked': { lastSeen: MSGS[2].created, hiddenAt: iso(T0) },
      },
      settings: {}, truncated: [],
      messages: since ? [] : MSGS, delta: !!since,
    });
  }
  if (url.pathname === '/api/chatfeed/bookmarks') return json({ messages: [] });
  if (url.pathname === '/api/chatfeed/todos') return json({ todos: [] });
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  json({});
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const title = (page) => page.textContent('#htxt');

// A tap on the WORD itself, wherever the word currently is.
async function tapTitle(page) {
  const r = await page.evaluate(() => {
    const b = document.getElementById('htxt').getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  });
  await page.mouse.click(r.x, r.y);
  await page.waitForTimeout(80);
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="chat-a"]');

  // 4. on the chat list the word is just a word
  if (await title(page) !== 'Chats') fail('the home does not open on Chats');
  await tapTitle(page);
  if (await title(page) !== 'Chats') fail('tapping the title on the chat list moved her somewhere');

  // 1. ARCHIVE — green, and the way back
  await page.click('#archlink');
  await page.waitForFunction(() => document.getElementById('htxt').textContent === 'Archive');
  const green = await page.evaluate(() => getComputedStyle(document.getElementById('htitle')).color);
  if (green !== 'rgb(93, 122, 90)') fail('the Archive title is not green: ' + green);
  if (!(await page.isVisible('#grid [data-chat="chat-old"]'))) fail('the archived chat is missing from the Archive view');
  await tapTitle(page);
  if (await title(page) !== 'Chats') fail('tapping the Archive title did not go back to chats');
  if (!(await page.isVisible('#grid [data-chat="chat-a"]'))) fail('the chat list did not come back');

  // 2. HIDDEN — the pile's own title, in the bar's red, closes the pile
  await page.click('.hidebar');
  await page.waitForFunction(() => document.getElementById('htxt').textContent === 'Hidden');
  const red = await page.evaluate(() => getComputedStyle(document.getElementById('htitle')).color);
  if (red === 'rgb(93, 122, 90)') fail('the Hidden title went green — the arch class was not cleared');
  await tapTitle(page);
  if (await title(page) !== 'Chats') fail('tapping the Hidden title did not close the pile');
  if (await page.isVisible('#grid [data-chat="chat-parked"]')) fail('the hidden pile is still open');

  // 3. the other two views
  for (const [sel, word] of [['#bmklink', 'Bookmarks'], ['#todolink', 'To do']]) {
    await page.click(sel);
    await page.waitForFunction((w) => document.getElementById('htxt').textContent === w, word);
    await tapTitle(page);
    if (await title(page) !== 'Chats') fail('tapping the ' + word + ' title did not go back to chats');
  }

  // 5. every control under a long title is still what a tap at its centre hits
  // (the account switch is three slots since Aug 2026 — check each of them,
  // since the thing that can go wrong is one slot ending up under the title)
  const CTLS = [['#bmklink', 'bookmark'], ['#todolink', 'To do'], ['#archlink', 'Archive'],
    ['#acctog .sw3[data-a="1"]', 'account 1 slot'],
    ['#acctog .sw3[data-a="2"]', 'account 2 slot'],
    ['#acctog .sw3[data-a="3"]', 'account 3 slot']];
  for (const w of [375, 390, 430]) {
    await page.setViewportSize({ width: w, height: 844 });
    for (const view of ['live', 'archive', 'bookmarks', 'todo', 'status', 'news']) {
      // __setHomeView toggles, so drive it plainly: go home, then to the view
      await page.evaluate((v) => {
        if (document.getElementById('htxt').textContent !== 'Chats') window.__titleBack();
        if (v !== 'live') window.__setHomeView(v);
      }, view);
      await page.waitForTimeout(60);
      const word = await title(page);
      for (const [sel, name] of CTLS) {
        const hit = await page.evaluate((s) => {
          const n = document.querySelector(s);
          const b = n.getBoundingClientRect();
          if (!b.width) return 'hidden';
          const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          if (el && (el === n || n.contains(el))) return s;
          const btn = el && el.closest('button');
          return btn ? ('#' + btn.id) : 'none';
        }, sel);
        if (hit !== 'hidden' && hit !== sel) {
          fail('at ' + w + 'px under the title "' + word + '" a tap on the ' + name + ' lands on ' + hit);
        }
      }
    }
  }

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures'
    : 'OK: the title is the way back, Archive is green, and nothing under it got buried');
})().catch((e) => { console.error(e); process.exit(1); });
