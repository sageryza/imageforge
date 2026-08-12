#!/usr/bin/env node
/* Tests the CHAPTERS page (public/chapters.js) — the catalog of a long chat —
 * the way a served page actually runs (real pill injected).
 *
 *   node scripts/test-chapters.js
 *
 * Checks the contract, both of Sophie's axes:
 *   1. every chapter is a row; opening one shows its body
 *   2. opening another COLLAPSES the first ("when I open one, the rest of
 *      them collapse") and tapping the open one closes it
 *   3. the horizontal axis: 1 gist → 2 deeper → 3 raw, and each level shows
 *      what it promises (level 3 = the real messages, both sides)
 *   4. a message reaches the page VERBATIM — a chapter's raw text is the
 *      transcript slice, never a summary of it
 *   5. an attachment path renders as a chip carrying the real filename
 *   6. every chapter carries a note box (the standing rule)
 *   7. the list is [data-nostop] — taps pause a running autoscroll, never
 *      start one (the embedded-iframe contract)
 *
 * Same harness as test-judge.js: headless Chromium, tiny server, the page
 * reports its verdict over HTTP. Skips with exit 0 if no Chromium.
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

const PAGE = `<!doctype html><meta charset="utf-8"><title>chapters test</title>
<link rel="stylesheet" href="/compare.css">
<div class="wrap">
  <div class="eyebrow">TEST</div><h1>Chapters</h1>
  <div id="chapters"></div>
</div>
<script src="/compare.js"></script>
<script src="/chapters.js"></script>
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
  var VERBATIM = "it's the genes — <not> a spectrum";
  window.__chapters({ chat:'t', sheet:'chapters', chapters:[
    { id:'a', title:'The research', when:'Jul 28',
      l1:'the gist of it', l2:['a **decided** thing','a shipped thing'],
      msgs:[ { who:'sophie', at:'2026-07-28T18:25:00Z', text:VERBATIM },
             { who:'claude', at:'2026-07-28T18:26:00Z', text:'the reply' } ] },
    { id:'b', title:'The astrology one', when:'Jul 28',
      l1:'second gist', l2:['another line'],
      msgs:[ { who:'sophie', at:'2026-07-28T21:12:00Z',
               text:'here it is @"/root/.claude/uploads/sid/abc123def-IMG_8170.png" have a look' } ] },
  ]});
  setTimeout(function(){
    var m=document.getElementById('chapters');
    var rows=m.querySelectorAll('.cx-ch');
    function body(i){ return rows[i].querySelector('.cx-body'); }
    function lvl(i,n){ var b=body(i).querySelector('.cx-lv button[data-lv="'+n+'"]'); b.click(); }

    // 1 — rows, and the vertical axis
    ok(rows.length===2 && body(0).hidden && body(1).hidden, 'every chapter is a row, all closed to start');
    ok(m.hasAttribute('data-nostop'), 'the list is data-nostop (taps never START the scroll)');

    rows[0].querySelector('.cx-head').click();
    ok(!body(0).hidden && rows[0].classList.contains('on'), 'tapping a chapter opens it');

    // 2 — one at a time
    rows[1].querySelector('.cx-head').click();
    ok(body(0).hidden && !body(1).hidden, 'opening another collapses the first');
    rows[1].querySelector('.cx-head').click();
    ok(body(1).hidden, 'tapping the open one closes it');

    // 3 — the horizontal axis
    rows[0].querySelector('.cx-head').click();
    var b0=body(0);
    ok(!!b0.querySelector('.cx-l1') && !b0.querySelector('.cx-l2') && !b0.querySelector('.cx-raw'),
       'level 1 is the gist alone');
    ok(b0.querySelector('.cx-lv button[data-lv="1"]').classList.contains('on'),
       'a chapter opens at level 1');
    lvl(0,2); b0=body(0);
    var lis=b0.querySelectorAll('.cx-l2 li');
    ok(!!b0.querySelector('.cx-l1') && lis.length===2 && !!lis[0].querySelector('b'),
       'level 2 keeps the gist and adds the detail lines');
    lvl(0,3); b0=body(0);
    var msgs=b0.querySelectorAll('.cx-msg');
    ok(msgs.length===2 && msgs[0].classList.contains('me') && msgs[1].classList.contains('them'),
       'level 3 is the real messages, both sides');
    ok(b0.querySelector('.cx-count').textContent.indexOf('2 messages')===0, 'level 3 counts them');

    // 4 — verbatim, and safely (a < in her words is text, never markup)
    ok(msgs[0].querySelector('.cx-text').textContent===VERBATIM,
       'a message reaches the page verbatim, escaped not interpreted');

    // 5 — an attachment renders as a chip carrying the real filename
    rows[1].querySelector('.cx-head').click(); lvl(1,3);
    var att=body(1).querySelector('.cx-att');
    var txt=body(1).querySelector('.cx-text').textContent;
    ok(att && att.textContent==='IMG_8170.png', 'an attachment path renders as a named chip');
    ok(txt.indexOf('here it is')===0 && txt.indexOf('have a look')>0 && txt.indexOf('/root/')<0,
       'the words around the attachment are untouched');

    // 6 — the standing rule
    ok(!!m.querySelector('.cmp-note-box') || !!m.querySelector('[data-item] .cmp-note'),
       'every chapter carries a note affordance');

    fetch('/result?r=' + encodeURIComponent(L.join(' | ')));
  }, 500);
})();
</script>`;

const files = {
  '/compare.css': ['text/css', fs.readFileSync(path.join(PUB, 'compare.css'), 'utf8')],
  '/compare.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'compare.js'), 'utf8')],
  '/chapters.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'chapters.js'), 'utf8')],
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'chapters-'));
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
