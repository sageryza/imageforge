#!/usr/bin/env node
/* HOW LONG THIS SHAPE USUALLY TAKES, ON THE PRICE LINE (2026-09-12, Sophie:
 * "also make it say the average time it has taken for things to draw at that
 * exact size and length, etc.").
 *
 * The REAL page headless, and every assertion is a MEASUREMENT — because a
 * time that is computed and never painted, one drawn where the pill covers
 * it, one that pushes `clear` and `undo` onto a line of their own, and one
 * that goes on showing the last shape's figure after she changes the seconds
 * all look identical in the source.
 *
 * Run: node scripts/test-footage-draw-time.js
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
    console.log('FOOTAGE DRAW TIME — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE DRAW TIME — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage draw time: playwright not installed — skipped'); report(); return;
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

// The stub answers the draw time for ONE shape only — 4s — so a figure that
// survives a change of seconds is caught as the stale paint it is.
let asked = [];
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/footage') {
    const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL;
    res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
  }
  if (u.pathname === '/api/footage/status') {
    return json({ ok: true, doors: { atlascloud: true }, chat: 'footage',
      balances: { atlascloud: { configured: true, left: 12.34 } },
      models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)),
      ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
  }
  if (u.pathname === '/api/footage/estimate') {
    asked.push(u.search);
    const secs = Number(u.searchParams.get('seconds'));
    const drew = secs === 4 ? { ms: 70000, mean: 240000, n: 12, basis: 'exact' } : null;
    return json({ ok: true, cents: 4.4, door: 'atlascloud', exact: true, drew });
  }
  if (u.pathname === '/api/footage/spend') return json({ ok: true, total: 3.5, start: '2026-09-12', end: '2026-09-13', byModel: [], byDay: [] });
  if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs: [] });
  if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
  if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
  res.writeHead(404); res.end('nope');
});

const read = () => {
  const cost = document.getElementById('cost');
  const drew = cost.querySelector('.drew');
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height }; };
  const row = document.getElementById('go').parentNode;
  return {
    costText: cost.textContent.trim(),
    drew: drew ? { words: drew.textContent.trim(), title: drew.title, box: rect(drew),
      display: getComputedStyle(drew).display, size: parseFloat(getComputedStyle(drew).fontSize) } : null,
    costBox: rect(cost),
    goBox: rect(document.getElementById('go')),
    clearBox: (() => { const el = document.getElementById('clearjob'); return el && !el.hidden && el.getClientRects().length ? rect(el) : null; })(),
    rowBox: rect(row),
    balline: (() => { const el = document.getElementById('balline'); return { hidden: el.hidden, words: el.textContent.trim() }; })(),
    pill: (() => {
      const f = document.querySelector('body > .float'); if (!f) return null;
      let r = f.getClientRects().length ? f.getBoundingClientRect() : null;
      if (!r) { const d = f.style.display, v = f.style.visibility;
        f.style.visibility = 'hidden'; f.style.display = '';
        if (f.getClientRects().length) r = f.getBoundingClientRect();
        f.style.display = d; f.style.visibility = v; }
      return r ? { left: r.left, top: r.top, bottom: r.bottom } : null;
    })(),
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

  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.evaluate(() => { const el = document.getElementById('secs'); el.value = '4'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(500);

  // ── 1. the time is PAINTED, and it is on its own line ───────────────────
  let s = await page.evaluate(read);
  ok('the price is still the price', /4\.4|4¢/.test(s.costText.split('\n')[0]) || /4\.4/.test(s.costText));
  ok('the time is drawn at all' + (s.drew ? '' : ' — nothing rendered'), Boolean(s.drew));
  if (s.drew) {
    ok('it says roughly a minute ten — ' + s.drew.words, /1m 10s/.test(s.drew.words));
    ok('it wears a `~` — what usually happens, never a promise', /~/.test(s.drew.words));
    ok('it is its OWN line (display ' + s.drew.display + ')', s.drew.display === 'block');
    ok('and really has height on screen (' + Math.round(s.drew.box.h) + 'px)', s.drew.box.h > 6);
    ok('smaller than the price beside it (' + s.drew.size + 'px)', s.drew.size < 13);
    ok('the count is behind it, not on the row — ' + s.drew.title, /12 clips/.test(s.drew.title));
    ok('and the MEAN is there for anyone who wants it', /average/.test(s.drew.title) && /4m 0s|4m/.test(s.drew.title));
    ok('the exact rung says nothing extra on the row', !/similar/.test(s.drew.words));
  }

  // ── 2. it costs the row HEIGHT, never its width ─────────────────────────
  // The row at 390pt is already the seed, the star, the price and two
  // underlined words. A fifth thing ON the line wraps the words onto a line
  // of their own — which is why the time is a block inside #cost.
  if (s.drew) {
    ok('the time sits under the price, not beside it (' + Math.round(s.costBox.top) + ' → ' + Math.round(s.drew.box.top) + ')',
      s.drew.box.top >= s.costBox.top + 6);
    ok('the star keeps its line (' + Math.round(s.goBox.top) + ' vs price ' + Math.round(s.costBox.top) + ')',
      Math.abs(s.goBox.top - s.costBox.top) < 30);
    ok('the time is clear of the pill\'s column',
      !s.pill || s.drew.box.bottom <= s.pill.top || s.drew.box.top >= s.pill.bottom || s.drew.box.right <= s.pill.left);
  }

  // ── 3. A SHAPE THE LOG HAS NEVER DRAWN SAYS NOTHING (the silence rule) ──
  await page.evaluate(() => { const el = document.getElementById('secs'); el.value = '12'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(500);
  s = await page.evaluate(read);
  ok('changing the seconds re-asks the server', asked.some((q) => /seconds=12/.test(q)));
  ok('and an unmeasured shape draws NO time at all (never the last one\'s)', s.drew === null);
  ok('the price line is still there', s.costText.length > 0);

  // ── 4. it comes back when the shape does ────────────────────────────────
  await page.evaluate(() => { const el = document.getElementById('secs'); el.value = '4'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(500);
  s = await page.evaluate(read);
  ok('back to a measured shape and the time is back', Boolean(s.drew) && /1m 10s/.test(s.drew.words));

  // ── 5. the "?" card carries the balance AND today's spend ───────────────
  await page.click('#help');
  await page.waitForTimeout(500);
  s = await page.evaluate(read);
  ok('the balance line is drawn (it said Atlas had none until today)', !s.balline.hidden);
  ok('it says what is left — ' + s.balline.words, /12\.34/.test(s.balline.words));
  ok('and what today really cost', /3\.50 spent today/.test(s.balline.words));
  ok('in DOLLARS, never credits', !/credit/i.test(s.balline.words));

  ok('no page errors — ' + errors.join(' | '), errors.length === 0);
  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
