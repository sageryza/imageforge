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
// video rides. ATLAS is per second too, but publishes ONE flat rate and hides
// the resolution dimension its own docs describe — so its rate is read as a
// 480p rate and scaled by the canvas (`resFactor`). Those two halves are
// MEASURED off real charges — see the model table's own note, which carries
// the job counts and the dates; NOTHING on Atlas is, so every Atlas figure
// answers `about`. An estimate answers `exact:true` where it is pinned and
// `about:true` where it is not, and the page prefixes "~" to the second
// (2026-09-10, Sophie: "add ~ to both" — the compact form of the word she
// cut the day before). The REAL cost lands on the
// card when the job finishes (OpenRouter reports it; APIFRAME does not, so an
// APIFRAME card keeps the estimate, marked as one).
//
// Routes (mounted at /api/footage by server.js; STUDIO_TOKEN-gated):
//   GET  /status             doors + balances (60s cache) + the model table
//   POST /jobs               start one clip — the star's tap
//   GET  /jobs?limit=        her clips, newest first; polls the unfinished ones
//   POST /jobs/:id/vote      { vote: 'like'|'dislike'|'' }
//   POST /jobs/:id/hide      { hidden: true|false }
//   POST /jobs/:id/trim      { start, end } | { clear: true } — keep a span
//                            of a finished clip, or undo it. Free.
//   POST /jobs/:id/frame     { at } — ONE frame out of a finished clip, at
//                            its own size, as a public url for the
//                            references strip. Free.
// Test: node scripts/test-footage.js · node scripts/test-footage-trim.js

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
const videoRefusals = require('./video-refusals');
// THE SEARCH — the house grammar over what a clip's card says (footage-hay.js
// is served to the page too, so the client filter reads the same words)
const grammar = require('./search-grammar');
const { hayOf } = require('./footage-hay');
const clipDiff = require('./clip-diff');

const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const CHAT = 'footage';

// A CLIP BELONGS TO A PROJECT (2026-09-11, Sophie: "group projects and
// character references so when I switch between projects, I can only see
// those references offered to me and only related files in the tiles list
// view area"). The project vocabulary is the cast library's FILMS — one
// word, the same slug shape `cast.js` keys a shelf by — and it rides every
// job doc as `project`, so the feed, the drawer and the character sheet all
// narrow on one field. Absent means "no project", which is what every clip
// drawn before this carries and what a page cached from before still sends.
// Plan: docs/footage-projects-plan.md.
function projectSlug(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
// A SUB-FOLDER INSIDE A PROJECT (2026-09-11, Sophie: "can we do sub folders
// ex the witch commercials"). One more field on the job doc, `folder`, the
// same slug shape, meaningful only beside a `project` — a folder is a shelf
// INSIDE a film, never a second vocabulary: the folders a project has are
// DERIVED from the clips filed in it (`foldersOf`, answered on every /jobs
// read), so there is nothing to keep in step and an emptied folder simply
// stops being offered. Moving a clip to another project takes it out of its
// folder, since the folder belonged to the project it left.
const folderSlug = projectSlug;
function foldersOf(rows) {
  const out = {};
  rows.forEach((x) => {
    const p = projectSlug(x.d.project), f = folderSlug(x.d.folder);
    if (!p || !f) return;
    (out[p] = out[p] || new Set()).add(f);
  });
  return Object.fromEntries(Object.entries(out).map(([p, s]) => [p, Array.from(s).sort()]));
}
// A BELT HAND-OFF NAMES ITS CHAT, and the chat says which film it belongs to.
// scene-index.js already writes `from: belt.chat` into `footage_handoff`; the
// page maps it through this table (served on /status) and switches the
// picker, so a scene sent from a ward belt lands on the ward with no tap. A
// belt that declares `var PROJECT='…'` beside its CHAT names the project
// itself and skips the table. A chat not listed leaves the picker alone.
const HANDOFF_PROJECTS = {
  'soap-pill-scene': 'ward',
  'hospital-severance-rough-cut': 'ward',
  'hospital-night-film': 'ward',
  'climax-dissociation-accounts': 'ward',
  'severance-api-multiple-frames': 'ward',
  'ward-film-page-duplicate': 'ward',
  'ticky-tack-film-page-dupe': 'ticky-tack',
};
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
  // OpenRouter's discount is. BOTH ARE 480p RATES: Atlas publishes one flat
  // figure per model while billing by resolution (see `estimate`), so the
  // rate is scaled by the canvas rather than looked up per rung — which is
  // why `atlasCents` carries the same number on 480p and 720p. It shipped for one afternoon as its own
  // "2.0 Mini · Atlas" row beside the OpenRouter one; her ask the same
  // evening folded the door into the rows. MEASURED (2026-09-09): a PERSON
  // video and a real untouched photo both pass and draw; only a famous face
  // is refused (free, on the POST, as copyright). 1080p on 2.0 is unpriced
  // on Atlas and stays null.
  { id: 'mini', label: '2.0 Mini', or: 'bytedance/seedance-2.0-mini', af: 'seedance-2-mini',
    atlas: 'bytedance/seedance-2.0-mini/reference-to-video',
    res: ['480p', '720p'], secs: [4, 15], family: '2.0', sizes: '2.5', canvasMeasured: true,
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
  // A FAILED OR EMPTY READ KEEPS THE LAST GOOD PRICES, and since 2026-09-11
  // that matters for more than the figure on screen: the door is chosen by
  // price now, so falling back to the table's LIST rate would quietly send
  // every Mini job to OpenRouter at 3x the real Atlas price (13.59¢ against
  // 4.40¢ on a 4s 480p 16:9 clip) for the ten minutes the cache holds. The
  // list rate is still the floor when nothing has ever been read.
  atlasCache = { at: Date.now(), val: Object.keys(out).length ? out : atlasCache.val };
  return atlasCache.val;
}
// For a test that needs a second live read inside the cache window — nothing
// in the app calls it; the ten-minute cache is the point everywhere else.
function atlasCacheBust() { atlasCache = { at: 0, val: atlasCache.val }; }
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
// How much dearer a resolution is than 480p ON THIS SHAPE — the pixel ratio
// of the two canvases, which IS the token ratio (tokens = w*h*(24s+1)/1024,
// proven to the token against the log). Used to scale Atlas's flat
// per-second rate, which is a 480p rate. 1:1 at 480p vs 720p on the 2.5
// table is 640x640 -> 960x960 = 2.25x; 16:9 is 854x480 -> 1280x720 = 2.248x.
function resFactor(m, res, ratio) {
  const r = RATIOS.includes(ratio) ? ratio : '1:1';
  const [w, h] = canvasOf(m, res, r);
  const [w0, h0] = canvasOf(m, '480p', r);
  const base = w0 * h0;
  return base > 0 ? (w * h) / base : 1;
}

// HOW LOOSE EACH DOOR'S CONTENT FILTER IS, measured (see the ward-film notes
// in CLAUDE.md): OpenRouter forwards to ByteDance directly and refuses ANY
// person in a reference; Atlas takes a person and a real untouched photo and
// refuses only a FAMOUS face; APIFRAME took every reference the ward film had
// on Mini — AND REFUSED A REAL FACE IN A PICTURE ON 2.5, TWICE, ON
// 2026-09-11, ~10s after ACCEPTING the job, while Atlas drew the same three
// pictures. So this is a PREFERENCE for the order of the walk, never a reason
// to skip a door: a table like this is per model and probabilistic, and the
// day it is wrong the skipped door was the one that would have drawn.
const DOOR_LOOSENESS = { openrouter: 0, atlascloud: 1, apiframe: 2 };
// WHERE A DOOR'S CONTENT REFUSAL LANDS. OpenRouter and Atlas refuse on the
// POST — free, before anything draws, measured on both. APIFRAME accepts the
// POST and the refusal comes back on the POLL (2026-09-11: both 2.5 jobs
// `FAILED` ten seconds in), and whether that bills is UNMEASURED (its failed
// 2.5 jobs have shown a creditCost, and some failures are refunded). So a
// door whose refusal is free comes BEFORE one whose refusal may cost her the
// clip's price, whatever the price order says.
const DOOR_REFUSAL_FREE = { openrouter: true, atlascloud: true, apiframe: false };
const DOOR_WORDS = { openrouter: 'OpenRouter', atlascloud: 'Atlas Cloud', apiframe: 'APIFRAME' };
// What each door's refusal really means, in her terms — the card says it.
const REFUSED_WHY = { openrouter: 'a person in it', atlascloud: 'a famous face', apiframe: 'a real face in a picture' };

// Which door a job goes through. Answers { door, fallback:null, chain:[] ,
// ranked } — or { error }. `fallback` and `chain` are kept on the answer for
// any older reader and are ALWAYS empty now:
//
// A REFUSED JOB FAILS — IT IS NEVER SENT AGAIN THROUGH ANOTHER DOOR
// (2026-09-11, Sophie, looking at three APIFRAME clips drawn without their
// references: "if a job refuses references it should just fail … it should
// never be sent without references ever ever ever" · "when I send a job
// through a chat, it just says that it was refused if the references didn't
// go through — why can't the same thing happen through footage?"). For one
// day this function answered a CHAIN and `startJob` walked it: OpenRouter
// refuses a real person on the POST, the job was re-sent through the next
// door on its own, and on the poll a refusal walked on again. That walk is
// what put every one of the day's six APIFRAME jobs there — and on 2.0
// APIFRAME does not refuse a real face, it SILENTLY DROPS EVERY REFERENCE,
// draws a stranger, reports COMPLETED and bills (~32¢ each; measured on all
// three, the identical references drew exactly on Atlas). So a clip she
// never asked for, of a person she never picked, wearing a note that read
// like a success. Now footage does what a chat does: ONE door, one send, and
// a refusal is the answer on the card ("a person in it — refused, nothing
// drawn or charged"); which door to try next is hers. The `walk` on the log
// doc, `walkPlan`/`walkOn` and `opts.avoid`/`opts.after` are gone with it.
//
// AUTO IS CHEAPEST-FIRST SINCE 2026-09-11 (Sophie, adding 2.0 and 2.5 to the
// page: "are they cheapest through router, atlas or frame? choose cheapest").
// That supersedes the 2026-09-09 "make atlas the default" for the ORDER —
// Atlas is still the cheapest door for Mini and Fast, by a lot, and simply
// wins the ranking there. It is NOT the cheapest for 2.0 or 2.5: measured
// live 2026-09-11 on a 4s 480p 16:9 clip, Mini is 4.4¢ Atlas · 13.6¢
// OpenRouter · 16¢ APIFRAME and Fast 10.8¢ · 16.3¢ · 28¢, where 2.0 is
// 27.2¢ OPENROUTER · 32¢ APIFRAME · 36¢ Atlas and 2.5 is 41.6¢ · 52¢ ·
// 53.6¢ — because Atlas's 80%/70% sale is on the two small models and only
// 20% on the two big ones. A refusal on OpenRouter and on Atlas is FREE and
// comes back before anything draws.
// `avoid` takes doors off the table (a chat re-sending by hand after a
// refusal); nothing in this module passes it any more.
// WHICH DOORS CAN TAKE A KEYFRAME JOB AT ALL (2026-09-11, the first-frame
// pass). This is a SHAPE question, not a price one, and it has to be asked
// before the ranking or auto would send a job to a door that must refuse it:
//   · APIFRAME wires `start_image` / `end_image` BESIDE the reference lists,
//     so it is the one door that takes both. (Whether ByteDance honours both
//     together is unmeasured — it is sent exactly as it always was.)
//   · Atlas Cloud's keyframes live on a DIFFERENT model id
//     (`…/image-to-video`), which has no reference lists in its schema, and
//     its `image` is required — so it takes a first frame alone, never a
//     first frame beside references, and never a last frame on its own.
//   · OpenRouter takes `frame_images` alone: with `input_references` beside
//     them its own guide says frame_images WINS and the references are
//     dropped, so that job is refused at the door rather than half-sent.
// A job with neither keyframe is every door's, exactly as before.
function doorTakes(door, { hasFirstFrame, hasLastFrame, hasRefs }) {
  if (!hasFirstFrame && !hasLastFrame) return true;
  if (door === 'apiframe') return true;
  if (hasRefs) return false;
  if (door === 'atlascloud') return Boolean(hasFirstFrame);
  return true;
}
// The line she reads when a keyframe leaves no door open — plain, and it
// names what to change rather than what is wrong.
function shapeRefusal({ hasFirstFrame, hasLastFrame, hasRefs }) {
  if (hasRefs && (hasFirstFrame || hasLastFrame)) {
    return 'A first frame and references cannot ride one job — only APIFRAME takes both, and it is not open for that. Take the references off, or take the first frame off.';
  }
  if (hasLastFrame && !hasFirstFrame) return 'A last frame needs a first frame beside it on the doors that are open — mark the frame the clip starts on.';
  return 'no door is configured for that';
}

function doorFor({ model, door, hasVideo, resolution, ratio, seconds, avoid, hasFirstFrame, hasLastFrame, hasRefs }, cfg) {
  const m = typeof model === 'string' ? modelOf(model) : model;
  if (!m) return { error: 'unknown model' };
  cfg = cfg || { openrouter: true, apiframe: true, atlascloud: true };
  const want = String(door || 'auto').toLowerCase();
  const res = m.res.includes(resolution) ? resolution : (resolution || '480p');
  const shape = { hasFirstFrame: Boolean(hasFirstFrame), hasLastFrame: Boolean(hasLastFrame), hasRefs: Boolean(hasRefs) };
  const orOk = Boolean(m.or) && cfg.openrouter && m.res.includes(res) && doorTakes('openrouter', shape);
  const afOk = Boolean(m.af) && cfg.apiframe && m.afCents && m.afCents[res] != null && doorTakes('apiframe', shape);
  const atOk = Boolean(m.atlas) && cfg.atlascloud && m.atlasCents && m.atlasCents[res] != null && doorTakes('atlascloud', shape);
  // A PINNED DOOR THAT CANNOT TAKE THE SHAPE SAYS SO IN THOSE TERMS — "it
  // does not offer that resolution" would be a wrong reason she then chases.
  const pinShape = (d) => (doorTakes(d, shape) ? null : { error: shapeRefusal(shape) });
  if (want === 'openrouter') return pinShape('openrouter') || (orOk ? { door: 'openrouter', fallback: null, chain: [] } : { error: m.or ? 'OpenRouter is not configured for that' : (m.atlas ? `${m.label} is only on Atlas Cloud` : `${m.label} is only on APIFRAME`) });
  if (want === 'apiframe') return pinShape('apiframe') || (afOk ? { door: 'apiframe', fallback: null, chain: [] } : { error: 'APIFRAME does not offer that' });
  // A PINNED DOOR NEVER FALLS BACK — a refusal on a door she named is a
  // measurement she reads, not a reason to spend on another door behind her
  // back. Only AUTO ranks and walks.
  if (want === 'atlascloud') return pinShape('atlascloud') || (atOk ? { door: 'atlascloud', fallback: null, chain: [] } : { error: m.atlas ? 'Atlas Cloud is not configured (ATLASCLOUD_API_KEY)' : `${m.label} is not on Atlas Cloud` });
  const skip = new Set(Array.isArray(avoid) ? avoid.map(String) : []);
  const open = [orOk && 'openrouter', atOk && 'atlascloud', afOk && 'apiframe'].filter(Boolean).filter((d) => !skip.has(d));
  if (!open.length) {
    if (skip.size) return { error: 'every door has refused it' };
    return { error: (shape.hasFirstFrame || shape.hasLastFrame) ? shapeRefusal(shape) : 'no door is configured for that' };
  }
  // Ranked by what the tap really costs on each, cheapest first. A door whose
  // price cannot be worked out sorts LAST rather than winning by default.
  const priced = open.map((d) => {
    const p = priceOn(m, d, { res, ratio, seconds, hasVideo });
    return { door: d, cents: Number.isFinite(p && p.cents) ? p.cents : Infinity };
  }).sort((a, b) => a.cents - b.cents);
  const pick = priced[0].door;
  return { door: pick, fallback: null, chain: [], ranked: priced };
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
function estimate({ model, resolution, ratio, seconds, hasVideo, door, discount, hasFirstFrame, hasLastFrame, hasRefs }, cfg) {
  const m = typeof model === 'string' ? modelOf(model) : model;
  if (!m) return { error: 'unknown model' };
  const res = m.res.includes(resolution) ? resolution : m.res[0];
  const s = Number(seconds) || minSeconds(m);
  // THE SHAPE RIDES INTO THE RANKING — a keyframe narrows which doors can
  // take the job at all, and the price she reads has to be the price on the
  // door the tap will really go to. A keyframe costs nothing extra on any
  // door (Atlas prices image-to-video the same per second as
  // reference-to-video), so only the DOOR moves, never the rate.
  const d = doorFor({ model: m, door, hasVideo, resolution: res, ratio, seconds: s, hasFirstFrame, hasLastFrame, hasRefs }, cfg);
  if (d.error) return d;
  const p = priceOn(m, d.door, { res, ratio, seconds: s, hasVideo, discount });
  return p.error ? p : { ...p, door: d.door };
}

// The price ON ONE NAMED DOOR — no door choice in it, which is what lets
// `doorFor` rank with it without the two calling each other forever.
function priceOn(m, door, { res: resIn, ratio, seconds, hasVideo, discount }) {
  const res = m.res.includes(resIn) ? resIn : m.res[0];
  const s = Number(seconds) || minSeconds(m);
  if (door === 'openrouter') {
    if (!m.orTok || m.orTok[res] == null) return { error: 'OpenRouter does not price that' };
    const [w, h] = canvasOf(m, res, RATIOS.includes(ratio) ? ratio : '1:1');
    const tokens = (w * h * framesOf(s)) / 1024;
    const off = Number.isFinite(discount) ? discount : discountOf(m.id);
    const usd = tokens * m.orTok[res] * (1 - off);
    // EXACT NEEDS THE CANVAS MEASURED, not only the formula. The token count
    // is w × h × frames, so the price is only as pinned as the canvas — and
    // the published table has been WRONG once already: Mini turned out to
    // render on the 2.5 canvases rather than its own family's (ffprobe, every
    // clip). 2.0, Fast and 2.5 have never gone through OpenRouter, so their
    // canvases are the published table and unverified, and their price
    // answers "about" until a real charge is read against one.
    const pinned = m.canvasMeasured && !hasVideo;
    return { cents: Math.round(usd * 10000) / 100, door: 'openrouter', ...(pinned ? { exact: true } : { about: true }) };
  }
  if (door === 'atlascloud') {
    // Atlas's per-second rate is a 480p rate, and RESOLUTION IS A BILLING
    // DIMENSION IT DOES NOT EXPOSE (2026-09-10). Its `GET /models` publishes
    // ONE flat `base_price` per model, which is why this branch used to
    // quote 720p at the 480p price, marked exact — measured wrong three
    // ways: Atlas's own model readme says "final billing follows the active
    // model pricing configuration for the selected RESOLUTION, duration,
    // account, and environment"; the one 720p job on file (12s Mini 3:4, one
    // reference video) spent 435,628 tokens against 197,811 for the
    // identical 480p job, i.e. 2.20x; and APIFRAME, which DOES publish per
    // resolution, prices its own 720p at the pixel ratio on every row (Mini
    // 4 -> 9c/s, Fast 7 -> 16, 2.0 8 -> 18, 2.5 13 -> 29).
    // So the rate is scaled by the canvas (`resFactor`), per shape, because
    // that is what the token count is made of.
    // AND NOTHING HERE IS PINNED — not 480p either (2026-09-10, Sophie: "add
    // ~ to both"). Atlas has no billing API; her console is the only read,
    // so every Atlas figure answers `about`. HER WORD STANDS AND THE `~` DOES
    // NOT COME OFF — but the estimate has now been READ AGAINST REAL CHARGES
    // (2026-09-11, she exported her Atlas cost history: 117 charges over 40
    // hours, joined to `forge-video-jobs` by time, 106 of them paid). It
    // lands within a few percent on every shape with enough jobs to trust:
    // Mini 12s 480p 3:4 real/estimated 1.008 (n=7), Mini 15s 480p 16:9 1.025
    // (n=12), Fast 15s 480p 3:4 0.992 (n=6), 2.5 at 15s and 30s 1.02 each.
    // THE PIXEL SCALING IS THE HALF WORTH PINNING IN PROSE: Mini 3:4 billed
    // 1.11c/s at 480p and 2.44c/s at 720p (8s and 12s clips agreeing), a
    // factor of 2.198 against a canvas ratio of 927,408/421,120 = 2.202 — so
    // `resFactor` is right to 0.2% and the 2026-09-10 reasoning above was
    // correct. A REFUSAL IS FREE, confirmed again: 10 of the 117 rows are
    // $0.00. The few shapes that read 1.4-2.3x are single jobs whose charge
    // could not be matched to the right job — Atlas stamps no job id on a
    // charge, so a burst inside one minute cannot be joined exactly.
    if (!m.atlasCents || m.atlasCents[res] == null) return { error: 'Atlas Cloud does not price that' };
    const cents = atlasPerSecOf(m, res) * 100 * s * resFactor(m, res, ratio);
    return { cents: Math.round(cents * 100) / 100, door: 'atlascloud', about: true };
  }
  if (!m.afCents || m.afCents[res] == null) return { error: 'APIFRAME does not price that' };
  const per = (hasVideo && m.afVid && m.afVid[res] != null) ? m.afVid[res] : m.afCents[res];
  const measured = (m.afExact || []).indexOf(res + (hasVideo ? '+video' : '')) >= 0;
  return { cents: Math.round(per * s * 100) / 100, door: 'apiframe', ...(measured ? { exact: true } : { about: true }) };
}

// The slot names her prompt uses, in the order both doors attach them:
// images, then videos, then audio — [Image1] … [Video1] … [Audio1].
//
// A KEYFRAME IS NOT A SLOT (2026-09-11). A picture she marked as the first or
// last frame does not ride the reference lists at all — it is the frame the
// clip starts or ends on — so it takes NO slot and the pictures after it
// count as if it were not there. Its `role` is what the card draws in place
// of a slot name; the page renumbers her prompt the same way the ✕ does.
function slotsOf(refs) {
  const n = { image: 0, video: 0, audio: 0 };
  return (refs || []).map((r) => {
    const k = kindOf(r);
    const role = r && (r.role === 'first' || r.role === 'last') ? r.role : '';
    if (role) return { ...r, kind: k, role, slot: '' };
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
  // THE TWO KEYFRAMES — one url each, and a url that is not in the strip is
  // still honoured (a chat sending a frame straight through). A picture
  // marked as a keyframe carries a `role` and leaves the reference lists: it
  // is the frame the clip starts or ends on, not something the prompt names.
  const kfFirst = b.firstFrameUrl && /^https?:\/\//.test(String(b.firstFrameUrl)) ? String(b.firstFrameUrl) : '';
  const kfLast = b.lastFrameUrl && /^https?:\/\//.test(String(b.lastFrameUrl)) ? String(b.lastFrameUrl) : '';
  if (kfFirst && kfLast && kfFirst === kfLast) return { error: 'one picture cannot be both the first frame and the last' };
  const roleOf = (u) => (u === kfFirst ? 'first' : u === kfLast ? 'last' : '');
  const refs = slotsOf((Array.isArray(b.refs) ? b.refs : []).filter((r) => r && /^https?:\/\//.test(String(r.url || '')))
    .map((r) => ({ ...r, role: roleOf(String(r.url)) })))
    .map((r) => ({ url: String(r.url), kind: r.kind, slot: r.slot, poster: r.poster ? String(r.poster) : '', name: r.name ? String(r.name).slice(0, 80) : '',
      ...(r.role ? { role: r.role } : {}) }));
  const audio = b.sound == null ? (m.audioDefault !== false) : Boolean(b.sound);
  const plain = refs.filter((r) => !r.role);
  const body = {
    prompt, duration: seconds, resolution: res, aspectRatio: ratio, generateAudio: audio,
    referenceImageUrls: plain.filter((r) => r.kind === 'image').map((r) => r.url),
    referenceVideoUrls: plain.filter((r) => r.kind === 'video').map((r) => r.url),
    referenceAudioUrls: plain.filter((r) => r.kind === 'audio').map((r) => r.url),
    chat: CHAT, title: titleOf(prompt), session: b.session ? String(b.session).slice(0, 80) : undefined,
  };
  if (kfFirst) body.firstFrameUrl = kfFirst;
  if (kfLast) body.lastFrameUrl = kfLast;
  // HER OWN SEED, only when she typed one. A blank box sends nothing and the
  // door MINTS one per clip (video-seed.js), which is what the card hands back
  // — so the box being empty means "a fresh one", never "the last one again".
  // An unusable value is DROPPED rather than sent: `seedFor` would replace it
  // at the door anyway, and dropping it here keeps the read-back honest.
  if (videoSeed.okSeed(b.seed)) body.seed = Number(b.seed);
  // the project rides the body so every door files it on the log doc
  const project = projectSlug(b.project);
  if (project) body.project = project;
  // and the sub-folder, only ever inside a project
  const folder = project ? folderSlug(b.folder) : '';
  if (folder) body.folder = folder;
  return { body, refs, m, res, ratio, seconds, audio, first: kfFirst, last: kfLast };
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

// ONE reader of a doc's status — cardOf draws by it and trimPlan refuses by
// it, and two copies of that expression would let the card call a clip
// finished while the trim route called it unfinished.
function statusOf(d) {
  const st = String((d && d.status) || 'sent').toLowerCase();
  if (st === 'completed') return 'done';
  if (st === 'failed' || st === 'cancelled' || st === 'expired') return 'failed';
  return 'drawing';
}

// EVERY PART SHE HAS CUT OUT OF ONE CLIP, in the order she cut them
// (2026-09-10, Sophie: "Can you also make it possible to re-cut the same
// whole clip after I've cut it to also get a second part"). `trims` is the
// shape; the singular `trim` is the ONE-PART record this shipped with and
// reads as a list of one, so a clip trimmed before parts existed needs no
// migration and no backfill — and a doc carrying `trims` ignores it.
function trimsOf(d) {
  const list = Array.isArray(d && d.trims) ? d.trims
    : (d && d.trim && typeof d.trim === 'object' ? [d.trim] : []);
  return list.filter((t) => t && typeof t === 'object' && t.key);
}
function trimCard(t) {
  return {
    start: Number(t.start) || 0, end: Number(t.end) || 0,
    seconds: Number(t.seconds) || Math.round(((Number(t.end) || 0) - (Number(t.start) || 0)) * 1000) / 1000,
    key: String(t.key || ''), status: String(t.status || ''), url: t.url || '', poster: t.poster || '', error: t.error || '',
  };
}

// The card the page draws, off the log doc.
function whyOf(d) {
  if (!d || String(d.status || '').toLowerCase() !== 'failed' || !d.error) return '';
  const e = videoRefusals.explain(d.error, d.errorCode, d.door || d.provider || '');
  return e && e.line ? e.line : '';
}
function cardOf(id, d) {
  const m = MODELS.find((x) => x.or === d.model || x.af === d.model || x.atlas === d.model) || null;
  const p = d.params || {};
  // THE PARTS RIDE BESIDE THE CLIP, NEVER OVER IT: `video` is what she
  // plays, saves and hands on (the first baked part once there is one),
  // `source` is always the clip the door drew, and `trims` is what the card
  // says. `trim` is still answered as the FIRST part, for a page cached from
  // before parts existed.
  const parts = trimsOf(d);
  const ready = parts.find((t) => t.status === 'ready' && t.url) || null;
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
    // A clip this page started carries `refs` (its roles included); one filed
    // by a chat or an older job is rebuilt from the log's own reference
    // record — and the two KEYFRAMES ride it as `startImage` / `endImage`,
    // so a chained clip's card says which picture it started on rather than
    // showing nothing where the frame was.
    refs: Array.isArray(d.refs) ? d.refs : slotsOf([
      ...((d.references && d.references.startImage) ? [{ url: d.references.startImage, kind: 'image', role: 'first' }] : []),
      ...((d.references && d.references.endImage) ? [{ url: d.references.endImage, kind: 'image', role: 'last' }] : []),
      ...((d.references && d.references.images) || []).map((url) => ({ url, kind: 'image' })),
      ...((d.references && d.references.videos) || []).map((url) => ({ url, kind: 'video' })),
      ...((d.references && d.references.audio) || []).map((url) => ({ url, kind: 'audio' })),
    ]),
    status: statusOf(d),
    video: (ready ? ready.url : d.video) || '', source: d.video || '',
    poster: (ready && ready.poster ? ready.poster : d.poster) || '',
    trims: parts.map(trimCard),
    trim: parts.length ? trimCard(parts[0]) : null,
    // to the HUNDREDTH of a cent, like the estimate — the real charge is
    // exact and rounding it to a tenth throws that away (13.96¢, not 14¢)
    cost: d.cost != null ? Math.round(Number(d.cost) * 10000) / 100 : null, estimate: d.estimate != null ? Number(d.estimate) : null,
    sentAt: d.sentAt || '', doneAt: d.doneAt || '', error: d.error || '', note: d.note || '',
    // WHY IT FAILED, IN HER WORDS — derived on every read from the door's
    // own text (`video-refusals.js`), never stored, so a reworded line
    // reaches every card already on file. Empty for a reason the table has
    // not met: the raw text stands alone and the table gets a row.
    why: whyOf(d),
    // HOW LONG THE DOOR TOOK — the door's own figure, never sentAt→doneAt
    // (which is when the poll NOTICED). Absent when the door did not say.
    drewMs: Number.isFinite(Number(d.drewMs)) && Number(d.drewMs) > 0 ? Math.round(Number(d.drewMs)) : null,
    // THE CLIP'S OWN LAST FRAME, rendered before the h264 encode rather than
    // decoded out of it (1.18x sharper, 118x the horizontal chroma detail —
    // measured 2026-09-09). It is a fact about the SOURCE clip, so it is
    // answered whatever the trims say; whether it is safe to CHAIN from is
    // the page's call, since a trimmed tail no longer ends on this frame.
    lastFrame: d.lastFrame || '',
    vote: d.vote || '', hidden: Boolean(d.hidden), title: d.title || '',
    // A REFUSAL THAT WALKED ON — the id of the card the job was sent again as
    resentAs: d.resentAs || '',
    // WHICH PROJECT — the cast library's film slug; '' for a clip drawn
    // before projects existed or sent under "All"
    project: projectSlug(d.project),
    // WHICH SUB-FOLDER of that project; '' for none (and always '' with no project)
    folder: projectSlug(d.project) ? folderSlug(d.folder) : '',
    // WHICH CHAT SENT IT — `footage` for this page's own; the card names any
    // other, since a chat's clip in her feed with nothing saying so reads as
    // one she drew and forgot
    chat: String(d.chat || ''),
  };
}

// ─── Polling the unfinished ones, throttled ────────────────────────────
const lastPoll = new Map();   // job id → ms
async function pollOne(id, d) {
  const now = Date.now();
  if (now - (lastPoll.get(id) || 0) < POLL_EVERY_MS) return null;
  lastPoll.set(id, now);
  const door = d.door || d.provider || 'apiframe';
  const mod = getDoors()[door] || getDoors().apiframe;
  if (!mod || !mod.pollVideo) return null;
  try {
    const r = await mod.pollVideo(id);
    if (r && r.video && !d.poster) bakePoster(id, r.video).catch(() => {});
    // A refusal that lands on the poll (APIFRAME's does) is the card's
    // answer — it is NOT sent again through another door (see doorFor).
    return r;
  } catch (e) { return null; }
}

// THE POLL-TIME WALK IS GONE (2026-09-11, the same evening it shipped — see
// doorFor): a refusal on the poll is the card's answer, never a re-send.

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

// ─── TRIMMING A FINISHED CLIP ──────────────────────────────────────────
// (2026-09-10, Sophie: "how hard would it be to make it possible to trim
// clips right as they come out of the footage module?")
//
// A Mini clip is 4-15 seconds and the shot inside it is usually shorter: the
// model holds a beat before the move starts and drifts at the tail. Until
// this the only way to lose either end was the Film Editor, a tool away, so
// a clip she liked went into the draft carrying its dead air.
//
// FIVE RULES, none of them optional:
//   · HER CLIP IS NEVER TOUCHED. The trim is a NEW object under
//     footage/trims/ and `video` on the log doc — the clip the door drew —
//     is never written. `trim` is a field beside it, so the poll, the
//     exact-prompt log and the 1080p-redo reading list all go on seeing the
//     original, and the trim can be undone with one tap.
//   · THE SPAN IS ALWAYS IN THE ORIGINAL'S OWN SECONDS. A trim is re-cut
//     from the source every time, never from the last trim, so she can widen
//     one back out; trimming a trim would make the marks mean something
//     different every round and lose a frame of quality per pass.
//   · IT IS BAKED ONCE. The object is content-addressed by the source url and
//     the span, so re-cutting a span she has already cut is one HEAD and no
//     encode — an undo followed by the same trim is free.
//   · ONE AT A TIME. A video decode is the one thing that has actually killed
//     this 512MB box (the panels-cut ledger in CLAUDE.md), and a trim is
//     never urgent, so they queue rather than stack.
//   · IT COSTS NOTHING — ffmpeg on our own box, no model call, no door. What
//     she paid for is the clip; the trim is free and so is undoing it.
//
// THE CUT IS clips.js's OWN — `chunkGraph`, the recipe the Chunking library
// already shares with Cut Marks: trim + setpts, with 12ms audio fades at each
// edge so an exact cut never clicks. A second copy of that would be a second
// set of edges to debug.
//
// AND THE LAST FRAME IS IN PLAY SINCE 2026-09-10: every Atlas job asks for
// one, so a finished clip carries `lastFrame` — the frame it really ends on.
// A TRIM MOVES THAT END. The baked frame belongs to the SOURCE clip, so the
// card answers it whatever the trims say (it is a fact about the source) and
// the RECENT drawer stops offering it the moment a trim is ready: chaining
// from a frame the clip she is handing on no longer ends on is the one wrong
// answer here. Re-pulling the frame from the trim is the fix if she ever
// wants both; nothing does it yet.
const TRIM_FOLDER = 'footage/trims';
const TRIM_MIN_SECONDS = 0.3;      // shorter than this is a tap, not a shot
const TRIM_MAX_SECONDS = 600;
const TRIM_FETCH_MS = 60000;
const TRIM_RUN_MS = 240000;

// The span to cut, or the reason it cannot be cut — PURE, so every rule is
// testable with no Firestore, no bucket and no ffmpeg.
function trimPlan(d, body) {
  const source = String((d && d.video) || '');
  if (statusOf(d) !== 'done' || !/^https?:\/\//.test(source)) {
    return { error: 'a clip is trimmed once it has drawn' };
  }
  const start = Math.round(Number(body && body.start) * 1000) / 1000;
  const end = Math.round(Number(body && body.end) * 1000) / 1000;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { error: 'a trim needs a start and an end, in seconds' };
  if (start < 0) return { error: 'a trim starts at 0 or later' };
  if (end <= start) return { error: 'the end comes after the start' };
  const span = Math.round((end - start) * 1000) / 1000;
  if (span < TRIM_MIN_SECONDS) return { error: `${span}s is shorter than the ${TRIM_MIN_SECONDS}s floor` };
  if (span > TRIM_MAX_SECONDS) return { error: 'that span is longer than any clip this page makes' };
  const key = crypto.createHash('sha1').update(`${source}|${start}|${end}`).digest('hex');
  return { source, start, end, span, key, path: `${TRIM_FOLDER}/${key}.mp4`, posterPath: `${TRIM_FOLDER}/${key}.jpg` };
}

// ONE DECODE AT A TIME, whoever asks. The queue is what makes peak memory
// independent of how many clips she trims in a row.
let trimQueue = Promise.resolve();
function gateTrim(fn) {
  const next = trimQueue.then(fn, fn);
  trimQueue = next.catch(() => {});
  return next;
}

// What the FILE says about itself — how long it really is and whether it
// carries sound. The ask is not the answer: a clip is 24·s + 1 frames, so a
// 4s ask really runs 4.04s, and an out-mark she dragged to the end has to
// clamp to the file rather than fail against the ask.
async function probeMedia(file) {
  const out = await runBin(ffprobeBin(), ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', file], 60000);
  const info = JSON.parse(out || '{}');
  return {
    total: parseFloat((info.format || {}).duration || '0') || 0,
    withAudio: (info.streams || []).some((x) => x.codec_type === 'audio'),
  };
}

// ONE span out of one file, on disk. Kept apart from the Firestore/Storage
// bookkeeping around it so the CUT can be measured with a real file and
// ffprobe (`node scripts/test-footage-trim.js`) rather than reasoned about.
async function cutSpan(src, out, start, end, withAudio) {
  const bin = ffmpegBin();
  const graph = require('./clips').chunkGraph(start, end, withAudio);
  const args = ['-y', '-i', src, '-filter_complex', graph, '-map', '[v]'];
  if (withAudio) args.push('-map', '[a]', '-c:a', 'aac', '-b:a', '160k');
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
  await runBin(bin, args, TRIM_RUN_MS);
  return out;
}

// Fire-and-forget on the clip's own doc: baking → ready, or baking → failed
// with the reason the card shows. NEVER throws — a trim that cannot be baked
// must leave the original exactly as it was.
async function bakeTrim(id, plan) {
  return gateTrim(async () => {
    // A LATE BAKE MUST NOT SPEAK FOR A PART SHE HAS MOVED ON FROM. Bakes
    // queue, so a second tap can land while the first is still encoding —
    // and the write that matters is the REMOVAL: without this guard a bake
    // finishing after her ✕ would put the part back on the doc by itself,
    // with nothing on screen saying why. The part's own `key` in the doc's
    // list is the authority; a bake whose key is no longer there stands down
    // silently. It PATCHES ITS OWN ENTRY rather than writing the list it
    // read, so a part she cut while this one was encoding is never dropped.
    const write = async (patch) => {
      try {
        const ref = coll().doc(String(id));
        const snap = await ref.get();
        const cur = snap.exists ? trimsOf(snap.data()) : [];
        const i = cur.findIndex((t) => t.key === plan.key);
        if (i < 0) return null;
        const next = cur.slice();
        next[i] = { ...next[i], ...patch };
        await ref.set({ trims: next, trim: admin.firestore.FieldValue.delete() }, { merge: true });
      } catch { /* the card keeps saying it is baking; the next tap re-plans */ }
      return null;
    };
    const bucket = bucketOrNull();
    const bin = ffmpegBin();
    if (!bucket || !bin) return write({ status: 'failed', error: 'ffmpeg or Storage is not configured here' });
    const pub = (p) => `https://storage.googleapis.com/${bucket.name}/${p}`;
    try {
      // baked once: a span she has already cut is a HEAD and no encode
      const f = bucket.file(plan.path);
      const [exists] = await f.exists();
      if (exists) {
        const [pExists] = await bucket.file(plan.posterPath).exists().catch(() => [false]);
        return write({ status: 'ready', url: pub(plan.path), poster: pExists ? pub(plan.posterPath) : '' });
      }
    } catch { /* fall through and bake */ }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trim-'));
    const src = path.join(dir, 'src.mp4');
    const out = path.join(dir, 'trim.mp4');
    const jpg = path.join(dir, 'poster.jpg');
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), TRIM_FETCH_MS);
      let r;
      try { r = await fetch(plan.source, { agent: proxyAgent || undefined, signal: ctl.signal }); }
      finally { clearTimeout(timer); }
      if (!r || !r.ok) return write({ status: 'failed', error: 'the clip could not be read back' });
      fs.writeFileSync(src, await r.buffer());

      // THE FILE IS THE TRUTH ABOUT ITS OWN LENGTH, not the seconds she
      // asked the door for: a clip is 24·s + 1 frames, so the real total
      // runs a frame past the ask. The end is CLAMPED rather than refused —
      // an out-mark she dragged to the very end must not fail the bake.
      const { total, withAudio } = await probeMedia(src);
      const end = total ? Math.min(plan.end, Math.round(total * 1000) / 1000) : plan.end;
      if (total && plan.start >= total) return write({ status: 'failed', error: `the clip is ${total.toFixed(1)}s — the trim starts after it ends` });
      if (Math.round((end - plan.start) * 1000) / 1000 < TRIM_MIN_SECONDS) {
        return write({ status: 'failed', error: `the clip is ${total.toFixed(1)}s — that leaves nothing to keep` });
      }

      await cutSpan(src, out, plan.start, end, withAudio);

      const vf = bucket.file(plan.path);
      await vf.save(fs.readFileSync(out), { metadata: { contentType: 'video/mp4' } });
      await vf.makePublic();

      // the trim's own first frame — cut out of the file we already have on
      // disk, so it costs no second download
      let poster = '';
      try {
        await runBin(bin, ['-y', '-ss', '0.05', '-i', out, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', jpg], 60000);
        const pf = bucket.file(plan.posterPath);
        await pf.save(fs.readFileSync(jpg), { metadata: { contentType: 'image/jpeg' } });
        await pf.makePublic();
        poster = pub(plan.posterPath);
      } catch { /* a trim with no poster still plays */ }

      return write({ status: 'ready', url: pub(plan.path), poster, seconds: Math.round((end - plan.start) * 1000) / 1000, end });
    } catch (e) {
      return write({ status: 'failed', error: String((e && e.message) || e).slice(0, 200) });
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
    }
  });
}

// ─── GRABBING ONE FRAME OUT OF A FINISHED CLIP ─────────────────────────
// (2026-09-12, Sophie: "I need to cut one out. I said the last frame doesn't
// have the curtains" · "it shouldn't file to the dump. It should give me a
// way to use it immediately as a reference for my next film".) The last
// frame Atlas hands back is the END of what the door drew, and the frame
// that carries continuity is often somewhere in the middle. So the trimmer's
// playhead is the pick: GRAB FRAME pulls that second out of the clip the
// door drew, at the clip's own size, and answers a public url the page drops
// straight into the references strip — no Dump, no save-and-re-attach.
// The trim's own rules, again:
//   · HER CLIP IS NEVER TOUCHED. The frame is a NEW object under
//     footage/frames/, content-addressed by the source url and the second,
//     so the same frame grabbed twice is a HEAD and no decode.
//   · IT IS READ OUT OF THE SOURCE, never out of a trim — the player always
//     opens the source, so the second she sees is the second she gets.
//   · ONE DECODE AT A TIME — gateTrim, the same queue the trims stand in.
//   · IT COSTS NOTHING — ffmpeg on our own box, no model call, no door.
// PNG at full size: a continuity reference is judged by the model at
// whatever it is, and a jpeg's ringing on a hairline is exactly what such a
// frame must not carry. It answers SYNCHRONOUSLY — one download and one
// decoded frame is a few seconds, and the url is what she is waiting for.
const FRAME_FOLDER = 'footage/frames';
const FRAME_END_PAD = 0.04;        // a playhead parked at the very end is the last frame, not a refusal

// The frame to pull, or the reason it cannot be pulled — PURE.
function framePlan(d, body) {
  const source = String((d && d.video) || '');
  if (statusOf(d) !== 'done' || !/^https?:\/\//.test(source)) {
    return { error: 'a frame is grabbed once the clip has drawn' };
  }
  const at = Math.round(Number(body && body.at) * 1000) / 1000;
  if (!Number.isFinite(at)) return { error: 'a frame needs a second, in seconds' };
  if (at < 0) return { error: 'a frame is at 0 or later' };
  if (at > TRIM_MAX_SECONDS) return { error: 'that is past any clip this page makes' };
  return framePath(source, at);
}
function framePath(source, at) {
  const key = crypto.createHash('sha1').update(`${source}|frame|${at}`).digest('hex');
  return { source, at, key, path: `${FRAME_FOLDER}/${key}.png` };
}

// ONE frame out of one file, on disk — kept apart from the Storage
// bookkeeping so the pull can be MEASURED with a real file
// (`node scripts/test-footage-grab-frame.js`). `-ss` before `-i` seeks to
// the keyframe and decodes forward to the exact second, so the frame is the
// one under the playhead and not the nearest keyframe.
async function pullFrame(src, out, at) {
  await runBin(ffmpegBin(), ['-y', '-ss', String(at), '-i', src, '-frames:v', '1', out], 60000);
  return out;
}

// The whole grab: the banked object if there is one, else download, probe,
// clamp, pull, upload. THROWS with a sentence the card can show.
async function grabFrame(plan) {
  return gateTrim(async () => {
    const bucket = bucketOrNull();
    if (!bucket || !ffmpegBin()) throw new Error('ffmpeg or Storage is not configured here');
    const pub = (p) => `https://storage.googleapis.com/${bucket.name}/${p}`;
    try {
      const [exists] = await bucket.file(plan.path).exists();
      if (exists) return { url: pub(plan.path), at: plan.at, banked: true };
    } catch { /* fall through and pull */ }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-'));
    const src = path.join(dir, 'src.mp4');
    const out = path.join(dir, 'frame.png');
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), TRIM_FETCH_MS);
      let r;
      try { r = await fetch(plan.source, { agent: proxyAgent || undefined, signal: ctl.signal }); }
      finally { clearTimeout(timer); }
      if (!r || !r.ok) throw new Error('the clip could not be read back');
      fs.writeFileSync(src, await r.buffer());
      // THE FILE IS THE TRUTH ABOUT ITS OWN LENGTH: a playhead parked on the
      // clip's end sits a hair past the last frame, so it is CLAMPED to the
      // last frame rather than refused — and the object is addressed by the
      // second that was really pulled.
      const { total } = await probeMedia(src);
      let at = plan.at;
      if (total && at > total - FRAME_END_PAD) at = Math.max(0, Math.round((total - FRAME_END_PAD) * 1000) / 1000);
      const p2 = at === plan.at ? plan : framePath(plan.source, at);
      await pullFrame(src, out, at);
      const f = bucket.file(p2.path);
      await f.save(fs.readFileSync(out), { metadata: { contentType: 'image/png' } });
      await f.makePublic();
      return { url: pub(p2.path), at, banked: false };
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
    }
  });
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
// `ms` is optional and only ever a CEILING: a hung ffmpeg holds the trim
// queue forever without one, and the queue is what keeps this box alive.
function runBin(bin, args, ms) {
  return new Promise((resolve, reject) => {
    if (!bin) { reject(new Error('binary unavailable')); return; }
    let out = '';
    const p = spawn(bin, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    const timer = ms ? setTimeout(() => { try { p.kill('SIGKILL'); } catch { /* gone */ } }, ms) : null;
    const done = (fn, v) => { if (timer) clearTimeout(timer); fn(v); };
    p.stdout.on('data', (d) => { out += d.toString(); });
    p.on('error', (e) => done(reject, e));
    p.on('close', (code) => (code === 0 ? done(resolve, out) : done(reject, new Error('exit ' + code))));
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
      '-show_entries', 'stream=width,height,side_data_list:stream_tags=rotate:format=duration',
      '-of', 'json', file]);
    const j = JSON.parse(out);
    const st = (j.streams || [])[0];
    if (!st || !st.width || !st.height) return null;
    const sd = (st.side_data_list || []).find((x) => x && x.rotation != null) || {};
    const tag = st.tags && st.tags.rotate;
    const rot = Math.abs(Number(sd.rotation != null ? sd.rotation : tag) || 0) % 180;
    // the length rides along (the same probe, one more field) for the
    // reference-video total Atlas caps — see refVideoTotal
    const seconds = Number(j.format && j.format.duration);
    const dim = rot === 90 ? { w: st.height, h: st.width } : { w: st.width, h: st.height };
    if (Number.isFinite(seconds) && seconds > 0) dim.seconds = seconds;
    return dim;
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
  const said = (d) => (d && d.plan ? { url: d.url, note: videoFloor.upscaleNote(d.plan, name), seconds: d.seconds } : { url, note: '', seconds: d && d.seconds });
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
      floorDecided.set(url, { plan: null, seconds: size.seconds });
      writeFloorSidecar(bucket, url, { plan: null, w: size.w, h: size.h, seconds: size.seconds });
      return { url, note: '', seconds: size.seconds };
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
    const decision = { plan, url: done, w: size.w, h: size.h, seconds: size.seconds };
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
  const seconds = [];
  for (const u of list) {
    const r = await ensureVideoFloor(u, (body.__names || {})[u]);
    urls.push(r.url);
    if (r.note) notes.push(r.note);
    seconds.push(Number.isFinite(Number(r.seconds)) ? Number(r.seconds) : null);
  }
  return { urls, notes, seconds };
}

// THE REFERENCE VIDEOS' TOTAL IS CHECKED BEFORE THE TAP LEAVES (2026-09-10,
// Sophie's four clips: two 12-15s references on each, Atlas refused all four
// in under two seconds — "Total duration of all reference videos must not
// exceed 15.2 seconds" — and the page showed them drawing for twenty
// minutes). The lengths come off the floor probe's sidecar, so a reference
// already probed costs nothing here. Pure: answers the line to refuse with,
// or '' — and ONLY when every length is known and the sum is over, because
// a length nothing measured is not evidence (a sidecar banked before this
// carries none; the next new reference does). Atlas only: the cap is
// measured there and unmeasured on the other doors.
function refVideoTotalRefusal(seconds, door) {
  if (door !== 'atlascloud') return '';
  const known = (seconds || []).filter((x) => Number.isFinite(x));
  if (!known.length || known.length !== (seconds || []).length) return '';
  const total = known.reduce((a, b) => a + b, 0);
  if (total <= videoRefusals.REF_VIDEO_TOTAL_MAX) return '';
  return `Your reference videos add up to ${total.toFixed(1)} seconds — Atlas takes ${videoRefusals.REF_VIDEO_TOTAL_MAX} at most for one job. Use one video, or trim them so together they are under it.`;
}

// ─── Starting a job: the door, the log ──────────────────────────────
// Answers { jobId, door, sent, seed, estimate, note } or throws with
// status/refusal/why/hint. ONE door, one send — a refusal throws and the
// page shows it; nothing here sends the job anywhere else (see doorFor).
// Write a refused job into `forge-video-jobs` exactly as an accepted one is
// written — same prompt, same references, same tags — with `status:'failed'`
// (never a new word: an older cached page draws an unknown status as a clip
// that draws forever) and `refused`/`refusal`/`door` beside it. See
// video-log.js's own note.
async function logRefusal({ body, refs, m, res, ratio, seconds, first, last, door, err }) {
  const params = {
    duration: seconds, resolution: res, ratio,
    generate_audio: body.generateAudio !== false,
    reference_image_urls: (body.referenceImageUrls || []).slice(),
    reference_video_urls: (body.referenceVideoUrls || []).slice(),
    reference_audio_urls: (body.referenceAudioUrls || []).slice(),
  };
  if (body.seed != null) params.seed = body.seed;
  if (first) params.start_image = first;
  if (last) params.end_image = last;
  const ex = videoRefusals.explain(String((err && err.message) || ''));
  const doc = videoLog.refusedRecord({
    jobId: crypto.randomUUID(), prompt: body.prompt, model: (m && m.label) || '', params,
    tag: { chat: body.chat || CHAT, title: titleOf(body.prompt), project: body.project, folder: body.folder },
    door, refusal: err && err.refusal, error: (err && err.message) || '',
    why: (err && err.why) || (ex && ex.line) || '',
  });
  doc.refs = refs.map((r) => ({ url: r.url, kind: r.kind, slot: r.slot || '', role: r.role || '', name: r.name || '' }));
  doc.modelLabel = (m && m.label) || '';
  doc.seconds = seconds; doc.resolution = res; doc.ratio = ratio;
  doc.sound = params.generate_audio;
  doc.aspect = ratio;
  doc.footage = true;
  await coll().doc(doc.job).set(doc);
}

async function startJob(b) {
  await discounts().catch(() => {});
  await atlasPrices().catch(() => {});
  const built = buildJob(b);
  if (built.error) { const e = new Error(built.error); e.status = 400; throw e; }
  const { body, refs, m, res, ratio, seconds, first, last } = built;
  // A KEYFRAME NEVER COUNTS AS A REFERENCE VIDEO — it is a picture, and
  // `hasVideo` is what picks APIFRAME's dearer with-a-video rate.
  const hasVideo = refs.some((r) => r.kind === 'video' && !r.role);
  const shape = { hasFirstFrame: Boolean(first), hasLastFrame: Boolean(last), hasRefs: refs.some((r) => !r.role) };
  const d = doorFor({ model: m, door: b.door, hasVideo, resolution: res, ratio, seconds, ...shape }, cfg());
  if (d.error) { const e = new Error(d.error); e.status = 400; e.refusal = e.refusal || ((shape.hasFirstFrame || shape.hasLastFrame) ? 'shape' : undefined); e.why = d.error; throw e; }
  // A reference under ByteDance's pixel floor is refused before anything
  // draws, so swap in an upscaled copy BEFORE the door sees the body — and
  // keep `refs` (the card) pointing at her originals.
  body.__names = Object.fromEntries(refs.filter((r) => r.kind === 'video').map((r) => [r.url, r.name]));
  const floored = await floorRefs(body);
  delete body.__names;
  body.referenceVideoUrls = floored.urls;
  const over = refVideoTotalRefusal(floored.seconds, d.door);
  if (over) { const e = new Error(over); e.status = 400; e.refusal = 'shape'; e.why = over; throw e; }
  const est = estimate({ model: m, resolution: res, ratio, seconds, hasVideo, door: d.door, ...shape }, cfg());
  const extra = { door: d.door, refs, estimate: est.cents != null ? est.cents : null, footage: true, aspect: ratio };
  if (floored.notes.length) extra.note = floored.notes.join(' ');
  if (body.project) extra.project = body.project;
  if (body.folder) extra.folder = body.folder;
  const mod = getDoors()[d.door];
  // THE LAST FRAME RIDES ALONG ON ATLAS, AND ONLY THERE (2026-09-10,
  // Sophie: "on"). It is FREE — measured 2026-09-09, billed to the token
  // against the video-only formula — and it is the chaining still this
  // draft keeps needing: the room and the person carried from one clip
  // into the next. Asked for on the ATLAS door alone because it is the
  // only one that answers with a frame: OpenRouter accepts the flag and
  // hands back one output (a measured no-op) and APIFRAME builds its own
  // body, so sending it there would be a key nothing reads.
  const req = { ...body, model: d.door === 'openrouter' ? m.or : d.door === 'atlascloud' ? m.atlas : m.af,
    ...(d.door === 'atlascloud' ? { returnLastFrame: true } : {}) };
  if (extra.note) req.note = extra.note;
  let r;
  try {
    r = await mod.startVideo(req, { ...extra, ...(extra.note ? { note: extra.note } : {}) });
  } catch (e) {
    // the door's refusal, as it came — the page's card and toast say why
    e.door = e.door || d.door;
    // AND IT IS LOGGED (2026-09-12, Sophie: "can you log refuse jobs?").
    // The door threw before it could file anything, so her prompt and her
    // references would otherwise live only in the box she typed them in.
    // Best-effort and never awaited into the refusal: a log that fails must
    // still let the door's own words reach her, unchanged.
    await logRefusal({ body, refs, m, res, ratio, seconds, first, last, door: d.door, err: e })
      .catch(() => {});
    throw e;
  }
  // the seed the door really used — hers, or the one it minted — so the card
  // this tap draws carries it without waiting for the first poll
  const seed = r.params && r.params.seed != null ? Number(r.params.seed) : null;
  return { jobId: r.jobId, door: d.door, sent: r.sent || req, seed: Number.isFinite(seed) ? seed : null,
    fellBack: false, estimate: est.cents, note: extra.note || '' };
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
  res.json({ ok: true, chat: CHAT, doors: cfg(), balances: bal, models: publicModels(), ratios: RATIOS, sizes: SIZES, fee: OR_FEE, handoffProjects: HANDOFF_PROJECTS });
});

// GET /estimate?model=&res=&ratio=&seconds=&video=1&door=&first=1&last=1&refs=1
// — the price of the tap as the controls stand, with `exact` or `about`
// saying whether it is pinned. Free; the page asks on every change so it
// holds no copy of a price, and the live discount is refreshed (cached ten
// minutes) before it answers. `first` / `last` / `refs` are the job's SHAPE:
// a keyframe narrows which doors can take it at all, so the door named here
// is the door the tap will really go to.
router.get('/estimate', async (req, res) => {
  await discounts().catch(() => {});
  await atlasPrices().catch(() => {});
  const q = req.query || {};
  const e = estimate({ model: q.model, resolution: q.res, ratio: q.ratio, seconds: q.seconds,
    hasVideo: q.video === '1', door: q.door,
    hasFirstFrame: q.first === '1', hasLastFrame: q.last === '1', hasRefs: q.refs === '1' }, cfg());
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
    // `why` is the table's line for the door's text — the card's own field,
    // so a refusal on the POST reads the same as one that lands on the poll
    const ex = e.why ? null : videoRefusals.explain(e.body || e.message, e.errorCode, e.door || '');
    // WHICH DOOR REFUSED IT rides back, because the page offers her the
    // OTHERS (2026-09-12, Sophie: "send it through atlas") — and a list that
    // included the door that just refused would be one tap of hers spent on
    // the same refusal. The job is still never re-sent on its own.
    res.status(e.status || 500).json({ error: e.message, refusal: e.refusal, hint: e.hint, door: e.door, why: e.why || (ex && ex.line) || undefined });
  }
});

// THE FEED PAGES BACK (2026-09-11, Sophie: "I can't go back farther than
// today in footage"). The read was the newest 40 and nothing else, and at
// ~70 Mini clips a day that IS today — everything before it existed on the
// log and was reachable from nowhere (the Assets tab's own hard-truncate
// lesson, arriving at the page she draws in most). `before` is the sentAt of
// the oldest clip she holds; the answer is the page under it and `more` says
// whether anything is left under THAT. Pure, so the walk has a test that
// needs no Firestore.
function pageJobs(all, { limit, before, max } = {}) {
  const lim = Math.min(Number(limit) || 40, max || 200);
  const sorted = all.slice().sort((a, b) => String(b.d.sentAt || '').localeCompare(String(a.d.sentAt || '')));
  const under = before ? sorted.filter((x) => String(x.d.sentAt || '') < String(before)) : sorted;
  const docs = under.slice(0, lim);
  return { docs, more: under.length > docs.length };
}

router.get('/jobs', async (req, res) => {
  try {
    // EVERY CLIP ON THE LOG, WHICHEVER CHAT DREW IT (2026-09-11, Sophie, on
    // hearing the chat-made ward clips were not in this feed: "are you
    // adding them to footage? if so, good"). The feed was `chat == footage`
    // — the page's own clips only, the Playground's "a chat's clips do NOT
    // go here" rule — and it left ~200 clips the chats had drawn for the
    // same films reachable from nowhere she looks. A project is a project
    // whoever sent the clip, so the read is the whole collection and the
    // card says which chat it came from (`from <chat>`) when it was not this
    // page. ~370 docs of ~1KB — one read, the same shape as before.
    const snap = await coll().get();
    // ONE PROJECT AT A TIME when the page asks for one. Filtered here, over
    // the whole collection the read already holds, BEFORE the page is cut —
    // filtering a truncated page client-side is the Assets tab's own lesson.
    // No `project` on the query is every clip, which is what a page cached
    // from before this sends.
    const project = projectSlug(req.query.project);
    // and ONE FOLDER of it when asked — only ever beside a project
    const folder = project ? folderSlug(req.query.folder) : '';
    const rows = snap.docs.map((d) => ({ id: d.id, d: d.data() }));
    let all = rows.filter((x) => (!project || projectSlug(x.d.project) === project) && (!folder || folderSlug(x.d.folder) === folder));
    // every project's folders, off the whole read — the picker's and the
    // card's rows, derived rather than stored
    const folders = foldersOf(rows);
    // A SEARCH READS THE WHOLE LOG, NOT THE PAGE SHE IS LOOKING AT (2026-09-11,
    // Sophie: "add a search button and filter like playground") — the Assets
    // tab's lesson: a box that only filters the loaded page answers "nothing
    // matches" for everything behind the first 40. Filtered here over every
    // clip the read holds, BEFORE the page is cut, with the same words the
    // page's own filter reads (footage-hay.js) and the feed's own matcher
    // (search-grammar.js). A search may ask for a bigger page.
    const q = String(req.query.q || '').trim();
    if (q) {
      const groups = grammar.compileFeed(q);
      all = all.filter((x) => grammar.feedMatches(hayOf(cardOf(x.id, x.d)), groups));
    }
    const { docs, more } = pageJobs(all, { limit: q ? Math.min(Number(req.query.limit) || 40, 300) : req.query.limit, before: req.query.before, max: q ? 300 : undefined });
    // ask the doors about the ones still drawing — throttled per job, so a
    // page polling every few seconds is one provider read per job per 12s
    await Promise.all(docs.map(async (x) => {
      const st = String(x.d.status || 'sent').toLowerCase();
      if (st !== 'sent' && st !== 'processing' && st !== 'pending' && st !== 'queued' && st !== 'starting') return;
      const r = await pollOne(x.id, x.d);
      if (r && r.patch) Object.assign(x.d, r.patch, r.video ? { video: r.video } : {});
    }));
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, jobs: docs.map((x) => cardOf(x.id, x.d)), more, folders });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /jobs/:id/kin — THE CLIP BEFORE THIS ONE for the compare panel: the
// nearest OLDER clip in the same project whose prompt is a near-twin of this
// one (clip-diff.js's kinOf, the ONE rule the page runs over what it holds).
// The page asks here when the twin is further back than the feed has loaded
// — her screenshot (2026-09-11) compared a 15s 9:16 clip against the 4s
// failed 3:4 clip that merely came before it. Answers the plain previous
// clip with `kin:false` when the project holds no twin, and nothing when it
// holds nothing older at all.
router.get('/jobs/:id/kin', async (req, res) => {
  try {
    const id = String(req.params.id);
    const snap = await coll().get();
    const cards = snap.docs.map((d) => cardOf(d.id, d.data()));
    const j = cards.find((c) => c.id === id);
    if (!j) { res.status(404).json({ error: 'no such clip' }); return; }
    const k = clipDiff.kinOf(j, cards);
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, job: k ? k.job : null, kin: k ? k.kin : false, back: k ? k.back : 0 });
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
// POST /jobs/:id/project { project, folder? } — MOVE a clip to a project, or
// off one with ''; `folder` puts it in a sub-folder of that project (absent
// or '' takes it out of any folder — a folder belongs to the project it is
// in, so a move between projects always leaves the old one's folder behind).
// Two fields, nothing else on the doc moves. The card's own drop-downs call
// it (2026-09-11, Sophie: "can you also add the move project UI" · "can we
// do sub folders"), and so do the backfill's `--map` and a chat.
router.post('/jobs/:id/project', async (req, res) => {
  try {
    const project = projectSlug(req.body && req.body.project);
    const folder = project ? folderSlug(req.body && req.body.folder) : '';
    await coll().doc(String(req.params.id)).set({ project, folder }, { merge: true });
    res.json({ ok: true, project, folder });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/jobs/:id/hide', async (req, res) => {
  try {
    const hidden = Boolean(req.body && req.body.hidden);
    await coll().doc(String(req.params.id)).set({ hidden }, { merge: true });
    res.json({ ok: true, hidden });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /jobs/:id/trim — the ONE door onto her parts, and every shape of it
// leaves the clip the door drew exactly as it was:
//   { start, end }            adds a part (the bake runs behind the answer)
//   { start, end, replace }   swaps one part's span for another, in place
//   { remove: <key> }         takes one part off
//   { clear: true }           takes them all off
// Free every way — ffmpeg on our own box, no model call, no door.
const TRIM_MAX_PARTS = 12;
router.post('/jobs/:id/trim', async (req, res) => {
  try {
    const id = String(req.params.id);
    const snap = await coll().doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: 'no such clip' });
    const d = snap.data();
    const body = req.body || {};
    const parts = trimsOf(d);
    // the two REMOVALS: nothing to restore, because the original was never
    // written over — a part is one entry off a list beside it
    const drop = (next) => coll().doc(id).set({ trims: next, trim: admin.firestore.FieldValue.delete() }, { merge: true });
    if (body.clear) {
      await drop([]);
      return res.json({ ok: true, cleared: true, job: cardOf(id, { ...d, trims: [], trim: null }) });
    }
    if (body.remove) {
      const gone = String(body.remove);
      const next = parts.filter((t) => t.key !== gone);
      await drop(next);
      return res.json({ ok: true, removed: parts.length !== next.length, job: cardOf(id, { ...d, trims: next, trim: null }) });
    }
    const plan = trimPlan(d, body);
    if (plan.error) return res.status(400).json({ error: plan.error });
    // A part is content-addressed by its span, so cutting the SAME span twice
    // is one part, not two — and re-tapping a part that is already baked is a
    // no-op rather than a second encode of identical bytes.
    const replacing = body.replace ? String(body.replace) : '';
    const kept = replacing ? parts.filter((t) => t.key !== replacing) : parts;
    const already = kept.find((t) => t.key === plan.key);
    if (already) return res.json({ ok: true, job: cardOf(id, { ...d, trims: kept, trim: null }) });
    if (kept.length >= TRIM_MAX_PARTS) return res.status(400).json({ error: `that is ${TRIM_MAX_PARTS} parts already — take one off first` });
    const part = { start: plan.start, end: plan.end, seconds: plan.span, key: plan.key,
      source: plan.source, at: new Date().toISOString(), status: 'baking', url: '', poster: '', error: '' };
    // REPLACING KEEPS ITS PLACE IN THE ORDER — the parts are the order she
    // cut them and a nudged mark is the same part, not a new last one.
    const next = replacing && parts.some((t) => t.key === replacing)
      ? parts.map((t) => (t.key === replacing ? part : t))
      : kept.concat([part]);
    await coll().doc(id).set({ trims: next, trim: admin.firestore.FieldValue.delete() }, { merge: true });
    bakeTrim(id, plan).catch(() => {});
    res.status(202).json({ ok: true, job: cardOf(id, { ...d, trims: next, trim: null }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /jobs/:id/frame — one frame out of a finished clip, answered as a
// url the moment it is on Storage. Nothing on the clip's doc changes: the
// frame lives in the references strip she drops it into (and in her draft).
router.post('/jobs/:id/frame', async (req, res) => {
  try {
    const id = String(req.params.id);
    const snap = await coll().doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: 'no such clip' });
    const plan = framePlan(snap.data(), req.body || {});
    if (plan.error) return res.status(400).json({ error: plan.error });
    const got = await grabFrame(plan);
    res.json({ ok: true, url: got.url, at: got.at, banked: got.banked });
  } catch (e) { res.status(500).json({ error: String((e && e.message) || e).slice(0, 200) }); }
});

module.exports = {
  router, init,
  MODELS, RATIOS, SIZES, CHAT, OR_FEE,
  modelOf, doorFor, doorTakes, shapeRefusal, estimate, priceOn, DOOR_LOOSENESS, DOOR_REFUSAL_FREE, DOOR_WORDS, pollOne, slotsOf, kindOf, buildJob, titleOf, cardOf, publicModels, canvasOf, resFactor, secondsOk, framesOf, projectSlug, HANDOFF_PROJECTS,
  discounts, discountOf, endpointDiscount, atlasPrices, atlasPerSecOf, atlasCacheBust,
  startJob, bakePoster, ensureVideoFloor, floorDecided, refVideoTotalRefusal, whyOf,
  pageJobs, hayOf, foldersOf, folderSlug, statusOf, trimsOf, trimCard, trimPlan, bakeTrim, cutSpan, probeMedia, gateTrim, TRIM_MIN_SECONDS, TRIM_MAX_PARTS, TRIM_FOLDER,
  framePlan, framePath, pullFrame, grabFrame, FRAME_FOLDER, FRAME_END_PAD,
};
