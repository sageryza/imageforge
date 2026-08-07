// etsy-report.js — the shop intelligence report.
//
// Pulls listings + orders + reviews through the etsy.js module, cross-references
// views/favorites against actual sales, and answers the questions a seller
// actually asks: what's selling, what's quietly converting well (hidden gems),
// what has traffic but never sells (stalled), what a sale event should target
// (favorites = a pre-built notify audience), and what's worth ad spend (proven
// converters — ads multiply traffic, so send them to listings that convert).
// `?advice=1` adds a short plain-English advice section on top (Claude).
//
// Mounted at /api/etsy/report by server.js; the phone-friendly page is /report.
// Same STUDIO_TOKEN gate as the rest of the pipeline.
//
// Honest-limits note baked into the math: listing views/favorites are LIFETIME
// numbers from Etsy while sales are windowed to ?days, so "conversion" here is
// a ranking heuristic, not a true rate. It's still the right ordering signal —
// just don't read the percentages as gospel.

const express = require('express');
const fetch = require('node-fetch');
const etsy = require('./etsy');
const anthropic = require('./anthropic');   // the advice runs on Claude

const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
function requireToken(req, res, next) {
  if (!STUDIO_TOKEN || req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

// Etsy Money type → plain number (amount/divisor).
function money(m) {
  if (!m || m.amount == null) return 0;
  return m.amount / (m.divisor || 100);
}
const round2 = n => Math.round(n * 100) / 100;

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function resolveShopId(explicit) {
  if (explicit) return explicit;
  if (process.env.ETSY_SHOP_ID) return process.env.ETSY_SHOP_ID;
  const me = await etsy.getMe();
  if (me.ok && me.body && me.body.shop_id) return me.body.shop_id;
  throw new Error('could not resolve shop_id — pass ?shop_id= or set ETSY_SHOP_ID');
}

// `advice` defaults to FALSE on purpose (Aug 2026, Sophie: "it starts making it
// as soon as I go to that page. I don't even click anything, and I think it
// spends money" — she was right). Opening a page must never spend; the advice
// is a separate deliberate tap. Pass advice:true / ?advice=1 to ask for it.
async function buildReport({ shopId, days = 90, advice = false } = {}) {
  shopId = await resolveShopId(shopId);
  const minCreated = Math.floor(Date.now() / 1000) - days * 86400;

  const [listingsR, receiptsR, reviewsR] = await Promise.all([
    etsy.getAllListings(shopId, 'active'),
    etsy.getReceipts(shopId, { minCreated }),
    etsy.getReviews(shopId),
  ]);

  // A 403 on receipts/reviews means the stored token predates the wider scopes
  // (transactions_r) — the report still renders its listing half, with a
  // reconnect banner instead of sales data.
  const needsReconnect = [receiptsR, reviewsR].some(r => !r.ok && (r.status === 403 || r.status === 401));
  const listings = listingsR.ok ? listingsR.results : [];
  const receipts = receiptsR.ok ? receiptsR.results : [];
  const reviews = reviewsR.ok ? reviewsR.results : [];
  if (!listingsR.ok) {
    const detail = typeof listingsR.body === 'object' ? JSON.stringify(listingsR.body) : listingsR.body;
    throw new Error(`listings fetch failed (${listingsR.status}): ${detail}`);
  }

  // ── Aggregate sales per listing from the receipts' line items ──────
  const salesByListing = new Map(); // listing_id -> { units, revenue, orders, last, title }
  const buyers = new Set();
  let totalRevenue = 0;
  for (const rec of receipts) {
    if (rec.buyer_user_id) buyers.add(rec.buyer_user_id);
    totalRevenue += money(rec.grandtotal);
    for (const t of rec.transactions || []) {
      const s = salesByListing.get(t.listing_id) ||
        { units: 0, revenue: 0, orders: 0, last: 0, title: t.title || '' };
      const qty = t.quantity || 1;
      s.units += qty;
      s.revenue += money(t.price) * qty;
      s.orders += 1;
      s.last = Math.max(s.last, t.paid_timestamp || rec.created_timestamp || 0);
      salesByListing.set(t.listing_id, s);
    }
  }

  // ── One row per listing: Etsy's lifetime traffic numbers + windowed sales ──
  const rows = listings.map(l => {
    const s = salesByListing.get(l.listing_id) || { units: 0, revenue: 0, orders: 0, last: 0 };
    const views = l.views || 0;
    return {
      listing_id: l.listing_id,
      title: l.title,
      url: l.url,
      price: round2(money(l.price)),
      currency: l.price && l.price.currency_code,
      quantity: l.quantity,
      views,
      favorites: l.num_favorers || 0,
      units: s.units,
      revenue: round2(s.revenue),
      orders: s.orders,
      conversion: views ? round2((s.units / views) * 100) : null, // heuristic — see header note
      last_sale: s.last ? new Date(s.last * 1000).toISOString().slice(0, 10) : null,
    };
  });
  // Things that sold in the window but aren't in the active list (sold out,
  // expired, deactivated) still belong in the sales picture.
  for (const [id, s] of salesByListing) {
    if (!rows.some(r => r.listing_id === id)) {
      rows.push({
        listing_id: id, title: s.title, url: `https://www.etsy.com/listing/${id}`,
        price: null, currency: null, quantity: 0, views: 0, favorites: 0,
        units: s.units, revenue: round2(s.revenue), orders: s.orders, conversion: null,
        last_sale: s.last ? new Date(s.last * 1000).toISOString().slice(0, 10) : null,
        not_active: true,
      });
    }
  }

  const sold = rows.filter(r => r.units > 0);
  const unsold = rows.filter(r => r.units === 0 && !r.not_active);
  const medViews = median(rows.filter(r => !r.not_active).map(r => r.views));
  const cutoff30 = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10);

  const sections = {
    // What's selling — the money-makers, by revenue.
    top_sellers: [...sold].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    // Hidden gems — they convert, but few people see them. Visibility problem;
    // these deserve better tags/photos/ads, not discounts.
    hidden_gems: sold
      .filter(r => r.conversion != null && r.views < Math.max(medViews, 1))
      .sort((a, b) => b.conversion - a.conversion).slice(0, 5),
    // Stalled — plenty of eyes, zero purchases. Price / photos / trust problem.
    stalled: unsold
      .filter(r => r.views >= Math.max(medViews, 20))
      .sort((a, b) => b.views - a.views).slice(0, 5),
    // Sale candidates — favorites are shoppers Etsy will NOTIFY when the item
    // goes on sale. Rank shelf-sitters by that waiting audience.
    sale_candidates: rows
      .filter(r => !r.not_active && r.favorites > 0 && (r.units === 0 || (r.last_sale && r.last_sale < cutoff30)))
      .sort((a, b) => b.favorites - a.favorites).slice(0, 5),
    // Ad candidates — proven converters. Ads buy traffic; only buy traffic for
    // listings that already turn traffic into sales.
    ad_candidates: sold
      .filter(r => r.units >= 2 && !r.not_active)
      .sort((a, b) => (b.conversion || 0) - (a.conversion || 0)).slice(0, 5),
  };

  const ratings = reviews.map(r => r.rating).filter(Boolean);
  const reviewSummary = {
    count: reviews.length,
    average: ratings.length ? round2(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null,
    recent: reviews.slice(0, 5).map(r => ({
      rating: r.rating,
      text: (r.review || '').slice(0, 200),
      listing_id: r.listing_id,
      date: r.created_timestamp ? new Date(r.created_timestamp * 1000).toISOString().slice(0, 10) : null,
    })),
    low_recent: reviews.filter(r => r.rating && r.rating <= 3).slice(0, 3).map(r => ({
      rating: r.rating, text: (r.review || '').slice(0, 200), listing_id: r.listing_id,
    })),
  };

  const report = {
    shop_id: Number(shopId) || shopId,
    window_days: days,
    generated_at: new Date().toISOString(),
    needs_reconnect: needsReconnect || undefined,
    totals: {
      revenue: round2(totalRevenue),
      currency: receipts.length ? (receipts[0].grandtotal && receipts[0].grandtotal.currency_code) : null,
      orders: receipts.length,
      units: sold.reduce((a, r) => a + r.units, 0),
      distinct_buyers: buyers.size,
      repeat_buyers: receipts.length - buyers.size,
      average_order: receipts.length ? round2(totalRevenue / receipts.length) : 0,
      active_listings: listings.length,
      listings_with_sales: sold.filter(r => !r.not_active).length,
    },
    sections,
    reviews: reviewSummary,
    notes: [
      'views/favorites are lifetime totals from Etsy; sales are windowed — conversion is a ranking heuristic, not a true rate',
      needsReconnect ? 'orders/reviews unavailable: re-authorize at /api/etsy/connect to grant the new transactions scope' : null,
    ].filter(Boolean),
  };

  if (advice && anthropic.available() && !needsReconnect) {
    try { report.advice = await writeAdvice(report); }
    catch (err) { report.advice_error = err.message; }
  }
  return report;
}

// A short seller-advice write-up from the numbers. Runs on Claude (Aug 2026,
// Sophie) — this is advice she makes real spending decisions from, so it is
// exactly the kind of judgment worth paying for. It no longer runs on every
// load (see buildReport), so the per-call price stopped being the thing that
// mattered: ~400 output tokens is well under a cent, only when she asks.
async function writeAdvice(report) {
  const compact = {
    window_days: report.window_days,
    totals: report.totals,
    top_sellers: report.sections.top_sellers.map(({ title, revenue, units, views, favorites, conversion, price }) => ({ title, revenue, units, views, favorites, conversion, price })),
    hidden_gems: report.sections.hidden_gems.map(({ title, conversion, views, units }) => ({ title, conversion, views, units })),
    stalled: report.sections.stalled.map(({ title, views, favorites, price }) => ({ title, views, favorites, price })),
    sale_candidates: report.sections.sale_candidates.map(({ title, favorites, last_sale }) => ({ title, favorites, last_sale })),
    ad_candidates: report.sections.ad_candidates.map(({ title, conversion, units, revenue }) => ({ title, conversion, units, revenue })),
    reviews: { count: report.reviews.count, average: report.reviews.average, low_recent: report.reviews.low_recent },
  };
  return anthropic.chat({
    system: 'You advise a small handmade Etsy shop owner. Given her shop data as JSON, write friendly, concrete advice: 1) what is working, 2) which listings deserve ad budget and why, 3) what a sale/discount event should target, 4) one experiment to try this week. Short paragraphs or bullets, plain language, no tables, no markdown headers. Mention listings by name. If the data is thin, say so honestly and keep advice proportionate.',
    user: JSON.stringify(compact),
    temperature: 0.4,
    maxTokens: 900,
  });
}

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();

// GET /api/etsy/report?days=90&shop_id=&advice=1
// Numbers are free; `advice=1` is the only thing here that spends money.
router.get('/', requireToken, async (req, res) => {
  try {
    const report = await buildReport({
      shopId: req.query.shop_id,
      days: Math.min(Math.max(Number(req.query.days) || 90, 1), 365),
      advice: req.query.advice === '1',
    });
    res.json(report);
  } catch (err) {
    const code = err.message === 'not_connected' ? 401 : 502;
    res.status(code).json({ error: err.message });
  }
});

module.exports = { router, buildReport };
