// filmeditor.js — Film Editor: Sophie's tap-only phone film editor, built from
// her own Claude Design canvas (docs/film-editor-design/, banked 2026-08-22).
// Page at /filmeditor, iOS tile under the FILM filter.
//
// The one surface that CUTS video. Assembly arranges whole pieces and the
// Story Room pad thinks in beats; neither can trim. Here a CUT is an ordered
// list of PIECES, and a piece is a REFERENCE into a source file — url + in +
// out. Split and trim are metadata (two references into one file, a moved
// in-point), so nothing is destructive and nothing re-uploads: the render is
// the only moment the source is actually cut. Sources arrive through the
// Dump's /api/drop/upload-file (md5 dedupe, video posters), the audio track
// through /api/audio/upload-file — bytes are never stored twice.
//
// THE RENDER IS THE SCRATCH-PAD FILM'S RECIPE (via assembly.js — the pad's
// measured finding, imported not re-learned): every piece normalized onto ONE
// canvas (the first piece's frame, evened, long edge capped 1280 — 30fps,
// setsar=1, yuv420p) as its own segment so the concat demuxer joins with
// -c copy, audio as per-segment PCM cut/padded to each segment's REAL encoded
// length, concatenated sample-exact, AAC-encoded ONCE at the mux. The trim is
// `-ss IN -to OUT` as INPUT options — source timestamps, accurate under a
// re-encode. The audio TRACK (one, with an offset — her design) is mixed at
// the mux: adelay + amix with normalize=0, because amix's default normalize
// halves both voices.
//
// A split piece shares its source url with its twin, so the job downloads and
// probes each unique URL ONCE — twelve pieces of one recording cost one
// download.
//
// Renders never overwrite — filmeditor/<id>/film-<n>.mp4, kept on the doc
// (capped 12) newest first. `filmeditor/` is on clips.js's SKIP_PREFIXES: a
// film cut FROM footage must not be harvested back onto the shelf as a clip.
//
// Routes (mounted at /api/filmeditor by server.js, STUDIO_TOKEN gate, /status open):
//   GET    /status      → { ok, firebase, ffmpeg, ffprobe, cuts }
//   GET    /            → { cuts } — trimmed list, newest touched first
//   POST   /            → { title? } → { id } — a new empty cut
//   GET    /:id         → the doc
//   POST   /:id/pieces  → { clips:[…], audio:{url,name,offset}|null } — the
//                         whole arrangement in one save (the assembly rule:
//                         order and membership change together). A field left
//                         out is left alone.
//   POST   /:id/title   → { title }
//   POST   /:id/render  → bake the cut (background job on the doc)
//   GET    /:id/job     → { job, renders }
//   DELETE /:id         → remove the cut (Storage renders stay)
//
// Tests: node scripts/test-filmeditor.js (pure functions, no network).

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = require('node-fetch');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const editor = require('./editor');           // uploadPublic + audioDuration
const clips = require('./clips');             // bucketForUrl (Admin-SDK downloads)
const assembly = require('./assembly');       // targetFrom + segmentFilters — ONE canvas rule
const { storageRef } = require('./asset-hash');

const COL = process.env.FILMEDITOR_COLLECTION || 'forge-film-edits';
const PROXY_COL = 'forge-film-proxies';
const STORAGE_FOLDER = 'filmeditor';
const PROXY_EDGE = 720;        // preview copies cap both edges here
const MAX_PIECES = 80;         // splits multiply — roomier than assembly's 60
const MAX_RENDERS = 12;        // the house cap; older cuts kept
const MIN_PIECE = 0.1;         // a piece shorter than this is a mis-tap, refused

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
  console.warn('filmeditor:', err.message);
  res.status(500).json({ error: err.message });
}
function run(bin, args, timeoutMs = 900000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${path.basename(bin)} failed: ${(stderr || err.message).slice(-400)}`));
      else resolve({ stdout, stderr });
    });
  });
}
const nowIso = () => new Date().toISOString();

// ── Pure pieces (exported for the tests and mirrored on the page) ──────────

// One timeline piece: a reference into a source file. `key` is the timeline
// entry's own id (a split makes two pieces sharing one url, so the url can't
// be the identity); `seconds` is the SOURCE's full length (null = unknown —
// never a confident 0); `in`/`out` are the kept span. Anything beyond these
// fields is dropped.
function cleanPieces(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_PIECES).map((c) => {
    const seconds = (c && c.seconds != null && Number.isFinite(Number(c.seconds)) && Number(c.seconds) > 0)
      ? Math.round(Number(c.seconds) * 1000) / 1000 : null;
    let tIn = Number(c && c.in);
    let tOut = Number(c && c.out);
    if (!Number.isFinite(tIn) || tIn < 0) tIn = 0;
    if (!Number.isFinite(tOut) || tOut <= 0) tOut = seconds != null ? seconds : 0;
    if (seconds != null) {
      tIn = Math.min(tIn, seconds);
      tOut = Math.min(tOut, seconds);
    }
    return {
      key: String((c && c.key) || '').slice(0, 40),
      url: String((c && c.url) || '').slice(0, 500),
      title: String((c && c.title) || '').slice(0, 200),
      poster: c && c.poster ? String(c.poster).slice(0, 500) : null,
      seconds,
      in: Math.round(tIn * 1000) / 1000,
      out: Math.round(tOut * 1000) / 1000,
    };
  }).filter((c) => c.key && /^https:\/\//.test(c.url) && c.out - c.in >= MIN_PIECE);
}

// The one audio track — her design: one file, laid under the film from
// `offset` seconds in. Null clears it.
function cleanAudio(a) {
  if (!a || !a.url || !/^https:\/\//.test(String(a.url))) return null;
  const off = Number(a.offset);
  return {
    url: String(a.url).slice(0, 500),
    name: String(a.name || '').slice(0, 200),
    offset: Number.isFinite(off) && off > 0 ? Math.round(off * 1000) / 1000 : 0,
  };
}

const pieceSeconds = (c) => Math.max(0, (Number(c && c.out) || 0) - (Number(c && c.in) || 0));
const totalSeconds = (list) => (list || []).reduce((s, c) => s + pieceSeconds(c), 0);

// Split a piece at `offset` seconds into ITS span → two references into the
// same source, or null when the cut would leave a sliver (the prototype
// refused silently; the page says why). Pure.
function splitPiece(piece, offset, newKey) {
  const dur = pieceSeconds(piece);
  if (!(offset >= MIN_PIECE && offset <= dur - MIN_PIECE)) return null;
  const cut = piece.in + offset;
  return [
    { ...piece, out: Math.round(cut * 1000) / 1000 },
    { ...piece, key: newKey, in: Math.round(cut * 1000) / 1000 },
  ];
}

// ── Preview proxies ────────────────────────────────────────────────────────
// Her sources stall in the player because they are HEAVY, not because the
// web can't play video (measured 2026-08-22: a 784x1168 Midjourney export at
// 19 Mbps — 12.3MB for five seconds). The editor therefore PREVIEWS a baked
// lightweight copy per source (the proxy-editing pattern every real editor
// uses) while the RENDER always cuts the original — the house display-copy
// rule, applied to video. Measured on her real clip: 12.3MB → 278KB.
const proxyId = (url) => crypto.createHash('sha1').update(String(url)).digest('hex');

// Pure: a source that is already small and light streams fine as itself.
function proxyNeeded(probe, bytes) {
  const secs = probe && probe.seconds;
  const kbps = secs ? (bytes * 8) / secs / 1000 : null;
  const edge = Math.max((probe && probe.width) || 0, (probe && probe.height) || 0);
  return !(kbps != null && kbps < 3000 && edge <= PROXY_EDGE);
}
// Pure: the exact bake. CRF with a maxrate ceiling, both edges capped, moov
// up front so it streams from the first byte.
function proxyArgs(src, out, hasAudio) {
  return ['-y', '-i', src,
    '-vf', `scale=${PROXY_EDGE}:${PROXY_EDGE}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25',
    '-maxrate', '3M', '-bufsize', '6M', '-pix_fmt', 'yuv420p',
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '96k'] : ['-an']),
    '-movflags', '+faststart', out];
}

// THE AUDIO TRACK GETS A PROXY TOO (2026-08-23, measured on her real cut:
// the "music" was a 13.9MB 480p YouTube VIDEO mp4 streamed through the
// <audio> element — a 17.9s film needs ~300KB of actual audio). An
// audio-only AAC copy is baked for any track that is a video file or heavy;
// a small pure-audio file honestly skips.
const audioProxyId = (url) => `${proxyId(url)}-aud`;
function audioProxyNeeded(probe, bytes) {
  return Boolean(probe.hasVideo) || bytes > 12 * 1024 * 1024;
}
function audioProxyArgs(src, out) {
  return ['-y', '-i', src, '-vn', '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart', out];
}

// One bake at a time — the 512MB box (the Playground's serialize lesson).
let proxyChain = Promise.resolve();
function enqueueProxy(url, kind) {
  const fn = kind === 'audio' ? bakeAudioProxy : bakeProxy;
  proxyChain = proxyChain.then(() => fn(url)).catch(() => {});
}
async function bakeProxy(url) {
  const d = db();
  if (!d || !FFMPEG || !FFPROBE) return;
  const ref = d.collection(PROXY_COL).doc(proxyId(url));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feproxy-'));
  try {
    const src = path.join(dir, 'src');
    await downloadSource(url, src);
    const bytes = fs.statSync(src).size;
    const probe = await probeFile(src);
    if (!probe.hasVideo) throw new Error('no video stream');
    if (!proxyNeeded(probe, bytes)) {
      await ref.set({ url, status: 'skip', proxyUrl: null, at: Date.now() }, { merge: true });
      return;
    }
    const out = path.join(dir, 'proxy.mp4');
    await run(FFMPEG, proxyArgs(src, out, probe.hasAudio), 900000);
    const proxyUrl = await editor.uploadPublic(out,
      `${STORAGE_FOLDER}/proxy/${proxyId(url)}.mp4`, 'video/mp4');
    await ref.set({
      url, status: 'ready', proxyUrl,
      bytes: fs.statSync(out).size, srcBytes: bytes, at: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.warn('filmeditor: proxy failed —', err.message);
    await ref.set({ url, status: 'error', proxyUrl: null, error: String(err.message).slice(0, 300), at: Date.now() }, { merge: true }).catch(() => {});
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
async function bakeAudioProxy(url) {
  const d = db();
  if (!d || !FFMPEG || !FFPROBE) return;
  const ref = d.collection(PROXY_COL).doc(audioProxyId(url));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feaprox-'));
  try {
    const src = path.join(dir, 'src');
    await downloadSource(url, src);
    const bytes = fs.statSync(src).size;
    const probe = await probeFile(src);
    if (!probe.hasAudio) throw new Error('no audio stream');
    if (!audioProxyNeeded(probe, bytes)) {
      await ref.set({ url, kind: 'audio', status: 'skip', proxyUrl: null, at: Date.now() }, { merge: true });
      return;
    }
    const out = path.join(dir, 'proxy.m4a');
    await run(FFMPEG, audioProxyArgs(src, out), 900000);
    const proxyUrl = await editor.uploadPublic(out,
      `${STORAGE_FOLDER}/proxy/${proxyId(url)}.m4a`, 'audio/mp4');
    await ref.set({
      url, kind: 'audio', status: 'ready', proxyUrl,
      bytes: fs.statSync(out).size, srcBytes: bytes, at: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.warn('filmeditor: audio proxy failed —', err.message);
    await ref.set({ url, kind: 'audio', status: 'error', proxyUrl: null, error: String(err.message).slice(0, 300), at: Date.now() }, { merge: true }).catch(() => {});
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// The shared read+enqueue: answer what exists, start what doesn't. A wedged
// 'making' older than 20 min and an 'error' older than 10 get another go.
async function proxyStates(urls, mayEnqueue, kind) {
  const d = db();
  const idFor = kind === 'audio' ? audioProxyId : proxyId;
  const map = {};
  for (const url of urls) {
    const snap = await d.collection(PROXY_COL).doc(idFor(url)).get();
    const v = snap.exists ? snap.data() : null;
    const age = v ? Date.now() - (v.at || 0) : 0;
    const retry = v && ((v.status === 'making' && age > 20 * 60 * 1000)
      || (v.status === 'error' && age > 10 * 60 * 1000));
    if (mayEnqueue && (!v || retry)) {
      await d.collection(PROXY_COL).doc(idFor(url)).set(
        { url, ...(kind === 'audio' ? { kind: 'audio' } : {}), status: 'making', proxyUrl: null, at: Date.now() }, { merge: true });
      enqueueProxy(url, kind);
      map[url] = { status: 'making', proxyUrl: null };
    } else {
      map[url] = v ? { status: v.status, proxyUrl: v.proxyUrl || null }
        : { status: 'none', proxyUrl: null };
    }
  }
  return map;
}

// The mix graph for the audio track: delay it to its offset, mix it under the
// film's own sound. normalize=0 is load-bearing — amix's default halves both.
function mixGraph(offsetSeconds) {
  const ms = Math.max(0, Math.round((Number(offsetSeconds) || 0) * 1000));
  return `[2:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=${ms}|${ms}[m];`
    + '[1:a][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]';
}

const trimmedCut = (a) => ({
  id: a.id, title: a.title || '',
  pieces: (a.clips || []).length,
  seconds: Math.round(totalSeconds(a.clips) * 10) / 10,
  renders: (a.renders || []).length,
  poster: ((a.clips || [])[0] || {}).poster || null,
  hasAudio: Boolean(a.audio),
  job: a.job && a.job.status === 'running' ? { kind: a.job.kind, label: a.job.label } : null,
  updatedAt: a.updatedAt || 0,
});

// ── Firestore plumbing (the assembly/cutmarks pattern) ─────────────────────
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
    if (!snap.exists) throw new Error('no such cut');
    const value = fn(snap.data()[field], snap.data());
    tx.update(ref, { [field]: JSON.parse(JSON.stringify(value)), updatedAt: Date.now() });
    return value;
  });
}

// Background jobs — startJob with the stale-takeover, patching FIELDS only.
async function startJob(id, kind, fn) {
  const doc = await loadDoc(id);
  if (!doc) throw new Error('no such cut');
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
      console.warn(`filmeditor: job ${kind} failed —`, err.message);
      Object.assign(job, { status: 'error', error: err.message });
    }
    await patchDoc(id, { job }).catch((e) => console.warn('filmeditor: save failed —', e.message));
  })();
}

// Admin SDK first (private objects, and it works where a url fetch can't),
// plain fetch as the fallback for anything external.
async function downloadSource(url, file) {
  const ref = storageRef(url);
  const bucket = ref ? clips.bucketForUrl(url) : null;
  if (bucket) {
    await bucket.file(ref.path).download({ destination: file });
    return file;
  }
  const res = await fetch(url, { redirect: 'follow', timeout: 900000 });
  if (!res.ok) throw new Error(`source fetch ${res.status}`);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(file);
    res.body.pipe(out);
    res.body.on('error', reject);
    out.on('finish', resolve);
    out.on('error', reject);
  });
  return file;
}

async function probeFile(file) {
  if (!FFPROBE) return { seconds: 0, width: null, height: null, hasVideo: true, hasAudio: true };
  const { stdout } = await run(FFPROBE, ['-v', 'error', '-show_entries',
    'format=duration:stream=codec_type,width,height', '-of', 'json', file], 120000);
  const info = JSON.parse(stdout || '{}');
  const d = parseFloat((info.format || {}).duration || '0');
  const vs = (info.streams || []).find((s) => s.codec_type === 'video');
  return {
    seconds: Number.isFinite(d) && d > 0 ? d : 0,
    width: (vs && vs.width) || null,
    height: (vs && vs.height) || null,
    hasVideo: Boolean(vs),
    hasAudio: (info.streams || []).some((s) => s.codec_type === 'audio'),
  };
}

// ─── the render job ─────────────────────────────────────────────────
async function runRender(id, progress) {
  if (!FFMPEG || !FFPROBE) throw new Error('ffmpeg/ffprobe unavailable');
  const doc = await loadDoc(id);
  const pieces = cleanPieces(doc.clips || []);
  if (!pieces.length) throw new Error('the timeline is empty — nothing to bake');
  const audio = cleanAudio(doc.audio);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filmeditor-'));
  try {
    const total = pieces.length + 2;
    // One download + one probe per unique SOURCE — split pieces share a url.
    const sources = new Map();
    async function sourceFor(url) {
      if (sources.has(url)) return sources.get(url);
      const file = path.join(dir, `src-${sources.size}`);
      await downloadSource(url, file);
      const probe = await probeFile(file);
      if (!probe.hasVideo) throw new Error('a piece has no video stream');
      const entry = { file, probe };
      sources.set(url, entry);
      return entry;
    }

    let target = null;
    const segs = [];
    const auds = [];
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      await progress(i, total, `piece ${i + 1} of ${pieces.length} — ${p.title || 'untitled'}`.slice(0, 80));
      const src = await sourceFor(p.url);
      if (!target) target = assembly.targetFrom(src.probe.width, src.probe.height);

      // The kept span decoded accurately (-ss/-to as INPUT options = source
      // timestamps), normalized onto the one canvas, its own encode —
      // concat-copy safe, exactly the assembly segment with a trim in front.
      const srcEnd = src.probe.seconds || null;
      const tIn = Math.min(p.in, srcEnd != null ? Math.max(0, srcEnd - MIN_PIECE) : p.in);
      const tOut = srcEnd != null ? Math.min(p.out, srcEnd) : p.out;
      if (tOut - tIn < MIN_PIECE / 2) throw new Error(`"${p.title || 'a piece'}" trims to nothing`);
      const seg = path.join(dir, `seg-${i}.mp4`);
      await run(FFMPEG, ['-y', '-ss', tIn.toFixed(3), '-to', tOut.toFixed(3), '-i', src.file,
        '-vf', assembly.segmentFilters(target), '-an',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
        '-movflags', '+faststart', seg], 900000);

      // Audio: PCM cut/padded to the segment's REAL encoded length, so the
      // sample-exact wav concat can never drift off the picture.
      const segDur = await editor.audioDuration(seg);
      if (!segDur) throw new Error(`"${p.title || 'a piece'}" encoded to nothing`);
      const wav = path.join(dir, `aud-${i}.wav`);
      if (src.probe.hasAudio) {
        await run(FFMPEG, ['-y', '-ss', tIn.toFixed(3), '-to', tOut.toFixed(3), '-i', src.file,
          '-vn', '-af', 'apad', '-t', segDur.toFixed(3),
          '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', wav], 600000);
      } else {
        await run(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-t', segDur.toFixed(3), '-c:a', 'pcm_s16le', wav], 600000);
      }
      segs.push(seg);
      auds.push(wav);
    }
    // sources are only safe to drop once every piece is cut (shared urls)
    for (const s of sources.values()) fs.rmSync(s.file, { force: true });

    await progress(pieces.length, total, 'joining the pieces');
    const esc = (f) => `file '${f.replace(/'/g, "'\\''")}'`;
    const vList = path.join(dir, 'v.txt');
    fs.writeFileSync(vList, segs.map(esc).join('\n'));
    const silent = path.join(dir, 'v.mp4');
    await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', vList, '-c', 'copy', silent], 600000);
    const aList = path.join(dir, 'a.txt');
    fs.writeFileSync(aList, auds.map(esc).join('\n'));
    const track = path.join(dir, 'a.wav');
    await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', aList, '-c', 'copy', track], 600000);

    const out = path.join(dir, 'film.mp4');
    if (audio) {
      const audFile = path.join(dir, 'trackin');
      await downloadSource(audio.url, audFile);
      await run(FFMPEG, ['-y', '-i', silent, '-i', track, '-i', audFile,
        '-filter_complex', mixGraph(audio.offset),
        '-map', '0:v', '-map', '[a]', '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], 600000);
    } else {
      await run(FFMPEG, ['-y', '-i', silent, '-i', track, '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], 600000);
    }

    await progress(total - 1, total, 'publishing');
    const seconds = await editor.audioDuration(out);
    const n = (doc.renders || []).length + 1;
    const url = await editor.uploadPublic(out, `${STORAGE_FOLDER}/${id}/film-${n}.mp4`, 'video/mp4');
    const render = {
      url, at: Date.now(), seconds: Math.round(seconds * 10) / 10,
      pieces: pieces.length, audio: Boolean(audio),
      width: target.width, height: target.height,
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

router.get('/status', async (req, res) => {
  let cuts = null;
  try { cuts = (await db().collection(COL).count().get()).data().count; } catch { /* unconfigured */ }
  res.json({ ok: true, firebase: admin.apps.length > 0, ffmpeg: !!FFMPEG, ffprobe: !!FFPROBE, cuts });
});

router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const snap = await db().collection(COL).get();
    const cuts = snap.docs.map((s) => trimmedCut({ id: s.id, ...s.data() }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    res.json({ cuts });
  } catch (err) { fail(res, err); }
});

router.post('/', async (req, res) => {
  try {
    const d = db();
    if (!d) throw new Error('Firebase unavailable');
    const ref = d.collection(COL).doc();
    // Named with HER date and time (Pacific), the assembly lesson — two cuts
    // made the same day must never wear one name.
    const PT = { timeZone: 'America/Los_Angeles' };
    const title = String(req.body.title || '').trim().slice(0, 120)
      || 'Cut · ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...PT })
      + ' · ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...PT }).toLowerCase();
    const now = Date.now();
    await ref.set({
      id: ref.id, title, clips: [], audio: null, renders: [], job: null,
      createdAt: now, updatedAt: now,
    });
    res.json({ id: ref.id, title });
  } catch (err) { fail(res, err); }
});

// Preview proxies — MUST stay registered above GET /:id or Express reads
// "proxies" as a cut id (the /api/promptlab/styles lesson).
// POST { urls:[…] } ensures a bake exists or starts one; GET ?urls=a,b only
// reads. The page polls GET while any answer says 'making'.
const cleanUrls = (list) => [...new Set(list
  .map((u) => String(u || '').trim().slice(0, 500))
  .filter((u) => /^https:\/\//.test(u)))].slice(0, 40);
router.post('/proxies', async (req, res) => {
  try {
    const urls = cleanUrls(Array.isArray(req.body.urls) ? req.body.urls : []);
    const audioUrls = cleanUrls(Array.isArray(req.body.audio) ? req.body.audio : []);
    if (!urls.length && !audioUrls.length) return res.status(400).json({ error: 'urls[] required' });
    res.json({
      proxies: urls.length ? await proxyStates(urls, true) : {},
      audio: audioUrls.length ? await proxyStates(audioUrls, true, 'audio') : {},
    });
  } catch (err) { fail(res, err); }
});
router.get('/proxies', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const urls = cleanUrls(String(req.query.urls || '').split(','));
    const audioUrls = cleanUrls(String(req.query.audio || '').split(','));
    res.json({
      proxies: urls.length ? await proxyStates(urls, false) : {},
      audio: audioUrls.length ? await proxyStates(audioUrls, false, 'audio') : {},
    });
  } catch (err) { fail(res, err); }
});

// Play-session telemetry (2026-08-23, round three) — what her PHONE actually
// did during a play: build id, rVFC fire counts, playhead holds, boundary
// reveal waits, audio start latency / entry realigns / stalls. Every fix so
// far was verified in headless Chromium while her device kept failing; this
// closes that loop with a measurement instead of another guess. One small doc
// per cut, newest sessions first, capped — no bytes, nothing personal beyond
// the browser's user-agent line. Registered above GET /:id (the /proxies
// lesson: Express would read "telemetry" as a cut id).
const TEL_COL = 'forge-film-telemetry';
const telNum = (v, cap) => Math.max(0, Math.min(Number(v) || 0, cap));
router.post('/telemetry', async (req, res) => {
  try {
    const d = db();
    if (!d) return res.status(503).json({ error: 'no store' });
    const b = req.body || {};
    const cut = String(b.cut || '').slice(0, 40);
    if (!/^[A-Za-z0-9_-]{4,}$/.test(cut)) return res.status(400).json({ error: 'cut required' });
    const session = {
      at: telNum(b.at, 4102444800000) || Date.now(),
      build: String(b.build || '').slice(0, 40),
      ua: String(b.ua || '').slice(0, 160),
      ph0: telNum(b.ph0, 36000), ph1: telNum(b.ph1, 36000),
      dur: telNum(b.dur, 3600000), joints: telNum(b.joints, 10000),
      vholdMs: telNum(b.vholdMs, 3600000), choldMs: telNum(b.choldMs, 3600000),
      black: (Array.isArray(b.black) ? b.black : []).slice(0, 30).map((n) => telNum(n, 60000)),
      rvfc: (Array.isArray(b.rvfc) ? b.rvfc : []).slice(0, 2).map((n) => telNum(n, 10000000)),
      aud: b.aud && typeof b.aud === 'object' ? {
        src: b.aud.src === 'proxy' ? 'proxy' : 'raw',
        startMs: b.aud.startMs == null ? null : telNum(b.aud.startMs, 3600000),
        entries: (Array.isArray(b.aud.entries) ? b.aud.entries : []).slice(0, 20)
          .map((n) => Math.max(-3600, Math.min(Number(n) || 0, 3600))),
        resync: telNum(b.aud.resync, 10000), paceOn: telNum(b.aud.paceOn, 10000),
        waits: telNum(b.aud.waits, 10000),
      } : null,
    };
    const ref = d.collection(TEL_COL).doc(cut);
    const snap = await ref.get();
    const sessions = [session, ...((snap.exists && snap.data().sessions) || [])].slice(0, 20);
    await ref.set({ cut, sessions, at: Date.now() });
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});
router.get('/telemetry', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const d = db();
    if (!d) return res.status(503).json({ error: 'no store' });
    const cut = String(req.query.cut || '').slice(0, 40);
    if (!cut) return res.status(400).json({ error: 'cut required' });
    const snap = await d.collection(TEL_COL).doc(cut).get();
    res.json({ cut, sessions: (snap.exists && snap.data().sessions) || [] });
  } catch (err) { fail(res, err); }
});

router.get('/:id', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such cut' });
    res.json(doc);
  } catch (err) { fail(res, err); }
});

router.get('/:id/job', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such cut' });
    res.json({ job: doc.job || null, renders: doc.renders || [] });
  } catch (err) { fail(res, err); }
});

// The whole arrangement in one save — a split changes two pieces and the
// order at once, so a partial write could never be right. A field the page
// doesn't send is left alone; `audio: null` genuinely clears the track.
router.post('/:id/pieces', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such cut' });
    const patch = {};
    if ('clips' in (req.body || {})) patch.clips = cleanPieces(req.body.clips);
    if ('audio' in (req.body || {})) patch.audio = cleanAudio(req.body.audio);
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to save' });
    await patchDoc(req.params.id, patch);
    res.json({ ok: true, pieces: (patch.clips || doc.clips || []).length });
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
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such cut' });
    if (!(doc.clips || []).length) return res.status(400).json({ error: 'the timeline is empty' });
    await startJob(req.params.id, 'render', (progress) => runRender(req.params.id, progress));
    res.json({ ok: true, status: 'rendering' });
  } catch (err) { fail(res, err); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db().collection(COL).doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

module.exports = {
  router, COL, PROXY_COL,
  // pure pieces, for the tests and the page's mirror
  cleanPieces, cleanAudio, pieceSeconds, totalSeconds, splitPiece, mixGraph,
  proxyId, proxyNeeded, proxyArgs,
  audioProxyId, audioProxyNeeded, audioProxyArgs,
  trimmedCut, MAX_PIECES, MAX_RENDERS, MIN_PIECE, PROXY_EDGE,
};
