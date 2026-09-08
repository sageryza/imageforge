#!/usr/bin/env node
// THE EDITABLE CODE BLOCK (2026-09-08, Sophie: "make blocks editable if
// they're in ur message"). Every fenced code block inside a CLAUDE reply in a
// thread wears a small underlined `edit` under it (the house .moretxt paint).
// Tapping it swaps the block for a box holding the block's EXACT text — the
// live value, never pre-written text — with Send and Cancel under it. Send
// posts `edited block:\n` + her text VERBATIM into the thread as HER message
// through /reply, QUIETLY (never /wake — the list-note rule: the chat sweeps
// it when it is next up), and the block then reads back showing her text, so
// what she sees is what was sent. Cancel puts the original back untouched. A
// block inside HER OWN message gets no opener — there is nobody to send it to.
//
// Every assertion is a MEASUREMENT of the rendered thread or of what the stub
// server really received: an opener on the wrong message, a box holding a
// trimmed copy, a send that reworded her text, or a doorbell rung on the way
// all pass any source assertion.
//
//   npm install playwright-core --no-save && node scripts/test-chats-edit-block.js
//   (CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome when the
//    default launch cannot find a browser)
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

// The block's exact words: angle brackets, quotes, an ampersand, indentation,
// a blank line in the middle — everything an escape-then-unescape round trip
// or a trim could quietly change.
const BLOCK = [
  'curl -X POST "$BASE/api/chatfeed/reply" \\',
  '  -H "content-type: application/json" \\',
  '  -d \'{"chat":"games","text":"<b>hi</b> & bye"}\'',
  '',
  '# then wait',
].join('\n');
const REPLY = ['Paste this in a terminal:', '', '```bash', BLOCK, '```', '', 'and tell me what it says.'].join('\n');
const HERS = ['here is what it said:', '', '```', '{"ok":true}', '```'].join('\n');
// a live draft: the block is still being written, so no opener yet
const DRAFT = ['Working on it', '', '```', 'half a line', '```'].join('\n');

const msg = (id, chat, at, text, extra) => Object.assign({ id, chat, from: 'claude', text, tldr: text.split('\n')[0], created: iso(at), postedAt: iso(at) }, extra || {});
const ALL = [
  msg('draft', 'games', T0, DRAFT, { working: true }),
  msg('mine', 'games', T0 - 1 * H, HERS, { from: 'sophie' }),
  msg('code', 'games', T0 - 2 * H, REPLY),
];
const replies = [], wakes = [], others = [];

const servePublic = require('./lib/public-asset');
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if ((url.pathname === '/api/chatfeed/reply' || url.pathname === '/api/chatfeed/wake') && req.method === 'POST') {
    let b = ''; req.on('data', (d) => b += d); req.on('end', () => {
      (url.pathname.endsWith('reply') ? replies : wakes).push(JSON.parse(b));
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, status: 'fired' }));
    });
    return;
  }
  if (req.method === 'POST') {
    // anything else the page writes on the way (a tick, a block edit, a
    // beacon) — the editor must file NOTHING on the doc
    let b = ''; req.on('data', (d) => b += d); req.on('end', () => {
      others.push({ path: url.pathname, body: b });
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
    });
    return;
  }
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'b1', chats: { games: { account: '1' } }, settings: {}, truncated: [], messages: since ? [] : ALL, delta: !!since }));
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
const ROW = (mid) => '#thread .msg[data-mid="' + mid + '"]';
const BOX = ROW('code') + ' .codebox';

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => fail('page error: ' + e.message));
  await page.goto(base + '/chats?chat=games', { waitUntil: 'load' });
  await page.waitForSelector('#thread .msg', { timeout: 6000 });
  await page.waitForTimeout(400);
  for (const mid of ['code', 'mine', 'draft']) await page.click(ROW(mid) + ' .m-preview');
  await page.waitForTimeout(200);

  // 1. the opener: under the block in the claude reply, on nothing else
  const openers = await page.$$eval('#thread .msg', (rows) => rows.map((r) => [r.dataset.mid, r.querySelectorAll('.codebox').length, r.querySelectorAll('.codebox .codeedit').length]));
  const by = {}; openers.forEach(([mid, boxes, eds]) => { by[mid] = [boxes, eds]; });
  if (by.code && by.code[0] === 1 && by.code[1] === 1) ok('the claude reply\'s code block carries one edit opener'); else fail('code row: ' + JSON.stringify(by.code));
  if (by.mine && by.mine[0] === 1 && by.mine[1] === 0) ok('a code block in HER message carries none'); else fail('her row: ' + JSON.stringify(by.mine));
  if (by.draft && by.draft[0] === 1 && by.draft[1] === 0) ok('a block in a live draft carries none yet'); else fail('draft row: ' + JSON.stringify(by.draft));
  // it is painted as the house opener — an underlined word with no box —
  // MEASURED off the computed style, and it sits UNDER the block
  const paint = await page.$eval(BOX + ' .codeedit', (b) => {
    const cs = getComputedStyle(b), pre = b.parentNode.querySelector('pre').getBoundingClientRect(), r = b.getBoundingClientRect();
    return { text: b.textContent, under: /underline/.test(cs.textDecorationLine || cs.textDecoration), border: cs.borderTopWidth, bg: cs.backgroundColor, below: r.top >= pre.bottom - 1, tag: b.tagName };
  });
  if (paint.text === 'edit' && paint.under && paint.border === '0px' && paint.bg === 'rgba(0, 0, 0, 0)' && paint.tag === 'BUTTON') ok('it reads "edit", underlined, no border, no fill — and is still a <button>'); else fail('paint: ' + JSON.stringify(paint));
  if (paint.below) ok('…and it sits under the block'); else fail('opener not under the block: ' + JSON.stringify(paint));

  // 2. tapping opens a box holding the EXACT text
  await page.click(BOX + ' .codeedit'); await page.waitForTimeout(200);
  // the focus brings the box into view once — a jump, not a ride; the
  // autoscroll is the page STILL moving a moment later
  const y0 = await page.evaluate(() => window.scrollY);
  const opened = await page.$eval(BOX, (box) => {
    const ta = box.querySelector('textarea'), pre = box.querySelector('pre');
    // hidden is asked as PAINT, not as the attribute — [hidden] loses to an author display rule (the photo caught the opener and the copy icon still drawn over the open box)
    const gone = (el) => el.getBoundingClientRect().height === 0;
    return ta ? { value: ta.value, focused: document.activeElement === ta, fs: parseFloat(getComputedStyle(ta).fontSize), fits: ta.scrollHeight <= ta.clientHeight + 2, preHidden: gone(pre), openerHidden: gone(box.querySelector('.codeedit')) && gone(box.querySelector('.codecopy')),
      buttons: Array.from(box.querySelectorAll('.mtbar button')).map((b) => [b.textContent, getComputedStyle(b).borderRadius]) } : null;
  });
  if (opened && opened.value === BLOCK) ok('the box holds the block\'s exact text (brackets, quotes, the blank line, the indent)'); else fail('box value: ' + JSON.stringify(opened && opened.value));
  if (opened && opened.focused && opened.preHidden && opened.openerHidden) ok('the box takes the focus and stands in for the block — the block, the copy icon and the opener are really unpainted'); else fail('open state: ' + JSON.stringify(opened));
  if (opened && opened.fs >= 16) ok('the box is ' + opened.fs + 'px — iOS will not zoom on focus'); else fail('font-size: ' + (opened && opened.fs));
  if (opened && opened.fits) ok('the box is fitted to its words'); else fail('box scrolls: ' + JSON.stringify(opened));
  if (opened && JSON.stringify(opened.buttons.map((b) => b[0])) === '["Cancel","Send"]' && opened.buttons.every((b) => b[1] === '6px')) ok('Cancel and Send under it, at the house 6px'); else fail('buttons: ' + JSON.stringify(opened && opened.buttons));
  await page.waitForTimeout(700);
  const y1 = await page.evaluate(() => window.scrollY);
  if (y1 === y0) ok('opening the box does not start the autoscroll (the page holds still after the focus jump)'); else fail('scrolled ' + y0 + ' → ' + y1);

  // 3. Cancel restores the block untouched
  await page.fill(BOX + ' textarea', 'something she typed then thought better of');
  await page.click(BOX + ' .codecancel'); await page.waitForTimeout(150);
  const afterCancel = await page.$eval(BOX, (box) => ({ ta: !!box.querySelector('textarea'), pre: box.querySelector('pre').textContent, preShown: !box.querySelector('pre').hidden, opener: !box.querySelector('.codeedit').hidden }));
  if (!afterCancel.ta && afterCancel.pre === BLOCK && afterCancel.preShown && afterCancel.opener) ok('Cancel closes the box and the block reads exactly as before'); else fail('after cancel: ' + JSON.stringify(afterCancel));
  if (replies.length === 0 && wakes.length === 0 && others.length === 0) ok('…and nothing reached the server'); else fail('cancel posted: ' + JSON.stringify([replies, wakes, others]));

  // 4. Send posts her text VERBATIM as her message, quietly, and the block
  //    then shows what was sent
  const EDITED = '  curl -X POST "$BASE/api/chatfeed/reply"   \n\n  -d \'{"chat":"games"}\'  \n# trailing spaces and blank lines stay  ';
  await page.click(BOX + ' .codeedit'); await page.waitForTimeout(150);
  await page.fill(BOX + ' textarea', EDITED);
  await page.click(BOX + ' .codesend'); await page.waitForTimeout(500);
  if (replies.length === 1 && replies[0].chat === 'games' && replies[0].text === 'edited block:\n' + EDITED) ok('Send posts exactly "edited block:\\n" + her text to /reply — nothing trimmed, nothing reworded');
  else fail('replies: ' + JSON.stringify(replies));
  if (wakes.length === 0) ok('…and does NOT ring the doorbell (the chat sees it when it is next up)'); else fail('wakes: ' + JSON.stringify(wakes));
  if (others.length === 0) ok('…and files nothing on the message doc'); else fail('other posts: ' + JSON.stringify(others));
  const afterSend = await page.$eval(BOX, (box) => ({ ta: !!box.querySelector('textarea'), pre: box.querySelector('pre').textContent, preShown: !box.querySelector('pre').hidden, opener: !box.querySelector('.codeedit').hidden }));
  if (!afterSend.ta && afterSend.pre === EDITED && afterSend.preShown && afterSend.opener) ok('the block reads back showing HER text — what she sees is what was sent'); else fail('after send: ' + JSON.stringify(afterSend));
  const hers = await page.$$eval('#thread .msg', (rows) => rows.filter((r) => r.querySelector('.m-chat.sophie')).map((r) => r.querySelector('.m-preview').textContent));
  if (hers.length === 2 && /^edited block:/.test(hers[1])) ok('her message shows in the thread right away, as a composer send does'); else fail('her rows: ' + JSON.stringify(hers));
  // opening again holds her edit — the live value, not the chat's original
  await page.click(BOX + ' .codeedit'); await page.waitForTimeout(150);
  const reopened = await page.$eval(BOX + ' textarea', (t) => t.value);
  if (reopened === EDITED) ok('reopening the box holds her edit — the live value'); else fail('reopen: ' + JSON.stringify(reopened));
  await page.click(BOX + ' .codecancel');

  // 5. her own block never opens: a source pin that the gate is from!=='sophie'
  const src = fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8');
  if (/m\.from!=='sophie'&&!m\.working/.test(src)) ok('the opener\'s gate is the message\'s from, not its text'); else fail('the editable gate changed shape');

  if (process.env.SHOT) { await page.click(BOX + ' .codeedit'); await page.waitForTimeout(150); await page.screenshot({ path: process.env.SHOT, fullPage: false }); }

  await browser.close();
  server.close();
  console.log(failed ? failed + ' failed' : 'all passed');
})().catch((e) => { fail(e.stack || String(e)); server.close(); process.exit(1); });
