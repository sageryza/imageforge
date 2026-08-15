#!/usr/bin/env node
/**
 * Drives the walkthrough page (scripts/build-walkthrough-page.js) in headless
 * Chromium against the repo's OWN public/compare.css + compare.js.
 *
 *   node scripts/test-walkthrough-page.js
 *
 * WHAT IT EXISTS TO PIN, and it is one thing: **the two things being compared
 * are SIDE BY SIDE.** V1 of this page laid the road out in order — first lap in
 * one card, second lap in a card further down — and Sophie's note was "if you
 * make a compare page, it might show what we're comparing things better". A
 * stacked comparison is not a comparison; you cannot hold two pictures in your
 * head across a scroll. So the test measures the real laid-out boxes and fails
 * if a pair's two images ever end up one above the other — which is also what
 * happens if the grid silently collapses on a narrow phone.
 *
 * It also covers the tab row (three tabs, one view each, the underline
 * measuring /3 rather than a copy-pasted /4) and no sideways overflow at 390px.
 *
 * Images are blocked: this is about where things sit, not what they look like,
 * and an offline run must not hang on Storage. Skips (exit 0) without
 * Playwright, the way the other page tests do. PW_CHROME points at a
 * container's pre-installed Chromium when its build number differs from the
 * one Playwright expects.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('skip — playwright not installed'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const PORT = 8747;

const html = execFileSync(process.execPath,
  [path.join(__dirname, 'build-walkthrough-page.js'), '--dry-run'],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24 });

const TYPES = { '.css': 'text/css', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html); }
  const f = path.join(PUB, url.replace(/^\//, ''));
  if (f.startsWith(PUB) && fs.existsSync(f) && fs.statSync(f).isFile()) {
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    return res.end(fs.readFileSync(f));
  }
  res.writeHead(404).end('no');
});

let failed = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) failed++; };

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch(
    process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
  );
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  // a blocked image still lays out, and its figure still has a box — which is
  // what the side-by-side check reads
  await page.route('**storage.googleapis.com/**', (r) => r.abort());
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.duo');

  const tabs = await page.$$('.tab');
  ok(tabs.length === 3, `three tabs (${tabs.length})`);

  const uw = await page.evaluate(() => {
    const r = document.getElementById('tabs');
    return { line: +getComputedStyle(r, '::after').width.replace('px', ''), box: r.clientWidth };
  });
  ok(Math.abs(uw.line - (uw.box - 56) / 3) < 1.5,
    `the underline measures (row - 56) / 3 (${uw.line.toFixed(1)} vs ${((uw.box - 56) / 3).toFixed(1)})`);

  let pairs = 0;
  for (let i = 0; i < 3; i++) {
    await tabs[i].click();
    await page.waitForTimeout(60);

    const shown = await page.evaluate(() => [0, 1, 2].filter((n) => !document.getElementById('view-' + n).hidden));
    ok(shown.length === 1 && shown[0] === i, `tab ${i} shows only #view-${i} (${shown.join(',') || 'none'})`);

    // THE ONE THAT MATTERS: every pair is two figures on the SAME row
    const rows = await page.evaluate(() => [...document.querySelectorAll('#view-0,#view-1,#view-2')]
      .filter((v) => !v.hidden)
      .flatMap((v) => [...v.querySelectorAll('.duo')])
      .map((d) => {
        const f = [...d.querySelectorAll('figure')].map((x) => x.getBoundingClientRect());
        return { n: f.length, sameTop: f.length === 2 && Math.abs(f[0].top - f[1].top) < 2,
          apart: f.length === 2 ? Math.round(f[1].left - f[0].left) : 0,
          card: d.closest('[data-item]') && d.closest('[data-item]').getAttribute('data-item') };
      }));
    rows.forEach((r) => {
      ok(r.n === 2, `${r.card}: exactly two things in the pair (${r.n})`);
      ok(r.sameTop && r.apart > 100, `${r.card}: side by side, not stacked (offset ${r.apart}px)`);
    });
    pairs += rows.length;

    // a card that isn't a pair would mean something got compared against nothing
    const loose = await page.evaluate(() => [...document.querySelectorAll('#view-0,#view-1,#view-2')]
      .filter((v) => !v.hidden)
      .flatMap((v) => [...v.querySelectorAll('.card')])
      .filter((c) => !c.querySelector('.duo'))
      .map((c) => c.getAttribute('data-item')));
    ok(!loose.length, `tab ${i}: every card is a comparison${loose.length ? ' — loose: ' + loose.join(', ') : ''}`);

    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(over <= 1, `tab ${i} does not overflow sideways (${over}px)`);
  }
  ok(pairs === 9, `nine pairs across the three tabs (${pairs})`);

  const items = await page.$$eval('[data-item]', (n) => n.length);
  ok(items === 9, `every pair carries data-item, so a note can be left on it (${items})`);

  await browser.close();
  server.close();
  console.log(failed ? `\n${failed} failed` : '\nall good');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
