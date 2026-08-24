#!/usr/bin/env node
// A PAGE CAN KILL THE INJECTED PILL BY NAMING A VARIABLE (found live
// 2026-08-24, sweeping for "some surfaces scroll but have no to top arrow").
//
// The pill is APPENDED to a page it has never met, and its script runs in that
// page's own global scope. A page-level `let`/`const`/`class` sharing a name
// with one of the pill's top-level `var`s is a SyntaxError — and it is not the
// clash that fails, it is the WHOLE pill script, at parse time, silently:
// `/search` had `let playing = null` and therefore no autoscroll, no
// back-to-top, and an undefined `window.__scrollStop` for anything on the page
// that called it. Nothing on screen said so. (`/cutmarks` had already been
// bitten and wrapped its page script in an IIFE — its comment names this bug —
// so the fix was known and only that one page carried it.)
//
// THE TEST MEASURES RATHER THAN PARSES, because the cause is not the only way
// to lose the pill and a source rule cannot tell a top-level `const I` from an
// identical line inside an IIFE. Each page is served the way `serveGated` does
// it — the real file with the real pill appended — and asked in a real browser
// whether the pill's script actually ran.
//
// The page list comes from server.js's own `serveGated(…, { pill: true })`
// calls, so a new page joins the sweep the moment it opts in.
//
//   npm install playwright-core --no-save && node scripts/test-pill-globals.js
const fs = require('fs');
const path = require('path');
const http = require('http');

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch { console.log('SKIP: playwright-core not installed'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };

const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const pages = [...new Set([...server.matchAll(/serveGated\(\s*'([\w.-]+)'\s*,\s*\{[^}]*pill:\s*true/g)]
  .map((m) => m[1]))];
if (pages.length < 10) fail('only ' + pages.length + ' pill pages found — the reader is wrong');

const srv = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{}'); }
  const name = url.replace(/^\//, '');
  const file = path.join(PUB, name);
  if (name && fs.existsSync(file) && fs.statSync(file).isFile()) {
    const type = name.endsWith('.js') ? 'text/javascript'
      : name.endsWith('.css') ? 'text/css' : 'text/html';
    let body = fs.readFileSync(file, 'utf8');
    // serveGated's own two steps, for the .html we are testing
    if (type === 'text/html') body = body.replace('__STUDIO_TOKEN__', '') + PILL;
    res.writeHead(200, { 'Content-Type': type });
    return res.end(body);
  }
  res.writeHead(404); res.end('');
});

(async () => {
  await new Promise((r) => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find((p) => fs.existsSync(p));
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });

  console.log('THE INJECTED PILL RUNS ON ' + pages.length + ' PAGES');
  for (const file of pages) {
    const errs = [];
    const onErr = (e) => errs.push(String(e).split('\n')[0]);
    pg.on('pageerror', onErr);
    try {
      await pg.goto(base + file, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await pg.waitForTimeout(400);
      const live = await pg.evaluate(() => ({
        markup: !!document.querySelector('.float'),
        ptop: !!document.getElementById('ptop'),
        ran: typeof window.__pillSync === 'function'
          && typeof window.__scrollStop === 'function'
          && typeof window.__pillTopSync === 'function',
      }));
      const syntax = errs.filter((e) => /SyntaxError/.test(e));
      if (!live.markup) fail(file + ': no pill in the page at all');
      else if (!live.ptop) fail(file + ': the pill has no back-to-top button');
      else if (!live.ran) {
        fail(file + ': the pill script never ran'
          + (syntax.length ? ' — ' + syntax[0] : '') + ' (wrap the page script in an IIFE)');
      } else console.log('  ok  ' + file);
    } catch (e) { fail(file + ': ' + String(e).split('\n')[0].slice(0, 80)); }
    pg.off('pageerror', onErr);
  }

  await browser.close();
  srv.close();
  console.log(process.exitCode ? 'DONE with failures' : 'OK: no page kills the injected pill');
})().catch((e) => { console.error(e); process.exit(1); });
