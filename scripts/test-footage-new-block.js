#!/usr/bin/env node
/* A NEW BLOCK AT THE BOTTOM, AND EVERY OTHER BLOCK PUT AWAY (2026-09-17,
 * Sophie: "add a button that makes a new text block at the bottom of footage
 * and collapses all other blocks" · "character and setting shud be above the
 * selected text block btw").
 *
 * The REAL page headless, every assertion a MEASUREMENT: a button that adds
 * the block in the wrong place, folds that leave a box on screen, a gold
 * line left on the old block, a caret that never landed, a draft that forgot
 * the folds, and a characters-and-setting box sitting above the wrong block
 * all look identical in the source.
 *
 * Run: node scripts/test-footage-new-block.js
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
    console.log('FOOTAGE NEW BLOCK — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE NEW BLOCK — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage new block: playwright not installed — skipped'); report(); return;
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
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const json = (o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/footage') {
      const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL;
      res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
    }
    if (u.pathname === '/api/footage/status') {
      return json({ ok: true, doors: { atlascloud: true }, chat: 'footage',
        balances: { atlascloud: { configured: true } },
        models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)),
        ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
    }
    if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', exact: true });
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs: [] });
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
    if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
    if (u.pathname === '/ref.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
    res.writeHead(404); res.end('nope');
  });
});

const SCENE = Array.from({ length: 6 }, (_, i) => 'line ' + (i + 1) + ' — the ward corridor at night, camera at eye level').join('\n');

const read = () => {
  const panel = document.querySelector('.panel');
  const kids = Array.from(panel.children);
  const wraps = kids.filter((c) => c.classList.contains('promptwrap'));
  const seen = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const hit = r.width && r.height
      ? document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(Math.min(r.top + r.height / 2, innerHeight - 2)))
      : null;
    return { w: r.width, h: r.height, top: r.top, display: cs.display, reaches: !!(hit && (hit === el || el.contains(hit))) };
  };
  const btn = document.getElementById('newblock');
  const row = btn && btn.closest('.newrow');
  const hw = panel.querySelector('.headwrap');
  return {
    n: wraps.length,
    many: panel.classList.contains('many'),
    values: wraps.map((w) => w.querySelector('.pblock').value),
    shut: wraps.map((w) => w.classList.contains('shut')),
    active: wraps.map((w) => w.classList.contains('active')),
    box: wraps.map((w) => seen(w.querySelector('.pblock'))),
    head: wraps.map((w) => seen(w.querySelector('.bfold'))),
    lw: wraps.map((w) => (w.querySelector('.lw') || {}).textContent || ''),
    btn: seen(btn),
    btnHasIcon: !!(btn && btn.querySelector('svg')),
    btnCentre: btn ? (() => { const r = btn.getBoundingClientRect(), pr = panel.getBoundingClientRect(); return (r.left + r.right) / 2 - (pr.left + pr.right) / 2; })() : null,
    rowIsLast: !!row && kids.indexOf(row) > kids.indexOf(wraps[wraps.length - 1]),
    focused: wraps.map((w) => document.activeElement === w.querySelector('.pblock')),
    headsAbove: hw ? wraps.map((w) => hw.nextElementSibling === w) : null,
    headsTopVsActive: hw ? (() => { const a = wraps.find((w) => w.classList.contains('active'));
      return a ? hw.getBoundingClientRect().bottom - a.getBoundingClientRect().top : null; })() : null,
    joins: kids.filter((c) => c.classList.contains('joinrow')).map((r) => getComputedStyle(r).display),
    draft: JSON.parse(localStorage.getItem('footage_draft') || '{}'),
  };
};
const write = (text) => {
  const el = document.getElementById('prompt');
  el.value = text; el.dispatchEvent(new Event('input', { bubbles: true }));
};

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
  await page.waitForTimeout(300);

  // ── 1. the button is there with one block, under it, tappable ───────────
  await page.evaluate(write, SCENE);
  await page.waitForTimeout(200);
  let s = await page.evaluate(read);
  ok('one block to start', s.n === 1 && !s.many);
  ok('the new-block button is on screen with one block (' + Math.round((s.btn || {}).h) + 'px)', s.btn && s.btn.h > 0 && s.btn.w > 0);
  ok('it carries an icon, not an empty box', s.btnHasIcon);
  ok('a tap really reaches it', s.btn && s.btn.reaches);
  ok('its row sits BELOW the last block', s.rowIsLast);
  // PHOTOGRAPHED: the pill fitter judged the whole row's rect, so the plus
  // sat 50px left of centre with one block
  ok('the plus is centred under the block (' + Math.round(s.btnCentre) + 'px off)', Math.abs(s.btnCentre) < 3);
  const boxTop0 = s.box[0].top;

  // ── 2. one tap: a new empty block at the bottom, every other block folded ─
  await page.click('#newblock');
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('two blocks', s.n === 2 && s.many);
  ok('the new one is LAST and empty — ' + JSON.stringify(s.values.map((v) => v.slice(0, 12))), s.values[0].slice(0, 6) === 'line 1' && s.values[1] === '');
  ok('block 1 is folded, the new block is not — ' + s.shut.join('/'), s.shut[0] && !s.shut[1]);
  ok('block 1\'s box is out of the layout, not merely dimmed', s.box[0].display === 'none' && s.box[0].h === 0);
  ok('its heading says its first words — "' + s.lw[0] + '"', /line 1/.test(s.lw[0]));
  ok('the new block\'s box is on screen', s.box[1].display !== 'none' && s.box[1].h > 0);
  ok('the gold line moved to the new block — ' + s.active.join('/'), !s.active[0] && s.active[1]);
  ok('and the caret is in it', s.focused[1]);
  ok('the button is still under the LAST block', s.rowIsLast && s.btn.h > 0);
  ok('and still centred (' + Math.round(s.btnCentre) + 'px off)', Math.abs(s.btnCentre) < 3);
  ok('the join mark between a folded block and the new one is hidden — ' + s.joins.join(','), s.joins.length === 1 && s.joins[0] === 'none');
  ok('the fold is in the draft, so a reload finds it', Array.isArray(s.draft.shut) && s.draft.shut[0] === true && !s.draft.shut[1]);
  // her "btw": the characters-and-setting box rides ABOVE the block she is in
  ok('characters & setting sit directly above the new (selected) block — ' + JSON.stringify(s.headsAbove),
    s.headsAbove && s.headsAbove[1] === true);
  ok('…measured on screen, its bottom meets the block\'s top (' + Math.round(s.headsTopVsActive) + 'px)',
    s.headsTopVsActive != null && Math.abs(s.headsTopVsActive) < 12);

  // ── 3. words in the new block, then a third: BOTH earlier blocks fold ─────
  await page.evaluate(() => {
    const ws = Array.from(document.querySelector('.panel').children).filter((c) => c.classList.contains('promptwrap'));
    const el = ws[1].querySelector('.pblock');
    el.value = 'second shot — she walks out through the double doors'; el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(150);
  await page.click('#newblock');
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('three blocks, the new one last and empty', s.n === 3 && s.values[2] === '' && /second shot/.test(s.values[1]));
  ok('blocks 1 and 2 folded, block 3 open — ' + s.shut.join('/'), s.shut[0] && s.shut[1] && !s.shut[2]);
  ok('only one box on screen', s.box.filter((b) => b.h > 0).length === 1 && s.box[2].h > 0);
  ok('the gold line and the caret are on block 3', s.active[2] && s.focused[2]);
  ok('characters & setting are above block 3', s.headsAbove[2] === true);

  // ── 4. tapping back into a folded block's heading opens it; the heads follow the selection ──
  await page.evaluate(() => {
    const ws = Array.from(document.querySelector('.panel').children).filter((c) => c.classList.contains('promptwrap'));
    ws[0].querySelector('.bfold').click();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const ws = Array.from(document.querySelector('.panel').children).filter((c) => c.classList.contains('promptwrap'));
    ws[0].querySelector('.pblock').click();
  });
  await page.waitForTimeout(200);
  s = await page.evaluate(read);
  ok('block 1 opens again on its heading and its words are intact', !s.shut[0] && s.values[0].slice(0, 6) === 'line 1');
  ok('tapping into block 1 moves the gold line there', s.active[0]);
  ok('and characters & setting move above block 1 with it — ' + JSON.stringify(s.headsAbove), s.headsAbove[0] === true);

  // ── 5. a reload finds the page as she left it ───────────────────────────
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(400);
  s = await page.evaluate(read);
  ok('after a reload: three blocks, the words kept — ' + JSON.stringify(s.values.map((v) => v.slice(0, 10))),
    s.n === 3 && s.values[0].slice(0, 6) === 'line 1' && /second shot/.test(s.values[1]));
  ok('and the button is still under the last block', s.rowIsLast && s.btn.h > 0);
  void boxTop0;

  ok('no page errors — ' + errors.join(' | '), errors.length === 0);
  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
