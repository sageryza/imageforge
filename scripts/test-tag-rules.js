#!/usr/bin/env node
// MANUAL RULES PER TAG (Aug 2026, Sophie: "i think i'll have to do manual rules
// per tag … more coming").
//
// Two words stopped being decoration and started saying what should HAPPEN to a
// chat wearing them:
//
//   waiting for a response → "means i need a response and want it, so these get
//     pinned at the top of the updates tab until i respond to the chat, or
//     dismiss manually"
//   to be reviewed → "movies that are done, images waiting on my decision, go
//     into a `review` button (which links to the review queue) at the top of
//     the updates tab, and get hidden from the account 1 or 2 area until i
//     review or respond IF i dismiss manually from update tab"
//
// Drives the REAL public/chats.html headless against a stub API and asserts:
//   1. THE TAG IS THE ARRIVAL — a chat carrying `waiting for a response` is on
//      the Update tab even though nothing has landed since her ✓. This is the
//      one card the arrival test cannot see, and the chats she owes an answer
//      are exactly the ones that went quiet, so getting it wrong means the pin
//      only ever shows where it isn't needed.
//   2. …AT THE TOP: its section is above all three of the kind sections.
//   3. …UNTIL SHE ANSWERS OR DISMISSES: a chat whose `notifSeenAt` is newer
//      than the tag has no card. Both exits write that one stamp, so this is
//      both halves of her sentence.
//   4. A `to be reviewed` chat with fresh news gets NO card in the sections —
//      it is behind the Review row, counted, and the word leaves for /review.
//   5. …and the ⌄ opens its cards, because "IF i dismiss manually from update
//      tab" needs them to be reachable from this tab at all.
//   6. Dismissing one there writes BOTH stamps (notif-seen carries the hold).
//   7. THE HOLD KEEPS IT OFF HER ACCOUNT LISTS even though it delivered again —
//      with the control beside it: the same chat with no hold pops back on.
//   8. The rule words are spelled the same in chats.html, chatfeed.js and
//      chat-sort.js — and the sorter is forbidden from filing into either.
//
//   npm install playwright-core --no-save && node scripts/test-tag-rules.js
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
const H = 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();

const PIN = 'waiting for a response';
const REVIEW = 'to be reviewed';

let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; process.exitCode = 1; };
const ok = (m) => console.log('  ok   ' + m);

// ---- 8. the three copies of the two words, checked with no browser --------
{
  const feed = require(path.join(ROOT, 'chatfeed.js'));
  const sort = require(path.join(ROOT, 'chat-sort.js'));
  const page = fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8');
  if (feed.PIN_LABEL !== PIN) fail('chatfeed PIN_LABEL is "' + feed.PIN_LABEL + '"');
  if (feed.REVIEW_LABEL !== REVIEW) fail('chatfeed REVIEW_LABEL is "' + feed.REVIEW_LABEL + '"');
  const table = /var TAG_RULES\s*=\s*\[([\s\S]*?)\];/.exec(page);
  if (!table) fail('no TAG_RULES table in chats.html');
  else {
    if (table[1].indexOf("'" + PIN + "'") < 0) fail('TAG_RULES does not carry ' + PIN);
    if (table[1].indexOf('REVIEW_LABEL') < 0) fail('TAG_RULES does not carry the review word');
  }
  // The sorter must never file into either: both say something only she knows,
  // and a guess would pin a card she never asked for or hide a chat she was
  // watching.
  [PIN, REVIEW].forEach((w) => {
    if (sort.TRIAGE.indexOf(w) < 0) fail('the auto-sorter may still file into "' + w + '"');
    if (sort.sortableCategories({ categories: [w, 'witch'] }, {}).indexOf(w) > -1) {
      fail('"' + w + '" is still offered to the sorter as a folder');
    }
  });
  if (!failed) ok('the two rule words match across the page, the server and the sorter');
}

// ── the fixtures ───────────────────────────────────────────────────────────
// `pinme` and `pindone` last SPOKE ten hours ago and have been checked off
// since — the ordinary arrival test says neither has news. The only thing that
// differs is whether her ✓ lands before or after the tag went on.
const MSGS = [
  { chat: 'pinme',   at: T0 - 10 * H },
  { chat: 'pindone', at: T0 - 10 * H },
  { chat: 'revme',   at: T0 - 1 * H },
  { chat: 'plain',   at: T0 - 1 * H },
  { chat: 'held',    at: T0 - 1 * H },
].map((m, i) => ({
  id: 'm' + i, chat: m.chat, from: 'claude', text: m.chat + ' said something',
  tldr: m.chat + ' tldr', created: iso(m.at), postedAt: iso(m.at),
}));

const BASE = {
  pinme:   { labels: [PIN], filedAt: iso(T0 - 2 * H), notifSeenAt: iso(T0 - 3 * H) },
  pindone: { labels: [PIN], filedAt: iso(T0 - 3 * H), notifSeenAt: iso(T0 - 2 * H) },
  revme:   { labels: [REVIEW], filedAt: iso(T0 - 5 * H) },
  plain:   {},
  // Filed under the review word and delivering since — `chatBack` would put it
  // back on her list. The hold is the only thing between it and her account
  // tab, so `held` and `free` are the same chat twice.
  held:    { labels: [REVIEW], filedAt: iso(T0 - 5 * H), reviewHoldAt: iso(T0 - 30 * 60 * 1000) },
};
const FREE = JSON.parse(JSON.stringify(BASE));
delete FREE.held.reviewHoldAt;

const SETS = { held: BASE, free: FREE };
let set = 'held';
const posted = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-' + set, chats: SETS[set], settings: {}, truncated: [],
      messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; });
    return req.on('end', () => {
      let j = {}; try { j = JSON.parse(body || '{}'); } catch {}
      posted.push({ path: url.pathname, body: j });
      const stamp = iso(T0);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      // The live route answers with the hold when the chat wears the word, and
      // WRITES it — so the stub does both. Answering without recording it would
      // make the assertion a race against the next registry poll, which is
      // exactly the bug the mirror exists to avoid.
      if (url.pathname === '/api/chatfeed/notif-seen') {
        const reg = SETS[set][j.chat] || {};
        const held = (reg.labels || []).indexOf(REVIEW) > -1 && j.seen !== false;
        reg.notifSeenAt = stamp;
        if (held) reg.reviewHoldAt = stamp; else delete reg.reviewHoldAt;
        return res.end(JSON.stringify({ ok: true, notifSeenAt: stamp, reviewHoldAt: held ? stamp : null }));
      }
      res.end(JSON.stringify({ ok: true }));
    });
  }
  if (url.pathname === '/review') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<!doctype html><title>Review Queue</title><body id="reviewq">queue</body>');
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

const cards = (page) => page.$$eval('#grid .nwcard', (ns) => ns.map((n) => n.dataset.chat));
const listed = (page) => page.$$eval('#grid .crow[data-chat]', (ns) => ns.map((n) => n.dataset.chat).sort());
// Every section header on the Update tab, in DOM order, with its own cards —
// which is how "at the top" is measured rather than eyeballed.
const sections = (page) => page.evaluate(() => {
  const out = []; let cur = null;
  document.querySelectorAll('#grid > *').forEach((n) => {
    if (n.classList.contains('sthead')) { cur = { head: n.textContent.replace(/\s+/g, ' ').trim(), chats: [] }; out.push(cur); }
    else if (n.classList.contains('nwcard') && cur) cur.chats.push(n.dataset.chat);
  });
  return out;
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
  await page.waitForSelector('#grid .nwcard, #nwdoors .nwrevpair');

  // ---- 1 + 3. the pin is the tag, and her ✓ is the way out --------------
  let on = await cards(page);
  if (on.indexOf('pinme') < 0) fail('a chat tagged "' + PIN + '" has no card, though nothing new has landed: ' + on.join(','));
  else ok('the tag is the arrival — pinned with nothing new since the ✓');
  if (on.indexOf('pindone') > -1) fail('a chat checked off SINCE the tag went on is still pinned');
  else ok('…and it is gone once she has answered or dismissed');

  // ---- 2. above everything ---------------------------------------------
  let secs = await sections(page);
  const pinAt = secs.findIndex((s) => s.chats.indexOf('pinme') > -1);
  const plainAt = secs.findIndex((s) => s.chats.indexOf('plain') > -1);
  if (pinAt < 0 || plainAt < 0) fail('lost a section: ' + JSON.stringify(secs));
  else if (!(pinAt < plainAt)) fail('the pin is not above the ordinary sections: ' + secs.map((s) => s.head).join(' / '));
  else ok('…and it sits above the three sections');
  if (pinAt > -1 && !/waiting for a response/i.test(secs[pinAt].head)) {
    fail('the pinned section is not named after the tag: "' + secs[pinAt].head + '"');
  }

  // ---- 4. the review word folds behind one row -------------------------
  if (on.indexOf('revme') > -1) fail('a "' + REVIEW + '" chat still has a card on the list');
  else ok('a chat to be reviewed is not a card on the list');
  // THE DOOR IS CHROME, NOT A SECTION (Aug 2026 v2, Sophie: "both supposed to
  // be smaller and they're supposed to go above the chats") — a chip in
  // #nwdoors, above the account tabs, so it is looked for there and not in the
  // list's own section order.
  // TWO, not one: `held` wears the word as well (it is the fixture assertion 7
  // uses) and it has news, so it belongs behind this door too. The count is the
  // chats behind it, which is the number she reads before tapping.
  const revDoor = await page.$eval('#nwdoors .nwrevpair .nwdoor', (n) => n.textContent.replace(/\s+/g, ' ').trim())
    .catch(() => '');
  const above = await page.evaluate(() => {
    const d = document.querySelector('#nwdoors'), t = document.querySelector('#accrow');
    return !!(d && t) && d.getBoundingClientRect().bottom <= t.getBoundingClientRect().top;
  });
  if (!revDoor) fail('there is no Review door in #nwdoors');
  else if (!/^review\s*2$/i.test(revDoor)) fail('the Review door is mis-counted (want 2): "' + revDoor + '"');
  else if (!above) fail('the doors row is not above the account tabs');
  else ok('the Review door sits above the chats, carrying how many are behind it');
  if (on.indexOf('held') > -1) fail('the second "' + REVIEW + '" chat still has a card on the list');

  // …and the word goes to the queue.
  await Promise.all([page.waitForNavigation(), page.click('#nwdoors .nwrevpair .nwdoor')]);
  if (!(await page.$('#reviewq'))) fail('the Review button did not open /review');
  else ok('…and it opens the review queue');
  await page.goto(base + '/chats?view=news');
  await page.waitForSelector('#nwdoors .nwrevpair');

  // The control for the tap-speed check at the end of assertion 6: `revme` is
  // filed under the review word AND has delivered since, so it is on her
  // account list right now. If it were not, "it left the list" would prove
  // nothing.
  await page.click('.acctab[data-acct="1"]');
  await page.waitForSelector('#grid .crow[data-chat="plain"]');
  if ((await listed(page)).indexOf('revme') < 0) fail('the control failed — revme was never on her account list to leave it');
  await page.click('.acctab[data-acct="new"]');
  await page.waitForSelector('#nwdoors .nwrevpair');

  // ---- 5. the ⌄ opens them, or there is nothing to dismiss -------------
  await page.click('.nwrevfold');
  await page.waitForSelector('#grid .nwcard[data-chat="revme"]');
  ok('the ⌄ opens the cards, so they can still be dismissed from this tab');

  // ---- 6. dismissing one writes the hold -------------------------------
  await page.click('.nwcard[data-chat="revme"] .nwck');
  await page.click('#catrow .nwdone');
  await page.waitForFunction(() => !document.querySelector('.nwcard[data-chat="revme"]'));
  const seen = posted.filter((p) => p.path === '/api/chatfeed/notif-seen' && p.body.chat === 'revme');
  if (!seen.length) fail('dismissing a review card posted no notif-seen');
  else ok('dismissing one from the fold checks it off');
  // …and it takes effect on the SAME TAP, without waiting for a poll. Measured
  // by walking to her account list in the same session: `revme` was on it a
  // moment ago (filed, but delivering since — `chatBack`), and the dismiss is
  // the only thing that happened in between.
  await page.click('.acctab[data-acct="1"]');
  await page.waitForSelector('#grid .crow[data-chat="plain"]');
  const after = await listed(page);
  if (after.indexOf('revme') > -1) {
    fail('the chat she just dismissed is still on her account list — the hold waited for a poll: ' + after.join(','));
  } else ok('…and it leaves her account list on that same tap, not on the next poll');

  // ---- 7. the hold keeps it off her account list -----------------------
  const live = async (which) => {
    set = which;
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto(base + '/chats');
    await page.waitForSelector('#grid .crow[data-chat="plain"]');
    return listed(page);
  };
  const withHold = await live('held');
  if (withHold.indexOf('held') > -1) fail('a dismissed review chat walked back onto her account list: ' + withHold.join(','));
  else ok('a dismissed review chat stays off her account list when it delivers again');
  const noHold = await live('free');
  if (noHold.indexOf('held') < 0) {
    fail('the control failed — the same chat with no hold is missing too, so the test proves nothing: ' + noHold.join(','));
  } else ok('…and the same chat with no hold pops back out, as a filed chat always has');

  await browser.close();
  server.close();
  if (!failed) console.log('PASS: the two manual tag rules — pinned to the top, and folded behind Review');
})().catch((e) => { console.error('FAIL: ' + e.message); process.exit(1); });
