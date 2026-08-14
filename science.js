/**
 * Science School — the small server half of /science.
 *
 * Right now it does ONE thing: hold Sophie's note on each lesson while the
 * school is being iterated on ("since we're still iterating, can you add a
 * note field so I can add notes to each of the lessons", Aug 2026). Her note
 * is a message to whichever chat is building the lesson, so it has to survive
 * the phone and be readable from anywhere:
 *
 *   GET  /api/science/notes            → { notes: { <lesson>: {text, at} } }
 *   POST /api/science/note {lesson,text}
 *
 * WHY ITS OWN ROUTE rather than the Compare pages' /api/chatfeed/verdict,
 * which is the house mechanism for "she leaves a note, a chat reads it":
 * `/api/chatfeed` sits behind the STUDIO_TOKEN gate. That gate is OFF on the
 * live server today, so a verdict POST from this page would work — and would
 * start 401ing silently the day the token is switched on, losing notes from a
 * PUBLIC page with nothing on screen to explain why. /science is ungated like
 * /witch, so its own writes have to be ungated by design.
 *
 * A chat reads what she wrote with one call:
 *   curl https://imageforge-q125.onrender.com/api/science/notes
 * and should sweep it whenever Sophie messages — same snail-mail rhythm as
 * the notes on an image. NOT on a timer.
 */
const express = require('express');
const admin = require('firebase-admin');

const router = express.Router();
const COL = 'forge-science-notes';
const MAX = 2000;

// The write is open, because the page is. Keep it cheap and bounded: a note
// is text and nothing else, the lesson key must look like a lesson key, and
// one IP gets 60 writes an hour (the /selfcare precedent, which guards a
// public endpoint that spends real money — this one only spends a document).
const hits = new Map();
function overLimit(ip) {
  const now = Date.now(), hour = 3600e3;
  const a = (hits.get(ip) || []).filter(t => now - t < hour);
  a.push(now); hits.set(ip, a);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < hour)) hits.delete(k);
  return a.length > 60;
}

function ready() { return !!admin.apps.length; }

router.get('/status', (req, res) => res.json({ ok: true, configured: ready() }));

router.get('/notes', async (req, res) => {
  try {
    if (!ready()) return res.json({ notes: {} });
    const snap = await admin.firestore().collection(COL).get();
    const notes = {};
    snap.forEach(d => { const v = d.data() || {}; if (v.text) notes[d.id] = { text: v.text, at: v.at || null }; });
    res.json({ notes });
  } catch (err) { res.status(502).json({ error: err.message }); }
});

router.post('/note', express.json({ limit: '16kb' }), async (req, res) => {
  try {
    if (!ready()) return res.status(503).json({ error: 'not configured' });
    const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    if (overLimit(ip)) return res.status(429).json({ error: 'too many notes' });
    const lesson = String((req.body || {}).lesson || '');
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(lesson)) return res.status(400).json({ error: 'bad lesson' });
    const text = String((req.body || {}).text || '').slice(0, MAX);
    // An empty note DELETES rather than storing a blank — clearing the box is
    // how she takes a note back, and a stored empty string would keep the row
    // alive in every reader's sweep.
    const doc = admin.firestore().collection(COL).doc(lesson);
    if (!text.trim()) { await doc.delete().catch(() => {}); return res.json({ ok: true, cleared: true }); }
    await doc.set({ text, at: new Date().toISOString() }, { merge: true });
    res.json({ ok: true });
  } catch (err) { res.status(502).json({ error: err.message }); }
});

module.exports = router;
