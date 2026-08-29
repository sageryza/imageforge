#!/usr/bin/env node
// THE UPDATE TAB'S CATEGORIES FOLD (Aug 2026, Sophie: "can y make the
// categories in the update [tab] collapsible").
//
// The categories are the three sections the main Update list paints —
// DELIVERABLES · TO READ · QUICK DECISIONS — and the one that needs folding is
// the big one: 24 of 33 cards were Quick decisions the day the sections
// shipped, so the two piles she opens this screen to LOOK at were buried under
// two dozen asks.
//
// Drives the REAL public/chats.html headless against a stub API and asserts:
//   1. every section header IS the button (not a chevron beside it) and
//      carries the fold chevron, with a tap target a thumb can hit (>=36px),
//   2. tapping one hides ITS cards and nothing else's — the header and its
//      count stay on screen, so a folded section is visibly folded rather than
//      missing,
//   3. tapping it again brings the same cards back,
//   4. folding DROPS the picks inside it (a picked card she can no longer see
//      is one the next tap on a box would file without her) — the DONE chip
//      goes with them,
//   5. the fold is SESSION-ONLY: a reload comes up with every section open.
//
//   npm install playwright-core --no-save && node scripts/test-chats-news-collapse.js
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
const H = 3600000;
const iso = (ms) => new Date(ms).toISOString();

// chat-page  — a fresh Compare page      → DELIVERABLES
// chat-read  — a plain unread reply      → TO READ
// chat-need1 / chat-need2 — an open need → QUICK DECISIONS (the big pile)
// …plus ten FILLERS (2026-08-27, the two red boxes): five with needs newer
// than everything (they fill Most urgent) and five starred+pinned (they fill
// Most important), so the four chats above all land in THE REST — where the
// kind sections this test is about live now, behind the fold.
const FILL = [];
for (let i = 1; i <= 5; i++) {
  FILL.push({ id: 'fu' + i, chat: 'urg' + i, from: 'claude', text: 'ask ' + i, tldr: 'ask ' + i, created: iso(T0 - i * 60000), postedAt: iso(T0 - i * 60000) });
  FILL.push({ id: 'fi' + i, chat: 'imp' + i, from: 'claude', text: 'starred ' + i, tldr: 'starred ' + i, created: iso(T0 - (5 + i) * 60000), postedAt: iso(T0 - (5 + i) * 60000) });
}
const MSGS = [
  ...FILL,
  { id: 'm1', chat: 'chat-page', from: 'claude', text: 'v2 is up', tldr: 'page v2', created: iso(T0 - 2 * H), postedAt: iso(T0 - 2 * H) },
  { id: 'm2', chat: 'chat-read', from: 'claude', text: 'wrote it up', tldr: 'the write-up', created: iso(T0 - 1 * H), postedAt: iso(T0 - 1 * H) },
  { id: 'm3', chat: 'chat-need1', from: 'claude', text: 'two options ready', tldr: 'two options', created: iso(T0 - 40 * 60000), postedAt: iso(T0 - 40 * 60000) },
  { id: 'm4', chat: 'chat-need2', from: 'claude', text: 'which palette', tldr: 'palettes', created: iso(T0 - 35 * 60000), postedAt: iso(T0 - 35 * 60000) },
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const fillers = {};
    for (let i = 1; i <= 5; i++) {
      fillers['urg' + i] = { account: '1', statusNeed: 'say go on thing ' + i };
      fillers['imp' + i] = { account: '1', starred: true, pinTop: true };
    }
    return res.end(JSON.stringify({
      build: 'test-build-1',
      chats: {
        ...fillers,
        'chat-page': { account: '1' },
        'chat-read': { account: '1' },
        'chat-need1': { account: '1', statusNeed: 'pick a palette, 10 seconds' },
        'chat-need2': { account: '1', statusNeed: 'say which of the two, 10 seconds' },
      },
      settings: {}, truncated: [], messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/api/gallery/assets/recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ assets: [] }));
  }
  if (url.pathname === '/api/chatfeed/pages-recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ pages: [
      { id: 'p1', title: 'The columns — v2', chat: 'chat-page', created: iso(T0 - 90 * 60000) },
    ] }));
  }
  if (url.pathname === '/api/gallery/assets') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ assets: [], total: 0, offset: 0, limit: 150 }));
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
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });

  // The kind sections live INSIDE the rest fold since the two red boxes
  // (2026-08-27), and that fold starts SHUT — so reaching them is: open the
  // Update view, wait for the fold head, open it.
  const openUpdate = async () => {
    await page.waitForSelector('#grid [data-chat="chat-page"], #grid [data-chat="urg1"]');
    // The row takes turns with the three lists (2026-08-28) and opens on the
    // LISTS, so the account row — the UPDATE tab's own home — is one tap away.
    if (!await page.isVisible('#accrow')) await page.click('#rowtog');
    await page.click('#accrow .acctab[data-acct="new"]');
    await page.waitForSelector('#grid .sthead[data-kind="rest"]', { timeout: 4000 });
    if (await page.$('#grid .sthead[data-kind="rest"].folded')) {
      await page.click('#grid .sthead[data-kind="rest"]');
    }
    await page.waitForSelector('#grid .sthead[data-kind="decide"]', { timeout: 4000 });
  };
  // Walk the grid in document order: header → the cards under it, until the
  // next header. Flat (not `#grid > *`), because the two red boxes wrap their
  // header and cards in an outlined container; the KIND sections are what
  // this test folds, so the walk keeps only those three.
  const sections = () => page.$$eval('#grid .sthead, #grid .nwcard', (ns) => {
    const out = []; let cur = null;
    ns.forEach((n) => {
      if (n.classList.contains('sthead')) {
        cur = { head: n.textContent.trim(), kind: n.dataset.kind, tag: n.tagName,
          folded: n.classList.contains('folded'),
          chevron: !!n.querySelector('.nwfoldic svg'), cards: [] };
        out.push(cur);
      } else if (cur) cur.cards.push(n.dataset.chat);
    });
    return out.filter((s) => ['look', 'read', 'decide'].indexOf(s.kind) > -1);
  });
  const quick = '#grid .sthead[data-kind="decide"]';

  await page.goto(base + '/chats');
  await openUpdate();

  // 1. the header IS the button, wearing the chevron, big enough to tap
  let secs = await sections();
  if (secs.length !== 3) fail('expected three sections, got: ' + secs.map(s => s.head).join(' | '));
  secs.forEach((s) => {
    if (s.tag !== 'BUTTON') fail('the "' + s.head + '" header is a ' + s.tag + ', not the tap target itself');
    if (!s.chevron) fail('the "' + s.head + '" header has no fold chevron');
  });
  const box = await page.$eval(quick, n => { const r = n.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  if (box.h < 36) fail('the fold header is only ' + Math.round(box.h) + 'px tall — a thumb needs 36');

  const before = secs.map(s => s.cards.join(','));
  if (!/^Quick decisions\s*2$/.test(secs[2].head)) fail('Quick decisions (2) is not the last section: ' + secs[2].head);

  // 2. fold Quick decisions — its cards go, its header and count stay, and
  //    the other two sections are untouched
  await page.click(quick);
  await page.waitForTimeout(120);
  secs = await sections();
  if (secs.length !== 3) fail('a folded section lost its header: ' + secs.map(s => s.head).join(' | '));
  if (!/^Quick decisions\s*2$/.test(secs[2].head)) fail('the folded header lost its count: "' + secs[2].head + '"');
  if (!secs[2].folded) fail('the folded header is not marked folded');
  if (secs[2].cards.length) fail('the folded section still shows cards: ' + secs[2].cards.join(', '));
  if (secs[0].cards.join(',') !== before[0] || secs[1].cards.join(',') !== before[1]) {
    fail('folding one section moved another: ' + JSON.stringify(secs.map(s => s.cards)));
  }
  if (await page.$('.nwcard[data-chat="chat-need1"]')) fail('a folded card is still in the DOM');

  // 3. …and tapping it again brings exactly those cards back
  await page.click(quick);
  await page.waitForTimeout(120);
  secs = await sections();
  if (secs[2].cards.join(',') !== before[2]) {
    fail('unfolding did not restore the cards: ' + secs[2].cards.join(', ') + ' vs ' + before[2]);
  }
  if (secs[2].folded) fail('the unfolded header is still marked folded');

  // 4. a pick inside the section is dropped when it folds — so is the DONE
  //    chip, which is the thing that would have filed it without her
  await page.click('.nwcard[data-chat="chat-need1"] .nwck');
  await page.waitForTimeout(80);
  if (!await page.$('#catrow .nwdone')) fail('picking a card did not put DONE on the row');
  await page.click(quick);
  await page.waitForTimeout(120);
  if (await page.$('#catrow .nwdone')) fail('a folded-away pick is still selected — DONE is still on the row');
  await page.click(quick);            // back open: the card must not still be picked
  await page.waitForTimeout(120);
  if (await page.$('.nwcard[data-chat="chat-need1"].picked')) fail('the card came back still picked');

  // 5. session-only — a reload opens every section
  await page.click(quick);
  await page.waitForTimeout(100);
  await page.reload();
  await openUpdate();
  secs = await sections();
  if (secs.some(s => s.folded)) fail('a fold survived the reload — it must be session-only');
  if (secs[2].cards.join(',') !== before[2]) fail('after the reload Quick decisions is not whole again');

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('PASS: the Update tab\'s categories fold, and folding drops the picks inside them');
})().catch((e) => { console.error(e); process.exit(1); });
