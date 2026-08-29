#!/usr/bin/env node
// STEPPING THROUGH A BEAT'S PICTURES IN THE STORY ROOM LIGHTBOX (2026-08-26,
// Sophie: "in the story room, can you make it so that I can tap the right or
// left of the screen to see the next option if I have it in lightbox mode").
//
// The past-pictures row already held every generation a beat had had, and the
// lightbox opened exactly one of them — to see the next one she had to close,
// find the 44px thumbnail, and open again. The zones are the Playground's
// settled rule: a transparent 28% strip over the IMAGE AREA, nothing drawn,
// absent at the ends.
//
// SINCE 2026-08-28 THE ZONES ARE THE SHARED FILE'S OWN (`nav` on
// /asset-lightbox.js — Sophie: "create a single lightbox view, sync to all
// surfaces"): the box is #clightbox, a zone is .lbzone.prev/.lbzone.next and
// simply does not EXIST at an end, and closing is the shared contract — any
// dead space closes, the picture itself never does (its img is on the shared
// skip list everywhere, the Assets tab included).
//
//   node scripts/test-storyroom-lightbox-nav.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const servePublic = require('./lib/public-asset');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');

// A REAL-SIZED 2:3 picture — the lightbox sizes itself to the art, so a 1x1
// pixel would put the zones nowhere near it.
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
const beats = [{
  id: 'b1', url: CUR, text: 'the beat says this', color: null,
  imageHistory: [{ url: OLD1, at: 1 }, { url: OLD2, at: 2 }],
}, {
  id: 'b2', url: '/px.png?only', text: 'one picture ever', color: null, imageHistory: [],
}];

const server = http.createServer((req, res) => {
  // Anything the page links out of public/ — /feedkit.js, /tritoggle.*, …
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; });
    return req.on('end', () => json({ ok: true, beats }));
  }
  if (url.pathname === '/api/scratchpad/inbox') return json({ count: 0, items: [], source: 'playground' });
  if (url.pathname === '/api/scratchpad/pads') return json({ count: 0, pads: [] });
  if (url.pathname === '/api/scratchpad/shelf') return json({ count: 0, clips: [] });
  if (url.pathname === '/api/scratchpad') return json({ beats, title: 'nav test', film: null, audios: [] });
  if (url.pathname === '/px.png' || url.pathname === '/scratchpad-sophie.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PIC);
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

  // The shared lightbox shows/hides with style.display and rebuilds its
  // content per open — a zone or the cta simply does not exist when absent.
  const lbOpen = () => page.evaluate(() => {
    const el = document.getElementById('clightbox');
    return !!el && el.style.display === 'flex';
  });
  const waitLbOpen = () => page.waitForFunction(() => {
    const el = document.getElementById('clightbox');
    return el && el.style.display === 'flex';
  });
  const has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);
  const box = (sel) => page.$eval(sel, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom };
  });
  const at = () => page.$eval('#clightbox img', (el) => new URL(el.src).search);
  // The src changes the instant a step rebuilds the box, but the new <img>
  // has no LAYOUT until it loads — a tap aimed at the picture in that gap
  // lands on the backdrop and closes. Wait for the paint, not the attribute.
  const waitAt = (q) => page.waitForFunction((want) => {
    const im = document.querySelector('#clightbox img');
    return im && new URL(im.src).search === want && im.getBoundingClientRect().height > 0;
  }, q);
  // What a tap at a point actually REACHES — the only honest way to ask.
  const hit = (x, y) => page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px, py);
    return el ? ((el.id || '') + ' ' + (el.className || '') + ' ' + el.tagName) : 'none';
  }, [x, y]);

  await page.click('#pad .beat');
  await page.waitForSelector('#beatpop:not([hidden])');
  await page.waitForFunction(() => {
    const im = document.getElementById('popimg');
    return im && !im.hidden && im.getBoundingClientRect().width > 0;
  });

  await page.click('#popimg');
  await waitLbOpen();
  ok(await at() === '?cur', 'it opens on the beat\'s own picture');
  ok(!(await has('#clightbox .lbzone.prev')), 'nothing before the first one, so no left zone');
  ok(await has('#clightbox .lbzone.next'), 'and there IS a way onward');

  // NOTHING IS DRAWN in a zone — the whole point of a big target is that it
  // does not have to be shown, and a chip at the edge covers the art.
  const paint = await page.$eval('#clightbox .lbzone.next', (el) => {
    const cs = getComputedStyle(el);
    return {
      kids: el.childNodes.length, text: (el.textContent || '').trim(),
      bg: cs.backgroundColor, bimg: cs.backgroundImage,
      bw: cs.borderTopWidth + cs.borderRightWidth + cs.borderBottomWidth + cs.borderLeftWidth,
    };
  });
  ok(paint.kids === 0 && !paint.text, 'the zone draws no glyph and no text');
  ok(/rgba\(0, 0, 0, 0\)|transparent/.test(paint.bg) && paint.bimg === 'none', 'no plate behind it');
  ok(paint.bw === '0px0px0px0px', 'and no border');

  // The zone is sized to the PICTURE (.clwrap shrink-wraps the img), so the
  // Use button under it is never covered.
  const img = await box('#clightbox img'), next = await box('#clightbox .lbzone.next'),
    stage = await box('#clightbox .clwrap');
  ok(Math.abs(next.h - img.h) < 2, 'the zone runs the height of the picture (' + Math.round(next.h) + ' vs ' + Math.round(img.h) + ')');
  ok(next.w > 60 && next.w < stage.w * 0.35, 'a fat strip, not the whole screen (' + Math.round(next.w) + 'px)');
  ok(next.r <= img.r + 1, 'and it sits over the picture, not beside it');

  // TAPPING THE RIGHT OF THE PICTURE STEPS FORWARD.
  const midY = img.y + img.h / 2;
  ok((await hit(img.r - 8, midY)).indexOf('lbzone') >= 0, 'a tap at the right edge of the art reaches the zone');
  await page.mouse.click(img.r - 8, midY);
  await waitAt('?old2');
  ok(await at() === '?old2', 'it steps to the picture before it — the row\'s own order, newest first');
  ok(await has('#clightbox .lbcta'), 'an older picture carries the way to take it');
  ok((await has('#clightbox .lbzone.prev')) && (await has('#clightbox .lbzone.next')),
    'and both ways are open in the middle');
  ok(await lbOpen(), 'stepping never closes the lightbox');

  await page.mouse.click(img.x + 8, midY);
  await waitAt('?cur');
  ok(await at() === '?cur', 'a tap at the left edge steps back');
  ok(!(await has('#clightbox .lbcta')), 'and the current picture offers no Use button again');

  // THE END OF THE ROW IS THE END — the zone goes with it (the shared file
  // draws none for a null side); the picture itself never closes (the shared
  // skip list, same as every other surface), and any dead space does.
  await page.mouse.click(img.r - 8, midY);
  await waitAt('?old2');
  await page.mouse.click(img.r - 8, midY);
  await waitAt('?old1');
  ok(!(await has('#clightbox .lbzone.next')), 'the oldest picture has nothing after it');
  ok((await hit(img.r - 8, midY)).indexOf('lbzone') < 0, 'so that tap no longer reaches a zone');
  await page.mouse.click(img.r - 8, midY);
  ok(await lbOpen(), 'a tap landing on the picture stays open — the shared contract');
  await page.mouse.click(8, 8);
  await page.waitForFunction(() => {
    const el = document.getElementById('clightbox');
    return !el || el.style.display === 'none';
  });
  ok(!(await lbOpen()), 'and a dead-space tap closes it');

  // A BEAT WITH ONE PICTURE HAS NOTHING TO STEP THROUGH.
  await page.click('#beatpop .popclose, #popclose').catch(() => {});
  await page.evaluate(() => { const c = document.getElementById('beatpop'); if (c) c.hidden = true; });
  await page.click('#pad .beat:nth-of-type(2)').catch(async () => {
    await page.evaluate(() => document.querySelectorAll('#pad .beat')[1].click());
  });
  await page.waitForSelector('#beatpop:not([hidden])');
  await page.waitForFunction(() => {
    const im = document.getElementById('popimg');
    return im && !im.hidden && new URL(im.src).search === '?only';
  });
  await page.click('#popimg');
  await waitLbOpen();
  ok(!(await has('#clightbox .lbzone.prev')) && !(await has('#clightbox .lbzone.next')),
    'one picture, no zones at all');
  await page.mouse.click(8, 8);
  await page.waitForFunction(() => {
    const el = document.getElementById('clightbox');
    return !el || el.style.display === 'none';
  });
  ok(!(await lbOpen()), 'and a dead-space tap closes it');

  await browser.close();
  server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall good');
  process.exit(failures ? 1 : 0);
})();
