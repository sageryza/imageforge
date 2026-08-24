#!/usr/bin/env node
// THE SEARCH FILTERS on /chats — opt in, three-way, two of them (Aug 2026).
//
//   "I'd like to add some filters to the search in the chats thing that are
//    optional. one would be a filter allowing me to search through my messages
//    versus Claude's messages. start with that and then we can think of other
//    filters."
//   "now: make the filters opt in"
//   "for things with three options, it shud be a three way toggle"
//   "another filter to add can be archived as in does it search the archive or
//    not or just the archive"
//   "right now, the name instances in the name are pinned to the top just pin
//    the first three instances and then show content results"
//
// Two halves, because the rules and the wiring fail differently:
//
//   1. PURE — the decision tables. The load-bearing asymmetry is that HERS is
//      `from === 'sophie'` EXACTLY and everything else is Claude's: older feed
//      docs carry an empty `from` and they are replies, so an unstamped record
//      has to land on Claude's side. And every filter must WIDEN on a value it
//      does not know, never empty the list.
//
//   2. HEADLESS — the real page. A filter is only worth anything if it reaches
//      the SERVER (the home bar's index is the whole history), if it is
//      genuinely optional (shut until she opens it), and if it never outlives
//      the hunt that set it.
//
//   npm install playwright-core --no-save && node scripts/test-search-filters.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  whoOf, whoParam, whoMatches, SEARCH_WHO,
  archParam, archMatches, SEARCH_ARCH,
  pickNameRows, NAME_ROWS, compileQuery,
} = require('../chatfeed.js');

let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; };
const is = (label, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fail(`${label}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// 1a. PURE — who said it
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

is('the who vocabulary is exactly three', SEARCH_WHO, ['all', 'me', 'claude']);
is('me is me', whoParam('me'), 'me');
is('case and spaces are hers to get wrong', whoParam('  Claude '), 'claude');
// An old cached page sends no filter at all, and a page from some future
// version might send a word this server has never learned. Both must WIDEN —
// a filter she cannot see must never silently delete results.
is('absent widens', whoParam(undefined), 'all');
is('an unknown word widens rather than emptying the list', whoParam('everyone'), 'all');

is('all keeps every voice', [whoMatches('all', 'sophie'), whoMatches('all', 'claude'), whoMatches('all', '')], [true, true, true]);
is('me keeps only hers', [whoMatches('me', 'sophie'), whoMatches('me', 'claude'), whoMatches('me', '')], [true, false, false]);
is('claude keeps his, unstamped included', [whoMatches('claude', 'sophie'), whoMatches('claude', 'claude'), whoMatches('claude', '')], [false, true, true]);

// ─────────────────────────────────────────────────────────────────────────
// 1b. PURE — the archive. Three options, which is exactly why it is a toggle:
// the two useful narrowings are OPPOSITE and neither is the default.
// ─────────────────────────────────────────────────────────────────────────
is('the archive vocabulary is exactly three', SEARCH_ARCH, ['all', 'live', 'only']);
is('absent is everywhere — the old behaviour, and what an older page sends', archParam(undefined), 'all');
is('an unknown word widens here too', archParam('archived'), 'all');
is('live is live', archParam('live'), 'live');
is('only is only', archParam('ONLY'), 'only');

is('all searches everywhere', [archMatches('all', true), archMatches('all', false)], [true, true]);
is('live skips the archive', [archMatches('live', true), archMatches('live', false)], [false, true]);
is('only searches the archive alone', [archMatches('only', true), archMatches('only', false)], [true, false]);
// A chat with no `archived` field at all is not archived — the flag is only
// ever written when she archives one.
is('an unflagged chat counts as live', [archMatches('live', undefined), archMatches('only', undefined)], [true, false]);

// The two filters over the same index, the way the route applies them.
const INDEX = [
  { id: 'a', chat: 'live-one', from: 'sophie', text: 'can i see that image pipeline doc' },
  { id: 'b', chat: 'live-one', from: 'claude', text: 'posted the image pipeline doc' },
  { id: 'c', chat: 'old-one', from: '', text: 'an older reply about the image pipeline' },
  { id: 'd', chat: 'old-one', from: 'sophie', text: 'the image doc again' },
];
const ARCHIVED = { 'live-one': false, 'old-one': true };
const ids = (who, arch) => INDEX
  .filter((m) => whoMatches(who, m.from) && archMatches(arch, ARCHIVED[m.chat])
    && m.text.includes('image'))
  .map((m) => m.id);
is('unfiltered finds everything', ids('all', 'all'), ['a', 'b', 'c', 'd']);
is('mine, everywhere', ids('me', 'all'), ['a', 'd']);
is('mine, skipping the archive', ids('me', 'live'), ['a']);
is('mine, in the archive alone', ids('me', 'only'), ['d']);
is('his, in the archive alone — the unstamped older reply', ids('claude', 'only'), ['c']);
is('the two filters can leave nothing, and that is a real answer', ids('claude', 'live'), ['b']);

// ─────────────────────────────────────────────────────────────────────────
// 1c. PURE — only the first three name rows
// ─────────────────────────────────────────────────────────────────────────
{
  const reg = { chats: {} };
  // Five chats whose NAME matches, plus one archived, plus one that does not.
  ['2026-08-05', '2026-08-01', '2026-08-04', '2026-08-03', '2026-08-02'].forEach((d, i) => {
    reg.chats['image-chat-' + i] = { lastSeen: d + 'T00:00:00Z' };
  });
  reg.chats['image-old'] = { lastSeen: '2026-08-06T00:00:00Z', archived: true };
  reg.chats['something-else'] = { lastSeen: '2026-08-09T00:00:00Z' };
  const groups = compileQuery('image');
  is('the cap is three', NAME_ROWS, 3);
  const rows = pickNameRows(reg, groups, 'all');
  is('only three name rows come back, however many match', rows.length, 3);
  // NEWEST FIRST, so the three she gets are the three she most likely meant.
  is('and they are the three most recently seen',
    rows.map((r) => r.chat), ['image-old', 'image-chat-0', 'image-chat-2']);
  is('a chat whose name does not match is never a row',
    rows.some((r) => r.chat === 'something-else'), false);
  // The archive filter reaches the name rows too — they are about the CHAT.
  is('skipping the archive drops the archived name row',
    pickNameRows(reg, groups, 'live').map((r) => r.chat), ['image-chat-0', 'image-chat-2', 'image-chat-3']);
  is('the archive alone leaves only it',
    pickNameRows(reg, groups, 'only').map((r) => r.chat), ['image-old']);
  is('no registry at all is no rows, never a crash', pickNameRows(null, groups, 'all'), []);
}

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

// One chat: two of her messages and three replies, every one carrying the word
// she is hunting — which is the case the who filter exists for.
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
const asked = [];   // every /search the page made, as {q, from, arch}

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
    // ABSENT and `=all` are different bytes on the wire and the page must only
    // ever send the first — recorded raw so the test can tell them apart.
    const from = url.searchParams.get('from');
    const arch = url.searchParams.get('arch');
    asked.push({ q, from, arch });
    const who = whoParam(from);
    // This stub deliberately does NOT do the real route's one-row-per-chat
    // dedupe: every fixture message is in the same chat, and collapsing them
    // would leave one row whatever the filter did — which is the opposite of
    // legible here. The dedupe has its own pure test
    // (scripts/test-search-rank.js); this file is about the filters reaching
    // the server at all.
    const hits = MSGS.filter((m) => whoMatches(who, m.from)
      && (m.text + ' ' + m.tldr).toLowerCase().includes(q.toLowerCase()));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      results: hits.map((m) => ({ id: m.id, chat: m.chat, snippet: m.text, created: m.created })),
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

  // A MISSING element answers `false` rather than throwing, so a page without
  // these controls reads as named failures and not an uncaught selector error.
  const shown = (sel) => page.$eval(sel, (n) => getComputedStyle(n).display !== 'none'
    && n.getBoundingClientRect().height > 0).catch(() => false);
  const chipText = () => page.$eval('#searchfilters .filtchip', (n) => n.textContent.trim()).catch(() => null);
  const chipLit = () => page.$eval('#searchfilters .filtchip', (n) => n.classList.contains('on')).catch(() => false);
  const words = () => page.$$eval('#searchfilters .filtval', (n) => n.map((v) => v.textContent.trim()));
  const stops = () => page.$$eval('#searchfilters .filtrow .tri', (n) => n.map((v) => v.getAttribute('data-n')));
  const results = () => page.$$eval('#searchresults .sres', (n) => n.length);
  const last = () => asked[asked.length - 1];
  // A TAP LANDS ON THE STOP UNDER IT (2026-08-24 — /tritoggle.js), so the taps
  // here are AIMED at a stop rather than counted as steps: these rows used to
  // be driven by clicking the middle over and over and relying on the cycle,
  // which is exactly the behaviour Sophie reported as broken in the Playground.
  const tapStop = async (sel, n) => {
    const box = await page.locator(sel).boundingBox();
    await page.mouse.click(box.x + box.width * ((n + 0.5) / 3), box.y + box.height / 2);
  };
  const tapWho = (n) => tapStop('#searchfilters .filtrow:nth-child(1) .tri', n);
  const tapArch = (n) => tapStop('#searchfilters .filtrow:nth-child(2) .tri', n);

  // ---- the row costs the home screen nothing until she searches -----------
  if (await shown('#searchfilters')) fail('the filter row is on screen with the search bar folded away');

  await page.click('#searchbtn');
  await page.waitForSelector('#searchfilters .filtchip', { timeout: 4000 })
    .catch(() => fail('the search bar has no Filters control at all'));

  // ---- OPT IN: shut until she asks (her ask, in those words) --------------
  if (!await shown('#searchfilters')) fail('opening the search bar did not bring the Filters chip');
  if (await shown('#searchfilters .filtdrawer')) fail('the filters are open by default — they are supposed to be opt in');
  is('the chip says what it is while nothing is narrowed', await chipText(), 'Filters');
  is('and is unlit', await chipLit(), false);

  // ---- ALL sends nothing at all -------------------------------------------
  await page.fill('#qsearch', 'image');
  await page.waitForFunction(() => document.querySelectorAll('#searchresults .sres').length > 0,
    null, { timeout: 4000 }).catch(() => fail('the search never answered'));
  is('an unfiltered search sends no from param', last().from, null);
  is('…and no arch param either', last().arch, null);
  is('unfiltered finds every voice', await results(), 6);   // 3 replies + 2 hers + 1 name row

  // ---- the drawer, and two THREE-WAY TOGGLES ------------------------------
  await page.click('#searchfilters .filtchip');
  if (!await shown('#searchfilters .filtdrawer')) fail('tapping Filters did not open the drawer');
  // THE NEUTRAL STOP IS THE MIDDLE (2026-08-24, Sophie: "the middle should be
  // the both option or everyone or whatever ... that way I can get to either
  // way with one tap"). It used to lead the list, so Claude's side sat two
  // stops out at the far end.
  is('two filters, both parked on the MIDDLE stop', await stops(), ['1', '1']);
  is('and both spelled out, not abbreviated onto the knob',
    await words(), ['Everyone', 'Everywhere']);
  // The knob carries no letter — the word beside it IS the label.
  is('the knobs carry no cryptic initial',
    await page.$$eval('#searchfilters .filtrow .tri', (n) => n.map((v) => v.getAttribute('data-i'))),
    [null, null]);

  // ---- WHO reaches the SERVER, not just the loaded list -------------------
  let before = asked.length;
  await tapWho(0);
  await page.waitForFunction((n) => document.querySelectorAll('#searchresults .sres').length === 2,
    null, { timeout: 4000 }).catch(() => {});
  if (asked.length <= before) fail('moving the who toggle never asked the server anything');
  is('MINE is ONE tap, on the left', last().from, 'me');
  is('and the toggle is on its first stop', (await stops())[0], '0');
  is('and says so', (await words())[0], 'Mine');
  is('her two messages, and no chat-name row above them', await results(), 2);
  // THE CHIP IS LIT THE MOMENT ANYTHING IS NARROWED — but while the drawer is
  // OPEN it does not repeat the words the rows below already spell out.
  is('open, the chip does not say the same thing twice', await chipText(), 'Filters');
  is('but it is lit, which is the part that is not redundant', await chipLit(), true);
  // …and SHUT it carries the state, because that is when nothing else does.
  await page.click('#searchfilters .filtchip');
  await page.waitForTimeout(150);
  is('shut, the chip wears what is narrowed', await chipText(), 'Mine');
  await page.click('#searchfilters .filtchip');   // back open for the rest

  await tapWho(2);
  await page.waitForFunction(() => document.querySelectorAll('#searchresults .sres').length === 3,
    null, { timeout: 4000 }).catch(() => fail('the far stop did not narrow to the replies'));
  is('CLAUDE is one tap from MINE, straight across', last().from, 'claude');
  is('the unstamped older reply is on his side, not hers', await results(), 3);

  // …and EVERYONE is the middle, also one tap from either end.
  await tapWho(1);
  await page.waitForTimeout(300);
  is('a tap in the middle goes back to everyone', (await stops())[0], '1');
  is('which sends nothing again', last().from, null);

  // THE WORD CLEARS, IT DOES NOT STEP (Sophie: "none of them should cycle").
  await tapWho(2);
  await page.waitForTimeout(300);
  is('narrowed again for the word test', last().from, 'claude');
  await page.click('#searchfilters .filtrow:nth-child(1) .filtval');
  await page.waitForTimeout(300);
  is('tapping the word clears that filter', (await stops())[0], '1');
  is('and the server hears the widening', last().from, null);

  // ---- THE ARCHIVE, the second filter -------------------------------------
  before = asked.length;
  await tapArch(0);
  await page.waitForTimeout(350);
  if (asked.length <= before) fail('moving the archive toggle never asked the server anything');
  is('the left stop is "not archived"', last().arch, 'live');
  is('and it says so', (await words())[1], 'Not archived');
  await tapArch(2);
  await page.waitForTimeout(350);
  is('the right stop is the archive alone', last().arch, 'only');
  is('and it says so', (await words())[1], 'Archive only');

  // ---- the two ride together ----------------------------------------------
  await tapWho(0);
  await page.waitForTimeout(350);
  is('both filters travel on the one request', [last().from, last().arch], ['me', 'only']);
  // Shut, both are on the chip, joined — the one place she sees the whole
  // state without opening anything.
  await page.click('#searchfilters .filtchip');
  await page.waitForTimeout(150);
  is('shut, the chip wears both', await chipText(), 'Mine · Archive only');
  await page.click('#searchfilters .filtchip');

  // ---- nothing tappable may sit under the injected pill -------------------
  // The pill is fixed over x 326-374 on a 390pt phone and this row is inside
  // its y band. Measured, not assumed: `isVisible()` is true either way.
  const rightEdge = await page.$$eval('#searchfilters .filtchip, #searchfilters .tri, #searchfilters .filtval',
    (bs) => Math.max(...bs.map(b => b.getBoundingClientRect().right)));
  if (rightEdge >= 326) fail(`a filter control runs under the autoscroll pill (right edge ${Math.round(rightEdge)} ≥ 326)`);

  // ---- the filters ride the one-minute memory, with the words -------------
  await page.click('#qclear');                    // fold the bar away
  if (await shown('#searchfilters')) fail('closing the search left the filter row on screen');
  await page.click('#searchbtn');                 // …and back, inside the minute
  await page.waitForFunction(() => (document.getElementById('qsearch') || {}).value === 'image',
    null, { timeout: 4000 }).catch(() => fail('the remembered words did not come back'));
  // Restored NARROWED, so the drawer comes back open and the chip is calm —
  // the rows are on screen saying it.
  is('the same hunt comes back lit', await chipLit(), true);
  is('and its toggles are where she left them', await stops(), ['0', '2']);
  // …and the drawer comes back OPEN, because the control shaping her results
  // should be in front of her rather than folded behind a chip.
  if (!await shown('#searchfilters .filtdrawer')) fail('a restored narrowed search hid the filters that are shaping it');

  // ---- but the GLASS is a NEW search, and a new search is unfiltered ------
  await page.click('#searchbtn');
  await page.waitForFunction(() => (document.getElementById('qsearch') || {}).value === '',
    null, { timeout: 4000 }).catch(() => fail('the glass did not clear the words'));
  is('a new search opens on everything again', await chipText(), 'Filters');
  is('with both toggles back on the neutral middle', await stops(), ['1', '1']);
  if (await shown('#searchfilters .filtdrawer')) fail('the glass left the drawer open');
  await page.click('#qclear');

  // ---- the thread's own box, where the filter answers on its own ----------
  await page.click('#grid [data-chat="who-one"]');
  await page.waitForSelector('.threadsearch');
  if (await shown('.msgfilters')) fail('the thread filter row is up before the search is opened');
  await page.click('.threadsearch');
  await page.waitForSelector('.msgsearch.open input');
  if (!await shown('.msgfilters')) fail('opening the thread search did not bring its Filters chip');
  if (await shown('.msgfilters .filtdrawer')) fail('the thread filters are open by default');
  await page.click('.msgfilters .filtchip');
  // WHO ONLY: a thread is one chat, so an archive filter here could show her
  // everything or nothing and never anything else.
  is('a thread offers the one filter that can narrow it',
    await page.$$eval('.msgfilters .filtrow', (n) => n.length), 1);

  const visRows = () => page.$$eval('.msg',
    (n) => n.filter(r => getComputedStyle(r).display !== 'none').length);
  const count = () => page.$eval('.msgcount', (n) => n.textContent.trim()).catch(() => '(no count)');

  is('every message shows to start with', await visRows(), 5);
  // WITH NO WORDS AT ALL — "just show me what I said in here" is a whole
  // question, and the one the thread can answer without a search term.
  await tapStop('.msgfilters .filtrow .tri', 0);
  await page.waitForTimeout(200);
  is('the filter narrows on its own, with an empty box', await visRows(), 2);
  is('and says how many', await count(), '2 messages');

  // …and it stacks with the words rather than replacing them.
  await page.fill('.msgsearch input', 'pictures');
  await page.waitForTimeout(300);
  is('her one message holding that word', await visRows(), 1);

  await tapStop('.msgfilters .filtrow .tri', 2);   // → Claude's
  await page.waitForTimeout(200);
  is('the same word on his side is nowhere', await visRows(), 0);

  // ---- closing takes the FILTER off with the words -----------------------
  await page.click('.threadsearch');
  await page.waitForTimeout(200);
  if (await shown('.msgfilters')) fail('the thread filter row stayed up after the search closed');
  is('a reopened thread is never silently missing half its messages', await visRows(), 5);
  await page.click('.threadsearch');
  await page.waitForSelector('.msgsearch.open input');
  is('and the filter is back to everyone',
    await page.$eval('.msgfilters .filtchip', (n) => n.textContent.trim()), 'Filters');

  if (errors.length) fail('page errors: ' + errors.join(' | '));

  await browser.close();
  server.close();
  if (!failed) console.log('PASS: the filters are opt in, three-way, reach the server, cap the name rows at three, and never outlive their hunt');
  process.exit(failed ? 1 : 0);
})();
