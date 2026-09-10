#!/usr/bin/env node
/* FOOTAGE — THE RECENT BOX KEEPS VIDEOS, NOT JUST STILLS (2026-09-10, Sophie).

   The history drawer used to list the REFERENCES off earlier cards only, and
   her references are mostly stills — so the one video this draft keeps
   needing, the shot before, was never in the box, and the two video refs that
   were in it drew their POSTER and read as stills.

   So: a finished clip of hers is listed with its job, ahead of that job's own
   references, and anything that is a video wears a small film mark over its
   poster.

   Every assertion here is a MEASUREMENT of the rendered drawer or of what the
   send really POSTs: a tile that draws a poster and a tile that draws a poster
   with a mark on it are the same markup to any source assertion, and a tap
   that lights a thumb without reaching the request looks identical too.

   Run: node scripts/test-footage-recent.js */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
function report() {
  if (fails.length) { console.log('FOOTAGE RECENT — ' + pass + ' passed, ' + fails.length + ' FAILED'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('FOOTAGE RECENT — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) { console.log('footage recent: playwright not installed — skipped'); report(); return; }
}
function exe() {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  for (const d of fs.readdirSync(root).filter((n) => /^chromium-\d/.test(n))) {
    const p = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const F = require('../footage');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const posted = [];

// Newest first as the feed answers it. `mine` is the clip she made, `refs`
// what rode with it — the drawer must interleave the two by job.
let jobs = [
  { id: 'newest', prompt: 'the ward corridor', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
    seconds: 4, resolution: '480p', ratio: '16:9', sound: true, status: 'done',
    video: 'http://127.0.0.1:PORT/mine-newest.mp4', poster: 'http://127.0.0.1:PORT/ref.png',
    refs: [
      { url: 'http://127.0.0.1:PORT/still.png', kind: 'image' },
      { url: 'http://127.0.0.1:PORT/shot-before.mp4', kind: 'video', poster: 'http://127.0.0.1:PORT/ref.png', name: 'the shot before' },
      { url: 'http://127.0.0.1:PORT/no-poster.mp4', kind: 'video', poster: '' },
    ],
    sentAt: '2026-09-10T08:00:00.000Z', cost: 4, estimate: 4, vote: '', hidden: false },
  // crossed out — not a clip to draw the next shot from
  { id: 'exed', prompt: 'the refused one', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
    seconds: 4, resolution: '480p', ratio: '16:9', sound: true, status: 'done',
    video: 'http://127.0.0.1:PORT/exed.mp4', poster: 'http://127.0.0.1:PORT/ref.png',
    refs: [], sentAt: '2026-09-10T07:00:00.000Z', vote: 'dislike', hidden: false },
  // still drawing — there is no clip yet
  { id: 'drawing', prompt: 'still going', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
    seconds: 4, resolution: '480p', ratio: '16:9', sound: true, status: 'drawing',
    refs: [], sentAt: '2026-09-10T06:30:00.000Z', vote: '' },
  // TRIMMED — cut for the film, so the clip is out of the box (2026-09-10,
  // Sophie: "take out trimmed clips from recents"). Its own reference stays.
  { id: 'trimmed', prompt: 'the one she cut', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
    seconds: 4, resolution: '480p', ratio: '16:9', sound: true, status: 'done',
    video: 'http://127.0.0.1:PORT/trim-part1.mp4', source: 'http://127.0.0.1:PORT/whole.mp4',
    poster: 'http://127.0.0.1:PORT/ref.png',
    trims: [{ start: 0.5, end: 2.5, seconds: 2, key: 'k1', status: 'ready', url: 'http://127.0.0.1:PORT/trim-part1.mp4', poster: 'http://127.0.0.1:PORT/ref.png' }],
    refs: [{ url: 'http://127.0.0.1:PORT/trim-ref.png', kind: 'image' }],
    sentAt: '2026-09-10T06:45:00.000Z', vote: '', hidden: false },
  // trimming, nothing baked yet — it has cut nothing, so the clip still rides
  { id: 'baking', prompt: 'mid-trim', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
    seconds: 4, resolution: '480p', ratio: '16:9', sound: true, status: 'done',
    video: 'http://127.0.0.1:PORT/baking.mp4', source: 'http://127.0.0.1:PORT/baking.mp4',
    poster: 'http://127.0.0.1:PORT/ref.png',
    trims: [{ start: 0, end: 2, seconds: 2, key: 'k2', status: 'baking', url: '', poster: '' }],
    refs: [], sentAt: '2026-09-10T06:40:00.000Z', vote: '', hidden: false },
  // its clip was ALSO used as a reference later — one tile, never two
  { id: 'older', prompt: 'the socks', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
    seconds: 4, resolution: '480p', ratio: '16:9', sound: true, status: 'done',
    video: 'http://127.0.0.1:PORT/shot-before.mp4', poster: 'http://127.0.0.1:PORT/ref.png',
    refs: [], sentAt: '2026-09-10T06:00:00.000Z', vote: '', hidden: false },
];

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (u.pathname === '/footage') {
      const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '');
      res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
    }
    if (u.pathname.endsWith('.png')) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
    if (u.pathname.endsWith('.mp4')) { res.writeHead(200, { 'content-type': 'video/mp4' }); return res.end(''); }
    if (u.pathname === '/api/footage/status') {
      return json({ ok: true, doors: { atlascloud: true }, balances: { atlascloud: { configured: true } },
        models: F.publicModels(), ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
    }
    if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4, door: 'atlascloud', exact: true });
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs });
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
      posted.push(JSON.parse(body));
      return json({ ok: true, jobId: 'new1', door: 'atlascloud', fellBack: false, estimate: 4 }, 202);
    }
    if (/^\/api\/footage\/jobs\/[^/]+\/vote$/.test(u.pathname)) return json({ ok: true });
    res.writeHead(404); res.end('nope');
  });
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  jobs = JSON.parse(JSON.stringify(jobs).replace(/PORT/g, String(port)));
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/footage`);
  await page.waitForSelector('#job-newest');
  await page.waitForTimeout(400);

  ok('no page errors', errors.length === 0);
  ok('the drawer is shut until she taps the history icon', await page.$eval('#recent', (e) => e.hidden));
  await page.click('#rectog');
  await page.waitForTimeout(200);

  const tiles = await page.$$eval('#recent .rc', (els) => els.map((e) => ({
    title: e.title,
    badge: Boolean(e.querySelector('.bdg')),
    pic: Boolean(e.querySelector('img')),
    src: (e.querySelector('img') || {}).src || '',
    glyph: !e.querySelector('img') && Boolean(e.querySelector('svg')),
    w: Math.round(e.getBoundingClientRect().width),
  })));

  // HER OWN CLIP IS IN THE BOX, and it leads — the shot she just drew is what
  // the next one is chained from.
  ok('her own finished clip is offered', tiles.some((t) => t.title === 'Attach this clip'));
  ok('the newest clip is the FIRST tile', tiles[0] && tiles[0].title === 'Attach this clip');
  ok('the clip sits ahead of that job\'s own references',
    tiles.findIndex((t) => t.title === 'Attach this clip') < tiles.findIndex((t) => t.title === 'Attach again'));

  // A VIDEO READS AS A VIDEO — measured, since a poster and a still are the
  // same picture to any markup assertion.
  const badged = tiles.filter((t) => t.badge);
  ok('a video with a poster wears the film mark', badged.length >= 2 && badged.every((t) => t.pic));
  ok('an image reference wears no mark', tiles.some((t) => t.pic && !t.badge && /still\.png/.test(t.src)));
  ok('a video with no poster draws the film glyph and needs no mark',
    tiles.some((t) => t.glyph && !t.badge));
  ok('every tile is the same 52px square', tiles.length > 0 && tiles.every((t) => t.w === 52));

  // WHAT IS NOT OFFERED
  const n = await page.$$eval('#recent .rc', (els) => els.length);
  ok('a crossed-out clip is not offered', !(await page.$$eval('#recent .rc img', (els) => els.map((e) => e.src))).some((s) => /exed\.mp4/.test(s)) && n > 0);
  ok('a clip still drawing is not offered — there is nothing to attach yet',
    (await page.$$eval('#recent .rc', (els) => els.length)) === 6);
  // A TRIMMED CLIP IS OUT — measured off what the tiles really point at, since
  // a tile drawing the same poster as its reference is the same markup.
  const srcs = await page.$$eval('#recent .rc img', (els) => els.map((e) => e.src));
  ok('a trimmed clip is not offered', !srcs.some((s) => /trim-part1\.mp4|whole\.mp4/.test(s))
    && !(await page.$$eval('#recent .rc', (els) => els.map((e) => e.getAttribute('aria-label') || ''))).some((a) => /the one she cut/.test(a)));
  ok('but that job\'s own references still are', srcs.some((s) => /trim-ref\.png/.test(s)));
  ok('a clip whose trim is still baking is offered — nothing is cut yet',
    (await page.$$eval('#recent .rc', (els) => els.map((e) => e.getAttribute('aria-label') || ''))).some((a) => /mid-trim/.test(a)));
  // ONE TILE PER URL: `shot-before.mp4` is the older job's clip AND a
  // reference on the newest one.
  const labels = await page.$$eval('#recent .rc', (els) => els.map((e) => e.getAttribute('aria-label') || ''));
  ok('a clip that was also used as a reference is listed once',
    labels.filter((a) => /the shot before/.test(a)).length === 1 && !labels.some((a) => /the socks/.test(a)));

  // THE TAP HAS TO REACH THE REQUEST — a lit thumb says nothing about what
  // left the phone.
  await page.click('#recent .rc');
  await page.waitForSelector('#refs .ref');
  ok('attaching a clip names it as a VIDEO slot', (await page.$eval('#refs .slot', (e) => e.textContent)) === '[Video1]');
  await page.fill('#prompt', 'the same room, one shot later');
  await page.click('#go');
  await page.waitForTimeout(300);
  const sent = posted[0] || {};
  const vids = (sent.refs || []).filter((r) => r.kind === 'video').map((r) => r.url);
  ok('the clip really rides the job as a reference video', vids.some((v) => /mine-newest\.mp4/.test(v)));
  ok('and it carries its poster, so the strip shows the frame she picked',
    (sent.refs || []).some((r) => /mine-newest\.mp4/.test(r.url) && /ref\.png/.test(r.poster || '')));

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
