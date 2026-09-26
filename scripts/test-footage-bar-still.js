#!/usr/bin/env node
/* THE LIST/TILES BAR IS ALWAYS ON SCREEN (2026-09-14, Sophie: "tiles/list bar
 * shud be always visible - either under the prompt, or sticky/pinned in
 * gallery").
 *
 * The jump is iOS WebKit's: it reveals the focused button at the sticky bar's
 * SEAT in the flow, not where the bar is drawn. Chromium never does it, so the
 * test plays WebKit's part — a listener that scrolls to the seat on the tap
 * and again 300ms later (the keyboard going down) — and MEASURES that the
 * page is back where she was, that no bar button keeps the focus, that the
 * glass may still lift its search field, and that her own scroll wins.
 *
 * Run: node scripts/test-footage-bar-still.js
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
    console.log('FOOTAGE BAR STILL — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE BAR STILL — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage bar still: playwright not installed — skipped'); report(); return;
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

const SCENE = 'A long hospital corridor at night. [Image1] walks past the nurses station and stops at the last door.';
const clip = (id, prompt, sentAt) => ({
  id, prompt, status: 'done', model: 'seedance-2-0-mini', modelLabel: '2.0 Mini',
  seconds: 4, resolution: '480p', ratio: '16:9', sound: true, door: 'atlascloud',
  video: '/clip.mp4', source: '/clip.mp4', poster: '', refs: [], trims: [], sentAt,
});
const JOBS = []; for (let i = 0; i < 60; i++) JOBS.push(clip('c' + i, 'clip number ' + i + ' \u2014 a long hospital corridor at night, the nurse walking past', 9000 - i));

const sent = [];
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
  if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      try { sent.push(JSON.parse(body)); } catch (_) { sent.push({ bad: body }); }
      json({ ok: true, job: { ...clip('new', 'drawing', 4000), status: 'running', video: '' } });
    });
  }
  if (u.pathname === '/api/footage/jobs') return json({ ok: true, jobs: JOBS });
  if (u.pathname === '/api/cast/films') return json({ ok: true, films: [{ slug: 'ward', title: 'The ward' }] });
  if (u.pathname.indexOf('/api/cast') === 0) return json({ ok: true, characters: [], films: [{ slug: 'ward', title: 'The ward' }] });
  if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, assets: [] });
  res.writeHead(404); res.end('nope');
});


(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#feed .job').length === 60, null, { timeout: 12000 });
  // a long scene, so the bar pins to the BOTTOM of the screen with its seat far below
  await page.evaluate(() => {
    const t = document.getElementById('prompt');
    t.value = Array(60).fill('A long line of the scene that keeps going on and on.').join('\n');
    t.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // her panel of several blocks, as tall as a phone's worth and more — the
  // box itself stops growing at a screen, so the height is given to the panel
  await page.addStyleTag({ content: '.panel{padding-bottom:1400px}' });
  await page.waitForTimeout(500);
  // WEBKIT'S PART: reveal the tapped control at its seat, now and when the keyboard drops
  await page.evaluate(() => {
    window.__seat = () => {
      const bar = document.getElementById('feedbar');
      const p = bar.style.position; bar.style.position = 'static';
      const y = bar.getBoundingClientRect().top + window.scrollY - 12; bar.style.position = p;
      return y;
    };
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#feedbar button')) return;
      const go = () => window.scrollTo(0, window.__seat());
      go(); setTimeout(go, 300);
    });
  });
  const pinnedBottom = await page.evaluate(() => {
    const r = document.getElementById('feedbar').getBoundingClientRect();
    return Math.round(r.bottom) === 844 && window.__seat() > 1500;
  });
  ok('the bar is pinned to the bottom with its seat far below the screen', pinnedBottom);

  for (const sel of ['#v-tiles', '#v-list', '#v-cols', '#v-liked', '#v-liked', '#v-hidex', '#v-hidex', '#projwrap']) {
    await page.evaluate(() => window.scrollTo(0, 120));
    await page.waitForTimeout(150);
    await page.click(sel);
    const trail = [];
    for (let k = 0; k < 6; k++) { await page.waitForTimeout(120); trail.push(await page.evaluate(() => Math.round(window.scrollY))); }
    ok(sel + ' leaves the page where she was — ' + trail.join(','), trail.slice(1).every((y) => y === 120));
    ok(sel + ' does not keep the focus', await page.evaluate((s) => document.activeElement !== document.querySelector(s), sel));
    if (sel === '#projwrap') await page.evaluate(() => { const s = document.getElementById('shelf'); if (s) s.hidden = true; });
  }

  // HER OWN SCROLL WINS: a wheel mid-window stops the guard
  await page.evaluate(() => window.scrollTo(0, 120));
  await page.waitForTimeout(150);
  await page.click('#v-tiles');
  await page.mouse.wheel(0, 300);
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(600);
  ok('a scroll of hers after the tap is left alone — ' + await page.evaluate(() => Math.round(window.scrollY)),
    await page.evaluate(() => Math.abs(window.scrollY - 120) > 50));

  // THE GLASS OPENS A FIELD TO TYPE IN — iOS lifting it is allowed
  await page.evaluate(() => window.scrollTo(0, 120));
  await page.waitForTimeout(150);
  await page.click('#v-search');
  await page.waitForTimeout(700);
  ok('the glass hands the focus to the search field', await page.evaluate(() => document.activeElement && document.activeElement.id === 'q'));
  ok('and the guard lets the page move for it', await page.evaluate(() => Math.abs(window.scrollY - 120) > 50));

  ok('no page errors — ' + errors.join(' | '), errors.length === 0);
  await browser.close(); server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
