#!/usr/bin/env node
/*
 * test-playground-panels.js — the Playground's PANELS tab (Aug 2026, Sophie:
 * "we make a picture and cut it into panels either 24 or nine panels and
 * describe each panel individually … it could be a feature or Hairline tab in
 * the playground itself").
 *
 * Source half, always runs: the POST route has the panels branch, the cut is
 * sequential/lossless/cache-off, the paid sheet is banked BEFORE the cut, the
 * vote cap fits a 9-panel run, the styles route serves the geometry, every
 * cut panel files with the '1/9 (4K)' size slot, and the page holds no copy
 * of the grid sentence.
 *
 * Page half, headless Chromium against the real promptlab.html with the REAL
 * served geometry (sheet-grid.js over the real PL_GPT.res literal):
 *   - the tab row, and the boxes ARE the grid (measured rects, not markup)
 *   - boxes ship empty with name-only placeholders
 *   - an empty box refuses Generate with the count in the error and NO POST
 *   - a full Generate POSTs panels/grid/res/canvas/quality exactly
 *   - her words survive a grid switch (9 → 4 → 9)
 *   - a done panels run renders N cells with the 'panels 3x3' tag, and the
 *     lightbox captions 'panel N of K' with THAT panel's own words
 *   - the copy button refills the panel boxes on the Panels tab
 *   - the grid picker is reachable via elementFromPoint (the pill collision
 *     question, asked the only honest way)
 *
 *   node scripts/test-playground-panels.js
 *   (page half needs: npm install playwright --no-save)
 */
'use strict';
const fs = require('fs');
const servePublic = require('./lib/public-asset');
const path = require('path');
const http = require('http');

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

console.log('the server wiring');
ok(/Array\.isArray\(req\.body\.panels\)/.test(serverSrc), 'the POST route has a panels branch');
ok(/function runPromptLabPanelsJob/.test(serverSrc), 'the panels job exists');
const cutSrc = serverSrc.slice(serverSrc.indexOf('async function cutSheet('),
  serverSrc.indexOf('async function runPromptLabPanelsJob'));
ok(/sharp\.cache\(false\)/.test(cutSrc), 'the cut turns the sharp cache OFF (512MB box)');
ok(/webp\(\{ lossless: true \}\)/.test(cutSrc), 'panels are cut LOSSLESS');
ok(/for \(const r of rects\)/.test(cutSrc) && !/Promise\.all/.test(cutSrc),
  'the crops run SEQUENTIALLY, never Promise.all');
ok(/sheetGrid\.findSeams\(/.test(cutSrc) && /sheetGrid\.seamBoxes\(/.test(cutSrc),
  'the cut is IMAGE-AWARE — mid-gutter seams, math as the fallback');
ok(/canvas: r \? `\$\{r\.width\}x\$\{r\.height\}` : plan\.cell/.test(serverSrc),
  "each panel files its REAL post-seam canvas");
const jobSrc = serverSrc.slice(serverSrc.indexOf('async function runPromptLabPanelsJob'),
  serverSrc.indexOf('async function runPromptLabJob'));
ok(jobSrc.indexOf('sheetUrl') < jobSrc.indexOf('cutSheet(sheetBuf'),
  'the paid sheet is banked BEFORE the cut');
ok(/cutFailed: true/.test(jobSrc), 'a failed cut keeps the sheet as the picture, disclosed');
ok(/sizeTier\.cutSize\(plan\.sheet, plan\.count\)/.test(jobSrc),
  "every cut panel files with the '1/9 (4K)' slot");
ok(/sizeSlot: cut/.test(jobSrc), 'through fileCreationDoc\'s sizeSlot override');
ok(/i > 24/.test(serverSrc) && !/i > 3\)/.test(serverSrc),
  'the vote cap fits a panels run (0-24, was 0-3)');
ok(/panels\.grids\[g\]/.test(serverSrc) || /panels: \{ grids/.test(serverSrc)
  || /const panels = \{ grids/.test(serverSrc),
  'the styles route serves the panels geometry');
// The page copies no geometry and no prompt wording of its own.
ok(pageSrc.indexOf('equal rectangles') < 0, 'promptlab.html holds NO copy of the grid sentence');
ok(pageSrc.indexOf('top middle') < 0, 'and no copy of the cell names');

// The two haystacks stay in step: both list the panels then the grid tag.
ok(/\.\.\.\(r\.panels \|\| \[\]\)/.test(serverSrc)
  && /r\.grid && r\.grid\.count \? `panels \$\{r\.grid\.across\}x\$\{r\.grid\.down\}` : ''/.test(serverSrc),
  'promptlabHay lists the panel words and the grid');
ok(/\.concat\(r\.panels \|\| \[\]\)/.test(pageSrc), 'runHay mirrors it');

// ── the real page ────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

// The REAL served geometry — computed exactly the way the styles route does.
function panelsPayload() {
  const panels = { grids: {}, sheets: {} };
  Object.keys(sheetGrid.GRIDS).forEach((g) => {
    panels.grids[g] = {
      ...sheetGrid.GRIDS[g],
      count: sheetGrid.GRIDS[g].across * sheetGrid.GRIDS[g].down,
      positions: sheetGrid.positions(g),
      layout: sheetGrid.layoutWords(g),
      sentence: sheetGrid.panelBlock(g, []),
    };
  });
  Object.keys(sheetGrid.SHAPES).forEach((shape) => {
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

(async () => {
  const posted = [];
  const nine = ['a fox', 'a moon', 'a boat', 'a key', 'a well', 'a crow', 'a comb', 'a bell', 'a door'];
  const doneRun = {
    id: 'r9', status: 'done', engine: 'gptimage', gptStyle: 'dreamy', model: 'gpt-image-2',
    prompt: nine.join(' / '),
    fullPrompt: 'PREFIX\n\ngrid sentence\n' + nine.map((t, i) => `Panel ${i + 1} (x): ${t}`).join('\n') + '\n\nTAIL',
    quality: 'low', size: '2304x3456', aspectRatio: '2:3', res: '4k',
    panels: nine, grid: { across: 3, down: 3, count: 9 },
    sheet: '2304x3456', cell: '768x1152',
    images: nine.map((_, i) => 'http://127.0.0.1:0/img/p' + i + '.png').map((u) => u),
    createdAt: Date.now() - 60000,
  };
  // 1x1 webp for every image the page asks for.
  const PIXEL = Buffer.from(
    'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
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
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#plabtabs button').length === 2);

  console.log('the tab row');
  ok(await page.isVisible('#plabtabs'), 'PICTURE · PANELS is on screen');
  ok(/\bon\b/.test(await page.getAttribute('#t-picture', 'class') || ''), 'PICTURE is the default');
  ok(await page.isVisible('.promptwrap'), 'the one prompt box shows on PICTURE');
  ok(!(await page.isVisible('#panelgrid')), 'and the panel grid does not');

  await page.click('#t-panels');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length > 0);
  ok(!(await page.isVisible('.promptwrap')), 'PANELS: the one box steps aside');
  ok(!(await page.isVisible('#lowmed')) && !(await page.isVisible('#medhigh')),
    'the ladders come off (a ladder on a sheet is several sheets)');
  ok(!(await page.isVisible('#photowrap button')), 'the photo ref comes off');
  // The measured underline sits under the lit tab.
  const line = await page.evaluate(() => {
    const row = document.getElementById('plabtabs');
    const on = document.getElementById('t-panels').getBoundingClientRect();
    return { tx: parseFloat(row.style.getPropertyValue('--tx')), left: on.left - row.getBoundingClientRect().left, tw: parseFloat(row.style.getPropertyValue('--tw')), w: on.width };
  });
  ok(Math.abs(line.tx - line.left) < 2 && Math.abs(line.tw - line.w) < 2,
    'the hairline underline is MEASURED under the lit tab');

  console.log('the boxes are the grid');
  const boxes4 = await page.$$eval('#panelgrid textarea', (ts) => ts.map((t) => {
    const r = t.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), v: t.value, ph: t.placeholder };
  }));
  ok(boxes4.length === 4, 'the default grid is 4 boxes');
  ok(new Set(boxes4.map((b) => b.x)).size === 2 && new Set(boxes4.map((b) => b.y)).size === 2,
    'laid out 2x2 — measured, not markup');
  ok(boxes4.every((b) => !b.v), 'boxes ship EMPTY');
  ok(boxes4[0].ph === 'top left' && boxes4[3].ph === 'bottom right',
    'placeholders NAME the cell and nothing more');

  // The grid picker: 2 · 4 · 9, reachable, and 9 reshapes the boxes.
  const pickHit = await page.evaluate(() => {
    const b = document.querySelector('#gridpick button[data-grid="9"]');
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el === b || b.contains(el);
  });
  ok(pickHit, 'the grid picker is reachable (elementFromPoint)');
  await page.click('#gridpick button[data-grid="9"]');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length === 9);
  const boxes9 = await page.$$eval('#panelgrid textarea', (ts) => ts.map((t) => Math.round(t.getBoundingClientRect().left)));
  ok(new Set(boxes9).size === 3, '9 boxes sit 3 across');

  console.log('generate');
  // Fill six of nine — the refusal must count the empty ones and POST nothing.
  for (let i = 0; i < 6; i++) await page.fill('#panelgrid textarea[data-panel="' + i + '"]', nine[i]);
  await page.click('#go');
  await page.waitForFunction(() => !document.getElementById('err').hidden);
  ok(/3 panels still need words/.test(await page.textContent('#err')),
    'an empty box refuses with the COUNT in the error');
  ok(posted.length === 0, 'and nothing was POSTed');
  for (let i = 6; i < 9; i++) await page.fill('#panelgrid textarea[data-panel="' + i + '"]', nine[i]);
  await page.click('#go');
  await page.waitForFunction(() => document.querySelectorAll('#pendings .cell').length > 0);
  ok(posted.length === 1, 'a full grid POSTs once');
  const b = posted[0] || {};
  ok(Array.isArray(b.panels) && b.panels.length === 9 && b.panels[0] === 'a fox',
    'the POST carries all nine panels');
  ok(b.grid === 9 && b.style && b.quality && b.res && b.canvas,
    'with the grid, style, quality, tier and canvas');
  ok(b.prompt === nine.join(' / '), 'and the joined prompt for the feed');
  ok((await page.$$eval('#pendings .cell', (c) => c.length)) === 9,
    'the pending card holds nine breathing placeholders');

  console.log('her words survive a grid switch');
  await page.click('#gridpick button[data-grid="4"]');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length === 4);
  await page.click('#gridpick button[data-grid="9"]');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length === 9);
  const back = await page.$$eval('#panelgrid textarea', (ts) => ts.map((t) => t.value));
  ok(back.join('|') === nine.join('|'), '9 → 4 → 9 loses nothing');

  console.log('the feed');
  const runCells = await page.$$eval('#runs .run', (runs) => runs.map((r) => ({
    cells: r.querySelectorAll('.grid img').length,
    tags: Array.prototype.map.call(r.querySelectorAll('.tag'), (t) => t.textContent),
  })));
  const panelsRun = runCells.find((r) => r.cells === 9);
  ok(!!panelsRun, 'the done panels run renders its nine cut panels');
  ok(panelsRun && panelsRun.tags.indexOf('panels 3x3') >= 0, "tagged 'panels 3x3'");

  console.log('the lightbox');
  await page.click('#runs img[data-run="r9"][data-i="3"]');
  await page.waitForFunction(() => {
    const el = document.getElementById('clightbox');
    return el && el.style.display !== 'none';
  });
  const lbText = await page.evaluate(() => document.getElementById('clightbox').textContent);
  ok(/panel 4 of 9/.test(lbText), "the caption says 'panel 4 of 9'");
  // The prompt door opens on CONTENT = that panel's own words.
  const lbHas = await page.evaluate(() => {
    const el = document.getElementById('clightbox');
    const btns = el.querySelectorAll('button');
    for (const bt of btns) if (/prompt/i.test(bt.textContent)) { bt.click(); break; }
    return document.getElementById('clightbox').textContent;
  });
  ok(/a key/.test(lbHas), "and the prompt shows THAT panel's own words");
  await page.evaluate(() => { if (window.__assetLightboxClose) window.__assetLightboxClose(); });

  console.log('the copy button');
  // Wipe the boxes, then ask the run's copy button to refill them.
  await page.evaluate(() => {
    ['promptlab_panels_9', 'promptlab_panels_4'].forEach((k) => localStorage.removeItem(k));
    document.querySelectorAll('#panelgrid textarea').forEach((t) => { t.value = ''; });
  });
  await page.click('#runs .run .copybtn[data-copy="r9"]');
  await page.waitForFunction(() => {
    const ts = document.querySelectorAll('#panelgrid textarea');
    return ts.length === 9 && ts[0].value === 'a fox';
  });
  ok(true, 'the copy button refills the nine boxes');
  ok(/\bon\b/.test(await page.getAttribute('#t-panels', 'class') || ''), 'on the Panels tab');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FAIL (harness):', e); process.exit(1); });
