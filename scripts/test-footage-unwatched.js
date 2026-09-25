#!/usr/bin/env node
/* A DOT ON A FINISHED CLIP SHE HAS NOT PLAYED (2026-09-25, Sophie: "i forget
 * which ive watched" · "no eye pls" · "maybe do an unwatched symbol instead").
 *
 * The REAL page headless against a stub feed, every assertion a MEASUREMENT of
 * the dot's box on screen: on every finished clip newer than the phone's floor,
 * on none before anything is played on a phone whose floor is newer than the
 * clips, gone from the one she plays (tile AND list card), still gone after a
 * reload, and never on a clip still drawing.
 *
 * Run: node scripts/test-footage-unwatched.js
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
    console.log('FOOTAGE UNWATCHED — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE UNWATCHED — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage unwatched: playwright not installed — skipped'); report(); return;
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
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z', 'base64');
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const clip = (id, o) => Object.assign({ id, prompt: 'clip ' + id, model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud',
  seconds: 4, resolution: '480p', ratio: '3:4', sound: true, refs: [], status: 'done', video: '/clip.mp4', source: '/clip.mp4',
  poster: '/poster.jpg', seed: 7, sentAt: iso(now - 60000), doneAt: iso(now - 20000), estimate: 4.4, vote: '', trims: [] }, o);
const jobs = [clip('a'), clip('b'), clip('c', { status: 'drawing', video: '', poster: '', doneAt: '' })];

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
    return json({ ok: true, jobs, more: false, folders: {} });
  }
  if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
  if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
  res.writeHead(404); res.end('nope');
});

// the dot's real box, per tile and per list card
const readDots = () => {
  const box = (el) => { if (!el) return { w: 0, h: 0 }; const r = el.getBoundingClientRect(); return { w: r.width, h: r.height, l: r.left, t: r.top, r: r.right }; };
  const out = { tiles: {}, cards: {} };
  document.querySelectorAll('#tiles .cell').forEach((c) => {
    const d = box(c.querySelector('.tnew')), cr = c.getBoundingClientRect();
    out.tiles[c.dataset.id] = { w: d.w, h: d.h, inside: d.w > 0 && d.r <= cr.right + 0.5 && d.t >= cr.top - 0.5, topRight: d.w > 0 && (cr.right - d.r) < 12 && (d.t - cr.top) < 12 };
  });
  document.querySelectorAll('#feed .job').forEach((el) => { out.cards[el.dataset.id] = box(el.querySelector('.thumb .tnew')); });
  return out;
};
const lit = (d) => d && d.w >= 8 && d.h >= 8;

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });

  // ── A. A PHONE WHOSE FLOOR IS OLDER THAN THE CLIPS ─────────────────────
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('footage_seen_since')) localStorage.setItem('footage_seen_since', '1000'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#feed .job').length === 3);
  await page.click('#v-tiles');
  await page.waitForSelector('#tiles .cell[data-id="a"]');
  await page.waitForTimeout(300);
  let s = await page.evaluate(readDots);
  ok('both finished clips wear the dot — ' + JSON.stringify([s.tiles.a, s.tiles.b].map((d) => Math.round(d.w))), lit(s.tiles.a) && lit(s.tiles.b));
  ok('top-right of the tile, inside it', s.tiles.a.inside && s.tiles.a.topRight);
  ok('the clip still drawing has none', !lit(s.tiles.c));
  // play one → its dot goes, the other stays
  await page.click('#tiles .cell[data-id="a"] .tdoor.play');
  await page.waitForTimeout(300);
  await page.click('#player .pclose');
  await page.waitForTimeout(200);
  s = await page.evaluate(readDots);
  ok('played: its dot is gone', !lit(s.tiles.a));
  ok('and the other still wears it', lit(s.tiles.b));
  await page.click('#v-list');
  await page.waitForTimeout(300);
  s = await page.evaluate(readDots);
  ok('the list card agrees — b dotted, a not — ' + JSON.stringify([Math.round(s.cards.a.w), Math.round(s.cards.b.w)]), lit(s.cards.b) && !lit(s.cards.a) && !lit(s.cards.c));
  // reload → still remembered
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#feed .job').length === 3);
  await page.click('#v-tiles');
  await page.waitForSelector('#tiles .cell[data-id="a"]');
  await page.waitForTimeout(300);
  s = await page.evaluate(readDots);
  ok('after a reload the played one stays clear and the other stays dotted', !lit(s.tiles.a) && lit(s.tiles.b));
  ok('no page errors — ' + errors.join(' | '), errors.length === 0);
  await ctx.close();

  // ── B. A FRESH PHONE: the floor is now, every clip on the wall is older ──
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page2 = await ctx2.newPage();
  await page2.goto(base + '/footage');
  await page2.waitForFunction(() => document.querySelectorAll('#feed .job').length === 3);
  await page2.click('#v-tiles');
  await page2.waitForSelector('#tiles .cell[data-id="a"]');
  await page2.waitForTimeout(300);
  s = await page2.evaluate(readDots);
  ok('a fresh phone lights nothing already on the wall', !lit(s.tiles.a) && !lit(s.tiles.b) && !lit(s.tiles.c));
  const floor = await page2.evaluate(() => Number(localStorage.getItem('footage_seen_since')));
  ok('and wrote its floor — ' + floor, floor > now - 60000 && floor <= Date.now());
  await ctx2.close();

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
