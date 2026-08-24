#!/usr/bin/env node
// test-chats-bookmark-tags.js — what a KEPT thing is: the note, the tags, and
// the two doors above the chats.
//
//   node scripts/test-chats-bookmark-tags.js
//
// Sophie, Aug 2026, in one message:
//   "make the review button on updates tab not red"
//   "add a to read button next to it"
//   "when i bookmark a message it offers a textbox to say whi i'm saving it.
//    shud be same for artifact"
//   "also, both shud now have a set of tag buttons: to read, and 'important'
//    level (1-3) - icons, and review finished feature, review bug fix or
//    information/question answered"
//
// The pure half pins the vocabulary in the two places it is written — one word
// existing on one side only is the failure this file exists to catch — and the
// server's whitelist. The headless half drives the REAL public/chats.html:
//
//   1. the Review door is NOT painted in the accent any more (measured against
//      --rose, so a copy-paste cannot bring the red back), and it still counts;
//   2. a To read door sits beside it, on every paint, carrying its count;
//   3. tapping it opens the keep-pile with the To read filter lit;
//   4. keeping a MESSAGE opens a textbox AND the tag row, and a tag POSTs to
//      the message route carrying no keep-flag;
//   4b. THE TAGS ARE THE KEEPING STEP ONLY (Aug 2026, her correction: "those
//      tags were supposed to only show up in the step when I'm actively
//      bookmarking it") — a kept thing painted fresh carries its note and no
//      tags, and the keep-pile's rows carry none either;
//   4c. the keep-pile's rows carry HER READ BOX instead: a rounded square, grey
//      and empty, red with a tick once she marks it, POSTing {read:true} with
//      no keep-flag — and a kept CHAT has none;
//   5. keeping an ARTIFACT opens the same textbox and the same tag row — one
//      renderer, so the two can never drift — and its tags POST to the page's
//      own route;
//   6. the importance is a DIAL: setting 2 clears 1, and tapping the lit one
//      clears it altogether.
//
// Skips cleanly without Chromium (CHROME_PATH overrides).
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + ': ' + m); if (!c) { fails++; process.exitCode = 1; } };

// ---- 1. the vocabulary, written in two files ------------------------------
const feed = require('../chatfeed.js');
const html = fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8');
const m = html.match(/var BMK_TAGS=\[([\s\S]*?)\];/);
const pageTags = m ? (m[1].match(/\['([a-z-]+)'/g) || []).map((x) => x.slice(2, -1)) : [];
ok(pageTags.length > 0, 'the page declares BMK_TAGS');
ok(JSON.stringify(pageTags) === JSON.stringify(feed.BMK_TAGS),
   'the page and the server agree on the words: ' + pageTags.join(' · '));
ok(feed.BMK_TAGS.indexOf('to-read') === 0, 'to-read leads — it is the one with a door');

// ---- 2. the server's whitelist --------------------------------------------
const del = (v) => v && typeof v === 'object' && /delete/i.test(v.constructor.name || '') ;
const marks = (b) => feed.bookmarkMarks(b);
ok(JSON.stringify(marks({ tags: ['to-read', 'bugfix'] }).bmkTags) === '["to-read","bugfix"]',
   'known words are kept, in the order she tapped them');
ok(JSON.stringify(marks({ tags: ['to-read', 'nonsense', 'to-read'] }).bmkTags) === '["to-read"]',
   'an unknown word is dropped and a repeat is deduped — never a refusal, so an older page still saves');
ok(marks({ level: 2 }).bmkLevel === 2, 'a level rides through');
ok(typeof marks({ level: 0 }).bmkLevel === 'object', 'level 0 clears it');
ok(typeof marks({ level: 9 }).bmkLevel === 'object', 'a level outside 1-3 clears rather than storing nonsense');
ok(!('bmkTags' in marks({ level: 1 })) && !('bmkLevel' in marks({ tags: [] })),
   'a field she did not send is left alone — tagging can never wipe the level');

// ---- 3. the page ----------------------------------------------------------
const PAGES = [{ id: 'p1', title: 'Cutting blocks v6 (s96)', created: iso(T0 - 6e5), superseded: false }];
// chat-b carries her `to be reviewed` word, which is what puts the Review
// door in the row at all — without it there is nothing red to measure.
const CHATS = {
  'chat-a': { lastSeen: iso(T0 - 36e5) },
  'chat-b': { lastSeen: iso(T0 - 30e5), labels: ['to be reviewed'], filedAt: iso(T0 - 30e5) },
};
const posts = [];
const store = { p1: {}, m1: {} };
let toRead = 3;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  const send = (t, b) => { res.writeHead(200, { 'Content-Type': t }); res.end(b); };
  const json = (o) => send('application/json', JSON.stringify(o));
  const read = (cb) => { let b = ''; req.on('data', (d) => b += d); req.on('end', () => cb(JSON.parse(b || '{}'))); };
  if (p === '/' || p === '/chats') return send('text/html; charset=utf-8', html);
  if (p === '/api/chatfeed/to-read') return json({ ok: true, count: toRead });
  if (p.startsWith('/api/chatfeed/page/') && p.endsWith('/bookmark')) {
    return read((body) => {
      const id = p.split('/')[4];
      posts.push({ route: 'page-bookmark', id, body });
      Object.assign(store[id] = store[id] || {}, body);
      json({ ok: true, id });
    });
  }
  if (p === '/api/chatfeed/bookmark') {
    return read((body) => { posts.push({ route: 'bookmark', id: body.id, body }); json({ ok: true }); });
  }
  if (p.startsWith('/api/chatfeed/page/') && p.endsWith('/supersede')) return read(() => json({ ok: true }));
  if (p.startsWith('/api/chatfeed/page/')) return send('text/html; charset=utf-8', '<h1>the artifact</h1>');
  if (p === '/api/chatfeed/pages') return json({
    pages: PAGES.map((x) => Object.assign({}, x, {
      bookmarked: !!store[x.id].bookmarked, bookmarkNote: store[x.id].note || '',
      bmkTags: store[x.id].tags || [], bmkLevel: store[x.id].level || 0,
    })),
  });
  if (p === '/api/chatfeed/bookmarks') return json({
    chats: CHATS,
    items: [
      { id: 'm1', chat: 'chat-a', from: 'claude', created: iso(T0 - 3e5),
        snippet: 'the long explanation', note: '', kind: 'read', tags: ['to-read'], level: 2 },
      { id: 'm2', chat: 'chat-a', from: 'claude', created: iso(T0 - 4e5),
        snippet: 'a kept reply with no tags', note: '', kind: 'read', tags: [], level: 0 },
      { id: 'chat-b', chat: 'chat-b', from: '', created: iso(T0 - 5e5),
        title: 'chat-b', snippet: 'a kept chat', note: '', kind: 'chat' },
    ],
  });
  if (p === '/api/chatfeed') {
    const t = iso(T0 - 36e5);
    return json({
      build: 't', settings: {}, truncated: [], delta: false, chats: CHATS,
      messages: [{ id: 'm1', chat: 'chat-a', from: 'claude', text: 'a long explanation',
                   tldr: 'hi', created: t, postedAt: t },
                 { id: 'm4', chat: 'chat-a', from: 'claude', text: 'one she kept a while ago',
                   tldr: 'kept', created: t, postedAt: t, bookmarked: true,
                   bookmarkNote: 'why I kept it', bmkTags: ['to-read'], bmkLevel: 1 },
                 { id: 'm3', chat: 'chat-b', from: 'claude', text: 'the deck is ready',
                   tldr: 'deck ready', created: t, postedAt: t }],
    });
  }
  if (p === '/brief') return send('text/html; charset=utf-8', '<body id="briefpage">brief</body>');
  if (p.startsWith('/api/')) return json({ ok: true, assets: [], items: [], texts: {}, pages: [] });
  try { return send('text/plain', fs.readFileSync(path.join(PUB, p.slice(1)))); }
  catch (_) { res.writeHead(404); res.end(''); }
});

(async () => {
  let pw; try { pw = require('playwright'); }
  catch (_) { try { pw = require('playwright-core'); } catch (_2) { console.log('playwright not installed — skipping the page half'); process.exit(fails ? 1 : 0); } }
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((f) => { try { fs.accessSync(f); return true; } catch (_) { return false; } });
  const b = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH || preinstalled || undefined, args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => ok(false, 'the page threw: ' + e.message));

  // ---- the doors row ------------------------------------------------------
  await page.goto(base + '/chats?view=news', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#nwdoors .nwdoor', { timeout: 8000 });
  // the count is its own request — wait for it to land rather than reading the
  // first paint, which is a race that only sometimes goes the right way
  await page.waitForFunction(() => /To read/.test(document.getElementById('nwdoors').textContent)
    && /3/.test(document.getElementById('nwdoors').textContent), null, { timeout: 8000 }).catch(() => {});

  const words = await page.$$eval('#nwdoors .nwdoor', (ns) => ns.map((n) => n.textContent.trim()));
  ok(words[0] === 'Update', 'Update still leads the row');
  ok(words.some((w) => /^To read/.test(w)), 'a To read door sits in the row: ' + words.join(' · '));
  ok(/To read3/.test(words.join('')) || /To read\s*3/.test(words.join('')),
     'carrying its count from the server');

  // NOT RED — measured against the token, so a copy-paste can't bring it back.
  const paint = await page.evaluate(() => {
    const rose = getComputedStyle(document.documentElement).getPropertyValue('--rose').trim();
    const pair = document.querySelector('#nwdoors .nwrevpair');
    if (!pair) return { none: true, rose };
    const cs = getComputedStyle(pair);
    const word = getComputedStyle(pair.querySelector('.nwdoor'));
    const norm = (c) => { const d = document.createElement('div'); d.style.color = c;
      document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; };
    return { rose: norm(rose), border: cs.borderTopColor, colour: word.color, line: getComputedStyle(document.documentElement).getPropertyValue('--line').trim() };
  });
  ok(!paint.none, 'the Review door is on screen to be measured');
  if (!paint.none) {
    ok(paint.border !== paint.rose, 'the Review door’s border is not the accent (' + paint.border + ')');
    ok(paint.colour !== paint.rose, '…and neither is its word (' + paint.colour + ')');
  }

  // tapping To read opens the keep-pile with the filter lit
  await page.$$eval('#nwdoors .nwdoor', (ns) => {
    const t = ns.find((n) => /^To read/.test(n.textContent.trim())); t.click();
  });
  await page.waitForTimeout(600);
  ok(await page.$$eval('#grid .bmktagbar .catchip.on', (n) => n.length) === 1,
     'the keep-pile opens with the To read filter lit');
  ok(await page.$$eval('#grid .bmkrow', (n) => n.length) === 1,
     'and shows only what is tagged to read');
  ok(await page.$$eval('#grid .acctabs.bmktabs', (n) => n.length) === 0,
     'the kind tabs stand down while a tag narrows the pile — one flat list');
  ok(await page.$$eval('#grid .bmkrow .bmkmarks', (n) => n.length) === 0,
     'no tag chips on a keep-pile row — the tags are the keeping step, not the reading one');

  // HER READ BOX, on the row she is reading through
  const box = await page.$$eval('#grid .bmkrow .bmkchk', (ns) => ns.map((n) => {
    const cs = getComputedStyle(n);
    return { r: cs.borderRadius, on: n.classList.contains('on'),
             tick: !!n.querySelector('svg'),
             w: Math.round(n.getBoundingClientRect().width),
             h: Math.round(n.getBoundingClientRect().height) };
  }));
  ok(box.length === 1, 'the To read row carries one read box');
  ok(box[0] && box[0].w === box[0].h, '…a square (' + (box[0] && box[0].w) + '×' + (box[0] && box[0].h) + ')');
  ok(box[0] && /^6px/.test(box[0].r), '…rounded at the house 6px, not a circle (' + (box[0] && box[0].r) + ')');
  ok(box[0] && !box[0].on, '…empty until she ticks it');

  let before = posts.length; let last;
  await page.click('#grid .bmkrow .bmkchk');
  await page.waitForTimeout(400);
  last = posts[posts.length - 1];
  ok(posts.length === before + 1 && last.route === 'bookmark' && last.body.read === true,
     'ticking it POSTs {read:true} to that thing’s own route');
  ok(!('bookmarked' in last.body) && !('tags' in last.body),
     '…and touches nothing else — a tick can never un-keep or re-tag it');
  const litbox = await page.$eval('#grid .bmkrow .bmkchk', (n) => {
    const cs = getComputedStyle(n); const svg = getComputedStyle(n.querySelector('svg'));
    const rose = getComputedStyle(document.documentElement).getPropertyValue('--chg').trim();
    const d = document.createElement('div'); d.style.color = rose; document.body.appendChild(d);
    const want = getComputedStyle(d).color; d.remove();
    return { on: n.classList.contains('on'), bg: cs.backgroundColor, want, tick: svg.visibility };
  });
  ok(litbox.on && litbox.bg === litbox.want, 'and it goes red (' + litbox.bg + ')');
  ok(litbox.tick === 'visible', '…with the check shown in it');
  ok(await page.$eval('#thread', (n) => n.style.display === 'none' || !n.offsetParent),
     'ticking a row does not open the thing behind it');

  await page.click('#grid .bmktagbar .catchip.on');
  await page.waitForTimeout(400);
  ok(await page.$$eval('#grid .bmkrow', (n) => n.length) === 2, 'clearing the chip gives the whole pile back');
  // a kept CHAT is not a thing you finish reading — Chats tab, third row
  await page.$$eval('#grid .acctabs.bmktabs .acctab', (ns) => ns[0].click());
  await page.waitForTimeout(400);
  ok(await page.$$eval('#grid .bmkrow', (n) => n.length) === 1, 'the Chats tab holds the kept chat');
  ok(await page.$$eval('#grid .bmkrow .bmkchk', (n) => n.length) === 0,
     '…and it carries no read box');

  // ---- keeping a MESSAGE --------------------------------------------------
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.crow[data-chat="chat-a"]', { timeout: 8000 });
  await page.click('.crow[data-chat="chat-a"]');
  await page.waitForTimeout(400);
  // m1 is the one she has NOT kept; m4 is one kept a while ago (below)
  await page.click('#thread .msg[data-mid="m1"] .bmk');
  await page.waitForTimeout(400);
  ok(await page.$$eval('#thread .msg[data-mid="m1"] .bmkedit .bmknote input', (n) => n.length) === 1,
     'keeping a message opens the textbox that says why she saved it');
  const chips = await page.$$eval('#thread .msg[data-mid="m1"] .bmkedit .bmkmarks .catchip', (n) => n.map((x) => x.textContent.trim()));
  ok(chips.length === 4, 'and four tag chips beside it: ' + chips.join(' · '));
  ok(await page.$$eval('#thread .msg[data-mid="m1"] .bmkedit .lvlbox button', (n) => n.length) === 3,
     'and the three importance levels, drawn as icons');
  ok(await page.$$eval('#thread .msg[data-mid="m1"] .bmkedit .lvlbox button svg', (n) => n.length) === 3,
     '…icons, not words');
  ok(await page.$$eval('#thread .msg[data-mid="m1"] .bmkedit .lvlbox button', (n) => n.every((x) => !x.textContent.trim())),
     '…with no text in them');

  // …but a message she kept EARLIER, painted fresh, carries the note alone
  ok(await page.$$eval('#thread .msg', (ns) => {
    const kept = ns.find((n) => /one she kept a while ago/.test(n.textContent));
    return kept ? kept.querySelectorAll('.bmknote input').length : -1;
  }) === 1, 'a thing kept earlier still carries its note on a fresh paint');
  ok(await page.$$eval('#thread .msg', (ns) => {
    const kept = ns.find((n) => /one she kept a while ago/.test(n.textContent));
    return kept ? kept.querySelectorAll('.bmkmarks').length : -1;
  }) === 0, '…and NO tags: that is not the moment she is keeping it');

  before = posts.length;
  await page.click('#thread .msg[data-mid="m1"] .bmkedit .bmkmarks .catchip[data-tag="to-read"]');
  await page.waitForTimeout(400);
  last = posts[posts.length - 1];
  ok(posts.length === before + 1 && last.route === 'bookmark' && last.id === 'm1',
     'a tag POSTs to the message’s own route');
  ok(JSON.stringify(last.body.tags) === '["to-read"]', '…carrying the word she tapped');
  ok(!('bookmarked' in last.body), '…and no keep-flag, so tagging can never un-keep it');
  ok(await page.$eval('#thread .msg[data-mid="m1"] .bmkedit .catchip[data-tag="to-read"]', (n) => n.classList.contains('on')),
     '…and the chip lights');

  // the importance is a dial
  await page.click('#thread .msg[data-mid="m1"] .bmkedit .lvlbox button[data-level="1"]');
  await page.waitForTimeout(300);
  await page.click('#thread .msg[data-mid="m1"] .bmkedit .lvlbox button[data-level="2"]');
  await page.waitForTimeout(300);
  let lit = await page.$$eval('#thread .msg[data-mid="m1"] .bmkedit .lvlbox button', (n) => n.map((x) => x.classList.contains('on')));
  ok(JSON.stringify(lit) === '[false,true,false]', 'setting a level clears the one before it — it is a dial, not a fourth tag');
  ok(posts[posts.length - 1].body.level === 2, '…and the level goes to the server');
  await page.click('#thread .msg[data-mid="m1"] .bmkedit .lvlbox button[data-level="2"]');
  await page.waitForTimeout(300);
  ok(posts[posts.length - 1].body.level === 0, 'tapping the lit one clears it');

  // un-keeping takes the whole editor with it
  await page.click('#thread .msg[data-mid="m1"] .bmk');
  await page.waitForTimeout(300);
  ok(await page.$$eval('#thread .msg[data-mid="m1"] .bmkedit', (n) => n.length) === 0,
     'un-keeping takes the note AND the tags away — one node, never half of it');

  // ---- keeping an ARTIFACT ------------------------------------------------
  await page.click('.tg-compare'); await page.waitForTimeout(500);
  before = posts.length;
  await page.click('.pagerow .pr-bmk');
  await page.waitForTimeout(400);
  ok(await page.$$eval('.pagerow .bmkedit .bmknote input', (n) => n.length) === 1,
     'keeping an ARTIFACT opens the same textbox (her ask: "shud be same for artifact")');
  ok(await page.$$eval('.pagerow .bmkedit .bmkmarks .catchip', (n) => n.length) === 4,
     '…and the same four tag chips');
  ok(await page.$$eval('.pagerow .bmkedit .lvlbox button', (n) => n.length) === 3,
     '…and the same three levels');
  ok(await page.$$eval('.pageview', (n) => n.length) === 0, 'and keeping it still does not launch the artifact');


  before = posts.length;
  await page.click('.pagerow .bmkedit .catchip[data-tag="bugfix"]');
  await page.waitForTimeout(400);
  last = posts[posts.length - 1];
  ok(last.route === 'page-bookmark' && last.id === 'p1' && JSON.stringify(last.body.tags) === '["bugfix"]',
     'an artifact’s tags POST to the page’s own route');
  ok(!('bookmarked' in last.body), '…with no keep-flag');
  ok(await page.$$eval('.pageview', (n) => n.length) === 0, 'tapping a tag does not open the artifact either');

  await b.close();
  server.close();
  if (!fails) console.log('\nPASS: the bookmark tag set, and the two doors above the chats');
})();
