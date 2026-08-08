#!/usr/bin/env node
// Animate each still with Replicate wan-2.2-i2v-fast.
//
// Frame count is chosen per shot from its narration line: 81 frames is 5.07s,
// and a line longer than that has to be covered either by slowing the clip or
// by rendering more frames. Past ~1.8x slow it shows, so anything over 6.0s
// gets the 121-frame render (7.56s, ~8c) and is TRIMMED down instead.
//
//   node gen-clips.js [--only 3,7] [--pool 4]
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const TOKEN = process.env.REPLICATE_API_TOKEN;
const VERSION = '4eaf2b01d3bf70d8a2e00b219efeb7cb415855ad18b7dacdc4cae664a73a6eea';
const LONG_LINE = 6.0;

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ONLY = argOf('--only', '');
const POOL = Number(argOf('--pool', '4'));
const QUALITY = argOf('--stills', 'medium');

const shots = JSON.parse(fs.readFileSync(path.join(DIR, 'shots.json'), 'utf8')).shots;
const stills = JSON.parse(fs.readFileSync(path.join(DIR, `renders-${QUALITY}.json`), 'utf8'));
const narr = JSON.parse(fs.readFileSync(path.join(DIR, 'narration.json'), 'utf8'));
const want = ONLY ? new Set(ONLY.split(',').map(s => Number(s.trim()))) : null;

const OUT = path.join(DIR, 'clips.json');
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function replicate(url, opts, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, opts);
    if (r.status === 429 || r.status >= 500) { await sleep(2000 * Math.pow(2, i)); continue; }
    return r;
  }
  throw new Error(`replicate gave up on ${url}`);
}

async function animate(shot) {
  const still = stills[shot.n];
  if (!still) throw new Error(`shot ${shot.n}: no ${QUALITY} still`);
  const line = narr[shot.n];
  const frames = line && line.seconds > LONG_LINE ? 121 : 81;

  const r = await replicate('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: VERSION,
      input: {
        image: still.url, prompt: shot.motion, resolution: '480p',
        num_frames: frames, frames_per_second: 16,
        interpolate_output: true, go_fast: true,
      },
    }),
  });
  const j = await r.json();
  if (!j.id) throw new Error(`shot ${shot.n}: ${JSON.stringify(j).slice(0, 200)}`);

  for (let i = 0; i < 300; i++) {
    await sleep(4000);
    const p = await replicate(`https://api.replicate.com/v1/predictions/${j.id}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } });
    const d = await p.json();
    if (d.status === 'succeeded') {
      const url = Array.isArray(d.output) ? d.output[0] : d.output;
      out[shot.n] = { n: shot.n, predictionId: j.id, url, frames,
        seconds: +(frames / 16).toFixed(2), motion: shot.motion,
        still: still.url, at: new Date().toISOString() };
      save();
      console.log(`  [${shot.n}] ok  ${frames}f  ${url}`);
      return;
    }
    if (d.status === 'failed' || d.status === 'canceled') {
      throw new Error(`shot ${shot.n} ${d.status}: ${d.error || ''}`);
    }
  }
  throw new Error(`shot ${shot.n}: timed out`);
}

(async () => {
  const todo = shots.filter(s => !want || want.has(s.n));
  const long = todo.filter(s => narr[s.n] && narr[s.n].seconds > LONG_LINE).length;
  console.log(`Animating ${todo.length} shots (${long} at 121 frames) → ${OUT}`);
  const queue = todo.slice();
  const fails = [];
  await Promise.all(Array.from({ length: Math.min(POOL, queue.length) }, async () => {
    while (queue.length) {
      const s = queue.shift();
      try { await animate(s); }
      catch (e) { console.error(`  ${e.message}`); fails.push(s.n); }
    }
  }));
  save();
  console.log(`done. ${Object.keys(out).length} clips.${fails.length ? ` failed: ${fails.join(',')}` : ''}`);
})();
