#!/usr/bin/env node
// SEND TO THE STORY ROOM — the WALK (2026-08-26, Sophie: "rather than this
// weird pop-up, it should take me to the story room so I can pick myself").
//
// The button shipped as a sheet over the Playground's own lightbox: the shelf
// as a list of small rows, then that story's doors. It is a NAVIGATION now —
// the run and which of its pictures ride the link, and every choice about the
// story is made in the room, on her real shelf with the real covers.
//
// Drives BOTH real pages in headless Chromium against a stub API, and the
// walk is driven as one trip (the Playground's own tap is what lands on the
// room) rather than as two pages tested apart:
//   1. the share button is still the FIFTH button in the lightbox row and
//      draws an icon — and the page holds NO sheet any more,
//   2. tapping it asks the server for /storyroom?send=<run>&i=<n>, carrying
//      WHICH picture of the run she was looking at,
//   3. the room opens on its SHELF (never a story) holding the picture: the
//      band wears it, through /api/story/thumb rather than the full-size
//      original, and the link is SPENT so a refresh cannot hand it back,
//   4. tapping a story opens it with the gaps already lit,
//   5. tapping a gap POSTs /add at THAT place in the order, with the pad's
//      style and the full provenance src (runId · i · prompt · model ·
//      quality) — the same src the pad's own inbox pick sends,
//   6. a stray tap cancels the placing but NOT the picture: the band survives
//      and re-arms on a tap (there is no way back to it otherwise),
//   7. the ✕ puts it down for good,
//   8. a story with no beats has no gap to tap, so it places straight away.
//
//   npm install playwright --no-save && node scripts/test-playground-story-share.js
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const T0 = 1786000000000;

const RUN = {
  id: 'runA', prompt: 'a fox in the rain', status: 'done',
  engine: 'gptimage', model: 'gpt-image-2', quality: 'medium', aspectRatio: '2:3',
  images: ['/px.png?r=runA&i=0', '/px.png?r=runA&i=1'],
  votes: {}, createdAt: T0,
};

const PADS = [
  { id: 'padX', title: 'The Meteorite', beats: 2, cover: '/px.png?c=x', category: null, updatedAt: T0 },
  { id: 'padY', title: 'Moon Milk', beats: 0, cover: null, category: null, updatedAt: T0 - 1000 },
];
const BEATS = [
  { id: 'b1', text: 'The kitchen floods', url: '/px.png?b=1' },
  { id: 'b2', text: 'and the roof lifts', url: '/px.png?b=2' },
];

const posts = [];       // every write the room makes, {path, body}
const roomLoads = [];   // the query string each /storyroom request carried
const thumbCalls = [];  // urls asked of /api/story/thumb

const PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (obj) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'POST') {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    return req.on('end', () => {
      posts.push({ path: url.pathname, body: JSON.parse(raw || '{}') });
      json({ ok: true, beats: BEATS });
    });
  }
  if (url.pathname === '/api/scratchpad/pads') return json({ count: PADS.length, pads: PADS });
  if (url.pathname === '/api/scratchpad' || url.pathname === '/api/scratchpad/') {
    const which = url.searchParams.get('pad');
    return json({ beats: which === 'padY' ? [] : BEATS, title: which === 'padY' ? 'Moon Milk' : 'The Meteorite', style: 'watercolor', film: null });
  }
  if (url.pathname === '/api/promptlab') return json({ runs: [RUN], more: false });
  if (url.pathname === '/api/promptlab/runA') return json(RUN);
  if (url.pathname === '/api/story/thumb') {
    thumbCalls.push(url.searchParams.get('url'));
    res.writeHead(302, { Location: url.searchParams.get('url') || '/px.png' });
    return res.end();
  }
  if (url.pathname === '/px.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PX); }
  if (url.pathname === '/tritoggle.css' || url.pathname === '/tritoggle.js') {
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, url.pathname.slice(1))));
  }
  if (url.pathname === '/storyroom') {
    roomLoads.push(url.search);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'scratchpad.html')));
  }
  if (url.pathname === '/' || url.pathname === '/playground') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8'));
  }
  res.writeHead(404).end();
});

let failures = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) failures++; };

(async () => {
  // ── the source pin: the sheet is gone, both halves ────────────────────
  const play = fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8');
  ok(!/storysheet/.test(play), 'the Playground holds no story sheet any more');
  ok(/\/storyroom\?send=/.test(play), 'and walks to the room instead');

  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find((p) => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });   // iPhone 13

  // The room remembers the last story per device; a stale one would open a
  // story instead of the shelf and hide the whole point of the trip.
  await page.goto(base + '/playground');
  await page.evaluate(() => localStorage.removeItem('scratchpad_pad'));

  // ── 1 · the button is where it was ────────────────────────────────────
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length > 0);
  ok(await page.locator('.lbbtns .lbbtn').count() === 5, 'the lightbox row still holds five buttons');
  ok(await page.locator('.lbbtns .lbbtn').nth(4).getAttribute('id') === 'lbstory',
    'the share button is the fifth in the row');
  ok(await page.locator('#lbstory svg').count() === 1, 'it draws an icon');

  // ── 2 · the walk carries WHICH picture ────────────────────────────────
  await page.locator('#runs .cell img[data-run="runA"][data-i="1"]').click();
  await page.waitForSelector('#lb.on');
  await Promise.all([page.waitForURL(/storyroom/), page.locator('#lbstory').click()]);
  ok(roomLoads.length === 1 && /send=runA/.test(roomLoads[0]) && /(\?|&)i=1\b/.test(roomLoads[0]),
    'the link asks for /storyroom' + (roomLoads[0] || '(nothing)'));

  // ── 3 · the room opens on the shelf, holding it ───────────────────────
  await page.waitForSelector('#sendband:not([hidden])');
  ok(!(await page.locator('#stories').isHidden()), 'the room opens on the shelf, not a story');
  ok(/Pick a story/i.test(await page.locator('#sendword').textContent()),
    'the band asks her to pick a story');
  const bandSrc = await page.locator('#sendthumb').getAttribute('src');
  ok(/api\/story\/thumb/.test(bandSrc || ''), 'the band wears a derived thumb, not the original');
  ok(/i%3D1|i=1/.test(decodeURIComponent(bandSrc || '')), 'and it is the picture she was looking at');
  ok(!/send=/.test(await page.evaluate(() => location.search)), 'the link is spent');

  // ── 4 · a story opens with the gaps lit ───────────────────────────────
  await page.locator('#shelftiles .stile', { hasText: 'The Meteorite' }).click();
  await page.waitForFunction(() => document.querySelectorAll('#pad .slot').length === 3);
  ok(await page.locator('#stories').isHidden(), 'the shelf steps aside');
  ok(/Tap where it goes/i.test(await page.locator('#sendword').textContent()),
    'the band says what to do next');

  // ── 5 · a gap places it THERE, with the provenance ────────────────────
  await page.locator('#pad .slot').nth(1).click();
  await page.waitForFunction(() => document.getElementById('sendband').hidden);
  const add = posts.pop();
  ok(add && add.path === '/api/scratchpad/add', 'the gap POSTs /add (' + (add && add.path) + ')');
  if (add) {
    ok(add.body.at === 1, 'at the gap she tapped (at=' + add.body.at + ')');
    ok(add.body.pad === 'padX' && add.body.style === 'watercolor', 'carrying the pad and its style');
    ok(/r=runA&i=1/.test(add.body.url || ''), 'and the picture (' + add.body.url + ')');
    const s = add.body.src || {};
    ok(s.runId === 'runA' && s.i === 1 && s.prompt === 'a fox in the rain'
      && s.model === 'gpt-image-2' && s.quality === 'medium',
      'with the whole provenance src (' + JSON.stringify(s) + ')');
  }
  ok(await page.locator('#pad .slot').count() === 0, 'the gaps go out once it is placed');

  // ── 6 · a stray tap cancels the placing, never the picture ────────────
  await page.goto(base + '/storyroom?send=runA&i=0');
  await page.waitForSelector('#sendband:not([hidden])');
  await page.locator('#shelftiles .stile', { hasText: 'The Meteorite' }).click();
  await page.waitForFunction(() => document.querySelectorAll('#pad .slot').length === 3);
  await page.mouse.click(195, 700);            // the paper, well clear of everything
  await page.waitForFunction(() => document.querySelectorAll('#pad .slot').length === 0);
  ok(!(await page.locator('#sendband').isHidden()), 'the band survives a stray tap');
  ok(/Tap to place/i.test(await page.locator('#sendword').textContent()), 'and offers it back');
  await page.locator('#sendband').click();
  await page.waitForFunction(() => document.querySelectorAll('#pad .slot').length === 3);
  ok(true, 'tapping the band arms it again');

  // ── 7 · the ✕ puts it down for good ───────────────────────────────────
  await page.locator('#senddrop').click();
  await page.waitForFunction(() => document.getElementById('sendband').hidden);
  ok(await page.locator('#pad .slot').count() === 0, 'dropping it takes the gaps with it');

  // ── 8 · an empty story has no gap, so it lands ────────────────────────
  posts.length = 0;
  await page.goto(base + '/storyroom?send=runA&i=0');
  await page.waitForSelector('#sendband:not([hidden])');
  await page.locator('#shelftiles .stile', { hasText: 'Moon Milk' }).click();
  await page.waitForFunction(() => document.getElementById('sendband').hidden);
  const first = posts.pop();
  ok(first && first.path === '/api/scratchpad/add' && first.body.at === 0 && first.body.pad === 'padY',
    'an empty story takes it as its first beat (' + JSON.stringify(first && first.body.at) + ')');

  await browser.close();
  server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall pass');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
