#!/usr/bin/env node
// THE REASONS SHE HAS GIVEN BEFORE, BEHIND A BUTTON (Aug 2026, Sophie: "could
// you gather the list of reasons for waiting for something that I enter
// manually and put it behind a button … should be small and unobtrusive since
// I won't use it that often").
//
// The finding that shaped it: `waitingFor` is DELETED with its tag, so there
// was no history to gather — measured live 2026-08-20, 378 chats and TWO
// carrying a reason. The list is a SECOND place (`__settings.waitingReasons`,
// written by `rememberWaiting` in chatfeed.js) so the field stays live-and-
// deletable while the answers accumulate beside it.
//
// Asserts, driving the REAL public/chats.html headless against a stub API:
//   1. NOTHING GIVEN BEFORE → NO BUTTON. An empty list shows no control at
//      all, the way an empty section on the Update tab shows no header.
//   2. …and the field is still EMPTY on a chat with no answer — the button
//      must not have become a way to put pre-written text in her box.
//   3. WITH history: the ⟲ is there, the list starts SHUT, and it opens in
//      stored order (newest first), capped at WAIT_SHOW.
//   4. Tapping a row FILLS the field and saves it — it does not close the
//      sheet, because a past answer is often only nearly right.
//   5. A reason she types is in the list the next time she opens it, without
//      waiting out a poll (the client mirror of the server's memory).
//   6. Her own saved answer still prefills the field — that exemption to the
//      no-pre-written-text rule is hers and is not what this changed.
//   7. The server's `waitReasons` trims, de-dupes case-insensitively, keeps
//      her order and caps at WAIT_MEMORY_MAX.
//
//   npm install playwright-core --no-save && node scripts/test-waiting-past.js
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

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const WAIT = 'waiting for something';

let failed = 0;
const fail = (m, d) => { console.error('FAIL: ' + m + (d ? ' — ' + d : '')); failed++; process.exitCode = 1; };
const ok = (m, cond, d) => { if (cond) console.log('  ok   ' + m); else fail(m, d); };

// ---- 7. the server's own list rule, no browser --------------------------
{
  const feed = require(path.join(ROOT, 'chatfeed.js'));
  const { waitReasons, WAIT_MEMORY_MAX } = feed;
  const got = waitReasons({ waitingReasons: ['  the API key ', 'The API Key', '', null, 'her go-ahead'] });
  ok('the server trims, drops the blanks and de-dupes case-insensitively',
    JSON.stringify(got) === JSON.stringify(['the API key', 'her go-ahead']), JSON.stringify(got));
  const many = Array.from({ length: WAIT_MEMORY_MAX + 10 }, (_, i) => 'reason ' + i);
  const capped = waitReasons({ waitingReasons: many });
  ok('…and caps the list, keeping HER order from the front',
    capped.length === WAIT_MEMORY_MAX && capped[0] === 'reason 0', capped.length + ' long');
  ok('a chat that has never answered reads as an empty list, never a crash',
    waitReasons({}).length === 0 && waitReasons(null).length === 0);
}

// ── the fixtures ──────────────────────────────────────────────────────────
const MSGS = ['fresh', 'waiting-now'].map((c, i) => ({
  id: 'm' + i, chat: c, from: 'claude', text: c, tldr: c,
  created: iso(T0 - (2 - i) * 3600e3), postedAt: iso(T0 - (2 - i) * 3600e3),
}));

// Fourteen, so the WAIT_SHOW cap has something to cut.
const REASONS = ['the API key', 'her go-ahead', 'Tuesday']
  .concat(Array.from({ length: 11 }, (_, i) => 'an older reason ' + i));

const CHATS = {
  fresh: {},
  // `waiting for something` is a PILE word, so this chat is off the unfiled
  // list — it is on screen only because it has spoken since it was filed
  // (`chatBack`). That is why `filedAt` sits well behind its message.
  'waiting-now': { labels: [WAIT], filedAt: iso(T0 - 5 * 3600e3), waitingFor: 'the API key' },
};
let history = false;
const posted = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-' + (history ? 'h' : 'e'),
      chats: CHATS,
      settings: history ? { waitingReasons: REASONS } : {},
      truncated: [], messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; });
    return req.on('end', () => {
      let j = {}; try { j = JSON.parse(body || '{}'); } catch {}
      posted.push({ path: url.pathname, body: j });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, chats: [j.chat], labels: {} }));
    });
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
  res.end(JSON.stringify({}));
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

  // TWO SHEETS ARE STACKED — the Organize sheet opens the waiting box on top
  // of itself, and both are `.askwrap`. Every selector below is scoped to the
  // one carrying the question row, or a click lands on the sheet underneath
  // (which is exactly what it did the first time this test ran).
  const W = '.askwrap:has(.askqrow)';
  // Is the ⟲ actually on screen? `hidden` alone would pass on a page whose
  // author display rule beat the attribute — the bug this app has shipped
  // before ("[hidden] loses to any author display rule").
  const btnShown = () => page.$$eval(W + ' .waitpast',
    (ns) => ns.some((n) => n.offsetParent !== null));
  const rows = () => page.$$eval(W + ' .waitpastrow', (ns) => ns.map((n) => n.textContent.trim()));
  const listShown = () => page.$$eval(W + ' .waitpastlist',
    (ns) => ns.some((n) => n.offsetParent !== null));
  const field = () => page.$eval(W + ' .arcnote', (n) => n.value);
  const openOrg = async (chat) => {
    await page.goto(base + '/chats');
    await page.waitForSelector('#grid [data-chat="fresh"]');
    await page.click('#grid [data-chat="' + chat + '"]');
    await page.waitForSelector('#thread .orgbtn');
    await page.click('#thread .orgbtn');
    await page.waitForSelector('.askwrap .arctags');
  };
  const tapChip = (label) => page.$$eval('.askwrap .arctags .catchip', (ns, l) => {
    const b = ns.find((n) => n.textContent.trim().toLowerCase() === l);
    if (b) b.click();
    return !!b;
  }, label);

  // ---- 1 + 2. nothing given before -------------------------------------
  await openOrg('fresh');
  ok('the tag chip is there to tap', await tapChip(WAIT));
  await page.waitForSelector(W + ' .arcnote');
  ok('with nothing given before there is no button at all', !(await btnShown()));
  ok('…and the box still opens EMPTY — no pre-written text', (await field()) === '', await field());

  // ---- 3. with history -------------------------------------------------
  history = true;
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await openOrg('waiting-now');
  await page.click('.askwrap .waitedit');
  await page.waitForSelector(W + ' .arcnote');
  ok('her own saved answer still prefills the field', (await field()) === 'the API key', await field());   // 6
  ok('the ⟲ is there once she has given reasons before', await btnShown());
  ok('…and the list starts SHUT', !(await listShown()));

  await page.click(W + ' .waitpast');
  await page.waitForSelector(W + ' .waitpastrow');
  const list = await rows();
  ok('the list opens in her stored order, newest first',
    list[0] === REASONS[0] && list[1] === REASONS[1], list.slice(0, 3).join(' · '));
  ok('…capped so Done never leaves the screen', list.length === 12, list.length + ' rows');

  // ---- 4. tapping one fills the field ----------------------------------
  posted.length = 0;
  await page.$$eval(W + ' .waitpastrow', (ns) => {
    const b = ns.find((n) => n.textContent.trim() === 'Tuesday'); if (b) b.click();
  });
  await page.waitForFunction(() => {
    const n = document.querySelector('.askwrap:has(.askqrow) .arcnote'); return n && n.value === 'Tuesday';
  }, null, { timeout: 4000 }).then(() => {}, () => fail('tapping a past reason did not fill the field'));
  ok('tapping one leaves the sheet OPEN, so she can edit it', !!(await page.$(W + ' .arcnote')));
  ok('…and the list closes behind it', !(await listShown()));
  await page.waitForTimeout(200);
  const save = posted.find((p) => p.path === '/api/chatfeed/waiting');
  ok('…and it is saved as the chat is waiting for', save && save.body.text === 'Tuesday',
    JSON.stringify(save && save.body));

  // ---- 5. a NEW reason joins the list at once --------------------------
  await page.fill(W + ' .arcnote', 'the render to finish');
  // Clicked in the page rather than through the mouse: two fixed sheets are
  // stacked here and Playwright's interception check reports the wrapper over
  // its own button. What is being tested is the handler, not the hit box.
  await page.$eval(W + ' .askrow button.go', (n) => n.click());
  await page.waitForTimeout(250);
  // Done closes the waiting box only — the Organize sheet it opened from is
  // still on screen, so this is the way back in (and the reason the thread's
  // own button cannot be clicked from here).
  await page.waitForSelector('.askwrap .waitedit');
  await page.$eval('.askwrap .waitedit', (n) => n.click());
  await page.waitForSelector(W + ' .waitpast');
  await page.click(W + ' .waitpast');
  await page.waitForSelector(W + ' .waitpastrow');
  const after = await rows();
  ok('a reason she just gave is at the top of the list, with no poll to wait out',
    after[0] === 'the render to finish', after.slice(0, 3).join(' · '));
  ok('…and it did not duplicate anything already in there',
    new Set(after).size === after.length, after.join(' · '));

  await browser.close();
  server.close();
  if (!failed) console.log('PASS: the reasons she has given before, behind a small ⟲ on the waiting box');
})().catch((e) => { console.error('FAIL: ' + e.message); process.exit(1); });
