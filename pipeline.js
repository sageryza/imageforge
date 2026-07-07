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
// Optional access token. When set, mutating/costly pipeline routes require the
// `x-studio-token` header (the Studio page sends it). Disabled when unset.
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';

// Replicate background-removal model (turns a design into a transparent PNG —
// essential for apparel so the art prints clean, not as a filled rectangle).
// BiRefNet gives cleaner alpha edges than the basic remover (less of a faint
// matte "box" around the art).
const BG_REMOVE_MODEL = 'men1scus/birefnet';
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

// Merge real Etsy ranking tags (proven to rank) ahead of the AI's tags. Ranking
// tags lead but are capped so the AI's product-specific tags still make the cut;
// the rest fills to 13. Returns ≤13 unique tags, each ≤20 chars.
function blendTags(aiTags = [], rankTags = [], limit = 13, realCap = 8) {
  const norm = s => String(s || '').toLowerCase().trim();
  const seen = new Set();
  const out = [];
  const add = t => {
    const k = norm(t);
    if (k && k.length <= 20 && !seen.has(k) && out.length < limit) { seen.add(k); out.push(k); }
  };
  rankTags.slice(0, realCap).forEach(add); // proven ranking tags first (capped)
  aiTags.forEach(add);                      // AI's product-specific tags fill in
  rankTags.forEach(add);                    // top up with any leftover ranking tags
  return out;
}

// "Talk it out" — turn a loose, freeform description into a concrete plan:
// a design theme, 1-3 house styles (chosen from the ones the shop actually
// has), and a few product types. Powers the Studio's conversational input.
async function interpretBrief({ text, styles = [] } = {}) {
  if (!text) throw new Error('text required');
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const sys = [
    'You help a maker turn a loose idea into a plan for print-on-demand products.',
    'Return STRICT JSON: {"theme": a short concrete visual design theme (a phrase, not a sentence),',
    '"styles": array of 1-3 style names chosen ONLY from the provided available list,',
    '"products": array of 1-4 items from ["art print","greeting card","poster","sticker","t-shirt","sweatshirt","tote","mug"],',
    '"note": one short friendly sentence reflecting their vibe back}.',
  ].join(' ');
  const user = `Available styles: ${styles.join(', ') || '(none)'}\nTheir description: ${text}`;
  const raw = await openaiJSON([
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ]);
  return {
    theme: String(raw.theme || '').trim(),
    styles: Array.isArray(raw.styles) ? raw.styles.filter(s => styles.includes(s)).slice(0, 3) : [],
    products: Array.isArray(raw.products) ? raw.products.slice(0, 4) : [],
    note: String(raw.note || '').trim(),
  };
}

// Generate SEO-optimized Etsy listing content from a theme + product type.
async function generateListingContent({ theme, productType = 'art print', audience, extraContext } = {}) {
  if (!theme) throw new Error('theme required');
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const sys = [
    'You are an expert Etsy SEO copywriter for a small illustrated-goods shop.',
    'Write listing content that ranks and converts. Front-load the most-searched keywords.',
    'Hard rules: title MUST be <= 140 characters; provide EXACTLY 13 tags; each tag MUST be <= 20 characters and be a real multi-word buyer search phrase (no single generic words, no punctuation); description should be 2-4 short paragraphs, scannable, keyword-rich but human.',
    'Also return "primary_keyword": the single 2-4 word core Etsy search phrase a buyer would type to find this (used to look up real ranking data).',
    'Return STRICT JSON: {"title": string, "tags": string[13], "description": string, "materials": string[], "primary_keyword": string }.',
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
  const content = clampListing(raw);
  // Ground the tags in what actually ranks on Etsy right now: pull the tags most
  // used by the top-ranking listings for this product's core search phrase and
  // blend them ahead of the AI's guesses. Fully automated; on any failure it
  // silently keeps the AI tags so the flow never breaks.
  try {
    const seed = (raw.primary_keyword && String(raw.primary_keyword).trim()) || theme;
    if (etsy && etsy.keywordResearch && seed) {
      const kr = await etsy.keywordResearch(seed, { sample: 100 });
      if (kr && kr.ok && Array.isArray(kr.top_tags) && kr.top_tags.length) {
        content.tags = blendTags(content.tags, kr.top_tags.map(t => t.tag));
        content.keyword_signal = { seed, competition: kr.competition };
      }
    }
  } catch (err) {
    console.warn('pipeline: keyword-research tag grounding skipped —', err.message);
  }
  return content;
}

// Map a product type to a sensible Etsy taxonomy leaf (a most-specific node,
// which Etsy requires). Used so a draft's category matches what it IS, instead
// of inheriting a random active listing's category. All IDs are verified leaves.
// Sophie can still change the category in Etsy; this is just a good default.
const ETSY_TAXONOMY = {
  'art print': 127,      // Art & Collectibles › Prints › Wood & Linocut Prints
  'print': 127,
  'linocut': 127,
  'poster': 125,         // Prints › Music & Movie Posters
  'greeting card': 1310, // Paper & Party Supplies › Paper › Note Cards
  'card': 1310,
  'note card': 1310,
};
function taxonomyFor(productType) {
  if (!productType) return null;
  return ETSY_TAXONOMY[String(productType).toLowerCase().trim()] || null;
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

  // Category: prefer a leaf mapped from the product type; only fall back to a
  // caller-supplied taxonomy_id (e.g. one derived from an existing listing) when
  // the product type is unknown. Avoids drafts landing in an unrelated category.
  const resolvedTaxonomy = taxonomyFor(productType) || taxonomy_id;

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
    ...content, price, quantity, taxonomy_id: resolvedTaxonomy, who_made, when_made, type, legacy,
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

// ─── Real product mockups (Printify-rendered) ──────────────────────
// Blueprint / print-provider / a representative variant per product type, used
// to spin up throwaway "preview" products just to harvest Printify's rendered
// mockup images. (Validated live; front print area.)
// Per product: blueprint / provider / variant, the FRONT print-area pixel size
// (from the catalog, used to place the art correctly), and a vertical anchor.
// `variant_id` is the DEFAULT color (deliberately LIGHT — dark line art printed
// on a dark garment is invisible once the white background is removed, so a
// light default keeps designs readable). `colors` are the pickable options.
const POD_CATALOG = {
  't-shirt': {
    blueprint_id: 12, print_provider_id: 99, pw: 3951, ph: 4800, y: 0.42, apparel: true,
    variant_id: 18390, // Natural
    colors: [
      { n: 'Natural', v: 18390, hex: '#e8e0cf' }, { n: 'White', v: 18542, hex: '#ffffff' },
      { n: 'Soft Cream', v: 18462, hex: '#f2ead6' }, { n: 'Athletic Heather', v: 18078, hex: '#b7b8b3' },
      { n: 'Navy', v: 18398, hex: '#2b2f42' }, { n: 'Forest', v: 18182, hex: '#2f4a3a' },
      { n: 'Black', v: 18102, hex: '#222222' },
    ],
  },
  'sweatshirt': {
    blueprint_id: 49, print_provider_id: 99, pw: 3185, ph: 3636, y: 0.42, apparel: true,
    variant_id: 25456, // Sand
    colors: [
      { n: 'Sand', v: 25456, hex: '#d8cbb0' }, { n: 'White', v: 25458, hex: '#ffffff' },
      { n: 'Sport Grey', v: 25457, hex: '#b0b0b0' }, { n: 'Navy', v: 25450, hex: '#2b2f42' },
      { n: 'Black', v: 25459, hex: '#222222' },
    ],
  },
  'tote': {
    blueprint_id: 507, print_provider_id: 48, pw: 2102, ph: 4051, y: 0.30, apparel: true,
    variant_id: 80814, // Beige
    colors: [
      { n: 'Beige', v: 80814, hex: '#d9cdb5' }, { n: 'White', v: 80818, hex: '#ffffff' },
      { n: 'Black', v: 80815, hex: '#222222' },
    ],
  },
  'mug': {
    blueprint_id: 68, print_provider_id: 1, pw: 2700, ph: 1120, y: 0.50, apparel: true,
    variant_id: 33719, colors: [], // white ceramic only
  },
  // greeting card / art print: shown as a framed design in the UI (a real
  // Printify card mockup needs a valid decorator — a later addition).
};

// Place a design of aspect ratio `ar` (width/height) inside a print area so it
// is CONTAINED — never cropped — with a small margin. Printify's `scale` is the
// image width relative to the print-area width; to also fit the height we cap
// scale at (print_h * ar / print_w). x/y are the image CENTER (0..1).
function placeInArea(cat, ar = 1, margin = 0.92) {
  const scale = Math.min(1, (cat.ph * ar) / cat.pw) * margin;
  return { x: 0.5, y: cat.y ?? 0.5, scale, angle: 0 };
}

function catalogByBlueprint(blueprintId) {
  return Object.values(POD_CATALOG).find(c => c.blueprint_id === blueprintId);
}

// Resolve a product's front print-area dimensions — from POD_CATALOG when known,
// otherwise fetched from Printify's catalog. Used so the SELL path places art
// correctly (contained) too, not just the previews.
async function resolvePrintArea(blueprintId, providerId, variantId) {
  const cat = catalogByBlueprint(blueprintId);
  if (cat) return { pw: cat.pw, ph: cat.ph, y: cat.y };
  try {
    const r = await printify.getProviderVariants(blueprintId, providerId);
    const variants = r.ok && r.body && Array.isArray(r.body.variants) ? r.body.variants : [];
    const v = variants.find(x => x.id === variantId) || variants[0];
    const front = v && (v.placeholders || []).find(p => p.position === 'front');
    if (front) return { pw: front.width, ph: front.height, y: 0.5 };
  } catch { /* fall through */ }
  return null;
}

// Generate REAL Printify mockups for a design across product types. For each
// requested product we create a hidden throwaway product with the design in the
// front print area, poll until Printify renders the mockup, grab the image URL,
// then delete the product (the mockup URL survives). Apparel uses a
// background-removed version of the design so the art prints clean.
async function generateMockups({ image_url, products = [], removeBg = true, shop_id, variants = {} } = {}) {
  if (!printify) throw new Error('printify module unavailable');
  if (!image_url) throw new Error('image_url required');
  const keys = products.map(p => String(p).toLowerCase()).filter(p => POD_CATALOG[p]);
  if (!keys.length) return { mockups: [] };

  // Printify won't accept webp uploads (our designs are webp), and apparel needs
  // a transparent design. Running through the bg remover yields a clean PNG that
  // solves both. If it fails we fall back to the original URL and let Printify
  // reject/accept it. One upload, reused for every product.
  let pngUrl = image_url;
  if (removeBg) {
    try { pngUrl = await removeBackground(image_url); } catch { /* keep original */ }
  }
  const up = await printify.uploadImage({ fileName: 'design.png', url: pngUrl });
  const imageId = up.ok && up.body && up.body.id;
  if (!imageId) return { mockups: [], error: 'image upload failed', detail: up.body };
  // Design aspect ratio (from Printify's upload response) — so placement fits
  // non-square art too. Defaults to square.
  const ar = up.body.width && up.body.height ? up.body.width / up.body.height : 1;

  const oneMockup = async (key) => {
    const cat = POD_CATALOG[key];
    const place = placeInArea(cat, ar);
    const variantId = variants[key] || cat.variant_id; // optional color override
    try {
      const created = await printify.createProduct({
        title: `preview ${key}`, description: 'preview',
        blueprint_id: cat.blueprint_id, print_provider_id: cat.print_provider_id, visible: false,
        variants: [{ id: variantId, price: 2000, is_enabled: true }],
        print_areas: [{ variant_ids: [variantId], placeholders: [{ position: 'front', images: [{ id: imageId, x: place.x, y: place.y, scale: place.scale, angle: place.angle }] }] }],
      }, shop_id);
      const pid = created.ok && created.body && created.body.id;
      if (!pid) return { product: key, ok: false, error: created.body };
      let url = null;
      for (let i = 0; i < 14 && !url; i++) {
        const got = await printify.getProduct(pid, shop_id);
        const imgs = got.ok && got.body && Array.isArray(got.body.images) ? got.body.images : [];
        if (imgs.length) url = (imgs.find(im => im.is_default) || imgs[0]).src;
        else await new Promise(r => setTimeout(r, 2000));
      }
      printify.deleteProduct(pid, shop_id).catch(() => {}); // fire-and-forget cleanup
      return url ? { product: key, variant_id: variantId, ok: true, mockup_url: url } : { product: key, ok: false, error: 'no mockup rendered' };
    } catch (err) {
      return { product: key, ok: false, error: err.message };
    }
  };

  const mockups = await Promise.all(keys.map(oneMockup));
  return { mockups };
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
    shop_id, price,                      // price in cents (e.g. 2499 = $24.99)
    image,                               // { url } | { contents } | { id }
    title, description, tags,
    generateContent = false, theme, audience,
    // product_type resolves blueprint/provider/default-variant from POD_CATALOG
    // (e.g. "t-shirt", "mug") so callers needn't know Printify's ids.
    product_type,
    placement = {},                      // { position, x, y, scale, angle }
    removeBackground: removeBg = false,  // strip the design's background first (apparel)
    publish = false,
    // SAFE BY DEFAULT: create the product hidden so that when it publishes to
    // Etsy it lands as a DRAFT, not a live/purchasable listing. Opt into a live
    // listing explicitly with goLive: true. (Printify's `visible` field is the
    // "Hide in Store" toggle; visible=false → Etsy draft.)
    goLive = false,
  } = opts;

  // Resolve blueprint / provider / variants: explicit ids win, else fill from
  // POD_CATALOG by product_type. The AI copy also inherits product_type so the
  // listing reads like the actual garment, not a generic "shirt".
  const cat = product_type ? POD_CATALOG[String(product_type).toLowerCase().trim()] : null;
  const blueprint_id = opts.blueprint_id || (cat && cat.blueprint_id);
  const print_provider_id = opts.print_provider_id || (cat && cat.print_provider_id);
  const variant_ids = (Array.isArray(opts.variant_ids) && opts.variant_ids.length)
    ? opts.variant_ids : (cat ? [cat.variant_id] : []);
  const productType = opts.productType || product_type || 'shirt';
  if (!blueprint_id || !print_provider_id) throw new Error('blueprint_id and print_provider_id required (or a known product_type)');
  if (!Array.isArray(variant_ids) || !variant_ids.length) throw new Error('variant_ids required (or a known product_type)');
  if (price == null) throw new Error('price (in cents) required');

  // Content: supplied directly, or AI-written (also used for the Etsy listing
  // once Printify publishes the product).
  let content = { title, description, tags };
  if (generateContent) content = await generateListingContent({ theme, productType, audience });
  if (!content.title) throw new Error('title required (or set generateContent)');

  // Resolve the Printify image id (upload the design if not already uploaded).
  let imageId = image && image.id;
  let designAR = 1;
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
    if (up.body.width && up.body.height) designAR = up.body.width / up.body.height;
  }

  // Placement: CONTAIN the design in the real print area (same math as previews)
  // unless the caller passes an explicit scale. This makes the actual printed
  // product correct — not just the mockup.
  let place;
  if (placement.scale != null) {
    place = { position: placement.position || 'front', x: placement.x ?? 0.5, y: placement.y ?? 0.5, scale: placement.scale, angle: placement.angle ?? 0 };
  } else {
    const area = await resolvePrintArea(blueprint_id, print_provider_id, variant_ids[0]);
    const auto = area ? placeInArea({ pw: area.pw, ph: area.ph, y: placement.y ?? area.y }, designAR)
                      : { x: 0.5, y: placement.y ?? 0.5, scale: 1, angle: 0 };
    place = { position: placement.position || 'front', x: placement.x ?? auto.x, y: placement.y ?? auto.y, scale: auto.scale, angle: placement.angle ?? 0 };
  }
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

// Access gate: when STUDIO_TOKEN is set, require it on everything except a few
// harmless reads. Blocks the public internet from running up API costs or
// creating drafts in the shops. No-op (open) when STUDIO_TOKEN is unset.
const OPEN_READS = new Set(['/status', '/route', '/pod-options']);
router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.method === 'GET' && OPEN_READS.has(req.path)) return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

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

// Which POD service handles a given product type.
router.get('/route', (req, res) => {
  const productType = req.query.product_type || '';
  res.json({ product_type: productType, service: routePOD(productType) });
});

// Talk-it-out: freeform description -> { theme, styles, products, note }.
router.post('/brief', express.json(), async (req, res) => {
  try {
    const plan = await interpretBrief(req.body || {});
    res.json(plan);
  } catch (err) {
    res.status(err.message.includes('required') || err.message.includes('not set') ? 400 : 502).json({ error: err.message });
  }
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

// Real Printify mockups for a design. Body: { image_url, products[],
// removeBackground?, variants?:{product:variant_id} } (variants = color override).
router.post('/mockups', express.json({ limit: '25mb' }), async (req, res) => {
  const { image_url, products, removeBackground: rb = true, shop_id, variants } = req.body || {};
  try {
    const out = await generateMockups({ image_url, products, removeBg: rb, shop_id, variants });
    res.json(out);
  } catch (err) {
    res.status(/required|unavailable/.test(err.message) ? 400 : 502).json({ error: err.message });
  }
});

// Product options (garment colors) for the Studio's color pickers.
router.get('/pod-options', (req, res) => {
  const out = {};
  for (const [key, cat] of Object.entries(POD_CATALOG)) {
    out[key] = { default_variant: cat.variant_id, colors: cat.colors || [] };
  }
  res.json(out);
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
  interpretBrief,
  generateListingContent,
  publishDraft,
  createPrintifyProduct,
  generateMockups,
  removeBackground,
  clampListing,
  taxonomyFor,
};
