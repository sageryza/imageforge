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
// WAN 3.0 RIDES THE SAME DOOR (2026-09-11, Sophie: "can we do a test? make
// sure it has all the right references"). Atlas carries Alibaba's
// `alibaba/wan-3.0/reference-to-video` — one pass of 2-30 seconds, 10
// pictures + 5 videos (15s together) + 5 audio (15s together), a script FILE
// behind `enable_thinking`, 4¢/s at 480p on its sale, and not one sentence
// about faces in its docs — on the same `POST /model/generateVideo` and the
// same prediction poll, with a DIFFERENT body: one mixed `refers` array of
// `{url, type}` (pictures first, then videos, then audio — the doors' slot
// order, cast-line.js's own), `audio` for the sound flag, `ratio` with
// `adaptive`, and none of Seedance's keys (`generate_audio`, `bitrate_mode`,
// `watermark`, `return_last_frame` are not in Wan's schema and are not
// sent). `buildRequest` branches on the model id and the LOG keeps one
// vocabulary either way (`params` is still the APIFRAME-shaped record), so
// `GET /api/apiframe/video-log` reads a Wan clip like any other. Alibaba's
// own slot words are `Image 1` / `Video 1` / `Audio 1`, numbered per kind in
// submission order — a Wan prompt names a reference that way; nothing here
// rewrites her words. The Seedance branch is byte-for-byte what it was.
//
// Routes (mounted at /api/atlascloud by server.js; STUDIO_TOKEN-gated, only
// GET /status open):
//   GET  /status              config health, never key values
//   POST /video               start a Seedance (or Wan 3.0) job
//   GET  /video-job/:id       poll; mirrors the clip on completion
//
// A FIRST FRAME IS A DIFFERENT MODEL ID HERE (2026-09-11) — see the
// `imageToVideoOf` note below the model constants.

const express = require('express');
const fetch = require('node-fetch');
const admin = require('firebase-admin');
const videoLog = require('./video-log');
const videoRefusals = require('./video-refusals');
const videoSeed = require('./video-seed');

const KEY = process.env.ATLASCLOUD_API_KEY || '';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const BASE = process.env.ATLASCLOUD_BASE || 'https://api.atlascloud.ai/api/v1';
// The one id on file — from Atlas Cloud's own reference. Every other
// Seedance id on this door is unmeasured (see the header).
const DEFAULT_MODEL = 'bytedance/seedance-2.0-mini/reference-to-video';
const MODELS = [DEFAULT_MODEL];
// A FIRST FRAME IS A DIFFERENT MODEL ID ON THIS DOOR (2026-09-11, off Atlas's
// own model list). `…/reference-to-video` takes no first frame at all; its
// sibling `…/image-to-video` takes `image` (the first frame, REQUIRED) and an
// optional `last_image` — and takes NO `reference_images` / `reference_videos`
// / `reference_audios`. Same price per second either way, so nothing about
// the estimate moves. So a first frame here means SWAPPING the id, and a job
// carrying both a first frame and references is REFUSED rather than sent with
// one half silently dropped.
const REF_TO_VIDEO = /\/reference-to-video$/;
function imageToVideoOf(model) { return String(model || '').replace(REF_TO_VIDEO, '/image-to-video'); }
function isImageToVideo(model) { return /\/image-to-video$/.test(String(model || '')); }
const RESOLUTIONS = ['480p', '720p', '720p-SR', '1080p-SR', '1440p-SR'];
const RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'];
const APIFRAME_ROUTE = 'POST /api/apiframe/video';
const MAX_IMAGES = 9, MAX_VIDEOS = 3, MAX_AUDIOS = 3;
// Wan 3.0 on this door — Atlas's own schema for the model (2026-09-11):
// refers ≤ 20 (10 pictures, 5 videos, 5 audio), 2-30s or -1, its own
// resolution and ratio lists. 480p stays THIS door's default (Atlas's own
// default is 1080p, five times the money).
const WAN_MODEL = 'alibaba/wan-3.0/reference-to-video';
const WAN = {
  MAX_IMAGES: 10, MAX_VIDEOS: 5, MAX_AUDIOS: 5, MAX_REFERS: 20, MIN_S: 2, MAX_S: 30,
  RESOLUTIONS: ['480p', '720p', '1080p', '720p-esr', '1080p-esr', '1440p-esr', '4k-esr'],
  RATIOS: ['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16'],
};
function isWan(model) { return /^alibaba\/wan-3\.0(-prime)?\/reference-to-video$/.test(String(model || '')); }

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
  // Wan 3.0: its full Atlas id (plain or -prime) as given, and the short
  // names `wan` / `wan-3.0` / `wan3` / `alibaba/wan-3.0` onto the plain id.
  if (isWan(s)) return s;
  if (/^(alibaba\/)?wan[-_ ]?3(\.0)?$/.test(s) || s === 'wan') return WAN_MODEL;
  const short = s.replace(/^bytedance\//, '').replace(/^seedance-?/, '').replace(/\/.*$/, '');
  if (short === '2.0-mini' || short === '2-mini' || short === 'mini') return DEFAULT_MODEL;
  return null;
}

// Wan 3.0's body — the same route fields in, Atlas's Wan schema out. Answers
// { body, params, model } or { error }; never throws, never sends.
function buildWanRequest(b, prompt, model) {
  const imgs = (Array.isArray(b.referenceImageUrls) ? b.referenceImageUrls : []).map(String).filter(Boolean);
  const vids = (Array.isArray(b.referenceVideoUrls) ? b.referenceVideoUrls : []).map(String).filter(Boolean);
  const auds = (Array.isArray(b.referenceAudioUrls) ? b.referenceAudioUrls : []).map(String).filter(Boolean);
  if (imgs.length > WAN.MAX_IMAGES) return { error: `Wan 3.0 takes at most ${WAN.MAX_IMAGES} reference images` };
  if (vids.length > WAN.MAX_VIDEOS) return { error: `Wan 3.0 takes at most ${WAN.MAX_VIDEOS} reference videos (15 seconds together)` };
  if (auds.length > WAN.MAX_AUDIOS) return { error: `Wan 3.0 takes at most ${WAN.MAX_AUDIOS} reference audios (15 seconds together)` };
  if (imgs.length + vids.length + auds.length > WAN.MAX_REFERS) return { error: `Wan 3.0 takes at most ${WAN.MAX_REFERS} references together` };
  const resolution = String(b.resolution || '480p');
  if (!WAN.RESOLUTIONS.includes(resolution)) return { error: `Wan 3.0 resolution must be one of ${WAN.RESOLUTIONS.join(', ')}` };
  const params = { resolution };
  if (b.duration != null) {
    const d = Number(b.duration);
    if (!Number.isInteger(d) || (d !== -1 && (d < WAN.MIN_S || d > WAN.MAX_S))) return { error: `Wan 3.0 duration is ${WAN.MIN_S}-${WAN.MAX_S} seconds (or -1 to let the model choose)` };
    params.duration = d;
  }
  if (b.aspectRatio) {
    const r = String(b.aspectRatio);
    if (!WAN.RATIOS.includes(r)) return { error: `Wan 3.0 aspectRatio must be one of ${WAN.RATIOS.join(', ')}` };
    params.aspect_ratio = r;
  }
  params.generate_audio = b.generateAudio == null ? true : Boolean(b.generateAudio);
  params.seed = videoSeed.seedFor(b.seed);
  if (imgs.length) params.reference_image_urls = imgs;
  if (vids.length) params.reference_video_urls = vids;
  if (auds.length) params.reference_audio_urls = auds;
  // A SCRIPT FILE rides as `file` and needs Atlas's thinking mode on; the
  // log keeps its url beside the references.
  const fileUrl = b.fileUrl ? String(b.fileUrl) : '';
  if (fileUrl && !/^https?:\/\//.test(fileUrl)) return { error: 'fileUrl must be a public https url' };
  if (fileUrl) params.file_url = fileUrl;
  const body = { model, prompt, resolution: params.resolution, audio: params.generate_audio, seed: params.seed };
  if (params.duration != null) body.duration = params.duration;
  if (params.aspect_ratio) body.ratio = params.aspect_ratio;
  const refers = [
    ...imgs.map((url) => ({ url, type: 'image' })),
    ...vids.map((url) => ({ url, type: 'video' })),
    ...auds.map((url) => ({ url, type: 'audio' })),
  ];
  if (refers.length) body.refers = refers;
  if (fileUrl) { body.file = fileUrl; body.enable_thinking = true; }
  return { body, params, model };
}

// Build Atlas Cloud's body from the route's body (the APIFRAME route's field
// names, so a chat swaps the url and nothing else). Answers { body, params,
// model } or { error } — never throws, never sends. `params` is the log's
// APIFRAME-shaped record (reference_*_urls, aspect_ratio…) so one log has
// one vocabulary; `body` is what Atlas really receives (`ratio`,
// `reference_images`…).
// THE SECONDS RANGE IS PER MODEL — read off Atlas's own schema files
// (static.atlascloud.ai/model/schema/bytedance-seedance-*-reference-to-video.json,
// 2026-09-11): 2.5 takes 4-30, every 2.0 (Mini, Fast, 2.0) takes 4-15.
// This door used to clamp EVERY model to 15, so a 30s 2.5 job that
// footage.js had already accepted was refused here with "4-15" — Sophie's
// "it says too long but 2.5 allows 30s". -1 (the model picks) rides either way.
function secondsRange(model) {
  return /seedance-2\.5/.test(String(model || '')) ? [4, 30] : [4, 15];
}

// THE TWO KEYFRAMES, read off the route's body the same way every door reads
// them (`firstFrameUrl` / `lastFrameUrl`). Answers { first, last } or
// { error }; a url that is not a public https one is refused rather than
// sent, since the door would refuse it a round trip later.
function framesOf(b) {
  const one = (v, what) => {
    if (v == null || v === '') return '';
    const s = String(v);
    if (!/^https?:\/\//.test(s)) return { error: `${what} must be a public https url` };
    return s;
  };
  const first = one(b.firstFrameUrl, 'firstFrameUrl');
  if (first && first.error) return first;
  const last = one(b.lastFrameUrl, 'lastFrameUrl');
  if (last && last.error) return last;
  return { first: first || '', last: last || '' };
}

function buildRequest(b) {
  b = b || {};
  const prompt = String(b.prompt == null ? '' : b.prompt);
  if (!prompt.trim()) return { error: 'prompt is required' };
  let model = modelIdOf(b.model);
  if (!model) return { error: `unknown model "${b.model}" — Mini is the one id on file; pass a full bytedance/seedance-…/reference-to-video id for anything else, or wan-3.0` };
  const kf = framesOf(b);
  if (kf.error) return kf;
  // WAN 3.0's image-to-video sibling is UNMEASURED on this door — its schema
  // here is the reference-to-video one — so a keyframe on Wan is refused
  // rather than sent under a key nothing has read back.
  if (isWan(model)) {
    if (kf.first || kf.last) return { error: 'Wan 3.0 on this door takes references, not a first or last frame — send it as a reference image, or use Seedance' };
    return buildWanRequest(b, prompt, model);
  }
  const imgs = (Array.isArray(b.referenceImageUrls) ? b.referenceImageUrls : []).map(String).filter(Boolean);
  const vids = (Array.isArray(b.referenceVideoUrls) ? b.referenceVideoUrls : []).map(String).filter(Boolean);
  const auds = (Array.isArray(b.referenceAudioUrls) ? b.referenceAudioUrls : []).map(String).filter(Boolean);
  // A KEYFRAME SWAPS THE MODEL ID AND REFUSES REFERENCES BESIDE IT. Atlas's
  // `…/image-to-video` has no reference lists in its schema at all, so a job
  // carrying both would draw from the first frame alone and the references
  // she attached would be gone with nothing on screen saying so — the silent
  // drop this refusal exists to prevent.
  if (kf.first || kf.last) {
    if (imgs.length || vids.length || auds.length) {
      return { error: 'Atlas Cloud takes a first frame OR references, never both on one job — take the references off, or send it through APIFRAME, which wires a first frame beside them' };
    }
    // `image` is REQUIRED on image-to-video, so a last frame with nothing to
    // start from has nowhere to go here. Said plainly rather than guessed at.
    if (!kf.first) return { error: 'Atlas Cloud needs a FIRST frame to take a last one — mark the frame the clip starts on' };
    model = imageToVideoOf(model);
  } else if (isImageToVideo(model)) {
    return { error: 'that model id is image-to-video — it needs a firstFrameUrl' };
  }
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
    const [lo, hi] = secondsRange(model);
    if (!Number.isInteger(d) || (d !== -1 && (d < lo || d > hi))) return { error: `duration is ${lo}-${hi} seconds (or -1 to let the model choose)` };
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
  // THE LOG KEEPS ONE VOCABULARY — `start_image` / `end_image` are APIFRAME's
  // names for the two keyframes, and `video-log.js` reads exactly those off
  // `params` into `references.startImage` / `endImage`. So a frame sent
  // through this door is on the 1080p-redo reading list under the same name
  // it has on every other door, whatever Atlas calls it on the wire.
  if (kf.first) params.start_image = kf.first;
  if (kf.last) params.end_image = kf.last;
  // RETURN_LAST_FRAME WORKS ON THIS DOOR AND IS FREE — measured 2026-09-09
  // (see the header). Off by default so no existing caller's answer changes;
  // `returnLastFrame: true` asks for it.
  params.return_last_frame = Boolean(b.returnLastFrame);
  const body = { model, prompt, resolution: params.resolution, generate_audio: params.generate_audio,
    seed: params.seed, bitrate_mode: 'standard', watermark: false,
    return_last_frame: params.return_last_frame };
  if (params.duration != null) body.duration = params.duration;
  if (params.aspect_ratio) body.ratio = params.aspect_ratio;
  // Atlas's own names on the wire: `image` is the first frame, `last_image`
  // the optional one it ends on.
  if (kf.first) body.image = kf.first;
  if (kf.last) body.last_image = kf.last;
  if (imgs.length) body.reference_images = imgs;
  if (vids.length) body.reference_videos = vids;
  if (auds.length) body.reference_audios = auds;
  return { body, params, model };
}

// Atlas's `outputs` → { video, lastFrame }. With `return_last_frame` the
// array carries the clip AND a `…_last-frame.png`; matched by NAME (the
// query string is stripped first — the url is signed and carries `.mp4` and
// `.png` inside its own parameters), never by position, so an output order
// that changes cannot hand a PNG back as the clip.
function splitOutputs(out) {
  const list = (Array.isArray(out) ? out : []).filter(Boolean).map(String);
  const path = (u) => { try { return new URL(u).pathname; } catch { return u.split('?')[0]; } };
  const isFrame = (u) => /_last-frame\.(png|jpe?g|webp)$/i.test(path(u));
  return { video: list.find((u) => !isFrame(u)) || null, lastFrame: list.find(isFrame) || null };
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
// EVERY reason on file — and the line she reads for each — is ONE table,
// `video-refusals.js`, shared by the doors and the footage card; this asks
// it first ('content' | 'output' | 'shape' | 'down') and keeps the old
// shape regex as the floor for a wording the table has not met.
function refusalKind(text, code) {
  const t = String(text || '');
  const k = videoRefusals.kindOf(t, code);
  if (k !== 'other') return k;
  if (/invalid|validation|must be|required|schema/i.test(t)) return 'shape';
  return 'other';
}

// ─── Atlas Cloud calls ───────────────────────────────────────────────
// A CALL THAT HANGS IS ANSWERED, NOT WAITED OUT (2026-09-10, Sophie: "my clip
// isn't drawing :("). Atlas's job endpoints went dark that night — its
// `GET /models` answered in 0.8s while `POST /model/generateVideo` gave
// NOTHING for 120s and then its own gateway's 504, and the prediction poll
// timed out too (measured from a container, with a body that could not make
// a job). This call had no timeout, so her tap held the POST for two minutes
// and the page said "Could not start" with nothing about why. A send now
// waits SEND_MS (well past the seconds a real accept takes, well under the
// 120s both Atlas's gateway and Render's edge cut at) and a poll POLL_MS,
// and a call that times out or comes back as a gateway page (502/503/504)
// throws `refusal:'down'` with a line she can read: nothing was sent, nothing
// was charged, try again in a few minutes.
const SEND_MS = 75000, POLL_MS = 30000;
const DOWN_HINT = 'Atlas Cloud is not answering right now — nothing was sent or charged. Try again in a few minutes, or ask a chat to send this one through APIFRAME.';
function downError(status, text) {
  const e = new Error(`Atlas Cloud is not answering (${status})`);
  e.status = 504; e.body = text || ''; e.refusal = 'down'; e.hint = DOWN_HINT;
  return e;
}
async function api(path, { method = 'GET', body } = {}) {
  const ctl = new AbortController();
  const ms = method === 'POST' ? SEND_MS : POLL_MS;
  const timer = setTimeout(() => ctl.abort(), ms);
  let res;
  try {
    res = await fetch(BASE + path, { method, headers: headers(),
      body: body ? JSON.stringify(body) : undefined, agent: proxyAgent || undefined, signal: ctl.signal });
  } catch (e) {
    clearTimeout(timer);
    if (e && (e.name === 'AbortError' || e.type === 'aborted')) throw downError(`no answer in ${Math.round(ms / 1000)}s`, '');
    throw e;
  }
  let text;
  try { text = await res.text(); } finally { clearTimeout(timer); }
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  if (!res.ok) {
    // a gateway page (not JSON) on a 5xx is Atlas's front door with nothing
    // behind it — the same "down" as a timeout, and it reads the same to her
    if (res.status >= 502 && res.status <= 504 && json._raw !== undefined) throw downError(res.status, text);
    const e = new Error(`Atlas Cloud ${res.status}: ${text.slice(0, 600)}`);
    e.status = res.status; e.body = text;
    throw e;
  }
  return json;
}

// The finished clip is a plain url on Atlas's CDN; mirror it to Storage so
// the log's url is permanent. Falls back to Atlas's own url when Storage is
// absent or the download fails. The key is NOT sent to the CDN host.
async function saveContentToFirebase(src, folder = 'atlascloud-video', kind = 'mp4') {
  const bucket = bucketOrNull();
  if (!bucket || !src) return src;
  const TYPES = { mp4: 'video/mp4', png: 'image/png' };
  try {
    const r = await fetch(src, { agent: proxyAgent || undefined });
    if (!r.ok) return src;
    const buf = await r.buffer();
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${kind}`;
    const file = bucket.file(filename);
    await file.save(buf, { metadata: { contentType: TYPES[kind] || 'application/octet-stream' } });
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
    wan: { model: WAN_MODEL, seconds: [WAN.MIN_S, WAN.MAX_S], resolutions: WAN.RESOLUTIONS, ratios: WAN.RATIOS,
      refs: { images: WAN.MAX_IMAGES, videos: WAN.MAX_VIDEOS, audios: WAN.MAX_AUDIOS } },
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
    if (e.refusal === 'down') throw e;          // api() already said it, in her words
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
// Atlas answers a FAILED prediction with HTTP 400 — the same record any
// other status comes back under 200 with, `data.status:'failed'` and the
// error text — so a refused job used to READ as a transport error here:
// `api()` threw, `pollOne` swallowed it, and the card said "drawing" forever
// (measured 2026-09-10: four clips refused in under two seconds — "Total
// duration of all reference videos must not exceed 15.2 seconds" — still
// drawing on her page twenty minutes later). A body carrying a prediction
// record IS the answer, whatever the status line says.
function failedRecord(e) {
  let j;
  try { j = JSON.parse(String((e && e.body) || '')); } catch { return null; }
  return j && j.data && j.data.status ? j : null;
}
async function pollVideo(id) {
  id = String(id);
  let j;
  try { j = await api(`/model/prediction/${encodeURIComponent(id)}`); }
  catch (e) { j = failedRecord(e); if (!j) throw e; }
  const d = (j && j.data) || {};
  const status = apiframeStatus(d.status);
  const out = Array.isArray(d.outputs) ? d.outputs.filter(Boolean) : [];
  // `return_last_frame` adds a SECOND output — the true final frame as a PNG,
  // named `…_last-frame.png`. Told apart by its name, never by its position.
  const { video: videoSrc, lastFrame: lastSrc } = splitOutputs(out);
  let video = null, lastFrame = null;
  if (status === 'COMPLETED') {
    try {
      const s = await logDoc(id).get();
      if (s.exists) { video = s.data().video || null; lastFrame = s.data().lastFrame || null; }
    } catch { /* no log */ }
    if (!video) video = await saveContentToFirebase(videoSrc);
    if (!lastFrame && lastSrc) lastFrame = await saveContentToFirebase(lastSrc, 'atlascloud-lastframe', 'png');
  }
  const tokens = d.completion_tokens != null || d.total_tokens != null
    ? { completion: d.completion_tokens != null ? Number(d.completion_tokens) : null, total: d.total_tokens != null ? Number(d.total_tokens) : null }
    : null;
  let patch = null;
  try {
    patch = videoLog.finishPatch({ status, error: d.error }, video, d);
    if (patch) {
      if (tokens) patch.tokens = tokens;   // Atlas bills in tokens; no dollar figure is invented
      if (lastFrame) patch.lastFrame = lastFrame;
      // the kind rides the log (content | output | shape) so a reader can
      // tell an input gate from an output gate without re-parsing the text
      if (status === 'FAILED') { const k = refusalKind(d.error, d.error_code); if (k !== 'other') patch.refusal = k; }
      await logDoc(id).set(patch, { merge: true });
    }
  } catch { /* the poll answers either way */ }
  return { id, status: String(d.status || '').toLowerCase(), video, lastFrame, tokens, raw: d, patch };
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
  buildRequest, buildWanRequest, isWan, modelIdOf, apiframeStatus, refusalKind, splitOutputs,
  imageToVideoOf, isImageToVideo, framesOf,
  api, startVideo, pollVideo, failedRecord,
  MODELS, DEFAULT_MODEL, RESOLUTIONS, RATIOS, APIFRAME_ROUTE, WAN_MODEL, WAN,
};
