#!/usr/bin/env node
// IN A MINUTE STAYS ON THE SCREEN, IN MINT (2026-08-29, Sophie: "can u turn
// chats green tint if in a minute filed / stay on scre[en]" · "mint").
//
// The other two Update boxes are deferrals and the card leaves the list; IN A
// MINUTE is something she is coming straight back to, so filing it must NOT
// take it away — it stays where it is, tinted, and the box holds it as well.
// Drives the REAL public/chats.html headless against a stub API and asserts:
//   1. filing into IN A MINUTE still POSTs queue:soon and still counts on the
//      box, but the card is STILL ON THE MAIN LIST,
//   2. …wearing mint: its background differs from an ordinary card's, and it
//      is a GREEN (measured off the real computed colour, not a class name —
//      a wrong token renders as a perfectly plausible card),
//   3. only that card is tinted, and only the `soon` box does this: a card
//      filed COME BACK TO still leaves the list,
//   4. the tint is the BACKGROUND, so a mint card she then picks still shows
//      the picked outline,
//   5. inside the open box nothing is tinted — every card there is one,
//   6. the Update badge counts what is on the list, mint cards included,
//   7. un-filing takes the tint off again.
//
//   npm install playwright-core --no-save && node scripts/test-chats-news-mint.js
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

const MSGS = [
  { id: 'm1', chat: 'chat-a', from: 'claude', text: 'a', tldr: 'the first one', created: iso(T0 - 2 * H), postedAt: iso(T0 - 2 * H) },
  { id: 'm2', chat: 'chat-b', from: 'claude', text: 'b', tldr: 'the second one', created: iso(T0 - 3 * H), postedAt: iso(T0 - 3 * H) },
  { id: 'm3', chat: 'chat-c', from: 'claude', text: 'c', tldr: 'the third one', created: iso(T0 - 4 * H), postedAt: iso(T0 - 4 * H) },
  // already filed IN A MINUTE an hour ago and quiet since — so it is on the
  // list at load, tinted, with nothing to click first.
  { id: 'm4', chat: 'chat-soon', from: 'claude', text: 's', tldr: 'filed in a minute', created: iso(T0 - 5 * H), postedAt: iso(T0 - 5 * H) },
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
        'chat-soon': { account: '1', newsQueue: 'soon', newsQueuedAt: iso(T0 - 1 * H) },
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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, notifSeenAt: iso(Date.now()) }));
  }
  if (url.pathname === '/api/gallery/assets/recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ assets: [] }));
  }
  if (url.pathname === '/api/chatfeed/pages-recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ pages: [] }));
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
// rgb(r,g,b) → is it a green? (green channel ahead of both others, and it is
// not just grey). Asserted on the real computed value, because the whole ask
// is a colour and a class name says nothing about what renders.
function isGreen(css) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css || '');
  if (!m) return false;
  const [r, g, b] = [+m[1], +m[2], +m[3]];
  return g > r && g > b;
}

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

  // The row takes turns with the three lists (2026-08-28) and opens on the
  // LISTS, so the account row — where the UPDATE tab lives — is one tap away.
  if (!await page.isVisible('#accrow')) await page.click('#rowtog');
  await page.click('#accrow .acctab[data-acct="new"]');
  await page.waitForSelector('.nwcard[data-chat="chat-a"]');

  const cards = () => page.$$eval('.nwcard', ns => ns.map(n => n.dataset.chat));
  const chips = () => page.$$eval('#catrow .catchip', ns => ns.map(n => n.textContent.trim()));
  const bg = (c) => page.$eval('.nwcard[data-chat="' + c + '"]', n => getComputedStyle(n).backgroundColor);

  // 1/2. the pre-filed card is on the list at load, and it is mint
  let list = await cards();
  if (list.indexOf('chat-soon') < 0) fail('a card filed IN A MINUTE left the main list: ' + list.join(', '));
  const plain = await bg('chat-a');
  const mint = await bg('chat-soon');
  if (mint === plain) fail('the IN A MINUTE card has no tint (both ' + mint + ')');
  if (!isGreen(mint)) fail('the tint is not a green: ' + mint);
  if (isGreen(plain)) fail('an ordinary card is tinted too — the rule is too wide: ' + plain);
  const row = await chips();
  if (!/^In a minute.*1$/i.test(row[1] || '')) fail('the In a minute box should still count it: ' + row.join(' | '));

  // 3a. filing one now: it POSTs soon, stays put, and turns mint
  await page.click('.nwcard[data-chat="chat-a"] .nwck');
  await page.click('#catrow .catchip:nth-of-type(2)');
  await page.waitForTimeout(150);
  const post = queuePosts[queuePosts.length - 1] || {};
  if (post.queue !== 'soon' || !(post.chats || []).includes('chat-a')) {
    fail('IN A MINUTE did not file the card — ' + JSON.stringify(post));
  }
  list = await cards();
  if (list.indexOf('chat-a') < 0) fail('the just-filed card left the screen: ' + list.join(', '));
  if (!isGreen(await bg('chat-a'))) fail('the just-filed card did not turn mint');
  if (isGreen(await bg('chat-b'))) fail('filing one card tinted another');

  // 3b. …and COME BACK TO still takes a card away, untouched by any of this
  await page.click('.nwcard[data-chat="chat-b"] .nwck');
  await page.click('#catrow .catchip:nth-of-type(1)');
  await page.waitForTimeout(150);
  list = await cards();
  if (list.indexOf('chat-b') >= 0) fail('a COME BACK TO card should still leave the list: ' + list.join(', '));

  // 4. mint + picked: the outline still reads
  await page.click('.nwcard[data-chat="chat-a"] .nwck');
  const bw = await page.$eval('.nwcard[data-chat="chat-a"]', n => getComputedStyle(n).borderTopWidth);
  if (parseFloat(bw) < 2) fail('a picked mint card lost its outline (border ' + bw + ')');
  if (!isGreen(await bg('chat-a'))) fail('picking a mint card took its tint off');
  await page.click('.nwcard[data-chat="chat-a"] .nwck');

  // 6. the badge counts what is on the list — chat-a, chat-c, chat-soon
  const badge = await page.$eval('#accrow .acctab[data-acct="new"] .cc-new', n => n.textContent).catch(() => '');
  if (badge !== '3') fail('the Update badge should count the mint cards too, got "' + badge + '"');

  // 5. inside the box nothing is tinted — every card there is an IN A MINUTE
  await page.click('#catrow .catchip:nth-of-type(2)');
  await page.waitForTimeout(120);
  list = await cards();
  if (list.length !== 2 || list.indexOf('chat-soon') < 0 || list.indexOf('chat-a') < 0) {
    fail('the In a minute box should hold both filed cards, got: ' + list.join(', '));
  }
  if (isGreen(await bg('chat-soon'))) fail('a card is tinted inside its own box, where the tint says nothing');
  await page.click('#catrow .catchip:nth-of-type(2)');
  await page.waitForTimeout(120);

  // 7. un-filing takes the tint off
  await page.click('.nwcard[data-chat="chat-soon"] .nwck');
  await page.click('#catrow .catchip:nth-of-type(2)');
  await page.waitForTimeout(150);
  const off = queuePosts[queuePosts.length - 1] || {};
  if (off.queue !== '' || !(off.chats || []).includes('chat-soon')) {
    fail('tapping the box a card is already in should clear it — ' + JSON.stringify(off));
  }
  list = await cards();
  if (list.indexOf('chat-soon') < 0) fail('the un-filed card left the list: ' + list.join(', '));
  if (isGreen(await bg('chat-soon'))) fail('the tint survived un-filing');

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('PASS: an IN A MINUTE card stays on the Update list, in mint');
})().catch((e) => { console.error(e); process.exit(1); });
