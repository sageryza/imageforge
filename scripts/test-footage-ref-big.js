#!/usr/bin/env node
/* FOOTAGE — A CHOSEN REFERENCE OPENS BIGGER (2026-09-12, Sophie: "make
   clicking on a chosen reference open it bigger").

   The strip's tiles are 72px, which is too small to check that the picture
   riding as [Image2] is the one she meant — and it was the one place on this
   page where a picture could not be looked at at all.

   EVERY ASSERTION HERE IS A MEASUREMENT of what is on screen. A tile that
   carries a click handler and opens nothing, one that opens the overlay with
   the 72px thumb still in it, and one that opens the trim bar over a
   reference there is nothing to cut all look identical in the source.

   Run: node scripts/test-footage-ref-big.js */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
function report() {
  if (fails.length) { console.log('FOOTAGE REF BIG — ' + pass + ' passed, ' + fails.length + ' FAILED'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('FOOTAGE REF BIG — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) { console.log('footage ref big: playwright not installed — skipped'); report(); return; }
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
// A REAL 600x900 PNG, not a 1x1 — the overlay sizes itself to the picture, so
// "bigger than the tile" can only be measured against a picture that has a
// size (a reference she uploads is 1024px and up).
let PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

let jobs = [
  { id: 'one', prompt: 'the ward corridor', model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
    seconds: 4, resolution: '480p', ratio: '16:9', sound: true, status: 'done',
    video: 'http://127.0.0.1:PORT/clip.mp4', poster: 'http://127.0.0.1:PORT/ref.png',
    refs: [
      { url: 'http://127.0.0.1:PORT/still.png', kind: 'image', name: 'the pajamas' },
      { url: 'http://127.0.0.1:PORT/shot-before.mp4', kind: 'video', poster: 'http://127.0.0.1:PORT/ref.png', name: 'the shot before' },
      { url: 'http://127.0.0.1:PORT/room-tone.m4a', kind: 'audio', name: 'the room tone' },
    ],
    sentAt: '2026-09-11T08:00:00.000Z', cost: 4, estimate: 4, vote: '', hidden: false },
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
    if (u.pathname.endsWith('.m4a')) { res.writeHead(200, { 'content-type': 'audio/mp4' }); return res.end(''); }
    if (u.pathname === '/api/footage/status') {
      return json({ ok: true, doors: { atlascloud: true }, balances: { atlascloud: { configured: true } },
        models: F.publicModels(), ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
    }
    if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4, door: 'atlascloud', exact: true });
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs });
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, assets: [] });
    res.writeHead(404); res.end('nope');
  });
});

(async () => {
  try {
    const sharp = require('sharp');
    PNG = await sharp({ create: { width: 600, height: 900, channels: 3, background: '#8a7f6d' } }).png().toBuffer();
  } catch (e) { /* the 1x1 stands in; the size assertion below says so */ }
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  jobs = JSON.parse(JSON.stringify(jobs).replace(/PORT/g, String(port)));
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/footage`);
  await page.waitForSelector('#job-one');
  await page.waitForTimeout(400);
  ok('no page errors', errors.length === 0);

  // attach all three off the Recent drawer — her own door, so the strip holds
  // exactly what a real session's does
  await page.click('#rectog');
  await page.waitForTimeout(200);
  const n = await page.$$eval('#recent .rc', (els) => els.length);
  for (let i = 0; i < n; i += 1) {
    await page.$$eval('#recent .rc', (els, k) => els[k] && els[k].click(), i);
    await page.waitForTimeout(120);
    if (await page.$eval('#recent', (e) => e.hidden)) { await page.click('#rectog'); await page.waitForTimeout(120); }
  }
  await page.waitForSelector('#refs .ref');
  const kinds = await page.$$eval('#refs .ref', (els) => els.map((e) => ({
    slot: (e.querySelector('.slot') || {}).textContent || '',
    button: Boolean(e.querySelector('button.im')),
    w: Math.round(e.querySelector('.im').getBoundingClientRect().width),
    h: Math.round(e.querySelector('.im').getBoundingClientRect().height),
  })));
  ok('all three references are in the strip', kinds.length === 3);
  const pic = kinds.findIndex((k) => /Image/.test(k.slot));
  const vid = kinds.findIndex((k) => /Video/.test(k.slot));
  const aud = kinds.findIndex((k) => /Audio/.test(k.slot));
  ok('a picture and a video are both in it', pic >= 0 && vid >= 0);
  ok('an audio reference is in it too', aud >= 0);

  // THE TILE DID NOT CHANGE SIZE — the base button rule pads 7/11, so without
  // `padding:0` the thumb would draw inset inside its own 72px box.
  ok('every tile is still the same 72px square', kinds.every((k) => k.w === 72 && k.h === 72));

  ok('a picture tile is a button', kinds[pic].button);
  ok('a video tile is a button', kinds[vid].button);
  // there is nothing to open bigger, so there is no control at all
  ok('an audio tile is NOT a button', !kinds[aud].button);

  // ── A PICTURE OPENS BIG ────────────────────────────────────────────────
  await page.$$eval('#refs .ref button.im', (els, i) => { if (els[i]) els[i].click(); }, 0);
  await page.waitForTimeout(250);
  const shot = await page.evaluate(() => {
    const pl = document.getElementById('player');
    const im = pl.querySelector('img.pimg');
    const r = im ? im.getBoundingClientRect() : null;
    return {
      open: !pl.hidden,
      src: im ? im.src : '',
      w: r ? Math.round(r.width) : 0,
      h: r ? Math.round(r.height) : 0,
      save: !document.getElementById('psave').hidden,
      first: !document.getElementById('pfirst').hidden,
      ref: !document.getElementById('pref').hidden,
      trim: document.getElementById('trimbar').hidden,
      locked: document.body.style.overflow === 'hidden',
    };
  });
  ok('tapping a picture reference opens the overlay', shot.open);
  ok('it is that picture', /still\.png/.test(shot.src));
  // BIGGER IS THE WHOLE ASK — measured against the 72px tile it was tapped on
  ok('and it really is bigger than the tile', shot.w > 200 && shot.h > 200);
  ok('the page is frozen behind it', shot.locked);
  ok('there is no trim bar over a reference', shot.trim);
  ok('save is offered', shot.save);
  // both would be no-ops: it IS a reference already, and "first frame" is the
  // flag on its own tile
  ok('the "use this frame" doors are not offered', !shot.first && !shot.ref);

  // the way out is the way out she already knows
  await page.evaluate(() => { const b = document.querySelector('#player .pclose'); if (b) b.click(); });
  await page.waitForTimeout(200);
  ok('the ✕ closes it', await page.$eval('#player', (e) => e.hidden));
  ok('and the page is unfrozen', await page.evaluate(() => document.body.style.overflow !== 'hidden'));
  ok('the strip is untouched — nothing was attached or dropped',
    (await page.$$eval('#refs .ref', (els) => els.length)) === 3);

  // ── A VIDEO OPENS IN THE PLAYER, WITH NO TRIM BAR ──────────────────────
  await page.$$eval('#refs .ref button.im', (els, i) => { if (els[i]) els[i].click(); }, 1);
  await page.waitForTimeout(250);
  const play = await page.evaluate(() => {
    const pl = document.getElementById('player');
    const v = pl.querySelector('video');
    return { open: !pl.hidden, src: v ? v.src : '', trim: document.getElementById('trimbar').hidden,
      still: Boolean(pl.querySelector('img.pimg')) };
  });
  ok('tapping a video reference opens the player', play.open);
  ok('it is that clip', /shot-before\.mp4/.test(play.src));
  ok('a reference has nothing to cut, so no trim bar', play.trim);
  ok('the still from the last open is gone', !play.still);

  await page.evaluate(() => document.getElementById('player').click());
  await page.waitForTimeout(200);
  ok('the backdrop closes it too', await page.$eval('#player', (e) => e.hidden));

  // the ✕ on a tile still means the ✕ — the two controls share a cell
  await page.$$eval('#refs .ref', (els) => els[0].querySelector('.x').click());
  await page.waitForTimeout(200);
  ok('the ✕ on a tile still takes that reference off',
    (await page.$$eval('#refs .ref', (els) => els.length)) === 2);
  ok('still no page errors', errors.length === 0);

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
