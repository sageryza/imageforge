#!/usr/bin/env node
// LEAVING A COMMENT ON AN IMAGE MUST NOT MOVE THE PAGE UNDER IT (Aug 2026,
// Sophie: "when I leave a comment on an asset in chats app it scrolls me down
// so I'm in a different place when I get out of the comment area").
//
// The cause is the house overlay rule going unfollowed in ONE place: the
// Assets lightbox locked body.overflow but never saved/restored scrollY.
// Focusing the note box focuses an input inside a position:fixed overlay, and
// iOS scrolls the DOCUMENT underneath to reveal the caret — overflow:hidden
// does not stop that — so closing the image landed her somewhere else in the
// tab. A headless browser has no keyboard, so the test scrolls the document
// under the open lightbox the same way iOS does (and PROVES it moved first,
// or the restore below would pass against a page that never budged).
//
// Asserts, driving the REAL public/chats.html against a stub API:
//   1. the Assets tab really is scrollable and the picture opens with a note box,
//   2. her comment really is sent (the flow under test is the real one),
//   3. the page CAN move under the open lightbox — the premise of the bug,
//   4. closing lands back EXACTLY where she opened the picture, and
//   5. an ordinary open/close with no comment is unchanged.
//
//   npm install playwright-core --no-save && node scripts/test-chats-comment-scroll.js
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

const CHAT = 'chat-pics';
const MSGS = [{ id: 'm1', chat: CHAT, from: 'claude', text: 'the batch is up', tldr: 'batch up',
                created: iso(T0 - 3600000), postedAt: iso(T0 - 3600000) }];

// enough tiles that the Assets tab is much taller than the screen
const ASSETS = [];
for (let i = 0; i < 60; i++) {
  ASSETS.push({ url: '/px.png?a=' + i, thumb: '/px.png?a=' + i,
                description: 'picture ' + i, prompt: 'gpt-image-2 · medium', thread: [] });
}

const notesPosted = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    return json({ build: 'test-build-1', chats: { [CHAT]: { lastSeen: MSGS[0].created } },
                  settings: {}, truncated: [], messages: since ? [] : MSGS, delta: !!since });
  }
  if (url.pathname === '/api/gallery/assets' && req.method === 'GET') {
    // honour offset — the page pages as she scrolls, and a stub that ignores
    // it re-serves page one, piling duplicate tiles into the grid and changing
    // the page HEIGHT under the test
    const offset = Number(url.searchParams.get('offset') || 0);
    const limit = Number(url.searchParams.get('limit') || 150);
    return json({ assets: ASSETS.slice(offset, offset + limit), total: ASSETS.length, offset, limit });
  }
  if (url.pathname === '/api/gallery/assets/note' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      let b = {}; try { b = JSON.parse(body); } catch {}
      if (b.text) notesPosted.push(b.text);
      json({ ok: true, thread: b.text ? [{ from: 'sophie', text: b.text, at: iso(Date.now()) }] : [] });
    });
  }
  if (url.pathname === '/px.png' || url.pathname === '/api/story/thumb') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(PX);
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  if (url.pathname === '/asset-lightbox.js') {   // the shared lightbox the page delegates to
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, 'asset-lightbox.js'), 'utf8'));
  }
  json({});
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const y = (page) => page.evaluate(() => window.scrollY);

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="' + CHAT + '"]');
  await page.click('#grid [data-chat="' + CHAT + '"]');
  await page.waitForSelector('.tg-assets');
  await page.click('.tg-assets');
  await page.waitForSelector('.assetgrid .acell button:not(.vote)');

  // 1. she has scrolled a long way down the tab before tapping a picture
  const tall = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  if (tall < 900) fail('the Assets tab is not tall enough to test scrolling: ' + tall);
  await page.evaluate(() => window.scrollTo(0, 700));
  const openedAt = await y(page);
  if (openedAt < 600) fail('could not scroll the Assets tab down: y=' + openedAt);

  // `.acell button` also matches the tile's ♥ and ✕ — take the picture itself
  const cells = await page.$$('.assetgrid .acell button:not(.vote)');
  await cells[12].evaluate((el) => el.click());   // the ♥/✕ overlay the tile, so tap it directly
  await page.waitForSelector('#clightbox .lbnote input');

  // 2. she writes a comment and sends it
  await page.click('#clightbox .lbnote input');
  await page.type('#clightbox .lbnote input', 'redo this one warmer');
  await page.click('#clightbox .notesend');
  await page.waitForFunction(() => !!document.querySelector('#clightbox .lbmsg.me'), null, { timeout: 4000 })
    .catch(() => fail('the note never appeared in the thread'));
  await page.waitForTimeout(200);
  if (!notesPosted.includes('redo this one warmer')) fail('the note was never sent to the server');

  // 3. the premise: the document CAN move under the open lightbox (this is
  //    what iOS does to reveal the caret; overflow:hidden does not stop it)
  await page.evaluate(() => window.scrollTo(0, 60));
  const under = await y(page);
  if (Math.abs(under - openedAt) < 100) fail('the page did not move under the lightbox, so the restore is untested');

  // 4. closing lands back exactly where she opened the picture
  await page.evaluate(() => document.getElementById('clightbox').click());
  await page.waitForFunction(() => document.getElementById('clightbox').style.display === 'none',
    null, { timeout: 4000 }).catch(() => fail('the lightbox never closed'));
  await page.waitForTimeout(150);   // the next-frame restore
  const back = await y(page);
  if (Math.abs(back - openedAt) > 2) fail('left the comment at y=' + openedAt + ' and came back to y=' + back);

  // 5. an ordinary open/close, no comment, is unchanged
  await page.evaluate(() => window.scrollTo(0, 900));
  const plainAt = await y(page);
  const cells2 = await page.$$('.assetgrid .acell button:not(.vote)');
  await cells2[20].evaluate((el) => el.click());
  await page.waitForSelector('#clightbox .lbnote input');
  await page.evaluate(() => document.getElementById('clightbox').click());
  await page.waitForTimeout(150);
  const plainBack = await y(page);
  if (Math.abs(plainBack - plainAt) > 2) fail('a plain open/close moved the page: ' + plainAt + ' → ' + plainBack);

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('PASS: leaving a comment on an image lands back where she opened it');
})().catch((e) => { console.error(e); process.exit(1); });
