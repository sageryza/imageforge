#!/usr/bin/env node
/*
 * test-playground-imported-run.js — A RUN FILED FROM OUTSIDE THE PAGE REACHES
 * AN ALREADY-OPEN PANELS TAB (2026-08-29, Sophie about a sheet drawn in a
 * chat's container: "is not in playground").
 *
 * The house path for a chat's panels is to draw in its OWN container and file
 * the finished run with POST /api/promptlab/panels-import ("the playground is
 * for me, but panels should go in panels"). Nothing on her page is polling
 * such a run — `landRun` only ever lands a run this page started — and the
 * PANELS gallery came from `loadPanelsSweep`, asked ONCE per page load and
 * never again. So the run was on the server, IN THIS VERY QUERY'S ANSWER, and
 * unreachable until the page itself reloaded; inside the app a tool's web view
 * is kept alive for the whole app process, so that is a force-quit. The run
 * had landed correctly and read as lost.
 *
 * THE TEST MUST NEVER RELOAD. A reload sweeps the run in on the pre-fix page
 * too, so a test that reloads passes against the bug. The only honest question
 * is whether the run appears on the page she is already standing on.
 *
 *   node scripts/test-playground-imported-run.js
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

console.log('\nthe import door really exists, and files a DONE run');
ok(/panels-import/.test(serverSrc), 'server.js mounts /api/promptlab/panels-import');
ok(fs.existsSync(path.join(ROOT, 'panels-import.js')), 'and panels-import.js is its rule');

console.log('\nthe sweep is not a one-shot any more');
const sweepSrc = pageSrc.slice(pageSrc.indexOf('  function loadPanelsSweep('),
  pageSrc.indexOf('  // One more page, behind the oldest SINGLE run'));
ok(!/if \(panelsSwept\) return;\n\s*panelsSwept = true;/.test(sweepSrc),
  'the once-per-page-load latch is gone');
ok(/panelsSweptAt/.test(pageSrc) && /PANELS_RESWEEP/.test(pageSrc),
  'a throttle stands in for it, so a repeated tap is still one query');
ok(/visibilitychange[\s\S]{0,400}onPanels\(\)[\s\S]{0,60}loadPanelsSweep\(true\)/.test(pageSrc),
  'and coming back to the tool re-asks while she is on the panels tab');
ok(/pointerdown[\s\S]{0,120}onPanels\(\)[\s\S]{0,40}loadPanelsSweep\(\)/.test(pageSrc)
  && /pointerdown[\s\S]{0,600}\}, true\)/.test(pageSrc),
  'and so does her first tap, on capture — the app never fires visibilitychange on a tool switch');

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
}

// The container-drawn sheet, filed by panels-import while her page sits open.
// It is DONE the moment it exists — no 'running', nothing to poll.
const IMPORTED = {
  id: 'imported1', status: 'done', engine: 'gptimage', imported: true,
  prompt: 'sage / roommates / dancers / applause',
  panels: ['sage', 'roommates', 'dancers', 'applause'],
  grid: { across: 2, down: 2, count: 4 },
  model: 'gpt-image-2', gptStyle: 'dreamy', quality: 'medium', size: '2880x2880',
  aspectRatio: '1:1', res: '4k', sheet: '2880x2880', cell: '1440x1440',
  images: ['/shot.png', '/shot.png', '/shot.png', '/shot.png'],
  sheetUrl: '/shot.png', chat: 'a-chat-that-is-not-this-page', createdAt: now,
};
let filed = false;          // flipped mid-test: the import lands on the server
let panelQueries = 0;

async function run(browser) {
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/shot.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(PNG);
    }
    if (url.pathname === '/api/story/thumb') {
      res.writeHead(302, { Location: '/shot.png' });
      return res.end();
    }
    if (url.pathname === '/api/promptlab' && req.method !== 'POST') {
      const kind = url.searchParams.get('kind');
      if (kind === 'panels') panelQueries++;
      const all = OLD.concat(filed ? [IMPORTED] : []);
      const runs = kind === 'panels' ? all.filter((r) => r.panels)
        : kind === 'single' ? all.filter((r) => !r.panels) : all;
      runs.sort((a, b) => b.createdAt - a.createdAt);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs, more: false }));
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

  const cells = () => page.evaluate(() => document.querySelectorAll(
    '#runs img[data-run="imported1"]').length);
  const until = async (fn, ms) => {
    for (let i = 0; i < Math.ceil((ms || 8000) / 200); i++) {
      const n = await cells();
      if (fn(n)) return n;
      await page.waitForTimeout(200);
    }
    return cells();
  };

  console.log('\nshe is on the panels tab, before the chat has drawn anything');
  await page.click('#t-panels');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length > 0);
  await page.waitForTimeout(600);
  ok((await cells()) === 0, 'the imported run is not on screen — it does not exist yet');
  const sweptOnce = panelQueries;
  ok(sweptOnce >= 1, 'the tab swept its gallery on the way in');

  console.log('\nthe chat files it — a DONE run, with no poll of hers behind it');
  filed = true;
  await page.waitForTimeout(1500);
  ok((await cells()) === 0,
    'nothing on the page is tracking it, so it does not arrive on its own');

  console.log('\ncoming back to the tool re-asks');
  // The app keeps the web view alive, so this — not a reload — is what really
  // happens when she opens the Playground again.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const landed = await until((n) => n === 4, 8000);
  ok(landed === 4, 'the four panels are on the tab she was already standing on ('
    + landed + ' cells)');
  ok(panelQueries > sweptOnce, 'because the sweep really re-asked the server');

  console.log('\nand the throttle keeps a repeated tap to one query');
  const before = panelQueries;
  for (let i = 0; i < 4; i++) {
    await page.click('#t-picture');
    await page.click('#t-panels');
  }
  await page.waitForTimeout(600);
  ok(panelQueries === before,
    'four round trips through the tab added no queries (' + (panelQueries - before) + ')');
  ok((await cells()) === 4, 'and the run is still on screen');

  console.log('\na TAP on dead space re-asks — the app fires no visibilitychange on a tool switch');
  // A second import lands while she is parked on the tab. Nothing flips
  // visibility here on purpose: inside the app the ZStack only toggles a
  // tool's opacity, so the flip above never happens — her first tap is the
  // one event that always does. The tap goes to MEASURED dead space, never a
  // coordinate guessed at: a tap that happens to land on the tab row calls
  // syncTab, which sweeps on its own, and the test would pass against a page
  // with no tap listener at all (it did, at (0,0), before this was measured).
  // The throttle is shrunk rather than waited out (PANELS_RESWEEP is a
  // top-level var, so it is on window).
  OLD.push({ ...IMPORTED, id: 'imported2', createdAt: now + 1000 });
  await page.evaluate(() => { PANELS_RESWEEP = 200; });
  await page.waitForTimeout(300);
  const tapCells = () => page.evaluate(() => document.querySelectorAll(
    '#runs img[data-run="imported2"]').length);
  ok((await tapCells()) === 0, 'the second import is not on screen yet');
  const spot = await page.evaluate(() => {
    // Walk down the left margin for a point whose element is not a control —
    // body, a wrapper, a bare div. The cards and rows all start further in.
    for (let y = 60; y < 800; y += 20) {
      const e = document.elementFromPoint(3, y);
      if (!e) continue;
      if (e.closest('button,a,input,textarea,select,label,[onclick]')) continue;
      return { x: 3, y, tag: e.tagName + (e.id ? '#' + e.id : '') };
    }
    return null;
  });
  ok(!!spot, 'a dead spot exists to tap (' + (spot && spot.tag) + ')');
  await page.mouse.click(spot.x, spot.y);
  let landed2 = 0;
  for (let i = 0; i < 40; i++) {
    landed2 = await tapCells();
    if (landed2 === 4) break;
    await page.waitForTimeout(200);
  }
  const stillPanels = await page.evaluate(() =>
    document.getElementById('t-panels').classList.contains('on'));
  ok(stillPanels, 'the tap changed no tab — it really was dead space');
  ok(landed2 === 4,
    'one tap, no visibility flip, and it is on screen (' + landed2 + ' cells)');

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
