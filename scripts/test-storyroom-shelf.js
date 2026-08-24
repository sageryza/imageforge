#!/usr/bin/env node
// The Story Room's NEW shelf (Aug 2026, from the media-asset-survey prototype
// v5): category chips + portrait tiles, tap → straight to that story's beat
// canvas. Drives the REAL public/scratchpad.html in a headless browser
// against a stub API and asserts the things the design has to get right:
//   0. THE PAGE OPENS ON THE SHELF (2026-08-23, Sophie: "story room opens on
//      the shelf … we don't need a separate shelf button") — no door to tap,
//      and no story loaded until she picks one,
//   1. the shelf opens on Personal — tiles for personal + UNTAGGED stories
//      (a brand-new story must never be invisible), covers requested through
//      /api/story/thumb (never the raw full-size picture), a story with no
//      art yet drawn as a dashed box, an untitled one reading "Untitled",
//   2. a chip tap filters — NDE shows exactly the NDE stories,
//   3. tapping a tile opens THAT story's beat canvas (the sheet closes and
//      the page loads that pad),
//   4. ?plain=1 still renders the old row list (the unlinked fallback) —
//      and without it no .srow exists, i.e. nothing links there,
//   5. THE FRAMED TILE (Aug 2026, Sophie: three to a row, a white border
//      around the image inside the hairline outline, slightly rounded corners
//      on both, the name centred) — all four MEASURED off the real boxes,
//      because a mat drawn with the wrong `inset` still renders a picture in
//      a frame, it just covers the mat,
//   6. PINNING: a pushpin on a tile pins that story to the front and folds
//      the rest behind "see more"; the pin must not also open the story, and
//      with nothing pinned there is no fold at all,
//   7. FOLDERS (2026-08-24, Sophie: "treat the Evan and Mason ones as a folder
//      … a stack that you can see underneath the cover image"): the stories in
//      one collapse to a single tile carrying the count, the stack layers are
//      MEASURED to sit under the cover and inside the tile's own box (a folder
//      and a story must be the same height, or the names go ragged across a
//      row), tapping it steps into the folder, the chevron steps back out
//      instead of leaving the tool, and a pin on a story inside a folder lifts
//      the FOLDER — otherwise her pin would hide the story behind "see more".
//
//   npm install playwright --no-save && node scripts/test-storyroom-shelf.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');

// m1/m2/m3 are a folder: three stories of one character, filed by a chat and
// deliberately NOT contiguous in the shelf's newest-first order (m3 sits
// under The Meteorite) — the folder has to gather them and sit where its
// NEWEST one was. m1 has no art, so the folder's face must fall through to
// m2's — a folder tile is a real picture, same rule as a story's.
const PADS = [
  { id: 'pad', title: 'set theory', beats: 22, cover: '/px.png?a', category: null, updatedAt: 900 },
  { id: 'm1', title: 'Mason — the shape', beats: 16, cover: null, category: null, folder: 'Mason', updatedAt: 880 },
  { id: 'm2', title: 'Valued Customer', beats: 16, cover: '/px.png?m', category: null, folder: 'Mason', updatedAt: 850 },
  { id: 'p2', title: 'The Meteorite', beats: 0, cover: '/px.png?b', category: 'personal', updatedAt: 800 },
  { id: 'm3', title: 'Where Do You Crop Art?', beats: 13, cover: '/px.png?n', category: 'personal', folder: 'Mason', updatedAt: 780 },
  { id: 'p3', title: 'NDE · Telepathy', beats: 0, cover: '/px.png?c', category: 'nde', updatedAt: 700 },
  { id: 'p4', title: 'NDE · PROOF', beats: 0, cover: null, category: 'nde', updatedAt: 600 },
  { id: 'p5', title: 'The Lessons', beats: 0, cover: '/px.png?d', category: 'lessons', updatedAt: 500 },
  { id: 'p6', title: '', beats: 0, cover: null, category: null, updatedAt: 400 },
];

const padLoads = [];   // ?pad= values the page asked the doc route for
const thumbCalls = []; // urls asked of /api/story/thumb
const rawCovers = [];  // covers fetched raw (must stay empty)
const pinPosts = [];   // bodies POSTed to /pads/pin

const PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/scratchpad/pads') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ count: PADS.length, pads: PADS }));
  }
  if (url.pathname === '/api/scratchpad/pads/pin') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      pinPosts.push(JSON.parse(body || '{}'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  }
  if (url.pathname === '/api/scratchpad') {
    padLoads.push(url.searchParams.get('pad'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ beats: [], title: 'stub', film: null }));
  }
  if (url.pathname === '/api/story/thumb') {
    thumbCalls.push(url.searchParams.get('url'));
    res.writeHead(302, { Location: url.searchParams.get('url') || '/px.png' });
    return res.end();
  }
  if (url.pathname === '/px.png') {
    rawCovers.push(req.url); // only ever reached via the thumb redirect
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(PX);
  }
  if (url.pathname === '/' || url.pathname === '/scratchpad.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'scratchpad.html')));
  }
  res.writeHead(404); res.end();
});

let failures = 0;
function ok(cond, name) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });

  // 0/1 — the page OPENS on the shelf: Personal by default, tiles + covers
  await page.goto(base + '/scratchpad.html');
  await page.waitForSelector('.stile');
  ok(await page.$eval('#stories', (el) => !el.hidden),
    'the page opens on the shelf, with nothing to tap to get there');
  ok((await page.$$('#storiesbtn')).length === 0,
    'the separate shelf door is gone');
  ok(padLoads.length === 0,
    'no story is loaded until she picks one');
  ok(await page.$eval('#shelfcats .scat.on', (el) => el.textContent) === 'Personal',
    'shelf opens on the Personal chip');
  ok((await page.$$('.stile')).length === 4,
    'Personal shows personal + untagged stories, the folder as one tile (4)');
  ok((await page.$$('.stile .frame img')).length === 3 &&
     (await page.$$('.stile .frame .none')).length === 1,
    'a story with art gets its picture, one without gets the dashed box');
  ok(thumbCalls.length >= 1 && thumbCalls.every((u) => u && u.indexOf('/px.png') === 0),
    'covers are requested through /api/story/thumb');
  const names = await page.$$eval('.stile .snm', (els) => els.map((e) => e.textContent));
  ok(names.includes('Untitled'), 'a blank title reads "Untitled"');
  ok(names.every((n) => !/beats?/.test(n)), 'the name only — no status line on a tile');

  // 7 — the folder: one tile, gathered, stacked, and a level to step into
  const shelfNames = await page.$$eval('.stile .snm', (els) => els.map((e) => e.textContent));
  ok(shelfNames.indexOf('Mason') === 1,
    'the folder sits where its NEWEST story was, not sorted to the top');
  ok(!shelfNames.includes('Mason — the shape') && !shelfNames.includes('Valued Customer'),
    'the stories in a folder come off the shelf');
  ok((await page.$$('.stile.fold')).length === 1 &&
     (await page.$eval('.stile.fold .cnt', (el) => el.textContent)) === '3',
    'the folder tile carries its count — including the story filed under another chip');
  const face = await page.$eval('.stile.fold .frame img', (el) => el.getAttribute('src'));
  ok(decodeURIComponent(face).indexOf('/px.png?m') > 0,
    'a folder whose newest story has no art falls through to one that does');

  // THE STACK, MEASURED. "Visible" proves nothing here: the cards behind are
  // pseudo-elements, so the questions that matter are whether the front card
  // actually SHRANK to make room, whether the two behind are offset from it
  // rather than hiding under it, and whether the tile is still exactly a
  // story's height (or the names go ragged across a row).
  const stack = await page.evaluate(() => {
    const fold = document.querySelector('.stile.fold');
    const plain = document.querySelector('.stile:not(.fold)');
    const cs = (el, p) => getComputedStyle(el, p);
    const covF = fold.querySelector('.cov');
    const box = (el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; };
    const cov = covF.getBoundingClientRect();
    const fr = fold.querySelector('.frame').getBoundingClientRect();
    return {
      foldH: Math.round(fold.getBoundingClientRect().height),
      plainH: Math.round(plain.getBoundingClientRect().height),
      card1: cs(covF, '::before').content,
      card2: cs(covF, '::after').content,
      // how much room the front card gives up on its right and bottom
      right: Math.round(cov.right - fr.right),
      bottom: Math.round(cov.bottom - fr.bottom),
      // the front card starts at the footprint's own top-left
      top: Math.round(fr.top - cov.top), left: Math.round(fr.left - cov.left),
      // a plain tile's frame fills its footprint exactly
      plainFill: (() => {
        const c = plain.querySelector('.cov').getBoundingClientRect();
        const f = plain.querySelector('.frame').getBoundingClientRect();
        return Math.round(c.width - f.width) === 0 && Math.round(c.height - f.height) === 0;
      })(),
      // the cards behind are WHITE cards, not slivers
      bg: cs(covF, '::before').backgroundColor,
      deepH: cs(covF, '::before').height,
      frameH: box(fold.querySelector('.frame')).h,
    };
  });
  ok(stack.card1 === '""' && stack.card2 === '""',
    'two cards behind, drawn as pseudo-elements — a folder is still one node');
  ok(stack.top === 0 && stack.left === 0 && stack.right === 8 && stack.bottom === 8,
    'the front card gives up its right and bottom edge for the stack ('
      + stack.right + '/' + stack.bottom + 'px)');
  ok(stack.bg === 'rgb(255, 255, 255)',
    'the cards behind are whole white cards, not hairline slivers');
  ok(Math.abs(parseFloat(stack.deepH) - stack.frameH) < 1.5,
    'a card behind is the same SIZE as the front one, just offset');
  ok(stack.plainFill,
    'a plain story tile is untouched — its frame fills its footprint');
  ok(stack.foldH === stack.plainH,
    'a folder is exactly as tall as a story, so the names line up across a row');

  // tapping it steps INTO the folder — the same sheet, renamed
  await page.click('.stile.fold');
  await page.waitForFunction(() => document.getElementById('shelfno').textContent === 'Mason');
  ok(await page.$eval('#stories', (el) => !el.hidden), 'the folder is a level of the shelf sheet, not a new one');
  ok(await page.$eval('#shelfcats', (el) => el.hidden), 'the category chips come off inside a folder');
  const inFold = await page.$$eval('.stile .snm', (els) => els.map((e) => e.textContent));
  ok(inFold.length === 3 && inFold.includes('Where Do You Crop Art?'),
    'the folder shows all three, including the one filed under another chip');
  ok((await page.$$('.stile.fold')).length === 0, 'no folder tile inside a folder');
  ok(padLoads.length === 0, 'stepping into a folder loads no story');
  ok((await page.$$('.stile .pinpin')).length === 3,
    'a story inside a folder still carries its pushpin');

  // A PIN ON A STORY INSIDE A FOLDER LIFTS THE FOLDER. With the story folded
  // away the folder tile is the only thing on screen that can carry her pin —
  // otherwise pinning would push the story behind "see more" instead.
  pinPosts.length = 0;
  await page.click('.stile .pinpin');
  await page.waitForSelector('#shelfmore');
  ok(pinPosts.length === 1 && pinPosts[0].pinned === true,
    'pinning inside a folder posts for that STORY, not the folder');
  await page.click('#storiesclose');
  await page.waitForFunction(() => document.getElementById('shelfno').textContent === 'The shelf');
  ok((await page.$$('.stile')).length === 1 &&
     (await page.$eval('.stile .snm', (el) => el.textContent)) === 'Mason',
    'back on the shelf the FOLDER leads, carrying its pinned story');
  ok((await page.$$('.stile.fold .pinpin')).length === 0,
    'a folder tile carries no pushpin of its own — a pin belongs to a story');
  // put it back so the pinning section below starts from an unpinned shelf
  await page.click('#shelfmore');
  await page.click('.stile.fold');
  await page.waitForFunction(() => document.getElementById('shelfno').textContent === 'Mason');
  await page.click('.stile .pinpin.on');
  await page.waitForFunction(() => !document.getElementById('shelfmore'));

  // the chevron steps OUT of the folder instead of leaving the tool
  let left = false;
  await page.exposeFunction('__testLeft', () => { left = true; });
  await page.evaluate(() => { window.__forgeLeave = () => window.__testLeft(); });
  await page.click('#storiesclose');
  await page.waitForFunction(() => document.getElementById('shelfno').textContent === 'The shelf');
  ok(!left, 'the chevron steps out of the folder — it does not leave the tool');
  ok((await page.$$('.stile.fold')).length === 1, 'and the shelf is back with the folder on it');
  ok(await page.evaluate(() => window.__navBack()) === false,
    'from the bare shelf __navBack still hands the app its exit');
  await page.evaluate(() => { delete window.__forgeLeave; });

  // 2 — the NDE chip filters
  await page.click('#shelfcats .scat:nth-child(3)');
  const nde = await page.$$eval('.stile .snm', (els) => els.map((e) => e.textContent));
  ok(nde.length === 2 && nde.every((n) => n.indexOf('NDE') === 0),
    'NDE chip shows exactly the NDE stories');

  // 3 — tapping a tile opens THAT story's beat canvas
  padLoads.length = 0;
  await page.click('.stile');
  await page.waitForSelector('#stories', { state: 'hidden' });
  ok(padLoads.includes('p3'), 'tile tap loads that pad (straight to the beat canvas)');
  ok(await page.$eval('#stories', (el) => el.hidden), 'the shelf sheet closed');

  // 4 — the plain old list survives ONLY behind ?plain=1
  await page.goto(base + '/scratchpad.html?plain=1');
  await page.waitForSelector('.srow');
  ok((await page.$$('.srow')).length === PADS.length, '?plain=1 renders the old row list');
  ok(await page.$eval('#shelfcats', (el) => el.hidden), 'chips hidden in plain mode');
  await page.goto(base + '/scratchpad.html');
  await page.waitForSelector('.stile');
  ok((await page.$$('.srow')).length === 0, 'nothing renders the old rows without ?plain=1');

  // 5 — the framed tile, measured
  const cols = await page.$eval('#shelftiles',
    (el) => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length);
  ok(cols === 3, 'three tiles to a row');
  const frame = await page.$eval('.stile .frame img', (im) => {
    const cov = im.parentElement;
    const a = im.getBoundingClientRect(); const b = cov.getBoundingClientRect();
    const cs = getComputedStyle(cov); const is = getComputedStyle(im);
    return { top: a.top - b.top, left: a.left - b.left,
      right: b.right - a.right, bottom: b.bottom - a.bottom,
      bg: cs.backgroundColor, outline: cs.borderTopWidth,
      covR: parseFloat(cs.borderTopLeftRadius), imR: parseFloat(is.borderTopLeftRadius),
      w: b.width };
  });
  ok([frame.top, frame.left, frame.right, frame.bottom].every((v) => v > 2 && v < 12),
    'the art sits on a mat, inset on every side (' +
    [frame.top, frame.left, frame.right, frame.bottom].map((v) => Math.round(v)).join('/') + ')');
  ok(frame.bg === 'rgb(255, 255, 255)', 'the mat is white');
  ok(parseFloat(frame.outline) >= 1, 'the hairline outline is outside the mat');
  ok(frame.covR > 0 && frame.covR <= 5 && frame.imR > 0 && frame.imR <= 3,
    'both the frame and the art are barely rounded (' + frame.covR + '/' + frame.imR + 'px)');
  const plate = await page.$eval('.stile .pinpin', (el) => {
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    return { rad: parseFloat(cs.borderTopLeftRadius), w: r.width };
  });
  ok(plate.rad > 0 && plate.rad < plate.w / 2,
    'the pushpin sits on a rounded SQUARE, never a circle');
  ok(await page.$eval('.stile .snm', (el) => getComputedStyle(el).textAlign) === 'center',
    'the name is centred');
  ok(frame.w < 390 / 3, 'a tile fits its third of the row');

  // 6 — pinning
  ok((await page.$$('#shelfmore')).length === 0,
    'nothing pinned yet, so the whole shelf shows and there is no fold');
  padLoads.length = 0;
  pinPosts.length = 0;   // the folder section above pinned and unpinned too
  // 3rd, not 2nd: the Mason FOLDER stands where its newest story was, so The
  // Meteorite is one along — and a folder tile carries no pushpin to click.
  await page.click('.stile:nth-child(3) .pinpin');
  await page.waitForSelector('#shelfmore');
  ok(pinPosts.length === 1 && pinPosts[0].pinned === true && pinPosts[0].pad === 'p2',
    'the pushpin POSTs /pads/pin for that story');
  ok(padLoads.length === 0, 'pinning does not also open the story');
  ok((await page.$$('.stile')).length === 1, 'the unpinned ones fold away');
  ok(await page.$eval('.stile .snm', (el) => el.textContent) === 'The Meteorite',
    'the pinned story leads the shelf');
  ok(await page.$eval('#shelfmore', (el) => /see more/.test(el.textContent)),
    'and the rest are behind "see more"');
  ok(await page.$eval('#shelfmore', (el) => getComputedStyle(el).textDecorationLine) === 'underline',
    '"see more" is an underlined word, not a boxed button');
  await page.click('#shelfmore');
  await page.waitForFunction(() => document.querySelectorAll('.stile').length === 4);
  const order = await page.$$eval('.stile .snm', (els) => els.map((e) => e.textContent));
  ok(order[0] === 'The Meteorite', 'opened up, the pinned one still leads');
  ok(await page.$eval('.stile .pinpin', (el) => el.classList.contains('on')),
    'the pinned tile wears a lit pushpin');
  await page.click('.stile .pinpin');
  await page.waitForFunction(() => !document.getElementById('shelfmore'));
  ok(pinPosts.length === 2 && pinPosts[1].pinned === false,
    'tapping the lit pin unpins, and the fold goes with it');

  await browser.close();
  server.close();
  console.log(failures ? failures + ' FAILED' : 'all good');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
