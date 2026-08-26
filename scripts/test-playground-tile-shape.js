#!/usr/bin/env node
// EVERY PLAYGROUND TILE WEARS ITS OWN PICTURE'S SHAPE (Aug 2026, Sophie: "i
// kind of want the playground to show portrait aspect ratios to match my 2:3
// pictures").
//
// The tiles view forced `aspect-ratio: 1 / 1` and `object-fit: cover` did the
// rest, so a 2:3 picture — nearly everything she draws here — lost a third of
// itself to a crop on the one screen meant for scanning them. The list view
// forced 2/3 the same way, which cropped the square runs instead.
//
// This is a MEASUREMENT, not a CSS-string check: `aspect-ratio` on an element
// whose width is set by a grid track is only a request, and `object-fit:
// cover` makes a wrong ratio look like a fine picture. So the real boxes are
// read out of headless Chromium and compared against the run's own canvas.
//   1. a 2:3 run tiles 2:3 and a 1:1 run tiles 1:1, on the same wall,
//   2. the same holds in the list view,
//   3. a run with NO ratio on file (everything drawn before the canvas
//      toggle) falls back to portrait rather than to a square,
//   4. a waiting placeholder holds the shape its picture is about to be, so
//      the wall does not re-flow when it lands,
//   5. the columns stay EQUAL with the two shapes mixed — a bare `1fr`
//      is `minmax(auto, 1fr)` and a square's automatic minimum width is
//      transferred from the row height through its own aspect ratio, which
//      blew one column out to 132px and squeezed the rest to 73.
//
//   npm install playwright --no-save && node scripts/test-playground-tile-shape.js
const http = require('http');
const servePublic = require('./lib/public-asset');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const T0 = 1786000000000;

// One portrait run, one square run, one from before the toggle (no ratio).
const ALL = [
  { id: 'runP', aspectRatio: '2:3', want: 2 / 3 },
  { id: 'runS', aspectRatio: '1:1', want: 1 },
  { id: 'runOld', aspectRatio: undefined, want: 2 / 3 },
].map((r, i) => ({
  id: r.id,
  prompt: 'prompt ' + r.id,
  status: 'done',
  engine: 'gptimage',
  model: 'gpt-image-2',
  quality: 'medium',
  aspectRatio: r.aspectRatio,
  images: ['/px.png?r=' + r.id],
  votes: {},
  createdAt: T0 - i * 60000,
}));
const WANT = { runP: 2 / 3, runS: 1, runOld: 2 / 3 };

const server = http.createServer((req, res) => {
  // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/promptlab') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs: ALL, more: false }));
  }
  // The waiting run never finishes, so its placeholder stays on screen.
  if (url.pathname === '/api/promptlab/pend0') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ id: 'pend0', status: 'running' }));
  }
  if (url.pathname === '/api/promptlab/styles') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ styles: {}, sizes: {}, res: {}, resDefault: '1k', max: 4000 }));
  }
  if (url.pathname === '/px.png') {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64');
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(png);
  }
  if (url.pathname === '/' || url.pathname === '/playground') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8'));
  }
  res.writeHead(404).end();
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const ok = (c, m) => { if (c) console.log('  ok  ' + m); else fail(m); };
// A box is "this ratio" within a pixel of rounding either way.
const near = (got, want) => Math.abs(got - want) < 0.02;

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find(p => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });   // iPhone 13
  await page.addInitScript(() => {
    localStorage.setItem('promptlab_view', 'tiles');
    localStorage.setItem('promptlab_pending', JSON.stringify([
      { id: 'pend0', prompt: 'a square one on its way', style: 'ChatGPT',
        engine: 'gptimage', count: 1, quality: 'medium', ar: '1:1' },
    ]));
  });
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#tiles .cell:not(.ph) img').length === 3);

  const shapes = (sel) => page.locator(sel).evaluateAll(els => els.map((e) => {
    const b = e.getBoundingClientRect();
    return { run: e.getAttribute('data-run'), w: b.width, h: b.height };
  }));

  console.log('TILES');
  for (const s of await shapes('#tiles .cell img')) {
    ok(near(s.w / s.h, WANT[s.run]),
      `${s.run} tiles ${WANT[s.run] === 1 ? '1:1' : '2:3'} (measured ${Math.round(s.w)}x${Math.round(s.h)})`);
  }

  const cols = await page.evaluate(() =>
    getComputedStyle(document.getElementById('tiles')).gridTemplateColumns
      .split(' ').map(parseFloat));
  ok(cols.length === 3, 'the wall is three to a row (' + cols.length + ')');
  ok(cols.every(w => Math.abs(w - cols[0]) < 0.5),
    'the columns stay equal with both shapes on the wall (' + cols.join(' · ') + ')');

  // The placeholder is the square run on its way — it must already hold a
  // square, or the wall jumps when the picture lands.
  const ph = await page.locator('#tiles .cell.ph').first().boundingBox();
  ok(ph && near(ph.width / ph.height, 1),
    `the waiting slot holds its picture's shape (measured ${ph && Math.round(ph.width)}x${ph && Math.round(ph.height)})`);

  console.log('LIST');
  await page.click('#v-list');
  await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length === 3);
  for (const s of await shapes('#runs .cell img')) {
    ok(near(s.w / s.h, WANT[s.run]),
      `${s.run} lists ${WANT[s.run] === 1 ? '1:1' : '2:3'} (measured ${Math.round(s.w)}x${Math.round(s.h)})`);
  }
  const lph = await page.locator('#pendings .cell.ph').first().boundingBox();
  ok(lph && near(lph.width / lph.height, 1),
    `the list's waiting slot holds it too (measured ${lph && Math.round(lph.width)}x${lph && Math.round(lph.height)})`);

  await browser.close();
  server.close();
  console.log(process.exitCode ? '\nFAILED' : '\nAll good.');
})();
