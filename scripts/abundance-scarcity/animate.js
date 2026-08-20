// Animate the six abundance/scarcity watercolours with wan-2.2-i2v-fast — the
// same pinned version as movies.js VIDEO_MODELS.draft, 720p, 121 frames
// (~7.5s), concurrency 3. The 2:3 stills keep their aspect through wan, so the
// clips come back portrait.
//
//   node scripts/abundance-scarcity/animate.js <outdir>
//
// Motion is described PER BEAT (Sophie's rule, Aug 2026: no house motion
// default) and describes MOTION only — one continuous action inside the shot,
// never a cut. The preserve tail is movies.js's quick-animate tail verbatim.
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || '/home/user/out/abundance-film';
const TOKEN = process.env.REPLICATE_API_TOKEN;
const VERSION = '4eaf2b01d3bf70d8a2e00b219efeb7cb415855ad18b7dacdc4cae664a73a6eea';
const BASE = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/abundance-scarcity';
const TAIL = '. The subject, style and composition of the image are preserved exactly.';

const BEATS = [
  { id: 'abundance-1-the-flood',
    motion: 'A very slow push in toward the woman standing among the boxes. The stacks hold still; a few loose strands of her hair drift' },
  { id: 'abundance-3-the-mountain',
    motion: 'A slow tilt upward along the mountain of cardboard boxes. The small figure at its foot stays still' },
  { id: 'abundance-2-inventing-uses',
    motion: 'Her hand works the scissors, cutting slowly into the cardboard. Everything else in the room holds still' },
  { id: 'scarcity-1-velvet-throne',
    motion: 'The small glowing bulb on the throne pulses slowly, brighter and then dimmer. The kneeling woman stays still, watching it' },
  { id: 'scarcity-2-petting-it',
    motion: 'Her finger strokes the small glowing thing slowly back and forth, and the glow rises and falls under her touch' },
  { id: 'both-1-diptych',
    motion: 'A very slow push in on the whole picture, both halves at once. Nothing inside either half moves' },
];

async function predict(input) {
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: VERSION, input }),
  });
  let p = await res.json();
  if (p.error || !p.id) throw new Error('create failed: ' + JSON.stringify(p).slice(0, 300));
  for (let i = 0; i < 180; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const r2 = await fetch(`https://api.replicate.com/v1/predictions/${p.id}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    p = await r2.json();
    if (p.status === 'succeeded') return p;
    if (p.status === 'failed' || p.status === 'canceled') {
      throw new Error('prediction ' + p.status + ': ' + (p.error || ''));
    }
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
    } catch (e) {
      if (a === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function one(b) {
  const dest = path.join(OUT, `clip-${b.id}.mp4`);
  if (fs.existsSync(dest) && !process.env.FORCE) { console.log(`  skip ${b.id} (exists)`); return; }
  const prompt = b.motion + TAIL;
  const t0 = Date.now();
  const pred = await predict({
    image: `${BASE}/${b.id}.webp`,
    prompt,
    resolution: '720p',
    num_frames: 121,
    frames_per_second: 16,
    interpolate_output: true,
    go_fast: true,
  });
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (!url) throw new Error('no output for ' + b.id);
  const bytes = await downloadTo(url, dest);
  console.log(`  OK  ${b.id}: ${(bytes / 1024 / 1024).toFixed(1)} MB  ${((Date.now() - t0) / 1000) | 0}s`);
  return { id: b.id, prompt, file: dest, model: 'wan-2.2-i2v-fast', resolution: '720p', frames: 121, cost: 0.24 };
}

(async () => {
  if (!TOKEN) throw new Error('REPLICATE_API_TOKEN not set');
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`${BEATS.length} clips · wan-2.2-i2v-fast · 720p · 121 frames · ~$${(BEATS.length * 0.24).toFixed(2)}\n`);
  const done = [];
  const queue = BEATS.slice();
  await Promise.all([0, 1, 2].map(async () => {
    while (queue.length) {
      const b = queue.shift();
      try { const r = await one(b); if (r) done.push(r); }
      catch (e) { console.log(`  ERR ${b.id}: ${e.message}`); }
    }
  }));
  // The motion prompts are recorded the way the stills' prompts.json is, so the
  // exact text sent is on file rather than reconstructed later.
  fs.writeFileSync(path.join(OUT, 'clips.json'), JSON.stringify(done, null, 2));
  console.log(`\n${done.length}/${BEATS.length} → ${OUT}`);
})();
