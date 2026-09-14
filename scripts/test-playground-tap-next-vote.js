#!/usr/bin/env node
// THE WALK SURVIVES A MARK THAT TAKES THE PICTURE OFF THE WALL (2026-09-05,
// Sophie: "tap left right doesn't always work in the playground").
//
// A vote re-renders the feed, and with ♥-only or hide-✕ lit — which IS
// reviewing a batch — hearting or crossing out the OPEN picture removes it
// from the wall. The re-render repaints the lightbox, its place resolves to
// -1, and pre-fix BOTH tap zones vanished: tap left, tap right, nothing, and
// the next tap closed the box. Exactly the heart · next · heart · next loop
// the zones exist for. The Assets tab and Meta Assets got this fix on
// 2026-09-03; CLAUDE.md named the Playground as "the same shape and NOT
// fixed". Her PLACE is the fallback now: the wall closed up over the gap, so
// whatever stands at the index she held is the next picture.
//
// Drives the REAL public/promptlab.html headless against a STATEFUL stub (the
// vote must come back in the next feed read, or the re-render would put the
// picture straight back and the bug could not be reproduced). Every check is
// a MEASUREMENT — a zone that is not in the DOM and one that is drawn look
// identical to any source assertion.
//   1. hide-✕ lit, ✕ on the open picture → the picture leaves the wall, the
//      next zone is STILL DRAWN, tapping it lands on the picture that closed up
//      over the gap, the lightbox stays open.
//   2. ♥-only lit, un-♥ the open picture (one of three) → the same walk, and
//      the previous zone still works too.
//   3. the last picture leaving the wall → no next zone (honest end), the
//      previous zone lands on the new last one.
//
//   npm install playwright --no-save && node scripts/test-playground-tap-next-vote.js
const http = require('http');
const servePublic = require('./lib/public-asset');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const T0 = 1786000000000;

function fixture() {
  return [
    { id: 'run0', votes: { 0: 'like', 1: 'like' } },
    { id: 'run1', votes: {} },
    { id: 'run2', votes: { 0: 'like' } },
  ].map((r, i) => ({
    id: r.id,
    prompt: 'prompt number ' + i,
    status: 'done',
    engine: 'gptimage',
    model: 'gpt-image-2',
    quality: 'medium',
    aspectRatio: '2:3',
    images: ['/px.png?r=' + r.id + '&i=0', '/px.png?r=' + r.id + '&i=1'],
    votes: r.votes,
    createdAt: T0 - i * 60000,
  }));
}
let RUNS = fixture();
const votesSeen = [];

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/promptlab') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs: RUNS, more: false }));
  }
  const vm = /^\/api\/promptlab\/([^/]+)\/vote$/.exec(url.pathname);
  if (vm && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const j = JSON.parse(body || '{}');
      const r = RUNS.find((x) => x.id === vm[1]);
      if (r) { if (j.vote) r.votes[j.image] = j.vote; else delete r.votes[j.image]; }
      votesSeen.push(vm[1] + '#' + j.image + '=' + (j.vote || ''));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  if (url.pathname.startsWith('/api/gallery/assets/note')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ thread: [] }));
  }
  if (url.pathname === '/px.png') {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536">' +
      '<rect width="1024" height="1536" fill="#8a7f70"/></svg>');
  }
  if (url.pathname === '/' || url.pathname === '/playground') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8'));
  }
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{}');
  }
  res.writeHead(404).end();
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find((p) => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => fail('page error: ' + e.message));

  const openNow = () => page.evaluate(() => {
    const lb = document.getElementById('clightbox');
    return !!lb && lb.style.display !== 'none';
  });
  const cur = () => page.evaluate(() => lbCur.id + '#' + lbCur.i);
  const wall = () => page.locator('#tiles .cell:not(.ph) img').evaluateAll(
    (els) => els.map((e) => e.getAttribute('data-run') + '#' + e.getAttribute('data-i')));
  const prev = page.locator('#clightbox .lbzone.prev'), next = page.locator('#clightbox .lbzone.next');
  const waitWall = (n) => page.waitForFunction(
    (n) => document.querySelectorAll('#tiles .cell:not(.ph) img').length === n, n, { timeout: 8000 });
  // The zone is asked with elementFromPoint at the picture's edge — the only
  // honest question — and a tap lands there rather than on a locator.
  const tapSide = async (side) => {
    const img = await page.locator('#clightbox .clwrap img').boundingBox();
    const x = side === 'next' ? img.x + img.width - 24 : img.x + 24;
    const y = img.y + img.height / 2;
    const hit = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      const z = el && el.closest('.lbzone');
      return z ? z.className : (el ? (el.id || el.className || el.tagName) : 'nothing');
    }, [Math.round(x), Math.round(y)]);
    await page.mouse.click(x, y);
    return hit;
  };
  const open = async (run, i) => {
    await page.locator('#tiles .cell img[data-run="' + run + '"][data-i="' + i + '"]').click();
    await page.waitForFunction(() => {
      const lb = document.getElementById('clightbox');
      return !!lb && lb.style.display !== 'none';
    });
  };
  const castAndSettle = async (kind, wallAfter) => {
    const before = votesSeen.length;
    await page.locator('#clightbox .vote.' + (kind === 'like' ? 'heart' : 'nope')).click();
    await waitWall(wallAfter);
    // the vote reached the stub and the re-render has repainted the lightbox
    if (votesSeen.length !== before + 1) fail('the vote did not reach the server (' + votesSeen.join(',') + ')');
    await page.waitForTimeout(150);
  };

  // ── 1. hide-✕ lit, ✕ on the open picture ─────────────────────────────────
  // The init script seeds ONCE (sessionStorage survives the reloads below, so
  // the later phases' own filter settings are not overwritten).
  await page.addInitScript(() => {
    localStorage.setItem('promptlab_view', 'tiles');
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('promptlab_hidex', '1');
    }
  });
  await page.goto(base + '/playground');
  await waitWall(6);
  if ((await wall()).join() !== 'run0#0,run0#1,run1#0,run1#1,run2#0,run2#1')
    fail('the wall opened as ' + (await wall()).join());
  if (!(await page.locator('#v-hidex').evaluate((el) => el.classList.contains('on')))) fail('hide-✕ is not lit');

  await open('run1', 0);
  if (!(await prev.count()) || !(await next.count())) fail('1: zones missing from the middle of the wall before any mark');
  await castAndSettle('dislike', 5);
  if ((await wall()).indexOf('run1#0') >= 0) fail('1: the ✕ did not take the picture off the wall — the bug cannot be reproduced');
  if (!(await openNow())) fail('1: the re-render closed the lightbox');
  if (await cur() !== 'run1#0') fail('1: the lightbox moved off the marked picture on its own to ' + await cur());
  if (!(await next.count())) fail('1: the NEXT zone is gone after the ✕ took the picture off the wall');
  if (!(await prev.count())) fail('1: the PREV zone is gone after the ✕ took the picture off the wall');
  const hit1 = await tapSide('next');
  if (String(hit1).indexOf('next') < 0) fail('1: a tap at the right edge reaches ' + hit1 + ', not the next zone');
  if (!(await openNow())) fail('1: tapping next after the ✕ closed the lightbox');
  if (await cur() !== 'run1#1') fail('1: next after the ✕ landed on ' + await cur() + ', expected run1#1 (what closed up over the gap)');
  // and back: the one before her old place is still the previous one
  await tapSide('prev');
  if (await cur() !== 'run0#1') fail('1: prev from the closed-up picture landed on ' + await cur() + ', expected run0#1');
  await page.evaluate(() => closeLB());

  // ── 2. ♥-only lit, un-♥ the middle hearted picture ────────────────────────
  RUNS = fixture();
  votesSeen.length = 0;
  await page.evaluate(() => { localStorage.setItem('promptlab_hidex', '0'); localStorage.setItem('promptlab_liked', '1'); });
  await page.reload();
  await waitWall(3);
  if ((await wall()).join() !== 'run0#0,run0#1,run2#0') fail('2: the hearted wall is ' + (await wall()).join());
  await open('run0', 1);
  await castAndSettle('like', 2);   // tap again to clear
  if ((await wall()).join() !== 'run0#0,run2#0') fail('2: un-hearting left the wall as ' + (await wall()).join());
  if (!(await next.count())) fail('2: the NEXT zone is gone after un-hearting the open picture');
  if (!(await prev.count())) fail('2: the PREV zone is gone after un-hearting the open picture');
  await tapSide('prev');
  if (await cur() !== 'run0#0') fail('2: prev after the un-♥ landed on ' + await cur() + ', expected run0#0');
  if (!(await openNow())) fail('2: stepping closed the lightbox');
  // the healed walk: from a picture still on the wall, next is the ordinary next
  await tapSide('next');
  if (await cur() !== 'run2#0') fail('2: next from run0#0 landed on ' + await cur() + ', expected run2#0');
  await page.evaluate(() => closeLB());

  // ── 3. the LAST picture leaves: no next zone (honest end), prev lands ─────
  RUNS = fixture();
  votesSeen.length = 0;
  await page.reload();
  await waitWall(3);
  await open('run2', 0);
  if (await next.count()) fail('3: a next zone at the end of the wall');
  await castAndSettle('like', 2);
  if (await next.count()) fail('3: a NEXT zone was drawn past the end of the wall after the last picture left');
  if (!(await prev.count())) fail('3: the PREV zone is gone after the last picture left the wall');
  await tapSide('prev');
  if (await cur() !== 'run0#1') fail('3: prev after the last picture left landed on ' + await cur() + ', expected run0#1');
  if (!(await openNow())) fail('3: stepping closed the lightbox');

  await browser.close();
  server.close();
  if (!process.exitCode) console.log('PASS: the Playground lightbox keeps stepping after a mark takes the open picture off the wall');
})().catch((e) => { console.error(e); process.exit(1); });
