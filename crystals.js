// crystals.js — the crystal drop box.
//
// Sophie has a pile of crystal photos (some shot individually, some as a tray
// of many) that need to become Etsy listings. This module is the FIRST step of
// that: a place she can dump photos + whatever she knows about them, stored in
// Firebase, that a chat can then pull from to write listings, price them, build
// numbered pick-your-own grids, and run A/B tests.
//
// One Firestore doc per PHOTO (collection `forge-crystals`), image bytes in
// Storage under `crystals/<batch>/`. A photo is either `single` (one crystal,
// the pick-your-own case — it gets a number) or `group` (a tray of several in
// one shot). Everything about the stone is optional and fillable later, from
// the /crystals page or by a chat via PATCH — dumping the photo is never
// blocked on knowing anything about it.
//
// Mounted at /api/crystals by server.js. STUDIO_TOKEN-gated (only /status open).
//
// Routes:
//   GET    /status                → { ok, firebase }
//   GET    /batches               → [{ batch, count, statuses:{}, cover }]
//   POST   /upload                → { batch, images:[dataURL|url], kind?, defaults? }
//   POST   /upload-zip?batch=&kind=  (the raw .zip as the request body)
//   GET    /items?batch=&status=&kind=&limit=  → { count, items:[...] }
//   GET    /items/:id             → one doc
//   PATCH  /items/:id             → update the fillable fields
//   DELETE /items/:id             → remove doc (and its Storage object)

const express = require('express');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
let JSZip = null;
try { JSZip = require('jszip'); } catch { /* zip upload disabled */ }

const COL = 'forge-crystals';
const IMAGE_RE = /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif)$/i;

// Fields a client (the page, or a chat) may write. Everything else on the doc
// — url, storagePath, batch ordering, createdAt — is server-owned.
const EDITABLE = [
  'kind',        // 'single' | 'group'
  'count',       // how many crystals are in a `group` photo
  'name',        // what she calls it ("the big amethyst point")
  'stone',       // crystal type: amethyst, citrine, …
  'size',        // free text: "2 inch", "palm size"
  'weightG',
  'priceUsd',
  'qty',
  'origin',
  'notes',       // anything at all — this is the dump field
  'tags',        // string[]
  'status',      // 'new' | 'ready' | 'listed' | 'sold' | 'skip'
  'listingId',
  'listingUrl',
  'gridUrl',     // numbered-overlay render, once one exists
  'gridCols',
  'gridRows',
  'batch',
  'seq',         // position within the batch = the pick-your-own number
];

let proxyAgent = null;
if (process.env.HTTPS_PROXY) {
  try {
    const { HttpsProxyAgent } = require('https-proxy-agent');
    proxyAgent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
  } catch { /* direct */ }
}

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
    .replace(/^-+|-+$/g, '').slice(0, 40);
}

function ctForName(name) {
  const n = String(name || '').toLowerCase();
  if (/\.jpe?g$/.test(n)) return 'image/jpeg';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.gif')) return 'image/gif';
  if (/\.hei[cf]$/.test(n)) return 'image/heic';
  return 'image/png';
}
function extFor(ct) {
  const c = String(ct || '');
  if (c.includes('webp')) return 'webp';
  if (c.includes('jpeg') || c.includes('jpg')) return 'jpg';
  if (c.includes('heic') || c.includes('heif')) return 'heic';
  return 'png';
}

// data: URL or http(s) URL → { buf, ct }
async function toBuffer(ref) {
  if (typeof ref !== 'string' || !ref) throw new Error('empty image reference');
  if (ref.startsWith('data:')) {
    const comma = ref.indexOf(',');
    const semi = ref.indexOf(';');
    const ct = (semi > 5 ? ref.slice(5, semi) : 'image/png') || 'image/png';
    return { buf: Buffer.from(ref.slice(comma + 1), 'base64'), ct };
  }
  const r = await fetch(ref, {
    agent: proxyAgent || undefined,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!r.ok) throw new Error(`fetch ${r.status} for ${ref.slice(0, 60)}`);
  return { buf: await r.buffer(), ct: r.headers.get('content-type') || 'image/png' };
}

// Next free `seq` in a batch. seq is the crystal's number in a pick-your-own
// grid, so it has to be stable and gap-free-ish across separate uploads.
async function nextSeq(batch) {
  const snap = await db().collection(COL).where('batch', '==', batch).get();
  let max = 0;
  snap.forEach((d) => { const s = Number(d.get('seq')) || 0; if (s > max) max = s; });
  return max + 1;
}

async function storeOne({ bucket, batch, buf, ct, filename, seq, defaults }) {
  const path = `crystals/${batch}/${seq}-${Date.now().toString(36)}`
    + `${Math.random().toString(36).slice(2, 6)}.${extFor(ct)}`;
  const file = bucket.file(path);
  await file.save(buf, { metadata: { contentType: ct } });
  await file.makePublic();
  const url = `https://storage.googleapis.com/${bucket.name}/${path}`;

  const now = Date.now();
  const doc = {
    batch,
    seq,
    url,
    storagePath: path,
    filename: filename || null,
    bytes: buf.length,
    kind: 'single',
    status: 'new',
    name: null,
    stone: null,
    size: null,
    weightG: null,
    priceUsd: null,
    qty: 1,
    origin: null,
    notes: null,
    tags: [],
    count: null,
    listingId: null,
    listingUrl: null,
    gridUrl: null,
    createdAt: now,
    updatedAt: now,
    ...clean(defaults || {}),
  };
  const ref = await db().collection(COL).add(doc);
  return { id: ref.id, ...doc };
}

// Keep only writable keys, drop undefined, coerce the numeric ones.
function clean(patch) {
  const out = {};
  for (const k of EDITABLE) {
    if (!(k in patch)) continue;
    let v = patch[k];
    if (v === undefined) continue;
    if (['count', 'weightG', 'priceUsd', 'qty', 'gridCols', 'gridRows', 'seq'].includes(k)) {
      v = v === null || v === '' ? null : Number(v);
      if (v !== null && !Number.isFinite(v)) continue;
    }
    if (k === 'tags') v = Array.isArray(v) ? v.map(String) : String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
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
// Photos from a phone are big; the page downscales before sending but a batch
// of ten still adds up.
router.use(express.json({ limit: '120mb' }));

router.get('/status', (req, res) => {
  res.json({ ok: true, firebase: Boolean(bucketOrNull()), zip: Boolean(JSZip) });
});

// GET /batches — what's been dumped so far, newest batch first.
router.get('/batches', async (req, res) => {
  try {
    const snap = await db().collection(COL).get();
    const byBatch = new Map();
    snap.forEach((d) => {
      const v = d.data();
      const b = v.batch || 'default';
      if (!byBatch.has(b)) {
        byBatch.set(b, { batch: b, count: 0, statuses: {}, cover: null, updatedAt: 0 });
      }
      const e = byBatch.get(b);
      e.count += 1;
      e.statuses[v.status || 'new'] = (e.statuses[v.status || 'new'] || 0) + 1;
      if (!e.cover || (v.seq || 0) < e.coverSeq) { e.cover = v.url; e.coverSeq = v.seq || 0; }
      if ((v.updatedAt || 0) > e.updatedAt) e.updatedAt = v.updatedAt || 0;
    });
    const batches = [...byBatch.values()]
      .map(({ coverSeq, ...b }) => b)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    res.json({ count: batches.length, batches });
  } catch (e) { fail(res, e); }
});

// POST /upload — { batch, images:[dataURL|httpURL], kind?, defaults? }
router.post('/upload', async (req, res) => {
  try {
    const b = req.body || {};
    const images = Array.isArray(b.images) ? b.images.filter(Boolean) : [];
    if (!images.length) return res.status(400).json({ error: 'images[] required (data URLs or http URLs)' });
    const bucket = bucketOrNull();
    if (!bucket) return res.status(503).json({ error: 'Firebase Storage not configured' });

    const batch = slug(b.batch) || 'default';
    const defaults = { ...clean(b.defaults || {}) };
    if (b.kind) defaults.kind = b.kind === 'group' ? 'group' : 'single';
    let seq = await nextSeq(batch);

    const items = [];
    for (let i = 0; i < images.length; i++) {
      const { buf, ct } = await toBuffer(images[i]);
      const filename = Array.isArray(b.filenames) ? b.filenames[i] : null;
      items.push(await storeOne({ bucket, batch, buf, ct, filename, seq: seq++, defaults }));
    }
    res.json({ ok: true, batch, count: items.length, items });
  } catch (e) { fail(res, e); }
});

// POST /upload-zip?batch=&kind= — the whole .zip as the raw request body, so a
// bulk export off her camera roll uploads in one shot from the phone.
router.post('/upload-zip', express.raw({ type: () => true, limit: '256mb' }), async (req, res) => {
  try {
    if (!JSZip) return res.status(501).json({ error: 'jszip not installed' });
    if (!req.body || !req.body.length) {
      return res.status(400).json({ error: 'empty body — POST the .zip file as the request body' });
    }
    const bucket = bucketOrNull();
    if (!bucket) return res.status(503).json({ error: 'Firebase Storage not configured' });

    let zip;
    try { zip = await JSZip.loadAsync(req.body); }
    catch (e) { return res.status(400).json({ error: 'not a valid zip file: ' + e.message }); }
    const entries = Object.values(zip.files)
      .filter((f) => !f.dir && IMAGE_RE.test(f.name) && !/(^|\/)__MACOSX\//.test(f.name))
      // Zip order is arbitrary; filename order is what she'd expect the
      // numbering to follow.
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!entries.length) return res.status(400).json({ error: 'no images found in the zip' });

    const batch = slug(req.query.batch) || 'default';
    const defaults = req.query.kind === 'group' ? { kind: 'group' } : {};
    let seq = await nextSeq(batch);
    const items = [];
    for (const entry of entries) {
      // one at a time — never hold a whole camera roll in memory
      const buf = await entry.async('nodebuffer');
      items.push(await storeOne({
        bucket, batch, buf, ct: ctForName(entry.name),
        filename: entry.name.split('/').pop(), seq: seq++, defaults,
      }));
    }
    res.json({ ok: true, batch, count: items.length, items });
  } catch (e) { fail(res, e); }
});

// GET /items?batch=&status=&kind=&limit=
router.get('/items', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    // Single equality filter only, then sort in memory — keeps this free of
    // composite-index setup, and the collection is a few hundred docs.
    let q = db().collection(COL);
    if (req.query.batch) q = q.where('batch', '==', slug(req.query.batch));
    const snap = await q.get();
    let items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    if (req.query.status) items = items.filter((i) => (i.status || 'new') === req.query.status);
    if (req.query.kind) items = items.filter((i) => (i.kind || 'single') === req.query.kind);
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

// PATCH /items/:id — fill in anything she (or a chat) knows.
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
    const path = d.get('storagePath');
    await ref.delete();
    // The doc is the record; a leftover blob is harmless if this fails.
    if (path) {
      const bucket = bucketOrNull();
      if (bucket) { try { await bucket.file(path).delete(); } catch { /* already gone */ } }
    }
    res.json({ ok: true, deleted: req.params.id });
  } catch (e) { fail(res, e); }
});

module.exports = { router, COL, slug };
