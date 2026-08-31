#!/usr/bin/env node
/*
 * test-playground-panel-bigbox.js — every panel box expands, as a POPUP
 * (2026-08-29, Sophie: "can u add a expand button per text box in each
 * panel" → "expand as a popup").
 *
 * Everything here is a MEASUREMENT or a real tap, because the whole feature
 * is what a box looks like on screen:
 *
 *   - every panel box carries its own corner button, inside its own cell
 *   - the button is really reachable (elementFromPoint, not isVisible)
 *   - the tap lifts the SAME textarea over a backdrop — it never leaves
 *     #panelgrid, so panelVals/drafts/carry/Generate read it unchanged
 *   - the popup fits her words between the floor and cap and grows as she
 *     dictates; the grid behind the backdrop does not reflow
 *   - the house overlay rules: page locked while open, scroll position
 *     restored exactly on close
 *   - backdrop tap, the button, and a grid rebuild all close it — nothing
 *     can strand the backdrop with the page locked
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

  console.log('\nopening the popup');
  for (let i = 0; i < 9; i++) await page.fill('#panelgrid textarea[data-panel="' + i + '"]', nine[i]);
  // Scroll first, then snapshot — rects are viewport-relative, and the
  // restore assertion needs the y the page can really reach (the harness
  // page is short).
  const small = await page.evaluate(() => {
    window.scrollTo(0, 120);
    const t = document.querySelectorAll('#panelgrid textarea')[4];
    const r = t.getBoundingClientRect();
    const n = document.querySelectorAll('#panelgrid textarea')[5].getBoundingClientRect();
    return { w: r.width, h: r.height, y: window.scrollY, neighbour: { top: n.top, left: n.left } };
  });
  await page.evaluate(() => document.querySelectorAll('#panelgrid .pbig')[4].click());
  const pop = await page.evaluate(() => {
    const c = document.querySelectorAll('#panelgrid .pcell')[4];
    const t = c.querySelector('textarea');
    const r = t.getBoundingClientRect();
    const n = document.querySelectorAll('#panelgrid textarea')[5].getBoundingClientRect();
    const bg = document.getElementById('panelbg');
    const mid = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const go = document.getElementById('go');
    const gr = go.getBoundingClientRect();
    const goHit = document.elementFromPoint(gr.left + gr.width / 2, gr.top + gr.height / 2);
    return {
      pop: c.classList.contains('pop'),
      fixed: getComputedStyle(t).position === 'fixed',
      w: r.width, h: r.height, top: r.top, vw: window.innerWidth, vh: window.innerHeight,
      bgUp: !!bg && !bg.hidden,
      midIsBox: mid === t,
      inGrid: t.closest('#panelgrid') === document.getElementById('panelgrid'),
      locked: document.body.style.overflow === 'hidden',
      neighbour: { top: n.top, left: n.left },
      goBlocked: goHit !== go && !go.contains(goHit),
    };
  });
  ok(pop.pop && pop.fixed, 'the tap lifts the box into a fixed popup');
  ok(pop.bgUp, 'over a backdrop');
  ok(Math.abs(pop.w - pop.vw * 0.9) < 3 && pop.w > small.w * 2, 'the popup is ~the whole width');
  ok(pop.h >= pop.vh * 0.29, 'with the floor holding room to write');
  ok(pop.h <= pop.vh * 0.35, 'and no taller than the words need — the cell aspect is dropped');
  ok(pop.top >= pop.vh * 0.09, 'sat high enough that the keyboard never covers it, below the very top');
  ok(pop.midIsBox, 'the box itself takes the tap — above the backdrop and the pill');
  ok(pop.inGrid, 'and the textarea NEVER left #panelgrid — every reader of it is untouched');
  ok(pop.locked, 'the page behind is locked (the house overlay rule)');
  ok(pop.goBlocked, 'and the backdrop really covers the controls behind it');
  ok(Math.abs(pop.neighbour.top - small.neighbour.top) < 2 && Math.abs(pop.neighbour.left - small.neighbour.left) < 2,
    'the grid behind the backdrop does not reflow — the cell keeps its footprint');

  console.log('\nit grows under her words');
  const longText = nine[4] + ' ' + 'and then a long dictated line about what happens in this panel, '.repeat(10);
  await page.fill('#panelgrid textarea[data-panel="4"]', longText);
  const grown = await page.evaluate(() => {
    const t = document.querySelectorAll('#panelgrid textarea')[4];
    return { h: t.getBoundingClientRect().height, scrolls: t.scrollHeight > t.clientHeight + 2, vh: window.innerHeight };
  });
  ok(grown.h > pop.h + 30, 'typing while popped grows the box');
  ok(grown.h <= grown.vh * 0.61, 'clamped at the cap');
  ok(!grown.scrolls || grown.h >= grown.vh * 0.59,
    'and it only scrolls once the cap is really spent');

  console.log('\nclosing — backdrop tap, and what it must restore');
  await page.evaluate(() => document.getElementById('panelbg').click());
  const closed = await page.evaluate(() => {
    const c = document.querySelectorAll('#panelgrid .pcell')[4];
    const t = c.querySelector('textarea');
    return {
      pop: c.classList.contains('pop'),
      w: t.getBoundingClientRect().width, inline: t.style.height,
      bgUp: !document.getElementById('panelbg').hidden,
      locked: document.body.style.overflow === 'hidden',
      y: window.scrollY, val: t.value,
    };
  });
  ok(!closed.pop && !closed.bgUp, 'a backdrop tap closes the popup');
  ok(Math.abs(closed.w - small.w) < 2, 'and the box is really back in its column');
  ok(closed.inline === '', 'with the fitted inline height cleared, not left behind');
  ok(!closed.locked && Math.abs(closed.y - small.y) < 2,
    'the page unlocks and she is exactly where she opened it');
  ok(closed.val === longText, 'her words survived the round trip');

  console.log('\nGenerate reads the words she wrote in the popup');
  posted.length = 0;
  await page.click('#go');
  await page.waitForTimeout(300);
  const sent = posted[0] && posted[0].panels;
  // The run trims each panel on the way out, so compare trimmed.
  ok(posted.length === 1 && sent && sent[4] === longText.trim() && sent[0] === nine[0],
    'the popup box is still THE box — the run carries the words in it');

  console.log('\nthe button closes it too, and a rebuild closes it');
  await page.evaluate(() => document.querySelectorAll('#panelgrid .pbig')[2].click());
  ok(await page.evaluate(() => document.querySelectorAll('#panelgrid .pcell')[2].classList.contains('pop')), 'open again');
  await page.evaluate(() => document.querySelectorAll('#panelgrid .pbig')[2].click());
  ok(await page.evaluate(() =>
    !document.querySelectorAll('#panelgrid .pcell')[2].classList.contains('pop')
    && document.getElementById('panelbg').hidden), 'the same button closes it');
  // A rebuild while a popup is open must not strand the backdrop + lock.
  await page.evaluate(() => document.querySelectorAll('#panelgrid .pbig')[1].click());
  await page.evaluate(() => {
    const b = document.querySelector('#gridpick button[data-grid="4"]');
    b.click();                       // behind the backdrop for her; defensive path
  });
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button'))
      .find((x) => x.offsetParent && /bring|keep/i.test(x.textContent || ''));
    if (b) b.click();
  });
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length === 4);
  const fresh = await page.evaluate(() => ({
    pops: document.querySelectorAll('#panelgrid .pcell.pop').length,
    bgUp: !document.getElementById('panelbg').hidden,
    locked: document.body.style.overflow === 'hidden',
  }));
  ok(fresh.pops === 0 && !fresh.bgUp && !fresh.locked,
    'a grid rebuild closes the popup and unlocks the page — nothing stranded');

  await page.close();
  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FAIL (harness):', e); process.exit(1); });
