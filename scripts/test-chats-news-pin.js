#!/usr/bin/env node
// The Update card's two fixes (Aug 2026, Sophie):
//   "the arrow to pull the longer summary is a little bit close to the check
//    box so I'm worried I'll tap that by accident — maybe just move it on the
//    other side of the clock time"
//   "I kind of want a pin button so I can pin it and then open it but it'll
//    still be there"
//
// Drives the REAL public/chats.html against a stub API and asserts:
//   1. the card's top row reads name · pin · ⌄ · TIME · ✓ — the ⌄ is on the
//      far side of the timestamp from the ✓, and the gap between ⌄ and ✓ is
//      wide enough that a fat finger can't cross it (measured, not eyeballed),
//   2. tapping the ⌄ still opens the summary in place,
//   3. the pin POSTs, lights, and SURVIVES opening the chat — the whole ask:
//      a chat she has read (its notifSeenAt stamped) keeps its card,
//   4. unpinning a card that was only there BECAUSE it was pinned removes it,
//   5. the ✓ releases the pin as it clears, so the check can't look broken.
//
//   npm install playwright-core --no-save && node scripts/test-chats-news-pin.js
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

// chat-new: something new since the floor → a card on its own merits.
// chat-read: nothing new (seen stamp is AFTER its last reply) → only a pin
//            can keep it on this screen. That's what proves the feature.
const MSGS = [
  { id: 'm1', chat: 'chat-new', from: 'claude', text: 'the six cards are drawn', tldr: 'six cards drawn', created: iso(T0 - 600000), postedAt: iso(T0 - 600000) },
  { id: 'm2', chat: 'chat-read', from: 'claude', text: 'palette options are up', tldr: 'palettes up', created: iso(T0 - 7200000), postedAt: iso(T0 - 7200000) },
];
const pinPosts = [];
const seenPosts = [];
const reg = {
  'chat-new': { lastSeen: MSGS[0].created, updAsked: 'the six lesson cards', updDid: 'drew all six', updNext: 'pick a palette' },
  'chat-read': { lastSeen: MSGS[1].created, notifSeenAt: iso(T0 - 60000), newsPinned: true },
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
  if (url.pathname === '/api/chatfeed/news-pin' && req.method === 'POST') {
    return body((p) => {
      pinPosts.push(p);
      // persist it, the way the registry does — otherwise the next feed read
      // would hand the page back a card with no pin and the test would be
      // measuring the stub, not the feature
      reg[p.chat] = reg[p.chat] || {};
      if (p.pinned !== false) reg[p.chat].newsPinned = true; else delete reg[p.chat].newsPinned;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, pinned: p.pinned !== false }));
    });
  }
  if (url.pathname === '/api/chatfeed/notif-seen' && req.method === 'POST') {
    return body((p) => {
      seenPosts.push(p);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, notifSeenAt: iso(Date.now()) }));
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

  // 1. order + spacing on the card that has an update to expand
  const geo = await page.$eval('#grid .nwcard[data-chat="chat-new"] .nwtop', (top) => {
    const r = (sel) => { const el = top.querySelector(sel); if (!el) return null;
      const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, w: b.width }; };
    return { pin: r('.nwpin'), more: r('.nwmore'), time: r('.nwtime'), ck: r('.nwck') };
  });
  if (!geo.more) fail('the ⌄ is missing from the card');
  if (!geo.time) fail('the timestamp did not move into the card top row');
  if (!geo.pin) fail('the pin button is missing');
  if (!(geo.more.r <= geo.time.l + 1)) fail('the ⌄ is not before the timestamp');
  if (!(geo.time.r <= geo.ck.l + 1)) fail('the ✓ is not after the timestamp');
  const gap = geo.ck.l - geo.more.r;
  if (gap < 40) fail('only ' + Math.round(gap) + 'px between the ⌄ and the ✓ — she taps the wrong one');

  // 2. the ⌄ still works
  await page.click('#grid .nwcard[data-chat="chat-new"] .nwmore');
  await page.waitForFunction(() =>
    document.querySelector('#grid .nwcard[data-chat="chat-new"]').classList.contains('sumon'),
    null, { timeout: 3000 }).catch(() => fail('the ⌄ no longer opens the summary'));

  // 3. THE ASK: chat-read has been read (notifSeenAt newer than its reply) and
  //    is on the screen only because it is pinned — and it leads the list.
  const cards = await page.$$eval('#grid .nwcard', (ns) => ns.map((n) => n.dataset.chat));
  if (cards.indexOf('chat-read') !== 0) fail('a pinned card should lead the list, got: ' + cards.join(','));
  const lit = await page.$eval('#grid .nwcard[data-chat="chat-read"] .nwpin',
    (b) => b.classList.contains('on'));
  if (!lit) fail('the pinned card\'s pin is not lit');

  // pinning from the UI posts and lights
  await page.click('#grid .nwcard[data-chat="chat-new"] .nwpin');
  await page.waitForFunction(() =>
    document.querySelector('#grid .nwcard[data-chat="chat-new"] .nwpin').classList.contains('on'),
    null, { timeout: 3000 }).catch(() => fail('tapping the pin did not light it'));
  if (!pinPosts.some((p) => p.chat === 'chat-new' && p.pinned === true)) {
    fail('POST /pin never carried the pin: ' + JSON.stringify(pinPosts));
  }
  // …and it survives OPENING the chat and coming back — the whole point
  await page.click('#grid .nwcard[data-chat="chat-new"] .crow');
  await page.waitForSelector('#thread .msg');
  await page.click('#back');   // the real way back, same as her thumb
  await page.waitForSelector('#grid .crow', { timeout: 3000 });
  await openNews();
  const afterOpen = await page.$$eval('#grid .nwcard', (ns) => ns.map((n) => n.dataset.chat));
  if (afterOpen.indexOf('chat-new') < 0) fail('the pinned card vanished after opening the chat');

  // 4. unpinning a pinned-only card clears it
  await page.click('#grid .nwcard[data-chat="chat-read"] .nwpin');
  await page.waitForFunction(() =>
    !document.querySelector('#grid .nwcard[data-chat="chat-read"]'),
    null, { timeout: 3000 }).catch(() => fail('unpinning a pinned-only card left it on screen'));
  if (!pinPosts.some((p) => p.chat === 'chat-read' && p.pinned === false)) fail('the unpin never posted');

  // 5. the ✓ releases the pin as it clears
  await page.click('#grid .nwcard[data-chat="chat-new"] .nwck');
  await page.waitForFunction(() =>
    !document.querySelector('#grid .nwcard[data-chat="chat-new"]'),
    null, { timeout: 3000 }).catch(() => fail('the ✓ did not clear the card'));
  if (!seenPosts.some((p) => p.chat === 'chat-new')) fail('the ✓ never posted notif-seen');
  if (!pinPosts.some((p) => p.chat === 'chat-new' && p.pinned === false)) {
    fail('the ✓ cleared the card but left it pinned — it would come straight back');
  }

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures' : 'OK: the ⌄ sits across the timestamp from the ✓, and a pinned card survives being opened');
})().catch((e) => { console.error(e); process.exit(1); });
