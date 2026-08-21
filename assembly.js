// assembly.js — Assembly: put clips in order on a timeline, then bake one
// film. Page at /assembly, iOS tile under the FILM filter.
//
// Sophie's brief (Aug 2026): "one thing missing from our image film pipeline
// is an easy way to assemble clips — I can put them in order, sort of like
// the scratch pad in Story Room, but for clips. They appear on a timeline at
// the bottom; dropping one in gives you a little place indicator between each
// clip that already exists, and you click one to drop the clip between the
// two existing clips."
//
// The shelf it draws from is the Chunking clip library (`forge-clip-library`,
// clips.js) — this module GENERATES nothing and never touches a library doc.
// An assembly is an ARRANGEMENT: an ordered list of item snapshots on one doc
// (`forge-assemblies`, deckfactory), saved whole as she works (the cutmarks
// /state pattern — order and membership always change together). Render bakes
// the arrangement into one mp4, free, on our own box.
//
// AN ITEM IS A CLIP OR A STILL (Sophie, Aug 2026: "i made images in the
// playground and animated them w midjourney and wanted to dump them in — some
// were just images, some animated. one button and they all go into a project,
// ready to arrange"). `kind:'image'` items carry `hold` (seconds on screen,
// default 4) and render exactly like the pad film's beat art — the still held
// on the canvas for its length over silence. And the ONE BUTTON is the Dump:
// `POST /:id/import { album }` pulls a whole dumped album — photos AND videos,
// in album order — onto the project's timeline in one go (`GET /sources`
// lists the albums). Imported items reference the Dump's urls directly; they
// are never copied and never filed onto the Chunking shelf (the harvest skips
// `drops/` on purpose — raw dumps are not made clips; here she picked them).
// A still's timeline thumb is a DERIVED display copy via the /api/story/thumb
// service — the original is never touched (house rule).
//
// THE STITCH IS THE SCRATCH-PAD FILM'S RECIPE, not a fresh one:
//   1. every clip is normalized onto one canvas (scale + pad, 30fps, setsar=1,
//      yuv420p) and encoded as its own segment, so the concat demuxer joins
//      them with -c copy;
//   2. the audio track is per-segment PCM WAV, padded/cut to the segment's
//      REAL encoded length, concatenated sample-exact, and encoded to AAC
//      ONCE at the mux. Concatenating per-piece aac adds encoder priming at
//      every join and the sound walks off the picture (measured on the pad's
//      film, ~24ms per two units) — do not "simplify" this to per-segment aac.
// The canvas is the FIRST clip's frame (evened, long edge capped at 1280) —
// her footage decides the shape; anything different letterboxes onto it.
//
// Sources are read through the Admin SDK first (clips.js's bucketForUrl —
// works for private objects and inside a chat's sandbox, where ffmpeg/fetch
// can't always reach Storage urls) with a plain fetch fallback for anything
// external. At render time each arrangement item re-resolves its CURRENT
// library doc by id, so a re-baked chunk renders from its newest file; the
// stored snapshot url is the fallback when a library doc is gone.
//
// Renders never overwrite — `assembly/<id>/film-<n>.mp4`, kept on the doc
// (capped) newest first. `assembly/` is on clips.js's SKIP_PREFIXES: a film
// made OF clips must not be harvested back onto the shelf as a clip.
//
// Routes (mounted at /api/assembly by server.js, STUDIO_TOKEN gate, /status open):
//   GET    /status      → { ok, firebase, ffmpeg, ffprobe, assemblies }
//   GET    /            → { assemblies } — trimmed list, newest touched first
//   GET    /sources     → { albums } — the Dump's albums, newest first
//   POST   /            → { title? } → { id } — a new empty assembly
//   GET    /:id         → the doc
//   POST   /:id/clips   → { clips:[{id,url,title,poster,seconds,kind,hold}] }
//                         — the whole arrangement (the page debounces)
//   POST   /:id/import  → { album } — append a whole Dump album (photos and
//                         videos, in album order) to the timeline
//   POST   /:id/title   → { title }
//   POST   /:id/render  → bake the arrangement (background job on the doc)
//   GET    /:id/job     → { job }
//   DELETE /:id         → remove the assembly (Storage renders stay)
//
// Tests: node scripts/test-assembly.js (pure functions, no network).

const express = require('express');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const editor = require('./editor');           // uploadPublic + audioDuration
const clips = require('./clips');             // the library COL + bucketForUrl
const dropbox = require('./dropbox');         // COL — the Dump's albums for /import
const { storageRef } = require('./asset-hash');

const COL = process.env.ASSEMBLY_COLLECTION || 'forge-assemblies';
const STORAGE_FOLDER = 'assembly';
const MAX_CLIPS = 60;          // ~5 min of ~5s pieces; past that it's an editor's job
const MAX_RENDERS = 12;        // older cuts kept, same cap as the pad's films
const FPS = 30;
const MAX_EDGE = 1280;         // canvas cap — the movie pipeline's own ceiling

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
  console.warn('assembly:', err.message);
  res.status(500).json({ error: err.message });
}
function run(bin, args, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${path.basename(bin)} failed: ${(stderr || err.message).slice(-400)}`));
      else resolve({ stdout, stderr });
    });
  });
}
const nowIso = () => new Date().toISOString();

// ── Pure pieces (exported for the tests and mirrored on the page) ──────────

// One arrangement item: a snapshot of a library clip OR a still. The id ties
// a clip back to `forge-clip-library` (a Dump import's id is its drop doc id,
// which simply misses that lookup — the snapshot url stands); everything else
// is display fallback. Anything the client sends beyond these fields is
// dropped. A still (`kind:'image'`) carries `hold` — its seconds on screen.
const HOLD_DEFAULT = 4;
const HOLD_MIN = 0.5;
const HOLD_MAX = 30;
function cleanClips(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_CLIPS).map((c) => {
    const kind = (c && c.kind) === 'image' ? 'image' : 'video';
    const out = {
      id: String((c && c.id) || '').slice(0, 40),
      url: String((c && c.url) || '').slice(0, 500),
      title: String((c && c.title) || '').slice(0, 200),
      poster: c && c.poster ? String(c.poster).slice(0, 500) : null,
      // null stays null — an unknown length must never become a confident 0
      seconds: (c && c.seconds != null && Number.isFinite(Number(c.seconds)))
        ? Math.round(Number(c.seconds) * 10) / 10 : null,
      kind,
    };
    if (kind === 'image') {
      const h = Number(c && c.hold);
      out.hold = Number.isFinite(h)
        ? Math.round(Math.max(HOLD_MIN, Math.min(HOLD_MAX, h)) * 10) / 10
        : HOLD_DEFAULT;
    }
    return out;
  }).filter((c) => c.id && /^https:\/\//.test(c.url));
}

// How long an item sits on screen — a still is its hold, a clip its length.
const itemSeconds = (c) => (c && c.kind === 'image'
  ? (Number(c.hold) || HOLD_DEFAULT)
  : (Number(c && c.seconds) || 0));

// A dumped album's files → arrangement items, in album order. Pure — the
// route feeds it the drop docs. Videos keep their baked poster; a still's
// thumb is DERIVED via the thumb service (same-origin url), never a resize of
// the original.
function itemsFromDrops(files, bundleName) {
  const name = String(bundleName || 'Dump').trim();
  return (Array.isArray(files) ? files : [])
    .filter((f) => f && f.id && /^https:\/\//.test(String(f.url || '')))
    .slice()
    .sort((a, b) => (Number(a.photoIndex) || 0) - (Number(b.photoIndex) || 0))
    .map((f, i) => {
      const image = (f.media || 'image') !== 'video';
      const item = {
        id: String(f.id).slice(0, 40),
        url: String(f.url).slice(0, 500),
        title: String(f.name || `${name} · ${i + 1}`).slice(0, 200),
        poster: image
          ? `/api/story/thumb?url=${encodeURIComponent(f.url)}&w=240`
          : (f.posterUrl ? String(f.posterUrl).slice(0, 500) : null),
        seconds: null,
        kind: image ? 'image' : 'video',
      };
      if (image) item.hold = HOLD_DEFAULT;
      return item;
    });
}

// The place-indicator arithmetic — the page's whole interaction, kept here so
// the test pins it. A gap is 0..length: gap g means "before the clip now at
// index g" (gap length = at the end).
function placeAt(list, item, gap) {
  const g = Math.max(0, Math.min(list.length, Math.floor(gap)));
  return list.slice(0, g).concat([item], list.slice(g));
}
// Moving an existing clip to a gap: the gap indexes the list WITH the clip
// still in it (that is what she is looking at), so a gap past the clip shifts
// down one once it lifts out. Gaps `from` and `from+1` are the two sides of
// the clip itself — a move to either is staying put.
function movePlace(list, from, gap) {
  const f = Math.floor(from);
  if (f < 0 || f >= list.length) return list.slice();
  const g = Math.max(0, Math.min(list.length, Math.floor(gap)));
  const rest = list.slice(0, f).concat(list.slice(f + 1));
  const at = g > f ? g - 1 : g;
  return rest.slice(0, at).concat([list[f]], rest.slice(at));
}

// The render canvas: the first clip's frame, both edges evened (yuv420p needs
// even), the long edge capped at MAX_EDGE with the aspect kept.
function targetFrom(width, height) {
  let w = Number(width) || 720;
  let h = Number(height) || 1280;
  const long = Math.max(w, h);
  if (long > MAX_EDGE) {
    const k = MAX_EDGE / long;
    w = w * k; h = h * k;
  }
  w = Math.max(2, Math.round(w / 2) * 2);
  h = Math.max(2, Math.round(h / 2) * 2);
  return { width: w, height: h };
}

// The per-segment normalize chain — every clip lands on the one canvas at one
// fps/sar/format, which is what makes the concat-copy join safe.
function segmentFilters(target) {
  return `scale=${target.width}:${target.height}:force_original_aspect_ratio=decrease,`
    + `pad=${target.width}:${target.height}:(ow-iw)/2:(oh-ih)/2:color=black,`
    + `fps=${FPS},setsar=1,format=yuv420p`;
}

const trimmed = (a) => ({
  id: a.id, title: a.title || '',
  clips: (a.clips || []).length,
  seconds: Math.round((a.clips || []).reduce((s, c) => s + itemSeconds(c), 0) * 10) / 10,
  renders: (a.renders || []).length,
  poster: ((a.clips || [])[0] || {}).poster || null,
  job: a.job && a.job.status === 'running' ? { kind: a.job.kind, label: a.job.label } : null,
  updatedAt: a.updatedAt || 0,
});

// ── Firestore plumbing (the cutmarks pattern) ──────────────────────────────
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
    if (!snap.exists) throw new Error('no such assembly');
    const value = fn(snap.data()[field], snap.data());
    tx.update(ref, { [field]: JSON.parse(JSON.stringify(value)), updatedAt: Date.now() });
    return value;
  });
}

// Background jobs — startJob with the stale-takeover, patching FIELDS only.
async function startJob(id, kind, fn) {
  const doc = await loadDoc(id);
  if (!doc) throw new Error('no such assembly');
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
      console.warn(`assembly: job ${kind} failed —`, err.message);
      Object.assign(job, { status: 'error', error: err.message });
    }
    await patchDoc(id, { job }).catch((e) => console.warn('assembly: save failed —', e.message));
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
  if (!res.ok) throw new Error(`clip fetch ${res.status}`);
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
  if (!FFPROBE) return { seconds: 0, width: null, height: null, hasAudio: true };
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
  const arrangement = cleanClips(doc.clips || []);
  if (!arrangement.length) throw new Error('the timeline is empty — nothing to bake');
  const d = db();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assembly-'));
  try {
    const total = arrangement.length + 2;
    let target = null;
    const segs = [];
    const auds = [];
    for (let i = 0; i < arrangement.length; i++) {
      const item = arrangement[i];
      await progress(i, total, `clip ${i + 1} of ${arrangement.length} — ${item.title || 'untitled'}`.slice(0, 80));
      // The library doc is the live truth (a chunk re-bakes to a new file);
      // the snapshot url covers a clip the library no longer lists.
      let url = item.url;
      try {
        const snap = await d.collection(clips.COL).doc(item.id).get();
        if (snap.exists && snap.get('url')) url = snap.get('url');
      } catch { /* the snapshot url stands */ }

      const src = path.join(dir, `src-${i}`);
      await downloadSource(url, src);
      const probe = await probeFile(src);
      if (!probe.hasVideo) throw new Error(`"${item.title || url}" has no video stream`);
      if (!target) target = targetFrom(probe.width, probe.height);

      // Its own normalized segment either way — one canvas, one fps, its own
      // encode, concat-copy safe. A still loops for its hold (the pad film's
      // beat-art encode); a clip passes through whole.
      const seg = path.join(dir, `seg-${i}.mp4`);
      const still = item.kind === 'image';
      const inArgs = still
        ? ['-loop', '1', '-t', itemSeconds(item).toFixed(3), '-i', src]
        : ['-i', src];
      await run(FFMPEG, ['-y', ...inArgs, '-vf', segmentFilters(target), '-an',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
        '-movflags', '+faststart', seg], 900000);

      // Audio: PCM cut/padded to the segment's REAL encoded length, so the
      // sample-exact wav concat can never drift off the picture.
      const segDur = await editor.audioDuration(seg);
      if (!segDur) throw new Error(`"${item.title || url}" encoded to nothing`);
      const wav = path.join(dir, `aud-${i}.wav`);
      if (probe.hasAudio) {
        await run(FFMPEG, ['-y', '-i', src, '-vn', '-af', 'apad', '-t', segDur.toFixed(3),
          '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', wav], 600000);
      } else {
        await run(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-t', segDur.toFixed(3), '-c:a', 'pcm_s16le', wav], 600000);
      }
      segs.push(seg);
      auds.push(wav);
      fs.rmSync(src, { force: true });   // one source on disk at a time
    }

    await progress(arrangement.length, total, 'joining the clips');
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
    await run(FFMPEG, ['-y', '-i', silent, '-i', track, '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], 600000);

    await progress(total - 1, total, 'publishing');
    const seconds = await editor.audioDuration(out);
    const n = (doc.renders || []).length + 1;
    const url = await editor.uploadPublic(out, `${STORAGE_FOLDER}/${id}/film-${n}.mp4`, 'video/mp4');
    const render = {
      url, at: Date.now(), seconds: Math.round(seconds * 10) / 10,
      clips: arrangement.length,
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
  let assemblies = null;
  try { assemblies = (await db().collection(COL).count().get()).data().count; } catch { /* unconfigured */ }
  res.json({ ok: true, firebase: admin.apps.length > 0, ffmpeg: !!FFMPEG, ffprobe: !!FFPROBE, assemblies });
});

router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const snap = await db().collection(COL).get();
    const assemblies = snap.docs.map((s) => trimmed({ id: s.id, ...s.data() }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    res.json({ assemblies });
  } catch (err) { fail(res, err); }
});

router.post('/', async (req, res) => {
  try {
    const d = db();
    if (!d) throw new Error('Firebase unavailable');
    const ref = d.collection(COL).doc();
    const title = String(req.body.title || '').trim().slice(0, 120)
      || 'Assembly · ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const now = Date.now();
    await ref.set({
      id: ref.id, title, clips: [], renders: [], job: null,
      createdAt: now, updatedAt: now,
    });
    res.json({ id: ref.id, title });
  } catch (err) { fail(res, err); }
});

// The Dump's albums, newest first — what the one-button import picks from.
// MUST stay registered above GET /:id or Express reads "sources" as an id
// (the /api/promptlab/styles lesson).
router.get('/sources', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const snap = await db().collection(dropbox.COL).get();
    const byBundle = new Map();
    snap.forEach((s) => {
      const v = s.data();
      if (!v.bundle || !v.url) return;
      const e = byBundle.get(v.bundle) || {
        album: v.bundle, name: v.bundleName || v.bundle,
        images: 0, videos: 0, cover: null, newest: 0,
      };
      if ((v.media || 'image') === 'video') e.videos++; else e.images++;
      const at = Number(v.createdAt) || 0;
      if (at >= e.newest) {
        e.newest = at;
        e.cover = v.posterUrl
          || ((v.media || 'image') !== 'video'
            ? `/api/story/thumb?url=${encodeURIComponent(v.url)}&w=240` : e.cover);
      }
      byBundle.set(v.bundle, e);
    });
    const albums = [...byBundle.values()]
      .sort((a, b) => b.newest - a.newest)
      .slice(0, 40);
    res.json({ albums });
  } catch (err) { fail(res, err); }
});

router.get('/:id', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such assembly' });
    res.json(doc);
  } catch (err) { fail(res, err); }
});

router.get('/:id/job', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such assembly' });
    res.json({ job: doc.job || null, renders: doc.renders || [] });
  } catch (err) { fail(res, err); }
});

// The whole arrangement in one save — order and membership always change
// together (an insert is both), so a partial write could never be right.
router.post('/:id/clips', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such assembly' });
    const clean = cleanClips(req.body.clips);
    await patchDoc(req.params.id, { clips: clean });
    res.json({ ok: true, clips: clean.length });
  } catch (err) { fail(res, err); }
});

// THE ONE BUTTON — append a whole Dump album to the timeline, photos and
// videos alike, in album order, ready to arrange. Nothing is copied and
// nothing lands on the Chunking shelf; items reference the Dump's own urls.
router.post('/:id/import', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such assembly' });
    const album = String(req.body.album || '').trim();
    if (!album) return res.status(400).json({ error: 'which album?' });
    // Single equality filter, ordered in memory — the house query rule.
    const snap = await db().collection(dropbox.COL).where('bundle', '==', album).get();
    const files = [];
    snap.forEach((s) => files.push({ id: s.id, ...s.data() }));
    if (!files.length) return res.status(404).json({ error: 'that album is empty or unknown' });
    const items = itemsFromDrops(files, files[0].bundleName || album);
    const cur = cleanClips(doc.clips || []);
    const room = MAX_CLIPS - cur.length;
    const added = items.slice(0, Math.max(0, room));
    const clean = cleanClips(cur.concat(added));
    await patchDoc(req.params.id, { clips: clean });
    res.json({ ok: true, added: added.length, skipped: items.length - added.length, clips: clean.length });
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
    if (!doc) return res.status(404).json({ error: 'no such assembly' });
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
  router, COL,
  // pure pieces, for the tests and the page's mirror
  cleanClips, placeAt, movePlace, targetFrom, segmentFilters, trimmed,
  itemSeconds, itemsFromDrops,
  MAX_CLIPS, MAX_RENDERS, FPS, MAX_EDGE, HOLD_DEFAULT, HOLD_MIN, HOLD_MAX,
};
