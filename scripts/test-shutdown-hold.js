#!/usr/bin/env node
'use strict';
// The SIGTERM hold — pure, no signals. A deploy must not kill a draw.
const { holdUntilClear, HOLD_CAP_MS } = require('../shutdown-hold');
let pass = 0, fail = 0;
const is = (g, w, what) => { if (g === w) { pass++; return; } fail++; console.log(`FAIL ${what}\n  got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); };
(async () => {
  // nothing in flight: no hold at all
  let t = 0; const clock = () => t; const tick = async (ms) => { t += ms; };
  let r = await holdUntilClear({ busy: () => 0, wait: tick, now: clock });
  is(r.held, 0, 'nothing in flight exits at once');
  // one draw that finishes after 40s: held ~40s, nothing left
  t = 0; let n = 1; const busy = () => (t >= 40000 ? 0 : n);
  r = await holdUntilClear({ busy, wait: tick, now: clock, tickMs: 1000 });
  is(r.left, 0, 'a draw that finishes is waited out');
  is(r.held >= 40000 && r.held < 42000, true, `held about as long as the draw (${r.held}ms)`);
  // a draw that never finishes: the cap, then out, with it named
  t = 0; r = await holdUntilClear({ busy: () => 1, wait: tick, now: clock, tickMs: 1000 });
  is(r.left, 1, 'at the cap what is left is reported');
  is(r.held >= HOLD_CAP_MS && r.held < HOLD_CAP_MS + 2000, true, `held to the cap (${r.held}ms)`);
  is(HOLD_CAP_MS < 300 * 1000, true, "the cap is inside Render's 300s window");
  is(HOLD_CAP_MS > 60 * 1000, true, 'the cap outlasts an ordinary single draw');
  // a cut counts too (the caller sums both sets)
  t = 0; r = await holdUntilClear({ busy: () => (t >= 3000 ? 0 : 2), wait: tick, now: clock, tickMs: 1000 });
  is(r.left, 0, 'two in flight that clear are waited out');
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
