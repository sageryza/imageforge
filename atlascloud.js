'use strict';
// atlascloud.js — the THIRD Seedance door: Atlas Cloud's `reference-to-video`
// endpoint (2026-09-09, Sophie handed over its API reference the same day
// the reseller research landed — CLAUDE.md, "OTHER RESELLERS CARRY THE SAME
// FACE FILTER"). Built so the one honest test that research could not run —
// one ~5¢ Mini job with the eyes-blurred photo, to measure whether Atlas
// quietly takes a real face the way APIFRAME does — is a POST away, and so
// its price (its "-80%" Mini banner is unverified) can be read off a real
// job instead of a deal page.
//
// WHAT IS KNOWN AND WHAT IS NOT. The request shape below is Atlas Cloud's
// own published reference for `bytedance/seedance-2.0-mini/reference-to-
// video`; nothing here has been SENT yet — no job, no price, no refusal
// measured. Three things follow from that:
//   · Only the Mini id is on file. The other Seedance ids on this door are
//     unmeasured, so a full `bytedance/seedance-…` id is passed through as
//     given and Atlas decides; a short name other than Mini's is refused
//     rather than guessed into an id that may not exist.
//   · Atlas bills in TOKENS (`completion_tokens` / `total_tokens` on the
//     prediction) and publishes no dollar-per-token here, so the poll files
//     the token counts on the log and NO cost — the price is hers to read
//     off the console after the first job, and then to write into
//     footage.js's table.
//   · Whether a content refusal comes back on the POST (as OpenRouter's does,
//     free) or as a `failed` prediction after the fact is UNMEASURED. Both
//     roads are handled: a 4xx whose text carries ByteDance's refusal code
//     throws `refusal:'content'` and logs nothing; a prediction that fails
//     with that text patches `refusal:'content'` onto the log.
//
// THE SLOT WORD IS ATLAS'S OWN, AND IT IS UNMEASURED WHETHER `[Image1]`
// WORKS THERE. Atlas's reference names references as `image 1` / `video 1`
// in order, and its own example writes `@image1`; the house prompts say
// `[Image1]` (APIFRAME's and OpenRouter's convention). Nothing here rewrites
// her prompt — a reference is named by its slot in her words and sent
// verbatim — so the first job through this door should carry Atlas's
// spelling, and whether the bracket form also lands is a measurement worth
// one cheap clip.
//
// THE LOG IS SHARED. Every accepted job files the same `forge-video-jobs`
// doc the other two doors file (video-log.js — the literal prompt, the
// model, the exact params, every reference url, chat/scene/title), stamped
// `provider: 'atlascloud'`, and the poll fills in the outcome and the clip's
// permanent url. `GET /api/apiframe/video-log?chat=` reads all three doors.
//
// Her "go" rule (CLAUDE.md) is the chat's, not this module's: show the
// model, seconds, resolution, the exact prompt and every reference, wait for
// "go", THEN post. The 202 answer carries the exact body Atlas received.
//
// Routes (mounted at /api/atlascloud by server.js; STUDIO_TOKEN-gated, only
// GET /status open):
//   GET  /status              config health, never key values
//   POST /video               start a Seedance job
//   GET  /video-job/:id       poll; mirrors the clip on completion

const express = require('express');
const fetch = require('node-fetch');
const admin = require('firebase-admin');
const videoLog = require('./video-log');
const videoSeed = require('./video-seed');

const KEY = process.env.ATLASCLOUD_API_KEY || '';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const BASE = process.env.ATLASCLOUD_BASE || 'https://api.atlascloud.ai/api/v1';
// The one id on file — from Atlas Cloud's own reference. Every other
// Seedance id on this door is unmeasured (see the header).
const DEFAULT_MODEL = 'bytedance/seedance-2.0-mini/reference-to-video';
const MODELS = [DEFAULT_MODEL];
const RESOLUTIONS = ['480p', '720p', '720p-SR', '1080p-SR', '1440p-SR'];
const RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'];
const APIFRAME_ROUTE = 'POST /api/apiframe/video';
const MAX_IMAGES = 9, MAX_VIDEOS = 3, MAX_AUDIOS = 3;

let proxyAgent = null;
if (process.env.HTTPS_PROXY) {
  try {
    const { HttpsProxyAgent } = require('https-proxy-agent');
    proxyAgent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
  } catch { /* direct */ }
}

function headers() {
  return { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
}

function bucketOrNull() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}

// ─── Pure: the model id, the request shape, the refusal, the status map ──
// Mini's short names map onto the one id on file; a full Atlas id
// (`bytedance/seedance-…/…-to-video`) is passed through as given, because
// the other ids are unmeasured and Atlas is the one that knows; any other
// short name is refused rather than guessed.
function modelIdOf(m) {
  if (!m) return DEFAULT_MODEL;
  const s = String(m).trim().toLowerCase();
  if (MODELS.includes(s)) return s;
  if (/^bytedance\/seedance-[\w.-]+\/[\w-]+-to-video$/.test(s)) return s;
  const short = s.replace(/^bytedance\//, '').replace(/^seedance-?/, '').replace(/\/.*$/, '');
  if (short === '2.0-mini' || short === '2-mini' || short === 'mini') return DEFAULT_MODEL;
  return null;
}

// Build Atlas Cloud's body from the route's body (the APIFRAME route's field
// names, so a chat swaps the url and nothing else). Answers { body, params,
// model } or { error } — never throws, never sends. `params` is the log's
// APIFRAME-shaped record (reference_*_urls, aspect_ratio…) so one log has
// one vocabulary; `body` is what Atlas really receives (`ratio`,
// `reference_images`…).
function buildRequest(b) {
  b = b || {};
  const prompt = String(b.prompt == null ? '' : b.prompt);
  if (!prompt.trim()) return { error: 'prompt is required' };
  const model = modelIdOf(b.model);
  if (!model) return { error: `unknown model "${b.model}" — Mini is the one id on file; pass a full bytedance/seedance-…/reference-to-video id for anything else` };
  const imgs = (Array.isArray(b.referenceImageUrls) ? b.referenceImageUrls : []).map(String).filter(Boolean);
  const vids = (Array.isArray(b.referenceVideoUrls) ? b.referenceVideoUrls : []).map(String).filter(Boolean);
  const auds = (Array.isArray(b.referenceAudioUrls) ? b.referenceAudioUrls : []).map(String).filter(Boolean);
  if (imgs.length > MAX_IMAGES) return { error: `at most ${MAX_IMAGES} reference images` };
  if (vids.length > MAX_VIDEOS) return { error: `at most ${MAX_VIDEOS} reference videos` };
  if (auds.length > MAX_AUDIOS) return { error: `at most ${MAX_AUDIOS} reference audios` };
  // Atlas's own rule: audio needs at least one picture or video beside it.
  if (auds.length && !imgs.length && !vids.length) return { error: 'a reference audio needs at least one reference image or video' };
  const resolution = String(b.resolution || '480p');
  if (!RESOLUTIONS.includes(resolution)) return { error: `resolution must be one of ${RESOLUTIONS.join(', ')}` };
  const params = { resolution };
  if (b.duration != null) {
    const d = Number(b.duration);
    if (!Number.isInteger(d) || (d !== -1 && (d < 4 || d > 15))) return { error: 'duration is 4-15 seconds (or -1 to let the model choose)' };
    params.duration = d;
  }
  if (b.aspectRatio) {
    const r = String(b.aspectRatio);
    if (!RATIOS.includes(r)) return { error: `aspectRatio must be one of ${RATIOS.join(', ')}` };
    params.aspect_ratio = r;
  }
  params.generate_audio = b.generateAudio == null ? true : Boolean(b.generateAudio);
  // EVERY CLIP CARRIES A SEED, minted when the caller did not pass one
  // (video-seed.js). Atlas takes -1..4294967295; the mint is inside that.
  params.seed = videoSeed.seedFor(b.seed);
  if (imgs.length) params.reference_image_urls = imgs;
  if (vids.length) params.reference_video_urls = vids;
  if (auds.length) params.reference_audio_urls = auds;
  const body = { model, prompt, resolution: params.resolution, generate_audio: params.generate_audio,
    seed: params.seed, bitrate_mode: 'standard', watermark: false, return_last_frame: false };
  if (params.duration != null) body.duration = params.duration;
  if (params.aspect_ratio) body.ratio = params.aspect_ratio;
  if (imgs.length) body.reference_images = imgs;
  if (vids.length) body.reference_videos = vids;
  if (auds.length) body.reference_audios = auds;
  return { body, params, model };
}

// Atlas's prediction statuses → the APIFRAME-shaped ones video-log.finishPatch
// reads, so one log has one vocabulary.
function apiframeStatus(st) {
  const s = String(st || '').toLowerCase();
  if (s === 'completed' || s === 'succeeded') return 'COMPLETED';
  if (s === 'failed' || s === 'timeout' || s === 'cancelled' || s === 'canceled') return 'FAILED';
  return 'PROCESSING';
}

// ByteDance's content refusal (Atlas forwards to the same model service, so
// the same codes are expected) vs a shape error, off the error text.
function refusalKind(text) {
  const t = String(text || '');
  if (/SensitiveContent|real person|PrivacyInformation|copyright/i.test(t)) return 'content';
  if (/invalid|validation|must be|required|schema/i.test(t)) return 'shape';
  return 'other';
}

// ─── Atlas Cloud calls ───────────────────────────────────────────────
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, { method, headers: headers(),
    body: body ? JSON.stringify(body) : undefined, agent: proxyAgent || undefined });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  if (!res.ok) {
    const e = new Error(`Atlas Cloud ${res.status}: ${text.slice(0, 600)}`);
    e.status = res.status; e.body = text;
    throw e;
  }
  return json;
}

// The finished clip is a plain url on Atlas's CDN; mirror it to Storage so
// the log's url is permanent. Falls back to Atlas's own url when Storage is
// absent or the download fails. The key is NOT sent to the CDN host.
async function saveContentToFirebase(src, folder = 'atlascloud-video') {
  const bucket = bucketOrNull();
  if (!bucket || !src) return src;
  try {
    const r = await fetch(src, { agent: proxyAgent || undefined });
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
    resolutions: RESOLUTIONS, ratios: RATIOS,
    note: 'nothing has been sent through this door yet — price, canvas and the face filter are unmeasured here',
    rule: `a reference with a person in it is expected to be refused (Atlas forwards to ByteDance) — that job goes through ${APIFRAME_ROUTE}` });
});

// The route's body, as a function — so footage.js can send through this door
// IN PROCESS the day it is wired in, and the route stays a thin call.
// Answers { jobId, sent, model, params }; throws an Error carrying `status`,
// `refusal` ('content' | 'shape' | 'other') and `hint` on a refusal. Logs the
// job (extra fields in `extra` ride onto the same doc) before answering.
async function startVideo(b, extra) {
  if (!KEY) { const e = new Error('ATLASCLOUD_API_KEY not configured'); e.status = 503; throw e; }
  b = b || {};
  const built = buildRequest(b);
  if (built.error) { const e = new Error(built.error); e.status = 400; throw e; }
  let r;
  try {
    r = await api('/model/generateVideo', { method: 'POST', body: built.body });
  } catch (e) {
    const kind = refusalKind(e.body);
    e.refusal = kind;
    e.hint = kind === 'content' ? `Atlas Cloud refused a reference (a face or a person) — that job goes through ${APIFRAME_ROUTE}` : undefined;
    if (!e.status) e.status = 502;
    throw e;
  }
  const jobId = r && r.data && r.data.id;
  if (!jobId) { const e = new Error('Atlas Cloud gave no prediction id: ' + JSON.stringify(r).slice(0, 200)); e.status = 502; throw e; }
  try {
    await logDoc(jobId).set({
      ...videoLog.sentRecord({ jobId, prompt: b.prompt, model: built.model, params: built.params,
        tag: { chat: b.chat, scene: b.scene, title: b.title, session: b.session, note: b.note } }),
      provider: 'atlascloud',
      ...(extra && typeof extra === 'object' ? extra : {}),
    }, { merge: true });
  } catch (e) { console.warn('[atlascloud] video log write failed', e.message); }
  return { jobId, sent: built.body, model: built.model, params: built.params };
}

// The poll, as a function: reads the prediction, mirrors the clip once on
// completion, patches the log. Answers { id, status, video, tokens, raw, patch }.
async function pollVideo(id) {
  id = String(id);
  const j = await api(`/model/prediction/${encodeURIComponent(id)}`);
  const d = (j && j.data) || {};
  const status = apiframeStatus(d.status);
  const out = Array.isArray(d.outputs) ? d.outputs.filter(Boolean) : [];
  let video = null;
  if (status === 'COMPLETED') {
    try { const s = await logDoc(id).get(); video = s.exists && s.data().video ? s.data().video : null; } catch { /* no log */ }
    if (!video) video = await saveContentToFirebase(out[0] || null);
  }
  const tokens = d.completion_tokens != null || d.total_tokens != null
    ? { completion: d.completion_tokens != null ? Number(d.completion_tokens) : null, total: d.total_tokens != null ? Number(d.total_tokens) : null }
    : null;
  let patch = null;
  try {
    patch = videoLog.finishPatch({ status, error: d.error }, video);
    if (patch) {
      if (tokens) patch.tokens = tokens;   // Atlas bills in tokens; no dollar figure is invented
      if (status === 'FAILED' && refusalKind(d.error) === 'content') patch.refusal = 'content';
      await logDoc(id).set(patch, { merge: true });
    }
  } catch { /* the poll answers either way */ }
  return { id, status: String(d.status || '').toLowerCase(), video, tokens, raw: d, patch };
}

// POST /video — start a Seedance job. Body: the APIFRAME route's fields —
// { prompt, model?, duration?, resolution?, aspectRatio?, generateAudio?,
// seed?, referenceImageUrls?, referenceVideoUrls?, referenceAudioUrls?,
// chat?, scene?, title?, session?, note? }. Answers 202
// { ok, jobId, poll, sent } — `sent` is the exact body Atlas received, for
// the read-back her rule asks for. A refusal on the POST answers 400
// { error, refusal } and nothing is logged.
router.post('/video', async (req, res) => {
  try {
    const r = await startVideo(req.body || {});
    res.status(202).json({ ok: true, jobId: r.jobId, poll: `/api/atlascloud/video-job/${r.jobId}`, sent: r.sent });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, refusal: e.refusal, hint: e.hint });
  }
});

// GET /video-job/:id — poll. On completion the clip is mirrored to Storage
// once and the permanent url written to the log.
router.get('/video-job/:id', async (req, res) => {
  try {
    const r = await pollVideo(req.params.id);
    res.set('Cache-Control', 'no-store');
    res.json({ id: r.id, status: r.status, video: r.video, tokens: r.tokens, raw: r.raw });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

module.exports = {
  router,
  configured: () => Boolean(KEY),
  buildRequest, modelIdOf, apiframeStatus, refusalKind,
  api, startVideo, pollVideo,
  MODELS, DEFAULT_MODEL, RESOLUTIONS, RATIOS, APIFRAME_ROUTE,
};
