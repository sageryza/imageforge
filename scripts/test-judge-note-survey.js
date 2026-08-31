#!/usr/bin/env node
/* THE NOTE SURVEY IN THE PILES VIEW (2026-08-31, Sophie: "add note survey to
 * piles").
 *
 *   node scripts/test-judge-note-survey.js
 *
 * Every note she left on a deck, read back in one place, leading the piles.
 * It cuts ACROSS them — a note is a note whether the card ended in Yes or sits
 * unmarked — so it is its own section rather than a mark on a tile.
 *
 * Every assertion here is a MEASUREMENT of the real page, because each thing
 * that can go wrong renders as a page that looks fine: a survey below the
 * piles is still "present", a folded thread and an unfolded one carry the same
 * markup, and a caret nested inside the row's own button would open the card
 * instead of unfolding — all invisible to a source assertion.
 *
 * Checks:
 *   1. the survey LEADS the piles, and says how many notes there are
 *   2. her words really render, through compare.js's own thread renderer
 *   3. an unmarked card's note is in it (the survey cuts across the piles)
 *   4. a field that parses to no message makes NO row (a name with no words
 *      under it is worse than no row)
 *   5. a thread of several folds to the newest behind "N earlier"…
 *   6. …and the caret unfolds it WITHOUT opening the card (the nested-button
 *      rule — the row's name is a sibling of the caret, never its parent)
 *   7. the name and the picture each open that card
 *   8. a deck she has written nothing on shows no survey at all
 *   9. and on one of HER decks (look:'mom') it is there too, in her cream —
 *      the rows carry a second palette and only a measurement can see it
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

const ITEMS = [
  { id: 'a', label: 'the coat' },
  { id: 'b', label: 'the hallway' },
  { id: 'c', label: 'the dog' },
  { id: 'd', label: 'the window' },
  { id: 'e', label: 'the last one' },
];

// a: one message of hers · c: a back-and-forth · d: a field that parses to
// nothing · e: a note on a card she never marked
const TEXTS = {
  a: 'the coat is the wrong green',
  c: '— me: too dark\n— Claude: lightened it\n— me: better, keep this one',
  d: '— me:',
  e: 'come back to this',
};
const MARKS = { a: true, c: false };

function page(pass) {
  return `<!doctype html><meta charset="utf-8"><title>note survey ${pass}</title>
<link rel="stylesheet" href="/compare.css">
<div class="wrap"><h1>Survey</h1><div id="judge"></div></div>
<script src="/compare.js"></script>
<script src="/judge.js"></script>
<script>
window.addEventListener('error', function(e){
  fetch('/result?r=' + encodeURIComponent('FAIL: page error — ' + e.message));
});
// the assertions run inside promise callbacks, where a throw is an unhandled
// REJECTION and never reaches onerror — without this a page missing the survey
// altogether times out instead of reporting what is missing
window.addEventListener('unhandledrejection', function(e){
  fetch('/result?r=' + encodeURIComponent('FAIL: ' + ((e.reason && e.reason.message) || e.reason)));
});
(function(){
  var L=[];
  function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  var IMG="${IMG}";
  var PASS=${pass};
  var cfg = { chat:'t', sheet:'s'+(PASS===3?1:PASS), browse:true,
    items: ${JSON.stringify(ITEMS)}.map(function(x){ x.img=IMG; return x; }) };
  if (PASS === 3) cfg.look = 'mom';   // her Decision Deck chrome
  window.__judge(cfg);
  var m=document.getElementById('judge');
  function q(s){ return m.querySelector(s); }
  function all(s){ return [].slice.call(m.querySelectorAll(s)); }
  function shown(el){ return !!el && getComputedStyle(el).display !== 'none'; }
  function tap(sel){ var b=q(sel); if(b) b.click(); return !!b; }
  function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function done(){ L.push('DONE'); return fetch('/result?r=' + encodeURIComponent(L.join(' | '))); }

  // 900ms lets the resume fetch land and paint before anything is asserted
  wait(900).then(function(){
    tap('[data-act="piles"]');
    return wait(60);
  }).then(function(){
    var heads = all('.jg-piles h2').map(function(h){ return h.textContent; });

    if (PASS === 3) {
      // 9. her own deck: the same survey, wearing her cream
      var rows3 = all('.jg-notes .jg-nrow');
      ok(rows3.length === 3, 'her own deck surveys her notes too (got ' + rows3.length + ')');
      ok(heads[0] === 'Notes · 3', 'and it leads her piles (got "' + heads[0] + '")');
      ok(!!q('.jg.mom'), 'this really is her look');
      // the row's rule is hers, not the house line — measured, because a
      // class name says nothing about what renders
      var bord = rows3[1] && getComputedStyle(rows3[1]).borderTopColor;
      ok(bord === 'rgb(231, 222, 207)', 'the rows are ruled in her cream (got ' + bord + ')');
      return done();
    }

    if (PASS === 2) {
      // 8. nothing written → the view she has always had
      ok(!q('.jg-notes'), 'a deck with no notes shows no survey');
      ok(heads.every(function(h){ return h.indexOf('Notes') !== 0; }),
         'and no Notes heading');
      ok(heads.length > 0, 'the piles themselves are still there');
      return fetch('/result?r=' + encodeURIComponent(L.join(' | ')))
        .then(function(){ location.href = '/?pass=3'; });
    }

    // Every lookup below is guarded: on a page with no survey at all each
    // check has to REPORT what is missing, not throw on the first null and
    // leave the rest of the deck untested.
    var rows = all('.jg-notes .jg-nrow');
    function nameOf(r){ var n = r && r.querySelector('.jg-nname'); return n ? n.textContent : ''; }
    var names = rows.map(nameOf);
    function rowFor(n){ return rows[names.indexOf(n)] || null; }

    // 1. it leads the piles, and says how many
    ok(heads[0] === 'Notes · 3', 'the survey leads the piles and counts them (got "' + heads[0] + '")');
    ok(rows.length === 3, 'one row per note (got ' + rows.length + ')');
    var box = q('.jg-notes');
    ok(!!box && heads.length > 1
       && box.getBoundingClientRect().top < all('.jg-piles h2')[1].getBoundingClientRect().top,
       'and it really renders above the first pile');

    // 2. her words, through compare.js's renderer
    var r0 = rows[0] || null;
    ok(nameOf(r0) === 'the coat', 'the row is named by the card');
    var t0 = r0 && r0.querySelector('.cmp-note-text');
    ok(shown(t0) && /the coat is the wrong green/.test(t0.textContent),
       'her words render in the row');
    ok(!!(r0 && r0.querySelector('.cmp-msg.me')), 'painted by the shared thread renderer');

    // 3/4. it cuts across the piles, and an empty field makes no row
    ok(names.indexOf('the last one') >= 0, 'an unmarked card with a note is in the survey');
    ok(rows.length > 0 && names.indexOf('the window') === -1,
       'a field that parses to nothing makes no row');

    // 5. a thread of several folds to the newest
    var rc = rowFor('the dog');
    var msgs = rc ? [].slice.call(rc.querySelectorAll('.cmp-msg')) : [];
    ok(msgs.length === 3, 'the whole thread is in the row (got ' + msgs.length + ')');
    ok(msgs.filter(shown).length === 1, 'folded: only the newest message shows');
    var caret = rc && rc.querySelector('.cmp-note-more');
    ok(shown(caret) && caret.textContent === '2 earlier',
       'and a caret says how many are behind it (got "' + (caret && caret.textContent) + '")');

    // 6. the caret unfolds and does NOT open the card
    if (caret) caret.click();
    return wait(40).then(function(){
      ok(rc && [].slice.call(rc.querySelectorAll('.cmp-msg')).filter(shown).length === 3,
         'tapping the caret opens the rest of the thread');
      ok(!!q('.jg-piles'), 'and it never leaves the piles view');

      // 7. the name opens that card
      if (rc) rc.querySelector('.jg-nname').click();
      return wait(60);
    }).then(function(){
      var c = q('.jg-count');
      ok(!q('.jg-piles') && c && c.textContent === '3 of 5',
         'the row name opens that card (got "' + (c && c.textContent) + '")');
      tap('[data-act="piles"]');
      return wait(60);
    }).then(function(){
      var pics = all('.jg-notes .jg-nthumb');
      ok(pics.length === 3, 'each row carries its picture');
      if (pics[0]) pics[0].click();
      return wait(60);
    }).then(function(){
      var c = q('.jg-count');
      ok(!q('.jg-piles') && c && c.textContent === '1 of 5',
         'the picture opens that card too (got "' + (c && c.textContent) + '")');
      return fetch('/result?r=' + encodeURIComponent(L.join(' | ')))
        .then(function(){ location.href = '/?pass=2'; });
    });
  });
})();
</script>`;
}

const files = {
  '/compare.css': ['text/css', fs.readFileSync(path.join(PUB, 'compare.css'), 'utf8')],
  '/compare.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'compare.js'), 'utf8')],
  '/judge.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'judge.js'), 'utf8')],
};

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
  const pass = parseInt(q.get('pass') || '1', 10);
  if (route === '/api/chatfeed/verdict') {
    if (req.method === 'POST') {
      req.on('data', () => {});
      return req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
    }
    // no-store: the two passes ask the SAME url, and a cached copy of pass 1's
    // doc would show pass 2 notes that are not in it (measured — it did)
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    // pass 2 is the same deck with nothing written on it
    var texts = q.get('sheet') === 's1' ? TEXTS : {};
    return res.end(JSON.stringify({ ok: true, items: MARKS, texts: texts, at: '' }));
  }
  if (route === '/api/gallery/assets') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"assets":[]}');
  }
  const hit = files[route];
  if (hit) { res.writeHead(200, { 'Content-Type': hit[0] }); return res.end(hit[1]); }
  if (route === '/favicon.ico') { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page(pass));
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jnote-'));
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
