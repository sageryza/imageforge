#!/usr/bin/env node
// The Squaring page (public/crop.html), driven for real in headless Chromium
// against a stubbed /api/crop — no server, no Firestore, no network.
//
// Everything here is a MEASUREMENT, because every one of these can look fine
// in the markup and be wrong on screen:
//   • the page's script survives the injected autoscroll pill (the IIFE rule)
//   • the pill wears THIS page's paper, not its own baked palette
//   • the arrows really MOVE the crop, and the dim bands really move with it —
//     the boxes' own rects, not a variable read back to itself
//   • the kept square is the same square cropper.js would cut (the pin lives
//     in test-cropper.js; here it is checked against the DRAWN picture)
//   • the crop cannot walk off either end of the picture however hard she taps
//   • a tap saves ONE position, and a hold saves ONE too (debounced) — an
//     arrow tap must never be a write per frame
//   • a SQUARE picture disables the arrows instead of leaving dead controls
//   • the page never scrolls, and nothing runs under the pill's corner
//
// Playwright is optional — this skips cleanly without it.
//
//   node scripts/test-crop-page.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('crop page: skipped (no playwright)'); process.exit(0); }

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
function near(name, got, want, tol) {
  if (Math.abs(got - want) <= tol) { pass++; return; }
  fails.push(name + '\n    want ' + want + ' ±' + tol + '\n    got  ' + got);
}

// Real encoded pictures, so naturalWidth/Height are real: a 2:3 portrait, a
// 3:2 landscape and a square. A 1x1 placeholder would put every overlay box at
// the same place and the measurements below would all pass vacuously.
const sharp = require('sharp');
async function png(w, h, rgb) {
  return sharp({ create: { width: w, height: h, channels: 3, background: rgb } }).png().toBuffer();
}

const SET = {
  id: 'set1', title: 'Shirt envelope',
  items: [
    { key: 'a', url: '/pix/tall.png', label: 'the shirt in the thought bubble', pos: 0.5, out: '', outPos: null },
    { key: 'b', url: '/pix/wide.png', label: 'the dinner table', pos: 0.5, out: '', outPos: null },
    { key: 'c', url: '/pix/square.png', label: 'already square', pos: 0.5, out: 'https://x/c.webp', outPos: 0.5 },
  ],
};

(async () => {
  const pix = {
    '/pix/tall.png': await png(400, 600, '#c8b8a0'),
    '/pix/wide.png': await png(600, 400, '#a0b8c8'),
    '/pix/square.png': await png(400, 400, '#b8c8a0'),
  };
  const posts = [];
  const saves = [];
  let jobPolls = 0;

  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'crop.html'), 'utf8');
  const pill = fs.readFileSync(path.join(__dirname, '..', 'public', 'pill-inject.html'), 'utf8');

  // A real http server rather than page.route, so servePublic answers every
  // shared file the page links exactly as express.static does.
  const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (pix[u]) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(pix[u]); }
    if (servePublic(req, res)) return;
    if (u === '/api/crop/sets/set1') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(SET));
    }
    if (u === '/api/crop/sets/set1/pos') {
      let body = '';
      req.on('data', (d) => { body += d; });
      return req.on('end', () => {
        posts.push(JSON.parse(body || '{}'));
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"ok":true}');
      });
    }
    if (u === '/api/crop/sets/set1/save') {
      saves.push(1);
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end('{"ok":true,"job":{"status":"running","done":0,"total":2}}');
    }
    if (u === '/api/crop/sets/set1/job') {
      jobPolls++;
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({
        job: { status: jobPolls < 2 ? 'running' : 'done', done: 2, total: 2, failed: 0 },
        items: SET.items.map((it) => ({ key: it.key, out: 'https://x/' + it.key + '.webp', outPos: it.pos })),
      }));
    }
    if (u === '/crop') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(html.replace('__STUDIO_TOKEN__', '') + pill);
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

  await page.goto(base + '/crop?set=set1', { waitUntil: 'networkidle' });
  await page.waitForSelector('#frame:not([hidden])', { timeout: 5000 });
  await page.waitForFunction(() => document.getElementById('pic').naturalWidth > 0);

  is('no page errors', errors, []);

  /* ── the pill ──────────────────────────────────────────────────────────
     The real route serves this page WITHOUT one (it is one screen and never
     scrolls). It is injected here anyway, because the thing worth pinning is
     that the page SURVIVES one — a page-level `let` sharing a pill global is
     a parse error that takes the whole pill script down, and that must stay
     true if /crop ever grows a scroll. With nothing to scroll the pill hides
     itself, which is its own conditional rule working. */
  const pillShown = await page.evaluate(() => {
    const f = document.querySelector('.float');
    return Boolean(f && f.getBoundingClientRect().height > 0);
  });
  is('the pill hides itself with nothing to scroll', pillShown, false);
  const pillBg = await page.$eval('.vseg', (el) => getComputedStyle(el).backgroundColor);
  const paper = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  is("and would wear the page's paper if it showed", pillBg, paper);

  // Wait for the OVERLAY to agree with the picture, not merely for the picture
  // to have loaded. `load` fires before layout has re-flowed the img to a new
  // intrinsic size, so the page paints again on the next frame — measuring
  // between those two reads the previous picture's box.
  const settled = (w) => page.waitForFunction((want) => {
    const img = document.getElementById('pic');
    if (img.naturalWidth !== want) return false;
    const k = document.getElementById('keep');
    if (k.hidden) return img.naturalWidth === img.naturalHeight;
    const kr = k.getBoundingClientRect();
    return Math.abs(kr.width - kr.height) < 2
      && Math.abs(kr.width - Math.min(img.clientWidth, img.clientHeight)) < 2;
  }, w, { timeout: 5000 });

  /* ── the overlay is the crop ── */
  const rects = () => page.evaluate(() => {
    const r = (id) => {
      const el = document.getElementById(id);
      if (!el || el.hidden) return null;
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    };
    return { pic: r('pic'), keep: r('keep'), a: r('bandA'), b: r('bandB') };
  });

  let R = await rects();
  ok('the picture is drawn', R.pic && R.pic.w > 0);
  near('the kept box is square', R.keep.w, R.keep.h, 2);
  near('a 2:3 keeps the full width', R.keep.w, R.pic.w, 2);
  near('centred to start', R.keep.y - R.pic.y, (R.pic.h - R.keep.h) / 2, 2);
  near('the two bands fill exactly what is cut',
    R.a.h + R.b.h + R.keep.h, R.pic.h, 3);

  // ▲ moves the square UP the picture — she is choosing to keep more of the top
  const before = R.keep.y;
  await page.click('#up');
  R = await rects();
  ok('▲ moves the crop up', R.keep.y < before);
  near('and the top band shrinks by the same amount', R.a.h, R.keep.y - R.pic.y, 2);

  await page.click('#down'); await page.click('#down');
  R = await rects();
  ok('▼ moves it back down past where it was', R.keep.y > before);

  /* ── it cannot walk off the picture ── */
  for (let i = 0; i < 40; i++) await page.click('#up');
  R = await rects();
  near('flush with the top and no further', R.keep.y, R.pic.y, 2);
  is('the top band is gone at the end', R.a.h, 0);
  for (let i = 0; i < 60; i++) await page.click('#down');
  R = await rects();
  near('flush with the bottom and no further', R.keep.y + R.keep.h, R.pic.y + R.pic.h, 2);

  /* ── the drawn square is the square the server would cut ── */
  const agree = await page.evaluate(() => {
    const img = document.getElementById('pic');
    const b = window.__cropBox(img.naturalWidth, img.naturalHeight, 1);
    const pr = img.getBoundingClientRect(), kr = document.getElementById('keep').getBoundingClientRect();
    return {
      x: Math.abs((kr.x - pr.x) / pr.width - b.x),
      y: Math.abs((kr.y - pr.y) / pr.height - b.y),
      w: Math.abs(kr.width / pr.width - b.w),
    };
  });
  ok('what is drawn is what cropBox says', agree.x < 0.01 && agree.y < 0.01 && agree.w < 0.01);

  /* ── one tap is one write, and a hold is still one ── */
  posts.length = 0;
  await page.click('#up');
  await page.waitForTimeout(700);
  is('a tap saves exactly one position', posts.length, 1);
  is('and it saves THIS picture', posts[0].key, 'a');

  posts.length = 0;
  await page.mouse.move(...await page.$eval('#down', (el) => {
    const b = el.getBoundingClientRect();
    return [b.x + b.width / 2, b.y + b.height / 2];
  }));
  await page.mouse.down();
  await page.waitForTimeout(900);          // well past HOLD_AFTER, many repeats
  await page.mouse.up();
  await page.waitForTimeout(700);
  is('a hold is debounced to one write too', posts.length, 1);
  ok('and the hold really moved it several steps',
    Math.abs(posts[0].pos - 0.5) > 0.1);

  /* ── a landscape picture turns the arrows sideways ── */
  await page.click('#next');
  await settled(600);
  R = await rects();
  near('a 3:2 keeps the full height', R.keep.h, R.pic.h, 2);
  near('and is square', R.keep.w, R.keep.h, 2);
  const beforeX = R.keep.x;
  await page.click('#up');
  R = await rects();
  ok('the left arrow moves the crop left', R.keep.x < beforeX);
  is('the arrow says left, not up', await page.$eval('#up', (el) => el.getAttribute('aria-label')),
    'Move the crop left');

  /* ── a square picture has nowhere to go ── */
  await page.click('#next');
  await settled(400);
  is('the arrows go dead on a square picture',
    await page.evaluate(() => [document.getElementById('up').disabled, document.getElementById('down').disabled]),
    [true, true]);
  is('and nothing is dimmed', await page.evaluate(() => document.getElementById('bandA').hidden), true);

  /* ── the strip ── */
  is('every picture is on the strip', await page.$$eval('.strip button', (b) => b.length), 3);
  await page.click('.strip button:nth-child(1)');
  await settled(400);
  await page.waitForFunction(() => document.getElementById('pic').naturalHeight === 600);
  is('tapping a thumb jumps to it', await page.$eval('#count', (el) => el.textContent), '1 / 3');
  is('and her words for it are on screen',
    await page.$eval('#cap', (el) => el.textContent), 'the shirt in the thought bubble');

  /* ── saving ── */
  ok('the save button shows once something is uncut', await page.$eval('#save', (el) => !el.hidden));
  await page.click('#save');
  await page.waitForFunction(() => /saved|didn/.test(document.getElementById('msg').textContent), { timeout: 6000 });
  is('one save starts one job', saves.length, 1);
  is('and it reports finishing', await page.$eval('#msg', (el) => el.textContent), 'saved');

  /* ── the shape of the page ── */
  const scrolls = await page.evaluate(() => ({
    y: document.documentElement.scrollHeight > window.innerHeight + 1,
    x: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
  is('one screen — it never scrolls', scrolls, { y: false, x: false });

  // Every control she has to reach is really reachable — asked with
  // elementFromPoint, which is the only honest form of this question (a
  // covered button passes every width and visibility assertion).
  const reach = await page.evaluate(() => {
    const out = {};
    ['up', 'down', 'prev', 'next', 'help', 'save'].forEach((id) => {
      const el = document.getElementById(id);
      const b = el.getBoundingClientRect();
      const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      out[id] = Boolean(hit && (hit === el || el.contains(hit)));
    });
    return out;
  });
  is('every control takes its own tap', reach,
    { up: true, down: true, prev: true, next: true, help: true, save: true });

  await browser.close();
  server.close();

  fails.forEach((f) => console.error('  ✗ ' + f));
  console.log((fails.length ? '✗' : '✓') + ' crop page: ' + pass + ' passed'
    + (fails.length ? ', ' + fails.length + ' FAILED' : ''));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
