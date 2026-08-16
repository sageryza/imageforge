#!/usr/bin/env node
/* Tests the two things Sophie asked the Horns page for (Aug 2026):
 *
 *   node scripts/test-horns-page.js
 *
 *   1. IT KEEPS HER PLACE. Position AND the open/closed state of the folds
 *      are saved, and both come back on a FRESH document — the page RELOADS
 *      itself rather than the test calling restore() by hand, which would
 *      pass while the real return trip was broken. (Reload rather than a
 *      second browser: headless Chromium flushes localStorage to disk
 *      lazily, so relaunching lost the entry and read as a page bug.)
 *   2. THE JUMP ARROWS go all the way up and all the way down, sit clear of
 *      BOTH reserved corners (the injected pill's top-right, and the note
 *      "+" pinned in every item's bottom-right), and — being <button>, which
 *      is on the pill's shared skip list — never START the autoscroll.
 *
 * Runs the REAL generated page against the REAL pill, the way it is served.
 * Skips with exit 0 if the page hasn't been generated or no Chromium is found.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const PUB = path.join(__dirname, '..', 'public');
const D = process.env.HORNS_DIR || '/tmp/claude-0/-home-user/9a67f47a-9ba4-5529-a3f9-de888e6c3a69/scratchpad/horns';
const pagePath = path.join(D, 'page.html');
if (!fs.existsSync(pagePath)) {
  console.log('no generated page — run tools/horns/page.js first; skipping'); process.exit(0);
}
const CANDIDATES = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium/chrome',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean);
const chrome = CANDIDATES.find(p => { try { fs.accessSync(p); return true } catch (_) { return false } })
  || (() => {
    try {
      const hit = fs.readdirSync('/opt/pw-browsers').find(d => d.startsWith('chromium'));
      const p = hit && path.join('/opt/pw-browsers', hit, 'chrome-linux', 'chrome');
      if (p && fs.existsSync(p)) return p;
      const q = hit && path.join('/opt/pw-browsers', hit);
      return q && fs.existsSync(q) && fs.statSync(q).isFile() ? q : null;
    } catch (_) { return null }
  })();
if (!chrome) { console.log('no Chromium found — skipping (set CHROME_PATH to run)'); process.exit(0); }

const Y = 4200;   // somewhere well down the page

const HARNESS = `<script>
(function(){
  var L=[], phase = location.hash.indexOf('2') > -1 ? 2 : 1;
  function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  function send(){ fetch('/result?r='+encodeURIComponent(L.join(' | '))); }

  if (phase === 1) {
    var folds = document.querySelectorAll('details.passage');
    ok(folds.length >= 4, 'the long sections are folds (' + folds.length + ')');
    folds[1].open = true;                        // she opens one…
    window.scrollTo(0, ${Y});                    // …and reads on
    window.dispatchEvent(new Event('scroll'));
    setTimeout(function(){
      var raw = localStorage.getItem('horns-place:' + location.pathname);
      var st = raw && JSON.parse(raw);
      ok(!!st && Math.abs(st.y - ${Y}) < 4, 'the position is saved');
      ok(!!st && st.open && st.open[1] === 1, 'the open fold is saved with it');
      send();
      setTimeout(function(){ location.hash = '2'; location.reload() }, 150);
    }, 400);
    return;
  }

  // phase 2 — a FRESH load, restore() has already run
  setTimeout(function(){
    ok(Math.abs(window.scrollY - ${Y}) < 4, 'a fresh load comes back to her place (y=' + Math.round(window.scrollY) + ')');
    ok(document.querySelectorAll('details.passage')[1].open, 'the fold she left open is open again');

    var nav = document.querySelector('.jump');
    var up = document.getElementById('jtop'), down = document.getElementById('jbot');
    var nb = nav.getBoundingClientRect();
    ok(getComputedStyle(nav).position === 'fixed', 'the arrows float');
    // the pill owns x>=326 at the TOP; the note "+" owns every item's
    // bottom-RIGHT. Bottom-left is the only free corner.
    ok(nb.right < 300, 'they are clear of the pill corner (right edge ' + Math.round(nb.right) + ')');
    ok(nb.bottom > window.innerHeight - 90, 'they sit at the bottom');
    var ub = up.getBoundingClientRect();
    ok(Math.abs(ub.width - ub.height) < 1 && getComputedStyle(up).borderRadius.indexOf('50%') > -1,
       'they are circular icon buttons');
    ok(!!up.querySelector('svg path') && !!down.querySelector('svg path'), 'they carry inline Lucide chevrons');

    // a tap must never START the autoscroll (button is on the shared skip list)
    window.__scrollStop && window.__scrollStop();
    down.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}));
    down.click();
    ok(!document.querySelector('.vseg button.on'), 'a tap on an arrow never starts the autoscroll');
    ok(window.scrollY > document.documentElement.scrollHeight - window.innerHeight - 4,
       'the down arrow goes all the way to the bottom');

    // and it stops a RUNNING one rather than hurling the page while it moves
    window.__scrollStart && window.__scrollStart(1);
    up.click();
    ok(!document.querySelector('.vseg button.on'), 'a tap on an arrow stops a running autoscroll');
    ok(window.scrollY === 0, 'the up arrow goes all the way to the top');

    setTimeout(function(){
      var st = JSON.parse(localStorage.getItem('horns-place:' + location.pathname) || '{}');
      ok(st.y === 0, 'jumping saves the new place too');
      send();
    }, 350);
  }, 700);
})();
</script>`;

const files = {
  '/compare.css': ['text/css', fs.readFileSync(path.join(PUB, 'compare.css'), 'utf8')],
  '/compare.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'compare.js'), 'utf8')],
};
const pill = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const page = fs.readFileSync(pagePath, 'utf8') + pill + HARNESS;

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
  res.end(page);
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'horns-page-'));
  const all = [];
  const kid = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu',
    '--window-size=390,844', '--user-data-dir=' + profile, url + '#1'], { stdio: 'ignore' });

  const done = (err) => {
    try { kid.kill('SIGKILL') } catch (_) {}
    server.close();
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch (_) {}
    if (err) { console.error(err); process.exit(1) }
    all.forEach(l => console.log(l));
    if (!all.length) { console.error('no verdict — the page script never ran'); process.exit(1) }
    if (all.some(l => l.startsWith('FAIL'))) process.exit(1);
    console.log(`all ${all.length} checks passed`);
    process.exit(0);
  };

  const timer = setTimeout(() => done('timed out waiting for the page'), 60000);
  let phase = 1;
  finish = (v) => {
    all.push(...v.split(' | ').filter(Boolean));
    if (phase === 1) { phase = 2; return; }   // the page reloads itself
    clearTimeout(timer); done();
  };
});
