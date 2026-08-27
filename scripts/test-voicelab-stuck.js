#!/usr/bin/env node
// test-voicelab-stuck.js — the orphaned-render rule, pure, no network.
//
// The bug it pins (found live 2026-08-27): a Voice Studio render is
// fire-and-forget IN THE SERVER PROCESS, so a Render deploy landing mid-render
// kills the job with nobody left to write 'failed'. Sophie's 4,842-character
// science take started at 8:16pm, #1794 deployed at 8:12, and her card spun on
// "rendering…" all evening while the page polled it every 2s forever. From her
// side the take was simply missing, which is what she reported.
//
// Two ends have to hold, and they pull against each other:
//   * a job that is REALLY running is never swept, however long it takes
//     (STS is a 300s timeout with a 25MB upload either side of it), and
//   * a job nothing is working on stops spinning and offers a way back.

const assert = require('assert');
const { isStuck, STUCK_MS } = require('../voicelab');

let pass = 0;
const ok = (cond, what) => { assert.ok(cond, what); pass++; };

const NOW = Date.parse('2026-08-27T04:00:00.000Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const row = (over) => ({ id: 'vlaaaaaaaaaaaa', status: 'rendering', createdAt: ago(30 * 60e3), ...over });
const none = new Set();

// ── the case this exists for ────────────────────────────────────────
ok(isStuck(row(), NOW, none), 'a rendering doc nothing is working on, long past the cap, is stuck');

// Sophie's own take, to the minute: started 8:16pm, still 'rendering' when she
// asked at 8:21pm — and NOT yet sweepable then, which is correct. A five-minute
// render is ordinary; the sweep must not call one dead.
ok(!isStuck(row({ createdAt: ago(5 * 60e3) }), NOW, none), 'five minutes in is not stuck yet');
ok(isStuck(row({ createdAt: ago(11 * 60e3) }), NOW, none), 'eleven minutes in, with no job behind it, is');

// ── the age gate has to clear the longest legitimate job ────────────
// The STS timeout is 300s. Anything at or under that must be inside the cap
// with room to spare, or a real conversion gets marked failed under her.
ok(STUCK_MS > 300e3 * 1.5, 'the cap leaves headroom over the 300s speech-to-speech timeout');

// ── a live job is untouchable, whatever the clock says ──────────────
const live = new Set(['vlaaaaaaaaaaaa']);
ok(!isStuck(row({ createdAt: ago(60 * 60e3) }), NOW, live),
  'a job this process is really working on is never swept, even an hour in');
ok(isStuck(row({ id: 'vlbbbbbbbbbbbb', createdAt: ago(60 * 60e3) }), NOW, live),
  'but a DIFFERENT id in the same read still is');

// ── only ever rendering → failed ────────────────────────────────────
for (const status of ['done', 'failed', undefined, '']) {
  ok(!isStuck(row({ status, createdAt: ago(99 * 60e3) }), NOW, none),
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
ok(!isStuck({ status: 'rendering', createdAt: ago(99 * 60e3) }, NOW, none), 'a row with no id');
ok(isStuck(row(), NOW, undefined), 'no live set at all still decides');

console.log(`voicelab stuck-render rule: ${pass} checks passed`);
