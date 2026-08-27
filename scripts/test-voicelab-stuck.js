#!/usr/bin/env node
// test-voicelab-stuck.js — the orphaned-render rule, pure, no network.
//
// A Voice Studio render is fire-and-forget IN THE SERVER PROCESS, so a Render
// deploy landing mid-render kills the job with nobody left to write 'failed'
// and the doc spins on `rendering` forever.
//
// Two ends have to hold, and they pull against each other:
//   * a job nothing is working on stops spinning and offers a way back, and
//   * a job that is REALLY running is never swept, however long it takes.
//
// The second end is the one with teeth, and it is set from a MEASUREMENT.
// Sophie's 4,842-character science take (2026-08-27) took **735 seconds** and
// finished perfectly well; the identical text re-sent twelve minutes later came
// back in 75. A gate anywhere near ten minutes would have killed her real take.

const assert = require('assert');
const { isStuck, STUCK_AFTER_MS: STUCK_MS } = require('../voicelab');

let pass = 0;
const ok = (cond, what) => { assert.ok(cond, what); pass++; };

const NOW = Date.parse('2026-08-27T04:00:00.000Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const row = (over) => ({ id: 'vlaaaaaaaaaaaa', status: 'rendering', createdAt: ago(30 * 60e3), ...over });
const none = new Set();

// ── the case this exists for ────────────────────────────────────────
ok(isStuck(row(), NOW, none), 'a rendering doc nothing is working on, long past the cap, is stuck');

// ── the measurement, as an assertion ────────────────────────────────
// Her science take ran 735s and was FINE. This is the regression that matters:
// a chat tightening the gate to a number that "feels like enough" would start
// failing her real renders, and nothing but this line would notice.
const SOPHIES_SLOWEST_MS = 735e3;
ok(!isStuck(row({ createdAt: ago(SOPHIES_SLOWEST_MS) }), NOW, none),
  'a render as slow as her real 735s one is NOT called dead');
ok(STUCK_MS > SOPHIES_SLOWEST_MS * 2, 'the gate is twice the slowest render on record');
ok(!isStuck(row({ createdAt: ago(5 * 60e3) }), NOW, none), 'five minutes in is ordinary');
ok(!isStuck(row({ createdAt: ago(20 * 60e3) }), NOW, none), 'twenty minutes in is still given the benefit');
ok(isStuck(row({ createdAt: ago(26 * 60e3) }), NOW, none), 'past the gate, with no job behind it, is stuck');

// ── a live job is untouchable, whatever the clock says ──────────────
const live = new Set(['vlaaaaaaaaaaaa']);
ok(!isStuck(row({ createdAt: ago(90 * 60e3) }), NOW, live),
  'a job this process is really working on is never swept, even ninety minutes in');
ok(isStuck(row({ id: 'vlbbbbbbbbbbbb', createdAt: ago(90 * 60e3) }), NOW, live),
  'but a DIFFERENT id in the same read still is');

// ── only ever rendering → failed ────────────────────────────────────
for (const status of ['done', 'failed', undefined, '']) {
  ok(!isStuck(row({ status, createdAt: ago(999 * 60e3) }), NOW, none),
    `a ${status || 'status-less'} doc is left alone`);
}

// ── an undatable doc is left alone, on purpose ──────────────────────
// Date.parse of junk is NaN and every comparison against NaN is false, so this
// falls the safe way by construction. Pinned because "fixing" it with a
// fallback of 0 would sweep every one of these on the next read.
for (const createdAt of [undefined, '', 'sometime tuesday', null]) {
  ok(!isStuck(row({ createdAt }), NOW, none),
    `a doc dated ${JSON.stringify(createdAt)} is never claimed to be old`);
}

// ── garbage in ──────────────────────────────────────────────────────
ok(!isStuck(null, NOW, none), 'no row');
ok(!isStuck({ status: 'rendering', createdAt: ago(999 * 60e3) }, NOW, none), 'a row with no id');
ok(isStuck(row(), NOW, undefined), 'no live set at all still decides');

console.log(`voicelab stuck-render rule: ${pass} checks passed`);
