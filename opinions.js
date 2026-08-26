// opinions.js — Opinions: the decide-on-things game ("you have good opinions").
//
// Sophie's concept (Aug 2026, the commercial chat): an app that shows two ideas
// side by side — businesses, things to make, app ideas, or just two pictures —
// and she picks the better one, Tinder-picker style. The picked side is stamped
// GOOD IDEA, the other BAD IDEA, and the whole surface is relentlessly
// encouraging: a streak, accolades for picking a lot of stuff, and a headline
// that keeps telling her she has good opinions. It PRELOADS all the things —
// opening it is playing it, there is nothing to set up.
//
// THE FEED IS PRELOADED FROM TWO PLACES: `opinions-feed.json` (committed —
// the starter deck, image sides point at committed webps under public/) plus
// Firestore extras any chat can add via POST /items. Extras with an id already
// in the seed are ignored — the committed copy wins, so a bad POST can never
// shadow a curated item. Item ids are permanent: a pick is keyed to its item
// id, so renaming one orphans her answer.
//
// PICKS ARE ONE DOC PER ITEM, id = the item id — re-picking updates in place
// (changing her mind is the point, never a duplicate). Notes ride on the same
// doc (`note` + `noteSide`), merge-written, so a note can land before or after
// the pick without clobbering it. Nothing here is ever deleted.
//
// NO MODEL CALLS, NO COST. Opening the page spends nothing (house rule);
// everything served is committed files + one small Firestore read.
//
// Firestore (deckfactory-43176): `forge-opinions` = one doc per pick,
// `forge-opinions-items` = added matchups. Without Firebase the game still
// plays (feed serves, picks just don't persist — POST answers 503).
//
// Mounted at /api/opinions by server.js. Page: /opinions (serveGated).
//
// Routes:
//   GET  /status  → { ok, firebase, items }                     (open)
//   GET  /feed    → { items, picks, accolades, lines, total }   (gated)
//   POST /pick    → { id, pick:'a'|'b', note? }                 (gated)
//   POST /note    → { id, note, side? }                         (gated)
//   POST /items   → { items:[{id?,kind,category,q,a,b}] }       (gated)
//
// Tests: node scripts/test-opinions.js (pure — seed shape, merge, accolades).

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PICKS = 'forge-opinions';
const ITEMS = 'forge-opinions-items';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';

const db = () => admin.firestore();
const hasFirebase = () => Boolean(admin.apps.length);

/* ── the preloaded seed ────────────────────────────────────────────────── */
let seedCache = null;
function seedItems() {
  if (!seedCache) {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'opinions-feed.json'), 'utf8'));
    seedCache = (raw.items || []).filter(it => validItem(it) === null);
  }
  return seedCache;
}

/* ── the reward ladder + the headlines (served so page and server agree) ── */
const ACCOLADES = [
  { n: 1, name: 'Opinion Haver' },
  { n: 5, name: 'Certified Decider' },
  { n: 10, name: 'Tastemaker' },
  { n: 20, name: 'Curator' },
  { n: 30, name: 'Visionary' },
  { n: 50, name: 'Thought Leader' },
  { n: 100, name: 'Chief Opinion Officer' },
];
const LINES = [
  'You have good opinions.',
  'Your opinions matter.',
  'Great call.',
  "You're right, obviously.",
  'Excellent taste.',
  'The world needs your takes.',
  'Strong opinion. Correct, too.',
  'You should decide more things.',
  'History will agree with you.',
  'Another good opinion.',
];

// The highest accolade earned at `count` picks, or null before the first.
function accoladeFor(count) {
  let best = null;
  for (const a of ACCOLADES) if (count >= a.n) best = a;
  return best;
}

/* ── item validation (shared by the seed load and POST /items) ─────────── */
const CATEGORIES = ['look', 'make', 'business', 'app', 'wild'];
// Modes (Aug 2026, Sophie): 'easy' = the hook — matchups with an obviously
// right answer ('right' names the side; picking it is a point, picking the
// other gets a raised eyebrow instead of a stamp party). 'hard' = ethically
// ambiguous but completely insane; no right side, sides carry a
// `more information: "…"` line (`info`). No mode = the normal feed.
// verb 'shoot' draws the gun: one bullet, tap the side to shoot.
const MODES = ['easy', 'hard'];
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// null when the item is well-formed, else a one-line reason.
function validItem(it) {
  if (!it || typeof it !== 'object') return 'not an object';
  if (it.kind !== 'text' && it.kind !== 'image') return 'kind must be text|image';
  if (!CATEGORIES.includes(it.category)) return 'category must be ' + CATEGORIES.join('|');
  if (it.mode != null && !MODES.includes(it.mode)) return 'mode must be ' + MODES.join('|');
  if (it.verb != null && it.verb !== 'shoot') return 'verb must be shoot';
  if (it.right != null && it.right !== 'a' && it.right !== 'b') return 'right must be a|b';
  if (it.right != null && it.mode !== 'easy') return 'right belongs to easy mode';
  if (it.twin != null && (typeof it.twin !== 'string' || it.mode !== 'easy')) return 'twin is an easy item naming its hard version';
  for (const side of ['a', 'b']) {
    const s = it[side];
    if (!s || !s.t) return side + '.t required';
    if (it.kind === 'image' && !s.img) return side + '.img required for kind image';
  }
  return null;
}

function cleanItem(it) {
  const side = s => {
    const o = { t: clip(s.t, 120) };
    if (s.s) o.s = clip(s.s, 160);
    if (s.img) o.img = clip(s.img, 500);
    if (s.info) o.info = clip(s.info, 200);
    return o;
  };
  const out = {
    id: slug(it.id) || 'op-' + crypto.createHash('sha1')
      .update(`${it.a.t}|${it.b.t}`).digest('hex').slice(0, 10),
    kind: it.kind, category: it.category,
    q: clip(it.q, 120), a: side(it.a), b: side(it.b),
  };
  if (it.mode) out.mode = it.mode;
  if (it.verb) out.verb = it.verb;
  if (it.right) out.right = it.right;
  if (it.twin) out.twin = slug(it.twin);
  return out;
}

// Seed first, then extras that don't collide with a seed id (committed wins),
// deduped among themselves — the shape /feed serves.
function mergeFeed(seed, extras) {
  const seen = new Set(seed.map(it => it.id));
  const out = seed.slice();
  for (const it of extras) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

/* ── the gate (audio.js's shape: /status open, the rest token-gated) ───── */
const router = express.Router();
router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.path === '/status') return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN || req.query.token === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

router.get('/status', (req, res) => {
  res.json({ ok: true, firebase: hasFirebase(), items: seedItems().length });
});

/* ── the feed ──────────────────────────────────────────────────────────── */
router.get('/feed', async (req, res) => {
  try {
    let extras = [], picks = {};
    if (hasFirebase()) {
      const [itemSnap, pickSnap] = await Promise.all([
        db().collection(ITEMS).get(),
        db().collection(PICKS).get(),
      ]);
      extras = itemSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(it => validItem(it) === null);
      for (const d of pickSnap.docs) {
        const v = d.data();
        picks[d.id] = { pick: v.pick || null, note: v.note || '', noteSide: v.noteSide || '', at: v.at || 0 };
      }
    }
    const items = mergeFeed(seedItems(), extras);
    res.json({ ok: true, firebase: hasFirebase(), items, picks, total: items.length, accolades: ACCOLADES, lines: LINES });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

/* ── a pick ────────────────────────────────────────────────────────────── */
router.post('/pick', async (req, res) => {
  try {
    if (!hasFirebase()) return res.status(503).json({ error: 'no Firebase on this server — picks cannot save' });
    const b = req.body || {};
    const id = slug(b.id);
    const pick = b.pick === 'a' || b.pick === 'b' ? b.pick : null;
    if (!id || !pick) return res.status(400).json({ error: 'id and pick (a|b) required' });
    const doc = { item: id, pick, at: Date.now() };
    if (b.note) { doc.note = clip(b.note, 2000); doc.noteSide = b.pick; }
    await db().collection(PICKS).doc(id).set(doc, { merge: true });
    const all = await db().collection(PICKS).get();
    res.json({ ok: true, picked: all.size, accolade: accoladeFor(all.size) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

/* ── a note on a matchup (before or after its pick) ────────────────────── */
router.post('/note', async (req, res) => {
  try {
    if (!hasFirebase()) return res.status(503).json({ error: 'no Firebase on this server — notes cannot save' });
    const b = req.body || {};
    const id = slug(b.id);
    if (!id || !b.note) return res.status(400).json({ error: 'id and note required' });
    if (String(b.note).length > 2000) return res.status(400).json({ error: 'note over 2000 chars — refused, not truncated' });
    const doc = { item: id, note: String(b.note), at: Date.now() };
    if (b.side === 'a' || b.side === 'b') doc.noteSide = b.side;
    await db().collection(PICKS).doc(id).set(doc, { merge: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

/* ── add matchups (any chat can preload more things) ───────────────────── */
router.post('/items', async (req, res) => {
  try {
    if (!hasFirebase()) return res.status(503).json({ error: 'no Firebase on this server' });
    const list = Array.isArray((req.body || {}).items) ? req.body.items : [];
    if (!list.length) return res.status(400).json({ error: 'items[] required' });
    const seedIds = new Set(seedItems().map(it => it.id));
    const results = [];
    for (const raw of list.slice(0, 100)) {
      const why = validItem(raw);
      if (why) { results.push({ ok: false, error: why }); continue; }
      const it = cleanItem(raw);
      if (seedIds.has(it.id)) { results.push({ ok: false, id: it.id, error: 'id already in the committed seed' }); continue; }
      const { id, ...data } = it;
      await db().collection(ITEMS).doc(id).set(data, { merge: true });
      results.push({ ok: true, id });
    }
    res.json({ ok: results.every(r => r.ok), results });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
});

module.exports = { router, accoladeFor, mergeFeed, validItem, cleanItem, ACCOLADES, LINES, CATEGORIES };
