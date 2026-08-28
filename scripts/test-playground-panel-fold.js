#!/usr/bin/env node
/*
 * test-playground-panel-fold.js — the PANELS tab's boxes fold away
 * (2026-08-28, Sophie: "make the panels grid collapsible").
 *
 * Nine 2:3 boxes is most of a screen, and the controls and Generate sit under
 * them — so a row above the grid puts them away. Everything here is a
 * MEASUREMENT or a real tap, because the whole feature is about what is on
 * screen and what a fold must never cost:
 *
 *   - OPEN by default, and the row only shows on the Panels tab
 *   - shut hides the boxes but KEEPS them in the DOM, so her words survive
 *     and a folded Generate still POSTs every panel
 *   - shut, the row says how many are written; open it does not (the boxes
 *     are right there)
 *   - the fold is sticky across a load
 *   - anything that means "write in these boxes" OPENS it: picking a grid,
 *     an error naming an empty panel, a run's copy button
 *   - the controls really do move up (the reason for the whole thing)
 *
 *   node scripts/test-playground-panel-fold.js
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
ok(/box\.style\.display = shut \? 'none'/.test(pageSrc),
  'the fold hides the grid with display, leaving the textareas in the DOM');
ok(!/#panelgrid[^{]*\{[^}]*visibility/.test(pageSrc),
  'and never with visibility (a hidden box would still take the room)');

(async () => {
  const posted = [];
  const nine = ['a fox', 'a moon', 'a boat', 'a key', 'a well', 'a crow', 'a comb', 'a bell', 'a door'];
  const doneRun = {
    id: 'r9', status: 'done', engine: 'gptimage', gptStyle: 'dreamy', model: 'gpt-image-2',
    prompt: nine.join(' / '),
    fullPrompt: 'PREFIX\n\ngrid sentence\n\nTAIL',
    quality: 'low', size: '2304x3456', aspectRatio: '2:3', res: '4k',
    panels: nine, grid: { across: 3, down: 3, count: 9 },
    sheet: '2304x3456', cell: '768x1152',
    images: nine.map((_, i) => 'http://127.0.0.1:0/img/p' + i + '.png'),
    createdAt: Date.now() - 60000,
  };
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
      return res.end(JSON.stringify({ runs: [doneRun], more: false }));
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

  const vp = { width: 390, height: 844 };
  const page = await browser.newPage({ viewport: vp });
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#plabtabs button').length === 2);

  console.log('\nwhere the row lives');
  ok(!(await page.isVisible('#panelfold')), 'no fold row on the PICTURE tab');
  await page.click('#t-panels');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length > 0);
  ok(await page.isVisible('#panelfold'), 'it appears with the boxes on PANELS');
  ok(await page.isVisible('#panelgrid'), 'and the boxes are OPEN by default');
  ok((await page.textContent('#panelfoldlab')).trim() === 'Panels',
    'open, the row names the section and says nothing about counts');
  // The row is above the boxes, not floating in the pill's corner.
  const geom = await page.evaluate(() => {
    const r = document.getElementById('panelfold').getBoundingClientRect();
    const g = document.getElementById('panelgrid').getBoundingClientRect();
    return { rb: r.bottom, gt: g.top, rr: r.right, fixed: getComputedStyle(document.getElementById('panelfold')).position };
  });
  ok(geom.rb <= geom.gt + 1, 'the row sits ABOVE the grid');
  ok(geom.fixed !== 'fixed', 'and is in the flow, never a floating control');

  console.log('\nfolding, and what it must not cost');
  await page.click('#gridpick button[data-grid="9"]');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length === 9);
  for (let i = 0; i < 9; i++) await page.fill('#panelgrid textarea[data-panel="' + i + '"]', nine[i]);
  const openTop = await page.evaluate(() => document.querySelector('.controls').getBoundingClientRect().top);
  await page.click('#panelfold');
  await page.waitForFunction(() => !document.getElementById('panelgrid').offsetParent);
  ok(!(await page.isVisible('#panelgrid')), 'a tap puts the boxes away');
  ok((await page.$$eval('#panelgrid textarea', (t) => t.length)) === 9,
    'the nine textareas are STILL IN THE DOM — a fold can never lose her words');
  ok((await page.$$eval('#panelgrid textarea', (t) => t.map((x) => x.value).join('|'))) === nine.join('|'),
    'holding every word she typed');
  const shutTop = await page.evaluate(() => document.querySelector('.controls').getBoundingClientRect().top);
  ok(shutTop < openTop - 200, 'and the controls really do come up the screen (measured)');
  ok(/9 of 9 written/.test(await page.textContent('#panelfoldlab')),
    'shut, the row says how many are written — the thing the boxes no longer say');
  ok((await page.getAttribute('#panelfold', 'aria-expanded')) === 'false', 'and it says so to a reader');

  console.log('\na folded Generate still sends every panel');
  posted.length = 0;
  await page.click('#go');
  await page.waitForFunction(() => window.__t === undefined || true);
  await page.waitForTimeout(300);
  ok(posted.length === 1, 'it POSTs');
  ok(posted[0] && JSON.stringify(posted[0].panels) === JSON.stringify(nine),
    'with all nine panels, read straight out of the folded boxes');

  console.log('\nsticky across a load');
  // A RELOAD of the same page, so the localStorage the tap wrote is the one
  // this load reads — a fresh context would only prove the seeded key works.
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length > 0);
  ok(!(await page.isVisible('#panelgrid')), 'the fold she left is the fold she comes back to');
  ok(await page.isVisible('#panelfold'), 'with the row still there to open it');

  console.log('\nwhat OPENS it again');
  await page.click('#gridpick button[data-grid="4"]');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length === 4);
  ok(await page.isVisible('#panelgrid'), 'picking a grid — she is about to write in it');
  // Shut it, empty a box, and ask for a picture: the error names a box, so
  // the box has to be on screen.
  await page.fill('#panelgrid textarea[data-panel="0"]', 'a dog');
  await page.fill('#panelgrid textarea[data-panel="1"]', 'a cat');
  await page.fill('#panelgrid textarea[data-panel="2"]', 'a hat');
  await page.fill('#panelgrid textarea[data-panel="3"]', '');
  await page.click('#panelfold');
  await page.waitForFunction(() => !document.getElementById('panelgrid').offsetParent);
  posted.length = 0;
  await page.click('#go');
  await page.waitForFunction(() => !document.getElementById('err').hidden);
  ok(posted.length === 0, 'an empty panel still refuses to spend money');
  ok(/1 panel still needs words/.test(await page.textContent('#err')), 'and the error names it');
  ok(await page.isVisible('#panelgrid'),
    'and the fold OPENS — an error pointing at a box she cannot see is no error');

  console.log("\nthe story box folds the same way");
  await page.click('#gridpick button[data-grid="story"]');
  await page.waitForFunction(() => !!document.querySelector('#panelgrid textarea[data-story]'));
  ok(await page.isVisible('#panelgrid'), 'Story arrives open');
  ok((await page.textContent('#panelfoldlab')).trim() === 'Story', 'and the row is named for it');
  await page.fill('#panelgrid textarea[data-story]', 'a witch loses her cat');
  await page.click('#panelfold');
  await page.waitForFunction(() => !document.getElementById('panelgrid').offsetParent);
  ok(/Story · written/.test(await page.textContent('#panelfoldlab')),
    'shut, it says the story is written rather than counting boxes');
  posted.length = 0;
  await page.click('#go');
  await page.waitForTimeout(300);
  ok(posted.length === 1 && posted[0].story === true && /witch loses her cat/.test(posted[0].prompt || ''),
    'and a folded story still generates from the words in the hidden box');

  console.log('\nthe copy button opens it');
  const copy = await browser.newPage({ viewport: vp });
  await copy.addInitScript(() => {
    try {
      localStorage.setItem('promptlab_tab', 'panels');
      localStorage.setItem('promptlab_panelfold', '1');
    } catch (e) { /* private mode */ }
  });
  await copy.goto(base + '/playground');
  await copy.waitForFunction(() => document.querySelectorAll('#runs .run').length > 0);
  ok(!(await copy.isVisible('#panelgrid')), 'she arrives with the boxes folded');
  await copy.click('#runs .run .copybtn');
  await copy.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length === 9);
  ok(await copy.isVisible('#panelgrid'),
    '"panels are back in the boxes" has to be true on screen');
  ok((await copy.$$eval('#panelgrid textarea', (t) => t.map((x) => x.value).join('|'))) === nine.join('|'),
    'with that run\'s words in them');
  await copy.close();

  await page.close();
  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FAIL (harness):', e); process.exit(1); });
