'use strict';
// THE PROCESS REFUSES TO DIE WHILE A DRAW IS IN FLIGHT (2026-09-02, Sophie:
// "why would a run ever be killed").
//
// Measured that night: every merge to main is a deploy (Render's own event
// log — `newCommit` on each one, three in three minutes while her re-runs
// were drawing), and a deploy is a restart: the new instance comes up, and
// 60 seconds later Render sends the OLD one SIGTERM, then SIGKILL after its
// shutdown delay (30s by default; up to 300s if the service asks — this one
// asks, in render.yaml and by API). Node's default on SIGTERM is to exit at
// once, so every draw the old instance was holding died with it — billed,
// nothing received — and the sweep's redraw only ever buys the picture back
// at a second draw's price. This is the half that stops the first bill.
//
// The rule is pure so it has a test with no signals in it: given "how many
// things are in flight" and a clock, hold until zero or the cap, then exit.
// The cap is a little under Render's window so WE exit cleanly rather than
// being killed mid-write; anything still drawing at the cap is what the
// sweep's redraw is for (a 4K sheet can run 14 minutes; nothing here can
// stretch a 300s window).
const HOLD_CAP_MS = 290 * 1000;
const TICK_MS = 1000;

async function holdUntilClear(o) {
  const busy = o.busy;                           // () => number in flight
  const wait = o.wait || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = o.now || Date.now;
  const cap = o.capMs || HOLD_CAP_MS;
  const log = o.log || (() => {});
  const t0 = now();
  let n = busy();
  if (!n) return { held: 0, left: 0 };
  log(`SIGTERM with ${n} in flight — holding (up to ${Math.round(cap / 1000)}s)`);
  while (n && now() - t0 < cap) {
    await wait(o.tickMs || TICK_MS);
    n = busy();
  }
  const held = now() - t0;
  log(n ? `shutdown cap reached with ${n} still in flight` : `clear after ${Math.round(held / 1000)}s — exiting`);
  return { held, left: n };
}

module.exports = { holdUntilClear, HOLD_CAP_MS, TICK_MS };
