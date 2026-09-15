#!/usr/bin/env node
// A NEW REPLY IS ALREADY THERE (2026-09-15, Sophie, looking at the "NEW
// MESSAGE" banner over an open thread: "when i click the banner, the page shud
// already have the new message loaded" · "no tap · already there · shud be" ·
// "not magenta banne[r]").
//
// The bar existed for one real reason: a reply lands at the TOP of the thread,
// so rebuilding moved her scroll spot down by exactly one row while she was
// reading. Holding the reply back was one answer; giving the pixels back is the
// better one, and it is the one she asked for.
//
// EVERY ASSERTION HERE IS A MEASUREMENT. A reply merged into `msgs` but never
// painted, a bar hidden by CSS rather than never raised, and a rebuild that
// moved her half a screen all read identically in the source.
//
//   npm install playwright-core --no-save && node scripts/test-chats-new-message.js
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
const M = 60 * 1000;
// Long bodies: the thread has to be taller than the phone or there is no scroll
// spot to lose, which is the whole subject.
const body = (id) => 'reply ' + id + '\n' + Array.from({ length: 30 }, (_, i) => id + ' line ' + i).join('\n');
const msg = (id, chat, at) => ({ id, chat, from: 'claude', text: body(id), tldr: 'reply ' + id, created: iso(at), postedAt: iso(at) });
// Her own message between each reply, so nothing merges into a run — this is
// about a NEW row arriving, not about how a run draws.
const her = (id, chat, at) => ({ id, chat, from: 'sophie', text: 'ok ' + id, created: iso(at), postedAt: iso(at) });
// Plus a long tail of other chats: the home list must be TALLER THAN THE PHONE
// or there is nowhere to scroll, and its at-the-top branch (which renders
// straight in, correctly) would be the only thing measured.
const FILLER = Array.from({ length: 30 }, (_, i) => msg('f' + i, 'chat' + i, T0 - (100 + i) * M));
const MSGS = [
  msg('m3', 'watcher', T0 - 20 * M), her('s3', 'watcher', T0 - 25 * M),
  msg('m2', 'watcher', T0 - 40 * M), her('s2', 'watcher', T0 - 45 * M),
  msg('m1', 'watcher', T0 - 60 * M), her('s1', 'watcher', T0 - 65 * M),
  msg('o1', 'other', T0 - 30 * M),
].concat(FILLER);
const CHATS = { watcher: { account: '1' }, other: { account: '1' } };
FILLER.forEach((m) => { CHATS[m.chat] = { account: '1' }; });
// Armed by the test, delivered on the next poll — the shape of a reply landing
// while she reads.
let pending = [];

const servePublic = require('./lib/public-asset');
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    const out = since ? pending.splice(0) : MSGS;
    return json({ build: 'b1', chats: CHATS, settings: {}, truncated: [], messages: out, delta: !!since });
  }
  if (url.pathname === '/api/chatfeed/thread') return json({ messages: MSGS });
  if (url.pathname === '/' || url.pathname === '/chats') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8'));
  }
  return json({ ok: true, messages: [], todos: [], bookmarks: [], questions: [] });
});

let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; process.exitCode = 1; };
const ok = (m) => console.log('ok - ' + m);

// Is the bar really on screen? `display:none` is how it hides, so a height of
// zero is the honest read — `classList.contains('show')` would pass on a bar
// whose CSS never landed.
const barUp = (page) => page.evaluate(() => {
  const b = document.getElementById('newbar');
  return !!b && b.getBoundingClientRect().height > 0;
});
const rowIn = (page, mid) => page.evaluate((id) =>
  !!document.querySelector('#thread .msg[data-mid="' + id + '"]'), mid);

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => fail('page error: ' + e.message));
  await page.goto(base + '/chats?chat=watcher', { waitUntil: 'load' });
  await page.waitForSelector('#thread .msg', { timeout: 6000 });
  await page.waitForTimeout(400);

  // ── 1. SCROLLED DOWN MID-READ: the reply arrives and her place holds ──────
  // Open one message the way she does — the preview line. (Not the row itself:
  // a tap on `.m-full` toggles the reading-aid autoscroll, so the page would be
  // walking on its own and every measurement below would be measuring that.)
  await page.click('#thread .msg[data-mid="m2"] .m-preview');
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(150);
  // What she is actually looking at: a line of text, and where it sits on the
  // glass. A scrollY that "did not change" proves nothing when a row was
  // inserted above it — the words are what must not move.
  const markTop = () => page.evaluate(() => {
    const r = document.querySelector('#thread .msg[data-mid="m1"]');
    return r ? Math.round(r.getBoundingClientRect().top) : null;
  });
  const before = await markTop();
  if (before === null) { fail('the thread did not draw the row the test reads from'); }

  pending = [msg('m4', 'watcher', T0 + M)];
  await page.evaluate(() => window.__poll());
  await page.waitForTimeout(500);

  if (await rowIn(page, 'm4')) ok('a reply landing mid-read is already on the page — no tap');
  else fail('the new reply never drew; she would still have to tap something');
  if (!(await barUp(page))) ok('and no banner is raised over the thread');
  else fail('the NEW MESSAGE banner is still up in a thread');
  const after = await markTop();
  const moved = (before === null || after === null) ? 999 : Math.abs(after - before);
  if (moved <= 4) ok('the line she was reading did not move (' + moved + 'px)');
  else fail('her place slid ' + moved + 'px when the reply landed');
  // The rebuild must not shut what she had opened — the other half of why the
  // bar was built in the first place.
  const stillOpen = await page.evaluate(() => {
    const r = document.querySelector('#thread .msg[data-mid="m2"]');
    return !!r && r.classList.contains('open');
  });
  if (stillOpen) ok('a message she had expanded is still expanded'); else fail('the rebuild closed the message she was reading');

  // ── 2. AT THE TOP: the new reply is what she wants to see ────────────────
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  pending = [msg('m5', 'watcher', T0 + 2 * M)];
  await page.evaluate(() => window.__poll());
  await page.waitForTimeout(500);
  const topY = await page.evaluate(() => window.scrollY);
  if (await rowIn(page, 'm5')) ok('at the top, the newest reply draws too'); else fail('the reply never drew from the top');
  if (topY <= 8) ok('and she is left at the top, looking at it (y=' + topY + ')');
  else fail('the page pushed her down to y=' + topY + ' instead of showing the new reply');

  // ── 3. ANOTHER CHAT'S REPLY MUST NOT MOVE THIS THREAD ────────────────────
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(150);
  const y3 = await page.evaluate(() => window.scrollY);
  pending = [msg('o2', 'other', T0 + 3 * M)];
  await page.evaluate(() => window.__poll());
  await page.waitForTimeout(400);
  const y3b = await page.evaluate(() => window.scrollY);
  if (Math.abs(y3b - y3) < 6 && !(await barUp(page))) ok('a reply in another chat neither moves the page nor raises a banner');
  else fail('another chat reached this thread (y ' + y3 + ' → ' + y3b + ', banner ' + (await barUp(page)) + ')');

  // ── 4. THE HOME LIST STILL BUFFERS, AND THE BAR IS NOT MAGENTA ───────────
  // A list rebuild re-orders a whole screen of rows, so there the bar stays.
  await page.click('#back');
  await page.waitForTimeout(400);
  const home = await page.evaluate(() => {
    const t = document.getElementById('thread');
    return !t || t.getBoundingClientRect().height === 0 || !t.querySelector('.msg');
  });
  if (home) ok('back lands on the chat list'); else fail('still in the thread after back — the rest measures nothing');
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(200);
  const listY = await page.evaluate(() => window.scrollY);
  if (listY > 100) ok('the chat list is long enough to have a place to lose');
  else fail('the list never scrolled (y=' + listY + ') — the branch under test is unreachable');
  pending = [msg('o3', 'other', T0 + 4 * M)];
  await page.evaluate(() => window.__poll());
  await page.waitForTimeout(500);
  if (await barUp(page)) ok('scrolled down the home list, the banner still holds new rows back');
  else fail('the home list lost its new-message banner');
  const look = await page.evaluate(() => {
    const b = document.getElementById('newbar'), cs = getComputedStyle(b);
    const np = getComputedStyle(document.querySelector('.nowplaying'));
    return { bg: cs.backgroundColor, border: cs.borderTopWidth, barbg: np.backgroundColor };
  });
  const rgb = (s) => (s.match(/\d+/g) || []).map(Number);
  const [r, g, bl] = rgb(look.bg);
  // Magenta/rose reads as a strong red against a low green — the old
  // var(--rose) slab. The quiet bar is the now-playing bar's own paper.
  if (!(r > 120 && r - g > 40)) ok('the banner is not a magenta slab (' + look.bg + ')');
  else fail('the banner is still rose: ' + look.bg);
  if (look.bg === look.barbg) ok('it wears the now-playing bar’s own background');
  else fail('banner ' + look.bg + ' against the now-playing bar ' + look.barbg);
  if (parseFloat(look.border) > 0) ok('and its hairline border, not a borderless block');
  else fail('no hairline border on the banner');

  // ── 5. THE BAR STILL WORKS WHERE IT IS RAISED ────────────────────────────
  await page.click('#newbar');
  await page.waitForTimeout(400);
  if (!(await barUp(page))) ok('tapping it on the home list shows the rows and puts it away');
  else fail('the banner stayed up after its own tap');

  await browser.close();
  server.close();
  console.log(failed ? '\n' + failed + ' FAILED' : '\nnew-message: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
