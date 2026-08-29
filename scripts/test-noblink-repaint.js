#!/usr/bin/env node
// A REPAINT LOOP NEVER REBUILDS AN UNCHANGED PICTURE (2026-08-28, Sophie,
// after the Story Room fix: "it seems like this shud be the automatic best
// practices").
//
// The Story Room's blink had the same shape on three more pages: a poll or a
// reload wiping a container and recreating every <img> even when nothing
// changed, so the pictures flash blank and pop back on every tick. The rule
// is now in docs/design-rules.md (A REPAINT NEVER REBUILDS WHAT DID NOT
// CHANGE); this sweeps the three pages that had it:
//   * Freeform  — runCard re-assigned identical HTML every 2.5s poll tick
//   * Vector    — paintItems wiped the cell grid on every 2.5s job tick
//   * The Wall  — load() rebuilt the whole feed every 60s and on every
//                 return to the app
// The only honest assertion is NODE IDENTITY (an expando on each img): a src
// check passes on a freshly recreated img every time, which is exactly the
// bug. Each section also proves the guard is not a freeze — a REAL change
// still repaints.
//
//   node scripts/test-noblink-repaint.js
//
// playwright is an optionalDependency, so this skips cleanly without it.
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAABAAAAAQCAYAAAAf8/9hAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');
const PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

let failures = 0;
function ok(cond, name) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}

// One stub server for all three pages: html from public/, every png a pixel,
// the JSON per-route mutable so a section can change what the next poll sees.
let vectorJob = null;   // set per section
let wallImages = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname.startsWith('/api/vector/job/')) return json(vectorJob || { error: 'no job' });
  if (url.pathname === '/api/wall') return json({ images: wallImages });
  if (url.pathname === '/api/story/thumb') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PX); }
  if (url.pathname === '/api/freeform/refs') return json({ refs: [] });
  if (url.pathname === '/api/freeform/style') return json({ prefix: 'p', suffix: 's' });
  if (url.pathname === '/api/freeform/runs') return json({ runs: [] });
  if (url.pathname.startsWith('/api/')) return json({});
  if (url.pathname === '/px.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PX); }
  const f = path.join(PUB, url.pathname.replace(/^\//, ''));
  if (f.startsWith(PUB) && fs.existsSync(f) && fs.statSync(f).isFile()) {
    const t = f.endsWith('.html') ? 'text/html' : f.endsWith('.css') ? 'text/css' : 'text/javascript';
    res.writeHead(200, { 'Content-Type': t });
    return res.end(fs.readFileSync(f));
  }
  res.writeHead(404); res.end();
});

const markImgs = (page, sel) => page.evaluate((s) => {
  document.querySelectorAll(s).forEach((im) => { im._kept = true; });
}, sel);
const keptImgs = (page, sel) => page.evaluate((s) =>
  Array.from(document.querySelectorAll(s)).map((im) => Boolean(im._kept)), sel);

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});

  // ── FREEFORM: the pending card across identical poll ticks ────────────────
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
    await page.goto(base + '/freeform.html');
    const run = {
      id: 'r1', status: 'ready', prompt: 'a run in flight', outputs: 2,
      images: ['/px.png?one'], refs: ['/px.png?ref'],
    };
    await page.evaluate((r) => window.runCard(r), run);
    await page.waitForSelector('#run-r1 img');
    await markImgs(page, '#run-r1 img');
    // the poll's common case: the same doc back, twice
    await page.evaluate((r) => { window.runCard(r); window.runCard(r); }, run);
    let m = await keptImgs(page, '#run-r1 img');
    ok(m.length === 2 && m.every(Boolean),
      'freeform: identical poll ticks keep the card\'s img nodes');
    // the real change: the second picture lands
    run.images = ['/px.png?one', '/px.png?two'];
    await page.evaluate((r) => window.runCard(r), run);
    const srcs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#run-r1 .outs img')).map((i) => new URL(i.src).search));
    ok(srcs.length === 2 && srcs.includes('?two'),
      'freeform: a landed picture still repaints the card');
    await page.close();
  }

  // ── VECTOR: the cell grid across identical job ticks, and the pick ───────
  {
    vectorJob = {
      status: 'running', step: 'tracing',
      items: [
        { id: 'cat', png: '/px.png?cat', svg: '/px.png?cat', colors: [] },
        { id: 'dog', png: '/px.png?dog', svg: '/px.png?dog', colors: [] },
      ],
    };
    const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
    await page.addInitScript(() => {
      try { localStorage.setItem('vector_tool', JSON.stringify({ job: 'j1' })); } catch (e) {}
    });
    await page.goto(base + '/vector.html');
    await page.waitForSelector('#items img');
    await markImgs(page, '#items img');
    await page.waitForTimeout(5600);          // two-plus real 2.5s ticks
    let m = await keptImgs(page, '#items img');
    ok(m.length === 2 && m.every(Boolean),
      'vector: identical job ticks keep every cell\'s img node');
    // picking a cell toggles the class on the EXISTING buttons
    await page.click('#items button:nth-child(2)');
    m = await page.evaluate(() => ({
      kept: Array.from(document.querySelectorAll('#items img')).every((i) => i._kept),
      on: Array.from(document.querySelectorAll('#items button')).map((b) => b.className),
    }));
    ok(m.kept, 'vector: choosing a cell rebuilds nothing');
    ok(m.on[1] === 'on' && m.on[0] === '', 'vector: and the pick highlight moved');
    // a real change (a third item lands) still repaints
    vectorJob.items.push({ id: 'owl', png: '/px.png?owl', svg: '/px.png?owl', colors: [] });
    await page.waitForFunction(() => document.querySelectorAll('#items img').length === 3,
      null, { timeout: 15000 });
    ok(true, 'vector: a new cell landing still repaints the grid');
    vectorJob = { status: 'done', items: vectorJob.items };
    await page.close();
  }

  // ── THE WALL: the 60s reload with nothing new ────────────────────────────
  {
    wallImages = [
      { url: '/px.png?w1', folder: 'Dump', created: '2026-08-28T01:00:00Z' },
      { url: '/px.png?w2', folder: 'movies', created: '2026-08-27T01:00:00Z' },
    ];
    const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
    await page.goto(base + '/wall.html');
    await page.waitForSelector('#feed img');
    await markImgs(page, '#feed img');
    // the refresh-on-return path runs the same load() the 60s timer does
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(600);
    let m = await keptImgs(page, '#feed img');
    ok(m.length === 2 && m.every(Boolean),
      'wall: a reload with nothing new keeps every img node');
    // a new image landing still repaints — `shown` stays at the page size, so
    // the newest tile joins the top rather than a third appearing
    wallImages = [{ url: '/px.png?w0', folder: 'Dump', created: '2026-08-29T01:00:00Z' }].concat(wallImages);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(() => {
      const im = document.querySelector('#feed img');
      return im && im.src.indexOf('w0') !== -1;
    }, null, { timeout: 5000 });
    ok(true, 'wall: a new image landing still repaints the feed');
    await page.close();
  }

  await browser.close();
  server.close();
  console.log(failures ? failures + ' FAILED' : 'ALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
