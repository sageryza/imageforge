#!/usr/bin/env node
// Thresholdyn — parody pharma commercial pipeline (v1, 480p draft)
// stills: gpt-image-2 medium 1536x1024 · clips: wan-2.2-i2v-fast 480p 81f
// VO: ElevenLabs "Bill" (premade, advertisement) on eleven_multilingual_v2
// Assembly: ffmpeg-static, 720x480 30fps, PCM audio concat, one AAC mux.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = '/home/user/imageforge';
const FFMPEG = require(path.join(REPO, 'node_modules/ffmpeg-static'));
const FFPROBE = require(path.join(REPO, 'node_modules/ffprobe-static')).path;
const admin = require(path.join(REPO, 'node_modules/firebase-admin'));

const WORK = __dirname;
const OUT = (f) => path.join(WORK, f);
const log = (...a) => { const line = `[${new Date().toISOString()}] ${a.join(' ')}`; console.log(line); fs.appendFileSync(OUT('pipeline.log'), line + '\n'); };

// ─── Firebase (Deck Factory) ────────────────────────────────────────
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
const bucket = admin.storage().bucket();
async function upload(local, dest, contentType) {
  await bucket.upload(local, { destination: dest, metadata: { contentType } });
  await bucket.file(dest).makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${dest}`;
}

// ─── The spot ───────────────────────────────────────────────────────
const BW = 'Photorealistic cinematic still from an American prescription drug television commercial, shot on 35mm, shallow depth of field, black and white, desaturated, flat overcast window light, melancholy mood. ';
const CO = 'Photorealistic cinematic still from an American prescription drug television commercial, shot on 35mm, shallow depth of field, warm golden-hour light, gently saturated hopeful mood. ';
const PR = 'Photorealistic television commercial product shot, crisp studio lighting, flat solid backdrop with no gradients. ';
const EC = 'A minimalist television commercial end card: flat solid cream background, centered large elegant dark navy serif text "THRESHOLDYN" with a small trademark symbol, beneath it smaller italic navy text "Walk in like you mean it.", and at the bottom a single line of small gray text "doorzepam maleate". Clean typography, perfectly flat design, no gradients, no other elements.';

const SHOTS = [
  { id: 'bw-kitchen',  style: BW, content: 'A woman in her forties stands in the middle of a sunlit suburban kitchen holding a single screwdriver, utterly lost expression, staring into space.', motion: 'The woman slowly looks around the kitchen, bewildered; camera holds still.' },
  { id: 'bw-stare',    style: BW, content: 'Close-up of a woman in her forties looking down at a screwdriver held in her hand as if she has never seen it before, baffled expression, suburban kitchen behind her.', motion: 'She slowly turns the screwdriver in her hand, tilting her head in confusion.' },
  { id: 'bw-garage',   style: BW, content: 'A middle-aged man stands frozen just inside a garage doorway, one hand raised in a forgotten gesture, completely lost.', motion: 'The man scratches his head slowly, shifting his weight, lost.' },
  { id: 'bw-hallway',  style: BW, content: 'A woman walks backward down a home hallway retracing her steps, looking at the floor, confused.', motion: 'She steps slowly backward down the hallway, glancing side to side.' },
  { id: 'bw-pantry',   style: BW, content: 'A young man stands in a pantry doorway staring blankly at the shelves, holding car keys, completely lost.', motion: 'He stares at the shelves, then slowly raises the car keys and looks at them, baffled.' },
  { id: 'color-snap',  style: CO, content: 'A woman in her forties in a sunlit suburban kitchen snaps her fingers and strides confidently toward a kitchen drawer, purposeful smile.', motion: 'She snaps her fingers and strides confidently toward the drawer, full of purpose.' },
  { id: 'product-hero',style: PR, content: 'An amber prescription pill bottle with a white cap and a clean label reading "THRESHOLDYN" stands on a flat matte coral-pink backdrop with a soft shadow, a few small white pills beside it.', motion: 'The pill bottle rotates slowly in place, studio light glinting softly on the amber plastic.' },
  { id: 'ladder',      style: CO, content: 'A middle-aged man walks into a garage and immediately lifts a ladder off the wall, purposeful confident smile.', motion: 'He lifts the ladder smoothly off the wall and turns to carry it out, smiling.' },
  { id: 'book',        style: CO, content: 'A grandmother enters a cozy den and pulls one specific book from a bookshelf, satisfied smile.', motion: 'She slides the book off the shelf and holds it to her chest, pleased.' },
  { id: 'kayak',       style: CO, content: 'A group of happy adults in life vests kayaking across a sparkling lake, laughing.', motion: 'The kayakers paddle forward, water sparkling, everyone laughing.' },
  { id: 'porch',       style: CO, content: 'A couple laughs together on a porch swing at sunset holding glasses of lemonade.', motion: 'The porch swing sways gently as the couple laughs together.' },
  { id: 'dogwalk',     style: CO, content: 'A man walks a golden retriever through a leafy park, waving cheerfully to a neighbor.', motion: 'The man and the dog walk forward as he waves cheerfully to a neighbor.' },
  { id: 'garden',      style: CO, content: 'A woman waters bright garden flowers with a metal watering can, smiling contentedly.', motion: 'Water arcs gently from the can onto the flowers as she smiles.' },
  { id: 'slowmo-door', style: CO, content: 'A woman in her forties walks through a home doorway directly toward the camera in triumphant slow motion, holding a screwdriver slightly aloft like a torch, confident smile, warm backlight.', motion: 'She strides toward the camera in slow motion, screwdriver raised, hair moving softly, triumphant.' },
  { id: 'endcard',     style: '', content: EC, motion: null }, // still — never animated (text warps)
];

const SEGS = [
  { shots: ['bw-kitchen'],  text: 'You walked in here for a reason.' },
  { shots: ['bw-stare'],    text: 'That reason... is gone.' },
  { shots: ['bw-garage', 'bw-hallway', 'bw-pantry'], text: 'Doorway Onset Purpose Loss — D.O.P.L. — strikes nine out of ten adults every single time they change rooms. For decades, sufferers had no choice but to stand in the doorway, retrace their steps... or simply begin a new life in the room they now occupy.' },
  { shots: ['color-snap', 'product-hero'], text: 'Introducing Thresholdyn. The first once-daily treatment that lets you walk into a room — and still know why.' },
  { shots: ['ladder', 'book'], text: 'With Thresholdyn, your purpose crosses the doorway with you.' },
  { shots: ['kayak', 'porch', 'dogwalk', 'garden'], tempo: 1.3, text: 'Thresholdyn is not for everyone. Do not take Thresholdyn if you are allergic to Thresholdyn, doorways, or knowing things. Side effects may include: remembering things you had preferred to forget, knowing why you\'re in every room all the time, an inability to wander, spontaneous errand completion, and telling people what you actually came over to say. In rare cases, users have remembered why they got married. Do not operate a hallway until you know how Thresholdyn affects you. If you experience a sense of purpose lasting more than four hours, that\'s the intended effect. Ask your doctor if remembering is right for you.' },
  { shots: ['slowmo-door'], text: 'Thresholdyn. Walk in like you mean it.' },
  { shots: ['endcard'], text: null, holdSec: 3.2 }, // silent hold on the end card
];

const VOICE_ID = 'pqHfZKP75CvOlQylNhV4'; // Bill — Wise, Mature, Balanced (premade, advertisement)
const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true };
const WAN = { version: '4eaf2b01d3bf70d8a2e00b219efeb7cb415855ad18b7dacdc4cae664a73a6eea' };
const W = 720, H = 480, FPS = 30;
const PRE_GAP = 0.30, POST_GAP = 0.40; // s of air around each VO segment

// ─── helpers ────────────────────────────────────────────────────────
const run = (bin, args) => execFileSync(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
const probeDur = (f) => parseFloat(run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f]).toString().trim());
async function pmap(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}
async function retry(times, fn, label) {
  let err;
  for (let a = 0; a < times; a++) {
    try { return await fn(); } catch (e) { err = e; log(`RETRY ${label}: ${e.message}`); await new Promise(r => setTimeout(r, 4000 * (a + 1))); }
  }
  throw err;
}

// ─── Stage A: stills ────────────────────────────────────────────────
async function genImage(shot) {
  const prompt = shot.style + shot.content;
  const made = Date.now();
  { // resume: an already-rendered still is never re-bought
    const local = OUT(`still-${shot.id}.png`);
    if (fs.existsSync(local) && fs.statSync(local).size > 10000) {
      const url = await upload(local, `pill-commercial/still-${shot.id}.png`, 'image/png');
      log(`still ${shot.id} reused from disk`);
      return { ...shot, prompt, local, url, made: fs.statSync(local).mtimeMs };
    }
  }
  const j = await retry(3, async () => {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-2', prompt, n: 1, size: '1536x1024', quality: 'medium' }),
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    if (!j.data?.[0]?.b64_json) throw new Error('no image data');
    return j;
  }, `image ${shot.id}`);
  const local = OUT(`still-${shot.id}.png`);
  fs.writeFileSync(local, Buffer.from(j.data[0].b64_json, 'base64'));
  const url = await upload(local, `pill-commercial/still-${shot.id}.png`, 'image/png');
  log(`still ${shot.id} done → ${url}`);
  return { ...shot, prompt, local, url, made };
}

// ─── Stage B: VO ────────────────────────────────────────────────────
async function genVO(seg, idx) {
  if (!seg.text) return { ...seg, idx };
  const mp3 = OUT(`vo-${idx}.mp3`);
  if (fs.existsSync(mp3) && fs.statSync(mp3).size > 1000) { log(`vo ${idx} reused`); return { ...seg, idx, mp3 }; }
  await retry(3, async () => {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_192`, {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: seg.text, model_id: 'eleven_multilingual_v2', voice_settings: VOICE_SETTINGS }),
    });
    if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) throw new Error('empty audio');
    fs.writeFileSync(mp3, buf);
  }, `vo ${idx}`);
  log(`vo ${idx} done (${probeDur(mp3).toFixed(2)}s raw)`);
  return { ...seg, idx, mp3 };
}

// ─── Stage C: clips ─────────────────────────────────────────────────
async function replicatePredict(version, input) {
  let p;
  for (let a = 0; a < 6; a++) {
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, input }),
    });
    if (res.status === 429) { await new Promise(r => setTimeout(r, 2000 * 2 ** a + Math.random() * 1000)); continue; }
    p = await res.json(); break;
  }
  if (!p) throw new Error('Replicate rate-limited after retries');
  if (p.error) throw new Error(typeof p.error === 'string' ? p.error : JSON.stringify(p.error));
  if (!p.urls?.get) throw new Error(p.detail || 'no polling URL');
  let polls = 0;
  while (!['succeeded', 'failed', 'canceled'].includes(p.status) && polls < 180) {
    await new Promise(r => setTimeout(r, 5000));
    p = await (await fetch(p.urls.get, { headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` } })).json();
    polls++;
  }
  if (p.status !== 'succeeded') throw new Error(`prediction ${p.status}: ${p.error || 'timed out'}`);
  return p;
}
async function genClip(shot) {
  if (!shot.motion) return shot; // endcard stays a still
  { const local = OUT(`clip-${shot.id}.mp4`);
    if (fs.existsSync(local) && fs.statSync(local).size > 50000) { log(`clip ${shot.id} reused`); return { ...shot, clip: local }; } }
  const p = await retry(2, () => replicatePredict(WAN.version, {
    image: shot.url, prompt: shot.motion, resolution: '480p',
    num_frames: 81, frames_per_second: 16, interpolate_output: true, go_fast: true,
  }), `clip ${shot.id}`);
  const outUrl = Array.isArray(p.output) ? p.output[0] : p.output;
  const local = OUT(`clip-${shot.id}.mp4`);
  fs.writeFileSync(local, Buffer.from(await (await fetch(outUrl)).arrayBuffer()));
  log(`clip ${shot.id} done (${probeDur(local).toFixed(2)}s)`);
  return { ...shot, clip: local };
}

// ─── Stage D: assembly ──────────────────────────────────────────────
// The static ffmpeg's stream-copy concat (demuxer AND concat: protocol)
// segfaults in this sandbox — measured live. The concat FILTER path works
// (proved on the audio), so video assembly is one filter-graph encode.
function assemble(shots, segs) {
  const byId = Object.fromEntries(shots.map(s => [s.id, s]));
  const inputs = [], chains = [], wavs = [];
  let vIdx = 0;
  segs.forEach((seg, i) => {
    let speech = 0;
    if (seg.mp3) speech = probeDur(seg.mp3) / (seg.tempo || 1);
    const total = seg.text ? PRE_GAP + speech + POST_GAP : seg.holdSec;
    const framesTotal = Math.round(total * FPS);
    const segDur = framesTotal / FPS;
    // audio → exact-length wav
    const wav = OUT(`seg-${i}.wav`);
    if (seg.mp3) {
      const af = [];
      if (seg.tempo) af.push(`atempo=${seg.tempo}`);
      af.push(`adelay=${Math.round(PRE_GAP * 1000)}|${Math.round(PRE_GAP * 1000)}`, 'apad');
      run(FFMPEG, ['-y', '-i', seg.mp3, '-af', af.join(','), '-t', segDur.toFixed(3), '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', wav]);
    } else {
      run(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', segDur.toFixed(3), '-c:a', 'pcm_s16le', wav]);
    }
    wavs.push(wav);
    // shots → per-shot frame budget, each a chain into the concat filter
    const n = seg.shots.length;
    const base = Math.floor(framesTotal / n);
    seg.shots.forEach((id, k) => {
      const frames = base + (k < framesTotal - base * n ? 1 : 0);
      const dur = (frames / FPS).toFixed(4);
      const s = byId[id];
      const scale = `fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
      if (s.clip) {
        inputs.push('-i', s.clip);
        chains.push(`[${vIdx}:v]${scale},tpad=stop_mode=clone:stop_duration=15,trim=duration=${dur},setpts=PTS-STARTPTS[v${vIdx}]`);
      } else {
        inputs.push('-loop', '1', '-t', dur, '-i', s.local);
        chains.push(`[${vIdx}:v]${scale},trim=duration=${dur},setpts=PTS-STARTPTS[v${vIdx}]`);
      }
      log(`shot ${id} allotted ${dur}s`);
      vIdx++;
    });
  });
  const graph = chains.join(';') + ';' + chains.map((_, i) => `[v${i}]`).join('') + `concat=n=${vIdx}:v=1:a=0[vout]`;
  fs.writeFileSync(OUT('graph.txt'), graph);
  run(FFMPEG, ['-y', ...inputs, '-filter_complex_script', OUT('graph.txt'), '-map', '[vout]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', OUT('video.mp4')]);
  // audio: concat filter (the demuxer segfaults here too)
  const aIn = wavs.flatMap(w => ['-i', w]);
  run(FFMPEG, ['-y', ...aIn, '-filter_complex', `concat=n=${wavs.length}:v=0:a=1[a]`, '-map', '[a]', '-c:a', 'pcm_s16le', OUT('full.wav')]);
  const total = probeDur(OUT('full.wav'));
  run(FFMPEG, ['-y', '-i', OUT('video.mp4'), '-i', OUT('full.wav'),
    '-af', `afade=t=out:st=${(total - 0.8).toFixed(2)}:d=0.8`,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest', OUT('thresholdyn-v1.mp4')]);
  log(`assembled: ${total.toFixed(1)}s`);
  return OUT('thresholdyn-v1.mp4');
}

// ─── main ───────────────────────────────────────────────────────────
(async () => {
  log('START Thresholdyn v1 pipeline');
  const stills = await pmap(SHOTS, 4, genImage);
  log('all stills done');
  const segs = await pmap(SEGS, 4, (s, i) => genVO(s, i));
  log('all VO done');
  const shots = await pmap(stills, 4, genClip);
  log('all clips done');
  const film = assemble(shots, segs);
  const filmUrl = await upload(film, 'pill-commercial/thresholdyn-v1.mp4', 'video/mp4');
  const manifest = {
    filmUrl, filmLocal: film, durationSec: probeDur(film),
    voice: 'ElevenLabs "Bill" (premade) · eleven_multilingual_v2 · stability 0.5, similarity 0.75, style 0, speaker_boost',
    segs: segs.map(s => ({ shots: s.shots, text: s.text, tempo: s.tempo || 1 })),
    shots: shots.map(s => ({ id: s.id, url: s.url, made: s.made, prompt: s.prompt, style: s.style, content: s.content, motion: s.motion, animated: !!s.clip })),
    cost: { stills: shots.length * 0.063, clips: shots.filter(s => s.clip).length * 0.06 },
  };
  fs.writeFileSync(OUT('manifest.json'), JSON.stringify(manifest, null, 2));
  log(`DONE film → ${filmUrl} (${manifest.durationSec.toFixed(1)}s)`);
})().catch(e => { log('FATAL', e.stack || e.message); process.exit(1); });
