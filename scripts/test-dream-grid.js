#!/usr/bin/env node
/* THE INSTAGRAM GRID MOCKUP'S TILES PLAY (Aug 2026, Sophie: "what if the
 * instagram play buttons actually worked and opened lightbox").
 *
 *   node scripts/test-dream-grid.js
 *
 * Drives the REAL page that scripts/dream-commercials/grid.js posts, with the
 * REAL compare.js and the REAL injected pill, in headless Chromium. Skips with
 * exit 0 if no Chromium.
 *
 * What it pins:
 *   1. every shot commercial's tile is a button carrying its own film url
 *   2. tapping one opens the VIDEO lightbox on that exact url
 *   3. the overlay contract holds — the page is locked while it is open and
 *      the scroll position comes back on close
 *   4. Somnivex has no film, so its tile opens the IMAGE lightbox instead —
 *      no tile on the grid is a dead control
 *   5. an empty "next" slot opens nothing and is not a button
 *   6. a tile tap can never START the autoscroll (a tile is a <button>, which
 *      is in the pill's own shared skip list — asserted against the real pill,
 *      not against a copy of the list)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const grid = require('./dream-commercials/grid.js');

const PUB = path.join(__dirname, '..', 'public');
const chrome = [process.env.CHROME_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome'].filter(Boolean)
  .find((p) => { try { fs.accessSync(p); return true; } catch (_) { return false; } })
  || (() => {
    try {
      const dir = '/opt/pw-browsers';
      const hit = fs.readdirSync(dir).find((d) => d.startsWith('chromium-'));
      const p = hit && path.join(dir, hit, 'chrome-linux', 'chrome');
      return p && fs.existsSync(p) ? p : null;
    } catch (_) { return null; }
  })();
if (!chrome) { console.log('no Chromium found — skipping (set CHROME_PATH to run)'); process.exit(0); }

// a 1x1 gif stands in for every cover: the geometry under test is the grid's,
// not the picture's, and this keeps the test off the network entirely
const PIX = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const FILMS = grid.TILES.filter((t) => t.film).map((t) => t.film);

const page = grid.build()
  .replace(/https:\/\/storage\.googleapis\.com\/[^"']*?\.webp/g, '/pix.gif')
  + fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8')
  + `<script>
(function () {
  var L = [], FILMS = ${JSON.stringify(FILMS)}, sent = false;
  function say(c, m){ L.push((c?'PASS: ':'FAIL: ')+m); }
  function report(){ if (sent) return; sent = true;
    fetch('/result?r=' + encodeURIComponent(L.join(' | ')), {}); }
  // A BROKEN CHAIN MUST STILL REPORT. Every step here reaches into the
  // overlay the step before was supposed to open, so unwiring the handler
  // makes the chain THROW and the run dies as a timeout — which says nothing
  // about which contract broke. This deadline turns that into the failing
  // assertions the run had already collected.
  setTimeout(function(){ say(false, 'the chain stopped early — see the last PASS above'); report(); }, 4000);
  function q(s){ return document.querySelector(s); }
  function tiles(){ return [].slice.call(document.querySelectorAll('.gtile')); }
  window.addEventListener('error', function(e){ say(false, 'page error — ' + e.message); });
  setTimeout(function () {
    var all = tiles();
    var films = all.filter(function(t){ return t.getAttribute('data-film'); });
    say(all.length === 9, 'nine slots on the grid — got ' + all.length);
    say(films.length === FILMS.length, FILMS.length + ' tiles carry a film — got ' + films.length);
    say(films.every(function(t){ return t.tagName === 'BUTTON'; }), 'each of them is a real button');
    say(FILMS.every(function(u){ return films.some(function(t){ return t.getAttribute('data-film') === u; }); }),
      'and each names its own film, not a shared one');

    // 6 — the pill's OWN skip list must already exempt a tile
    say(typeof window.__pillInteractive === 'function'
      && window.__pillInteractive(films[0]), 'the real pill treats a tile as interactive — a tap cannot start the scroll');

    // 2 + 3 — tap the first tile
    document.body.style.height = '3000px';       // something to scroll
    window.scrollTo(0, 400);
    var before = window.scrollY;
    films[0].click();
    setTimeout(function () {
      var vlb = q('.cmp-vlb'), v = vlb && vlb.querySelector('video');
      say(vlb && !vlb.hasAttribute('hidden'), 'tapping a tile opens the video lightbox');
      say(v && v.getAttribute('src') === films[0].getAttribute('data-film'),
        'on that tile\\'s own film');
      say(document.body.style.overflow === 'hidden', 'the page behind it is locked');
      say(!q('.cmp-lb') || q('.cmp-lb').hasAttribute('hidden'), 'and the IMAGE lightbox stayed shut');
      vlb.click();                                // the backdrop closes it
      setTimeout(function () {
        say(vlb.hasAttribute('hidden'), 'the backdrop closes it');
        say(document.body.style.overflow !== 'hidden', 'the page is unlocked again');
        say(window.scrollY === before, 'and she is back exactly where she opened it — ' + window.scrollY);

        // 4 — Somnivex: no film, so the image lightbox
        var still = all.filter(function(t){ return t.getAttribute('data-still'); })[0];
        say(!!still, 'the storyboarded one carries a still instead of a film');
        still.click();
        setTimeout(function () {
          var lb = q('.cmp-lb');
          say(lb && !lb.hasAttribute('hidden'), 'tapping it opens the IMAGE lightbox');
          say(q('.cmp-vlb').hasAttribute('hidden'), 'and not the video one');
          lb.click();
          setTimeout(function () {
            // 5 — an empty slot is inert
            var empty = all.filter(function(t){ return t.classList.contains('empty'); });
            say(empty.length === 2, 'two empty slots');
            say(empty.every(function(t){ return t.tagName !== 'BUTTON'; }), 'neither is a button');
            empty[0].click();
            setTimeout(function () {
              say(q('.cmp-vlb').hasAttribute('hidden') && (!q('.cmp-lb') || q('.cmp-lb').hasAttribute('hidden')),
                'and tapping one opens nothing');
              report();
            }, 150);
          }, 200);
        }, 200);
      }, 200);
    }, 250);
  }, 500);
})();
</script>`;

let finish = () => {};
const server = http.createServer((req, res) => {
  const [route, qs] = req.url.split('?');
  if (route === '/result') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
    return finish(new URLSearchParams(qs).get('r') || '');
  }
  if (route === '/pix.gif') { res.writeHead(200, { 'Content-Type': 'image/gif' }); return res.end(PIX); }
  if (route === '/compare.css' || route === '/compare.js') {
    res.writeHead(200, { 'Content-Type': route.endsWith('.css') ? 'text/css' : 'application/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, route.slice(1)), 'utf8'));
  }
  if (route.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"ok":true,"items":{},"texts":{}}');
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page);
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'iggrid-'));
  const kid = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu',
    '--user-data-dir=' + profile, url], { stdio: 'ignore' });
  const done = (verdict, err) => {
    try { kid.kill('SIGKILL'); } catch (_) {}
    server.close();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
    if (err) { console.log('FAIL: ' + err); process.exit(1); }
    const lines = verdict.split(' | ').filter(Boolean);
    lines.forEach((l) => console.log(l));
    if (!lines.length) { console.log('FAIL: no verdict — the page script never ran'); process.exit(1); }
    const bad = lines.filter((l) => l.startsWith('FAIL')).length;
    console.log(bad ? `\n${bad} failed` : `\nall ${lines.length} checks passed`);
    process.exit(bad ? 1 : 0);
  };
  const timer = setTimeout(() => done('', 'timed out waiting for the page'), 30000);
  finish = (vd) => { clearTimeout(timer); done(vd); };
});
