#!/usr/bin/env node
// Draw the film's stills through the Playground's gpt-image-2 "evan" style
// (sage sandy mirror watercolour). Content-only prompts — the style ref does
// the look, so no style language is sent.
//   node gen-stills.js --quality low            # the look pass
//   node gen-stills.js --quality medium --only 3,7,12
// Writes/updates docs/cannon-language/renders-<quality>.json as each lands, so
// a crash keeps whatever finished.
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const TOKEN = process.env.STUDIO_TOKEN || '';
const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const QUALITY = argOf('--quality', 'low');
const ONLY = argOf('--only', '');
const POOL = Number(argOf('--pool', '4'));

const shots = JSON.parse(fs.readFileSync(path.join(DIR, 'shots.json'), 'utf8')).shots;
const want = ONLY ? new Set(ONLY.split(',').map(s => Number(s.trim()))) : null;
const todo = shots.filter(s => !want || want.has(s.n));

const OUT = path.join(DIR, `renders-${QUALITY}.json`);
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

const headers = { 'Content-Type': 'application/json', ...(TOKEN ? { 'x-studio-token': TOKEN } : {}) };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function draw(shot) {
  const r = await fetch(`${BASE}/api/promptlab`, {
    method: 'POST', headers,
    body: JSON.stringify({
      model: 'gpt-image-2', style: 'evan', quality: QUALITY,
      outputs: 1, character: false, prompt: shot.prompt,
    }),
  });
  const j = await r.json();
  if (!j.id) throw new Error(`shot ${shot.n}: ${JSON.stringify(j).slice(0, 200)}`);
  for (let i = 0; i < 200; i++) {
    await sleep(3000);
    const p = await fetch(`${BASE}/api/promptlab/${j.id}`, { headers });
    const d = await p.json();
    if (d.status === 'done' && d.images && d.images.length) {
      out[shot.n] = { n: shot.n, runId: j.id, quality: QUALITY, url: d.images[0],
        prompt: shot.prompt, fullPrompt: d.fullPrompt || null, at: new Date().toISOString() };
      save();
      console.log(`  [${shot.n}] ok  ${d.images[0]}`);
      return;
    }
    if (d.status === 'failed' || d.status === 'cancelled') {
      throw new Error(`shot ${shot.n} ${d.status}: ${d.error || ''}`);
    }
  }
  throw new Error(`shot ${shot.n}: timed out`);
}

(async () => {
  console.log(`Drawing ${todo.length} shots at ${QUALITY} (pool ${POOL}) → ${OUT}`);
  const queue = todo.slice();
  const fails = [];
  await Promise.all(Array.from({ length: Math.min(POOL, queue.length) }, async () => {
    while (queue.length) {
      const s = queue.shift();
      try { await draw(s); }
      catch (e) { console.error(`  ${e.message}`); fails.push(s.n); }
    }
  }));
  save();
  console.log(`done. ${Object.keys(out).length} on file.${fails.length ? ` failed: ${fails.join(',')}` : ''}`);
})();
