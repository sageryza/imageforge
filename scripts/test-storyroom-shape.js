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
// assertion here MEASURES a real box: a beat tile and the blank paper in the
// popup. There is deliberately NO control to test — she asked for the toggle
// to go once the shape became automatic, so the row carrying none is itself
// one of the assertions.
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

// ── THE AUTOMATIC RULE — a story's shape follows its FIRST picture ──
// The decision table is the half that can be wrong quietly: a tolerance too
// wide turns a landscape photo into a square story, one too narrow means the
// rule never fires at all, and both look like nothing happening.
const shapeForSize = (() => {
  const at = padSrc.indexOf('function shapeForSize(');
  const end = padSrc.indexOf('\n}', at);
  const tol = Number((padSrc.match(/const SHAPE_AUTO_TOL = ([\d.]+)/) || [, '0'])[1]);
  // eslint-disable-next-line no-new-func
  return new Function('SHAPES', 'SHAPE_AUTO_TOL',
    `${padSrc.slice(at, end + 2)} return shapeForSize;`)(SRV, tol);
})();
const call = (w, h) => { const r = shapeForSize(w, h); return r && r.key; };
ok(call(1024, 1536) === 'portrait' && call(2336, 3504) === 'portrait',
  'a 2:3 picture makes the story portrait, at either tier');
ok(call(1024, 1024) === 'square' && call(2880, 2880) === 'square',
  'a 1:1 picture makes it square, at either tier');
// 3:4 is the shape a phone photo crops to and the one a person would call
// "portrait-ish" — it has to land somewhere, and portrait is nearer.
ok(call(1200, 1600) === 'portrait', 'a 3:4 photo is near enough to portrait');
// The refusals matter more than the matches: portrait is the fallback she can
// see and change, and a story silently turned square by a picture that is
// neither shape is the failure worth avoiding.
ok(call(1920, 1080) === null && call(1600, 900) === null,
  'a 16:9 picture — a clip\'s poster — decides NOTHING');
ok(call(4032, 3024) === null, 'a landscape phone photo decides nothing either');
ok(call(0, 100) === null && call(100, 0) === null && call(null, null) === null,
  'and a size it could not read decides nothing');

// A shape change moves the FILM's frame, so the page must count it as making
// the render she has stale. It marks dirty for any POST outside its own
// allowlist — which is exactly why this route is /shape and not /pads/shape.
const allow = (genSrc.match(/^.*dirtySinceFilm=true;.*$/m) || [''])[0];
ok(allow && !/'\/shape'/.test(allow) && !/indexOf\('\/shape'\)/.test(allow),
  'changing the shape stales the film — /shape is not in the page\'s allowlist');
ok(/router\.post\('\/shape'/.test(padSrc) && !/router\.post\('\/pads\/shape'/.test(padSrc),
  'the route is /shape (top level), never /pads/shape — /pads* is the tidying allowlist');

// The automatic rule fires ONLY on a pad nobody has decided, and it re-checks
// that inside the transaction — a placement reads its picture's header over
// the network, so another one can decide while it is waiting.
ok(/if \(snap\.exists && snap\.data\(\)\.shape\) return \{\};/.test(padSrc),
  'autoShapePatch stands down the moment a story already has a shape');
ok((padSrc.match(/!\(snap\.exists && snap\.data\(\)\.shape\)/g) || []).length === 2,
  'and BOTH writers re-check that inside their transaction');
// The header read must stay a header read: pulling whole originals here would
// put a 1-3MB download in front of a placement she is watching.
ok(/headers: \{ Range: `bytes=0-\$\{HEADER_BYTES - 1\}` \}/.test(padSrc),
  'the size is read from a RANGED request, never a whole original');
ok(/require\('\.\/image-size'\)/.test(padSrc),
  'and parsed by image-size.js, which reads the truncated webp sharp refuses');
// A DRAWN picture was drawn AT the story's shape, so it can teach the story
// nothing — the rule must not be wired into the draw.
const drawFn = (() => {
  const at = padSrc.indexOf('async function runArtJob');
  // Its BODY only — the file's own module.exports names autoShapePatch, and
  // slicing to the end of the file would read that as the draw using it.
  const end = padSrc.indexOf('\nrouter.post(', at);
  return padSrc.slice(at, end > at ? end : padSrc.length);
})();
ok(drawFn.length > 200 && !/autoShapePatch/.test(drawFn),
  'a picture the pad DREW never decides the shape — that would only confirm the default');

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
// A third story that is EMPTY and undecided — the automatic rule's own case.
// With no beats, tapping an inbox picture places it straight away, which is
// the shortest real path to "her first picture lands".
let serveBeats = null;   // null = the two-beat story; [] = the empty one
const posted = [];
const INBOX_ITEM = { url: 'http://127.0.0.1:0/px.png?inbox', runId: 'r1', i: 0,
  prompt: 'the first picture', model: 'gpt-image-2', quality: 'medium' };
// What the server answers a placement with when that picture decided the
// story's shape (autoShapePatch). null = it decided nothing.
let placedShape = null;

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
      // The two placing routes answer with the shape the picture decided —
      // exactly what the real ones do, and the page must follow it with no
      // reload and without posting it back.
      if (url.pathname === '/api/scratchpad/add' || url.pathname === '/api/scratchpad/image') {
        const placed = [{ id: 'p1', url: fixUrl(INBOX_ITEM.url), color: null, text: '' }];
        if (serveBeats) serveBeats = placed;
        return json({ ok: true, beat: placed[0], beats: placed,
          ...(placedShape ? { shape: placedShape } : {}) });
      }
      json({ ok: true, beats: serveBeats || beats, shape: padShape });
    });
  }
  if (url.pathname === '/api/scratchpad/inbox') {
    return json({ count: 1, items: [{ ...INBOX_ITEM, url: fixUrl(INBOX_ITEM.url) }],
      source: 'playground', uploads: [] });
  }
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
    return json({ beats: serveBeats || beats, title: 'shape test', style: 'watercolor',
      // A story nobody has decided answers with the FALLBACK, which is what
      // readPad really does — the field's absence is the whole guard.
      shape: padShape, film: null, audios: [], uploads: [] });
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

// The stub answers with same-origin urls, and the port is only known once it
// is listening — so the rewrite has to be a function the handlers call, not a
// value baked in at module load.
let PORT_BASE = '';
function fixUrl(u) { return String(u).replace('http://127.0.0.1:0', PORT_BASE); }

const near = (a, b, tol) => Math.abs(a - b) <= tol;

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  PORT_BASE = base;
  const fix = fixUrl;
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
    return {
      ar: getComputedStyle(document.documentElement).getPropertyValue('--ar').trim(),
      tileRatio: tile.height / tile.width,
      // THERE IS NO SHAPE CONTROL (2026-08-28, Sophie: "get rid of button").
      // Asked as "is there anything in the page at all", not as "is #shapetog
      // gone", so a renamed copy of it fails here too.
      controls: document.querySelectorAll('.stylerow button:not(.sw):not(.tri)').length,
    };
  });

  let s = await read();
  ok(s.ar === '2 / 3', 'a portrait story sets --ar to 2 / 3');
  ok(near(s.tileRatio, 1.5, 0.06), `and a beat tile MEASURES 2:3 (${s.tileRatio.toFixed(2)})`);
  ok(s.controls === 0, 'and the style row carries NO shape control — the shape is automatic');

  // The popup's blank paper is the other box that has to follow — a beat with
  // no picture is where she stands while she writes what to draw. (It reads
  // the same --ar, so this story being portrait is the case it checks.)
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
  // Compared against the TILE's ratio rather than a number, so this asserts
  // "the same shape as the story" whatever shape the story happens to be.
  ok(!blank.shown || near(blank.ratio, s.tileRatio, 0.06),
    `the popup's blank paper follows the story's shape (${blank.shown ? blank.ratio.toFixed(2) : 'not shown'} vs ${s.tileRatio.toFixed(2)})`);

  // ── a story that is ALREADY square opens square ─────────────────────
  // The reset in openPad puts the shape back to the default until the story's
  // own arrives; without the load wiring it would simply stay there.
  padShape = 'square';
  await page.evaluate(() => { if (typeof closeBeat === 'function') closeBeat(); });
  await page.evaluate((id) => window.openPad(id), 'sq');
  await page.waitForSelector('#pad .beat');
  const opened = await page.evaluate(() => ({
    ar: getComputedStyle(document.documentElement).getPropertyValue('--ar').trim(),
    ratio: (() => { const r = document.querySelector('#pad .beat').getBoundingClientRect(); return r.height / r.width; })(),
  }));
  ok(opened.ar === '1 / 1' && near(opened.ratio, 1, 0.04),
    'opening a square story opens it square, with no tap of hers');
  // And it did NOT save on the way in — a load must never look like an edit.
  // Nothing on this page posts /shape at all now, so the count is zero.
  ok(posted.filter((p) => p[0] === '/api/scratchpad/shape').length === 0,
    'loading a story never POSTs its shape back');

  // ── the automatic rule, end to end on the real page ────────────────
  // A story nobody has decided, with nothing on it yet: her first picture
  // lands, the server says the story is square, and the tiles have to BE
  // square with no reload — the moment she is actually looking at them.
  await page.evaluate(() => { if (typeof closeBeat === 'function') closeBeat(); });
  padShape = 'portrait';
  serveBeats = [];
  placedShape = 'square';
  const shapePostsBefore = posted.filter((p) => p[0] === '/api/scratchpad/shape').length;
  await page.evaluate((id) => window.openPad(id), 'empty');
  await page.waitForFunction(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--ar').trim() === '2 / 3');
  await page.click('#inboxbtn');
  await page.waitForSelector('#inboxgrid button img');
  // With no beats there is no placement slot to aim at — the picture goes
  // straight down, which is the shortest real path to "her first picture".
  await page.click('#inboxgrid button');
  await page.waitForSelector('#pad .beat', { timeout: 5000 });
  await page.waitForFunction(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--ar').trim() === '1 / 1',
    { timeout: 5000 }).catch(() => {});
  const auto = await page.evaluate(() => {
    const r = document.querySelector('#pad .beat').getBoundingClientRect();
    return { ar: getComputedStyle(document.documentElement).getPropertyValue('--ar').trim(),
      ratio: r.height / r.width };
  });
  ok(auto.ar === '1 / 1' && near(auto.ratio, 1, 0.04),
    `her first picture makes the story square by itself (${auto.ratio.toFixed(2)})`);
  ok(posted.filter((p) => p[0] === '/api/scratchpad/shape').length === shapePostsBefore,
    'the page never posts it back — the server already wrote it');

  // A placement that decided NOTHING (a landscape photo, a clip poster) must
  // leave the story exactly where it was.
  padShape = 'portrait';
  serveBeats = [];
  placedShape = null;
  await page.evaluate((id) => window.openPad(id), 'empty2');
  await page.waitForFunction(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--ar').trim() === '2 / 3');
  await page.click('#inboxbtn');
  await page.waitForSelector('#inboxgrid button img');
  await page.click('#inboxgrid button');
  await page.waitForSelector('#pad .beat', { timeout: 5000 });
  const stayed = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--ar').trim());
  ok(stayed === '2 / 3', 'a placement that decided nothing leaves the story portrait');

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILED` : '\nall good');
  process.exit(failures ? 1 : 0);
})();
