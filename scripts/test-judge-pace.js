#!/usr/bin/env node
/* QUICK OR LABORED (public/judge.js pace:'quick') — 2026-09-01, Sophie: "add
 * a toggle for chats to choose if it's a quick or labored decision + note …
 * in which case heart or x action DOES move deck forward".
 *
 *   node scripts/test-judge-pace.js
 *
 * The contract, on a BROWSE deck (what every template deck is):
 *   1. QUICK: a ♥ advances to the NEXT card — one step forward, never a jump
 *      — after the stamp has had its moment on the card she is leaving
 *   2. QUICK: maybe stays put (she said heart or x, and maybe is neither)
 *   3. QUICK: tapping the lit mark again is a CLEAR and stays put
 *   4. QUICK: a ✕ on the LAST card lands on the piles, like the edge tap
 *   5. LABORED (the default — no pace field): a ♥ never moves the deck,
 *      byte-for-byte the rule as it was
 *
 * Timing is the test's whole subject, so every assertion WAITS past the
 * stamp's 620ms rather than asking in the same frame — a quick deck and a
 * labored one are identical until the animation ends.
 *
 * Same harness as test-judge-stamp.js: headless Chromium, tiny server, the
 * page reports over HTTP. Skips with exit 0 if no Chromium.
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

const PAGE = `<!doctype html><meta charset="utf-8"><title>pace test</title>
<link rel="stylesheet" href="/compare.css">
<div class="wrap">
  <div id="judge"></div>
  <div id="judge2"></div>
</div>
<script src="/compare.js"></script>
<script src="/judge.js"></script>
<script>
window.addEventListener('error', function(e){
  fetch('/result?r=' + encodeURIComponent('FAIL: page error — ' + e.message + ' @' + (e.filename||'') + ':' + (e.lineno||'')));
});
</script>
<script>
(function(){
  var L=[];
  function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  var IMG="${IMG}";
  var q=document.getElementById('judge');
  var lab=document.getElementById('judge2');
  function who(m){ var w=m.querySelector('.who'); return w ? w.textContent : ''; }
  function tap(m,sel){ var b=m.querySelector(sel); if(b) b.click(); return !!b; }

  // the QUICK deck — pace:'quick', browse on (every template deck is)
  window.__judge({ chat:'t', sheet:'s1', browse:true, pace:'quick', look:'mom', items:[
    { id:'a', label:'first', img:IMG },
    { id:'b', label:'second', img:IMG },
    { id:'c', label:'third', img:IMG },
  ]});
  // the LABORED deck — same cards, NO pace field: the default must not move
  window.__judge({ chat:'t', sheet:'s2', browse:true, look:'mom', mount:'#judge2', items:[
    { id:'a', label:'first', img:IMG },
    { id:'b', label:'second', img:IMG },
  ]});

  var steps=[
    function(next){
      ok(who(q)==='first', 'quick deck opens on the first card');
      // 1 — a heart advances one step, after the stamp's moment
      tap(q,'[data-act="yes"]');
      ok(who(q)==='first', 'the card she is leaving wears the stamp first');
      setTimeout(next, 900);
    },
    function(next){
      ok(who(q)==='second', 'QUICK: a heart moves the deck forward one card');
      // 2 — maybe is neither heart nor x, so it stays
      tap(q,'[data-act="maybe"]');
      setTimeout(next, 900);
    },
    function(next){
      ok(who(q)==='second', 'QUICK: maybe stays put');
      // 3 — a clear (tapping the lit mark) stays put too
      tap(q,'[data-act="maybe"]');   // clear the maybe so ✕ below is a fresh mark
      tap(q,'[data-act="no"]');
      setTimeout(next, 900);
    },
    function(next){
      ok(who(q)==='third', 'QUICK: an x moves the deck forward too');
      tap(q,'[data-act="prev"]');     // walk back — edges still navigate
      ok(who(q)==='second', 'QUICK: the edge taps still navigate');
      tap(q,'[data-act="no"]');       // ✕ was its mark — this is a CLEAR
      setTimeout(next, 900);
    },
    function(next){
      ok(who(q)==='second', 'QUICK: clearing the lit mark stays put');
      tap(q,'[data-act="no"]');       // fresh ✕ → forward to third (already judged)
      setTimeout(next, 900);
    },
    function(next){
      ok(who(q)==='third', 'QUICK: forward is ONE step, judged or not');
      // 4 — a decision on the LAST card lands on the piles
      tap(q,'[data-act="no"]');
      setTimeout(next, 900);
    },
    function(next){
      ok(!!q.querySelector('.jg-piles'), 'QUICK: a decision on the last card lands on the piles');
      // 5 — the labored deck (no pace) never moves on a mark
      ok(who(lab)==='first', 'labored deck opens on the first card');
      tap(lab,'[data-act="yes"]');
      setTimeout(next, 900);
    },
    function(next){
      ok(who(lab)==='first', 'LABORED (default): a heart never moves the deck');
      next();
    },
  ];
  var i=0;
  (function run(){
    if (i>=steps.length) { fetch('/result?r=' + encodeURIComponent(L.join(' | '))); return; }
    steps[i++](run);
  })();
})();
</script>`;

const files = {
  '/compare.css': ['text/css', fs.readFileSync(path.join(PUB, 'compare.css'), 'utf8')],
  '/compare.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'compare.js'), 'utf8')],
  '/judge.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'judge.js'), 'utf8')],
};

let finish = null;
const server = http.createServer((req, res) => {
  const [route, qs] = req.url.split('?');
  if (route === '/result') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
    return finish && finish(decodeURIComponent(new URLSearchParams(qs).get('r') || ''));
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
  const url = `http://127.0.0.1:${server.address().port}/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-pace-'));
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
  const timer = setTimeout(() => done('', 'timed out waiting for the page'), 40000);
  finish = (v) => { clearTimeout(timer); done(v); };
});
