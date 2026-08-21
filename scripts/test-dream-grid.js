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
  setTimeout(function(){ say(false, 'the chain stopped early — see the last PASS above'); report(); }, 9000);
  function q(s){ return document.querySelector(s); }
  function tiles(){ return [].slice.call(document.querySelectorAll('.gtile')); }
  window.addEventListener('error', function(e){ say(false, 'page error — ' + e.message); });
  setTimeout(function () {
    var all = tiles();
    var films = all.filter(function(t){ return t.getAttribute('data-film'); });
    say(all.length === 9, 'nine slots on the grid — got ' + all.length);
    void FILMS;
    say(films.length === FILMS.length, FILMS.length + ' tiles carry a film — got ' + films.length);
    say(films.every(function(t){ return t.tagName === 'BUTTON'; }), 'each of them is a real button');
    // each tile names ITS OWN film — asserted as "distinct, and under its own
    // prefix" rather than against the built-in list, because by now the
    // resolver has legitimately moved one of them to a newer cut
    var urls = films.map(function(t){ return t.getAttribute('data-film'); });
    say(new Set(urls).size === urls.length, 'no two tiles share a film');
    say(films.every(function(t){
      return t.getAttribute('data-film').indexOf('/' + t.getAttribute('data-prefix')) > -1;
    }), "and each one's film sits under its own prefix");

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
      // the pinned-player geometry: the video ELEMENT fills the overlay, so a
      // finger anywhere lands ON the film (that is what raises the Note
      // button) and never on a close-on-tap backdrop beside a small video
      var vr = v.getBoundingClientRect(), wr = vlb.getBoundingClientRect();
      say(Math.abs(vr.width - wr.width) < 2 && Math.abs(vr.height - wr.height) < 2,
        'the video element fills the lightbox — got ' + Math.round(vr.width) + 'x' + Math.round(vr.height)
        + ' in ' + Math.round(wr.width) + 'x' + Math.round(wr.height));
      q('.cmp-vlb-x').click();                    // the way out is the X now
      setTimeout(function () {
        say(vlb.hasAttribute('hidden'), 'the X closes it');
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

              // 7 — the re-cut one moved, and ONLY it
              var song = all.filter(function(t){ return t.getAttribute('data-prefix') === 'dream-commercial/spot-'; })[0];
              say(song && /spot-v8/.test(song.getAttribute('data-film')),
                'the page asked which cut is current and the song tile moved to it');
              var row = q('.glegend i[data-id="' + song.getAttribute('data-id') + '"]');
              say(row && row.classList.contains('moved'), 'its line under the grid says so');
              say(row && /v8/.test(row.querySelector('b').textContent),
                "and names the new cut, not the old duration");
              var boys = all.filter(function(t){ return t.getAttribute('data-prefix') === 'dream-commercial/commercial-'; })[0];
              say(boys && /commercial-v2/.test(boys.getAttribute('data-film')),
                'a film the resolver said nothing about kept the url it was built with');

              // 8 — tap-to-note, on a Compare page
              song.click();
              setTimeout(function () {
                var vlb = q('.cmp-vlb'), v = vlb.querySelector('video');
                say(v.getAttribute('src') === song.getAttribute('data-film'),
                  'and tapping it plays the NEW cut');
                v.click();                       // the touch that reveals it
                setTimeout(function () {
                  var nb = vlb.querySelector('.notebtn');
                  say(!!nb, 'touching the film raises the Note button — the pinned-player mechanism, here');
                  say(nb && !nb.classList.contains('off'), 'and it is showing');
                  nb.click();
                  setTimeout(function () {
                    var sheet = vlb.querySelector('.nsheet');
                    say(!!sheet, 'tapping Note opens the sheet');
                    say(v.paused, 'and pauses the film');
                    say(sheet && /Note at \\d+:\\d\\d/.test(sheet.textContent), 'stamped with where she is');
                    sheet.querySelector('textarea').value = 'the ending drags';
                    sheet.querySelector('.send').click();
                    setTimeout(function () {
                      fetch('/notes').then(function(r){ return r.json(); }).then(function (d) {
                        var n = (d.notes || [])[0];
                        say(!!n, 'Done files the note');
                        say(n && n.chat === 'song-commercial-selection',
                          'to the chat that MAKES the film, not this one — got ' + (n && n.chat));
                        say(n && /spot-v8/.test(n.url || ''), "on the film's own url");
                        say(n && /the ending drags/.test(n.text || ''), 'with her words');
                        say(n && /^\\[\\d+:\\d\\d\\]/.test(n.text || ''), 'stamped with the time');
                        report();
                      });
                    }, 250);
                  }, 200);
                }, 150);
              }, 250);
            }, 150);
          }, 200);
        }, 200);
      }, 200);
    }, 250);
  }, 500);
})();
</script>`;

let finish = () => {};
const notes = [];
const server = http.createServer((req, res) => {
  const [route, qs] = req.url.split('?');
  if (route === '/result') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
    return finish(new URLSearchParams(qs).get('r') || '');
  }
  if (route === '/notes') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ notes }));
  }
  if (route === '/pix.gif') { res.writeHead(200, { 'Content-Type': 'image/gif' }); return res.end(PIX); }
  if (route === '/compare.css' || route === '/compare.js' || route === '/filmnote.js') {
    res.writeHead(200, { 'Content-Type': route.endsWith('.css') ? 'text/css' : 'application/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, route.slice(1)), 'utf8'));
  }
  // the resolver: the song spot has been re-cut in its own chat since this
  // page was built, and nothing else has moved
  if (route === '/api/chatfeed/newest') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ films: { 'dream-commercial/spot-': {
      url: 'https://storage.googleapis.com/b/dream-commercial/spot-v8.mp4',
      from: 'pin', title: 'The song spot v8 (0:28)', name: 'spot-v8.mp4' } } }));
  }
  if (route === '/api/gallery/assets/note') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      try { notes.push(JSON.parse(body || '{}')); } catch (_) { /* the page still resumes */ }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
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
