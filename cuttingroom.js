// cuttingroom.js — the Cutting Room: mark one of Sophie's OWN recordings on
// its TRANSCRIPT (never a waveform), cut the pauses out of it, and slice
// sections off to save or send on. The hallway between Voice Memos and the
// rooms that use her voice.
//
// Why text, not a waveform: every recording is transcribed with word
// timestamps on open, so a tap on a word IS a position in the audio — and a
// tap never needs to be precise, because both edges of every cut are snapped
// into the real silences next to the tapped words by the Episode Editor's own
// validated cutter (clampBounds + detectSilences + snapToSilence, imported
// from editor.js — identical cuts, one implementation). Designed around
// Sophie's wrist (tendinitis): everything is a tap, nothing drags or scrubs.
//
// Pause detection is the vo-remove-pauses.js algorithm (see that script's
// header + docs/nde-precise-cutting.md "Noisy pauses"): breath/mouth/room
// noise sits only 4-7dB under quiet speech, so NO absolute silence threshold
// finds those pauses. Pass 1 finds them by WORD TIMING + relative energy
// (inflated word spans / inter-word gaps, 20ms RMS profile, sustained-energy
// veto); pass 2 finds room-tone runs against the file's own floor. Detection
// only — nothing is removed until Sophie taps a pause chip (or Tighten), and
// a removed pause is COMPRESSED to ~KEEP seconds, never deleted outright.
//
// HER VOICE IS NEVER LOUDNORMED. Sophie A/B'd levelled narration in the
// Episode Editor and rejected the dynamic squeezing — so renders and clips
// here are cuts of the original bytes (micro-fades on clip edges only). A
// section sent to the Episode Editor goes as WORDS + an anchor (the editor
// re-cuts it natively through its own pipeline); a section sent to the Story
// Room is cut here and attached as the beat's voice take.
//
// Data: one Firestore doc per recording (`forge-cutroom`, deckfactory),
// content-addressed by a hash of the audio URL so reopening the same
// recording resumes the same project. Word timestamps live in Storage
// (`cutroom/<id>/words.json`) — a long narration's words would bloat the doc.
// Every slow step is a background job on the doc (house rule); the page polls
// and resumes from localStorage.
//
// A "manual mode" (cut at the exact tapped millisecond, no snapping) is
// PARKED by request — Sophie wants it eventually, not in v1.
//
// Routes (mounted at /api/cutroom, STUDIO_TOKEN gate, only /status open):
//   GET  /status            → { ok, firebase, ffmpeg, openai }
//   GET  /sources           → recordings to open (forge-audio, newest first,
//                             each with its projectId) + existing projects
//   GET  /                  → { projects } (trimmed list)
//   POST /open              → { url, name?, itemId?, batch? } → { id } —
//                             creates/resumes the project; first open starts
//                             the listen job (transcribe + pause detection)
//   GET  /:id               → the doc (words fetched by the page from wordsUrl)
//   POST /:id/pause         → { i, removed } — toggle one pause chip
//   POST /:id/tighten       → { removed? } — set every pause at once
//   POST /:id/pin           → { wi, t } — toggle a MARK pin at word wi
//   POST /:id/cutout        → { wi0, wi1 } — cut a word-span out of the render
//   POST /:id/uncut         → { cutId } — restore a cut-out span
//   POST /:id/section       → { wi0, wi1, action:'save'|'story'|'editor', … }
//                             save → clip file + forge-audio 'cutting-room'
//                             story → clip file + beat voice (padId, beatId)
//                             editor → snippet card (episodeId | episodeTitle)
//   POST /:id/render        → bake pauses+cutouts into a fresh file (job)
//   GET  /:id/job           → { job }
//   DELETE /:id             → remove the project (Storage files stay)

const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const admin = require('firebase-admin');

const editor = require('./editor');
const scratchpad = require('./scratchpad');
const audioDrop = require('./audio'); // COL, BATCHES, slug — the clip filing target

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const COL = process.env.CUTROOM_COLLECTION || 'forge-cutroom';
const NDE_COLLECTION = process.env.NDE_COLLECTION || 'forge-nde-videos';
const STORAGE_FOLDER = 'cutroom';
const CLIP_BATCH = 'cutting-room';   // where saved clips land in the audio library
const KEEP = 0.28;                   // a removed pause is compressed to ~this, never deleted
const MAX_SECONDS = 5400;            // 90 min — beyond this, ask for the recording in parts
const MAX_RENDERS = 8;
const MAX_CLIPS = 30;

// ffmpeg / ffprobe: static npm binaries first, then PATH (same as editor.js).
function tryRequire(name) { try { return require(name); } catch { return null; } }
function firstOnPath(bin) {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const p = path.join(dir, bin);
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { /* keep looking */ }
  }
  return null;
}
function usable(p) { if (!p) return null; try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { return null; } }
const FFMPEG = process.env.FFMPEG_PATH || usable(tryRequire('ffmpeg-static')) || firstOnPath('ffmpeg');

function db() { return admin.apps.length ? admin.firestore() : null; }
function bucket() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}
function fail(res, err) {
  console.warn('cutroom:', err.message);
  res.status(500).json({ error: err.message });
}
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
const projectId = (url) => crypto.createHash('sha1').update(String(url)).digest('hex').slice(0, 16);
const nowIso = () => new Date().toISOString();

// ─── doc helpers ────────────────────────────────────────────────────
async function loadDoc(id) {
  const d = db();
  if (!d) throw new Error('Firebase unavailable');
  const snap = await d.collection(COL).doc(id).get();
  return snap.exists ? snap.data() : null;
}
async function patchDoc(id, fields) {
  await db().collection(COL).doc(id).update({ ...JSON.parse(JSON.stringify(fields)), updatedAt: Date.now() });
}
// Read-modify-write one field inside a transaction, so a pause toggle can
// never clobber a concurrent edit.
async function txField(id, field, fn) {
  const ref = db().collection(COL).doc(id);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('no such recording');
    const value = fn(snap.data()[field], snap.data());
    tx.update(ref, { [field]: JSON.parse(JSON.stringify(value)), updatedAt: Date.now() });
    return value;
  });
}

// ─── words (Storage-side — a long narration's words would bloat the doc) ──
const wordsCache = new Map(); // id → words[] (small in-process cache)
function wordsPathFor(id) { return `${STORAGE_FOLDER}/${id}/words.json`; }
async function saveWords(id, words) {
  const b = bucket();
  const file = b.file(wordsPathFor(id));
  await file.save(Buffer.from(JSON.stringify({ v: 1, words })), {
    metadata: { contentType: 'application/json', cacheControl: 'no-cache' },
    resumable: false,
  });
  await file.makePublic();
  wordsCache.set(id, words);
  if (wordsCache.size > 4) wordsCache.delete(wordsCache.keys().next().value);
  return `https://storage.googleapis.com/${b.name}/${wordsPathFor(id)}`;
}
async function loadWords(id) {
  if (wordsCache.has(id)) return wordsCache.get(id);
  const [buf] = await bucket().file(wordsPathFor(id)).download();
  const words = (JSON.parse(buf.toString('utf8')).words || []);
  wordsCache.set(id, words);
  if (wordsCache.size > 4) wordsCache.delete(wordsCache.keys().next().value);
  return words;
}

// ─── background jobs (editor.js startJob pattern, on this collection) ──
async function startJob(id, kind, fn) {
  const doc = await loadDoc(id);
  if (!doc) throw new Error('no such recording');
  if (doc.job && doc.job.status === 'running') {
    const age = Date.now() - new Date(doc.job.startedAt || 0).getTime();
    if (age < 20 * 60 * 1000) throw new Error(`a "${doc.job.kind}" job is already running`);
  }
  const job = { kind, status: 'running', done: 0, total: 0, label: 'starting', error: null, startedAt: nowIso() };
  await patchDoc(id, { job });
  (async () => {
    let lastSave = 0;
    const progress = async (done, total, label) => {
      Object.assign(job, { done, total, label });
      if (Date.now() - lastSave > 1500) {
        lastSave = Date.now();
        await patchDoc(id, { job }).catch(() => {});
      }
    };
    try {
      await fn(progress);
      Object.assign(job, { status: 'done', label: 'done' });
    } catch (err) {
      console.warn(`cutroom: job ${kind} failed —`, err.message);
      Object.assign(job, { status: 'error', error: err.message });
      if (kind === 'listen') await patchDoc(id, { status: 'failed', error: err.message }).catch(() => {});
    }
    await patchDoc(id, { job }).catch((e) => console.warn('cutroom: save failed —', e.message));
  })();
}

// ─── audio plumbing ─────────────────────────────────────────────────
async function downloadTo(url, file) {
  const res = await fetch(url, { redirect: 'follow', timeout: 600000 });
  if (!res.ok) throw new Error(`audio fetch ${res.status}`);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(file);
    res.body.pipe(out);
    res.body.on('error', reject);
    out.on('finish', resolve);
    out.on('error', reject);
  });
  return file;
}

// Chunked whisper word timestamps — 75s chunks (the vo-remove-pauses finding:
// short files keep whisper honest; full-file passes drop stretches and invent
// phantom gaps on long recordings).
async function chunkedWords(localFile, dur, dir, progress) {
  const all = [];
  const total = Math.max(1, Math.ceil(dur / 75));
  let n = 0;
  for (let s = 0; s < dur; s += 75) {
    n += 1;
    if (progress) await progress(n, total, `listening — part ${n} of ${total}`);
    const chunk = path.join(dir, 'chunk.mp3');
    await run(FFMPEG, ['-y', '-ss', String(s), '-t', '75', '-i', localFile, '-c:a', 'libmp3lame', '-q:a', '3', chunk], 180000);
    for (const w of await editor.whisperWords(chunk)) {
      all.push({ word: w.word, start: Math.round((w.start + s) * 100) / 100, end: Math.round((w.end + s) * 100) / 100 });
    }
  }
  return all;
}

// 20ms RMS profile, folded STREAMING off the decoded PCM file — an hour of
// 16k s16le is ~115MB, and reading that into one Buffer on the 512MB free
// instance is how jobs die silently. The profile itself is ~700KB.
async function rmsProfile(localFile, dir) {
  const raw = path.join(dir, 'prof.pcm');
  await run(FFMPEG, ['-y', '-i', localFile, '-f', 's16le', '-ac', '1', '-ar', '16000', raw], 420000);
  const BIN = 320; // 20ms @ 16k
  const bins = [];
  await new Promise((resolve, reject) => {
    let acc = 0;
    let count = 0;
    let carry = null;
    const stream = fs.createReadStream(raw, { highWaterMark: 1 << 16 });
    stream.on('data', (buf) => {
      if (carry) { buf = Buffer.concat([carry, buf]); carry = null; }
      const usableBytes = buf.length - (buf.length % 2);
      if (usableBytes < buf.length) carry = buf.slice(usableBytes);
      for (let o = 0; o + 1 < usableBytes; o += 2) {
        const v = buf.readInt16LE(o) / 32768;
        acc += v * v;
        count += 1;
        if (count === BIN) {
          bins.push(10 * Math.log10(acc / BIN + 1e-10));
          acc = 0; count = 0;
        }
      }
    });
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  fs.unlink(raw, () => {});
  return Float32Array.from(bins);
}

// ─── pause detection (vo-remove-pauses.js passes, detection-only) ───
// Pass 1: breath pauses by word timing + relative energy. A loud TRANSIENT
// inside a pause (a phone set down) must not veto the cut — only SUSTAINED
// speech-level audio does — and the pause's end comes from sustained energy
// resume, not the next word's whisper start (whisper inflates that backward).
function breathCuts(words, prof, speechRef) {
  const sustained = (i, thr, k) => {
    for (let j = 0; j < k; j++) { if (i + j >= prof.length || prof[i + j] <= thr) return false; }
    return true;
  };
  const thr = speechRef - 7;
  const raw = [];
  for (let i = 0; i < words.length - 1; i++) {
    const w = words[i]; const nx = words[i + 1];
    const inflated = (w.end - w.start) > 0.55 + 0.07 * w.word.length;
    const nxInflated = (nx.end - nx.start) > 0.55 + 0.07 * nx.word.length;
    if ((nx.start - w.end) < 0.4 && !inflated && !nxInflated) continue;
    const a = Math.round(w.start / 0.02);
    const b = Math.min(prof.length - 1, Math.round(Math.min(nx.end, w.start + 10) / 0.02));
    if ((b - a) * 0.02 < 0.5) continue;
    let se = a;
    for (let j = a; j < b; j++) {
      if (prof[j] > thr && (j - a) * 0.02 < 1.2) se = j;
      else if ((j - a) * 0.02 >= 1.2) break;
    }
    let rs = -1;
    for (let j = se + Math.round(0.25 / 0.02); j < b; j++) if (sustained(j, thr, 8)) { rs = j; break; }
    if (rs === -1) continue;
    const cs = se * 0.02 + 0.10; const ce = rs * 0.02 - 0.10;
    if (ce - cs < 0.35) continue;
    let veto = false;
    for (let j = Math.round(cs / 0.02); j < Math.round(ce / 0.02); j++) if (sustained(j, thr, 10)) { veto = true; break; }
    if (veto) continue;
    raw.push([cs + KEEP / 2, ce - KEEP / 2]);
  }
  return raw;
}
// Pass 2: room-tone runs against the file's own floor. Run on the ORIGINAL
// profile here (the script ran it on the already-cut file) so every range
// stays in original-file time; overlaps with pass 1 merge below.
function roomToneCuts(prof) {
  const sorted = [...prof].sort((a, b) => a - b);
  const floor = sorted[Math.floor(prof.length * 0.08)];
  const cuts = []; let s = -1;
  for (let i = 0; i < prof.length; i++) {
    if (prof[i] < floor + 4) { if (s < 0) s = i; } else {
      if (s >= 0 && (i - s) * 0.02 >= 0.45) cuts.push([s * 0.02 + KEEP / 2, i * 0.02 - KEEP / 2]);
      s = -1;
    }
  }
  if (s >= 0 && (prof.length - s) * 0.02 >= 0.45) cuts.push([s * 0.02 + KEEP / 2, prof.length * 0.02 - KEEP / 2]);
  return cuts.filter(([a, b]) => b - a > 0.05);
}
// Merge overlapping ranges — adjacent inflated words flag the SAME pause, and
// unmerged overlaps double-count removal and corrupt the timing arithmetic.
function mergeRanges(ranges) {
  const sorted = ranges.filter(([a, b]) => b - a > 0.05).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const c of sorted) {
    if (out.length && c[0] <= out[out.length - 1][1] + 0.05) {
      out[out.length - 1][1] = Math.max(out[out.length - 1][1], c[1]);
    } else out.push([c[0], c[1]]);
  }
  return out;
}

// Remove `cuts` ([start,end] in original time) from the file in ONE ffmpeg
// filtergraph (atrim + concat) — the validated vo-remove-pauses apply step.
// No loudnorm anywhere: her voice keeps its own dynamics.
async function applyCuts(inFile, cuts, outFile, dur) {
  if (!cuts.length) {
    await run(FFMPEG, ['-y', '-i', inFile, '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-q:a', '2', outFile], 420000);
    return;
  }
  const segs = []; let cur = 0;
  for (const [s, e] of cuts) {
    if (s - cur > 0.02) segs.push([cur, s]);
    cur = Math.max(cur, e);
  }
  if (dur - cur > 0.02) segs.push([cur, dur]);
  if (!segs.length) throw new Error('nothing would be left after these cuts');
  const parts = segs.map((sg, i) => `[0:a]atrim=start=${sg[0].toFixed(3)}:end=${sg[1].toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`).join(';');
  const graph = `${parts};${segs.map((_, i) => `[a${i}]`).join('')}concat=n=${segs.length}:v=0:a=1[out]`;
  await run(FFMPEG, ['-y', '-i', inFile, '-filter_complex', graph, '-map', '[out]', '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-q:a', '2', outFile], 600000);
}

// ─── the listen job: transcribe + find the pauses ───────────────────
async function runListen(id, progress) {
  if (!FFMPEG) throw new Error('ffmpeg unavailable');
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  const doc = await loadDoc(id);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cutroom-'));
  try {
    await progress(0, 1, 'fetching the recording');
    const local = path.join(dir, 'src');
    await downloadTo(doc.source.url, local);
    const dur = await editor.audioDuration(local);
    if (!dur || dur < 1) throw new Error("couldn't read the recording's length");
    if (dur > MAX_SECONDS) throw new Error(`recording is ${Math.round(dur / 60)} min — the Cutting Room caps at ${MAX_SECONDS / 60}`);

    const words = await chunkedWords(local, dur, dir, progress);
    if (!words.length) throw new Error('no speech found in the recording');

    await progress(0, 1, 'finding the pauses');
    const prof = await rmsProfile(local, dir);
    const sortedRef = [...prof].sort((a, b) => a - b);
    const speechRef = sortedRef[Math.floor(prof.length * 0.85)];
    const merged = mergeRanges([...breathCuts(words, prof, speechRef), ...roomToneCuts(prof)]);
    const pauses = merged.map(([s, e]) => ({
      s: Math.round(s * 100) / 100,
      e: Math.round(e * 100) / 100,
      sec: Math.round((e - s + KEEP) * 10) / 10,
      removed: false,
    }));

    const wordsUrl = await saveWords(id, words);
    await patchDoc(id, {
      status: 'ready', error: null, seconds: Math.round(dur * 10) / 10,
      wordsUrl, wordsPath: wordsPathFor(id), wordCount: words.length, pauses,
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ─── cutting one section (save / story) ─────────────────────────────
// The stored words come from the 75s-CHUNKED whole-recording pass — accurate
// enough to place pause chips, NOT accurate enough to cut on (Sophie's first
// clip started at "yeah" and grabbed the "he said" before it: the bulk pass
// had timed "yeah" early). So the cut RE-LISTENS to a small window with a
// fresh whisper pass and locates the section's words in THOSE timestamps —
// the exact buildClip pipeline the Episode Editor's precision comes from —
// then clampBounds + snapToSilence as before. The bulk timings survive only
// as the fallback when the fresh listen can't find the phrase.
// Micro-fades only; no loudnorm (her voice).
async function cutSection(doc, words, wi0, wi1, dir) {
  const text = words.slice(wi0, wi1 + 1).map((w) => w.word).join(' ');
  const [t0raw, t1raw] = editor.clampBounds(words, wi0, wi1);
  const winStart = Math.max(0, t0raw - 6);
  const winDur = (t1raw - t0raw) + 12;
  const win = path.join(dir, 'win.mp3');
  await editor.extractWindow(doc.source.url, winStart, winDur, win, { downloads: new Map(), dir, log: [] });

  let rs; let re; let maxEndRel;
  let fresh = null;
  try {
    const w2 = await editor.whisperWords(win);
    const span = editor.phraseSpan(w2, text);
    if (span) {
      [rs, re] = editor.clampBounds(w2, span.start, span.end);
      const nxt2 = w2.find((w) => w.start > re + 0.02);
      maxEndRel = nxt2 ? nxt2.start : null;
      fresh = true;
    }
  } catch (err) {
    console.warn('cutroom: fresh listen failed —', err.message);
  }
  if (!fresh) {
    rs = t0raw - winStart; re = t1raw - winStart;
    const nxt = words.find((w) => w.start > t1raw + 0.02);
    maxEndRel = nxt ? nxt.start - winStart : null;
  }

  const silences = await editor.detectSilences(win);
  [rs, re] = editor.snapToSilence(rs, re, silences, maxEndRel);
  rs = Math.max(0, rs); re = Math.min(winDur, re);
  const cut = path.join(dir, 'cut.mp3');
  await run(FFMPEG, ['-y', '-ss', String(rs), '-to', String(re), '-i', win, '-c:a', 'libmp3lame', '-q:a', '3', cut], 180000);
  const out = path.join(dir, 'clip.mp3');
  await run(FFMPEG, ['-y', '-i', cut, '-af',
    'afade=t=in:d=0.03,areverse,afade=t=in:d=0.10,areverse',
    '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-q:a', '2', out], 180000);
  return { file: out, seconds: Math.round((re - rs) * 10) / 10, t0: winStart + rs, t1: winStart + re, fresh: !!fresh };
}

// File a finished audio file into the audio library (forge-audio, batch
// 'cutting-room') so it shows on /audio next to everything else. The doc
// points at the cutroom Storage object — no second copy of the bytes. Dedupe
// by content hash, same contract as audio.js storeOne.
async function fileIntoAudioLibrary({ buf, url, storagePath, name, seconds }) {
  const d = db();
  const hash = crypto.createHash('md5').update(buf).digest('hex');
  const dup = await d.collection(audioDrop.COL).where('hash', '==', hash).limit(1).get();
  if (!dup.empty) return { id: dup.docs[0].id, duplicate: true };
  const batchRef = d.collection(audioDrop.BATCHES).doc(CLIP_BATCH);
  const seq = await d.runTransaction(async (tx) => {
    const snap = await tx.get(batchRef);
    const now = Date.now();
    const next = (snap.exists ? Number(snap.get('count')) || 0 : 0) + 1;
    tx.set(batchRef, {
      batch: CLIP_BATCH, count: next,
      createdAt: (snap.exists && snap.get('createdAt')) || now, updatedAt: now,
    }, { merge: true });
    return next;
  });
  const now = Date.now();
  const ref = await d.collection(audioDrop.COL).add({
    batch: CLIP_BATCH, seq, name, url, storagePath, hash,
    filename: null, mime: 'audio/mpeg', ext: 'mp3', bytes: buf.length,
    seconds: seconds || null, notes: null, tags: [], track: 'cutroom',
    status: 'new', createdAt: now, updatedAt: now,
  });
  return { id: ref.id, duplicate: false };
}

// The editor shows a source's transcript from forge-nde-videos — give this
// recording a doc there (segments grouped from our words) so a handed-off
// snippet has a transcript window to stand in, and future snippets can be
// picked from the same recording inside the editor itself.
async function ensureNdeDoc(doc, words) {
  const videoId = `cr-${doc.id}`;
  const ref = db().collection(NDE_COLLECTION).doc(videoId);
  const snap = await ref.get();
  if (snap.exists) return videoId;
  const segments = [];
  let seg = null;
  for (const w of words) {
    if (!seg || (w.start - seg.start) > 8) {
      if (seg) segments.push(seg);
      seg = { start: Math.round(w.start * 10) / 10, text: w.word };
    } else seg.text += ` ${w.word}`;
    seg.end = Math.round(w.end * 10) / 10;
  }
  if (seg) segments.push(seg);
  await ref.set({
    videoId, url: doc.source.url, title: doc.title,
    experiencerName: 'Sophie', channelTitle: 'Cutting Room', source: 'cutting-room',
    transcript: { segments, full: words.map((w) => w.word).join(' '), autoGenerated: false },
    status: 'transcribed', createdAt: nowIso(),
  });
  return videoId;
}

// ─── router ─────────────────────────────────────────────────────────
const router = express.Router();
router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '2mb' }));

router.get('/status', (req, res) => {
  res.json({ ok: true, firebase: admin.apps.length > 0, ffmpeg: !!FFMPEG, openai: !!OPENAI_API_KEY });
});

const trimmed = (p) => ({
  id: p.id, title: p.title, status: p.status, seconds: p.seconds || null,
  pauses: (p.pauses || []).length,
  removed: (p.pauses || []).filter((x) => x.removed).length,
  cuts: (p.cuts || []).length, clips: (p.clips || []).length,
  renders: (p.renders || []).length, updatedAt: p.updatedAt || 0,
});

// Recordings that can be opened — the audio drop, newest first (that's the
// share-sheet path every recording already takes off her phone).
router.get('/sources', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const d = db();
    if (!d) return res.json({ items: [], projects: {} });
    const snap = await d.collection(audioDrop.COL).orderBy('createdAt', 'desc').limit(80).get();
    const items = snap.docs
      .map((s) => ({ itemId: s.id, ...s.data() }))
      .filter((x) => x.url && x.batch !== CLIP_BATCH) // a saved clip isn't a source
      .map((x) => ({
        itemId: x.itemId, name: x.name, batch: x.batch,
        seconds: x.seconds || null, url: x.url, createdAt: x.createdAt,
        projectId: projectId(x.url),
      }));
    const psnap = await d.collection(COL).get();
    const projects = {};
    psnap.docs.forEach((s) => { projects[s.id] = trimmed(s.data()); });
    res.json({ items, projects });
  } catch (err) { fail(res, err); }
});

router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const snap = await db().collection(COL).get();
    const projects = snap.docs.map((s) => trimmed(s.data()))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    res.json({ projects });
  } catch (err) { fail(res, err); }
});

router.post('/open', async (req, res) => {
  try {
    const url = String(req.body.url || '').trim();
    if (!/^https:\/\//.test(url)) return res.status(400).json({ error: 'a recording url is required' });
    const id = projectId(url);
    const existing = await loadDoc(id);
    if (existing && existing.status === 'ready') return res.json({ id, status: 'ready' });
    if (existing && existing.status === 'processing' && existing.job && existing.job.status === 'running') {
      return res.json({ id, status: 'processing' });
    }
    // Strip the iOS share extension's `UUID() + filename` staging prefix if a
    // caller passes it through — the id is not part of the recording's name.
    const cleanName = String(req.body.name || 'Recording')
      .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[-_ ]*/i, '')
      .trim() || 'Recording';
    const doc = existing || {
      id, title: cleanName.slice(0, 120),
      source: { url, itemId: req.body.itemId || null, batch: req.body.batch || null },
      seconds: null, status: 'processing', pauses: [], cuts: [], pins: [],
      clips: [], renders: [], job: null, createdAt: Date.now(), updatedAt: Date.now(),
    };
    doc.status = 'processing';
    doc.error = null;
    await db().collection(COL).doc(id).set(JSON.parse(JSON.stringify(doc)), { merge: true });
    await startJob(id, 'listen', (progress) => runListen(id, progress));
    res.json({ id, status: 'processing' });
  } catch (err) { fail(res, err); }
});

router.get('/:id', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such recording' });
    res.json(doc);
  } catch (err) { fail(res, err); }
});

// The words come THROUGH the API, not straight off Storage — a browser
// fetch() of storage.googleapis.com JSON is CORS-blocked (images/audio tags
// aren't, which is why everything else reads Storage directly). Server-wide
// gzip keeps this small on the wire.
router.get('/:id/words', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such recording' });
    if (doc.status !== 'ready') return res.json({ words: [] });
    res.json({ words: await loadWords(req.params.id) });
  } catch (err) { fail(res, err); }
});

// A clip or render as a same-origin ATTACHMENT — the Storage URL alone just
// plays inline, so "download to my phone" needs this: Safari's download
// manager takes the disposition, and the app's share bridge fetches the same
// bytes. `u` must be one of THIS recording's own Storage files.
router.get('/:id/file', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such recording' });
    let p = '';
    try {
      p = decodeURIComponent(new URL(String(req.query.u || '')).pathname).replace(/^\/[^/]+\//, '');
    } catch { /* not a url */ }
    if (!p.startsWith(`${STORAGE_FOLDER}/${req.params.id}/`)) {
      return res.status(400).json({ error: "not this recording's file" });
    }
    const name = String(req.query.n || 'clip')
      .replace(/[^a-zA-Z0-9 \-_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'clip';
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Disposition', `attachment; filename="${name}.mp3"`);
    bucket().file(p).createReadStream()
      .on('error', (e) => { console.warn('cutroom: download stream —', e.message); try { res.destroy(); } catch { /* closed */ } })
      .pipe(res);
  } catch (err) { fail(res, err); }
});

router.get('/:id/job', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such recording' });
    res.json({ job: doc.job || null });
  } catch (err) { fail(res, err); }
});

router.post('/:id/pause', async (req, res) => {
  try {
    const i = Number(req.body.i);
    const removed = !!req.body.removed;
    const pauses = await txField(req.params.id, 'pauses', (cur) => {
      const list = Array.isArray(cur) ? cur : [];
      if (!list[i]) throw new Error('no such pause');
      list[i].removed = removed;
      return list;
    });
    res.json({ ok: true, pauses });
  } catch (err) { fail(res, err); }
});

router.post('/:id/tighten', async (req, res) => {
  try {
    const removed = req.body.removed === false ? false : true;
    const pauses = await txField(req.params.id, 'pauses', (cur) => {
      (Array.isArray(cur) ? cur : []).forEach((p) => { p.removed = removed; });
      return cur || [];
    });
    res.json({ ok: true, pauses });
  } catch (err) { fail(res, err); }
});

router.post('/:id/pin', async (req, res) => {
  try {
    const wi = Number(req.body.wi);
    if (!Number.isFinite(wi)) return res.status(400).json({ error: 'word index required' });
    const pins = await txField(req.params.id, 'pins', (cur) => {
      const list = Array.isArray(cur) ? cur : [];
      const at = list.findIndex((p) => p.wi === wi);
      if (at >= 0) list.splice(at, 1);
      else list.push({ wi, t: Number(req.body.t) || 0 });
      return list;
    });
    res.json({ ok: true, pins });
  } catch (err) { fail(res, err); }
});

router.post('/:id/cutout', async (req, res) => {
  try {
    const wi0 = Number(req.body.wi0); const wi1 = Number(req.body.wi1);
    if (!Number.isFinite(wi0) || !Number.isFinite(wi1) || wi1 < wi0) {
      return res.status(400).json({ error: 'a word range is required' });
    }
    const words = await loadWords(req.params.id);
    if (wi1 >= words.length) return res.status(400).json({ error: 'range past the end' });
    const [s, e] = editor.clampBounds(words, wi0, wi1);
    const cut = {
      id: `c-${crypto.randomBytes(4).toString('hex')}`,
      wi0, wi1, s: Math.round(s * 100) / 100, e: Math.round(e * 100) / 100,
      text: words.slice(wi0, wi1 + 1).map((w) => w.word).join(' ').slice(0, 200),
    };
    const cuts = await txField(req.params.id, 'cuts', (cur) => (Array.isArray(cur) ? cur : []).concat([cut]));
    res.json({ ok: true, cut, cuts });
  } catch (err) { fail(res, err); }
});

router.post('/:id/uncut', async (req, res) => {
  try {
    const cutId = String(req.body.cutId || '');
    const cuts = await txField(req.params.id, 'cuts', (cur) => (Array.isArray(cur) ? cur : []).filter((c) => c.id !== cutId));
    res.json({ ok: true, cuts });
  } catch (err) { fail(res, err); }
});

// Take a section and save it / send it on. 'editor' is two Firestore writes
// (the editor re-cuts natively from words + anchor) and answers inline;
// 'save' and 'story' cut real audio, so they run as a background job.
router.post('/:id/section', async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await loadDoc(id);
    if (!doc) return res.status(404).json({ error: 'no such recording' });
    if (doc.status !== 'ready') return res.status(400).json({ error: 'recording is still processing' });
    const wi0 = Number(req.body.wi0); const wi1 = Number(req.body.wi1);
    if (!Number.isFinite(wi0) || !Number.isFinite(wi1) || wi1 < wi0) {
      return res.status(400).json({ error: 'a word range is required' });
    }
    const action = String(req.body.action || 'save');
    const words = await loadWords(id);
    if (wi1 >= words.length) return res.status(400).json({ error: 'range past the end' });
    const sliceText = words.slice(wi0, wi1 + 1).map((w) => w.word).join(' ');
    const name = String(req.body.name || '').trim()
      || `${sliceText.split(/\s+/).slice(0, 6).join(' ')}${wi1 - wi0 > 5 ? '…' : ''}`;

    if (action === 'editor') {
      const videoId = await ensureNdeDoc(doc, words);
      const result = await editor.addExternalSnippet({
        episodeId: req.body.episodeId || null,
        episodeTitle: req.body.episodeTitle || `${doc.title} — cuts`,
        name, videoId, audioUrl: doc.source.url,
        text: sliceText, timeSec: words[wi0].start, experiencer: 'Sophie',
      });
      const entry = {
        id: `k-${crypto.randomBytes(4).toString('hex')}`, name,
        sec: Math.round((words[wi1].end - words[wi0].start) * 10) / 10,
        url: null, at: Date.now(), dest: 'editor',
        episodeId: result.id, episodeTitle: result.title,
      };
      await txField(id, 'clips', (cur) => (Array.isArray(cur) ? cur : []).concat([entry]).slice(-MAX_CLIPS));
      return res.json({ ok: true, dest: 'editor', episode: result });
    }

    if (action === 'story' && (!req.body.padId || !req.body.beatId)) {
      return res.status(400).json({ error: 'padId and beatId are required' });
    }

    await startJob(id, 'section', async (progress) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cutroom-'));
      try {
        await progress(0, 1, `cutting "${name}"`);
        const clip = await cutSection(doc, words, wi0, wi1, dir);
        const storagePath = `${STORAGE_FOLDER}/${id}/clip-${Date.now()}.mp3`;
        const url = await editor.uploadPublic(clip.file, storagePath, 'audio/mpeg');
        const entry = {
          id: `k-${crypto.randomBytes(4).toString('hex')}`, name,
          sec: clip.seconds, url, at: Date.now(), dest: action,
          wi0, wi1,   // the picked span — what makes a clip re-cuttable later
        };
        if (action === 'story') {
          await progress(0, 1, 'attaching to the beat');
          await scratchpad.attachVoiceUrl(String(req.body.padId), String(req.body.beatId), url);
          entry.padId = String(req.body.padId);
          entry.beatId = String(req.body.beatId);
        } else {
          await fileIntoAudioLibrary({
            buf: fs.readFileSync(clip.file), url, storagePath,
            name: `${doc.title} — ${name}`, seconds: clip.seconds,
          });
        }
        await txField(id, 'clips', (cur) => (Array.isArray(cur) ? cur : []).concat([entry]).slice(-MAX_CLIPS));
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
    res.json({ ok: true, dest: action, status: 'cutting' });
  } catch (err) { fail(res, err); }
});

// Bake the marked edits — removed pauses + cut-out sections — into a fresh
// file. Section edges are re-snapped into real silences against the whole
// file first. The original recording is never touched; every render is a new
// file, old renders stay.
router.post('/:id/render', async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await loadDoc(id);
    if (!doc) return res.status(404).json({ error: 'no such recording' });
    if (doc.status !== 'ready') return res.status(400).json({ error: 'recording is still processing' });
    const removedPauses = (doc.pauses || []).filter((p) => p.removed);
    const cutouts = doc.cuts || [];
    if (!removedPauses.length && !cutouts.length) {
      return res.status(400).json({ error: 'no edits to render yet' });
    }
    await startJob(id, 'render', async (progress) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cutroom-'));
      try {
        await progress(0, 3, 'fetching the recording');
        const local = path.join(dir, 'src');
        await downloadTo(doc.source.url, local);
        const dur = await editor.audioDuration(local);
        await progress(1, 3, 'placing the cuts');
        const words = await loadWords(id);
        const silences = await editor.detectSilences(local);
        const ranges = removedPauses.map((p) => [p.s, p.e]);
        // Cut-out edges get the same fresh-listen precision as sections (see
        // cutSection — bulk chunk timings are chips-only accuracy): re-listen
        // to a small window per cut-out and locate its words in the fresh
        // timestamps. Long spans skip it — their edges land in real silences
        // via the snap anyway, and phraseSpan wants a phrase, not a speech.
        for (const c of cutouts) {
          let t0 = c.s; let t1 = c.e;
          const nxtG = words.find((w) => w.start > c.e + 0.02);
          let maxEnd = nxtG ? nxtG.start : null;
          if (Number.isFinite(c.wi0) && Number.isFinite(c.wi1) && c.wi1 - c.wi0 <= 60) {
            try {
              const text = words.slice(c.wi0, c.wi1 + 1).map((w) => w.word).join(' ');
              const wStart = Math.max(0, c.s - 6);
              const wf = path.join(dir, `cw-${c.id}.mp3`);
              await run(FFMPEG, ['-y', '-ss', String(wStart), '-t', String((c.e - c.s) + 12), '-i', local, '-c:a', 'libmp3lame', '-q:a', '3', wf], 180000);
              const w2 = await editor.whisperWords(wf);
              const sp = editor.phraseSpan(w2, text);
              if (sp) {
                const [a, b] = editor.clampBounds(w2, sp.start, sp.end);
                t0 = wStart + a; t1 = wStart + b;
                const nxt2 = w2.find((w) => w.start > b + 0.02);
                if (nxt2) maxEnd = wStart + nxt2.start;
              }
            } catch (err) { console.warn('cutroom: cutout refine —', err.message); }
          }
          const [s, e] = editor.snapToSilence(t0, t1, silences, maxEnd);
          ranges.push([Math.max(0, s), Math.min(dur, e)]);
        }
        const merged = mergeRanges(ranges);
        const removedSec = merged.reduce((x, [a, b]) => x + (b - a), 0);
        await progress(2, 3, `cutting — ${merged.length} edits, ${Math.round(removedSec)}s removed`);
        const out = path.join(dir, 'render.mp3');
        await applyCuts(local, merged, out, dur);
        const seconds = await editor.audioDuration(out);
        const storagePath = `${STORAGE_FOLDER}/${id}/render-${Date.now()}.mp3`;
        const url = await editor.uploadPublic(out, storagePath, 'audio/mpeg');
        await fileIntoAudioLibrary({
          buf: fs.readFileSync(out), url, storagePath,
          name: `${doc.title} — cut`, seconds,
        }).catch((e) => console.warn('cutroom: library filing failed —', e.message));
        const render = {
          url, at: Date.now(), seconds: Math.round(seconds * 10) / 10,
          removed: Math.round(removedSec * 10) / 10, edits: merged.length,
        };
        await txField(id, 'renders', (cur) => [render].concat(Array.isArray(cur) ? cur : []).slice(0, MAX_RENDERS));
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
    res.json({ ok: true, status: 'rendering' });
  } catch (err) { fail(res, err); }
});

router.post('/:id/title', async (req, res) => {
  try {
    const title = String(req.body.title || '').slice(0, 120).trim();
    if (!title) return res.status(400).json({ error: 'a title is required' });
    await patchDoc(req.params.id, { title });
    res.json({ ok: true, title });
  } catch (err) { fail(res, err); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db().collection(COL).doc(req.params.id).delete();
    wordsCache.delete(req.params.id);
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

module.exports = {
  router,
  // exported for blocks.js — ONE implementation of "get word timings for this
  // recording" and "cut these words out of it properly". Both were learned
  // here the hard way (the 75s chunking, the re-listen before every real cut);
  // a second copy would drift and sound different.
  chunkedWords, cutSection, downloadTo, fileIntoAudioLibrary,
};
