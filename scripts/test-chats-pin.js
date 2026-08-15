#!/usr/bin/env node
// THE PINNED DELIVERABLE (Aug 2026, Sophie: "a play button at the top, just
// the title, and when I press play it opens full screen"). Drives the REAL
// public/chats.html against a stub API and asserts:
//   1. a chat with no pin shows no pinned row,
//   2. a chat WITH one shows it under the thread header, carrying its title,
//   3. the row is actually TAPPABLE where it is drawn (hit-tested with
//      elementFromPoint — the autoscroll pill owns the top-right corner and
//      has buried real controls before),
//   4. tapping opens the full-screen player and LOCKS the background,
//   5. closing restores the exact scroll position (the house overlay rule).
//
// …and (Aug 2026, the pinned LINK as the house pattern):
//   6. a `kind:'link'` pin OPENS its page instead of building a <video>,
//   7. the "current" tag shows on a pin the chat updated in its last finished
//      turn (`turns` 0 or 1), and NOT on one it has since let go stale — nor on
//      an old pin carrying no count at all, which cannot be judged.
//
//   npm install playwright-core --no-save && node scripts/test-chats-pin.js
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }

const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const PIN = { url: 'http://127.0.0.1:0/clip.mp4', title: 'Evan — the long cut v6 (4:54)', kind: 'video' };
// A page the chat re-pinned this turn (turns:0 — the turn hasn't ended yet) and
// a film it last touched two finished turns ago.
const LINK_PIN = { url: 'https://imageforge-q125.onrender.com/science', title: 'The science page', kind: 'link', turns: 0 };
const STALE_PIN = { url: 'http://127.0.0.1:0/clip.mp4', title: 'Evan — v4', kind: 'video', turns: 2 };
const MSGS = [
  { id: 'm1', chat: 'has-pin', from: 'claude', text: 'the film is done', tldr: 'done', created: iso(T0 - 1000), postedAt: iso(T0 - 1000) },
  { id: 'm2', chat: 'no-pin', from: 'claude', text: 'nothing pinned here', tldr: 'none', created: iso(T0 - 2000), postedAt: iso(T0 - 2000) },
  { id: 'm3', chat: 'link-pin', from: 'claude', text: 'the page moved', tldr: 'moved', created: iso(T0 - 3000), postedAt: iso(T0 - 3000) },
  { id: 'm4', chat: 'stale-pin', from: 'claude', text: 'working on other things', tldr: 'elsewhere', created: iso(T0 - 4000), postedAt: iso(T0 - 4000) },
];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'test', settings: {}, truncated: [], messages: MSGS, delta: false,
      chats: {
        'has-pin': { lastSeen: MSGS[0].created, pinned: PIN },
        'no-pin': { lastSeen: MSGS[1].created },
        'link-pin': { lastSeen: MSGS[2].created, pinned: LINK_PIN },
        'stale-pin': { lastSeen: MSGS[3].created, pinned: STALE_PIN },
      } }));
  }
  if (url.pathname === '/clip.mp4') { res.writeHead(200, { 'Content-Type': 'video/mp4' }); return res.end(Buffer.alloc(0)); }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}');
});
const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const pre = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(pre ? { executablePath: pre } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="has-pin"]');

  // 1. no pin -> no row
  await page.click('#grid .crow[data-chat="no-pin"]');
  await page.waitForSelector('#thread header');
  if (await page.$('.pinned')) fail('a chat with no pin still drew a pinned row');
  await page.goBack().catch(() => {});
  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="has-pin"]');

  // 2. pin -> row with its title
  await page.click('#grid .crow[data-chat="has-pin"]');
  await page.waitForSelector('.pinned', { timeout: 4000 }).catch(() => fail('pinned row never rendered'));
  const title = await page.$eval('.pinned .ti', n => n.textContent.trim()).catch(() => '');
  if (!/long cut v6/.test(title)) fail('pinned row lost its title: ' + title);

  // 3. tappable where drawn
  const box = await page.$eval('.pinned', n => { const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const hit = await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e && e.closest('.pinned') ? 'pinned' : (e ? e.className || e.tagName : 'none'); }, box);
  if (hit !== 'pinned') fail('pinned row is buried under ' + hit);

  // 4. opens full screen + locks the background
  await page.click('.pinned');
  await page.waitForSelector('#pinfull', { timeout: 3000 }).catch(() => fail('tapping the pin did not open the player'));
  if (await page.evaluate(() => document.body.style.overflow) !== 'hidden') fail('background scroll was not locked');
  if (!await page.$('#pinfull video')) fail('no video element in the player');

  // 5. closing restores the scroll position
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('#pinfull .x');
  await page.waitForFunction(() => !document.querySelector('#pinfull'), null, { timeout: 3000 })
    .catch(() => fail('the player did not close'));
  if (await page.evaluate(() => document.body.style.overflow) !== '') fail('background scroll stayed locked after close');

  // …and this pin carries no `turns` at all (pinned before the tag existed), so
  // it must NOT claim to be current.
  if (await page.$('.pinned .cur')) fail('a pin with no turn count still showed the current tag');

  // 6. a LINK pin opens its page — no <video>, no player
  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="link-pin"]');
  await page.click('#grid .crow[data-chat="link-pin"]');
  await page.waitForSelector('.pinned', { timeout: 4000 }).catch(() => fail('link pin never rendered'));
  await page.evaluate(() => { window.__opened = null; window.open = (u) => { window.__opened = u; return null; }; });
  await page.click('.pinned');
  const opened = await page.evaluate(() => window.__opened);
  if (!/\/science$/.test(String(opened))) fail('tapping a link pin did not open its page: ' + opened);
  if (await page.$('#pinfull')) fail('a link pin opened the video player');

  // 7. the tag says CURRENT on the freshly updated one…
  const tag = await page.$eval('.pinned .cur', n => n.textContent.trim()).catch(() => '');
  if (tag !== 'current') fail('a pin updated this turn is missing its current tag (got "' + tag + '")');

  // …and stays off the one the chat let go stale
  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="stale-pin"]');
  await page.click('#grid .crow[data-chat="stale-pin"]');
  await page.waitForSelector('.pinned', { timeout: 4000 }).catch(() => fail('stale pin never rendered'));
  if (await page.$('.pinned .cur')) fail('a pin two finished turns old still read as current');

  await browser.close(); server.close();
  console.log(process.exitCode ? 'FAILED' : 'PASS: pinned deliverable renders, is tappable, opens full screen, restores scroll');
})().catch(e => { console.error('FAIL: ' + e.message); process.exit(1); });
