#!/usr/bin/env node
/* DIVIDE HERE ON THE FOOTAGE BOX (2026-09-11, Sophie: "can u add the feature
 * from story timeline that allows me to divide into two text blocks where my
 * cursor · a button · says divide here · pinned or sticky in footage · icon
 * this time").
 *
 * The REAL page headless, every assertion a MEASUREMENT or a reading of what
 * the stub server really received: a button that divides nothing, a second
 * block that renders but never reaches the star, a ring whose CSS never
 * landed, two corner buttons of which only one pins, and a divide that walks
 * the page away from the seam all look identical in the source.
 *
 * Run: node scripts/test-footage-divide.js
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
    console.log('FOOTAGE DIVIDE — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE DIVIDE — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage divide: playwright not installed — skipped'); report(); return;
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
const posted = [];
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
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
      const b = JSON.parse(body);
      posted.push(b);
      const id = 'j' + posted.length;
      jobs.unshift({ id, prompt: b.prompt, model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: b.seconds,
        resolution: b.resolution, ratio: b.ratio, sound: true, refs: [], status: 'drawing', seed: 7,
        sentAt: new Date().toISOString(), estimate: 4.4, vote: '' });
      return json({ ok: true, jobId: id, door: 'atlascloud', fellBack: false, estimate: 4.4, seed: 7 }, 202);
    }
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
    if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
    if (u.pathname === '/ref.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')); }
    res.writeHead(404); res.end('nope');
  });
});

const LINES = Array.from({ length: 6 }, (_, i) => 'line ' + (i + 1) + ' — the ward corridor at night');
const SCENE = LINES.join('\n');
const LONG = Array.from({ length: 70 }, (_, i) => 'line ' + (i + 1) + ' — the ward corridor at night').join('\n');

// what the page shows, measured
const read = () => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  const rows = Array.from(panel.children).filter((c) => c.classList.contains('joinrow'));
  const ring = (w) => {
    const cs = getComputedStyle(w.querySelector('.pblock'));
    return cs.borderColor === 'rgb(201, 169, 106)' && /rgb\(201, 169, 106\)/.test(cs.boxShadow);
  };
  const btn = (el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    return { pos: getComputedStyle(el).position, top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width,
      reaches: hit === el || (hit && el.contains(hit)), svg: !!el.querySelector('svg'), words: el.textContent.trim() };
  };
  return {
    n: wraps.length,
    values: wraps.map((w) => w.querySelector('.pblock').value),
    active: wraps.map((w) => w.classList.contains('active')),
    ring: wraps.map(ring),
    many: panel.classList.contains('many'),
    rows: rows.map((r) => ({
      before: r.previousElementSibling && r.previousElementSibling.classList.contains('promptwrap'),
      after: r.nextElementSibling && r.nextElementSibling.classList.contains('promptwrap'),
      svg: !!r.querySelector('.joinb svg'),
    })),
    tops: wraps.map((w) => w.getBoundingClientRect().top),
    bottoms: wraps.map((w) => w.getBoundingClientRect().bottom),
    wrapRight: wraps[0].getBoundingClientRect().right,
    divide: btn(document.getElementById('divide')),
    bigger: btn(document.getElementById('bigprompt')),
    toast: document.getElementById('toast').classList.contains('show') ? document.getElementById('toast').textContent : '',
    y: window.scrollY,
    vh: window.innerHeight,
    draft: JSON.parse(localStorage.getItem('footage_draft') || '{}'),
  };
};
const setCaret = ({ sel, at }) => {
  const el = document.querySelector(sel);
  el.focus(); el.setSelectionRange(at, at);
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
  await page.waitForFunction(() => !!window.__stickyBox && !!window.__caretKeep, null, { timeout: 4000 });
  await page.waitForTimeout(300);

  // ── 1. the button: an icon, in the corner beside the bigger-box toggle ───
  let s = await page.evaluate(read);
  ok('one block to start, no join row, no ring', s.n === 1 && s.rows.length === 0 && !s.many && !s.ring[0]);
  ok('divide is an ICON, no words on it — "' + s.divide.words + '"', s.divide.svg && s.divide.words === '');
  ok('it sits on the same line as the bigger-box button (' + Math.round(s.divide.top) + ' vs ' + Math.round(s.bigger.top) + ')',
    Math.abs(s.divide.top - s.bigger.top) < 1);
  ok('to its LEFT, with air between (' + Math.round(s.bigger.left - s.divide.right) + 'px)',
    s.divide.right < s.bigger.left && s.bigger.left - s.divide.right >= 4);
  ok('and a tap reaches it', s.divide.reaches);

  // ── 2. a caret with nothing on one side divides nothing, and says so ─────
  await page.evaluate(setCaret, { sel: '#prompt', at: 0 });
  await page.evaluate((t) => { const el = document.getElementById('prompt'); el.value = t; el.dispatchEvent(new Event('input', { bubbles: true })); el.setSelectionRange(0, 0); }, SCENE);
  await page.click('#divide');
  await page.waitForTimeout(150);
  s = await page.evaluate(read);
  ok('caret at the start: still one block', s.n === 1);
  ok('and a toast says why — "' + s.toast + '"', /cursor/i.test(s.toast));

  // ── 3. the divide: the words after the caret become the next block ───────
  const cut = SCENE.indexOf('line 4');
  await page.evaluate(setCaret, { sel: '#prompt', at: cut });
  await page.click('#divide');
  await page.waitForTimeout(200);
  s = await page.evaluate(read);
  ok('two blocks now', s.n === 2);
  ok('the first holds the words before the caret, trailing whitespace trimmed', s.values[0] === LINES.slice(0, 3).join('\n'));
  ok('the second holds the words after it', s.values[1] === LINES.slice(3).join('\n'));
  ok('a join mark sits in the gap between the two, an icon', s.rows.length === 1 && s.rows[0].before && s.rows[0].after && s.rows[0].svg);
  ok('the second block sits under the first (' + Math.round(s.bottoms[0]) + ' < ' + Math.round(s.tops[1]) + ')', s.bottoms[0] < s.tops[1]);
  ok('the first block is the active one and wears the gold line; the second does not',
    s.many && s.active[0] && !s.active[1] && s.ring[0] && !s.ring[1]);
  ok('the block she is dividing keeps the page where it was (scrollY ' + s.y + ')', s.y === 0);
  ok('the first divide says the rule once — "' + s.toast + '"', /gold line/.test(s.toast));

  // ── 4. the star sends the block she is in ───────────────────────────────
  await page.evaluate(() => document.querySelectorAll('.panel > .promptwrap')[1].querySelector('.pblock').focus());
  await page.waitForTimeout(80);
  s = await page.evaluate(read);
  ok('tapping into the second block moves the gold line to it', s.active[1] && !s.active[0] && s.ring[1] && !s.ring[0]);
  await page.click('#go');
  await page.waitForFunction(() => document.querySelectorAll('#feed .job').length >= 1, null, { timeout: 4000 });
  ok('the star sent the SECOND block\'s words', posted.length === 1 && posted[0].prompt === LINES.slice(3).join('\n'));
  s = await page.evaluate(read);
  ok('the toast names the block — "' + s.toast + '"', /block 2/.test(s.toast));
  ok('both blocks keep their words after the send', s.values[0] === LINES.slice(0, 3).join('\n') && s.values[1] === LINES.slice(3).join('\n'));
  await page.click('#prompt');
  await page.waitForTimeout(80);
  await page.click('#go');
  await page.waitForFunction(() => document.querySelectorAll('#feed .job').length >= 2, null, { timeout: 4000 });
  ok('tapping into the first and pressing the star sends the FIRST', posted.length === 2 && posted[1].prompt === LINES.slice(0, 3).join('\n'));

  // ── 5. the draft carries every block, and a reload restores them ────────
  s = await page.evaluate(read);
  ok('the draft keeps `prompt` as the first block for an older page, and the rest under `blocks`',
    s.draft.prompt === LINES.slice(0, 3).join('\n') && Array.isArray(s.draft.blocks) && s.draft.blocks[0] === LINES.slice(3).join('\n') && s.draft.active === 0);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(300);
  s = await page.evaluate(read);
  ok('reloaded: both blocks are back with their words', s.n === 2 && s.values[0] === LINES.slice(0, 3).join('\n') && s.values[1] === LINES.slice(3).join('\n'));
  ok('the join mark is back between them and the first is the active one', s.rows.length === 1 && s.active[0] && s.many);

  // ── 6. the join puts them back into one ─────────────────────────────────
  await page.click('.joinb');
  await page.waitForTimeout(150);
  s = await page.evaluate(read);
  ok('one block again', s.n === 1 && s.rows.length === 0 && !s.many);
  ok('holding both halves with a blank line between', s.values[0] === LINES.slice(0, 3).join('\n') + '\n\n' + LINES.slice(3).join('\n'));
  ok('no ring on a lone block, and the draft has no `blocks`', !s.ring[0] && !('blocks' in s.draft));

  // ── 7. deep in a tall box the TWO corner buttons pin together ────────────
  await page.evaluate((t) => { const el = document.getElementById('prompt'); el.value = t; el.dispatchEvent(new Event('input', { bubbles: true })); }, LONG);
  await page.waitForTimeout(150);
  await page.click('#bigprompt');
  await page.waitForTimeout(600);
  const before = await page.evaluate(read);
  ok('the big box runs off the phone (' + Math.round(before.bottoms[0]) + ' of ' + before.vh + ')', before.bottoms[0] > before.vh);
  ok('so the bigger-box button pins — ' + before.bigger.pos, before.bigger.pos === 'fixed');
  ok('AND the divide pins with it — ' + before.divide.pos, before.divide.pos === 'fixed');
  ok('side by side on one line (' + Math.round(before.divide.top) + ' vs ' + Math.round(before.bigger.top) + ')', Math.abs(before.divide.top - before.bigger.top) < 1);
  ok('the divide still to its left with the same air (' + Math.round(before.bigger.left - before.divide.right) + 'px)',
    before.divide.right < before.bigger.left && before.bigger.left - before.divide.right >= 4);
  ok('both on screen and both really tappable', before.divide.bottom <= before.vh && before.divide.reaches && before.bigger.reaches);

  // ── 8. a divide from the pinned button keeps the seam where her eyes are ─
  const deepCut = LONG.indexOf('line 40');
  await page.evaluate(setCaret, { sel: '#prompt', at: deepCut });
  // stand her with the caret's line a third of the way down the screen
  await page.evaluate(() => {
    const el = document.getElementById('prompt');
    const c = window.__caretKeep.caretRect(el);
    window.scrollTo(0, window.scrollY + c.top - 300);
  });
  await page.waitForTimeout(250);
  const stood = await page.evaluate(() => {
    const el = document.getElementById('prompt');
    return { y: window.scrollY, caret: window.__caretKeep.caretRect(el).top, pinned: window.__stickyBox.pinned(document.getElementById('divide')) };
  });
  ok('standing mid-scene the divide is pinned (caret line at ' + Math.round(stood.caret) + ')', stood.pinned && stood.caret > 200 && stood.caret < 400);
  await page.evaluate((c) => { document.getElementById('prompt').setSelectionRange(c, c); }, deepCut);
  await page.click('#divide');
  await page.waitForTimeout(700);
  s = await page.evaluate(read);
  ok('two blocks, the tail starting at line 40', s.n === 2 && /^line 40/.test(s.values[1]) && /line 39 — the ward corridor at night$/.test(s.values[0]));
  ok('the page did not move under her (scrollY ' + stood.y + ' → ' + s.y + ')', Math.abs(s.y - stood.y) <= 2);
  ok('the seam sits just under where the caret line was (first block ends at ' + Math.round(s.bottoms[0]) + ' against caret ' + Math.round(stood.caret) + ')',
    s.bottoms[0] - stood.caret > 0 && s.bottoms[0] - stood.caret < 80);
  ok('and the second block starts on screen right under it (' + Math.round(s.tops[1]) + ' of ' + s.vh + ')',
    s.tops[1] > s.bottoms[0] && s.tops[1] < s.vh);

  // ── 9. a belt hand-off is one scene, so it is one block again ───────────
  await page.evaluate(() => localStorage.setItem('footage_handoff', JSON.stringify({ prompt: 'the sun room, morning', refs: [], at: Date.now() })));
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await page.waitForTimeout(200);
  s = await page.evaluate(read);
  ok('the hand-off collapsed the blocks to one holding its words', s.n === 1 && s.values[0] === 'the sun room, morning' && s.rows.length === 0 && !s.many);

  // ── 10. the ✕ on a reference renames the slot in EVERY block ────────────
  await page.evaluate((b) => localStorage.setItem('footage_handoff', JSON.stringify({
    prompt: 'the woman in [Image1] and the boy in [Image2]',
    refs: [{ url: b + '/ref.png?a', kind: 'image' }, { url: b + '/ref.png?b', kind: 'image' }], at: Date.now() })), base);
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await page.waitForTimeout(250);
  const seam = 'the woman in [Image1] and the boy in [Image2]'.indexOf('the boy');
  await page.evaluate(setCaret, { sel: '#prompt', at: seam });
  await page.click('#divide');
  await page.waitForTimeout(150);
  s = await page.evaluate(read);
  ok('divided between the two slot names', s.n === 2 && /\[Image2\]$/.test(s.values[1]));
  await page.click('#refs .x');
  await page.waitForTimeout(200);
  s = await page.evaluate(read);
  ok('taking the first reference off renumbered the SECOND block\'s slot too — "' + s.values[1] + '"',
    /\[Image1\]/.test(s.values[1]) && !/\[Image2\]/.test(s.values[1]));
  ok('and took the name out of the first — "' + s.values[0] + '"', !/\[Image/.test(s.values[0]));

  ok('no page errors', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.log('footage divide: ' + e.stack); process.exit(1); });
