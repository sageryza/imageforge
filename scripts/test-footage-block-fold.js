#!/usr/bin/env node
/* EACH BLOCK FOLDS ON ITS OWN (2026-09-13, Sophie: "make each text block in
 * footage collapsible").
 *
 * The REAL page headless, and every assertion is a MEASUREMENT of what really
 * renders or a reading of what the stub server really received: a heading that
 * carries the right markup and folds nothing, a fold whose CSS never landed, a
 * block that comes back one line tall because it was fitted while it was
 * hidden, a folded block whose words silently stop being sent, and a heading
 * drawn on a one-block page all look identical in the source.
 *
 * Run: node scripts/test-footage-block-fold.js
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
    console.log('FOOTAGE BLOCK FOLD — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE BLOCK FOLD — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage block fold: playwright not installed — skipped'); report(); return;
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
const posted = [];
const jobs = [];
let uploads = 0;

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
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs });
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
      const b = JSON.parse(body);
      posted.push(b);
      const id = 'j' + posted.length;
      jobs.unshift({ id, prompt: b.prompt, model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: b.seconds,
        resolution: b.resolution, ratio: b.ratio, sound: true, refs: [], status: 'drawing', seed: 7,
        sentAt: new Date().toISOString(), estimate: 4.4, vote: '' });
      return json({ ok: true, jobId: id, door: 'atlascloud', fellBack: false, estimate: 4.4, seed: 7 }, 202);
    }
    if (u.pathname === '/api/drop/upload-file') {
      uploads += 1;
      return json({ ok: true, item: { id: 'd' + uploads, url: 'http://127.0.0.1:' + server.address().port + '/ref.png?f=' + uploads, posterUrl: null, media: 'image' } });
    }
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
    if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
    if (u.pathname === '/ref.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
    res.writeHead(404); res.end('nope');
  });
});

const HEAD = Array.from({ length: 8 }, (_, i) => 'head line ' + (i + 1) + ' — the ward corridor at night').join('\n');
const TAIL = 'tail line one — she walks out through the double doors\ntail line two';
const SCENE = HEAD + '\n' + TAIL;

// what the page shows, measured
const read = () => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  const seen = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const hit = r.width && r.height
      ? document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(Math.min(r.top + r.height / 2, innerHeight - 2)))
      : null;
    return { w: r.width, h: r.height, display: cs.display, color: cs.color,
      reaches: !!(hit && (hit === el || el.contains(hit))), words: (el.textContent || '').trim() };
  };
  return {
    n: wraps.length,
    many: panel.classList.contains('many'),
    values: wraps.map((w) => w.querySelector('.pblock').value),
    shut: wraps.map((w) => w.classList.contains('shut')),
    active: wraps.map((w) => w.classList.contains('active')),
    head: wraps.map((w) => seen(w.querySelector('.bfold'))),
    lab: wraps.map((w) => (w.querySelector('.bflab') || {}).textContent || ''),
    lw: wraps.map((w) => (w.querySelector('.lw') || {}).textContent || ''),
    box: wraps.map((w) => seen(w.querySelector('.pblock'))),
    corner: wraps.map((w) => seen(w.querySelector('.bigger'))),
    wipe: wraps.map((w) => seen(w.querySelector('.wipeb'))),
    headRight: wraps.map((w) => { const b = w.querySelector('.bfold'); const r = b.getBoundingClientRect(); return { right: r.right, scroll: b.scrollWidth, client: b.clientWidth }; }),
    wrapH: wraps.map((w) => w.getBoundingClientRect().height),
    panelH: panel.getBoundingClientRect().height,
    feedTop: document.getElementById('feed').getBoundingClientRect().top,
    joins: Array.from(panel.children).filter((c) => c.classList.contains('joinrow'))
      .map((r) => { const b = r.getBoundingClientRect(); const cs = getComputedStyle(r);
        return { h: b.height, display: cs.display }; }),
    draft: JSON.parse(localStorage.getItem('footage_draft') || '{}'),
  };
};
const tapHead = (i) => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  wraps[i].querySelector('.bfold').click();
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

  // ── 1. ONE BLOCK IS THE PAGE SHE ALREADY HAD ────────────────────────────
  await page.evaluate(write, SCENE);
  await page.waitForTimeout(200);
  let s = await page.evaluate(read);
  ok('one block to start', s.n === 1 && !s.many);
  ok('and its heading is not drawn at all — ' + (s.head[0] || {}).display, s.head[0].display === 'none' && !s.head[0].h);

  // ── 2. two blocks: each carries a heading, numbered, in order ────────────
  const cut = SCENE.indexOf('tail line one');
  await page.evaluate((c) => { const el = document.getElementById('prompt'); el.focus(); el.setSelectionRange(c, c); }, cut);
  await page.click('#divide');
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('two blocks', s.n === 2 && s.many);
  ok('each one has a heading on screen (' + s.head.map((h) => Math.round(h.h)).join(', ') + 'px)',
    s.head.every((h) => h.display === 'flex' && h.h > 0 && h.w > 0));
  ok('numbered in order — ' + s.lab.join(' / '), s.lab[0] === 'Block 1' && s.lab[1] === 'Block 2');
  ok('and a tap really reaches each one', s.head.every((h) => h.reaches));
  ok('open, the heading does NOT repeat the words under it — "' + s.lw.join('" / "') + '"',
    s.lw.every((t) => t === ''));
  const openBoxH = s.box.map((b) => b.h);
  const openPanel = s.panelH;

  // ── 3. tapping the heading folds THAT block away ─────────────────────────
  await page.evaluate(tapHead, 1);
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('block 2 is folded', s.shut[1] && !s.shut[0]);
  ok('its box is out of the layout, not merely dimmed — ' + s.box[1].display + ' ' + Math.round(s.box[1].h) + 'px',
    s.box[1].display === 'none' && s.box[1].h === 0);
  // PHOTOGRAPHED: the ✕ has one class more in its own rule than the blanket
  // one, so it went on floating alone over the folded block's heading
  ok('its corner buttons go with it, the ✕ included', s.box[1].h === 0 && s.corner[1].h === 0 && s.wipe[1].h === 0);
  // PHOTOGRAPHED: a <button> is inline-level and shrinks to fit, so the row
  // ran off the right of the phone instead of ellipsizing
  ok('the shut row stays on the phone (right edge ' + Math.round(s.headRight[1].right) + ' of 390)',
    s.headRight[1].right <= 390 && s.headRight[1].scroll <= s.headRight[1].client + 1);
  ok('block 1 is untouched (' + Math.round(s.box[0].h) + 'px)', Math.abs(s.box[0].h - openBoxH[0]) < 2);
  ok('the panel really got shorter (' + Math.round(openPanel) + ' → ' + Math.round(s.panelH) + 'px)',
    s.panelH < openPanel - 40);
  ok('shut, the heading says the first words of that block — "' + s.lw[1] + '"',
    /tail line one/.test(s.lw[1]) && /^·/.test(s.lw[1].trim()));
  ok('and its own heading is still there to tap back', s.head[1].h > 0 && s.head[1].reaches);
  ok('the words are NOT lost — the block still holds them', /tail line one/.test(s.values[1]));
  ok('and the draft still carries them', Array.isArray(s.draft.blocks) && /tail line one/.test(s.draft.blocks[0]));

  // ── 4. A FOLDED BLOCK STILL SENDS ITS WORDS ─────────────────────────────
  // the star sends the block she is in, folded or not — nothing about hiding
  // a block may change what the job is
  await page.evaluate(() => {
    const panel = document.querySelector('.panel');
    const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
    wraps[1].querySelector('.bfold').focus();
    wraps[1].querySelector('.bfold').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(200);
  await page.evaluate(tapHead, 1);              // fold it again (the click above opened it)
  await page.waitForTimeout(200);
  s = await page.evaluate(read);
  ok('the folded block is the one the star is pointing at', s.shut[1] && s.active[1]);
  ok('and the gold line moved to its heading — ' + s.head[1].color,
    s.head[1].color !== s.head[0].color);
  const was = await page.evaluate(() => document.querySelectorAll('#feed .job').length);
  await page.click('#go');
  await page.waitForFunction((n) => document.querySelectorAll('#feed .job').length > n, was, { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(200);
  ok('the job the server really got is the FOLDED block\'s words — "' + String((posted[0] || {}).prompt || '').slice(0, 24) + '…"',
    posted.length === 1 && /^tail line one/.test(posted[0].prompt) && !/head line/.test(posted[0].prompt));

  // ── 5. reopening gives the box its real height back ─────────────────────
  await page.evaluate(tapHead, 1);
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('block 2 is open again', !s.shut[1]);
  ok('fitted to its own words, not one line (' + Math.round(s.box[1].h) + 'px, was ' + Math.round(openBoxH[1]) + ')',
    Math.abs(s.box[1].h - openBoxH[1]) < 3 && s.box[1].h > 40);
  ok('and open it says nothing beside its number again', s.lw[1] === '');

  // ── 5b. THE JOIN MARK GOES AWAY WHILE EITHER BLOCK IS FOLDED ────────────
  // (2026-09-13, Sophie: "connect shud buttons go away when collapsed").
  // MEASURED off the rendered row: a mark that is drawn but says the wrong
  // thing, and one that is really out of the layout, are the same markup.
  s = await page.evaluate(read);
  ok('both blocks open — the mark between them is drawn (' + Math.round(s.joins[0].h) + 'px)',
    s.joins.length === 1 && s.joins[0].display !== 'none' && s.joins[0].h > 0);
  await page.evaluate(tapHead, 1);
  await page.waitForTimeout(200);
  s = await page.evaluate(read);
  ok('folding block 2 takes the mark out of the layout', s.shut[1] && s.joins[0].h === 0);
  await page.evaluate(tapHead, 1);
  await page.evaluate(tapHead, 0);
  await page.waitForTimeout(200);
  s = await page.evaluate(read);
  ok('and folding the block ABOVE it takes it too', s.shut[0] && !s.shut[1] && s.joins[0].h === 0);
  await page.evaluate(tapHead, 0);
  await page.waitForTimeout(200);
  s = await page.evaluate(read);
  ok('opening it again brings the mark back', !s.shut[0] && s.joins[0].h > 0);

  // ── 6. WORDS LANDING IN A FOLDED BLOCK OPEN IT ──────────────────────────
  // a slot tap writes into the block she is in and then focuses it, and
  // focusing a box that is not on screen does nothing at all.
  // Block 2 is made active by TAPPING INTO IT, never by folding it: a heading
  // tap that shuts a block deliberately leaves the gold line where it was
  // (2026-09-14), so the upload has to land on block 2's own strip first.
  await page.evaluate(() => {
    const panel = document.querySelector('.panel');
    const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
    wraps[1].querySelector('.pblock').focus();
  });
  await page.waitForTimeout(150);
  await page.setInputFiles('#file', { name: 'edna.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForFunction(() => document.querySelectorAll('.ref .slot').length > 0, null, { timeout: 5000 });
  await page.evaluate(tapHead, 1);
  await page.waitForTimeout(200);
  s = await page.evaluate(read);
  ok('block 2 folded, and still the one the star points at', s.shut[1] && s.active[1]);
  await page.click('.ref .slot');
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('tapping the slot OPENED the block it wrote into', !s.shut[1]);
  ok('and the name really landed in it — "' + s.values[1].slice(-12) + '"', /\[Image1\]/.test(s.values[1]));

  // ── 7. the numbering follows a join ─────────────────────────────────────
  await page.evaluate(() => { document.querySelector('.joinrow .joinb').click(); });
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('one block again, and its heading is hidden with the ✕ and the gold line',
    s.n === 1 && !s.many && s.head[0].display === 'none');

  // ── 8. A FOLD IS MEMORY, NEVER A SETTING — a reload opens everything ────
  await page.evaluate((c) => { const el = document.getElementById('prompt'); el.focus(); el.setSelectionRange(c, c); }, cut);
  await page.click('#divide');
  await page.waitForTimeout(250);
  await page.evaluate(tapHead, 0);
  await page.waitForTimeout(200);
  s = await page.evaluate(read);
  ok('block 1 folded', s.shut[0]);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(400);
  s = await page.evaluate(read);
  ok('her two blocks came back from the draft', s.n === 2 && /head line 1/.test(s.values[0]));
  ok('and NOTHING came back folded', s.shut.every((x) => !x) && s.box.every((b) => b.h > 40));
  ok('no localStorage key was written for a fold',
    await page.evaluate(() => Object.keys(localStorage).every((k) => !/fold_block|blockfold/.test(k))));

  ok('no page errors — ' + errors.join(' | '), errors.length === 0);

  await browser.close();
  server.close();
  report();
})();
