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
// Exported below the splitter so scripts/test-crystal-split.js can drive the
// pure part without Firebase.
module.exports.deriveStones = (...a) => deriveStones(...a);
module.exports.TREATMENTS = () => TREATMENTS;

// ---------------------------------------------------------------------------
// THE SPLITTER (Aug 2026)
//
// The crystal photos never came through /upload above — Sophie dumped them into
// the Dump instead (`forge-drops`, folder "Crystals": 15 albums, 629 photos +
// 33 videos). And the assumption this module was built on turned out to be
// wrong for most of them: an album is NOT one stone. Only two are ("Clear
// quartz cluster", "Selenite sphere"). The rest are catalogue runs — she shot
// one stone, moved to the next, and kept going, so a single album holds 20-50
// separate stones at 1-3 photos each.
//
// Which means the one fact that turns 629 photos into an inventory — where one
// stone stops and the next begins — exists nowhere. It can't be derived either:
// three consecutive frames of a yellow septarian are either one stone turned
// around or three different stones, and reading it wrong is not a cosmetic bug.
// It puts a number on a pick-your-own grid that two customers can buy.
//
// So this is the surface that asks HER, in the cheapest gesture that answers
// it: the album's photos in shooting order, one tap on any photo that starts a
// NEW stone. Everything between two marks is one stone, which is one listing.
//
// WHY MARKS ARE FILE IDS, NOT INDEXES: re-dumping an album tops it up and
// `photoIndex` is allocated per arrival, so an index-keyed split would silently
// re-point at different photos the next time she adds to an album. A file id is
// the photo. Same reason `names`/`treatment` key off the id of the stone's
// FIRST photo rather than its position.
//
// THE SPLIT NEVER TOUCHES THE DUMP'S OWN DATA. It is its own small doc per
// album (`forge-crystal-splits`, doc id = the bundle slug) and the photos are
// read live, so a split is always re-openable, re-editable, and throwing one
// away costs nothing but the taps. (The one thing written back onto a drop doc
// is `thumbUrl` — an additive display copy from scripts/crystal-thumbs.js, not
// a change to any grouping or label.)
//
// TILES SHOW `thumb`, NEVER `url`: a Dump photo is the full-resolution original
// (~3.7MB — correct, Etsy wants 2000px+) and an album is up to 100 of them, so
// a page pointed at the originals is a third of a gigabyte per album. Run
// scripts/crystal-thumbs.js after any new crystal dump.
//
// Routes (same STUDIO_TOKEN gate as the rest of the module):
//   GET   /split/albums          → every Crystals album + how far its split got
//   GET   /split/:bundle         → photos in order + the marks so far
//   POST  /split/:bundle         → { marks?, skip?, names?, treatment? }
//   GET   /split/:bundle/stones  → the derived stones (what a listing reads)

const DROPS = 'forge-drops';
const SPLITS = 'forge-crystal-splits';

// The Dump folder these live in. `track` is the Dump's folder field; Sophie
// filed them by hand as "Crystals".
const CRYSTAL_TRACK = 'Crystals';

// A stone is sold one of two ways (Sophie, Aug 2026) — its own listing, or a
// numbered slot in a pick-your-own grid. Chosen per stone, not per album.
const TREATMENTS = ['own', 'grid', 'skip'];

// Shooting order within an album. Same ordering the Dump itself uses, minus
// the cross-album parts — inside one album `photoIndex` is the shot order and
// `createdAt` breaks ties for anything dumped before the transaction fix.
function byShot(a, b) {
  return (a.photoIndex || 0) - (b.photoIndex || 0)
    || (a.createdAt || 0) - (b.createdAt || 0);
}

// Every file of one album, in the order she shot them. ONE equality filter
// (`bundle`) so no composite index is needed — the rest is sorted in memory,
// the house rule.
async function albumPhotos(bundle) {
  const snap = await db().collection(DROPS).where('bundle', '==', slug(bundle)).get();
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
  items.sort(byShot);
  return items;
}

async function readSplit(bundle) {
  const d = await db().collection(SPLITS).doc(slug(bundle)).get();
  const v = d.exists ? d.data() : {};
  return {
    marks: Array.isArray(v.marks) ? v.marks : [],
    skip: Array.isArray(v.skip) ? v.skip : [],
    names: v.names && typeof v.names === 'object' ? v.names : {},
    treatment: v.treatment && typeof v.treatment === 'object' ? v.treatment : {},
    updatedAt: v.updatedAt || null,
  };
}

// Cut the ordered photo list at every mark. The first photo always starts a
// stone whether or not it carries a mark — an album's opening shot is by
// definition the first stone, and requiring a tap there would make "no taps
// yet" and "one stone" indistinguishable.
//
// Skipped photos (group shots, the tray at the end, a lightbox test, a sticker
// close-up she took to read a weight) belong to no stone but must NOT split
// one: a photo dropped out of the middle of a run leaves that run intact.
function deriveStones(photos, split) {
  const marks = new Set(split.marks || []);
  const skip = new Set(split.skip || []);
  const stones = [];
  let cur = null;
  for (const p of photos) {
    if (skip.has(p.id)) continue;
    if (!cur || marks.has(p.id)) {
      cur = { startId: p.id, photos: [], videos: 0 };
      stones.push(cur);
    }
    if ((p.media || 'image') === 'video') cur.videos += 1;
    cur.photos.push({
      id: p.id, url: p.url, media: p.media || 'image',
      thumb: p.thumbUrl || p.posterUrl || p.url,
      posterUrl: p.posterUrl || null,
    });
  }
  return stones.map((s, i) => ({
    n: i + 1,                       // its number in a pick-your-own grid
    startId: s.startId,
    name: split.names[s.startId] || '',
    treatment: TREATMENTS.includes(split.treatment[s.startId])
      ? split.treatment[s.startId] : '',
    cover: (s.photos.find((p) => p.media !== 'video') || s.photos[0] || {}).url || null,
    photoCount: s.photos.length - s.videos,
    videoCount: s.videos,
    photos: s.photos,
    // Etsy wants 5-10 images on a listing. Below that a stone can still take a
    // numbered grid slot (one good shot is enough there) but not its own
    // listing — which is exactly the re-shoot list, derived rather than typed.
    enoughForOwnListing: s.photos.length - s.videos >= 5,
  }));
}

// GET /split/albums — the picker: every Crystals album with its split progress.
router.get('/split/albums', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const snap = await db().collection(DROPS).where('track', '==', CRYSTAL_TRACK).get();
    const byBundle = new Map();
    snap.forEach((d) => {
      const it = { id: d.id, ...d.data() };
      const key = it.bundle || ('loose:' + it.id);
      if (!byBundle.has(key)) {
        byBundle.set(key, {
          bundle: it.bundle || null, bundleName: it.bundleName || null,
          seq: it.seq || 0, cover: it.posterUrl || it.url,
          photos: 0, videos: 0, newest: 0,
        });
      }
      const b = byBundle.get(key);
      if ((it.media || 'image') === 'video') b.videos += 1; else b.photos += 1;
      if ((Number(it.createdAt) || 0) > b.newest) b.newest = Number(it.createdAt) || 0;
    });
    const albums = [...byBundle.values()].filter((a) => a.bundle);
    // Split docs are small; read them all rather than one round trip per album.
    const splits = await db().collection(SPLITS).get();
    const splitBy = new Map();
    splits.forEach((d) => splitBy.set(d.id, d.data()));
    for (const a of albums) {
      const s = splitBy.get(a.bundle);
      a.marks = s && Array.isArray(s.marks) ? s.marks.length : 0;
      a.skipped = s && Array.isArray(s.skip) ? s.skip.length : 0;
      a.started = Boolean(s);
      // Marks + the implied first stone, less anything skipped outright.
      a.stones = a.started ? a.marks + 1 : 0;
      a.updatedAt = (s && s.updatedAt) || null;
    }
    albums.sort((x, y) => (x.seq || 0) - (y.seq || 0));
    res.json({ count: albums.length, albums });
  } catch (e) { fail(res, e); }
});

// GET /split/:bundle — the album to split: photos in shooting order + marks.
router.get('/split/:bundle', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const photos = await albumPhotos(req.params.bundle);
    if (!photos.length) return res.status(404).json({ error: 'no such album' });
    const split = await readSplit(req.params.bundle);
    res.json({
      bundle: slug(req.params.bundle),
      bundleName: photos[0].bundleName || null,
      // `thumb` is what tiles render; `url` stays the full-resolution original
      // for the lightbox and, later, the listing itself.
      photos: photos.map((p) => ({
        id: p.id, url: p.url, media: p.media || 'image',
        thumb: p.thumbUrl || p.posterUrl || p.url,
        posterUrl: p.posterUrl || null,
      })),
      thumbsMissing: photos.filter((p) => (p.media || 'image') !== 'video' && !p.thumbUrl).length,
      ...split,
      stones: deriveStones(photos, split),
    });
  } catch (e) { fail(res, e); }
});

// POST /split/:bundle — save the marking. The page sends the WHOLE state (it's
// a few hundred ids at most), so this is a set-with-merge rather than a diff:
// one tap can't half-apply, and a reload always shows what she last saw.
router.post('/split/:bundle', async (req, res) => {
  try {
    const bundle = slug(req.params.bundle);
    const body = req.body || {};
    const patch = { bundle, updatedAt: Date.now() };
    const ids = (v) => (Array.isArray(v) ? v.map(String).slice(0, 2000) : null);
    if (ids(body.marks)) patch.marks = ids(body.marks);
    if (ids(body.skip)) patch.skip = ids(body.skip);
    // names/treatment are keyed by a stone's first-photo id; keep only sane
    // entries so a client bug can't fill the doc with junk.
    if (body.names && typeof body.names === 'object') {
      const n = {};
      for (const [k, v] of Object.entries(body.names)) {
        if (String(v || '').trim()) n[String(k)] = String(v).trim().slice(0, 80);
      }
      patch.names = n;
    }
    if (body.treatment && typeof body.treatment === 'object') {
      const t = {};
      for (const [k, v] of Object.entries(body.treatment)) {
        if (TREATMENTS.includes(v)) t[String(k)] = v;
      }
      patch.treatment = t;
    }
    await db().collection(SPLITS).doc(bundle).set(patch, { merge: true });
    const photos = await albumPhotos(bundle);
    const split = await readSplit(bundle);
    res.json({ ok: true, bundle, stones: deriveStones(photos, split) });
  } catch (e) { fail(res, e); }
});

// GET /split/:bundle/stones — just the derived stones. What a listing writer,
// a grid builder or a re-shoot list reads; no photo payload for the album.
router.get('/split/:bundle/stones', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const photos = await albumPhotos(req.params.bundle);
    if (!photos.length) return res.status(404).json({ error: 'no such album' });
    const stones = deriveStones(photos, await readSplit(req.params.bundle));
    res.json({
      bundle: slug(req.params.bundle),
      bundleName: photos[0].bundleName || null,
      count: stones.length,
      needReshoot: stones.filter((s) => !s.enoughForOwnListing && s.treatment === 'own').length,
      stones,
    });
  } catch (e) { fail(res, e); }
});
