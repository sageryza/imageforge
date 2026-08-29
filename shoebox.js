// shoebox.js — the SHOEBOX as a Deck Factory tool: every polaroid in Sophie's
// Memory Library, on one shelf inside the app.
//
// Sophie's ask (2026-08-29): "can u add the shoebox as a module on deck
// factory". The Shoebox itself lives at incaseofamnesia.com/shoebox — a
// polaroid view over membry `users/{uid}/memories` — and Deck Factory already
// has three doors INTO it (the Story Room beat popup, the Meta Assets
// lightbox, the Playground lightbox, all through scratchpad.js's shoeboxPut).
// What it never had is a way to SEE what those doors have filed without
// leaving the app. This module is that view.
//
// READ-ONLY OVER HER LIBRARY, deliberately. A memory is hers, in her app;
// nothing here writes one, edits one, or deletes one — removing a polaroid or
// pinning it to a board stays in the Shoebox itself. The one write this
// module can start is a SQUARING set (POST /square), which is the existing
// cropper.js machinery pointed at a polaroid's memory doc — and even that
// writes a NEW square copy and never touches the source picture.
//
// WHAT A POLAROID IS: a memory carrying `illustration.url`. Measured
// 2026-08-29: 626 memories, 76 illustrated (45 of them `sb-*`, the Deck
// Factory doors' own additions), every doc carrying `createdAt`. So the whole
// library is one cheap `select()` read, cached briefly, and search filters
// the FULL index server-side — never the loaded page (the Assets tab's
// hard-truncate lesson).
//
// NO MODEL CALLS, NO COST. Opening the page spends nothing; a feed read is
// one cached Firestore query. The membry handle is HANDED IN by server.js
// (init below) — the scratchpad/cropper pattern, because the credential lives
// on STORY_FIREBASE_SERVICE_ACCOUNT and this module's own admin app is Deck
// Factory's. WHOSE library it is comes from scratchpad.js's shoeboxUid — the
// ONE copy of the uid discovery (SHOEBOX_UID overrides; a tie refuses rather
// than guessing whose library it is). The uid itself never rides a response.
//
// Mounted at /api/shoebox by server.js. Page: /shoebox (serveGated).
//
// Routes:
//   GET  /status   → { ok, membry, memories, polaroids }            (open)
//   GET  /feed     → ?limit=&offset=&q= → { items, total, offset, limit }
//   POST /square   → { id } → { ok, url:'/crop?set=…' }  (a 1-picture
//                    Squaring set whose save lands back on this memory doc)
//
// Tests: node scripts/test-shoebox.js (the index/caption/search rules pure,
//        then the real page headless when playwright is present).

const express = require('express');

const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const CACHE_MS = 90 * 1000;   // the library moves by hand-taps, not by jobs
const MAX_LIMIT = 200;

let wiring = null;
function init(w) { wiring = w || null; }
async function membryDb() {
  if (!wiring || !wiring.membryDb) return null;
  try { return await wiring.membryDb(); } catch { return null; }
}

/* ── the index: one select() read of the whole library, cached ─────────────
 * `select()` IS A WHITELIST (the Meta Assets caption lesson) — a field left
 * out of this list can never reach the page, however well the rest handles
 * it. `illustration` comes whole because the panels-import door writes the
 * picture's honest provenance inside it (model, quality, size, prompt), and
 * leaving one of those out is how two caption slots hid for weeks.
 */
const FIELDS = ['title', 'illustration', 'createdAt', 'timestamp', 'hashtags', 'source', 'content'];

const atMillis = (m) => {
  if (m.createdAt && typeof m.createdAt.toMillis === 'function') return m.createdAt.toMillis();
  const t = Date.parse(m.timestamp || '');
  return Number.isFinite(t) ? t : 0;
};

// The MODEL · QUALITY · SIZE caption, from what the record honestly carries —
// absent parts are left out, never guessed (the house caption rule; nothing
// here may invent a quality for a picture it did not make).
function captionOf(ill) {
  return [ill && ill.model, ill && ill.quality, ill && ill.size]
    .map((s) => String(s || '').trim()).filter(Boolean).join(' · ');
}

// One feed item. The memory's words are the polaroid's chin; the picture's
// own provenance (when the filing door recorded it) rides along so the
// lightbox can show the caption and the content half — promptContent is the
// EXACT stored text or nothing, per the exact-prompt rule.
function itemOf(id, m) {
  const ill = m.illustration || {};
  return {
    id,
    title: String(m.title || '').trim(),
    url: String(ill.url || ''),
    at: atMillis(m),
    source: String(m.source || (Array.isArray(m.hashtags) && m.hashtags[0]) || '').trim(),
    caption: captionOf(ill),
    promptContent: String(ill.prompt || '').trim(),
  };
}

// A polaroid is a memory WITH a picture; everything else in the library is
// words alone and belongs to the Memory Library's own screens.
function buildIndex(docs) {
  return docs
    .filter((d) => d.data.illustration && d.data.illustration.url)
    .map((d) => itemOf(d.id, d.data))
    .sort((a, b) => b.at - a.at);
}

// The house grammar over the polaroid's words: title, source, hashtags, the
// filed prompt, and the memory's own content — anchored at a word START (the
// feed rule: "red" must not light "tired"). NEVER the url, whose Storage
// filename is a random id that would match for no reason she can see.
function hayOf(m, id) {
  const ill = (m && m.illustration) || {};
  return [m.title, m.content, m.source, ill.prompt, ill.model, ill.quality, ill.size,
    Array.isArray(m.hashtags) ? m.hashtags.join(' ') : '', id]
    .map((s) => String(s || '')).join(' \n ');
}
const { parseQuery } = require('./search-grammar');
function matchQ(hay, groups) {
  const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  for (const g of groups) {
    let hit = false;
    for (const t of g.terms) {
      const rx = new RegExp((/^[a-z0-9]/i.test(t.value) ? '\\b' : '') + esc(t.value), 'i');
      if (rx.test(hay)) { hit = true; break; }
    }
    if (g.neg ? hit : !hit) return false;
  }
  return true;
}

let cache = null;   // { at, items:[{item, hay}], memories }
async function readLibrary(fresh) {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache;
  const mdb = await membryDb();
  if (!mdb) return null;
  const { shoeboxUid } = require('./scratchpad');
  const uid = await shoeboxUid(mdb);
  const q = await mdb.collection('users').doc(uid).collection('memories')
    .select(...FIELDS).get();
  const docs = q.docs.map((d) => ({ id: d.id, data: d.data() }));
  const items = buildIndex(docs).map((item) => {
    const d = docs.find((x) => x.id === item.id);
    return { item, hay: hayOf(d && d.data, item.id) };
  });
  cache = { at: Date.now(), items, memories: q.size, uid };
  return cache;
}

/* ── routes ────────────────────────────────────────────────────────────── */
const router = express.Router();
router.use(express.json({ limit: '256kb' }));
router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.path === '/status') return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN || req.query.token === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
const fail = (res, e) => res.status(500).json({ error: e.message || String(e) });
const noMembry = (res) => res.status(503).json({ error: 'the memory library credential (STORY_FIREBASE_SERVICE_ACCOUNT) is not set' });

router.get('/status', async (req, res) => {
  // Booleans and counts only, off the warm cache — status must stay cheap and
  // must never name a uid or a key.
  res.json({
    ok: true,
    membry: Boolean(wiring && wiring.membryDb),
    memories: cache ? cache.memories : null,
    polaroids: cache ? cache.items.length : null,
  });
});

router.get('/feed', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const lib = await readLibrary(false);
    if (!lib) return noMembry(res);
    const q = String(req.query.q || '').trim();
    let rows = lib.items;
    if (q) {
      const groups = parseQuery(q);
      rows = rows.filter((r) => matchQ(r.hay, groups));
    }
    const total = rows.length;
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const limit = Math.max(1, Math.min(MAX_LIMIT, parseInt(req.query.limit, 10) || 60));
    res.json({ items: rows.slice(offset, offset + limit).map((r) => r.item), total, offset, limit });
  } catch (e) { fail(res, e); }
});

// SQUARE IT — a one-picture Squaring set whose save lands back on this very
// memory doc (cropper.js's `apply {kind:'memory'}`). The uid stays
// server-side: the page sends only the memory id and gets back the /crop
// link. Free — building a set cuts nothing and spends nothing.
router.post('/square', async (req, res) => {
  try {
    const id = String(req.body.id || '').trim();
    if (!id) return res.status(400).json({ error: 'a memory id is required' });
    const lib = await readLibrary(false);
    if (!lib) return noMembry(res);
    const row = lib.items.find((r) => r.item.id === id);
    if (!row) return res.status(404).json({ error: 'no polaroid with that id' });
    const cropper = require('./cropper');
    const out = await cropper.createSet(row.item.title.slice(0, 80) || 'Shoebox polaroid', [{
      url: row.item.url,
      label: row.item.title.slice(0, 200),
      apply: { kind: 'memory', uid: lib.uid, id },
    }]);
    res.json({ ok: true, url: out.url });
  } catch (e) { fail(res, e); }
});

module.exports = { router, init, buildIndex, itemOf, captionOf, hayOf, matchQ, atMillis };
