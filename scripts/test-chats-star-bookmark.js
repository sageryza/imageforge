#!/usr/bin/env node
// Starred chats + a note on a bookmark (Aug 2026, Sophie: "chats that were
// important, that have work I want to refer back to, but I'm not actively
// using them — those should be starred… a red star", and "when I bookmark
// messages I want to leave a note or title the message so I remember what it
// was and why I bookmarked it"). Drives the REAL public/chats.html headless
// against a stub API and asserts:
//   1. a starred chat wears the red star at the FRONT of its row,
//   2. the ★ chip shows the starred pile and REACHES INTO THE ARCHIVE — that
//      is where these chats live, so a star filter that stopped at `archived`
//      would miss most of them,
//   3. the star button in a chat's header sets it (POST /star),
//   4. bookmarking a message opens a note box straight away and typing in it
//      POSTs the note without touching the bookmark itself,
//   5. the note box STAYS under a bookmarked message (no hunting for a gesture
//      to edit it) and goes when she un-bookmarks,
//   6. the note is EDITABLE right on the row in the Bookmarks view — naming a
//      backlog must not mean opening each message in turn — and typing there
//      POSTs the note without touching the bookmark.
//
//   npm install playwright-core --no-save && node scripts/test-chats-star-bookmark.js
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

const MSGS = [
  { id: 'm1', chat: 'chat-plain', from: 'claude', text: 'an ordinary reply', tldr: 'plain', created: iso(T0 - 3600000), postedAt: iso(T0 - 3600000) },
  { id: 'm2', chat: 'chat-star', from: 'claude', text: 'the good one', tldr: 'starred', created: iso(T0 - 7200000), postedAt: iso(T0 - 7200000) },
  { id: 'm3', chat: 'chat-arch', from: 'claude', text: 'archived but starred', tldr: 'imprint', created: iso(T0 - 10800000), postedAt: iso(T0 - 10800000) },
  { id: 'm4', chat: 'chat-keep', from: 'claude', text: 'the keeper', tldr: 'kept forever', created: iso(T0 - 14400000), postedAt: iso(T0 - 14400000) },
];
const starPosts = [];
const keptPosts = [];
const bmkPosts = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  const body = (cb) => { let b = ''; req.on('data', (c) => b += c); req.on('end', () => cb(JSON.parse(b || '{}'))); };

  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    return json({
      build: 'test-build-1',
      chats: {
        'chat-plain': { lastSeen: MSGS[0].created },
        'chat-star': { lastSeen: MSGS[1].created, starred: true },
        // starred AND archived — the pile has to reach in here
        'chat-arch': { lastSeen: MSGS[2].created, starred: true, archived: true },
        // KEPT, not starred — the two marks were split apart (Aug 2026), so
        // this one must draw the bookmark glyph and NOT the star
        'chat-keep': { lastSeen: MSGS[3].created, bookmarked: true },
      },
      settings: {}, truncated: [],
      messages: since ? [] : MSGS, delta: !!since,
    });
  }
  if (url.pathname === '/api/chatfeed/star' && req.method === 'POST') {
    return body((p) => { starPosts.push(p); json({ ok: true, starred: !!p.starred }); });
  }
  if (url.pathname === '/api/chatfeed/chat-bookmark' && req.method === 'POST') {
    return body((p) => { keptPosts.push(p); json({ ok: true, bookmarked: !!p.bookmarked }); });
  }
  if (url.pathname === '/api/chatfeed/bookmark' && req.method === 'POST') {
    return body((p) => { bmkPosts.push(p); json({ ok: true }); });
  }
  if (url.pathname === '/api/chatfeed/bookmarks') {
    return json({
      items: [{ id: 'm2', chat: 'chat-star', created: MSGS[1].created,
                snippet: 'the good one', note: 'the montage cut list', kind: 'read' }],
      chats: {},
    });
  }
  if (url.pathname === '/api/chatfeed/thread') return json({ messages: [] });
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  json({});
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="chat-plain"]');

  // 1. the star is on the starred row and nowhere else, at the front
  const stars = await page.$$eval('#grid > .clist .crow[data-chat]', (ns) => ns.map((n) => ({
    chat: n.dataset.chat,
    star: !!n.querySelector('.cr-star'),
    beforeName: n.querySelector('.cr-star')
      ? n.querySelector('.cr-star').getBoundingClientRect().x < n.querySelector('.cr-name').getBoundingClientRect().x
      : null,
  })));
  const starred = stars.find((r) => r.chat === 'chat-star');
  const plain = stars.find((r) => r.chat === 'chat-plain');
  if (!starred || !starred.star) fail('the starred chat has no star');
  if (starred && !starred.beforeName) fail('the star is not at the front of the row');
  if (!plain || plain.star) fail('an unstarred chat drew a star');

  // 2. the ★ chip shows the pile, archive included
  await page.click('#catrow .starchip');
  await page.waitForFunction(
    () => !!document.querySelector('#grid .crow[data-chat="chat-arch"]'),
    null, { timeout: 4000 }).catch(() => fail('the ★ pile did not reach into the archive'));
  const pile = await page.$$eval('#grid .crow[data-chat]', (ns) => ns.map((n) => n.dataset.chat).sort());
  if (JSON.stringify(pile) !== JSON.stringify(['chat-arch', 'chat-star'])) fail('★ pile wrong: ' + pile.join(','));
  await page.click('#catrow .starchip');   // back to everything
  await page.waitForSelector('#grid > .clist .crow[data-chat="chat-plain"]');

  // 3. the star sets it — from the ORGANIZE sheet, where the marks moved (Aug
  //    2026, Sophie: "take them out of the main thing and put them in little
  //    boxes like the … category tag things").
  const openOrg = async () => {
    await page.waitForSelector('#thread .orgbtn');
    await page.click('#thread .orgbtn');
    await page.waitForSelector('.askwrap .orgmarks .starbtn', { timeout: 4000 });
  };
  const closeOrg = async () => {
    await page.click('.askwrap .askrow .go');
    await page.waitForFunction(() => !document.querySelector('.askwrap'), null, { timeout: 4000 });
  };
  await page.click('#grid > .clist .crow[data-chat="chat-plain"]');
  await openOrg();
  await page.click('.askwrap .orgmarks .starbtn');
  await page.waitForFunction(() => document.querySelector('.askwrap .orgmarks .starbtn').classList.contains('on'),
    null, { timeout: 4000 }).catch(() => fail('the star in the Organize sheet did not light'));
  if (!starPosts.some((p) => p.chat === 'chat-plain' && p.starred === true)) fail('POST /star never fired');

  // 3b. KEEPING A CHAT IS A DIFFERENT MARK FROM STARRING IT (Aug 2026, Sophie:
  //     "bookmarking a chat is when I want to keep it in my history and go back
  //     to it… bookmarks stay forever", against a star for "a chat I'm
  //     currently working on"). The two used to be one flag.
  await closeOrg();
  await page.click('#back');
  await page.waitForSelector('#grid > .clist .crow[data-chat="chat-keep"]');
  const marks = await page.$$eval('#grid > .clist .crow[data-chat]', (ns) => ns.map((n) => ({
    chat: n.dataset.chat,
    star: !!n.querySelector('.cr-star'),
    kept: !!n.querySelector('.cr-kept'),
  })));
  const keep = marks.find((r) => r.chat === 'chat-keep');
  const starOnly = marks.find((r) => r.chat === 'chat-star');
  if (!keep || !keep.kept) fail('a kept chat drew no bookmark on its row');
  if (keep && keep.star) fail('a kept chat also drew a star — the marks are not separate');
  if (starOnly && starOnly.kept) fail('a starred chat drew the keep mark — the marks are not separate');

  //     …and the Organize sheet carries BOTH controls, side by side
  await page.click('#grid > .clist .crow[data-chat="chat-keep"]');
  await openOrg();
  if (!(await page.$('.askwrap .orgmarks .bmk.chatbmk'))) fail('the Organize sheet has no keep mark');
  if (!(await page.$('.askwrap .orgmarks .starbtn'))) fail('the Organize sheet lost its star');
  if (!(await page.$eval('.askwrap .orgmarks .bmk.chatbmk', (n) => n.classList.contains('on'))))
    fail('the keep button is not lit on a kept chat');
  await page.click('.askwrap .orgmarks .bmk.chatbmk');
  await page.waitForFunction(() => !document.querySelector('.askwrap .orgmarks .bmk.chatbmk').classList.contains('on'),
    null, { timeout: 4000 }).catch(() => fail('the keep button did not unlight'));
  if (!keptPosts.some((p) => p.chat === 'chat-keep' && p.bookmarked === false))
    fail('POST /chat-bookmark never fired: ' + JSON.stringify(keptPosts));
  //     starring it must NOT touch the keep flag
  const keptBefore = keptPosts.length;
  await page.click('.askwrap .orgmarks .starbtn');
  await page.waitForTimeout(200);
  if (keptPosts.length !== keptBefore) fail('the star button also wrote the keep flag');
  await closeOrg();
  await page.click('#back');
  await page.waitForSelector('#grid > .clist .crow[data-chat="chat-plain"]');
  await page.click('#grid > .clist .crow[data-chat="chat-plain"]');
  await page.waitForSelector('#thread .msg');

  // 4. bookmarking opens the note box, and typing saves only the note
  await page.click('#thread .msg .bmk');
  await page.waitForSelector('#thread .bmknote input', { timeout: 4000 })
    .catch(() => fail('bookmarking did not open the note box'));
  if (!bmkPosts.some((p) => p.bookmarked === true)) fail('POST /bookmark never fired');
  await page.fill('#thread .bmknote input', 'the montage cut list');
  await page.click('#thread h1');                       // tap away to save
  await page.waitForFunction(() => window.__n === undefined, null, { timeout: 500 }).catch(() => {});
  const notePost = bmkPosts.find((p) => p.note === 'the montage cut list');
  if (!notePost) fail('the note was never POSTed: ' + JSON.stringify(bmkPosts));
  if (notePost && notePost.bookmarked !== undefined) fail('saving a note also wrote the bookmark flag');

  // 5. the box is still there (it belongs to the bookmark, not to the tap that
  //    made it), and un-bookmarking takes it away
  if (!(await page.$('#thread .bmknote input'))) fail('the note box vanished while the message was still bookmarked');
  if (await page.$eval('#thread .bmknote input', (n) => n.value) !== 'the montage cut list') fail('the note box lost what she typed');
  await page.click('#thread .msg .bmk');
  await page.waitForFunction(() => !document.querySelector('#thread .bmknote'),
    null, { timeout: 4000 }).catch(() => fail('un-bookmarking left the note box behind'));
  if (!bmkPosts.some((p) => p.bookmarked === false)) fail('un-bookmarking never POSTed');

  // 6. the note leads the row in the Bookmarks view
  await page.click('#back');
  await page.waitForSelector('#grid');
  await page.click('#bmklink');
  await page.waitForSelector('#grid .bmkrow', { timeout: 4000 })
    .catch(() => fail('the bookmarks view never rendered'));
  const shown = await page.$eval('#grid .bmkrow .sr-note-in', (n) => n.value);
  if (shown !== 'the montage cut list') fail('the row did not show the saved note: ' + shown);
  // and it LEADS: above the snippet, below the chat line
  const order = await page.$eval('#grid .bmkrow', (n) => {
    const top = n.querySelector('.sr-top').getBoundingClientRect().y;
    const note = n.querySelector('.sr-note-in').getBoundingClientRect().y;
    const snip = n.querySelector('.sr-snip').getBoundingClientRect().y;
    return top < note && note < snip;
  });
  if (!order) fail('the note is not between the chat line and the snippet');
  // and it can be renamed WITHOUT opening the message
  const before2 = bmkPosts.length;
  await page.fill('#grid .bmkrow .sr-note-in', 'darius cage prompt');
  // tap away to save — onto the MESSAGES tab, the one already active, so the
  // blur fires without swapping the view out from under the assertions
  await page.click('#grid .acctabs.bmktabs .acctab:nth-child(3)');
  await page.waitForFunction(() => true, null, { timeout: 300 }).catch(() => {});
  const renamed = bmkPosts[bmkPosts.length - 1];
  if (!renamed || renamed.note !== 'darius cage prompt') fail('renaming on the row never POSTed: ' + JSON.stringify(bmkPosts.slice(before2)));
  if (renamed && renamed.bookmarked !== undefined) fail('renaming on the row also wrote the bookmark flag');
  if (await page.$eval('#thread', (n) => n.style.display !== 'none')) fail('editing the note opened the chat');

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures' : 'OK: stars mark and filter across the archive; bookmark notes save and lead');
})().catch((e) => { console.error(e); process.exit(1); });
