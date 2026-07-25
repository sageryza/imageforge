// imageforge-server v11 — moments v3 prompts, replicate crash fix, pwcscans model
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const admin = require('firebase-admin');

// Natal-chart deps (Secretly a Witch). Guarded so a missing/broken install
// degrades ONLY the /api/witch/natal endpoint instead of crashing the whole
// server at boot (astro.js pulls in the astronomia ephemeris).
let tzlookup = null, astro = null;
try { tzlookup = require('tz-lookup'); astro = require('./astro'); }
catch (e) { console.error('Natal-chart engine unavailable:', e.message); }

const app = express();

// ─── CORS ───────────────────────────────────────────────────────────
// The API is called from browser apps on other origins (e.g. a Claude
// artifact), so cross-origin requests must be allowed. Permissive for now
// — any origin — since the endpoints are already open; `origin: true`
// reflects the caller's origin (so it also works if we ever add
// credentials). Tighten `origin` to an allow-list later if needed.
const corsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-studio-token'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // explicit preflight for every route
// Reference images for the Sticker Page are sent as base64 in the JSON body,
// so the default 100kb limit is far too small — allow a handful of photos.
app.use(express.json({ limit: '25mb' }));
app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => { res.sendFile(__dirname + '/public/index.html'); });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';

// NOTE: the product-pipeline routes (/api/etsy, /api/printify, /api/printful,
// /api/lulu, /api/pipeline) are mounted further below, AFTER Firebase init —
// so the Firestore key-loader can populate process.env before the service
// modules read their keys at require-time. See "Product pipeline" block.

// Call OpenAI chat completions with a couple of retries. Recovers from
// transient network hiccups (e.g. "Premature close" / dropped connections)
// that otherwise surface as a one-off 500 error. 'Connection: close' avoids
// reusing a stale keep-alive socket, the usual cause of "Premature close".
async function openaiChat(body, retries = 3) {
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
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// Call the Anthropic Messages API (raw fetch — mirrors openaiChat, the house
// pattern for AI calls). Used by "Secretly a Witch" for the once-a-day, higher
// quality reading (Claude Opus 4.8). Key is read at call time from process.env
// because config-loader.js hydrates ANTHROPIC_API_KEY from Firestore AFTER boot.
// 'Connection: close' avoids stale keep-alive sockets ("Premature close").
// Resolve the Anthropic key: env first (config-loader hydrates it from
// Firestore config/anthropic at boot), else read that doc directly on demand
// and cache it — so the feature works even if boot hydration was skipped.
let _anthropicKey = null;
async function getAnthropicKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  if (_anthropicKey) return _anthropicKey;
  if (!admin.apps.length) return '';
  const db = admin.firestore();
  // Try both the dedicated doc and the pipeline config doc.
  for (const [path, field] of [['config/anthropic', 'key'], ['config/pipeline', 'ANTHROPIC_API_KEY']]) {
    try {
      const snap = await db.doc(path).get();
      const k = snap.exists ? String(snap.data()[field] || '') : '';
      if (k) { _anthropicKey = k; process.env.ANTHROPIC_API_KEY = k; return k; }
    } catch (e) { console.warn('getAnthropicKey read failed —', e.message); }
  }
  return '';
}
async function anthropicChat({ system, messages, max_tokens = 2000, temperature, model = 'claude-opus-4-8' }, retries = 2) {
  const key = await getAnthropicKey();
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  const body = { model, max_tokens, messages };
  if (system) body.system = system;
  if (typeof temperature === 'number') body.temperature = temperature;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'connection': 'close',
        },
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 900 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// Extract the concatenated text of an Anthropic response (ignores any
// thinking/tool blocks), then strip markdown fences and JSON.parse it.
function anthropicText(data) {
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
}
function parseAnthropicJson(data) {
  const t = anthropicText(data).replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(t);
}

// ─── Firebase Setup ─────────────────────────────────────────────────
let bucket = null;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (serviceAccount.project_id) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: `${serviceAccount.project_id}.firebasestorage.app`,
    });
    bucket = admin.storage().bucket();
    console.log('Firebase Storage initialized');
  } else {
    console.warn('FIREBASE_SERVICE_ACCOUNT not set — images will use temporary URLs');
  }
} catch (err) {
  console.warn('Firebase init failed:', err.message);
}

// ─── Product pipeline ───────────────────────────────────────────────
// Each service is a self-contained module (router + helpers). The pipeline
// module orchestrates them: design → POD product → draft Etsy listing.
//   etsy     — Etsy Open API v3 (draft listings; app key + OAuth 2.0)
//   printify — POD, wide catalog / lower cost (apparel, cards)
//   printful — POD, in-house quality (apparel, greeting cards)
//   lulu     — POD, books / coloring books
//   pipeline — listing-content (SEO) generation + design→Etsy orchestration
//
// Mounted AFTER Firebase init so the Firestore key-loader can hydrate
// process.env from the config doc before each module reads its keys (env vars
// still win). The modules are required inside the loader's .then() so the first
// require — the one that captures process.env — happens post-hydration. Until
// it resolves (a sub-second window at startup) the /api/* pipeline routes 404.
const { loadConfig } = require('./config-loader');
loadConfig().then(() => {
  const etsy = require('./etsy');
  const printify = require('./printify');
  const printful = require('./printful');
  const lulu = require('./lulu');
  const pipeline = require('./pipeline');
  const photostudio = require('./photostudio');
  const movies = require('./movies');
  const songs = require('./songs');
  const character = require('./character');
  const stories = require('./stories');
  const mpc = require('./mpc');
  const mpcUpload = require('./mpc-upload');
  const apiframe = require('./apiframe');
  const ingest = require('./ingest');
  const etsyReport = require('./etsy-report');
  const shopify = require('./shopify');
  const blog = require('./blog');
  const sync = require('./sync');
  const writing = require('./writing');
  const gdrive = require('./gdrive');
  const chatfeed = require('./chatfeed');
  const tarotEmail = require('./tarot-email');
  const nde = require('./nde');
  app.use('/api/etsy', etsy.router);
  // No /report route exists on etsy.router, so requests fall through to here.
  app.use('/api/etsy/report', etsyReport.router);
  app.use('/api/printify', printify.router);
  app.use('/api/printful', printful.router);
  app.use('/api/lulu', lulu.router);
  app.use('/api/pipeline', pipeline.router);
  app.use('/api/photostudio', photostudio.router);
  app.use('/api/movies', movies.router);
  app.use('/api/songs', songs.router);
  app.use('/api/stories', stories.router);
  app.use('/api/mpc', mpc.router);
  app.use('/api/mpc-upload', mpcUpload.router); // full auto-upload (stops at cart)
  app.use('/api/apiframe', apiframe.router); // Midjourney deck-art generator
  app.use('/api/ingest', ingest.router); // import externally-made art (bring-your-own-MJ)
  app.use('/api/shopify', shopify.router);
  app.use('/api/blog', blog.router);
  app.use('/api/sync', sync.router);
  app.use('/api/writing', writing.router); // Writing Room (dating-book drafts + review notes)
  app.use('/api/gdrive', gdrive.router); // Google Drive OAuth (read/move/rename/trash)
  app.use('/api/chatfeed', chatfeed.router); // the Chat app (replies from every chat, in one feed)
  app.use('/api/character', character.router); // Character Creator (photo + name -> diary-comic ref)
  app.use('/api/tarot-email', tarotEmail.router); // tap-to-reveal Card of the Day email (Brevo)
  app.use('/api/nde', nde.router); // Anthony Chene NDE interview → moments database
  console.log('Pipeline routes mounted (Etsy + Printify + Printful + Lulu + orchestration + photostudio + movies + songs + stories + mpc + shopify + blog + writing + gdrive + chatfeed + nde)');
}).catch(err => console.error('Pipeline bootstrap failed:', err.message));

// Download image from URL and upload to Firebase, return permanent URL
async function saveToFirebase(imageUrl, folder = 'images') {
  if (!bucket || !imageUrl) return imageUrl;
  try {
    console.log('Saving to Firebase:', folder, 'from', imageUrl.slice(0, 80));
    const res = await fetch(imageUrl, { redirect: 'follow' });
    if (!res.ok) {
      console.warn('Firebase: fetch failed with status', res.status);
      return imageUrl;
    }
    const buffer = await res.buffer();
    const contentType = res.headers.get('content-type') || '';
    let ext = 'png';
    if (contentType.includes('webp') || imageUrl.includes('.webp')) ext = 'webp';
    else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const file = bucket.file(filename);
    await file.save(buffer, {
      metadata: { contentType: contentType || (ext === 'webp' ? 'image/webp' : 'image/png') },
    });
    await file.makePublic();
    const permanentUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    console.log('Firebase: saved as', filename);
    return permanentUrl;
  } catch (err) {
    console.warn('Firebase upload failed:', err.message);
    return imageUrl;
  }
}

// Save a raw image buffer (e.g. gpt-image-1 base64 output) to Firebase and
// return a permanent URL. Falls back to a data URL when Firebase isn't
// configured, so the image still renders without any credentials set up.
async function saveBufferToFirebase(buffer, contentType, folder = 'images') {
  const ext = contentType.includes('webp') ? 'webp'
    : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg'
    : contentType.includes('mpeg') || contentType.includes('mp3') ? 'mp3'
    : contentType.includes('wav') ? 'wav'
    : contentType.includes('opus') ? 'opus'
    : contentType.includes('aac') ? 'aac'
    : contentType.includes('flac') ? 'flac' : 'png';
  if (!bucket) return `data:${contentType};base64,${buffer.toString('base64')}`;
  try {
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const file = bucket.file(filename);
    await file.save(buffer, { metadata: { contentType } });
    await file.makePublic();
    const permanentUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    console.log('Firebase: saved as', filename);
    return permanentUrl;
  } catch (err) {
    console.warn('Firebase buffer upload failed:', err.message);
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  }
}

// ─── Gallery: list all saved images ─────────────────────────────────
app.get('/api/gallery', async (req, res) => {
  if (!bucket) return res.json({ images: [] });
  try {
    const [files] = await bucket.getFiles();
    const images = files
      .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f.name))
      .map(f => ({
        name: f.name,
        url: `https://storage.googleapis.com/${bucket.name}/${f.name}`,
        folder: f.name.split('/')[0] || 'uncategorized',
        created: f.metadata.timeCreated,
        meta: f.metadata.metadata || {}, // custom metadata: { model, quality, ... }
      }))
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    res.json({ images });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/gallery', (req, res) => { res.sendFile(__dirname + '/public/gallery.html'); });

// ─── Test Station: try one prompt across many styles ────────────────
app.get('/test', (req, res) => { res.sendFile(__dirname + '/public/test.html'); });

app.get('/book', (req, res) => { res.sendFile(__dirname + '/public/book.html'); });

// Secretly a Witch — the public witchy app (moon/tarot/miracles/conjure).
// Public + ungated; reuses the open /api/generate/* and /api/witch/* endpoints.
app.get('/witch', (req, res) => { res.sendFile(__dirname + '/public/witch.html'); });
// Public privacy policy (App Store requires a reachable privacy URL).
app.get('/witch/privacy', (req, res) => { res.sendFile(__dirname + '/public/witch-privacy.html'); });

// ─── Talking to Myself: standalone dream/memory zine app ────────────
app.get('/talking', (req, res) => { res.sendFile(__dirname + '/public/talking.html'); });

// ─── Sticker Page: full-page kiss-cut sticker sheet (gpt-image-2) ────
app.get('/stickers', (req, res) => { res.sendFile(__dirname + '/public/stickers.html'); });

// ─── Set: a game of three strange objects ───────────────────────────
app.get('/set', (req, res) => { res.sendFile(__dirname + '/public/set.html'); });

// Design + generate the THIRD object that completes a set from two given
// objects. The SET rule: per dimension the trio is all-same or all-different,
// so any two force the third. An LLM reasons out the third's attributes
// (same where the pair matches, a fresh third value where they differ) across
// the physical axes AND the conceptual "denied inference" axis, writes an
// image prompt, then gpt-image-2 (quality low) renders it on the house ground.
const SET_GROUND = 'A single small sculptural object photographed on a plain seamless pure white background, soft even lighting, centered, product-photo style, handmade craft feel. The object: ';

// Generate one object image from a plain description, on the house ground.
// Used by "Make a set" so the player describes the first two objects and
// regenerates them until happy (the third is designed by /api/set/third).
app.post('/api/set/object', async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: 'description is required' });
    if (!OPENAI_API_KEY) return res.status(400).json({ error: 'OPENAI_API_KEY not set on the server' });
    const data = await openaiImage({ model: 'gpt-image-2', prompt: SET_GROUND + description, n: 1, size: '1024x1024', quality: 'low', output_format: 'webp' });
    if (data.error) return res.status(400).json({ error: data.error.message });
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return res.status(400).json({ error: 'gpt-image-2 returned no image' });
    const url = await saveBufferToFirebase(Buffer.from(b64, 'base64'), 'image/webp', 'set');
    res.json({ url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/set/third', async (req, res) => {
  try {
    const { a, b } = req.body;
    if (!a || !b || !a.name || !b.name) return res.status(400).json({ error: 'two objects (a, b) are required' });
    if (!OPENAI_API_KEY) return res.status(400).json({ error: 'OPENAI_API_KEY not set on the server' });

    const sys = `You design the THIRD object for "Set" — a game like the card game SET, but played with strange little sculptural objects instead of cards. A valid set is THREE objects where, for every axis you can read, the three are either ALL THE SAME or ALL DIFFERENT — never two-and-one. Given the first two, the third is forced: same where the two match, a genuinely third value where they differ.

Axes are loose and creative, not a fixed schema: physical ones (material, scale, palette, form) and one conceptual axis — the DENIED INFERENCE: the object sets up an expectation the mind completes automatically, then refuses it. Flavors: an absent whole (a fragment that implies the missing body or scene), a refused function (a tool that defeats its own job), a refused affection (a comfort-object that repels comfort), a false worth (the disposable cast in the precious, or the reverse), a present surplus (the part you would never see is suddenly, literally there), a wrong material (an object made of what it is never made of).

THE BAR — the third must ITCH. It has to be a concrete, ordinary, NAMEABLE object that sets up ONE precise expectation and breaks it in ONE precise, physical, pointable way. The test: a viewer should flinch, or reach to supply a missing piece. Objects that itch: a porcelain teacup solid all the way through where the hollow should be; a house key cast in wobbling jelly; eyeglasses with real eyes still in the lenses; a crumpled receipt cast in sterling silver; a plush worm too small and too wrong-a-species to cuddle. Notice these are plain objects with one exact wrongness — not moods.

DO NOT DODGE. Forbidden: ethereal, abstract, or poetic escape hatches — no light, glow, mist, aura, essence, "energy", shimmer, dream, floating sparkles, or anything ineffable; no merely pretty, whimsical, or decorative resolution. If you could not photograph it plainly on a table like a product shot, it is too vague — throw it out and pick a harder, more literal object. The wrongness is specific and physical, never a vibe. Name it plainly, like a museum label, never poetically — a title like "Empty Bowl of Light" is exactly the pretty dodge to avoid.

Read the two objects. Decide each axis same or different, and force the third's value (different from BOTH where they differ). Then commit to ONE concrete everyday object that satisfies all of it and itches hard beside the other two. Return STRICT JSON only, no markdown:
{"name":"2-4 word plain title","object":"one literal sentence a product photographer could shoot: a specific ordinary object with one precise, physical wrongness","axes":[{"axis":"material","relation":"same|different","value":"..."}],"rationale":"one sentence naming the exact expectation it denies"}`;

    const user = `Object one — ${a.name}: ${a.blurb || ''}\nObject two — ${b.name}: ${b.blurb || ''}\n\nDesign the third.`;

    const chat = await openaiChat({ model: 'gpt-4o-mini', temperature: 0.8,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] });
    if (chat.error) return res.status(400).json({ error: chat.error.message });

    let design;
    try {
      const txt = chat.choices[0].message.content.trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
      design = JSON.parse(txt);
    } catch (e) { return res.status(502).json({ error: 'could not parse the third design' }); }

    const data = await openaiImage({ model: 'gpt-image-2', prompt: SET_GROUND + design.object, n: 1, size: '1024x1024', quality: 'low', output_format: 'webp' });
    if (data.error) return res.status(400).json({ error: data.error.message });
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return res.status(400).json({ error: 'gpt-image-2 returned no image' });
    const url = await saveBufferToFirebase(Buffer.from(b64, 'base64'), 'image/webp', 'set');

    res.json({ url, name: design.name || 'The third', object: design.object || '', axes: design.axes || [], rationale: design.rationale || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Studio: idea → design → AI listing → draft Etsy listing ────────
// Studio is gated when STUDIO_TOKEN is set: the page requires a password (HTTP
// Basic — any username, password = the token) and is served with the token
// injected so its API calls can authenticate. When STUDIO_TOKEN is unset the
// gate is disabled (open), so nothing breaks until it's configured.
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
// Serve a token-gated page, injecting the token so its API calls authenticate.
function serveGated(file) {
  return (req, res) => {
    if (STUDIO_TOKEN) {
      const m = (req.get('authorization') || '').match(/^Basic (.+)$/);
      const pass = m ? Buffer.from(m[1], 'base64').toString().split(':')[1] : '';
      if (pass !== STUDIO_TOKEN) {
        res.set('WWW-Authenticate', 'Basic realm="ImageForge Studio"');
        return res.status(401).send('Authentication required.');
      }
    }
    const html = fs.readFileSync(__dirname + '/public/' + file, 'utf8');
    res.type('html').send(html.replace('__STUDIO_TOKEN__', STUDIO_TOKEN));
  };
}
app.get('/studio', serveGated('studio.html'));
// Photo → Etsy: turn a photo of a finished handmade item into a reviewable Etsy
// draft (mockups + listing content). Same gate as the Studio.
app.get('/photo', serveGated('photo.html'));
// Song Station: phone recording → cleaned vocal + melody-matched instrumental
// → mixed song (keeps the real voice). Same gate as the Studio.
app.get('/song', serveGated('song.html'));
// Dreams: a faithful web copy of the iOS Dreams screen (write/record a dream →
// chronology check → hand-drawn comic pages → archive + zine), so the design
// can be iterated in the browser without a TestFlight build. Same gate; hits
// the same /api/movies/dream* endpoints.
app.get('/dreams', serveGated('dreams.html'));
// Public "try it" version of Dreams for friends: same page, NO gate, and it
// runs in guest mode (the page mints a per-device guest id and namespaces every
// dream to it) — so each visitor gets their OWN private past-dreams archive and
// never sees Sophie's or anyone else's. Serve the raw file (token left blank).
app.get('/trydreams', (req, res) => {
  const html = fs.readFileSync(__dirname + '/public/dreams.html', 'utf8');
  res.type('html').send(html.replace('__STUDIO_TOKEN__', ''));
});
// Films: the staged-approval movie pipeline as a web page (story → one probe
// image → approve/notes → three more → the rest → motion → stitched film).
// Same /api/movies engine the iOS Movies tab uses; same gate.
app.get('/films', serveGated('films.html'));
// Shop Report: what's selling / what to promote / what to put on sale, from
// live Etsy listings + orders + reviews. Same gate as the Studio.
app.get('/report', serveGated('report.html'));
// Character Creator: upload a photo + a name -> a diary-comic character
// reference, saved and compiled into a "main characters" sheet. Web prototype
// of the feature that will live in the iOS Story Boards screen.
app.get('/character', serveGated('character.html'));
// Story view: the Evan & Charlie video asset board — approved art placed
// inside the narration with missing beats flagged. A committed snapshot
// (assets embedded as data URIs); regenerate when the asset set changes.
// Same gate as the Studio.
app.get('/story', serveGated('story.html'));

// Story-board API: the same projects, served live from Firestore (synced by
// scripts/sync-story.js) so the iOS app updates without an app build. Reads
// the `forge-story` collection. Same x-studio-token gate as the pipeline.
// GOTCHA (discovered 2026-07-11): this server's FIREBASE_SERVICE_ACCOUNT is the
// deckfactory-43176 project, but the story boards (and the iOS app's direct
// Firestore reads) live in membry-df528. Set STORY_FIREBASE_SERVICE_ACCOUNT to
// a membry service-account JSON to read the real boards; without it this
// endpoint can only see the (empty) local project's collection.
let storyApp = null;
let storyCredChecked = false;
function initStoryApp(saJson) {
  storyApp = admin.initializeApp(
    { credential: admin.credential.cert(saJson),
      storageBucket: `${saJson.project_id}.firebasestorage.app` }, 'story');
  console.log('Story boards: secondary Firebase app initialized (' + saJson.project_id + ')');
}
async function storyDb() {
  if (storyApp) return storyApp.firestore();
  const raw = process.env.STORY_FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    try { initStoryApp(JSON.parse(raw)); return storyApp.firestore(); }
    catch (err) { console.error('STORY_FIREBASE_SERVICE_ACCOUNT invalid:', err.message); }
  }
  // Fall back to a credential stored in THIS project's Firestore (set once via
  // POST /api/story/credential — same survival-across-deploys trick as the
  // Etsy tokens in config/etsy-tokens).
  if (!storyCredChecked && admin.apps.length) {
    storyCredChecked = true;
    try {
      const doc = await admin.firestore().doc('config/story-credential').get();
      if (doc.exists && doc.data().serviceAccount) {
        initStoryApp(JSON.parse(doc.data().serviceAccount));
        return storyApp.firestore();
      }
    } catch (err) { console.error('story credential load failed:', err.message); }
  }
  if (!admin.apps.length) return null;
  return admin.firestore();
}
// Store the membry service-account JSON once; write-once (409 on repeat)
// unless ?force=1, and only accepted after a live test read of forge-story.
app.post('/api/story/credential', express.json({ limit: '64kb' }), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'firebase not configured' });
    const sa = req.body && req.body.serviceAccount;
    if (!sa || sa.type !== 'service_account' || !sa.project_id || !sa.private_key) {
      return res.status(400).json({ error: 'serviceAccount must be a service_account JSON object' });
    }
    const ref = admin.firestore().doc('config/story-credential');
    if ((await ref.get()).exists && req.query.force !== '1') {
      return res.status(409).json({ error: 'credential already set (use ?force=1 to replace)' });
    }
    // Prove it works before saving: read forge-story with a throwaway app.
    const testApp = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'story-test-' + Date.now());
    let count;
    try {
      count = (await testApp.firestore().collection('forge-story').get()).size;
    } finally { await testApp.delete(); }
    await ref.set({ serviceAccount: JSON.stringify(sa), projectId: sa.project_id, updated: new Date().toISOString() });
    if (storyApp) { await storyApp.delete().catch(() => {}); storyApp = null; }
    storyCredChecked = false;
    res.json({ ok: true, projectId: sa.project_id, boardsVisible: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Upload art for a beat from the Story Room — image goes straight to the
// boards' Storage as a CANDIDATE card; no chat tokens spent looking at it.
app.post('/api/story/art', express.json({ limit: '14mb' }), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { projectId, beat, label, image } = req.body || {};
    const m = String(image || '').match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: 'image must be a data URL' });
    const db = await storyDb();
    if (!db || !storyApp) return res.status(503).json({ error: 'story credential not configured' });
    const ref = db.collection('forge-story').doc(String(projectId));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'unknown project' });
    const data = doc.data();
    const b = (data.beats || [])[Number(beat)];
    if (!b) return res.status(404).json({ error: 'unknown beat' });
    const ext = m[1].split('/')[1].split(';')[0].replace('jpeg', 'jpg');
    const name = `story/upload-${projectId}-b${beat}-${Date.now()}.${ext}`;
    const bucket = storyApp.storage().bucket();
    const file = bucket.file(name);
    await file.save(Buffer.from(m[2], 'base64'), { contentType: m[1], resumable: false });
    await file.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
    b.cards = b.cards || [];
    b.cards.push({ label: String(label || 'uploaded art').slice(0, 80), status: 'cand', url });
    await ref.set(data);
    res.json({ ok: true, url, card: b.cards.length - 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Flip a card's status from the Story Room (tap-to-approve).
app.post('/api/story/status', express.json(), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { projectId, beat, card, status } = req.body || {};
    if (!['ok', 'cand', 'draft', 'miss'].includes(status)) {
      return res.status(400).json({ error: 'status must be ok|cand|draft|miss' });
    }
    const db = await storyDb();
    if (!db) return res.status(503).json({ error: 'firebase not configured' });
    const ref = db.collection('forge-story').doc(String(projectId));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'unknown project' });
    const data = doc.data();
    const b = (data.beats || [])[Number(beat)];
    const c = b && (b.cards || [])[Number(card)];
    if (!c) return res.status(404).json({ error: 'unknown beat/card' });
    c.status = status;
    await ref.set(data);
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shared: save a data-URL image to the boards' Storage (public), like /art.
// Returns the public URL, or null if `image` isn't a data URL. Needs storyApp.
async function saveStoryImage(image, namePrefix) {
  const m = String(image || '').match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (!m) return null;
  const ext = m[1].split('/')[1].split(';')[0].replace('jpeg', 'jpg');
  const rand = Math.random().toString(36).slice(2, 8);
  const bucket = storyApp.storage().bucket();
  const file = bucket.file(`story/${namePrefix}-${Date.now()}-${rand}.${ext}`);
  await file.save(Buffer.from(m[2], 'base64'), { contentType: m[1], resumable: false });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${file.name}`;
}
function storySlug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

// Create or update a project's meta (title / cover / order) from the Story
// Room — so Sophie can stand up a NEW story herself, no chat / sync-story.js.
// No id → derive a unique slug from the title and create an empty project.
// Existing id → merge meta, never touch beats.
app.post('/api/story/project', express.json({ limit: '14mb' }), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { id, title, cover, order } = req.body || {};
    if (!id && !String(title || '').trim()) return res.status(400).json({ error: 'title required' });
    const db = await storyDb();
    if (!db || !storyApp) return res.status(503).json({ error: 'story credential not configured' });
    const col = db.collection('forge-story');
    let docId = id ? String(id) : (storySlug(title) || 'story');
    if (!id) {
      let base = docId, n = 1;
      while ((await col.doc(docId).get()).exists) { n++; docId = base + '-' + n; }
    }
    const ref = col.doc(docId);
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : { id: docId, beats: [] };
    data.id = docId;
    if (title != null && String(title).trim()) data.title = String(title).slice(0, 120);
    if (order != null && order !== '') data.order = Number(order);
    else if (data.order == null) {
      const all = await col.get();
      data.order = all.docs.reduce((mx, d) => Math.max(mx, d.data().order ?? 0), 0) + 1;
    }
    if (cover) {
      const url = await saveStoryImage(cover, `cover-${docId}`);
      if (url) data.cover = url;
    }
    if (!Array.isArray(data.beats)) data.beats = [];
    await ref.set(data);
    res.json({ ok: true, id: docId, project: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a beat (no `beat`) or edit an existing beat's narration (`beat` index).
app.post('/api/story/beat', express.json(), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { projectId, vo, beat } = req.body || {};
    const db = await storyDb();
    if (!db) return res.status(503).json({ error: 'firebase not configured' });
    const ref = db.collection('forge-story').doc(String(projectId));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'unknown project' });
    const data = doc.data();
    if (!Array.isArray(data.beats)) data.beats = [];
    let beatIndex;
    if (beat == null || beat === '') {
      data.beats.push({ vo: String(vo || '').slice(0, 2000), cards: [] });
      beatIndex = data.beats.length - 1;
    } else {
      const b = data.beats[Number(beat)];
      if (!b) return res.status(404).json({ error: 'unknown beat' });
      b.vo = String(vo || '').slice(0, 2000);
      beatIndex = Number(beat);
    }
    await ref.set(data);
    res.json({ ok: true, beat: beatIndex, beats: data.beats.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk-dump many images into a project's INBOX (unsorted holding area) in one
// request — "add lots of art, sort it out later". Accepts data URLs or https
// URLs. Sorting into beats happens via /api/story/assign.
app.post('/api/story/inbox', express.json({ limit: '60mb' }), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { projectId, images } = req.body || {};
    if (!Array.isArray(images) || !images.length) return res.status(400).json({ error: 'images[] required' });
    const db = await storyDb();
    if (!db || !storyApp) return res.status(503).json({ error: 'story credential not configured' });
    const ref = db.collection('forge-story').doc(String(projectId));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'unknown project' });
    const data = doc.data();
    if (!Array.isArray(data.inbox)) data.inbox = [];
    let added = 0;
    for (const img of images.slice(0, 100)) {
      let url = null;
      if (/^https?:\/\//.test(String(img))) url = String(img);
      else url = await saveStoryImage(img, `inbox-${projectId}`);
      if (url) { data.inbox.push({ url }); added++; }
    }
    await ref.set(data);
    res.json({ ok: true, added, inbox: data.inbox.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Triage: move one piece of art between the inbox and beats. `from` is
// {inbox:i} or {beat,card}; `to` is {beat} or {inbox}. Covers inbox→beat
// (file it), beat→beat (re-file), and beat/inbox→inbox (un-sort). This is the
// shared surface both Sophie's taps and a chat's auto-sort call.
app.post('/api/story/assign', express.json(), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { projectId, from, to } = req.body || {};
    const db = await storyDb();
    if (!db) return res.status(503).json({ error: 'firebase not configured' });
    const ref = db.collection('forge-story').doc(String(projectId));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'unknown project' });
    const data = doc.data();
    if (!Array.isArray(data.beats)) data.beats = [];
    if (!Array.isArray(data.inbox)) data.inbox = [];
    // pull the item out of its source
    let item;
    if (from && from.inbox != null) {
      const i = Number(from.inbox);
      if (i < 0 || i >= data.inbox.length) return res.status(404).json({ error: 'unknown inbox item' });
      item = data.inbox.splice(i, 1)[0];
    } else if (from && from.beat != null && from.card != null) {
      const b = data.beats[Number(from.beat)];
      const c = b && (b.cards || [])[Number(from.card)];
      if (!c) return res.status(404).json({ error: 'unknown source card' });
      item = b.cards.splice(Number(from.card), 1)[0];
    } else {
      return res.status(400).json({ error: 'from must be {inbox} or {beat,card}' });
    }
    // drop it into its destination
    if (to && to.beat != null) {
      const b = data.beats[Number(to.beat)];
      if (!b) return res.status(404).json({ error: 'unknown target beat' });
      b.cards = b.cards || [];
      b.cards.push({ label: item.label || 'uploaded art', status: item.status || 'cand', url: item.url });
    } else if (to && to.inbox != null) {
      data.inbox.push({ url: item.url, label: item.label });
    } else {
      return res.status(400).json({ error: 'to must be {beat} or {inbox}' });
    }
    await ref.set(data);
    res.json({ ok: true, inbox: data.inbox.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a whole project — so a story Sophie created (or mis-created) herself
// isn't stranded needing a chat to remove it.
app.delete('/api/story/project/:id', async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const db = await storyDb();
    if (!db) return res.status(503).json({ error: 'firebase not configured' });
    const ref = db.collection('forge-story').doc(String(req.params.id));
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'unknown project' });
    await ref.delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Archive / restore a story instead of hard-deleting it. Sets an `archived`
// flag on the forge-story doc; the shelf hides archived stories into an
// "Archived" area they can be restored from (nothing is ever lost). Pass
// { archived:false } to restore.
app.post('/api/story/project/:id/archive', express.json(), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const db = await storyDb();
    if (!db) return res.status(503).json({ error: 'firebase not configured' });
    const ref = db.collection('forge-story').doc(String(req.params.id));
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'unknown project' });
    const archived = !(req.body && req.body.archived === false);
    await ref.set({ archived }, { merge: true });
    res.json({ ok: true, archived });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/story', async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const db = await storyDb();
    if (!db) return res.status(503).json({ error: 'firebase not configured' });
    // No orderBy: Firestore's orderBy silently drops docs missing the field.
    const snap = await db.collection('forge-story').get();
    const projects = snap.docs.map((d) => d.data())
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    res.json({ projects, source: storyApp ? 'membry (STORY_FIREBASE_SERVICE_ACCOUNT)' : 'local project' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Thumbnails for the Story Room: the boards' card images are full-res
// (~3MB PNGs), which made the grid crawl on the phone. Resize once with
// sharp, cache the webp in THIS project's Storage (`thumbs/`), and
// 302-redirect there ever after. No token gate — <img> tags can't send
// headers — but it only re-serves already-public images from Google
// storage hosts, so it can't be used as an open proxy. Any failure falls
// back to redirecting to the original image rather than a broken cell.
const THUMB_HOSTS = /^https:\/\/(storage\.googleapis\.com|firebasestorage\.googleapis\.com)\//;
const thumbHot = new Map(); // url|w → cached public URL (per-process)
// Content-addressed thumb path — computable WITHOUT generating, so the assets
// list can hand out direct storage URLs for thumbs that already exist.
const thumbName = (url, w) => 'thumbs/'
  + require('crypto').createHash('sha1').update(url + '|' + w).digest('hex') + '.webp';
async function makeThumb(url, w) {
  const key = url + '|' + w;
  if (thumbHot.has(key)) return thumbHot.get(key);
  const bucket = admin.storage().bucket();
  const file = bucket.file(thumbName(url, w));
  const [exists] = await file.exists();
  if (!exists) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('fetch ' + r.status);
    const out = await require('sharp')(await r.buffer())
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    await file.save(out, { contentType: 'image/webp', resumable: false });
    await file.makePublic();
  }
  const pub = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
  thumbHot.set(key, pub);
  return pub;
}
// Background warmer: pre-makes missing thumbs right after an assets-list
// request (a few at a time), so tiles get direct storage URLs on the next
// load instead of bouncing through this server one image at a time.
const thumbWarmQ = []; const thumbWarmSeen = new Set(); let thumbWarmActive = 0;
function warmThumbs(urls, w) {
  urls.forEach((u) => {
    const k = u + '|' + w;
    if (!thumbWarmSeen.has(k)) { thumbWarmSeen.add(k); thumbWarmQ.push([u, w]); }
  });
  const tick = () => {
    while (thumbWarmActive < 3 && thumbWarmQ.length) {
      const [u, ww] = thumbWarmQ.shift();
      thumbWarmActive++;
      makeThumb(u, ww).catch(() => {}).then(() => { thumbWarmActive--; tick(); });
    }
  };
  tick();
}
app.get('/api/story/thumb', async (req, res) => {
  const url = String(req.query.url || '');
  try {
    const w = Math.max(80, Math.min(1200, parseInt(req.query.w, 10) || 480));
    if (!THUMB_HOSTS.test(url)) return res.status(400).json({ error: 'unsupported image host' });
    if (!admin.apps.length) return res.redirect(302, url);
    res.redirect(302, await makeThumb(url, w));
  } catch (err) {
    console.error('thumb failed:', err.message);
    if (THUMB_HOSTS.test(url)) return res.redirect(302, url);
    res.status(500).json({ error: err.message });
  }
});

// ─── Gallery drop-box: POST /api/gallery ───────────────────────────
// The iOS "My Creations" gallery reads users/{uid}/creations in membry —
// normally only writable with the Admin SDK (scripts/post-to-gallery.js).
// This endpoint is the server-side version so the chats' Stop hook can file
// image deliverables automatically: {url} for an already-hosted image or
// {image} as a data URL (uploaded to membry Storage like the script does).
// De-dupes by url so re-mentions never double-post. Sophie's device uid comes
// from GALLERY_UID env, the config/gallery-uid doc, or auto-discovery (list
// membry users, pick the device with the most recent creation) — cached.
let galleryUidCache = null;
async function galleryUid() {
  if (process.env.GALLERY_UID) return process.env.GALLERY_UID;
  if (galleryUidCache) return galleryUidCache;
  if (admin.apps.length) {
    try {
      const doc = await admin.firestore().doc('config/gallery-uid').get();
      if (doc.exists && doc.data().uid) return (galleryUidCache = doc.data().uid);
    } catch (err) { /* fall through to discovery */ }
  }
  // discover: the membry user whose creations have the newest createdAt
  const mdb = storyApp.firestore();
  const users = await mdb.collection('users').listDocuments();
  let best = null; let bestTs = 0;
  for (const u of users.slice(0, 40)) {
    try {
      const snap = await u.collection('creations').orderBy('createdAt', 'desc').limit(1).get();
      if (!snap.empty) {
        const ts = snap.docs[0].data().createdAt;
        const ms = ts && ts.toMillis ? ts.toMillis() : 0;
        if (ms > bestTs) { bestTs = ms; best = u.id; }
      }
    } catch (err) { /* user without creations */ }
  }
  if (!best) throw new Error('could not discover the gallery uid — set GALLERY_UID');
  galleryUidCache = best;
  if (admin.apps.length) {
    await admin.firestore().doc('config/gallery-uid').set(
      { uid: best, discovered: new Date().toISOString() }).catch(() => {});
  }
  return best;
}
app.post('/api/gallery', express.json({ limit: '14mb' }), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { url, image, prompt, created, style, type, dry, chat, assetsOnly } = req.body || {};
    const createdMs = Number(created) || Date.now();
    // assetsOnly: a work-in-progress image caught behind the scenes — file it to
    // the chat's Assets tab (forge-chat-assets, deckfactory) ONLY, never the main
    // "My Creations" gallery, so that stays curated to finished deliverables.
    // Needs a hosted URL + a chat + the deckfactory admin app (no membry upload).
    if (assetsOnly) {
      if (dry) return res.json({ ok: true, dry: true, assetsOnly: true });
      const wipUrl = url && /^https:\/\/(storage|firebasestorage)\.googleapis\.com\//.test(String(url))
        ? String(url) : null;
      if (!wipUrl) return res.status(400).json({ error: 'assetsOnly requires a hosted url' });
      if (!chat || !admin.apps.length) return res.json({ ok: true, skipped: 'no chat/admin' });
      const acol = admin.firestore().collection('forge-chat-assets');
      const adup = await acol.where('chat', '==', String(chat).slice(0, 60))
        .where('url', '==', wipUrl).limit(1).get();
      if (!adup.empty) {
        // A curated caption (e.g. "gpt-image-2 · medium") may arrive after the
        // hook's generic record — upgrade the existing doc in place instead of
        // silently dropping it.
        const existing = adup.docs[0];
        const curated = String(prompt || '').trim();
        const old = String(existing.data().prompt || '');
        if (curated && !/^from /.test(curated) && (!old || /^from /.test(old))) {
          await existing.ref.update({ prompt: curated.slice(0, 500) });
          return res.json({ ok: true, updated: true, url: wipUrl });
        }
        return res.json({ ok: true, deduped: true, url: wipUrl });
      }
      await acol.add({
        chat: String(chat).slice(0, 60), url: wipUrl,
        prompt: String(prompt || '').slice(0, 500),
        created: new Date(createdMs).toISOString(), wip: true,
      });
      return res.json({ ok: true, assetsOnly: true, url: wipUrl });
    }
    await storyDb();
    if (!storyApp) return res.status(503).json({ error: 'membry credential not configured' });
    const uid = await galleryUid();
    if (dry) return res.json({ ok: true, dry: true, uid: uid.slice(0, 6) + '…' });
    let finalUrl = url && /^https:\/\/(storage|firebasestorage)\.googleapis\.com\//.test(String(url))
      ? String(url) : null;
    if (!finalUrl && image) {
      const m = String(image).match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
      if (!m) return res.status(400).json({ error: 'image must be a data URL' });
      const ext = m[1].split('/')[1].split(';')[0].replace('jpeg', 'jpg');
      const bucket = storyApp.storage().bucket();
      const f = bucket.file(`claude-deliveries/${createdMs}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
      await f.save(Buffer.from(m[2], 'base64'), { contentType: m[1], resumable: false });
      await f.makePublic();
      finalUrl = `https://storage.googleapis.com/${bucket.name}/${f.name}`;
    }
    if (!finalUrl) return res.status(400).json({ error: 'url (Firebase Storage) or image (data URL) required' });
    // Per-chat asset record (deckfactory, where forge-chat-* live) — powers the
    // Assets tab inside each chat. Independent of the iOS-gallery de-dupe below.
    if (chat && admin.apps.length) {
      try {
        const acol = admin.firestore().collection('forge-chat-assets');
        const adup = await acol.where('chat', '==', String(chat).slice(0, 60))
          .where('url', '==', finalUrl).limit(1).get();
        if (adup.empty) {
          await acol.add({
            chat: String(chat).slice(0, 60), url: finalUrl,
            prompt: String(prompt || '').slice(0, 500),
            created: new Date(createdMs).toISOString(),
          });
        }
      } catch (e) { /* per-chat record is best-effort */ }
    }
    const col = storyApp.firestore().collection('users').doc(uid).collection('creations');
    if (url) { // de-dupe hosted URLs (uploads are always fresh objects)
      const dup = await col.where('url', '==', finalUrl).limit(1).get();
      if (!dup.empty) return res.json({ ok: true, deduped: true, url: finalUrl });
    }
    const doc = {
      type: String(type || 'image'), url: finalUrl,
      prompt: String(prompt || '').slice(0, 500), stickers: null,
      createdAt: admin.firestore.Timestamp.fromMillis(createdMs),
      source: 'auto-hook',
    };
    if (style) doc.style = String(style).slice(0, 80);
    const ref = await col.add(doc);
    res.json({ ok: true, id: ref.id, url: finalUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Per-chat image gallery for the Chats "Assets" tab. The images a chat makes are
// filed to the iOS gallery (creations) tagged prompt "from <chat>", so THAT is
// the real source; union it with forge-chat-assets (clean per-chat tags going
// forward). Newest first. NOTE: only images filed WITH a chat tag (from the v3
// hook onward) are attributable — older creations carry real prompts, not a
// chat, so they can't be grouped here.
app.get('/api/gallery/assets', async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  res.set('Cache-Control', 'no-store'); // the app webview must never serve a stale list
  try {
    const chat = String(req.query.chat || '').slice(0, 60);
    if (!chat) return res.status(400).json({ error: 'chat required' });
    const limit = Math.min(500, parseInt(req.query.limit, 10) || 300);
    await storyDb();
    const seen = new Map();
    const add = (url, ms, prompt) => {
      if (!url) return;
      const existing = seen.get(url);
      if (!existing) { seen.set(url, { url, ms: ms || 0, prompt: prompt || '' }); return; }
      // A curated tag (e.g. "gpt-image-2 · medium") beats a generic "from <chat>"
      // label for the same image, so the model/quality caption wins.
      if (prompt && !/^from /.test(prompt) && /^from /.test(existing.prompt || '')) {
        existing.prompt = prompt;
      }
    };
    // (a) iOS gallery creations this chat filed (prompt === "from <chat>")
    if (storyApp) {
      try {
        const uid = await galleryUid();
        const snap = await storyApp.firestore().collection('users').doc(uid)
          .collection('creations').where('prompt', '==', 'from ' + chat).get();
        snap.docs.forEach((d) => {
          const c = d.data();
          const ms = c.createdAt && c.createdAt.toMillis ? c.createdAt.toMillis() : 0;
          add(c.url, ms, c.prompt);
        });
      } catch (e) { /* uid discovery unavailable */ }
    }
    // (b) forge-chat-assets (deckfactory) — clean per-chat tags
    if (admin.apps.length) {
      try {
        const asnap = await admin.firestore().collection('forge-chat-assets')
          .where('chat', '==', chat).get();
        asnap.docs.forEach((d) => { const a = d.data(); add(a.url, Date.parse(a.created) || 0, a.prompt); });
      } catch (e) { /* best effort */ }
    }
    const assets = Array.from(seen.values()).sort((x, y) => y.ms - x.ms).slice(0, limit)
      .map((a) => ({ url: a.url, prompt: a.prompt, created: a.ms ? new Date(a.ms).toISOString() : '' }));
    // Direct thumbnail URLs: the thumb path is content-addressed, so we can
    // hand out the storage.googleapis.com URL without any lookup. Tiles load
    // straight from storage's CDN — no per-image 302 hop through this server.
    // If a thumb isn't made yet the direct URL 404s and the client falls back
    // to /api/story/thumb (which generates on demand); meanwhile we warm the
    // missing ones in the background so the next load is all-direct.
    if (admin.apps.length) {
      const bucket = admin.storage().bucket();
      const warm = [];
      assets.forEach((a) => {
        if (!THUMB_HOSTS.test(a.url)) return;
        a.thumb = `https://storage.googleapis.com/${bucket.name}/${thumbName(a.url, 480)}`;
        warm.push(a.url);
      });
      if (warm.length) warmThumbs(warm, 480);
    }
    // Sophie's ♥/✕ curation votes ride along so the tiles can show them —
    // and so any chat reading this list sees her verdicts.
    try {
      if (admin.apps.length) {
        const vs = await admin.firestore().collection('forge-asset-votes').where('chat', '==', chat).get();
        const votes = new Map();
        vs.docs.forEach((d) => { const v = d.data(); votes.set(v.url, v); });
        assets.forEach((a) => {
          const v = votes.get(a.url);
          if (v && v.vote) a.vote = v.vote;
          if (v && v.note) a.note = v.note;
          if (v && v.done) a.done = true;
        });
      }
    } catch (e) { /* votes are best-effort */ }
    res.json({ chat, assets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cleanup: delete forge-chat-assets caption records for a chat, optionally
// only those whose url contains a substring (e.g. "/characters/" to remove the
// duplicate label records that pointed at the portrait's own url instead of
// the hook's gallery copy). Returns how many were removed.
app.post('/api/gallery/asset-cleanup', express.json(), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { chat, urlContains, dry } = req.body || {};
    if (!chat) return res.status(400).json({ error: 'chat required' });
    if (!admin.apps.length) return res.status(503).json({ error: 'admin unavailable' });
    const snap = await admin.firestore().collection('forge-chat-assets')
      .where('chat', '==', String(chat).slice(0, 60)).get();
    const match = snap.docs.filter((d) => {
      const u = String((d.data() || {}).url || '');
      return !urlContains || u.includes(String(urlContains));
    });
    if (dry) return res.json({ ok: true, dry: true, wouldDelete: match.length });
    let n = 0;
    for (const d of match) { await d.ref.delete(); n++; }
    res.json({ ok: true, deleted: n });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sophie's curation vote on one Assets-tab image: ♥ ('like'), ✕ ('dislike'),
// or null to clear. One doc per chat+url (deterministic id) in deckfactory.
// Chats read the verdicts off GET /api/gallery/assets and act on them.
app.post('/api/gallery/assets/vote', express.json(), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { chat, url, vote, note, done } = req.body || {};
    if (!chat || !url) return res.status(400).json({ error: 'chat and url required' });
    if (!admin.apps.length) return res.status(503).json({ error: 'firestore unavailable' });
    const id = require('crypto').createHash('sha1')
      .update(String(chat) + '|' + String(url)).digest('hex');
    const ref = admin.firestore().collection('forge-asset-votes').doc(id);
    // vote, note, and done update independently: send only the field you're
    // changing (vote: 'like'|'dislike'|null to clear; note: string|null to
    // clear; done: true when a chat has acted on the note, false/null to clear).
    const patch = { chat: String(chat).slice(0, 60), url: String(url).slice(0, 500),
      updated: new Date().toISOString() };
    if (vote !== undefined) {
      patch.vote = (vote === 'like' || vote === 'dislike')
        ? vote : admin.firestore.FieldValue.delete();
    }
    if (note !== undefined) {
      const t = String(note == null ? '' : note).trim();
      patch.note = t ? t.slice(0, 300) : admin.firestore.FieldValue.delete();
    }
    if (done !== undefined) {
      patch.done = done ? true : admin.firestore.FieldValue.delete();
    }
    await ref.set(patch, { merge: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── The Wall: everything every chat produced, in one live feed ─────
// Merges this project's Storage (generated images, movie panels, zine
// pages, dream comics) with the story boards' art (membry bucket) into
// one newest-first list for the /wall page. Same gate as the pipeline.
app.get('/api/wall', async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const limit = Math.min(500, parseInt(req.query.limit, 10) || 200);
    const out = [];
    // derived/plumbing folders, not art
    const SKIP = /^(thumbs|writing-audio|writing-notes|chat-feed|songs|ingest)\//;
    if (bucket) {
      const [files] = await bucket.getFiles();
      files.forEach((f) => {
        if (SKIP.test(f.name) || !/\.(png|jpe?g|webp)$/i.test(f.name)) return;
        out.push({
          url: `https://storage.googleapis.com/${bucket.name}/${f.name}`,
          folder: f.name.split('/')[0] || 'studio',
          created: f.metadata.timeCreated,
        });
      });
    }
    try {
      await storyDb(); // initializes storyApp when a credential is configured
      if (storyApp) {
        const sb = storyApp.storage().bucket();
        const [sfiles] = await sb.getFiles({ prefix: 'story/' });
        sfiles.forEach((f) => {
          if (!/\.(png|jpe?g|webp)$/i.test(f.name)) return;
          out.push({
            url: `https://storage.googleapis.com/${sb.name}/${f.name}`,
            folder: 'story boards',
            created: f.metadata.timeCreated,
          });
        });
      }
    } catch (err) { console.warn('wall: story bucket unavailable:', err.message); }
    out.sort((a, b) => (a.created < b.created ? 1 : -1));
    res.json({ images: out.slice(0, limit), total: out.length, newest: out[0] ? out[0].created : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/wall', serveGated('wall.html'));

// Story Room: the movie asset boards in the Writing Room's frame — narration
// with the art in place, live from /api/story (no deploy needed for content),
// notes per beat via /api/writing/notes (keys "story-<project>:b<beat>").
// Regenerate with scripts/gen-storyroom.py. Same gate as the Studio.
app.get('/storyroom', serveGated('storyroom.html'));

// Writing Room: the dating-book working drafts — every date in two versions
// (Sophie's original journal + the current draft with Claude's changes in
// red), autoscroll reading, and review notes (text or voice memo) that persist
// to Firestore (`forge-writing-notes`) so any chat can pull and apply them.
// Page + data regenerate with scripts/gen-writing.py. Same gate as the Studio.
app.get('/writing', serveGated('writing.html'));

// The Chat app: every project chat's replies in one feed — picture icon per
// chat, tap to expand, free device-voice read-aloud, polished memos when
// attached, and a reply box (chats pick replies up on their hourly checks).
// Regenerate with scripts/gen-chats.py. Same gate as the Studio.
app.get('/chats', serveGated('chats.html'));

// Blog Studio: SEO blog posts (long-tail keyword research → written post +
// images → publish to the Shopify store blog). Same gate as the Studio.
app.get('/blog', serveGated('blog.html'));
// Import Art: drop in card images made elsewhere (e.g. bulk-downloaded from your
// own Midjourney) as a named batch the deck workflow can pull from.
app.get('/import', serveGated('ingest.html'));

// ─── Available models ───────────────────────────────────────────────
// House styles. Each Replicate entry is a Flux LoRA with a trigger word that's
// prepended to every prompt. `version` may be null — when so, the latest model
// version is resolved from Replicate on first use (see resolveReplicateVersion),
// which is how new LoRAs (e.g. HOONIE) can be added without pinning a hash.
//   promptSuffix — appended to every prompt for this model (style anchor).
//   defaultSteps — num_inference_steps to use when the client doesn't override.
const MODELS = {
  replicate: [
    { id: 'sageryza/gosh', version: 'd337796af9f1cc9566f378d2f78deff7864bd5439247935a9f651e5762cdfb39', name: 'Gouache', trigger: 'gosh' },
    { id: 'sageryza/paint', version: '89efc7b98503ea158b5f848a5edbfd8d9bd24d589ccf34986eeee6b3d87fadcd', name: 'Painterly', trigger: 'pnt' },
    { id: 'sageryza/special', version: '82d7dd7806bf8fb62fb4e36d67ed361d088e10743c56737e0f08904ec8a5a920', name: 'Sketchy', trigger: 'special' },
    { id: 'sageryza/victorianstyle', version: '50684448f55b69edd2ca835099ed927f24690d79bfcc90a1334962c591a78cce', name: 'Book Illustrations', trigger: 'vict', promptSuffix: 'black and white pen and ink line illustration, fine linework, whimsical mid-century childrens book style, white background' },
    { id: 'sageryza/watercolordrawings', version: 'a6749d940388a669f79efc36018b93436568ca6a6a59c57ddd87dc43fa3e6c1f', name: 'Watercolor Drawings', trigger: 'wtr' },
    { id: 'sageryza/pwcscans', version: 'fdb33f8d1af98c2fd4e736c25d52e307ea88958729ce7319691e5d784f40d18b', name: 'PWC Scans', trigger: 'tok' },
    { id: 'sageryza/hoonie', version: null, name: 'Hoonie Linocut', trigger: 'HOONIE', promptSuffix: 'linocut relief print, white background', defaultSteps: 40 },
  ],
  // OpenAI image generation. The DALL·E 3 style presets were retired — a single
  // clean entry remains so OpenAI is still selectable alongside the LoRAs.
  dalle: [
    { id: 'dall-e-3', name: 'DALL·E 3', stylePrompt: '' },
  ],
  // gpt-image-2 (OpenAI's current image model), rendered at quality "low" to
  // stay fast + cheap — the same model/setting the zine uses.
  openai: [
    { id: 'gpt-image-2', name: 'ChatGPT (gpt-image-2)', quality: 'low' },
  ],
};

// Resolve a Replicate model's version id. Pinned versions are returned as-is;
// models with version:null have their latest version fetched once and cached.
const versionCache = new Map();
async function resolveReplicateVersion(known) {
  if (known.version) return known.version;
  if (versionCache.has(known.id)) return versionCache.get(known.id);
  const res = await fetch(`https://api.replicate.com/v1/models/${known.id}`, {
    headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
  });
  const data = await res.json();
  const latest = data?.latest_version?.id;
  if (!latest) throw new Error(`Could not resolve latest version for ${known.id}`);
  versionCache.set(known.id, latest);
  return latest;
}

app.get('/api/models', (req, res) => {
  res.json(MODELS);
});

// ─── Raw Claude passthrough (one clean, context-free call) ──────────
// A stateless bridge to a fresh Claude via the server's ANTHROPIC_API_KEY —
// used when a chat wants an UNCONTAMINATED Claude to process some material
// (the responding model sees only what's in this request body, none of the
// calling chat's history). Accepts { system?, prompt, model?, maxTokens?,
// pdfBase64? }. Returns { text, model }.
app.post('/api/claude', express.json({ limit: '40mb' }), async (req, res) => {
  try {
    const { system, prompt, model, maxTokens, pdfBase64 } = req.body || {};
    if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: 'prompt is required' });
    const userContent = [];
    if (pdfBase64) {
      userContent.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: String(pdfBase64) },
      });
    }
    userContent.push({ type: 'text', text: String(prompt) });
    const data = await anthropicChat({
      system: system ? String(system) : undefined,
      messages: [{ role: 'user', content: userContent }],
      model: model || 'claude-opus-4-8',
      max_tokens: Math.min(16000, Math.max(256, parseInt(maxTokens, 10) || 8000)),
    });
    if (data.error) return res.status(502).json({ error: data.error.message || 'anthropic error' });
    res.json({ text: anthropicText(data), model: data.model || model || 'claude-opus-4-8' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Generate subjects for a deck ───────────────────────────────────
app.post('/api/generate/subjects', async (req, res) => {
  try {
    const { theme, count = 60, backType = 'facts' } = req.body;
    if (!theme) return res.status(400).json({ error: 'theme is required' });

    const backInstructions = {
      facts: 'a 1-2 sentence interesting fact for the card back',
      recipes: 'a short recipe or preparation method for the card back (2-3 sentences max)',
      descriptions: 'a 1-2 sentence vivid description for the card back',
      quotes: 'a relevant famous quote for the card back',
    };
    const backDesc = backInstructions[backType] || backInstructions.facts;

    const data = await openaiChat({
        model: 'gpt-4o-mini',
        temperature: 0.9,
        messages: [
          {
            role: 'system',
            content: `You generate subjects for illustrated card decks. Return valid JSON only, no markdown fences. The JSON should be an array of objects with "subject" (short title for the card front) and "back" (${backDesc}). Make every entry unique and varied. Never repeat.`,
          },
          {
            role: 'user',
            content: `Generate ${count} unique subjects for a "${theme}" card deck. Return JSON array.`,
          },
        ],
    });

    if (data.error) return res.status(400).json({ error: data.error.message });

    const text = data.choices[0].message.content.trim();
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const subjects = JSON.parse(cleaned);
    res.json({ subjects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Extract visual moments from a description (v3) ─────────────────
app.post('/api/generate/moments', async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: 'description is required' });

    const data = await openaiChat({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: `You help illustrate a dating memoir written by a young woman. Given a date description, extract small, specific, visual moments that would make good simple watercolor-style drawings.

THE AUTHOR/NARRATOR: A petite young woman with curly brown hair. Whenever she appears in a scene, describe her this way. NEVER write "the narrator", "the author", or "the woman" — always use a physical description like "a petite girl with curly brown hair".

CRITICAL RULES:
- ONLY extract moments that are explicitly described in the text. Never invent or assume details.
- Each moment should be a concrete detail — an object, a scene, a gesture — not an abstract feeling.
- If the text only contains 2-3 clear visual moments, return only 2-3. Do NOT pad to 6 with invented scenes.
- Return UP TO 6 moments, but fewer is fine if the text is short.
- ALWAYS describe people by their physical appearance as mentioned in the text (tall, skinny, pale, bearded, etc). If the text describes what someone looks like, USE that description in the prompt. Never just say "a man" or "a person" — pull details from the text.
- Focus on specific objects, gestures, and compositions rather than full complex scenes. The best prompts are simple: one or two subjects, a clear action or arrangement.
- Avoid prompts that require precise spatial relationships between many elements — these confuse image generators.

For each moment, provide:
- "moment": a short 3-5 word label
- "prompt": a detailed image generation prompt for a soft watercolor illustration, under 50 words. Always start with "Soft watercolor illustration of" and end with "minimal background, gentle muted palette"

Return valid JSON only, no markdown fences. The JSON should be an array of objects with "moment" and "prompt" fields.`,
          },
          {
            role: 'user',
            content: description,
          },
        ],
    });

    if (data.error) return res.status(400).json({ error: data.error.message });

    const text = data.choices[0].message.content.trim();
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const moments = JSON.parse(cleaned);
    res.json({ moments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Little Book of Miracles: turn a moment (or theme) into book entries ──
app.post('/api/generate/miracles', async (req, res) => {
  try {
    const { seed, mode = 'capture', count = 3 } = req.body;
    if (!seed || !seed.trim()) return res.status(400).json({ error: 'seed is required' });

    const captureSystem = `You help keep "A Little Book of Miracles" — a gentle collection of everyday miracles and synchronicities: small coincidences and quiet wonders that feel quietly meaningful (thinking of someone right before they call, a song that answers a question, the way light falls at the exact right moment). Given something the keeper of the book jotted down, turn it into ONE short book entry.

RULES:
- Stay true to what they actually wrote. Never invent events that didn't happen. You may gently polish the language and draw out the wonder, but keep it honest and grounded in their words.
- Voice: warm, intimate, unhurried, a little luminous — never saccharine, preachy, or religious unless their note is.
- "title": a short evocative title, 2 to 5 words.
- "text": 2 to 4 sentences reflecting on the moment for the page.
- "prompt": a soft watercolor illustration prompt under 50 words capturing ONE concrete, simple visual from the moment — one or two subjects, a clear arrangement. Always start with "Soft watercolor illustration of" and end with "minimal background, gentle muted palette". Describe people by their physical appearance if the note mentions it; never put words or text in the image.

Return valid JSON only, no markdown fences: an object with "title", "text", and "prompt".`;

    const imagineSystem = `You help write "A Little Book of Miracles" — a gentle collection of everyday miracles and synchronicities: small coincidences and quiet wonders that feel quietly meaningful (thinking of someone right before they call, a song that answers a question, the way light falls at the exact right moment). Given a theme, imagine ${count} small, specific, believable everyday-miracle moments around it.

RULES:
- Each moment should feel like a real small wonder, not a grand event. Specific and concrete, not abstract.
- Make every entry unique and varied. Never repeat.
- Voice: warm, intimate, unhurried, a little luminous — never saccharine or preachy.
- For each entry provide "title" (2 to 5 words), "text" (2 to 4 sentences for the page), and "prompt" (a soft watercolor illustration prompt under 50 words capturing one concrete, simple visual — start with "Soft watercolor illustration of" and end with "minimal background, gentle muted palette"; never put words or text in the image).

Return valid JSON only, no markdown fences: an array of objects with "title", "text", and "prompt".`;

    const data = await openaiChat({
        model: 'gpt-4o-mini',
        temperature: mode === 'imagine' ? 0.95 : 0.7,
        messages: [
          { role: 'system', content: mode === 'imagine' ? imagineSystem : captureSystem },
          {
            role: 'user',
            content: mode === 'imagine'
              ? `Theme: ${seed}. Imagine ${count} everyday-miracle entries. Return a JSON array.`
              : seed,
          },
        ],
    });

    if (data.error) return res.status(400).json({ error: data.error.message });

    const text = data.choices[0].message.content.trim();
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// Secretly a Witch — public witchy app (/witch)
// A small set of stateless AI endpoints powering the public app: tarot
// readings, spells/rituals, familiar names, and daily horoscopes. All reuse
// openaiChat (gpt-4o-mini). The tarot DECK itself lives client-side; the
// client sends the drawn cards and the server writes the interpretation.
// ═══════════════════════════════════════════════════════════════════

// Strip markdown fences and parse JSON from a chat completion.
function parseJsonReply(data) {
  const text = (data.choices?.[0]?.message?.content || '').trim();
  const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(cleaned);
}

// ─── Tarot reading ──────────────────────────────────────────────────
// Body: { question?, spread ("single"|"three"|"yesno"), cards:[{name, orientation, position?}] }
app.post('/api/witch/tarot', async (req, res) => {
  try {
    const { question = '', spread = 'single', cards = [] } = req.body || {};
    if (!Array.isArray(cards) || !cards.length) return res.status(400).json({ error: 'cards is required' });

    const cardList = cards.map((c, i) =>
      `${c.position ? c.position + ': ' : `Card ${i + 1}: `}${c.name} (${c.orientation || 'upright'})`
    ).join('\n');

    const system = `You are a warm, insightful tarot reader for an app called "Secretly a Witch". You give grounded, encouraging, non-fatalistic readings — tarot as a mirror for reflection, never doom or medical/financial/legal certainty. Speak directly to the querent as "you". Keep it intimate and a little luminous, never generic or preachy.

Return valid JSON only, no markdown fences, shaped:
{
  "cards": [{ "name": "...", "meaning": "1-2 sentences on what this card in this position/orientation says" }],
  "reading": "2-3 short paragraphs weaving the cards together into one message",
  "advice": "one short, actionable, gentle suggestion"
}`;

    const userMsg = `Spread: ${spread}${question ? `\nTheir question: ${question}` : '\n(No specific question — a general reading.)'}\nCards drawn:\n${cardList}`;

    const data = await openaiChat({
      model: 'gpt-4o-mini',
      temperature: 0.85,
      messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }],
    });
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json(parseJsonReply(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Dream reading (TWO frontier models side by side) ───────────────
// Body: { dream }
// Runs Anthropic's highest (Claude Opus 4.8) AND OpenAI's highest
// (gpt-5.6-sol) IN PARALLEL and returns BOTH interpretations so the reader
// can compare. Grounded, warm, non-fatalistic dream-work voice — symbolism
// as a mirror for the subconscious, never prediction or diagnosis.
const DREAM_READ_SHAPE = `{
  "title": "a short, evocative title for this dream (3-6 words)",
  "symbols": [ { "symbol": "the image/motif", "meaning": "one plain sentence on what it may reflect" } ],
  "message": "1-2 short paragraphs, speaking directly to the dreamer as \\"you\\": what the subconscious may be working through, woven from the symbols. Grounded and human, never a prediction."
}`;
const DREAM_READ_VOICE = `You are a warm, perceptive dream interpreter for an app called "Secretly a Witch". You read a dream as a mirror for the subconscious — the feelings, tensions, and wishes it may be surfacing — never as prophecy, diagnosis, or fixed meaning. Speak directly to the dreamer as "you", plainly and kindly. 3-5 symbols. No woo lecturing, no "the universe", no medical/psychiatric claims, no telling them what they must do. Keep it tight — this is a quick read, not an essay. Never tell them they are "powerful", "chosen", "special", or otherwise flatter them in generic empowerment-poster language — stay specific to what THIS dream actually shows, not a generic affirmation that could apply to any dream. Return VALID JSON only (no markdown fences), shaped exactly:
${DREAM_READ_SHAPE}`;

// Single-reader dream interpretation (Claude only — was a two-model
// Claude+GPT dual read, cut back per Sophie: it made the reading twice as
// long and cost twice as much for no real benefit).
async function runDreamRead(dreamRaw) {
  const dream = String(dreamRaw || '').trim();
  if (!dream) throw new Error('dream is required');
  if (dream.length > 20000) throw new Error('dream is too long');
  const userMsg = `Here is the dream, in the dreamer's own words:\n\n"""${dream}"""\n\nInterpret it.`;

  // Claude Opus 4.8 — rejects `temperature`; the system prompt pins the JSON.
  const data = await anthropicChat({ system: DREAM_READ_VOICE, messages: [{ role: 'user', content: userMsg }], max_tokens: 900 });
  if (data.error) throw new Error(data.error.message || 'anthropic error');
  const claude = parseAnthropicJson(data);
  if (!claude) throw new Error('reader failed');
  // gpt/errors kept in the shape so older saved (dual-reader) client entries
  // and the client's render code — which still checks data.gpt — degrade
  // gracefully; new reads simply never populate it.
  return { claude, gpt: null, errors: { claude: null, gpt: null } };
}

app.post('/api/witch/dream-read', async (req, res) => {
  try {
    res.json(await runDreamRead((req.body || {}).dream));
  } catch (err) {
    if (err.message === 'both readers failed') return res.status(502).json({ error: err.message, detail: err.detail });
    res.status(500).json({ error: err.message });
  }
});

// ─── Dream illustration (diary-comic, background job) ───────────────
// Public wrapper over the movies.js dreams engine: break the dream into
// beats, then render the FIRST hand-lettered 2x2 comic page (free) in
// Sophie's diary-comic style (refs/movie-style.jpg). Fire-and-forget job +
// poll (GET /:id) so a ~1-2 min render survives cold starts / phone lock —
// the same resilient pattern the iOS dreams pipeline uses.
// movies.js is require()d lazily (at request time) so it captures the keys
// config-loader hydrated at boot, not stale ones from an early require.
app.post('/api/witch/dream-illustrate', async (req, res) => {
  try {
    const dream = String((req.body || {}).dream || '').trim();
    if (!dream) return res.status(400).json({ error: 'dream is required' });
    if (dream.length > 20000) return res.status(400).json({ error: 'dream is too long' });
    if (!admin.apps.length) return res.status(503).json({ error: 'image storage not configured' });
    const db = admin.firestore();
    const ref = db.collection('forge-witch-dream-illus').doc();
    await ref.set({
      status: 'running', label: 'reading your dream', dream,
      page1: null, totalPages: 0, title: null, error: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ id: ref.id });
    // Fire-and-forget: breakdown → render page one. Not awaited by the request.
    (async () => {
      try {
        const movies = require('./movies');
        const { dreams } = await movies.dreamBreakdown(dream);
        const dr = dreams[0];
        const beats = Array.isArray(dr.beats) ? dr.beats : [];
        const totalPages = Math.max(1, Math.ceil(beats.length / 4));
        await ref.update({ label: 'illustrating page one', totalPages, title: dr.title || null });
        const first = { ...dr, beats: beats.slice(0, 4) };   // page one = first 4 beats
        await movies.makeDreamPages(first, 'medium', async () => {});
        const page1 = first.pages && first.pages[0] && first.pages[0].url;
        if (!page1) throw new Error('no page rendered');
        await ref.update({ status: 'done', label: 'done', page1 });
      } catch (err) {
        console.warn('witch dream-illustrate failed —', err.message);
        await ref.update({ status: 'error', error: String(err.message || err) }).catch(() => {});
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// A render normally finishes in under a minute (breakdown + one page of
// image gen). The fire-and-forget job is an in-memory async closure, not a
// durable queue — if the server process recycles mid-render (a deploy, a
// crash, Render's free-tier idle cycling), the doc is orphaned at
// status:'running' forever and the client polls it endlessly across app
// resumes (each resume restarts its own local give-up timer). Past this
// generous margin, treat 'running' as dead and surface a real error instead.
const DREAM_ILLUS_STALE_MS = 4 * 60 * 1000;
app.get('/api/witch/dream-illustrate/:id', async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'image storage not configured' });
    const ref = admin.firestore().collection('forge-witch-dream-illus').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'not found' });
    let d = snap.data();
    if (d.status === 'running' && d.createdAt && Date.now() - d.createdAt.toMillis() > DREAM_ILLUS_STALE_MS) {
      const error = "This is taking much longer than usual — the server may have restarted mid-render. Tap Illustrate to try again.";
      await ref.update({ status: 'error', error }).catch(() => {});
      d = { ...d, status: 'error', error };
    }
    res.json({ status: d.status, label: d.label, page1: d.page1 || null, totalPages: d.totalPages || 0, title: d.title || null, error: d.error || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Generic background job runner (survives leaving the app) ───────
// Any slow generation runs fire-and-forget: POST returns an id immediately,
// the work is persisted to Firestore, the client resumes by polling GET /:id.
// See CLAUDE.md "Everything slow is a background job — never watch a spinner".
const WITCH_JOBS = 'forge-witch-jobs';
async function runWitchJob(ref, kind, p) {
  try {
    let result;
    if (kind === 'coincidence') {
      // Art-director distill (finds the one visual idea) → flat pastel
      // editorial spot illustration. Validated live against ~15 test moments
      // (long/rambling, intentionally confusing, purely abstract feelings) —
      // reliably reduces to ONE concrete, isolated image every time.
      const desc = String(p.desc || p.prompt || '').trim();
      const DISTILL_SYS = `You are an art director for an illustrated journal.

Read the user's memory and reduce it to a single simple visual that captures its emotional essence.

Rules:
* Return only one visual idea.
* Choose the simplest image that still communicates the memory.
* Prefer symbolic or cropped compositions over full scenes.
* Focus on one subject whenever possible.
* Eliminate unnecessary people, backgrounds, and objects.
* If an emotion can be shown through an object instead of a person, prefer the object.
* The illustration should be immediately understandable at a small size.
* Preserve the feeling, not the literal sequence of events.
* Do not describe artistic style, colors, lighting, or rendering.
* Output 1-3 concise sentences describing only what should appear in the illustration.`;
      let visualBrief = desc;
      try {
        const chat = await openaiChat({ model: 'gpt-4o-mini', temperature: 0.8, messages: [{ role: 'system', content: DISTILL_SYS }, { role: 'user', content: `Memory:\n${desc.slice(0, 1200)}` }] });
        const t = !chat.error && chat.choices?.[0]?.message?.content?.trim();
        if (t) visualBrief = t;
      } catch {}
      const imgPrompt = `Create a simple editorial spot illustration based on this visual brief:

${visualBrief}

Style:
* clean white background
* bold black outlines
* flat, muted pastel colors (such as lilac, mint green, and light pink)
* very little shading
* simplified shapes
* one clear focal point
* playful but not childish
* hand-drawn, slightly imperfect linework
* no detailed scenery
* no decorative border
* no text

Keep the composition isolated and instantly readable at a small size. Use only the objects or body parts necessary to communicate the idea.`;
      const data = await openaiImage({ model: 'gpt-image-2', prompt: imgPrompt, n: 1, size: p.size || '1024x1024', quality: p.quality || 'low', output_format: 'webp' });
      if (data.error) throw new Error(data.error.message || 'image error');
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error('no image returned');
      result = { url: await saveBufferToFirebase(Buffer.from(b64, 'base64'), 'image/webp', 'openai') };
    } else if (kind === 'dream-read') {
      result = await runDreamRead(p.dream);
    } else {
      throw new Error('unknown job kind: ' + kind);
    }
    await ref.update({ status: 'done', result });
  } catch (err) {
    await ref.update({ status: 'error', error: String(err.message || err) }).catch(() => {});
  }
}
app.post('/api/witch/job', async (req, res) => {
  try {
    const body = req.body || {};
    const kind = String(body.kind || '');
    if (!['coincidence', 'dream-read'].includes(kind)) return res.status(400).json({ error: 'bad kind' });
    if (!admin.apps.length) return res.status(503).json({ error: 'jobs not configured' });
    const ref = admin.firestore().collection(WITCH_JOBS).doc();
    await ref.set({ kind, status: 'running', result: null, error: null, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ id: ref.id });
    runWitchJob(ref, kind, body); // fire-and-forget, not awaited
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// A 'running' job doc far older than any real job means the server restarted
// mid-job (the fire-and-forget closure died with the process) — without this,
// the doc stays 'running' forever and clients poll it endlessly. Real jobs
// finish in well under a minute (dream-read ~10-30s, coincidence ~30-90s).
const WITCH_JOB_STALE_MS = 4 * 60 * 1000;
app.get('/api/witch/job/:id', async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(503).json({ error: 'jobs not configured' });
    const snap = await admin.firestore().collection(WITCH_JOBS).doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'not found' });
    const d = snap.data();
    if (d.status === 'running' && d.createdAt && typeof d.createdAt.toMillis === 'function'
        && Date.now() - d.createdAt.toMillis() > WITCH_JOB_STALE_MS) {
      const error = 'This took much longer than usual — the server may have restarted mid-job. Please try again.';
      await snap.ref.update({ status: 'error', error }).catch(() => {});
      return res.json({ status: 'error', result: null, error });
    }
    res.json({ status: d.status, result: d.result || null, error: d.error || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Spell / ritual generator ───────────────────────────────────────
// Body: { intent, kind ("spell"|"ritual"|"blessing"|"protection") }
app.post('/api/witch/spell', async (req, res) => {
  try {
    const { intent, kind = 'spell' } = req.body || {};
    if (!intent || !intent.trim()) return res.status(400).json({ error: 'intent is required' });

    const system = `You are a cozy, folk-magic witch writing gentle ${kind}s for an app called "Secretly a Witch". Your magic is symbolic, safe, and beginner-friendly: everyday household/kitchen/garden items, candles, herbs, intentions, journaling — never anything dangerous, never real medical/legal/financial claims, never harm to others. The tone is warm, a little whimsical, empowering.

Return valid JSON only, no markdown fences, shaped:
{
  "title": "a short evocative name for the ${kind}",
  "best_time": "e.g. 'a waxing moon evening' or 'sunrise'",
  "ingredients": ["4-6 simple, accessible items"],
  "steps": ["4-6 clear, calm steps"],
  "incantation": "2-4 lines to say aloud (gentle, rhythmic)",
  "note": "one grounding sentence — the real magic is intention/attention"
}`;

    const data = await openaiChat({
      model: 'gpt-4o-mini',
      temperature: 0.9,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Intent: ${intent}. Write one ${kind}.` },
      ],
    });
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json(parseJsonReply(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Name your familiar ─────────────────────────────────────────────
// Body: { animal?, vibe? }
app.post('/api/witch/familiar', async (req, res) => {
  try {
    const { animal = '', vibe = '' } = req.body || {};
    const system = `You name magical familiars for an app called "Secretly a Witch". Given an animal and/or a vibe, invent 4 evocative familiar names with tiny personalities. Names should feel witchy, folkloric, a little unexpected — not clichéd (avoid "Salem", "Luna", "Shadow" unless it truly fits).

Return valid JSON only, no markdown fences, shaped:
{ "familiars": [ { "name": "...", "species": "...", "trait": "2-4 word personality", "blurb": "one charming sentence about them" } ] }`;

    const userMsg = `Animal: ${animal || 'any — you choose'}. Vibe: ${vibe || 'any — you choose'}.`;

    const data = await openaiChat({
      model: 'gpt-4o-mini',
      temperature: 1,
      messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }],
    });
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json(parseJsonReply(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Daily witchy horoscope ─────────────────────────────────────────
// Body: { sign, date? }  — date is a display string for flavor/variety.
app.post('/api/witch/horoscope', async (req, res) => {
  try {
    const { sign, date = '' } = req.body || {};
    if (!sign) return res.status(400).json({ error: 'sign is required' });

    const system = `You write short daily horoscopes with a cozy-witch twist for an app called "Secretly a Witch". Warm, specific, encouraging — astrology as gentle reflection, never fatalistic or medical/financial certainty.

Return valid JSON only, no markdown fences, shaped:
{
  "horoscope": "2-3 sentences for the day",
  "focus": "one word or short phrase — the day's theme",
  "charm": "a tiny suggested small act of magic for the day (one sentence)",
  "element_note": "one sentence tying it to the sign's element"
}`;

    const data = await openaiChat({
      model: 'gpt-4o-mini',
      temperature: 0.9,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Sign: ${sign}.${date ? ` Date: ${date}.` : ''} Write today's reading.` },
      ],
    });
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json(parseJsonReply(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── End-of-lesson notes: ask a question (AI) / leave a comment (to Sophie) ──
// Public, so lightly rate-limited per IP. Questions go to Claude Haiku with
// the lesson's own card text as context; comments land in Firestore
// `witch-mail` AND on the forge-chat-feed (chat "witch-mail") so Sophie sees
// them in her Chats app.
const _lessonNoteHits = new Map();
function lessonNoteAllowed(ip) {
  const now = Date.now(), windowMs = 10 * 60 * 1000;
  const hits = (_lessonNoteHits.get(ip) || []).filter((t) => now - t < windowMs);
  if (hits.length >= 6) return false;
  hits.push(now); _lessonNoteHits.set(ip, hits);
  if (_lessonNoteHits.size > 5000) _lessonNoteHits.clear(); // crude memory cap
  return true;
}
app.post('/api/witch/lesson-question', async (req, res) => {
  try {
    const { lesson = '', lessonTitle = '', question = '', cards = '' } = req.body || {};
    const q = String(question).trim().slice(0, 600);
    if (!q) return res.status(400).json({ error: 'question is required' });
    if (!lessonNoteAllowed(req.ip)) return res.status(429).json({ error: 'Give it a moment — a few questions at a time.' });
    const system = `You are the gentle teacher behind the Witch School lessons in the app "Secretly a Witch". A reader just finished a lesson and asked a question. Answer warmly and plainly in 2-5 sentences — grounded, honest, a little literary, matching the lesson's voice. Practices are framed as tradition, folklore, and reflection, never as guaranteed supernatural fact, and never medical/legal/financial advice. If the question is unrelated to the craft or inappropriate, gently steer back to the lesson. Plain text only, no markdown.`;
    const context = `Lesson: ${String(lessonTitle || lesson).slice(0, 80)}\n${cards ? `Lesson text (for reference):\n${String(cards).slice(0, 6000)}\n` : ''}Reader's question: ${q}`;
    const data = await anthropicChat({
      system,
      messages: [{ role: 'user', content: context }],
      max_tokens: 400,
      model: 'claude-haiku-4-5',
    });
    if (data.error) return res.status(400).json({ error: data.error.message });
    const answer = anthropicText(data);
    if (!answer) return res.status(500).json({ error: 'no answer' });
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/witch/lesson-note', async (req, res) => {
  try {
    const { lesson = '', lessonTitle = '', text = '', email = '' } = req.body || {};
    const note = String(text).trim().slice(0, 1000);
    if (!note) return res.status(400).json({ error: 'text is required' });
    if (!lessonNoteAllowed(req.ip)) return res.status(429).json({ error: 'Give it a moment.' });
    if (!admin.apps.length) return res.status(503).json({ error: 'not configured' });
    const created = new Date().toISOString();
    // Reply-to address (optional — only asked of logged-out readers).
    const replyTo = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email).trim()) ? String(email).trim().slice(0, 120) : '';
    const doc = { lesson: String(lesson).slice(0, 40), lessonTitle: String(lessonTitle).slice(0, 80), text: note, email: replyTo || null, created };
    await admin.firestore().collection('witch-mail').add(doc);
    // Surface it in Sophie's Chats app under a "witch-mail" tile.
    try {
      const feedText = replyTo ? `${note}\n\n— reply to: ${replyTo}` : note;
      await admin.firestore().collection('forge-chat-feed').add({
        chat: 'witch-mail',
        title: `A reader on “${doc.lessonTitle || doc.lesson || 'a lesson'}”`,
        text: feedText,
        tldr: note.slice(0, 140),
        from: 'claude',
        created,
      });
      await admin.firestore().collection('forge-chat-registry').doc('witch-mail').set({ lastSeen: created }, { merge: true });
    } catch {}
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Your Sky, Read — pick 3 of their real placements to teach the 3 layers ──
// The tap-through lesson uses only a FEW of the reader's placements as worked
// examples: one to teach what a SIGN is, one a HOUSE, one a PLANET. This picks
// the clearest examples from their chart and writes the plain teaching copy.
// The client caches the result per birth so retaking costs nothing.
app.post('/api/witch/sky-lesson', async (req, res) => {
  try {
    const { placements = '', big3 = '', hasTime = false } = req.body || {};
    if (!String(placements).trim()) return res.status(400).json({ error: 'placements required' });
    const system = `You are a warm astrology teacher for the app "Secretly a Witch". You are given someone's REAL, already-computed birth placements. Do NOT recompute or invent — use only what's given.

Pick exactly THREE of their placements to use as worked teaching examples, one for each concept, in this order:
1. concept "sign" — a placement whose SIGN flavor teaches what a zodiac sign is (a "how").
2. concept "planet" — a placement whose PLANET teaches what a planet is (a "what/who").
3. concept "house" — a placement whose HOUSE teaches what a house is (a "where", a life-area).
${hasTime ? '' : 'NOTE: no birth time was given, so there are NO houses. For the "house" concept, instead teach the idea of houses generally and gently say a birth time would place their planets in one — still pick a real planet+sign for the example, house null.'}

Warm, plain, second person, 2-3 sentences each, teaching the CONCEPT through their specific placement. Never fatalistic, never medical/financial. Return VALID JSON only, no fences:
{ "cards": [ { "concept": "sign", "planet": "Venus", "sign": "Libra", "house": 7, "title": "3-5 word title", "body": "2-3 sentences teaching what a sign is, using their Venus in Libra" }, … three total, in the order sign, planet, house ] }`;
    const user = `Their placements:\n${String(placements).slice(0, 1500)}\n${big3 ? `Big three: ${String(big3).slice(0, 200)}` : ''}`;
    const data = await openaiChat({ model: 'gpt-4o-mini', temperature: 0.7, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] });
    if (data.error) return res.status(400).json({ error: data.error.message });
    const out = parseJsonReply(data);
    if (!out || !Array.isArray(out.cards)) return res.status(500).json({ error: 'bad lesson' });
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Firebase web config for the public app (Secretly a Witch accounts) ──
// Returns the PUBLIC Firebase web config (safe to expose) so the client can
// use Firebase Auth + Firestore. Reads from env; returns { configured:false }
// until the web-app keys are set, so the app runs fine with accounts dormant.
// Same Firebase project powers a future native iOS app (shared users/data).
app.get('/api/witch/firebase-config', (req, res) => {
  // These are the PUBLIC Firebase web config values for project membry-df528
  // (the same project the games app uses). A web apiKey is designed to be
  // exposed in the browser — real security is Firebase Auth authorized domains
  // + Firestore rules, not secrecy of this key. Env vars override if ever needed.
  const apiKey = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyCA04ReaTAoNDUgUCuBS-ti0Jkfl-16h_s';
  const appId = process.env.FIREBASE_WEB_APP_ID || '1:513384339473:web:8f46c5915a949c93a8b9b0';
  const projectId = process.env.FIREBASE_PROJECT_ID || 'membry-df528';
  if (!apiKey || !appId) return res.json({ configured: false });
  res.json({
    configured: true,
    apiKey, appId, projectId,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'membry-df528.firebasestorage.app',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '513384339473',
  });
});

// ─── Natal chart + reading ──────────────────────────────────────────
// Real astronomy → real chart (astro.js) → AI interpretation. Body:
// { date:"YYYY-MM-DD", time:"HH:MM" (optional), place:"City, Country" }.
// Without a time, planet signs still compute but rising/houses are omitted.
function tzOffsetHours(zone, dateUTC) {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = dtf.formatToParts(dateUTC).reduce((a, x) => (a[x.type] = x.value, a), {});
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return (asUTC - dateUTC.getTime()) / 3600000;
}
app.post('/api/witch/natal', async (req, res) => {
  try {
    if (!astro || !tzlookup) return res.status(503).json({ error: 'The astrology engine is still warming up on the server — try again shortly.' });
    const { date, time, place } = req.body || {};
    if (!date || !place) return res.status(400).json({ error: 'date and place are required' });
    const [y, m, d] = String(date).split('-').map(Number);
    if (!y || !m || !d) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });

    // Geocode the birthplace (OpenStreetMap Nominatim — free, no key needed).
    const geoRes = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(place), { headers: { 'User-Agent': 'SecretlyAWitch/1.0 (natal chart feature)' } });
    const geo = await geoRes.json();
    if (!Array.isArray(geo) || !geo.length) return res.status(400).json({ error: `Couldn't find "${place}" — try "City, Country".` });
    const lat = +geo[0].lat, lon = +geo[0].lon, placeName = geo[0].display_name;

    // Timezone + historical (DST-aware) UTC offset for the birth moment.
    const zone = tzlookup(lat, lon);
    const hasTime = Boolean(time && /^\d{1,2}:\d{2}$/.test(time));
    const [hh, mm] = hasTime ? time.split(':').map(Number) : [12, 0];
    const localAsUTC = Date.UTC(y, m - 1, d, hh, mm);
    const off = tzOffsetHours(zone, new Date(localAsUTC));
    const ut = new Date(localAsUTC - off * 3600000);
    const utHours = ut.getUTCHours() + ut.getUTCMinutes() / 60 + ut.getUTCSeconds() / 3600;

    const chart = astro.computeChart({ y: ut.getUTCFullYear(), m: ut.getUTCMonth() + 1, d: ut.getUTCDate(), utHours, lat, lon, withAngles: hasTime });

    // Interpret the computed placements (never recompute in the model).
    const placements = chart.bodies.map(b => `${b.name} in ${b.sign} ${Math.round(b.degInSign)}°${b.house ? ` (house ${b.house})` : ''}${b.retro ? ' retrograde' : ''}`).join('\n');
    const angles = hasTime
      ? `Ascendant/Rising: ${chart.ascendant.sign} ${Math.round(chart.ascendant.degInSign)}°\nMidheaven: ${chart.midheaven.sign} ${Math.round(chart.midheaven.degInSign)}°\n`
      : '(No birth time provided — rising sign and houses omitted; note this gently.)\n';
    const aspects = chart.aspects.slice(0, 8).map(a => `${a.a} ${a.aspect} ${a.b}`).join(', ') || 'none notable';

    const system = `You are a warm, insightful astrologer for the app "Secretly a Witch". You are handed a REAL, accurately computed natal chart — interpret it, never recompute or contradict the given positions. Grounded, specific, encouraging; astrology as a reflective mirror, never fatalistic and never medical/financial/legal certainty. Speak directly to them as "you"; cozy, a little luminous, never generic.

Return valid JSON only, no markdown fences:
{
  "headline": "one evocative sentence for the whole chart",
  "big_three": "2-3 sentences weaving Sun + Moon + Rising",
  "sections": [ { "title": "short title", "text": "2-3 sentences" } ],
  "closing": "one warm, grounding sentence"
}
Give 3 to 5 sections on the most striking placements, houses, and aspects.`;
    const user = `Natal chart (already computed — interpret only):\n${angles}${placements}\nTightest aspects: ${aspects}.`;

    const data = await openaiChat({ model: 'gpt-4o-mini', temperature: 0.85, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] });
    if (data.error) return res.status(400).json({ error: data.error.message });

    res.json({ chart, reading: parseJsonReply(data), place: placeName, coords: { lat, lon }, tz: zone, hasTime });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Daily reading (ONE Claude Opus 4.8 call, cached per user per day) ──
// The Home screen of "Secretly a Witch". A single Opus call writes the whole
// day at once: a Co-Star-style personalized astrology reading (from the user's
// real natal chart + today's transits), the interpretation of their daily
// 3-card past/present/future tarot pull, and a one-line intention. Cached in
// Firestore (forge-witch-daily/{uid}_{date}) so it costs ~1 call/user/day; the
// client sends the deterministic-for-today cards so the reading matches them.
//
// Body: {
//   uid?, date:"YYYY-MM-DD" (client's LOCAL day), moonPhase?,
//   cards:[{name, orientation, position:"Past"|"Present"|"Future"}],
//   birth?: { date:"YYYY-MM-DD", time?:"HH:MM", place?, lat?, lon?, tz? },
//   force?  // regenerate even if cached
// }
const TRANSIT_ASPECTS = [
  { name: 'conjunction', angle: 0, orb: 4 },
  { name: 'sextile', angle: 60, orb: 3 },
  { name: 'square', angle: 90, orb: 4 },
  { name: 'trine', angle: 120, orb: 4 },
  { name: 'opposition', angle: 180, orb: 4 },
];
function transitAspects(transit, natal) {
  const out = [];
  for (const t of transit) {
    for (const n of natal) {
      let diff = Math.abs(t.lon - n.lon) % 360;
      if (diff > 180) diff = 360 - diff;
      for (const a of TRANSIT_ASPECTS) {
        if (Math.abs(diff - a.angle) <= a.orb) { out.push({ t: t.name, aspect: a.name, n: n.name, orb: +Math.abs(diff - a.angle).toFixed(1) }); break; }
      }
    }
  }
  return out.sort((x, y) => x.orb - y.orb);
}
app.post('/api/witch/daily', async (req, res) => {
  try {
    const { uid, date, cards = [], moonPhase = '', birth = null, force = false, zodiac = 'tropical' } = req.body || {};
    // Which piece of the day to generate. The client requests three separate
    // parts so each lands as fast as possible: 'astro' (the short teaser +
    // omens shown right after "Reveal today's reading"), 'deep' (the long
    // Dive-deeper page, requested in PARALLEL with the teaser so it's ready
    // by the time the button is tapped), and 'tarot' (fired on the first
    // card tap). No part = the legacy combined reading (stale cached clients).
    const part = ['astro', 'deep', 'tarot'].includes(req.body && req.body.part) ? req.body.part : null;
    // 13-sign ASTRONOMICAL zodiac (real, unequal constellation boundaries the Sun
    // actually crosses, Ophiuchus included) — boundaries in tropical ecliptic
    // longitude. When zodiac==='astronomical' the reading is built from these
    // constellations instead of the tropical signs. See docs/witch-daily-reading-prompt.md.
    const astronomical = zodiac === 'astronomical';
    const ASTRO_SEG = [['Aries',28,52],['Taurus',52,90],['Gemini',90,118],['Cancer',118,137],['Leo',137,173],['Virgo',173,217],['Libra',217,241],['Scorpio',241,247],['Ophiuchus',247,265],['Sagittarius',265,300],['Capricorn',300,327],['Aquarius',327,350],['Pisces',350,388]];
    const con13 = (lon) => { let L = ((lon % 360) + 360) % 360; for (const [n,a,b] of ASTRO_SEG) { if (b > 360) { if (L >= a || L < b - 360) return n; } else if (L >= a && L < b) return n; } return null; };
    const signOf = (body) => (astronomical && body && isFinite(body.lon)) ? (con13(body.lon) || body.sign) : (body && body.sign);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' });
    if ((!part || part === 'tarot') && (!Array.isArray(cards) || cards.length !== 3)) return res.status(400).json({ error: 'cards must be the 3-card daily pull' });

    const db = admin.apps.length ? admin.firestore() : null;

    // Resolve the natal chart if birth details are available (personalizes the
    // astrology). lat/lon/tz can be passed by the client (cached from /natal) to
    // skip geocoding; otherwise geocode once here.
    let natal = null, bigThree = null, transitList = null, tAspects = null, birthErr = null;
    if (part !== 'tarot' && birth && birth.date && /^\d{4}-\d{2}-\d{2}$/.test(birth.date) && astro && tzlookup) {
      try {
        const [by, bm, bd] = birth.date.split('-').map(Number);
        let lat = Number(birth.lat), lon = Number(birth.lon), zone = birth.tz;
        if (!isFinite(lat) || !isFinite(lon)) {
          const gq = birth.place || '';
          const geoRes = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(gq), { headers: { 'User-Agent': 'SecretlyAWitch/1.0 (daily reading)' } });
          const geo = await geoRes.json();
          if (Array.isArray(geo) && geo.length) { lat = +geo[0].lat; lon = +geo[0].lon; }
        }
        if (isFinite(lat) && isFinite(lon)) {
          if (!zone) zone = tzlookup(lat, lon);
          const hasTime = Boolean(birth.time && /^\d{1,2}:\d{2}$/.test(birth.time));
          const [hh, mm] = hasTime ? birth.time.split(':').map(Number) : [12, 0];
          const localAsUTC = Date.UTC(by, bm - 1, bd, hh, mm);
          const off = tzOffsetHours(zone, new Date(localAsUTC));
          const ut = new Date(localAsUTC - off * 3600000);
          const utHours = ut.getUTCHours() + ut.getUTCMinutes() / 60;
          natal = astro.computeChart({ y: ut.getUTCFullYear(), m: ut.getUTCMonth() + 1, d: ut.getUTCDate(), utHours, lat, lon, withAngles: hasTime });
          const sun = natal.bodies.find(b => b.name === 'Sun');
          const moon = natal.bodies.find(b => b.name === 'Moon');
          bigThree = { sun: sun && signOf(sun), moon: moon && signOf(moon), rising: natal.ascendant && signOf(natal.ascendant) };
        }
      } catch (e) { birthErr = e.message; }
    }

    // Today's sky (geocentric — location-independent), computed for EVERYONE
    // on the astrology parts: it feeds the transits in both readings and the
    // deep page's day-chart wheel, chart or no chart.
    let todaySky = null;
    if (part !== 'tarot' && astro) {
      try {
        const now = new Date();
        todaySky = astro.computeChart({ y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, d: now.getUTCDate(), utHours: now.getUTCHours() + now.getUTCMinutes() / 60, lat: 0, lon: 0, withAngles: false });
        transitList = todaySky.bodies;
        if (natal) tAspects = transitAspects(todaySky.bodies, natal.bodies).slice(0, 8);
      } catch (e) { /* non-fatal — the reading degrades to no-transit copy */ }
    }
    // The single tightest transit today. The teaser and the deep reading are
    // generated in PARALLEL, so they can't see each other's text — anchoring
    // both on this one transit is what keeps them feeling like one continuous
    // reading (the teaser opens the thread, the deep page pulls it).
    const anchor = (tAspects && tAspects.length) ? tAspects[0] : null;

    // Cache keys include an input hash so a changed birthday / new cards
    // regenerate instead of serving a stale reading. Bump `v` whenever a
    // prompt/shape changes so cached readings regenerate same-day instead of
    // waiting for the next date.
    const crypto = require('crypto');
    const hashOf = (o) => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 12);
    const inputHash = hashOf({
      v: 4, z: zodiac, b: bigThree, cards: cards.map(c => `${c.position}:${c.name}:${c.orientation || 'upright'}`), moonPhase,
    });
    const docRef = (db && uid) ? db.collection('forge-witch-daily').doc(`${uid}_${date}${astronomical ? '_astro' : ''}`) : null;
    // Tarot ignores the zodiac system (cards are cards) — always the plain doc,
    // so switching Tropical/Astronomical never regenerates the card reading.
    const tarotRef = (db && uid) ? db.collection('forge-witch-daily').doc(`${uid}_${date}`) : null;
    const partRef = part === 'tarot' ? tarotRef : docRef;
    const partHash = part && hashOf(part === 'tarot'
      ? { v: 5, part, cards: cards.map(c => `${c.position}:${c.name}:${c.orientation || 'upright'}`) }
      : { v: 5, part, z: zodiac, b: bigThree, moonPhase });
    // The day's chart rides along on every 'deep' response (recomputed fresh —
    // it's pure math, never stored) so the client can draw the wheel.
    const skyPayload = () => todaySky ? { bodies: todaySky.bodies, aspects: (todaySky.aspects || []).slice(0, 14) } : null;
    if (part && partRef && !force) {
      const snap = await partRef.get();
      const saved = snap.exists && snap.data().parts && snap.data().parts[part];
      if (saved && saved.hash === partHash) {
        const out = { ...saved.data, cached: true, date };
        if (part === 'deep') out.sky = skyPayload();
        return res.json(out);
      }
    }
    if (!part && docRef && !force) {
      const snap = await docRef.get();
      if (snap.exists && snap.data().inputHash === inputHash) {
        return res.json({ ...snap.data().reading, cached: true, date });
      }
    }

    // Recently-used ingredients (the previous few days for this person) so the
    // astrologer never repeats them day after day. Read prior docs by id (no
    // composite index needed); best-effort.
    let recentIngredients = [];
    if (db && uid && (!part || part === 'deep')) {
      try {
        const [yy, mm, dd] = date.split('-').map(Number);
        const priorRefs = [];
        for (let k = 1; k <= 5; k++) {
          const d = new Date(Date.UTC(yy, mm - 1, dd - k));
          const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
          priorRefs.push(db.collection('forge-witch-daily').doc(`${uid}_${ds}`));
        }
        const snaps = await db.getAll(...priorRefs);
        snaps.forEach(s => {
          if (!s.exists) return;
          const d = s.data();
          const legacy = d.reading && d.reading.astrology && d.reading.astrology.ingredients;
          const deepPart = d.parts && d.parts.deep && d.parts.deep.data && d.parts.deep.data.deep && d.parts.deep.data.deep.ingredients;
          [legacy, deepPart].forEach(ing => { if (Array.isArray(ing)) recentIngredients.push(...ing); });
        });
        recentIngredients = [...new Set(recentIngredients.map(x => String(x)))].slice(0, 24);
      } catch (e) { /* non-fatal */ }
    }

    // ── Two INDEPENDENT calls (run in parallel) so the tarot and the
    // astrology never influence each other: astrology sees ONLY the chart,
    // tarot sees ONLY the cards. Same JSON shape assembled from both. ──
    const cardLines = cards.map(c => `${c.position || '?'}: ${c.name} (${c.orientation || 'upright'})`).join('\n');
    const transitLine = (transitList || []).map(b => `${b.name} in ${signOf(b)}${b.retro ? ' rx' : ''}`).join(', ');
    let astroContext;
    if (natal && bigThree) {
      const placements = natal.bodies.map(b => `${b.name} in ${signOf(b)}${b.house ? ` (house ${b.house})` : ''}${b.retro ? ' rx' : ''}`).join(', ');
      const asp = (tAspects || []).map(a => `transiting ${a.t} ${a.aspect} natal ${a.n} (orb ${a.orb}°)`).join('; ') || 'none tight today';
      astroContext = `They HAVE a birth chart (interpret it, never recompute):
Big three: Sun ${bigThree.sun}, Moon ${bigThree.moon}${bigThree.rising ? `, Rising ${bigThree.rising}` : ' (no birth time — no rising)'}.
Natal placements: ${placements}.
TODAY's sky (transits): ${transitLine}.
Today's tightest transits to their chart: ${asp}.${anchor ? `
ANCHOR TRANSIT (the one to build on): transiting ${anchor.t} ${anchor.aspect} natal ${anchor.n} (orb ${anchor.orb}°).` : ''}`;
    } else {
      astroContext = `They have NOT entered birth details yet, so you cannot personalize the astrology. Write a warm, general cosmic weather note for today and gently invite them (in the "invite" field, if the shape has one) to add their birthday for a personalized daily reading.${transitLine ? `
TODAY's sky (real computed positions): ${transitLine}.` : ''}`;
    }

    const voice = `warm, plain, and grounded — like a perceptive friend, not a guru or a mystic. Speak directly to them as "you". Never preachy, condescending, bossy, or fatalistic; no woo, no lecturing, no telling them what they "must" or "should" do; no medical/legal/financial certainty.`;

    const astroSystem = `You are the daily astrologer for "Secretly a Witch" — sharp, specific, and a little witchy, like a clever friend who actually reads charts. NEVER condescending, NEVER generic, NEVER soft or reassuring for its own sake. No life-coaching, no "the universe", no "energy", no woo, no astrology-jargon dump, and never tell them what they "should" or "need to" do.${astronomical ? `\nZODIAC: This reading uses the 13-SIGN ASTRONOMICAL zodiac — the REAL constellation boundaries the Sun actually crosses, INCLUDING Ophiuchus, not the usual tropical signs. The sign names you are given already reflect this; interpret them exactly as given (a "Gemini" here means the Gemini constellation), and do NOT convert them back to tropical or second-guess them.` : ''}
You are given their REAL, accurately computed chart and today's REAL transits — interpret them, never recompute. Pick the ONE tightest or most interesting transit today and talk about what it actually feels like in a real life (a text, money, sleep, a conversation, the body, a specific mood), not in the abstract. Do NOT mention tarot.
Return VALID JSON ONLY, no markdown fences, exactly this shape:
{
  "headline": "one short, vivid, almost-aphoristic line for today — a saying, not a description of their placements",
  "reading": "2-4 SHORT, punchy sentences — Co-Star style: clipped, declarative, direct, ~50 words TOTAL max. Say something true, concrete, and specific about today grounded in the actual transit. It can be blunt or lightly commanding (a short imperative is fine). Never soft, generic, preachy, condescending, or reassuring-for-its-own-sake; never a horoscope platitude; no cosmic or mystical language, no 'the universe', no 'energy'.",
  "focus": "1-3 word theme for the day",
  "invite": "",
  "intention": "one short first-person line for today — specific, not generic",
  "ritual": "one tiny, concrete ritual — a single sentence, an actual small physical act",
  "ingredients": ["EXACTLY 3 'ingredients' for the day, 2-4 words each, like a strange little witch's recipe — CONCRETE, surprising, and tied to TODAY specifically (small physical objects, odd gestures, overheard things), e.g. 'a borrowed umbrella', 'salt on the sill', 'the unsent text'"],
  "omens": [ { "sign": "a small, everyday sign to watch for today (a few words)", "meaning": "what it means for them (a few words)" } ]
}
Give EXACTLY 2 omens.
INGREDIENTS — this matters most, get it right:
- NEVER generic wellness / self-care clichés. BANNED outright: deep breath, slow exhale, breathe, glass of water, cup of tea, warm tea, self-care, gratitude, journaling, patience, rest, hydrate, sunlight, fresh air, a walk, "a candle" on its own. If it could show up in ANY generic horoscope, it is WRONG — rewrite it.
- Make each one specific and a little strange so it feels personal to THIS day and this transit.
- Do NOT reuse any of these recently-used ingredients: ${recentIngredients.length ? recentIngredients.join('; ') : '(none yet)'}.
Set invite to "" unless they have no birth chart, in which case put the invitation there.`;
    const astroUser = `Date: ${date}. ${moonPhase ? `Moon phase: ${moonPhase}.` : ''}
${astroContext}

Write today's astrology reading now.`;

    const tarotSystem = `You are a warm tarot reader for "Secretly a Witch". Your voice is ${voice}
Interpret their daily 3-card past/present/future pull (Rider-Waite). Do NOT mention astrology, transits, or the moon.
Return VALID JSON ONLY, no markdown fences, exactly this shape:
{
  "cards": [ { "name": "...", "position": "Past|Present|Future", "meaning": "1-2 sentences for this card in this position/orientation" } ],
  "reading": "2 short paragraphs weaving the three cards into one throughline for today",
  "advice": "one gentle, actionable suggestion"
}`;
    const tarotUser = `Date: ${date}.
Their daily 3-card tarot pull (past / present / future):
${cardLines}

Write the reading now.`;

    // ── Split-part generation (the current client) ────────────────────────
    // 'astro' = the short teaser (headline/reading/omens) on the Today page;
    // 'deep' = the long Dive-deeper page (reading + ingredients + ritual);
    // 'tarot' = the 3-card reading. Astrology parts run on gpt-4o at a HIGH
    // temperature (1.4) — Sophie's pick, to make the readings get really weird;
    // tarot stays on Claude Opus.
    if (part) {
      const zodiacNote = astronomical ? `\nZODIAC: This reading uses the 13-SIGN ASTRONOMICAL zodiac — the REAL constellation boundaries the Sun actually crosses, INCLUDING Ophiuchus, not the usual tropical signs. The sign names you are given already reflect this; interpret them exactly as given (a "Gemini" here means the Gemini constellation), and do NOT convert them back to tropical or second-guess them.` : '';
      let out;
      if (part === 'astro') {
        const teaserSystem = `You are the daily astrologer for "Secretly a Witch" — sharp, specific, and a little witchy, like a clever friend who actually reads charts. NEVER condescending, NEVER generic, NEVER soft or reassuring for its own sake. No life-coaching, no "the universe", no "energy", no woo, no astrology-jargon dump. The reading itself observes rather than instructs — save the telling-them-what-to-do for the counsel fields, which exist exactly for that.${zodiacNote}
You are given REAL, accurately computed positions — interpret them, never recompute. Anchor on the ANCHOR TRANSIT if one is given (otherwise the most interesting thing in today's sky) and talk about what it actually feels like in a real life (a text, money, sleep, a conversation, the body, a specific mood), not in the abstract. Do NOT mention tarot.
This is the SHORT teaser — a separate, longer reading written from the SAME anchor sits behind a "Dive deeper" button — so END WITH PULL, NOT CLOSURE: the last line should leave the thread visibly open, a reason to want more. Never mention the button or the app.
Return VALID JSON ONLY, no markdown fences, exactly this shape:
{
  "headline": "one short, vivid, almost-aphoristic line for today — a saying, not a description of their placements",
  "reading": "2-4 SHORT, punchy sentences — Co-Star style: clipped, declarative, direct, ~50 words TOTAL max. Say something true, concrete, and specific about today grounded in the actual transit. It can be blunt or lightly commanding (a short imperative is fine). Never soft, generic, preachy, condescending, or reassuring-for-its-own-sake; never a horoscope platitude; no cosmic or mystical language, no 'the universe', no 'energy'.",
  "focus": "1-3 word theme for the day",
  "invite": "",
  "intention": "one short first-person line for today — specific, not generic",
  "omens": [ { "sign": "a small, everyday sign to watch for today (a few words)", "meaning": "what it means for them (a few words)" } ],
  "counsel": { "do": "one concrete thing today FAVORS doing, derived from a named transit — a real everyday act (introduce yourself to someone, ask for the refund, book the trip, post the thing), stated as a light imperative with the placement in parens, e.g. 'Say yes to the odd invitation (Venus trine your Uranus)'", "dont": "one concrete thing today is WRONG for, same format — a specific everyday act to hold off on (don't send the risky text, don't sign anything before noon, skip the big purchase), never vague caution, with the placement in parens" }
}
Give EXACTLY 2 omens.
COUNSEL rules: each is ONE short sentence, a specific physical/social act someone could actually do or skip TODAY — never inner-work ("reflect", "be open", "trust yourself" are all WRONG). The do and the dont must come from DIFFERENT transits when more than one is given.
Set invite to "" unless they have no birth chart, in which case put the invitation there.`;
        const aData = await openaiChat({ model: 'gpt-4o', temperature: 1.4, response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: teaserSystem }, { role: 'user', content: astroUser }] });
        if (aData.error) return res.status(400).json({ error: (aData.error.message || 'openai error') + ' (astrology)' });
        let astrology;
        try { astrology = parseJsonReply(aData); }
        catch (e) { return res.status(502).json({ error: 'Could not parse the astrology reading — try again.', detail: e.message }); }
        const intention = astrology.intention || '';
        delete astrology.intention;
        out = { astrology, intention, hasChart: Boolean(natal && bigThree) };
        if (bigThree) out.bigThree = bigThree;
      } else if (part === 'deep') {
        const deepSystem = `You are the daily astrologer for "Secretly a Witch", writing the DEEPER page of today's reading — the page behind the "Dive deeper" button. The reader already saw a 2-4 sentence teaser written from the SAME sky and the SAME anchor transit; this page picks up that thread and goes further. Do not re-introduce the day, do not summarize — deepen.
Same voice as the teaser: sharp, specific, and a little witchy, like a clever friend who actually reads charts. NEVER condescending, NEVER generic, NEVER soft or reassuring for its own sake. No life-coaching, no "the universe", no "energy", no woo, and never tell them what they "should" or "need to" do.${zodiacNote}
You are given REAL, accurately computed positions — interpret them, never recompute. Do NOT mention tarot.
Return VALID JSON ONLY, no markdown fences, exactly this shape:
{
  "reading": "4-6 SHORT paragraphs separated by blank lines (\\n\\n), 180-260 words TOTAL. Same clipped, declarative voice as the teaser, with room to move. Start from the ANCHOR TRANSIT and go past where a teaser could, then widen out. Name 2-3 placements/transits VERBATIM from the data (e.g. 'Mars in Virgo is squaring your natal Sun') and translate EACH into something concrete in a real day — a text, money, sleep, a conversation, the body, a specific mood. Every named placement must earn its place; no jargon dump.",
  "ingredients": ["EXACTLY 3 'ingredients' for the day, 2-4 words each, like a strange little witch's recipe — CONCRETE, surprising, and tied to TODAY specifically (small physical objects, odd gestures, overheard things), e.g. 'a borrowed umbrella', 'salt on the sill', 'the unsent text'"],
  "ritual": "a SMALL ritual for today — 2-4 sentences: one concrete physical act with a clear beginning and end, ordinary objects only, done in under two minutes, tied to the anchor transit. Bigger than a one-line gesture, never a ceremony."
}
INGREDIENTS — this matters most, get it right:
- NEVER generic wellness / self-care clichés. BANNED outright: deep breath, slow exhale, breathe, glass of water, cup of tea, warm tea, self-care, gratitude, journaling, patience, rest, hydrate, sunlight, fresh air, a walk, "a candle" on its own. If it could show up in ANY generic horoscope, it is WRONG — rewrite it.
- Make each one specific and a little strange so it feels personal to THIS day and this transit.
- Do NOT reuse any of these recently-used ingredients: ${recentIngredients.length ? recentIngredients.join('; ') : '(none yet)'}.${natal ? '' : `
They have NOT entered birth details, so nothing here is natal: read TODAY's real sky instead (the positions you were given), name 2-3 of today's actual placements, and end the reading with ONE gentle line inviting them to add their birthday for a personal reading.`}`;
        const deepUser = `Date: ${date}. ${moonPhase ? `Moon phase: ${moonPhase}.` : ''}
${astroContext}

Write the deeper page now.`;
        const dData = await openaiChat({ model: 'gpt-4o', temperature: 1.4, response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: deepSystem }, { role: 'user', content: deepUser }] });
        if (dData.error) return res.status(400).json({ error: (dData.error.message || 'openai error') + ' (deep reading)' });
        let deep;
        try { deep = parseJsonReply(dData); }
        catch (e) { return res.status(502).json({ error: 'Could not parse the deeper reading — try again.', detail: e.message }); }
        out = { deep, hasChart: Boolean(natal && bigThree) };
      } else {
        const tData = await anthropicChat({ system: tarotSystem, messages: [{ role: 'user', content: tarotUser }], max_tokens: 1400, temperature: 1 });
        if (tData.error) return res.status(400).json({ error: (tData.error.message || 'anthropic error') + ' (tarot)' });
        let tarot;
        try { tarot = parseAnthropicJson(tData); }
        catch (e) { return res.status(502).json({ error: 'Could not parse the tarot reading — try again.', detail: e.message }); }
        out = { tarot };
      }
      if (partRef) partRef.set({ date, uid, parts: { [part]: { hash: partHash, data: out } } }, { merge: true }).catch(() => {});
      const resp = { ...out, cached: false, date };
      if (part === 'deep') resp.sky = skyPayload();
      return res.json(resp);
    }

    // ── Legacy combined reading (stale cached clients only) ───────────────
    // Astrology runs on OpenAI's gpt-4o at HIGH temperature (1.4) — Sophie's
    // pick, to make the daily reading get really weird. Force a JSON object so
    // the weirdness stays parseable. Tarot stays on Claude Opus. The two never
    // see each other's context.
    const [aData, tData] = await Promise.all([
      openaiChat({ model: 'gpt-4o', temperature: 1.4, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: astroSystem }, { role: 'user', content: astroUser }] }),
      anthropicChat({ system: tarotSystem, messages: [{ role: 'user', content: tarotUser }], max_tokens: 1400, temperature: 1 }),
    ]);
    if (aData.error) return res.status(400).json({ error: (aData.error.message || 'openai error') + ' (astrology)' });
    if (tData.error) return res.status(400).json({ error: (tData.error.message || 'anthropic error') + ' (tarot)' });

    let astrology, tarot;
    try { astrology = parseJsonReply(aData); }
    catch (e) { return res.status(502).json({ error: 'Could not parse the astrology reading — try again.', detail: e.message }); }
    try { tarot = parseAnthropicJson(tData); }
    catch (e) { return res.status(502).json({ error: 'Could not parse the tarot reading — try again.', detail: e.message }); }

    const intention = astrology.intention || '';
    delete astrology.intention;
    const reading = { astrology, tarot, intention };
    reading.hasChart = Boolean(natal && bigThree);
    if (bigThree) reading.bigThree = bigThree;

    if (docRef) {
      // merge — the same doc also carries the split-part cache (`parts`).
      docRef.set({ reading, inputHash, date, uid, createdAt: new Date().toISOString() }, { merge: true }).catch(() => {});
    }
    res.json({ ...reading, cached: false, date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Rider-Waite-Smith (1909, public domain) tarot deck manifest ────────
// Card display name → permanent Firebase image URL. The 78 scans were mirrored
// from Wikimedia Commons to Firebase Storage (witch-tarot/) once; this just
// serves the committed name→URL map so the client can show real card art.
let TAROT_DECK = null;
try { TAROT_DECK = require('./witch-tarot-manifest.json'); } catch (e) { /* manifest optional */ }
app.get('/api/witch/tarot-deck', (req, res) => {
  if (!TAROT_DECK) return res.json({ configured: false, cards: {} });
  res.json({ configured: true, count: Object.keys(TAROT_DECK).length, cards: TAROT_DECK });
});

// ─── Shop proxy (secretlyawitch.com Shopify storefront) ─────────────────
// Pulls the public products.json so the app's Shop tab shows real products
// (image, title, price, link) without any storefront token. Cached in memory
// ~10 min. Every product's own URL still opens the real Shopify checkout.
let SHOP_CACHE = { at: 0, data: null };
// ── Shop curation: order + filter the app shop to mirror Sophie's Etsy ──
// Words that appear on nearly every listing carry no matching signal — drop
// them so the score reflects the distinctive product words.
const SHOP_STOPWORDS = new Set(('the a an and or of for to with in on set kit gift her him your my ' +
  'pagan wiccan wicca witch witchy witchcraft craft magic magical magick ritual altar supplies ' +
  'crystal crystals stone gift gifts new').split(/\s+/));
function shopWords(t) {
  return (t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !SHOP_STOPWORDS.has(w));
}
// A clean one-line display name from a keyword-stuffed title.
const SHOP_NAME_OVERRIDES = { // handle -> nice one-line name
  'labradorite-choose-exact-crystal-67898': 'Labradorite Crystal',
  'fluorite-wand-point-crystal-mineral-86535': 'Fluorite Wand Point',
};
function shopShortName(title, handle) {
  if (handle && SHOP_NAME_OVERRIDES[handle]) return SHOP_NAME_OVERRIDES[handle];
  let s = (title || '').split(/\s*[~•|]\s*/)[0];        // before the first separator
  s = s.replace(/\*[^*]*\*/g, ' ').replace(/\s{2,}/g, ' ').trim(); // drop *ASIDE* text
  const words = s.split(' ');
  if (s.length > 32 && words.length > 4) s = words.slice(0, 4).join(' '); // cap space-stuffed titles
  if (s && s === s.toUpperCase()) s = s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  if (s) s = s.charAt(0).toUpperCase() + s.slice(1);
  return s || title;
}
let ETSY_SHOP_LISTINGS = { at: 0, list: null, shopId: null };
async function etsyActiveListings() {
  const now = Date.now();
  if (ETSY_SHOP_LISTINGS.list && now - ETSY_SHOP_LISTINGS.at < 30 * 60 * 1000) return ETSY_SHOP_LISTINGS.list;
  const etsy = require('./etsy');
  let shopId = process.env.ETSY_SHOP_ID || ETSY_SHOP_LISTINGS.shopId;
  if (!shopId) {
    const me = await etsy.getMe(); // /users/me returns the owner's shop_id directly
    if (me && me.ok && me.body && me.body.shop_id) shopId = me.body.shop_id;
  }
  if (!shopId) return null;
  const r = await etsy.getAllListings(shopId, 'active');
  if (!r || !r.ok) return null;
  const list = (r.results || []).map((l, i) => ({ idx: i, id: l.listing_id, title: l.title, words: new Set(shopWords(l.title)) }));
  ETSY_SHOP_LISTINGS = { at: now, list, shopId };
  return list;
}

app.get('/api/witch/shop', async (req, res) => {
  try {
    const debug = req.query.debug === '1';
    const now = Date.now();
    if (!debug && SHOP_CACHE.data && now - SHOP_CACHE.at < 10 * 60 * 1000) return res.json(SHOP_CACHE.data);
    const base = 'https://secretlyawitch.com';
    const r = await fetch(`${base}/products.json?limit=100`, { headers: { 'User-Agent': 'SecretlyAWitch/1.0 (app shop)' } });
    if (!r.ok) return res.status(502).json({ error: `shop returned ${r.status}` });
    const j = await r.json();
    // The store is shared with other brands; drop obvious non-witch items.
    const EXCLUDE = /people\s*watching|in case of amnesia|remember things|custom order|incel/i;
    let products = (j.products || []).filter(p => !EXCLUDE.test(p.title || '')).map(p => {
      const v = (p.variants || [])[0] || {};
      const img = (p.images || [])[0] || {};
      const prices = (p.variants || []).map(x => parseFloat(x.price)).filter(n => isFinite(n));
      return {
        id: p.id, title: p.title, handle: p.handle,
        url: `${base}/products/${p.handle}`,
        image: img.src || null,
        price: v.price || null,
        priceMin: prices.length ? Math.min(...prices).toFixed(2) : null,
        available: (p.variants || []).some(x => x.available),
        type: p.product_type || '',
      };
    });

    // Cross-reference Etsy: keep only products that match an active Etsy
    // listing, order them the way Etsy lists them, and use a clean short name.
    let dbg = null;
    try {
      const listings = await etsyActiveListings();
      if (listings && listings.length) {
        const scored = products.map(p => {
          const pw = shopWords(p.title);
          let best = null, bestScore = 0;
          for (const l of listings) {
            let sc = 0; for (const w of pw) if (l.words.has(w)) sc++;
            if (sc > bestScore) { bestScore = sc; best = l; }
          }
          return { p, best, bestScore };
        });
        const byEtsy = new Map(); // one shopify product per etsy listing (best score wins)
        for (const s of scored) {
          if (!s.best || s.bestScore < 2) continue;
          const cur = byEtsy.get(s.best.id);
          if (!cur || s.bestScore > cur.bestScore) byEtsy.set(s.best.id, s);
        }
        const kept = [...byEtsy.values()].sort((a, b) => a.best.idx - b.best.idx);
        products = kept.map(s => ({ ...s.p, title: shopShortName(s.p.title, s.p.handle), fullTitle: s.p.title }));
        if (debug) dbg = {
          etsyCount: listings.length, shopifyCount: scored.length, kept: kept.length,
          matches: kept.map(s => ({ name: shopShortName(s.p.title, s.p.handle), etsy: s.best.title, score: s.bestScore, handle: s.p.handle })),
          unmatchedEtsy: listings.filter(l => !byEtsy.has(l.id)).map(l => l.title),
          dropped: scored.filter(s => !s.best || s.bestScore < 2).map(s => s.p.title),
        };
      } else {
        // Etsy unavailable — fall back to short names on the Shopify set.
        products = products.map(p => ({ ...p, title: shopShortName(p.title, p.handle), fullTitle: p.title }));
        if (debug) dbg = { etsyCount: 0, note: 'etsy listings unavailable; showing all shopify' };
      }
    } catch (e) {
      products = products.map(p => ({ ...p, title: shopShortName(p.title, p.handle), fullTitle: p.title }));
      if (debug) dbg = { error: e.message };
    }

    const out = { updatedAt: new Date().toISOString(), count: products.length, storeUrl: base, products };
    if (debug) return res.json({ ...out, debug: dbg });
    SHOP_CACHE = { at: now, data: out };
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Single image: DALL·E ───────────────────────────────────────────
app.post('/api/generate/dalle', async (req, res) => {
  try {
    const { prompt, size = '1024x1024', quality = 'standard' } = req.body;
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size, quality }),
    });
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    const permanentUrl = await saveToFirebase(data.data[0].url, 'dalle');
    res.json({ url: permanentUrl, revised_prompt: data.data[0].revised_prompt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Single image: OpenAI gpt-image-2 (quality low by default) ──────
app.post('/api/generate/gptimage', async (req, res) => {
  try {
    const { prompt, quality = 'low', size = '1024x1024' } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });
    if (!OPENAI_API_KEY) return res.status(400).json({ error: 'OPENAI_API_KEY not set on the server' });
    const data = await openaiImage({ model: 'gpt-image-2', prompt, n: 1, size, quality, output_format: 'webp' });
    if (data.error) return res.status(400).json({ error: data.error.message });
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return res.status(400).json({ error: 'gpt-image-2 returned no image' });
    const url = await saveBufferToFirebase(Buffer.from(b64, 'base64'), 'image/webp', 'openai');
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Text-to-speech: OpenAI gpt-4o-mini-tts ─────────────────────────
// Turns text into a natural-voiced audio file. Saved to Firebase for a
// permanent URL (like the images); also returns the raw bytes as base64 so a
// caller can grab the audio without a second fetch. `voice` is any OpenAI voice
// (alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer);
// `instructions` steers tone/pacing (gpt-4o-mini-tts only). `format` = mp3
// (default), wav, opus, aac, flac.
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice = 'nova', model = 'gpt-4o-mini-tts', format = 'mp3', instructions } = req.body;
    if (!text || !String(text).trim()) return res.status(400).json({ error: 'text is required' });
    if (!OPENAI_API_KEY) return res.status(400).json({ error: 'OPENAI_API_KEY not set on the server' });
    const body = { model, voice, input: String(text).slice(0, 4000), response_format: format };
    if (instructions) body.instructions = String(instructions).slice(0, 1000);
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const t = await response.text().catch(() => '');
      return res.status(response.status).json({ error: `OpenAI ${response.status}: ${t.slice(0, 400)}` });
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const mime = format === 'wav' ? 'audio/wav' : format === 'opus' ? 'audio/opus'
      : format === 'aac' ? 'audio/aac' : format === 'flac' ? 'audio/flac' : 'audio/mpeg';
    const url = await saveBufferToFirebase(buffer, mime, 'tts');
    res.json({ url, voice, model, format, b64: buffer.toString('base64') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Single image: Replicate (custom LoRA) — with settings + crash fix ──
app.post('/api/generate/replicate', async (req, res) => {
  try {
    const { prompt, settings = {} } = req.body;
    const model = req.body.model || 'sageryza/gosh';

    // Look up trigger word and version if it's one of our known models. The
    // trigger is prepended and any model-level promptSuffix appended, so the
    // style anchor travels with the model everywhere it's used.
    const known = MODELS.replicate.find(m => m.id === model);
    let fullPrompt = known ? `${known.trigger}, ${prompt}` : prompt;
    if (known?.promptSuffix) fullPrompt = `${fullPrompt}, ${known.promptSuffix}`;
    const version = known ? `${known.id}:${await resolveReplicateVersion(known)}` : model;

    const loraScale = settings.lora_scale ?? 1;
    const megapixels = settings.megapixels ?? '1';
    const numOutputs = settings.num_outputs ?? 1;
    const outputFormat = settings.output_format ?? 'webp';
    const guidanceScale = settings.guidance_scale ?? 3;
    const outputQuality = settings.output_quality ?? 80;
    const numInferenceSteps = settings.num_inference_steps ?? known?.defaultSteps ?? 28;

    console.log('Replicate:', { model, trigger: known?.trigger, loraScale, numOutputs, outputFormat, promptStart: fullPrompt.slice(0, 80) });

    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version,
        input: {
          prompt: fullPrompt,
          model: 'dev',
          go_fast: false,
          lora_scale: loraScale,
          megapixels: megapixels,
          num_outputs: numOutputs,
          aspect_ratio: '1:1',
          output_format: outputFormat,
          guidance_scale: guidanceScale,
          output_quality: outputQuality,
          prompt_strength: 0.8,
          num_inference_steps: numInferenceSteps,
        },
      }),
    });
    let prediction = await createRes.json();
    if (prediction.error) return res.status(400).json({ error: prediction.error });

    // FIX: Check for missing polling URL (happens with rate limiting / concurrent requests)
    if (!prediction.urls?.get) {
      return res.status(400).json({ error: prediction.detail || 'Replicate did not return a polling URL — may be rate limited' });
    }

    while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
      await new Promise(r => setTimeout(r, 1500));
      const pollRes = await fetch(prediction.urls.get, {
        headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
      });
      prediction = await pollRes.json();
    }
    if (prediction.status === 'failed') return res.status(400).json({ error: prediction.error || 'Generation failed' });

    const output = prediction.output;
    const urls = Array.isArray(output) ? output : [output];
    const permanentUrls = [];
    for (const tempUrl of urls) {
      permanentUrls.push(await saveToFirebase(tempUrl, 'replicate'));
    }
    res.json({ url: permanentUrls[0], urls: permanentUrls });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Style test: generate preview images ────────────────────────────
app.post('/api/generate/style-test', async (req, res) => {
  try {
    const { subjects, provider = 'replicate', model, stylePrompt = '', settings = {} } = req.body;
    if (!subjects || !subjects.length) return res.status(400).json({ error: 'subjects required' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i];
      try {
        let imageData;
        if (provider === 'replicate') {
          const endpoint = `http://localhost:${process.env.PORT || 3001}/api/generate/replicate`;
          const internal = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: `${stylePrompt} ${subject}`.trim(), model: model || 'sageryza/gosh', settings }),
          });
          imageData = await internal.json();
        } else {
          const endpoint = `http://localhost:${process.env.PORT || 3001}/api/generate/dalle`;
          const prompt = stylePrompt ? `${stylePrompt}. ${subject}` : subject;
          const internal = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
          });
          imageData = await internal.json();
        }
        res.write(`data: ${JSON.stringify({ index: i, total: subjects.length, subject, ...imageData })}\n\n`);
      } catch (err) {
        res.write(`data: ${JSON.stringify({ index: i, total: subjects.length, subject, error: err.message })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Deck batch: generate images in batches ─────────────────────────
app.post('/api/generate/deck-batch', async (req, res) => {
  try {
    const { cards, provider = 'replicate', model, stylePrompt = '', settings = {} } = req.body;
    if (!cards || !cards.length) return res.status(400).json({ error: 'cards required' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      try {
        let imageData;
        if (provider === 'replicate') {
          const endpoint = `http://localhost:${process.env.PORT || 3001}/api/generate/replicate`;
          const prompt = `${stylePrompt} ${card.subject}`.trim();
          const internal = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, model: model || 'sageryza/gosh', settings }),
          });
          imageData = await internal.json();
        } else {
          const endpoint = `http://localhost:${process.env.PORT || 3001}/api/generate/dalle`;
          const prompt = stylePrompt ? `${stylePrompt}. ${card.subject}` : card.subject;
          const internal = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
          });
          imageData = await internal.json();
        }
        res.write(`data: ${JSON.stringify({ index: i, total: cards.length, subject: card.subject, ...imageData })}\n\n`);
      } catch (err) {
        res.write(`data: ${JSON.stringify({ index: i, total: cards.length, subject: card.subject, error: err.message })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Sticker sheet ──────────────────────────────────────────────────
app.post('/api/generate/sticker-sheet', async (req, res) => {
  try {
    const { moments, provider = 'dalle', model, stylePrompt = '', bgSuffix = '', settings = {} } = req.body;
    const basePrompt = `Create a sticker sheet with ${moments.length} individual stickers scattered across a white background. Each sticker should be a cute, kawaii-style illustration with pastel colors, white borders, and no text. The stickers represent these moments:\n${moments.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\nStyle: Hand-drawn quality, soft muted colors (dusty pinks, sage greens, lavender, warm grays), organic scattered layout with varying sizes and angles. No text anywhere.`;
    const parts = [stylePrompt, basePrompt, bgSuffix].filter(Boolean);
    const prompt = parts.join('. ');
    const endpoint = provider === 'replicate' ? '/api/generate/replicate' : '/api/generate/dalle';
    const body = provider === 'replicate'
      ? { prompt, model: model || 'sageryza/gosh', settings }
      : { prompt };
    const internal = await fetch(`http://localhost:${process.env.PORT || 3001}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await internal.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Sticker Page: full-page sticker sheet via gpt-image-2 ──────────
// The new, richer sticker workflow (standalone /stickers page). One prompt
// (+ optional reference images) becomes a single full-page sheet of kiss-cut
// stickers. Reference images are sent as base64 in the JSON body and forwarded
// to gpt-image-2's edits endpoint as visual references; with no references it
// falls back to plain generation. quality defaults to "medium".
function decodeDataUrl(s) {
  if (!s) return null;
  const m = /^data:([^;]+);base64,(.*)$/.exec(s);
  const b64 = m ? m[2] : s;            // accept raw base64 too
  const mime = m ? m[1] : 'image/png';
  try { return { buffer: Buffer.from(b64, 'base64'), mime }; } catch { return null; }
}

// Network timeouts for OpenAI image calls, scaled by render quality. High
// (and auto, which may pick high) takes 3-4+ minutes at OpenAI's end, so the
// old flat 90s cap made EVERY high render fail after three timed-out
// attempts. Low/medium keep the short cap so phone clients still fail fast.
const OPENAI_IMAGE_TIMEOUTS = { low: 90000, medium: 150000, high: 420000, auto: 420000 };

// Multipart edits call to gpt-image-2 with one or more reference images. Uses
// the `image[]` field so several references can guide a single result. Fails
// fast on errors (no held-open socket) like the other OpenAI helpers.
async function openaiStickerEdit({ prompt, refs, quality, size, retries = 2 }) {
  // Edits are slower than generations, so only ever raise the cap, never lower it.
  const timeout = Math.max(120000, OPENAI_IMAGE_TIMEOUTS[quality] || 0);
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const form = new FormData();
      form.append('model', 'gpt-image-2');
      form.append('prompt', prompt);
      refs.forEach((r, i) => {
        const ext = (r.mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
        form.append('image[]', r.buffer, { filename: `ref${i}.${ext}`, contentType: r.mime });
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
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

const STICKER_QUALITIES = new Set(['low', 'medium', 'high']);
const STICKER_SIZES = new Set(['1024x1024', '1024x1536', '1536x1024', 'auto']);

app.post('/api/generate/sticker-page', async (req, res) => {
  try {
    let { prompt = '', refs = [], quality = 'medium', size = '1024x1536' } = req.body;
    if (!OPENAI_API_KEY) return res.status(400).json({ error: 'OPENAI_API_KEY not set on the server' });
    prompt = String(prompt).trim();
    if (!prompt) return res.status(400).json({ error: 'Describe the stickers you want.' });
    if (!STICKER_QUALITIES.has(quality)) quality = 'medium';
    if (!STICKER_SIZES.has(size)) size = '1024x1536';

    const refBuffers = (Array.isArray(refs) ? refs : [])
      .slice(0, 4)                      // keep the request sane
      .map(decodeDataUrl)
      .filter(Boolean);

    // Base instruction that turns the user's idea into a printable sticker sheet:
    // many separate die-cut stickers, thick white borders, scattered, no text.
    const sheet =
      'A full-page sticker sheet: a collection of separate die-cut (kiss-cut) ' +
      'stickers arranged scattered across a plain white background, varied sizes ' +
      'and slight rotations, each sticker with a clean thick white border and a ' +
      'subtle drop shadow so it reads as a peel-off sticker. Cohesive set, ' +
      'glossy vinyl look, vibrant and cute. Absolutely no text, words or letters. ' +
      'The stickers depict: ' + prompt;
    const refNote = refBuffers.length
      ? ' Use the attached image(s) as reference for the subjects and overall look.'
      : '';
    const fullPrompt = sheet + refNote;

    let data;
    if (refBuffers.length) {
      data = await openaiStickerEdit({ prompt: fullPrompt, refs: refBuffers, quality, size });
    } else {
      data = await openaiImage({ model: 'gpt-image-2', prompt: fullPrompt, n: 1, size, quality, output_format: 'webp' });
    }
    if (data.error) return res.status(400).json({ error: data.error.message || 'gpt-image-2 error' });
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return res.status(400).json({ error: 'gpt-image-2 returned no image' });
    const url = await saveBufferToFirebase(Buffer.from(b64, 'base64'), 'image/webp', 'stickers');
    res.json({ url, quality, size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Talking to Myself: illustrate a dream / memory / wish ──────────
// Shared visual style — a moody illustrated-zine panel. Captions are drawn
// by the app UI, so the image itself must contain NO text or letters.
const TALKING_STYLE =
  'Detailed pen-and-ink illustration with dense cross-hatching and fine line work, ' +
  'softened by muted watercolor washes in a limited, dusty palette (sepia, faded ' +
  'indigo, ochre, sage, dusty rose). Aged cream paper texture. A single framed ' +
  'panel with a hand-drawn border. Melancholic, surreal, intimate diary mood, like ' +
  'an outsider-art comic. Simple composition, one or two subjects. ' +
  'Absolutely no text, no words, no letters, no captions anywhere in the image.';

// Tone hints per entry type, woven into the caption + prompt generation.
const TALKING_TYPES = {
  dream:    'a dream — allow it to be surreal, dreamlogic, uncanny',
  memory:   'a memory — tender, specific, slightly faded by time',
  happened: 'something that actually happened — grounded and real, a small true moment',
  read:     'something they read — illustrate the idea or image it left behind',
  wish:     'a wish — hopeful, yearning, a little luminous',
};

// POST to OpenAI's image endpoint with retries for transient network errors
// (e.g. "Premature close"), mirroring openaiChat. It does NOT wait out the
// per-minute rate limit — holding the request open caused phone-side timeouts
// ("couldn't reach the server"); instead it returns the rate-limit error fast
// and the client tells the user to wait a moment.
async function openaiImage(body, retries = 2) {
  const timeout = OPENAI_IMAGE_TIMEOUTS[body.quality] || 90000;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json', 'Connection': 'close' },
        body: JSON.stringify(body),
        timeout,
      });
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// Generate one illustrated panel with gpt-image-1 (returns base64). If the
// account can't use gpt-image-1 yet, surface a clear error rather than
// silently switching models (which would break the zine's visual style).
// Load the style-reference image once (used to anchor the zine look, the way
// ChatGPT fed it the uploaded panel). Lives outside /public so it's never
// web-served — only sent to OpenAI as a style guide.
let styleRefBuffer = null;
try {
  styleRefBuffer = fs.readFileSync(__dirname + '/refs/style.jpg');
  console.log('Style reference loaded (', styleRefBuffer.length, 'bytes )');
} catch {
  console.warn('No style reference image found — falling back to text-only style');
}

// Edit-mode (style-reference) generation is gated off until verified live —
// it appeared to hang/time out. Now that requests fail fast on rate limits,
// the style reference is on by default again (set USE_STYLE_REF=0 to disable).
const USE_STYLE_REF = process.env.USE_STYLE_REF !== '0';

// gpt-image-2 edit endpoint (multipart) with the style reference image. Like
// openaiImage, it returns rate-limit errors fast rather than holding the
// request open (which caused phone-side timeouts).
async function openaiImageEdit(prompt, refBuffer, retries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const form = new FormData();
      form.append('model', 'gpt-image-2');
      form.append('prompt', prompt);
      form.append('image', refBuffer, { filename: 'style.jpg', contentType: 'image/jpeg' });
      form.append('size', '1024x1024');
      form.append('quality', 'low');
      form.append('output_format', 'webp');
      form.append('output_compression', '80');
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders() },
        body: form,
        timeout: 75000,
      });
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function generateZinePanel(imagePrompt) {
  // Edit mode with the style reference image — gpt-image-2, NO fallback.
  // If it errors, the error surfaces (we don't quietly switch model/style).
  if (!styleRefBuffer) throw new Error('Style reference image not loaded');
  const editPrompt = 'Use the attached image purely as the STYLE reference (match its medium, linework, palette and caption lettering) — do NOT copy its content. ' + imagePrompt;
  const data = await openaiImageEdit(editPrompt, styleRefBuffer);
  if (data.error) throw new Error(data.error.message || 'gpt-image-2 edit error');
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('gpt-image-2 edit returned no image');
  const url = await saveBufferToFirebase(Buffer.from(b64, 'base64'), 'image/webp', 'talking');
  return { url, model: 'gpt-image-2-edit' };
}

// Instant wake-up ping (no external calls) — used by the page on load to
// warm a sleeping free-tier instance before the first illustrate request.
app.get('/api/talking/ping', (req, res) => { res.json({ ok: true }); });

// Build info so the page can show which deployed version is live.
const BOOT_TIME = new Date().toISOString();
app.get('/api/talking/version', (req, res) => {
  res.json({
    commit: (process.env.RENDER_GIT_COMMIT || '').slice(0, 7) || 'dev',
    booted: BOOT_TIME,
  });
});

// Status: is cloud image storage (Firebase) connected? When false, images
// come back as big data URLs that have to live in the phone's browser.
app.get('/api/talking/status', (req, res) => { res.json({ firebase: Boolean(bucket) }); });

// Lightweight one-shot check: does this OpenAI account work with gpt-image-1?
app.get('/api/talking/check', async (req, res) => {
  if (!OPENAI_API_KEY) return res.json({ ok: false, error: 'OPENAI_API_KEY not set on the server' });
  try {
    const data = await openaiImage({ model: 'gpt-image-2', prompt: 'a single small ink dot on cream paper', n: 1, size: '1024x1024', quality: 'low' });
    if (data.error) return res.json({ ok: false, error: data.error.message, code: data.error.code });
    return res.json({ ok: Boolean(data.data?.[0]?.b64_json), model: 'gpt-image-2' });
  } catch (err) {
    return res.json({ ok: false, error: err.message });
  }
});

app.post('/api/talking/illustrate', async (req, res) => {
  try {
    const { text, type = 'memory' } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
    const typeHint = TALKING_TYPES[type] || TALKING_TYPES.memory;

    // Step 1: turn the raw entry into a short caption + a concrete image prompt.
    const chat = await openaiChat({
      model: 'gpt-4o-mini',
      temperature: 0.85,
      messages: [
        {
          role: 'system',
          content: `You help make an illustrated personal zine called "Talking to Myself". The keeper jots down ${typeHint}. Turn their note into ONE panel.

Return valid JSON only, no markdown fences, with two fields:
- "caption": a short, evocative title for the panel, 2 to 6 words, plain language, no quotation marks. It will be printed under the drawing in small caps (e.g. "the house kept whispering", "things i never sent").
- "prompt": a concrete image-generation prompt under 45 words describing ONE simple, specific visual from their note — one or two subjects, a clear arrangement. Pull real details from their words; never invent people or places they didn't mention. Describe people by any physical details they gave. Do not include any words, text, or lettering in the scene.

Stay honest to what they wrote — you may gently draw out the feeling, but never fabricate events.`,
        },
        { role: 'user', content: text.trim() },
      ],
    });
    if (chat.error) return res.status(400).json({ error: chat.error.message });

    const raw = chat.choices[0].message.content.trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { caption: '', prompt: text.trim() }; }
    const caption = (parsed.caption || '').toString().trim();
    const scene = (parsed.prompt || text.trim()).toString().trim();

    // Step 2: render the panel in the zine style.
    const imagePrompt = `${scene}\n\nStyle: ${TALKING_STYLE}`;
    const { url, model } = await generateZinePanel(imagePrompt);

    res.json({ caption, url, model, type, scene });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Page mode: multi-panel pages (4 panels per image, spill into more) ──
// Refined style line from ChatGPT's own "for reuse" prompt — used alongside
// the reference image (both signals, matching the ChatGPT setup).
const TALKING_STYLE_GRID =
  'Hand-drawn diary-comic page on aged cream paper. Naive outsider-art linework ' +
  'in colored pencil and ink, with thin wobbly black panel borders and handwritten ' +
  'caption boxes. Muted palette of gray-blue, tan, black, and pale yellow. Imperfect ' +
  'anatomy, awkward emotional faces, simple compositions, slightly eerie but intimate.';

// Build one gpt-image-1 prompt for a page of 1–4 panels.
function buildPagePrompt(beats) {
  const n = beats.length;
  const layout = n >= 4 ? 'a 2x2 grid of four comic-style panels'
    : n === 3 ? 'three comic-style panels in a row'
    : n === 2 ? 'two comic-style panels side by side'
    : 'a single comic-style panel';
  const lines = beats.map((b, i) =>
    `Panel ${i + 1}: ${b.scene}. Caption box: "${b.caption}"`).join('\n');
  return `Create a single illustration as ${layout} on aged cream paper, each panel an ` +
    `equal size with a thin wobbly black border. ${TALKING_STYLE_GRID}\n\n${lines}\n\nRender the page ` +
    `as one complete image. Beneath each panel put a handwritten caption box with its caption, ` +
    `spelled exactly as written. The ONLY text anywhere in the image is those short captions — ` +
    `no other words, no title, no signature.`;
}

// Step 1: break an entry into ordered visual beats, chunked into groups of 4.
app.post('/api/talking/plan', async (req, res) => {
  try {
    const { text, type = 'memory' } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
    const typeHint = TALKING_TYPES[type] || TALKING_TYPES.memory;

    const chat = await openaiChat({
      model: 'gpt-4o-mini',
      temperature: 0.8,
      messages: [
        {
          role: 'system',
          content: `You help turn a note into the panels of an illustrated comic zine page. The keeper jotted down ${typeHint}. Break it into its distinct visual beats, in order — each beat becomes one comic panel.

Return valid JSON only, no markdown fences: an array of objects with:
- "caption": 2 to 6 words, plain language, no quotation marks (printed under the panel in small caps).
- "scene": a concrete image prompt under 35 words for that single moment — one or two subjects, a clear arrangement, no text or lettering described in the scene.

Rules: Only use moments actually present in the note; never invent events, people, or places. Describe people by any physical details given. Return between 1 and 12 beats — as many as the note genuinely contains, no padding.`,
        },
        { role: 'user', content: text.trim() },
      ],
    });
    if (chat.error) return res.status(400).json({ error: chat.error.message });

    const raw = chat.choices[0].message.content.trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    let beats;
    try { beats = JSON.parse(raw); } catch { beats = []; }
    beats = (Array.isArray(beats) ? beats : [])
      .map(b => ({ caption: (b.caption || '').toString().trim(), scene: (b.scene || '').toString().trim() }))
      .filter(b => b.scene)
      .slice(0, 12);
    if (!beats.length) return res.status(400).json({ error: 'Could not find anything to illustrate.' });

    // Chunk into groups of 4 panels (one image per group).
    const groups = [];
    for (let i = 0; i < beats.length; i += 4) groups.push(beats.slice(i, i + 4));
    res.json({ beats, groups, type });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Step 2: render one page image (1–4 panels) from a group of beats.
// Render a page as a BACKGROUND JOB so the phone never holds one long request
// open (gpt-image-2 can take a while). Start returns a jobId immediately; the
// client polls /api/talking/job/:id until it's done or errored.
const talkingJobs = new Map(); // jobId -> { status, url, model, captions, error, ts }

function sweepJobs() {
  const now = Date.now();
  for (const [id, job] of talkingJobs) {
    if (job.status !== 'pending' && now - job.ts > 10 * 60 * 1000) talkingJobs.delete(id);
  }
}

app.post('/api/talking/render-page', (req, res) => {
  const { beats } = req.body || {};
  if (!Array.isArray(beats) || !beats.length) return res.status(400).json({ error: 'beats required' });
  sweepJobs();
  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const captions = beats.slice(0, 4).map(b => b.caption);
  talkingJobs.set(jobId, { status: 'pending', ts: Date.now() });
  // Kick off generation without awaiting — the HTTP response returns now.
  (async () => {
    try {
      const { url, model } = await generateZinePanel(buildPagePrompt(beats.slice(0, 4)));
      talkingJobs.set(jobId, { status: 'done', url, model, captions, ts: Date.now() });
    } catch (err) {
      talkingJobs.set(jobId, { status: 'error', error: err.message, ts: Date.now() });
    }
  })();
  res.json({ jobId });
});

app.get('/api/talking/job/:id', (req, res) => {
  const job = talkingJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'job not found (it may have expired)' });
  res.json(job);
});

// ─── Upscale a page for print (Replicate Real-ESRGAN, faithful 4x) ──────
// Takes the exact approved image and increases resolution for print without
// changing the art. Runs as a background job (polled like render-page).
async function upscaleImage(imageInput) {
  const createRes = await fetch('https://api.replicate.com/v1/models/nightmareai/real-esrgan/predictions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: { image: imageInput, scale: 4, face_enhance: false } }),
  });
  let prediction = await createRes.json();
  if (prediction.error) throw new Error(prediction.error.detail || prediction.error || 'Replicate error');
  if (!prediction.urls?.get) throw new Error(prediction.detail || 'Replicate did not return a polling URL');
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled') {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(prediction.urls.get, { headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` } });
    prediction = await pollRes.json();
  }
  if (prediction.status !== 'succeeded') throw new Error(prediction.error || 'Upscale failed');
  const out = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!out) throw new Error('Upscale produced no image');
  return await saveToFirebase(out, 'talking-print'); // permanent if Firebase set, else the Replicate URL
}

app.post('/api/talking/upscale', (req, res) => {
  const { image } = req.body || {};
  if (!image) return res.status(400).json({ error: 'image required' });
  if (!REPLICATE_API_TOKEN) return res.status(400).json({ error: 'Replicate token not set on the server' });
  sweepJobs();
  const jobId = 'up_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  talkingJobs.set(jobId, { status: 'pending', ts: Date.now() });
  (async () => {
    try {
      const url = await upscaleImage(image);
      talkingJobs.set(jobId, { status: 'done', url, ts: Date.now() });
    } catch (err) {
      talkingJobs.set(jobId, { status: 'error', error: err.message, ts: Date.now() });
    }
  })();
  res.json({ jobId });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server v11 running on http://localhost:${PORT}`));

// ─── Keep-awake ─────────────────────────────────────────────────────
// Free-tier hosts spin the server down after ~15 min with no inbound
// traffic, causing slow cold starts / "Load failed" on the next visit.
// Pinging our own public URL on a timer keeps it warm — no external uptime
// service or setup needed. Render provides RENDER_EXTERNAL_URL automatically.
const SELF_URL = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL;
if (SELF_URL) {
  const KEEP_AWAKE_MS = 10 * 60 * 1000; // 10 min, under the ~15 min idle window
  setInterval(() => {
    fetch(`${SELF_URL}/api/talking/ping`).catch(() => {});
  }, KEEP_AWAKE_MS);
  console.log('Keep-awake self-ping enabled for', SELF_URL);
} else {
  console.log('Keep-awake disabled (no RENDER_EXTERNAL_URL)');
}
