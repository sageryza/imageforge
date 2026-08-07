#!/usr/bin/env node
/* Tests the Compare page shell (public/compare.js) against the REAL injected
 * pill (public/pill-inject.html), the way a served Compare page actually runs.
 *
 *   node scripts/test-compare-shell.js
 *
 * Checks the three things hand-rolled Compare pages have each got wrong:
 *   1. a tap on ordinary content pauses the autoscroll
 *   2. a tap on the PILL is exempt — its own play button still works (an
 *      unconditional stop repaints the glyphs mid-press and eats the click)
 *   3. opening an image stops the scroll, locks the page, and closing restores
 *      the exact scroll position
 *
 * Uses headless Chromium directly (no playwright dependency): it serves the
 * page, runs an in-page script that drives the taps, and the page POSTs its
 * verdict back to the test server. Skips with exit 0 if no Chromium is found.
 *
 * The verdict comes back over HTTP rather than via --dump-dom on purpose:
 * --virtual-time-budget HANGS on this page, because the pill's autoscroll is a
 * requestAnimationFrame loop and virtual time fast-forwards it forever.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const PUB = path.join(__dirname, '..', 'public');
const CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].filter(Boolean);
const chrome = CANDIDATES.find((p) => { try { fs.accessSync(p); return true; } catch (_) { return false; } })
  || (() => {
    try {
      const dir = '/opt/pw-browsers';
      const hit = fs.readdirSync(dir).find((d) => d.startsWith('chromium-'));
      const p = hit && path.join(dir, hit, 'chrome-linux', 'chrome');
      return p && fs.existsSync(p) ? p : null;
    } catch (_) { return null; }
  })();

if (!chrome) { console.log('no Chromium found — skipping (set CHROME_PATH to run)'); process.exit(0); }

const PAGE = `<!doctype html><meta charset="utf-8"><title>pending</title>
<link rel="stylesheet" href="/compare.css">
<div class="wrap">
  <div class="eyebrow">TEST</div><h1>Compare shell</h1>
  <div class="card"><button id="vote">vote</button></div>
  ${'<div class="card"><p>tall filler so the page can scroll</p></div>'.repeat(60)}
  <div class="imgrow">
    <img id="pic" alt="a" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23c99'/%3E%3C/svg%3E">
  </div>
  ${'<div class="card"><p>more filler</p></div>'.repeat(60)}
</div>
<script src="/compare.js"></script>
__PILL__
<script>
(function(){
  var L=[];
  function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  setTimeout(function(){
    // 1. content tap pauses an already-running autoscroll
    window.__scrollStart(1);
    var playingAfterStart = !!document.querySelector('.vseg button.on');
    document.getElementById('vote').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    ok(playingAfterStart && !document.querySelector('.vseg button.on'), 'a tap on a button pauses the autoscroll');

    // 2. the pill is exempt — its play button still starts the scroll
    var mid=document.getElementById('vmid');
    mid.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    mid.click();
    ok(!!document.querySelector('.vseg button.on'), "the pill's own play button still works");
    window.__scrollStop();

    // 3. image lightbox: stops scroll, locks the page, restores position
    window.scrollTo(0, 900);
    var y0 = window.scrollY;
    window.__scrollStart(1);
    document.getElementById('pic').click();
    var lb = document.querySelector('.cmp-lb');
    var openOk = lb && !lb.hasAttribute('hidden')
      && document.body.style.overflow === 'hidden'
      && !document.querySelector('.vseg button.on');
    ok(openOk, 'opening an image stops the scroll and locks the page');
    window.scrollBy(0, 400);              // something moves the page underneath
    lb.click();                            // close
    ok(Math.abs(window.scrollY - y0) < 2 && document.body.style.overflow === '',
       'closing restores the exact scroll position');

    fetch('/result?r=' + encodeURIComponent(L.join(' | ')));
  }, 300);
})();
</script>`;

const files = {
  '/compare.css': ['text/css', fs.readFileSync(path.join(PUB, 'compare.css'), 'utf8')],
  '/compare.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'compare.js'), 'utf8')],
};
const pill = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');

let finish = null;
const server = http.createServer((req, res) => {
  const [route, qs] = req.url.split('?');
  if (route === '/result') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
    return finish && finish(decodeURIComponent(new URLSearchParams(qs).get('r') || ''));
  }
  const hit = files[route];
  if (hit) { res.writeHead(200, { 'Content-Type': hit[0] }); return res.end(hit[1]); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(PAGE.replace('__PILL__', pill));
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cmp-shell-'));
  const kid = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu',
    '--user-data-dir=' + profile, url], { stdio: 'ignore' });

  const done = (verdict, err) => {
    try { kid.kill('SIGKILL'); } catch (_) {}
    server.close();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
    if (err) { console.error(err); process.exit(1); }
    const lines = verdict.split(' | ').filter(Boolean);
    lines.forEach((l) => console.log(l));
    if (!lines.length) { console.error('no verdict — the page script never ran'); process.exit(1); }
    if (lines.some((l) => l.startsWith('FAIL'))) process.exit(1);
    console.log(`all ${lines.length} checks passed`);
    process.exit(0);
  };
  const timer = setTimeout(() => done('', 'timed out waiting for the page'), 30000);
  finish = (v) => { clearTimeout(timer); done(v); };
});
