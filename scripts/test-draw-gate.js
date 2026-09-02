#!/usr/bin/env node
'use strict';
// The draw gate — pure, no server. The case: 2026-09-02, four low edits at
// once on a box idling at 427MB of 512, oomKilled two seconds later.
const { slotsFor, makeGate, CAP } = require('../draw-gate');
const MB = 1048576;
let pass = 0, fail = 0;
const is = (got, want, what) => { if (got === want) { pass++; return; } fail++; console.log(`FAIL ${what}\n  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };

// --- the number follows the room ------------------------------------------
is(slotsFor(427 * MB), 1, 'the box that died admits ONE at a time');
is(slotsFor(190 * MB), CAP, 'a fresh boot admits the cap');
is(slotsFor(350 * MB), 4, 'half full admits a few');
is(slotsFor(505 * MB), 1, 'a box with no room still admits one — never zero');
is(slotsFor(0), CAP, 'no reading at all falls to the cap, not to zero');
is(slotsFor(190 * MB, { cap: 3 }), 3, 'the cap is an option');

// --- admission: a burst on a full box goes through one at a time ----------
async function drive(rssMB, n) {
  let rss = rssMB * MB;
  const events = [];
  let clock = 0;
  const gate = makeGate({ rss: () => rss, wait: async () => { clock += 1; await Promise.resolve(); }, tickMs: 1 });
  let peak = 0;
  const jobs = Array.from({ length: n }, (_, i) => gate.run(`r${i}`, async () => {
    peak = Math.max(peak, gate.active.size);
    events.push(`start r${i}`);
    for (let k = 0; k < 5; k++) await Promise.resolve();
    events.push(`end r${i}`);
    return i;
  }));
  const out = await Promise.all(jobs);
  return { out, peak, events, clock, gate };
}
(async () => {
  const full = await drive(427, 4);
  is(full.peak, 1, 'on the box that died, four draws never overlap');
  is(full.out.join(','), '0,1,2,3', 'every draw still runs and answers');
  is(full.events.slice(0, 2).join('|'), 'start r0|end r0', 'the first to ask draws first');
  is(full.gate.active.size, 0, 'nothing left active');
  is(full.gate.waiting(), 0, 'nothing left waiting');

  const empty = await drive(190, 4);
  is(empty.peak, 4, 'on a fresh box the same four run together');

  const mid = await drive(400, 4);
  is(mid.peak, 2, 'at 400MB two at a time');

  // the answer follows the box: a reading that DROPS mid-burst lets more in
  let rss = 480 * MB;
  const gate = makeGate({ rss: () => rss, wait: async () => { rss = 200 * MB; await Promise.resolve(); }, tickMs: 1 });
  let peak = 0;
  await Promise.all([0, 1, 2].map((i) => gate.run(`x${i}`, async () => {
    peak = Math.max(peak, gate.active.size);
    for (let k = 0; k < 4; k++) await Promise.resolve();
  })));
  is(peak >= 2, true, 'a box that frees memory admits more without re-queueing');

  // a draw that throws releases its slot
  const g2 = makeGate({ rss: () => 427 * MB, wait: async () => { await Promise.resolve(); }, tickMs: 1 });
  let threw = false;
  try { await g2.run('bad', async () => { throw new Error('refused'); }); } catch (e) { threw = true; }
  is(threw, true, 'the error still reaches the caller');
  is(g2.active.size, 0, 'a failed draw frees its slot');

  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
