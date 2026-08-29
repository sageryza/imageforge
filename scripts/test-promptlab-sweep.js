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

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
