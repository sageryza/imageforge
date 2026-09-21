#!/usr/bin/env node
// render-job.js — start a ONE-OFF JOB on the ImageForge Render service and
// wait for it (2026-09-21). A job runs `startCommand` in the service's
// environment (its env vars, its latest successful build) on a FRESH instance
// of the service's plan, billed by the second, and exits — the shape for
// anything that does not fit beside the 512MB web server, like the MPC upload's
// headless browser (`scripts/mpc-upload-job.js`).
//
//   node scripts/render-job.js --cmd 'node scripts/mpc-upload-job.js --zip … --name "…"' [--dry] [--no-wait]
//
// Needs RENDER_API_KEY (the same key render-deploy.js uses). Never the raw
// API from a chat by hand — this is the one door, so a job is always logged
// here with its id and outcome. Render's own API: POST /v1/services/{id}/jobs
// {startCommand, planId?} → {id, status}; GET /v1/jobs/{id} → status
// (pending · running · succeeded · failed · canceled), startedAt, finishedAt.
const SRV = process.env.RENDER_SERVICE_ID || 'srv-d660igvgi27c73a5u6eg';
const args = process.argv.slice(2);
const has = (n) => args.includes('--' + n);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const CMD = flag('cmd');
if (!CMD) { console.error('usage: --cmd "<start command>" [--dry] [--no-wait]'); process.exit(2); }
const key = process.env.RENDER_API_KEY;
if (!key && !has('dry')) { console.error('RENDER_API_KEY is not set'); process.exit(2); }
const H = { authorization: `Bearer ${key}`, 'content-type': 'application/json', accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (has('dry')) { console.log(`would POST /v1/services/${SRV}/jobs`, JSON.stringify({ startCommand: CMD })); return; }
  const r = await fetch(`https://api.render.com/v1/services/${SRV}/jobs`, { method: 'POST', headers: H, body: JSON.stringify({ startCommand: CMD }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('job create failed', r.status, JSON.stringify(j)); process.exit(1); }
  console.log(`job ${j.id} ${j.status || 'created'}`);
  if (has('no-wait')) return;
  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < 30 * 60000) {
    await sleep(10000);
    const s = await fetch(`https://api.render.com/v1/jobs/${j.id}`, { headers: H }).then((x) => x.json()).catch(() => ({}));
    const line = `${s.status || '?'}${s.startedAt ? ' started ' + s.startedAt.slice(11, 19) : ''}${s.finishedAt ? ' finished ' + s.finishedAt.slice(11, 19) : ''}`;
    if (line !== last) { console.log(line); last = line; }
    if (['succeeded', 'failed', 'canceled'].includes(s.status)) {
      console.log(JSON.stringify(s));
      process.exit(s.status === 'succeeded' ? 0 : 1);
    }
  }
  console.error('gave up waiting after 30 minutes; the job may still be running:', j.id);
  process.exit(1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
