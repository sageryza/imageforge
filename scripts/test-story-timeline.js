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
 *      may ever be lost by a join, a split, a move, a divide or a delete
 *   5. her edits, her additions and her deletions must reach the server, or the
 *      page looks right and loses the lot on the next open
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
  function card(id) { return document.querySelector('[data-item="' + id + '"]'); }
  function unitOf(id) { return card(id).closest('.unit'); }
  function tap(id, sel) { unitOf(id).querySelector(sel).click(); }
  function words(id) { return card(id).querySelector('.say').textContent; }
  function count() { return document.querySelectorAll('#tl .mcard').length; }
  function posts() { return SENT.slice(); }

  // watch what it saves, so the test knows her work is actually persisted
  var SENT = [], realFetch = window.fetch.bind(window);
  window.fetch = function (u, o) {
    if (o && o.method === 'POST') { try { SENT.push(JSON.parse(o.body)); } catch (e) {} }
    return realFetch(u, o);
  };

  setTimeout(function () {
    var N0 = units().length, C0 = count();
    function run() { var a = []; for (var i = 1; i <= units().length; i++) a.push(i); return a.join(','); }

    ok(nums() === run(), 'every unit is numbered, 1..N', nums());
    ok(unitOf('b3') === unitOf('b7') && unitOf('b3').querySelectorAll('.mcard').length === 5,
       'a sequence starts as ONE unit of 5 cards', '');
    ok(document.querySelectorAll('#tl .joinb').length === N0 - 1
       && document.querySelectorAll('#tl .addb').length === N0 + 1,
       'a join in every gap, an add in every gap and both ends',
       document.querySelectorAll('#tl .joinb').length + '/' + document.querySelectorAll('#tl .addb').length);

    // ---- FOLDING a long sequence (her ask)
    var seq = unitOf('b3');
    ok(seq.classList.contains('long'), 'a 5-card sequence folds', seq.className);
    ok(!card('b3').classList.contains('trim') && !card('b7').classList.contains('trim'),
       'the first and last stay whole', '');
    ok(card('b4').classList.contains('trim') && card('b5').classList.contains('trim')
       && card('b6').classList.contains('trim'), 'the middles are trimmed to a line', '');
    ok(getComputedStyle(card('b5').querySelector('.say')).whiteSpace === 'nowrap',
       'a trimmed middle really is one line', '');
    card('b5').click();
    ok(unitOf('b5').classList.contains('open'), 'tapping a folded middle opens the unit', '');
    ok(getComputedStyle(card('b5').querySelector('.say')).whiteSpace !== 'nowrap',
       'and then it shows the whole thing', '');
    card('b5').click();
    ok(!unitOf('b5').classList.contains('open'), 'tapping again folds it back', '');

    // ---- moving
    tap('b1', '.dn');
    ok(ids()[0] === 'b2' && ids()[1] === 'b1', 'a single arrow moves one place', ids().slice(0, 3).join(' / '));
    tap('b1', '.top');
    ok(ids()[0] === 'b1', 'the double arrow sends it to the top', ids().slice(0, 2).join(' / '));
    tap('b1', '.bot');
    ok(ids()[ids().length - 1] === 'b1', 'the other sends it to the bottom', ids().slice(-2).join(' / '));
    var box = unitOf('b1').querySelector('.no');
    box.value = '4'; box.dispatchEvent(new FocusEvent('blur'));
    ok(ids()[3] === 'b1', 'typing 4 lands it on 4', ids().slice(0, 6).join(' / '));

    // ---- JOIN and SPLIT
    var before = units().length, i = ids().indexOf('b1'), nb = ids()[i + 1].split(',')[0];
    document.querySelectorAll('#tl .joinb')[i].click();
    ok(units().length === before - 1 && unitOf('b1') === unitOf(nb), 'joining two makes one unit',
       units().length + ' vs ' + before);
    tap('b1', '.split');
    ok(unitOf('b1') !== unitOf(nb), 'split breaks it back apart', '');

    // ---- ADD a moment in a gap (her ask)
    var was = units().length;
    document.querySelectorAll('#tl .addb')[2].click();
    ok(units().length === was + 1, 'the + in a gap adds a moment there', units().length + ' vs ' + was);
    var fresh = document.querySelector('.mcard.editing');
    ok(!!fresh, 'the new one opens ready to type', '');
    ok(units()[2].querySelector('.mcard') === fresh, 'it lands in the gap that was tapped',
       ids().slice(0, 4).join(' / '));
    var fid = fresh.getAttribute('data-item');
    fresh.querySelector('.etext').value = 'a brand new moment';
    fresh.querySelector('.etext').dispatchEvent(new FocusEvent('blur'));

    setTimeout(function () {
      ok(words(fid) === 'a brand new moment', 'typing in it sticks', words(fid));
      ok(!card(fid).classList.contains('editing'), 'and it closes on the way out', '');

      // ---- EDIT an existing moment (her ask)
      card('b2').querySelector('.pencil').click();
      ok(card('b2').classList.contains('editing'), 'the pencil opens the words', '');
      ok(card('b2').querySelector('.etext').value === words('b2'),
         'the box starts with what the moment says', '');
      card('b2').querySelector('.etext').value = 'the phone, shorter now';
      card('b2').querySelector('.etext').dispatchEvent(new FocusEvent('blur'));

      setTimeout(function () {
        ok(words('b2') === 'the phone, shorter now', 'the edit sticks', words('b2'));

        // ---- DIVIDE at the cursor (her ask)
        card('b9').querySelector('.pencil').click();
        var eb = card('b9').querySelector('.etext');
        var full = eb.value, cut = full.indexOf(' ', 4);
        eb.setSelectionRange(cut, cut);
        var wasN = units().length, wasC = count();
        card('b9').querySelector('.divide').click();
        ok(count() === wasC + 1 && units().length === wasN + 1,
           'dividing a lone moment makes two moments', count() + '/' + wasC);
        ok(words('b9') === full.slice(0, cut).trim(), 'the first half keeps the front', words('b9'));
        var after = units()[units().indexOf(unitOf('b9')) + 1];
        ok(after && after.querySelector('.say').textContent === full.slice(cut).trim(),
           'the second half is the rest, right below', after && after.querySelector('.say').textContent);

        // dividing INSIDE a sequence keeps both halves in it
        var inSeq = unitOf('b4');
        card('b4').classList.remove('trim');
        card('b4').querySelector('.pencil').click();
        var eb2 = card('b4').querySelector('.etext');
        var c2 = eb2.value.indexOf(' ', 4);
        eb2.setSelectionRange(c2, c2);
        var seqWas = inSeq.querySelectorAll('.mcard').length;
        card('b4').querySelector('.divide').click();
        ok(unitOf('b4').querySelectorAll('.mcard').length === seqWas + 1,
           'dividing inside a sequence keeps both halves in it',
           unitOf('b4').querySelectorAll('.mcard').length + ' vs ' + seqWas);

        // ---- DELETE (her ask)
        var delN = count();
        card('b15').querySelector('.pencil').click();
        card('b15').querySelector('.del').click();
        ok(!card('b15') && count() === delN - 1, 'delete removes the moment', count() + ' vs ' + delN);

        // the saves are debounced and the note boxes are wired after a fetch,
        // so the last checks wait for both to land
        setTimeout(function () {
          ok(posts().some(function (p) { return p.item === 't:b2' && p.text === 'the phone, shorter now'; }),
             'the edit reaches the server', '');
          ok(posts().some(function (p) { return p.item === 'gone' && p.text.indexOf('b15') >= 0; }),
             'the deletion is remembered so it cannot come back', '');
          ok(nums() === run(), 'the numbers are still 1..N after all of it', nums());
          ok(document.querySelectorAll('#tl .cmp-note').length === count(),
             'every card, new ones included, has its note box',
             document.querySelectorAll('#tl .cmp-note').length + '/' + count());
          ok(posts().some(function (p) { return p.item === 'order' && p.text.indexOf('|') > 0; }),
             'the arrangement is saved with its grouping', '');
          realFetch('/result?r=' + encodeURIComponent(L.join(' | ')));
        }, 900);
      }, 300);
    }, 300);
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
