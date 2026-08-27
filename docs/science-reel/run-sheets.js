#!/usr/bin/env node
// Draw the science-reel beats as 2x2 panel sheets on /api/promptlab —
// STRICTLY one run at a time (the serialize rule for server-drawn batches).
// Usage: node docs/science-reel/run-sheets.js [--from N]  (sheet index, 0-based)
const fs = require('fs');
const path = require('path');
const BASE = 'https://imageforge-q125.onrender.com';
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'beats.json'), 'utf8'));
const OUT = path.join(__dirname, 'runs.json');
const runs = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const from = Number((process.argv.find(a => a.startsWith('--from')) || '').split('=')[1] || 0);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// A known already-started run per sheet index, so a crashed poll never
// redraws a sheet that was billed: --started 0=<runId>
const started = {};
for (const a of process.argv.filter(x => x.startsWith('--started'))) {
  const m = a.match(/--started\s*=?\s*(\d+)=(\S+)/) || a.match(/--started(\d+)=(\S+)/);
  if (m) started[Number(m[1])] = m[2];
}

async function jfetch(url, opts) {
  // transient 502s from the busy box must not kill the run
  for (let a = 0; a < 8; a++) {
    try {
      const r = await fetch(url, opts);
      const text = await r.text();
      try { return JSON.parse(text); } catch { throw new Error(`non-JSON ${r.status}`); }
    } catch (e) {
      if (a === 7) throw e;
      await sleep(4000 * (a + 1));
    }
  }
}

async function drawSheet(i, beats) {
  const panels = beats.map(b => b.prompt);
  let id = started[i];
  if (!id) {
    const body = {
      model: 'gpt-image-2', style: 'dreamy',
      prompt: panels.join('\n'),
      panels, grid: 4, quality: 'medium', canvas: 'portrait', res: '4k',
    };
    const j = await jfetch(`${BASE}/api/promptlab`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!j.id) throw new Error(`sheet ${i}: ${JSON.stringify(j)}`);
    id = j.id;
  }
  console.log(`sheet ${i} started: ${id}`);
  for (let t = 0; t < 120; t++) {
    await sleep(5000);
    let p;
    try { p = await jfetch(`${BASE}/api/promptlab/${id}`); } catch { continue; }
    const j = { id };
    if (p.status === 'done') {
      console.log(`sheet ${i} DONE — ${p.images.length} panels${p.cutFailed ? ' (CUT FAILED — uncut sheet)' : ''}`);
      return { sheet: i, id: j.id, beats: beats.map(b => b.n), images: p.images, sheetUrl: p.sheetUrl || null, fullPrompt: p.fullPrompt, usage: p.usage || null, cutFailed: !!p.cutFailed, canvas: p.size, cell: p.cell };
    }
    if (p.status === 'failed') throw new Error(`sheet ${i} failed: ${p.error}`);
  }
  throw new Error(`sheet ${i} timed out`);
}

(async () => {
  const groups = [];
  for (let i = 0; i < plan.beats.length; i += 4) groups.push(plan.beats.slice(i, i + 4));
  for (let i = from; i < groups.length; i++) {
    const done = await drawSheet(i, groups[i]);
    const at = runs.findIndex(r => r.sheet === i);
    if (at >= 0) runs[at] = done; else runs.push(done);
    fs.writeFileSync(OUT, JSON.stringify(runs, null, 1));
  }
  console.log('ALL SHEETS DONE');
})().catch(e => { console.error(e.message); process.exit(1); });
