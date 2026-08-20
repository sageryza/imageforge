#!/usr/bin/env node
// A DECK OPENED FROM THE COMPARE TAB — no viewer bar, its own way back (Aug
// 2026, Sophie: "the very top part of the compare tab with the back arrow
// which has the name … give me the option of going back to the compare tab
// cause that takes a room in the top").
//
// This drives the real judge.js inside a real same-origin iframe, the way
// chats.html's openPage runs it, and pins three things:
//
//   1. `?back=1` draws the chevron in the deck's OWN top row — the row that
//      already holds the progress line and Piles — so the way back costs no
//      vertical space. Without the bar the deck gets the whole frame.
//   2. Tapping it calls the PARENT's __closePage rather than history.back(),
//      which inside an iframe would only navigate the frame and leave the app
//      looking at whatever the deck replaced.
//   3. THE VERDICT CHIPS STAY REACHABLE WHEN THE BOX IS SHORT. This is the
//      bug she actually hit: a deck carrying its own `states` has momUI false,
//      so its card never got the `momcard` class — and the one-screen flex
//      chain named that class, so the card sized to its CONTENT, overflowed
//      the wrapper and painted over the verdict row. The chips were on screen
//      and covered: they looked tappable and were not. Measured before the
//      fix: fine at 640px of height, BLOCKED at 600px — and the bar is what
//      carried an iPhone 13 across that line.
//
// elementFromPoint at the control's own centre is the only honest check —
// the element is "visible" either way, and the question is what a tap reaches.
//
// Chromium is optional — this skips cleanly without it.
//
//   node scripts/test-deck-embed-back.js

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
const CHROME = exe();
if (!CHROME) { console.log('deck embed back: skipped (no chromium)'); process.exit(0); }

let pass = 0; const fails = [];
function is(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass += 1; return; }
  fails.push(`${name}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`);
}

// A card with enough on it to overflow a short box — the shape her sweep had:
// a name, a quiet-for line, the one-line summary and a loose end under it.
const LONG = 'Whisper voice-memo transcription shipped to the dream pipeline, '
  + 'and the face-locking recipe was validated on three separate dreams.';
const OPEN = 'Never got the gallery id needed to post the three validated '
  + 'dreams, so they were built and then never filed anywhere she could see them.';
const items = Array.from({ length: 4 }, (_, i) => ({
  id: `c${i + 1}`,
  who: `chat number ${i + 1}`,
  eyebrow: 'quiet 24 days · 30 messages',
  text: LONG,
  sections: [{ label: 'Left open', text: OPEN }],
}));
const v = validateTemplate('deck', {
  items,
  states: [{ key: 'archive', label: 'Archive' }, { key: 'keep', label: 'Keep' }],
});
if (!v.ok) { console.error('fixture invalid: ' + v.error); process.exit(1); }
const deck = renderTemplatePage({
  template: 'deck', title: 'sweep', chat: 'c', sheet: 'page-x', data: v.data,
});

// The host stands in for chats.html's page viewer: NO .pv-bar (that is the
// change), the iframe taking the whole box, and the __closePage hook the
// page's chevron is supposed to find.
const HOST = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;height:100%}
.pageview{position:fixed;inset:0;display:flex;flex-direction:column}
.pv-frame{flex:1;width:100%;border:none}</style>
<div class="pageview"><iframe class="pv-frame" src="/deck?embed=1&back=1"></iframe></div>
<pre id="probe">pending</pre>
<script>
// NB: never name this variable 'closed' — window.closed is a read-only
// built-in, so the assignment silently does nothing.
var closeCalls = 0;
window.__closePage = function(){ closeCalls += 1; return true; };
(function(){
  var out = [];
  function done(){ document.getElementById('probe').textContent = out.join('\\n'); }
  window.onerror = function(m){ out.push('ERR ' + m); done(); };
  var fr = document.querySelector('.pv-frame');
  fr.addEventListener('load', function(){
    setTimeout(function(){
      try { run(); } catch (e) { out.push('THROW ' + e.message); done(); }
    }, 500);
  });
  function run(){
    var w = fr.contentWindow, d = fr.contentDocument;
    Array.prototype.slice.call(d.querySelectorAll('.cmp-tour')).forEach(function(e){ e.remove(); });
    out.push('frameH=' + w.innerHeight);
    out.push('hostH=' + window.innerHeight);
    // the chevron lives in the deck's OWN top row, not in a bar of ours
    var back = d.querySelector('.jg-back');
    out.push('back=' + (back ? 'yes' : 'no'));
    out.push('backInTopRow=' + (back && back.closest('.jg-momtop') ? 'yes' : 'no'));
    // …and every verdict chip must be reachable, on every card
    var bad = [];
    for (var i = 0; i < 4; i++) {
      var chip = d.querySelector('.jg-chip');
      if (!chip) { bad.push('card' + i + ':absent'); }
      else {
        var b = chip.getBoundingClientRect();
        var hit = d.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        var mine = hit && (hit === chip || chip.contains(hit)
          || (hit.closest && hit.closest('.jg-chip') === chip));
        var vis = b.top >= 0 && b.bottom <= w.innerHeight;
        if (!mine || !vis) {
          bad.push('card' + i + ':' + (vis ? '' : 'offscreen') + (mine ? '' : 'covered-by-'
            + (hit ? (hit.className || hit.tagName) : 'nothing')));
        }
      }
      var nx = d.querySelector('.jg-navzone.next');
      if (nx) nx.click();
    }
    out.push('chipsUnreachable=' + (bad.length ? bad.join(',') : 'none'));
    // the chevron asks the PARENT to close. Re-query it: judge.js rewrites
    // the whole mount on every card, so the node captured before the paging
    // above is detached and its click reaches no handler.
    var backNow = d.querySelector('.jg-back');
    out.push('backAfterPaging=' + (backNow ? 'yes' : 'no'));
    if (backNow) backNow.click();
    setTimeout(function(){ out.push('closedCalls=' + closeCalls); done(); }, 250);
  }
})();
</script>`;

const pub = path.join(__dirname, '..', 'public');
const TYPES = { '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/') { res.setHeader('content-type', 'text/html'); return res.end(HOST); }
  if (url === '/deck') { res.setHeader('content-type', 'text/html'); return res.end(deck); }
  const f = path.join(pub, url.replace(/^\/+/, ''));
  if (!f.startsWith(pub) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.statusCode = 404; return res.end('no');
  }
  res.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream');
  return res.end(fs.readFileSync(f));
});

// 600px is the height the chips were measured BLOCKED at before the fix — the
// short box an iPhone 13 is left with once a viewer bar has taken its cut.
const H = Number(process.env.DECK_H || 600);
server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  execFile(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    // the sandbox exports HTTPS_PROXY (127.0.0.1 would go through it and hang),
    // and judge.js pulls Newsreader from Google Fonts, which cannot resolve here
    '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    `--window-size=390,${H}`, '--virtual-time-budget=20000',
    '--dump-dom', `http://127.0.0.1:${port}/`,
  ], { encoding: 'utf8', timeout: 90000, maxBuffer: 32 * 1024 * 1024 }, (err, stdout) => {
    server.close();
    if (err && !stdout) { console.error('chromium failed: ' + err.message); process.exit(1); }
    const m = /<pre id="probe">([\s\S]*?)<\/pre>/.exec(stdout || '');
    const report = m ? m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : '(no probe)';
    const line = (k) => (report.split('\n').find((l) => l.startsWith(k)) || '').slice(k.length);

    // no bar means the deck gets the whole frame
    is('the deck fills the viewer — no bar took a cut',
      line('frameH='), line('hostH='));
    is('?back=1 draws the chevron', line('back='), 'yes');
    is('…in the deck\'s own top row, so it costs no height', line('backInTopRow='), 'yes');
    is('the chips are reachable on every card in a short box', line('chipsUnreachable='), 'none');
    is('the chevron asks the parent viewer to close', line('closedCalls='), '1');

    fails.forEach((f) => console.log('FAIL: ' + f));
    console.log(`${pass} checks passed, ${fails.length} failed  (height ${H})`);
    if (fails.length) { console.log('\nprobe said:\n' + report); process.exit(1); }
  });
});
