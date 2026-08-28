#!/usr/bin/env node
// PICKING AN OLDER PICTURE, IN THE REAL PAGE (Aug 2026, Sophie: "can you
// propose a change to make the past picture thumbnails so that I can actually
// pick one?"). The row already held every generation a beat had ever had, but
// tapping one only opened it big — there was no way to put it back.
//
// The decision happens in the LIGHTBOX, not on the thumbnail: a thumb is
// 44px wide and she picks by looking. So tapping one still opens it big, and
// the big view carries a "Use this one" button — never for the picture that
// is already the beat's art.
//
// Drives public/scratchpad.html in headless Chromium against a stub API
// whose /image runs the REAL pad-art.js, so the round trip below is the one
// the server does: the picked picture leaves the row, the one it replaced
// joins it, and no picture is ever in both places.
//
//   node scripts/test-scratchpad-pick-version.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { swapArt } = require('../pad-art');
const servePublic = require('./lib/public-asset');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');

// A REAL-SIZED 2:3 picture — the popup and the lightbox both size themselves
// to the art, so a 1x1 pixel would put every measurement nowhere near it.
function png(r, g, b) {
  const w = 400, h = 600;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      raw[row + 1 + x * 3] = r; raw[row + 2 + x * 3] = g; raw[row + 3 + x * 3] = b;
    }
  }
  function crc32(buf) {
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
      c = (crc ^ buf[n]) & 0xff;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
const PIC = png(180, 140, 90);

const CUR = '/px.png?cur', OLD1 = '/px.png?old1', OLD2 = '/px.png?old2';
let beats = [{
  id: 'b1', url: CUR, text: 'the beat says this', color: null,
  src: { prompt: 'the current one' },
  imageHistory: [{ url: OLD1, at: 1, src: { prompt: 'the first one' } }, { url: OLD2, at: 2 }],
}];
const posted = [];

const server = http.createServer((req, res) => {
  // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; });
    return req.on('end', () => {
      const b = JSON.parse(body || '{}');
      posted.push([url.pathname, b]);
      // THE REAL RULE, not a stub of it.
      if (url.pathname === '/api/scratchpad/image') {
        const beat = beats.find((x) => x.id === b.id);
        if (beat) swapArt(beat, b.url, b.src || null);
      }
      json({ ok: true, beats });
    });
  }
  if (url.pathname === '/api/scratchpad/inbox') return json({ count: 0, items: [], source: 'playground' });
  if (url.pathname === '/api/scratchpad/pads') return json({ count: 0, pads: [] });
  if (url.pathname === '/api/scratchpad/shelf') return json({ count: 0, clips: [] });
  if (url.pathname === '/api/scratchpad') return json({ beats, title: 'pick test', film: null, audios: [] });
  if (url.pathname === '/px.png' || url.pathname === '/scratchpad-sophie.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PIC);
  }
  // The shared three-way toggle: express.static serves both in production.
  // Without the CSS the toggle renders as a 4px sliver; without the JS the page
  // falls back to the old CYCLE, which would green-light the aim bug.
  if (url.pathname === '/tritoggle.css' || url.pathname === '/tritoggle.js') {
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, url.pathname.slice(1))));
  }
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

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  await page.goto(base + '/scratchpad.html');
  await page.evaluate((id) => window.openPad(id), 'pad');
  await page.waitForSelector('#pad .beat');

  // NOT offsetParent — the popup and the lightbox are position:fixed, whose
  // offsetParent is null however plainly visible they are (that read as a
  // closed popup for real while writing this).
  const shown = (sel) => page.$eval(sel, (el) => !el.hidden && el.getClientRects().length > 0);
  const box = (sel) => page.$eval(sel, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom };
  });
  const thumbs = () => page.$$eval('#verrow button', (bs) => bs.map((b) => ({
    url: new URL(b.querySelector('img').src).search, cur: b.classList.contains('cur'),
  })));
  const curSrc = () => page.$eval('#popimg', (el) => new URL(el.src).search);

  await page.click('#pad .beat');
  await page.waitForSelector('#beatpop:not([hidden])');
  await page.waitForFunction(() => {
    const im = document.getElementById('popimg');
    return im && !im.hidden && im.getBoundingClientRect().width > 0;
  });

  // the big picture on the card is NOT a picking surface — nothing to pick,
  // she is already looking at the beat's art
  await page.click('#popimg');
  await page.waitForSelector('#lightbox:not([hidden])');
  ok(!(await shown('#lbuse')), 'the beat\'s own picture opens big with no Use button');
  await page.click('#lightbox');
  ok(!(await shown('#lightbox')), 'and it closes on a tap');

  await page.click('#arvers');
  ok(await shown('#verrow'), 'the past pictures are open');
  let row = await thumbs();
  ok(row.length === 3, 'current + two older (' + row.length + ')');
  ok(row[0].cur && row[0].url === '?cur', 'the current one is first and ringed');

  // the CURRENT one in the row: still nothing to pick
  await page.click('#verrow button:nth-child(1)');
  await page.waitForSelector('#lightbox:not([hidden])');
  ok(!(await shown('#lbuse')), 'the ringed thumbnail offers no Use button either');
  await page.click('#lightbox');

  // an OLDER one: look at it big, then take it
  await page.click('#verrow button:nth-child(2)');
  await page.waitForSelector('#lightbox:not([hidden])');
  ok(await shown('#lbuse'), 'an older picture opens big WITH a way to take it');
  ok(await page.$eval('#lbimg', (el) => new URL(el.src).search) === '?old2',
    'and it is that picture on screen');
  const lbi = await box('#lbimg'), use = await box('#lbuse');
  ok(use.y >= lbi.b - 1, 'the button sits under the picture');
  ok(use.h > 0 && lbi.b + use.h < 780, 'the picture leaves room for it on a 390x780 phone');
  const rad = await page.$eval('#lbuse', (el) => getComputedStyle(el).borderRadius);
  ok(rad === '6px', 'house radius, never a pill (' + rad + ')');

  await page.click('#lbuse');
  await page.waitForFunction(() => document.getElementById('lightbox').hidden);
  ok(posted.some(([p, b]) => p === '/api/scratchpad/image' && b.url.indexOf('old2') >= 0),
    'tapping it POSTs /image for that picture');
  ok(await curSrc() === '?old2', 'the beat is showing the picked picture now');
  ok(await shown('#beatpop'), 'and the popup is still open on that beat');

  await page.click('#arvers');
  row = await thumbs();
  ok(row.length === 3, 'still three pictures — nothing was lost (' + row.length + ')');
  ok(new Set(row.map((r) => r.url)).size === 3, 'and none of them shows twice');
  ok(row[0].cur && row[0].url === '?old2', 'the picked one is now the ringed current');
  ok(row.some((r) => r.url === '?cur'), 'the one it replaced is in the row');

  // and the picked picture can be picked back
  await page.click('#verrow button:nth-child(2)');
  await page.waitForSelector('#lbuse:not([hidden])');
  await page.click('#lbuse');
  await page.waitForFunction(() => document.getElementById('lightbox').hidden);
  await page.click('#arvers');
  row = await thumbs();
  ok(row.length === 3 && new Set(row.map((r) => r.url)).size === 3,
    'swapping back and forth never grows or duplicates the row');

  // the pad behind the popup is repainted too — the tile is what she sees
  // when she closes the card
  ok(await page.$eval('#pad .beat img', (el) => new URL(el.src).search) === '?cur',
    'the pad tile shows the picture she picked back');

  await browser.close();
  server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall good');
  process.exit(failures ? 1 : 0);
})();
