#!/usr/bin/env node
// The MORE fold, two bugs Sophie reported together (Aug 2026: "two problems
// with the hidden more section … the messages are gone that might be fine but
// there's also no button to get back into that chat. The other thing is that
// when I click more, it takes me all the way back to the top and should stay
// where I am").
//
// Drives the REAL public/chats.html in headless Chromium and asserts:
//   1. tapping MORE leaves her scroll position exactly where it was,
//   2. the HIDDEN bar still lands at the TOP — it replaces the whole screen
//      (it is a place she goes), so keeping her spot there would be wrong,
//   3. a chat whose thread comes back EMPTY still carries the Open-in-Claude
//      button, pointing at the url on its registry doc,
//   4. …and a chat with no url on file draws no button — never an invented one,
//   5. a thread that HAS messages is untouched (no second door in the empty
//      state, because there is no empty state).
//
// The scroll half has to be MEASURED, not reasoned about: nothing in the page
// ever scrolled her: renderHome empties #grid, the page is briefly nothing
// tall, and the browser clamps scrollY to 0 on its own. Only a real layout in
// a real browser shows that.
//
//   npm install playwright-core --no-save && node scripts/test-chats-more-spot.js
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
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();

// enough fresh chats that the page is genuinely taller than the phone, or
// there is no scroll position to lose and the test proves nothing.
const MSGS = [];
const CHATS = {};
for (let i = 0; i < 40; i++) {
  const n = 'fresh-' + String(i).padStart(2, '0');
  MSGS.push({ id: 'f' + i, chat: n, from: 'claude', text: 'today ' + i, tldr: 't' + i,
    created: iso(T0 - 3600000 - i * 1000), postedAt: iso(T0 - 3600000 - i * 1000),
    url: 'https://claude.ai/code/session_fresh' + i });
  CHATS[n] = { lastSeen: MSGS[i].created, url: 'https://claude.ai/code/session_fresh' + i };
}
// stale, with history — folds into MORE and opens with messages (§5)
MSGS.push({ id: 'old1', chat: 'old-talky', from: 'claude', text: 'nine days ago', tldr: 'old',
  created: iso(T0 - 9 * DAY), postedAt: iso(T0 - 9 * DAY), url: 'https://claude.ai/code/session_talky' });
CHATS['old-talky'] = { lastSeen: iso(T0 - 9 * DAY), url: 'https://claude.ai/code/session_talky' };
// in the registry, nothing in the feed, but the session url IS on file — the
// exact shape she hit
CHATS['quiet-with-url'] = { url: 'https://claude.ai/code/session_quiet' };
// nothing in the feed and no url either — nothing to offer, so nothing shown
CHATS['quiet-no-url'] = {};
// one chat parked in the hidden pile, so the hidden bar exists for §2
CHATS['parked'] = { lastSeen: MSGS[0].created, hiddenAt: iso(T0 - 60000), url: 'https://claude.ai/code/session_parked' };
MSGS.push({ id: 'p1', chat: 'parked', from: 'claude', text: 'parked', tldr: 'p',
  created: MSGS[0].created, postedAt: MSGS[0].created, url: 'https://claude.ai/code/session_parked' });

const TRUNCATED = ['quiet-with-url', 'quiet-no-url'];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    return json({ build: 'test-build-1', chats: CHATS, settings: {}, truncated: TRUNCATED,
      messages: since ? [] : MSGS, delta: !!since });
  }
  // the quiet chats really have nothing — an empty thread that never repairs
  if (url.pathname === '/api/chatfeed/thread') return json({ messages: [] });
  if (url.pathname === '/api/gallery/assets/recent') return json({ assets: [] });
  if (url.pathname === '/api/chatfeed/pages-recent') return json({ pages: [] });
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  json({});
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };

// out of a thread and back to the fold — the title is the way out of a chat
async function backHome(page) {
  await page.evaluate(() => document.getElementById('back').click());
  await page.waitForSelector('#grid .crow[data-chat]', { timeout: 4000 });
  await page.evaluate(() => window.__setMoreOpen(true));
}

// Scroll so the bar is on screen, read the position, tap it WITHOUT letting
// playwright scroll for us, read the position again.
async function tapAndMeasure(page, sel) {
  await page.evaluate((s) => {
    document.querySelector(s).scrollIntoView({ block: 'center' });
  }, sel);
  await page.waitForTimeout(120);
  const before = await page.evaluate(() => window.scrollY);
  await page.evaluate((s) => document.querySelector(s).click(), sel);
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.scrollY);
  return { before, after };
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 664 } });

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="fresh-00"]');

  // ---- 1. MORE keeps her spot ------------------------------------------
  if (!await page.$('.morebar')) return void fail('no More bar to tap'), browser.close(), server.close();
  const open = await tapAndMeasure(page, '.morebar');
  if (open.before < 100) fail('the fixture page was not tall enough to have a spot to lose (y=' + open.before + ')');
  if (Math.abs(open.after - open.before) > 2)
    fail('opening More moved her from y=' + open.before + ' to y=' + open.after);
  await page.waitForSelector('#grid .morelist .crow[data-chat="old-talky"]', { timeout: 4000 })
    .catch(() => fail('tapping More never opened the fold'));

  // closing it is the same gesture and must behave the same way (the browser
  // may clamp when the page gets shorter — that is allowed, a jump to 0 is not)
  const shut = await tapAndMeasure(page, '.morebar');
  if (shut.after === 0 && shut.before > 0)
    fail('closing More threw her back to the top (from y=' + shut.before + ')');

  // ---- 2. the HIDDEN bar is the OPPOSITE, on purpose --------------------
  // The open pile replaces the whole screen — a place she goes, like the
  // archive — so it lands at the top and the way back out already does too.
  // Pinned here so a later "make the folds consistent" tidy-up has to read
  // this rather than discover it in her hands.
  if (!await page.$('.hidebar')) fail('no hidden bar drawn — the parked fixture chat did not park');
  else {
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.evaluate(() => document.querySelector('.hidebar').click());
    await page.waitForTimeout(150);
    if (await page.evaluate(() => window.scrollY) !== 0)
      fail('opening the hidden pile left her partway down a screen it had replaced');
    if (await page.$('.morebar')) fail('the open hidden pile did not take over the screen');
    await page.evaluate(() => document.querySelector('.hidebar').click());
    await page.waitForTimeout(150);
  }

  // ---- 3. an empty thread carries the way back in -----------------------
  await page.evaluate(() => window.__setMoreOpen(true));
  await page.waitForSelector('#grid .morelist .crow[data-chat="quiet-with-url"]', { timeout: 4000 })
    .catch(() => fail('quiet-with-url never showed in the fold'));
  await page.click('#grid .morelist .crow[data-chat="quiet-with-url"]');
  await page.waitForSelector('#thread .state', { timeout: 4000 })
    .catch(() => fail('the quiet chat did not open on an empty state'));
  const doorHref = await page.$eval('#thread .state .openclaude', (a) => a.getAttribute('href'))
    .catch(() => null);
  if (!doorHref) fail('an empty thread had NO way back into the chat');
  else if (doorHref.indexOf('session_quiet') < 0)
    fail('the empty thread’s Open button points somewhere else: ' + doorHref);
  // and it is really tappable, not covered by the injected pill or anything else
  const reachable = await page.evaluate(() => {
    const a = document.querySelector('#thread .state .openclaude');
    if (!a) return false;
    a.scrollIntoView({ block: 'center' });
    const r = a.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(hit && (hit === a || a.contains(hit)));
  });
  if (!reachable) fail('the empty thread’s Open button is on screen but cannot be tapped');

  // ---- 4. no url on file → no button, never an invented one -------------
  await backHome(page);
  await page.waitForSelector('#grid .morelist .crow[data-chat="quiet-no-url"]', { timeout: 4000 })
    .catch(() => fail('quiet-no-url never showed in the fold'));
  await page.click('#grid .morelist .crow[data-chat="quiet-no-url"]');
  await page.waitForSelector('#thread .state', { timeout: 4000 })
    .catch(() => fail('quiet-no-url did not open on an empty state'));
  if (await page.$('#thread .state .openclaude'))
    fail('a chat with no session url on file was given an Open button anyway');

  // ---- 5. a thread with messages is untouched ---------------------------
  await backHome(page);
  await page.click('#grid .morelist .crow[data-chat="old-talky"]');
  await page.waitForSelector('#thread .msg', { timeout: 4000 })
    .catch(() => fail('old-talky did not open on its messages'));
  if (await page.$('#thread .state .openclaude'))
    fail('a thread with messages grew a second Open door in an empty state');
  const onMsg = await page.$$eval('#thread .msg .openclaude', (ns) => ns.length);
  if (!onMsg) fail('the message rows lost their own Open button');

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('OK: More keeps her spot, hidden still lands at the top, an empty thread carries the way back in');
})();
