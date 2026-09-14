#!/usr/bin/env node
// A SCRIPT BLOCK IN A REPLY IS EDITABLE IN PLACE (2026-09-07, Sophie: "can u
// make it possible to edit the script blocks right in message"). A run of `>`
// lines renders as ONE block with a pencil; the pencil turns the block into a
// box holding its live text; Save files {id, key, text} on /blockedit AND
// sends ONE LINE naming the block into the thread as her message through /reply, QUIETLY (no
// /wake); the block then shows her words with an "edited" mark; an edit on
// file paints on load; Reset sends '' and the original is back. Every
// assertion is a MEASUREMENT of the rendered thread or of what the stub really
// received.
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('playwright-core')); }
const PUB = path.join(__dirname, '..', 'public');
function tickKey(text) {
  const t = String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 200);
  let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return h.toString(36) + t.length.toString(36);
}
const T0 = Date.now() - 60000, iso = (t) => new Date(t).toISOString();
const Q1 = ['she is the woman in [Video1].', '', 'no voiceover, no narration.', '', '“No wait,” she says. “I don’t need sleep medication.”'].join('\n');
const PLAN = ['**The Jamaican man — what I’d send:**', '', '> ' + Q1.split('\n').join('\n> '), '', 'Mine: the [Video1] line.', '', '> “It just made me sluggish,” says Sophie.', '', 'Say go.'].join('\n');
const K1 = tickKey(Q1), K2 = tickKey('“It just made me sluggish,” says Sophie.');
const ALL = [
  { id: 'plan', chat: 'ward', from: 'claude', text: PLAN, tldr: 'plan', created: iso(T0), postedAt: iso(T0) },
  { id: 'old', chat: 'ward', from: 'claude', text: 'Earlier:\n\n> the original words\n\nend.', tldr: 'old', created: iso(T0 - 7200000), postedAt: iso(T0 - 7200000),
    blockedits: { [tickKey('the original words')]: { text: 'her words instead', at: iso(T0) } } },
];
const edits = [], replies = [], wakes = [];
const servePublic = require('./lib/public-asset');
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const take = (arr) => { let b = ''; req.on('data', (d) => b += d); req.on('end', () => { arr.push(JSON.parse(b)); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true,"status":"fired"}'); }); };
  if (req.method === 'POST' && url.pathname === '/api/chatfeed/blockedit') return take(edits);
  if (req.method === 'POST' && url.pathname === '/api/chatfeed/reply') return take(replies);
  if (req.method === 'POST' && url.pathname === '/api/chatfeed/wake') return take(wakes);
  if (url.pathname === '/api/chatfeed' && req.method === 'GET') {
    const since = url.searchParams.get('since');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ build: 'b1', chats: { ward: { account: '1' } }, settings: {}, truncated: [], messages: since ? [] : ALL, delta: !!since }));
  }
  if (url.pathname === '/api/chatfeed/thread') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ messages: ALL })); }
  if (url.pathname === '/' || url.pathname === '/chats') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(fs.readFileSync(path.join(PUB, 'chats.html'), 'utf8')); }
  const asset = path.join(PUB, url.pathname.replace(/^\/+/, ''));
  if (/\.(js|css|svg|png|webp)$/.test(url.pathname) && asset.startsWith(PUB) && fs.existsSync(asset)) { res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' }); return res.end(fs.readFileSync(asset)); }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, messages: [], todos: [], bookmarks: [], questions: [] }));
});
let failed = 0;
const fail = (m) => { console.error('FAIL: ' + m); failed++; process.exitCode = 1; };
const ok = (m) => console.log('ok - ' + m);
const blocks = (page, mid) => page.$$eval('#thread .msg[data-mid="' + mid + '"] .mquote', (bs) => bs.map((b) => ({
  key: b.dataset.key, text: b.querySelector('.mqtext').textContent, edited: !!b.querySelector('.mqedited'),
  pencil: !!b.querySelector('.mqedit'), box: !!b.querySelector('textarea'), raw: b.querySelector('.mqtext').innerHTML })));
(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => fail('page error: ' + e.message));
  await page.goto(base + '/chats?chat=ward', { waitUntil: 'load' });
  await page.waitForSelector('#thread .msg', { timeout: 6000 });
  await page.waitForTimeout(400);
  await page.click('#thread .msg[data-mid="plan"] .m-preview').catch(() => {});
  await page.waitForTimeout(200);
  // 1. the run of `>` lines is ONE block, the words verbatim, no `>` left, a pencil
  let b = await blocks(page, 'plan');
  if (b.length === 2 && b[0].key === K1 && b[1].key === K2) ok('two quote runs draw two blocks keyed by their own words'); else fail('blocks: ' + JSON.stringify(b));
  if (b[0] && b[0].text === Q1 && !/&gt;|>/.test(b[0].raw) && b[0].pencil && !b[0].edited) ok('the block holds the words verbatim, no > marks, a pencil, not edited'); else fail('block 0: ' + JSON.stringify(b[0]));
  const plain = await page.$eval('#thread .msg[data-mid="plan"] .m-full', (n) => n.textContent);
  if (/Mine: the \[Video1\] line\./.test(plain) && /Say go\./.test(plain)) ok('the prose around the blocks is untouched'); else fail('prose: ' + plain.slice(0, 200));
  // 2. an edit on file paints her words and the mark
  const old = await blocks(page, 'old');
  if (old.length === 1 && old[0].text === 'her words instead' && old[0].edited) ok('an edit on file shows her words with the edited mark'); else fail('old: ' + JSON.stringify(old));
  // 3. the pencil opens a box holding the live text; the tap starts no autoscroll
  const y0 = await page.evaluate(() => window.scrollY);
  const sel = '#thread .msg[data-mid="plan"] .mquote[data-key="' + K1 + '"]';
  await page.click(sel + ' .mqedit'); await page.waitForTimeout(150);
  const val = await page.$eval(sel + ' textarea', (t) => t.value);
  const hidden = await page.$eval(sel + ' .mqtext', (n) => n.hidden);
  if (val === Q1 && hidden) ok('the pencil swaps the words for a box holding exactly them'); else fail('box: ' + JSON.stringify([val, hidden]));
  // the box is the size of its words: no inner scroll, and as tall as the words were
  const fitted = await page.$eval(sel + ' textarea', (t) => ({ h: t.getBoundingClientRect().height, sh: t.scrollHeight, words: t.parentNode.querySelector('.mqtext').scrollHeight }));
  if (fitted.h >= fitted.sh - 1 && fitted.h >= fitted.words * 0.9) ok('the box is fitted to the words (no inner scroll, at least as tall as the text was)'); else fail('box size: ' + JSON.stringify(fitted));
  await page.type(sel + ' textarea', '\n\nmore lines\nand more\nand more\nand more'); await page.waitForTimeout(100);
  const grown = await page.$eval(sel + ' textarea', (t) => ({ h: t.getBoundingClientRect().height, sh: t.scrollHeight }));
  if (grown.h > fitted.h && grown.h >= grown.sh - 1) ok('typing more grows the box with the words'); else fail('grow: ' + JSON.stringify([fitted, grown]));
  await page.fill(sel + ' textarea', Q1);
  const resetHidden = await page.$eval(sel + ' .mqreset', (n) => n.hidden);
  if (resetHidden) ok('no Reset while there is no edit to reset'); else fail('reset shown with no edit');
  // 4. Save files the edit and sends it as her message, quietly
  await page.fill(sel + ' textarea', 'she is the woman in [Video1].\n\nno voiceover.\n\n“No wait,” she says. “It’s only nine o’clock.”');
  await page.waitForTimeout(1100);
  // 4a. it autosaved on the pause in typing — before Done, nothing in the thread yet
  if (edits.length === 1 && edits[0].id === 'plan' && edits[0].key === K1 && /nine o’clock/.test(edits[0].text) && replies.length === 0) ok('a pause in typing autosaves /blockedit {id, key, text}; nothing posted to the thread yet'); else fail('autosave: ' + JSON.stringify([edits, replies]));
  await page.click(sel + ' .mqsave'); await page.waitForTimeout(400);
  if (edits.length === 1) ok('Done files nothing new when the autosave already has it'); else fail('edits after Done: ' + JSON.stringify(edits));
  if (replies.length === 1 && replies[0].chat === 'ward' && /^Block plan\/[a-z0-9]+ “she is the woman in \[Video1\]\./.test(replies[0].text) && /was edited$/.test(replies[0].text) && !/nine o’clock/.test(replies[0].text) && replies[0].text.length < 120) ok('one line went into the thread naming the block — never the words (2026-09-08)'); else fail('replies: ' + JSON.stringify(replies));
  if (wakes.length === 0) ok('no doorbell'); else fail('wake rang: ' + JSON.stringify(wakes));
  b = await blocks(page, 'plan');
  if (b[0] && /nine o’clock/.test(b[0].text) && b[0].edited && !b[0].box) ok('the block now shows her words with the edited mark, box gone'); else fail('after save: ' + JSON.stringify(b[0]));
  const y1 = await page.evaluate(() => window.scrollY);
  if (Math.abs(y1 - y0) < 2) ok('the taps moved the page 0px'); else fail('page moved ' + (y1 - y0));
  const hers = await page.$$eval('#thread .msg', (ms) => ms.filter((m) => /^Block plan\//.test(m.textContent.replace(/^(me|claude)\s*[^B]*/, '')) || /Block plan\/[a-z0-9]+ .*was edited/.test(m.textContent)).length);
  if (hers >= 1) ok('her message shows in the thread right away'); else fail('her message not drawn');
  // 5. Reset sends '' and the original comes back
  await page.click(sel + ' .mqedit'); await page.waitForTimeout(150);
  const rh = await page.$eval(sel + ' .mqreset', (n) => n.hidden);
  if (!rh) ok('Reset appears once an edit exists'); else fail('no Reset after edit');
  await page.click(sel + ' .mqreset'); await page.waitForTimeout(400);
  b = await blocks(page, 'plan');
  if (edits.length === 2 && edits[1].text === '' && b[0].text === Q1 && !b[0].edited && replies.length === 2 && /^Block plan\/[a-z0-9]+ .*was put back to the original$/.test(replies[1].text)) ok('Reset files an empty edit, says so in one line, and the original is back, mark gone'); else fail('reset: ' + JSON.stringify([edits[1], b[0]]));
  // 6. opening and closing with nothing changed files nothing and sends nothing
  await page.click(sel + ' .mqedit'); await page.waitForTimeout(100); await page.click(sel + ' .mqsave'); await page.waitForTimeout(300);
  b = await blocks(page, 'plan');
  if (b[0].text === Q1 && edits.length === 2 && replies.length === 2) ok('Done with nothing changed files nothing, sends nothing'); else fail('no-op: ' + JSON.stringify([b[0], edits.length, replies.length]));
  // PHOTO: the block as she sees it
  await page.screenshot({ path: '/tmp/claude-0/-home-user/6c1269bd-6f12-50d1-9684-f149bf9bc01e/scratchpad/p9/script-block.png', clip: { x: 0, y: 0, width: 390, height: 844 } }).catch(() => {});
  await browser.close(); server.close();
  console.log(failed ? failed + ' FAILED' : 'all passed');
})().catch((e) => { console.error(e); process.exit(1); });
