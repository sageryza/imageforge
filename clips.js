// clips.js — Chunking: the library of small clips. Page at /chunking
// (`/clips` is the honest alias), iOS tile under the FILM filter.
//
// Sophie's brief (Aug 2026): "a library of small clips — not full videos,
// just the clip part: standalone sections that would never be taken apart,
// so a re-cut with slightly different emphasis can reuse them instead of
// re-paying for them. It looks like a library of images with names under
// them, four to a row, and the main mechanism is SEARCH."
//
// It GENERATES and STITCHES nothing, and costs nothing. Two sources, one
// shelf (collection `forge-clip-library`, deckfactory):
//
//   1. FIRESTORE — the movie pipeline's own records: every scene clip, kept
//      re-roll and dream bridge on `forge-movies`, every finished
//      quick-animate on `forge-quick`. These arrive with their real titles
//      and the generation PROMPT (the treasure — see docs/image-pipeline.md).
//   2. A STORAGE SWEEP — the shorts chats built into their own prefixes
//      (witch-shorts/, story-shorts/, hospital-film/ …). The SKIP LIST below
//      is the load-bearing half: what is deliberately NOT a clip.
//
// HER EDITS ALWAYS WIN. A PATCH records which fields she touched
// (`editedFields`), and a re-harvest never overwrites a touched field —
// re-running the harvest is always safe (upserts are content-addressed by
// url, so nothing ever doubles).
//
// POSTERS READ THE BYTES VIA THE ADMIN SDK, NEVER THE URL. ffmpeg cannot
// reach the cloud sandbox's HTTPS proxy, so feeding it a
// storage.googleapis.com url fails in a chat's container; downloading with
// the SDK first works everywhere and handles a private object too.
//
// A SWEPT FILE OVER 180s IS A FILM, NOT A CLIP — it is skipped, counted in
// the harvest summary, never filed. Firestore-sourced clips skip that gate
// (the pipeline only makes ~5s pieces). Files over 64MB are skipped before
// any download — no 5s clip is that big, and probing a 300MB film to learn
// it is a film wastes the instance's disk and bandwidth.
//
// CHUNKS (Sophie, Aug 2026 — what "chunking" specifically means): a chunk is
// a NAMED, TAGGED SECTION of a finished video — footage and voiceover
// together — that she would reuse whole in a different video. Her examples:
// the Sheldrake telepathy bridge inside the Evan video, reusable anywhere she
// talks about telepathy; the manifestation trio (the chocolate bars, the cat,
// the third thing she visualized at night), reusable in any witchcraft video
// about manifestation; the shirt she imagined then saw the next day; the
// envelope in El Salvador. A chunk lives on the SAME shelf as the atomic
// clips (kind 'chunk', its own chip), carries which video it came out of and
// the span, and is BAKED into its own file so a re-cut just picks it up.
// `POST /chunk { url, start, end, title, vo?, tags?, from? }` files one — the
// bake (accurate trim + 12ms audio edge fades, the cutmarks recipe) runs as a
// background job on the chunk's own doc. The harvest never touches chunks.
//
// Routes (mounted at /api/clips by server.js, STUDIO_TOKEN gate, /status open):
//   GET    /status      → { ok, firebase, ffmpeg, ffprobe, clips }
//   GET    /            → { count, clips } — the whole shelf, newest first
//                         (?q= filters server-side with the house grammar)
//   GET    /harvest     → { job, summary } — poll the background harvest
//   POST   /harvest     → start one (fire-and-forget; re-POST while running
//                         answers the running job, never a second one)
//   POST   /chunk       → { url, start, end, title, vo?, tags?, from? } —
//                         file + bake a chunk (content-addressed by url+span,
//                         so re-POSTing the same span converges on one doc)
//   GET    /:id         → one clip
//   PATCH  /:id         → title / tags / note / vo / hidden — marks editedFields
//
// Tests: node scripts/test-clips.js (pure functions, no network).
// CLI:   node scripts/harvest-clips.js [--dry] — run the harvest directly
//        with FIREBASE_SERVICE_ACCOUNT (how the first library was built).

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const { parseQuery } = require('./search-grammar');
const { storageRef } = require('./asset-hash');

const COL = process.env.CLIPS_COLLECTION || 'forge-clip-library';
const META = process.env.CLIPS_META_COLLECTION || 'forge-clip-library-meta';
const POSTER_FOLDER = 'clip-library/posters';
const VIDEO_RE = /\.(mp4|mov|m4v|webm)$/i;
const MAX_CLIP_SECONDS = 180;            // longer = a film wearing a clip's name
const MAX_CHUNK_SECONDS = 600;           // a chunk is a section, not the video
const MAX_SWEEP_BYTES = 64 * 1024 * 1024; // bigger = a film; skip before download
const POSTER_WIDTH = 480;                // tiles are ~90px; 480 covers the lightbox header too
const CHUNK_FOLDER = 'clip-library/chunks';

// ── The sweep skip list — what is deliberately NOT a clip ───────────────────
// Measured against the live bucket 2026-08-15 (697 video files, 21,452
// objects). Top-level prefixes; everything else sweeps, gated by size and
// duration. When a new prefix of non-clips appears, add it HERE with the
// reason — the list is the design.
const SKIP_PREFIXES = [
  'drops/',          // the Dump — her raw phone videos, not made clips (91 files)
  'nde-audio/',      // whole Anthony Chene interviews, 30–400MB webm (77 files)
  'nde-episodes/',   // finished NDE episodes — films, not pieces
  'movies/',         // the Firestore half covers clips/ and quick/ with real
                     // titles + prompts; films/ and voiceover/ are not clips
  'scratchpad/',     // the pad's per-beat still-encode cache + stitched pad films
  'writing-notes/',  // Writing Room voice notes (webm audio)
  'cutmarks/',       // Cut Marks renders — her own deliberate cuts of her own
                     // recordings (none present at measurement; the tool writes here)
  'cutroom/',        // Cutting Room artifacts, same reason
  'clip-library/',   // this module's own posters
];

// Fields a client may write. Everything else — url, poster, seconds, kind,
// prompt, from, createdAt — is the harvest's (or, for a chunk, the bake's).
const EDITABLE = ['title', 'tags', 'note', 'hidden', 'vo'];
// Auto fields the harvest refreshes UNLESS she touched them.
const AUTO_FIELDS = ['title', 'tags', 'from', 'kind', 'prompt'];

// ── ffmpeg/ffprobe: static npm binaries first, then env/PATH (house pattern) ──
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
const sharp = tryRequire('sharp');

function db() {
  if (!admin.apps.length) throw new Error('firebase not configured');
  return admin.firestore();
}
function bucketOrNull() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}
function fail(res, err) {
  const msg = err && err.message ? err.message : String(err);
  res.status(msg.includes('not configured') ? 503 : 500).json({ error: msg });
}
function run(bin, args, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${path.basename(bin)} failed: ${(stderr || err.message).slice(-300)}`));
      else resolve({ stdout, stderr });
    });
  });
}

// One doc per clip, content-addressed by its url — a re-harvest lands on the
// same doc, so nothing ever doubles and her edits have a stable home.
const clipId = (url) => crypto.createHash('sha1').update(String(url)).digest('hex').slice(0, 16);

// ── Search: the house grammar, matched the clip-library way ────────────────
// search-grammar.js PARSES (one grammar for every box in the app); matching is
// per-caller by design. Here: lowercase alphanumerics, substring matching — a
// few hundred short records, where her punctuation should never decide a hit.
const normalize = (s) => String(s == null ? '' : s)
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

// The typed field prefixes a query may use: `tag:movie`, `from:jonas`,
// `title:crumbs`, `prompt:zoom`, `note:redo`, `kind:bridge`.
const FIELDS = {
  tag: 'tag', tags: 'tag',
  title: 'title', name: 'title',
  from: 'from', source: 'from', movie: 'from',
  prompt: 'prompt',
  note: 'note',
  kind: 'kind',
  vo: 'vo', script: 'vo', says: 'vo',
};

function clipHay(clip) {
  const tags = (clip.tags || []).map(normalize).filter(Boolean);
  const h = {
    title: normalize(clip.title),
    from: normalize(clip.from),
    prompt: normalize(clip.prompt),
    note: normalize(clip.note),
    kind: normalize(clip.kind),
    vo: normalize(clip.vo),
    tag: tags,
  };
  h.all = [h.title, h.from, h.prompt, h.note, h.kind, h.vo, tags.join(' ')].join('  ');
  return h;
}

function termHits(hay, term) {
  if (term.field === 'tag') return hay.tag.some((t) => t.includes(term.value));
  const field = term.field && hay[term.field] !== undefined ? hay[term.field] : null;
  if (term.field && term.field !== 'tag' && field !== null) return field.includes(term.value);
  return hay.all.includes(term.value);
}

// A clip matches when every positive group has a matching term and no
// negative group does — parseQuery's contract.
function matchClip(clip, groups) {
  const hay = clipHay(clip);
  for (const g of groups) {
    const hit = g.terms.some((t) => termHits(hay, t));
    if (g.neg ? hit : !hit) return false;
  }
  return true;
}
const parseClipQuery = (q) => parseQuery(q, { fields: FIELDS, normalize });

// ── The sweep's pure decisions (exported for the tests) ────────────────────
function sweepVerdict(name, size) {
  if (!VIDEO_RE.test(name)) return { sweep: false, why: 'not video' };
  const p = SKIP_PREFIXES.find((s) => name.startsWith(s));
  if (p) return { sweep: false, why: p };
  if (Number(size) > MAX_SWEEP_BYTES) return { sweep: false, why: 'too big' };
  return { sweep: true };
}

const prettify = (s) => String(s || '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
// A basename that is timestamps/hashes carries no name — fall back to the
// folder it lives in plus the day it was made.
const OPAQUE_RE = /^[0-9a-f-]{8,}$|^\d{8,}[-_a-z0-9]*$/i;
function titleFromPath(storagePath, createdMs) {
  const parts = String(storagePath || '').split('/').filter(Boolean);
  const base = (parts.pop() || '').replace(/\.[a-z0-9]{2,5}$/i, '');
  const cleaned = prettify(base
    .replace(/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[-_ ]*)+/i, ''));
  if (cleaned && !OPAQUE_RE.test(cleaned.replace(/ /g, '-'))) return cleaned;
  const folder = prettify(parts[parts.length - 1] || parts[0] || 'clip');
  const d = new Date(Number(createdMs) || Date.now());
  return `${folder} · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

// ── Merge: what a re-harvest may write onto an existing doc ────────────────
// Server-owned fields refresh freely; AUTO fields refresh only where she has
// not touched them; note/hidden are only ever hers. Returns the patch (may be
// empty — then nothing is written).
function mergeClip(existing, incoming) {
  const edited = new Set(existing.editedFields || []);
  const patch = {};
  for (const k of AUTO_FIELDS) {
    if (edited.has(k)) continue;
    if (incoming[k] === undefined || incoming[k] === null) continue;
    const same = JSON.stringify(existing[k] ?? null) === JSON.stringify(incoming[k] ?? null);
    if (!same) patch[k] = incoming[k];
  }
  for (const k of ['seconds', 'width', 'height', 'bytes', 'poster', 'posterPath', 'createdAt', 'storagePath', 'bucket']) {
    if (incoming[k] === undefined || incoming[k] === null) continue;
    if (existing[k] !== incoming[k]) patch[k] = incoming[k];
  }
  return patch;
}

function clean(patch) {
  const out = {};
  for (const k of EDITABLE) {
    if (!(k in patch)) continue;
    let v = patch[k];
    if (v === undefined) continue;
    if (k === 'title') v = String(v || '').slice(0, 200);
    if (k === 'note') v = v === null ? null : String(v).slice(0, 2000);
    if (k === 'vo') v = v === null ? null : String(v).slice(0, 4000);
    if (k === 'hidden') v = Boolean(v);
    if (k === 'tags') {
      v = (Array.isArray(v) ? v.map(String)
        : String(v || '').split(',')).map((s) => s.trim()).filter(Boolean).slice(0, 24);
    }
    out[k] = v;
  }
  return out;
}

// ── Chunks: a named, tagged SECTION of a finished video ────────────────────
// Content-addressed by source url + span, so re-POSTing the same section
// converges on one doc instead of piling up copies.
const chunkId = (url, start, end) =>
  crypto.createHash('sha1').update(`${url}#${Number(start).toFixed(2)}-${Number(end).toFixed(2)}`)
    .digest('hex').slice(0, 16);

// Validate a chunk request into the doc to file, or throw a message the
// caller can show. Pure — exported for the tests.
function buildChunkDoc(body) {
  const url = String(body.url || '').trim();
  const start = Number(body.start);
  const end = Number(body.end);
  const title = String(body.title || '').trim();
  if (!storageRef(url)) throw new Error('url must be a Firebase Storage url (the source video)');
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    throw new Error('start/end must be seconds with start < end');
  }
  if (end - start > MAX_CHUNK_SECONDS) {
    throw new Error(`a chunk is a section, not the video — ${Math.round(end - start)}s is over the ${MAX_CHUNK_SECONDS}s cap`);
  }
  if (!title) throw new Error('a chunk needs a title — the name is what she reuses it by');
  const tags = (Array.isArray(body.tags) ? body.tags.map(String)
    : String(body.tags || '').split(',')).map((s) => s.trim()).filter(Boolean).slice(0, 24);
  return {
    kind: 'chunk',
    title: title.slice(0, 200),
    tags,
    from: String(body.from || '').trim().slice(0, 200) || null,
    vo: body.vo ? String(body.vo).slice(0, 4000) : null,
    source: { url },
    span: { start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100 },
    prompt: null, note: null, hidden: false, editedFields: [],
    status: 'baking',
  };
}

// The ffmpeg graph for one accurate span: trim + reset timestamps, and 12ms
// audio fades at each edge so an exact cut never clicks (the cutmarks recipe).
function chunkGraph(start, end, withAudio) {
  const s = Number(start).toFixed(3);
  const e = Number(end).toFixed(3);
  const d = end - start;
  const parts = [`[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v]`];
  if (withAudio) {
    parts.push(`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS,`
      + `afade=t=in:st=0:d=0.012,afade=t=out:st=${Math.max(0, d - 0.012).toFixed(3)}:d=0.012[a]`);
  }
  return parts.join(';');
}

// Download the source via the Admin SDK (never hand ffmpeg the url — the
// sandbox proxy lesson), bake the span into its own file, cut its poster,
// finish the doc. Runs fire-and-forget on the chunk's own doc.
async function bakeChunk(id) {
  const d = db();
  const ref = d.collection(COL).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;
  const doc = snap.data();
  const bucket = bucketOrNull();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunk-'));
  try {
    if (!bucket) throw new Error('Firebase Storage not configured');
    if (!FFMPEG || !FFPROBE) throw new Error('ffmpeg/ffprobe unavailable');
    const sref = storageRef(doc.source.url);
    if (!sref || sref.bucket !== bucket.name) throw new Error('source must live in this project\u2019s bucket');
    const ext = (VIDEO_RE.exec(sref.path) || [null, 'mp4'])[1];
    const local = path.join(tmpDir, `src.${ext}`);
    await bucket.file(sref.path).download({ destination: local });

    const probe = await run(FFPROBE, ['-v', 'error', '-show_entries',
      'format=duration:stream=codec_type', '-of', 'json', local], 120000);
    const info = JSON.parse(probe.stdout || '{}');
    const total = parseFloat((info.format || {}).duration || '0') || 0;
    const withAudio = (info.streams || []).some((x) => x.codec_type === 'audio');
    if (total && doc.span.end > total + 0.5) {
      throw new Error(`the source is ${Math.round(total)}s — the span ends at ${doc.span.end}s`);
    }

    const out = path.join(tmpDir, 'chunk.mp4');
    const args = ['-i', local, '-filter_complex', chunkGraph(doc.span.start, doc.span.end, withAudio),
      '-map', '[v]'];
    if (withAudio) args.push('-map', '[a]', '-c:a', 'aac', '-b:a', '160k');
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', '-y', out);
    await run(FFMPEG, args, 600000);

    const chunkPath = `${CHUNK_FOLDER}/${id}.mp4`;
    await bucket.upload(out, { destination: chunkPath, metadata: { contentType: 'video/mp4' } });
    const cf = bucket.file(chunkPath);
    await cf.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${chunkPath}`;

    const rec = { kind: 'chunk', createdAt: Date.now(), bytes: fs.statSync(out).size };
    const probed = await probeAndPoster({ ...rec, url }, id);
    if (probed.skip) throw new Error(`baked file unusable: ${probed.skip}`);
    await ref.set({ url, ...probed, status: 'ready', bakeError: null, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    await ref.set({
      status: 'error', bakeError: String(e.message || e).slice(0, 300), updatedAt: Date.now(),
    }, { merge: true }).catch(() => {});
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ── The harvest ────────────────────────────────────────────────────────────

// What the Firestore half knows about every clip the movie pipeline made.
function gatherFromMovies(movies) {
  const recs = [];
  for (const m of movies) {
    const from = m.title || m.id || 'untitled film';
    const scenes = m.scenes || [];
    for (const s of scenes) {
      if (s.clip && s.clip.url) {
        recs.push({
          url: s.clip.url, kind: 'scene', from,
          title: s.title || 'scene',
          prompt: s.clip.promptUsed || s.motionPrompt || null,
          tags: [],
        });
      }
      (s.clipHistory || []).forEach((h, i) => {
        if (!h || !h.url) return;
        recs.push({
          url: h.url, kind: 'reroll', from,
          title: `${s.title || 'scene'} · earlier take ${i + 1}`,
          prompt: h.promptUsed || null,
          tags: [],
        });
      });
    }
    for (const b of (m.bridges || [])) {
      if (!b.clip || !b.clip.url) continue;
      const to = scenes.find((s) => s.id === b.toSceneId);
      recs.push({
        url: b.clip.url, kind: 'bridge', from,
        title: `dream bridge — ${(to && to.title) || 'next scene'}`,
        prompt: (b.clip && b.clip.promptUsed) || b.prompt || null,
        tags: [],
      });
    }
  }
  return recs;
}

function gatherFromQuick(quickDocs) {
  const recs = [];
  for (const q of quickDocs) {
    if (!q.clipUrl) continue;
    const words = String(q.prompt || '').trim().split(/\s+/).filter(Boolean);
    const title = words.length ? words.slice(0, 8).join(' ') : 'quick animate';
    recs.push({
      url: q.clipUrl, kind: 'quick', from: 'quick animate',
      title,
      prompt: q.prompt || null,
      tags: [],
      createdAt: q.createdAt ? Date.parse(q.createdAt) || null : null,
    });
  }
  return recs;
}

function gatherFromSweep(files, knownPaths) {
  const recs = [];
  const skipped = { prefix: 0, big: 0 };
  for (const f of files) {
    const size = Number(f.metadata && f.metadata.size) || 0;
    const v = sweepVerdict(f.name, size);
    if (!v.sweep) {
      if (v.why === 'too big') skipped.big++;
      else if (v.why !== 'not video') skipped.prefix++;
      continue;
    }
    if (knownPaths.has(f.name)) continue;
    const createdMs = Date.parse(f.metadata && f.metadata.timeCreated) || null;
    const parts = f.name.split('/').filter(Boolean);
    recs.push({
      url: `https://storage.googleapis.com/${f.bucket.name}/${f.name}`,
      kind: 'short',
      from: prettify(parts[0] || ''),
      title: titleFromPath(f.name, createdMs),
      prompt: null,
      tags: [...new Set(parts.slice(0, -1).map(prettify).filter(Boolean))],
      createdAt: createdMs,
      bytes: size,
    });
  }
  return { recs, skipped };
}

// Download → probe → poster, all from the local bytes. Returns the fields to
// put on the doc, or { skip } with the reason.
async function probeAndPoster(rec, id, opts = {}) {
  const bucket = bucketOrNull();
  if (!bucket) throw new Error('Firebase Storage not configured');
  const ref = storageRef(rec.url);
  if (!ref) return { skip: 'external url' };
  if (ref.bucket !== bucket.name) return { skip: 'other bucket' };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clips-'));
  const ext = (VIDEO_RE.exec(ref.path) || [null, 'mp4'])[1];
  const local = path.join(tmpDir, `clip.${ext}`);
  try {
    const file = bucket.file(ref.path);
    let meta;
    try { [meta] = await file.getMetadata(); } catch { return { skip: 'object missing' }; }
    await file.download({ destination: local });

    let seconds = null; let width = null; let height = null; let hasVideo = true;
    if (FFPROBE) {
      const { stdout } = await run(FFPROBE, ['-v', 'error', '-show_entries',
        'format=duration:stream=codec_type,width,height', '-of', 'json', local], 120000);
      const info = JSON.parse(stdout || '{}');
      const d = parseFloat((info.format || {}).duration || '0');
      seconds = Number.isFinite(d) && d > 0 ? Math.round(d * 10) / 10 : null;
      const vs = (info.streams || []).find((s) => s.codec_type === 'video');
      hasVideo = Boolean(vs);
      if (vs) { width = vs.width || null; height = vs.height || null; }
    }
    if (!hasVideo) return { skip: 'no video stream' };
    if (rec.kind === 'short' && seconds && seconds > MAX_CLIP_SECONDS) return { skip: 'long' };

    let poster = null; let posterPath = null;
    if (FFMPEG && sharp && !opts.skipPoster) {
      // Not frame 0 — scene clips often open on a fade from black.
      const at = Math.min(1, (seconds || 2) * 0.15).toFixed(2);
      const frame = path.join(tmpDir, 'frame.png');
      await run(FFMPEG, ['-ss', at, '-i', local, '-frames:v', '1', '-y', frame], 120000);
      const webp = await sharp(frame).resize({ width: POSTER_WIDTH, withoutEnlargement: true })
        .webp({ quality: 72 }).toBuffer();
      posterPath = `${POSTER_FOLDER}/${id}.webp`;
      const pf = bucket.file(posterPath);
      await pf.save(webp, {
        metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
      });
      await pf.makePublic();
      poster = `https://storage.googleapis.com/${bucket.name}/${posterPath}`;
    }

    return {
      seconds, width, height, poster, posterPath,
      bytes: Number(meta.size) || rec.bytes || null,
      createdAt: rec.createdAt || Date.parse(meta.timeCreated) || Date.now(),
      storagePath: ref.path, bucket: ref.bucket,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// The whole harvest. `progress(done, total, label)` is throttled by the
// caller; `opts.dry` gathers and reports without writing anything.
async function runHarvest(progress = () => {}, opts = {}) {
  const d = db();
  const bucket = bucketOrNull();
  if (!bucket) throw new Error('Firebase Storage not configured');

  await progress(0, 0, 'reading the movie records');
  const [moviesSnap, quickSnap, existingSnap] = await Promise.all([
    d.collection('forge-movies').get(),
    d.collection('forge-quick').get(),
    d.collection(COL).get(),
  ]);
  const movies = moviesSnap.docs.map((x) => x.data());
  const quick = quickSnap.docs.map((x) => x.data());
  const existing = new Map();
  existingSnap.forEach((x) => existing.set(x.id, { id: x.id, ...x.data() }));

  await progress(0, 0, 'sweeping storage');
  const [files] = await bucket.getFiles();

  const recs = [...gatherFromMovies(movies), ...gatherFromQuick(quick)];
  const knownPaths = new Set();
  for (const r of recs) {
    const ref = storageRef(r.url);
    if (ref) knownPaths.add(ref.path);
  }
  const swept = gatherFromSweep(files, knownPaths);
  recs.push(...swept.recs);

  // Two records claiming one url collapse to the first (a scene clip beats a
  // sweep of the same file; the sweep already skips movies/ anyway).
  const byId = new Map();
  for (const r of recs) {
    const id = clipId(r.url);
    if (!byId.has(id)) byId.set(id, { id, ...r });
  }

  const summary = {
    sources: { movies: movies.length, quick: quick.length, storageVideos: files.filter((f) => VIDEO_RE.test(f.name)).length },
    gathered: byId.size,
    added: 0, updated: 0, unchanged: 0,
    skippedLong: 0, skippedExternal: 0, skippedMissing: 0, skippedOtherBucket: 0,
    posterErrors: 0, errors: 0,
    skippedByPrefix: swept.skipped.prefix, skippedBig: swept.skipped.big,
  };
  if (opts.dry) return summary;

  const todo = [...byId.values()];
  let done = 0;
  for (const rec of todo) {
    done++;
    try {
      const have = existing.get(rec.id);
      if (have && have.poster && have.seconds != null) {
        // Metadata-only refresh — a re-harvest with nothing new is cheap.
        const patch = mergeClip(have, rec);
        if (Object.keys(patch).length) {
          patch.updatedAt = Date.now();
          patch.harvestedAt = Date.now();
          await d.collection(COL).doc(rec.id).set(patch, { merge: true });
          summary.updated++;
        } else summary.unchanged++;
        continue;
      }
      await progress(done, todo.length, `probing · ${rec.title}`.slice(0, 80));
      const probed = await probeAndPoster(rec, rec.id);
      if (probed.skip) {
        if (probed.skip === 'long') summary.skippedLong++;
        else if (probed.skip === 'external url') summary.skippedExternal++;
        else if (probed.skip === 'other bucket') summary.skippedOtherBucket++;
        else summary.skippedMissing++;
        continue;
      }
      const now = Date.now();
      if (have) {
        const patch = { ...mergeClip(have, rec), ...probed, updatedAt: now, harvestedAt: now };
        await d.collection(COL).doc(rec.id).set(patch, { merge: true });
        summary.updated++;
      } else {
        await d.collection(COL).doc(rec.id).set({
          url: rec.url, kind: rec.kind, title: rec.title, from: rec.from,
          prompt: rec.prompt || null, tags: rec.tags || [],
          note: null, hidden: false, editedFields: [],
          ...probed, harvestedAt: now, updatedAt: now,
        });
        summary.added++;
      }
    } catch (e) {
      summary.errors++;
      // One failed clip costs that clip, never the run.
      try {
        await d.collection(COL).doc(rec.id).set({
          harvestError: String(e.message || e).slice(0, 300), updatedAt: Date.now(),
        }, { merge: true });
      } catch { /* the record just stays absent */ }
    }
  }
  return summary;
}

// ── The harvest as a background job on the meta doc (house pattern) ─────────
const metaRef = () => db().collection(META).doc('harvest');

async function startHarvest() {
  const snap = await metaRef().get();
  const cur = snap.exists ? snap.data() : {};
  if (cur.job && cur.job.status === 'running') {
    const age = Date.now() - new Date(cur.job.startedAt || 0).getTime();
    if (age < 20 * 60 * 1000) return { started: false, job: cur.job };
    // A "running" job older than 20 min is a dead server's leftover — take over.
  }
  const job = { kind: 'harvest', status: 'running', done: 0, total: 0, label: 'starting', error: null, startedAt: new Date().toISOString() };
  await metaRef().set({ job }, { merge: true });
  (async () => {
    let lastSave = 0;
    const progress = async (dn, total, label) => {
      Object.assign(job, { done: dn, total, label });
      if (Date.now() - lastSave > 1500) {
        lastSave = Date.now();
        await metaRef().set({ job }, { merge: true }).catch(() => {});
      }
    };
    try {
      const summary = await runHarvest(progress);
      Object.assign(job, { status: 'done', label: 'done' });
      await metaRef().set({ job, summary, finishedAt: Date.now() }, { merge: true });
    } catch (e) {
      Object.assign(job, { status: 'error', error: String(e.message || e).slice(0, 300) });
      await metaRef().set({ job }, { merge: true }).catch(() => {});
    }
  })();
  return { started: true, job };
}

// ── Routes ─────────────────────────────────────────────────────────────────
const router = express.Router();

router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '2mb' }));

router.get('/status', async (req, res) => {
  let clips = null;
  try { clips = (await db().collection(COL).count().get()).data().count; } catch { /* unconfigured */ }
  res.json({ ok: true, firebase: Boolean(bucketOrNull()), ffmpeg: Boolean(FFMPEG), ffprobe: Boolean(FFPROBE), clips });
});

// GET / — the whole shelf, newest clip first. ?q= speaks the house grammar.
router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const snap = await db().collection(COL).get();
    let clips = [];
    snap.forEach((x) => {
      const v = x.data();
      clips.push({
        id: x.id, url: v.url, poster: v.poster || null,
        title: v.title || '', tags: v.tags || [], from: v.from || '',
        kind: v.kind || 'short', prompt: v.prompt || null, note: v.note || null,
        seconds: v.seconds ?? null, width: v.width ?? null, height: v.height ?? null,
        hidden: Boolean(v.hidden), createdAt: v.createdAt || 0,
        vo: v.vo || null, status: v.status || 'ready',
        span: v.span || null, source: v.source || null,
      });
    });
    if (req.query.q) {
      const groups = parseClipQuery(String(req.query.q));
      clips = clips.filter((c) => matchClip(c, groups));
    }
    clips.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    res.json({ count: clips.length, clips });
  } catch (e) { fail(res, e); }
});

router.get('/harvest', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const snap = await metaRef().get();
    res.json(snap.exists ? snap.data() : { job: null });
  } catch (e) { fail(res, e); }
});

router.post('/harvest', async (req, res) => {
  try { res.json({ ok: true, ...(await startHarvest()) }); }
  catch (e) { fail(res, e); }
});

// POST /chunk — file + bake a named section of a finished video. Returns at
// once; the bake runs in the background on the chunk's own doc (status
// 'baking' → 'ready' | 'error' + bakeError). Re-POSTing the same url+span
// lands on the same doc — safe to retry a failed bake.
router.post('/chunk', async (req, res) => {
  try {
    let doc;
    try { doc = buildChunkDoc(req.body || {}); } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const id = chunkId(doc.source.url, doc.span.start, doc.span.end);
    const ref = db().collection(COL).doc(id);
    const before = await ref.get();
    if (before.exists && before.get('status') === 'ready') {
      // Already baked — refresh only what the caller sent, honoring her edits.
      const edited = new Set(before.get('editedFields') || []);
      const patch = { updatedAt: Date.now() };
      for (const k of ['title', 'tags', 'vo', 'from']) {
        if (!edited.has(k) && doc[k] !== null && doc[k] !== undefined) patch[k] = doc[k];
      }
      await ref.set(patch, { merge: true });
      const after = await ref.get();
      return res.json({ ok: true, id, already: true, clip: { id, ...after.data() } });
    }
    const now = Date.now();
    await ref.set({ ...doc, createdAt: (before.exists && before.get('createdAt')) || now, updatedAt: now },
      { merge: true });
    bakeChunk(id).catch(() => {});
    res.json({ ok: true, id, status: 'baking' });
  } catch (e) { fail(res, e); }
});

router.get('/:id', async (req, res) => {
  try {
    const snap = await db().collection(COL).doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'not found' });
    res.json({ id: snap.id, ...snap.data() });
  } catch (e) { fail(res, e); }
});

// PATCH /:id — her curation. Whatever she touches is hers forever: the field
// names land in editedFields and the harvest never writes those again.
router.patch('/:id', async (req, res) => {
  try {
    const patch = clean(req.body || {});
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to update' });
    const ref = db().collection(COL).doc(req.params.id);
    const before = await ref.get();
    if (!before.exists) return res.status(404).json({ error: 'not found' });
    const edited = new Set(before.get('editedFields') || []);
    Object.keys(patch).forEach((k) => edited.add(k));
    patch.editedFields = [...edited];
    patch.updatedAt = Date.now();
    await ref.set(patch, { merge: true });
    const after = await ref.get();
    res.json({ ok: true, clip: { id: after.id, ...after.data() } });
  } catch (e) { fail(res, e); }
});

module.exports = {
  router, COL, META,
  // pure pieces, for the tests and the CLI
  normalize, parseClipQuery, matchClip, clipHay,
  sweepVerdict, titleFromPath, prettify, mergeClip, clean, clipId,
  chunkId, buildChunkDoc, chunkGraph, bakeChunk, MAX_CHUNK_SECONDS,
  gatherFromMovies, gatherFromQuick, gatherFromSweep,
  runHarvest, startHarvest,
  SKIP_PREFIXES, MAX_CLIP_SECONDS, MAX_SWEEP_BYTES,
};
