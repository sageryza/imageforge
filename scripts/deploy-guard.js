#!/usr/bin/env node
'use strict';
// THE STOP GUARD BEFORE A DEPLOY (2026-09-02, Sophie: "why can't there be a
// stop guard before a deploy that asks if anything's drawing"). There can,
// and it is this: Render's PRE-DEPLOY COMMAND (render.yaml
// `preDeployCommand`), which runs after the build and BEFORE the new instance
// is started — while the old one is still serving. It asks the live server
// what it is drawing and cutting (GET /api/promptlab/inflight, the process's
// own exact sets) and does not let the deploy go on until the answer is
// nothing. Every merge to main is a deploy, so this runs on every merge, for
// every chat, with nobody having to remember it.
//
// If the box is still busy at the cap the deploy FAILS — on purpose. A
// failed deploy ships nothing and kills nothing; the next merge (there are
// ~43 a day) carries the change. Render's own timeout for this command is 30
// minutes, so the cap sits under it. Waiting costs pipeline minutes at
// $5/1,000 — a 14-minute sheet is 7¢ of waiting against a $1 sheet redrawn.
//
// It is DEFENSIVE about the server it talks to: an old build with no
// /inflight, or a box mid-restart, answers with nothing readable, and that
// means nothing to wait for — the deploy goes on. Only a real "busy" holds.
const BASE = process.env.RENDER_EXTERNAL_URL || process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CAP_MS = Number(process.env.DEPLOY_GUARD_CAP_MIN || 25) * 60 * 1000;
const TICK_MS = 10 * 1000;

// -> { busy, drawing, cutting, unreadable }
async function readState(fetchFn) {
  try {
    const r = await fetchFn(`${BASE}/api/promptlab/inflight`, { headers: { 'Cache-Control': 'no-store' } });
    if (!r.ok) return { busy: 0, drawing: 0, cutting: 0, unreadable: `HTTP ${r.status}` };
    const j = await r.json();
    const drawing = (j.drawing || []).length;
    const cutting = (j.cutting || []).length;
    return { busy: drawing + cutting, drawing, cutting, rss: j.memory && j.memory.rss };
  } catch (e) {
    return { busy: 0, drawing: 0, cutting: 0, unreadable: e.message };
  }
}

// The whole rule, injectable for the test: -> { ok, waited, reason }
async function waitForClear(o) {
  const fetchFn = o.fetch || fetch;
  const wait = o.wait || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = o.now || Date.now;
  const cap = o.capMs || CAP_MS;
  const log = o.log || console.log;
  const t0 = now();
  let unreadableRuns = 0;
  for (;;) {
    const st = await readState(fetchFn);
    if (st.unreadable) {
      // Three unreadable answers in a row is a server with nothing to say
      // (no route, or booting) — not a reason to hold a deploy forever.
      unreadableRuns++;
      log(`deploy-guard: could not read in-flight state (${st.unreadable})`);
      if (unreadableRuns >= 3) return { ok: true, waited: now() - t0, reason: 'unreadable' };
      await wait(o.tickMs || TICK_MS);
      continue;
    }
    unreadableRuns = 0;
    if (!st.busy) {
      const mem = st.rss ? ` · rss ${Math.round(st.rss / 1048576)}MB` : '';
      log(`deploy-guard: nothing drawing or cutting${mem} — clear to deploy`);
      return { ok: true, waited: now() - t0, reason: 'clear' };
    }
    const waited = now() - t0;
    if (waited >= cap) {
      log(`deploy-guard: still ${st.busy} in flight after ${Math.round(cap / 60000)} minutes — NOT deploying; the next merge will carry this change`);
      return { ok: false, waited, reason: 'busy' };
    }
    log(`deploy-guard: ${st.drawing} drawing, ${st.cutting} cutting — holding the deploy (${Math.round(waited / 1000)}s)`);
    await wait(o.tickMs || TICK_MS);
  }
}

if (require.main === module) {
  waitForClear({}).then((r) => process.exit(r.ok ? 0 : 1), (e) => { console.error('deploy-guard:', e.message); process.exit(0); });
}
module.exports = { waitForClear, readState, CAP_MS };
