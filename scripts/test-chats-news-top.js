#!/usr/bin/env node
// THE TWO RED BOXES + THE REST (2026-08-27, Sophie: "clear the update tab of
// anything no longer relevant and create a new '5 most urgent' and 5 most
// important with a red box, the rest collapse hidden by default").
//
// Drives the REAL public/chats.html headless against a stub API and asserts:
//   1. the main Update list opens as MOST URGENT then MOST IMPORTANT, each an
//      outlined box in the house red (--chg) — MEASURED off the computed
//      border, not read off a class — each holding at most five cards, with
//      THE REST below them;
//   2. MOST URGENT is the chats waiting on her: the live `waiting for a
//      response` pins LEAD it, then the open-need chats, newest ask first;
//   3. …and a sixth pin WIDENS the box past five rather than falling into the
//      fold (her older above-every-section rule outranks the cap);
//   4. MOST IMPORTANT ranks by her own filing signals — the pushpin beats the
//      star beats a fresh deliverable beats a bare need;
//   5. THE REST starts SHUT on every load ("hidden by default"), its header
//      carrying the count; opening it reveals the three kind sections; a
//      reload shuts it again (the fold is session-only, in that direction);
//   6. a card in a red box still works: its ✓ picks it and DONE clears it.
//
//   npm install playwright-core --no-save && node scripts/test-chats-news-top.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');
const servePublic = require('./lib/public-asset');

let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed (npm install playwright-core --no-save)'); process.exit(0); }
}

const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const H = 3600000;
const M = 60000;
const iso = (ms) => new Date(ms).toISOString();
const PIN = 'waiting for a response';

let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; process.exitCode = 1; };
const ok = (m) => console.log('  ok   ' + m);

// pin1/pin2      — live `waiting for a response` pins, quiet for hours: the
//                  tag is their arrival, and they must LEAD Most urgent
// need1..need6   — open needs, newest first; three fit beside the two pins,
//                  need4/need5 spill into Most important on their need score,
//                  need6 into the rest
// impPin/impStar — her filing signals (pushpin, star), plain replies
// impLook        — a fresh Compare page, no need
// plain1..plain3 — bare unread replies, nothing else
const MSGS = [];
const CHATS = {
  pin1: { labels: [PIN], filedAt: iso(T0 - 2 * H), notifSeenAt: iso(T0 - 3 * H) },
  pin2: { labels: [PIN], filedAt: iso(T0 - 4 * H), notifSeenAt: iso(T0 - 5 * H) },
};
[['pin1', 10 * H], ['pin2', 11 * H]].forEach(([c, ago], i) => {
  MSGS.push({ id: 'p' + i, chat: c, from: 'claude', text: c + ' spoke', tldr: c, created: iso(T0 - ago), postedAt: iso(T0 - ago) });
});
for (let i = 1; i <= 6; i++) {
  CHATS['need' + i] = { statusNeed: 'say go on thing ' + i };
  MSGS.push({ id: 'n' + i, chat: 'need' + i, from: 'claude', text: 'ask ' + i, tldr: 'ask ' + i, created: iso(T0 - i * M), postedAt: iso(T0 - i * M) });
}
CHATS.impPin = { pinTop: true };
CHATS.impStar = { starred: true };
CHATS.impLook = {};
['impPin', 'impStar', 'impLook'].forEach((c, i) => {
  MSGS.push({ id: 'i' + i, chat: c, from: 'claude', text: c + ' spoke', tldr: c, created: iso(T0 - (30 + i) * M), postedAt: iso(T0 - (30 + i) * M) });
});
for (let i = 1; i <= 3; i++) {
  CHATS['plain' + i] = {};
  MSGS.push({ id: 'r' + i, chat: 'plain' + i, from: 'claude', text: 'wrote it up ' + i, tldr: 'write-up ' + i, created: iso(T0 - (20 + i) * M), postedAt: iso(T0 - (20 + i) * M) });
}
// The second fixture: SIX live pins and nothing else with a need — the box
// must hold all six.
const CHATS6 = {};
const MSGS6 = [];
for (let i = 1; i <= 6; i++) {
  CHATS6['sixpin' + i] = { labels: [PIN], filedAt: iso(T0 - i * H), notifSeenAt: iso(T0 - 20 * H) };
  MSGS6.push({ id: 's' + i, chat: 'sixpin' + i, from: 'claude', text: 'spoke', tldr: 'spoke', created: iso(T0 - (15 + i) * H), postedAt: iso(T0 - (15 + i) * H) });
  CHATS6['filler' + i] = {};
  MSGS6.push({ id: 'f' + i, chat: 'filler' + i, from: 'claude', text: 'filler', tldr: 'filler', created: iso(T0 - i * M), postedAt: iso(T0 - i * M) });
}
const SETS = { main: { chats: CHATS, msgs: MSGS }, six: { chats: CHATS6, msgs: MSGS6 } };
let set = 'main';
const posted = [];

const server = http.createServer((req, res) => {
  // THE SHARED FILES chats.html LINKS, served the way express.static serves
  // them (scripts/lib/public-asset.js). This harness used to fall through to
  // its catch-all for every one of them, which is the quiet failure that file
  // exists to end: the page guards the global it could not load, so the harness
  // renders a page missing that behaviour and passes — or, when the catch-all's
  // body is not valid JS, throws a page error nobody asked about.
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1', chats: SETS[set].chats, settings: {}, truncated: [],
      messages: since ? [] : SETS[set].msgs, delta: !!since,
    }));
  }
  if (url.pathname === '/api/chatfeed/pages-recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ pages: set === 'main' ? [
      { id: 'pg1', title: 'The look page', chat: 'impLook', created: iso(T0 - 25 * M) },
    ] : [] }));
  }
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    return req.on('end', () => {
      let j = {}; try { j = JSON.parse(body || '{}'); } catch {}
      posted.push({ path: url.pathname, body: j });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, notifSeenAt: iso(Date.now()) }));
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
  res.end(JSON.stringify({ assets: [], pages: [], total: 0 }));
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

  await page.goto(base + '/chats?view=news');
  await page.waitForSelector('#grid .nwtopsec');
  // the boxes settle once the delivered caches land (impLook's page decides
  // its score) — wait for the settled shape, not the first paint
  await page.waitForFunction(() => {
    const h = document.querySelectorAll('#grid .sthead[data-kind="rest"]');
    return h.length === 1 && /The rest\s*4/.test(h[0].textContent);
  }, null, { timeout: 6000 }).catch(() => fail('The rest never settled at 4 cards'));

  const boxes = () => page.$$eval('#grid .nwtopsec', (ns) => ns.map((n) => ({
    head: (n.querySelector('.sthead') || {}).textContent?.replace(/\s+/g, ' ').trim(),
    kind: (n.querySelector('.sthead') || { dataset: {} }).dataset.kind,
    cards: Array.from(n.querySelectorAll('.nwcard')).map((c) => c.dataset.chat),
    border: getComputedStyle(n).borderTopColor,
    radius: getComputedStyle(n).borderTopLeftRadius,
  })));

  // ---- 1. two red boxes, urgent above important, at most five each ------
  let bx = await boxes();
  if (bx.length !== 2) fail('expected two red boxes, got ' + bx.length);
  else {
    if (!/^Most urgent/.test(bx[0].head)) fail('the first box is not Most urgent: "' + bx[0].head + '"');
    if (!/^Most important/.test(bx[1].head)) fail('the second box is not Most important: "' + bx[1].head + '"');
    if (bx[0].cards.length > 5 || bx[1].cards.length > 5) fail('a box holds more than five: ' + JSON.stringify(bx.map((b) => b.cards)));
    else ok('two boxes, Most urgent above Most important, five cards each at most');
  }
  // the red is MEASURED against the page's own --chg token, not hardcoded
  const chg = await page.evaluate(() => {
    const s = document.createElement('span');
    s.style.color = 'var(--chg)';
    document.body.appendChild(s);
    const c = getComputedStyle(s).color;
    s.remove();
    return c;
  });
  bx.forEach((b) => {
    if (b.border !== chg) fail('"' + b.head + '" is outlined ' + b.border + ', not the house red ' + chg);
    if (parseInt(b.radius, 10) !== 6) fail('"' + b.head + '" is not the house rounded rectangle: radius ' + b.radius);
  });
  if (!failed) ok('…and both boxes wear the house red at the house 6px');

  // above THE REST, measured by document order
  const order = await page.$$eval('#grid .nwtopsec, #grid .sthead[data-kind="rest"]',
    (ns) => ns.map((n) => n.classList.contains('nwtopsec') ? 'box' : 'rest'));
  if (order.join(',') !== 'box,box,rest') fail('the boxes are not above The rest: ' + order.join(','));
  else ok('…sitting above The rest');

  // ---- 2. who is urgent: the pins lead, then the newest asks ------------
  if (bx[0] && bx[0].cards.join(',') !== 'pin1,pin2,need1,need2,need3') {
    fail('wrong Most urgent cards: ' + bx[0].cards.join(','));
  } else ok('Most urgent = the two live pins, then the three newest asks');

  // ---- 4. who is important: pushpin > star > fresh deliverable > need ---
  if (bx[1] && bx[1].cards.join(',') !== 'impPin,impStar,impLook,need4,need5') {
    fail('wrong Most important cards: ' + bx[1].cards.join(','));
  } else ok('Most important ranks pushpin > star > fresh deliverable > bare need');

  // ---- 5. the rest is shut, carries its count, opens, and re-shuts ------
  if (await page.$('#grid .sthead[data-kind="read"]')) fail('the kind sections are painted while The rest is folded');
  const restHead = await page.$eval('#grid .sthead[data-kind="rest"]', (n) => ({
    folded: n.classList.contains('folded'), text: n.textContent.replace(/\s+/g, ' ').trim(),
  }));
  if (!restHead.folded) fail('The rest does not start folded');
  if (!/The rest 4/.test(restHead.text)) fail('The rest head lost its count: "' + restHead.text + '"');
  await page.click('#grid .sthead[data-kind="rest"]');
  await page.waitForSelector('#grid .sthead[data-kind="read"]', { timeout: 4000 })
    .catch(() => fail('opening The rest did not reveal the kind sections'));
  const restCards = await page.$$eval('#grid .sthead, #grid .nwcard', (ns) => {
    let past = false; const out = [];
    ns.forEach((n) => {
      if (n.classList.contains('sthead')) { if (n.dataset.kind === 'rest') past = true; return; }
      if (past) out.push(n.dataset.chat);
    });
    return out.sort();
  });
  if (restCards.join(',') !== 'need6,plain1,plain2,plain3') {
    fail('wrong cards behind The rest: ' + restCards.join(','));
  } else ok('The rest starts shut with its count, and opens onto the leftover cards');
  // ?view=news is consumed and stripped on the first load, so a reload lands
  // on the chat list — walk back onto the Update tab the way she would.
  await page.reload();
  // The row takes turns with the three lists (2026-08-28) and opens on the
  // LISTS, so the account row — the UPDATE tab's own home — is one tap away.
  if (!await page.isVisible('#accrow')) await page.click('#rowtog');
  await page.waitForSelector('#accrow .acctab[data-acct="new"]');
  await page.click('#accrow .acctab[data-acct="new"]');
  await page.waitForSelector('#grid .sthead[data-kind="rest"]');
  if (!(await page.$('#grid .sthead[data-kind="rest"].folded'))) {
    fail('The rest came back OPEN after a reload — "hidden by default" is every load');
  } else ok('…and a reload shuts it again');

  // ---- 6. a card in a red box still clears ------------------------------
  await page.waitForSelector('.nwcard[data-chat="pin1"] .nwck');
  await page.click('.nwcard[data-chat="pin1"] .nwck');
  await page.click('#catrow .nwdone');
  await page.waitForFunction(() => !document.querySelector('.nwcard[data-chat="pin1"]'), null, { timeout: 4000 })
    .catch(() => fail('DONE did not clear a red-box card'));
  if (!posted.some((p) => p.path === '/api/chatfeed/notif-seen' && p.body.chat === 'pin1')) {
    fail('clearing a red-box card posted no notif-seen');
  } else ok('a red-box card picks and clears like any other');

  // ---- 3. a sixth pin widens the box ------------------------------------
  set = 'six';
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(base + '/chats?view=news');
  await page.waitForSelector('#grid .nwtopsec');
  await page.waitForFunction(() => {
    const b = document.querySelector('#grid .nwtopsec .sthead');
    return b && /Most urgent 6/.test(b.textContent.replace(/\s+/g, ' '));
  }, null, { timeout: 6000 }).catch(() => fail('six live pins did not all stay in Most urgent'));
  bx = await boxes();
  if (bx[0] && bx[0].cards.length === 6) ok('a sixth pin widens Most urgent rather than falling into the fold');

  await browser.close();
  server.close();
  if (!failed) console.log('PASS: the two red boxes and the folded rest');
})().catch((e) => { console.error('FAIL: ' + e.message); process.exit(1); });
