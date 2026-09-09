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
// TWO DOORS, ONE LOG. The clip goes out through openrouter.js (ByteDance's
// own price) or apiframe.js (the door that accepts a person in a reference),
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
// `GET /status` carries the model table with its per-token and per-second
// figures, and the page computes "about N¢" from that. OpenRouter bills per
// VIDEO TOKEN — (w × h × 24 × seconds) / 1024 — at the SKU price OpenRouter
// publishes (read live 2026-09-09 off /api/openrouter/models), cheaper when a
// reference VIDEO rides, plus the ~5% credit top-up fee; ByteDance's sale on
// Mini/Fast is applied at billing time, so those two carry a measured `sale`
// factor (Mini: 5.4¢ measured against 7.6¢ list on a 480×480×4s job). APIFRAME
// is per second by resolution (its own catalogue, ~1¢ a credit). The REAL
// cost lands on the card when the job finishes (OpenRouter reports it; APIFRAME
// does not, so an APIFRAME card keeps the estimate, marked as one).
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
const videoLog = require('./video-log');

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
// `orVidTok` = the same with a reference video riding; `sale` = ByteDance's
// promo as measured at billing; `afCents` = APIFRAME cents per second by
// resolution (null = not offered / unpriced). `secs` = [min, max] or a list.
const MODELS = [
  { id: 'mini', label: '2.0 Mini', or: 'bytedance/seedance-2.0-mini', af: 'seedance-2-mini',
    res: ['480p', '720p'], secs: [4, 15], family: '2.0',
    orTok: { '480p': 3.5e-6, '720p': 3.5e-6 }, orVidTok: { '480p': 2.1e-6, '720p': 2.1e-6 }, sale: 0.72,
    afCents: { '480p': 4, '720p': 9 } },
  { id: 'fast', label: '2.0 Fast', or: 'bytedance/seedance-2.0-fast', af: 'seedance-2-fast',
    res: ['480p', '720p'], secs: [4, 15], family: '2.0',
    orTok: { '480p': 4.2e-6, '720p': 4.2e-6 }, orVidTok: { '480p': 2.475e-6, '720p': 2.475e-6 }, sale: 0.75,
    afCents: { '480p': 7, '720p': 16 } },
  { id: '2.0', label: '2.0', or: 'bytedance/seedance-2.0', af: 'seedance-2',
    res: ['480p', '720p', '1080p'], secs: [4, 15], family: '2.0',
    orTok: { '480p': 7e-6, '720p': 7e-6, '1080p': 7.7e-6 }, orVidTok: { '480p': 4.3e-6, '720p': 4.3e-6, '1080p': 4.7e-6 }, sale: 1,
    afCents: { '480p': 8, '720p': 18, '1080p': null } },
  { id: '2.5', label: '2.5', or: 'bytedance/seedance-2.5', af: 'seedance-2.5',
    res: ['480p', '720p'], secs: [4, 30], family: '2.5',
    orTok: { '480p': 1.07e-5, '720p': 1.07e-5 }, orVidTok: { '480p': 6.4e-6, '720p': 6.4e-6 }, sale: 1,
    afCents: { '480p': 13, '720p': 29 } },
  { id: '1.5', label: '1.5 Pro', or: null, af: 'seedance-1.5-pro',
    res: ['480p', '720p'], secs: [4, 8, 12], family: '2.0', audioDefault: false,
    afCents: { '480p': 1.5, '720p': 3.4 } },
];
const RATIOS = ['1:1', '3:4', '9:16', '4:3', '16:9', '21:9'];
// The canvas ByteDance renders for a shape at a resolution (OpenRouter's
// `supported_sizes`, read 2026-09-09) — what the token count is made of.
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
  const fam = SIZES[m.family] || SIZES['2.0'];
  const byRes = fam[res] || fam['480p'];
  return byRes[ratio] || byRes['1:1'];
}

// Which door a job goes through. Answers { door, fallback } — `fallback` is
// the door tried second when the first refuses for content. Or { error }.
function doorFor({ model, door, hasVideo, resolution }, cfg) {
  const m = typeof model === 'string' ? modelOf(model) : model;
  if (!m) return { error: 'unknown model' };
  cfg = cfg || { openrouter: true, apiframe: true };
  const want = String(door || 'auto').toLowerCase();
  const orOk = Boolean(m.or) && cfg.openrouter && m.res.includes(resolution || '480p');
  const afOk = Boolean(m.af) && cfg.apiframe && m.afCents && m.afCents[resolution || '480p'] != null;
  if (want === 'openrouter') return orOk ? { door: 'openrouter', fallback: null } : { error: m.or ? 'OpenRouter is not configured for that' : `${m.label} is only on APIFRAME` };
  if (want === 'apiframe') return afOk ? { door: 'apiframe', fallback: null } : { error: 'APIFRAME does not offer that' };
  if (orOk) return { door: 'openrouter', fallback: afOk ? 'apiframe' : null };
  if (afOk) return { door: 'apiframe', fallback: null };
  return { error: 'neither door is configured for that' };
}

// "about N¢" before the tap. Answers { cents, door, about:true } or { error }.
function estimate({ model, resolution, ratio, seconds, hasVideo, door }, cfg) {
  const m = typeof model === 'string' ? modelOf(model) : model;
  if (!m) return { error: 'unknown model' };
  const res = m.res.includes(resolution) ? resolution : m.res[0];
  const s = Number(seconds) || minSeconds(m);
  const d = doorFor({ model: m, door, hasVideo, resolution: res }, cfg);
  if (d.error) return d;
  if (d.door === 'openrouter') {
    const [w, h] = canvasOf(m, res, RATIOS.includes(ratio) ? ratio : '1:1');
    const tokens = (w * h * 24 * s) / 1024;
    const perTok = (hasVideo ? m.orVidTok : m.orTok)[res];
    const usd = tokens * perTok * (m.sale || 1) * OR_FEE;
    return { cents: Math.round(usd * 1000) / 10, door: 'openrouter', about: true };
  }
  const per = m.afCents[res];
  return { cents: Math.round(per * s * 10) / 10, door: 'apiframe', about: true };
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
  if (b.seed != null && b.seed !== '') body.seed = Number(b.seed);
  return { body, refs, m, res, ratio, seconds, audio };
}
function titleOf(prompt) {
  const t = String(prompt || '').replace(/\s+/g, ' ').trim();
  return t.length > 70 ? t.slice(0, 67).replace(/\s+\S*$/, '') + '…' : t;
}

// ─── Doors and balances ─────────────────────────────────────────────────
let doors = null;   // { openrouter, apiframe } — the two modules, handed in or required
function getDoors() {
  if (doors) return doors;
  doors = { openrouter: require('./openrouter'), apiframe: require('./apiframe') };
  return doors;
}
function init(opts) { if (opts && (opts.openrouter || opts.apiframe)) doors = { ...getDoors(), ...opts }; }
function cfg() {
  const d = getDoors();
  return { openrouter: Boolean(d.openrouter && d.openrouter.configured()), apiframe: Boolean(d.apiframe && d.apiframe.configured()) };
}

let balCache = { at: 0, val: null };
async function balances() {
  if (Date.now() - balCache.at < BAL_CACHE_MS && balCache.val) return balCache.val;
  const c = cfg();
  const out = { openrouter: { configured: c.openrouter, left: null }, apiframe: { configured: c.apiframe, credits: null } };
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
  const m = MODELS.find((x) => x.or === d.model || x.af === d.model) || null;
  const p = d.params || {};
  const st = String(d.status || 'sent').toLowerCase();
  return {
    id, prompt: d.prompt || '', model: m ? m.id : (d.model || ''), modelLabel: m ? m.label : (d.model || ''),
    door: d.door || d.provider || (d.model && String(d.model).startsWith('bytedance/') ? 'openrouter' : 'apiframe'),
    seconds: p.duration != null ? Number(p.duration) : null, resolution: p.resolution || '', ratio: p.aspect_ratio || '',
    sound: p.generate_audio !== false,
    refs: Array.isArray(d.refs) ? d.refs : slotsOf([
      ...((d.references && d.references.images) || []).map((url) => ({ url, kind: 'image' })),
      ...((d.references && d.references.videos) || []).map((url) => ({ url, kind: 'video' })),
      ...((d.references && d.references.audio) || []).map((url) => ({ url, kind: 'audio' })),
    ]),
    status: st === 'completed' ? 'done' : (st === 'failed' || st === 'cancelled' || st === 'expired') ? 'failed' : 'drawing',
    video: d.video || '', poster: d.poster || '',
    cost: d.cost != null ? Math.round(Number(d.cost) * 1000) / 10 : null, estimate: d.estimate != null ? Number(d.estimate) : null,
    sentAt: d.sentAt || '', doneAt: d.doneAt || '', error: d.error || '', note: d.note || '',
    vote: d.vote || '', hidden: Boolean(d.hidden), title: d.title || '',
  };
}

// ─── Polling the unfinished ones, throttled ────────────────────────────
const lastPoll = new Map();   // job id → ms
async function pollOne(id, d) {
  const now = Date.now();
  if (now - (lastPoll.get(id) || 0) < POLL_EVERY_MS) return null;
  lastPoll.set(id, now);
  const door = d.door || d.provider || 'apiframe';
  const mod = getDoors()[door === 'openrouter' ? 'openrouter' : 'apiframe'];
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

// ─── Starting a job: the door, the fallback, the log ───────────────────
// Answers { jobId, door, sent, fellBack } or throws with status/hint.
async function startJob(b) {
  const built = buildJob(b);
  if (built.error) { const e = new Error(built.error); e.status = 400; throw e; }
  const { body, refs, m, res, ratio, seconds } = built;
  const hasVideo = refs.some((r) => r.kind === 'video');
  const d = doorFor({ model: m, door: b.door, hasVideo, resolution: res }, cfg());
  if (d.error) { const e = new Error(d.error); e.status = 400; throw e; }
  const est = estimate({ model: m, resolution: res, ratio, seconds, hasVideo, door: d.door }, cfg());
  const extra = { door: d.door, refs, estimate: est.cents != null ? est.cents : null, footage: true, aspect: ratio };
  const mods = getDoors();
  const send = async (door, note) => {
    const mod = mods[door];
    const req = { ...body, model: door === 'openrouter' ? m.or : m.af };
    if (note) req.note = note;
    const r = await mod.startVideo(req, { ...extra, door, ...(note ? { note } : {}) });
    return { jobId: r.jobId, door, sent: r.sent || req };
  };
  try {
    const r = await send(d.door);
    return { ...r, fellBack: false, estimate: est.cents };
  } catch (e) {
    if (d.door === 'openrouter' && e.refusal === 'content' && d.fallback === 'apiframe') {
      const est2 = estimate({ model: m, resolution: res, ratio, seconds, hasVideo, door: 'apiframe' }, cfg());
      extra.estimate = est2.cents != null ? est2.cents : null;
      const note = 'OpenRouter refused a reference (a person in it) — sent through APIFRAME instead';
      const r = await send('apiframe', note);
      return { ...r, fellBack: true, estimate: est2.cents, note };
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
  return MODELS.map((m) => ({ id: m.id, label: m.label, openrouter: Boolean(m.or), apiframe: Boolean(m.af),
    res: m.res, secs: m.secs, family: m.family, orTok: m.orTok || null, orVidTok: m.orVidTok || null, sale: m.sale || 1,
    afCents: m.afCents || null, audioDefault: m.audioDefault !== false }));
}
router.get('/status', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const bal = await balances().catch(() => null);
  res.json({ ok: true, chat: CHAT, doors: cfg(), balances: bal, models: publicModels(), ratios: RATIOS, sizes: SIZES, fee: OR_FEE });
});

// GET /estimate?model=&res=&ratio=&seconds=&video=1&door= — "about N¢" for
// the controls as they stand. Free; the page asks on every change so it
// holds no copy of a price.
router.get('/estimate', (req, res) => {
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
    const snap = await coll().where('chat', '==', CHAT).get();
    const docs = snap.docs.map((d) => ({ id: d.id, d: d.data() }))
      .sort((a, b) => String(b.d.sentAt || '').localeCompare(String(a.d.sentAt || '')))
      .slice(0, limit);
    // ask the doors about the ones still drawing — throttled per job, so a
    // page polling every few seconds is one provider read per job per 12s
    await Promise.all(docs.map(async (x) => {
      const st = String(x.d.status || 'sent').toLowerCase();
      if (st !== 'sent' && st !== 'processing' && st !== 'pending' && st !== 'queued' && st !== 'starting') return;
      const r = await pollOne(x.id, x.d);
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
  modelOf, doorFor, estimate, slotsOf, kindOf, buildJob, titleOf, cardOf, publicModels, canvasOf, secondsOk,
  startJob, bakePoster,
};
