// etsy-reviews.js — Etsy shop reviews, mirrored to Firestore and served to the
// witch app's product sheets (mounted at /api/witch/shop/reviews).
//
// Why a mirror instead of proxying Etsy live: the shop has ~7.8k reviews and
// Etsy pages them 100 at a time, newest first, so "reviews for THIS product"
// can sit hundreds of pages deep — far too slow for a product sheet. The
// backfill (scripts/backfill-etsy-reviews.js) walks every page once into
// Firestore; after that an incremental top-up only reads the first few pages
// until it hits transaction ids it already has.
//
// Storage layout (deckfactory Firestore):
//   forge-etsy-reviews/{listingId}                 — { count, average, updated }
//   forge-etsy-reviews/{listingId}/items/{txnId}   — one review
//   forge-etsy-reviews-meta/global                 — { count, average, lastSync }
//   forge-etsy-reviews-meta/map                    — { [shopifyHandle]: listingId }
//   forge-etsy-review-photos/{txnId}               — one review that has a photo
// The photo mirror is FLAT on purpose. Buyers' photos are the shop's best
// proof and they are scattered one listing at a time across 173 subcollections,
// so "the newest photos, whatever they are of" had nowhere to come from. A
// collectionGroup query would need a hand-made composite index (photo +
// created); a flat collection ordered by `created` rides Firestore's automatic
// single-field index, which is the same reasoning that shaped the subcollection
// above. Measured 2026-09-14: 962 of the 7,800 mirrored reviews carry a photo.
// The subcollection shape is deliberate: orderBy(created desc) inside a
// subcollection rides Firestore's automatic single-field index, so no
// composite index has to be created by hand.
//
// Reviews are public marketing content — no STUDIO_TOKEN gate.

const express = require('express');
const admin = require('firebase-admin');

const SHOP_ID = Number(process.env.ETSY_SHOP_ID || 14194752); // sophiespincher
const COL = 'forge-etsy-reviews';
const META = 'forge-etsy-reviews-meta';
const PHOTOS = 'forge-etsy-review-photos';
const PAGE = 12;              // reviews per response
const PHOTO_PAGE = 24;        // photos per response on the wall
const PHOTO_MAX = 60;         // a caller may never ask for more than this
const SYNC_EVERY_MS = 6 * 60 * 60 * 1000; // incremental top-up at most every 6h
const SYNC_MAX_PAGES = 5;     // a top-up never walks more than this

function db() { return admin.firestore(); }

// ─── Etsy → Firestore ───────────────────────────────────────────────

function reviewDoc(r) {
  return {
    listing_id: r.listing_id,
    rating: r.rating || 0,
    text: r.review || '',
    photo: r.image_url_fullxfull || null,
    created: (r.create_timestamp || r.created_timestamp || 0) * 1000,
  };
}

// The flat copy of a review that carries a photo. `listing_id` rides along so
// a photo can be resolved back to the product it is of.
function photoDoc(r) {
  const d = reviewDoc(r);
  return { listing_id: d.listing_id, photo: d.photo, rating: d.rating, text: d.text, created: d.created };
}

// Upsert one page of reviews. Returns how many were NEW (already-seen
// transaction ids are how the incremental sync knows when to stop). The
// existence check is one batched getAll, not a get per review — the serial
// version made a 7.8k-review backfill take >10 minutes.
async function upsertPage(results) {
  const rows = results.filter(r => r.transaction_id).map(r => ({
    r,
    ref: db().collection(COL).doc(String(r.listing_id))
      .collection('items').doc(String(r.transaction_id)),
  }));
  if (!rows.length) return 0;
  const snaps = await db().getAll(...rows.map(x => x.ref));
  const fresh = snaps.filter(s => !s.exists).length;
  const batch = db().batch();
  rows.forEach(x => {
    batch.set(x.ref, reviewDoc(x.r));
    // Same batch, so a review and its photo can never disagree. Only ever
    // WRITTEN, never deleted: a review that loses its photo is not a thing
    // Etsy does, and a delete here would be the one way this could drop a
    // photo the subcollection still holds.
    if (x.r.image_url_fullxfull) {
      batch.set(db().collection(PHOTOS).doc(String(x.r.transaction_id)), photoDoc(x.r));
    }
  });
  await batch.commit();
  return fresh;
}

// Fill the flat photo mirror from the reviews already on file. Idempotent —
// the doc id is the transaction id — so it is safe to re-run, and it is what
// backfills the photos that landed before the mirror existed.
// Reads only the subcollections; no Etsy call, so it costs nothing.
async function backfillPhotos({ dry = false } = {}) {
  const items = await db().collectionGroup('items').get();
  const rows = [];
  items.forEach(d => {
    const x = d.data();
    if (!x.photo || !x.listing_id) return;
    rows.push({ id: d.id, doc: { listing_id: x.listing_id, photo: x.photo, rating: x.rating || 0, text: x.text || '', created: x.created || 0 } });
  });
  if (dry) return { found: rows.length, written: 0, dry: true };
  for (let i = 0; i < rows.length; i += 400) {
    const batch = db().batch();
    rows.slice(i, i + 400).forEach(r => batch.set(db().collection(PHOTOS).doc(r.id), r.doc));
    await batch.commit();
  }
  photoCache = { at: 0, rows: null };
  return { found: rows.length, written: rows.length };
}

// Recompute the per-listing summary docs and the global rollup. Cheap enough
// to run after any sync: one aggregate query per listing that has reviews.
async function recomputeSummaries(listingIds) {
  let ids = listingIds;
  if (!ids) {
    const parents = await db().collection(COL).listDocuments();
    ids = parents.map(d => d.id);
  }
  let gCount = 0, gSum = 0;
  for (const id of ids) {
    const items = await db().collection(COL).doc(String(id)).collection('items').get();
    let sum = 0;
    items.forEach(d => { sum += d.data().rating || 0; });
    gCount += items.size; gSum += sum;
    await db().collection(COL).doc(String(id)).set({
      count: items.size,
      average: items.size ? +(sum / items.size).toFixed(2) : 0,
      updated: Date.now(),
    }, { merge: true });
  }
  await db().collection(META).doc('global').set({
    count: gCount,
    average: gCount ? +(gSum / gCount).toFixed(2) : 0,
    lastSync: Date.now(),
  }, { merge: true });
  return { count: gCount, average: gCount ? +(gSum / gCount).toFixed(2) : 0 };
}

// Pull newest pages until a full page of already-known reviews (or the page
// cap) — the steady-state refresh. Fire-and-forget from the read path.
let syncing = false;
async function incrementalSync() {
  if (syncing) return;
  syncing = true;
  try {
    const etsy = require('./etsy');
    const touched = new Set();
    for (let page = 0; page < SYNC_MAX_PAGES; page++) {
      const r = await etsy.userFetch(`/shops/${SHOP_ID}/reviews?limit=100&offset=${page * 100}`);
      if (!r.ok) break;
      const results = (r.body && r.body.results) || [];
      if (!results.length) break;
      results.forEach(x => touched.add(String(x.listing_id)));
      const fresh = await upsertPage(results);
      if (fresh === 0) break; // caught up
    }
    if (touched.size) await recomputeSummaries([...touched]);
    else await db().collection(META).doc('global').set({ lastSync: Date.now() }, { merge: true });
  } catch (e) {
    console.warn('etsy-reviews: incremental sync failed —', e.message);
  } finally {
    syncing = false;
  }
}

async function maybeSync() {
  try {
    const g = await db().collection(META).doc('global').get();
    const last = (g.exists && g.data().lastSync) || 0;
    if (Date.now() - last > SYNC_EVERY_MS) incrementalSync(); // deliberately not awaited
  } catch { /* reads must never fail because a sync couldn't start */ }
}

// ─── handle → listing id ────────────────────────────────────────────
// The Shuttle importer stamped Shopify handles with the tail digits of the
// Etsy listing id; products WE port don't have that, so the backfill also
// writes an explicit map doc from the products' shuttle.etsy_id metafields
// plus overrides. The map doc wins; the suffix is the fallback for anything
// created after the last backfill.

let mapCache = { at: 0, map: {} };
async function handleMap() {
  if (Date.now() - mapCache.at < 10 * 60 * 1000) return mapCache.map;
  try {
    const d = await db().collection(META).doc('map').get();
    mapCache = { at: Date.now(), map: (d.exists && d.data()) || {} };
  } catch { mapCache = { at: Date.now(), map: mapCache.map }; }
  return mapCache.map;
}

// The wall's first page, held briefly. Photos arrive a handful a month, so a
// shop tab opened three times in a minute is one read.
let photoCache = { at: 0, rows: null };
const PHOTO_CACHE_MS = 10 * 60 * 1000;

let idsCache = { at: 0, ids: [] };
async function parentIds() {
  if (idsCache.ids.length && Date.now() - idsCache.at < 10 * 60 * 1000) return idsCache.ids;
  try {
    const docs = await db().collection(COL).listDocuments();
    idsCache = { at: Date.now(), ids: docs.map(d => d.id) };
  } catch { idsCache = { at: Date.now(), ids: idsCache.ids }; }
  return idsCache.ids;
}

// listingId -> shopify handle, the map read backwards. Only the explicit map
// doc can answer this: the suffix rule works the other way (handle -> id) and
// cannot be run in reverse without the shop's handle list, which lives on the
// page, not here. A photo whose listing has no handle is still a photo — it
// just isn't a door into a product, and it says so by carrying no handle.
async function inverseMap() {
  const map = await handleMap();
  const inv = {};
  Object.entries(map).forEach(([h, id]) => { inv[String(id)] = h; });
  return inv;
}

async function resolveListingId(handle) {
  const map = await handleMap();
  if (map[handle]) return String(map[handle]);
  const m = /-(\d{4,6})$/.exec(handle || '');
  if (!m) return null;
  const hits = (await parentIds()).filter(id => id.endsWith(m[1]));
  return hits.length === 1 ? hits[0] : null;
}

// ─── routes ─────────────────────────────────────────────────────────

const router = express.Router();

// GET /?handle=<shopify handle>[&before=<ms>] → that product's reviews.
// GET /?summary=1 → just the shop-wide rollup (for headers/badges).
router.get('/', async (req, res) => {
  try {
    maybeSync();
    const g = await db().collection(META).doc('global').get();
    const global = g.exists ? { count: g.data().count || 0, average: g.data().average || 0 } : { count: 0, average: 0 };
    if (req.query.summary === '1') return res.json({ global });

    // GET /?handles=a,b,c → { items: { handle: {count, average} } }. The shop
    // grid shows a rating under every tile, so it asks ONCE for the whole shelf
    // instead of firing a request per thumbnail.
    const many = String(req.query.handles || '').split(',').map(h => h.trim()).filter(Boolean).slice(0, 150);
    if (many.length) {
      const ids = await Promise.all(many.map(h => resolveListingId(h).catch(() => null)));
      const uniq = [...new Set(ids.filter(Boolean))];
      const snaps = uniq.length ? await db().getAll(...uniq.map(id => db().collection(COL).doc(id))) : [];
      const byId = {};
      snaps.forEach(sn => { if (sn.exists) byId[sn.id] = { count: sn.data().count || 0, average: sn.data().average || 0 }; });
      const items = {};
      many.forEach((h, i) => { const hit = ids[i] && byId[ids[i]]; if (hit && hit.count) items[h] = hit; });
      return res.json({ global, items });
    }

    const handle = String(req.query.handle || '');
    if (!handle) return res.status(400).json({ error: 'handle required' });
    const listingId = await resolveListingId(handle);
    if (!listingId) return res.json({ global, count: 0, average: 0, reviews: [] });

    const parent = await db().collection(COL).doc(listingId).get();
    let q = db().collection(COL).doc(listingId).collection('items')
      .orderBy('created', 'desc').limit(PAGE);
    const before = parseInt(req.query.before, 10);
    if (isFinite(before)) q = q.startAfter(before);
    const items = await q.get();
    const reviews = items.docs.map(d => {
      const x = d.data();
      return { rating: x.rating, text: x.text, photo: x.photo, created: x.created };
    });
    res.json({
      global,
      count: (parent.exists && parent.data().count) || 0,
      average: (parent.exists && parent.data().average) || 0,
      reviews,
      nextCursor: reviews.length === PAGE ? reviews[reviews.length - 1].created : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /photos[?limit=&before=&handles=a,b,c] → the shop's buyer photos,
// newest first. One ordered read of the flat mirror.
//
// `handles` is how a photo becomes a DOOR rather than just a picture: the
// page already holds the shelf's handles, and resolveListingId knows both ways
// a handle names a listing (the explicit map, and the Shuttle suffix). Read
// backwards that gives listing -> handle for everything currently on sale,
// where the map doc alone covers about two thirds of the photos. A photo whose
// product cannot be named still shows and simply carries no handle — it is
// somebody's photo of her work either way.
router.get('/photos', async (req, res) => {
  try {
    maybeSync();
    const before = parseInt(req.query.before, 10);
    const asked = parseInt(req.query.limit, 10);
    const limit = Math.max(1, Math.min(PHOTO_MAX, isFinite(asked) ? asked : PHOTO_PAGE));

    // The Firestore read is the cost; the handle pass below is in-memory, so
    // the cache holds the ROWS and every caller's own shelf is applied after.
    let rows;
    const firstPage = !isFinite(before) && limit === PHOTO_PAGE;
    if (firstPage && photoCache.rows && Date.now() - photoCache.at < PHOTO_CACHE_MS) {
      rows = photoCache.rows;
    } else {
      let q = db().collection(PHOTOS).orderBy('created', 'desc').limit(limit);
      if (isFinite(before)) q = q.startAfter(before);
      const snap = await q.get();
      rows = snap.docs.map(d => d.data());
      if (firstPage) photoCache = { at: Date.now(), rows };
    }

    const inv = await inverseMap();
    const many = String(req.query.handles || '').split(',').map(h => h.trim()).filter(Boolean).slice(0, 200);
    if (many.length) {
      const ids = await Promise.all(many.map(h => resolveListingId(h).catch(() => null)));
      many.forEach((h, i) => { if (ids[i]) inv[String(ids[i])] = h; });
    }

    const photos = rows.map(x => ({
      photo: x.photo,
      rating: x.rating || 0,
      text: x.text || '',
      created: x.created || 0,
      handle: inv[String(x.listing_id)] || null,
    }));
    res.json({
      photos,
      nextCursor: photos.length === limit ? photos[photos.length - 1].created : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, upsertPage, recomputeSummaries, incrementalSync, backfillPhotos, photoDoc, SHOP_ID, COL, META, PHOTOS };
