#!/usr/bin/env node
/*
 * test-playground-cast-import.js — A PANEL PULLED OUT OF A SHEET BRINGS ITS
 * PEOPLE (2026-08-29, Sophie: "panels adds a character / if i import solo to
 * playground / can it auto add the character description from the original
 * multi sheet / ex creepy guy").
 *
 * Measured on her own run the day this was built: the pills panel
 * (`yOzdjWwq3OSYh3VEjw8r`, "the creepy guy ill at ease, closed in by large
 * bottles of pills") was re-run alone off a 2x3 sheet whose prompt described
 * the creepy guy in eight words — long beard, glasses, all black, a cape, a
 * belt, a sickeningly sweet smile — and the solo run's fullPrompt carries not
 * one of them. The description existed, on the record, and there was no road
 * from it to the next picture.
 *
 * Three roads now, and this test drives all three against the REAL page:
 *   1. THE RUN CARD / LIGHTBOX put-back (copyPictureIn) — the run doc has the
 *      typed rows, so they come with the panel's words.
 *   2. THE LINK (?cast=) — the Assets / Meta Assets door has only the filed
 *      style half, so it reads the rows back out of the clause with
 *      sheetGrid.castParse. Nothing is invented on that road.
 *   3. THE RUN ITSELF — a single-picture POST carries `cast`, which is the
 *      whole point: without it the restored rows would be decoration.
 *
 * And the two rules that keep it from being a nuisance: it ADDS ONLY (the
 * cast is typed by hand and sticky, unlike the photo ref, so "a record with
 * none clears it" would throw away her work), and it SAYS SO on arrival — a
 * clause riding her next run must never be silent.
 *
 *   node scripts/test-playground-cast-import.js
 */
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const servePublic = require('./lib/public-asset');

const ROOT = path.join(__dirname, '..');
const pageSrc = fs.readFileSync(path.join(ROOT, 'public/promptlab.html'), 'utf8');
const assetsSrc = fs.readFileSync(path.join(ROOT, 'public/assets.html'), 'utf8');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const sheetGrid = require(path.join(ROOT, 'sheet-grid.js'));

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// ── the server contract, by source ───────────────────────────────────────
console.log('the server sends the clause on a SINGLE run too');
const gptBranch = serverSrc.slice(serverSrc.indexOf('const soloCast ='),
  serverSrc.indexOf('// A PANELS RUN'));
ok(/sheetGrid\.castRows\(req\.body\.cast\)/.test(gptBranch),
  'a single gpt run reads req.body.cast through the shared row rule');
ok(/sheetGrid\.castBlock\(soloCast, true\)/.test(gptBranch),
  'and builds it with the SINGLE opening — never the sheet sentence');
ok(/\[headLine, soloCastTxt\]\.filter\(Boolean\)\.join\('\\n\\n'\)/.test(gptBranch),
  'the clause is its own paragraph in the head — the shape castParse reads back');
ok(/\.\.\.\(soloCast\.length \? \{ cast: soloCast \} : \{\}\)/.test(serverSrc),
  'the rows are stored on the run, so a put-back restores the same people');
ok(/introOne: sheetGrid\.CAST_INTRO_ONE/.test(serverSrc),
  'both openings are SERVED — the page keeps no copy of either');
ok(pageSrc.indexOf('draw each one as described') < 0
  && pageSrc.indexOf('recur across the panels') < 0,
  'and promptlab.html holds no transcript of the wording');
ok(/const CAST_NAME = 60;/.test(serverSrc) && /const CAST_DESC = 300;/.test(serverSrc)
  && (serverSrc.match(/c\.name\.slice\(0, CAST_NAME\)/g) || []).length === 3,
  'one field cap, used by all three doors — a row cannot survive one and be cut at another');

console.log('\nthe Meta Assets door reads the clause off the filed style half');
ok(/<script src="\/sheet-grid\.js"><\/script>/.test(assetsSrc),
  'assets.html links the real sheet-grid, never a copy of the parse');
ok(/castParse\(it\.promptStyle\)/.test(assetsSrc),
  'and parses the STYLE half — where a cut panel keeps its cast clause');
ok(/if\(cast&&cast\.length\) q\+='&cast='/.test(assetsSrc),
  'a picture with no clause on file sends nothing — the link is what it was');

// ── the real page ────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

// Her real cast, off the pills sheet.
const CAST = [
  { name: 'the creepy guy',
    description: 'long beard, glasses, all black, with a cape and a belt, sickeningly sweet smile' },
  { name: 'the woman',
    description: 'longish curly brown hair, a blue and white dress with small flowers' },
];
const PANELS = ['seven roommates closing the door on the creepy guy',
  'the creepy guy ill at ease, closed in by large bottles of pills pushing in on him'];

const RES = (() => {
  const i = serverSrc.indexOf('\n  res: {');
  const b = serverSrc.slice(i + '\n  res: '.length);
  let lit = b.slice(0, b.indexOf('\n  },') + 4).trim().replace(/,$/, '');
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

// The sheet's own prompt, built the way server.js builds it — so the style
// half a panel files really is what this test parses.
const SHEET_HEAD = 'DPREF\n\n' + sheetGrid.castBlock(CAST)
  + '\n\n' + sheetGrid.panelBlock(2, PANELS);

(async () => {
  const posted = [];
  const doneRun = {
    id: 'r2', status: 'done', engine: 'gptimage', gptStyle: 'dreamy', model: 'gpt-image-2',
    prompt: PANELS.join(' / '), fullPrompt: SHEET_HEAD + '\n\nDTAIL',
    quality: 'low', size: '2304x1536', aspectRatio: '3:2', res: '2k',
    panels: PANELS, grid: { across: 1, down: 2, count: 2 },
    sheet: '2304x1536', cell: '2304x768', cast: CAST,
    images: ['/img/p0.png', '/img/p1.png'], createdAt: Date.now() - 60000,
  };
  const PIXEL = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
  const server = http.createServer((req, res) => {
    if (servePublic(req, res)) return;
    const url = new URL(req.url, 'http://x');
    const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (url.pathname === '/api/promptlab' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
        try { posted.push(JSON.parse(body)); } catch { posted.push(null); }
        json({ id: 'x1' });
      });
    }
    if (/^\/api\/promptlab\/x1$/.test(url.pathname)) return json({ id: 'x1', status: 'running', images: [] });
    if (url.pathname === '/api/promptlab') return json({ runs: [doneRun], more: false });
    if (url.pathname === '/api/promptlab/styles') {
      return json({ styles: {
        evan: { label: 'Sandy mirror', prefix: 'PREFIX', suffix: 'TAIL', refs: ['x.png'] },
        dreamy: { label: 'Dreamy', prefix: 'DPREF', suffix: 'DTAIL', refs: ['d.jpg'] },
      }, sizes: {}, res: RES, resDefault: '1k', max: 4000, photoLine: '', panels: panelsPayload() });
    }
    if (url.pathname === '/api/promptlab/characters') return json({ characters: [], max: 6 });
    if (url.pathname.startsWith('/img/')) { res.writeHead(200, { 'Content-Type': 'image/webp' }); return res.end(PIXEL); }
    if (url.pathname.startsWith('/api/gallery')) return json({ assets: [], thread: [] });
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageSrc);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const castRows = () => page.$$eval('#castrows .castrow input, #castrows .castrow textarea',
    (is) => is.map((i) => i.value));
  const openDesc = async () => {
    await page.click('#charsbtn');
    await page.waitForSelector('#charpanel.on');
    if (!(await page.isVisible('#chardesc'))) await page.click('#chartabs button[data-ct="desc"]');
    await page.waitForSelector('#chardesc:not([hidden])');
  };

  // ── 1. THE LINK ─────────────────────────────────────────────────────────
  console.log('\n?cast= — the Meta Assets road, on the PICTURE tab');
  const q = '?prompt=' + encodeURIComponent(PANELS[1]) + '&style=dreamy&sameref=1'
    + '&cast=' + encodeURIComponent(JSON.stringify(sheetGrid.castParse(SHEET_HEAD)));
  await page.goto(base + '/playground' + q);
  await page.waitForFunction(() => document.querySelectorAll('#plabtabs button').length === 2);
  ok((await page.inputValue('#prompt')) === PANELS[1], 'the panel words land in the one box');
  ok(/\bon\b/.test(await page.getAttribute('#t-picture', 'class') || ''),
    'on the PICTURE tab, where one panel belongs');
  // THE BADGE IS THE DISCLOSURE NOW. It used to be a sentence in the port
  // indicator under the style picker; Sophie deleted that whole row
  // (2026-08-31, "delete the red" ×2, then "still there"), so the count on the
  // character button is what says an ingredient rode the link in — an arrival
  // must never be silent, and this is the surviving voice.
  ok((await page.textContent('#charsn')) === '2', 'the badge counts the two who came with it');
  ok(await page.isVisible('#charsn'), 'and it is on screen, so the arrival is not silent');
  ok(await page.$('#reftag') === null, 'the port indicator row is gone entirely');
  await openDesc();
  ok(await page.isVisible('#chartabs'),
    'the Pictures · Descriptions row is on the Picture tab now');
  const rows = await castRows();
  ok(rows.length === 4 && rows[0] === 'the creepy guy' && /long beard/.test(rows[1]),
    'the creepy guy is in the sheet, described in her own words');

  // ── 3. THE RUN CARRIES THEM ─────────────────────────────────────────────
  console.log('\nand the single run actually sends them');
  await page.click('#charsbtn');                    // put the sheet away
  await page.click('#go');
  await page.waitForFunction(() => window.__lastPosted !== undefined || true);
  await page.waitForTimeout(300);
  const body = posted[posted.length - 1];
  ok(body && Array.isArray(body.cast) && body.cast.length === 2,
    'a PICTURE-tab run POSTs the cast rows');
  ok(body && !body.panels && !body.grid, 'as a single picture, not a sheet');
  ok(body && body.cast[0].description === CAST[0].description,
    'her words verbatim — nothing reworded on the way');

  // ── ADD-ONLY ────────────────────────────────────────────────────────────
  console.log('\nit only ever ADDS');
  await page.goto(base + '/playground' + q);        // the same two, again
  await page.waitForFunction(() => document.querySelectorAll('#plabtabs button').length === 2);
  ok((await page.textContent('#charsn')) === '2',
    'the same link twice does not duplicate anybody');
  await page.evaluate(() => localStorage.setItem('promptlab_cast',
    JSON.stringify([{ name: 'the creepy guy', description: 'MINE — do not touch' }])));
  await page.goto(base + '/playground' + q);
  await page.waitForFunction(() => document.querySelectorAll('#plabtabs button').length === 2);
  await openDesc();
  const kept = await castRows();
  ok(kept[1] === 'MINE — do not touch',
    'a name she already has keeps HER description — the record fills gaps, never corrects her');
  ok(kept.length === 4 && kept[2] === 'the woman', 'and the one she did not have is added');

  // ── 2. THE PUT-BACK ─────────────────────────────────────────────────────
  // The per-PICTURE control lives in the lightbox (the run card's own copy
  // button refills the whole grid — a different question). Opening panel 2
  // and tapping it is the exact gesture she made on the pills panel.
  console.log('\nthe put-back road: one panel out of the lightbox');
  await page.evaluate(() => localStorage.removeItem('promptlab_cast'));
  await page.goto(base + '/playground');
  await page.waitForFunction(() => document.querySelectorAll('#plabtabs button').length === 2);
  await page.click('#t-panels');
  await page.waitForFunction(() => !!document.querySelector('#runs img[data-run]'));
  await page.evaluate(() => {
    const im = document.querySelectorAll('#runs img[data-run]');
    (im[1] || im[0]).click();
  });
  await page.waitForSelector('#clightbox [aria-label="Put this prompt back in the box"]');
  await page.click('#clightbox [aria-label="Put this prompt back in the box"]');
  await page.waitForFunction((w) => document.getElementById('prompt').value === w, PANELS[1]);
  ok((await page.inputValue('#prompt')) === PANELS[1],
    'the panel\u2019s own words land in the one box');
  ok(/\bon\b/.test(await page.getAttribute('#t-picture', 'class') || ''),
    'on the PICTURE tab \u2014 a panel re-run alone is a single picture');
  ok((await page.textContent('#charsn')) === '2',
    'and the run\u2019s typed cast comes with it \u2014 her whole ask, in one tap');
  await openDesc();
  const back = await castRows();
  ok(back[0] === 'the creepy guy' && /sickeningly sweet smile/.test(back[1]),
    'the creepy guy is described the way the sheet described him');

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})();
