// ─── Dream Draw (/api/dreamdraw) — dream text → drawn comic pages ───────────
//
// The style-agnostic backend for the dream app's "draw it" button: a dream's
// text in, 1-4 drawn pages out, using exactly the engine the dream zines use
// (movies.js dreamPaginate + makeDreamPagesV2 with the movie style ref and no
// character cards). Deliberately a PURE DRAW SERVICE — the feed, per-panel
// visibility, and the share-to-see gate belong to the site's own database, so
// this module knows nothing about who may see a page.
//
// PUBLIC like /api/selfcare (the button has to work for strangers) and it
// spends money, so it is rate-limited per IP here. Background job on the doc
// (house rule): POST returns the id in ~0.2s, the client polls GET /:id and
// resumes after leaving the app. Costs: a page is ~2¢ low / ~6¢ medium and a
// dream draws at most 4 pages, so one call is ≤8¢ at the default low.

const express = require('express');
const admin = require('firebase-admin');
const { makeDreamPagesV2 } = require('./movies');

const router = express.Router();
const COLLECTION = 'forge-dreamdraw';
const QUALITIES = new Set(['low', 'medium']);
const TEXT_MIN = 20;
const TEXT_MAX = 4000;

const db = () => (admin.apps.length ? admin.firestore() : null);

// Per-IP rate limit, selfcare.js pattern. 6 draws an hour is generous for a
// person and cheap as a ceiling for an abuser (~48¢/hr at low).
const RATE_MAX = 6;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  return false;
}

// Jobs run in this process; after a restart a doc can claim "drawing" with
// nobody drawing it. Readers flip those to a clear error (movies.js pattern).
const LIVE = new Set();
const DEAD_GRACE_MS = 2 * 60 * 1000;
function jobDied(doc) {
  return doc.status === 'drawing' && !LIVE.has(doc.id)
    && Date.now() - new Date(doc.startedAt || 0).getTime() > DEAD_GRACE_MS;
}

router.get('/status', (req, res) => {
  res.json({ ok: true, openai: !!process.env.OPENAI_API_KEY, firebase: !!admin.apps.length });
});

router.post('/', express.json({ limit: '64kb' }), async (req, res) => {
  try {
    if (!db()) return res.status(503).json({ error: 'storage not configured' });
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    if (rateLimited(ip)) return res.status(429).json({ error: 'too many drawings for now — try again later' });

    const text = String(req.body?.text || '').trim();
    if (text.length < TEXT_MIN) return res.status(400).json({ error: 'write the dream down first' });
    if (text.length > TEXT_MAX) return res.status(400).json({ error: `keep it under ${TEXT_MAX} characters` });
    const quality = QUALITIES.has(req.body?.quality) ? req.body.quality : 'low';

    const ref = db().collection(COLLECTION).doc();
    const doc = {
      id: ref.id, text, quality, status: 'drawing', pages: [], spend: 0,
      createdAt: new Date().toISOString(), startedAt: new Date().toISOString(),
      job: { done: 0, total: 0, label: 'starting' },
    };
    await ref.set(doc);
    LIVE.add(ref.id);
    draw(doc); // deliberately not awaited — the client polls
    res.json({ id: ref.id, poll: `/api/dreamdraw/${ref.id}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!db()) return res.status(503).json({ error: 'storage not configured' });
    const snap = await db().collection(COLLECTION).doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'not found' });
    const doc = snap.data();
    if (jobDied(doc)) {
      doc.status = 'failed';
      doc.error = 'the drawing was interrupted — draw it again';
      db().collection(COLLECTION).doc(doc.id).set(doc).catch(() => {});
    }
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function draw(doc) {
  const ref = db().collection(COLLECTION).doc(doc.id);
  // A dream-shaped object for the shared engine: no cast, no drift cues —
  // dreamPaginate still fixes narration order from the text's own cues.
  const dream = { id: doc.id, dreamText: doc.text, castApproved: [], driftCues: [] };
  let lastSave = 0;
  const progress = async (done, total, label) => {
    doc.job = { done, total, label };
    if (Date.now() - lastSave > 1500) {
      lastSave = Date.now();
      await ref.set(doc).catch(() => {});
    }
  };
  try {
    await makeDreamPagesV2(dream, doc.quality, progress);
    // THE WHOLE PROMPT (Sophie's hard rule, 2026-08-24: "anytime an image is
    // made ANYWHERE the whole prompt shud be stored"). movies.js already puts
    // the exact sent text on each page as `promptUsed` and this mapper was
    // dropping it on the floor — the picture survived, the words that drew it
    // did not.
    doc.pages = (dream.pages || []).map((p, i) => ({
      i, url: p.url, text: p.text || '', captions: p.captions || [],
      fullPrompt: String(p.promptUsed || '').slice(0, 6000),
    }));
    doc.spend = dream.spend || 0;
    doc.status = 'done';
    doc.job = { done: doc.pages.length, total: doc.pages.length, label: 'done' };
  } catch (e) {
    doc.status = 'failed';
    doc.error = e.message || 'drawing failed';
  } finally {
    LIVE.delete(doc.id);
    await ref.set(doc).catch(() => {});
  }
}

module.exports = { router };
