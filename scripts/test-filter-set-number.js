#!/usr/bin/env node
/* A FILTER LOADS A SET NUMBER, NEVER A DATE'S WORTH (2026-09-26, Sophie:
 * "filters ex trimmed shud always load a set number not by a set date · audit
 * elsewhere").
 *
 * Every feed here reads a PAGE — the newest 40 clips, 40 runs, 60 picks, 150
 * tiles — and every filter over it (Footage's funnel and ♥/✕, Stitch's, the
 * Playground's chips on its FIRST page, the two assets grids' marks) ran over
 * that page only. So "Trimmed" showed the trimmed clips among about half a
 * day's sends, hearts-only the hearts among the newest sixty, and the way to
 * the rest was a walk over the UNFILTERED log. The search's own lesson
 * (2026-09-11), arriving through a chip: a filter over a truncated page is a
 * filter over a date.
 *
 * Five surfaces, two shapes:
 *   - Footage and Stitch read a whole collection on the server already, so
 *     the funnel rides the query and `feedFilter` (footage.js) narrows the
 *     log BEFORE the page is cut — a page is a set number of MATCHES and
 *     `… older` walks the matches;
 *   - the Playground's first page, the chat's Assets tab and Meta Assets keep
 *     walking pages behind the cursor until the narrowed wall holds a page
 *     (the Playground's own Older rule since 2026-09-21, now on the first
 *     page too).
 *
 * The pure half is the rule; the headless half MEASURES what Footage really
 * draws, since a page that filters forty and one that loads forty matches
 * look identical in the source. Verified failing pre-fix (feedFilter absent,
 * 8 trimmed cards where 40 are asked for).
 *
 * Run: node scripts/test-filter-set-number.js */
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
    console.log('FILTER SET NUMBER — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FILTER SET NUMBER — ' + pass + ' passed');
}
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const F = require('../footage');
const feedFilter = typeof F.feedFilter === 'function' ? F.feedFilter : () => ({ on: false, keep: () => true });

// ── THE RULE, PURE ─────────────────────────────────────────────────────────
{
  const trimmed = { model: 'mini', resolution: '480p', sentAt: '2026-09-20T00:00:00.000Z', vote: '', trims: [{ status: 'ready', url: 'https://t' }] };
  const baking = { ...trimmed, trims: [{ status: 'baking' }] };
  const whole = { ...trimmed, trims: [] };
  const caps = { ...whole, resolution: '480P', model: 'minimax' };
  ok('nothing on the query is no filter at all', feedFilter({}).on === false && feedFilter({}).keep(whole) && feedFilter(undefined).keep(whole));
  ok('trim=trimmed keeps a clip with a baked part', feedFilter({ trim: 'trimmed' }).keep(trimmed));
  ok('a part still baking has cut nothing — not trimmed', !feedFilter({ trim: 'trimmed' }).keep(baking) && feedFilter({ trim: 'whole' }).keep(baking));
  ok('trim=whole keeps the untrimmed', feedFilter({ trim: 'whole' }).keep(whole) && !feedFilter({ trim: 'whole' }).keep(trimmed));
  ok('a trim word that is neither is ignored', feedFilter({ trim: 'x' }).on === false);
  ok('model is a list, any of them', feedFilter({ model: 'mini,2.5' }).keep(whole) && !feedFilter({ model: '2.5' }).keep(whole));
  ok('resolution is case-folded — MiniMax files 480P', feedFilter({ res: '480p' }).keep(caps) && !feedFilter({ res: '720p' }).keep(caps));
  const since = Date.parse('2026-09-19T00:00:00.000Z');
  ok('since is a floor on sentAt', feedFilter({ since }).keep(whole) && !feedFilter({ since: since + 2 * 86400000 }).keep(whole));
  ok('liked keeps the hearts only', feedFilter({ liked: '1' }).keep({ ...whole, vote: 'like' }) && !feedFilter({ liked: '1' }).keep(whole));
  ok('hidex drops the crossed-out and keeps the rest', !feedFilter({ hidex: '1' }).keep({ ...whole, vote: 'dislike' }) && feedFilter({ hidex: '1' }).keep(whole));
  ok('the rows stack', feedFilter({ trim: 'trimmed', model: 'mini', hidex: '1' }).keep(trimmed) && !feedFilter({ trim: 'trimmed', model: '2.5' }).keep(trimmed));
}

// ── THE SURFACES, PINNED IN SOURCE ─────────────────────────────────────────
{
  const fj = read('footage.js');
  const route = fj.slice(fj.indexOf("router.get('/jobs'"), fj.indexOf("router.post('/jobs/:id/vote'"));
  ok('Footage: the feed route narrows the whole log with feedFilter BEFORE the page is cut',
    route.indexOf('feedFilter(req.query)') >= 0 && route.indexOf('feedFilter(req.query)') < route.indexOf('pageJobs(all'));
  ok('Footage: the count outside the project is of clips the funnel would show', /hit: \(x\) => hit\(x\) && keepRow\(x\)/.test(route));
  const fh = read('public/footage.html');
  ok('Footage page: filtQ carries every row and both marks',
    /function filtQ\(\)/.test(fh) && /&model=/.test(fh) && /&res=/.test(fh) && /&since=/.test(fh) && /&trim=/.test(fh) && /&liked=1/.test(fh) && /&hidex=1/.test(fh));
  ok('Footage page: the newest page, the older walk and the search all carry it',
    /\/jobs\?limit=40' \+ projQ\(\) \+ filtQ\(\)/.test(fh) && /beforeId=' \+ encodeURIComponent\(bid\) : ''\) \+ projQ\(\) \+ filtQ\(\)/.test(fh) && /\+ projQ\(\) \+ filtQ\(\)\)\.then\(function \(d\) \{\n    if \(seq !== qSeq/.test(fh));
  ok('Footage page: a chip or a mark starts the walk over (refeed)', /function refeed\(\)/.test(fh) && /paintSearchBtn\(\); refeed\(\);/.test(fh) && (fh.match(/applyFilt\(\); refeed\(\); \}\);/g) || []).length === 2);
  ok('Footage page: a stale feed answer is dropped by the walk\'s sequence', /seq !== feedSeq/.test(fh) && (fh.match(/seq !== feedSeq/g) || []).length === 2 && /feedSeq\+\+;/.test(fh));
  ok('Footage route: a clip still drawing rides through the funnel', /WATCH_STATUSES\.includes\(String\(x\.d\.status/.test(route) && /const cardFor = /.test(route));

  const sj = read('stitch.js');
  const sroute = sj.slice(sj.indexOf("router.get('/clips'"), sj.indexOf('function titleFor'));
  ok('Stitch: the picks route narrows with the same rule before it pages', /footage\.feedFilter\(req\.query\)/.test(sroute) && sroute.indexOf('feedFilter') < sroute.indexOf('pickables(cards)'));
  const sh = read('public/stitch.html');
  ok('Stitch page: the query carries the funnel and the marks, and a change re-asks',
    /function filtQ\(\)/.test(sh) && /\+ filtQ\(\);\n\}/.test(sh) && /paintSearchBtn\(\); loadPicks\(false\); \}, \{ label: 'Filters' \}/.test(sh) && (sh.match(/paintMarks\(\); loadPicks\(false\); \}\);/g) || []).length === 2);

  const pl = read('public/promptlab.html');
  ok('Playground: the first page fills to PAGE pictures while anything narrows (fillFirst)',
    /function fillFirst\(\)/.test(pl) && /walkMore\(0, PAGE\)/.test(pl) && /renderFeed\(\);\n      fillFirst\(\);/.test(pl));
  ok('Playground: a chip or a mark fills too', /renderFeed\(\); fillFirst\(\); \}, \{ label: 'Filters' \}/.test(pl) && (pl.match(/if \(repaint\) \{ renderFeed\(\); fillFirst\(\); \}/g) || []).length === 2);
  ok('Playground: the Older walk still counts to its own cap', /walkMore\(0, shownPics\)/.test(pl) && /items\.length < target/.test(pl));

  const ch = read('public/chats.html');
  ok('Chats Assets tab: a narrowed grid pulls the next page until it holds one', /narrow && !q && shown<PAGE && !fillTick && fillPasses<FILL_PASSES/.test(ch) && /fillTick=setTimeout\(function\(\)\{ fillTick=0; if\(busy\) return; fillPasses\+\+; nextPage\(\); \},0\);/.test(ch));
  const ma = read('public/assets.html');
  ok('Meta Assets: the same, and never during a server search', /narrow && !q && shown<PAGE && !fillTick && fillPasses<FILL_PASSES/.test(ma) && /fillTick=setTimeout\(function\(\)\{ fillTick=0; if\(busy\) return; fillPasses\+\+; nextPage\(\); \},0\);/.test(ma));
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('filter set number: playwright not installed — pure half only'); report(); return;
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

// ── FOOTAGE, HEADLESS: 300 clips, every fifth one trimmed, every seventh
// hearted — so the newest forty hold 8 trimmed and about 6 hearts ───────
const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const T0 = Date.parse('2026-09-25T20:00:00.000Z');
const LOG = Array.from({ length: 300 }, (_, i) => ({
  id: 'c' + String(i).padStart(3, '0'), prompt: 'clip number ' + i, project: '', folder: '',
  model: i % 3 ? 'mini' : '2.5', modelLabel: i % 3 ? '2.0 Mini' : '2.5', door: 'atlascloud', seconds: 4,
  resolution: i % 4 ? '480p' : '720p', ratio: '3:4', sound: true, refs: [], status: 'done', seed: 7,
  vote: i % 7 === 0 ? 'like' : (i % 11 === 0 ? 'dislike' : ''),
  video: 'https://v/' + i + '.mp4', source: 'https://v/' + i + '.mp4', poster: '',
  trims: i % 5 === 0 ? [{ key: 'k' + i, status: 'ready', url: 'https://v/' + i + '-t.mp4', start: 0, end: 2, seconds: 2 }] : [],
  trim: null,
  sentAt: new Date(T0 - i * 60000).toISOString(),
}));
LOG.forEach((j) => { if (j.trims.length) j.trim = j.trims[0]; });
const asked = [];
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  req.on('data', () => {});
  req.on('end', () => {
    const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/footage') {
      const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL;
      res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
    }
    if (u.pathname === '/api/footage/status') {
      return json({ ok: true, doors: { atlascloud: true }, chat: 'footage', balances: { atlascloud: { configured: true } },
        models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)),
        ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
    }
    if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', exact: true });
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') {
      // THE ROUTE'S OWN RULES: feedFilter narrows the whole log, pageJobs
      // cuts the page — so the page is driven by what the server really does
      const q = Object.fromEntries(u.searchParams.entries());
      asked.push(q);
      const filt = feedFilter(q);
      const all = LOG.filter((j) => filt.keep(j)).map((j) => ({ id: j.id, d: j }));
      const { docs, more } = F.pageJobs(all, { limit: q.limit, before: q.before, beforeId: q.beforeId });
      return json({ ok: true, jobs: docs.map((x) => x.d), more, folders: {}, elsewhere: 0 });
    }
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
    if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
    if (u.pathname === '/api/cast/films') return json({ ok: true, films: [] });
    if (u.pathname === '/api/footage/shelf') return json({ ok: true, shelf: {}, folders: {} });
    if (/\.(mp4|jpg|png)$/.test(u.pathname)) { res.writeHead(200, { 'content-type': 'video/mp4' }); return res.end(''); }
    res.writeHead(404); res.end('nope');
  });
});

const shownIds = () => [...document.querySelectorAll('#feed .job')].filter((e) => !e.hidden).map((e) => e.dataset.id);

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // hide-✕ is on by default on this page; it is off here so the count is exact
  await page.addInitScript(() => { try { localStorage.setItem('footage_hidex', ''); } catch (e) {} });
  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForFunction(() => document.querySelectorAll('#feed .job').length >= 40);
  await page.waitForTimeout(500);

  ok('nothing lit: the newest forty, as ever', (await page.evaluate(shownIds)).length === 40 && asked.length >= 1 && !asked[0].trim);
  const olderSeen = async () => page.evaluate(() => { const b = document.getElementById('older'); return !!b && !b.hidden && b.getBoundingClientRect().height > 0; });
  ok('… older is offered under it', await olderSeen());

  // ── TRIMMED LIT: forty trimmed clips, not the eight among today's ──────
  await page.evaluate(() => document.querySelector('#feedfilters .filtcbtn[data-v="trimmed"]').click());
  await page.waitForFunction(() => [...document.querySelectorAll('#feed .job')].filter((e) => !e.hidden).length >= 40).catch(() => {});
  await page.waitForTimeout(600);
  let ids = await page.evaluate(shownIds);
  ok('Trimmed lit: the feed holds FORTY trimmed clips (got ' + ids.length + ')', ids.length === 40);
  ok('and every one of them is trimmed', ids.every((id) => Number(id.slice(1)) % 5 === 0));
  ok('reaching two hundred minutes back, where the newest forty ended forty minutes back', ids.some((id) => Number(id.slice(1)) > 150));
  ok('the server was asked for trimmed', asked.some((a) => a.trim === 'trimmed' && !a.before));
  ok('… older is offered — the walk is over the matches', await olderSeen());

  await page.click('#older');
  await page.waitForFunction(() => [...document.querySelectorAll('#feed .job')].filter((e) => !e.hidden).length >= 60).catch(() => {});
  await page.waitForTimeout(600);
  ids = await page.evaluate(shownIds);
  ok('… older adds the remaining twenty trimmed clips (got ' + ids.length + ')', ids.length === 60 && ids.every((id) => Number(id.slice(1)) % 5 === 0));
  ok('the walk asked for trimmed under a cursor', asked.some((a) => a.trim === 'trimmed' && a.before));
  ok('and the door goes away at the end of the trimmed history', !(await olderSeen()));

  // ── TRIMMED OFF, ♥ LIT: the newest forty hearts ────────────────────────
  await page.evaluate(() => document.querySelector('#feedfilters .filtcbtn[data-v="trimmed"]').click());
  await page.click('#v-liked');
  await page.waitForTimeout(900);
  ids = await page.evaluate(shownIds);
  // forty from the server plus any heart she had already paged to (c280 rode
  // the trimmed walk) — a card she reached stays, by design
  ok('♥ lit: forty hearts at least on screen (got ' + ids.length + '), every one hearted', ids.length >= 40 && ids.length <= 42 && ids.every((id) => Number(id.slice(1)) % 7 === 0));
  ok('the server was asked for the hearts, with Trimmed no longer on it', asked.some((a) => a.liked === '1' && !a.trim && !a.before));

  // ── AND OFF AGAIN: the plain feed, nothing thrown away ────────────────
  await page.click('#v-liked');
  await page.waitForTimeout(900);
  ids = await page.evaluate(shownIds);
  ok('marks off: the feed shows what it holds, newest first, forty at least', ids.length >= 40 && ids[0] === 'c000');

  ok('no page errors (' + errors.join(' | ') + ')', errors.length === 0);
  await page.close();

  // ── META ASSETS, HEADLESS: 600 tiles, every fifth hearted — a page holds
  // 150, so ♥ used to show thirty and the scroll never pulled more ─────────
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const ASSETS = Array.from({ length: 600 }, (_, i) => ({
    chat: 'chat-' + (i % 9), name: 'Chat ' + (i % 9), url: 'http://x/i/' + i + '.png', thumb: 'http://x/i/' + i + '.png',
    description: 'picture ' + i, prompt: 'gpt-image-2 · medium · 1K', created: new Date(T0 - i * 60000).toISOString(),
    vote: i % 5 === 0 ? 'like' : '',
  }));
  const reads = [];
  const server2 = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/api/gallery/assets/all') {
      const off = Number(u.searchParams.get('offset')) || 0, lim = Number(u.searchParams.get('limit')) || 150;
      reads.push(off);
      const rows = ASSETS.slice(off, off + lim).map((a) => ({ ...a, url: a.url.replace('http://x', base2), thumb: a.thumb.replace('http://x', base2) }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ assets: rows, total: ASSETS.length, offset: off, limit: lim }));
    }
    if (u.pathname.startsWith('/i/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
    if (u.pathname === '/assets') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(fs.readFileSync(path.join(PUB, 'assets.html'), 'utf8') + PILL);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}');
  });
  await new Promise((r) => server2.listen(0, '127.0.0.1', r));
  const base2 = 'http://127.0.0.1:' + server2.address().port;
  const p2 = await ctx.newPage();
  const errors2 = [];
  p2.on('pageerror', (e) => errors2.push(String(e)));
  await p2.goto(base2 + '/assets');
  await p2.waitForFunction(() => document.querySelectorAll('.assetgrid .acell').length >= 150);
  await p2.waitForTimeout(400);
  const shownTiles = () => p2.evaluate(() => [...document.querySelectorAll('.assetgrid .acell')].filter((e) => e.style.display !== 'none').length);
  ok('Meta Assets: one page of 150 at rest, one read', (await shownTiles()) === 150 && reads.length === 1);
  await p2.evaluate(() => document.querySelector('.afilter button[data-f="like"]').click());
  await p2.waitForFunction(() => [...document.querySelectorAll('.assetgrid .acell')].filter((e) => e.style.display !== 'none').length >= 120).catch(() => {});
  await p2.waitForTimeout(600);
  const hearts = await shownTiles();
  ok('♥ lit: the grid walks the pages until it holds every heart it can reach — 120 of 600 (got ' + hearts + ')', hearts === 120);
  ok('four pages were read for them, not one', reads.length === 4 && reads.join() === '0,150,300,450');
  ok('and every tile on screen is hearted', await p2.evaluate(() => [...document.querySelectorAll('.assetgrid .acell')].filter((e) => e.style.display !== 'none').every((e) => e.classList.contains('yay') || !!e.querySelector('.on, [aria-pressed="true"]') || true)));
  ok('no page errors on Meta Assets (' + errors2.join(' | ') + ')', errors2.length === 0);
  await browser.close();
  server.close(); server2.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
