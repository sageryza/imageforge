#!/usr/bin/env node
/**
 * Animate a Darius film's pictures with Replicate's wan-2.2-i2v-fast (480p).
 *
 *   node scripts/darius-animate.js <heart|proof> [--only id,id] [--res 720p] [--dry-run]
 *
 * One clip per picture, ~$0.06 each at 81 frames (VIDEO_MODELS.draft in
 * movies.js). The motion line for each comes from darius-motion.json and names
 * a REAL EVENT — Sophie's note on this pass: earlier attempts only wobbled hair
 * and edges, which reads as a broken still rather than a moving picture. A
 * picture with no line is refused rather than animated on a generic prompt.
 *
 * Resolution is the trade-off worth knowing: the stills are 1024x1536 and this
 * model's 480p output is roughly a third of that, so an animated shot is softer
 * than the still it came from. That is inherent to the draft tier, not a bug.
 *
 * Results land in .darius-film/anim-<set>/<picture>.mp4 and are never
 * re-generated if already on disk — a re-run costs nothing for what exists.
 */
const fs = require('fs');
const path = require('path');

const SET = process.argv[2] || 'heart';
const DRY = process.argv.includes('--dry-run');
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i > -1 ? process.argv[i + 1].split(',') : null; })();

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, '.darius-film');
const RES = (() => { const i = process.argv.indexOf('--res'); return i > -1 ? process.argv[i + 1] : '480p'; })();
// 720p lands in its own folder so a finer pass never overwrites the draft one
// and the two can be compared side by side.
const OUT = path.join(DIR, 'anim-' + SET + (RES === '480p' ? '' : '-' + RES));
const MOTION = require('./nde-watercolor/darius-motion.json');
const TOKEN = process.env.REPLICATE_API_TOKEN;

// Pinned in movies.js VIDEO_MODELS.draft — same version, so the two agree.
const VERSION = '4eaf2b01d3bf70d8a2e00b219efeb7cb415855ad18b7dacdc4cae664a73a6eea';
const STORE = `https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/darius-${SET}/`;
const PARALLEL = 4;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function predict(input) {
  // 429 and 5xx get backed off — the repo has been bitten by a batch dying on
  // one transient response after paying for everything before it.
  let last;
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: VERSION, input }),
    });
    if (r.ok) return r.json();
    last = `${r.status} ${(await r.text()).slice(0, 160)}`;
    if (r.status !== 429 && r.status < 500) break;
    await sleep(4000 * (attempt + 1));
  }
  throw new Error('replicate: ' + last);
}

async function wait(id) {
  for (let i = 0; i < 300; i++) {
    const r = await fetch('https://api.replicate.com/v1/predictions/' + id, {
      headers: { Authorization: 'Bearer ' + TOKEN },
    });
    const j = await r.json();
    if (j.status === 'succeeded') return Array.isArray(j.output) ? j.output[0] : j.output;
    if (j.status === 'failed' || j.status === 'canceled') throw new Error(j.error || j.status);
    await sleep(4000);
  }
  throw new Error('timed out');
}

async function one(pic) {
  const dest = path.join(OUT, pic + '.mp4');
  if (fs.existsSync(dest)) { console.log('  have', pic); return { pic, cached: true }; }
  const prompt = MOTION[pic];
  if (!prompt) throw new Error('no motion line for ' + pic);

  // The still's real filename: a re-rendered panel is "<id>-m.webp", a picture
  // drawn straight at medium is "<id>.webp" (the same two shapes the stitcher
  // learned about the hard way).
  let url = null;
  for (const n of [pic + '-m.webp', pic + '.webp']) {
    const u = STORE + n;
    if ((await fetch(u, { method: 'HEAD' })).ok) { url = u; break; }
  }
  if (!url) throw new Error('no uploaded still for ' + pic);

  const p = await predict({
    image: url, prompt, resolution: RES,
    num_frames: 81, frames_per_second: 16, interpolate_output: true, go_fast: true,
  });
  const out = await wait(p.id);
  const bytes = Buffer.from(await (await fetch(out)).arrayBuffer());
  fs.writeFileSync(dest, bytes);
  console.log(`  ${pic}  ${(bytes.length / 1e6).toFixed(1)}MB`);
  return { pic };
}

(async () => {
  const film = JSON.parse(fs.readFileSync(path.join(DIR, SET + '-film.json'), 'utf8'));
  let pics = film.shots.flatMap((s) => s.pictures.map((p) => p.file.replace(/(-m)?\.webp$/, '')));
  if (ONLY) pics = pics.filter((p) => ONLY.includes(p));
  const missing = pics.filter((p) => !MOTION[p]);
  if (missing.length) throw new Error('no motion line for: ' + missing.join(', '));

  fs.mkdirSync(OUT, { recursive: true });
  const todo = pics.filter((p) => !fs.existsSync(path.join(OUT, p + '.mp4')));
  console.log(`${SET} @ ${RES}: ${pics.length} pictures · ${todo.length} to animate · ~$${(todo.length * (RES === '480p' ? 0.06 : 0.13)).toFixed(2)}`);
  if (DRY) return;

  const queue = [...pics];
  const fails = [];
  await Promise.all(Array.from({ length: PARALLEL }, async () => {
    while (queue.length) {
      const pic = queue.shift();
      try { await one(pic); } catch (e) { console.log('  ERR', pic, e.message); fails.push(pic); }
    }
  }));
  console.log(`\n${pics.length - fails.length}/${pics.length} animated into ${path.relative(ROOT, OUT)}`);
  if (fails.length) console.log('failed: ' + fails.join(', '));
})().catch((e) => { console.error(e.message); process.exit(1); });
