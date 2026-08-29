#!/usr/bin/env node
// The Shoebox module (shoebox.js) and its page (public/shoebox.html) — the
// WHOLE Shoebox: the polaroid library, the boards, the strings, ▶ Play and
// the constellation finale.
//
// Pure half: the index/caption/search rules and the BOARD DOC's compatibility
// rules (normBoard/fromRaw — the React hook's own shapes, every one it has
// ever had), no network.
//
// Headless half (playwright optional, skips cleanly): the real page against a
// stubbed /api/shoebox — the library's polaroids (undeveloped included),
// pinning from the detail card, string-tying by taps, order numbering, the
// play walk really MOVING the camera, the finale lighting real stars on star
// paper, and every edit reaching POST /board-state debounced.
//
//   node scripts/test-shoebox.js

const fs = require('fs');
const path = require('path');

let pass = 0; const fails = [];
function is(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fails.push(name + '\n    want ' + JSON.stringify(want) + '\n    got  ' + JSON.stringify(got));
}
function ok(name, cond) { is(name, Boolean(cond), true); }

/* ── pure: the library rules ───────────────────────────────────────────── */
const sb = require('../shoebox');
const { parseQuery } = require('../search-grammar');

const ts = (ms) => ({ toMillis: () => ms });

is('caption: all three slots', sb.captionOf({ model: 'gpt-image-2', quality: 'medium', size: '1/9 (4K)' }),
  'gpt-image-2 · medium · 1/9 (4K)');
is('caption: missing size stays out', sb.captionOf({ model: 'gpt-image-2', quality: 'medium' }),
  'gpt-image-2 · medium');
is('caption: nothing filed → empty', sb.captionOf(null), '');

// atMillis: the memory's own timestamp wins (the React app's sort), createdAt
// is the fallback.
is('at: timestamp wins', sb.atMillis({ timestamp: '2026-01-02T00:00:00Z', createdAt: ts(5000) }),
  Date.parse('2026-01-02T00:00:00Z'));
is('at: createdAt fallback', sb.atMillis({ createdAt: ts(5000) }), 5000);
is('at: nothing → 0', sb.atMillis({}), 0);

is('stripHtml: tags and breaks go', sb.stripHtml('a<br>b <i>c</i>'), 'a b c');

// buildIndex: EVERY memory (an undeveloped one has url:''), newest first.
const DOCS = [
  { id: 'w1', data: { title: 'words only', content: '<p>the dream about the well</p>', createdAt: ts(9000) } },
  { id: 'a', data: { title: 'the red dress', createdAt: ts(3000),
    illustration: { url: 'https://x/a.webp', model: 'gpt-image-2', quality: 'medium', size: '2K', prompt: 'a red dress at dusk' } } },
  { id: 'b', data: { title: 'tired mason', createdAt: ts(7000), source: 'playground',
    illustration: { url: 'https://x/b.webp' } } },
];
const idx = sb.buildIndex(DOCS);
is('index: every memory, newest first', idx.map((i) => i.id), ['w1', 'b', 'a']);
is('index: undeveloped has no url and keeps its words', [idx[0].url, idx[0].content],
  ['', 'the dream about the well']);
is('index: the caption rides', idx.find((i) => i.id === 'a').caption, 'gpt-image-2 · medium · 2K');
is('index: promptContent is the stored text', idx.find((i) => i.id === 'a').promptContent, 'a red dress at dusk');

// search: word-start anchoring, AND, OR, minus — and NEVER the url.
const hayA = sb.hayOf(DOCS[1].data, 'a');
const hayB = sb.hayOf(DOCS[2].data, 'b');
ok('search: both words in one memory', sb.matchQ(hayA, parseQuery('red dress')));
ok('search: "red" does not light "tired"', !sb.matchQ(hayB, parseQuery('red')));
ok('search: OR takes either', sb.matchQ(hayB, parseQuery('red OR mason')));
ok('search: -word excludes', !sb.matchQ(hayA, parseQuery('dress -red')));
ok('search: the url is not searchable',
  !sb.matchQ(sb.hayOf({ title: 'plain', illustration: { url: 'https://x/zebra-file.webp' } }, 'z'),
    parseQuery('zebra')));

/* ── pure: the board doc's compatibility rules (the React hook's own) ──── */
const nb = sb.normBoard({});
is('board: defaults are the legacy landscape', [nb.name, nb.w, nb.h, nb.bg, nb.pins, nb.strings],
  ['Board', 2600, 1700, 'cork', [], []]);
is('board: an unknown paper id SURVIVES a round trip', sb.normBoard({ bg: 'velvet' }).bg, 'velvet');
is('board: a bare-array string becomes {ids} (Firestore forbids nested arrays)',
  sb.normBoard({ strings: [['a', 'b']] }).strings, [{ ids: ['a', 'b'] }]);
is('board: a pin without an id is dropped, numbers coerced',
  sb.normBoard({ pins: [{ x: 1 }, { id: 'a', x: '30', y: 'junk', seq: '2' }] }).pins,
  [{ id: 'a', x: 30, y: 20, seq: 2 }]);

const multi = sb.fromRaw({ boards: [{ id: 'b1', name: 'One' }, { id: 'b2', name: 'Two' }], current: 'b2' });
is('fromRaw: multi-board keeps current', multi.current, 'b2');
is('fromRaw: a dead current falls to the first board',
  sb.fromRaw({ boards: [{ id: 'b1' }], current: 'gone' }).current, 'b1');
const legacy = sb.fromRaw({ pins: [{ id: 'a', x: 5, y: 6 }], strings: [['a', 'b']] });
is('fromRaw: the original single-board shape still opens',
  [legacy.boards.length, legacy.boards[0].name, legacy.boards[0].pins.length, legacy.boards[0].strings],
  [1, 'Memories', 1, [{ ids: ['a', 'b'] }]]);
is('fromRaw: nothing at all is one empty legacy board', sb.fromRaw(null).boards[0].name, 'Memories');

/* ── the page, headless ────────────────────────────────────────────────── */
let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* skipped below */ }

function exe() {
  for (const r of ['/opt/pw-browsers']) {
    let kids = [];
    try { kids = fs.readdirSync(r); } catch (e) { continue; }
    for (const k of kids.filter((n) => /^chromium-\d/.test(n))) {
      const p = path.join(r, k, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

async function pageHalf() {
  const http = require('http');
  const servePublic = require('./lib/public-asset');
  const sharp = require('sharp');
  const pix = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#c8b8a0' } }).png().toBuffer();

  const ITEMS = [
    { id: 'a', title: 'the red dress', content: 'she wore it to the reading', url: 'https://storage.googleapis.com/bkt/a.png',
      at: 3000, ts: '', source: 'playground', caption: 'gpt-image-2 · medium · 2K', promptContent: 'a red dress' },
    { id: 'b', title: 'tired mason', content: '', url: 'https://storage.googleapis.com/bkt/b.png',
      at: 2000, ts: '', source: '', caption: '', promptContent: '' },
    { id: 'c', title: 'moon milk', content: '', url: 'https://storage.googleapis.com/bkt/c.png',
      at: 1000, ts: '', source: '', caption: '', promptContent: '' },
    { id: 'd', title: 'a dream with no picture', content: 'the well behind the house', url: '',
      at: 500, ts: '', source: '', caption: '', promptContent: '' },
  ];
  // Star paper + a string already tying a–b: the finale has something to light.
  const BOARD = {
    boards: [{ id: 'b1', name: 'Memories', w: 2600, h: 1700, bg: 'stars',
      pins: [{ id: 'a', x: 120, y: 120, seq: null }, { id: 'b', x: 700, y: 400, seq: null }],
      strings: [{ ids: ['a', 'b'] }] }],
    current: 'b1',
  };
  const posts = [];
  const squares = [];

  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'shoebox.html'), 'utf8');
  const pill = fs.readFileSync(path.join(__dirname, '..', 'public', 'pill-inject.html'), 'utf8');

  ok('page links /feedkit.js', /src="\/feedkit\.js"/.test(html));
  ok('page carries the star paper', /shoebox-papers\/star-paper\.webp/.test(html));
  ok('star paper tile is committed', fs.existsSync(path.join(__dirname, '..', 'public', 'shoebox-papers', 'star-paper.webp')));

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/pix/')) {
      res.writeHead(200, { 'content-type': 'image/png' }); return res.end(pix);
    }
    if (u.pathname === '/api/story/thumb') {
      res.writeHead(200, { 'content-type': 'image/png' }); return res.end(pix);
    }
    if (u.pathname === '/api/shoebox/feed') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ items: ITEMS, total: ITEMS.length, offset: 0, limit: 2000 }));
    }
    if (u.pathname === '/api/shoebox/board-state' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(BOARD));
    }
    if (u.pathname === '/api/shoebox/board-state' && req.method === 'POST') {
      let body = '';
      req.on('data', (d) => { body += d; });
      return req.on('end', () => {
        posts.push(JSON.parse(body || '{}'));
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"ok":true}');
      });
    }
    if (u.pathname === '/api/shoebox/square') {
      let body = '';
      req.on('data', (d) => { body += d; });
      return req.on('end', () => {
        squares.push(JSON.parse(body || '{}'));
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, url: '/crop?set=t1' }));
      });
    }
    if (servePublic(req, res)) return;
    if (u.pathname === '/shoebox' || u.pathname === '/crop') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(u.pathname === '/shoebox' ? html + pill : '<title>crop</title>');
    }
    res.writeHead(204); res.end();
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;

  const executablePath = exe();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  // The board and the detail card load ORIGINALS from the storage host —
  // answer them locally so the fixtures decode.
  await page.route('https://storage.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: pix }));

  await page.goto(base + '/shoebox', { waitUntil: 'networkidle' });
  await page.waitForSelector('.sb-cell', { timeout: 5000 });
  is('no page errors (the pill survives the page and back)', errors, []);

  /* ── the library ── */
  is('Developed shows the three pictures', await page.locator('.sb-cell').count(), 3);
  await page.click('#fAll');
  is('All shows the pictureless memory too', await page.locator('.sb-cell').count(), 4);
  ok('the undeveloped card carries its words', await page.evaluate(() => {
    const u = document.querySelector('.sb-undev span');
    return u && /the well behind the house/.test(u.textContent);
  }));
  ok('a pinned memory wears the pinmark', await page.evaluate(() =>
    Boolean(document.querySelector('.sb-cell[data-id="a"] .sb-pinmark'))));
  // Tiles load the DERIVED copy (the webp rule).
  ok('tiles are derived thumbs', await page.evaluate(() =>
    /api\/story\/thumb/.test(document.querySelector('.sb-cell[data-id="a"] img').getAttribute('src'))));

  /* ── pin from the detail card ── */
  await page.click('.sb-cell[data-id="c"]');
  await page.waitForSelector('#dPin', { timeout: 3000 });
  await page.click('#dPin');
  await page.waitForSelector('.sb-pincard', { timeout: 3000 });
  is('pinning lands her on the board with three pins',
    await page.locator('.sb-pincard').count(), 3);
  ok('the star paper paints the board', await page.evaluate(() =>
    document.getElementById('boardwrap').classList.contains('pp-stars')));
  ok('the strings draw with sag (a quadratic path)', await page.evaluate(() => {
    const p = document.querySelector('.sb-strings path');
    return p && /Q/.test(p.getAttribute('d'));
  }));
  await page.waitForFunction(() => true, null, { timeout: 100 }).catch(() => {});
  await page.waitForTimeout(1000);
  ok('the edit reached POST /board-state (debounced)', posts.length >= 1);
  is('…carrying all three pins', (posts[posts.length - 1].boards[0].pins || []).length, 3);

  /* ── tying a string by taps ── */
  await page.click('#stringbtn');
  await page.click('.sb-pincard[data-id="c"]');
  await page.click('.sb-pincard[data-id="a"]');
  is('tapping c then a ties c into the a–b chain', await page.evaluate(() =>
    document.querySelectorAll('.sb-strings path').length), 2);
  await page.click('#stringbtn');   // done tying
  await page.waitForTimeout(1000);
  const lastStrings = posts[posts.length - 1].boards[0].strings;
  is('the chain saved as one string of three', lastStrings, [{ ids: ['a', 'b', 'c'] }]);

  /* ── ordering ── */
  await page.click('#orderbtn');
  await page.click('.sb-pincard[data-id="c"]');
  is('the tapped card takes number 1', await page.evaluate(() => {
    const s = document.querySelector('.sb-pincard[data-id="c"] .sb-seq');
    return s ? s.textContent : null;
  }), '1');
  await page.click('#orderbtn');

  /* ── play: the camera really glides, and the finale lights ── */
  const t0 = await page.evaluate(() => document.getElementById('cork').style.transform);
  await page.click('#playbtn');
  ok('playing hides the chrome', await page.evaluate(() => document.body.classList.contains('playing')));
  await page.waitForTimeout(1300);
  const t1 = await page.evaluate(() => document.getElementById('cork').style.transform);
  ok('the camera moved to a pin', t1 !== t0 && Boolean(t1));
  // 3 pins → wide, three cards, closing wide → the constellation finale
  await page.waitForSelector('.sb-star', { timeout: 9000 });
  is('the finale lights a four-point star per tied pin',
    await page.locator('.sb-star').count(), 3);
  ok('the strings glow', await page.evaluate(() =>
    Boolean(document.querySelector('.sb-strings g.lit path'))));
  ok('the lit sky holds until she taps out', await page.evaluate(() =>
    document.body.classList.contains('playing')));
  await page.mouse.click(195, 500);
  await page.waitForFunction(() => !document.body.classList.contains('playing'), null, { timeout: 3000 });
  is('tapping out puts the board back', await page.locator('.sb-star').count(), 0);

  /* ── Square it, from the board's own detail card ── */
  await page.click('.sb-pincard[data-id="a"]');
  await page.waitForSelector('#dSquare', { timeout: 3000 });
  await page.click('#dSquare');
  await page.waitForFunction(() => location.pathname === '/crop', null, { timeout: 5000 }).catch(() => {});
  is('Square it POSTed the memory id', squares, [{ id: 'a' }]);

  await browser.close();
  server.close();
}

(async () => {
  if (chromium) await pageHalf();
  else console.log('shoebox page half: skipped (no playwright)');
  if (fails.length) {
    console.error('✗ shoebox: ' + fails.length + ' FAILED, ' + pass + ' passed\n');
    fails.forEach((f) => console.error('  ✗ ' + f + '\n'));
    process.exit(1);
  }
  console.log('✓ shoebox: ' + pass + ' passed');
})().catch((e) => { console.error(e); process.exit(1); });
