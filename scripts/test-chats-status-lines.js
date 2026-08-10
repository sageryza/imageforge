#!/usr/bin/env node
// Status cards + her pinned note (Aug 2026, Sophie: "the line on what they
// need and maybe a summary of what that chat is currently working on… I also
// might want to add my own note"). Drives the REAL public/chats.html against
// a stub API and asserts:
//   1. ONE line renders under a chat name on the home LIST, styled like her
//      own notes (italic, not bold, not rose); HER note supersedes the
//      chat card, a chat with no note of hers shows its own line, and a
//      card-less chat shows nothing (the tile view shares statusLines but is
//      dormant — Aug 2026, list-only — so only the list is driven here),
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
  { id: 'm3', chat: 'chat-card2', from: 'claude', text: 'options up too', tldr: 'options up', created: iso(T0 - 9000000), postedAt: iso(T0 - 9000000) },
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
      // a chat card with NO note of hers — its own line should show; it ALSO
      // carries the v11 stale-hook mark, which rides as its own second line
      // (detection telemetry — Sophie sees which chats need the heal paste)
      'chat-card2': {
        lastSeen: MSGS[2].created,
        statusNeed: 'Pick a palette, 10 seconds',
        statusDoing: 'six lesson cards, drawing now',
        hookStale: true,
      },
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

  // 1. ONE line under the name, and HERS wins over the chat's card
  const card = await page.$eval('#grid .crow[data-chat="chat-card"]', (n) => {
    const ls = n.querySelectorAll('.cr-note');
    const s = ls[0] ? getComputedStyle(ls[0]) : null;
    return {
      count: ls.length,
      text: ls[0] ? ls[0].textContent : '',
      italic: s ? s.fontStyle : '', weight: s ? s.fontWeight : '', color: s ? s.color : '',
      rose: s ? getComputedStyle(document.documentElement).getPropertyValue('--rose').trim() : '',
      quiet: s ? getComputedStyle(document.documentElement).getPropertyValue('--ink2').trim() : '',
    };
  });
  if (card.count !== 1) fail('expected exactly ONE line under the name, got ' + card.count);
  // her note supersedes the chat's need/doing entirely
  if (card.text.indexOf('keep it loose') < 0) fail('her note should win the line, got: ' + card.text);
  if (card.text.indexOf('you:') === 0) fail('note grew a "you:" prefix again: ' + card.text);
  // styled like hers: italic, not bold, not rose
  if (card.italic !== 'italic') fail('the line is not italic: ' + card.italic);
  if (!(card.weight === '400' || card.weight === 'normal')) fail('the line is bold: ' + card.weight);
  if (card.rose && card.color.replace(/\s/g, '') === card.rose.replace(/\s/g, '')) fail('the line is rose');
  // a chat's own card takes the line when she has written no note — plus the
  // v11 stale-hook mark as its own quiet line (never replacing the status)
  const chatLine = await page.$eval('#grid .crow[data-chat="chat-card2"]', (n) => {
    const ls = n.querySelectorAll('.cr-note');
    return { count: ls.length, text: ls[0] ? ls[0].textContent : '',
             hook: n.querySelector('.cr-hook') ? n.querySelector('.cr-hook').textContent : '' };
  });
  if (chatLine.count !== 2) fail('expected the status line + the stale-hook mark, got ' + chatLine.count);
  if (chatLine.text.indexOf('Pick a palette') < 0) fail('the ask should take the line, got: ' + chatLine.text);
  if (chatLine.hook.indexOf('hook out of date') < 0) fail('the stale-hook mark is missing: ' + chatLine.hook);
  const bare = await page.$eval('#grid .crow[data-chat="chat-bare"]', (n) => ({
    notes: n.querySelectorAll('.cr-note').length, hook: !!n.querySelector('.cr-hook') }));
  if (bare.notes) fail('card-less chat grew a status line on the list');
  if (bare.hook) fail('a chat with no telemetry got a stale mark');

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

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures' : 'OK: status cards render on the home list, her note edits in place');
})().catch((e) => { console.error(e); process.exit(1); });
