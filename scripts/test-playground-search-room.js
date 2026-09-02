#!/usr/bin/env node
// THE SEARCH BOX STAYS ON THE ROW AND RUNS INTO THE PILL'S COLUMN
// (2026-08-28, Sophie: "search way too small. why can't it show behind pill
// column" → "i don't need to tap" → "put x on other side" → "you put it on a
// separate row? I specifically asked for it to stay where it is").
//
// The ROW cannot go under the pill — `.feedbar` is sticky at top:0, so it sits
// inside the pill's fixed corner permanently rather than passing under it, and
// anything tappable in those 56px is covered for good. But the FIELD can, now
// that the ✕ is at its left end: nothing on its right is a control, only the
// tail of a query. Drives the REAL public/promptlab.html with the REAL
// injected pill in headless Chromium at 390pt, at the iPhone 13's 47px
// safe-area inset, and MEASURES it — "way too small" is a width and nothing
// else:
//   1. the search is on the SAME line as the controls — one row, no wrap,
//   2. it runs to the edge of the page, into the pill's column,
//   3. the CONTROLS still stop before that column and every one takes a tap,
//      and so does the pill itself over the field's tail,
//   4. focusing, typing and clearing never change the layout — no state,
//   5. the ✕ is at the LEFT end and the words start clear of it.
//
//   npm install playwright --no-save && node scripts/test-playground-search-room.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const servePublic = require('./lib/public-asset');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const T0 = 1786000000000;
const PILL = 56;          // the column the row reserves for the injected pill
const RUNS = [0, 1, 2].map((i) => ({
  id: 'run' + i, prompt: 'prompt number ' + i, status: 'done', engine: 'gptimage',
  model: 'gpt-image-2', quality: 'medium', aspectRatio: '2:3',
  images: ['/px.png?i=' + i], votes: i === 0 ? { 0: 'like' } : {}, createdAt: T0 - i * 60000,
}));

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/promptlab') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs: RUNS, more: false }));
  }
  if (url.pathname === '/px.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'));
  }
  if (url.pathname === '/' || url.pathname === '/playground') {
    // The REAL page plus the REAL injected pill — the pill is what owns the
    // column this line now runs into, so a harness without it cannot see the
    // one thing that could go wrong here.
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8') +
                   fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8'));
  }
  res.writeHead(404).end();
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const ok = (c, m) => { if (c) console.log('  ok  ' + m); else fail(m); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  // The container's browser is at a fixed path and the bundled headless shell
  // is not installed here — the same fallback every other harness in this repo
  // carries, so this one can actually run.
  let b;
  try { b = await chromium.launch(); }
  catch { b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  // The iPhone 13's safe-area inset is 47px and headless Chromium's is 0 —
  // the pill's top rides it, so without this the collision cannot be judged.
  await page.addInitScript(() => {
    addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = '.float{top:47px !important}';
      document.head.appendChild(st);
    });
  });
  await page.goto('http://127.0.0.1:' + port + '/playground');
  await page.waitForSelector('#tiles .tile, #runs .run', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);

  const snap = () => page.evaluate(() => {
    const box = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { w: Math.round(r.width), right: Math.round(r.right), shown: r.width > 0 };
    };
    const bar = document.querySelector('.feedbar');
    const br = bar.getBoundingClientRect();
    return {
      barRight: Math.round(br.right), barTop: Math.round(br.top),
      // The ♥/✕ pair moved into the filters drawer (2026-09-02, Sophie: "you
      // can put the heart x thing within the toggle"), so the chip that opens
      // it is what stands on the row where `.filttog` used to.
      view: box('.viewtog'), filt: box('#feedfilters .filtchip'), search: box('.feedsearch'),
      lines: new Set(Array.from(bar.children).filter((c) => c.getBoundingClientRect().width)
        .map((c) => Math.round(c.getBoundingClientRect().top))).size,
    };
  });
  const focus = () => page.focus('#q');
  const blur = () => page.evaluate(() => document.getElementById('q').blur());

  // 1 ── one row: the search sits with the controls
  let s = await snap();
  const rest = s.search.w;
  ok(s.lines === 1, 'the search is on the SAME line as the controls — one row');

  // 2 ── and it runs into the pill's column
  ok(s.search.right >= s.barRight - 1,
     'it runs to the edge of the page, into the pill\'s column (her ask)');
  ok(rest >= 120, 'so it is wider than the row alone would leave it (' + rest + 'px)');

  // 3 ── the controls keep the reservation, and everything still takes a tap
  ok(s.view.shown && s.filt.shown, 'the view switch and the filters are still on the row');
  const ctrlClear = await page.evaluate((pill) => {
    const bar = document.querySelector('.feedbar').getBoundingClientRect();
    return ['.viewtog', '#feedfilters .filtchip'].every((sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return r.right <= bar.right - pill + 1;
    });
  }, PILL);
  ok(ctrlClear, 'the CONTROLS still stop before the pill column — every one is a tap target');
  const reachable = () => page.evaluate(() => ['#v-list', '#v-tiles', '#feedfilters .filtchip']
    .every((sel) => {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!(e && (e === el || el.contains(e)));
    }));
  ok(await reachable(), 'and every one of them really takes a tap there (elementFromPoint)');
  const pillTap = await page.evaluate(() => {
    const f = document.querySelector('body > .float');
    if (!f) return 'no pill';
    const r = f.getBoundingClientRect();
    const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!(e && e.closest('.float'));
  });
  ok(pillTap === true, 'and the pill still takes its own taps over the field\'s tail');

  // 4 ── no state: focus, type and clear never move the layout
  await focus(); await page.waitForTimeout(150);
  let f = await snap();
  ok(f.search.w === rest && f.lines === 1, 'focusing changes nothing — there is nothing to expand');
  await page.type('#q', 'prompt'); await page.waitForTimeout(500);
  f = await snap();
  ok(f.search.w === rest && f.lines === 1, 'typing changes nothing');
  ok(await reachable(), 'and every control is still reachable with a query live');
  ok(await page.evaluate(() => !document.querySelector('.feedbar').className.includes('searching')),
     'and the row carries no searching state at all');

  // 5 ── the ✕ is on the LEFT, and the words start clear of it
  const x = await page.evaluate(() => {
    const b = document.getElementById('qclear').getBoundingClientRect();
    const i = document.getElementById('q').getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(document.getElementById('q')).paddingLeft);
    const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return { shown: !document.getElementById('qclear').hidden, onLeft: b.x < i.x + i.width / 2,
             pad: pad, w: b.width, takesTap: !!(hit && hit.closest('#qclear')) };
  });
  ok(x.shown, 'the ✕ shows once there are words to wipe');
  ok(x.onLeft, 'and it is at the LEFT end of the field');
  ok(x.pad >= x.w, 'and the words start clear of it (padding ' + x.pad + ' ≥ ' + Math.round(x.w) + ')');
  ok(x.takesTap, 'and it really takes a tap there (elementFromPoint)');
  await page.click('#qclear'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.getElementById('q').value === '' &&
       document.activeElement === document.getElementById('q')),
     'it empties the box and keeps her in it');
  f = await snap();
  ok(f.search.w === rest && f.lines === 1, 'and clearing changes nothing either');

  await b.close(); server.close();
  if (!process.exitCode) console.log('\nAll good.');
})().catch((e) => { console.error(e); process.exit(1); });
