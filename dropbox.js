// dropbox.js — the Dump. One inbox for anything Sophie wants off her phone.
//
// The rule this is built around: DUMP FIRST, LABEL AFTERWARDS. Dropping
// something in asks no questions — no type, no name, no fields. The only
// structure captured at dump time is the one that's free then and expensive to
// reconstruct later:
//
//   bundle  — what arrived together. On the phone that's a Photos ALBUM (she
//             already names her albums, so the name comes across for free); in
//             a zip it's a folder; from the share sheet it's one share action.
//             For crystals a bundle is one stone = one Etsy listing. For story
//             art it might be a scene. What a bundle MEANS is decided later.
//   session — the dump itself, stamped with a date, so "the stuff I uploaded
//             today that had crystals in it" is answerable later.
//
// `track` (crystals / story-art / …) is deliberately NULL on arrival. Labelling
// is a separate pass — by her, or by a chat reading the inbox and proposing
// labels she confirms. Everything else on the doc is optional forever.
//
// One Firestore doc per FILE (collection `forge-drops`), bytes in Storage under
// `drops/<session>/<bundle>/`. Images and videos both — a lot of what she wants
// to dump is little clips.
//
// Mounted at /api/drop by server.js. STUDIO_TOKEN-gated (only /status open).
//
// Routes:
//   GET    /status                    → { ok, firebase, video }
//   GET    /sessions                  → recent dumps, newest first
//   GET    /bundles?session=&track=   → the inbox view: files rolled up per bundle
//   GET    /items?…                   → flat file list
//   GET    /items/:id
//   POST   /upload                    → { session?, bundle?, images:[dataURL|url], … }
//   POST   /upload-file?session=&bundle=&filename=&media=   (RAW body — the path
//                       iOS uses, because a background URLSession must upload
//                       from a file, and base64 would inflate a clip by a third)
//   POST   /upload-zip?session=&bundle=                     (raw .zip body)
//   PATCH  /items/:id                 → label one file
//   PATCH  /bundle                    → { session, bundle, ...fields } — label a
//                                       whole bundle at once (it's one thing)
//   DELETE /items/:id · DELETE /bundle?session=&bundle=

const express = require('express');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
let JSZip = null;
try { JSZip = require('jszip'); } catch { /* zip upload disabled */ }
let sharp = null;
try { sharp = require('sharp'); } catch { /* HEIC passes through unconverted */ }

const COL = 'forge-drops';
const IMAGE_RE = /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif)$/i;
const VIDEO_RE = /\.(mov|mp4|m4v|avi|hevc|webm)$/i;

function ffmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try { return require('ffmpeg-static'); } catch { return null; }
}

// Fields a client (the app, the page, or a chat) may write. Everything else on
// the doc — url, storagePath, media, session, createdAt — is server-owned.
const EDITABLE = [
  'track',        // what this is: 'crystals' | 'story-art' | … null until labelled
  'bundleName',   // display name of the group ("Pink quartz")
  'name', 'notes', 'tags', 'status',
  'seq',          // the bundle's position (a crystal's pick-your-own number)
  'photoIndex',   // order within the bundle (0 = cover)
  // crystals-track extras — harmless on other tracks, just unused
  'stone', 'size', 'weightG', 'priceUsd', 'qty', 'origin', 'count', 'kind',
  'listingId', 'listingUrl', 'gridUrl',
];
const NUMERIC = ['seq', 'photoIndex', 'weightG', 'priceUsd', 'qty', 'count'];

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
    .replace(/^-+|-+$/g, '').slice(0, 60);
}

function ctForName(name) {
  const n = String(name || '').toLowerCase();
  if (/\.jpe?g$/.test(n)) return 'image/jpeg';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.gif')) return 'image/gif';
  if (/\.hei[cf]$/.test(n)) return 'image/heic';
  if (n.endsWith('.mov')) return 'video/quicktime';
  if (/\.(mp4|m4v)$/.test(n)) return 'video/mp4';
  if (n.endsWith('.webm')) return 'video/webm';
  return 'image/png';
}
function extFor(ct) {
  const c = String(ct || '');
  if (c.includes('quicktime')) return 'mov';
  if (c.includes('mp4')) return 'mp4';
  if (c.includes('webm')) return 'webm';
  if (c.includes('webp')) return 'webp';
  if (c.includes('jpeg') || c.includes('jpg')) return 'jpg';
  if (c.includes('heic') || c.includes('heif')) return 'heic';
  return 'png';
}
const isVideoCT = (ct) => /^video\//i.test(String(ct || ''));

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
    agent: proxyAgent || undefined, headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!r.ok) throw new Error(`fetch ${r.status} for ${ref.slice(0, 60)}`);
  return { buf: await r.buffer(), ct: r.headers.get('content-type') || 'image/png' };
}

// iPhone stills are HEIC, which Etsy won't take and most browsers can't show.
// Re-encode to JPEG at the ORIGINAL pixel dimensions — never resize, some of
// these are listing photos. Videos pass through untouched.
async function normalize(buf, ct) {
  if (!/heic|heif/i.test(ct || '') || !sharp) return { buf, ct };
  try {
    return { buf: await sharp(buf).jpeg({ quality: 95 }).toBuffer(), ct: 'image/jpeg' };
  } catch {
    return { buf, ct }; // libheif can't decode it — keep the original bytes
  }
}

// First frame of a clip, so a video bundle has something to show in a grid.
// The app sends its own poster when it can (cheap on-device); this covers the
// zip and share-sheet paths. Best-effort: no ffmpeg just means no poster.
async function posterFrame(buf, ct) {
  const bin = ffmpegPath();
  if (!bin || !isVideoCT(ct)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drop-'));
  const src = path.join(dir, 'clip.' + extFor(ct));
  const out = path.join(dir, 'poster.jpg');
  try {
    fs.writeFileSync(src, buf);
    await new Promise((resolve, reject) => {
      const p = spawn(bin, ['-y', '-i', src, '-frames:v', '1', '-q:v', '3', out],
        { stdio: 'ignore' });
      p.on('error', reject);
      p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg ' + code))));
    });
    return fs.readFileSync(out);
  } catch {
    return null;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
  }
}

// A session id that sorts chronologically and reads as a date.
function newSession(at) {
  const d = new Date(at || Date.now());
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
    + `-${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}

// What a session already holds, so repeat uploads into it continue rather than
// restart — a bundle re-opened later keeps its number and photo order.
async function sessionState(session) {
  const snap = await db().collection(COL).where('session', '==', session).get();
  let maxSeq = 0;
  const bundles = new Map();
  snap.forEach((d) => {
    const v = d.data();
    const s = Number(v.seq) || 0;
    if (s > maxSeq) maxSeq = s;
    if (v.bundle) {
      const e = bundles.get(v.bundle) || { seq: s, name: v.bundleName || v.bundle, files: 0 };
      e.files += 1;
      if (s) e.seq = s;
      bundles.set(v.bundle, e);
    }
  });
  return { maxSeq, bundles };
}

// Where does the next file go? Same bundle → same seq, next photoIndex.
function placeIn(state, bundleName) {
  if (!bundleName) {
    state.maxSeq += 1;
    return { bundle: null, bundleName: null, seq: state.maxSeq, photoIndex: 0 };
  }
  const key = slug(bundleName) || 'unnamed';
  let e = state.bundles.get(key);
  if (!e) {
    state.maxSeq += 1;
    e = { seq: state.maxSeq, name: String(bundleName).slice(0, 80), files: 0 };
    state.bundles.set(key, e);
  }
  const photoIndex = e.files;
  e.files += 1;
  return { bundle: key, bundleName: e.name, seq: e.seq, photoIndex };
}

async function storeOne({ bucket, session, buf, ct, filename, place, poster, defaults }) {
  const { seq, bundle, bundleName, photoIndex } = place;
  const stem = `drops/${session}/${bundle || 'loose'}/`
    + `${seq}-${photoIndex}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const objectPath = `${stem}.${extFor(ct)}`;
  const file = bucket.file(objectPath);
  await file.save(buf, { metadata: { contentType: ct } });
  await file.makePublic();
  const url = `https://storage.googleapis.com/${bucket.name}/${objectPath}`;

  const video = isVideoCT(ct);
  let posterUrl = null;
  let posterPath = null;
  const posterBuf = poster || (video ? await posterFrame(buf, ct) : null);
  if (posterBuf) {
    posterPath = `${stem}-poster.jpg`;
    const pf = bucket.file(posterPath);
    await pf.save(posterBuf, { metadata: { contentType: 'image/jpeg' } });
    await pf.makePublic();
    posterUrl = `https://storage.googleapis.com/${bucket.name}/${posterPath}`;
  }

  const now = Date.now();
  const doc = {
    session, bundle, bundleName, seq, photoIndex,
    track: null,                       // ← labelled later, never at dump time
    url, storagePath: objectPath,
    media: video ? 'video' : 'image',
    posterUrl, posterPath,
    filename: filename || null,
    bytes: buf.length,
    status: 'new',
    name: null, notes: null, tags: [],
    stone: null, size: null, weightG: null, priceUsd: null, qty: null,
    origin: null, count: null, kind: null,
    listingId: null, listingUrl: null, gridUrl: null,
    createdAt: now, updatedAt: now,
    ...clean(defaults || {}),
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
    if (NUMERIC.includes(k)) {
      v = v === null || v === '' ? null : Number(v);
      if (v !== null && !Number.isFinite(v)) continue;
    }
    if (k === 'tags') {
      v = Array.isArray(v) ? v.map(String)
        : String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
    }
    out[k] = v;
  }
  return out;
}

// Which folder inside a zip names each bundle. Strip the prefix every entry
// shares (the Files-app wrapper) and take the first folder that remains:
//   Crystals/Pink quartz/a.jpg + Crystals/Selenite/b.jpg → two bundles
//   Pink quartz/a.jpg + Pink quartz/b.jpg                → one (wrapper IS it)
//   a.jpg + b.jpg                                        → loose
function bundleNamer(names) {
  const parts = names.map((n) => n.split('/').filter(Boolean));
  let common = 0;
  if (parts.length) {
    const first = parts[0];
    while (common < first.length - 1
      && parts.every((p) => p.length - 1 > common && p[common] === first[common])) common++;
  }
  return (name) => {
    const p = name.split('/').filter(Boolean);
    const dirs = p.slice(common, -1);
    if (dirs.length) return dirs[0];
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
router.use(express.json({ limit: '120mb' }));

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    firebase: Boolean(bucketOrNull()),
    zip: Boolean(JSZip),
    video: Boolean(ffmpegPath()),   // poster frames available?
  });
});

// GET /sessions — the dumps themselves, newest first.
router.get('/sessions', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const snap = await db().collection(COL).get();
    const by = new Map();
    snap.forEach((d) => {
      const v = d.data();
      const s = v.session || 'unknown';
      if (!by.has(s)) {
        by.set(s, { session: s, files: 0, bundles: new Set(), unlabelled: 0, at: 0, cover: null });
      }
      const e = by.get(s);
      e.files += 1;
      if (v.bundle) e.bundles.add(v.bundle);
      if (!v.track) e.unlabelled += 1;
      if ((v.createdAt || 0) > e.at) e.at = v.createdAt || 0;
      if (!e.cover && v.media === 'image') e.cover = v.url;
      if (!e.cover && v.posterUrl) e.cover = v.posterUrl;
    });
    const sessions = [...by.values()]
      .map((e) => ({ ...e, bundles: e.bundles.size }))
      .sort((a, b) => b.at - a.at);
    res.json({ count: sessions.length, sessions });
  } catch (e) { fail(res, e); }
});

function byPosition(a, b) {
  return (a.session || '').localeCompare(b.session || '')
    || (a.seq || 0) - (b.seq || 0)
    || (a.photoIndex || 0) - (b.photoIndex || 0)
    || (a.createdAt || 0) - (b.createdAt || 0);
}

// GET /bundles?session=&track=&untracked=1 — the inbox view: one entry per
// thing, its files nested. This is what a chat reads to label a dump.
router.get('/bundles', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    let q = db().collection(COL);
    if (req.query.session) q = q.where('session', '==', req.query.session);
    else if (req.query.track) q = q.where('track', '==', req.query.track);
    const snap = await q.get();
    let items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    if (req.query.session && req.query.track) items = items.filter((i) => i.track === req.query.track);
    if (req.query.untracked === '1') items = items.filter((i) => !i.track);
    items.sort(byPosition);

    const out = [];
    const index = new Map();
    for (const it of items) {
      const key = it.bundle ? it.session + '/' + it.bundle : 'loose:' + it.id;
      if (!index.has(key)) {
        index.set(key, out.length);
        out.push({
          bundle: it.bundle || null, bundleName: it.bundleName || null,
          session: it.session, seq: it.seq || null, track: it.track || null,
          // Labels live on every file of a thing; the cover is the authority.
          name: it.name, notes: it.notes, tags: it.tags || [], status: it.status || 'new',
          stone: it.stone, size: it.size, weightG: it.weightG, priceUsd: it.priceUsd,
          qty: it.qty, origin: it.origin, kind: it.kind, count: it.count,
          listingId: it.listingId, listingUrl: it.listingUrl,
          cover: it.posterUrl || it.url,
          files: [],
        });
      }
      out[index.get(key)].files.push({
        id: it.id, url: it.url, media: it.media || 'image',
        posterUrl: it.posterUrl || null, photoIndex: it.photoIndex || 0,
      });
    }
    res.json({ count: out.length, files: items.length, bundles: out });
  } catch (e) { fail(res, e); }
});

router.get('/items', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    let q = db().collection(COL);
    if (req.query.session) q = q.where('session', '==', req.query.session);
    else if (req.query.track) q = q.where('track', '==', req.query.track);
    const snap = await q.get();
    let items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    if (req.query.bundle) items = items.filter((i) => i.bundle === slug(req.query.bundle));
    if (req.query.track) items = items.filter((i) => i.track === req.query.track);
    if (req.query.media) items = items.filter((i) => (i.media || 'image') === req.query.media);
    if (req.query.status) items = items.filter((i) => (i.status || 'new') === req.query.status);
    if (req.query.untracked === '1') items = items.filter((i) => !i.track);
    items.sort(byPosition);
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

// POST /upload — { session?, bundle?, images:[dataURL|url], defaults? }
router.post('/upload', async (req, res) => {
  try {
    const b = req.body || {};
    const images = Array.isArray(b.images) ? b.images.filter(Boolean) : [];
    if (!images.length) return res.status(400).json({ error: 'images[] required (data URLs or http URLs)' });
    const bucket = bucketOrNull();
    if (!bucket) return res.status(503).json({ error: 'Firebase Storage not configured' });

    const session = String(b.session || '').trim() || newSession();
    const bundleName = typeof b.bundle === 'string' ? b.bundle.trim() : '';
    const state = await sessionState(session);
    const defaults = clean(b.defaults || {});

    const items = [];
    for (let i = 0; i < images.length; i++) {
      const raw = await toBuffer(images[i]);
      const { buf, ct } = await normalize(raw.buf, raw.ct);
      items.push(await storeOne({
        bucket, session, buf, ct, defaults,
        filename: Array.isArray(b.filenames) ? b.filenames[i] : null,
        place: placeIn(state, bundleName),
      }));
    }
    res.json({ ok: true, session, count: items.length, items });
  } catch (e) { fail(res, e); }
});

// POST /upload-file?session=&bundle=&filename= — ONE file as the raw request
// body. This is the path iOS uses: a background URLSession can only upload from
// a file, and base64 in JSON would inflate a 200MB clip by a third.
router.post('/upload-file',
  express.raw({ type: () => true, limit: '600mb' }),
  async (req, res) => {
    try {
      if (!req.body || !req.body.length) {
        return res.status(400).json({ error: 'empty body — POST the file as the request body' });
      }
      const bucket = bucketOrNull();
      if (!bucket) return res.status(503).json({ error: 'Firebase Storage not configured' });

      const session = String(req.query.session || '').trim() || newSession();
      const bundleName = String(req.query.bundle || '').trim();
      const filename = String(req.query.filename || '').trim();
      // Trust the declared content type, but fall back to the filename — iOS
      // sends application/octet-stream for some asset exports.
      let ct = req.get('content-type') || '';
      if (!ct || /octet-stream/i.test(ct)) ct = ctForName(filename);

      const state = await sessionState(session);
      const { buf, ct: finalCt } = await normalize(req.body, ct);
      const item = await storeOne({
        bucket, session, buf, ct: finalCt, filename,
        place: placeIn(state, bundleName),
      });
      res.json({ ok: true, session, item });
    } catch (e) { fail(res, e); }
  });

// POST /upload-zip?session=&bundle= — folders inside become bundles.
router.post('/upload-zip', express.raw({ type: () => true, limit: '512mb' }), async (req, res) => {
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
      .filter((f) => !f.dir && (IMAGE_RE.test(f.name) || VIDEO_RE.test(f.name))
        && !/(^|\/)__MACOSX\//.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!entries.length) return res.status(400).json({ error: 'no images or videos found in the zip' });

    const session = String(req.query.session || '').trim() || newSession();
    const forced = String(req.query.bundle || '').trim();
    const nameOf = forced ? () => forced : bundleNamer(entries.map((e) => e.name));
    const state = await sessionState(session);

    const items = [];
    for (const entry of entries) {
      // one at a time — never hold a whole camera roll in memory
      const raw = await entry.async('nodebuffer');
      const { buf, ct } = await normalize(raw, ctForName(entry.name));
      items.push(await storeOne({
        bucket, session, buf, ct, filename: entry.name.split('/').pop(),
        place: placeIn(state, nameOf(entry.name)),
      }));
    }
    const bundles = [...new Set(items.map((i) => i.bundleName).filter(Boolean))];
    res.json({ ok: true, session, count: items.length, bundles, items });
  } catch (e) { fail(res, e); }
});

// PATCH /bundle — { session, bundle, ...fields }. A bundle is one thing, so a
// label applies to all of its files.
router.patch('/bundle', async (req, res) => {
  try {
    const b = req.body || {};
    const session = String(b.session || '').trim();
    const bundle = slug(b.bundle);
    if (!session || !bundle) return res.status(400).json({ error: 'session and bundle required' });
    const patch = clean(b);
    delete patch.photoIndex;             // per-file, meaningless across a bundle
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to update' });
    patch.updatedAt = Date.now();

    const snap = await db().collection(COL).where('session', '==', session).get();
    const docs = snap.docs.filter((d) => d.get('bundle') === bundle);
    if (!docs.length) return res.status(404).json({ error: 'no files for that bundle' });
    const writer = db().batch();
    docs.forEach((d) => writer.set(d.ref, patch, { merge: true }));
    await writer.commit();
    res.json({ ok: true, session, bundle, updated: docs.length, patch });
  } catch (e) { fail(res, e); }
});

router.patch('/items/:id', async (req, res) => {
  try {
    const patch = clean(req.body || {});
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to update' });
    patch.updatedAt = Date.now();
    const ref = db().collection(COL).doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'not found' });
    await ref.set(patch, { merge: true });
    const after = await ref.get();
    res.json({ ok: true, item: { id: after.id, ...after.data() } });
  } catch (e) { fail(res, e); }
});

// The doc is the record; a leftover blob is harmless if a delete fails, so
// never let Storage cleanup block removing the row.
async function dropDoc(d, bucket) {
  await d.ref.delete();
  if (!bucket) return;
  for (const p of [d.get('storagePath'), d.get('posterPath')].filter(Boolean)) {
    try { await bucket.file(p).delete(); } catch { /* already gone */ }
  }
}

router.delete('/bundle', async (req, res) => {
  try {
    const session = String(req.query.session || '').trim();
    const bundle = slug(req.query.bundle);
    if (!session || !bundle) return res.status(400).json({ error: 'session and bundle required' });
    const snap = await db().collection(COL).where('session', '==', session).get();
    const docs = snap.docs.filter((d) => d.get('bundle') === bundle);
    if (!docs.length) return res.status(404).json({ error: 'no files for that bundle' });
    const bucket = bucketOrNull();
    for (const d of docs) await dropDoc(d, bucket);
    res.json({ ok: true, deleted: docs.length });
  } catch (e) { fail(res, e); }
});

router.delete('/items/:id', async (req, res) => {
  try {
    const ref = db().collection(COL).doc(req.params.id);
    const d = await ref.get();
    if (!d.exists) return res.status(404).json({ error: 'not found' });
    await dropDoc(d, bucketOrNull());
    res.json({ ok: true, deleted: req.params.id });
  } catch (e) { fail(res, e); }
});

module.exports = { router, COL, slug, bundleNamer, newSession };
