// voicelab.js — the Voice Studio. Sophie's ElevenLabs voices on a page: pick a
// voice, type text, tap Render, get the audio — without leaving Deck Factory.
//
// Deliberately NO settings anywhere (Aug 2026, Sophie's rule for her clones):
// every render is stock ElevenLabs defaults on eleven_multilingual_v2 —
// stability 0.5, similarity 0.75, style 0, speaker boost — the exact
// configuration her approved clone comparison samples used. No whisper
// prefixes, no tempo, no loudnorm. What ElevenLabs returns is what she gets.
//
// Cost model (verified against ElevenLabs docs, Aug 2026): API renders draw
// from the SAME subscription credit pool as elevenlabs.io itself — no separate
// billing, 1 credit per character on multilingual_v2. /status reports the live
// quota so the page can show credits remaining.
//
// House rules honoured:
//   * render = fire-and-forget BACKGROUND JOB on a Firestore doc
//     (`forge-voicelab`, deckfactory) — POST returns an id in ~0.2s, the page
//     polls GET /render/:id and resumes after being closed (localStorage).
//   * audio goes to Firebase Storage (`voice-lab/<id>.mp3`, public) — permanent
//     URLs, never a temporary ElevenLabs response held in memory.
//   * STUDIO_TOKEN gate, only GET /status open. Page served via serveGated.
//
// Routes:
//   GET    /status       → { ok, firebase, elevenlabs, credits:{used,limit} }
//   GET    /voices       → the account's voices, Sophie's clones first
//   POST   /render       → { voiceId, text } → { id }
//   GET    /render/:id   → the job doc (status: rendering | done | failed)
//   GET    /history      → newest 30 renders
//   DELETE /render/:id   → remove a render (doc + audio)

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = require('node-fetch');
const fs = require('fs');
const os = require('os');
const path = require('path');

const COL = 'forge-voicelab';
const STORAGE_FOLDER = 'voice-lab';
const MODEL_ID = 'eleven_multilingual_v2';
const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true };
const MAX_CHARS = 5000;
const EL_BASE = 'https://api.elevenlabs.io/v1';

const router = express.Router();
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
router.use((req, res, next) => {
  if (req.path === '/status' && req.method === 'GET') return next();
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});

const elKey = () => process.env.ELEVENLABS_API_KEY || '';

async function elFetch(pathname, opts = {}) {
  const res = await fetch(`${EL_BASE}${pathname}`, {
    ...opts,
    headers: { 'xi-api-key': elKey(), ...(opts.headers || {}) },
    timeout: opts.timeout || 60000,
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

router.get('/status', async (req, res) => {
  const out = { ok: true, firebase: Boolean(admin.apps.length), elevenlabs: Boolean(elKey()), model: MODEL_ID };
  // Live quota so the page can say what a render costs against what's left —
  // best-effort: a quota hiccup must not report the whole studio down.
  try {
    if (elKey()) {
      const sub = await (await elFetch('/user/subscription')).json();
      out.credits = { used: sub.character_count, limit: sub.character_limit, tier: sub.tier };
    }
  } catch (e) { /* credits line just stays blank */ }
  res.json(out);
});

// The account's voices, Sophie's own clones first (her Sophie voices, then
// cloned/generated, then added library voices). Cached 10 minutes — the list
// changes when she trains a clone, not per page load.
let voicesCache = { at: 0, list: null };
router.get('/voices', async (req, res) => {
  try {
    if (!voicesCache.list || Date.now() - voicesCache.at > 10 * 60 * 1000) {
      const data = await (await elFetch('/voices?show_legacy=true')).json();
      const rank = (v) => {
        if (/sophie/i.test(v.name || '')) return 0;
        if (v.category === 'cloned' || v.category === 'generated') return 1;
        if (v.category === 'professional') return 2;
        return 3;
      };
      voicesCache = {
        at: Date.now(),
        list: (data.voices || [])
          .filter((v) => v.category !== 'premade')
          .map((v) => ({ voiceId: v.voice_id, name: v.name, category: v.category, description: v.description || '' }))
          .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)),
      };
    }
    res.json({ voices: voicesCache.list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function renderJob(id, voiceId, voiceName, text) {
  const doc = admin.firestore().collection(COL).doc(id);
  try {
    const audio = await (await elFetch(`/text-to-speech/${voiceId}?output_format=mp3_44100_192`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: VOICE_SETTINGS }),
      timeout: 180000,
    })).buffer();
    if (!audio.length) throw new Error('ElevenLabs returned empty audio');
    const tmp = path.join(os.tmpdir(), `${id}.mp3`);
    fs.writeFileSync(tmp, audio);
    const bucket = admin.storage().bucket();
    const dest = `${STORAGE_FOLDER}/${id}.mp3`;
    await bucket.upload(tmp, { destination: dest, metadata: { contentType: 'audio/mpeg' } });
    await bucket.file(dest).makePublic();
    fs.unlink(tmp, () => {});
    await doc.update({
      status: 'done',
      url: `https://storage.googleapis.com/${bucket.name}/${dest}`,
      doneAt: new Date().toISOString(),
    });
  } catch (err) {
    await doc.update({ status: 'failed', error: String(err.message || err).slice(0, 400) }).catch(() => {});
  }
}

router.post('/render', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'firestore unavailable' });
    if (!elKey()) return res.status(503).json({ error: 'ELEVENLABS_API_KEY is not set' });
    const voiceId = String((req.body || {}).voiceId || '').trim();
    const voiceName = String((req.body || {}).voiceName || '').slice(0, 120);
    const text = String((req.body || {}).text || '').trim();
    if (!/^[A-Za-z0-9]{10,40}$/.test(voiceId)) return res.status(400).json({ error: 'voiceId required' });
    if (!text) return res.status(400).json({ error: 'text required' });
    if (text.length > MAX_CHARS) {
      return res.status(400).json({ error: `text is ${text.length} chars — the cap is ${MAX_CHARS}` });
    }
    const id = `vl${crypto.randomBytes(6).toString('hex')}`;
    await admin.firestore().collection(COL).doc(id).set({
      id, voiceId, voiceName, text,
      chars: text.length,
      model: MODEL_ID,
      status: 'rendering',
      createdAt: new Date().toISOString(),
    });
    renderJob(id, voiceId, voiceName, text); // fire and forget — the doc is the state
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/render/:id', async (req, res) => {
  try {
    const snap = await admin.firestore().collection(COL).doc(String(req.params.id)).get();
    if (!snap.exists) return res.status(404).json({ error: 'not found' });
    res.json(snap.data());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const snap = await admin.firestore().collection(COL)
      .orderBy('createdAt', 'desc').limit(30).get();
    res.json({ renders: snap.docs.map((d) => d.data()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/render/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    if (!/^vl[a-f0-9]{12}$/.test(id)) return res.status(400).json({ error: 'bad id' });
    await admin.storage().bucket().file(`${STORAGE_FOLDER}/${id}.mp3`).delete({ ignoreNotFound: true });
    await admin.firestore().collection(COL).doc(id).delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router };
