#!/usr/bin/env node
// play-place-pov.js — POV film of a kid going through a 90s indoor play
// structure (Bright Child / city-museum style): crawl tunnel → bubble window →
// net climb → slide mouth → enclosed tube-slide descent → ball pit splash.
//
// 6 photoreal POV stills (gpt-image-2 · medium · 1024x1536) → wan-2.2-i2v-fast
// clips at 720p (81 frames ≈5s; the slide descent 121 ≈7.5s) → ffmpeg concat.
// Everything is uploaded to Deck Factory Storage as it exists; a manifest JSON
// records urls, exact prompts, costs and true make-times for filing.
//
// Env: OPENAI_API_KEY, REPLICATE_API_TOKEN, FIREBASE_SERVICE_ACCOUNT.
// Usage: node scripts/play-place-pov.js <outdir>

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const admin = require('firebase-admin');
const FFMPEG = require('ffmpeg-static');

const OUT = process.argv[2] || path.join(__dirname, '..', 'out-playplace');
fs.mkdirSync(OUT, { recursive: true });
const MANIFEST = path.join(OUT, 'manifest.json');
const state = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { scenes: [], film: null };
const save = () => fs.writeFileSync(MANIFEST, JSON.stringify(state, null, 2));

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
const bucket = admin.storage().bucket();

const WAN_VERSION = '4eaf2b01d3bf70d8a2e00b219efeb7cb415855ad18b7dacdc4cae664a73a6eea';

// The one style prefix, identical on all six renders (filed as the prompt's
// style half). Content halves are filed verbatim per scene.
const STYLE =
  'Photorealistic first-person POV photo, wide-angle action-camera perspective ' +
  'at a small child\'s eye level, bright indoor lighting, 1990s indoor ' +
  'children\'s play place, primary-colored padded play structure. ';

const SCENES = [
  {
    id: 'tunnel-crawl',
    label: 'POV — crawling through the padded tunnel',
    content: 'Crawling forward through an enclosed padded crawl tube, both small hands visible on the wipeable blue vinyl floor ahead, the tube curving to the right, round clear porthole windows in the walls glowing with light from the big play room, colorful netting visible through them.',
    motion: 'First-person camera crawls steadily forward through the padded tunnel, gently rocking side to side with each hand placement, moving toward the bend ahead.',
    frames: 81,
  },
  {
    id: 'bubble-window',
    label: 'POV — the bubble window over the play floor',
    content: 'Looking out through a scratched clear plastic bubble dome window from inside the play structure, two small hands pressed against the plastic, the whole indoor play place spread out below: a ball pit, padded ramps, foam-wrapped support poles, colorful tube slides winding between levels.',
    motion: 'The camera slowly leans closer to the curved bubble window, peering down at the play floor far below, light shifting across the scratched plastic.',
    frames: 81,
  },
  {
    id: 'net-climb',
    label: 'POV — climbing the rope net',
    content: 'Climbing up through a steep netted rope tunnel inside the play structure, small hands gripping the thick woven rope net, a padded platform level visible above through the netting, colored plastic panels and soft foam edges on both sides.',
    motion: 'First-person camera climbs upward through the rope netting, hands gripping one row higher then another, the padded platform above growing closer.',
    frames: 81,
  },
  {
    id: 'slide-mouth',
    label: 'POV — at the mouth of the tube slide',
    content: 'Kneeling at the glowing mouth of an enclosed red spiral tube slide, small hands gripping the smooth plastic rim, looking down into the tunnel as it curves away out of sight, light reflecting off the glossy red plastic walls.',
    motion: 'The camera leans forward over the rim and tips down into the slide, starting to descend into the curving red tunnel.',
    frames: 81,
  },
  {
    id: 'slide-descent',
    label: 'POV — rushing down inside the tube slide',
    content: 'Rushing down inside the enclosed red tube slide mid-descent, the glossy curved plastic walls wrapping tightly all around, panel seams streaking past, warm red glow everywhere, white sneakers and legs stretched out ahead toward the curve below.',
    motion: 'Fast first-person descent down the spiral tube slide, the camera rushing and banking along the curving glossy red walls, seams and light flashing past, speeding up around the bend.',
    frames: 121,
  },
  {
    id: 'ball-pit',
    label: 'POV — splashing into the ball pit',
    content: 'Shooting out of the tube slide\'s bright round opening into a huge ball pit, hundreds of red, yellow, blue and green plastic balls splashing up toward the camera, legs ahead half-buried in the balls, padded walls and safety netting around the pit.',
    motion: 'The camera splashes into the ball pit, colorful plastic balls flying up past the lens and tumbling back down, then gentle bobbing as everything settles.',
    frames: 81,
  },
];

async function uploadBuffer(buf, contentType, name) {
  const file = bucket.file(`playplace/${name}`);
  let lastErr;
  for (let a = 0; a < 3; a++) {
    try {
      await file.save(buf, { metadata: { contentType } });
      await file.makePublic();
      return `https://storage.googleapis.com/${bucket.name}/playplace/${name}`;
    } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 1500 * (a + 1))); }
  }
  throw lastErr;
}

async function fetchBuffer(url, retries = 5) {
  let lastErr;
  for (let a = 0; a <= retries; a++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`fetch ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 2000 * (a + 1))); }
  }
  throw lastErr;
}

async function genStill(scene) {
  const prompt = STYLE + scene.content;
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2', prompt, n: 1, size: '1024x1536', quality: 'medium' }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`gpt-image-2: ${j.error?.message || res.status}`);
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new Error('gpt-image-2 returned no image');
  return { buf: Buffer.from(b64, 'base64'), prompt };
}

async function replicatePredict(version, input, { pollMs = 5000, maxPolls = 180 } = {}) {
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version, input }),
  });
  let p = await res.json();
  if (!res.ok) throw new Error(`replicate: ${p.detail || res.status}`);
  for (let i = 0; i < maxPolls; i++) {
    if (['succeeded', 'failed', 'canceled'].includes(p.status)) break;
    await new Promise(r => setTimeout(r, pollMs));
    const pr = await fetch(`https://api.replicate.com/v1/predictions/${p.id}`, {
      headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
    });
    p = await pr.json();
  }
  if (p.status !== 'succeeded') throw new Error(`replicate ${p.status}: ${p.error || ''}`);
  return p;
}

(async () => {
  for (const scene of SCENES) {
    let rec = state.scenes.find(s => s.id === scene.id);
    if (!rec) { rec = { id: scene.id, label: scene.label }; state.scenes.push(rec); }

    if (!rec.stillUrl) {
      console.log(`[still] ${scene.id} …`);
      const { buf, prompt } = await genStill(scene);
      const madeAt = Date.now();
      fs.writeFileSync(path.join(OUT, `${scene.id}.png`), buf);
      rec.stillUrl = await uploadBuffer(buf, 'image/png', `${scene.id}.png`);
      rec.promptStyle = STYLE;
      rec.promptContent = scene.content;
      rec.promptFull = prompt;
      rec.model = 'gpt-image-2'; rec.quality = 'medium'; rec.madeAt = madeAt;
      save();
      console.log(`[still] ${scene.id} → ${rec.stillUrl}`);
    }

    if (!rec.clipUrl) {
      console.log(`[clip] ${scene.id} (${scene.frames}f) …`);
      const p = await replicatePredict(WAN_VERSION, {
        image: rec.stillUrl,
        prompt: scene.motion,
        resolution: '720p',
        num_frames: scene.frames,
        frames_per_second: 16,
        interpolate_output: true,
        go_fast: true,
      });
      const output = Array.isArray(p.output) ? p.output[0] : p.output;
      if (!output) throw new Error('wan produced no output');
      const buf = await fetchBuffer(output);
      fs.writeFileSync(path.join(OUT, `${scene.id}.mp4`), buf);
      rec.clipUrl = await uploadBuffer(buf, 'video/mp4', `${scene.id}.mp4`);
      rec.motionPrompt = scene.motion;
      rec.clipFrames = scene.frames;
      rec.clipCost = scene.frames > 81 ? 0.24 : 0.16;
      save();
      console.log(`[clip] ${scene.id} → ${rec.clipUrl}`);
    }
  }

  if (!state.film) {
    console.log('[stitch] …');
    // Normalize every clip (720p wan output can vary a pixel or two) then concat.
    const parts = SCENES.map(s => path.join(OUT, `${s.id}.mp4`));
    for (const f of parts) if (!fs.existsSync(f)) {
      const rec = state.scenes.find(s => f.includes(s.id));
      fs.writeFileSync(f, await fetchBuffer(rec.clipUrl));
    }
    const inputs = parts.flatMap(f => ['-i', f]);
    const n = parts.length;
    const filters = parts.map((_, i) =>
      `[${i}:v]scale=720:1080:force_original_aspect_ratio=decrease,pad=720:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`).join(';');
    const concat = parts.map((_, i) => `[v${i}]`).join('') + `concat=n=${n}:v=1:a=0[out]`;
    const filmFile = path.join(OUT, 'play-place-pov.mp4');
    execFileSync(FFMPEG, [
      '-y', ...inputs,
      '-filter_complex', `${filters};${concat}`,
      '-map', '[out]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart',
      filmFile,
    ], { stdio: 'inherit' });
    state.film = {
      url: await uploadBuffer(fs.readFileSync(filmFile), 'video/mp4', 'play-place-pov.mp4'),
      madeAt: Date.now(),
    };
    save();
    console.log(`[film] → ${state.film.url}`);
  }

  const spend = state.scenes.reduce((t, s) => t + 0.06 + (s.clipCost || 0), 0);
  console.log(`DONE. film: ${state.film.url}  approx spend: $${spend.toFixed(2)}`);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
