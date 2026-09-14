#!/usr/bin/env node
/* THE CARET IS NEVER UNDER A PINNED BUTTON (2026-09-13, Sophie, typing at the
 * end of a footage block: the ✕, the divide and the bigger-box buttons sitting
 * ON the line she was writing).
 *
 * Two page rules aimed at the same pixels. `caretkeep.js` lifts the caret line
 * to the bottom of the visible band; `stickybox.js` floats a tall box's corner
 * buttons to the bottom of that same band — it asks caretkeep for it — so the
 * line she types on and the button row landed on top of each other.
 *
 * Every assertion here is a MEASUREMENT of the rendered page, because a caret
 * lifted to the right number and a caret lifted onto a button look identical in
 * the source, and a control that is "visible" is not the same as one nothing is
 * drawn over. What covers the caret's own line is asked with
 * `elementFromPoint`, and the button's tap is asked the same way. The keyboard
 * is stubbed through `__caretKeep.vv` — the module's documented seam — because
 * a headless browser has not got one.
 *
 * Verified failing against the pre-fix page: 90 of 90 keystrokes left the caret
 * line under the divide button, 16px of a 22px line.
 *
 * Run: node scripts/test-caret-under-button.js
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
    console.log('CARET UNDER BUTTON — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('CARET UNDER BUTTON — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('caret under button: playwright not installed — skipped'); report(); return;
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
  const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
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

// her shape: a scene far taller than the phone, in one block
const SCENE = Array.from({ length: 40 }, (_, i) =>
  'shot ' + (i + 1) + ': the ward corridor at night, a long slow push in').join('\n\n');

// what is really drawn over the caret's own line, and where everything is
const READ = () => {
  const el = document.getElementById('prompt');
  const c = window.__caretKeep.caretRect(el);
  const box = el.getBoundingClientRect();
  const out = { caret: [c.top, c.bottom], band: window.__caretKeep.band().bottom, pinned: [], overlap: 0 };
  document.querySelectorAll('[data-stickybox].sbx-pin').forEach((x) => {
    const r = x.getBoundingClientRect();
    out.pinned.push({ cls: x.className, top: r.top, bottom: r.bottom, left: r.left, right: r.right });
    const ov = Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top);
    if (ov > out.overlap) out.overlap = ov;
  });
  // the middle of the caret's line, in the box's own words column
  const hit = document.elementFromPoint(Math.round(box.left + 180), Math.round((c.top + c.bottom) / 2));
  out.onCaretLine = hit ? (hit.className || hit.id || hit.tagName) : 'nothing';
  out.y = window.scrollY;
  out.inBand = c.bottom <= window.innerHeight;
  return out;
};

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForFunction(() => !!window.__stickyBox && !!window.__caretKeep, null, { timeout: 5000 });
  ok('no page errors', errors.length === 0);

  // the keyboard: the visible band is the top 430px of an 844px phone
  await page.evaluate(() => { window.__caretKeep.vv = { offsetTop: 0, height: 430 }; });

  await page.evaluate((t) => {
    const el = document.getElementById('prompt');
    el.value = t;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, SCENE);
  await page.waitForTimeout(200);
  await page.click('#bigprompt');
  await page.waitForTimeout(500);

  // ── 1. the shape she photographed: typing at the END of the scene ───────
  await page.evaluate(() => {
    const el = document.getElementById('prompt');
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  });
  await page.waitForTimeout(120);
  await page.type('#prompt', ' appearing on', { delay: 8 });
  await page.waitForTimeout(900);

  const end = await page.evaluate(READ);
  ok('typing at the end of the scene, the caret line is on screen (' + Math.round(end.caret[0]) + '–'
    + Math.round(end.caret[1]) + ' of 844)', end.inBand);
  ok('nothing pinned is drawn over it (' + Math.round(end.overlap) + 'px of overlap)', end.overlap <= 0);
  ok('and the middle of that line really is her words — ' + end.onCaretLine,
    /pblock/.test(String(end.onCaretLine)));

  // ── 2. EVERY keystroke, not just the settled reading. A transient that
  //       corrects itself 90ms later is the lurch, and a single read misses it
  const run = await page.evaluate(async (n) => {
    const el = document.getElementById('prompt');
    const bad = [];
    for (let i = 0; i < n; i += 1) {
      el.setRangeText('x', el.selectionEnd, el.selectionEnd, 'end');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      // one frame, the way a real keystroke lands
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const c = window.__caretKeep.caretRect(el);
      let worst = 0;
      document.querySelectorAll('[data-stickybox].sbx-pin').forEach((x) => {
        const r = x.getBoundingClientRect();
        const ov = Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top);
        if (ov > worst) worst = ov;
      });
      if (worst > 0) bad.push(i + ':' + Math.round(worst));
    }
    return bad;
  }, 90);
  ok('across 90 keystrokes the caret line is never under a pinned button ('
    + (run.length ? run.slice(0, 5).join(' ') : 'none') + ')', run.length === 0);

  // ── 3. and across new LINES, which grow the box a whole line at a time ──
  const lines = await page.evaluate(async (n) => {
    const el = document.getElementById('prompt');
    const bad = [];
    for (let i = 0; i < n; i += 1) {
      el.setRangeText('\nanother line of the scene', el.selectionEnd, el.selectionEnd, 'end');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 60));
      const c = window.__caretKeep.caretRect(el);
      let worst = 0;
      document.querySelectorAll('[data-stickybox].sbx-pin').forEach((x) => {
        const r = x.getBoundingClientRect();
        const ov = Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top);
        if (ov > worst) worst = ov;
      });
      if (worst > 0) bad.push(i + ':' + Math.round(worst));
    }
    return bad;
  }, 12);
  ok('and across 12 new lines (' + (lines.length ? lines.join(' ') : 'none') + ')', lines.length === 0);

  // ── 4. THE BUTTONS ARE STILL PINNED AND STILL TAPPABLE when she is deep
  //       inside the box — the whole reason they float. Lifting the caret must
  //       not have cost her the way out.
  const deep = await page.evaluate(() => {
    const el = document.getElementById('prompt');
    const h = el.getBoundingClientRect().height;
    // the caret half way down the scene, and the page put there
    const at = Math.round(el.value.length * 0.5);
    el.focus();
    el.setSelectionRange(at, at);
    const c = window.__caretKeep.caretRect(el);
    window.scrollTo(0, Math.max(0, window.scrollY + c.top - 380));   // that line at the band's edge
    return { boxH: h, vh: window.innerHeight };
  });
  ok('the box is far taller than the phone (' + Math.round(deep.boxH) + 'px of ' + deep.vh + ')',
    deep.boxH > deep.vh * 2);
  await page.evaluate(() => window.__caretKeep.keep(document.getElementById('prompt')));
  await page.waitForTimeout(400);
  const mid = await page.evaluate(() => {
    const out = (function () {
      const el = document.getElementById('prompt');
      const c = window.__caretKeep.caretRect(el);
      const o = { caret: [c.top, c.bottom], pinned: [], overlap: 0 };
      document.querySelectorAll('[data-stickybox].sbx-pin').forEach((x) => {
        const r = x.getBoundingClientRect();
        o.pinned.push(x.className);
        const ov = Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top);
        if (ov > o.overlap) o.overlap = ov;
      });
      return o;
    })();
    const b = document.getElementById('bigprompt');
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    out.reaches = hit === b || (hit && b.contains(hit)) ? 'the button' : (hit ? (hit.id || hit.className) : 'nothing');
    out.pos = getComputedStyle(b).position;
    out.btn = [r.top, r.bottom];
    return out;
  });
  ok('mid-scene the corner buttons are still pinned (' + mid.pinned.length + ')',
    mid.pos === 'fixed' && mid.pinned.length > 0);
  ok('a tap still reaches the way out — ' + mid.reaches, mid.reaches === 'the button');
  ok('and the caret sits ABOVE them rather than under them (caret ' + Math.round(mid.caret[0]) + '–'
    + Math.round(mid.caret[1]) + ', button ' + Math.round(mid.btn[0]) + '–' + Math.round(mid.btn[1]) + ')',
    mid.overlap <= 0 && mid.caret[1] <= mid.btn[0] + 0.5);

  // ── 5. THE BAND ITSELF IS NOT NARROWED — stickybox reads it to decide where
  //       to pin, so a band that moved under it would walk the buttons up the
  //       screen a row per pass.
  const bands = await page.evaluate(() => {
    const el = document.getElementById('prompt');
    const k = window.__caretKeep;
    return { raw: k.band().bottom, caret: k.caretBand ? k.caretBand(el).bottom : null };
  });
  ok('the keeper exposes the caret\'s own band', bands.caret !== null);
  ok('the raw band is still what the keyboard leaves (' + Math.round(bands.raw) + ')',
    Math.abs(bands.raw - (430 - 26)) < 1);
  ok('and the caret\'s own band is at or above it (' + Math.round(bands.caret) + ')',
    bands.caret <= bands.raw + 0.5);

  // ── 6. a box with NOTHING pinned over it is untouched: the two bands agree
  await page.evaluate(() => {
    const el = document.getElementById('prompt');
    el.blur();
    el.value = 'one short shot';             // nothing left to pin against
    el.dispatchEvent(new Event('input', { bubbles: true }));
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);
  const quiet = await page.evaluate(() => {
    const el = document.getElementById('prompt');
    const k = window.__caretKeep;
    return {
      pinned: document.querySelectorAll('[data-stickybox].sbx-pin').length,
      raw: k.band().bottom,
      caret: k.caretBand ? k.caretBand(el).bottom : null,
    };
  });
  ok('with the box small nothing is pinned (' + quiet.pinned + ')', quiet.pinned === 0);
  ok('so nothing lowers the ceiling — the bottom is the plain band\'s ('
    + Math.round(quiet.caret) + ')', quiet.caret === quiet.raw);

  // ── 7. THE MIRROR OF THE SAME BUG: a page's own STICKY row over the top of
  //    the band.  Typing in the top half of a long scene after scrolling down
  //    used to lift the caret line to band.top — straight under whatever is
  //    pinned there.  footage's own PROMPT fold row was the case this was
  //    written against and it is gone (2026-09-14, "remove prompt collapse"),
  //    so what is measured now is the RULE rather than that one row: nothing
  //    pinned, at either end, may be drawn over the line she is typing on, and
  //    a tap on it has to reach her words.  Every assertion is a MEASUREMENT:
  //    a caret lifted to the right number and a caret lifted onto a control
  //    look identical in the source.
  await page.evaluate((t) => {
    const el = document.getElementById('prompt');
    el.value = t;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, SCENE);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const el = document.getElementById('prompt');
    const at = Math.round(el.value.length * 0.12);     // near the TOP of the scene
    el.focus(); el.setSelectionRange(at, at);
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollBy(0, 300));  // push that line above the band
  await page.waitForTimeout(120);
  await page.keyboard.type('typing up here', { delay: 12 });
  await page.waitForTimeout(600);

  const up = await page.evaluate(() => {
    const el = document.getElementById('prompt');
    const k = window.__caretKeep;
    const c = k.caretRect(el);
    const r = el.getBoundingClientRect();
    const mid = Math.round((c.top + c.bottom) / 2);
    const hit = document.elementFromPoint(Math.round(r.left + Math.min(80, r.width / 3)), mid);
    const rows = [];
    document.querySelectorAll('body *').forEach((x) => {
      const cs = getComputedStyle(x);
      if (cs.position !== 'sticky' && cs.position !== 'fixed') return;
      if (x.contains(el) || x.hasAttribute('data-stickybox')) return;
      const q = x.getBoundingClientRect();
      if (!q.width || !q.height) return;
      if (q.right <= r.left || q.left >= r.right) return;
      if (q.bottom <= c.top || q.top >= c.bottom) return;
      rows.push((x.id || x.className || x.tagName).toString().slice(0, 30));
    });
    return {
      caret: [c.top, c.bottom],
      over: rows,
      bandTop: k.band().top,
      bandBottom: k.band().bottom,
      caretBandTop: k.caretBand(el).top,
      caretBandBottom: k.caretBand(el).bottom,
      hit: hit ? (hit.id || hit.className || hit.tagName).toString().slice(0, 40) : 'nothing',
    };
  });
  ok('the caret line is inside the band the keeper narrows to ('
    + Math.round(up.caret[0]) + '-' + Math.round(up.caret[1]) + ' in '
    + Math.round(up.caretBandTop) + '-' + Math.round(up.caretBandBottom) + ')',
    up.caret[0] >= up.caretBandTop - 0.5 && up.caret[1] <= up.caretBandBottom + 0.5);
  ok('and that band never reaches outside the visible one',
    up.caretBandTop >= up.bandTop - 0.5 && up.caretBandBottom <= up.bandBottom + 0.5);
  ok('nothing sticky or fixed is drawn over the caret\'s own line ('
    + (up.over.join(',') || 'none') + ')', up.over.length === 0);
  ok('and a tap on that line reaches her WORDS, not a control (' + up.hit + ')',
    /prompt|pblock/.test(up.hit));

  ok('still no page errors', errors.length === 0);

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.log('caret under button: ' + e.stack); process.exit(1); });
