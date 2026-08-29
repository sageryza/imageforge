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
// THE LIGHTBOX IS THE SHARED ONE since 2026-08-28 (/asset-lightbox.js —
// Sophie: "create a single lightbox view, sync to all surfaces … ex assets,
// meta assets, story room, playground"): the box is #clightbox, the pick
// button is its `cta` hook (.lbcta), and closing is the shared contract — a
// tap on any dead space closes, a tap on the picture never does.
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
const { swapArt, forgetArt } = require('../pad-art');
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
      if (url.pathname === '/api/scratchpad/image/forget') {
        const beat = beats.find((x) => x.id === b.id);
        if (beat) forgetArt(beat, b.url);
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
  // The shared lightbox shows/hides with style.display, and its content is
  // rebuilt per open — so "no Use button" is the element's absence.
  const lbOpen = () => page.evaluate(() => {
    const el = document.getElementById('clightbox');
    return !!el && el.style.display === 'flex';
  });
  const waitLbOpen = () => page.waitForFunction(() => {
    const el = document.getElementById('clightbox');
    return el && el.style.display === 'flex';
  });
  const waitLbClosed = () => page.waitForFunction(() => {
    const el = document.getElementById('clightbox');
    return !el || el.style.display === 'none';
  });
  const hasUse = () => page.evaluate(() => !!document.querySelector('#clightbox .lbcta'));
  // the backdrop's own top-left corner — inside #clightbox, on none of its
  // controls, the picture included
  const tapOut = () => page.mouse.click(8, 8);
  const box = (sel) => page.$eval(sel, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom };
  });
  // Each picture is a CELL — the thumbnail and its cull ✕ — so the row is
  // read off the thumbnails, never off every button inside it.
  const thumbs = () => page.$$eval('#verrow .verthumb', (bs) => bs.map((b) => ({
    url: new URL(b.querySelector('img').src).search, cur: b.classList.contains('cur'),
  })));
  const nthThumb = (n) => '#verrow .vercell:nth-child(' + n + ') .verthumb';
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
  await waitLbOpen();
  ok(!(await hasUse()), 'the beat\'s own picture opens big with no Use button');
  await tapOut();
  await waitLbClosed();
  ok(!(await lbOpen()), 'and it closes on a dead-space tap');
  ok(await page.evaluate(() => document.body.style.overflow === 'hidden'),
    'the beat popup keeps its scroll lock after the close (onClose re-asserts it)');

  await page.click('#arvers');
  ok(await shown('#verrow'), 'the past pictures are open');
  let row = await thumbs();
  ok(row.length === 3, 'current + two older (' + row.length + ')');
  ok(row[0].cur && row[0].url === '?cur', 'the current one is first and ringed');

  // the CURRENT one in the row: still nothing to pick
  await page.click(nthThumb(1));
  await waitLbOpen();
  ok(!(await hasUse()), 'the ringed thumbnail offers no Use button either');
  await tapOut();
  await waitLbClosed();

  // an OLDER one: look at it big, then take it
  await page.click(nthThumb(2));
  await waitLbOpen();
  ok(await hasUse(), 'an older picture opens big WITH a way to take it');
  ok(await page.$eval('#clightbox img', (el) => new URL(el.src).search) === '?old2',
    'and it is that picture on screen');
  const lbi = await box('#clightbox img'), use = await box('#clightbox .lbcta');
  ok(use.y >= lbi.b - 1, 'the button sits under the picture');
  ok(use.h > 0 && lbi.b + use.h < 780, 'the picture leaves room for it on a 390x780 phone');
  const rad = await page.$eval('#clightbox .lbcta', (el) => getComputedStyle(el).borderRadius);
  ok(rad === '6px', 'house radius, never a pill (' + rad + ')');

  await page.click('#clightbox .lbcta');
  await waitLbClosed();
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
  await page.click(nthThumb(2));
  await page.waitForSelector('#clightbox .lbcta');
  await page.click('#clightbox .lbcta');
  await waitLbClosed();
  await page.click('#arvers');
  row = await thumbs();
  ok(row.length === 3 && new Set(row.map((r) => r.url)).size === 3,
    'swapping back and forth never grows or duplicates the row');

  // the pad behind the popup is repainted too — the tile is what she sees
  // when she closes the card
  ok(await page.$eval('#pad .beat img', (el) => new URL(el.src).search) === '?cur',
    'the pad tile shows the picture she picked back');

  // ── THE CULL (2026-08-28, Sophie: "how to cull beat pictures") ────────
  // The row is the one place that shows every picture a beat has, so it is
  // where one comes off. The ✕ is a SIBLING of the thumbnail, never nested —
  // a button inside a button is invalid and the tap would open the picture.
  ok(await page.$eval(nthThumb(1), (el) => !el.querySelector('button')),
    'the cull is not inside the thumbnail button');
  const cull = (n) => '#verrow .vercell:nth-child(' + n + ') .vercull';
  ok(await shown(cull(1)), 'every picture in the row carries one');
  const crad = await page.$eval(cull(1), (el) => getComputedStyle(el).borderRadius);
  ok(crad === '6px', 'rounded square at the house 6px, never a circle (' + crad + ')');
  // What a tap at its centre actually reaches — the honest question, since a
  // badge over a 44px thumbnail is exactly where a mis-tap would open the
  // picture instead.
  const cb = await box(cull(2));
  const hit = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el && el.closest('button') ? el.closest('button').className : 'none';
  }, [cb.x + cb.w / 2, cb.y + cb.h / 2]);
  ok(/vercull/.test(hit), 'and a tap on it reaches the cull, not the thumbnail (' + hit + ')');

  // An OLDER picture: off the row, the beat's art untouched.
  let before = (await thumbs()).map((r) => r.url);
  const drop = before[1];
  await page.click(cull(2));
  await page.waitForFunction((n) => document.querySelectorAll('#verrow .verthumb').length === n,
    before.length - 1);
  ok(posted.some(([pth, b]) => pth === '/api/scratchpad/image/forget' && b.url.indexOf(drop.slice(1)) >= 0),
    'it POSTs /image/forget for that picture');
  row = await thumbs();
  ok(!row.some((r) => r.url === drop), 'the picture is off the beat (' + row.map((r) => r.url).join() + ')');
  ok(row[0].url === before[0], 'and the beat\'s art is untouched');
  ok(await shown('#verrow'), 'the row stays OPEN, so culling several is one tap each');
  ok(await shown('#beatpop'), 'and the popup stays on the beat');

  // The CURRENT one: "no, not that one" shows the previous one.
  before = (await thumbs()).map((r) => r.url);
  await page.click(cull(1));
  await page.waitForFunction((u) => {
    const im = document.getElementById('popimg');
    return im && !new URL(im.src).search.startsWith(u);
  }, before[0]);
  ok(await curSrc() === before[1], 'culling the current one promotes the next picture in the row');
  row = await thumbs();
  ok(row.length === 1 && row[0].url === before[1] && row[0].cur,
    'which is the ringed current, once (' + row.map((r) => r.url).join() + ')');

  // The LAST one: the side is simply left with no picture — and the row must
  // still have been reachable to get here, which is why it opens at one.
  ok(await shown('#arvers'), 'the row is reachable with a single picture left');
  await page.click(cull(1));
  await page.waitForFunction(() => document.getElementById('popimg').hidden
    || !document.getElementById('popimg').getAttribute('src'));
  ok(await page.$eval('#pad .beat', (el) => !el.querySelector('img')),
    'the beat keeps its place with no picture at all');
  ok(await page.$eval('#pnote', (el) => el.value === 'the beat says this'),
    'and its words');

  await browser.close();
  server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall good');
  process.exit(failures ? 1 : 0);
})();
