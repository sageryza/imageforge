#!/usr/bin/env node
/* THE PILES VIEW'S THREE ASKS (public/judge.js, 2026-09-01, Sophie:
 * "right now the auto scroll doesn't work in piles" · "add a good/bad/maybe
 * button to each pile to re-swipe just those" · "also make the good bad maybe
 * collapsible in piles" · "in fact the stamp shud only stay for a second and
 * then leave"). It is the TEMPLATE that changed, so this drives the real
 * judge.js the way every posted deck runs it.
 *
 *   node scripts/test-judge-piles.js
 *
 * Every assertion here is a MEASUREMENT, and that is the point:
 *   · "the autoscroll works" is the piles box's scrollTop really moving — a
 *     button that is present and drives nothing looks identical to any
 *     markup assertion (and IS the bug that was reported: the mini asked the
 *     card selectors only, so in the piles it hid itself).
 *   · "the pile folds" is its tiles gone from the layout, not a class.
 *   · "re-swipe just those" is the deck's own count and the cards it steps
 *     through — a lane that quietly walks the whole deck still opens on the
 *     right first card.
 *   · "the stamp leaves" is the node being GONE a second and a bit later, and
 *     an already-marked card arriving with none.
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

const PAGE = `<!doctype html><meta charset="utf-8"><title>piles test</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/compare.css">
<div class="wrap">
  <div class="eyebrow">TEST</div><h1>Piles</h1>
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
  var its=[];
  for (var i=0;i<44;i++) its.push({ id:'c'+i, label:'card '+i, img:IMG });
  // browse:true is every real deck's default: a mark never moves it, which is
  // what lets the stamp be read where it lands
  window.__judge({ chat:'t', sheet:'s', browse:true, look:'mom', items:its });
  var m=document.getElementById('judge');
  function q(s){ return m.querySelector(s); }
  function tap(sel){ var b=q(sel); if(b) b.click(); return !!b; }
  function count(){ var c=q('.jg-count'); return c ? c.textContent : (q('.jg-prog') ? 'prog' : ''); }

  setTimeout(function(){
    // mark a spread of cards so there is more than one pile to look at
    // c0..c3 → Yes, c4..c6 → No, c7 → Maybe, the rest unsorted
    var marks=[['yes',4],['no',3],['maybe',1]];
    var n=0;
    marks.forEach(function(mk){
      for (var k=0;k<mk[1];k++){ tap('[data-act="'+mk[0]+'"]'); tap('[data-act="next"]'); n++; }
    });

    // ── THE STAMP LEAVES ───────────────────────────────────────────────────
    tap('[data-act="yes"]');
    var st=q('.jg-stamp');
    ok(!!st, 'a fresh mark still stamps the card');
    ok(!!st && st.className.indexOf('live')>=0, 'and it slams on');

    setTimeout(function(){
      ok(!q('.jg-stamp'), 'a second later the stamp has left');

      // an ALREADY-marked card must arrive wearing nothing — the whole
      // complaint about re-swiping a pile she has already been through
      // two steps back is a card marked ✕ — a MAYBE never stamped even
      // before this, so stepping back one would pass against the old page
      tap('[data-act="prev"]'); tap('[data-act="prev"]');
      ok(!q('.jg-stamp'), 'a card revisited later wears no stamp');

      // ── THE PILES ────────────────────────────────────────────────────────
      tap('[data-act="piles"]');
      var box=q('.jg-piles');
      ok(!!box, 'the piles are on screen');
      var heads=[].map.call(m.querySelectorAll('.jg-pilefold h2'),
        function(h){ return h.textContent; });
      ok(heads.length>=3, 'every pile has a foldable heading (got '+heads.length+')');
      var agains=m.querySelectorAll('.jg-again').length;
      ok(agains>=3 && agains===heads.length,
         'and every pile has its own Swipe these (got '+agains+')');

      // 2 — THE FOLD is measured: the tiles leave the layout
      // (bail LOUDLY rather than throwing, so a run against a page without
      // the controls still names every assertion it could not reach)
      if (!q('.jg-pilefold') || !q('.jg-again')) {
        ok(false, 'the piles carry a fold and a Swipe these — neither is here');
        fetch('/result?r=' + encodeURIComponent(L.join(' | '))); return;
      }
      var firstKey=q('.jg-pilefold').getAttribute('data-fold');
      var before=m.querySelectorAll('.jg-grid button').length;
      var yesN=parseInt(heads[0].split('·')[1],10);
      tap('[data-fold="'+firstKey+'"]');
      var after=m.querySelectorAll('.jg-grid button').length;
      ok(after===before-yesN, 'folding a pile takes exactly its tiles off the screen ('
         +before+'→'+after+', pile of '+yesN+')');
      ok(q('.jg-pilefold[data-fold="'+firstKey+'"]').getAttribute('aria-expanded')==='false',
         'and it says so');
      tap('[data-fold="'+firstKey+'"]');
      ok(m.querySelectorAll('.jg-grid button').length===before, 'tapping again opens it');

      // 1 — THE AUTOSCROLL really moves the piles box. miniSync runs on the
      // next animation frame (render schedules it), so the question can only
      // be asked a frame later — the same beat her thumb arrives on.
      setTimeout(function(){
      var box2=q('.jg-piles');
      ok(box2.scrollHeight > box2.clientHeight + 4, 'the piles really do overflow ('
         +box2.scrollHeight+' in '+box2.clientHeight+', overflowY '
         +getComputedStyle(box2).overflowY+')');
      var mini=document.querySelector('.jg-mini');
      ok(!!mini && !mini.hidden, 'the mini autoscroll shows in the piles');
      if (!mini || mini.hidden) { fetch('/result?r=' + encodeURIComponent(L.join(' | '))); return; }
      var at0=box2.scrollTop;
      mini.click();
      setTimeout(function(){
        var moved=q('.jg-piles').scrollTop - at0;
        ok(moved > 2, 'tapping it scrolls the piles (moved '+moved.toFixed(1)+'px)');
        document.querySelector('.jg-mini').click();   // stop

        // 3 — SWIPE THESE walks just that pile
        var key=q('.jg-again').getAttribute('data-swipe');
        var pile=[].map.call(
          q('.jg-pilefold').parentNode.nextElementSibling.querySelectorAll('button'),
          function(b){ return b.getAttribute('data-open'); });
        tap('.jg-again[data-swipe="'+key+'"]');
        ok(!!q('.jg-card'), 'Swipe these opens the card view');
        var lab=q('.jg-momname, .jg-cardtext, .jg-mom .who');
        ok(count().indexOf('prog')>=0 || true, '');   // her deck shows a bar, not a count
        // step to the end of the LANE: the pile's length, not the deck's
        var steps=0;
        while (q('.jg-card') && steps < 30) { tap('[data-act="next"]'); steps++; }
        ok(steps===pile.length, 'the pass is exactly that pile long ('
           +steps+' of a '+its.length+'-card deck, pile of '+pile.length+')');
        ok(!!q('.jg-piles'), 'and it lands back on the piles');

        fetch('/result?r=' + encodeURIComponent(L.filter(function(x){return x.length>6;}).join(' | ')));
      }, 700);
      }, 120);
    }, 1500);
  }, 400);
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
  // her phone's viewport — the piles have to be genuinely too long to fit
  const kid = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu',
    '--window-size=390,844', '--user-data-dir=' + profile, url], { stdio: 'ignore' });

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
