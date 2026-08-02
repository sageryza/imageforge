// Animate each pastel panel with wan-2.2-i2v-fast (same pinned version as
// movies.js VIDEO_MODELS.draft), 720p, 121 frames (~7.5s), concurrency 4.
// The 2:3 input keeps its aspect through wan, so the clips come back portrait.
const fs = require('fs');
const { OUT, BEATS } = require('./beats');
const TOKEN = process.env.REPLICATE_API_TOKEN;
const VERSION = '4eaf2b01d3bf70d8a2e00b219efeb7cb415855ad18b7dacdc4cae664a73a6eea';
const panels = require(OUT + '/panels.json');

const TAIL = ' Flat pastel illustration style with bold black ink outlines on a white background. Gentle smooth dreamy motion, no camera movement.';

async function predict(input) {
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: VERSION, input }),
  });
  let p = await res.json();
  if (p.error || !p.id) throw new Error('create failed: ' + JSON.stringify(p).slice(0, 300));
  for (let i = 0; i < 150; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const r2 = await fetch(`https://api.replicate.com/v1/predictions/${p.id}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    p = await r2.json();
    if (p.status === 'succeeded') return p;
    if (p.status === 'failed' || p.status === 'canceled') throw new Error('prediction ' + p.status + ': ' + (p.error || ''));
  }
  throw new Error('prediction timed out');
}

async function downloadTo(url, dest, tries = 3) {
  for (let a = 0; a < tries; a++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('http ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 20000) throw new Error('suspiciously small: ' + buf.length);
      fs.writeFileSync(dest, buf);
      return buf.length;
    } catch (e) { if (a === tries - 1) throw e; await new Promise(r => setTimeout(r, 2000)); }
  }
}

async function one(p) {
  const dest = `${OUT}/clip-${p.beat}.mp4`;
  if (fs.existsSync(dest) && !process.env.FORCE) { console.log(`beat ${p.beat}: clip exists, skip`); return; }
  console.log(`beat ${p.beat}: animating…`);
  const t0 = Date.now();
  const pred = await predict({
    image: p.url,
    prompt: BEATS[p.beat].motion + TAIL,
    resolution: '720p',
    num_frames: 121,
    frames_per_second: 16,
    interpolate_output: true,
    go_fast: true,
  });
  const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  const size = await downloadTo(out, dest);
  console.log(`beat ${p.beat}: done in ${((Date.now() - t0) / 1000).toFixed(0)}s (${size} bytes)`);
}

(async () => {
  const queue = panels.map(p => ({ p, tries: 0 }));
  const failures = [];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const item = queue.shift();
      try { await one(item.p); }
      catch (e) {
        console.error(`beat ${item.p.beat} FAILED (try ${item.tries + 1}): ${e.message}`);
        if (item.tries < 1) queue.push({ p: item.p, tries: item.tries + 1 });
        else failures.push(item.p.beat);
      }
    }
  });
  await Promise.all(workers);
  if (failures.length) { console.error('PERMANENT FAILURES:', failures); process.exit(1); }
  console.log('ALL CLIPS DONE');
  process.exit(0);
})();
