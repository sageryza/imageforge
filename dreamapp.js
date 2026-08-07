// ─── Dream app (/api/dreamapp, page at /dreams) — the shared dream feed ─────
//
// The real app behind the mockups: signed-in friends write dreams, draw them,
// choose what's public per piece, and read each other's — behind the
// share-to-see gate. Accounts are membry-df528 Firebase Auth, the SAME users
// as XI / the witch app (Google + email/password; the witch app already signs
// people in from this domain, so authorized domains are done).
//
// Every route is server-enforced: the client only ever talks to this API with
// an ID token — no direct Firestore reads — so the gate and per-piece
// visibility cannot be bypassed by a curious friend with devtools.
//
// Data (deckfactory Firestore):
//   forge-dreamapp        one doc per dream { id, uid, name, text, title,
//                         createdAt, publicOn (YYYY-MM-DD PT | null),
//                         wordsPublic, panels:[{i, url, captions, promptUsed,
//                         public}], drawJob, drawnAt, feltCount }
//   forge-dreamapp-felt   one doc per dream+uid ("felt this")
//
// The AI names each dream (2-5 words, shown in fuchsia in the app) as a
// background job right after capture; drawing reuses the dream-zine engine
// (movies.js makeDreamPagesV2 — style ref, no character cards) as a
// background job on the doc, ~2¢/page at the default low quality.

const express = require('express');
const admin = require('firebase-admin');
const { makeDreamPagesV2 } = require('./movies');

const router = express.Router();

// ── THE SHARE-TO-SEE GATE — currently OFF (Sophie, Aug 2026) ────────────────
// Flip this back to true to require sharing a dream before the feed opens.
// It is one constant on purpose: the whole mechanism (sealed response, the
// sharedToday check) stays built and tested underneath, so turning it back on
// is this line and nothing else.
// While it's OFF the feed also widens past today (FEED_DAYS) — a today-only
// feed with no gate reads as empty every morning.
const GATE_ON = false;
const FEED_DAYS = 14;

const DREAMS = 'forge-dreamapp';
const FELT = 'forge-dreamapp-felt';
const QUALITIES = new Set(['low', 'medium']);
const TEXT_MIN = 10;
const TEXT_MAX = 8000;

let deps = { membryAuth: null };
function init(d) { deps = { ...deps, ...d }; }

const db = () => (admin.apps.length ? admin.firestore() : null);

// The feed's day. US Pacific — the feed turns over with the morning.
const feedDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

// ── auth: every route below /status requires a membry ID token ─────────────
async function identify(req) {
  const tok = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!tok || !deps.membryAuth) return null;
  try {
    const auth = await deps.membryAuth();
    if (!auth) return null;
    const dec = await auth.verifyIdToken(tok);
    const name = (dec.name || '').split(' ')[0] || (dec.email || '').split('@')[0] || 'dreamer';
    return { uid: dec.uid, name };
  } catch { return null; }
}
async function requireUser(req, res, next) {
  const user = await identify(req);
  if (!user) return res.status(401).json({ error: 'sign in first' });
  req.user = user;
  next();
}

// ── light per-uid rate limits (identity beats IP here) ──────────────────────
const stamps = new Map(); // key -> [ms, ...]
function limited(key, max, windowMs) {
  const now = Date.now();
  const list = (stamps.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) { stamps.set(key, list); return true; }
  list.push(now);
  stamps.set(key, list);
  return false;
}

// ── the AI name (background, right after capture) ───────────────────────────
async function writeTitle(id, text) {
  const ref = db().collection(DREAMS).doc(id);
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 20,
        messages: [
          { role: 'system', content: 'Name this dream in 2-5 words, Title Case, built from the dream\'s own concrete images and words. No quotes, no period, no interpretation — a name, not a summary.' },
          { role: 'user', content: text.slice(0, 2000) },
        ],
      }),
    });
    const j = await r.json();
    const title = (j.choices?.[0]?.message?.content || '').trim().replace(/^["']|["'.]$/g, '').slice(0, 60);
    await ref.set({ title: title || 'A Dream' }, { merge: true });
  } catch {
    await ref.set({ title: 'A Dream' }, { merge: true }).catch(() => {});
  }
}

// ── drawing (background job on the doc, movies.js engine) ───────────────────
const LIVE = new Set();
async function draw(doc, quality) {
  const ref = db().collection(DREAMS).doc(doc.id);
  const dream = { id: doc.id, dreamText: doc.text, castApproved: [], driftCues: [] };
  let lastSave = 0;
  const progress = async (done, total, label) => {
    doc.drawJob = { status: 'drawing', done, total, label, startedAt: doc.drawJob.startedAt };
    if (Date.now() - lastSave > 1500) { lastSave = Date.now(); await ref.set(doc).catch(() => {}); }
  };
  try {
    await makeDreamPagesV2(dream, quality, progress);
    doc.panels = (dream.pages || []).map((p, i) => ({
      i, url: p.url, captions: p.captions || [], promptUsed: p.promptUsed || '', public: false,
    }));
    doc.drawnAt = new Date().toISOString();
    doc.drawJob = null;
  } catch (e) {
    doc.drawJob = { status: 'failed', error: e.message || 'the drawing failed' };
  } finally {
    LIVE.delete(doc.id);
    await ref.set(doc).catch(() => {});
  }
}

// A doc can claim "drawing" after a restart with nobody drawing it.
function jobDied(doc) {
  const j = doc.drawJob;
  return !!(j && j.status === 'drawing' && !LIVE.has(doc.id)
    && Date.now() - new Date(j.startedAt || 0).getTime() > 2 * 60 * 1000);
}
function repairJob(doc) {
  if (jobDied(doc)) {
    doc.drawJob = { status: 'failed', error: 'the drawing was interrupted — draw it again' };
    db().collection(DREAMS).doc(doc.id).set(doc).catch(() => {});
  }
  return doc;
}

// What the owner sees of their own dream.
function mine(doc) {
  return {
    id: doc.id, text: doc.text, title: doc.title || null,
    createdAt: doc.createdAt, publicOn: doc.publicOn || null,
    wordsPublic: doc.wordsPublic !== false,
    panels: (doc.panels || []).map((p) => ({ i: p.i, url: p.url, captions: p.captions, public: !!p.public })),
    drawJob: doc.drawJob || null, drawnAt: doc.drawnAt || null,
    feltCount: doc.feltCount || 0,
  };
}

async function sharedToday(uid) {
  const snap = await db().collection(DREAMS)
    .where('uid', '==', uid).where('publicOn', '==', feedDay()).limit(1).get();
  return !snap.empty;
}

// ── routes ──────────────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  res.json({ ok: true, firebase: !!admin.apps.length, openai: !!process.env.OPENAI_API_KEY });
});

router.use(express.json({ limit: '256kb' }));
router.use(requireUser);

router.get('/me', async (req, res) => {
  try {
    const shared = await sharedToday(req.user.uid);
    const todays = await db().collection(DREAMS).where('publicOn', '==', feedDay()).get();
    res.json({ name: req.user.name, sharedToday: shared, today: feedDay(), count: todays.size });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/dreams', async (req, res) => {
  try {
    if (limited(`dreams:${req.user.uid}`, 20, 24 * 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'that is a lot of dreams for one day — try tomorrow' });
    }
    const text = String(req.body?.text || '').trim();
    if (text.length < TEXT_MIN) return res.status(400).json({ error: 'write the dream down first' });
    if (text.length > TEXT_MAX) return res.status(400).json({ error: `keep it under ${TEXT_MAX} characters` });
    const ref = db().collection(DREAMS).doc();
    const doc = {
      id: ref.id, uid: req.user.uid, name: req.user.name, text,
      title: null, createdAt: new Date().toISOString(),
      publicOn: null, wordsPublic: true, panels: [], drawJob: null, drawnAt: null, feltCount: 0,
    };
    await ref.set(doc);
    writeTitle(ref.id, text); // background — the client polls the dream
    res.json(mine(doc));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/dreams', async (req, res) => {
  try {
    const snap = await db().collection(DREAMS).where('uid', '==', req.user.uid).get();
    const docs = snap.docs.map((d) => repairJob(d.data()))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 100);
    res.json({ dreams: docs.map(mine) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/dreams/:id', async (req, res) => {
  try {
    const snap = await db().collection(DREAMS).doc(req.params.id).get();
    if (!snap.exists || snap.data().uid !== req.user.uid) return res.status(404).json({ error: 'not found' });
    res.json(mine(repairJob(snap.data())));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/dreams/:id/draw', async (req, res) => {
  try {
    const snap = await db().collection(DREAMS).doc(req.params.id).get();
    if (!snap.exists || snap.data().uid !== req.user.uid) return res.status(404).json({ error: 'not found' });
    const doc = repairJob(snap.data());
    if (doc.drawJob && doc.drawJob.status === 'drawing') return res.status(409).json({ error: 'already drawing' });
    if ((doc.panels || []).length) return res.status(409).json({ error: 'already drawn' });
    if (limited(`draw:${req.user.uid}`, 6, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'too many drawings for now — try again later' });
    }
    const quality = QUALITIES.has(req.body?.quality) ? req.body.quality : 'low';
    doc.drawJob = { status: 'drawing', done: 0, total: 0, label: 'starting', startedAt: new Date().toISOString() };
    await db().collection(DREAMS).doc(doc.id).set(doc);
    LIVE.add(doc.id);
    draw(doc, quality); // deliberately not awaited
    res.json(mine(doc));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/dreams/:id/share', async (req, res) => {
  try {
    const snap = await db().collection(DREAMS).doc(req.params.id).get();
    if (!snap.exists || snap.data().uid !== req.user.uid) return res.status(404).json({ error: 'not found' });
    const doc = snap.data();
    const words = req.body?.words !== false;
    const publicIdx = new Set(Array.isArray(req.body?.panels) ? req.body.panels.map(Number) : []);
    doc.wordsPublic = words;
    doc.panels = (doc.panels || []).map((p) => ({ ...p, public: publicIdx.has(p.i) }));
    if (!words && !doc.panels.some((p) => p.public)) {
      return res.status(400).json({ error: 'switch at least one thing public first' });
    }
    doc.publicOn = feedDay();
    doc.name = req.user.name;
    await db().collection(DREAMS).doc(doc.id).set(doc);
    res.json(mine(doc));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/feed', async (req, res) => {
  try {
    const today = feedDay();
    // Gated: strictly today's dreams. Open: the last FEED_DAYS, so the feed
    // still reads as a feed on a quiet morning.
    const since = new Date(Date.now() - FEED_DAYS * 86400000)
      .toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    const snap = GATE_ON
      ? await db().collection(DREAMS).where('publicOn', '==', today).get()
      : await db().collection(DREAMS).where('publicOn', '>=', since).get();
    if (GATE_ON && !(await sharedToday(req.user.uid))) {
      return res.json({ sealed: true, count: snap.size, today });
    }
    const feltSnap = await db().collection(FELT).where('uid', '==', req.user.uid).get();
    const felt = new Set(feltSnap.docs.map((d) => d.data().dreamId));
    const dreams = snap.docs.map((d) => d.data())
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((doc) => ({
        id: doc.id,
        title: doc.title || 'A Dream',
        // `name` still rides along for a later reader; the feed does not show
        // it — dreams are grouped under their DAY, unattributed (Sophie).
        name: doc.name,
        mine: doc.uid === req.user.uid,
        createdAt: doc.createdAt,
        publicOn: doc.publicOn,
        words: doc.wordsPublic !== false ? doc.text : null,
        panels: (doc.panels || []).filter((p) => p.public).map((p) => ({ i: p.i, url: p.url, captions: p.captions })),
        feltCount: doc.feltCount || 0,
        felt: felt.has(doc.id),
      }));
    res.json({ sealed: false, today, dreams });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/dreams/:id/felt', async (req, res) => {
  try {
    const dreamRef = db().collection(DREAMS).doc(req.params.id);
    const feltRef = db().collection(FELT).doc(`${req.params.id}_${req.user.uid}`);
    const result = await db().runTransaction(async (tx) => {
      const [dream, mark] = await Promise.all([tx.get(dreamRef), tx.get(feltRef)]);
      if (!dream.exists) throw new Error('not found');
      const count = dream.data().feltCount || 0;
      if (mark.exists) {
        tx.delete(feltRef);
        tx.update(dreamRef, { feltCount: Math.max(0, count - 1) });
        return { felt: false, feltCount: Math.max(0, count - 1) };
      }
      tx.set(feltRef, { dreamId: req.params.id, uid: req.user.uid, at: new Date().toISOString() });
      tx.update(dreamRef, { feltCount: count + 1 });
      return { felt: true, feltCount: count + 1 };
    });
    res.json(result);
  } catch (e) { res.status(e.message === 'not found' ? 404 : 500).json({ error: e.message }); }
});

module.exports = { router, init };
