#!/usr/bin/env node
/* Tests the JUDGE page (public/judge.js) — the one-at-a-time ♥/✕/maybe/later
 * review surface — the way a served page actually runs (real pill injected).
 *
 *   node scripts/test-judge.js
 *
 * Checks the contract:
 *   1. one card at a time with a progress count
 *   2. each verdict POSTs live (true / false / 'maybe') and advances
 *   3. judging everything lands on the PILES view, grouped with counts
 *   4. tapping a pile tile re-opens that item for re-judging
 *   5. a pair item renders as a labeled side-by-side judged as one thing
 *   6. every card carries a note box (the standing rule)
 *
 * Same harness as test-compare-shell.js: headless Chromium, tiny server, the
 * page reports its verdict over HTTP. Skips with exit 0 if no Chromium.
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

const PAGE = `<!doctype html><meta charset="utf-8"><title>judge test</title>
<link rel="stylesheet" href="/compare.css">
<div class="wrap">
  <div class="eyebrow">TEST</div><h1>Judge</h1>
  <div id="judge"></div>
</div>
<script src="/compare.js"></script>
<script src="/judge.js"></script>
__PILL__
<script>
window.addEventListener('error', function(e){
  fetch('/result?r=' + encodeURIComponent('FAIL: page error — ' + e.message + ' @' + (e.filename||'') + ':' + (e.lineno||'')));
});
</script>
<script>
(function(){
  var L=[];
  function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  var posts=[], realFetch=window.fetch.bind(window);
  window.fetch=function(u,o){ if(o&&o.method==='POST') posts.push(JSON.parse(o.body)); return realFetch(u,o); };
  function lastPost(){ return posts[posts.length-1] || {}; }
  var IMG="${IMG}";
  window.__judge({ chat:'t', sheet:'s', items:[
    { id:'a', label:'first', img:IMG },
    { id:'b', label:'which quality?', pair:[{img:IMG,label:'medium'},{img:IMG,label:'high'}] },
    { id:'c', label:'third', img:IMG },
    { id:'d', label:'a text card', card:'<b>survey text</b> with <a href="#">a link</a>' },
  ]});
  setTimeout(function(){
    var m=document.getElementById('judge');
    function count(){ var e=m.querySelector('.jg-count'); return e?e.textContent:''; }
    function tap(sel){ var b=m.querySelector(sel); if(b) b.click(); return !!b; }
    // A DECK WITH NO BROWSE MODE NOW WAITS OUT THE GOOD/BAD STAMP before it
    // moves on (judge.js), so every check that reads the card AFTER a verdict
    // has to wait too — 700ms clears the stamp's own 620.
    function step(fn){ return new Promise(function(r){ setTimeout(function(){ fn(); r(); }, 700); }); }

    // 1 — one card, a progress count, a note box
    ok(count()==='1 of 4' && m.querySelectorAll('.jg-card').length===1, 'one card at a time with a count');
    ok(!!m.querySelector('.cmp-note-box'), 'every card carries a note box');

    // 2 — heart posts true, stamps GOOD on the card it is leaving, and only
    //     then advances to the PAIR card
    tap('[data-act="yes"]');
    ok(lastPost().ok===true && lastPost().item==='a', 'a heart saves verdict true, live');
    var stamp=m.querySelector('.jg-stamp .jg-stampmark');
    ok(!!stamp && stamp.textContent==='GOOD' && count()==='1 of 4',
       'a heart stamps GOOD on the card before the deck moves on');

    Promise.resolve()
    .then(function(){ return step(function(){
      var tags=m.querySelectorAll('.jg-media figure .tag');
      ok(m.querySelectorAll('.jg-media figure').length===2
         && tags.length===2 && tags[0].textContent==='medium' && tags[1].textContent==='high',
         'a pair renders as a labeled side-by-side judged as one thing');

      // maybe → its own pile value, and NO stamp: there is no good or bad in it
      tap('[data-act="maybe"]');
      ok(lastPost().ok==='maybe' && lastPost().item==='b', "maybe saves the string 'maybe'");
      ok(!m.querySelector('.jg-stamp'), 'maybe leaves no stamp');
    }); })
    .then(function(){ return step(function(){
      ok(count()==='3 of 4', 'maybe still advances the deck');
      tap('[data-act="no"]');
      var st=m.querySelector('.jg-stamp .jg-stampmark');
      ok(!!st && st.textContent==='BAD', 'a pass stamps BAD');
    }); })
    .then(function(){ return step(function(){
      var ct=m.querySelector('.jg-cardtext');
      ok(count()==='4 of 4' && ct && ct.querySelector('b') && ct.querySelector('a'),
         'a text card renders its HTML in place of a picture');

      // 3 — last verdict lands on the piles view, grouped with counts
      tap('[data-act="yes"]');
    }); })
    .then(function(){ return step(function(){
      var heads=[].map.call(m.querySelectorAll('.jg-piles h2'), function(h){ return h.textContent; });
      ok(count()==='4 of 4 sorted'
         && heads.join('|')==='Loved · 2|Maybe · 1|Passed · 1',
         'all judged opens the piles view, grouped with counts');
      var ttile=m.querySelector('.jg-grid button.txt');
      ok(ttile && ttile.textContent==='a text card' && ttile.getAttribute('data-open')==='d',
         'a card item shows as a text tile named by its label');

      // 4 — a pile tile re-opens that item; re-judging moves it
      tap('[data-open="b"]');
      ok(count()==='2 of 4' && m.querySelector('.jg-media figure .tag'), 'a pile tile re-opens its card');
      tap('[data-act="later"]');
      ok(lastPost().ok==='later' && lastPost().item==='b', "re-judging posts the new pile ('later')");
      var heads2=[].map.call(m.querySelectorAll('.jg-piles h2'), function(h){ return h.textContent; });
      ok(heads2.indexOf('Later · 1')>=0, 'the item moved piles');
    }); })
    .then(function(){
      fetch('/result?r=' + encodeURIComponent(L.join(' | ')));
    });
  }, 500);
})();
</script>`;

const files = {
  '/compare.css': ['text/css', fs.readFileSync(path.join(PUB, 'compare.css'), 'utf8')],
  '/compare.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'compare.js'), 'utf8')],
  '/judge.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'judge.js'), 'utf8')],
};
const pill = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');

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
  res.end(PAGE.replace('__PILL__', pill));
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-'));
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
