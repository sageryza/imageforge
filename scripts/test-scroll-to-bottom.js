#!/usr/bin/env node
// TO THE BOTTOM (2026-09-03, Sophie: "add a scroll to bottom arrow
// playground") — the back-to-top arrow's twin, in the same rail, under it.
//
// Asserts, in headless Chromium against the real injected pill over a real
// page, then the REAL Playground page + the real pill at her viewport:
//   1. shown at the top of a long page (there is page below),
//   2. gone once she is within a little of the end,
//   3. a tap takes her to the bottom and the button goes away,
//   4. it STOPS a running autoscroll first,
//   5. it never appears on a page that cannot scroll,
//   6. it is the top arrow's size, round, in the rail, directly UNDER it,
//   7. on the real Playground it is lit at the top, reachable by a tap
//      (elementFromPoint — a covered control passes every width assertion),
//      and the tap lands her at the end of the feed.
//
//   npm install playwright --no-save && node scripts/test-scroll-to-bottom.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const servePublic = require('./lib/public-asset');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
const PLAY = fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8');

const page = (tall) => '<!doctype html><meta name="viewport" content="width=device-width">' +
  '<style>body{margin:0;font:16px -apple-system,sans-serif}</style><body>' +
  '<div style="height:' + (tall ? '4000px' : '200px') + '">hello</div>' + PILL;

const T0 = 1786000000000;
const RUNS = Array.from({ length: 12 }, (_, i) => ({
  id: 'run' + i, prompt: 'prompt number ' + i, status: 'done', engine: 'gptimage',
  model: 'gpt-image-2', quality: 'medium', aspectRatio: '2:3',
  images: ['/px.png?i=' + i], votes: {}, createdAt: T0 - i * 60000,
}));

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/promptlab') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs: RUNS, more: false }));
  }
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{}');
  }
  if (url.pathname === '/px.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'));
  }
  if (url.pathname === '/playground') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(PLAY + PILL);
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(page(req.url !== '/short'));
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const ok = (m) => console.log('  ok  ' + m);

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find(p => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const lit = () => pg.evaluate(() => document.getElementById('pbot').classList.contains('on'));

  console.log('THE BUTTON');
  await pg.goto(base + '/');
  const btn = pg.locator('#pbot');
  if (await btn.count() !== 1) fail('no to-the-bottom in the injected pill');
  await pg.waitForFunction(() => document.getElementById('pbot').classList.contains('on'));
  ok('shown at the top of a long page');

  await pg.evaluate(() => window.scrollTo(0, 4000 - 844 - 80));
  await pg.waitForFunction(() => !document.getElementById('pbot').classList.contains('on'));
  ok('and gone again near the very end');

  console.log('THE TAP');
  await pg.evaluate(() => window.scrollTo(0, 500));
  await pg.waitForFunction(() => document.getElementById('pbot').classList.contains('on'));
  await btn.click();
  await pg.waitForFunction(() => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4,
    null, { timeout: 4000 }).catch(() => fail('the tap did not reach the bottom'));
  ok('a tap takes her to the bottom');
  if (await btn.isVisible()) fail('still showing at the bottom');
  else ok('and the button goes away with the scroll');

  await pg.evaluate(() => { window.scrollTo(0, 500); window.__scrollStart(-1); });
  await pg.waitForTimeout(50);
  await btn.click();
  await pg.waitForTimeout(700);
  const gap = await pg.evaluate(() => document.documentElement.scrollHeight - window.innerHeight - window.scrollY);
  if (gap > 40) fail(`autoscroll kept running through the tap (${Math.round(gap)}px short of the end)`);
  else ok('it stops a running autoscroll first');

  console.log('A PAGE WITH NOTHING TO SCROLL');
  await pg.goto(base + '/short');
  await pg.waitForTimeout(120);
  if (await pg.locator('#pbot').isVisible()) fail('a short page grew a to-the-bottom');
  else ok('never appears');

  console.log('THE LOOK, AND WHERE IT SITS');
  await pg.goto(base + '/');
  await pg.evaluate(() => window.scrollTo(0, 1000));
  await pg.waitForFunction(() => document.getElementById('pbot').classList.contains('on') &&
    document.getElementById('ptop').classList.contains('on'));
  const box = await pg.evaluate(() => {
    const b = document.getElementById('pbot').getBoundingClientRect();
    const t = document.getElementById('ptop').getBoundingClientRect();
    const f = document.querySelector('.float').getBoundingClientRect();
    const cs = getComputedStyle(document.getElementById('pbot'));
    return { w: b.width, h: b.height, tw: t.width, th: t.height, r: cs.borderRadius,
      under: b.top >= t.bottom && Math.abs(b.left - t.left) < 1,
      inRail: b.left >= f.left - 1 && b.right <= f.right + 1 && b.bottom <= f.bottom + 1 };
  });
  if (box.w !== box.tw || box.h !== box.th) fail(`it is ${box.w}x${box.h} against the top arrow's ${box.tw}x${box.th}`);
  else ok(`the top arrow's size (${Math.round(box.w)}x${Math.round(box.h)})`);
  if (!/50%|999/.test(box.r)) fail('not round — ' + box.r);
  else ok('round');
  if (!box.under) fail('it is not directly under the back-to-top');
  else ok('directly under the back-to-top');
  if (!box.inRail) fail('it is floating loose, not in the pill rail');
  else ok('inside the pill rail');

  console.log('THE REAL PLAYGROUND');
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto(base + '/playground');
  await pg.waitForFunction(() => document.querySelectorAll('.run').length >= 12, null, { timeout: 8000 })
    .catch(() => fail('the feed never rendered'));
  await pg.waitForFunction(() => document.getElementById('pbot').classList.contains('on'), null, { timeout: 4000 })
    .catch(() => fail('not lit at the top of the Playground feed'));
  const reach = await pg.evaluate(() => {
    const b = document.getElementById('pbot').getBoundingClientRect();
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return !!(hit && hit.closest('#pbot'));
  });
  if (!reach) fail('the Playground covers the button — a tap does not reach it');
  else ok('lit at the top and reachable by a tap');
  await pg.click('#pbot');
  await pg.waitForFunction(() => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4,
    null, { timeout: 4000 }).catch(() => fail('the tap did not reach the end of the feed'));
  ok('a tap lands her at the end of the feed');
  if (await lit()) fail('still lit at the end of the feed');
  else ok('and goes out there');
  if (errs.length) fail('page errors: ' + errs.join(' | '));

  await browser.close();
  server.close();
  console.log(process.exitCode ? '\nFAILED' : '\nAll good.');
})();
