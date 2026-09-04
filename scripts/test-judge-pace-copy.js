#!/usr/bin/env node
/* THE DECK'S TOUR AND HELP CARD MUST SAY WHICH PACE IT IS (public/judge.js).
 *
 *   node scripts/test-judge-pace-copy.js
 *
 * 2026-09-03. Both lines were written for the LABORED deck and hardcoded —
 * "that is the only thing that moves you", "marking one never moves you on" —
 * and QUICK became the default on 2026-09-03, so every deck was teaching her
 * the opposite of what its own buttons do, on the first open, before she has
 * touched anything. Found by PHOTOGRAPHING a real posted deck: the tour is the
 * first thing on screen and no test had ever read a word of it.
 *
 * The contract, and it is about MEANING rather than wording — each assertion
 * is "this pace never claims the other pace's behaviour", so a reword is free
 * and a copy-paste back to one hardcoded string fails:
 *   1. a QUICK deck's tour never says a mark does not move her
 *   2. a QUICK deck's tour says it does
 *   3. a LABORED deck's tour still says a mark does not move her
 *   4. the help card ("?") follows the same rule — it is the copy she reaches
 *      for later, when the tour is long gone
 *
 * Two clean document loads, `?pace=…`, so no tour state carries between them.
 * Skips with exit 0 if no Chromium.
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

const IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='60'%3E%3Crect width='40' height='60' fill='%23c99'/%3E%3C/svg%3E";

const PAGE = `<!doctype html><meta charset="utf-8"><title>pace copy</title>
<link rel="stylesheet" href="/compare.css">
<div class="wrap"><h1>Pace</h1><div id="judge"></div></div>
<script src="/compare.js"></script>
<script src="/judge.js"></script>
<script>
window.addEventListener('error', function(e){
  fetch('/result?r=' + encodeURIComponent('FAIL: page error — ' + e.message));
});
(function(){
  var pace = new URLSearchParams(location.search).get('pace') || 'quick';
  var L = [];
  function ok(c, m){ L.push((c ? 'PASS' : 'FAIL') + ': [' + pace + '] ' + m); }
  var IMG = "${IMG}";
  try { localStorage.removeItem('cmp-tour-deck'); } catch (e) {}
  window.__judge({ chat:'t', sheet:'s', browse:true, look:'mom', pace:pace, tour:'auto', items:[
    { id:'a', label:'first', img:IMG },
    { id:'b', label:'second', img:IMG },
  ]});
  setTimeout(function(){
    // ── the tour plays itself on a first open. Step it, collecting the copy.
    var seen = [];
    (function step(n){
      var t = document.querySelector('.ct-text');
      if (t && n < 10) {
        seen.push(t.textContent || '');
        var host = document.querySelector('.cmp-tour');
        if (host) host.click();
        return setTimeout(function(){ step(n + 1); }, 60);
      }
      var tour = seen.join(' ⏐ ').toLowerCase();
      ok(seen.length >= 2, 'the tour played and had something to say — ' + seen.length + ' steps');

      // MEANING, not wording: does it claim a mark leaves her where she is?
      var saysStays = /never (moves you|carries you)|does not move you|nothing has to be marked\\./.test(tour);
      // "never moves you on" CONTAINS "moves you on" — take the denials out
      // before asking whether anything actually promises the move
      var moved = tour.replace(/never (moves you on|carries you off it)/g, '');
      var saysMoves = /moves you on|marks the card and moves/.test(moved);
      if (pace === 'quick') {
        ok(!saysStays, 'the tour never tells her a mark leaves her on the card');
        ok(saysMoves, 'the tour says a mark moves her on');
      } else {
        ok(saysStays, 'the tour still says a mark leaves her on the card');
        ok(!saysMoves, 'and never claims it moves her on');
      }

      // ── THE HELP CARD — what she reaches for after the tour is gone
      var h = document.querySelector('[data-act="help"]');
      if (h) h.click();
      setTimeout(function(){
        var card = document.querySelector('.jg-help, .jg-helpcard, [class*=help]');
        var txt = (card ? card.textContent : '').toLowerCase();
        ok(!!txt, 'the ? opens a help card');
        var hStays = /nothing has to be marked/.test(txt);
        var hMoves = /a mark moves you on/.test(txt);
        if (pace === 'quick') {
          ok(!hStays && hMoves, 'the help card says a mark moves her on');
        } else {
          ok(hStays && !hMoves, 'the help card still says nothing has to be marked');
        }
        fetch('/result?r=' + encodeURIComponent(L.join(' | ')))
          .then(function(){
            if (pace === 'quick') location.href = '/?pace=labored';
          });
      }, 300);
    }(0));
  }, 1100);
})();
</script>`;

const files = {
  '/compare.css': ['text/css', fs.readFileSync(path.join(PUB, 'compare.css'), 'utf8')],
  '/compare.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'compare.js'), 'utf8')],
  '/judge.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'judge.js'), 'utf8')],
};

const lines = [];
let finish = null;
const server = http.createServer((req, res) => {
  const [route, qs] = req.url.split('?');
  if (route === '/result') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
    const r = decodeURIComponent(new URLSearchParams(qs).get('r') || '');
    r.split(' | ').filter(Boolean).forEach((l) => lines.push(l));
    // the quick pass hands over to the labored one; the second is the end
    if (/\[labored\]/.test(r) || /page error/.test(r)) finish && finish();
    return;
  }
  if (route === '/api/chatfeed/verdict') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"ok":true,"items":{},"texts":{}}');
  }
  const hit = files[route];
  if (hit) { res.writeHead(200, { 'Content-Type': hit[0] }); return res.end(hit[1]); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(PAGE);
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/?pace=quick`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pace-'));
  const kid = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu',
    '--user-data-dir=' + profile, url], { stdio: 'ignore' });
  const done = (err) => {
    try { kid.kill('SIGKILL'); } catch (_) {}
    server.close();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
    if (err) { console.error(err); process.exit(1); }
    lines.forEach((l) => console.log(l));
    if (!lines.length) { console.error('no verdict — the page script never ran'); process.exit(1); }
    if (lines.some((l) => l.startsWith('FAIL'))) process.exit(1);
    console.log(`all ${lines.length} checks passed`);
    process.exit(0);
  };
  const timer = setTimeout(() => done('timed out waiting for the page'), 40000);
  finish = () => { clearTimeout(timer); setTimeout(() => done(), 150); };
});
