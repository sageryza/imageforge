#!/usr/bin/env node
/*
 * test-playground-prompt-clear.js — the CLEAR beside the character button
 * (2026-08-29, Sophie, circling the empty space next to it: "add clear button
 * red circle").
 *
 * Every assertion here is a real tap or a measurement, because the whole
 * feature is about where a control sits and what a tap reaches:
 *
 *   - it lives in the `.styles` row, after the character button, at that
 *     row's own 34px — the place she circled
 *   - it is drawn ONLY while the one box is on screen with words in it:
 *     never a dead control, and never on the Panels tab, whose box is away
 *   - it asks first over words that were never DRAWN, and clears a drawn
 *     prompt silently (the panels Clear's own question, for its own reason)
 *   - "Keep them" really keeps them
 *   - the panel boxes are untouched by it
 *
 *   node scripts/test-playground-prompt-clear.js
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

// The one source pin: the clear lives in the row she circled, not in the
// controls row under the box. A selector cannot see WHERE it renders, but it
// can see which parent it was written into.
console.log('the source contract');
const stylesRow = pageSrc.slice(pageSrc.indexOf('<div class="styles">'));
ok(/id="promptclear"/.test(stylesRow.slice(0, stylesRow.indexOf('</div>'))),
  'it is written into the .styles row, beside the character button');

(async () => {
  const PIXEL = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
  let started = null;
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
        try { started = JSON.parse(body); } catch (e) { started = null; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'x1' }));
      });
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
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#plabtabs button').length === 2);
  const words = 'nora covering me with dolls to go to the airport';

  console.log('\nwhere it lives, and when');
  ok(!(await page.isVisible('#promptclear')), 'an empty box shows none — never a dead control');
  await page.fill('#prompt', words);
  ok(await page.isVisible('#promptclear'), 'it arrives with her first word');
  const geom = await page.evaluate(() => {
    const c = document.getElementById('promptclear').getBoundingClientRect();
    const s = document.getElementById('stylepick').getBoundingClientRect();
    const ch = document.getElementById('charsbtn').getBoundingClientRect();
    const box = document.getElementById('prompt').getBoundingClientRect();
    const hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
    return {
      h: Math.round(c.height), sh: Math.round(s.height),
      afterChars: ch.width ? c.left >= ch.right - 1 : c.left >= s.right - 1,
      sameLine: Math.abs((c.top + c.bottom) / 2 - (s.top + s.bottom) / 2) < 2,
      aboveBox: c.bottom <= box.top + 1,
      clearOfPill: c.right <= 390 - 56,
      rowFits: (function () {
        const row = document.querySelector('.styles');
        return Math.abs(row.getBoundingClientRect().height - c.height) < 4;
      }()),
      hit: hit && (hit.closest ? (hit.closest('#promptclear') ? 'promptclear' : hit.tagName) : ''),
    };
  });
  ok(geom.sameLine, 'on the style picker’s own line');
  ok(geom.afterChars, 'after the character button — the space she circled');
  ok(geom.h === 34 && geom.sh === 34, 'the row’s own 34px, matching the picker (' + geom.h + 'px)');
  ok(geom.aboveBox, 'above the box it clears');
  ok(geom.clearOfPill, 'and clear of the autoscroll pill’s reserved column');
  ok(geom.hit === 'promptclear', 'a tap at its centre really reaches it');
  ok((await page.textContent('#promptclear')).trim() === 'Clear',
    'and it says the word — never a ✕ (2026-08-30, her ask)');
  ok(!(await page.$('#promptclear svg')), 'no glyph on it at all');
  ok(geom.rowFits, 'the row still fits on one line at 390pt');

  console.log('\nit asks over words that were never drawn');
  await page.click('#promptclear');
  await page.waitForSelector('#ask.on');
  ok(await page.isVisible('#ask'), 'the pop-up opens');
  await page.click('#askno');
  ok((await page.inputValue('#prompt')) === words, '"Keep them" keeps every word');
  await page.click('#promptclear');
  await page.waitForSelector('#ask.on');
  await page.click('#askyes');
  await page.waitForFunction(() => !document.getElementById('prompt').value);
  ok((await page.inputValue('#prompt')) === '', 'and "Clear" empties the box');
  ok(!(await page.isVisible('#promptclear')), 'the clear goes with the last word');

  console.log('\na DRAWN prompt clears with no question');
  await page.fill('#prompt', words);
  await page.click('#go');
  await page.waitForTimeout(400);
  ok(started && started.prompt === words, 'the run really started with her words');
  await page.click('#promptclear');
  await page.waitForFunction(() => !document.getElementById('prompt').value);
  ok(!(await page.isVisible('#ask.on')),
    'no pop-up — that picture is in her feed and its prompt copies back');

  console.log('\nand it never offers to clear a box she cannot see');
  await page.fill('#prompt', words);
  await page.click('#t-panels');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length > 0);
  ok(!(await page.isVisible('.promptwrap')), 'the one box is away on the Panels tab');
  ok(!(await page.isVisible('#promptclear')), 'and so is its clear');
  await page.fill('#panelgrid textarea[data-panel="0"]', 'a fox');
  await page.click('#t-picture');
  await page.waitForFunction(() => !document.querySelector('.promptwrap').hidden);
  ok(await page.isVisible('#promptclear'), 'it comes back with the box, her words still in it');
  ok((await page.inputValue('#prompt')) === words, 'and the words survived the trip');
  await page.click('#promptclear');
  if (await page.isVisible('#ask.on')) await page.click('#askyes');
  await page.waitForFunction(() => !document.getElementById('prompt').value);
  await page.click('#t-panels');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length > 0);
  ok((await page.inputValue('#panelgrid textarea[data-panel="0"]')) === 'a fox',
    'clearing the one box left the panel boxes alone');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();
