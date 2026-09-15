#!/usr/bin/env node
/* CLEAR ALL REFERENCES (2026-09-15, Sophie: "clear all references button").
 * One word at the end of the references bar takes every reference off the
 * block she is in, takes their slot names out of her words, and `undo` beside
 * the star puts the whole thing back.
 *
 * Driven on the REAL page. Every assertion is a MEASUREMENT: a word drawn
 * with nothing to clear, a strip emptied while `[Image1]` still names a
 * picture in the box, an undo that brings the pictures back without their
 * names, and a clear that reaches ANOTHER block's strip all look identical in
 * the source.
 *
 * Run: node scripts/test-footage-clear-refs.js
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
    console.log('FOOTAGE CLEAR ALL REFERENCES — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE CLEAR ALL REFERENCES — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage clear all references: playwright not installed — skipped'); report(); return;
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
const PAGE_SRC = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAWklEQVR42u3QMQEAAAjDMPBv2hjB'
  + 'HRKoJN3eFQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  + 'AAAAAAAAAAAAAAAA8GwBJ0YAATBPVvsAAAAASUVORK5CYII=', 'base64');

let uploads = 0;
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/footage') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(PAGE_SRC.replace('__STUDIO_TOKEN__', '') + PILL);
  }
  if (/\.png$/.test(u.pathname)) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
  if (u.pathname === '/api/footage/status') {
    return json({ ok: true, doors: { atlascloud: true, openrouter: true, apiframe: true },
      balances: { atlascloud: { configured: true } },
      models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)),
      ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE, chat: 'footage' });
  }
  if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', about: true });
  if (u.pathname === '/api/footage/jobs') return json({ ok: true, jobs: [], folders: {} });
  if (u.pathname === '/api/cast/films') return json({ ok: true, films: [] });
  if (u.pathname.indexOf('/api/cast') === 0) return json({ ok: true, films: [], characters: [] });
  if (u.pathname === '/api/drop/upload-file') {
    req.on('data', () => {});
    return req.on('end', () => {
      uploads += 1;
      json({ ok: true, item: { id: 'd' + uploads, url: '/thumb.png?up=' + uploads, posterUrl: null, media: 'image' } });
    });
  }
  if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, assets: [] });
  if (u.pathname === '/api/footage/spend') return json({ ok: true });
  res.writeHead(404); res.end('nope');
});

const read = () => {
  const el = document.getElementById('clearrefs');
  const r = el.getBoundingClientRect();
  const bar = document.getElementById('refbar').getBoundingClientRect();
  const ws = Array.from(document.querySelectorAll('.promptwrap'));
  return {
    on: r.height > 0 && r.width > 0,
    inBar: !!el.closest('#refbar'),
    // hard right: the word ends near the bar's right edge, not against the icons
    right: Math.round(bar.right - r.right),
    underlined: getComputedStyle(el).textDecorationLine.indexOf('underline') >= 0,
    boxed: getComputedStyle(el).borderStyle !== 'none' && parseFloat(getComputedStyle(el).borderWidth) > 0,
    n: document.querySelectorAll('#refs .ref').length,
    words: ws.map((w) => w.querySelector('.pblock').value),
    undo: !document.getElementById('undojob').hidden,
    toast: (document.querySelector('.toast') || {}).textContent || '',
  };
};

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const ep = exe();
  const browser = await chromium.launch(ep ? { executablePath: ep } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  // ── 1. NOTHING ATTACHED — no word ─────────────────────────────────────
  await page.goto(base + '/footage');
  await page.waitForTimeout(900);
  let st = await page.evaluate(read);
  ok('no page errors — ' + errs.join(' | '), !errs.length);
  ok('with nothing attached the word is not drawn — never a dead control', !st.on);
  ok('it lives in the references bar', st.inBar);

  // ── 2. TWO PICTURES, BOTH NAMED IN THE BOX ────────────────────────────
  await page.setInputFiles('#file', [
    { name: 'a.png', mimeType: 'image/png', buffer: PNG },
    { name: 'b.png', mimeType: 'image/png', buffer: PNG },
  ]);
  await page.waitForFunction(() => document.querySelectorAll('#refs .ref').length === 2, null, { timeout: 8000 });
  await page.evaluate(() => {
    const box = document.getElementById('prompt');
    box.value = 'she is [Image1], the room is [Image2], camera at eye level';
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(400);
  st = await page.evaluate(read);
  ok('with pictures attached the word is drawn ' + JSON.stringify({ on: st.on }), st.on);
  ok('it is an underlined word, not a boxed button', st.underlined && !st.boxed);
  ok('it sits at the far end of the bar (' + st.right + 'px from the edge)', st.right >= 0 && st.right <= 8);

  // ── 3. CLEAR ALL — strip empty, names out, undo offered ───────────────
  await page.evaluate(() => document.getElementById('clearrefs').click());
  await page.waitForTimeout(400);
  st = await page.evaluate(read);
  ok('every reference is off the strip', st.n === 0);
  ok('the slot names came out of her words — ' + JSON.stringify(st.words[0]), !/\[Image\d\]/.test(st.words[0]));
  ok('…and the rest of her words are untouched', /camera at eye level/.test(st.words[0]) && /she is/.test(st.words[0]));
  ok('the word goes away with the strip', !st.on);
  ok('undo is offered beside the star', st.undo);
  ok('the toast says how many and names the way back — ' + st.toast, /2 references off/.test(st.toast) && /undo/.test(st.toast));

  // ── 4. UNDO PUTS THE PICTURES AND THEIR NAMES BACK ───────────────────
  await page.evaluate(() => document.getElementById('undojob').click());
  await page.waitForTimeout(400);
  st = await page.evaluate(read);
  ok('undo brings both pictures back', st.n === 2);
  ok('…with their names back in the box — ' + JSON.stringify(st.words[0]), /\[Image1\]/.test(st.words[0]) && /\[Image2\]/.test(st.words[0]));

  // ── 5. IT SURVIVES A RELOAD (the bank is stored) ─────────────────────
  await page.evaluate(() => document.getElementById('clearrefs').click());
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForTimeout(900);
  st = await page.evaluate(read);
  ok('after a reload the strip is still clear and undo is still offered', st.n === 0 && st.undo);
  await page.evaluate(() => document.getElementById('undojob').click());
  await page.waitForTimeout(400);
  st = await page.evaluate(read);
  ok('and undo after the reload still brings them back', st.n === 2 && /\[Image2\]/.test(st.words[0]));

  // ── 6. ANOTHER BLOCK'S STRIP IS LEFT ALONE ───────────────────────────
  await page.evaluate(() => {
    const box = document.getElementById('prompt');
    box.focus(); box.setSelectionRange(box.value.length, box.value.length);
    document.getElementById('divide').click();
  });
  await page.waitForTimeout(400);
  const nBlocks = await page.evaluate(() => document.querySelectorAll('.promptwrap').length);
  ok('divided into two blocks', nBlocks === 2);
  // the new (second) block is active and carries a copy of the strip
  st = await page.evaluate(read);
  ok('the second block carries the strip', st.n === 2);
  await page.evaluate(() => document.getElementById('clearrefs').click());
  await page.waitForTimeout(400);
  st = await page.evaluate(read);
  ok('clearing the second block empties ITS strip', st.n === 0);
  // step back to block 1
  await page.evaluate(() => { document.querySelectorAll('.promptwrap .pblock')[0].focus(); });
  await page.waitForTimeout(400);
  st = await page.evaluate(read);
  ok('block 1 still has both pictures', st.n === 2);
  ok('…and block 1\'s names are still in its words — ' + JSON.stringify(st.words[0]), /\[Image1\]/.test(st.words[0]) && /\[Image2\]/.test(st.words[0]));
  ok('no page errors at the end — ' + errs.join(' | '), !errs.length);

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
