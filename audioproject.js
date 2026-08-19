// audioproject.js — the PROJECT across the audio rooms, in the light shape
// Sophie picked (2026-08-19, from the three proposed in docs/audio-pipeline.md):
// a small id threaded through the hand-offs that carries the NAME and
// WHO-SPEAKS, plus the derive-only WALK resolver underneath it. Geometry —
// marks, pieces, cards, word ranges — deliberately stays room-local: every
// room re-listens before a real cut anyway, and translating marks between
// their coordinate systems is where the bugs would live.
//
// TWO HALVES:
//
// 1. THE WALK (no state at all). Every hand-off passes a render url, and each
//    room content-addresses its doc by the source url it was opened on — so a
//    render url in one room IS the source key of the next room's doc. This
//    module scans the room collections, indexes every doc's ins (its source)
//    and outs (its renders/clips), and answers `GET /walk?url=` with the
//    whole chain either side of any url. Zero migration, nothing to drift;
//    the index is cached ~60s because the strip on every room page reads it.
//
// 2. THE PROJECT DOC (`forge-audio-projects`, deckfactory). Minted by the
//    first wired room that opens a source without one, carried by every
//    hand-off as `&project=`, stamped on each room's own doc. It holds the
//    three things that should be decided ONCE per piece of work:
//      title    — hers, set from the first room's name, read by later rooms
//                 instead of re-asking
//      speakers — who speaks in it (Cutting Blocks' whoOver seeds it: the
//                 unique speaker names, never the per-block geometry)
//      trail    — which room docs this work passed through, append-only,
//                 deduped by room+docId (the walk can DERIVE lineage from
//                 urls; the trail is the cheap human-readable copy of it)
//    A room opened raw (no param) mints its own on create, so the id always
//    exists by the time a hand-off needs to carry it. The Episode Editor is
//    deliberately NOT minting (episodes aren't content-addressed by a source
//    url and are made many ways); its lineage still resolves via the walk,
//    and a chain that starts there picks up its project at the first wired
//    room it hands into.
//
// Money: nothing here spends. No model calls, a handful of small Firestore
// reads behind a cache; opening a page stays free.
//
// Routes (mounted at /api/audioproject, STUDIO_TOKEN gate, only /status open):
//   GET  /status        → { ok, firebase }
//   GET  /walk?url=     → { url, here, up, down } — the derived chain
//   GET  /:id           → the project doc
//   POST /:id/title     → { title }
//   POST /:id/speakers  → { speakers: [names] } — merged, never replaced

const express = require('express');
const crypto = require('crypto');
const admin = require('firebase-admin');

const COL = process.env.AUDIO_PROJECTS_COLLECTION || 'forge-audio-projects';
const MAX_TRAIL = 40;
const WALK_DEPTH = 6;
const INDEX_TTL = 60 * 1000;
const SCAN_CAP = 400; // per collection — the rooms hold tens of docs today

function db() { return admin.apps.length ? admin.firestore() : null; }
const nowIso = () => new Date().toISOString();
function fail(res, err) {
  console.warn('audioproject:', err.message);
  res.status(500).json({ error: err.message });
}

// ─── the project doc ────────────────────────────────────────────────
// Mint (or adopt) a project. Returns the id, or null when Firestore is down —
// every caller treats the project as best-effort: a room must open fine with
// no project at all.
async function ensureProject({ id, title } = {}) {
  const d = db();
  if (!d) return null;
  if (id && /^ap[a-f0-9]{10,20}$/.test(String(id))) {
    const snap = await d.collection(COL).doc(String(id)).get();
    if (snap.exists) return snap.id;
  }
  const fresh = `ap${crypto.randomBytes(6).toString('hex')}`;
  await d.collection(COL).doc(fresh).set({
    id: fresh,
    title: String(title || '').slice(0, 120) || '',
    speakers: [],
    trail: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  return fresh;
}

// Append a room doc to the trail (deduped by room+docId) and fill the title
// if the project doesn't have one yet. Best-effort by contract.
async function stamp(projectId, { room, docId, url, name } = {}) {
  const d = db();
  if (!d || !projectId || !room || !docId) return;
  const ref = d.collection(COL).doc(String(projectId));
  await d.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const trail = Array.isArray(snap.get('trail')) ? snap.get('trail') : [];
    if (!trail.some((t) => t && t.room === room && t.docId === docId)) {
      trail.push({
        room: String(room), docId: String(docId),
        url: String(url || '').slice(0, 500), name: String(name || '').slice(0, 120),
        at: nowIso(),
      });
    }
    const patch = { trail: trail.slice(-MAX_TRAIL), updatedAt: nowIso() };
    if (!snap.get('title') && name) patch.title = String(name).slice(0, 120);
    tx.update(ref, patch);
  }).catch((e) => console.warn('audioproject: stamp failed —', e.message));
}

async function readProject(id) {
  const d = db();
  if (!d || !id) return null;
  const snap = await d.collection(COL).doc(String(id)).get();
  return snap.exists ? snap.data() : null;
}

// Merge speaker NAMES in (Cutting Blocks seeds this from whoOver's values —
// the names, never the per-block map). Merged, never replaced: a speaker she
// named once stays known even after the blocks that used it are cut.
async function addSpeakers(projectId, names) {
  const d = db();
  const clean = (Array.isArray(names) ? names : [])
    .map((n) => String(n || '').trim().slice(0, 60)).filter(Boolean);
  if (!d || !projectId || !clean.length) return;
  await d.collection(COL).doc(String(projectId)).update({
    speakers: admin.firestore.FieldValue.arrayUnion(...clean),
    updatedAt: nowIso(),
  }).catch((e) => console.warn('audioproject: speakers failed —', e.message));
}

// ─── the walk: derive lineage from the urls the rooms already store ─
// PURE half (exported, driven by scripts/test-audio-wiring.js): docs go in as
// { room, docId, title, ins:[urls], outs:[urls] }; walkFrom answers the chain
// either side of one url. A doc has ONE source, so every out descends from
// its in — that is what makes the join unambiguous.
function buildIndex(docs) {
  const byIn = new Map();   // url -> docs that consumed it
  const byOut = new Map();  // url -> docs that produced it
  for (const doc of docs) {
    (doc.ins || []).forEach((u) => {
      if (!u) return;
      if (!byIn.has(u)) byIn.set(u, []);
      byIn.get(u).push(doc);
    });
    (doc.outs || []).forEach((u) => {
      if (!u) return;
      if (!byOut.has(u)) byOut.set(u, []);
      byOut.get(u).push(doc);
    });
  }
  return { byIn, byOut };
}

function entryOf(doc, via) {
  return { room: doc.room, docId: doc.docId, title: doc.title || '', url: (doc.ins || [])[0] || null, via };
}

function walkFrom(index, url) {
  const seen = new Set();
  const key = (d) => `${d.room}:${d.docId}`;

  // here: the docs whose SOURCE is this url (the rooms this file is open in)
  const hereDocs = index.byIn.get(url) || [];
  const here = hereDocs.map((d) => { seen.add(key(d)); return entryOf(d, url); });

  // up: who MADE this url, then who made that doc's source, and so on
  const up = [];
  let cursor = [url];
  for (let depth = 0; depth < WALK_DEPTH && cursor.length; depth += 1) {
    const next = [];
    for (const u of cursor) {
      for (const doc of index.byOut.get(u) || []) {
        if (seen.has(key(doc))) continue;
        seen.add(key(doc));
        up.push(entryOf(doc, u));
        (doc.ins || []).forEach((i) => next.push(i));
      }
    }
    cursor = next;
  }

  // down: who consumed this url's RENDERS (the here-docs' outs — direct
  // consumers of the url itself are already `here`), then who consumed
  // theirs, and so on
  const down = [];
  cursor = [url].concat(hereDocs.flatMap((d) => d.outs || []));
  for (let depth = 0; depth < WALK_DEPTH && cursor.length; depth += 1) {
    const next = [];
    for (const u of cursor) {
      for (const doc of index.byIn.get(u) || []) {
        if (seen.has(key(doc))) continue;
        seen.add(key(doc));
        down.push(entryOf(doc, u));
        (doc.outs || []).forEach((o) => next.push(o));
      }
    }
    cursor = next;
  }

  return { url, here, up, down };
}

// The live index: scan the room collections and normalize each doc to
// {room, docId, title, ins, outs}. One equality-free .get() per collection,
// capped, cached — no composite indexes, and the strip on every page rides
// the cache.
let indexCache = { at: 0, index: null };
async function liveIndex() {
  if (indexCache.index && Date.now() - indexCache.at < INDEX_TTL) return indexCache.index;
  const d = db();
  if (!d) throw new Error('Firestore unavailable');
  const docs = [];
  const scan = async (col, map) => {
    try {
      const snap = await d.collection(col).limit(SCAN_CAP).get();
      snap.docs.forEach((s) => {
        const out = map(s.id, s.data());
        if (out) docs.push(out);
      });
    } catch (e) { console.warn(`audioproject: scan ${col} —`, e.message); }
  };
  await Promise.all([
    scan('forge-blocks', (docId, p) => ({
      room: 'blocks', docId, title: p.title || '',
      ins: [p.source && p.source.url],
      outs: (p.renders || []).map((r) => r && r.url),
    })),
    scan('forge-cutroom', (docId, p) => ({
      room: 'cutroom', docId, title: p.title || '',
      ins: [p.source && p.source.url],
      outs: (p.renders || []).map((r) => r && r.url)
        .concat((p.clips || []).map((k) => k && k.url)),
    })),
    scan('forge-cutmarks', (docId, p) => ({
      room: 'cutmarks', docId, title: p.title || '',
      ins: [p.source && p.source.url],
      outs: (p.renders || []).map((r) => r && r.url),
    })),
    scan(process.env.EDITOR_COLLECTION || 'forge-editor', (docId, p) => ({
      room: 'editor', docId, title: p.title || '',
      ins: (p.sources || []).map((s) => s && s.audioUrl),
      outs: (p.renders || []).map((r) => r && r.url),
    })),
    // a Voice Studio render is an ORIGIN — it consumes nothing we track
    scan('forge-voicelab', (docId, p) => (p.url ? {
      room: 'voice', docId, title: String(p.text || '').slice(0, 60),
      ins: [], outs: [p.url],
    } : null)),
  ]);
  indexCache = { at: Date.now(), index: buildIndex(docs) };
  return indexCache.index;
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
router.use(express.json({ limit: '256kb' }));

router.get('/status', (req, res) => {
  res.json({ ok: true, firebase: admin.apps.length > 0 });
});

router.get('/walk', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const url = String(req.query.url || '').trim();
    if (!/^https?:\/\//.test(url)) return res.status(400).json({ error: 'a url is required' });
    const index = await liveIndex();
    res.json(walkFrom(index, url));
  } catch (err) { fail(res, err); }
});

router.get('/:id', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const doc = await readProject(req.params.id);
    if (!doc) return res.status(404).json({ error: 'no such project' });
    res.json(doc);
  } catch (err) { fail(res, err); }
});

router.post('/:id/title', async (req, res) => {
  try {
    const title = String((req.body && req.body.title) || '').slice(0, 120).trim();
    if (!title) return res.status(400).json({ error: 'a title is required' });
    const d = db();
    if (!d) throw new Error('Firestore unavailable');
    await d.collection(COL).doc(String(req.params.id)).update({ title, updatedAt: nowIso() });
    res.json({ ok: true, title });
  } catch (err) { fail(res, err); }
});

router.post('/:id/speakers', async (req, res) => {
  try {
    await addSpeakers(req.params.id, (req.body && req.body.speakers) || []);
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

module.exports = {
  router,
  // for the wired rooms — all best-effort by contract
  ensureProject, stamp, readProject, addSpeakers,
  // pure halves, driven by scripts/test-audio-wiring.js
  buildIndex, walkFrom,
};
