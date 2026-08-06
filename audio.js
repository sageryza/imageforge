// audio.js — the audio drop. Recordings off the phone → permanent Firebase URLs.
//
// Sophie records on her phone (Voice Memos, or anything that lands in the Files
// app) and needs the audio somewhere every other pipeline can reach it. Nothing
// here did that job generically: /api/story/voiceover attaches one recording to
// one story, /api/songs runs the whole song pipeline, /api/memos files into the
// stamped voice-memo archive, and the Dump takes images and video only. So a
// folder of eight recordings had no destination.
//
// This is that destination. Pick the files (the Files app's picker is
// multi-select), they upload one at a time, and each comes back as a permanent
// PUBLIC url — which is the form every downstream step wants: an Episode Editor
// source, a Story Room voiceover, /api/nde's from-video ingest, a chat reading
// them back to transcribe.
//
// DUMP FIRST, LABEL AFTERWARDS, same as the Dump: uploading asks for nothing but
// a batch name (which defaults to the date). `name`, `notes`, `tags` and `track`
// are all fillable later, by her from the page or by a chat.
//
// ONE LIBRARY (Aug 2026): every recording that lands here is ALSO filed into
// the Voice Memo archive (memos.fileIntoArchive — md5-deduped, so nothing
// lands twice however it travels), and every recording is transcribed —
// unconditionally, no toggle. The forge-audio doc stays as this surface's own
// copy, carrying `memoId`/`memoStatus` as the reference into the archive.
//
// Two things make re-uploading safe:
//
//   1. FILES ARE KEYED BY THE MD5 OF THEIR BYTES. A recording already in the
//      batch is skipped (`duplicate:true`), never stored twice — so retrying
//      after a dropped connection tops the batch up instead of doubling it.
//   2. `seq` COMES FROM A TRANSACTION on the batch doc, not from counting the
//      collection. dropbox.js learned this the hard way: counting gave
//      concurrent uploads the same index and album order came out scrambled.
//
// One Firestore doc per RECORDING (collection `forge-audio`), bytes in Storage
// under `audio/<batch>/`, plus one doc per batch in `forge-audio-batches`
// holding its counter.
//
// Mounted at /api/audio by server.js, page at /audio. STUDIO_TOKEN-gated (only
// /status is open).
//
// Routes:
//   GET    /status                     → { ok, firebase, ffprobe }
//   GET    /batches                    → every batch, newest first
//   GET    /items?batch=&track=&limit= → the recordings, in batch order
//   GET    /items/:id
//   POST   /upload-file?batch=&filename=&name=   ONE recording as the RAW body
//                                      (what the page uses — no base64 inflation,
//                                      and the browser can report real progress)
//   POST   /upload                     → { batch, files:[{audio:dataURL|url,
//                                      filename?, name?}] } — the path for a chat
//   PATCH  /items/:id                  → name / notes / tags / track
//   DELETE /items/:id

const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = require('node-fetch');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const COL = 'forge-audio';
// One doc per batch, id = the batch slug, holding the seq allocator.
const BATCHES = 'forge-audio-batches';
const AUDIO_RE = /\.(m4a|mp3|wav|aac|aiff?|caf|ogg|oga|opus|flac|webm|amr|wma|mp4)$/i;

// Fields a client (the page, or a chat) may write. Everything else on the doc —
// url, storagePath, hash, bytes, seconds, createdAt — is server-owned.
const EDITABLE = ['name', 'notes', 'tags', 'track', 'status', 'seq', 'batch'];

let proxyAgent = null;
if (process.env.HTTPS_PROXY) {
  try {
    const { HttpsProxyAgent } = require('https-proxy-agent');
    proxyAgent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
  } catch { /* direct */ }
}

// ffprobe: static npm binary first (Render's stock Node image has none), then
// FFPROBE_PATH / anything on PATH. Same resolution as editor.js. Only used to
// read a recording's duration — a missing binary costs the `seconds` field and
// nothing else.
function tryRequire(name) { try { return require(name); } catch { return null; } }
function firstOnPath(bin) {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const p = path.join(dir, bin);
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { /* keep looking */ }
  }
  return null;
}
function usable(p) {
  if (!p) return null;
  try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { return null; }
}
const FFPROBE = process.env.FFPROBE_PATH
  || usable((tryRequire('ffprobe-static') || {}).path)
  || firstOnPath('ffprobe');

function db() {
  if (!admin.apps.length) throw new Error('firebase not configured');
  return admin.firestore();
}
function bucketOrNull() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}
function fail(res, err) {
  const msg = err && err.message ? err.message : String(err);
  res.status(msg.includes('not configured') ? 503 : 500).json({ error: msg });
}
function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 60);
}

function ctForName(name) {
  const n = String(name || '').toLowerCase();
  if (/\.mp3$/.test(n)) return 'audio/mpeg';
  if (/\.(m4a|mp4)$/.test(n)) return 'audio/mp4';
  if (/\.wav$/.test(n)) return 'audio/wav';
  if (/\.aac$/.test(n)) return 'audio/aac';
  if (/\.aiff?$/.test(n)) return 'audio/aiff';
  if (/\.caf$/.test(n)) return 'audio/x-caf';
  if (/\.og[ga]$/.test(n)) return 'audio/ogg';
  if (/\.opus$/.test(n)) return 'audio/opus';
  if (/\.flac$/.test(n)) return 'audio/flac';
  if (/\.webm$/.test(n)) return 'audio/webm';
  if (/\.amr$/.test(n)) return 'audio/amr';
  return 'audio/mpeg';
}
// The filename's own extension is the most reliable answer — iOS sends
// application/octet-stream for plenty of exports — so trust it first.
function extFor(filename, ct) {
  const m = AUDIO_RE.exec(String(filename || ''));
  if (m) return m[1].toLowerCase();
  const c = String(ct || '').toLowerCase();
  if (c.includes('mpeg') || c.includes('mp3')) return 'mp3';
  if (c.includes('mp4') || c.includes('m4a') || c.includes('aac')) return 'm4a';
  if (c.includes('wav')) return 'wav';
  if (c.includes('aiff')) return 'aiff';
  if (c.includes('caf')) return 'caf';
  if (c.includes('ogg')) return 'ogg';
  if (c.includes('opus')) return 'opus';
  if (c.includes('flac')) return 'flac';
  if (c.includes('webm')) return 'webm';
  return 'm4a';
}
function baseName(filename) {
  const f = String(filename || '').split('/').pop() || '';
  return f.replace(/\.[a-z0-9]{1,5}$/i, '')
    // The iOS share extension names every export `UUID() + originalFilename`
    // (see DumpShare/DumpUploader) — that staging id is not part of the
    // recording's name and read as "a weird code" on Sophie's list.
    .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[-_ ]*/i, '')
    .replace(/[_]+/g, ' ').trim() || null;
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args);
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(err.slice(-300)))));
  });
}

// How long is it? Nice to know before anything downstream spends money on it
// (whisper is priced by the minute), and it's what makes a list of eight
// recordings readable. Best-effort — a failure just leaves `seconds` null.
async function durationOf(buf, ext) {
  if (!FFPROBE) return null;
  const tmp = path.join(os.tmpdir(), `drop-${crypto.randomBytes(6).toString('hex')}.${ext}`);
  try {
    await fs.promises.writeFile(tmp, buf);
    const out = await run(FFPROBE, [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', tmp,
    ]);
    const d = parseFloat((JSON.parse(out).format || {}).duration || '0');
    return Number.isFinite(d) && d > 0 ? Math.round(d * 10) / 10 : null;
  } catch {
    return null;
  } finally {
    fs.promises.unlink(tmp).catch(() => {});
  }
}

// data: URL or http(s) URL → { buf, ct }
async function toBuffer(ref) {
  if (typeof ref !== 'string' || !ref) throw new Error('empty audio reference');
  if (ref.startsWith('data:')) {
    const comma = ref.indexOf(',');
    const semi = ref.indexOf(';');
    const ct = (semi > 5 ? ref.slice(5, semi) : 'audio/mpeg') || 'audio/mpeg';
    return { buf: Buffer.from(ref.slice(comma + 1), 'base64'), ct };
  }
  const r = await fetch(ref, { agent: proxyAgent || undefined });
  if (!r.ok) throw new Error(`fetch ${r.status} for ${ref.slice(0, 60)}`);
  return { buf: await r.buffer(), ct: r.headers.get('content-type') || 'audio/mpeg' };
}

// What's already in this batch, by content hash — so a re-send after a dropped
// connection fills the gaps instead of storing everything twice. One equality
// filter: no composite index to set up.

// The next position in the batch, allocated atomically. Counting the collection
// instead would hand two concurrent uploads the same number.
async function allocSeq(batch) {
  const ref = db().collection(BATCHES).doc(batch);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const next = (snap.exists ? Number(snap.get('count')) || 0 : 0) + 1;
    tx.set(ref, {
      batch,
      count: next,
      createdAt: (snap.exists && snap.get('createdAt')) || now,
      updatedAt: now,
    }, { merge: true });
    return next;
  });
}

async function storeOne({ bucket, batch, buf, ct, filename, name }) {
  if (!buf || !buf.length) throw new Error('empty audio file');
  const hash = crypto.createHash('md5').update(buf).digest('hex');

  // Dedupe by content across ALL batches (Aug 2026, verified live by Sophie:
  // the share sheet stamps a NEW batch per share, so the same recording sent
  // in two separate shares landed twice — the old per-batch check only caught
  // re-sends into one batch). A recording exists ONCE, whichever batch it
  // arrived in first; deleting it frees the hash for a genuine re-upload.
  const dup = await db().collection(COL).where('hash', '==', hash).limit(1).get();
  if (!dup.empty) return { id: dup.docs[0].id, ...dup.docs[0].data(), duplicate: true };

  const ext = extFor(filename, ct);
  const seq = await allocSeq(batch);
  const label = name || baseName(filename) || `Recording ${seq}`;
  // A readable storage path, because these urls get pasted into other tools by
  // hand — the hash lives on the doc, where the dedupe check reads it.
  const storagePath = `audio/${batch}/${String(seq).padStart(2, '0')}-`
    + `${slug(label) || 'recording'}.${ext}`;
  const file = bucket.file(storagePath);
  await file.save(buf, { metadata: { contentType: ct } });
  await file.makePublic();
  const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

  const now = Date.now();
  const doc = {
    batch,
    seq,
    name: label,
    url,
    storagePath,
    hash,
    filename: filename || null,
    mime: ct,
    ext,
    bytes: buf.length,
    seconds: await durationOf(buf, ext),
    notes: null,
    tags: [],
    track: null,          // what these are for — labelled later, never on arrival
    status: 'new',
    createdAt: now,
    updatedAt: now,
  };
  const ref = await db().collection(COL).add(doc);
  return { id: ref.id, ...doc };
}

function clean(patch) {
  const out = {};
  for (const k of EDITABLE) {
    if (!(k in patch)) continue;
    let v = patch[k];
    if (v === undefined) continue;
    if (k === 'seq') {
      v = v === null || v === '' ? null : Number(v);
      if (v !== null && !Number.isFinite(v)) continue;
    }
    if (k === 'tags') {
      v = Array.isArray(v) ? v.map(String)
        : String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (k === 'batch') v = slug(v) || 'default';
    out[k] = v;
  }
  return out;
}

const router = express.Router();

router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '120mb' }));

router.get('/status', (req, res) => {
  res.json({ ok: true, firebase: Boolean(bucketOrNull()), ffprobe: Boolean(FFPROBE) });
});

// GET /batches — what's been dropped so far, most recently touched first.
router.get('/batches', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const snap = await db().collection(COL).get();
    const byBatch = new Map();
    snap.forEach((d) => {
      const v = d.data();
      const b = v.batch || 'default';
      if (!byBatch.has(b)) byBatch.set(b, { batch: b, count: 0, seconds: 0, bytes: 0, updatedAt: 0 });
      const e = byBatch.get(b);
      e.count += 1;
      e.seconds += Number(v.seconds) || 0;
      e.bytes += Number(v.bytes) || 0;
      if ((v.updatedAt || 0) > e.updatedAt) e.updatedAt = v.updatedAt || 0;
    });
    const batches = [...byBatch.values()]
      .map((b) => ({ ...b, seconds: Math.round(b.seconds) }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    res.json({ count: batches.length, batches });
  } catch (e) { fail(res, e); }
});

// GET /items?batch=&track=&limit= — the recordings, in the order they arrived.
router.get('/items', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    let q = db().collection(COL);
    if (req.query.batch) q = q.where('batch', '==', slug(req.query.batch));
    const snap = await q.get();
    let items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    if (req.query.track) items = items.filter((i) => i.track === req.query.track);
    items.sort((a, b) => (a.batch || '').localeCompare(b.batch || '')
      || (a.seq || 0) - (b.seq || 0)
      || (a.createdAt || 0) - (b.createdAt || 0));
    if (req.query.limit) items = items.slice(0, Number(req.query.limit));
    res.json({ count: items.length, items });
  } catch (e) { fail(res, e); }
});

router.get('/items/:id', async (req, res) => {
  try {
    const d = await db().collection(COL).doc(req.params.id).get();
    if (!d.exists) return res.status(404).json({ error: 'not found' });
    res.json({ id: d.id, ...d.data() });
  } catch (e) { fail(res, e); }
});

// Whisper the recording in the BACKGROUND and write the words onto its doc.
// UNCONDITIONAL since Aug 2026 (Sophie: no transcribe toggle — every recording
// gets its words; the share sheet's ?transcribe param is ignored). House rule:
// the upload response never waits on this; clients read `transcript` /
// `transcribeStatus` off the doc later. Whisper's hard cap is 25MB, so bigger
// files record a clear error instead of a hung status. Returns the transcript
// (or null) so the memo-archive filing below can reuse it — the same audio is
// never paid for twice.
const WHISPER_CAP = 24 * 1024 * 1024;
async function transcribeItem(id, buf, ext) {
  const ref = db().collection(COL).doc(String(id));
  try {
    await ref.set({ transcribeStatus: 'transcribing', updatedAt: Date.now() }, { merge: true });
    const { transcribeAudio } = require('./movies');
    const t = await transcribeAudio(buf, 'recording.' + (ext || 'm4a'));
    await ref.set({
      transcript: String(t.text || ''),
      transcribeStatus: admin.firestore.FieldValue.delete(),
      transcribedAt: Date.now(),
      updatedAt: Date.now(),
    }, { merge: true });
    return String(t.text || '');
  } catch (e) {
    await ref.set({
      transcribeStatus: 'failed',
      transcribeError: String(e.message || e).slice(0, 300),
      updatedAt: Date.now(),
    }, { merge: true }).catch(() => {});
    return null;
  }
}

// Every NEW recording that lands here also files into the Voice Memo archive
// (memos.js — one library, Aug 2026). Runs in the background after the upload
// response: transcribe first (words onto this doc), then hand bytes +
// transcript to fileIntoArchive, which md5-dedupes — so a recording that
// already reached the archive by another path (the Mac push, a chat) lands
// once. The forge-audio doc keeps `memoId`/`memoStatus` as the reference back.
function enrichItem(item, buf) {
  if (!item || !item.id) return;
  if (item.duplicate) {
    // Already stored once — just top up missing words.
    if (!item.transcript && item.transcribeStatus !== 'transcribing'
        && process.env.OPENAI_API_KEY && buf.length <= WHISPER_CAP) {
      transcribeItem(item.id, buf, item.ext).catch(() => {});
    }
    return;
  }
  (async () => {
    const ref = db().collection(COL).doc(String(item.id));
    let transcript = item.transcript || null;
    if (!transcript) {
      if (!process.env.OPENAI_API_KEY) {
        await ref.set({ transcribeStatus: 'failed', transcribeError: 'OPENAI_API_KEY not configured' }, { merge: true }).catch(() => {});
      } else if (buf.length > WHISPER_CAP) {
        await ref.set({
          transcribeStatus: 'failed',
          transcribeError: 'file is over Whisper’s 25MB cap — transcribe it via a pipeline that chunks',
        }, { merge: true }).catch(() => {});
      } else {
        transcript = await transcribeItem(item.id, buf, item.ext);
      }
    }
    try {
      const memos = require('./memos');
      const r = await memos.fileIntoArchive({
        buf, ext: item.ext, title: item.name || '',
        dur: Math.round(item.seconds || 0),
        transcript, source: 'audio-drop',
      });
      await ref.set({
        memoId: (r.memo && r.memo.id) || null,
        memoStatus: r.skipped ? 'duplicate' : 'filed',
        updatedAt: Date.now(),
      }, { merge: true });
    } catch (e) {
      await ref.set({
        memoStatus: 'failed',
        memoError: String(e.message || e).slice(0, 300),
        updatedAt: Date.now(),
      }, { merge: true }).catch(() => {});
    }
  })().catch(() => {});
}

// POST /upload-file?batch=&filename=&name= — ONE recording as the raw request
// body. This is what the page and the share sheet use: no base64 inflating
// the file by a third, and XHR can report real upload progress on a phone
// connection. Transcription + memo-archive filing happen unconditionally in
// the background (the old ?transcribe toggle is ignored — Aug 2026).
router.post('/upload-file',
  express.raw({ type: () => true, limit: '300mb' }),
  async (req, res) => {
    try {
      if (!req.body || !req.body.length) {
        return res.status(400).json({ error: 'empty body — POST the file as the request body' });
      }
      const bucket = bucketOrNull();
      if (!bucket) return res.status(503).json({ error: 'Firebase Storage not configured' });

      const batch = slug(req.query.batch) || 'default';
      const filename = String(req.query.filename || '').trim();
      const name = String(req.query.name || '').trim();
      let ct = req.get('content-type') || '';
      if (!ct || /octet-stream/i.test(ct)) ct = ctForName(filename);

      const item = await storeOne({ bucket, batch, buf: req.body, ct, filename, name });
      const transcribing = !item.duplicate && !item.transcript
        && Boolean(process.env.OPENAI_API_KEY) && req.body.length <= WHISPER_CAP;
      enrichItem(item, req.body);
      res.json({ ok: true, batch, duplicate: Boolean(item.duplicate), transcribing, item });
    } catch (e) { fail(res, e); }
  });

// POST /upload — { batch, files:[{ audio: dataURL|httpURL, filename?, name? }] }.
// The path for a chat moving recordings in from somewhere else.
router.post('/upload', async (req, res) => {
  try {
    const b = req.body || {};
    const files = Array.isArray(b.files) ? b.files.filter(Boolean) : [];
    if (!files.length) return res.status(400).json({ error: 'files[] required' });
    const bucket = bucketOrNull();
    if (!bucket) return res.status(503).json({ error: 'Firebase Storage not configured' });

    const batch = slug(b.batch) || 'default';
    const items = [];
    for (const f of files) {
      const ref = typeof f === 'string' ? f : f.audio || f.url;
      const filename = (typeof f === 'object' && f.filename)
        || (typeof ref === 'string' && !ref.startsWith('data:') ? ref.split('/').pop() : '');
      const raw = await toBuffer(ref);
      const ct = /octet-stream/i.test(raw.ct) ? ctForName(filename) : raw.ct;
      const item = await storeOne({
        bucket, batch, buf: raw.buf, ct, filename,
        name: typeof f === 'object' ? f.name : '',
      });
      enrichItem(item, raw.buf);   // words + memo archive, in the background
      items.push(item);
    }
    res.json({
      ok: true,
      batch,
      count: items.length,
      added: items.filter((i) => !i.duplicate).length,
      skipped: items.filter((i) => i.duplicate).length,
      items,
    });
  } catch (e) { fail(res, e); }
});

// PATCH /items/:id — name it, note it, say what it's for.
router.patch('/items/:id', async (req, res) => {
  try {
    const patch = clean(req.body || {});
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to update' });
    patch.updatedAt = Date.now();
    const ref = db().collection(COL).doc(req.params.id);
    const before = await ref.get();
    if (!before.exists) return res.status(404).json({ error: 'not found' });
    await ref.set(patch, { merge: true });
    const after = await ref.get();
    res.json({ ok: true, item: { id: after.id, ...after.data() } });
  } catch (e) { fail(res, e); }
});

router.delete('/items/:id', async (req, res) => {
  try {
    const ref = db().collection(COL).doc(req.params.id);
    const d = await ref.get();
    if (!d.exists) return res.status(404).json({ error: 'not found' });
    const storagePath = d.get('storagePath');
    await ref.delete();
    // The doc is the record; a leftover object is harmless if this fails.
    if (storagePath) {
      const bucket = bucketOrNull();
      if (bucket) { try { await bucket.file(storagePath).delete(); } catch { /* already gone */ } }
    }
    res.json({ ok: true, deleted: req.params.id });
  } catch (e) { fail(res, e); }
});

module.exports = { router, COL, BATCHES, slug };
