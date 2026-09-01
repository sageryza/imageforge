#!/usr/bin/env node
/*
 * test-playground-panel-seed.js — a link fills the panel boxes (2026-09-01,
 * Sophie, handing six written prompts to a chat: "seed them to panels first 6
 * 1k i want to change the style prompt").
 *
 * Every assertion is driven through the REAL page, because a seed is a state
 * change across three stored things (the tab, the grid, that grid's draft) and
 * a source assertion cannot tell a seeded box from one that happened to hold
 * the same words, nor see a pop-up that never opened.
 *
 * The rules under test:
 *   - ?panels= fills the boxes, switches to the Panels tab and opens the fold
 *   - the GRID is derived from how many prompts arrive; ?grid= overrides
 *   - a count no grid matches is refused outright, never reshaped
 *   - the link is SPENT — a reload does not seed a second time
 *   - ?res= rides along, so a seed can name its tier
 *   - never over unseen work: an UNDRAWN draft stops and asks; an empty,
 *     identical or already-DRAWN one is replaced silently
 *   - Generate sends exactly the seeded words
 *
 *   node scripts/test-playground-panel-seed.js
 *   (needs: npm install playwright --no-save)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const sheetGrid = require(path.join(ROOT, 'sheet-grid.js'));
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// The real `res` literal out of server.js — never a second copy.
function resTable() {
  const i = serverSrc.indexOf('\n  res: {');
  const b = serverSrc.slice(i + '\n  res: '.length);
  let lit = b.slice(0, b.indexOf('\n  },') + 4).trim().replace(/,$/, '');
  lit = lit.replace(/^\s*\/\/.*$/gm, '');
  return eval('(' + lit + ')');                      // eslint-disable-line no-eval
}
const RES = resTable();

function panelsPayload() {
  const panels = { grids: {}, sheets: {}, story: { line: 'STORYLINE', layout: '' } };
  Object.keys(sheetGrid.GRIDS).forEach((g) => {
    const pin = sheetGrid.GRIDS[g].shape;
    panels.grids[g] = {
      ...sheetGrid.GRIDS[g],
      count: sheetGrid.GRIDS[g].across * sheetGrid.GRIDS[g].down,
      positions: sheetGrid.positions(g),
      layout: sheetGrid.layoutWords(g),
      sentence: sheetGrid.panelBlock(g, []),
      aspectRatio: pin ? sheetGrid.SHAPES[pin].aspectRatio : null,
    };
  });
  Object.keys(sheetGrid.SHAPES).filter((sh) => RES[sh]).forEach((shape) => {
    panels.sheets[shape] = {};
    Object.keys(sheetGrid.GRIDS).forEach((g) => {
      panels.sheets[shape][g] = {};
      Object.keys(RES[shape].tiers).forEach((tier) => {
        const plan = sheetGrid.sheetFor(shape, Number(g), tier, RES);
        if (plan) panels.sheets[shape][g][tier] = { sheet: plan.sheet, cell: plan.cell };
      });
    });
  });
  return panels;
}

// Source pins — the two rules a later edit is likeliest to undo.
console.log('the source contract');
ok(/seedPanelsFromLink\(\);/.test(pageSrc.slice(pageSrc.indexOf('PANELS_CFG = d.panels'))),
  'the seed runs once the grids have landed and BEFORE the first paint');
ok(/q\.delete\('panels'\)/.test(pageSrc) && /replaceState/.test(pageSrc),
  'the link is spent, so a reload cannot seed over words she has edited');

(async () => {
  const posted = [];
  const SIX = ['a fox', 'a moon', 'a boat', 'a key', 'a bell', 'a crow'];
  const PIXEL = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
        try { posted.push(JSON.parse(body)); } catch { posted.push(null); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'x1' }));
      });
    }
    if (/^\/api\/promptlab\/x1$/.test(url.pathname)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ id: 'x1', status: 'running', images: [] }));
    }
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: [], more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        styles: {
          evan: { label: 'Sandy mirror', prefix: 'PREFIX', suffix: 'TAIL', refs: ['x.png'] },
          dreamy: { label: 'Dreamy', prefix: 'DPREF', suffix: 'DTAIL', refs: ['d.jpg'] },
        },
        sizes: {}, res: RES, resDefault: '1k', max: 4000, photoLine: '',
        panels: panelsPayload(),
      }));
    }
    if (url.pathname.startsWith('/img/')) {
      res.writeHead(200, { 'Content-Type': 'image/webp' });
      return res.end(PIXEL);
    }
    if (url.pathname === '/api/gallery/assets/notes') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ assets: [] }));
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;

  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { console.log('\n(page half skipped — npm install playwright --no-save)'); server.close(); process.exit(fails ? 1 : 0); }
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const boxes = () => page.$$eval('#panelgrid textarea', (t) => t.map((x) => x.value));
  const asking = () => page.isVisible('#ask');
  const stored = (k) => page.evaluate((key) => localStorage.getItem(key), k);
  const seedUrl = (rows, extra) =>
    base + '/playground?panels=' + encodeURIComponent(JSON.stringify(rows)) + (extra || '');
  const settle = async () => {
    await page.waitForFunction(() => document.querySelectorAll('#plabtabs button').length === 2);
    await page.waitForTimeout(220);
  };

  console.log('\nthe seed itself');
  await page.goto(seedUrl(SIX, '&res=1k'));
  await settle();
  ok(JSON.stringify(await boxes()) === JSON.stringify(SIX),
    'all six prompts land in the boxes, in order');
  ok(await page.evaluate(() => document.getElementById('t-panels').classList.contains('on')),
    'and she arrives on the Panels tab — the boxes are no use on the tab that hides them');
  ok(await stored('promptlab_grid') === '6',
    'the grid is DERIVED from six prompts (nothing in the link named it)');
  ok(await page.$eval('#panelgrid', (el) => el.offsetHeight > 0),
    'the fold is open — a seed means write in these boxes');
  ok(await page.evaluate(() => document.getElementById('rpick').getAttribute('data-n')) === '0',
    'the tier the link asked for is the tier on the knob (1K)');

  console.log('\nthe link is spent');
  ok(!/panels=/.test(await page.evaluate(() => location.search)),
    'the seed params are off the url the moment they are read');
  await page.fill('#panelgrid textarea[data-panel="0"]', 'her own edit');
  await page.waitForTimeout(60);
  await page.reload();
  await settle();
  ok((await boxes())[0] === 'her own edit',
    'a reload keeps HER edit — the link cannot seed a second time');

  console.log('\nnever over unseen work');
  await page.goto(seedUrl(SIX));                     // same six, over her edited draft
  await settle();
  ok(await asking(), 'a draft that was never drawn stops and asks');
  const fine = (await page.textContent('#askfine')) || '';
  ok(/never drawn/.test(fine), 'and it says why it is asking');
  await page.click('#askno');
  await page.waitForTimeout(150);
  ok((await boxes())[0] === 'her own edit',
    'Keep what’s there leaves her words exactly as they were');
  ok(await page.evaluate(() => document.getElementById('t-panels').classList.contains('on')),
    'and still takes her to the grid the link named');

  await page.goto(seedUrl(SIX));
  await settle();
  await page.click('#askyes');
  await page.waitForTimeout(180);
  ok(JSON.stringify(await boxes()) === JSON.stringify(SIX),
    'Use the link’s replaces them with the seeded six');

  await page.goto(seedUrl(SIX));
  await settle();
  ok(!(await asking()),
    'seeding the same words again asks nothing — there is nothing to lose');

  console.log('\nthe grid');
  await page.goto(seedUrl(['one', 'two', 'three', 'four'], '&grid=9'));
  await settle();
  ok(await stored('promptlab_grid') === '9' && (await boxes()).length === 9,
    '?grid= overrides the count, and the short seed pads the rest');
  ok(JSON.stringify((await boxes()).slice(0, 4)) === JSON.stringify(['one', 'two', 'three', 'four']),
    'her four words lead the nine');

  const before = await stored('promptlab_grid');
  await page.goto(seedUrl(['a', 'b', 'c', 'd', 'e', 'f', 'g']));   // 7 — no such grid
  await settle();
  ok(await stored('promptlab_grid') === before,
    'a count no grid matches is refused outright rather than reshaped');

  console.log('\nGenerate sends what was seeded');
  await page.goto(seedUrl(SIX));
  await settle();
  if (await asking()) { await page.click('#askyes'); await page.waitForTimeout(180); }
  await page.click('#go');
  await page.waitForTimeout(300);
  const run = posted[posted.length - 1] || {};
  ok(Array.isArray(run.panels) && JSON.stringify(run.panels) === JSON.stringify(SIX),
    'the run carries the six seeded prompts, one per panel');
  ok(run.grid === 6 && run.res === '1k',
    'at the seeded grid and tier');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
  process.exit(fails ? 1 : 0);
})();
