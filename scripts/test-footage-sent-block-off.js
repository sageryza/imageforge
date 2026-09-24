#!/usr/bin/env node
/* A SENT BLOCK TAKES ITSELF OFF (2026-09-24, Sophie: "make it so sending a job
 * in footage auto deletes the 'sent' text block" · "since that data is saved in
 * the sent job. (but only if the job actually goes through)").
 *
 * The REAL page headless. A job that went takes its block off; a REFUSED one
 * leaves it exactly where it was; undo puts it back; the last block is emptied
 * rather than removed; ticked blocks sent as one clip all come off.
 *
 * Run: node scripts/test-footage-sent-block-off.js
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
    console.log('FOOTAGE SENT BLOCK OFF — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE SENT BLOCK OFF — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage sent block off: playwright not installed — skipped'); report(); return;
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
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') {
      // the story-scoped read `loadHistory` makes — the part's own sent clips
      const story = u.searchParams.get('story') || '';
      return json({ ok: true, jobs: story ? jobs.filter((j) => j.story === story) : jobs, more: false, folders: {} });
    }
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
      const b = JSON.parse(body);
      // A CONTENT REFUSAL: nothing drew, nothing was charged — and nothing may
      // be banked as sent either.
      if (/REFUSEME/.test(b.prompt || '')) {
        posted.push(b);
        return json({ ok: false, error: 'refused', refusal: 'content', why: 'A face in a reference', door: 'atlascloud' }, 400);
      }
      posted.push(b);
      const id = 'j' + posted.length;
      jobs.unshift({ id, prompt: b.prompt, words: b.words || '', unit: b.unit || '', story: b.story || '',
        model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: b.seconds,
        resolution: b.resolution, ratio: b.ratio, sound: true, refs: [], status: 'done',
        video: '', poster: '', seed: 7, sentAt: new Date().toISOString(), estimate: 4.4, vote: '' });
      return json({ ok: true, jobId: id, door: 'atlascloud', fellBack: false, estimate: 4.4, seed: 7 }, 202);
    }
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
    if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
    res.writeHead(404); res.end('nope');
  });
});

const ONE = 'block one — she opens the office door and stops in the doorway';
const TWO = 'block two — the assistant is already standing at the window';

// WHAT THE PAGE REALLY SHOWS. Every field here is read off the rendered box,
// never off a class name: a `.on` whose CSS never landed and a word painted in
// the row's own grey both pass every markup assertion ever written about them.
const read = () => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  const seen = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { w: r.width, h: r.height, left: r.left, right: r.right, display: cs.display,
      color: cs.color, words: (el.textContent || '').trim() };
  };
  return {
    n: wraps.length,
    values: wraps.map((w) => w.querySelector('.pblock').value),
    shut: wraps.map((w) => w.classList.contains('shut')),
    mark: wraps.map((w) => seen(w.querySelector('.bsent'))),
    head: wraps.map((w) => seen(w.querySelector('.bfold'))),
    ref: wraps.map((w) => seen(w.querySelector('.bref'))),
    lw: wraps.map((w) => (w.querySelector('.lw') || {}).textContent || ''),
    title: wraps.map((w) => (w.querySelector('.bfold') || {}).title || ''),
    draft: JSON.parse(localStorage.getItem('footage_draft') || '{}'),
  };
};
const tapHead = (i) => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  wraps[i].querySelector('.bfold').click();
};
const writeIn = (a) => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  const el = wraps[a.i].querySelector('.pblock');
  el.focus();
  el.value = a.text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const tapInto = (i) => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  wraps[i].querySelector('.pblock').focus();
  wraps[i].querySelector('.pblock').dispatchEvent(new Event('focus', { bubbles: true }));
  wraps[i].click();
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
  const THREE = 'block three — the window, and the rain on it';

  // two blocks, send block 1
  await page.evaluate(writeIn, { i: 0, text: ONE });
  await page.evaluate(() => { const el = document.getElementById('prompt'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
  await page.click('#divide'); await page.waitForTimeout(250);
  await page.evaluate(writeIn, { i: 1, text: TWO }); await page.waitForTimeout(250);
  await page.evaluate(tapInto, 0); await page.waitForTimeout(200);
  await page.click('#go'); await page.waitForTimeout(600);
  let s = await page.evaluate(read);
  ok('one job went, with block 1\'s words', posted.length === 1 && (posted[0].prompt || '').indexOf(ONE) === 0);
  ok('block 1 came off and block 2 is all that is left — ' + JSON.stringify(s.values), s.n === 1 && s.values[0] === TWO);
  ok('the draft agrees', s.draft.prompt === TWO && !(s.draft.blocks || []).some((b) => (b.text || b) === ONE));

  // undo puts it back
  await page.click('#undojob'); await page.waitForTimeout(300);
  s = await page.evaluate(read);
  ok('undo puts both blocks back — ' + JSON.stringify(s.values), s.n === 2 && s.values[0] === ONE && s.values[1] === TWO);

  // a refusal takes nothing off
  await page.evaluate(writeIn, { i: 1, text: TWO + ' REFUSEME' }); await page.waitForTimeout(250);
  await page.evaluate(tapInto, 1); await page.waitForTimeout(200);
  let before = posted.length;
  await page.click('#go'); await page.waitForTimeout(600);
  s = await page.evaluate(read);
  ok('the door refused it', posted.length === before + 1);
  ok('and both blocks are still there, words untouched', s.n === 2 && s.values[1] === TWO + ' REFUSEME');

  // ticked blocks sent as one clip all come off
  await page.evaluate(writeIn, { i: 1, text: TWO }); await page.waitForTimeout(200);
  await page.evaluate(() => { const el = document.querySelectorAll('.pblock')[1]; el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
  await page.click('.promptwrap.active .divide'); await page.waitForTimeout(250);
  await page.evaluate(writeIn, { i: 2, text: THREE }); await page.waitForTimeout(250);
  await page.evaluate(() => { document.querySelectorAll('.bpick')[0].click(); document.querySelectorAll('.bpick')[1].click(); });
  await page.waitForTimeout(250);
  before = posted.length;
  await page.click('#go'); await page.waitForTimeout(700);
  s = await page.evaluate(read);
  const last = posted[posted.length - 1] || {};
  ok('one appended job went with both ticked blocks', posted.length === before + 1
    && (last.prompt || '').indexOf(ONE) >= 0 && (last.prompt || '').indexOf(TWO) >= 0);
  ok('both ticked blocks came off, the unticked one stays — ' + JSON.stringify(s.values), s.n === 1 && s.values[0] === THREE);

  // the last block is emptied, never removed
  await page.evaluate(tapInto, 0); await page.waitForTimeout(200);
  before = posted.length;
  await page.click('#go'); await page.waitForTimeout(600);
  s = await page.evaluate(read);
  ok('the last block went', posted.length === before + 1 && (posted[posted.length - 1].prompt || '').indexOf(THREE) >= 0);
  ok('and it is emptied in place, #prompt still the node', s.n === 1 && s.values[0] === '' && !!(await page.$('#prompt')));

  ok('no page errors — ' + errors.join(' | '), !errors.length);
  await browser.close(); server.close(); report();
})().catch((e) => { console.log('footage sent block off: ' + (e && e.stack || e)); process.exit(1); });
