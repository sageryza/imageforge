// deliverables.js — the running list of DELIVERABLES, one place, newest first.
//
// Sophie's ask (2026-08-27): "is there a running list of deliverables? … can
// you make one, and have the notification go off when a new deliverable is
// added to the list — even if I didn't set notifications true for the chat
// that made it — so I can watch them all in one place newest first."
//
// A deliverable is a thing a chat HANDED HER: a film, an episode, an audio
// cut, a page she uses — the same family as the pinned-link rule's case 2.
// Images are deliberately NOT auto-fed here — they already have one place
// (the gallery / Meta Assets) and 2,488 of them would bury the films.
//
// HOW ENTRIES ARRIVE, two doors:
//   • AUTOMATIC: chatfeed's POST /pin records every MEDIA pin (video/audio)
//     here — a pinned film IS a deliverable being handed over, so the list
//     needs nothing new from existing chats. Link pins are NOT auto-fed
//     (most are pages being worked on, not deliverables).
//   • EXPLICIT: POST /api/deliverables { chat, session?, url, title, kind? }
//     — for a deliverable that never gets pinned (a one-off render, a zip,
//     a page handed over). Chats should call this when delivering.
//
// THE PUSH BYPASSES THE BELL ON PURPOSE — that is the whole ask. The per-chat
// bell (`chatNotifies`) gates reply pushes; a NEW deliverable buzzes her
// whatever the bell says, via push.notifyChat with debounce:false and this
// module's own 60s collapse (a batch is one buzz — the list is the record,
// the push is its doorbell). Only a NEW url pushes; re-posting the same url
// (a re-render at the same address) updates the row silently.
//
// One doc per URL (id = sha1(url)) in `forge-deliverables` (deckfactory).
// A new VERSION of a film is normally a NEW url (film-v6.mp4) → a new row +
// a push, which is exactly "watch new versions arrive". Nothing is deleted;
// re-recording bumps `updatedAt`, and the list sorts on that, newest first.
//
// Routes (STUDIO_TOKEN gate, GET /status open):
//   GET  /api/deliverables/status      → { ok, firebase, push }
//   GET  /api/deliverables?limit=      → { items } newest first, chat names on
//   GET  /api/deliverables/feed?limit= → { items } films AND picture bursts,
//        newest first — what the Chats app's DELIVERED tab draws
//   POST /api/deliverables             → { chat, session?, url, title, kind? }
//   POST /api/deliverables/dismiss     → { url? | chat? } — her ✕ on a
//        Delivered row (a film row by url, a pictures row by chat). HERS —
//        a chat must never call it to tidy its own row away.
//   POST /api/deliverables/backfill    → { dry? } — sweep existing registry
//        media pins into the list (dry by default, never pushes)
//
// Page: /deliverables (serveGated, pill). Tests: node scripts/test-deliverables.js

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');

const { buildFeed } = require('./deliverables-feed');

const router = express.Router();
const COLL = 'forge-deliverables';

const db = () => admin.firestore();
const firebaseUp = () => admin.apps.length > 0;

router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '64kb' }));

// ---- pure helpers (exported for the test) ----------------------------------
// Mirrors chatfeed's pinKind (not exported there), plus 'image' for the rare
// explicitly-POSTed picture. An unknown kind falls back to what the url says.
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)(\?|#|$)/i;
const AUDIO_EXT = /\.(m4a|mp3|wav|aac|caf|aiff?)(\?|#|$)/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|heic)(\?|#|$)/i;
const KINDS = new Set(['video', 'audio', 'image', 'link']);
function kindOf(kind, url) {
  if (KINDS.has(kind)) return kind;
  if (VIDEO_EXT.test(url)) return 'video';
  if (AUDIO_EXT.test(url)) return 'audio';
  if (IMAGE_EXT.test(url)) return 'image';
  return 'link';
}

// A pin worth auto-recording is a MEDIA pin — a film or an audio cut being
// handed over. A link pin is usually a page being worked on, so it stays out
// unless a chat posts it deliberately.
function pinDeliverable(pinned) {
  return !!(pinned && pinned.url && (pinned.kind === 'video' || pinned.kind === 'audio'));
}

const idFor = (url) => crypto.createHash('sha1').update(String(url)).digest('hex').slice(0, 24);

// The one decision: what lands on the doc, and whether this is a NEW row
// (→ push) or an update of one already listed (→ silent). Pure so the test
// can drive it without Firestore.
function decideRecord(existing, input, nowIso) {
  const title = String(input.title || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  if (!existing) {
    return {
      isNew: true,
      doc: {
        url: input.url,
        title: title || input.url.split('/').pop().split('?')[0],
        chat: input.chat,
        kind: kindOf(input.kind, input.url),
        source: input.source || 'post',
        at: input.at || nowIso,
        updatedAt: input.at || nowIso,
        versions: 1,
      },
    };
  }
  const patch = { updatedAt: nowIso, versions: (existing.versions || 1) + 1 };
  if (title) patch.title = title;           // a re-post may correct the title
  return { isNew: false, doc: patch };
}

// Backfill planning (pure): every media pin, deduped by URL — two chats
// pinning the same file are ONE hand-over, and the row keeps the newest
// pin's chat and time. Recording each chat separately was the launch-day
// bug (found live 2026-08-27, Sophie: "the dates are wrong - evan says
// today"): the second record took the live update path and stamped
// updatedAt = now, so week-old films read as today's.
function backfillPlan(chats) {
  const byUrl = new Map();
  for (const [slug, d] of Object.entries(chats || {})) {
    if (!pinDeliverable(d.pinned)) continue;
    const e = { chat: slug, url: d.pinned.url, title: d.pinned.title || '',
      kind: d.pinned.kind, at: d.pinned.at || '' };
    const prev = byUrl.get(e.url);
    if (!prev || String(e.at) > String(prev.at)) byUrl.set(e.url, e);
  }
  return [...byUrl.values()];
}
// What a backfill write does to an existing doc (pure). A doc a LIVE door
// made (a pin, a POST) is left alone — live info is truer than a sweep. A
// doc the backfill itself made is REWRITTEN whole with the pin's own date,
// so re-running the backfill REPAIRS its records and never damages them.
function backfillDoc(existing, e, nowIso) {
  if (existing && existing.source !== 'pin-backfill') return null;
  const when = e.at || nowIso;
  return {
    url: e.url,
    title: e.title || e.url.split('/').pop().split('?')[0],
    chat: e.chat,
    kind: kindOf(e.kind, e.url),
    source: 'pin-backfill',
    at: when,
    updatedAt: when,
    versions: 1,
  };
}

// ONE ROW PER WORK, ITS LATEST VERSION (2026-08-27, Sophie: "only put the
// latest version"). A new cut is a new URL, so every version of one film had
// its own row: measured that day, the Water reel filled 7 of the 32, the PWC
// training film 3 and Evan 2 — the newest of each buried among its own older
// takes.
//
// The join is the TITLE STEM, which works because every title here follows the
// house shape `<name> v<N> — what changed (0:41)`: cut at the version marker
// and what is left is the work. It has to cross CHATS — the Water reel is cut
// in three of them and she wants one row — so grouping by chat cannot do it.
// A title with no version marker is its own whole stem, which is why PWC ep005
// and ep006 stay two rows: different episodes, not two takes of one.
const VER = /\b(?:v|version\s*)\d+/i;
function workKey(title) {
  const t = String(title || '').trim();
  const m = VER.exec(t);
  const stem = (m ? t.slice(0, m.index) : t)
    // the separator that introduced the version goes with it
    .replace(/[\s—–\-:,(\[]+$/, '')
    .trim().toLowerCase().replace(/\s+/g, ' ');
  return stem || t.toLowerCase();       // a title that IS a version keeps itself
}

// Rows for the page: newest first by updatedAt (a re-render surfaces), chat
// display names joined from the registry map (slug → doc), and each work
// collapsed to its newest version with the older ones riding along.
//
// NEWEST IS BY DATE, NEVER BY VERSION NUMBER: two chats cutting one reel both
// call theirs v14, so the number is per-chat naming and the date is the fact.
// And NOTHING IS DROPPED — the older takes ride on `older`, one tap down on
// the page, because a wrong merge must cost her a tap and never a deliverable.
function rowsOf(docs, chats) {
  const sorted = docs
    .slice()
    .sort((a, b) => String(b.updatedAt || b.at || '').localeCompare(String(a.updatedAt || a.at || '')))
    .map((d) => {
      const reg = (chats && chats[d.chat]) || {};
      return { ...d, chatName: reg.displayName || d.chat };
    });
  const byWork = new Map();
  for (const r of sorted) {
    const key = workKey(r.title);
    const head = byWork.get(key);
    if (!head) byWork.set(key, { ...r, older: [] });   // first seen = newest
    else head.older.push(r);
  }
  return [...byWork.values()];
}

// ---- the push (bypasses the bell BY DESIGN — see header) -------------------
// Own 60s collapse: several new deliverables inside a minute are one buzz.
// notifyChat's default debounce is skipped because its 10-minute per-chat
// window would swallow a second real deliverable; the 60s here is the only
// throttle a doorbell needs.
//
// QUEUED, NOT SENT (2026-08-28, Sophie: "I get notified on my phone a few
// seconds before chats actually finish their turn"). The checklist has a chat
// pin its film mid-turn, before its cards and its reply — measured against her
// real deliverables that day, the gap to the chat's finished reply ran 19s,
// 23s, 42s, 58s, 103s. push.queueChat holds it until the chat posts a finished
// reply (or a 15-minute fallback, for a chat that never posts one); the bell
// bypass is untouched, because no reply push fires on an unbelled chat to
// swallow it.
let lastPushAt = 0;
function pushNew(chat, chatName, title, kind) {
  try {
    const now = Date.now();
    if (now - lastPushAt < 60 * 1000) return false;
    lastPushAt = now;
    // The CHAT is the title on every door now (2026-08-28, Sophie: "and
    // notification more informative") — which chat it came from is the fact
    // she needs first, and the body says what kind of thing arrived.
    const a = require('./push-gate').pushAlert(kind || 'link', { chatName, title });
    require('./push').queueChat(chat, a.title, a.body, { debounce: false });
    return true;
  } catch (e) { console.warn('deliverables: push failed', e.message); return false; }
}

// ---- record (also called by chatfeed's pin route) --------------------------
// Fire-and-forget from the pin route: must never throw into a posting route.
async function record(input) {
  if (!firebaseUp()) return { ok: false, error: 'no firebase' };
  const url = String(input.url || '').trim();
  if (!/^https:\/\//.test(url)) return { ok: false, error: 'url must be https' };
  const chat = String(input.chat || '').slice(0, 60);
  if (!chat) return { ok: false, error: 'chat required' };
  const ref = db().collection(COLL).doc(idFor(url));
  const snap = await ref.get();
  const { isNew, doc } = decideRecord(snap.exists ? snap.data() : null,
    { ...input, url, chat }, new Date().toISOString());
  await ref.set(doc, { merge: true });
  let pushed = false;
  if (isNew && input.push !== false) {
    let chatName = chat;
    try {
      const reg = await require('./chatfeed').registry();
      chatName = ((reg.chats || {})[chat] || {}).displayName || chat;
    } catch (e) { /* registry down — push with the slug */ }
    pushed = pushNew(chat, chatName, doc.title, doc.kind);
  }
  return { ok: true, isNew, pushed, id: ref.id };
}

// ---- routes ----------------------------------------------------------------
router.get('/status', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  let pushConfigured = false;
  try { pushConfigured = !!require('./push')._internals.apnsKey(); } catch (e) { pushConfigured = false; }
  res.json({ ok: true, firebase: firebaseUp(), push: pushConfigured });
});

// ---- the DELIVERED tab's feed: films AND pictures, newest first ------------
// Sophie, 2026-08-28: "list of deliverables AS they're delivered ... just the
// link to a movie, previews of images and whatnot" / "just three images, like
// the update tab". The films are these docs; the pictures are DERIVED from the
// chats' own filed assets (there is no image door into this collection, and
// there must not be one — see deliverables-feed.js for why). One cached read
// of each, held 60s, no model call.
const FEED_ASSETS = 400;          // one small query; brief.js scans 300 for a strip
let feedCache = null, feedAt = 0;
const FEED_MS = 60 * 1000;

router.get('/feed', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    if (!firebaseUp()) return res.status(503).json({ error: 'no firebase' });
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 60));
    if (!req.query.fresh && feedCache && feedCache.limit === limit && Date.now() - feedAt < FEED_MS) {
      return res.json({ ...feedCache.body, cached: true });
    }
    const [dsnap, asnap, xsnap] = await Promise.all([
      db().collection(COLL).orderBy('updatedAt', 'desc').limit(200).get(),
      // Records written before `created` existed are simply absent from an
      // orderBy — fine for a newest-first feed, which is all this is.
      db().collection('forge-chat-assets').orderBy('created', 'desc').limit(FEED_ASSETS).get(),
      // Her ✕ stamps — one small map doc; see POST /dismiss.
      db().collection(COLL).doc(DISMISS_DOC).get(),
    ]);
    let chats = {};
    try { chats = (await require('./chatfeed').registry()).chats || {}; }
    catch (e) { /* names degrade to slugs */ }
    const body = { ok: true, ...buildFeed({
      deliverables: rowsOf(dsnap.docs.map((d) => d.data()), chats),
      assets: asnap.docs.map((d) => d.data()),
      chats,
      dismissed: (xsnap.exists && xsnap.get('dismissed')) || {},
      limit,
    }) };
    feedCache = { limit, body }; feedAt = Date.now();
    res.json(body);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- her ✕ on a Delivered row (2026-08-31, Sophie: "deliverables don't
// leave when i answer them and there's no way to swipe them away") -----------
// Answering is not the only way she deals with a delivery — a note on the
// paused film, a ♥, a decision made elsewhere — and none of those stamp
// `lastHerAt`. The ✕ is the deterministic way out, and it is HERS: no chat
// should call this to tidy its own row away.
//
// The stamps live in ONE map doc (`__dismissed`) in this collection, keyed by
// deliverables-feed's dismissKey — a film row by its url (hashed: a dotted
// field name written through set(merge) becomes a nested map), a pictures row
// by its chat. The doc carries NO `updatedAt` and NO `url` ON PURPOSE: both
// list queries orderBy('updatedAt'), and Firestore omits a doc missing the
// orderBy field — the trap that hid her notes once, working FOR us here, so
// the stamp doc can never surface as a row.
//
// The value is the moment of the tap, and the feed hides a row whose hand-over
// is not newer than it — so a NEW version (a new url, a newer burst) comes
// back by itself, exactly like the answered rule.
const DISMISS_DOC = '__dismissed';
const DISMISS_CAP = 600;          // newest stamps kept; older ones age out
router.post('/dismiss', async (req, res) => {
  try {
    if (!firebaseUp()) return res.status(503).json({ error: 'no firebase' });
    const { url, chat } = req.body || {};
    const key = require('./deliverables-feed').dismissKey(
      url ? { url: String(url) } : { kind: 'images', chat: String(chat || '') });
    if (!key || key === 'c_') return res.status(400).json({ error: 'url or chat required' });
    const ref = db().collection(COLL).doc(DISMISS_DOC);
    const now = new Date().toISOString();
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const map = (snap.exists && snap.get('dismissed')) || {};
      map[key] = now;
      const keys = Object.keys(map);
      if (keys.length > DISMISS_CAP) {
        keys.sort((a, b) => String(map[a]).localeCompare(String(map[b])));
        keys.slice(0, keys.length - DISMISS_CAP).forEach((k) => delete map[k]);
      }
      tx.set(ref, { dismissed: map });
    });
    feedCache = null;             // her next pull shows the row gone
    res.json({ ok: true, key, at: now });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    if (!firebaseUp()) return res.status(503).json({ error: 'no firebase' });
    const limit = Math.min(300, Math.max(1, parseInt(req.query.limit, 10) || 200));
    // ONE orderBy, everything else in memory — no composite index (house rule).
    const snap = await db().collection(COLL).orderBy('updatedAt', 'desc').limit(limit).get();
    let chats = {};
    try { chats = (await require('./chatfeed').registry()).chats || {}; }
    catch (e) { /* names degrade to slugs */ }
    res.json({ ok: true, items: rowsOf(snap.docs.map((d) => d.data()), chats) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { chat, session, url, title, kind } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    // Session-first resolution, same contract as every other chat-keyed post.
    let slug = chat;
    try { slug = await require('./chatfeed').resolveChat(chat, session); }
    catch (e) { /* resolution down — file under the given slug */ }
    const out = await record({ chat: slug, url, title, kind, source: 'post' });
    if (!out.ok) return res.status(400).json(out);
    res.json(out);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sweep the registry's existing MEDIA pins into the list, so it starts full
// rather than empty. Dry by default (the /wrapup/trim pattern); never pushes.
// It writes DIRECTLY, never through record(): backfill dates are the pins'
// own, and record()'s update path stamps now — which is exactly how launch
// day put today's date on week-old films. Re-runnable: it repairs its own
// records (source pin-backfill) and never touches a live door's.
router.post('/backfill', async (req, res) => {
  try {
    if (!firebaseUp()) return res.status(503).json({ error: 'no firebase' });
    const dry = (req.body || {}).dry !== false;
    const reg = await require('./chatfeed').registry();
    const plan = backfillPlan(reg.chats || {});
    let wrote = 0, kept = 0;
    if (!dry) {
      for (const e of plan) {
        const ref = db().collection(COLL).doc(idFor(e.url));
        const snap = await ref.get();
        const doc = backfillDoc(snap.exists ? snap.data() : null, e, new Date().toISOString());
        if (doc) { await ref.set(doc); wrote++; } else kept++;
      }
    }
    res.json({ ok: true, dry, count: plan.length, wrote, kept,
      items: plan.map((e) => ({ chat: e.chat, title: e.title, kind: e.kind, at: e.at })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = { router, record, pinDeliverable,
  _internals: { kindOf, decideRecord, rowsOf, idFor, backfillPlan, backfillDoc, workKey } };
