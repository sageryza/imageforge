#!/usr/bin/env node
/* PICKING SEVERAL BLOCKS, NOT NECESSARILY NEXT TO EACH OTHER (2026-09-15,
 * Sophie: "how do i select multiple non adjacent text blocks in footage to
 * send appended as one prompt").
 *
 * The REAL page headless, and every assertion is a MEASUREMENT of what really
 * renders or a reading of what the stub server really RECEIVED. In the source
 * these all look identical: a mark with the right markup that ticks nothing, a
 * mark whose CSS never landed, a tick that also folds the block away or drags
 * the gold line onto it, a star that says "2" and posts one block, an appended
 * prompt carrying a slot name that now points at the wrong picture, and an
 * over-$3 arm that sends on the first tap anyway.
 *
 * Run: node scripts/test-footage-pick-blocks.js
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
    console.log('FOOTAGE PICK BLOCKS — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE PICK BLOCKS — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage pick blocks: playwright not installed — skipped'); report(); return;
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
const estimates = [];
let uploads = 0;
let CENTS = 4.4;                       // the stub's price, moved to drive the ask

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
    if (u.pathname === '/api/footage/estimate') {
      estimates.push(u.search);
      return json({ ok: true, cents: CENTS, door: 'atlascloud', exact: true });
    }
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs });
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
      const b = JSON.parse(body);
      posted.push(b);
      const id = 'j' + posted.length;
      jobs.unshift({ id, prompt: b.prompt, model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: b.seconds,
        resolution: b.resolution, ratio: b.ratio, sound: true, refs: [], status: 'drawing', seed: 7,
        sentAt: new Date().toISOString(), estimate: CENTS, vote: '' });
      return json({ ok: true, jobId: id, door: 'atlascloud', fellBack: false, estimate: CENTS, seed: 7 }, 202);
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

// ── what the page really shows ─────────────────────────────────────────────
const read = () => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  const seen = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    // the tap really lands on THIS node — a mark hidden under the chevron, or
    // one the heading's own button eats, reads as present in the source
    const hit = r.width && r.height
      ? document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(Math.min(r.top + r.height / 2, innerHeight - 2)))
      : null;
    return { w: r.width, h: r.height, display: cs.display, radius: cs.borderTopLeftRadius,
      border: cs.borderTopColor, reaches: !!(hit && (hit === el || el.contains(hit))) };
  };
  return {
    n: wraps.length,
    many: panel.classList.contains('many'),
    values: wraps.map((w) => w.querySelector('.pblock').value),
    shut: wraps.map((w) => w.classList.contains('shut')),
    active: wraps.map((w) => w.classList.contains('active')),
    pick: wraps.map((w) => seen(w.querySelector('.bpick'))),
    on: wraps.map((w) => { const e = w.querySelector('.bpick'); return !!(e && e.classList.contains('on')); }),
    checked: wraps.map((w) => { const e = w.querySelector('.bpick'); return e ? e.getAttribute('aria-checked') : null; }),
    // the tick is DRAWN, not just classed — a check with no svg in it is a
    // blank box she has no way to read
    tick: wraps.map((w) => { const g = w.querySelector('.bpick svg'); return g ? getComputedStyle(g).display : 'none'; }),
    hasPick: wraps.map((w) => !!w.querySelector('.bpick')),
    sent: wraps.map((w) => (w.querySelector('.bsent') || {}).textContent || ''),
    refN: wraps.map((w) => (w.querySelector('.bref .n') || {}).textContent || ''),
    golab: (document.getElementById('golab') || {}).textContent || null,
    goTitle: document.getElementById('go').title,
    armed: document.getElementById('go').classList.contains('armed'),
    cost: document.getElementById('cost').dataset.cents,
    draft: JSON.parse(localStorage.getItem('footage_draft') || '{}'),
  };
};
// her thumb, at the mark's own centre — never `.click()` on the node, which
// would pass even if the heading's button sat on top of it
const tapPick = (i) => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  const el = wraps[i].querySelector('.bpick');
  if (!el) return false;
  // elementFromPoint only answers about the VIEWPORT, so a heading below the
  // fold has to be brought up first — the scroll is the test's own, not the
  // page's, and the hit test below is still the real measurement
  const r0 = el.getBoundingClientRect();
  if (r0.top < 60 || r0.bottom > innerHeight - 60) window.scrollBy(0, r0.top - innerHeight / 2);
  const r = el.getBoundingClientRect();
  const at = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
  if (!at || !(at === el || el.contains(at))) return false;
  at.click();
  return true;
};
const write = (text) => {
  const el = document.getElementById('prompt');
  el.value = text; el.dispatchEvent(new Event('input', { bubbles: true }));
};
const writeIn = (a) => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  const el = wraps[a.i].querySelector('.pblock');
  el.value = a.text; el.dispatchEvent(new Event('input', { bubbles: true }));
};
const divideAt = (a) => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  const el = wraps[a.i].querySelector('.pblock');
  const c = el.value.indexOf(a.marker);
  el.focus(); el.setSelectionRange(c, c);
  wraps[a.i].querySelector('.divide').click();
};

const A = 'ONE — the ward corridor at night, she walks';
const B = 'TWO — the nurse looks up from the desk';
const C = 'THREE — the double doors swing shut behind her';

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
  await page.evaluate(write, A);
  await page.waitForTimeout(250);
  let s = await page.evaluate(read);
  ok('one block to start', s.n === 1 && !s.many);
  ok('and no mark is drawn at all — ' + (s.pick[0] || {}).display, !s.pick[0] || (s.pick[0].display === 'none' && !s.pick[0].h));
  ok('the star is the word it has always been — "' + s.golab + '"', s.golab === 'Go');

  // ── 2. THREE BLOCKS, THREE MARKS, EACH REALLY TAPPABLE ──────────────────
  await page.evaluate(write, A + '\n' + B + '\n' + C);
  await page.waitForTimeout(150);
  await page.evaluate(divideAt, { i: 0, marker: 'TWO —' });
  await page.waitForTimeout(200);
  await page.evaluate(divideAt, { i: 1, marker: 'THREE —' });
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('three blocks', s.n === 3 && s.many);
  // `flex` and not the `inline-flex` the rule asks for: the heading is itself
  // a flex box, so its children are flex items and the inline is blockified.
  // Measured rather than assumed — the question is only whether it is laid out.
  ok('each one wears a mark on screen (' + s.pick.map((p) => (p ? p.display + ' ' + Math.round(p.w) + 'x' + Math.round(p.h) : 'none at all')).join(', ') + ')',
    s.pick.every((p) => p && p.display === 'flex' && p.w > 12 && p.h > 12));
  ok('a rounded square, never a circle — ' + (s.pick[0] || {}).radius, !!s.pick[0] && s.pick[0].radius === '6px');
  ok('and a real tap at its own centre reaches it', s.pick.every((p) => p && p.reaches));
  ok('all three start unticked', s.on.every((x) => !x) && s.checked.every((c) => c === 'false'));
  ok('and the star still says Go', s.golab === 'Go');

  // ── 3. A TICK IS NOT A FOLD AND NOT THE GOLD LINE ───────────────────────
  const wasActive = s.active.slice();
  ok('a tap on block 1\'s mark landed on the mark', await page.evaluate(tapPick, 0));
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('block 1 is ticked, and the check is really painted', s.on[0] && s.checked[0] === 'true' && s.tick[0] === 'block');
  ok('the other two are untouched', !s.on[1] && !s.on[2]);
  ok('ticking did NOT fold the block away', !s.shut[0]);
  ok('and did NOT move the gold line — ' + s.active.join(','), String(s.active) === String(wasActive));
  ok('the star names what it would send — "' + s.golab + '"', s.golab === 'Go · 1');

  // ── 4. BLOCK 1 AND BLOCK 3, WITHOUT BLOCK 2 ─────────────────────────────
  ok('a tap on block 3\'s mark landed on the mark', await page.evaluate(tapPick, 2));
  await page.waitForTimeout(350);
  s = await page.evaluate(read);
  ok('one and three are ticked, two is not', s.on[0] && !s.on[1] && s.on[2]);
  ok('the star says two — "' + s.golab + '"', s.golab === 'Go · 2');
  ok('and says so in words too', /2 marked blocks as ONE clip/.test(s.goTitle));

  posted.length = 0;
  await page.click('#go');
  await page.waitForTimeout(500);
  ok('ONE job was posted, not two — ' + posted.length, posted.length === 1);
  const p1 = posted[0] || {};
  ok('it carries block 1 and block 3, in the order they sit, a blank line between',
    p1.prompt === A + '\n\n' + C);
  ok('and block 2 is nowhere in it', String(p1.prompt).indexOf('TWO —') < 0);

  // ── 5. EACH BLOCK IT TOOK READS `sent`, AND BLOCK 2 DOES NOT ────────────
  s = await page.evaluate(read);
  ok('one and three read sent — ' + s.sent.join(' / '), s.sent[0] === 'sent' && s.sent[2] === 'sent');
  ok('and two still reads unsent', s.sent[1] === 'unsent');
  ok('the ticks stay, so sending again is one tap', s.on[0] && s.on[2]);

  // ── 6. THE MARKS SURVIVE A RELOAD ───────────────────────────────────────
  ok('the draft carries the marks', String((s.draft.picks || []).map(Boolean)) === 'true,false,true');
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(450);
  s = await page.evaluate(read);
  ok('after a reload the same two are ticked — ' + s.on.join(','), s.on[0] && !s.on[1] && s.on[2]);
  ok('and the star still says two — "' + s.golab + '"', s.golab === 'Go · 2');

  // ── 7. AN EMPTY TICKED BLOCK IS NOT IN THE CLIP ─────────────────────────
  await page.evaluate(tapPick, 1);
  await page.evaluate(writeIn, { i: 1, text: '' });
  await page.waitForTimeout(350);
  s = await page.evaluate(read);
  ok('block 2 is ticked but empty', s.on[1] && !s.values[1]);
  ok('so the star still counts two — "' + s.golab + '"', s.golab === 'Go · 2');
  await page.evaluate(writeIn, { i: 1, text: B });
  await page.waitForTimeout(400);
  s = await page.evaluate(read);
  ok('typing into it puts it in — "' + s.golab + '"', s.golab === 'Go · 3');
  await page.evaluate(tapPick, 1);
  await page.waitForTimeout(300);

  // ── 8. UNTICK EVERYTHING AND THE STAR IS THE BLOCK SHE IS IN ────────────
  await page.evaluate(tapPick, 0);
  await page.evaluate(tapPick, 2);
  await page.waitForTimeout(400);
  s = await page.evaluate(read);
  ok('nothing ticked', s.on.every((x) => !x));
  ok('and the star is the word again — "' + s.golab + '"', s.golab === 'Go');
  posted.length = 0;
  await page.evaluate(() => {
    const panel = document.querySelector('.panel');
    const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
    wraps[1].querySelector('.pblock').focus();
  });
  await page.waitForTimeout(250);
  await page.click('#go');
  await page.waitForTimeout(450);
  ok('one job, and it is the block with the gold line alone',
    posted.length === 1 && posted[0].prompt === B);

  // ── 9. OVER $3 THE FIRST TAP ASKS AND THE SECOND SENDS ──────────────────
  CENTS = 420;
  await page.evaluate(tapPick, 0);
  await page.evaluate(tapPick, 2);
  await page.waitForTimeout(600);
  posted.length = 0;
  await page.click('#go');
  await page.waitForTimeout(400);
  s = await page.evaluate(read);
  ok('the first tap posted NOTHING — ' + posted.length, posted.length === 0);
  ok('the star is armed and names the total — "' + s.golab + '"', s.armed && /\$4\.20/.test(s.golab));
  await page.click('#go');
  await page.waitForTimeout(500);
  s = await page.evaluate(read);
  ok('the second tap sent it, once', posted.length === 1);
  ok('and the star is back to its count — "' + s.golab + '"', !s.armed && s.golab === 'Go · 2');
  CENTS = 4.4;

  // ── 10. A CHANGED SET DISARMS, so an armed star cannot send a stale one ──
  CENTS = 420;
  await page.waitForTimeout(400);
  posted.length = 0;
  await page.click('#go');
  await page.waitForTimeout(350);
  ok('armed again', (await page.evaluate(read)).armed && posted.length === 0);
  await page.evaluate(tapPick, 1);                 // she changes her mind
  await page.waitForTimeout(450);
  s = await page.evaluate(read);
  ok('changing the set took the arm off — ' + s.golab, !s.armed && s.golab === 'Go · 3');
  await page.click('#go');
  await page.waitForTimeout(400);
  ok('so that tap asked again rather than sending', posted.length === 0);
  CENTS = 4.4;
  await page.evaluate(tapPick, 0);
  await page.evaluate(tapPick, 1);
  await page.evaluate(tapPick, 2);
  await page.waitForTimeout(400);

  // ── 11. A DIVIDE COPIES THE MARK, A JOIN KEEPS IT ───────────────────────
  await page.evaluate(tapPick, 0);
  await page.waitForTimeout(250);
  await page.evaluate(divideAt, { i: 0, marker: 'corridor' });
  await page.waitForTimeout(350);
  s = await page.evaluate(read);
  ok('the divide made four blocks', s.n === 4);
  ok('and both halves of the marked one are marked — ' + s.on.join(','), s.on[0] && s.on[1]);
  await page.evaluate(() => {
    const panel = document.querySelector('.panel');
    panel.querySelector('.joinrow:not(.hid)').querySelector('button').click();
  });
  await page.waitForTimeout(350);
  s = await page.evaluate(read);
  ok('joining them back gives three, still marked — ' + s.on.join(','), s.n === 3 && s.on[0]);

  // ── 12. THE PRICE ON THE STAR IS THE UNION'S SHAPE ──────────────────────
  await page.evaluate(tapPick, 2);
  await page.waitForTimeout(250);
  estimates.length = 0;
  await page.setInputFiles('#file', { name: 'a.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForTimeout(700);
  s = await page.evaluate(read);
  ok('the active block carries the picture', s.refN.some((n) => n === '1'));
  const q = estimates[estimates.length - 1] || '';
  ok('and the price was asked for a job with one picture — ' + q, /imgs=1/.test(q) && /refs=1/.test(q));

  ok('no page errors — ' + errors.join(' | '), errors.length === 0);

  await browser.close();
  server.close();
  report();
})();
