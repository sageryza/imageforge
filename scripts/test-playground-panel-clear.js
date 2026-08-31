#!/usr/bin/env node
/*
 * test-playground-panel-clear.js — the CLEAR at the top of the Panels tab
 * (2026-08-29, Sophie: "add a clear button at the top of panels").
 *
 * Everything here is a real tap or a measurement, because the whole feature
 * is about what a tap reaches and what it costs:
 *
 *   - it is a SIBLING of the fold button, never nested (a button inside a
 *     button is invalid and the tap would bubble into folding the boxes away)
 *   - it is drawn only while there are words to wipe — never a dead control
 *   - it asks first over UNSEEN work, and clears a DRAWN draft silently (the
 *     carry rule's own question, for the carry rule's own reason)
 *   - "Keep them" really keeps them
 *   - it clears the grid she is ON and no other grid's draft
 *   - Story clears its own box
 *
 *   node scripts/test-playground-panel-clear.js
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

// The one source pin: the clear may not live inside the fold button. Nesting
// is what the whole markup shape exists to prevent, and it renders fine.
console.log('the source contract');
const foldTag = pageSrc.slice(pageSrc.indexOf('<button type="button" id="panelfold"'));
ok(!/id="panelclear"/.test(foldTag.slice(0, foldTag.indexOf('</button>'))),
  'the clear is a sibling of the fold, never nested inside it');

(async () => {
  const PIXEL = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
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

  const four = ['a fox', 'a moon', 'a boat', 'a key'];
  const fill = async (vals) => {
    for (let i = 0; i < vals.length; i++) {
      await page.fill('#panelgrid textarea[data-panel="' + i + '"]', vals[i]);
    }
  };
  const vals = () => page.$$eval('#panelgrid textarea', (t) => t.map((x) => x.value));
  const draft = (g) => page.evaluate((k) => localStorage.getItem('promptlab_panels_' + k), String(g));

  console.log('\nwhere it lives, and when');
  ok(!(await page.isVisible('#panelclear')), 'no clear on the PICTURE tab');
  await page.click('#t-panels');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length > 0);
  await page.click('#gridpick button[data-grid="4"]');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length === 4);
  ok(!(await page.isVisible('#panelclear')),
    'and none with the boxes empty — never a control that does nothing');
  await fill(['a fox', '', '', '']);
  ok(await page.isVisible('#panelclear'), 'it arrives with her first word');
  const geom = await page.evaluate(() => {
    const c = document.getElementById('panelclear').getBoundingClientRect();
    const f = document.getElementById('panelfold').getBoundingClientRect();
    const g = document.getElementById('panelgrid').getBoundingClientRect();
    const hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
    return { cb: c.bottom, gt: g.top, right: c.left >= f.right - 1, hit: hit && hit.id };
  });
  ok(geom.cb <= geom.gt + 1, 'above the boxes, at the top of the panels');
  ok(geom.right, 'at the end of the row, past the fold');
  ok(geom.hit === 'panelclear', 'and a tap at its centre really reaches it');

  console.log('\nit asks over words that were never drawn');
  await fill(four);
  await page.click('#panelclear');
  await page.waitForSelector('#ask.on');
  ok(await page.isVisible('#ask'), 'the pop-up opens');
  await page.click('#askno');
  ok((await vals()).join('|') === four.join('|'), '"Keep them" keeps every word');
  ok(await page.isVisible('#panelgrid'), 'and the boxes are still open — the tap never folded them');

  console.log('\nand clears when she says so');
  await page.click('#panelclear');
  await page.waitForSelector('#ask.on');
  await page.click('#askyes');
  await page.waitForFunction(() => Array.prototype.every.call(
    document.querySelectorAll('#panelgrid textarea'), (t) => !t.value));
  ok((await vals()).join('') === '', 'every box is empty');
  ok(!(await page.isVisible('#panelclear')), 'and the clear goes with the last word');
  const d4 = await draft(4);
  ok(!d4 || !JSON.parse(d4).some((s) => String(s || '').trim()), 'the draft is gone too');

  console.log('\nit clears the grid she is ON, and no other');
  await fill(four);
  await page.click('#gridpick button[data-grid="9"]');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length === 9);
  // The carry may have offered to bring her words over — either answer is fine here.
  if (await page.isVisible('#ask.on')) await page.click('#askno');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length === 9);
  await fill(['nine words', '', '', '', '', '', '', '', '']);
  await page.click('#panelclear');
  if (await page.isVisible('#ask.on')) await page.click('#askyes');
  await page.waitForFunction(() => Array.prototype.every.call(
    document.querySelectorAll('#panelgrid textarea'), (t) => !t.value));
  const kept = JSON.parse((await draft(4)) || '[]');
  ok(kept.join('|') === four.join('|'), 'the 4-panel draft is untouched');

  console.log('\na DRAWN draft clears with no question');
  await page.click('#gridpick button[data-grid="4"]');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length === 4);
  if (await page.isVisible('#ask.on')) await page.click('#askno');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length === 4);
  await fill(four);
  await page.evaluate((f) => localStorage.setItem('promptlab_panels_drawn_4', JSON.stringify(f)), four);
  await page.click('#panelclear');
  await page.waitForFunction(() => Array.prototype.every.call(
    document.querySelectorAll('#panelgrid textarea'), (t) => !t.value));
  ok(!(await page.isVisible('#ask.on')),
    'no pop-up — that sheet is in her feed and its prompt copies back');

  console.log('\nand every box has a clear of its own');
  await page.evaluate(() => localStorage.removeItem('promptlab_panels_drawn_4'));
  await fill(four);
  const cellOf = (i) => '#panelgrid .pcell:nth-child(' + (i + 1) + ')';
  ok((await page.$$('#panelgrid .pcell .pclr')).length === 4, 'one per cell');
  const box = await page.evaluate(() => {
    const cell = document.querySelector('#panelgrid .pcell');
    const t = cell.querySelector('textarea');
    const b = cell.querySelector('.pclr');
    const tr = t.getBoundingClientRect(), br = b.getBoundingClientRect();
    const cs = getComputedStyle(t);
    const hit = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
    return {
      inside: br.top >= tr.top - 1 && br.right <= tr.right + 1,
      right: br.right > tr.left + tr.width / 2,
      clearsWords: br.bottom <= tr.top + parseFloat(cs.paddingTop) + 1,
      hit: hit && (hit.closest ? (hit.closest('.pclr') ? 'pclr' : hit.tagName) : hit.tagName),
    };
  });
  ok(box.inside && box.right, 'at the top-right corner of its own box');
  ok(box.clearsWords, 'and the box reserves that strip — it never sits on her words');
  ok(String(box.hit).indexOf('pclr') >= 0, 'a tap at its centre really reaches it');
  await page.click(cellOf(1) + ' .pclr');
  await page.waitForFunction(() => !document.querySelectorAll('#panelgrid textarea')[1].value);
  ok((await vals()).join('|') === 'a fox||a boat|a key', 'it wipes THAT box and no other');
  ok(!(await page.isVisible('#ask.on')), 'and asks nothing — one box is one sentence');
  ok(!(await page.isVisible(cellOf(1) + ' .pclr')), 'it leaves with the last word in its box');
  ok(await page.isVisible(cellOf(0) + ' .pclr'), 'while the written boxes keep theirs');
  const saved = JSON.parse((await draft(4)) || '[]');
  ok((saved[1] || '') === '', 'the draft follows');
  ok(await page.isVisible('#panelclear'), 'and the row Clear stays — three boxes still written');
  const popped = await page.evaluate(async () => {
    const cell = document.querySelector('#panelgrid .pcell');
    cell.querySelector('.pbig').click();
    await new Promise((r) => setTimeout(r, 60));
    const b = cell.querySelector('.pclr'), t = cell.querySelector('textarea');
    const br = b.getBoundingClientRect(), tr = t.getBoundingClientRect();
    const hit = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
    return { above: br.bottom <= tr.top + 1,
      hit: hit && (hit.closest ? (hit.closest('.pclr') ? 'pclr' : hit.tagName) : hit.tagName) };
  });
  ok(popped.above, 'popped, it rides above the big box instead of on her words');
  ok(String(popped.hit).indexOf('pclr') >= 0, 'and the backdrop never takes its tap');
  await page.click('#panelbg');
  await page.evaluate(() => { localStorage.removeItem('promptlab_panels_4'); });

  console.log('\nStory clears its own box');
  await page.click('#gridpick button[data-grid="story"]');
  await page.waitForFunction(() => !!document.querySelector('#panelgrid textarea[data-story]'));
  ok(!(await page.isVisible('#panelclear')), 'an empty story shows no clear');
  await page.fill('#panelgrid textarea[data-story]', 'a witch loses her cat');
  ok(await page.isVisible('#panelclear'), 'and a written one does');
  await page.click('#panelclear');
  await page.waitForSelector('#ask.on');
  await page.click('#askyes');
  await page.waitForFunction(() => {
    const t = document.querySelector('#panelgrid textarea[data-story]');
    return t && !t.value;
  });
  ok((await page.inputValue('#panelgrid textarea[data-story]')) === '', 'the story box is empty');
  ok(!(await page.evaluate(() => localStorage.getItem('promptlab_story'))), 'and so is its draft');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();
