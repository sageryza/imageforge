#!/usr/bin/env node
// The Update card KEEPS ITSELF (Aug 2026, Sophie: "make the default behavior
// that it's pinned until I mark the checkmark and get rid of the pin").
//
// Every card used to clear itself the moment she opened the chat, and a pin
// button existed to opt one card out of that. Now OPENING clears nothing, so
// the pin is gone. This replaces scripts/test-chats-news-pin.js, which tested
// the opposite contract.
//
// The ✓ is what the PAGE writes, and this file is about the page. One other
// thing writes the same stamp — HER REPLY, server-side in POST /reply, so a
// card goes quiet when she answers the chat from the Claude app (Aug 2026,
// Sophie: "if I actually replied to the message that does get rid of the
// notification"). That half is pinned by scripts/test-chats-news-reply.js;
// nothing here should start clearing cards on its own.
//
// Drives the REAL public/chats.html against a stub API and asserts:
//   1. there is NO pin button left, and the card's top row still reads
//      name · ⌄ · TIME · ✓ with the ⌄ far enough from the ✓ that a fat finger
//      can't cross it (measured, not eyeballed),
//   2. tapping the ⌄ still opens the summary in place,
//   3. THE ASK: a card survives opening its chat and coming back,
//   4. …and opening a chat does not POST notif-seen behind her back — that
//      write is what used to keep the widget's count in step, and it would now
//      clear a card she never checked,
//   5. the ✓ box + the pinned row's DONE clears the card and posts the stamp
//      (Aug 2026 — the ✓ picks, DONE clears; test-chats-news-queue.js owns
//      that contract),
//   6. a chat whose ✓ is newer than everything it has delivered gets no card
//      at all — the stamp still settles a card across reloads.
//
//   npm install playwright-core --no-save && node scripts/test-chats-news-sticky.js
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

// chat-new:  a reply newer than its ✓ → a card.
// chat-read: its ✓ is AFTER its last reply → no card, and no pin can put one
//            there any more. That pair is the whole contract.
const MSGS = [
  { id: 'm1', chat: 'chat-new', from: 'claude', text: 'the six cards are drawn', tldr: 'six cards drawn', created: iso(T0 - 600000), postedAt: iso(T0 - 600000) },
  { id: 'm2', chat: 'chat-read', from: 'claude', text: 'palette options are up', tldr: 'palettes up', created: iso(T0 - 7200000), postedAt: iso(T0 - 7200000) },
];
const seenPosts = [];
const reg = {
  'chat-new': { lastSeen: MSGS[0].created, updAsked: 'the six lesson cards', updDid: 'drew all six', updNext: 'pick a palette' },
  'chat-read': { lastSeen: MSGS[1].created, notifSeenAt: iso(T0 - 60000) },
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const body = (cb) => { let b = ''; req.on('data', (c) => b += c); req.on('end', () => cb(JSON.parse(b || '{}'))); };
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1', chats: reg, settings: {}, truncated: [],
      messages: url.searchParams.get('since') ? [] : MSGS, delta: !!url.searchParams.get('since'),
    }));
  }
  // The route is GONE from the server. Answering 404 here is the point: if the
  // page still calls it, the console shows it and assertion 1 has already
  // failed on the missing button.
  if (url.pathname === '/api/chatfeed/news-pin') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'gone' }));
  }
  if (url.pathname === '/api/chatfeed/notif-seen' && req.method === 'POST') {
    return body((p) => {
      seenPosts.push(p);
      const stamp = iso(Date.now());
      reg[p.chat] = reg[p.chat] || {};
      if (p.seen !== false) reg[p.chat].notifSeenAt = stamp; else delete reg[p.chat].notifSeenAt;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, notifSeenAt: p.seen !== false ? stamp : null }));
    });
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ assets: [], pages: [], items: [] }));
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // __setHomeView TOGGLES (tapping the open view returns to the list), and
  // homeView survives opening a chat — so only switch when we aren't there.
  const openNews = async () => {
    if (!(await page.$('#grid .nwcard'))) await page.evaluate(() => window.__setHomeView('news'));
    await page.waitForSelector('#grid .nwcard', { timeout: 4000 });
  };

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat]');
  await openNews();

  // 1. no pin anywhere, and the ⌄/✓ spacing survived its removal
  if (await page.$('#grid .nwpin')) fail('the pin button is still on the card');
  const geo = await page.$eval('#grid .nwcard[data-chat="chat-new"] .nwtop', (top) => {
    const r = (sel) => { const el = top.querySelector(sel); if (!el) return null;
      const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, w: b.width }; };
    return { more: r('.nwmore'), time: r('.nwtime'), ck: r('.nwck') };
  });
  if (!geo.more) fail('the ⌄ is missing from the card');
  if (!geo.time) fail('the timestamp is missing from the card top row');
  if (!(geo.more.r <= geo.time.l + 1)) fail('the ⌄ is not before the timestamp');
  if (!(geo.time.r <= geo.ck.l + 1)) fail('the ✓ is not after the timestamp');
  const gap = geo.ck.l - geo.more.r;
  if (gap < 40) fail('only ' + Math.round(gap) + 'px between the ⌄ and the ✓ — she taps the wrong one');

  // 2. the ⌄ still works
  await page.click('#grid .nwcard[data-chat="chat-new"] .nwmore');
  await page.waitForFunction(() =>
    document.querySelector('#grid .nwcard[data-chat="chat-new"]').classList.contains('sumon'),
    null, { timeout: 3000 }).catch(() => fail('the ⌄ no longer opens the summary'));

  // 6. chat-read has been checked off and delivered nothing since — no card,
  //    with no pin left to hold one on screen
  const cards = await page.$$eval('#grid .nwcard', (ns) => ns.map((n) => n.dataset.chat));
  if (cards.indexOf('chat-read') >= 0) fail('a checked-off chat with nothing new still has a card');
  if (cards.indexOf('chat-new') < 0) fail('the chat with a fresh reply has no card: ' + cards.join(','));

  // 3 + 4. THE ASK: open the chat, come back, the card is still there — and
  //        opening it wrote nothing to the server
  await page.click('#grid .nwcard[data-chat="chat-new"] .crow');
  await page.waitForSelector('#thread .msg');
  await page.click('#back');   // the real way back, same as her thumb
  await page.waitForSelector('#grid .crow', { timeout: 3000 });
  await openNews();
  const afterOpen = await page.$$eval('#grid .nwcard', (ns) => ns.map((n) => n.dataset.chat));
  if (afterOpen.indexOf('chat-new') < 0) fail('the card vanished after opening the chat');
  if (seenPosts.length) {
    fail('opening a chat posted notif-seen — that clears a card she never checked: '
      + JSON.stringify(seenPosts));
  }

  // 5. the ✓ box + DONE is what clears it (Aug 2026: the ✓ picks the card and
  //    the pinned row's DONE clears it — test-chats-news-queue.js owns that
  //    contract; here it just has to still be the ONLY way a card leaves)
  await page.click('#grid .nwcard[data-chat="chat-new"] .nwck');
  await page.click('#catrow .nwdone');
  await page.waitForFunction(() =>
    !document.querySelector('#grid .nwcard[data-chat="chat-new"]'),
    null, { timeout: 3000 }).catch(() => fail('✓ then DONE did not clear the card'));
  if (!seenPosts.some((p) => p.chat === 'chat-new')) fail('DONE never posted notif-seen');

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures'
    : 'OK: no pin, the card survives being opened, and nothing but ✓ + DONE clears it');
})().catch((e) => { console.error(e); process.exit(1); });
