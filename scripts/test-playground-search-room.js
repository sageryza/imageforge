#!/usr/bin/env node
// THE SEARCH BOX HAS ITS OWN LINE, ALWAYS (2026-08-28, Sophie: "search way
// too small. why can't it show behind pill column" → "i don't need to tap" →
// "put x on other side").
//
// It cannot go behind the pill — `.feedbar` is sticky at top:0, so it sits
// inside the pill's fixed corner permanently rather than passing under it. So
// the room comes from a line of its own, unconditionally: a box that is only
// usable once it is tapped is a box she has to ask for. Drives the REAL
// public/promptlab.html in headless Chromium at 390pt and MEASURES it,
// because "way too small" is a width and nothing else:
//   1. untouched, before any tap, the search is on a line of its own and is
//      3-4x the width the shared row left it,
//   2. nothing is hidden to pay for it — the view switch and the filter chips
//      are still there and still take a tap (asked with elementFromPoint),
//   3. focusing, typing and clearing never change the layout: no state, no
//      repaint, nothing that can appear or disappear under her,
//   4. the ✕ is at the LEFT end of the field, and the words start clear of it,
//   5. the 56px the injected autoscroll pill owns is never eaten.
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
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8'));
  }
  res.writeHead(404).end();
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const ok = (c, m) => { if (c) console.log('  ok  ' + m); else fail(m); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
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
      view: box('.viewtog'), filt: box('.filttog'), search: box('.feedsearch'),
      lines: new Set(Array.from(bar.children).filter((c) => c.getBoundingClientRect().width)
        .map((c) => Math.round(c.getBoundingClientRect().top))).size,
    };
  });
  const focus = () => page.focus('#q');
  const blur = () => page.evaluate(() => document.getElementById('q').blur());

  // 1 ── untouched, before any tap
  let s = await snap();
  const rest = s.search.w;
  ok(s.lines === 2, 'untouched, the search is already on a line of its own');
  ok(rest > 250, 'untouched, it is a real search field (' + rest + 'px)');
  ok(s.search.right <= s.barRight - PILL + 1, 'and it stops before the pill column');

  // 2 ── nothing is hidden to pay for it
  ok(s.view.shown && s.filt.shown, 'the view switch and the filters are still on the row');
  const reachable = () => page.evaluate(() => ['v-list', 'v-tiles', 'v-liked', 'v-hidex'].every((id) => {
    const r = document.getElementById(id).getBoundingClientRect();
    const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!(e && e.closest('#' + id));
  }));
  ok(await reachable(), 'and every one of them really takes a tap there (elementFromPoint)');

  // 3 ── no state: focus, type and clear never move the layout
  await focus(); await page.waitForTimeout(150);
  let f = await snap();
  ok(f.search.w === rest && f.lines === 2, 'focusing changes nothing — there is nothing to expand');
  await page.type('#q', 'prompt'); await page.waitForTimeout(500);
  f = await snap();
  ok(f.search.w === rest && f.lines === 2, 'typing changes nothing');
  ok(await reachable(), 'and every control is still reachable with a query live');
  ok(await page.evaluate(() => !document.querySelector('.feedbar').className.includes('searching')),
     'and the row carries no searching state at all');

  // 4 ── the ✕ is on the LEFT, and the words start clear of it
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
  ok(f.search.w === rest && f.lines === 2, 'and clearing changes nothing either');

  await b.close(); server.close();
  if (!process.exitCode) console.log('\nAll good.');
})().catch((e) => { console.error(e); process.exit(1); });
