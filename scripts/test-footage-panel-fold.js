#!/usr/bin/env node
/* THE WHOLE PROMPT AREA FOLDS, AND THAT IS THE ONE BUTTON TO THE GALLERY
 * (2026-09-11, Sophie: "make the whole prompt area collapse or one button to
 * get to the gallery at bottom").
 *
 * Driven on the REAL footage page, and every assertion here is a MEASUREMENT:
 * a fold that sets a class and hides nothing, one that hides the panel and
 * leaves the feed where it was, one that folds away the project picker with
 * it, one that loses her words, and one that reopens a box one line tall all
 * look identical in the source. Where a row really is, is read off the
 * rendered page; whether a control can be TAPPED is asked with
 * `elementFromPoint`; what a folded Go really sends is read off the request
 * the stub server receives.
 *
 * Run: node scripts/test-footage-panel-fold.js
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
    console.log('FOOTAGE PANEL FOLD — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE PANEL FOLD — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage panel fold: playwright not installed — skipped'); report(); return;
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

const SCENE = 'A long hospital corridor at night. [Image1] walks past the nurses station and stops at the last door.';
const clip = (id, prompt, sentAt) => ({
  id, prompt, status: 'done', model: 'seedance-2-0-mini', modelLabel: '2.0 Mini',
  seconds: 4, resolution: '480p', ratio: '16:9', sound: true, door: 'atlascloud',
  video: '/clip.mp4', source: '/clip.mp4', poster: '', refs: [], trims: [], sentAt,
});
const JOBS = [clip('a', 'a woman at a kitchen table', 3000), clip('b', 'the ghost on the ceiling', 2000)];

const sent = [];
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/footage') {
    const html = fs.readFileSync(path.join(PUB, 'footage.html'), 'utf8').replace('__STUDIO_TOKEN__', '') + PILL;
    res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
  }
  if (u.pathname === '/api/footage/status') {
    return json({ ok: true, doors: { atlascloud: true },
      balances: { atlascloud: { configured: true } },
      models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)),
      ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE, chat: 'footage' });
  }
  if (u.pathname === '/api/footage/estimate') return json({ ok: true, cents: 4.4, door: 'atlascloud', exact: true });
  if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      try { sent.push(JSON.parse(body)); } catch (_) { sent.push({ bad: body }); }
      json({ ok: true, job: { ...clip('new', 'drawing', 4000), status: 'running', video: '' } });
    });
  }
  if (u.pathname === '/api/footage/jobs') return json({ ok: true, jobs: JOBS });
  if (u.pathname === '/api/cast/films') return json({ ok: true, films: [{ slug: 'ward', title: 'The ward' }] });
  if (u.pathname.indexOf('/api/cast') === 0) return json({ ok: true, characters: [], films: [{ slug: 'ward', title: 'The ward' }] });
  if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, assets: [] });
  res.writeHead(404); res.end('nope');
});

// WHAT THE PANEL REALLY IS ON SCREEN — its own height, how much of it draws,
// where the first clip sits, and whether the picker takes a tap.
const read = () => {
  const panel = document.getElementById('panel');
  const kids = Array.from(panel.children);
  const drawn = kids.filter((k) => {
    const r = k.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  // the rows that are the prompt AREA — the ones that are always there when it
  // is open (a fold row with nothing to fold, an empty error line and the two
  // closed drawers are legitimately not drawn either way, so counting every
  // child would only ever measure those)
  const box = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const area = ['.promptwrap', '#ctlfold', '#controls', '#seedwrap', '#go'].filter(box);
  const proj = document.getElementById('project').getBoundingClientRect();
  const hit = document.elementFromPoint(Math.round(proj.x + proj.width / 2), Math.round(proj.y + proj.height / 2));
  const card = document.querySelector('#feed .job');
  const words = document.getElementById('panelfoldwords');
  return {
    panelH: Math.round(panel.getBoundingClientRect().height),
    kids: kids.length,
    drawn: drawn.length,
    drawnIs: drawn.map((k) => k.id || k.className).join('|'),
    area: area.join('|'), areaN: area.length,
    feedTop: card ? Math.round(card.getBoundingClientRect().top) : -1,
    projOn: proj.width > 0 && proj.height > 0,
    projTappable: !!(hit && hit.closest('#project')),
    lab: document.getElementById('panelfoldlab').textContent.trim(),
    words: words.textContent.trim(),
    wordCase: getComputedStyle(words).textTransform,
    boxH: Math.round(document.getElementById('prompt').getBoundingClientRect().height),
    val: document.getElementById('prompt').value,
    shut: document.getElementById('panelfold').classList.contains('shut'),
    aria: document.getElementById('panelfold').getAttribute('aria-expanded'),
    stored: localStorage.getItem('footage_fold_panel'),
  };
};

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe() || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  const settle = async () => { await page.waitForTimeout(450); };
  const type = async (s) => page.evaluate((v) => {
    const t = document.getElementById('prompt');
    t.value = v; t.dispatchEvent(new Event('input', { bubbles: true }));
  }, s);

  await page.goto(base + '/footage');
  await page.waitForFunction(() => document.querySelectorAll('#feed .job').length === 2, null, { timeout: 8000 });
  await type(SCENE);
  await settle();

  ok('no page errors', errors.length === 0);

  // ── 1. it opens OPEN — shut is a state she has to have chosen ───────────
  const open = await page.evaluate(read);
  ok('the panel opens open — ' + open.area, !open.shut && open.areaN === 5);
  ok('the row says only Prompt while it is open — ' + open.lab + '/' + open.words, open.lab === 'Prompt' && open.words === '');
  ok('aria says so', open.aria === 'true');
  ok('the box is fitted to her scene (' + open.boxH + 'px)', open.boxH > 40);

  // ── 2. one tap and the panel IS one row ─────────────────────────────────
  await page.click('#panelfold');
  await settle();
  const shut = await page.evaluate(read);
  ok('everything but the fold row is out of the layout — ' + shut.drawnIs, shut.drawn === 1 && /panelrow/.test(shut.drawnIs));
  ok('the box, the buttons, the seed and the star all went (' + shut.areaN + ' left)', shut.areaN === 0);
  ok('the panel is one row tall (' + open.panelH + ' → ' + shut.panelH + 'px)', shut.panelH < 90 && shut.panelH < open.panelH / 3);
  ok('and the gallery comes up to meet it (' + open.feedTop + ' → ' + shut.feedTop + 'px of 844)',
    shut.feedTop > 0 && shut.feedTop < 260 && shut.feedTop < open.feedTop - 250);
  ok('aria says shut', shut.aria === 'false');

  // ── 3. the row says what is in the box, and says it in her own case ─────
  ok('the row carries the first words of the scene — ' + shut.words, shut.words.indexOf('A long hospital corridor') > 0);
  ok('her words are not set in caps — ' + shut.wordCase, shut.wordCase === 'none');
  ok('the label beside them still is', shut.lab === 'Prompt');

  // ── 4. the project picker stays, because it filters the feed she is now
  //       looking at ────────────────────────────────────────────────────────
  ok('the project picker is still drawn while the panel is away', shut.projOn);
  ok('and a tap really reaches it', shut.projTappable);

  // ── 5. THE STAR GOES WITH IT — the whole prompt area, her word, so there is
  //       no send from a screen that is showing her the gallery ────────────
  ok('the star is away with the rest of it', await page.evaluate(() => {
    const r = document.getElementById('go').getBoundingClientRect();
    return r.width === 0 && r.height === 0;
  }));

  // ── 6. remembered, and reopening puts the box back at its real height ───
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#feed .job').length >= 2, null, { timeout: 8000 });
  await settle();
  const back = await page.evaluate(read);
  ok('a reload comes back shut (' + back.stored + ')', back.shut && back.drawn === 1);
  ok('with her scene still in the hidden box', back.val === SCENE);
  await page.click('#panelfold');
  await settle();
  const reopen = await page.evaluate(read);
  ok('reopening draws every row again — ' + reopen.area, !reopen.shut && reopen.areaN === 5);
  ok('and re-fits the box rather than leaving it one line tall (' + reopen.boxH + 'px)', reopen.boxH > 40);
  ok('her words are untouched', reopen.val === SCENE);

  // ── 6b. AND NOTHING WAS LOST TO THE FOLD: the send that follows carries
  //        exactly what the hidden boxes were holding all along ────────────
  const n0 = sent.length;
  await page.click('#go');
  await settle();
  const job = sent[n0];
  ok('the reopened panel sends', sent.length === n0 + 1 && !!job);
  ok('carrying her words (' + String(job && job.prompt).slice(0, 24) + '\u2026)', !!job && job.prompt === SCENE);
  ok('and the settings it was folded on — ' + JSON.stringify(job && { m: job.model, s: job.seconds, r: job.resolution }),
    !!job && job.model === 'mini' && job.seconds === 4 && job.resolution === '480p');

  // ── 7. anything that puts words in the box OPENS it — a belt hand-off is
  //       the one that arrives while she is not looking ────────────────────
  await page.click('#panelfold');
  await settle();
  ok('shut again', (await page.evaluate(read)).shut);
  await page.evaluate(() => {
    localStorage.setItem('footage_handoff', JSON.stringify({
      prompt: 'the ward, from the belt', refs: [], at: Date.now(), title: 'scene 12',
    }));
  });
  // the load door, which is the one drivable headlessly — the page comes back
  // SHUT (it is remembered) and the hand-off has to open it anyway
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#feed .job').length >= 2, null, { timeout: 8000 });
  await settle();
  const hand = await page.evaluate(read);
  ok('a belt hand-off opens the panel rather than landing behind it', !hand.shut && hand.areaN === 5);
  ok('and its words are in the box — ' + hand.val, hand.val === 'the ward, from the belt');

  ok('still no page errors', errors.length === 0);

  await browser.close();
  server.close();
  report();
})().catch((e) => { console.error(e); process.exit(1); });
