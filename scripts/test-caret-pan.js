#!/usr/bin/env node
/* THE PAGE IS SCROLLED WHERE SHE IS LOOKING, NOT WHERE THE LAYOUT VIEWPORT
 * IS (2026-09-26, Sophie, on Footage: "always has the same bug of screen
 * moving every time i type or put the cursor delete etc").
 *
 * With the keyboard up, iOS keeps the LAYOUT viewport where it was and PANS
 * the VISUAL viewport inside it to reveal the caret (`visualViewport
 * .offsetTop`, ~115pt on her Footage screenshot). `window.scrollY` reports
 * the layout viewport and `window.scrollTo` moves the visual one, so the
 * keeper's `scrollTo(0, scrollY + d)` with a pan of 115 and a caret 30px too
 * low set the view 85px UP instead of 30 DOWN; the phone panned back to
 * reveal the caret, and the next keystroke did it again. Every keystroke,
 * every tap, every delete.
 *
 * A headless browser never pans, so this test IS the phone: `window.scrollTo`
 * is replaced with iOS's own arithmetic (the visual viewport moves inside a
 * layout viewport that is pushed only when the visual one reaches its edge),
 * `__caretKeep.vv` reports that visual viewport the way `visualViewport` does
 * (offsetTop, pageTop, height), and after every keystroke the phone reveals a
 * caret that has left the visual viewport, a beat later, as the UI process
 * does. EVERY ASSERTION IS A MEASUREMENT of how far the view she sees moved.
 *
 * Verified failing 7 against the pre-fix keeper (CARETKEEP_FILE=<that copy>):
 * nine letters on one line moved the view 27 times, 5,337px in all; four
 * deletes moved it 14 times; a Return flipped it 1310 → 1020 → 1286 and back
 * on every letter after; and against a phone that undid every correction it
 * scrolled 23 times without noticing.
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
<script src="/caretkeep.js"></script>
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

  // ── 1. typing at the end of a scene the phone has just revealed ──
  // She tapped at the end; the phone revealed the caret just inside its visual
  // viewport (where iOS puts it: at the bottom edge). The keeper then wants it
  // its own margin higher — ONE correction — and must not be undone.
  await page.goto(base + '/p');
  await land('end');
  await page.waitForTimeout(1200);   // the tap's burst has run out
  let w = await where();
  ok(w.bottom <= w.vh + 1 && w.top >= -1,
    'after the tap\'s burst the caret is inside what she sees (' + Math.round(w.top) + '–' + Math.round(w.bottom) + ' of 0–' + w.vh + ', panned ' + w.pan + 'pt)');
  await page.evaluate(() => window.__phone.reset());
  await page.type('#a', ' and then', { delay: 70 });   // 9 keystrokes, each with the phone's reveal 40ms after
  await page.waitForTimeout(300);
  let moves = await page.evaluate(() => window.__phone.moves());
  let dist = moves.reduce((s, m) => s + Math.abs(m.to - m.from), 0);
  ok(moves.length <= 1,
    'typing nine letters on one line moves the view she sees at most once (' + moves.length + ' moves, ' + Math.round(dist) + 'px in all)');
  w = await where();
  ok(w.bottom <= w.vh + 1 && w.top >= -1,
    'and the caret is inside what she sees (' + Math.round(w.top) + '–' + Math.round(w.bottom) + ' of 0–' + w.vh + ')');

  // ── 2. a delete on the same line ──
  await page.evaluate(() => window.__phone.reset());
  for (let i = 0; i < 4; i += 1) { await page.keyboard.press('Backspace'); await page.waitForTimeout(70); }
  await page.waitForTimeout(300);
  moves = await page.evaluate(() => window.__phone.moves());
  ok(moves.length === 0, 'four deletes on that line move nothing (' + moves.length + ' moves)');

  // ── 3. a wrap: a new line is ONE move, in the direction of the caret ──
  await page.evaluate(() => window.__phone.reset());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.type('#a', 'more', { delay: 70 });
  await page.waitForTimeout(300);
  moves = await page.evaluate(() => window.__phone.moves());
  ok(moves.length <= 1 && moves.every((m) => m.to > m.from),
    'a Return then four letters: at most one move, downward (' + moves.map((m) => m.by + ' ' + Math.round(m.from) + '→' + Math.round(m.to)).join(', ') + ')');
  w = await where();
  ok(w.bottom <= w.vh + 1, 'and the new line is inside what she sees (' + Math.round(w.bottom) + ' of ' + w.vh + ')');

  // ── 4. putting the cursor down: the tap's burst is at most one move ──
  await page.evaluate(() => { document.getElementById('a').blur(); });
  await page.waitForTimeout(600);
  await land('line 50');
  await page.evaluate(() => { document.getElementById('a').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(1300);   // 0 · 90 · 260 · 520 · 900
  moves = await page.evaluate(() => window.__phone.moves());
  ok(moves.length <= 1, 'a tap into the scene moves the view at most once through the whole burst (' + moves.length + ' moves)');

  // ── 5. the keeper watches its own work: a phone that undoes every
  //       correction without moving the layout viewport is not fought ──
  await page.evaluate(() => { document.getElementById('a').blur(); });
  await page.waitForTimeout(600);
  await land('end');
  await page.evaluate(() => { window.__phone.stubborn(true); });
  await page.waitForTimeout(1300);
  await page.type('#a', ' and more', { delay: 70 });
  await page.waitForTimeout(300);
  const tries = await page.evaluate(() => window.__phone.log().filter((l) => l[0] === 'scrollTo-ignored').length);
  const fighting = await page.evaluate(() => (window.__caretKeep.fighting || function () { return null; })());
  ok(tries <= 3, 'against a phone that undoes every correction, the keeper tries at most three times and stops (' + tries + ' tries)');
  ok(fighting === true, 'and says it has stood down for this focus');
  await page.evaluate(() => { window.__phone.stubborn(false); document.getElementById('a').blur(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { document.getElementById('a').focus(); });
  await page.waitForTimeout(200);
  ok((await page.evaluate(() => (window.__caretKeep.fighting || function () { return null; })())) === false, 'a new focus calms it');

  // ── 6. without a pan the target is exactly what it always was ──
  await page.evaluate(() => { document.getElementById('a').blur(); });
  await page.waitForTimeout(500);
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
    return { want, got: l.length ? l[l.length - 1][1] : null };
  });
  ok(same.got !== null && Math.abs(same.got - same.want) < 1,
    'with no pan the keeper asks for scrollY + d, byte for byte what it did before (' + Math.round(same.want) + ' / ' + Math.round(same.got) + ')');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
