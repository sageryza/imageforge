#!/usr/bin/env node
/* THE PLACE BAR'S AUTO-MOUNT, ON THE PAGES THAT TRIPPED IT (2026-09-08, the
 * "Her scenes — the belt" page — a hand-built Compare page that links
 * compare.js in its <head> and lays its eight <h2>s out in a HORIZONTAL card
 * deck). Three things it got wrong there, each a measurement:
 *
 *   1. compare.js in the <head>: the auto-mount timer ran before
 *      document.body existed, threw on `.classList`, and the bar mounted in
 *      Safari and not in Chromium depending on timing. It waits for the body.
 *   2. The chapter label read the <h2>'s textContent, so a block-level
 *      status span glued on: "…the judgeready". It reads innerText, collapsed.
 *   3. Chapters that do not stack (side by side in a deck) got a bar saying
 *      "1/8" forever and a jump list that scrolled nowhere. They get no bar
 *      and no scroll memory; the page keeps its own place.
 *
 *   node scripts/test-page-place-deck.js
 */
'use strict';
const http = require('http');
let pw;
try { pw = require('playwright'); }
catch { try { pw = require('playwright-core'); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }
const servePublic = require('./lib/public-asset');

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + m); if (!c) fails++; };

// compare.js in the HEAD, the way the belt page loads it
const HEAD = '<meta charset="utf-8"><link rel="stylesheet" href="/compare.css"><script src="/compare.js"></script>';
function vertical() {
  let body = '<h1>Tall</h1>';
  for (let i = 1; i <= 5; i += 1) {
    body += '<h2>' + i + ' · Climax ' + i + ' — the judge<span class="st" style="display:block">ready</span></h2>'
      + '<div style="height:900px"></div>';
  }
  return HEAD + body;
}
function deck() {
  let cards = '';
  for (let i = 1; i <= 8; i += 1) {
    cards += '<section class="card"><h2>' + i + ' · Scene ' + i + '<span class="st" style="display:block">ready</span></h2>'
      + '<div style="height:1400px"></div></section>';
  }
  return HEAD + '<style>.deck{display:flex;overflow-x:auto}.card{flex:0 0 100%;min-width:0}</style>'
    + '<h1>Deck</h1><div class="deck">' + cards + '</div>';
}

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  const html = (h) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(h); };
  if (url.pathname === '/vertical') return html(vertical());
  if (url.pathname === '/deck') return html(deck());
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true,"items":{},"texts":{}}');
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try { browser = await pw.chromium.launch(); }
  catch (e) { browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });

  // 1 + 2 — a vertical page with the script in the head
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base + '/vertical');
  await p.waitForTimeout(700);
  ok(errs.length === 0, 'compare.js in the <head>: no page error (' + (errs[0] || 'none') + ')');
  const bar = await p.evaluate(() => {
    const pp = document.querySelector('.pp');
    if (!pp) return null;
    return { hidden: pp.hidden, first: pp.querySelector('.pp-it .t').textContent };
  });
  ok(bar && !bar.hidden, 'the bar mounted on a tall vertical page');
  ok(bar && bar.first.toLowerCase() === '1 · climax 1 — the judge ready', 'a block-level status span reads with a space (compare.css uppercases it): ' + JSON.stringify(bar && bar.first));
  await p.close();

  // 3 — the belt shape: chapters side by side in a horizontal deck
  const d = await ctx.newPage();
  const derrs = [];
  d.on('pageerror', (e) => derrs.push(e.message));
  await d.goto(base + '/deck');
  await d.waitForTimeout(700);
  ok(derrs.length === 0, 'deck page: no page error');
  ok(await d.evaluate(() => !document.querySelector('.pp')), 'no bar on a horizontal deck of chapters');
  await d.evaluate(() => scrollTo(0, 600)); await d.waitForTimeout(300);
  await d.evaluate(() => scrollTo(0, 650)); await d.waitForTimeout(1500);
  const keys = await d.evaluate(() => Object.keys(localStorage).filter((k) => k === 'pageplace:/deck'));
  ok(keys.length === 0, 'no scroll memory is written for a deck page (' + keys.join(',') + ')');
  // an explicit call still mounts, so a page that wants it can ask
  ok(await d.evaluate(() => { window.__pagePlace({ chapters: 'h2' }); return !!document.querySelector('.pp'); }), 'an explicit __pagePlace call still mounts');
  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
