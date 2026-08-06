// Freeform — your own images, your own words, nothing added.
//
// Every other image surface in here wraps what you type in a house style: the
// Playground prepends a style prefix and attaches a fixed reference, the Scratch
// Pad locks one style per story, the passport paints pastel. This module is the
// one with NO opinion. You upload whatever reference images you want, you type
// whatever you want, you pick low/medium/high, and that is EXACTLY what goes to
// the model — no prefix, no suffix, no trigger word, no trailing-period trim.
// If the prompt should say something about style, you say it.
//
// That rule matters enough to be load-bearing: the "if you add anything to a
// prompt Sophie gave, tell her" rule in CLAUDE.md exists because a "plain" run
// once shipped with invented style language in it. Here there is nothing to
// disclose, because the module cannot add a word. `promptSent` is stored on
// every run so the page can prove it.
//
// Refs are a LIBRARY, not a per-run upload: an image you upload once can be
// attached to any later run (and to several at a time), because the whole point
// is trying the same references against different words.
//
// Rendering is a BACKGROUND JOB (house rule — nothing slow blocks a request):
// POST returns an id, the page polls and resumes on return, and the result is
// persisted so leaving the app never loses an image already paid for.
const express = require('express');
const admin = require('firebase-admin');

const router = express.Router();
const RUNS = 'forge-freeform';
const REFS = 'forge-freeform-refs';

// gpt-image-2's own sizes. Anything else is refused by the API, so the page
// picks from these three rather than accepting free text.
const SIZES = {
  square: '1024x1024',
  portrait: '1024x1536',
  landscape: '1536x1024',
};
const QUALITIES = ['low', 'medium', 'high'];
// Roughly what a single image costs at each tier — shown on the page so a
// `high` run is a deliberate choice rather than a surprise.
const COST = { low: 0.02, medium: 0.06, high: 0.25 };

const MAX_PROMPT = 4000;
const MAX_REFS = 12;                // the edits endpoint accepts up to 16 images
const MAX_OUTPUTS = 4;

const db = () => admin.firestore();
const bucket = () => admin.storage().bucket();

router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
// Reference images arrive as data URLs, so the body can be large.
router.use(express.json({ limit: '60mb' }));

async function put(buf, path, contentType) {
  const file = bucket().file(path);
  await file.save(buf, { metadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' }, resumable: false });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket().name}/${path}`;
}

// A 1024-square page showing a dozen references would be megabytes of PNG, so
// every ref carries a small webp display copy (same reasoning as the webp rule
// for the school art). The full-size original is what's sent to the model.
async function thumbOf(buf, path) {
  try {
    const sharp = require('sharp');
    const webp = await sharp(buf).resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer();
    return await put(webp, path, 'image/webp');
  } catch (e) { return null; }
}

function decodeImage(input) {
  const s = String(input || '');
  const m = s.match(/^data:(image\/[a-z.+-]+);base64,(.+)$/i);
  if (!m) return null;
  return { buf: Buffer.from(m[2], 'base64'), mime: m[1] };
}

async function fetchBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`could not fetch reference (${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}

// The model call. `prompt` is passed through untouched — this function is
// deliberately the only place a prompt could be modified, and it doesn't.
async function draw(prompt, refBuffers, { quality, size }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  const fd = new FormData();
  fd.append('model', 'gpt-image-2');
  fd.append('prompt', prompt);
  fd.append('size', size);
  fd.append('quality', quality);
  fd.append('n', '1');
  for (const [i, b] of refBuffers.entries()) {
    fd.append('image[]', new Blob([b], { type: 'image/png' }), `ref${i + 1}.png`);
  }
  // With no references at all this is a plain generation, not an edit — the
  // edits endpoint requires an image, so the two are genuinely different calls.
  const url = refBuffers.length
    ? 'https://api.openai.com/v1/images/edits'
    : 'https://api.openai.com/v1/images/generations';
  let body = fd;
  let headers = { authorization: 'Bearer ' + key };
  if (!refBuffers.length) {
    body = JSON.stringify({ model: 'gpt-image-2', prompt, size, quality, n: 1, output_format: 'webp' });
    headers = { authorization: 'Bearer ' + key, 'content-type': 'application/json' };
  }
  const r = await fetch(url, { method: 'POST', headers, body });
  const d = await r.json();
  if (d.error) throw new Error(String(d.error.message || d.error.code || 'image failed').slice(0, 300));
  if (!d.data || !d.data[0] || !d.data[0].b64_json) throw new Error('no image returned');
  return Buffer.from(d.data[0].b64_json, 'base64');
}

// Fire-and-forget: the request has already been answered by the time this runs.
// Each output lands on the doc as it finishes, so the grid fills in as they
// arrive and one failed call costs its image, not the run.
async function render(id, { prompt, refUrls, quality, size, outputs }) {
  const doc = db().collection(RUNS).doc(id);
  try {
    const buffers = [];
    for (const u of refUrls) buffers.push(await fetchBuffer(u));
    const images = [];
    let firstErr = null;
    await Promise.all(Array.from({ length: outputs }, (_, i) => (async () => {
      try {
        const buf = await draw(prompt, buffers, { quality, size });
        const url = await put(buf, `freeform/out/${id}-${i + 1}.webp`, 'image/webp');
        images.push(url);
        await doc.set({ images, status: 'ready' }, { merge: true });
      } catch (e) { firstErr = firstErr || e; }
    })()));
    if (!images.length) throw firstErr || new Error('no images produced');
    await doc.set({ status: 'done', images, finishedAt: Date.now() }, { merge: true });
  } catch (e) {
    await doc.set({ status: 'failed', error: String(e.message || e).slice(0, 400), finishedAt: Date.now() },
      { merge: true }).catch(() => {});
  }
}

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    openai: !!process.env.OPENAI_API_KEY,
    firebase: !!admin.apps.length,
    sizes: Object.keys(SIZES),
    qualities: QUALITIES,
    cost: COST,
  });
});

// ── Reference library ──────────────────────────────────────────────────────
// POST /refs { images:[dataURL|https url], name? } — add references.
router.post('/refs', async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'storage unavailable' });
    const list = Array.isArray(req.body && req.body.images) ? req.body.images : [];
    if (!list.length) return res.status(400).json({ error: 'images required' });
    const out = [];
    for (const item of list.slice(0, 40)) {
      try {
        const src = typeof item === 'string' ? item : (item && item.image);
        const name = String((item && item.name) || (req.body && req.body.name) || '').slice(0, 120);
        let buf, mime;
        const dec = decodeImage(src);
        if (dec) { buf = dec.buf; mime = dec.mime; }
        else if (/^https?:\/\//.test(String(src))) { buf = await fetchBuffer(String(src)); mime = 'image/png'; }
        else { out.push({ ok: false, error: 'not an image' }); continue; }
        const ref = db().collection(REFS).doc();
        const ext = (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
        const url = await put(buf, `freeform/refs/${ref.id}.${ext}`, mime);
        const thumb = await thumbOf(buf, `freeform/refs/${ref.id}-512.webp`);
        const doc = { url, thumb, name, bytes: buf.length, createdAt: Date.now() };
        await ref.set(doc);
        out.push({ ok: true, id: ref.id, ...doc });
      } catch (e) { out.push({ ok: false, error: String(e.message || e).slice(0, 200) }); }
    }
    res.json({ ok: true, refs: out });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

router.get('/refs', async (req, res) => {
  try {
    const snap = await db().collection(REFS).get();
    const refs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    res.json({ ok: true, refs });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

router.patch('/refs/:id', async (req, res) => {
  try {
    const name = String((req.body && req.body.name) || '').slice(0, 120);
    await db().collection(REFS).doc(String(req.params.id)).set({ name }, { merge: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

// Removing a reference drops the record; the bytes stay, because a finished run
// still points at them and its history must not turn into a broken image.
router.delete('/refs/:id', async (req, res) => {
  try {
    await db().collection(REFS).doc(String(req.params.id)).delete();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

// ── Runs ───────────────────────────────────────────────────────────────────
// POST /run { prompt, refs:[id|url], quality, size, outputs }
router.post('/run', async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'storage unavailable' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'image generation unavailable' });
    const b = req.body || {};
    const prompt = String(b.prompt || '').slice(0, MAX_PROMPT);
    if (!prompt.trim()) return res.status(400).json({ error: 'prompt required' });
    const quality = QUALITIES.includes(b.quality) ? b.quality : 'medium';
    const size = SIZES[b.size] || (Object.values(SIZES).includes(b.size) ? b.size : SIZES.portrait);
    const outputs = Math.min(Math.max(Number(b.outputs) || 1, 1), MAX_OUTPUTS);

    // Refs may be library ids or plain urls; resolve ids to their stored url.
    const wanted = (Array.isArray(b.refs) ? b.refs : []).slice(0, MAX_REFS).map(String);
    const refUrls = [];
    const refIds = [];
    for (const r of wanted) {
      if (/^https?:\/\//.test(r)) { refUrls.push(r); continue; }
      const snap = await db().collection(REFS).doc(r).get();
      if (snap.exists && snap.data().url) { refUrls.push(snap.data().url); refIds.push(r); }
    }

    const ref = db().collection(RUNS).doc();
    const doc = {
      prompt,
      // What was actually sent, byte for byte. This module adds nothing, so the
      // two are identical by construction — it is stored anyway so the page can
      // show it and any later reader can verify that for themselves.
      promptSent: prompt,
      refs: refUrls, refIds, quality, size, outputs,
      model: 'gpt-image-2', status: 'drawing', images: [], createdAt: Date.now(),
    };
    await ref.set(doc);
    render(ref.id, { prompt, refUrls, quality, size, outputs });   // deliberately not awaited
    res.json({ ok: true, id: ref.id, status: 'drawing', poll: `/api/freeform/run/${ref.id}` });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

router.get('/runs', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 200);
    const snap = await db().collection(RUNS).get();
    const runs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, limit);
    res.json({ ok: true, runs });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

router.get('/run/:id', async (req, res) => {
  try {
    const doc = await db().collection(RUNS).doc(String(req.params.id)).get();
    if (!doc.exists) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true, id: doc.id, ...doc.data() });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

router.delete('/run/:id', async (req, res) => {
  try {
    await db().collection(RUNS).doc(String(req.params.id)).delete();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 200) }); }
});

module.exports = { router, SIZES, QUALITIES };
