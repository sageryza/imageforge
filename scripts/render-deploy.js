#!/usr/bin/env node
'use strict';
// DEPLOY — BUT NOT WHILE SHE IS DRAWING (2026-09-02, Sophie: "i thought there
// was a check in place not to restart the server if things were being drawn?
// there shud be!!!!!!"). There was not. Render has ignored pushes since
// 2026-09-01, so every deploy is a chat POSTing to Render's API by hand — and
// a hand can look first. This is the one door for a deploy now: it asks the
// live server what is in flight (GET /api/promptlab/inflight — draws AND
// cuts, from the process's own sets, exact) and waits until nothing is, then
// triggers the deploy.
//
// A deploy is zero-downtime on Render's side (new instance up, then the old
// one is told to stop), but the old instance is KILLED mid-request, and a
// draw is a request that runs 20s to 14 minutes. The sweep now redraws a run
// that dies this way (promptlab-sweep.js) — one more draw's cost — so this
// script is what keeps that cost from being paid at all.
//
//   node scripts/render-deploy.js            waits (up to --max minutes), then deploys
//   node scripts/render-deploy.js --dry      says what it would do, deploys nothing
//   node scripts/render-deploy.js --max 40   wait longer than the default 30 minutes
//   node scripts/render-deploy.js --now      skip the wait (say why in your reply)
//
// Needs RENDER_API_KEY (in the environment). Costs nothing beyond the deploy's
// own build minutes.
const SRV = process.env.RENDER_SERVICE_ID || 'srv-d660igvgi27c73a5u6eg';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const arg = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const maxMin = Number(arg('--max', 30));
const tickMs = 15000;

async function inflight() {
  const r = await fetch(`${BASE}/api/promptlab/inflight`, { headers: { 'Cache-Control': 'no-store' } });
  if (!r.ok) throw new Error(`inflight ${r.status}`);
  return r.json();
}

async function main() {
  const key = process.env.RENDER_API_KEY;
  if (!key && !has('--dry')) { console.error('RENDER_API_KEY is not set'); process.exit(2); }
  const started = Date.now();
  if (!has('--now')) {
    for (;;) {
      let st;
      try { st = await inflight(); } catch (e) {
        // An older server has no /inflight yet; nothing to read means nothing
        // to wait for — say so and go on.
        console.log(`could not read in-flight state (${e.message}); deploying anyway`);
        break;
      }
      const busy = (st.drawing || []).length + (st.cutting || []).length;
      const mem = st.memory ? ` · rss ${Math.round(st.memory.rss / 1048576)}MB` : '';
      if (!busy) { console.log(`nothing in flight${mem} — clear to deploy`); break; }
      const mins = ((Date.now() - started) / 60000).toFixed(1);
      console.log(`${busy} in flight (${(st.drawing || []).length} drawing, ${(st.cutting || []).length} cutting)${mem} — waiting ${mins}m`);
      if (Date.now() - started > maxMin * 60000) {
        console.error(`still busy after ${maxMin} minutes — NOT deploying. Re-run with a longer --max, or --now if it must ship.`);
        process.exit(3);
      }
      await new Promise((r) => setTimeout(r, tickMs));
    }
  }
  if (has('--dry')) { console.log('dry run — no deploy triggered'); return; }
  const r = await fetch(`https://api.render.com/v1/services/${SRV}/deploys`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ clearCache: 'do_not_clear' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('deploy refused:', r.status, JSON.stringify(j).slice(0, 300)); process.exit(1); }
  console.log(`deploy started: ${j.id || '?'} — https://dashboard.render.com/web/${SRV}/deploys`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
