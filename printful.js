// printful.js — Printful API integration for the product pipeline.
//
// Printful is the "in-house quality / premium" POD service — it prints and
// fulfils its own apparel and greeting cards rather than brokering to third-
// party providers, so quality and turnaround are more consistent than the wide
// marketplace alternatives. It also ships a direct Etsy integration, so a sync
// product created here can be pushed to Etsy without a separate listing call.
// One of the POD options the pipeline can target for apparel, greeting cards,
// etc. before handing the result to Etsy.
//
// Auth: a single account-level API token (OAuth bearer / private token) sent as
// a Bearer header —
//   Authorization: Bearer <PRINTFUL_API_KEY>
// Account-level tokens are not scoped to one store; an optional X-PF-Store-Id
// header selects which store an endpoint acts on. We send it whenever a store id
// is supplied explicitly or via PRINTFUL_STORE_ID.
//
// Printful wraps every response in a { code, result, ... } envelope. pfFetch
// returns the raw parsed body — callers read body.result themselves.
//
// Mounted at /api/printful by server.js. Self-contained, zero hard deps on the
// rest of the app so it can move into a standalone tool later.

const express = require('express');
const fetch = require('node-fetch');

const API = 'https://api.printful.com';
const API_KEY = process.env.PRINTFUL_API_KEY || '';
// Optional: pin the store to operate on. Account tokens span all of an account's
// stores; this picks one without the caller passing it every time.
const STORE_ID = process.env.PRINTFUL_STORE_ID || '';

function configured() {
  return Boolean(API_KEY);
}

// Core request helper. Returns { status, ok, body } — body parsed as JSON when
// possible, else raw text. Printful wraps results in { code, result, ... }, so
// callers read body.result. Sends X-PF-Store-Id when a store id is provided
// (arg) or pinned via env.
async function pfFetch(pathname, opts = {}) {
  const { storeId, ...rest } = opts;
  const store = storeId || STORE_ID;
  const res = await fetch(`${API}${pathname}`, {
    ...rest,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      ...(store ? { 'X-PF-Store-Id': String(store) } : {}),
      ...(rest.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, ok: res.ok, body };
}

// ─── Reads ──────────────────────────────────────────────────────────
// The account's stores. Each result item has { id, name, type, ... }.
async function getStores() {
  return pfFetch('/stores');
}

// The Printful catalog of base products (t-shirts, cards, etc.). No store
// context needed — this is account/catalog-wide.
async function getCatalogProducts() {
  return pfFetch('/products');
}

// Variant info for one catalog product — sizes/colours and their variant ids,
// needed to build a sync product. Returns { product, variants }.
async function getProductVariants(productId) {
  return pfFetch(`/products/${productId}`);
}

// Sync products already in a store (the store's own product list).
async function getSyncProducts(storeId) {
  return pfFetch('/store/products', { storeId });
}

// ─── Writes ─────────────────────────────────────────────────────────
// Create a sync product. The caller supplies the full spec ({ sync_product,
// sync_variants[] }) — Printful's product shape is too rich to usefully
// abstract here, so we pass it through and just attach the store context.
// Created products are drafts in Printful until pushed to the connected channel.
async function createProduct(product, storeId) {
  return pfFetch('/store/products', {
    method: 'POST',
    storeId,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
}

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();

router.get('/status', async (req, res) => {
  if (!configured()) return res.json({ configured: false, connected: false });
  const r = await getStores();
  const stores = r.ok && r.body && Array.isArray(r.body.result)
    ? r.body.result.map(s => ({ id: s.id, name: s.name }))
    : undefined;
  res.json({
    configured: true,
    connected: r.ok,
    stores,
    error: r.ok ? undefined : r.body,
  });
});

router.get('/stores', async (req, res) => {
  const r = await getStores();
  res.status(r.status).json(r.body);
});

router.get('/catalog/products', async (req, res) => {
  const r = await getCatalogProducts();
  res.status(r.status).json(r.body);
});

router.post('/products', express.json({ limit: '25mb' }), async (req, res) => {
  const { store_id, ...product } = req.body || {};
  if (!product.sync_product) {
    return res.status(400).json({ error: 'sync_product required' });
  }
  try {
    const r = await createProduct(product, store_id);
    res.status(r.status).json(r.body);
  } catch (err) { res.status(502).json({ error: err.message }); }
});

module.exports = {
  router,
  configured,
  getStores,
  getCatalogProducts,
  getProductVariants,
  createProduct,
  getSyncProducts,
};
