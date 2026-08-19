// review.js — THE REVIEW QUEUE (Aug 2026, Sophie: "we're working on templates
// for reviewing things Tinder style but right now I have a pile of things that
// need to be reviewed and I'd like one screen that shows all the things
// waiting to be reviewed").
//
// One screen, every deck and grid template page across every chat, each with
// how far through it she is. Measured the day it was built (2026-08-18): 9
// template pages holding 285 items, 9 of them decided — the pile was real.
//
// ---- AND THE CHATS SHE MARKED (Aug 2026, Sophie, the day after: "`to be
// reviewed` should send it to the review pile … another chat just built a
// review interface where everything I need to review gets piled up and I can
// review them all at once").
// A chat carrying the label `to be reviewed` (chatfeed.js's REVIEW_LABEL) is a
// row here too. THE LABEL IS THE WHOLE MECHANISM — nothing is filed, nothing
// is stamped, and there is no second list to fall out of step with the chips
// in the Chats app: she puts the word on and the row appears, she takes it off
// (or taps ✕ here, which is the same write) and it goes. A chat row is never
// DONE — there is nothing to count through — and archived, deleted and
// tombstoned chats are skipped because she has finished with those already.
// It costs nothing extra: the registry read was already here for chat names.
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
//   • NOT EVERY DECK IS A REVIEW (the template demos, a browse-only card
//     deck), so a row has a small ✕ — "not a review" — that stamps
//     `reviewHidden` on the page doc. Hidden is the verb, nothing is deleted:
//     hidden rows keep a pile of their own behind the DONE tab and un-hide
//     with one tap.
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
//   GET  /?fresh=1        → { waiting:[row], done:[row], hidden:[row], counts }
//   POST /hide { id, hidden } → stamps reviewHidden on the page doc
//   POST /reviewed { chat }   → takes `to be reviewed` off a chat
//
// Tests: node scripts/test-review.js (the whole decision table, pure fixtures;
// plus the real page headless when playwright is around).

const express = require('express');
const admin = require('firebase-admin');
const chatfeed = require('./chatfeed');

const PAGES = 'forge-chat-pages';
const VERDICTS = 'forge-chat-verdicts';
const SCAN_PAGES = 200;   // newest template pages considered; far above today's 9

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

/** A registry doc's labels, old shape or new — the same union `chatfeed.js`
 *  reads, inlined here so the pure half stays driveable with fixtures. */
function chatLabels(reg) {
  const r = reg || {};
  const raw = Array.isArray(r.labels) ? r.labels
    : [].concat(r.category || [], Array.isArray(r.tags) ? r.tags : []);
  const out = [];
  raw.forEach((c) => {
    const v = String(c || '').trim().toLowerCase();
    if (v && out.indexOf(v) < 0) out.push(v);
  });
  return out;
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

/** The item ids, custom-states flag, thumbnail and text peek out of one page's
 *  frozen data JSON (the shape validateTemplate stored). */
function pageItems(data) {
  const items = data && data.items
    ? data.items
    : (data && data.groups ? data.groups.flatMap((g) => g.items || []) : []);
  return {
    ids: items.map((it) => String(it && it.id || '')).filter(Boolean),
    custom: Boolean(data && data.states && data.states.length),
    thumb: (items.find((it) => it && it.img) || {}).img || '',
    // the first card's words — what a TEXT deck's tile shows in the picture's
    // place (measured 2026-08-19: 12 of the 15 queued pages had no picture at
    // all — video ideas, date moments, card titles — so this is the common face)
    peek: String(items.map(itemWords).find(Boolean) || ''),
  };
}

/** Decided / later counts for one page's items against its verdict map. */
function pageProgress(ids, custom, verdictItems) {
  const v = verdictItems || {};
  let decided = 0; let later = 0;
  ids.forEach((id) => {
    const val = v[id];
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
function buildQueue({ pages, items, verdicts, chats, reviewLabel }) {
  const waiting = []; const done = []; const hidden = [];
  (pages || []).forEach((p) => {
    if (!p || !p.id || !p.chat || p.superseded) return;
    const data = (items || {})[p.id];
    if (!data) return;                       // unreadable data: no wrong numbers
    const { ids, custom, thumb, peek } = pageItems(data);
    if (!ids.length) return;
    const vdoc = (verdicts || {})[`${p.chat}__page-${p.id}`] || {};
    const { decided, later } = pageProgress(ids, custom, vdoc.items);
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
    if (p.reviewHidden) { hidden.push(row); return; }
    (decided >= ids.length ? done : waiting).push(row);
  });
  // ---- CHATS SHE HAS MARKED FOR REVIEW (Aug 2026, Sophie: "`to be reviewed`
  // should send it to the review pile … another chat just built a review
  // interface where everything I need to review gets piled up") -------------
  // The label is the whole mechanism — she puts `to be reviewed` on a chat in
  // the Chats app and it turns up here, she takes it off (or taps ✕ here,
  // which is the same write) and it goes. Nothing is filed, nothing is
  // stamped, and there is no second list to fall out of step with the chips.
  //
  // A chat row is NEVER 'done': there is nothing to count through, so the only
  // way out is the label coming off. Archived and deleted chats are skipped —
  // she has already finished with those.
  const label = String(reviewLabel || '').trim().toLowerCase();
  if (label) {
    Object.keys(chats || {}).forEach((slug) => {
      const reg = chats[slug] || {};
      if (reg.archived || reg.deletedAt || reg.movedTo) return;
      if (chatLabels(reg).indexOf(label) < 0) return;
      const at = [reg.updAt, reg.statusAt, reg.lastHerAt, reg.filedAt]
        .map((v) => clean(v, 40)).filter(Boolean).sort().pop() || '';
      waiting.push({
        kind: 'chat',
        id: 'chat-' + slug,
        chat: slug,
        name: clean(reg.displayName, 80) || slug,
        // What it is waiting on her FOR, in the words the chat already wrote —
        // its status card's ask first, then her own note, then what it last
        // said it did. Nothing new to post, and no model call.
        title: clean(reg.statusNeed, 140) || clean(reg.sophieNote, 140)
          || clean(reg.statusDoing, 140) || 'Waiting on you',
        template: 'chat',
        created: at,
        at,
        url: '/chats?chat=' + encodeURIComponent(slug),
        total: 0,
        decided: 0,
        later: 0,
        thumb: '',
      });
    });
  }
  // Waiting: newest post first — the feed's own order, so the pile reads the
  // way everything else does. Done and hidden: most recently touched first.
  waiting.sort((a, b) => ms(b.created) - ms(a.created));
  done.sort((a, b) => ms(b.at) - ms(a.at));
  hidden.sort((a, b) => ms(b.at) - ms(a.at));
  return {
    waiting,
    done,
    hidden,
    counts: {
      pages: waiting.length,
      items: waiting.reduce((n, r) => n + (r.total - r.decided), 0),
      chats: waiting.filter((r) => r.kind === 'chat').length,
      done: done.length,
    },
  };
}

// ---------------------------------------------------------------------------
// The router
// ---------------------------------------------------------------------------

// A template page's data is FROZEN by design (a new version is a new page), so
// one download per page id per process is the whole Storage cost.
const itemCache = new Map();   // page id → parsed data JSON (or null on error)

async function loadItems(pages) {
  const bucket = admin.storage().bucket();
  const missing = pages.filter((p) => !itemCache.has(p.id));
  // a handful at a time — today's queue is nine pages, but be polite anyway
  for (let i = 0; i < missing.length; i += 6) {
    await Promise.all(missing.slice(i, i + 6).map(async (p) => {
      try {
        const [buf] = await bucket.file(p.path || `chat-pages/${p.id}.json`).download();
        itemCache.set(p.id, JSON.parse(buf.toString('utf8')));
      } catch (e) {
        console.error('[review] page data unreadable', p.id, e.message);
        itemCache.set(p.id, null);
      }
    }));
  }
  const out = {};
  pages.forEach((p) => { const d = itemCache.get(p.id); if (d) out[p.id] = d; });
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
    const body = buildQueue({
      pages, items, verdicts, chats: reg.chats || {}, reviewLabel: chatfeed.REVIEW_LABEL,
    });
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

// "I'm done with this one" on a CHAT row — the ✕ takes the label off, which is
// the same write her chips make in the Chats app. Deliberately not a stamp of
// its own: two ways to say the same thing is how a row comes back tomorrow
// wearing a label that says it is still waiting.
router.post('/reviewed', async (req, res) => {
  try {
    const chat = clean(req.body && req.body.chat, 60);
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const out = await chatfeed.applyLabels([chat], { remove: [chatfeed.REVIEW_LABEL] });
    if (!out.chats.length) return res.status(404).json({ error: 'no such chat' });
    cache = null;
    res.json({ ok: true, chat, labels: out.labels[out.chats[0]] });
  } catch (err) { fail(res, err); }
});

module.exports = { router, buildQueue, pageItems, pageProgress, chatLabels };
