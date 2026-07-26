// crystals.js — the crystal drop box.
//
// Sophie has a pile of crystal photos (some shot individually, some as a tray
// of many) that need to become Etsy listings. This module is the FIRST step of
// that: a place she can dump photos + whatever she knows about them, stored in
// Firebase, that a chat can then pull from to write listings, price them, build
// numbered pick-your-own grids, and run A/B tests.
//
// One Firestore doc per PHOTO (collection `forge-crystals`), image bytes in
// Storage under `crystals/<batch>/`.
//
// THE SHAPE THAT MATTERS: on Sophie's phone each crystal is its own Photos
// ALBUM holding several shots of that one stone — which is exactly one Etsy
// listing. So photos carry a `crystal` (the album's slug) + `crystalName`, and
// every photo of the same stone shares one `seq` — the crystal's number in a
// pick-your-own grid. `photoIndex` orders the shots within a crystal (0 is the
// cover). A photo with no `crystal` is a loose one and gets its own seq.
//
// `kind` is about what's in the FRAME, not the grouping: `single` = one crystal
// in the shot, `group` = a tray of several. Everything about the stone is
// optional and fillable later, from the /crystals page or by a chat — dumping
// the photo is never blocked on knowing anything about it.
//
// Mounted at /api/crystals by server.js. STUDIO_TOKEN-gated (only /status open).
//
// Routes:
//   GET    /status                → { ok, firebase }
//   GET    /batches               → [{ batch, count, crystals, statuses:{}, cover }]
//   GET    /crystals?batch=       → photos rolled up per crystal (the listing view)
//   POST   /upload                → { batch, images:[dataURL|url], crystal?, kind?, defaults? }
//   POST   /upload-zip?batch=&crystal=&kind=  (the raw .zip as the request body;
//                                     without ?crystal=, each FOLDER in the zip
//                                     becomes a crystal)
//   GET    /items?batch=&crystal=&status=&kind=&limit=  → { count, items:[...] }
//   GET    /items/:id             → one doc
//   PATCH  /items/:id             → update the fillable fields
//   PATCH  /group                 → { batch, crystal, ...fields } — update every
//                                   photo of one crystal at once (it's one listing)
//   DELETE /items/:id             → remove doc (and its Storage object)
//   DELETE /group?batch=&crystal= → remove a whole crystal

const express = require('express');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
let JSZip = null;
try { JSZip = require('jszip'); } catch { /* zip upload disabled */ }
let sharp = null;
try { sharp = require('sharp'); } catch { /* HEIC passes through unconverted */ }

const COL = 'forge-crystals';
const IMAGE_RE = /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif)$/i;

// Fields a client (the page, or a chat) may write. Everything else on the doc
// — url, storagePath, batch ordering, createdAt — is server-owned.
const EDITABLE = [
  'crystal',     // slug of the album/stone this photo belongs to
  'crystalName', // its display name ("Pink quartz")
  'photoIndex',  // order within the crystal (0 = cover shot)
  'kind',        // 'single' | 'group' — what's in the FRAME
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

// A snapshot of what a batch already holds, so a second dump continues the
// numbering instead of restarting it (a restart would break a grid overlay
// already built on the first dump) and re-uploading into an existing album
// lands in that same crystal.
async function batchState(batch) {
  const snap = await db().collection(COL).where('batch', '==', batch).get();
  let maxSeq = 0;
  const crystals = new Map(); // slug → { seq, name, photos }
  snap.forEach((d) => {
    const v = d.data();
    const s = Number(v.seq) || 0;
    if (s > maxSeq) maxSeq = s;
    if (v.crystal) {
      const e = crystals.get(v.crystal) || { seq: s, name: v.crystalName || v.crystal, photos: 0 };
      e.photos += 1;
      if (s) e.seq = s;
      crystals.set(v.crystal, e);
    }
  });
  return { maxSeq, crystals };
}

// Where does the next photo of `crystalName` go? Same album → same seq, next
// photoIndex. New album → a fresh seq. No album → a loose photo, own seq.
function placeIn(state, crystalName) {
  if (!crystalName) {
    state.maxSeq += 1;
    return { crystal: null, crystalName: null, seq: state.maxSeq, photoIndex: 0 };
  }
  const key = slug(crystalName) || 'unnamed';
  let e = state.crystals.get(key);
  if (!e) {
    state.maxSeq += 1;
    e = { seq: state.maxSeq, name: String(crystalName).slice(0, 80), photos: 0 };
    state.crystals.set(key, e);
  }
  const photoIndex = e.photos;
  e.photos += 1;
  return { crystal: key, crystalName: e.name, seq: e.seq, photoIndex };
}

// iPhone photos are HEIC, which Etsy won't take and most browsers can't show.
// Re-encode to JPEG at the ORIGINAL pixel dimensions — never resize, these are
// the listing photos.
async function normalize(buf, ct) {
  const isHeic = /heic|heif/i.test(ct || '');
  if (!isHeic || !sharp) return { buf, ct };
  try {
    const out = await sharp(buf).jpeg({ quality: 95 }).toBuffer();
    return { buf: out, ct: 'image/jpeg', converted: true };
  } catch {
    return { buf, ct }; // libheif can't decode it — keep the original bytes
  }
}

async function storeOne({ bucket, batch, buf, ct, filename, place, defaults }) {
  const { seq, crystal, crystalName, photoIndex } = place;
  const path = `crystals/${batch}/${crystal ? crystal + '/' : ''}`
    + `${seq}-${photoIndex}-${Date.now().toString(36)}`
    + `${Math.random().toString(36).slice(2, 6)}.${extFor(ct)}`;
  const file = bucket.file(path);
  await file.save(buf, { metadata: { contentType: ct } });
  await file.makePublic();
  const url = `https://storage.googleapis.com/${bucket.name}/${path}`;

  const now = Date.now();
  const doc = {
    batch,
    seq,
    crystal,
    crystalName,
    photoIndex,
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

// Work out which folder inside a zip names each crystal.
//
// Zipping in the Files app wraps everything in one folder, and how deep the
// albums sit depends on what she selected, so a fixed depth guesses wrong. We
// strip the common prefix every entry shares (the wrapper) and take the first
// folder that remains — that's the album:
//   Crystals/Pink quartz/a.jpg + Crystals/Selenite/b.jpg → "Pink quartz", "Selenite"
//   Pink quartz/a.jpg + Pink quartz/b.jpg                → "Pink quartz" (wrapper IS the album)
//   a.jpg + b.jpg                                        → no album, loose photos
function crystalNamer(names) {
  const parts = names.map((n) => n.split('/').filter(Boolean));
  let common = 0;
  if (parts.length) {
    const first = parts[0];
    // -1 so a file's own name can never count as a shared folder
    while (common < first.length - 1
      && parts.every((p) => p.length - 1 > common && p[common] === first[common])) common++;
  }
  return (name) => {
    const p = name.split('/').filter(Boolean);
    const dirs = p.slice(common, -1);       // folders below the wrapper
    if (dirs.length) return dirs[0];
    // Everything sat directly in the wrapper → the wrapper itself is the album.
    return common > 0 ? parts[0][common - 1] : '';
  };
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
      if (v.crystal) (e.seen || (e.seen = new Set())).add(v.crystal);
      e.statuses[v.status || 'new'] = (e.statuses[v.status || 'new'] || 0) + 1;
      if (!e.cover || (v.seq || 0) < e.coverSeq) { e.cover = v.url; e.coverSeq = v.seq || 0; }
      if ((v.updatedAt || 0) > e.updatedAt) e.updatedAt = v.updatedAt || 0;
    });
    const batches = [...byBatch.values()]
      .map(({ coverSeq, seen, ...b }) => ({ ...b, crystals: seen ? seen.size : 0 }))
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
    // `crystal` names the album these shots belong to — all of them are the
    // same stone, so they share a number and become one listing.
    const crystalName = typeof b.crystal === 'string' ? b.crystal.trim() : '';
    const state = await batchState(batch);

    const items = [];
    for (let i = 0; i < images.length; i++) {
      const raw = await toBuffer(images[i]);
      const { buf, ct } = await normalize(raw.buf, raw.ct);
      const filename = Array.isArray(b.filenames) ? b.filenames[i] : null;
      items.push(await storeOne({
        bucket, batch, buf, ct, filename, defaults,
        place: placeIn(state, crystalName),
      }));
    }
    res.json({ ok: true, batch, crystal: items[0] ? items[0].crystal : null, count: items.length, items });
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
    // ?crystal= forces the whole zip into one album; otherwise the zip's own
    // folders name the crystals — that's how a phone dump of "one album per
    // stone" arrives with its grouping intact.
    const forced = typeof req.query.crystal === 'string' ? req.query.crystal.trim() : '';
    const folderOf = forced ? () => forced : crystalNamer(entries.map((e) => e.name));

    const state = await batchState(batch);
    const items = [];
    for (const entry of entries) {
      // one at a time — never hold a whole camera roll in memory
      const raw = await entry.async('nodebuffer');
      const { buf, ct } = await normalize(raw, ctForName(entry.name));
      items.push(await storeOne({
        bucket, batch, buf, ct, filename: entry.name.split('/').pop(), defaults,
        place: placeIn(state, folderOf(entry.name)),
      }));
    }
    const crystals = [...new Set(items.map((i) => i.crystalName).filter(Boolean))];
    res.json({ ok: true, batch, count: items.length, crystals, items });
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
    if (req.query.crystal) items = items.filter((i) => i.crystal === slug(req.query.crystal));
    if (req.query.status) items = items.filter((i) => (i.status || 'new') === req.query.status);
    if (req.query.kind) items = items.filter((i) => (i.kind || 'single') === req.query.kind);
    items.sort(byPosition);
    if (req.query.limit) items = items.slice(0, Number(req.query.limit));
    res.json({ count: items.length, items });
  } catch (e) { fail(res, e); }
});

function byPosition(a, b) {
  return (a.batch || '').localeCompare(b.batch || '')
    || (a.seq || 0) - (b.seq || 0)
    || (a.photoIndex || 0) - (b.photoIndex || 0)
    || (a.createdAt || 0) - (b.createdAt || 0);
}

// GET /crystals?batch= — the LISTING view: one entry per stone, its photos
// nested. This is what a chat wants when writing listings, and what the page
// renders as tiles.
router.get('/crystals', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    let q = db().collection(COL);
    if (req.query.batch) q = q.where('batch', '==', slug(req.query.batch));
    const snap = await q.get();
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    items.sort(byPosition);

    const out = [];
    const index = new Map();
    for (const it of items) {
      // Loose photos (no album) each stand alone as their own crystal.
      const key = it.crystal || 'loose:' + it.id;
      if (!index.has(key)) {
        index.set(key, out.length);
        out.push({
          crystal: it.crystal || null,
          crystalName: it.crystalName || null,
          batch: it.batch,
          seq: it.seq || null,
          // The listing fields live on every photo of the stone; the cover
          // shot is the authority when they ever disagree.
          stone: it.stone, name: it.name, size: it.size, weightG: it.weightG,
          priceUsd: it.priceUsd, qty: it.qty, origin: it.origin, notes: it.notes,
          tags: it.tags || [], status: it.status || 'new', kind: it.kind || 'single',
          listingId: it.listingId, listingUrl: it.listingUrl,
          cover: it.url,
          photos: [],
        });
      }
      out[index.get(key)].photos.push({ id: it.id, url: it.url, photoIndex: it.photoIndex || 0 });
    }
    res.json({ count: out.length, photos: items.length, crystals: out });
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

// PATCH /group — { batch, crystal, ...fields }. A crystal is ONE listing, so
// its stone/price/tags/status belong to all of its photos at once.
router.patch('/group', async (req, res) => {
  try {
    const b = req.body || {};
    const batch = slug(b.batch);
    const crystal = slug(b.crystal);
    if (!batch || !crystal) return res.status(400).json({ error: 'batch and crystal required' });
    const patch = clean(b);
    // These identify the crystal — changing them here would silently re-key it.
    delete patch.batch; delete patch.crystal; delete patch.photoIndex;
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to update' });
    patch.updatedAt = Date.now();

    const snap = await db().collection(COL)
      .where('batch', '==', batch).get();
    const docs = snap.docs.filter((d) => d.get('crystal') === crystal);
    if (!docs.length) return res.status(404).json({ error: 'no photos for that crystal' });
    const writer = db().batch();
    docs.forEach((d) => writer.set(d.ref, patch, { merge: true }));
    await writer.commit();
    res.json({ ok: true, batch, crystal, updated: docs.length, patch });
  } catch (e) { fail(res, e); }
});

// DELETE /group?batch=&crystal= — drop a whole stone, photos and all.
router.delete('/group', async (req, res) => {
  try {
    const batch = slug(req.query.batch);
    const crystal = slug(req.query.crystal);
    if (!batch || !crystal) return res.status(400).json({ error: 'batch and crystal required' });
    const snap = await db().collection(COL).where('batch', '==', batch).get();
    const docs = snap.docs.filter((d) => d.get('crystal') === crystal);
    if (!docs.length) return res.status(404).json({ error: 'no photos for that crystal' });
    const bucket = bucketOrNull();
    for (const d of docs) {
      const path = d.get('storagePath');
      await d.ref.delete();
      if (path && bucket) { try { await bucket.file(path).delete(); } catch { /* already gone */ } }
    }
    res.json({ ok: true, deleted: docs.length });
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
