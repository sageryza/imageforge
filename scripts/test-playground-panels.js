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

console.log('the cast — both halves ride a sheet');
// TWO INDEPENDENT HALVES (2026-08-27, Sophie: "I want both. Descriptions as
// well as pictures: two options"). Neither replaces the other and a run may
// carry either, both or neither.
//  • PICTURES — the saved character cards, attached last, named by
//    charLine(). The Sophie card and her photo are still OUT, and that
//    asymmetry is the point: those two name a POSITION for ONE picture,
//    where charLine() says "the last attached image(s)", which is as true of
//    a sheet as of a single picture.
//  • DESCRIPTIONS — her typed rows, written in by sheetGrid.castBlock.
const panelsBranch = serverSrc.slice(
  serverSrc.indexOf('if (Array.isArray(req.body.panels)'),
  serverSrc.indexOf('// A STORY SHEET'));
ok(/sheetGrid\.castRows\(req\.body\.cast\)/.test(panelsBranch),
  'the panels branch reads her typed cast');
ok(/const castTxt = sheetGrid\.castBlock\(cast\)/.test(panelsBranch),
  'and builds the clause with the shared builder, never its own wording');
ok(/castTxt \? `\$\{castTxt\}/.test(panelsBranch),
  'the clause is only in the prompt when there IS one — her rule');
ok(/const sheetHead = `\$\{prefix\}\$\{charsLine\}`/.test(panelsBranch),
  "the picked cards' sentence rides the head");
ok(/chars: pickedChars/.test(panelsBranch), 'and the cards themselves reach the job');
ok(/character: false/.test(panelsBranch),
  'the SOPHIE card is still off — it names the second attached image');
ok(!/photoBuf/.test(panelsBranch), 'and so is her photo, for the same reason');
const panelsJob = serverSrc.slice(serverSrc.indexOf('async function runPromptLabPanelsJob'),
  serverSrc.indexOf('async function runPromptLabPanelsJob') + 1400);
ok(/playgroundCharRefs\(cfg\.chars\)/.test(panelsJob),
  'the job attaches the picked cards, last');
// The clause and the picked line both land in the HEAD, which is what a
// panel's filed style half is cut from — so provenance needs no other change.
ok(/\.\.\.\(cast\.length \? \{ cast \} : \{\}\)/.test(panelsBranch)
  && /\.\.\.\(pickedChars\.length \? \{ characters: pickedChars \} : \{\}\)/.test(panelsBranch),
  'both halves are stored on the run as provenance, absent when unused');
// ONE derivation: the page prints the REAL clause rather than a copy.
ok(/app\.get\('\/sheet-grid\.js'/.test(serverSrc), 'sheet-grid.js is served to the page');
ok(/<script src="\/sheet-grid\.js"><\/script>/.test(pageSrc), 'and the page links it');
ok(/window\.__sheetGrid && window\.__sheetGrid\.castBlock/.test(pageSrc),
  'the page builds the clause with it');
ok(pageSrc.indexOf('The same characters recur') < 0,
  'promptlab.html holds NO copy of the clause wording');
ok(/cast: castRows\(\)\.length \? castRows\(\) : undefined/.test(pageSrc),
  'a panels run sends the typed cast, absent when empty');
ok(/var charsOff = !gpt;/.test(pageSrc),
  'and the character picker is no longer hidden on the panels tab');
// ONE SHEET, TWO HALVES (2026-08-28, Sophie: "add character description be
// within the existing icon - hairline toggle between description and
// pictures"). The typed cast shipped as its own box under the panel grid,
// which made two places on the page to say who is in a picture.
ok(pageSrc.indexOf('id="castbox"') < 0, 'the standalone cast box is gone');
ok(/<div class="plabtabs chartabs" id="chartabs"/.test(pageSrc),
  'the sheet carries the house hairline row');
ok(/data-ct="pics"/.test(pageSrc) && /data-ct="desc"/.test(pageSrc),
  'with the two halves on it');
ok(/id="charpics"/.test(pageSrc) && /id="chardesc"/.test(pageSrc),
  'and each half is a real box the row shows and hides');
ok(/function plTabLine\(id\)/.test(pageSrc) && /plTabLine\('chartabs'\)/.test(pageSrc),
  'ONE measurer for both rows — nothing declares a tab count');
// THE ROW IS ON BOTH TABS (2026-08-29) — the clause rides a single picture
// now, so the reason it was Panels-only ("a tab that changes nothing on the
// Picture tab is worse than no tab") no longer holds.
ok(/row\.hidden = false;/.test(pageSrc),
  'the row shows wherever the sheet does — the clause exists on both tabs');
ok(/localStorage\.getItem\(CHARTABKEY\) === 'desc' \? 'desc' : 'pics'/.test(pageSrc),
  'and the half she was on is remembered whichever tab she is on');
ok(/var n = pics \+ desc;/.test(pageSrc),
  'the badge counts the whole cast, both halves');

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
// A deploy restart cannot lose a banked sheet: the sweep finishes an orphaned
// panels run from it instead of marking paid work failed, and the recut route
// recovers on demand — but never re-cuts a run that already has its panels.
ok(/recutPanelsRun\(d\.ref, r\)/.test(serverSrc),
  'the stuck-run sweep RECUTS an orphaned panels run from its banked sheet');
// The sheet shows the moment it is paid for, so a panels run PARKS on 'ready'
// while the cut runs — which means the orphan sweep has to reach that status
// too, or the very restart it exists for leaves a paid sheet uncut AND
// unswept. It must not sweep an ordinary 'ready' run (that one already holds
// its pictures) — hence the panels+sheet+no-images filter.
const sweepSrc = serverSrc.slice(serverSrc.indexOf('async function sweepStuckPromptlabRuns'),
  serverSrc.indexOf('async function sweepStuckPromptlabRuns') + 2200);
ok(/where\('status', '==', 'ready'\)/.test(sweepSrc),
  "the sweep also looks at 'ready' runs (a panels run parks there while it cuts)");
// (the filter is plSweep.isOrphanedSheet since the 2026-08-29 sweep refactor
// — the panels+sheet+no-images rule is pinned in test-promptlab-sweep.js)
ok(/plSweep\.isOrphanedSheet\(d\.data\(\)\)/.test(sweepSrc),
  'and takes ONLY a panels run with a banked sheet and no cut panels from there');
ok(/\/api\/promptlab\/:id\/recut/.test(serverSrc), 'the recut route exists');
ok(/already cut — a recut would file a duplicate set/.test(serverSrc),
  'and refuses a run that already has its panels');
// panelsCfgOf moved to promptlab-sweep.js (2026-08-29) so the sweep's redraw
// decision could ask it — the rebuild claim is pinned against that file now,
// and test-promptlab-sweep.js carries the decision table.
const orphSrc = fs.readFileSync(path.join(__dirname, '..', 'promptlab-sweep.js'), 'utf8');
ok(/function panelsCfgOf/.test(orphSrc) && /sheetGrid\.panelBlock\(plan\.count, d\.panels\)/.test(orphSrc)
  && /plSweep\.panelsCfgOf/.test(serverSrc),
  'the recovery rebuilds its config from the run DOC alone (promptlab-sweep.js)');
// The whole panels block: finishPanelsCut (the shared cut-and-file half),
// panelsCfgOf, recutPanelsRun and the job itself.
const jobSrc = serverSrc.slice(serverSrc.indexOf('async function finishPanelsCut'),
  serverSrc.indexOf('async function runPromptLabJob'));
ok(jobSrc.indexOf('sheetUrl') < jobSrc.indexOf('cutSheet(sheetBuf'),
  'the paid sheet is banked BEFORE the cut');
// ONE CUT AT A TIME (2026-08-28, Sophie's two-phase rule: banked arrivals may
// stack, the ~33MB decodes may not — concurrent cuts are the measured
// box-killer). finishPanelsCut is the one door every caller — the live job,
// the boot sweep, /recut — comes through, so the gate on it covers them all;
// the heavy body must not be callable around it.
// (finishPanelsCut also books the run into cuttingNow around the gate since
// 2026-08-29 — the sweep's short recut wait leans on that set)
ok(/async function finishPanelsCut\(docRef, cfg, sheetBuf, sheetUrl\) \{[^}]*?return await gateCut\(/.test(serverSrc),
  'finishPanelsCut queues through gateCut — one cut at a time');
ok((serverSrc.match(/finishPanelsCutInner\(/g) || []).length === 2,
  'the ungated body is called ONLY from inside the gate');
// 2026-08-27, Sophie: "the uncut sheet shud show before it's cut as soon as
// it's done (in panels" — the banking write parks the run on 'ready', which
// is what puts the picture on screen while the cut and the filing run.
ok(/docRef\.update\(\{ sheetUrl, status: 'ready',/.test(jobSrc),
  "banking the sheet parks the run on 'ready' — the sheet shows at once");
ok(jobSrc.indexOf("status: 'ready'") < jobSrc.lastIndexOf('await finishPanelsCut(docRef'),
  'before the cut is even started');
ok(/cutFailed: true/.test(jobSrc), 'a failed cut keeps the sheet as the picture, disclosed');
ok(/sizeTier\.cutSize\(plan\.sheet, plan\.count\)/.test(jobSrc),
  "every cut panel files with the '1/9 (4K)' slot");
ok(/sizeSlot: cut/.test(jobSrc), 'through fileCreationDoc\'s sizeSlot override');
ok(/i > 24/.test(serverSrc) && !/i > 3\)/.test(serverSrc),
  'the vote cap fits a panels run (0-24, was 0-3)');
ok(/panels\.grids\[g\]/.test(serverSrc) || /panels: \{ grids/.test(serverSrc)
  || /const panels = \{ grids/.test(serverSrc),
  'the styles route serves the panels geometry');
ok(/function cuttingSheet/.test(pageSrc)
  && /r\.status !== 'ready' \|\| runImages\(r\)\.length/.test(pageSrc),
  'the page draws the sheet for a run parked on ready with no panels yet');
ok(/ar: sheetArOf\(r\)/.test(pageSrc.slice(pageSrc.indexOf('function cuttingSheet'),
  pageSrc.indexOf('function cuttingSheet') + 900)),
  "in the SHEET's own ratio, never the panel cell's");

// The page copies no geometry and no prompt wording of its own.
ok(pageSrc.indexOf('equal rectangles') < 0, 'promptlab.html holds NO copy of the grid sentence');
ok(pageSrc.indexOf('top middle') < 0, 'and no copy of the cell names');

// The two haystacks stay in step: both list the panels then the grid tag.
ok(/\.\.\.\(r\.panels \|\| \[\]\)/.test(serverSrc)
  && /r\.grid && r\.grid\.count \? `panels \$\{r\.grid\.across\}x\$\{r\.grid\.down\}` : ''/.test(serverSrc),
  'promptlabHay lists the panel words and the grid');
ok(/\.concat\(r\.panels \|\| \[\]\)/.test(pageSrc), 'runHay mirrors it');
// The shape WORD a run is searchable by lives in TWO files with no shared
// script — nothing but this would notice one drifting (the landscape cell the
// 2 option pins is the third entry, and a page that did not know it would
// silently stop finding those runs).
const shapeWord = (src) => {
  const m = /PL_SHAPE_WORD = (\{[^}]*\})/.exec(src);
  return m ? eval('(' + m[1] + ')') : null;            // eslint-disable-line no-eval
};
const swServer = shapeWord(serverSrc), swPage = shapeWord(pageSrc);
ok(swServer && swPage && JSON.stringify(swServer) === JSON.stringify(swPage),
  'PL_SHAPE_WORD is the same map in server.js and promptlab.html');
ok(swServer && swServer['3:2'] === 'landscape', "and it knows the landscape cell");

// THE GALLERY IS SEPARATE PER TAB (2026-08-27, Sophie: "separate the gallery
// for playground for single pics vs panels"). The kind rule lives in TWO
// files with no shared script — server.js's plRunIsPanels and the page's
// runIsPanels must be the same expression, or a run sits in one tab's
// gallery on the server and the other's on the phone.
const KIND_EXPR = '!!(r.grid && r.grid.count) || !!(r.panels && r.panels.length) || !!r.storySheet';
ok(serverSrc.indexOf(KIND_EXPR) >= 0 && /function plRunIsPanels/.test(serverSrc),
  'server.js has plRunIsPanels (story sheets included)');
ok(pageSrc.indexOf(KIND_EXPR) >= 0 && /function runIsPanels/.test(pageSrc),
  'promptlab.html has the identical runIsPanels');
ok(/req\.query\.kind/.test(serverSrc), 'the feed route takes kind=');
ok(/kind=panels&limit=300/.test(pageSrc), 'the panels tab sweeps its whole history in one read');
ok(/&kind=single/.test(pageSrc), "and the PICTURE tab's Older walk asks for singles only");
ok(/!runIsPanels\(feed\[i\]\)/.test(pageSrc),
  "Older's cursor is the oldest SINGLE run — the sweep merges ancient panels runs into `feed`, "
  + 'and a cursor off one of those would skip every single run between here and it');
ok(/qGroups\.length \|\| onPanels\(\) \|\|/.test(pageSrc),
  'Older is hidden on the panels tab (the sweep already answered everything)');
ok(/&kind=' \+ \(onPanels\(\)/.test(pageSrc), 'a search is scoped to the tab server-side too');

// THE STORY SHEET (2026-08-27, Sophie: "a sheet where i give instructions for
// a story, and have the image model decide the exact panels").
ok(/req\.body\.story/.test(serverSrc) && /storySheet: true/.test(serverSrc),
  'the POST route has a story branch and stamps storySheet');
ok(/panels\.story = \{ line: PL_STORY\.line/.test(serverSrc),
  'the story line is SERVED by /styles');
ok(pageSrc.indexOf('multi-panel comic page') < 0,
  'and the page holds NO copy of it');
ok(/sheetGrid\.applySheet\(suffix, st\.sheet, PL_STORY\.layout\)/.test(serverSrc),
  "the tail's anti-grid clause is swapped on a story sheet too");
ok(/r\.storySheet \? 'story sheet' : ''/.test(serverSrc)
  && /r\.storySheet \? 'story sheet' : ''/.test(pageSrc),
  "'story sheet' is searchable, in both haystacks");
// THE SHEETS VIEW (same day: "add a section to see just the finished sheets,
// uncut, by themselves").
ok(/function sheetCellOf/.test(pageSrc) && /id="v-sheets"/.test(pageSrc),
  'the page has the Sheets chip and its cell rule');
ok(/data-grid="story"/.test(pageSrc), 'and the Story stop on the grid picker');

// ── the real page ────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.log('SKIP the page half: playwright not installed (npm install playwright --no-save)');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
}

// The REAL story wrapper out of server.js — never a second copy.
const PL_STORY_LIVE = (() => {
  const i = serverSrc.indexOf('const PL_STORY = {');
  const lit = serverSrc.slice(i + 'const PL_STORY = '.length, serverSrc.indexOf('\n};', i) + 2);
  return eval('(' + lit + ')');                        // eslint-disable-line no-eval
})();

// The REAL served geometry — computed exactly the way the styles route does.
function panelsPayload() {
  const panels = { grids: {}, sheets: {} };
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
  // Only the shapes with a tier table — a PINNED shape borrows its budget and
  // is reached through the grid, exactly as the route does it.
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

(async () => {
  const posted = [];
  const votes = [];      // every POST /api/promptlab/:id/vote the page sent
  const feedGets = [];   // every GET /api/promptlab query string the page sent
  const nine = ['a fox', 'a moon', 'a boat', 'a key', 'a well', 'a crow', 'a comb', 'a bell', 'a door'];
  const doneRun = {
    id: 'r9', status: 'done', engine: 'gptimage', gptStyle: 'dreamy', model: 'gpt-image-2',
    prompt: nine.join(' / '),
    fullPrompt: 'PREFIX\n\ngrid sentence\n' + nine.map((t, i) => `Panel ${i + 1} (x): ${t}`).join('\n') + '\n\nTAIL',
    quality: 'low', size: '2304x3456', aspectRatio: '2:3', res: '4k',
    panels: nine, grid: { across: 3, down: 3, count: 9 },
    sheet: '2304x3456', cell: '768x1152',
    sheetUrl: 'http://127.0.0.1:0/img/sheet.png',
    images: nine.map((_, i) => 'http://127.0.0.1:0/img/p' + i + '.png').map((u) => u),
    createdAt: Date.now() - 60000,
  };
  // A finished STORY sheet — the model laid out the panels, the picture IS
  // the sheet, votes and the lightbox at its ordinary index.
  const storyRun = {
    id: 'rs', status: 'done', engine: 'gptimage', gptStyle: 'dreamy', model: 'gpt-image-2',
    prompt: 'a witch loses her cat and follows it into a dream',
    fullPrompt: 'DPREF\n\n' + PL_STORY_LIVE.line + '\n\na witch loses her cat and follows it into a dream\n\nDTAIL',
    quality: 'low', size: '1024x1536', aspectRatio: '2:3', res: '1k',
    storySheet: true, outputs: 1,
    images: ['http://127.0.0.1:0/img/story.png'],
    createdAt: Date.now() - 120000,
  };
  // A run PARKED ON 'ready': the paid sheet is banked, the panels are still
  // being cut and filed. This is what she is looking at for the seconds
  // between the render landing and the panels existing (2026-08-27: "the
  // uncut sheet shud show before it's cut as soon as it's done (in panels").
  const cuttingPanels = ['a fox', 'a moon', 'a boat', 'a key'];
  const cuttingRun = {
    id: 'rc', status: 'ready', engine: 'gptimage', gptStyle: 'dreamy', model: 'gpt-image-2',
    prompt: cuttingPanels.join(' / '),
    // The REAL sent shape — head, the characters clause, the panel block, the
    // tail — built by the live sheet-grid.js, because the sheet's Prompt door
    // has to find the seam in exactly what the server really sends.
    fullPrompt: ['SHEET PREFIX — copy the drawing style.',
      sheetGrid.castBlock([{ name: 'Joan', description: 'long black hair, beady eyes' }]),
      sheetGrid.panelBlock(4, cuttingPanels), 'SHEET TAIL'].join('\n\n'),
    quality: 'low', size: '2304x1536', aspectRatio: '3:2', res: '2k',
    panels: cuttingPanels,
    grid: { across: 2, down: 2, count: 4 },
    sheet: '2304x1536', cell: '1152x768',
    sheetUrl: 'http://127.0.0.1:0/img/cutting.png',
    images: [],
    createdAt: Date.now() - 20000,
  };
  // 1x1 webp for every image the page asks for.
  const PIXEL = Buffer.from(
    'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
  let base0 = '';
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
      feedGets.push(url.search);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ runs: [doneRun, storyRun, cuttingRun], more: false }));
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
    if (/^\/api\/promptlab\/[^/]+\/vote$/.test(url.pathname) && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
        votes.push({ id: url.pathname.split('/')[3], body: JSON.parse(body || '{}') });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    }
    if (url.pathname === '/api/promptlab/characters') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        characters: [{ id: 'c1', name: 'Nina', url: base0 + '/img/c1.webp', aliases: [] }],
        max: 6,
      }));
    }
    if (url.pathname === '/api/gallery/assets/note') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ thread: [] }));
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
  base0 = base;
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
  await pickGrid(9);
  const boxes9 = await page.$$eval('#panelgrid textarea', (ts) => ts.map((t) => Math.round(t.getBoundingClientRect().left)));
  ok(new Set(boxes9).size === 3, '9 boxes sit 3 across');

  // ONE SHEET, TWO HALVES (2026-08-28, Sophie: "add character description be
  // within the existing icon - hairline toggle between description and
  // pictures"). Driven rather than grepped: the halves are shown and hidden
  // by a row that measures its own underline, and "is it on screen" is the
  // only honest question about that.
  console.log('the character sheet: pictures and descriptions');
  // A gpt tile — the sheet rides gpt-image-2's edits call, so pick one by name
  // rather than trusting whichever style the page happened to open on.
  await page.evaluate(() => {
    const sel = document.getElementById('stylepick');
    const opt = Array.prototype.find.call(sel.options, (o) => /dreamy/i.test(o.textContent));
    if (opt && sel.value !== opt.value) {
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  ok(await page.isVisible('#charsbtn'), 'the character icon is on the PANELS tab');
  await page.click('#charsbtn');
  await page.waitForSelector('#charpanel.on');
  ok(await page.isVisible('#chartabs'), 'the sheet carries the hairline row');
  ok(await page.isVisible('#charpics') && !(await page.isVisible('#chardesc')),
    'and opens on Pictures');
  const cline = await page.evaluate(() => {
    const row = document.getElementById('chartabs');
    const on = row.querySelector('button.on').getBoundingClientRect();
    return { tx: parseFloat(row.style.getPropertyValue('--tx')), left: on.left - row.getBoundingClientRect().left,
      tw: parseFloat(row.style.getPropertyValue('--tw')), w: on.width };
  });
  ok(Math.abs(cline.tx - cline.left) < 2 && Math.abs(cline.tw - cline.w) < 2,
    'its underline is MEASURED too — the same one function');

  await page.click('#chartabs button[data-ct="desc"]');
  ok(await page.isVisible('#chardesc') && !(await page.isVisible('#charpics')),
    'Descriptions takes the sheet');
  ok((await page.$$('#castrows .castrow')).length === 0, 'and starts with no rows');
  await page.click('#castadd');
  await page.waitForSelector('#castrows .castrow');
  const ph = await page.$$eval('#castrows .castrow input, #castrows .castrow textarea',
    (is) => is.map((i) => i.placeholder));
  ok(ph.length === 2 && ph[0] === 'Name' && ph[1] === 'Description',
    'a row is a name and a description, and the placeholders NAME the fields');
  await page.fill('#castrows .castrow .cnm', 'Nina');
  await page.waitForFunction(() => document.getElementById('charsn').textContent === '1');
  ok((await page.textContent('#charsn')) === '1', 'the badge counts the typed cast');
  ok(/\bon\b/.test(await page.getAttribute('#charsbtn', 'class') || ''),
    'and the icon lights');

  // THE ROW IS ON BOTH TABS NOW (2026-08-29, Sophie: "if i import solo to
  // playground / can it auto add the character description"). It used to be
  // Panels-only, on the reasoning that a single picture had nowhere to put
  // the clause — which stopped being true the moment the clause started
  // riding a single run.
  await page.click('#t-picture');
  await page.waitForFunction(() => document.querySelector('.promptwrap') && !document.querySelector('.promptwrap').hidden);
  ok(await page.isVisible('#chartabs'), 'the row is there on the Picture tab too');
  ok(await page.isVisible('#chardesc'),
    'and the half she was on is still the open one');
  await page.click('#t-panels');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length > 0);
  ok(await page.isVisible('#chardesc'),
    'coming back, the half she was on is still the open one');
  await page.click('#charsbtn');

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

  // HER WORDS COME WITH HER (2026-08-29, Sophie: "if there's text in one of
  // the grids if I transferred to that grid, my words don't transfer"). This
  // block used to assert that 9 → 4 → 9 came back with all NINE — i.e. that
  // each grid kept its own separate draft, untouched. That is superseded: a
  // switch now CARRIES what is in the boxes into the grid she is arriving at.
  // The carry's own rules (the pop-up over an undrawn draft, the silence over
  // a drawn one) live in test-playground-panel-carry.js; this only pins that
  // the switch itself moves her words and loses none of them.
  // Picking a grid can now stop to ask (an undrawn draft is about to be
  // replaced); this test is not about that question, so it answers "bring
  // mine over" and carries on.
  async function pickGrid(g) {
    await page.click('#gridpick button[data-grid="' + g + '"]');
    if (await page.isVisible('#ask')) await page.click('#askyes');
    await page.waitForFunction((sel) => (sel === 'story'
      ? !!document.querySelector('#panelgrid textarea[data-story]')
      : document.querySelectorAll('#panelgrid textarea').length === Number(sel)), String(g));
  }

  console.log('her words come with her across a grid switch');
  await pickGrid(4);
  const four = await page.$$eval('#panelgrid textarea', (ts) => ts.map((t) => t.value));
  ok(four.join('|') === nine.slice(0, 4).join('|'), '9 → 4 brings the first four with her');
  await pickGrid(9);
  const back = await page.$$eval('#panelgrid textarea', (ts) => ts.map((t) => t.value));
  ok(back.join('|') === nine.slice(0, 4).concat(['', '', '', '', '']).join('|'),
    'and 4 → 9 puts those four back in their own cells');

  // THE 2 OPTION IS TWO LANDSCAPE PANELS, STACKED (2026-08-27, Sophie: "2
  // option shud be landscape in panels"). Measured off the real boxes: a
  // pinned cell shape is invisible to every markup assertion — a 2-across
  // grid of portrait boxes and a stacked pair of landscape ones are the same
  // two <textarea>s. And the canvas toggle must come OFF, because it decides
  // nothing here.
  console.log('the 2 option is landscape, stacked, and the toggle stands down');
  await pickGrid(2);
  const two = await page.$$eval('#panelgrid textarea', (ts) => ts.map((t) => {
    const r = t.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: r.width, h: r.height, ph: t.placeholder };
  }));
  ok(two.length === 2, 'two boxes');
  ok(new Set(two.map((b) => b.x)).size === 1 && new Set(two.map((b) => b.y)).size === 2,
    'stacked — one column, two rows (measured)');
  ok(two.every((b) => b.w > b.h), 'each box is WIDER than it is tall');
  ok(two.every((b) => Math.abs(b.w / b.h - 3 / 2) < 0.12), 'and sits at 3:2');
  ok(two[0].ph === 'top' && two[1].ph === 'bottom', 'named top and bottom');
  ok(!(await page.isVisible('#canvastog')),
    'the canvas toggle comes off — a pinned grid ignores it');
  await page.fill('#panelgrid textarea[data-panel="0"]', 'a dog');
  await page.fill('#panelgrid textarea[data-panel="1"]', 'a cat');
  const before = await page.$$eval('#pendings .cell', (c) => c.length);
  await page.click('#go');
  await page.waitForFunction((n) => document.querySelectorAll('#pendings .cell').length === n + 2,
    before);
  const twoPost = posted[posted.length - 1] || {};
  ok(twoPost.grid === 2 && (twoPost.panels || []).join('|') === 'a dog|a cat',
    'the POST carries the two panels');
  // Pendings render NEWEST FIRST, so the two-panel run's placeholders lead.
  const phAr = await page.$$eval('#pendings .cell', (cs) => cs.slice(0, 2)
    .map((c) => c.style.getPropertyValue('--ar').replace(/\s/g, '')).join('|'));
  ok(phAr === '3/2|3/2',
    'the pending placeholders wear the landscape cell, so the wall cannot re-flow');
  // …and the toggle comes back the moment the grid stops pinning a shape.
  await pickGrid(4);
  ok(await page.isVisible('#canvastog'), 'and comes back on a grid that follows it');
  await pickGrid(9);

  console.log('the STORY option — the model decides the panels');
  // 2026-08-27, Sophie: "a sheet where i give instructions for a story, and
  // have the image model decide the exact panels".
  await pickGrid('story');
  ok((await page.$$eval('#panelgrid textarea', (t) => t.length)) === 1, 'ONE box — the story');
  ok((await page.getAttribute('#panelgrid textarea[data-story]', 'placeholder')) === 'The story',
    "named 'The story' and nothing more");
  ok(await page.inputValue('#panelgrid textarea[data-story]') === '', 'and it ships EMPTY');
  ok(await page.isVisible('#canvastog'),
    'the canvas toggle applies — it picks the SHEET itself here');
  const postedBefore = posted.length;
  await page.click('#go');
  await page.waitForFunction(() => !document.getElementById('err').hidden);
  ok(/Type the story first/.test(await page.textContent('#err')), 'an empty story refuses');
  ok(posted.length === postedBefore, 'and POSTs nothing');
  await page.fill('#panelgrid textarea[data-story]', 'a witch loses her cat and follows it into a dream');
  const cellsBefore = await page.$$eval('#pendings .cell', (c) => c.length);
  await page.click('#go');
  await page.waitForFunction((n) => document.querySelectorAll('#pendings .cell').length === n + 1,
    cellsBefore);
  const sp = posted[posted.length - 1] || {};
  ok(sp.story === true && sp.prompt === 'a witch loses her cat and follows it into a dream',
    'the POST carries story:true and her words');
  ok(!sp.panels && !sp.grid, 'and NO panels/grid — the model decides');
  ok(!!(sp.canvas && sp.quality && sp.res), 'with the canvas, quality and tier');
  ok((await page.$$eval('#pendings .cell', (c) => c.length)) === cellsBefore + 1,
    'the pending card holds ONE placeholder — one sheet');
  await pickGrid(9);

  console.log('the feed');
  const runCells = await page.$$eval('#runs .run', (runs) => runs.map((r) => ({
    cells: r.querySelectorAll('.grid img').length,
    tags: Array.prototype.map.call(r.querySelectorAll('.tag'), (t) => t.textContent),
  })));
  const panelsRun = runCells.find((r) => r.cells === 9);
  ok(!!panelsRun, 'the done panels run renders its nine cut panels');
  ok(panelsRun && panelsRun.tags.indexOf('panels 3x3') >= 0, "tagged 'panels 3x3'");

  console.log('the uncut sheet, while the cut runs');
  // 2026-08-27, Sophie: "the uncut sheet shud show before it's cut as soon as
  // it's done (in panels". The run is parked on 'ready' with a banked sheet
  // and no panels yet.
  ok((await page.$$eval('#runs img[data-run="rc"]', (i) => i.length)) === 1,
    'a run mid-cut shows ONE picture — its sheet');
  ok((await page.getAttribute('#runs img[data-run="rc"]', 'data-i')) === '-1',
    'at the virtual sheet index');
  ok(/cutting\.png/.test(await page.getAttribute('#runs img[data-run="rc"]', 'src') || ''),
    'pointing at sheetUrl');
  // MEASURED, not read off markup: a wide sheet drawn in cells cut for 2:3
  // panels renders as a plausible picture and is simply squashed — the whole
  // reason this stage used to be skipped.
  const cutBox = await page.evaluate(() => {
    const im = document.querySelector('#runs img[data-run="rc"]');
    const r = im.closest('.cell').getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  ok(Math.abs((cutBox.w / cutBox.h) - (2304 / 1536)) < 0.02,
    "in the SHEET's own 3:2 shape (measured), never the panel cell's 2:3");
  const cutTags = await page.$$eval('#runs .run', (runs) => runs
    .map((r) => ({
      run: r.querySelector('img') && r.querySelector('img').getAttribute('data-run'),
      tags: Array.prototype.map.call(r.querySelectorAll('.tag'), (t) => t.textContent),
    })).find((x) => x.run === 'rc'));
  ok(!!cutTags && cutTags.tags.some((t) => /cutting/.test(t)),
    "and the card says it is still cutting");
  await page.click('#runs img[data-run="rc"]');
  await page.waitForFunction(() => {
    const el = document.getElementById('clightbox');
    return el && el.style.display !== 'none';
  });
  // The CARD carries "sheet — cutting…" (asserted above); the lightbox caption
  // is the house three slots and nothing else (2026-08-27, Sophie: "just need
  // model quality and pixels + 1/4"), so the stage is never said twice.
  const cutLb = await page.evaluate(() => {
    const el = document.querySelector('#clightbox .cltag, #clightbox .clcap');
    return el ? el.textContent.trim() : '';
  });
  ok(/^Dreamy · \w+ · \w+$/.test(cutLb) && !/uncut sheet|cutting/.test(cutLb),
    'the lightbox caption stays style · quality · size — got: ' + cutLb);

  console.log("the SHEET's prompt door — the whole prompt, not just her words");
  // 2026-08-29, Sophie's screenshot of exactly this view: "why is this prompt
  // incomplete??? it's missing the style half, and characters etc". The run's
  // `prompt` is the ' / '-joined box text, which is NOT verbatim in the sent
  // string, so the split failed silently and the sheet's overlay showed no
  // style half at all — and no Style button, which is indistinguishable from
  // the plain tile's honest silence. Verified failing 3 against the pre-fix
  // page.
  const sheetPrompt = await page.evaluate(() => {
    const el = document.getElementById('clightbox');
    const btns = el.querySelectorAll('button');
    for (const bt of btns) if (/prompt/i.test(bt.textContent)) { bt.click(); break; }
    const style = Array.prototype.find.call(
      el.querySelectorAll('button'), (b) => /^style$/i.test(b.textContent.trim()));
    const words = el.textContent;
    if (style) style.click();
    return { hasStyleBtn: !!style, words, after: style ? el.textContent : '' };
  });
  ok(/Panel 1 \(top left\): a fox/.test(sheetPrompt.words),
    "the content is the labeled panel block — the words really sent");
  ok(sheetPrompt.hasStyleBtn, 'the sheet has a STYLE half to open at all');
  ok(/SHEET PREFIX/.test(sheetPrompt.after),
    'the style half carries the style head');
  ok(/Joan/.test(sheetPrompt.after) && /long black hair/.test(sheetPrompt.after),
    'and the CHARACTERS clause — the half her screenshot was missing');
  await page.evaluate(() => { if (window.__assetLightboxClose) window.__assetLightboxClose(); });

  console.log('the lightbox');
  await page.click('#runs img[data-run="r9"][data-i="3"]');
  await page.waitForFunction(() => {
    const el = document.getElementById('clightbox');
    return el && el.style.display !== 'none';
  });
  const lbText = await page.evaluate(() => document.getElementById('clightbox').textContent);
  // THE REQUIRED THIRD SLOT (2026-08-27, Sophie's screenshot of this caption:
  // "shud say quality and 1k,2k/4k · 1/4"). It had never carried one — the
  // slot was built into what the Playground FILES and this caption is drawn
  // client-side from the run doc, so it was out of scope and stayed empty for
  // four days while the panels tab added two slots of its own beside it.
  // A cut panel says the FRACTION and the SHEET's tier, never its own pixels
  // (a ninth of a 4K sheet lands on the 1K rung and reads as a small picture).
  ok(/1\/9 \(4K\)/.test(lbText), "and the size slot says '1/9 (4K)', not the panel's own rung");
  // The house caption ORDER — model · quality · size — so the slot reads as
  // the third part of a caption rather than a fourth thing tacked on the end.
  ok(/low\s*·\s*1\/9 \(4K\)/.test(lbText), 'and it sits right after the quality');
  // THE CAPTION IS THREE SLOTS AND NOTHING ELSE (2026-08-27, Sophie: "extra
  // notes - dreamy etc … just need model quality and pixels + 1/4", then, on
  // the first cut of it: "u added panel 2/4 and the chatgpt2 … get rid").
  // Slot 1 is the STYLE — the tile she drew with, which is the model as far
  // as this page is concerned; the ratio, the grid and which panel this is
  // are on the card's tag row or in the size slot already.
  const cap = await page.evaluate(() => {
    const el = document.querySelector('#clightbox .cltag, #clightbox .clcap');
    return el ? el.textContent.trim() : '';
  });
  ok(cap === 'Dreamy · low · 1/9 (4K)',
    'the whole caption is style · quality · size — got: ' + cap);
  ok(!/panel|of 9|gpt-image-2/.test(cap), 'no panel counter and no model id');
  // Drawn by the SHARED derivation, not a tier table copied into the page —
  // a copy drifts the day the boundaries move.
  ok(await page.evaluate(() => !!(window.__sizeTier && window.__sizeTier.runSize)),
    'the page loaded the real /size-tier.js');
  // The prompt door opens on CONTENT = that panel's own words.
  const lbHas = await page.evaluate(() => {
    const el = document.getElementById('clightbox');
    const btns = el.querySelectorAll('button');
    for (const bt of btns) if (/prompt/i.test(bt.textContent)) { bt.click(); break; }
    return document.getElementById('clightbox').textContent;
  });
  ok(/a key/.test(lbHas), "and the prompt shows THAT panel's own words");

  console.log("the lightbox's put-back — ONE picture, ONE box");
  // 2026-08-27, Sophie: "pressing the playground button on images made by
  // panels should copy text into the single picture … not the whole panel".
  // The lightbox is showing panel 4, so its put-back is panel 4's own words in
  // the ONE box, on the PICTURE tab — not the whole grid back in nine boxes.
  await page.evaluate(() => {
    const el = document.getElementById('clightbox');
    const btns = el.querySelectorAll('button');
    for (const bt of btns) if (/back in the box/i.test(bt.getAttribute('aria-label') || bt.title || bt.textContent)) { bt.click(); return; }
    throw new Error('no put-back action in the lightbox');
  });
  let putBack = false;
  try {
    await page.waitForFunction(() => document.getElementById('prompt').value === 'a key', null, { timeout: 4000 });
    putBack = true;
  } catch (e) { /* pre-fix: it refilled the nine panel boxes instead */ }
  ok(putBack, "panel 4's own words land in the one prompt box");
  ok(/\bon\b/.test(await page.getAttribute('#t-picture', 'class') || ''),
    'and it switches to the PICTURE tab, where that box lives');
  ok(await page.isVisible('.promptwrap'), 'so the words she was handed are on screen');
  await page.evaluate(() => { if (window.__assetLightboxClose) window.__assetLightboxClose(); });

  console.log('the copy button');
  // Wipe the boxes, then ask the run's copy button to refill them.
  await page.evaluate(() => {
    ['promptlab_panels_9', 'promptlab_panels_4'].forEach((k) => localStorage.removeItem(k));
    document.querySelectorAll('#panelgrid textarea').forEach((t) => { t.value = ''; });
  });
  await page.click('#t-panels');
  await page.waitForFunction(() => document.querySelectorAll('#panelgrid textarea').length > 0);
  await page.click('#runs .run .copybtn[data-copy="r9"]');
  await page.waitForFunction(() => {
    const ts = document.querySelectorAll('#panelgrid textarea');
    return ts.length === 9 && ts[0].value === 'a fox';
  });
  ok(true, 'the copy button refills the nine boxes');
  ok(/\bon\b/.test(await page.getAttribute('#t-panels', 'class') || ''), 'on the Panels tab');

  console.log('the gallery is separate per tab');
  // 2026-08-27, Sophie: "separate the gallery for playground for single pics
  // vs panels". The feed under the tab follows it — a panels run (and its
  // pending placeholders) live in the PANELS gallery and nowhere else.
  ok(feedGets.some((s) => /kind=panels/.test(s)),
    'the panels tab swept its history (GET ?kind=panels)');
  ok((await page.$$eval('#runs img[data-run="r9"]', (i) => i.length)) === 9,
    'the panels run is in the PANELS gallery');
  ok((await page.$$eval('#more .morebtn', (b) => b.length)) === 0,
    'no Older button on the panels tab');
  const pendOnPanels = await page.$$eval('#pendings .cell', (c) => c.length);
  ok(pendOnPanels > 0, 'the pending sheets are on this tab');
  await page.click('#t-picture');
  await page.waitForFunction(() => document.querySelectorAll('#runs img[data-run="r9"]').length === 0);
  ok(true, 'and OUT of the PICTURE gallery');
  ok((await page.$$eval('#pendings .cell', (c) => c.length)) === 0,
    'the pending sheets step out with it');
  await page.click('#t-panels');
  await page.waitForFunction((n) => document.querySelectorAll('#pendings .cell').length === n, pendOnPanels);
  await page.waitForFunction(() => document.querySelectorAll('#runs img[data-run="r9"]').length === 9);
  ok(true, 'and everything comes back on PANELS');
  ok((await page.$$eval('#runs img[data-run="rs"]', (i) => i.length)) === 1,
    'a story sheet lives in the PANELS gallery too');
  const rsTags = await page.$$eval('#runs .run', (runs) => runs
    .map((r) => Array.prototype.map.call(r.querySelectorAll('.tag'), (t) => t.textContent))
    .find((t) => t.indexOf('story sheet') >= 0));
  ok(!!rsTags, "tagged 'story sheet'");

  console.log('the sheets view — just the finished sheets, uncut');
  // 2026-08-27, Sophie: "add a section to see just the finished sheets,
  // uncut, by themselves".
  ok(await page.isVisible('#v-sheets'), 'the Sheets chip is on the panels tab');
  await page.click('#v-sheets');
  await page.waitForFunction(() => document.querySelectorAll('#runs img[data-run="r9"][data-i="-1"]').length === 1);
  ok(true, "the grid run's cell is its banked UNCUT sheet (virtual index -1)");
  ok(/sheet\.png/.test(await page.getAttribute('#runs img[data-run="r9"][data-i="-1"]', 'src') || ''),
    'and it points at sheetUrl, never a cut panel');
  ok((await page.$$eval('#runs img[data-run="r9"]', (i) => i.length)) === 1,
    'the nine cut panels are folded to the one sheet');
  ok((await page.$$eval('#runs img[data-run="rs"]', (i) => i.length)) === 1,
    'a story sheet shows as itself — it IS its sheet');
  ok(await page.isVisible('#v-liked') && await page.isVisible('#v-hidex'),
    'the ♥/✕ chips STAY — a sheet carries its own vote now');
  await page.click('#runs img[data-run="r9"][data-i="-1"]');
  await page.waitForFunction(() => {
    const el = document.getElementById('clightbox');
    return el && el.style.display !== 'none';
  });
  // THE SHEET'S OWN SLOT IS THE WHOLE SHEET (2026-08-27, Sophie's screenshot:
  // it read "1/4 (1K) · 1:1 · panels 2x2 · uncut sheet · 2x2" — the run's
  // fraction printed over the picture that is every panel at once, then
  // contradicted two slots later). Its tier says it is the sheet; nothing has
  // to spell that out beside a fraction that no longer claims otherwise.
  const sheetCap = await page.evaluate(() => {
    const el = document.querySelector('#clightbox .cltag, #clightbox .clcap');
    return el ? el.textContent.trim() : '';
  });
  ok(sheetCap === 'Dreamy · low · 4K',
    "the sheet is captioned with its OWN tier — got: " + sheetCap);
  ok(!/1\/9|uncut sheet|panels 3x3|2:3|panel/.test(sheetCap),
    'and carries none of the extra notes');
  // THE THREE BUTTONS THE SHEET HAD LOST (same day: "missing three buttons
  // too") — ♥, ✕ and the Story Room walk. A banked sheet is a picture she
  // paid for; it was view-only only because a vote is an index into `images`.
  ok((await page.$$eval('#clightbox .vote', (b) => b.length)) === 2,
    '♥ and ✕ are on the virtual sheet');
  const sheetActs = await page.$$eval('#clightbox .lbacts button',
    (bs) => bs.map((b) => b.getAttribute('aria-label') || ''));
  ok(sheetActs.some((l) => /story room/i.test(l)),
    'and the Story Room walk — got: ' + sheetActs.join(' | '));
  // The ♥ posts at the virtual index, which is what the run doc keys it on.
  await page.evaluate(() => document.querySelector('#clightbox .vote.heart').click());
  for (let t = 0; t < 40 && !votes.length; t++) await new Promise((r) => setTimeout(r, 50));
  const cast = votes[votes.length - 1];
  ok(cast && cast.id === 'r9' && cast.body && cast.body.image === -1 && cast.body.vote === 'like',
    'the heart casts at image -1 on the run — got: ' + JSON.stringify(cast));
  await page.evaluate(() => { if (window.__assetLightboxClose) window.__assetLightboxClose(); });
  await page.click('#v-sheets');
  await page.waitForFunction(() => document.querySelectorAll('#runs img[data-run="r9"][data-i="-1"]').length === 0);
  ok(await page.isVisible('#v-liked'), 'off again — the chips are unchanged');

  console.log('arriving with a ported prompt');
  // The tab is STICKY, and a panel image is exactly the picture she is on the
  // PANELS tab when she taps its Playground button — so a ported prompt used
  // to land in `.promptwrap`, which that tab HIDES, and the next Generate drew
  // her saved panel boxes instead. Silent: the ported words were never used.
  const ported = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await ported.addInitScript(() => { try { localStorage.setItem('promptlab_tab', 'panels'); } catch (e) { /* private mode */ } });
  await ported.goto(base + '/playground?prompt=' + encodeURIComponent('a lighthouse in fog')
    + '&style=chatgpt&sameref=1');
  await ported.waitForFunction(() => document.querySelectorAll('#plabtabs button').length === 2);
  ok(/\bon\b/.test(await ported.getAttribute('#t-picture', 'class') || ''),
    'a ported prompt lands on the PICTURE tab, whatever tab she left');
  ok(await ported.inputValue('#prompt') === 'a lighthouse in fog', 'with her words in the one box');
  ok(await ported.isVisible('.promptwrap'), 'and that box on screen');
  ok(!(await ported.isVisible('#panelgrid')), 'the panel boxes step aside');
  // Nothing else about the port moved.
  ok(!(await ported.getAttribute('#reftag', 'class')),
    'and the sameref tag is still silent (2026-08-31, "delete the red")');
  await ported.close();

  // A plain open still honours her sticky tab — the switch is the PORT's, not
  // a new default.
  const plain = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await plain.addInitScript(() => { try { localStorage.setItem('promptlab_tab', 'panels'); } catch (e) { /* private mode */ } });
  await plain.goto(base + '/playground');
  await plain.waitForFunction(() => document.querySelectorAll('#plabtabs button').length === 2);
  ok(/\bon\b/.test(await plain.getAttribute('#t-panels', 'class') || ''),
    'a plain open still opens on the tab she left');
  await plain.close();

  await browser.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall pass');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FAIL (harness):', e); process.exit(1); });
