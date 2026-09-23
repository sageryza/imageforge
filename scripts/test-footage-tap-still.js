#!/usr/bin/env node
/* THE BLOCK SHE TAPS STAYS UNDER HER FINGER (2026-09-23, Sophie, on Footage:
 * "at various times it still switches rapidly between screens when i put my
 * cursor down · i'm going to get epilepsy").
 *
 * Making a block active moves the characters-and-setting heading to sit above
 * it and swaps the strip to its pictures. Measured at 390x844 before the fix:
 * the box she tapped moved 32px with the heading folded and 91-258px with it
 * open, at the moment of the tap. Now the page scrolls by whatever moved, the
 * other way, so the block she is going to is exactly where it was.
 *
 * Every assertion is a measurement of the tapped box's own rect, before the
 * tap and after it, tapped with a real touch through the page's own handlers.
 * The one case it cannot hold is named rather than tested: at the very top of
 * the page there is no scroll above to give back.
 *
 * Run: node scripts/test-footage-tap-still.js
 */
'use strict';

const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public');
const servePublic = require('./lib/public-asset');
const F = require('../footage');
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) { console.log('footage tap still: playwright not installed — skipped'); process.exit(0); }
}
function exe() {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return undefined;
  for (const d of fs.readdirSync(root).filter((n) => /^chromium-\d/.test(n))) {
    const p = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
const KB = 336;
const long = (tag, n) => Array.from({ length: n }, (_, i) => tag + ' line ' + (i + 1) + ' — the moon waits at the window and she writes back').join('\n');
const IMG = (n) => 'https://example.test/pic' + n + '.png';
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  let body = ''; req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/footage') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8')); }
    if (u.pathname === '/api/footage/status') return json({ ok: true, doors: { atlascloud: true }, chat: 'footage', balances: { atlascloud: { configured: true } }, models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)), ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
    if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', exact: true });
    if (u.pathname === '/api/footage/jobs') return json({ ok: true, jobs: [], more: false, folders: {} });
    if (u.pathname === '/api/footage/sent') return json({ ok: true, sent: {} });
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, notes: [] });
    if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
    if (/\.png$/.test(u.pathname)) { res.writeHead(404); return res.end(); }
    res.writeHead(404); res.end('{}');
  });
});
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const draft = { prompt: long('A', 30), blocks: [long('B', 4), long('C', 30)], active: 0,
    heads: { setting: 'the bedroom at night' }, chars: ['the girl is [Image1]', '', 'the moon is [Image1]'],
    jobs: [{ refs: [{ url: IMG(1), kind: 'image' }], first: '', last: '' }, { refs: [], first: '', last: '' },
      { refs: [1, 2, 3, 4, 5, 6].map((n) => ({ url: IMG(n + 10), kind: 'image' })), first: '', last: '' }] };
  await page.addInitScript((d) => localStorage.setItem('footage_draft', d), JSON.stringify(draft));
  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(1200);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // tap block `i` at a point near its top, starting from block `from` active,
  // with the heading open or folded; answers how far the tapped box moved
  const tap = async (from, i, headOpen) => {
    await page.evaluate((f) => { if (document.activeElement) document.activeElement.blur();
      // the page's own door: a focus into a block makes it the active one
      const b = document.querySelectorAll('.panel > .promptwrap')[f].querySelector('.pblock'); b.focus(); b.blur(); }, from);
    await page.evaluate((o) => { const hw = document.querySelector('.headwrap'); hw.classList.toggle('shut', !o); }, headOpen);
    await page.waitForTimeout(250);
    await page.evaluate((i) => { const b = document.querySelectorAll('.panel > .promptwrap')[i].querySelector('.pblock'); b.scrollIntoView({ block: 'center' }); }, i);
    await page.waitForTimeout(250);
    const r = await page.evaluate((i) => { const b = document.querySelectorAll('.panel > .promptwrap')[i].querySelector('.pblock'); const q = b.getBoundingClientRect();
      return { x: q.left + 40, y: q.top + 30, top: q.top, sy: scrollY, hh: document.querySelector('.headwrap').getBoundingClientRect().height }; }, i);
    await page.touchscreen.tap(r.x, r.y);
    await page.waitForTimeout(80);
    const a = await page.evaluate((i) => { const w = document.querySelectorAll('.panel > .promptwrap')[i];
      return { top: w.querySelector('.pblock').getBoundingClientRect().top, active: w.classList.contains('active'),
        headAbove: w.previousElementSibling === document.querySelector('.headwrap') }; }, i);
    return { moved: Math.round(a.top - r.top), active: a.active, headAbove: a.headAbove, hh: Math.round(r.hh), sy: Math.round(r.sy) };
  };
  for (const open of [false, true]) {
    const word = open ? 'open' : 'folded';
    let m = await tap(0, 2, open);
    ok('block 3 tapped from block 1 (heading ' + word + ', ' + m.hh + 'px) becomes active with the heading above it', m.active && m.headAbove);
    ok('…and does not move under her finger — moved ' + m.moved + 'px', Math.abs(m.moved) <= 1);
    m = await tap(2, 1, open);
    ok('block 2 tapped from block 3 (heading ' + word + ') becomes active with the heading above it', m.active && m.headAbove);
    ok('…and does not move though the heading landed above it — moved ' + m.moved + 'px (scrolled ' + m.sy + ')', Math.abs(m.moved) <= 1);
  }
  ok('no page errors — ' + errors.join(' | '), errors.length === 0);
  await browser.close(); server.close();
  if (fails.length) { console.log('FOOTAGE TAP STILL — ' + pass + ' passed, ' + fails.length + ' FAILED'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
  console.log('FOOTAGE TAP STILL — ' + pass + ' passed');
})().catch((e) => { console.error(e); process.exit(1); });
