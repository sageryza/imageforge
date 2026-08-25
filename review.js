// review.js — THE REVIEW QUEUE (Aug 2026, Sophie: "we're working on templates
// for reviewing things Tinder style but right now I have a pile of things that
// need to be reviewed and I'd like one screen that shows all the things
// waiting to be reviewed").
//
// One screen, every deck and grid template page across every chat, each with
// how far through it she is. Measured the day it was built (2026-08-18): 9
// template pages holding 285 items, 9 of them decided — the pile was real.
//
// ---- DECKS AND ONLY DECKS (Aug 2026 v2, Sophie: "take away the chat list at
// the bottom and instead offer a link back to the chat in the piles area").
// A chat tagged `to be reviewed` was briefly a row here as well, and it was
// the one thing on the screen with nothing to swipe and no cards to count.
// The chat is now reached from INSIDE the deck that belongs to it (judge.js's
// piles footer), so every row on this screen is a thing she can review.
//
// ---- AND THE TWO WAYS OFF THE PILE ARE IN THE DECK TOO (same day: "get rid
// of the X on all of the icons and instead offer a skip or done button in the
// piles area"). The tiles carry no ✕: `reviewHidden` (skip — never a review)
// and `reviewDone` (finished, whatever the cards say) are stamped from the
// deck's piles view through chatfeed's POST /page/:id/review. This module
// READS both; its only write is the queue's own ↩ out of the hidden pile.
//
// WHAT COUNTS AS WAITING, and why it can be derived instead of filed:
//   • The queue is the TEMPLATE pages (deck/grid, page-templates.js). Their
//     item lists are data the server holds (chat-pages/<id>.json), and her
//     answers land per item on the page's verdict doc — so "how far through"
//     is two reads, nothing any chat has to remember to post. Hand-built HTML
//     pages stay out: their items live inside their markup, and guessing at a
//     total would show her a wrong number.
//   • An item is DECIDED when its verdict is anything but empty — ♥, ✕,
//     'maybe', or one of a page's own states. The stock 'later' is literally
//     "declined to sort now" (judge.js), so on a stock-states page it stays
//     UNDECIDED — 'later' is the pile she asked to be reminded of. A page
//     that brought its own states chose its own words, so every one of them
//     counts.
//   • A superseded page is history, not homework — it is on neither list.
//   • THE SERVER'S OWN AUTO-COMPARE PAGES SIT BEHIND THEIR OWN TAB (Aug 2026,
//     Sophie: "as for the automate compare pages, I would hide them behind a
//     separate tab in the review queue to separate them from chat made
//     ones"). Nobody asked her for those — `runAutoCompare` keeps two
//     standing grids per chat off the filed prompts and captions, so they
//     appear and refresh on their own, and mixed into the pile they read
//     like homework a chat handed her. Measured the day this shipped: 5 of
//     the 30 waiting rows. The marker is STRUCTURAL, not a new field — the
//     server names them `auto-<kind>--<chat>` (chatfeed.js) while every
//     chat-posted page gets a random Firestore id, so a chat cannot land in
//     this tab and an auto page cannot escape it. They still count as
//     waiting work; they just count in their own column.
//   • NOT EVERY DECK IS A REVIEW (the template demos, a browse-only card
//     deck), so the deck's piles view carries SKIP — "not a review" — which
//     stamps `reviewHidden`. Hidden is the verb, nothing is deleted: hidden
//     tiles keep a pile of their own behind the DONE tab and un-hide with one
//     tap. DONE beside it stamps `reviewDone` for a deck she is finished with
//     whatever the cards say.
//
// IT COSTS NOTHING. No model call; the template pages' item lists are frozen
// per page BY DESIGN (a new version is a new page), so each page's Storage
// JSON is read once ever per process and cached. Steady state is one small
// Firestore query, one getAll over the verdict docs, and the registry's own
// 5-minute cache for chat names. The answer is held 60s; ?fresh=1 refreshes.
//
// Mounted at /api/review by server.js, page at /review, iOS tile "Review
// Queue". STUDIO_TOKEN-gated (only /status is open).
//
// Routes:
//   GET  /status          → { ok, firebase }
//   GET  /?fresh=1        → { waiting, auto, done, hidden, counts } (rows)
//   POST /hide { id, hidden } → stamps reviewHidden (the queue's own ↩; the
//     deck's Skip/Done go to chatfeed's POST /page/:id/review, which is
//     reachable under the same gate as the verdicts it is already saving)
//
// Tests: node scripts/test-review.js (the whole decision table, pure fixtures;
// plus the real page headless when playwright is around).

const express = require('express');
const admin = require('firebase-admin');
const chatfeed = require('./chatfeed');

const PAGES = 'forge-chat-pages';
const VERDICTS = 'forge-chat-verdicts';
const SCAN_PAGES = 200;   // newest template pages considered; far above today's 9
// The server's own standing comparisons: runAutoCompare (chatfeed.js) writes
// them at a deterministic `auto-<kind>--<chat>`, and a chat-posted page always
// gets a random Firestore id — so this one regex is the whole telling-apart,
// with no field for anyone to remember to send.
const AUTO_ID = /^auto-/;

function db() {
  if (!admin.apps.length) throw new Error('firebase not configured');
  return admin.firestore();
}

function fail(res, err) {
  console.error('[review]', err && err.message ? err.message : err);
  res.status(String(err && err.message).includes('not configured') ? 503 : 500)
    .json({ error: String(err && err.message || err) });
}

function clean(v, n) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
}

function ms(iso) {
  const t = Date.parse(String(iso || ''));
  return Number.isFinite(t) ? t : 0;
}

// ---------------------------------------------------------------------------
// THE PURE HALF — takes plain objects so scripts/test-review.js can drive the
// whole decision table with fixtures and no network.
// ---------------------------------------------------------------------------

/** One item's words, for a tile with no picture — a text deck's first card is
 *  its own face (the moment card may carry no single `text` at all). */
function itemWords(it) {
  if (!it) return '';
  return it.text || it.who || it.eyebrow || it.label
    || (Array.isArray(it.sections) && it.sections[0] && it.sections[0].text) || '';
}

/** Spread key → the member cards' ids, for every group of 2+. THE SAME
 *  DERIVATION AS page-views.js `spreadsOf` — the key is derived from the
 *  group's label (`s:` prefixed, deduped in order), never stored, so it has
 *  to be computed identically here or a spread verdict can never be matched
 *  back to its cards. Found live 2026-08-20: Sophie reviewed the "Monkey +
 *  summit" grid (a spread pick, `s:monkeys-…` → the winning card) and the
 *  queue went on saying "10 to go" — her heart "didn't work" because this
 *  file only ever counted card ids. */
function pageSpreads(data) {
  const groups = data && data.groups && data.groups.length
    ? data.groups
    : (data && data.items ? data.items.map((it) => ({ items: [it] })) : []);
  const taken = {}; const map = {};
  groups.forEach((g, i) => {
    const items = (g && g.items) || [];
    if (items.length < 2) return;      // a one-card spread has no key of its own
    const base = String(g.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 40) || (`spread-${i + 1}`);
    let id = base; let n = 2;
    while (taken[id]) { id = `${base}-${n}`; n += 1; }
    taken[id] = 1;
    map[`s:${id}`] = items.map((it) => String(it && it.id || '')).filter(Boolean);
  });
  return map;
}

/** The item ids, custom-states flag, thumbnail and text peek out of one page's
 *  frozen data JSON (the shape validateTemplate stored). */
function pageItems(data) {
  const items = data && data.items
    ? data.items
    : (data && data.groups ? data.groups.flatMap((g) => g.items || []) : []);
  return {
    ids: items.map((it) => String(it && it.id || '')).filter(Boolean),
    custom: Boolean(data && data.states && data.states.length),
    spreads: pageSpreads(data),
    thumb: (items.find((it) => it && it.img) || {}).img || '',
    // the first card's words — what a TEXT deck's tile shows in the picture's
    // place (measured 2026-08-19: 12 of the 15 queued pages had no picture at
    // all — video ideas, date moments, card titles — so this is the common face)
    peek: String(items.map(itemWords).find(Boolean) || ''),
  };
}

/** Decided / later counts for one page's items against its verdict map.
 *  A verdict on a SPREAD (`s:` key — a ♥/✕ on the whole row, or a "this one"
 *  pick, whose value is the winning card's id) decides every card in that
 *  spread: she judged them as a set, and that is a review of each of them.
 *  A card's own mark still wins where both exist. */
function pageProgress(ids, custom, verdictItems, spreads) {
  const v = verdictItems || {};
  const viaSpread = {};
  Object.keys(spreads || {}).forEach((key) => {
    const val = v[key];
    if (val === undefined || val === null) return;
    (spreads[key] || []).forEach((id) => {
      if (viaSpread[id] === undefined) viaSpread[id] = val;
    });
  });
  let decided = 0; let later = 0;
  ids.forEach((id) => {
    let val = v[id];
    if (val === undefined || val === null) val = viaSpread[id];
    if (val === undefined || val === null) return;
    // stock states: 'later' is "declined to sort now" — still waiting, but
    // counted apart so the row can say so. A page's OWN states all count.
    if (!custom && val === 'later') { later += 1; return; }
    decided += 1;
  });
  return { decided, later };
}

/**
 * Build the whole queue from plain data.
 *
 * @param {object}   input
 * @param {object[]} input.pages    template page docs {id, chat, title,
 *                                  created, template, superseded, reviewHidden}
 * @param {object}   input.items    id → the page's frozen data JSON
 * @param {object}   input.verdicts `<chat>__page-<id>` → verdict doc data
 * @param {object}   input.chats    registry map, slug → doc (displayName)
 */
function buildQueue({ pages, items, verdicts, chats }) {
  const waiting = []; const auto = []; const done = []; const hidden = [];
  (pages || []).forEach((p) => {
    if (!p || !p.id || !p.chat || p.superseded) return;
    const data = (items || {})[p.id];
    if (!data) return;                       // unreadable data: no wrong numbers
    const { ids, custom, spreads, thumb, peek } = pageItems(data);
    if (!ids.length) return;
    const vdoc = (verdicts || {})[`${p.chat}__page-${p.id}`] || {};
    const { decided, later } = pageProgress(ids, custom, vdoc.items, spreads);
    const reg = (chats || {})[p.chat] || {};
    const row = {
      id: p.id,
      chat: p.chat,
      name: clean(reg.displayName, 80) || p.chat,
      title: clean(p.title, 140) || 'Untitled',
      template: p.template === 'grid' ? 'grid' : 'deck',
      created: clean(p.created, 40),
      // ?clean=1 — straight onto the cards, no h1 (Aug 2026, Sophie: "not a
      // compare page because that has a header at the top, but instead just a
      // clean Tinder style page … with all the content preloaded")
      url: `/api/chatfeed/page/${p.id}?clean=1`,
      total: ids.length,
      decided,
      later,
      thumb: clean(thumb, 500),
      peek: clean(peek, 160),
      // the newest touch — her last verdict when there is one, else the post
      at: clean(vdoc.updatedAt, 40) || clean(p.created, 40),
    };
    row.kind = 'page';
    // the server's own standing grids, told apart by the id it gives them
    row.auto = AUTO_ID.test(p.id);
    if (p.reviewHidden) { hidden.push(row); return; }
    // DONE is derived from the counts, and ALSO said outright: her Done button
    // in the deck's piles area (Aug 2026) stamps `reviewDone`, because "I'm
    // finished with this one" is a real answer even when cards are unmarked —
    // a browse she read through, a set she decided about as a whole.
    if (p.reviewDone || decided >= ids.length) done.push(row);
    else (row.auto ? auto : waiting).push(row);
  });
  // ---- THE TAGGED-CHAT ROWS ARE GONE (Aug 2026 v2, Sophie: "take away the
  // chat list at the bottom and instead offer a link back to the chat in the
  // piles area"). A chat carrying `to be reviewed` used to be a row here, and
  // it was the one thing on the screen with no cards to count and nothing to
  // swipe. The way to the chat is now INSIDE the deck it belongs to — the
  // piles view's "Open the chat" — so the queue is decks and only decks.
  // The label still files a chat out of her main list in the Chats app; it
  // simply no longer puts a second kind of row in front of the pile.
  //
  // Waiting: newest post first — the feed's own order, so the pile reads the
  // way everything else does. Done and hidden: most recently touched first.
  waiting.sort((a, b) => ms(b.created) - ms(a.created));
  auto.sort((a, b) => ms(b.created) - ms(a.created));
  done.sort((a, b) => ms(b.at) - ms(a.at));
  hidden.sort((a, b) => ms(b.at) - ms(a.at));
  return {
    waiting,
    auto,
    done,
    hidden,
    counts: {
      // the headline counts what a chat asked her for; the auto pages carry
      // their own number so neither pile is hidden inside the other
      pages: waiting.length,
      items: waiting.reduce((n, r) => n + (r.total - r.decided), 0),
      auto: auto.length,
      autoItems: auto.reduce((n, r) => n + (r.total - r.decided), 0),
      done: done.length,
    },
  };
}

// ---------------------------------------------------------------------------
// The router
// ---------------------------------------------------------------------------

// A template page's data is FROZEN by design (a new version is a new page), so
// one download per page id per process is the whole Storage cost. The one
// exception is the AUTO pages (auto-compare, chatfeed.js), whose data updates
// in place — their doc stamps `updated` on every rewrite, so it rides the
// cache key and a stale copy is re-read exactly once per update.
const itemCache = new Map();   // page id@updated → parsed data JSON (or null)
// Cached forever per id by design — sized in every memwatch snapshot so
// 'forever' stays honest about what it costs.
require('./memwatch').gauge('reviewItemCache', () => itemCache.size);
require('./memwatch').gauge('reviewItemCacheMB', () => Math.round(Array.from(itemCache.values()).reduce((a, v) => a + (v ? JSON.stringify(v).length : 0), 0) / 1048576));

const cacheKey = (p) => `${p.id}@${p.updated || ''}`;

async function loadItems(pages) {
  const bucket = admin.storage().bucket();
  const missing = pages.filter((p) => !itemCache.has(cacheKey(p)));
  // a handful at a time — today's queue is nine pages, but be polite anyway
  for (let i = 0; i < missing.length; i += 6) {
    await Promise.all(missing.slice(i, i + 6).map(async (p) => {
      try {
        const [buf] = await bucket.file(p.path || `chat-pages/${p.id}.json`).download();
        itemCache.set(cacheKey(p), JSON.parse(buf.toString('utf8')));
      } catch (e) {
        console.error('[review] page data unreadable', p.id, e.message);
        itemCache.set(cacheKey(p), null);
      }
    }));
  }
  const out = {};
  pages.forEach((p) => { const d = itemCache.get(cacheKey(p)); if (d) out[p.id] = d; });
  return out;
}

const router = express.Router();

router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '64kb' }));

router.get('/status', (req, res) => {
  res.json({ ok: true, firebase: Boolean(admin.apps.length) });
});

let cache = null;
let cacheAt = 0;
const CACHE_MS = 60 * 1000;

router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    if (!req.query.fresh && cache && Date.now() - cacheAt < CACHE_MS) {
      return res.json({ ...cache, cached: true });
    }
    // ONE equality-ish filter, sorted in memory — no composite index (the
    // reference-shelf pattern). Template pages are few; the cap is a guard.
    const snap = await db().collection(PAGES).where('template', 'in', ['deck', 'grid']).get();
    const pages = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => ms(b.created) - ms(a.created))
      .slice(0, SCAN_PAGES);
    const live = pages.filter((p) => !p.superseded);
    const [items, reg, vsnaps] = await Promise.all([
      loadItems(live),
      chatfeed.registry(),
      live.length
        ? db().getAll(...live.map((p) => db().collection(VERDICTS).doc(`${p.chat}__page-${p.id}`)))
        : [],
    ]);
    const verdicts = {};
    vsnaps.forEach((d) => { if (d.exists) verdicts[d.id] = d.data(); });
    const body = buildQueue({ pages, items, verdicts, chats: reg.chats || {} });
    body.generatedAt = new Date().toISOString();
    cache = body;
    cacheAt = Date.now();
    res.json(body);
  } catch (err) { fail(res, err); }
});

// "Not a review" — her tap on a row's ✕. A stamp on the page doc, so it is
// shared state (not one phone's localStorage) and nothing is deleted; the
// hidden pile keeps the row and un-hiding is the same POST with hidden:false.
router.post('/hide', async (req, res) => {
  try {
    const id = clean(req.body && req.body.id, 60);
    if (!id) return res.status(400).json({ error: 'id required' });
    const ref = db().collection(PAGES).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'no such page' });
    const on = req.body && req.body.hidden === false ? false : true;
    await ref.set({ reviewHidden: on }, { merge: true });
    cache = null;   // the next read reflects the tap
    res.json({ ok: true, id, hidden: on });
  } catch (err) { fail(res, err); }
});

module.exports = { router, buildQueue, pageItems, pageProgress, pageSpreads, itemWords };
