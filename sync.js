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

// ─── Title matching ─────────────────────────────────────────────────
// Etsy titles are long/keyword-stuffed, so match on token overlap — but use
// JACCARD (intersection / UNION), not intersection/min. The min-denominator
// version falsely matched different card decks that merely share generic words
// ("magic", "cards", "deck"); Jaccard penalises the words that DON'T overlap, so
// "Magic Rituals Card Deck" no longer collides with "Magic of Flower Cards".
// Generic filler words are dropped so distinctive nouns drive the score.
const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'set', 'kit', 'gift', 'witch', 'witchcraft', 'wiccan', 'pagan', 'witchy', 'magic', 'magical', 'supplies', 'handmade']);
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function tokenSet(s) {
  return new Set(norm(s).split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w)));
}
function similarity(a, b) {
  const ta = tokenSet(a), tb = tokenSet(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  const union = ta.size + tb.size - inter;
  return union ? inter / union : 0;
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

// Compare Etsy active listings against Shopify products. Returns a full,
// reviewable per-listing breakdown — every Etsy listing with its best Shopify
// match, the match confidence, and a price comparison — plus a verdict:
//   match       — confident it's the same product
//   review      — a weak/ambiguous match, eyeball it
//   missing     — no real match in Shopify (needs importing)
//   price_diff  — matched, but the Etsy vs Shopify price disagrees
async function audit({ shopId, matchAt = 0.5, reviewAt = 0.28 } = {}) {
  if (!etsy) throw new Error('etsy module unavailable');
  if (!shopify) throw new Error('shopify module unavailable');
  shopId = await resolveShopId(shopId);
  const [listingsR, products] = await Promise.all([
    etsy.getAllListings(shopId, 'active'),
    shopify.listProducts({ max: 1000 }),
  ]);
  if (!listingsR.ok) throw new Error(`Etsy listings fetch failed (${listingsR.status})`);
  const listings = listingsR.results || [];

  const rows = [];
  for (const l of listings) {
    let best = null, bestScore = 0;
    for (const p of products) {
      const sc = similarity(l.title, p.title);
      if (sc > bestScore) { bestScore = sc; best = p; }
    }
    const ePrice = etsyPrice(l.price);
    const sPrice = best && best.price != null ? Number(best.price) : null;
    let verdict;
    if (bestScore < reviewAt || !best) verdict = 'missing';
    else if (bestScore < matchAt) verdict = 'review';
    else if (ePrice != null && sPrice != null && Math.abs(ePrice - sPrice) / Math.max(ePrice, sPrice) > 0.15) verdict = 'price_diff';
    else verdict = 'match';
    rows.push({
      etsy_title: l.title,
      etsy_url: l.url,
      etsy_price: ePrice,
      shopify_title: verdict === 'missing' ? null : (best ? best.title : null),
      shopify_price: verdict === 'missing' ? null : sPrice,
      score: Math.round(bestScore * 100) / 100,
      verdict,
    });
  }

  const by = v => rows.filter(r => r.verdict === v);
  return {
    etsy_shop_id: shopId,
    etsy_active_listings: listings.length,
    shopify_products: products.length,
    summary: {
      match: by('match').length,
      review: by('review').length,
      missing: by('missing').length,
      price_diff: by('price_diff').length,
    },
    missing: by('missing'),
    review: by('review'),
    price_diff: by('price_diff'),
    rows,
    can_import: canWrite(),
    note: 'Only the connected Etsy shop + presence/price are checked; variation-level sync comes with the write phase. '
      + (canWrite() ? 'write_products present — import can run.' : 'Add write_products to enable the create/update import.'),
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
