#!/usr/bin/env node
// THE PILL'S COLUMN ON /freeform (2026-08-28, Sophie: "pill broken in
// freeform").
//
// The page used to open with a lede paragraph carrying `padding-right:56px`,
// so its two panels began BELOW the injected pill's band. When the lede came
// off (#1857) they moved straight up into it: the Reference panel's white box
// drew under the capsule, the pill's own `Fast` label printed inside the
// Prompt panel, and the fourth-column reference tile was COVERED BY THE PILL
// and could not be tapped at all.
//
// THE TEST MEASURES, AND IT ASKS WITH elementFromPoint. A covered control
// passes `isVisible()` and every width assertion the whole time it is
// unreachable — that is the QUESTIONS button's lesson, and it is the only
// honest way to ask what a tap actually reaches.
//
// AND IT SIMULATES THE 47px SAFE-AREA INSET FROM THE FIRST PAINT. The pill's
// top rides `env(safe-area-inset-top)`, which is 0 in headless Chromium and 47
// on her iPhone 13 — so the band is 33px lower in her hand than in any plain
// check, and the covered tile was only ever visible at her geometry. Both
// heights are driven here.
//
//   npm install playwright-core --no-save && node scripts/test-freeform-pill.js
const fs = require('fs');
const path = require('path');
const http = require('http');

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch { console.log('SKIP: playwright-core not installed'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
let failed = 0, passed = 0;
const ok = (c, m) => { if (c) { passed++; } else { failed++; console.error('FAIL: ' + m); } };

const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
// nine references, so the library's grid really has a fourth column, and a few
// runs so the page is tall enough for the pill to exist at all
const REFS = { refs: Array.from({ length: 9 }, (_, i) => ({ id: 'r' + i, url: '/x.png', name: 'ref' + i })) };
const RUNS = { runs: Array.from({ length: 4 }, (_, i) => ({
  id: 'run' + i, status: 'done', prompt: 'a prompt ' + i, model: 'gpt-image-2',
  quality: 'medium', size: '1024x1536', outputs: 2, refIds: [],
  images: [{ url: '/x.png' }, { url: '/x.png' }], createdAt: Date.now() - i * 1000 })) };

const srv = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/x.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  if (url.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(url.includes('/refs') ? REFS
      : url.includes('/style') ? { prefix: 'P', suffix: 'S' } : RUNS));
  }
  const name = url.replace(/^\//, '') || 'freeform.html';
  const file = path.join(PUB, name);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    const type = name.endsWith('.js') ? 'text/javascript'
      : name.endsWith('.css') ? 'text/css' : 'text/html';
    let body = fs.readFileSync(file, 'utf8');
    if (type === 'text/html') body = body.replace('__STUDIO_TOKEN__', '') + PILL;   // serveGated's own two steps
    res.writeHead(200, { 'Content-Type': type });
    return res.end(body);
  }
  res.writeHead(404); res.end('');
});

// Anything a finger aims at, plus the panels' own boxes — a panel drawing its
// border under the capsule is the visible half of this bug.
const SWEEP = 'button,select,input,textarea,a,.ref,.panel,.lab';

(async () => {
  await new Promise((r) => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port + '/freeform.html';
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find((p) => fs.existsSync(p));
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});

  for (const inset of [47, 14]) {
    for (const library of [false, true]) {
      const where = 'inset ' + inset + ', library ' + (library ? 'open' : 'closed');
      const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errs = [];
      pg.on('pageerror', (e) => errs.push(String(e)));
      await pg.addInitScript((n) => {
        addEventListener('DOMContentLoaded', () => {
          const st = document.createElement('style');
          st.textContent = '.float{top:' + n + 'px !important}';
          document.head.appendChild(st);
        });
      }, inset);
      await pg.goto(base);
      await pg.waitForTimeout(700);
      if (library) { await pg.click('#reftog'); await pg.waitForTimeout(400); }
      await pg.waitForTimeout(1700);           // let the page's settling passes run

      ok(!errs.length, where + ': page errors — ' + errs.join(' | '));

      const pill = await pg.evaluate(() => {
        const f = document.querySelector('body > .float');
        if (!f || getComputedStyle(f).display === 'none') return null;
        const r = f.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left };
      });
      ok(!!pill, where + ': the pill should exist — this page scrolls');
      if (!pill) { await pg.close(); continue; }
      ok(Math.round(pill.top) === inset, where + ': pill top ' + Math.round(pill.top) + ', wanted ' + inset);

      // NOTHING AT REST MAY SIT IN THE PILL'S COLUMN. Judged at the top of the
      // page, which is where the panels live; the run cards below scroll under
      // the rail exactly as they do on every other page here.
      const bad = await pg.evaluate((sel) => {
        const f = document.querySelector('body > .float').getBoundingClientRect();
        const out = [];
        document.querySelectorAll(sel).forEach((e) => {
          if (e.closest('.float')) return;
          const q = e.getBoundingClientRect();
          if (!q.width || !q.height || q.bottom < 0 || q.top > innerHeight) return;
          if (q.right > f.left && q.left < f.right && q.bottom > f.top && q.top < f.bottom) {
            const hit = document.elementFromPoint(Math.min(q.x + q.width / 2, innerWidth - 1), q.y + q.height / 2);
            out.push({ el: e.id || e.className || e.tagName,
              rect: [q.x, q.y, q.width, q.height].map(Math.round),
              covered: !!(hit && hit.closest('.float')) });
          }
        });
        return out;
      }, SWEEP);
      ok(bad.length === 0, where + ': ' + bad.length + ' thing(s) sit in the pill\'s column — '
        + JSON.stringify(bad));
      ok(!bad.some((b) => b.covered), where + ': covered by the pill — '
        + JSON.stringify(bad.filter((b) => b.covered)));

      // and every reference tile still takes its own tap
      if (library) {
        const unreachable = await pg.evaluate(() => {
          const out = [];
          document.querySelectorAll('.ref').forEach((e) => {
            const q = e.getBoundingClientRect();
            if (q.bottom < 0 || q.top > innerHeight) return;
            const hit = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
            if (!hit || !hit.closest('.ref')) out.push([e.id, hit ? (hit.id || hit.className || hit.tagName) : 'none']);
          });
          return out;
        });
        ok(unreachable.length === 0, where + ': reference tiles a tap cannot reach — ' + JSON.stringify(unreachable));
      }

      // SHORTEN THE PANEL THAT OWNS THE CORNER, NUDGE THE ONE THAT ONLY DIPS.
      // With the library folded the Prompt panel's top sits just inside the
      // bottom of the band; shortening it there costs 58px off a row that
      // already fits three controls and wraps them onto a third line, for the
      // sake of about thirty pixels of overlap. It must be moved, not cut.
      if (!library) {
        const how = await pg.evaluate(() => [...document.querySelectorAll('.panel')].map((e) => ({
          gap: e.style.getPropertyValue('--pillgap'),
          top: e.style.getPropertyValue('--pilltop'),
          width: Math.round(e.getBoundingClientRect().width),
        })));
        ok(how.length === 2, where + ': expected two panels, got ' + how.length);
        ok(how[0] && parseFloat(how[0].gap) > 0,
          where + ': the Reference panel owns the corner and must SHORTEN — ' + JSON.stringify(how[0]));
        ok(how[1] && parseFloat(how[1].gap || 0) === 0 && parseFloat(how[1].top || 0) > 0,
          where + ': the Prompt panel only dips and must be NUDGED, not cut — ' + JSON.stringify(how[1]));
        ok(how[1] && how[1].width === how[0].width + Math.round(parseFloat(how[0].gap)),
          where + ': the nudged panel should keep its full width — ' + JSON.stringify(how));
      }
      await pg.close();
    }
  }

  // A RESERVATION IS ONLY EVER MEASURED — a hardcoded band goes stale the day
  // the pill moves, and the pill's top rides the safe-area inset.
  const src = fs.readFileSync(path.join(PUB, 'freeform.html'), 'utf8');
  ok(/getBoundingClientRect\(\)/.test(src.slice(src.indexOf('function fitPillGap'))),
    'fitPillGap must measure the pill, never assume a band');
  const css = src.slice(0, src.indexOf('</style>'));
  ok(/margin-right:var\(--pillgap/.test(css) && /margin-top:var\(--pilltop/.test(css),
    'a .panel must take both reservations from the measured custom properties');

  await browser.close();
  srv.close();
  console.log('FREEFORM PILL — ' + passed + ' passed, ' + failed + ' failed');
  if (failed) process.exitCode = 1;
})();
