#!/usr/bin/env node
/*
 * test-playground-generate-scroll.js — A GENERATE TAP HAS TO BE VISIBLE
 * (2026-08-28, Sophie, looking at the Panels tab: "why didn't it draw").
 *
 * It HAD drawn — twice, a minute apart, two 2x2 sheets cut into four panels
 * each, both `done` on the server while she was asking. What went wrong is
 * that the tap changed nothing where she was standing: the new run's
 * placeholder lands in #pendings, which sits BELOW the feedbar, and on the
 * PANELS tab the boxes are several hundred pixels tall — so the card that
 * says "drawing…" is off the bottom edge and nothing on screen answers the
 * tap. She tapped again a minute later, and asked.
 *
 * IT HAS TO BE MEASURED IN A REAL BROWSER. "Did it start a run?" was true the
 * whole time — that is the bug — so the only honest question is where the
 * window ends up a moment after her tap, and whether the placeholder is
 * really on screen when it settles.
 *
 * All three starters are swept, because the shape of the miss is one of them
 * being added later without it: the one box, the PANELS grid, and Story.
 *
 *   node scripts/test-playground-generate-scroll.js
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

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// Every starter calls it — the shape of this bug is a fourth one shipping
// without the scroll, so ask the source as well as the browser.
const pageSrc = fs.readFileSync(path.join(PUB, 'promptlab.html'), 'utf8');
console.log('\nevery starter walks to the card');
['startRun', 'startPanelsRun', 'startStoryRun'].forEach((fn) => {
  const i = pageSrc.indexOf('function ' + fn + '(');
  const body = pageSrc.slice(i, i + 3000);
  const stop = body.indexOf('\n  function ', 10);
  ok(/scrollToPending\(\)/.test(stop > 0 ? body.slice(0, stop) : body),
    fn + ' calls scrollToPending()');
});

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

// A feed several screens tall, so "the placeholder is on screen" is a real
// question and not something the shortness of the page answers for us.
const now = Date.now();
const RUNS = [];
for (let i = 0; i < 14; i++) {
  RUNS.push({
    id: 'run' + i, status: 'done', engine: 'gptimage',
    prompt: 'a cat on a fence number ' + i,
    model: 'gpt-image-2', gptStyle: 'dreamy', quality: 'low', size: '1024x1536',
    aspectRatio: '2:3', res: '1k', outputs: 1, images: ['/shot.png'],
    fullPrompt: 'HOUSE PREFIX a cat on a fence number ' + i + ' HOUSE SUFFIX',
    createdAt: now - i * 1000,
  });
  // The PANELS tab has its own gallery, so it needs its own tall feed — a
  // short page cannot answer "is the card on screen?", it just is.
  RUNS.push({
    id: 'pan' + i, status: 'done', engine: 'gptimage',
    prompt: 'a / b / c / d', panels: ['a', 'b', 'c', 'd'],
    grid: { across: 2, down: 2, count: 4 },
    model: 'gpt-image-2', gptStyle: 'dreamy', quality: 'low', size: '1024x1024',
    aspectRatio: '1:1', res: '1k', sheet: '1024x1024', cell: '512x512',
    images: ['/shot.png', '/shot.png', '/shot.png', '/shot.png'],
    sheetUrl: '/shot.png', createdAt: now - i * 1000 - 500,
  });
}

async function run(browser) {
  let started = 0;
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/shot.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(PNG);
    }
    if (url.pathname === '/api/promptlab' && req.method === 'POST') {
      started++;
      // The run never finishes — the placeholder is what this test is about.
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ id: 'fresh' + started }));
    }
    if (url.pathname === '/api/promptlab') {
      const kind = url.searchParams.get('kind');
      const runs = kind === 'panels' ? RUNS.filter((r) => r.panels)
        : kind === 'single' ? RUNS.filter((r) => !r.panels) : RUNS;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs, more: false }));
    }
    // The poll drops a pending entry whose run doc has gone — so a stub that
    // answers `{}` here deletes the very placeholder this test is about.
    if (/^\/api\/promptlab\/fresh\d+$/.test(url.pathname)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        id: url.pathname.split('/').pop(), status: 'rendering', engine: 'gptimage',
      }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        styles: {
          dreamy: { label: 'Dreamy', prefix: 'HOUSE PREFIX ', suffix: ' HOUSE SUFFIX',
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
  // Her iPhone 13 inside the app: the web view is the screen MINUS the app's
  // own bottom bar, which is the viewport the screenshot was taken in and the
  // reason the feed sits off the bottom edge there. At a bare 844 the panels
  // card fits and the bug cannot be reproduced at all.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 700 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { localStorage.setItem('promptlab_view', 'list'); } catch (e) {}
  });
  await page.goto(base + '/playground', { waitUntil: 'load' });
  await page.waitForSelector('.copybtn[data-copy="run0"]');
  await page.waitForTimeout(400);

  const y = () => page.evaluate(() => window.scrollY);
  const settle = async () => {
    let last = -1, same = 0;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(50);
      const v = await y();
      if (v === last) { if (++same > 3) break; } else { same = 0; last = v; }
    }
    return y();
  };
  // Is the "drawing…" card really on screen where the page settled? An
  // element can be in the DOM, sized and "visible" while sitting below the
  // fold — which is the whole of the bug.
  const placeholder = () => page.evaluate(() => {
    var box = document.getElementById('pendings');
    if (box.hidden) box = document.getElementById('tiles');
    var card = box && box.firstElementChild;
    if (!card) return null;
    var r = card.getBoundingClientRect();
    // Its HEAD is what says "drawing…", so the card counts as answering the
    // tap only when that line is really on screen — a card whose top edge is
    // 20px off the bottom is not an answer to anything.
    return { top: r.top, inView: r.top >= 0 && r.top <= window.innerHeight - 60,
             says: /drawing/i.test(card.textContent || '') };
  });
  // Stand her where the controls are — the Generate button in view, the feed
  // below the fold, which is where a tall panels grid leaves her.
  const standAtControls = async () => {
    await page.evaluate(() => {
      var go = document.getElementById('go');
      window.scrollTo(0, Math.max(0,
        window.scrollY + go.getBoundingClientRect().bottom - window.innerHeight + 60));
    });
    await page.waitForTimeout(150);
    return page.evaluate(() => ({
      y: window.scrollY,
      goOnScreen: (function () {
        const r = document.getElementById('go').getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight;
      }()),
      feedBelow: document.querySelector('.feedbar').getBoundingClientRect().top
        > window.innerHeight - 140,
    }));
  };

  console.log('\nher screen: the PANELS tab, a full grid, the feed off the bottom');
  await page.click('#t-panels');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length > 0);
  await page.click('#gridpick button[data-grid="9"]');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length === 9);
  for (let i = 0; i < 9; i++) {
    await page.fill('#panelgrid textarea[data-panel="' + i + '"]',
      'panel number ' + (i + 1) + ' — a long dictated line about what happens in it');
  }
  const stand = await standAtControls();
  ok(stand.goOnScreen, 'the Generate button is on screen');
  ok(stand.feedBelow,
    'and the feed starts at or below the bottom edge, so the card she is about'
      + ' to make is somewhere she cannot see');

  console.log('\ntapping Generate on PANELS');
  await page.evaluate(() => document.getElementById('go').click());
  await page.waitForTimeout(200);
  ok(started === 1, 'the run really starts (' + started + ' POSTed)');
  const at = await settle();
  const ph = await placeholder();
  ok(!!ph, 'a placeholder card is rendered');
  ok(ph && ph.says, 'and it says it is drawing');
  ok(ph && ph.inView,
    'and the page has walked to it, so the tap is visible'
      + (ph ? ' (card top ' + Math.round(ph.top) + ', settled at ' + at + ')' : ''));

  console.log('\nit does not fight the poll');
  const held = await settle();
  ok(Math.abs(held - at) < 8, 'the page stays where it landed (' + held + ' vs ' + at + ')');

  console.log('\nthe PICTURE tab\'s one box');
  await page.click('#t-picture');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    var t = document.getElementById('prompt');
    t.value = 'a raffle, paper tickets, drawing lots';
    t.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await standAtControls();
  await page.evaluate(() => document.getElementById('go').click());
  await page.waitForTimeout(200);
  ok(started === 2, 'the run starts');
  await settle();
  const ph2 = await placeholder();
  ok(ph2 && ph2.inView && ph2.says,
    'the drawing card is on screen here too'
      + (ph2 ? ' (card top ' + Math.round(ph2.top) + ')' : ' (no card found)'));

  console.log('\nTILES view — the placeholder lives on the wall instead');
  await page.evaluate(() => document.getElementById('v-tiles').click());
  await page.waitForTimeout(250);
  await standAtControls();
  await page.evaluate(() => document.getElementById('go').click());
  await page.waitForTimeout(200);
  ok(started === 3, 'the third run starts');
  await settle();
  const ph3 = await placeholder();
  ok(ph3 && ph3.inView,
    'the wall\'s waiting square is on screen too'
      + (ph3 ? ' (card top ' + Math.round(ph3.top) + ')' : ' (no card found)'));

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
