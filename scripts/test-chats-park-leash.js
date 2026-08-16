#!/usr/bin/env node
// THE PARK LEASH (Aug 2026, Sophie: "three hours is way too long to wait",
// then "could it just be like three minutes"). An automatic park — the
// turn-start ping, or her answered message — promises a reply, and a chat
// that dies mid-turn never sends the one that unparks it, so it used to sit
// in Hidden forever. Now: parked with no sign of life for PARK_LEASH → back
// on the list. A hide SHE tapped is never leashed — both automatic parks
// stamp `workingAt` equal to `hiddenAt`, a hand hide writes `hiddenAt` alone,
// and that difference is the whole discriminator.
//
// Drives the REAL public/chats.html against a stub API and asserts:
//   1. an automatically parked chat whose draft is still growing stays hidden
//      (alive = leashed but not tripped),
//   2. an automatically parked chat with no sign of life past the leash is
//      BACK ON THE LIST (the dead-chat rescue — the whole feature),
//   3. a chat she hid BY HAND days ago stays hidden — the leash must never
//      empty the pile she curates,
//   4. a chat she hid by hand DURING a turn (hiddenAt newer than workingAt)
//      also stays hidden — her hand wins over the machinery's park,
//   5. the hidden bar counts exactly the still-hidden ones,
//   6. a trip that happens by the CLOCK alone repaints the home list — the
//      20s timer's leashCheck notices with no poll delta to announce it.
//
//   npm install playwright-core --no-save && node scripts/test-chats-park-leash.js
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
const MIN = 60000;

// Every chat needs a message or the row sinks with no `last` to judge.
const MSGS = [
  // alive: parked 10 min ago at turn start, its live draft grew 30s ago
  { id: 'a1', chat: 'alive-parked', from: 'claude', text: 'half a reply so far', working: true,
    created: iso(T0 - 9 * MIN), postedAt: iso(T0 - 30000) },
  // dead: parked 10 min ago at turn start, nothing since its old reply
  { id: 'd1', chat: 'dead-parked', from: 'claude', text: 'an old finished reply', tldr: 'old reply',
    created: iso(T0 - 60 * MIN), postedAt: iso(T0 - 60 * MIN) },
  // hand-hidden two days ago, no turn anywhere near it
  { id: 'h1', chat: 'hand-hidden', from: 'claude', text: 'filed away', tldr: 'filed',
    created: iso(T0 - 3 * 24 * 60 * MIN), postedAt: iso(T0 - 3 * 24 * 60 * MIN) },
  // she hid it BY HAND while its turn was running: hiddenAt is newer than
  // workingAt, so the leash must keep its hands off however dead it looks
  { id: 'm1', chat: 'hidden-midturn', from: 'claude', text: 'mid-turn draft', working: true,
    created: iso(T0 - 20 * MIN), postedAt: iso(T0 - 20 * MIN) },
  // an ordinary visible chat, so the list is never empty
  { id: 'n1', chat: 'plain-chat', from: 'claude', text: 'nothing special', tldr: 'plain',
    created: iso(T0 - 5 * MIN), postedAt: iso(T0 - 5 * MIN) },
];
const reg = {
  'alive-parked':  { lastSeen: iso(T0), workingAt: iso(T0 - 10 * MIN), hiddenAt: iso(T0 - 10 * MIN) },
  'dead-parked':   { lastSeen: iso(T0), workingAt: iso(T0 - 10 * MIN), hiddenAt: iso(T0 - 10 * MIN) },
  'hand-hidden':   { lastSeen: iso(T0), hiddenAt: iso(T0 - 2 * 24 * 60 * MIN) },
  'hidden-midturn': { lastSeen: iso(T0), workingAt: iso(T0 - 20 * MIN), hiddenAt: iso(T0 - 19 * MIN) },
  'plain-chat':    { lastSeen: iso(T0) },
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1', chats: reg, settings: {}, truncated: [],
      messages: url.searchParams.get('since') ? [] : MSGS, delta: !!url.searchParams.get('since'),
    }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, assets: [], pages: [], items: [] }));
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat]');

  const listed = async () => page.$$eval('#grid [data-chat]', (ns) =>
    ns.filter((n) => !n.closest('.hidelist')).map((n) => n.dataset.chat));

  // 1-4: who is on the list, who is behind the bar
  let names = await listed();
  if (!names.includes('dead-parked')) fail('the dead park never tripped the leash — the stuck chat stays buried');
  if (names.includes('alive-parked')) fail('a chat whose draft grew 30s ago popped out — the leash ignored its sign of life');
  if (names.includes('hand-hidden')) fail('the leash emptied her hand-curated pile');
  if (names.includes('hidden-midturn')) fail('she hid it by hand mid-turn and the leash overrode her');
  if (!names.includes('plain-chat')) fail('the ordinary chat went missing');

  // 5: the bar counts the three still hidden
  const barText = await page.$eval('#grid .hidebar .hb-n', (n) => n.textContent).catch(() => '');
  if (!/Hidden 3\b/.test(barText)) fail('hidden bar says "' + barText.trim() + '", expected Hidden 3');

  // 6: a trip by the clock alone repaints. Shrink the leash so alive-parked's
  // 30s-old sign of life is now stale, then run the timer's check by hand:
  // first call baselines, the second sees the change and repaints.
  await page.evaluate(() => { window.__leashCheck(); window.__setParkLeash(50); window.__leashCheck(); });
  await page.waitForFunction(() => {
    const ns = document.querySelectorAll('#grid [data-chat]');
    return Array.from(ns).some((n) => n.dataset.chat === 'alive-parked' && !n.closest('.hidelist'));
  }, null, { timeout: 3000 }).catch(() => fail('the clock-only trip never repainted the list'));

  // …and the rule itself, straight: a hand hide never trips whatever the clock says
  const handSafe = await page.evaluate(() => !window.__parkTripped('hand-hidden',
    { postedAt: new Date(Date.now() - 86400000).toISOString() }));
  if (!handSafe) fail('parkTripped fired on a hand hide');

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'FAILED' : 'OK: park leash — dead chats surface, her hand hides stay put');
})();
