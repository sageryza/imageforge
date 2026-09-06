#!/usr/bin/env node
/*
 * test-playground-panels-photo.js — her photo reference rides a SHEET
 * (2026-09-06, Sophie: "i can add a photo reference in playground but not
 * in panels").
 *
 * It was off on the Panels tab on purpose — the same reasoning that keeps
 * the Sophie card off there ("both wordings name the second/last attached
 * image for ONE picture") — and that reasoning was wrong for the photo: its
 * line names "the LAST attached image … the subject described below", the
 * same shape as charLine()'s, which was turned on for sheets for exactly
 * that reason. So the photo rides a grid sheet and a story sheet in the
 * single run's own seat: after the style refs, before her cast, the line
 * re-anchored when cards ride behind it.
 *
 * The FIRST half pins the server by source (no network): the panels and
 * story branches attach it and store it, the sheet job puts it between the
 * style refs and the cast, and a redraw re-reads it. The SECOND drives the
 * real promptlab.html headless: the button is tappable on the Panels tab, an
 * attached photo is disclosed in the Prompt panel, a grid run and a story run
 * both POST it, and putting a photo-less sheet back takes it off.
 *
 *   node scripts/test-playground-panels-photo.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const servePublic = require('./lib/public-asset');
const sheetGrid = require('../sheet-grid');

const ROOT = path.join(__dirname, '..');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public', 'promptlab.html'), 'utf8');
const sweepSrc = fs.readFileSync(path.join(ROOT, 'promptlab-sweep.js'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

console.log('the server — the panels branch');
const panelsBranch = serverSrc.slice(
  serverSrc.indexOf('if (Array.isArray(req.body.panels)'),
  serverSrc.indexOf('// A STORY SHEET'));
ok(/sheetHead = `\$\{prefix\}\$\{photoBuf \? photoLine : ''\}\$\{charsLine\}`/.test(panelsBranch),
  'the photo line rides the sheet head, after the prefix and before the cast line — only when a photo does');
ok(/photoRef: photoUrl/.test(panelsBranch), 'the run doc records the photo it was drawn over');
ok(/photoUrls\.length > 1 \? \{ photoRefs: photoUrls \}/.test(panelsBranch),
  'and every photo when several rode');
ok(/runPromptLabPanelsJob\(docRef, \{[^}]*photoBuf, photoBufs/.test(panelsBranch),
  'the bytes reach the sheet job');
ok(/character: false/.test(panelsBranch), 'the Sophie card is STILL off — its line names the second attached image');

console.log('the server — the story branch');
const storyBranch = serverSrc.slice(
  serverSrc.indexOf('if (req.body.story) {'),
  serverSrc.indexOf('const docRef = admin.firestore().collection(PROMPTLAB).doc();',
    serverSrc.indexOf('if (req.body.story) {') + 2000));
ok(/p0 = `\$\{prefix\}\$\{photoBuf \? photoLine : ''\}\$\{charsLine\}`/.test(storyBranch),
  'a story sheet carries the photo line the same way');
ok(/photoRef: photoUrl/.test(storyBranch) && /photoBuf, photoBufs, chars: pickedChars/.test(storyBranch),
  'and stores + attaches the photo');

console.log('the server — the sheet job');
const job = serverSrc.slice(serverSrc.indexOf('async function runPromptLabPanelsJob'),
  serverSrc.indexOf('async function runPromptLabJob('));
const iStyle = job.indexOf('playgroundRefs(st)');
const iPhoto = job.indexOf('for (const b of photoBufs) refs.push(b)');
const iChars = job.indexOf('playgroundCharRefs(cfg.chars)');
ok(iStyle > -1 && iPhoto > iStyle && iChars > iPhoto,
  'the photos attach AFTER the style refs and BEFORE her cast — the seat both lines name');
ok(/cfg\.photoBufs && cfg\.photoBufs\.length\) \? cfg\.photoBufs : \(cfg\.photoBuf \? \[cfg\.photoBuf\] : \[\]\)/.test(job),
  'one photo or several, and an older caller passing photoBuf alone still works');

console.log('the sweep');
ok(/photoUrl: String\(d\.photoRef \|\| ''\)/.test(sweepSrc.slice(sweepSrc.indexOf('function panelsCfgOf'), sweepSrc.indexOf('function singleCfgOf'))),
  'panelsCfgOf rebuilds the photo url for a redraw');
const iRedraw = serverSrc.indexOf("if (act === 'redraw')");
const redraw = serverSrc.slice(iRedraw, serverSrc.indexOf('runPromptLabPanelsJob(d.ref, cfg)', iRedraw));
ok(/await refetchPhotoRefs\(cfg\)/.test(redraw), 'and the panels redraw re-reads the bytes before drawing');

console.log('the page');
ok(/classList\.toggle\('on', gpt\);/.test(pageSrc), 'the photo button is on for every gpt tile, the Panels tab included');
ok(!/photoRefs\.length && !onPanels\(\)/.test(pageSrc), 'the Prompt panel no longer hides the photo line on Panels');
const starters = ['function startPanelsRun', 'function startStoryRun'].map((f) => {
  const i = pageSrc.indexOf(f);
  return pageSrc.slice(i, pageSrc.indexOf('.then(readJson)', i));
});
ok(starters.every((s) => /photo: photoRefs\.length \? photoRefs\[0\]\.data : undefined/.test(s)
    && /photos: photoRefs\.length > 1/.test(s)),
  'both sheet starters POST the photo (and the list when several ride)');

// ── the page, headless ───────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

// The real `res` literal out of server.js — never a second copy.
function resTable() {
  const i = serverSrc.indexOf('\n  res: {');
  const b = serverSrc.slice(i + '\n  res: '.length);
  let lit = b.slice(0, b.indexOf('\n  },') + 4).trim().replace(/,$/, '');
  lit = lit.replace(/^\s*\/\/.*$/gm, '');
  return eval('(' + lit + ')');                      // eslint-disable-line no-eval
}
const RES = resTable();
const PL_STORY_LIVE = (() => {
  const i = serverSrc.indexOf('const PL_STORY = {');
  const lit = serverSrc.slice(i + 'const PL_STORY = '.length, serverSrc.indexOf('\n};', i) + 2);
  return eval('(' + lit + ')');                        // eslint-disable-line no-eval
})();
function panelsPayload() {
  const panels = { grids: {}, sheets: {} };
  Object.keys(sheetGrid.GRIDS).forEach((g) => {
    const pin = sheetGrid.GRIDS[g].shape;
    panels.grids[g] = {
      ...sheetGrid.GRIDS[g],
      count: sheetGrid.GRIDS[g].across * sheetGrid.GRIDS[g].down,
      positions: sheetGrid.positions(g), layout: sheetGrid.layoutWords(g),
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
  panels.story = { line: PL_STORY_LIVE.line, layout: PL_STORY_LIVE.layout };
  return panels;
}

const PHOTO_LINE = ' The LAST attached image is a photo reference: use it for the subject.';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAFklEQVQIW2P8z8Dwn4EIwDiqkL4KAdxlBAXWfaGiAAAAAElFTkSuQmCC';

(async () => {
  const posted = [];
  const PIXEL = Buffer.from('UklGRiYAAABXRUJQVlA4IBoAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA=', 'base64');
  const four = ['a fox', 'a moon', 'a boat', 'a key'];
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/promptlab' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
        try { posted.push(JSON.parse(body)); } catch { posted.push(null); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'p' + posted.length, poll: '/api/promptlab/p' + posted.length }));
      });
    }
    if (/^\/api\/promptlab\/p\d+$/.test(url.pathname)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ id: url.pathname.split('/').pop(), status: 'running', images: [] }));
    }
    if (url.pathname === '/api/promptlab') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: [], more: false }));
    }
    if (url.pathname === '/api/promptlab/styles') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        styles: {
          evan: { label: 'Sandy mirror', prefix: 'PREFIX', suffix: 'TAIL', refs: ['x.png'],
                  characterLine: ' Use the second attached image as a character reference.' },
          dreamy: { label: 'Dreamy', prefix: 'DPREF', suffix: 'DTAIL', refs: ['d.jpg'] },
        },
        sizes: {}, res: RES, resDefault: '1k', max: 4000, photoLine: PHOTO_LINE,
        panels: panelsPayload(),
      }));
    }
    if (url.pathname.startsWith('/img/')) {
      res.writeHead(200, { 'Content-Type': 'image/webp' });
      return res.end(PIXEL);
    }
    if (url.pathname === '/api/promptlab/characters') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ characters: [], max: 6 }));
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
  await page.goto(base + '/playground?style=chatgpt');
  await page.waitForFunction(() => document.querySelectorAll('#plabtabs button').length === 2);
  await page.waitForTimeout(200);

  const hit = (id) => page.evaluate((i) => {
    const el = document.getElementById(i);
    if (!el || !el.offsetParent) return false;
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(at && (at === el || el.contains(at)));
  }, id);

  console.log('the Panels tab');
  await page.click('#t-panels');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length > 0);
  ok(await hit('photopick'), 'the file button is TAPPABLE on the Panels tab (pre-fix: hidden)');
  ok(!(await page.isVisible('#charpick')), 'the Sophie card is still off there');

  await page.setInputFiles('#photofile', {
    name: 'penny.png', mimeType: 'image/png', buffer: Buffer.from(PNG.split(',')[1], 'base64'),
  });
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.getElementById('photowrap').classList.contains('has')),
    'attaching a photo lights the button');

  console.log('the disclosure');
  await page.click('#promptbtn');
  await page.waitForTimeout(150);
  const added = await page.evaluate(() => (document.querySelector('#promptpanel .added') || {}).textContent || '');
  ok(added.indexOf(PHOTO_LINE.trim()) > -1, 'the Prompt panel prints the photo line on the Panels tab');
  ok(added.indexOf('Panel 1') > -1 || added.indexOf('panel') > -1, 'beside the grid sentence');
  await page.click('#promptbtn');

  console.log('a grid run');
  await page.click('#gridpick button[data-grid="4"]');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length === 4);
  for (let i = 0; i < 4; i++) await page.fill('#panelgrid textarea[data-panel="' + i + '"]', four[i]);
  await page.click('#go');
  await page.waitForFunction(() => document.querySelectorAll('#pendings .cell').length > 0);
  ok(posted.length === 1 && Array.isArray(posted[0].panels) && posted[0].panels.length === 4,
    'a full grid POSTs once, with its panels');
  ok(posted[0].photo === PNG, 'and the POST carries the photo (pre-fix: undefined)');
  ok(posted[0].photos === undefined, 'one photo sends no list — the older shape, byte for byte');

  console.log('a story run');
  await page.click('#gridpick button[data-grid="story"]');
  await page.waitForFunction(() => !!document.querySelector('#panelgrid textarea[data-story]'));
  await page.fill('#panelgrid textarea[data-story]', 'a fox finds a key under the moon');
  await page.click('#go');
  await page.waitForFunction((n) => document.querySelectorAll('#pendings .cell').length > n, 4);
  ok(posted.length === 2 && posted[1].story === true, 'a story sheet POSTs');
  ok(posted[1].photo === PNG, 'carrying the photo too');

  console.log('putting a sheet back');
  // A panels run's record decides the photo — one with none takes it OFF, the
  // only-change-what-the-record-knows rule, now that a sheet can carry one.
  await page.evaluate(() => copyPanelsIn({ panels: ['a', 'b', 'c', 'd'], grid: { count: 4 }, prompt: 'a / b / c / d' }));
  await page.waitForTimeout(150);
  ok(await page.evaluate(() => !window.photoRef), 'a sheet drawn with no photo puts the attached one down');
  await page.evaluate(() => copyPanelsIn({ panels: ['a', 'b', 'c', 'd'], grid: { count: 4 }, prompt: 'a / b / c / d', photoRef: location.origin + '/img/ref.png' }));
  await page.waitForTimeout(150);
  ok(await page.evaluate(() => window.photoRef && /\/img\/ref\.png$/.test(window.photoRef.data)),
    'and a sheet drawn over a photo puts that photo back');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();
