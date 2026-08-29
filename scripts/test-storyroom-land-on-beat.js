#!/usr/bin/env node
// LANDING A PICTURE ON A BEAT THAT ALREADY EXISTS (2026-08-28, Sophie: "i can
// only add between · I can't add to an existing moment by clicking that
// moment").
//
// Placing used to be GAPS ONLY: while she held a picture, a tap on a beat was
// a deliberate no-op. On a pad of empty beats waiting for art — which is what
// her Science story is — tapping the beat is the first thing anyone tries, and
// it did nothing at all.
//
// The write already existed (the beat popup's own "fill it in" posts /image
// with the beat's id); this is the second door onto it. So the test drives the
// REAL page and asks what the tap actually POSTs — a source assertion cannot
// tell a no-op from a landing.
//
//   node scripts/test-storyroom-land-on-beat.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { swapArt } = require('../pad-art');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');

function png(r, g, b) {
  const w = 200, h = 300;
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
const PIC = png(160, 120, 80);
const INBOX_PIC = '/px.png?inbox';

let beats;
let posted;
function reset() {
  beats = [
    { id: 'b1', text: 'It’s not a', color: null, url: null },
    { id: 'b2', text: 'superstition,', color: null, url: null },
  ];
  posted = [];
}
reset();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; });
    return req.on('end', () => {
      const b = JSON.parse(body || '{}');
      posted.push([url.pathname.replace('/api/scratchpad', ''), b]);
      // THE REAL RULES, not a stub of them: /image lands on one beat and banks
      // whatever it replaced, /add splices a new beat in at `at`.
      if (url.pathname === '/api/scratchpad/image') {
        const beat = beats.find((x) => x.id === b.id);
        if (beat) swapArt(beat, b.url, b.src || null);
      }
      if (url.pathname === '/api/scratchpad/add') {
        const at = Number.isInteger(b.at) ? b.at : beats.length;
        beats.splice(at, 0, { id: 'new' + posted.length, text: '', color: null, url: b.url || null });
      }
      json({ ok: true, beats });
    });
  }
  if (url.pathname === '/api/scratchpad/inbox') {
    return json({ count: 1, items: [{ url: INBOX_PIC, runId: 'r1', i: 0, prompt: 'a lab' }], uploads: [], source: 'playground' });
  }
  if (url.pathname === '/api/scratchpad/pads') return json({ count: 0, pads: [] });
  if (url.pathname === '/api/scratchpad/shelf') return json({ count: 0, clips: [] });
  if (url.pathname === '/api/scratchpad/send-match') return json({ matches: [] });
  if (url.pathname === '/api/scratchpad') return json({ beats, title: 'land test', film: null, audios: [] });
  if (url.pathname === '/px.png' || url.pathname === '/scratchpad-sophie.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PIC);
  }
  if (url.pathname === '/api/story/thumb') { res.writeHead(302, { Location: '/px.png' }); return res.end(); }
  if (url.pathname === '/tritoggle.css' || url.pathname === '/tritoggle.js' || url.pathname === '/pad-characters.js') {
    const type = url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript';
    let file = path.join(PUB, url.pathname.slice(1));
    if (!fs.existsSync(file)) file = path.join(__dirname, '..', url.pathname.slice(1));
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': type });
    return res.end(fs.readFileSync(file));
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

  const open = async () => {
    await page.goto(base + '/scratchpad.html');
    await page.evaluate((id) => window.openPad(id), 'pad');
    await page.waitForSelector('#pad .beat');
  };
  const arm = async () => {
    await page.click('#inboxbtn');
    await page.waitForSelector('#inboxgrid button');
    await page.click('#inboxgrid button:first-child');
    await page.waitForSelector('#pad .slot');
  };
  const shown = (sel) => page.$eval(sel, (el) => !el.hidden && el.getClientRects().length > 0);
  const paths = () => posted.map(([p]) => p);

  // ── 1. the ask itself ────────────────────────────────────────────────────
  await open();
  await arm();
  ok((await page.$$('#pad .slot')).length === 3, 'the gaps light up, as they always did');
  await page.click('#pad .beatwrap:nth-of-type(1) .beat');
  await page.waitForFunction(() => document.querySelectorAll('#pad .slot').length === 0);
  ok(paths().includes('/image'), 'tapping a moment POSTs /image — it lands ON that beat');
  ok(!paths().includes('/add'), 'and never /add — no new beat is made');
  const body = (posted.find(([p]) => p === '/image') || [])[1] || {};
  ok(body.id === 'b1', 'onto the beat she tapped (' + body.id + ')');
  ok(String(body.url).indexOf('inbox') >= 0, 'carrying the picture she was holding');
  ok(body.src && body.src.runId === 'r1', 'and its provenance, so the prompt comes back with it');
  await page.waitForSelector('#beatpop:not([hidden])');
  ok(await shown('#beatpop'), 'the beat opens — confirmation by sight');
  ok(await page.$eval('#pad .beatwrap:nth-of-type(1) .beat img', (el) => new URL(el.src).search) === '?inbox',
    'and the tile behind it is showing the picture');
  ok(beats[1].url == null, 'the beat she did not tap is untouched');

  // ── 2. a beat that ALREADY has art keeps it — the swap banks the old one ─
  reset();
  beats[0].url = '/px.png?first';
  await open();
  await arm();
  await page.click('#pad .beatwrap:nth-of-type(1) .beat');
  await page.waitForFunction(() => document.querySelectorAll('#pad .slot').length === 0);
  await page.waitForSelector('#beatpop:not([hidden])');
  ok(String(beats[0].url).indexOf('inbox') >= 0, 'the picture she landed is the beat\u2019s art now');
  ok((beats[0].imageHistory || []).some((h) => String(h.url).indexOf('first') >= 0),
    'and the one it replaced is banked in the past-pictures row, never destroyed');
  await page.evaluate(() => window.closeBeat && window.closeBeat());

  // ── 3. the gaps still place a NEW beat ───────────────────────────────────
  reset();
  await open();
  await arm();
  await page.click('#pad .slot:first-of-type');
  await page.waitForFunction(() => document.querySelectorAll('#pad .slot').length === 0);
  ok(paths().includes('/add') && !paths().includes('/image'),
    'tapping a gap still adds a beat between — nothing about placing moved');

  // ── 4. the + is a BLANK beat: it has no picture, so it lands nowhere ─────
  reset();
  await open();
  await page.click('#addbtn');
  await page.waitForSelector('#pad .slot');
  await page.click('#pad .beatwrap:nth-of-type(1) .beat');
  ok(posted.length === 0, 'an empty pending lands on no beat');
  ok((await page.$$('#pad .slot')).length === 3, 'and stays armed for a gap');

  await browser.close();
  server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall good');
  process.exit(failures ? 1 : 0);
})();
