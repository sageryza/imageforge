#!/usr/bin/env node
/* Tests the Compare page shell (public/compare.js) against the REAL injected
 * pill (public/pill-inject.html), the way a served Compare page actually runs.
 *
 *   node scripts/test-compare-shell.js
 *
 * Checks the three things hand-rolled Compare pages have each got wrong:
 *   1. a tap on ordinary content pauses the autoscroll
 *   2. a tap on the PILL is exempt — its own play button still works (an
 *      unconditional stop repaints the glyphs mid-press and eats the click)
 *   3. opening an image stops the scroll, locks the page, and closing restores
 *      the exact scroll position
 * plus the note box, the film row, and the "?" that holds anything a page
 * would otherwise print as instructions down its top.
 *
 * Uses headless Chromium directly (no playwright dependency): it serves the
 * page, runs an in-page script that drives the taps, and the page POSTs its
 * verdict back to the test server. Skips with exit 0 if no Chromium is found.
 *
 * The verdict comes back over HTTP rather than via --dump-dom on purpose:
 * --virtual-time-budget HANGS on this page, because the pill's autoscroll is a
 * requestAnimationFrame loop and virtual time fast-forwards it forever.
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

const PAGE = `<!doctype html><meta charset="utf-8"><title>pending</title>
<link rel="stylesheet" href="/compare.css">
<div class="wrap">
  <div class="eyebrow">TEST</div><h1>Compare shell</h1>
  <div class="card" data-item="thing-1"><button id="vote">vote</button></div>
  ${'<div class="card"><p>tall filler so the page can scroll</p></div>'.repeat(60)}
  <div class="imgrow">
    <img id="pic" alt="a" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23c99'/%3E%3C/svg%3E">
  </div>
  <div id="film"></div>
  ${'<div class="card"><p>more filler</p></div>'.repeat(60)}
</div>
<script src="/compare.js"></script>
__PILL__
<script>
(function(){
  var L=[];
  function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  // spy on the verdict POSTs the note box makes
  var posts=[], realFetch=window.fetch.bind(window);
  window.fetch=function(u,o){ if(o&&o.method==='POST') posts.push({u:String(u),b:o.body}); return realFetch(u,o); };
  window.__compareNotes({chat:'t',sheet:'s'});
  setTimeout(function(){
    // 1. content tap pauses an already-running autoscroll
    window.__scrollStart(1);
    var playingAfterStart = !!document.querySelector('.vseg button.on');
    document.getElementById('vote').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    ok(playingAfterStart && !document.querySelector('.vseg button.on'), 'a tap on a button pauses the autoscroll');

    // 2. the pill is exempt — its play button still starts the scroll
    var mid=document.getElementById('vmid');
    mid.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    mid.click();
    ok(!!document.querySelector('.vseg button.on'), "the pill's own play button still works");
    window.__scrollStop();

    // 3. image lightbox: stops scroll, locks the page, restores position
    window.scrollTo(0, 900);
    var y0 = window.scrollY;
    window.__scrollStart(1);
    document.getElementById('pic').click();
    var lb = document.querySelector('.cmp-lb');
    var openOk = lb && !lb.hasAttribute('hidden')
      && document.body.style.overflow === 'hidden'
      && !document.querySelector('.vseg button.on');
    ok(openOk, 'opening an image stops the scroll and locks the page');
    window.scrollBy(0, 400);              // something moves the page underneath
    lb.click();                            // close
    ok(Math.abs(window.scrollY - y0) < 2 && document.body.style.overflow === '',
       'closing restores the exact scroll position');

    // 4. notes — Sophie's standing rule: every reviewable item takes one
    var host = document.querySelector('[data-item="thing-1"]');
    var note = host && host.querySelector('.cmp-note');
    var opener = note && note.querySelector('.cmp-note-open');
    var box = note && note.querySelector('.cmp-note-box');
    ok(!!(note && opener && box), 'every [data-item] gets a note box');
    // the affordance is a small + pinned in the item's corner and costs the
    // page no height (Sophie, Aug 2026) — the opener stays visible when open
    var ob = opener && opener.getBoundingClientRect();
    var hb = host && host.getBoundingClientRect();
    ok(!!ob && ob.width <= 26 && ob.height <= 26 &&
       getComputedStyle(opener).position === 'absolute',
       'the note affordance is a small + in the corner');
    // BOTTOM-right, not top (Sophie, Aug 2026: "put the plus for a note at
    // the bottom not the top")
    ok(!!ob && ob.bottom > hb.bottom - 26 && ob.right > hb.right - 26,
       'the + is in the BOTTOM-right corner');
    ok(note && note.getBoundingClientRect().height < 1, 'a collapsed note costs no height');
    if (opener) opener.click();
    ok(note && note.classList.contains('open') && !opener.hidden, 'tapping the + opens the box');
    if (box) {
      box.value = 'this one drifts';
      box.dispatchEvent(new Event('blur'));           // blur flushes immediately
    }
    // a written note SHOWS as her words, folded out of the textarea (Sophie,
    // Aug 2026: "if I left a note, make it show"), as a tagged message in the
    // thread — never as raw text she would have to edit around
    var shown = note && note.querySelector('.cmp-note-text');
    var msg = shown && shown.querySelector('.cmp-msg.me .cmp-msg-t');
    ok(!!msg && note.classList.contains('has') && !note.classList.contains('open') &&
       msg.textContent === 'this one drifts' &&
       getComputedStyle(box).display === 'none',
       'a written note shows as her words, not as an open textarea');
    setTimeout(function () {
      var p = posts.filter(function (x) { return x.u.indexOf('/api/chatfeed/verdict') === 0; }).pop();
      var body = p ? JSON.parse(p.b) : null;
      // saved as a tagged message, so hers and the chat's never merge into
      // one paragraph she has to type inside of
      ok(!!body && body.text === '— me: this one drifts' && body.item === 'thing-1' && body.ok === undefined,
         'a note saves to the verdict doc as text, leaving the vote alone');

      // 5. the FILM ROW — a line of text with a play button, never a <video>
      // parked in the page (Sophie, Aug 2026). Same overlay contract as an
      // image, plus the video must be torn down so it can't play on behind.
      window.__filmRow({ url: '/nope.mp4', label: 'the cut', meta: '4:56', mount: '#film' });
      var row = document.querySelector('#film .cmp-film');
      ok(!!row && row.tagName === 'BUTTON' && !document.querySelector('.wrap video'),
         'the film row is a play button, not an embedded video');
      window.scrollTo(0, 700);
      var fy = window.scrollY;
      window.__scrollStart(1);
      row.click();
      var v = document.querySelector('.cmp-vlb video');
      ok(!!v && !document.querySelector('.cmp-vlb').hasAttribute('hidden')
         && document.body.style.overflow === 'hidden'
         && !document.querySelector('.vseg button.on'),
         'the film opens over the page, scroll stopped and locked');
      window.scrollBy(0, 300);
      document.querySelector('.cmp-vlb').click();      // backdrop closes it
      ok(Math.abs(window.scrollY - fy) < 2 && document.body.style.overflow === ''
         && !v.getAttribute('src'),
         'closing restores the position and tears the video down');

      // 6. THE "?" — the one place instructions may live (Sophie, Aug 2026:
      // "they can put it behind a ? so I can tap it if I don't know what's
      // going on"). It rides on the title, clear of the pill's corner, and
      // the card FLOATS so opening it can't push the page down under her.
      var yBefore = document.body.scrollHeight;
      window.__compareHelp({ html: '<b>What this is.</b> One line.' });
      var q = document.querySelector('.cmp-help');
      var qb = q && q.getBoundingClientRect();
      ok(!!q && q.parentNode === document.querySelector('h1') && qb.right < 324,
         'the "?" rides on the title, clear of the pill corner');
      var card = document.querySelector('.cmp-helpcard');
      ok(!!card && card.hidden, 'the card starts closed — nothing to read until she asks');
      q.click();
      ok(card && !card.hidden && getComputedStyle(card).position === 'fixed'
         && document.body.scrollHeight === yBefore,
         'tapping it floats the card without moving the page');
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      ok(card && card.hidden, 'a tap anywhere puts it away');
      window.__compareHelp({ html: 'again' });
      ok(document.querySelectorAll('.cmp-help').length === 1
         && document.querySelectorAll('.cmp-helpcard').length === 1,
         'calling it twice replaces, never stacks');

      fetch('/result?r=' + encodeURIComponent(L.join(' | ')));
    }, 120);
  }, 400);
})();
</script>`;

const files = {
  '/compare.css': ['text/css', fs.readFileSync(path.join(PUB, 'compare.css'), 'utf8')],
  '/compare.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'compare.js'), 'utf8')],
};
const pill = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');

let finish = null;
const server = http.createServer((req, res) => {
  const [route, qs] = req.url.split('?');
  if (route === '/result') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
    return finish && finish(decodeURIComponent(new URLSearchParams(qs).get('r') || ''));
  }
  const hit = files[route];
  if (hit) { res.writeHead(200, { 'Content-Type': hit[0] }); return res.end(hit[1]); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(PAGE.replace('__PILL__', pill));
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cmp-shell-'));
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
