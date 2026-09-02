#!/usr/bin/env node
// PICK SEVERAL AT ONCE (2026-09-02, Sophie: "add a select button to playground
// so i can x a bunch of things at once").
//
// Drives the REAL public/promptlab.html in headless Chromium against a stub
// API. Every assertion here is a MEASUREMENT or a reading of what the server
// really received, because none of this is visible to a source assertion: a
// `.picked` class whose CSS never landed, a tap that picked AND opened the
// lightbox, and a batch that posted the wrong indices all look fine in markup.
//
//   1. off, a tap still opens the lightbox — the mode changed nothing,
//   2. lit, a tap PICKS and the lightbox stays shut,
//   3. the mark buttons post ONE batch carrying exactly what she picked,
//   4. tapping the same mark again CLEARS it (the single-picture rule scaled
//      up — this is what makes a bulk ✕ undoable),
//   5. All reads the view she is looking at, so the ♥ filter narrows it,
//   6. a re-render mid-pick keeps her picks,
//   7. Done leaves the mode and gives the lightbox back,
//   8. THE ROW STILL FITS ONE LINE at 390pt on BOTH tabs, placeholder and all
//      — the PANELS tab carries a fourth chip and is the tight one.
//
//   npm install playwright --no-save && node scripts/test-playground-select.js
const http = require('http');
const servePublic = require('./lib/public-asset');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('SKIP: playwright not installed (npm install playwright --no-save)'); process.exit(0); }

const PUB = path.join(__dirname, '..', 'public');
const T0 = 1787000000000;

// run0's first picture is hearted; everything else is untouched.
const RUNS = [0, 1, 2].map((i) => ({
  id: 'run' + i,
  prompt: 'prompt number ' + i,
  status: 'done',
  engine: 'gptimage',
  model: 'gpt-image-2',
  quality: 'medium',
  aspectRatio: '2:3',
  images: ['/px.png?r=run' + i + '&i=0', '/px.png?r=run' + i + '&i=1'],
  votes: i === 0 ? { 0: 'like' } : {},
  createdAt: T0 - i * 60000,
}));
const ALL_SIX = ['run0#0', 'run0#1', 'run1#0', 'run1#1', 'run2#0', 'run2#1'];

const posts = [];
const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/promptlab/votes' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    return req.on('end', () => {
      const j = JSON.parse(body || '{}');
      posts.push(j);
      // The stub KEEPS the marks, like the real route — the page reloads the
      // feed right after the post, so a stub that forgot them would wipe the
      // optimistic paint and hide exactly what this is measuring.
      (j.items || []).forEach((it) => {
        const r = RUNS.find((x) => x.id === it.run);
        if (!r) return;
        if (j.vote) r.votes[it.image] = j.vote; else delete r.votes[it.image];
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  }
  if (url.pathname === '/api/promptlab') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ runs: RUNS, more: false }));
  }
  if (url.pathname === '/px.png') {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64');
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(png);
  }
  if (url.pathname === '/' || url.pathname === '/playground') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8'));
  }
  res.writeHead(404).end();
});

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };
const ok = (c, m) => { if (c) console.log('  ok  ' + m); else fail(m); };
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .concat(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [])
    .find(p => fs.existsSync(p));
  const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });   // iPhone 13
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#runs .cell img').length > 0);

  const cell = (key) => page.locator(`#runs .cell img[data-run="${key.split('#')[0]}"][data-i="${key.split('#')[1]}"]`);
  const lbOpen = () => page.evaluate(() => {
    const el = document.getElementById('clightbox');
    return !!el && el.style.display !== 'none';
  });
  // A ring is an inset box-shadow and a tick is a real node — read both off
  // the rendered cell, never off a class name whose CSS may never have landed.
  const picked = () => page.evaluate(() => Array.prototype.filter.call(
    document.querySelectorAll('#runs .cell, #tiles .cell'), (c) => {
      const im = c.querySelector('img[data-run]');
      if (!im) return false;
      // The ring is a layer OVER the cell — read it off the pseudo-element,
      // because an inset shadow on the <img> itself paints under the picture
      // and renders as nothing at all (found by photographing the real page).
      const ring = getComputedStyle(c, '::after').boxShadow;
      return c.classList.contains('picked') && !!c.querySelector('.pick svg') && ring && ring !== 'none';
    }).map((c) => {
      const im = c.querySelector('img[data-run]');
      return im.getAttribute('data-run') + '#' + im.getAttribute('data-i');
    }));
  const badges = () => page.evaluate(() => Array.prototype.map.call(
    document.querySelectorAll('#runs .cell .badge'), (b) => {
      const im = b.parentElement.querySelector('img[data-run]');
      return im.getAttribute('data-run') + '#' + im.getAttribute('data-i') +
        ':' + (b.classList.contains('like') ? 'like' : 'dislike');
    }));
  const count = () => page.locator('#selcount').textContent();

  console.log('OFF — nothing moved');
  ok(!(await lbOpen()), 'the lightbox starts shut');
  await cell('run1#0').click();
  ok(await lbOpen(), 'a tap on a picture still opens it');
  await page.evaluate(() => window.__navBack());
  ok(!(await lbOpen()), 'and closes again');
  ok(await page.locator('#selbar').isHidden(), 'the mode bar is not on the page');

  console.log('PICKING');
  await page.click('#v-select');
  ok(await page.locator('#v-select').evaluate(e => e.classList.contains('on')), 'the chip lights');
  ok(await page.locator('#selbar').isVisible(), 'the mode bar is under the row');
  ok(await page.locator('#sel-x').evaluate(e => e.disabled), 'with nothing picked the ✕ is dead');
  await cell('run1#0').click();
  ok(!(await lbOpen()), 'a tap does NOT open the picture any more');
  await cell('run2#1').click();
  ok(same(await picked(), ['run1#0', 'run2#1']), 'the two she tapped wear the ring and the tick');
  ok((await count()).indexOf('2') === 0, `the bar says how many ("${await count()}")`);
  await cell('run1#0').click();
  ok(same(await picked(), ['run2#1']), 'tapping a picked one puts it back');
  await cell('run1#0').click();

  console.log('IT SURVIVES A REPAINT');
  // The heart filter drops both picked cells out of the DOM and puts them
  // back — the hardest repaint there is, since the nodes are rebuilt from
  // scratch rather than updated in place.
  await page.click('#v-liked'); await page.waitForTimeout(100);
  await page.click('#v-liked'); await page.waitForTimeout(100);
  ok(same(await picked(), ['run1#0', 'run2#1']), 'a repaint that rebuilds the cells keeps her picks');

  console.log('THE MARK');
  posts.length = 0;
  await page.click('#sel-x');
  await page.waitForTimeout(250);
  ok(posts.length === 1, `ONE request for the batch (${posts.length})`);
  ok(posts[0] && posts[0].vote === 'dislike', 'it carries the ✕');
  const sent = (posts[0].items || []).map(i => i.run + '#' + i.image).sort();
  ok(same(sent, ['run1#0', 'run2#1']), `and exactly what she picked (${sent.join(', ')})`);
  const b1 = await badges();
  ok(b1.indexOf('run1#0:dislike') >= 0 && b1.indexOf('run2#1:dislike') >= 0,
    'the pictures wear the ✕ straight away');
  ok(same(await picked(), ['run1#0', 'run2#1']), 'and stay picked, so the undo is one tap');

  console.log('TAP AGAIN TO UNDO');
  posts.length = 0;
  await page.click('#sel-x');
  await page.waitForTimeout(250);
  ok(posts.length === 1 && posts[0].vote === '', 'the same button clears them');
  const b2 = await badges();
  ok(b2.indexOf('run1#0:dislike') < 0 && b2.indexOf('run2#1:dislike') < 0, 'the marks are off the pictures');
  ok(b2.indexOf('run0#0:like') >= 0, 'and the heart she gave earlier is untouched');

  console.log('ALL READS THE VIEW SHE IS LOOKING AT');
  await page.click('#sel-all');
  ok(same((await picked()).sort(), ALL_SIX), 'All picks every picture on the page');
  ok(await page.locator('#sel-all').textContent() === 'None', 'and the word becomes None');
  await page.click('#sel-all');
  ok((await picked()).length === 0, 'None puts them all back');
  await page.click('#v-liked');                      // hearts only
  await page.waitForTimeout(100);
  await page.click('#sel-all');
  ok(same(await picked(), ['run0#0']), 'with the heart lit All picks only what is on screen');
  await page.click('#v-liked');
  await page.waitForTimeout(100);

  console.log('DONE');
  await page.click('#sel-done');
  ok(await page.locator('#selbar').isHidden(), 'the bar goes');
  ok((await picked()).length === 0, 'the picks go with it');
  await cell('run1#0').click();
  ok(await lbOpen(), 'and a tap opens the picture again');
  await page.evaluate(() => window.__navBack());

  console.log('THE ROW, AT 390pt, ON BOTH TABS');
  for (const tab of ['single', 'panels']) {
    if (tab === 'panels') {
      await page.click('#t-panels');
      await page.waitForTimeout(200);
    }
    const m = await page.evaluate(() => {
      const el = document.getElementById('q');
      const cs = getComputedStyle(el);
      const c = document.createElement('canvas').getContext('2d');
      c.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      return {
        need: c.measureText(el.placeholder).width,
        have: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
        chips: Array.prototype.map.call(document.querySelectorAll('.filttog .likefilt'),
          (b) => b.hidden ? null : b.getBoundingClientRect().top).filter((t) => t !== null),
        tops: [r('.viewtog').top, r('.filttog').top, r('.feedsearch').top],
        barH: r('.feedbar').height,
        selW: r('#v-select').width,
        heartW: r('#v-liked').width,
      };
    });
    ok(m.have >= m.need,
      `${tab}: "Search" still fits (needs ${Math.round(m.need)}px, has ${Math.round(m.have)}px)`);
    ok(m.tops.every(t => Math.abs(t - m.tops[0]) < 1), `${tab}: the three groups share one line`);
    ok(m.chips.every(t => Math.abs(t - m.chips[0]) < 1), `${tab}: every chip shares the filter box`);
    ok(m.barH < 60, `${tab}: the row is still one line tall (${Math.round(m.barH)}px)`);
    ok(Math.abs(m.selW - m.heartW) < 1,
      `${tab}: the select chip is the same box as the heart (${Math.round(m.selW)}px)`);
  }
  // Lit, it is INK — not the heart's rose and not the ✕'s grey. It is a mode,
  // not a mark, and three colours in one box would read as three of a kind.
  const lit = await page.evaluate(() => {
    const g = (id, on) => {
      const e = document.getElementById(id);
      e.classList.add('on');
      const c = getComputedStyle(e).backgroundColor;
      if (!on) e.classList.remove('on');
      return c;
    };
    return [g('v-liked', false), g('v-hidex', false), g('v-select', false)];
  });
  ok(lit[2] !== lit[0] && lit[2] !== lit[1],
    `lit, select is told apart from both marks (${lit.join(' vs ')})`);

  await browser.close();
  server.close();
  console.log(process.exitCode ? '\nFAILED' : '\nAll good.');
})();
