#!/usr/bin/env node
'use strict';
// The stop guard before a deploy — pure, no network.
const { waitForClear } = require('./deploy-guard');
let pass = 0, fail = 0;
const is = (g, w, what) => { if (g === w) { pass++; return; } fail++; console.log(`FAIL ${what}\n  got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); };
const answer = (drawing, cutting) => ({ ok: true, json: async () => ({ drawing, cutting, memory: { rss: 300 * 1048576 } }) });
(async () => {
  let t = 0; const now = () => t; const wait = async (ms) => { t += ms; }; const quiet = () => {};
  // idle server: clear at once
  let r = await waitForClear({ fetch: async () => answer([], []), wait, now, log: quiet });
  is(r.ok && r.reason === 'clear' && r.waited === 0, true, 'an idle box is clear to deploy at once');
  // a draw that finishes after 50s: held, then clear
  t = 0; r = await waitForClear({ fetch: async () => answer(t < 50000 ? ['r1'] : [], []), wait, now, tickMs: 10000, log: quiet });
  is(r.ok, true, 'a draw is waited out');
  is(r.waited >= 50000 && r.waited < 70000, true, `held for the draw (${r.waited}ms)`);
  // a cut counts too
  t = 0; r = await waitForClear({ fetch: async () => answer([], t < 20000 ? ['c1'] : []), wait, now, tickMs: 10000, log: quiet });
  is(r.ok && r.waited >= 20000, true, 'a cut holds the deploy too');
  // busy past the cap: the deploy is REFUSED
  t = 0; r = await waitForClear({ fetch: async () => answer(['r1'], []), wait, now, tickMs: 10000, capMs: 60000, log: quiet });
  is(r.ok, false, 'still busy at the cap: not deployed');
  is(r.reason, 'busy', 'and it says why');
  // an old server with no /inflight: nothing to wait for
  t = 0; r = await waitForClear({ fetch: async () => ({ ok: false, status: 404 }), wait, now, tickMs: 1000, log: quiet });
  is(r.ok && r.reason === 'unreadable', true, 'a 404 (old build) does not hold the deploy');
  // a box mid-restart (fetch throws): same
  t = 0; r = await waitForClear({ fetch: async () => { throw new Error('ECONNRESET'); }, wait, now, tickMs: 1000, log: quiet });
  is(r.ok && r.reason === 'unreadable', true, 'an unreachable box does not hold the deploy');
  // one bad read in the middle of a real wait does not release it
  t = 0; let n = 0;
  r = await waitForClear({ fetch: async () => { n++; if (n === 2) throw new Error('blip'); return answer(t < 30000 ? ['r1'] : [], []); }, wait, now, tickMs: 10000, log: quiet });
  is(r.ok && r.reason === 'clear' && r.waited >= 30000, true, 'one blip mid-wait does not release the hold');
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
