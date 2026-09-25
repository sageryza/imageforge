#!/usr/bin/env node
/* A POSTER THAT LANDS AFTER THE CLIP (2026-09-25, Sophie: "it takes a while
 * to make posters in footage?"). (The watched eye that shipped beside this
 * came off the same day — "no eye pls".)
 *
 * The REAL page headless against a stub feed, and every assertion is a
 * MEASUREMENT: how many times the page really asked for the feed after a clip
 * came back finished with no poster (the pre-fix page asks once and stops), the
 * poster really rendered as a picture once the stub grew one, and the poll
 * stopping again once only a stale posterless clip is left.
 *
 * Run: node scripts/test-footage-poster-poll.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
function report() {
  if (fails.length) {
    console.log('FOOTAGE POSTER POLL — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE POSTER POLL — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage watched: playwright not installed — skipped'); report(); return;
  }
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
const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
// a 1x1 jpeg, so the poster is a real picture the browser decodes
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z', 'base64');
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const clip = (id, o) => Object.assign({ id, prompt: 'clip ' + id, model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
  seconds: 4, resolution: '480p', ratio: '3:4', sound: true, refs: [], status: 'done', video: '/clip.mp4', source: '/clip.mp4',
  poster: '', seed: 7, sentAt: iso(now - 60000), doneAt: iso(now - 20000), estimate: 4.4, vote: '', trims: [] }, o);
// FRESH — finished 20s ago, poster still baking; STALE — finished an hour ago,
// its poster never came; READY — poster already there
const jobs = [clip('fresh'), clip('stale', { sentAt: iso(now - 3700000), doneAt: iso(now - 3600000) }), clip('ready', { poster: '/poster.jpg' })];
let feedReads = 0, growAt = 3;   // the stub grows the fresh clip's poster on the third read

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/footage') {
    const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL;
    res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
  }
  if (u.pathname === '/poster.jpg') { res.writeHead(200, { 'content-type': 'image/jpeg' }); return res.end(JPG); }
  if (u.pathname === '/clip.mp4') { res.writeHead(200, { 'content-type': 'video/mp4' }); return res.end(Buffer.alloc(0)); }
  if (u.pathname === '/api/footage/status') {
    return json({ ok: true, doors: { atlascloud: true }, chat: 'footage',
      balances: { atlascloud: { configured: true } },
      models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)),
      ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
  }
  if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', exact: true });
  if (u.pathname === '/api/footage/jobs' && req.method === 'GET') {
    if (u.searchParams.get('story')) return json({ ok: true, jobs: [], more: false, folders: {} });
    feedReads += 1;
    if (feedReads >= growAt) jobs[0].poster = '/poster.jpg';
    return json({ ok: true, jobs, more: false, folders: {} });
  }
  if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
  if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
  res.writeHead(404); res.end('nope');
});

// what a tile really shows: whether its face is a decoded picture
const readTiles = () => {
  const out = {};
  document.querySelectorAll('#tiles .cell').forEach((c) => {
    const img = c.querySelector('.face img');
    out[c.dataset.id] = { img: !!img && img.naturalWidth > 0 };
  });
  return out;
};

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#feed .job').length === 3);
  await page.click('#v-tiles');
  await page.waitForSelector('#tiles .cell[data-id="ready"]');
  await page.waitForTimeout(300);

  // ── 1. THE PAGE KEEPS ASKING WHILE A FINISHED CLIP HAS NO POSTER ────────
  // The pre-fix page read the feed once (nothing drawing → no poll) and the
  // fresh clip's tile stayed a film glyph until she left and came back.
  const reads0 = feedReads;
  let t0 = await page.evaluate(readTiles);
  ok('at first the fresh clip has no picture and the ready one has', !t0.fresh.img && t0.ready.img);
  await page.waitForFunction(() => {
    const c = document.querySelector('#tiles .cell[data-id="fresh"] .face img');
    return !!c && c.naturalWidth > 0;
  }, null, { timeout: 25000 }).catch(() => {});
  const t1 = await page.evaluate(readTiles);
  ok('the page polled again on its own — ' + (feedReads - reads0) + ' more reads', feedReads - reads0 >= 2);
  ok('and the fresh clip\'s poster is on its tile as a decoded picture', t1.fresh.img);
  // the poll STOPS once the poster is there and nothing else is waited on;
  // the STALE clip (an hour, no poster) must not keep it going
  const reads1 = feedReads;
  await page.waitForTimeout(9000);
  ok('then it stops: no further reads in 9s with only the stale clip posterless — ' + (feedReads - reads1), feedReads - reads1 === 0);
  ok('the stale clip is still the film glyph, honestly', !t1.stale.img);

  ok('no page errors — ' + errors.join(' | '), errors.length === 0);
  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
