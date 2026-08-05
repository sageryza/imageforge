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
// ("Sophie — morning") on eleven_multilingual_v2, the Voice Studio recipe.
// v3 was tried (Aug 2026) and REVERTED: professional clones aren't optimized
// for v3 and the likeness drops badly ("a cousin doing an impression") —
// v2 is the model that actually sounds like her. <break time="1.0s" /> tags
// work in a note for pauses; v3's [quietly]-style acting tags do not.
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
router.use(express.json({ limit: '25mb' })); // /voice carries a recording as a data URL

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

// Give an EXISTING beat its picture — the empty-beat popup's inbox path
// (choosing from there fills THAT beat instead of adding a new one).
router.post('/image', async (req, res) => {
  try {
    const id = String(req.body.id || '');
    const url = String(req.body.url || '').trim();
    if (!id) return res.status(400).json({ error: 'beat id required' });
    if (!/^https?:\/\//.test(url)) return res.status(400).json({ error: 'image url required' });
    const src = (req.body.src && typeof req.body.src === 'object') ? req.body.src : null;
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef());
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      const b = cur.find((x) => x.id === id);
      if (!b) throw new Error('no such beat');
      b.url = url;
      if (src) b.src = src;
      tx.set(padRef(), { beats: cur, updatedAt: Date.now() }, { merge: true });
      return cur;
    });
    res.json({ ok: true, beats });
  } catch (e) { fail(res, e); }
});

// Her OWN reading of a beat's words (the popup's mic icon): stored on the
// beat as voiceUrl, and it beats TTS everywhere — the caption and speech
// icon play the recording when one exists. Re-recording replaces it;
// audio:null clears it back to TTS.
router.post('/voice', async (req, res) => {
  try {
    const id = String(req.body.id || '');
    if (!id) return res.status(400).json({ error: 'beat id required' });
    let url = null;
    if (req.body.audio !== null && req.body.audio !== undefined) {
      const m = String(req.body.audio).match(/^data:(audio\/[\w.+-]+);base64,(.+)$/);
      if (!m) return res.status(400).json({ error: 'audio must be an audio data URL (or null to clear)' });
      const ext = m[1].includes('mp4') ? 'm4a' : (m[1].includes('webm') ? 'webm' : 'audio');
      const buf = Buffer.from(m[2], 'base64');
      if (!buf.length) return res.status(400).json({ error: 'empty recording' });
      const bucket = admin.storage().bucket();
      const dest = `scratchpad/voice/${id}-${Date.now()}.${ext}`;
      const tmp = path.join(os.tmpdir(), `spv-${id}.${ext}`);
      fs.writeFileSync(tmp, buf);
      await bucket.upload(tmp, { destination: dest, metadata: { contentType: m[1] } });
      await bucket.file(dest).makePublic();
      fs.unlink(tmp, () => {});
      url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    }
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef());
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      const b = cur.find((x) => x.id === id);
      if (!b) throw new Error('no such beat');
      if (url) { b.voiceUrl = url; b.voiceAt = Date.now(); }
      else { delete b.voiceUrl; delete b.voiceAt; }
      tx.set(padRef(), { beats: cur, updatedAt: Date.now() }, { merge: true });
      return cur;
    });
    res.json({ ok: true, url, beats });
  } catch (e) { fail(res, e); }
});

// ── Chunks: beats linked so they always travel together ─────────────
// A chunk is contiguous beats sharing a `chunk` id. On the pad it renders in
// ONE tile's width (the members as side-by-side slices in a shared frame),
// and placement slots only appear between units — never inside a chunk.
// Linking is unbounded: chunk with the next unit again and again (2, 3, 4…).
// Unlinking dissolves the WHOLE chunk back into single beats (predictable
// for any length). Colors apply chunk-wide (see /color).

function membersOf(beats, beat) {
  if (!beat.chunk) return [beat];
  return beats.filter((b) => b.chunk === beat.chunk);
}

// Link this beat's unit with the NEXT unit on the pad (they become one chunk).
router.post('/chunk', async (req, res) => {
  try {
    const id = String(req.body.id || '');
    if (!id) return res.status(400).json({ error: 'beat id required' });
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef());
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      const b = cur.find((x) => x.id === id);
      if (!b) throw new Error('no such beat');
      const mine = membersOf(cur, b);
      const lastIdx = cur.indexOf(mine[mine.length - 1]);
      const next = cur[lastIdx + 1];
      if (!next) throw new Error('nothing after this beat to link with');
      const theirs = membersOf(cur, next);
      const chunkId = b.chunk || next.chunk || db().collection(COL).doc().id;
      mine.concat(theirs).forEach((m) => { m.chunk = chunkId; });
      tx.set(padRef(), { beats: cur, updatedAt: Date.now() }, { merge: true });
      return cur;
    });
    res.json({ ok: true, beats });
  } catch (e) { fail(res, e); }
});

// Dissolve the whole chunk this beat belongs to.
router.post('/unchunk', async (req, res) => {
  try {
    const id = String(req.body.id || '');
    if (!id) return res.status(400).json({ error: 'beat id required' });
    const beats = await db().runTransaction(async (tx) => {
      const snap = await tx.get(padRef());
      const cur = (snap.exists && Array.isArray(snap.data().beats)) ? snap.data().beats : [];
      const b = cur.find((x) => x.id === id);
      if (!b) throw new Error('no such beat');
      membersOf(cur, b).forEach((m) => { delete m.chunk; });
      tx.set(padRef(), { beats: cur, updatedAt: Date.now() }, { merge: true });
      return cur;
    });
    res.json({ ok: true, beats });
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

    // Settings ride in the cache key so a changed voice mode (Natural →
    // Robust) re-renders existing notes instead of replaying the old sound.
    const hash = crypto.createHash('sha1')
      .update(`${TTS_VOICE_ID}|${TTS_MODEL}|s${TTS_SETTINGS.stability}|${text}`).digest('hex');
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
      // A chunk shares one frame, so it shares one color.
      membersOf(cur, b).forEach((m) => { m.color = color; });
      tx.set(padRef(), { beats: cur, updatedAt: Date.now() }, { merge: true });
      return cur;
    });
    res.json({ ok: true, beats });
  } catch (e) { fail(res, e); }
});

module.exports = { router };
