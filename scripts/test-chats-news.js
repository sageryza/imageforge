#!/usr/bin/env node
// The UPDATE tab — the one that LEADS the tab row on the Chats home (Aug
// 2026, Sophie: "right now
// there's account one and account two, two tabs on my chat app screen. I wanna
// make one more tab, and this is like a daily notifications thing … I can get
// rid of them if I've already checked them. For the [oven] chat, they keep
// delivering different versions of this artifact, so it would show the actual
// artifact … or if there's a chat that's making pictures, it would show the
// last three pictures in a little row").
//
// Drives the REAL public/chats.html in a headless browser against a stub API
// and asserts:
//   1. there are THREE tabs with UPDATE LEADING (her ask, after using it:
//      "I would put it on the left side of the accounts and call it
//      update"), all three tappable at 375/390/430 (the row is full-width
//      down there, but a third label must not push one under the autoscroll
//      pill or off the edge), and the lit line lands on the FIRST slot,
//   2. what makes a card: an unread reply, a new Compare page, or new
//      pictures — AND a chat she has merely READ, because since Aug 2026 the
//      ✓ is the only thing that settles a card ("make the default behavior
//      that it's pinned until I mark the checkmark and get rid of the pin").
//      What does NOT: one she has checked off (notifSeenAt), or an archived
//      one,
//   3. a card carries the THING — the page's title, and up to three thumbs,
//   4. the ✓ box + DONE clears the card and POSTs /notif-seen (badge follows;
//      the ✓ picks the card since Aug 2026 and DONE does the clearing) — and
//      opening a chat does NOT post it, or reading a thread would clear a
//      card behind her back,
//   5. the page title opens the full-screen Compare viewer; a thumb opens the
//      chat; an account tab comes back to the chat list. (The card's ICON is
//      what opens the chat since Aug 2026 — the card itself is the pick target
//      for the two boxes; see test-chats-news-queue.js.)
//
//   npm install playwright-core --no-save && node scripts/test-chats-news.js
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
const PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

const H = 3600000;
// chat-oven   — an unread reply AND a fresh Compare page (her own example)
// chat-pics   — she has READ the last reply, but three pictures landed after
// chat-quiet  — READ, and nothing delivered since. It STILL gets a card: that
//               is the Aug 2026 change, and this is the fixture that proves
//               reading a thread no longer clears it. (Before, it was the
//               "no card" case.)
// chat-checked— unread reply, but already checked off (notifSeenAt newer)
// chat-arch   — unread, archived → never a notification
const MSGS = [
  { id: 'm1', chat: 'chat-oven', from: 'claude', text: 'v4 of the artifact is up', tldr: 'artifact v4', created: iso(T0 - 2 * H), postedAt: iso(T0 - 2 * H) },
  { id: 'm2', chat: 'chat-pics', from: 'claude', text: 'drawing the set now', tldr: 'drawing', created: iso(T0 - 6 * H), postedAt: iso(T0 - 6 * H) },
  { id: 'm3', chat: 'chat-quiet', from: 'claude', text: 'all done', tldr: 'done', created: iso(T0 - 8 * H), postedAt: iso(T0 - 8 * H) },
  { id: 'm4', chat: 'chat-checked', from: 'claude', text: 'here you go', tldr: 'delivered', created: iso(T0 - 3 * H), postedAt: iso(T0 - 3 * H) },
  { id: 'm5', chat: 'chat-arch', from: 'claude', text: 'old work', tldr: 'old', created: iso(T0 - 4 * H), postedAt: iso(T0 - 4 * H) },
];
// what she has already opened (localStorage, injected before the page runs)
const SEEN = {
  'chat-pics': MSGS[1].created,
  'chat-quiet': MSGS[2].created,
};
const notifPosts = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const reg = {
      // she checked this card off 5 hours ago — the ✓ IS the superseded mark,
      // so anything from before it is old news whatever its title says.
      // It also carries a written UPDATE card (the ⌄ pop-out).
      'chat-oven': { account: '1', notifSeenAt: iso(T0 - 300 * 60000),
        updAsked: 'a tab for daily notifications', updDid: 'shipped the tab and the cards',
        updNext: 'tell me if the name is wrong' },
      'chat-pics': { account: '1' },
      'chat-quiet': { account: '2' },
      // checked off AFTER its last message arrived — the card is settled
      'chat-checked': { account: '1', notifSeenAt: iso(T0 - 1 * H) },
      'chat-arch': { account: '1', archived: true },
      // delivers pages and never says a word — it still gets a card
      'chat-deck': { account: '2' },
    };
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1', chats: reg, settings: {}, truncated: [],
      messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/api/gallery/assets/recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    // four for chat-pics — only the newest THREE go on the card
    return res.end(JSON.stringify({ assets: [
      { url: '/px.png?a=1', thumb: '/px.png?a=1', chat: 'chat-pics', created: iso(T0 - 20 * 60000), description: 'Penny — the blue Kleenex' },
      { url: '/px.png?a=2', thumb: '/px.png?a=2', chat: 'chat-pics', created: iso(T0 - 25 * 60000) },
      { url: '/px.png?a=3', thumb: '/px.png?a=3', chat: 'chat-pics', created: iso(T0 - 30 * 60000) },
      { url: '/px.png?a=4', thumb: '/px.png?a=4', chat: 'chat-pics', created: iso(T0 - 35 * 60000) },
      // older than she read that chat → must not raise a card on its own
      { url: '/px.png?a=5', thumb: '/px.png?a=5', chat: 'chat-quiet', created: iso(T0 - 9 * H) },
    ] }));
  }
  if (url.pathname === '/api/chatfeed/pages-recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    // Three cases in one chat, all from the real cards she photographed:
    //   p1/p3 — v4 above v3, a version pair inside one unchecked stretch:
    //           only v4 shows.
    //   p2    — the page that beat the title rule (NO version number in its
    //           title), but OLDER than her ✓ on this chat: gone as old news,
    //           without anyone parsing its title.
    // chat-deck delivers TWO genuinely different pages and says nothing at
    // all — only the NEWER shows (Sophie, Aug 2026: "I only want the newest
    // compare page or whatever they posted on that turn"), and a chat CAN
    // earn a card with pages alone, having never posted a reply.
    return res.end(JSON.stringify({ pages: [
      { id: 'p1', title: 'Oven artifact v4 (s96) — tightest cut', chat: 'chat-oven', created: iso(T0 - 90 * 60000) },
      { id: 'p3', title: 'Oven artifact v3 (s96) — link mode in the strip', chat: 'chat-oven', created: iso(T0 - 100 * 60000) },
      { id: 'p2', title: 'Oven artifact (s96) — moved from the Evan chat', chat: 'chat-oven', created: iso(T0 - 400 * 60000) },
      { id: 'p4', title: 'Monsters — full-size cards, quality ladder v1', chat: 'chat-deck', created: iso(T0 - 30 * 60000) },
      { id: 'p5', title: 'Monsters — info backs, 3 samples v1', chat: 'chat-deck', created: iso(T0 - 40 * 60000) },
    ] }));
  }
  if (url.pathname === '/api/chatfeed/notif-seen' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      notifPosts.push(JSON.parse(body || '{}'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, notifSeenAt: iso(Date.now()) }));
    });
    return;
  }
  if (url.pathname.startsWith('/api/chatfeed/page/')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<!doctype html><title>page</title><p>the artifact</p>');
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
  await page.addInitScript((seen) => {
    localStorage.setItem('chats-seen-v1', JSON.stringify(seen));
  }, SEEN);

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="chat-oven"]');

  // 1. three tabs, UPDATE leading
  const labels = await page.$$eval('#accrow .acctab', ns => ns.map(n => n.textContent.trim()));
  if (labels.length !== 3) fail('expected 3 tabs, got ' + labels.length + ': ' + labels.join(' | '));
  if (!/^Update/.test(labels[0] || '')) fail('Update does not lead the tab row: ' + labels.join(' | '));
  if (!/^Account 1/.test(labels[1] || '') || !/^Account 2/.test(labels[2] || '')) {
    fail('the accounts are not the 2nd and 3rd tabs: ' + labels.join(' | '));
  }

  // every tab has to be reachable at the widths she actually uses — the row
  // sits below the pill's band, but a third label must not push one off
  for (const w of [375, 390, 430]) {
    await page.setViewportSize({ width: w, height: 780 });
    const hits = await page.evaluate(() => Array.prototype.map.call(
      document.querySelectorAll('#accrow .acctab'), (b) => {
        const r = b.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!(el && el.closest && el.closest('.acctab') === b);
      }));
    hits.forEach((ok, i) => { if (!ok) fail('tab ' + (i + 1) + ' is not tappable at ' + w + 'px'); });
  }
  await page.setViewportSize({ width: 390, height: 780 });

  // The badge counts the CARDS — oven + pics + deck + quiet, not the checked
  // or archived ones. `quiet` is in the count because she only READ it, and
  // reading is not checking off. It has to be right on the CHAT LIST, without
  // opening the tab: pictures arrive with no message, so the count is only
  // honest once the delivered cache has loaded, which the tab row kicks off
  // once per load.
  await page.waitForFunction(
    () => { const b = document.querySelector('#accrow .acctab[data-acct="new"] .cc-new'); return b && b.textContent === '4'; },
    null, { timeout: 5000 }).catch(async () => {
      const b = await page.$eval('#accrow .acctab[data-acct="new"]', n => n.textContent).catch(() => '');
      fail('Update badge should be 4 (oven + pics + deck + quiet) on the chat list, got "' + b + '"');
    });

  // 2/3. open it: the title says New, the line slides to the third slot
  await page.click('#accrow .acctab[data-acct="new"]');
  await page.waitForFunction(() => document.getElementById('htitle').textContent === 'Update')
    .catch(() => fail('tapping the first tab never opened the Update view'));
  const on = await page.$eval('#accrow', n => n.getAttribute('data-on'));
  if (on !== 'new') fail('the lit line did not move to the Update tab (data-on=' + on + ')');
  // …and the line itself settles on the FIRST slot (it SLIDES, so this waits
  // out the .2s transition rather than reading a frame mid-flight)
  await page.waitForFunction(() => {
    const t = getComputedStyle(document.querySelector('#accrow'), '::after').transform;
    return t === 'none' || Math.abs(parseFloat(t.split(',')[4] || '0')) < 1;
  }, null, { timeout: 3000 }).catch(async () => {
    const x = await page.evaluate(() => getComputedStyle(document.querySelector('#accrow'), '::after').transform);
    fail('the lit line never settled on the FIRST slot: ' + x);
  });
  await page.waitForSelector('.nwcard .nwimg img', { timeout: 4000 })
    .catch(() => fail('the pictures row never rendered'));

  // newest ARRIVAL first — chat-pics' newest picture is 20 minutes old, which
  // is newer than the oven chat's page (90m) and its reply (2h), even though
  // its own last message is the older of the two
  // …and chat-quiet brings up the rear: read 8 hours ago, never checked off,
  // so it keeps its card at the bottom of the list.
  const cards = await page.$$eval('.nwcard', ns => ns.map(n => n.dataset.chat));
  if (JSON.stringify(cards) !== JSON.stringify(['chat-pics', 'chat-deck', 'chat-oven', 'chat-quiet'])) {
    fail('wrong cards (newest arrival first expected): ' + cards.join(','));
  }
  const pgTitles = await page.$$eval('.nwcard[data-chat="chat-oven"] .pr-title', ns => ns.map(n => n.textContent));
  if (!pgTitles.some(t => t.indexOf('Oven artifact v4') >= 0)) fail('the newest Compare page is not on the oven card');
  // 1. an older page in the same unchecked stretch never shows — the newest
  //    is the card's whole deliverable (Sophie: "if there's one version and
  //    then a new one comes out it should just replace that one", then "I only
  //    want the newest compare page")
  if (pgTitles.some(t => t.indexOf('v3') >= 0)) fail('the superseded v3 is still on the card: ' + pgTitles.join(' | '));
  // 2. …and a page older than her ✓ is gone as OLD NEWS, with nobody parsing
  //    its title — this is the one that beat the title rule twice ("I think it
  //    tricked it cause there was no version number")
  if (pgTitles.some(t => t.indexOf('moved from the Evan chat') >= 0)) {
    fail('a page older than her check-off survived: ' + pgTitles.join(' | '));
  }
  if (pgTitles.length !== 1) fail('the oven card should carry exactly its current artifact: ' + pgTitles.join(' | '));
  // 3. TWO genuinely different pages from one chat show as the NEWEST alone
  //    (Sophie, Aug 2026: "I only want the newest compare page or whatever
  //    they posted on that turn" — reversing the v3 rule that showed both),
  //    and that chat never posted a message: the pages alone earn it a card
  const deck = await page.$$eval('.nwcard[data-chat="chat-deck"] .pr-title', ns => ns.map(n => n.textContent));
  if (deck.length !== 1) fail('a card should carry ONE page, its newest: ' + deck.join(' | '));
  if (deck[0].indexOf('full-size cards') < 0) fail('the page shown is not the newest one: ' + deck.join(' | '));

  // THE ⌄ POP-OUT (Sophie, Aug 2026: "a TLDR in their update — not fully in
  // the message, because it would crowd things, but more as like a button I
  // could click and it would pop out"), in her shape: label bold, answer not.
  if (await page.$eval('.nwcard[data-chat="chat-oven"] .nwsum',
    n => getComputedStyle(n).display !== 'none')) fail('the update pop-out is open before she taps');
  await page.click('.nwcard[data-chat="chat-oven"] .nwmore');
  await page.waitForFunction(() => {
    const n = document.querySelector('.nwcard[data-chat="chat-oven"] .nwsum');
    return n && getComputedStyle(n).display !== 'none';
  }, null, { timeout: 4000 }).catch(() => fail('tapping the ⌄ did not open the update'));
  const rows = await page.$$eval('.nwcard[data-chat="chat-oven"] .nwrow', ns => ns.map(n => ({
    label: n.querySelector('b').textContent,
    answer: n.querySelector('span').textContent,
    labelBold: getComputedStyle(n.querySelector('b')).fontWeight,
    answerBold: getComputedStyle(n.querySelector('span')).fontWeight,
  })));
  const updLabels = rows.map(r => r.label);
  if (JSON.stringify(updLabels) !== JSON.stringify(['What you asked', 'What I did', "What's next"])) {
    fail('the update is not in her three-part shape: ' + updLabels.join(' | '));
  }
  if (rows[0].answer !== 'a tab for daily notifications') fail('the answer is not the chat\'s own text');
  if (!(Number(rows[0].labelBold) >= 600)) fail('the label is not bold: ' + rows[0].labelBold);
  if (Number(rows[0].answerBold) >= 600) fail('the answer is bold and should not be: ' + rows[0].answerBold);
  // a chat with NO written card falls back to its reply's TLDR under "What I did"
  const fb = await page.$$eval('.nwcard[data-chat="chat-pics"] .nwrow b', ns => ns.map(n => n.textContent));
  if (JSON.stringify(fb) !== JSON.stringify(['What I did'])) {
    fail('the no-card fallback is not just "What I did": ' + fb.join(' | '));
  }
  await page.click('.nwcard[data-chat="chat-oven"] .nwmore');
  await page.waitForFunction(() => {
    const n = document.querySelector('.nwcard[data-chat="chat-oven"] .nwsum');
    return n && getComputedStyle(n).display === 'none';
  }, null, { timeout: 4000 }).catch(() => fail('tapping the ⌄ again did not close the update'));

  // (The version-collapsing family parser lived here — deleted with v4 of the
  // page rule: one page shows, so nothing reads a title any more.)
  const thumbs = await page.$$('.nwcard[data-chat="chat-pics"] .nwimg');
  if (thumbs.length !== 3) fail('expected the last THREE pictures, got ' + thumbs.length);

  // 4. clearing a card is the ✓ box then DONE, and the badge follows (Aug
  //    2026 — the ✓ picks the card now, and the pinned row's DONE is what
  //    writes notifSeenAt; see test-chats-news-queue.js)
  await page.click('.nwcard[data-chat="chat-pics"] .nwck');
  await page.click('#catrow .nwdone');
  await page.waitForFunction(() => !document.querySelector('.nwcard[data-chat="chat-pics"]'), null, { timeout: 4000 })
    .catch(() => fail('✓ then DONE did not take the card off the list'));
  await page.waitForFunction(
    () => { const b = document.querySelector('#accrow .acctab[data-acct="new"] .cc-new'); return b && b.textContent === '3'; },
    null, { timeout: 4000 }).catch(() => fail('the Update badge did not follow DONE'));
  if (!notifPosts.some(p => p.chat === 'chat-pics' && p.seen !== false)) fail('POST /notif-seen never fired');

  // 5a. the artifact's title opens the full-screen viewer
  await page.click('.nwcard[data-chat="chat-oven"] .pagerow');
  await page.waitForSelector('.pageview .pv-frame', { timeout: 4000 })
    .catch(() => fail('the page title did not open the Compare viewer'));
  await page.click('.pageview .pv-back');
  await page.waitForFunction(() => !document.querySelector('.pageview'), null, { timeout: 4000 })
    .catch(() => fail('could not get back out of the Compare viewer'));

  // 5b. an account tab comes back to the chat list
  await page.click('#accrow .acctab[data-acct="1"]');
  await page.waitForFunction(() => document.getElementById('htitle').textContent === 'Chats')
    .catch(() => fail('an account tab did not leave the Update view'));

  // 5b2. OPENING a chat writes NOTHING — and the card is still there when she
  //      comes back. This used to POST notif-seen so the home-screen widget's
  //      count matched the tab's; now that the ✓ is the only thing that
  //      settles a card, that write would clear one she never checked. The
  //      widget counts off the same stamp, so the two agree without it.
  const before = notifPosts.length;
  await page.click('#accrow .acctab[data-acct="new"]');
  await page.waitForSelector('.nwcard', { timeout: 4000 });
  // …opened by the card's ICON since Aug 2026 — a tap on the card itself now
  // PICKS it for the Later / In a minute boxes (test-chats-news-queue.js).
  await page.click('.nwcard[data-chat="chat-oven"] .cr-ic');
  await page.waitForFunction(() => document.getElementById('thread').style.display !== 'none',
    null, { timeout: 4000 }).catch(() => fail('the card icon never opened the chat'));
  await page.waitForFunction((n) => true, null, { timeout: 200 }).catch(() => {});
  const posted = notifPosts.slice(before).filter((p) => p.chat === 'chat-oven' && p.seen !== false);
  if (posted.length) fail('opening a chat posted notif-seen — it would clear a card she never checked');
  await page.click('#back');
  await page.waitForFunction(() => document.getElementById('thread').style.display === 'none',
    null, { timeout: 4000 }).catch(() => {});
  if ((await page.textContent('#htxt')) !== 'Update') {
    await page.click('#accrow .acctab[data-acct="new"]');
  }
  await page.waitForSelector('.nwcard', { timeout: 4000 });
  const stillThere = await page.$$eval('.nwcard', ns => ns.map(n => n.dataset.chat));
  if (stillThere.indexOf('chat-oven') < 0) {
    fail('the card cleared itself when she opened the chat: ' + stillThere.join(','));
  }

  // 5c. a thumb opens its chat (its Assets tab).
  //     The tab TOGGLES, so only tap it if we are not already on Update —
  //     coming back from a chat lands there already.
  if ((await page.textContent('#htxt')) !== 'Update') {
    await page.click('#accrow .acctab[data-acct="new"]');
  }
  await page.waitForSelector('.nwcard', { timeout: 4000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const thumb = await page.$('.nwcard .nwimg');
  if (thumb) {
    await thumb.click();
    await page.waitForFunction(() => document.getElementById('thread').style.display !== 'none',
      null, { timeout: 4000 }).catch(() => fail('tapping a thumb never opened the chat'));
  }

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures' : 'OK: Update leads the row, shows the artifact and the pictures, and clears on ✓');
})().catch((e) => { console.error(e); process.exit(1); });
