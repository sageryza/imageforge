#!/usr/bin/env node
/**
 * Drives the shared comparison-page shell (scripts/lib/triptych-page.js) in
 * headless Chromium against the repo's OWN public/compare.css + compare.js.
 *
 *   node scripts/test-triptych-page.js
 *
 * No network: the page is built from fixtures and served from a local server,
 * so this stays honest in CI and in a fresh container. It does NOT prove
 * anything about a page already posted — the injected autoscroll pill is added
 * by the server and is deliberately absent here (see test-compare-shell.js and
 * test-page-embed.js, which cover the served and embedded paths).
 *
 * What it pins is the part two pages share and that a copy-paste would drift:
 * one panel per row, one open at a time, the right prompt in it, closing on a
 * second tap, and no horizontal overflow on a phone.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildPage } = require('./lib/triptych-page');

const PUB = path.join(__dirname, '..', 'public');
const PORT = 8733;

const rows = [
  {
    id: 'braid', label: 'Braiding her hair in the mirror',
    cells: [
      { key: 'watercolor', tag: 'watercolor', url: 'a.webp', alt: 'a',
        promptStyle: 'WATERCOLOR STYLE TEXT', promptContent: 'braiding her long hair' },
      { key: 'dream', tag: 'dream mystery', url: 'b.webp', alt: 'b',
        promptStyle: 'DREAM STYLE TEXT', promptContent: 'braiding her long hair' },
      { key: 'pastel', tag: 'pastel', url: 'c.webp', alt: 'c',
        promptStyle: 'PASTEL STYLE TEXT', promptContent: 'braiding her long hair' },
    ],
  },
  // FOUR cells — the quality ladder's shape. The column count is data, so a
  // row of 4 has to lay out from the same code as a row of 3.
  {
    id: 'bicycle', label: 'The chain came off',
    cells: [
      { key: 'sheetmed', tag: '¼ sheet · med', url: 'd.webp', alt: 'd',
        promptStyle: 'SHEET RUNG TEXT', promptContent: 'the chain slips off' },
      { key: 'low', tag: 'low', url: 'e.webp', alt: 'e',
        promptStyle: 'LOW RUNG TEXT', promptContent: 'the chain slips off' },
      { key: 'medium', tag: 'medium', url: 'f.webp', alt: 'f',
        promptStyle: 'MEDIUM RUNG TEXT', promptContent: 'the chain slips off' },
      { key: 'high', tag: 'high', url: 'g.webp', alt: 'g',
        promptStyle: 'HIGH RUNG TEXT', promptContent: 'the chain slips off' },
    ],
  },
];

const html = buildPage({
  title: 'Fixture page — two rows',
  chat: 'test-chat', sheet: 'test-s2x3',
  help: '<b>Fixture.</b> Nothing real here.',
  rows,
});

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('playwright not installed — skipping'); process.exit(0); }

const srv = http.createServer((rq, rs) => {
  const u = rq.url.split('?')[0];
  if (u === '/' || u === '/page.html') { rs.writeHead(200, { 'Content-Type': 'text/html' }); return rs.end(html); }
  const f = path.join(PUB, u.replace(/^\//, ''));
  if (!f.startsWith(PUB) || !fs.existsSync(f)) { rs.writeHead(404); return rs.end(); }
  rs.writeHead(200, { 'Content-Type': u.endsWith('.css') ? 'text/css' : 'text/javascript' });
  rs.end(fs.readFileSync(f));
});

let fails = 0;
const ok = (label, cond) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}`); if (!cond) fails++; };

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const exe = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  const b = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message)));
  await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(400);

  ok('one <h1>, no eyebrow or sub above it',
    (await p.locator('h1').count()) === 1 && (await p.locator('.eyebrow, .sub').count()) === 0);
  ok('a prompt button per cell', (await p.locator('.pbtn').count()) === 7);
  ok('every panel starts shut', (await p.locator('.ppanel[hidden]').count()) === 2);
  // Rows of DIFFERENT widths on one page — 3 across and 4 across — laid out
  // from the same code path.
  ok('a 3-cell row lays out 3 across', (await p.evaluate(() =>
    getComputedStyle(document.querySelector('[data-item="braid"] .cmpgrid'))
      .gridTemplateColumns.split(' ').length)) === 3);
  ok('a 4-cell row lays out 4 across', (await p.evaluate(() =>
    getComputedStyle(document.querySelector('[data-item="bicycle"] .cmpgrid'))
      .gridTemplateColumns.split(' ').length)) === 4);

  const card = p.locator('.card[data-item="braid"]');
  const panel = card.locator('.ppanel');
  await p.locator('.pbtn[data-p="braid__dream"]').click();
  await p.waitForTimeout(150);
  ok('opens on tap', await panel.isVisible());
  let t = await panel.innerText();
  ok('carries THAT cell\'s style half', t.includes('DREAM STYLE TEXT'));
  ok('carries the content half', t.includes('braiding her long hair'));
  ok('names which style it is', /DREAM MYSTERY/i.test(t));

  // STRUCTURE, not just visible text. A panel that APPENDS instead of
  // replacing passes a text check by accident: querySelectorAll('p')[0] still
  // addresses the first block, so the stale text is overwritten in place and
  // the appended block sits there empty. Counting the headings is what
  // actually catches it — verified by breaking the module on purpose.
  ok('exactly one style + one content block', await panel.locator('h4').count() === 2
    && await panel.locator('p').count() === 2);
  ok('exactly one button reads as open',
    await card.locator('.pbtn[aria-expanded="true"]').count() === 1);

  await p.locator('.pbtn[data-p="braid__pastel"]').click();
  await p.waitForTimeout(150);
  t = await panel.innerText();
  ok('swaps rather than stacks', t.includes('PASTEL STYLE TEXT') && !t.includes('DREAM STYLE TEXT'));
  ok('still exactly one block after swapping', await panel.locator('h4').count() === 2
    && await panel.locator('p').count() === 2);
  ok('the previous button is no longer open',
    await card.locator('.pbtn[aria-expanded="true"]').count() === 1
    && await p.locator('.pbtn[data-p="braid__dream"]').getAttribute('aria-expanded') === 'false');

  await p.locator('.pbtn[data-p="braid__pastel"]').click();
  await p.waitForTimeout(150);
  ok('closes on a second tap', !(await panel.isVisible()));
  ok('no button reads as open once shut',
    await card.locator('.pbtn[aria-expanded="true"]').count() === 0);

  await p.locator('.pbtn[data-p="bicycle__high"]').click();
  await p.waitForTimeout(150);
  ok('rows are independent',
    (await p.locator('.card[data-item="bicycle"] .ppanel').isVisible()) && !(await panel.isVisible()));

  ok('no horizontal overflow at 390px',
    (await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) === 0);
  ok('no page errors', errs.length === 0);
  if (errs.length) console.log('   ', errs);

  await b.close();
  srv.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
