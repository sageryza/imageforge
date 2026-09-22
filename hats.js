'use strict';
// hats.js — the hat store (2026-09-22, Sophie: "if i wanted to make a hat
// store for my friend" · "no etsy no printify · it's thru instagram" · "use my
// buy button?" · "build the hats page").
//
// A public store page at /hats: the hats live in SOPHIE'S Shopify
// (cod-god-inc), her friend posts them on Instagram, and the bio link is this
// page. Buying is the Buy-Button model the witch app already uses — a cart on
// the public Storefront API, then Shopify's own secure checkout for the pay
// screen — so money lands in her shop and nothing here touches a card number.
//
// WHICH PRODUCTS ARE HATS: the Shopify collection whose handle is `hats`
// (HATS_COLLECTION overrides), and when that collection does not exist yet,
// every product tagged `hats`. So the friend's whole job in Shopify is: add
// the hat, tag it `hats` (or put it in the collection), publish it to the
// Online Store channel. Measured 2026-09-22: the store has neither yet, so the
// page opens on "No hats yet" until the first one is tagged.
//
// PUBLIC ON PURPOSE (the /fruit pattern): the link goes in an Instagram bio
// and buyers have no studio token. The routes spend nothing — a Storefront
// read is free and cart creation is free — so there is nothing to gate.
//
// The Storefront token is the PUBLIC one (products + carts, read-only; it
// already ships in thepeoplewatchingclub.com's page source for the same
// store), the same one server.js's witch cart uses. WITCH_STOREFRONT_TOKEN
// overrides it for a store change.
//
// Routes (mounted at /api/hats):
//   GET  /status              { ok, store, collection, cached }
//   GET  /products            { hats:[{handle,title,price,compareAt,image,images,
//                               options,variants,available,tag}], source, at }
//   POST /checkout            { variantId, quantity? } → { checkoutUrl }
//   POST /refresh             drop the 10-minute cache (after adding a hat)
//   POST /add                 { title, price, imageUrl, images?, tags?, publish?, dry? }
//                             → creates the product in her Shopify through the
//                             Admin token (shopify.js), tagged `hats`, published
//                             to the Online Store, and drops the cache. Not
//                             public: the studio token when one is set.
const express = require('express');

const STORE_DOMAIN = () => process.env.WITCH_STOREFRONT_DOMAIN || 'cod-god-inc.myshopify.com';
const TOKEN = () => process.env.WITCH_STOREFRONT_TOKEN || 'fffce1a7cf0342aedd0609333d90e3de';
const COLLECTION = () => process.env.HATS_COLLECTION || 'hats';
const TAG = () => process.env.HATS_TAG || 'hats';
const TTL_MS = 10 * 60 * 1000;

async function storefront(query, variables) {
  const r = await fetch(`https://${STORE_DOMAIN()}/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': TOKEN() },
    body: JSON.stringify({ query, variables: variables || {} }),
  });
  const j = await r.json();
  if (j.errors && j.errors.length) throw new Error(j.errors[0].message || 'storefront error');
  return j.data || {};
}

const PRODUCT_FIELDS = `id handle title descriptionHtml tags availableForSale
  images(first: 8) { edges { node { url altText } } }
  options { name values }
  variants(first: 40) { edges { node { id title availableForSale
    price { amount currencyCode } compareAtPrice { amount }
    image { url }
    selectedOptions { name value } } } }`;

// The page's shape of a Storefront product. PURE — the test drives it on a
// fixture. Shopify gives every product a synthetic "Title: Default Title"
// option; it is not a choice, so it never becomes a chip row.
function shapeProduct(p) {
  if (!p) return null;
  const variants = (p.variants?.edges || []).map(e => e.node).map(v => ({
    id: v.id,
    title: v.title,
    available: Boolean(v.availableForSale),
    price: v.price?.amount != null ? String(v.price.amount) : null,
    compareAt: v.compareAtPrice?.amount != null ? String(v.compareAtPrice.amount) : null,
    image: v.image?.url || null,
    options: (v.selectedOptions || []).reduce((m, o) => { m[o.name] = o.value; return m; }, {}),
  }));
  const prices = variants.map(v => Number(v.price)).filter(n => Number.isFinite(n));
  const images = (p.images?.edges || []).map(e => e.node.url).filter(Boolean);
  return {
    handle: p.handle,
    title: p.title,
    descriptionHtml: p.descriptionHtml || '',
    available: Boolean(p.availableForSale) && variants.some(v => v.available),
    price: prices.length ? String(Math.min(...prices)) : null,
    priceMax: prices.length ? String(Math.max(...prices)) : null,
    currency: variants.length ? (p.variants.edges[0].node.price?.currencyCode || 'USD') : 'USD',
    image: images[0] || null,
    images,
    options: (p.options || [])
      .filter(o => (o.values || []).length && !(o.name === 'Title' && o.values.length === 1 && o.values[0] === 'Default Title'))
      .map(o => ({ name: o.name, values: o.values })),
    variants,
    tags: p.tags || [],
  };
}

// Collection first, tag second — whichever the friend used in Shopify.
async function fetchHats() {
  const c = await storefront(`query($handle: String!) {
    collection(handle: $handle) { title products(first: 60) { edges { node { ${PRODUCT_FIELDS} } } } } }`,
    { handle: COLLECTION() });
  if (c.collection) {
    return { source: `collection:${COLLECTION()}`, hats: (c.collection.products?.edges || []).map(e => shapeProduct(e.node)) };
  }
  const t = await storefront(`query($q: String!) {
    products(first: 60, query: $q, sortKey: CREATED_AT, reverse: true) { edges { node { ${PRODUCT_FIELDS} } } } }`,
    { q: `tag:${TAG()}` });
  return { source: `tag:${TAG()}`, hats: (t.products?.edges || []).map(e => shapeProduct(e.node)) };
}

let CACHE = { at: 0, data: null };
async function hatsCached(force) {
  if (!force && CACHE.data && Date.now() - CACHE.at < TTL_MS) return { ...CACHE.data, cached: true };
  const data = await fetchHats();
  CACHE = { at: Date.now(), data: { ...data, at: new Date().toISOString() } };
  return { ...CACHE.data, cached: false };
}

// One hat → Shopify's checkout. A fresh cart every time: a bio-link store
// sells one hat at a time and the checkout page itself takes a quantity.
async function checkoutUrl(variantId, quantity) {
  const qty = Math.max(1, Math.min(20, parseInt(quantity, 10) || 1));
  const d = await storefront(`mutation($lines: [CartLineInput!]!) {
    cartCreate(input: { lines: $lines }) { cart { id checkoutUrl } userErrors { message } } }`,
    { lines: [{ merchandiseId: String(variantId), quantity: qty }] });
  const node = d.cartCreate || {};
  if (!node.cart) throw new Error(node.userErrors?.[0]?.message || 'could not start checkout');
  return node.cart.checkoutUrl;
}

// The Admin half: a hat goes INTO the store from a photo url and a price
// (2026-09-22, the five hats she sent as pictures). One REST product create —
// the title, the `hats` tag, one variant at the price, the pictures Shopify
// fetches from their public urls, published to the Online Store so the
// Storefront read above sees it at once. PURE planner, so the test can pin
// the body without a store.
function productPlan({ title, price, imageUrl, images, tags, publish, description } = {}) {
  const t = String(title || '').trim();
  const p = Number(price);
  if (!t) throw new Error('title required');
  if (!Number.isFinite(p) || p <= 0) throw new Error('price required (a number above 0)');
  const pics = [].concat(images || [], imageUrl || []).map(u => String(u || '').trim()).filter(u => /^https:\/\//.test(u));
  const tagSet = new Set([TAG()].concat(tags || []).map(x => String(x).trim()).filter(Boolean));
  return {
    product: {
      title: t,
      body_html: description ? String(description) : '',
      tags: [...tagSet].join(', '),
      status: 'active',
      published: publish !== false,
      variants: [{ price: p.toFixed(2), inventory_management: null, requires_shipping: true }],
      images: pics.map(src => ({ src, alt: t })),
    },
  };
}
async function addHat(fields) {
  const plan = productPlan(fields);
  const shopify = require('./shopify');
  const out = await shopify.shopifyREST('/products.json', { method: 'POST', body: plan });
  CACHE = { at: 0, data: null };
  const pr = out && out.product ? out.product : {};
  return { id: pr.id, handle: pr.handle, title: pr.title, status: pr.status, images: (pr.images || []).length, url: pr.handle ? `https://${STORE_DOMAIN()}/products/${pr.handle}` : null };
}

const router = express.Router();
router.use(express.json({ limit: '32kb' }));

// The one route that WRITES to her store keeps the studio gate when there is
// one (the rest of the module is public on purpose).
router.post('/add', (req, res, next) => {
  const want = process.env.STUDIO_TOKEN;
  if (want && req.get('x-studio-token') !== want && req.query.token !== want) return res.status(401).json({ error: 'unauthorized' });
  next();
}, async (req, res) => {
  try {
    if (req.body?.dry) return res.json({ dry: true, plan: productPlan(req.body) });
    res.json(await addHat(req.body || {}));
  } catch (err) {
    res.status(/required/.test(err.message) ? 400 : 502).json({ error: err.message });
  }
});

router.get('/status', (req, res) => {
  res.json({ ok: true, store: STORE_DOMAIN(), collection: COLLECTION(), tag: TAG(), cached: Boolean(CACHE.data && Date.now() - CACHE.at < TTL_MS) });
});

router.get('/products', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-cache');
    res.json(await hatsCached(req.query.fresh === '1'));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/refresh', async (req, res) => {
  try { res.json(await hatsCached(true)); } catch (err) { res.status(502).json({ error: err.message }); }
});

router.post('/checkout', async (req, res) => {
  try {
    const { variantId, quantity } = req.body || {};
    if (!variantId || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(String(variantId))) return res.status(400).json({ error: 'variantId required' });
    res.json({ checkoutUrl: await checkoutUrl(variantId, quantity) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = { router, shapeProduct, fetchHats, checkoutUrl, productPlan, addHat, _cache: () => CACHE };
