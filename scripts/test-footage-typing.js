#!/usr/bin/env node
/* AN ORDINARY KEYSTROKE IN THE FOOTAGE BOX TOUCHES NO STYLE (2026-09-12,
 * Sophie: "every other character moves textbox").
 *
 * Every input used to rewrite the focused box's height (auto → px) and its
 * wrap's min-height, and every document resize re-zeroed the box's pill
 * margin and laid it out at full width to measure it — layout churn on the
 * box she is typing in, per character, with nothing on screen changing. iOS
 * WebKit answers a relayout of the focused textarea by revealing the caret,
 * the caret keeper corrects it a frame later, and the two settle into the
 * every-other-keystroke jump she reported. Chromium never shows the jump, so
 * this pins the CAUSE: the style writes and the forced relayouts are counted
 * on the real page, keystroke by keystroke, and an ordinary character must
 * make zero of either — while a wrap still grows the box, a deletion still
 * shrinks it, and a keystroke over a selection still shrinks it.
 *
 * Verified failing 4 against the pre-fix page (52 style writes for 12
 * characters, 24 for three at the end of a capped box).
 *
 * Run: node scripts/test-footage-typing.js
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
    console.log('FOOTAGE TYPING — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE TYPING — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage typing: playwright not installed — skipped'); report(); return;
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
    const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL;
    res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
  }
  if (u.pathname === '/api/footage/status') {
    return json({ ok: true, doors: { atlascloud: true }, balances: { atlascloud: { configured: true } },
      models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)),
      ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE });
  }
  if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', exact: true });
  if (u.pathname === '/api/footage/jobs') return json({ ok: true, jobs: [] });
  res.writeHead(404); res.end('nope');
});

// Counts every attribute write on the box, its wrap and every panel row, and
// every layout the box is forced through at a DIFFERENT width (the pill-gap
// walk's zero-and-measure shape). Both are what iOS answers with a jump.
const ARM = () => {
  const box = document.getElementById('prompt'), wrap = box.parentNode, panel = wrap.parentNode;
  window.__muts = 0; window.__wide = 0;
  const mo = new MutationObserver((list) => { window.__muts += list.length; });
  mo.observe(box, { attributes: true });
  mo.observe(wrap, { attributes: true });
  for (const k of panel.children) mo.observe(k, { attributes: true, attributeFilter: ['style'] });
  // a relayout of the box at another width is visible only from inside the
  // walk: getBoundingClientRect on the box between the zero and the restore
  const w0 = box.getBoundingClientRect().width;
  const orig = box.getBoundingClientRect.bind(box);
  box.getBoundingClientRect = function () { const r = orig(); if (Math.abs(r.width - w0) > 1) window.__wide += 1; return r; };
};
const READ = () => {
  const box = document.getElementById('prompt'), r = box.getBoundingClientRect();
  const out = { muts: window.__muts, wide: window.__wide, h: Math.round(r.height), w: Math.round(r.width), st: box.scrollTop, sy: Math.round(window.scrollY), height: box.style.height };
  window.__muts = 0; window.__wide = 0;
  return out;
};

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(700);

  // ── 1. mid-line typing in the small box: nothing written, nothing re-laid ──
  await page.evaluate(() => { const el = document.getElementById('prompt'); el.value = 'the ward at night'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.focus('#prompt');
  await page.evaluate(() => { const el = document.getElementById('prompt'); el.setSelectionRange(el.value.length, el.value.length); });
  await page.waitForTimeout(500);
  await page.evaluate(ARM);
  await page.evaluate(READ);                        // drain whatever focusing did
  let muts = 0, wide = 0;
  for (const ch of ', a corridor') {
    await page.keyboard.type(ch);
    await page.waitForTimeout(40);
    const s = await page.evaluate(READ);
    muts += s.muts; wide += s.wide;
  }
  ok('12 ordinary keystrokes write NO style on the box, its wrap or any row (' + muts + ' writes)', muts === 0);
  ok('and force NO relayout of the box at another width (' + wide + ')', wide === 0);

  // ── 2. a keystroke that wraps a line still grows the box ────────────────
  const h0 = (await page.evaluate(READ)).h;
  await page.keyboard.type(' of light blue doors and a nurse walking slowly past each one while the patients sleep and the television in the day room plays to nobody, then the doctor arrives with a clipboard and looks in through the little window in each door and writes something down before moving on to the next room');
  await page.waitForTimeout(150);
  const g = await page.evaluate(READ);
  ok('a wrapped line grows the box (' + h0 + ' → ' + g.h + ')', g.h > h0);

  // ── 3. Backspace shrinks it back ─────────────────────────────────────────
  for (let i = 0; i < 300; i++) await page.keyboard.press('Backspace');
  await page.waitForTimeout(150);
  const s3 = await page.evaluate(READ);
  ok('deleting the line shrinks the box back (' + g.h + ' → ' + s3.h + ')', s3.h === h0);

  // ── 4. typing over a selection shrinks it too ────────────────────────────
  await page.keyboard.type(' of light blue doors and a nurse walking slowly past each one while the patients sleep and the television in the day room plays to nobody, then the doctor arrives with a clipboard and looks in through the little window in each door and writes something down before moving on to the next room');
  await page.waitForTimeout(150);
  const s4a = await page.evaluate(READ);
  ok('grown again for the selection case (' + s4a.h + ')', s4a.h > h0);
  await page.evaluate(() => { const el = document.getElementById('prompt'); el.setSelectionRange(17, el.value.length); });
  await page.keyboard.type('.');
  await page.waitForTimeout(150);
  const s4 = await page.evaluate(READ);
  ok('a character typed over a selection shrinks the box (' + s4a.h + ' → ' + s4.h + ')', s4.h === h0);

  // ── 5. a capped box scrolled to its end keeps its inner scroll on a keystroke ──
  await page.evaluate(() => {
    const el = document.getElementById('prompt');
    el.value = Array.from({ length: 30 }, (_, i) => 'line number ' + i + ' of the scene').join('\n');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.setSelectionRange(el.value.length, el.value.length); el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(200);
  await page.evaluate(ARM);
  const before = await page.evaluate(READ);
  ok('the small box is capped and scrolls inside (scrollTop ' + before.st + ')', before.st > 0);
  await page.keyboard.type('xyz');
  await page.waitForTimeout(150);
  const after = await page.evaluate(READ);
  ok('three characters at its end write nothing (' + after.muts + ') and leave its scroll where it was (' + before.st + ' → ' + after.st + ')', after.muts === 0 && after.st === before.st);

  // ── 6. the document resizing does not re-lay the box out at full width ──
  //       (the caret keeper borrowing room is exactly this resize)
  await page.evaluate(ARM);
  await page.evaluate(() => { document.documentElement.style.paddingBottom = '300px'; });
  await page.waitForTimeout(250);
  await page.evaluate(() => { document.documentElement.style.paddingBottom = ''; });
  await page.waitForTimeout(250);
  const s6 = await page.evaluate(READ);
  ok('room borrowed and returned: the box is not re-laid out wide (' + s6.wide + ') and its reserve is untouched (' + s6.muts + ' writes)', s6.wide === 0 && s6.muts === 0);
  ok('and it still keeps the pill\'s column (' + s6.w + ')', s6.w < 330);

  // ── 7. the pinned corner buttons are not rewritten per keystroke ────────
  //       (stickybox's input pass re-pinned them every character — class and
  //       every inline style — with nothing moving; 2026-09-12)
  await page.evaluate(() => { document.getElementById('prompt').blur(); });
  await page.click('#bigprompt');
  await page.evaluate(() => {
    const el = document.getElementById('prompt');
    el.value = Array.from({ length: 40 }, (_, i) => 'line number ' + i + ' of the scene she is writing tonight').join('\n');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus(); el.setSelectionRange(el.value.length, el.value.length);
    window.__caretKeep.vv = { offsetTop: 0, height: 508 };
    window.scrollTo(0, 400);
  });
  await page.waitForTimeout(800);
  const pinned = await page.evaluate(() => Array.from(document.querySelectorAll('[data-stickybox].sbx-pin')).map((b) => b.id));
  ok('the corner buttons are pinned for the long scene (' + pinned.join(',') + ')', pinned.length >= 1);
  await page.evaluate(() => {
    window.__bmuts = 0;
    const mo = new MutationObserver((list) => { window.__bmuts += list.length; });
    document.querySelectorAll('[data-stickybox]').forEach((b) => mo.observe(b, { attributes: true }));
  });
  for (const ch of ' and more') { await page.keyboard.type(ch); await page.waitForTimeout(60); }
  await page.waitForTimeout(300);
  const bmuts = await page.evaluate(() => window.__bmuts);
  ok('nine keystrokes at the end of the big box rewrite the pinned buttons ZERO times (' + bmuts + ')', bmuts === 0);

  ok('no page errors', errors.length === 0);
  if (errors.length) console.log('  errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
