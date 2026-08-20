#!/usr/bin/env node
/* HER OWN WORDS BEHIND THE "?" — the deck's per-card `said` (Aug 2026,
 * Sophie, on the commercial survey: "everything I personally said about them
 * behind a question button").
 *
 *   node scripts/test-deck-said.js
 *
 * What it pins, driving the REAL renderTemplatePage + judge.js in headless
 * Chromium (skips with exit 0 if no Chromium):
 *   1. `said` survives validateTemplate, as [{when?, text}], HTML escaped
 *   2. a card carrying one wears a FILLED "?" — the only signal she has that
 *      there is anything of hers behind it
 *   3. tapping it leads with WHAT YOU SAID and her exact words
 *   4. a card carrying none shows the plain "?" and no WHAT YOU SAID block —
 *      the part is optional and absent silently, like every other one
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
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].filter(Boolean);
const chrome = CANDIDATES.find((p) => { try { fs.accessSync(p); return true; } catch (_) { return false; } })
  || (() => {
    try {
      const dir = '/opt/pw-browsers';
      const hit = fs.readdirSync(dir).find((d) => d.startsWith('chromium'));
      const p = hit && path.join(dir, hit, 'chrome-linux', 'chrome');
      if (p && fs.existsSync(p)) return p;
      const q = hit && path.join(dir, hit);
      return q && fs.existsSync(q) && fs.statSync(q).isFile() ? q : null;
    } catch (_) { return null; }
  })();

// ---- 1. the validator, pure -----------------------------------------------
const fails = [];
const ok = (cond, msg) => { console.log((cond ? 'PASS: ' : 'FAIL: ') + msg); if (!cond) fails.push(msg); };

const v = validateTemplate('deck', { items: [
  { id: 'a', label: 'With words', text: 'the concept',
    said: [{ when: 'Aug 18', text: 'I like the evaporation & night gallery' },
      'a bare string quote', { text: 'and <b>not markup</b> either' }] },
  { id: 'b', label: 'Without', text: 'no quotes on this one' },
  { id: 'c', label: 'Escaped', text: 'x', said: [{ text: '<b>not markup</b>' }] },
  { id: 'd', label: 'Empties dropped', text: 'x', said: [{ text: '' }, { when: 'x' }] },
] });
ok(v.ok, 'a deck carrying `said` validates');
const items = v.ok ? v.data.items : [];
ok(items[0] && items[0].said && items[0].said.length === 3, 'both quote shapes survive — {when,text} and a bare string');
ok(items[0] && items[0].said[0].when === 'Aug 18', 'the `when` is kept');
ok(items[0] && items[0].said[1] && !items[0].said[1].when && items[0].said[1].text === 'a bare string quote',
  'a bare string becomes {text} with no `when`');
ok(items[1] && !items[1].said, 'a card with no quotes carries no `said` at all');
ok(items[2] && items[2].said[0].text === '<b>not markup</b>', 'the raw text is stored verbatim (escaped at render)');
ok(items[3] && !items[3].said, 'quotes with no text are dropped, and an all-empty list leaves no field');

if (!chrome) {
  console.log('no Chromium found — skipping the page half (set CHROME_PATH to run)');
  process.exit(fails.length ? 1 : 0);
}

// ---- 2. the real page ------------------------------------------------------
const files = ['compare.css', 'compare.js', 'judge.js', 'grid.js', 'asset-lightbox.js',
  'asset-view.js', 'page-views.js'].reduce((m, f) => {
  m['/' + f] = [f.endsWith('.css') ? 'text/css' : 'application/javascript',
    fs.readFileSync(path.join(PUB, f), 'utf8')];
  return m;
}, {});

const SPY = `<script>
try{localStorage.setItem('cmp-tour-deck','1');}catch(_){}
window.addEventListener('error', function(e){
  fetch('/result?r=' + encodeURIComponent('FAIL: page error — ' + e.message), {});
});
</script>`;

const html = SPY + renderTemplatePage({
  id: 'said1', chat: 'test', title: 'Said test', template: 'deck', data: v.data,
}) + `<script>
(function(){
  var L = [];
  function say(c, m){ L.push((c?'PASS: ':'FAIL: ')+m); }
  function q(s){ return document.querySelector(s); }
  setTimeout(function(){
    var btn = q('.jg-momq');
    say(!!btn, 'the deck drew her chrome with a "?"');
    say(btn && btn.classList.contains('has'), 'card 1 carries her words — the "?" is filled');
    btn.click();
    setTimeout(function(){
      var card = q('.jg-help');
      var t = card ? card.textContent : '';
      say(/WHAT YOU SAID/.test(t), 'tapping it leads with WHAT YOU SAID');
      say(/I like the evaporation/.test(t), 'her exact words are there');
      say(/Aug 18/.test(t), 'and the date they came from');
      say(/a bare string quote/.test(t), 'the second quote is there too');
      // escaped, not parsed: the <b> from card 3 must never become an element
      // the quote holds a literal <b>; it must reach her as characters, never
      // as an element — one esc short and this is the check that catches it
      say(t.indexOf('and <b>not markup<' + '/b> either') > -1, 'a tag inside her words reads as characters');
      say(!q('.jg-said b'), 'her words render escaped, never as markup');
      say(/THE BUTTONS/.test(t), "the page's own key still follows underneath");
      card.click();                       // any tap closes
      setTimeout(function(){
        say(!q('.jg-help'), 'a tap closes it again');
        // move to the card with NO quotes: browse by tapping the right zone
        var zones = document.querySelectorAll('.jg-navzone');
        zones[zones.length-1].click();
        setTimeout(function(){
          var b2 = q('.jg-momq');
          say(b2 && !b2.classList.contains('has'), 'card 2 has none — the "?" is plain again');
          b2.click();
          setTimeout(function(){
            var t2 = q('.jg-help') ? q('.jg-help').textContent : '';
            say(!/WHAT YOU SAID/.test(t2), 'and its help card shows no WHAT YOU SAID block');
            say(/THE BUTTONS/.test(t2), 'but still explains the buttons');
            fetch('/result?r=' + encodeURIComponent(L.join(' | ')), {});
          }, 120);
        }, 200);
      }, 150);
    }, 200);
  }, 700);
})();
</script>`;

const server = http.createServer((req, res) => {
  const [route, qs] = req.url.split('?');
  if (route === '/result') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
    return finish(new URLSearchParams(qs).get('r') || '');
  }
  if (route.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"ok":true,"items":{},"texts":{},"assets":[],"notes":[]}');
  }
  const hit = files[route];
  if (hit) { res.writeHead(200, { 'Content-Type': hit[0] }); return res.end(hit[1]); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

let finish = () => {};
server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'said-'));
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
    const bad = fails.length + lines.filter((l) => l.startsWith('FAIL')).length;
    console.log(bad ? `\n${bad} failed` : `\nall ${lines.length + 7} checks passed`);
    process.exit(bad ? 1 : 0);
  };
  const timer = setTimeout(() => done('', 'timed out waiting for the page'), 30000);
  finish = (vd) => { clearTimeout(timer); done(vd); };
});
