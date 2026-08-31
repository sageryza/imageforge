#!/usr/bin/env node
/* SHE COMES BACK TO WHERE SHE LEFT OFF (2026-08-29, Sophie: "I swipe through
 * the Tinder thing does it save my place rather than showing me things I've
 * already swiped on").
 *
 *   node scripts/test-judge-place.js
 *
 * It did not, quite: her marks came back, but reopening jumped to the first
 * UNMARKED card — so a card she browsed past without marking pulled her
 * backwards every single time. The fix stores her place as an item id on the
 * verdict doc her marks already live on.
 *
 * The only honest way to ask this is to LOAD THE DECK TWICE against a server
 * that really keeps the doc, so pass 1 walks and pass 2 reports where it
 * landed. A source assertion cannot tell a saved place from a lucky index.
 *
 * Checks:
 *   1. moving through the deck posts the place — and posts NO verdict with it
 *   2. reopening lands on that card, not on the first unmarked one
 *   3. a place naming a card that has gone falls back to the old rule
 *   4. a finished deck still opens on the piles
 *
 * Headless Chromium; skips with exit 0 if none is available.
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

// The deck is BROWSE mode — her date decks and every stock deck are — because
// that is the shape the bug lives in: there a mark does not move the deck, so
// "where she is" and "the first unmarked card" are different things.
function page(pass, items) {
  return `<!doctype html><meta charset="utf-8"><title>place ${pass}</title>
<link rel="stylesheet" href="/compare.css">
<div class="wrap"><h1>Place</h1><div id="judge"></div></div>
<script src="/compare.js"></script>
<script src="/judge.js"></script>
<script>
window.addEventListener('error', function(e){
  fetch('/result?r=' + encodeURIComponent('FAIL: page error — ' + e.message));
});
(function(){
  var L=[];
  function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  var IMG="${IMG}";
  window.__judge({ chat:'t', sheet:'s', browse:true, items:${JSON.stringify(items)}
    .map(function(x){ x.img=IMG; return x; }) });
  var m=document.getElementById('judge');
  function count(){ var e=m.querySelector('.jg-count'); return e?e.textContent:''; }
  function tap(sel){ var b=m.querySelector(sel); if(b) b.click(); return !!b; }
  function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  var PASS=${pass};
  // 900ms lets the resume fetch land and paint before anything is asserted
  wait(900).then(function(){
    if (PASS === 1) {
      // she marks the first card and then BROWSES on without marking —
      // exactly the shape that used to pull her back to card 2
      tap('[data-act="yes"]');
      tap('[data-act="next"]'); tap('[data-act="next"]'); tap('[data-act="next"]');
      ok(count()==='4 of 5', 'walked to the fourth card');
      return wait(900).then(function(){
        return fetch('/posts').then(function(r){ return r.json(); }).then(function(p){
          var pl = p.filter(function(b){ return b.at !== undefined; });
          ok(pl.length >= 1 && pl[pl.length-1].at === 'd', 'her place posts as the item id');
          ok(pl.every(function(b){ return b.ok === undefined && b.item === undefined; }),
             'a place is not a verdict — it writes no mark');
          return fetch('/result?r=' + encodeURIComponent(L.join(' | ')))
            .then(function(){ location.href = '/?pass=2'; });
        });
      });
    }
    if (PASS === 2) {
      ok(count()==='4 of 5', 'reopening lands where she left off, not on the first unmarked card');
      ok(!m.querySelector('.jg-piles'), 'and on the card, not the piles');
      return fetch('/result?r=' + encodeURIComponent(L.join(' | ')))
        .then(function(){ location.href = '/?pass=3'; });
    }
    if (PASS === 3) {
      // the deck this pass is missing card 'd' — the place names a card that
      // has gone, so it falls back to the first unmarked one (card 2)
      ok(count()==='2 of 4', 'a place naming a card that has gone falls back to the first unmarked');
      return fetch('/result?r=' + encodeURIComponent(L.join(' | ')))
        .then(function(){ location.href = '/?pass=4'; });
    }
    // pass 4 — every card marked: the piles view still wins over her place
    ok(!!m.querySelector('.jg-piles'), 'a finished deck still opens on the piles');
    L.push('DONE');
    return fetch('/result?r=' + encodeURIComponent(L.join(' | ')));
  });
})();
</script>`;
}

const files = {
  '/compare.css': ['text/css', fs.readFileSync(path.join(PUB, 'compare.css'), 'utf8')],
  '/compare.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'compare.js'), 'utf8')],
  '/judge.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'judge.js'), 'utf8')],
};

const ALL = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];
const NO_D = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'e' }];

// the stub keeps the doc, the way the real route does
const doc = { items: {}, texts: {}, at: '' };
const posts = [];
let finish = null; const results = [];

const server = http.createServer((req, res) => {
  const [route, qs] = req.url.split('?');
  const q = new URLSearchParams(qs || '');
  if (route === '/result') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
    const r = decodeURIComponent(q.get('r') || '');
    results.push(r);
    if (/DONE|FAIL/.test(r)) finish && finish(results.join(' | '));
    return;
  }
  if (route === '/posts') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(posts));
  }
  if (route === '/api/chatfeed/verdict') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
        let b = {};
        try { b = JSON.parse(body); } catch (_) {}
        posts.push(b);
        if (b.at !== undefined) doc.at = String(b.at || '');
        if (b.ok !== undefined && b.item !== undefined) doc.items[b.item] = b.ok;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, items: doc.items, texts: doc.texts, at: doc.at }));
  }
  if (route === '/api/gallery/assets') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"assets":[]}');
  }
  const hit = files[route];
  if (hit) { res.writeHead(200, { 'Content-Type': hit[0] }); return res.end(hit[1]); }
  const pass = parseInt(q.get('pass') || '1', 10);
  // pass 3 drops the card her place names; pass 4 opens a fully marked deck
  if (pass === 4) ALL.forEach((it) => { doc.items[it.id] = true; });
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page(pass, pass === 3 ? NO_D : ALL));
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jplace-'));
  const kid = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu',
    '--user-data-dir=' + profile, url], { stdio: 'ignore' });
  const done = (verdict, err) => {
    try { kid.kill('SIGKILL'); } catch (_) {}
    server.close();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
    if (err) { console.error(err); process.exit(1); }
    const lines = verdict.split(' | ').filter((l) => l && l !== 'DONE');
    lines.forEach((l) => console.log(l));
    if (!lines.length) { console.error('no verdict — the page script never ran'); process.exit(1); }
    if (lines.some((l) => l.startsWith('FAIL'))) process.exit(1);
    console.log(`all ${lines.length} checks passed`);
    process.exit(0);
  };
  const timer = setTimeout(() => done('', 'timed out waiting for the page'), 40000);
  finish = (v) => { clearTimeout(timer); done(v); };
});
