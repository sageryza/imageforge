// movies.js — the Movie medium: type a story, get a finished movie.
//
// The pipeline (validated end-to-end in the July 2026 prototyping run):
//   1. GPT breaks the story into ~8-12 SELF-CONTAINED scenes (nothing implied
//      between scenes — the video model can't infer missing beats), deliberately
//      creating before/after panel PAIRS for key actions and carrying character
//      continuity tokens in every scene.
//   2. gpt-image-2 renders each scene panel (low/medium first as a cheap
//      storyboard; keepers re-render HIGH).
//   3. Replicate image-to-video per scene: wan-2.2-i2v-fast (draft tier,
//      ~$0.06/clip) or kling-v2.1 (quality tier). For same-shot panel pairs the
//      NEXT panel is passed as `last_image` so the model animates BETWEEN the
//      actual drawings — far stronger than prompt-only continuity.
//   4. "Dream mode": bridge clips over every hard cut — start = previous clip's
//      last frame, end = next scene's panel, prompt = one continuous PHYSICAL
//      action connecting them (num_frames 121, or the model lingers then leaps).
//   5. ffmpeg edits (trim / speed / freeze / fade — free, no regeneration) and
//      stitches everything into the movie.
//
// Self-contained module in the pipeline.js pattern: a router (mounted at
// /api/movies by server.js) + exported helpers. Per-movie state (story, scenes,
// prompts, panel/clip URLs, edit list) lives in Firestore so a movie can be
// reopened and re-edited later; falls back to an in-memory map without Firebase
// (local dev — state then dies with the process).
//
// The iOS app is the frontend for this medium — there is no public/movies.html.

const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const FormData = require('form-data');
const admin = require('firebase-admin');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';
// Same access gate as the POD pipeline: when set, everything but GET /status
// requires the x-studio-token header. Generation costs real money.
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';

// ffmpeg / ffprobe: static binaries from npm so Render's stock Node image can
// stitch video, with a fall-back to system binaries (FFMPEG_PATH/FFPROBE_PATH
// env vars or anything on PATH). Defensive — without them generation still
// works, only editing/stitching/bridges are unavailable (status reports it).
function tryRequire(name) {
  try { return require(name); } catch (err) {
    console.warn(`movies: ${name} unavailable —`, err.message);
    return null;
  }
}
function firstOnPath(bin) {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const p = path.join(dir, bin);
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { /* keep looking */ }
  }
  return null;
}
const FFMPEG = process.env.FFMPEG_PATH || tryRequire('ffmpeg-static') || firstOnPath('ffmpeg');
const FFPROBE = process.env.FFPROBE_PATH || (tryRequire('ffprobe-static') || {}).path || firstOnPath('ffprobe');

// ─── Video models (versions validated live) ─────────────────────────
const VIDEO_MODELS = {
  draft: {
    name: 'wan-2.2-i2v-fast',
    version: '4eaf2b01d3bf70d8a2e00b219efeb7cb415855ad18b7dacdc4cae664a73a6eea',
    fps: 16, // interpolate_output:true → delivered at 30fps
    costPerClip: f => (f > 81 ? 0.08 : 0.06),
  },
  standard: {
    name: 'kling-v2.1 (720p)',
    version: 'daad218feb714b03e2a1ac445986aebb9d05243cd00da2af17be2e4049f48f69',
    costPerClip: d => (d >= 10 ? 0.50 : 0.25),
  },
  pro: {
    name: 'kling-v2.1 pro (1080p)',
    version: 'daad218feb714b03e2a1ac445986aebb9d05243cd00da2af17be2e4049f48f69',
    costPerClip: d => (d >= 10 ? 1.10 : 0.55),
  },
};

// Rough per-panel costs (gpt-image-2, 1024x1536) so the app can show chips.
const PANEL_COST = { low: 0.02, medium: 0.06, high: 0.25 };

// ─── Style reference image ──────────────────────────────────────────
// Sophie's hand-drawn diary-comic page (refs/movie-style.jpg — outside
// /public so it's never web-served). When present, EVERY panel renders
// through gpt-image-2's edits endpoint with this image attached as a pure
// STYLE reference — matched for medium/linework/palette, never content.
// Same trick that anchors the zine's look. Disable with MOVIE_STYLE_REF=0.
let styleRef = null;
try {
  if (process.env.MOVIE_STYLE_REF !== '0') {
    styleRef = fs.readFileSync(path.join(__dirname, 'refs', 'movie-style.jpg'));
    console.log('movies: style reference loaded (', styleRef.length, 'bytes )');
  }
} catch {
  console.warn('movies: no refs/movie-style.jpg — panels use the text style lock only');
}

// A/B-tested against a trait-naming version: letting the model read the style
// off the image itself copies the ink texture more faithfully, but without
// the format guard it also copies the reference's SHAPE (caption boxes, the
// 4-panel grid). Hence: generic styling copy + explicit single-frame guard.
const STYLE_REF_PREFIX =
  'Copy the styling of the attached image exactly, but do NOT copy its ' +
  'content or subjects. One single full-frame scene, no panel grid, no ' +
  'caption box: ';

// Style lock that held the illustration style verbatim in the validated run.
const DEFAULT_MOTION_STYLE =
  'Hand-drawn ink and watercolor illustration, subtle limited animation on ' +
  'textured paper. Camera completely static. Gentle storybook motion. The ' +
  'illustration style, linework and colors are preserved exactly.';
const DEFAULT_NEGATIVE = 'photorealistic, 3d render, blurry, distorted face';
const DEFAULT_IMAGE_STYLE =
  'Hand-drawn ink and watercolor illustration on textured paper, storybook ' +
  'panel, muted palette, clean composition.';
const STATIC_TEXT_SUFFIX =
  ' Any text in the illustration stays perfectly static and legible.';

// ─── Storage: Firestore doc per movie (or in-memory fallback) ───────
const COLLECTION = process.env.MOVIES_COLLECTION || 'forge-movies';
const memStore = new Map(); // dev fallback when Firebase isn't initialized

function firestore() {
  return admin.apps.length ? admin.firestore() : null;
}

// Firestore rejects `undefined` anywhere in a document — round-trip through
// JSON to strip them (also guarantees the doc is plain data).
function plain(obj) { return JSON.parse(JSON.stringify(obj)); }

async function saveMovie(movie) {
  movie.updatedAt = new Date().toISOString();
  const db = firestore();
  if (db) await db.collection(COLLECTION).doc(movie.id).set(plain(movie));
  else memStore.set(movie.id, plain(movie));
  return movie;
}

async function loadMovie(id) {
  const db = firestore();
  if (db) {
    const snap = await db.collection(COLLECTION).doc(id).get();
    return snap.exists ? snap.data() : null;
  }
  return memStore.get(id) || null;
}

async function listMovies() {
  const db = firestore();
  let all;
  if (db) {
    const snap = await db.collection(COLLECTION).orderBy('updatedAt', 'desc').limit(100).get();
    all = snap.docs.map(d => d.data());
  } else {
    all = [...memStore.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }
  // Summaries only — the list stays light for the phone.
  return all.map(m => ({
    id: m.id, title: m.title, createdAt: m.createdAt, updatedAt: m.updatedAt,
    sceneCount: (m.scenes || []).length,
    poster: (m.scenes || []).map(s => s.panel && s.panel.url).find(Boolean) || null,
    movieUrl: m.movieUrl || null,
    spend: m.spend || 0,
    job: m.job || null,
  }));
}

async function deleteMovie(id) {
  const db = firestore();
  if (db) await db.collection(COLLECTION).doc(id).delete();
  else memStore.delete(id);
}

// Quick animations (one image → one clip, no movie) get their own collection.
const QUICK_COLLECTION = process.env.QUICK_COLLECTION || 'forge-quick';
const memQuick = new Map();

async function saveQuick(doc) {
  doc.updatedAt = new Date().toISOString();
  const db = firestore();
  if (db) await db.collection(QUICK_COLLECTION).doc(doc.id).set(plain(doc));
  else memQuick.set(doc.id, plain(doc));
  return doc;
}

async function loadQuick(id) {
  const db = firestore();
  if (db) {
    const snap = await db.collection(QUICK_COLLECTION).doc(id).get();
    return snap.exists ? snap.data() : null;
  }
  return memQuick.get(id) || null;
}

async function listQuick() {
  const db = firestore();
  if (db) {
    const snap = await db.collection(QUICK_COLLECTION).orderBy('createdAt', 'desc').limit(40).get();
    return snap.docs.map(d => d.data());
  }
  return [...memQuick.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

async function deleteQuick(id) {
  const db = firestore();
  if (db) await db.collection(QUICK_COLLECTION).doc(id).delete();
  else memQuick.delete(id);
}

// ─── Firebase Storage upload (permanent URLs) ───────────────────────
// Replicate/OpenAI URLs expire (~1hr) — everything the movie keeps must go to
// Firebase Storage. Mirrors server.js's saveToFirebase, kept local so the
// module stays self-contained. Without Firebase, temp URLs pass through
// (fine for local dev, not for reopening a movie tomorrow).
function bucket() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}

async function saveBufferToStorage(buffer, contentType, folder) {
  const b = bucket();
  const ext = contentType.includes('webp') ? 'webp'
    : contentType.includes('png') ? 'png'
    : contentType.includes('jpeg') ? 'jpg'
    : contentType.includes('mp4') ? 'mp4' : 'bin';
  if (!b) return `data:${contentType};base64,${buffer.toString('base64')}`;
  const filename = `${folder}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const file = b.file(filename);
  await file.save(buffer, { metadata: { contentType } });
  await file.makePublic();
  return `https://storage.googleapis.com/${b.name}/${filename}`;
}

// Download with retries + size verification — replicate.delivery truncated
// files under parallel load in the validated run; the prediction output stays
// available, so re-fetching always recovers.
async function fetchBuffer(url, retries = 5) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow', timeout: 120000 });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const buf = await res.buffer();
      const expected = Number(res.headers.get('content-length') || 0);
      if (expected && buf.length !== expected) throw new Error(`truncated download (${buf.length}/${expected})`);
      if (!buf.length) throw new Error('empty download');
      return { buffer: buf, contentType: res.headers.get('content-type') || 'application/octet-stream' };
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function saveUrlToStorage(url, folder, fallbackType) {
  const { buffer, contentType } = await fetchBuffer(url);
  const type = contentType.startsWith('application/octet') && fallbackType ? fallbackType : contentType;
  return saveBufferToStorage(buffer, type, folder);
}

// ─── OpenAI helpers ─────────────────────────────────────────────────
async function openaiChatJSON(messages, { temperature = 0.8, retries = 2 } = {}) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'Connection': 'close',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          response_format: { type: 'json_object' },
          temperature,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return JSON.parse(data.choices?.[0]?.message?.content || '{}');
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// Panel render — gpt-image-2 portrait, timeout scaled by quality (high takes
// minutes at OpenAI's end; see server.js's OPENAI_IMAGE_TIMEOUTS).
const IMAGE_TIMEOUTS = { low: 90000, medium: 150000, high: 420000 };
async function openaiPanel(prompt, quality = 'medium', retries = 2) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json', 'Connection': 'close' },
        body: JSON.stringify({
          model: 'gpt-image-2', prompt, n: 1,
          size: '1024x1536', quality, output_format: 'webp',
        }),
        timeout: IMAGE_TIMEOUTS[quality] || 150000,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error('gpt-image-2 returned no image');
      return Buffer.from(b64, 'base64');
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// Panel render through the EDITS endpoint with the style reference attached
// (multipart). Mirrors openaiPanel's retry/timeout behavior; edits are slower
// than generations so the cap only ever goes up.
async function openaiPanelEdit(prompt, refBuffer, quality = 'medium', retries = 2) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const timeout = Math.max(150000, IMAGE_TIMEOUTS[quality] || 0);
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const form = new FormData();
      form.append('model', 'gpt-image-2');
      form.append('prompt', prompt);
      form.append('image', refBuffer, { filename: 'style.jpg', contentType: 'image/jpeg' });
      form.append('size', '1024x1536');
      form.append('quality', quality);
      form.append('output_format', 'webp');
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders() },
        body: form,
        timeout,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error('gpt-image-2 edit returned no image');
      return Buffer.from(b64, 'base64');
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// ─── Replicate: create + poll, with 429 backoff ─────────────────────
// A 6-parallel burst produced one HTTP 429 on create in the validated run —
// exponential backoff on create is required, not optional.
async function replicatePredict(version, input, { pollMs = 5000, maxPolls = 180 } = {}) {
  if (!REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN not set');
  let prediction;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, input }),
    });
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt) + Math.random() * 1000));
      continue;
    }
    prediction = await res.json();
    break;
  }
  if (!prediction) throw new Error('Replicate rate-limited after retries');
  if (prediction.error) throw new Error(typeof prediction.error === 'string' ? prediction.error : JSON.stringify(prediction.error));
  if (!prediction.urls?.get) throw new Error(prediction.detail || 'Replicate did not return a polling URL');
  let polls = 0;
  while (!['succeeded', 'failed', 'canceled'].includes(prediction.status) && polls < maxPolls) {
    await new Promise(r => setTimeout(r, pollMs));
    prediction = await (await fetch(prediction.urls.get, {
      headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
    })).json();
    polls++;
  }
  if (prediction.status !== 'succeeded') {
    throw new Error(`prediction ${prediction.status}: ${prediction.error || 'timed out'}`);
  }
  return prediction;
}

// Small concurrency pool — parallel predictions are fine (11 at once ran
// clean), but panels hit OpenAI's per-minute limits, so each caller picks
// its own width.
async function pool(items, width, worker) {
  const queue = [...items.entries()];
  const results = new Array(items.length);
  async function lane() {
    while (queue.length) {
      const [i, item] = queue.shift();
      results[i] = await worker(item, i).then(v => ({ ok: true, value: v })).catch(e => ({ ok: false, error: e.message }));
    }
  }
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, lane));
  return results;
}

// ─── ffmpeg helpers ─────────────────────────────────────────────────
function run(bin, args, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${path.basename(bin)} failed: ${(stderr || err.message).slice(-400)}`));
      else resolve({ stdout, stderr });
    });
  });
}

async function probe(file) {
  if (!FFPROBE) throw new Error('ffprobe unavailable');
  const { stdout } = await run(FFPROBE, [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration',
    '-of', 'json', file,
  ]);
  const info = JSON.parse(stdout);
  return {
    width: info.streams?.[0]?.width || 0,
    height: info.streams?.[0]?.height || 0,
    duration: parseFloat(info.format?.duration || '0'),
  };
}

// Extract the final frame of a clip (the last-frame chaining trick) → PNG file.
async function extractLastFrame(clipFile, outFile) {
  if (!FFMPEG) throw new Error('ffmpeg unavailable');
  await run(FFMPEG, ['-y', '-sseof', '-0.1', '-i', clipFile, '-frames:v', '1', outFile]);
  return outFile;
}

// Apply a scene's edit list and normalize to the target frame size / 30fps /
// yuv420p so the concat demuxer can join everything losslessly afterwards.
// All edits are ffmpeg — free and near-instant, no regeneration.
async function normalizeClip(inFile, outFile, edits = {}, target) {
  if (!FFMPEG) throw new Error('ffmpeg unavailable');
  const args = ['-y'];
  const trimStart = Number(edits.trimStart) || 0;
  const trimEnd = Number(edits.trimEnd) || 0; // seconds from the start; 0 = to the end
  if (trimStart > 0) args.push('-ss', String(trimStart));
  if (trimEnd > trimStart) args.push('-to', String(trimEnd));
  args.push('-i', inFile);

  const speed = Math.min(4, Math.max(0.25, Number(edits.speed) || 1)); // 1 = as generated; 0.8 = dreamy slow-mo
  const filters = [`setpts=PTS/${speed}`];
  const freeze = Math.min(10, Math.max(0, Number(edits.freezeEnd) || 0));
  if (freeze > 0) filters.push(`tpad=stop_mode=clone:stop_duration=${freeze}`);
  filters.push(
    `scale=${target.width}:${target.height}:force_original_aspect_ratio=decrease`,
    `pad=${target.width}:${target.height}:(ow-iw)/2:(oh-ih)/2`,
    'fps=30', 'format=yuv420p'
  );
  const fade = Math.min(5, Math.max(0, Number(edits.fadeOut) || 0));

  if (fade > 0) {
    // Fade needs the post-speed/post-freeze duration — two passes keeps the
    // filter math trivial and clips are tiny (a few MB at 480p).
    const mid = outFile + '.mid.mp4';
    args.push('-vf', filters.join(','), '-an', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', mid);
    await run(FFMPEG, args);
    const { duration } = await probe(mid);
    const start = Math.max(0, duration - fade);
    await run(FFMPEG, ['-y', '-i', mid, '-vf', `fade=t=out:st=${start}:d=${fade}`, '-an', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', outFile]);
    fs.unlinkSync(mid);
  } else {
    args.push('-vf', filters.join(','), '-an', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', outFile);
    await run(FFMPEG, args);
  }
  return outFile;
}

async function concatClips(files, outFile) {
  if (!FFMPEG) throw new Error('ffmpeg unavailable');
  const listFile = outFile + '.txt';
  fs.writeFileSync(listFile, files.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
  // Every input was just re-encoded to identical codec/size/fps, so stream
  // copy is safe and instant.
  await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', outFile]);
  fs.unlinkSync(listFile);
  return outFile;
}

// ─── Scene breakdown ────────────────────────────────────────────────
// The heart of the medium. CRITICAL RULE from the prototyping run: every scene
// description must be SELF-CONTAINED and continuity-complete — the video
// generator can't infer beats between scenes. The breakdown also deliberately
// creates before/after panel pairs (same shot, small state change) that become
// seamless `last_image` joins, and repeats character continuity tokens in
// every single prompt so panels and clips stay consistent.
async function breakdownStory(story, sceneCount) {
  const target = sceneCount ? `exactly ${sceneCount}` : 'between 8 and 12';
  const sys = `You are a storyboard artist breaking a story into scenes for an illustrated animated short film. Return STRICT JSON:
{"title": short film title,
 "characters": one compact phrase of visual continuity tokens for the recurring character(s), e.g. "a girl with a black bob haircut and a crystal necklace, wearing a yellow raincoat",
 "scenes": [{"title": 2-5 word scene label,
   "description": what happens in this scene, written SELF-CONTAINED,
   "imagePrompt": a full image-generation prompt for this scene's illustrated panel,
   "motionPrompt": one sentence of the SMALL physical motion happening in the shot (subtle — steam rising, a hand reaching, eyes blinking, rain falling),
   "hasText": true only if the panel should contain written text (a speech bubble, a sign, a screen),
   "pairWithNext": true when this scene and the NEXT are the SAME shot before/after one key action}]}

HARD RULES:
- ${target} scenes.
- EVERY scene description and imagePrompt must be fully self-contained and continuity-complete: name the location, the time of day, and describe every character present with the full continuity tokens. NOTHING may be implied from a previous scene — each prompt renders alone.
- Include the character continuity tokens verbatim in every imagePrompt where that character appears.
- For 2-4 KEY actions, create a before/after pair: two consecutive scenes that are the SAME shot and composition with one small state change (door closed → door open; cup full → cup empty). Mark the FIRST of the pair with "pairWithNext": true. The pair's imagePrompts must describe the identical composition, differing only in the changed detail.
- Location changes between scenes are fine (hard cuts are normal storyboard language).
- imagePrompts describe composition and content only — no style words (the style is applied separately).
- motionPrompt is about MOTION only, one continuous subtle action, never a cut or a camera move.`;
  const out = await openaiChatJSON([
    { role: 'system', content: sys },
    { role: 'user', content: `The story:\n\n${story}` },
  ], { temperature: 0.7 });
  const scenes = (Array.isArray(out.scenes) ? out.scenes : []).map((s, i) => ({
    id: 's' + crypto.randomBytes(4).toString('hex'),
    title: String(s.title || `Scene ${i + 1}`).trim(),
    description: String(s.description || '').trim(),
    imagePrompt: String(s.imagePrompt || s.description || '').trim(),
    motionPrompt: String(s.motionPrompt || 'subtle ambient motion, gentle movement').trim(),
    hasText: Boolean(s.hasText),
    pairWithNext: Boolean(s.pairWithNext),
    panel: null,          // { url, quality, status, error }
    clip: null,           // { url, tier, status, error, frames, cost, promptUsed }
    edits: { enabled: true, trimStart: 0, trimEnd: 0, speed: 1, freezeEnd: 0, fadeOut: 0 },
  }));
  if (!scenes.length) throw new Error('breakdown produced no scenes');
  if (scenes.length) scenes[scenes.length - 1].pairWithNext = false; // can't pair past the end
  return {
    title: String(out.title || 'Untitled film').trim(),
    characters: String(out.characters || '').trim(),
    scenes,
  };
}

// A scene folded into the previous scene's clip (it's the "after" of a
// before/after pair): it has a panel but never its own clip or stitch slot.
function isMerged(movie, idx) {
  return idx > 0 && Boolean(movie.scenes[idx - 1].pairWithNext);
}

// The full motion prompt actually sent to the video model.
function motionPromptFor(movie, scene) {
  const style = (movie.motionStyle || DEFAULT_MOTION_STYLE).trim();
  let p = `${style} ${scene.motionPrompt}`.trim();
  if (scene.hasText) p += STATIC_TEXT_SUFFIX;
  return p;
}

// Every re-roll keeps what it replaces — the raw-generations gallery.
function keepHistory(scene, kind) {
  const current = scene[kind];
  if (!current?.url) return;
  const key = kind + 'History';
  const prior = scene[key] || [];
  if (prior.length && prior[prior.length - 1].url === current.url) return; // failed re-roll retried
  const entry = kind === 'panel'
    ? { url: current.url, quality: current.quality, promptUsed: current.promptUsed }
    : { url: current.url, tier: current.tier, frames: current.frames, cost: current.cost, promptUsed: current.promptUsed };
  scene[key] = [...prior, entry].slice(-12);
}

// ─── Generation steps ───────────────────────────────────────────────
async function renderPanelFor(movie, scene, quality) {
  let prompt, buf;
  if (styleRef) {
    // Style comes from the attached reference image — style only, never content.
    prompt = STYLE_REF_PREFIX + scene.imagePrompt;
    buf = await openaiPanelEdit(prompt, styleRef, quality);
  } else {
    prompt = `${(movie.imageStyle || DEFAULT_IMAGE_STYLE).trim()} ${scene.imagePrompt}`.trim();
    buf = await openaiPanel(prompt, quality);
  }
  const url = await saveBufferToStorage(buf, 'image/webp', 'movies/panels');
  keepHistory(scene, 'panel');
  scene.panel = { url, quality, status: 'done', error: null, promptUsed: prompt };
  movie.spend = +((movie.spend || 0) + (PANEL_COST[quality] || 0.06)).toFixed(2);
}

async function generateClipFor(movie, scene, idx, { tier = 'draft', frames } = {}) {
  if (!scene.panel?.url || scene.panel.url.startsWith('data:')) {
    throw new Error('panel not rendered yet (or not on permanent storage)');
  }
  const prompt = scene.motionPromptOverride || motionPromptFor(movie, scene);
  // Same-shot pair → animate BETWEEN the two drawn panels via last_image.
  const nextPanel = scene.pairWithNext ? movie.scenes[idx + 1]?.panel?.url : null;
  let output, cost, usedFrames = null;

  if (tier === 'draft') {
    const m = VIDEO_MODELS.draft;
    usedFrames = frames === 121 ? 121 : 81; // 81 ≈ 5s, 121 ≈ 7.5s @16fps
    const input = {
      image: scene.panel.url,
      prompt,
      resolution: '480p',
      num_frames: usedFrames,
      frames_per_second: 16,
      interpolate_output: true,
      go_fast: true,
    };
    if (nextPanel && !nextPanel.startsWith('data:')) input.last_image = nextPanel;
    const p = await replicatePredict(m.version, input);
    output = Array.isArray(p.output) ? p.output[0] : p.output;
    cost = m.costPerClip(usedFrames);
  } else {
    const m = VIDEO_MODELS[tier];
    if (!m) throw new Error(`unknown tier "${tier}"`);
    const duration = 5;
    const input = {
      start_image: scene.panel.url,
      prompt,
      negative_prompt: movie.negativePrompt || DEFAULT_NEGATIVE,
      duration,
      mode: tier === 'pro' ? 'pro' : 'standard',
    };
    // end_image conditioning REQUIRES kling pro.
    if (tier === 'pro' && nextPanel && !nextPanel.startsWith('data:')) input.end_image = nextPanel;
    const p = await replicatePredict(m.version, input, { pollMs: 6000, maxPolls: 120 });
    output = Array.isArray(p.output) ? p.output[0] : p.output;
    cost = m.costPerClip(duration);
  }
  if (!output) throw new Error('video model produced no output');
  const url = await saveUrlToStorage(output, 'movies/clips', 'video/mp4');
  keepHistory(scene, 'clip');
  scene.clip = { url, tier, status: 'done', error: null, frames: usedFrames, cost, promptUsed: prompt };
  movie.spend = +((movie.spend || 0) + cost).toFixed(2);
}

// Dream mode: a bridge clip across a hard cut. Start = previous clip's last
// frame, end = next scene's panel, ALWAYS num_frames 121 with a prompt
// describing one continuous PHYSICAL action — short morphs between very
// different compositions read as a jarring leap (rule learned live).
async function writeBridgePrompt(movie, fromScene, toScene) {
  const out = await openaiChatJSON([
    { role: 'system', content:
      'You write the motion prompt for a surreal BRIDGE shot in an illustrated film: one continuous shot that physically transforms scene A\'s final image into scene B\'s image. Describe ONE continuous physical action or camera-less transformation connecting them (e.g. "she carries the milk carton across the room to the kitchen table", "the forest branches bend and melt into kitchen cabinets"). Never describe a cut. One or two sentences, concrete and physical. Return STRICT JSON: {"prompt": "..."}' },
    { role: 'user', content: `Scene A (the shot we leave): ${fromScene.description}\nScene B (the image we must arrive at): ${toScene.description}` },
  ]);
  return String(out.prompt || `the scene slowly transforms into: ${toScene.description}`).trim();
}

async function generateBridge(movie, bridge, tmpDir) {
  const fromScene = movie.scenes.find(s => s.id === bridge.fromSceneId);
  const toScene = movie.scenes.find(s => s.id === bridge.toSceneId);
  if (!fromScene?.clip?.url) throw new Error('previous clip missing');
  if (!toScene?.panel?.url) throw new Error('next panel missing');

  // Last frame of the outgoing clip → permanent URL Replicate can fetch.
  const clipFile = path.join(tmpDir, `${bridge.id}-from.mp4`);
  const { buffer } = await fetchBuffer(fromScene.clip.url);
  fs.writeFileSync(clipFile, buffer);
  const frameFile = path.join(tmpDir, `${bridge.id}-frame.png`);
  await extractLastFrame(clipFile, frameFile);
  const frameUrl = await saveBufferToStorage(fs.readFileSync(frameFile), 'image/png', 'movies/frames');
  if (frameUrl.startsWith('data:')) throw new Error('bridges need Firebase Storage (permanent frame URLs)');

  const style = (movie.motionStyle || DEFAULT_MOTION_STYLE).trim();
  const prompt = `${style} ${bridge.prompt}`.trim();
  const m = VIDEO_MODELS.draft;
  const p = await replicatePredict(m.version, {
    image: frameUrl,
    last_image: toScene.panel.url,
    prompt,
    resolution: '480p',
    num_frames: 121,
    frames_per_second: 16,
    interpolate_output: true,
    go_fast: true,
  });
  const output = Array.isArray(p.output) ? p.output[0] : p.output;
  if (!output) throw new Error('bridge produced no output');
  const url = await saveUrlToStorage(output, 'movies/clips', 'video/mp4');
  const cost = m.costPerClip(121);
  bridge.clip = { url, status: 'done', error: null, cost, promptUsed: prompt };
  movie.spend = +((movie.spend || 0) + cost).toFixed(2);
}

// The ordered list of clips that make the movie: enabled scenes (skipping
// merged pair-partners), with dream bridges interleaved when dreamMode is on.
function movieSequence(movie) {
  const seq = [];
  movie.scenes.forEach((scene, idx) => {
    if (isMerged(movie, idx)) return;
    if (scene.edits?.enabled === false) return;
    if (!scene.clip?.url) return;
    if (movie.dreamMode && seq.length) {
      const prev = seq[seq.length - 1];
      const bridge = (movie.bridges || []).find(b =>
        b.fromSceneId === prev.scene.id && b.toSceneId === scene.id && b.clip?.url);
      if (bridge) seq.push({ bridge });
    }
    seq.push({ scene });
  });
  return seq;
}

async function stitchMovie(movie, progress) {
  const seq = movieSequence(movie);
  if (!seq.length) throw new Error('no clips to stitch — generate clips first');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-movie-'));
  try {
    // Download everything first (with retries), then probe the first clip to
    // pick the target frame size all clips normalize to.
    const files = [];
    for (let i = 0; i < seq.length; i++) {
      const item = seq[i];
      const url = item.scene ? item.scene.clip.url : item.bridge.clip.url;
      const file = path.join(tmpDir, `in-${i}.mp4`);
      const { buffer } = await fetchBuffer(url);
      fs.writeFileSync(file, buffer);
      files.push(file);
      progress(i + 1, seq.length * 2 + 1, 'downloading clips');
    }
    const first = await probe(files[0]);
    const target = {
      width: (first.width || 560) - ((first.width || 560) % 2),
      height: (first.height || 704) - ((first.height || 704) % 2),
    };
    const normalized = [];
    for (let i = 0; i < files.length; i++) {
      const item = seq[i];
      const edits = item.scene ? item.scene.edits : {}; // bridges play as generated
      const out = path.join(tmpDir, `norm-${i}.mp4`);
      await normalizeClip(files[i], out, edits || {}, target);
      normalized.push(out);
      progress(seq.length + i + 1, seq.length * 2 + 1, 'applying edits');
    }
    const outFile = path.join(tmpDir, 'movie.mp4');
    await concatClips(normalized, outFile);
    progress(seq.length * 2 + 1, seq.length * 2 + 1, 'uploading');
    const url = await saveBufferToStorage(fs.readFileSync(outFile), 'video/mp4', 'movies/films');
    const { duration } = await probe(outFile).catch(() => ({ duration: 0 }));
    movie.movieUrl = url;
    movie.movieDuration = Math.round(duration * 10) / 10;
    movie.movieStitchedAt = new Date().toISOString();
    recordCut(movie, seq, url, movie.movieDuration);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── Cuts: every stitch is kept, named by what changed ──────────────
// The gallery shows each finished cut with a contact sheet of the frames it
// contains. The name is generated by diffing the sequence + edit lists
// against the previous cut ("trimmed sc 3, slowed sc 7, +2 bridges").
function cutSignature(movie, seq) {
  return seq.filter(i => i.scene).map(i => ({
    id: i.scene.id,
    clipUrl: i.scene.clip?.url || null,
    tier: i.scene.clip?.tier || null,
    edits: { ...(i.scene.edits || {}) },
  }));
}

function nameCut(movie, sig, bridgeCount) {
  const prev = movie.lastCutSig;
  const prevBridges = movie.lastCutBridges || 0;
  if (!Array.isArray(prev)) return 'first cut';
  const num = id => {
    const i = movie.scenes.findIndex(s => s.id === id);
    return i >= 0 ? `sc ${i + 1}` : 'a scene';
  };
  const changes = [];
  const prevById = new Map(prev.map(s => [s.id, s]));
  const currById = new Map(sig.map(s => [s.id, s]));
  for (const s of sig) {
    const p = prevById.get(s.id);
    if (!p) { changes.push(`restored ${num(s.id)}`); continue; }
    if (p.clipUrl !== s.clipUrl) {
      changes.push(p.tier !== s.tier ? `upgraded ${num(s.id)}` : `re-rolled ${num(s.id)}`);
    }
    const pe = p.edits || {}, ce = s.edits || {};
    if ((pe.trimStart || 0) !== (ce.trimStart || 0) || (pe.trimEnd || 0) !== (ce.trimEnd || 0)) changes.push(`trimmed ${num(s.id)}`);
    if ((pe.speed || 1) !== (ce.speed || 1)) changes.push(`${(ce.speed || 1) < (pe.speed || 1) ? 'slowed' : 'sped up'} ${num(s.id)}`);
    if ((pe.freezeEnd || 0) !== (ce.freezeEnd || 0)) changes.push(`froze ${num(s.id)}`);
    if ((pe.fadeOut || 0) !== (ce.fadeOut || 0)) changes.push(`fade on ${num(s.id)}`);
  }
  for (const p of prev) if (!currById.has(p.id)) changes.push(`dropped ${num(p.id)}`);
  const prevOrder = prev.filter(s => currById.has(s.id)).map(s => s.id).join(',');
  const currOrder = sig.filter(s => prevById.has(s.id)).map(s => s.id).join(',');
  if (prevOrder !== currOrder) changes.push('reordered');
  if (bridgeCount !== prevBridges) {
    changes.push(bridgeCount > prevBridges ? `+${bridgeCount - prevBridges} dream bridges` : 'bridges removed');
  }
  if (!changes.length) return 're-stitch, no changes';
  const shown = changes.slice(0, 3).join(', ');
  return changes.length > 3 ? `${shown} +${changes.length - 3} more` : shown;
}

function recordCut(movie, seq, url, duration) {
  const sig = cutSignature(movie, seq);
  const bridgeCount = seq.filter(i => i.bridge).length;
  const frames = seq.map(item => {
    if (item.scene) {
      return { sceneId: item.scene.id, title: item.scene.title, panelUrl: item.scene.panel?.url || null, bridge: false };
    }
    const to = movie.scenes.find(s => s.id === item.bridge.toSceneId);
    return { sceneId: item.bridge.toSceneId, title: 'dream bridge', panelUrl: to?.panel?.url || null, bridge: true };
  });
  const cut = {
    id: 'c' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex'),
    url, duration,
    name: nameCut(movie, sig, bridgeCount),
    stitchedAt: new Date().toISOString(),
    frames,
  };
  movie.cuts = [...(movie.cuts || []), cut].slice(-20);
  movie.lastCutSig = sig;
  movie.lastCutBridges = bridgeCount;
}

// ─── Background jobs ────────────────────────────────────────────────
// One job at a time per movie, recorded IN the movie doc — the app just polls
// GET /:id and the whole film strip (statuses, URLs, progress) stays current.
async function startJob(movie, kind, fn) {
  if (movie.job && movie.job.status === 'running') {
    // A Render restart can strand a job as "running" — treat stale as dead.
    const age = Date.now() - new Date(movie.job.startedAt || 0).getTime();
    if (age < 15 * 60 * 1000) throw new Error(`a "${movie.job.kind}" job is already running`);
  }
  movie.job = { kind, status: 'running', done: 0, total: 0, label: 'starting', error: null, startedAt: new Date().toISOString() };
  await saveMovie(movie);

  (async () => {
    let lastSave = 0;
    const progress = async (done, total, label) => {
      movie.job = { ...movie.job, done, total, label };
      if (Date.now() - lastSave > 1500) { lastSave = Date.now(); await saveMovie(movie).catch(() => {}); }
    };
    try {
      await fn(progress);
      movie.job = { ...movie.job, status: 'done', label: 'done' };
    } catch (err) {
      console.warn(`movies: job ${kind} failed —`, err.message);
      movie.job = { ...movie.job, status: 'error', error: err.message };
    }
    await saveMovie(movie).catch(e => console.warn('movies: save failed —', e.message));
  })();
}

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();
router.use(express.json({ limit: '10mb' }));

router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    openai: Boolean(OPENAI_API_KEY),
    replicate: Boolean(REPLICATE_API_TOKEN),
    firebase: Boolean(firestore()),
    ffmpeg: Boolean(FFMPEG && FFPROBE),
    styleReference: Boolean(styleRef),
    gated: Boolean(STUDIO_TOKEN),
    models: {
      draft: VIDEO_MODELS.draft.name,
      standard: VIDEO_MODELS.standard.name,
      pro: VIDEO_MODELS.pro.name,
    },
    costs: { panel: PANEL_COST, clip: { draft: 0.06, draftLong: 0.08, standard: 0.25, pro: 0.55, bridge: 0.08 } },
  });
});

router.get('/', async (req, res) => {
  try { res.json({ movies: await listMovies() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Create a movie: story → scene breakdown. Synchronous (one chat call).
router.post('/', async (req, res) => {
  try {
    const { story, title, sceneCount } = req.body || {};
    if (!story || !String(story).trim()) return res.status(400).json({ error: 'story is required' });
    const n = sceneCount ? Math.min(16, Math.max(2, parseInt(sceneCount, 10) || 0)) : null;
    const plan = await breakdownStory(String(story).trim(), n);
    const movie = {
      id: 'm' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
      title: (title && String(title).trim()) || plan.title,
      story: String(story).trim(),
      characters: plan.characters,
      imageStyle: DEFAULT_IMAGE_STYLE,
      motionStyle: DEFAULT_MOTION_STYLE,
      negativePrompt: DEFAULT_NEGATIVE,
      dreamMode: false,
      scenes: plan.scenes,
      bridges: [],
      cuts: [],
      job: null,
      movieUrl: null,
      movieDuration: 0,
      spend: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveMovie(movie);
    res.json(movie);
  } catch (err) {
    res.status(err.message.includes('required') ? 400 : 502).json({ error: err.message });
  }
});

// ─── Quick animate: one image in, one clip out (no movie) ───────────
// Home-screen "animate" button: upload a picture (drawing, photo, panel),
// wan-2.2 animates it at 720p by default. Runs as its own polled doc.
// NOTE: registered before '/:id' so the path wins the route match.
router.post('/animate', async (req, res) => {
  try {
    const { image, prompt = '', resolution = '720p', frames } = req.body || {};
    if (!image || !/^data:image\//.test(image)) return res.status(400).json({ error: 'image (data URL) required' });
    if (!REPLICATE_API_TOKEN) return res.status(400).json({ error: 'REPLICATE_API_TOKEN not set' });
    const m = /^data:([^;]+);base64,(.*)$/.exec(image);
    if (!m) return res.status(400).json({ error: 'bad image data URL' });
    const imageUrl = await saveBufferToStorage(Buffer.from(m[2], 'base64'), m[1], 'movies/quick');
    if (imageUrl.startsWith('data:')) return res.status(400).json({ error: 'quick animate needs Firebase Storage (public image URLs)' });

    const res720 = resolution === '480p' ? '480p' : '720p';
    const numFrames = frames === 121 ? 121 : 81;
    const cost = res720 === '720p' ? (numFrames > 81 ? 0.24 : 0.16) : (numFrames > 81 ? 0.08 : 0.06);
    const quick = {
      id: 'q' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
      status: 'running', error: null,
      prompt: String(prompt).trim(),
      imageUrl, clipUrl: null,
      resolution: res720, frames: numFrames, cost,
      createdAt: new Date().toISOString(),
    };
    await saveQuick(quick);
    res.json(quick);

    (async () => {
      try {
        const fullPrompt = (quick.prompt || 'subtle natural motion, gentle ambient movement') +
          '. The subject, style and composition of the image are preserved exactly.';
        const p = await replicatePredict(VIDEO_MODELS.draft.version, {
          image: imageUrl,
          prompt: fullPrompt,
          resolution: res720,
          num_frames: numFrames,
          frames_per_second: 16,
          interpolate_output: true,
          go_fast: true,
        });
        const output = Array.isArray(p.output) ? p.output[0] : p.output;
        if (!output) throw new Error('video model produced no output');
        quick.clipUrl = await saveUrlToStorage(output, 'movies/quick', 'video/mp4');
        quick.status = 'done';
      } catch (err) {
        quick.status = 'error';
        quick.error = err.message;
      }
      await saveQuick(quick).catch(e => console.warn('movies: quick save failed —', e.message));
    })();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/quick', async (req, res) => {
  try { res.json({ clips: await listQuick() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/quick/:id', async (req, res) => {
  try {
    const quick = await loadQuick(req.params.id);
    if (!quick) return res.status(404).json({ error: 'not found' });
    res.json(quick);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/quick/:id', async (req, res) => {
  try { await deleteQuick(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    res.json(movie);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await deleteMovie(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Edit movie / scenes: title, styles, dream mode, scene order, per-scene
// prompt overrides and the ffmpeg edit list. This is the zoom-in surface —
// everything the app's micro-controls touch lands here.
router.patch('/:id', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    const b = req.body || {};
    for (const key of ['title', 'imageStyle', 'motionStyle', 'negativePrompt', 'characters']) {
      if (typeof b[key] === 'string') movie[key] = b[key].trim();
    }
    if (typeof b.dreamMode === 'boolean') movie.dreamMode = b.dreamMode;
    if (Array.isArray(b.order)) {
      const byId = new Map(movie.scenes.map(s => [s.id, s]));
      const reordered = b.order.map(id => byId.get(id)).filter(Boolean);
      if (reordered.length === movie.scenes.length) movie.scenes = reordered;
    }
    for (const patch of (Array.isArray(b.scenes) ? b.scenes : [])) {
      const scene = movie.scenes.find(s => s.id === patch.id);
      if (!scene) continue;
      for (const key of ['title', 'description', 'imagePrompt', 'motionPrompt', 'motionPromptOverride']) {
        if (typeof patch[key] === 'string') scene[key] = patch[key];
      }
      if (patch.motionPromptOverride === null) delete scene.motionPromptOverride;
      if (typeof patch.hasText === 'boolean') scene.hasText = patch.hasText;
      if (typeof patch.pairWithNext === 'boolean') scene.pairWithNext = patch.pairWithNext;
      if (patch.edits && typeof patch.edits === 'object') {
        scene.edits = { ...scene.edits, ...patch.edits };
      }
    }
    await saveMovie(movie);
    res.json(movie);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Render panels — all missing (or the listed / all with force), storyboard
// quality by default. Panels are the cheap approval layer before any video.
router.post('/:id/panels', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    const { quality = 'medium', only, force = false } = req.body || {};
    const q = ['low', 'medium', 'high'].includes(quality) ? quality : 'medium';
    const targets = movie.scenes.filter(s =>
      (Array.isArray(only) && only.length) ? only.includes(s.id) : (force || !s.panel?.url));
    if (!targets.length) return res.status(400).json({ error: 'no panels to render' });
    targets.forEach(s => { s.panel = { ...(s.panel || {}), status: 'running', error: null }; });

    await startJob(movie, 'panels', async (progress) => {
      let done = 0;
      await progress(0, targets.length, 'rendering panels');
      await pool(targets, 3, async (scene) => {
        try { await renderPanelFor(movie, scene, q); }
        catch (err) { scene.panel = { ...(scene.panel || {}), status: 'error', error: err.message }; }
        await progress(++done, targets.length, 'rendering panels');
      });
      const failed = targets.filter(s => s.panel?.status === 'error').length;
      if (failed) throw new Error(`${failed} of ${targets.length} panels failed — re-roll them individually`);
    });
    res.json({ ok: true, rendering: targets.length, movie });
  } catch (err) { res.status(/already running/.test(err.message) ? 409 : 500).json({ error: err.message }); }
});

// Re-roll one panel (optionally with an edited image prompt / higher quality).
router.post('/:id/scenes/:sid/panel', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    const scene = movie.scenes.find(s => s.id === req.params.sid);
    if (!scene) return res.status(404).json({ error: 'scene not found' });
    const { quality = scene.panel?.quality || 'medium', imagePrompt } = req.body || {};
    if (typeof imagePrompt === 'string' && imagePrompt.trim()) scene.imagePrompt = imagePrompt.trim();
    scene.panel = { ...(scene.panel || {}), status: 'running', error: null };
    await startJob(movie, 'panel', async (progress) => {
      await progress(0, 1, `re-rolling "${scene.title}"`);
      try { await renderPanelFor(movie, scene, quality); }
      catch (err) { scene.panel = { ...(scene.panel || {}), status: 'error', error: err.message }; throw err; }
      await progress(1, 1, 'done');
    });
    res.json({ ok: true, movie });
  } catch (err) { res.status(/already running/.test(err.message) ? 409 : 500).json({ error: err.message }); }
});

// Animate — clips for every un-clipped scene (or listed / all with force).
// Draft tier by default; upgrade per-scene later, not all-or-nothing.
router.post('/:id/clips', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    const { tier = 'draft', only, force = false } = req.body || {};
    if (!VIDEO_MODELS[tier]) return res.status(400).json({ error: `unknown tier "${tier}"` });
    const targets = [];
    movie.scenes.forEach((s, idx) => {
      if (isMerged(movie, idx)) return;                 // folded into the previous pair-clip
      if (!s.panel?.url) return;                        // no panel yet
      if (Array.isArray(only) && only.length ? !only.includes(s.id) : (!force && s.clip?.url && s.clip.tier === tier)) return;
      targets.push({ scene: s, idx });
    });
    if (!targets.length) return res.status(400).json({ error: 'no scenes ready to animate' });
    targets.forEach(t => { t.scene.clip = { ...(t.scene.clip || {}), status: 'running', error: null }; });

    await startJob(movie, 'clips', async (progress) => {
      let done = 0;
      await progress(0, targets.length, `animating (${tier})`);
      await pool(targets, 5, async ({ scene, idx }) => {
        try { await generateClipFor(movie, scene, idx, { tier }); }
        catch (err) { scene.clip = { ...(scene.clip || {}), status: 'error', error: err.message }; }
        await progress(++done, targets.length, `animating (${tier})`);
      });
      const failed = targets.filter(t => t.scene.clip?.status === 'error').length;
      if (failed) throw new Error(`${failed} of ${targets.length} clips failed — re-roll them individually`);
    });
    res.json({ ok: true, animating: targets.length, movie });
  } catch (err) { res.status(/already running/.test(err.message) ? 409 : 500).json({ error: err.message }); }
});

// Re-roll / upgrade one scene's clip (optionally with an edited motion prompt,
// a longer draft duration, or a higher tier).
router.post('/:id/scenes/:sid/clip', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    const idx = movie.scenes.findIndex(s => s.id === req.params.sid);
    if (idx < 0) return res.status(404).json({ error: 'scene not found' });
    const scene = movie.scenes[idx];
    if (isMerged(movie, idx)) return res.status(400).json({ error: 'this scene is the second half of a pair — it animates inside the previous scene\'s clip' });
    const { tier = 'draft', frames, motionPrompt } = req.body || {};
    if (!VIDEO_MODELS[tier]) return res.status(400).json({ error: `unknown tier "${tier}"` });
    if (typeof motionPrompt === 'string' && motionPrompt.trim()) scene.motionPromptOverride = motionPrompt.trim();
    scene.clip = { ...(scene.clip || {}), status: 'running', error: null };
    await startJob(movie, 'clip', async (progress) => {
      await progress(0, 1, `animating "${scene.title}" (${tier})`);
      try { await generateClipFor(movie, scene, idx, { tier, frames }); }
      catch (err) { scene.clip = { ...(scene.clip || {}), status: 'error', error: err.message }; throw err; }
      await progress(1, 1, 'done');
    });
    res.json({ ok: true, movie });
  } catch (err) { res.status(/already running/.test(err.message) ? 409 : 500).json({ error: err.message }); }
});

// Dream mode: generate bridge clips for every hard cut in the current
// sequence. Re-runs only fill in bridges that are missing or failed.
router.post('/:id/bridges', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    if (!FFMPEG) return res.status(400).json({ error: 'ffmpeg unavailable on the server' });

    // Adjacent playable scenes (post-merge, enabled, clipped) define the cuts.
    const playable = movie.scenes.filter((s, idx) =>
      !isMerged(movie, idx) && s.edits?.enabled !== false && s.clip?.url);
    if (playable.length < 2) return res.status(400).json({ error: 'need at least two animated scenes' });
    movie.bridges = movie.bridges || [];
    const targets = [];
    for (let i = 0; i < playable.length - 1; i++) {
      const from = playable[i], to = playable[i + 1];
      let bridge = movie.bridges.find(b => b.fromSceneId === from.id && b.toSceneId === to.id);
      if (bridge?.clip?.url) continue;
      if (!bridge) {
        bridge = { id: 'b' + crypto.randomBytes(4).toString('hex'), fromSceneId: from.id, toSceneId: to.id, prompt: '', clip: null };
        movie.bridges.push(bridge);
      }
      bridge.clip = { ...(bridge.clip || {}), status: 'running', error: null };
      targets.push({ bridge, from, to });
    }
    if (!targets.length) return res.status(400).json({ error: 'all bridges already exist' });

    await startJob(movie, 'bridges', async (progress) => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-bridges-'));
      try {
        let done = 0;
        await progress(0, targets.length, 'dreaming bridges');
        await pool(targets, 3, async ({ bridge, from, to }) => {
          try {
            if (!bridge.prompt) bridge.prompt = await writeBridgePrompt(movie, from, to);
            await generateBridge(movie, bridge, tmpDir);
          } catch (err) {
            bridge.clip = { ...(bridge.clip || {}), status: 'error', error: err.message };
          }
          await progress(++done, targets.length, 'dreaming bridges');
        });
        const failed = targets.filter(t => t.bridge.clip?.status === 'error').length;
        if (failed) throw new Error(`${failed} of ${targets.length} bridges failed`);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
    movie.dreamMode = true;
    await saveMovie(movie);
    res.json({ ok: true, bridging: targets.length, movie });
  } catch (err) { res.status(/already running/.test(err.message) ? 409 : 500).json({ error: err.message }); }
});

// Stitch — apply every scene's edit list and join the sequence into the movie.
// Near-instant relative to generation; free to re-run after every tweak.
router.post('/:id/stitch', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    if (!FFMPEG || !FFPROBE) return res.status(400).json({ error: 'ffmpeg unavailable on the server' });
    await startJob(movie, 'stitch', async (progress) => {
      await stitchMovie(movie, (d, t, label) => progress(d, t, label));
    });
    res.json({ ok: true, movie });
  } catch (err) { res.status(/already running/.test(err.message) ? 409 : 500).json({ error: err.message }); }
});

module.exports = {
  router,
  breakdownStory,
  movieSequence,
  motionPromptFor,
  VIDEO_MODELS,
  // building blocks, exported for scripts/tests
  renderPanelFor,
  generateClipFor,
  probe,
  extractLastFrame,
  normalizeClip,
  concatClips,
};
