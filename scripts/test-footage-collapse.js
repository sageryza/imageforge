#!/usr/bin/env node
/* A FLOATING COLLAPSE ON AN EXPANDED CLIP (2026-09-11, Sophie: "add a
 * floating collapse button for expanded list view videos in footage").
 *
 * Driven on the REAL footage page, because every one of these is a
 * MEASUREMENT: an opener that removes itself, one that stays but sits six
 * screens down, one pinned somewhere a tap cannot reach, and one that
 * collapses the card and leaves her staring at the page below all look
 * identical in the source. Where the control really is, is read off the
 * rendered page; whether it can be TAPPED is asked with `elementFromPoint`.
 *
 * Run: node scripts/test-footage-collapse.js
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
    console.log('FOOTAGE COLLAPSE — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE COLLAPSE — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage collapse: playwright not installed — skipped'); report(); return;
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

// a scene the length she really writes — 70 lines, the shape that turns a
// 209px card into six screens
const SCENE = Array.from({ length: 70 }, (_, i) =>
  'line ' + (i + 1) + ' — the ward corridor at night, one of her own long lines').join('\n');
const clip = (id, prompt, sentAt) => ({
  id, prompt, status: 'done', model: 'seedance-2-0-mini', modelLabel: '2.0 Mini',
  seconds: 4, resolution: '480p', ratio: '16:9', sound: true, door: 'atlascloud',
  video: '/clip.mp4', source: '/clip.mp4', poster: '', refs: [], trims: [], sentAt,
});
const JOBS = [clip('long', SCENE, 2000), clip('short', 'a short one', 1000)];

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/footage') {
    const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL;
    res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
  }
  if (u.pathname === '/api/footage/status') {
    return json({ ok: true, doors: { atlascloud: true },
      balances: { atlascloud: { configured: true } },
      models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)),
      ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE, chat: 'footage' });
  }
  if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', exact: true });
  if (u.pathname === '/api/footage/jobs') return json({ ok: true, jobs: JOBS });
  if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, assets: [] });
  res.writeHead(404); res.end('nope');
});

// where the control really is on the long card, and whether a tap reaches it
const read = () => {
  const card = document.getElementById('job-long');
  const b = card.querySelector('.moretxt');
  const w = card.querySelector('.pwrap');
  const cr = card.getBoundingClientRect(), wr = w.getBoundingClientRect();
  if (!b) return { has: false, cardH: cr.height, cardTop: cr.top, vh: window.innerHeight, y: window.scrollY };
  const r = b.getBoundingClientRect();
  const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
  return {
    has: true, word: b.textContent.trim(), pos: getComputedStyle(b).position,
    top: r.top, bottom: r.bottom, right: r.right,
    cardH: cr.height, cardTop: cr.top, wrapRight: wr.right, wrapBottom: wr.bottom,
    vh: window.innerHeight, y: window.scrollY,
    reaches: hit === b || (hit && b.contains(hit)) ? 'the word' : (hit ? (hit.id || hit.className || hit.tagName) : 'nothing'),
  };
};

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // a tap that says so rather than throwing: pre-fix the opener REMOVES
  // itself, and a timeout would report a broken test instead of the bug
  const tap = async (what) => {
    const el = await page.$('#job-long .moretxt');
    if (!el) { fails.push('there is no control left to ' + what); return false; }
    await el.click(); return true;
  };

  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#feed .job').length === 2, null, { timeout: 8000 });
  await page.waitForFunction(() => !!window.__stickyBox, null, { timeout: 4000 });
  await page.waitForTimeout(400);

  ok('no page errors', errors.length === 0);

  // ── 1. a clip whose words are not cut carries no control at all ─────────
  ok('a short prompt gets no opener (the Assets tab\'s silence rule)',
    await page.evaluate(() => !document.querySelector('#job-short .moretxt')));

  // ── 2. it opens, and this time it STAYS ─────────────────────────────────
  const shut = await page.evaluate(read);
  ok('a long prompt is cut and offers the word — ' + shut.word, shut.has && shut.word === '… more');
  await tap('open it');
  await page.waitForTimeout(400);
  const open = await page.evaluate(read);
  ok('the card really opens (' + Math.round(shut.cardH) + ' → ' + Math.round(open.cardH) + 'px of ' + open.vh + ')',
    open.cardH > open.vh * 2);
  ok('and the way back is still there, as a collapse — ' + (open.word || 'gone'),
    open.has && open.word === '… less');

  // ── 3. deep inside the expanded clip it pins itself to what she can see ──
  await page.evaluate(() => window.scrollTo(0, window.scrollY + 1400));
  await page.waitForTimeout(300);
  const deep = await page.evaluate(read);
  ok('scrolled into the middle of it the card top is far above her (' + Math.round(deep.cardTop) + ')',
    deep.cardTop < 0);
  ok('its own corner is far below the fold (' + Math.round(deep.wrapBottom) + ' of ' + deep.vh + ')',
    deep.wrapBottom > deep.vh);
  ok('so the collapse pins itself — ' + deep.pos, deep.pos === 'fixed');
  ok('on screen (' + Math.round(deep.top) + '–' + Math.round(deep.bottom) + ' of ' + deep.vh + ')',
    deep.bottom <= deep.vh && deep.top > 0);
  ok('and a tap really reaches it — ' + deep.reaches, deep.reaches === 'the word');
  ok('it kept the card\'s own column (' + Math.round(deep.wrapRight - deep.right) + 'px in from its right edge)',
    Math.abs(deep.wrapRight - deep.right) < 2);

  // ── 4. the tap she asked for: collapse from up there, and the card comes
  //       back with her ──────────────────────────────────────────────────────
  await tap('collapse it from up there');
  await page.waitForTimeout(700);
  const back = await page.evaluate(read);
  ok('the tap collapsed it (' + Math.round(deep.cardH) + ' → ' + Math.round(back.cardH) + 'px)',
    back.cardH < back.vh);
  ok('the word let go — ' + back.pos, back.pos === 'absolute');
  ok('it reads "… more" again — ' + back.word, back.word === '… more');
  ok('and the card came back on screen with her (top ' + Math.round(back.cardTop) + ')',
    back.cardTop >= 0 && back.cardTop < back.vh);

  // ── 5. scrolled past the expanded clip entirely, it lets go ─────────────
  await tap('re-open it');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const w = document.querySelector('#job-long .pwrap').getBoundingClientRect();
    window.scrollTo(0, window.scrollY + w.bottom + 60);
  });
  await page.waitForTimeout(300);
  const past = await page.evaluate(read);
  ok('past the clip it unpins rather than floating over the rest of the feed — ' + past.pos,
    past.pos === 'absolute');

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
