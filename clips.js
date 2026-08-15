// clips.js — Chunking: the clip library. Sophie's name for it is "Chunking";
// the code says `clips` because that is what the things ARE, and a future chat
// greps for the thing (her call, Aug 2026: "I like the name chunking but Clips
// is the one that makes more sense so we'll call it chunking for now").
//
// The problem it solves: every film in this app is stitched out of short
// self-contained pieces — a movie's per-scene wan/kling clip, a quick-animate,
// a chat's hand-built short — and those pieces were only ever reachable through
// the ONE film they were made for. Re-cutting a film with a different emphasis
// meant re-generating clips that already existed, because nothing could answer
// "show me every clip of the woman on the bench". So this is a LIBRARY of the
// atomic pieces: things that get assembled INTO videos and never taken apart.
//
// Nothing here generates or stitches anything — it is a shelf and a search box.
// The clips it holds are the ones the other modules already made and paid for,
// so a harvest costs nothing but time and bandwidth.
//
// WHAT COUNTS AS A CLIP. Harvest reads three Firestore sources (movie scene
// clips + their re-rolls + dream bridges, quick-animates) and then sweeps
// Storage for every other video, because most of Sophie's shorts were built by
// chats straight into their own Storage prefixes (`exile-film/clips`,
// `hospital-film/pairs`, `witch-shorts/*`, `nde-anim/*`…) and never went
// through movies.js at all. The sweep SKIPS the things that are not clips:
// finished films and supercuts, Cut Marks renders (whole recordings re-baked),
// the Dump (her raw phone footage — that is a source library, and a phone video
// is exactly the thing you WOULD take apart), and `scratchpad/film-cache`,
// which is not footage at all but an encode cache of single stills held for a
// duration. Anything the sweep finds that probes longer than MAX_SWEEP_SEC is a
// video, not a clip, and is left alone. A clip filed from Firestore is trusted
// on faith — movies.js only ever writes real clips there.
//
// POSTERS ARE THE POINT OF THE GRID. A tile is the clip's first frame, so
// harvest runs in TWO phases: listing (cheap, Firestore + Storage metadata,
// files every doc immediately) then posters (ffmpeg, one frame per clip). The
// poster phase reads each clip's BYTES through the Admin SDK rather than letting
// ffmpeg open the url — see `fetchBytes` for why that is not a detail — and runs
// under a wall-clock budget: a re-run picks up exactly where it stopped, so the
// library is never blocked on it and a server restart cannot wedge it.
//
// SEARCH IS THE WHOLE INTERFACE (her brief). `searchClips` is a pure function
// with a real boolean grammar — bare terms AND, `OR` between them, `-term` to
// exclude, "quoted phrases", and the field prefixes `tag:` `title:` `from:`
// `prompt:` `note:`. The grammar itself moved to `search-grammar.js` (Aug
// 2026) when the Chats app's search learned to speak it too, so it is parsed
// once for the whole app; only the matching below is ours. It runs
// over the clip's title, its tags, the film it came out of,
// the prompt it was generated from, and Sophie's own notes. The prompt is what
// makes the library findable at all: it is the only text that says what is
// actually happening in the picture, and it comes free with every clip movies.js
// made. Meaning/semantic search is deliberately NOT here yet (she said "we
// might have to do that later if it's hard") — search.js already owns the int8
// embedding machinery to bolt on when she wants it.
//
// Data: one Firestore doc per clip (`forge-clips`, deckfactory), id =
// sha1(url) so a re-harvest updates the doc it already made instead of piling
// up copies, and so Sophie's title/tags/notes survive every later harvest —
// harvest only ever writes the fields SHE has not touched.
//
// Routes (mounted at /api/clips, STUDIO_TOKEN gate, only /status open):
//   GET    /status        → { ok, firebase, ffmpeg, ffprobe, clips, posters }
//   GET    /              → ?q=&tag=&source=&limit=&offset=&sort=&hidden=
//                           → { clips, total, facets:{tags,sources}, query }
//   GET    /facets        → { tags, sources } — the filter chips
//   GET    /:id           → one clip
//   PATCH  /:id           → { title, tags, notes, hidden } (EDITABLE only)
//   DELETE /:id           → drop it from the library (Storage is never touched)
//   POST   /add           → { url, title?, tags?, source? } — file one by hand
//   POST   /harvest       → rebuild/extend the library (background job)
//   GET    /harvest       → { job } — poll it

const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const admin = require('firebase-admin');
const { parseQuery } = require('./search-grammar');

const COL = process.env.CLIPS_COLLECTION || 'forge-clips';
const META_COL = process.env.CLIPS_META_COLLECTION || 'forge-clips-meta';
const POSTER_PREFIX = 'clips/posters/';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';

// A swept Storage video longer than this is a film, not a clip. Generated
// clips run 5s (wan) to ~10s (kling); a hand-built short runs under a minute.
// Three minutes is a deliberately generous ceiling — the point is to keep whole
// recordings out, not to police length.
const MAX_SWEEP_SEC = 180;
// How long ONE poster run may spend making frames before it stops and reports
// what is left. Render's instance is shared with everything else; a run that
// never ends is a run that cannot be reasoned about.
const POSTER_BUDGET_MS = Number(process.env.CLIPS_POSTER_BUDGET_MS || 9 * 60 * 1000);
const MAX_TAGS = 24;
const MAX_TITLE = 140;

// Storage prefixes the sweep must not file. Each is a real thing that lives in
// this bucket and is NOT a clip — see the header.
const SKIP_PREFIXES = [
  'clips/',                    // our own posters
  'scratchpad/film-cache/',    // an encode cache of stills, not footage
  'scratchpad/films/',         // finished films
  'movies/films/',             // finished films
  'nde-clips/supercuts/',      // finished supercuts
  'cutmarks/',                 // Cut Marks renders — whole recordings re-baked
  'drops/',                    // the Dump: raw phone footage (a source library)
  'memo-audio/',
  'search-clips/',
  // Both found by running the sweep and reading what it filed (Aug 2026):
  // `nde-audio` is the DOWNLOADED YouTube interviews — 77 whole hour-long
  // conversations named by video id, the raw material the NDE project reads,
  // and the last thing that belongs on a shelf of pieces. `nde-episodes` is
  // the finished episodes.
  'nde-audio/',
  'nde-episodes/',
];
// A path SEGMENT that means "this is the assembled thing, not a piece of it".
const SKIP_SEGMENTS = new Set(['combined', 'films', 'film', 'supercuts', 'final', 'out', 'renders']);
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;

// ─── binaries ───────────────────────────────────────────────────────
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
function bucket() { return admin.apps.length ? admin.storage().bucket() : null; }
function run(bin, args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${path.basename(bin)} failed: ${(stderr || err.message).slice(-300)}`));
      else resolve({ stdout, stderr });
    });
  });
}
const clipId = (url) => crypto.createHash('sha1').update(String(url)).digest('hex').slice(0, 16);
const nowIso = () => new Date().toISOString();

// ─── the search grammar (pure — scripts/test-clips.js drives all of it) ──
//
// Normalising to lowercase alphanumerics means a query never has to match
// Sophie's punctuation, and matching is substring so "cook" finds "cookie" in a
// library this small. Everything below works on normalised text.
const normalize = (s) => String(s == null ? '' : s)
  .toLowerCase()
  .replace(/[‘’']/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// The fields a `x:` prefix can name, and the aliases worth typing. `from:` is
// the one Sophie asked for by name ("what video they came out of").
const FIELDS = {
  tag: 'tag', tags: 'tag', t: 'tag',
  title: 'title', name: 'title',
  from: 'source', source: 'source', src: 'source', film: 'source', movie: 'source',
  prompt: 'prompt', p: 'prompt',
  note: 'note', notes: 'note',
};
// How much a hit in each field is worth. A title match is what she meant; a
// prompt match is a guess that happened to pay off.
const WEIGHT = { title: 4, tag: 3, source: 2, prompt: 1, note: 1 };

// Parse a query into AND-ed groups of OR-ed terms, plus negations.
//
//   cookie jonas          → (cookie) AND (jonas)
//   cookie OR crumbs      → (cookie OR crumbs)
//   tag:movie -bridge     → (tag:movie) AND NOT (bridge)
//   "on the bench"        → the phrase, whole
//
// The grammar itself lives in `search-grammar.js` — the Chats app's search
// speaks the same one (Aug 2026), so it is parsed in one place and each caller
// brings only its own fields and its own idea of what a match is. Ours
// normalises to lowercase alphanumerics, so her punctuation never decides a
// hit in a library this small.
const parseClipQuery = (q) => parseQuery(q, { fields: FIELDS, normalize });

// The searchable text of one clip, per field, normalised once and memoised on
// the record so a long list is scanned rather than re-normalised per term.
function haystack(clip) {
  if (clip.__hay) return clip.__hay;
  const hay = {
    title: normalize(clip.title),
    tag: normalize((clip.tags || []).join(' ')),
    source: normalize(`${(clip.source && clip.source.title) || ''} ${(clip.source && clip.source.kind) || ''}`),
    prompt: normalize(clip.text),
    note: normalize(clip.notes),
  };
  Object.defineProperty(clip, '__hay', { value: hay, enumerable: false, configurable: true });
  return hay;
}

// Score one term against one clip. Returns 0 for no match — a field-scoped term
// only ever looks at its own field, which is what makes `tag:movie` mean the
// tag and not the word.
function scoreTerm(hay, term) {
  const fields = term.field ? [term.field] : Object.keys(WEIGHT);
  let best = 0;
  for (const f of fields) {
    const text = hay[f];
    if (!text || !text.includes(term.value)) continue;
    // A whole-word hit beats a hit inside a longer word, and an exact field
    // beats a mention: "cookie" as the whole title outranks "cookie" in a
    // paragraph of prompt.
    let s = WEIGHT[f];
    if (new RegExp(`(^| )${term.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(text)) s += WEIGHT[f] * 0.5;
    if (text === term.value) s += WEIGHT[f];
    if (term.phrase) s += 2;
    best = Math.max(best, s);
  }
  return best;
}

// A clip matches when every positive group has at least one matching term and
// no negative group matches at all. The score is the sum of the best term in
// each positive group, so adding a second word that also hits ranks a clip up.
function scoreClip(clip, groups) {
  if (!groups.length) return 0;
  const hay = haystack(clip);
  let total = 0;
  for (const g of groups) {
    let best = 0;
    for (const term of g.terms) best = Math.max(best, scoreTerm(hay, term));
    if (g.neg) { if (best > 0) return null; continue; }
    if (!best) return null;
    total += best;
  }
  return total;
}

// The one list function the page calls. `clips` is the whole library in memory
// (a few hundred small records — deliberately not an index to keep in step).
function searchClips(clips, { q = '', tag = '', source = '', sort = '', hidden = false, limit = 120, offset = 0 } = {}) {
  const groups = parseClipQuery(q);
  const wantTags = String(tag || '').split(',').map((t) => normalize(t)).filter(Boolean);
  const wantSource = normalize(source);
  const scored = [];
  for (const clip of clips) {
    if (!hidden && clip.hidden) continue;
    if (wantTags.length) {
      const has = (clip.tags || []).map(normalize);
      if (!wantTags.every((t) => has.includes(t))) continue;
    }
    if (wantSource && normalize((clip.source && clip.source.title) || '') !== wantSource) continue;
    const score = groups.length ? scoreClip(clip, groups) : 0;
    if (score === null) continue;
    scored.push({ clip, score });
  }
  const byNew = (a, b) => (b.clip.createdAt || 0) - (a.clip.createdAt || 0);
  if (sort === 'old') scored.sort((a, b) => (a.clip.createdAt || 0) - (b.clip.createdAt || 0));
  else if (sort === 'long') scored.sort((a, b) => (b.clip.seconds || 0) - (a.clip.seconds || 0) || byNew(a, b));
  else if (sort === 'short') scored.sort((a, b) => (a.clip.seconds || 0) - (b.clip.seconds || 0) || byNew(a, b));
  else if (sort === 'new' || !groups.length) scored.sort(byNew);
  // With a query and no explicit sort, RANK — newest-first would bury the best
  // answer under whatever was made most recently.
  else scored.sort((a, b) => b.score - a.score || byNew(a, b));
  const total = scored.length;
  const page = scored.slice(offset, offset + limit).map(({ clip, score }) => ({ ...publicClip(clip), score }));
  return { clips: page, total, offset, limit, query: groups };
}

// The filter chips: what tags and what source films actually exist, with counts,
// biggest first. Derived from the library rather than stored, so a renamed tag
// can never leave a dead chip behind.
function facetsOf(clips, { hidden = false } = {}) {
  const tags = new Map();
  const sources = new Map();
  for (const c of clips) {
    if (!hidden && c.hidden) continue;
    for (const t of c.tags || []) tags.set(t, (tags.get(t) || 0) + 1);
    const s = (c.source && c.source.title) || '';
    if (s) sources.set(s, (sources.get(s) || 0) + 1);
  }
  const rank = (m) => [...m.entries()].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { tags: rank(tags), sources: rank(sources) };
}

function publicClip(c) {
  const { __hay, ...rest } = c;
  return rest;
}

// ─── naming ─────────────────────────────────────────────────────────
// A swept file's only name is its path, and half of those are hashes. Turn the
// readable part into a title and leave the unreadable ones to the folder + date
// — an honest "Exile · Jul 27" beats a 40-character hex string on a tile.
function titleFromPath(objectPath, createdAt) {
  const base = String(objectPath).split('/').pop().replace(VIDEO_EXT, '');
  const folder = String(objectPath).split('/').slice(0, -1).pop() || '';
  const readable = base
    .replace(/^[0-9a-f]{16,}$/i, '')
    .replace(/^\d{10,}[-_]?/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const pretty = (s) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()).trim();
  if (readable && !/^[0-9a-f\s]{16,}$/i.test(readable)) return pretty(readable).slice(0, MAX_TITLE);
  const when = new Date(createdAt || Date.now())
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${pretty(folder) || 'Clip'} · ${when}`.slice(0, MAX_TITLE);
}

// The tags a swept path earns for free. The top folder is the project the clip
// belongs to, which is exactly the "what video did this come out of" filter —
// no typing required for it to work on day one.
function tagsFromPath(objectPath) {
  const parts = String(objectPath).split('/').slice(0, -1);
  return [...new Set(parts.map((p) => p.replace(/[_\s]+/g, '-').toLowerCase()).filter((p) => p && p !== '_'))]
    .slice(0, 4);
}

function cleanTags(list) {
  if (!Array.isArray(list)) return undefined;
  return [...new Set(list
    .map((t) => String(t || '').trim().toLowerCase().replace(/\s+/g, '-'))
    .filter(Boolean))].slice(0, MAX_TAGS);
}

// ─── store ──────────────────────────────────────────────────────────
async function loadAll() {
  const d = db();
  if (!d) return [];
  const snap = await d.collection(COL).get();
  return snap.docs.map((s) => s.data());
}
async function loadClip(id) {
  const d = db();
  if (!d) return null;
  const snap = await d.collection(COL).doc(id).get();
  return snap.exists ? snap.data() : null;
}

// Sophie's fields, and nothing else. url/storagePath/seconds/poster/source are
// server-owned — a PATCH that could rewrite them would let the page corrupt the
// thing the doc points at.
const EDITABLE = ['title', 'tags', 'notes', 'hidden'];
function cleanPatch(body) {
  const out = {};
  for (const k of EDITABLE) {
    if (!(k in body)) continue;
    if (k === 'tags') { const t = cleanTags(body[k]); if (t) out.tags = t; }
    else if (k === 'hidden') out.hidden = !!body[k];
    else out[k] = String(body[k] == null ? '' : body[k]).slice(0, k === 'title' ? MAX_TITLE : 2000);
  }
  return out;
}

// Upsert one harvested clip. THE RULE THAT MATTERS: a re-harvest may fill in a
// field, never overwrite one Sophie has edited. `edited` records which fields
// she has touched, so a title she fixed survives every future harvest — the
// alternative is a library that silently forgets her work every time it grows.
async function upsert(record) {
  const d = db();
  if (!d) throw new Error('Firebase unavailable');
  const ref = d.collection(COL).doc(record.id);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ ...record, edited: [], hidden: false, notes: '', updatedAt: Date.now() });
    return 'new';
  }
  const prev = snap.data();
  const edited = new Set(prev.edited || []);
  const patch = { harvestedAt: record.harvestedAt };
  for (const [k, v] of Object.entries(record)) {
    if (k === 'id' || k === 'harvestedAt') continue;
    if (edited.has(k)) continue;
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && !v.length) continue;
    // Tags MERGE rather than replace, so a tag she added by hand and a tag the
    // sweep derives can coexist on one clip.
    if (k === 'tags') { patch.tags = cleanTags([...(prev.tags || []), ...v]); continue; }
    patch[k] = v;
  }
  await ref.update({ ...patch, updatedAt: Date.now() });
  return 'updated';
}

// ─── the harvest job ────────────────────────────────────────────────
// Library-wide, so its state lives on a meta doc rather than on any clip. Same
// shape and same stale-job takeover as cutmarks.js's per-doc jobs.
function jobRef() { return db().collection(META_COL).doc('harvest'); }
async function loadJob() {
  const d = db();
  if (!d) return null;
  const snap = await jobRef().get();
  return snap.exists ? snap.data().job || null : null;
}
async function saveJob(job) {
  const d = db();
  if (!d) return;
  await jobRef().set({ job, updatedAt: Date.now() }, { merge: true }).catch(() => {});
}
async function startHarvest(opts = {}) {
  const running = await loadJob();
  if (running && running.status === 'running' && !opts.force) {
    // The sibling modules' stale-job takeover: a job older than 20 minutes is
    // assumed dead (a deploy mid-run leaves one "running" forever). `force`
    // exists because this job is library-wide rather than per-doc, so a wedged
    // one blocks the whole tool rather than one record — and a restart during a
    // harvest is exactly how it happens.
    const age = Date.now() - new Date(running.startedAt || 0).getTime();
    if (age < 20 * 60 * 1000) return running;   // never a second job
  }
  const job = {
    kind: 'harvest', status: 'running', done: 0, total: 0, label: 'starting',
    error: null, startedAt: nowIso(), found: 0, posters: 0, postersLeft: 0,
  };
  await saveJob(job);
  (async () => {
    let lastSave = 0;
    const progress = async (done, total, label, extra = {}) => {
      Object.assign(job, { done, total, label }, extra);
      if (Date.now() - lastSave > 1500) { lastSave = Date.now(); await saveJob(job); }
    };
    try {
      await harvest(progress, opts);
      Object.assign(job, { status: 'done', label: job.postersLeft ? `${job.postersLeft} posters left` : 'done' });
    } catch (err) {
      console.warn('clips: harvest failed —', err.message);
      Object.assign(job, { status: 'error', error: err.message });
    }
    await saveJob(job);
  })();
  return job;
}

// Phase 1 — every clip the app already made, from the modules that made them.
async function candidatesFromFirestore() {
  const d = db();
  const out = [];
  const at = Date.now();
  const movies = await d.collection(process.env.MOVIES_COLLECTION || 'forge-movies').get();
  movies.forEach((doc) => {
    const m = doc.data();
    const film = m.title || m.name || 'Untitled movie';
    (m.scenes || []).forEach((s, i) => {
      const add = (url, extraTags, promptUsed, when) => {
        if (!url) return;
        out.push({
          id: clipId(url), url,
          title: (s.title || `${film} — scene ${i + 1}`).slice(0, MAX_TITLE),
          tags: cleanTags(['movie', ...(extraTags || [])]),
          text: String(promptUsed || s.videoPrompt || s.prompt || '').slice(0, 4000),
          source: { kind: 'movie', id: doc.id, title: film, sceneId: s.id || String(i + 1) },
          createdAt: when || s.clipAt || m.createdAt || at,
          harvestedAt: at,
        });
      };
      add(s.clip && s.clip.url, [], s.clip && s.clip.promptUsed, s.clip && s.clip.at);
      (s.clipHistory || []).forEach((h) => add(h && h.url, ['alt'], h && h.promptUsed, h && h.at));
    });
    (m.bridges || []).forEach((b, i) => {
      if (!b || !b.url) return;
      out.push({
        id: clipId(b.url), url: b.url,
        title: `${film} — bridge ${i + 1}`.slice(0, MAX_TITLE),
        tags: cleanTags(['movie', 'bridge']),
        text: String(b.prompt || b.promptUsed || '').slice(0, 4000),
        source: { kind: 'movie', id: doc.id, title: film },
        createdAt: b.at || m.createdAt || at,
        harvestedAt: at,
      });
    });
  });
  const quick = await d.collection(process.env.QUICK_COLLECTION || 'forge-quick').get();
  quick.forEach((doc) => {
    const q = doc.data();
    if (!q.clipUrl) return;
    const words = String(q.prompt || '').trim().split(/\s+/).slice(0, 8).join(' ');
    out.push({
      id: clipId(q.clipUrl), url: q.clipUrl,
      title: (words || 'Quick animate').slice(0, MAX_TITLE),
      tags: cleanTags(['quick']),
      text: String(q.prompt || '').slice(0, 4000),
      source: { kind: 'quick', id: doc.id, title: 'Quick animate' },
      createdAt: q.createdAt || at,
      harvestedAt: at,
    });
  });
  return out;
}

function sweepSkips(name) {
  if (!VIDEO_EXT.test(name)) return true;
  if (SKIP_PREFIXES.some((p) => name.startsWith(p))) return true;
  const segs = name.split('/').slice(0, -1);
  return segs.some((s) => SKIP_SEGMENTS.has(s.toLowerCase()));
}

// Phase 1b — the chats' own shorts, which never went through movies.js. The
// folder becomes the source AND a tag, so "what film did this come out of"
// works without anyone typing anything.
async function candidatesFromStorage(known) {
  const b = bucket();
  if (!b) return [];
  const [files] = await b.getFiles();
  const at = Date.now();
  const out = [];
  for (const f of files) {
    const name = f.name;
    if (sweepSkips(name)) continue;
    const url = `https://storage.googleapis.com/${b.name}/${name}`;
    const id = clipId(url);
    if (known.has(id)) continue;         // Firestore already described it better
    const created = Date.parse((f.metadata && f.metadata.timeCreated) || '') || at;
    const folder = name.split('/').slice(0, -1).join('/') || 'storage';
    out.push({
      id, url, storagePath: name,
      title: titleFromPath(name, created),
      tags: cleanTags(tagsFromPath(name)),
      text: '',
      source: { kind: 'storage', id: folder, title: folder.split('/')[0] || folder },
      bytes: Number((f.metadata && f.metadata.size) || 0) || null,
      createdAt: created,
      harvestedAt: at,
    });
  }
  return out;
}

// A clip's object path inside OUR bucket, or null when it lives somewhere else.
// Both url shapes the app writes are handled: the plain
// storage.googleapis.com/<bucket>/<path> form and Firebase's own
// firebasestorage.googleapis.com/v0/b/<bucket>/o/<url-encoded path>.
function storagePathFor(clip) {
  if (clip.storagePath) return clip.storagePath;
  const b = bucket();
  if (!b) return null;
  const url = String(clip.url || '');
  const plain = url.match(/^https?:\/\/storage\.googleapis\.com\/([^/]+)\/(.+)$/);
  if (plain && plain[1] === b.name) return decodeURIComponent(plain[2].split('?')[0]);
  const fb = url.match(/^https?:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?]+)/);
  if (fb && fb[1] === b.name) return decodeURIComponent(fb[2]);
  return null;
}

// THE BYTES COME FROM THE ADMIN SDK, NOT FROM THE URL. ffmpeg CAN read https
// directly, and the first version did — but a chat's sandbox sends all outbound
// HTTPS through a proxy that ffmpeg cannot speak to, so every one of the first
// 350 posters failed with an empty error (measured 2026-08-14). The Admin SDK
// talks to googleapis, which works everywhere the rest of this app works, so
// reading the object is the portable route — and for a clip already sitting in
// our own bucket it is the shorter one anyway. An external url (a hand-added
// clip) still goes through fetch.
async function fetchBytes(clip, file) {
  const p = storagePathFor(clip);
  if (p) { await bucket().file(p).download({ destination: file }); return file; }
  const fetch = require('node-fetch');
  const res = await fetch(clip.url, { redirect: 'follow', timeout: 180000 });
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

// Duration and frame size of a LOCAL file.
async function probe(file) {
  if (!FFPROBE) return {};
  const { stdout } = await run(FFPROBE, [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'format=duration:stream=width,height',
    '-of', 'json', file,
  ], 90000);
  const j = JSON.parse(stdout || '{}');
  const st = (j.streams || [])[0] || {};
  return {
    seconds: Math.round((Number((j.format || {}).duration) || 0) * 10) / 10 || null,
    width: st.width || null,
    height: st.height || null,
  };
}

// Read the clip once: its duration, its size, and one frame as its poster. ONE
// download serves all three, and the copy is deleted before the next clip
// starts — 350 clips would otherwise be a gigabyte sitting on a 512MB instance.
//
// The frame is taken a third of the way in, capped at a second: frame zero of a
// generated clip is usually the still it was animated FROM, so it makes every
// panel-pair look identical, and on a fade it is simply black. webp because a
// poster is a display copy and the house rule is never to ship a raw frame — a
// 1024x1536 png is ~1MB, this is ~25KB.
async function posterFor(clip) {
  if (!FFMPEG) throw new Error('ffmpeg unavailable');
  const b = bucket();
  if (!b) throw new Error('Storage unavailable');
  const src = path.join(os.tmpdir(), `clip-${clip.id}${path.extname(String(clip.url).split('?')[0]) || '.mp4'}`);
  const shot = path.join(os.tmpdir(), `clip-${clip.id}.webp`);
  try {
    await fetchBytes(clip, src);
    const meta = await probe(src).catch(() => ({}));
    // A whole video is not a clip — say so and leave the frame undrawn.
    if (clip.source && clip.source.kind === 'storage' && meta.seconds && meta.seconds > MAX_SWEEP_SEC) {
      return { meta, tooLong: true };
    }
    const at = Math.min(1, Math.max(0, (meta.seconds || 2) / 3));
    await run(FFMPEG, [
      '-y', '-ss', at.toFixed(2), '-i', src, '-frames:v', '1',
      '-vf', 'scale=480:-2', '-c:v', 'libwebp', '-quality', '72', shot,
    ], 120000);
    const dest = `${POSTER_PREFIX}${clip.id}.webp`;
    await b.upload(shot, { destination: dest, metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' } });
    await b.file(dest).makePublic().catch(() => {});
    return { meta, poster: `https://storage.googleapis.com/${b.name}/${dest}` };
  } finally {
    fs.promises.unlink(src).catch(() => {});
    fs.promises.unlink(shot).catch(() => {});
  }
}

async function harvest(progress, { listing = true, posters = true } = {}) {
  const d = db();
  if (!d) throw new Error('Firebase unavailable');
  let found = 0;
  if (listing) {
    await progress(0, 0, 'reading movies');
    const fromDocs = await candidatesFromFirestore();
    const known = new Set(fromDocs.map((c) => c.id));
    await progress(0, 0, 'sweeping storage');
    const fromStorage = await candidatesFromStorage(known);
    const all = [...fromDocs, ...fromStorage];
    // A dedupe pass: the same url can arrive twice (a scene clip that is also a
    // history entry of the next scene). First writer wins — it has the better
    // title, because it came from the doc that knows what the scene is.
    const seen = new Set();
    const list = all.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
    for (let i = 0; i < list.length; i++) {
      // One failed record costs its own clip, never the run.
      try { await upsert(list[i]); found++; } catch (e) { console.warn('clips: upsert', e.message); }
      await progress(i + 1, list.length, 'filing clips', { found });
    }

    // RECONCILE. The skip list gets corrected as new kinds of file turn up in
    // the bucket (the first sweep filed 77 whole interviews), so a harvest must
    // be able to take back what an earlier one filed by mistake — otherwise the
    // fix only helps a library that has never been built. Only ever removes
    // SWEPT records that the current rules would no longer file, and never one
    // Sophie has touched: her edit is the signal that she wants it there.
    const stale = (await loadAll()).filter((c) => c.source && c.source.kind === 'storage'
      && c.storagePath && sweepSkips(c.storagePath)
      && !(c.edited || []).length);
    for (const c of stale) {
      await d.collection(COL).doc(c.id).delete().catch(() => {});
    }
    if (stale.length) await progress(list.length, list.length, `dropped ${stale.length} that aren't clips`, { found });
  }
  if (!posters) return;

  // Phase 2 — probe + poster for everything still missing one, under a budget.
  const all = await loadAll();
  const todo = all.filter((c) => !c.poster && !c.posterFailed);
  const started = Date.now();
  let made = 0;
  for (let i = 0; i < todo.length; i++) {
    if (Date.now() - started > POSTER_BUDGET_MS) break;
    const clip = todo[i];
    await progress(i, todo.length, `posters ${i + 1}/${todo.length}`, { posters: made, postersLeft: todo.length - i });
    try {
      const { meta, poster, tooLong } = await posterFor(clip);
      // A swept file that turns out to be a whole video is not a clip. Say so on
      // the doc rather than deleting it — a silent disappearance is unreadable.
      if (tooLong) {
        await d.collection(COL).doc(clip.id).update({
          ...meta, hidden: true, hiddenReason: `${Math.round(meta.seconds)}s — a video, not a clip`, updatedAt: Date.now(),
        });
        continue;
      }
      await d.collection(COL).doc(clip.id).update({ ...meta, poster, updatedAt: Date.now() });
      made++;
    } catch (err) {
      // A clip whose frame can't be read still belongs in the library — it just
      // tiles without a picture. Marked so the next run doesn't retry forever.
      await d.collection(COL).doc(clip.id)
        .update({ posterFailed: String(err.message).slice(0, 200), updatedAt: Date.now() }).catch(() => {});
    }
  }
  const left = (await loadAll()).filter((c) => !c.poster && !c.posterFailed).length;
  await progress(todo.length, todo.length, 'done', { posters: made, postersLeft: left });
}

// ─── router ─────────────────────────────────────────────────────────
const router = express.Router();

// Same gate as every sibling: open when STUDIO_TOKEN is unset, otherwise every
// route but /status wants the header.
router.use((req, res, next) => {
  const token = STUDIO_TOKEN;
  if (!token) return next();
  if (req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '1mb' }));

function fail(res, err) {
  console.warn('clips:', err.message);
  res.status(500).json({ error: err.message });
}

router.get('/status', async (req, res) => {
  let clips = null; let posters = null;
  try {
    const all = await loadAll();
    clips = all.length;
    posters = all.filter((c) => c.poster).length;
  } catch { /* status must answer even when Firestore is unhappy */ }
  res.json({ ok: true, firebase: admin.apps.length > 0, ffmpeg: !!FFMPEG, ffprobe: !!FFPROBE, clips, posters });
});

router.get('/', async (req, res) => {
  try {
    const all = await loadAll();
    const hidden = req.query.hidden === '1';
    const out = searchClips(all, {
      q: req.query.q || '',
      tag: req.query.tag || '',
      source: req.query.source || '',
      sort: req.query.sort || '',
      hidden,
      limit: Math.min(Number(req.query.limit) || 120, 400),
      offset: Number(req.query.offset) || 0,
    });
    // `library` is what the shelf holds under the SAME hidden rule the results
    // used, so "24 of 337" compares two numbers that mean the same thing —
    // counting every doc here made the total jump by the hidden ones.
    const library = hidden ? all.length : all.filter((c) => !c.hidden).length;
    res.json({ ...out, facets: facetsOf(all, { hidden }), library });
  } catch (err) { fail(res, err); }
});

router.get('/facets', async (req, res) => {
  try { res.json(facetsOf(await loadAll(), { hidden: req.query.hidden === '1' })); }
  catch (err) { fail(res, err); }
});

router.post('/harvest', async (req, res) => {
  try {
    res.json({ job: await startHarvest({
      listing: req.body.listing !== false,
      posters: req.body.posters !== false,
      force: !!req.body.force,
    }) });
  } catch (err) { fail(res, err); }
});
router.get('/harvest', async (req, res) => {
  try { res.json({ job: await loadJob() }); }
  catch (err) { fail(res, err); }
});

// File one by hand — a clip that lives somewhere this app didn't make it.
router.post('/add', async (req, res) => {
  try {
    const url = String(req.body.url || '').trim();
    if (!/^https?:\/\//.test(url)) return res.status(400).json({ error: 'a clip needs a url' });
    const at = Date.now();
    const id = clipId(url);
    await upsert({
      id, url,
      title: String(req.body.title || titleFromPath(url, at)).slice(0, MAX_TITLE),
      tags: cleanTags(req.body.tags) || [],
      text: String(req.body.text || '').slice(0, 4000),
      source: { kind: 'added', id: 'added', title: String(req.body.source || 'Added by hand') },
      createdAt: Number(req.body.createdAt) || at,
      harvestedAt: at,
    });
    // The poster is a background job like every other slow thing.
    startHarvest({ listing: false, posters: true }).catch(() => {});
    res.json({ ok: true, clip: await loadClip(id) });
  } catch (err) { fail(res, err); }
});

router.get('/:id', async (req, res) => {
  try {
    const clip = await loadClip(req.params.id);
    if (!clip) return res.status(404).json({ error: 'no such clip' });
    res.json({ clip });
  } catch (err) { fail(res, err); }
});

router.patch('/:id', async (req, res) => {
  try {
    const patch = cleanPatch(req.body || {});
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to change' });
    const ref = db().collection(COL).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'no such clip' });
    // Record which fields are HERS, so no later harvest overwrites them.
    const edited = [...new Set([...(snap.data().edited || []), ...Object.keys(patch)])];
    await ref.update({ ...patch, edited, updatedAt: Date.now() });
    res.json({ ok: true, clip: await loadClip(req.params.id) });
  } catch (err) { fail(res, err); }
});

// Drop it from the library. The clip's own bytes in Storage are never touched —
// nothing Sophie made is deleted by a shelf.
router.delete('/:id', async (req, res) => {
  try {
    await db().collection(COL).doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

module.exports = {
  router,
  // pure, for scripts/test-clips.js
  parseClipQuery, searchClips, facetsOf, normalize, titleFromPath, tagsFromPath,
  cleanTags, cleanPatch, sweepSkips, scoreClip,
  // for other modules / scripts
  loadAll, loadClip, upsert, startHarvest, harvest, probe, posterFor, storagePathFor, COL,
};
