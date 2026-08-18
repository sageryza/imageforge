// pausing.js — THE PAUSING TOOL: how long a beat sits. The other half of the
// polish pass, and the half that decides how a cut actually sounds.
//
// WHY IT EXISTS. The Cutting Room can REMOVE a pause — it compresses one to
// ~0.28s and that is the only length it has. Nothing in the app could make a
// pause 1.2 seconds, or put a pause somewhere she never left one. That work
// existed only as a hand-authored Compare page ("Evan — the pause timeline",
// re-posted to v7b), holding four things that lived nowhere else:
//
//   1. SETTING a length, not just removing — the whole idea of rhythm.
//   2. ADDING a pause where the recording has none.
//   3. Building a pause out of the recording's OWN ROOM TONE. Digital
//      silence is what made the "45 percent" line sound bungled: a room has
//      a floor, and dropping to zero samples reads as a dropout, not a beat.
//      An existing gap lends its own air (trimmed if she shortened it,
//      repeated if she lengthened it); a pause with no gap of its own
//      borrows the quietest stretch of the same recording, baked once.
//   4. PLAYING HER EDIT rather than the source. Pressing play used to play
//      the recording as it is, so a pause she had just set sounded exactly
//      the same (Sophie: "I need to be able to hear it to know how long of a
//      pause I want"). Every ▶ here plays what she has marked.
//
// See docs/audio-pipeline.md, "The three structural holes" — this is the
// second one.
//
// WHAT IT DELIBERATELY DOES NOT DO: cut words. The reference page had a CUT
// mode; the Cutting Room and Cutting Blocks both do that properly, with the
// re-listen every real word cut needs. This tool only ever touches AIR, so
// its word timings never have to be cut-accurate and it never has to
// re-listen. Setting a pause to "out" is 0.08s of room tone, an elision, not
// a splice.
//
// PAUSE DETECTION IS IMPORTED, NOT RE-IMPLEMENTED — `breathCuts` +
// `roomToneCuts` + `mergeRanges` + `rmsProfile` from cuttingroom.js, the
// vo-remove-pauses algorithm (see that module's header and
// docs/nde-precise-cutting.md "Noisy pauses"): breath and mouth noise sit
// only 4-7dB under quiet speech, so no absolute silence threshold finds
// these pauses. A second copy would find DIFFERENT pauses and the same
// recording would read differently in two rooms.
//
// THE PLAN IS SHARED WITH THE PAGE — `pause-plan.js`, loaded here and served
// to the browser at /pause-plan.js. The preview she approves by ear and the
// render she gets have to be the same edit; two implementations would drift.
//
// HER VOICE IS NEVER LOUDNORMED (the narration finding). 12ms fades on the
// outer edge of every pause piece and nowhere else — a fade per loop repeat
// pumps audibly on room tone.
//
// Data: one doc per recording in `forge-pausing` (deckfactory),
// content-addressed by a hash of the source url, so re-opening the same
// recording resumes the same project. Words live in Storage
// (`pausing/<id>/words.json`) — a 90-minute recording's words would bloat the
// doc; her marking state, which is the part that changes, sits on the doc.
//
// Money: opening a recording transcribes it (~$0.006/min, once ever per
// recording). Previews are ffmpeg span cuts, banked. Rendering is ffmpeg on
// our own box. All of it free after the transcribe; nothing spends on load.
//
// Routes (mounted at /api/pausing, STUDIO_TOKEN gate, only /status open):
//   GET    /status        → { ok, firebase, ffmpeg, openai }
//   GET    /sources       → recordings she can open (the audio library)
//   GET    /              → { projects }
//   POST   /open          → { url, name? } → { id } — create/resume; a first
//                           open starts the listen job
//   GET    /:id           → the doc (+ wordsUrl, roomUrl)
//   POST   /:id/state     → { patch } — merge a whitelisted slice of her
//                           marking state (set / added)
//   GET    /:id/plan      → { items, total, delta } — her edit as the render
//                           will perform it (what the page checks itself
//                           against; free, no ffmpeg)
//   POST   /:id/title     → { title }
//   POST   /:id/render    → bake her rhythm into a fresh file (background job)
//   GET    /:id/job       → { job, renders }
//   DELETE /:id           → remove the project (Storage files stay)

const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

const editor = require('./editor');
const cutroom = require('./cuttingroom');
const audioDrop = require('./audio');
const { planEdit } = require('./pause-plan');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const COL = process.env.PAUSING_COLLECTION || 'forge-pausing';
const STORAGE_FOLDER = 'pausing';
const RENDER_FOLDER = `${STORAGE_FOLDER}/renders`;
const MAX_SECONDS = 5400;    // 90 min — the Cutting Room's cap, same reasoning
const MAX_RENDERS = 8;
const MAX_ITEMS = 400;       // a render is a rhythm pass, not a reconstruction
const FADE = 0.012;          // the join fade on a pause piece's outer edges
// Below this a gap is articulation, not rhythm — she is never going to make a
// decision about the 0.2s after a comma, and a chip on every one of them
// would bury the pauses that matter.
const MIN_PAUSE = 0.35;
const ROOM_MAX = 1;          // how much room tone to bake (seconds)

const FFMPEG = editor.FFMPEG;
const run = editor.run;

function db() { return admin.apps.length ? admin.firestore() : null; }
function bucket() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}
function fail(res, err) {
  console.warn('pausing:', err.message);
  res.status(500).json({ error: err.message });
}
const nowIso = () => new Date().toISOString();
const projectId = (url) => crypto.createHash('sha1').update(String(url)).digest('hex').slice(0, 16);

// ─── doc helpers ────────────────────────────────────────────────────
async function loadDoc(id) {
  const d = db();
  if (!d) throw new Error('Firestore unavailable');
  const snap = await d.collection(COL).doc(String(id)).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}
// Patch FIELDS, never stamp a whole doc — a job's progress save of a stale
// copy silently reverted concurrent edits once (the Episode Editor bug).
async function patchDoc(id, fields) {
  const d = db();
  if (!d) throw new Error('Firestore unavailable');
  await d.collection(COL).doc(String(id)).set({ ...fields, updatedAt: nowIso() }, { merge: true });
}

// ─── words live in Storage ──────────────────────────────────────────
const cache = new Map(); // id → { words }
const wordsPathFor = (id) => `${STORAGE_FOLDER}/${id}/words.json`;
const roomPathFor = (id) => `${STORAGE_FOLDER}/${id}/room.wav`;

async function saveJson(storagePath, payload) {
  const b = bucket();
  if (!b) throw new Error('Firebase Storage unavailable');
  const file = b.file(storagePath);
  await file.save(Buffer.from(JSON.stringify(payload)), {
    metadata: { contentType: 'application/json', cacheControl: 'no-cache' },
    resumable: false,
  });
  await file.makePublic();
  return `https://storage.googleapis.com/${b.name}/${storagePath}`;
}
async function loadWords(id) {
  const hit = cache.get(id);
  if (hit && hit.words) return hit.words;
  const [buf] = await bucket().file(wordsPathFor(id)).download();
  const words = JSON.parse(buf.toString('utf8')).words || [];
  cache.set(id, { words });
  if (cache.size > 4) cache.delete(cache.keys().next().value);
  return words;
}

// ─── detection → the pauses she sees ────────────────────────────────
// The imported passes hand back ranges to REMOVE: each one is already inset
// by KEEP/2 on both sides, because the Cutting Room compresses a pause to
// KEEP rather than deleting it. This tool wants the GAP, so the inset comes
// back off — and no further, because the 0.10s margins inside breathCuts are
// deliberate protection for the speech either side.
function pausesFrom(merged, words) {
  const KEEP = cutroom.KEEP;
  if (!words.length) return [];
  const first = words[0].start;
  const last = words[words.length - 1].end;
  const out = [];
  const seen = new Set();
  let wi = -1;                                   // one walking pointer: merged is sorted
  merged.forEach(([s, e]) => {
    const a = Math.round((s - KEEP / 2) * 100) / 100;
    const b = Math.round((e + KEEP / 2) * 100) / 100;
    const len = Math.round((b - a) * 100) / 100;
    // the head and tail air of a recording is not rhythm — it is a trim, and
    // trimming is the Cutting Room's job
    if (b <= first + 0.05 || a >= last - 0.05) return;
    while (words[wi + 1] && words[wi + 1].end <= a + 0.2) wi += 1;
    if (wi < 0) return;
    if (len < MIN_PAUSE) return;
    // one chip per word: two detections inside the same gap would stack two
    // buttons on one word and the second could never be tapped
    if (seen.has(wi)) return;
    seen.add(wi);
    out.push({ id: `p${String(out.length).padStart(2, '0')}`, a, b, len, wi });
  });
  return out;
}

// The recording's own room tone — what an ADDED pause is built out of, since
// it has no gap of its own to borrow from. Pass 2 has already found every
// room-tone run in the file, so the quietest long one IS the answer; the
// window scan below only runs for a recording that never goes quiet for
// nearly half a second, where there is nothing better to take.
function pickRoom(prof, ranges) {
  const mean = (a, b) => {
    let sum = 0;
    let n = 0;
    for (let i = Math.max(0, Math.round(a / 0.02)); i < Math.min(prof.length, Math.round(b / 0.02)); i += 1) {
      sum += prof[i]; n += 1;
    }
    return n ? sum / n : Infinity;
  };
  const runs = (ranges || [])
    .filter(([a, b]) => b - a >= 0.4)
    .map(([a, b]) => ({ a, b: Math.min(b, a + ROOM_MAX), v: mean(a, b) }))
    .sort((x, y) => x.v - y.v);
  if (runs.length) return { a: Math.round(runs[0].a * 100) / 100, b: Math.round(runs[0].b * 100) / 100 };

  const win = 12;   // 0.24s — short, but this is the fallback, not the plan
  let best = 0;
  let bestV = Infinity;
  for (let i = 0; i + win <= prof.length; i += 1) {
    let peak = -Infinity;
    for (let k = 0; k < win; k += 1) peak = Math.max(peak, prof[i + k]);
    if (peak < bestV) { bestV = peak; best = i; }
  }
  return { a: Math.round(best * 0.02 * 100) / 100, b: Math.round((best + win) * 0.02 * 100) / 100 };
}

// ─── background jobs (the blocks.js / editor.js pattern) ────────────
async function startJob(id, kind, fn) {
  const doc = await loadDoc(id);
  if (!doc) throw new Error('no such project');
  if (doc.job && doc.job.status === 'running') {
    const age = Date.now() - new Date(doc.job.startedAt || 0).getTime();
    // a "running" job older than 20 min is a server restart, not a job — take
    // it over, or a crash wedges the doc forever
    if (age < 20 * 60 * 1000) throw new Error(`a "${doc.job.kind}" job is already running`);
  }
  const job = { kind, status: 'running', done: 0, total: 0, label: 'starting', error: null, startedAt: nowIso() };
  await patchDoc(id, { job });
  (async () => {
    let lastSave = 0;
    const progress = async (done, total, label) => {
      Object.assign(job, { done, total, label });
      if (Date.now() - lastSave > 1500) {      // throttled — never a write per step
        lastSave = Date.now();
        await patchDoc(id, { job }).catch(() => {});
      }
    };
    try {
      await fn(progress);
      Object.assign(job, { status: 'done', label: 'done' });
    } catch (err) {
      console.warn(`pausing: job ${kind} failed —`, err.message);
      Object.assign(job, { status: 'error', error: err.message });
      if (kind === 'listen') await patchDoc(id, { status: 'failed', error: err.message }).catch(() => {});
    }
    await patchDoc(id, { job }).catch((e) => console.warn('pausing: save failed —', e.message));
  })();
}

// ─── the listen job: transcribe, find the pauses, bake the room tone ──
async function runListen(id, progress) {
  if (!FFMPEG) throw new Error('ffmpeg unavailable');
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  const doc = await loadDoc(id);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pausing-'));
  try {
    await progress(0, 1, 'fetching the recording');
    const local = path.join(dir, 'src');
    await cutroom.downloadTo(doc.source.url, local);
    const dur = await editor.audioDuration(local);
    if (!dur || dur < 1) throw new Error("couldn't read the recording's length");
    if (dur > MAX_SECONDS) throw new Error(`recording is ${Math.round(dur / 60)} min — Pausing caps at ${MAX_SECONDS / 60}`);

    const words = await cutroom.chunkedWords(local, dur, dir, progress);
    if (!words.length) throw new Error('no speech found in the recording');

    await progress(0, 1, 'finding the pauses');
    const prof = await cutroom.rmsProfile(local, dir);
    const sortedRef = [...prof].sort((a, b) => a - b);
    const speechRef = sortedRef[Math.floor(prof.length * 0.85)];
    const roomRanges = cutroom.roomToneCuts(prof);
    const merged = cutroom.mergeRanges([...cutroom.breathCuts(words, prof, speechRef), ...roomRanges]);
    const pauses = pausesFrom(merged, words);

    await progress(0, 1, 'keeping a piece of the room');
    const room = pickRoom(prof, roomRanges);
    const roomFile = path.join(dir, 'room.wav');
    // -ss BEFORE -i: fast seek, frame-accurate to ~26ms on mp3, which is
    // irrelevant for a stretch of air and saves decoding an hour to reach it
    await run(FFMPEG, ['-y', '-ss', room.a.toFixed(3), '-t', Math.max(0.2, room.b - room.a).toFixed(3),
      '-i', local, '-ac', '1', '-ar', '44100', roomFile], 120000);
    const roomUrl = await editor.uploadPublic(roomFile, roomPathFor(id), 'audio/wav', 'public, max-age=31536000, immutable');

    const wordsUrl = await saveJson(wordsPathFor(id), { v: 1, words });
    cache.set(id, { words });
    await patchDoc(id, {
      status: 'ready',
      error: null,
      seconds: Math.round(dur * 10) / 10,
      wordsUrl,
      roomUrl,
      room,
      pauses,
      pauseCount: pauses.length,
      wordCount: words.length,
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ─── the render: her rhythm, baked ──────────────────────────────────
// One pause piece. `span` names where its room tone comes from in `srcFile`;
// shorter than the span is a trim, longer is a repeat. Fades sit on the
// OUTER edges only — room tone is near-silent, so a fade at every repeat
// boundary pumps audibly while a butt join does not.
async function pausePiece(dir, key, srcFile, span, len) {
  const chunkLen = Math.max(0.08, Math.round((span.b - span.a) * 1000) / 1000);
  const chunk = path.join(dir, `${key}-room.wav`);
  await run(FFMPEG, ['-y', '-ss', span.a.toFixed(3), '-t', chunkLen.toFixed(3),
    '-i', srcFile, '-ac', '1', '-ar', '44100', chunk], 120000);
  if (!fs.existsSync(chunk) || fs.statSync(chunk).size < 200) throw new Error('could not read the room tone for a pause');

  const loops = Math.max(0, Math.ceil(len / chunkLen) - 1);
  const out = path.join(dir, `${key}.mp3`);
  const fade = Math.min(FADE, len / 3);
  await run(FFMPEG, ['-y', '-stream_loop', String(loops), '-i', chunk, '-t', len.toFixed(3),
    '-af', `afade=t=in:st=0:d=${fade.toFixed(3)},afade=t=out:st=${Math.max(0, len - fade).toFixed(3)}:d=${fade.toFixed(3)}`,
    '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-q:a', '2', out], 180000);
  return out;
}

async function runRender(id, progress) {
  if (!FFMPEG) throw new Error('ffmpeg unavailable');
  const doc = await loadDoc(id);
  if (!doc) throw new Error('no such project');
  const words = await loadWords(id);
  const plan = planEdit({
    pauses: doc.pauses || [], set: doc.set || {}, added: doc.added || {},
    words, dur: doc.seconds,
  });
  if (!plan.items.length) throw new Error('nothing is set yet — change a pause first');
  if (plan.items.length > MAX_ITEMS) throw new Error('too many pauses to render at once');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pausing-render-'));
  try {
    await progress(0, 3, 'fetching the recording');
    const local = path.join(dir, 'src');
    await cutroom.downloadTo(doc.source.url, local);
    const roomLocal = path.join(dir, 'room.wav');
    if (doc.roomUrl) await cutroom.downloadTo(doc.roomUrl, roomLocal);
    const roomSpan = { a: 0, b: Math.max(0.2, (doc.room && doc.room.b - doc.room.a) || 0.24) };

    // Every SPEECH span out of ONE decode. A 90-minute file re-decoded per
    // segment would be minutes of CPU for nothing, and ffmpeg will write as
    // many outputs from one input as there are labels.
    await progress(1, 3, 'cutting the speech');
    const spans = plan.pieces.filter((p) => p.type === 'audio');
    const spanFiles = spans.map((_, i) => path.join(dir, `s${i}.mp3`));
    if (spans.length) {
      const graph = spans.map((s, i) => `[0:a]atrim=start=${s.a.toFixed(3)}:end=${s.b.toFixed(3)},`
        + `asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=mono[s${i}]`).join(';');
      const outs = [];
      spans.forEach((_, i) => { outs.push('-map', `[s${i}]`, '-c:a', 'libmp3lame', '-q:a', '2', spanFiles[i]); });
      await run(FFMPEG, ['-y', '-i', local, '-filter_complex', graph, ...outs], 900000);
    }

    await progress(2, 3, 'building the pauses');
    const files = [];
    let si = 0;
    let pi = 0;
    for (const piece of plan.pieces) {
      if (piece.type === 'audio') { files.push(spanFiles[si]); si += 1; continue; }
      pi += 1;
      // src = the gap's own air; src null = the baked room tone (an added pause)
      const from = piece.src ? local : roomLocal;
      const span = piece.src || roomSpan;
      if (!piece.src && !fs.existsSync(roomLocal)) throw new Error('this recording has no room tone on file — re-open it to listen again');
      files.push(await pausePiece(dir, `p${pi}`, from, span, piece.len));
    }
    if (!files.length) throw new Error('nothing to render');

    await progress(3, 3, 'joining it up');
    // filter concat, never the concat demuxer — mp3 priming walks joins apart
    const inputs = [];
    const graph = [];
    const tags = [];
    files.forEach((f, i) => {
      inputs.push('-i', f);
      graph.push(`[${i}:a]aresample=44100,aformat=channel_layouts=mono[j${i}]`);
      tags.push(`[j${i}]`);
    });
    graph.push(`${tags.join('')}concat=n=${files.length}:v=0:a=1[out]`);
    const out = path.join(dir, 'paused.mp3');
    await run(FFMPEG, ['-y', ...inputs, '-filter_complex', graph.join(';'), '-map', '[out]',
      '-c:a', 'libmp3lame', '-q:a', '2', out], 900000);
    if (!fs.existsSync(out) || fs.statSync(out).size < 2000) throw new Error('ffmpeg wrote no audio');

    const seconds = Math.round((await editor.audioDuration(out)) * 10) / 10;
    const storagePath = `${RENDER_FOLDER}/${id}/${Date.now()}.mp3`;
    const url = await editor.uploadPublic(out, storagePath, 'audio/mpeg', 'public, max-age=31536000, immutable');
    const fresh = await loadDoc(id);
    const renders = [{ at: nowIso(), url, storagePath, seconds, changes: plan.items.length, delta: plan.delta },
      ...((fresh && fresh.renders) || [])].slice(0, MAX_RENDERS);
    await patchDoc(id, { renders });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ─── router ─────────────────────────────────────────────────────────
const router = express.Router();
router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();                       // unset → everything open
  if (req.path === '/status') return next();       // config health, always open
  const got = req.get('x-studio-token') || req.query.token || '';
  if (got !== token) return res.status(401).json({ error: 'unauthorized' });
  return next();
});
router.use(express.json({ limit: '2mb' }));

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    firebase: Boolean(admin.apps.length),
    ffmpeg: Boolean(FFMPEG),
    openai: Boolean(OPENAI_API_KEY),
  });
});

// What she can open — her own recordings, newest first, each carrying the
// project id it would resume.
router.get('/sources', async (req, res) => {
  try {
    const d = db();
    if (!d) throw new Error('Firestore unavailable');
    const snap = await d.collection(audioDrop.COL).orderBy('createdAt', 'desc').limit(120).get();
    const sources = snap.docs.map((doc) => {
      const a = doc.data();
      return {
        itemId: doc.id,
        url: a.url,
        name: a.name || a.filename || 'untitled',
        batch: a.batch || '',
        seconds: a.seconds || null,
        createdAt: a.createdAt || null,
        projectId: a.url ? projectId(a.url) : null,
      };
    }).filter((s) => s.url);
    const mine = await d.collection(COL).get();
    const open = {};
    mine.docs.forEach((doc) => { open[doc.id] = { status: doc.get('status'), title: doc.get('title') }; });
    res.json({ sources: sources.map((s) => ({ ...s, project: open[s.projectId] || null })) });
  } catch (err) { fail(res, err); }
});

router.get('/', async (req, res) => {
  try {
    const d = db();
    if (!d) throw new Error('Firestore unavailable');
    const snap = await d.collection(COL).get();
    const projects = snap.docs
      .map((doc) => {
        const p = doc.data();
        return {
          id: doc.id,
          title: p.title || 'untitled',
          status: p.status || 'new',
          seconds: p.seconds || null,
          pauseCount: p.pauseCount || 0,
          changes: Object.keys(p.set || {}).length + Object.keys(p.added || {}).length,
          renders: (p.renders || []).length,
          updatedAt: p.updatedAt || p.createdAt || '',
        };
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));   // in memory: no index needed
    res.json({ projects });
  } catch (err) { fail(res, err); }
});

// Open (or resume). Content-addressed by the source url, so the same
// recording is always the same project.
router.post('/open', async (req, res) => {
  try {
    const url = String((req.body && req.body.url) || '').trim();
    if (!/^https?:\/\//.test(url)) throw new Error('a recording url is required');
    const name = String((req.body && req.body.name) || '').slice(0, 120).trim();
    const id = projectId(url);
    const existing = await loadDoc(id);
    if (!existing) {
      await patchDoc(id, {
        id,
        title: name || 'untitled',
        source: { url, name, itemId: (req.body && req.body.itemId) || null },
        status: 'new',
        error: null,
        set: {},
        added: {},
        pauses: [],
        renders: [],
        job: null,
        createdAt: nowIso(),
      });
      await startJob(id, 'listen', (progress) => runListen(id, progress));
      return res.json({ id, started: true });
    }
    // re-POSTing while a job runs returns the existing doc, never a second job
    if (existing.status === 'failed' && !(existing.job && existing.job.status === 'running')) {
      await startJob(id, 'listen', (progress) => runListen(id, progress));
      return res.json({ id, started: true });
    }
    res.json({ id, started: false });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such project' });
    res.json({ project: doc });
  } catch (err) { fail(res, err); }
});

// Her marking state. ONE route, a whitelist, merged field by field — the page
// owns what a gesture means, this owns that it survives. `set` and `added`
// are replaced wholesale (they are small maps and the page always holds the
// whole thing); everything else on the doc is server-owned.
const EDITABLE = ['set', 'added'];
const MAX_STATE = 120 * 1024;
router.post('/:id/state', async (req, res) => {
  try {
    const patch = (req.body && req.body.patch) || {};
    const clean = {};
    for (const k of EDITABLE) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) clean[k] = patch[k];
    }
    if (!Object.keys(clean).length) return res.status(400).json({ error: 'nothing to save' });
    if (JSON.stringify(clean).length > MAX_STATE) throw new Error('that is too much state for one save');
    await patchDoc(req.params.id, clean);
    res.json({ ok: true, saved: Object.keys(clean) });
  } catch (err) { fail(res, err); }
});

// Her edit as the render will perform it. Free — no ffmpeg, no model call —
// so the page can check its own preview against the server's plan without
// paying for the answer.
router.get('/:id/plan', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such project' });
    if (doc.status !== 'ready') return res.json({ items: [], pieces: [], total: 0, delta: 0, status: doc.status });
    const words = await loadWords(req.params.id);
    const plan = planEdit({
      pauses: doc.pauses || [], set: doc.set || {}, added: doc.added || {},
      words, dur: doc.seconds,
    });
    res.json({ ...plan, status: doc.status });
  } catch (err) { fail(res, err); }
});

router.post('/:id/title', async (req, res) => {
  try {
    const title = String((req.body && req.body.title) || '').slice(0, 120).trim();
    if (!title) return res.status(400).json({ error: 'a title is required' });
    await patchDoc(req.params.id, { title });
    res.json({ ok: true, title });
  } catch (err) { fail(res, err); }
});

router.post('/:id/render', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such project' });
    if (doc.status !== 'ready') throw new Error('this recording is still being read');
    await startJob(req.params.id, 'render', (progress) => runRender(req.params.id, progress));
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/:id/job', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such project' });
    res.json({ job: doc.job || null, status: doc.status || 'new', renders: doc.renders || [] });
  } catch (err) { fail(res, err); }
});

router.delete('/:id', async (req, res) => {
  try {
    const d = db();
    if (!d) throw new Error('Firestore unavailable');
    await d.collection(COL).doc(String(req.params.id)).delete();
    cache.delete(req.params.id);
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

module.exports = {
  router,
  // exported for scripts/test-pausing.js — the pure halves, no network
  pausesFrom, pickRoom, projectId, MIN_PAUSE,
};
