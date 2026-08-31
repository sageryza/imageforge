#!/usr/bin/env node
/*
 * test-playground-expand-cast.js — THE BIGGER DESCRIPTION BOX (2026-08-29,
 * Sophie: "expand character description button add").
 *
 * A character description is a sentence of hers — "long beard, glasses, all
 * black, with a cape and a belt, sickeningly sweet smile" — and the compact
 * row shows about a third of it. The corner button is #prompt.big's answer in
 * shape: ONE field, two sizes, never a second box to keep in sync.
 *
 * EVERY ASSERTION HERE IS A MEASUREMENT, because that is the only honest way
 * to ask this. A `.big` class on the row and a real bigger box look identical
 * to any markup assertion — a wrong `order`, a missing `flex-basis` or a
 * clamp the CSS never applies all render as a page that "expands" and gives
 * her nothing. So the box is measured before and after, on the row and on the
 * line below it, and the toggle's own tap is asked with elementFromPoint.
 *
 * And the two invariants the shape rides on: the field is still ONE LINE by
 * contract (castBlock writes a character per line, castParse reads them back
 * that way), and expanding stores nothing — it must not touch her words.
 *
 *   node scripts/test-playground-expand-cast.js
 */
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public/promptlab.html'), 'utf8');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const sheetGrid = require(path.join(ROOT, 'sheet-grid.js'));

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// The clause is a LINE PER CHARACTER at both ends — which is the whole reason
// the textarea refuses a newline. Pinned here so a reword of the clause that
// made it multi-line would have to come past this.
console.log('the clause is one line per character, both ways');
const CAST = [{ name: 'the creepy guy',
  description: 'long beard, glasses, all black, with a cape and a belt, sickeningly sweet smile' }];
const clause = sheetGrid.castBlock(CAST, true);
ok(clause.split('\n').length === 2, 'castBlock writes the intro and one line for the character');
ok(sheetGrid.castParse(clause)[0].description === CAST[0].description,
  'and castParse reads that exact description back');

let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

const RES = (() => {
  const i = serverSrc.indexOf('\n  res: {');
  const b = serverSrc.slice(i + '\n  res: '.length);
  const lit = b.slice(0, b.indexOf('\n  },') + 4).trim().replace(/,$/, '');
  return eval('(' + lit.replace(/^\s*\/\/.*$/gm, '') + ')');   // eslint-disable-line no-eval
})();

function panelsPayload() {
  const panels = { grids: {}, sheets: {} };
  Object.keys(sheetGrid.GRIDS).forEach((g) => {
    const pin = sheetGrid.GRIDS[g].shape;
    panels.grids[g] = { ...sheetGrid.GRIDS[g],
      count: sheetGrid.GRIDS[g].across * sheetGrid.GRIDS[g].down,
      positions: sheetGrid.positions(g), layout: sheetGrid.layoutWords(g),
      sentence: sheetGrid.panelBlock(g, []),
      aspectRatio: pin ? sheetGrid.SHAPES[pin].aspectRatio : null };
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
  panels.cast = { intro: sheetGrid.CAST_INTRO, introOne: sheetGrid.CAST_INTRO_ONE, max: 12 };
  return panels;
}

(async () => {
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (url.pathname === '/api/promptlab' && req.method === 'POST') return json({ id: 'x1' });
    if (url.pathname === '/api/promptlab') return json({ runs: [], more: false });
    if (url.pathname === '/api/promptlab/styles') {
      return json({ styles: {
        dreamy: { label: 'Dreamy', prefix: 'DPREF', suffix: 'DTAIL', refs: ['d.jpg'] },
      }, sizes: {}, res: RES, resDefault: '1k', max: 4000, photoLine: '', panels: panelsPayload() });
    }
    if (url.pathname === '/api/promptlab/characters') return json({ characters: [], max: 6 });
    if (url.pathname.startsWith('/api/gallery')) return json({ assets: [], thread: [] });
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  // Her real viewport, with the app's own bottom bar taken off — the height
  // the vh clamps are judged at.
  const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
  await page.goto(base + '/playground?style=dreamy');
  await page.waitForFunction(() => document.querySelectorAll('#plabtabs button').length === 2);

  await page.click('#charsbtn');
  await page.waitForSelector('#charpanel.on');
  await page.click('#chartabs button[data-ct="desc"]');
  await page.waitForSelector('#chardesc:not([hidden])');
  await page.click('#castadd');
  await page.waitForSelector('#castrows .castrow');

  const box = (sel) => page.$eval(sel, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, bottom: r.bottom };
  });

  console.log('\nthe button is there before the words are');
  ok(await page.isVisible('#castrows .castrow .cbig'),
    'an EMPTY row already carries the toggle — a field she WRITES in, so room to '
    + 'write has to come before the words (the .moretxt opener\'s difference)');
  const bb = await box('#castrows .castrow .cbig');
  ok(Math.abs(bb.h - 32) < 1.5 && Math.abs(bb.w - 30) < 1.5,
    'and it is the removal button\'s own rounded square, not a new size');
  const hit = await page.evaluate(() => {
    const r = document.querySelector('#castrows .castrow .cbig').getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el && el.closest('.cbig') ? 'cbig' : (el ? el.className || el.tagName : 'none');
  });
  ok(hit === 'cbig', 'a tap at its centre reaches it — nothing is sitting on it');

  console.log('\nexpanding buys HEIGHT and WIDTH, measured');
  await page.fill('#castrows .castrow .cds', CAST[0].description);
  const small = await box('#castrows .castrow .cds');
  const rowW = (await box('#castrows .castrow')).w;
  ok(small.h < 40, 'the compact box is one line high (' + Math.round(small.h) + 'px)');
  ok(small.w < rowW * 0.7,
    'and it is a column of the row, not the row (' + Math.round(small.w) + ' of ' + Math.round(rowW) + ')');
  await page.click('#castrows .castrow .cbig');
  await page.waitForTimeout(60);
  const bigBox = await box('#castrows .castrow .cds');
  ok(bigBox.h > small.h * 3,
    'expanded it is a real box, not a nudge (' + Math.round(small.h) + ' → ' + Math.round(bigBox.h) + 'px)');
  ok(bigBox.w > rowW * 0.95,
    'and it takes the WHOLE row width — the half a taller three-column box cannot buy');
  const nameBox = await box('#castrows .castrow .cnm');
  ok(bigBox.y > nameBox.bottom - 1,
    'on its own line UNDER the name, which is what `order` on the wrapped row is for');
  const xBox = await box('#castrows .castrow .cx');
  ok(xBox.y < bigBox.y, 'the × stays on the line above, still reachable');

  console.log('\nthe clamps are the CSS\'s, and the fit is honest');
  const vh = 700;
  ok(bigBox.h >= vh * 0.18 - 2, 'the FLOOR holds even on a short description (min-height 18vh)');
  const longer = new Array(40).fill(CAST[0].description).join(' ');
  await page.fill('#castrows .castrow .cds', longer);
  await page.waitForTimeout(60);
  const capped = await box('#castrows .castrow .cds');
  ok(capped.h <= vh * 0.44 + 2,
    'and a very long one stops at the cap rather than swallowing the page (max-height 44vh)');
  ok(await page.$eval('#castrows .castrow .cds', (t) => t.scrollHeight > t.clientHeight + 1
    && getComputedStyle(t).overflowY === 'auto'),
    'a capped box scrolls its own words — nothing of hers is unreachable');
  // The shrink is the half a measure-without-reset silently loses: scrollHeight
  // of a box already sized to its old height reports that height back.
  await page.fill('#castrows .castrow .cds', CAST[0].description);
  await page.waitForTimeout(60);
  const shrunk = await box('#castrows .castrow .cds');
  ok(shrunk.h < capped.h - 20, 'and deleting most of it shrinks the box back down');

  console.log('\nit is still ONE LINE, and expanding stores nothing');
  await page.focus('#castrows .castrow .cds');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('x');
  const typed = await page.inputValue('#castrows .castrow .cds');
  ok(typed.indexOf('\n') < 0 && /x$/.test(typed),
    'Enter is refused — a newline would cut the clause in half at castParse');
  await page.evaluate(() => {
    const t = document.querySelector('#castrows .castrow .cds');
    t.value = 'tall man\nin a red coat';
    t.dispatchEvent(new Event('input', { bubbles: true }));
  });
  ok((await page.inputValue('#castrows .castrow .cds')) === 'tall man in a red coat',
    'and a pasted newline collapses to a space, exactly as the <input> it replaced did');
  ok((await page.evaluate(() => JSON.parse(localStorage.getItem('promptlab_cast'))[0].description))
      === 'tall man in a red coat',
    'what is stored is what is on screen');

  const before = await page.evaluate(() => localStorage.getItem('promptlab_cast'));
  await page.click('#castrows .castrow .cbig');
  await page.waitForTimeout(60);
  const after = await page.evaluate(() => localStorage.getItem('promptlab_cast'));
  ok(before === after, 'closing the box writes nothing — the size is not one of her words');
  const backSmall = await box('#castrows .castrow .cds');
  ok(Math.abs(backSmall.h - small.h) < 2,
    'and it really goes back to the one-line row (' + Math.round(backSmall.h) + 'px)');

  console.log('\nnot sticky, like the prompt box');
  await page.click('#castrows .castrow .cbig');
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#plabtabs button').length === 2);
  await page.click('#charsbtn');
  await page.waitForSelector('#charpanel.on');
  await page.click('#chartabs button[data-ct="desc"]');
  await page.waitForSelector('#castrows .castrow');
  ok(!(await page.$('#castrows .castrow.big')),
    'the sheet comes back compact — the big box is a moment, not the page\'s shape');
  ok((await page.inputValue('#castrows .castrow .cds')) === 'tall man in a red coat',
    'her words came back, which is the half that IS remembered');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();
