#!/usr/bin/env node
// LEAVING A BEAT FILLS THE EMPTY HALF (2026-09-06, Sophie: "caption and
// drawing prompt shud auto copy into each other if i leave the beat and one
// exists but the other doesn't"). Drives the REAL public/scratchpad.html in
// headless Chromium against a stub API and reads what the page really POSTs:
//   1. a beat with a drawing prompt and NO caption: closing it POSTs /text
//      with the prompt's words, and the tile's caption shows them;
//   2. a beat with a caption and no prompt: closing it POSTs nothing — the
//      prompt already follows the caption by rule;
//   3. a beat with both: closing it POSTs nothing;
//   4. a beat with neither: nothing.
//   node scripts/test-storyroom-caption-copy.js
// (harness lifted from test-storyroom-chapters.js)
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const servePublic = require('./lib/public-asset');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');

// A real 2:3 picture (the tiles size themselves to the story's shape).
const PNG = (() => {
  const w = 200, h = 300;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1); raw[row] = 0;
    for (let x = 0; x < w; x++) { raw[row + 1 + x * 3] = 180; raw[row + 2 + x * 3] = 140; raw[row + 3 + x * 3] = 90; }
  }
  function crc32(buf) {
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
    return (crc ^ 0xffffffff) >>> 0;
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
})();

// Four beats, one per case.
let beats = [
  { id: 'b0', url: '/px.png?0', text: '', prompt: 'a fox in the snow', color: null },
  { id: 'b1', url: '/px.png?1', text: 'words of her own', prompt: '', color: null },
  { id: 'b2', url: '/px.png?2', text: 'a caption', prompt: 'a different prompt', color: null },
  { id: 'b3', url: '/px.png?3', text: '', prompt: '', color: null },
];
const posted = [];

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; });
    return req.on('end', () => {
      const b = JSON.parse(body || '{}');
      posted.push([url.pathname, b]);
      if (url.pathname === '/api/scratchpad/text') beats.forEach((x) => { if (x.id === b.id) x.text = b.text; });
      if (url.pathname === '/api/scratchpad/prompt') beats.forEach((x) => { if (x.id === b.id) { if (b.prompt) x.prompt = b.prompt; else delete x.prompt; } });
      json({ ok: true, beats });
    });
  }
  if (url.pathname === '/api/scratchpad/inbox') return json({ count: 0, items: [], source: 'playground' });
  if (url.pathname === '/api/scratchpad/pads') return json({ count: 0, pads: [] });
  if (url.pathname === '/api/scratchpad/shelf') return json({ count: 0, clips: [] });
  if (url.pathname === '/api/scratchpad') return json({ beats, title: 'copy test', film: null, audios: [] });
  if (url.pathname === '/px.png' || url.pathname === '/api/story/thumb' || url.pathname === '/scratchpad-sophie.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG);
  }
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
function ok(cond, name, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (cond || extra === undefined ? '' : '  — ' + JSON.stringify(extra)));
  if (!cond) failures++;
}

(async () => {
  ok(/function fillEmptyHalf/.test(fs.readFileSync(path.join(PUB, 'scratchpad.html'), 'utf8')), 'the built page carries fillEmptyHalf');
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  await page.goto(base + '/scratchpad.html');
  await page.evaluate((id) => window.openPad(id), 'pad');
  await page.waitForSelector('#pad .beatwrap');
  await page.waitForTimeout(150);

  const openClose = async (id) => {
    const from = posted.length;
    await page.evaluate((id) => window.openBeat(window.beatById(id)), id);
    await page.waitForTimeout(80);
    await page.evaluate(() => window.closeBeat());
    await page.waitForTimeout(250);
    return posted.slice(from).filter(([p]) => p === '/api/scratchpad/text' || p === '/api/scratchpad/prompt');
  };
  const tileCap = (id) => page.evaluate((id) => {
    const w = document.querySelector('#pad .beatwrap[data-beats~="' + id + '"]');
    const c = w && w.querySelector('.bcap');
    return c ? c.textContent : null;
  }, id);

  // 1. prompt, no caption
  ok((await tileCap('b0')) === null, 'before: the promptless-caption beat shows no caption under its tile');
  let p = await openClose('b0');
  ok(p.length === 1 && p[0][0] === '/api/scratchpad/text' && p[0][1].id === 'b0' && p[0][1].text === 'a fox in the snow',
    'leaving a beat with a prompt and no caption POSTs the prompt as its caption', p);
  ok((await tileCap('b0')) === 'a fox in the snow', 'and the tile now shows it as the caption');
  await page.evaluate((id) => window.openBeat(window.beatById(id)), 'b0');
  await page.waitForTimeout(80);
  const boxVal = await page.evaluate(() => document.getElementById('pnote').value);
  ok(boxVal === 'a fox in the snow', 'reopening the beat, the Caption box holds the words', boxVal);
  await page.evaluate(() => window.closeBeat());
  await page.waitForTimeout(200);

  // 2. caption, no prompt — the prompt already follows the caption; nothing is written
  p = await openClose('b1');
  ok(p.length === 0, 'leaving a beat with a caption and no prompt writes nothing (the prompt follows the caption by rule)', p);
  const follows = await page.evaluate((id) => window.promptOf(window.beatById(id)), 'b1');
  ok(follows === 'words of her own', 'and promptOf still answers the caption', follows);

  // 3. both
  p = await openClose('b2');
  ok(p.length === 0, 'a beat with both halves is left alone', p);

  // 4. neither
  p = await openClose('b3');
  ok(p.length === 0, 'a beat with neither is left alone', p);

  ok(errors.length === 0, 'no page errors', errors);
  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILED` : '\nall green');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
