#!/usr/bin/env node
/* FOOTAGE — THE RECENT BOX IS WHAT SHE UPLOADED (2026-09-10, Sophie:
   "take out trimmed clips from recents" → "recents is recent UPLOADED" →
   "uploaded videos").

   For a few hours that morning the drawer also listed a job's own finished
   clip and its baked last frame, at her ask, and she took both back out the
   same day. So the contract is: the REFERENCES she has attached — stills and
   videos alike, newest job first, one tile per url — and nothing the door
   drew. The outputs belong to the wall.

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

// Newest first as the feed answers it. Every job carries a `video` (and some
// a `lastFrame`) that must NEVER reach the drawer; `refs` is what does.
let jobs = [
  { id: 'newest', prompt: 'the ward corridor', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
    seconds: 4, resolution: '480p', ratio: '16:9', sound: true, status: 'done',
    video: 'http://127.0.0.1:PORT/mine-newest.mp4', poster: 'http://127.0.0.1:PORT/ref.png',
    lastFrame: 'http://127.0.0.1:PORT/last-newest.png',
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
  // trimmed — its clip is out of the box like every other clip; its own
  // reference stays
  { id: 'trimmed', prompt: 'the one she cut', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
    seconds: 4, resolution: '480p', ratio: '16:9', sound: true, status: 'done',
    video: 'http://127.0.0.1:PORT/trim-part1.mp4', source: 'http://127.0.0.1:PORT/whole.mp4',
    poster: 'http://127.0.0.1:PORT/ref.png',
    lastFrame: 'http://127.0.0.1:PORT/last-trimmed.png',
    trims: [{ start: 0.5, end: 2.5, seconds: 2, key: 'k1', status: 'ready', url: 'http://127.0.0.1:PORT/trim-part1.mp4', poster: 'http://127.0.0.1:PORT/ref.png' }],
    refs: [{ url: 'http://127.0.0.1:PORT/trim-ref.png', kind: 'image' }],
    sentAt: '2026-09-10T06:45:00.000Z', vote: '', hidden: false },
  // trimming, nothing baked yet — its clip is out of the box too
  { id: 'baking', prompt: 'mid-trim', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
    seconds: 4, resolution: '480p', ratio: '16:9', sound: true, status: 'done',
    video: 'http://127.0.0.1:PORT/baking.mp4', source: 'http://127.0.0.1:PORT/baking.mp4',
    poster: 'http://127.0.0.1:PORT/ref.png',
    trims: [{ start: 0, end: 2, seconds: 2, key: 'k2', status: 'baking', url: '', poster: '' }],
    refs: [], sentAt: '2026-09-10T06:40:00.000Z', vote: '', hidden: false },
  // its clip was ALSO used as a reference on the newest job — the REFERENCE
  // is what the drawer lists, once
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

  // NOTHING THE DOOR DREW IS IN THE BOX — measured off what the tiles really
  // point at and what they are labelled, since a clip's poster and a still
  // reference are the same markup to any source assertion.
  const srcs = await page.$$eval('#recent .rc img', (els) => els.map((e) => e.src));
  const labels = await page.$$eval('#recent .rc', (els) => els.map((e) => e.getAttribute('aria-label') || ''));
  ok('the box is not empty', tiles.length > 0);
  ok('no finished clip of hers is offered',
    !srcs.some((u) => /mine-newest\.mp4|exed\.mp4|baking\.mp4|trim-part1\.mp4|whole\.mp4/.test(u))
    && !labels.some((a) => /Attach this clip/.test(a)));
  ok('no baked last frame is offered either',
    !srcs.some((u) => /last-newest\.png|last-trimmed\.png/.test(u))
    && !labels.some((a) => /Attach the last frame/.test(a)));
  ok('every tile says the same thing — attach it again', tiles.every((t) => t.title === 'Attach again'));

  // WHAT IS IN IT: her references, newest job first.
  ok('an uploaded still is offered', srcs.some((u) => /still\.png/.test(u)));
  ok('an uploaded video is offered', labels.some((a) => /the shot before/.test(a)));
  ok('a reference off an older job is offered too', srcs.some((u) => /trim-ref\.png/.test(u)));
  ok('exactly the four distinct references, and no more',
    (await page.$$eval('#recent .rc', (els) => els.length)) === 4);

  // A VIDEO READS AS A VIDEO — measured, since a poster and a still are the
  // same picture to any markup assertion.
  const badged = tiles.filter((t) => t.badge);
  ok('a video reference with a poster wears the film mark', badged.length === 1 && badged.every((t) => t.pic));
  ok('an image reference wears no mark', tiles.some((t) => t.pic && !t.badge && /still\.png/.test(t.src)));
  ok('a video with no poster draws the film glyph and needs no mark',
    tiles.some((t) => t.glyph && !t.badge));
  ok('every tile is the same 52px square', tiles.length > 0 && tiles.every((t) => t.w === 52));

  // ONE TILE PER URL: `shot-before.mp4` is a reference on the newest job AND
  // the older job's own clip — the reference is what shows, once.
  ok('a url used twice is listed once',
    labels.filter((a) => /the shot before/.test(a)).length === 1 && !labels.some((a) => /the socks/.test(a)));

  // THE TAP HAS TO REACH THE REQUEST — a lit thumb says nothing about what
  // left the phone.
  const vidIdx = labels.findIndex((a) => /the shot before/.test(a));
  await page.$$eval('#recent .rc', (els, i) => els[i].click(), vidIdx);
  await page.waitForSelector('#refs .ref');
  ok('attaching a video reference names it as a VIDEO slot', (await page.$eval('#refs .slot', (e) => e.textContent)) === '[Video1]');
  await page.fill('#prompt', 'the same room, one shot later');
  await page.click('#go');
  await page.waitForTimeout(300);
  const sent = posted[0] || {};
  const vids = (sent.refs || []).filter((r) => r.kind === 'video').map((r) => r.url);
  ok('it really rides the job as a reference video', vids.some((v) => /shot-before\.mp4/.test(v)));
  ok('and it carries its poster, so the strip shows the frame she picked',
    (sent.refs || []).some((r) => /shot-before\.mp4/.test(r.url) && /ref\.png/.test(r.poster || '')));

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
