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
//   GET  /               → { title, beats }
//   POST /title          → { title } — the story's name ("Untitled" until set)
//   POST /tts            → { id } → { url } — the beat's note in Sophie's
//                          voice (ElevenLabs "Sophie — morning", cached by
//                          text hash at scratchpad/tts/<hash>.mp3)
//   GET  /inbox          → { items:[{url, runId, i, prompt, model, engine,
//                          quality, at}] } — hearted Playground images, newest first
//   POST /add            → { url, at?, src? } — insert a beat at index `at`
//                          (default: the end); returns { beats }
//   POST /color          → { id, color } — set a beat's frame color
//                          ('mustard'|'green'|'blue'|'pink'|null = back to gray)
//   POST /text           → { id, text } — the beat's note (the popup's
//                          three-line text box; 5000 chars max)

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = require('node-fetch');
const fs = require('fs');
const os = require('os');
const path = require('path');

const COL = 'forge-scratchpad';
const DOC = 'pad';
const PROMPTLAB = 'forge-promptlab';
const COLORS = ['mustard', 'green', 'blue', 'pink'];

// A beat's note read aloud — Sophie's professional ElevenLabs clone
// ("Sophie — morning", the same voice + recipe the Voice Studio offers).
const TTS_VOICE_ID = 'UTkHGl2ImiT6gwtAFCql';
const TTS_MODEL = 'eleven_multilingual_v2';
const TTS_SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true };

const db = () => admin.firestore();
const padRef = () => db().collection(COL).doc(DOC);

function fail(res, e) {
  console.warn('scratchpad:', e.message);
  res.status(500).json({ error: e.message });
}

async function readPad() {
  const snap = await padRef().get();
  const v = snap.exists ? snap.data() : {};
  return { title: v.title || '', beats: Array.isArray(v.beats) ? v.beats : [] };
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
    // No url = an EMPTY beat (blank tile; its art comes later).
    const url = String(req.body.url || '').trim();
    if (url && !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'image url must be http(s)' });
    const src = (req.body.src && typeof req.body.src === 'object') ? req.body.src : null;
    const beat = {
      id: db().collection(COL).doc().id, url: url || null, color: null, src,
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

// The story's name — "Untitled" on the page until Sophie changes it.
router.post('/title', async (req, res) => {
  try {
    const title = String(req.body.title ?? '').slice(0, 200).trim();
    await padRef().set({ title, updatedAt: Date.now() }, { merge: true });
    res.json({ ok: true, title });
  } catch (e) { fail(res, e); }
});

// A beat's note as audio in Sophie's voice. Cached by the text itself
// (sha1 of voice|model|text → Storage scratchpad/tts/<hash>.mp3), so
// replaying costs nothing and an edited note renders fresh on next play.
router.post('/tts', async (req, res) => {
  try {
    if (!process.env.ELEVENLABS_API_KEY) return res.status(503).json({ error: 'ELEVENLABS_API_KEY is not set' });
    const id = String(req.body.id || '');
    if (!id) return res.status(400).json({ error: 'beat id required' });
    const pad = await readPad();
    const beat = pad.beats.find((b) => b.id === id);
    if (!beat) return res.status(404).json({ error: 'no such beat' });
    const text = String(beat.text || '').trim();
    if (!text) return res.status(400).json({ error: 'this beat has no words yet' });

    const hash = crypto.createHash('sha1')
      .update(`${TTS_VOICE_ID}|${TTS_MODEL}|${text}`).digest('hex');
    if (beat.ttsHash === hash && beat.ttsUrl) return res.json({ ok: true, url: beat.ttsUrl, cached: true });

    const bucket = admin.storage().bucket();
    const dest = `scratchpad/tts/${hash}.mp3`;
    const file = bucket.file(dest);
    let url;
    if ((await file.exists())[0]) {
      url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    } else {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${TTS_VOICE_ID}?output_format=mp3_44100_192`, {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: TTS_MODEL, voice_settings: TTS_SETTINGS }),
        timeout: 120000,
      });
      if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const audio = await r.buffer();
      if (!audio.length) throw new Error('ElevenLabs returned empty audio');
      const tmp = path.join(os.tmpdir(), `sp-${hash}.mp3`);
      fs.writeFileSync(tmp, audio);
      await bucket.upload(tmp, { destination: dest, metadata: { contentType: 'audio/mpeg' } });
      await file.makePublic();
      fs.unlink(tmp, () => {});
      url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    }

    await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef());
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      const b = cur.find((x) => x.id === id);
      if (b) { b.ttsUrl = url; b.ttsHash = hash; }
      tx.set(padRef(), { beats: cur, updatedAt: Date.now() }, { merge: true });
    });
    res.json({ ok: true, url });
  } catch (e) { fail(res, e); }
});

router.post('/text', async (req, res) => {
  try {
    const id = String(req.body.id || '');
    if (!id) return res.status(400).json({ error: 'beat id required' });
    const text = String(req.body.text ?? '').slice(0, 5000);
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef());
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      const b = cur.find((x) => x.id === id);
      if (!b) throw new Error('no such beat');
      b.text = text;
      tx.set(padRef(), { beats: cur, updatedAt: Date.now() }, { merge: true });
      return cur;
    });
    res.json({ ok: true, beats });
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
