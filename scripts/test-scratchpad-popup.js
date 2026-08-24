#!/usr/bin/env node
// THE REMODELLED BEAT POPUP (Aug 2026, Sophie's five asks in one message).
// Drives the REAL public/scratchpad.html in headless Chromium against a stub
// API and MEASURES what each ask actually means:
//   1. "the whole popup gets bigger … similar aspect ratio as total screen
//      (not square)" — the card's own box against the viewport's shape.
//   2. "that image is bigger by default" — the picture is no longer pinned to
//      the pad tile's ~90px.
//   3. "stars, playground and inbox buttons get put into rounded squares and
//      go under the main (currently chosen) image" — squares (w===h), house
//      radius 6px, and their top edge BELOW the picture's bottom.
//   4. "colors become one multicolored rounded square in the corner, drop
//      down" — one button, more than one colour in it, top-right, and the
//      chips only reachable once it is tapped.
//   5. "drawing a new picture replaces the old, but keeps it in the stacked
//      squares icon" — the past pictures are folded behind that button, and
//      it only appears when there ARE past pictures.
//   6. two text boxes: caption open, drawing prompt COLLAPSED; opening the
//      prompt collapses the caption; the caption re-opens by hand.
//
//   node scripts/test-scratchpad-popup.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
// A REAL-SIZED 2:3 picture: the popup sizes itself to the art, so a 1x1
// pixel would put every measurement below nowhere near the truth.
const PNG = (() => {
  const w = 400, h = 600;
  const zlib = require('zlib');
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      raw[row + 1 + x * 3] = 180; raw[row + 2 + x * 3] = 140; raw[row + 3 + x * 3] = 90;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(require('zlib').crc32 ? zlib.crc32(td) >>> 0 : crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  function crc32(buf) {
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
      c = (crc ^ buf[n]) & 0xff;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
})();

let beats = [{
  id: 'b1', url: '/px.png?cur', text: 'the beat says this', color: null,
  imageHistory: [{ url: '/px.png?old1' }, { url: '/px.png?old2' }],
}];
const posted = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; });
    return req.on('end', () => {
      const b = JSON.parse(body || '{}');
      posted.push([url.pathname, b]);
      if (url.pathname === '/api/scratchpad/color') beats.forEach((x) => { if (x.id === b.id) x.color = b.color; });
      if (url.pathname === '/api/scratchpad/prompt') beats.forEach((x) => { if (x.id === b.id) x.prompt = b.prompt; });
      json({ ok: true, beats });
    });
  }
  if (url.pathname === '/api/scratchpad/inbox') return json({ count: 0, items: [], source: 'playground' });
  if (url.pathname === '/api/scratchpad/pads') return json({ count: 0, pads: [] });
  if (url.pathname === '/api/scratchpad/shelf') return json({ count: 0, clips: [] });
  if (url.pathname === '/api/scratchpad') return json({ beats, title: 'popup test', film: null, audios: [] });
  if (url.pathname === '/px.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  if (url.pathname === '/scratchpad-sophie.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  if (url.pathname === '/scratchpad.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'scratchpad.html')));
  }
  res.writeHead(404); res.end();
});

let failures = 0;
function ok(cond, name) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}

const VW = 390, VH = 780;

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  await page.goto(base + '/scratchpad.html');
  await page.evaluate((id) => window.openPad(id), 'pad');
  await page.waitForSelector('#pad .beat');

  const box = (sel) => page.$eval(sel, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom, r: r.right };
  });
  const shown = (sel) => page.$eval(sel, (el) => !el.hidden && el.offsetParent !== null);

  const tile = await box('#pad .beat');
  await page.click('#pad .beat');
  await page.waitForSelector('#beatpop:not([hidden])');
  await page.waitForFunction(() => {
    const im = document.getElementById('popimg');
    return im && !im.hidden && im.getBoundingClientRect().width > 0;
  });

  // 1 — the card is nearly the whole screen, and screen-shaped
  const card = await box('#beatcard');
  ok(card.w * card.h > VW * VH * 0.75,
    'the card fills most of the screen (' + Math.round(card.w) + 'x' + Math.round(card.h) + ')');
  ok(card.w < VW && card.h < VH, 'a strip of pad still shows all round it');
  const cardAR = card.w / card.h, screenAR = VW / VH;
  ok(Math.abs(cardAR - screenAR) < 0.12,
    'it is screen-shaped, not square (card ' + cardAR.toFixed(2) + ' vs screen ' + screenAR.toFixed(2) + ')');
  ok(Math.abs(cardAR - 1) > 0.25, 'and it is nowhere near square');

  // 2 — the picture is big now, not the pad tile's width
  const img = await box('#popimg');
  ok(img.w > tile.w * 2, 'the picture is far bigger than its pad tile (' +
    Math.round(img.w) + 'px vs ' + Math.round(tile.w) + ')');
  ok(img.h <= card.h, 'and it still fits inside the card');
  ok(Math.abs((img.w / img.h) - (2 / 3)) < 0.06, 'it keeps its 2:3 shape');

  // 3 — the ways to art: rounded SQUARES, UNDER the picture
  ok(await shown('#artrow'), 'the art row is showing');
  const arts = ['#ardraw', '#arplay', '#arinbox'];
  for (const sel of arts) {
    const b = await box(sel);
    ok(Math.abs(b.w - b.h) < 1.5, sel + ' is a square (' + Math.round(b.w) + 'x' + Math.round(b.h) + ')');
    ok(b.y >= img.b - 1, sel + ' sits under the picture');
  }
  const rad = await page.$eval('#ardraw', (el) => getComputedStyle(el).borderRadius);
  ok(rad === '6px', 'they wear the house radius, never a pill (' + rad + ')');

  // 4 — ONE multicoloured square in the corner, dropping down
  ok(await shown('#colorbtn'), 'the colour square is showing');
  ok((await page.$$('#cardin .chip')).length === 0, 'no chip row on the card itself');
  const cb = await box('#colorbtn');
  ok(cb.r > card.r - 60 && cb.y < card.y + 60, 'it is in the top-right corner of the card');
  const fills = await page.$eval('#colorbtn svg', (svg) =>
    [...new Set([...svg.querySelectorAll('rect[fill]')].map((r) => r.getAttribute('fill')))]
      .filter((f) => f && f !== 'none'));
  ok(fills.length >= 4, 'the square really is multicoloured (' + fills.length + ' fills)');
  ok(!(await shown('#colormenu')), 'the chips are folded away until it is tapped');
  await page.click('#colorbtn');
  ok(await shown('#colormenu'), 'tapping it drops the chips down');
  await page.click('#colormenu .chip.blue');
  await page.waitForFunction(() => document.getElementById('colormenu').hidden);
  ok(posted.some(([p, b]) => p === '/api/scratchpad/color' && b.color === 'blue'), 'a chip still sets the colour');
  ok(await page.$eval('#popimg', (el) => el.className === 'c-blue'), 'and it lands on the picture');

  // 5 — past pictures behind the stacked squares
  ok(await shown('#arvers'), 'the stacked-squares button is there (this beat has history)');
  ok(!(await shown('#verrow')), 'the past pictures are folded away');
  await page.click('#arvers');
  ok(await shown('#verrow'), 'tapping it opens them');
  ok((await page.$$('#verrow button')).length === 3, 'current + two older');
  await page.click('#arvers');
  ok(!(await shown('#verrow')), 'and folds them back');

  // 6 — the two text boxes
  ok(await shown('#pnote'), 'the caption is open by default');
  ok(!(await shown('#drawbox')), 'the drawing prompt is collapsed by default');
  await page.click('#promlab');
  ok(await shown('#drawbox'), 'tapping Drawing prompt opens it');
  ok(!(await shown('#pnote')), 'and that automatically collapses the caption');
  await page.click('#caplab');
  ok(await shown('#pnote'), 'the caption can be expanded again by hand');
  ok(await shown('#drawbox'), 'with the prompt still open beside it');
  ok(await page.$eval('#dprompt', (el) => el.value === 'the beat says this'),
    'the prompt still seeds from the beat’s words');

  await browser.close();
  server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall good');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
