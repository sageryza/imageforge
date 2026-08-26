// storylink.js — THE STORY LINK: one story, three rooms.
//
// WHY IT EXISTS. Sophie works a story in Story Timeline (the order), the Story
// Room (the pictures) and Cutting Blocks (the recording), and until now
// NOTHING connected the three — measured 2026-08-26, before this shipped:
// all six of her timeline stories already existed as a Story Room pad under
// the identical title, and two of them also as a Cutting Blocks project, kept
// in step entirely by her naming them the same thing by hand. The counts had
// drifted where the hand-keeping slipped ("The house": 30 moments, 11 beats).
// So the tool is not inventing a workflow — it is writing down one she is
// already doing, and doing it in her own light shape.
//
// THE SHAPE IS AUDIOPROJECT'S, DELIBERATELY. She has already picked, once,
// how a piece of work should span rooms (audioproject.js, 2026-08-19): a small
// id carrying only what should be decided ONCE, with the GEOMETRY staying
// room-local because every room re-derives it anyway and translating between
// coordinate systems is where the bugs would live. That judgement holds here
// exactly: a timeline moment, a pad beat and a blocks line are three different
// atoms, and a live two-way sync between them would mean re-ordering the
// timeline silently rearranges her pictures. So a link stores identity, and
// the one operation that crosses rooms is something SHE TAPS.
//
// WHAT A LINK IS (`forge-story-links`, one doc per STORY, not per room):
//   { id, title, members:[{room:'timeline'|'pad'|'blocks', doc, title, at}],
//     createdAt, updatedAt }
// Membership is append-only and deduped by room+doc. A doc belongs to at most
// ONE link — linking a doc that is already in another is REFUSED and names the
// other link rather than silently stealing it, because a wrong merge of two of
// her stories is expensive and an unlink is one tap.
//
// A ROOM MAY APPEAR TWICE and that is not a bug: "Charlie — as it is now" and
// "Charlie — as it used to be" are two pads of one story. Every operation that
// writes therefore takes an EXPLICIT target doc; nothing here ever guesses
// which pad it meant.
//
// THE ONLY THING THAT CROSSES IS THE PULL, AND IT NEVER DELETES.
//   POST /:id/pull   — additive: a moment with no beat becomes an EMPTY beat
//                      at the end carrying its words. A moment that already
//                      has one is left completely alone (her caption may have
//                      moved on, and the timeline is not the authority on what
//                      a picture is captioned). A beat matching nothing stays
//                      exactly where it is.
//   POST /:id/order  — separately, and only when she asks: the timeline's
//                      order applied to the beats that came from it. PERMUTES
//                      ONLY — every beat in, every beat out. A beat she added
//                      by hand rides with the linked beat above it.
// Both are dry-runnable through GET /:id/plan, and the DRY RUN AND THE WRITE
// CALL THE SAME PLANNER (storylink-plan.js), so they cannot disagree about
// what is about to happen.
//
// CUTTING BLOCKS IS MEMBERSHIP ONLY, on purpose (Sophie confirmed the room,
// 2026-08-26). Its lines are the recording's own words with real timings, and
// a split or a meld changes them — so its order cannot follow the timeline's
// and nothing here tries. What the link buys there is the name decided once
// and a jump between the rooms.
//
// MONEY: nothing here spends. No model call anywhere; a handful of small
// Firestore reads behind a short cache, so opening a page stays free.
//
// Routes (mounted at /api/storylink, STUDIO_TOKEN gate, only /status open):
//   GET  /status              → { ok, firebase, links }
//   GET  /                    → { links } — newest touched first
//   GET  /rooms               → { timeline, pad, blocks } — what is out there
//   GET  /candidates          → title matches spanning >1 room, unlinked only
//   POST /adopt               → { dry?:true } — mint links for the candidates
//   GET  /for?room=&doc=      → the link a room's doc belongs to (+ siblings)
//   POST /link                → { title?, members:[{room,doc}] } → mint/extend
//   GET  /:id                 → the link, members resolved to live titles
//   POST /:id/title           → { title }
//   POST /:id/unlink          → { room, doc }
//   GET  /:id/plan?to=<pad>   → what a pull and an order would each do
//   POST /:id/pull            → { to } — additive, never deletes
//   POST /:id/order           → { to } — permutes, never adds or drops
//   DELETE /:id               → hides the link (nothing is destroyed)

const express = require('express');
const crypto = require('crypto');
const admin = require('firebase-admin');

const plan = require('./storylink-plan');
const { unpackUnits } = require('./timeline-parse');

const COL = process.env.STORYLINK_COLLECTION || 'forge-story-links';
// The rooms' own collections, read directly. Reading a sibling's collection
// rather than calling its HTTP route keeps this free of a self-request (and of
// the token gate) — the collection names are the contract, so they are named
// here once and nowhere else.
const TIMELINES = 'forge-timelines';
const PADS = 'forge-scratchpad';
const BLOCKS = process.env.BLOCKS_COLLECTION || 'forge-blocks';

const ROOMS = ['timeline', 'pad', 'blocks'];
const MAX_MEMBERS = 12;
const ROOMS_TTL = 30 * 1000;
const SCAN_CAP = 500;

const router = express.Router();

function db() { return admin.apps.length ? admin.firestore() : null; }
function hasFirebase() { try { return !!db(); } catch (_) { return false; } }
const nowIso = () => new Date().toISOString();

function fail(res, err) {
  console.warn('storylink:', err.message);
  res.status(500).json({ error: err.message });
}

/* ---- the gate: open when STUDIO_TOKEN is unset, otherwise every route but
   /status needs the header or ?token= (audio.js's, verbatim in spirit) ---- */
router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN;
  if (!token) return next();
  if (req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

/* ------------------------------------------------------------- the rooms */

// One read of each room, cached briefly: /candidates, /adopt and every /:id
// view want the same three lists, and the pages behind them poll.
let roomsCache = { at: 0, rooms: null };

async function readRooms(force) {
  if (!force && roomsCache.rooms && Date.now() - roomsCache.at < ROOMS_TTL) return roomsCache.rooms;
  const d = db();
  if (!d) throw new Error('Firestore unavailable');

  const [tl, pads, blk] = await Promise.all([
    d.collection(TIMELINES).limit(SCAN_CAP).get(),
    d.collection(PADS).limit(SCAN_CAP).get(),
    d.collection(BLOCKS).limit(SCAN_CAP).get(),
  ]);

  const rooms = {
    timeline: tl.docs
      .filter((x) => !(x.data() || {}).hidden)
      .map((x) => {
        const v = x.data() || {};
        return {
          id: x.id,
          title: v.title || 'Untitled',
          moments: Object.keys(v.moments || {}).length,
          updatedAt: v.updatedAt || null,
        };
      }),
    pad: pads.docs
      // The pad collection holds a `pad` singleton and the counter/settings
      // docs alongside the real stories; a story is a doc with a beats array.
      .filter((x) => Array.isArray((x.data() || {}).beats))
      .map((x) => {
        const v = x.data() || {};
        return {
          id: x.id,
          title: v.title || '',
          beats: (v.beats || []).length,
          folder: v.folder || null,
          updatedAt: v.updatedAt || null,
        };
      }),
    blocks: blk.docs.map((x) => {
      const v = x.data() || {};
      return {
        id: x.id,
        title: v.title || 'untitled',
        blockCount: v.blockCount || 0,
        seconds: v.seconds || null,
        updatedAt: v.updatedAt || v.createdAt || null,
      };
    }),
  };
  roomsCache = { at: Date.now(), rooms };
  return rooms;
}

function roomIndex(rooms) {
  const idx = {};
  for (const r of ROOMS) {
    idx[r] = new Map();
    for (const it of (rooms[r] || [])) idx[r].set(it.id, it);
  }
  return idx;
}

/* -------------------------------------------------------------- the doc */

function mintId() { return `sl${crypto.randomBytes(6).toString('hex')}`; }
const isLinkId = (s) => /^sl[a-f0-9]{8,24}$/.test(String(s || ''));

function cleanMembers(v) {
  const out = [];
  const seen = new Set();
  for (const m of (Array.isArray(v) ? v : [])) {
    if (!m || !ROOMS.includes(m.room)) continue;
    const doc = String(m.doc || '').slice(0, 200).trim();
    if (!doc) continue;
    const key = `${m.room}:${doc}`;
    if (seen.has(key)) continue;                        // deduped by room+doc
    seen.add(key);
    out.push({
      room: m.room,
      doc,
      title: String(m.title || '').slice(0, 200),
      at: m.at || nowIso(),
    });
    if (out.length >= MAX_MEMBERS) break;
  }
  return out;
}

// The live title always wins over the one frozen at link time: she renames a
// story in its own room and the link must not go on showing the old name.
function view(doc, idx) {
  const v = doc.data() || {};
  const members = (v.members || []).map((m) => {
    const live = idx && idx[m.room] ? idx[m.room].get(m.doc) : null;
    return {
      ...m,
      title: live ? (live.title || m.title || '') : (m.title || ''),
      missing: idx ? !live : undefined,
      count: live ? (live.moments ?? live.beats ?? live.blockCount ?? null) : null,
    };
  });
  return {
    id: doc.id,
    title: v.title || (members[0] && members[0].title) || 'Untitled',
    members,
    hidden: v.hidden === true,
    createdAt: v.createdAt || null,
    updatedAt: v.updatedAt || null,
  };
}

async function allLinks(includeHidden) {
  const d = db();
  const snap = await d.collection(COL).limit(SCAN_CAP).get();
  return snap.docs.filter((x) => includeHidden || !(x.data() || {}).hidden);
}

// Which link, if any, already owns this room+doc. This is what makes a doc
// belong to at most one story — checked before every mint and every extend.
function ownerOf(docs, room, doc) {
  for (const x of docs) {
    const v = x.data() || {};
    for (const m of (v.members || [])) {
      if (m.room === room && String(m.doc) === String(doc)) return x.id;
    }
  }
  return null;
}

/* ------------------------------------------------------------ the rooms'
   readers: the two docs a pull actually touches. Everything else about the
   rooms stays in the rooms. */

async function readStory(id) {
  const snap = await db().collection(TIMELINES).doc(String(id)).get();
  if (!snap.exists) throw new Error('no such timeline story');
  const v = snap.data() || {};
  return { id: snap.id, title: v.title || '', moments: v.moments || {}, units: unpackUnits(v.units) };
}

const padRef = (id) => db().collection(PADS).doc(String(id));

async function readPad(id) {
  const snap = await padRef(id).get();
  if (!snap.exists) throw new Error('no such story pad');
  const v = snap.data() || {};
  return { id: snap.id, title: v.title || '', beats: Array.isArray(v.beats) ? v.beats : [] };
}

// A link's target in one room. `to` is required whenever the link has more
// than one member in that room — nothing here guesses which pad she meant.
function memberFor(link, room, to) {
  const mine = (link.members || []).filter((m) => m.room === room);
  if (!mine.length) throw new Error(`this link has no ${room}`);
  if (to) {
    const hit = mine.find((m) => String(m.doc) === String(to));
    if (!hit) throw new Error(`${to} is not a ${room} in this link`);
    return hit;
  }
  if (mine.length > 1) throw new Error(`this link has ${mine.length} ${room}s — pass "to"`);
  return mine[0];
}

/* ----------------------------------------------------------------- routes */

router.get('/status', async (req, res) => {
  if (!hasFirebase()) return res.json({ ok: false, firebase: false, links: null });
  try {
    const docs = await allLinks(false);
    res.json({ ok: true, firebase: true, links: docs.length });
  } catch (_) { res.json({ ok: false, firebase: true, links: null }); }
});

router.get('/', async (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  try {
    const [docs, rooms] = await Promise.all([allLinks(false), readRooms()]);
    const idx = roomIndex(rooms);
    const links = docs.map((x) => view(x, idx))
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    res.json({ count: links.length, links });
  } catch (e) { fail(res, e); }
});

router.get('/rooms', async (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  try { res.json(await readRooms(req.query.fresh === '1')); } catch (e) { fail(res, e); }
});

// Title matches spanning more than one room, with anything already linked
// taken out. Read-only and free — this is the proposal, /adopt is the write.
router.get('/candidates', async (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  try {
    const [rooms, docs] = await Promise.all([readRooms(req.query.fresh === '1'), allLinks(true)]);
    const free = {};
    for (const r of ROOMS) free[r] = (rooms[r] || []).filter((it) => !ownerOf(docs, r, it.id));
    const groups = plan.matchRooms(free, {
      threshold: req.query.threshold ? Number(req.query.threshold) : undefined,
    });
    res.json({ count: groups.length, candidates: groups });
  } catch (e) { fail(res, e); }
});

// Mint a link per candidate. DRY BY DEFAULT — the /wrapup/trim and
// asset-cleanup pattern: a matcher proposing a merge of two of her stories is
// exactly the write you want to read before it runs.
router.post('/adopt', async (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  try {
    const dry = req.body.dry !== false;
    const [rooms, docs] = await Promise.all([readRooms(true), allLinks(true)]);
    const free = {};
    for (const r of ROOMS) free[r] = (rooms[r] || []).filter((it) => !ownerOf(docs, r, it.id));
    const groups = plan.matchRooms(free, {
      threshold: typeof req.body.threshold === 'number' ? req.body.threshold : undefined,
    });

    if (dry) return res.json({ dry: true, would: groups.length, candidates: groups });

    const made = [];
    for (const g of groups) {
      const id = mintId();
      const members = cleanMembers(g.members);
      if (members.length < 2) continue;
      await db().collection(COL).doc(id).set({
        id, title: g.title || '', members, createdAt: nowIso(), updatedAt: nowIso(),
      });
      made.push({ id, title: g.title, members: members.map((m) => `${m.room}:${m.doc}`) });
    }
    res.json({ ok: true, made: made.length, links: made });
  } catch (e) { fail(res, e); }
});

// What a room asks on open: "am I part of a story, and what else is in it?"
router.get('/for', async (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  try {
    const room = String(req.query.room || '');
    const doc = String(req.query.doc || '');
    if (!ROOMS.includes(room) || !doc) return res.status(400).json({ error: 'room and doc required' });
    const docs = await allLinks(false);
    const owner = ownerOf(docs, room, doc);
    if (!owner) return res.json({ linked: false, link: null });
    const rooms = await readRooms();
    const hit = docs.find((x) => x.id === owner);
    res.json({ linked: true, link: view(hit, roomIndex(rooms)) });
  } catch (e) { fail(res, e); }
});

// Mint a link, or add members to one (`id`). A member already owned by
// ANOTHER link is refused, and the answer names the link that has it.
router.post('/link', async (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  try {
    const want = cleanMembers(req.body.members);
    if (!want.length) return res.status(400).json({ error: 'members required' });

    const docs = await allLinks(true);
    const id = isLinkId(req.body.id) ? String(req.body.id) : null;
    const clashes = want
      .map((m) => ({ m, owner: ownerOf(docs, m.room, m.doc) }))
      .filter((x) => x.owner && x.owner !== id);
    if (clashes.length) {
      return res.status(409).json({
        error: 'already linked',
        clashes: clashes.map((x) => ({ room: x.m.room, doc: x.m.doc, link: x.owner })),
      });
    }

    const rooms = await readRooms(true);
    const idx = roomIndex(rooms);
    const missing = want.filter((m) => !idx[m.room].get(m.doc));
    if (missing.length) {
      return res.status(400).json({
        error: 'no such doc', missing: missing.map((m) => `${m.room}:${m.doc}`),
      });
    }
    // Carry the live title onto each member as it joins.
    for (const m of want) m.title = idx[m.room].get(m.doc).title || '';

    const ref = db().collection(COL).doc(id || mintId());
    const snap = await ref.get();
    const cur = snap.exists ? (snap.data() || {}) : null;
    if (id && !snap.exists) return res.status(404).json({ error: 'no such link' });

    const members = cleanMembers([...(cur ? cur.members || [] : []), ...want]);
    const title = String(req.body.title || (cur && cur.title) || want[0].title || '').slice(0, 200);
    await ref.set({
      id: ref.id, title, members,
      createdAt: (cur && cur.createdAt) || nowIso(), updatedAt: nowIso(),
      ...(cur && cur.hidden ? { hidden: false } : {}),
    }, { merge: true });

    const fresh = await ref.get();
    res.json({ ok: true, link: view(fresh, idx) });
  } catch (e) { fail(res, e); }
});

router.get('/:id', async (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  try {
    const snap = await db().collection(COL).doc(String(req.params.id)).get();
    if (!snap.exists) return res.status(404).json({ error: 'no such link' });
    res.json({ link: view(snap, roomIndex(await readRooms())) });
  } catch (e) { fail(res, e); }
});

router.post('/:id/title', async (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  try {
    const ref = db().collection(COL).doc(String(req.params.id));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'no such link' });
    const title = String(req.body.title || '').slice(0, 200);
    await ref.set({ title, updatedAt: nowIso() }, { merge: true });
    res.json({ ok: true, title });
  } catch (e) { fail(res, e); }
});

// Take one room's doc back out. Nothing in the room changes — an unlink is
// about the LINK, never about her work.
router.post('/:id/unlink', async (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  try {
    const ref = db().collection(COL).doc(String(req.params.id));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'no such link' });
    const room = String(req.body.room || '');
    const doc = String(req.body.doc || '');
    if (!ROOMS.includes(room) || !doc) return res.status(400).json({ error: 'room and doc required' });
    const members = ((snap.data() || {}).members || [])
      .filter((m) => !(m.room === room && String(m.doc) === doc));
    await ref.set({ members, updatedAt: nowIso() }, { merge: true });
    res.json({ ok: true, members: members.length });
  } catch (e) { fail(res, e); }
});

/* ------------------------------------------------------- pull and re-order */

// Both writes and the dry run come through here, so the plan she reads is
// computed by the same code that applies it.
async function planFor(link, to) {
  const story = await readStory(memberFor(link, 'timeline').doc);
  const pad = await readPad(memberFor(link, 'pad', to).doc);
  const pull = plan.planPull(story, pad.beats);
  const ordered = plan.planOrder(story, pad.beats);
  const beatText = (id) => {
    const b = pad.beats.find((x) => x && x.id === id);
    return b ? String(b.text || '').slice(0, 80) : null;
  };
  return {
    story: {
      id: story.id, title: story.title,
      moments: plan.momentOrder(story.units, story.moments).length,
    },
    pad: { id: pad.id, title: pad.title, beats: pad.beats.length },
    pull: {
      seed: pull.seed.length, add: pull.add.length,
      matched: pull.matched.length, extra: pull.extra.length,
      // The beats she has split in the timeline since — the reason to pull.
      split: pull.keep.map((k) => ({ beat: k.beat, frees: k.frees.length, text: beatText(k.beat) })),
      // Captions that stop repeating what has become its own beat.
      retext: pull.retext.map((r) => ({ beat: r.beat, from: r.from.slice(0, 120), to: r.to.slice(0, 120) })),
      // …and the ones left alone because she has reworded them herself.
      heldBack: pull.heldBack.map((h) => ({ beat: h.beat, text: h.text.slice(0, 120), would: h.to.slice(0, 120) })),
      adding: pull.add.map((a) => ({ text: a.text.slice(0, 120), after: beatText(a.after) })),
    },
    order: { changes: !plan.sameOrder(pad.beats, ordered) },
    _story: story, _pad: pad, _pull: pull, _ordered: ordered,
  };
}

function publicPlan(p) {
  const { _story, _pad, _pull, _ordered, ...rest } = p;
  return rest;
}

router.get('/:id/plan', async (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  try {
    const snap = await db().collection(COL).doc(String(req.params.id)).get();
    if (!snap.exists) return res.status(404).json({ error: 'no such link' });
    const p = await planFor(view(snap), req.query.to);
    res.json(publicPlan(p));
  } catch (e) { fail(res, e); }
});

// ADDITIVE ONLY. A moment with no beat becomes an empty beat at the end
// carrying its words; everything already there is untouched.
router.post('/:id/pull', async (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  try {
    const snap = await db().collection(COL).doc(String(req.params.id)).get();
    if (!snap.exists) return res.status(404).json({ error: 'no such link' });
    const link = view(snap);
    const p = await planFor(link, req.body.to);
    if (req.body.dry) return res.json({ dry: true, ...publicPlan(p) });
    if (!p._pull.add.length && !p._pull.seed.length && !p._pull.retext.length) {
      return res.json({ ok: true, added: 0, seeded: 0, retexted: 0, ...publicPlan(p) });
    }

    const padId = p._pad.id;
    // Read-modify-write through a transaction, like the pad's own /add: she
    // may be placing a picture in the Story Room while this runs.
    const done = await db().runTransaction(async (tx) => {
      const cur = await tx.get(padRef(padId));
      const list = (cur.exists && Array.isArray(cur.data().beats)) ? cur.data().beats : [];
      // Re-plan against what the pad holds RIGHT NOW, never against the copy
      // read a moment ago — otherwise a beat added in between is duplicated.
      const fresh = plan.planPull(p._story, list);

      // SEED FIRST: stamp each beat with the moments it covers. On the
      // objects already in the array — no art, colour or position is touched.
      for (const sd of fresh.seed) {
        const b = list.find((x) => x && x.id === sd.beat);
        if (!b) continue;
        b.fromMoments = sd.moments;
        b.fromStory = p._story.id;
        delete b.fromMoment;                           // the legacy singular
      }

      // RE-DERIVE the captions of beats that have been split in the timeline,
      // so a beat stops saying the words that have become their own beats —
      // ttsFor speaks beat.text, so a repeat is a repeated line in the film.
      // Only ever a caption that is still exactly its own moments' text; one
      // she has reworded is hers and is reported instead.
      for (const rt of fresh.retext) {
        const b = list.find((x) => x && x.id === rt.beat);
        if (b) b.text = String(rt.to || '').slice(0, 5000);
      }

      const next = plan.applyAdds(list, fresh.add, (a) => ({
        id: db().collection(PADS).doc().id,
        url: null, color: null, src: null,
        addedAt: Date.now(),
        text: String(a.text || '').slice(0, 5000),
        fromMoments: [a.moment],
        fromStory: p._story.id,
      }));
      if (next.length !== list.length + fresh.add.length) {
        throw new Error('pull would not be additive — refused');
      }
      tx.set(padRef(padId), { beats: next, updatedAt: Date.now() }, { merge: true });
      return {
        added: fresh.add.length, seeded: fresh.seed.length,
        retexted: fresh.retext.length, heldBack: fresh.heldBack.length,
        beats: next.length,
      };
    });
    roomsCache = { at: 0, rooms: null };
    res.json({ ok: true, pad: padId, ...done });
  } catch (e) { fail(res, e); }
});

// PERMUTES ONLY — every beat in, every beat out. A beat she added by hand
// rides with the linked beat above it (storylink-plan.js's rule).
router.post('/:id/order', async (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  try {
    const snap = await db().collection(COL).doc(String(req.params.id)).get();
    if (!snap.exists) return res.status(404).json({ error: 'no such link' });
    const link = view(snap);
    const p = await planFor(link, req.body.to);
    if (req.body.dry) return res.json({ dry: true, ...publicPlan(p) });
    if (!p.order.changes) return res.json({ ok: true, moved: false, ...publicPlan(p) });

    const padId = p._pad.id;
    const moved = await db().runTransaction(async (tx) => {
      const cur = await tx.get(padRef(padId));
      const list = (cur.exists && Array.isArray(cur.data().beats)) ? cur.data().beats : [];
      const next = plan.planOrder(p._story, list);
      // A permutation can never change the count; refuse rather than write if
      // it somehow has, because this route's whole promise is that it doesn't.
      if (next.length !== list.length) throw new Error('re-order would change the beat count — refused');
      if (plan.sameOrder(list, next)) return false;
      tx.set(padRef(padId), { beats: next, updatedAt: Date.now() }, { merge: true });
      return true;
    });
    roomsCache = { at: 0, rooms: null };
    res.json({ ok: true, moved, pad: padId, beats: p._pad.beats });
  } catch (e) { fail(res, e); }
});

// Nothing is destroyed — a hidden link keeps its members and can come back.
router.delete('/:id', async (req, res) => {
  if (!hasFirebase()) return res.status(503).json({ error: 'no firebase' });
  try {
    const ref = db().collection(COL).doc(String(req.params.id));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'no such link' });
    await ref.set({ hidden: true, updatedAt: nowIso() }, { merge: true });
    res.json({ ok: true, hidden: true });
  } catch (e) { fail(res, e); }
});

module.exports = { router, ...plan, readRooms, cleanMembers, ownerOf, memberFor };
