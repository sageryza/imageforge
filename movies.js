// movies.js — the Movie medium: type a story, get a finished movie.
//
// The pipeline (validated end-to-end in the July 2026 prototyping run):
//   1. GPT breaks the story into ~8-12 SELF-CONTAINED scenes (nothing implied
//      between scenes — the video model can't infer missing beats), deliberately
//      creating before/after panel PAIRS for key actions and carrying character
//      continuity tokens in every scene.
//   2. gpt-image-2 renders each scene panel (low/medium first as a cheap
//      storyboard; keepers re-render HIGH).
//   3. Replicate image-to-video per scene: wan-2.2-i2v-fast (draft tier,
//      ~$0.06/clip) or kling-v2.1 (quality tier). For same-shot panel pairs the
//      NEXT panel is passed as `last_image` so the model animates BETWEEN the
//      actual drawings — far stronger than prompt-only continuity.
//   4. "Dream mode": bridge clips over every hard cut — start = previous clip's
//      last frame, end = next scene's panel, prompt = one continuous PHYSICAL
//      action connecting them (num_frames 121, or the model lingers then leaps).
//   5. ffmpeg edits (trim / speed / freeze / fade — free, no regeneration) and
//      stitches everything into the movie.
//
// Self-contained module in the pipeline.js pattern: a router (mounted at
// /api/movies by server.js) + exported helpers. Per-movie state (story, scenes,
// prompts, panel/clip URLs, edit list) lives in Firestore so a movie can be
// reopened and re-edited later; falls back to an in-memory map without Firebase
// (local dev — state then dies with the process).
//
// The iOS app is the frontend for this medium — there is no public/movies.html.

const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const FormData = require('form-data');
const admin = require('firebase-admin');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';
// The dream breakdown (reading a recording, splitting it into separate dreams,
// and reconstructing each dream's true chronology) is smart work a small model
// can't do well, so it runs on Claude Opus. By explicit request there is NO
// fallback to a cheaper model: if ANTHROPIC_API_KEY is missing or the call
// fails, the breakdown errors and surfaces that to the app.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const DREAM_MODEL = process.env.DREAM_MODEL || 'claude-opus-4-8';
// The dream breakdown model — splits a recording into dreams + writes the beats
// and image descriptions. Experiment (July 2026): OpenAI's frontier gpt-5.6-sol
// does BOTH the splitting and the descriptions (its image model draws them). Set
// to a `claude-*` id to route the breakdown back through Anthropic instead.
const DREAM_BREAKDOWN_MODEL = process.env.DREAM_BREAKDOWN_MODEL || 'gpt-5.6-sol';
// Reasoning effort for the OpenAI breakdown ('none'|'low'|'medium'|'high').
// 'low' keeps the split/order/drift quality while cutting the breakdown from
// ~60s to ~30s, so the synchronous request survives on mobile / Render.
const DREAM_BREAKDOWN_EFFORT = process.env.DREAM_BREAKDOWN_EFFORT || 'low';
// Same access gate as the POD pipeline: when set, everything but GET /status
// requires the x-studio-token header. Generation costs real money.
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';

// ─── Out of the Movies tab: everything made here files into "My Creations" ──
// Sophie, Aug 2026: "there's no download button and they don't appear in my
// creations" — a clip she paid for lived only inside the movie that made it.
// The gallery lives in the OTHER Firebase project (membry), whose credential
// this module doesn't hold, so server.js hands the writer down at mount time:
// `movies.init({ fileCreation })`.
//
// Two rules, both deliberate. Every filing carries a POSTER (the panel the clip
// was animated from, or the still it started as) because a video creation has
// no frame the grid can decode — without one it tiles as a blank square. And
// every filing is best-effort and never awaited by the render: a gallery
// hiccup must not cost a clip that already exists and is already on screen.
let fileCreation = null;
function init(opts = {}) {
  if (typeof opts.fileCreation === 'function') fileCreation = opts.fileCreation;
}

// Fire-and-forget: file one finished video. Re-rolls file too — a superseded
// clip is history she may still want (the house rule is that she decides what
// is too much for her gallery, not us), and the writer de-dupes by url.
function fileVideoToCreations({ url, poster, prompt, type, model, quality }) {
  if (!fileCreation || !url || String(url).startsWith('data:')) return;
  Promise.resolve()
    .then(() => fileCreation({
      url,
      poster: poster && !String(poster).startsWith('data:') ? poster : null,
      type: type || 'clip',
      prompt: String(prompt || '').slice(0, 500),
      model: model || null,
      quality: quality || null,
      source: 'movies',
    }))
    .catch(err => console.warn('movies → My Creations failed:', err.message));
}

// ffmpeg / ffprobe: static binaries from npm so Render's stock Node image can
// stitch video, with a fall-back to system binaries (FFMPEG_PATH/FFPROBE_PATH
// env vars or anything on PATH). Defensive — without them generation still
// works, only editing/stitching/bridges are unavailable (status reports it).
function tryRequire(name) {
  try { return require(name); } catch (err) {
    console.warn(`movies: ${name} unavailable —`, err.message);
    return null;
  }
}
function firstOnPath(bin) {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const p = path.join(dir, bin);
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { /* keep looking */ }
  }
  return null;
}
const FFMPEG = process.env.FFMPEG_PATH || tryRequire('ffmpeg-static') || firstOnPath('ffmpeg');
const FFPROBE = process.env.FFPROBE_PATH || (tryRequire('ffprobe-static') || {}).path || firstOnPath('ffprobe');

// ─── Video models (versions validated live) ─────────────────────────
const VIDEO_MODELS = {
  draft: {
    name: 'wan-2.2-i2v-fast',
    version: '4eaf2b01d3bf70d8a2e00b219efeb7cb415855ad18b7dacdc4cae664a73a6eea',
    fps: 16, // interpolate_output:true → delivered at 30fps
    costPerClip: f => (f > 81 ? 0.08 : 0.06),
  },
  standard: {
    name: 'kling-v2.1 (720p)',
    version: 'daad218feb714b03e2a1ac445986aebb9d05243cd00da2af17be2e4049f48f69',
    costPerClip: d => (d >= 10 ? 0.50 : 0.25),
  },
  pro: {
    name: 'kling-v2.1 pro (1080p)',
    version: 'daad218feb714b03e2a1ac445986aebb9d05243cd00da2af17be2e4049f48f69',
    costPerClip: d => (d >= 10 ? 1.10 : 0.55),
  },
};

// Rough per-panel costs (gpt-image-2, 1024x1536) so the app can show chips.
// "sketch" = the 4-up contact-grid pass: one low render draws FOUR scene
// panels in a 2x2 grid, sliced into quadrants server-side (~$0.005/panel).
const PANEL_COST = { sketch: 0.005, low: 0.02, medium: 0.06, high: 0.25 };
// The square canvas, which the dream app draws on (docs/modules/pictures.md).
const SQUARE_COST = { low: 0.006, medium: 0.053, high: 0.211 };

// ─── Style registry ─────────────────────────────────────────────────
// Each movie renders in ONE of these styles (movie.style, default 'pencil').
// A style is one or more reference images (refs/, outside /public so never
// web-served) attached as pure STYLE references on every panel render, plus
// an optional palettePrompt appended to the prefix. Multi-ref supported —
// the prompt names however many style images are attached.
//   pencil — Sophie's hand-drawn diary-comic page (the original movie look).
//   flat   — the simple flat look from the snake film. Two candidate setups
//            (Sophie is picking): (a) flat-cool.png alone, no palette line
//            [CURRENT]; (b) flat-busy.png + the named cool palette below —
//            to switch, swap `files` to ['flat-busy.png'] and set
//            `palettePrompt: FLAT_COOL_PALETTE`.
// Disable all style refs with MOVIE_STYLE_REF=0 (text style lock fallback).
const FLAT_COOL_PALETTE =
  'Do NOT use a warm color palette — avoid yellows and oranges entirely; ' +
  'instead use a cool palette of lavender, mint green, powder blue and soft ' +
  'grey-pink. ';
const MOVIE_STYLES = {
  pencil: { label: 'Dreamy pencil', files: ['dream-mystery.jpg'], palettePrompt: '' },
  flat: { label: 'Simple flat', files: ['flat-cool.png'], palettePrompt: '' },
};
for (const [id, s] of Object.entries(MOVIE_STYLES)) {
  s.id = id;
  s.refs = [];
  if (process.env.MOVIE_STYLE_REF !== '0') {
    for (const f of s.files) {
      try { s.refs.push(fs.readFileSync(path.join(__dirname, 'refs', f))); }
      catch { console.warn(`movies: style "${id}" missing refs/${f}`); }
    }
  }
  if (s.refs.length) console.log(`movies: style "${id}" loaded (${s.refs.length} ref image${s.refs.length > 1 ? 's' : ''})`);
}

// The movie's style; an unknown/unloaded style falls back to pencil (and
// pencil without its ref falls through to the text style lock downstream).
function styleFor(movie) {
  const s = MOVIE_STYLES[movie?.style];
  return (s && s.refs.length) ? s : MOVIE_STYLES.pencil;
}

// Legacy single-ref handle — the dream + zine paths still render through the
// pencil page (hand-lettered captions are validated on it).
const styleRef = MOVIE_STYLES.pencil.refs[0] || null;

// A/B-tested against a trait-naming version: letting the model read the style
// off the image itself copies the ink texture more faithfully, but without
// the format guard it also copies the reference's SHAPE (caption boxes, the
// 4-panel grid). Hence: generic styling copy + explicit single-frame guard.
function styleRefIntro(count) {
  return count > 1
    ? `The first ${count} attached images are STYLE references — copy their styling exactly, but do NOT copy their content or subjects. `
    : 'The FIRST attached image is a STYLE reference — copy its styling exactly, but do NOT copy its content or subjects. ';
}
function styleRefPrefix(style) {
  return styleRefIntro(style.refs.length) + (style.palettePrompt || '') +
    'One single full-frame scene, no panel grid, no caption box: ';
}

// The sketch pass leans INTO the reference's format instead: one render, a
// 2x2 grid of four scene panels, sliced into quadrants afterwards.
function styleRefGridPrefix(style) {
  return styleRefIntro(style.refs.length) + (style.palettePrompt || '') +
    'Draw a 2x2 grid of four EQUAL rectangular storyboard panels that exactly ' +
    'quarter the image, separated by thin borders, with no captions and no text anywhere. ';
}

// What rides in front of every clip prompt. Deliberately ONLY the art-
// preservation clause — it stops the video model redrawing the panel, and says
// NOTHING about how much or how little should move.
//
// It used to carry "subtle limited animation … Gentle storybook motion", with a
// "mostly still" variant beside it, and that vocabulary reached the model from
// four independent places at once — so films came out gently drifting no matter
// what the scene asked for, and turning the "mostly still" option off changed
// almost nothing. Sophie never wanted that look (Aug 2026): "it doesn't need to
// be anywhere — if I want that I'll ask for it directly." Motion now comes from
// the scene's own motionPrompt and nowhere else. Do not reintroduce a house
// motion feel here; per-movie `motionStyle` is hers to set.
const ART_LOCK =
  'The illustration style, linework and colors are preserved exactly.';
const DEFAULT_NEGATIVE = 'photorealistic, 3d render, blurry, distorted face';
const DEFAULT_IMAGE_STYLE =
  'Hand-drawn ink and watercolor illustration on textured paper, storybook ' +
  'panel, muted palette, clean composition.';
const STATIC_TEXT_SUFFIX =
  ' Any text in the illustration stays perfectly static and legible.';

// ─── Storage: Firestore doc per movie (or in-memory fallback) ───────
const COLLECTION = process.env.MOVIES_COLLECTION || 'forge-movies';
const memStore = new Map(); // dev fallback when Firebase isn't initialized

function firestore() {
  return admin.apps.length ? admin.firestore() : null;
}

// Firestore rejects `undefined` anywhere in a document — round-trip through
// JSON to strip them (also guarantees the doc is plain data).
function plain(obj) { return JSON.parse(JSON.stringify(obj)); }

async function saveMovie(movie) {
  movie.updatedAt = new Date().toISOString();
  const db = firestore();
  if (db) await db.collection(COLLECTION).doc(movie.id).set(plain(movie));
  else memStore.set(movie.id, plain(movie));
  return movie;
}

// Movies written by older prototypes / other tools can miss fields the iOS
// decoder treats as required (the Jonas prototype's scenes had no
// `description`), which makes the whole movie fail to open with "the data
// couldn't be read". Backfill on every read so legacy docs always decode.
function normalizeMovie(movie) {
  if (!movie) return movie;
  movie.title = movie.title || movie.id || 'untitled';
  movie.story = movie.story || '';
  (movie.scenes || []).forEach((s, i) => {
    s.id = s.id || `s${i + 1}`;
    s.title = s.title || `Scene ${i + 1}`;
    s.description = s.description || s.motionPrompt || s.imagePrompt || s.title;
    s.imagePrompt = s.imagePrompt || '';
    s.motionPrompt = s.motionPrompt || '';
  });
  (movie.cuts || []).forEach((c, i) => { c.name = c.name || `cut ${i + 1}`; });
  return movie;
}

async function loadMovie(id) {
  const db = firestore();
  if (db) {
    const snap = await db.collection(COLLECTION).doc(id).get();
    return snap.exists ? normalizeMovie(snap.data()) : null;
  }
  return normalizeMovie(memStore.get(id)) || null;
}

async function listMovies() {
  const db = firestore();
  let all;
  if (db) {
    const snap = await db.collection(COLLECTION).orderBy('updatedAt', 'desc').limit(100).get();
    all = snap.docs.map(d => d.data());
  } else {
    all = [...memStore.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }
  // Summaries only — the list stays light for the phone.
  return all.map(m => ({
    id: m.id, title: m.title, createdAt: m.createdAt, updatedAt: m.updatedAt,
    sceneCount: (m.scenes || []).length,
    poster: (m.scenes || []).map(s => s.panel && s.panel.url).find(Boolean) || null,
    movieUrl: m.movieUrl || null,
    storyId: m.storyId || null,   // which forge-story doc this film belongs to
    spend: m.spend || 0,
    job: m.job || null,
  }));
}

async function deleteMovie(id) {
  const db = firestore();
  if (db) await db.collection(COLLECTION).doc(id).delete();
  else memStore.delete(id);
}

// Quick animations (one image → one clip, no movie) get their own collection.
const QUICK_COLLECTION = process.env.QUICK_COLLECTION || 'forge-quick';
const memQuick = new Map();

async function saveQuick(doc) {
  doc.updatedAt = new Date().toISOString();
  const db = firestore();
  if (db) await db.collection(QUICK_COLLECTION).doc(doc.id).set(plain(doc));
  else memQuick.set(doc.id, plain(doc));
  return doc;
}

async function loadQuick(id) {
  const db = firestore();
  if (db) {
    const snap = await db.collection(QUICK_COLLECTION).doc(id).get();
    return snap.exists ? snap.data() : null;
  }
  return memQuick.get(id) || null;
}

async function listQuick() {
  const db = firestore();
  if (db) {
    const snap = await db.collection(QUICK_COLLECTION).orderBy('createdAt', 'desc').limit(40).get();
    return snap.docs.map(d => d.data());
  }
  return [...memQuick.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

async function deleteQuick(id) {
  const db = firestore();
  if (db) await db.collection(QUICK_COLLECTION).doc(id).delete();
  else memQuick.delete(id);
}

// Dreams (dream text → hand-drawn comic pages) get their own collection so a
// dream never clutters the movies list — it has no scenes, clips, or stitch.
const DREAM_COLLECTION = process.env.DREAM_COLLECTION || 'forge-dreams';
const memDream = new Map();

async function saveDream(doc) {
  doc.updatedAt = new Date().toISOString();
  const db = firestore();
  if (db) await db.collection(DREAM_COLLECTION).doc(doc.id).set(plain(doc));
  else memDream.set(doc.id, plain(doc));
  return doc;
}

async function loadDream(id) {
  const db = firestore();
  if (db) {
    const snap = await db.collection(DREAM_COLLECTION).doc(id).get();
    return snap.exists ? snap.data() : null;
  }
  return memDream.get(id) || null;
}

// List dreams for ONE archive. `owner` scopes it: a guest owner (the public
// "try it" page) sees only its OWN dreams; no owner = Sophie's archive, which
// is every dream with NO owner field (her app/page never sets one, so guests'
// namespaced dreams never appear in it, and hers never leak to a guest).
async function listDreams(owner) {
  const db = firestore();
  let all;
  if (db) {
    if (owner) {
      // A single equality filter needs no composite index; sort in code.
      const snap = await db.collection(DREAM_COLLECTION).where('owner', '==', owner).limit(200).get();
      all = snap.docs.map(d => d.data()).filter(d => !d.hidden).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    } else {
      // Hers = ownerless. Fetch a generous window and drop any guest-owned or
      // hidden docs (hidden = kept in Firestore but taken out of the journal).
      const snap = await db.collection(DREAM_COLLECTION).orderBy('updatedAt', 'desc').limit(300).get();
      all = snap.docs.map(d => d.data()).filter(d => !d.owner && !d.hidden).slice(0, 100);
    }
  } else {
    all = [...memDream.values()]
      .filter(d => (owner ? d.owner === owner : !d.owner) && !d.hidden)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }
  // Summaries only — the list stays light for the phone.
  return all.map(d => ({
    id: d.id, title: d.title, createdAt: d.createdAt, updatedAt: d.updatedAt,
    beatCount: (d.beats || []).length,
    pageCount: (d.pages || []).length,
    poster: (d.pages || []).map(p => p.url).find(Boolean) || null,
    spend: d.spend || 0,
    job: d.job || null,
  }));
}

async function deleteDream(id) {
  const db = firestore();
  if (db) await db.collection(DREAM_COLLECTION).doc(id).delete();
  else memDream.delete(id);
}

// The reading (breakdown) step is slow — gpt-5.6-sol splits + orders a rambling
// recording (~30-60s), and Render's free tier may cold-start on top of that. A
// synchronous POST /dream held the phone's connection open the whole time, so it
// timed out whenever the phone locked or the signal was weak ("Couldn't
// illustrate — the request timed out"). Instead the reading runs as a background
// job tracked by a tiny batch doc: the phone gets an id back instantly and polls
// it, so it can lock/leave and pick up the split dreams on return — exactly like
// the drawing step already does.
const DREAM_BATCH_COLLECTION = process.env.DREAM_BATCH_COLLECTION || 'forge-dream-batches';
const memDreamBatch = new Map();
// A stuck 'reading' batch (process died mid-breakdown before the doc could flip
// to error) shouldn't poll forever — treat one older than this as failed.
const DREAM_BATCH_STALE_MS = 8 * 60 * 1000;

async function saveDreamBatch(doc) {
  doc.updatedAt = new Date().toISOString();
  const db = firestore();
  if (db) await db.collection(DREAM_BATCH_COLLECTION).doc(doc.id).set(plain(doc));
  else memDreamBatch.set(doc.id, plain(doc));
  return doc;
}

async function loadDreamBatch(id) {
  const db = firestore();
  if (db) {
    const snap = await db.collection(DREAM_BATCH_COLLECTION).doc(id).get();
    return snap.exists ? snap.data() : null;
  }
  return memDreamBatch.get(id) || null;
}

// Idempotency: the page sends a random `key` with POST /dream so a retry after
// a dropped connection returns the batch the first attempt already created,
// instead of reading (and billing) the same recording twice.
async function loadDreamBatchByKey(key) {
  const db = firestore();
  if (db) {
    const snap = await db.collection(DREAM_BATCH_COLLECTION).where('key', '==', key).limit(1).get();
    return snap.empty ? null : snap.docs[0].data();
  }
  for (const b of memDreamBatch.values()) if (b.key === key) return b;
  return null;
}

// Turn a breakdown's plans into stored dream docs. Factored out so both the
// synchronous POST /dream (back-compat) and the background batch use it.
async function createDreamDocs(plans, text, title, owner) {
  const now = Date.now();
  const docs = [];
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    // Stagger timestamps so the array order (earliest dreamt first) maps to
    // time — the last dream sorts newest in the journal.
    const ts = new Date(now + i * 1000).toISOString();
    const doc = {
      id: 'd' + (now + i).toString(36) + crypto.randomBytes(3).toString('hex'),
      // Owner namespace: set only for guests (the public "try it" page), so
      // their dreams stay in their own archive and out of Sophie's. Omitted
      // for Sophie so her (ownerless) archive is unchanged.
      ...(owner ? { owner } : {}),
      // Only honor a client-supplied title when the recording is a single dream.
      title: (plans.length === 1 && title && String(title).trim()) || plan.title,
      dream: text,
      // This dream's own slice of the recording (for the review block) +
      // the out-of-order cue phrases to highlight in it. Falls back to the
      // whole recording when the model didn't split out a per-dream text.
      dreamText: plan.text || text,
      driftCues: plan.driftCues || [],
      characters: plan.characters,
      cast: plan.cast,
      // v2 staged flow: who the dream mentions + saved-sheet candidates for
      // each (filled by attachCastSuggestions after the split).
      mentions: plan.mentions || [],
      castSuggestions: plan.castSuggestions || null,
      imageStyle: DEFAULT_IMAGE_STYLE,
      characterAnchor: null,
      beats: plan.beats,
      pages: [],
      pagesQuality: null,
      pagesMadeAt: null,
      pageHistory: [],
      job: null,
      spend: 0,
      createdAt: ts,
      updatedAt: ts,
    };
    await saveDream(doc);
    docs.push(doc);
  }
  return docs;
}

// ─── Firebase Storage upload (permanent URLs) ───────────────────────
// Replicate/OpenAI URLs expire (~1hr) — everything the movie keeps must go to
// Firebase Storage. Mirrors server.js's saveToFirebase, kept local so the
// module stays self-contained. Without Firebase, temp URLs pass through
// (fine for local dev, not for reopening a movie tomorrow).
function bucket() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}

async function saveBufferToStorage(buffer, contentType, folder) {
  const b = bucket();
  const ext = contentType.includes('webp') ? 'webp'
    : contentType.includes('png') ? 'png'
    : contentType.includes('jpeg') ? 'jpg'
    : contentType.includes('mp4') ? 'mp4' : 'bin';
  if (!b) return `data:${contentType};base64,${buffer.toString('base64')}`;
  const filename = `${folder}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const file = b.file(filename);
  // Retried: by this point the image is generated and paid for — losing it to
  // a transient Storage/network blip would waste the whole render.
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await file.save(buffer, { metadata: { contentType } });
      await file.makePublic();
      return `https://storage.googleapis.com/${b.name}/${filename}`;
    } catch (err) {
      lastErr = err;
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// Download with retries + size verification — replicate.delivery truncated
// files under parallel load in the validated run; the prediction output stays
// available, so re-fetching always recovers.
async function fetchBuffer(url, retries = 5) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow', timeout: 120000 });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const buf = await res.buffer();
      const expected = Number(res.headers.get('content-length') || 0);
      if (expected && buf.length !== expected) throw new Error(`truncated download (${buf.length}/${expected})`);
      if (!buf.length) throw new Error('empty download');
      return { buffer: buf, contentType: res.headers.get('content-type') || 'application/octet-stream' };
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function saveUrlToStorage(url, folder, fallbackType) {
  const { buffer, contentType } = await fetchBuffer(url);
  const type = contentType.startsWith('application/octet') && fallbackType ? fallbackType : contentType;
  return saveBufferToStorage(buffer, type, folder);
}

// ─── OpenAI helpers ─────────────────────────────────────────────────
async function openaiChatJSON(messages, { model = 'gpt-4o-mini', temperature = 0.8, reasoningEffort = null, retries = 2 } = {}) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // GPT-5 reasoning models only accept the default temperature — omit it.
      // reasoningEffort ('none'|'low'|'medium'|'high') trades thinking time for
      // latency; a lower setting keeps the synchronous request short enough that
      // mobile/Render doesn't drop the connection mid-request.
      const body = { model, messages, response_format: { type: 'json_object' } };
      if (!/^gpt-5/.test(model)) body.temperature = temperature;
      if (reasoningEffort && /^gpt-5/.test(model)) body.reasoning_effort = reasoningEffort;
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'Connection': 'close',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return JSON.parse(data.choices?.[0]?.message?.content || '{}');
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// Claude Opus, JSON out. Used for the dream breakdown — no OpenAI fallback by
// request. Opus 4.8 rejects assistant prefill and `temperature`, so we ask for
// strict JSON in the system prompt and parse the text (fences stripped).
async function anthropicChatJSON(system, user, { maxTokens = 8000, retries = 2 } = {}) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set — the dream breakdown runs on Claude Opus; add the key to enable it');
  }
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: DREAM_MODEL,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'anthropic error');
      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
      if (!text) throw new Error('empty response from Claude');
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(cleaned);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// Transcribe a voiceover with word + segment timestamps (OpenAI whisper-1,
// verbose_json). The timings are the whole point: they become the film's
// clock so each visual beat lands on the exact moment its line is spoken.
async function transcribeAudio(buffer, filename = 'voiceover.m4a') {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const form = new FormData();
  form.append('file', buffer, { filename });
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('timestamp_granularities[]', 'segment');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders() },
    body: form,
    timeout: 240000,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'transcription failed');
  const num = v => Math.round((Number(v) || 0) * 1000) / 1000;
  return {
    text: String(data.text || '').trim(),
    duration: num(data.duration),
    words: (data.words || []).map(w => ({ word: String(w.word || '').trim(), start: num(w.start), end: num(w.end) })),
    segments: (data.segments || []).map(s => ({ text: String(s.text || '').trim(), start: num(s.start), end: num(s.end) })),
  };
}

// Map an audio mime type to a file extension Whisper can sniff (it keys the
// format off the filename). Defaults to m4a — iOS Voice Memos / the share sheet.
function extFromMime(mime = '') {
  const m = String(mime).toLowerCase();
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('wav')) return 'wav';
  if (m.includes('webm')) return 'webm';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('aiff') || m.includes('aif')) return 'aiff';
  if (m.includes('flac')) return 'flac';
  return 'm4a';   // audio/mp4, audio/x-m4a, audio/aac
}

// ─── Safety refusals are TERMINAL, not a hiccup ─────────────────────
// gpt-image-2's moderation refuses ordinary dream content now and then — the
// 2026-08-03 "Mommy Evaluates Kid" render died on a breastfeeding line, flagged
// `safety_violations=[sexual]`. A refusal is DETERMINISTIC: the same words get
// refused every time, so every retry ladder above it is pure waste. That render
// burned 9 API calls over ~65s of backoff and then reported "3 rounds of
// retries", which reads like a network failure and buries the real reason.
// So a refusal short-circuits every retry loop, and the page gets exactly ONE
// redraw with its wording softened (see softenRefusedNarrative).
function isSafetyRefusal(err) {
  const m = String((err && err.message) || err || '');
  return /safety system|safety_violations|content[ _]policy|moderation_blocked|rejected by our safety/i.test(m);
}

// Panel render — gpt-image-2 portrait, timeout scaled by quality (high takes
// minutes at OpenAI's end; see server.js's OPENAI_IMAGE_TIMEOUTS).
const IMAGE_TIMEOUTS = { low: 90000, medium: 150000, high: 420000 };
// A comic page is portrait; the dream app's one strong image is square
// (Sophie, Aug 2026). Both are gpt-image-2 canvases — the square is the DEARER
// one at the same quality (5.3c vs 4.1c at medium), see docs/modules/pictures.md.
const PORTRAIT = '1024x1536';
const SQUARE = '1024x1024';
async function openaiPanel(prompt, quality = 'medium', retries = 2, size = PORTRAIT) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json', 'Connection': 'close' },
        body: JSON.stringify({
          model: 'gpt-image-2', prompt, n: 1,
          size, quality, output_format: 'webp',
        }),
        timeout: IMAGE_TIMEOUTS[quality] || 150000,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error('gpt-image-2 returned no image');
      return Buffer.from(b64, 'base64');
    } catch (err) {
      lastErr = err;
      if (isSafetyRefusal(err)) break;   // deterministic — retrying can't help
      if (attempt < retries) await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// Panel render through the EDITS endpoint with one or more reference images
// attached (multipart image[] — the style page, plus the character anchor
// once one is locked). gpt-image-2 processes reference inputs at high
// fidelity automatically. Mirrors openaiPanel's retry/timeout behavior;
// edits are slower than generations so the cap only ever goes up.
async function openaiPanelEdit(prompt, refBuffers, quality = 'medium', retries = 2, size = PORTRAIT) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const refs = Array.isArray(refBuffers) ? refBuffers : [refBuffers];
  const timeout = Math.max(150000, IMAGE_TIMEOUTS[quality] || 0);
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const form = new FormData();
      form.append('model', 'gpt-image-2');
      form.append('prompt', prompt);
      refs.forEach((buf, i) => {
        form.append('image[]', buf, { filename: `ref${i}.jpg`, contentType: 'image/jpeg' });
      });
      form.append('size', size);
      form.append('quality', quality);
      form.append('output_format', 'webp');
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders() },
        body: form,
        timeout,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error('gpt-image-2 edit returned no image');
      return Buffer.from(b64, 'base64');
    } catch (err) {
      lastErr = err;
      if (isSafetyRefusal(err)) break;   // deterministic — retrying can't help
      if (attempt < retries) await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// ─── Replicate: create + poll, with 429 backoff ─────────────────────
// A 6-parallel burst produced one HTTP 429 on create in the validated run —
// exponential backoff on create is required, not optional.
async function replicatePredict(version, input, { pollMs = 5000, maxPolls = 180 } = {}) {
  if (!REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN not set');
  let prediction;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, input }),
    });
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt) + Math.random() * 1000));
      continue;
    }
    prediction = await res.json();
    break;
  }
  if (!prediction) throw new Error('Replicate rate-limited after retries');
  if (prediction.error) throw new Error(typeof prediction.error === 'string' ? prediction.error : JSON.stringify(prediction.error));
  if (!prediction.urls?.get) throw new Error(prediction.detail || 'Replicate did not return a polling URL');
  let polls = 0;
  while (!['succeeded', 'failed', 'canceled'].includes(prediction.status) && polls < maxPolls) {
    await new Promise(r => setTimeout(r, pollMs));
    prediction = await (await fetch(prediction.urls.get, {
      headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
    })).json();
    polls++;
  }
  if (prediction.status !== 'succeeded') {
    throw new Error(`prediction ${prediction.status}: ${prediction.error || 'timed out'}`);
  }
  return prediction;
}

// Small concurrency pool — parallel predictions are fine (11 at once ran
// clean), but panels hit OpenAI's per-minute limits, so each caller picks
// its own width.
async function pool(items, width, worker) {
  const queue = [...items.entries()];
  const results = new Array(items.length);
  async function lane() {
    while (queue.length) {
      const [i, item] = queue.shift();
      results[i] = await worker(item, i).then(v => ({ ok: true, value: v })).catch(e => ({ ok: false, error: e.message }));
    }
  }
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, lane));
  return results;
}

// ─── ffmpeg helpers ─────────────────────────────────────────────────
function run(bin, args, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${path.basename(bin)} failed: ${(stderr || err.message).slice(-400)}`));
      else resolve({ stdout, stderr });
    });
  });
}

async function probe(file) {
  if (!FFPROBE) throw new Error('ffprobe unavailable');
  const { stdout } = await run(FFPROBE, [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration',
    '-of', 'json', file,
  ]);
  const info = JSON.parse(stdout);
  return {
    width: info.streams?.[0]?.width || 0,
    height: info.streams?.[0]?.height || 0,
    duration: parseFloat(info.format?.duration || '0'),
  };
}

// Extract the final frame of a clip (the last-frame chaining trick) → PNG file.
async function extractLastFrame(clipFile, outFile) {
  if (!FFMPEG) throw new Error('ffmpeg unavailable');
  await run(FFMPEG, ['-y', '-sseof', '-0.1', '-i', clipFile, '-frames:v', '1', outFile]);
  return outFile;
}

// Apply a scene's edit list and normalize to the target frame size / 30fps /
// yuv420p so the concat demuxer can join everything losslessly afterwards.
// All edits are ffmpeg — free and near-instant, no regeneration.
async function normalizeClip(inFile, outFile, edits = {}, target) {
  if (!FFMPEG) throw new Error('ffmpeg unavailable');
  const args = ['-y'];
  const trimStart = Number(edits.trimStart) || 0;
  const trimEnd = Number(edits.trimEnd) || 0; // seconds from the start; 0 = to the end
  if (trimStart > 0) args.push('-ss', String(trimStart));
  if (trimEnd > trimStart) args.push('-to', String(trimEnd));
  args.push('-i', inFile);

  const speed = Math.min(4, Math.max(0.25, Number(edits.speed) || 1)); // 1 = as generated; 0.8 = dreamy slow-mo
  const filters = [`setpts=PTS/${speed}`];
  const freeze = Math.min(10, Math.max(0, Number(edits.freezeEnd) || 0));
  if (freeze > 0) filters.push(`tpad=stop_mode=clone:stop_duration=${freeze}`);
  filters.push(
    `scale=${target.width}:${target.height}:force_original_aspect_ratio=decrease`,
    `pad=${target.width}:${target.height}:(ow-iw)/2:(oh-ih)/2`,
    'fps=30', 'format=yuv420p'
  );
  const fade = Math.min(5, Math.max(0, Number(edits.fadeOut) || 0));

  if (fade > 0) {
    // Fade needs the post-speed/post-freeze duration — two passes keeps the
    // filter math trivial and clips are tiny (a few MB at 480p).
    const mid = outFile + '.mid.mp4';
    args.push('-vf', filters.join(','), '-an', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', mid);
    await run(FFMPEG, args);
    const { duration } = await probe(mid);
    const start = Math.max(0, duration - fade);
    await run(FFMPEG, ['-y', '-i', mid, '-vf', `fade=t=out:st=${start}:d=${fade}`, '-an', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', outFile]);
    fs.unlinkSync(mid);
  } else {
    args.push('-vf', filters.join(','), '-an', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', outFile);
    await run(FFMPEG, args);
  }
  return outFile;
}

async function concatClips(files, outFile) {
  if (!FFMPEG) throw new Error('ffmpeg unavailable');
  const listFile = outFile + '.txt';
  fs.writeFileSync(listFile, files.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
  // Every input was just re-encoded to identical codec/size/fps, so stream
  // copy is safe and instant.
  await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', outFile]);
  fs.unlinkSync(listFile);
  return outFile;
}

// ─── Scene breakdown ────────────────────────────────────────────────
// The heart of the medium. CRITICAL RULE from the prototyping run: every scene
// description must be SELF-CONTAINED and continuity-complete — the video
// generator can't infer beats between scenes. Morph-vs-hard-cut is the model's
// FREE judgement per moment (no quota — one story may morph everywhere,
// another may be all cuts; pairs become seamless `last_image` joins), and
// character continuity tokens repeat in every single prompt so panels and
// clips stay consistent. No climax detection — not every story has one, and
// asking for it can pressure the breakdown into inventing one.
async function breakdownStory(story, sceneCount, opts = {}) {
  const morphPairs = opts.morphPairs !== false;          // pairs allowed by default; the model picks which moments deserve one
  const target = sceneCount ? `exactly ${sceneCount}` : 'between 8 and 12';
  const pairField = morphPairs
    ? `\n   "pairWithNext": true when this scene and the NEXT are the SAME shot before/after one key action,`
    : '';
  const pairRule = morphPairs
    ? '- For EACH moment, decide whether it wants a MORPH or a HARD CUT — purely your judgement for THIS story. There is NO quota and no expected ratio: one story might morph everywhere, another might be all hard cuts, most are somewhere between. A morph = a before/after pair: two consecutive scenes that are the SAME shot and composition with one small state change (door closed → door open; cup full → cup empty; a fist landing). Mark the FIRST of the pair with "pairWithNext": true. The pair\'s imagePrompts must describe the identical composition, differing only in the changed detail.'
    : '- Every scene is its own single still — do NOT create before/after pairs or repeat a composition with one small change.';
  // MOTION ONLY, and no house opinion about how much of it. The old version of
  // this rule insisted on "one continuous subtle action" and (optionally) that
  // most scenes stay "nearly still" — see ART_LOCK. What the shot needs is the
  // story's business, not this prompt's.
  const motionRule = '- motionPrompt is about MOTION only — one continuous action within the shot, never a cut. Let the scene decide how much movement it wants.';
  const sys = `You are a storyboard artist breaking a story into scenes for an illustrated animated short film. Return STRICT JSON:
{"title": short film title,
 "characters": one compact phrase of visual continuity tokens for the recurring character(s) — MUST specify hairstyle, facial features (beard/glasses/etc), AND the exact clothing worn for the whole story, e.g. "a girl with a black bob haircut and a crystal necklace, wearing a yellow raincoat and red boots",
 "scenes": [{"title": 2-5 word scene label,
   "description": what happens in this scene, written SELF-CONTAINED,
   "imagePrompt": a full image-generation prompt for this scene's illustrated panel,
   "motionPrompt": one sentence of the physical motion happening in the shot (steam rising, a hand reaching, a door slamming, rain falling),
   "hasText": true only if the panel should contain written text (a speech bubble, a sign, a screen),${pairField}
   "key": true on EXACTLY the 3 scenes that show the main character most clearly (well lit, framed large, face visible) — these render first so the character design can be approved}]}

HARD RULES:
- ${target} scenes.
- EVERY scene description and imagePrompt must be fully self-contained and continuity-complete: name the location, the time of day, and describe every character present with the full continuity tokens. NOTHING may be implied from a previous scene — each prompt renders alone.
- Include the character continuity tokens verbatim in every imagePrompt where that character appears.
${pairRule}
- Location changes between scenes are fine (hard cuts are normal storyboard language).
- imagePrompts describe composition and content only — no style words (the style is applied separately).
${motionRule}`;
  const out = await openaiChatJSON([
    { role: 'system', content: sys },
    { role: 'user', content: `The story:\n\n${story}` },
  ], { temperature: 0.7 });
  const scenes = (Array.isArray(out.scenes) ? out.scenes : []).map((s, i) => ({
    id: 's' + crypto.randomBytes(4).toString('hex'),
    title: String(s.title || `Scene ${i + 1}`).trim(),
    description: String(s.description || '').trim(),
    imagePrompt: String(s.imagePrompt || s.description || '').trim(),
    motionPrompt: String(s.motionPrompt || '').trim(),
    hasText: Boolean(s.hasText),
    pairWithNext: morphPairs ? Boolean(s.pairWithNext) : false,
    key: Boolean(s.key),
    panel: null,          // { url, quality, status, error }
    clip: null,           // { url, tier, status, error, frames, cost, promptUsed }
    edits: { enabled: true, trimStart: 0, trimEnd: 0, speed: 1, freezeEnd: 0, fadeOut: 0 },
  }));
  if (!scenes.length) throw new Error('breakdown produced no scenes');
  if (scenes.length) scenes[scenes.length - 1].pairWithNext = false; // can't pair past the end
  // Guarantee key scenes exist (first / middle / last as the fallback trio).
  if (!scenes.some(s => s.key)) {
    [0, Math.floor(scenes.length / 2), scenes.length - 1]
      .forEach(i => { scenes[i].key = true; });
  }
  return {
    title: String(out.title || 'Untitled film').trim(),
    characters: String(out.characters || '').trim(),
    scenes,
  };
}

// ─── Dream breakdown ────────────────────────────────────────────────
// A dream isn't a movie: it wants a few illustrated panels each with a short
// hand-lettered caption beneath it, not 8-12 self-contained video scenes. So
// this is its own one-shot call — read the dream, decide how many BEATS it
// honestly needs (most are short; never pad), and for each write a panel's
// image prompt plus the little caption line that sits under it. The renderer
// packs the beats four-to-a-page (the style reference's 2x2 comic format), so
// an 8-beat dream becomes two pages, a short tail page lays out with fewer.
// Normalize one raw dream object from the model into our stored shape.
function normalizeBreakdownDream(d) {
  const cast = (Array.isArray(d.cast) ? d.cast : [])
    .map((c) => ({ name: String(c.name || '').trim(), look: String(c.look || '').trim(), url: null }))
    .filter(c => c.name && c.look)
    .slice(0, 5);
  const castNames = new Set(cast.map(c => c.name));
  const beats = (Array.isArray(d.beats) ? d.beats : []).map((b) => ({
    id: 'b' + crypto.randomBytes(4).toString('hex'),
    imagePrompt: String(b.imagePrompt || b.description || '').trim(),
    who: (Array.isArray(b.who) ? b.who : []).map(n => String(n).trim()).filter(n => castNames.has(n)),
    caption: String(b.caption || '').trim(),
    hasText: Boolean(b.hasText),
  })).filter(b => b.imagePrompt);
  return {
    title: String(d.title || 'Untitled dream').trim(),
    // The dreamer's own words for THIS dream (the block shown in review), plus
    // the verbatim phrases where they narrated out of order (to highlight).
    text: String(d.text || '').trim(),
    driftCues: (Array.isArray(d.driftCues) ? d.driftCues : [])
      .map(s => String(s).trim()).filter(Boolean).slice(0, 12),
    cast,
    // A joined continuity phrase kept for any legacy reader (single-string field).
    characters: cast.map(c => c.look).join('; '),
    beats,
  };
}

async function dreamBreakdown(dream) {
  const sys = `You are illustrating someone's real dream recordings as short hand-drawn diary comics. A single recording is often SEVERAL separate dreams told in one breath, out of order. First split it into the distinct dreams, then break each dream into the visual BEATS it needs — one drawing per beat. Return STRICT JSON and nothing else:
{"dreams": [
  {"title": a short 2-5 word title for THIS dream,
   "text": the exact words from the recording that belong to THIS dream, verbatim (you may drop filler like "um"), so it can be shown to the dreamer as a block,
   "driftCues": [the exact short phrases WITHIN "text" where the dreamer told events OUT OF chronological order — the cues you had to follow to reorder, e.g. "before that", "at first", "actually that was earlier", "right before I woke up". Verbatim substrings of "text". [] if this dream was narrated in the order it happened],
   "cast": [{"name": a short label for one recurring figure the way the dreamer refers to them — "J", "Dad", "the boob girl", "the baby", "me",
     "look": one compact phrase of visual continuity tokens so they look the SAME in every panel — hairstyle, face, AND the exact clothing, e.g. "honey-blonde hair, glasses, wearing a green cardigan and jeans"}]  (ONLY figures who appear in MORE THAN ONE beat of THIS dream or are central; [] if none; at MOST 5),
   "beats": [{"imagePrompt": a full, SELF-CONTAINED image prompt for this one panel — name the setting, who is present with their continuity tokens, and what is happening; describe composition and content ONLY, no art-style words,
     "who": [the exact cast "name" values of the figures who appear IN THIS PANEL] ([] if none of the cast are in this beat),
     "caption": the short line hand-lettered under the panel — the dreamer's own voice, present tense, evocative not descriptive, at most about 8 words,
     "hasText": true only if the drawing itself should contain written words (a sign, a screen, a speech bubble)}]}
]}

HARD RULES:
- SPLIT into separate dreams. A recording usually contains more than one dream. Start a new dream at the dreamer's own boundary cues: "that was that dream", "the next dream", "another dream I had", "then yesterday I had a dream", "the night before" introducing a wholly separate scene, or an unmistakable change of setting/cast with no continuity. When unsure whether two stretches are one dream or two, prefer keeping a coherent continuous scene together. Emit the dreams in the order they were dreamt (earliest first) when the dreamer gives day cues ("the night before", "yesterday"); otherwise keep their narrated order.
- WITHIN each dream, return the beats in the TRUE chronological order events happened IN that dream, NOT the order narrated. Follow the dreamer's cues ("actually that was before", "wait, before that", "earlier", "at first", "then", "after that", "at the very end", "right before I woke up", "which reminded me") to reconstruct the real sequence, and emit beats already in that order.
- Keep beats COARSE: one beat per meaningful moment, not per sentence. Use as few beats as capture the dream and NO MORE — do not pad. A simple dream may be 2-4 beats; a busy one 6-8. Merge tiny adjacent details into one beat rather than splitting hairs.
- Every imagePrompt must stand completely alone: nothing implied from another beat. For EACH figure present, repeat that figure's continuity tokens (their "look") verbatim in the imagePrompt — do not just write their name.
- "who" must use the cast "name" values EXACTLY as written in that dream's cast list.
- imagePrompts describe content and composition only — the drawing style is applied separately, so never mention style, medium, ink, watercolor, paper, etc.
- A caption is a caption, not a description of the picture: short, in the dreamer's voice ("then I was falling", "the house wasn't the house"), never "a panel showing…".
- "text" must be a verbatim slice of the recording (the dreamer's own words for that dream). "driftCues" must be exact substrings of that "text" — never paraphrased — so they can be highlighted in place.`;
  const user = `The dream recording:\n\n${dream}`;
  // Experiment: OpenAI's frontier model does the whole breakdown (split +
  // describe); a `claude-*` id routes back through Anthropic. No silent
  // fallback between them — whichever is configured either works or errors.
  const out = /claude/i.test(DREAM_BREAKDOWN_MODEL)
    ? await anthropicChatJSON(sys, user, { maxTokens: 8000 })
    : await openaiChatJSON(
        [{ role: 'system', content: sys }, { role: 'user', content: user }],
        // 'low' effort halves the latency (~60s → ~30s) while still splitting,
        // ordering and flagging drift correctly — short enough that the phone /
        // Render don't drop the synchronous request.
        { model: DREAM_BREAKDOWN_MODEL, reasoningEffort: DREAM_BREAKDOWN_EFFORT, retries: 2 });
  const raw = Array.isArray(out.dreams) ? out.dreams
    : Array.isArray(out.beats) ? [out]   // tolerate a single-dream shape
    : [];
  const dreams = raw.map(normalizeBreakdownDream).filter(d => d.beats.length);
  if (!dreams.length) throw new Error('dream breakdown produced no beats');
  return { dreams };
}

// ─── Dream split (v2 staged pipeline) ───────────────────────────────
// The fast FIRST call of the staged flow: split the recording into its
// separate dreams and note WHO appears (with any description the dreamer gave
// them). It deliberately does NOT do chronology — no drift cues, no ordering
// work — because that's not needed to pick characters and only slows the one
// call the user waits on. Chronology (putting the images in true order) is
// reconstructed later in dreamPaginate, at render time, after the user has
// picked their cast and stepped away.
const DREAM_SPLIT_EFFORT = process.env.DREAM_SPLIT_EFFORT || 'none';
async function dreamSplit(recording) {
  const sys = `Someone tells you their real dream recording. A single recording is often SEVERAL separate dreams told in one breath. Do ONLY two things: split it into the distinct dreams, and note who appears in each. Do NOT reorder anything, do NOT flag chronology, do NOT describe images or break dreams into scenes. Return STRICT JSON and nothing else:
{"dreams": [
  {"title": a short 2-5 word title for THIS dream,
   "text": the exact words from the recording that belong to THIS dream, verbatim (you may drop filler like "um"), in the order they were said,
   "mentions": [ {"name": a short label for a person/figure in THIS dream, exactly as the dreamer refers to them — "me", "J", "Dad", "Miriam", "the baby", "this guy"; if the dreamer themself is in it, "me" comes FIRST,
     "named": true if the dreamer refers to them by an actual name or family title ("Miriam", "J", "Dad", "Auntie Florence", "me"); false for generic references they clearly can't identify ("some guy", "that woman", "a videographer", "someone", "the baby"),
     "desc": any description the dreamer actually gave of that person's appearance in the recording — "serious face", "tall with red hair", "wearing a suit" — VERBATIM-ish, or "" if they gave none} ] }
]}

HARD RULES:
- SPLIT into separate dreams at the dreamer's own boundary cues: "that was that dream", "the next dream", "another dream I had", "then yesterday I had a dream", or an unmistakable change of setting/cast. When unsure whether two stretches are one dream or two, keep a coherent continuous scene together. Keep the dreams in the order the dreamer narrated them; do NOT try to reorder them.
- "text" must be a verbatim slice of the recording, left in narrated order.
- "mentions": one entry per distinct person, deduplicated ("my dad" and "Dad" are one). "desc" is ONLY what the dreamer said about how they looked — never invent one; use "" when none was given.`;
  const user = `The dream recording:\n\n${recording}`;
  const ask = () => /claude/i.test(DREAM_BREAKDOWN_MODEL)
    ? anthropicChatJSON(sys, user, { maxTokens: 6000 })
    : openaiChatJSON(
        [{ role: 'system', content: sys }, { role: 'user', content: user }],
        { model: DREAM_BREAKDOWN_MODEL, reasoningEffort: DREAM_SPLIT_EFFORT, retries: 2 });
  let out = await ask();
  // An empty split is a bad model roll, not a verdict on the recording —
  // re-ask once before reaching for the fallback below.
  if (!Array.isArray(out.dreams) || !out.dreams.length) out = await ask().catch(() => ({}));
  const raw = Array.isArray(out.dreams) ? out.dreams : [];
  const dreams = raw.map((d) => ({
    title: String(d.title || 'Untitled dream').trim(),
    text: String(d.text || '').trim(),
    driftCues: [],   // chronology deferred to render (dreamPaginate)
    // Normalize mentions to { name, desc }; tolerate the model returning plain
    // strings (older shape) too.
    mentions: (Array.isArray(d.mentions) ? d.mentions : []).map((m) => {
      if (m && typeof m === 'object') {
        return { name: String(m.name || '').trim(), desc: String(m.desc || '').trim(),
                 named: m.named === false ? false : (m.named === true ? true : null) };
      }
      return { name: String(m || '').trim(), desc: '', named: null };
    }).filter(m => m.name).slice(0, 12),
    cast: [], characters: '', beats: [],
  })).filter(d => d.text);
  // Never fail the reading because the splitter came back empty ("dream split
  // found no dreams in the recording", seen live 2026-07-30): the WHOLE
  // recording as ONE dream is always a valid reading — the dreamer can still
  // approve, cast, and render it.
  if (!dreams.length) {
    dreams.push({
      title: 'Untitled dream', text: recording, driftCues: [],
      mentions: [], cast: [], characters: '', beats: [],
    });
  }
  return { dreams };
}

// Look each mentioned name up in the saved character sheet and store ALL the
// plausible candidates on the dream doc — the approval UI shows them as cards
// (every candidate when a name is ambiguous, a blank describe-yourself card
// when there's no match). Each suggestion also carries the `desc` the dreamer
// gave that person, so the describe card can preload it. Best-effort.
async function attachCastSuggestions(doc) {
  const mentions = (doc.mentions || []).map(m => (m && typeof m === 'object') ? m : { name: String(m), desc: '', named: null });
  try {
    const { matchCandidates } = require('./character');
    const matched = await matchCandidates(mentions.map(m => m.name));
    doc.castSuggestions = matched.map((s, i) => ({
      ...s,
      desc: mentions[i] ? (mentions[i].desc || '') : '',
      named: mentions[i] ? (mentions[i].named ?? null) : null,
    }));
  } catch (err) {
    console.warn('movies: cast suggestions failed —', err.message);
    doc.castSuggestions = mentions.map(m => ({ name: m.name, matches: [], desc: m.desc || '', named: m.named ?? null }));
  }
}

// A scene folded into the previous scene's clip (it's the "after" of a
// before/after pair): it has a panel but never its own clip or stitch slot.
function isMerged(movie, idx) {
  return idx > 0 && Boolean(movie.scenes[idx - 1].pairWithNext);
}

// The full motion prompt actually sent to the video model.
function motionPromptFor(movie, scene) {
  const style = (movie.motionStyle || ART_LOCK).trim();
  let p = `${style} ${scene.motionPrompt}`.trim();
  if (scene.hasText) p += STATIC_TEXT_SUFFIX;
  return p;
}

// ─── Character anchor (OpenAI cookbook technique) ────────────────────
// One approved panel becomes the character's definitive appearance; every
// later render attaches it as an extra reference with the preserve-list
// restated verbatim ("repeat the preserve list on each iteration to reduce
// drift" — the cookbook's exact advice). This is what keeps the shirt the
// same shirt in scene 2 and scene 11. The clause itself (incl. the
// scene.outfit wardrobe-swap variant) is built inside panelRefs, positioned
// by attachment number alongside the character cards and chain refs.

// Resolve a reference image URL to a buffer (data URL in dev, storage URL live).
async function refBufferFromUrl(url) {
  if (!url) return null;
  const m = /^data:[^;]+;base64,(.*)$/.exec(url);
  if (m) return Buffer.from(m[1], 'base64');
  try { return (await fetchBuffer(url)).buffer; }
  catch (err) { console.warn('movies: ref fetch failed —', err.message); return null; }
}

// Resolve the anchor image to a buffer (data URL in dev, storage URL live).
async function anchorBuffer(movie) {
  return refBufferFromUrl(movie.characterAnchor?.url);
}

// Compose the reference set + prompt for a panel-style render, in a fixed
// order the prompt names by position: style refs first → character cards →
// the locked character anchor → chain refs (the story's FIRST panel + the
// MOST RECENT panel, passed by the caller). Continuity is name-specific:
// anyone not named is a different person (never inherits a reference face).
// `scene` rides along for the wardrobe-swap anchor (scene.outfit).
async function panelRefs(movie, basePrompt, scene, chain = []) {
  const refs = [];
  const clauses = [];
  const style = styleFor(movie);
  refs.push(...style.refs);
  let n = refs.length + 1;
  for (const c of (Array.isArray(movie.characterRefs) ? movie.characterRefs : [])) {
    if (!c || !c.url || !c.name) continue;
    const buf = await refBufferFromUrl(c.url);
    if (!buf) continue;
    refs.push(buf);
    clauses.push(`the #${n++} attached image is a CHARACTER REFERENCE for ${c.name} — whenever ` +
      `${c.name} appears, draw them with the exact same face, hair and clothing as in it; do not redesign them`);
  }
  const anchor = await anchorBuffer(movie);
  if (anchor) {
    refs.push(anchor);
    if (scene && scene.outfit) {
      // Deliberate wardrobe change (PR #285): hold the IDENTITY but dress the
      // character in a new outfit on purpose.
      clauses.push(`the #${n++} attached image shows the SAME person as in this scene — same face, ` +
        'same hairstyle, same proportions, same skin tone; keep the face and identity IDENTICAL but ' +
        `change ONLY the clothing: they are now wearing ${String(scene.outfit).trim()}; do not ` +
        'redesign the face — just re-dress the same person');
    } else {
      const tokens = movie.characters ? ` (${movie.characters})` : '';
      clauses.push(`the #${n++} attached image shows the main character${tokens} — same face, ` +
        'same hairstyle, same clothing, same proportions and color palette; do not redesign the character');
    }
  }
  for (const ch of chain) {
    if (!ch || !ch.url) continue;
    const buf = await refBufferFromUrl(ch.url);
    if (!buf) continue;
    refs.push(buf);
    clauses.push(`the #${n++} attached image is ${ch.label} of this same story — keep recurring ` +
      'characters, the drawing style and the world consistent with it');
  }
  let prompt = basePrompt;
  if (clauses.length) {
    prompt = `For continuity: ${clauses.join('; ')}. Any character NOT named above is a DIFFERENT ` +
      'person — give them their own distinct new face and look; never reuse a face from the attached ' +
      'images for them. ' + prompt;
  }
  return { refs, prompt };
}

// The chain refs for a scene: the story's FIRST rendered panel (the anchor)
// plus the most recent rendered panel before this scene — the technique that
// held the snake film together. Skips the scene itself and data-URL panels.
function chainFor(movie, scene) {
  const ok = s => s !== scene && s.panel?.url && !String(s.panel.url).startsWith('data:');
  const done = movie.scenes.filter(ok);
  if (!done.length) return [];
  const idx = movie.scenes.indexOf(scene);
  const first = done[0];
  const prior = movie.scenes.slice(0, Math.max(0, idx)).reverse().find(ok);
  const chain = [{ url: first.panel.url, label: 'the FIRST panel' }];
  if (prior && prior !== first) chain.push({ url: prior.panel.url, label: 'the PREVIOUS panel' });
  return chain;
}

// Every re-roll keeps what it replaces — the raw-generations gallery.
function keepHistory(scene, kind) {
  const current = scene[kind];
  if (!current?.url) return;
  const key = kind + 'History';
  const prior = scene[key] || [];
  if (prior.length && prior[prior.length - 1].url === current.url) return; // failed re-roll retried
  const entry = kind === 'panel'
    ? { url: current.url, quality: current.quality, promptUsed: current.promptUsed }
    : { url: current.url, tier: current.tier, frames: current.frames, cost: current.cost, promptUsed: current.promptUsed };
  scene[key] = [...prior, entry].slice(-12);
}

// ─── Generation steps ───────────────────────────────────────────────
async function renderPanelFor(movie, scene, quality, chain = []) {
  const style = styleFor(movie);
  let base = style.refs.length
    ? styleRefPrefix(style) + scene.imagePrompt
    : `${(movie.imageStyle || DEFAULT_IMAGE_STYLE).trim()} ${scene.imagePrompt}`.trim();
  if (scene.panelNotes) base += ` IMPORTANT revision notes from the author (follow them): ${scene.panelNotes}`;
  const { refs, prompt } = await panelRefs(movie, base, scene, chain);
  const buf = refs.length
    ? await openaiPanelEdit(prompt, refs, quality)
    : await openaiPanel(prompt, quality);
  const url = await saveBufferToStorage(buf, 'image/webp', 'movies/panels');
  keepHistory(scene, 'panel');
  scene.panel = { url, quality, status: 'done', error: null, promptUsed: prompt };
  movie.spend = +((movie.spend || 0) + (PANEL_COST[quality] || 0.06)).toFixed(2);
}

// The sketch pass: ONE low-quality render draws a 2x2 grid of up to four
// scene panels, then ffmpeg slices the quadrants apart (with a small inset so
// wobbly hand-drawn borders don't bleed between panels). ~$0.005/panel.
async function renderSketchGrid(movie, group) {
  if (!FFMPEG) throw new Error('ffmpeg unavailable (needed to slice the grid)');
  const positions = ['top left', 'top right', 'bottom left', 'bottom right'];
  const body = group.map((s, i) => `Panel ${i + 1} (${positions[i]}): ${s.imagePrompt}`).join(' ');
  const style = styleFor(movie);
  const base = style.refs.length
    ? styleRefGridPrefix(style) + body
    : `${(movie.imageStyle || DEFAULT_IMAGE_STYLE).trim()} A 2x2 grid of four equal storyboard panels that exactly quarter the image, thin borders, no text. ${body}`;
  const { refs, prompt } = await panelRefs(movie, base);
  const buf = refs.length ? await openaiPanelEdit(prompt, refs, 'low') : await openaiPanel(prompt, 'low');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-sketch-'));
  try {
    const gridFile = path.join(tmpDir, 'grid.webp');
    fs.writeFileSync(gridFile, buf);
    // 1024x1536 grid → quadrants. A light inset (1.5%/side) shaves any sliver
    // of the neighboring panel, then a uniform cream mat (4.5%/side, matched
    // to the reference's aged paper) frames every slice evenly — so each
    // panel reads as drawn-on-paper instead of an off-center crop.
    for (let i = 0; i < group.length; i++) {
      const scene = group[i];
      const outFile = path.join(tmpDir, `q${i}.webp`);
      const x = i % 2, y = Math.floor(i / 2);
      await run(FFMPEG, ['-y', '-i', gridFile, '-vf',
        `crop=iw/2*0.97:ih/2*0.97:iw/2*${x}+iw/2*0.015:ih/2*${y}+ih/2*0.015,` +
        `pad=iw*1.09:ih*1.09:(ow-iw)/2:(oh-ih)/2:color=#f1e7d0`,
        outFile]);
      const url = await saveBufferToStorage(fs.readFileSync(outFile), 'image/webp', 'movies/panels');
      keepHistory(scene, 'panel');
      scene.panel = { url, quality: 'sketch', status: 'done', error: null, promptUsed: prompt };
    }
    movie.spend = +((movie.spend || 0) + 0.02).toFixed(2);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function generateClipFor(movie, scene, idx, { tier = 'draft', frames } = {}) {
  if (!scene.panel?.url || scene.panel.url.startsWith('data:')) {
    throw new Error('panel not rendered yet (or not on permanent storage)');
  }
  const prompt = scene.motionPromptOverride || motionPromptFor(movie, scene);
  // Same-shot pair → animate BETWEEN the two drawn panels via last_image.
  const nextPanel = scene.pairWithNext ? movie.scenes[idx + 1]?.panel?.url : null;
  let output, cost, usedFrames = null;

  if (tier === 'draft') {
    const m = VIDEO_MODELS.draft;
    usedFrames = frames === 121 ? 121 : 81; // 81 ≈ 5s, 121 ≈ 7.5s @16fps
    const input = {
      image: scene.panel.url,
      prompt,
      resolution: '480p',
      num_frames: usedFrames,
      frames_per_second: 16,
      interpolate_output: true,
      go_fast: true,
    };
    if (nextPanel && !nextPanel.startsWith('data:')) input.last_image = nextPanel;
    const p = await replicatePredict(m.version, input);
    output = Array.isArray(p.output) ? p.output[0] : p.output;
    cost = m.costPerClip(usedFrames);
  } else {
    const m = VIDEO_MODELS[tier];
    if (!m) throw new Error(`unknown tier "${tier}"`);
    const duration = 5;
    const input = {
      start_image: scene.panel.url,
      prompt,
      negative_prompt: movie.negativePrompt || DEFAULT_NEGATIVE,
      duration,
      mode: tier === 'pro' ? 'pro' : 'standard',
    };
    // end_image conditioning REQUIRES kling pro.
    if (tier === 'pro' && nextPanel && !nextPanel.startsWith('data:')) input.end_image = nextPanel;
    const p = await replicatePredict(m.version, input, { pollMs: 6000, maxPolls: 120 });
    output = Array.isArray(p.output) ? p.output[0] : p.output;
    cost = m.costPerClip(duration);
  }
  if (!output) throw new Error('video model produced no output');
  const url = await saveUrlToStorage(output, 'movies/clips', 'video/mp4');
  keepHistory(scene, 'clip');
  scene.clip = { url, tier, status: 'done', error: null, frames: usedFrames, cost, promptUsed: prompt };
  movie.spend = +((movie.spend || 0) + cost).toFixed(2);
  fileVideoToCreations({
    url, poster: scene.panel?.url, prompt,
    model: (tier === 'draft' ? 'wan-2.2-i2v-fast' : 'kling-v2.1'), quality: tier,
  });
}

// Dream mode: a bridge clip across a hard cut. Start = previous clip's last
// frame, end = next scene's panel, ALWAYS num_frames 121 with a prompt
// describing one continuous PHYSICAL action — short morphs between very
// different compositions read as a jarring leap (rule learned live).
async function writeBridgePrompt(movie, fromScene, toScene) {
  const out = await openaiChatJSON([
    { role: 'system', content:
      'You write the motion prompt for a surreal BRIDGE shot in an illustrated film: one continuous shot that physically transforms scene A\'s final image into scene B\'s image. Describe ONE continuous physical action or camera-less transformation connecting them (e.g. "she carries the milk carton across the room to the kitchen table", "the forest branches bend and melt into kitchen cabinets"). Never describe a cut. One or two sentences, concrete and physical. Return STRICT JSON: {"prompt": "..."}' },
    { role: 'user', content: `Scene A (the shot we leave): ${fromScene.description}\nScene B (the image we must arrive at): ${toScene.description}` },
  ]);
  return String(out.prompt || `the scene slowly transforms into: ${toScene.description}`).trim();
}

async function generateBridge(movie, bridge, tmpDir) {
  const fromScene = movie.scenes.find(s => s.id === bridge.fromSceneId);
  const toScene = movie.scenes.find(s => s.id === bridge.toSceneId);
  if (!fromScene?.clip?.url) throw new Error('previous clip missing');
  if (!toScene?.panel?.url) throw new Error('next panel missing');

  // Last frame of the outgoing clip → permanent URL Replicate can fetch.
  const clipFile = path.join(tmpDir, `${bridge.id}-from.mp4`);
  const { buffer } = await fetchBuffer(fromScene.clip.url);
  fs.writeFileSync(clipFile, buffer);
  const frameFile = path.join(tmpDir, `${bridge.id}-frame.png`);
  await extractLastFrame(clipFile, frameFile);
  const frameUrl = await saveBufferToStorage(fs.readFileSync(frameFile), 'image/png', 'movies/frames');
  if (frameUrl.startsWith('data:')) throw new Error('bridges need Firebase Storage (permanent frame URLs)');

  const style = (movie.motionStyle || ART_LOCK).trim();
  const prompt = `${style} ${bridge.prompt}`.trim();
  const m = VIDEO_MODELS.draft;
  const p = await replicatePredict(m.version, {
    image: frameUrl,
    last_image: toScene.panel.url,
    prompt,
    resolution: '480p',
    num_frames: 121,
    frames_per_second: 16,
    interpolate_output: true,
    go_fast: true,
  });
  const output = Array.isArray(p.output) ? p.output[0] : p.output;
  if (!output) throw new Error('bridge produced no output');
  const url = await saveUrlToStorage(output, 'movies/clips', 'video/mp4');
  const cost = m.costPerClip(121);
  bridge.clip = { url, status: 'done', error: null, cost, promptUsed: prompt };
  movie.spend = +((movie.spend || 0) + cost).toFixed(2);
  fileVideoToCreations({
    url, poster: toScene.panel?.url, prompt,
    model: 'wan-2.2-i2v-fast', quality: 'bridge',
  });
}

// ─── The zine: the same story as captioned pages ────────────────────
// Every movie can also BE a zine — same scenes, same style reference, but
// composed into hand-lettered 2x2 pages (the reference page's own format)
// instead of animated. Captions = the scene titles. Validated live: captions
// render spelled-exactly in the reference's lettering at medium quality.
const ZINE_LAYOUTS = {
  4: 'Draw a 2x2 grid of four rectangular panels',
  3: 'Draw three equal rectangular panels stacked vertically',
  2: 'Draw two equal rectangular panels stacked vertically',
  1: 'Draw one large single panel filling the page',
};

function zinePagePrompt(movie, group) {
  const positions = group.length === 4
    ? ['top left', 'top right', 'bottom left', 'bottom right']
    : group.length === 1 ? ['full page'] : group.map((_, i) => `position ${i + 1} from the top`);
  const body = group.map((s, i) =>
    `Panel ${i + 1} (${positions[i]}): ${s.imagePrompt}. Caption: "${s.title.toUpperCase()}"`).join(' ');
  const layout = `${ZINE_LAYOUTS[group.length]}, each with a small hand-lettered caption box beneath it containing EXACTLY the given caption text, spelled exactly as written. `;
  if (styleRef) {
    return 'Copy the styling of the attached image exactly — including its hand-lettered ' +
      'caption boxes — but do NOT copy its content or subjects. ' + layout + body;
  }
  return `${(movie.imageStyle || DEFAULT_IMAGE_STYLE).trim()} ${layout}${body}`;
}

function zineCoverPrompt(movie) {
  const subject = movie.characters
    ? `${movie.characters} — one single iconic image capturing the story: ${movie.title}`
    : `one single iconic image capturing the story: ${movie.title}`;
  if (styleRef) {
    return 'Copy the styling of the attached image exactly — including its hand-drawn ' +
      `lettering — but do NOT copy its content or subjects. Draw a zine COVER page: ` +
      `the title "${movie.title.toUpperCase()}" hand-lettered prominently near the top, ` +
      `spelled exactly as written, above one full-page illustration of ${subject}. ` +
      'No other text anywhere.';
  }
  return `${(movie.imageStyle || DEFAULT_IMAGE_STYLE).trim()} A zine cover: the title ` +
    `"${movie.title.toUpperCase()}" hand-lettered prominently near the top, above one ` +
    `full-page illustration of ${subject}. No other text.`;
}

async function renderZinePage(movie, basePrompt, quality) {
  const { refs, prompt } = await panelRefs(movie, basePrompt);
  const buf = refs.length
    ? await openaiPanelEdit(prompt, refs, quality)
    : await openaiPanel(prompt, quality);
  return { url: await saveBufferToStorage(buf, 'image/webp', 'movies/zines'), prompt };
}

async function makeZine(movie, quality, progress) {
  const groups = [];
  for (let i = 0; i < movie.scenes.length; i += 4) groups.push(movie.scenes.slice(i, i + 4));
  const total = groups.length + 1;
  const pages = [];
  await progress(0, total, 'drawing the cover');
  const cover = await renderZinePage(movie, zineCoverPrompt(movie), quality);
  pages.push({ url: cover.url, promptUsed: cover.prompt, cover: true, sceneIds: [] });
  movie.spend = +((movie.spend || 0) + (PANEL_COST[quality] || 0.06)).toFixed(2);
  await progress(1, total, 'drawing pages');

  let done = 1;
  const results = await pool(groups, 2, async (group) => {
    const page = await renderZinePage(movie, zinePagePrompt(movie, group), quality);
    movie.spend = +((movie.spend || 0) + (PANEL_COST[quality] || 0.06)).toFixed(2);
    await progress(++done, total, 'drawing pages');
    return { url: page.url, promptUsed: page.prompt, cover: false, sceneIds: group.map(s => s.id) };
  });
  // Keep pages in story order (pool preserves index order); keep what
  // succeeded even if some pages failed so nothing paid-for is lost.
  results.forEach(r => { if (r.ok) pages.push(r.value); });
  if (movie.zine?.pages?.length) {
    movie.zineHistory = [...(movie.zineHistory || []), movie.zine].slice(-3);
  }
  movie.zine = { pages, quality, madeAt: new Date().toISOString() };
  const failed = results.filter(r => !r.ok).length;
  if (failed) throw new Error(`${failed} of ${groups.length} pages failed — the finished pages are kept; remake to fill the gaps`);
}

// ─── Multi-character cast for a dream ───────────────────────────────
// A dream has no key-scene approval step, so we automate the movies anchor
// trick — but a dream usually has SEVERAL recurring people (dad, J, Sean…),
// not one. So each named cast member is drawn ONCE as a clean labelled
// reference sheet, and every page attaches the sheets for whoever appears on
// it, naming each by attachment position, so the same face/hair/clothes carry
// across pages instead of drifting. (This mirrors how ChatGPT keeps multiple
// characters consistent: a named reference per character, all attached, each
// named in the prompt. gpt-image-2's edits endpoint takes an array of images.)

// Normalize to a cast[] on the doc — synthesize one from the legacy single
// `characters` string / `characterAnchor` for dreams made before the upgrade.
function normalizeDreamCast(dream) {
  if (Array.isArray(dream.cast) && dream.cast.length) return;
  dream.cast = dream.characters
    ? [{ name: 'the character', look: dream.characters, url: dream.characterAnchor?.url || null }]
    : [];
}

// The named characters appearing on a page — the union of the group's beats' `who`.
function dreamNamesOnPage(group) {
  const names = new Set();
  for (const b of group) if (Array.isArray(b.who)) b.who.forEach(n => names.add(String(n)));
  return names;
}

// Which ALREADY-DRAWN pages to feed back as this page's character reference. For
// each recurring character on this page, use the earliest earlier page that
// showed them — so a face is carried from the page it first appeared on, no
// separate reference sheets. Deduped by page and capped at three (+ style ref =
// four attachments). A character making their first appearance here has no
// earlier page and is simply drawn fresh. When the beats never named anyone
// (legacy docs), fall back to the most recent earlier page as a whole "keep the
// same people and style" reference.
function dreamPageRefs(group, rendered) {
  if (!rendered.length) return [];
  const names = dreamNamesOnPage(group);
  const byUrl = new Map();                       // url -> Set(names carried from it)
  for (const name of names) {
    const src = rendered.find(p => p.who.has(name));   // earliest page with this character
    if (!src) continue;                                // first appearance — nothing to carry
    if (!byUrl.has(src.url)) byUrl.set(src.url, new Set());
    byUrl.get(src.url).add(name);
  }
  let refs = [...byUrl.entries()].map(([url, set]) => ({ url, names: [...set] }));
  // Always ride the MOST RECENT page along too (style/scene continuity between
  // consecutive pages), not just each character's earliest anchor. Dreams are
  // split into separate docs upstream, so this never chains across dreams.
  const last = rendered[rendered.length - 1];
  if (last && !refs.some(r => r.url === last.url)) refs = [...refs.slice(0, 2), { url: last.url, names: [] }];
  return refs.slice(0, 3);
}

// A dream comic page prompt: the 2x2 layout + captions (like the zine), plus a
// preamble that names the style ref and each attached EARLIER PAGE (and which
// characters to carry from it) by attachment position. Kept separate from the
// movie zine prompt so the movie path (single anchor) is untouched.
function dreamZinePagePrompt(dream, group, refPages) {
  const positions = group.length === 4
    ? ['top left', 'top right', 'bottom left', 'bottom right']
    : group.length === 1 ? ['full page'] : group.map((_, i) => `position ${i + 1} from the top`);
  const body = group.map((s, i) =>
    `Panel ${i + 1} (${positions[i]}): ${s.imagePrompt}. Caption: "${String(s.title).toUpperCase()}"`).join(' ');
  const layout = `${ZINE_LAYOUTS[group.length]}, each with a small hand-lettered caption box beneath it containing EXACTLY the given caption text, spelled exactly as written. `;
  const offset = styleRef ? 2 : 1;   // attachment number of the first reference image
  const pageLines = refPages.map((r, i) => {
    if (r.character) {
      return `the #${i + offset} attached image is a CHARACTER REFERENCE for ${r.names.join(' and ')} — whenever ` +
        `${r.names.join(' or ')} appears, draw them with the exact same face, hair and clothing as in it; do not redesign them`;
    }
    if (!r.names.length) {
      return `the #${i + offset} attached image is an EARLIER PAGE of this same comic — keep the drawing style ` +
        'and scenery consistent with it';
    }
    const who = r.names.join(' and ');
    return `the #${i + offset} attached image is an EARLIER PAGE of this same comic — draw ${who} with the exact ` +
      'same face, hair and clothing they have there, and do not redesign them';
  }).join('; ');
  // One-off figures must never inherit a recurring character's face — only the
  // people named above repeat (this bled once: a bench stranger got drawn as
  // the crying woman from an earlier page).
  const distinctNote = refPages.length
    ? ' Any character NOT named above is a DIFFERENT person — give them their own distinct new face and look; never reuse a face from the attached images for them.'
    : '';
  let refNote = '';
  if (styleRef && refPages.length) {
    refNote = 'The FIRST attached image is a STYLE reference — copy its hand-lettered drawing style exactly, ' +
      `but do NOT copy its content or subjects. For character continuity, ${pageLines}. `;
  } else if (styleRef) {
    refNote = 'Copy the styling of the attached image exactly — including its hand-lettered ' +
      'caption boxes — but do NOT copy its content or subjects. ';
  } else if (refPages.length) {
    refNote = `For character continuity, ${pageLines}. `;
  }
  const stylePrefix = styleRef ? '' : `${(dream.imageStyle || DEFAULT_IMAGE_STYLE).trim()} `;
  // The dreamer's self-description (witch app's describe-yourself step): the
  // "me"/"I" of the captions is a real person — draw them (and anyone else
  // described) to match, in every panel where they appear.
  const lookNote = dream.dreamerLook
    ? `Character appearance — the dreamer is the "me"/"I" of this dream: ${String(dream.dreamerLook).trim()}. Draw the people to match this description in every panel where they appear. `
    : '';
  return `${stylePrefix}${refNote}${lookNote}${distinctNote}${layout}${body}`;
}

// ─── One softened redraw after a safety refusal ─────────────────────
// The refused wording is the dreamer's own, and Sophie's call (2026-08-06) is
// that rewording her sentences is fine — so a refused page is redrawn ONCE with
// the narrative rephrased around whatever tripped the filter. Only the
// NARRATIVE is rewritten (the page's slice of the dream, its captions, the
// whole-dream context line); every structural instruction — style reference,
// character-continuity clauses, layout, attachment numbering — is rebuilt
// untouched around the result, so softening can never scramble the references.
// Pass 1 — REFRAME. The wording of this prompt is empirically calibrated against
// gpt-image-2's filter (probed 2026-08-06 on the refused page): "feed it milk
// from her breasts", "breastfeed the baby" and even the vaguer "feed it milk
// from her body" are all REFUSED, while "nurse the baby" and "feed the baby"
// are ACCEPTED. So a euphemistic word-swap is the wrong move — the first version
// of this prompt said "rephrase only what is likely to trip it" and the model
// dutifully produced "from her body", which was refused again. Reframing the
// ACTION in ordinary verbs is what actually passes.
const SOFTEN_SYSTEM =
  "You rewrite a short piece of dream narrative so an image generator's automated "
  + 'safety filter will accept it, without changing what happens. '
  + 'The filter fires on explicit references to bodies and bodily substances, '
  + 'especially anywhere near a child — but it accepts the SAME EVENT described '
  + 'with an ordinary everyday verb. Being VAGUER DOES NOT HELP: "feed it milk '
  + 'from her body" is refused exactly like "from her breasts", while "nurse the '
  + 'baby" is accepted. So do not swap a word for a euphemism — REFRAME THE '
  + 'ACTION as a plainly drawable, wholesome scene in the fewest ordinary words. '
  + 'Rules: never name a body part or a bodily substance; use concrete everyday '
  + 'verbs (nurse, feed, hold, carry, wash, dress); keep every event, person and '
  + 'detail — do not censor the story and do not add anything; keep the dreamer\'s '
  + 'first-person voice and keep each caption about as long as it was. '
  + 'Worked example: "Then she went to feed it milk from her breasts." becomes '
  + '"Then she went to nurse the baby." '
  + 'Reply with JSON having EXACTLY the same keys and array lengths as the input, '
  + 'every string rewritten in place.';

// Pass 2 — DROP IT. Pass 1's rewrite was refused too, so stop trying to say the
// thing a different way and describe only what can be drawn. Losing one detail
// beats losing the whole page (and the page is what Sophie is waiting for).
const SOFTEN_SYSTEM_HARD = SOFTEN_SYSTEM
  + ' SECOND PASS: the text you are given has ALREADY been softened once and was '
  + 'STILL refused. This time DROP the sensitive detail entirely instead of '
  + 'rephrasing it — describe only the part of the moment that can be drawn '
  + 'plainly (who is there, where they are, the plain visible action), and let '
  + 'the caption say only that. A shorter caption that loses a detail is the '
  + 'correct outcome here.';

// Merge the rewriter's reply onto the original, shape-for-shape: any string it
// dropped, emptied or changed the type of falls back to the original, so a
// sloppy reply can never blank out a caption or lose a panel.
function mergeSoftened(orig, out) {
  if (typeof orig === 'string') return (typeof out === 'string' && out.trim()) ? out : orig;
  if (Array.isArray(orig)) {
    if (!Array.isArray(out) || out.length !== orig.length) return orig;
    return orig.map((v, i) => mergeSoftened(v, out[i]));
  }
  if (orig && typeof orig === 'object') {
    if (!out || typeof out !== 'object' || Array.isArray(out)) return orig;
    const res = {};
    for (const k of Object.keys(orig)) res[k] = mergeSoftened(orig[k], out[k]);
    return res;
  }
  return orig;
}

async function softenRefusedNarrative(bundle, pass = 1) {
  try {
    const out = await openaiChatJSON([
      { role: 'system', content: pass > 1 ? SOFTEN_SYSTEM_HARD : SOFTEN_SYSTEM },
      { role: 'user', content: JSON.stringify(bundle) },
    ], { model: 'gpt-4o-mini', temperature: 0.3, retries: 1 });
    const softened = mergeSoftened(bundle, out);
    // Nothing actually changed → the redraw would be refused identically.
    if (JSON.stringify(softened) === JSON.stringify(bundle)) return null;
    return softened;
  } catch (err) {
    console.warn('movies: could not soften a refused page —', err.message);
    return null;
  }
}

const REFUSAL_MESSAGE = "gpt-image-2's safety filter refused this part of the dream, "
  + 'and refused it again after two passes of softer wording';
function refusalError() {
  const err = new Error(REFUSAL_MESSAGE);
  err.terminal = true;   // drawPagesResilient must not retry this page
  return err;
}

// The refusal control flow, with both of its effects injected so it can be
// tested without spending a cent at OpenAI (scripts/test-dream-refusal.js).
// A safety refusal softens and redraws, escalating up to `passes` times (each
// pass rewrites the ALREADY-softened text, so pass 2 works from pass 1's output
// and drops the detail instead of rephrasing it). A refused request is rejected
// before generation and costs nothing, so the extra passes only ever spend time
// — and a refusal comes back fast. EVERY other error propagates untouched, so
// real hiccups still get drawPagesResilient's rounds.
async function softenOnRefusal(bundle, draw, soften, passes = 2) {
  try {
    return await draw(bundle);
  } catch (err) {
    if (!isSafetyRefusal(err)) throw err;
    let current = bundle;
    for (let pass = 1; pass <= passes; pass++) {
      const soft = await soften(current, pass);
      if (!soft) break;         // nothing changed → redrawing is pointless
      console.warn(`movies: page refused by the safety filter — redrawing with softened wording (pass ${pass})`);
      try {
        return { ...await draw(soft), softened: true };
      } catch (err2) {
        if (!isSafetyRefusal(err2)) throw err2;
        current = soft;         // escalate from what we just tried
      }
    }
    throw refusalError();
  }
}

// Draw a page from its narrative bundle; `build(bundle)` returns the full prompt.
// `used` comes back as the bundle the finished picture was actually drawn from —
// the softened one when softening fired — so the caller can record what the page
// really says alongside the dreamer's original words.
async function drawWithSoftening(bundle, build, refs, quality, size = PORTRAIT) {
  return softenOnRefusal(bundle, async b => {
    const prompt = build(b);
    const buf = refs.length
      ? await openaiPanelEdit(prompt, refs, quality, 2, size)
      : await openaiPanel(prompt, quality, 2, size);
    return { buf, prompt, used: b };
  }, softenRefusedNarrative);
}

// Render one dream page: style ref first, then the earlier pages we're carrying
// characters from (the ones already drawn), with the prompt naming each by
// attachment position.
async function renderDreamPage(dream, group, quality, rendered) {
  const refs = [];
  if (styleRef) refs.push(styleRef);
  const usable = [];
  // Pre-made character cards (e.g. the saved "Sophie" reference) ride on EVERY
  // page, right after the style ref, so the main character matches her card
  // from page one instead of being invented on the first page.
  for (const c of (Array.isArray(dream.characterRefs) ? dream.characterRefs : [])) {
    if (!c || !c.url || !c.name) continue;
    const buf = await refBufferFromUrl(c.url);
    if (buf) { refs.push(buf); usable.push({ url: c.url, names: [String(c.name)], character: true }); }
  }
  for (const r of dreamPageRefs(group, rendered)) {
    const buf = await refBufferFromUrl(r.url);
    if (buf) { refs.push(buf); usable.push(r); }
  }
  const bundle = {
    panels: group.map(s => ({ scene: String(s.imagePrompt || ''), caption: String(s.title || '') })),
  };
  const build = b => dreamZinePagePrompt(dream, group.map((s, i) => ({
    ...s, imagePrompt: b.panels[i].scene, title: b.panels[i].caption,
  })), usable);
  const { buf, prompt, softened, used } = await drawWithSoftening(bundle, build, refs, quality);
  return {
    url: await saveBufferToStorage(buf, 'image/webp', 'movies/zines'),
    prompt, softened: !!softened, used: used || bundle,
  };
}

// ─── Resilient page drawing ─────────────────────────────────────────
// Draw every planned page, then RE-TRY the failures in up to two more rounds
// with a real pause before each. Each render call already retries its own
// HTTP hiccups, but those retries span only a few seconds — a network blip
// that lasts a minute used to burn through every page's attempts and drop
// them all (the 2026-07-30 "3 of 3 pages failed" render). The rounds spread
// attempts over ~a minute so the blip heals inside the job. Failures keep
// their error messages (they used to be discarded) so the job error says WHY.
// `drawOne(i, slots)` renders slot i (slots = all pages so far, sparse, for
// carry-over refs); `persist(slots)` runs after every landed page so pages
// already paid for survive a crash or a Render restart mid-job.
async function drawPagesResilient(total, drawOne, progress, persist) {
  const slots = new Array(total).fill(null);
  const errors = new Map();
  const terminal = new Set();   // refused pages — waiting changes nothing
  const pauses = [0, 20000, 45000];
  for (let round = 0; round < pauses.length; round++) {
    const missing = [];
    for (let i = 0; i < total; i++) if (!slots[i] && !terminal.has(i)) missing.push(i);
    if (!missing.length) break;
    if (round) {
      await progress(total - missing.length, total,
        `retrying ${missing.length} page${missing.length > 1 ? 's' : ''}`);
      await new Promise(r => setTimeout(r, pauses[round]));
    }
    for (const i of missing) {
      try {
        slots[i] = await drawOne(i, slots);
        errors.delete(i);
        await persist(slots);
      } catch (err) {
        errors.set(i, err.message);
        if (err.terminal || isSafetyRefusal(err)) terminal.add(i);
        console.warn(`movies: dream page ${i + 1}/${total} failed (round ${round + 1}) —`, err.message);
      }
      await progress(slots.filter(Boolean).length, total, 'drawing pages');
    }
  }
  const failed = total - slots.filter(Boolean).length;
  if (failed) {
    const why = [...new Set(errors.values())].join('; ').slice(0, 400);
    // A refusal isn't a failed retry — saying "after 3 rounds of retries" made
    // a content refusal read like a network fault. Name what actually happened.
    const allRefused = terminal.size === failed;
    throw new Error(`${failed} of ${total} page${total > 1 ? 's' : ''} couldn't be drawn`
      + (allRefused ? '' : ' after 3 rounds of retries')
      + (why ? ` — ${why}` : '')
      + '. The finished pages are kept — re-render to fill the gaps.');
  }
  return slots;
}

// ─── Dream pages: the beats drawn as a comic ────────────────────────
// The same 2x2 style engine the zine uses, but the captions are the beats'
// own caption lines (not scene titles) and there is no cover. Beats pack
// four-to-a-page; a short tail page lays out with fewer. Pages render IN ORDER,
// and each one feeds the already-drawn earlier pages back in as its character
// reference — a recurring face is carried from the page it first appeared on,
// so no separate reference sheets are generated (cheaper, and it uses the real
// drawn look).
async function makeDreamPages(dream, quality, progress) {
  const items = (dream.beats || []).map(b => ({
    id: b.id, imagePrompt: b.imagePrompt, title: b.caption || '', who: Array.isArray(b.who) ? b.who : [],
  }));
  const groups = [];
  for (let i = 0; i < items.length; i += 4) groups.push(items.slice(i, i + 4));
  normalizeDreamCast(dream);   // keep cast[{name,look}] metadata for readers
  const total = groups.length;
  await progress(0, total, 'drawing pages');
  const persist = dreamPagePersister(dream, quality);
  await drawPagesResilient(total, async (i, slots) => {
    // Earlier pages as character refs — { url, who:Set<name> }, in page order.
    const rendered = [];
    slots.forEach((pg, j) => {
      if (!pg) return;
      const who = new Set();
      groups[j].forEach(s => (s.who || []).forEach(n => who.add(String(n))));
      rendered.push({ url: pg.url, who });
    });
    const page = await renderDreamPage(dream, groups[i], quality, rendered);
    dream.spend = +((dream.spend || 0) + (PANEL_COST[quality] || 0.06)).toFixed(2);
    const rec = {
      url: page.url, promptUsed: page.prompt, beatIds: groups[i].map(s => s.id),
      softened: !!page.softened,
    };
    // This path keeps its captions on dream.beats[].caption, so nothing of hers
    // is overwritten — but a softened page still records what it actually
    // letters, beside her originals, for the same auditability as V2.
    if (page.softened) {
      rec.captions = ((page.used || {}).panels || []).map(p => p.caption);
      rec.captionsOriginal = groups[i].map(s => s.title || '');
    }
    return rec;
  }, progress, persist);
}

// Shared by both render paths: the first page that lands rotates the previous
// render into pageHistory ("re-rolls are never lost"), then dream.pages tracks
// every page as it arrives — persisted by the job's throttled saves, so a
// crash or Render restart mid-render never loses pages already paid for. A
// render where NOTHING lands leaves the previous pages untouched.
function dreamPagePersister(dream, quality) {
  let rotated = false;
  return (slots) => {
    if (!rotated) {
      if (dream.pages?.length) {
        dream.pageHistory = [...(dream.pageHistory || []), { pages: dream.pages, quality: dream.pagesQuality, madeAt: dream.pagesMadeAt }].slice(-3);
      }
      rotated = true;
      dream.pagesQuality = quality;
    }
    dream.pages = slots.filter(Boolean);
    dream.pagesMadeAt = new Date().toISOString();
  };
}

// ─── Dream pages v2 (staged flow): allot text per image, then draw ──
// No beats: the model decides how many IMAGES the dream needs and which exact
// slice of the dreamer's words each image tells. The image model gets the
// whole dream for context plus its allotment, the style ref, and ONLY that
// slot's approved characters — and lays out its own page (no fixed 2x2).
async function dreamPaginate(dream, castNames) {
  // Page count follows the SHAPE of the dream, not a flat "lean toward few".
  // The old wording ("lean toward FEW … even a long, rambly one is usually 2-3")
  // over-steered: measured 2026-08-08 on the real dreams, it chose ONE image
  // three times out of three for a dream that visits five different places, and
  // the single page's captions then spanned the whole arc from arriving to
  // waking. Swept over four dreams x3 runs each: a five-scene dream went 1,1,1
  // -> 2,2,2 and a two-scene one 1,1,1 -> 3,3,3, while a genuinely one-scene
  // dream stayed 1,1,1 — which is the property that matters, since the same
  // planner serves the dream illustrator and must not inflate a short dream.
  const sys = `You are planning a short hand-drawn comic that tells someone's real dream. Decide how many IMAGES it needs by the SHAPE OF THE DREAM: one image per distinct scene — a change of place, of company, or a real turn in what is happening. Moments that share a setting belong on ONE image (an image can be drawn as multiple panels), so do NOT make one image per sentence; but a dream that moves somewhere new needs a new image, because a single drawing cannot show two different places. A one-scene dream is ONE image; a dream that wanders through four places is FOUR. Return STRICT JSON and nothing else:
{"pages": [
  {"text": the slice of the dream this image covers, in the TRUE order events happened — use the dreamer's cues ("before that", "at first", "right before I woke up") to fix out-of-order narration; reorder whole passages if needed. This is CONTEXT for what to draw, not the caption,
   "captions": [1 to 3 short hand-lettered caption lines for this image, IN ORDER, narrating this part in the DREAMER'S OWN WORDS AND VOICE. Use their actual phrasing — lightly clean the worst filler ("like", "you know", "I mean", "um", stutters/false starts) but KEEP their real words and tone; do NOT rewrite them to sound darker, more poetic, or more "haunting" to match the art. Each line up to ~15 words. Together the lines should let the dreamer narrate what's happening on this page — err toward keeping MORE of their voice, not less. [] only if this image truly needs no words],
   "who": [names from the CAST list of the people who appear in THIS image] ([] if none)}
]}
RULES: 1 to 6 pages — as many as the dream has scenes, merging only moments that share a setting. Captions are the dreamer's real words (their voice, lightly cleaned) — several short lines are welcome, not one terse line. "who" must use CAST names EXACTLY as given, only names from that list.`;
  const cues = (dream.driftCues || []).length
    ? `\n\nPhrases narrated out of chronological order (use these to restore the true order): ${JSON.stringify(dream.driftCues)}`
    : '';
  const user = `The dream:\n\n${dream.dreamText || dream.dream}${cues}\n\nCAST: ${JSON.stringify(castNames)}`;
  const out = /claude/i.test(DREAM_BREAKDOWN_MODEL)
    ? await anthropicChatJSON(sys, user, { maxTokens: 4000 })
    : await openaiChatJSON(
        [{ role: 'system', content: sys }, { role: 'user', content: user }],
        { model: DREAM_BREAKDOWN_MODEL, reasoningEffort: 'low', retries: 2 });
  const nameSet = new Set(castNames);
  const pages = (Array.isArray(out.pages) ? out.pages : [])
    .map(p => {
      // Accept the new `captions` array; tolerate an older single `caption`.
      let caps = Array.isArray(p.captions) ? p.captions
        : (p.caption ? [p.caption] : []);
      caps = caps.map(c => String(c || '').trim()).filter(Boolean).slice(0, 3).map(c => c.slice(0, 120));
      return {
        text: String(p.text || '').trim(),
        captions: caps,
        who: (Array.isArray(p.who) ? p.who : []).map(n => String(n).trim()).filter(n => nameSet.has(n)),
      };
    })
    .filter(p => p.text)
    .slice(0, 6);
  if (!pages.length) throw new Error('page planning produced no pages');
  return pages;
}

// One v2 page: style ref first, then THIS slot's approved character cards,
// then earlier pages (characters carried from the page they first appeared
// on). Described-but-unsaved characters ride as text continuity lines.
async function renderDreamPageV2(dream, plan, idx, total, quality, rendered) {
  const cast = Array.isArray(dream.castApproved) ? dream.castApproved : [];
  const onPage = cast.filter(c => (plan.who || []).includes(c.name));
  const refs = [];
  if (styleRef) refs.push(styleRef);
  const clauses = [];
  let n = refs.length + 1;
  for (const c of onPage) {
    if (!c.url) continue;
    const buf = await refBufferFromUrl(c.url);
    if (!buf) continue;
    refs.push(buf);
    clauses.push(`the #${n++} attached image is a CHARACTER REFERENCE for ${c.name} — whenever ` +
      `${c.name} appears, draw them with the exact same face, hair and clothing as in it; do not redesign them`);
  }
  for (const r of dreamPageRefs([{ who: plan.who || [] }], rendered)) {
    const buf = await refBufferFromUrl(r.url);
    if (!buf) continue;
    refs.push(buf);
    clauses.push(r.names.length
      ? `the #${n++} attached image is an EARLIER PAGE of this same comic — draw ${r.names.join(' and ')} with the exact same face, hair and clothing they have there, and do not redesign them`
      : `the #${n++} attached image is an EARLIER PAGE of this same comic — keep the drawing style and scenery consistent with it`);
  }
  for (const c of onPage) {
    if (c.url || !c.desc) continue;
    clauses.push(`${c.name} is ${c.desc} — keep ${c.name} looking exactly the same everywhere they appear`);
  }
  const styleIntro = styleRef
    ? 'The FIRST attached image is a STYLE reference — copy its hand-lettered drawing style exactly, but do NOT copy its content or subjects. '
    : `${(dream.imageStyle || DEFAULT_IMAGE_STYLE).trim()} `;
  const continuity = clauses.length
    ? `For continuity: ${clauses.join('; ')}. Any character NOT named above is a DIFFERENT person — give them their own distinct new face and look; never reuse a face from the attached images for them. `
    : '';
  const caps = Array.isArray(plan.captions) ? plan.captions.filter(Boolean)
    : (plan.caption ? [plan.caption] : []);
  const bundle = {
    context: String(dream.dreamText || dream.dream || ''),
    text: String(plan.text || ''),
    captions: caps.map(String),
  };
  const build = b => {
    const capInstr = b.captions.length
      ? `Hand-letter ${b.captions.length === 1 ? 'this caption' : 'these ' + b.captions.length + ' captions, in order,'} onto the page as small caption boxes in the dreamer's handwriting, each spelled EXACTLY as written and nothing added: ${b.captions.map(c => `"${c}"`).join(', ')}.`
      : 'Add a short hand-lettered caption in the dreamer\'s own voice.';
    return `${styleIntro}${continuity}`
      + `This is page ${idx + 1} of ${total} of a hand-drawn comic telling a real dream. `
      + `The whole dream, for context only: "${b.context}". `
      + `THIS page covers ONLY this part of it: "${b.text}". Draw only that part. `
      + 'Decide the page layout yourself — one full-page drawing or a few panels, whatever tells this part best. '
      + capInstr;
  };
  const { buf, prompt, softened, used } = await drawWithSoftening(bundle, build, refs, quality);
  return {
    url: await saveBufferToStorage(buf, 'image/webp', 'movies/zines'),
    prompt, softened: !!softened, used: used || bundle,
  };
}

async function makeDreamPagesV2(dream, quality, progress) {
  const castNames = (Array.isArray(dream.castApproved) ? dream.castApproved : []).map(c => c.name);
  await progress(0, 0, 'planning pages');
  const plans = await dreamPaginate(dream, castNames);
  dream.pagePlan = plans;
  const total = plans.length;
  await progress(0, total, 'drawing pages');
  const persist = dreamPagePersister(dream, quality);
  await drawPagesResilient(total, async (i, slots) => {
    const rendered = slots.filter(Boolean).map(pg => ({ url: pg.url, who: new Set(pg.who || []) }));
    const page = await renderDreamPageV2(dream, plans[i], i, total, quality, rendered);
    dream.spend = +((dream.spend || 0) + (PANEL_COST[quality] || 0.06)).toFixed(2);
    // `text`/`captions` are what the picture ACTUALLY says (softened when the
    // filter forced it), so anything rendering captions from the doc matches the
    // drawing. Sophie's own words are kept beside them whenever they differ —
    // the dream is a record of what she said, and a content filter must never
    // silently replace her sentence with a paraphrase. Only present when
    // softening fired, so ordinary pages carry no redundant copy.
    const used = page.used || {};
    const rec = {
      url: page.url, promptUsed: page.prompt,
      text: used.text || plans[i].text,
      captions: used.captions || plans[i].captions || [],
      who: plans[i].who || [],
      softened: !!page.softened,
    };
    if (page.softened) {
      const origText = plans[i].text || '';
      const origCaps = plans[i].captions || [];
      if (rec.text !== origText) rec.textOriginal = origText;
      if (JSON.stringify(rec.captions) !== JSON.stringify(origCaps)) rec.captionsOriginal = origCaps;
    }
    return rec;
  }, progress, persist);
}

/* ── ONE STRONG IMAGE — the dream app's drawing (Sophie, Aug 2026) ────────
   "the images shud default to square and medium quality and just one image.
   prompt shud say 'pick one strong image,' and embellish it w the other
   details of the dream, rather than comic book style."

   So this is NOT dreamPaginate with the page count pinned to one: that planner
   cuts a dream into scenes and writes hand-lettered captions, and a
   one-scene slice of a wandering dream is a thinner picture, not a stronger
   one. Here the model picks the moment with the most to look at and then
   FOLDS THE REST OF THE DREAM INTO IT — the places, objects and weather that
   happened elsewhere in the night — so one square carries as much of the
   dream as it can hold.

   dreamPaginate is left exactly as it is: the witch app's dream illustrator
   and the zine still draw comics through it, and its page-count wording is a
   measured finding (2026-08-08) that must not be re-tuned from here. */
const DREAM_IMAGE_SYSTEM = `You are choosing ONE picture to illustrate someone's real dream.

PICK ONE STRONG IMAGE — the single moment of the dream with the most to look at — and then EMBELLISH IT WITH THE OTHER DETAILS OF THE DREAM: fold in the places, people, objects, animals, weather and small strangenesses from the rest of the night so the one picture carries as much of the dream as it can hold. Details from elsewhere in the dream belong IN this picture — behind the moment, around its edges, out a window, on the walls — not in a second image.

This is NOT a comic: no panels, no grid, no caption boxes, no lettering, no speech bubbles, no page layout.

Return STRICT JSON and nothing else:
{"image": "one paragraph describing exactly what to draw: the moment, who is in it and what they are doing, where it is, what surrounds them, the light, the weather, the mood, and the details folded in from the rest of the dream. Describe a PICTURE, not a story — no 'then', no 'later'. The dreamer is drawn from behind or in the scene like anyone else; do not invent a portrait of a real face. No text or lettering anywhere in it."}`;

async function dreamImagePlan(dream) {
  const user = `The dream:\n\n${dream.dreamText || dream.dream || ''}`;
  const out = /claude/i.test(DREAM_BREAKDOWN_MODEL)
    ? await anthropicChatJSON(DREAM_IMAGE_SYSTEM, user, { maxTokens: 1200 })
    : await openaiChatJSON(
        [{ role: 'system', content: DREAM_IMAGE_SYSTEM }, { role: 'user', content: user }],
        { model: DREAM_BREAKDOWN_MODEL, reasoningEffort: 'low', retries: 2 });
  const image = String(out && out.image ? out.image : '').trim();
  if (!image) throw new Error('the dream could not be turned into a picture');
  return image;
}

// One square picture, drawn through the same softening path as every other
// dream render — a safety refusal on a real dream is normal and is answered by
// redrawing it softened, never by retrying the same words.
async function makeDreamImage(dream, quality = 'medium', progress = async () => {}) {
  await progress(0, 1, 'reading the dream');
  const image = await dreamImagePlan(dream);
  dream.imagePlan = image;
  await progress(0, 1, 'drawing it');
  const refs = styleRef ? [styleRef] : [];
  const bundle = { context: String(dream.dreamText || dream.dream || ''), image };
  // The style reference is itself a diary COMIC page, so the no-panels guard
  // has to be said out loud — without it the reference's own shape (grid,
  // caption boxes) comes back in the drawing.
  const build = b =>
    (refs.length
      ? 'The FIRST attached image is a STYLE reference — copy its styling exactly, but do NOT copy its content, its subjects or its layout. '
      : `${DEFAULT_IMAGE_STYLE} `)
    + 'ONE single full-frame illustration of a real dream. Not a comic: no panels, no grid, no caption boxes, no lettering, no speech bubbles, no words anywhere in the picture. '
    + `Draw this: "${b.image}". `
    + `The rest of the dream, for context only — do not draw a second scene: "${b.context}".`;
  const { buf, prompt, softened, used } = await drawWithSoftening(bundle, build, refs, quality, SQUARE);
  dream.spend = +((dream.spend || 0) + (SQUARE_COST[quality] || 0.053)).toFixed(3);
  dream.pages = [{
    url: await saveBufferToStorage(buf, 'image/webp', 'movies/zines'),
    promptUsed: prompt, captions: [], softened: !!softened,
    imagePlan: (used && used.image) || image,
  }];
  await progress(1, 1, 'done');
  return dream.pages[0];
}

// Background jobs run in THIS process — if a stored doc says a job is running
// but this process isn't running it, the process restarted (deploy / crash)
// and the job is dead. Readers flip it to a clear error instead of letting
// the app poll a corpse until a timeout. The grace window covers the brief
// two-instance overlap during a zero-downtime deploy, where the OLD instance
// is still legitimately drawing while the new one answers reads.
const LIVE_DREAM_JOBS = new Set();
const DEAD_JOB_GRACE_MS = 2 * 60 * 1000;
function dreamJobDied(doc) {
  const j = doc && doc.job;
  return !!(j && j.status === 'running' && !LIVE_DREAM_JOBS.has(doc.id)
    && Date.now() - new Date(j.startedAt || 0).getTime() > DEAD_JOB_GRACE_MS);
}

// Same background-job envelope as startJob, but persisted to the dreams
// collection (a dream is not a movie, so it can't ride saveMovie).
async function startDreamJob(dream, kind, fn) {
  if (dream.job && dream.job.status === 'running' && LIVE_DREAM_JOBS.has(dream.id)) {
    const age = Date.now() - new Date(dream.job.startedAt || 0).getTime();
    if (age < 15 * 60 * 1000) throw new Error(`a "${dream.job.kind}" job is already running`);
  }
  dream.job = { kind, status: 'running', done: 0, total: 0, label: 'starting', error: null, startedAt: new Date().toISOString() };
  LIVE_DREAM_JOBS.add(dream.id);
  await saveDream(dream);
  (async () => {
    let lastSave = 0;
    const progress = async (d, t, label) => {
      dream.job = { ...dream.job, done: d, total: t, label };
      if (Date.now() - lastSave > 1500) { lastSave = Date.now(); await saveDream(dream).catch(() => {}); }
    };
    try {
      await fn(progress);
      dream.job = { ...dream.job, status: 'done', label: 'done' };
    } catch (err) {
      console.warn(`movies: dream job ${kind} failed —`, err.message);
      dream.job = { ...dream.job, status: 'error', error: err.message };
    }
    await saveDream(dream).catch(e => console.warn('movies: dream save failed —', e.message));
    LIVE_DREAM_JOBS.delete(dream.id);
  })();
}

// The ordered list of clips that make the movie: enabled scenes (skipping
// merged pair-partners), with dream bridges interleaved when dreamMode is on.
function movieSequence(movie) {
  const seq = [];
  movie.scenes.forEach((scene, idx) => {
    if (isMerged(movie, idx)) return;
    if (scene.edits?.enabled === false) return;
    if (!scene.clip?.url) return;
    if (movie.dreamMode && seq.length) {
      const prev = seq[seq.length - 1];
      const bridge = (movie.bridges || []).find(b =>
        b.fromSceneId === prev.scene.id && b.toSceneId === scene.id && b.clip?.url);
      if (bridge) seq.push({ bridge });
    }
    seq.push({ scene });
  });
  return seq;
}

async function stitchMovie(movie, progress) {
  const seq = movieSequence(movie);
  if (!seq.length) throw new Error('no clips to stitch — generate clips first');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-movie-'));
  try {
    // Download everything first (with retries), then probe the first clip to
    // pick the target frame size all clips normalize to.
    const files = [];
    for (let i = 0; i < seq.length; i++) {
      const item = seq[i];
      const url = item.scene ? item.scene.clip.url : item.bridge.clip.url;
      const file = path.join(tmpDir, `in-${i}.mp4`);
      const { buffer } = await fetchBuffer(url);
      fs.writeFileSync(file, buffer);
      files.push(file);
      progress(i + 1, seq.length * 2 + 1, 'downloading clips');
    }
    const first = await probe(files[0]);
    const target = {
      width: (first.width || 560) - ((first.width || 560) % 2),
      height: (first.height || 704) - ((first.height || 704) % 2),
    };
    const normalized = [];
    for (let i = 0; i < files.length; i++) {
      const item = seq[i];
      const edits = item.scene ? item.scene.edits : {}; // bridges play as generated
      const out = path.join(tmpDir, `norm-${i}.mp4`);
      await normalizeClip(files[i], out, edits || {}, target);
      normalized.push(out);
      progress(seq.length + i + 1, seq.length * 2 + 1, 'applying edits');
    }
    const outFile = path.join(tmpDir, 'movie.mp4');
    await concatClips(normalized, outFile);
    progress(seq.length * 2 + 1, seq.length * 2 + 1, 'uploading');
    const url = await saveBufferToStorage(fs.readFileSync(outFile), 'video/mp4', 'movies/films');
    const { duration } = await probe(outFile).catch(() => ({ duration: 0 }));
    movie.movieUrl = url;
    movie.movieDuration = Math.round(duration * 10) / 10;
    movie.movieStitchedAt = new Date().toISOString();
    recordCut(movie, seq, url, movie.movieDuration);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── Voiceover-clock timeline stitch (narrated films) ───────────────
// A narrated film is built on the VOICEOVER's clock, not on clip lengths: the
// recording plays as one unbroken audio track and the visuals are timed
// underneath it. Each scene has a `startAt` (seconds into the narration); its
// on-screen window runs until the next scene's startAt (the last runs to the
// end of the voiceover). A scene with a clip plays it (trimmed if longer, or
// its last frame frozen if shorter, to exactly fill the window); a scene with
// only a panel holds as a STILL for the window (free — ffmpeg loops the image).
// Everything is letterboxed onto a fixed canvas (portrait 1080x1920 with black
// bars by default) so the frame size stays consistent.
const CANVAS = {
  portrait: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
  square: { width: 1080, height: 1080 },
};

function timelineSequence(movie) {
  return (movie.scenes || [])
    .map((scene) => ({ scene }))
    .filter(({ scene }) => scene.edits?.enabled !== false
      && typeof scene.startAt === 'number' && isFinite(scene.startAt)
      && scene.panel?.url && !scene.panel.url.startsWith('data:'))
    .sort((a, b) => a.scene.startAt - b.scene.startAt);
}

async function fetchToFile(url, file) {
  const { buffer } = await fetchBuffer(url);
  fs.writeFileSync(file, buffer);
  return file;
}

// Build one timeline segment of EXACTLY `windowSec` seconds on the target canvas.
async function buildTimelineSegment(scene, windowSec, target, tmpDir, i) {
  const out = path.join(tmpDir, `seg-${i}.mp4`);
  const enc = ['-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p'];
  const useClip = scene.clip?.url && !scene.clip.url.startsWith('data:') && !scene.still;

  if (useClip) {
    // Normalize the clip (applies the scene's ffmpeg edits) onto the canvas,
    // then fit it to the window: trim if longer, freeze the last frame if short.
    const inFile = await fetchToFile(scene.clip.url, path.join(tmpDir, `clip-${i}.mp4`));
    const mid = path.join(tmpDir, `mid-${i}.mp4`);
    await normalizeClip(inFile, mid, scene.edits || {}, target);
    const { duration } = await probe(mid);
    // setsar=1 on every segment so image-derived stills and video-derived clips
    // share identical pixel/sample aspect and the concat-copy stays lossless.
    if (duration >= windowSec - 0.05) {
      await run(FFMPEG, ['-y', '-i', mid, '-t', String(windowSec), '-vf', 'fps=30,setsar=1', ...enc, '-an', out]);
    } else {
      const pad = Math.max(0, windowSec - duration);
      await run(FFMPEG, ['-y', '-i', mid, '-vf', `tpad=stop_mode=clone:stop_duration=${pad},fps=30,setsar=1`, ...enc, '-an', out]);
    }
  } else {
    // Hold the panel as a still for the whole window (black-bar letterbox).
    const img = await fetchToFile(scene.panel.url, path.join(tmpDir, `panel-${i}.webp`));
    const lb = `scale=${target.width}:${target.height}:force_original_aspect_ratio=decrease,` +
      `pad=${target.width}:${target.height}:(ow-iw)/2:(oh-ih)/2:color=black`;
    await run(FFMPEG, ['-y', '-loop', '1', '-t', String(windowSec), '-i', img,
      '-vf', `${lb},fps=30,setsar=1`, ...enc, '-an', out]);
  }
  return out;
}

async function stitchTimeline(movie, progress) {
  if (!movie.voiceover?.url) throw new Error('attach a voiceover first (POST /:id/voiceover)');
  const voDur = Number(movie.voiceover.duration) || 0;
  if (!voDur) throw new Error('voiceover has no duration — re-attach so it can be transcribed');
  const seq = timelineSequence(movie);
  if (!seq.length) throw new Error('no timed scenes with panels — set each beat\'s startAt and render its panel first');
  const target = CANVAS[movie.aspect] || CANVAS.portrait;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-timeline-'));
  try {
    // Each scene's window = [startAt, nextStartAt]; the last runs to VO end.
    const windows = seq.map((item, i) => {
      const start = Math.max(0, item.scene.startAt);
      const end = i + 1 < seq.length ? Math.max(start, seq[i + 1].scene.startAt) : voDur;
      return Math.max(0, end - start);
    });
    const total = seq.length + 2;
    const segments = [];
    const usedSeq = [];
    for (let i = 0; i < seq.length; i++) {
      if (windows[i] < 0.15) continue; // two beats share a timestamp — skip the empty one
      await progress(i, total, `building beat ${i + 1}/${seq.length}`);
      segments.push(await buildTimelineSegment(seq[i].scene, windows[i], target, tmpDir, i));
      usedSeq.push({ scene: seq[i].scene });
    }
    if (!segments.length) throw new Error('all scene windows were empty — check the startAt values');

    await progress(seq.length, total, 'joining beats');
    const silent = path.join(tmpDir, 'silent.mp4');
    await concatClips(segments, silent);

    // Lay the unbroken voiceover under the assembled visuals.
    await progress(seq.length + 1, total, 'adding voiceover');
    const voFile = await fetchToFile(movie.voiceover.url, path.join(tmpDir, 'voiceover.m4a'));
    const outFile = path.join(tmpDir, 'movie.mp4');
    await run(FFMPEG, ['-y', '-i', silent, '-i', voFile,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outFile]);

    const url = await saveBufferToStorage(fs.readFileSync(outFile), 'video/mp4', 'movies/films');
    const { duration } = await probe(outFile).catch(() => ({ duration: voDur }));
    movie.movieUrl = url;
    movie.movieDuration = Math.round(duration * 10) / 10;
    movie.movieStitchedAt = new Date().toISOString();
    recordCut(movie, usedSeq, url, movie.movieDuration);
    await progress(total, total, 'done');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── Cuts: every stitch is kept, named by what changed ──────────────
// The gallery shows each finished cut with a contact sheet of the frames it
// contains. The name is generated by diffing the sequence + edit lists
// against the previous cut ("trimmed sc 3, slowed sc 7, +2 bridges").
function cutSignature(movie, seq) {
  return seq.filter(i => i.scene).map(i => ({
    id: i.scene.id,
    clipUrl: i.scene.clip?.url || null,
    tier: i.scene.clip?.tier || null,
    edits: { ...(i.scene.edits || {}) },
  }));
}

function nameCut(movie, sig, bridgeCount) {
  const prev = movie.lastCutSig;
  const prevBridges = movie.lastCutBridges || 0;
  if (!Array.isArray(prev)) return 'first cut';
  const num = id => {
    const i = movie.scenes.findIndex(s => s.id === id);
    return i >= 0 ? `sc ${i + 1}` : 'a scene';
  };
  const changes = [];
  const prevById = new Map(prev.map(s => [s.id, s]));
  const currById = new Map(sig.map(s => [s.id, s]));
  for (const s of sig) {
    const p = prevById.get(s.id);
    if (!p) { changes.push(`restored ${num(s.id)}`); continue; }
    if (p.clipUrl !== s.clipUrl) {
      changes.push(p.tier !== s.tier ? `upgraded ${num(s.id)}` : `re-rolled ${num(s.id)}`);
    }
    const pe = p.edits || {}, ce = s.edits || {};
    if ((pe.trimStart || 0) !== (ce.trimStart || 0) || (pe.trimEnd || 0) !== (ce.trimEnd || 0)) changes.push(`trimmed ${num(s.id)}`);
    if ((pe.speed || 1) !== (ce.speed || 1)) changes.push(`${(ce.speed || 1) < (pe.speed || 1) ? 'slowed' : 'sped up'} ${num(s.id)}`);
    if ((pe.freezeEnd || 0) !== (ce.freezeEnd || 0)) changes.push(`froze ${num(s.id)}`);
    if ((pe.fadeOut || 0) !== (ce.fadeOut || 0)) changes.push(`fade on ${num(s.id)}`);
  }
  for (const p of prev) if (!currById.has(p.id)) changes.push(`dropped ${num(p.id)}`);
  const prevOrder = prev.filter(s => currById.has(s.id)).map(s => s.id).join(',');
  const currOrder = sig.filter(s => prevById.has(s.id)).map(s => s.id).join(',');
  if (prevOrder !== currOrder) changes.push('reordered');
  if (bridgeCount !== prevBridges) {
    changes.push(bridgeCount > prevBridges ? `+${bridgeCount - prevBridges} dream bridges` : 'bridges removed');
  }
  if (!changes.length) return 're-stitch, no changes';
  const shown = changes.slice(0, 3).join(', ');
  return changes.length > 3 ? `${shown} +${changes.length - 3} more` : shown;
}

function recordCut(movie, seq, url, duration) {
  const sig = cutSignature(movie, seq);
  const bridgeCount = seq.filter(i => i.bridge).length;
  const frames = seq.map(item => {
    if (item.scene) {
      return { sceneId: item.scene.id, title: item.scene.title, panelUrl: item.scene.panel?.url || null, bridge: false };
    }
    const to = movie.scenes.find(s => s.id === item.bridge.toSceneId);
    return { sceneId: item.bridge.toSceneId, title: 'dream bridge', panelUrl: to?.panel?.url || null, bridge: true };
  });
  const cut = {
    id: 'c' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex'),
    url, duration,
    name: nameCut(movie, sig, bridgeCount),
    stitchedAt: new Date().toISOString(),
    frames,
  };
  movie.cuts = [...(movie.cuts || []), cut].slice(-20);
  // A finished cut files as its own kind, so the grid's filter row separates
  // the films from the clips they are made of.
  fileVideoToCreations({
    url, type: 'film', poster: frames.find(f => f.panelUrl)?.panelUrl,
    prompt: `${movie.title || 'movie'} — ${cut.name}`,
  });
  movie.lastCutSig = sig;
  movie.lastCutBridges = bridgeCount;
}

// ─── Background jobs ────────────────────────────────────────────────
// One job at a time per movie, recorded IN the movie doc — the app just polls
// GET /:id and the whole film strip (statuses, URLs, progress) stays current.
async function startJob(movie, kind, fn) {
  if (movie.job && movie.job.status === 'running') {
    // A Render restart can strand a job as "running" — treat stale as dead.
    const age = Date.now() - new Date(movie.job.startedAt || 0).getTime();
    if (age < 15 * 60 * 1000) throw new Error(`a "${movie.job.kind}" job is already running`);
  }
  movie.job = { kind, status: 'running', done: 0, total: 0, label: 'starting', error: null, startedAt: new Date().toISOString() };
  await saveMovie(movie);

  (async () => {
    let lastSave = 0;
    const progress = async (done, total, label) => {
      movie.job = { ...movie.job, done, total, label };
      if (Date.now() - lastSave > 1500) { lastSave = Date.now(); await saveMovie(movie).catch(() => {}); }
    };
    try {
      await fn(progress);
      movie.job = { ...movie.job, status: 'done', label: 'done' };
    } catch (err) {
      console.warn(`movies: job ${kind} failed —`, err.message);
      movie.job = { ...movie.job, status: 'error', error: err.message };
    }
    await saveMovie(movie).catch(e => console.warn('movies: save failed —', e.message));
  })();
}

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();
router.use(express.json({ limit: '10mb' }));

router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    openai: Boolean(OPENAI_API_KEY),
    replicate: Boolean(REPLICATE_API_TOKEN),
    firebase: Boolean(firestore()),
    ffmpeg: Boolean(FFMPEG && FFPROBE),
    styleReference: Boolean(styleRef),
    voiceover: Boolean(OPENAI_API_KEY),   // whisper transcription for narrated films
    styles: Object.values(MOVIE_STYLES).map(s => ({ id: s.id, label: s.label, refs: s.refs.length })),
    gated: Boolean(STUDIO_TOKEN),
    models: {
      draft: VIDEO_MODELS.draft.name,
      standard: VIDEO_MODELS.standard.name,
      pro: VIDEO_MODELS.pro.name,
    },
    costs: { panel: PANEL_COST, clip: { draft: 0.06, draftLong: 0.08, standard: 0.25, pro: 0.55, bridge: 0.08 } },
  });
});

router.get('/', async (req, res) => {
  try { res.json({ movies: await listMovies() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Create a movie: story → scene breakdown. Synchronous (one chat call).
// Build one scene object from either the GPT breakdown or a hand-authored beat.
function authoredScene(s, i) {
  const scene = {
    id: 's' + crypto.randomBytes(4).toString('hex'),
    title: String(s.title || `Scene ${i + 1}`).trim(),
    description: String(s.description || s.imagePrompt || '').trim(),
    imagePrompt: String(s.imagePrompt || s.description || '').trim(),
    motionPrompt: String(s.motionPrompt || '').trim(),
    hasText: Boolean(s.hasText),
    pairWithNext: Boolean(s.pairWithNext),
    key: Boolean(s.key),
    panel: null,
    clip: null,
    edits: { enabled: true, trimStart: 0, trimEnd: 0, speed: 1, freezeEnd: 0, fadeOut: 0 },
  };
  // Narrated-timeline extras (all optional, additive).
  if (typeof s.startAt === 'number' && isFinite(s.startAt)) scene.startAt = Math.max(0, s.startAt);
  if (s.outfit) scene.outfit = String(s.outfit).trim();          // same face, new clothing
  if (s.still) scene.still = true;                                // hold the panel, never animate
  const clipPrompt = s.motionPromptOverride || s.clipPrompt;      // bold per-beat motion (bypasses the static-camera lock)
  if (clipPrompt) scene.motionPromptOverride = String(clipPrompt).trim();
  return scene;
}

router.post('/', async (req, res) => {
  try {
    const { story, title, sceneCount, panelQuality, scenes, characters, aspect,
            style, styles, characterRefs, morphPairs, storyId } = req.body || {};
    // Two ways in: a story for GPT to break down, OR a hand-authored scene list
    // (exact beats, outfits, startAts) that skips the breakdown entirely.
    const authored = Array.isArray(scenes) && scenes.length;
    if (!authored && (!story || !String(story).trim())) {
      return res.status(400).json({ error: 'story (or a scenes array) is required' });
    }

    // One or more styles: `styles:['pencil','flat']` makes one movie per style
    // (same breakdown, so the films differ ONLY in art style); `style` picks
    // one. Default pencil, the original look.
    const wanted = Array.isArray(styles) && styles.length
      ? [...new Set(styles.filter(s => MOVIE_STYLES[s]))]
      : [MOVIE_STYLES[style] ? style : 'pencil'];
    if (!wanted.length) wanted.push('pencil');

    const opts = {
      morphPairs: morphPairs !== false,                                // model's free morph-vs-cut judgement; false = all hard cuts
    };
    let plan;
    if (authored) {
      plan = { title: (title && String(title).trim()) || 'Untitled film', characters: String(characters || '').trim(), scenes: scenes.map(authoredScene) };
    } else {
      const n = sceneCount ? Math.min(16, Math.max(2, parseInt(sceneCount, 10) || 0)) : null;
      plan = await breakdownStory(String(story).trim(), n, opts);
    }

    // Optional named character cards ({name, image dataURL | url}) — uploaded
    // once, shared by every style's movie. Cap 5 (edits attends to ~16 images
    // total and panels also carry style + chain refs).
    const cards = [];
    for (const c of (Array.isArray(characterRefs) ? characterRefs : []).slice(0, 5)) {
      if (!c || !c.name) continue;
      let url = typeof c.url === 'string' && /^https?:/.test(c.url) ? c.url : null;
      if (!url && typeof c.image === 'string') {
        const m = /^data:([^;]+);base64,(.*)$/.exec(c.image);
        if (m) url = await saveBufferToStorage(Buffer.from(m[2], 'base64'), m[1], 'movies/characters');
      }
      if (url && !url.startsWith('data:')) cards.push({ name: String(c.name).trim(), url });
    }

    const baseTitle = (title && String(title).trim()) || plan.title;
    const movies = wanted.map((sid, i) => ({
      id: 'm' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
      title: wanted.length > 1 ? `${baseTitle} (${MOVIE_STYLES[sid].label})` : baseTitle,
      story: String(story || '').trim(),
      // The forge-story doc this film was made from — what lets the Story
      // Room show a story's film ON the story instead of in a loose pile.
      storyId: String(storyId || '').trim().slice(0, 80) || null,
      characters: plan.characters,
      style: sid,
      morphPairs: opts.morphPairs,
      characterRefs: cards,
      imageStyle: DEFAULT_IMAGE_STYLE,
      motionStyle: ART_LOCK,
      negativePrompt: DEFAULT_NEGATIVE,
      dreamMode: false,
      aspect: CANVAS[aspect] ? aspect : undefined,   // 'portrait' | 'landscape' | 'square'; undefined = source-size (classic stitch)
      panelQuality: ['sketch', 'low', 'medium', 'high'].includes(panelQuality) ? panelQuality : 'medium',
      characterAnchor: null,
      voiceover: null,
      // Each sibling movie gets its own scene objects + ids (renders diverge).
      scenes: i === 0 ? plan.scenes : plan.scenes.map(s => ({
        ...JSON.parse(JSON.stringify(s)),
        id: 's' + crypto.randomBytes(4).toString('hex'),
      })),
      bridges: [],
      cuts: [],
      job: null,
      movieUrl: null,
      movieDuration: 0,
      spend: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    for (const m of movies) await saveMovie(m);
    res.json(movies.length > 1 ? { movies } : movies[0]);
  } catch (err) {
    res.status(err.message.includes('required') ? 400 : 502).json({ error: err.message });
  }
});

// Link (or unlink, with an empty storyId) a movie to its forge-story doc
// after the fact — the Story Room groups films under their story by this,
// and scripts/link-films-to-stories.js backfills older films through it.
router.post('/:id/story', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    movie.storyId = String((req.body || {}).storyId || '').trim().slice(0, 80) || null;
    await saveMovie(movie);
    res.json({ ok: true, id: movie.id, storyId: movie.storyId });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Set / replace a movie's named character cards after creation (the future
// character-matcher flow lands here: match cast names → approve → attach).
router.post('/:id/characters', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    const cards = [];
    for (const c of (Array.isArray(req.body?.characterRefs) ? req.body.characterRefs : []).slice(0, 5)) {
      if (!c || !c.name) continue;
      let url = typeof c.url === 'string' && /^https?:/.test(c.url) ? c.url : null;
      if (!url && typeof c.image === 'string') {
        const m = /^data:([^;]+);base64,(.*)$/.exec(c.image);
        if (m) url = await saveBufferToStorage(Buffer.from(m[2], 'base64'), m[1], 'movies/characters');
      }
      if (url && !url.startsWith('data:')) cards.push({ name: String(c.name).trim(), url });
    }
    movie.characterRefs = cards;
    await saveMovie(movie);
    res.json({ ok: true, characterRefs: cards, movie });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Quick animate: one image in, one clip out (no movie) ───────────
// Home-screen "animate" button: upload a picture (drawing, photo, panel),
// wan-2.2 animates it at 720p by default. Runs as its own polled doc.
// NOTE: registered before '/:id' so the path wins the route match.
router.post('/animate', async (req, res) => {
  try {
    const { image, prompt = '', resolution = '720p', frames, tier: tierIn = 'draft' } = req.body || {};
    if (!image || !/^data:image\//.test(image)) return res.status(400).json({ error: 'image (data URL) required' });
    if (!REPLICATE_API_TOKEN) return res.status(400).json({ error: 'REPLICATE_API_TOKEN not set' });
    const tier = ['draft', 'standard', 'pro'].includes(tierIn) ? tierIn : 'draft';
    const m = /^data:([^;]+);base64,(.*)$/.exec(image);
    if (!m) return res.status(400).json({ error: 'bad image data URL' });
    const imageUrl = await saveBufferToStorage(Buffer.from(m[2], 'base64'), m[1], 'movies/quick');
    if (imageUrl.startsWith('data:')) return res.status(400).json({ error: 'quick animate needs Firebase Storage (public image URLs)' });

    // draft = wan (480p/720p); standard/pro = kling (720p/1080p, fixed 5s).
    const res720 = resolution === '480p' ? '480p' : '720p';
    const numFrames = tier === 'draft' ? (frames === 121 ? 121 : 81) : null;
    const cost = tier === 'standard' ? 0.25
               : tier === 'pro' ? 0.55
               : res720 === '720p' ? (numFrames > 81 ? 0.24 : 0.16) : (numFrames > 81 ? 0.08 : 0.06);
    const quick = {
      id: 'q' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
      status: 'running', error: null,
      prompt: String(prompt).trim(),
      imageUrl, clipUrl: null,
      resolution: tier === 'standard' ? '720p' : tier === 'pro' ? '1080p' : res720,
      frames: numFrames, cost, tier,
      createdAt: new Date().toISOString(),
    };
    await saveQuick(quick);
    res.json(quick);

    (async () => {
      try {
        const fullPrompt = (quick.prompt || '') +
          '. The subject, style and composition of the image are preserved exactly.';
        let p;
        if (tier === 'draft') {
          p = await replicatePredict(VIDEO_MODELS.draft.version, {
            image: imageUrl,
            prompt: fullPrompt,
            resolution: res720,
            num_frames: numFrames,
            frames_per_second: 16,
            interpolate_output: true,
            go_fast: true,
          });
        } else {
          p = await replicatePredict(VIDEO_MODELS[tier].version, {
            start_image: imageUrl,
            prompt: fullPrompt,
            negative_prompt: DEFAULT_NEGATIVE,
            duration: 5,
            mode: tier === 'pro' ? 'pro' : 'standard',
          }, { pollMs: 6000, maxPolls: 120 });
        }
        const output = Array.isArray(p.output) ? p.output[0] : p.output;
        if (!output) throw new Error('video model produced no output');
        quick.clipUrl = await saveUrlToStorage(output, 'movies/quick', 'video/mp4');
        quick.status = 'done';
        fileVideoToCreations({
          url: quick.clipUrl, poster: imageUrl, prompt: fullPrompt,
          model: (tier === 'draft' ? 'wan-2.2-i2v-fast' : 'kling-v2.1'), quality: tier,
        });
      } catch (err) {
        quick.status = 'error';
        quick.error = err.message;
      }
      await saveQuick(quick).catch(e => console.warn('movies: quick save failed —', e.message));
    })();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/quick', async (req, res) => {
  try { res.json({ clips: await listQuick() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/quick/:id', async (req, res) => {
  try {
    const quick = await loadQuick(req.params.id);
    if (!quick) return res.status(404).json({ error: 'not found' });
    res.json(quick);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/quick/:id', async (req, res) => {
  try { await deleteQuick(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Morph film: a handful of stills → one continuous morphing video ─
// The standalone dream-video path: instead of running the whole movie
// pipeline, take N images already drawn elsewhere (character-anchored dream
// stills, gallery art, anything) plus N-1 morph prompts and animate a
// wan-2.2 draft clip BETWEEN each consecutive pair — `image` is the start,
// `last_image` the end, so each clip continuously transforms one still into
// the next. The clips are then stitched into a single film. Each morph prompt
// describes ONE continuous physical action (the same rule the dream bridges
// use). Frames may be data URLs (uploaded to Storage here so Replicate can
// fetch them) or already-public URLs. Polled via GET /quick/:id like animate.
router.post('/morphfilm', async (req, res) => {
  try {
    const { frames, prompts, resolution, title, captions } = req.body || {};
    if (!Array.isArray(frames) || frames.length < 2)
      return res.status(400).json({ error: 'frames must be an array of at least 2 images (data URLs or public URLs)' });
    if (!Array.isArray(prompts) || prompts.length < frames.length - 1)
      return res.status(400).json({ error: `prompts must have at least ${frames.length - 1} morph descriptions (one per gap between frames)` });
    const res720 = resolution === '720p' ? '720p' : '480p';
    const numFrames = 121; // long enough for a smooth morph (bridge-length)
    const pairs = frames.length - 1;
    const cost = Math.round(pairs * VIDEO_MODELS.draft.costPerClip(numFrames) * 100) / 100;
    const filmTitle = (title && String(title).trim()) || 'Morph film';

    const job = {
      id: 'm' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
      kind: 'morphfilm',
      status: 'running', error: null,
      step: 'uploading frames', done: 0, total: pairs + 1,
      clipUrl: null, filmUrl: null, movieId: null,
      frames: frames.length, resolution: res720, cost,
      createdAt: new Date().toISOString(),
    };
    await saveQuick(job);
    res.json(job);

    (async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-morph-'));
      try {
        // Resolve every frame to a public URL wan can fetch.
        const urls = [];
        for (const f of frames) {
          if (typeof f === 'string' && /^https?:\/\//.test(f)) { urls.push(f); continue; }
          const m = /^data:([^;]+);base64,(.*)$/.exec(String(f || ''));
          if (!m) throw new Error('each frame must be a data URL or an http(s) URL');
          const buf = Buffer.from(m[2], 'base64');
          urls.push(await saveBufferToStorage(buf, m[1] || 'image/png', 'movies/morph-frames'));
        }

        // Morph each consecutive pair: start = urls[i], end = urls[i+1].
        const clipFiles = [];
        for (let i = 0; i < pairs; i++) {
          job.step = `morphing ${i + 1}/${pairs}`;
          await saveQuick(job).catch(() => {});
          const prompt = String(prompts[i] || 'one continuous, smooth physical transformation from the first image into the last').trim();
          const p = await replicatePredict(VIDEO_MODELS.draft.version, {
            image: urls[i],
            last_image: urls[i + 1],
            prompt,
            resolution: res720,
            num_frames: numFrames,
            frames_per_second: 16,
            interpolate_output: true,
            go_fast: true,
          });
          const output = Array.isArray(p.output) ? p.output[0] : p.output;
          if (!output) throw new Error(`morph ${i + 1} produced no output`);
          const file = path.join(tmpDir, `clip-${i}.mp4`);
          const { buffer } = await fetchBuffer(output);
          fs.writeFileSync(file, buffer);
          clipFiles.push(file);
          job.done = i + 1;
          await saveQuick(job).catch(() => {});
        }

        // Normalize to the first clip's size, then stitch losslessly.
        job.step = 'stitching';
        await saveQuick(job).catch(() => {});
        const first = await probe(clipFiles[0]);
        const target = {
          width: (first.width || 832) - ((first.width || 832) % 2),
          height: (first.height || 480) - ((first.height || 480) % 2),
        };
        const normalized = [];
        for (let i = 0; i < clipFiles.length; i++) {
          const out = path.join(tmpDir, `norm-${i}.mp4`);
          await normalizeClip(clipFiles[i], out, {}, target);
          normalized.push(out);
        }
        const outFile = path.join(tmpDir, 'morph.mp4');
        await concatClips(normalized, outFile);
        const filmUrl = await saveBufferToStorage(fs.readFileSync(outFile), 'video/mp4', 'movies/films');
        const { duration } = await probe(outFile).catch(() => ({ duration: 0 }));
        const dur = Math.round(duration * 10) / 10;

        // Land it in the Films tab: write a real forge-movies doc so a morph
        // film sits alongside pipeline movies (poster = first frame, playable
        // film = the stitched video, gallery contact sheet = the frames).
        const scenes = urls.map((u, i) => ({
          id: `s${i + 1}`,
          title: (Array.isArray(captions) && captions[i]) ? String(captions[i]).slice(0, 60) : `Frame ${i + 1}`,
          description: (Array.isArray(captions) && captions[i]) || prompts[i] || 'still',
          imagePrompt: '', motionPrompt: prompts[i] || '',
          panel: { url: u }, clip: null, edits: {},
        }));
        const cut = {
          id: 'c' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex'),
          url: filmUrl, duration: dur, name: 'morph film',
          stitchedAt: new Date().toISOString(),
          frames: urls.map((u, i) => ({ sceneId: `s${i + 1}`, title: scenes[i].title, panelUrl: u, bridge: false })),
        };
        const movie = {
          id: 'm' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
          title: filmTitle, story: '', characters: '',
          imageStyle: DEFAULT_IMAGE_STYLE, motionStyle: ART_LOCK, negativePrompt: DEFAULT_NEGATIVE,
          dreamMode: true, panelQuality: 'low', characterAnchor: null,
          kind: 'morph',
          scenes, bridges: [], cuts: [cut], job: null,
          movieUrl: filmUrl, movieDuration: dur, spend: cost,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        await saveMovie(movie).catch(e => console.warn('movies: morph movie-doc save failed —', e.message));

        job.filmUrl = filmUrl;
        job.clipUrl = filmUrl; // alias so quick pollers that read clipUrl still find it
        job.movieId = movie.id;
        job.duration = dur;
        job.step = 'done';
        job.done = job.total;
        job.status = 'done';
      } catch (err) {
        job.status = 'error';
        job.error = err.message;
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
      await saveQuick(job).catch(e => console.warn('movies: morphfilm save failed —', e.message));
    })();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Dreams: dream text → hand-drawn comic pages ────────────────────
// The dream-illustration path. `POST /dream` is the free breakdown — GPT reads
// the dream and decides the beats + captions (minimal prompting); nothing is
// drawn yet. `POST /dream/:id/render` draws them as 2x2 comic pages in the
// diary-comic style reference. Registered BEFORE '/:id' so "/dream" isn't
// swallowed by the movie-by-id route.
router.get('/dream', async (req, res) => {
  try { res.json({ dreams: await listDreams(cleanOwner(req.query.owner)) }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Transcribe a dream she already RECORDED (a voice memo) → text, so a file feeds
// the exact same pipeline as typing or live dictation. Whisper (transcribeAudio);
// returns only the text — she reviews/edits it in the box before Illustrate, then
// POST /dream breaks it down as usual. Accepts a base64 data URL or a public url.
router.post('/dream/transcribe', async (req, res) => {
  try {
    const { audio, url } = req.body || {};
    let buffer = null, contentType = 'audio/mp4';
    if (audio) {
      const m = /^data:([^;]+);base64,(.*)$/.exec(audio);
      if (!m) return res.status(400).json({ error: 'audio must be a base64 data URL' });
      contentType = m[1] || contentType;
      buffer = Buffer.from(m[2], 'base64');
    } else if (url) {
      const got = await fetchBuffer(url);
      buffer = got.buffer;
      contentType = got.contentType || contentType;
    } else {
      return res.status(400).json({ error: 'audio (data URL) or url is required' });
    }
    if (!buffer || !buffer.length) return res.status(400).json({ error: 'empty audio' });
    const t = await transcribeAudio(buffer, 'dream.' + extFromMime(contentType));
    const text = String(t.text || '').trim();
    if (!text) return res.status(422).json({ error: "couldn't make out any words in that recording" });
    res.json({ text, duration: t.duration });
  } catch (err) {
    res.status(err.message && err.message.includes('required') ? 400 : 502).json({ error: err.message });
  }
});

// A guest owner id from the public "try it" page — only accept the shape the
// page mints (`guest_<alnum>`), so nothing else can be jammed into the field.
function cleanOwner(o) {
  return /^guest_[a-z0-9]{4,40}$/i.test(String(o || '')) ? String(o) : null;
}

// ─── Guest daily cap (public /trydreams) ────────────────────────────
// A friend gets ONE batch of dreams per day — one reading plus the sheets for
// the dreams it produced. This bounds the spend on Sophie's key to ~15-50¢ per
// person per day. Sophie's own dreams (no owner) are never capped.
const GUEST_COLLECTION = process.env.DREAM_GUEST_COLLECTION || 'forge-dream-guests';
const memGuest = new Map();
function pacificDay(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}
// Consume today's allowance; true = allowed (and recorded), false = already used.
async function claimGuestDay(owner) {
  const day = pacificDay();
  const db = firestore();
  if (!db) {
    const cur = memGuest.get(owner);
    if (cur && cur.day === day) return false;
    memGuest.set(owner, { day });
    return true;
  }
  const ref = db.collection(GUEST_COLLECTION).doc(owner);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : {};
  if (data.day === day) return false;
  await ref.set({ day, batches: (data.batches || 0) + 1, updatedAt: new Date().toISOString() }, { merge: true });
  return true;
}

router.post('/dream', async (req, res) => {
  try {
    const { dream, title, background } = req.body || {};
    const owner = cleanOwner((req.body || {}).owner);
    if (!dream || !String(dream).trim()) return res.status(400).json({ error: 'dream is required' });
    const text = String(dream).trim();
    // A retried POST (dropped connection) re-sends the same key — return the
    // batch the first attempt created. Checked BEFORE the guest cap so a
    // guest's retry doesn't burn a second day.
    const key = typeof (req.body || {}).key === 'string' && req.body.key.trim()
      ? req.body.key.trim().slice(0, 64) : null;
    if (background && key) {
      const existing = await loadDreamBatchByKey(key);
      if (existing) return res.json({ batchId: existing.id, batch: existing });
    }
    // Guest daily cap: one reading per person per day.
    if (owner && !(await claimGuestDay(owner))) {
      return res.status(429).json({ error: "That's your dream for today ✨ — come back tomorrow to illustrate another." });
    }

    // Background reading (the app's default): return a batch id instantly and do
    // the slow breakdown off the request, so the phone can lock/leave without the
    // request timing out. The app polls GET /dream-batch/:id and picks up the
    // split dreams (the "check the chronology" step) when reading finishes.
    if (background) {
      const batch = {
        id: 'db' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
        status: 'reading',            // reading → done | error
        label: 'reading your dream',
        key,
        dreamIds: [],
        dreamCount: 0,
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      LIVE_DREAM_JOBS.add(batch.id);
      await saveDreamBatch(batch);
      (async () => {
        try {
          // One recording can hold several dreams — the split-only call (v2
          // staged flow) separates + orders them and lists who's mentioned;
          // beats/pages are decided later, after the user approves.
          const { dreams: plans } = await dreamSplit(text);
          // Match mentions to the saved sheet ONLY for Sophie — a guest must
          // never see (or borrow) her characters, so guests get describe-only.
          for (const p of plans) {
            if (owner) p.castSuggestions = (p.mentions || []).map(m => ({ name: (m && m.name) || String(m), matches: [], desc: (m && m.desc) || "", named: (m && typeof m.named === "boolean") ? m.named : null }));
            else await attachCastSuggestions(p);
          }
          const docs = await createDreamDocs(plans, text, title, owner);
          batch.dreamIds = docs.map(d => d.id);
          batch.dreamCount = docs.length;
          batch.status = 'done';
          batch.label = 'done';
        } catch (err) {
          console.warn('movies: dream breakdown failed —', err.message);
          batch.status = 'error';
          batch.error = err.message;
        }
        await saveDreamBatch(batch).catch(e => console.warn('movies: batch save failed —', e.message));
        LIVE_DREAM_JOBS.delete(batch.id);
      })();
      return res.json({ batchId: batch.id, batch });
    }

    // Synchronous path (kept for back-compat with older app builds): read and
    // return the split dreams in one call. One recording can hold several dreams.
    const { dreams: plans } = await dreamSplit(text);
    for (const p of plans) {
      if (owner) p.castSuggestions = (p.mentions || []).map(m => ({ name: (m && m.name) || String(m), matches: [], desc: (m && m.desc) || "", named: (m && typeof m.named === "boolean") ? m.named : null }));
      else await attachCastSuggestions(p);
    }
    const docs = await createDreamDocs(plans, text, title, owner);
    res.json({ dreams: docs });
  } catch (err) {
    res.status(err.message.includes('required') ? 400 : 502).json({ error: err.message });
  }
});

// Poll a background reading job. Returns the batch's status and, once reading is
// done, the split dream docs (same shape the synchronous POST /dream returns) so
// the app can show the chronology check. A batch stuck 'reading' past the stale
// window (the process died mid-breakdown) is surfaced as an error, not polled
// forever.
router.get('/dream-batch/:id', async (req, res) => {
  try {
    const batch = await loadDreamBatch(req.params.id);
    if (!batch) return res.status(404).json({ error: 'reading not found' });
    // Dead fast if the process restarted mid-reading (the job can't finish);
    // the age-based stale check stays as the backstop.
    if (batch.status === 'reading'
        && ((!LIVE_DREAM_JOBS.has(batch.id)
             && Date.now() - new Date(batch.createdAt || 0).getTime() > DEAD_JOB_GRACE_MS)
            || Date.now() - new Date(batch.createdAt || 0).getTime() > DREAM_BATCH_STALE_MS)) {
      batch.status = 'error';
      batch.error = 'the reading was interrupted — tap Illustrate again';
      await saveDreamBatch(batch).catch(() => {});
    }
    const out = { ...batch, dreams: [] };
    if (batch.status === 'done' && (batch.dreamIds || []).length) {
      const dreams = [];
      for (const id of batch.dreamIds) {
        const d = await loadDream(id);
        if (d) dreams.push(d);
      }
      out.dreams = dreams;
    }
    res.json(out);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/dream/:id', async (req, res) => {
  try {
    const doc = await loadDream(req.params.id);
    if (!doc) return res.status(404).json({ error: 'dream not found' });
    // A job left 'running' by a process that no longer exists would be polled
    // forever — surface it as an error the app can act on. Pages drawn before
    // the restart were persisted as they landed, so nothing paid for is lost.
    if (dreamJobDied(doc)) {
      doc.job = { ...doc.job, status: 'error', error: 'the drawing was interrupted by a server restart — the finished pages are kept; re-render to fill the gaps' };
      await saveDream(doc).catch(() => {});
    }
    res.json(doc);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/dream/:id', async (req, res) => {
  try { await deleteDream(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Hide a dream from the journal WITHOUT deleting it — kept in Firestore, just
// filtered out of the past-dreams list (listDreams). Reversible via {hidden:false}.
router.post('/dream/:id/hidden', async (req, res) => {
  try {
    const doc = await loadDream(req.params.id);
    if (!doc) return res.status(404).json({ error: 'dream not found' });
    doc.hidden = (req.body && req.body.hidden !== false);
    await saveDream(doc);
    res.json({ ok: true, id: doc.id, hidden: doc.hidden });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Draw the beats as comic pages (paid: ~PANEL_COST per 4-beat page). Runs as a
// background job on the dream doc; poll GET /dream/:id.
router.post('/dream/:id/render', async (req, res) => {
  try {
    const doc = await loadDream(req.params.id);
    if (!doc) return res.status(404).json({ error: 'dream not found' });
    // Guest (public /trydreams) dreams draw their sheets ONCE, as part of that
    // day's single batch — no re-rolls, so the daily cap actually bounds cost.
    // A fully-failed render (no pages yet) can still be retried.
    if (doc.owner && Array.isArray(doc.pages) && doc.pages.length) {
      return res.status(429).json({ error: "These pages are already drawn — re-rolls aren't available on the shared demo." });
    }
    const { quality = 'medium', order, characterRefs, characters } = req.body || {};
    const q = ['low', 'medium', 'high'].includes(quality) ? quality : 'medium';
    // v2 staged flow: the APPROVED cast — [{name, url?|image?(dataURL), desc?}].
    // A url/image entry is a saved character card attached as an image ref on
    // that character's pages; a desc-only entry rides as a text continuity
    // line ("Miriam: dark brown hair, tall"). Persisted so re-renders keep it.
    const useV2 = Array.isArray(characters) || !(doc.beats || []).length;
    if (Array.isArray(characters)) {
      const kept = [];
      for (const c of characters.slice(0, 12)) {
        if (!c || !c.name) continue;
        let url = typeof c.url === 'string' && /^https?:\/\//.test(c.url) ? c.url : null;
        const m = /^data:([^;]+);base64,(.*)$/.exec(String(c.image || ''));
        if (!url && m) url = await saveBufferToStorage(Buffer.from(m[2], 'base64'), m[1] || 'image/png', 'movies/character-refs');
        const desc = typeof c.desc === 'string' && c.desc.trim() ? c.desc.trim().slice(0, 300) : null;
        if (url || desc || c.name) kept.push({ name: String(c.name).slice(0, 60), url, desc });
      }
      doc.castApproved = kept;
    }
    if (useV2) {
      if (!String(doc.dreamText || doc.dream || '').trim()) return res.status(400).json({ error: 'dream has no text' });
      await startDreamJob(doc, 'render', async (progress) => {
        await makeDreamPagesV2(doc, q, progress);
      });
      return res.json({ ok: true, dream: doc });
    }
    // ── Legacy path (older builds / beat docs) ──
    // Optional pre-made character cards: [{name, url}] or [{name, image:dataURL}]
    // (data URLs are uploaded to Storage). Persisted on the doc so re-renders keep them.
    if (Array.isArray(characterRefs)) {
      const kept = [];
      for (const c of characterRefs.slice(0, 4)) {
        if (!c || !c.name) continue;
        let url = typeof c.url === 'string' && /^https?:\/\//.test(c.url) ? c.url : null;
        const m = /^data:([^;]+);base64,(.*)$/.exec(String(c.image || ''));
        if (!url && m) url = await saveBufferToStorage(Buffer.from(m[2], 'base64'), m[1] || 'image/png', 'movies/character-refs');
        if (url) kept.push({ name: String(c.name), url });
      }
      doc.characterRefs = kept;
    }
    // The chronology check: reorder the beats to the order the app sends before drawing.
    if (Array.isArray(order) && order.length) {
      const byId = new Map(doc.beats.map(b => [b.id, b]));
      const reordered = order.map(id => byId.get(id)).filter(Boolean);
      doc.beats.forEach(b => { if (!order.includes(b.id)) reordered.push(b); }); // keep any not named
      if (reordered.length) doc.beats = reordered;
    }
    await startDreamJob(doc, 'render', async (progress) => {
      await makeDreamPages(doc, q, progress);
    });
    res.json({ ok: true, dream: doc });
  } catch (err) { res.status(/already running/.test(err.message) ? 409 : 500).json({ error: err.message }); }
});

// The chronology approval can also REORDER whole dreams (a recording split
// into several) — re-stagger createdAt so the given order becomes the stored
// order everywhere that sorts by time.
router.post('/dream/reorder', async (req, res) => {
  try {
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(String).filter(Boolean);
    if (!ids.length) return res.status(400).json({ error: 'ids required' });
    const base = Date.now() - ids.length * 1000;
    const dreams = [];
    for (let i = 0; i < ids.length; i++) {
      const d = await loadDream(ids[i]);
      if (!d) continue;
      d.createdAt = new Date(base + i * 1000).toISOString();
      await saveDream(d);
      dreams.push(d);
    }
    res.json({ ok: true, dreams });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    res.json(movie);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await deleteMovie(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Edit movie / scenes: title, styles, dream mode, scene order, per-scene
// prompt overrides and the ffmpeg edit list. This is the zoom-in surface —
// everything the app's micro-controls touch lands here.
router.patch('/:id', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    const b = req.body || {};
    for (const key of ['title', 'imageStyle', 'motionStyle', 'negativePrompt', 'characters']) {
      if (typeof b[key] === 'string') movie[key] = b[key].trim();
    }
    if (typeof b.dreamMode === 'boolean') movie.dreamMode = b.dreamMode;
    if (Array.isArray(b.order)) {
      const byId = new Map(movie.scenes.map(s => [s.id, s]));
      const reordered = b.order.map(id => byId.get(id)).filter(Boolean);
      if (reordered.length === movie.scenes.length) movie.scenes = reordered;
    }
    for (const patch of (Array.isArray(b.scenes) ? b.scenes : [])) {
      const scene = movie.scenes.find(s => s.id === patch.id);
      if (!scene) continue;
      for (const key of ['title', 'description', 'imagePrompt', 'motionPrompt', 'motionPromptOverride']) {
        if (typeof patch[key] === 'string') scene[key] = patch[key];
      }
      if (patch.motionPromptOverride === null) delete scene.motionPromptOverride;
      if (typeof patch.hasText === 'boolean') scene.hasText = patch.hasText;
      if (typeof patch.pairWithNext === 'boolean') scene.pairWithNext = patch.pairWithNext;
      if (patch.edits && typeof patch.edits === 'object') {
        scene.edits = { ...scene.edits, ...patch.edits };
      }
    }
    await saveMovie(movie);
    res.json(movie);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Lock (or clear) the character anchor: the named scene's panel becomes the
// character's definitive appearance, attached as a reference to every later
// render. Body: { sceneId } to lock, { sceneId: null } to clear.
router.post('/:id/anchor', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    const { sceneId } = req.body || {};
    if (sceneId === null || sceneId === undefined || sceneId === '') {
      movie.characterAnchor = null;
    } else {
      const scene = movie.scenes.find(s => s.id === sceneId);
      if (!scene?.panel?.url) return res.status(400).json({ error: 'that scene has no panel yet' });
      movie.characterAnchor = { url: scene.panel.url, sceneId: scene.id, lockedAt: new Date().toISOString() };
    }
    await saveMovie(movie);
    res.json(movie);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Render panels — all missing (or the listed / all with force), at the
// movie's chosen quality by default. Panels are the cheap approval layer
// before any video.
router.post('/:id/panels', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    const { quality, only, stage, force = false } = req.body || {};
    const q = ['sketch', 'low', 'medium', 'high'].includes(quality)
      ? quality : (movie.panelQuality || 'medium');
    if (q === 'sketch' && !FFMPEG) return res.status(400).json({ error: 'sketch pass needs ffmpeg on the server' });
    // The gradual pipeline: 'first' = ONE probe image (the first key scene —
    // well lit, character framed large — to approve style + characters);
    // 'sample' = the next THREE (remaining key scenes first); 'rest' = all
    // remaining. Approve → next stage; not right → notes on the re-roll route.
    let targets;
    if (stage === 'first' || stage === 'sample' || stage === 'rest') {
      const pending = movie.scenes.filter(s => !s.panel?.url);
      const ordered = [...pending.filter(s => s.key), ...pending.filter(s => !s.key)];
      targets = stage === 'first' ? ordered.slice(0, 1)
              : stage === 'sample' ? ordered.slice(0, 3)
              : pending;
    } else {
      targets = movie.scenes.filter(s =>
        (Array.isArray(only) && only.length) ? only.includes(s.id) : (force || !s.panel?.url));
    }
    if (!targets.length) return res.status(400).json({ error: 'no panels to render' });
    targets.forEach(s => { s.panel = { ...(s.panel || {}), status: 'running', error: null }; });

    await startJob(movie, 'panels', async (progress) => {
      let done = 0;
      if (q === 'sketch') {
        // 4-up contact grids in scene order; a short remainder renders singly
        // at low (still cheap, and slicing assumes a full 2x2).
        const groups = [];
        for (let i = 0; i < targets.length; i += 4) groups.push(targets.slice(i, i + 4));
        await progress(0, targets.length, 'sketching contact grids');
        await pool(groups, 2, async (group) => {
          try {
            if (group.length === 4) await renderSketchGrid(movie, group);
            else await Promise.all(group.map(s =>
              renderPanelFor(movie, s, 'low').catch(err => {
                s.panel = { ...(s.panel || {}), status: 'error', error: err.message };
              })));
          } catch (err) {
            group.forEach(s => { s.panel = { ...(s.panel || {}), status: 'error', error: err.message }; });
          }
          done += group.length;
          await progress(done, targets.length, 'sketching contact grids');
        });
      } else if ((req.body || {}).chain !== false) {
        // Chained (default): render in scene order, one at a time, feeding the
        // FIRST panel + the most recent panel into every render. Slower than
        // the parallel pool but holds characters/world consistent.
        await progress(0, targets.length, 'rendering panels (chained)');
        const targetSet = new Set(targets);
        for (const scene of movie.scenes.filter(s => targetSet.has(s))) {
          try { await renderPanelFor(movie, scene, q, chainFor(movie, scene)); }
          catch (err) { scene.panel = { ...(scene.panel || {}), status: 'error', error: err.message }; }
          await progress(++done, targets.length, 'rendering panels (chained)');
        }
      } else {
        await progress(0, targets.length, 'rendering panels');
        await pool(targets, 3, async (scene) => {
          try { await renderPanelFor(movie, scene, q); }
          catch (err) { scene.panel = { ...(scene.panel || {}), status: 'error', error: err.message }; }
          await progress(++done, targets.length, 'rendering panels');
        });
      }
      const failed = targets.filter(s => s.panel?.status === 'error').length;
      if (failed) throw new Error(`${failed} of ${targets.length} panels failed — re-roll them individually`);
    });
    res.json({ ok: true, rendering: targets.length, movie });
  } catch (err) { res.status(/already running/.test(err.message) ? 409 : 500).json({ error: err.message }); }
});

// Re-roll one panel (optionally with an edited image prompt / higher quality).
router.post('/:id/scenes/:sid/panel', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    const scene = movie.scenes.find(s => s.id === req.params.sid);
    if (!scene) return res.status(404).json({ error: 'scene not found' });
    const { quality = scene.panel?.quality || 'medium', imagePrompt, notes } = req.body || {};
    if (typeof imagePrompt === 'string' && imagePrompt.trim()) scene.imagePrompt = imagePrompt.trim();
    // Free-form revision notes ("her hair should be longer", "less clutter"):
    // folded into this render's prompt and kept on the scene so later renders
    // in the pipeline don't repeat the same mistake.
    if (typeof notes === 'string' && notes.trim()) scene.panelNotes = notes.trim();
    scene.panel = { ...(scene.panel || {}), status: 'running', error: null };
    await startJob(movie, 'panel', async (progress) => {
      await progress(0, 1, `re-rolling "${scene.title}"`);
      try { await renderPanelFor(movie, scene, quality, chainFor(movie, scene)); }
      catch (err) { scene.panel = { ...(scene.panel || {}), status: 'error', error: err.message }; throw err; }
      await progress(1, 1, 'done');
    });
    res.json({ ok: true, movie });
  } catch (err) { res.status(/already running/.test(err.message) ? 409 : 500).json({ error: err.message }); }
});

// Animate — clips for every un-clipped scene (or listed / all with force).
// Draft tier by default; upgrade per-scene later, not all-or-nothing.
router.post('/:id/clips', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    const { tier = 'draft', only, force = false, morphPairs } = req.body || {};
    if (!VIDEO_MODELS[tier]) return res.status(400).json({ error: `unknown tier "${tier}"` });
    // Motion decisions arrive at THIS step (they're irrelevant while images
    // are being made): morphPairs:false flattens every pair to hard cuts.
    if (morphPairs === false) movie.scenes.forEach(s => { s.pairWithNext = false; });
    const targets = [];
    movie.scenes.forEach((s, idx) => {
      if (isMerged(movie, idx)) return;                 // folded into the previous pair-clip
      if (!s.panel?.url) return;                        // no panel yet
      if (Array.isArray(only) && only.length ? !only.includes(s.id) : (!force && s.clip?.url && s.clip.tier === tier)) return;
      targets.push({ scene: s, idx });
    });
    if (!targets.length) return res.status(400).json({ error: 'no scenes ready to animate' });
    targets.forEach(t => { t.scene.clip = { ...(t.scene.clip || {}), status: 'running', error: null }; });

    await startJob(movie, 'clips', async (progress) => {
      let done = 0;
      await progress(0, targets.length, `animating (${tier})`);
      await pool(targets, 5, async ({ scene, idx }) => {
        try { await generateClipFor(movie, scene, idx, { tier }); }
        catch (err) { scene.clip = { ...(scene.clip || {}), status: 'error', error: err.message }; }
        await progress(++done, targets.length, `animating (${tier})`);
      });
      const failed = targets.filter(t => t.scene.clip?.status === 'error').length;
      if (failed) throw new Error(`${failed} of ${targets.length} clips failed — re-roll them individually`);
    });
    res.json({ ok: true, animating: targets.length, movie });
  } catch (err) { res.status(/already running/.test(err.message) ? 409 : 500).json({ error: err.message }); }
});

// Re-roll / upgrade one scene's clip (optionally with an edited motion prompt,
// a longer draft duration, or a higher tier).
router.post('/:id/scenes/:sid/clip', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    const idx = movie.scenes.findIndex(s => s.id === req.params.sid);
    if (idx < 0) return res.status(404).json({ error: 'scene not found' });
    const scene = movie.scenes[idx];
    if (isMerged(movie, idx)) return res.status(400).json({ error: 'this scene is the second half of a pair — it animates inside the previous scene\'s clip' });
    const { tier = 'draft', frames, motionPrompt } = req.body || {};
    if (!VIDEO_MODELS[tier]) return res.status(400).json({ error: `unknown tier "${tier}"` });
    if (typeof motionPrompt === 'string' && motionPrompt.trim()) scene.motionPromptOverride = motionPrompt.trim();
    scene.clip = { ...(scene.clip || {}), status: 'running', error: null };
    await startJob(movie, 'clip', async (progress) => {
      await progress(0, 1, `animating "${scene.title}" (${tier})`);
      try { await generateClipFor(movie, scene, idx, { tier, frames }); }
      catch (err) { scene.clip = { ...(scene.clip || {}), status: 'error', error: err.message }; throw err; }
      await progress(1, 1, 'done');
    });
    res.json({ ok: true, movie });
  } catch (err) { res.status(/already running/.test(err.message) ? 409 : 500).json({ error: err.message }); }
});

// Dream mode: generate bridge clips for every hard cut in the current
// sequence. Re-runs only fill in bridges that are missing or failed.
router.post('/:id/bridges', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    if (!FFMPEG) return res.status(400).json({ error: 'ffmpeg unavailable on the server' });

    // Adjacent playable scenes (post-merge, enabled, clipped) define the cuts.
    const playable = movie.scenes.filter((s, idx) =>
      !isMerged(movie, idx) && s.edits?.enabled !== false && s.clip?.url);
    if (playable.length < 2) return res.status(400).json({ error: 'need at least two animated scenes' });
    movie.bridges = movie.bridges || [];
    const targets = [];
    for (let i = 0; i < playable.length - 1; i++) {
      const from = playable[i], to = playable[i + 1];
      let bridge = movie.bridges.find(b => b.fromSceneId === from.id && b.toSceneId === to.id);
      if (bridge?.clip?.url) continue;
      if (!bridge) {
        bridge = { id: 'b' + crypto.randomBytes(4).toString('hex'), fromSceneId: from.id, toSceneId: to.id, prompt: '', clip: null };
        movie.bridges.push(bridge);
      }
      bridge.clip = { ...(bridge.clip || {}), status: 'running', error: null };
      targets.push({ bridge, from, to });
    }
    if (!targets.length) return res.status(400).json({ error: 'all bridges already exist' });

    await startJob(movie, 'bridges', async (progress) => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-bridges-'));
      try {
        let done = 0;
        await progress(0, targets.length, 'dreaming bridges');
        await pool(targets, 3, async ({ bridge, from, to }) => {
          try {
            if (!bridge.prompt) bridge.prompt = await writeBridgePrompt(movie, from, to);
            await generateBridge(movie, bridge, tmpDir);
          } catch (err) {
            bridge.clip = { ...(bridge.clip || {}), status: 'error', error: err.message };
          }
          await progress(++done, targets.length, 'dreaming bridges');
        });
        const failed = targets.filter(t => t.bridge.clip?.status === 'error').length;
        if (failed) throw new Error(`${failed} of ${targets.length} bridges failed`);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
    movie.dreamMode = true;
    await saveMovie(movie);
    res.json({ ok: true, bridging: targets.length, movie });
  } catch (err) { res.status(/already running/.test(err.message) ? 409 : 500).json({ error: err.message }); }
});

// The zine — the movie's scenes as captioned hand-lettered pages (cover +
// one page per four scenes). Pages land in movie.zine; prior zines are kept
// in movie.zineHistory (capped 3).
router.post('/:id/zine', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    const { quality = 'medium' } = req.body || {};
    const q = ['low', 'medium', 'high'].includes(quality) ? quality : 'medium';
    if (!movie.scenes.length) return res.status(400).json({ error: 'no scenes' });
    await startJob(movie, 'zine', async (progress) => {
      await makeZine(movie, q, progress);
    });
    res.json({ ok: true, movie });
  } catch (err) { res.status(/already running/.test(err.message) ? 409 : 500).json({ error: err.message }); }
});

// Attach a voiceover: upload the audio + transcribe it (word/segment timings).
// The timings become the film's clock (see stitchTimeline). Accepts a data URL
// (`audio`) or a public `url`; pass `timing` to supply precomputed word/segment
// timings and skip Whisper, or `transcribe:false` to attach audio without timing.
router.post('/:id/voiceover', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    const { audio, url, timing, transcribe = true } = req.body || {};
    let buffer = null, contentType = 'audio/mp4';
    if (audio) {
      const m = /^data:([^;]+);base64,(.*)$/.exec(audio);
      if (!m) return res.status(400).json({ error: 'audio must be a base64 data URL' });
      contentType = m[1] || contentType;
      buffer = Buffer.from(m[2], 'base64');
    } else if (url) {
      const got = await fetchBuffer(url);
      buffer = got.buffer;
      contentType = got.contentType || contentType;
    } else {
      return res.status(400).json({ error: 'audio (data URL) or url is required' });
    }
    const stored = await saveBufferToStorage(buffer, contentType, 'movies/voiceover');
    if (stored.startsWith('data:')) return res.status(400).json({ error: 'voiceover needs Firebase Storage (a permanent audio URL)' });
    let t = null;
    if (timing && Array.isArray(timing.words)) {
      t = { text: String(timing.text || ''), duration: Number(timing.duration) || 0, words: timing.words, segments: timing.segments || [] };
    } else if (transcribe) {
      t = await transcribeAudio(buffer);
    }
    movie.voiceover = {
      url: stored,
      duration: t?.duration || 0,
      text: t?.text || '',
      words: t?.words || [],
      segments: t?.segments || [],
      attachedAt: new Date().toISOString(),
    };
    movie.updatedAt = new Date().toISOString();
    await saveMovie(movie);
    res.json({ ok: true, voiceover: { url: movie.voiceover.url, duration: movie.voiceover.duration, words: movie.voiceover.words.length, segments: movie.voiceover.segments.length }, movie });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Set the timeline: each beat's startAt (seconds into the voiceover) + output
// aspect, plus optional per-beat overrides so one call can wire the whole film.
// Body: { aspect?, beats: [{ id, startAt?, outfit?, still?, motionPrompt?,
// imagePrompt?, title? }] }. Only provided fields change.
router.post('/:id/timeline', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    const { aspect, beats } = req.body || {};
    if (aspect !== undefined) {
      if (!CANVAS[aspect]) return res.status(400).json({ error: `unknown aspect "${aspect}" (portrait|landscape|square)` });
      movie.aspect = aspect;
    }
    let updated = 0;
    (Array.isArray(beats) ? beats : []).forEach(b => {
      const scene = movie.scenes.find(s => s.id === b.id);
      if (!scene) return;
      if (typeof b.startAt === 'number' && isFinite(b.startAt)) scene.startAt = Math.max(0, b.startAt);
      if (typeof b.outfit === 'string') scene.outfit = b.outfit.trim() || undefined;
      if (typeof b.still === 'boolean') scene.still = b.still;
      if (typeof b.motionPrompt === 'string' && b.motionPrompt.trim()) scene.motionPromptOverride = b.motionPrompt.trim();
      if (typeof b.imagePrompt === 'string' && b.imagePrompt.trim()) scene.imagePrompt = b.imagePrompt.trim();
      if (typeof b.title === 'string' && b.title.trim()) scene.title = b.title.trim();
      updated++;
    });
    movie.updatedAt = new Date().toISOString();
    await saveMovie(movie);
    res.json({ ok: true, updated, aspect: movie.aspect || null, movie });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Stitch — join the sequence into the movie. Free to re-run after every tweak.
// If the movie has a voiceover + timed beats it builds on the VOICEOVER clock
// (held stills / fitted clips under one unbroken narration, letterboxed to the
// chosen aspect); otherwise the classic clip-length stitch. `mode` forces one
// ('timeline' | 'classic').
router.post('/:id/stitch', async (req, res) => {
  try {
    const movie = await loadMovie(req.params.id);
    if (!movie) return res.status(404).json({ error: 'movie not found' });
    if (!FFMPEG || !FFPROBE) return res.status(400).json({ error: 'ffmpeg unavailable on the server' });
    const { mode } = req.body || {};
    const useTimeline = mode === 'timeline'
      || (mode !== 'classic' && movie.voiceover?.url && timelineSequence(movie).length > 0);
    await startJob(movie, 'stitch', async (progress) => {
      if (useTimeline) await stitchTimeline(movie, (d, t, label) => progress(d, t, label));
      else await stitchMovie(movie, (d, t, label) => progress(d, t, label));
    });
    res.json({ ok: true, mode: useTimeline ? 'timeline' : 'classic', movie });
  } catch (err) { res.status(/already running/.test(err.message) ? 409 : 500).json({ error: err.message }); }
});

module.exports = {
  router,
  init,
  fileVideoToCreations,   // exported for the wiring test
  breakdownStory,
  movieSequence,
  timelineSequence,
  stitchTimeline,
  transcribeAudio,
  motionPromptFor,
  VIDEO_MODELS,
  // building blocks, exported for scripts/tests
  renderPanelFor,
  renderSketchGrid,
  generateClipFor,
  makeZine,
  dreamBreakdown,
  dreamSplit,
  dreamPaginate,
  makeDreamPages,
  makeDreamPagesV2,
  makeDreamImage,
  normalizeDreamCast,
  dreamPageRefs,
  dreamZinePagePrompt,
  isSafetyRefusal,
  mergeSoftened,
  softenRefusedNarrative,
  softenOnRefusal,
  drawWithSoftening,
  drawPagesResilient,
  probe,
  extractLastFrame,
  normalizeClip,
  concatClips,
};
