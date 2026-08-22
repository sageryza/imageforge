#!/usr/bin/env node
// THE PILL'S NOTCH MUST NOT RESERVE MORE THAN THE ROW USES (Aug 2026, Sophie:
// "the space between the chats and the top is ever increasing?" → "the gap is
// empty").
//
// `#pillnotch` is a right FLOAT in the tool row, sized at paint time to
// however much of the autoscroll pill's 192px band the row still sits in. Its
// job is to push chips OUT of the pill's corner. But a float taller than the
// content beside it becomes the ROW'S OWN HEIGHT, so with only a couple of
// chips it was reserving 90px for 34px of content — and the surplus was blank
// page above everything underneath. Measured on her real 365 chats at 390x844:
// the UPDATE screen wasted 70px, the chat list 56px with TAGS shut.
//
// Drives the REAL public/chats.html headless and asserts:
//   1. with a short row the notch shrinks to what the chips used, and the tool
//      row is no taller than its content,
//   2. the chips STILL dodge the pill — nothing inside the band crosses into
//      the notch's column, which is the whole reason the float exists,
//   3. with a long row (TAGS open, SEE MORE unfolded) the notch is the full
//      band again and nothing changes: the content already runs past it,
//   4. and there is no blank gap left between the last chip and the row of
//      account tabs under it.
//
//   npm install playwright-core --no-save && node scripts/test-chats-pill-notch.js
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

// Enough vocabulary to fill the row several lines deep when TAGS is open, and
// two chats in Update boxes so the UPDATE screen has its short row.
const WORDS = ['witch', 'stories', 'xi', 'dream app', 'weird games', 'meta', 'tech',
  'just for fun', 'chunk making', 'research'];
const CHATS = {};
WORDS.forEach((w, i) => { CHATS['c' + i] = { account: '1', labels: [w, 'to be reviewed'] }; });
CHATS.boxed = { account: '1', newsQueue: 'later', newsQueuedAt: iso(T0 - 2 * 3600e3) };
CHATS.soon = { account: '1', newsQueue: 'soon', newsQueuedAt: iso(T0 - 2 * 3600e3) };
const MSGS = Object.keys(CHATS).map((c, i) => ({
  id: 'm' + i, chat: c, from: 'claude', text: 'body ' + c, tldr: 'tldr ' + c,
  created: iso(T0 - (40 - i) * 60000), postedAt: iso(T0 - (40 - i) * 60000),
}));

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'b1', chats: CHATS, settings: { categories: WORDS },
      truncated: [], messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  const asset = path.join(PUB, url.pathname.replace(/^\/+/, ''));
  if (/\.(js|css|svg|png|webp)$/.test(url.pathname) && asset.startsWith(PUB) && fs.existsSync(asset)) {
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return res.end(fs.readFileSync(asset));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, messages: [], todos: [], bookmarks: [] }));
});

let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; process.exitCode = 1; };

const geom = (page) => page.evaluate(() => {
  const t = document.getElementById('toolrow');
  const n = document.getElementById('pillnotch');
  const tr = t.getBoundingClientRect(), nr = n.getBoundingClientRect();
  const kids = [].slice.call(t.children).filter((k) => k !== n)
    .concat([].slice.call(document.getElementById('catrow').children));
  const seen = kids.filter((k) => k.getClientRects().length).map((k) => k.getBoundingClientRect());
  const used = seen.length ? Math.round(Math.max.apply(null, seen.map((r) => r.bottom)) - tr.top) : 0;
  const chips = [].slice.call(document.querySelectorAll('#catrow .catchip'))
    .map((c) => c.getBoundingClientRect());
  const acc = document.getElementById('accrow');
  // The gap is measured from the LAST VISIBLE thing above the tabs, not from
  // the chips: on the chat list the collapsed search row sits between them and
  // is 34px of real control, not blank page. (On UPDATE it is parked into the
  // tool row and hidden, which is why that screen showed the waste so plainly.)
  const sr = document.querySelector('.searchrow');
  // …and #nwdoors, the Update/Review chips, which landed between the tool row
  // and the account tabs after this test was written (Aug 2026 — "they're
  // supposed to go above the chats"). It is a real row of controls, so the gap
  // it fills is not the blank page this test is hunting; measuring past it
  // failed the UPDATE screen for 47px of buttons.
  const nd = document.getElementById('nwdoors');
  const above = [].concat(
    chips.map((r) => r.bottom),
    sr && sr.getClientRects().length ? [sr.getBoundingClientRect().bottom] : [],
    nd && nd.getClientRects().length ? [nd.getBoundingClientRect().bottom] : []);
  return {
    rowTop: Math.round(tr.top), rowH: Math.round(tr.height),
    notchH: Math.round(nr.height), notchLeft: Math.round(nr.left),
    band: Math.max(0, Math.min(200, 192 - tr.top)),
    used, chips: chips.length,
    // anything painted inside the pill's band that reaches into its column
    intruders: chips.filter((r) => r.top < 192 && r.right > nr.left + 1).length,
    gapToAcc: acc && above.length
      ? Math.round(acc.getBoundingClientRect().top - Math.max.apply(null, above))
      : null,
  };
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => fail('the page threw: ' + e.message));

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid .crow[data-chat]');

  // ---- 1 + 2 + 4. the SHORT row (TAGS shut) ------------------------------
  const shut = await geom(page);
  if (shut.used >= shut.band) fail('the fixture row is not short enough to measure anything');
  if (shut.notchH > shut.used + 1) {
    fail('the notch is still reserving ' + shut.notchH + 'px for ' + shut.used + 'px of chips '
      + '— the surplus is blank page under them');
  }
  // +8 for the row's own padding — the point is that it is not carrying the
  // float's 90px, not that it is pixel-tight against the chips.
  if (shut.rowH > shut.used + 8) fail('the tool row is taller than its own content: ' + shut.rowH + ' vs ' + shut.used);
  if (shut.intruders) fail(shut.intruders + ' chip(s) slid under the pill once the notch shrank');
  if (shut.gapToAcc > 32) fail('there is still ' + shut.gapToAcc + 'px of empty page under the chips');

  // ---- 3. the LONG row — nothing changes ---------------------------------
  await page.click('#catrow .tagsbtn');
  await page.waitForTimeout(200);
  if (await page.$('#catrow .morechip')) { await page.click('#catrow .morechip'); await page.waitForTimeout(200); }
  const open = await geom(page);
  if (open.used <= open.band) fail('the fixture vocabulary is too small to overflow the band');
  if (Math.abs(open.notchH - open.band) > 1) {
    fail('a row that runs past the band lost its full notch: ' + open.notchH + ' vs band ' + open.band);
  }
  if (open.intruders) fail(open.intruders + ' chip(s) are sitting under the pill with the row open');

  // ---- and the UPDATE screen, which is where she saw it -------------------
  await page.click('#catrow .tagsbtn');
  await page.waitForTimeout(150);
  await page.evaluate(() => window.__setHomeView('news'));
  await page.waitForTimeout(500);
  const news = await geom(page);
  if (!news.chips) fail('the UPDATE screen drew no boxes, so this proves nothing');
  if (news.notchH > news.used + 1) {
    fail('UPDATE: the notch reserves ' + news.notchH + 'px for ' + news.used + 'px of boxes');
  }
  if (news.gapToAcc > 32) fail('UPDATE: ' + news.gapToAcc + 'px of empty page between the boxes and the tabs');
  if (news.intruders) fail('UPDATE: a box slid under the pill');

  await browser.close();
  server.close();
  if (!failed) console.log('PASS: the notch reserves what the row uses, the chips still dodge the pill, and the empty gap is gone');
})().catch((e) => { console.error('FAIL: ' + e.message); process.exit(1); });
