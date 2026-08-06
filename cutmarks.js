// cutmarks.js — Cut Marks: mark your own cut points on a playhead — video OR
// audio, no transcript. The manual sibling of the Cutting Room: there a tap
// on a WORD is a position and the cutter snaps into silences; here the only
// authority is Sophie's eye/ear and the clock. She plays the recording, drops
// a mark where the cut goes, the marks split it into pieces she keeps or
// drops, and render bakes ONE new file — the original is never touched.
//
// Cuts are at the exact marked times (that is the point of the tool — the
// Cutting Room's parked "manual mode", grown into its own room). Audio gets
// micro-fades at each join so an exact cut never clicks; video renders in a
// single filter_complex pass (trim + concat, one encode) so there is no
// per-piece AAC priming gap at the joins (the Scratch Pad film finding —
// concatenated aac pieces walk the sound off the picture).
//
// HER VOICE IS NEVER LOUDNORMED (house rule, earned in the Episode Editor):
// renders are cuts of the original bytes.
//
// Data: one Firestore doc per media file (`forge-cutmarks`, deckfactory),
// content-addressed by a hash of the url so reopening resumes. Marks and
// dropped pieces are saved as she works (the page debounces); every slow step
// is a background job on the doc and the page polls + resumes (house rule).
//
// Routes (mounted at /api/cutmarks, STUDIO_TOKEN gate, only /status open):
//   GET  /status         → { ok, firebase, ffmpeg, ffprobe }
//   GET  /sources        → { audio, videos, projects } — the audio drop +
//                          the Dump's videos, newest first
//   GET  /               → { projects } (trimmed list)
//   POST /open           → { url, name?, kind?, itemId?, poster? } → { id } —
//                          creates/resumes; first open probes the duration
//   GET  /:id            → the doc
//   POST /:id/state      → { marks, dropped } — save the whole marking state
//   POST /:id/title      → { title }
//   POST /:id/render     → bake the dropped pieces out (background job)
//   GET  /:id/job        → { job }
//   DELETE /:id          → remove the project (Storage renders stay)

const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const admin = require('firebase-admin');

const editor = require('./editor');
const audioDrop = require('./audio');   // COL/BATCHES — source list + render filing
const dropbox = require('./dropbox');   // COL — the Dump's videos

const COL = process.env.CUTMARKS_COLLECTION || 'forge-cutmarks';
const STORAGE_FOLDER = 'cutmarks';
const CLIP_BATCH = 'cut-marks';         // where audio renders land in the audio library
const MAX_SECONDS = 5400;               // 90 min, same cap as the Cutting Room
const MAX_MARKS = 200;
const MAX_RENDERS = 8;

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
const ffprobeStatic = tryRequire('ffprobe-static');
const FFPROBE = process.env.FFPROBE_PATH || usable(ffprobeStatic && ffprobeStatic.path) || firstOnPath('ffprobe');

function db() { return admin.apps.length ? admin.firestore() : null; }
function fail(res, err) {
  console.warn('cutmarks:', err.message);
  res.status(500).json({ error: err.message });
}
function run(bin, args, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const e = new Error(`${path.basename(bin)} failed: ${(stderr || err.message).slice(-400)}`);
        reject(e);
      } else resolve({ stdout, stderr });
    });
  });
}
const projectId = (url) => crypto.createHash('sha1').update(String(url)).digest('hex').slice(0, 16);
const nowIso = () => new Date().toISOString();

async function loadDoc(id) {
  const d = db();
  if (!d) throw new Error('Firebase unavailable');
  const snap = await d.collection(COL).doc(id).get();
  return snap.exists ? snap.data() : null;
}
async function patchDoc(id, fields) {
  await db().collection(COL).doc(id).update({ ...JSON.parse(JSON.stringify(fields)), updatedAt: Date.now() });
}
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

// Background jobs — the cuttingroom.js/startJob pattern on this collection.
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
      console.warn(`cutmarks: job ${kind} failed —`, err.message);
      Object.assign(job, { status: 'error', error: err.message });
      if (kind === 'probe') await patchDoc(id, { status: 'failed', error: err.message }).catch(() => {});
    }
    await patchDoc(id, { job }).catch((e) => console.warn('cutmarks: save failed —', e.message));
  })();
}

async function downloadTo(url, file) {
  const res = await fetch(url, { redirect: 'follow', timeout: 900000 });
  if (!res.ok) throw new Error(`media fetch ${res.status}`);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(file);
    res.body.pipe(out);
    res.body.on('error', reject);
    out.on('finish', resolve);
    out.on('error', reject);
  });
  return file;
}

async function hasAudioStream(localFile) {
  if (!FFPROBE) return true; // assume audio; the graph error will say otherwise
  try {
    const { stdout } = await run(FFPROBE,
      ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', localFile], 60000);
    return /\baudio\b/.test(stdout);
  } catch { return true; }
}

// The kept pieces: marks split [0, dur]; `dropped` holds piece keys the page
// derives the same way, so a stale key (a piece since re-split) simply
// matches nothing and the piece stays kept.
function keptSegments(marks, dropped, dur) {
  const cuts = [0].concat(marks.filter((t) => t > 0.01 && t < dur - 0.01)).concat([dur]);
  const drop = new Set(dropped || []);
  const kept = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const s = cuts[i]; const e = cuts[i + 1];
    if (e - s < 0.02) continue;
    if (!drop.has(`${s.toFixed(2)}-${e.toFixed(2)}`)) kept.push([s, e]);
  }
  return kept;
}

// One filter_complex pass: trim/atrim each kept piece, concat, ONE encode.
// Video + audio together when the file has sound; frame-exact, and no
// per-piece AAC priming gap at the joins.
function videoGraph(segs, withAudio) {
  const parts = [];
  const feeds = [];
  segs.forEach(([s, e], i) => {
    parts.push(`[0:v]trim=start=${s.toFixed(3)}:end=${e.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`);
    if (withAudio) parts.push(`[0:a]atrim=start=${s.toFixed(3)}:end=${e.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`);
    feeds.push(withAudio ? `[v${i}][a${i}]` : `[v${i}]`);
  });
  const n = segs.length;
  const tail = withAudio ? `concat=n=${n}:v=1:a=1[v][a]` : `concat=n=${n}:v=1:a=0[v]`;
  return `${parts.join(';')};${feeds.join('')}${tail}`;
}

// Audio: same atrim+concat shape, with a 12ms crossfade-free micro-fade at
// each join edge so an exact manual cut never clicks. No loudnorm, channels
// and rate kept as they came.
function audioGraph(segs) {
  const parts = segs.map(([s, e], i) => {
    const d = e - s;
    const fades = `afade=t=in:st=0:d=0.012,afade=t=out:st=${Math.max(0, d - 0.012).toFixed(3)}:d=0.012`;
    return `[0:a]atrim=start=${s.toFixed(3)}:end=${e.toFixed(3)},asetpts=PTS-STARTPTS,${fades}[a${i}]`;
  }).join(';');
  return `${parts};${segs.map((_, i) => `[a${i}]`).join('')}concat=n=${segs.length}:v=0:a=1[out]`;
}

// File an audio render into the audio library (forge-audio, batch
// 'cut-marks') so it lists on /audio and feeds every downstream room. Same
// contract as the Cutting Room's filing: hash-deduped, no second byte copy.
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
  await d.collection(audioDrop.COL).add({
    batch: CLIP_BATCH, seq, name, url, storagePath, hash,
    filename: null, mime: 'audio/mpeg', ext: 'mp3', bytes: buf.length,
    seconds: seconds || null, notes: null, tags: [], track: 'cutmarks',
    status: 'new', createdAt: now, updatedAt: now,
  });
  return { duplicate: false };
}

// ─── the probe job: how long is it, does it have sound ──────────────
async function runProbe(id, progress) {
  if (!FFMPEG) throw new Error('ffmpeg unavailable');
  const doc = await loadDoc(id);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cutmarks-'));
  try {
    await progress(0, 1, 'reading the recording');
    const local = path.join(dir, 'src');
    await downloadTo(doc.source.url, local);
    const dur = await editor.audioDuration(local);
    if (!dur || dur < 0.5) throw new Error("couldn't read the recording's length");
    if (dur > MAX_SECONDS) throw new Error(`recording is ${Math.round(dur / 60)} min — Cut Marks caps at ${MAX_SECONDS / 60}`);
    const withAudio = await hasAudioStream(local);
    await patchDoc(id, {
      status: 'ready', error: null,
      seconds: Math.round(dur * 100) / 100, hasAudio: withAudio,
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ─── the render job: bake the dropped pieces out ────────────────────
async function runRender(id, progress) {
  if (!FFMPEG) throw new Error('ffmpeg unavailable');
  const doc = await loadDoc(id);
  const dur = doc.seconds;
  const marks = (doc.marks || []).slice().sort((a, b) => a - b);
  const kept = keptSegments(marks, doc.dropped || [], dur);
  if (!kept.length) throw new Error('every piece is dropped — nothing would be left');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cutmarks-'));
  try {
    await progress(0, 3, 'fetching the recording');
    const local = path.join(dir, 'src');
    await downloadTo(doc.source.url, local);
    await progress(1, 3, `cutting — keeping ${kept.length} of ${kept.length + (doc.dropped || []).length} pieces`);
    let out; let contentType; let ext;
    if (doc.kind === 'video') {
      out = path.join(dir, 'render.mp4'); contentType = 'video/mp4'; ext = 'mp4';
      const withAudio = doc.hasAudio !== false;
      const graph = videoGraph(kept, withAudio);
      const args = ['-y', '-i', local, '-filter_complex', graph, '-map', '[v]'];
      if (withAudio) args.push('-map', '[a]', '-c:a', 'aac', '-b:a', '160k');
      args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
      await run(FFMPEG, args, 1800000);
    } else {
      out = path.join(dir, 'render.mp3'); contentType = 'audio/mpeg'; ext = 'mp3';
      await run(FFMPEG, ['-y', '-i', local, '-filter_complex', audioGraph(kept),
        '-map', '[out]', '-ar', '44100', '-c:a', 'libmp3lame', '-q:a', '2', out], 900000);
    }
    await progress(2, 3, 'publishing');
    const seconds = await editor.audioDuration(out);
    const storagePath = `${STORAGE_FOLDER}/${id}/render-${Date.now()}.${ext}`;
    const url = await editor.uploadPublic(out, storagePath, contentType);
    if (doc.kind !== 'video') {
      await fileIntoAudioLibrary({
        buf: fs.readFileSync(out), url, storagePath,
        name: `${doc.title} — cut`, seconds,
      }).catch((e) => console.warn('cutmarks: library filing failed —', e.message));
    }
    const removed = Math.round((dur - kept.reduce((x, [a, b]) => x + (b - a), 0)) * 10) / 10;
    const render = {
      url, at: Date.now(), seconds: Math.round(seconds * 10) / 10,
      kept: kept.length, removed,
    };
    await txField(id, 'renders', (cur) => [render].concat(Array.isArray(cur) ? cur : []).slice(0, MAX_RENDERS));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
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
router.use(express.json({ limit: '1mb' }));

router.get('/status', (req, res) => {
  res.json({ ok: true, firebase: admin.apps.length > 0, ffmpeg: !!FFMPEG, ffprobe: !!FFPROBE });
});

const trimmed = (p) => ({
  id: p.id, title: p.title, kind: p.kind, status: p.status,
  seconds: p.seconds || null, marks: (p.marks || []).length,
  dropped: (p.dropped || []).length, renders: (p.renders || []).length,
  updatedAt: p.updatedAt || 0,
});

// What can be opened: recordings from the audio drop (the share-sheet path)
// and videos from the Dump. Newest first, each with its projectId so the
// page can show which ones already have marks.
router.get('/sources', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const d = db();
    if (!d) return res.json({ audio: [], videos: [], projects: {} });
    const asnap = await d.collection(audioDrop.COL).orderBy('createdAt', 'desc').limit(80).get();
    const audio = asnap.docs
      .map((s) => ({ itemId: s.id, ...s.data() }))
      .filter((x) => x.url && x.batch !== CLIP_BATCH && x.batch !== 'cutting-room')
      .map((x) => ({
        itemId: x.itemId, name: x.name, batch: x.batch, seconds: x.seconds || null,
        url: x.url, createdAt: x.createdAt, projectId: projectId(x.url),
      }));
    // Single equality filter, sorted in memory — no composite index needed.
    const vsnap = await d.collection(dropbox.COL).where('media', '==', 'video').limit(150).get();
    const videos = vsnap.docs
      .map((s) => ({ itemId: s.id, ...s.data() }))
      .filter((x) => x.url)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 60)
      .map((x) => ({
        itemId: x.itemId, name: x.name || x.bundleName || x.filename || 'Video',
        posterUrl: x.posterUrl || null, url: x.url, createdAt: x.createdAt,
        projectId: projectId(x.url),
      }));
    const psnap = await d.collection(COL).get();
    const projects = {};
    psnap.docs.forEach((s) => { projects[s.id] = trimmed(s.data()); });
    res.json({ audio, videos, projects });
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
    if (!/^https:\/\//.test(url)) return res.status(400).json({ error: 'a media url is required' });
    const id = projectId(url);
    const existing = await loadDoc(id);
    if (existing && existing.status === 'ready') return res.json({ id, status: 'ready' });
    if (existing && existing.status === 'processing' && existing.job && existing.job.status === 'running') {
      return res.json({ id, status: 'processing' });
    }
    const kind = req.body.kind === 'video' ? 'video' : 'audio';
    const cleanName = String(req.body.name || (kind === 'video' ? 'Video' : 'Recording'))
      .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[-_ ]*/i, '')
      .trim() || 'Recording';
    const doc = existing || {
      id, title: cleanName.slice(0, 120), kind,
      source: { url, itemId: req.body.itemId || null },
      posterUrl: req.body.poster || null,
      seconds: null, hasAudio: true, status: 'processing', error: null,
      marks: [], dropped: [], renders: [], job: null,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    doc.status = 'processing';
    doc.error = null;
    await db().collection(COL).doc(id).set(JSON.parse(JSON.stringify(doc)), { merge: true });
    await startJob(id, 'probe', (progress) => runProbe(id, progress));
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

router.get('/:id/job', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such recording' });
    res.json({ job: doc.job || null, status: doc.status, error: doc.error || null });
  } catch (err) { fail(res, err); }
});

// The whole marking state in one save — the page debounces, and marks and
// dropped pieces always change together (a new mark re-splits pieces).
router.post('/:id/state', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such recording' });
    const dur = doc.seconds || MAX_SECONDS;
    const marks = (Array.isArray(req.body.marks) ? req.body.marks : [])
      .map(Number)
      .filter((t) => Number.isFinite(t) && t > 0 && t < dur)
      .sort((a, b) => a - b)
      .slice(0, MAX_MARKS)
      .map((t) => Math.round(t * 100) / 100);
    const dropped = (Array.isArray(req.body.dropped) ? req.body.dropped : [])
      .map(String).slice(0, MAX_MARKS + 1);
    await patchDoc(req.params.id, { marks, dropped });
    res.json({ ok: true, marks: marks.length, dropped: dropped.length });
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

router.post('/:id/render', async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await loadDoc(id);
    if (!doc) return res.status(404).json({ error: 'no such recording' });
    if (doc.status !== 'ready') return res.status(400).json({ error: 'recording is still processing' });
    if (!(doc.dropped || []).length) return res.status(400).json({ error: 'no pieces dropped yet' });
    await startJob(id, 'render', (progress) => runRender(id, progress));
    res.json({ ok: true, status: 'rendering' });
  } catch (err) { fail(res, err); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db().collection(COL).doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

module.exports = { router, keptSegments, audioGraph, videoGraph };
