// photostudio.js — the "photo → Etsy draft" pipeline (no POD).
//
// A separate track from the print-on-demand pipeline. Sophie already MADE the
// thing (a handmade pouch, a ceramic, a print she'll ship herself). She snaps a
// photo; this turns that one photo into a reviewable Etsy draft:
//
//   photo of the real product
//     → describe it (gpt-4o vision: what it is, materials, colors, keywords)
//     → styled mockups (gpt-image-2 edits, input_fidelity high so the ACTUAL
//       product is preserved): a clean white-background shot + prop flatlays
//     → SEO listing content (title / 13 tags / description) — reuses pipeline.js
//     → DRAFT Etsy listing with the mockups attached — reuses pipeline.js
//
// Unlike the POD path there is no Printify/Printful/Lulu and no auto-fulfilment
// — Sophie fulfils these herself. Mounted at /api/photostudio by server.js.
//
// A note on faithfulness: the white-background and flatlay shots go through
// gpt-image-2's IMAGE EDIT endpoint with `input_fidelity: high`, which keeps the
// real product's shape/texture/label instead of hallucinating a new object. It
// re-lights and re-stages the SAME item; it does not invent a different one.

const express = require('express');
const fetch = require('node-fetch');
const FormData = require('form-data');
const admin = require('firebase-admin');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';

// Reuse the listing-content writer + Etsy draft orchestration from the POD
// pipeline, and Etsy's listing-defaults helper. Required defensively so a broken
// sibling module never blocks boot.
function tryRequire(name) {
  try { return require(name); } catch (err) {
    console.warn(`photostudio: ${name} unavailable —`, err.message);
    return null;
  }
}
const pipeline = tryRequire('./pipeline');
const etsy = tryRequire('./etsy');

// ─── Image helpers ──────────────────────────────────────────────────
// Accept a data URL ("data:image/png;base64,…") or raw base64 and return the
// decoded buffer + mime. Also passes plain http(s) URLs through untouched.
function decodeImage(input) {
  if (!input) return null;
  if (/^https?:\/\//i.test(input)) return { url: input };
  const m = /^data:([^;]+);base64,(.*)$/.exec(input);
  const b64 = m ? m[2] : input;
  const mime = m ? m[1] : 'image/png';
  try { return { buffer: Buffer.from(b64, 'base64'), mime }; } catch { return null; }
}

// A data URL usable as a vision image_url (gpt-4o accepts these directly).
function toDataUrl(img) {
  if (img.url) return img.url;
  return `data:${img.mime};base64,${img.buffer.toString('base64')}`;
}

// Save a generated mockup buffer to Firebase Storage → permanent public URL
// (Etsy downloads this when attaching it to the listing). Falls back to a data
// URL when Firebase isn't configured — fine for preview, but Etsy upload needs a
// real URL, so we flag that case to the caller.
async function saveMockup(buffer, mime = 'image/png') {
  const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
  try {
    const bucket = admin.apps.length ? admin.storage().bucket() : null;
    if (!bucket) throw new Error('no bucket');
    const filename = `photostudio/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const file = bucket.file(filename);
    await file.save(buffer, { metadata: { contentType: mime } });
    await file.makePublic();
    return { url: `https://storage.googleapis.com/${bucket.name}/${filename}`, permanent: true };
  } catch (err) {
    return { url: `data:${mime};base64,${buffer.toString('base64')}`, permanent: false };
  }
}

// ─── gpt-4o vision: describe the real product ───────────────────────
async function openaiVisionJSON(imageDataUrl, sys, userText, retries = 2) {
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
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          temperature: 0.6,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: [
              { type: 'text', text: userText },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ] },
          ],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'openai vision error');
      return JSON.parse(data.choices?.[0]?.message?.content || '{}');
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// Look at the photo and return a structured description + concrete staging
// ideas. The `scenes` it returns become the flatlay mockup prompts, so we ask
// for props that genuinely suit THIS product.
async function describeProduct({ image } = {}) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const img = decodeImage(image);
  if (!img) throw new Error('image required (data URL, base64, or http URL)');
  const sys = [
    'You are a product photographer and Etsy merchandiser. Look at the photo of a',
    'single handmade product and describe it precisely for a listing.',
    'Return STRICT JSON:',
    '{"name": short human product name (2-5 words),',
    '"summary": one vivid sentence describing the item,',
    '"category": a plain product category (e.g. "fabric pouch", "ceramic mug"),',
    '"materials": array of up to 5 likely materials (single words or short phrases, letters/spaces only),',
    '"colors": array of up to 4 dominant colors,',
    '"keywords": array of 6-10 buyer search phrases (2-3 words each),',
    '"scenes": array of EXACTLY 3 flatlay staging ideas for this exact item. Each:',
    '{"label": 2-4 word name, "props": short phrase naming complementary props/surface}.',
    'Scenes must suit the actual item and NOT hide or replace it. No text/logos in scenes.}',
  ].join(' ');
  const raw = await openaiVisionJSON(toDataUrl(img), sys, 'Describe this product and propose staging.');
  return {
    name: String(raw.name || '').trim(),
    summary: String(raw.summary || '').trim(),
    category: String(raw.category || '').trim(),
    materials: Array.isArray(raw.materials) ? raw.materials.map(s => String(s).trim()).filter(Boolean).slice(0, 5) : [],
    colors: Array.isArray(raw.colors) ? raw.colors.map(s => String(s).trim()).filter(Boolean).slice(0, 4) : [],
    keywords: Array.isArray(raw.keywords) ? raw.keywords.map(s => String(s).trim()).filter(Boolean).slice(0, 10) : [],
    scenes: Array.isArray(raw.scenes) ? raw.scenes.slice(0, 3).map(s => ({
      label: String(s.label || '').trim(), props: String(s.props || '').trim(),
    })).filter(s => s.label || s.props) : [],
  };
}

// ─── OpenAI image edits: re-stage the real product ──────────────────
// Returns a PNG buffer (Etsy accepts png/jpg/gif, not webp).
//
// Faithfulness matters here — the point is to re-light/re-stage the ACTUAL
// product, not hallucinate a new one. Only gpt-image-1 supports the
// `input_fidelity: high` flag that preserves the real subject (gpt-image-2
// rejects it — "does not support the 'input_fidelity' parameter"). So we edit
// with gpt-image-1 first, and only fall back to gpt-image-2 (no fidelity flag)
// if gpt-image-1 is ever unavailable on the account — degraded but not broken.
const EDIT_MODELS = [
  { model: 'gpt-image-1', inputFidelity: true },  // faithful: preserves the real product
  { model: 'gpt-image-2', inputFidelity: false }, // fallback if gpt-image-1 is unavailable
];
async function editImage({ buffer, mime, prompt, size = '1024x1024', quality = 'medium', retries = 1 }) {
  let lastErr;
  for (const cfg of EDIT_MODELS) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const form = new FormData();
        form.append('model', cfg.model);
        form.append('prompt', prompt);
        const ext = (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
        form.append('image', buffer, { filename: `product.${ext}`, contentType: mime });
        if (cfg.inputFidelity) form.append('input_fidelity', 'high');
        form.append('size', size);
        form.append('quality', quality);
        form.append('output_format', 'png');
        const res = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders() },
          body: form,
          timeout: 180000,
        });
        const data = await res.json();
        if (data.error) throw new Error(`${cfg.model}: ${data.error.message || 'edit error'}`);
        const b64 = data.data?.[0]?.b64_json;
        if (!b64) throw new Error(`${cfg.model} returned no image`);
        return Buffer.from(b64, 'base64');
      } catch (err) {
        lastErr = err;
        if (attempt < retries) await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
      }
    }
    // gpt-image-1 exhausted its retries — fall through to the gpt-image-2 fallback.
  }
  throw lastErr;
}

const WHITE_SCENE = {
  label: 'White background',
  prompt: 'Place this exact product, unchanged, centered on a pure white seamless studio background. '
    + 'Clean e-commerce product photography, soft even lighting, a soft natural contact shadow beneath it. '
    + 'Keep the product identical in shape, color, material and every detail. No text, no props, no extra objects.',
};

function flatlayPrompt(scene) {
  return `Stage this exact product, unchanged, as a styled overhead flatlay: ${scene.props || 'a few tasteful complementary props'}. `
    + 'Warm natural lighting, tasteful composition, the product remains the clear hero and stays identical in shape, '
    + 'color, material and detail. Lifestyle product photography. No text, no logos, no packaging labels added.';
}

// Generate the mockups. Always the clean white-background shot; then up to
// `maxFlatlays` styled flatlays from the described scenes. Runs concurrently.
async function makeMockups({ image, scenes = [], includeWhite = true, maxFlatlays = 2, size = '1024x1024' } = {}) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const img = decodeImage(image);
  if (!img) throw new Error('image required');
  if (!img.buffer) {
    // The edits endpoint needs the bytes; fetch a remote URL into a buffer.
    const r = await fetch(img.url);
    img.buffer = await r.buffer();
    img.mime = r.headers.get('content-type') || 'image/png';
  }

  const jobs = [];
  if (includeWhite) jobs.push({ label: WHITE_SCENE.label, prompt: WHITE_SCENE.prompt });
  for (const s of scenes.slice(0, maxFlatlays)) {
    jobs.push({ label: s.label || 'Flatlay', prompt: flatlayPrompt(s) });
  }

  const results = await Promise.all(jobs.map(async (job) => {
    try {
      const out = await editImage({ buffer: img.buffer, mime: img.mime, prompt: job.prompt, size });
      const saved = await saveMockup(out, 'image/png');
      return { label: job.label, ok: true, url: saved.url, permanent: saved.permanent };
    } catch (err) {
      return { label: job.label, ok: false, error: err.message };
    }
  }));
  return { mockups: results };
}

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();

// Same access gate as the POD pipeline: when STUDIO_TOKEN is set, require it on
// everything except the harmless status read.
router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

router.get('/status', (req, res) => {
  res.json({
    ready: Boolean(OPENAI_API_KEY),
    vision: Boolean(OPENAI_API_KEY),
    etsy: etsy && typeof etsy.configured === 'function' ? etsy.configured() : false,
  });
});

// Describe a product photo → { name, summary, category, materials, colors,
// keywords, scenes }. Body: { image } (data URL / base64 / http URL).
router.post('/describe', express.json({ limit: '25mb' }), async (req, res) => {
  try {
    const out = await describeProduct(req.body || {});
    res.json(out);
  } catch (err) {
    res.status(/required|not set/.test(err.message) ? 400 : 502).json({ error: err.message });
  }
});

// Generate mockups from a product photo. Body: { image, scenes?, includeWhite?,
// maxFlatlays? }. Returns { mockups: [{ label, ok, url, permanent }] }.
router.post('/mockups', express.json({ limit: '25mb' }), async (req, res) => {
  try {
    const out = await makeMockups(req.body || {});
    res.json(out);
  } catch (err) {
    res.status(/required|not set/.test(err.message) ? 400 : 502).json({ error: err.message });
  }
});

// One-shot: describe the photo AND write listing content in a single call, so
// the UI can show a fully pre-filled draft to review. Body: { image }.
router.post('/analyze', express.json({ limit: '25mb' }), async (req, res) => {
  try {
    const desc = await describeProduct(req.body || {});
    let listing = null;
    if (pipeline && pipeline.generateListingContent) {
      const theme = [desc.name, desc.summary].filter(Boolean).join(' — ') || desc.category;
      listing = await pipeline.generateListingContent({
        theme,
        productType: desc.category || 'handmade item',
        extraContext: `Materials: ${desc.materials.join(', ')}. Colors: ${desc.colors.join(', ')}. Buyer phrases: ${desc.keywords.join(', ')}.`,
      });
      // Seed materials from the vision description when the writer didn't supply any.
      if ((!listing.materials || !listing.materials.length) && desc.materials.length && pipeline.clampListing) {
        listing = pipeline.clampListing({ ...listing, materials: desc.materials });
      }
    }
    res.json({ description: desc, listing });
  } catch (err) {
    res.status(/required|not set/.test(err.message) ? 400 : 502).json({ error: err.message });
  }
});

// Create the DRAFT Etsy listing with the mockups attached. Resolves shipping /
// return / readiness / taxonomy defaults from an existing active listing (same
// as the POD path). Body: { shop_id?, title, tags, description, materials?,
// images[], price?, quantity? }.
router.post('/draft', express.json({ limit: '25mb' }), async (req, res) => {
  if (!pipeline || !pipeline.publishDraft) return res.status(400).json({ error: 'pipeline module unavailable' });
  if (!etsy || !etsy.getListingDefaults) return res.status(400).json({ error: 'etsy module unavailable' });
  const body = req.body || {};
  const shopId = body.shop_id || process.env.ETSY_SHOP_ID;
  if (!shopId) return res.status(400).json({ error: 'shop_id required (or set ETSY_SHOP_ID)' });
  const images = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
  if (!images.length) return res.status(400).json({ error: 'at least one image URL required' });
  try {
    const def = await etsy.getListingDefaults(shopId);
    if (!def.ok) return res.status(502).json({ error: 'could not derive Etsy listing defaults (no active listing?)', detail: def.body });
    const d = def.defaults;
    const result = await pipeline.publishDraft({
      shop_id: Number(shopId),
      images,
      title: body.title,
      tags: body.tags,
      description: body.description,
      materials: body.materials,
      price: body.price,
      quantity: body.quantity != null ? body.quantity : 1,
      taxonomy_id: body.taxonomy_id || d.taxonomy_id,
      shipping_profile_id: d.shipping_profile_id,
      return_policy_id: d.return_policy_id,
      readiness_state_id: d.readiness_state_id,
    });
    res.status(result.ok ? 200 : 502).json(result);
  } catch (err) {
    res.status(/required|unavailable/.test(err.message) ? 400 : 502).json({ error: err.message });
  }
});

module.exports = {
  router,
  describeProduct,
  makeMockups,
  editImage,
};
