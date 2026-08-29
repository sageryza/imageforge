#!/usr/bin/env node
// THE RECENT STORIES CARD (2026-08-29, Sophie: "auto pick story not work
// (playground image to story room transfer) · instead: use last three stories
// · just thumbnails · keep select by hand button").
//
// The shortcut over the shelf while she is holding a picture from the
// Playground. It shipped 2026-08-26 as a MATCH card — the room reading the
// run's prompt against every beat's words and proposing a BEAT to confirm —
// and the guessing is what she retired. Now: the three stories she touched
// last, as thumbnails; tapping one OPENS it and places nothing; "Pick by
// hand" puts the card away and leaves her shelf.
//
// Driven against the REAL page, because every one of these is a measurement
// a source assertion cannot make — how many tiles there are, that a tap
// placed nothing, that the picture is still in her hand afterwards.
//
//   npm install playwright --no-save && node scripts/test-storyroom-recent-stories.js
const http = require('http');
const servePublic = require('./lib/public-asset');
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
  images: ['/px.png?r=runA&i=0'], votes: {}, createdAt: T0,
};

// FOUR stories, so "the last three" is a real cut rather than "all of them",
// and the third has NO cover — a story with no art anywhere yet must tile as
// an empty square, never a broken picture.
const PADS = [
  { id: 'p1', title: 'The Meteorite', beats: 2, cover: '/px.png?c=1', updatedAt: T0 },
  { id: 'p2', title: 'Moon Milk', beats: 2, cover: '/px.png?c=2', updatedAt: T0 - 1000 },
  { id: 'p3', title: 'Charlie', beats: 2, cover: null, updatedAt: T0 - 2000 },
  { id: 'p4', title: 'Wormsicles', beats: 2, cover: '/px.png?c=4', updatedAt: T0 - 3000 },
];
const BEATS = [
  { id: 'b1', text: 'The kitchen floods', url: '/px.png?b=1' },
  { id: 'b2', text: 'and the roof lifts', url: '/px.png?b=2' },
];

const posts = [];
const PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64');

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
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
  if (url.pathname === '/api/scratchpad/send-match') {
    // Nothing may ask for the retired guess any more.
    posts.push({ path: url.pathname, body: {} });
    return json({ candidates: [] });
  }
  if (url.pathname === '/api/scratchpad' || url.pathname === '/api/scratchpad/') {
    const which = url.searchParams.get('pad');
    const p = PADS.find((x) => x.id === which);
    return json({ beats: BEATS, title: (p && p.title) || '', style: 'watercolor', film: null });
  }
  if (url.pathname === '/api/promptlab/runA') return json(RUN);
  if (url.pathname === '/api/story/thumb') {
    res.writeHead(302, { Location: url.searchParams.get('url') || '/px.png' });
    return res.end();
  }
  if (url.pathname === '/px.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PX); }
  if (url.pathname === '/storyroom') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'scratchpad.html')));
  }
  res.writeHead(404).end();
});

let failures = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) failures++; };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find((p) => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(base + '/storyroom');
  await page.evaluate(() => localStorage.removeItem('scratchpad_pad'));

  // ── 1 · she arrives holding a picture ─────────────────────────────────
  await page.goto(base + '/storyroom?send=runA&i=0');
  await page.waitForSelector('#sendband:not([hidden])');
  await page.waitForSelector('#matchcard:not([hidden])');
  ok(!(await page.locator('#stories').isHidden()), 'the room opens on the shelf');

  // ── 2 · three thumbnails, newest first ────────────────────────────────
  const tiles = page.locator('#matchrows .mrow');
  ok(await tiles.count() === 3, 'the card offers THREE stories, not the whole shelf');
  const names = await tiles.locator('.mstory').allTextContents();
  ok(names.join('|') === 'The Meteorite|Moon Milk|Charlie',
    'the last three she touched, newest first (' + names.join(' · ') + ')');

  // A tile is a real decoded picture through the derived-thumb service — the
  // house rule that a page never loads a full-size original for a thumbnail.
  const cov = tiles.nth(0).locator('img');
  ok(/api\/story\/thumb/.test(await cov.getAttribute('src') || ''),
    'a cover rides the derived thumb, not the original');
  ok(await cov.evaluate((im) => im.complete && im.naturalWidth > 0),
    'and it really decodes');
  ok(await tiles.nth(2).locator('img').count() === 0
    && await tiles.nth(2).locator('.none').count() === 1,
    'a story with no art tiles as an empty square, never a broken picture');
  ok(!posts.some((p) => /send-match/.test(p.path)), 'nothing asks for the retired guess');

  // ── 3 · a tap OPENS the story and places nothing ──────────────────────
  const before = posts.length;
  await tiles.nth(1).click();
  await page.waitForFunction(() => document.getElementById('stories').hidden);
  ok(posts.length === before, 'tapping a story writes nothing — no picture is placed');
  ok(await page.evaluate(() => localStorage.getItem('scratchpad_pad')) === 'p2',
    'it opens the story she tapped');
  ok(await page.locator('#matchcard').isHidden(),
    'and the card stands down inside a story');

  // ── 4 · the picture is still in her hand ──────────────────────────────
  ok(!(await page.locator('#sendband').isHidden()), 'the band still holds the picture');
  ok(/Tap (to place|a moment)/i.test(await page.locator('#sendword').textContent()),
    'and says what to do with it');
  await page.locator('#sendband').click();
  await page.waitForFunction(() => document.querySelectorAll('#pad .slot').length > 0);
  ok(await page.locator('#pad .slot').count() > 0, 'tapping the band arms the gaps as ever');

  // ── 5 · back on the shelf the shortcut is there again ─────────────────
  await page.locator('#shelfback').click();
  await page.waitForFunction(() => !document.getElementById('stories').hidden);
  await page.waitForSelector('#matchcard:not([hidden])');
  ok(true, 'stepping back to the shelf brings the shortcut back');

  // ── 6 · Pick by hand puts it away, and keeps everything else ──────────
  await page.locator('#matchhand').click();
  ok(await page.locator('#matchcard').isHidden(), 'Pick by hand puts the shortcut away');
  ok(!(await page.locator('#stories').isHidden()), 'her shelf is right there behind it');
  ok(!(await page.locator('#sendband').isHidden()), 'and the picture is still in her hand');
  const tile = page.locator('#shelftiles .stile', { hasText: 'Wormsicles' });
  await tile.click();
  await page.waitForFunction(() => document.getElementById('stories').hidden);
  ok(await page.evaluate(() => localStorage.getItem('scratchpad_pad')) === 'p4',
    'picking by hand still opens any story on the shelf');

  await browser.close();
  server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall pass');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
