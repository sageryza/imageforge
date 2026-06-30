// pipeline.js — the product pipeline orchestration layer.
//
// Ties the stages together so Sophie (via Claude Code or the hub) can go from a
// theme to a reviewable Etsy draft:
//
//   describe idea → generate design(s) → pick POD service → create product
//                 → AI-write listing content (SEO) → create DRAFT Etsy listing
//                 → upload the design → Sophie reviews & publishes
//
// Design generation already lives in server.js (`/api/generate/*`), and each
// service has its own module (etsy.js, printify.js, printful.js, lulu.js). This
// module adds the glue the pipeline needs but none of them own:
//   1. AI listing-content generation (title / 13 tags / SEO description)
//   2. a product-type → POD-service router
//   3. a one-call "create the Etsy draft + upload the image" orchestration
//   4. an aggregate status across every service
//
// Mounted at /api/pipeline by server.js. Self-contained: the POD modules are
// required defensively so a single missing/broken module never blocks boot.

const express = require('express');
const fetch = require('node-fetch');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';

// Replicate background-removal model (turns a design into a transparent PNG —
// essential for apparel so the art prints clean, not as a filled rectangle).
const BG_REMOVE_MODEL = '851-labs/background-remover';
let bgRemoveVersion = null; // resolved + cached on first use

// Defensive requires — if a module file is missing or fails to load, treat that
// service as simply unavailable rather than crashing the whole server.
function tryRequire(name) {
  try { return require(name); } catch (err) {
    console.warn(`pipeline: ${name} unavailable —`, err.message);
    return null;
  }
}
const etsy = tryRequire('./etsy');
const printify = tryRequire('./printify');
const printful = tryRequire('./printful');
const lulu = tryRequire('./lulu');
const configLoader = tryRequire('./config-loader');

// ─── Product-type → POD service routing ─────────────────────────────
// Maps the product types from the handoff to the service that prints them.
// Books go to Lulu; apparel/cards default to Printify (wider catalog, cheaper)
// with Printful as the quality alternative. Card decks are manual (no API).
const POD_ROUTES = [
  { match: /color(ing)?\s*book|book|zine/i, service: 'lulu' },
  { match: /sweat|hoodie|shirt|tee|apparel|tote|garment/i, service: 'printify' },
  { match: /card|greeting|postcard|print|poster|sticker/i, service: 'printify' },
  { match: /deck|oracle|tarot/i, service: 'manual' },
];

const SERVICES = { etsy, printify, printful, lulu };

function routePOD(productType = '') {
  const hit = POD_ROUTES.find(r => r.match.test(productType));
  return hit ? hit.service : 'printify';
}

// ─── AI listing content ─────────────────────────────────────────────
// Minimal OpenAI chat call (JSON mode) — kept local so this module stays
// self-contained. Mirrors server.js's model choice (gpt-4o-mini) and its
// "Connection: close" retry guard against dropped keep-alive sockets.
async function openaiJSON(messages, retries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'Connection': 'close',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.8,
        }),
      });
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '{}';
      return JSON.parse(text);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// Enforce Etsy's listing limits regardless of what the model returns:
// title ≤140 chars, ≤13 tags each ≤20 chars.
function clampListing(content) {
  const title = String(content.title || '').slice(0, 140).trim();
  const tags = etsy && etsy.validateTags
    ? etsy.validateTags(content.tags)
    : (Array.isArray(content.tags) ? content.tags.map(t => String(t).trim()).filter(t => t && t.length <= 20).slice(0, 13) : []);
  const description = String(content.description || '').trim();
  // Etsy materials allow only letters, numbers, and spaces (no hyphens/punct),
  // ≤45 chars each, ≤13 total. Sanitize so AI-written values (e.g.
  // "eco-friendly ink") don't get rejected with invalid_characters.
  const materials = Array.isArray(content.materials)
    ? content.materials
        .map(m => String(m).replace(/[^A-Za-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 45))
        .filter(Boolean)
        .slice(0, 13)
    : undefined;
  return { title, tags, description, ...(materials && materials.length ? { materials } : {}) };
}

// Generate SEO-optimized Etsy listing content from a theme + product type.
async function generateListingContent({ theme, productType = 'art print', audience, extraContext } = {}) {
  if (!theme) throw new Error('theme required');
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const sys = [
    'You are an expert Etsy SEO copywriter for a small illustrated-goods shop.',
    'Write listing content that ranks and converts. Front-load the most-searched keywords.',
    'Hard rules: title MUST be <= 140 characters; provide EXACTLY 13 tags; each tag MUST be <= 20 characters and be a real multi-word buyer search phrase (no single generic words, no punctuation); description should be 2-4 short paragraphs, scannable, keyword-rich but human.',
    'Return STRICT JSON: {"title": string, "tags": string[13], "description": string, "materials": string[] }.',
  ].join(' ');
  const user = [
    `Product type: ${productType}.`,
    `Design theme: ${theme}.`,
    audience ? `Target audience: ${audience}.` : '',
    extraContext ? `Extra context: ${extraContext}.` : '',
  ].filter(Boolean).join('\n');
  const raw = await openaiJSON([
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ]);
  return clampListing(raw);
}

// ─── Orchestration: design → Etsy draft ─────────────────────────────
// Creates a DRAFT Etsy listing and uploads one or more design images to it.
// Listing content can be supplied directly, or auto-generated from theme +
// productType when `generateContent` is set. Returns the draft + per-image
// upload results so the caller can surface the Etsy dashboard link.
async function publishDraft(opts = {}) {
  if (!etsy) throw new Error('etsy module unavailable');
  const {
    shop_id,
    images = [],            // array of public image URLs (or {url, rank})
    price, quantity = 1, taxonomy_id, who_made, when_made, type, legacy,
    shipping_profile_id, readiness_state_id, return_policy_id,
    // free-form extra Etsy listing fields (e.g. item_weight, item_length,
    // item_width, item_height, item_weight_unit, item_dimensions_unit — needed
    // when the shipping profile uses calculated shipping). Forwarded as-is.
    extra: extraFields,
    // either provide title/tags/description directly...
    title, tags, description, materials,
    // ...or ask the pipeline to write them:
    generateContent = false, theme, productType, audience,
  } = opts;
  if (!shop_id) throw new Error('shop_id required');

  let content = { title, tags, description, materials };
  if (generateContent) {
    content = await generateListingContent({ theme, productType, audience });
  }

  // Physical listings need a shipping profile, a return policy, and (on the new
  // model) a readiness state. Pass through whatever the caller supplies, plus
  // any free-form extra fields.
  const extra = { ...(extraFields || {}) };
  if (shipping_profile_id) extra.shipping_profile_id = shipping_profile_id;
  if (readiness_state_id) extra.readiness_state_id = readiness_state_id;
  if (return_policy_id) extra.return_policy_id = return_policy_id;

  const draftRes = await etsy.createDraftListing(shop_id, {
    ...content, price, quantity, taxonomy_id, who_made, when_made, type, legacy,
    extra: Object.keys(extra).length ? extra : undefined,
  });
  if (!draftRes.ok) {
    return { ok: false, stage: 'create_draft', status: draftRes.status, body: draftRes.body };
  }
  const listingId = draftRes.body && draftRes.body.listing_id;

  const imageResults = [];
  const imgList = Array.isArray(images) ? images : [images];
  for (let i = 0; i < imgList.length; i++) {
    const img = imgList[i];
    const url = typeof img === 'string' ? img : img.url;
    const rank = typeof img === 'object' && img.rank != null ? img.rank : i + 1;
    try {
      const up = await etsy.uploadListingImage(shop_id, listingId, url, { rank, filename: `design-${i + 1}.png` });
      imageResults.push({ ok: up.ok, status: up.status, listing_image_id: up.body && up.body.listing_image_id });
    } catch (err) {
      imageResults.push({ ok: false, error: err.message });
    }
  }

  return {
    ok: true,
    listing_id: listingId,
    content,
    images: imageResults,
    etsy: draftRes.body,
  };
}

// ─── Background removal ─────────────────────────────────────────────
// Run a design through Replicate's background remover and return a transparent
// PNG URL. Polls the prediction (same pattern as the upscaler in server.js).
// The returned URL is a temporary Replicate URL — fine for an immediate
// Printify upload (Printify fetches and stores it).
async function removeBackground(imageUrl) {
  if (!REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN not set');
  if (!imageUrl) throw new Error('imageUrl required');
  if (!bgRemoveVersion) {
    const mr = await fetch(`https://api.replicate.com/v1/models/${BG_REMOVE_MODEL}`, {
      headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
    });
    const mj = await mr.json();
    if (!mj.latest_version) throw new Error('could not resolve bg-removal model version');
    bgRemoveVersion = mj.latest_version.id;
  }
  const create = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: bgRemoveVersion, input: { image: imageUrl } }),
  });
  let p = await create.json();
  if (p.error) throw new Error(p.error.detail || JSON.stringify(p.error));
  if (!p.urls || !p.urls.get) throw new Error(p.detail || 'no polling url from Replicate');
  let n = 0;
  while (!['succeeded', 'failed', 'canceled'].includes(p.status) && n < 60) {
    await new Promise(r => setTimeout(r, 2000));
    p = await (await fetch(p.urls.get, { headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` } })).json();
    n++;
  }
  if (p.status !== 'succeeded') throw new Error(`bg-removal ${p.status}: ${p.error || ''}`);
  const out = Array.isArray(p.output) ? p.output[0] : p.output;
  if (!out) throw new Error('bg-removal produced no image');
  return out;
}

// ─── Orchestration: design → Printify product (→ Etsy auto-fulfillment) ──
// Creates a print-on-demand product in Printify from a design. Unlike the Etsy
// draft path (which we fulfil ourselves), a Printify product PUBLISHED to a
// connected Etsy shop auto-fulfils on sale — Printify prints and ships.
//
// Steps: upload the design (unless an image id is given) → build the variants
// (id + price + enabled) and the front print area → create the product →
// optionally publish to the connected Etsy store. Title/description/tags can be
// supplied directly or AI-written (they flow onto the Etsy listing at publish).
//
// SAFE BY DEFAULT: the product is created HIDDEN (visible:false) so publishing
// lands it on Etsy as a DRAFT, never a live/purchasable listing. Pass
// goLive: true to make it a live listing on purpose.
//
// NOTE: `publish` only works once the Etsy shop is connected as a sales channel
// inside Printify; otherwise it returns a Printify error (the product is still
// created and can be published later).
async function createPrintifyProduct(opts = {}) {
  if (!printify) throw new Error('printify module unavailable');
  const {
    shop_id, blueprint_id, print_provider_id,
    variant_ids = [], price,             // price in cents (e.g. 2499 = $24.99)
    image,                               // { url } | { contents } | { id }
    title, description, tags,
    generateContent = false, theme, productType = 'shirt', audience,
    placement = {},                      // { position, x, y, scale, angle }
    removeBackground: removeBg = false,  // strip the design's background first (apparel)
    publish = false,
    // SAFE BY DEFAULT: create the product hidden so that when it publishes to
    // Etsy it lands as a DRAFT, not a live/purchasable listing. Opt into a live
    // listing explicitly with goLive: true. (Printify's `visible` field is the
    // "Hide in Store" toggle; visible=false → Etsy draft.)
    goLive = false,
  } = opts;
  if (!blueprint_id || !print_provider_id) throw new Error('blueprint_id and print_provider_id required');
  if (!Array.isArray(variant_ids) || !variant_ids.length) throw new Error('variant_ids required');
  if (price == null) throw new Error('price (in cents) required');

  // Content: supplied directly, or AI-written (also used for the Etsy listing
  // once Printify publishes the product).
  let content = { title, description, tags };
  if (generateContent) content = await generateListingContent({ theme, productType, audience });
  if (!content.title) throw new Error('title required (or set generateContent)');

  // Resolve the Printify image id (upload the design if not already uploaded).
  let imageId = image && image.id;
  if (!imageId) {
    if (!image || (!image.url && !image.contents)) {
      throw new Error('image.url, image.contents, or image.id required');
    }
    let uploadUrl = image.url;
    let uploadContents = image.contents;
    // Optionally strip the background first (needs a URL input). Replaces the
    // upload source with the resulting transparent PNG.
    if (removeBg && uploadUrl) {
      uploadUrl = await removeBackground(uploadUrl);
      uploadContents = undefined;
    }
    const up = await printify.uploadImage({
      fileName: image.fileName || 'design.png', url: uploadUrl, contents: uploadContents,
    });
    if (!up.ok || !up.body || !up.body.id) {
      return { ok: false, stage: 'upload_image', status: up.status, body: up.body };
    }
    imageId = up.body.id;
  }

  const place = {
    position: placement.position || 'front',
    x: placement.x ?? 0.5, y: placement.y ?? 0.5,
    scale: placement.scale ?? 1, angle: placement.angle ?? 0,
  };
  const product = {
    title: content.title,
    description: content.description || content.title,
    blueprint_id, print_provider_id,
    visible: goLive === true,            // false → publishes to Etsy as a draft
    variants: variant_ids.map(id => ({ id, price, is_enabled: true })),
    print_areas: [{
      variant_ids,
      placeholders: [{ position: place.position, images: [{ id: imageId, x: place.x, y: place.y, scale: place.scale, angle: place.angle }] }],
    }],
  };
  if (Array.isArray(content.tags) && content.tags.length) product.tags = content.tags;

  const res = await printify.createProduct(product, shop_id);
  if (!res.ok) return { ok: false, stage: 'create_product', status: res.status, body: res.body };
  const productId = res.body && res.body.id;

  let published;
  if (publish) {
    const pub = await printify.publishProduct(productId, shop_id);
    published = { ok: pub.ok, status: pub.status, body: pub.body };
  }
  return {
    ok: true,
    product_id: productId,
    image_id: imageId,
    content,
    visible: goLive === true,
    intended_etsy_state: goLive === true ? 'active (live)' : 'draft',
    published,
  };
}

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();

// Aggregate connectivity across every pipeline service — one call for the hub
// / Claude Code to see what's wired up.
router.get('/status', (req, res) => {
  const svc = {};
  for (const [name, mod] of Object.entries(SERVICES)) {
    svc[name] = mod && typeof mod.configured === 'function' ? mod.configured() : false;
  }
  res.json({
    services: svc,
    image_generation: Boolean(OPENAI_API_KEY || process.env.REPLICATE_API_TOKEN),
    pod_routes: POD_ROUTES.map(r => ({ pattern: String(r.match), service: r.service })),
  });
});

// Diagnostic: report what the RUNNING process actually sees for each managed
// key — presence, length, first/last char, and whether the value has stray
// whitespace (a tell-tale of a bad copy-paste / line break in the dashboard).
// NEVER returns the secret value itself. Helps debug "the key is set in the
// host dashboard but the app says it's not". Safe to remove once keys are
// confirmed working.
router.get('/env-check', (req, res) => {
  const keys = (configLoader && configLoader.MANAGED_KEYS) || [];
  const report = {};
  for (const k of keys) {
    const v = process.env[k];
    if (!v) { report[k] = { set: false }; continue; }
    report[k] = {
      set: true,
      length: v.length,
      first: v[0],
      last: v[v.length - 1],
      hasWhitespace: /\s/.test(v),
    };
  }
  res.json({ note: 'fingerprints only — no secret values', keys: report });
});

// Which POD service handles a given product type.
router.get('/route', (req, res) => {
  const productType = req.query.product_type || '';
  res.json({ product_type: productType, service: routePOD(productType) });
});

// Generate listing content only (title / 13 tags / description).
router.post('/listing-content', express.json(), async (req, res) => {
  try {
    const content = await generateListingContent(req.body || {});
    res.json(content);
  } catch (err) {
    res.status(err.message.includes('required') ? 400 : 502).json({ error: err.message });
  }
});

// Create the Etsy draft + upload design image(s). The pipeline's payoff step.
router.post('/publish-draft', express.json({ limit: '25mb' }), async (req, res) => {
  try {
    const result = await publishDraft(req.body || {});
    res.status(result.ok ? 200 : 502).json(result);
  } catch (err) {
    const code = /required|unavailable/.test(err.message) ? 400 : 502;
    res.status(code).json({ error: err.message });
  }
});

// Strip a design's background → transparent PNG (for apparel). Body: { image_url }.
router.post('/remove-bg', express.json(), async (req, res) => {
  const { image_url } = req.body || {};
  if (!image_url) return res.status(400).json({ error: 'image_url required' });
  try {
    const url = await removeBackground(image_url);
    res.json({ url });
  } catch (err) {
    res.status(/required|not set/.test(err.message) ? 400 : 502).json({ error: err.message });
  }
});

// Create a Printify POD product from a design (→ optionally publish to Etsy for
// auto-fulfillment). Body: { blueprint_id, print_provider_id, variant_ids[],
// price (cents), image:{url|contents|id}, title?/description?/tags? or
// generateContent+theme, publish? }.
router.post('/pod-product', express.json({ limit: '25mb' }), async (req, res) => {
  try {
    const result = await createPrintifyProduct(req.body || {});
    res.status(result.ok ? 200 : 502).json(result);
  } catch (err) {
    const code = /required|unavailable/.test(err.message) ? 400 : 502;
    res.status(code).json({ error: err.message });
  }
});

module.exports = {
  router,
  routePOD,
  generateListingContent,
  publishDraft,
  createPrintifyProduct,
  removeBackground,
  clampListing,
};
