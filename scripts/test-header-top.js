#!/usr/bin/env node
/* EVERY GATED PAGE'S HEADER SITS AT THE SAME PLACE (2026-08-23, Sophie: "the
   header is different in both, and not at the top" — the Story Room was just
   the pair she happened to screenshot). Measured across all gated pages
   before the fix: the gap above the header ran 0 to 42px and the chevron's
   left edge -4 to 16, because no one owned the number — every page improvised
   its own top inset and every new page copied its neighbour's.

   The fix is pagehead.js's levelRow(): the injected chevron measures its real
   box and corrects the row to top var(--headtop) / left 16 (the values Sophie
   approved on the Story Room), whatever the host page wrapped around its
   header. This test drives EVERY page the server actually gates, in the
   new-build state, and measures the result.

   THE PAGE LIST IS DERIVED FROM server.js, NOT WRITTEN HERE — that is the
   half that stops the bug coming back: registering a new gated page puts it
   in this test the same day, before anyone remembers it exists. A page a
   chat builds by copying an old neighbour (the way every one of the 39
   inherited its wrong number) fails here instead of shipping.

   Run: node scripts/test-header-top.js */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('header-top: playwright not installed — skipped');
    process.exit(0);
  }
}
function exe() {
  const root = '/opt/pw-browsers';
  try {
    for (const d of fs.readdirSync(root)) {
      const p = path.join(root, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  } catch (e) { /* fall back to playwright's own lookup */ }
  return undefined;
}

// The population, read from the server itself — comment lines skipped, so a
// "swap this line to serveGated('x.html') to bring it back" note is not a page.
const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const FILES = [...new Set(src.split('\n')
  .filter((l) => !/^\s*(\/\/|\*)/.test(l))
  .flatMap((l) => [...l.matchAll(/serveGated\('([^']+\.html)'/g)].map((m) => m[1]))
)].filter((f) => fs.existsSync(path.join(PUB, f)));

function serve() {
  return http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/api/')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({
        ok: true, items: [], assets: [], pads: [], chats: [], clips: [],
        rows: [], pages: [], runs: [], memos: [], results: [],
      }));
    }
    let rel = u.pathname.slice(1) || 'index.html';
    if (!rel.includes('.')) rel += '.html';
    const f = path.join(PUB, rel);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
    let body = fs.readFileSync(f);
    // exactly what serveGated does: pagehead on every gated page
    if (rel.endsWith('.html')) body = body.toString() + '\n<script src="/pagehead.js" defer></script>';
    const e = path.extname(f);
    res.writeHead(200, {
      'content-type': e === '.js' ? 'text/javascript' : e === '.css' ? 'text/css'
        : e === '.json' ? 'application/json' : 'text/html; charset=utf-8',
    });
    res.end(body);
  });
}

let pass = 0, fail = 0;
(async () => {
  if (!FILES.length) { console.log('FAIL  no serveGated pages found in server.js'); process.exit(1); }
  const srv = serve();
  await new Promise((r) => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: exe() });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // A page that links an external font or CDN would hang the headless load
  // forever (no network here) and time the test out — photo.html did. Answer
  // everything off-host with an empty 200 instead.
  await ctx.route('**/*', (route) => {
    if (route.request().url().startsWith(base)) return route.continue();
    return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
  });

  console.log(FILES.length + ' gated pages (derived from server.js)');
  for (const file of FILES) {
    const pg = await ctx.newPage();
    pg.on('pageerror', () => { /* a stubbed API upsets some pages; the header must draw anyway */ });
    await pg.addInitScript('window.__nativeNavBar = true; window.__forgeLeave = function () {};');
    let r = null;
    try {
      await pg.goto(base + '/' + file, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await pg.waitForSelector('#forgeback', { state: 'attached', timeout: 5000 });
      await pg.waitForTimeout(700);   // levelRow's post-load + observer syncs
      r = await pg.evaluate(() => {
        const b = document.getElementById('forgeback');
        const q = b.getBoundingClientRect();
        // the levelled thing is the row's CONTENT-BOX top — a tall band
        // (search) centres the chevron a few px inside itself by design.
        // A floating chevron (no row) is its own box.
        let top = Math.round(q.top);
        if (getComputedStyle(b).position !== 'fixed') {
          const row = b.parentElement;
          top = Math.round(row.getBoundingClientRect().top +
            (parseFloat(getComputedStyle(row).paddingTop) || 0));
        }
        return { top, left: Math.round(q.left), w: q.width };
      });
    } catch (e) { r = { err: String(e).slice(0, 60) }; }
    await pg.close();
    // headless has no notch, so var(--headtop) resolves to 4
    if (r && !r.err && r.w === 0) {
      // a header that waits for content (cutmarks, the editor) has no box to
      // measure at load — levelRow's IntersectionObserver levels it when it
      // appears, and its geometry can only be asserted with real data
      pass++; console.log('  ok   ' + file.padEnd(22) + 'header hidden at load — levelled on show');
      continue;
    }
    const good = r && !r.err && Math.abs(r.top - 4) <= 1 && Math.abs(r.left - 16) <= 1;
    if (good) { pass++; console.log('  ok   ' + file.padEnd(22) + 'top ' + r.top + '  left ' + r.left); }
    else {
      fail++;
      console.log('  FAIL ' + file.padEnd(22) +
        (r && r.err ? r.err : 'top ' + r.top + '  left ' + r.left + '  (want 4 / 16)'));
    }
  }

  await browser.close();
  srv.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
