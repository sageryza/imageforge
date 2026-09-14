#!/usr/bin/env node
/* THE REFERENCES BLOCK — SHUT BY DEFAULT, ITS OWN BAR, AND THE DOORS PICKER
 * (2026-09-14, Sophie: "references default collapsed · and collapse when job
 * is sent" · "three relevant icons move to reference block" · "upload recent
 * characters" · "icons become bar above the images" · "also collapsing" · "add
 * api door dropdown options w (?) info about what each accepts and costs").
 *
 * Driven on the REAL page, and every assertion here is a MEASUREMENT or a
 * reading of what the stub server really received: a block that carries the
 * class and hides nothing, a bar left floating over a strip that is not drawn,
 * a drawer still on screen with no control left to close it, a "collapse on
 * send" that also fires on a REFUSAL, a heading hidden with nothing attached
 * (leaving the block with no way in), and a pinned door that never reaches the
 * POST all look identical in the source.
 *
 * Run: node scripts/test-footage-refblock.js
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
    console.log('FOOTAGE REFERENCES BLOCK — ' + pass + ' passed, ' + fails.length + ' FAILED');
    fails.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('FOOTAGE REFERENCES BLOCK — ' + pass + ' passed');
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('footage references block: playwright not installed — skipped'); report(); return;
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

const clip = (id, prompt, sentAt) => ({
  id, prompt, status: 'done', model: 'seedance-2-0-mini', modelLabel: '2.0 Mini',
  seconds: 4, resolution: '480p', ratio: '16:9', sound: true, door: 'atlascloud',
  video: '/clip.mp4', source: '/clip.mp4', poster: '/thumb.png', trims: [], sentAt,
  refs: [{ url: '/thumb.png?r1', kind: 'image', name: 'the office' }],
});
const JOBS = [clip('a', 'the doctor looks up from the desk', 3000)];

const posted = [];
let uploads = 0;
let refuseNext = false;
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/footage') {
    const html = PAGE_SRC.replace('__STUDIO_TOKEN__', '') + PILL;
    res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
  }
  if (/\.png$/.test(u.pathname)) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
  if (u.pathname === '/api/footage/status') {
    return json({ ok: true, doors: { atlascloud: true, openrouter: true, apiframe: true },
      balances: { atlascloud: { configured: true } },
      models: F.publicModels().map((m) => (m.atlascloud ? { ...m, atlasPerSec: 0.011, atlasPays: 20 } : m)),
      ratios: F.RATIOS, sizes: F.SIZES, fee: F.OR_FEE, chat: 'footage' });
  }
  if (u.pathname === '/api/footage/estimate') {
    const d = u.searchParams.get('door') || 'auto';
    const price = { atlascloud: 4.4, openrouter: 13.59, apiframe: 16 };
    const door = d === 'auto' ? 'atlascloud' : d;
    return json({ ok: true, cents: price[door], door, about: door === 'atlascloud' });
  }
  if (u.pathname === '/api/footage/jobs' && req.method === 'POST') {
    let body = ''; req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      try { posted.push(JSON.parse(body)); } catch (_) { posted.push({ bad: body }); }
      if (refuseNext) return json({ ok: false, error: 'refused', refusal: 'content', door: 'atlascloud', why: 'A face it will not draw.' });
      json({ ok: true, jobId: 'new' + posted.length, door: 'atlascloud', estimate: { cents: 4.4 }, seed: 1 });
    });
  }
  if (u.pathname === '/api/footage/jobs') return json({ ok: true, jobs: JOBS, folders: {} });
  if (u.pathname === '/api/cast/films') return json({ ok: true, films: [{ slug: 'ward', name: 'The ward' }] });
  if (u.pathname.indexOf('/api/cast') === 0) {
    return json({ ok: true, films: [{ slug: 'ward', name: 'The ward' }],
      characters: [{ id: 'sophie', name: 'Sophie', kind: 'person', hidden: false,
        looks: [{ key: 'pj', name: 'the blue pajamas', line: '{1} is the woman.', refs: [{ url: '/thumb.png?p', kind: 'image' }] }] }] });
  }
  if (u.pathname === '/api/drop/upload-file') {
    // A URL PER FILE — the strip dedupes by url, so one constant url makes
    // every upload after the first a no-op (test-footage.js's own finding).
    let body = ''; req.on('data', () => {});
    return req.on('end', () => {
      uploads += 1;
      json({ ok: true, item: { id: 'd' + uploads, url: '/thumb.png?up=' + uploads, posterUrl: null, media: 'image' } });
    });
  }
  if (u.pathname === '/api/gallery/assets/notes') return json({ ok: true, assets: [] });
  if (u.pathname === '/api/footage/spend') return json({ ok: true, ok2: true });
  res.writeHead(404); res.end('nope');
});

// WHAT THE BLOCK REALLY IS ON SCREEN
const readBlock = () => {
  const box = (id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return { on: r.height > 0, y: Math.round(r.y), h: Math.round(r.height) }; };
  const fold = document.getElementById('reffold');
  return {
    fold: box('reffold'), bar: box('refbar'), refs: box('refs'),
    recent: box('recent'), cast: box('cast'),
    shut: fold.classList.contains('shut'),
    nofold: fold.classList.contains('nofold'),
    lab: document.getElementById('reffoldlab').textContent.trim(),
    n: document.querySelectorAll('#refs .ref').length,
    // the three icons really are IN the bar, not merely on the page
    inBar: ['add', 'rectog', 'casttog'].map((i) => !!document.getElementById(i).closest('#refbar')),
    // …and nowhere near the BUTTONS row any more
    inCtl: ['add', 'rectog', 'casttog'].some((i) => !!document.getElementById(i).closest('#controls')),
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

  // ── 1. A FRESH PAGE, NOTHING ATTACHED ────────────────────────────────
  await page.goto(base + '/footage');
  await page.waitForTimeout(900);
  let st = await page.evaluate(readBlock);
  ok('no page errors — ' + errs.join(' | '), !errs.length);
  ok('the three icons live in the references bar ' + JSON.stringify(st.inBar), st.inBar.every(Boolean));
  ok('and none of them is left on the BUTTONS row', !st.inCtl);
  ok('with nothing attached the heading is still drawn — the bar under it is the way in ' + JSON.stringify(st.fold), st.fold.on);
  ok('…and it cannot be folded, so the chevron stands down', st.nofold);
  ok('…and the bar is reachable ' + JSON.stringify(st.bar), st.bar.on);
  ok('the bar sits ABOVE the pictures, not beside the heading', st.bar.y > st.fold.y);

  // ── 2. A REFERENCE LANDS — the block opens so she can see it ─────────
  await page.setInputFiles('#file', { name: 'a.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForFunction(() => document.querySelectorAll('#refs .ref').length === 1, null, { timeout: 8000 });
  await page.waitForTimeout(300);
  st = await page.evaluate(readBlock);
  ok('a landing reference OPENS the block — a picture riding unseen is the hidden ingredient', !st.shut && st.refs.on);
  ok('…and the bar is open with it', st.bar.on);

  // ── 3. HER OWN FOLD takes the bar, the pictures and the drawers ──────
  await page.evaluate(() => document.getElementById('rectog').click());
  await page.waitForTimeout(300);
  let drawerWasOpen = await page.evaluate(() => document.getElementById('recent').getBoundingClientRect().height > 0);
  ok('the Recent drawer opens from the bar', drawerWasOpen);
  await page.evaluate(() => document.getElementById('reffold').click());
  await page.waitForTimeout(300);
  st = await page.evaluate(readBlock);
  ok('shut, the pictures are gone from the layout ' + JSON.stringify(st.refs), !st.refs.on);
  ok('shut, the BAR is gone with them — her "also collapsing" ' + JSON.stringify(st.bar), !st.bar.on);
  ok('shut, the Recent drawer is closed too — no drawer with no control to close it', !st.recent.on);
  ok('shut, the heading says how many are riding — ' + st.lab, new RegExp('\u00b7\\s*' + st.n + '$').test(st.lab) && st.n >= 1);
  ok('and the heading itself is still on screen', st.fold.on);

  // ── 4. IT IS REMEMBERED, AND A FRESH PAGE OPENS SHUT ─────────────────
  const stored = await page.evaluate(() => localStorage.getItem('footage_fold_refs'));
  ok('her fold is stored', stored === '1');
  await page.evaluate(() => localStorage.clear());
  await page.goto(base + '/footage');
  await page.waitForTimeout(900);
  await page.setInputFiles('#file', { name: 'b.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForFunction(() => document.querySelectorAll('#refs .ref').length >= 1, null, { timeout: 8000 });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('reffold').click());   // she folds it
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForTimeout(900);
  st = await page.evaluate(readBlock);
  ok('a reload comes back shut, with her pictures still on file ' + JSON.stringify({ shut: st.shut, n: st.n }),
    st.shut && st.n >= 1 && !st.refs.on);
  ok('the default with NOTHING stored is shut — the source says so per fold',
    /var FOLD_SHUT = \{ refs: true \}/.test(PAGE_SRC));

  // ── 5. A SENT JOB SHUTS IT ───────────────────────────────────────────
  await page.evaluate(() => document.getElementById('reffold').click());   // open it again
  await page.waitForTimeout(200);
  await page.fill('#prompt', 'the doctor looks up');
  await page.waitForTimeout(400);
  st = await page.evaluate(readBlock);
  ok('it is open before the send', !st.shut && st.refs.on);
  const nBefore = posted.length;
  await page.click('#go');
  await page.waitForFunction((n) => true, nBefore);
  await page.waitForTimeout(900);
  st = await page.evaluate(readBlock);
  ok('a sent job shuts the block — her "collapse when job is sent" ' + JSON.stringify(st.refs), st.shut && !st.refs.on);
  ok('…and the pictures are untouched, the heading says so — ' + st.lab, st.n >= 1 && new RegExp('\u00b7\\s*' + st.n + '$').test(st.lab));
  ok('the job really went with its reference', posted.length > nBefore && (posted[posted.length - 1].refs || []).length >= 1);

  // ── 6. A REFUSAL LEAVES IT OPEN — the door words re-send that same job ─
  await page.evaluate(() => document.getElementById('reffold').click());
  await page.waitForTimeout(200);
  refuseNext = true;
  const nRef = posted.length;
  await page.click('#go');
  await page.waitForFunction((n) => true, nRef);
  await page.waitForTimeout(900);
  st = await page.evaluate(readBlock);
  const errShown = await page.evaluate(() => !document.getElementById('err').hidden);
  ok('a REFUSED job leaves the block open — hiding half of what is about to ride again is the wrong moment',
    errShown && !st.shut && st.refs.on);
  refuseNext = false;

  // ── 7. THE DOORS PICKER ──────────────────────────────────────────────
  const rows = await page.evaluate(() => [...document.getElementById('door').options].map((o) => o.value + ':' + o.textContent));
  ok('the rows are Cheapest and the live doors — ' + rows.join(','),
    rows[0] === 'auto:Cheapest' && rows.length === 4 && rows.indexOf('openrouter:OpenRouter') > 0);
  ok('it opens on Cheapest', await page.evaluate(() => document.getElementById('door').value) === 'auto');
  const costAuto = await page.evaluate(() => document.getElementById('cost').textContent);
  ok('the price line names the door auto really picked — ' + costAuto, /Atlas Cloud/.test(costAuto));
  await page.selectOption('#door', 'apiframe');
  await page.waitForTimeout(700);
  const costPin = await page.evaluate(() => document.getElementById('cost').textContent);
  ok('picking a door re-prices the tap on THAT door — ' + costPin, /APIFRAME/.test(costPin) && /16/.test(costPin));
  const nPin = posted.length;
  await page.click('#go');
  await page.waitForFunction((n) => true, nPin);
  await page.waitForTimeout(700);
  ok('and the pinned door is what the POST really carries — ' + (posted[posted.length - 1] || {}).door,
    posted.length > nPin && posted[posted.length - 1].door === 'apiframe');
  const isSticky = await page.evaluate(() => Object.keys(localStorage).some((k) => /door/i.test(k)));
  ok('a pinned door is NOT sticky — nothing about it is stored', !isSticky);

  // ── 8. THE (?) CARD ──────────────────────────────────────────────────
  let cardOn = await page.evaluate(() => !document.getElementById('doorcard').hidden);
  ok('the doors card is shut until she asks', !cardOn);
  await page.evaluate(() => document.getElementById('doorq').click());
  await page.waitForTimeout(1200);
  const card = await page.evaluate(() => {
    const c = document.getElementById('doorcard');
    return { on: !c.hidden && c.getBoundingClientRect().height > 0,
      prices: document.getElementById('doorprices').textContent,
      words: c.textContent };
  });
  ok('it opens ' + JSON.stringify({ on: card.on }), card.on);
  ok('it prices THIS clip on every door — ' + card.prices,
    /Atlas Cloud/.test(card.prices) && /OpenRouter/.test(card.prices) && /APIFRAME/.test(card.prices)
    && /4\.4/.test(card.prices) && /13\.59/.test(card.prices) && /16/.test(card.prices));
  ok('and it says what each ACCEPTS, not only what it costs',
    /famous/.test(card.words) && /last frame/.test(card.words) && /drops every reference/.test(card.words));
  await page.evaluate(() => document.body.click());
  await page.waitForTimeout(250);
  cardOn = await page.evaluate(() => !document.getElementById('doorcard').hidden);
  ok('tapping out closes it', !cardOn);

  ok('no page errors through the whole walk — ' + errs.join(' | '), !errs.length);

  await browser.close();
  server.close();
  report();
})();
