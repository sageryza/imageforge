// songs.js — the Song medium: a rough phone recording in, a real song out.
//
// The pipeline (keeps Sophie's ACTUAL voice — unlike Suno-style covers that
// replace the singer):
//   1. resemble-enhance (Replicate) denoises + enhances the recording — strips
//      background noise, restores distortion, widens the bandwidth. This is
//      both the "cut the noise" and the "fix the vocals a little" step.
//   2. meta/musicgen (stereo-melody-large) writes an instrumental that FOLLOWS
//      the cleaned vocal's melody (`input_audio` conditioning, continuation
//      off = mimic the melody). MusicGen tops out around 30s per generation,
//      so longer songs are split into ≤30s chunks, generated with one shared
//      seed for cohesion, conformed back to exact chunk length, and joined.
//   3. ffmpeg mixes the cleaned vocal over the instrumental (adjustable gains,
//      loudness-normalized) into the final mp3. Re-mixing is free and instant;
//      re-rolling the instrumental with a new style costs pennies.
//
// Self-contained module in the movies.js pattern: a router (mounted at
// /api/songs by server.js) + exported helpers. Per-song state lives in
// Firestore (`forge-songs`) so songs reopen later; long steps run as
// background jobs recorded in the doc and clients poll GET /:id. Audio is
// saved to Firebase Storage (Replicate URLs expire ~1hr, and Replicate must
// be able to FETCH the uploaded recording, so Firebase is required here).

const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const admin = require('firebase-admin');
const { extractMelodyMidi } = require('./melody');

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';
// Same access gate as the POD pipeline: when set, everything but GET /status
// requires the x-studio-token header. Generation costs real money.
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';

// ffmpeg / ffprobe: static npm binaries with env-var / PATH fallback — the
// same resolution movies.js uses.
function tryRequire(name) {
  try { return require(name); } catch (err) {
    console.warn(`songs: ${name} unavailable —`, err.message);
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

// ─── Audio models (version hashes resolved live, July 2026) ─────────
const AUDIO_MODELS = {
  enhance: {
    name: 'resemble-ai/resemble-enhance',
    version: '93266a7e7f5805fb79bcf213b1a4e0ef2e45aff3c06eefd96c59e850c87fd6a2',
    cost: 0.03, // rough per-run estimate
  },
  instrumental: {
    name: 'meta/musicgen (stereo-melody-large)',
    version: '671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb',
    costPerChunk: 0.11, // rough per-30s-generation estimate
  },
};

// MusicGen was trained on 30-second windows — longer single generations wander
// off the melody. Songs are cut into ≤30s pieces and rejoined.
const CHUNK_SECONDS = 30;
// Cost guard: 4 minutes = 8 chunks ≈ $1 of MusicGen per instrumental pass.
const MAX_SONG_SECONDS = 240;

// NO default musical style (Aug 2026, Sophie — "I don't really want that
// anyway"). This used to be 'gentle acoustic pop, warm fingerpicked guitar and
// soft piano, light brushed drums', which meant every song she didn't type a
// style for came back as that band. A style is a taste decision and belongs to
// whoever is making the song; with none given, MusicGen follows her melody and
// the suffix below is the only thing added.
const DEFAULT_STYLE = '';
// MusicGen happily generates its own "vocals" (wordless ooohs) unless told not
// to — the suffix keeps the backing track purely instrumental.
const STYLE_SUFFIX = ', instrumental backing track, no vocals, no singing';

// ─── Storage: Firestore doc per song (or in-memory fallback) ────────
const COLLECTION = process.env.SONGS_COLLECTION || 'forge-songs';
const memStore = new Map(); // dev fallback when Firebase isn't initialized

function firestore() {
  return admin.apps.length ? admin.firestore() : null;
}

// Firestore rejects `undefined` anywhere in a document — round-trip through
// JSON to strip them (also guarantees the doc is plain data).
function plain(obj) { return JSON.parse(JSON.stringify(obj)); }

async function saveSong(song) {
  song.updatedAt = new Date().toISOString();
  const db = firestore();
  if (db) await db.collection(COLLECTION).doc(song.id).set(plain(song));
  else memStore.set(song.id, plain(song));
  return song;
}

async function loadSong(id) {
  const db = firestore();
  if (db) {
    const snap = await db.collection(COLLECTION).doc(id).get();
    return snap.exists ? snap.data() : null;
  }
  return memStore.get(id) || null;
}

async function listSongs() {
  const db = firestore();
  let all;
  if (db) {
    const snap = await db.collection(COLLECTION).orderBy('updatedAt', 'desc').limit(100).get();
    all = snap.docs.map(d => d.data());
  } else {
    all = [...memStore.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }
  return all.map(s => ({
    id: s.id, title: s.title, createdAt: s.createdAt, updatedAt: s.updatedAt,
    duration: s.duration || 0,
    style: s.style || '',
    mixUrl: s.mix?.url || null,
    spend: s.spend || 0,
    job: s.job || null,
  }));
}

async function deleteSong(id) {
  const db = firestore();
  if (db) await db.collection(COLLECTION).doc(id).delete();
  else memStore.delete(id);
}

// ─── Firebase Storage upload (permanent URLs) ───────────────────────
function bucket() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}

const AUDIO_EXT = {
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav',
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
  'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'm4a',
  'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/flac': 'flac',
  'audio/midi': 'mid',
};

async function saveBufferToStorage(buffer, contentType, folder) {
  const b = bucket();
  const ext = AUDIO_EXT[contentType] || 'bin';
  if (!b) return `data:${contentType};base64,${buffer.toString('base64')}`;
  const filename = `${folder}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const file = b.file(filename);
  await file.save(buffer, { metadata: { contentType } });
  await file.makePublic();
  return `https://storage.googleapis.com/${b.name}/${filename}`;
}

// Download with retries + size verification (replicate.delivery truncates
// under parallel load — same defence movies.js carries).
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

// ─── Replicate: create + poll, with 429 backoff ─────────────────────
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

// Small concurrency pool (movies.js pattern) — MusicGen chunks run 3 abreast.
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

async function probeDuration(file) {
  if (!FFPROBE) throw new Error('ffprobe unavailable');
  const { stdout } = await run(FFPROBE, [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file,
  ]);
  return parseFloat(JSON.parse(stdout).format?.duration || '0');
}

// Whatever the phone hands us (m4a voice memo, webm browser recording, mp3),
// normalize to mono 44.1k 16-bit WAV — the format every downstream step
// (enhance, MusicGen conditioning, mixing) is happiest with.
async function toWav(inFile, outFile) {
  if (!FFMPEG) throw new Error('ffmpeg unavailable');
  await run(FFMPEG, ['-y', '-i', inFile, '-vn', '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', outFile]);
  return outFile;
}

// Cut one melody chunk out of the vocal WAV.
async function cutChunk(inFile, outFile, start, length) {
  await run(FFMPEG, ['-y', '-ss', String(start), '-t', String(length), '-i', inFile, '-c:a', 'pcm_s16le', outFile]);
  return outFile;
}

// MusicGen's output length only approximates the requested duration — pad then
// hard-trim each instrumental piece to EXACTLY its vocal chunk's length so the
// joined track never drifts out of sync with the voice.
async function conformChunk(inFile, outFile, length) {
  await run(FFMPEG, ['-y', '-i', inFile, '-af', 'apad', '-t', String(length), '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', outFile]);
  return outFile;
}

async function concatAudio(files, outFile) {
  if (files.length === 1) { fs.copyFileSync(files[0], outFile); return outFile; }
  const inputs = files.flatMap(f => ['-i', f]);
  const labels = files.map((_, i) => `[${i}:a]`).join('');
  await run(FFMPEG, ['-y', ...inputs, '-filter_complex', `${labels}concat=n=${files.length}:v=0:a=1[out]`, '-map', '[out]', '-c:a', 'pcm_s16le', outFile]);
  return outFile;
}

// The mixdown: vocal over instrumental at adjustable gains, loudness-normalized
// to streaming level, out as mp3. Free and near-instant — remix all day.
async function mixdown(vocalFile, instrumentalFile, outFile, { vocalGain = 1, instrumentalGain = 0.5 } = {}) {
  if (!FFMPEG) throw new Error('ffmpeg unavailable');
  const vg = Math.min(3, Math.max(0, Number.isFinite(+vocalGain) ? +vocalGain : 1));
  const ig = Math.min(3, Math.max(0, Number.isFinite(+instrumentalGain) ? +instrumentalGain : 0.5));
  const filter =
    `[0:a]volume=${vg}[v];[1:a]volume=${ig}[i];` +
    `[v][i]amix=inputs=2:duration=first:normalize=0[m];` +
    `[m]loudnorm=I=-14:TP=-1.5:LRA=11[out]`;
  await run(FFMPEG, ['-y', '-i', vocalFile, '-i', instrumentalFile, '-filter_complex', filter,
    '-map', '[out]', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '192k', outFile]);
  return outFile;
}

// ─── Pipeline steps ─────────────────────────────────────────────────
// Step 1: resemble-enhance. denoise_flag on = run the denoiser before the
// enhancer. Output is an array of audio URIs — the ENHANCED file is last.
async function cleanVocal(song) {
  const m = AUDIO_MODELS.enhance;
  const p = await replicatePredict(m.version, {
    input_audio: song.original.url,
    denoise_flag: true,
  }, { pollMs: 4000, maxPolls: 150 });
  const output = Array.isArray(p.output) ? p.output[p.output.length - 1] : p.output;
  if (!output) throw new Error('enhance produced no output');
  const { buffer } = await fetchBuffer(output);
  const url = await saveBufferToStorage(buffer, 'audio/wav', 'songs/vocals');
  song.vocal = { url, status: 'done', error: null };
  song.spend = +((song.spend || 0) + m.cost).toFixed(2);
}

// Step 2: melody-conditioned instrumental, chunked at ≤30s. One shared seed
// keeps the chunks in the same sonic family; exact-length conforming keeps
// them aligned with the voice they follow.
async function generateInstrumental(song, tmpDir, progress) {
  if (!song.vocal?.url) throw new Error('cleaned vocal missing');
  const m = AUDIO_MODELS.instrumental;
  // With no style at all, STYLE_SUFFIX opens with ", " — strip that so the
  // prompt reads "instrumental backing track…" rather than ", instrumental…".
  const chosen = (song.style || DEFAULT_STYLE).trim().replace(/[.,\s]+$/, '');
  const stylePrompt = chosen ? chosen + STYLE_SUFFIX : STYLE_SUFFIX.replace(/^,\s*/, '');

  const vocalFile = path.join(tmpDir, 'vocal.wav');
  const { buffer } = await fetchBuffer(song.vocal.url);
  fs.writeFileSync(vocalFile, buffer);
  const duration = await probeDuration(vocalFile);
  if (!duration) throw new Error('could not read vocal duration');

  const chunkCount = Math.max(1, Math.ceil(duration / CHUNK_SECONDS));
  const chunks = Array.from({ length: chunkCount }, (_, i) => ({
    start: i * CHUNK_SECONDS,
    length: Math.min(CHUNK_SECONDS, duration - i * CHUNK_SECONDS),
  }));
  const seed = crypto.randomBytes(3).readUIntBE(0, 3); // shared across chunks

  let done = 0;
  await progress(0, chunkCount, 'writing instrumental');
  const results = await pool(chunks, 3, async (chunk, i) => {
    const melodyFile = path.join(tmpDir, `melody-${i}.wav`);
    await cutChunk(vocalFile, melodyFile, chunk.start, chunk.length);
    // Replicate must fetch the chunk — through Firebase like everything else.
    const melodyUrl = await saveBufferToStorage(fs.readFileSync(melodyFile), 'audio/wav', 'songs/melody-chunks');
    if (melodyUrl.startsWith('data:')) throw new Error('songs need Firebase Storage (public audio URLs)');
    const p = await replicatePredict(m.version, {
      prompt: stylePrompt,
      input_audio: melodyUrl,
      continuation: false, // mimic the melody, don't continue it
      duration: Math.max(1, Math.ceil(chunk.length)),
      model_version: 'stereo-melody-large',
      output_format: 'wav',
      normalization_strategy: 'loudness',
      seed,
    }, { pollMs: 5000, maxPolls: 180 });
    if (!p.output) throw new Error('musicgen produced no output');
    const piece = path.join(tmpDir, `piece-${i}.wav`);
    fs.writeFileSync(piece, (await fetchBuffer(p.output)).buffer);
    const conformed = path.join(tmpDir, `conf-${i}.wav`);
    await conformChunk(piece, conformed, chunk.length);
    await progress(++done, chunkCount, 'writing instrumental');
    return conformed;
  });
  const failed = results.filter(r => !r.ok);
  if (failed.length) throw new Error(`instrumental chunk failed: ${failed[0].error}`);

  const instrumentalFile = path.join(tmpDir, 'instrumental.wav');
  await concatAudio(results.map(r => r.value), instrumentalFile);
  const url = await saveBufferToStorage(fs.readFileSync(instrumentalFile), 'audio/wav', 'songs/instrumentals');
  song.instrumental = { url, status: 'done', error: null, promptUsed: stylePrompt, chunks: chunkCount };
  song.spend = +((song.spend || 0) + m.costPerChunk * chunkCount).toFixed(2);
  return instrumentalFile;
}

// Step 3: the mixdown. Previous mixes are never lost (mixHistory, capped 12).
async function mixSong(song, tmpDir, { vocalGain, instrumentalGain, vocalFile, instrumentalFile } = {}) {
  if (!song.vocal?.url) throw new Error('cleaned vocal missing');
  if (!song.instrumental?.url) throw new Error('instrumental missing');
  const vg = vocalGain ?? song.mix?.vocalGain ?? 1;
  const ig = instrumentalGain ?? song.mix?.instrumentalGain ?? 0.5;

  if (!vocalFile) {
    vocalFile = path.join(tmpDir, 'mix-vocal.wav');
    fs.writeFileSync(vocalFile, (await fetchBuffer(song.vocal.url)).buffer);
  }
  if (!instrumentalFile) {
    instrumentalFile = path.join(tmpDir, 'mix-instr.wav');
    fs.writeFileSync(instrumentalFile, (await fetchBuffer(song.instrumental.url)).buffer);
  }
  const outFile = path.join(tmpDir, 'mix.mp3');
  await mixdown(vocalFile, instrumentalFile, outFile, { vocalGain: vg, instrumentalGain: ig });
  const url = await saveBufferToStorage(fs.readFileSync(outFile), 'audio/mpeg', 'songs/mixes');

  if (song.mix?.url && song.mix.url !== url) {
    song.mixHistory = [...(song.mixHistory || []), {
      url: song.mix.url, vocalGain: song.mix.vocalGain, instrumentalGain: song.mix.instrumentalGain,
      style: song.mix.style || '', mixedAt: song.mix.mixedAt || null,
    }].slice(-12);
  }
  song.mix = {
    url, status: 'done', error: null,
    vocalGain: vg, instrumentalGain: ig,
    style: song.instrumental?.promptUsed || '',
    mixedAt: new Date().toISOString(),
  };
}

// ─── Background jobs (movies.js pattern: one job per song, in the doc) ──
async function startJob(song, kind, fn) {
  if (song.job && song.job.status === 'running') {
    const age = Date.now() - new Date(song.job.startedAt || 0).getTime();
    if (age < 30 * 60 * 1000) throw new Error(`a "${song.job.kind}" job is already running`);
  }
  song.job = { kind, status: 'running', done: 0, total: 0, label: 'starting', error: null, startedAt: new Date().toISOString() };
  await saveSong(song);

  (async () => {
    let lastSave = 0;
    const progress = async (done, total, label) => {
      song.job = { ...song.job, done, total, label };
      if (Date.now() - lastSave > 1500) { lastSave = Date.now(); await saveSong(song).catch(() => {}); }
    };
    try {
      await fn(progress);
      song.job = { ...song.job, status: 'done', label: 'done' };
    } catch (err) {
      console.warn(`songs: job ${kind} failed —`, err.message);
      song.job = { ...song.job, status: 'error', error: err.message };
    }
    await saveSong(song).catch(e => console.warn('songs: save failed —', e.message));
  })();
}

// The full production run: clean → instrumental → mix.
async function produceJob(song, progress) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-song-'));
  try {
    await progress(0, 1, 'cleaning the vocal');
    song.vocal = { ...(song.vocal || {}), status: 'running', error: null };
    await cleanVocal(song);
    song.instrumental = { ...(song.instrumental || {}), status: 'running', error: null };
    const instrumentalFile = await generateInstrumental(song, tmpDir, progress);
    await progress(0, 1, 'mixing');
    await mixSong(song, tmpDir, { instrumentalFile });
  } catch (err) {
    if (song.vocal?.status === 'running') song.vocal = { ...song.vocal, status: 'error', error: err.message };
    else if (song.instrumental?.status === 'running') song.instrumental = { ...song.instrumental, status: 'error', error: err.message };
    throw err;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();
router.use(express.json({ limit: '30mb' }));

router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    replicate: Boolean(REPLICATE_API_TOKEN),
    firebase: Boolean(firestore()),
    storage: Boolean(bucket()),
    ffmpeg: Boolean(FFMPEG && FFPROBE),
    gated: Boolean(STUDIO_TOKEN),
    models: { enhance: AUDIO_MODELS.enhance.name, instrumental: AUDIO_MODELS.instrumental.name },
    limits: { maxSeconds: MAX_SONG_SECONDS, chunkSeconds: CHUNK_SECONDS },
    costs: { enhance: AUDIO_MODELS.enhance.cost, instrumentalPerChunk: AUDIO_MODELS.instrumental.costPerChunk, mix: 0 },
  });
});

router.get('/', async (req, res) => {
  try { res.json({ songs: await listSongs() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Create a song: audio (data URL) in → doc + full production job out.
router.post('/', async (req, res) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-song-up-'));
  try {
    const { audio, title, style } = req.body || {};
    const m = /^data:([^;]+);base64,(.+)$/.exec(String(audio || ''));
    if (!m) return res.status(400).json({ error: 'audio (data URL) required' });
    if (!REPLICATE_API_TOKEN) return res.status(400).json({ error: 'REPLICATE_API_TOKEN not set' });
    if (!FFMPEG || !FFPROBE) return res.status(400).json({ error: 'ffmpeg unavailable on the server' });
    if (!bucket()) return res.status(400).json({ error: 'songs need Firebase Storage (Replicate must fetch the audio)' });

    // Normalize whatever the phone recorded to mono WAV before anything else.
    const rawFile = path.join(tmpDir, 'raw');
    fs.writeFileSync(rawFile, Buffer.from(m[2], 'base64'));
    const wavFile = path.join(tmpDir, 'original.wav');
    await toWav(rawFile, wavFile);
    const duration = await probeDuration(wavFile);
    if (!duration || duration < 3) return res.status(400).json({ error: 'recording too short (or unreadable) — need at least 3 seconds' });
    if (duration > MAX_SONG_SECONDS) {
      return res.status(400).json({ error: `recording is ${Math.round(duration)}s — max is ${MAX_SONG_SECONDS}s (${MAX_SONG_SECONDS / 60} minutes)` });
    }
    const originalUrl = await saveBufferToStorage(fs.readFileSync(wavFile), 'audio/wav', 'songs/originals');

    const song = {
      id: 'sg' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
      title: (title && String(title).trim()) || 'Untitled song',
      style: (style && String(style).trim()) || DEFAULT_STYLE,
      duration: Math.round(duration * 10) / 10,
      original: { url: originalUrl },
      vocal: null,
      instrumental: null,
      mix: null,
      mixHistory: [],
      job: null,
      spend: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await startJob(song, 'produce', progress => produceJob(song, progress));
    res.json(song);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const song = await loadSong(req.params.id);
    if (!song) return res.status(404).json({ error: 'song not found' });
    res.json(song);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await deleteSong(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const song = await loadSong(req.params.id);
    if (!song) return res.status(404).json({ error: 'song not found' });
    const b = req.body || {};
    for (const key of ['title', 'style']) {
      if (typeof b[key] === 'string' && b[key].trim()) song[key] = b[key].trim();
    }
    await saveSong(song);
    res.json(song);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Re-roll the instrumental (optionally with a new style), then re-mix.
router.post('/:id/instrumental', async (req, res) => {
  try {
    const song = await loadSong(req.params.id);
    if (!song) return res.status(404).json({ error: 'song not found' });
    if (!song.vocal?.url) return res.status(400).json({ error: 'no cleaned vocal yet — produce the song first' });
    const { style } = req.body || {};
    if (typeof style === 'string' && style.trim()) song.style = style.trim();
    song.instrumental = { ...(song.instrumental || {}), status: 'running', error: null };
    await startJob(song, 'instrumental', async (progress) => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-song-'));
      try {
        const instrumentalFile = await generateInstrumental(song, tmpDir, progress);
        await progress(0, 1, 'mixing');
        await mixSong(song, tmpDir, { instrumentalFile });
      } catch (err) {
        if (song.instrumental?.status === 'running') song.instrumental = { ...song.instrumental, status: 'error', error: err.message };
        throw err;
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
    res.json({ ok: true, song });
  } catch (err) { res.status(/already running/.test(err.message) ? 409 : 500).json({ error: err.message }); }
});

// Melody → MIDI: extract the sung notes from the cleaned vocal (or the
// original, pre-cleanup) as a .mid file for GarageBand — the handoff for
// building real chords around the real tune. Pure DSP (melody.js), free.
router.post('/:id/midi', async (req, res) => {
  try {
    const song = await loadSong(req.params.id);
    if (!song) return res.status(404).json({ error: 'song not found' });
    const source = song.vocal?.url || song.original?.url;
    if (!source) return res.status(400).json({ error: 'no audio yet' });
    if (!FFMPEG) return res.status(400).json({ error: 'ffmpeg unavailable on the server' });
    song.midi = { ...(song.midi || {}), status: 'running', error: null };
    await startJob(song, 'midi', async (progress) => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-song-'));
      try {
        await progress(0, 1, 'listening for the melody');
        const inFile = path.join(tmpDir, 'vocal-in');
        fs.writeFileSync(inFile, (await fetchBuffer(source)).buffer);
        const pcmFile = path.join(tmpDir, 'vocal.pcm');
        await run(FFMPEG, ['-y', '-i', inFile, '-f', 'f32le', '-ac', '1', '-ar', '22050', pcmFile]);
        const raw = fs.readFileSync(pcmFile);
        const samples = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4));
        const { midi, notes, voicedSeconds } = await extractMelodyMidi(samples, 22050);
        const url = await saveBufferToStorage(midi, 'audio/midi', 'songs/midi');
        song.midi = { url, status: 'done', error: null, noteCount: notes.length, voicedSeconds };
      } catch (err) {
        song.midi = { ...(song.midi || {}), status: 'error', error: err.message };
        throw err;
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
    res.json({ ok: true, song });
  } catch (err) { res.status(/already running/.test(err.message) ? 409 : 500).json({ error: err.message }); }
});

// Re-mix with new gains — pure ffmpeg, free, seconds.
router.post('/:id/mix', async (req, res) => {
  try {
    const song = await loadSong(req.params.id);
    if (!song) return res.status(404).json({ error: 'song not found' });
    if (!song.vocal?.url || !song.instrumental?.url) return res.status(400).json({ error: 'nothing to mix yet' });
    const { vocalGain, instrumentalGain } = req.body || {};
    await startJob(song, 'mix', async (progress) => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-song-'));
      try {
        await progress(0, 1, 'mixing');
        await mixSong(song, tmpDir, { vocalGain, instrumentalGain });
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
    res.json({ ok: true, song });
  } catch (err) { res.status(/already running/.test(err.message) ? 409 : 500).json({ error: err.message }); }
});

module.exports = {
  router,
  AUDIO_MODELS,
  // building blocks, exported for scripts/tests
  cleanVocal,
  generateInstrumental,
  mixSong,
  mixdown,
  probeDuration,
  toWav,
};
