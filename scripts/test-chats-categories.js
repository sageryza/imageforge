#!/usr/bin/env node
// Category chips + select mode (Aug 2026, Sophie: "get rid of the list/tiles
// pill since I never use the tile view anymore… in its place I want to put
// category tags, the first two I can think of are stories and tech, and then
// I'll need like a select mode where I can move things into categories").
// Drives the REAL public/chats.html headless against a stub API and asserts:
//   1. the LIST/TILES toggle is gone and the home is the list,
//   2. the seeded chips (Stories, Tech) are there before anything is filed,
//   3. select mode picks chats and one chip files the lot (POST /labels),
//   4. FILING MOVES a chat: it leaves the unfiltered list, the chip counts it,
//      and a lit chip is that folder (tapping it again clears back),
//   5. a category typed into the bar's New… box becomes a chip of its own,
//   6. the filter narrows the HIDDEN pile too, not just the visible list,
//   7. the chip badges HOW MANY chats in there have answered her, counted per
//      chat, and the badge goes once she has seen them,
//   8. a category she MAKES survives with nothing filed under it — typed with
//      no chats picked, and committed by tapping away rather than pressing
//      return (that pair is how one she made went missing), and a name the
//      server remembers on __settings shows as a chip on the next load.
//
//   npm install playwright-core --no-save && node scripts/test-chats-categories.js
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
  { id: 'm1', chat: 'chat-a', from: 'claude', text: 'a', tldr: 'a', created: iso(T0 - 3600000), postedAt: iso(T0 - 3600000) },
  { id: 'm2', chat: 'chat-b', from: 'claude', text: 'b', tldr: 'b', created: iso(T0 - 7200000), postedAt: iso(T0 - 7200000) },
  { id: 'm3', chat: 'chat-c', from: 'claude', text: 'c', tldr: 'c', created: iso(T0 - 10800000), postedAt: iso(T0 - 10800000) },
  { id: 'm4', chat: 'chat-hid', from: 'claude', text: 'h', tldr: 'h', created: iso(T0 - 14400000), postedAt: iso(T0 - 14400000) },
];
const catPosts = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1',
      chats: {
        'chat-a': { lastSeen: MSGS[0].created },
        'chat-b': { lastSeen: MSGS[1].created },
        'chat-c': { lastSeen: MSGS[2].created },
        // hidden AND already filed under stories — the filter has to reach the
        // pile as well as the list
        'chat-hid': { lastSeen: MSGS[3].created, hiddenAt: iso(T0), category: 'stories' },
      },
      // a name she made earlier, with nothing filed under it — the chip has to
      // outlive the filing that created it
      settings: { categories: ['crystals'] }, truncated: [],
      messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  // The one write since folders and tags became one field (Aug 2026): a chip
  // sends `{chats, add:['tech']}`, None sends `{chats, labels:[]}`, and a word
  // typed with nothing picked sends `{labels:['errands']}` and no chats at all.
  if (url.pathname === '/api/chatfeed/labels' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      catPosts.push(JSON.parse(body || '{}'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({}));
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
// the MAIN list only — the hidden pile renders its own .clist inside .hidelist
const listed = (page) => page.$$eval('#grid > .clist .crow[data-chat]', (ns) => ns.map((n) => n.dataset.chat));
// the label only: the row LEADS with the ★ chip (no text), and a chip's label
// runs straight into its red unread badge with no space between them
const chips = (page) => page.$$eval('#catrow .catchip:not(.starchip):not(.tagsbtn):not(.morechip)',
  (ns) => ns.map((n) => n.firstChild.textContent.trim()));
// The folders live behind the TAGS button now (Aug 2026) and the row starts
// SHUT on every load, so anything asserting on a chip opens it first. It is a
// no-op once open — `catsOpen` survives every re-render inside one page load.
const openTags = async (page) => {
  await page.waitForSelector('#catrow .tagsbtn');
  if (!(await page.$('#catrow .tagsbtn.on'))) await page.click('#catrow .tagsbtn');
  // Category words live behind SEE MORE now (Aug 2026) — unfold them too.
  if (await page.$('#catrow .morechip')) await page.click('#catrow .morechip');
  await page.waitForSelector('#catrow .catchip:not(.starchip):not(.tagsbtn)');
};

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage();

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="chat-a"]');

  // 1. the toggle is gone, and the home rendered as the list
  if (await page.$('#v-list')) fail('the LIST/TILES toggle is still on the page');
  if (!(await page.$('#grid > .clist'))) fail('home did not render as the list');

  // 2. both seeded chips exist before anything is filed — behind TAGS
  await openTags(page);
  let cs = await chips(page);
  if (JSON.stringify(cs) !== JSON.stringify(['Stories', 'Tech', 'Crystals'])) fail('seeded chips wrong: ' + cs.join(','));
  // ONE number on a chip, and it is the red unread one — the dim total came
  // off at Sophie's ask ("just the one in red")
  if (await page.$('#catrow .cc-n')) fail('the dim total is still on the chips');
  const badge = await page.$$eval('#catrow .catchip:not(.starchip):not(.tagsbtn)', (ns) =>
    ns.filter((n) => n.firstChild.textContent.trim() === 'Stories')
      .map((n) => (n.querySelector('.cc-new') || {}).textContent || '')[0]);
  if (badge !== '1') fail('Stories chip did not badge its unread hidden chat: ' + badge);

  // 3. select mode picks two chats and one chip files them
  await page.click('#selbtn');
  await page.waitForSelector('#selbar', { timeout: 4000 }).catch(() => fail('select mode never opened its bar'));
  await page.click('#grid > .clist .crow[data-chat="chat-a"]');
  await page.click('#grid > .clist .crow[data-chat="chat-b"]');
  const pickedN = await page.$$eval('#grid > .clist .crow.picked', (ns) => ns.length);
  if (pickedN !== 2) fail('expected 2 picked rows, got ' + pickedN);
  // a tap in select mode must PICK, never open the chat
  if (await page.$eval('#thread', (n) => n.style.display !== 'none')) fail('a tap in select mode opened the chat');
  await page.$$eval('#selbar .catchip', (ns) => { ns.find((n) => n.firstChild && n.firstChild.textContent.trim() === 'Tech').click(); });
  await page.waitForFunction(() => !document.getElementById('selbar'), null, { timeout: 4000 })
    .catch(() => fail('filing did not leave select mode'));
  const post = catPosts.find((p) => (p.add || []).indexOf('tech') > -1);
  if (!post || post.chats.length !== 2) fail('POST /labels wrong: ' + JSON.stringify(catPosts));

  // 4. the two filed chats LEFT the unfiltered list, and the chip counts them
  let rows = await listed(page);
  if (JSON.stringify(rows) !== JSON.stringify(['chat-c'])) fail('filed chats did not leave the list: ' + rows.join(','));
  // the lit chip IS that folder, and tapping it again goes back to the unfiled
  await page.$$eval('#catrow .catchip', (ns) => { ns.find((n) => n.firstChild && n.firstChild.textContent.trim() === 'Tech').click(); });
  rows = await listed(page);
  if (JSON.stringify(rows.slice().sort()) !== JSON.stringify(['chat-a', 'chat-b'])) fail('Tech folder wrong: ' + rows.join(','));
  await page.$$eval('#catrow .catchip', (ns) => { ns.find((n) => n.firstChild && n.firstChild.textContent.trim() === 'Tech').click(); });
  rows = await listed(page);
  if (JSON.stringify(rows) !== JSON.stringify(['chat-c'])) fail('tapping the lit chip did not clear the filter: ' + rows.join(','));

  // 6. the filter reaches the hidden pile: under Stories the only live chat is
  //    hidden, so the list is empty and the bar carries it
  await page.$$eval('#catrow .catchip', (ns) => { ns.find((n) => n.firstChild && n.firstChild.textContent.trim() === 'Stories').click(); });
  if (await page.$('#grid > .clist')) fail('Stories should have no visible chats');
  const barTxt = await page.$eval('.hidebar .hb-n', (n) => n.textContent.replace(/\s+/g, ' ').trim());
  if (!/^Hidden 1\b/.test(barTxt)) fail('hidden pile not filtered to Stories: ' + barTxt);
  // and under Tech the pile is empty, so there is no bar at all
  await page.$$eval('#catrow .catchip', (ns) => { ns.find((n) => n.firstChild && n.firstChild.textContent.trim() === 'Tech').click(); });
  if (await page.$('.hidebar')) fail('a bar was drawn for a category with nothing hidden');
  await page.$$eval('#catrow .catchip', (ns) => { ns.find((n) => n.firstChild && n.firstChild.textContent.trim() === 'Tech').click(); });

  // 5. a typed category becomes a chip of its own
  await page.click('#selbtn');
  await page.waitForSelector('#selbar');
  await page.click('#grid > .clist .crow[data-chat="chat-c"]');
  await page.fill('#selbar input', 'crystals');
  await page.press('#selbar input', 'Enter');
  await page.waitForFunction(() => !document.getElementById('selbar'), null, { timeout: 4000 })
    .catch(() => fail('Enter in the New… box did not file the pick'));
  cs = await chips(page);
  if (cs.indexOf('Crystals') < 0) fail('typed category never became a chip: ' + cs.join(','));
  if (!catPosts.some((p) => (p.add || []).indexOf('crystals') > -1 && p.chats[0] === 'chat-c')) fail('POST /labels missed the typed one');

  // 8. a name typed with NOTHING picked, committed by tapping away — this pair
  //    is exactly how a category she made never appeared
  await page.click('#selbtn');
  await page.waitForSelector('#selbar');
  await page.fill('#selbar input', 'errands');
  // tap away, never Enter — she dictates these and dictation ends with a tap
  // elsewhere. It has to be somewhere inert: NOT #htitle (the masthead is
  // pointer-events:none so long titles can overlap the buttons) and no longer
  // #qsearch (the search bar is collapsed to its glass until tapped, and
  // tapping THAT would be a control, not a tap-away). The header's own top-
  // left padding is dead space, and a title tap on the chat list is a no-op
  // anyway.
  await page.click('header', { position: { x: 5, y: 5 } });
  await page.waitForFunction(
    () => [...document.querySelectorAll('#catrow .catchip')].some((n) => n.firstChild && n.firstChild.textContent.trim() === 'Errands'),
    null, { timeout: 4000 }).catch(() => fail('a category made with nothing picked did not appear'));
  const made = catPosts.find((p) => (p.labels || []).indexOf('errands') > -1);
  if (!made) fail('POST /labels never fired for the empty category');
  if (made && (made.chats || []).length) fail('the empty category filed chats it should not have: ' + JSON.stringify(made));

  // 7. the answered badge: chat-a and chat-b are filed under Tech and neither
  //    has been opened, so Tech carries a 2
  const techBadge = await page.$$eval('#catrow .catchip', (ns) =>
    ns.filter((n) => n.firstChild && n.firstChild.textContent.trim() === 'Tech')
      .map((n) => (n.querySelector('.cc-new') || {}).textContent || '')[0]);
  if (techBadge !== '2') fail('Tech chip did not badge 2 answered: ' + JSON.stringify(techBadge));
  // seeing them clears it: mark both chats seen the way opening them does
  await page.evaluate(() => {
    const seen = JSON.parse(localStorage.getItem('chats-seen-v1') || '{}');
    seen['chat-a'] = new Date(Date.now() + 60000).toISOString();
    seen['chat-b'] = new Date(Date.now() + 60000).toISOString();
    localStorage.setItem('chats-seen-v1', JSON.stringify(seen));
  });
  await page.reload();
  await openTags(page);
  const after = await page.$$eval('#catrow .catchip', (ns) =>
    ns.filter((n) => n.firstChild && n.firstChild.textContent.trim() === 'Tech')
      .map((n) => !!n.querySelector('.cc-new'))[0]);
  if (after) fail('the answered badge survived her seeing the chats');

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures' : 'OK: chips seed, filter, reach the hidden pile; select mode files chats');
})().catch((e) => { console.error(e); process.exit(1); });
