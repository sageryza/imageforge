#!/usr/bin/env node
// MEASURE WHAT A REPLICATE LoRA PICTURE REALLY COSTS — the script behind
// PL_LORA in server.js (2026-09-15, Sophie: "add pricing to wtr in
// playground"). The gpt half of the Playground has scripts/measure-image-cost.js
// reading OpenAI's own `usage`; this is its twin, and it exists because
// Replicate publishes NO per-image price for a private fine-tune and returns
// NO cost field on a prediction — only `metrics.predict_time`.
//
// So the figure is measured the one way it can be: the real predict times of
// the runs we have already paid for, x the published hardware rate. It reads
// Replicate's own prediction history and SPENDS NOTHING — no prediction is
// created, nothing is drawn.
//
//   node scripts/measure-lora-cost.js
//   node scripts/measure-lora-cost.js --model sageryza/watercolordrawings
//   node scripts/measure-lora-cost.js --steps 28 --outputs 1 --pages 12
//
// Needs REPLICATE_API_TOKEN. The rate is the Nvidia H100 price from
// replicate.com/pricing — a FAST-BOOTING FINE-TUNE bills active time only, so
// predict_time IS the billed time. Re-read that page before trusting the
// number: the rate is the one input here that no API answers.
const RATE = Number(process.env.REPLICATE_SEC_RATE || 0.001525);

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

async function main() {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) { console.error('REPLICATE_API_TOKEN is not set'); process.exit(1); }
  const want = arg('model', '');
  const steps = Number(arg('steps', 28));
  const outputs = Number(arg('outputs', 1));
  const maxPages = Number(arg('pages', 12));

  let url = 'https://api.replicate.com/v1/predictions?limit=100';
  const all = [];
  for (let page = 0; url && page < maxPages; page++) {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) { console.error('replicate said', r.status, await r.text()); process.exit(1); }
    const j = await r.json();
    (j.results || []).forEach((p) => all.push(p));
    url = j.next;
  }
  console.log(`read ${all.length} predictions (${all[all.length - 1]?.created_at} → ${all[0]?.created_at})`);

  // Only the shape the Playground really sends counts: succeeded, one output,
  // the model's own step count. A 4-output run or a different step count is a
  // different price and must not be averaged into this one.
  const kept = {};
  all.forEach((p) => {
    if (p.status !== 'succeeded') return;
    if (!p.metrics || !p.metrics.predict_time || !p.input) return;
    if (p.input.num_outputs !== outputs) return;
    if (p.input.num_inference_steps !== steps) return;
    if (want && p.model !== want) return;
    (kept[p.model] = kept[p.model] || []).push(p.metrics.predict_time);
  });

  const names = Object.keys(kept).sort();
  if (!names.length) {
    console.log(`nothing matched (outputs=${outputs}, steps=${steps}) — widen --pages, or the settings moved`);
    return;
  }
  console.log(`\nNvidia H100 at $${RATE}/sec · ${outputs} output · ${steps} steps\n`);
  names.forEach((m) => {
    const t = kept[m].slice().sort((a, b) => a - b);
    const q = (f) => t[Math.min(t.length - 1, Math.floor(t.length * f))];
    const med = q(0.5);
    console.log(m);
    console.log(`  n=${t.length}  min ${t[0].toFixed(2)}s · median ${med.toFixed(2)}s · max ${t[t.length - 1].toFixed(2)}s`);
    console.log(`  cents: min ${(t[0] * RATE * 100).toFixed(2)} · MEDIAN ${(med * RATE * 100).toFixed(2)} · max ${(t[t.length - 1] * RATE * 100).toFixed(2)}`);
    console.log(`  PL_LORA row: { seconds: ${med.toFixed(2)}, cents: ${(med * RATE * 100).toFixed(2)}, n: ${t.length} }`);
  });
}

main().catch((e) => { console.error(e.message); process.exit(1); });
