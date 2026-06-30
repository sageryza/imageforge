// printify.js — Printify API (v1) integration for the product pipeline.
//
// Printify is the "wide catalog / lower cost" POD service (800+ products,
// multiple print providers). One of the POD options the pipeline can target
// for apparel, greeting cards, etc. before handing the result to Etsy.
//
// Auth: a single Personal Access Token (a long JWT) sent as a Bearer header —
//   Authorization: Bearer <PRINTIFY_API_KEY>
// Confirmed working against GET /v1/shops.json.
//
// Mounted at /api/printify by server.js. Self-contained, zero hard deps on the
// rest of the app so it can move into a standalone tool later.

const express = require('express');
const fetch = require('node-fetch');

const API = 'https://api.printify.com/v1';
const API_KEY = process.env.PRINTIFY_API_KEY || '';
// Optional: pin the shop to use. If unset, the first shop is used.
const SHOP_ID = process.env.PRINTIFY_SHOP_ID || '';

function configured() {
  return Boolean(API_KEY);
}

// Core request helper. Returns { status, ok, body } — body parsed as JSON when
// possible, else raw text. Printify asks for a User-Agent on every request.
async function pfFetch(pathname, opts = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'User-Agent': 'ImageForge',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, ok: res.ok, body };
}

// ─── Reads ──────────────────────────────────────────────────────────
async function getShops() {
  return pfFetch('/shops.json');
}

// Resolve the shop id to operate on: explicit arg → env → first shop.
async function resolveShopId(explicit) {
  if (explicit) return String(explicit);
  if (SHOP_ID) return SHOP_ID;
  const r = await getShops();
  if (r.ok && Array.isArray(r.body) && r.body.length) return String(r.body[0].id);
  throw new Error('no_shop_found');
}

async function getCatalogBlueprints() {
  return pfFetch('/catalog/blueprints.json');
}

// Print providers + variants for a blueprint — needed to build a product.
async function getBlueprintProviders(blueprintId) {
  return pfFetch(`/catalog/blueprints/${blueprintId}/print_providers.json`);
}

async function getProviderVariants(blueprintId, providerId) {
  return pfFetch(`/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`);
}

async function listProducts(shopId) {
  const id = await resolveShopId(shopId);
  return pfFetch(`/shops/${id}/products.json`);
}

// ─── Writes ─────────────────────────────────────────────────────────
// Upload artwork to the media library so it can be referenced by id in a
// product's print_areas. Accepts a public URL or base64 contents.
async function uploadImage({ fileName, url, contents }) {
  const payload = { file_name: fileName || 'design.png' };
  if (url) payload.url = url;
  else if (contents) payload.contents = contents; // base64 (no data: prefix)
  else throw new Error('uploadImage requires url or contents');
  return pfFetch('/uploads/images.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// Create a product. The caller supplies the full product spec (title,
// description, blueprint_id, print_provider_id, variants[], print_areas[]) —
// Printify's product shape is too rich to usefully abstract here, so we pass it
// through and just resolve the shop. Created products are unpublished drafts
// until publish() is called.
async function createProduct(product, shopId) {
  const id = await resolveShopId(shopId);
  return pfFetch(`/shops/${id}/products.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
}

// Publish a product to the shop's connected sales channel. For the Etsy
// pipeline we usually DON'T call this — Printify's own Etsy integration can
// push it, or we create the Etsy draft ourselves via etsy.js. Provided for
// completeness.
async function publishProduct(productId, shopId, opts = {}) {
  const id = await resolveShopId(shopId);
  const body = {
    title: true, description: true, images: true, variants: true,
    tags: true, keyFeatures: true, shipping_template: true, ...opts,
  };
  return pfFetch(`/shops/${id}/products/${productId}/publish.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();

router.get('/status', async (req, res) => {
  if (!configured()) return res.json({ configured: false });
  const r = await getShops();
  res.json({
    configured: true,
    connected: r.ok,
    shops: r.ok && Array.isArray(r.body)
      ? r.body.map(s => ({ id: s.id, title: s.title, sales_channel: s.sales_channel }))
      : undefined,
    error: r.ok ? undefined : r.body,
  });
});

router.get('/shops', async (req, res) => {
  const r = await getShops();
  res.status(r.status).json(r.body);
});

router.get('/catalog/blueprints', async (req, res) => {
  const r = await getCatalogBlueprints();
  res.status(r.status).json(r.body);
});

router.get('/products', async (req, res) => {
  try {
    const r = await listProducts(req.query.shop_id);
    res.status(r.status).json(r.body);
  } catch (err) { res.status(502).json({ error: err.message }); }
});

router.post('/uploads', express.json({ limit: '25mb' }), async (req, res) => {
  try {
    const r = await uploadImage(req.body || {});
    res.status(r.status).json(r.body);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/products', express.json({ limit: '25mb' }), async (req, res) => {
  const { shop_id, ...product } = req.body || {};
  if (!product.blueprint_id || !product.print_provider_id) {
    return res.status(400).json({ error: 'blueprint_id and print_provider_id required' });
  }
  try {
    const r = await createProduct(product, shop_id);
    res.status(r.status).json(r.body);
  } catch (err) { res.status(502).json({ error: err.message }); }
});

module.exports = {
  router,
  configured,
  getShops,
  resolveShopId,
  getCatalogBlueprints,
  getBlueprintProviders,
  getProviderVariants,
  listProducts,
  uploadImage,
  createProduct,
  publishProduct,
};
