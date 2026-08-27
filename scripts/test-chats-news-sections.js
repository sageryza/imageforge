#!/usr/bin/env node
// THE UPDATE TAB'S THREE SECTIONS (Aug 2026, Sophie: "the update tab is not
// working as I'd hoped because it became unmanageable. There's like so many
// things there — a possible fix is to sort it into deliverables and things
// that need to be read and things that just need quick decisions.")
//
// Drives the REAL public/chats.html headless against a stub API and asserts:
//   1. the main list paints as three sections in her spoken order —
//      DELIVERABLES · TO READ · QUICK DECISIONS — each header carrying its
//      count, and every card sits under the right one,
//   2. a fresh deliverable OUTRANKS an open `need` (a chat that hands her a
//      page and asks about it is under Deliverables — the ask still reads on
//      the card's own status line; need-first would bury the deliverables
//      under two dozen asks, the brief's 24-of-33 finding),
//   3. STALE pictures don't classify: a card whose pictures are older than
//      its ✓ floor is TO READ, while the pictures still render on the card
//      (they are context, deliberately not floor-filtered for display),
//   4. an empty section shows NO header — clearing the only Quick decisions
//      card takes that header with it,
//   5. an open BOX (Come back to) stays one flat list — no section headers.
//
// v2 (Aug 2026, the dream-commercial card — Sophie: "why is this in the quick
// decision tab? It's obviously a deliverable"):
//   6. a FILM/AUDIO pin re-posted since her ✓ is an ARRIVAL and a DELIVERABLE
//      — chat-film's only news is its re-pinned film, and it gets a card,
//      under Deliverables,
//   7. a need that tells her to GO LOOK at a thing ("listen to the two cuts")
//      is under Deliverables, not Quick decisions,
//   8. a pin OLDER than her ✓ classifies nothing (chat-oldpics carries one
//      and stays TO READ), and a fresh LINK pin counts for nothing either
//      (chat-need carries one and stays QUICK DECISIONS, its card timed by
//      its reply, not the pin).
//
//   npm install playwright-core --no-save && node scripts/test-chats-news-sections.js
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
const PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

// chat-page    — reply + a FRESH Compare page + an open need → DELIVERABLES
//                (the priority fixture: the need must not win)
// chat-film    — reply BEFORE her ✓, its film re-pinned AFTER it, no need →
//                a card raised by the pin alone, under DELIVERABLES (v2 —
//                the dream-commercial shape)
// chat-pics    — read long ago, three fresh pictures since → DELIVERABLES
// chat-ask     — unread reply + a need that says to LISTEN → DELIVERABLES
//                (v2 — a go-look ask is not a decision)
// chat-oldpics — pictures OLDER than her ✓ AND a film pin older than it, a
//                reply newer than it → TO READ, pictures still on the card
// chat-read    — a plain unread reply, no need → TO READ
// chat-need    — unread reply + an open need + a fresh LINK pin → QUICK
//                DECISIONS (a link pin is a bookmark, not a hand-off)
// …plus ten FILLERS (2026-08-27, the two red boxes): five with needs newer
// than everything (they fill Most urgent) and five starred+pinned (they fill
// Most important), so the seven classified chats above all land in THE REST —
// which is where the three kind sections live now, behind the fold.
const FILL = [];
for (let i = 1; i <= 5; i++) {
  FILL.push({ id: 'fu' + i, chat: 'urg' + i, from: 'claude', text: 'ask ' + i, tldr: 'ask ' + i, created: iso(T0 - i * 60000), postedAt: iso(T0 - i * 60000) });
  FILL.push({ id: 'fi' + i, chat: 'imp' + i, from: 'claude', text: 'starred ' + i, tldr: 'starred ' + i, created: iso(T0 - (5 + i) * 60000), postedAt: iso(T0 - (5 + i) * 60000) });
}
const MSGS = [
  ...FILL,
  { id: 'm1', chat: 'chat-page', from: 'claude', text: 'v2 is up', tldr: 'page v2', created: iso(T0 - 2 * H), postedAt: iso(T0 - 2 * H) },
  { id: 'm2', chat: 'chat-pics', from: 'claude', text: 'drawing', tldr: 'drawing the set', created: iso(T0 - 6 * H), postedAt: iso(T0 - 6 * H) },
  { id: 'm3', chat: 'chat-oldpics', from: 'claude', text: 'notes answered', tldr: 'answered her notes', created: iso(T0 - 30 * 60000), postedAt: iso(T0 - 30 * 60000) },
  { id: 'm4', chat: 'chat-read', from: 'claude', text: 'wrote it up', tldr: 'the write-up', created: iso(T0 - 1 * H), postedAt: iso(T0 - 1 * H) },
  { id: 'm5', chat: 'chat-need', from: 'claude', text: 'two options ready', tldr: 'two options', created: iso(T0 - 40 * 60000), postedAt: iso(T0 - 40 * 60000) },
  { id: 'm6', chat: 'chat-film', from: 'claude', text: 'v2 rendered', tldr: 'film v2', created: iso(T0 - 2 * H), postedAt: iso(T0 - 2 * H) },
  { id: 'm7', chat: 'chat-ask', from: 'claude', text: 'two cuts ready', tldr: 'two cuts', created: iso(T0 - 50 * 60000), postedAt: iso(T0 - 50 * 60000) },
];
const seenPosts = [];

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
        // an open need AND a fresh page — Deliverables must win
        'chat-page': { account: '1', statusNeed: 'peek v2, tell me which column' },
        'chat-pics': { account: '1' },
        // her ✓ an hour ago; the pictures AND the pin predate it, the reply
        // doesn't — a stale pin must not classify (or re-raise) anything
        'chat-oldpics': { account: '1', notifSeenAt: iso(T0 - 1 * H),
          pinned: { url: 'https://x.test/old-cut.mp4', title: 'Old cut', kind: 'video', at: iso(T0 - 2 * H), turns: 3 } },
        'chat-read': { account: '2' },
        // the fresh pin here is a LINK — a bookmark, never a deliverable
        'chat-need': { account: '1', statusNeed: 'pick a palette, 10 seconds',
          pinned: { url: 'https://x.test/science', title: 'The science page', kind: 'link', at: iso(T0 - 10 * 60000), turns: 0 } },
        // her ✓ an hour ago; the reply predates it; the FILM was re-pinned
        // 12 minutes ago — the pin alone raises the card and files it
        'chat-film': { account: '1', notifSeenAt: iso(T0 - 1 * H),
          pinned: { url: 'https://x.test/dream-v2.mp4', title: 'Dream commercial — v2 (0:45)', kind: 'video', at: iso(T0 - 12 * 60000), turns: 0 } },
        // nothing fresh — the need's own words say go LISTEN
        'chat-ask': { account: '1', statusNeed: 'listen to the two cuts, 2 min' },
      },
      settings: {}, truncated: [], messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/api/gallery/assets/recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ assets: [
      { url: '/px.png?a=1', thumb: '/px.png?a=1', chat: 'chat-pics', created: iso(T0 - 20 * 60000), description: 'Penny — the blue Kleenex' },
      { url: '/px.png?a=2', thumb: '/px.png?a=2', chat: 'chat-pics', created: iso(T0 - 25 * 60000) },
      { url: '/px.png?a=3', thumb: '/px.png?a=3', chat: 'chat-pics', created: iso(T0 - 30 * 60000) },
      // both older than chat-oldpics' ✓ — context on the card, never a filing
      { url: '/px.png?a=4', thumb: '/px.png?a=4', chat: 'chat-oldpics', created: iso(T0 - 2 * H) },
      { url: '/px.png?a=5', thumb: '/px.png?a=5', chat: 'chat-oldpics', created: iso(T0 - 3 * H) },
    ] }));
  }
  if (url.pathname === '/api/chatfeed/pages-recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ pages: [
      { id: 'p1', title: 'The columns — v2', chat: 'chat-page', created: iso(T0 - 90 * 60000) },
    ] }));
  }
  if (url.pathname === '/api/chatfeed/notif-seen' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      seenPosts.push(JSON.parse(body || '{}'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, notifSeenAt: iso(Date.now()) }));
    });
    return;
  }
  if (url.pathname === '/api/chatfeed/news-queue' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  if (url.pathname === '/api/gallery/assets') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ assets: [], total: 0, offset: 0, limit: 150 }));
  }
  if (url.pathname === '/px.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(PX);
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

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="chat-page"]');
  await page.click('#accrow .acctab[data-acct="new"]');
  await page.waitForSelector('.nwcard[data-chat="urg1"]');
  // the sections only settle once the delivered caches land — chat-film's
  // card is raised by its pin but timed against the pages/assets caches, so
  // "The rest" holding all seven classified chats is the settled state to
  // WAIT for, not the first paint.
  await page.waitForFunction(() => {
    const h = Array.from(document.querySelectorAll('#grid .sthead'));
    return h.some((n) => /^The rest\s*7/.test(n.textContent.trim()));
  }, null, { timeout: 6000 }).catch(() => fail('The rest never settled at 7 cards'));

  // Walk the grid in document order: header → the cards under it, until the
  // next header. Flat (not `#grid > *`), because the two red boxes wrap their
  // header and cards in an outlined container (2026-08-27).
  const sections = () => page.$$eval('#grid .sthead, #grid .nwcard', (ns) => {
    const out = []; let cur = null;
    ns.forEach((n) => {
      if (n.classList.contains('sthead')) { cur = { head: n.textContent.trim(), cards: [] }; out.push(cur); }
      else if (cur) cur.cards.push(n.dataset.chat);
    });
    return out;
  });

  // 0. the seven classified chats are behind THE REST, which starts SHUT —
  //    the fillers hold the two red boxes, so the kind sections are the fold's
  //    to show (2026-08-27, the two-red-boxes rework).
  let secs = await sections();
  if (secs.some(s => /^Deliverables/.test(s.head))) {
    fail('the kind sections are painted while The rest is still folded: ' + secs.map(s => s.head).join(' | '));
  }
  const restHead = secs.find(s => /^The rest\s*7$/.test(s.head));
  if (!restHead) fail('no "The rest 7" fold head: ' + secs.map(s => s.head).join(' | '));
  await page.click('#grid .sthead[data-kind="rest"]');
  await page.waitForSelector('#grid .sthead[data-kind="look"]', { timeout: 4000 })
    .catch(() => fail('opening The rest did not reveal the kind sections'));
  await page.waitForSelector('.nwcard[data-chat="chat-pics"] .nwimg', { timeout: 4000 }).catch(() => {});

  // 1. three kind sections inside the fold, her spoken order, counts on the
  //    headers
  secs = await sections();
  const heads = secs.map(s => s.head).filter(h => /^(Deliverables|To read|Quick decisions)/.test(h));
  if (heads.length !== 3) fail('expected three kind section headers, got: ' + heads.join(' | '));
  if (!/^Deliverables\s*4$/.test(heads[0] || '')) fail('Deliverables (4) is not the first section: ' + heads.join(' | '));
  if (!/^To read\s*2$/.test(heads[1] || '')) fail('To read (2) is not the second section: ' + heads.join(' | '));
  if (!/^Quick decisions\s*1$/.test(heads[2] || '')) fail('Quick decisions (1) is not the last section: ' + heads.join(' | '));
  secs = secs.filter(s => /^(Deliverables|To read|Quick decisions)/.test(s.head));

  // …and every card under the right one, newest arrival first within each.
  // chat-film is timed by its PIN (12m — its reply predates her ✓), which is
  // both v2 rules in one line: the pin raised the card and filed it.
  // chat-ask sits here on its need's own words; chat-need's fresh LINK pin
  // moved it nowhere and its card is timed by its reply (40m), not the pin.
  if (JSON.stringify(secs[0] && secs[0].cards) !== JSON.stringify(['chat-film', 'chat-pics', 'chat-ask', 'chat-page'])) {
    fail('wrong Deliverables cards: ' + JSON.stringify(secs[0] && secs[0].cards));
  }
  if (JSON.stringify(secs[1] && secs[1].cards) !== JSON.stringify(['chat-oldpics', 'chat-read'])) {
    fail('wrong To read cards: ' + JSON.stringify(secs[1] && secs[1].cards));
  }
  if (JSON.stringify(secs[2] && secs[2].cards) !== JSON.stringify(['chat-need'])) {
    fail('wrong Quick decisions cards: ' + JSON.stringify(secs[2] && secs[2].cards));
  }

  // 2. the priority pin is inside that walk already — chat-page carries an
  //    open need AND a fresh page and sat under Deliverables. Its ask still
  //    reads on the card's own line:
  const line = await page.$eval('.nwcard[data-chat="chat-page"] .cr-note', n => n.textContent).catch(() => '');
  if (line.indexOf('peek v2') < 0) fail('the need no longer reads on a Deliverables card: "' + line + '"');

  // 3. stale pictures still RENDER on the To read card — visibly, not as a
  //    hidden cell whose image failed
  const showing = await page.$$eval('.nwcard[data-chat="chat-oldpics"] .nwimg',
    ns => ns.filter(n => getComputedStyle(n).display !== 'none').length).catch(() => 0);
  if (!showing) fail('the To read card lost its (context) pictures');

  // 4. clear the only Quick decisions card → that header goes with it
  await page.click('.nwcard[data-chat="chat-need"] .nwck');
  await page.click('#catrow .nwdone');
  await page.waitForTimeout(150);
  if (!seenPosts.some(p => p.chat === 'chat-need')) fail('DONE did not POST /notif-seen for chat-need');
  secs = await sections();
  if (secs.some(s => /^Quick decisions/.test(s.head))) {
    fail('an EMPTY section still shows its header: ' + secs.map(s => s.head).join(' | '));
  }

  // 5. an open box is one flat list — file a card, open Come back to
  await page.click('.nwcard[data-chat="chat-read"] .nwck');
  await page.click('#catrow .catchip:nth-of-type(1)');
  await page.waitForTimeout(120);
  await page.click('#catrow .catchip:nth-of-type(1)');   // nothing picked → opens the box
  await page.waitForTimeout(80);
  const inBox = await page.$$eval('.nwcard', ns => ns.map(n => n.dataset.chat));
  if (inBox.indexOf('chat-read') < 0) fail('the filed card is not in the open box: ' + inBox.join(', '));
  if (await page.$('#grid .sthead')) fail('an open box is grouped — it must stay one flat list');

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('PASS: the Update list sorts into Deliverables · To read · Quick decisions');
})().catch((e) => { console.error(e); process.exit(1); });
