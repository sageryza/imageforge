#!/usr/bin/env node
/* THE GOOD / BAD STAMP on a deck (public/judge.js) — Sophie's own "Decision
 * Deck v3" canvas, Aug 2026: "a little good/bad stamp that stamps the ones
 * that you pick or don't pick".
 *
 *   node scripts/test-judge-stamp.js
 *
 * The contract, on a BROWSE deck (what every real deck is):
 *   1. a ♥ stamps GOOD on the card, and the card stays put
 *   2. a ✕ stamps BAD
 *   3. picking one side of a SPREAD stamps GOOD on the winner and BAD on the
 *      other — the case the whole thing is named for
 *   4. clearing the verdict takes the stamp off again
 *   5. the stamp never eats a tap: it is pointer-events:none, so the ♥ under
 *      it is still what elementFromPoint finds (the measured way to ask —
 *      "visible" says nothing about what a thumb reaches)
 *
 * maybe / later leaving no stamp is checked in test-judge.js, on the deck
 * that still has those buttons.
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

const PAGE = `<!doctype html><meta charset="utf-8"><title>stamp test</title>
<link rel="stylesheet" href="/compare.css">
<div class="wrap">
  <div class="eyebrow">TEST</div><h1>Stamp</h1>
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
  var IMG="${IMG}";
  // browse:true is the deck's default — a mark never moves it, so the stamp
  // stays on screen and can be read
  window.__judge({ chat:'t', sheet:'s', browse:true, look:'mom', items:[
    { id:'a', label:'first', img:IMG },
    { id:'p', label:'which one?', cards:[
        { id:'p1', label:'silkscreen', img:IMG },
        { id:'p2', label:'linocut', img:IMG },
    ] },
  ]});
  setTimeout(function(){
    var m=document.getElementById('judge');
    function tap(sel){ var b=m.querySelector(sel); if(b) b.click(); return !!b; }
    function marks(){ return [].map.call(m.querySelectorAll('.jg-stampmark'),
      function(e){ return e.textContent; }); }

    // 1 — a heart stamps GOOD and the browse deck does not move
    ok(!m.querySelector('.jg-stamp'), 'an undecided card wears no stamp');
    tap('[data-act="yes"]');
    ok(marks().join('')==='GOOD', 'a heart stamps GOOD');
    ok(m.querySelectorAll('.jg-card').length===1
       && !!m.querySelector('[data-act="yes"]'), 'the browse deck stays on the card');
    var live=m.querySelector('.jg-stamp');
    ok(live && live.className.indexOf('live')>=0, 'the fresh stamp is the one that slams on');

    // 5 — it must not eat the tap under it
    var yes=m.querySelector('[data-act="yes"]');
    var r=yes.getBoundingClientRect();
    var hit=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
    ok(!!hit && !!hit.closest('[data-act="yes"]'), 'the stamp does not take the tap off the heart');

    // 2 — a pass stamps BAD; 4 — tapping the lit mark again clears both
    tap('[data-act="no"]');
    ok(marks().join('')==='BAD', 'a pass stamps BAD');
    tap('[data-act="no"]');
    ok(marks().length===0, 'clearing the verdict takes the stamp off');

    // 3 — THE SPREAD: the picked side takes GOOD, the other takes BAD
    tap('[data-act="next"]');
    ok(m.querySelectorAll('.jg-spread figure').length===2, 'the spread is on screen');
    tap('[data-pick="p2"]');
    var figs=[].slice.call(m.querySelectorAll('.jg-spread figure'));
    var got=figs.map(function(f){
      var s=f.querySelector('.jg-stampmark'); return s ? s.textContent : '-';
    });
    ok(got.join('|')==='BAD|GOOD', 'the picked side is stamped GOOD and the other BAD');
    ok(figs.length===2 && figs[1].querySelector('.jg-stamp')
       && figs[1].querySelector('.jg-stamp').className.indexOf(' b')<0
       && figs[0].querySelector('.jg-stamp')
       && figs[0].querySelector('.jg-stamp').className.indexOf(' b')>=0,
       'the two stamps tilt opposite ways');

    fetch('/result?r=' + encodeURIComponent(L.join(' | ')));
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
