#!/usr/bin/env node
// AN ITEM'S `footage` — the template card's door into the Footage page
// (2026-09-10, Sophie, on the Ticky Tack scene deck: "can u add a 'footage'
// button that sends those words to footage module").
//
// The hand-off is ONE localStorage key: the button writes `footage_handoff`
// and walks to /footage, which consumes it. So the only honest test lets the
// click NAVIGATE and reads the key from the far side — a source assertion
// cannot tell a button that writes the key from one that writes nothing, and
// a key written by a page that never walks is a door she cannot use.
//
// **THE RESULT IS BEACONED, NEVER DUMPED.** `--dump-dom` prints nothing at
// all when the page navigates away (measured — chromium exits with no
// output), so the far side POSTs what it found back to this server and node
// waits for it. Any test of a walk has the same problem and needs the same
// answer.
//
// What it pins:
//   • the button renders in BOTH views (a page carries the swipe and compare
//     halves over one item list — a field one renderer knows about disappears
//     when she switches) and a tap really reaches it (the deck's browse zones
//     are 26%-wide strips at z-index 2 and a centred control's ENDS reach
//     into them — the measured bug that made "this one" unreachable)
//   • a real click WRITES the key and LANDS on /footage carrying this card's
//     own words
//   • from inside an IFRAME the TOP window is what walks — the app runs a
//     template page in one, and our own `location` would load the Footage
//     page inside the page viewer
//   • a card with no `footage` draws no button, and a `footage` with no
//     prompt is dropped by the validator rather than rendered as a dead door
//
// Chromium is optional — this skips cleanly without it.
//
//   node scripts/test-template-footage.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFile } = require('child_process');
const { validateTemplate, renderTemplatePage } = require('../page-templates');

function exe() {
  for (const r of ['/opt/pw-browsers']) {
    let kids = [];
    try { kids = fs.readdirSync(r); } catch (e) { continue; }
    for (const k of kids.filter((n) => /^chromium-\d/.test(n))) {
      const p = path.join(r, k, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

let pass = 0; const fails = [];
function is(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass += 1; return; }
  fails.push(`${name}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`);
}
function ok(name, cond, extra) {
  if (cond) { pass += 1; return; }
  fails.push(`${name}${extra ? `\n    ${extra}` : ''}`);
}
function report() {
  if (fails.length) {
    console.log(`\ntemplate footage: ${pass} passed, ${fails.length} FAILED\n`);
    fails.forEach((f) => console.log('  ✗ ' + f));
  } else {
    console.log(`template footage: ${pass} checks passed`);
  }
}

const WORDS = 'She walks sideways down the aisle so the attendants will not see her.';
const REF = 'https://storage.googleapis.com/x/ref.png';
const DATA = {
  items: [
    {
      id: 'one',
      who: 'The Rite Aid',
      text: WORDS,
      footage: {
        prompt: WORDS,
        title: 'The Rite Aid',
        from: 'Ticky Tack',
        refs: [{ url: REF, kind: 'image' }, { url: 'javascript:alert(1)', kind: 'image' }],
      },
    },
    // no footage at all → no button
    { id: 'two', who: 'no door', text: 'nothing to hand off.' },
    // a footage block with no words is not a hand-off — dropped, not drawn
    { id: 'three', who: 'empty', text: 'still nothing.', footage: { title: 'x' } },
  ],
};

// ── the validator ────────────────────────────────────────────────────────
const v = validateTemplate('deck', DATA);
if (!v.ok) { console.error('fixture failed validation: ' + v.error); process.exit(1); }
const f0 = v.data.items[0].footage;
is('kept the prompt', f0.prompt, WORDS);
is('kept the title', f0.title, 'The Rite Aid');
is('kept the http ref', f0.refs.map((r) => r.url), [REF]);
is('kept the ref kind', f0.refs[0].kind, 'image');
is('no footage stays absent', v.data.items[1].footage, undefined);
is('a promptless footage is dropped', v.data.items[2].footage, undefined);

const CHROME = exe();
if (!CHROME) {
  report();
  console.log('template footage: browser half skipped (no chromium)');
  process.exit(fails.length ? 1 : 0);
}

// ── the page, and the /footage it lands on ───────────────────────────────
const page = renderTemplatePage({
  template: 'deck', title: 'footage test', chat: 'test-chat', sheet: 'footage-test', data: v.data,
});

// The far side of the walk. It reads the key exactly as public/footage.html
// does and BEACONS it back — the click has navigated, so there is no DOM left
// for --dump-dom to print. `frame` says whether the TOP window is what walked.
const FOOTAGE = `<!doctype html><title>footage</title><body>landed
<script>
  navigator.sendBeacon('/report', JSON.stringify({
    key: localStorage.getItem('footage_handoff'),
    frame: window.top === window.self ? 'top' : 'nested'
  }));
</script>`;

// A probe appended to the deck page: optionally switch to compare, then click
// the footage button for real. `?p=compare` picks which half is under test,
// because the click navigates and ends the run.
function probe(view) {
  return `
<script>
(function(){
  function live(){
    return Array.prototype.slice.call(document.querySelectorAll('#judge, #grid'))
      .filter(function(el){ return el.offsetParent !== null || el.getClientRects().length; })[0]
      || document.getElementById('pageviews');
  }
  function fire(){
    // the once-per-device coach-mark tour is a full-screen overlay on a first
    // visit and would eat the click. Not what is under test.
    Array.prototype.slice.call(document.querySelectorAll('.cmp-tour'))
      .forEach(function(e){ e.remove(); });
    var b = live().querySelector('[data-footage]');
    if (!b) { navigator.sendBeacon('/report', JSON.stringify({ key: null, frame: 'NOBUTTON' })); return; }
    b.click();
  }
  setTimeout(function(){
    ${view === 'compare' ? `
    var tab = Array.prototype.slice.call(document.querySelectorAll('button, a'))
      .filter(function(b){ return /compare/i.test(b.textContent || ''); })[0];
    if (tab) tab.click();
    setTimeout(fire, 500);` : 'fire();'}
  }, 800);
})();
</script>`;
}

// A COUNT probe that does NOT click — how many footage buttons each view
// draws and what a tap at the button's own centre really reaches.
const COUNT = `
<pre id="probe">pending</pre>
<script>
(function(){
  var out = [];
  function live(){
    return Array.prototype.slice.call(document.querySelectorAll('#judge, #grid'))
      .filter(function(el){ return el.offsetParent !== null || el.getClientRects().length; })[0]
      || document.getElementById('pageviews');
  }
  function look(view){
    Array.prototype.slice.call(document.querySelectorAll('.cmp-tour'))
      .forEach(function(e){ e.remove(); });
    var l = live();
    var b = l.querySelector('[data-footage]');
    out.push(view + ':buttons=' + l.querySelectorAll('[data-footage]').length);
    if (b) {
      var r = b.getBoundingClientRect();
      var hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
      var mine = hit && (hit === b || b.contains(hit)
        || (hit.closest && hit.closest('[data-footage]') === b));
      out.push(view + ':tap=' + (mine ? 'button'
        : 'BLOCKED-by-' + (hit ? (hit.className || hit.tagName) : 'nothing')));
      out.push(view + ':id=' + b.getAttribute('data-footage'));
    }
  }
  setTimeout(function(){
    look('swipe');
    var tab = Array.prototype.slice.call(document.querySelectorAll('button, a'))
      .filter(function(b){ return /compare/i.test(b.textContent || ''); })[0];
    if (!tab) { out.push('compare:no-switch'); return done(); }
    tab.click();
    setTimeout(function(){ look('compare'); done(); }, 500);
  }, 800);
  function done(){ document.getElementById('probe').textContent = out.join('\\n'); }
})();
</script>`;

// THE APP'S PAGE VIEWER — the page inside a same-origin IFRAME. The walk must
// move the TOP window, so the far side reports `frame:'top'`; a page that
// walked only itself lands nested and says so.
const HOST = '<!doctype html><title>host</title>'
  + '<iframe id="f" src="/?p=swipe" style="width:390px;height:700px"></iframe>';

const pub = path.join(__dirname, '..', 'public');
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
let onReport = null;
const server = http.createServer((req, res) => {
  const [url, qs] = req.url.split('?');
  if (url === '/report') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.end('ok');
      if (onReport) { const f = onReport; onReport = null; f(body); }
    });
    return undefined;
  }
  const q = new URLSearchParams(qs || '');
  if (url === '/') {
    res.setHeader('content-type', 'text/html');
    const p = q.get('p');
    return res.end(page + (p ? probe(p) : COUNT));
  }
  if (url === '/footage') { res.setHeader('content-type', 'text/html'); return res.end(FOOTAGE); }
  if (url === '/host') { res.setHeader('content-type', 'text/html'); return res.end(HOST); }
  const f = path.join(pub, url.replace(/^\/+/, ''));
  if (!f.startsWith(pub) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.statusCode = 404; return res.end('no');
  }
  res.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream');
  return res.end(fs.readFileSync(f));
});

function chrome(url, profile, extra) {
  return new Promise((resolve) => {
    execFile(CHROME, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      // --no-proxy-server is load-bearing: the sandbox exports HTTPS_PROXY and
      // chromium would send even 127.0.0.1 through it and hang. The resolver
      // rule fails the Google Fonts fetch instantly instead of hanging on it.
      '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
      `--user-data-dir=${profile}`,
      '--window-size=390,844', `--virtual-time-budget=${extra || 9000}`,
      '--dump-dom', url,
    ], { encoding: 'utf8', timeout: 90000, maxBuffer: 32 * 1024 * 1024 },
    (err, stdout) => resolve(stdout || ''));
  });
}

// A run that ends in a walk prints nothing, so the BEACON is the answer and
// the browser is only the thing that produces it.
function walk(url, profile) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (b) => { if (!done) { done = true; resolve(b); } };
    onReport = finish;
    chrome(url, profile).then(() => setTimeout(() => finish(''), 200));
  });
}

const tmp = fs.mkdtempSync('/tmp/tfoot-');
server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const at = (p) => `http://127.0.0.1:${port}${p}`;

  // 1) the button, in both views, with the tap really reaching it
  const dom = await chrome(at('/'), path.join(tmp, 'a'));
  const probeText = (dom.match(/<pre id="probe">([\s\S]*?)<\/pre>/) || [])[1] || '';
  const lines = probeText.split('\n').map((s) => s.trim()).filter(Boolean);
  const get = (k) => (lines.find((l) => l.startsWith(k)) || '').split('=').slice(1).join('=');
  is('swipe draws exactly one footage button', get('swipe:buttons'), '1');
  is('the swipe tap reaches the button', get('swipe:tap'), 'button');
  is('it is the card that has one', get('swipe:id'), 'one');
  is('compare draws exactly one footage button', get('compare:buttons'), '1');
  is('the compare tap reaches the button', get('compare:tap'), 'button');

  // 2) the click from the SWIPE view: it writes the key and lands on /footage
  const r1 = JSON.parse((await walk(at('/?p=swipe'), path.join(tmp, 'b'))) || '{}');
  ok('the swipe click landed on /footage', !!r1.key, `report: ${JSON.stringify(r1)}`);
  let hand = null;
  try { hand = JSON.parse(r1.key); } catch (e) { /* reported above */ }
  is('the hand-off carries this card\'s words', hand && hand.prompt, WORDS);
  is('…and its title', hand && hand.title, 'The Rite Aid');
  is('…and only the http reference', hand && (hand.refs || []).map((r) => r.url), [REF]);
  ok('…and a fresh timestamp', hand && Math.abs(Date.now() - hand.at) < 300000,
    `at: ${hand && hand.at}`);
  is('it names no model', hand && hand.model, undefined);
  is('it names no seconds', hand && hand.seconds, undefined);

  // 3) the same click from the COMPARE view
  const r2 = JSON.parse((await walk(at('/?p=compare'), path.join(tmp, 'c'))) || '{}');
  ok('the compare click landed on /footage too', !!r2.key, `report: ${JSON.stringify(r2)}`);
  let hand2 = null;
  try { hand2 = JSON.parse(r2.key); } catch (e) { /* reported above */ }
  is('…with the same words', hand2 && hand2.prompt, WORDS);

  // 4) inside an IFRAME the TOP window is what walks
  const r3 = JSON.parse((await walk(at('/host'), path.join(tmp, 'd'))) || '{}');
  is('the walk moved the TOP window out of the viewer', r3.frame, 'top');

  server.close();
  report();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  process.exit(fails.length ? 1 : 0);
});
