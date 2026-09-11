'use strict';
// cast.js — THE CHARACTER LIBRARY FOR FOOTAGE, one shelf per FILM.
//
// 2026-09-11, Sophie: "we need a version of 'characters' for footage so i can
// click a button and it auto adds the line at the top, adding and referencing
// videos and stills · characters w multiple outfits will have ex, sophie w
// pajamas vs sophie street clothes · add character icon to footage and have
// it per film - diff folders · some characters are just stills for now".
//
// Until this, every ward clip's references were hunted down by hand: the
// jazz clip's url, three pajama stills, the doctor's 4-second take, and the
// exact line that names each of them by slot — retyped per shot, per chat,
// per belt page, which is where the wrong-slot and wrong-outfit bugs came
// from. This is that hunt as one tap.
//
// WHAT A DOC IS. One per ENTRY (a person, an outfit, a place), keyed
// `<film>__<slug>`, so two films may both have a "sophie" and neither can
// reach the other's:
//   { film, slug, name, kind: 'person'|'wardrobe'|'setting', note, order,
//     hidden, looks: [ { key, name, line, refs: [...], wear: [slug], note } ] }
// A LOOK is the character in one outfit. Its `refs` are what rides; its
// `line` is the template `cast-line.js` resolves (`{1}`, `{2}` … over the
// look's own references, NEVER a literal `[Video1]` — see that file for why).
// `wear` names wardrobe entries by slug, so the pajamas live in ONE place and
// every patient's pajama look points at the same three stills: her rule, the
// same message — "these pajamas float w any patient so keep head off".
//
// SOME CHARACTERS ARE JUST STILLS (her words) and that is a normal entry, not
// a half-made one: a look whose refs are all images works exactly as one
// carrying a clip. A character with NO reference at all is still listed, so
// she can see who is waiting for one.
//
// NOTHING IS DELETED — `hidden` is the verb, the house rule. A LOOK can be
// removed, because a look is one entry in a list and its references are still
// in the Dump; an ENTRY only ever hides.
//
// THE LIBRARY SPENDS NOTHING. No model call anywhere: it stores urls that
// already exist in the Dump and in the clip log, and hands the page a plan.
//
// Routes (mounted at /api/cast by server.js; STUDIO_TOKEN-gated):
//   GET  /films                       the folders, with counts
//   GET  /?film=                      the shelf, in order
//   POST /films                       { slug, name, order } — name a folder
//   POST /entry                       upsert { film, slug?, name, kind, note, order }
//   POST /entry/:id/look              upsert { key?, name, line, refs, wear, note }
//   POST /entry/:id/look/:key/remove  take a look off
//   POST /entry/:id/hide              { hidden }
//   POST /plan                        { film, slug, look, refs } → the attach
// Test: node scripts/test-cast.js · node scripts/test-footage-cast.js

const express = require('express');
const admin = require('firebase-admin');
const castLine = require('./cast-line');

const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const COLL = 'forge-cast';
const FILMS_DOC = '__films';
const MAX_LOOKS = 24;
const MAX_REFS = 12;      // one look's own references — the doors take few
const CACHE_MS = 20000;

function db() { return admin.firestore(); }
function coll() { return db().collection(COLL); }

function slugify(s) { return castLine.slugify(s); }
function docId(film, slug) { return `${film}__${slug}`; }

const KINDS = ['person', 'wardrobe', 'setting'];
function kindOk(k) { return KINDS.indexOf(String(k)) >= 0 ? String(k) : 'person'; }

// ─── Shapes ─────────────────────────────────────────────────────────────
function cleanRefs(list) {
  return (Array.isArray(list) ? list : []).map(castLine.cleanRef).filter(Boolean).slice(0, MAX_REFS);
}
function cleanLook(l, i) {
  l = l || {};
  const name = String(l.name || '').slice(0, 60);
  return {
    key: slugify(l.key || name || ('look-' + (i + 1))) || ('look-' + (i + 1)),
    name,
    // HER WORDS, STORED WHOLE. The line is a template and it is hers to
    // write; nothing here rewords one, and a blank one is a real answer —
    // `cast-line.js` falls back to the barest true sentence rather than
    // inventing a description of a reference.
    line: String(l.line == null ? '' : l.line).slice(0, 1200),
    refs: cleanRefs(l.refs),
    wear: [...new Set((Array.isArray(l.wear) ? l.wear : []).map((s) => String(s).slice(0, 80)).filter(Boolean))].slice(0, 6),
    note: String(l.note == null ? '' : l.note).slice(0, 300),
  };
}
function cardOf(id, d) {
  const looks = (Array.isArray(d.looks) ? d.looks : []).map(cleanLook);
  return {
    id, film: d.film || '', slug: d.slug || '', name: d.name || d.slug || '',
    kind: kindOk(d.kind), note: d.note || '', order: Number(d.order) || 0,
    hidden: Boolean(d.hidden), looks,
    // what the sheet draws a face from: the first picture anywhere on the
    // entry, else the first poster — a video-only character still tiles
    face: faceOf(looks),
    // COUNTED DISTINCT ACROSS THE LOOKS — the jazz clip is on three of
    // Sophie's, and "3 clips" on her row would be the same clip three times.
    stills: countKind(looks, 'image'), clips: countKind(looks, 'video'),
    updatedAt: d.updatedAt || '', createdAt: d.createdAt || '',
  };
}
function countKind(looks, kind) {
  const seen = new Set();
  looks.forEach((l) => l.refs.forEach((r) => { if (r.kind === kind) seen.add(r.url); }));
  return seen.size;
}
function faceOf(looks) {
  for (const l of looks) for (const r of l.refs) if (r.kind === 'image') return r.url;
  for (const l of looks) for (const r of l.refs) if (r.poster) return r.poster;
  return '';
}

// ─── The shelf, cached ──────────────────────────────────────────────────
let cache = { at: 0, rows: null };
async function allRows(fresh) {
  if (!fresh && cache.rows && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const snap = await coll().get();
  const rows = snap.docs.filter((d) => d.id !== FILMS_DOC).map((d) => cardOf(d.id, d.data()));
  cache = { at: Date.now(), rows };
  return rows;
}
function bust() { cache = { at: 0, rows: null }; }

async function filmsDoc() {
  try {
    const s = await coll().doc(FILMS_DOC).get();
    return (s.exists && s.data()) || {};
  } catch { return {}; }
}
// THE FOLDERS ARE DERIVED FROM THE ENTRIES, with the names doc only ever
// SUPPLYING a display name and an order — so a film cannot go missing
// because nobody remembered to declare it, and naming one is optional.
function filmsOf(rows, names) {
  const n = (names && names.films) || {};
  const by = {};
  rows.forEach((r) => {
    if (!r.film) return;
    const f = by[r.film] || (by[r.film] = { slug: r.film, name: (n[r.film] && n[r.film].name) || r.film, order: Number(n[r.film] && n[r.film].order) || 0, people: 0, wardrobe: 0, settings: 0 });
    if (r.hidden) return;
    if (r.kind === 'wardrobe') f.wardrobe += 1;
    else if (r.kind === 'setting') f.settings += 1;
    else f.people += 1;
  });
  Object.keys(n).forEach((slug) => {
    if (!by[slug]) by[slug] = { slug, name: n[slug].name || slug, order: Number(n[slug].order) || 0, people: 0, wardrobe: 0, settings: 0 };
  });
  return Object.values(by).sort((a, b) => (a.order - b.order) || a.slug.localeCompare(b.slug));
}

// The shelf in reading order: people first (that is who a clip is about),
// then the outfits that float across them, then the places — each by its own
// `order` and then by name, so a library nobody has ordered still reads.
const KIND_RANK = { person: 0, wardrobe: 1, setting: 2 };
function shelfOrder(rows) {
  return rows.slice().sort((a, b) =>
    (KIND_RANK[a.kind] - KIND_RANK[b.kind]) || (a.order - b.order) || a.name.localeCompare(b.name));
}

// ─── Writes ─────────────────────────────────────────────────────────────
async function upsertEntry(b) {
  const film = slugify(b.film);
  if (!film) return { error: 'which film?' };
  const name = String(b.name == null ? '' : b.name).slice(0, 80).trim();
  const slug = slugify(b.slug || name);
  if (!slug) return { error: 'give it a name' };
  const id = docId(film, slug);
  const ref = coll().doc(id);
  const now = new Date().toISOString();
  const snap = await ref.get();
  const prev = snap.exists ? snap.data() : null;
  const patch = { film, slug, name: name || (prev && prev.name) || slug, kind: kindOk(b.kind || (prev && prev.kind)), updatedAt: now };
  if (!prev) { patch.createdAt = now; patch.looks = []; patch.order = Number(b.order) || 0; patch.hidden = false; }
  if (b.note != null) patch.note = String(b.note).slice(0, 400);
  if (b.order != null) patch.order = Number(b.order) || 0;
  if (Array.isArray(b.looks)) patch.looks = b.looks.map(cleanLook).slice(0, MAX_LOOKS);
  await ref.set(patch, { merge: true });
  bust();
  const after = await ref.get();
  return { entry: cardOf(id, after.data()) };
}

// A LOOK IS UPSERTED BY KEY, IN PLACE — she renames an outfit or swaps its
// stills and it stays where it is in the row, the way a trimmed part keeps
// its place. A key that is not there is appended.
async function upsertLook(id, b) {
  const ref = coll().doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) return { error: 'no such character' };
  const d = snap.data();
  const looks = (Array.isArray(d.looks) ? d.looks : []).map(cleanLook);
  const look = cleanLook(b, looks.length);
  const at = looks.findIndex((l) => l.key === look.key);
  if (at >= 0) looks[at] = look;
  else {
    if (looks.length >= MAX_LOOKS) return { error: `that is ${MAX_LOOKS} looks already` };
    looks.push(look);
  }
  await ref.set({ looks, updatedAt: new Date().toISOString() }, { merge: true });
  bust();
  return { entry: cardOf(String(id), { ...d, looks }) };
}
async function removeLook(id, key) {
  const ref = coll().doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) return { error: 'no such character' };
  const d = snap.data();
  const looks = (Array.isArray(d.looks) ? d.looks : []).map(cleanLook).filter((l) => l.key !== String(key));
  await ref.set({ looks, updatedAt: new Date().toISOString() }, { merge: true });
  bust();
  return { entry: cardOf(String(id), { ...d, looks }) };
}

// ─── The attach plan ────────────────────────────────────────────────────
// The page asks the SERVER for it as well as computing it itself, because the
// wardrobe an entry WEARS lives in another doc: the sheet holds the whole
// shelf, so it plans locally through the same `cast-line.js`, and this route
// is what a chat calls.
async function planFor(b) {
  const rows = await allRows();
  const film = slugify(b.film);
  const byslug = {};
  rows.forEach((r) => { if (r.film === film) byslug[r.slug] = r; });
  const entry = byslug[slugify(b.slug)];
  if (!entry) return { error: 'no such character in that film' };
  const look = b.look ? castLine.lookByKey(entry, String(b.look)) : entry.looks[0];
  if (b.look && !look) return { error: 'no such look' };
  return { ...castLine.plan({ refs: b.refs, entry, look, byslug }), entry: entry.slug, look: (look && look.key) || '' };
}

// ─── Router ─────────────────────────────────────────────────────────────
const router = express.Router();
router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN || req.query.token === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '2mb' }));

router.get('/films', async (req, res) => {
  try {
    const [rows, names] = await Promise.all([allRows(req.query.fresh === '1'), filmsDoc()]);
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, films: filmsOf(rows, names) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const [rows, names] = await Promise.all([allRows(req.query.fresh === '1'), filmsDoc()]);
    const films = filmsOf(rows, names);
    // A READ WITH NO FILM ANSWERS THE FIRST FOLDER, never every film at once.
    // The sheet is a shelf and a shelf is one film — answering all of them
    // would put two Sophies on it, and would cost the page a second round
    // trip to find out which one it was looking at.
    const asked = slugify(req.query.film || '');
    const film = asked || (films[0] && films[0].slug) || '';
    const mine = rows.filter((r) => r.film === film);
    const list = shelfOrder(req.query.all === '1' ? mine : mine.filter((r) => !r.hidden));
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, film, films, entries: list });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/films', async (req, res) => {
  try {
    const b = req.body || {};
    const slug = slugify(b.slug || b.name);
    if (!slug) return res.status(400).json({ error: 'name the film' });
    const cur = await filmsDoc();
    const films = { ...(cur.films || {}) };
    films[slug] = { name: String(b.name || slug).slice(0, 60), order: Number(b.order) || 0 };
    await coll().doc(FILMS_DOC).set({ films }, { merge: true });
    bust();
    const rows = await allRows(true);
    res.json({ ok: true, films: filmsOf(rows, { films }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/entry', async (req, res) => {
  try {
    const r = await upsertEntry(req.body || {});
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true, ...r });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/entry/:id/look', async (req, res) => {
  try {
    const r = await upsertLook(req.params.id, req.body || {});
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true, ...r });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/entry/:id/look/:key/remove', async (req, res) => {
  try {
    const r = await removeLook(req.params.id, req.params.key);
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true, ...r });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/entry/:id/hide', async (req, res) => {
  try {
    const hidden = Boolean(req.body && req.body.hidden);
    await coll().doc(String(req.params.id)).set({ hidden, updatedAt: new Date().toISOString() }, { merge: true });
    bust();
    res.json({ ok: true, hidden });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/plan', async (req, res) => {
  try {
    const r = await planFor(req.body || {});
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true, ...r });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = {
  router, COLL, FILMS_DOC, KINDS, MAX_LOOKS, MAX_REFS,
  slugify, docId, kindOk, cleanRefs, cleanLook, cardOf, faceOf,
  filmsOf, shelfOrder, upsertEntry, upsertLook, removeLook, planFor, allRows, bust,
};
