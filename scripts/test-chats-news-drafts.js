#!/usr/bin/env node
// A STILL-WRITING DRAFT IS NOT AN ARRIVAL on the Update tab (Aug 2026,
// Sophie: "the update tab seems to give me an update before the turn is even
// done" — and, deciding the fix: no card for a half-written reply, but "if
// they finished making something or made images but their turn isn't done I
// kind of want to preserve that").
//
// So the reply that counts is the newest FINISHED one, while pictures and
// Compare pages still count the moment they land, mid-turn included. The
// widget and the push already skip drafts; this pins the tab agreeing.
//
// Drives the REAL public/chats.html against a stub API and asserts:
//   1. a chat whose only news is a live draft gets NO card,
//   2. a chat mid-turn that has filed fresh PICTURES gets a card — with the
//      pictures on it — and its ⌄ never opens on the half-written draft,
//   3. an unchecked finished reply keeps its card while a NEW turn's draft
//      runs on top of it (the draft neither makes nor breaks the card),
//   4. a ✓'d chat is not resurrected by a draft alone.
//
//   npm install playwright-core --no-save && node scripts/test-chats-news-drafts.js
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

const MSGS = [
  // 1. only news is a live draft → no card
  { id: 'd1', chat: 'draft-only', from: 'claude', text: 'I will start by reading', working: true,
    created: iso(T0 - 2 * MIN), postedAt: iso(T0 - 30000) },
  // 2. mid-turn, but it filed pictures → card with pictures
  { id: 'p1', chat: 'draft-with-pics', from: 'claude', text: 'three drawn so far, working on', working: true,
    created: iso(T0 - 5 * MIN), postedAt: iso(T0 - 20000) },
  // 3. an unchecked finished reply, then a new turn's draft on top
  { id: 'f1', chat: 'old-reply-new-draft', from: 'claude', text: 'the six cards are done', tldr: 'six cards done',
    created: iso(T0 - 120 * MIN), postedAt: iso(T0 - 120 * MIN) },
  { id: 'f2', chat: 'old-reply-new-draft', from: 'claude', text: 'starting on the palettes now', working: true,
    created: iso(T0 - 3 * MIN), postedAt: iso(T0 - 15000) },
  // 4. checked off, then a draft → stays quiet
  { id: 'c1', chat: 'checked-then-draft', from: 'claude', text: 'shipped the fix', tldr: 'fix shipped',
    created: iso(T0 - 60 * MIN), postedAt: iso(T0 - 60 * MIN) },
  { id: 'c2', chat: 'checked-then-draft', from: 'claude', text: 'looking at the next thing', working: true,
    created: iso(T0 - 2 * MIN), postedAt: iso(T0 - 10000) },
];
const reg = {
  'draft-only': { lastSeen: iso(T0) },
  'draft-with-pics': { lastSeen: iso(T0) },
  'old-reply-new-draft': { lastSeen: iso(T0) },
  'checked-then-draft': { lastSeen: iso(T0), notifSeenAt: iso(T0 - 30 * MIN) },
};
const ASSETS = [
  { chat: 'draft-with-pics', url: 'https://storage.googleapis.com/x/fresh-one.png', created: iso(T0 - 60000) },
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1', chats: reg, settings: {}, truncated: [],
      messages: url.searchParams.get('since') ? [] : MSGS, delta: !!url.searchParams.get('since'),
    }));
  }
  if (url.pathname === '/api/gallery/assets/recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ assets: ASSETS }));
  }
  if (url.pathname === '/api/chatfeed/pages-recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ pages: [] }));
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
  await page.evaluate(() => window.__setHomeView('news'));
  await page.waitForSelector('#grid .nwcard', { timeout: 4000 });

  const cards = await page.$$eval('#grid .nwcard', (ns) => ns.map((n) => n.dataset.chat));

  // 1. a lone draft is not news
  if (cards.includes('draft-only')) fail('a chat whose only news is a live draft got a card');
  // 4. and a draft resurrects nothing she checked off
  if (cards.includes('checked-then-draft')) fail('a draft brought back a card she had ✓d');
  // 3. the finished reply holds its card under a running turn
  if (!cards.includes('old-reply-new-draft')) fail('an unchecked finished reply lost its card to the new turn’s draft');
  // 2. mid-turn pictures still card, with the pictures on it
  if (!cards.includes('draft-with-pics')) fail('a chat that filed pictures mid-turn got no card');
  const pics = await page.$$('#grid .nwcard[data-chat="draft-with-pics"] .nwimg');
  if (!pics.length) fail('the mid-turn card is missing its pictures');
  // …and its ⌄ must not open on the half-written draft: with no Update card
  // filed and no finished reply, there is nothing honest to show, so no ⌄.
  if (await page.$('#grid .nwcard[data-chat="draft-with-pics"] .nwmore'))
    fail('the mid-turn card offers a ⌄ that could only show the half-written draft');
  // the surviving card's ⌄ falls back to the FINISHED reply's TLDR, not the draft
  await page.click('#grid .nwcard[data-chat="old-reply-new-draft"] .nwmore');
  const sum = await page.$eval('#grid .nwcard[data-chat="old-reply-new-draft"] .nwsum',
    (n) => n.textContent).catch(() => '');
  if (!/six cards done/.test(sum)) fail('the ⌄ fallback is not the finished reply’s TLDR: "' + sum + '"');
  if (/palettes/.test(sum)) fail('the ⌄ fallback leaked the running draft');

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'FAILED' : 'OK: drafts make no cards — finished replies, pictures and pages still do');
})();
