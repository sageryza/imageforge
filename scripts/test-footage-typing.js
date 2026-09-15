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
 * Section 8 (2026-09-14, "huge text block bug · rapid movement"): the SHRINK
 * road — a Backspace, an autocorrected word — still set the focused box to
 * `height:auto` and back, a 120-line scene collapsing to its floor for one
 * layout. Verified failing 3 against the 2026-09-14 live page
 * (FOOTAGE_PAGE=<that copy>): 16 style writes for four edits, `auto` written
 * four times.
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
    // FOOTAGE_PAGE=<file> drives the same checks against another copy of the
    // page (how the pre-fix failures below were verified)
    const html = fs.readFileSync(process.env.FOOTAGE_PAGE || path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL;
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
  ok('and it still runs the panel\'s full width — behind the pill since 2026-09-14 (' + s6.w + ')', s6.w >= 330);

  // ── 7. the pinned corner buttons are not rewritten per keystroke ────────
  //       (stickybox's input pass re-pinned them every character — class and
  //       every inline style — with nothing moving; 2026-09-12)
  //       THE CARET GOES MID-SCENE, not to its end: since 2026-09-13 the keeper
  //       lifts the caret clear of the pinned row, and at the END of a scene
  //       that lift brings the buttons' own corner back into view, so they let
  //       go and there is nothing left to count. Half way down, the box's
  //       bottom is still far below the fold and they really must float.
  await page.evaluate(() => { document.getElementById('prompt').blur(); });
  await page.click('#bigprompt');
  await page.evaluate(() => {
    const el = document.getElementById('prompt');
    el.value = Array.from({ length: 40 }, (_, i) => 'line number ' + i + ' of the scene she is writing tonight').join('\n');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    const at = Math.round(el.value.length * 0.5);
    el.focus(); el.setSelectionRange(at, at);
    window.__caretKeep.vv = { offsetTop: 0, height: 508 };
    const c = window.__caretKeep.caretRect(el);
    window.scrollTo(0, Math.max(0, window.scrollY + c.top - 300));
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
  ok('nine keystrokes inside the big box rewrite the pinned buttons ZERO times (' + bmuts + ')', bmuts === 0);

  // ── 8. THE SHRINK ROAD NEVER COLLAPSES A HUGE BLOCK (2026-09-14, Sophie:
  //       "huge text block bug · rapid movement · in footage · while typing").
  //       A Backspace and an autocorrected word (`insertReplacementText`) took
  //       the full fit, which set the box to `height:auto` — a 120-line scene
  //       at its floor for one layout — before writing the real height back.
  //       On iOS that relayout of the focused box is what reveals the caret
  //       and starts the jump. So: a backspace that unwraps nothing writes NO
  //       style at all, `auto` is never written to the box, and one that does
  //       unwrap writes the real height once.
  await page.evaluate(() => {
    const el = document.getElementById('prompt');
    el.value = Array.from({ length: 120 }, (_, i) => 'line ' + i + ' of a very long scene she is writing on her phone tonight, the ward corridor at night').join('\n');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    const at = Math.round(el.value.length * 0.5); el.focus(); el.setSelectionRange(at, at);
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const box = document.getElementById('prompt'), wrap = box.parentNode;
    window.__hmuts = []; window.__auto = 0; window.__hset = [];
    // every write is its own record and `oldValue` is the attribute before it,
    // so a collapse (`auto`, then the real height) shows as a record whose
    // oldValue carries `auto` — visible even though the collapse lasts one layout
    const mo = new MutationObserver((list) => { for (const m of list) {
      window.__hmuts.push(m.target === box ? 'box' : 'wrap');
      if (m.target === box) { const now = box.getAttribute('style') || ''; window.__hset.push((now.match(/height:\s*([^;]+)/) || [])[1] || '');
        if (/height:\s*auto/.test(now) || /height:\s*auto/.test(m.oldValue || '')) window.__auto += 1; }
    } });
    mo.observe(box, { attributes: true, attributeFilter: ['style'], attributeOldValue: true });
    mo.observe(wrap, { attributes: true, attributeFilter: ['style'] });
  });
  const h8 = (await page.evaluate(READ)).h;
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Backspace'); await page.waitForTimeout(60); }
  await page.evaluate(() => { const el = document.getElementById('prompt'); el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertReplacementText', data: 'x' })); el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: 'x' })); });
  await page.waitForTimeout(200);
  const s8 = await page.evaluate(() => ({ muts: window.__hmuts.slice(), auto: window.__auto, set: window.__hset.slice(), h: Math.round(document.getElementById('prompt').getBoundingClientRect().height) }));
  ok('three backspaces and an autocorrect mid-scene in a 120-line box write NO style on the box or its wrap (' + JSON.stringify(s8.muts) + ')', s8.muts.length === 0);
  ok('and `auto` is never written to the box she is typing in (' + JSON.stringify(s8.set) + ')', s8.auto === 0 && !s8.set.some((v) => v === 'auto'));
  ok('the box is still its full height (' + h8 + ' → ' + s8.h + ')', s8.h === h8 && h8 > 2000);
  // a backspace that DOES unwrap a line still shrinks it, in one write
  await page.evaluate(() => { const el = document.getElementById('prompt'); const at = el.value.length; el.setSelectionRange(at, at); window.__hset = []; window.__hmuts = []; });
  for (let i = 0; i < 60; i++) await page.keyboard.press('Backspace');
  await page.waitForTimeout(200);
  const s8b = await page.evaluate(() => ({ set: window.__hset.slice(), h: Math.round(document.getElementById('prompt').getBoundingClientRect().height) }));
  ok('deleting the last line shrinks the box (' + h8 + ' → ' + s8b.h + ') with only real heights written (' + JSON.stringify(s8b.set) + ')', s8b.h < h8 && s8b.set.length >= 1 && s8b.set.every((v) => /^\d+px$/.test(v)));
  // and the twin agrees with the box's own layout: the fit is never short
  const s8c = await page.evaluate(() => { const el = document.getElementById('prompt'); return { fit: window.__fitBox ? window.__fitBox.height(el) : -1, scroll: el.scrollHeight + (el.offsetHeight - el.clientHeight) }; });
  ok('the twin measures what the box itself would (' + s8c.fit + ' vs ' + s8c.scroll + ')', s8c.fit >= s8c.scroll && s8c.fit <= s8c.scroll + 2);

  ok('no page errors', errors.length === 0);
  if (errors.length) console.log('  errors: ' + errors.join(' | '));
  await browser.close(); server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
