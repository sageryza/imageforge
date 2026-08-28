#!/usr/bin/env node
// test-character-page.js — THE CHARACTER CREATOR, AGAINST THE PILL AND HEADER
// HARD RULES (2026-08-27, Sophie's screenshot: "two pills and there's no way
// to search. shud follow pill/header hard rules").
//
//   node scripts/test-character-page.js
//
// Three faults, and every one of them is a MEASUREMENT rather than a look at
// the markup:
//   • the toolbar ran under the injected pill's fixed corner, so "Hide sheet"
//     read "Hide" — a covered button passes `isVisible()` and every width
//     assertion the whole time it is unreachable, so the tap is asked with
//     `elementFromPoint`.
//   • the page had no `.app-header`, so pagehead.js injected a bare strip of
//     its own and the title sat under a "‹ Story Room" line — a second thing
//     above the one title.
//   • there was no search box at all.
// Plus the two overlay rules the lightbox was missing (stop the autoscroll,
// restore the exact scroll position) — the pill's `window.scrollBy` walks the
// page under an open picture, which `overflow:hidden` does not stop.
//
// The page is served EXACTLY the way serveGated serves it: pagehead.js, then
// the injected pill. Skips cleanly without Chromium (CHROME_PATH overrides).
const http = require('http'), fs = require('fs'), path = require('path');
const servePublic = require('./lib/public-asset');
const PUB = path.join(__dirname, '..', 'public');

const CHARS = [
  { id: 'a', name: 'Sophie', tier: 'main', aliases: ['me'], url: 'x.png', quality: 'medium', model: 'gpt-image-2' },
  { id: 'b', name: 'Sage', tier: 'main', aliases: [], url: 'x.png', quality: 'medium', model: 'gpt-image-2' },
  { id: 'c', name: 'Daddy', tier: 'side', aliases: ['Dad'], url: 'x.png', quality: 'low', model: 'gpt-image-2' },
  { id: 'd', name: 'Nancy', tier: 'side', aliases: [], url: 'x.png', quality: 'low', model: 'gpt-image-2' },
];
const NAMED = CHARS.length;   // the four with real names
// Padding, so the open sheet really is longer than the screen — the pill is
// CONDITIONAL and a short page shows none at all, which would green-light the
// collision this test exists to measure.
for (let i = 0; i < 24; i++) {
  CHARS.push({ id: 'p' + i, name: 'Extra' + i, tier: 'side', aliases: [],
    url: 'x.png', quality: 'low', model: 'gpt-image-2' });
}

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const p = new URL(req.url, 'http://x').pathname;
  const send = (t, b) => { res.writeHead(200, { 'Content-Type': t }); res.end(b); };
  if (p === '/' || p === '/character') {
    // what serveGated does, in its order
    let html = fs.readFileSync(path.join(PUB, 'character.html'), 'utf8')
      .replace('__STUDIO_TOKEN__', '');
    html += '<script src="/pagehead.js" defer></script>';
    html += fs.readFileSync(path.join(PUB, 'pill-inject.html'), 'utf8');
    return send('text/html; charset=utf-8', html);
  }
  if (p === '/api/character') return send('application/json', JSON.stringify({ characters: CHARS }));
  if (p.startsWith('/api/')) return send('application/json', JSON.stringify({ ok: true }));
  if (p === '/x.png') {
    // a real 1x1 png, so a <img> lays out rather than sitting at 0 height
    return send('image/png', Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  }
  res.writeHead(404); res.end('');
});

(async () => {
  let pw; try { pw = require('playwright'); }
  catch (_) { try { pw = require('playwright-core'); } catch (_2) { console.log('playwright not installed — skipping'); process.exit(0); } }
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find((f) => { try { fs.accessSync(f); return true; } catch (_) { return false; } });
  const b = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH || preinstalled || undefined, args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 390, height: 800 } });
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + ': ' + m); if (!c) fails++; };

  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.toolbar', { timeout: 8000 });
  await page.waitForTimeout(500);
  // asked up front, so a page with no box still reports every OTHER rule
  const hasQ = !!(await page.$('#q'));
  ok(hasQ, 'the page has a search box');

  // ── ONE PILL ────────────────────────────────────────────────────────────
  const pills = await page.$$eval('.float', (n) => n.length);
  ok(pills === 1, 'exactly one pill in the page (' + pills + ')');
  ok(await page.$$eval('.vseg', (n) => n.length) === 1, 'one speed capsule, not a second hand-rolled one');

  // ── THE HEADER ──────────────────────────────────────────────────────────
  ok(await page.$$eval('h1', (n) => n.length) === 1, 'the title appears exactly once');
  ok(!!(await page.$('header.app-header h1')), 'the title lives in a real .app-header row (what pagehead.js looks for)');
  const above = await page.evaluate(() => {
    const h = document.querySelector('h1'), hy = h.getBoundingClientRect().top;
    // anything with ink of its own painted above the title
    return [...document.querySelectorAll('main > *, header.app-header > *')]
      .filter((e) => e !== h && !e.contains(h) && e.getBoundingClientRect().height
        && e.getBoundingClientRect().bottom <= hy + 1)
      .map((e) => e.tagName + '.' + e.className);
  });
  ok(above.length === 0, 'nothing sits above the title' + (above.length ? ' — found ' + above.join(', ') : ''));

  // ── THE PILL'S COLUMN ───────────────────────────────────────────────────
  // The rows must END before it. Asked with elementFromPoint, because a
  // covered button is "visible" by every other measure. The sheet is opened
  // first: the pill only exists once there is something to scroll.
  await page.click('#toggleSheet');
  await page.waitForSelector('.cell', { timeout: 8000 });
  await page.waitForTimeout(500);
  ok(await page.$eval('.float', (e) => !!e.getClientRects().length), 'the pill is on screen once the sheet is open');
  const gap = await page.evaluate(() => {
    const f = document.querySelector('.float');
    const pill = f ? f.getBoundingClientRect() : { left: 1, top: 0, bottom: 0 };
    const out = {};
    ['sub', 'toolbar', 'searchrow'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) { out[id] = { right: 1, pillLeft: 0, overlapsY: false, absent: true }; return; }  // absent = fail
      const r = el.getBoundingClientRect();
      out[id] = { right: Math.round(r.right), pillLeft: Math.round(pill.left),
        overlapsY: r.bottom > pill.top && r.top < pill.bottom };
    });
    const t = document.getElementById('toggleSheet').getBoundingClientRect();
    const el = document.elementFromPoint((t.left + t.right) / 2, (t.top + t.bottom) / 2);
    out.hit = el ? (el.id || el.className || el.tagName) : 'nothing';
    return out;
  });
  ok(gap.toolbar.right <= gap.toolbar.pillLeft,
    'the toolbar row ends before the pill (' + gap.toolbar.right + ' ≤ ' + gap.toolbar.pillLeft + ')');
  ok(gap.searchrow.right <= gap.searchrow.pillLeft,
    'the search row ends before the pill (' + gap.searchrow.right + ' ≤ ' + gap.searchrow.pillLeft + ')');
  ok(gap.sub.right <= gap.sub.pillLeft,
    'the strapline wraps before the pill (' + gap.sub.right + ' ≤ ' + gap.sub.pillLeft + ')');
  ok(gap.hit === 'toggleSheet', 'a tap on "Show sheet" reaches it, not the pill (got ' + gap.hit + ')');

  // ── SEARCH ──────────────────────────────────────────────────────────────
  await page.click('#toggleSheet');
  await page.waitForTimeout(200);
  ok(await page.$eval('#sheetView', (e) => e.classList.contains('hidden')), 'the sheet closes again');
  if (hasQ) {
  await page.fill('#q', 'sage');
  await page.waitForTimeout(400);
  ok(!(await page.$eval('#sheetView', (e) => e.classList.contains('hidden'))),
    'typing opens the sheet — the box is the way in, not just a filter');
  let names = await page.$$eval('.cell .nm', (n) => n.map((x) => x.textContent));
  ok(names.length === 1 && names[0] === 'SAGE', 'it filters to the match (' + names.join(',') + ')');

  await page.fill('#q', 'dad');
  await page.waitForTimeout(400);
  names = await page.$$eval('.cell .nm', (n) => n.map((x) => x.textContent));
  ok(names.length === 1 && names[0] === 'DADDY', 'an ALIAS finds its character (' + names.join(',') + ')');

  // the house grammar, not a substring match: two bare words AND inside one
  // character, and -word excludes.
  await page.fill('#q', '-sage -daddy -extra');
  await page.waitForTimeout(400);
  names = await page.$$eval('.cell .nm', (n) => n.map((x) => x.textContent));
  ok(names.length === 2 && names.includes('SOPHIE') && names.includes('NANCY'),
    'the house grammar is live — -word excludes (' + names.join(',') + ')');

  await page.fill('#q', 'sophie me');
  await page.waitForTimeout(400);
  names = await page.$$eval('.cell .nm', (n) => n.map((x) => x.textContent));
  ok(names.length === 1 && names[0] === 'SOPHIE',
    'bare words are AND\'d WITHIN one character — her name and her alias (' + names.join(',') + ')');

  await page.fill('#q', 'zzzz');
  await page.waitForTimeout(400);
  ok((await page.$$eval('.cell', (n) => n.length)) === 0, 'no match shows no cells');

  await page.fill('#q', '');
  await page.waitForTimeout(400);
  ok((await page.$$eval('.cell', (n) => n.length)) === CHARS.length, 'clearing the box brings everyone back');

  // Return runs it and drops the keyboard (a lone <input type=search> outside
  // a <form> has nothing to submit to, so this is the whole of it).
  await page.focus('#q');
  await page.keyboard.type('nancy');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const afterEnter = await page.evaluate(() => ({
    focused: document.activeElement && document.activeElement.id,
    names: [...document.querySelectorAll('.cell .nm')].map((x) => x.textContent),
  }));
  ok(afterEnter.names.length === 1 && afterEnter.names[0] === 'NANCY', 'Return runs the search');
  ok(afterEnter.focused !== 'q', 'Return drops the keyboard');
  await page.fill('#q', '');
  await page.waitForTimeout(400);
  }

  // ── THE LIGHTBOX FREEZES THE PAGE BEHIND IT ─────────────────────────────
  if (await page.$eval('#sheetView', (e) => e.classList.contains('hidden'))) {
    await page.click('#toggleSheet');
    await page.waitForSelector('.cell', { timeout: 8000 });
  }
  // the lightbox is THE SHARED ONE (/asset-lightbox.js) since 2026-08-28 —
  // #clightbox, shown with style.display, closed by a dead-space tap
  const lb = await page.evaluate(async () => {
    let stopped = 0;
    const real = window.__scrollStop;
    window.__scrollStop = function () { stopped++; if (real) real(); };
    document.body.style.minHeight = '4000px';           // something to scroll
    window.scrollTo(0, 600);
    await new Promise((r) => setTimeout(r, 60));
    const before = window.scrollY;
    document.querySelector('.cell img').click();
    const box = document.getElementById('clightbox');
    const open = !!box && box.style.display === 'flex';
    const locked = document.body.style.overflow === 'hidden';
    const radius = getComputedStyle(box.querySelector('img')).borderTopLeftRadius;
    window.scrollBy(0, 400);                             // as the pill would
    // close on the backdrop — the shared skip list keeps the picture itself open
    box.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 120));
    return { stopped, before, open, locked, radius, after: window.scrollY,
      unlocked: document.body.style.overflow === '' };
  });
  ok(lb.open, 'tapping a character opens the lightbox');
  ok(lb.stopped === 1, 'opening it stops the autoscroll (' + lb.stopped + ')');
  ok(lb.locked && lb.unlocked, 'the background is locked while it is open and released after');
  ok(lb.after === lb.before, 'closing puts her back exactly where she was ('
    + lb.after + ' vs ' + lb.before + ')');
  ok(lb.radius === '0px', 'the picture itself has no rounded corner (' + lb.radius + ')');

  // ── NO PRE-WRITTEN TEXT ─────────────────────────────────────────────────
  // A placeholder may NAME a field; it may never instruct or give an example.
  const holders = await page.$$eval('input[placeholder], textarea[placeholder]',
    (n) => n.map((x) => x.placeholder));
  const bossy = holders.filter((h) => /separated|e\.g\.|for example|describe|tell us/i.test(h));
  ok(!bossy.length, 'no placeholder instructs or gives an example' + (bossy.length ? ' — ' + bossy.join(' | ') : ''));

  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
