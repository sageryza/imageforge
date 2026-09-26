#!/usr/bin/env node
/* ON A PHONE WITH THE KEYBOARD UP, THE PHONE KEEPS THE CARET AND THE KEEPER
 * SCROLLS NOTHING (2026-09-26, the fifth report: "have someone check ur work ·
 * this error keeps happening differently").
 *
 * Four fixes each removed a real per-keystroke mechanism and each was
 * followed by "it's not fixed". Two independent reviews of caretkeep.js,
 * stickybox.js and footage.html reached one verdict: a script that scrolls
 * the window while iOS is also revealing the caret is two agents aiming at
 * two bands, and every guard only rate-limited the fight — Footage's feed bar
 * (sticky at both ends) narrowed the band by a bar's height on every scroll
 * the keeper made, the pinned corner buttons (position:fixed = fixed to the
 * LAYOUT viewport on iOS) rode every pan the phone made and moved the band
 * with it, the blind-keyboard guess flipped on near the bottom, and a /sent
 * reply or a feed poll called the keeper off the network. So on a phone
 * whose visualViewport reports a keyboard, keep() borrows the room under the
 * page and does nothing else, and stickybox pins nothing while a box is
 * focused. The keeper still scrolls where it was written: a desktop, Android,
 * the other tests' stubbed keyboard (no `phone` flag on the stub).
 *
 * This test IS the phone: window.scrollTo replaced with iOS's arithmetic (the
 * visual viewport moves inside a layout viewport pushed only at its edge),
 * `__caretKeep.vv` reporting that viewport with `phone: true`, the phone
 * revealing a strayed caret a beat after each keystroke. Every assertion
 * counts the moves the KEEPER made (the phone's own are labelled).
 *
 * Verified failing against the keeper before this (CARETKEEP_FILE=<that
 * copy>): it scrolled twice inside the tap's burst before the run died on
 * the missing `phoneOwns`; the original keeper scrolled 27 times for nine
 * letters.
 *
 *   node scripts/test-caret-pan.js
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

const KEEPER = process.env.CARETKEEP_FILE
  ? fs.readFileSync(process.env.CARETKEEP_FILE, 'utf8')
  : fs.readFileSync(path.join(__dirname, '..', 'public', 'caretkeep.js'), 'utf8');

const SCENE = Array.from({ length: 70 }, (_, i) => 'line ' + (i + 1) + ' — she waits').join('\n');
const KB = 336;          // the keyboard on a 390x844 phone
const INSET = 4;         // the phone reveals a caret to just inside its visual viewport

function html() {
  return `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{margin:0;padding:16px;font:16px/1.5 Georgia,serif}
textarea{width:100%;box-sizing:border-box;font:inherit;padding:10px;border:1px solid #ccc;border-radius:6px;resize:none;overflow:hidden;display:block}
.foot{height:200px}
</style>
<h1>A long scene</h1>
<textarea id="a">${SCENE}</textarea>
<div class="foot"></div>
<script>
(function(){
  var ta = document.getElementById('a');
  ta.style.height = (ta.scrollHeight + 2) + 'px';   // fitted once; the keeper is the subject here
})();
</script>
<button id="corner" data-stickybox style="position:absolute;right:20px;top:1500px;width:26px;height:26px"></button>
<script src="/caretkeep.js"></script>
<script src="/stickybox.js"></script>
<script>
// ── THE PHONE ──
(function(){
  var KB = ${KB}, pan = 0, moves = [], log = [];
  var real = window.scrollTo.bind(window);
  function L(){ return window.scrollY; }
  function vtop(){ return L() + pan; }
  // iOS: scrollTo sets the VISUAL viewport; the layout one is pushed only when
  // the visual reaches its edge
  window.scrollTo = function (x, y) {
    if (typeof x === 'object') { y = x.top; }
    var was = vtop(), l = L();
    if (y < l) { real(0, y); pan = 0; }
    else if (y > l + KB) { real(0, y - KB); pan = KB; }
    else { pan = y - l; }
    if (Math.abs(vtop() - was) >= 1) moves.push({ by: 'page', from: was, to: vtop() });
    log.push(['scrollTo', y, 'L', L(), 'pan', pan]);
  };
  window.__caretKeep.vv = {
    phone: true,   // the phone's own keyboard: the keeper scrolls nothing here
    get offsetTop() { return pan; },
    get pageTop() { return vtop(); },
    get height() { return window.innerHeight - KB; },
  };
  // the phone's own reveal, a beat after an edit: a caret outside the visual
  // viewport is brought just inside it
  function reveal() {
    var el = document.activeElement;
    if (!el || el.tagName !== 'TEXTAREA') return;
    var c = window.__caretKeep.caretRect(el);
    var vh = window.innerHeight - KB;
    var vb = c.bottom - pan, vt = c.top - pan;   // the caret in VISUAL coordinates
    var was = vtop();
    if (vb > vh) window.scrollTo(0, vtop() + (vb - vh) + ${INSET});
    else if (vt < 0) window.scrollTo(0, vtop() + vt - ${INSET});
    if (Math.abs(vtop() - was) >= 1) { moves[moves.length - 1].by = 'phone'; }
  }
  document.addEventListener('input', function(){ setTimeout(reveal, 40); }, true);
  window.__phone = {
    reveal: reveal, moves: function(){ return moves.slice(); }, reset: function(){ moves = []; log = []; },
    vtop: vtop, pan: function(){ return pan; }, log: function(){ return log.slice(); },
    setPan: function(p){ pan = p; },
    // a phone that flatly undoes every correction without moving the layout viewport
    stubborn: function(on){ window.scrollTo = on ? function(){ log.push(['scrollTo-ignored']); } : window.__phone.iosScroll; },
    iosScroll: window.scrollTo,
  };
})();
</script>`;
}

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + m); if (!c) fails++; };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/caretkeep.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); return res.end(KEEPER); }
  if (servePublic(req, res)) return;
  if (url.pathname === '/p') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(html()); }
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

  // the caret in VISUAL coordinates against the phone's visual viewport
  const where = () => page.evaluate(() => {
    const el = document.getElementById('a');
    const c = window.__caretKeep.caretRect(el);
    const pan = window.__phone.pan();
    return { top: c.top - pan, bottom: c.bottom - pan, vh: window.innerHeight - 336, vtop: window.__phone.vtop(), pan };
  });

  // the phone has just revealed the caret at `at`: its line sits 2px inside
  // the bottom of the visual viewport, panned where iOS pans to
  const land = (at) => page.evaluate((at) => {
    const el = document.getElementById('a');
    const i = at === 'end' ? el.value.length : el.value.indexOf(at);
    el.focus(); el.setSelectionRange(i, i);
    const c = window.__caretKeep.caretRect(el);
    const vh = window.innerHeight - 336;
    window.__phone.iosScroll(0, window.scrollY + c.bottom - vh + 2);
    window.__phone.reset();
  }, at);

  // a page move made by the KEEPER (the phone's own reveal is labelled 'phone')
  const keeperMoves = () => page.evaluate(() => window.__phone.moves().filter((m) => m.by === 'page').length);
  const pinned = () => page.evaluate(() => document.querySelectorAll('.sbx-pin').length);

  // ── 1. typing at the end of a scene the phone has just revealed ──
  await page.goto(base + '/p');
  await land('end');
  await page.waitForTimeout(1200);   // the tap's burst would have run here
  ok((await keeperMoves()) === 0, 'after a tap the keeper has scrolled nothing through the whole burst (' + (await keeperMoves()) + ')');
  ok((await page.evaluate(() => window.__caretKeep.phoneOwns())) === true, 'the keeper knows the phone owns the caret');
  ok((await pinned()) === 0, 'and no corner button is pinned while she types on the phone');
  await page.evaluate(() => window.__phone.reset());
  await page.type('#a', ' and then', { delay: 70 });
  await page.waitForTimeout(300);
  let w = await where();
  ok((await keeperMoves()) === 0, 'nine letters on one line: the keeper scrolls nothing (' + (await keeperMoves()) + ' keeper moves)');
  ok(w.bottom <= w.vh + 1 && w.top >= -1, 'and the phone keeps the caret in view (' + Math.round(w.top) + '–' + Math.round(w.bottom) + ' of 0–' + w.vh + ')');
  const pad = await page.evaluate(() => parseFloat(document.documentElement.style.paddingBottom) || 0);
  ok(pad > 200, 'the room under the page is still borrowed so its foot is reachable (' + Math.round(pad) + 'px)');

  // ── 2. deletes ──
  await page.evaluate(() => window.__phone.reset());
  for (let i = 0; i < 4; i += 1) { await page.keyboard.press('Backspace'); await page.waitForTimeout(70); }
  await page.waitForTimeout(300);
  ok((await keeperMoves()) === 0, 'four deletes: the keeper scrolls nothing');

  // ── 3. a Return then letters: only the phone moves, and only to reveal ──
  await page.evaluate(() => window.__phone.reset());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.type('#a', 'more', { delay: 70 });
  await page.waitForTimeout(300);
  const mv = await page.evaluate(() => window.__phone.moves());
  ok(mv.filter((m) => m.by === 'page').length === 0 && mv.length <= 1,
    'a Return then four letters: the keeper scrolls nothing and the phone reveals at most once (' + mv.map((m) => m.by + ' ' + Math.round(m.from) + '→' + Math.round(m.to)).join(', ') + ')');
  w = await where();
  ok(w.bottom <= w.vh + 1, 'and the new line is inside what she sees (' + Math.round(w.bottom) + ' of ' + w.vh + ')');

  // ── 4. putting the cursor down ──
  await page.evaluate(() => { document.getElementById('a').blur(); });
  await page.waitForTimeout(600);
  await land('line 50');
  await page.evaluate(() => { document.getElementById('a').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(1300);
  ok((await keeperMoves()) === 0, 'a tap into the scene: the keeper scrolls nothing through the whole burst');

  // ── 5. a selection ──
  const sel = await page.evaluate(() => {
    const el = document.getElementById('a');
    el.setSelectionRange(0, el.value.length);
    window.__phone.reset();
    for (let i = 0; i < 6; i += 1) window.__caretKeep.keep();
    document.dispatchEvent(new Event('selectionchange'));
    return window.__phone.moves().filter((m) => m.by === 'page').length;
  });
  ok(sel === 0, 'with the whole scene selected, six keeps scroll nothing');

  // ── 6. a pan by the phone re-pins nothing and calls the keeper for nothing ──
  await page.evaluate(() => {
    const el = document.getElementById('a');
    el.setSelectionRange(el.value.length, el.value.length);
    window.__phone.reset();
    for (const p of [40, 120, 200, 60]) { window.__phone.setPan(p); window.visualViewport && window.visualViewport.dispatchEvent(new Event('scroll')); window.dispatchEvent(new Event('scroll')); }
  });
  await page.waitForTimeout(300);
  ok((await keeperMoves()) === 0 && (await pinned()) === 0, 'four pans by the phone: nothing pinned, nothing scrolled');

  // ── 7. the keyboard goes: the corner button comes back ──
  await page.evaluate(() => { document.getElementById('a').blur(); window.__caretKeep.vv.phone = false; });
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({ pad: parseFloat(document.documentElement.style.paddingBottom) || 0, owns: window.__caretKeep.phoneOwns() }));
  ok(after.pad === 0 && after.owns === false, 'the keyboard goes: the room is given back and the phone no longer owns the caret (' + after.pad + 'px)');

  // ── 8. NOT a phone (Android, a desktop, the tests' stubbed keyboard): the
  //       keeper still scrolls, exactly as it always did ──
  const same = await page.evaluate(() => {
    const el = document.getElementById('a');
    el.focus(); el.setSelectionRange(el.value.length, el.value.length);
    window.__phone.iosScroll(0, 0); window.__phone.setPan(0);
    const c = window.__caretKeep.caretRect(el), b = window.__caretKeep.band();
    const d = c.bottom - b.bottom;
    const want = window.scrollY + d;
    window.__phone.reset();
    window.__caretKeep.keep();
    const l = window.__phone.log().filter((x) => x[0] === 'scrollTo');
    return { want, got: l.length ? l[l.length - 1][1] : null, owns: window.__caretKeep.phoneOwns() };
  });
  ok(same.owns === false && same.got !== null && Math.abs(same.got - same.want) < 1,
    'where the phone does not own the caret the keeper asks for scrollY + d as before (' + Math.round(same.want) + ' / ' + Math.round(same.got) + ')');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
