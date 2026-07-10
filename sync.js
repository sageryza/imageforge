// sync.js — Etsy → Shopify product sync (a self-hosted replacement for Shuttle).
//
// Two phases:
//   • AUDIT (read-only, works today): read the connected Etsy shop's active
//     listings + the Shopify store's products and report what's missing / out of
//     sync. Needs no extra scopes — Etsy `listings_r` (already granted) + the
//     public Shopify /products.json.
//   • IMPORT (later): create/update the missing products in Shopify as drafts.
//     That step needs the Shopify `write_products` scope, so it's gated behind a
//     `canWrite()` check and returns a clear message until the scope is added.
//
// Mounted at /api/sync by server.js. Same STUDIO_TOKEN gate as the rest.

const express = require('express');

function tryRequire(name) {
  try { return require(name); } catch (err) {
    console.warn(`sync: ${name} unavailable —`, err.message);
    return null;
  }
}
const etsy = tryRequire('./etsy');
const shopify = tryRequire('./shopify');
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';

// ─── Title matching (Etsy titles are long/keyword-stuffed; match on token
// overlap rather than exact string) ────────────────────────────────────
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function tokenSet(s) { return new Set(norm(s).split(' ').filter(w => w.length > 2)); }
function similarity(a, b) {
  const ta = tokenSet(a), tb = tokenSet(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

async function resolveShopId(explicit) {
  if (explicit) return explicit;
  if (process.env.ETSY_SHOP_ID) return process.env.ETSY_SHOP_ID;
  const me = await etsy.getMe();
  if (me.ok && me.body && me.body.shop_id) return me.body.shop_id;
  throw new Error('could not resolve Etsy shop_id — pass ?shop_id=');
}

function etsyPrice(p) {
  if (!p || p.amount == null) return null;
  return Math.round((Number(p.amount) / Number(p.divisor || 100)) * 100) / 100;
}

// Compare Etsy active listings against Shopify products.
async function audit({ shopId, threshold = 0.6 } = {}) {
  if (!etsy) throw new Error('etsy module unavailable');
  if (!shopify) throw new Error('shopify module unavailable');
  shopId = await resolveShopId(shopId);
  const [listingsR, products] = await Promise.all([
    etsy.getAllListings(shopId, 'active'),
    shopify.listProducts({ max: 1000 }),
  ]);
  if (!listingsR.ok) throw new Error(`Etsy listings fetch failed (${listingsR.status})`);
  const listings = listingsR.results || [];

  const matched = [], missing = [];
  for (const l of listings) {
    let best = null, bestScore = 0;
    for (const p of products) {
      const sc = similarity(l.title, p.title);
      if (sc > bestScore) { bestScore = sc; best = p; }
    }
    if (bestScore >= threshold && best) {
      matched.push({ etsy: l.title, shopify: best.title, score: Math.round(bestScore * 100) / 100, shopify_url: best.url });
    } else {
      missing.push({ title: l.title, url: l.url, price: etsyPrice(l.price), listing_id: l.listing_id, closest: best ? best.title : null, closest_score: Math.round(bestScore * 100) / 100 });
    }
  }
  return {
    etsy_shop_id: shopId,
    etsy_active_listings: listings.length,
    shopify_products: products.length,
    matched: matched.length,
    missing_from_shopify: missing.length,
    missing,
    matched_sample: matched.slice(0, 12),
    can_import: canWrite(),
    note: canWrite()
      ? 'write_products scope present — /api/sync/import can create the missing products.'
      : 'Add the Shopify write_products scope, then /api/sync/import can create the missing products as drafts.',
  };
}

// Whether the Shopify token can write products yet (scope gate for the import
// phase). We can only know for sure by trying, so this is a best-effort flag.
function canWrite() {
  const scopes = process.env.SHOPIFY_SCOPES || '';
  return /write_products/.test(scopes);
}

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();
router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

// Read-only: what's on Etsy but missing/out-of-sync on Shopify.
router.get('/audit', async (req, res) => {
  try {
    res.json(await audit({ shopId: req.query.shop_id }));
  } catch (err) {
    res.status(/unavailable/.test(err.message) ? 400 : 502).json({ error: err.message });
  }
});

module.exports = { router, audit, similarity };
