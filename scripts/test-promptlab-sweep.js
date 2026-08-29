#!/usr/bin/env node
'use strict';
// The stuck-run sweep's decision table — pure, no network, no Firestore.
//
// The case that produced it (2026-08-29, Sophie: "my last panels draw is
// taking a long time"): a 4K six-panel sheet banked at 07:06 was still uncut
// at 07:16, because the sweep judged a banked sheet by the same ten-minute
// clock as a dead draw. The cut itself took 17 seconds when it was finally
// asked for.
const { sweepAction, isOrphanedSheet, STUCK_MS, ORPHAN_CUT_MS } = require('../promptlab-sweep');

let pass = 0, fail = 0;
function is(got, want, what) {
  if (got === want) { pass++; return; }
  fail++; console.log(`FAIL ${what}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
}

const NOW = 1_700_000_000_000;
const ago = (ms) => NOW - ms;
const MIN = 60 * 1000;

const draw = (over) => ({ id: 'r1', status: 'running', createdAt: ago(over) });
const sheet = (over, extra) => ({
  id: 'r1', status: 'ready', panels: ['a', 'b'], sheetUrl: 'https://x/sheet.webp',
  images: [], createdAt: ago(over), ...extra,
});
const act = (r, cutting) => sweepAction(r, { now: NOW, cutting });

// --- what counts as an orphaned sheet at all -------------------------------
is(isOrphanedSheet(sheet(0)), true, 'a banked sheet with no panels is orphaned');
is(isOrphanedSheet(sheet(0, { images: ['https://x/p1.webp'] })), false, 'a cut run is not orphaned');
is(isOrphanedSheet(sheet(0, { sheetUrl: '' })), false, 'no banked sheet is not orphaned');
is(isOrphanedSheet(draw(0)), false, 'an ordinary run is not orphaned');
is(isOrphanedSheet({ id: 'x', sheetUrl: 'u', images: [] }), false, 'a non-panels run is not orphaned');

// --- the two clocks are different lengths, which is the whole fix ----------
is(ORPHAN_CUT_MS < STUCK_MS, true, 'an orphaned sheet waits less than a dead draw');
is(act(sheet(3 * MIN)), 'recut', 'a sheet orphaned three minutes ago is recut');
is(act(sheet(30 * 1000)), null, 'a sheet banked thirty seconds ago is left alone');
is(act(sheet(ORPHAN_CUT_MS)), 'recut', 'exactly at the orphan wait it is recut');
is(act(sheet(ORPHAN_CUT_MS - 1)), null, 'a moment before it, left alone');
// her real case: banked at 07:06, looked at 07:16
is(act(sheet(10 * MIN)), 'recut', "Sophie's ten-minute-old uncut sheet is recut");

// --- an orphaned sheet is NEVER marked failed ------------------------------
is(act(sheet(45 * MIN)), 'recut', 'a very old banked sheet is still recut, never failed');

// --- the in-process guard is what makes the short wait safe ---------------
is(act(sheet(5 * MIN), new Set(['r1'])), null, 'a sheet this process is still cutting is left alone');
is(act(sheet(5 * MIN), new Set(['other'])), 'recut', 'another run cutting does not protect this one');
is(act(sheet(45 * MIN), new Set(['r1'])), null, 'a long queue behind the gate is not an orphan');

// --- a dead draw keeps the long grace -------------------------------------
is(act(draw(3 * MIN)), null, 'a three-minute draw is still legitimate');
is(act(draw(STUCK_MS)), 'fail', 'a draw past the stuck cutoff is failed');
is(act(draw(11 * MIN)), 'fail', 'an eleven-minute draw is failed');
is(act(draw(11 * MIN), new Set(['r1'])), 'fail', 'the cutting set never rescues a dead draw');

// --- a doc with no clock is never judged ----------------------------------
is(act({ id: 'r1', status: 'running' }), null, 'no createdAt: never judged');
is(act(sheet(45 * MIN, { createdAt: 0 })), null, 'a banked sheet with no clock is never judged');

// --- a panels run killed DURING generation is REDRAWN, not failed ----------
// (2026-08-29, Sophie: "forget the drawing this can't happen again" — her
// 6-panel 4K sheet died to a deploy at 14 minutes, billed and never received.)
const { panelsCfgOf, REDRAW_CAP } = require('../promptlab-sweep');
const sheetGrid = require('../sheet-grid');
const panels = ['a door', 'a card game', 'a party', 'a window', 'pills', 'a platform'];
const block = sheetGrid.panelBlock(6, panels);
const deadPanels = (over, extra) => ({
  id: 'r1', status: 'running', panels, grid: { across: 2, down: 3, count: 6 },
  sheet: '2336x3504', cell: '1168x1168', quality: 'medium', gptStyle: 'dreamy',
  fullPrompt: `THE HEAD\n\n${block}\n\nTHE TAIL`, createdAt: ago(over), ...extra,
});
is(act(deadPanels(11 * MIN)), 'redraw', 'a dead panels draw is redrawn, never failed');
is(act(deadPanels(3 * MIN)), null, 'a young panels draw keeps the long grace — the old instance may still land it');
is(act(deadPanels(11 * MIN, { redraws: REDRAW_CAP })), 'fail', 'past the redraw cap it fails honestly');
is(act(deadPanels(11 * MIN, { redraws: 1 })), 'redraw', 'one redraw spent, cap 2 — deploys land in bursts, so it draws again');
is(REDRAW_CAP >= 2, true, 'the cap is at least 2 (three merges in a row, 2026-08-27)');
is(act(deadPanels(11 * MIN, { sheet: 'not-a-size' })), 'fail', 'a doc too broken to rebuild fails, never a blind redraw');

// the rebuilt cfg is exactly what the job takes
const cfg = panelsCfgOf(deadPanels(0));
is(cfg.plan.sheet, '2336x3504', 'the rebuilt plan keeps the sheet canvas');
is(cfg.plan.count, 6, 'and the panel count');
is(cfg.head, 'THE HEAD', 'the head seam is recovered from the stored fullPrompt');
is(cfg.tail, 'THE TAIL', 'and the tail');

// --- the wiring: the redraw must restart the staleness clock ---------------
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
is(/redraws: n, redrawnAt/.test(src), true,
  'a redraw restamps redrawnAt beside redraws');
is(/r\.redrawnAt\?\.toMillis\?\.\(\) \|\| r\.createdAt/.test(src), true,
  'the sweep clocks a redrawn run from redrawnAt — or the next tick kills the draw the last one started');
is(!/function panelsCfgOf\(/.test(src), true,
  'server.js keeps no second panelsCfgOf — it lives in promptlab-sweep.js');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
