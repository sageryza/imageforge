#!/usr/bin/env node
// WHO SAID IT — the search's first filter (Aug 2026, Sophie: "I'd like to add
// some filters to the search in the chats thing that are optional. one would
// be a filter allowing me to search through my messages versus Claude's
// messages. start with that and then we can think of other filters").
//
// Two halves, because the rule and the wiring fail in different ways:
//
//   1. PURE — the decision table. The load-bearing asymmetry is that HERS is
//      `from === 'sophie'` EXACTLY and everything else is Claude's: older feed
//      docs carry an empty `from` and they are replies, so an unstamped record
//      has to land on Claude's side. Getting that backwards would quietly put
//      a chat's words in the pile she opened to find her OWN.
//
//   2. HEADLESS — the real page. A filter is only worth anything if it reaches
//      the SERVER (the home bar's index is the whole history; filtering the 80
//      results already on screen would answer from whatever survived the
//      unfiltered top-80), and if it never outlives the hunt that set it.
//
//   npm install playwright-core --no-save && node scripts/test-search-who-filter.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { whoOf, whoParam, whoMatches, SEARCH_WHO } = require('../chatfeed.js');

let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; };
const is = (label, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fail(`${label}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// 1. PURE — who said it
// ─────────────────────────────────────────────────────────────────────────
is('sophie is hers', whoOf('sophie'), 'me');
is('claude is his', whoOf('claude'), 'claude');
// The three that must NOT read as hers. An empty `from` is an older reply
// (measured 2026-08-23 on the live feed: 264 recent messages, all `claude` or
// `sophie`, and every one of her messages has only ever reached the feed
// through POST /reply or the hook's her_words path, both of which stamp
// `sophie`). Silence is the safe direction for the smaller pile.
is('an unstamped record is a reply, not hers', whoOf(''), 'claude');
is('undefined is a reply, not hers', whoOf(undefined), 'claude');
is('a value nobody has seen is not hers', whoOf('Sophie'), 'claude');

is('the vocabulary is exactly three', SEARCH_WHO, ['all', 'me', 'claude']);
is('all is all', whoParam('all'), 'all');
is('me is me', whoParam('me'), 'me');
is('case and spaces are hers to get wrong', whoParam('  Claude '), 'claude');
// An old cached page on her phone sends no `from` at all, and a page from
// some future version might send a word this server has never learned. Both
// must WIDEN the answer — a filter she cannot see must never silently delete
// results.
is('absent widens', whoParam(undefined), 'all');
is('empty widens', whoParam(''), 'all');
is('an unknown word widens rather than emptying the list', whoParam('everyone'), 'all');

is('all keeps hers', whoMatches('all', 'sophie'), true);
is('all keeps his', whoMatches('all', 'claude'), true);
is('all keeps the unstamped', whoMatches('all', ''), true);
is('me keeps hers', whoMatches('me', 'sophie'), true);
is('me drops his', whoMatches('me', 'claude'), false);
is('me drops the unstamped', whoMatches('me', ''), false);
is('claude drops hers', whoMatches('claude', 'sophie'), false);
is('claude keeps the unstamped', whoMatches('claude', ''), true);

// The filter as the route applies it: over the index rows, before the ranking.
const INDEX = [
  { id: 'a', from: 'sophie', text: 'can i see that image pipeline doc in a way i can read it' },
  { id: 'b', from: 'claude', text: 'posted the image pipeline doc as a Compare page' },
  { id: 'c', from: '', text: 'an older reply about the image pipeline' },
  { id: 'd', from: 'sophie', text: 'nothing to do with pictures' },
];
const ids = (who, word) => INDEX
  .filter((m) => whoMatches(who, m.from) && m.text.includes(word))
  .map((m) => m.id);
is('unfiltered finds every voice', ids('all', 'image'), ['a', 'b', 'c']);
is('her ask is one row once the replies quoting it are out', ids('me', 'image'), ['a']);
is('his side keeps the unstamped older reply', ids('claude', 'image'), ['b', 'c']);
is('the filter never widens what the words already narrowed', ids('me', 'zzz'), []);

// ─────────────────────────────────────────────────────────────────────────
// 2. HEADLESS — the real page
// ─────────────────────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  try { ({ chromium } = require('playwright-core')); }
  catch {
    if (!failed) console.log('PASS (pure only): SKIP the page half — playwright not installed');
    process.exit(failed ? 1 : 0);
  }
}

const PUB = path.join(__dirname, '..', 'public');
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();

// One chat: two of her messages and three replies, every one of them carrying
// the word she is hunting — which is the case the filter exists for.
const MSGS = [
  { id: 'r3', chat: 'who-one', from: 'claude', created: iso(T0 - 1000), postedAt: iso(T0 - 1000),
    tldr: 'posted it', text: 'The image pipeline doc is a Compare page now.' },
  { id: 's2', chat: 'who-one', from: 'sophie', created: iso(T0 - 2000), postedAt: iso(T0 - 2000),
    tldr: '', text: 'can i see that image pipeline doc in a way i can read it' },
  { id: 'r2', chat: 'who-one', from: 'claude', created: iso(T0 - 3000), postedAt: iso(T0 - 3000),
    tldr: 'reflowed', text: 'Reflowed the image pipeline doc into paragraphs.' },
  { id: 's1', chat: 'who-one', from: 'sophie', created: iso(T0 - 4000), postedAt: iso(T0 - 4000),
    tldr: '', text: 'where is the image doc about making pictures' },
  // An older reply with NO `from` at all — it must sit on Claude's side.
  { id: 'r1', chat: 'who-one', from: '', created: iso(T0 - 5000), postedAt: iso(T0 - 5000),
    tldr: '', text: 'An older note about the image pipeline, unstamped.' },
];
const CHATS = { 'who-one': { account: '1', lastSeen: MSGS[0].created } };
const asked = [];   // every /search the page made, as {q, from}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      build: 'test-build-1', chats: CHATS, settings: { appAccount: '1', categories: [] },
      truncated: [], messages: since ? [] : MSGS, delta: !!since,
    }));
  }
  if (url.pathname === '/api/chatfeed/search') {
    const q = url.searchParams.get('q') || '';
    // `from` ABSENT and `from=all` are different bytes on the wire and the
    // page must only ever send the first — recorded raw so the test can tell.
    const from = url.searchParams.get('from');
    asked.push({ q, from });
    const who = whoParam(from);
    const hits = MSGS.filter((m) => whoMatches(who, m.from)
      && (m.text + ' ' + m.tldr).toLowerCase().includes(q.toLowerCase()));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      results: hits.map((m) => ({ id: m.id, chat: m.chat, snippet: m.text, created: m.created })),
      // The real route drops the name rows once a side is picked; mirrored
      // here so the page is driven with what it will actually be handed.
      chatMatches: who === 'all' ? [{ chat: 'who-one', name: 'who-one' }] : [],
    }));
  }
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  const asset = path.join(PUB, url.pathname.replace(/^\/+/, ''));
  if (/\.(js|css|svg|png|webp)$/.test(url.pathname) && asset.startsWith(PUB) && fs.existsSync(asset)) {
    const type = url.pathname.endsWith('.js') ? 'text/javascript'
      : url.pathname.endsWith('.css') ? 'text/css'
      : url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    return res.end(fs.readFileSync(asset));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, messages: [], todos: [], bookmarks: [] }));
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(base + '/chats');
  await page.waitForSelector('#grid [data-chat="who-one"]');

  // A MISSING element answers `false` rather than throwing: against a page
  // that never got these chips the run should read as named failures, not as
  // an uncaught selector error three assertions in.
  const shown = (sel) => page.$eval(sel, (n) => getComputedStyle(n).display !== 'none'
    && n.getBoundingClientRect().height > 0).catch(() => false);
  const lit = () => page.$$eval('#searchfilters .whochip',
    (bs) => (bs.find(b => b.classList.contains('on')) || {}).dataset?.who || null);
  const results = () => page.$$eval('#searchresults .sres', (n) => n.length);
  const last = () => asked[asked.length - 1];

  // ---- the row costs the home screen nothing until she searches -----------
  if (await shown('#searchfilters')) fail('the filter chips are on screen with the search bar folded away');

  await page.click('#searchbtn');
  await page.waitForSelector('#searchfilters .whochip', { timeout: 4000 })
    .catch(() => fail('the search bar has no who-said-it filter chips at all'));
  if (!await shown('#searchfilters')) fail('opening the search bar did not bring the filter chips with it');
  is('a fresh search opens on ALL', await lit(), 'all');

  // ---- ALL sends no `from` at all -----------------------------------------
  await page.fill('#qsearch', 'image');
  await page.waitForFunction(() => document.querySelectorAll('#searchresults .sres').length > 0,
    null, { timeout: 4000 }).catch(() => fail('the search never answered'));
  is('ALL sends no from param — an absent one is what every older cached page sends',
    last().from, null);
  // 3 replies + 2 of hers + the one chat-name row.
  is('unfiltered finds every voice', await results(), 6);

  // ---- MINE reaches the SERVER, not just the loaded list ------------------
  const before = asked.length;
  await page.click('#searchfilters .whochip[data-who="me"]');
  await page.waitForFunction((n) => window.__whoAsked === undefined
    ? document.querySelectorAll('#searchresults .sres').length === 2 : true,
  null, { timeout: 4000 }).catch(() => {});
  if (asked.length <= before) fail('tapping a filter chip never asked the server anything');
  is('MINE asks the server for her side', last().from, 'me');
  is('MINE lights', await lit(), 'me');
  is('her two messages, and no chat-name row above them', await results(), 2);

  await page.click('#searchfilters .whochip[data-who="claude"]');
  await page.waitForFunction(() => document.querySelectorAll('#searchresults .sres').length === 3,
    null, { timeout: 4000 }).catch(() => fail('CLAUDE did not narrow to the replies'));
  is('CLAUDE asks for his side', last().from, 'claude');
  is('the unstamped older reply is on his side, not hers', await results(), 3);

  // ---- nothing tappable may sit under the injected pill -------------------
  // The pill is fixed over x 326-374 on a 390pt phone and this row is inside
  // its y band. Measured, not assumed: `isVisible()` is true either way.
  const rightEdge = await page.$$eval('#searchfilters .whochip',
    (bs) => Math.max(...bs.map(b => b.getBoundingClientRect().right)));
  if (rightEdge >= 326) fail(`a filter chip runs under the autoscroll pill (right edge ${Math.round(rightEdge)} ≥ 326)`);

  // ---- the filter rides the one-minute memory, with the words -------------
  await page.click('#qclear');                    // fold the bar away
  if (await shown('#searchfilters')) fail('closing the search left the filter chips on screen');
  await page.click('#searchbtn');                 // …and back, inside the minute
  await page.waitForFunction(() => (document.getElementById('qsearch') || {}).value === 'image',
    null, { timeout: 4000 }).catch(() => fail('the remembered words did not come back'));
  is('the same hunt comes back with the same side picked', await lit(), 'claude');

  // ---- but the GLASS is a NEW search, and a new search is unfiltered ------
  await page.click('#searchbtn');
  await page.waitForFunction(() => (document.getElementById('qsearch') || {}).value === '',
    null, { timeout: 4000 }).catch(() => fail('the glass did not clear the words'));
  is('a new search opens on ALL again', await lit(), 'all');
  await page.click('#qclear');

  // ---- the thread's own box, where the filter answers on its own ----------
  await page.click('#grid [data-chat="who-one"]');
  await page.waitForSelector('.threadsearch');
  if (await shown('.msgfilters')) fail('the thread filter chips are up before the search is opened');
  await page.click('.threadsearch');
  await page.waitForSelector('.msgsearch.open input');
  if (!await shown('.msgfilters')) fail('opening the thread search did not bring its filter chips');

  // The thread's list has no id of its own; the Questions panel is the only
  // other `.msg` on the page and it is never loaded here.
  const visRows = () => page.$$eval('.msg',
    (n) => n.filter(r => getComputedStyle(r).display !== 'none').length);
  const count = () => page.$eval('.msgcount', (n) => n.textContent.trim())
    .catch(() => '(no count)');

  is('every message shows to start with', await visRows(), 5);
  // WITH NO WORDS AT ALL — "just show me what I said in here" is a whole
  // question, and the one the thread can answer without a search term.
  await page.click('.msgfilters .whochip[data-who="me"]');
  await page.waitForTimeout(150);
  is('the filter narrows on its own, with an empty box', await visRows(), 2);
  is('and says how many', await count(), '2 messages');

  // …and it stacks with the words rather than replacing them.
  await page.fill('.msgsearch input', 'pictures');
  await page.waitForTimeout(300);
  is('her one message holding that word', await visRows(), 1);

  await page.click('.msgfilters .whochip[data-who="claude"]');
  await page.waitForTimeout(150);
  is('the same word on his side is nowhere', await visRows(), 0);

  // ---- closing takes the FILTER off with the words -----------------------
  await page.click('.threadsearch');
  await page.waitForTimeout(150);
  if (await shown('.msgfilters')) fail('the thread filter chips stayed up after the search closed');
  is('a reopened thread is never silently missing half its messages', await visRows(), 5);
  await page.click('.threadsearch');
  await page.waitForSelector('.msgsearch.open input');
  is('and the chips are back on ALL', await page.$$eval('.msgfilters .whochip',
    (bs) => (bs.find(b => b.classList.contains('on')) || {}).dataset?.who || null), 'all');

  if (errors.length) fail('page errors: ' + errors.join(' | '));

  await browser.close();
  server.close();
  if (!failed) console.log('PASS: who said it — hers is `sophie` exactly, the home bar asks the SERVER, the thread filters on its own, and neither filter outlives its hunt');
  process.exit(failed ? 1 : 0);
})();
