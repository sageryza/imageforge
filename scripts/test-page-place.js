#!/usr/bin/env node
/* HER PLACE ON A LONG PAGE (2026-09-02, Sophie: "long scroll pages like the
 * inventory triset a chat just made need to have place saving mechanisms —
 * 1 save scroll position 2 chapter titles quick click to").
 *
 * compare.js's __pagePlace, driven through the REAL grid template (the
 * inventory's shape: many labeled groups of pictures), a REAL hand-built
 * page (h2 chapters), a page that starts on the deck, and a short page.
 * Every assertion is a MEASUREMENT — a bar that is present and sticks
 * nowhere, a restore that lands a screen off, and a save that files y=0 over
 * her place all pass any markup assertion ever written.
 *
 *   node scripts/test-page-place.js
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }
const { validateTemplate, renderTemplatePage } = require('../page-templates');
const servePublic = require('./lib/public-asset');

const IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450'%3E%3Crect width='300' height='450' fill='%23c9a'/%3E%3C/svg%3E";
const N = 14;
function gridHtml(start) {
  const groups = [];
  for (let g = 1; g <= N; g += 1) {
    groups.push({ label: 'Chapter ' + g + ' — the ' + ['first', 'second', 'third'][g % 3] + ' kind', items: [1, 2, 3].map((k) => ({
      id: 'g' + g + '-' + k, label: 'card ' + g + '.' + k, img: IMG, full: IMG,
    })) });
  }
  const v = validateTemplate('grid', { groups, start });
  if (!v.ok) throw new Error(v.error);
  return renderTemplatePage({ title: 'Place', template: 'grid', data: v.data, chat: 'test', sheet: 'page-place' });
}
function handHtml(sections, tall) {
  let body = '';
  for (let i = 1; i <= sections; i += 1) {
    body += '<h2>Part ' + i + '</h2>' + (tall ? '<div style="height:700px;background:#eee"></div>' : '<p>short</p>');
  }
  return '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<link rel="stylesheet" href="/compare.css"><div class="wrap"><h1>Hand</h1>' + body + '</div>'
    + '<script src="/compare.js"></script>';
}

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + m); if (!c) fails++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/chatfeed/verdict') return json({ ok: true, items: {}, texts: {} });
  if (url.pathname.startsWith('/api/gallery')) return json({ ok: true, assets: [], notes: [] });
  const html = (h) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(h); };
  if (url.pathname === '/grid') return html(gridHtml('compare'));
  if (url.pathname === '/deckfirst') return html(gridHtml('swipe'));
  if (url.pathname === '/hand') return html(handHtml(5, true));
  if (url.pathname === '/short') return html(handHtml(2, false));
  res.writeHead(404); res.end('nope');
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const exe = (() => {
    if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
    for (const k of (() => { try { return fs.readdirSync('/opt/pw-browsers'); } catch { return []; } })()
      .filter((n) => /^chromium-\d/.test(n))) {
      const p = path.join('/opt/pw-browsers', k, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
    return null;
  })();
  const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => ok(false, 'page error: ' + e.message));
  await page.addInitScript(() => { try { localStorage.setItem('cmp-tour-grid', '1'); localStorage.setItem('cmp-tour-deck', '1'); } catch (_) {} });

  const barState = () => page.evaluate(() => {
    const bar = document.querySelector('.pp');
    if (!bar) return null;
    const r = bar.getBoundingClientRect();
    const cur = bar.querySelector('.pp-cur').getBoundingClientRect();
    return { hidden: bar.hidden, top: r.top, h: r.height, curRight: cur.right,
      n: bar.querySelector('.pp-n').textContent, t: bar.querySelector('.pp-t').textContent,
      listOpen: !bar.querySelector('.pp-list').hidden, y: window.scrollY };
  });
  const groupTop = (i) => page.evaluate((i) => document.querySelectorAll('.gd-group')[i].getBoundingClientRect().top + window.scrollY, i);

  // ── 1. the grid template: the bar, sticky, naming the chapter she is in ──
  await page.goto(base + '/grid');
  await page.waitForSelector('.pp');
  await page.waitForTimeout(300);
  let s = await barState();
  ok(s && !s.hidden, 'grid: a long page draws the chapter bar');
  ok(s && s.n === '1/' + N && /Chapter 1/.test(s.t), 'grid: it opens naming chapter 1 of ' + N + ' (' + (s && s.n) + ' ' + (s && s.t) + ')');
  ok(s && s.curRight <= 390 - 64 + 1, 'grid: the button ends before the pill\'s column (right edge ' + (s && s.curRight) + ')');
  const t8 = await groupTop(7);
  await page.evaluate((y) => window.scrollTo(0, y), t8 + 40);
  await page.waitForTimeout(250);
  s = await barState();
  ok(s && near(s.top, 0, 1), 'grid: the bar sticks at the top once scrolled (top ' + (s && s.top) + ')');
  ok(s && s.n === '8/' + N, 'grid: 40px into chapter 8 the bar says 8/' + N + ' (' + (s && s.n) + ')');

  // ── 2. tap the bar → the list; tap a title → the jump ──
  const hit = await page.evaluate(() => {
    const b = document.querySelector('.pp-cur').getBoundingClientRect();
    const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return el && el.closest('.pp-cur') ? 'cur' : (el && el.className) || 'nothing';
  });
  ok(hit === 'cur', 'grid: the bar takes its own tap (elementFromPoint → ' + hit + ')');
  await page.click('.pp-cur');
  await page.waitForTimeout(100);
  s = await barState();
  ok(s && s.listOpen, 'grid: tapping the bar opens the list');
  const litIn = await page.evaluate(() => {
    const on = document.querySelector('.pp-it.on'); const list = document.querySelector('.pp-list');
    const a = on.getBoundingClientRect(); const b = list.getBoundingClientRect();
    return { on: on.textContent, inView: a.top >= b.top - 1 && a.bottom <= b.bottom + 1, count: document.querySelectorAll('.pp-it').length, y: window.scrollY };
  });
  ok(/^8/.test(litIn.on) && litIn.inView && litIn.count === N, 'grid: the list lights chapter 8, scrolled into view, all ' + N + ' listed (' + JSON.stringify(litIn) + ')');
  ok(near(litIn.y, t8 + 40, 1), 'grid: opening the list moves the page 0px (y ' + litIn.y + ')');
  const reach = await page.evaluate(() => {
    const it = document.querySelectorAll('.pp-it')[11].getBoundingClientRect();
    const el = document.elementFromPoint(it.left + 20, it.top + it.height / 2);
    return el && el.closest('.pp-it') ? el.closest('.pp-it').getAttribute('data-i') : 'blocked';
  });
  ok(reach === '11', 'grid: a listed title is reachable at its own centre (' + reach + ')');
  await page.click('.pp-it[data-i="11"]');
  await page.waitForTimeout(250);
  s = await barState();
  const t12 = await groupTop(11);
  ok(s && near(s.y, t12 - s.h - 4, 2) && s.n === '12/' + N, 'grid: tapping chapter 12 lands its heading under the bar (y ' + (s && s.y) + ' vs ' + Math.round(t12 - (s ? s.h : 0) - 4) + ', bar ' + (s && s.n) + ')');
  ok(s && !s.listOpen, 'grid: the list closes on the jump');

  // ── 3. the memory: a fresh open lands on the same chapter ──
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pageplace:/grid') || 'null'));
  ok(saved && saved.i === 11 && saved.y > 0, 'grid: the place is filed under the page\'s path, anchored to chapter 12 (' + JSON.stringify(saved && { i: saved.i, off: saved.off }) + ')');
  const yBefore = s.y;
  await page.reload();
  await page.waitForSelector('.pp');
  await page.waitForTimeout(400);
  s = await barState();
  ok(s && near(s.y, yBefore, 3) && s.n === '12/' + N, 'grid: reopened, she is back on chapter 12 (y ' + (s && s.y) + ' vs ' + yBefore + ')');

  // her own scroll after the restore is never yanked back by the re-asserts
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(500);
  const yHers = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(2200);
  const yLater = await page.evaluate(() => window.scrollY);
  ok(yHers > yBefore + 200 && near(yLater, yHers, 2), 'grid: her own scroll stands — the late re-asserts do not pull her back (' + yHers + ' → ' + yLater + ')');
  // …and it is what the next open restores — measured AGAINST HER CHAPTER,
  // because a fresh load has not laid out the lazy pictures above her place
  // (a page scrolled past them has), so the absolute pixel count is not the
  // same page twice; the heading she was under, at the same distance, is
  await page.waitForTimeout(200);
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('pageplace:/grid')));
  const relBefore = (await groupTop(rec.i)) - yHers;
  await page.reload();
  await page.waitForSelector('.pp');
  await page.waitForTimeout(400);
  const yAgain = await page.evaluate(() => window.scrollY);
  const relAfter = (await groupTop(rec.i)) - yAgain;
  ok(near(relAfter, relBefore, 2), 'grid: the next open restores where SHE left it — chapter ' + (rec.i + 1) + ' at the same distance (' + Math.round(relAfter) + ' vs ' + Math.round(relBefore) + ')');

  // ── 4. the view switch: the deck never overwrites her place, Compare restores it ──
  await page.evaluate(() => localStorage.setItem('pageplace:/deckfirst', JSON.stringify({ y: 2400, i: 5, off: 30, label: 'Chapter 6 — the first kind', t: Date.now() })));
  await page.goto(base + '/deckfirst');
  await page.waitForSelector('.pv button');
  await page.waitForTimeout(300);
  const noBar = await page.evaluate(() => !document.querySelector('.pp') || document.querySelector('.pp').getClientRects().length === 0);
  ok(noBar, 'deck first: the swipe view shows no chapter bar');
  await page.click('.pv button:nth-child(2)');
  await page.waitForTimeout(400);
  s = await barState();
  const t6 = await groupTop(5);
  ok(s && !s.hidden && near(s.y, t6 + 30, 3) && s.n === '6/' + N, 'deck first → Compare: lands on chapter 6 + 30px, not the top (y ' + (s && s.y) + ' vs ' + Math.round(t6 + 30) + ')');
  await page.click('.pv button:nth-child(1)');
  await page.waitForTimeout(300);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(100);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('pageplace:/deckfirst') || 'null'));
  ok(kept && kept.i === 5, 'back on Swipe: leaving the tab does not file y=0 over her place (i=' + (kept && kept.i) + ')');
  await page.click('.pv button:nth-child(2)');
  await page.waitForTimeout(400);
  s = await barState();
  ok(s && near(s.y, t6 + 30, 3), 'Swipe → Compare again: back on chapter 6 (y ' + (s && s.y) + ')');

  // ── 5. a hand-built page gets it from its h2s; a short page gets no bar ──
  await page.goto(base + '/hand');
  await page.waitForSelector('.pp');
  await page.waitForTimeout(300);
  const hand = await page.evaluate(() => ({ hidden: document.querySelector('.pp').hidden, n: document.querySelectorAll('.pp-it').length,
    before: document.querySelector('.pp').nextElementSibling.tagName }));
  ok(!hand.hidden && hand.n === 5 && hand.before === 'H2', 'hand-built: five h2s → a bar of five, seated before the first h2');
  await page.click('.pp-cur'); await page.click('.pp-it[data-i="3"]');
  await page.waitForTimeout(200);
  const handY = await page.evaluate(() => ({ y: window.scrollY, t: document.querySelectorAll('h2')[3].getBoundingClientRect().top, h: document.querySelector('.pp').offsetHeight }));
  ok(near(handY.t, handY.h + 4, 2), 'hand-built: tapping Part 4 puts its heading under the bar (top ' + handY.t + ')');
  await page.goto(base + '/short');
  await page.waitForTimeout(300);
  const short = await page.evaluate(() => { const b = document.querySelector('.pp'); return b ? b.hidden : 'none'; });
  ok(short === true || short === 'none', 'short page: two h2s on one screen draw no bar (' + short + ')');

  // ── 6. source pins ──
  const gridSrc = fs.readFileSync(path.join(__dirname, '../public/grid.js'), 'utf8');
  const pvSrc = fs.readFileSync(path.join(__dirname, '../public/page-views.js'), 'utf8');
  ok(/window\.__pagePlace\(/.test(gridSrc) && /place: place/.test(gridSrc), 'source: grid.js mounts __pagePlace and hands it back');
  ok(/started\.compare\.place\.restore\(\)/.test(pvSrc), 'source: page-views restores her place when Compare shows');

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
