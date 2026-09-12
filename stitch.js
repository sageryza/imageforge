'use strict';
// stitch.js — STITCH: pick clips, put them in order, ffmpeg joins them
// (2026-09-12, Sophie: "something very simple. We're just select clips and
// then move them around and ffmpeg e.g. stitches them together or something.
// it could be called stitch").
//
// WHY A THIRD JOINING TOOL. Assembly (a tray, a timeline, place indicators)
// "never really worked" and the Film Editor (split · trim · sync · a sound
// lane · a transport) was the one that never worked for her either — both
// carry more than the job in front of her, which is putting this morning's
// doctor's-office takes in story order. So this is the Film Editor with
// everything but ORDER removed: her Footage clips to pick from, one row per
// picked clip with arrows and a number, ✕ to drop one, one button. No trim
// (that is on Footage), no sound lane, no stills, no timeline, no dragging.
//
// IT COSTS NOTHING. The clips are already drawn and on the Footage log; a
// stitch is ffmpeg on our own box — filmeditor.js's own `renderCut`, the
// SAME segment bank in Storage (a clip stitched twice encodes once, and a
// clip banked by the Film Editor is a hit here), the same one-canvas
// concat-copy join with the audio as one PCM track encoded to AAC once at
// the mux. A stitch doc IS a cut with one lane, so the shape is cut-model's
// (`clips`: key · kind · url · title · poster · seconds · in · out), which is
// what lets the render be the Film Editor's render rather than a fourth
// copy of the recipe.
//
// WHAT SHE CAN PICK: every finished clip on the Footage log — the page's own
// and the chats' — narrowed by project and folder exactly as Footage narrows
// its feed, and EVERY TRIMMED PART as a pickable of its own beside the whole
// clip (the chamomile skipping clip is two parts she cut, and the parts are
// what go in the film). `pickables` is the one rule, pure.
//
// NOTHING IS DELETED — `hidden` is the verb; renders never overwrite
// (`stitch/<id>/film-<n>.mp4`, the Film Editor's own numbering), the newest
// first on the doc, capped; `stitch/` is on clips.js's SKIP_PREFIXES so a
// film made OF clips is never harvested back onto the shelf as one.
//
// Routes (mounted at /api/stitch by server.js, STUDIO_TOKEN gate, /status open):
//   GET    /status            → { ok, firebase, ffmpeg, stitches }
//   GET    /                  → { stitches } — newest touched first, hidden out
//   GET    /clips?project=&folder=&limit=  → { clips } — the pickables, newest first
//   POST   /                  → { title?, project? } → { id, title }
//   GET    /:id               → the doc
//   POST   /:id/clips         → { clips:[…] } — the WHOLE order (order and
//                               membership change together, so a partial write
//                               could never be right)
//   POST   /:id/title         → { title }
//   POST   /:id/hide          → { hidden: true|false }
//   POST   /:id/render        → stitch it (background job on the doc)
//   GET    /:id/job           → { job, renders }
//
// Tests: node scripts/test-stitch.js (pure, then the real page headless).

const express = require('express');
const admin = require('firebase-admin');
const fs = require('fs');
const os = require('os');
const path = require('path');

const editor = require('./editor');           // uploadPublic
const filmeditor = require('./filmeditor');   // renderCut — the ONE recipe, and its segment bank
const footage = require('./footage');         // cardOf / trimsOf / statusOf — the log's own readers
const videoLog = require('./video-log');      // COLL — the Footage log
const CutModel = require('./cut-model');

// ffmpeg is resolved the way every sibling resolves it (assembly.js): the
// static npm binary first, then env/PATH. Only /status reads it here — the
// render itself runs inside filmeditor.renderCut, which resolves its own.
function tryRequire(name) { try { return require(name); } catch { return null; } }
function usable(p) { if (!p) return null; try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { return null; } }
function firstOnPath(bin) {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const p = path.join(dir, bin);
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { /* keep looking */ }
  }
  return null;
}
const FFMPEG = process.env.FFMPEG_PATH || usable(tryRequire('ffmpeg-static')) || firstOnPath('ffmpeg');

const COL = process.env.STITCH_COLLECTION || 'forge-stitches';
const STORAGE_FOLDER = 'stitch';
const MAX_CLIPS = 60;
const MAX_RENDERS = 12;
const PICK_LIMIT = 300;

function db() { return admin.apps.length ? admin.firestore() : null; }
function fail(res, err) { console.warn('stitch:', err.message); res.status(500).json({ error: err.message }); }
const nowIso = () => new Date().toISOString();

// ── Pure pieces (exported for the tests and mirrored on the page) ──────────

// A short name for a clip off its prompt — the first few words, the way the
// card's own line reads. Never the url.
function titleOf(prompt, n) {
  const words = String(prompt || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const cut = words.slice(0, n || 7).join(' ');
  return cut + (words.length > (n || 7) ? '…' : '');
}

// THE PICKABLES: a finished clip is one, and every BAKED part she cut out of
// it is one more beside it. Takes the cards `footage.cardOf` answers (so the
// project, the folder, the vote and the parts are read the way Footage reads
// them) and returns what the page tiles, newest first. A drawing or failed
// clip, a hidden one, one with no url, and a part still baking are all out.
function pickables(cards) {
  const out = [];
  (Array.isArray(cards) ? cards : []).forEach((c) => {
    if (!c || c.status !== 'done' || c.hidden) return;
    const whole = c.source || c.video;
    if (!/^https:\/\//.test(String(whole || ''))) return;
    const base = {
      job: c.id, prompt: c.prompt || '', title: titleOf(c.prompt),
      project: c.project || '', folder: c.folder || '', sentAt: c.sentAt || '',
      vote: c.vote || '', chat: c.chat || '', ratio: c.ratio || '',
    };
    const parts = (c.trims || []).filter((t) => t && t.status === 'ready' && /^https:\/\//.test(String(t.url || '')));
    parts.forEach((t, i) => {
      out.push({
        ...base,
        id: c.id + ':' + t.key, url: t.url, poster: t.poster || c.poster || '',
        seconds: Number(t.seconds) || Math.max(0, (Number(t.end) || 0) - (Number(t.start) || 0)),
        part: i + 1, parts: parts.length, title: base.title + ' · part ' + (i + 1),
      });
    });
    out.push({
      ...base,
      id: c.id, url: whole, poster: c.poster || '',
      seconds: Number(c.seconds) || 0,
      part: 0, parts: parts.length, title: parts.length ? base.title + ' · whole' : base.title,
    });
  });
  return out.sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
}

// ORDER ARITHMETIC — the page's whole interaction, kept here so the test
// pins it. Pure; every one returns a new list and never a longer or shorter
// one.
function moveBy(list, i, delta) {
  const n = list.length, from = Math.floor(i);
  if (from < 0 || from >= n) return list.slice();
  const to = Math.max(0, Math.min(n - 1, from + delta));
  if (to === from) return list.slice();
  const out = list.slice();
  const [it] = out.splice(from, 1);
  out.splice(to, 0, it);
  return out;
}
// A typed number is 1-based and clamps: "0" and "99" both mean the ends.
function moveTo(list, i, number) {
  const to = Math.max(1, Math.min(list.length, Math.floor(Number(number) || 1))) - 1;
  return moveBy(list, i, to - Math.floor(i));
}
function dropAt(list, i) {
  const from = Math.floor(i);
  if (from < 0 || from >= list.length) return list.slice();
  return list.slice(0, from).concat(list.slice(from + 1));
}
// Adding a pickable: appended, ONE entry per pickable id (a second tap on a
// tile is a no-op — the tile shows its number instead of adding a twin).
function addPick(list, pick) {
  if (!pick || !pick.id || list.some((c) => c.key === pick.id)) return list.slice();
  if (list.length >= MAX_CLIPS) return list.slice();
  return list.concat([clipOf(pick)]);
}
// A pickable → a cut-model piece: whole clip, in 0, out its length.
function clipOf(p) {
  return {
    key: String(p.id).slice(0, 40), kind: 'video', url: String(p.url).slice(0, 500),
    title: String(p.title || '').slice(0, 200), poster: p.poster ? String(p.poster).slice(0, 500) : null,
    seconds: Number(p.seconds) > 0 ? Number(p.seconds) : null,
    in: 0, out: Number(p.seconds) > 0 ? Number(p.seconds) : 0,
  };
}
// The saved order: cut-model's own cleaner over the picture lane, capped.
function cleanClips(list) {
  return CutModel.cleanPieces((Array.isArray(list) ? list : []).slice(0, MAX_CLIPS).map((c) => ({ ...c, kind: 'video', in: 0 })));
}
const totalSeconds = (clips) => CutModel.totalSeconds(clips || []);

const trimmed = (s) => ({
  id: s.id, title: s.title || '', project: s.project || '',
  clips: (s.clips || []).length, seconds: Math.round(totalSeconds(s.clips) * 10) / 10,
  renders: (s.renders || []).length,
  poster: ((s.clips || [])[0] || {}).poster || null,
  newest: ((s.renders || [])[0] || {}).url || null,
  job: s.job && s.job.status === 'running' ? { kind: s.job.kind, label: s.job.label } : null,
  hidden: Boolean(s.hidden),
  updatedAt: s.updatedAt || 0,
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
    if (!snap.exists) throw new Error('no such stitch');
    const value = fn(snap.data()[field], snap.data());
    tx.update(ref, { [field]: JSON.parse(JSON.stringify(value)), updatedAt: Date.now() });
    return value;
  });
}

// Background jobs — startJob with the stale-takeover, patching FIELDS only.
async function startJob(id, kind, fn) {
  const doc = await loadDoc(id);
  if (!doc) throw new Error('no such stitch');
  if (doc.job && doc.job.status === 'running') {
    const age = Date.now() - new Date(doc.job.startedAt || 0).getTime();
    if (age < 20 * 60 * 1000) throw new Error('already stitching');
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
      console.warn(`stitch: job ${kind} failed —`, err.message);
      Object.assign(job, { status: 'error', error: err.message });
    }
    await patchDoc(id, { job }).catch((e) => console.warn('stitch: save failed —', e.message));
  })();
}

// ─── the render job — the Film Editor's own recipe over the one lane ────────
async function runRender(id, progress) {
  const doc = await loadDoc(id);
  if (!doc) throw new Error('no such stitch');
  const clips = cleanClips(doc.clips || []);
  if (!clips.length) throw new Error('nothing picked yet');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stitch-'));
  try {
    const r = await filmeditor.renderCut({ clips, sounds: [] }, { dir, progress });
    await progress(clips.length + 1, clips.length + 2, 'publishing');
    const n = filmeditor.nextRenderIndex(doc.renders);
    const url = await editor.uploadPublic(r.file, `${STORAGE_FOLDER}/${id}/film-${n}.mp4`, 'video/mp4');
    const render = {
      url, at: Date.now(), seconds: r.seconds, clips: clips.length,
      width: r.width, height: r.height, banked: r.banked || 0,
      cut: { clips: r.clips },
    };
    await txField(id, 'renders', (cur) => [render].concat(Array.isArray(cur) ? cur : []).slice(0, MAX_RENDERS));
    return render;
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
  let stitches = null;
  try { stitches = (await db().collection(COL).count().get()).data().count; } catch { /* unconfigured */ }
  res.json({ ok: true, firebase: admin.apps.length > 0, ffmpeg: Boolean(FFMPEG), stitches });
});

router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const snap = await db().collection(COL).get();
    const stitches = snap.docs.map((s) => trimmed({ id: s.id, ...s.data() }))
      .filter((s) => !s.hidden)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    res.json({ stitches });
  } catch (err) { fail(res, err); }
});

// THE PICKABLES — the Footage log read the way Footage reads it (one read,
// filtered by project/folder before the cut, newest first). MUST stay above
// GET /:id or Express reads "clips" as a stitch id.
router.get('/clips', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const snap = await db().collection(videoLog.COLL).get();
    const project = String(req.query.project || '').trim();
    const folder = project ? String(req.query.folder || '').trim() : '';
    const cards = snap.docs.map((d) => footage.cardOf(d.id, d.data()))
      .filter((c) => (!project || c.project === project) && (!folder || c.folder === folder));
    const lim = Math.min(Number(req.query.limit) || PICK_LIMIT, PICK_LIMIT);
    res.json({ ok: true, clips: pickables(cards).slice(0, lim) });
  } catch (err) { fail(res, err); }
});

router.post('/', async (req, res) => {
  try {
    const d = db();
    if (!d) throw new Error('Firebase unavailable');
    const ref = d.collection(COL).doc();
    const PT = { timeZone: 'America/Los_Angeles' };
    const title = String((req.body || {}).title || '').trim().slice(0, 120)
      || 'Stitch · ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...PT })
      + ' · ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...PT }).toLowerCase();
    const now = Date.now();
    await ref.set({
      id: ref.id, title, project: String((req.body || {}).project || '').slice(0, 80),
      clips: [], renders: [], job: null, hidden: false, createdAt: now, updatedAt: now,
    });
    res.json({ id: ref.id, title });
  } catch (err) { fail(res, err); }
});

router.get('/:id', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such stitch' });
    res.json(doc);
  } catch (err) { fail(res, err); }
});

router.get('/:id/job', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such stitch' });
    res.json({ job: doc.job || null, renders: doc.renders || [] });
  } catch (err) { fail(res, err); }
});

router.post('/:id/clips', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such stitch' });
    if (!('clips' in (req.body || {}))) return res.status(400).json({ error: 'nothing to save' });
    const clips = cleanClips(req.body.clips);
    await patchDoc(req.params.id, { clips });
    res.json({ ok: true, clips: clips.length, seconds: totalSeconds(clips) });
  } catch (err) { fail(res, err); }
});

router.post('/:id/title', async (req, res) => {
  try {
    const title = String((req.body || {}).title || '').slice(0, 120).trim();
    if (!title) return res.status(400).json({ error: 'a title is required' });
    await patchDoc(req.params.id, { title });
    res.json({ ok: true, title });
  } catch (err) { fail(res, err); }
});

router.post('/:id/hide', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such stitch' });
    const hidden = (req.body || {}).hidden !== false;
    await patchDoc(req.params.id, { hidden });
    res.json({ ok: true, hidden });
  } catch (err) { fail(res, err); }
});

router.post('/:id/render', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such stitch' });
    if (!cleanClips(doc.clips || []).length) return res.status(400).json({ error: 'nothing picked yet' });
    await startJob(req.params.id, 'render', (progress) => runRender(req.params.id, progress));
    res.json({ ok: true, status: 'stitching' });
  } catch (err) { fail(res, err); }
});

module.exports = {
  router, COL, STORAGE_FOLDER,
  pickables, titleOf, moveBy, moveTo, dropAt, addPick, clipOf, cleanClips, totalSeconds, trimmed,
  MAX_CLIPS, MAX_RENDERS,
};
