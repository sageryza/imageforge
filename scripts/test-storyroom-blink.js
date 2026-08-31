#!/usr/bin/env node
// THE CANVAS ONLY REPAINTS WHAT CHANGED (2026-08-28, Sophie: "story room
// blinks a lot").
//
// render() used to wipe #pad and rebuild every tile on every call — and the
// draw poll calls it every 4 seconds for the whole life of a 30-90s draw,
// closing the beat popup calls it, every POST that answers with beats calls
// it. Each rebuild recreated every <img> with the full-size original, which
// decodes async on iOS, so the whole canvas flashed blank and popped back.
//
// The only honest test is NODE IDENTITY: a tile that did not blink is the
// same DOM node after the repaint. A src assertion passes on a freshly
// recreated img every time, which is exactly the bug. So each img is marked
// with an expando and the mark is asked for after every path that used to
// wipe the canvas:
//   * the real draw poll ticking with nothing changed (the 4-second strobe)
//   * a picture LANDING — the changed tile rebuilds, its neighbours keep
//     their nodes
//   * closing the beat popup with nothing edited
//   * a reorder — the units move, their decoded imgs move with them
// And because a kept node's closures outlive a `beats=d.beats` swap, a tap
// on a kept tile must open the CURRENT beat object, never the one captured
// at build time.
//
//   node scripts/test-storyroom-blink.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
// SCRATCHPAD_HTML overrides the served page — how this test was verified
// failing against the pre-fix page (git show <old>:public/scratchpad.html).
const PAGE = process.env.SCRATCHPAD_HTML || path.join(PUB, 'scratchpad.html');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

// b1 is DRAWING (the state the poll exists for); b2 and b3 already have
// their pictures — the neighbours that must not blink while b1 cooks.
let beats = [
  { id: 'b1', text: 'the drawing beat', color: null, gen: { status: 'drawing' } },
  { id: 'b2', url: '/px.png?two', text: 'beat two', color: null },
  { id: 'b3', url: '/px.png?three', text: 'beat three', color: 'blue' },
];

const server = http.createServer((req, res) => {
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
  if (url.pathname === '/api/scratchpad') return json({ beats, title: 'blink test', film: null, audios: [] });
  if (url.pathname === '/px.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  if (url.pathname === '/scratchpad-sophie.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  if (url.pathname === '/tritoggle.css' || url.pathname === '/tritoggle.js') {
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return res.end(fs.readFileSync(path.join(PUB, url.pathname.slice(1))));
  }
  if (url.pathname === '/scratchpad.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(PAGE));
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
  await page.waitForSelector('#pad img');

  // Mark every tile img so a recreated node is tellable from a kept one.
  const mark = () => page.evaluate(() => {
    document.querySelectorAll('#pad img').forEach((im) => { im._kept = im.src; });
  });
  const marks = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('#pad img')).map((im) => Boolean(im._kept)));

  // ── the 4-second strobe: the real poll ticking with NOTHING changed
  await mark();
  await page.evaluate(() => window.startGenPoll());
  await page.waitForTimeout(9500);           // two-plus real ticks
  let m = await marks();
  ok(m.length === 2 && m.every(Boolean),
    'the draw poll ticking with nothing changed keeps every img node (no 4s strobe)');

  // ── a picture LANDS on b1: its tile rebuilds, the neighbours keep theirs
  beats = beats.map((b) => (b.id === 'b1'
    ? { id: 'b1', text: 'the drawing beat', color: null, url: '/px.png?landed' } : b));
  await page.waitForFunction(() => document.querySelectorAll('#pad img').length === 3,
    null, { timeout: 15000 });
  m = await page.evaluate(() => {
    const by = {};
    document.querySelectorAll('#pad img').forEach((im) => { by[new URL(im.src).search] = Boolean(im._kept); });
    return by;
  });
  ok(m['?landed'] === false, 'the landed picture is a fresh tile');
  ok(m['?two'] === true && m['?three'] === true,
    'and its neighbours kept their decoded img nodes (one tile repaints, not the canvas)');

  // ── a kept tile's tap opens the CURRENT beat, not the object it captured
  //    (the poll has swapped `beats` for fresh objects since the tiles built)
  await page.evaluate(() => {
    const tiles = document.querySelectorAll('#pad .beat');
    tiles[1].click();                        // b2 — a kept node
  });
  await page.waitForSelector('#beatpop:not([hidden])');
  ok(await page.evaluate(() => window.popBeat === window.beats.find((b) => b.id === 'b2')),
    'a tap on a kept tile resolves its beat by id at tap time');

  // ── closing the popup with nothing edited does not blink the canvas
  await mark();
  await page.evaluate(() => window.closeBeat());
  await page.waitForTimeout(300);
  m = await marks();
  ok(m.length === 3 && m.every(Boolean), 'closing the beat popup untouched keeps every img node');

  // ── an honest change still repaints — the caption edit rebuilds ITS unit
  await mark();
  await page.evaluate(() => {
    window.beats = window.beats.map((b) => (b.id === 'b2' ? Object.assign({}, b, { text: 'beat two, reworded' }) : b));
    window.render();
  });
  m = await page.evaluate(() => {
    const by = {};
    document.querySelectorAll('#pad img').forEach((im) => { by[new URL(im.src).search] = Boolean(im._kept); });
    return { by, cap: Array.from(document.querySelectorAll('#pad .bcap')).map((c) => c.textContent) };
  });
  ok(m.cap.includes('beat two, reworded'), 'a caption edit reaches the screen');
  ok(m.by['?two'] === false, 'its own unit rebuilt');
  ok(m.by['?three'] === true && m.by['?landed'] === true, 'the other units kept their nodes');

  // ── a reorder moves the decoded tiles instead of redrawing them
  await mark();
  await page.evaluate(() => {
    window.beats = [window.beats[2], window.beats[1], window.beats[0]];
    window.render();
  });
  m = await page.evaluate(() => ({
    order: Array.from(document.querySelectorAll('#pad img')).map((im) => new URL(im.src).search),
    kept: Array.from(document.querySelectorAll('#pad img')).every((im) => im._kept),
  }));
  ok(m.order[0] === '?three', 'the reorder reached the screen');
  ok(m.kept, 'and every img node moved instead of being redrawn');

  await browser.close();
  server.close();
  console.log(failures ? failures + ' FAILED' : 'ALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
