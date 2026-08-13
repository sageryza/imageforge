#!/usr/bin/env node
// ARCHIVING ASKS WHICH PILE, AND WHAT TO CALL IT (Aug 2026, Sophie: "the
// archive should have an option to add it into the built or other pile and
// also give an option to type a text box as a title for what it saves under…
// there's already a pop-up for archive so you can just add it to the top").
//
// Driven against the REAL page in headless Chromium, because every question
// here is about what the sheet DOES: the two controls exist above the
// question, BUILT is preselected, picking OTHER files the chat there, the name
// box is prefilled and only renames when she actually changes it, and Cancel
// writes nothing at all.
//
// Run: node scripts/test-chats-archive-sheet.js
// playwright is an optionalDependency, so this skips cleanly without it.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); }
}

const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();

const MSGS = [
  { id: 'm1', chat: 'chat-one', from: 'claude', text: 'a reply', tldr: 'one', created: iso(T0 - 1000), postedAt: iso(T0 - 1000) },
  { id: 'm2', chat: 'chat-two', from: 'claude', text: 'another', tldr: 'two', created: iso(T0 - 2000), postedAt: iso(T0 - 2000) },
  { id: 'm3', chat: 'chat-three', from: 'claude', text: 'third', tldr: 'three', created: iso(T0 - 3000), postedAt: iso(T0 - 3000) },
];
const CHATS = {
  'chat-one': { account: '1', lastSeen: MSGS[0].created, displayName: 'The oven one' },
  'chat-two': { account: '1', lastSeen: MSGS[1].created },
  'chat-three': { account: '1', lastSeen: MSGS[2].created },
};

let fails = 0;
const ok = (name, cond, extra) => {
  if (cond) { console.log('  ok   ' + name); return; }
  fails++; console.log('  FAIL ' + name + (extra ? '\n       ' + extra : ''));
};

const posts = { archive: [], kind: [], rename: [] };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  const body = (cb) => { let b = ''; req.on('data', (c) => b += c); req.on('end', () => cb(JSON.parse(b || '{}'))); };
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    return json({
      build: 'b1', chats: CHATS, settings: { appAccount: '1', categories: [] },
      truncated: [], messages: since ? [] : MSGS, delta: !!since,
    });
  }
  if (url.pathname === '/api/chatfeed/archive' && req.method === 'POST') return body((p) => { posts.archive.push(p); json({ ok: true }); });
  if (url.pathname === '/api/chatfeed/archive-kind' && req.method === 'POST') return body((p) => { posts.kind.push(p); json({ ok: true }); });
  if (url.pathname === '/api/chatfeed/rename' && req.method === 'POST') return body((p) => { posts.rename.push(p); json({ ok: true }); });
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  json({ ok: true, messages: [], todos: [], bookmarks: [], assets: [], pages: [] });
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const openSheet = async (chat) => {
    await page.click('#back').catch(() => {});
    await page.waitForSelector('#grid .crow[data-chat="' + chat + '"]');
    await page.click('#grid .crow[data-chat="' + chat + '"]');
    await page.waitForSelector('#thread .archlink.arch-g');
    await page.$$eval('#thread .archlink', (ns) => ns.find((n) => n.textContent.trim() === 'Archive').click());
    await page.waitForSelector('.askwrap .arctabs', { timeout: 4000 });
  };

  try {
    await page.goto(base + '/chats');
    await page.waitForSelector('#grid [data-chat="chat-one"]');

    // ---- the sheet's shape -------------------------------------------------
    await openSheet('chat-one');
    ok('the archive sheet has a name box', !!(await page.$('.askwrap .arcname')));
    ok('…and the pile tabs', !!(await page.$('.askwrap .arctabs')));
    const labels = await page.$$eval('.askwrap .arctabs .acctab', (ns) => ns.map((n) => n.textContent.trim()));
    ok('two piles, Built on the left', labels.length === 2 && /built/i.test(labels[0]) && /other/i.test(labels[1]),
      labels.join(','));

    // she said "add it to the top" — both new controls sit ABOVE the question
    const order = await page.evaluate(() => {
      const y = (s) => { const n = document.querySelector(s); return n ? n.getBoundingClientRect().top : -1; };
      return { name: y('.askwrap .arcname'), tabs: y('.askwrap .arctabs'), q: y('.askbox p'), row: y('.askrow') };
    });
    ok('the name box is at the top', order.name < order.tabs && order.name < order.q, JSON.stringify(order));
    ok('the pile tabs sit above the question', order.tabs < order.q, JSON.stringify(order));
    ok('the buttons stay at the bottom', order.row > order.q, JSON.stringify(order));

    // the box carries the chat's CURRENT name, not example text
    ok('the name box is prefilled with what it is called now',
      (await page.$eval('.askwrap .arcname', (n) => n.value)) === 'The oven one');
    ok('BUILT is preselected', (await page.$eval('.askwrap .arctabs', (n) => n.dataset.on)) === '0');

    // and it is genuinely the hairline pattern — line one tab wide
    const lw = await page.evaluate(() => getComputedStyle(document.querySelector('.askwrap .arctabs'), '::after').width);
    const rw = await page.$eval('.askwrap .arctabs', (n) => n.getBoundingClientRect().width);
    ok('the sliding line is one tab wide', Math.abs(parseFloat(lw) - rw / 2) < 2, lw + ' of ' + rw);

    // ---- Cancel writes NOTHING --------------------------------------------
    await page.fill('.askwrap .arcname', 'something else');
    await page.$$eval('.askwrap .arctabs .acctab', (ns) => ns[1].click());
    await page.click('.askrow button:not(.go)');
    await page.waitForTimeout(200);
    ok('Cancel archives nothing', posts.archive.length === 0, JSON.stringify(posts.archive));
    ok('Cancel files nothing', posts.kind.length === 0, JSON.stringify(posts.kind));
    ok('Cancel renames nothing', posts.rename.length === 0, JSON.stringify(posts.rename));

    // ---- leaving both alone: archive only, no rename, no pile write --------
    await openSheet('chat-one');
    await page.click('.askrow button.go');
    await page.waitForTimeout(400);
    ok('archiving posts the archive', posts.archive.some((p) => p.chat === 'chat-one' && p.archived === true),
      JSON.stringify(posts.archive));
    ok('an untouched name box renames nothing', posts.rename.length === 0, JSON.stringify(posts.rename));
    ok('leaving it on BUILT writes no pile mark', posts.kind.length === 0, JSON.stringify(posts.kind));

    // ---- picking OTHER + renaming -----------------------------------------
    await openSheet('chat-two');
    await page.fill('.askwrap .arcname', 'Google Takeout mess');
    await page.$$eval('.askwrap .arctabs .acctab', (ns) => ns[1].click());
    ok('picking Other moves the line', (await page.$eval('.askwrap .arctabs', (n) => n.dataset.on)) === '1');
    await page.click('.askrow button.go');
    await page.waitForTimeout(500);
    ok('the chat is filed under Other',
      posts.kind.some((p) => p.chat === 'chat-two' && p.kind === 'other'), JSON.stringify(posts.kind));
    ok('…and renamed to what she typed',
      posts.rename.some((p) => p.chat === 'chat-two' && p.name === 'Google Takeout mess'), JSON.stringify(posts.rename));
    ok('…and archived', posts.archive.some((p) => p.chat === 'chat-two' && p.archived === true));

    // it lands in the archive already named and already in its pile
    await page.waitForSelector('#grid .crow', { timeout: 4000 }).catch(() => {});
    await page.click('#archlink');
    await page.waitForSelector('#grid .archtabs');
    await page.$$eval('#grid .archtabs .acctab', (ns) => ns[1].click());
    await page.waitForTimeout(200);
    const otherRows = await page.$$eval('#grid .crow', (ns) => ns.map((n) => ({
      chat: n.dataset.chat, name: n.querySelector('.cr-name').textContent.trim() })));
    ok('it is sitting in the Other pile under its new name',
      otherRows.some((r) => r.chat === 'chat-two' && r.name === 'Google Takeout mess'),
      JSON.stringify(otherRows));

    // ---- a chat with no display name prefills its slug ---------------------
    await page.click('#archlink');
    await openSheet('chat-three');
    ok('an unnamed chat prefills its own name',
      (await page.$eval('.askwrap .arcname', (n) => n.value)) === 'chat-three');
    await page.click('.askrow button:not(.go)');
  } finally {
    await browser.close();
    server.close();
  }

  if (fails) { console.log('\n' + fails + ' FAILED'); process.exit(1); }
  console.log('\nPASS: archiving asks which pile and what to call it');
})().catch((e) => { console.error(e); process.exit(1); });
