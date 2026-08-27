#!/usr/bin/env node
/*
 * test-copy-restores-reference.js — PUTTING A PROMPT BACK PUTS ITS REFERENCE
 * BACK (2026-08-27, Sophie: "playground and other image tools shud save the
 * reference photo and reload when copy to prompt box").
 *
 * The bytes were never in danger in either tool — the Playground has stored
 * `photoRef` (a Storage url) on every run doc since the photo button shipped,
 * and Freeform has stored `refIds` since it shipped. What was missing was the
 * way BACK: nothing on either page ever read those fields, so a picture drawn
 * with a reference could not be re-run with the same reference.
 *
 * THE RULE UNDER TEST IS "ONLY CHANGE WHAT THE RECORD KNOWS", and the half
 * that is easy to skip is the CLEAR: copying back a run drawn with NO
 * reference must take an attached one OFF, or the next run silently carries an
 * ingredient the one she copied never had. A test that only checks the attach
 * would pass against a page that never clears.
 *
 * Both halves drive the REAL pages in headless Chromium and click the REAL
 * buttons — the restore is a state change across three controls (the thumbnail,
 * the picked strip, the tiles' lit state) and a source assertion cannot see it.
 *
 *   node scripts/test-copy-restores-reference.js
 *   (needs: npm install playwright --no-save)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// A 3x3 red png, served as the "already uploaded" reference both tools restore.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAFklEQVQIW2P8z8Dwn4EIwDiqkL4KAdxlBAXWfaGiAAAAAElFTkSuQmCC',
  'base64');

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('playwright not installed — skipped (npm install playwright --no-save)');
    process.exit(0);
  }
}
function exe() {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  if (fs.existsSync(path.join(root, 'chromium'))) return path.join(root, 'chromium');
  for (const d of fs.readdirSync(root).filter((n) => /^chromium-\d/.test(n))) {
    const p = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ── the Playground ───────────────────────────────────────────────────────
async function playground(browser) {
  console.log('\nthe Playground');
  const pageSrc = fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8');
  const now = Date.now();
  // The urls are ABSOLUTE on purpose. restorePhoto only accepts `^https?://`,
  // which is exactly what server.js accepts back in `photo` — the page must
  // never attach something the run would then silently drop, leaving her
  // looking at a thumbnail that did not ride the request.
  let ORIGIN = '';
  const RUNS = [
    // Newest first, the way the feed hands them back. `withphoto` was drawn
    // with her photo reference; `nophoto` was not, and is what proves the
    // clear.
    { id: 'withphoto', status: 'done', engine: 'gptimage', prompt: 'a cat on a fence',
      model: 'gpt-image-2', gptStyle: 'dreamy', quality: 'low', size: '1024x1536',
      aspectRatio: '2:3', res: '1k', outputs: 1, images: ['/shot.png'],
      photoRef: '', createdAt: now },
    { id: 'nophoto', status: 'done', engine: 'gptimage', prompt: 'a plain house',
      model: 'gpt-image-2', gptStyle: 'dreamy', quality: 'low', size: '1024x1536',
      aspectRatio: '2:3', res: '1k', outputs: 1, images: ['/shot.png'],
      photoRef: '', createdAt: now - 1000 },
  ];
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/photo.png' || url.pathname === '/shot.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(PNG);
    }
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: RUNS, more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        photoLine: ' The LAST attached image is a photo reference: use it for the subject.',
        styles: {
          dreamy: { label: 'Dreamy', prefix: 'HOUSE PREFIX', suffix: 'HOUSE SUFFIX',
                    characterLine: '', refs: [] },
        },
      }));
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  ORIGIN = base;
  RUNS[0].photoRef = base + '/photo.png';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(base + '/playground', { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const state = () => page.evaluate(() => ({
    has: document.getElementById('photowrap').classList.contains('has'),
    src: (document.querySelector('#photopick img') || {}).src || '',
    ref: window.photoRef ? window.photoRef.data : null,
    prompt: document.getElementById('prompt').value,
  }));
  const copy = async (id) => {
    await page.click('.copybtn[data-copy="' + id + '"]');
    await page.waitForTimeout(250);
  };

  ok(await page.evaluate(() => !!document.querySelector('.copybtn[data-copy="withphoto"]')),
    'each run in the feed carries its put-back button');

  const before = await state();
  ok(!before.has, 'nothing is attached to start with');

  await copy('withphoto');
  let s = await state();
  ok(s.prompt === 'a cat on a fence', 'the prompt lands in the box');
  ok(s.has, 'copying back a run drawn WITH a photo attaches one');
  ok(/\/photo\.png$/.test(s.ref || ''), 'and it is the url the run doc recorded');
  ok(/\/photo\.png$/.test(s.src), 'the button wears that photo');
  // The thumbnail must be a picture that actually LOADED — a restored url that
  // 404s would light the control and draw a broken image.
  ok(await page.evaluate(() => {
    const im = document.querySelector('#photopick img');
    return !!im && im.complete && im.naturalWidth > 0;
  }), 'the restored thumbnail really decodes');

  // THE HALF THAT IS EASY TO MISS.
  await copy('nophoto');
  s = await state();
  ok(s.prompt === 'a plain house', 'the second prompt lands');
  ok(!s.has && s.ref === null,
    'copying back a run drawn with NO photo CLEARS the attached one');

  // And the round trip: back onto the one that had it.
  await copy('withphoto');
  s = await state();
  ok(s.has && /\/photo\.png$/.test(s.ref || ''), 'copying back again re-attaches it');

  // A restored url is what the RUN sends — server.js accepts an https url in
  // `photo` and fetches the bytes, so nothing is re-uploaded.
  ok(/^https?:\\\/\\\//.test('') || /photo: photoRef \? photoRef\.data : undefined/.test(pageSrc),
    'the run POSTs whatever is attached, url or dataURL alike');

  // The across-loads rule is HERS and is untouched: a photo attached last week
  // must not silently ride today's run.
  ok(!/localStorage[^\n]*photoRef|photoRef[^\n]*localStorage/.test(pageSrc),
    'the photo is still NOT persisted across page loads');

  await ctx.close();
  server.close();
}

// ── Freeform ─────────────────────────────────────────────────────────────
async function freeform(browser) {
  console.log('\nFreeform');
  const pageSrc = fs.readFileSync(path.join(PUB, 'freeform.html'), 'utf8')
    .replace('__STUDIO_TOKEN__', '');
  const REFS = [
    { id: 'refA', url: '/photo.png', thumb: '/photo.png' },
    { id: 'refB', url: '/photo.png', thumb: '/photo.png' },
  ];
  const RUNS = [
    { id: 'withrefs', prompt: 'a cat on a fence', quality: 'medium', size: 'portrait',
      status: 'done', images: [], refs: ['/photo.png'], refIds: ['refA'], outputs: 1,
      createdAt: 2 },
    { id: 'norefs', prompt: 'a plain house', quality: 'medium', size: 'portrait',
      status: 'done', images: [], refs: [], refIds: [], outputs: 1, createdAt: 1 },
    // A run whose reference has since been deleted from the library: it cannot
    // come back, and the answer must SAY so rather than start one short.
    { id: 'goneref', prompt: 'a lost one', quality: 'medium', size: 'portrait',
      status: 'done', images: [], refs: [], refIds: ['refGone'], outputs: 1,
      createdAt: 0 },
  ];
  const server = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    if (p === '/photo.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(PNG);
    }
    if (p === '/api/freeform/refs') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, refs: REFS }));
    }
    if (p === '/api/freeform/runs') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, runs: RUNS }));
    }
    const f = path.join(PUB, p);
    if (p !== '/' && f.startsWith(PUB) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.writeHead(200, { 'Content-Type': path.extname(f) === '.js' ? 'text/javascript' : 'text/css' });
      return res.end(fs.readFileSync(f));
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(base + '/freeform', { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const state = () => page.evaluate(() => ({
    picked: Object.keys(window.picked || {}).sort(),
    strip: document.querySelectorAll('#refpicked .pk').length,
    lit: Array.prototype.map.call(document.querySelectorAll('.ref.on'), (d) => d.id.slice(4)).sort(),
    prompt: document.getElementById('prompt').value,
    toast: document.getElementById('toast').textContent,
  }));
  const copy = async (id) => {
    await page.click('#run-' + id + ' .copybtn');
    await page.waitForTimeout(250);
  };

  ok(await page.evaluate(() => !!document.querySelector('#run-withrefs .copybtn')),
    'each run carries a put-back button (this page had none at all)');

  // Attach refB by hand first, so the restore has something wrong to correct.
  await page.evaluate(() => { picked.refB = true; drawPicked(); });
  await page.waitForTimeout(100);

  await copy('withrefs');
  let s = await state();
  ok(s.prompt === 'a cat on a fence', 'the prompt lands in the box');
  ok(s.picked.join(',') === 'refA',
    'the run\'s OWN references are what is attached — not added to what was there');
  ok(s.strip === 1, 'the attached strip agrees');
  ok(s.lit.join(',') === 'refA', 'and the library tile is lit for it');

  await copy('norefs');
  s = await state();
  ok(s.picked.length === 0 && s.strip === 0 && s.lit.length === 0,
    'copying back a run drawn with NO references clears them');

  await copy('goneref');
  s = await state();
  ok(s.picked.length === 0, 'a deleted reference cannot come back');
  ok(/no longer in the library/.test(s.toast),
    'and the answer SAYS one is missing rather than starting a run short');

  await ctx.close();
  server.close();
}

(async () => {
  const browser = await chromium.launch(exe() ? { executablePath: exe() } : {});
  try {
    await playground(browser);
    await freeform(browser);
  } finally { await browser.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();
