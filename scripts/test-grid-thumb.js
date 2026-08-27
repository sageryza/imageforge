#!/usr/bin/env node
/* THE GRID TILE IS A DERIVED COPY, NEVER THE ORIGINAL.
 *
 *   node scripts/test-grid-thumb.js
 *
 * 2026-08-27, Sophie on a 30-tile grid of cut 4K panels: "no images in the
 * compare top". Every picture was there and every url answered 200 — each one
 * was a ~1.4MB LOSSLESS webp straight out of the panel cutter, so the page
 * asked her phone for ~42MB at once and nothing finished arriving. grid.js was
 * the one renderer the house webp rule had never reached.
 *
 * What this pins, in a real browser against the real renderer:
 *   - a Storage-hosted picture is fetched through /api/story/thumb, and the
 *     REQUEST really happens (a src assertion alone cannot tell a rewritten
 *     attribute from a picture that actually arrived that way)
 *   - the ORIGINAL is never requested for a tile
 *   - `data-full` and the lightbox still open the original, full size
 *   - a data:/http: picture that is not Storage-hosted is left alone
 *   - the tiles are lazy, so a long page does not fetch every row up front
 *
 * Skips with exit 0 if no Chromium.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { validateTemplate, renderTemplatePage } = require('../page-templates');

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

const files = {
  '/compare.css': ['text/css', fs.readFileSync(path.join(PUB, 'compare.css'), 'utf8')],
  '/compare.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'compare.js'), 'utf8')],
  '/grid.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'grid.js'), 'utf8')],
  '/judge.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'judge.js'), 'utf8')],
  '/asset-lightbox.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'asset-lightbox.js'), 'utf8')],
  '/asset-view.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'asset-view.js'), 'utf8')],
  '/page-views.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'page-views.js'), 'utf8')],
};

// A 1x1 gif, so the harness serves real bytes for both the original and the
// derived copy — the browser has to actually decode what it is given.
const GIF = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
const DATA_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='60'%3E%3Crect width='40' height='60' fill='%23c99'/%3E%3C/svg%3E";
const SG = 'https://storage.googleapis.com/test-bucket';
const BIG = `${SG}/a/original-big.png`;

const SPY = `<script>
try{localStorage.setItem('cmp-tour-grid','1');localStorage.setItem('cmp-tour-deck','1');}catch(_){}
window.addEventListener('error', function(e){
  fetch('/result?r=' + encodeURIComponent('FAIL: page error — ' + e.message), {});
});
</script>`;

const TEST = `<script>
setTimeout(function(){
  var L=[]; function ok(c,m){ L.push((c?'PASS':'FAIL')+': '+m); }
  var m=document.getElementById('grid');
  var tiles=m.querySelectorAll('.gd-it img');
  var store=tiles[0], plain=tiles[1];

  ok(store.getAttribute('src').indexOf('/api/story/thumb')===0,
     'a Storage picture is asked for through the thumb service — got '
     + store.getAttribute('src').slice(0,46));
  ok(decodeURIComponent(store.getAttribute('src')).indexOf('${BIG}')>0,
     'and the thumb url names the original it derives from');
  ok(store.getAttribute('data-full')==='${BIG}',
     'data-full still carries the ORIGINAL, untouched');
  ok(store.getAttribute('loading')==='lazy',
     'the tile is lazy, so a long page does not fetch every row up front');
  ok(plain.getAttribute('src')==="${DATA_IMG}",
     'a picture that is not Storage-hosted is left exactly as given');

  // THE REQUEST, not the attribute. A rewritten src that 404s and a src that
  // never changed look the same to any markup assertion — and the browser's
  // own resource log lists every request it ATTEMPTED, failures included, so
  // a tile quietly reaching for the original still shows up here.
  fetch('/seen').then(function(r){return r.json();}).then(function(seen){
    var asked=performance.getEntriesByType('resource')
      .map(function(e){ return e.name; })
      // STARTS with, not contains: the thumb url carries the original
      // percent-encoded in its query, so a substring test matches itself
      .filter(function(n){ return n.indexOf('https://storage.googleapis.com')===0; });
    ok(seen.thumb>0, 'the thumb was really fetched — ' + seen.thumb + ' request(s)');
    ok(asked.length===0,
       'and the multi-megabyte original was never requested for a tile — got '
       + asked.length + ' (' + asked.join(',').slice(0,60) + ')');
    ok(store.naturalWidth>0, 'the tile decoded a real picture');

    // the lightbox is opened from the ITEM, so it must still show the original
    store.click();
    setTimeout(function(){
      var lb=document.querySelector('#lb img, .lb img, #clightbox img');
      var src=lb ? lb.getAttribute('src') : '';
      ok(!!lb, 'tapping the tile opens the lightbox');
      // the ATTRIBUTE, because the harness cannot serve the real Storage host
      ok(src.indexOf('/api/story/thumb')<0 && src.indexOf('storage.googleapis.com')>=0,
         'the lightbox shows the ORIGINAL, not the tile thumb — got ' + src.slice(-44));
      fetch('/result?r=' + encodeURIComponent(L.join(' | ')), {});
    }, 500);
  });
}, 900);
</script>`;

function page() {
  const v = validateTemplate('grid', { groups: [
    { label: 'a cut panel, straight out of Storage', items: [
      { id: 'stored', label: 'the 4K cut', img: BIG, full: BIG, url: BIG,
        model: 'gpt-image-2', quality: 'medium' },
      { id: 'plain', label: 'not Storage-hosted', img: DATA_IMG },
    ] },
  ] });
  if (!v.ok) throw new Error(v.error);
  const html = renderTemplatePage({ title: 'Thumb rule', template: 'grid',
    data: v.data, chat: 'test', sheet: 'page-test' });
  // renderTemplatePage emits a bare document — no </head>, no </body> — so the
  // spy goes in BEFORE the first script (the tour marker has to be set before
  // grid.js runs, or the coach marks cover the tiles) and the test after them.
  const at = html.indexOf('<script');
  return html.slice(0, at) + SPY + html.slice(at) + TEST;
}

function run(html) {
  return new Promise((resolve, reject) => {
    let finish = null;
    const seen = { thumb: 0 };
    const server = http.createServer((req, res) => {
      const [route, qs] = req.url.split('?');
      if (route === '/result') {
        res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
        return finish && finish(new URLSearchParams(qs).get('r') || '');
      }
      if (route === '/seen') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(seen));
      }
      if (route === '/api/story/thumb') {
        seen.thumb += 1;
        res.writeHead(200, { 'Content-Type': 'image/gif' }); return res.end(GIF);
      }
      if (route === '/api/chatfeed/verdict') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end('{"ok":true,"items":{},"texts":{}}');
      }
      if (route.indexOf('/api/gallery') === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end('{"ok":true,"assets":[],"notes":[]}');
      }
      const hit = files[route];
      if (hit) { res.writeHead(200, { 'Content-Type': hit[0] }); return res.end(hit[1]); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gthumb-'));
      // Storage is deliberately NOT reachable here: a tile that reaches for
      // the original fails its request, and the page reads that off
      // performance.getEntriesByType('resource'), which lists attempts.
      const kid = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu',
        '--user-data-dir=' + profile,
        `http://127.0.0.1:${port}/`], { stdio: 'ignore' });
      const done = (verdict, err) => {
        try { kid.kill('SIGKILL'); } catch (_) {}
        server.close();
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
        if (err) return reject(new Error(err));
        const lines = verdict.split(' | ').filter(Boolean);
        lines.forEach((l) => console.log('grid thumb — ' + l));
        if (!lines.length) return reject(new Error('no verdict — the page script never ran'));
        if (lines.some((l) => l.startsWith('FAIL'))) return reject(new Error('failures above'));
        resolve(lines.length);
      };
      const timer = setTimeout(() => done('', 'timed out waiting for the page'), 30000);
      finish = (vd) => { clearTimeout(timer); done(vd); };
    });
  });
}

run(page()).then((n) => console.log(`\nall ${n} checks passed`))
  .catch((e) => { console.error('\n' + e.message); process.exit(1); });
