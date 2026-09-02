#!/usr/bin/env node
// THE DRIBBLE MERGE (2026-09-02, Sophie, looking at four CLAUDE rows in ten
// minutes: "why do these all show as separate messages" — and, on the first
// cut, which folded them: "i need the messages combined into one message, so
// i can read them in the right order, not separated and hidden"). They are
// separate TURNS — a chat that backgrounded a deploy watcher and subscribed to
// its own PR wakes once per event, and the hook posts one message per turn.
// The data stays as it is (a doc is keyed by session+turn; a silent turn reads
// as a dead hook); the THREAD draws a run of replies with nothing from her
// between them as ONE message, oldest first, each part under its own time.
//
//   npm install playwright-core --no-save && node scripts/test-chats-dribble-merge.js
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
const c = (id, at, extra) => Object.assign({ id, chat: 'watcher', from: 'claude', text: 'reply ' + id + ' body', tldr: 'reply ' + id, created: iso(at), postedAt: iso(at) }, extra || {});
// Newest first, as the thread draws them:
//   m4 m3 m2 m1 (3-4 min apart)               → ONE row, reading m1 → m4
//   s1 is hers                                → its own row, ends the run
//   m0 is alone (z is five hours older)       → its own row
//   z, bk (bookmarked), y                     → three rows: a bookmark never joins
//   w is a live draft over v (2 min)          → two rows: a draft joins nothing
const MSGS = [
  c('m4', T0), c('m3', T0 - 4 * M), c('m2', T0 - 7 * M), c('m1', T0 - 10 * M),
  { id: 's1', chat: 'watcher', from: 'sophie', text: 'ok', created: iso(T0 - 30 * M), postedAt: iso(T0 - 30 * M) },
  c('m0', T0 - 40 * M),
  c('z', T0 - 5 * H), c('bk', T0 - 5 * H - 2 * M, { bookmarked: true }), c('y', T0 - 5 * H - 3 * M),
];
const DRAFT = [c('w', T0, { chat: 'writing', working: true }), c('v', T0 - 2 * M, { chat: 'writing' })];
const ALL = MSGS.concat(DRAFT);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'b1', chats: { watcher: { account: '1' }, writing: { account: '1' } }, settings: {}, truncated: [], messages: since ? [] : ALL, delta: !!since }));
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
const shown = (page) => page.evaluate(() =>
  [...document.querySelectorAll('#thread .msg')].filter((r) => r.offsetParent).map((r) => r.dataset.mid));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => fail('page error: ' + e.message));
  await page.goto(base + '/chats?chat=watcher', { waitUntil: 'load' });
  await page.waitForSelector('#thread .msg', { timeout: 6000 });
  await page.waitForTimeout(400);

  // 1. the rows: the run is one row, and NOTHING is hidden — six docs of nine
  //    are their own rows, the other three live inside the first
  let vis = await shown(page);
  const want = ['m4', 's1', 'm0', 'z', 'bk', 'y'];
  if (same(vis, want)) ok('the run is one row led by its newest; her message, a five-hour gap and a bookmark each keep their own');
  else fail('visible rows ' + JSON.stringify(vis) + ', wanted ' + JSON.stringify(want));
  const hidden = await page.$$eval('#thread .msg', (ns) => ns.filter((n) => !n.offsetParent).length);
  if (hidden === 0) ok('no row is hidden — merged, not folded'); else fail(hidden + ' hidden rows');

  // 2. the merged row: every id, the count in the head, the preview where the
  //    READING starts (the oldest), and the body in written order
  const merged = await page.evaluate(() => {
    const r = document.querySelector('#thread .msg[data-mid="m4"]');
    return {
      mids: r.dataset.mids, head: r.querySelector('.m-head').textContent,
      preview: r.querySelector('.m-preview').textContent,
      parts: [...r.querySelectorAll('.m-part')].map((p) => p.dataset.mid),
      times: [...r.querySelectorAll('.m-part .m-partt')].map((p) => p.textContent.trim()).filter(Boolean).length,
      text: r.querySelector('.m-full').textContent,
    };
  });
  if (merged.mids === 'm1 m2 m3 m4') ok('the row carries every turn\'s id'); else fail('data-mids: ' + merged.mids);
  if (/4 replies/.test(merged.head)) ok('the head says "4 replies"'); else fail('head: ' + merged.head);
  if (merged.preview.startsWith('reply m1')) ok('the preview is the oldest part — where reading starts'); else fail('preview: ' + merged.preview);
  if (same(merged.parts, ['m1', 'm2', 'm3', 'm4'])) ok('the body is the four parts, oldest first'); else fail('parts: ' + JSON.stringify(merged.parts));
  if (merged.times === 4) ok('each part wears its own time'); else fail('part times: ' + merged.times);
  const order = ['m1', 'm2', 'm3', 'm4'].map((id) => merged.text.indexOf('reply ' + id + ' body'));
  if (order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1]))) ok('the words read in the order they were written');
  else fail('body order: ' + JSON.stringify(order));

  // 3. opening it shows all four, on screen, in order
  await page.click('#thread .msg[data-mid="m4"] .m-preview');
  const ys = await page.$$eval('#thread .msg[data-mid="m4"] .m-part', (ps) => ps.map((p) => p.getBoundingClientRect().top).filter((y, i, a) => i === 0 || y > a[i - 1]).length);
  if (ys === 4) ok('open, the four parts stack top to bottom'); else fail('open parts stacked: ' + ys);

  // 4. the thread search finds a turn inside the run
  await page.click('.threadsearch');
  await page.waitForSelector('.msgsearch.open input');
  await page.fill('.msgsearch input', 'm2');
  await page.waitForTimeout(500);
  vis = await shown(page);
  if (same(vis, ['m4'])) ok('a search for a middle turn finds the merged row'); else fail('search: ' + JSON.stringify(vis));
  await page.fill('.msgsearch input', '');
  await page.waitForTimeout(500);
  if (same(await shown(page), want)) ok('clearing the search shows everything again'); else fail('clear: ' + JSON.stringify(await shown(page)));

  // 5. a jump to a turn inside the run lands on its part
  const jump = await page.evaluate(() => {
    const r = document.querySelector('#thread .msg[data-mids~="m1"]');
    const p = r && r.querySelector('.m-part[data-mid="m1"]');
    return { row: !!r, part: !!p };
  });
  if (jump.row && jump.part) ok('a turn inside the run is reachable by id, with its own part to land on'); else fail('jump: ' + JSON.stringify(jump));

  // 6. a live draft joins nothing
  await page.goto(base + '/chats?chat=writing', { waitUntil: 'load' });
  await page.waitForSelector('#thread .msg', { timeout: 6000 });
  await page.waitForTimeout(400);
  vis = await shown(page);
  if (same(vis, ['w', 'v'])) ok('a still-writing draft stays its own row over the reply before it'); else fail('draft: ' + JSON.stringify(vis));

  await browser.close();
  server.close();
  console.log(failed ? failed + ' FAILED' : 'all good');
})().catch((e) => { console.error(e); process.exit(1); });
