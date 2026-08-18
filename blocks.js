// blocks.js — CUTTING BLOCKS: the top of the audio pipeline, and the first
// room the walk actually starts in. A recording comes in; it comes apart into
// sentence-level LINES she can take apart, throw out, hesitate over, reorder,
// respeak, and hear as she has marked it — before anything is cut for real.
//
// WHY IT EXISTS. This surface already existed and was the most-featured
// cutting surface in the repo, but it was a hand-authored Compare page
// re-posted at v14 (~87KB), with no module, no doc of its own, and its whole
// marking state stuffed into a chat's verdict fields. Five things could only
// be done there — split a line in two, meld two into one, mark a line "not
// sure" instead of keep-or-cut, hear the whole thing as marked before
// rendering, and say who speaks a line — so improving any of them cost a chat
// re-authoring the artifact. See docs/audio-pipeline.md for the full diff.
//
// THE MODEL, and why the server holds so little of it. A card is a list of
// SEGMENTS over the source words — {b, a, z} meaning "words a..z-1 of block
// b". A split is one segment list becoming two; a meld is two becoming one.
// Nothing is ever re-typed, so the text on screen is always literally what she
// said. That mutation logic lives in the PAGE (it is the artifact's, proven
// over fourteen versions); this module owns the three things a page cannot:
// getting the blocks in the first place, persisting her state, and cutting the
// real audio. `POST /:id/state` takes a whitelisted patch and merges it — one
// route instead of a route per gesture, so a new gesture in the page needs no
// server change.
//
// TIMINGS ARE TWO-TIER, deliberately, and this is the Cutting Room's finding
// re-used rather than re-learned. The bulk 75s-chunked whisper pass is good
// enough to place a line and to preview it, and NOT good enough to cut on
// (its first Cutting Room clip started a word early and grabbed the phrase
// before it). So ▶ on a card and "hear it as marked" play pro-rata spans of
// the source, while the REAL render re-listens to a small window per card with
// a fresh whisper pass and locates the words in THOSE timestamps, then
// clampBounds + snapToSilence — the Episode Editor's validated cutter, imported
// from editor.js, never re-implemented here.
//
// HER VOICE IS NEVER LOUDNORMED (the narration finding). Micro-fades on join
// edges only.
//
// Data: one doc per project in `forge-blocks` (deckfactory), content-addressed
// by a hash of the source url, so re-opening the same recording resumes the
// same project instead of piling up copies. The words and the blocks live in
// Storage (`blocks/<id>/words.json`, `blocks/<id>/blocks.json`) — a 90-minute
// recording's words would bloat the doc; only her marking state, which is what
// changes, sits on the doc itself.
//
// Money: opening a project transcribes (~$0.006/min of audio, once ever per
// recording). A typed line spoken in her voice is an ElevenLabs call, cached by
// text. Rendering is ffmpeg on our own box — free. Nothing here spends on load.
//
// Routes (mounted at /api/blocks, STUDIO_TOKEN gate, only /status open):
//   GET    /status          → { ok, firebase, ffmpeg, openai }
//   GET    /sources         → recordings she can open (audio library + memos)
//   GET    /                → { projects }
//   POST   /open            → { url, name? } → { id } — create/resume, starts
//                             the listen job on a first open
//   GET    /:id             → the doc (+ blocksUrl, wordsUrl)
//   POST   /:id/state       → { patch } — merge a whitelisted slice of her
//                             marking state (marks/custom/whoOver/added/…)
//   POST   /:id/title       → { title }
//   POST   /:id/line        → { url, text } — a spoken line handed in from
//                             another room (the Voice Studio); lands as an
//                             added line with its audio already rendered
//   POST   /:id/render      → bake the cut she has marked (background job)
//   GET    /:id/job         → { job, renders }
//   DELETE /:id             → remove the project (Storage files stay)

const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

const editor = require('./editor');
const cutroom = require('./cuttingroom');
const audioDrop = require('./audio');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const COL = process.env.BLOCKS_COLLECTION || 'forge-blocks';
const STORAGE_FOLDER = 'blocks';
const RENDER_FOLDER = `${STORAGE_FOLDER}/renders`;
const MAX_SECONDS = 5400;   // 90 min, the Cutting Room's cap — same reasoning
const MAX_RENDERS = 8;
const MAX_BLOCK_WORDS = 30; // a line longer than this is split at its widest gap
const BLOCK_GAP = 0.62;     // seconds of silence that end a line on their own

const FFMPEG = editor.FFMPEG;
const run = editor.run;

function db() { return admin.apps.length ? admin.firestore() : null; }
function bucket() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}
function fail(res, err) {
  console.warn('blocks:', err.message);
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

// ─── words + blocks live in Storage ─────────────────────────────────
const cache = new Map(); // id → { words, blocks }
function bump(id, val) {
  cache.set(id, { ...(cache.get(id) || {}), ...val });
  if (cache.size > 4) cache.delete(cache.keys().next().value);
}
const wordsPathFor = (id) => `${STORAGE_FOLDER}/${id}/words.json`;
const blocksPathFor = (id) => `${STORAGE_FOLDER}/${id}/blocks.json`;

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
async function readJson(storagePath) {
  const [buf] = await bucket().file(storagePath).download();
  return JSON.parse(buf.toString('utf8'));
}
async function loadWords(id) {
  const hit = cache.get(id);
  if (hit && hit.words) return hit.words;
  const words = (await readJson(wordsPathFor(id))).words || [];
  bump(id, { words });
  return words;
}
async function loadBlocks(id) {
  const hit = cache.get(id);
  if (hit && hit.blocks) return hit.blocks;
  const blocks = (await readJson(blocksPathFor(id))).blocks || [];
  bump(id, { blocks });
  return blocks;
}

// ─── words → LINES ──────────────────────────────────────────────────
// A block is one sentence-ish line. Three things end one, in this order:
// sentence punctuation (whisper-1 returns it on some words and not others,
// so it is a hint and never the only rule), a real gap in the audio, and a
// hard word cap so a run-on paragraph still arrives as something tappable.
//
// EVERY BLOCK REMEMBERS ITS WORD RANGE IN THE SOURCE (wi0/wi1). That is what
// lets the render walk back from a card's segments to the ORIGINAL words and
// re-listen to them — a block that only knew its own text would have to
// string-match its way home.
const ENDS = /[.!?]["')\]]*$/;
function makeBlocks(words) {
  const blocks = [];
  let cur = [];
  let start = 0;
  const flush = () => {
    if (!cur.length) return;
    const wi0 = start;
    const wi1 = start + cur.length - 1;
    const t0 = words[wi0].start;
    const t1 = words[wi1].end;
    blocks.push({
      id: `b${String(blocks.length).padStart(2, '0')}`,
      who: 'you',
      wi0,
      wi1,
      t0: Math.round(t0 * 100) / 100,
      t1: Math.round(Math.max(t1, t0 + 0.2) * 100) / 100,
      dur: Math.round(Math.max(t1 - t0, 0.2) * 100) / 100,
      words: cur.map((w) => w.word),
    });
    cur = [];
  };
  words.forEach((w, i) => {
    if (!cur.length) start = i;
    cur.push(w);
    const next = words[i + 1];
    const gap = next ? next.start - w.end : 999;
    if (ENDS.test(w.word) || gap >= BLOCK_GAP || cur.length >= MAX_BLOCK_WORDS) flush();
  });
  flush();
  return blocks;
}

// Paragraphs. She reads at the level of the shape of the thing, not the
// sentence (the progressive-expansion rule), so the page opens folded to
// these and expands only where she goes in. Grouped on the LONGEST pauses,
// which is where a recording actually changes subject, aiming at ~8 lines a
// paragraph rather than a fixed count.
function makeSections(blocks) {
  if (!blocks.length) return [];
  const target = Math.max(1, Math.round(blocks.length / 8));
  const gaps = blocks
    .slice(1)
    .map((b, i) => ({ at: i + 1, gap: b.t0 - blocks[i].t1 }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, Math.max(0, target - 1))
    .map((g) => g.at)
    .sort((a, b) => a - b);
  const cuts = [0, ...gaps, blocks.length];
  const secs = [];
  for (let i = 0; i + 1 < cuts.length; i += 1) {
    const span = blocks.slice(cuts[i], cuts[i + 1]);
    if (!span.length) continue;
    secs.push({
      key: `s${secs.length}`,
      // the paragraph's own first words — never a model call, never invented
      title: span[0].words.slice(0, 6).join(' ').replace(/[.,!?]+$/, ''),
      blocks: span.map((b) => b.id),
    });
  }
  return secs;
}

// ─── a spoken line arriving from another room ───────────────────────
// The page numbers the lines she types n0, n1, … and derives the next free
// number by scanning what it drew. A line added from OUTSIDE the page (the
// Voice Studio hand-off) must mint an id the page can never mint again, so
// scan every place an id can live — a line can be in `order` after its
// `added` entry was edited away, and vice versa.
function nextLineId(added, ttsUrls, order) {
  let n = 0;
  [].concat(Object.keys(added || {}), Object.keys(ttsUrls || {}), Array.isArray(order) ? order : [])
    .forEach((k) => {
      const m = /^n(\d+)$/.exec(String(k));
      if (m) n = Math.max(n, Number(m[1]) + 1);
    });
  return `n${n}`;
}

// ─── background jobs (the editor.js startJob pattern, on this collection) ──
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
      if (Date.now() - lastSave > 1500) {   // throttled — never a write per step
        lastSave = Date.now();
        await patchDoc(id, { job }).catch(() => {});
      }
    };
    try {
      await fn(progress);
      Object.assign(job, { status: 'done', label: 'done' });
    } catch (err) {
      console.warn(`blocks: job ${kind} failed —`, err.message);
      Object.assign(job, { status: 'error', error: err.message });
      if (kind === 'listen') await patchDoc(id, { status: 'failed', error: err.message }).catch(() => {});
    }
    await patchDoc(id, { job }).catch((e) => console.warn('blocks: save failed —', e.message));
  })();
}

// ─── the listen job: transcribe, then break it into lines ───────────
async function runListen(id, progress) {
  if (!FFMPEG) throw new Error('ffmpeg unavailable');
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  const doc = await loadDoc(id);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blocks-'));
  try {
    await progress(0, 1, 'fetching the recording');
    const local = path.join(dir, 'src');
    await cutroom.downloadTo(doc.source.url, local);
    const dur = await editor.audioDuration(local);
    if (!dur || dur < 1) throw new Error("couldn't read the recording's length");
    if (dur > MAX_SECONDS) throw new Error(`recording is ${Math.round(dur / 60)} min — Blocks caps at ${MAX_SECONDS / 60}`);

    const words = await cutroom.chunkedWords(local, dur, dir, progress);
    if (!words.length) throw new Error('no speech found in the recording');

    await progress(0, 1, 'breaking it into lines');
    const blocks = makeBlocks(words);
    const sections = makeSections(blocks);
    const wordsUrl = await saveJson(wordsPathFor(id), { v: 1, words });
    const blocksUrl = await saveJson(blocksPathFor(id), { v: 1, blocks, sections });
    bump(id, { words, blocks });
    await patchDoc(id, {
      status: 'ready', error: null,
      seconds: Math.round(dur * 10) / 10,
      wordsUrl, blocksUrl,
      blockCount: blocks.length, sectionCount: sections.length, wordCount: words.length,
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ─── the render: her cut, made properly ─────────────────────────────
// The page hands over the cards in her order, each one a list of segments over
// the blocks (or a typed line with its already-rendered TTS url). Every spoken
// card is cut by RE-LISTENING to its own window — see the header. A typed line
// rides in as its cached narration file. One concat pass, micro-fades, no
// loudnorm.
function parseCards(body, blocks) {
  const byId = {};
  blocks.forEach((b) => { byId[b.id] = b; });
  const raw = Array.isArray(body && body.cards) ? body.cards : [];
  if (!raw.length) throw new Error('nothing is marked in');
  if (raw.length > 220) throw new Error('too many pieces to render at once');
  const cards = raw.map((c, i) => {
    if (c && c.tts) {
      if (!/^https:\/\/storage\.googleapis\.com\//.test(String(c.tts))) {
        throw new Error('a spoken line must be a storage.googleapis.com url');
      }
      return { kind: 'tts', url: String(c.tts), key: String(c.key || `n${i}`) };
    }
    const segs = (Array.isArray(c && c.segs) ? c.segs : [])
      .map((s) => ({ b: String(s && s.b), a: Math.max(0, Number(s && s.a) || 0), z: Number(s && s.z) || 0 }))
      .filter((s) => byId[s.b] && s.z > s.a);
    if (!segs.length) throw new Error('a piece has no words in it');
    return { kind: 'span', segs, key: String(c.key || `c${i}`) };
  });
  return cards;
}

// A card's segments → contiguous WORD RANGES in the source words array. Two
// segments that sit next to each other in the recording are one range, so a
// line she split and never moved is still cut as one clip and never picks up a
// join in the middle of a sentence.
function rangesOf(card, byId) {
  const idx = [];
  card.segs.forEach((s) => {
    const b = byId[s.b];
    for (let i = s.a; i < Math.min(s.z, b.words.length); i += 1) idx.push(b.wi0 + i);
  });
  idx.sort((a, b) => a - b);
  const out = [];
  idx.forEach((i) => {
    const last = out[out.length - 1];
    if (last && i === last[1] + 1) last[1] = i;
    else if (!last || i !== last[1]) out.push([i, i]);
  });
  return out;
}

async function runRender(id, cards, progress) {
  if (!FFMPEG) throw new Error('ffmpeg unavailable');
  const doc = await loadDoc(id);
  const blocks = await loadBlocks(id);
  const words = await loadWords(id);
  const byId = {};
  blocks.forEach((b) => { byId[b.id] = b; });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blocks-render-'));
  try {
    const pieces = [];
    let n = 0;
    const total = cards.length;
    for (const card of cards) {
      n += 1;
      await progress(n, total, `cutting piece ${n} of ${total}`);
      if (card.kind === 'tts') {
        const f = path.join(dir, `p${pieces.length}.mp3`);
        await cutroom.downloadTo(card.url, f);
        pieces.push(f);
        continue;
      }
      for (const [wi0, wi1] of rangesOf(card, byId)) {
        const sub = fs.mkdtempSync(path.join(dir, 'c-'));
        // the validated cutter, via the Cutting Room's re-listen wrapper —
        // one implementation of "cut these words out of this recording"
        const { file } = await cutroom.cutSection(doc, words, wi0, wi1, sub);
        const keep = path.join(dir, `p${pieces.length}.mp3`);
        fs.copyFileSync(file, keep);
        fs.rmSync(sub, { recursive: true, force: true });
        pieces.push(keep);
      }
    }
    if (!pieces.length) throw new Error('nothing to render');

    await progress(total, total, 'joining it up');
    // filter concat, never the concat demuxer — mp3 priming walks joins apart
    const inputs = [];
    const graph = [];
    const tags = [];
    pieces.forEach((f, i) => {
      inputs.push('-i', f);
      graph.push(`[${i}:a]aresample=44100,aformat=channel_layouts=mono[j${i}]`);
      tags.push(`[j${i}]`);
    });
    graph.push(`${tags.join('')}concat=n=${pieces.length}:v=0:a=1[out]`);
    const out = path.join(dir, 'cut.mp3');
    await run(FFMPEG, ['-y', ...inputs, '-filter_complex', graph.join(';'), '-map', '[out]',
      '-c:a', 'libmp3lame', '-q:a', '2', out], 900000);
    if (!fs.existsSync(out) || fs.statSync(out).size < 2000) throw new Error('ffmpeg wrote no audio');

    const seconds = Math.round((await editor.audioDuration(out)) * 10) / 10;
    const stamp = Date.now();
    const storagePath = `${RENDER_FOLDER}/${id}/${stamp}.mp3`;
    const url = await editor.uploadPublic(out, storagePath, 'audio/mpeg', 'public, max-age=31536000, immutable');
    const fresh = await loadDoc(id);
    const renders = [{ at: nowIso(), url, storagePath, seconds, pieces: pieces.length },
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

// What she can open. Her own recordings first (the audio library, which the
// share sheet and the Cutting Room both file into), newest first, each
// carrying the project id it would resume.
router.get('/sources', async (req, res) => {
  try {
    const d = db();
    if (!d) throw new Error('Firestore unavailable');
    const snap = await d.collection(audioDrop.COL).orderBy('createdAt', 'desc').limit(120).get();
    const sources = snap.docs.map((doc) => {
      const a = doc.data();
      return {
        itemId: doc.id, url: a.url, name: a.name || a.filename || 'untitled',
        batch: a.batch || '', seconds: a.seconds || null, createdAt: a.createdAt || null,
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
          id: doc.id, title: p.title || 'untitled', status: p.status || 'new',
          seconds: p.seconds || null, blockCount: p.blockCount || 0,
          renders: (p.renders || []).length, updatedAt: p.updatedAt || p.createdAt || '',
        };
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));   // sorted in memory: no index needed
    res.json({ projects });
  } catch (err) { fail(res, err); }
});

// Open (or resume) a recording. Content-addressed by the source url, so the
// same recording is always the same project.
router.post('/open', async (req, res) => {
  try {
    const url = String((req.body && req.body.url) || '').trim();
    if (!/^https?:\/\//.test(url)) throw new Error('a recording url is required');
    const id = projectId(url);
    const existing = await loadDoc(id);
    if (!existing) {
      await patchDoc(id, {
        id,
        title: String((req.body && req.body.name) || '').slice(0, 120).trim() || 'untitled',
        source: { url, name: String((req.body && req.body.name) || '').slice(0, 120), itemId: (req.body && req.body.itemId) || null },
        status: 'new', error: null,
        marks: {}, custom: {}, whoOver: {}, added: {}, ttsUrls: {}, order: [], secMeld: {}, place: {},
        renders: [], job: null, createdAt: nowIso(),
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
// owns what a split or a meld means, this owns that it survives. Anything not
// on the list (source, blockCount, renders, timings) is server-owned.
const EDITABLE = ['marks', 'custom', 'whoOver', 'added', 'ttsUrls', 'order', 'secMeld', 'place', 'sections'];
const MAX_STATE = 200 * 1024;
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

router.post('/:id/title', async (req, res) => {
  try {
    const title = String((req.body && req.body.title) || '').slice(0, 120).trim();
    if (!title) return res.status(400).json({ error: 'a title is required' });
    await patchDoc(req.params.id, { title });
    res.json({ ok: true, title });
  } catch (err) { fail(res, err); }
});

// A spoken line from another room — the Voice Studio hand-off (VOICE is one
// of the two tributaries into BLOCKS on the pipeline map, and until this
// route existed the connection meant download + re-upload by hand). The line
// lands exactly as if she had typed it and its voice were already rendered:
// an `added` entry (the words on the card) plus its `ttsUrls` mp3, minted a
// fresh n<k> id in a transaction. Field-path updates, not a map stamp, so a
// concurrent state save can't be reverted by this write — though a Blocks
// page already OPEN on this project still holds the old maps and its next
// full flush of `added`/`ttsUrls` can drop the new line; reopening shows it.
// That is the same last-writer rule every field here already lives under.
router.post('/:id/line', async (req, res) => {
  try {
    const lineUrl = String((req.body && req.body.url) || '').trim();
    const text = String((req.body && req.body.text) || '').trim().slice(0, 600);
    if (!/^https:\/\/storage\.googleapis\.com\//.test(lineUrl)) {
      return res.status(400).json({ error: 'a spoken line must be a storage.googleapis.com url' });
    }
    if (!text) return res.status(400).json({ error: 'the spoken text is required' });
    const d = db();
    if (!d) throw new Error('Firestore unavailable');
    const ref = d.collection(COL).doc(String(req.params.id));
    const lineId = await d.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('no such project');
      const id = nextLineId(snap.get('added'), snap.get('ttsUrls'), snap.get('order'));
      tx.update(ref, {
        [`added.${id}`]: text,
        [`ttsUrls.${id}`]: lineUrl,
        updatedAt: nowIso(),
      });
      return id;
    });
    res.json({ ok: true, lineId });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/:id/render', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such project' });
    if (doc.status !== 'ready') throw new Error('this recording is still being read');
    const blocks = await loadBlocks(req.params.id);
    const cards = parseCards(req.body || {}, blocks);
    await startJob(req.params.id, 'render', (progress) => runRender(req.params.id, cards, progress));
    res.json({ ok: true, pieces: cards.length });
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
  // exported for scripts/test-blocks.js — the pure halves, no network
  makeBlocks, makeSections, rangesOf, parseCards, projectId, nextLineId,
};
