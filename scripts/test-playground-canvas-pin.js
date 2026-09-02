#!/usr/bin/env node
/*
 * test-playground-canvas-pin.js — Triangle takes the square canvas by itself
 * (2026-08-31, Sophie: "triangle mode shud auto switch to square in
 * playground").
 *
 * A Triset card is square — triset.js draws every one of them at 1024x1024 —
 * so a portrait triangle card is the wrong shape for the one thing that tile
 * exists to make, and the toggle is remembered across visits, so arriving from
 * a portrait picture drew it wrong with nothing on screen saying why.
 *
 * The source half pins the two facts a later edit could break silently: the
 * pin is a FIELD on the style (not an `if k === 'triangle'` somewhere), and
 * the shape it names is the canvas triset.js actually draws on.
 *
 * The page half is all MEASUREMENT, because the interesting question is never
 * "is there a pin" — it is which canvas the run she fires is drawn on, and
 * which half of the toggle she is looking at. A class assertion cannot tell a
 * `.on` whose CSS never landed from a lit button, and a source assertion
 * cannot see the pin failing to reach the POST at all.
 *
 *   node scripts/test-playground-canvas-pin.js
 *   (headless half needs: npm install playwright --no-save)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');
const trisetSrc = fs.readFileSync(path.join(ROOT, 'triset.js'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

console.log('the pin is a field, and it names the shape the game really draws');
// The page's own STYLES table, evaluated — the only honest read of what the
// picker offers.
const tbl = pageSrc.slice(pageSrc.indexOf('\n  var STYLES = {'));
const STYLES = eval('(' + tbl.slice(tbl.indexOf('{'), tbl.indexOf('\n  };') + 4) // eslint-disable-line no-eval
  .replace(/^\s*\/\/.*$/gm, '') + ')');
ok(STYLES.triangle && STYLES.triangle.canvasPin === 'square',
  'Triangle carries canvasPin: square');
// The one number this rides on: change triset.js's canvas and this pin is a
// lie, quietly.
const m = trisetSrc.match(/const CANVAS = '(\d+)x(\d+)'/);
ok(!!m && m[1] === m[2], 'triset.js draws its cards on a SQUARE canvas (' + (m && m[0]) + ')');
// Nothing else is pinned today, and a pin must name a real canvas.
Object.keys(STYLES).forEach((k) => {
  const p = STYLES[k].canvasPin;
  ok(!p || p === 'portrait' || p === 'square', k + ': no pin, or one the toggle has');
});
// A TABLE, never a hardcoded id in the switching logic — the next pinned style
// is one field.
ok(/function canvasPin\(k\) \{ return \(STYLES\[k\] && STYLES\[k\]\.canvasPin\)/.test(pageSrc),
  'canvasPin reads the table');
const setStyle = pageSrc.slice(pageSrc.indexOf('function setStyle(k) {'));
ok(!/['"]triangle['"]/.test(setStyle.slice(0, setStyle.indexOf('\n  }'))),
  'setStyle names no style by hand');
// A SWITCH, not a lock: nothing hides the toggle for a pinned style.
ok(!/canvasPin/.test(pageSrc.slice(pageSrc.indexOf('function syncControls()'),
  pageSrc.indexOf('function syncControls()') + 1600)),
  'the toggle is not hidden on a pinned style — her next tap still wins');

// ── the real page ────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

const RES = {
  portrait: { aspectRatio: '2:3', tiers: {
    '1k': { size: '1024x1536', cents: { low: 0.5, medium: 4.1, high: 16.5 } },
    '2k': { size: '1568x2352', cents: { low: 1.2, medium: 9.6, high: 38.4 } },
    '4k': { size: '2336x3504', cents: { low: 2.6, medium: 21.2, high: 84.6 } } } },
  square: { aspectRatio: '1:1', tiers: {
    '1k': { size: '1024x1024', cents: { low: 0.6, medium: 5.3, high: 21.1 } },
    '2k': { size: '1920x1920', cents: { low: 1.5, medium: 12.4, high: 49.6 } },
    '4k': { size: '2880x2880', cents: { low: 3.3, medium: 27.0, high: 108 } } } },
};
const STYLE_API = {
  dreamy: { label: 'Dreamy', prefix: 'D', suffix: 'D TAIL', noText: null, refs: [] },
  triangle: { label: 'Triangle', prefix: 'T', suffix: 'T TAIL', noText: null, refs: [] },
};

// Which half of the toggle is LIT, read off the real paint: the lit one is
// filled dark, the other is paper. A class name says nothing about what she
// sees, so this compares the two backgrounds rather than trusting `.on`.
const litShape = (page) => page.evaluate(() => {
  const dark = (el) => {
    const c = getComputedStyle(el).backgroundColor.match(/\d+/g).map(Number);
    return (c[0] + c[1] + c[2]) / 3 < 128;
  };
  const p = dark(document.getElementById('c-portrait'));
  const s = dark(document.getElementById('c-square'));
  return p === s ? 'both-or-neither' : (p ? 'portrait' : 'square');
});

(async () => {
  const posted = [];
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
        try { posted.push(JSON.parse(body)); } catch { posted.push(null); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'x' + posted.length }));
      });
    }
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: [], more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ styles: STYLE_API, res: RES, resDefault: '1k' }));
    }
    if (url.pathname === '/playground-port.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(fs.readFileSync(path.join(ROOT, 'public', 'playground-port.js')));
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });   // her phone

  console.log('picking Triangle');
  // She is on Dreamy, on the portrait canvas she picked last time.
  await page.goto(base + '/playground');
  await page.evaluate(() => {
    localStorage.setItem('promptlab_style', 'dreamy');
    localStorage.setItem('promptlab_canvas', 'portrait');
  });
  await page.goto(base + '/playground');
  await page.waitForSelector('#canvastog');
  ok(await litShape(page) === 'portrait', 'Dreamy opens on the portrait she left it on');

  await page.selectOption('#stylepick', 'triangle');
  ok(await litShape(page) === 'square', 'picking Triangle lights square');
  ok(await page.isVisible('#canvastog'),
    'and the toggle is still on screen — a switch, not a lock');

  // The only question that matters: which canvas the run is drawn on.
  await page.fill('#prompt', 'a lemon');
  await page.click('#go');
  await page.waitForFunction(() => document.querySelectorAll('#pendings *').length > 0);
  ok(posted.length === 1 && posted[0].style === 'triangle' && posted[0].canvas === 'square',
    'the run POSTs canvas:square');

  console.log('her tap still wins');
  await page.click('#c-portrait');
  ok(await litShape(page) === 'portrait', 'she can put it back to portrait on Triangle');
  await page.fill('#prompt', 'a lemon again');
  await page.click('#go');
  await page.waitForFunction(() => document.querySelectorAll('#pendings *').length > 1);
  ok(posted.length === 2 && posted[1].canvas === 'portrait',
    'and that run really is portrait — nothing re-pins it under her');

  console.log('opening the page on Triangle');
  // The stored shape is portrait (she just tapped it) and the stored style is
  // Triangle, which is exactly the state a reload must correct — this is the
  // half a setStyle-only fix would miss.
  await page.goto(base + '/playground');
  await page.waitForSelector('#canvastog');
  ok(await page.inputValue('#stylepick') === 'triangle', 'it opens on Triangle');
  ok(await litShape(page) === 'square', 'and on square, not the stored portrait');

  console.log('leaving Triangle');
  await page.selectOption('#stylepick', 'dreamy');
  ok(await litShape(page) === 'square',
    'the shape does not spring back — the canvas is remembered, as she asked');

  console.log('a ported ?style=triangle');
  // The port block runs hundreds of lines above the canvas toggle, where
  // `canvas` is still hoisted-undefined — a pin applied there would throw and
  // take the ported prompt with it.
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(base + '/playground?style=triangle&prompt=a%20triangular%20lemon');
  await page.waitForSelector('#canvastog');
  ok(await page.inputValue('#prompt') === 'a triangular lemon', 'the ported words land');
  ok(await litShape(page) === 'square', 'and the ported style takes its canvas');
  ok(errs.length === 0, 'nothing threw on the way (' + (errs[0] || 'clean') + ')');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();
