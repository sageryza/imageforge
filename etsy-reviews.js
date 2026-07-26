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
const PAGE = 12;              // reviews per response
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
  rows.forEach(x => batch.set(x.ref, reviewDoc(x.r)));
  await batch.commit();
  return fresh;
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

async function resolveListingId(handle) {
  const map = await handleMap();
  if (map[handle]) return String(map[handle]);
  const m = /-(\d{4,6})$/.exec(handle || '');
  if (!m) return null;
  const parents = await db().collection(COL).listDocuments();
  const hits = parents.map(d => d.id).filter(id => id.endsWith(m[1]));
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

module.exports = { router, upsertPage, recomputeSummaries, incrementalSync, SHOP_ID, COL, META };
