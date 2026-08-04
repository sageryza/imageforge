// apiframe.js — Midjourney (via APIFRAME) as the card-deck art generator.
//
// Midjourney has no official API, so we go through APIFRAME, which runs its OWN
// Midjourney accounts and exposes a REST API — Sophie's personal MJ account is
// never involved. This module is the deck-art generator: a prompt (or a plant +
// house style) in, four Midjourney options out, mirrored to Firebase for
// permanence. Pick one, (optionally) upscale, then it flows into the rest of the
// pipeline (label overlay → print prep → MPC fulfilment).
//
// One gotcha baked in: APIFRAME sits behind Cloudflare bot-protection that
// rejects requests without a browser-like User-Agent (403 "error code: 1010"),
// so every call sends one.
//
// Mounted at /api/apiframe by server.js. STUDIO_TOKEN-gated (only GET /status open).

const express = require('express');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

const APIFRAME_KEY = process.env.APIFRAME_KEY || process.env.APIFRAME_API_KEY || '';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const BASE = process.env.APIFRAME_BASE || 'https://api.apiframe.ai/v2';

// Cloudflare in front of APIFRAME blocks non-browser signatures — send a UA.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Optional egress-proxy support (no-op unless HTTPS_PROXY is set AND the agent
// module is available). Render doesn't need it; some hosts do.
let proxyAgent = null;
if (process.env.HTTPS_PROXY) {
  try {
    const { HttpsProxyAgent } = require('https-proxy-agent');
    proxyAgent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
  } catch { /* module absent — direct connection */ }
}

// Default house style for a deck card. No text in the prompt — Midjourney is
// unreliable at rendering words, so the plant name is overlaid later in prep.
const STYLE_SUFFIX = 'loose expressive gouache painting, visible brushstrokes, '
  + 'matte painterly texture, soft neutral background, modern editorial botanical '
  + 'illustration art print';

function headers() {
  return {
    'X-API-Key': APIFRAME_KEY, 'Content-Type': 'application/json',
    'User-Agent': UA, 'Accept': 'application/json',
  };
}

function bucketOrNull() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method, headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
    agent: proxyAgent || undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  if (!res.ok) {
    const e = new Error(`APIFRAME ${res.status}: ${text.slice(0, 200)}`);
    e.status = res.status;
    throw e;
  }
  return json;
}

function deckCardPrompt(plant, style) {
  const base = style || STYLE_SUFFIX;
  return `${base}, a single potted ${plant} houseplant, centered`;
}

// Submit a Midjourney generation. Returns the APIFRAME job id.
// opts: { aspectRatio='5:7', styleRef } — styleRef is a public image URL used as
// a Midjourney --sref (style reference) to lock in Sophie's look.
async function imagine(prompt, opts = {}) {
  if (!APIFRAME_KEY) throw new Error('APIFRAME_KEY not configured');
  let p = prompt;
  if (opts.styleRef) p += ` --sref ${opts.styleRef}`;
  const r = await api('/images/generate', {
    method: 'POST',
    body: { prompt: p, model: 'midjourney',
      midjourneyParams: { aspect_ratio: opts.aspectRatio || '5:7' } },
  });
  return r.jobId || r.id;
}

// Poll one job. Returns { id, status, images, gridUrl, raw }.
async function job(id) {
  const j = await api(`/jobs/${id}`);
  const result = j.result || {};
  return {
    id, status: j.status,
    images: result.images || null, gridUrl: result.gridUrl || null, raw: j,
  };
}

// ─── Seedance video (image-to-video) ────────────────────────────────
// APIFRAME also fronts ByteDance's Seedance video models, and its cheapest
// tier undercuts Replicate for the same job (seedance-1.5-pro: 1 credit =
// $0.01 per 480p second, vs Replicate's seedance-1-lite at about the same
// per-second price for an older model — checked Aug 2026).
// GOTCHAS (both verified live Aug 2026): the docs' v1 route
// (api.apiframe.pro/seedance-imagine) rejects `afk_` keys — v2 accounts must
// use v2's POST /videos/generate. And v2 wants the video options NESTED under
// `seedanceParams` (like `midjourneyParams` for MJ) — sent flat they fail
// with "Unrecognized keys". v2 model ids use dashes ("seedance-1-5-pro").
// Cheapest tier: seedance-1-lite at 480p. Poll GET /v2/jobs/:id like MJ.
async function seedanceVideo(prompt, opts = {}) {
  if (!APIFRAME_KEY) throw new Error('APIFRAME_KEY not configured');
  const params = { resolution: opts.resolution || '480p' };
  if (opts.imageUrl) params.start_image = opts.imageUrl;
  if (opts.endImageUrl) params.end_image = opts.endImageUrl;
  if (opts.cameraFixed != null) params.camera_fixed = Boolean(opts.cameraFixed);
  if (opts.seed != null) params.seed = Number(opts.seed);
  const body = {
    prompt,
    model: String(opts.model || 'seedance-1-lite').replace(/\./g, '-'),
    seedanceParams: params,
  };
  const r = await api('/videos/generate', { method: 'POST', body });
  const id = r.jobId || r.id || r.task_id;
  if (!id) throw new Error('APIFRAME gave no job id: ' + JSON.stringify(r).slice(0, 200));
  return id;
}

// Pull the video URL out of a completed job — result shapes vary a little
// between models, so check the likely fields rather than one.
function videoUrlOf(result) {
  if (!result) return null;
  return result.video_url || result.videoUrl || result.url
    || (Array.isArray(result.videos) && result.videos[0])
    || (Array.isArray(result.output) && result.output[0])
    || (typeof result.video === 'string' ? result.video : null);
}

// Mirror a finished clip to Firebase (APIFRAME/CDN URLs can expire).
async function saveVideoToFirebase(url, folder = 'apiframe-video') {
  const bucket = bucketOrNull();
  if (!bucket || !url) return url;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, agent: proxyAgent || undefined });
    const buf = await r.buffer();
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
    const file = bucket.file(filename);
    await file.save(buf, { metadata: { contentType: 'video/mp4' } });
    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${filename}`;
  } catch { return url; }
}

// Mirror MJ CDN images to Firebase (their CDN URLs can expire). Falls back to the
// original URLs when Firebase isn't configured.
async function saveImagesToFirebase(images, folder = 'deck-cards') {
  const bucket = bucketOrNull();
  if (!bucket || !images) return images;
  const out = [];
  for (const url of images) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, agent: proxyAgent || undefined });
      const buf = await r.buffer();
      const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
      const file = bucket.file(filename);
      await file.save(buf, { metadata: { contentType: 'image/png' } });
      await file.makePublic();
      out.push(`https://storage.googleapis.com/${bucket.name}/${filename}`);
    } catch { out.push(url); }
  }
  return out;
}

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();
router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

router.get('/status', (req, res) => {
  res.json({ ok: true, configured: Boolean(APIFRAME_KEY), model: 'midjourney', video: true, base: BASE });
});

// POST /video — start a Seedance video generation (image-to-video or text-to-
// video). Body: { prompt, imageUrl?, endImageUrl?, model?, resolution?,
// cameraFixed?, seed? }. Defaults are the cheapest tier: seedance-1-lite, 480p.
router.post('/video', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.prompt) return res.status(400).json({ error: 'prompt is required' });
    const jobId = await seedanceVideo(b.prompt, b);
    res.status(202).json({ ok: true, jobId, poll: `/api/apiframe/video-job/${jobId}` });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// GET /video-job/:id — poll a video generation. When COMPLETED, mirror the
// clip to Firebase (pass ?save=0 for the raw CDN URL).
router.get('/video-job/:id', async (req, res) => {
  try {
    const j = await api(`/jobs/${req.params.id}`);
    let video = videoUrlOf(j.result);
    if (j.status === 'COMPLETED' && video && req.query.save !== '0') {
      video = await saveVideoToFirebase(video);
    }
    res.json({ id: req.params.id, status: j.status, video, raw: j });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// POST /generate — start a deck-card generation.
// Body: { prompt } OR { plant, style? }, plus optional { aspectRatio, styleRef }.
router.post('/generate', async (req, res) => {
  try {
    const b = req.body || {};
    const prompt = b.prompt || (b.plant ? deckCardPrompt(b.plant, b.style) : null);
    if (!prompt) return res.status(400).json({ error: 'prompt or plant is required' });
    const jobId = await imagine(prompt, { aspectRatio: b.aspectRatio || '5:7', styleRef: b.styleRef });
    res.status(202).json({ ok: true, jobId, prompt, poll: `/api/apiframe/job/${jobId}` });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// GET /job/:id — poll a generation. When COMPLETED, mirror the 4 images to
// Firebase (pass ?save=0 to skip and return the raw MJ CDN URLs).
router.get('/job/:id', async (req, res) => {
  try {
    const j = await job(req.params.id);
    if (j.status === 'COMPLETED' && j.images && req.query.save !== '0') {
      j.images = await saveImagesToFirebase(j.images);
    }
    res.json(j);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

module.exports = {
  router,
  configured: () => Boolean(APIFRAME_KEY),
  imagine, job, deckCardPrompt, saveImagesToFirebase,
  seedanceVideo, saveVideoToFirebase,
  STYLE_SUFFIX,
};
