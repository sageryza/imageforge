#!/usr/bin/env node
/* CLEAR AND UNDO ON THE FOOTAGE PAGE (2026-09-11, Sophie: "add a clear button
 * to footage · with an undo · make a draft save automatically").
 *
 * The REAL page headless, and every assertion is a MEASUREMENT or a reading
 * of what really landed in storage — because a `clear` that empties the box
 * and leaves the references attached, an `undo` whose bank never reached
 * localStorage (so it dies on the next reload), a word drawn where the pill
 * covers it, and a clear that also reset the model all look identical in the
 * source.
 *
 * Run: node scripts/test-footage-clear.js
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
    console.log('FOOTAGE CLEAR — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE CLEAR — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage clear: playwright not installed — skipped'); report(); return;
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
const jobs = [];

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
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
    if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
    if (u.pathname === '/ref.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')); }
    res.writeHead(404); res.end('nope');
  });
});

const SCENE = 'the ward corridor at night, the woman in [Image1] walking away';
const SECOND = 'she stops at the door';
const OTHER = 'the sun room, morning';

// what the page really shows and really stored
const read = () => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  const btn = (id) => {
    const el = document.getElementById(id);
    if (!el) return { there: false };
    const r = el.getBoundingClientRect();
    const shown = !el.hidden && r.width > 0 && r.height > 0;
    const hit = shown ? document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)) : null;
    const cs = getComputedStyle(el);
    return { there: true, shown, words: el.textContent.trim(), left: r.left, right: r.right, top: r.top, bottom: r.bottom,
      reaches: shown && (hit === el || (hit && el.contains(hit))),
      underline: cs.textDecorationLine, border: cs.borderTopWidth, bg: cs.backgroundColor };
  };
  return {
    n: wraps.length,
    values: wraps.map((w) => w.querySelector('.pblock').value),
    active: wraps.findIndex((w) => w.classList.contains('active')),
    refs: Array.from(document.querySelectorAll('#refs .ref')).length,
    slots: Array.from(document.querySelectorAll('#refs .slot')).map((s) => s.textContent.trim()),
    seed: document.getElementById('seedbox').value,
    model: document.getElementById('model').value,
    res: document.getElementById('res').value,
    ratio: document.getElementById('ratio').value,
    secs: document.getElementById('secs').value,
    clear: btn('clearjob'),
    undo: btn('undojob'),
    go: (() => { const r = document.getElementById('go').getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; })(),
    row: (() => { const r = document.getElementById('go').parentNode.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, right: r.right, h: r.height }; })(),
    wipes: (() => { const el = document.getElementById('wipes'); return { shown: el.getClientRects().length > 0 }; })(),
    // the pill's REAL column — it is conditional, so a hidden pill reports an
    // all-zero rect and every "clear of the pill" check would pass vacuously.
    // Shown for one synchronous measurement and put back, the page's own trick.
    pill: (() => {
      const f = document.querySelector('body > .float'); if (!f) return null;
      let r = f.getClientRects().length ? f.getBoundingClientRect() : null;
      if (!r) { const d = f.style.display, v = f.style.visibility;
        f.style.visibility = 'hidden'; f.style.display = '';
        if (f.getClientRects().length) r = f.getBoundingClientRect();
        f.style.display = d; f.style.visibility = v; }
      return r ? { left: r.left, top: r.top, bottom: r.bottom, drawn: f.getClientRects().length > 0 } : null;
    })(),
    draft: JSON.parse(localStorage.getItem('footage_draft') || '{}'),
    bank: JSON.parse(localStorage.getItem('footage_cleared') || 'null'),
    toast: document.getElementById('toast').classList.contains('show') ? document.getElementById('toast').textContent : '',
  };
};
const typeIn = (t) => { const el = document.getElementById('prompt'); el.value = t; el.dispatchEvent(new Event('input', { bubbles: true })); };

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
  await page.waitForTimeout(400);

  // ── 1. never a dead control: an empty page carries neither word ─────────
  let s = await page.evaluate(read);
  ok('both words exist in the page', s.clear.there && s.undo.there);
  ok('nothing typed: `clear` is not drawn', !s.clear.shown);
  ok('nothing banked: `undo` is not drawn', !s.undo.shown);
  ok('and the group goes with them, so the star\'s row is untouched', !s.wipes.shown);
  const emptyRow = s.row.h;

  // ── 2. typing lights `clear`, and it is a WORD, not a boxed button ──────
  await page.evaluate(typeIn, SCENE);
  await page.waitForTimeout(150);
  s = await page.evaluate(read);
  ok('one word in the box lights `clear`', s.clear.shown && s.clear.words === 'clear');
  ok('and `undo` stays away', !s.undo.shown);
  ok('it is underlined — ' + s.clear.underline, /underline/.test(s.clear.underline));
  ok('with no box and no fill (border ' + s.clear.border + ', bg ' + s.clear.bg + ')',
    parseFloat(s.clear.border) === 0 && /rgba\(0, 0, 0, 0\)|transparent/.test(s.clear.bg));
  // THE ROW WRAPS AT 390pt AND THAT IS THE HOUSE RULE, not a bug ("consolidate
  // buttons. same row unless it bleeds over"): MEASURED, the seed, the star
  // and the price leave 24px and the word is 25. So it lands hard right on the
  // line under the price — never centred, never adrift in the middle.
  ok('it sits in the star\'s row block (' + Math.round(s.clear.top) + '-' + Math.round(s.clear.bottom) + ' inside ' + Math.round(s.row.top) + '-' + Math.round(s.row.bottom) + ')',
    s.clear.top >= s.row.top - 1 && s.clear.bottom <= s.row.bottom + 1);
  ok('hard right, at the row\'s own edge (' + Math.round(s.clear.right) + ' of ' + Math.round(s.row.right) + ')',
    Math.abs(s.clear.right - s.row.right) <= 1);
  ok('at or under the star, never above it (' + Math.round(s.clear.top) + ' vs ' + Math.round(s.go.top) + ')', s.clear.top >= s.go.top - 1);
  ok('and a tap really reaches it', s.clear.reaches);
  ok('the row it costs is the ONE it wraps onto (' + Math.round(emptyRow) + ' → ' + Math.round(s.row.h) + 'px)',
    s.row.h > emptyRow && s.row.h < emptyRow * 2);
  // THE PILL'S COLUMN IS REAL, so a row that sits in its band must end before
  // it. This row is below the band today (content passes under the rail on
  // every page here) — the check is conditional rather than vacuous, and it
  // is what catches the day the panel grows shorter and the star's row rises
  // into the pill's corner.
  ok('the pill measured (' + (s.pill ? Math.round(s.pill.left) + ', ' + Math.round(s.pill.top) + '-' + Math.round(s.pill.bottom) : 'none') + ')', !!s.pill);
  ok('and the word is clear of its column wherever it lands',
    !s.pill || s.clear.bottom <= s.pill.top || s.clear.top >= s.pill.bottom || s.clear.right <= s.pill.left);

  // ── 3. a clear wipes the JOB — words, references, marks and seed ────────
  await page.evaluate(({ b, prompt }) => localStorage.setItem('footage_handoff', JSON.stringify({
    prompt: prompt, refs: [{ url: b + '/ref.png?a', kind: 'image' }, { url: b + '/ref.png?b', kind: 'image' }], at: Date.now(),
  })), { b: base, prompt: SCENE + '\n' + SECOND });
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await page.waitForTimeout(400);
  // divide it, mark a keyframe and type a seed, so the clear has everything to wipe
  await page.evaluate((at) => { const el = document.getElementById('prompt'); el.focus(); el.setSelectionRange(at, at); }, SCENE.length + 1);
  await page.click('#divide');
  await page.waitForTimeout(200);
  await page.click('#refs .kf');
  await page.waitForTimeout(200);
  await page.evaluate(() => { const el = document.getElementById('seedbox'); el.value = '4242'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(150);
  const before = await page.evaluate(read);
  ok('set up: two blocks, two references, a seed', before.n === 2 && before.refs === 2 && before.seed === '4242');

  await page.click('#clearjob');
  await page.waitForTimeout(300);
  s = await page.evaluate(read);
  ok('cleared: one empty block', s.n === 1 && s.values[0] === '');
  ok('every reference is off the strip', s.refs === 0);
  ok('the seed box is empty', s.seed === '');
  ok('the DRAFT was emptied too, so a reload cannot resurrect it',
    !String(s.draft.prompt || '').trim() && !(s.draft.refs || []).length && !('blocks' in s.draft) && !('first' in s.draft) && !('last' in s.draft));
  ok('`clear` goes away — there is nothing left to clear', !s.clear.shown);
  ok('`undo` appears in its place', s.undo.shown && s.undo.words === 'undo');
  ok('and the toast says it can be put back — "' + s.toast + '"', /undo/i.test(s.toast));

  // ── 4. IT LEAVES THE SETTINGS ALONE — they are hers and sticky ──────────
  ok('the model is where she left it (' + s.model + ')', s.model === before.model);
  ok('so is the size (' + s.res + ')', s.res === before.res);
  ok('so is the shape (' + s.ratio + ')', s.ratio === before.ratio);
  ok('so are the seconds (' + s.secs + ')', s.secs === before.secs);

  // ── 5. THE CLEARED JOB IS SAVED — the bank really reached storage ───────
  ok('the bank holds both blocks', s.bank && Array.isArray(s.bank.blocks) && s.bank.blocks.length === 2
    && s.bank.blocks[0] === before.values[0] && s.bank.blocks[1] === before.values[1]);
  ok('both references', s.bank && (s.bank.refs || []).length === 2);
  ok('the keyframe mark', s.bank && !!s.bank.first);
  ok('and the seed', s.bank && s.bank.seed === '4242');

  // ── 6. undo puts every one of them back ────────────────────────────────
  await page.click('#undojob');
  await page.waitForTimeout(300);
  s = await page.evaluate(read);
  ok('undo: both blocks are back with their words',
    s.n === 2 && s.values[0] === before.values[0] && s.values[1] === before.values[1]);
  ok('both references are back on the strip', s.refs === 2);
  ok('the slot names read the same as before (' + s.slots.join(' ') + ')', s.slots.join(' ') === before.slots.join(' '));
  ok('the seed is back', s.seed === '4242');
  ok('the draft carries it all again', s.draft.prompt === before.values[0] && (s.draft.refs || []).length === 2);
  ok('`clear` is back and `undo` is gone — nothing left to undo', s.clear.shown && !s.undo.shown);
  ok('and the bank is emptied out of storage', s.bank === null);

  // ── 7. the bank OUTLIVES A RELOAD — that is the automatic draft save ────
  await page.click('#clearjob');
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(400);
  s = await page.evaluate(read);
  ok('reloaded onto an empty box', s.n === 1 && s.values[0] === '' && s.refs === 0);
  ok('and `undo` is still there', s.undo.shown);
  await page.click('#undojob');
  await page.waitForTimeout(400);
  s = await page.evaluate(read);
  ok('a reload later, undo still puts the whole job back',
    s.n === 2 && s.values[0] === before.values[0] && s.values[1] === before.values[1] && s.refs === 2 && s.seed === '4242');

  // ── 8. undo is a SWAP, so typing after a clear loses nothing either ─────
  await page.click('#clearjob');
  await page.waitForTimeout(250);
  await page.evaluate(typeIn, OTHER);
  await page.waitForTimeout(200);
  s = await page.evaluate(read);
  ok('typing after a clear lights `clear` again with `undo` still beside it', s.clear.shown && s.undo.shown);
  ok('the two sit side by side on one line, `clear` first (' + Math.round(s.clear.right) + ' < ' + Math.round(s.undo.left) + ')',
    s.clear.right < s.undo.left && Math.abs(s.clear.top - s.undo.top) < 1 && s.undo.left - s.clear.right >= 8);
  ok('and both are really tappable', s.clear.reaches && s.undo.reaches);
  await page.click('#undojob');
  await page.waitForTimeout(300);
  s = await page.evaluate(read);
  ok('undo brought the cleared job back', s.n === 2 && s.values[0] === before.values[0] && s.refs === 2);
  ok('and `undo` is still offered — the words she typed went into the bank', s.undo.shown);
  await page.click('#undojob');
  await page.waitForTimeout(300);
  s = await page.evaluate(read);
  ok('tapping it again returns to those words', s.n === 1 && s.values[0] === OTHER && s.refs === 0);

  // ── 9. nothing in the bank is ever an `undo` offering nothing ───────────
  await page.evaluate(() => { localStorage.setItem('footage_cleared', JSON.stringify({ blocks: [''], active: 0, refs: [], first: '', last: '', seed: '' })); });
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(400);
  s = await page.evaluate(read);
  ok('an empty bank on file draws no `undo`', !s.undo.shown);

  // ── 10. a belt hand-off banks the job it replaces ──────────────────────
  await page.evaluate(() => { localStorage.removeItem('footage_cleared'); });
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(400);
  await page.evaluate(typeIn, SCENE);
  await page.waitForTimeout(200);
  s = await page.evaluate(read);
  ok('set up: words in the box, nothing banked', s.values[0] === SCENE && !s.undo.shown);
  await page.evaluate(({ b, prompt }) => localStorage.setItem('footage_handoff', JSON.stringify({
    prompt: prompt, refs: [{ url: b + '/ref.png?c', kind: 'image' }], at: Date.now(),
  })), { b: base, prompt: OTHER });
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await page.waitForTimeout(400);
  s = await page.evaluate(read);
  ok('the belt scene landed', s.n === 1 && s.values[0] === OTHER && s.refs === 1);
  ok('and the job it replaced is offered back', s.undo.shown && s.bank && s.bank.blocks[0] === SCENE);
  await page.click('#undojob');
  await page.waitForTimeout(400);
  s = await page.evaluate(read);
  ok('undo puts her own words back', s.values[0] === SCENE);

  ok('no page errors', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.log('footage clear: ' + e.stack); process.exit(1); });
