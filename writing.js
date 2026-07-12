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

// ─── Read-aloud: a date's text in Sophie's own voice (F5-TTS) ───────────────
// On-demand + cached: the first "Listen" tap renders the audio via Replicate
// F5 (~1¢ per 10-15s of speech, so ~30-50¢ for a full date) and saves the mp3
// to Storage; every later tap plays the cached file until the text changes
// (cache key includes a hash of the text). Voice = voices/sophie-f5 preset.
const crypto = require('crypto');
const { spawn } = require('child_process');
const os = require('os');

const F5_VERSION = '87faf6dd7a692dd82043f662e76369cab126a2cf1937e25a9d41e0b834fd230e';
const AUDIO_COLLECTION = 'forge-writing-audio';
const audioJobs = new Map(); // docId -> true while rendering

function refAudio() {
  const wav = fs.readFileSync(path.join(__dirname, 'voices', 'sophie-f5', 'reference.wav'));
  const txt = fs.readFileSync(path.join(__dirname, 'voices', 'sophie-f5', 'reference.txt'), 'utf8').trim();
  return { dataUri: 'data:audio/wav;base64,' + wav.toString('base64'), refText: txt };
}

function dateText(dateId) {
  const data = JSON.parse(fs.readFileSync(DATES_FILE, 'utf8'));
  const d = (data.dates || []).find((x) => x.id === dateId);
  if (!d) return null;
  const blocks = (d.claudeBlocks || []).map((b) => (b.spans || []).map((sp) => sp.t).join(' '));
  return { name: d.name, no: d.no, text: blocks.join('\n\n') };
}

// F5 handles short passages best — split at sentence ends, ~600 chars each.
function chunkText(t) {
  const sentences = t.replace(/\n+/g, ' ').match(/[^.!?…]+[.!?…]+["”']?\s*/g) || [t];
  const chunks = []; let cur = '';
  for (const s of sentences) {
    if (cur && (cur + s).length > 600) { chunks.push(cur.trim()); cur = ''; }
    cur += s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

function replicateCreate(input, tries = 3) {
  const body = JSON.stringify({ version: F5_VERSION, input });
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = require('https').request('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json' },
      }, (res) => {
        let buf = ''; res.on('data', (c) => buf += c);
        res.on('end', () => {
          try {
            const d = JSON.parse(buf);
            if (res.statusCode === 429 && n < tries) return setTimeout(() => attempt(n + 1), 4000 * n);
            if (!d.urls || !d.urls.get) return reject(new Error(d.detail || d.error || ('replicate ' + res.statusCode)));
            resolve(d);
          } catch (e) { reject(e); }
        });
      });
      req.on('error', (e) => n < tries ? setTimeout(() => attempt(n + 1), 3000 * n) : reject(e));
      req.write(body); req.end();
    };
    attempt(1);
  });
}
function replicateGet(url) {
  return new Promise((resolve, reject) => {
    require('https').get(url, { headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` } }, (res) => {
      let buf = ''; res.on('data', (c) => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
function download(url, file, tries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const out = fs.createWriteStream(file);
      require('https').get(url, (res) => {
        if (res.statusCode >= 300 && res.headers.location) return require('https').get(res.headers.location, (r2) => r2.pipe(out));
        res.pipe(out);
      }).on('error', (e) => n < tries ? setTimeout(() => attempt(n + 1), 2000) : reject(e));
      out.on('finish', () => resolve(file));
      out.on('error', reject);
    };
    attempt(1);
  });
}

async function renderDateAudio(docId, dateId) {
  const db = admin.firestore();
  const ref = db.collection(AUDIO_COLLECTION).doc(docId);
  try {
    const d = dateText(dateId);
    const { dataUri, refText } = refAudio();
    const chunks = chunkText(d.text);
    await ref.set({ status: 'rendering', chunksTotal: chunks.length, chunksDone: 0 }, { merge: true });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'read-'));
    const files = [];
    for (let i = 0; i < chunks.length; i++) {
      let pred = await replicateCreate({ ref_audio: dataUri, ref_text: refText, gen_text: chunks[i], remove_silence: true });
      while (!['succeeded', 'failed', 'canceled'].includes(pred.status)) {
        await new Promise((r) => setTimeout(r, 2500));
        pred = await replicateGet(pred.urls.get);
      }
      if (pred.status !== 'succeeded') throw new Error('chunk ' + i + ' ' + pred.status + ': ' + (pred.error || ''));
      const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
      files.push(await download(out, path.join(tmp, `c${String(i).padStart(3, '0')}.wav`)));
      await ref.set({ chunksDone: i + 1 }, { merge: true });
    }
    const listFile = path.join(tmp, 'list.txt');
    fs.writeFileSync(listFile, files.map((f) => `file '${f}'`).join('\n'));
    const mp3 = path.join(tmp, 'date.mp3');
    const ffmpeg = require('ffmpeg-static');
    await new Promise((resolve, reject) => {
      const p = spawn(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-ar', '24000', '-b:a', '96k', mp3]);
      let err = ''; p.stderr.on('data', (c) => err += c);
      p.on('close', (code) => code === 0 ? resolve() : reject(new Error('ffmpeg: ' + err.slice(-300))));
    });
    const bucket = admin.storage().bucket();
    const dest = bucket.file(`writing-audio/${docId}.mp3`);
    await dest.save(fs.readFileSync(mp3), { contentType: 'audio/mpeg', resumable: false });
    await dest.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${dest.name}`;
    await ref.set({ status: 'ready', url, updated: new Date().toISOString() }, { merge: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch (err) {
    await ref.set({ status: 'error', error: String(err.message || err) }, { merge: true }).catch(() => {});
  } finally {
    audioJobs.delete(docId);
  }
}

// POST /api/writing/audio { dateId } → { status: ready|rendering, url? }
router.post('/audio', async (req, res) => {
  try {
    const dateId = String((req.body || {}).dateId || '');
    const d = dateText(dateId);
    if (!d) return res.status(404).json({ error: 'unknown dateId' });
    if (!process.env.REPLICATE_API_TOKEN) return res.status(503).json({ error: 'replicate not configured' });
    const hash = crypto.createHash('sha1').update(d.text).digest('hex').slice(0, 10);
    const docId = `${dateId}_c_${hash}`;
    const doc = await db().collection(AUDIO_COLLECTION).doc(docId).get();
    const cur = doc.exists ? doc.data() : null;
    if (cur && cur.status === 'ready' && cur.url) return res.json({ status: 'ready', url: cur.url });
    if (audioJobs.has(docId) || (cur && cur.status === 'rendering')) {
      return res.json({ status: 'rendering', chunksDone: cur ? cur.chunksDone : 0, chunksTotal: cur ? cur.chunksTotal : null });
    }
    audioJobs.set(docId, true);
    renderDateAudio(docId, dateId); // background
    res.json({ status: 'rendering', started: true });
  } catch (err) {
    res.status(err.message.includes('not configured') ? 503 : 500).json({ error: err.message });
  }
});

module.exports = { router };
