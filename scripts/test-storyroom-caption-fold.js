#!/usr/bin/env node
// THE FOLDS ARE HERS (2026-08-26, Sophie: "the caption keeps reopening after
// I close it on a beat in story room").
//
// openBeat set the two folds to their ARRIVAL defaults — caption open, prompt
// open only on a picture-less beat — on every call, guarded only by `typing`,
// i.e. only while a box actually held her caret. So closing the caption and
// then doing anything that re-opens the same beat sprang it straight back
// open. Four call sites do that, and the first one takes no tap of hers at
// all:
//   * the gen poll landing a finished draw (startGenPoll → openBeat)
//   * Draw itself
//   * picking a past picture out of the lightbox
//   * a chunk link / unlink
// The defaults belong to ARRIVING at a beat, not to every repaint of the one
// she is standing on — so this drives the REAL poll (a beat that is drawing
// when she opens it, landing while she watches) and then the direct re-open
// every other call site makes, and measures the fold both ways round.
//
//   node scripts/test-storyroom-caption-fold.js
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
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

// b1 is DRAWING when she opens it — the state the poll exists for; b2 has its
// picture already, so arriving at it is the plain default case.
let beats = [
  { id: 'b1', text: 'the drawing beat', color: null, gen: { status: 'drawing' } },
  { id: 'b2', url: '/px.png?two', text: 'the other beat', color: null },
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
  if (url.pathname === '/api/scratchpad') return json({ beats, title: 'fold test', film: null, audios: [] });
  if (url.pathname === '/px.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  if (url.pathname === '/scratchpad-sophie.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  // express.static serves these in production; without the JS the page falls
  // back to the toggle's old cycle, which has nothing to do with this test but
  // would throw on the way in.
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

  // The fold is the button's own aria-expanded — the same thing openBeat
  // reads — plus what is actually on screen, since a fold that says shut
  // while its box still shows is the bug wearing a disguise.
  const folds = () => page.evaluate(() => ({
    cap: document.getElementById('caplab').getAttribute('aria-expanded') === 'true',
    capShown: !document.getElementById('capview').hidden,
    prom: document.getElementById('promlab').getAttribute('aria-expanded') === 'true',
    promShown: !document.getElementById('drawbox').hidden,
  }));

  // ── arriving at the drawing beat: both boxes open (a picture-less beat)
  await page.click('#pad .beat');
  await page.waitForSelector('#beatpop:not([hidden])');
  let f = await folds();
  ok(f.cap && f.capShown, 'arriving at the beat, the caption is open');
  ok(f.prom && f.promShown, 'and so is the drawing prompt (nothing drawn yet)');

  // ── she closes the caption
  await page.click('#caplab');
  f = await folds();
  ok(!f.cap && !f.capShown, 'tapping Caption closes it');

  // ── THE POLL LANDS A PICTURE. No tap of hers anywhere in this block.
  await page.evaluate(() => window.startGenPoll());
  beats = beats.map((b) => (b.id === 'b1' ? { id: 'b1', text: 'the drawing beat', color: null, url: '/px.png?landed' } : b));
  await page.waitForFunction(() => {
    const b = (window.beats || []).find((x) => x.id === 'b1');
    return b && b.url && !(b.gen && b.gen.status === 'drawing');
  }, null, { timeout: 15000 });
  await page.waitForTimeout(150);
  f = await folds();
  ok(!f.cap && !f.capShown, 'a finished draw landing does NOT reopen the caption');
  ok(await page.$eval('#popimg', (el) => !el.hidden), 'and the picture still lands on the card');

  // ── the other three call sites all re-open the same beat outright
  await page.evaluate(() => window.openBeat(window.beats.find((x) => x.id === 'b1')));
  f = await folds();
  ok(!f.cap && !f.capShown, 'a re-open of the beat already on screen leaves it closed');
  ok(f.prom && f.promShown, 'and leaves the prompt fold exactly as she left it too');

  // ── the defaults still belong to ARRIVING at a beat
  await page.evaluate(() => window.closeBeat());
  await page.waitForFunction(() => document.getElementById('beatpop').hidden);
  await (await page.$$('#pad .beat'))[1].click();
  await page.waitForSelector('#beatpop:not([hidden])');
  f = await folds();
  ok(f.cap && f.capShown, 'walking to ANOTHER beat opens the caption again');
  ok(!f.prom && !f.promShown, 'with the prompt folded away, since that beat has its picture');

  // ── and a beat she comes back to opens on the defaults, not on last time's
  await page.click('#caplab');
  ok(!(await folds()).cap, 'she closes the caption there too');
  await page.evaluate(() => window.closeBeat());
  await page.waitForFunction(() => document.getElementById('beatpop').hidden);
  await (await page.$$('#pad .beat'))[1].click();
  await page.waitForSelector('#beatpop:not([hidden])');
  f = await folds();
  ok(f.cap && f.capShown, 'closing the card and opening it again is ARRIVING — the caption is back');

  await browser.close();
  server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall good');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
