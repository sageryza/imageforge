#!/usr/bin/env node
// An item's `link` — the template card's way OUT (Aug 2026, Sophie: "put them
// in the compare tab with a link back to the chat"), rendered for real in
// headless Chromium against a live-served stock template page.
//
// What it pins, and why each one is here rather than in the pure test:
//   • the link renders as a REAL anchor in BOTH views — a page carries the
//     swipe and compare halves over one item list, so a field that only one
//     renderer knows about disappears when she switches
//   • THE TAP REACHES IT. The deck's browse zones are 26%-wide strips at
//     z-index 2 and a centred control's ENDS reach into them — the measured
//     bug that made the two-up spread's "this one" buttons unreachable. The
//     only honest test is elementFromPoint at the anchor's own centre: the
//     element is "visible" either way, and the question is what the tap hits.
//   • a refused scheme leaves NO anchor behind (the validator drops it, so
//     nothing renders it as a tappable element with a harmless-looking href)
//
// Chromium is optional — this skips cleanly without it.
//
//   node scripts/test-template-link.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFile } = require('child_process');
const { validateTemplate, renderTemplatePage } = require('../page-templates');

function exe() {
  const roots = ['/opt/pw-browsers'];
  for (const r of roots) {
    let kids = [];
    try { kids = fs.readdirSync(r); } catch (e) { continue; }
    for (const k of kids.filter((n) => /^chromium-\d/.test(n))) {
      const p = path.join(r, k, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

const CHROME = exe();
if (!CHROME) { console.log('template link: skipped (no chromium)'); process.exit(0); }

let pass = 0; const fails = [];
function is(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass += 1; return; }
  fails.push(`${name}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`);
}

const CHAT_LINK = 'https://imageforge-q125.onrender.com/chats?chat=dating-book';
const DATA = {
  items: [
    {
      id: 'one',
      who: 'dating book',
      eyebrow: 'quiet 35 days',
      text: 'Built the Chats feed app end-to-end.',
      link: { url: CHAT_LINK, label: 'Open the chat' },
    },
    // the refused scheme: the validator drops it, so the card must carry no
    // anchor at all — not an escaped one that is still tappable
    { id: 'two', who: 'no link', text: 'nothing to open.', link: 'javascript:alert(1)' },
  ],
};

const v = validateTemplate('deck', DATA);
if (!v.ok) { console.error('fixture failed validation: ' + v.error); process.exit(1); }
is('validator kept the good link', v.data.items[0].link.url, CHAT_LINK);
is('validator dropped the bad scheme', v.data.items[1].link, undefined);

// THE PROBE — appended to the served page. It reports what a tap at each
// anchor's own centre actually reaches, in both views, into a <pre> the DOM
// dump can read. Everything is written into the document because --dump-dom
// is the only channel out of this browser.
const PROBE = `
<pre id="probe">pending</pre>
<script>
(function(){
  var out = [];
  function look(view){
    // the once-per-device coach-mark tour is a full-screen overlay on a first
    // visit and would answer every hit test. Not what is under test.
    Array.prototype.slice.call(document.querySelectorAll('.cmp-tour'))
      .forEach(function(e){ e.remove(); });
    // the page holds BOTH mounts at once, so scope to the one on screen or
    // the hidden view's copy of the link is counted too
    var live = Array.prototype.slice.call(document.querySelectorAll('#judge, #grid'))
      .filter(function(el){ return el.offsetParent !== null || el.getClientRects().length; })[0]
      || document.getElementById('pageviews');
    var a = live.querySelector('a[href*="chats?chat="]');
    if (!a) { out.push(view + ':none'); return; }
    var r = a.getBoundingClientRect();
    var hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
    // what the tap lands on must be the anchor itself, or something inside it
    var mine = hit && (hit === a || a.contains(hit) || (hit.closest && hit.closest('a') === a));
    out.push(view + ':' + (mine ? 'anchor' : 'BLOCKED-by-' + (hit ? (hit.className || hit.tagName) : 'nothing')));
    out.push(view + ':href=' + a.getAttribute('href'));
    out.push(view + ':text=' + a.textContent.trim());
    // and the card with no link must have produced no anchor of its own
    out.push(view + ':anchors=' + live.querySelectorAll('.jg-momlink a, .gd-link a').length);
  }
  function go(){
    look('swipe');
    // the COMPARE half of the same page, over the same item list
    var tab = Array.prototype.slice.call(document.querySelectorAll('button, a'))
      .filter(function(b){ return /compare/i.test(b.textContent || ''); })[0];
    if (!tab) { out.push('compare:no-switch'); done(); return; }
    tab.click();
    setTimeout(function(){ look('compare'); done(); }, 400);
  }
  function done(){ document.getElementById('probe').textContent = out.join('\\n'); }
  setTimeout(go, 600);
})();
</script>`;

const page = renderTemplatePage({
  template: 'deck', title: 'link test', chat: 'test-chat', sheet: 'link-test', data: v.data,
}) + PROBE;


// THE APP'S PAGE VIEWER (2026-09-02, Sophie on the archive deck: "the chat
// links don't work"). Inside the Chats app a template page runs in a
// same-origin IFRAME, its link is target=_blank, and the viewer's own click
// interceptor leaves _blank links alone — so a tap reached nothing. This host
// is that viewer reduced to the one thing the page needs from it: the
// __openThread bridge, recording what the page hands it. A real click is
// dispatched on the anchor in BOTH views and the host reads back which chat
// arrived and whether the default (a new tab) was cancelled.
const HOST = `<!doctype html><pre id="hostprobe">pending</pre>
<iframe id="f" src="/" style="width:390px;height:700px"></iframe>
<script>
(function(){
  var out = [];
  window.__openThread = function (name) { out.push('opened=' + name); return name === 'dating-book'; };
  var f = document.getElementById('f');
  function anchorIn(doc){
    var live = Array.prototype.slice.call(doc.querySelectorAll('#judge, #grid'))
      .filter(function(el){ return el.offsetParent !== null || el.getClientRects().length; })[0];
    return live && live.querySelector('.jg-momlink a, .gd-link a');
  }
  function tap(doc, view){
    var a = anchorIn(doc);
    if (!a) { out.push(view + ':none'); return; }
    var ev = new doc.defaultView.MouseEvent('click', { bubbles: true, cancelable: true, view: doc.defaultView });
    var went = a.dispatchEvent(ev);
    out.push(view + ':default=' + (went ? 'followed' : 'cancelled'));
  }
  f.addEventListener('load', function(){
    setTimeout(function(){
      var doc = f.contentDocument;
      tap(doc, 'swipe');
      var tab = Array.prototype.slice.call(doc.querySelectorAll('button'))
        .filter(function(b){ return /compare/i.test(b.textContent || ''); })[0];
      if (tab) tab.click();
      setTimeout(function(){
        tap(doc, 'compare');
        document.getElementById('hostprobe').textContent = out.join('\\n');
      }, 400);
    }, 900);
  });
})();
</script>`;

const pub = path.join(__dirname, '..', 'public');
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/') { res.setHeader('content-type', 'text/html'); return res.end(page); }
  if (url === '/host') { res.setHeader('content-type', 'text/html'); return res.end(HOST); }
  const f = path.join(pub, url.replace(/^\/+/, ''));
  if (!f.startsWith(pub) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.statusCode = 404; return res.end('no');
  }
  res.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream');
  return res.end(fs.readFileSync(f));
});

// Chromium must be spawned ASYNCHRONOUSLY: the page it is fetching is served
// by this very process, so a synchronous spawn blocks the event loop and the
// request is never answered — the browser then hangs until its own timeout.
server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  execFile(CHROME, [
      // --no-proxy-server is load-bearing here: the sandbox exports
      // HTTPS_PROXY, and without this Chromium sends even 127.0.0.1 through
      // it and hangs until the timeout kills the run
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      // …and judge.js pulls Newsreader from Google Fonts, which cannot resolve
      // in here: left to hang it eats the whole virtual-time budget. Refusing
      // every host but the local one fails those requests instantly instead.
      '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
      '--window-size=390,844', '--virtual-time-budget=6000',
    '--dump-dom', `http://127.0.0.1:${port}/`,
  ], { encoding: 'utf8', timeout: 90000, maxBuffer: 32 * 1024 * 1024 }, (err, stdout) => {
    if (err && !stdout) {
      server.close();
      console.error('chromium failed: ' + err.message);
      process.exit(1);
    }
    check(stdout);
    execFile(CHROME, [
        '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
        '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
        '--window-size=390,844', '--virtual-time-budget=8000',
      '--dump-dom', `http://127.0.0.1:${port}/host`,
    ], { encoding: 'utf8', timeout: 90000, maxBuffer: 32 * 1024 * 1024 }, (err2, dom2) => {
      server.close();
      if (err2 && !dom2) { console.error('chromium failed (host): ' + err2.message); process.exit(1); }
      checkHost(dom2);
    });
  });
});

function checkHost(dom) {
  const m = /<pre id="hostprobe">([\s\S]*?)<\/pre>/.exec(dom);
  const report = m ? m[1].trim() : '(no probe)';
  const lines = report.split('\n');
  const has = (k) => lines.filter((l) => l === k).length;
  is('in the app: the swipe card hands the chat to __openThread', has('opened=dating-book') >= 1, true);
  is('in the app: the swipe tap is cancelled (no new tab)', lines.includes('swipe:default=cancelled'), true);
  is('in the app: the compare tile hands the chat over too', has('opened=dating-book'), 2);
  is('in the app: the compare tap is cancelled as well', lines.includes('compare:default=cancelled'), true);
  fails.forEach((f) => console.log('FAIL: ' + f));
  console.log(`${pass} checks passed, ${fails.length} failed`);
  if (fails.length) { console.log('\nhost probe said:\n' + report); process.exit(1); }
}

function check(dom) {
  const m = /<pre id="probe">([\s\S]*?)<\/pre>/.exec(dom);
  const report = m ? m[1].replace(/&amp;/g, '&').trim() : '(no probe)';
  const line = (k) => (report.split('\n').find((l) => l.startsWith(k)) || '').slice(k.length);

  is('swipe: the tap reaches the anchor, not a browse zone', line('swipe:'), 'anchor');
  is('swipe: the href is the chat, unmangled', line('swipe:href='), CHAT_LINK);
  is('swipe: the label reads, not the url', line('swipe:text=').replace(/\s+/g, ' '), 'Open the chat ›');
  // one card links and one does not — the refused scheme left nothing behind
  is('swipe: exactly one anchor across the deck', line('swipe:anchors='), '1');
  is('compare: the same link survives the view switch', line('compare:href='), CHAT_LINK);
  is('compare: the tap reaches it there too', line('compare:'), 'anchor');
  if (fails.length) { fails.forEach((f) => console.log('FAIL: ' + f)); console.log('\nprobe said:\n' + report); process.exit(1); }
}
