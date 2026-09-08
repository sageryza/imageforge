#!/usr/bin/env node
/* THE CARET STAYS WHERE SHE CAN SEE IT (2026-09-08, Sophie, editing a scene on
 * the soap-pill belt: "when i edit the text, the scroll position moves, so the
 * cursor is under the textbox").
 *
 * caretkeep.js driven on a page shaped like the real belt: a HORIZONTALLY
 * snapping deck of cards, each holding a textarea fitted to its own words, and
 * compare.js loading the keeper lazily on the first focus — the exact road the
 * pages already posted take.
 *
 * EVERY ASSERTION IS A MEASUREMENT. A keeper that runs and scrolls the wrong
 * way, one that scrolls the DECK instead of the window, and one that fires on
 * a caret already in view all look identical to any source assertion. A
 * headless browser has no keyboard, so the band is stubbed through
 * `__caretKeep.vv` — the module's own documented seam — with the same shape
 * visualViewport reports on a phone: a shorter viewport, offset unchanged.
 *
 *   node scripts/test-caret-keep.js
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

// the belt's own scene, long enough that the box is taller than the phone.
// Every line but one is short enough to sit on ONE visual line at 390pt, so a
// caret's line number is a fact the test can count; line 41 is a paragraph
// that wraps, which is what the mirror exists for.
const WRAPPER = 'nurse edna walks in through the doorway of sophie\'s room carrying two small white cups, '
  + 'one with a single blue pill in it and no water at all, the other with a little bit of water.';
const SCENE = Array.from({ length: 60 }, (_, i) =>
  (i === 40 ? WRAPPER : 'line ' + (i + 1) + ' — she waits')).join('\n');

// the belt page's shape, verbatim in the parts that matter: the snap deck, the
// card, a box with no scrollbar of its own, and the fit on every keystroke
function beltHtml() {
  return `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/compare.css">
<style>
.deck{display:flex;align-items:flex-start;overflow-x:auto;overflow-y:visible;scroll-snap-type:x mandatory}
.card{flex:0 0 100%;scroll-snap-align:start;box-sizing:border-box;padding:6px 14px 60px;min-width:0}
textarea.p{width:100%;box-sizing:border-box;font-family:inherit;font-size:16px;line-height:1.5;padding:10px;border:1px solid #cfc6b6;border-radius:6px;background:#fff;resize:none;min-height:100px}
</style>
<h1>The soap pill scene</h1>
<div class="deck" id="deck">
  <section class="card"><h2>1 · the pill</h2><textarea class="p" id="a">${SCENE}</textarea></section>
  <section class="card"><h2>2 · the hall</h2><textarea class="p" id="b">short one</textarea></section>
</div>
<script src="/compare.js"></script>
<script>
(function(){
  document.querySelectorAll('textarea.p').forEach(function(ta){
    function fit(){ ta.style.height='auto'; ta.style.height=(ta.scrollHeight+2)+'px'; }
    fit(); ta.addEventListener('input', fit);
  });
})();
</script>`;
}

// a fixed sheet whose own box scrolls — the Chats app's shape
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
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + m); if (!c) fails++; };

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const html = (h) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(h); };
  if (url.pathname === '/belt') return html(beltHtml());
  if (url.pathname === '/sheet') return html(sheetHtml());
  if (url.pathname === '/api/chatfeed/verdict') {
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true,"texts":{}}');
  }
  res.writeHead(404); res.end('nope');
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const exe = (() => {
    if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
    for (const k of (() => { try { return fs.readdirSync('/opt/pw-browsers'); } catch { return []; } })()
      .filter((n) => /^chromium-\d/.test(n))) {
      const p = path.join('/opt/pw-browsers', k, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
    return null;
  })();
  const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => ok(false, 'page error: ' + e.message));

  // ── 1. compare.js loads it on the first focus, and not before ──
  await page.goto(base + '/belt');
  await page.waitForTimeout(200);
  ok(!(await page.evaluate(() => !!window.__caretKeep)),
    'a page nobody has typed in yet has not fetched the keeper');
  await page.click('#a');
  await page.waitForFunction(() => !!window.__caretKeep, null, { timeout: 4000 });
  ok(true, 'the first focus loads /caretkeep.js');

  // the keyboard: the visible band is the top 430px of an 844px phone
  const KB = () => page.evaluate(() => {
    window.__caretKeep.vv = { offsetTop: 0, height: 430 };
  });
  await KB();

  const caret = () => page.evaluate(() => {
    const el = document.getElementById('a');
    const c = window.__caretKeep.caretRect(el);
    const b = window.__caretKeep.band();
    return { top: c.top, bottom: c.bottom, bTop: b.top, bBottom: b.bottom, y: window.scrollY,
      deckLeft: document.getElementById('deck').scrollLeft };
  });

  // ── 2. the caret is MEASURED, not guessed: line 1 sits at the box's top,
  //       line 30 thirty lines below it ──
  const lines = await page.evaluate(() => {
    const el = document.getElementById('a');
    const box = el.getBoundingClientRect();
    const at = (i) => {
      el.setSelectionRange(i, i);
      return window.__caretKeep.caretRect(el).top - box.top;
    };
    const v = el.value.split('\n');
    const start = (line) => { let n = 0; for (let k = 0; k < line; k += 1) n += v[k].length + 1; return n; };
    return {
      first: at(0), thirtieth: at(start(30)),
      wrapStart: at(start(40)), wrapEnd: at(start(40) + v[40].length),
      lh: parseFloat(getComputedStyle(el).lineHeight),
    };
  });
  ok(lines.first >= 8 && lines.first <= 16,
    'the caret on line 1 sits at the top of the box, inside its padding (' + Math.round(lines.first) + 'px)');
  ok(Math.abs((lines.thirtieth - lines.first) - 30 * lines.lh) < 4,
    'the caret 30 short lines down is 30 line-heights below it (' + Math.round(lines.thirtieth - lines.first) + 'px)');
  ok(lines.wrapEnd - lines.wrapStart >= lines.lh * 1.5,
    'the end of a WRAPPED paragraph is measured on the line it really lands on, not the one it began on ('
      + Math.round((lines.wrapEnd - lines.wrapStart) / lines.lh) + ' lines down)');

  // ── 3. typing at the bottom of a long box keeps the caret above the
  //       keyboard — the bug she reported ──
  await page.evaluate(() => {
    const el = document.getElementById('a');
    window.scrollTo(0, 0);
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  });
  let before = await caret();
  ok(before.bottom > before.bBottom,
    'before: the caret at the end of the scene is below the keyboard (caret ' + Math.round(before.bottom)
      + ' > band ' + Math.round(before.bBottom) + ')');
  await page.type('#a', ' and then', { delay: 10 });
  await page.waitForTimeout(200);
  let after = await caret();
  ok(after.bottom <= after.bBottom + 1 && after.top >= after.bTop - 1,
    'after typing: the caret is inside the visible band (caret ' + Math.round(after.top) + '–'
      + Math.round(after.bottom) + ', band ' + Math.round(after.bTop) + '–' + Math.round(after.bBottom) + ')');
  ok(after.y > before.y, 'it moved the window, not nothing (' + before.y + ' → ' + after.y + ')');
  ok(after.deckLeft === before.deckLeft,
    'the horizontal deck never moved — no scrollIntoView (' + after.deckLeft + ')');
  const roomed = await page.evaluate(() => parseFloat(document.documentElement.style.paddingBottom) || 0);
  ok(roomed > 0,
    'at the END of the scene the page borrowed the room it was short of (' + Math.round(roomed) + 'px)');
  await page.evaluate(() => document.getElementById('a').blur());
  await page.waitForTimeout(600);
  ok((await page.evaluate(() => parseFloat(document.documentElement.style.paddingBottom) || 0)) === 0,
    'and gave it back when the keyboard went');

  // ── 4. a caret already in view is left alone ──
  await page.evaluate(() => {
    const el = document.getElementById('a');
    el.focus(); el.setSelectionRange(0, 0);
    const box = el.getBoundingClientRect();
    window.scrollTo(0, window.scrollY + box.top - 120);   // line 1 near the top
  });
  await page.waitForTimeout(60);
  const quietY = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.__caretKeep.keep(document.getElementById('a')));
  await page.waitForTimeout(60);
  ok((await page.evaluate(() => window.scrollY)) === quietY,
    'a caret already in view moves the page not at all (' + quietY + ')');

  // ── 5. the caret ABOVE the band is brought back down ──
  await page.evaluate(() => {
    const el = document.getElementById('a');
    el.focus(); el.setSelectionRange(0, 0);
    window.scrollTo(0, window.scrollY + 400);            // her line is off the top
  });
  const upBefore = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.__caretKeep.keep(document.getElementById('a')));
  await page.waitForTimeout(60);
  const upAfter = await caret();
  ok(upAfter.y < upBefore, 'a caret above the fold scrolls back up (' + upBefore + ' → ' + upAfter.y + ')');
  ok(upAfter.top >= upAfter.bTop - 1 && upAfter.bottom <= upAfter.bBottom + 1,
    'and lands inside the band (' + Math.round(upAfter.top) + '–' + Math.round(upAfter.bottom) + ')');

  // ── 6. it never fires on her own scrolling ──
  await page.evaluate(() => { document.getElementById('a').blur(); window.scrollTo(0, 300); });
  await page.waitForTimeout(200);
  ok((await page.evaluate(() => window.scrollY)) === 300,
    'with nothing focused the page stays where she put it');

  // ── 7. a box inside a fixed sheet scrolls the SHEET, never the window ──
  const p2 = await ctx.newPage();
  p2.on('pageerror', (e) => ok(false, 'sheet page error: ' + e.message));
  await p2.goto(base + '/sheet');
  await p2.waitForFunction(() => !!window.__caretKeep, null, { timeout: 4000 });
  await p2.evaluate(() => { window.__caretKeep.vv = { offsetTop: 0, height: 430 }; });
  const moved = await p2.evaluate(async () => {
    const el = document.getElementById('s');
    const sheet = document.getElementById('sheet');
    sheet.scrollTop = 1000;
    el.focus(); el.setSelectionRange(el.value.length, el.value.length);
    const was = { sheet: sheet.scrollTop, win: window.scrollY };
    window.__caretKeep.keep(el);
    await new Promise((r) => setTimeout(r, 60));
    const c = window.__caretKeep.caretRect(el), b = window.__caretKeep.band();
    return { was, sheet: sheet.scrollTop, win: window.scrollY, inBand: c.bottom <= b.bottom + 1 };
  });
  ok(moved.sheet !== moved.was.sheet && moved.inBand,
    'the sheet scrolled and the caret is in the band (' + moved.was.sheet + ' → ' + moved.sheet + ')');
  ok(moved.win === moved.was.win, 'the window behind the sheet never moved');

  // ── 8. data-nocaret opts a box out ──
  const opted = await p2.evaluate(async () => {
    const el = document.getElementById('s');
    el.setAttribute('data-nocaret', '');
    const sheet = document.getElementById('sheet');
    sheet.scrollTop = 1000;
    el.focus(); el.setSelectionRange(el.value.length, el.value.length);
    const was = sheet.scrollTop;
    window.__caretKeep.keep(el);
    await new Promise((r) => setTimeout(r, 60));
    el.removeAttribute('data-nocaret');
    return sheet.scrollTop === was;
  });
  ok(opted, 'data-nocaret leaves a box entirely alone');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
  process.exit(fails ? 1 : 0);
})();
