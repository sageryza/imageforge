#!/usr/bin/env node
/* THE LIST/TILES BAR IS ALWAYS ON SCREEN (2026-09-14, Sophie: "tiles/list bar
 * shud be always visible - either under the prompt, or sticky/pinned in
 * gallery").
 *
 * Driven on the REAL footage page, and every assertion here is a MEASUREMENT:
 * a `position:sticky` that never pins because something above it clips, one
 * that pins with the clips showing straight through it, one that pins its own
 * controls under the autoscroll pill, one that overlaps the panel's sticky
 * fold row on the way past, and one that leaves a tapped card sitting BEHIND
 * the bar all look identical in the source. Where a row really is, is read
 * off the rendered page; whether a control can be TAPPED is asked with
 * `elementFromPoint`.
 *
 * Run: node scripts/test-footage-feedbar-sticky.js
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
    console.log('FOOTAGE FEED BAR — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE FEED BAR — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage feed bar: playwright not installed — skipped'); report(); return;
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

// WHERE THE BAR REALLY IS, AND WHETHER ITS CONTROLS REALLY TAKE A TAP.
const read = () => {
  const bar = document.getElementById('feedbar');
  const r = bar.getBoundingClientRect();
  const cs = getComputedStyle(bar);
  const pill = document.querySelector('body > .float');
  const pr = pill && pill.getClientRects().length ? pill.getBoundingClientRect() : null;
  const pw = document.querySelector('.panelrow').getBoundingClientRect();
  const tap = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const b = e.getBoundingClientRect();
    if (!b.width || !b.height) return null;
    const hit = document.elementFromPoint(Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2));
    return { box: [Math.round(b.left), Math.round(b.top), Math.round(b.right)],
      reaches: !!(hit && hit.closest(sel)) };
  };
  // what is under the MIDDLE of the pinned bar — the bar itself if it really
  // paints, a clip card if the background is see-through
  const mid = document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.top + r.height / 2));
  return {
    pos: cs.position, top: cs.top, bg: cs.backgroundColor, z: cs.zIndex,
    barTop: Math.round(r.top), barBottom: Math.round(r.bottom), barH: Math.round(r.height),
    onScreen: r.top >= 0 && r.bottom <= window.innerHeight,
    paints: !!(mid && (mid.id === 'feedbar' || mid.closest('#feedbar'))),
    panelrowBottom: Math.round(pw.bottom),
    pillLeft: pr ? Math.round(pr.left) : null,
    list: tap('#v-list'), tiles: tap('#v-tiles'), proj: tap('#projwrap'),
    chip: tap('#feedfilters .filtchip'),
    y: Math.round(window.scrollY),
    headtop: getComputedStyle(document.documentElement).getPropertyValue('--headtop').trim(),
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
  const settle = async () => { await page.waitForTimeout(400); };
  const to = async (y) => { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(120); };

  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#feed .job').length === 60, null, { timeout: 12000 });
  // her real phone's notch — 0 in headless Chromium, and the whole point of
  // `--headtop` is that the bar pins BELOW it (pagehead.js writes it live)
  await page.evaluate(() => document.documentElement.style.setProperty('--headtop', '51px'));
  await page.evaluate((v) => {
    const t = document.getElementById('prompt');
    t.value = v; t.dispatchEvent(new Event('input', { bubbles: true }));
  }, SCENE);
  await settle();

  ok('no page errors', errors.length === 0);

  // ── 1. at rest it is where it always was: under the panel, above the feed ─
  const rest = await page.evaluate(read);
  ok('it is sticky — ' + rest.pos, rest.pos === 'sticky');
  ok('pinned at the header top, never a hardcoded band — ' + rest.top, rest.top === '51px');
  ok('and it starts BELOW the panel at rest (' + rest.barTop + 'px of 844)',
    rest.barTop > 300 && rest.barTop < 844);
  ok('under the prompt panel, not over it', rest.barTop > rest.panelrowBottom);

  // ── 2. scrolled into the gallery it is still on screen, and it WORKS ─────
  await to(1200);
  const deep = await page.evaluate(read);
  ok('deep in the gallery it is pinned at the top (' + deep.barTop + 'px at scrollY ' + deep.y + ')',
    deep.y > 1000 && deep.barTop === 51);
  ok('the whole bar is on screen', deep.onScreen);
  ok('and the clips do not show through it — ' + deep.bg, deep.paints && /rgb\(246, 242, 234\)/.test(deep.bg));
  ok('LIST really takes a tap up there — ' + JSON.stringify(deep.list), deep.list && deep.list.reaches);
  ok('TILES too', deep.tiles && deep.tiles.reaches);
  ok('and so does the project picker', deep.proj && deep.proj.reaches);
  ok('nothing on it runs under the pill (' + deep.proj.box[2] + ' against ' + deep.pillLeft + ')',
    deep.pillLeft && deep.proj.box[2] <= deep.pillLeft);

  // ── 3. it is not a picture of a switch: TILES from up here really swaps ──
  await page.click('#v-tiles');
  await settle();
  ok('tapping TILES from the pinned bar swaps the gallery',
    await page.evaluate(() => !document.getElementById('tiles').hidden
      && document.getElementById('feed').hidden
      && document.getElementById('v-tiles').classList.contains('on')));
  // the wall is a much shorter page, so scrollY 1200 clamps away — scroll it
  // again rather than asserting against a position that no longer exists
  await to(1200);
  const wall = await page.evaluate(read);
  ok('and the bar is still pinned over the wall (' + wall.barTop + ' at scrollY ' + wall.y + ')',
    wall.y > 200 && wall.barTop === 51);
  await page.click('#v-list');
  await settle();

  // ── 4. IT NEVER OVERLAPS THE PANEL'S OWN STICKY FOLD ROW. A sticky element
  //       is constrained by its containing block, so the panel carries its
  //       fold row up and off with it — by the time this bar reaches the top
  //       that row's bottom is already at or above it. Scanned rather than
  //       reasoned: the two share a `top` and a mistake here is a covered
  //       fold button for a window of scroll nobody would look at. ─────────
  const seam = [];
  for (let y = 360; y <= 560; y += 5) {
    await to(y);
    seam.push(await page.evaluate(() => {
      const pw = document.querySelector('.panelrow').getBoundingClientRect();
      const fb = document.getElementById('feedbar').getBoundingClientRect();
      return Math.round(fb.top - pw.bottom);
    }));
  }
  ok('the fold row and the bar never overlap across the transition (min gap '
    + Math.min.apply(null, seam) + 'px over ' + seam.length + ' positions)',
    Math.min.apply(null, seam) >= 0);

  // ── 5. the glass, pinned: the funnel is the last thing on the field's line
  //       and has to keep the pill's column clear ─────────────────────────
  await to(1200);
  await page.click('#v-search');
  await settle();
  const open = await page.evaluate(read);
  ok('the open search stays pinned (' + open.barTop + ', ' + open.barH + 'px tall)',
    open.barTop === 51 && open.barH > deep.barH);
  ok('the funnel clears the pill (' + (open.chip && open.chip.box[2]) + ' against ' + open.pillLeft + ')',
    open.chip && open.pillLeft && open.chip.box[2] <= open.pillLeft);
  ok('and a tap really reaches it', open.chip && open.chip.reaches);
  await page.click('#v-search');
  await settle();

  // ── 6. A CARD SHE TAPS ON THE WALL LANDS UNDER THE BAR, NOT BEHIND IT ────
  await page.click('#v-tiles');
  await settle();
  await page.click('#tiles .cell[data-id="c14"] .tdoor.card');
  await page.waitForFunction(() => !document.getElementById('feed').hidden);
  await page.evaluate(() => new Promise((res) => {
    let last = -1, still = 0;
    const tick = () => {
      const y = Math.round(window.scrollY);
      if (y === last) { if (++still > 8) return res(); } else { still = 0; last = y; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  const landed = await page.evaluate(() => {
    const el = document.getElementById('job-c14');
    const r = el.getBoundingClientRect();
    const b = document.getElementById('feedbar').getBoundingClientRect();
    const hit = document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.top + 6));
    return { top: Math.round(r.top), bar: Math.round(b.bottom),
      clear: !!(hit && hit.closest('#job-c14')),
      atEnd: Math.round(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 2 };
  });
  ok('the card she tapped lands below the pinned bar — ' + JSON.stringify(landed),
    landed.atEnd || (landed.top >= landed.bar && landed.top < landed.bar + 40));
  ok('and its top edge really takes a tap, so it is not behind the bar',
    landed.atEnd || landed.clear);

  // ── 7. IT IS THE DIVIDER: BOTTOM-PINNED WHILE THE PROMPT BLOCK IS TALLER
  //       THAN THE SCREEN (2026-09-14, Sophie: "in prompt block mode its
  //       pinned to bottom · gallery its top (as now) · bar always visible").
  //       Every assertion is a MEASUREMENT: a `bottom:0` that never takes
  //       effect, one that pins the bar over the box's own corner buttons, and
  //       one that leaves it off screen all look identical in the source. ────
  await page.click('#v-list');
  await to(0);
  await page.evaluate(() => {
    const t = document.getElementById('prompt');
    t.value = Array.from({ length: 22 }, (_, i) => 'Line ' + (i + 1)
      + ' — a long hospital corridor at night, [Image1] walks past the nurses'
      + ' station and stops at the last door where the light is still on.').join(' ');
    t.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle();
  await page.evaluate(() => { const b = document.getElementById('bigprompt'); if (b) b.click(); });
  await settle();
  await to(0);
  const tall = await page.evaluate(() => {
    const bar = document.getElementById('feedbar').getBoundingClientRect();
    const pn = document.querySelector('.panel').getBoundingClientRect();
    const hit = document.elementFromPoint(Math.round(bar.x + bar.width / 2),
      Math.round(bar.top + bar.height / 2));
    const btn = document.querySelector('[data-stickybox].sbx-pin');
    return { panelH: Math.round(pn.height), vh: window.innerHeight,
      top: Math.round(bar.top), bottom: Math.round(bar.bottom),
      paints: !!(hit && hit.closest('#feedbar')),
      pinned: btn ? Math.round(btn.getBoundingClientRect().bottom) : null,
      listReaches: (() => {
        const e = document.getElementById('v-list'); const b = e.getBoundingClientRect();
        const h = document.elementFromPoint(Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2));
        return !!(h && h.closest('#v-list'));
      })() };
  });
  ok('the prompt block really is taller than the screen (' + tall.panelH + ' of ' + tall.vh + ')',
    tall.panelH > tall.vh);
  ok('so the bar pins to the BOTTOM of the screen, not off it — '
    + JSON.stringify([tall.top, tall.bottom, tall.vh]), tall.bottom === tall.vh && tall.top > 0);
  ok('it still paints — the prompt does not show through it', tall.paints);
  ok('and its own controls still take a tap down there', tall.listReaches);
  ok('the box’s pinned corner buttons sit ABOVE it, never on it — '
    + JSON.stringify([tall.pinned, tall.top]),
    tall.pinned !== null && tall.pinned <= tall.top);

  // and scrolling down the tall panel leaves it exactly where it was
  await to(900);
  const still = await page.evaluate(() => {
    const b = document.getElementById('feedbar').getBoundingClientRect();
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), vh: window.innerHeight };
  });
  ok('it stays at the bottom all the way down the prompt block — '
    + JSON.stringify(still), still.bottom === still.vh);

  // …and once the gallery reaches it, it hands over to the TOP edge
  await to(4000);
  const over = await page.evaluate(() => {
    const b = document.getElementById('feedbar').getBoundingClientRect();
    return { top: Math.round(b.top), bottom: Math.round(b.bottom) };
  });
  ok('then the gallery takes it and it pins at the top again — ' + JSON.stringify(over),
    over.top === 51);

  ok('still no page errors', errors.length === 0);

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
