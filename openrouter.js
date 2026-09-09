'use strict';
// openrouter.js — the SECOND Seedance door: ByteDance's own price through
// OpenRouter, for jobs with NO video reference (2026-09-08, Sophie: "make a
// note so any reference w no video uses open router instead" · "logs yes").
//
// WHY A SECOND DOOR AND NOT THE DOOR. OpenRouter forwards a Seedance request
// straight to ByteDance and bills ByteDance's list price (Seedance 2.5:
// $10.70 per million video tokens, $6.40 when a reference video rides; a
// token is (w × h × 24 × seconds) / 1024), plus ~5% when credit is bought —
// so 480p 2.5 is 10.9¢/s all in against APIFRAME's 13¢. BUT ByteDance's own
// filter refuses reference VIDEOS with people that APIFRAME accepts —
// measured 2026-09-08 on scene 36a1: the two untouched Seedance clips APIFRAME
// drew that scene from came back `InputVideoSensitiveContentDetected.
// PrivacyInformation` before drawing, while the three pictures passed — and
// the same hour a PERSON-FREE reference video (the socks B-roll) passed and
// drew for 6.5¢, while a generated face STILL was refused. So the line is
// the PERSON, not the video:
//   text, pictures, audio, and person-free videos → HERE
//   any reference with a face or a person         → POST /api/apiframe/video
// A reference video rides through as `video_url`; ByteDance's refusal is
// free and terminal (see below), so letting it decide costs nothing.
//
// THE LOG IS SHARED. Every accepted job files the same `forge-video-jobs`
// doc APIFRAME's route files (video-log.js — the literal prompt, the model,
// the exact params, every reference url, chat/scene/title), stamped
// `provider: 'openrouter'`, and the poll fills in the outcome and the clip's
// permanent url. `GET /api/apiframe/video-log?chat=` reads both doors.
//
// GOTCHAS (all measured 2026-09-08):
// - The request shape is undocumented: `input_references` items are typed
//   `image_url` / `audio_url` / `video_url` (OpenRouter's validator names
//   exactly those three). References are `[Image1]` / `[Audio1]` in the
//   prompt, in list order, as on APIFRAME.
// - A content refusal comes back as HTTP 400 carrying ByteDance's own error
//   code (`…SensitiveContentDetected…`) BEFORE any money moves. It is
//   terminal: never retried, never reshaped, never sent with the prompt
//   changed (the first probe tried a passthrough envelope that silently
//   dropped the videos, and ByteDance drew the scene from the pictures alone
//   — 41¢ for a clip she never approved).
// - There is NO cancel (POST …/cancel and DELETE both 404); the charge lands
//   the moment a job is accepted (202).
// - The finished clip is behind the key (`GET /videos/:id/content`), so it
//   is downloaded WITH the bearer and mirrored to Storage; the log doc is
//   read first so a second poll never downloads twice.
// - Seedance 2.5 on OpenRouter tops out at 720p; 2.0 goes to 1080p/4K.
//   ByteDance's own sale (Aug 7 – Oct 7 2026) prices 2.0 Mini at 40% of list
//   and 2.0 Fast at 75%, applied at billing time, passed through here.
//
// Her "go" rule (CLAUDE.md) is the chat's, not this module's: show the
// model, seconds, resolution, the exact prompt and every reference, wait for
// "go", THEN post. Read back what was sent — the 202 answer carries it.
//
// Routes (mounted at /api/openrouter by server.js; STUDIO_TOKEN-gated, only
// GET /status open):
//   GET  /status              config health, never key values
//   GET  /credits             { credits, usage, left } in dollars
//   POST /video               start a Seedance job (no video references)
//   GET  /video-job/:id       poll; mirrors the clip on completion
//   GET  /models              OpenRouter's video-model list (Seedance only)

const express = require('express');
const fetch = require('node-fetch');
const admin = require('firebase-admin');
const videoLog = require('./video-log');
const videoSeed = require('./video-seed');

const KEY = process.env.OPENROUTER_API_KEY || '';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const BASE = process.env.OPENROUTER_BASE || 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'bytedance/seedance-2.5';
const MODELS = ['bytedance/seedance-2.5', 'bytedance/seedance-2.0', 'bytedance/seedance-2.0-fast', 'bytedance/seedance-2.0-mini'];
const APIFRAME_ROUTE = 'POST /api/apiframe/video';

let proxyAgent = null;
if (process.env.HTTPS_PROXY) {
  try {
    const { HttpsProxyAgent } = require('https-proxy-agent');
    proxyAgent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
  } catch { /* direct */ }
}

function headers() {
  return { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json',
    'HTTP-Referer': 'https://imageforge-q125.onrender.com', 'X-Title': 'Deck Factory' };
}

function bucketOrNull() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}

// ─── Pure: the request shape, the refusal, the status map ────────────
// A short model name ("seedance-2.5", "2.0-mini") is accepted and mapped onto
// OpenRouter's id; an unknown model is refused rather than guessed.
function modelIdOf(m) {
  if (!m) return DEFAULT_MODEL;
  const s = String(m).trim().toLowerCase();
  if (MODELS.includes(s)) return s;
  const short = s.replace(/^bytedance\//, '').replace(/^seedance-?/, '');
  const hit = MODELS.find((id) => id.replace(/^bytedance\/seedance-/, '') === short);
  return hit || null;
}

// Build OpenRouter's body from the route's body (the APIFRAME route's field
// names, so a chat swaps the url and nothing else). Answers { body, params,
// model } or { error } — never throws, never sends.
function buildRequest(b) {
  b = b || {};
  const prompt = String(b.prompt == null ? '' : b.prompt);
  if (!prompt.trim()) return { error: 'prompt is required' };
  // No start/end frame here (`imageUrl` / `endImageUrl` are ignored): the
  // keyframe door is APIFRAME's. A reference VIDEO rides as `video_url` and
  // ByteDance decides: a person-free clip passes (measured 2026-09-08, the
  // socks B-roll, 6.5¢), a clip with a person is refused for free before
  // anything draws — that refusal comes back as { refusal:'content' } and
  // names APIFRAME, the door that accepts it.
  const model = modelIdOf(b.model);
  if (!model) return { error: `unknown model "${b.model}" — one of ${MODELS.join(', ')}` };
  const imgs = (Array.isArray(b.referenceImageUrls) ? b.referenceImageUrls : []).map(String).filter(Boolean);
  const vids = (Array.isArray(b.referenceVideoUrls) ? b.referenceVideoUrls : []).map(String).filter(Boolean);
  const auds = (Array.isArray(b.referenceAudioUrls) ? b.referenceAudioUrls : []).map(String).filter(Boolean);
  const params = { resolution: String(b.resolution || '480p') };
  if (b.duration != null) params.duration = Number(b.duration);
  if (b.aspectRatio) params.aspect_ratio = String(b.aspectRatio);
  params.generate_audio = b.generateAudio == null ? true : Boolean(b.generateAudio);
  // EVERY CLIP CARRIES A SEED, minted when the caller did not pass one
  // (video-seed.js — what it does and does not buy is measured there).
  // Nothing ever hands a seed back, so a job sent without one has none
  // forever; the mint costs nothing and rides `params` into the log.
  if (videoSeed.takesSeed(model)) params.seed = videoSeed.seedFor(b.seed);
  else if (b.seed != null) params.seed = Number(b.seed);
  if (imgs.length) params.reference_image_urls = imgs;
  if (vids.length) params.reference_video_urls = vids;
  if (auds.length) params.reference_audio_urls = auds;
  const body = { model, prompt, resolution: params.resolution, generate_audio: params.generate_audio };
  if (params.duration != null) body.duration = params.duration;
  if (params.aspect_ratio) body.aspect_ratio = params.aspect_ratio;
  if (params.seed != null) body.seed = params.seed;
  const refs = [
    ...imgs.map((url) => ({ type: 'image_url', image_url: { url } })),
    ...vids.map((url) => ({ type: 'video_url', video_url: { url } })),
    ...auds.map((url) => ({ type: 'audio_url', audio_url: { url } })),
  ];
  if (refs.length) body.input_references = refs;
  return { body, params, model };
}

// OpenRouter's job statuses → the APIFRAME-shaped ones video-log.finishPatch
// reads, so one log has one vocabulary.
function apiframeStatus(st) {
  const s = String(st || '').toLowerCase();
  if (s === 'completed') return 'COMPLETED';
  if (s === 'failed' || s === 'cancelled' || s === 'expired') return 'FAILED';
  return 'PROCESSING';
}

// ByteDance's content refusal vs OpenRouter's own shape error, off the 400's
// text — a refusal is terminal, a ZodError means the body was wrong.
function refusalKind(text) {
  const t = String(text || '');
  if (/SensitiveContent|real person|PrivacyInformation/i.test(t)) return 'content';
  if (/ZodError|invalid_union|Invalid discriminator/i.test(t)) return 'shape';
  return 'other';
}

// ─── OpenRouter calls ────────────────────────────────────────────────
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, { method, headers: headers(),
    body: body ? JSON.stringify(body) : undefined, agent: proxyAgent || undefined });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  if (!res.ok) {
    const e = new Error(`OpenRouter ${res.status}: ${text.slice(0, 600)}`);
    e.status = res.status; e.body = text;
    throw e;
  }
  return json;
}

// The finished clip sits behind the key; download with it and mirror to
// Storage. Falls back to the (keyed) content url when Storage is absent.
async function saveContentToFirebase(jobId, folder = 'openrouter-video') {
  const src = `${BASE}/videos/${encodeURIComponent(jobId)}/content?index=0`;
  const bucket = bucketOrNull();
  if (!bucket) return src;
  try {
    const r = await fetch(src, { headers: { Authorization: `Bearer ${KEY}` }, agent: proxyAgent || undefined });
    if (!r.ok) return src;
    const buf = await r.buffer();
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
    const file = bucket.file(filename);
    await file.save(buf, { metadata: { contentType: 'video/mp4' } });
    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${filename}`;
  } catch { return src; }
}

function logDoc(id) { return admin.firestore().collection(videoLog.COLL).doc(String(id)); }

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();
router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN || req.query.token === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

router.get('/status', (req, res) => {
  res.json({ ok: true, configured: Boolean(KEY), firebase: Boolean(bucketOrNull()), models: MODELS, base: BASE,
    rule: `a reference with a person in it (still or video) is refused by ByteDance — that job goes through ${APIFRAME_ROUTE}` });
});

// GET /credits — the balance, in dollars: what was bought, what is spent,
// what is left. The read a chat makes before naming a price.
router.get('/credits', async (req, res) => {
  try {
    const j = await api('/credits');
    const d = j.data || {};
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, credits: d.total_credits, usage: d.total_usage,
      left: Math.round(((d.total_credits || 0) - (d.total_usage || 0)) * 100) / 100 });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// GET /models — OpenRouter's video-model list, Seedance only, as served (the
// per-token SKUs, resolutions, durations). Free.
router.get('/models', async (req, res) => {
  try {
    const j = await api('/videos/models');
    const list = (j.data || j || []).filter((m) => MODELS.includes(m.id));
    res.json({ ok: true, models: list });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// POST /video — start a Seedance job. Body: the APIFRAME route's fields —
// { prompt, model?, duration?, resolution?, aspectRatio?, generateAudio?,
// seed?, referenceImageUrls?, referenceVideoUrls?, referenceAudioUrls?,
// chat?, scene?, title?, session?, note? }. Answers 202
// { ok, jobId, poll, sent } — `sent` is the exact body OpenRouter received,
// for the read-back her rule asks for. A ByteDance refusal answers 400
// { error, refusal:'content' } and nothing is billed or logged.
router.post('/video', async (req, res) => {
  try {
    if (!KEY) return res.status(503).json({ error: 'OPENROUTER_API_KEY not configured' });
    const b = req.body || {};
    const built = buildRequest(b);
    if (built.error) return res.status(400).json({ error: built.error, refused: built.refused || undefined });
    let r;
    try {
      r = await api('/videos', { method: 'POST', body: built.body });
    } catch (e) {
      const kind = refusalKind(e.body);
      const hint = kind === 'content' ? `ByteDance refused a reference (a face or a person) — that job goes through ${APIFRAME_ROUTE}` : undefined;
      return res.status(e.status || 502).json({ error: e.message, refusal: kind, hint });
    }
    const jobId = r.id;
    if (!jobId) return res.status(502).json({ error: 'OpenRouter gave no job id: ' + JSON.stringify(r).slice(0, 200) });
    try {
      await logDoc(jobId).set({
        ...videoLog.sentRecord({ jobId, prompt: b.prompt, model: built.model, params: built.params,
          tag: { chat: b.chat, scene: b.scene, title: b.title, session: b.session, note: b.note } }),
        provider: 'openrouter',
      }, { merge: true });
    } catch (e) { console.warn('[openrouter] video log write failed', e.message); }
    res.status(202).json({ ok: true, jobId, poll: `/api/openrouter/video-job/${jobId}`, sent: built.body });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// GET /video-job/:id — poll. On completion the clip is downloaded with the
// key, mirrored to Storage once, and the permanent url written to the log.
router.get('/video-job/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const j = await api(`/videos/${encodeURIComponent(id)}`);
    const status = apiframeStatus(j.status);
    let video = null;
    if (status === 'COMPLETED') {
      try { const d = await logDoc(id).get(); video = d.exists && d.data().video ? d.data().video : null; } catch { /* no log */ }
      if (!video) video = await saveContentToFirebase(id);
    }
    try {
      const patch = videoLog.finishPatch({ status, error: j.error }, video);
      if (patch) {
        if (j.usage && j.usage.cost != null) patch.cost = Number(j.usage.cost);
        await logDoc(id).set(patch, { merge: true });
      }
    } catch { /* the poll answers either way */ }
    res.set('Cache-Control', 'no-store');
    res.json({ id, status: String(j.status || '').toLowerCase(), video, usage: j.usage || null, raw: j });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

module.exports = {
  router,
  configured: () => Boolean(KEY),
  buildRequest, modelIdOf, apiframeStatus, refusalKind,
  MODELS, DEFAULT_MODEL, APIFRAME_ROUTE,
};
