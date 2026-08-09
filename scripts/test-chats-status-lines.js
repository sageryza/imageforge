#!/usr/bin/env node
// Status cards + her pinned note (Aug 2026, Sophie: "the line on what they
// need and maybe a summary of what that chat is currently working on… I also
// might want to add my own note"). Drives the REAL public/chats.html against
// a stub API and asserts:
//   1. a chat's card renders under its name on the home LIST — the ask in
//      rose (.cr-need), the working line quiet (.cr-snip), her note italic
//      (.cr-note) — and a card-less chat shows none of them (tiles carry the
//      same card via statusLines, but the tile view is dormant — Aug 2026,
//      list-only — so only the list is driven here),
//   2. the thread's "+ note" row shows her pinned note, editing it POSTs
//      /api/chatfeed/chatnote and repaints in place.
//
//   npm install playwright-core --no-save && node scripts/test-chats-status-lines.js
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
  { id: 'm1', chat: 'chat-card', from: 'claude', text: 'palette options are up', tldr: 'palettes up', created: iso(T0 - 3600000), postedAt: iso(T0 - 3600000) },
  { id: 'm2', chat: 'chat-bare', from: 'claude', text: 'plain old reply', tldr: 'auto tldr line', created: iso(T0 - 7200000), postedAt: iso(T0 - 7200000) },
];
const notePosts = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const reg = {
      'chat-card': {
        lastSeen: MSGS[0].created,
        statusNeed: 'Pick a palette — 10 seconds',
        statusDoing: 'Drawing the six lesson cards',
        sophieNote: 'keep it loose',
      },
      'chat-bare': { lastSeen: MSGS[1].created },
    };
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1', chats: reg, settings: {}, truncated: [],
      messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/api/chatfeed/chatnote' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      const p = JSON.parse(body || '{}');
      notePosts.push(p);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, chat: p.chat, note: p.note || null }));
    });
    return;
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
  await page.waitForSelector('#grid [data-chat="chat-card"]');

  // 1. LIST view: the card under the name
  const card = await page.$eval('#grid .crow[data-chat="chat-card"]', (n) => ({
    need: (n.querySelector('.cr-need') || {}).textContent || '',
    doing: (n.querySelector('.cr-snip') || {}).textContent || '',
    note: (n.querySelector('.cr-note') || {}).textContent || '',
  }));
  if (card.need.indexOf('Pick a palette') < 0) fail('list row missing the need line: ' + JSON.stringify(card));
  if (card.doing.indexOf('Drawing the six') < 0) fail('list row missing the doing line');
  // Her note is her own reminder — shown bare, no "you:" prefix (Aug 2026)
  if (card.note.indexOf('keep it loose') < 0) fail('list row missing her note: ' + card.note);
  if (card.note.indexOf('you:') === 0) fail('note grew a "you:" prefix again: ' + card.note);
  const bare = await page.$eval('#grid .crow[data-chat="chat-bare"]', (n) =>
    !!(n.querySelector('.cr-need') || n.querySelector('.cr-snip') || n.querySelector('.cr-note')));
  if (bare) fail('card-less chat grew status lines on the list');

  // 2. thread: her pinned note shows and edits in place
  await page.click('#grid .crow[data-chat="chat-card"]');
  await page.waitForSelector('#thread .noterow .noteshow');
  const shown = await page.$eval('#thread .noterow .noteshow', (n) => n.textContent);
  if (shown.indexOf('keep it loose') < 0) fail('thread note row missing her note: ' + shown);
  await page.click('#thread .noterow .noteshow');
  await page.waitForSelector('#thread .noterow textarea');
  await page.fill('#thread .noterow textarea', 'try the blues next');
  await page.$eval('#thread .noterow textarea', (n) => n.blur());
  await page.waitForFunction(() => {
    const s = document.querySelector('#thread .noterow .noteshow');
    return s && s.textContent.indexOf('try the blues next') >= 0;
  }, null, { timeout: 4000 }).catch(() => fail('edited note never repainted'));
  if (!notePosts.some((p) => p.chat === 'chat-card' && p.note === 'try the blues next')) {
    fail('POST /chatnote never carried the edited note: ' + JSON.stringify(notePosts));
  }
  // `app:true` is what makes the note field hers by construction — the route
  // 403s a post without it, so a chat can't write a changelog in there again.
  if (!notePosts.every((p) => p.app === true)) {
    fail('the app\'s /chatnote post is missing app:true — the server will refuse it');
  }

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures' : 'OK: status cards render on the home list, her note edits in place');
})().catch((e) => { console.error(e); process.exit(1); });
