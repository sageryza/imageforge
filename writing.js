// Writing Room — the dating-book working drafts as a phone-reviewable module.
// Serves the dates (two versions each: Sophie's original journal + the current
// working draft, with changed-word spans precomputed) and persists her review
// notes to Firestore so any Claude chat can read and apply them.
//
// Data: docs/dating-book/working-drafts/dates.json (committed; regenerate with
// scripts/gen-writing.py which also rebuilds public/writing.html).
// Notes: Firestore collection `forge-writing-notes`, one doc per annotated
// block (deterministic id `<date>_<version><block>`), optional voice memo
// uploaded to Storage `writing-notes/`.
//
// Routes (all x-studio-token gated like the rest of the pipeline):
//   GET    /api/writing/dates      → the committed dates.json
//   GET    /api/writing/notes      → all notes (?dateId= filters)
//   POST   /api/writing/notes      → upsert { key, dateId, blockId, version,
//                                    excerpt, text, audio? (data URL) }
//   DELETE /api/writing/notes/:id  → remove one (after a chat applies it)

const fs = require('fs');
const path = require('path');
const express = require('express');
const admin = require('firebase-admin');

const router = express.Router();
const COLLECTION = 'forge-writing-notes';
const DATES_FILE = path.join(__dirname, 'docs', 'dating-book', 'working-drafts', 'dates.json');

function gate(req, res, next) {
  const token = process.env.STUDIO_TOKEN || '';
  if (token && req.get('x-studio-token') !== token) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}
router.use(gate);
router.use(express.json({ limit: '8mb' })); // voice memos arrive as data URLs

function db() {
  if (!admin.apps.length) throw new Error('firebase not configured');
  return admin.firestore();
}

router.get('/dates', (req, res) => {
  try {
    res.json(JSON.parse(fs.readFileSync(DATES_FILE, 'utf8')));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/notes', async (req, res) => {
  try {
    let q = db().collection(COLLECTION);
    if (req.query.dateId) q = q.where('dateId', '==', String(req.query.dateId));
    const snap = await q.get();
    res.json({ notes: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    res.status(err.message.includes('not configured') ? 503 : 500).json({ error: err.message });
  }
});

router.post('/notes', async (req, res) => {
  try {
    const { key, dateId, blockId, version, excerpt, text, audio } = req.body || {};
    if (!key || !dateId || !blockId) return res.status(400).json({ error: 'key, dateId, blockId required' });
    const id = String(key).replace(/[^a-zA-Z0-9_-]/g, '_');
    const doc = {
      dateId: String(dateId),
      blockId: String(blockId),
      version: version === 'o' ? 'o' : 'c',
      excerpt: String(excerpt || '').slice(0, 200),
      text: String(text || '').slice(0, 4000),
      updated: new Date().toISOString(),
    };
    if (audio && /^data:audio\//.test(audio)) {
      const bucket = admin.apps.length ? admin.storage().bucket() : null;
      const m = audio.match(/^data:(audio\/[\w.+-]+);base64,(.+)$/);
      if (bucket && m) {
        const ext = m[1].includes('mp4') ? 'm4a' : m[1].split('/')[1].split(';')[0];
        const file = bucket.file(`writing-notes/${id}.${ext}`);
        await file.save(Buffer.from(m[2], 'base64'), { contentType: m[1], resumable: false });
        await file.makePublic();
        doc.audioUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
      } else if (audio.length < 400000) {
        doc.audioData = audio; // small memo, no bucket — keep inline
      }
    }
    await db().collection(COLLECTION).doc(id).set(doc, { merge: true });
    res.json({ ok: true, id, audioUrl: doc.audioUrl || null });
  } catch (err) {
    res.status(err.message.includes('not configured') ? 503 : 500).json({ error: err.message });
  }
});

router.delete('/notes/:id', async (req, res) => {
  try {
    await db().collection(COLLECTION).doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(err.message.includes('not configured') ? 503 : 500).json({ error: err.message });
  }
});

module.exports = { router };
