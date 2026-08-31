#!/usr/bin/env node
/*
 * test-playground-pilltop.js — the back-to-top arrow's watchdog and its
 * beacon (2026-08-29, Sophie's THIRD "where is the back to top button"
 * report: "it's still not there and i reload it like every hour … there was
 * one, it's gone"). The served page and every vintage back to Aug 24 render
 * the arrow correctly in Chromium AND real WebKit at her viewport — so the
 * failure lives in a state only her device reaches, and the answer is the
 * Film Editor's telemetry lesson: the page repairs the arrow on a timer and
 * REPORTS the wrong state from the device itself.
 *
 * Source half: the route sits ABOVE /api/promptlab/:id (the /styles lesson —
 * Express matches in order), the report list is capped, the page carries the
 * watchdog on an interval.
 *
 * Page half, headless against the real page + the REAL injected pill:
 *   - the arrow lights on scroll (the baseline the watchdog protects)
 *   - the wrongness rule, driven as a table through the page's own copy
 *   - a caught-wrong tick POSTs the device's account, with the fields
 *   - and not twice inside the cap
 *
 *   node scripts/test-playground-pilltop.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const pageSrc = fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

console.log('the source contracts');
ok(serverSrc.indexOf("app.get('/api/promptlab/pilltop'") >= 0
  && serverSrc.indexOf("app.post('/api/promptlab/pilltop'") >= 0,
  'the pilltop routes exist');
ok(serverSrc.indexOf("'/api/promptlab/pilltop'") < serverSrc.indexOf("app.get('/api/promptlab/:id'"),
  'and sit ABOVE /api/promptlab/:id — Express matches in order');
ok(/PILLTOP_CAP = 40/.test(serverSrc) && /\.slice\(0, PILLTOP_CAP\)/.test(serverSrc),
  'the report list is capped');
ok(/setInterval\(ptopWatch, 4000\)/.test(pageSrc), 'the page runs the watchdog on an interval');
ok(/window\.__pillTopSync\(\)/.test(pageSrc),
  "the repair is the pill's OWN exported resync — never a second copy of its rule");
ok(/if \(lbIsOpen\(\) \|\| charsOpen\) return;/.test(pageSrc),
  'skipped while an overlay owns the screen');

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { console.log('SKIP page half: playwright not installed'); process.exit(fails ? 1 : 0); }

  const T0 = 1786000000000;
  const RUNS = Array.from({ length: 30 }, (_, i) => ({
    id: 'run' + i, prompt: 'prompt number ' + i, status: 'done', engine: 'gptimage',
    model: 'gpt-image-2', quality: 'medium', aspectRatio: '2:3',
    images: ['/px.png?i=' + i], votes: {}, createdAt: T0 - i * 60000,
  }));
  const beacons = [];
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab/pilltop' && req.method === 'POST') {
      let b = '';
      req.on('data', (c) => { b += c; });
      req.on('end', () => {
        try { beacons.push(JSON.parse(b)); } catch (e) { beacons.push({ parseError: true }); }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
      });
      return;
    }
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: RUNS, more: false }));
    }
    if (url.pathname.startsWith('/api/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{}');
    }
    if (url.pathname === '/px.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'));
    }
    if (url.pathname === '/' || url.pathname === '/playground') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8')
        + fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8'));
    }
    res.writeHead(404).end();
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => {
    addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = '.float{top:47px !important}';
      document.head.appendChild(st);
    });
  });
  await page.goto('http://127.0.0.1:' + port + '/playground');
  await page.waitForTimeout(900);

  console.log('the baseline the watchdog protects');
  await page.evaluate(() => window.scrollTo(0, 2500));
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => document.getElementById('ptop').classList.contains('on')),
    'the arrow lights a full screen down');

  console.log('the wrongness rule — the page\'s own copy, as a table');
  const table = await page.evaluate(() => [
    // [lit, litAfter, scrollY, ih] → wrong?
    [window.__plPtopWrong(true, true, 2500, 844), false, 'lit and staying lit is fine'],
    [window.__plPtopWrong(false, true, 2500, 844), true, 'only lit because this tick lit it — the listeners missed'],
    [window.__plPtopWrong(true, false, 2500, 844), true, 'dark a full screen down — the reported failure'],
    [window.__plPtopWrong(false, false, 100, 844), false, 'dark at the top is the design'],
    [window.__plPtopWrong(true, false, 100, 844), false, 'going dark near the top is the design too'],
  ]);
  for (const [got, want, what] of table) ok(got === want, what + ` (got ${got})`);

  console.log('a caught-wrong tick files the device\'s account');
  // Stub the pill's resync to hold the arrow DARK — the only way to create,
  // from outside the pill, the exact state her screenshot shows: script
  // alive, page a full screen down, arrow off. sendBeacon is disabled so the
  // beacon takes the fetch path the stub server can record.
  await page.evaluate(() => {
    window.__realSync = window.__pillTopSync;
    window.__pillTopSync = function () { document.getElementById('ptop').classList.remove('on'); };
    navigator.sendBeacon = null;
    window.__plPtopWatch();
  });
  await page.waitForTimeout(400);
  ok(beacons.length === 1, 'exactly one beacon POSTed');
  const r = beacons[0] || {};
  ok(r.scrollY > 844 && r.ih === 844, 'carrying the scroll state (' + r.scrollY + '/' + r.ih + ')');
  ok(r.litAfter === false && r.corrected === false,
    'saying the resync could NOT light it — the deeper-state shape');
  ok(typeof r.disp === 'string' && typeof r.cls === 'string',
    "with the button's computed display and class");
  ok('build' in r, 'and the build id (empty on a stub server, present live)');

  console.log('and not twice inside the cap');
  await page.evaluate(() => { window.__plPtopWatch(); });
  await page.waitForTimeout(300);
  ok(beacons.length === 1, 'a second tick inside the minute sends nothing');

  console.log('the repair, un-stubbed');
  await page.evaluate(() => { window.__pillTopSync = window.__realSync; window.__plPtopWatch(); });
  ok(await page.evaluate(() => document.getElementById('ptop').classList.contains('on')),
    'the real resync re-lights the arrow');

  await b.close();
  server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall good');
  process.exit(fails ? 1 : 0);
})();
