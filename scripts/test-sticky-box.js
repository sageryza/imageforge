#!/usr/bin/env node
/* THE WAY OUT OF A BIG BOX STAYS ON SCREEN (2026-09-10, Sophie: "can we get a
 * floating or sticky/pinned contract button for text boxes esp in footage so i
 * can close with out having to scroll all the way down").
 *
 * /stickybox.js driven on the REAL footage page, because every one of these is
 * a MEASUREMENT rather than a source assertion: a marked button that never
 * pins, one that pins to a spot she cannot tap, one that pins over a page she
 * has scrolled miles past, and one that shrinks the box and leaves her staring
 * at whatever was underneath all look identical in the source. Where the
 * button really is, is read off the rendered page; whether it can be TAPPED is
 * asked with `elementFromPoint`, which is what a covered control passes every
 * width assertion while failing.
 *
 * Run: node scripts/test-sticky-box.js
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
    console.log('STICKY BOX — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('STICKY BOX — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('sticky box: playwright not installed — skipped'); report(); return;
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

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/footage') {
    const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL;
    res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
  }
  if (u.pathname === '/api/footage/status') {
    return json({ ok: true, doors: { atlascloud: true },
      balances: { atlascloud: { configured: true } },
      models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)),
      ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
  }
  if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', exact: true });
  if (u.pathname === '/api/footage/jobs') return json({ ok: true, jobs: [] });
  res.writeHead(404); res.end('nope');
});

// a scene long enough that the big box is far taller than the phone — the
// shape she reported, not a contrived one
const SCENE = Array.from({ length: 70 }, (_, i) => 'line ' + (i + 1) + ' — the ward corridor at night').join('\n');

// where the button really is, and whether a tap would reach it
const readBtn = () => {
  const b = document.getElementById('bigprompt');
  const w = document.querySelector('.promptwrap');
  const r = b.getBoundingClientRect(), wr = w.getBoundingClientRect();
  const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
  return {
    pos: getComputedStyle(b).position,
    top: r.top, bottom: r.bottom, right: r.right,
    wrapTop: wr.top, wrapBottom: wr.bottom, wrapRight: wr.right,
    boxH: document.getElementById('prompt').getBoundingClientRect().height,
    vh: window.innerHeight,
    y: window.scrollY,
    reaches: hit === b || (hit && b.contains(hit)) ? 'the button' : (hit ? (hit.id || hit.className || hit.tagName) : 'nothing'),
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
  await page.waitForFunction(() => !!window.__stickyBox, null, { timeout: 4000 });
  await page.waitForTimeout(300);

  ok('no page errors', errors.length === 0);

  // ── 1. a SHORT box is not touched at all ────────────────────────────────
  const small = await page.evaluate(readBtn);
  ok('a short box leaves the button exactly where the page put it — ' + small.pos, small.pos === 'absolute');
  ok('and it is on screen already (' + Math.round(small.bottom) + ' of ' + small.vh + ')', small.bottom < small.vh);

  // ── 2. the big box: the button's own corner goes off the bottom, and it
  //       pins itself to what she can see ───────────────────────────────────
  await page.evaluate((t) => {
    const el = document.getElementById('prompt');
    el.value = t;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, SCENE);
  await page.waitForTimeout(200);
  await page.click('#bigprompt');
  await page.waitForTimeout(600);

  const big = await page.evaluate(readBtn);
  ok('the big box is taller than the phone (' + Math.round(big.boxH) + 'px of ' + big.vh + ')', big.boxH > big.vh);
  ok('its own bottom corner is far below the fold (' + Math.round(big.wrapBottom) + ')', big.wrapBottom > big.vh);
  ok('so the button pins itself — ' + big.pos, big.pos === 'fixed');
  ok('on screen, above the fold (' + Math.round(big.top) + '–' + Math.round(big.bottom) + ' of ' + big.vh + ')',
    big.bottom <= big.vh && big.top > 0);
  ok('and a tap really reaches it — ' + big.reaches, big.reaches === 'the button');
  ok('it kept its own column, so nothing jumps sideways ('
    + Math.round(big.wrapRight - big.right) + 'px in from the box\'s right edge)',
    Math.abs((big.wrapRight - big.right) - (small.wrapRight - small.right)) < 2);
  ok('pinning moved the page not at all (' + big.y + ')', big.y === small.y);

  // ── 3. it stays reachable once she is deep inside the box ───────────────
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(250);
  const deep = await page.evaluate(readBtn);
  ok('scrolled into the middle of the scene it is still pinned and tappable — ' + deep.reaches,
    deep.pos === 'fixed' && deep.bottom <= deep.vh && deep.reaches === 'the button');

  // ── 4. scrolled PAST the box entirely, it lets go ───────────────────────
  await page.evaluate(() => {
    const w = document.querySelector('.promptwrap').getBoundingClientRect();
    window.scrollTo(0, window.scrollY + w.bottom + 40);
  });
  await page.waitForTimeout(250);
  const past = await page.evaluate(readBtn);
  ok('past the box it unpins rather than floating over the rest of the page — ' + past.pos,
    past.pos === 'absolute');

  // ── 5. the tap she asked for: close from the pinned button, deep in the
  //       box, and the box comes back with her ─────────────────────────────
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(250);
  const before = await page.evaluate(readBtn);
  ok('back inside the box it is pinned again', before.pos === 'fixed');
  ok('and the top of the box is off screen above her (' + Math.round(before.wrapTop) + ')', before.wrapTop < 0);
  await page.click('#bigprompt');
  await page.waitForTimeout(700);
  const after = await page.evaluate(readBtn);
  ok('the tap closed the box (' + Math.round(before.boxH) + ' → ' + Math.round(after.boxH) + 'px)',
    after.boxH < before.boxH);
  ok('the button let go once its corner was reachable again — ' + after.pos, after.pos === 'absolute');
  ok('and the box came back on screen with her (top ' + Math.round(after.wrapTop) + ')',
    after.wrapTop >= 0 && after.wrapTop < after.vh);
  ok('the whole box, button and all, is on screen (' + Math.round(after.bottom) + ' of ' + after.vh + ')',
    after.bottom <= after.vh);

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.log('sticky box: ' + e.stack); process.exit(1); });
