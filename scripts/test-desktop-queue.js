#!/usr/bin/env node
/* test-desktop-queue.js — the desktop queue: the parser and the page.
 *
 *   node scripts/test-desktop-queue.js
 *
 * Two halves:
 *   1. the PURE half (desktop-parse.js) — pulling task blocks out of
 *      docs/desktop-tasks.md. It runs against a fixture AND against the REAL
 *      file in this checkout, because the entries are hand-written by whichever
 *      chat queued them and they always grow bullets the template never had; a
 *      parser that only survives its own fixture is worth nothing here. No
 *      express, no network: this half runs in any checkout.
 *   2. the PAGE (public/desktop.html) in headless Chromium against a stub
 *      /api/desktop/tasks — the tab counts, the hairline line landing under the
 *      lit tab (the bug that shipped for two days elsewhere), tap-to-expand,
 *      and the fenced command block rendering as a scrollable <pre> rather than
 *      pushing the page sideways. Skips cleanly with no Chromium.
 */
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const { parseTasks, section, field } = require(path.join(ROOT, 'desktop-parse'));

let n = 0;
const check = (label, fn) => { fn(); n++; console.log('  ok  ' + label); };

console.log('\nthe parser');

const FIXTURE = `# DESKTOP TASKS

## FOR A CLOUD CHAT ADDING ONE

### Template

\`\`\`
### <short title>
- **Queued:** YYYY-MM-DD by <chat slug>
\`\`\`

## OPEN

### Grab the new interviews
- **Why:** YouTube bot-blocks the cloud, so only this Mac can download them.
  Four are waiting.
- **Where:** ~/imageforge
- **Run:**
  \`\`\`bash
  cd ~/imageforge && ./scripts/grab
  \`\`\`
- **Needs from her:** paste the four links when it asks.
- **Queued:** 2026-08-19 by nde-supercuts

### Push the memos
- **Why:** the phone's recordings only exist on the Mac.
- **Run:**
  \`\`\`bash
  cd ~/imageforge && node scripts/push-memos.mjs
  \`\`\`
- **Needs from her:** nothing, it just runs.
- **Queued:** 2026-08-20 by voice-memos

- **FAILED 2026-08-21** (terminal chat): Full Disk Access is off for node.

---

## DONE

### Rebuild the search index
- **Why:** new memos landed.
- **Needs from her:** nothing.
- **Queued:** 2026-08-10 by search-index
- **DONE 2026-08-12** — ran clean, 1,137 records.
`;

const open = parseTasks(section(FIXTURE, 'OPEN'));
const done = parseTasks(section(FIXTURE, 'DONE'));

check('the OPEN section yields one task per ### heading', () => {
  assert.strictEqual(open.length, 2);
  assert.strictEqual(open[0].title, 'Grab the new interviews');
});
check('the TEMPLATE above OPEN is not read as a task', () => {
  // `### <short title>` lives inside a fence in an earlier section. Sectioning
  // by heading is what keeps it out; a whole-file scan would queue a phantom.
  assert.ok(!open.concat(done).some((t) => t.title.indexOf('<short title>') >= 0));
});
check('DONE is its own section', () => {
  assert.strictEqual(done.length, 1);
  assert.strictEqual(done[0].title, 'Rebuild the search index');
});
check('who queued it, and when', () => {
  assert.strictEqual(open[0].queued, '2026-08-19');
  assert.strictEqual(open[0].by, 'nde-supercuts');
});
check('a wrapped field is kept whole, not cut at the newline', () => {
  assert.ok(/Four are waiting/.test(field(section(FIXTURE, 'OPEN'), 'Why')));
});
check('a field stops at the next bullet', () => {
  assert.ok(!/Where/.test(open[0].why), open[0].why);
});
check('what it needs from her survives', () => {
  assert.ok(/paste the four links/.test(open[0].needs));
});
check('a FAILED note added by the terminal chat reaches the row', () => {
  assert.strictEqual(open[1].flag, 'failed');
  assert.strictEqual(open[0].flag, '', 'and a task nobody has tried carries none');
});
check('a finished task carries the date it ran', () => {
  assert.strictEqual(done[0].ranAt, '2026-08-12');
});
check('the whole entry rides along as body — nothing is dropped', () => {
  // The useful half of a real entry is the bullets the template never had.
  assert.ok(/Full Disk Access/.test(open[1].body));
  assert.ok(/```/.test(open[0].body), 'including its commands');
});
check('the trailing --- rule is not part of the last task', () => {
  assert.ok(!/---\s*$/.test(open[1].body));
});
check('a missing section is empty, not a crash', () => {
  assert.deepStrictEqual(parseTasks(section('# nothing here', 'OPEN')), []);
});

// ── against the REAL file, whatever it holds today ──────────────────────────
const REAL = fs.readFileSync(path.join(ROOT, 'docs/desktop-tasks.md'), 'utf8');
const realOpen = parseTasks(section(REAL, 'OPEN'));
const realDone = parseTasks(section(REAL, 'DONE'));
check('the real queue parses, and every task has a title', () => {
  realOpen.concat(realDone).forEach((t) => {
    assert.ok(t.title && t.title.length > 3, JSON.stringify(t.title));
    assert.ok(!/^\s*[-*]/.test(t.title), 'a bullet is not a title');
  });
});
check('every real task says when it was queued', () => {
  // The one field the page's closed row leans on. A chat that skips it makes a
  // row that reads as undated forever, so the test names it here.
  realOpen.concat(realDone).forEach((t) => {
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(t.queued), t.title + ' has no Queued: date');
  });
});

console.log(`\n${n} parser checks passed  (real queue: ${realOpen.length} open, ${realDone.length} done)`);

// ── the page ───────────────────────────────────────────────────────────────
const CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].filter(Boolean);
const chrome = CANDIDATES.find((p) => { try { fs.accessSync(p); return true; } catch (_) { return false; } })
  || (() => {
    try {
      const dirs = fs.readdirSync('/opt/pw-browsers');
      for (const d of dirs) {
        for (const rel of ['chrome-linux/chrome', 'chrome']) {
          const p = path.join('/opt/pw-browsers', d, rel);
          if (fs.existsSync(p)) return p;
        }
      }
      const flat = '/opt/pw-browsers/chromium';
      if (fs.existsSync(flat) && fs.statSync(flat).isFile()) return flat;
    } catch (_) {}
    return null;
  })();

if (!chrome) { console.log('\nno Chromium found — skipping the page half'); process.exit(0); }

const STUB = { ok: true, source: 'test', open: parseTasks(section(FIXTURE, 'OPEN')),
               done: parseTasks(section(FIXTURE, 'DONE')),
               file: 'https://example.invalid/desktop-tasks.md' };

const DRIVE = `
<script>
(function(){
  var L = [];
  function ok(c, m, got){ L.push((c ? 'ok  ' : 'FAIL ') + m + (c ? '' : '  got: ' + got)); }
  var send = window.fetch.bind(window);
  function rect(sel){ var e = document.querySelector(sel); return e && e.getBoundingClientRect(); }
  setTimeout(function(){
    var rows = document.querySelectorAll('.tk');
    ok(rows.length === 2, 'the waiting tab lists both open tasks', rows.length);
    ok(document.getElementById('n-open').textContent === '2', 'the tab carries the count', document.getElementById('n-open').textContent);
    ok(/Grab the new interviews/.test(rows[0].textContent), 'the title is the row', rows[0].textContent.slice(0,40));
    ok(/Aug 19/.test(rows[0].textContent), 'with the day it was queued', rows[0].textContent.slice(0,80));
    ok(/paste the four links/i.test(rows[0].textContent), 'an ask that is a real ask shows closed', rows[0].textContent.slice(0,120));
    ok(!/Needs you/.test(rows[1].textContent.split('failed')[0]) , '"nothing, it just runs" does not', rows[1].textContent.slice(0,120));
    ok(/failed/i.test(rows[1].textContent), 'a stuck task says so on the closed row', rows[1].textContent.slice(0,120));

    // the sliding line sits under the LIT tab, measured — never a tab count
    var tabs = rect('.acctabs'), lit = document.querySelector('.acctab.on').getBoundingClientRect();
    var cs = getComputedStyle(document.querySelector('.acctabs'));
    var tw = parseFloat(cs.getPropertyValue('--tw')), tx = parseFloat(cs.getPropertyValue('--tx'));
    ok(Math.abs(tw - lit.width) < 1.5, 'the hairline is exactly as wide as the lit tab', tw + ' vs ' + lit.width);
    ok(Math.abs((tabs.left + tx) - lit.left) < 1.5, 'and sits under it', (tabs.left + tx) + ' vs ' + lit.left);

    // detail is closed until tapped, and is a SIBLING of the row (not a child)
    var det = rows[0].nextElementSibling;
    ok(det && det.classList.contains('td'), 'the detail is the row\\'s sibling', det && det.className);
    ok(rows[0].querySelectorAll('button').length === 0, 'no button nests inside the row button', rows[0].innerHTML.slice(0,60));
    ok(det.hidden, 'it starts closed', det.hidden);
    rows[0].click();
    ok(!det.hidden, 'a tap opens it', det.hidden);
    ok(/scripts\\/grab/.test(det.textContent), 'the commands are in there', det.textContent.slice(0,80));
    var pre = det.querySelector('pre');
    ok(!!pre, 'the command block renders as a pre', det.innerHTML.slice(0,120));
    ok(pre && getComputedStyle(pre).overflowX === 'auto', 'which scrolls inside itself', pre && getComputedStyle(pre).overflowX);
    ok(document.documentElement.scrollWidth <= window.innerWidth + 1,
       'so the page itself never scrolls sideways', document.documentElement.scrollWidth + ' vs ' + window.innerWidth);
    ok(det.querySelectorAll('li').length >= 4, 'the bullets survive as a list', det.querySelectorAll('li').length);
    ok(/<b>/.test(det.innerHTML), 'and the bold labels with them', det.innerHTML.slice(0,60));
    rows[0].click();
    ok(det.hidden, 'a second tap closes it', det.hidden);

    // the DONE tab
    document.getElementById('tab-done').click();
    setTimeout(function(){
      var d = document.querySelectorAll('.tk');
      ok(d.length === 1, 'the done tab lists what was checked off', d.length);
      ok(/Ran Aug 12/.test(d[0].textContent), 'with the day it ran', d[0].textContent.slice(0,90));
      var lit2 = document.querySelector('.acctab.on');
      ok(lit2.id === 'tab-done', 'and the line follows the tap', lit2.id);
      var cs2 = getComputedStyle(document.querySelector('.acctabs'));
      var r2 = lit2.getBoundingClientRect(), t2 = rect('.acctabs');
      ok(Math.abs((t2.left + parseFloat(cs2.getPropertyValue('--tx'))) - r2.left) < 1.5,
         'landing under the done tab', cs2.getPropertyValue('--tx') + ' vs ' + (r2.left - t2.left));
      // nothing on this page writes: it is a view of a file edited elsewhere
      ok(document.querySelectorAll('input,textarea').length === 0, 'the page has no inputs — it is read-only', document.querySelectorAll('input,textarea').length);
      send('/result?r=' + encodeURIComponent(L.join(' | ')));
    }, 260);
  }, 500);
})();
</script>`;

const page = fs.readFileSync(path.join(ROOT, 'public/desktop.html'), 'utf8') + DRIVE;
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
  if (route === '/api/desktop/tasks') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(STUB));
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page);
});

console.log('\ndriving the page');
server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'desktopq-'));
  const kid = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu',
    '--window-size=390,844', '--user-data-dir=' + profile, url], { stdio: 'ignore' });

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
