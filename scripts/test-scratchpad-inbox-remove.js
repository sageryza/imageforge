#!/usr/bin/env node
// TAKING ONE OUT OF THE INBOX (Aug 2026, Sophie: "can you make a way to
// delete certain items from the inbox in story room?").
//
// The two things worth measuring here are both about a TAP:
//   - the ✕ must not reach the tile underneath it. The tile is a <button>
//     whose whole job is placing the picture, so a mark that let the tap
//     bubble would remove the picture AND start placing it in one gesture.
//     `elementFromPoint` at the mark's own centre is the only honest way to
//     ask what a tap actually lands on.
//   - the mark must be a rounded SQUARE at the house 6px, never a circle
//     (the 2026-08-24 rule).
// Plus the round trip: the tile leaves the grid at once, /inbox/hide is
// POSTed with that url, and the undo line puts it back — POSTing hide:false
// for the same url, because nothing here deletes a picture.
//
//   node scripts/test-scratchpad-inbox-remove.js
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

function png(r, g, b) {
  const w = 40, h = 60;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
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

// One phone upload and two Playground hearts — all three kinds of item the
// grid can hold except the clip shelf, which has no ✕ by design (a clip is
// REFERENCED from the library, never owned by the story).
const UP = '/px.png?up';
const A = '/px.png?a', B = '/px.png?b';
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
      posted.push([url.pathname, JSON.parse(body || '{}')]);
      json({ ok: true, beats: [] });
    });
  }
  if (url.pathname === '/api/scratchpad/inbox') {
    return json({
      count: 2, source: 'playground',
      items: [{ url: A }, { url: B }],
      uploads: [{ url: UP, kind: 'image' }],
    });
  }
  if (url.pathname === '/api/scratchpad/pads') return json({ count: 0, pads: [] });
  if (url.pathname === '/api/scratchpad/shelf') return json({ count: 0, clips: [] });
  if (url.pathname === '/api/scratchpad') return json({ beats: [], title: 'inbox test', film: null, audios: [] });
  if (url.pathname === '/px.png' || url.pathname === '/scratchpad-sophie.png' || url.pathname === '/api/story/thumb') {
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

  await page.click('#inboxbtn');
  await page.waitForSelector('#inbox:not([hidden])');
  await page.waitForFunction(() => document.querySelectorAll('#inboxgrid button').length === 3);

  // A phone upload's tile loads a DERIVED thumb, not the original, so its src
  // is /api/story/thumb?url=… — read the tag out of the whole url, decoded.
  const tiles = () => page.$$eval('#inboxgrid button img',
    (im) => im.map((i) => (decodeURIComponent(i.src).match(/px\.png\?(\w+)/) || [])[1] || '?'));
  const marks = () => page.$$eval('#inboxgrid .rmx', (m) => m.length);

  ok((await marks()) === 3, 'every tile carries a way out — the upload too');

  // The mark is a rounded SQUARE, never a circle (the house icon rule).
  const rad = await page.$eval('#inboxgrid .rmx', (el) => getComputedStyle(el).borderRadius);
  ok(rad === '6px', 'house radius on the mark, never a circle (' + rad + ')');

  // WHAT A TAP ACTUALLY REACHES. The tile is a <button>; if the mark were a
  // nested button, or let the tap bubble, this centre would answer the tile.
  const hit = await page.$eval('#inboxgrid button:nth-child(2) .rmx', (el) => {
    const r = el.getBoundingClientRect();
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { cls: t && t.className && String(t.className.baseVal || t.className),
             inMark: Boolean(t && t.closest('.rmx')),
             nested: Boolean(el.querySelector('button')) };
  });
  ok(hit.inMark, 'a tap at the mark\'s centre lands on the mark (' + hit.cls + ')');
  ok(!hit.nested, 'and it is not a button nested inside the tile button');

  // Take the FIRST heart out (tile 2 — the upload leads the grid).
  const before = await tiles();
  ok(before[0] === 'up' && before[1] === 'a', 'the grid is upload, then the hearts');
  await page.click('#inboxgrid button:nth-child(2) .rmx');
  await page.waitForFunction(() => document.querySelectorAll('#inboxgrid button').length === 2);
  const after = await tiles();
  ok(!after.includes('a'), 'the picture leaves the grid on the tap');
  ok(after.includes('up') && after.includes('b'), 'and nothing else moved');

  const hide = posted.filter(([p]) => p === '/api/scratchpad/inbox/hide');
  ok(hide.length === 1 && hide[0][1].url.indexOf('?a') >= 0 && hide[0][1].hide === true,
    'it POSTs /inbox/hide for that url');
  ok(!posted.some(([p]) => p === '/api/scratchpad/add'),
    'and it never placed the picture it removed');

  // The way back.
  ok(await page.$eval('#inboxundo', (el) => !el.hidden && /put the last one back/i.test(el.textContent)),
    'an undo line appears under the grid');
  await page.click('#inboxundo button');
  await page.waitForFunction(() => document.querySelectorAll('#inboxgrid button').length === 3);
  ok((await tiles()).includes('a'), 'the picture comes back');
  const back = posted.filter(([p, b]) => p === '/api/scratchpad/inbox/hide' && b.hide === false);
  ok(back.length === 1 && back[0][1].url.indexOf('?a') >= 0,
    'and the undo POSTs hide:false for it — nothing was ever deleted');
  ok(await page.$eval('#inboxundo', (el) => el.hidden),
    'with nothing left to put back the line goes away');

  await browser.close();
  server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall good');
  process.exit(failures ? 1 : 0);
})();
