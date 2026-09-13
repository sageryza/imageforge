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
// ── WHAT THE 2026-09-13 AUDIT FIXED (docs/stitch-gaps.md) ─────────────────
//
// **THE KEY IS THE WHOLE PICKABLE ID.** `cut-model.cleanPiece` capped a key
// at 40 characters and a part's id is `<job id>:<40-char sha1 trim key>` —
// 61-77 — so the stored key was a stump, every `addPick`/`pickIndex` compare
// against the full id missed, and each tap on a trimmed part appended
// ANOTHER copy while the tile never lit. All 34 parts on her log were over
// it. `keyOf` / `pickIdOf` are the one derivation now, the cap is 120, and
// the same mechanism buys a shot riding TWICE (`<id>#2`, the duplicate
// button on the row).
//
// **THE FILE IS THE TRUTH ABOUT ITS OWN LENGTH.** The log's `seconds` is the
// duration she ASKED the door for, and a Seedance clip is `24·s + 1` frames
// — so trusting it cut a frame off the tail of every shot — while a job that
// never recorded one (9 live) gave `out: 0`, which `cleanPieces` drops
// SILENTLY: the page showed "1 clip · 0:00" and the server kept none.
// `fillLengths` probes the source by Range (filmeditor's `probeUrl`, cached
// per url) before anything is saved or rendered, and a save answers
// `dropped` naming whatever still has no readable length rather than losing
// it quietly.
//
// **A DEAD JOB SAYS SO.** `jobView` marks a `running` job older than
// STALE_MS stale, so the page re-enables the button instead of showing
// "stitching…" for good after a deploy killed the render mid-way.
//
// **THE PICKER IS FOOTAGE'S, REUSED, NOT REBUILT** — its search
// (`search-grammar` + `footage-hay` over the whole log, before the page is
// cut), its `foldersOf`, its `pageJobs`-shaped paging, its tucked films and
// its ♥/✕. Every one of those is imported from `footage.js`; nothing here
// keeps a second copy of a rule that already exists debugged.
//
// NOTHING IS DELETED — `hidden` is the verb; renders never overwrite
// (`stitch/<id>/film-<n>.mp4`, the Film Editor's own numbering), the newest
// first on the doc, capped; `stitch/` is on clips.js's SKIP_PREFIXES so a
// film made OF clips is never harvested back onto the shelf as one.
//
// Routes (mounted at /api/stitch by server.js, STUDIO_TOKEN gate, /status open):
//   GET    /status            → { ok, firebase, ffmpeg, stitches, chat }
//   GET    /build             → { build } — the self-heal's stamp
//   GET    /                  → { stitches } — newest touched first, hidden out
//   GET    /clips?project=&folder=&q=&offset=&limit=
//                             → { clips, more, total, folders } — the pickables
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
const filmeditor = require('./filmeditor');   // renderCut — the ONE recipe, its segment bank, probeUrl
const footage = require('./footage');         // cardOf / foldersOf / hayOf / projectSlug — the log's own readers
const cast = require('./cast');               // tuckedFilms — one vocabulary with the picker
const grammar = require('./search-grammar');  // the feed's matcher, shared with Footage
const videoLog = require('./video-log');      // COLL — the Footage log
const pageBuild = require('./page-build');    // the self-heal's stamp
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
const CHAT = 'stitch';              // where a note on a stitch lands
const MAX_CLIPS = 60;
const MAX_RENDERS = 12;
const PICK_LIMIT = 60;              // one page of the wall
const PICK_MAX = 300;
const KEY_MAX = 120;                // cut-model's cap; a part's id is 61-77
const STALE_MS = 20 * 60 * 1000;    // a `running` job older than this is dead

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

// WHICH TAKE IS THIS — the line under a row's title, and the only thing that
// tells two takes of one scene apart (2026-09-13: 372 of her 484 pickables
// wear a title another one also wears, 53 of them reading identically, so
// nine rows of the doctor's office were nine identical lines). Seconds, the
// model's own label, and the day it was drawn, in her Pacific.
const PT = { timeZone: 'America/Los_Angeles' };
function whenOf(sentAt) {
  const t = Date.parse(String(sentAt || ''));
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...PT });
}
function markOf(p) {
  return [
    Number(p && p.seconds) > 0 ? (Math.round(Number(p.seconds) * 10) / 10) + 's' : '',
    (p && p.modelLabel) || '',
    whenOf(p && p.sentAt),
  ].filter(Boolean).join(' · ');
}

// THE PICKABLES: a finished clip is one, and every BAKED part she cut out of
// it is one more beside it. Takes the cards `footage.cardOf` answers (so the
// project, the folder, the vote and the parts are read the way Footage reads
// them) and returns what the page tiles, newest first. A drawing or failed
// clip, a hidden one, one with no url, and a part still baking are all out.
//
// `hay` rides along: the words Footage's own search reads (footage-hay.js)
// plus this pickable's own, so the instant client filter and the server's
// search over the whole log read the IDENTICAL text — one haystack, the
// Playground's own rule.
function pickables(cards) {
  const out = [];
  (Array.isArray(cards) ? cards : []).forEach((c) => {
    if (!c || c.status !== 'done' || c.hidden) return;
    const whole = c.source || c.video;
    if (!/^https:\/\//.test(String(whole || ''))) return;
    let hay = '';
    try { hay = footage.hayOf(c) || ''; } catch { hay = c.prompt || ''; }
    const base = {
      job: c.id, prompt: c.prompt || '', title: titleOf(c.prompt),
      project: c.project || '', folder: c.folder || '', sentAt: c.sentAt || '',
      vote: c.vote || '', chat: c.chat || '', ratio: c.ratio || '',
      model: c.model || '', modelLabel: c.modelLabel || '', resolution: c.resolution || '',
    };
    const parts = (c.trims || []).filter((t) => t && t.status === 'ready' && /^https:\/\//.test(String(t.url || '')));
    parts.forEach((t, i) => {
      const seconds = Number(t.seconds) || Math.max(0, (Number(t.end) || 0) - (Number(t.start) || 0));
      out.push({
        ...base,
        id: c.id + ':' + t.key, url: t.url, poster: t.poster || c.poster || '',
        seconds,
        part: i + 1, parts: parts.length, title: base.title + ' · part ' + (i + 1),
        hay: hay + '  trimmed part ' + (i + 1),
        mark: markOf({ seconds, modelLabel: base.modelLabel, sentAt: base.sentAt }) + ' · part ' + (i + 1),
      });
    });
    const seconds = Number(c.seconds) || 0;
    out.push({
      ...base,
      id: c.id, url: whole, poster: c.poster || '',
      seconds,
      part: 0, parts: parts.length, title: parts.length ? base.title + ' · whole' : base.title,
      hay: hay + (parts.length ? '  whole clip' : ''),
      mark: markOf({ seconds, modelLabel: base.modelLabel, sentAt: base.sentAt }) + (parts.length ? ' · whole' : ''),
    });
  });
  return out.sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
}

// ── THE KEY: THE WHOLE PICKABLE ID, AND `#n` FOR A SHOT THAT RIDES AGAIN ──
// One derivation, so `addPick`, the tile's own number and the page's mirror
// can never disagree about which piece is which pickable. Truncating this to
// cut-model's old 40 is what made every trimmed part unpickable.
function keyOf(pickId, n) { return Number(n) > 1 ? `${pickId}#${Math.floor(n)}` : String(pickId); }
function pickIdOf(key) {
  const s = String(key || '');
  const i = s.lastIndexOf('#');
  return i > 0 && /^\d+$/.test(s.slice(i + 1)) ? s.slice(0, i) : s;
}
function nextInstance(list, pickId) {
  const keys = new Set((list || []).map((c) => c.key));
  let n = 1;
  while (keys.has(keyOf(pickId, n))) n++;
  return n;
}
// pickable id → the 1-based places it sits in the order. A tile shows them
// all ("2, 5"), so a shot used twice reads as used twice.
function placesOf(list) {
  const out = {};
  (list || []).forEach((c, i) => {
    const p = pickIdOf(c.key);
    (out[p] = out[p] || []).push(i + 1);
  });
  return out;
}

// ORDER ARITHMETIC — the page's whole interaction, kept here so the test
// pins it. Pure; every one returns a new list.
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
// USE THIS SHOT AGAIN — a copy of the piece at `i`, right after itself, with
// its own instance key. The one way a cutaway rides twice; the tile stays a
// plain toggle.
function dupAt(list, i) {
  const from = Math.floor(i);
  if (from < 0 || from >= list.length || list.length >= MAX_CLIPS) return list.slice();
  const src = list[from];
  const copy = { ...src, key: keyOf(pickIdOf(src.key), nextInstance(list, pickIdOf(src.key))) };
  return list.slice(0, from + 1).concat([copy], list.slice(from + 1));
}
// Adding a pickable: appended. A pickable already in the order is a no-op —
// the tile shows its place instead — and `again` is the duplicate path.
function addPick(list, pick, opts) {
  if (!pick || !pick.id) return list.slice();
  if (list.length >= MAX_CLIPS) return list.slice();
  const id = String(pick.id);
  const again = Boolean(opts && opts.again);
  if (!again && list.some((c) => pickIdOf(c.key) === id)) return list.slice();
  return list.concat([clipOf(pick, nextInstance(list, id))]);
}
// The tile's second tap: every instance of that pickable comes out.
function dropPick(list, pickId) {
  const id = String(pickId);
  return (list || []).filter((c) => pickIdOf(c.key) !== id);
}
// A pickable → a cut-model piece: the whole clip, in 0, out its length.
function clipOf(p, n) {
  const sec = Number(p.seconds) > 0 ? Number(p.seconds) : null;
  return {
    key: String(keyOf(p.id, n || 1)).slice(0, KEY_MAX), kind: 'video', url: String(p.url).slice(0, 500),
    title: String(p.title || '').slice(0, 200), poster: p.poster ? String(p.poster).slice(0, 500) : null,
    seconds: sec,
    in: 0, out: sec || 0,
  };
}
// The saved order: cut-model's own cleaner over the picture lane, capped.
function cleanClips(list) {
  return CutModel.cleanPieces((Array.isArray(list) ? list : []).slice(0, MAX_CLIPS).map((c) => ({ ...c, kind: 'video', in: 0 })));
}
const totalSeconds = (clips) => CutModel.totalSeconds(clips || []);

// ── THE FILE IS THE TRUTH ABOUT ITS OWN LENGTH ────────────────────────────
// `footage.cardOf` answers the duration she ASKED the door for, and a clip
// is `24·s + 1` frames — so a "4s" clip is 4.042s and rendering it to `out:4`
// loses its last frame. A job that recorded no duration at all (9 live) gives
// `out: 0`, which `cleanPieces` drops silently: the page showed the row and
// the server kept nothing. Both are the same answer — probe the source.
//
// ffprobe reads an mp4's moov by Range (filmeditor's `probeUrl`), so this is
// a few KB per clip, and the cache means a url is read once per boot.
const lenCache = new Map();
async function realSeconds(url) {
  const u = String(url || '');
  if (lenCache.has(u)) return lenCache.get(u);
  let s = 0;
  try {
    const p = await filmeditor.probeUrl(u);
    if (p && Number(p.seconds) > 0) s = Math.round(Number(p.seconds) * 1000) / 1000;
  } catch (err) { console.warn('stitch: probe failed —', err.message); }
  lenCache.set(u, s);
  return s;
}
// `only:'unknown'` fills just the ones `cleanPieces` would drop (rare, so a
// save stays a save); the render fills every one, off the same cache.
async function fillLengths(list, opts) {
  const only = (opts || {}).only;
  const rows = Array.isArray(list) ? list : [];
  const want = rows.map((c) => only === 'unknown' ? !(Number(c.seconds) > 0 && Number(c.out) > 0) : true);
  const urls = Array.from(new Set(rows.filter((c, i) => want[i]).map((c) => String(c.url || ''))));
  const found = new Map();
  await Promise.all(urls.map(async (u) => { found.set(u, await realSeconds(u)); }));
  return rows.map((c, i) => {
    if (!want[i]) return c;
    const s = found.get(String(c.url || '')) || 0;
    return s > 0 ? { ...c, seconds: s, in: 0, out: s } : c;
  });
}

// A `running` job nothing is running any more — the instance that held it was
// swapped out by a deploy. The page reads this and re-enables Stitch rather
// than showing "stitching…" for good (the Film Editor's own 2026-09-05
// complaint, which had no answer here).
function jobView(job) {
  if (!job || job.status !== 'running') return job || null;
  const age = Date.now() - new Date(job.startedAt || 0).getTime();
  return age > STALE_MS ? { ...job, status: 'error', stale: true, error: 'that render was interrupted — stitch it again' } : job;
}

const trimmed = (s) => ({
  id: s.id, title: s.title || '', project: s.project || '',
  clips: (s.clips || []).length, seconds: Math.round(totalSeconds(s.clips) * 10) / 10,
  renders: (s.renders || []).length,
  poster: ((s.clips || [])[0] || {}).poster || null,
  newest: ((s.renders || [])[0] || {}).url || null,
  newestAt: ((s.renders || [])[0] || {}).at || 0,
  job: jobView(s.job) && jobView(s.job).status === 'running' ? { kind: s.job.kind, label: s.job.label } : null,
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
    if (age < STALE_MS) throw new Error('already stitching');
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
  // EVERY piece measured against its own file first, so nothing renders a
  // frame short and nothing silently falls out of the cut.
  await progress(0, 1, 'reading the clips');
  const clips = cleanClips(await fillLengths(doc.clips || []));
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
    // the measured lengths go back on the doc, so the order's total stops
    // being the number she asked the door for
    await patchDoc(id, { clips }).catch(() => {});
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
  if (req.method === 'GET' && (req.path === '/status' || req.path === '/build')) return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '1mb' }));

router.get('/status', async (req, res) => {
  let stitches = null;
  try { stitches = (await db().collection(COL).count().get()).data().count; } catch { /* unconfigured */ }
  res.json({ ok: true, firebase: admin.apps.length > 0, ffmpeg: Boolean(FFMPEG), stitches, chat: CHAT });
});

// THE SELF-HEAL'S STAMP — the content hash of exactly what serveGated sends,
// the pill folded in. The app keeps a tool's web view alive for the whole app
// process, so without this no deploy can reach this page (Footage's own
// 2026-09-12 finding, the day before Stitch shipped). Registered ABOVE
// GET /:id or Express reads "build" as a stitch id.
router.get('/build', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ build: pageBuild.pageBuildId('stitch.html', true) });
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

// THE PICKABLES — the Footage log read the way Footage reads it: one read,
// the project/folder and the SEARCH applied over the whole collection BEFORE
// the page is cut (filtering a truncated page is the Assets tab's own
// lesson), the folders derived off everything, a tucked film left out of All
// and never out of a search. MUST stay above GET /:id or Express reads
// "clips" as a stitch id.
router.get('/clips', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const snap = await db().collection(videoLog.COLL).get();
    const rows = snap.docs.map((d) => ({ id: d.id, d: d.data() }));
    const folders = footage.foldersOf(rows);
    const project = footage.projectSlug(req.query.project);
    const folder = project ? footage.folderSlug(req.query.folder) : '';
    const q = String(req.query.q || '').trim();
    let cards = rows.map((x) => footage.cardOf(x.id, x.d));
    if (project) cards = cards.filter((c) => c.project === project && (!folder || c.folder === folder));
    else if (!q) {
      const tucked = await cast.tuckedFilms().catch(() => []);
      if (tucked.length) cards = cards.filter((c) => tucked.indexOf(c.project) < 0);
    }
    if (q) {
      const groups = grammar.compileFeed(q);
      cards = cards.filter((c) => grammar.feedMatches(footage.hayOf(c), groups));
    }
    const all = pickables(cards);
    const lim = Math.max(1, Math.min(Number(req.query.limit) || PICK_LIMIT, PICK_MAX));
    const offset = Math.max(0, Math.floor(Number(req.query.offset) || 0));
    const clips = all.slice(offset, offset + lim);
    res.json({ ok: true, clips, offset, more: all.length > offset + clips.length, total: all.length, folders });
  } catch (err) { fail(res, err); }
});

router.post('/', async (req, res) => {
  try {
    const d = db();
    if (!d) throw new Error('Firebase unavailable');
    const ref = d.collection(COL).doc();
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
    res.json({ ...doc, job: jobView(doc.job) });
  } catch (err) { fail(res, err); }
});

router.get('/:id/job', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such stitch' });
    res.json({ job: jobView(doc.job), renders: doc.renders || [] });
  } catch (err) { fail(res, err); }
});

router.post('/:id/clips', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such stitch' });
    if (!('clips' in (req.body || {}))) return res.status(400).json({ error: 'nothing to save' });
    const asked = (Array.isArray(req.body.clips) ? req.body.clips : []).slice(0, MAX_CLIPS);
    const clips = cleanClips(await fillLengths(asked, { only: 'unknown' }));
    // NOTHING VANISHES QUIETLY: anything cleanPieces refused is named back,
    // so the page can say so instead of showing a row the server never kept.
    const kept = new Set(clips.map((c) => c.key));
    const dropped = asked.filter((c) => c && c.key && !kept.has(String(c.key).slice(0, KEY_MAX)))
      .map((c) => String(c.title || 'a clip'));
    await patchDoc(req.params.id, { clips });
    res.json({ ok: true, clips: clips.length, seconds: totalSeconds(clips), dropped, saved: clips });
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
    if (!(doc.clips || []).length) return res.status(400).json({ error: 'nothing picked yet' });
    await startJob(req.params.id, 'render', (progress) => runRender(req.params.id, progress));
    res.json({ ok: true, status: 'stitching' });
  } catch (err) { fail(res, err); }
});

module.exports = {
  router, COL, STORAGE_FOLDER, CHAT,
  pickables, titleOf, markOf, whenOf,
  keyOf, pickIdOf, nextInstance, placesOf,
  moveBy, moveTo, dropAt, dupAt, addPick, dropPick, clipOf, cleanClips, totalSeconds, trimmed,
  fillLengths, realSeconds, jobView,
  MAX_CLIPS, MAX_RENDERS, KEY_MAX, STALE_MS, PICK_LIMIT, PICK_MAX,
};
