#!/usr/bin/env node
/* THE PLACE BAR MUST NOT WIDEN THE FLEX ITEM IT SITS IN (2026-09-08,
 * Sophie's screenshot of "Her scenes — the belt v2": every line of card 1
 * ran off the right of her phone, and only card 1).
 *
 * compare.js inserts its chapter bar before the first <h2>. On a page whose
 * <h2>s sit inside the cards of a horizontal flex deck, that puts the bar
 * inside a FLEX ITEM — whose min-width is auto (its min-content), and WebKit
 * counted the bar's nowrap chapter title as that min-content: card 1 came out
 * 494px wide in a 362px deck. Chromium clamps and never showed it, which is
 * why the harness (Chromium only) had been green.
 *
 * So this test runs the SAME page in WebKit when playwright's WebKit is
 * launchable (it was measured failing there pre-fix: card 494 / textarea
 * 464), and in Chromium otherwise; either way it also pins the CSS that
 * makes the bar's intrinsic width zero, since the Chromium measurement
 * alone passes against the pre-fix file.
 *
 *   node scripts/test-page-place-flex.js
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
let pw;
try { pw = require('playwright'); }
catch { try { pw = require('playwright-core'); }
  catch { console.log('SKIP: playwright not installed'); process.exit(0); } }
const servePublic = require('./lib/public-asset');

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + m); if (!c) fails++; };

// the belt page's shape: a horizontal deck of flex cards, each an <h2> over a
// full-width textarea, with the bar landing inside card 1 by compare.js's
// own auto-mount (loaded the way that page loads it — in the head)
const LONG = 'Climax 3 — Tomorrow? → the judge, the grin, the ghost on the ceiling';
function cardHtml(i) {
  return '<section class="card"><h2>' + i + ' · ' + LONG + '<span class="st">ready</span></h2>'
    + '<textarea class="p">' + 'words '.repeat(400) + '</textarea>'
    + '<div style="height:900px"></div></section>';
}
const PAGE = '<meta charset="utf-8"><link rel="stylesheet" href="/compare.css"><script src="/compare.js"></script>'
  + '<style>.deck{display:flex;overflow-x:auto;scroll-snap-type:x mandatory}'
  + '.card{flex:0 0 100%;box-sizing:border-box;padding:6px 14px 60px}'
  + 'textarea.p{width:100%;box-sizing:border-box;min-height:100px}.st{display:block}</style>'
  + '<h1>Deck</h1><div class="deck" id="deck">' + [1, 2, 3, 4].map(cardHtml).join('') + '</div>';

const server = http.createServer((req, res) => {
  if (servePublic(req, res)) return;
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/deck') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true,"items":{},"texts":{}}');
});

(async () => {
  // 1 — the source pin: the rule that zeroes the bar's intrinsic width
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'compare.js'), 'utf8');
  const m = src.match(/'\.pp\{position:sticky;[^']*'\s*\+\s*'([^']*)'/);
  const rule = m ? m[1] : '';
  ok(/contain:inline-size/.test(rule), 'compare.js: .pp is contain:inline-size');
  ok(/width:0;min-width:100%/.test(rule), 'compare.js: .pp is width:0;min-width:100% (the no-containment fallback)');

  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser = null, engine = 'chromium';
  try { browser = await pw.webkit.launch(); engine = 'webkit'; }
  catch (e) {
    try { browser = await pw.chromium.launch(); }
    catch (e2) { browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  }
  console.log('engine: ' + engine + (engine === 'chromium' ? ' (WebKit not launchable here — the measurement below is the weaker half)' : ''));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(base + '/deck');
  await page.waitForTimeout(600);
  // compare.js's auto-mount can miss a page that loads it in the head (a
  // separate bug); the width rule is what is under test, so mount by hand
  await page.evaluate(() => { if (!document.querySelector('.pp')) window.__pagePlace({ chapters: 'h2' }); });
  await page.waitForTimeout(300);
  const m2 = await page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width) }; };
    const deck = document.getElementById('deck');
    const cards = [...deck.children].map((c) => r(c).w);
    const pp = document.querySelector('.pp');
    return { vw: innerWidth, deck: r(deck).w, cards, ta: r(document.querySelector('textarea.p')), pp: pp ? r(pp) : null, sticky: pp ? getComputedStyle(pp).position : null };
  });
  console.log('    ' + JSON.stringify(m2));
  ok(!!m2.pp, 'the bar mounted inside card 1');
  ok(m2.cards.every((w) => w === m2.deck), 'every card is exactly the deck\'s width (' + m2.cards.join(',') + ' vs ' + m2.deck + ')');
  ok(m2.ta.r <= m2.vw, 'card 1\'s textarea ends inside the viewport (' + m2.ta.r + ' <= ' + m2.vw + ')');
  ok(m2.pp && m2.pp.w > 200 && m2.pp.r <= m2.vw, 'the bar still draws full width inside the card');
  ok(m2.sticky === 'sticky', 'the bar is still sticky');
  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
