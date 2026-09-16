// lightroom.js — her mom's Lightroom Classic catalog, picked on a screen.
//
// Step 1 and 2 of the jewelry pipeline (2026-09-16, Sophie: "step 1. extract
// images from her lightroom … too many to export … she has tons of files ·
// classic · 4000 pics" · "step 2. tinder picker based on her specs to choose
// items"). Her mom's specs, off the recording another chat transcribed: the
// necklace folder; the pieces whose title is just N and a number; drop
// anything that says sold, sample bag, gave, gifted or donated; every photo
// of a piece on ONE screen; on her computer, not her phone; yes · maybe · no
// · star; start with the top twenty or so.
//
//   1. public/lightroom-sync.py runs ONCE on her PC (lightroom-sync.bat
//      double-clicks it): reads the catalog file (SQLite), takes each
//      picture's preview out of Lightroom's own cache — no export — and
//      POSTs it here with its title, folder and collections. Only the
//      necklace folder/collection is sent. Resumable.
//   2. /lightroom is a JUDGE page (the house Tinder deck, /judge.js) with one
//      card per PIECE — all of its photos on the card — and her four words as
//      the deck's own states. Verdicts land on the chat verdict doc
//      (chat LR_CHAT, sheet lr-<catalog>) like every judge page's.
//   3. "Send to listings" turns starred/yes pieces into jewelry.js items —
//      the piece's front photo as the ONE picture — and starts each one's
//      Make job. That is money (~30¢ a piece), so the page names the count
//      and the cost and the route takes `confirm:true`, a `limit` (default 5,
//      max 40: "a few first to verify it works, then more"), and never sends
//      a piece twice.
//
// Nothing here draws or spends until the send; the sync and the picking are
// free. ONE equality filter per query (catalog ==), the rest in memory.
//
// ROUTES (/api/lightroom)
//   GET  /status                       open — booleans only
//   GET  /have?catalog=                image ids already stored (the script skips them)
//   POST /photo?catalog=&image=&…      raw JPEG body; one preview, md5-deduped
//   GET  /catalogs                     what has been synced
//   GET  /pieces?catalog=              the deck: pieces with their photos + sent state
//   POST /send {catalog, pick, keys?, limit, confirm}   picked pieces → jewelry items + Make
//
// Test: node scripts/test-lightroom.js

const express = require('express');
const crypto = require('crypto');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

const COL = 'forge-lightroom';
const LR_CHAT = 'jewelry-upload-website';   // the chat whose verdict docs hold her picks
const SHEET = (catalog) => `lr-${catalog}`;
const PIECE_RE = /^\s*N\s*[-–.]?\s*(\d+)\s*$/i;
const EXCLUDE_RE = /\b(sold|sample\s*bags?|gave|gifted|donated)\b/i;
const MAX_SEND = 40;
const COST_EACH = 0.30;

function tryRequire(name) {
  try { return require(name); } catch (err) {
    console.warn(`lightroom: ${name} unavailable —`, err.message);
    return null;
  }
}
const jewelry = tryRequire('./jewelry');

const db = () => (admin.apps.length ? admin.firestore() : null);
const bucketOrNull = () => { try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; } };
const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
const slugOf = (s) => clip(s, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ─── her rules, pure ───────────────────────────────────────────────────
// What a title says about the picture: a PIECE (N + a number, its key),
// EXCLUDED (sold / sample bag / gave / gifted / donated — not for sale),
// OTHER (a title that is not the N shape), or UNTITLED.
function classify(title) {
  const t = String(title || '').trim();
  if (!t) return { kind: 'untitled', key: '' };
  if (EXCLUDE_RE.test(t)) return { kind: 'excluded', key: '' };
  const m = PIECE_RE.exec(t);
  if (m) return { kind: 'piece', key: 'N' + String(parseInt(m[1], 10)) };
  return { kind: 'other', key: '' };
}
// Pieces out of photo docs: one per key, photos in file-name order (the
// front is the first shot she took), the label naming the count.
function groupPieces(docs) {
  const by = new Map();
  const counts = { photos: 0, piece: 0, other: 0, untitled: 0, excluded: 0 };
  for (const d of docs) {
    counts.photos++;
    counts[d.kind] = (counts[d.kind] || 0) + 1;
    if (d.kind !== 'piece') continue;
    if (!by.has(d.piece)) by.set(d.piece, { key: d.piece, title: d.title, photos: [] });
    by.get(d.piece).photos.push({ url: d.url, thumb: d.thumb, file: d.file, image: d.image, w: d.w, h: d.h });
  }
  const pieces = [...by.values()];
  // file order by STEM: IMG_0012 before IMG_0012-2 (a plain compare puts
  // "-2" before ".jpg"), numbers as numbers
  const stem = (f) => String(f || '').replace(/\.[a-z0-9]+$/i, '');
  for (const p of pieces) p.photos.sort((a, b) => stem(a.file).localeCompare(stem(b.file), undefined, { numeric: true }));
  pieces.sort((a, b) => Number(a.key.slice(1)) - Number(b.key.slice(1)));
  counts.pieces = pieces.length;
  return { pieces, counts };
}
// A judge item per piece: all its photos on the one card (a spread), her
// words as the states. A single photo is a plain card.
function judgeItem(p) {
  const label = `${p.key} · ${p.photos.length} photo${p.photos.length === 1 ? '' : 's'}`;
  if (p.photos.length === 1) return { id: p.key, label, img: p.photos[0].url };
  return { id: p.key, label, pair: p.photos.map((ph, i) => ({ img: ph.url, label: i === 0 ? 'front' : '' })) };
}
const STATES = [{ key: 'star', label: 'Star' }, { key: 'yes', label: 'Yes' }, { key: 'maybe', label: 'Maybe' }, { key: 'no', label: 'No' }];
// Which pieces a send takes, in her order: stars first, then yeses, never one
// already sent, never more than `limit`.
function sendPlan({ pieces, verdicts, pick = 'star', keys, limit = 5, sent = {} }) {
  const lim = Math.max(1, Math.min(MAX_SEND, Number(limit) || 5));
  const wantKey = new Set(Array.isArray(keys) ? keys.map(String) : []);
  const ok = (k) => {
    if (sent[k]) return false;
    if (wantKey.size) return wantKey.has(k);
    const v = verdicts[k];
    if (pick === 'both') return v === 'star' || v === 'yes';
    return v === pick;
  };
  const rank = (k) => (verdicts[k] === 'star' ? 0 : 1);
  const chosen = pieces.filter(p => ok(p.key)).sort((a, b) => rank(a.key) - rank(b.key) || Number(a.key.slice(1)) - Number(b.key.slice(1)));
  return { pieces: chosen.slice(0, lim), skipped: Math.max(0, chosen.length - lim), cost: Math.round(Math.min(chosen.length, lim) * COST_EACH * 100) / 100 };
}

// ─── storage ───────────────────────────────────────────────────────────
async function saveBytes(path, buf, contentType) {
  const bucket = bucketOrNull();
  if (!bucket) throw new Error('Firebase Storage not configured');
  const file = bucket.file(path);
  await file.save(buf, { metadata: { contentType }, resumable: false });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}
// The preview as it came (≤2048 on the long edge it is kept byte for byte),
// else brought down to 1600 — a 4,000-picture sync is not the place for
// originals; the pipeline reads a reference at ≤1024 anyway.
async function normalize(buf) {
  const sharp = require('sharp');
  const meta = await sharp(buf).metadata().catch(() => ({}));
  const long = Math.max(meta.width || 0, meta.height || 0);
  if (long && long <= 2048 && (meta.format === 'jpeg')) return { buf, w: meta.width, h: meta.height };
  const out = await sharp(buf).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  const m2 = await sharp(out).metadata();
  return { buf: out, w: m2.width, h: m2.height };
}
async function thumbOf(buf, width = 480) {
  const sharp = require('sharp');
  return sharp(buf).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
}

// ─── firestore ─────────────────────────────────────────────────────────
const photoId = (catalog, image) => `${catalog}__${image}`;
const catId = (catalog) => `__cat__${catalog}`;
const pieceId = (catalog, key) => `__piece__${catalog}__${key}`;
const cache = new Map();   // catalog → { at, docs }
async function photosOf(catalog) {
  const c = cache.get(catalog);
  if (c && Date.now() - c.at < 30000) return c.docs;
  const snap = await db().collection(COL).where('catalog', '==', catalog).get();
  const docs = snap.docs.map(s => ({ id: s.id, ...s.data() })).filter(d => d.image != null);
  cache.set(catalog, { at: Date.now(), docs });
  return docs;
}
async function verdictsOf(catalog) {
  const id = `${LR_CHAT}__${SHEET(catalog)}`;
  const snap = await db().collection('forge-chat-verdicts').doc(id).get();
  return (snap.exists && snap.data().items) || {};
}

// ─── routes ────────────────────────────────────────────────────────────
const router = express.Router();
router.use((req, res, next) => {
  const token = process.env.STUDIO_TOKEN || '';
  if (!token) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === token || req.query.token === token) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
const fail = (res, e) => res.status(/unavailable|not configured/.test(e.message) ? 503 : /required|no such|confirm/i.test(e.message) ? 400 : 500)
  .json({ error: clip(e.message, 300) });

router.get('/status', (req, res) => {
  res.json({ ok: true, firebase: Boolean(db()), storage: Boolean(bucketOrNull()), jewelry: Boolean(jewelry && jewelry.createItem) });
});

router.get('/have', async (req, res) => {
  try {
    const catalog = slugOf(req.query.catalog);
    if (!catalog) return res.status(400).json({ error: 'catalog required' });
    if (!db()) return res.status(503).json({ error: 'Firebase unavailable' });
    cache.delete(catalog);
    const docs = await photosOf(catalog);
    res.json({ catalog, images: docs.map(d => String(d.image)) });
  } catch (e) { fail(res, e); }
});

router.post('/photo', express.raw({ type: () => true, limit: '12mb' }), async (req, res) => {
  try {
    const q = req.query || {};
    const catalog = slugOf(q.catalog);
    const image = clip(q.image, 32);
    if (!catalog || !image) return res.status(400).json({ error: 'catalog and image required' });
    if (!req.body || !req.body.length) return res.status(400).json({ error: 'empty body — POST the preview as the request body' });
    const d = db();
    if (!d) return res.status(503).json({ error: 'Firebase unavailable' });
    const title = clip(q.title, 200);
    const c = classify(title);
    const md5 = crypto.createHash('md5').update(req.body).digest('hex');
    const ref = d.collection(COL).doc(photoId(catalog, image));
    const prev = await ref.get();
    if (prev.exists && prev.data().md5 === md5) return res.json({ ok: true, duplicate: true });
    const n = await normalize(req.body);
    const url = await saveBytes(`lightroom/${catalog}/${image}.jpg`, n.buf, 'image/jpeg');
    const thumb = await saveBytes(`lightroom/${catalog}/${image}.webp`, await thumbOf(n.buf), 'image/webp');
    const doc = { catalog, image, title, kind: c.kind, piece: c.key, folder: clip(q.folder, 300), file: clip(q.file, 200),
      captured: clip(q.captured, 40), collections: clip(q.collections, 500), w: n.w, h: n.h, url, thumb, md5, bytes: n.buf.length, at: Date.now() };
    await ref.set(doc);
    cache.delete(catalog);
    await d.collection(COL).doc(catId(catalog)).set({ catalog, kind: '__catalog', name: catalog, total: Number(q.total) || null, lastAt: Date.now() }, { merge: true });
    res.json({ ok: true, kind: c.kind, piece: c.key });
  } catch (e) { fail(res, e); }
});

router.get('/catalogs', async (req, res) => {
  try {
    if (!db()) return res.status(503).json({ error: 'Firebase unavailable' });
    const snap = await db().collection(COL).where('kind', '==', '__catalog').get();
    res.json({ catalogs: snap.docs.map(s => s.data()).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0)) });
  } catch (e) { fail(res, e); }
});

router.get('/pieces', async (req, res) => {
  try {
    const catalog = slugOf(req.query.catalog);
    if (!catalog) return res.status(400).json({ error: 'catalog required' });
    if (!db()) return res.status(503).json({ error: 'Firebase unavailable' });
    const docs = await photosOf(catalog);
    const { pieces, counts } = groupPieces(docs.filter(d => d.kind !== '__piece' && d.kind !== '__catalog'));
    const sent = {};
    for (const d of docs) if (d.kind === '__piece' && d.sentItem) sent[d.piece] = { item: d.sentItem, at: d.sentAt };
    res.json({ catalog, chat: LR_CHAT, sheet: SHEET(catalog), states: STATES, counts,
      pieces: pieces.map(p => ({ ...p, sent: sent[p.key] || null })), items: pieces.map(judgeItem), costEach: COST_EACH });
  } catch (e) { fail(res, e); }
});

// The picked pieces become listings. Money: `confirm:true` or nothing moves.
router.post('/send', express.json({ limit: '32kb' }), async (req, res) => {
  try {
    if (!jewelry || !jewelry.createItem) return res.status(503).json({ error: 'jewelry module unavailable' });
    const b = req.body || {};
    const catalog = slugOf(b.catalog);
    if (!catalog) return res.status(400).json({ error: 'catalog required' });
    if (!db()) return res.status(503).json({ error: 'Firebase unavailable' });
    const docs = await photosOf(catalog);
    const { pieces } = groupPieces(docs.filter(d => d.kind !== '__piece' && d.kind !== '__catalog'));
    const verdicts = await verdictsOf(catalog);
    const sent = {};
    for (const d of docs) if (d.kind === '__piece' && d.sentItem) sent[d.piece] = true;
    const plan = sendPlan({ pieces, verdicts, pick: b.pick, keys: b.keys, limit: b.limit, sent });
    if (!plan.pieces.length) return res.json({ ok: true, sent: [], cost: 0, note: 'nothing picked that has not been sent' });
    if (b.confirm !== true) return res.json({ ok: false, plan: plan.pieces.map(p => p.key), cost: plan.cost, skipped: plan.skipped, error: 'confirm required' });
    let account = 'default';
    try { account = require('./etsy').normAccount(b.account); } catch { /* default */ }
    const out = [];
    for (const p of plan.pieces) {
      const front = p.photos[0];
      try {
        const r = await fetch(front.url, { timeout: 60000 });
        if (!r.ok) throw new Error(`fetch ${r.status}`);
        const buf = await r.buffer();
        const item = await jewelry.createItem({ account, source: `lightroom:${catalog}:${p.key}` });
        await jewelry.addPhoto(item, buf, 'image/jpeg');
        await jewelry.startMake(item.id, '');
        await db().collection(COL).doc(pieceId(catalog, p.key)).set({ catalog, kind: '__piece', piece: p.key, sentItem: item.id, sentAt: Date.now() }, { merge: true });
        out.push({ key: p.key, item: item.id, ok: true });
      } catch (err) {
        out.push({ key: p.key, ok: false, error: clip(err.message, 200) });
      }
    }
    cache.delete(catalog);
    res.json({ ok: true, sent: out, cost: Math.round(out.filter(x => x.ok).length * COST_EACH * 100) / 100, skipped: plan.skipped });
  } catch (e) { fail(res, e); }
});

module.exports = { router, classify, groupPieces, judgeItem, sendPlan, STATES, PIECE_RE, EXCLUDE_RE, COST_EACH, MAX_SEND, LR_CHAT, SHEET };
