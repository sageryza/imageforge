'use strict';
// footage.js — FOOTAGE: Sophie makes Seedance clips HERSELF (2026-09-09,
// Sophie: "the next step is to build a point so I can just make things on my
// own time by describing them or uploading references").
//
// Until this, every Seedance clip went through a chat: she described the
// shot, the chat showed the model/seconds/prompt/references, she said "go",
// the chat sent it and read back what the API received. This page is that
// ritual with her own thumb as the go — the prompt box, her references
// (uploaded through the Dump, so nothing is stored twice), the model, the
// seconds, the resolution, the shape, sound on/off, the price BEFORE the tap,
// and the star that spends it. Nothing on this page spends money until she
// taps the star; opening it costs nothing.
//
// THREE DOORS, ONE LOG. The clip goes out through atlascloud.js (the page's
// door and the auto default since 2026-09-09 — it takes a person in a
// reference and prices Mini at a fifth of list), openrouter.js (ByteDance's
// own price) or apiframe.js (the last resort for a face Atlas refuses),
// IN PROCESS — `startVideo` / `pollVideo` on each module — and every job
// files the same `forge-video-jobs` doc those doors already file
// (video-log.js: the literal prompt, the exact params, every reference url),
// tagged `chat:'footage'`, so `GET /api/apiframe/video-log?chat=footage` is
// the 1080p-redo reading list for anything she makes here.
//
// THE DOOR IS DECIDED BY THE FILTER, NOT BY GUESSING (CLAUDE.md, measured
// 2026-09-08): ByteDance refuses a reference with a PERSON in it — a real
// photo still (unless the eyes are blurred), any video with a person — for
// free, before anything draws, and APIFRAME accepts the same reference. So
// AUTO sends through OpenRouter first and, on a content refusal, sends the
// identical job through APIFRAME and says so on the card. She can pin either
// door. Seedance 1.5 Pro exists only on APIFRAME.
//
// THE PRICE IS SERVED, NEVER COPIED INTO THE PAGE (the Playground's rule):
// `GET /status` carries the model table and `GET /estimate` answers the price
// of the tap as the controls stand. OpenRouter bills per VIDEO TOKEN —
// (w × h × (24·seconds + 1)) / 1024 — at the SKU price it publishes, times
// ByteDance's sale factor, in LIST credit dollars (the ~5% top-up fee is paid
// when credit is bought, not per job, so it is not in the shown price).
// APIFRAME is per second by resolution, with its own rate when a reference
// video rides. Both halves are MEASURED off real charges — see the model
// table's own note, which carries the job counts and the dates. An estimate
// answers `exact:true` where it is pinned and `about:true` where it is not,
// and the page prints "about" only for the second. The REAL cost lands on the
// card when the job finishes (OpenRouter reports it; APIFRAME does not, so an
// APIFRAME card keeps the estimate, marked as one).
//
// Routes (mounted at /api/footage by server.js; STUDIO_TOKEN-gated):
//   GET  /status             doors + balances (60s cache) + the model table
//   POST /jobs               start one clip — the star's tap
//   GET  /jobs?limit=        her clips, newest first; polls the unfinished ones
//   POST /jobs/:id/vote      { vote: 'like'|'dislike'|'' }
//   POST /jobs/:id/hide      { hidden: true|false }
// Test: node scripts/test-footage.js

const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const crypto = require('crypto');
const videoLog = require('./video-log');
const videoSeed = require('./video-seed');
const videoFloor = require('./video-floor');

const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const CHAT = 'footage';
const POLL_EVERY_MS = 12000;   // a running job is asked at most this often, whoever asks
const BAL_CACHE_MS = 60000;

let proxyAgent = null;
if (process.env.HTTPS_PROXY) {
  try { const { HttpsProxyAgent } = require('https-proxy-agent'); proxyAgent = new HttpsProxyAgent(process.env.HTTPS_PROXY); } catch { /* direct */ }
}

// ─── The model table ────────────────────────────────────────────────────
// `or` = OpenRouter's id (null = not on that door), `af` = APIFRAME's id.
// `orTok` = $ per video token by resolution (OpenRouter's published SKU);
// `sale` = ByteDance's promo as measured at billing; `afCents` = APIFRAME
// cents per second by resolution (null = not offered / unpriced), `afVid` the
// same WITH a reference video riding, `afExact` the (resolution[+video]) pairs
// those figures are MEASURED on. `secs` = [min, max]. `sizes` names the canvas
// table the door really renders on, when that is not the model's own family.
//
// THE PRICE IS EXACT NOW, AND THE 60% SALE ENDED 2026-09-09 — measured off
// 113 completed OpenRouter jobs (their `usage.cost`) and 44 APIFRAME jobs
// (their `creditCost`), with ffprobe on the output clips:
//   · MINI RENDERS ON THE 2.5 CANVASES, not the 2.0 ones — 480p 1:1 is
//     640×640, 480p 3:4 is 560×752, 720p 3:4 is 834×1112 (ffprobe, every
//     clip). 2.0, Fast and 2.5 have NEVER gone through OpenRouter, so their
//     canvases are unmeasured and keep the published table.
//   · A CLIP IS 24·s + 1 FRAMES, not 24·s — the billed count fits 97 exactly
//     on a 4s ask, and that +1 is what makes the formula land on the cent.
//   · THE SALE IS READ LIVE, NEVER WRITTEN DOWN. Measured: Mini was billed
//     at 0.40 × list — a real 60% off — on all 111 jobs from 2026-09-08 21:13
//     UTC through 2026-09-09 06:39 UTC, and the two jobs since (18:09 and
//     18:22 UTC, both from /footage) at FULL LIST: 13.96¢ for a 4s 3:4 480p
//     Mini against 5.58¢. ByteDance's own campaign page is still running
//     (Seedance 2.0 mini 40% of list and 2.0 fast 75%, both to 2026-10-07
//     14:00 UTC+8; 2.5 at 1080p only 72%, to 2026-09-17; plain 2.0 is not in
//     it) — so it is OPENROUTER that stopped passing the discount on today.
//     It exposes it per model as `pricing.discount` on the endpoints route,
//     which reads 0 right now and used to advertise mini "from
//     $0.01345/second" (= 0.40 × $0.03363). So the factor is fetched (see
//     `discounts()`), cached ten minutes, and a failed read is 0 — full list,
//     the safe direction — never a stale sale. The old hardcoded 0.72 / 0.75
//     are gone: they were wrong numbers that only looked right on 1:1, where
//     the canvas was wrong too.
//   · `orTok` IS WHAT OPENROUTER LISTS, which is what it bills against — and
//     its Fast figure ($4.20/M) is already ByteDance's DISCOUNTED fast price.
//     Don't try to reconcile that in code; the discount field is the only
//     factor applied.
const MODELS = [
  // ATLAS CLOUD IS THE PAGE'S DOOR AND THE AUTO DEFAULT (2026-09-09, Sophie:
  // "make atlas the default and only route through footage"). `atlas` is
  // Atlas's model id on every 2.x row; `atlasCents` is Atlas's published LIST
  // rate per second (Mini 5.6¢ · Fast 9¢ · 2.0 11.2¢ · 2.5 16.7¢, read off
  // its own `GET /models` `price.origin` on 2026-09-09) and is only the
  // FALLBACK — the live price comes off that same `GET /models`
  // (`price.actual.base_price`, the sale already applied; `atlasPrices()`
  // below), so the 80%-off Mini sale is read, never written down, exactly as
  // OpenRouter's discount is. It shipped for one afternoon as its own
  // "2.0 Mini · Atlas" row beside the OpenRouter one; her ask the same
  // evening folded the door into the rows. MEASURED (2026-09-09): a PERSON
  // video and a real untouched photo both pass and draw; only a famous face
  // is refused (free, on the POST, as copyright). 1080p on 2.0 is unpriced
  // on Atlas and stays null.
  { id: 'mini', label: '2.0 Mini', or: 'bytedance/seedance-2.0-mini', af: 'seedance-2-mini',
    atlas: 'bytedance/seedance-2.0-mini/reference-to-video',
    res: ['480p', '720p'], secs: [4, 15], family: '2.0', sizes: '2.5',
    orTok: { '480p': 3.5e-6, '720p': 3.5e-6 },
    afCents: { '480p': 4, '720p': 9 }, afVid: { '480p': 5 }, afExact: ['480p+video'],
    atlasCents: { '480p': 5.6, '720p': 5.6 } },
  { id: 'fast', label: '2.0 Fast', or: 'bytedance/seedance-2.0-fast', af: 'seedance-2-fast',
    atlas: 'bytedance/seedance-2.0-fast/reference-to-video',
    res: ['480p', '720p'], secs: [4, 15], family: '2.0',
    orTok: { '480p': 4.2e-6, '720p': 4.2e-6 },
    afCents: { '480p': 7, '720p': 16 }, atlasCents: { '480p': 9, '720p': 9 } },
  { id: '2.0', label: '2.0', or: 'bytedance/seedance-2.0', af: 'seedance-2',
    atlas: 'bytedance/seedance-2.0/reference-to-video',
    res: ['480p', '720p', '1080p'], secs: [4, 15], family: '2.0',
    orTok: { '480p': 7e-6, '720p': 7e-6, '1080p': 7.7e-6 },
    afCents: { '480p': 8, '720p': 18, '1080p': null }, atlasCents: { '480p': 11.2, '720p': 11.2, '1080p': null } },
  { id: '2.5', label: '2.5', or: 'bytedance/seedance-2.5', af: 'seedance-2.5',
    atlas: 'bytedance/seedance-2.5/reference-to-video',
    res: ['480p', '720p'], secs: [4, 30], family: '2.5',
    orTok: { '480p': 1.07e-5, '720p': 1.07e-5 },
    afCents: { '480p': 13, '720p': 29 }, afVid: { '480p': 15 }, afExact: ['480p', '480p+video'],
    atlasCents: { '480p': 16.7, '720p': 16.7 } },
  { id: '1.5', label: '1.5 Pro', or: null, af: 'seedance-1.5-pro',
    res: ['480p', '720p'], secs: [4, 8, 12], family: '2.0', audioDefault: false,
    afCents: { '480p': 1.5, '720p': 3.4 } },
];
const RATIOS = ['1:1', '3:4', '9:16', '4:3', '16:9', '21:9'];
// The canvas ByteDance renders for a shape at a resolution (OpenRouter's
// `supported_sizes`, read 2026-09-09) — what the token count is made of. Mini
// is MEASURED onto the 2.5 table (`sizes: '2.5'` above); the rest is the
// published table and unmeasured, because nothing else has gone through
// OpenRouter yet.
const SIZES = {
  '2.0': {
    '480p': { '1:1': [480, 480], '3:4': [480, 640], '9:16': [480, 854], '4:3': [640, 480], '16:9': [854, 480], '21:9': [1120, 480] },
    '720p': { '1:1': [720, 720], '3:4': [720, 960], '9:16': [720, 1280], '4:3': [960, 720], '16:9': [1280, 720], '21:9': [1680, 720] },
    '1080p': { '1:1': [1080, 1080], '3:4': [1080, 1440], '9:16': [1080, 1920], '4:3': [1440, 1080], '16:9': [1920, 1080], '21:9': [2520, 1080] },
  },
  '2.5': {
    '480p': { '1:1': [640, 640], '3:4': [560, 752], '9:16': [480, 854], '4:3': [752, 560], '16:9': [854, 480], '21:9': [992, 432] },
    '720p': { '1:1': [960, 960], '3:4': [834, 1112], '9:16': [720, 1280], '4:3': [1112, 834], '16:9': [1280, 720], '21:9': [1470, 630] },
  },
};
// A CLIP IS 24·s + 1 FRAMES (measured; see the table's note).
function framesOf(s) { return 24 * Number(s) + 1; }

// ─── The sale, read from OpenRouter rather than written down ────────────
// `pricing.discount` on a model's endpoints record is the fraction OFF, so the
// price is list × (1 − discount). Cached ten minutes; **a failed read is 0**,
// which is full list — the safe direction — so a sale can never go stale and
// under-quote her. Free: it is OpenRouter's own metadata, not a model call.
const DISC_CACHE_MS = 600000;
let discCache = { at: 0, val: {} };
async function endpointDiscount(orId) {
  const mod = getDoors().openrouter;
  if (!mod || !mod.api || !mod.configured || !mod.configured()) return 0;
  try {
    const j = await mod.api(`/models/${orId}/endpoints`);
    const eps = (j && j.data && j.data.endpoints) || [];
    const d = Number(eps[0] && eps[0].pricing && eps[0].pricing.discount);
    return Number.isFinite(d) && d > 0 && d < 1 ? d : 0;
  } catch { return 0; }
}
async function discounts() {
  if (Date.now() - discCache.at < DISC_CACHE_MS && discCache.at) return discCache.val;
  const out = {};
  await Promise.all(MODELS.filter((m) => m.or).map(async (m) => { out[m.id] = await endpointDiscount(m.or); }));
  discCache = { at: Date.now(), val: out };
  return out;
}
function discountOf(id) { const v = discCache.val[id]; return Number.isFinite(v) ? v : 0; }
// ─── Atlas Cloud's price, read off its own model list ───────────────────
// `GET /models` on Atlas carries `price.actual.base_price` (dollars per
// second, the sale ALREADY applied) and `price.discount` (the percent she
// PAYS — "20" on Mini is the 80%-off sale, measured 2026-09-09: 0.011 against
// an origin of 0.056). Cached ten minutes; a failed read leaves the table's
// LIST rate in place — full price, the safe direction, never a stale sale.
let atlasCache = { at: 0, val: {} };   // model id → { perSec, pays }
async function atlasPrices() {
  if (Date.now() - atlasCache.at < DISC_CACHE_MS && atlasCache.at) return atlasCache.val;
  const mod = getDoors().atlascloud;
  const out = {};
  if (mod && mod.api && mod.configured && mod.configured()) {
    try {
      const j = await mod.api('/models');
      const list = (j && j.data) || [];
      for (const m of MODELS.filter((x) => x.atlas)) {
        const row = list.find((x) => x && x.model === m.atlas);
        const per = Number(row && row.price && row.price.actual && row.price.actual.base_price);
        const pays = Number(row && row.price && row.price.discount);
        if (Number.isFinite(per) && per > 0) out[m.id] = { perSec: per, pays: Number.isFinite(pays) ? pays : null };
      }
    } catch { /* full list */ }
  }
  atlasCache = { at: Date.now(), val: out };
  return out;
}
function atlasPerSecOf(m, res) {
  const v = atlasCache.val[m.id];
  return v && Number.isFinite(v.perSec) ? v.perSec : m.atlasCents[res] / 100;
}
// THE 5% IS PAID AT TOP-UP, NOT PER JOB, so it is NOT in the price this page
// shows (2026-09-09): OpenRouter's balance and its per-job charge are both in
// list dollars, so a price with the fee folded in does not subtract from the
// balance she is looking at. Kept and exported — the "?" card says once that
// credits cost 5% more to buy than they show.
const OR_FEE = 1.05;   // the ~5% top-up fee on bought credit, measured ($2.52 on $50)

function modelOf(id) {
  const s = String(id == null ? '' : id).trim().toLowerCase();
  return MODELS.find((m) => m.id === s) || null;
}
function secondsOk(m, s) {
  s = Number(s);
  if (!Number.isFinite(s)) return false;
  if (m.secs.length === 3 && m.id === '1.5') return m.secs.includes(s);
  return s >= m.secs[0] && s <= m.secs[1] && Number.isInteger(s);
}
function minSeconds(m) { return m.secs[0]; }
function canvasOf(m, res, ratio) {
  const fam = SIZES[m.sizes || m.family] || SIZES['2.0'];
  const byRes = fam[res] || fam['480p'];
  return byRes[ratio] || byRes['1:1'];
}

// Which door a job goes through. Answers { door, fallback } — `fallback` is
// the door tried second when the first refuses for content. Or { error }.
function doorFor({ model, door, hasVideo, resolution }, cfg) {
  const m = typeof model === 'string' ? modelOf(model) : model;
  if (!m) return { error: 'unknown model' };
  cfg = cfg || { openrouter: true, apiframe: true, atlascloud: true };
  const want = String(door || 'auto').toLowerCase();
  const orOk = Boolean(m.or) && cfg.openrouter && m.res.includes(resolution || '480p');
  const afOk = Boolean(m.af) && cfg.apiframe && m.afCents && m.afCents[resolution || '480p'] != null;
  const atOk = Boolean(m.atlas) && cfg.atlascloud && m.atlasCents && m.atlasCents[resolution || '480p'] != null;
  if (want === 'openrouter') return orOk ? { door: 'openrouter', fallback: null } : { error: m.or ? 'OpenRouter is not configured for that' : (m.atlas ? `${m.label} is only on Atlas Cloud` : `${m.label} is only on APIFRAME`) };
  if (want === 'apiframe') return afOk ? { door: 'apiframe', fallback: null } : { error: 'APIFRAME does not offer that' };
  // A PINNED DOOR NEVER FALLS BACK — the page pins Atlas (its only door), and
  // a refusal there is a measurement she reads, not a reason to spend on
  // another door behind her back.
  if (want === 'atlascloud') return atOk ? { door: 'atlascloud', fallback: null } : { error: m.atlas ? 'Atlas Cloud is not configured (ATLASCLOUD_API_KEY)' : `${m.label} is not on Atlas Cloud` };
  // AUTO: ATLAS FIRST (2026-09-09, her "make atlas the default") — it takes
  // a person in a reference and is the cheapest door for one; a content
  // refusal there (a famous face) falls through to APIFRAME. OpenRouter is
  // the door for a model Atlas does not price (2.0 at 1080p), APIFRAME the
  // last resort.
  if (atOk) return { door: 'atlascloud', fallback: afOk ? 'apiframe' : null };
  if (orOk) return { door: 'openrouter', fallback: afOk ? 'apiframe' : null };
  if (afOk) return { door: 'apiframe', fallback: null };
  return { error: 'no door is configured for that' };
}

// WHAT THE TAP COSTS, in list-credit cents. EXACT where it is measured —
// `{ cents, door, exact:true }` — and `{ cents, door, about:true }` where it
// is not, which the page prints as "about". Or `{ error }`.
//
// OpenRouter: tokens = w × h × (24·s + 1) / 1024, × the SKU, × (1 − the live
// discount OpenRouter is passing on today — read, never written down).
// The 5% top-up fee is deliberately NOT folded in (see OR_FEE above).
// A REFERENCE VIDEO IS NOT PINNED — one job only (1:1 480p 4s Mini: 6.48¢
// with, 5.43¢ without, under the sale), i.e. a video reference cost ~19% MORE
// rather than the discount OpenRouter's own SKU advertises. So a job with one
// is estimated at the SAME rate and marked "about" until it is measured; the
// published `orVidTok` figures are gone rather than left lying around wrong.
//
// APIFRAME is cents per second by resolution, and a reference video has its
// own rate (`afVid`): 2.5 at 480p is 15¢/s with one and 13 without — 44 jobs,
// every one exact (4s = 60 or 52, 15s = 225, 30s = 450). Mini at 480p with a
// video is 5¢/s. 720p is unmeasured on every model there, as is Mini with no
// video, so those answer "about". (A FAILED APIFRAME job still shows a
// `creditCost` — 60–450 on the refused 2.5 jobs — and the team total sits
// ~1,100 credits UNDER the sum of them, so some failures are refunded; which
// ones is unmeasured.)
function estimate({ model, resolution, ratio, seconds, hasVideo, door, discount }, cfg) {
  const m = typeof model === 'string' ? modelOf(model) : model;
  if (!m) return { error: 'unknown model' };
  const res = m.res.includes(resolution) ? resolution : m.res[0];
  const s = Number(seconds) || minSeconds(m);
  const d = doorFor({ model: m, door, hasVideo, resolution: res }, cfg);
  if (d.error) return d;
  if (d.door === 'openrouter') {
    const [w, h] = canvasOf(m, res, RATIOS.includes(ratio) ? ratio : '1:1');
    const tokens = (w * h * framesOf(s)) / 1024;
    const off = Number.isFinite(discount) ? discount : discountOf(m.id);
    const usd = tokens * m.orTok[res] * (1 - off);
    return { cents: Math.round(usd * 10000) / 100, door: 'openrouter', ...(hasVideo ? { about: true } : { exact: true }) };
  }
  if (d.door === 'atlascloud') {
    // Atlas bills per second: its live rate (the sale applied) is EXACT for
    // a job with no reference video; the list-rate fallback (the read
    // failed) and a job carrying a reference video (unpinned there, as on
    // OpenRouter) answer "about".
    const live = Boolean(atlasCache.val[m.id] && Number.isFinite(atlasCache.val[m.id].perSec));
    return { cents: Math.round(atlasPerSecOf(m, res) * 100 * s * 100) / 100, door: 'atlascloud', ...(live && !hasVideo ? { exact: true } : { about: true }) };
  }
  const per = (hasVideo && m.afVid && m.afVid[res] != null) ? m.afVid[res] : m.afCents[res];
  const measured = (m.afExact || []).indexOf(res + (hasVideo ? '+video' : '')) >= 0;
  return { cents: Math.round(per * s * 100) / 100, door: 'apiframe', ...(measured ? { exact: true } : { about: true }) };
}

// The slot names her prompt uses, in the order both doors attach them:
// images, then videos, then audio — [Image1] … [Video1] … [Audio1].
function slotsOf(refs) {
  const n = { image: 0, video: 0, audio: 0 };
  return (refs || []).map((r) => {
    const k = kindOf(r);
    n[k] += 1;
    return { ...r, kind: k, slot: `[${k === 'image' ? 'Image' : k === 'video' ? 'Video' : 'Audio'}${n[k]}]` };
  });
}
function kindOf(r) {
  const k = String((r && r.kind) || '').toLowerCase();
  if (k === 'video' || k === 'audio' || k === 'image') return k;
  const u = String((r && r.url) || '').toLowerCase().split('?')[0];
  if (/\.(mp4|mov|webm|m4v)$/.test(u)) return 'video';
  if (/\.(m4a|mp3|wav|aac|ogg)$/.test(u)) return 'audio';
  return 'image';
}

// The body both doors take (the APIFRAME route's field names), from the
// page's own. Answers { body, refs, m, res, ratio, seconds } or { error }.
function buildJob(b) {
  b = b || {};
  const prompt = String(b.prompt == null ? '' : b.prompt);
  if (!prompt.trim()) return { error: 'Say what the clip is first' };
  const m = modelOf(b.model || 'mini');
  if (!m) return { error: `unknown model "${b.model}"` };
  const res = m.res.includes(String(b.resolution)) ? String(b.resolution) : m.res[0];
  const ratio = RATIOS.includes(String(b.ratio)) ? String(b.ratio) : '1:1';
  const seconds = b.seconds == null ? minSeconds(m) : Number(b.seconds);
  if (!secondsOk(m, seconds)) return { error: `${m.label} takes ${m.id === '1.5' ? m.secs.join(', ') : m.secs[0] + '–' + m.secs[1]} seconds` };
  const refs = slotsOf((Array.isArray(b.refs) ? b.refs : []).filter((r) => r && /^https?:\/\//.test(String(r.url || ''))))
    .map((r) => ({ url: String(r.url), kind: r.kind, slot: r.slot, poster: r.poster ? String(r.poster) : '', name: r.name ? String(r.name).slice(0, 80) : '' }));
  const audio = b.sound == null ? (m.audioDefault !== false) : Boolean(b.sound);
  const body = {
    prompt, duration: seconds, resolution: res, aspectRatio: ratio, generateAudio: audio,
    referenceImageUrls: refs.filter((r) => r.kind === 'image').map((r) => r.url),
    referenceVideoUrls: refs.filter((r) => r.kind === 'video').map((r) => r.url),
    referenceAudioUrls: refs.filter((r) => r.kind === 'audio').map((r) => r.url),
    chat: CHAT, title: titleOf(prompt), session: b.session ? String(b.session).slice(0, 80) : undefined,
  };
  // HER OWN SEED, only when she typed one. A blank box sends nothing and the
  // door MINTS one per clip (video-seed.js), which is what the card hands back
  // — so the box being empty means "a fresh one", never "the last one again".
  // An unusable value is DROPPED rather than sent: `seedFor` would replace it
  // at the door anyway, and dropping it here keeps the read-back honest.
  if (videoSeed.okSeed(b.seed)) body.seed = Number(b.seed);
  return { body, refs, m, res, ratio, seconds, audio };
}
function titleOf(prompt) {
  const t = String(prompt || '').replace(/\s+/g, ' ').trim();
  return t.length > 70 ? t.slice(0, 67).replace(/\s+\S*$/, '') + '…' : t;
}

// ─── Doors and balances ─────────────────────────────────────────────────
let doors = null;   // { openrouter, apiframe, atlascloud } — the three modules, handed in or required
function getDoors() {
  if (doors) return doors;
  doors = { openrouter: require('./openrouter'), apiframe: require('./apiframe'), atlascloud: require('./atlascloud') };
  return doors;
}
function init(opts) { if (opts && (opts.openrouter || opts.apiframe || opts.atlascloud)) doors = { ...getDoors(), ...opts }; }
function cfg() {
  const d = getDoors();
  return { openrouter: Boolean(d.openrouter && d.openrouter.configured()), apiframe: Boolean(d.apiframe && d.apiframe.configured()),
    atlascloud: Boolean(d.atlascloud && d.atlascloud.configured()) };
}

let balCache = { at: 0, val: null };
async function balances() {
  if (Date.now() - balCache.at < BAL_CACHE_MS && balCache.val) return balCache.val;
  const c = cfg();
  // Atlas Cloud publishes no balance endpoint here — configured is all it says
  const out = { openrouter: { configured: c.openrouter, left: null }, apiframe: { configured: c.apiframe, credits: null }, atlascloud: { configured: c.atlascloud } };
  const base = process.env.RENDER_EXTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
  const h = STUDIO_TOKEN ? { 'x-studio-token': STUDIO_TOKEN } : {};
  await Promise.all([
    c.openrouter ? fetch(base + '/api/openrouter/credits', { headers: h, agent: proxyAgent || undefined }).then((r) => r.json()).then((j) => { if (j && j.left != null) out.openrouter.left = Number(j.left); }).catch(() => {}) : null,
    c.apiframe ? fetch(base + '/api/apiframe/me', { headers: h, agent: proxyAgent || undefined }).then((r) => r.json()).then((j) => { if (j && j.team && j.team.credits != null) out.apiframe.credits = Number(j.team.credits); }).catch(() => {}) : null,
  ]);
  balCache = { at: Date.now(), val: out };
  return out;
}

// ─── Firestore ──────────────────────────────────────────────────────────
function db() { return admin.firestore(); }
function coll() { return db().collection(videoLog.COLL); }
function bucketOrNull() { try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; } }

// The card the page draws, off the log doc.
function cardOf(id, d) {
  const m = MODELS.find((x) => x.or === d.model || x.af === d.model || x.atlas === d.model) || null;
  const p = d.params || {};
  const st = String(d.status || 'sent').toLowerCase();
  return {
    id, prompt: d.prompt || '', model: m ? m.id : (d.model || ''), modelLabel: m ? m.label : (d.model || ''),
    door: d.door || d.provider || (d.model && String(d.model).startsWith('bytedance/') ? 'openrouter' : 'apiframe'),
    seconds: p.duration != null ? Number(p.duration) : null, resolution: p.resolution || '', ratio: p.aspect_ratio || '',
    sound: p.generate_audio !== false,
    // THE SEED THE CLIP REALLY CARRIED — hers if she typed one, else the one
    // the door minted. Nothing ever hands a seed back from the provider
    // (video-seed.js), so the log's own `params` is the only record there is;
    // a clip drawn before the seed was minted at all has none, honestly.
    seed: p.seed != null && Number.isFinite(Number(p.seed)) ? Number(p.seed) : null,
    refs: Array.isArray(d.refs) ? d.refs : slotsOf([
      ...((d.references && d.references.images) || []).map((url) => ({ url, kind: 'image' })),
      ...((d.references && d.references.videos) || []).map((url) => ({ url, kind: 'video' })),
      ...((d.references && d.references.audio) || []).map((url) => ({ url, kind: 'audio' })),
    ]),
    status: st === 'completed' ? 'done' : (st === 'failed' || st === 'cancelled' || st === 'expired') ? 'failed' : 'drawing',
    video: d.video || '', poster: d.poster || '',
    // to the HUNDREDTH of a cent, like the estimate — the real charge is
    // exact and rounding it to a tenth throws that away (13.96¢, not 14¢)
    cost: d.cost != null ? Math.round(Number(d.cost) * 10000) / 100 : null, estimate: d.estimate != null ? Number(d.estimate) : null,
    sentAt: d.sentAt || '', doneAt: d.doneAt || '', error: d.error || '', note: d.note || '',
    vote: d.vote || '', hidden: Boolean(d.hidden), title: d.title || '',
  };
}

// ─── Polling the unfinished ones, throttled ────────────────────────────
const lastPoll = new Map();   // job id → ms
// `force` is her own Check now tap, which asks past the throttle. It costs a
// status read at the door and never a draw, so a tap always really asks —
// otherwise the button is a control that can do nothing and say nothing.
async function pollOne(id, d, force) {
  const now = Date.now();
  if (!force && now - (lastPoll.get(id) || 0) < POLL_EVERY_MS) return null;
  lastPoll.set(id, now);
  const door = d.door || d.provider || 'apiframe';
  const mod = getDoors()[door] || getDoors().apiframe;
  if (!mod || !mod.pollVideo) return null;
  try {
    const r = await mod.pollVideo(id);
    if (r && r.video && !d.poster) bakePoster(id, r.video).catch(() => {});
    return r;
  } catch (e) { return null; }
}

// A first frame for the card — the clip itself is 1-3MB and a <video> on iOS
// shows nothing until it plays. Best effort, never awaited by a response.
function ffmpegBin() {
  try { return require('ffmpeg-static'); } catch { return null; }
}
async function bakePoster(id, videoUrl) {
  const bin = ffmpegBin();
  const bucket = bucketOrNull();
  if (!bin || !bucket || !/^https?:\/\//.test(String(videoUrl))) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'footage-'));
  const src = path.join(dir, 'clip.mp4');
  const out = path.join(dir, 'poster.jpg');
  try {
    const r = await fetch(videoUrl, { agent: proxyAgent || undefined });
    if (!r.ok) return null;
    fs.writeFileSync(src, await r.buffer());
    await new Promise((resolve, reject) => {
      const p = spawn(bin, ['-y', '-ss', '0.3', '-i', src, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', out], { stdio: 'ignore' });
      p.on('error', reject);
      p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg ' + code))));
    });
    const posterPath = `footage/posters/${String(id).replace(/[^\w.-]/g, '_')}.jpg`;
    const f = bucket.file(posterPath);
    await f.save(fs.readFileSync(out), { metadata: { contentType: 'image/jpeg' } });
    await f.makePublic();
    const poster = `https://storage.googleapis.com/${bucket.name}/${posterPath}`;
    await coll().doc(String(id)).set({ poster }, { merge: true });
    return poster;
  } catch { return null; } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
  }
}

// ─── A reference too small to send: bake an upscaled COPY ──────────────
// Her first /footage job with a video reference was refused before anything
// drew — 400 PixelCountTooSmall — because iOS had shrunk an iPhone clip to
// 480×360 on its way out of Photos through the web file picker. The page
// sends raw bytes and the Dump stores video untouched, so nothing on our
// side did it and nothing on our side could have warned her. This is the
// guard: a reference under ByteDance's floor is sent as an upscaled copy
// (video-floor.js decides the canvas), and the card SAYS so.
//
// Three rules, none of them optional:
//   · HER ORIGINAL IS NEVER TOUCHED. The copy is a new object under
//     footage/upscaled/; the Dump file is left exactly as it is.
//   · IT IS BAKED ONCE, AND PROBED ONCE. The object is content-addressed by
//     the source url and the canvas, so a reference she re-uses on ten clips
//     is encoded once. The DECISION is banked too (`floorDecided`, in memory
//     and as a sidecar beside the copy) — until 2026-09-10 the probe
//     re-downloaded the whole reference on every send to learn a size it had
//     already learned, on the 512MB box, before it even asked whether the
//     copy existed. A later send is one small read, never the clip.
//   · IT IS BEST-EFFORT AND NEVER BLOCKS A SEND. No ffmpeg, no bucket, a
//     probe that will not read, an encode that fails — every one of them
//     answers the ORIGINAL url, so the job goes as it would have gone
//     today (and fails honestly at the door) rather than the guard being
//     the thing that breaks a send.
function ffprobeBin() {
  try { return require('ffprobe-static').path; } catch { return null; }
}
function runBin(bin, args) {
  return new Promise((resolve, reject) => {
    let out = '';
    const p = spawn(bin, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    p.stdout.on('data', (d) => { out += d.toString(); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error('exit ' + code))));
  });
}
// The DISPLAY dimensions, so a phone clip carrying a rotation is measured
// the way the model will see it — a portrait recording is stored landscape
// with a matrix on the track, and reading the coded size alone would call a
// tall clip wide.
// THE SECTION NAME IS THE 4.0 SPELLING (2026-09-10, measured): ffprobe-static
// ships ffprobe 4.0.2, which has no `stream_side_data` section — asking for
// one exits 1 ("No match for section"), the probe answered null, and the
// floor never fired on any clip. `side_data_list` is a stream field there
// (the rotation matrix), and `stream_tags=rotate` is the older tag a phone
// clip carries; both are read.
async function probeSize(file) {
  const bin = ffprobeBin();
  if (!bin) return null;
  try {
    const out = await runBin(bin, ['-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,side_data_list:stream_tags=rotate',
      '-of', 'json', file]);
    const j = JSON.parse(out);
    const st = (j.streams || [])[0];
    if (!st || !st.width || !st.height) return null;
    const sd = (st.side_data_list || []).find((x) => x && x.rotation != null) || {};
    const tag = st.tags && st.tags.rotate;
    const rot = Math.abs(Number(sd.rotation != null ? sd.rotation : tag) || 0) % 180;
    return rot === 90 ? { w: st.height, h: st.width } : { w: st.width, h: st.height };
  } catch { return null; }
}
const FLOOR_FETCH_MS = 20000;
// The decision per source url — `{ plan: null }` (it clears the floor, send
// hers) or `{ plan, url }` (the baked copy). In memory for this process and
// as a sidecar object beside the copy, so a restart re-reads a few bytes
// rather than the clip. A Storage object is immutable, so a decision written
// once is right for as long as the source url is.
const floorDecided = new Map();   // source url → { plan, url }
function floorKeyOf(url) { return crypto.createHash('sha1').update(String(url)).digest('hex'); }
async function readFloorSidecar(bucket, url) {
  try {
    const f = bucket.file(`footage/upscaled/${floorKeyOf(url)}.json`);
    const [exists] = await f.exists();
    if (!exists) return null;
    const [buf] = await f.download();
    const d = JSON.parse(buf.toString('utf8'));
    return d && typeof d === 'object' && 'plan' in d ? d : null;
  } catch { return null; }
}
async function writeFloorSidecar(bucket, url, decision) {
  try {
    await bucket.file(`footage/upscaled/${floorKeyOf(url)}.json`).save(JSON.stringify(decision), { metadata: { contentType: 'application/json' } });
  } catch { /* best effort — the next send probes again */ }
}
async function ensureVideoFloor(url, name) {
  const bin = ffmpegBin();
  const bucket = bucketOrNull();
  if (!bin || !bucket || !/^https?:\/\//.test(String(url))) return { url, note: '' };
  const said = (d) => (d && d.plan ? { url: d.url, note: videoFloor.upscaleNote(d.plan, name) } : { url, note: '' });
  if (floorDecided.has(url)) return said(floorDecided.get(url));
  const banked = await readFloorSidecar(bucket, url);
  if (banked) { floorDecided.set(url, banked); return said(banked); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'floor-'));
  const src = path.join(dir, 'in');
  const out = path.join(dir, 'out.mp4');
  try {
    // best-effort means BOUNDED too: a reference that will not download in
    // FLOOR_FETCH_MS goes as her original, and the send is not held for it
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), FLOOR_FETCH_MS);
    let r;
    try { r = await fetch(url, { agent: proxyAgent || undefined, signal: ctl.signal }); }
    finally { clearTimeout(timer); }
    if (!r.ok) return { url, note: '' };
    fs.writeFileSync(src, await r.buffer());
    const size = await probeSize(src);
    if (!size) return { url, note: '' };          // a probe that will not read decides nothing
    const plan = videoFloor.planUpscale(size.w, size.h);
    if (!plan) {                                  // clears the floor — send hers, and remember that
      floorDecided.set(url, { plan: null });
      writeFloorSidecar(bucket, url, { plan: null, w: size.w, h: size.h });
      return { url, note: '' };
    }
    const key = crypto.createHash('sha1').update(`${url}|${plan.w}x${plan.h}`).digest('hex');
    const objectPath = `footage/upscaled/${key}.mp4`;
    const f = bucket.file(objectPath);
    const done = `https://storage.googleapis.com/${bucket.name}/${objectPath}`;
    const [exists] = await f.exists();
    if (!exists) {
      await runBin(bin, ['-y', '-i', src,
        '-vf', `scale=${plan.w}:${plan.h}:flags=lanczos`,
        '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
        '-c:a', 'copy', '-movflags', '+faststart', out]);
      await f.save(fs.readFileSync(out), { metadata: { contentType: 'video/mp4' } });
      await f.makePublic();
    }
    const decision = { plan, url: done, w: size.w, h: size.h };
    floorDecided.set(url, decision);
    writeFloorSidecar(bucket, url, decision);
    return said(decision);
  } catch { return { url, note: '' }; } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
  }
}
// Every reference video in the body, walked once. Answers the urls to SEND
// and the notes to say; `refs` (what the card shows) keeps her originals, so
// the thumb she recognises is the thumb she sees.
async function floorRefs(body) {
  const list = body.referenceVideoUrls || [];
  if (!list.length) return { urls: list, notes: [] };
  const notes = [];
  const urls = [];
  for (const u of list) {
    const r = await ensureVideoFloor(u, (body.__names || {})[u]);
    urls.push(r.url);
    if (r.note) notes.push(r.note);
  }
  return { urls, notes };
}

// ─── Starting a job: the door, the fallback, the log ───────────────────
// Answers { jobId, door, sent, fellBack } or throws with status/hint.
async function startJob(b) {
  await discounts().catch(() => {});
  await atlasPrices().catch(() => {});
  const built = buildJob(b);
  if (built.error) { const e = new Error(built.error); e.status = 400; throw e; }
  const { body, refs, m, res, ratio, seconds } = built;
  const hasVideo = refs.some((r) => r.kind === 'video');
  const d = doorFor({ model: m, door: b.door, hasVideo, resolution: res }, cfg());
  if (d.error) { const e = new Error(d.error); e.status = 400; throw e; }
  // A reference under ByteDance's pixel floor is refused before anything
  // draws, so swap in an upscaled copy BEFORE the door sees the body — and
  // keep `refs` (the card) pointing at her originals.
  body.__names = Object.fromEntries(refs.filter((r) => r.kind === 'video').map((r) => [r.url, r.name]));
  const floored = await floorRefs(body);
  delete body.__names;
  body.referenceVideoUrls = floored.urls;
  const est = estimate({ model: m, resolution: res, ratio, seconds, hasVideo, door: d.door }, cfg());
  const extra = { door: d.door, refs, estimate: est.cents != null ? est.cents : null, footage: true, aspect: ratio };
  if (floored.notes.length) extra.note = floored.notes.join(' ');
  const mods = getDoors();
  const send = async (door, note) => {
    const mod = mods[door];
    const req = { ...body, model: door === 'openrouter' ? m.or : door === 'atlascloud' ? m.atlas : m.af };
    const say = [extra.note, note].filter(Boolean).join(' ');
    if (say) req.note = say;
    const r = await mod.startVideo(req, { ...extra, door, ...(say ? { note: say } : {}) });
    // the seed the door really used — hers, or the one it minted — so the card
    // this tap draws carries it without waiting for the first poll
    const seed = r.params && r.params.seed != null ? Number(r.params.seed) : null;
    return { jobId: r.jobId, door, sent: r.sent || req, seed: Number.isFinite(seed) ? seed : null };
  };
  try {
    const r = await send(d.door);
    return { ...r, fellBack: false, estimate: est.cents, note: extra.note || '' };
  } catch (e) {
    if (e.refusal === 'content' && d.fallback === 'apiframe') {
      const est2 = estimate({ model: m, resolution: res, ratio, seconds, hasVideo, door: 'apiframe' }, cfg());
      extra.estimate = est2.cents != null ? est2.cents : null;
      const note = d.door === 'atlascloud'
        ? 'Atlas Cloud refused a reference (a famous face) — sent through APIFRAME instead'
        : 'OpenRouter refused a reference (a person in it) — sent through APIFRAME instead';
      const r = await send('apiframe', note);
      return { ...r, fellBack: true, estimate: est2.cents, note: [extra.note, note].filter(Boolean).join(' ') };
    }
    throw e;
  }
}

// ─── Router ─────────────────────────────────────────────────────────────
const router = express.Router();
router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN || req.query.token === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});
router.use(express.json({ limit: '2mb' }));

// The model table the page draws its controls and its prices from.
function publicModels() {
  return MODELS.map((m) => ({ id: m.id, label: m.label, openrouter: Boolean(m.or), apiframe: Boolean(m.af), atlascloud: Boolean(m.atlas),
    ...(m.atlas && atlasCache.val[m.id] ? { atlasPerSec: atlasCache.val[m.id].perSec, atlasPays: atlasCache.val[m.id].pays } : {}),
    res: m.res, secs: m.secs, family: m.family, sizes: m.sizes || m.family, orTok: m.orTok || null, discount: m.or ? discountOf(m.id) : 0,
    afCents: m.afCents || null, afVid: m.afVid || null, audioDefault: m.audioDefault !== false }));
}
router.get('/status', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const bal = await balances().catch(() => null);
  await discounts().catch(() => {});
  await atlasPrices().catch(() => {});
  res.json({ ok: true, chat: CHAT, doors: cfg(), balances: bal, models: publicModels(), ratios: RATIOS, sizes: SIZES, fee: OR_FEE });
});

// GET /estimate?model=&res=&ratio=&seconds=&video=1&door= — the price of the
// tap as the controls stand, with `exact` or `about` saying whether it is
// pinned. Free; the page asks on every change so it holds no copy of a price,
// and the live discount is refreshed (cached ten minutes) before it answers.
router.get('/estimate', async (req, res) => {
  await discounts().catch(() => {});
  await atlasPrices().catch(() => {});
  const q = req.query || {};
  const e = estimate({ model: q.model, resolution: q.res, ratio: q.ratio, seconds: q.seconds,
    hasVideo: q.video === '1', door: q.door }, cfg());
  res.set('Cache-Control', 'no-store');
  if (e.error) return res.status(400).json({ error: e.error });
  res.json({ ok: true, ...e });
});

router.post('/jobs', async (req, res) => {
  try {
    const r = await startJob(req.body || {});
    balCache.at = 0;
    res.status(202).json({ ok: true, ...r });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, refusal: e.refusal, hint: e.hint });
  }
});

router.get('/jobs', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 40, 200);
    const fresh = String(req.query.fresh || '') === '1';
    const snap = await coll().where('chat', '==', CHAT).get();
    const docs = snap.docs.map((d) => ({ id: d.id, d: d.data() }))
      .sort((a, b) => String(b.d.sentAt || '').localeCompare(String(a.d.sentAt || '')))
      .slice(0, limit);
    // ask the doors about the ones still drawing — throttled per job, so a
    // page polling every few seconds is one provider read per job per 12s
    await Promise.all(docs.map(async (x) => {
      const st = String(x.d.status || 'sent').toLowerCase();
      if (st !== 'sent' && st !== 'processing' && st !== 'pending' && st !== 'queued' && st !== 'starting') return;
      const r = await pollOne(x.id, x.d, fresh);
      if (r && r.patch) Object.assign(x.d, r.patch, r.video ? { video: r.video } : {});
    }));
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, jobs: docs.map((x) => cardOf(x.id, x.d)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/jobs/:id/vote', async (req, res) => {
  try {
    const v = String((req.body && req.body.vote) || '');
    const vote = v === 'like' || v === 'dislike' ? v : '';
    await coll().doc(String(req.params.id)).set({ vote }, { merge: true });
    res.json({ ok: true, vote });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/jobs/:id/hide', async (req, res) => {
  try {
    const hidden = Boolean(req.body && req.body.hidden);
    await coll().doc(String(req.params.id)).set({ hidden }, { merge: true });
    res.json({ ok: true, hidden });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = {
  router, init,
  MODELS, RATIOS, SIZES, CHAT, OR_FEE,
  modelOf, doorFor, estimate, slotsOf, kindOf, buildJob, titleOf, cardOf, publicModels, canvasOf, secondsOk, framesOf,
  discounts, discountOf, endpointDiscount, atlasPrices, atlasPerSecOf,
  startJob, bakePoster, ensureVideoFloor, floorDecided,
};
