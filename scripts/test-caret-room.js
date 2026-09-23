#!/usr/bin/env node
/* THE END OF A LONG BOX IS REACHABLE WITH THE KEYBOARD UP (2026-09-16, Sophie,
 * editing a long message on her phone: "no way to scroll down or split long or
 * bottom messages").
 *
 * The layout viewport does NOT shrink when the keyboard opens, so the bottom
 * of the page keeps sitting under it: at `scrollHeight - innerHeight` — as far
 * down as the page goes — the last line of a box fitted to its own words, and
 * whatever sits under it (the Done bar, the next block), are still a keyboard's
 * height below the visible band, with nothing left to scroll. caretkeep's
 * `setRoom` borrowed room only for the CARET's own shortfall, so it never
 * helped her READ to the end of what she was writing.
 *
 * EVERY ASSERTION IS A MEASUREMENT. A page that grew some padding, one that
 * grew the wrong amount, and one that grew it where the scroller is an inner
 * box all look identical to any source assertion — the only honest question is
 * where the last line LANDS once the page is scrolled as far as it goes.
 *
 * Verified failing against the pre-fix keeper (4 of 9).
 *
 *   node scripts/test-caret-room.js
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }
const servePublic = require('./lib/public-asset');

const KB = 336;                 // an iPhone 13's keyboard, in CSS px
const SCENE = Array.from({ length: 60 }, (_, i) => 'line ' + (i + 1) + ' — she waits').join('\n');
const SHORT = 'one line and no more';

// The belt's shape in the parts that matter: compare.css for the palette,
// compare.js (which is what fetches the keeper on the first focus, so every
// page already posted gets this), a box with no scrollbar of its own fitted to
// its words, and a bar UNDER it — the Done/Reset row she cannot reach.
function pageHtml(text) {
  return `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/compare.css">
<style>
.card{padding:6px 14px 20px}
textarea.p{width:100%;box-sizing:border-box;font-size:16px;line-height:1.5;padding:10px;
  border:1px solid var(--line);border-radius:6px;background:var(--paper);resize:none;overflow:hidden}
.bar{display:flex;gap:8px;margin-top:6px}
</style>
<h1>The scene</h1>
<section class="card"><h2>1 · the pill</h2>
  <textarea class="p" id="a">${text}</textarea>
  <div class="bar" id="bar"><button class="btn">Reset</button><button class="btn">Done</button></div>
</section>
<script src="/compare.js"></script>
<script>
(function(){
  var ta=document.getElementById('a');
  function fit(){ ta.style.height='auto'; ta.style.height=(ta.scrollHeight+2)+'px'; }
  fit(); ta.addEventListener('input', fit);
})();
</script>`;
}

// the Chats app's shape: a fixed sheet whose OWN box scrolls. The window
// cannot help there, so the page must not grow padding it will never use.
function sheetHtml() {
  return `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<div style="position:fixed;inset:0;overflow-y:auto" id="sheet">
  <div style="height:1200px"></div>
  <textarea id="s" style="width:100%;font-size:16px;line-height:1.5;height:600px">${SCENE}</textarea>
  <div style="height:1200px"></div>
</div>
<script src="/caretkeep.js"></script>`;
}

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + m); if (!c) fails += 1; };

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const html = (h) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(h); };
  if (url.pathname === '/long') return html(pageHtml(SCENE));
  if (url.pathname === '/short') return html(pageHtml(SHORT));
  if (url.pathname === '/sheet') return html(sheetHtml());
  if (url.pathname === '/api/chatfeed/verdict') {
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true,"texts":{}}');
  }
  res.writeHead(404); res.end('nope');
});

const findChromium = () => {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  let names = [];
  try { names = fs.readdirSync('/opt/pw-browsers'); } catch (_) { names = []; }
  for (const n of names.filter((x) => /^chromium-\d/.test(x))) {
    const p = path.join('/opt/pw-browsers', n, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
};

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const exe = findChromium();
  const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => ok(false, 'page error: ' + e.message));

  // the keyboard a headless browser has not got, through the module's own seam
  const keyboard = () => page.evaluate((kb) => {
    window.__caretKeep.vv = { offsetTop: 0, height: window.innerHeight - kb };
    window.dispatchEvent(new Event('resize'));
  }, KB);
  // what the screen really shows once the page is scrolled as far as it goes
  const atFoot = () => page.evaluate(() => {
    const de = document.documentElement;
    const max = Math.max(0, de.scrollHeight - window.innerHeight);
    window.scrollTo(0, max);
    const box = document.getElementById('a').getBoundingClientRect();
    const bar = document.getElementById('bar').getBoundingClientRect();
    const b = window.__caretKeep.band();
    return {
      band: b.bottom, boxBottom: box.bottom, barBottom: bar.bottom, barTop: bar.top,
      max, y: window.scrollY, pad: parseFloat(de.style.paddingBottom) || 0,
    };
  });

  // ── 1. THE LONG BOX: its last line and the bar under it clear the keyboard ──
  await page.goto(base + '/long');
  await page.waitForTimeout(200);
  await page.click('#a');
  await page.waitForFunction(() => !!window.__caretKeep, null, { timeout: 4000 });
  await keyboard();
  await page.waitForTimeout(400);

  const tall = await page.evaluate(() => Math.round(document.getElementById('a').getBoundingClientRect().height));
  ok(tall > 844 - KB, 'the fixture box is taller than the band, the way a real scene is (' + tall + 'px)');

  let m = await atFoot();
  ok(m.boxBottom <= m.band,
    'scrolled to the foot, the box’s last line is above the keyboard (' + Math.round(m.boxBottom) + ' vs band ' + Math.round(m.band) + ')');
  ok(m.barBottom <= m.band,
    'and so is the bar under it (' + Math.round(m.barBottom) + ' vs band ' + Math.round(m.band) + ')');
  ok(m.pad >= KB - 60 && m.pad <= window_h_guard(),
    'the page borrowed about a keyboard’s worth of room, not more (' + Math.round(m.pad) + 'px)');

  // ── 2. IT DOES NOT RATCHET. The room is a FLOOR, re-measured every pass —
  //       one that added a keyboard's height per keystroke would walk the
  //       bottom of the page away from her a screen at a time ──
  const before = m.pad;
  await page.evaluate(() => { for (let i = 0; i < 6; i += 1) window.__caretKeep.keep(); });
  await page.waitForTimeout(200);
  const again = await page.evaluate(() => parseFloat(document.documentElement.style.paddingBottom) || 0);
  ok(Math.abs(again - before) < 2,
    'six more passes borrow no more room (' + Math.round(before) + ' → ' + Math.round(again) + 'px)');

  // ── 2b. IT DOES NOT MOVE WHEN iOS PANS (2026-09-23, Sophie, on Footage: "at
  //        various times it still switches rapidly between screens when i put
  //        my cursor down"). With the keyboard up iOS reveals the caret by
  //        OFFSETTING the visual viewport inside the layout one — measured on
  //        her phone in Footage at ~115pt (pill-inject's placeRail note). The
  //        floor was read off `band()`, which is in layout coordinates and so
  //        rides that offset: every pan changed the page's padding, the padding
  //        changed how far the page could scroll, and iOS panned again — the
  //        page and the phone taking turns for a second after every tap. The
  //        keyboard is the same height however far iOS has panned, so the
  //        floor is too.
  const pans = [];
  for (const off of [115, 240, 0, 60]) {
    const pad = await page.evaluate((a) => {
      window.__caretKeep.vv = { offsetTop: a.off, height: window.innerHeight - a.kb };
      window.__caretKeep.keep();
      return parseFloat(document.documentElement.style.paddingBottom) || 0;
    }, { off, kb: KB });
    pans.push(Math.round(pad));
  }
  ok(pans.every((p) => Math.abs(p - before) < 2),
    'the room is the same whatever iOS has panned — 0 / 115 / 240 / 0 / 60 → ' + Math.round(before) + ' / ' + pans.join(' / ') + 'px');
  await page.evaluate((kb) => { window.__caretKeep.vv = { offsetTop: 0, height: window.innerHeight - kb }; }, KB);

  // ── 3. THE ROOM GOES BACK WITH THE KEYBOARD ──
  await page.evaluate(() => { document.getElementById('a').blur(); window.__caretKeep.vv = null; });
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => parseFloat(document.documentElement.style.paddingBottom) || 0);
  ok(after === 0, 'the borrowed room is given back when she is done (' + after + 'px)');

  // ── 4. A SHORT PAGE: the one box on it is reachable too ──
  await page.goto(base + '/short');
  await page.waitForTimeout(200);
  await page.click('#a');
  await page.waitForFunction(() => !!window.__caretKeep, null, { timeout: 4000 });
  await keyboard();
  await page.waitForTimeout(400);
  m = await atFoot();
  ok(m.barBottom <= m.band,
    'on a page shorter than the phone, the bar under the box still clears the keyboard ('
    + Math.round(m.barBottom) + ' vs band ' + Math.round(m.band) + ')');

  // ── 5. NO KEYBOARD, NO ROOM. On a TOUCH device a focused box with a
  //       full-height viewport still means a keyboard nothing reported — the
  //       module's own documented fallback — so the honest case is a desk,
  //       where the page must not grow a screen of blank under her ──
  const deskCtx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const desk = await deskCtx.newPage();
  await desk.goto(base + '/long');
  await desk.waitForTimeout(200);
  await desk.click('#a');
  await desk.waitForFunction(() => !!window.__caretKeep, null, { timeout: 4000 });
  await desk.evaluate(() => window.__caretKeep.keep());
  await desk.waitForTimeout(250);
  const dry = await desk.evaluate(() => parseFloat(document.documentElement.style.paddingBottom) || 0);
  ok(dry === 0, 'a box focused on a desk, with no keyboard, borrows nothing (' + dry + 'px)');
  await deskCtx.close();

  // ── 6. AN INNER SCROLLER IS LEFT ALONE ──
  await page.goto(base + '/sheet');
  await page.waitForTimeout(200);
  await page.click('#s');
  await page.waitForTimeout(150);
  await page.evaluate((kb) => {
    window.__caretKeep.vv = { offsetTop: 0, height: window.innerHeight - kb };
    window.dispatchEvent(new Event('resize'));
  }, KB);
  await page.waitForTimeout(400);
  const sheetPad = await page.evaluate(() => parseFloat(document.documentElement.style.paddingBottom) || 0);
  ok(sheetPad === 0, 'a box inside a fixed sheet that scrolls itself grows no page padding (' + sheetPad + 'px)');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' failed' : '\nall good');
  process.exit(fails ? 1 : 0);
})();

// the cap setRoom itself keeps — a page may never borrow more than one screen
function window_h_guard() { return 844; }
