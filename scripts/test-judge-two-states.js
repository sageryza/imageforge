#!/usr/bin/env node
// TWO OPPOSING STATE CHIPS SIT AT OPPOSITE ENDS (2026-08-27, Sophie, asking
// for an Archive/Keep triage deck: "don't put the archive and not archive
// button too close together").
//
// A deck with exactly TWO custom states is a yes and a no, and the old row
// centred them 18px apart — a mis-tap waiting to happen on the two words with
// opposite consequences. They spread to the row's ends now (the shape her ✕
// and ♥ already make); three or more states keep the centred row, because
// they read as a scale, not as opposites.
//
// Measured on the REAL rendered template page in headless Chromium — a class
// assertion cannot see where two buttons actually sit.
//
//   node scripts/test-judge-two-states.js   (skips cleanly without chromium)

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
if (!CHROME) { console.log('judge two states: skipped (no chromium)'); process.exit(0); }

let pass = 0; const fails = [];
function is(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass += 1; return; }
  fails.push(`${name}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`);
}

function pageFor(states, sheet) {
  const v = validateTemplate('deck', {
    items: [{ id: 'one', who: 'a chat', text: 'what it was about.',
      sections: [{ label: 'Open', text: 'nothing' }] }],
    states, browse: true,
  });
  if (!v.ok) { console.error('fixture failed validation: ' + v.error); process.exit(1); }
  return renderTemplatePage({ template: 'deck', title: 't', chat: 'test-chat', sheet, data: v.data });
}

// The probe measures the two chips' real boxes against the row's: spread =
// first chip starts at the row's left inset, last ends at its right inset,
// and the gap between them is most of the row. Three chips must stay centred.
const PROBE = `
<pre id="probe">pending</pre>
<script>
(function(){
  setTimeout(function(){
    var out = [];
    Array.prototype.slice.call(document.querySelectorAll('.cmp-tour'))
      .forEach(function(e){ e.remove(); });
    var row = document.querySelector('.jg-row');
    var chips = row ? row.querySelectorAll('.jg-chip') : [];
    if (!row || !chips.length) { out.push('none'); }
    else {
      var r = row.getBoundingClientRect();
      var a = chips[0].getBoundingClientRect();
      var b = chips[chips.length - 1].getBoundingClientRect();
      out.push('n=' + chips.length);
      out.push('gap=' + Math.round(b.left - a.right));
      out.push('leftinset=' + Math.round(a.left - r.left));
      out.push('rightinset=' + Math.round(r.right - b.right));
    }
    document.getElementById('probe').textContent = out.join('\\n');
  }, 600);
})();
</script>`;

const pub = path.join(__dirname, '..', 'public');
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const PAGES = {
  '/two': pageFor([{ key: 'archive', label: 'Archive' }, { key: 'keep', label: 'Keep' }], 'two') + PROBE,
  '/three': pageFor([{ key: 'a', label: 'one' }, { key: 'b', label: 'two' }, { key: 'c', label: 'three' }], 'three') + PROBE,
};
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (PAGES[url]) { res.setHeader('content-type', 'text/html'); return res.end(PAGES[url]); }
  const f = path.join(pub, url.replace(/^\/+/, ''));
  if (!f.startsWith(pub) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.statusCode = 404; return res.end('no');
  }
  res.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream');
  return res.end(fs.readFileSync(f));
});

function run(pathName) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    execFile(CHROME, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
      '--window-size=390,844', '--virtual-time-budget=6000',
      '--dump-dom', `http://127.0.0.1:${port}${pathName}`,
    ], { encoding: 'utf8', timeout: 90000, maxBuffer: 32 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) return reject(new Error('chromium failed: ' + err.message));
      const m = /<pre id="probe">([\s\S]*?)<\/pre>/.exec(stdout);
      const report = (m ? m[1] : '').trim();
      const line = (k) => (report.split('\n').find((l) => l.startsWith(k)) || '').slice(k.length);
      resolve({ report, n: +line('n='), gap: +line('gap='), left: +line('leftinset='), right: +line('rightinset=') });
    });
  });
}

server.listen(0, '127.0.0.1', async () => {
  try {
    const two = await run('/two');
    is('two chips render', two.n, 2);
    // spread: the chips hug the row's ends (12px inset), so the space between
    // them is most of a 390px screen — never the old 18px huddle
    is('two chips are NOT huddled together', two.gap > 120, true);
    is('the first hugs the left end', two.left <= 20, true);
    is('the second hugs the right end', two.right <= 20, true);
    const three = await run('/three');
    is('three chips render', three.n, 3);
    // three or more keep the centred row — insets stay wide, gaps stay small
    is('three chips stay centred (small gaps)', three.gap < 120, true);
    is('three chips stay centred (wide insets)', three.left > 30, true);
  } catch (e) {
    fails.push(String(e.message || e));
  }
  server.close();
  fails.forEach((f) => console.log('FAIL: ' + f));
  console.log(`${pass} checks passed, ${fails.length} failed`);
  if (fails.length) process.exit(1);
});
