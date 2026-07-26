#!/usr/bin/env node
// backfill-etsy-reviews.js — one-time full mirror of the shop's Etsy reviews
// into Firestore, plus the Shopify-handle → Etsy-listing map the serving
// endpoint uses. Safe to re-run: review writes are idempotent (doc id =
// transaction id) and the map is rebuilt from scratch each time.
//
// Usage: node scripts/backfill-etsy-reviews.js [--reviews-only|--map-only]
// Needs: FIREBASE_SERVICE_ACCOUNT (deckfactory), ETSY_API_KEY,
//        ETSY_SHARED_SECRET. The Shopify Admin token is read from Firestore
//        (config/shopify-tokens) for the map step.

const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });

const etsy = require('../etsy');
const { upsertPage, recomputeSummaries, SHOP_ID, META } = require('../etsy-reviews');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Ported-by-hand products have no Shuttle suffix or metafield — map them here.
const MAP_OVERRIDES = {
  // Apothecary Mini (exact Etsy copy, July 2026)
  'witchcraft-apothecary-mini-wiccan-pagan-herbs-witch-kit-box-altar-supplies-dried-herbs-roots-berries-book-of-shadows-potions': 972740469,
};

async function backfillReviews() {
  let offset = 0, total = null, written = 0;
  for (;;) {
    const r = await etsy.userFetch(`/shops/${SHOP_ID}/reviews?limit=100&offset=${offset}`);
    if (!r.ok) throw new Error(`reviews page ${offset} failed: ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    const results = (r.body && r.body.results) || [];
    if (total == null) { total = r.body.count; console.log(`Etsy reports ${total} reviews`); }
    if (!results.length) break;
    await upsertPage(results);
    written += results.length;
    if (written % 500 < 100) console.log(`  …${written}/${total}`);
    offset += 100;
    if (offset >= total) break;
    await sleep(150); // stay well under Etsy's 10/sec
  }
  console.log(`upserted ${written} reviews; computing summaries…`);
  const g = await recomputeSummaries(null);
  console.log(`global: ${g.count} reviews, ${g.average}★`);
}

async function buildHandleMap() {
  const snap = await admin.firestore().collection('config').doc('shopify-tokens').get();
  if (!snap.exists) throw new Error('no config/shopify-tokens');
  const tok = snap.data();
  const H = { 'X-Shopify-Access-Token': tok.access_token };
  let url = `https://${tok.shop}/admin/api/2025-01/products.json?limit=250&status=active&fields=id,title,handle`;
  const products = [];
  while (url) {
    const r = await fetch(url, { headers: H });
    const j = await r.json();
    products.push(...(j.products || []));
    const link = r.headers.get('link') || '';
    const m = link.match(/<([^>]+)>;\s*rel="next"/);
    url = m ? m[1] : null;
  }
  const map = {};
  let viaMeta = 0, viaSuffix = 0, viaOverride = 0;
  for (const p of products) {
    if (MAP_OVERRIDES[p.handle]) { map[p.handle] = MAP_OVERRIDES[p.handle]; viaOverride++; continue; }
    // Shuttle wrote the source listing id onto each imported product.
    const mf = await fetch(`https://${tok.shop}/admin/api/2025-01/products/${p.id}/metafields.json`, { headers: H }).then(r => r.json());
    const shuttle = (mf.metafields || []).find(m => (m.namespace === 'shuttle' || m.namespace === 'etsify') && /etsy_id/.test(m.key));
    if (shuttle && /^\d+$/.test(String(shuttle.value))) { map[p.handle] = Number(shuttle.value); viaMeta++; }
    else if (/-(\d{4,6})$/.test(p.handle)) viaSuffix++; // serving endpoint resolves these live
    await sleep(150);
  }
  await admin.firestore().collection(META).doc('map').set(map);
  console.log(`map: ${Object.keys(map).length} stored (${viaMeta} metafield, ${viaOverride} override); ${viaSuffix} suffixed handles resolve live`);
}

(async () => {
  const arg = process.argv[2] || '';
  if (arg !== '--map-only') await backfillReviews();
  if (arg !== '--reviews-only') await buildHandleMap();
  console.log('done');
  process.exit(0);
})().catch(e => { console.error('backfill failed:', e.message); process.exit(1); });
