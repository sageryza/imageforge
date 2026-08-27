#!/usr/bin/env node
// Create the Story Room pad for the science reel: 28 beats, each carrying
// its voiceover span as the beat's words and the panel prompt as its
// drawing prompt. Idempotent-ish: refuses to run if pad-id.json exists.
const fs = require('fs');
const path = require('path');
const BASE = 'https://imageforge-q125.onrender.com';
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'beats.json'), 'utf8'));
const OUT = path.join(__dirname, 'pad.json');
if (fs.existsSync(OUT)) { console.error('pad.json already exists — not creating twice'); process.exit(1); }

async function j(url, body) {
  const r = await fetch(BASE + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const out = await r.json();
  if (out.error) throw new Error(`${url}: ${out.error}`);
  return out;
}

(async () => {
  const pad = (await j('/api/scratchpad/pads', { title: 'Science & Belief — animated reel' })).pad;
  console.log('pad', pad);
  const beats = [];
  for (const b of plan.beats) {
    const made = await j('/api/scratchpad/add', { pad, style: 'dreamy' });
    const id = made.beat.id;
    await j('/api/scratchpad/text', { pad, id, text: b.vo });
    await j('/api/scratchpad/prompt', { pad, id, prompt: b.prompt });
    beats.push({ n: b.n, id });
    console.log('beat', b.n, id);
  }
  fs.writeFileSync(OUT, JSON.stringify({ pad, beats }, null, 1));
  console.log('DONE');
})().catch((e) => { console.error(e.message); process.exit(1); });
