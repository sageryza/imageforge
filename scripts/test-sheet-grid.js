#!/usr/bin/env node
/*
 * test-sheet-grid.js — the panel sheet's geometry and prompt block (Aug 2026,
 * Sophie: "we make a picture and cut it into panels … describe each panel
 * individually"). Pure, no network, no browser.
 *
 *   1. THE 1×1 ANCHOR. The derivation must reproduce all SIX of the
 *      Playground's own canvases from the constraints alone, with the budgets
 *      read out of the real PL_GPT.res literal in server.js — the strongest
 *      check that the math is right, and the guarantee the module holds no
 *      copied numbers that can drift.
 *   2. EVERY grid × shape × tier IS A LEGAL gpt-image-2 CANVAS with
 *      WHOLE-PIXEL CELLS — a cut must be a lossless crop of the model's own
 *      pixels, never a resample. The derived canvases are also pinned
 *      exactly, so a change to the derivation is loud, not silent.
 *   3. THE 2×2 GRIDS LAND ON THE LIVE TIER CANVASES EXACTLY (cells are exact
 *      halves), which is what makes a quartered sheet directly comparable to
 *      the Playground's own pictures.
 *   4. cellRects TILES THE SHEET — no gap, no overlap, reading order.
 *   5. NAMING AND THE GRID SENTENCE — positions, layoutWords, panelBlock with
 *      her texts verbatim.
 *   5b. THE CAST CLAUSE ROUND-TRIPS. Two openings, one row format, and
 *      castParse reads either back — that is what lets a cut panel carry its
 *      character descriptions to the Playground through nothing but the filed
 *      style half (2026-08-29, Sophie: "can it auto add the character
 *      description from the original multi sheet").
 *   6. THE DREAMY SHEET-SWAP COMPOSES WITH THE NO-TEXT SWAP. `sheet.from`
 *      must be a verbatim substring of the LIVE dreamy suffix and the swap
 *      must leave `noText.from` intact — the two swaps touch
 *      disjoint clauses of one tail, and only reading the real literals out
 *      of server.js can prove they still do (the test-playground-notext.js
 *      pinning pattern). An edited tail must make applySheet a NO-OP.
 *
 *   node scripts/test-sheet-grid.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const sheetGrid = require(path.join(ROOT, 'sheet-grid.js'));
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

let fails = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else { console.log('  FAIL ' + what); fails++; }
};

// The real `res` literal out of server.js — not a second copy of the numbers.
function resTable() {
  const i = serverSrc.indexOf('\n  res: {');
  const b = serverSrc.slice(i + '\n  res: '.length);
  let lit = b.slice(0, b.indexOf('\n  },') + 4).trim().replace(/,$/, '');
  lit = lit.replace(/^\s*\/\/.*$/gm, '');
  return eval('(' + lit + ')');                      // eslint-disable-line no-eval
}
const RES = resTable();
const dim = (s) => s.split('x').map(Number);

console.log('the 1x1 anchor: the derivation reproduces the six live canvases');
Object.keys(RES).forEach((shape) => {
  const s = sheetGrid.SHAPES[shape];
  Object.keys(RES[shape].tiers).forEach((tier) => {
    const [w, h] = dim(RES[shape].tiers[tier].size);
    const got = sheetGrid.derive(s.w, s.h, 1, 1, w * h);
    ok(got && got.W === w && got.H === h,
      `${shape} ${tier}: 1x1 derives ${w}x${h} (got ${got && `${got.W}x${got.H}`})`);
  });
});

console.log('every grid x shape x tier is legal, whole-pixel, and pinned');
// Pinned by hand from the derivation, so a change to the math is loud.
// The 2 option PINS a landscape cell, so its row is the SAME under both
// toggles — that identity is the contract the page's hidden canvas toggle
// rests on, and it is asserted below as well as pinned here.
const EXPECT = {
  portrait: {
    2: { '1k': '1104x1472', '2k': '1680x2240', '4k': '2448x3264' },
    4: { '1k': '1024x1536', '2k': '1568x2352', '4k': '2336x3504' },
    9: { '1k': '1056x1584', '2k': '1536x2304', '4k': '2304x3456' },
  },
  square: {
    2: { '1k': '1104x1472', '2k': '1680x2240', '4k': '2448x3264' },
    4: { '1k': '1024x1024', '2k': '1920x1920', '4k': '2880x2880' },
    9: { '1k': '1008x1008', '2k': '1920x1920', '4k': '2880x2880' },
  },
};
Object.keys(EXPECT).forEach((shape) => {
  Object.keys(EXPECT[shape]).forEach((grid) => {
    Object.keys(EXPECT[shape][grid]).forEach((tier) => {
      const plan = sheetGrid.sheetFor(shape, Number(grid), tier, RES);
      const want = EXPECT[shape][grid][tier];
      ok(plan && plan.sheet === want,
        `${shape} ${grid}-panel ${tier}: ${want} (got ${plan && plan.sheet})`);
      if (!plan) return;
      ok(plan.W % 16 === 0 && plan.H % 16 === 0, `  edges %16 (${plan.sheet})`);
      ok(plan.W <= 3840 && plan.H <= 3840, '  long edge <= 3840');
      const px = plan.W * plan.H;
      ok(px >= 655360 && px <= 8294400, `  pixels in range (${px})`);
      ok(Math.max(plan.W, plan.H) / Math.min(plan.W, plan.H) <= 3, '  ratio <= 3');
      ok(plan.W === plan.across * plan.cellW && plan.H === plan.down * plan.cellH,
        `  whole-pixel cells (${plan.cell})`);
      // The cell keeps its shape exactly — a tier is the same panel at more
      // pixels, never a different crop. A grid that PINS its shape is measured
      // against the PINNED one, not the toggle's.
      const s = sheetGrid.SHAPES[sheetGrid.GRIDS[grid].shape || shape];
      ok(plan.cellW * s.h === plan.cellH * s.w, `  cell is exactly ${s.aspectRatio}`);
      ok(plan.aspectRatio === s.aspectRatio, `  plan reports ${s.aspectRatio}`);
    });
  });
});

console.log('the 2x2 grids land on the live tier canvases exactly');
Object.keys(RES).forEach((shape) => {
  Object.keys(RES[shape].tiers).forEach((tier) => {
    const plan = sheetGrid.sheetFor(shape, 4, tier, RES);
    ok(plan && plan.sheet === RES[shape].tiers[tier].size,
      `${shape} ${tier}: 4-panel sheet IS ${RES[shape].tiers[tier].size}`);
  });
});

console.log('cellRects tiles the sheet — no gap, no overlap, reading order');
[[1472, 1104, 2, 1], [2336, 3504, 2, 2], [2304, 3456, 3, 3]].forEach(([W, H, a, d]) => {
  const rects = sheetGrid.cellRects(W, H, a, d);
  ok(rects && rects.length === a * d, `${a}x${d} on ${W}x${H}: ${a * d} rects`);
  if (!rects) return;
  const area = rects.reduce((s, r) => s + r.width * r.height, 0);
  ok(area === W * H, '  areas sum to the sheet exactly');
  const seen = new Set(rects.map((r) => `${r.left},${r.top}`));
  ok(seen.size === rects.length, '  no two rects share an origin');
  ok(rects.every((r) => r.left + r.width <= W && r.top + r.height <= H
    && r.left >= 0 && r.top >= 0), '  every rect inside the sheet');
  ok(rects[0].left === 0 && rects[0].top === 0, '  first rect is top-left');
  const last = rects[rects.length - 1];
  ok(last.left + last.width === W && last.top + last.height === H,
    '  last rect is bottom-right');
  // Reading order: tops never decrease; within a row, lefts increase.
  let ordered = true;
  for (let i = 1; i < rects.length; i++) {
    if (rects[i].top < rects[i - 1].top) ordered = false;
    if (rects[i].top === rects[i - 1].top && rects[i].left <= rects[i - 1].left) ordered = false;
  }
  ok(ordered, '  reading order, left to right then top to bottom');
});
ok(sheetGrid.cellRects(1000, 900, 3, 1) === null,
  'a sheet that does not divide answers null, never a rounded rect');

console.log('the seams land mid-gutter, not on the math line');
// A synthetic sheet: tan paper, each panel a dark 3px border, the whole
// interior grid OFFSET from the mathematical lines — exactly the live bug
// (the fox and key panels cut on their frame edge, 2026-08-26).
function drawSheet(W, H, across, down, offset, opts) {
  const paper = (opts && opts.paper) != null ? opts.paper : 225;   // light
  const inkPx = (opts && opts.ink) != null ? opts.ink : 30;        // dark
  const g = new Uint8Array(W * H).fill(paper);
  if (opts && opts.flat) return g;
  const GUT = 8, BORDER = 3;
  const xEdges = [0].concat(Array.from({ length: across - 1 },
    (_, i) => Math.round(((i + 1) * W) / across) + offset), [W]);
  const yEdges = [0].concat(Array.from({ length: down - 1 },
    (_, i) => Math.round(((i + 1) * H) / down) + offset), [H]);
  const rect = (x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const onEdge = x < x0 + BORDER || x >= x1 - BORDER || y < y0 + BORDER || y >= y1 - BORDER;
        if (onEdge) g[y * W + x] = inkPx;
      }
    }
  };
  for (let r = 0; r < down; r++) {
    for (let c = 0; c < across; c++) {
      rect(xEdges[c] + (c ? GUT : GUT), yEdges[r] + GUT,
        xEdges[c + 1] - GUT, yEdges[r + 1] - GUT);
    }
  }
  return g;
}
[[400, 600, 2, 2, 9], [402, 603, 3, 3, -7], [480, 360, 2, 1, 11]].forEach(([W, H, a, d, off]) => {
  const g = drawSheet(W, H, a, d, off);
  const s = sheetGrid.findSeams(g, W, H, a, d);
  const mathX = Array.from({ length: a - 1 }, (_, i) => Math.round(((i + 1) * W) / a));
  const mathY = Array.from({ length: d - 1 }, (_, i) => Math.round(((i + 1) * H) / d));
  const nearTrue = (got, math) => got.every((v, i) => Math.abs(v - (math[i] + off)) <= 2);
  ok(nearTrue(s.xs, mathX) && nearTrue(s.ys, mathY),
    `${a}x${d} grid offset ${off}px: every seam within 2px of the TRUE gutter middle`);
  ok(s.xs.every((v, i) => v !== mathX[i]) || off === 0,
    '  (and provably NOT the math line — the old cut fails this sheet)');
  const boxes = sheetGrid.seamBoxes(s.xs, s.ys, W, H);
  ok(boxes.length === a * d
    && boxes.reduce((n, b) => n + b.width * b.height, 0) === W * H
    && boxes[0].left === 0 && boxes[boxes.length - 1].left + boxes[boxes.length - 1].width === W,
    '  seamBoxes tile the sheet exactly, reading order');
});
// The fallback: a sheet with no gutters cuts EXACTLY on the math lines —
// the worst case is byte-for-byte the old behavior.
[{ flat: true }, { paper: 40, ink: 30 }].forEach((opts, i) => {
  const g = drawSheet(300, 450, 3, 3, 6, opts);
  const s = sheetGrid.findSeams(g, 300, 450, 3, 3);
  ok(String(s.xs) === '100,200' && String(s.ys) === '150,300',
    (i ? 'a low-contrast sheet' : 'a flat borderless sheet') + ' falls back to the exact math lines');
});

// THE 2 OPTION IS TWO LANDSCAPE PANELS, STACKED (2026-08-27, Sophie: "2
// option shud be landscape in panels") — a pinned cell shape, so the canvas
// toggle decides NOTHING for it and both toggles derive the same sheet. It
// borrows the portrait tier's pixel budget (the same panel rotated), which is
// why there is no `landscape` row in PL_GPT.res to keep in step.
console.log('the 2 option is pinned landscape, and the toggle cannot move it');
ok(sheetGrid.GRIDS[2].across === 1 && sheetGrid.GRIDS[2].down === 2,
  '2 is one across, two down — stacked');
ok(sheetGrid.GRIDS[2].shape === 'landscape', '2 pins the landscape cell');
ok(sheetGrid.SHAPES.landscape.aspectRatio === '3:2'
  && sheetGrid.SHAPES.landscape.budget === 'portrait',
  'landscape is 3:2 and borrows portrait\'s budget');
Object.keys(RES.portrait.tiers).forEach((tier) => {
  const a = sheetGrid.sheetFor('portrait', 2, tier, RES);
  const b = sheetGrid.sheetFor('square', 2, tier, RES);
  ok(a && b && a.sheet === b.sheet && a.cell === b.cell,
    `${tier}: both toggles derive the same landscape sheet (${a && a.sheet})`);
  ok(a && a.cellW > a.cellH, `${tier}: the CELL is wider than it is tall`);
  ok(a && a.shape === 'landscape', `${tier}: the plan names its cell shape`);
});
// No res row is needed for a pinned shape, and adding one would be a second
// copy of the same budget — the derivation must not depend on it.
ok(!RES.landscape, 'landscape has no tier table of its own');

console.log('naming');
ok(String(sheetGrid.positions(2)) === 'top,bottom', '2: top, bottom');
ok(String(sheetGrid.positions(4)) === 'top left,top right,bottom left,bottom right',
  '4: the corners');
ok(String(sheetGrid.positions(9)) === 'top left,top middle,top right,middle left,'
  + 'center,middle right,bottom left,bottom middle,bottom right',
  '9: rows named, the middle cell is "center"');
ok(sheetGrid.layoutWords(2) === 'a single column of 2 panels, one above the other',
  'layout words for 2');
const col = sheetGrid.panelBlock(2, ['a dog', 'a cat']);
ok(/equal rectangles, 1 across and 2 down/.test(col), '2: the geometry is stated');
ok(/In reading order, top to bottom:/.test(col),
  '2: the reading order names only the axis that exists');
ok(col.indexOf('Panel 1 (top): a dog') > 0 && col.indexOf('Panel 2 (bottom): a cat') > 0,
  '2: panels numbered AND named');
ok(sheetGrid.layoutWords(9) === 'a 3x3 grid of 9 panels', 'layout words for 9');

console.log('the panel block carries her words verbatim');
const block = sheetGrid.panelBlock(4, ['a fox', 'a moon', 'a boat', 'a key']);
ok(block.indexOf('a 2x2 grid of 4 separate panels') > 0, 'the grid sentence names the grid');
ok(/equal rectangles, 2 across and 2 down/.test(block), 'the geometry is stated');
// HER WORDING, 2026-08-27: the second geometry clause ("with straight edges
// exactly on the grid lines, no gutters and no outer margin") is gone at her
// ask, and findSeams — not the sentence — is what keeps the cut off the
// borders. Pinned so nobody "restores" it.
ok(!/gutter|outer margin|exactly on the grid lines/i.test(block),
  'the second geometry clause stays OUT — her wording');
ok(block.indexOf('Panel 1 (top left): a fox') > 0
  && block.indexOf('Panel 4 (bottom right): a key') > 0, 'panels numbered AND named');
ok(block.indexOf('a fox') < block.indexOf('a moon')
  && block.indexOf('a boat') < block.indexOf('a key'), 'reading order preserved');

console.log('the characters clause');
// HER RULE, stated outright (2026-08-27): "The character clause only applies
// if there's at least one character." An empty cast — absent, [], or rows
// with nothing typed in them — sends NO clause, never an introduction to
// nobody.
ok(sheetGrid.castBlock() === '', 'no cast at all: nothing');
ok(sheetGrid.castBlock([]) === '', 'an empty list: nothing');
ok(sheetGrid.castBlock([{ name: '  ', description: '' }]) === '',
  'rows with nothing typed in them: nothing');
const cb = sheetGrid.castBlock([
  { name: 'Nina', description: 'twelve, red coat, always carrying the cat' },
  { name: '', description: 'a tall man with a limp' },
  { name: 'Bo', description: '' },
]);
ok(cb.split('\n').length === 4, 'an intro and one line per character');
ok(cb.startsWith(sheetGrid.CAST_INTRO), 'the intro leads, and it is the served one');
ok(cb.includes('Character 1 (Nina): twelve, red coat, always carrying the cat'),
  'both halves: name in the parenthesis, her description after it');
// A half-filled row is written SHORT rather than padded with invented filler —
// every word in the clause is hers.
ok(cb.includes('Character 2: a tall man with a limp') && !/Character 2 \(/.test(cb),
  'description only: no empty parenthesis');
ok(cb.includes('Character 3: Bo.') && !/Character 3 \(/.test(cb),
  'name only: no invented description');
ok(!/undefined|null/.test(cb), 'and nothing leaks through as undefined');
// The rows are the gate the caller reads to decide whether to send anything.
ok(sheetGrid.castRows([{ name: ' Nina ', description: '' }, { name: '', description: '' }])
  .length === 1, 'castRows drops the empty rows and trims the rest');
ok(sheetGrid.castRows([{ name: ' Nina ' }])[0].name === 'Nina', 'and trims');

console.log('the dreamy sheet-swap composes with the no-text swap (live literals)');
// The live dreamy suffix and noText.from, read out of server.js the way
// test-playground-notext.js reads them — never a copy.
function grabString(src, anchor) {
  // A JS string literal (possibly concatenated over lines) after `anchor`.
  const i = src.indexOf(anchor);
  if (i < 0) return null;
  const tail = src.slice(i + anchor.length);
  const m = tail.match(/^\s*((?:'(?:[^'\\]|\\.)*'\s*\+?\s*)+)/);
  if (!m) return null;
  return eval(m[1].replace(/\+\s*$/, ''));           // eslint-disable-line no-eval
}
const dreamyBlock = serverSrc.slice(serverSrc.indexOf('dreamy: {'), serverSrc.indexOf('hoonies: {'));
const dreamySuffix = grabString(dreamyBlock, 'suffix:');
// `from:` appears twice in the dreamy block (noText and sheet) — grab both.
const froms = [];
let idx = 0;
while ((idx = dreamyBlock.indexOf('from:', idx)) >= 0) {
  froms.push(grabString(dreamyBlock.slice(idx), 'from:'));
  idx += 5;
}
const tos = [];
idx = 0;
while ((idx = dreamyBlock.indexOf('to:', idx)) >= 0) {
  const got = grabString(dreamyBlock.slice(idx), 'to:');
  if (got != null) tos.push(got);
  idx += 3;
}
// ── 5b. THE CAST CLAUSE, BOTH WAYS ────────────────────────────────────────
console.log('\nthe characters clause');
const CAST = [
  { name: 'the creepy guy', description: 'long beard, glasses, all black, with a cape' },
  { name: 'the woman', description: 'longish curly brown hair, a blue and white dress' },
];
const sheetClause = sheetGrid.castBlock(CAST);
const soloClause = sheetGrid.castBlock(CAST, true);
ok(sheetClause.startsWith(sheetGrid.CAST_INTRO), 'a sheet opens with the sheet line');
ok(soloClause.startsWith(sheetGrid.CAST_INTRO_ONE), 'one picture opens with its own line');
ok(sheetGrid.CAST_INTRO_ONE !== sheetGrid.CAST_INTRO
  && !/panel/i.test(sheetGrid.CAST_INTRO_ONE),
  'and that line does not name panels — it rides ONE picture');
ok(sheetClause.split('\n').slice(1).join('\n') === soloClause.split('\n').slice(1).join('\n'),
  'the ROWS are identical either way — one format, two openings');
ok(sheetGrid.castBlock([], true) === '' && sheetGrid.castBlock([]) === '',
  'an empty cast is still the empty string on both');

// The road her ask actually travels: a panel's filed style half is everything
// in the sheet's prompt BEFORE that panel's line, so the clause is in it
// verbatim and nothing downstream has to invent a word.
const filedStyleHalf = [
  'The FIRST attached image is a STYLE reference — copy its drawing style.',
  '',
  sheetClause,
  '',
  sheetGrid.panelBlock(4, ['a', 'b', 'c', 'd']).split('\nPanel 3')[0],
].join('\n');
const back = sheetGrid.castParse(filedStyleHalf);
ok(JSON.stringify(back) === JSON.stringify(CAST),
  'castParse reads the rows back out of a filed style half, exactly');
ok(JSON.stringify(sheetGrid.castParse(soloClause)) === JSON.stringify(CAST),
  'and reads the single-picture opening the same way');
ok(sheetGrid.castParse('a prompt with no clause in it at all').length === 0,
  'no clause on the record means NO rows — never a guess');
ok(sheetGrid.castParse(sheetClause + '\n\nPanel 1 (top left): a boy').length === 2,
  'rows stop at the first line that is not a Character line');
// A row with only one half: the words that ride the next run are the same
// either way, which is the documented asymmetry.
const oneHalf = sheetGrid.castBlock([{ name: '', description: 'a boy in red' }]);
ok(sheetGrid.castParse(oneHalf)[0].description === 'a boy in red',
  'a description-only row round-trips');
const nameOnly = sheetGrid.castParse(sheetGrid.castBlock([{ name: 'Nina', description: '' }]));
ok(nameOnly.length === 1 && (nameOnly[0].name === 'Nina' || nameOnly[0].description === 'Nina'),
  'a name-only row comes back carrying the same word');

ok(dreamySuffix && /NOT a grid/.test(dreamySuffix), 'read the live dreamy suffix');
const sheetSwap = froms.map((f, i) => ({ from: f, to: tos[i] }))
  .find((p) => p.from && /NOT a grid/.test(p.from));
// DERIVED, never a hardcoded literal: the no-text swap is simply the pair
// that is not the sheet swap. Both clauses have been reworded more than once
// (the tail said "Minimal text only." then "no text." and is back to
// "minimal text." with the toggle sending "no text."), and a test naming
// either one goes red on her next dictation instead of on a real break.
const noTextFrom = froms.find((f) => f && !/NOT a grid/.test(f));
ok(!!sheetSwap, 'dreamy carries a sheet swap whose `from` is the anti-grid clause');
ok(!!noTextFrom && dreamySuffix.includes(noTextFrom),
  'dreamy still carries a no-text swap whose `from` is verbatim in the tail');
if (sheetSwap && dreamySuffix) {
  ok(dreamySuffix.includes(sheetSwap.from),
    'sheet.from is a VERBATIM substring of the live suffix');
  const swapped = sheetGrid.applySheet(dreamySuffix, sheetSwap, sheetGrid.layoutWords(9));
  ok(!/NOT a grid/.test(swapped), 'the anti-grid clause is gone after the swap');
  ok(/a 3x3 grid of 9 panels/.test(swapped), '{layout} filled with the real grid');
  ok(swapped.includes(noTextFrom), 'the text clause survives — the swaps compose');
  ok(/STYLE reference\s+only/.test(swapped) || /STYLE reference only/.test(swapped),
    'the anti-content close survives');
  // Her edited tail wins: a tail without the clause is returned untouched.
  const edited = 'My own tail, reworded.';
  ok(sheetGrid.applySheet(edited, sheetSwap, 'a 3x3 grid of 9 panels') === edited,
    'an edited tail makes the swap a NO-OP — never a second arguing sentence');
}

console.log('\nsheetSeam — the sheet’s own verbatim seam');
// 2026-08-29, Sophie's screenshot of a sheet's Prompt overlay: "why is this
// prompt incomplete??? it's missing the style half, and characters etc". The
// run's `prompt` is the ' / '-joined box text, which is not verbatim in the
// sent string — so every reader that split around it answered an empty style
// half. The real seam is the contiguous panel-lines block.
{
  const panels = ['a fox by a well', 'a moon over water', 'a boat', 'a key in a lock'];
  const cast = [{ name: 'Joan', description: 'long black hair, narrow face' }];
  const head = 'STYLE PREFIX — copy the drawing style.';
  const tail = 'THE TAIL — minimal text.';
  const full = [head, sheetGrid.castBlock(cast), sheetGrid.panelBlock(4, panels), tail].join('\n\n');
  const seam = sheetGrid.sheetSeam(full, panels);
  ok(!!seam, 'a real panels prompt yields a seam');
  ok(seam && seam.prefix.includes(head), 'the prefix carries the style head');
  ok(seam && seam.prefix.includes(sheetGrid.CAST_INTRO) && /Joan/.test(seam.prefix),
    'the prefix carries the CHARACTERS clause — the half her screenshot was missing');
  ok(seam && /This page is a 2x2 grid/.test(seam.prefix),
    'the grid sentence rides the prefix, not the content');
  ok(seam && seam.content.startsWith('Panel 1 (') && seam.content.includes('a key in a lock')
    && !seam.content.includes(tail), 'the content is the labeled panel-lines block, verbatim');
  ok(seam && seam.suffix === tail, 'the suffix is the tail');
  // EVERY WORD OF THE SENT TEXT appears exactly once across the halves — the
  // exact-prompt rule, checked as reassembly rather than trusted. Whitespace
  // at the two seams is normalized (the block joins with '\n' where the
  // convention rejoins with '\n\n'); `fullPrompt` stays the literal record.
  const squash = (s) => s.replace(/\s+/g, ' ').trim();
  ok(seam && squash([seam.prefix, seam.content, seam.suffix].join('\n')) === squash(full),
    'prefix + content + suffix reassemble the sent text, word for word');
  // The ' / '-joined run prompt is provably NOT in the sent text — the very
  // fact that made the old split fail, pinned so nobody "simplifies" back.
  ok(full.indexOf(panels.join(' / ')) < 0,
    'the joined box text is NOT verbatim in fullPrompt (why the old split failed)');
  ok(sheetGrid.sheetSeam('unrelated words', panels) === null,
    'nothing matched → null, never a guess');
  ok(sheetGrid.sheetSeam(full, []) === null, 'no panels → null');
}

console.log(fails ? `\n${fails} FAILED` : '\nall good');
process.exit(fails ? 1 : 0);
