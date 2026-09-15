#!/usr/bin/env node
// The jump pair in the PILL'S RAIL — `#ptop` and `#pbot`, the two circles
// (2026-09-15, Sophie, looking at two back-to-tops on one screen: "JUST
// circles · drop squares"). This used to test `.jumps` / `#totop` / `#tobot`,
// the 44px rounded squares that floated in the bottom-right corner; they are
// gone and their behaviour moved into the rail.
//
// Drives the REAL public/chats.html headless against a stub API and asserts:
//   1. at the top of a long list only the DOWN arrow shows — neither floats
//      over the page when it has nowhere to go,
//   1a. past the rail's own 150 the UP arrow shows too,
//   1b. STACKED, up above down, in one column, with NO EMPTY SLOT where a
//      hidden arrow would be (the squares reserved room for both; a flex
//      column takes a `display:none` child out of the layout, which is what
//      makes the rail's higher floor harmless where the squares' was not),
//   2. tapping down lands at the bottom, where only the UP arrow shows,
//   3. tapping that lands back at the top,
//   4. a short list shows NEITHER,
//   5. both stop the autoscroll first, or the page keeps creeping after it
//      arrives,
//   6. the rail is hidden in select mode, where the filing bar owns the top.
//
//   npm install playwright-core --no-save && node scripts/test-chats-jumps.js
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

// enough chats to make the page much taller than the screen
const MANY = 40;
const MSGS = [];
const CHATS = {};
for (let i = 0; i < MANY; i++) {
  const c = 'chat-' + String(i).padStart(2, '0');
  MSGS.push({ id: 'm' + i, chat: c, from: 'claude', text: 'reply ' + i, tldr: 'tldr ' + i,
              created: iso(T0 - i * 60000), postedAt: iso(T0 - i * 60000) });
  CHATS[c] = { lastSeen: MSGS[i].created };
}
let few = false;   // flipped to serve a short list

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    const msgs = few ? MSGS.slice(0, 2) : MSGS;
    const chats = {};
    msgs.forEach((m) => { chats[m.chat] = CHATS[m.chat]; });
    return json({ build: 'test-build-1', chats, settings: {}, truncated: [],
                  messages: since ? [] : msgs, delta: !!since });
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  json({});
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const shown = (page) => page.evaluate(() => ({
  up: document.getElementById('ptop').classList.contains('on'),
  down: document.getElementById('pbot').classList.contains('on'),
}));

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="chat-00"]');

  // 1. at the top of a long list: down only
  let s = await shown(page);
  if (s.up) fail('the up arrow shows at the top of the page');
  if (!s.down) fail('the down arrow is missing on a long list');

  // 1a. A SHORT SCROLL OFF THE TOP SHOWS THE UP ARROW (Aug 2026, Sophie: "why
  //     is there only a scroll down arrow and not a scroll up arrow — since
  //     I'm not at the top there should be a scroll up arrow"). In the rail
  //     the floor is PTOP_AT — 150, the ONE number the five baked pill copies
  //     and mkPagePill share, pinned by test-back-to-top.js — not the squares'
  //     40. Her complaint was against a 400px floor AND against the empty slot
  //     it left above the down arrow in a column sized for two; 1b below
  //     measures that there is no slot to leave here, which is what makes the
  //     house number safe in this rail.
  await page.evaluate(() => window.scrollTo(0, 220));
  await page.waitForFunction(() => window.scrollY >= 218, null, { timeout: 2000 }).catch(() => {});
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
  s = await shown(page);
  if (!s.up) fail('the up arrow is missing 220px down the page');

  // 1a-ii. AND AT THE TOP THE DOWN ARROW LEAVES NO HOLE ABOVE IT. Measured,
  //     because a reserved-but-empty slot renders as nothing and passes every
  //     assertion about the arrow that IS there.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
  const tight = await page.evaluate(() => {
    const spd = document.getElementById('spd').getBoundingClientRect();
    const dn = document.getElementById('pbot').getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(document.querySelector('.float')).rowGap) || 0;
    return { hole: Math.round(dn.top - spd.bottom - gap), up: getComputedStyle(document.getElementById('ptop')).display };
  });
  if (tight.up !== 'none') fail('the up arrow is not hidden at the top: ' + tight.up);
  if (tight.hole > 2) fail('a hidden up arrow left a ' + tight.hole + 'px hole in the rail');

  // 1b. STACKED, up ABOVE down (Aug 2026, Sophie: "the up shud be above").
  //     Measured, not read off the CSS: a wrong flex-direction is perfectly
  //     valid markup and both buttons stay "visible" either way — the only
  //     honest question is where the two boxes actually land. Measured from
  //     the MIDDLE of the list, the one place both arrows are on screen at
  //     once — at the top there is no up arrow to be above anything.
  await page.evaluate(() => window.scrollTo(0, Math.round(
    (document.documentElement.scrollHeight - window.innerHeight) / 2)));
  await page.waitForFunction(() => document.getElementById('ptop').classList.contains('on')
    && document.getElementById('pbot').classList.contains('on'),
    null, { timeout: 4000 }).catch(() => fail('both arrows never showed mid-list'));
  const box = await page.evaluate(() => {
    const r = (id) => { const b = document.getElementById(id).getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, mid: b.left + b.width / 2,
               w: Math.round(b.width), h: Math.round(b.height),
               radius: getComputedStyle(document.getElementById(id)).borderRadius }; };
    return { up: r('ptop'), down: r('pbot') };
  });
  // JUST CIRCLES: same size, same round plate. The squares were 44px at 6px.
  if (box.up.w !== box.down.w || box.up.h !== box.down.h) {
    fail('the two arrows are different sizes: ' + JSON.stringify(box));
  }
  if (!/50%|9999px|999px/.test(box.down.radius)) {
    fail('the down arrow is not a circle: ' + box.down.radius);
  }
  if (box.up.bottom > box.down.top + 1) {
    fail('the up arrow is not above the down arrow: ' + JSON.stringify(box));
  }
  if (Math.abs(box.up.mid - box.down.mid) > 1) {
    fail('the two arrows are not in one column: ' + JSON.stringify(box));
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => !document.getElementById('ptop').classList.contains('on'),
    null, { timeout: 4000 }).catch(() => {});

  // 5a. tapping stops the autoscroll — start it for real, and prove it really
  //     started, or 5b below would pass on a page that was never moving
  await page.evaluate(() => window.__scrollStart(1));   // 1 = downward
  const moved = await page.evaluate(async () => {
    const a = window.scrollY;
    await new Promise((r) => setTimeout(r, 500));
    return window.scrollY - a;
  });
  if (moved <= 2) fail('the autoscroll never actually started, so the stop is untested');
  // 2. down lands at the bottom, and only the up arrow remains
  await page.click('#pbot');
  await page.waitForFunction(() => {
    const left = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
    return left < 4;
  }, null, { timeout: 6000 }).catch(() => fail('the down arrow did not reach the bottom'));
  s = await shown(page);
  if (!s.up) fail('the up arrow is missing at the bottom');
  if (s.down) fail('the down arrow still shows at the bottom');

  // 3. up lands back at the top
  await page.click('#ptop');
  await page.waitForFunction(() => window.scrollY < 4, null, { timeout: 6000 })
    .catch(() => fail('the up arrow did not reach the top'));
  s = await shown(page);
  if (s.up) fail('the up arrow still shows at the top');

  // 5b. nothing is still scrolling the page after the jump.
  //     The jump is a SMOOTH scroll, so its own deceleration is not "the
  //     autoscroll is still running" — waiting for scrollY<4 can land mid-
  //     glide (it really does: y=3 then 0, a false failure that moved with
  //     the page's height). So settle first: if the autoscroll were alive the
  //     page would never stop changing and this times out, which is the real
  //     assertion. Then sample twice, as before.
  const settled = await page.evaluate(async () => {
    let last = -1, same = 0;
    for (let i = 0; i < 40 && same < 3; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (window.scrollY === last) same++; else { same = 0; last = window.scrollY; }
    }
    return same >= 3;
  });
  if (!settled) fail('the page never stopped moving after the jump — the autoscroll was not stopped');
  const y1 = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(700);
  const y2 = await page.evaluate(() => window.scrollY);
  if (Math.abs(y2 - y1) > 2) fail('the page kept moving after the jump — the autoscroll was not stopped');

  // 6. hidden while she is picking chats (the filing bar owns the bottom)
  await page.click('#selbtn');
  await page.waitForSelector('#selbar');
  const vis = await page.evaluate(() => getComputedStyle(document.querySelector('.float')).display);
  if (vis !== 'none') fail('the rail sits over the select bar: ' + vis);
  await page.click('#selbtn');

  // 4. a short list shows neither
  few = true;
  await page.evaluate(() => window.__reload());  // the refresh button is gone (Aug 2026)
  await page.waitForFunction(() => document.querySelectorAll('#grid .crow[data-chat]').length <= 2,
    null, { timeout: 6000 }).catch(() => fail('the short list never rendered'));
  await page.waitForTimeout(150);
  s = await shown(page);
  if (s.up || s.down) fail('an arrow floats over a list that already fits: ' + JSON.stringify(s));

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures' : 'OK: the two circles go both ways and hide when they have nowhere to go');
})().catch((e) => { console.error(e); process.exit(1); });
