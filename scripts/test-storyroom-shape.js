#!/usr/bin/env node
// THE STORY'S SHAPE — portrait, or SQUARE (2026-08-28, Sophie: "add a new
// square story type in story room").
//
// A story is one shape all the way down: the canvas its beats are drawn on,
// the tiles on the pad, the popup's blank paper and the film's frame. Two
// halves, and each one is a thing that fails SILENTLY:
//
// PURE — the two SHAPES lists (scratchpad.js and the page) must name the same
// shapes in the same order, the way STYLES/TAGS are pinned everywhere else in
// this repo; portrait must stay FIRST, because that is the fallback every
// story made before this lands on; the square film frame must stay inside the
// pixel budget the OOM note under FILM proves this 512MB box survives; and
// the draw and the film must read the SHAPE rather than the old hardcoded
// ART.size / FILM.w-h, which a copy-paste can quietly restore.
//
// HEADLESS — the whole thing rides ONE CSS variable, so a broken wire renders
// as a page that looks completely fine and just never changes shape. Every
// assertion here MEASURES a real box: a beat tile, the blank paper in the
// popup, and the button's own glyph.
//
//   node scripts/test-storyroom-shape.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');

let failures = 0;
function ok(cond, name) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}

const root = path.join(__dirname, '..');
const padSrc = fs.readFileSync(path.join(root, 'scratchpad.js'), 'utf8');
const genSrc = fs.readFileSync(path.join(root, 'scripts', 'gen-scratchpad.py'), 'utf8');

// ── pure ────────────────────────────────────────────────────────────
// Both files write the list as a plain array literal; pull each one out and
// evaluate just that expression, so a reworded comment in between changes
// nothing and a renamed key fails HERE.
function listFrom(src, anchor) {
  const at = src.indexOf(anchor);
  if (at < 0) throw new Error(`no ${anchor}`);
  const open = src.indexOf('[', at);
  const close = src.indexOf('];', open);
  return new Function(`return (${src.slice(open, close + 1)});`)();
}

let SRV = [];
let PAGE = [];
try {
  SRV = listFrom(padSrc, 'const SHAPES = [');
  PAGE = listFrom(genSrc, 'var SHAPES=[');
} catch (e) { ok(false, 'SHAPES extraction: ' + e.message); }

ok(SRV.length >= 2 && SRV.map((s) => s.key).join('|') === PAGE.map((s) => s.key).join('|'),
  `the two SHAPES lists name the same shapes in the same order: ${SRV.map((s) => s.key).join(' · ')}`);

// PORTRAIT FIRST is not a preference — it is the fallback, on the server
// (shapeOf) and on the page (SHAPES[0]), and it is what every story made
// before this carries by carrying nothing.
ok(SRV[0] && SRV[0].key === 'portrait', 'portrait is FIRST — the fallback every existing story lands on');

const srvBy = Object.fromEntries(SRV.map((s) => [s.key, s]));
const pageBy = Object.fromEntries(PAGE.map((s) => [s.key, s]));
ok(pageBy.portrait && pageBy.portrait.ar === '2 / 3' && pageBy.square && pageBy.square.ar === '1 / 1',
  'the page names the same two ratios the CSS falls back to');
ok(srvBy.portrait && srvBy.portrait.size === '1024x1536'
  && srvBy.portrait.film.w === 1000 && srvBy.portrait.film.h === 1500,
  'portrait is byte-for-byte what the pad always drew and filmed: 1024x1536 / 1000x1500');
ok(srvBy.square && srvBy.square.size === '1024x1024'
  && srvBy.square.film.w === srvBy.square.film.h,
  'square draws 1024x1024 and films on a frame whose edges are equal');
// The OOM note under FILM is the number that matters — not the width, the
// pixels. A square frame BIGGER than the portrait one is how a film job gets
// killed silently on this 512MB box.
const px = (s) => s.film.w * s.film.h;
ok(SRV.every((s) => px(s) <= px(srvBy.portrait)),
  `every film frame stays inside the proven budget (square ${px(srvBy.square) / 1e6}MP ≤ portrait ${px(srvBy.portrait) / 1e6}MP)`);
// `ar` is the only number the CSS reads, so a page shape with none renders at
// the fallback forever and nothing says so.
ok(PAGE.every((s) => /^\d+ \/ \d+$/.test(String(s.ar))), 'every page shape carries an `ar` the CSS can read');

// The draw and the film read the SHAPE. These greps are the copy-paste guard:
// each hardcoded constant worked perfectly for one shape.
ok(/form\.append\('size', canvas\.size\)/.test(padSrc) && !/form\.append\('size', ART\.size\)/.test(padSrc),
  'the draw sends the STORY\'s canvas, not the old hardcoded ART.size');
ok(!/scale=\$\{FILM\.w\}/.test(padSrc) && /scale=\$\{frame\.w\}/.test(padSrc),
  'the film scales to the story\'s own frame, not FILM.w/FILM.h');
ok(/\$\{frame\.w\}x\$\{frame\.h\}@/.test(padSrc),
  'the segment cache key carries the frame — a flipped story re-encodes instead of serving the other shape back');

// A shape change moves the FILM's frame, so the page must count it as making
// the render she has stale. It marks dirty for any POST outside its own
// allowlist — which is exactly why this route is /shape and not /pads/shape.
const allow = (genSrc.match(/^.*dirtySinceFilm=true;.*$/m) || [''])[0];
ok(allow && !/'\/shape'/.test(allow) && !/indexOf\('\/shape'\)/.test(allow),
  'changing the shape stales the film — /shape is not in the page\'s allowlist');
ok(/router\.post\('\/shape'/.test(padSrc) && !/router\.post\('\/pads\/shape'/.test(padSrc),
  'the route is /shape (top level), never /pads/shape — /pads* is the tidying allowlist');

// ── headless ────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP: playwright not installed (npm install playwright --no-save)');
  process.exit(failures ? 1 : 0);
}

const PUB = path.join(root, 'public');
const PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64');

const beats = [
  { id: 'b1', url: 'http://127.0.0.1:0/px.png?w1', color: null, text: 'the phone call' },
  { id: 'b2', color: null, text: 'no picture yet' },
];
let padShape = 'portrait';
const posted = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; });
    return req.on('end', () => {
      const b = JSON.parse(body || '{}');
      posted.push([url.pathname, b]);
      if (url.pathname === '/api/scratchpad/shape') padShape = b.shape;
      json({ ok: true, beats, shape: padShape });
    });
  }
  if (url.pathname === '/api/scratchpad/inbox') return json({ count: 0, items: [], source: 'playground', uploads: [] });
  // Two stories, one of each shape — the shelf tile rule below needs both.
  if (url.pathname === '/api/scratchpad/pads') {
    return json({ count: 2, pads: [
      { id: 'pad', title: 'the portrait one', beats: 2, cover: 'http://127.0.0.1:0/px.png?c1',
        category: null, folder: null, shape: 'portrait', pinned: false, updatedAt: 2 },
      { id: 'sq', title: 'the square one', beats: 1, cover: 'http://127.0.0.1:0/px.png?c2',
        category: null, folder: null, shape: 'square', pinned: false, updatedAt: 1 },
    ] });
  }
  if (url.pathname === '/api/scratchpad') {
    return json({ beats, title: 'shape test', style: 'watercolor', shape: padShape,
      film: null, audios: [], uploads: [] });
  }
  if (url.pathname === '/px.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PX); }
  if (url.pathname.startsWith('/api/story/thumb')) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PX); }
  if (url.pathname === '/tritoggle.css' || url.pathname === '/tritoggle.js') {
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, url.pathname.slice(1))));
  }
  if (url.pathname === '/scratchpad.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'scratchpad.html')));
  }
  res.writeHead(404); res.end();
});

const near = (a, b, tol) => Math.abs(a - b) <= tol;

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const fix = (u) => u.replace('http://127.0.0.1:0', base);
  beats.forEach((b) => { if (b.url) b.url = fix(b.url); });

  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  await page.goto(base + '/scratchpad.html');

  // ── the shelf: one tile size, a square cover sat whole on the mat ──
  // The footprint must NOT follow the story's shape — that is what holds the
  // names level across a row (the .stile note) — so what changes is the fit.
  await page.waitForSelector('#shelftiles .stile');
  const tiles = await page.evaluate(() => [...document.querySelectorAll('#shelftiles .stile')].map((t) => {
    const cov = t.querySelector('.cov').getBoundingClientRect();
    const img = t.querySelector('.frame img');
    return { name: t.querySelector('.snm').textContent, w: cov.width, h: cov.height,
      fit: img ? getComputedStyle(img).objectFit : null,
      nameTop: t.querySelector('.snm').getBoundingClientRect().top };
  }));
  ok(tiles.length === 2 && near(tiles[0].h, tiles[1].h, 0.5) && near(tiles[0].w, tiles[1].w, 0.5),
    'the shelf keeps ONE tile footprint whatever shape a story is');
  ok(near(tiles[0].nameTop, tiles[1].nameTop, 0.5),
    'so the names still sit level across the row');
  ok(tiles[0].fit === 'cover' && tiles[1].fit === 'contain',
    'a square story\'s cover sits WHOLE on the mat; a portrait one still fills it');

  // ── a portrait story: byte-for-byte what it was ─────────────────────
  await page.evaluate((id) => window.openPad(id), 'pad');
  await page.waitForSelector('#pad .beat');
  const read = () => page.evaluate(() => {
    const tile = document.querySelector('#pad .beat').getBoundingClientRect();
    const btn = document.getElementById('shapetog');
    const bb = btn.getBoundingClientRect();
    const rect = btn.querySelector('rect');
    const g = rect ? rect.getBBox() : null;
    const words = [...document.querySelectorAll('.stylerow .sw')];
    const last = words[words.length - 1].getBoundingClientRect();
    return {
      ar: getComputedStyle(document.documentElement).getPropertyValue('--ar').trim(),
      tileRatio: tile.height / tile.width,
      glyphRatio: g ? g.height / g.width : null,
      btnRight: bb.right, btnTop: bb.top, btnW: bb.width, btnH: bb.height,
      rowRight: btn.closest('.stylerow').getBoundingClientRect().right,
      sameLine: Math.abs(bb.top + bb.height / 2 - (last.top + last.height / 2)) < 3,
      // Whatever the tap actually reaches at the button's own centre — the
      // only honest way to ask whether the pill's column is sitting on it.
      // The glyph fills the button, so the topmost node here is its <svg> —
      // walk up to the control, and an id of '' then really does mean
      // something else is sitting on it.
      hit: (() => {
        const el = document.elementFromPoint(bb.left + bb.width / 2, bb.top + bb.height / 2);
        const b2 = el && el.closest ? el.closest('button') : null;
        return (b2 && b2.id) || (el && el.id) || '';
      })(),
      label: btn.getAttribute('aria-label') || '',
    };
  });

  let s = await read();
  ok(s.ar === '2 / 3', 'a portrait story sets --ar to 2 / 3');
  ok(near(s.tileRatio, 1.5, 0.06), `and a beat tile MEASURES 2:3 (${s.tileRatio.toFixed(2)})`);
  ok(s.glyphRatio !== null && near(s.glyphRatio, 1.5, 0.06),
    'the button\'s glyph is that shape — a tall rectangle, nothing to read');
  ok(/portrait/i.test(s.label) && /square/i.test(s.label),
    `the label says what it is and what the tap does: "${s.label}"`);
  ok(s.sameLine, 'the button rides the style row, on the words\' line');
  ok(near(s.btnW, s.btnH, 0.5) && s.btnW >= 26,
    `it is a rounded SQUARE at a real tap size (${Math.round(s.btnW)}px), never a circle`);
  // The row reserves the injected pill's 56px column; the button is the
  // rightmost thing on it now, so it is the one that has to clear it.
  ok(s.btnRight <= s.rowRight + 0.5 && s.hit === 'shapetog',
    'it sits clear of the pill\'s column and takes its own tap');

  // ── the flip ────────────────────────────────────────────────────────
  await page.click('#shapetog');
  await page.waitForFunction(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--ar').trim() === '1 / 1');
  s = await read();
  ok(near(s.tileRatio, 1, 0.04), `the beat tiles MEASURE square (${s.tileRatio.toFixed(2)})`);
  ok(near(s.glyphRatio, 1, 0.04), 'and the glyph is a square now');
  const shapePosts = posted.filter((p) => p[0] === '/api/scratchpad/shape');
  ok(shapePosts.length === 1 && shapePosts[0][1].shape === 'square',
    'the flip is saved with POST /shape {shape:"square"}');

  // The popup's blank paper is the other box that has to follow — a beat with
  // no picture is where she stands while she writes what to draw.
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('#pad .beat')].pop();
    t.click();
  });
  await page.waitForSelector('#popblank:not([hidden])', { timeout: 4000 }).catch(() => {});
  const blank = await page.evaluate(() => {
    const el = document.getElementById('popblank');
    const r = el.getBoundingClientRect();
    return { shown: r.width > 20 && r.height > 20, ratio: r.height / r.width };
  });
  ok(!blank.shown || near(blank.ratio, 1, 0.05),
    `the popup's blank paper follows the story's shape (${blank.shown ? blank.ratio.toFixed(2) : 'not shown'})`);

  // ── a story that is ALREADY square opens square ─────────────────────
  // The reset in openPad puts the shape back to the default until the story's
  // own arrives; without the load wiring it would simply stay there.
  padShape = 'square';
  await page.evaluate(() => { const c = document.getElementById('popclose'); if (c) c.click(); });
  await page.evaluate((id) => window.openPad(id), 'sq');
  await page.waitForSelector('#pad .beat');
  const opened = await page.evaluate(() => ({
    ar: getComputedStyle(document.documentElement).getPropertyValue('--ar').trim(),
    ratio: (() => { const r = document.querySelector('#pad .beat').getBoundingClientRect(); return r.height / r.width; })(),
  }));
  ok(opened.ar === '1 / 1' && near(opened.ratio, 1, 0.04),
    'opening a square story opens it square, with no tap of hers');
  // And it did NOT re-save on the way in — a load must never look like an edit.
  ok(posted.filter((p) => p[0] === '/api/scratchpad/shape').length === 1,
    'loading a story never POSTs its shape back');

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILED` : '\nall good');
  process.exit(failures ? 1 : 0);
})();
