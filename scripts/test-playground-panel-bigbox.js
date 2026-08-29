#!/usr/bin/env node
/*
 * test-playground-panel-bigbox.js — every panel box expands
 * (2026-08-29, Sophie: "can u add a expand button per text box in each panel").
 *
 * #bigprompt's answer, one per cell. Everything here is a MEASUREMENT or a
 * real tap, because the whole feature is what a box looks like on screen:
 *
 *   - every panel box carries its own corner button, inside its own cell
 *   - the button is really reachable (elementFromPoint, not isVisible)
 *   - big SPANS THE WHOLE ROW and fits the words between the floor and cap
 *   - typing while big grows the box under the dictation
 *   - a big box is still the ONE textarea — Generate reads her words from it
 *   - the toggle back really shrinks (the height:auto lesson)
 *   - a grid rebuild opens everything small — not sticky, by design
 *
 *   node scripts/test-playground-panel-bigbox.js
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

(async () => {
  const posted = [];
  const nine = ['a fox', 'a moon', 'a boat', 'a key', 'a well', 'a crow', 'a comb', 'a bell', 'a door'];
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
  catch { console.log('\n(skipped — npm install playwright --no-save)'); server.close(); process.exit(fails ? 1 : 0); }
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }

  const vp = { width: 390, height: 844 };
  const page = await browser.newPage({ viewport: vp });
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#plabtabs button').length === 2);
  await page.click('#t-panels');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length > 0);
  await page.click('#gridpick button[data-grid="9"]');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length === 9);

  console.log('a button on every box');
  const counts = await page.evaluate(() => {
    const cells = document.querySelectorAll('#panelgrid .pcell');
    let inside = 0;
    cells.forEach((c) => {
      const b = c.querySelector('.pbig'), t = c.querySelector('textarea');
      if (!b || !t) return;
      const cr = c.getBoundingClientRect(), br = b.getBoundingClientRect();
      if (br.left >= cr.left && br.right <= cr.right + 1 && br.bottom <= cr.bottom + 1) inside++;
    });
    return { cells: cells.length, buttons: document.querySelectorAll('#panelgrid .pbig').length, inside };
  });
  ok(counts.cells === 9 && counts.buttons === 9, 'nine cells, nine buttons');
  ok(counts.inside === 9, 'each button drawn inside its own cell');
  // A middle cell's button really takes the tap — a covered control passes
  // every width assertion while failing.
  const reach = await page.evaluate(() => {
    const b = document.querySelectorAll('#panelgrid .pbig')[4];
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return b === hit || b.contains(hit);
  });
  ok(reach, 'and the tap reaches it (elementFromPoint)');

  console.log('\nexpanding');
  for (let i = 0; i < 9; i++) await page.fill('#panelgrid textarea[data-panel="' + i + '"]', nine[i]);
  const small = await page.evaluate(() => {
    const t = document.querySelectorAll('#panelgrid textarea')[4];
    const r = t.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  await page.evaluate(() => document.querySelectorAll('#panelgrid .pbig')[4].click());
  const big = await page.evaluate(() => {
    const c = document.querySelectorAll('#panelgrid .pcell')[4];
    const t = c.querySelector('textarea');
    const g = document.getElementById('panelgrid').getBoundingClientRect();
    const r = t.getBoundingClientRect();
    return { big: c.classList.contains('big'), w: r.width, h: r.height, gw: g.width, vh: window.innerHeight };
  });
  ok(big.big, 'the tap marks the cell big');
  ok(big.w > small.w * 2 && Math.abs(big.w - big.gw) < 2,
    'big spans the whole row — a third-of-the-screen cell taller is not bigger');
  ok(big.h >= big.vh * 0.19, 'with the floor holding room to write before the words exist');
  // The cell's aspect is DROPPED: full-width at the cell's own ratio would be
  // ~40vh+ (square) or the 46vh cap (2:3); a short line fits at the floor.
  ok(big.h <= big.vh * 0.22, 'and no taller than the words need — the cell aspect is dropped');

  console.log('\nit grows under her words, and Generate still reads them');
  const longText = nine[4] + ' ' + 'and then a long dictated line about what happens in this panel, '.repeat(8);
  await page.fill('#panelgrid textarea[data-panel="4"]', longText);
  const grown = await page.evaluate(() => {
    const t = document.querySelectorAll('#panelgrid textarea')[4];
    return { h: t.getBoundingClientRect().height, scrolls: t.scrollHeight > t.clientHeight + 2, vh: window.innerHeight };
  });
  ok(grown.h > big.h + 30, 'typing while big grows the box');
  ok(grown.h <= grown.vh * 0.47, 'clamped at the cap');
  ok(!grown.scrolls || grown.h >= grown.vh * 0.45,
    'and it only scrolls once the cap is really spent');
  posted.length = 0;
  await page.click('#go');
  await page.waitForTimeout(300);
  const sent = posted[0] && posted[0].panels;
  // The run trims each panel on the way out, so compare trimmed.
  ok(posted.length === 1 && sent && sent[4] === longText.trim() && sent[0] === nine[0],
    'a big box is still THE box — the run carries the words in it');

  console.log('\nshrinking back');
  await page.evaluate(() => document.querySelectorAll('#panelgrid .pbig')[4].click());
  const back = await page.evaluate(() => {
    const c = document.querySelectorAll('#panelgrid .pcell')[4];
    const t = c.querySelector('textarea');
    return { big: c.classList.contains('big'), w: t.getBoundingClientRect().width, inline: t.style.height };
  });
  ok(!back.big && Math.abs(back.w - small.w) < 2, 'the second tap really shrinks it back to its column');
  ok(back.inline === '', 'with the fitted inline height cleared, not left behind');

  console.log('\nnot sticky');
  await page.evaluate(() => document.querySelectorAll('#panelgrid .pbig')[2].click());
  await page.click('#gridpick button[data-grid="4"]');
  await page.waitForFunction(() => !document.getElementById('askpop') || document.querySelector('#askpop button') || true);
  // The carry pop-up may ask about the words; take whatever lands us on the 4-grid.
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button'))
      .find((x) => x.offsetParent && /bring|keep/i.test(x.textContent || ''));
    if (b) b.click();
  });
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length === 4);
  const fresh = await page.evaluate(() =>
    document.querySelectorAll('#panelgrid .pcell.big').length);
  ok(fresh === 0, 'a grid rebuild opens everything small — the compact grid is the tab\'s shape');

  await page.close();
  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FAIL (harness):', e); process.exit(1); });
