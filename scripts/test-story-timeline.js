#!/usr/bin/env node
/* Tests the story timeline page's re-ordering against the REAL built page.
 *
 *   node scripts/test-story-timeline.js
 *
 * The things that can silently ruin her arrangement:
 *   1. a SEQUENCE must move as ONE unit and keep all its cards
 *   2. typing a number must land it on THAT number — the naive version counts
 *      the place in the list the card is still sitting in and lands one short
 *      (that was a real bug here, caught by this test before she saw it)
 *   3. re-ordering must MOVE the DOM nodes, never rebuild them, or the note
 *      boxes /compare.js hangs off each card (and a half-typed note) are lost
 *   4. the character card must never be duplicated or dropped by a move
 *
 * Headless Chromium directly (no playwright dependency), and the verdict comes
 * back over HTTP rather than via --dump-dom: virtual time HANGS on a page that
 * loads /compare.js (measured here — the autoscroll is a rAF loop and virtual
 * time fast-forwards it forever). Skips with exit 0 if no Chromium is found.
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
// the NEWEST built page — a new version is a new file, and the test follows it
const DIR = path.join(ROOT, 'docs/story-timeline');
const PAGE = path.join(DIR, (fs.existsSync(DIR) ? fs.readdirSync(DIR) : [])
  .filter((f) => /^timeline-v\d+\.html$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10))
  .pop() || 'timeline.html');

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].filter(Boolean);
const chrome = CANDIDATES.find((p) => { try { fs.accessSync(p); return true; } catch (_) { return false; } })
  || (() => {
    try {
      const hit = fs.readdirSync('/opt/pw-browsers').find((d) => d.startsWith('chromium-'));
      const p = hit && path.join('/opt/pw-browsers', hit, 'chrome-linux', 'chrome');
      return p && fs.existsSync(p) ? p : null;
    } catch (_) { return null; }
  })();

if (!chrome) { console.log('no Chromium found — skipping (set CHROME_PATH to run)'); process.exit(0); }
if (!fs.existsSync(PAGE)) {
  console.error('build the page first: node scripts/gen-story-timeline.js');
  process.exit(1);
}

const DRIVE = `<script>
(function () {
  var L = [];
  function ids() { return Array.prototype.map.call(document.querySelectorAll('#tl .unit'),
    function (li) { return li.getAttribute('data-unit'); }); }
  function nums() { return Array.prototype.map.call(document.querySelectorAll('#tl .no'),
    function (b) { return b.value; }).join(','); }
  function ok(c, m, extra) { L.push((c ? 'PASS' : 'FAIL') + ': ' + m + (c ? '' : ' [' + extra + ']')); }
  function type(box, v) { box.value = String(v); box.dispatchEvent(new FocusEvent('blur')); }

  setTimeout(function () {
    var N = document.querySelectorAll('#tl .no').length;
    var run = []; for (var i = 1; i <= N; i++) run.push(i);
    run = run.join(',');
    var start = ids();

    ok(N === document.querySelectorAll('#tl .unit').length,
       'every unit carries a number, the cast card included', N);
    ok(nums() === run, 'the numbers run 1..N', nums());
    ok(document.querySelector('[data-unit="s-b3"] .cards').children.length === 5,
       'a sequence is ONE unit holding its 5 cards', '');
    ok(document.querySelector('#tl .unit .up').disabled, 'the first up arrow is disabled', '');

    document.querySelector('[data-unit="b1"] .dn').click();
    ok(ids()[0] === 'b2' && ids()[1] === 'b1', 'an arrow moves one place', ids().slice(0, 3).join('|'));
    ok(nums() === run, 'it renumbers after the arrow', nums());

    type(document.querySelector('[data-unit="b1"] .no'), 6);
    ok(ids().indexOf('b1') === 5, 'typing 6 lands it on 6', ids().slice(0, 8).join('|'));

    type(document.querySelector('[data-unit="s-b3"] .no'), 1);
    ok(ids()[0] === 's-b3' && document.querySelector('[data-unit="s-b3"] .cards').children.length === 5,
       'a sequence moves whole', ids().slice(0, 3).join('|'));

    var boxes = document.querySelectorAll('#tl .no');
    type(boxes[boxes.length - 1], N);
    ok(ids().filter(function (x) { return x === 'cast'; }).length === 1,
       'the cast card survives, exactly once', '');
    ok(ids().length === start.length, 'nothing is lost across the moves',
       ids().length + ' vs ' + start.length);
    ok(document.querySelectorAll('#tl .cmp-note').length === document.querySelectorAll('#tl .mcard').length,
       'every card still has its note box after moving',
       document.querySelectorAll('#tl .cmp-note').length + '/'
       + document.querySelectorAll('#tl .mcard').length);

    fetch('/result?r=' + encodeURIComponent(L.join(' | ')));
  }, 700);
})();
</script>`;

const files = {
  '/compare.css': ['text/css', fs.readFileSync(path.join(PUB, 'compare.css'), 'utf8')],
  '/compare.js': ['application/javascript', fs.readFileSync(path.join(PUB, 'compare.js'), 'utf8')],
};
const page = fs.readFileSync(PAGE, 'utf8') + DRIVE;

let finish = null;
const server = http.createServer((req, res) => {
  const [route, qs] = req.url.split('?');
  if (route === '/result') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
    return finish && finish(decodeURIComponent(new URLSearchParams(qs).get('r') || ''));
  }
  if (route === '/api/chatfeed/verdict') {        // no saved arrangement, no notes
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"items":{},"texts":{}}');
  }
  const hit = files[route];
  if (hit) { res.writeHead(200, { 'Content-Type': hit[0] }); return res.end(hit[1]); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page);
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'story-tl-'));
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
