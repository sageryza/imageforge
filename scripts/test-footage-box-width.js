#!/usr/bin/env node
/* THE PROMPT BOX KEEPS ONE WIDTH WHETHER THE PILL IS DRAWN OR NOT (2026-09-11,
 * Sophie: "issue w footage textbox. switches back and forth between narrow
 * (viewport - scroll pill), and full width. whyyy").
 *
 * The pill is conditional — hidden while the page is under one screen tall —
 * and the reserve used to follow it, so the box flipped 49px every time the
 * page's height crossed the fold (a short feed, the caret keeper borrowing room
 * under the keyboard, a draft growing). Every assertion here is a MEASUREMENT
 * of the rendered box, since a reserve that reads the pill's momentary display
 * and one that reads where it would sit are the same markup to any source
 * check. Verified failing against the pre-fix page (340 → 291 → 340).
 *
 * Run: node scripts/test-footage-box-width.js
 */
/* REVERSED 2026-09-14 (Sophie: "i think text box shud just stay full width
 * behind pill"): the box keeps the panel's whole width whatever the rail is
 * doing, and only a block's HEADING row reserves the column. The checks are
 * the new rule — the box the same width pill or no pill, a heading clear of
 * the rail while the box under it is not — plus the rail's ↑/↓ stopping at
 * the references first ("scroll to top and scroll to bottom shud go to midway
 * references/buttons first, then all the way"). Verified failing 5 against
 * the pre-change page.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const fails = []; let pass = 0;
const ok = (what, cond) => { if (cond) pass += 1; else fails.push(what); };
function report() {
  if (fails.length) {
    console.log('FOOTAGE BOX WIDTH — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE BOX WIDTH — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage box width: playwright not installed — skipped'); report(); return;
  }
}
function exe() {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  for (const d of fs.readdirSync(root).filter((n) => /^chromium-\d/.test(n))) {
    const p = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const F = require('../footage');
const PILL = fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/footage') {
    const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + (u.searchParams.get('nopill') ? '' : PILL);
    res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
  }
  if (u.pathname === '/api/footage/status') {
    return json({ ok: true, doors: { atlascloud: true }, balances: { atlascloud: { configured: true } },
      models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)),
      ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
  }
  if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', exact: true });
  if (u.pathname === '/api/footage/jobs') return json({ ok: true, jobs: [] });   // a SHORT feed — the page fits one screen
  res.writeHead(404); res.end('nope');
});

const read = () => {
  const p = document.getElementById('prompt'), f = document.querySelector('body > .float');
  const r = p.getBoundingClientRect();
  return {
    w: Math.round(r.width), right: Math.round(r.right),
    pill: f ? getComputedStyle(f).display !== 'none' : null,
    pillLeft: f ? Math.round(f.getBoundingClientRect().left) : null,
    pillInline: f ? f.style.display : null,
    docH: document.documentElement.scrollHeight, vh: window.innerHeight,
  };
};
const type = (t) => { const el = document.getElementById('prompt'); el.value = t; el.dispatchEvent(new Event('input', { bubbles: true })); };

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(600);

  // ── 1. a page under one screen: the pill is hidden, the box already keeps
  //       the column ────────────────────────────────────────────────────────
  const a = await page.evaluate(read);
  ok('the short page has nothing to scroll (' + a.docH + ' of ' + a.vh + ')', a.docH <= a.vh + 4);
  ok('so the pill is hidden', a.pill === false);
  ok('and its inline display is still what the pill set (' + JSON.stringify(a.pillInline) + ')', a.pillInline === 'none');
  const panelW = await page.evaluate(() => { const p = document.getElementById('panel'); const cs = getComputedStyle(p); return Math.round(p.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth)); });
  ok('the box runs the panel\'s full width (' + a.w + ' of ' + panelW + ')', a.w === panelW);
  const w0 = a.w;

  // ── 2. the caret keeper borrows room under the keyboard: the page grows
  //       past the fold, the pill comes — the box does not move ────────────
  await page.evaluate(() => { document.documentElement.style.paddingBottom = '420px'; if (window.__pillSync) window.__pillSync(); if (window.__fitPillGap) window.__fitPillGap(); });
  await page.waitForTimeout(300);
  const b = await page.evaluate(read);
  ok('with room borrowed the pill is drawn', b.pill === true);
  ok('and the box is the same width (' + w0 + ' → ' + b.w + ')', b.w === w0);
  ok('and runs under the pill\'s column (' + b.right + ' > ' + b.pillLeft + ')', b.right > b.pillLeft);

  // ── 3. the room goes back, the pill goes — the box still does not move ──
  await page.evaluate(() => { document.documentElement.style.paddingBottom = ''; if (window.__pillSync) window.__pillSync(); if (window.__fitPillGap) window.__fitPillGap(); });
  await page.waitForTimeout(300);
  const c = await page.evaluate(read);
  ok('room returned: the pill is hidden again', c.pill === false);
  ok('and the box is still the same width (' + w0 + ' → ' + c.w + ')', c.w === w0);

  // ── 4. a draft grows the page past the fold by itself ───────────────────
  //       (the compact box is capped at 30vh, so it is the BIG box that grows
  //       the page — her scene, opened bigger)
  await page.evaluate(type, Array.from({ length: 70 }, (_, i) => 'line ' + i).join('\n'));
  await page.click('#bigprompt');
  await page.waitForTimeout(500);
  const d = await page.evaluate(read);
  ok('a long draft in the big box shows the pill', d.pill === true);
  ok('and the box is the same width (' + w0 + ' → ' + d.w + ')', d.w === w0);
  await page.click('#bigprompt');
  await page.evaluate(type, 'one line');
  await page.waitForTimeout(400);
  const e = await page.evaluate(read);
  ok('cut back to a line: the box is still the same width (' + w0 + ' → ' + e.w + ')', e.w === w0);

  // ── 5. a page served with NO pill reserves nothing ───────────────────────
  const page2 = await ctx.newPage();
  await page2.goto(base + '/footage?nopill=1');
  await page2.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page2.waitForTimeout(500);
  const n = await page2.evaluate(read);
  ok('with no pill on the page the box is the same width (' + n.w + ' vs ' + w0 + ')', n.pill === null && n.w === w0);
  await page2.close();      // a second open page throttles the first's animations — a smooth scroll below would crawl

  // ── 6. two blocks: the HEADING keeps the column, the box under it does not ──
  await page.evaluate(() => { const el = document.getElementById('prompt'); el.value = 'the ward at night, a nurse walks the corridor and looks in through each little window'; el.dispatchEvent(new Event('input', { bubbles: true })); el.focus(); el.setSelectionRange(20, 20); });
  await page.click('#divide');
  await page.waitForTimeout(500);
  const h = await page.evaluate(() => { const f = document.querySelector('body > .float'), head = document.querySelector('.promptwrap .bfold'), sent = document.querySelector('.promptwrap .bfold .bsent'), box = document.getElementById('prompt');
    return { pillLeft: Math.round(f.getBoundingClientRect().left), head: Math.round(head.getBoundingClientRect().right), sent: Math.round(sent.getBoundingClientRect().right), box: Math.round(box.getBoundingClientRect().width), gap: document.querySelector('.promptwrap').style.getPropertyValue('--pillgap') }; });
  ok('the block heading ends before the pill\'s column (' + h.head + ' < ' + h.pillLeft + ', reserve ' + h.gap + ')', h.head < h.pillLeft && parseFloat(h.gap) > 0);
  ok('and its red word at the end is clear of the rail too (' + h.sent + ')', h.sent < h.pillLeft);
  ok('while the box under it still runs the panel\'s full width (' + h.box + ')', h.box === w0);

  // ── 7. the rail's jumps stop at the references first ────────────────────
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForTimeout(600);       // past the caret keeper's room-return on blur, which rewrites the padding used below
  await page.evaluate(() => { document.documentElement.style.paddingBottom = '1600px'; if (window.__pillSync) window.__pillSync(); });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(400);
  const stop = await page.evaluate(() => Math.round(document.getElementById('refbar').getBoundingClientRect().top + window.scrollY - 12));
  // a smooth scroll is measured once it has SETTLED, never on a timer
  const jump = async (id) => { await page.evaluate((id) => document.getElementById(id).click(), id);
    let last = -1; for (let i = 0; i < 30; i++) { await page.waitForTimeout(150); const y = await page.evaluate(() => Math.round(window.scrollY)); if (y === last) break; last = y; }
    return last; };
  const y0 = await page.evaluate(() => Math.round(window.scrollY));
  const y1 = await jump('ptop'), y2 = await jump('ptop');
  ok('from the bottom (' + y0 + ') ↑ lands on the references (' + y1 + ' vs ' + stop + ')', Math.abs(y1 - stop) <= 2);
  ok('and the next ↑ goes all the way up (' + y2 + ')', y2 === 0);
  const y3 = await jump('pbot'), y4 = await jump('pbot');
  const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  ok('from the top ↓ lands on the references (' + y3 + ')', Math.abs(y3 - stop) <= 2);
  ok('and the next ↓ goes all the way down (' + y4 + ' of ' + max + ')', Math.abs(y4 - max) <= 2);

  ok('no page errors', errors.length === 0);
  if (errors.length) console.log('  errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
