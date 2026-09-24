#!/usr/bin/env node
/* A BLOCK'S OWN REFERENCES (2026-09-14, Sophie: "blocks in footage that have
 * images attached shud keep attached images and the images return when block
 * is selected").
 *
 * The REAL page headless, and every assertion is a MEASUREMENT of what is on
 * screen or a reading of what the stub server really received — a strip that
 * repaints with the wrong block's pictures, a send that carries the page's
 * last strip rather than the block's, a send whose words name slots
 * that are not in the job it sends, and a draft that comes back with one
 * strip on every block all look identical in the source.
 *
 * Verified against the pre-fix page: it CRASHES there — one shared strip
 * writes no `jobs` into the draft and no block carries a count of its own.
 *
 * Run: node scripts/test-footage-block-refs.js
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
    console.log('FOOTAGE BLOCK REFS — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE BLOCK REFS — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage block refs: playwright not installed — skipped'); report(); return;
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
const estimates = [];
const jobs = [];
let slowUpload = 0;
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
    if (u.pathname === '/api/footage/estimate') {
      estimates.push(u.search);
      // a reference video is dearer, so the two shapes answer different money —
      // which is why a price is read off the shape that really rides
      const vid = u.searchParams.get('video') === '1';
      return json({ ok: true, cents: vid ? 9.9 : 4.4, door: 'atlascloud', exact: true });
    }
    if (u.pathname === '/api/footage/jobs' && req.method === 'GET') return json({ ok: true, jobs });
    if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
      const b = JSON.parse(body);
      posted.push(b);
      const id = 'j' + posted.length;
      jobs.unshift({ id, prompt: b.prompt, model: 'mini', modelLabel: '2.0 Mini', door: 'atlascloud', seconds: b.seconds,
        resolution: b.resolution, ratio: b.ratio, sound: true, refs: b.refs || [], status: 'drawing', seed: 7,
        sentAt: new Date().toISOString(), estimate: 4.4, vote: '' });
      return json({ ok: true, jobId: id, door: 'atlascloud', fellBack: false, estimate: 4.4, seed: 7 }, 202);
    }
    if (u.pathname === '/api/drop/upload-file') {
      const name = u.searchParams.get('filename') || 'f';
      const pic = /\.png$/i.test(name);
      const item = { url: 'http://127.0.0.1:' + server.address().port + (pic ? '/ref.png?' : '/clip.mp4?') + encodeURIComponent(name), posterUrl: '' };
      // a real upload is a ROUND TRIP, and that is the whole point of §11
      return slowUpload ? setTimeout(() => json({ ok: true, item }), slowUpload) : json({ ok: true, item });
    }
    if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, chat: 'footage', notes: [] });
    if (u.pathname === '/api/cast/shelf') return json({ ok: true, entries: [] });
    if (u.pathname === '/ref.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')); }
    res.writeHead(404); res.end('nope');
  });
});

// what is really on screen: each block's words, its heading's reference count,
// and the ONE strip under the panel
const read = () => {
  const panel = document.querySelector('.panel');
  const wraps = Array.from(panel.children).filter((c) => c.classList.contains('promptwrap'));
  return {
    n: wraps.length,
    values: wraps.map((w) => w.querySelector('.pblock').value),
    active: wraps.findIndex((w) => w.classList.contains('active')),
    counts: wraps.map((w) => {
      const c = w.querySelector('.bref');
      return c && c.classList.contains('on') ? c.querySelector('.n').textContent : '';
    }),
    strip: Array.from(document.querySelectorAll('#refs .ref')).map((r) => ({
      slot: (r.querySelector('.slot') || {}).textContent || '',
      src: r.querySelector('img') ? r.querySelector('img').getAttribute('src') : '',
      lit: !!r.querySelector('.kf.on'),
    })),
    reflab: document.getElementById('reffoldlab').textContent,
    refsShown: (() => { const r = document.getElementById('refs').getBoundingClientRect(); return !!(r.width && r.height); })(),
    draft: JSON.parse(localStorage.getItem('footage_draft') || '{}'),
    toast: document.getElementById('toast').classList.contains('show') ? document.getElementById('toast').textContent : '',
  };
};
const tapBlock = (i) => {
  const ws = Array.from(document.querySelector('.panel').children).filter((c) => c.classList.contains('promptwrap'));
  ws[i].querySelector('.pblock').focus();
};

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const A = base + '/ref.png?a', B = base + '/ref.png?b';
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window.__keepSentBlocks = true; }); // this test inspects the block after a send
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(300);

  // ── 1. a hand-off's references land on the one block it makes ────────────
  await page.evaluate(([a, b]) => localStorage.setItem('footage_handoff', JSON.stringify({
    prompt: 'the woman in [Image1] and the boy in [Image2]',
    refs: [{ url: a, kind: 'image' }, { url: b, kind: 'image' }], at: Date.now() })), [A, B]);
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await page.waitForFunction(() => document.querySelectorAll('#refs .ref').length === 2);
  let s = await page.evaluate(read);
  ok('one block carrying both pictures', s.n === 1 && s.strip.length === 2);
  ok('and with one block the label says nothing about blocks — "' + s.reflab + '"', s.reflab === 'References');

  // ── 2. a divide gives the tail a COPY, so its own slot names still point ─
  const seam = 'the woman in [Image1] and the boy in [Image2]'.indexOf('and the boy');
  await page.evaluate((at) => { const el = document.getElementById('prompt'); el.focus(); el.setSelectionRange(at, at); }, seam);
  await page.click('#divide');
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('two blocks', s.n === 2 && /\[Image2\]$/.test(s.values[1]));
  ok('each carrying the strip its words were written against — ' + JSON.stringify(s.counts),
    s.counts[0] === '2' && s.counts[1] === '2');
  ok('and the label now names the block the strip belongs to — "' + s.reflab + '"', /block 1/.test(s.reflab));

  // ── 3. the ✕ is the block she is in, and the other keeps its own ─────────
  // block 1 keeps A: drop the SECOND row
  await page.evaluate(() => document.querySelectorAll('#refs .ref')[1].querySelector('.x').click());
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('block 1 is down to one picture', s.strip.length === 1 && s.counts[0] === '1');
  ok('and block 2 still says two', s.counts[1] === '2');
  ok('block 1\'s words kept the name of the picture it still has — "' + s.values[0] + '"',
    /\[Image1\]/.test(s.values[0]) && !/\[Image2\]/.test(s.values[0]));

  // now stand in block 2 and take A off it, so the two blocks hold different
  // single pictures — the shape the union has to get right
  await page.evaluate(tapBlock, 1);
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('tapping into block 2 returns ITS two pictures', s.strip.length === 2);
  ok('and the label follows her — "' + s.reflab + '"', /block 2/.test(s.reflab));
  await page.evaluate(() => document.querySelectorAll('#refs .ref')[0].querySelector('.x').click());
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('block 2 is down to its own one picture', s.strip.length === 1 && s.counts[1] === '1');
  ok('and its words renumbered onto its own strip — "' + s.values[1] + '"', /\[Image1\]/.test(s.values[1]));
  // read through the DRAFT, which is the page's own per-block answer (the live
  // block's strip is the live one, so its own node is deliberately stale)
  const srcs = await page.evaluate(() =>
    (JSON.parse(localStorage.getItem('footage_draft') || '{}').jobs || []).map((j) => j.refs.map((r) => r.url)));
  ok('the two blocks really hold different pictures — ' + JSON.stringify(srcs.map((x) => x.map((u) => u.slice(-1)))),
    srcs[0].length === 1 && srcs[1].length === 1 && srcs[0][0] !== srcs[1][0]);

  // ── 4. the star sends the block she is in, with THAT block's strip ───────
  await page.click('#go');
  await page.waitForFunction(() => document.querySelectorAll('#feed .job').length >= 1, null, { timeout: 5000 });
  let sent = posted[posted.length - 1];
  ok('the star sent block 2\'s words and block 2\'s ONE reference',
    sent && /the boy in \[Image1\]/.test(sent.prompt) && sent.refs.length === 1 && sent.refs[0].url === B);
  await page.evaluate(tapBlock, 0);
  await page.waitForTimeout(250);
  await page.click('#go');
  await page.waitForFunction(() => document.querySelectorAll('#feed .job').length >= 2, null, { timeout: 5000 });
  sent = posted[posted.length - 1];
  ok('and from block 1 it sends block 1\'s words and block 1\'s own reference',
    sent && /the woman in \[Image1\]/.test(sent.prompt) && sent.refs.length === 1 && sent.refs[0].url === A);

  // ── 6. the draft carries a strip per block, and a reload gives them back ─
  s = await page.evaluate(read);
  ok('the draft keeps `refs` as the first block\'s for an older page',
    Array.isArray(s.draft.refs) && s.draft.refs.length === 1 && s.draft.refs[0].url === A);
  ok('and a strip per block beside it',
    Array.isArray(s.draft.jobs) && s.draft.jobs.length === 2
    && s.draft.jobs[0].refs[0].url === A && s.draft.jobs[1].refs[0].url === B);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(400);
  s = await page.evaluate(read);
  ok('reloaded: two blocks, each still saying it carries one', s.n === 2 && s.counts[0] === '1' && s.counts[1] === '1');
  ok('and the strip on screen is the first block\'s', s.strip.length === 1);
  const back = await page.evaluate(() =>
    (JSON.parse(localStorage.getItem('footage_draft') || '{}').jobs || []).map((j) => j.refs.map((r) => r.url)));
  ok('each block came back with its OWN picture', back[0][0] === A && back[1][0] === B);

  // ── 7. an OLD draft (one shared strip, no `jobs`) reaches every block ────
  await page.evaluate(([a, b]) => localStorage.setItem('footage_draft', JSON.stringify({
    prompt: 'a in [Image1]', blocks: ['b in [Image2]'], active: 0,
    refs: [{ url: a, kind: 'image' }, { url: b, kind: 'image' }] })), [A, B]);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#ratio option').length > 0);
  await page.waitForTimeout(400);
  s = await page.evaluate(read);
  ok('a draft written before the strips were per block gives EVERY block the one it saved — '
    + JSON.stringify(s.counts), s.n === 2 && s.counts[0] === '2' && s.counts[1] === '2');

  // ── 8. joining unions the two strips and renumbers both texts ────────────
  // stand in block 2 and take the FIRST picture off it, so the halves differ
  await page.evaluate(tapBlock, 1);
  await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelectorAll('#refs .ref')[0].querySelector('.x').click());
  await page.waitForTimeout(250);
  await page.evaluate(tapBlock, 0);
  await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelectorAll('#refs .ref')[1].querySelector('.x').click());
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('one picture each again, and each block naming its own [Image1] — ' + JSON.stringify(s.values),
    s.counts[0] === '1' && s.counts[1] === '1' && /a in \[Image1\]/.test(s.values[0]) && /b in \[Image1\]/.test(s.values[1]));
  await page.click('.joinb');
  await page.waitForTimeout(350);
  s = await page.evaluate(read);
  ok('one block holding both halves, the second renumbered onto the union — "'
    + s.values[0].replace(/\n+/g, ' / ') + '"',
    s.n === 1 && /a in \[Image1\]/.test(s.values[0]) && /b in \[Image2\]/.test(s.values[0]));
  ok('and the joined block carries both pictures', s.strip.length === 2);

  // ── 9. clear wipes every block's strip, and undo puts them all back ──────
  await page.evaluate((at) => { const el = document.getElementById('prompt'); el.focus(); el.setSelectionRange(at, at); },
    (await page.$eval('#prompt', (e) => e.value.indexOf('b in'))));
  await page.click('#divide');
  await page.waitForTimeout(250);
  await page.click('#clearjob');
  await page.waitForTimeout(300);
  s = await page.evaluate(read);
  ok('cleared: one empty block and nothing attached', s.n === 1 && s.strip.length === 0 && !s.values[0]);
  ok('and the toast counted every block\'s pictures, not the first block\'s — "' + s.toast + '"',
    /2 references/.test(s.toast));
  await page.click('#undojob');
  await page.waitForTimeout(400);
  s = await page.evaluate(read);
  // the divide just above copied the joined block's TWO pictures into both
  // halves, so both is what the bank holds and both is what comes back
  ok('undo put both blocks back with their own strips — ' + JSON.stringify(s.counts),
    s.n === 2 && s.counts[0] === '2' && s.counts[1] === '2');
  ok('with their own words — ' + JSON.stringify(s.values),
    /a in \[Image1\]/.test(s.values[0]) && /b in \[Image2\]/.test(s.values[1]));

  // ── 11. AN UPLOAD LANDS ON THE BLOCK IT WAS STARTED FROM ────────────────
  // An upload is a ROUND TRIP and the globals are the block she is standing in
  // NOW, so tapping into another block while a picture uploads used to land it
  // there — on a scene that never asked for it, renumbering its slot names.
  await page.evaluate(tapBlock, 1);
  await page.waitForTimeout(300);
  let before = await page.evaluate(read);
  const was0 = before.counts[0], was1 = before.counts[1];
  slowUpload = 700;
  await page.setInputFiles('#file', { name: 'late.png', mimeType: 'image/png', buffer: PNG });
  await page.evaluate(tapBlock, 0);                 // tapped away while it uploads
  await page.waitForTimeout(1600);
  slowUpload = 0;
  s = await page.evaluate(read);
  ok('the picture landed on the block the tap was made from — ' + JSON.stringify([was1, s.counts[1]]),
    Number(s.counts[1]) === Number(was1) + 1);
  ok('and not on the block she tapped into — ' + JSON.stringify([was0, s.counts[0]]), s.counts[0] === was0);
  ok('and the toast says where it went — "' + s.toast + '"', /block 2/.test(s.toast));

  // ── 12. FOLDING A BLOCK AWAY DOES NOT SWAP THE STRIP UNDER HER ───────────
  // Every button on a block makes it the one the star sends — and a fold
  // heading is "put this away", not "work here". While the strip was shared
  // this was invisible; now, moving the gold line onto a block she just folded
  // would replace her pictures on screen with that block's. OPENING one still
  // makes it active: that is her going there to write.
  await page.evaluate(tapBlock, 0);
  await page.waitForTimeout(250);
  before = await page.evaluate(read);
  await page.evaluate((i) => {
    const ws = Array.from(document.querySelector('.panel').children).filter((c) => c.classList.contains('promptwrap'));
    ws[i].querySelector('.bfold').click();
  }, 1);
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('folding block 2 leaves the gold line on block 1 — ' + JSON.stringify([before.active, s.active]),
    before.active === 0 && s.active === 0);
  ok('and her strip is untouched — ' + JSON.stringify([before.strip.length, s.strip.length]),
    JSON.stringify(s.strip) === JSON.stringify(before.strip));
  ok('and the row still names block 1 — "' + s.reflab + '"', /block 1/.test(s.reflab));
  await page.evaluate((i) => {
    const ws = Array.from(document.querySelector('.panel').children).filter((c) => c.classList.contains('promptwrap'));
    ws[i].querySelector('.bfold').click();
  }, 1);
  await page.waitForTimeout(250);
  s = await page.evaluate(read);
  ok('opening it again DOES make it the one the star sends — ' + s.active, s.active === 1);
  ok('and the strip is block 2\'s now — "' + s.reflab + '"', /block 2/.test(s.reflab));

  ok('no page errors', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.log('footage block refs: ' + e.stack); process.exit(1); });
