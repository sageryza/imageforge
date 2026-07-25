#!/usr/bin/env node
// etsy-shopify-match.js — pair Shopify products with their Etsy listings.
//
// Titles alone are NOT a reliable key: the same product is worded differently
// per platform (Etsy titles are keyword-stuffed), and neither store uses SKUs.
// Matching on titles produced wrong pairs, and a wrong pair writes a wrong
// price. This matcher uses the two signals that actually survive the copy:
//
//   1. DESCRIPTION  — products imported Etsy→Shopify keep the description
//      verbatim, so 5-word shingle overlap is close to proof.
//   2. PHOTOS       — the same JPEG is uploaded to both stores. A perceptual
//      hash (dHash) pairs them even after re-encoding/resizing.
//   3. TITLE        — tiebreaker only.
//
// GOTCHA (cost a full wrong run once): compare LIKE SIZES. Etsy's
// url_170x135 is a center-CROP, not a scaled copy, so hashing it against a
// full-size Shopify image matches nothing. Always hash url_fullxfull, and
// normalize with resize(fit:'cover') so differing aspect ratios don't matter.
//
// Etsy's `price` on a listing with variations is the LOWEST variant price —
// so for a multi-variant product, compare it to the Shopify price RANGE's low
// end, never to a single variant.
//
// Usage:  node scripts/etsy-shopify-match.js [--json out.json]
// Needs:  FIREBASE_SERVICE_ACCOUNT (Shopify token doc), ETSY_API_KEY,
//         ETSY_SHARED_SECRET. Dormant-state Etsy listings and any write go
//         through the deployed app's /api/etsy routes (they hold the OAuth
//         token); the public Etsy API only serves ACTIVE listings.

const admin = require('firebase-admin');
const sharp = require('sharp');

const APP = process.env.FORGE_URL || 'https://imageforge-q125.onrender.com';
const SHOPS = [
  { name: 'sophiespincher', id: 14194752 },
  { name: 'sageryza', id: 14042139 },
];
// Only ONE Etsy account is authorized by the stored OAuth token. Listings in
// the other shop are readable via the public API but NOT writable — an upload
// there returns 403 "User does not own Shop <id>". A second /api/etsy/connect
// authorization (as that account) is required to write to it.
const OAUTH_SHOP_ID = 14194752;

const etsyHeaders = () => ({
  'x-api-key': `${process.env.ETSY_API_KEY}:${process.env.ETSY_SHARED_SECRET}`,
});

const strip = (s) =>
  String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function shingles(text, n = 5) {
  const w = strip(text).split(' ');
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
}

// Containment rather than plain Jaccard: a Shopify description is often the
// Etsy one plus extra store boilerplate, which would sink a symmetric score.
function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let hits = 0;
  for (const x of a) if (b.has(x)) hits++;
  return hits / Math.min(a.size, b.size);
}

async function dhash(buf) {
  const px = await sharp(buf)
    .resize(256, 256, { fit: 'cover', position: 'centre' })
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer();
  const bits = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits.push(px[y * 9 + x] < px[y * 9 + x + 1] ? 1 : 0);
  }
  return bits;
}

const hamming = (a, b) => a.reduce((s, v, i) => s + (v ^ b[i]), 0);

// Two photos are "the same picture" under ~12 bits of 64; two are duplicates
// of each other under ~4. Tuned against this catalog — widen and unrelated
// crystals start colliding.
const SAME_IMAGE = 12;
const DUPLICATE = 4;

async function fetchJson(url, opts) {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: j.body || j };
}

async function mapPool(items, fn, concurrency = 6) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (i < items.length) {
        const k = i++;
        try {
          out[k] = await fn(items[k]);
        } catch {
          out[k] = null;
        }
      }
    })
  );
  return out;
}

async function shopifyToken() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }
  const snap = await admin.firestore().collection('config').doc('shopify-tokens').get();
  if (!snap.exists) throw new Error('no config/shopify-tokens doc');
  return snap.data();
}

async function loadShopifyProducts(tok) {
  const headers = { 'X-Shopify-Access-Token': tok.access_token };
  // status=any returns nothing; each status must be queried on its own.
  let url =
    `https://${tok.shop}/admin/api/2025-01/products.json` +
    '?limit=250&status=active&fields=id,title,handle,body_html,variants,images';
  const all = [];
  while (url) {
    const r = await fetch(url, { headers });
    const j = await r.json();
    all.push(...(j.products || []));
    const link = r.headers.get('link') || '';
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : null;
  }
  return all;
}

async function loadEtsyListings() {
  const out = [];
  for (const shop of SHOPS) {
    let offset = 0;
    for (;;) {
      const { body } = await fetchJson(
        `https://openapi.etsy.com/v3/application/shops/${shop.id}/listings/active` +
          `?limit=100&offset=${offset}`,
        { headers: etsyHeaders() }
      );
      const page = body.results || [];
      page.forEach((l) =>
        out.push({
          shop: shop.name,
          shopId: shop.id,
          state: 'active',
          listingId: l.listing_id,
          title: (l.title || '').replace(/&#39;/g, "'"),
          description: l.description || '',
          // NOTE: lowest variant price when has_variations is true.
          price: l.price ? l.price.amount / l.price.divisor : null,
          hasVariations: l.has_variations,
        })
      );
      if (!body.count || offset + 100 >= body.count) break;
      offset += 100;
    }
  }
  return out;
}

// Expired / inactive / sold_out listings are invisible to the public API but
// are exactly where "missing" products hide — a lapsed listing is a renewal
// candidate, not an absent product. Only the OAuth-owned shop is reachable.
async function loadDormantListings() {
  const out = [];
  for (const state of ['inactive', 'expired', 'sold_out', 'draft']) {
    const { body } = await fetchJson(
      `${APP}/api/etsy/listings?shop_id=${OAUTH_SHOP_ID}&state=${state}`
    );
    (body.results || []).forEach((l) =>
      out.push({
        shop: 'sophiespincher',
        shopId: OAUTH_SHOP_ID,
        state,
        listingId: l.listing_id,
        title: (l.title || '').replace(/&#39;/g, "'"),
        description: '',
        price: l.price ? l.price.amount / l.price.divisor : null,
      })
    );
  }
  return out;
}

async function listingImages(listingId, shopId) {
  const { body } = await fetchJson(
    `${APP}/api/etsy/listings/${listingId}/images?shop_id=${shopId}`
  );
  return (body.results || []).map((i) => i.url_fullxfull).filter(Boolean);
}

function scorePair(product, listing, productShingles) {
  const desc = overlap(productShingles, shingles(listing.description));
  const a = strip(product.title);
  const b = strip(listing.title);
  let title = 0;
  if (a === b) title = 1;
  else if ((a.startsWith(b) || b.startsWith(a)) && Math.min(a.length, b.length) >= 12) title = 0.8;
  return { desc, title, score: desc * 0.65 + title * 0.35 };
}

/**
 * Pair each Shopify product with its Etsy listing.
 * Returns [{ product, listing, confidence, signals }] — `listing` is null when
 * nothing plausible was found (genuinely Shopify-only, e.g. sourced altar
 * goods Etsy removes for not being handmade).
 */
async function match({ withImages = true } = {}) {
  const tok = await shopifyToken();
  const [products, active, dormant] = await Promise.all([
    loadShopifyProducts(tok),
    loadEtsyListings(),
    loadDormantListings(),
  ]);
  const listings = [...active, ...dormant];

  const results = products.map((product) => {
    const ps = shingles(product.body_html);
    const ranked = listings
      .map((listing) => ({ listing, ...scorePair(product, listing, ps) }))
      .sort((x, y) => y.score - x.score);
    const top = ranked[0];
    // Prefer a live listing over a dormant one at comparable confidence — a
    // dormant listing's price is stale, and pricing off it is how a $13 live
    // item silently became $17.
    const liveAlt = ranked.find(
      (r) => r.listing.state === 'active' && r.score >= top.score - 0.15
    );
    const chosen = liveAlt || top;
    return {
      product,
      listing: chosen && chosen.score >= 0.45 ? chosen.listing : null,
      confidence: chosen ? +chosen.score.toFixed(2) : 0,
      signals: chosen ? { desc: +chosen.desc.toFixed(2), title: chosen.title } : null,
    };
  });

  if (withImages) {
    await mapPool(
      results.filter((r) => r.listing),
      async (r) => {
        r.images = await compareImages(r.product, r.listing);
      },
      4
    );
  }
  return results;
}

/**
 * Which photos exist on one side but not the other.
 * `anomaly` is true when the two sides share NO photo at all despite both
 * having several — either the pair is wrong, or the item is photographed per
 * unit (each labradorite is a different rock). Never auto-merge those: it
 * doubles the gallery with pictures of a different physical object.
 */
async function compareImages(product, listing) {
  const [shopifyUrls, etsyUrls] = [
    (product.images || []).map((i) => i.src),
    await listingImages(listing.listingId, listing.shopId),
  ];
  const hash = async (urls) =>
    (
      await mapPool(urls, async (u) => {
        const r = await fetch(u);
        if (!r.ok) throw new Error(`http ${r.status}`);
        return { url: u, h: await dhash(Buffer.from(await r.arrayBuffer())) };
      })
    ).filter(Boolean);

  const dedupe = (list) => {
    const keep = [];
    list.forEach((x) => {
      if (!keep.some((k) => hamming(k.h, x.h) <= DUPLICATE)) keep.push(x);
    });
    return keep;
  };

  const S = dedupe(await hash(shopifyUrls));
  const E = dedupe(await hash(etsyUrls));
  const missingOnEtsy = S.filter((s) => !E.some((e) => hamming(s.h, e.h) <= SAME_IMAGE));
  const missingOnShopify = E.filter((e) => !S.some((s) => hamming(e.h, s.h) <= SAME_IMAGE));
  const shared = S.length - missingOnEtsy.length;

  return {
    shopifyCount: S.length,
    etsyCount: E.length,
    shared,
    missingOnEtsy: missingOnEtsy.map((x) => x.url),
    missingOnShopify: missingOnShopify.map((x) => x.url),
    anomaly: shared === 0 && S.length >= 3 && E.length >= 3,
    // Etsy hard-caps a listing at 10 photos; uploads past that are rejected.
    etsyRoom: Math.max(0, 10 - E.length),
  };
}

module.exports = { match, compareImages, dhash, hamming, shingles, overlap };

if (require.main === module) {
  (async () => {
    const results = await match({ withImages: !process.argv.includes('--no-images') });
    const matched = results.filter((r) => r.listing);
    console.log(`${results.length} products · ${matched.length} matched · ${results.length - matched.length} Shopify-only`);
    for (const r of results) {
      const t = r.product.title.slice(0, 44).padEnd(46);
      if (!r.listing) {
        console.log(`  —  ${t}(not on Etsy)`);
        continue;
      }
      const im = r.images
        ? ` imgs ${r.images.shared} shared, +${r.images.missingOnEtsy.length}→etsy, +${r.images.missingOnShopify.length}→shopify${r.images.anomaly ? '  ANOMALY' : ''}`
        : '';
      console.log(`  ${r.confidence}  ${t}[${r.listing.shop}/${r.listing.state} $${r.listing.price}]${im}`);
    }
    const out = process.argv.indexOf('--json');
    if (out > -1 && process.argv[out + 1]) {
      require('fs').writeFileSync(process.argv[out + 1], JSON.stringify(results, null, 1));
      console.log('wrote', process.argv[out + 1]);
    }
    process.exit(0);
  })().catch((e) => {
    console.error('failed:', e.message);
    process.exit(1);
  });
}
