// make-clearing.js — the "clearing things up" segment for the Vibrilify MAX
// spot, built END TO END in the session container (renders, clips, VO, mix,
// stitch, upload). Deliberately not routed through the server: the 512MB
// Render box died mid-stitch on this project once already, and a deploy
// landing mid-run orphans paid work — a container is immune to both.
//
// Resumable: every phase writes state-clearing.json and skips what is
// already there, so a re-run after a failure re-pays for nothing.
// Usage: node scripts/vibrilify/make-clearing.js [--phase shoot|clips|vo|stitch]
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const admin = require('firebase-admin');

const FFMPEG = require('ffmpeg-static');
const FFPROBE = require('ffprobe-static').path;
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'spec-clearing.json'), 'utf8'));
const STATE = path.join(__dirname, 'state-clearing.json');
const read = () => (fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { shots: {}, clips: {} });
const state = read();
// MERGE ON THE WAY OUT, never a blind overwrite. Phases are meant to run
// separately and often overlap — the vo render finished while the clips run
// was still going, and the clips process, holding a snapshot taken before it,
// wrote `vo` straight back out of existence when its second clip landed. The
// wav was still in Storage, so nothing was re-paid; the stitch just could not
// find it. Re-reading the file at write time is the whole fix.
const save = () => {
  const disk = read();
  const merged = { ...disk, ...state };
  for (const k of ['shots', 'clips']) merged[k] = { ...(disk[k] || {}), ...(state[k] || {}) };
  fs.writeFileSync(STATE, JSON.stringify(merged, null, 2) + '\n');
  Object.assign(state, merged);
};

const KEY = process.env.OPENAI_API_KEY;
const REPL = process.env.REPLICATE_API_TOKEN;
const SFX_DIR = process.env.VIB_SFX_DIR || path.join(__dirname, 'sfx');
const TARGET = { width: 1080, height: 1920 };
const XFADE = 0.4;                     // the spot's soft pharma dissolve
const WAN = '4eaf2b01d3bf70d8a2e00b219efeb7cb415855ad18b7dacdc4cae664a73a6eea';

const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(svc), storageBucket: `${svc.project_id}.firebasestorage.app` });
const bucket = () => admin.storage().bucket();

function run(bin, args, timeoutMs = 900000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${path.basename(bin)}: ${err.message}\n${String(stderr).slice(-500)}`));
      else resolve({ stdout, stderr });
    });
  });
}
async function probe(file) {
  const { stdout } = await run(FFPROBE, ['-v', 'quiet', '-print_format', 'json', '-show_format', file]);
  return Number(JSON.parse(stdout).format?.duration) || 0;
}
async function fetchToFile(url, file) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('http ' + r.status);
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      return file;
    } catch (e) { if (a === 2) throw e; await new Promise(r => setTimeout(r, 1500 * (a + 1))); }
  }
}
async function upload(buf, dir, ext, type) {
  const b = bucket();
  const name = `${dir}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  await b.file(name).save(buf, { metadata: { contentType: type } });
  await b.file(name).makePublic();
  return `https://storage.googleapis.com/${b.name}/${name}`;
}

// ---- phase: shoot -------------------------------------------------------
// gpt-image-2, medium, 1024x1536, webp. NO output_compression: the house rule
// is that a generation is never lossy at birth (test-no-generation-compression).
async function generate(prompt) {
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2', prompt, n: 1, size: '1024x1536', quality: 'medium', output_format: 'webp' }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return Buffer.from(d.data[0].b64_json, 'base64');
}
// A shot with `ref` is an EDIT against an already-rendered shot — the
// shoot-v3 `matchShot` move. The unfurl needs it: generated cold, the "after"
// frame came back a macro close-up at a different camera distance, and a morph
// between two framings reads as a cut to somewhere else, not as a pile coming
// apart. The match sentence is spec-side so the filed style half quotes it.
async function edit(prompt, refBuf) {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', prompt);
  form.append('image[]', new Blob([refBuf], { type: 'image/webp' }), 'ref0.webp');
  form.append('size', '1024x1536');
  form.append('quality', 'medium');
  form.append('output_format', 'webp');
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: form,
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return Buffer.from(d.data[0].b64_json, 'base64');
}
async function shoot() {
  for (const s of spec.shots) {
    if (state.shots[s.id]?.url) { console.error(`shot ${s.id} — kept`); continue; }
    const style = (s.styled ? spec.moaStyle : '') + (s.ref ? s.matchLine : '');
    const prompt = style + s.imagePrompt;
    console.error(`shot ${s.id} — ${s.ref ? 'editing against ' + s.ref : 'rendering'}…`);
    let buf;
    if (s.ref) {
      const refUrl = state.shots[s.ref]?.url;
      if (!refUrl) throw new Error(`shot ${s.id}: ref ${s.ref} not rendered yet`);
      buf = await edit(prompt, Buffer.from(await (await fetch(refUrl)).arrayBuffer()));
    } else {
      buf = await generate(prompt);
    }
    const url = await upload(buf, 'movies/panels', 'webp', 'image/webp');
    state.shots[s.id] = { url, promptUsed: prompt, style, content: s.imagePrompt, ref: s.ref || null, quality: 'medium', at: Date.now() };
    save();
    console.error(`  ${url}`);
  }
}

// ---- phase: clips -------------------------------------------------------
// wan-2.2-i2v-fast, the spot's own draft tier. `last_image` is the morph
// target (movies.js videoInput's wan22 arm, mirrored) — 81 frames is the
// model's floor, so ~5s is the shortest clip that exists at this tier.
async function replicate(version, input) {
  let p;
  for (let a = 0; a < 6; a++) {
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${REPL}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, input }),
    });
    if (res.status === 429) { await new Promise(r => setTimeout(r, 2000 * 2 ** a)); continue; }
    p = await res.json(); break;
  }
  if (!p) throw new Error('Replicate rate-limited after retries');
  if (p.error) throw new Error(typeof p.error === 'string' ? p.error : JSON.stringify(p.error));
  if (!p.urls?.get) throw new Error(p.detail || 'no polling url');
  for (let i = 0; i < 180 && !['succeeded', 'failed', 'canceled'].includes(p.status); i++) {
    await new Promise(r => setTimeout(r, 5000));
    p = await (await fetch(p.urls.get, { headers: { Authorization: `Bearer ${REPL}` } })).json();
  }
  if (p.status !== 'succeeded') throw new Error(`prediction ${p.status}: ${p.error || 'timed out'}`);
  return Array.isArray(p.output) ? p.output[0] : p.output;
}
const shotUrl = id => (id === 'endCard' ? spec.endCard : state.shots[id]?.url);
async function clips() {
  for (const c of spec.clips) {
    if (state.clips[c.id]?.url) { console.error(`clip ${c.id} — kept`); continue; }
    const start = shotUrl(c.from);
    if (!start) throw new Error(`clip ${c.id}: missing ${c.from}`);
    // `to` is OPTIONAL — the morph target. The star beat deliberately has
    // none: its natural target would be the end card, and a wan morph target
    // carrying TYPE comes back with the lettering garbled.
    const end = c.to ? shotUrl(c.to) : null;
    if (c.to && !end) throw new Error(`clip ${c.id}: missing ${c.to}`);
    console.error(`clip ${c.id} — animating${end ? ` → ${c.to}` : ''}…`);
    const out = await replicate(WAN, {
      image: start, ...(end ? { last_image: end } : {}), prompt: c.motionPrompt,
      resolution: '480p', num_frames: c.frames, frames_per_second: 16,
      interpolate_output: true, go_fast: true,
    });
    state.clips[c.id] = { url: out, at: Date.now(), cost: c.frames > 81 ? 0.08 : 0.06 };
    save();
    console.error(`  ${out}`);
  }
}

// ---- phase: vo ----------------------------------------------------------
// Same model, voice and announcer instructions as the spot's own VO
// (spec.json) — a segment spliced in must not change register.
async function vo() {
  if (state.vo?.url) { console.error('vo — kept'); return; }
  const l = spec.voice.line;
  console.error('vo — rendering…');
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: spec.voice.model, voice: spec.voice.voice, input: l.text, instructions: l.instructions, response_format: 'wav' }),
  });
  if (!r.ok) throw new Error(`tts ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const buf = Buffer.from(await r.arrayBuffer());
  state.vo = { url: await upload(buf, 'movies/voiceover', 'wav', 'audio/wav'), text: l.text, at: Date.now() };
  save();
  console.error(`  ${state.vo.url}`);
}

// ---- phase: stitch ------------------------------------------------------
// Mirrors stitch-local.js's recipe (one canvas, fitSpeed on a morph, centred
// xfade dissolves) and adds the SFX bed: her two files placed by the second,
// mixed with normalize=0 so amix cannot halve the VO under them.
const enc = ['-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p'];
const LB = `scale=${TARGET.width}:${TARGET.height}:force_original_aspect_ratio=decrease,pad=${TARGET.width}:${TARGET.height}:(ow-iw)/2:(oh-ih)/2:color=black`;

async function segFromClip(url, window, tmp, i) {
  const inFile = await fetchToFile(url, path.join(tmp, `clip-${i}.mp4`));
  const mid = path.join(tmp, `mid-${i}.mp4`);
  await run(FFMPEG, ['-y', '-i', inFile, '-vf', `${LB},fps=30,format=yuv420p`, '-an', ...enc, mid]);
  const dur = await probe(mid);
  const out = path.join(tmp, `seg-${i}.mp4`);
  const factor = window / dur;                       // a morph trimmed mid-transformation never completes
  if (factor >= 0.25 && factor <= 4) {
    await run(FFMPEG, ['-y', '-i', mid, '-vf', `setpts=PTS*${factor.toFixed(4)},fps=30,setsar=1`, ...enc, '-an', out]);
  } else {
    await run(FFMPEG, ['-y', '-i', mid, '-t', String(window), '-vf', 'fps=30,setsar=1', ...enc, '-an', out]);
  }
  return out;
}
async function segFromStill(url, window, tmp, i) {
  const img = await fetchToFile(url, path.join(tmp, `panel-${i}.webp`));
  const out = path.join(tmp, `seg-${i}.mp4`);
  await run(FFMPEG, ['-y', '-loop', '1', '-t', String(window), '-i', img, '-vf', `${LB},fps=30,setsar=1`, ...enc, '-an', out]);
  return out;
}

async function stitch(localOut) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vib-clearing-'));
  const plan = [
    ...spec.clips.map(c => ({ kind: 'clip', url: state.clips[c.id].url, window: c.window, title: c.id })),
    { kind: 'still', url: shotUrl(spec.hold.panel), window: spec.hold.window, title: 'end card' },
  ];
  const segs = [];
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    // Each segment carries a dissolve tail so every fade is CENTRED on its beat
    // boundary; the last tail is X/2 so the total still lands on the clock.
    const extra = i + 1 < plan.length ? XFADE : XFADE / 2;
    console.error(`beat ${i + 1}/${plan.length} "${p.title}" ${p.window}s`);
    segs.push(p.kind === 'clip'
      ? await segFromClip(p.url, p.window + extra, tmp, i)
      : await segFromStill(p.url, p.window + extra, tmp, i));
  }

  console.error('joining…');
  const silent = path.join(tmp, 'silent.mp4');
  const inputs = segs.flatMap(f => ['-i', f]);
  let cum = 0; const parts = [];
  for (let k = 1; k < segs.length; k++) {
    cum += plan[k - 1].window;
    const src = k === 1 ? '[0:v]' : `[x${k - 1}]`;
    const label = k === segs.length - 1 ? '[vout]' : `[x${k}]`;
    parts.push(`${src}[${k}:v]xfade=transition=fade:duration=${XFADE}:offset=${(cum - XFADE / 2).toFixed(3)}${label}`);
  }
  await run(FFMPEG, ['-y', ...inputs, '-filter_complex', parts.join(';'), '-map', '[vout]', ...enc, '-an', '-movflags', '+faststart', silent], 1800000);
  const total = await probe(silent);

  console.error('audio bed…');
  const voFile = await fetchToFile(state.vo.url, path.join(tmp, 'vo.wav'));
  const tracks = [{ file: voFile, at: spec.voice.line.at, gainDb: spec.voice.line.gainDb || 0 }];
  for (const s of spec.sfx) {
    const f = path.join(SFX_DIR, s.file);
    if (!fs.existsSync(f)) throw new Error(`sfx missing: ${f}`);
    tracks.push({ file: f, at: s.at, gainDb: s.gainDb });
  }
  const aInputs = tracks.flatMap(t => ['-i', t.file]);
  const chain = tracks.map((t, i) =>
    `[${i}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,` +
    `volume=${t.gainDb}dB,adelay=${Math.round(t.at * 1000)}|${Math.round(t.at * 1000)}[a${i}]`);
  // apad, then -t: the sparkle's tail is the longest input and still ends
  // ~1.8s before the picture does, and `-t` alone TRUNCATES where it cannot
  // extend — which left the track shorter than the video and the title card
  // sitting on no audio stream at all.
  const mixed = path.join(tmp, 'bed.wav');
  await run(FFMPEG, ['-y', ...aInputs, '-filter_complex',
    `${chain.join(';')};${tracks.map((_, i) => `[a${i}]`).join('')}` +
    `amix=inputs=${tracks.length}:normalize=0:duration=longest,alimiter=limit=0.94,apad[aout]`,
    '-map', '[aout]', '-t', String(total), mixed]);
  const { stderr: lvl } = await run(FFMPEG, ['-hide_banner', '-i', mixed, '-af', 'volumedetect', '-f', 'null', '-']);
  console.error('  bed ' + (String(lvl).match(/(mean|max)_volume: [-\d.]+ dB/g) || []).join(' / '));

  console.error('muxing…');
  const outFile = path.join(tmp, 'segment.mp4');
  await run(FFMPEG, ['-y', '-i', silent, '-i', mixed, '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', outFile]);
  const duration = await probe(outFile);

  console.error('uploading…');
  const url = await upload(fs.readFileSync(outFile), 'vibrilify/segments', 'mp4', 'video/mp4');
  state.film = { url, duration: +duration.toFixed(2), beats: plan.map(p => p.title), at: Date.now() };
  save();
  if (localOut) fs.copyFileSync(outFile, localOut);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(JSON.stringify({ url, duration: +duration.toFixed(2) }));
}

(async () => {
  const only = process.argv.includes('--phase') ? process.argv[process.argv.indexOf('--phase') + 1] : null;
  const localOut = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
  if (!only || only === 'shoot') await shoot();
  if (!only || only === 'clips') await clips();
  if (!only || only === 'vo') await vo();
  if (!only || only === 'stitch') await stitch(localOut);
})().catch(e => { console.error(e.message); process.exit(1); });
