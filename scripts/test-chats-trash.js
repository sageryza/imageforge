#!/usr/bin/env node
// Delete → trash → empty (Aug 2026, Sophie: "I'd like there to be a delete
// button as a second option to archive so I can delete this chat so it doesn't
// keep confusing things rather than just archive it, and I'd like deleted
// chats to go to a trash that I can empty"). Drives the REAL public/chats.html
// headless against a stub API and asserts:
//   1. a deleted chat is off the live list AND off the archive — deleting is
//      stronger than archiving, so stopping at one pile would leave it
//      reachable from the other,
//   2. Delete sits in the thread header beside Archive and POSTs /delete,
//      then leaves the chat (the same "ends with leaving" gesture as Archive),
//   3. the Trash view lists the deleted chats and Restore POSTs deleted:false
//      and puts the chat back on the live list,
//   4. Empty asks first and only POSTs /trash/empty when she confirms —
//      cancelling must destroy nothing,
//   5. the header's Trash word is reachable at 375/390/430 (the masthead is
//      tight and the autoscroll pill owns the top-right corner, so a new
//      control there has to be hit-tested, not eyeballed).
//
//   node scripts/test-chats-trash.js
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
  { id: 'm1', chat: 'chat-live', from: 'claude', text: 'an ordinary reply', tldr: 'live', created: iso(T0 - 3600000), postedAt: iso(T0 - 3600000) },
  { id: 'm2', chat: 'chat-gone', from: 'claude', text: 'the confusing one', tldr: 'gone', created: iso(T0 - 7200000), postedAt: iso(T0 - 7200000) },
  { id: 'm3', chat: 'chat-arch-gone', from: 'claude', text: 'archived and deleted', tldr: 'both', created: iso(T0 - 10800000), postedAt: iso(T0 - 10800000) },
];
const delPosts = [];
const emptyPosts = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  const body = (cb) => { let b = ''; req.on('data', (c) => b += c); req.on('end', () => cb(JSON.parse(b || '{}'))); };

  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    return json({
      build: 'test-build-1',
      chats: {
        'chat-live': { lastSeen: MSGS[0].created },
        'chat-gone': { lastSeen: MSGS[1].created, deletedAt: iso(T0 - 600000) },
        // deleted AND archived — must not show in the archive view either
        'chat-arch-gone': { lastSeen: MSGS[2].created, archived: true, deletedAt: iso(T0 - 300000) },
      },
      settings: {}, truncated: [],
      messages: since ? [] : MSGS, delta: !!since,
    });
  }
  if (url.pathname === '/api/chatfeed/delete' && req.method === 'POST') {
    return body((p) => { delPosts.push(p); json({ ok: true, deleted: p.deleted !== false }); });
  }
  if (url.pathname === '/api/chatfeed/trash/empty' && req.method === 'POST') {
    return body((p) => { emptyPosts.push(p); json({ ok: true, chats: 2, messages: 2, pages: 0, assets: 0 }); });
  }
  if (url.pathname === '/api/chatfeed/thread') return json({ messages: [] });
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
  await page.waitForSelector('#grid [data-chat="chat-live"]');

  // 1. a deleted chat is off the live list
  let rows = await page.$$eval('#grid .crow[data-chat]', (ns) => ns.map(n => n.dataset.chat));
  if (!rows.includes('chat-live')) fail('the live chat is missing from the list');
  if (rows.includes('chat-gone')) fail('a deleted chat is still on the live list');

  // …and off the ARCHIVE too (deleting is stronger than archiving)
  await page.click('#archlink');
  await page.waitForTimeout(150);
  rows = await page.$$eval('#grid .crow[data-chat]', (ns) => ns.map(n => n.dataset.chat));
  if (rows.includes('chat-arch-gone')) fail('a deleted chat still shows in the archive');
  await page.click('#archlink');
  await page.waitForTimeout(150);

  // 2. Delete in the thread header POSTs and leaves the chat
  await page.click('#grid .crow[data-chat="chat-live"]');
  await page.waitForSelector('#thread', { state: 'visible' });
  const hasDel = await page.$$eval('#thread header .no .archlink',
    (ns) => ns.some(n => n.textContent.trim() === 'Delete'));
  if (!hasDel) fail('no Delete button in the thread header');
  const hasArch = await page.$$eval('#thread header .no .archlink',
    (ns) => ns.some(n => n.textContent.trim() === 'Archive'));
  if (!hasArch) fail('Delete replaced Archive instead of joining it');

  await page.$$eval('#thread header .no .archlink',
    (ns) => ns.find(n => n.textContent.trim() === 'Delete').click());
  await page.waitForSelector('.askbox', { timeout: 3000 }).catch(() => fail('Delete did not confirm first'));
  await page.$$eval('.askbox button', (ns) => ns.find(n => n.textContent.trim() === 'Delete').click());
  await page.waitForTimeout(300);
  if (!delPosts.some(p => p.chat === 'chat-live' && p.deleted !== false)) fail('Delete did not POST /delete');
  const backHome = await page.$eval('#thread', (n) => getComputedStyle(n).display === 'none' || !n.offsetParent);
  if (!backHome) fail('Delete did not leave the chat');
  rows = await page.$$eval('#grid .crow[data-chat]', (ns) => ns.map(n => n.dataset.chat));
  if (rows.includes('chat-live')) fail('the deleted chat is still on the list after deleting');

  // 3. the Trash view lists them, and Restore puts one back
  await page.click('#trashlink');
  await page.waitForTimeout(200);
  const title = await page.$eval('#htxt', (n) => n.textContent.trim());
  if (title !== 'Trash') fail('the masthead does not say Trash (got "' + title + '")');
  const trashed = await page.$$eval('#grid .clist .crow .cr-name', (ns) => ns.map(n => n.textContent.trim()));
  if (trashed.length !== 3) fail('the trash should hold 3 chats, holds ' + trashed.length);

  await page.$$eval('#grid .clist .crow', (ns) => {
    const row = ns.find(n => n.querySelector('.cr-name').textContent.trim() === 'chat-gone');
    row.querySelector('.archlink').click();
  });
  await page.waitForTimeout(300);
  if (!delPosts.some(p => p.chat === 'chat-gone' && p.deleted === false)) fail('Restore did not POST deleted:false');
  await page.click('#trashlink');           // back to the live list
  await page.waitForTimeout(200);
  rows = await page.$$eval('#grid .crow[data-chat]', (ns) => ns.map(n => n.dataset.chat));
  if (!rows.includes('chat-gone')) fail('a restored chat did not come back to the live list');

  // 4. Empty asks first — cancelling destroys nothing
  await page.click('#trashlink');
  await page.waitForTimeout(200);
  await page.click('#grid .trashbar .tbtn');
  await page.waitForSelector('.askbox', { timeout: 3000 }).catch(() => fail('Empty did not confirm first'));
  await page.$$eval('.askbox button', (ns) => ns.find(n => n.textContent.trim() === 'Cancel').click());
  await page.waitForTimeout(200);
  if (emptyPosts.length) fail('cancelling Empty still POSTed /trash/empty');

  // …and confirming does empty it
  await page.click('#grid .trashbar .tbtn');
  await page.waitForSelector('.askbox', { timeout: 3000 });
  await page.$$eval('.askbox button', (ns) => ns.find(n => n.textContent.trim() === 'Delete forever').click());
  await page.waitForTimeout(300);
  if (!emptyPosts.length) fail('confirming Empty did not POST /trash/empty');

  // 5. the Trash word is actually tappable at every width — the masthead is
  // tight and the autoscroll pill owns the top-right corner
  for (const width of [375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(120);
    const ok = await page.evaluate(() => {
      const b = document.getElementById('trashlink');
      const r = b.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return 'zero-size';
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return (hit === b || b.contains(hit)) ? true : 'covered by ' + (hit ? (hit.id || hit.className || hit.tagName) : 'nothing');
    });
    if (ok !== true) fail('the Trash word is not tappable at ' + width + 'px (' + ok + ')');
  }

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('PASS: delete → trash → restore → empty, and the Trash word is reachable at 375/390/430');
})();
