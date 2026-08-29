#!/usr/bin/env node
/*
 * test-playground-panel-carry.js — her words come with her when she changes
 * the panels grid (2026-08-29, Sophie: "right now in panels if there's text in
 * one of the grids if I transferred to that grid, my words don't transfer.
 * They should transfer, but if the text that was saved as a draft has never
 * been drawn trigger a pop-up").
 *
 * Every assertion is driven through the REAL page, because the whole feature
 * is a decision made at the moment of a tap — a source assertion cannot tell
 * a carry from a grid that happened to hold the same words, and it cannot see
 * a pop-up that never opened.
 *
 * The rules under test:
 *   - grid → grid carries her words into the boxes she is arriving at
 *   - the grid she LEFT keeps its own copy, so nothing is ever destroyed
 *   - silent when there is nothing to lose: the target is empty, it already
 *     says the same thing, or what it says has been DRAWN
 *   - a target holding words that were NEVER drawn stops and asks
 *   - "Keep what's there" still takes her to the grid she tapped
 *   - Story is out of it, both directions
 *
 *   node scripts/test-playground-panel-carry.js
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
ok(/savePanelsDrawn\(g, texts\)/.test(pageSrc),
  'a panels run stamps the exact words it drew, per grid');
ok(/function askOpen\(o\)/.test(pageSrc) && (pageSrc.match(/classList\.add\('on'\)/g) || []).length >= 1,
  'the confirm box takes its words per opening — one box, not a second copy');

(async () => {
  const posted = [];
  const A = ['a fox', 'a moon', 'a boat', 'a key'];
  const B = ['a crow', 'a comb', 'a bell', 'a door', 'a well', 'a hat', 'a cat', 'a dog', 'a pin'];
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
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#plabtabs button').length === 2);
  await page.click('#t-panels');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length > 0);

  const boxes = () => page.$$eval('#panelgrid textarea', (t) => t.map((x) => x.value));
  const asking = () => page.isVisible('#ask');
  const pick = async (g) => { await page.click('#gridpick button[data-grid="' + g + '"]'); await page.waitForTimeout(120); };
  const fill = async (arr) => {
    for (let i = 0; i < arr.length; i++) {
      await page.fill('#panelgrid textarea[data-panel="' + i + '"]', arr[i]);
    }
  };
  const stored = (key) => page.evaluate((k) => localStorage.getItem(k), key);

  console.log('\nthe carry itself');
  await pick(4);
  await fill(A);
  await pick(9);
  ok(!(await asking()), 'an EMPTY target takes her words with no question');
  ok(JSON.stringify(await boxes()) === JSON.stringify(A.concat(['', '', '', '', ''])),
    'her four words land in the first four cells of the nine');

  console.log('\nnothing is destroyed');
  ok(JSON.parse(await stored('promptlab_panels_4') || '[]').join('|') === A.join('|'),
    'the grid she LEFT still holds its own copy');
  await pick(4);
  ok(!(await asking()),
    'and going back asks nothing — the target already says the same thing');
  ok(JSON.stringify(await boxes()) === JSON.stringify(A), 'her four words are still there');

  console.log('\nan UNDRAWN draft stops and asks');
  await pick(9);
  await fill(B);                                     // nine of her own, never drawn
  await pick(4);                                     // grid 4's A was never drawn either
  ok(await asking(), 'carrying into a grid holding undrawn words opens the pop-up');
  const fine = (await page.textContent('#askfine')) || '';
  ok(/never drawn/.test(fine), 'and it says why it is asking');
  ok(/4 panels there were/.test(fine) || /4 panels/.test(fine),
    'naming how many of hers are at stake');
  ok(/5 of yours stay behind/.test(fine),
    'and where the words that do not fit have gone (9 → 4 leaves five)');
  await page.click('#askno');
  await page.waitForTimeout(120);
  ok(!(await asking()), 'Keep what’s there closes it');
  ok((await boxes()).length === 4 && JSON.stringify(await boxes()) === JSON.stringify(A),
    'she still arrives at the grid she tapped, holding ITS words');

  console.log('\nbringing them over');
  await pick(9);
  ok(await asking(), 'the nine still holds undrawn words, so it asks again');
  await page.click('#askyes');
  await page.waitForTimeout(150);
  ok(JSON.stringify(await boxes()) === JSON.stringify(A.concat(['', '', '', '', ''])),
    'and her four replace what was there');

  console.log('\na DRAWN draft is replaced silently');
  await fill(B);
  posted.length = 0;
  await page.click('#go');
  await page.waitForTimeout(300);
  ok(posted.length === 1, 'the nine are drawn');
  ok(JSON.parse(await stored('promptlab_panels_drawn_9') || '[]').join('|') === B.join('|'),
    'and the exact words drawn are stamped against that grid');
  await pick(4);
  await page.click('#askno').catch(() => {});        // grid 4's own A is still undrawn
  await page.waitForTimeout(120);
  await pick(9);
  ok(!(await asking()),
    'now the nine holds DRAWN words, so her carry replaces them with no question');
  ok(JSON.stringify(await boxes()) === JSON.stringify(A.concat(['', '', '', '', ''])),
    'and they really were replaced');

  console.log('\nnothing to carry');
  await fill(['', '', '', '', '', '', '', '', '']);
  await pick(4);                                     // grid 4 still holds her A
  ok(!(await asking()), 'empty boxes ask nothing — there is nothing to lose');
  ok(JSON.stringify(await boxes()) === JSON.stringify(A),
    'and they carry no blanks over the draft that is waiting there');

  console.log('\nStory is out of it, both directions');
  await pick('story');
  ok(!(await asking()), 'a grid → Story never asks');
  const st = await page.$eval('#panelgrid textarea[data-story]', (t) => t.value);
  ok(!st, 'and her panel words are not poured into the story box');
  await page.fill('#panelgrid textarea[data-story]', 'a witch loses her cat');
  await pick(9);
  ok(!(await asking()), 'Story → a grid never asks');
  ok(!/witch/.test((await boxes()).join(' ')), 'and the story is not split across the cells');

  await page.close();
  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FAIL (harness):', e); process.exit(1); });
