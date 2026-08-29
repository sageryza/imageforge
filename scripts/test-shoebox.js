#!/usr/bin/env node
// The Shoebox module (shoebox.js) and its page (public/shoebox.html).
//
// Pure half: the index/caption/search rules, no network — a polaroid is a
// memory WITH a picture, absent caption parts are left out (never guessed),
// search anchors at a word start and never reads the url.
//
// Headless half (playwright optional, skips cleanly): the real page against a
// stubbed /api/shoebox — the shelf really three across, the SHARED lightbox
// (source pin: the page links /asset-lightbox.js and builds none of its own),
// Older appending WITHOUT rebuilding decoded tiles (node identity), search
// reaching the SERVER with q, and the Square-it action POSTing the memory id.
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

/* ── pure ──────────────────────────────────────────────────────────────── */
const sb = require('../shoebox');
const { parseQuery } = require('../search-grammar');

const ts = (ms) => ({ toMillis: () => ms });

// captionOf: what the record honestly carries, joined; absent parts left out.
is('caption: all three slots', sb.captionOf({ model: 'gpt-image-2', quality: 'medium', size: '1/9 (4K)' }),
  'gpt-image-2 · medium · 1/9 (4K)');
is('caption: missing size stays out', sb.captionOf({ model: 'gpt-image-2', quality: 'medium' }),
  'gpt-image-2 · medium');
is('caption: nothing filed → empty', sb.captionOf({}), '');
is('caption: no illustration at all', sb.captionOf(null), '');

// atMillis: createdAt wins, timestamp is the fallback, no invention.
is('at: createdAt', sb.atMillis({ createdAt: ts(5000), timestamp: '2020-01-01T00:00:00Z' }), 5000);
is('at: timestamp fallback', sb.atMillis({ timestamp: '2026-01-02T00:00:00Z' }), Date.parse('2026-01-02T00:00:00Z'));
is('at: nothing → 0', sb.atMillis({}), 0);

// buildIndex: only illustrated memories, newest first.
const DOCS = [
  { id: 'w1', data: { title: 'words only', createdAt: ts(9000) } },
  { id: 'a', data: { title: 'the red dress', createdAt: ts(3000),
    illustration: { url: 'https://x/a.webp', model: 'gpt-image-2', quality: 'medium', size: '2K', prompt: 'a red dress at dusk' } } },
  { id: 'b', data: { title: 'tired mason', createdAt: ts(7000), source: 'playground',
    illustration: { url: 'https://x/b.webp' } } },
  { id: 'c', data: { title: 'moon milk', timestamp: '1970-01-01T00:00:05Z',
    illustration: { url: 'https://x/c.webp' }, hashtags: ['storyroom'] } },
];
const idx = sb.buildIndex(DOCS);
// b (7000) newest, then c (its timestamp parses to 5000ms), then a (3000).
is('index: only polaroids, newest first', idx.map((i) => i.id), ['b', 'c', 'a']);
is('index: item carries the caption', idx.find((i) => i.id === 'a').caption, 'gpt-image-2 · medium · 2K');
is('index: promptContent is the stored text', idx.find((i) => i.id === 'a').promptContent, 'a red dress at dusk');
is('index: source falls back to the first hashtag', idx.find((i) => i.id === 'c').source, 'storyroom');

// search: word-start anchoring, AND, OR, minus — and NEVER the url.
const hayA = sb.hayOf(DOCS[1].data, 'a');
const hayB = sb.hayOf(DOCS[2].data, 'b');
ok('search: both words in one memory', sb.matchQ(hayA, parseQuery('red dress')));
ok('search: "red" does not light "tired"', !sb.matchQ(hayB, parseQuery('red')));
ok('search: OR takes either', sb.matchQ(hayB, parseQuery('red OR mason')));
ok('search: -word excludes', !sb.matchQ(hayA, parseQuery('dress -red')));
ok('search: quoted phrase must sit whole', !sb.matchQ(hayA, parseQuery('"dress red"')));
ok('search: the url is not searchable',
  !sb.matchQ(sb.hayOf({ title: 'plain', illustration: { url: 'https://x/zebra-file.webp' } }, 'z'),
    parseQuery('zebra')));

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
  const pix = await sharp({ create: { width: 40, height: 60, channels: 3, background: '#c8b8a0' } }).png().toBuffer();

  // 70 polaroids so the first page (60) leaves an Older behind it.
  const ALL = [];
  for (let i = 0; i < 70; i++) {
    ALL.push({ id: 'm' + i, title: i === 3 ? 'the red dress' : 'polaroid number ' + i,
      url: 'https://storage.googleapis.com/bkt/p' + i + '.webp', at: 1000000 - i,
      source: 'playground', caption: 'gpt-image-2 · medium · 2K', promptContent: 'words ' + i });
  }
  const feedReqs = [];
  const squares = [];

  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'shoebox.html'), 'utf8');
  const pill = fs.readFileSync(path.join(__dirname, '..', 'public', 'pill-inject.html'), 'utf8');

  // Source pin: the page links the ONE shared lightbox and builds none of its
  // own — a seventh surface joins the sweep by linking it.
  ok('page links /asset-lightbox.js', /src="\/asset-lightbox\.js"/.test(html));
  ok('page defines no lightbox of its own', !/__assetLightbox\s*=/.test(html));
  ok('page links /feedkit.js', /src="\/feedkit\.js"/.test(html));

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/api/shoebox/feed') {
      feedReqs.push(req.url);
      const q = (u.searchParams.get('q') || '').toLowerCase();
      const rows = q ? ALL.filter((r) => r.title.toLowerCase().includes(q)) : ALL;
      const offset = parseInt(u.searchParams.get('offset'), 10) || 0;
      const limit = parseInt(u.searchParams.get('limit'), 10) || 60;
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ items: rows.slice(offset, offset + limit), total: rows.length, offset, limit }));
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
    if (u.pathname === '/api/story/thumb') {
      res.writeHead(200, { 'content-type': 'image/png' }); return res.end(pix);
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

  await page.goto(base + '/shoebox', { waitUntil: 'networkidle' });
  await page.waitForSelector('.pol', { timeout: 5000 });
  is('no page errors (the pill survives the page and back)', errors, []);

  is('first page holds 60 polaroids', await page.locator('.pol').count(), 60);
  // Three across, MEASURED — a wrong repeat() renders plausible markup.
  const tops = await page.evaluate(() =>
    [...document.querySelectorAll('.pol')].slice(0, 4).map((p) => Math.round(p.getBoundingClientRect().top)));
  ok('three share the first row', tops[0] === tops[1] && tops[1] === tops[2]);
  ok('the fourth starts a new row', tops[3] > tops[0]);
  // The tile loads the DERIVED copy, never the original (the webp rule).
  const tileSrc = await page.getAttribute('.pol img', 'src');
  ok('tile is a derived thumb', /\/api\/story\/thumb\?/.test(tileSrc || ''));

  // Older APPENDS — the decoded tiles keep their nodes (the repaint rule).
  await page.evaluate(() => { window.__firstPol = document.querySelector('.pol'); });
  await page.click('#older');
  await page.waitForFunction(() => document.querySelectorAll('.pol').length === 70);
  ok('Older kept the first tile\'s node', await page.evaluate(() =>
    window.__firstPol === document.querySelector('.pol')));
  ok('Older gone once everything is on screen', await page.evaluate(() =>
    document.getElementById('foot').hidden));

  // A tap opens the SHARED lightbox on the ORIGINAL picture.
  await page.click('.pol');
  await page.waitForSelector('#clightbox', { timeout: 5000 });
  const lbSrc = await page.evaluate(() => {
    const img = document.querySelector('#clightbox img');
    return img ? img.src : '';
  });
  ok('lightbox shows the original url', /storage\.googleapis\.com\/bkt\/p0\.webp/.test(lbSrc));
  // …and the Square-it action POSTs the memory id, nothing more.
  const sq = await page.$('#clightbox [aria-label="Square it"]');
  ok('Square it rides the actions row', Boolean(sq));
  if (sq) {
    await sq.click();
    await page.waitForFunction(() => location.pathname === '/crop', { timeout: 5000 }).catch(() => {});
    is('square POSTed the memory id', squares, [{ id: 'm0' }]);
  }

  // Search asks the SERVER over the full index, never just the loaded page.
  await page.goto(base + '/shoebox', { waitUntil: 'networkidle' });
  await page.fill('#q', 'red dress');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('.pol').length === 1, { timeout: 5000 });
  ok('the query reached the server', feedReqs.some((r) => /q=red%20dress/.test(r)));
  is('one polaroid matches', await page.locator('.pol').count(), 1);
  ok('the clear ✕ shows only while there are words', await page.evaluate(() =>
    !document.getElementById('clr').hidden));
  await page.click('#clr');
  await page.waitForFunction(() => document.querySelectorAll('.pol').length === 60, { timeout: 5000 });
  ok('clearing restores the shelf', true);

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
