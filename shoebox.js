// shoebox.js — the SHOEBOX as a Deck Factory tool: Sophie's Memory Library as
// polaroids, and her corkboards, inside the app.
//
// Sophie's ask (2026-08-29): "can u add the shoebox as a module on deck
// factory" — and, on the first cut that shipped only a picture shelf: "you
// forgot the library and the boards and the strings in the play button and
// everything else." So this is the WHOLE Shoebox, ported faithfully from
// memory-library-react (src/components/shoebox/), over the SAME data:
//
//   memories     membry users/{uid}/memories            — READ-ONLY here
//   board state  membry users/{uid}/preferences/shoebox — READ/WRITE here,
//                the exact doc the real Shoebox at incaseofamnesia.com/shoebox
//                saves, same shape, so a board arranged in either app is the
//                same board in the other.
//
// MEMORIES STAY READ-ONLY: nothing here writes, edits or deletes one (the one
// write near them is /square, which cuts a NEW copy through cropper.js). The
// BOARD DOC is read/write because the boards ARE the feature — pins, strings
// (constellations), play order, papers — and writing any other doc shape
// would fork her boards into two piles. The doc's compatibility rules are the
// React hook's own (useShoeboxState.js): accept every shape it has ever had,
// MIRROR the current board's pins/strings at the top level for older cached
// pages, and an unknown paper id survives a round trip instead of being
// erased by an older page.
//
// NO MODEL CALLS, NO COST. The whole library is one cheap `select()` read
// (measured 2026-08-29: 626 memories, all carrying `createdAt`), cached
// briefly; search filters the FULL index server-side. WHOSE library it is
// comes from scratchpad.js's shoeboxUid — the ONE copy of the uid discovery
// (SHOEBOX_UID overrides; a tie refuses rather than guessing). The uid never
// rides a response.
//
// Mounted at /api/shoebox by server.js. Page: /shoebox (serveGated).
//
// Routes:
//   GET  /status        → { ok, membry, memories, polaroids }        (open)
//   GET  /feed          → ?limit=&offset=&q= → { items, total, offset, limit }
//                         EVERY memory (an undeveloped one has url:'') —
//                         the library shows words-on-film cards too.
//   GET  /board-state   → { boards, current } (normalized)
//   POST /board-state   → { boards, current } — validated, whole-state save
//                         (the React hook's own debounced-whole-doc shape)
//   POST /square        → { id } → { ok, url:'/crop?set=…' }
//
// Tests: node scripts/test-shoebox.js (the index/caption/search/board rules
//        pure, then the real page headless when playwright is present).

const express = require('express');

const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const CACHE_MS = 90 * 1000;   // the library moves by hand-taps, not by jobs
const MAX_LIMIT = 2000;

// Board caps — sanity bounds, far above anything real (her biggest board is
// a few dozen pins), so a runaway page cannot write a megabyte doc.
const MAX_BOARDS = 40;
const MAX_PINS = 500;
const MAX_STRINGS = 120;

let wiring = null;
function init(w) { wiring = w || null; }
async function membryDb() {
  if (!wiring || !wiring.membryDb) return null;
  try { return await wiring.membryDb(); } catch { return null; }
}

/* ── the index: one select() read of the whole library, cached ─────────────
 * `select()` IS A WHITELIST (the Meta Assets caption lesson) — a field left
 * out of this list can never reach the page. `illustration` comes whole
 * because the panels-import door writes the picture's honest provenance
 * inside it (model, quality, size, prompt); `content` because an undeveloped
 * polaroid IS its words, and the detail card shows them.
 */
const FIELDS = ['title', 'illustration', 'createdAt', 'timestamp', 'hashtags', 'source', 'content'];

const stripHtml = (s) => String(s || '')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const atMillis = (m) => {
  // The React app sorts timestamp-first (the memory's own moment), createdAt
  // as the fallback — kept identical so the two shelves agree on the order.
  const t = Date.parse(m.timestamp || '');
  if (Number.isFinite(t)) return t;
  if (m.createdAt && typeof m.createdAt.toMillis === 'function') return m.createdAt.toMillis();
  return 0;
};

// The MODEL · QUALITY · SIZE caption, from what the record honestly carries —
// absent parts are left out, never guessed (the house caption rule).
function captionOf(ill) {
  return [ill && ill.model, ill && ill.quality, ill && ill.size]
    .map((s) => String(s || '').trim()).filter(Boolean).join(' · ');
}

// One feed item — EVERY memory, pictureless ones included: the library shows
// those as words on undeveloped film, and a board can pin them. promptContent
// is the EXACT stored text or nothing, per the exact-prompt rule.
function itemOf(id, m) {
  const ill = m.illustration || {};
  return {
    id,
    title: stripHtml(m.title),
    content: stripHtml(m.content).slice(0, 4000),
    url: String(ill.url || ''),
    at: atMillis(m),
    ts: String(m.timestamp || ''),
    source: String(m.source || (Array.isArray(m.hashtags) && m.hashtags[0]) || '').trim(),
    caption: captionOf(ill),
    promptContent: String(ill.prompt || '').trim(),
  };
}

function buildIndex(docs) {
  return docs.map((d) => itemOf(d.id, d.data)).sort((a, b) => b.at - a.at);
}

// The house grammar over the polaroid's words: title, content, source,
// hashtags, the filed prompt — anchored at a word START (the feed rule:
// "red" must not light "tired"). NEVER the url, whose Storage filename is a
// random id that would match for no reason she can see.
function hayOf(m, id) {
  const ill = (m && m.illustration) || {};
  return [m.title, m.content, m.source, ill.prompt, ill.model, ill.quality, ill.size,
    Array.isArray(m.hashtags) ? m.hashtags.join(' ') : '', id]
    .map((s) => stripHtml(s)).join(' \n ');
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

let cache = null;   // { at, items:[{item, hay}], memories, uid }
async function readLibrary(fresh) {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache;
  const mdb = await membryDb();
  if (!mdb) return null;
  const { shoeboxUid } = require('./scratchpad');
  const uid = await shoeboxUid(mdb);
  const q = await mdb.collection('users').doc(uid).collection('memories')
    .select(...FIELDS).get();
  const docs = q.docs.map((d) => ({ id: d.id, data: d.data() }));
  const hays = {};
  docs.forEach((d) => { hays[d.id] = hayOf(d.data, d.id); });
  const items = buildIndex(docs).map((item) => ({ item, hay: hays[item.id] }));
  cache = { at: Date.now(), items, memories: q.size, uid };
  return cache;
}

/* ── the board doc, the React hook's own compatibility rules ────────────── */
const newId = () => Math.random().toString(36).slice(2, 8);
const PORTRAIT = { w: 1600, h: 2600 };
const LEGACY = { w: 2600, h: 1700 };
const chainIds = (c) => (c && c.ids) || (Array.isArray(c) ? c : []);
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

function cleanPin(p) {
  if (!p || typeof p !== 'object' || !p.id) return null;
  return {
    id: String(p.id).slice(0, 80),
    x: num(p.x, 20),
    y: num(p.y, 20),
    seq: p.seq == null ? null : num(p.seq, null),
  };
}

function normBoard(b) {
  const src = b || {};
  return {
    id: String(src.id || newId()).slice(0, 20),
    name: String(src.name || 'Board').slice(0, 60),
    w: num(src.w, 0) > 0 ? num(src.w, 0) : LEGACY.w,
    h: num(src.h, 0) > 0 ? num(src.h, 0) : LEGACY.h,
    pins: (Array.isArray(src.pins) ? src.pins : []).map(cleanPin).filter(Boolean).slice(0, MAX_PINS),
    // The paper is a stored id — which papers exist is the PAGE's business,
    // so an id this build doesn't know survives a round trip.
    bg: typeof src.bg === 'string' && src.bg ? src.bg.slice(0, 20) : 'cork',
    // Firestore forbids nested arrays, so a chain is {ids:[…]}; a bare array
    // (the original shape) is accepted on the way in.
    strings: (Array.isArray(src.strings) ? src.strings : [])
      .map((c) => ({ ids: chainIds(c).map((x) => String(x).slice(0, 80)) }))
      .filter((c) => c.ids.length)
      .slice(0, MAX_STRINGS),
  };
}

// Accept every shape this doc has ever had: multi-board, and the original
// single-board {pins, strings}.
function fromRaw(d) {
  if (d && Array.isArray(d.boards) && d.boards.length) {
    const boards = d.boards.slice(0, MAX_BOARDS).map(normBoard);
    const current = boards.some((b) => b.id === d.current) ? d.current : boards[0].id;
    return { boards, current };
  }
  const legacy = normBoard({
    id: 'b1', name: 'Memories', ...LEGACY,
    pins: d && d.pins, strings: d && d.strings,
  });
  return { boards: [legacy], current: legacy.id };
}

async function boardRef() {
  const mdb = await membryDb();
  if (!mdb) return null;
  const { shoeboxUid } = require('./scratchpad');
  const uid = await shoeboxUid(mdb);
  return mdb.collection('users').doc(uid).collection('preferences').doc('shoebox');
}

/* ── routes ────────────────────────────────────────────────────────────── */
const router = express.Router();
router.use(express.json({ limit: '2mb' }));
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
    polaroids: cache ? cache.items.filter((r) => r.item.url).length : null,
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
    const limit = Math.max(1, Math.min(MAX_LIMIT, parseInt(req.query.limit, 10) || MAX_LIMIT));
    res.json({ items: rows.slice(offset, offset + limit).map((r) => r.item), total, offset, limit });
  } catch (e) { fail(res, e); }
});

// ── the boards ────────────────────────────────────────────────────────────
router.get('/board-state', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const ref = await boardRef();
    if (!ref) return noMembry(res);
    const snap = await ref.get();
    res.json(fromRaw(snap.exists ? snap.data() : null));
  } catch (e) { fail(res, e); }
});

// The whole state, saved whole — the React hook's own shape (a pin move and
// the string it changes must land together). Normalized on the way in, so a
// bad page can never write a doc the real Shoebox chokes on; the top-level
// pins/strings MIRROR the current board for older cached pages of the app.
router.post('/board-state', async (req, res) => {
  try {
    const ref = await boardRef();
    if (!ref) return noMembry(res);
    const st = fromRaw(req.body);
    const cur = st.boards.find((b) => b.id === st.current) || st.boards[0];
    const FV = require('firebase-admin').firestore.FieldValue;
    await ref.set({
      boards: st.boards,
      current: st.current,
      pins: cur.pins,
      strings: cur.strings,
      updatedAt: FV.serverTimestamp(),
    }, { merge: true });
    res.json({ ok: true, boards: st.boards.length, current: st.current });
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
    if (!row || !row.item.url) return res.status(404).json({ error: 'no polaroid with that id' });
    const cropper = require('./cropper');
    const out = await cropper.createSet(row.item.title.slice(0, 80) || 'Shoebox polaroid', [{
      url: row.item.url,
      label: row.item.title.slice(0, 200),
      apply: { kind: 'memory', uid: lib.uid, id },
    }]);
    res.json({ ok: true, url: out.url });
  } catch (e) { fail(res, e); }
});

module.exports = {
  router, init,
  buildIndex, itemOf, captionOf, hayOf, matchQ, atMillis, stripHtml,
  normBoard, fromRaw, cleanPin,
};
