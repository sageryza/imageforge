// editor.js — the Episode Editor: pick spans of a real interview transcript as
// snippet cards, arrange them (with narration and gaps) into an episode, tap
// Render, get the finished audio.
//
// This is the cloud version of the hand-run supercut pipeline
// (scripts/nde-supercut-precise.py). Everything that made those cuts sound like
// an editor made them is ported here:
//   * the snippet text is located in the REAL AUDIO's word timestamps with a
//     contiguous best-match slide (`phraseSpan` — a repeated word later in the
//     window can't stretch the cut across half a minute),
//   * bounds are GAP-AWARE (`clampBounds` — padding never past the midpoint of
//     the silence to the neighbouring word, which used to swallow the first
//     syllable of the next word and sounded like a mid-word stop),
//   * both cut points are then snapped into REAL silences detected in the
//     waveform (`detectSilences`/`snapToSilence`), forward-only at the end and
//     capped at the next word so snapping can never drag in extra words,
//   * micro-fades on both edges + loudnorm so every clip sits at the same level.
//
// Word timestamps come from a cached forced-alignment JSON in Firebase Storage
// when one covers the window (uploaded by scripts/upload-align-cache.js — these
// are the aligned, drift-repaired timings, the good ones), and fall back to
// OpenAI whisper-1 verbose_json word timestamps when nothing covers it.
//
// Same module shape as the rest of the pipeline: a router mounted at
// /api/editor by server.js + one Firestore doc per episode (`forge-editor`).
// Rendering is a fire-and-forget background job recorded on the doc — the page
// polls GET /:id/job and resumes polling after it's been closed (house rule:
// nothing slow ever blocks a request or traps someone on a spinner).

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
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';

// Narration voice: Sophie's chosen narrator, spoken quietly and nudged ~12%
// faster so the fills sit under the interview clips instead of on top of them.
const NARRATION_VOICE = process.env.EDITOR_NARRATION_VOICE || 'UTkHGl2ImiT6gwtAFCql';
const NARRATION_MODEL = process.env.EDITOR_NARRATION_MODEL || 'eleven_v3';
const NARRATION_TEMPO = Number(process.env.EDITOR_NARRATION_TEMPO || 1.12);
const NARRATION_PREFIX = '[quietly] ';

const COLLECTION = process.env.EDITOR_COLLECTION || 'forge-editor';
const NDE_COLLECTION = process.env.NDE_COLLECTION || 'forge-nde-videos';
const ALIGN_PREFIX = process.env.EDITOR_ALIGN_PREFIX || 'nde-align-cache/';
const AUDIO_PREFIX = process.env.EDITOR_AUDIO_PREFIX || 'nde-audio/';
const RENDER_FOLDER = 'nde-episodes/editor';
const MAX_RENDERS = 10;
const WINDOW_RADIUS = 150; // ±seconds of transcript handed to the picker

// ffmpeg / ffprobe: static npm binaries first (Render's stock Node image has
// neither), then FFMPEG_PATH / anything on PATH. Same resolution as movies.js.
function tryRequire(name) {
  try { return require(name); } catch (err) {
    console.warn(`editor: ${name} unavailable —`, err.message);
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
// ffmpeg-static resolves to a path even when its postinstall never downloaded
// the binary (common in a bare checkout), so verify it exists before trusting it.
function usable(p) {
  if (!p) return null;
  try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { return null; }
}
const FFMPEG = process.env.FFMPEG_PATH || usable(tryRequire('ffmpeg-static')) || firstOnPath('ffmpeg');
const FFPROBE = process.env.FFPROBE_PATH || usable((tryRequire('ffprobe-static') || {}).path) || firstOnPath('ffprobe');

// ─── difflib port ───────────────────────────────────────────────────
// The Python cutter used difflib.SequenceMatcher(autojunk=False) to score how
// well a run of audio words matches the wanted text. These are faithful ports
// of get_matching_blocks / ratio for that configuration (no junk, no autojunk),
// so the JS picks the same span the validated Python cuts did.
function matchingBlocks(a, b) {
  const b2j = new Map();
  for (let i = 0; i < b.length; i++) {
    const arr = b2j.get(b[i]);
    if (arr) arr.push(i); else b2j.set(b[i], [i]);
  }
  function longestMatch(alo, ahi, blo, bhi) {
    let besti = alo, bestj = blo, bestsize = 0;
    let j2len = new Map();
    for (let i = alo; i < ahi; i++) {
      const next = new Map();
      const js = b2j.get(a[i]);
      if (js) {
        for (const j of js) {
          if (j < blo) continue;
          if (j >= bhi) break;
          const k = (j2len.get(j - 1) || 0) + 1;
          next.set(j, k);
          if (k > bestsize) { besti = i - k + 1; bestj = j - k + 1; bestsize = k; }
        }
      }
      j2len = next;
    }
    return [besti, bestj, bestsize];
  }
  const queue = [[0, a.length, 0, b.length]];
  const blocks = [];
  while (queue.length) {
    const [alo, ahi, blo, bhi] = queue.pop();
    const [i, j, k] = longestMatch(alo, ahi, blo, bhi);
    if (!k) continue;
    blocks.push([i, j, k]);
    if (alo < i && blo < j) queue.push([alo, i, blo, j]);
    if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
  }
  blocks.sort((x, y) => (x[0] - y[0]) || (x[1] - y[1]));
  return blocks;
}

function ratio(a, b) {
  const total = a.length + b.length;
  if (!total) return 1;
  let matched = 0;
  for (const blk of matchingBlocks(a, b)) matched += blk[2];
  return (2 * matched) / total;
}

function normWords(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
}

// ─── the cutting logic (ported from nde-supercut-precise.py) ────────

// Word indices (start,end) of the best CONTIGUOUS match of `phrase` in the
// audio words — the anchor everything else hangs off. null when it's too weak
// to trust (the phrase isn't really in this window).
function phraseSpan(words, phrase) {
  if (!words.length) return null;
  const ww = words.map(w => (normWords(w.word)[0] || ''));
  const pw = normWords(phrase);
  if (!pw.length) return null;
  const n = pw.length;
  let best = null; // [ratio, start, end]
  for (let L = n; L < n + 4; L++) {
    const last = Math.max(1, ww.length - L + 1);
    for (let i = 0; i < last; i++) {
      const win = ww.slice(i, i + L);
      if (!win.length) continue;
      const r = ratio(pw, win);
      if (!best || r > best[0]) best = [r, i, Math.min(i + L - 1, words.length - 1)];
    }
  }
  if (!best || best[0] < 0.5) return null;
  return { start: best[1], end: best[2], score: best[0] };
}

// Gap-aware clip bounds: pad outward for a natural feel, but NEVER past the
// midpoint of the silence to the neighbouring word.
function clampBounds(words, i0, i1) {
  let t0 = words[i0].start;
  if (i0 > 0) {
    const gap = t0 - words[i0 - 1].end;
    t0 -= Math.min(0.15, Math.max(0.02, gap * 0.5));
  } else {
    t0 -= 0.15;
  }
  let t1 = words[i1].end;
  if (i1 < words.length - 1) {
    const gap = words[i1 + 1].start - t1;
    t1 += Math.min(0.30, Math.max(0.03, gap * 0.5));
  } else {
    t1 += 0.30;
  }
  return [Math.max(0, t0), t1];
}

// Real silences in the waveform (ffmpeg silencedetect) — ground truth the
// Whisper timings lack. A cut placed INSIDE a detected silence can't clip a word.
async function detectSilences(file) {
  if (!FFMPEG) return [];
  let stderr = '';
  try {
    const out = await run(FFMPEG, ['-i', file, '-af', 'silencedetect=noise=-32dB:d=0.2', '-f', 'null', '-'], 180000);
    stderr = out.stderr || '';
  } catch (err) {
    stderr = err.stderr || '';
  }
  const starts = [...stderr.matchAll(/silence_start: ([\d.]+)/g)].map(m => parseFloat(m[1]));
  const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map(m => parseFloat(m[1]));
  const sil = [];
  let ei = 0;
  for (const s of starts) {
    while (ei < ends.length && ends[ei] <= s) ei++;
    sil.push([s, ei < ends.length ? ends[ei] : s + 0.5]);
  }
  return sil;
}

// Move both cut points into real silences near the word-derived bounds. End:
// forward-only (never eat the last word) and hard-capped at `maxEnd` (the next
// word's start) so snapping can't add words. Start: the silence that truly
// abuts the first word. A degenerate snap keeps the originals.
function snapToSilence(rs, re, silences, maxEnd) {
  let re2 = re;
  for (const [s, e] of silences) {
    if (s >= re - 0.05 && s <= re + 1.0) {
      if (maxEnd != null && s >= maxEnd) break;
      re2 = s + Math.min(0.18, Math.max(0.05, (e - s) * 0.4));
      break;
    }
  }
  let rs2 = rs;
  let cand = null;
  for (const [s, e] of silences) {
    if (e >= rs - 0.35 && e <= rs + 0.15) cand = [s, e];
  }
  if (cand) {
    const [s, e] = cand;
    rs2 = Math.max(s, e - Math.min(0.15, Math.max(0.04, (e - s) * 0.4)));
  }
  if (re2 <= rs2 + 0.4) return [rs, re];
  return [rs2, re2];
}

// ─── Firestore / Storage ────────────────────────────────────────────
const memStore = new Map(); // dev fallback when Firebase isn't initialized

function firestore() { return admin.apps.length ? admin.firestore() : null; }
function bucket() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}
function plain(obj) { return JSON.parse(JSON.stringify(obj)); }

async function saveEpisode(ep) {
  ep.updatedAt = new Date().toISOString();
  const db = firestore();
  if (db) await db.collection(COLLECTION).doc(ep.id).set(plain(ep));
  else memStore.set(ep.id, plain(ep));
  return ep;
}

function normalizeEpisode(ep) {
  if (!ep) return ep;
  ep.title = ep.title || ep.id || 'untitled';
  ep.sources = Array.isArray(ep.sources) ? ep.sources : [];
  ep.snippets = Array.isArray(ep.snippets) ? ep.snippets : [];
  ep.sequence = Array.isArray(ep.sequence) ? ep.sequence : [];
  ep.renders = Array.isArray(ep.renders) ? ep.renders : [];
  return ep;
}

async function loadEpisode(id) {
  const db = firestore();
  if (db) {
    const snap = await db.collection(COLLECTION).doc(id).get();
    return snap.exists ? normalizeEpisode(snap.data()) : null;
  }
  return normalizeEpisode(memStore.get(id)) || null;
}

async function listEpisodes() {
  const db = firestore();
  let all;
  if (db) {
    const snap = await db.collection(COLLECTION).orderBy('updatedAt', 'desc').limit(100).get();
    all = snap.docs.map(d => d.data());
  } else {
    all = [...memStore.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }
  return all.map(e => ({
    id: e.id,
    title: e.title,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    sources: (e.sources || []).length,
    snippets: (e.snippets || []).length,
    sequence: (e.sequence || []).length,
    latestRender: (e.renders || [])[0] || null,
    job: e.job || null,
  }));
}

async function deleteEpisode(id) {
  const db = firestore();
  if (db) await db.collection(COLLECTION).doc(id).delete();
  else memStore.delete(id);
}

async function uploadPublic(localFile, storagePath, contentType) {
  const b = bucket();
  if (!b) throw new Error('Firebase Storage unavailable — cannot publish the render');
  const file = b.file(storagePath);
  await b.upload(localFile, { destination: storagePath, metadata: { contentType } });
  await file.makePublic();
  return `https://storage.googleapis.com/${b.name}/${storagePath}`;
}

// The interview audio lives at a conventional Storage path per video.
function defaultAudioUrl(videoId) {
  const b = bucket();
  const name = b ? b.name : 'deckfactory-43176.firebasestorage.app';
  return `https://storage.googleapis.com/${name}/${AUDIO_PREFIX}${videoId}.webm`;
}

// ─── Transcript windows (for the picker) ────────────────────────────
async function loadVideo(videoId) {
  const db = firestore();
  if (!db) return null;
  const snap = await db.collection(NDE_COLLECTION).doc(videoId).get();
  return snap.exists ? snap.data() : null;
}

// Word-tokenize ±radius seconds of a transcript around a centre time. Each word
// carries an interpolated timestamp so a picked span knows where it lives in
// the interview — that anchor is what selects the alignment window at render.
function windowTokens(transcript, centre, radius = WINDOW_RADIUS) {
  const segs = (transcript && transcript.segments) || [];
  const lo = Math.max(0, centre - radius);
  const hi = centre + radius;
  const words = [];
  const times = [];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const start = Number(seg.start) || 0;
    if (start < lo || start > hi) continue;
    const next = segs[i + 1] ? Number(segs[i + 1].start) : start + 2;
    const dur = Number(seg.dur) || Math.max(0.4, Math.min(6, next - start));
    const toks = String(seg.text || '').split(/\s+/).filter(Boolean);
    toks.forEach((w, k) => {
      words.push(w);
      times.push(Math.round((start + (dur * k) / Math.max(1, toks.length)) * 10) / 10);
    });
  }
  return { start: lo, end: hi, words, times };
}

// ─── Word timestamps: cached alignment first, whisper as the fallback ───
const alignCacheIndex = new Map(); // videoId → [{name, winStart}]

async function listAlignCache(videoId) {
  if (alignCacheIndex.has(videoId)) return alignCacheIndex.get(videoId);
  let entries = [];
  const b = bucket();
  if (b) {
    try {
      const [files] = await b.getFiles({ prefix: `${ALIGN_PREFIX}${videoId}_` });
      entries = files.map(f => {
        const base = path.basename(f.name).replace(/\.json$/, '');
        const winStart = Number(base.slice(videoId.length + 1));
        return Number.isFinite(winStart) ? { name: f.name, winStart } : null;
      }).filter(Boolean);
    } catch (err) {
      console.warn('editor: align-cache listing failed —', err.message);
    }
  }
  alignCacheIndex.set(videoId, entries);
  return entries;
}

async function readAlignCache(name) {
  const b = bucket();
  if (!b) return null;
  try {
    const [buf] = await b.file(name).download();
    const data = JSON.parse(buf.toString('utf8'));
    // Two shapes: the wrapper written by scripts/upload-align-cache.js, or a
    // bare word array (the original on-disk cache format).
    if (Array.isArray(data)) return { words: data, winDur: 150 };
    return { words: data.words || [], winDur: Number(data.winDur) || 150, winStart: Number(data.winStart) };
  } catch (err) {
    console.warn('editor: align-cache read failed —', err.message);
    return null;
  }
}

// Pick the cached alignment window that comfortably contains [anchor, anchor+est].
async function cachedWordsFor(videoId, anchor, est) {
  const entries = await listAlignCache(videoId);
  const candidates = entries
    .filter(e => e.winStart <= anchor + 2)
    .sort((a, b) => Math.abs(anchor - a.winStart) - Math.abs(anchor - b.winStart));
  for (const cand of candidates.slice(0, 4)) {
    const data = await readAlignCache(cand.name);
    if (!data || !data.words.length) continue;
    const winStart = Number.isFinite(data.winStart) ? data.winStart : cand.winStart;
    const covers = winStart <= anchor + 2 && (winStart + data.winDur) >= (anchor + est + 5);
    if (!covers) continue;
    return { words: data.words, winStart, winDur: data.winDur, source: 'align-cache' };
  }
  return null;
}

async function whisperWords(file) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set — cannot get word timestamps');
  const form = new FormData();
  form.append('file', fs.createReadStream(file), { filename: 'window.mp3' });
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders() },
    body: form,
    timeout: 300000,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'transcription failed');
  return (data.words || []).map(w => ({ word: String(w.word || '').trim(), start: Number(w.start) || 0, end: Number(w.end) || 0 }));
}

// ─── ffmpeg helpers ─────────────────────────────────────────────────
function run(bin, args, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const e = new Error(`${path.basename(bin)} failed: ${(stderr || err.message).slice(-400)}`);
        e.stderr = stderr;
        reject(e);
      } else resolve({ stdout, stderr });
    });
  });
}

async function audioDuration(file) {
  if (!FFPROBE) return 0;
  try {
    const { stdout } = await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], 60000);
    return parseFloat(stdout.trim()) || 0;
  } catch { return 0; }
}

// Download a whole source file once per job — only used when ffmpeg can't seek
// the URL directly (some static builds ship without https).
async function downloadOnce(url, ctx) {
  if (ctx.downloads.has(url)) return ctx.downloads.get(url);
  const file = path.join(ctx.dir, `src-${crypto.randomBytes(4).toString('hex')}`);
  const res = await fetch(url, { redirect: 'follow', timeout: 600000 });
  if (!res.ok) throw new Error(`source audio fetch ${res.status}`);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(file);
    res.body.pipe(out);
    res.body.on('error', reject);
    out.on('finish', resolve);
    out.on('error', reject);
  });
  ctx.downloads.set(url, file);
  return file;
}

// Cut `winDur` seconds starting at `winStart` out of the source audio. Tries the
// URL directly first (ffmpeg range-seeks, so it pulls only what it needs).
async function extractWindow(url, winStart, winDur, outFile, ctx) {
  if (!FFMPEG) throw new Error('ffmpeg unavailable — cannot cut audio');
  const args = ['-y', '-ss', String(winStart), '-t', String(winDur), '-i', url, '-vn', '-c:a', 'libmp3lame', '-q:a', '4', outFile];
  try {
    await run(FFMPEG, args, 420000);
    if (fs.existsSync(outFile) && fs.statSync(outFile).size > 2000) return outFile;
  } catch (err) {
    ctx.log.push(`direct seek failed (${err.message.slice(0, 90)}) — downloading the source`);
  }
  const local = await downloadOnce(url, ctx);
  await run(FFMPEG, ['-y', '-ss', String(winStart), '-t', String(winDur), '-i', local, '-vn', '-c:a', 'libmp3lame', '-q:a', '4', outFile], 420000);
  return outFile;
}

// ─── Building the three card types ──────────────────────────────────

// A clip card: locate the snippet's words in the real audio and cut them.
async function buildClip(snippet, source, ctx) {
  const est = Math.max(2, normWords(snippet.text).length / 2.6);
  const anchor = Number.isFinite(Number(snippet.timeSec)) ? Number(snippet.timeSec) : Number(source.timeSec) || 0;
  const url = source.audioUrl || defaultAudioUrl(source.videoId);
  const tag = crypto.randomBytes(3).toString('hex');
  const winFile = path.join(ctx.dir, `win-${tag}.mp3`);

  let words = null;
  let winStart = 0;
  let usedCache = false;
  const cached = await cachedWordsFor(snippet.videoId || source.videoId, anchor, est);
  if (cached) {
    words = cached.words;
    winStart = cached.winStart;
    usedCache = true;
    await extractWindow(url, winStart, cached.winDur, winFile, ctx);
  }

  let span = words ? phraseSpan(words, snippet.text) : null;
  if (!span) {
    // No cache, or the cached window didn't actually contain the words — listen
    // to a fresh window around the anchor with whisper.
    winStart = Math.max(0, anchor - 12);
    const winDur = Math.min(300, est + 60);
    await extractWindow(url, winStart, winDur, winFile, ctx);
    words = await whisperWords(winFile);
    usedCache = false;
    span = phraseSpan(words, snippet.text);
    ctx.fallbacks.push(snippet.name || snippet.id);
  }
  if (!span) throw new Error(`couldn't find "${snippet.name || snippet.id}" in the audio around ${Math.round(anchor)}s`);

  let [t0, t1] = clampBounds(words, span.start, span.end);
  const nxt = words.find(w => w.start > t1 + 0.02);
  const silences = await detectSilences(winFile);
  [t0, t1] = snapToSilence(t0, t1, silences, nxt ? nxt.start : null);

  const cut = path.join(ctx.dir, `cut-${tag}.mp3`);
  await run(FFMPEG, ['-y', '-ss', String(t0), '-to', String(t1), '-i', winFile, '-c:a', 'libmp3lame', '-q:a', '3', cut], 180000);
  const out = path.join(ctx.dir, `clip-${tag}.mp3`);
  await run(FFMPEG, ['-y', '-i', cut, '-af',
    'loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=0.03,areverse,afade=t=in:d=0.10,areverse',
    '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-q:a', '2', out], 180000);

  ctx.log.push(`clip "${snippet.name}" ${(t1 - t0).toFixed(1)}s via ${usedCache ? 'align-cache' : 'whisper'} (match ${(span.score * 100).toFixed(0)}%)`);
  return out;
}

// A narration card: ElevenLabs, spoken quietly, then nudged faster + levelled.
async function buildNarration(text, ctx) {
  const key = process.env.ELEVENLABS_API_KEY || '';
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set on the server — narration cards cannot be rendered');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${NARRATION_VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: NARRATION_PREFIX + String(text || '').trim(),
      model_id: NARRATION_MODEL,
      voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
    }),
    timeout: 180000,
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const buf = await res.buffer();
  if (!buf.length) throw new Error('ElevenLabs returned empty audio');
  const tag = crypto.randomBytes(3).toString('hex');
  const raw = path.join(ctx.dir, `nar-raw-${tag}.mp3`);
  fs.writeFileSync(raw, buf);
  const out = path.join(ctx.dir, `nar-${tag}.mp3`);
  await run(FFMPEG, ['-y', '-i', raw, '-af',
    `atempo=${NARRATION_TEMPO},loudnorm=I=-16:TP=-1.5:LRA=11`,
    '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-q:a', '2', out], 180000);
  return out;
}

// A gap card: silence, same format as everything else so concat stays clean.
async function buildGap(dur, ctx) {
  const seconds = Math.min(10, Math.max(0.1, Number(dur) || 0.6));
  const out = path.join(ctx.dir, `gap-${crypto.randomBytes(3).toString('hex')}.mp3`);
  await run(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', String(seconds),
    '-c:a', 'libmp3lame', '-q:a', '2', out], 60000);
  return out;
}

async function concatAll(files, outFile, ctx) {
  const listFile = path.join(ctx.dir, 'concat.txt');
  fs.writeFileSync(listFile, files.map(f => `file '${f.replace(/'/g, "'\\''")}'\n`).join(''));
  await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-q:a', '2', outFile], 420000);
  return outFile;
}

// ─── The render job ─────────────────────────────────────────────────
async function renderEpisode(ep, progress) {
  const seq = (ep.sequence || []).filter(Boolean);
  if (!seq.length) throw new Error('the arrangement is empty — add some cards first');
  if (!FFMPEG) throw new Error('ffmpeg unavailable on this host');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-'));
  const ctx = { dir, downloads: new Map(), log: [], fallbacks: [] };
  const snippetById = new Map((ep.snippets || []).map(s => [s.id, s]));
  const sourceFor = (videoId, snippet) => {
    const all = (ep.sources || []).filter(s => s.videoId === videoId);
    if (!all.length) return null;
    if (all.length === 1) return all[0];
    const anchor = Number(snippet && snippet.timeSec);
    if (!Number.isFinite(anchor)) return all[0];
    return all.slice().sort((a, b) => Math.abs(anchor - (a.timeSec || 0)) - Math.abs(anchor - (b.timeSec || 0)))[0];
  };

  try {
    // One cut per UNIQUE snippet — the same card can appear many times in the
    // sequence and it only gets built (and paid for) once.
    const uniqueClips = [...new Set(seq.filter(i => i.type === 'clip').map(i => i.snippetId))];
    const total = uniqueClips.length + seq.filter(i => i.type === 'narration').length + 1;
    let done = 0;
    const clipFiles = new Map();
    for (const snippetId of uniqueClips) {
      const snippet = snippetById.get(snippetId);
      if (!snippet) throw new Error(`sequence references a missing snippet (${snippetId})`);
      const source = sourceFor(snippet.videoId, snippet);
      if (!source) throw new Error(`no source in this episode for video ${snippet.videoId}`);
      await progress(done, total, `cutting "${snippet.name || snippetId}"`);
      clipFiles.set(snippetId, await buildClip(snippet, source, ctx));
      done++;
    }

    const parts = [];
    for (const item of seq) {
      if (item.type === 'clip') {
        const f = clipFiles.get(item.snippetId);
        if (!f) throw new Error(`sequence references a missing snippet (${item.snippetId})`);
        parts.push(f);
      } else if (item.type === 'narration') {
        await progress(done, total, 'recording narration');
        parts.push(await buildNarration(item.text, ctx));
        done++;
      } else if (item.type === 'gap') {
        parts.push(await buildGap(item.dur, ctx));
      }
    }
    if (!parts.length) throw new Error('nothing to render');

    await progress(done, total, 'stitching');
    const outFile = path.join(dir, 'episode.mp3');
    await concatAll(parts, outFile, ctx);
    const seconds = await audioDuration(outFile);

    await progress(total - 0.5, total, 'uploading');
    const n = (ep.renders || []).length + 1;
    const url = await uploadPublic(outFile, `${RENDER_FOLDER}/${ep.id}-${n}.mp3`, 'audio/mpeg');

    ep.renders = [{
      url,
      at: new Date().toISOString(),
      seconds: Math.round(seconds * 10) / 10,
      cards: seq.length,
      notes: ctx.log,
    }, ...(ep.renders || [])].slice(0, MAX_RENDERS);
    await progress(total, total, 'done');
    return url;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp dir */ }
  }
}

// Fire-and-forget background job recorded on the doc (movies.js pattern) —
// the request returns immediately and the page polls GET /:id/job.
async function startJob(ep, kind, fn) {
  if (ep.job && ep.job.status === 'running') {
    const age = Date.now() - new Date(ep.job.startedAt || 0).getTime();
    if (age < 20 * 60 * 1000) throw new Error(`a "${ep.job.kind}" job is already running`);
  }
  ep.job = { kind, status: 'running', done: 0, total: 0, label: 'starting', error: null, startedAt: new Date().toISOString() };
  await saveEpisode(ep);

  (async () => {
    let lastSave = 0;
    const progress = async (done, total, label) => {
      ep.job = { ...ep.job, done, total, label };
      if (Date.now() - lastSave > 1500) { lastSave = Date.now(); await saveEpisode(ep).catch(() => {}); }
    };
    try {
      await fn(progress);
      ep.job = { ...ep.job, status: 'done', label: 'done' };
    } catch (err) {
      console.warn(`editor: job ${kind} failed —`, err.message);
      ep.job = { ...ep.job, status: 'error', error: err.message };
    }
    await saveEpisode(ep).catch(e => console.warn('editor: save failed —', e.message));
  })();
}

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();
router.use(express.json({ limit: '4mb' }));

router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    firebase: Boolean(firestore()),
    storage: Boolean(bucket()),
    ffmpeg: Boolean(FFMPEG),
    ffprobe: Boolean(FFPROBE),
    openai: Boolean(OPENAI_API_KEY),
    elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
    narrationVoice: NARRATION_VOICE,
    narrationModel: NARRATION_MODEL,
    gated: Boolean(STUDIO_TOKEN),
  });
});

router.get('/', async (req, res) => {
  try { res.json({ episodes: await listEpisodes() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

function cleanSource(s) {
  const videoId = String(s.videoId || '').trim();
  if (!videoId) return null;
  return {
    videoId,
    experiencer: String(s.experiencer || '').trim() || videoId,
    timeSec: Math.max(0, Math.round(Number(s.timeSec) || 0)),
    audioUrl: String(s.audioUrl || '').trim() || defaultAudioUrl(videoId),
  };
}

function cleanSnippet(s) {
  const text = String(s.text || '').trim();
  if (!text) return null;
  const out = {
    id: String(s.id || '').trim() || 'sn' + crypto.randomBytes(4).toString('hex'),
    name: String(s.name || '').trim() || 'untitled snippet',
    videoId: String(s.videoId || '').trim(),
    text,
  };
  if (Number.isFinite(Number(s.timeSec))) out.timeSec = Math.round(Number(s.timeSec) * 10) / 10;
  return out;
}

function cleanSequence(items) {
  return (Array.isArray(items) ? items : []).map(i => {
    if (!i || !i.type) return null;
    if (i.type === 'clip') return i.snippetId ? { type: 'clip', snippetId: String(i.snippetId) } : null;
    if (i.type === 'narration') {
      const text = String(i.text || '').trim();
      return text ? { type: 'narration', text } : null;
    }
    if (i.type === 'gap') return { type: 'gap', dur: Math.min(10, Math.max(0.1, Number(i.dur) || 0.6)) };
    return null;
  }).filter(Boolean);
}

router.post('/', async (req, res) => {
  try {
    const title = String(req.body.title || '').trim() || 'untitled episode';
    const sources = (Array.isArray(req.body.sources) ? req.body.sources : []).map(cleanSource).filter(Boolean);
    const ep = normalizeEpisode({
      id: 'ep' + crypto.randomBytes(5).toString('hex'),
      title,
      createdAt: new Date().toISOString(),
      sources,
      snippets: (Array.isArray(req.body.snippets) ? req.body.snippets : []).map(cleanSnippet).filter(Boolean),
      sequence: cleanSequence(req.body.sequence),
      renders: [],
      job: null,
    });
    await saveEpisode(ep);
    res.json({ episode: ep });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// The episode doc PLUS a word-tokenized transcript window per source, so the
// picker page never has to fetch the whole interview.
router.get('/:id', async (req, res) => {
  try {
    const ep = await loadEpisode(req.params.id);
    if (!ep) return res.status(404).json({ error: 'not found' });
    const transcripts = [];
    for (const src of ep.sources) {
      let video = null;
      try { video = await loadVideo(src.videoId); } catch (err) { /* transcript optional */ }
      const win = video ? windowTokens(video.transcript, src.timeSec) : { start: 0, end: 0, words: [], times: [] };
      transcripts.push({
        videoId: src.videoId,
        experiencer: src.experiencer,
        title: (video && video.title) || '',
        timeSec: src.timeSec,
        ...win,
      });
    }
    res.json({ episode: ep, transcripts });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const ep = await loadEpisode(req.params.id);
    if (!ep) return res.status(404).json({ error: 'not found' });
    if (req.body.title != null) ep.title = String(req.body.title).trim() || ep.title;
    if (req.body.sources) ep.sources = req.body.sources.map(cleanSource).filter(Boolean);
    if (req.body.snippets) ep.snippets = req.body.snippets.map(cleanSnippet).filter(Boolean);
    if (req.body.sequence) ep.sequence = cleanSequence(req.body.sequence);
    await saveEpisode(ep);
    res.json({ episode: ep });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await deleteEpisode(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/render', async (req, res) => {
  try {
    const ep = await loadEpisode(req.params.id);
    if (!ep) return res.status(404).json({ error: 'not found' });
    if (req.body && Array.isArray(req.body.sequence)) ep.sequence = cleanSequence(req.body.sequence);
    await startJob(ep, 'render', progress => renderEpisode(ep, progress));
    res.json({ ok: true, job: ep.job });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/:id/job', async (req, res) => {
  try {
    const ep = await loadEpisode(req.params.id);
    if (!ep) return res.status(404).json({ error: 'not found' });
    res.json({ job: ep.job || null, renders: ep.renders || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = {
  router,
  // exported for tests / other tools
  phraseSpan, clampBounds, snapToSilence, ratio, normWords, windowTokens,
};
