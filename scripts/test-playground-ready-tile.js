#!/usr/bin/env node
/*
 * test-playground-ready-tile.js — A RUN THAT STOPS DRAWING LANDS IN ITS OWN
 * GALLERY (2026-08-28, Sophie on the PANELS tab: "the tile appears and then
 * disappears").
 *
 * The poll drops the "drawing…" placeholder the moment a run reaches 'ready'
 * and asked `loadRuns()` for the real run — but loadRuns only ever fetches
 * kind=single, and the PANELS gallery comes from `loadPanelsSweep`, asked
 * ONCE per page load. So on that tab the placeholder came down and nothing
 * replaced it: the tile vanished and stayed vanished until the page itself
 * was reloaded, which inside the app can be the whole app process.
 *
 * It also meant the UNCUT SHEET could never show while the cut was queued —
 * `cuttingSheet` was built for her 2026-08-27 ask ("the uncut sheet shud show
 * before it's cut as soon as it's done") and at 'ready' the run reached the
 * feed on neither tab, so the cell had nothing to render from.
 *
 * THE TILE HAS TO BE COUNTED AT EVERY STEP, not at the end: a test that looks
 * only once the run is 'done' passes against the pre-fix page, because the
 * next page load sweeps the run in. The bug is the GAP.
 *
 *   node scripts/test-playground-ready-tile.js
 *   (needs: npm install playwright --no-save)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const sheetGrid = require(path.join(ROOT, 'sheet-grid.js'));
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const pageSrc = fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

console.log('\nthe server really parks a panels run on ready with a banked sheet');
ok(/await docRef\.update\(\{ sheetUrl, status: 'ready'/.test(serverSrc),
  'the sheet is banked and the run says ready BEFORE the cut');
ok(/finishPanelsCut\(docRef, cfg, sheetBuf, sheetUrl\)/.test(serverSrc),
  'and the cut runs after it — behind gateCut, so the gap can be long');

console.log('\nthe poll lands the doc it is holding, rather than re-asking one gallery');
const pollSrc = pageSrc.slice(pageSrc.indexOf('  function poll()'),
  pageSrc.indexOf('  function startSwapPolling()'));
ok(/landRun\(d\)/.test(pollSrc) && !/loadRuns\(\)/.test(pollSrc),
  'poll() calls landRun(d), never loadRuns() — which only knows kind=single');
const swapSrc = pageSrc.slice(pageSrc.indexOf('  function startSwapPolling()'),
  pageSrc.indexOf('  function runImages('));
ok(/landRun\(d\)/.test(swapSrc) && !/loadRuns\(\)/.test(swapSrc),
  'and so does the swap poller, for the same reason');

// The real `res` literal out of server.js — never a second copy.
function resTable() {
  const i = serverSrc.indexOf('\n  res: {');
  const b = serverSrc.slice(i + '\n  res: '.length);
  let lit = b.slice(0, b.indexOf('\n  },') + 4).trim().replace(/,$/, '');
  lit = lit.replace(/^\s*\/\/.*$/gm, '');
  return eval('(' + lit + ')');                        // eslint-disable-line no-eval
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

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAFklEQVQIW2P8z8Dwn4EIwDiqkL4KAdxlBAXWfaGiAAAAAElFTkSuQmCC',
  'base64');

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  try { ({ chromium } = require('playwright-core')); } catch (__) {
    console.log('\n(page half skipped — npm install playwright --no-save)');
    process.exit(fails ? 1 : 0);
  }
}
function exe() {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  if (fs.existsSync(path.join(root, 'chromium'))) return path.join(root, 'chromium');
  for (const d of fs.readdirSync(root).filter((n) => /^chromium-\d/.test(n))) {
    const p = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const now = Date.now();
const OLD = [];
for (let i = 0; i < 3; i++) {
  OLD.push({
    id: 'pan' + i, status: 'done', engine: 'gptimage',
    prompt: 'old / panels / run / here', panels: ['old', 'panels', 'run', 'here'],
    grid: { across: 2, down: 2, count: 4 },
    model: 'gpt-image-2', gptStyle: 'dreamy', quality: 'low', size: '1024x1024',
    aspectRatio: '1:1', res: '1k', sheet: '1024x1024', cell: '512x512',
    images: ['/shot.png', '/shot.png', '/shot.png', '/shot.png'],
    sheetUrl: '/shot.png', createdAt: now - 100000 - i * 1000,
  });
  OLD.push({
    id: 'sing' + i, status: 'done', engine: 'gptimage',
    prompt: 'an old single picture ' + i, model: 'gpt-image-2', gptStyle: 'dreamy',
    quality: 'low', size: '1024x1536', aspectRatio: '2:3', res: '1k', outputs: 1,
    images: ['/shot.png'], createdAt: now - 100000 - i * 1000 - 500,
  });
}

// The run she is watching, walked through the real three states by the test.
const FRESH = {
  id: 'fresh1', engine: 'gptimage',
  prompt: 'pizzas / picnic / puzzle / test',
  panels: ['pizzas', 'picnic', 'puzzle', 'test'],
  grid: { across: 2, down: 2, count: 4 },
  model: 'gpt-image-2', gptStyle: 'dreamy', quality: 'low', size: '1024x1024',
  aspectRatio: '1:1', res: '1k', sheet: '1024x1024', cell: '512x512',
  createdAt: now,
};
let phase = 'running';
function freshDoc() {
  if (phase === 'running') return { ...FRESH, status: 'running' };
  // The sheet is banked and the run parks — no panels yet, the cut is queued.
  if (phase === 'ready') return { ...FRESH, status: 'ready', sheetUrl: '/shot.png' };
  return { ...FRESH, status: 'done', sheetUrl: '/shot.png',
           images: ['/shot.png', '/shot.png', '/shot.png', '/shot.png'] };
}

async function run(browser) {
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/shot.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(PNG);
    }
    // The thumb service 302s to the original; the test serves the picture.
    if (url.pathname === '/api/story/thumb') {
      res.writeHead(302, { Location: '/shot.png' });
      return res.end();
    }
    if (url.pathname === '/api/promptlab' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ id: 'fresh1' }));
    }
    if (url.pathname === '/api/promptlab') {
      const kind = url.searchParams.get('kind');
      // Exactly what the server does: a kind-filtered page of the whole
      // collection, the live run included once it is past 'running'.
      const all = OLD.concat(phase === 'running' ? [] : [freshDoc()]);
      const runs = kind === 'panels' ? all.filter((r) => r.panels)
        : kind === 'single' ? all.filter((r) => !r.panels) : all;
      runs.sort((a, b) => b.createdAt - a.createdAt);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs, more: false }));
    }
    if (url.pathname === '/api/promptlab/fresh1') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(freshDoc()));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        styles: {
          dreamy: { label: 'Dreamy', prefix: 'P ', suffix: ' S',
                    characterLine: '', refs: [] },
        },
        sizes: {}, res: RES, resDefault: '1k', max: 4000, photoLine: '',
        panels: panelsPayload(),
      }));
    }
    if (url.pathname.indexOf('/api/') === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('{}');
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { localStorage.setItem('promptlab_view', 'list'); } catch (e) {}
  });
  await page.goto(base + '/playground', { waitUntil: 'load' });
  await page.waitForTimeout(400);

  // What is on screen FOR THIS RUN, whichever shape it is wearing: the
  // waiting placeholder, the uncut sheet, or the four cut panels. Counted the
  // same way at every step, because the bug is a gap between them.
  const showing = () => page.evaluate(() => {
    const pend = document.getElementById('pendings');
    const runs = document.getElementById('runs');
    const cells = Array.from(runs.querySelectorAll('img[data-run="fresh1"]'));
    return {
      waiting: /drawing/i.test(pend.textContent || '') && !pend.hidden,
      cells: cells.length,
      sheetCell: cells.filter((c) => c.getAttribute('data-i') === '-1').length,
      tag: /cutting/i.test(runs.textContent || ''),
      anything: (/drawing/i.test(pend.textContent || '') && !pend.hidden) || cells.length > 0,
    };
  });
  // The poll runs every 2s and the swap poller every 5s — give a transition
  // enough room to be seen, and report what really landed.
  const until = async (fn, ms) => {
    for (let i = 0; i < Math.ceil((ms || 9000) / 200); i++) {
      const s = await showing();
      if (fn(s)) return s;
      await page.waitForTimeout(200);
    }
    return showing();
  };

  console.log('\nstarting a panels run');
  await page.click('#t-panels');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length > 0);
  await page.click('#gridpick button[data-grid="4"]');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length === 4);
  const words = ['pizzas', 'picnic', 'puzzle', 'test'];
  for (let i = 0; i < 4; i++) {
    await page.fill('#panelgrid textarea[data-panel="' + i + '"]', words[i]);
  }
  await page.evaluate(() => document.getElementById('go').click());
  const drawing = await until((s) => s.waiting, 4000);
  ok(drawing.waiting, 'the "drawing…" placeholder is up while it renders');

  console.log('\nthe sheet is banked — the run parks on ready, the cut is queued');
  phase = 'ready';
  const readyState = await until((s) => s.cells > 0, 9000);
  ok(readyState.anything,
    'the tile does NOT disappear when the placeholder comes down');
  ok(readyState.cells === 1,
    'the uncut sheet stands in for the panels — ONE cell (' + readyState.cells + ')');
  ok(readyState.sheetCell === 1,
    'and it is the sheet, at the virtual index -1, so it carries its own heart');
  ok(readyState.tag, 'the run says "sheet — cutting…"');

  console.log('\nnothing blinks in between');
  // Sample continuously across the cut: at no point is the run unrepresented.
  phase = 'done';
  let gaps = 0;
  for (let i = 0; i < 45; i++) {
    const s = await showing();
    if (!s.anything) gaps++;
    if (s.cells === 4) break;
    await page.waitForTimeout(200);
  }
  ok(gaps === 0, 'the run is on screen at every sample across the cut ('
    + gaps + ' blank samples)');

  console.log('\nthe cut lands');
  const cut = await until((s) => s.cells === 4, 9000);
  ok(cut.cells === 4, 'the four panels replace the sheet (' + cut.cells + ' cells)');
  ok(!cut.tag, 'and the cutting tag is gone');
  ok(!cut.waiting, 'with no placeholder left over');

  await ctx.close();
  server.close();
}

(async () => {
  const p = exe();
  const browser = await chromium.launch(p ? { executablePath: p } : {});
  try { await run(browser); } finally { await browser.close(); }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
  process.exit(fails ? 1 : 0);
})();
