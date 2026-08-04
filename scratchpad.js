// scratchpad.js — the Scratch Pad. Stage ONE of a story: thinking with
// pictures, before the Story Room (stage two) makes it a board.
//
// The idea (Sophie, Aug 2026 voice memo + chat): images she makes in the
// Playground and HEARTS become a dump inbox for the pad. From the pad she
// opens that inbox (button top-right), taps a thumbnail, and it lands on the
// pad as a beat in a thin gray frame. Tapping a beat opens a popup where she
// gives its frame a color — mustard / green / blue / pink — the color IS the
// indicator (deliberately unlabelled; the whole point is markers that skip
// left-brain naming). Adding the next image shows dashed slots so she picks
// where in the order it goes. No drawing happens on the pad itself — it shows
// finished artwork only; regenerating/versions will live in the beat popup
// LATER (left flexible on purpose).
//
// Data: ONE Firestore doc (collection `forge-scratchpad`, doc `pad`) —
//   { beats: [{ id, url, color, src:{ runId, i, prompt, model, engine,
//     quality }, addedAt }], updatedAt }
// The `src` block is carried so the later regenerate feature knows exactly
// how each image was made without re-deriving anything.
//
// The inbox is READ straight out of `forge-promptlab` (votes live on the run
// docs — `votes.<imageIndex> === 'like'`), so hearting in the Playground needs
// no new write path and un-hearting there removes it from the inbox too.
//
// Mounted at /api/scratchpad by server.js, page at /scratchpad.
// STUDIO_TOKEN-gated (only /status open), same as every studio tool.
//
// Routes:
//   GET  /status         → { ok, firebase }
//   GET  /               → { beats }
//   GET  /inbox          → { items:[{url, runId, i, prompt, model, engine,
//                          quality, at}] } — hearted Playground images, newest first
//   POST /add            → { url, at?, src? } — insert a beat at index `at`
//                          (default: the end); returns { beats }
//   POST /color          → { id, color } — set a beat's frame color
//                          ('mustard'|'green'|'blue'|'pink'|null = back to gray)

const express = require('express');
const admin = require('firebase-admin');

const COL = 'forge-scratchpad';
const DOC = 'pad';
const PROMPTLAB = 'forge-promptlab';
const COLORS = ['mustard', 'green', 'blue', 'pink'];

const db = () => admin.firestore();
const padRef = () => db().collection(COL).doc(DOC);

function fail(res, e) {
  console.warn('scratchpad:', e.message);
  res.status(500).json({ error: e.message });
}

async function readPad() {
  const snap = await padRef().get();
  const v = snap.exists ? snap.data() : {};
  return { beats: Array.isArray(v.beats) ? v.beats : [] };
}

const router = express.Router();

router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '1mb' }));

router.get('/status', (req, res) => {
  res.json({ ok: true, firebase: admin.apps.length > 0 });
});

router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await readPad());
  } catch (e) { fail(res, e); }
});

// The inbox: every Playground image Sophie hearted, newest run first. Votes
// live on the run docs, so this is a pure read — nothing is copied anywhere.
router.get('/inbox', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const q = await db().collection(PROMPTLAB)
      .orderBy('createdAt', 'desc').limit(300).get();
    const items = [];
    q.docs.forEach((s) => {
      const d = s.data();
      const votes = d.votes || {};
      (d.images || []).forEach((url, i) => {
        if (votes[i] !== 'like' || !url) return;
        items.push({
          url, runId: s.id, i,
          prompt: d.prompt || null, model: d.model || null,
          engine: d.engine || null, quality: d.quality || null,
          at: d.createdAt?.toMillis?.() || null,
        });
      });
    });
    res.json({ count: items.length, items });
  } catch (e) { fail(res, e); }
});

router.post('/add', async (req, res) => {
  try {
    const url = String(req.body.url || '').trim();
    if (!/^https?:\/\//.test(url)) return res.status(400).json({ error: 'image url required' });
    const src = (req.body.src && typeof req.body.src === 'object') ? req.body.src : null;
    const beat = {
      id: db().collection(COL).doc().id, url, color: null, src,
      addedAt: Date.now(),
    };
    // Single-user tool, but the read-modify-write still goes through a
    // transaction so two quick adds can't drop each other.
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef());
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      let at = Number(req.body.at);
      if (!Number.isInteger(at) || at < 0 || at > cur.length) at = cur.length;
      cur.splice(at, 0, beat);
      tx.set(padRef(), { beats: cur, updatedAt: Date.now() }, { merge: true });
      return cur;
    });
    res.json({ ok: true, beat, beats });
  } catch (e) { fail(res, e); }
});

router.post('/color', async (req, res) => {
  try {
    const id = String(req.body.id || '');
    const color = req.body.color === null ? null : String(req.body.color || '');
    if (!id) return res.status(400).json({ error: 'beat id required' });
    if (color !== null && !COLORS.includes(color)) {
      return res.status(400).json({ error: `color must be one of ${COLORS.join('/')} or null` });
    }
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef());
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      const b = cur.find((x) => x.id === id);
      if (!b) throw new Error('no such beat');
      b.color = color;
      tx.set(padRef(), { beats: cur, updatedAt: Date.now() }, { merge: true });
      return cur;
    });
    res.json({ ok: true, beats });
  } catch (e) { fail(res, e); }
});

module.exports = { router };
