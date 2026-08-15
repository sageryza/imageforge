#!/usr/bin/env node
// THE TWO BOXES ON THE UPDATE SCREEN (Aug 2026, Sophie: "there's no categories
// on the updates page in that same style of those little boxes. I'd like to
// add two categories, one called IN A MINUTE for things I want to look at in a
// minute, but not quite this second, and then next to it on the left I want
// another category called LATER for things I want to look at maybe later today
// or this week. How I want to work is that I tap the item, it selects it with
// a thicker outline, and then I tap the category and that's how it gets filed
// in").
//
// Drives the REAL public/chats.html headless against a stub API and asserts:
//   1. the chips row is on the UPDATE screen, and it is exactly two boxes —
//      LATER on the LEFT, IN A MINUTE beside it (her order),
//   2. tapping a card PICKS it (the thicker outline) and tapping it again
//      lets go; the ✓ and a page title still do their own jobs instead of
//      picking,
//   3. picked + a box = FILED: it POSTs /news-queue, the card leaves the main
//      list, and the box counts it,
//   4. the box is a FILTER when nothing is picked — tap it to see what is in
//      there, tap it again to come back,
//   5. tapping the box a card is ALREADY in takes it back OUT (the only way
//      home, and no extra button for it),
//   6. the UPDATE tab's badge drops when she files — a card put away for later
//      is triaged, and the boxes carry their own counts,
//   7. NEWER NEWS POPS IT BACK OUT: a chat that delivers something after the
//      filing is on the main list again and out of the box, so a card is
//      always in exactly one place,
//   8. the chat is still reachable — its NAME opens it, since the card's body
//      now belongs to picking.
//
//   npm install playwright-core --no-save && node scripts/test-chats-news-queue.js
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
const H = 3600000;
const iso = (ms) => new Date(ms).toISOString();

// chat-a / chat-b / chat-c — three plain unread replies, three cards
// chat-old — filed into `later` an hour ago and quiet since → in the box
// chat-new — filed into `later` an hour ago and it DELIVERED after that →
//            new news, so it belongs back on the main list and out of the box
const MSGS = [
  { id: 'm1', chat: 'chat-a', from: 'claude', text: 'a', tldr: 'the first one', created: iso(T0 - 2 * H), postedAt: iso(T0 - 2 * H) },
  { id: 'm2', chat: 'chat-b', from: 'claude', text: 'b', tldr: 'the second one', created: iso(T0 - 3 * H), postedAt: iso(T0 - 3 * H) },
  { id: 'm3', chat: 'chat-c', from: 'claude', text: 'c', tldr: 'the third one', created: iso(T0 - 4 * H), postedAt: iso(T0 - 4 * H) },
  { id: 'm4', chat: 'chat-old', from: 'claude', text: 'old', tldr: 'filed and quiet', created: iso(T0 - 5 * H), postedAt: iso(T0 - 5 * H) },
  { id: 'm5', chat: 'chat-new', from: 'claude', text: 'new', tldr: 'spoke again since', created: iso(T0 - 10 * 60000), postedAt: iso(T0 - 10 * 60000) },
];
const queuePosts = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1',
      chats: {
        'chat-a': { account: '1' },
        'chat-b': { account: '1' },
        'chat-c': { account: '1' },
        'chat-old': { account: '1', newsQueue: 'later', newsQueuedAt: iso(T0 - 1 * H) },
        'chat-new': { account: '1', newsQueue: 'later', newsQueuedAt: iso(T0 - 1 * H) },
      },
      settings: {}, truncated: [], messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/api/chatfeed/news-queue' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      queuePosts.push(JSON.parse(body || '{}'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  if (url.pathname === '/api/chatfeed/notif-seen' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, notifSeenAt: iso(Date.now()) }));
    });
    return;
  }
  if (url.pathname === '/api/gallery/assets/recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ assets: [] }));
  }
  if (url.pathname === '/api/chatfeed/pages-recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ pages: [
      { id: 'p1', title: 'The first one — options v1', chat: 'chat-a', created: iso(T0 - 90 * 60000) },
    ] }));
  }
  if (url.pathname.startsWith('/api/chatfeed/page/')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<!doctype html><title>page</title><p>the artifact</p>');
  }
  if (url.pathname === '/api/gallery/assets') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ assets: [], total: 0, offset: 0, limit: 150 }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({}));
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="chat-a"]');

  // into the UPDATE view
  await page.click('#accrow .acctab[data-acct="new"]');
  await page.waitForSelector('.nwcard[data-chat="chat-a"]');

  const cards = () => page.$$eval('.nwcard', ns => ns.map(n => n.dataset.chat));
  const chips = () => page.$$eval('#catrow .catchip', ns => ns.map(n => n.textContent.trim()));

  // 1. two boxes, LATER first
  const row = await chips();
  if (row.length !== 2) fail('expected exactly two boxes, got ' + row.length + ': ' + row.join(' | '));
  if (!/^Later/.test(row[0] || '')) fail('LATER is not the left box: ' + row.join(' | '));
  if (!/^In a minute/i.test(row[1] || '')) fail('IN A MINUTE is not the right box: ' + row.join(' | '));
  // …and no star chip / no New… box borrowed from the chat list
  if (await page.$('#catrow .starchip')) fail('the star chip leaked onto the Update screen');
  if (await page.$('#catrow input')) fail('the Update boxes must be a closed set — no New… box');

  // the pre-filed pair: chat-old is IN the box, chat-new spoke since so it is out
  let list = await cards();
  if (list.indexOf('chat-old') >= 0) fail('a filed card is still on the main list: ' + list.join(', '));
  if (list.indexOf('chat-new') < 0) fail('a filed chat that delivered SINCE must pop back onto the list: ' + list.join(', '));
  if (!/1$/.test(row[0])) fail('the Later box should count 1 (chat-old), got "' + row[0] + '"');

  // 2. a tap picks the card, a second tap lets go
  await page.click('.nwcard[data-chat="chat-a"] .crow');
  if (!await page.$('.nwcard[data-chat="chat-a"].picked')) fail('a tap on the card did not pick it');
  const bw = await page.$eval('.nwcard[data-chat="chat-a"]', n => getComputedStyle(n).borderTopWidth);
  if (parseFloat(bw) < 2) fail('a picked card has no thicker outline (border ' + bw + ')');
  await page.click('.nwcard[data-chat="chat-a"] .crow');
  if (await page.$('.nwcard[data-chat="chat-a"].picked')) fail('tapping a picked card did not let go of it');

  // …and the page title is still a page title, not a pick
  await page.click('.nwcard[data-chat="chat-a"] .pagerow');
  await page.waitForSelector('.pageview', { timeout: 3000 })
    .catch(() => fail('the page title stopped opening the Compare page'));
  if (await page.$('.nwcard[data-chat="chat-a"].picked')) fail('opening a page also picked the card');
  await page.click('.pageview .pv-back');
  await page.waitForSelector('.pageview', { state: 'detached', timeout: 3000 }).catch(() => {});

  // 3. pick two, tap LATER → filed
  await page.click('.nwcard[data-chat="chat-a"] .crow');
  await page.click('.nwcard[data-chat="chat-b"] .crow');
  await page.click('#catrow .catchip:nth-of-type(1)');
  await page.waitForTimeout(120);
  const post = queuePosts[queuePosts.length - 1] || {};
  if (post.queue !== 'later') fail('filing did not POST queue:later — ' + JSON.stringify(post));
  if (!(post.chats || []).includes('chat-a') || !(post.chats || []).includes('chat-b')) {
    fail('filing did not carry both picked chats — ' + JSON.stringify(post));
  }
  list = await cards();
  if (list.indexOf('chat-a') >= 0 || list.indexOf('chat-b') >= 0) {
    fail('a filed card is still on the main list: ' + list.join(', '));
  }
  if (await page.$('.nwcard.picked')) fail('filing did not clear the selection');
  let row2 = await chips();
  if (!/3$/.test(row2[0])) fail('the Later box should now count 3, got "' + row2[0] + '"');

  // 6. the tab badge counts what is LEFT on the main list (chat-c + chat-new)
  const badge = await page.$eval('#accrow .acctab[data-acct="new"] .cc-new', n => n.textContent).catch(() => '');
  if (badge !== '2') fail('the Update badge should drop to 2 once two are filed, got "' + badge + '"');

  // 4. the box as a filter — nothing picked, so a tap opens it
  await page.click('#catrow .catchip:nth-of-type(1)');
  await page.waitForTimeout(80);
  list = await cards();
  if (list.length !== 3 || list.indexOf('chat-a') < 0 || list.indexOf('chat-old') < 0) {
    fail('the Later box should hold exactly the three filed cards, got: ' + list.join(', '));
  }
  if (list.indexOf('chat-new') >= 0) fail('a card that delivered after filing must not sit in the box too');

  // 5. picked + the box it is already in = back out
  await page.click('.nwcard[data-chat="chat-a"] .crow');
  await page.click('#catrow .catchip:nth-of-type(1)');
  await page.waitForTimeout(120);
  const back = queuePosts[queuePosts.length - 1] || {};
  if (back.queue !== '' || !(back.chats || []).includes('chat-a')) {
    fail('tapping the box a card is already in should clear it — ' + JSON.stringify(back));
  }
  list = await cards();
  if (list.indexOf('chat-a') >= 0) fail('the un-filed card is still showing inside the box');

  // tap the lit box again → back to the main list, with chat-a on it
  await page.click('#catrow .catchip:nth-of-type(1)');
  await page.waitForTimeout(80);
  list = await cards();
  if (list.indexOf('chat-a') < 0) fail('the un-filed card did not come back to the main list: ' + list.join(', '));

  // 8. the chat is still reachable — its ICON opens it (every card has one,
  // blank fallback included, because that is the way in now)
  await page.click('.nwcard[data-chat="chat-c"] .cr-ic');
  await page.waitForSelector('#thread', { state: 'visible', timeout: 3000 })
    .catch(() => fail('tapping the card’s name no longer opens the chat'));

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('PASS: the Update screen files into Later / In a minute');
})().catch((e) => { console.error(e); process.exit(1); });
