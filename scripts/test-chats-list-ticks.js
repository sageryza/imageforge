#!/usr/bin/env node
// THE LIST TICK (2026-09-03, Sophie, on a reply listing six named ideas as
// bold-led paragraphs: "could message lists automatically have a tick in the
// app"). Every item of a list inside a message wears a tick box — a markdown
// list of two or more, or a run of three or more paragraphs that open in bold
// — keyed by the item's own words and kept on the message doc (`ticks`).
// Hers to tick; the Questions view gets none (nowhere to save one).
//
// Every assertion is a MEASUREMENT of the rendered thread or of what the stub
// server really received: a box that renders on the wrong lines, a tap that
// saves onto the wrong doc (a merged run), or a tick that never lights from
// the doc all pass any source assertion.
//
//   npm install playwright-core --no-save && node scripts/test-chats-list-ticks.js
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
const M = 60 * 1000, H = 60 * M;

// An INDEPENDENT copy of the page's key rule, so a pre-lit tick can be seeded
// from the fixture rather than read back from the page.
function tickKey(text) {
  const t = String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 200);
  let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return h.toString(36) + t.length.toString(36);
}

// Her real message's shape: a plain lead, six bold-led paragraphs, a "Spares:"
// paragraph (plain lead, bold inside), a closing line.
const HERS = [
  'Narrowed: each one is a shape for stuff that had none. New ones:',
  '',
  '**Pigeonholes.** The "oh, I have to tell X" bits. One hole per person.',
  '',
  '**Specimen jars.** Things you wondered and never looked up.',
  '',
  '**Know, guess, hope.** Everything you are holding about one decision.',
  '',
  '**The train.** "How did I get to thinking about this?" Cars, coupled.',
  '',
  '**The tower.** Why you believe a thing. Each reason is a block in a stack.',
  '',
  '**Luggage tags.** Where an opinion came from.',
  '',
  'Spares: **lost and found** (tip of the tongue), **bookmarks** (open loops).',
  '',
  'Cards refreshed. Nothing else pending on my side.',
].join('\n');
const TRAIN_KEY = tickKey('The train. "How did I get to thinking about this?" Cars, coupled.');

const BULLETS = ['Three things:', '', '- the first', '- the second', '- the third', '', 'And in order:', '1. warm up', '2. sing'].join('\n');
const TWO = ['**TLDR** — two bold paragraphs are not a list.', '', '**Next** — so neither of these gets a box.'].join('\n');
const CODE = ['Paste this:', '', '```', '- not a list', '- still not', '```', '', 'done.'].join('\n');
const ONE = ['A reply with', '- a single bullet', 'is not a list either.'].join('\n');
// The sketches reply (2026-09-03): every item's body on the line right under
// its number, a blank line between items. A plain line directly under an item
// is that item's continuation, not the end of the run.
const CONT = ['Fourteen more.', '', '1. **Citrine**', 'YOU: "Citrine. Abundance." / pause / "Same numbers."', '', '2. **Selenite**', 'YOU: "Your file says you can\'t get wet."', '', '3. **The candle**', '"It has not gone out."', '', 'Nothing spent this turn.'].join('\n');

const msg = (id, chat, at, text, extra) => Object.assign({ id, chat, from: 'claude', text, tldr: text.split('\n')[0], created: iso(at), postedAt: iso(at) }, extra || {});
const ALL = [
  msg('lst', 'games', T0, HERS, { ticks: { [TRAIN_KEY]: true } }),
  msg('bul', 'games', T0 - 3 * H, BULLETS),
  msg('two', 'games', T0 - 6 * H, TWO),
  msg('code', 'games', T0 - 9 * H, CODE),
  msg('one', 'games', T0 - 12 * H, ONE),
  msg('cont', 'games', T0 - 15 * H, CONT),
  // a merged run: two replies three minutes apart, each with its own list
  msg('r2', 'run', T0, ['Later:', '- b1', '- b2'].join('\n')),
  msg('r1', 'run', T0 - 3 * M, ['First:', '- a1', '- a2'].join('\n')),
];
const posts = [];

const servePublic = require('./lib/public-asset');
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed/tick' && req.method === 'POST') {
    let b = ''; req.on('data', (d) => b += d); req.on('end', () => {
      posts.push(JSON.parse(b));
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
    });
    return;
  }
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'b1', chats: { games: { account: '1' }, run: { account: '1' } }, settings: {}, truncated: [], messages: since ? [] : ALL, delta: !!since }));
  }
  if (url.pathname === '/api/chatfeed/thread') {
    const chat = url.searchParams.get('chat');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ messages: ALL.filter((m) => m.chat === chat) }));
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
  res.end(JSON.stringify({ ok: true, messages: [], todos: [], bookmarks: [], questions: [] }));
});

let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; process.exitCode = 1; };
const ok = (m) => console.log('ok - ' + m);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// The items a row draws a box on, as the words after the box.
const items = (page, mid) => page.$$eval('#thread .msg[data-mid="' + mid + '"] .mtick', (bs) =>
  bs.map((b) => ({ on: b.classList.contains('on'), text: b.nextElementSibling.textContent.trim(), key: b.dataset.key, done: b.nextElementSibling.classList.contains('done') })));

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => fail('page error: ' + e.message));
  await page.goto(base + '/chats?chat=games', { waitUntil: 'load' });
  await page.waitForSelector('#thread .msg', { timeout: 6000 });
  await page.waitForTimeout(400);

  // 1. her real shape: six boxes, on the six bold-led paragraphs and nothing else
  let it = await items(page, 'lst');
  const names = it.map((x) => x.text.split('.')[0]);
  if (same(names, ['Pigeonholes', 'Specimen jars', 'Know, guess, hope', 'The train', 'The tower', 'Luggage tags'])) ok('six boxes, one per bold-led paragraph');
  else fail('lst items: ' + JSON.stringify(names));
  const lit = it.filter((x) => x.on);
  if (lit.length === 1 && /^The train/.test(lit[0].text) && lit[0].done) ok('the tick on file lights its item from the doc, and its words go quiet');
  else fail('lit: ' + JSON.stringify(lit));

  // 2. a markdown list: the bullet is replaced by the box, a number is kept
  await page.click('#thread .msg[data-mid="bul"] .m-preview');
  it = await items(page, 'bul');
  if (same(it.map((x) => x.text), ['the first', 'the second', 'the third', 'warm up', 'sing'])) ok('a markdown list and a numbered list each wear a box per item');
  else fail('bul items: ' + JSON.stringify(it.map((x) => x.text)));
  const bulText = await page.$eval('#thread .msg[data-mid="bul"] .m-full', (n) => n.textContent);
  if (!/- the first/.test(bulText) && /1\. /.test(bulText) && /2\. /.test(bulText)) ok('the dash is gone, the numbers stay');
  else fail('bul text: ' + JSON.stringify(bulText));

  // 3. the shapes that are NOT a list
  for (const [mid, why] of [['two', 'two bold-led paragraphs (a TLDR and a Next)'], ['code', 'dashes inside a code block'], ['one', 'a single bullet']]) {
    const n = (await items(page, mid)).length;
    if (n === 0) ok('no box on ' + why); else fail(why + ': ' + n + ' boxes');
  }

  // 3b. an item whose body sits on the line right under it: the body rides the
  //     item, the run holds, and the closing plain paragraph (after a blank)
  //     still gets no box
  await page.click('#thread .msg[data-mid="cont"] .m-preview');
  it = await items(page, 'cont');
  if (same(it.map((x) => x.text), ['Citrine', 'Selenite', 'The candle'])) ok('a numbered list with each body on the next line wears a box per item, and the closing paragraph none');
  else fail('cont items: ' + JSON.stringify(it.map((x) => x.text)));

  // 4. a tap lights it, saves onto THIS message under the item's key, and a
  //    second tap clears it; the tap never starts the autoscroll
  await page.click('#thread .msg[data-mid="lst"] .m-preview');
  const y0 = await page.evaluate(() => window.scrollY);
  await page.click('#thread .msg[data-mid="lst"] .mtick[data-key]:not(.on)');
  await page.waitForTimeout(300);
  const after = (await items(page, 'lst')).filter((x) => x.on).map((x) => x.text.split('.')[0]);
  if (same(after, ['Pigeonholes', 'The train'])) ok('a tap lights the box and quiets the item'); else fail('after tap: ' + JSON.stringify(after));
  if (posts.length === 1 && posts[0].id === 'lst' && posts[0].on === true && posts[0].key === tickKey('Pigeonholes. The "oh, I have to tell X" bits. One hole per person.')) ok('the server received {id, key, on:true} for that message and that item');
  else fail('posts: ' + JSON.stringify(posts));
  await page.click('#thread .msg[data-mid="lst"] .mtick.on');
  await page.waitForTimeout(300);
  if (posts.length === 2 && posts[1].on === false && posts[1].key === posts[0].key) ok('a second tap clears it (on:false, same key)'); else fail('posts: ' + JSON.stringify(posts));
  await page.waitForTimeout(700);
  const y1 = await page.evaluate(() => window.scrollY);
  if (y1 === y0) ok('tapping a box does not start the autoscroll'); else fail('scrolled ' + y0 + ' → ' + y1);

  // 5. a merged run: each part's boxes save onto that part's own doc
  await page.goto(base + '/chats?chat=run', { waitUntil: 'load' });
  await page.waitForSelector('#thread .msg', { timeout: 6000 });
  await page.waitForTimeout(400);
  await page.click('#thread .msg[data-mid="r2"] .m-preview');
  const runBoxes = await page.$$eval('#thread .msg[data-mid="r2"] .m-part', (ps) => ps.map((p) => ({ mid: p.dataset.mid, n: p.querySelectorAll('.mtick').length })));
  if (same(runBoxes, [{ mid: 'r1', n: 2 }, { mid: 'r2', n: 2 }])) ok('a merged run draws each part\'s list'); else fail('run boxes: ' + JSON.stringify(runBoxes));
  posts.length = 0;
  await page.click('#thread .msg[data-mid="r2"] .m-part[data-mid="r1"] .mtick');
  await page.waitForTimeout(300);
  if (posts.length === 1 && posts[0].id === 'r1') ok('a tick inside the older part saves onto the older part\'s own doc'); else fail('run posts: ' + JSON.stringify(posts));

  // 6. the Questions view gets no boxes — a source pin: md() there is called
  //    with no message, which is the switch.
  const src = fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8');
  if (/md\(q\.answer\)/.test(src)) ok('the Questions view calls md() without a message, so it draws no box');
  else fail('the Questions view\'s md() call changed shape — check it still passes no message');

  // A PHOTO of her real shape, opened, for the reply.
  await page.goto(base + '/chats?chat=games', { waitUntil: 'load' });
  await page.waitForSelector('#thread .msg', { timeout: 6000 });
  await page.click('#thread .msg[data-mid="lst"] .m-preview');
  await page.waitForTimeout(300);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: false });

  await browser.close();
  server.close();
  console.log(failed ? failed + ' failed' : 'all passed');
})().catch((e) => { fail(e.stack || String(e)); server.close(); process.exit(1); });
