#!/usr/bin/env node
// BACK TO THE TOP (Aug 2026, Sophie: "add a small back to top arrow in
// playground when i scroll down. as well as other long scrolls like meta
// assets").
//
// It rides in the pill's own rail: that corner is already reserved on every
// page (header rows pad 56px for it), so a second free-floating control would
// have landed on page content — the exact thing the reservation exists to
// prevent. The one source is scripts/pill.py, regenerated into
// public/pill-inject.html; the pages that BAKE their own pill copy carry the
// same button, and three of those copies are older hand-drifted ones that got
// a self-contained version.
//
// Asserts, in headless Chromium against the real injected pill over a real
// page, plus every baked copy:
//   1. hidden at the top of a long page,
//   2. shown once she is a full screen down,
//   3. a tap returns her to the top and the button goes away again,
//   4. it STOPS a running autoscroll first (or the scroll walks the page back
//      down under the animation),
//   5. it never appears on a page that cannot scroll,
//   6. it is small, round, and inside the pill's rail — not floating loose.
//
//   npm install playwright --no-save && node scripts/test-back-to-top.js
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');

const page = (tall) => '<!doctype html><meta name="viewport" content="width=device-width">' +
  '<style>body{margin:0;font:16px -apple-system,sans-serif}</style><body>' +
  '<div style="height:' + (tall ? '4000px' : '200px') + '">hello</div>' + PILL;

const server = http.createServer((req, res) => {
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

  console.log('THE BUTTON');
  await pg.goto(base + '/');
  const btn = pg.locator('#ptop');
  if (await btn.count() !== 1) fail('no back-to-top in the injected pill');
  ok(await btn.isHidden() ? 'hidden at the top of the page' : fail('showing before she scrolled'));

  await pg.evaluate(() => window.scrollTo(0, 2000));
  await pg.waitForFunction(() => document.getElementById('ptop').classList.contains('on'));
  ok('shown a full screen down');

  // Half a screen is not enough — the end of the page is still nearly in view.
  await pg.evaluate(() => window.scrollTo(0, 300));
  await pg.waitForFunction(() => !document.getElementById('ptop').classList.contains('on'));
  ok('and gone again inside the first screen');

  console.log('THE TAP');
  await pg.evaluate(() => window.scrollTo(0, 2500));
  await pg.waitForFunction(() => document.getElementById('ptop').classList.contains('on'));
  await btn.click();
  await pg.waitForFunction(() => window.scrollY === 0, null, { timeout: 4000 })
    .catch(() => fail('the tap did not reach the top'));
  ok('a tap returns her to the top');
  if (await btn.isVisible()) fail('still showing at the top');
  else ok('and the button goes away with the scroll');

  // A running autoscroll must be stopped by the tap, or it keeps walking the
  // page back down while the smooth scroll is still animating.
  await pg.evaluate(() => { window.scrollTo(0, 2500); window.__scrollStart(1); });
  await btn.click();
  await pg.waitForTimeout(700);
  const y = await pg.evaluate(() => window.scrollY);
  if (y > 40) fail(`autoscroll kept running through the tap (landed at ${Math.round(y)})`);
  else ok('it stops a running autoscroll first');

  console.log('A PAGE WITH NOTHING TO SCROLL');
  await pg.goto(base + '/short');
  await pg.evaluate(() => window.scrollTo(0, 2000));
  await pg.waitForTimeout(120);
  if (await pg.locator('#ptop').isVisible()) fail('a short page grew a back-to-top');
  else ok('never appears');

  console.log('THE LOOK, AND WHERE IT SITS');
  await pg.goto(base + '/');
  await pg.evaluate(() => window.scrollTo(0, 2000));
  await pg.waitForFunction(() => document.getElementById('ptop').classList.contains('on'));
  const box = await pg.evaluate(() => {
    const b = document.getElementById('ptop').getBoundingClientRect();
    const f = document.querySelector('.float').getBoundingClientRect();
    const cs = getComputedStyle(document.getElementById('ptop'));
    return { w: b.width, h: b.height, r: cs.borderRadius,
      inRail: b.left >= f.left - 1 && b.right <= f.right + 1 && b.top >= f.top - 1 };
  });
  if (box.w > 42 || box.h > 42) fail(`it is ${Math.round(box.w)}x${Math.round(box.h)} — not small`);
  else ok(`small (${Math.round(box.w)}x${Math.round(box.h)})`);
  if (!/50%|999/.test(box.r)) fail('not round — ' + box.r);
  else ok('round');
  if (!box.inRail) fail('it is floating loose, not in the pill rail');
  else ok('inside the pill rail, under the speed label');

  console.log('EVERY BAKED COPY CARRIES IT');
  for (const f of ['chats.html', 'gallery.html', 'storyroom.html', 'wall.html', 'writing.html']) {
    const html = fs.readFileSync(path.join(PUB, f), 'utf8');
    const n = (html.match(/id="ptop"/g) || []).length;
    if (n !== 1) fail(`${f} has ${n} back-to-top buttons, wanted 1`);
    else if (!/\.ptop\s*\{/.test(html)) fail(`${f} has the button but no .ptop rule`);
    else if (!html.includes("getElementById('ptop')")) fail(`${f} has the button but nothing wires it`);
    else ok(f);
  }

  await browser.close();
  server.close();
  console.log(process.exitCode ? '\nFAILED' : '\nAll good.');
})();
