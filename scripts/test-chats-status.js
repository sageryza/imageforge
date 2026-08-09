#!/usr/bin/env node
// The Status view (Aug 2026, Sophie's ask: "some sort of page that prioritizes
// things and shows me OK, this is what's done, this is what's waiting on you,
// these are the assets that were just delivered"). Drives the REAL
// public/chats.html in a headless browser against a stub API and asserts:
//   1. the header's status icon opens the view (title says Status),
//   2. chats bucket correctly — the chats she HID lead WAITING, then unread;
//      a working chat rows under WORKING with the live tint; an answered
//      chat rows under MARKED DONE, grayed,
//   3. the delivered strip renders the cross-chat assets + the new page row,
//   4. the ✓ on a waiting row marks the chat answered without opening it,
//   5. tapping a delivered thumb opens that chat (its Assets tab).
//
//   npm install playwright-core --no-save && node scripts/test-chats-status.js
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
const PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

const MSGS = [
  { id: 'm1', chat: 'chat-wait', from: 'claude', text: 'finished the storyboard', tldr: 'storyboard done', created: iso(T0 - 3600000), postedAt: iso(T0 - 3600000) },
  { id: 'm2', chat: 'chat-hide', from: 'claude', text: 'options are up', tldr: 'options ready', created: iso(T0 - 7200000), postedAt: iso(T0 - 7200000) },
  { id: 'm3', chat: 'chat-done', from: 'claude', text: 'shipped it', tldr: 'shipped', created: iso(T0 - 10800000), postedAt: iso(T0 - 10800000) },
  { id: 'm4', chat: 'chat-work', from: 'claude', text: 'older reply', tldr: 'older', created: iso(T0 - 3600000), postedAt: iso(T0 - 3600000) },
];
const answeredPosts = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const reg = {
      'chat-wait': { lastSeen: MSGS[0].created },
      'chat-hide': { lastSeen: MSGS[1].created, hiddenAt: iso(T0) },
      'chat-done': { lastSeen: MSGS[2].created, answeredAt: iso(T0) },
      'chat-work': { lastSeen: MSGS[3].created, workingAt: iso(T0) },
    };
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1', chats: reg, settings: {}, truncated: [],
      messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/api/gallery/assets/recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ assets: [
      { url: '/px.png?a=1', thumb: '/px.png?a=1', chat: 'chat-wait', created: iso(T0 - 600000), description: 'Penny — the blue Kleenex' },
      { url: '/px.png?a=2', thumb: '/px.png?a=2', chat: 'chat-hide', created: iso(T0 - 1200000) },
    ] }));
  }
  if (url.pathname === '/api/chatfeed/pages-recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ pages: [
      { id: 'p1', title: 'Storyboard v2 — tightest cut', chat: 'chat-wait', created: iso(T0 - 900000) },
    ] }));
  }
  if (url.pathname === '/api/chatfeed/answered' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      answeredPosts.push(JSON.parse(body || '{}'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, answeredAt: iso(Date.now()) }));
    });
    return;
  }
  if (url.pathname === '/api/gallery/assets') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ assets: [], total: 0, offset: 0, limit: 150 }));
  }
  if (url.pathname === '/px.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(PX);
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
  const page = await browser.newPage();

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="chat-wait"]');

  // 1. the header icon opens the view
  await page.click('#stlink');
  await page.waitForFunction(() => document.getElementById('htitle').textContent === 'Status');

  // 2. bucketing + ordering: hidden first among waiting, working tinted,
  //    answered grayed under done
  const rows = await page.$$eval('#grid .crow[data-chat]', (ns) => ns.map((n) => ({
    chat: n.dataset.chat, live: n.classList.contains('live'), done: n.classList.contains('done'),
  })));
  const order = rows.map((r) => r.chat);
  if (JSON.stringify(order) !== JSON.stringify(['chat-hide', 'chat-wait', 'chat-work', 'chat-done'])) {
    fail('row order wrong: ' + order.join(','));
  }
  const work = rows.find((r) => r.chat === 'chat-work');
  if (!work || !work.live) fail('working chat missing the live tint');
  const doneRow = rows.find((r) => r.chat === 'chat-done');
  if (!doneRow || !doneRow.done) fail('answered chat not grayed under Marked done');
  const heads = await page.$$eval('#grid .sthead', (ns) => ns.map((n) => n.textContent.trim()));
  if (!heads[0] || heads[0].indexOf('Waiting on you') !== 0) fail('first section is not Waiting on you: ' + heads.join(' | '));

  // 3. the delivered strip + the new-page row
  await page.waitForSelector('#grid .stgrid .stcell', { timeout: 4000 })
    .catch(() => fail('delivered thumbs never rendered'));
  const cells = await page.$$('#grid .stgrid .stcell');
  if (cells.length !== 2) fail('expected 2 delivered thumbs, got ' + cells.length);
  const pageRow = await page.$$eval('#grid .pagerow .pr-title', (ns) => ns.map((n) => n.textContent));
  if (!pageRow.some((t) => t.indexOf('Storyboard v2') >= 0)) fail('new Compare page row missing');

  // 4. the ✓ on a waiting row marks answered without opening the chat
  await page.click('#grid .crow[data-chat="chat-wait"] .ckbtn');
  await page.waitForFunction(() =>
    document.querySelector('#grid .crow[data-chat="chat-wait"]').classList.contains('done'),
    null, { timeout: 4000 }).catch(() => fail('✓ did not gray the waiting row'));
  await page.waitForFunction(() => document.getElementById('htitle').textContent === 'Status')
    .catch(() => fail('marking answered left the Status view'));
  if (!answeredPosts.some((p) => p.chat === 'chat-wait' && p.answered)) fail('POST /answered never fired for chat-wait');

  // 5. a delivered thumb opens its chat (the Assets tab)
  await page.click('#grid .stgrid .stcell');
  await page.waitForFunction(() => document.getElementById('thread').style.display !== 'none',
    null, { timeout: 4000 }).catch(() => fail('tapping a delivered thumb never opened the chat'));

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures' : 'OK: status view buckets, delivers, triages and deep-links');
})().catch((e) => { console.error(e); process.exit(1); });
