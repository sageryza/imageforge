#!/usr/bin/env node
// THE PILL FOLLOWS WHATEVER IS ACTUALLY SCROLLING (2026-08-24, Sophie: "some
// surfaces scroll but have no to top arrow. like story room shelf").
//
// A full-screen sheet — `position:fixed; inset:0; overflow-y:auto`, which is
// what the Story Room's shelf is — takes the scroll away from the window. The
// pill only ever asked the window, so on the shelf there was no pill, no
// back-to-top, and (measured with elementFromPoint) the sheet's own z-index 40
// sat over the pill's 9 anyway.
//
// Asserts, against the REAL public/pill-inject.html:
//   1. the pill appears when only a sheet can scroll,
//   2. the pill is lifted above the sheet, so the arrow is reachable,
//   3. the arrow lights a screen down the SHEET (not the window),
//   4. a tap takes the SHEET home,
//   5. autoscroll moves the SHEET,
//   6. closing the sheet hands the pill back to the window,
//   7. a SMALL inner scroller is never adopted — it must not steal the pill
//      from the page behind it.
//
//   npm install playwright-core --no-save && node scripts/test-pill-sheet.js
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch { console.log('SKIP: playwright-core not installed'); process.exit(0); }

const PILL = fs.readFileSync(path.join(__dirname, '..', 'public', 'pill-inject.html'), 'utf8');

// a page that is ONE screen tall, holding a closed full-screen sheet and a
// small scroller — the Story Room's shape, stripped to what matters
const HTML = `<!doctype html><meta name="viewport" content="width=device-width">
<style>
 html,body{margin:0;font:16px -apple-system,sans-serif}
 #page{height:100vh}
 #sheet{position:fixed; inset:0; background:#fff; z-index:40; overflow-y:auto}
 #sheet[hidden]{display:none}
 #small{position:fixed; left:0; right:0; bottom:0; height:120px; overflow-y:auto; background:#eee}
</style>
<body>
<div id="page">the page itself fits on one screen</div>
<div id="small"><div style="height:900px">a small scroller</div></div>
<div id="sheet" hidden><div id="tall" style="height:5000px">the shelf</div></div>
` + PILL;

const server = http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(HTML);
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const ok = (m) => console.log('  ok  ' + m);

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find((p) => fs.existsSync(p));
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await pg.goto(base + '/');
  await pg.waitForTimeout(300);

  // 0. nothing to scroll yet — and the SMALL scroller must not have been taken
  //    for the page's own (rule 7). Scrolling it changes nothing.
  await pg.evaluate(() => { document.getElementById('small').scrollTop = 400; });
  await pg.waitForTimeout(200);
  let s = await pg.evaluate(() => ({
    pill: getComputedStyle(document.querySelector('.float')).display,
    ptop: document.getElementById('ptop').className,
  }));
  if (s.pill !== 'none') fail('the pill shows on a page whose only scroller is a small box: ' + s.pill);
  else ok('a small inner scroller is never adopted');
  if (/\bon\b/.test(s.ptop)) fail('the arrow lit for a small inner scroller');

  // 1 + 2. open the sheet
  await pg.evaluate(() => { document.getElementById('sheet').hidden = false; });
  await pg.waitForTimeout(400);
  s = await pg.evaluate(() => {
    const f = document.querySelector('.float');
    return { pill: getComputedStyle(f).display, z: parseInt(getComputedStyle(f).zIndex, 10) };
  });
  if (s.pill === 'none') fail('no pill when the sheet is the only thing that scrolls');
  else ok('the pill appears for a sheet');
  if (!(s.z > 40)) fail('the pill is under the sheet (z ' + s.z + ' vs the sheet at 40)');
  else ok('the pill is lifted over the sheet');

  // 3. a screen down the SHEET lights the arrow, and it is really tappable
  await pg.evaluate(() => { document.getElementById('sheet').scrollTop = 2000; });
  await pg.waitForTimeout(300);
  s = await pg.evaluate(() => {
    const b = document.getElementById('ptop'), r = b.getBoundingClientRect();
    const hit = r.width ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
    return { on: b.classList.contains('on'), reach: !!(hit && hit.closest('#ptop')) };
  });
  if (!s.on) fail('the arrow did not light a screen down the sheet');
  else ok('the arrow lights on the sheet');
  if (!s.reach) fail('the arrow is not reachable — something covers it');
  else ok('the arrow is reachable');

  // 4. a tap takes the SHEET home
  await pg.click('#ptop');
  await pg.waitForTimeout(700);
  s = await pg.evaluate(() => ({
    top: document.getElementById('sheet').scrollTop,
    on: document.getElementById('ptop').classList.contains('on'),
  }));
  if (s.top > 4) fail('the tap left the sheet at ' + s.top);
  else ok('the tap takes the sheet home');
  if (s.on) fail('the arrow still shows at the top of the sheet');

  // 5. autoscroll moves the SHEET
  await pg.evaluate(() => window.__scrollStart ? window.__scrollStart(1) : null);
  await pg.waitForTimeout(600);
  const moved = await pg.evaluate(() => document.getElementById('sheet').scrollTop);
  await pg.evaluate(() => window.__scrollStop());
  if (moved <= 2) fail('autoscroll did not move the sheet (' + moved + ')');
  else ok('autoscroll drives the sheet');

  // 6. closing it hands the pill back to the window
  await pg.evaluate(() => { document.getElementById('sheet').hidden = true; });
  await pg.waitForTimeout(500);
  s = await pg.evaluate(() => {
    const f = document.querySelector('.float');
    return { pill: getComputedStyle(f).display, z: f.style.zIndex };
  });
  if (s.pill !== 'none') fail('the pill stayed up after the sheet closed: ' + s.pill);
  else ok('closing the sheet hands the pill back');
  if (s.z) fail('the pill kept the sheet\'s z-index: ' + s.z);

  await browser.close();
  server.close();
  console.log(process.exitCode ? 'DONE with failures' : 'OK: the pill follows the sheet and gives it back');
})().catch((e) => { console.error(e); process.exit(1); });
