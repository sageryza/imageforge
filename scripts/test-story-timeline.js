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
 *   4. joining two units must make ONE unit that then moves whole, and no card
 *      may ever be lost by a join, a split or a move
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
  function ok(c, m, extra) { L.push((c ? 'PASS' : 'FAIL') + ': ' + m + (c ? '' : ' [' + extra + ']')); }
  function units() { return Array.prototype.slice.call(document.querySelectorAll('#tl .unit')); }
  function ids() { return units().map(function (u) {
    return Array.prototype.map.call(u.querySelectorAll('.mcard'), function (c) {
      return c.getAttribute('data-item'); }).join(','); }); }
  function nums() { return Array.prototype.map.call(document.querySelectorAll('#tl .no'),
    function (b) { return b.value; }).join(','); }
  function unitOf(id) { return document.querySelector('[data-item="' + id + '"]').closest('.unit'); }
  function tap(id, sel) { unitOf(id).querySelector(sel).click(); }
  function type(id, v) {
    var box = unitOf(id).querySelector('.no');
    box.value = String(v); box.dispatchEvent(new FocusEvent('blur'));
  }
  function cards() { return document.querySelectorAll('#tl .mcard').length; }

  setTimeout(function () {
    var N0 = units().length, CARDS0 = cards();
    function run() { var a = []; for (var i = 1; i <= units().length; i++) a.push(i); return a.join(','); }

    ok(nums() === run(), 'every unit is numbered, 1..N', nums());
    ok(unitOf('b3') === unitOf('b7') && unitOf('b3').querySelectorAll('.mcard').length === 5,
       'a sequence starts as ONE unit of 5 cards', '');
    ok(document.querySelectorAll('#tl .join button').length === N0 - 1,
       'a join sits in every gap', document.querySelectorAll('#tl .join button').length + '/' + (N0 - 1));
    ok(units()[0].querySelector('.up').disabled && units()[0].querySelector('.top').disabled,
       'the first unit cannot go up', '');

    // one step
    tap('b1', '.dn');
    ok(ids()[0] === 'b2' && ids()[1] === 'b1', 'a single arrow moves one place', ids().slice(0, 3).join(' / '));
    ok(nums() === run(), 'it renumbers after a move', nums());

    // all the way (her v4 ask)
    tap('b1', '.top');
    ok(ids()[0] === 'b1', 'the double arrow sends it to the top', ids().slice(0, 2).join(' / '));
    tap('b1', '.bot');
    ok(ids()[ids().length - 1] === 'b1', 'the other one sends it to the bottom', ids().slice(-2).join(' / '));

    // typing a number
    type('b1', 4);
    ok(ids()[3] === 'b1', 'typing 4 lands it on 4', ids().slice(0, 6).join(' / '));

    // COMBINE two next to each other (her v4 ask)
    var before = units().length;
    var i = ids().indexOf('b1');
    var neighbour = ids()[i + 1];
    document.querySelectorAll('#tl .join button')[i].click();
    ok(units().length === before - 1, 'joining two makes one unit', units().length + ' vs ' + before);
    ok(unitOf('b1') === unitOf(neighbour.split(',')[0]),
       'the two are in the same unit now', '');
    ok(unitOf('b1').classList.contains('seq'), 'a joined unit is drawn attached', '');
    ok(nums() === run(), 'the numbers close up after a join', nums());

    // and back apart
    tap('b1', '.split');
    ok(unitOf('b1') !== unitOf(neighbour.split(',')[0]), 'split breaks it back apart', '');

    // a joined unit moves whole
    document.querySelectorAll('#tl .join button')[0].click();
    var joined = ids()[0];
    tap(joined.split(',')[0], '.bot');
    ok(ids()[ids().length - 1] === joined, 'a joined unit moves whole', ids().slice(-2).join(' / '));

    ok(cards() === CARDS0, 'no card is lost across any of it', cards() + ' vs ' + CARDS0);
    ok(document.querySelectorAll('#tl .cmp-note').length === cards(),
       'every card still has its note box',
       document.querySelectorAll('#tl .cmp-note').length + '/' + cards());

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
