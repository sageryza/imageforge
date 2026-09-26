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
const cast = require('./cast');          // the films ARE the projects — one vocabulary

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
//     clip).
//   · AND SO DOES 2.0 — measured 2026-09-12, which is the second half of the
//     same finding and was quietly UNDER-QUOTING her. The one 2.0 job that
//     has gone through OpenRouter (4s 480p 3:4) was quoted $0.2037 off the
//     published 2.0 canvas (480×640) and BILLED $0.2792 — a factor of 1.371,
//     which is 560×752 / 480×640 = 1.3708, i.e. the 2.5 canvas to four
//     figures. So `sizes: '2.5'` is on the 2.0 row too. It stays `about`
//     rather than `exact`: one job at one shape is enough to fix the canvas
//     and not enough to pin every rung, where Mini's was ffprobed on every
//     clip. Fast has still never gone through OpenRouter and keeps the
//     published table.
//   · 2.5's CANVAS IS MEASURED AND THE `~` IS OFF IT (2026-09-12). Not by
//     ffprobe but by the better evidence — OpenRouter hands its REAL charge
//     back on every job, and across four distinct shapes the estimate and
//     the charge agree TO THE CENT: 480p 9:16 30s $3.0883, 720p 9:16 15s
//     $3.4764 (twice), 720p 9:16 30s $6.9432, 720p 3:4 4s $0.9400. A price
//     that lands on the cent on four shapes is not a guess, so
//     `canvasMeasured: true`. A reference VIDEO still answers `about` —
//     that surcharge is measured on one job and nothing else.
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
    res: ['480p', '720p', '1080p'], secs: [4, 15], family: '2.0', sizes: '2.5',
    orTok: { '480p': 7e-6, '720p': 7e-6, '1080p': 7.7e-6 },
    afCents: { '480p': 8, '720p': 18, '1080p': null }, atlasCents: { '480p': 11.2, '720p': 11.2, '1080p': null } },
  { id: '2.5', label: '2.5', or: 'bytedance/seedance-2.5', af: 'seedance-2.5',
    atlas: 'bytedance/seedance-2.5/reference-to-video',
    res: ['480p', '720p'], secs: [4, 30], family: '2.5', canvasMeasured: true,
    orTok: { '480p': 1.07e-5, '720p': 1.07e-5 },
    afCents: { '480p': 13, '720p': 29 }, afVid: { '480p': 15 }, afExact: ['480p', '480p+video'],
    atlasCents: { '480p': 16.7, '720p': 16.7 } },
  { id: '1.5', label: '1.5 Pro', or: null, af: 'seedance-1.5-pro',
    res: ['480p', '720p'], secs: [4, 8, 12], family: '2.0', audioDefault: false,
    afCents: { '480p': 1.5, '720p': 3.4 } },
  // WAN 3.0 ON THE PAGE — ATLAS ONLY, THREE ENDPOINTS BEHIND ONE ROW
  // (2026-09-17, Sophie: "wan endpoints atlas" · "3.0 30s?"). Alibaba's
  // model on Atlas's door: 2-30 seconds in ONE pass, ten pictures + five
  // videos + five audios, and NOT ONE SENTENCE ABOUT FACES IN ITS DOCS (the
  // one job on file, 2026-09-11, took four person references without a word;
  // whether it draws a FAMOUS face — Seedance Mini drew "a guy that looks
  // suspiciously like robert pattinson" twice and blocked "a robert pattinson
  // lookalike contest" at the output gate the same minute — is UNMEASURED
  // and is exactly what this row is for). `atlas` is the reference-to-video
  // id; atlascloud.js swaps it for text-to-video (no references) or
  // image-to-video (a first frame) by the shape, so the row is all three.
  // THE PRICE: Atlas publishes ONE flat figure per second (5¢ list, 4¢ on
  // the sale — read live off `GET /models` like every other row) and its
  // model page says "uniform across resolutions" — but Alibaba's own ladder
  // is 5¢ / 10¢ / 20¢ at 480p / 720p / 1080p, and Atlas turned out to bill
  // Seedance by resolution behind one flat figure (2.2x at 720p, measured).
  // So `resScale` scales the flat rate by Alibaba's ladder — the safe
  // direction, over-quoting until a 720p charge is read — and every figure
  // is `about`, as all of Atlas's are. The one measurement: 15s 480p 16:9
  // drew for 60¢, i.e. 4¢/s exactly. `atlasCaps` are Wan's own (Atlas's
  // Seedance caps are 9/3/3). No 21:9 (Wan's ratio list has none);
  // `adaptive` and -1 seconds exist on the door and are not offered here.
  { id: 'wan', label: 'Wan 3.0', or: null, af: null,
    atlas: 'alibaba/wan-3.0/reference-to-video',
    res: ['480p', '720p', '1080p'], secs: [2, 30], family: 'wan', sizes: '2.5',
    ratios: ['1:1', '3:4', '9:16', '4:3', '16:9'], resScale: { '480p': 1, '720p': 2, '1080p': 4 },
    atlasCaps: { image: 10, video: 5, audio: 5 },
    atlasCents: { '480p': 5, '720p': 5, '1080p': 5 } },
  { id: 'wan-prime', label: 'Wan 3.0 Prime', or: null, af: null,
    atlas: 'alibaba/wan-3.0-prime/reference-to-video',
    res: ['480p', '720p', '1080p'], secs: [2, 30], family: 'wan', sizes: '2.5',
    ratios: ['1:1', '3:4', '9:16', '4:3', '16:9'], resScale: { '480p': 1, '720p': 2, '1080p': 4 },
    atlasCaps: { image: 10, video: 5, audio: 5 },
    atlasCents: { '480p': 6.8, '720p': 6.8, '1080p': 6.8 } },
  // WAN 2.2 TURBO — THE WAN THAT TAKES A REAL FACE (2026-09-17, measured on
  // her go: his own photograph as the first frame, 5s at 480p, DREW — him,
  // moving, in the chair — after Wan 3.0 had refused the same face both ways).
  // It is `atlascloud/wan-2.2-turbo/image-to-video`: the open weights on
  // Atlas's own GPUs (organization ATLASCLOUD), no Alibaba Model Studio in
  // front of it, which is why. Image-to-video ONLY: one picture (the first
  // frame, else the first reference picture) and the words — no other
  // references, no sound, no shape (the picture is the shape), and FIVE
  // SECONDS ONLY (its schema's one enum). 2¢/s at 480p; the playground showed
  // 720p at 2x, so the ladder is 1 / 2 / 4.
  { id: 'wan-2.2', label: 'Wan 2.2 Turbo', or: null, af: null,
    atlas: 'atlascloud/wan-2.2-turbo/image-to-video',
    res: ['480p', '720p', '1080p'], secs: [5, 5], family: 'wan', sizes: '2.5', audioDefault: false,
    ratios: ['1:1', '3:4', '9:16', '4:3', '16:9'], resScale: { '480p': 1, '720p': 2, '1080p': 4 },
    atlasCaps: { image: 1, video: 0, audio: 0 },
    atlasCents: { '480p': 2, '720p': 2, '1080p': 2 } },
  // WAN 2.7 — Alibaba-hosted (Model Studio, the same policy layer as 3.0, so
  // the face gate is EXPECTED and unmeasured here), reference-to-video with
  // ONE voice (`audio`, mp3/wav) and up to three videos; 720p and 1080p only
  // (no 480p), 10¢/s at 720p and the playground showed 1080p at 1.5x. Three
  // endpoints picked by the shape in atlascloud.js like 3.0's.
  { id: 'wan-2.7', label: 'Wan 2.7', or: null, af: null,
    atlas: 'alibaba/wan-2.7/reference-to-video',
    res: ['720p', '1080p'], secs: [2, 15], family: 'wan', sizes: '2.5',
    ratios: ['1:1', '3:4', '9:16', '4:3', '16:9'], resScale: { '720p': 1, '1080p': 1.5 },
    atlasCaps: { image: 3, video: 3, audio: 1 },
    atlasCents: { '720p': 10, '1080p': 10 } },
  // MINIMAX H3, THE STANDARD TIER — THE DOOR THAT SPEAKS A NEW LINE IN A
  // REAL PERSON'S VOICE (2026-09-17, Sophie: "add minimax model we're
  // using"). Measured that night on a famous face: the still and a 15s clip
  // of his own voice went in without a word, and the clip said the prompt's
  // line in that voice with the mouth matching (docs/wan-face-gate-2026-09-17.md).
  // The developer tier only replays the audio it is given and max takes no
  // voice at all, so this is the one tier on the page. Its resolutions are
  // MiniMax's own words — 480P and 768P, the SHORT side, so 768P is the one
  // to send (its "480P" is fewer pixels than Seedance's 480p) — spelled
  // lowercase on the page like every other row and put back into MiniMax's
  // capitals at the door (`atlasRes`). 5-15 whole seconds, every shape the
  // page offers, a mixed pile of pictures, videos and audios with no stated
  // cap (an audio alone is refused). 3.8¢/s list; MEASURED 40¢ for 5s at
  // 768P, i.e. 2.1x, so `resScale` carries that rather than a guess. No
  // sound flag: it always draws sound. The upscale is not this row's —
  // MiniMax has none on this tier; Atlas's own upscaler takes the finished
  // clip instead (the card's `upscale` button).
  { id: 'minimax', label: 'MiniMax H3', or: null, af: null,
    atlas: 'minimax/h3/reference-to-video',
    res: ['768p', '480p'], secs: [5, 15], family: 'minimax', sizes: '2.5',
    atlasRes: { '480p': '480P', '768p': '768P' }, resScale: { '480p': 1, '768p': 2.1 },
    atlasCaps: { image: 9, video: 9, audio: 9 },
    atlasCents: { '480p': 3.8, '768p': 3.8 } },
];
const RATIOS = ['1:1', '3:4', '9:16', '4:3', '16:9', '21:9'];
// The shapes ONE model takes — its own list when it has one, else the page's.
function ratiosOf(m) { return (m && Array.isArray(m.ratios) && m.ratios.length) ? m.ratios : RATIOS; }
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
  // COULD NOT READ IS NOT "IT IS ZERO" (2026-09-14, found auditing the
  // module). A throw answered 0 — full list — and `discounts()` wrote that
  // over a good figure wholesale, the asymmetry `atlasPrices()` was fixed for
  // on 2026-09-13: the door is chosen by price, so one flaky metadata read
  // made every OpenRouter row look up to 60% dearer for ten minutes and could
  // walk a job onto a genuinely dearer door. `null` here is "keep what you
  // had"; a real 0 read off the record still clears a stale sale.
  } catch { return null; }
}
async function discounts() {
  if (Date.now() - discCache.at < DISC_CACHE_MS && discCache.at) return discCache.val;
  const out = {};
  await Promise.all(MODELS.filter((m) => m.or).map(async (m) => {
    const d = await endpointDiscount(m.or);
    if (d != null) out[m.id] = d;
  }));
  discCache = { at: Date.now(), val: { ...discCache.val, ...out } };
  return discCache.val;
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
  // AND A PARTIAL READ KEEPS THE ROWS IT DID NOT ANSWER FOR (2026-09-13,
  // found auditing the module). The guard was `keys.length ? out : last`,
  // which protects an EMPTY answer and not an incomplete one — one row
  // missing from `GET /models`, or a `base_price` of 0, dropped that model to
  // the table's LIST rate for ten minutes, which since the door is chosen by
  // price is a door change as well as a figure: every Mini tap billed ~3x
  // (13.59c against 4.40c), silently. Merged onto the last good map instead.
  atlasCache = { at: Date.now(), val: Object.keys(out).length ? { ...atlasCache.val, ...out } : atlasCache.val };
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
// A RESOLUTION ITS OWN TABLE LACKS FALLS BACK TO THE FAMILY'S, NEVER TO 480p
// (2026-09-13, found auditing the module). 2.0 offers 1080p and was moved onto
// the 2.5 canvas table on 2026-09-12 (a real charge measured 560x752 rather
// than 480x640) — and the 2.5 table has NO 1080p row, so `fam[res] ||
// fam['480p']` priced every 1080p clip off the 480p canvas: a 4s 2.0 1080p
// 16:9 clip quoted ~30c against a real ~151c, and read CHEAPER than the same
// clip at 720p. 2.0 is the one row that offers 1080p and only OpenRouter can
// take it, which bills on the real canvas. The family table has the row, so
// that is the fallback; `canvasFrom` says where the answer came from, and a
// price built on a borrowed canvas can never answer `exact`.
function canvasFrom(m, res) {
  const own = SIZES[m.sizes || m.family];
  if (own && own[res]) return 'own';
  const fam = SIZES[m.family];
  if (fam && fam[res]) return 'family';
  return 'floor';
}
function canvasOf(m, res, ratio) {
  const own = SIZES[m.sizes || m.family] || SIZES['2.0'];
  const fam = SIZES[m.family] || SIZES['2.0'];
  const byRes = own[res] || fam[res] || own['480p'] || fam['480p'];
  return byRes[ratio] || byRes['1:1'];
}
// How much dearer a resolution is than 480p ON THIS SHAPE — the pixel ratio
// of the two canvases, which IS the token ratio (tokens = w*h*(24s+1)/1024,
// proven to the token against the log). Used to scale Atlas's flat
// per-second rate, which is a 480p rate. 1:1 at 480p vs 720p on the 2.5
// table is 640x640 -> 960x960 = 2.25x; 16:9 is 854x480 -> 1280x720 = 2.248x.
function resFactor(m, res, ratio) {
  // A ROW WITH ITS OWN LADDER (Wan: Alibaba's 1 / 2 / 4) is not a canvas
  // question — its per-second rate is the published one per resolution.
  if (m.resScale) return m.resScale[res] != null ? m.resScale[res] : 1;
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
// AND ATLAS HAS CAPS OF ITS OWN, WHICH THIS DID NOT MODEL (2026-09-14, from
// the audit): at most 9 reference images, 3 videos and 3 audios, and a
// reference audio needs at least one picture or video beside it
// (atlascloud.js's own numbers, which are Atlas's). It refuses on the POST,
// free — but AUTO ranks Atlas FIRST for Mini and Fast on its sale, so a
// ten-picture job went to the one door that must refuse it and the page
// offered no other. The counts ride the shape when the caller knows them; a
// caller that only says `hasRefs` behaves exactly as before, which is the
// safe direction — never refuse a door for a cap that cannot be seen.
// OpenRouter's and APIFRAME's own caps are UNMEASURED and are not modelled.
const ATLAS_CAPS = { image: 9, video: 3, audio: 3 };
// THE CAPS ARE PER MODEL ON THIS DOOR — Seedance's 9/3/3 unless the row
// carries its own (`atlasCaps`; Wan 3.0 is 10/5/5). `m` is optional: a
// caller that names no model gets Seedance's, exactly as before.
function atlasCapsOf(m) { return (m && m.atlasCaps) || ATLAS_CAPS; }
function atlasCapRefusal({ images, videos, audios }, m) {
  const caps = atlasCapsOf(m);
  if (images > caps.image) return `Atlas Cloud takes at most ${caps.image} reference images`;
  if (videos > caps.video) return `Atlas Cloud takes at most ${caps.video} reference videos`;
  if (audios > caps.audio) return `Atlas Cloud takes at most ${caps.audio} reference audios`;
  if (audios > 0 && !images && !videos) return 'a reference audio needs at least one reference image or video beside it';
  return '';
}
function doorTakes(door, shape, m) {
  const { hasFirstFrame, hasLastFrame, hasRefs } = shape;
  if (door === 'atlascloud' && atlasCapRefusal(countsOf(shape), m)) return false;
  if (!hasFirstFrame && !hasLastFrame) return true;
  if (door === 'apiframe') return true;
  if (hasRefs) return false;
  if (door === 'atlascloud') return Boolean(hasFirstFrame);
  return true;
}
// The counts a shape carries, or ZERO where it says nothing — so a cap can
// only ever be broken by a number the caller really gave.
function countsOf({ images, videos, audios }) {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return { images: n(images), videos: n(videos), audios: n(audios) };
}
// The line she reads when a keyframe leaves no door open — plain, and it
// names what to change rather than what is wrong.
function shapeRefusal(shape, m) {
  const { hasFirstFrame, hasLastFrame, hasRefs } = shape;
  // A CAP IS THE LOUDEST REASON WHEN ONE IS BROKEN — "no door is configured"
  // would send her looking at env vars for a ten-picture job.
  const cap = atlasCapRefusal(countsOf(shape), m);
  if (cap) return `${cap} — and it is the only door open for that job. Take one off.`;
  if (hasRefs && (hasFirstFrame || hasLastFrame)) {
    return 'A first frame and references cannot ride one job — only APIFRAME takes both, and it is not open for that. Take the references off, or take the first frame off.';
  }
  if (hasLastFrame && !hasFirstFrame) return 'A last frame needs a first frame beside it on the doors that are open — mark the frame the clip starts on.';
  return 'no door is configured for that';
}

function doorFor({ model, door, hasVideo, resolution, ratio, seconds, avoid, hasFirstFrame, hasLastFrame, hasRefs, images, videos, audios }, cfg) {
  const m = typeof model === 'string' ? modelOf(model) : model;
  if (!m) return { error: 'unknown model' };
  cfg = cfg || { openrouter: true, apiframe: true, atlascloud: true };
  const want = String(door || 'auto').toLowerCase();
  // the same normalisation `estimate` and `buildJob` apply — a rung the model
  // does not offer used to fail every door here and blame the configuration
  const res = m.res.includes(resolution) ? resolution : m.res[0];
  const shape = { hasFirstFrame: Boolean(hasFirstFrame), hasLastFrame: Boolean(hasLastFrame), hasRefs: Boolean(hasRefs), ...countsOf({ images, videos, audios }) };
  const orOk = Boolean(m.or) && cfg.openrouter && m.res.includes(res) && doorTakes('openrouter', shape, m);
  const afOk = Boolean(m.af) && cfg.apiframe && m.afCents && m.afCents[res] != null && doorTakes('apiframe', shape, m);
  const atOk = Boolean(m.atlas) && cfg.atlascloud && m.atlasCents && m.atlasCents[res] != null && doorTakes('atlascloud', shape, m);
  // A PINNED DOOR THAT CANNOT TAKE THE SHAPE SAYS SO IN THOSE TERMS — "it
  // does not offer that resolution" would be a wrong reason she then chases.
  const pinShape = (d) => (doorTakes(d, shape, m) ? null : { error: shapeRefusal(shape, m) });
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
    return { error: (shape.hasFirstFrame || shape.hasLastFrame || atlasCapRefusal(shape, m)) ? shapeRefusal(shape, m) : 'no door is configured for that' };
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
function estimate({ model, resolution, ratio, seconds, hasVideo, door, discount, hasFirstFrame, hasLastFrame, hasRefs, images, videos, audios }, cfg) {
  const m = typeof model === 'string' ? modelOf(model) : model;
  if (!m) return { error: 'unknown model' };
  const res = m.res.includes(resolution) ? resolution : m.res[0];
  const s = Number(seconds) || minSeconds(m);
  // THE SHAPE RIDES INTO THE RANKING — a keyframe narrows which doors can
  // take the job at all, and the price she reads has to be the price on the
  // door the tap will really go to. A keyframe costs nothing extra on any
  // door (Atlas prices image-to-video the same per second as
  // reference-to-video), so only the DOOR moves, never the rate.
  const d = doorFor({ model: m, door, hasVideo, resolution: res, ratio, seconds: s, hasFirstFrame, hasLastFrame, hasRefs, images, videos, audios }, cfg);
  if (d.error) return d;
  const p = priceOn(m, d.door, { res, ratio, seconds: s, hasVideo, discount });
  // THE RESOLVED SHAPE rides back beside the price — the caller asked with
  // whatever the controls said and these are what the tap will really be,
  // which is what the draw-time read has to key off (2026-09-12).
  return p.error ? p : { ...p, door: d.door, model: m.id, resolution: res, ratio: RATIOS.includes(ratio) ? ratio : '', seconds: s };
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
    // AND A BORROWED CANVAS IS NEVER PINNED — the row came out of another
    // table, so the shape is a reading rather than a measurement.
    const pinned = m.canvasMeasured && !hasVideo && canvasFrom(m, res) === 'own';
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
  // A `{n}` LEFT IN THE PROMPT REFUSES THE JOB (2026-09-14, from the audit).
  // A character's line is stored as a template over its own references and
  // resolved to slot names at the tap; a token that survives that means the
  // line names a reference which is NOT riding — a wardrobe whose look key
  // was renamed is the measured case — and the door reads `{2}` as words and
  // draws around it. So it is a shape refusal: free, before anything draws,
  // and it names what to fix. She never types these (she taps a character),
  // so this can only ever be that bug.
  const stray = prompt.match(/\{\d+\}/g);
  if (stray) return { error: `Your prompt still says ${[...new Set(stray)].join(' ')} — that is a reference a character's line names and nothing is riding for it. Re-tap the character, or take the token out.` };
  const m = modelOf(b.model || 'mini');
  if (!m) return { error: `unknown model "${b.model}"` };
  const res = m.res.includes(String(b.resolution)) ? String(b.resolution) : m.res[0];
  // A SHAPE THIS MODEL DOES NOT DRAW IS REFUSED, NEVER CLAMPED (Wan has no
  // 21:9): a clamp to 1:1 would draw a square she never asked for.
  if (b.ratio != null && RATIOS.includes(String(b.ratio)) && !ratiosOf(m).includes(String(b.ratio))) return { error: `${m.label} does not draw ${b.ratio} — pick another shape` };
  const ratio = RATIOS.includes(String(b.ratio)) ? String(b.ratio) : '1:1';
  const seconds = b.seconds == null ? minSeconds(m) : Number(b.seconds);
  if (!secondsOk(m, seconds)) return { error: `${m.label} takes ${m.id === '1.5' ? m.secs.join(', ') : m.secs[0] + '–' + m.secs[1]} seconds` };
  // THE TWO KEYFRAMES — one url each, and a url that is not in the strip is
  // still honoured (a chat sending a frame straight through). A picture
  // marked as a keyframe carries a `role` and leaves the reference lists: it
  // is the frame the clip starts or ends on, not something the prompt names.
  // A URL THIS MODULE WILL NOT SEND REFUSES THE JOB — IT IS NEVER DROPPED
  // (2026-09-13, found auditing the module). The reference filter below ran
  // BEFORE `slotsOf`, so a url failing the http test vanished and every slot
  // after it renumbered while her prompt went on naming the old numbers: the
  // clip drew, of the wrong picture. A keyframe was worse — a url that failed
  // the test simply stopped being a keyframe, so `roleOf` never matched it,
  // the picture she marked as the first frame rode as an ordinary slotted
  // reference, and the job went out references-only and drew something else
  // instead of being refused. Either way it is a shape refusal now.
  const badUrl = (u) => !!String(u || '') && !/^https?:\/\//.test(String(u));
  if (badUrl(b.firstFrameUrl) || badUrl(b.lastFrameUrl)) return { error: 'that keyframe is not a url the doors can fetch' };
  const bad = (Array.isArray(b.refs) ? b.refs : []).filter((r) => !r || badUrl(r.url) || !String((r && r.url) || ''));
  if (bad.length) return { error: bad.length === 1 ? 'one reference is not a url the doors can fetch' : `${bad.length} references are not urls the doors can fetch` };
  const kfFirst = b.firstFrameUrl ? String(b.firstFrameUrl) : '';
  const kfLast = b.lastFrameUrl ? String(b.lastFrameUrl) : '';
  if (kfFirst && kfLast && kfFirst === kfLast) return { error: 'one picture cannot be both the first frame and the last' };
  const roleOf = (u) => (u === kfFirst ? 'first' : u === kfLast ? 'last' : '');
  const refs = slotsOf((Array.isArray(b.refs) ? b.refs : [])
    .map((r) => ({ ...r, role: roleOf(String(r.url)) })))
    .map((r) => ({ url: String(r.url), kind: r.kind, slot: r.slot, poster: r.poster && !badUrl(r.poster) ? String(r.poster).slice(0, 500) : '', name: r.name ? String(r.name).slice(0, 80) : '',
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
  // AND WHICH STORY PART THIS IS (2026-09-14): the Story Timeline story's id,
  // the part's key (its first moment id) and the block's own words before the
  // heads. They ride the body the way `project` does, so the door files them
  // on the log doc and the block can walk its old prompts. A chat sending a
  // plain job carries none and nothing changes for it.
  const story = String(b.story || '').trim().slice(0, 300);
  if (story) body.story = story;
  const unit = story ? String(b.unit || '').trim().slice(0, 300) : '';
  if (unit) body.unit = unit;
  const words = story ? String(b.words || '').trim().slice(0, 4000) : '';
  if (words) body.words = words;
  // AND EVERY BLOCK'S OWN WORDS, EXACTLY AS THEY STOOD IN ITS BOX (2026-09-23,
  // Sophie: "sent/unsent is wrong in footage"). The red mark asks the log
  // whether a box's words have gone, and the log carried only `prompt` — the
  // text AFTER the page renumbered an appended block's slot names onto the
  // joined strip (block 3's `[Image1]` becomes `[Image4]`) and put the heads
  // in front. So the words in her box were never on the log for such a send,
  // and once the page's own 20-entry bank rolled off (or a put-back replaced
  // the draft, or she opened the page on another phone) the block read UNSENT
  // beside the clip it went in. One list, any send, story or not: the log
  // is the source of truth for the mark, whatever the prompt was made into.
  const blocks = (Array.isArray(b.blocks) ? b.blocks : [])
    .filter((t) => typeof t === 'string' && t.trim()).slice(0, 60).map((t) => t.slice(0, 6000));
  if (blocks.length) body.blocks = blocks;
  return { body, refs, m, res, ratio, seconds, audio, first: kfFirst, last: kfLast };
}
function titleOf(prompt) {
  const t = String(prompt || '').replace(/\s+/g, ' ').trim();
  return t.length > 70 ? t.slice(0, 67).replace(/\s+\S*$/, '') + '…' : t;
}

// ─── Doors and balances ─────────────────────────────────────────────────
let doors = null;   // { openrouter, apiframe, atlascloud } — the three modules, handed in or required
const inflight = require('./inflight');

function getDoors() {
  if (doors) return doors;
  doors = { openrouter: require('./openrouter'), apiframe: require('./apiframe'), atlascloud: require('./atlascloud') };
  return doors;
}
// A DEPLOY PAUSE REACHES A SEND, NOT ONLY A DRAW (2026-09-14, Sophie: "make
// sure the deploy guard waits for footage sends"). server.js hands its own
// pause reader in, the doors' pattern — this module must not know how the
// Playground's pause is stored, only whether one is on right now.
let pausedHook = null;
function init(opts) {
  if (opts && (opts.openrouter || opts.apiframe || opts.atlascloud)) doors = { ...getDoors(), ...opts };
  if (opts && typeof opts.paused === 'function') pausedHook = opts.paused;
  if (opts && opts.coll) collOverride = opts.coll;
  if (opts && opts.watch !== false && process.env.RENDER_EXTERNAL_URL) armWatch();
}
function pausedNow() { try { return pausedHook ? pausedHook() : null; } catch { return null; } }
const PAUSED_WORDS = 'Paused for a server update — nothing was sent or charged. Tap again in about a minute.';
function cfg() {
  const d = getDoors();
  return { openrouter: Boolean(d.openrouter && d.openrouter.configured()), apiframe: Boolean(d.apiframe && d.apiframe.configured()),
    atlascloud: Boolean(d.atlascloud && d.atlascloud.configured()) };
}

let balCache = { at: 0, val: null };
async function balances() {
  if (Date.now() - balCache.at < BAL_CACHE_MS && balCache.val) return balCache.val;
  const c = cfg();
  // ATLAS HAS A BALANCE AFTER ALL (2026-09-12, Sophie: "I checked, and Atlas
  // Cloud does have a proper Billing Public API. I was wrong in my previous
  // answer") — `/public/v1/balance`, a different prefix from the generation
  // api, read through atlascloud.js's own route. This line said "publishes no
  // balance endpoint here" and was wrong.
  // A DOOR THAT DID NOT ANSWER KEEPS ITS LAST FIGURE (2026-09-14, found
  // auditing the module): one blip on one door blanked that balance on the
  // "?" card for the whole cache minute, and there is no `?fresh=` on /status
  // to get past it. `atlasPrices()`'s own rule, one read over.
  const last = balCache.val || {};
  const keep = (k, f) => (last[k] && last[k][f] != null ? last[k][f] : null);
  const out = { openrouter: { configured: c.openrouter, left: keep('openrouter', 'left') }, apiframe: { configured: c.apiframe, credits: keep('apiframe', 'credits') }, atlascloud: { configured: c.atlascloud, left: keep('atlascloud', 'left') } };
  const base = process.env.RENDER_EXTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
  const h = STUDIO_TOKEN ? { 'x-studio-token': STUDIO_TOKEN } : {};
  await Promise.all([
    c.openrouter ? fetch(base + '/api/openrouter/credits', { headers: h, agent: proxyAgent || undefined }).then((r) => r.json()).then((j) => { if (j && j.left != null) out.openrouter.left = Number(j.left); }).catch(() => {}) : null,
    c.apiframe ? fetch(base + '/api/apiframe/me', { headers: h, agent: proxyAgent || undefined }).then((r) => r.json()).then((j) => { if (j && j.team && j.team.credits != null) out.apiframe.credits = Number(j.team.credits); }).catch(() => {}) : null,
    c.atlascloud ? fetch(base + '/api/atlascloud/balance', { headers: h, agent: proxyAgent || undefined }).then((r) => r.json()).then((j) => { if (j && j.left != null) out.atlascloud.left = Number(j.left); }).catch(() => {}) : null,
  ]);
  balCache = { at: Date.now(), val: out };
  return out;
}

// ─── Firestore ──────────────────────────────────────────────────────────
function db() { return admin.firestore(); }
let collOverride = null;               // a test's in-memory collection (init({ coll }))
function coll() { return collOverride || db().collection(videoLog.COLL); }
function bucketOrNull() { try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; } }

// ONE reader of a doc's status — cardOf draws by it and trimPlan refuses by
// it, and two copies of that expression would let the card call a clip
// finished while the trim route called it unfinished.
// A JOB THE DOOR NEVER ANSWERS FOR STOPS BEING "DRAWING" (2026-09-13, found
// auditing the module). Nothing aged a job out: `pollOne` swallows every
// error, so a job whose poll always throws — an expired job id, a door
// outage at the wrong moment, an answer shape nothing maps — kept
// `status:'sent'`, which reads as `drawing` forever. That is not only a card
// saying "drawing… 4h 12m": `/jobs` reads the WHOLE collection (~500 docs)
// and the page re-arms every 7s while anything is drawing, so ONE stuck clip
// costs ~70 document reads a second for as long as the page is open — real
// money, for a clip that is already dead.
//
// It is DERIVED, never written: the doc is left exactly as the door left it,
// so a job that does land later is still the record the 1080p redo reads,
// and this only decides what the card says and whether the poll asks again.
const STALE_MS = 2 * 60 * 60 * 1000;      // two hours; the longest clip drew in ~4m
function staleJob(d) {
  const st = String((d && d.status) || 'sent').toLowerCase();
  if (st === 'completed' || st === 'failed' || st === 'cancelled' || st === 'expired') return false;
  const at = Date.parse((d && (d.sentAt || d.createdAt)) || '');
  return Number.isFinite(at) && Date.now() - at > STALE_MS;
}
function statusOf(d) {
  const st = String((d && d.status) || 'sent').toLowerCase();
  if (st === 'completed') return 'done';
  if (st === 'failed' || st === 'cancelled' || st === 'expired') return 'failed';
  if (staleJob(d)) return 'failed';
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
// A PART BAKING FOR OVER FIFTEEN MINUTES IS DEAD, NOT WORKING — the page's
// own rule (`BAKE_STALE_MS` in footage.html), kept equal here so the server
// re-bakes exactly the parts the card already calls "never finished".
const BAKE_STALE_MS = 15 * 60 * 1000;
function bakeStale(t, now) {
  if (!t || t.status !== 'baking') return false;
  const at = Date.parse(t.at || '');
  return Number.isFinite(at) && (now == null ? Date.now() : now) - at > BAKE_STALE_MS;
}
function trimCard(t) {
  return {
    start: Number(t.start) || 0, end: Number(t.end) || 0,
    seconds: Number(t.seconds) || Math.round(((Number(t.end) || 0) - (Number(t.start) || 0)) * 1000) / 1000,
    key: String(t.key || ''), status: String(t.status || ''), url: t.url || '', poster: t.poster || '', error: t.error || '',
    at: t.at || '',        // when it was cut — the page ages a `baking` part out by it (2026-09-14)
  };
}


// ─── HOW LONG THIS SHAPE USUALLY TAKES TO DRAW ──────────────────────────
// 2026-09-12, Sophie: "also make it say the average time it has taken for
// things to draw at that exact size and length, etc." The figure has been on
// every card since 2026-09-10 (`drewMs`, the DOOR's own latency, never
// sentAt→doneAt — which is when the poll noticed) and existed nowhere she
// could use it BEFORE a tap: a 15s 2.5 clip and a 4s Mini clip are minutes
// apart and the price line said nothing about it.
//
// IT IS THE MEDIAN, NOT THE MEAN, and that is the one deviation from her
// word worth naming: one clip that sat in a queue drags a mean minutes off
// what the next tap will really do, where the median is what "usually"
// means. The mean rides along on the answer, so nothing is hidden.
//
// THE LADDER IS EXACT FIRST, then loosened one fact at a time, and the
// answer SAYS which rung it came off (`basis`) with the count beside it —
// a number derived from one old clip of a different shape, presented as
// this shape's time, is the card lying. Nothing is drawn at all when the
// log has never done anything close (the Assets tab's silence rule).
const DRAW_CACHE_MS = 5 * 60 * 1000;
const DRAW_MAX = 1200;        // a bounded read of the newest clips
const DRAW_ENOUGH = 3;        // below this a rung is used only as a last resort
let drawCache = { at: 0, val: null };

// A DOOR'S MODEL ID BACK ONTO ITS ROW. Each door writes its own spelling,
// and ATLAS WRITES THE ENDPOINT IT REALLY USED — `…/image-to-video` for a
// keyframe job, and for Wan 3.0 `…/text-to-video` / `…/image-to-video` /
// `…/reference-to-video` by the shape (2026-09-17) — while the row carries
// only the reference-to-video id. So the suffix is folded before the match:
// a Wan text-to-video clip reads as the Wan row, and an Atlas keyframe clip
// as its own model rather than a raw string. `ours` also matches OUR id (a
// refusal footage files itself writes that).
function rowOfDoorModel(id, ours) {
  const s = String(id || '');
  const folded = s.replace(/\/(image|text)-to-video$/, '/reference-to-video');
  return MODELS.find((x) => (ours && x.id === s) || x.or === s || x.af === s || x.atlas === s || x.atlas === folded) || null;
}

function drawKeyOf(d) {
  // THE MODEL HAS TO BE THERE BEFORE IT IS MATCHED. A row on the table can
  // lack an `or` / `af` / `atlas` id, so `x.or === d.model` on a doc with NO
  // model matches undefined against undefined and buckets that clip under a
  // model it was never drawn on. (`cardOf` runs the same find with the same
  // shape; there a miss only mislabels one card, so it is left alone.)
  if (!d || !d.model) return null;
  const m = rowOfDoorModel(d.model, false);
  const p = d.params || {};
  const door = d.door || d.provider || '';
  const secs = p.duration != null ? Number(p.duration) : Number(d.seconds);
  const res = p.resolution || d.resolution || '';
  const ratio = p.aspect_ratio || d.ratio || d.aspect || '';
  if (!m || !Number.isFinite(secs) || !res) return null;
  return { door: String(door), model: m.id, res: String(res), ratio: String(ratio), seconds: secs };
}

function medianOf(list) {
  if (!list.length) return null;
  const a = list.slice().sort((x, y) => x - y);
  const mid = a.length >> 1;
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
}

// One read of the log, grouped every way the ladder asks about. Cached five
// minutes — the shape of the answer barely moves clip to clip, and the price
// line asks on every control change.
async function drawStats(fresh) {
  if (!fresh && drawCache.val && Date.now() - drawCache.at < DRAW_CACHE_MS) return drawCache.val;
  const buckets = new Map();
  const add = (k, ms) => { const cur = buckets.get(k); if (cur) cur.push(ms); else buckets.set(k, [ms]); };
  try {
    const snap = await coll().orderBy('sentAt', 'desc').limit(DRAW_MAX).get();
    snap.forEach((doc) => {
      const d = doc.data() || {};
      const ms = Number(d.drewMs);
      if (!Number.isFinite(ms) || ms <= 0) return;
      const k = drawKeyOf(d);
      if (!k) return;
      // a clip with NO ratio would land the exact key on the ratio key and
      // count twice — it has no "exact" rung to speak for
      if (k.ratio) add(`${k.door}|${k.model}|${k.res}|${k.ratio}|${k.seconds}`, ms);
      add(`${k.door}|${k.model}|${k.res}||${k.seconds}`, ms);
      add(`|${k.model}|${k.res}||${k.seconds}`, ms);
      add(`|${k.model}|||${k.seconds}`, ms);
    });
  } catch (e) { /* a missing log answers "no idea", never an error */ }
  const val = buckets;
  drawCache = { at: Date.now(), val };
  return val;
}

// The answer for one shape: { ms, mean, n, basis } or null.
function drawTimeFrom(buckets, { door, model, res, ratio, seconds }) {
  if (!buckets) return null;
  const rungs = [
    ['exact', `${door || ''}|${model}|${res}|${ratio}|${seconds}`],
    ['ratio', `${door || ''}|${model}|${res}||${seconds}`],
    ['door', `|${model}|${res}||${seconds}`],
    ['size', `|${model}|||${seconds}`],
  ];
  let fallback = null;
  for (const [basis, key] of rungs) {
    const list = buckets.get(key);
    if (!list || !list.length) continue;
    const answer = { ms: medianOf(list), mean: Math.round(list.reduce((a, b) => a + b, 0) / list.length), n: list.length, basis };
    if (list.length >= DRAW_ENOUGH) return answer;
    if (!fallback) fallback = answer;
  }
  return fallback;
}

async function drawTimeFor(shape) {
  const buckets = await drawStats().catch(() => null);
  return drawTimeFrom(buckets, shape);
}

// The card the page draws, off the log doc.
function whyOf(d) {
  if (!d) return '';
  // TWO HOURS WITH NO ANSWER IS A REASON TOO, and it is the one the card had
  // no words for: the clip said "drawing… 4h" and she could only guess.
  if (staleJob(d)) return 'The door never answered — nothing came back, so nothing drew. Your prompt and references are on the log; put them back and send it again.';
  if (String(d.status || '').toLowerCase() !== 'failed' || !d.error) return '';
  // THE CODE UNDER EITHER SPELLING (2026-09-13): the table carries a `code`
  // column and the reader asked only for `errorCode`, which nothing writes —
  // the doors' own field is `error_code`, so every code row was dead and an
  // unmatched wording showed raw door text with no line in her words.
  const e = videoRefusals.explain(d.error, d.errorCode != null ? d.errorCode : d.error_code, d.door || d.provider || '');
  return e && e.line ? e.line : '';
}
// ─── UPSCALE A FINISHED CLIP (2026-09-17, Sophie: "add upscale button to
// footage" · "can we upscale later if we like it · pipeline") ─────────────
// Atlas's own `atlascloud/video-upscaler` takes a finished clip's url and
// hands back a bigger one, sound and words untouched — so the pipeline is
// draw at 768P, keep what she likes, upscale only the keepers. It goes
// through the Atlas module's tool door (the same send, poll and log as a
// drawn clip), and the result is a NEW card on the feed beside the source,
// its poster baked by the ordinary poll. MEASURED: 5s to 2K in 35s for
// 14.4¢ (2.9¢/s), 1664x2216 from 768x1024. It ENLARGES; it does not put
// back detail the source's encode dropped — the card's "?" says so.
const UPSCALE_MODEL = 'atlascloud/video-upscaler';
const UPSCALE_CENTS_PER_SEC = { '2k': 2.9 };   // measured; 1080p unmeasured and not offered
function upscaleLabel(d) {
  if (!d || String(d.model || '') !== UPSCALE_MODEL) return '';
  const r = String((d.params && d.params.target_resolution) || d.upscale || '').toUpperCase();
  return r ? `Upscale ${r}` : 'Upscale';
}
// Pure: what an upscale of THIS clip would be, or why not. Never sends.
function upscalePlan(d, body) {
  body = body || {};
  if (!d) return { error: 'no such clip' };
  if (String(d.model || '') === UPSCALE_MODEL) return { error: 'that clip is already an upscale' };
  if (statusOf(d) !== 'done' || !d.video) return { error: 'the clip has to finish drawing first' };
  const resolution = String(body.resolution || '2k').toLowerCase();
  if (UPSCALE_CENTS_PER_SEC[resolution] == null) return { error: `upscale to ${Object.keys(UPSCALE_CENTS_PER_SEC).join(' or ')} — ${resolution} is not offered` };
  const p = d.params || {};
  const seconds = p.duration != null ? Number(p.duration) : (d.seconds != null ? Number(d.seconds) : null);
  const estimate = Number.isFinite(seconds) ? Math.round(seconds * UPSCALE_CENTS_PER_SEC[resolution] * 100) / 100 : null;
  return { source: d.video, resolution, seconds, estimate, aspect: p.aspect_ratio || d.aspect || '',
    title: `${resolution.toUpperCase()} · ${d.title || titleOf(d.prompt || '')}`.slice(0, 120) };
}

function cardOf(id, d) {
  // BY OUR OWN ID AS WELL AS THE DOORS' (2026-09-13). Each door writes its
  // own model id, which is what the three spellings match — and a refusal
  // footage files itself has no door, so it writes OURS. Without this row a
  // refused clip came back with `model` left as a raw string, and the page
  // gates its own "Try again" on `modelOf(j.model)`: a refused Fast or 2.5
  // scene put back from its own card silently drew on Mini.
  const m = rowOfDoorModel(d.model, true);
  const p = d.params || {};
  // THE PARTS RIDE BESIDE THE CLIP, NEVER OVER IT: `video` is what she
  // plays, saves and hands on (the first baked part once there is one),
  // `source` is always the clip the door drew, and `trims` is what the card
  // says. `trim` is still answered as the FIRST part, for a page cached from
  // before parts existed.
  const parts = trimsOf(d);
  const ready = parts.find((t) => t.status === 'ready' && t.url) || null;
  return {
    id, prompt: d.prompt || '', model: m ? m.id : (d.model || ''), modelLabel: m ? m.label : (upscaleLabel(d) || d.model || ''),
    door: d.door || d.provider || (d.model && String(d.model).startsWith('bytedance/') ? 'openrouter' : 'apiframe'),
    // an UPSCALE carries no duration of its own — the clip it was made from
    // does, and the route writes it on the doc (`seconds`)
    seconds: p.duration != null ? Number(p.duration) : (d.seconds != null ? Number(d.seconds) : null),
    resolution: p.resolution || p.target_resolution || '', ratio: p.aspect_ratio || d.aspect || '',
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
    // AN UPSCALE SAYS WHICH CLIP IT CAME FROM, and an upscaled clip is not
    // offered a second one (2026-09-17)
    parent: String(d.parent || ''), upscale: String(d.upscale || ''),
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
    // WHICH STORY PART SENT IT (2026-09-14) — a Story Timeline story id and the
    // part's key, and the block's own words before the heads; '' for a clip
    // sent from no story. The page's block walks its old prompts off these.
    story: String(d.story || ''), unit: String(d.unit || ''), words: String(d.words || ''),
    // EVERY BLOCK'S OWN WORDS as they stood in the box (2026-09-23) — what the
    // red sent mark matches, since the prompt may carry renumbered names
    blocks: Array.isArray(d.blocks) ? d.blocks.filter((t) => typeof t === 'string' && t) : [],
  };
}

// ─── Polling the unfinished ones, throttled ────────────────────────────
const lastPoll = new Map();   // job id → ms
const posterTried = new Set();   // clips whose missing poster this process has tried once to bake
async function pollOne(id, d, now) {
  now = now || Date.now();
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

// ── THE SERVER KEEPS ASKING WHILE SHE IS AWAY (2026-09-25, Sophie: "if i
// come back it says drawing 7 mins but it was only 2 mins · still doesn't
// show for like 12s") ──────────────────────────────────────────────────────
// A door is only ever asked when the PAGE asks the feed, and a wrapped page
// asks nothing while the app is in her pocket. So a clip that drew in two
// minutes was still "drawing" on the server at seven, the door was asked the
// moment she came back, and only THEN did the poster start baking — a
// download, one ffmpeg frame, an upload — so the tile sat blank for another
// dozen seconds while she watched. The server now asks on its own: every
// job this process sent is watched from the moment it is sent, and every
// five minutes the log is swept for unfinished jobs sent by anyone (a chat
// through `/api/atlascloud`, a job from before a deploy), so a clip is
// finished and its poster baked while she is away and the feed she comes
// back to is already right. Costs: one door read per watched job per 15s
// (free — the same read the page's poll makes) and one small status query
// per sweep; an idle tick with nothing watched reads nothing. Only where
// `RENDER_EXTERNAL_URL` is set, like the icon sweep, so a dev container or
// a test never asks a real door.
const WATCH_EVERY_MS = 15000, WATCH_SWEEP_MS = 5 * 60 * 1000;
const WATCH_STATUSES = ['sent', 'processing', 'pending', 'queued', 'starting'];
const watched = new Set();
let watchT = null, watchSweptAt = 0;
function watchJob(id) { if (id) watched.add(String(id)); }
function armWatch() {
  if (watchT) return;
  watchT = setTimeout(() => { watchT = null; watchTick().catch(() => {}).then(armWatch); }, WATCH_EVERY_MS);
  if (watchT.unref) watchT.unref();
}
async function sweepUnfinished() {
  const snap = await coll().where('status', 'in', WATCH_STATUSES).get();
  snap.docs.forEach((s) => { if (!staleJob(s.data())) watched.add(s.id); });
  return watched.size;
}
async function watchTick(now) {
  now = now || Date.now();
  if (now - watchSweptAt > WATCH_SWEEP_MS) { watchSweptAt = now; await sweepUnfinished().catch(() => {}); }
  await Promise.all(Array.from(watched).map(async (id) => {
    let d;
    try { const s = await coll().doc(id).get(); if (!s.exists) { watched.delete(id); return; } d = s.data(); }
    catch { return; }
    const st = statusOf(d);
    if (st !== 'drawing') {
      // finished (or given up on) — make sure its poster is on its way, then let go
      if (st === 'done' && d.video && !d.poster) bakePoster(id, d.video).catch(() => {});
      watched.delete(id);
      return;
    }
    await pollOne(id, d, now);           // writes the doc and bakes the poster itself
  }));
  return watched.size;
}

// A first frame for the card — the clip itself is 1-3MB and a <video> on iOS
// shows nothing until it plays. Best effort, never awaited by a response.
function ffmpegBin() {
  try { return require('ffmpeg-static'); } catch { return null; }
}
// THROUGH THE ONE-DECODE QUEUE (2026-09-14, found auditing the module). It
// registered with `inflight` and skipped `gateTrim`, so five clips finishing
// inside one poll window fetched and decoded five clips at once on the 512MB
// box — beside whatever trim the queue thought it had serialised.
async function bakePoster(id, videoUrl) { return gateTrim(() => bakePosterInner(id, videoUrl)); }

async function bakePosterInner(id, videoUrl) {
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
    shelfBust();                       // a tile's face just changed
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
  // A trim and a frame grab are free ffmpeg, but a bake the process dies
  // holding leaves its part saying "trimming…" for ever with its mp4 and
  // poster already in Storage — so they hold a deploy too.
  const run = () => inflight.track('footage-bake', fn);
  const next = trimQueue.then(run, run);
  trimQueue = next.catch(() => {});
  return next;
}

// What the FILE says about itself — how long it really is and whether it
// carries sound. The ask is not the answer: a clip is 24·s + 1 frames, so a
// 4s ask really runs 4.04s, and an out-mark she dragged to the end has to
// clamp to the file rather than fail against the ask.
//
// AND HOW FAST ITS FRAMES COME (2026-09-14): `fps` is the video stream's own
// rate (24 on every Seedance clip), 0 when the file will not say. `total`
// is the VIDEO's length when there is one — the format's duration is the
// longer of the two tracks, and the audio runs a few hundredths past the
// last frame, so an out-mark clamped to it would name a frame that is not
// there.
async function probeMedia(file) {
  const out = await runBin(ffprobeBin(), ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,avg_frame_rate,duration', '-of', 'json', file], 60000);
  const info = JSON.parse(out || '{}');
  const streams = info.streams || [];
  const video = streams.find((x) => x.codec_type === 'video');
  const m = /^(\d+)\/(\d+)$/.exec(String((video && video.avg_frame_rate) || ''));
  const fps = m && Number(m[2]) > 0 ? Number(m[1]) / Number(m[2]) : 0;
  const vdur = parseFloat((video && video.duration) || '0') || 0;
  return {
    total: vdur || parseFloat((info.format || {}).duration || '0') || 0,
    withAudio: streams.some((x) => x.codec_type === 'audio'),
    fps: Number.isFinite(fps) && fps > 0 ? fps : 0,
  };
}

// THE CUT LANDS ON THE FRAMES SHE CHOSE, NOT NEAR THEM (2026-09-14, Sophie:
// "trim ends a frame after the one i chose"). A mark is the player's
// `currentTime`, and the frame ON SCREEN at that time is the one whose
// timestamp is at or before it — floor(t × fps). ffmpeg's `trim` keeps the
// frames at or AFTER `start`, so unless her mark sat exactly on a frame
// boundary (it never does — a tenth-of-a-second step is 2.4 frames) the frame
// she was paused on was the first one dropped, and the part opened one frame
// late. So the span is snapped to FRAMES: the in-frame is the one under the
// start mark, the out-frame the one under the end mark, and BOTH are kept.
// The cut is asked for at the MIDPOINTS between frames — half a frame either
// side — so `chunkGraph`'s rounding to milliseconds (a frame is 41.7ms apart)
// can never land on the wrong side of a boundary, and the audio is cut to
// exactly `frames / fps`, the length of the picture it rides under.
// PURE: measured against a numbered-frame clip by test-footage-trim.js.
function frameSpan(start, end, fps, total) {
  if (!(fps > 0)) return { start, end, frames: 0, seconds: Math.round((end - start) * 1000) / 1000, snapped: false };
  const last = total > 0 ? Math.max(0, Math.round(total * fps) - 1) : Infinity;
  const eps = 1e-6;
  const a = Math.max(0, Math.floor(start * fps + eps));
  const b = Math.min(last, Math.max(a, Math.floor(end * fps + eps)));
  const frames = b - a + 1;
  return {
    start: Math.max(0, (a - 0.5) / fps),
    end: (b + 0.5) / fps,
    frames,
    seconds: Math.round((frames / fps) * 1000) / 1000,
    snapped: true,
  };
}

// ONE span out of one file, on disk. Kept apart from the Firestore/Storage
// bookkeeping around it so the CUT can be measured with a real file and
// ffprobe (`node scripts/test-footage-trim.js`) rather than reasoned about.
//
// EVERY SOURCE FRAME IS ONE OUTPUT FRAME (2026-09-14). `setpts` leaves the
// graph with no frame rate, so ffmpeg fell back to 25fps and RE-CADENCED a
// 24fps clip onto it — measured on her own baked part: 82 frames for 79,
// three of them duplicates — which is how the last frame of a part could be
// a frame she never chose. So the output is CFR at the SOURCE's own probed
// rate — the source is CFR, so nothing is duplicated or dropped and the file
// says 24 (measured: 80 frames in, 80 out, video and audio the same length).
// A file whose rate the probe cannot read keeps every frame's own timestamp
// instead (`passthrough`), which is one frame short of duration on the last
// frame but never a frame she did not choose.
//
// AND THE ENCODE IS CAPPED IN MEMORY — THE 512MB BOX HUNG ON A 720p TRIM
// (2026-09-15, Sophie: "can't upload references anymore!"). It was not the
// references: at 00:09 UTC she trimmed a 15s 720p 9:16 Mini clip, a minute
// later the box was pinned at 511-512MB and every request for the next
// sixteen minutes — uploads, the feed, the widget — died with a 499 until the
// service was restarted by hand. x264 with no thread cap allocates lookahead
// and reference frames PER THREAD, and the count comes off the HOST's cores,
// not the 0.5 vCPU the box has. Measured here on a 720x1280 clip: 215MB peak
// on 4 threads, 318MB with 16, 131MB with the cap below — beside a Node
// process that idles at 250-370MB. The Film Editor learned the same lesson on
// 2026-09-02 (`RENDER_CAP` in filmeditor.js); this is its cap, and the
// decoder is held to one thread too. `cutArgs` is PURE so the recipe is pinned
// by test-footage-trim.js rather than read back off the process.
const TRIM_CAP = ['-threads', '1', '-x264-params', 'rc-lookahead=10:ref=1'];
function cutArgs(src, out, start, end, withAudio, fps) {
  const graph = require('./clips').chunkGraph(start, end, withAudio);
  const args = ['-y', '-threads', '1', '-i', src, '-filter_complex', graph, '-map', '[v]'];
  if (withAudio) args.push('-map', '[a]', '-c:a', 'aac', '-b:a', '160k');
  if (fps > 0) args.push('-fps_mode', 'cfr', '-r', String(fps));
  else args.push('-fps_mode', 'passthrough');
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', ...TRIM_CAP, '-movflags', '+faststart', out);
  return args;
}
async function cutSpan(src, out, start, end, withAudio, fps) {
  await runBin(ffmpegBin(), cutArgs(src, out, start, end, withAudio, fps), TRIM_RUN_MS);
  return out;
}

// AND A BAKE THAT WOULD NOT FIT IS NOT STARTED (2026-09-15, the same hang).
// The cap above makes one encode ~131MB; what is left of the box is whatever
// Node is not holding, and Node drifts (367MB the minute before the hang,
// 467MB earlier that evening). A box over its limit does not crash — it
// THRASHES, at 10% CPU, for as long as nobody restarts it — so the honest
// answer is to wait for the room and then refuse, never to start and hope.
// Other work finishing (a draw, a sheet, a cut) gives memory back, so the
// wait is real; when it never comes the part says so on its card instead of
// "trimming…" for ever. PURE with its reader injected, for the test.
const BOX_MB = 512;
const TRIM_NEED_MB = 150;                 // the capped encode measured at 131MB
const TRIM_ROOM_WAIT_MS = 90000;
function trimRoom(rssBytes, need) {
  const free = BOX_MB - Math.round((Number(rssBytes) || 0) / 1048576);
  return { free, ok: free >= (need == null ? TRIM_NEED_MB : need) };
}
async function waitTrimRoom(o) {
  const rss = (o && o.rss) || (() => process.memoryUsage().rss);
  const wait = (o && o.wait) || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = (o && o.now) || Date.now;
  const cap = (o && o.ms) != null ? o.ms : TRIM_ROOM_WAIT_MS;
  const t0 = now();
  for (;;) {
    const r = trimRoom(rss());
    if (r.ok) return r;
    if (now() - t0 >= cap) return r;
    await wait(5000);
  }
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
    // the room check comes AFTER the baked-once read: a span already in
    // Storage costs no encode and needs no room
    const room = await waitTrimRoom();
    if (!room.ok) {
      return write({ status: 'failed', error: `the server is too full to trim right now (${room.free}MB free, a trim needs ${TRIM_NEED_MB}) — try again in a minute` });
    }
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
      const { total, withAudio, fps } = await probeMedia(src);
      const end = total ? Math.min(plan.end, Math.round(total * 1000) / 1000) : plan.end;
      if (total && plan.start >= total) return write({ status: 'failed', error: `the clip is ${total.toFixed(1)}s — the trim starts after it ends` });
      // her marks, snapped onto the frames under them (see `frameSpan`)
      const fr = frameSpan(plan.start, end, fps, total);
      if (fr.seconds < TRIM_MIN_SECONDS) {
        return write({ status: 'failed', error: `the clip is ${total.toFixed(1)}s — that leaves nothing to keep` });
      }

      await cutSpan(src, out, fr.start, fr.end, withAudio, fps);

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

      // `seconds` is the FILE's length — whole frames — and `end` stays her
      // mark (clamped), so the row's span puts her marks back where she set them
      return write({ status: 'ready', url: pub(plan.path), poster, seconds: fr.seconds, end });
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
      // one decode at a time, like every other ffmpeg on this box (2026-09-14)
      await gateTrim(() => runBin(bin, ['-y', '-i', src,
        '-vf', `scale=${plan.w}:${plan.h}:flags=lanczos`,
        '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
        '-c:a', 'copy', '-movflags', '+faststart', out]));
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
    // THE DOORS' OWN FIELD NAMES, NOT A SECOND SPELLING (2026-09-13, found
    // auditing the module). This wrote `ratio` where every door writes
    // `aspect_ratio`, so a refused clip came back from `cardOf` with NO ratio:
    // unsearchable by shape, and `clip-diff` reported `shape: '' -> 16:9`, a
    // change that never happened.
    duration: seconds, resolution: res, aspect_ratio: ratio,
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
    // AND THE MODEL ID, NEVER ITS LABEL. Every door writes its model id, so a
    // refusal filed as "2.0 Fast" missed `cardOf`'s `MODELS.find` — and the
    // page gates its own "Try again" on `modelOf(j.model)`, so a refused Fast
    // or 2.5 scene put back from its own card silently drew on MINI (the model
    // is deliberately not sticky, so after any reload that is what is showing).
    jobId: crypto.randomUUID(), prompt: body.prompt, model: (m && m.id) || '', params,
    tag: { chat: body.chat || CHAT, title: titleOf(body.prompt), project: body.project, folder: body.folder,
      story: body.story, unit: body.unit, words: body.words, blocks: body.blocks },
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

// A SEND IS THE ONE PIECE OF WORK ON THIS BOX THAT SPENDS HER MONEY BEFORE
// IT WRITES ANYTHING DOWN (2026-09-14). Between the tap and the door's answer
// the clip is charged and unrecorded — a restart there loses the prompt, the
// references and the money — so the whole of it is registered: the deploy
// guard holds, and SIGTERM holds, until the door has answered and the log
// doc exists.
async function startJob(b) { return inflight.track('footage-send', () => startJobInner(b)); }

async function startJobInner(b) {
  await discounts().catch(() => {});
  await atlasPrices().catch(() => {});
  const built = buildJob(b);
  if (built.error) { const e = new Error(built.error); e.status = 400; throw e; }
  const { body, refs, m, res, ratio, seconds, first, last } = built;
  // EVERY REFUSAL THIS MODULE RAISES ITSELF IS LOGGED TOO (2026-09-14, found
  // auditing the module — `logRefusal` was called from the door's catch and
  // nowhere else, so a shape refusal, the reference-video total and the PAUSE
  // left no trace; the pause is the worst of them, since it fires on a scene
  // she has just finished typing, and closing the page in that minute lost
  // the prompt). Best-effort, never in the way of the refusal itself.
  const refuse = async (message, refusal, door, status) => {
    const e = new Error(message); e.status = status || 400; e.refusal = refusal; e.why = message; if (door) e.door = door;
    await logRefusal({ body, refs, m, res, ratio, seconds, first, last, door: door || '', err: e }).catch(() => {});
    throw e;
  };
  // THE PAUSE IS CHECKED HERE, NOT ONLY ON THE ROUTE — `startJob` is exported
  // and a chat calling it in-process went straight through a deploy's swap
  // window (2026-09-14).
  if (pausedNow()) await refuse(PAUSED_WORDS, 'paused', '', 503);
  // A KEYFRAME NEVER COUNTS AS A REFERENCE VIDEO — it is a picture, and
  // `hasVideo` is what picks APIFRAME's dearer with-a-video rate.
  const hasVideo = refs.some((r) => r.kind === 'video' && !r.role);
  const plain = refs.filter((r) => !r.role);
  const shape = { hasFirstFrame: Boolean(first), hasLastFrame: Boolean(last), hasRefs: plain.length > 0,
    images: plain.filter((r) => r.kind === 'image').length,
    videos: plain.filter((r) => r.kind === 'video').length,
    audios: plain.filter((r) => r.kind === 'audio').length };
  let d = doorFor({ model: m, door: b.door, hasVideo, resolution: res, ratio, seconds, ...shape }, cfg());
  if (d.error) await refuse(d.error, (shape.hasFirstFrame || shape.hasLastFrame || atlasCapRefusal(shape)) ? 'shape' : undefined);
  // A reference under ByteDance's pixel floor is refused before anything
  // draws, so swap in an upscaled copy BEFORE the door sees the body — and
  // keep `refs` (the card) pointing at her originals.
  body.__names = Object.fromEntries(refs.filter((r) => r.kind === 'video').map((r) => [r.url, r.name]));
  const floored = await floorRefs(body);
  delete body.__names;
  body.referenceVideoUrls = floored.urls;
  let over = refVideoTotalRefusal(floored.seconds, d.door);
  // ATLAS'S 15.2s CAP IS ATLAS'S ALONE, and AUTO ranks Atlas first for Mini and
  // Fast on its sale — so a Mini job with a 12s and a 4s reference was refused
  // outright while OpenRouter and APIFRAME were both open and neither is known
  // to have the cap (2026-09-14, found auditing the module). On AUTO the job
  // walks to the next-cheapest door that takes its shape and the card says so;
  // a PINNED door still refuses, as every pinned door does.
  let walked = '';
  if (over && String(b.door || 'auto').toLowerCase() === 'auto') {
    const alt = doorFor({ model: m, door: 'auto', hasVideo, resolution: res, ratio, seconds, ...shape, avoid: ['atlascloud'] }, cfg());
    if (!alt.error && alt.door) { d = alt; walked = `Sent through ${DOOR_WORDS[alt.door] || alt.door} — Atlas takes ${videoRefusals.REF_VIDEO_TOTAL_MAX}s of reference video at most for one job.`; over = ''; }
  }
  if (over) await refuse(over, 'shape', d.door);
  const est = estimate({ model: m, resolution: res, ratio, seconds, hasVideo, door: d.door, ...shape }, cfg());
  const extra = { door: d.door, refs, estimate: est.cents != null ? est.cents : null, footage: true, aspect: ratio };
  const notes = floored.notes.concat(walked ? [walked] : []);
  if (notes.length) extra.note = notes.join(' ');
  if (body.project) extra.project = body.project;
  if (body.folder) extra.folder = body.folder;
  // the story part rides onto the doc through `extra` exactly as the project
  // does — the doors' own tag whitelist only knows the keys it was built with
  if (body.story) extra.story = body.story;
  if (body.unit) extra.unit = body.unit;
  if (body.words) extra.words = body.words;
  if (body.blocks) extra.blocks = body.blocks;
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
    ...(d.door === 'atlascloud' ? { returnLastFrame: true } : {}),
    // a row whose door spells its resolutions its own way (MiniMax's 768P)
    ...(d.door === 'atlascloud' && m.atlasRes && m.atlasRes[res] ? { resolution: m.atlasRes[res] } : {}) };
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
  // A DOOR THAT DREW BUT COULD NOT FILE THE JOB SAYS SO (2026-09-14, found
  // auditing the module). Every door swallowed its log write's failure into a
  // console.warn and answered like a success, so footage answered 202 for a
  // clip with no doc: charged, drawing, and off every read — the poll, the
  // card after a reload, the 1080p-redo list. The door retries once itself;
  // when both writes fail the job id rides the note so it reaches the card
  // and a chat can backfill it (`scripts/apiframe-video-log-backfill.js`).
  const unfiled = r.logged === false ? `This clip is drawing but could not be filed on the log — job ${r.jobId} on ${DOOR_WORDS[d.door] || d.door}.` : '';
  watchJob(r.jobId);                   // the server keeps asking about it while she is away
  return { jobId: r.jobId, door: d.door, sent: r.sent || req, seed: Number.isFinite(seed) ? seed : null,
    fellBack: false, estimate: est.cents, note: [extra.note || '', unfiled].filter(Boolean).join(' '), logged: r.logged !== false };
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
    afCents: m.afCents || null, afVid: m.afVid || null, audioDefault: m.audioDefault !== false,
    ratios: ratiosOf(m), atlasCaps: atlasCapsOf(m) }));
}
router.get('/status', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const bal = await balances().catch(() => null);
  await discounts().catch(() => {});
  await atlasPrices().catch(() => {});
  // THE BALANCES RIDE ONLY WITH THE TOKEN (2026-09-14, found auditing the
  // module). /status is exempt from the gate so the page can paint its
  // controls before the token is in hand — the model table, the ratios and the
  // sizes are the public half; her three balances in dollars are not.
  const authed = !STUDIO_TOKEN || req.get('x-studio-token') === STUDIO_TOKEN || req.query.token === STUDIO_TOKEN;
  res.json({ ok: true, chat: CHAT, doors: cfg(), balances: authed ? bal : null, models: publicModels(), ratios: RATIOS, sizes: SIZES, fee: OR_FEE, handoffProjects: HANDOFF_PROJECTS });
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
    hasFirstFrame: q.first === '1', hasLastFrame: q.last === '1', hasRefs: q.refs === '1',
    images: q.imgs, videos: q.vids, audios: q.auds }, cfg());
  res.set('Cache-Control', 'no-store');
  if (e.error) return res.status(400).json({ error: e.error });
  // HOW LONG THIS SHAPE USUALLY TAKES (2026-09-12, her ask) rides the same
  // free read — the page asks on every control change, so the time and the
  // price can never be about two different jobs. `drew` is absent when the
  // log has never drawn anything close; the page says nothing then.
  const drew = await drawTimeFor({ door: e.door, model: e.model || q.model, res: e.resolution || q.res,
    ratio: e.ratio || q.ratio, seconds: Number(e.seconds != null ? e.seconds : q.seconds) }).catch(() => null);
  res.json({ ok: true, ...e, drew: drew || null });
});

// GET /spend?days= — what the doors have really charged, in dollars. Atlas
// Cloud is the only one with a spend api (2026-09-12, Sophie found it:
// `/public/v1/model-costs`); OpenRouter and APIFRAME publish a BALANCE and no
// history, so this answers Atlas's charges and says so. No argument answers
// TODAY. Free and cached five minutes in atlascloud.js.
//
// A DAY TOTAL IS EXACT WHERE A CLIP'S IS NOT — Atlas stamps no job id on a
// charge (measured 2026-09-11 off her exported history), so the page's
// per-tap figure stays an estimate wearing a `~` while this number does not.
router.get('/spend', async (req, res) => {
  const q = req.query || {};
  const base = process.env.RENDER_EXTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
  const h = STUDIO_TOKEN ? { 'x-studio-token': STUDIO_TOKEN } : {};
  const qs = new URLSearchParams();
  for (const k of ['days', 'start', 'end', 'model', 'type', 'group', 'fresh']) if (q[k]) qs.set(k, String(q[k]));
  try {
    const j = await fetch(base + '/api/atlascloud/spend' + (qs.toString() ? '?' + qs : ''), { headers: h, agent: proxyAgent || undefined }).then((r) => r.json());
    res.set('Cache-Control', 'no-store');
    if (!j || j.error) return res.status(502).json({ error: (j && j.error) || 'no answer', doors: ['atlascloud'] });
    res.json({ ok: true, ...j, doors: ['atlascloud'], note: 'Atlas Cloud only — OpenRouter and APIFRAME publish a balance, not a history' });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.post('/jobs', async (req, res) => {
  try {
    // A TAP IN THE SWAP WINDOW IS REFUSED, NOT DRAWN (2026-09-14). The deploy
    // guard pauses the box once it has decided to let the swap through, and
    // the old instance dies about a minute later — so a clip started here
    // would be charged at the door and lost with the process. The Playground
    // QUEUES its tap; a video job has no queue to stand in, so this says so
    // in her own words instead, and it is the one refusal that is not the
    // door's. It only ever reaches the OLD instance: the new one boots with
    // no pause at all, so the wait is seconds.
    // THE WORDS ARE THIS PAGE'S OWN, NEVER THE PAUSE NOTE. The Playground's
    // note says the tap "will draw on its own in about a minute", which is
    // true there and false here — nothing queues a video job — and a message
    // promising a clip that never comes is worse than no message.
    // (the check itself lives in `startJobInner` since 2026-09-14, so a chat
    // calling `startJob` in-process meets it too)
    const r = await startJob(req.body || {});
    balCache.at = 0;
    shelfBust();                       // a new clip is a new count on its tile
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
// A TIE ON `sentAt` IS BROKEN BY ID, BOTH IN THE SORT AND AT THE CURSOR
// (2026-09-14). Two clips sent in one millisecond — the All star's appended
// send and a chat's batch both do it — sorted in whatever order the read
// happened to hand them back, and a `before` cursor equal to the bottom
// clip's sentAt SKIPPED every other clip sharing it. `beforeId` names the
// clip the cursor stands on; a page cached from before this sends none and
// walks exactly as it did.
function pageJobs(all, { limit, before, beforeId, max } = {}) {
  const lim = Math.min(Number(limit) || 40, max || 200);
  const at = (x) => String(x.d.sentAt || '');
  const sorted = all.slice().sort((a, b) => at(b).localeCompare(at(a)) || String(b.id).localeCompare(String(a.id)));
  const bid = beforeId != null ? String(beforeId) : '';
  const under = before
    ? sorted.filter((x) => at(x) < String(before) || (bid && at(x) === String(before) && String(x.id) < bid))
    : sorted;
  const docs = under.slice(0, lim);
  return { docs, more: under.length > docs.length };
}

// ── THE FUNNEL IS ANSWERED BY THE SERVER, OVER THE WHOLE LOG (2026-09-26,
// Sophie: "filters ex trimmed shud always load a set number not by a set
// date") ────────────────────────────────────────────────────────────────
// The page's funnel (model · resolution · when · trimmed) and its ♥/✕ ran
// over the loaded page only — the newest 40 — so "Trimmed" showed the
// trimmed clips among about half a day's sends rather than forty trimmed
// clips, and `… older` walked the UNFILTERED log underneath. The search's
// own lesson (2026-09-11), arriving through a chip: a filter over a
// truncated page is a filter over a date. So the funnel rides the query,
// the whole collection the route already holds is narrowed here BEFORE the
// page is cut, and a page is a set number of MATCHES, with `… older`
// walking the matches. The page keeps its own copy of the rule for the
// cards it already holds. Pure, so the page's exact reading is testable:
//   model=mini,2.5   res=480p,2k   since=<ms floor>   trim=trimmed|whole
//   liked=1 (hearts only)   hidex=1 (drop the crossed-out)
// Nothing on the query → `on:false` and every card keeps, so a page cached
// from before this sends nothing and reads exactly as it did.
function feedFilter(q) {
  q = q || {};
  const list = (v) => String(v || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const models = list(q.model), res = list(q.res);
  const since = Number(q.since) || 0;
  const trim = q.trim === 'trimmed' || q.trim === 'whole' ? q.trim : '';
  const liked = String(q.liked || '') === '1', hidex = String(q.hidex || '') === '1';
  const on = !!(models.length || res.length || since || trim || liked || hidex);
  const keep = (c) => {
    if (!on) return true;
    if (models.length && models.indexOf(String(c.model || '').toLowerCase()) < 0) return false;
    // the rung is case-folded — MiniMax files `480P` (the page's own note)
    if (res.length && res.indexOf(String(c.resolution || '').trim().toLowerCase()) < 0) return false;
    if (since && !(Date.parse(c.sentAt || '') >= since)) return false;
    if (trim) {
      // ONE rule for "trimmed" — a part that really baked, the page's
      // `bakedParts`; a part still baking has cut nothing yet
      const baked = (c.trims || []).filter((t) => t && t.status === 'ready' && t.url).length > 0;
      if (baked !== (trim === 'trimmed')) return false;
    }
    if (liked && c.vote !== 'like') return false;
    if (hidex && c.vote === 'dislike') return false;
    return true;
  };
  return { on, keep, models, res, since, trim, liked, hidex };
}

// HOW MANY MATCHES ARE OUTSIDE THE PROJECT SHE IS STANDING IN (2026-09-15,
// Sophie, inside "Secretly a Witch" with `cider` typed and "Nothing matches
// that." under it: "where r the rest of my clips???"). Measured that morning:
// 90 of her 500 clips carry NO project at all — 53 of them sent the day
// before, the Christmas commercial she was searching for — because the
// project stamps at SEND time and she was in All when she sent them. The
// project narrows the feed AND the search, and from down at the feed it is a
// filter she cannot see, so the page reported an empty library rather than a
// narrowed one. The narrowing stays — a project is what she asked the picker
// for — and this is the number that says the clips exist and are one tap
// away. Pure, so it has a test that needs no Firestore.
// A HIDDEN CLIP IS NOT "ELSEWHERE": `hidden` is this page's delete, and a
// count promising clips the feed would never draw would send her to All to
// find nothing. Tucked films ARE counted — a search is her asking for
// something by name, the route's own carve-out.
function outsideCount(rows, { project, folder, hit }) {
  if (!project) return 0;
  return rows.filter((x) => !x.d.hidden
    && !(projectSlug(x.d.project) === project && (!folder || folderSlug(x.d.folder) === folder))
    && hit(x)).length;
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
    // ONE STORY'S CLIPS, AND ONE PART'S (2026-09-14, "next and back to see old
    // prompts") — filtered over the whole log before the page is cut, like the
    // project, so a block's history reaches every prompt ever sent for that
    // part and not the forty newest clips. Asking for a story is asking by
    // name, so a tucked project does not narrow it (the search's own rule).
    const story = String(req.query.story || '').trim().slice(0, 300);
    const unit = story ? String(req.query.unit || '').trim().slice(0, 300) : '';
    if (story) all = all.filter((x) => String(x.d.story || '') === story && (!unit || String(x.d.unit || '') === unit));
    // A TUCKED PROJECT IS LEFT OUT OF ALL (2026-09-13, Sophie: "can u hide
    // the ward, the boyfriend one and the pee wheel ones if i'm not in those
    // folders"). Measured that morning: ward alone is 220 of her 506 clips,
    // so All was mostly one film and everything else was scrolled past. The
    // flag lives on the cast shelf's films doc — ONE vocabulary, the same one
    // the picker draws — and it narrows NOTHING but this view: asking for
    // that project shows every clip in it, and a SEARCH reaches the whole log
    // whatever is tucked (a search is her asking for something by name — the
    // ALL tab's own carve-out for the bug-fix pile).
    const tucked = (!project && !story && !String(req.query.q || '').trim()) ? await cast.tuckedFilms() : [];
    // THE SHELF'S SLUG IS 60 CHARACTERS AND THIS PAGE'S IS 40 (2026-09-14) —
    // compared raw, a film with a long name could never be tucked
    const tuckedSlugs = tucked.map(projectSlug);
    if (tuckedSlugs.length) all = all.filter((x) => tuckedSlugs.indexOf(projectSlug(x.d.project)) < 0);
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
    // AND IT SAYS HOW MANY IT FOUND OUTSIDE THIS PROJECT (`outsideCount`) —
    // free, since the whole collection is already read and the matcher built
    let elsewhere = 0, hit = () => true;
    if (q) {
      // THE PROJECT'S NAME IS IN THE HAY HERE TOO (2026-09-14) — the page put
      // it in its own client-side pass and the server did not, so typing "the
      // ward" showed the loaded hits and then the server's answer blanked them
      const names = await cast.filmNames().catch(() => ({}));
      const groups = grammar.compileFeed(q);
      hit = (x) => {
        const c = cardOf(x.id, x.d);
        if (c.project && names[c.project]) c.projectName = names[c.project];
        return grammar.feedMatches(hayOf(c), groups);
      };
      all = all.filter(hit);
    }
    // THE FUNNEL, over the whole log and before the page is cut (2026-09-26)
    // — so a page is a set number of matches, never a date's worth
    const filt = feedFilter(req.query);
    if (filt.on) all = all.filter((x) => filt.keep(cardOf(x.id, x.d)));
    // the count outside the project is of clips the funnel would show too —
    // a number promising clips the feed would hide sends her to All for nothing
    if (q) elsewhere = outsideCount(rows, { project, folder, hit: (x) => hit(x) && filt.keep(cardOf(x.id, x.d)) });
    const { docs, more } = pageJobs(all, { limit: q ? Math.min(Number(req.query.limit) || 40, 300) : req.query.limit, before: req.query.before, beforeId: req.query.beforeId, max: q ? 300 : undefined });
    // ask the doors about the ones still drawing — throttled per job, so a
    // page polling every few seconds is one provider read per job per 12s
    await Promise.all(docs.map(async (x) => {
      const st = String(x.d.status || 'sent').toLowerCase();
      if (st !== 'sent' && st !== 'processing' && st !== 'pending' && st !== 'queued' && st !== 'starting') return;
      if (staleJob(x.d)) return;          // two hours with no answer: stop asking

      const r = await pollOne(x.id, x.d);
      if (r && r.patch) Object.assign(x.d, r.patch, r.video ? { video: r.video } : {});
    }));
    // A POSTER THAT MISSED ITS ONE CHANCE IS TRIED AGAIN (2026-09-14, found
    // auditing the module). The bake fired from the poll that wrote
    // `completed`, and a finished doc is never polled again — so one Storage
    // hiccup left a clip with a video and no poster for ever: a blank tile,
    // nothing saying why. Once per process per clip, behind the answer.
    docs.forEach((x) => {
      if (statusOf(x.d) !== 'done' || !x.d.video || x.d.poster || posterTried.has(x.id)) return;
      posterTried.add(x.id);
      bakePoster(x.id, x.d.video).catch(() => {});
    });
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, jobs: docs.map((x) => cardOf(x.id, x.d)), more, folders, elsewhere });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── HAVE THESE WORDS GONE? — the WHOLE log, for the red SENT / UNSENT
// (2026-09-16, Sophie: "sent/unsent seems to be wrong or backwards") ──────
// The page's three sources for the mark all had a window: the local bank
// keeps the last 20 sends, a story part's `hist` needs a part, and the feed
// index reads the forty clips on screen. Measured on her screen that night:
// block 2 and block 4 had gone out inside twelve longer clips over two days —
// and every one of those clips sat past the newest forty in ALL, so both read
// UNSENT beside a block 7 that had just gone. Three sources that each forget,
// and the log that never does was only ever read through the feed's window.
// So the page asks the log itself: every block's words in, and back comes the
// subset that a clip on the log really carried. THE MATCH IS THE PAGE'S OWN —
// a whole prompt, the block's own `words`, any of the clip's `blocks` (each
// block's box text as it stood, 2026-09-23 — an appended send renumbers a
// block's slot names into the prompt, so the prompt alone could never match
// that box again), or a contiguous run of the prompt's
// `\n\n` paragraphs — never a phrase floating inside one (a loose "contains"
// would read SENT off any clip that happened to say those words, and a false
// SENT is the direction that costs her a shot). A failed or refused clip is
// skipped, the bank's own rule. Pure and exported for the test; the route is
// one collection read, no model call, and it writes nothing.
const SENT_SEGS_MAX = 80;   // a prompt of more paragraphs than this counts whole, never by run
function normWords(t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); }
function sentAmong(rows, texts) {
  const want = Object.create(null);
  (Array.isArray(texts) ? texts : []).forEach((t) => { const n = normWords(t); if (n) want[n] = 1; });
  const hit = Object.create(null);
  let left = Object.keys(want).length;
  if (!left) return hit;
  const take = (n) => { if (n && want[n] && !hit[n]) { hit[n] = true; left -= 1; } };
  for (const x of rows) {
    if (left <= 0) break;
    const d = (x && x.d) || {};
    if (statusOf(d) === 'failed') continue;
    take(normWords(d.words));
    if (Array.isArray(d.blocks)) d.blocks.forEach((t) => take(normWords(t)));
    const raw = String(d.prompt || '');
    if (!raw) continue;
    take(normWords(raw));
    const segs = raw.split('\n\n');
    if (segs.length > SENT_SEGS_MAX) continue;
    for (let i = 0; i < segs.length && left > 0; i++) {
      let run = '';
      for (let m = i; m < segs.length; m++) {
        run = m === i ? segs[m] : run + '\n\n' + segs[m];
        take(normWords(run));
      }
    }
  }
  return hit;
}
router.post('/sent', async (req, res) => {
  try {
    const texts = (Array.isArray(req.body && req.body.texts) ? req.body.texts : []).slice(0, 60)
      .map((t) => String(t || '').slice(0, 6000));
    if (!texts.length) return res.json({ ok: true, sent: {} });
    const snap = await coll().get();
    const rows = snap.docs.map((d) => ({ id: d.id, d: d.data() }));
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, sent: sentAmong(rows, texts) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── THE POSTER SHEET'S FACES (2026-09-13, Sophie: "i like poster" · "more per
// row so all fit") ────────────────────────────────────────────────────────
// The picker is a sheet of poster TILES now, so every project and every
// folder needs a face and a count — and the page can derive neither: its feed
// is narrowed to the one project she is standing in, so it holds no clip from
// anywhere else. `shelfOf` is one pass over the same collection the /jobs read
// already walks, answered on its own route and asked when the SHEET OPENS
// rather than on the feed poll (17 urls on every poll is payload for nothing).
// Four rules, each about the tile not lying:
//   · THE FACE IS THE NEWEST CLIP THAT REALLY DREW — a poster exists only on a
//     finished one — so a folder's tile is the last thing she made in it.
//   · A HIDDEN CLIP FACES NOTHING AND IS COUNTED BY NOBODY: `hidden` is this
//     page's delete, and a tile wearing a clip she put away is the sheet
//     showing her something the feed will not.
//   · A PROJECT COUNTS EVERY CLIP IN IT, its folders included — the tile is
//     the door to the whole project, which is what picking it does.
//   · A FOLDER WITH NO FINISHED CLIP still gets a tile and a count, with no
//     face: the Assets tab's silence rule — an empty square says "nothing has
//     drawn in here yet", where another folder's picture would be a lie.
function shelfOf(rows) {
  const out = {};
  const bump = (k, d) => {
    const e = out[k] || (out[k] = { n: 0, poster: '', at: '' });
    e.n += 1;
    const at = String(d.sentAt || ''), poster = String(d.poster || '');
    if (poster && at >= e.at) { e.at = at; e.poster = poster; }
  };
  rows.forEach(({ d }) => {
    if (d.hidden) return;
    const p = projectSlug(d.project);
    if (!p) return;
    bump(p, d);
    const f = folderSlug(d.folder);
    if (f) bump(p + '/' + f, d);
  });
  Object.values(out).forEach((e) => { delete e.at; });
  return out;
}
const SHELF_MS = 60 * 1000;
let shelfCache = { at: 0, out: null };
// A MOVE, A HIDE, A SEND AND A POSTER ALL CHANGE A TILE (2026-09-14, found
// auditing the module): the minute-long cache served the old count and the
// old face right after each of them, on the sheet whose four rules are all
// about the tile not lying. Emptied by the writes, not by a clock.
function shelfBust() { shelfCache = { at: 0, out: shelfCache.out }; }
router.get('/shelf', async (req, res) => {
  try {
    if (!shelfCache.out || Date.now() - shelfCache.at > SHELF_MS || req.query.fresh) {
      const snap = await coll().get();
      const rows = snap.docs.map((d) => ({ id: d.id, d: d.data() }));
      shelfCache = { at: Date.now(), out: { shelf: shelfOf(rows), folders: foldersOf(rows) } };
    }
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, ...shelfCache.out });
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
    // ONE PROJECT, NOT THE WHOLE LOG REBUILT AS CARDS (2026-09-14, found
    // auditing the module): `kinOf` only ever looks at older clips in the same
    // project, and this read every doc and ran `cardOf` — a refusal-table walk
    // each — over all of them on every panel open. And it was the one whole-
    // collection read with no `hidden` filter, so the panel could diff against
    // a clip she had put away. `projectSlug` is applied to both sides, so a
    // clip filed under a raw spelling still finds its siblings.
    const own = await coll().doc(id).get();
    if (!own.exists) { res.status(404).json({ error: 'no such clip' }); return; }
    const j = cardOf(own.id, own.data());
    const snap = j.project ? await coll().where('project', '==', own.data().project).get() : await coll().get();
    const cards = snap.docs.filter((d) => !d.data().hidden || d.id === id).map((d) => cardOf(d.id, d.data()));
    if (!cards.some((c) => c.id === id)) cards.push(j);
    const k = clipDiff.kinOf(j, cards.filter((c) => !j.project || c.project === j.project));
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, job: k ? k.job : null, kin: k ? k.kin : false, back: k ? k.back : 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /jobs/:id/relatives — EVERY CLIP LIKE THIS ONE (2026-09-14, Sophie:
// "shows ALL clips with similar prompt, including parts of it"). `kinOf`
// above answers ONE clip and is a different question; this is the list she
// picks the other side off. Asked of the server rather than run over the
// page, for the reason the kin route exists: the feed holds the newest 40 of
// the view she is on, and the redo from three days ago is not on it.
// Same reads and the same rules as /kin — one project, never a clip she put
// away — and capped, since a long-running film's project is hundreds of clips.
router.get('/jobs/:id/relatives', async (req, res) => {
  try {
    const id = String(req.params.id);
    const own = await coll().doc(id).get();
    if (!own.exists) { res.status(404).json({ error: 'no such clip' }); return; }
    const j = cardOf(own.id, own.data());
    const snap = j.project ? await coll().where('project', '==', own.data().project).get() : await coll().get();
    const cards = snap.docs.filter((d) => !d.data().hidden && d.id !== id).map((d) => cardOf(d.id, d.data()));
    const list = clipDiff.relatives(j, cards, { limit: 40 });
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, list });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /jobs/:id — ONE CLIP, so the page can resolve something its own page
// no longer holds (2026-09-13, found auditing the page). The poll reads the
// newest 40 of the view she is on, so a clip she reached through `… older` or
// the search — and then trimmed — had its part stuck on `baking` for the life
// of the page: the card said "trimming…" with no end, the part's `save` never
// appeared, and the page went on re-reading the whole collection every seven
// seconds because it could never see that nothing was working any more. One
// doc, one read.
router.get('/jobs/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const doc = await coll().doc(id).get();
    if (!doc.exists) { res.status(404).json({ error: 'no such clip' }); return; }
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, job: cardOf(doc.id, doc.data()) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/jobs/:id/vote', async (req, res) => {
  try {
    const v = String((req.body && req.body.vote) || '');
    const vote = v === 'like' || v === 'dislike' ? v : '';
    // `update`, never `set(…, {merge})` — a merge on a wrong id CREATED a doc
    // holding only `{vote}`, which read as a clip drawing since forever at
    // the end of `… older` and could never age out (2026-09-14)
    await coll().doc(String(req.params.id)).update({ vote });
    res.json({ ok: true, vote });
  } catch (e) { if (e && e.code === 5) return res.status(404).json({ error: 'no such clip' }); res.status(500).json({ error: e.message }); }
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
    await coll().doc(String(req.params.id)).update({ project, folder });
    shelfBust();
    res.json({ ok: true, project, folder });
  } catch (e) { if (e && e.code === 5) return res.status(404).json({ error: 'no such clip' }); res.status(500).json({ error: e.message }); }
});
router.post('/jobs/:id/hide', async (req, res) => {
  try {
    const hidden = Boolean(req.body && req.body.hidden);
    await coll().doc(String(req.params.id)).update({ hidden });
    shelfBust();
    res.json({ ok: true, hidden });
  } catch (e) { if (e && e.code === 5) return res.status(404).json({ error: 'no such clip' }); res.status(500).json({ error: e.message }); }
});

// POST /jobs/:id/trim — the ONE door onto her parts, and every shape of it
// leaves the clip the door drew exactly as it was:
//   { start, end }            adds a part (the bake runs behind the answer)
//   { start, end, replace }   swaps one part's span for another, in place
//   { remove: <key> }         takes one part off
//   { clear: true }           takes them all off
// Free every way — ffmpeg on our own box, no model call, no door.
const TRIM_MAX_PARTS = 12;
// EVERY WRITE HERE IS PINNED TO THE READ IT WAS PLANNED FROM (2026-09-13,
// found auditing the module). The route read the doc, planned, and wrote the
// WHOLE `trims` list — so a bake landing its own `status:'ready'` between the
// two put that part back to `baking` for good: its mp4 and poster sit in
// Storage, the card says "trimming…" forever, and its save and play never
// appear, because `bakeTrim` has already returned and nothing will correct it.
// Two overlapping POSTs (two tabs, her phone and a chat) lost a part outright.
// One transaction per call, so the plan and the write see the same list.
const trimTx = (id, work) => db().runTransaction(async (tx) => {
  const ref = coll().doc(id);
  const snap = await tx.get(ref);
  if (!snap.exists) return { code: 404, error: 'no such clip' };
  const out = work(snap.data());
  if (out && out.write) tx.set(ref, out.write, { merge: true });
  return out;
});
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
      const r = await trimTx(id, (now) => {
        const live = trimsOf(now);
        const next = live.filter((t) => t.key !== gone);
        return { write: { trims: next, trim: admin.firestore.FieldValue.delete() },
          removed: live.length !== next.length, next, now };
      });
      if (r.code) return res.status(r.code).json({ error: r.error });
      return res.json({ ok: true, removed: r.removed, job: cardOf(id, { ...r.now, trims: r.next, trim: null }) });
    }
    const plan = trimPlan(d, body);
    if (plan.error) return res.status(400).json({ error: plan.error });
    // A part is content-addressed by its span, so cutting the SAME span twice
    // is one part, not two — and re-tapping a part that is already baked is a
    // no-op rather than a second encode of identical bytes.
    const replacing = body.replace ? String(body.replace) : '';
    const kept = replacing ? parts.filter((t) => t.key !== replacing) : parts;
    const already = kept.find((t) => t.key === plan.key);
    // A REPLACE ONTO A SPAN ANOTHER PART ALREADY HOLDS STILL WRITES (2026-09-14,
    // found auditing the module): this answered the shortened list and wrote
    // nothing, so the replaced part came straight back on the next poll — her
    // edit discarded and a part flickering in and out of the trimmer.
    // A PART THE PROCESS DIED HOLDING IS BAKED AGAIN ON THE NEXT TAP
    // (2026-09-15). The same span is the same key, so the no-op above used to
    // make a part stuck on `baking` — a deploy or a restart mid-encode, and
    // that day's hang — impossible to ever finish: every re-tap answered the
    // stuck list and started nothing. Past the page's own fifteen minutes
    // (`BAKE_STALE_MS`, which draws it as "never finished") a tap on that span
    // runs the bake again; it checks Storage first, so an mp4 that DID land
    // costs no encode, and its write patches the part by key as ever.
    if (already && !replacing) {
      if (bakeStale(already)) bakeTrim(id, plan).catch(() => {});
      return res.json({ ok: true, job: cardOf(id, { ...d, trims: kept, trim: null }) });
    }
    if (kept.length >= TRIM_MAX_PARTS) return res.status(400).json({ error: `that is ${TRIM_MAX_PARTS} parts already — take one off first` });
    const part = { start: plan.start, end: plan.end, seconds: plan.span, key: plan.key,
      source: plan.source, at: new Date().toISOString(), status: 'baking', url: '', poster: '', error: '' };
    // REPLACING KEEPS ITS PLACE IN THE ORDER — the parts are the order she
    // cut them and a nudged mark is the same part, not a new last one.
    // the list is RE-DERIVED inside the transaction, so a part that baked (or
    // was taken off) while this one was being planned is not written back over
    const r = await trimTx(id, (now) => {
      const live = trimsOf(now);
      const kept2 = replacing ? live.filter((t) => t.key !== replacing) : live;
      if (kept2.find((t) => t.key === plan.key)) {
        const shrank = replacing && live.length !== kept2.length;
        return { already: true, next: kept2, now, ...(shrank ? { write: { trims: kept2, trim: admin.firestore.FieldValue.delete() } } : {}) };
      }
      if (kept2.length >= TRIM_MAX_PARTS) return { code: 400, error: `that is ${TRIM_MAX_PARTS} parts already — take one off first` };
      const next2 = replacing && live.some((t) => t.key === replacing)
        ? live.map((t) => (t.key === replacing ? part : t))
        : kept2.concat([part]);
      return { write: { trims: next2, trim: admin.firestore.FieldValue.delete() }, next: next2, now };
    });
    if (r.code) return res.status(r.code).json({ error: r.error });
    if (r.already) {
      const stuck = r.next.find((t) => t.key === plan.key);
      if (bakeStale(stuck)) bakeTrim(id, plan).catch(() => {});
      return res.json({ ok: true, job: cardOf(id, { ...r.now, trims: r.next, trim: null }) });
    }
    bakeTrim(id, plan).catch(() => {});
    res.status(202).json({ ok: true, job: cardOf(id, { ...r.now, trims: r.next, trim: null }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /jobs/:id/upscale {resolution:'2k'} — a bigger copy of a finished
// clip, as a NEW card beside it (see UPSCALE above). 202 with the new card.
router.post('/jobs/:id/upscale', async (req, res) => {
  try {
    const id = String(req.params.id);
    const snap = await coll().doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: 'no such clip' });
    const d = snap.data();
    const plan = upscalePlan(d, req.body || {});
    if (plan.error) return res.status(400).json({ error: plan.error });
    if (pausedNow()) return res.status(503).json({ error: PAUSED_WORDS, refusal: 'paused' });
    const mod = getDoors().atlascloud;
    if (!mod || !mod.startVideo) return res.status(503).json({ error: 'Atlas Cloud is not configured (ATLASCLOUD_API_KEY)' });
    const body = { model: UPSCALE_MODEL, videoUrl: plan.source, resolution: plan.resolution, prompt: d.prompt || '',
      chat: CHAT, title: plan.title, session: req.body && req.body.session ? String(req.body.session).slice(0, 80) : undefined,
      project: projectSlug(d.project) || undefined, folder: projectSlug(d.project) ? folderSlug(d.folder) || undefined : undefined };
    const extra = { door: 'atlascloud', footage: true, refs: [], estimate: plan.estimate, aspect: plan.aspect,
      seconds: plan.seconds, parent: id, upscale: plan.resolution };
    if (body.project) extra.project = body.project;
    if (body.folder) extra.folder = body.folder;
    if (d.story) { extra.story = d.story; if (d.unit) extra.unit = d.unit; }
    const r = await mod.startVideo(body, extra);
    balCache.at = 0;
    shelfBust();
    const made = await coll().doc(r.jobId).get();
    res.status(202).json({ ok: true, jobId: r.jobId, job: cardOf(r.jobId, made.exists ? made.data() : { ...extra, model: UPSCALE_MODEL, prompt: d.prompt || '', status: 'sent', sentAt: new Date().toISOString(), params: r.params || {} }) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, refusal: e.refusal, hint: e.hint });
  }
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
  modelOf, rowOfDoorModel, doorFor, doorTakes, shapeRefusal, atlasCapRefusal, atlasCapsOf, ATLAS_CAPS, ratiosOf, estimate, priceOn, DOOR_LOOSENESS, DOOR_REFUSAL_FREE, DOOR_WORDS, pollOne, slotsOf, kindOf, buildJob, titleOf, cardOf, publicModels, canvasOf, resFactor, secondsOk, framesOf, projectSlug, HANDOFF_PROJECTS,
  discounts, discountOf, endpointDiscount, atlasPrices, atlasPerSecOf, atlasCacheBust,
  drawStats, drawTimeFor, drawTimeFrom, drawKeyOf, medianOf,
  startJob, bakePoster, watchJob, watchTick, sweepUnfinished, WATCH_EVERY_MS, WATCH_SWEEP_MS, WATCH_STATUSES, ensureVideoFloor, floorDecided, refVideoTotalRefusal, whyOf, pausedNow,
  canvasFrom, pageJobs, feedFilter, outsideCount, hayOf, foldersOf, shelfOf, folderSlug, statusOf, staleJob, STALE_MS, trimsOf, trimCard, trimPlan, bakeTrim, cutSpan, cutArgs, TRIM_CAP, frameSpan, probeMedia, gateTrim, TRIM_MIN_SECONDS, TRIM_MAX_PARTS, TRIM_FOLDER,
  trimRoom, waitTrimRoom, TRIM_NEED_MB, BOX_MB, bakeStale, BAKE_STALE_MS,
  framePlan, framePath, pullFrame, grabFrame, FRAME_FOLDER, FRAME_END_PAD,
  upscalePlan, upscaleLabel, UPSCALE_MODEL, UPSCALE_CENTS_PER_SEC,
  sentAmong, normWords, SENT_SEGS_MAX,
};
