#!/usr/bin/env node
/* TRY AGAIN ON A FAILED FREEFORM RUN — headless, against the real
   public/freeform.html (2026-08-28, Sophie asked for it after a square run was
   orphaned by a deploy and spun for two hours).

   The copy button puts a prompt back in the BOX, where she can change it
   first; this one re-sends the SAME request, for the case where nothing was
   wrong with it — which is exactly the orphaned run. So what is measured here
   is the BODY that reaches POST /run, not that a button exists: the whole
   value is that it carries the run's OWN quality, size, outputs, boiler and
   references rather than whatever the controls on screen happen to say.

   Run: node scripts/test-freeform-retry.js */
const fs = require('fs');
const path = require('path');
const http = require('http');

const PUB = path.join(__dirname, '..', 'public');
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('freeform retry: playwright not installed — skipped');
    process.exit(0);
  }
}
function exe() {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  for (const d of fs.readdirSync(root).filter((n) => /^chromium-\d/.test(n))) {
    const p = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const fails = []; let pass = 0;
const ok = (what, cond, extra) => { if (cond) pass += 1; else fails.push(what + (extra ? ' — ' + extra : '')); };

const REFS = [
  { id: 'refA', url: 'http://x/a.png' },
  { id: 'refB', url: 'http://x/b.png' },
];
// The failed run is deliberately UNLIKE the page's defaults on every field:
// low (default medium), square (default portrait), 2 outputs (default 1),
// boiler on (default off). A retry that read the controls would send the
// defaults, and every one of those differences is what catches it.
const FAILED = {
  id: 'stuck1',
  prompt: 'two little girls dumping chemicals in the bath',
  quality: 'low', size: '1024x1024', outputs: 2, boiler: true,
  status: 'failed', error: 'interrupted — the server restarted mid-draw',
  images: [], refs: ['http://x/a.png', 'http://x/b.png'], refIds: ['refA', 'refB'],
};
// One reference has since left the library, so its id is gone while the
// picture is still in Storage: the retry must send the URLs rather than
// quietly drawing one reference short.
const GONE = Object.assign({}, FAILED, { id: 'stuck2', refIds: ['refA'] });
const DONE = { id: 'ok1', prompt: 'a finished run', quality: 'medium', size: '1024x1536',
  outputs: 1, status: 'done', images: ['http://x/out.webp'], refs: [], refIds: [] };

const posted = [];
function serve() {
  return http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const json = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
    if (p === '/freeform') {
      const h = fs.readFileSync(path.join(PUB, 'freeform.html'), 'utf8').replace('__STUDIO_TOKEN__', '');
      res.setHeader('content-type', 'text/html'); return res.end(h);
    }
    if (p === '/api/freeform/refs') return json({ ok: true, refs: REFS });
    if (p === '/api/freeform/runs') return json({ ok: true, runs: [DONE, GONE, FAILED] });
    if (p === '/api/freeform/style') return json({ ok: true, style: { from: 'Sandy mirror', prefix: 'P', suffix: 'S' } });
    if (p === '/api/freeform/run' && req.method === 'POST') {
      let b = '';
      req.on('data', (c) => { b += c; });
      req.on('end', () => { posted.push(JSON.parse(b || '{}')); json({ ok: true, id: 'new' + posted.length, status: 'drawing' }); });
      return;
    }
    if (p.startsWith('/api/freeform/run/')) return json({ ok: true, id: p.split('/').pop(), status: 'drawing', images: [] });
    const f = path.join(PUB, p);
    if (f.startsWith(PUB) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.setHeader('content-type', path.extname(f) === '.js' ? 'text/javascript' : 'text/css');
      return res.end(fs.readFileSync(f));
    }
    res.statusCode = 404; res.end('{}');
  });
}

(async () => {
  const srv = serve();
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const browser = await chromium.launch(exe() ? { executablePath: exe() } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  await pg.goto('http://127.0.0.1:' + port + '/freeform', { waitUntil: 'load' });
  await pg.waitForTimeout(400);

  ok('a failed run offers Try again', await pg.locator('#run-stuck1 .again').count() === 1);
  ok('a finished run does NOT', await pg.locator('#run-ok1 .again').count() === 0);
  // The whole point is a tap with nothing typed and nothing picked.
  ok('the prompt box is empty and no reference is picked',
    await pg.evaluate(() => !document.getElementById('prompt').value
      && !document.querySelectorAll('.ref.on').length));

  // ── the retry sends the RUN's own request, not the controls' ──
  await pg.click('#run-stuck1 .again');
  await pg.waitForTimeout(300);
  const b = posted[0] || {};
  ok('it starts a run', posted.length === 1);
  ok('the prompt is the failed run\'s', b.prompt === FAILED.prompt, JSON.stringify(b.prompt));
  ok('the quality is the run\'s, not the control\'s default', b.quality === 'low', String(b.quality));
  ok('the size is the run\'s, not the control\'s default', b.size === '1024x1024', String(b.size));
  ok('the outputs are the run\'s', b.outputs === 2, String(b.outputs));
  ok('the boiler toggle is the run\'s', b.boiler === true, String(b.boiler));
  ok('the references ride as ids while the library still has them',
    JSON.stringify(b.refs) === JSON.stringify(['refA', 'refB']), JSON.stringify(b.refs));
  ok('and it does not silently arm the page\'s own boiler toggle',
    await pg.evaluate(() => !document.getElementById('boiler').classList.contains('on')));
  ok('the new run appears as drawing', await pg.locator('#run-new1').count() === 1);

  // ── a reference that left the library ──
  await pg.click('#run-stuck2 .again');
  await pg.waitForTimeout(300);
  const g = posted[1] || {};
  ok('a partly-deleted reference set falls back to the stored urls',
    JSON.stringify(g.refs) === JSON.stringify(FAILED.refs), JSON.stringify(g.refs));

  await browser.close();
  srv.close();
  console.log('freeform retry: ' + pass + ' passed, ' + fails.length + ' failed');
  fails.forEach((f) => console.log('  FAIL ' + f));
  process.exit(fails.length ? 1 : 0);
})();
