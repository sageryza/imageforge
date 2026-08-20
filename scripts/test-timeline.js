#!/usr/bin/env node
/* test-timeline.js — the Story Timeline.
 *
 *   node scripts/test-timeline.js
 *
 * Two halves:
 *   1. the PURE half (timeline-parse.js) — turning a dictation into moments and
 *      a first guess at the sequences, and the validators that stop a bad PUT
 *      from corrupting an arrangement. No express, no Firebase: this half runs
 *      in any checkout, deps installed or not.
 *   2. the PAGE (public/timeline.html) driven in headless Chromium against a
 *      stub /api/timeline, because the things that can quietly ruin her work
 *      are all interactions: a sequence must move whole, a typed number must
 *      land on THAT number, a join/divide/delete must never lose a card, and
 *      every change must actually reach the server. Skips cleanly with no
 *      Chromium.
 *
 * The verdict from the page comes back over HTTP, not --dump-dom: virtual time
 * hangs on a page with a requestAnimationFrame loop in it.
 */
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const {
  parseStory, cleanMoments, cleanUnits, countMoments, packUnits, unpackUnits,
} = require('../timeline-parse');

let n = 0;
function t(name, fn) { fn(); n++; console.log('  ok — ' + name); }
const texts = (r) => r.units.map((u) => u.map((id) => r.moments[id].text));

/* ------------------------------------------------------------- the parser */

console.log('parsing a dictation');

t('every line becomes a moment, in order', () => {
  const r = parseStory('the laundry basket\nthe phone in the window\nthe chair');
  assert.deepStrictEqual(texts(r), [['the laundry basket'], ['the phone in the window'], ['the chair']]);
  assert.strictEqual(countMoments(r.units), 3);
});

t('her dictated numbers are stripped, not kept', () => {
  const r = parseStory('1. the basket\n2) the phone\n12 - the chair');
  assert.deepStrictEqual(texts(r), [['the basket'], ['the phone'], ['the chair']]);
});

t('wrapping quotes come off, inner punctuation stays', () => {
  const r = parseStory('1. “the phone, that didn’t happen.”');
  assert.deepStrictEqual(texts(r), [['the phone, that didn’t happen.']]);
});

t('an ALL-CAPS line groups what follows into ONE unit', () => {
  const r = parseStory('a\nSEQUENCE\nb\nc\nEND SEQUENCE\nd');
  assert.deepStrictEqual(texts(r), [['a'], ['b', 'c'], ['d']]);
});

t('a blank line closes a group when she never wrote END', () => {
  const r = parseStory('SEQUENCE\nb\nc\n\nd\ne');
  assert.deepStrictEqual(texts(r), [['b', 'c'], ['d'], ['e']]);
});

t('the next header closes the one before it', () => {
  const r = parseStory('CHAIR GROUP\na\nb\nOCD SEQUENCE\nc\nd');
  assert.deepStrictEqual(texts(r), [['a', 'b'], ['c', 'd']]);
});

t('the header rides along as the first moment’s label', () => {
  const r = parseStory('CHARACTER REFERENCE\nThree men.');
  assert.strictEqual(r.moments[r.units[0][0]].label, 'CHARACTER REFERENCE');
  assert.strictEqual(r.moments[r.units[0][0]].text, 'Three men.');
});

t('a header with nothing under it leaves no empty unit', () => {
  const r = parseStory('a\nSEQUENCE\n\nb');
  assert.deepStrictEqual(texts(r), [['a'], ['b']]);
});

t('a shouted sentence is prose, not a header', () => {
  const r = parseStory('I AM NEVER GOING BACK TO THAT HOUSE AGAIN, NOT EVER, NO');
  assert.strictEqual(r.units.length, 1);
  assert.strictEqual(r.units[0].length, 1);
});

t('ids are unique across a long list', () => {
  const r = parseStory(Array.from({ length: 200 }, (_, i) => 'moment ' + i).join('\n'));
  const ids = Object.keys(r.moments);
  assert.strictEqual(ids.length, 200);
  assert.strictEqual(new Set(ids).size, 200);
});

t('empty in, empty out — never a crash', () => {
  ['', null, undefined, '   \n\n  '].forEach((v) => {
    const r = parseStory(v);
    assert.deepStrictEqual(r.units, []);
  });
});

/* ---------------------------------------------------------- the validators */

console.log('keeping a PUT in shape');

t('a card can only be in ONE unit', () => {
  const m = { a: { text: 'x' }, b: { text: 'y' } };
  assert.deepStrictEqual(cleanUnits([['a', 'b'], ['a']], m), [['a', 'b']]);
});

t('an id with no moment behind it is dropped', () => {
  assert.deepStrictEqual(cleanUnits([['a', 'ghost']], { a: { text: 'x' } }), [['a']]);
});

t('empty units never survive', () => {
  assert.deepStrictEqual(cleanUnits([[], ['a'], []], { a: { text: 'x' } }), [['a']]);
});

t('a non-array arrangement is refused outright, not coerced', () => {
  assert.strictEqual(cleanUnits('a,b', { a: { text: 'x' } }), null);
  assert.strictEqual(cleanUnits(null, {}), null);
});

t('moments keep only text, label and tag', () => {
  const out = cleanMoments({ a: { text: 'x', label: 'L', tag: '2x', hidden: true, id: 'nope' } });
  assert.deepStrictEqual(out, { a: { text: 'x', label: 'L', tag: '2x' } });
});

t('a moment with no text becomes an empty one, never undefined', () => {
  assert.deepStrictEqual(cleanMoments({ a: {} }), { a: { text: '' } });
});

t('a text that is too long is cut, not refused', () => {
  const out = cleanMoments({ a: { text: 'x'.repeat(9000) } });
  assert.strictEqual(out.a.text.length, 4000);
});

console.log('storing an arrangement');

t('units are PACKED for Firestore, which refuses a nested array', () => {
  assert.deepStrictEqual(packUnits([['a', 'b'], ['c']]), ['a,b', 'c']);
  packUnits([['a', 'b'], ['c']]).forEach((row) => assert.strictEqual(typeof row, 'string'));
});

t('and come back out the same arrangement', () => {
  const u = [['a', 'b'], ['c'], ['d', 'e', 'f']];
  assert.deepStrictEqual(unpackUnits(packUnits(u)), u);
});

t('a doc written before the packing still reads', () => {
  assert.deepStrictEqual(unpackUnits([['a', 'b'], ['c']]), [['a', 'b'], ['c']]);
});

t('empty rows never become empty units', () => {
  assert.deepStrictEqual(unpackUnits(['a,,b', '', 'c']), [['a', 'b'], ['c']]);
  assert.deepStrictEqual(packUnits([[], ['a']]), ['a']);
});

console.log(`\n${n} pure checks passed`);

/* ------------------------------------------------------------- the page */

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

if (!chrome) { console.log('\nno Chromium found — skipping the page half'); process.exit(0); }

// one story with a 5-long sequence in it, so the fold is exercised
const STORY = (() => {
  const r = parseStory([
    'the laundry basket', 'the phone in the window', '',
    'SEQUENCE', 'the lilac moment', 'the realization', 'getting it from the cabinet',
    'screaming', 'the belly button', '',
    'finding the knife', 'the gun', 'the chair',
  ].join('\n'));
  return { id: 'story1', title: 'A story', moments: r.moments, units: r.units };
})();
const ORDER = STORY.units.map((u) => u.slice());

const DRIVE = `<script>
(function () {
  var L = [], PUTS = [];
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
  function count() { return document.querySelectorAll('#tl .mcard').length; }
  function run() { var a = []; for (var i = 1; i <= units().length; i++) a.push(i); return a.join(','); }

  var realFetch = window.fetch.bind(window);
  window.fetch = function (u, o) {
    if (o && o.method === 'PUT') { try { PUTS.push(JSON.parse(o.body)); } catch (e) {} }
    return realFetch(u, o);
  };
  var ORDER = ${JSON.stringify(ORDER)};

  setTimeout(function () {
    // the shelf came first
    ok(document.querySelectorAll('#shelf .srow').length === 1, 'the shelf lists the story', '');
    document.querySelector('#shelf .srow').click();

    setTimeout(function () {
      ok(!document.getElementById('lvStory').hidden, 'tapping a story opens it', '');
      ok(document.getElementById('title').value === 'A story', 'its name is in the box', '');
      ok(!!(history.state && history.state.story === 'story1'),
         'opening a story pushes history, so back reaches the shelf', JSON.stringify(history.state));
      var C0 = count();
      ok(nums() === run(), 'every unit is numbered 1..N', nums());

      // the sequence, and the fold
      var seqHead = ORDER[2][0], seqTail = ORDER[2][4], mid = ORDER[2][2];
      ok(unitOf(seqHead) === unitOf(seqTail), 'the parsed sequence is ONE unit', '');
      ok(unitOf(seqHead).classList.contains('long'), 'a 5-card unit folds', '');
      ok(!card(seqHead).classList.contains('trim') && !card(seqTail).classList.contains('trim'),
         'its first and last stay whole', '');
      ok(card(mid).classList.contains('trim'), 'its middles trim to one line', '');
      card(mid).click();
      ok(unitOf(mid).classList.contains('open'), 'tapping a folded middle opens it', '');
      card(mid).click();

      // moving
      var a = ORDER[0][0], b = ORDER[1][0];
      tap(a, '.dn');
      ok(ids()[0] === b && ids()[1] === a, 'a single arrow moves one place', ids().slice(0, 3).join(' / '));
      tap(a, '.top');
      ok(ids()[0] === a, 'the double arrow sends it to the top', '');
      tap(a, '.bot');
      ok(ids()[ids().length - 1] === a, 'the other sends it to the bottom', '');
      var box = unitOf(a).querySelector('.no');
      box.value = '3'; box.dispatchEvent(new FocusEvent('blur'));
      ok(ids()[2] === a, 'typing 3 lands it on 3', ids().slice(0, 5).join(' / '));

      // join, split — a sequence moves whole
      var before = units().length, i = ids().indexOf(a), nb = ids()[i + 1].split(',')[0];
      document.querySelectorAll('#tl .joinb')[i].click();
      ok(units().length === before - 1 && unitOf(a) === unitOf(nb), 'joining two makes one unit', '');
      tap(a, '.bot');
      ok(ids()[ids().length - 1].split(',').length === 2, 'a joined unit moves whole', ids().slice(-1)[0]);
      tap(a, '.split');
      ok(unitOf(a) !== unitOf(nb), 'split breaks it back apart', '');

      // add
      var was = units().length;
      document.querySelectorAll('#tl .addb')[1].click();
      var fresh = document.querySelector('.mcard.editing');
      ok(units().length === was + 1 && !!fresh, 'the + in a gap adds one, open to type', '');
      var fid = fresh.getAttribute('data-item');
      fresh.querySelector('.etext').value = 'a brand new moment';
      fresh.querySelector('.etext').dispatchEvent(new FocusEvent('blur'));

      setTimeout(function () {
        ok(card(fid).querySelector('.say').textContent === 'a brand new moment', 'what she types sticks', '');

        // edit
        card(b).querySelector('.pencil').click();
        ok(card(b).classList.contains('editing'), 'the pencil opens the words', '');
        var eb = card(b).querySelector('.etext');
        ok(eb.value === 'the phone in the window', 'the box starts with what it says', eb.value);
        eb.value = 'the phone, shorter';
        eb.dispatchEvent(new FocusEvent('blur'));

        setTimeout(function () {
          ok(card(b).querySelector('.say').textContent === 'the phone, shorter', 'the edit sticks', '');

          // divide
          card(a).querySelector('.pencil').click();
          var db = card(a).querySelector('.etext');
          var full = db.value, cut = full.indexOf(' ', 3);
          db.setSelectionRange(cut, cut);
          var wasC = count();
          card(a).querySelector('.divide').click();
          ok(count() === wasC + 1, 'dividing makes two moments', count() + ' vs ' + wasC);
          ok(card(a).querySelector('.say').textContent === full.slice(0, cut).trim(),
             'the first half keeps the front', '');

          // divide inside a sequence keeps both halves in it
          var sq = unitOf(seqHead);
          card(seqHead).querySelector('.pencil').click();
          var sb = card(seqHead).querySelector('.etext');
          var c2 = sb.value.indexOf(' ', 3);
          sb.setSelectionRange(c2, c2);
          var seqWas = sq.querySelectorAll('.mcard').length;
          card(seqHead).querySelector('.divide').click();
          ok(unitOf(seqHead).querySelectorAll('.mcard').length === seqWas + 1,
             'dividing inside a sequence keeps both halves in it', '');

          // delete
          var delC = count();
          card(b).querySelector('.pencil').click();
          card(b).querySelector('.del').click();
          ok(!card(b) && count() === delC - 1, 'delete removes the moment', '');

          ok(nums() === run(), 'the numbers are still 1..N after all of it', nums());

          // embedded under the native bar, the header band goes compact
          // (Sophie: "a lot of space at the top") — static, unbordered, and
          // no taller than the ? needs. NOT floated: a floated ? landed on
          // the right end of full-width rows.
          var headBefore = document.querySelector('.head').offsetHeight;
          document.body.classList.add('embed');
          var head = document.querySelector('.head');
          ok(head.offsetHeight <= 34 && head.offsetHeight < headBefore,
             'embedded, the header band goes compact',
             head.offsetHeight + 'px vs ' + headBefore + 'px standalone');
          ok(getComputedStyle(head).position === 'static'
             && getComputedStyle(head).borderBottomWidth === '0px',
             'and loses the sticky border band', '');
          document.body.classList.remove('embed');

          setTimeout(function () {
            var last = PUTS[PUTS.length - 1];
            ok(!!last && Array.isArray(last.units), 'it saves the arrangement to the server', '');
            ok(!!last && last.moments && Object.keys(last.moments).length >= C0,
               'and the words with it', last && Object.keys(last.moments || {}).length);
            ok(!!last && last.units.every(function (u) { return u.length; }),
               'no empty unit is ever sent', '');
            realFetch('/result?r=' + encodeURIComponent(L.join(' | ')));
          }, 900);
        }, 260);
      }, 260);
    }, 260);
  }, 400);
})();
</script>`;

const page = fs.readFileSync(path.join(ROOT, 'public/timeline.html'), 'utf8') + DRIVE;
const toolcss = fs.readFileSync(path.join(ROOT, 'public/tool.css'), 'utf8');

let finish = null;
const server = http.createServer((req, res) => {
  const [route, qs] = req.url.split('?');
  if (route === '/result') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
    return finish && finish(decodeURIComponent(new URLSearchParams(qs).get('r') || ''));
  }
  if (route === '/tool.css') {
    res.writeHead(200, { 'Content-Type': 'text/css' }); return res.end(toolcss);
  }
  if (route === '/api/timeline/stories') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ stories: [{ id: 'story1', title: 'A story', moments: 10, units: 6 }] }));
  }
  if (route.indexOf('/api/timeline/stories/') === 0) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (req.method === 'PUT') return res.end(JSON.stringify({ ok: true }));
    return res.end(JSON.stringify(STORY));
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page);
});

console.log('\ndriving the page');
server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'timeline-'));
  const kid = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu',
    '--user-data-dir=' + profile, url], { stdio: 'ignore' });

  const done = (verdict, err) => {
    try { kid.kill('SIGKILL'); } catch (_) {}
    server.close();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
    if (err) { console.error(err); process.exit(1); }
    const lines = verdict.split(' | ').filter(Boolean);
    lines.forEach((l) => console.log('  ' + l));
    if (!lines.length) { console.error('no verdict — the page script never ran'); process.exit(1); }
    if (lines.some((l) => l.startsWith('FAIL'))) process.exit(1);
    console.log(`\n${lines.length} page checks passed`);
    process.exit(0);
  };
  const timer = setTimeout(() => done('', 'timed out waiting for the page'), 40000);
  finish = (v) => { clearTimeout(timer); done(v); };
});
