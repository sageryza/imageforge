#!/usr/bin/env node
/* Tests the shared cut picker (public/picker.js) the way a served Compare
 * page runs it — real compare.css/compare.js, the REAL injected pill, and a
 * stub server standing in for /api/chatfeed/verdict and /api/search/clip-span.
 *
 *   node scripts/test-cut-picker.js
 *
 * What it drives, because each of these went wrong on a hand-rolled page:
 *   1. tap first word + tap last word → a pick exists and paints
 *   2. the pick saves as ONE PER-PICK verdict field (never one big JSON that
 *      truncates at the route's 2000-char cap)
 *   3. tapping inside a pick removes it, undo puts it back
 *   4. ▲▼ reorder re-saves every pick's order
 *   5. ▶ polls /clip-span until ready and plays the EXACT span (padded)
 *   6. a tap on a transcript word pauses the running autoscroll (the pill
 *      contract, via compare.js — the bug every chat re-shipped)
 *   7. reloading state: picks saved earlier come back; seeds only fill a
 *      truly untouched sheet
 *
 * Headless Chromium directly (no playwright dep); skips with exit 0 if none
 * is found. Verdict comes back over HTTP (see test-compare-shell.js for why
 * --virtual-time-budget can't be used with the pill's rAF loop).
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

// ten words, one second apart — spans are easy to predict
const WORDS = JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ w: 'w' + i, t: i })));

const PAGE = `<!doctype html><meta charset="utf-8"><title>pending</title>
<link rel="stylesheet" href="/compare.css">
<div class="wrap">
  <div class="eyebrow">TEST</div><h1>Cut picker</h1>
  <div id="p1"></div>
  ${'<div class="card"><p>tall filler so the page can scroll</p></div>'.repeat(60)}
</div>
<script src="/compare.js"></script>
<script src="/picker.js"></script>
__PILL__
<script>
(function(){
  var L=[];
  function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  var posts=[], realFetch=window.fetch.bind(window);
  window.fetch=function(u,o){
    var s=String(u);
    if(o&&o.method==='POST') posts.push({u:s, b:JSON.parse(o.body)});
    if(s.indexOf('/api/search/clip-span')===0){
      var q=new URLSearchParams(s.split('?')[1]||'');
      window.__clipAsk={t0:Number(q.get('t0')), t1:Number(q.get('t1'))};
    }
    return realFetch(u,o);
  };
  var inst = window.__cutPicker({
    mount:'#p1', id:'s1', chat:'t', sheet:'sh',
    src:'vid123',                     // indexed-style id → send button shows
    words:${WORDS},
    seed:[{a:0,z:1}],
  });
  var W = function(i){ return document.querySelectorAll('#p1 w')[i]; };

  setTimeout(function(){
    // 7a. the untouched sheet was seeded with the suggested span
    ok(inst.picks.length===1 && inst.picks[0].a===0 && inst.picks[0].z===1,
       'a suggested span seeds an untouched sheet as a pick');

    // 8. the mount opts out of the Chats viewer's tap-toggles-scroll gesture
    //    (without data-nostop, tapping a word STARTED the autoscroll in the
    //    app's embedded viewer — Sophie hit it on the first demo)
    ok(document.getElementById('p1').hasAttribute('data-nostop'),
       'the picker region carries data-nostop by construction');

    // 9. tapping the same word twice deselects it — no one-word pick
    W(3).click(); W(3).click();
    ok(inst.picks.length===1 && inst.pend===null,
       'tapping the pending word again deselects it');

    // 1. tap first + last word → a pick
    W(4).click(); W(6).click();
    ok(inst.picks.length===2 && inst.picks[1].a===4 && inst.picks[1].z===6,
       'tap a first word then a last word makes a pick');
    ok(W(5).classList.contains('pick'), 'the picked words paint');

    // 6. a tap on a word pauses a running autoscroll. The picker region is
    //    data-nostop (so the embedded viewer's tap gesture can't START the
    //    scroll from it), which also means compare.js's pointerdown handler
    //    skips it — the picker's own click handler does the pausing.
    window.__scrollStart(1);
    var playing = !!document.querySelector('.vseg button.on');
    W(8).click();
    ok(playing && !document.querySelector('.vseg button.on'),
       'a tap on a transcript word pauses the autoscroll');
    W(8).click();                       // same word again — deselects the pend

    setTimeout(function(){
      // 2. saves are per-pick fields
      var saves = posts.filter(function(x){ return x.u.indexOf('/api/chatfeed/verdict')===0; });
      var perPick = saves.every(function(s){ return /^s1:p/.test(s.b.item); });
      var newPick = saves.filter(function(s){
        try { var v = JSON.parse(s.b.text); return v.a===4 && v.z===6; } catch(_){ return false; }
      });
      ok(saves.length>0 && perPick && newPick.length>0,
         'every pick saves as its own verdict field (s1:p…)');

      // 3. tap inside a pick removes it; undo restores
      var before = inst.picks.length;
      W(5).click();
      var removed = inst.picks.length===before-1;
      var barBtns = [].slice.call(document.querySelectorAll('#p1 .ckp-bar button'));
      var undo = barBtns.filter(function(b){ return !b.disabled && b.title.indexOf('put')===0; })[0];
      if (undo) undo.click();
      ok(removed && inst.picks.length===before,
         'tapping inside a pick removes it and undo puts it back');

      // 4. reorder re-saves order
      posts.length = 0;
      var down = [].slice.call(document.querySelectorAll('#p1 .ckp-pk button'))
        .filter(function(b){ return b.title.indexOf('later')>=0 && !b.disabled; })[0];
      if (down) down.click();
      setTimeout(function(){
        var orderSaves = posts.filter(function(x){ return x.u.indexOf('/api/chatfeed/verdict')===0; });
        ok(orderSaves.length>=2, 'a reorder re-saves every pick\\'s order');

        // 5. play polls /clip-span and plays the exact padded span
        var play = [].slice.call(document.querySelectorAll('#p1 .ckp-pk button'))
          .filter(function(b){ return b.title.indexOf('hear')>=0; })[0];
        if (play) play.click();
        setTimeout(function(){
          var a = document.querySelector('audio');
          ok(!!(a && a.src && a.src.indexOf('/fake-clip')>=0),
             'the play button fetched the span clip and loaded it');
          ok(window.__clipAsk && Math.abs(window.__clipAsk.t0-(4-0.25))<0.01
             && Math.abs(window.__clipAsk.t1-(7+0.35))<0.01,
             'the asked span is the pick, padded (t0='+ (window.__clipAsk&&window.__clipAsk.t0)
             +' t1='+(window.__clipAsk&&window.__clipAsk.t1)+')');

          // 10. the scissors splits a pick into two adjacent picks — so one
          //     part can get a different picture / speaker downstream
          var target = inst.picks.filter(function(p){ return p.z-p.a>=1; })[0];
          var before2 = inst.picks.length;
          var scis = [].slice.call(document.querySelectorAll('#p1 .ckp-pk button'))
            .filter(function(b){ return b.title.indexOf('split')>=0; })[0];
          if (scis) scis.click();
          var mid = target ? target.a+1 : 0;
          var az = target ? {a:target.a, z:target.z} : null;
          W(mid).click();
          var halves = inst.picks.filter(function(p){
            return az && ((p.a===az.a && p.z===mid-1) || (p.a===mid && p.z===az.z));
          });
          ok(az && inst.picks.length===before2+1 && halves.length===2,
             'the scissors splits a pick into two back-to-back picks');

          // 11. send to the Episode Editor — every pick, in her order
          posts.length = 0;
          var send = [].slice.call(document.querySelectorAll('#p1 .ckp-bar button'))
            .filter(function(b){ return b.title.indexOf('episode')>=0; })[0];
          if (send) send.click();
          setTimeout(function(){
            var sp = posts.filter(function(x){ return x.u.indexOf('/api/search/picks-to-editor')===0; })[0];
            var good = sp && sp.b.src==='vid123' && Array.isArray(sp.b.picks)
              && sp.b.picks.length===inst.picks.length
              && sp.b.picks.every(function(p,i){
                   return p.text && typeof p.timeSec==='number'
                     && p.timeSec===inst.picks[i].a;   // words are 1s apart at t=i
                 });
            ok(!!good, 'send posts every pick, in order, with text and anchor');
            fetch('/result?r=' + encodeURIComponent(L.join(' | ')));
          }, 300);
        }, 400);
      }, 900);
    }, 900);
  }, 500);
})();
</script>`;

const files = {
  '/compare.css': ['text/css', fs.readFileSync(path.join(PUB, 'compare.css'), 'utf8')],
  '/compare.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'compare.js'), 'utf8')],
  '/picker.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'picker.js'), 'utf8')],
  '/fake-clip.mp3': ['audio/mpeg', ''],
};
const pill = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');

let finish = null;
const server = http.createServer((req, res) => {
  const [route, qs] = req.url.split('?');
  const params = new URLSearchParams(qs || '');
  if (route === '/result') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
    return finish && finish(decodeURIComponent(params.get('r') || ''));
  }
  if (route === '/api/chatfeed/verdict') {
    // GET → empty sheet (so seeds apply); POST → accept
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(req.method === 'GET' ? '{"ok":true,"items":{},"texts":{}}' : '{"ok":true}');
  }
  if (route === '/api/search/picks-to-editor') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"ok":true,"id":"ep1","title":"pending","count":3}');
  }
  if (route === '/api/search/clip-span') {
    // record the asked span for the page to assert on, answer ready at once
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ready',
      url: '/fake-clip.mp3',
      _echo: { t0: Number(params.get('t0')), t1: Number(params.get('t1')) },
    }));
  }
  const hit = files[route];
  if (hit) { res.writeHead(200, { 'Content-Type': hit[0] }); return res.end(hit[1]); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(PAGE.replace('__PILL__', pill));
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cut-picker-'));
  const kid = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required',
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
