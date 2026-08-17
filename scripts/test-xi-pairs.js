#!/usr/bin/env node
/* Tests the XI pairs page (scripts/xi-pages.js pairsHtml) the way it actually
 * serves: real HTML, real pill injected, compare.css/js from public/.
 *
 *   node scripts/test-xi-pairs.js
 *
 * The contract under test (Sophie's ask, 2026-08-17):
 *   1. two cards side by side, different captions
 *   2. each swap changes ONLY its own card (hold one, walk the other)
 *   3. marking a pair POSTs the ORDER-INDEPENDENT key (slugs sorted, '+')
 *      with the state, then auto-steps the RIGHT card
 *   4. back re-opens the previous pair and shows its saved state
 *   5. the + opens the memory box; typing saves {item: pair key, text}
 *   6. the seen counter counts pairs, out of 67*66/2
 *
 * Same harness as test-judge.js: headless Chromium, tiny server, the page
 * reports over HTTP. Skips with exit 0 if no Chromium.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const PUB = path.join(__dirname, '..', 'public');
const { pairsHtml } = require('./xi-pages.js');

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

const DRIVER = `
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
  function slug(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60); }
  function key(a,b){ var s=[slug(a),slug(b)].sort(); return s[0]+'+'+s[1]; }
  function cap(id){ return document.getElementById(id).textContent; }
  function tap(sel){ var b=document.querySelector(sel); if(b) b.click(); return !!b; }

  setTimeout(function(){
    // 1 — two cards, different captions
    var l0=cap('cardL'), r0=cap('cardR');
    ok(!!l0 && !!r0 && l0!==r0, 'two cards render with different captions');

    // 2 — swap right holds the left; swap left holds the right
    tap('#swapR');
    var l1=cap('cardL'), r1=cap('cardR');
    ok(l1===l0 && r1!==r0, 'swap right changes only the right card');
    tap('#swapL');
    var l2=cap('cardL'), r2=cap('cardR');
    ok(r2===r1 && l2!==l1, 'swap left changes only the left card');

    // 3 — marking posts the sorted pair key and steps the right card
    tap('.xstates button[data-v="true"]');
    var p=lastPost();
    ok(p.ok===true && p.item===key(l2,r2), 'sparked posts ok:true on the sorted slug+slug key');
    var l3=cap('cardL'), r3=cap('cardR');
    ok(l3===l2 && r3!==r2, 'marking auto-steps the right card, left held');
    ok(document.getElementById('meta').textContent.indexOf('seen 1 of 2211')===0,
       'the counter counts pairs out of 2211');

    // 4 — back re-opens the marked pair with its state lit
    tap('#back');
    var lit=document.querySelector('.xstates button.sel');
    ok(cap('cardL')===l2 && cap('cardR')===r2 && lit && lit.getAttribute('data-v')==='true',
       'back re-opens the previous pair with its saved state lit');

    // 5 — the + opens the memory box; typing saves to the pair key
    tap('#memOpen');
    var box=document.getElementById('memBox');
    ok(box.offsetParent!==null && box.value==='', 'the + opens an empty memory box');
    box.value='the night we tried';
    box.dispatchEvent(new Event('input'));
    setTimeout(function(){
      var m=posts.filter(function(x){ return x.text!==undefined; }).pop() || {};
      ok(m.item===key(l2,r2) && m.text==='the night we tried',
         'a typed memory saves to the pair its box was opened on');

      // 6 — shuffle lands on a fresh, non-equal pair
      tap('#shuffle');
      ok(cap('cardL')!==cap('cardR'), 'shuffle lands on two different cards');

      fetch('/result?r=' + encodeURIComponent(L.join(' | ')));
    }, 1000);
  }, 500);
})();
</script>`;

const files = {
  '/compare.css': ['text/css', fs.readFileSync(path.join(PUB, 'compare.css'), 'utf8')],
  '/compare.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'compare.js'), 'utf8')],
};
const pill = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const PAGE = pairsHtml() + pill + DRIVER;

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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-pairs-'));
  const kid = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu',
    '--user-data-dir=' + profile, url], { stdio: 'ignore' });
  const timer = setTimeout(() => finish && finish('FAIL: timed out — no report from the page'), 20000);
  finish = (report) => {
    finish = null;
    clearTimeout(timer);
    try { kid.kill(); } catch (_) { /* already gone */ }
    server.close();
    const lines = report.split(' | ');
    lines.forEach((l) => console.log(l));
    process.exit(lines.some((l) => l.startsWith('FAIL')) ? 1 : 0);
  };
});
