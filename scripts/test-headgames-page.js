#!/usr/bin/env node
// The Head Games page, driven for real in headless Chromium against a stubbed
// /api/chatfeed/verdict — no server, no Firestore, no network. Every check is
// a MEASUREMENT or a reading of what the stub really received, because each
// of these looks fine in the markup and can be wrong on screen:
//   • the page survives the injected autoscroll pill (the IIFE rule) and
//     throws nothing
//   • the hub is five icons THREE to a row, measured off the real cells
//   • each icon opens its game and the back chevron walks back to the hub
//   • the scale: a reason added with a weight lands on the verdict doc as
//     JSON; tapping it on turns the beam (the beam's endpoints measured), and
//     the line names the block that tipped it
//   • the jars: a jar shut, the count, the lid off with an answer
//   • the train: a car coupled, the station reached, the route station-first
//   • the tower: a block pulled, "does it still stand?", No → load-bearing
//   • luggage tags: two tags under one name, grouped and counted, the name
//     chip filling the box
//   • state is re-read from the doc on a fresh open (nothing lives on the page)
//   • nothing under the pill's corner on the title row
//
// Playwright is optional — this skips cleanly without it.
//
//   node scripts/test-headgames-page.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');
const { build } = require('./headgames-page');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('headgames page: skipped (no playwright)'); process.exit(0); }

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

let pass = 0; const fails = [];
function is(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fails.push(name + '\n    want ' + JSON.stringify(want) + '\n    got  ' + JSON.stringify(got));
}
function ok(name, cond) { is(name, Boolean(cond), true); }

(async () => {
  // the stub store: one doc per chat__sheet, texts keyed by item — exactly
  // what /api/chatfeed/verdict keeps
  const docs = {};
  const writes = [];
  const html = build();
  const pill = fs.readFileSync(path.join(__dirname, '..', 'public', 'pill-inject.html'), 'utf8');

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const u = url.pathname;
    if (servePublic(req, res)) return;
    if (u === '/api/chatfeed/verdict' && req.method === 'GET') {
      const id = url.searchParams.get('chat') + '__' + url.searchParams.get('sheet');
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, items: {}, texts: (docs[id] || {}), at: '' }));
    }
    if (u === '/api/chatfeed/verdict' && req.method === 'POST') {
      let body = '';
      req.on('data', (d) => { body += d; });
      return req.on('end', () => {
        const b = JSON.parse(body || '{}');
        const id = b.chat + '__' + b.sheet;
        docs[id] = docs[id] || {};
        if (b.text !== undefined) docs[id][String(b.item)] = String(b.text).slice(0, 2000);
        writes.push(b);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"ok":true}');
      });
    }
    if (u === '/page') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(html + pill);
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

  await page.goto(base + '/page', { waitUntil: 'networkidle' });
  is('no page errors', errors, []);

  /* ── the hub ─────────────────────────────────────────────────────────── */
  const tiles = await page.$$eval('#hub .tile', (els) => els.map((e) => {
    const r = e.getBoundingClientRect(); return { g: e.dataset.g, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) };
  }));
  is('five games', tiles.map((t) => t.g), ['scale', 'jar', 'train', 'tower', 'tag']);
  const rows = new Set(tiles.map((t) => t.y));
  is('three to a row (two rows, three on the first)', [rows.size, tiles.filter((t) => t.y === tiles[0].y).length], [2, 3]);
  ok('every icon draws (an svg with real size)', await page.$$eval('#hub .tile .ic svg', (els) => els.every((s) => s.getBoundingClientRect().width > 20)));
  ok('the "?" rides on the title', await page.$('h1 .cmp-help'));
  // the title row stops before the pill's column
  const hdRight = await page.$eval('.hd', (e) => e.getBoundingClientRect().right - parseFloat(getComputedStyle(e).paddingRight));
  ok('the title row reserves the pill column (content ends before x=326)', hdRight <= 326);
  ok('no back chevron on the hub', await page.$eval('#back', (e) => e.hidden));

  /* ── the scale ───────────────────────────────────────────────────────── */
  await page.click('#hub .tile[data-g="scale"]');
  await page.waitForSelector('#v-scale:not([hidden])');
  is('the title is the game', await page.$eval('#title', (e) => e.textContent), 'The scale');
  ok('the back chevron shows', await page.$eval('#back', (e) => !e.hidden));
  await page.click('#scale-list .lnew');
  await page.waitForSelector('#sheet:not([hidden])');
  await page.fill('#nf', 'move to Portland');
  await page.click('#ngo');
  await page.waitForSelector('#scale-one:not([hidden])');
  const scaleId = Object.keys(docs['mental-games-instrumental-beliefs__hg-scale'] || {})[0];
  ok('the decision is on the verdict doc', scaleId && scaleId[0] === 's');

  // a FOR reason weighing 3, an AGAINST weighing 4 — the weights chosen
  // before the scale ever moves
  await page.fill('#rtext', 'closer to mom');
  await page.click('#rw button[data-w="3"]');
  await page.click('#radd');
  await page.click('#rside button[data-s="con"]');
  await page.fill('#rtext', 'no friends there');
  await page.click('#rw button[data-w="4"]');
  await page.click('#radd');
  await page.waitForFunction(() => document.querySelectorAll('.rz').length === 2);
  const stored = JSON.parse(docs['mental-games-instrumental-beliefs__hg-scale'][scaleId]);
  is('both reasons stored with their weights', [stored.pros, stored.cons], [[{ text: 'closer to mom', w: 3 }], [{ text: 'no friends there', w: 4 }]]);
  is('the scale line is empty until something is placed', await page.$eval('#scale-line', (e) => e.textContent), '');

  const beam = async () => page.$eval('#scalesvg .beam', (l) => ({ y1: +l.getAttribute('y1'), y2: +l.getAttribute('y2') }));
  const level = await beam();
  is('level beam before a tap', Math.round(level.y1 - level.y2), 0);
  await page.click('#pros .rz');
  await page.waitForTimeout(700);
  const tipped = await beam();
  ok('tapping a FOR reason on drops the left end (beam turned)', tipped.y1 - tipped.y2 > 8);
  is('three blocks drawn on the FOR pan', await page.$$eval('#scalesvg .bk.pro', (els) => els.length), 3);
  await page.click('#cons .rz');
  await page.waitForTimeout(700);
  const tipped2 = await beam();
  ok('then the AGAINST reason drops the right end', tipped2.y2 - tipped2.y1 > 2);
  ok('the line names the block that tipped it', /Tipped against on: no friends there\. 3 for, 4 against\./.test(await page.$eval('#scale-line', (e) => e.textContent)));
  ok('the deciding reason is marked', await page.$('#cons .rz.decided'));
  const stored2 = JSON.parse(docs['mental-games-instrumental-beliefs__hg-scale'][scaleId]);
  is('the placing order is on the doc', stored2.placed, [{ side: 'pro', i: 0 }, { side: 'con', i: 0 }]);
  await page.click('#back');
  await page.waitForSelector('#scale-list:not([hidden])');
  ok('the list row says how it tipped', /tipped against · 3 for, 4 against/.test(await page.$eval('#scale-list .lrow small', (e) => e.textContent)));
  await page.click('#back');
  await page.waitForSelector('#v-hub:not([hidden])');

  /* ── the jars ────────────────────────────────────────────────────────── */
  await page.click('#hub .tile[data-g="jar"]');
  await page.waitForSelector('#v-jar:not([hidden])');
  await page.click('#jar-add');
  await page.fill('#nf', 'why do cats purr');
  await page.click('#ngo');
  await page.waitForSelector('#jars .jar');
  is('one jar, shut', [await page.$$eval('#jars .jar', (e) => e.length), await page.$eval('#jar-count', (e) => e.textContent)], [1, '1 shut · longest 0d']);
  ok('the lid is on', !(await page.$('#jars .jar.open')));
  await page.click('#jars .jar');
  await page.waitForSelector('#jans');
  await page.fill('#jans', 'they can, it is not only happiness');
  await page.click('#jopen');
  await page.waitForSelector('#jars .jar.open');
  const jarDoc = docs['mental-games-instrumental-beliefs__hg-jar'];
  const jar = JSON.parse(jarDoc[Object.keys(jarDoc)[0]]);
  ok('the lid came off with the answer on the doc', jar.openedAt > 0 && jar.answer === 'they can, it is not only happiness');
  is('count says none shut', await page.$eval('#jar-count', (e) => e.textContent), '0 shut');
  await page.click('#back');

  /* ── the train ───────────────────────────────────────────────────────── */
  await page.click('#hub .tile[data-g="train"]');
  await page.waitForSelector('#v-train:not([hidden])');
  await page.click('#train-list .lnew');
  await page.fill('#nf', 'the electric bill');
  await page.click('#ngo');
  await page.waitForSelector('#train-one:not([hidden])');
  await page.fill('#ctext', 'the ferry');
  await page.click('#cadd');
  await page.waitForFunction(() => document.querySelectorAll('.car').length === 2);
  is('two cars, the earlier thought on top', await page.$$eval('.car', (els) => els.map((e) => e.textContent)), ['the ferry', 'the electric bill']);
  await page.fill('#ctext', 'her postcard');
  await page.click('#cstation');
  await page.waitForSelector('.station');
  is('the station is reached with the last words as the first car', await page.$$eval('.car', (els) => els.map((e) => e.textContent.trim())), ['her postcard', 'the ferry', 'the electric bill']);
  ok('the add box is gone at the station', await page.$eval('#train-add', (e) => e.hidden));
  ok('the line reads the route', /3 cars from "her postcard" to "the electric bill"\./.test(await page.$eval('#train-line', (e) => e.textContent)));
  await page.click('#back'); await page.click('#back');

  /* ── the tower ───────────────────────────────────────────────────────── */
  await page.click('#hub .tile[data-g="tower"]');
  await page.waitForSelector('#v-tower:not([hidden])');
  await page.click('#tower-list .lnew');
  await page.fill('#nf', 'I am bad at math');
  await page.click('#ngo');
  await page.waitForSelector('#tower-one:not([hidden])');
  await page.fill('#btext', 'she said so in 4th grade'); await page.click('#badd');
  await page.fill('#btext', 'I hated the homework'); await page.click('#badd');
  await page.waitForFunction(() => document.querySelectorAll('#tower .blk').length === 2);
  const stack = await page.$$eval('#tower .blk', (els) => els.map((e) => ({ t: e.textContent, y: Math.round(e.getBoundingClientRect().top) })));
  ok('the first block is the foundation (drawn below the second)', stack[0].y > stack[1].y);
  await page.click('#tower .blk[data-i="0"]');
  await page.waitForSelector('#ask');
  await page.waitForTimeout(400);
  const slid = await page.$$eval('#tower .blk', (els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
  ok('the pulled block slides out (its left edge past the others)', slid[0] > slid[1] + 30);
  ok('…and stays on the phone', await page.$eval('#tower .blk[data-i="0"]', (e) => e.getBoundingClientRect().right <= 390));
  ok('the page never scrolls sideways', await page.evaluate(() => document.documentElement.scrollWidth <= 390));
  await page.click('#ask button[data-a="0"]');
  await page.waitForSelector('#tower .blk.load');
  ok('No → load-bearing on the line', /Load-bearing: she said so in 4th grade\./.test(await page.$eval('#tower-line', (e) => e.textContent)));
  const towerDoc = docs['mental-games-instrumental-beliefs__hg-tower'];
  const tower = JSON.parse(towerDoc[Object.keys(towerDoc)[0]]);
  is('the answer is on the doc', [tower.blocks[0].pulled, tower.blocks[0].stood, tower.blocks[1].stood], [true, false, null]);
  await page.click('#back'); await page.click('#back');

  /* ── luggage tags ────────────────────────────────────────────────────── */
  await page.click('#hub .tile[data-g="tag"]');
  await page.waitForSelector('#v-tag:not([hidden])');
  await page.fill('#otext', 'oat milk is fine'); await page.fill('#ftext', 'Mom'); await page.click('#tadd');
  await page.waitForSelector('#tagwall .tag');
  await page.fill('#otext', 'never buy a boat'); await page.fill('#ftext', 'dad'); await page.click('#tadd');
  await page.waitForFunction(() => document.querySelectorAll('#tagwall .tag').length === 2);
  await page.fill('#otext', 'cities are loud');
  await page.click('#names button[data-n="Mom"]');
  is('a name chip fills the box with her own word', await page.$eval('#ftext', (e) => e.value), 'Mom');
  await page.click('#tadd');
  await page.waitForFunction(() => document.querySelectorAll('#tagwall .tag').length === 3);
  is('grouped under who, most first', await page.$$eval('#tagwall .who', (els) => els.map((e) => e.querySelector('h2').textContent + ' ' + e.querySelector('small').textContent)), ['Mom 2', 'dad 1']);
  ok('the line counts', /3 tags, 2 names\. 2 carry Mom\./.test(await page.$eval('#tag-line', (e) => e.textContent)));
  await page.click('#back');

  /* ── nothing lives on the page ───────────────────────────────────────── */
  await page.goto(base + '/page', { waitUntil: 'networkidle' });
  await page.click('#hub .tile[data-g="tag"]');
  await page.waitForSelector('#tagwall .tag');
  is('a fresh open re-reads the tags from the doc', await page.$$eval('#tagwall .tag', (e) => e.length), 3);
  await page.click('#back');
  await page.click('#hub .tile[data-g="scale"]');
  await page.waitForSelector('#scale-list .lrow');
  await page.click('#scale-list .lrow');
  await page.waitForSelector('#scale-one:not([hidden])');
  await page.waitForTimeout(650);
  const again = await beam();
  ok('the reopened scale sits at its tipped angle', again.y2 - again.y1 > 2);
  is('no page errors across the whole walk', errors, []);
  ok('every write went to the verdict route with a text and no vote', writes.every((w) => w.text !== undefined && w.ok === undefined && /^hg-/.test(w.sheet)));

  await browser.close();
  server.close();
  console.log(`headgames page: ${pass} ok, ${fails.length} failed`);
  for (const f of fails) console.log('FAIL ' + f);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
