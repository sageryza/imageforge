#!/usr/bin/env node
// A SCRIPT BLOCK OF NUMBERED BEATS RENDERS ONCE (2026-09-16, Sophie, looking
// at a Christmas commercial script in her thread: "formatting twice").
//
// `quoteBlocks` packs a block's ORIGINAL words into `data-orig="…"` for the
// Reset. `tickList` walks the string LINE BY LINE and boxes anything matching
// LIST_MARK — and a screenplay's `26. back to the living room.` matches. Run
// quoteBlocks first and tickList injects `<button … class="mtick" …>`, raw
// quotes and all, INTO that attribute value: the first quote closes data-orig,
// the button's own `>` closes the .mquote tag, and the rest of the original
// spills onto the screen as text — so the script shows once as the spill, once
// more inside .mqtext, with the literal `">` between them. The eaten button's
// bare <svg> lands loose in the block too, where `.mtick svg{width:13px;
// visibility:hidden}` cannot reach it: a checkmark the width of the message.
//
// EVERY ASSERTION IS A MEASUREMENT OF THE RENDERED THREAD, because that is the
// only place this is visible: the md() string looks plausible either way (the
// duplicate lives inside what is *meant* to be an attribute), and a source
// assertion about call order would pass on any ordering that still spilled.
//
//   npm install playwright-core --no-save && node scripts/test-chats-block-ticks.js
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('playwright-core')); }
const PUB = path.join(__dirname, '..', 'public');
const servePublic = require('./lib/public-asset');

// Her own script, the shape that broke it: numbered beats, quoted dialogue.
const SCRIPT = [
  '26. back to the living room. mom is still staring at the tree.',
  'mom: "...we stole it?"',
  '',
  '27. the girl, on the floor with the crystals, not looking up.',
  'girl: "It\'s Saturnalia, Mum."',
  '',
  '28. mom looks down at her. she keeps sorting the little bottles as she talks.',
  'girl: "The Romans did it. In December."',
  '',
  '29. mom: "...who told you that?"',
  'girl shrugs. goes back to the bottles.',
  '',
  '30. dad, to mom, quiet: "...did you know that?"',
  'mom does not answer.',
  '',
  '31. the girl points the wand at the tree again. she almost smiles.',
  '',
  'voiceover (baritone): "secretly a witch. she already knows."',
  '',
  'SUPER: Secretly a Witch.',
].join('\n');
const QUOTED = SCRIPT.split('\n').map((l) => (l ? '> ' + l : '>')).join('\n');
const SCRIPT_TEXT = '**Conclusion — beats 26-31, the girl talks**\n\n' + QUOTED + '\n\nSay go.';
// A plain numbered list in another message: the tick feature itself, which the
// fix must leave exactly as it was.
const LIST_TEXT = 'Three to do:\n\n1. cut the ward scene\n2. bank the takes\n3. send the sheet';

const T0 = Date.now() - 60000, iso = (t) => new Date(t).toISOString();
// A message of hers between the two replies, or they merge into one row (a run
// of replies with nothing from her between them is ONE message) and there is no
// `listy` row to look at.
const ALL = [
  { id: 'script', chat: 'ward', from: 'claude', text: SCRIPT_TEXT, tldr: 'script', created: iso(T0), postedAt: iso(T0) },
  { id: 'ask2', chat: 'ward', from: 'sophie', text: 'and the script?', created: iso(T0 - 60000), postedAt: iso(T0 - 60000) },
  { id: 'listy', chat: 'ward', from: 'claude', text: LIST_TEXT, tldr: 'list', created: iso(T0 - 3599000), postedAt: iso(T0 - 3599000) },
  { id: 'ask1', chat: 'ward', from: 'sophie', text: 'and the list?', created: iso(T0 - 3600000), postedAt: iso(T0 - 3600000) },
];

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
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
const count = (hay, needle) => hay.split(needle).length - 1;

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => fail('page error: ' + e.message));
  await page.goto(base + '/chats?chat=ward', { waitUntil: 'load' });
  await page.waitForSelector('#thread .msg', { timeout: 6000 });
  await page.waitForTimeout(400);
  const SEL = '#thread .msg[data-mid="script"]';
  await page.click(SEL + ' .m-preview').catch(() => {});
  await page.waitForTimeout(250);

  // 1. WHAT IS ON SCREEN: the script, once.
  const shown = await page.$eval(SEL + ' .m-full', (n) => n.innerText);
  const first = count(shown, 'back to the living room');
  const last = count(shown, 'SUPER: Secretly a Witch');
  if (first === 1 && last === 1) ok('the script is on screen exactly once (first beat ×1, last line ×1)');
  else fail('the script rendered ' + first + '×/' + last + '× — formatting twice');

  // 2. THE SPILL'S OWN SIGNATURE: the attribute's closing `">` as visible text.
  if (!/">/.test(shown)) ok('no stray `">` in the words'); else fail('`">` is on screen: ' + shown.slice(Math.max(0, shown.indexOf('">') - 60), shown.indexOf('">') + 20));

  // 3. ONE BLOCK, holding the words verbatim, with no `>` marks left.
  const blocks = await page.$$eval(SEL + ' .mquote', (bs) => bs.map((b) => ({
    text: b.querySelector('.mqtext') ? b.querySelector('.mqtext').textContent : null,
    pencil: !!b.querySelector('.mqedit'), orig: b.dataset.orig || '', key: b.dataset.key || '',
  })));
  if (blocks.length === 1) ok('the run of `>` lines is ONE block'); else fail('blocks: ' + blocks.length);
  if (blocks[0] && blocks[0].text === SCRIPT) ok('the block holds the script verbatim'); else fail('block text: ' + JSON.stringify((blocks[0] || {}).text || '').slice(0, 300));
  if (blocks[0] && blocks[0].pencil) ok('the block still has its pencil'); else fail('no pencil on the block');

  // 4. NO TICK BOXES INSIDE A BLOCK — a block is one editable thing, not a
  //    checklist, and a box in there is the injection that breaks the tag.
  const inBlock = await page.$$eval(SEL + ' .mquote .mtick', (n) => n.length);
  if (inBlock === 0) ok('no tick boxes inside the block'); else fail(inBlock + ' tick boxes inside the block');

  // 5. data-orig SURVIVED WHOLE — this is what Reset puts back, so a truncated
  //    one restores garbage. Measured as the decoded attribute, not the source.
  const origText = await page.$eval(SEL + ' .mquote', (b) => {
    const d = document.createElement('div'); d.innerHTML = b.dataset.orig || ''; return d.textContent;
  });
  if (origText === SCRIPT) ok('data-orig round-trips to the whole original'); else fail('data-orig is ' + origText.length + ' chars, script is ' + SCRIPT.length);

  // 6. NO LOOSE OVERSIZED GLYPH: the eaten button's bare <svg> escapes
  //    `.mtick svg{width:13px}` and paints a checkmark across the message.
  const wide = await page.$$eval(SEL + ' .m-full svg', (ns) => ns.map((s) => Math.round(s.getBoundingClientRect().width)).filter((w) => w > 40));
  if (wide.length === 0) ok('no svg in the message is wider than 40px'); else fail('loose svg widths: ' + wide.join(', '));

  // 7. THE TICK FEATURE ITSELF IS UNTOUCHED: a real numbered list still boxes.
  await page.click('#thread .msg[data-mid="listy"] .m-preview').catch(() => {});
  await page.waitForTimeout(200);
  const listBoxes = await page.$$eval('#thread .msg[data-mid="listy"] .mtick', (n) => n.length);
  if (listBoxes === 3) ok('a plain numbered list still wears a box per item'); else fail('list boxes: ' + listBoxes);

  // PHOTO: the block as she sees it.
  await page.$eval(SEL + ' .mquote', (n) => n.scrollIntoView()).catch(() => {});
  await page.waitForTimeout(200);
  await page.screenshot({ path: process.env.SHOT || '/tmp/block-ticks.png' }).catch(() => {});
  await browser.close();
  server.close();
  console.log(failed ? failed + ' failed' : 'all passed');
})();
