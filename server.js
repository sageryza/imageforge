// imageforge-server v11 — moments v3 prompts, replicate crash fix, pwcscans model
const express = require('express');
// THE WHOLE PROMPT, one builder — see prompt-record.js (Sophie's hard rule,
// 2026-08-24: anytime an image is made anywhere, the whole prompt is stored).
const promptRecord = require('./prompt-record');
// The panel sheet's geometry — derived canvases, the grid sentence, the cut
// rects and the style-tail sheet swap. See sheet-grid.js.
const sheetGrid = require('./sheet-grid');
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

// gzip every compressible response — the editor's transcript payloads are
// ~300KB of JSON that shrink ~4x, which is the difference between a snappy
// and a sluggish episode open on a phone connection.
app.use(require('compression')());

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
// The OOM tripwire: when RSS nears the 512MB line it files the last requests
// to Firestore `forge-memwatch` BEFORE the kernel's SIGKILL can land — the
// only way a mystery restart leaves the culprit's name behind. See memwatch.js.
require('./memwatch').install(app, admin);
const memwatch = require('./memwatch');
// Reference images for the Sticker Page are sent as base64 in the JSON body,
// so the default 100kb limit is far too small — allow a handful of photos.
app.use(express.json({ limit: '25mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

// ─── Secretly a Witch front door (secretlyawitch.com) ───────────────
// The apex domain points at this service (it used to be the Shopify
// storefront), and on that host the witch app IS the site: `/` serves the
// app, old Shopify-storefront paths 301 to the store's permanent
// .myshopify.com home so nothing ever 404s, the old /blogs/* URLs land on
// the on-site blog (blog-public.js), and robots/sitemap are served for SEO.
// Inert for imageforge-q125.onrender.com traffic — the studio is unchanged.
// blog-public reads no env keys at require time, so requiring it here (before
// the Firestore config loader runs) is safe — unlike blog.js.
const blogPublic = require('./blog-public');
const WITCH_HOSTS = new Set(['secretlyawitch.com', 'www.secretlyawitch.com']);
const isWitchHost = (req) => WITCH_HOSTS.has(String(req.hostname || '').toLowerCase());
// The store's permanent home once the domain flips (Shopify serves the same
// storefront + checkout there). Overridable so it can later become e.g.
// shop.secretlyawitch.com without a code change.
const witchStoreOrigin = () => (process.env.WITCH_STORE_ORIGIN || 'https://cod-god-inc.myshopify.com').replace(/\/$/, '');
const WITCH_ROBOTS = [
  'User-agent: *',
  'Disallow: /api/',
  'Disallow: /*.html$',
  // Studio/hub surfaces that share this server — not part of the public site.
  ...['/studio', '/photo', '/song', '/dreams', '/films', '/report', '/character', '/story', '/storyroom',
    '/wall', '/writing', '/chats', '/import', '/test', '/book', '/talking', '/gallery', '/set', '/stickers']
    .map((p) => `Disallow: ${p}`),
  'Sitemap: https://secretlyawitch.com/sitemap.xml',
].join('\n') + '\n';
app.use((req, res, next) => {
  if (!isWitchHost(req)) return next();
  const p = req.path;
  const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  if (p === '/') return res.sendFile(__dirname + '/public/witch.html');
  // Canonical home — keeps query params (Stripe returns to /witch?sub=success).
  if (p === '/witch' || p === '/witch/') return res.redirect(301, '/' + qs);
  if (p === '/privacy') return res.sendFile(__dirname + '/public/witch-privacy.html');
  // Both spellings — App Store Connect calls it Support, people type /contact.
  if (p === '/support' || p === '/contact') return res.sendFile(__dirname + '/public/witch-support.html');
  if (p === '/robots.txt') return res.type('text/plain').send(WITCH_ROBOTS);
  if (p === '/sitemap.xml') return blogPublic.sitemap(req, res);
  // Old Shopify-storefront URLs (indexed pages, School lesson product links,
  // saved carts) → the store's real home, path preserved.
  if (/^\/(products|collections|cart|checkout|pages|account|policies|password|discount)(\/|$)/.test(p)) {
    return res.redirect(301, witchStoreOrigin() + req.originalUrl);
  }
  // Old Shopify blog URLs (/blogs/<blog-handle>/<post-handle>) → on-site blog.
  const mBlog = p.match(/^\/blogs(?:\/[^/]+)?\/?([^/]*)\/?$/);
  if (mBlog) return res.redirect(301, mBlog[1] ? `/blog/${mBlog[1]}` : '/blog');
  next(); // everything else (/, /api/*, /blog, static assets) flows through
});

// Universal links: /.well-known/apple-app-site-association tells iOS which
// paths on this host belong to the Deck Factory app. Apple's fetcher follows
// NO redirects and sends NO credentials, so this must sit above dream-host,
// above express.static and above the studio gate. See applinks.js.
app.use('/.well-known', require('./applinks').router);

// The dream feed's own front door — youwereinmydreams.com serves the app at
// `/`. Must sit ABOVE express.static and the `/` route below, both of which
// would otherwise answer with the studio hub. Inert on every other host.
app.use(require('./dream-host').middleware(__dirname));

app.use(express.static(__dirname + '/public'));

// The Mac-side voice-memo pusher, served so it can be run without cloning the
// repo:  curl -fsSL <app>/push-memos.mjs -o /tmp/push-memos.mjs && node /tmp/push-memos.mjs
// It contains no credentials — everything privileged happens in /api/memos.
app.get('/push-memos.mjs', (req, res) => {
  res.type('text/javascript').sendFile(__dirname + '/scripts/push-memos.mjs');
});

// The Mac-side Apple-transcript importer, served the same way. Voice Memos
// transcribes on the phone for free — including the recordings the server's
// own ceiling and Whisper's size cap could never handle — and only her Mac can
// read that database. Same deal as the push: no credentials in the script.
app.get('/import-apple-transcripts.mjs', (req, res) => {
  res.type('text/javascript').sendFile(__dirname + '/scripts/import-apple-transcripts.mjs');
});

// One-time installer for the Mac's launchd agent that runs the push at login
// and daily — so the pusher above needs no human after this. No credentials.
app.get('/install-memo-autopush.sh', (req, res) => {
  res.type('text/x-shellscript').sendFile(__dirname + '/scripts/install-memo-autopush.sh');
});

app.get('/push-journal.mjs', (req, res) => {
  res.type('text/javascript').sendFile(__dirname + '/scripts/push-journal.mjs');
});

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
  try { return JSON.parse(t); } catch { return JSON.parse(escapeCtrlInStrings(t)); }
}
// Model JSON sometimes carries literal newlines/tabs INSIDE string values
// (e.g. a two-paragraph "reading" field, seen live on /api/witch/tarot-ask
// 2026-07-28) — JSON.parse rejects those control characters. Escape them,
// but only inside string literals so structural whitespace stays untouched.
function escapeCtrlInStrings(t) {
  let out = '', inStr = false, esc = false;
  for (const ch of t) {
    if (!inStr) { if (ch === '"') inStr = true; out += ch; continue; }
    if (esc) { out += ch; esc = false; continue; }
    if (ch === '\\') { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = false; out += ch; continue; }
    const code = ch.charCodeAt(0);
    if (code < 0x20) { out += ({ 10: '\\n', 13: '\\r', 9: '\\t' })[code] || ' '; continue; }
    out += ch;
  }
  return out;
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
  const crystals = require('./crystals');
  const dropbox = require('./dropbox');
  const audioDrop = require('./audio');
  const etsyReport = require('./etsy-report');
  const shopify = require('./shopify');
  const blog = require('./blog');
  const sync = require('./sync');
  const writing = require('./writing');
  const gdrive = require('./gdrive');
  const chatfeed = require('./chatfeed');
  const tarotEmail = require('./tarot-email');
  const nde = require('./nde');
  const editor = require('./editor');
  const cuttingroom = require('./cuttingroom');
  const cutmarks = require('./cutmarks');
  const blocks = require('./blocks');
  const pausing = require('./pausing');
  const googleads = require('./googleads');
  app.use('/api/etsy', etsy.router);
  // No /report route exists on etsy.router, so requests fall through to here.
  app.use('/api/etsy/report', etsyReport.router);
  // Etsy reviews mirrored to Firestore, served to the witch app's product
  // sheets (public — reviews are marketing content). Backfill:
  // scripts/backfill-etsy-reviews.js; steady-state top-up is self-throttled.
  app.use('/api/witch/shop/reviews', require('./etsy-reviews').router);
  // Story Timeline: a dictated list of moments becomes cards she can put in
  // order. No model call, no job — see timeline.js's header.
  app.use('/api/timeline', require('./timeline').router);
  app.use('/api/printify', printify.router);
  app.use('/api/printful', printful.router);
  app.use('/api/lulu', lulu.router);
  app.use('/api/pipeline', pipeline.router);
  app.use('/api/photostudio', photostudio.router);
  // Everything Movies makes — a clip, a bridge, a quick animation, a finished
  // cut — also files into the iOS "My Creations" gallery, so it can be found
  // and saved outside the Movies tab (Sophie, Aug 2026: "they just stay
  // there"). Best-effort inside movies.js; a gallery hiccup never fails a
  // render.
  movies.init({ fileCreation: fileCreationDoc });
  // Same hand-off for the mockup shots — the whole edit prompt is stored with
  // each one (the scene half is model-written and exists nowhere else).
  photostudio.init({ fileCreation: fileCreationDoc });
  app.use('/api/movies', movies.router);
  app.use('/api/songs', songs.router);
  // Stories live on the boards now: hand the module the story-project
  // Firestore getter so /api/stories reads/writes forge-story (membry).
  stories.init({ storyDb });
  app.use('/api/stories', stories.router);
  app.use('/api/mpc', mpc.router);
  app.use('/api/mpc-upload', mpcUpload.router); // full auto-upload (stops at cart)
  app.use('/api/apiframe', apiframe.router); // Midjourney deck-art generator
  app.use('/api/ingest', ingest.router); // import externally-made art (bring-your-own-MJ)
  app.use('/api/crystals', crystals.router); // crystal drop box (photos + metadata → Etsy listings)
  app.use('/api/drop', dropbox.router); // the Dump — one inbox for anything, labelled later
  app.use('/api/audio', audioDrop.router); // audio drop — recordings off the phone → permanent URLs
  // Paste a video url, get the file — filed straight into the Dump (video) or
  // the audio library (audio), so it is usable without a trip through her phone.
  app.use('/api/ytdl', require('./ytdl').router);
  app.use('/api/scratchpad', require('./scratchpad').router); // Scratch Pad — stage one of a story (hearted Playground images → beats)
  // Freeform — your own reference images + your own words, sent verbatim. The
  // one image surface that adds NOTHING to a prompt (no style prefix/suffix).
  app.use('/api/freeform', require('./freeform').router);
  // Vector Studio — described drawings → a pastel sheet → cut-outs → SVG. The
  // one surface whose output is resolution-free, so a drawing can go on a
  // poster, a shirt or a die-cut sticker. Mounted here so config-loader has
  // hydrated OPENAI_API_KEY before the module reads it.
  app.use('/api/vector', require('./vector').router);
  // Chat icons — the little drawing beside every chat's name in the Chats app,
  // swept for new chats 25 to a sheet. Mounted here for OPENAI_API_KEY, same as
  // the vector module it draws through.
  app.use('/api/chaticons', require('./chaticons').router);
  // Voice Studio — Sophie's ElevenLabs voices on a page (mounted here so the
  // config-loader has hydrated ELEVENLABS_API_KEY before the module reads it).
  app.use('/api/voicelab', require('./voicelab').router);
  // Push — device registration + the APNs sender behind the Chats app's
  // lock-screen notifications. Dormant until the APNS_* keys exist.
  app.use('/api/push', require('./push').router);
  // Desktop queue — reads docs/desktop-tasks.md (GitHub raw, checkout as
  // fallback) for the /desktop page. No keys, no store of its own.
  app.use('/api/desktop', require('./desktop').router);
  app.use('/api/shopify', shopify.router);
  app.use('/api/blog', blog.router);
  // Memory Passport (the /selfcare stamps). PUBLIC like the page itself —
  // rate-limited per IP inside the module, since it spends on image gen.
  app.use('/api/selfcare', require('./selfcare').router);
  // Dream Draw — dream text → drawn comic pages (the dream app's "draw it"
  // backend). PUBLIC + rate-limited per IP like /api/selfcare; spends on
  // image gen. Mounted here so movies.js has its keys hydrated.
  app.use('/api/dreamdraw', require('./dreamdraw').router);
  // The dream app's API (page at /dreams). Every route needs a membry ID
  // token — the gate and per-piece visibility are enforced server-side.
  const dreamapp = require('./dreamapp');
  dreamapp.init({ membryAuth: async () => { await storyDb(); return storyApp && storyApp.auth(); } });
  app.use('/api/dreamapp', dreamapp.router);
  // Voice-memo ingest. The Mac holds only the audio; the membry credential and
  // the OpenAI key live here, so the laptop command needs no secrets at all.
  const memos = require('./memos');
  memos.init({
    bucket: async () => { await storyDb(); return storyApp && storyApp.storage().bucket(); },
    transcribe: movies.transcribeAudio,
    chat: openaiChat,
  });
  app.use('/api/memos', memos.router);
  // Journal scans. The master PDF is ~1GB, so the bytes go straight from her
  // Mac to Storage — this only mints the upload session and records the result.
  const journal = require('./journal');
  journal.init({ bucket: async () => { await storyDb(); return storyApp && storyApp.storage().bucket(); }, deckBucket: async () => admin.storage().bucket() });
  app.use('/api/journal', journal.router);

  // The dream archive — every dream from every source, built live so a dream
  // recorded this morning is in it without anyone regenerating a page.
  const dreamArchive = require('./dreamarchive');
  dreamArchive.init({
    deckDb: async () => admin.firestore(),
    membryBucket: async () => { await storyDb(); return storyApp && storyApp.storage().bucket(); },
    deckBucket: async () => admin.storage().bucket(),
  });
  app.use('/api/dream-archive', dreamArchive.router);
  app.use('/api/sync', sync.router);
  app.use('/api/writing', writing.router); // Writing Room (dating-book drafts + review notes)
  app.use('/api/gdrive', gdrive.router); // Google Drive OAuth (read/move/rename/trash)
  app.use('/api/chatfeed', chatfeed.router); // the Chat app (replies from every chat, in one feed)
  app.use('/api/brief', require('./brief').router); // the update button — the five things worth knowing, then the quieter ones
  app.use('/api/review', require('./review').router); // the review queue — every deck/grid page still waiting on her
  app.use('/api/storylink', require('./storylink').router); // one story across Story Timeline, the Story Room and Cutting Blocks
  app.use('/api/googleads', googleads.router); // Google Ads API credential health check
  app.use('/api/character', character.router); // Character Creator (photo + name -> diary-comic ref)
  app.use('/api/tarot-email', tarotEmail.router); // tap-to-reveal Card of the Day email (Brevo)
  app.use('/api/nde', nde.router); // Anthony Chene NDE interview → moments database
  app.use('/api/editor', editor.router); // Episode Editor: transcript spans → snippet cards → rendered audio
  app.use('/api/cutroom', cuttingroom.router); // Cutting Room: mark her own recordings on the transcript — cut pauses, save/send sections
  // Search: one search over BOTH transcript libraries (the interviews in
  // forge-nde-videos + the voice-memo archive), with the hand-offs that turn a
  // hit into work — interview → Episode Editor, memo → Cutting Room.
  app.use('/api/search', require('./search').router);
  app.use('/api/cutmarks', cutmarks.router); // Cut Marks: mark your own cut points on a playhead — video or audio, no transcript
  // Cutting Blocks: the TOP of the audio pipeline — a recording comes apart
  // into sentence-level lines she can split, meld, reorder, respeak and hear
  // as marked before anything is cut for real. Was a hand-authored Compare
  // page (v14) with no server behind it; see docs/audio-pipeline.md.
  app.use('/api/blocks', blocks.router);
  // Pausing: how long a beat sits. The Cutting Room can only REMOVE a pause
  // (compressed to ~0.28s); this sets a length, adds a pause where there is
  // none, builds it out of the recording's own room tone rather than digital
  // silence, and plays HER edit rather than the source. Pause detection is
  // imported from cuttingroom.js, never re-implemented; the edit itself is
  // pause-plan.js, shared with the page. docs/audio-pipeline.md, hole 2.
  app.use('/api/pausing', pausing.router);
  // The audio PROJECT: the light id the rooms thread through their hand-offs
  // (title + who-speaks travel; marks stay room-local — Sophie's pick,
  // 2026-08-19) plus the derive-only /walk lineage resolver. Nothing here
  // spends; see docs/audio-pipeline.md.
  app.use('/api/audioproject', require('./audioproject').router);
  // Chunking: the clip library — every short self-contained piece the app has
  // made (movie scene clips, quick-animates, the chats' own shorts swept out of
  // Storage), searchable, so a re-cut reuses clips instead of re-paying for
  // them. Nothing here generates anything; it is a shelf and a search box.
  app.use('/api/clips', require('./clips').router);
  // Assembly: put library clips in order on a timeline, then bake one film —
  // the arranging step between the Chunking shelf and a finished film. The
  // render is ffmpeg on our own box; nothing here spends money.
  app.use('/api/assembly', require('./assembly').router);
  // Film Editor: Sophie's tap-only phone editor (her Claude Design canvas,
  // docs/film-editor-design/) — the one surface that CUTS video: split, trim
  // in/out, reorder, one audio track. Render is ffmpeg on our own box; free.
  app.use('/api/filmeditor', require('./filmeditor').router);
  app.use('/api/fruit', require('./fruit').router); // favorite-fruit poll: a swipe deck per person → the fridge chart
  // Witch-video pipeline: Theo's ideas → draft cuts → the review room at
  // /witchvideo (tap the video to pause + leave a note; ♥/✕). Notes ring the
  // owning chat's wake doorbell. Nothing here generates or spends.
  app.use('/api/witchvideo', require('./witchvideo').router);
  app.use('/api/opinions', require('./opinions').router); // Opinions: pick between two ideas, GOOD IDEA stamps, streaks — the preloaded decide-on-things game
  // Secretly a Witch membership (Stripe Checkout → entitlement in membry users/{uid}).
  const stripeMod = require('./stripe');
  app.use('/api/stripe', stripeMod.createRouter({
    membryDb: storyDb,                                    // membry-df528 Firestore
    membryAuth: async () => { await storyDb(); return storyApp.auth(); }, // verify witch ID tokens
    // Checkout should return the buyer to the domain they started on — the
    // public site when they came from secretlyawitch.com, Render otherwise.
    appUrl: (req) => (req && isWitchHost(req))
      ? 'https://secretlyawitch.com'
      : (process.env.RENDER_EXTERNAL_URL || 'https://imageforge-q125.onrender.com').replace(/\/$/, ''),
  }));
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
    wallInvalidate();   // a new image must show up on the wall immediately
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
app.get('/test', (req, res) => { res.set('Cache-Control', 'no-cache, must-revalidate'); res.sendFile(__dirname + '/public/test.html'); });

app.get('/book', (req, res) => { res.sendFile(__dirname + '/public/book.html'); });

// The dream app — the shared dream feed Sophie sends to other people. It is a
// STANDALONE public site, deliberately not wired into Deck Factory: the app's
// own Dreams tile is `/dreams` (her private dream illustrator, gated, further
// down this file) and this must never shadow it — an earlier version of this
// route was registered as `/dreams` and did exactly that, sending the app's
// tile to the social feed. Ungated; the sign-in lives in the page.
app.get('/dreamfeed', (req, res) => { res.set('Cache-Control', 'no-cache, must-revalidate'); res.sendFile(__dirname + '/public/dreamapp.html'); });
// A dream-team invite link opens the app on this host too (on the dream
// domain, dream-host.js answers first) — the page joins after sign-in.
// (/f/ personal friend links were pulled — friending happens on a dreamer's
// profile now.)
app.get('/t/:code', (req, res) => { res.set('Cache-Control', 'no-cache, must-revalidate'); res.sendFile(__dirname + '/public/dreamapp.html'); });

// The Lessons — an Imprint-style hub/map of every finished lesson & story
// (public/lessons.html, regenerated by scripts/gen-lessons.js). Ungated; each
// tile opens its lesson (a Compare page). Wrapped by the iOS "Lessons" tile.
app.get('/lessons', (req, res) => { res.set('Cache-Control', 'no-cache, must-revalidate'); res.sendFile(__dirname + '/public/lessons.html'); });

// Sticker Day — the self-care sheet. Public/ungated: nothing leaves the phone,
// the day's progress lives in localStorage.
app.get('/selfcare', (req, res) => { res.sendFile(__dirname + '/public/selfcare.html'); });

// The Medicine Cabinet — the fake-pill commercials, for Sophie's family.
// Public/ungated on purpose: family opens it from a text with no studio token.
app.get('/pills', (req, res) => { res.sendFile(__dirname + '/public/pills.html'); });

// The Screening Room — every film from the commercials chat, lightbox player.
// Public/ungated like /pills; the film list lives in Storage commercials/index.json
// so adding a film is a JSON upload, no deploy.
app.get('/screening', (req, res) => { res.sendFile(__dirname + '/public/screening.html'); });

// The favorite-fruit poll. BOTH pages are PUBLIC and ungated on purpose: /fruit
// is opened from an email by Sophie's family, who have no studio token and
// never will, and the person id in the link is the only identity there is.
// no-cache for the same reason every other page here has it — a cached deck
// would keep showing fruit that has since been re-drawn.
app.get('/fruit', (req, res) => {
  res.set('Cache-Control', 'no-cache, must-revalidate');
  res.sendFile(__dirname + '/public/fruit.html');
});
app.get('/fruitchart', (req, res) => {
  res.set('Cache-Control', 'no-cache, must-revalidate');
  res.sendFile(__dirname + '/public/fruitchart.html');
});

// The witch-video review room. PUBLIC and ungated like /fruit: it is opened
// from a texted link by Sophie's mom, who has no studio token — the
// unguessable who= token in the link IS the identity (fruit.js's pattern).
// Deliberately unlinked: no tile, no iOS wrapper.
app.get('/witchvideo', (req, res) => {
  res.set('Cache-Control', 'no-cache, must-revalidate');
  res.sendFile(__dirname + '/public/witchvideo.html');
});

// Secretly a Witch — the public witchy app (moon/tarot/miracles/conjure).
// Public + ungated; reuses the open /api/generate/* and /api/witch/* endpoints.
app.get('/witch', (req, res) => { res.sendFile(__dirname + '/public/witch.html'); });
// A Witch School lesson has a link of its OWN: /lesson/<key> (e.g.
// /lesson/sync, /lesson/synchronicity) opens that lesson's deck straight away
// — the shareable form of a lesson (Aug 2026, Sophie: "I want to send my
// friend Richard the synchronicity lesson, but there's no direct links to
// anything"). The deck is a full-screen overlay with no URL of its own, so
// there was nothing to send. Serves the same app page on BOTH hosts; the page
// reads the key off the path (and also accepts ?lesson= / #lesson-).
app.get('/lesson/:key', (req, res) => { res.sendFile(__dirname + '/public/witch.html'); });
// Science School — a SEPARATE school, not a course inside the witch one
// (Sophie's decision, docs/science-school/lessons-1-4.md). Same deck engine
// and the same tap-through, its own pastel palette; public + ungated like
// /witch, since nothing here reads or writes anything of hers.
app.get('/science', (req, res) => { res.sendFile(__dirname + '/public/science.html'); });
// Public privacy policy (App Store requires a reachable privacy URL).
app.get('/witch/privacy', (req, res) => { res.sendFile(__dirname + '/public/witch-privacy.html'); });
// Public support page (App Store requires a reachable SUPPORT url too).
app.get('/witch/support', (req, res) => { res.sendFile(__dirname + '/public/witch-support.html'); });
// Support form → Firestore. Open + unauthenticated by design: it's the contact
// route a reviewer or a user has to be able to reach without an account.
app.post('/api/witch/support', express.json(), async (req, res) => {
  try {
    const email = String((req.body || {}).email || '').trim().slice(0, 200);
    const message = String((req.body || {}).message || '').trim().slice(0, 5000);
    if (!email || !message) return res.status(400).json({ error: 'email and message are required' });
    if (!admin.apps.length) return res.status(503).json({ error: 'not configured' });
    await admin.firestore().collection('forge-witch-support').add({
      email, message, handled: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
// `opts.pill` appends the SHARED autoscroll pill — the one implementation
// (scripts/pill.py → public/pill-inject.html) that chatfeed.js already appends
// to every served Compare page. Pages opt in here instead of pasting a copy of
// the pill into their HTML, so it only ever lives in one place; a page that
// generates its own markup (chats/writing/storyroom/wall) keeps importing the
// same source through its gen-*.py script.
function serveGated(file, opts = {}) {
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
    // Always revalidate the HTML. Without this only an ETag ships, and the iOS
    // app's WKWebView happily serves a heuristically-cached copy — so a shipped
    // page change (a moved button, a new tab) silently never reached the phone.
    // no-cache still allows a cheap 304 when nothing changed.
    res.set('Cache-Control', 'no-cache, must-revalidate');
    let out = html.replace('__STUDIO_TOKEN__', STUDIO_TOKEN);
    // ?embed=1 — the page is hosted inside a native tool screen, which already
    // carries the title in its nav bar. Hide the page's own web header: its
    // brand row duplicated the title, and its "← Hub" button navigated the
    // web view to the web hub, stranding her outside the tool with no way back.
    // One rule here covers every gated page (they all share .app-header).
    // The page's own title row goes too, whichever kit it uses: .app-header
    // (forge.css pages) or .tool-eyebrow (tool.css pages). /vector shipped
    // showing "VECTOR" twice — the native bar's title and the page's own —
    // because the class rule for it lived in tool.css behind a body.embed
    // that only studio.html's hand-written JS ever set. Doing BOTH here (the
    // class and the styles) means a new tool page can't forget, and the
    // helpcard's embed offset comes along with the class.
    // THE PAGE OWNS ITS HEADER WHEN THE APP LETS IT (Aug 2026, Sophie: "get rid
    // of the apple native bar"). The newer app hides Apple's bar and injects a
    // bridge, `window.__forgeLeave()`, so the page draws its own title, "?" and
    // back chevron in ONE row instead of a second empty strip under Apple's.
    //
    // THE BRIDGE IS THE FEATURE FLAG. This half ships with a deploy; the app
    // half waits for a TestFlight build — so the page asks whether the bridge
    // is there before taking the header over. On the older build nothing is
    // injected, `embed` is added exactly as before, and there is no double
    // chevron and no missing way out. Both halves can land in either order.
    //
    // The hiding style is scoped to `body.embed` for the same reason: unscoped
    // and `!important`, it would go on hiding the page's own title on the very
    // build that is supposed to show it.
    if (req.query.embed === '1') {
      out += '<style>body.embed .app-header,body.embed .tool-eyebrow'
        + '{display:none !important}</style>'
        + '<script>if(!window.__forgeLeave)document.body.classList.add("embed")</script>';
    }
    // pagehead.js goes on EVERY gated page, not only the ?embed=1 ones: half
    // these tools (Cutting Blocks, Cut Marks, the Cutting Room, Pausing,
    // Playground, Search…) are loaded by their wrapper at a bare path. It
    // self-gates on the bridge, so on the web and on the older build it does
    // nothing at all.
    out += '<script src="/pagehead.js" defer></script>';
    if (opts.pill) out += require('./chatfeed').pillInject();
    res.type('html').send(out);
  };
}
app.get('/studio', serveGated('studio.html', { pill: true }));
// The Dump's sort & label page — browse what the inbox holds, name albums,
// set their track, delete strays. The native Dump tile links here.
app.get('/dump', serveGated('dump.html', { pill: true }));
// Photo → Etsy: turn a photo of a finished handmade item into a reviewable Etsy
// draft (mockups + listing content). Same gate as the Studio.
app.get('/photo', serveGated('photo.html', { pill: true }));
// Song Station: phone recording → cleaned vocal + melody-matched instrumental
// → mixed song (keeps the real voice). Same gate as the Studio.
app.get('/song', serveGated('song.html', { pill: true }));
// Dreams: a faithful web copy of the iOS Dreams screen (write/record a dream →
// chronology check → hand-drawn comic pages → archive + zine), so the design
// can be iterated in the browser without a TestFlight build. Same gate; hits
// the same /api/movies/dream* endpoints.
app.get('/dreams', serveGated('dreams.html', { pill: true }));
// The dream archive — every dream from every source, newest first.
app.get('/dreams-archive', serveGated('dreams-archive.html', { pill: true }));
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
app.get('/films', serveGated('films.html', { pill: true }));
// Shop Report: what's selling / what to promote / what to put on sale, from
// live Etsy listings + orders + reviews. Same gate as the Studio.
app.get('/report', serveGated('report.html', { pill: true }));
// Character Creator: upload a photo + a name -> a diary-comic character
// reference, saved and compiled into a "main characters" sheet. Web prototype
// of the feature that will live in the iOS Story Boards screen.
app.get('/character', serveGated('character.html', { pill: true }));
// Playground: Sophie's LoRA prompt tester (fixed comparable recipe, 4-up
// runs, background jobs on /api/promptlab), iOS tile "Playground"
// (PlaygroundView.swift wraps /playground, same pattern as /writing and
// /editor). /promptlab is the original alias, kept for links already shared.
app.get('/playground', serveGated('promptlab.html', { pill: true }));
app.get('/promptlab', serveGated('promptlab.html', { pill: true }));
// Scratch Pad: stage ONE of a story — hearted Playground images arranged as
// beats with unlabelled color frames (thinking on paper; Story Room is stage
// two). Deliberately minimal; see scratchpad.js.
app.get('/scratchpad', serveGated('scratchpad.html', { pill: true }));
// Freeform: upload your own references, type your own words, pick the quality.
// Nothing is added to the prompt here — that's the whole point of the page.
app.get('/freeform', serveGated('freeform.html', { pill: true }));
// Vector: describe drawings -> art that scales, and change its colours after
// the fact for nothing. The front for /api/vector; see docs/vector-pipeline.md.
app.get('/vector', serveGated('vector.html', { pill: true }));
// Story Timeline: dictated moments -> cards you can order, join into
// sequences, edit, divide and delete. The front for /api/timeline.
app.get('/timeline', serveGated('timeline.html', { pill: true }));
// Update: the update button's page, reached from the Chats app's UPDATE tab.
// Five cards worth knowing about, the quieter ones under them, each carrying
// the pictures that chat made and the Compare pages it posted. It opens on the
// last list she saw (localStorage) and reads only on Refresh — so walking in
// and out of it while triaging costs nothing. Reads /api/brief; writes nothing.
app.get('/brief', serveGated('brief.html', { pill: true }));
// Review Queue: every deck/grid template page still waiting on her, with how
// far through each she is. Reads /api/review; the only write is her own ✕
// ("not a review", a reviewHidden stamp on the page doc).
app.get('/review', serveGated('review.html', { pill: true }));
// Instagram: her accounts drawn as their profile grids — DREAM (the grid
// the dream-app-commercial chat posted, reused exactly: every tile plays that
// film's CURRENT cut), WITCH and PWC — behind one hairline tab each; a new
// account is one row in the JSON and nothing here counts them. Reached from the
// icon at the right of the Chats app's UPDATE tab. Reads
// public/instagram-grids.json and /api/chatfeed/newest; writes nothing, spends
// nothing. Served WITH the pill: three rows of tiles scroll on a phone.
app.get('/instagram', serveGated('instagram.html', { pill: true }));
// Opinions: the decide-on-things game — two ideas side by side, tap the
// better one, GOOD IDEA / BAD IDEA stamps, a streak and accolades. Preloaded
// from opinions-feed.json + /api/opinions extras. Served WITHOUT the pill:
// one screen, the page never scrolls.
app.get('/opinions', serveGated('opinions.html'));
// Desktop queue: the Mac-only tasks chats have batched into
// docs/desktop-tasks.md, and the ones already checked off. Read-only, and
// deliberately UNLINKED — no tile, no wrapper ("somewhere out-of-the-way",
// Sophie, Aug 2026). Served WITHOUT the pill: a list she taps open, not a
// page she reads hands-free.
app.get('/desktop', serveGated('desktop.html', { pill: true }));
// The Sophie character card, for the pad's draw-here toggle (refs/ is not
// web-served, so this one file is exposed deliberately — it's her own
// hearted render, and the page behind the gate is the only thing asking).
app.get('/scratchpad-sophie.png', (req, res) => {
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.type('png').send(fs.readFileSync(path.join(__dirname, 'refs', 'sophie-book.png')));
});
// The old static /story snapshot page is retired (July 2026) — the Story
// Room (/storyroom, live) is the one story surface now.
app.get('/story', (req, res) => res.redirect('/storyroom'));

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
// Same, for audio (voiceover recordings / TTS renders). Buffer variant is
// shared by the upload and TTS paths; the data-URL variant tolerates the
// `;codecs=…` param MediaRecorder puts before base64.
async function saveStoryAudioBuffer(buffer, mime, namePrefix) {
  const sub = ((String(mime).split('/')[1] || 'mp3').split(';')[0] || 'mp3').toLowerCase();
  const ext = sub === 'mpeg' ? 'mp3' : (sub === 'mp4' || sub === 'x-m4a' || sub === 'aac') ? 'm4a' : sub;
  const rand = Math.random().toString(36).slice(2, 8);
  const bucket = storyApp.storage().bucket();
  const file = bucket.file(`story/${namePrefix}-${Date.now()}-${rand}.${ext}`);
  await file.save(buffer, { contentType: String(mime).split(';')[0], resumable: false });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${file.name}`;
}
function parseAudioDataUrl(audio) {
  const m = String(audio || '').match(/^data:(audio\/[^;,]+(?:;codecs=[^;,]+)?);base64,(.+)$/);
  return m ? { buffer: Buffer.from(m[2], 'base64'), mime: m[1] } : null;
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
    const { id, title, cover, order, text } = req.body || {};
    const db = await storyDb();
    if (!db || !storyApp) return res.status(503).json({ error: 'story credential not configured' });
    const col = db.collection('forge-story');
    // A story may start with NO name — Sophie often doesn't know the title
    // until she's into it, so a nameless story is created as "Untitled" and
    // renamed later (POST again with { id, title }).
    let docId = id ? String(id) : (storySlug(title) || 'untitled');
    if (!id) {
      let base = docId, n = 1;
      while ((await col.doc(docId).get()).exists) { n++; docId = base + '-' + n; }
    }
    const ref = col.doc(docId);
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : { id: docId, beats: [] };
    data.id = docId;
    if (title != null && String(title).trim()) data.title = String(title).slice(0, 120);
    else if (!data.title) data.title = 'Untitled';
    if (order != null && order !== '') data.order = Number(order);
    else if (data.order == null) {
      const all = await col.get();
      data.order = all.docs.reduce((mx, d) => Math.max(mx, d.data().order ?? 0), 0) + 1;
    }
    if (cover) {
      const url = await saveStoryImage(cover, `cover-${docId}`);
      if (url) data.cover = url;
    }
    if (text != null) data.text = String(text).slice(0, 60000);
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

// Set / edit a story's prose — the story itself, one doc field, reusable by
// Movies / Storybook / the zine (the old forge-stories library, folded in).
app.post('/api/story/text', express.json({ limit: '1mb' }), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { projectId, text } = req.body || {};
    const db = await storyDb();
    if (!db) return res.status(503).json({ error: 'firebase not configured' });
    const ref = db.collection('forge-story').doc(String(projectId));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'unknown project' });
    const data = doc.data();
    data.text = String(text || '').slice(0, 60000);
    await ref.set(data);
    res.json({ ok: true, chars: data.text.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The description — what the video should be: shots, staging, visual notes.
// Separate from `text` (the story itself) so a video's plan and its prose
// never fight over one field. A description can carry its own recording
// (`descriptionAudio`) — Sophie often TALKS a video plan into Voice Memos,
// and that audio is not the voiceover (which stays the narration take).
app.post('/api/story/description', express.json({ limit: '40mb' }), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { projectId, description, audio, audioUrl } = req.body || {};
    const db = await storyDb();
    if (!db) return res.status(503).json({ error: 'firebase not configured' });
    const ref = db.collection('forge-story').doc(String(projectId));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'unknown project' });
    const data = doc.data();
    if (description !== undefined) data.description = String(description || '').slice(0, 60000);
    if (audio) {
      const parsed = parseAudioDataUrl(audio);
      if (!parsed) return res.status(400).json({ error: 'audio must be a data:audio/* URL' });
      data.descriptionAudio = await saveStoryAudioBuffer(parsed.buffer, parsed.mime, `desc-${projectId}`);
    } else if (audioUrl && /^https?:\/\//.test(String(audioUrl))) {
      // Already-hosted recording (e.g. a memo copied into Storage) — point at
      // it rather than round-tripping megabytes of base64 through the phone.
      data.descriptionAudio = String(audioUrl);
    } else if (audio === null || audioUrl === null) {
      delete data.descriptionAudio;
    }
    await ref.set(data);
    res.json({ ok: true, chars: (data.description || '').length, descriptionAudio: data.descriptionAudio || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The Summary — the shape of the story at a glance: the few key beats that
// carry it, shown at the top of the story page with arrows between them.
// Stored as `summary: [{ beat: <index>, label }]`, kept in beat order.
app.post('/api/story/summary', express.json(), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { projectId, summary } = req.body || {};
    const db = await storyDb();
    if (!db) return res.status(503).json({ error: 'firebase not configured' });
    const ref = db.collection('forge-story').doc(String(projectId));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'unknown project' });
    const data = doc.data();
    const beats = Array.isArray(data.beats) ? data.beats : [];
    data.summary = (Array.isArray(summary) ? summary : [])
      .map((m) => ({ beat: Number(m && m.beat), label: String((m && m.label) || '').slice(0, 120) }))
      .filter((m) => Number.isInteger(m.beat) && m.beat >= 0 && m.beat < beats.length)
      .sort((a, b) => a.beat - b.beat)
      .slice(0, 8);
    await ref.set(data);
    res.json({ ok: true, summary: data.summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Whole-story voiceover: `voiceover: { url, text, status?, error?, source? }`
// — an audio recording and/or its script; either half can be derived (text →
// TTS render, audio → Whisper transcript). Body: { projectId, audio? (data
// URL) | url? (https), text?, tts? (render the script to audio), voice?,
// transcribe? }. Mirrors movie.voiceover so a story's narration can hand
// straight to the film pipeline later. The slow parts (TTS, Whisper) run as
// background jobs recorded on the doc (`voiceover.status`) — clients poll
// GET /api/story; nobody watches a spinner.
app.post('/api/story/voiceover', express.json({ limit: '40mb' }), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { projectId, audio, url, text, tts, voice, transcribe } = req.body || {};
    const db = await storyDb();
    if (!db || !storyApp) return res.status(503).json({ error: 'story credential not configured' });
    const ref = db.collection('forge-story').doc(String(projectId));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'unknown project' });
    const data = doc.data();
    const vo = (data.voiceover && typeof data.voiceover === 'object') ? data.voiceover : {};
    delete vo.error;
    const hadText = Boolean(vo.text);
    if (text != null) vo.text = String(text).slice(0, 20000);

    let newAudio = null;   // { buffer, mime } freshly uploaded this call
    if (audio) {
      newAudio = parseAudioDataUrl(audio);
      if (!newAudio) return res.status(400).json({ error: 'audio must be a data:audio/* URL' });
      vo.url = await saveStoryAudioBuffer(newAudio.buffer, newAudio.mime, `vo-${projectId}`);
      vo.source = 'recording';
    } else if (url && /^https?:\/\//.test(String(url))) {
      vo.url = String(url);
      vo.source = 'recording';
    }

    // What still needs deriving? TTS wants a script and no fresh recording;
    // transcription defaults ON when audio arrives without its words.
    const wantTts = Boolean(tts) && !newAudio && !url;
    if (wantTts && !String(vo.text || '').trim()) {
      return res.status(400).json({ error: 'tts needs voiceover text' });
    }
    const wantTranscribe = Boolean(vo.url) && (newAudio || url)
      && (transcribe === true || (transcribe !== false && !vo.text && !hadText && text == null));

    if (wantTts) vo.status = 'rendering';
    else if (wantTranscribe) vo.status = 'transcribing';
    else delete vo.status;
    data.voiceover = vo;
    await ref.set(data);
    res.json({ ok: true, voiceover: { url: vo.url || null, text: vo.text || '', status: vo.status || null } });

    // ── background: derive the missing half, then update the doc ──
    const finish = async (patch) => {
      try {
        const snap = await ref.get();
        if (!snap.exists) return;
        const d = snap.data();
        d.voiceover = { ...(d.voiceover || {}), ...patch };
        delete d.voiceover.status;
        if (!patch.error) delete d.voiceover.error;
        await ref.set(d);
      } catch (e) { console.error('story voiceover update failed:', e.message); }
    };
    // A pasted/uploaded RECORDING also files into the Voice Memo archive (one
    // library, Aug 2026) — md5-deduped there, so a memo that already arrived
    // another way lands once. TTS renders are not memos and stay out. Reuses
    // the transcript when this call produced one, so Whisper runs once.
    const fileMemoCopy = async (buffer, transcript, duration, mime) => {
      try {
        const sub = ((String(mime || (newAudio && newAudio.mime) || '').split('/')[1] || 'm4a').split(';')[0] || 'm4a');
        const r = await require('./memos').fileIntoArchive({
          buf: buffer,
          ext: sub === 'mpeg' ? 'mp3' : (sub === 'mp4' || sub === 'x-m4a' || sub === 'aac') ? 'm4a' : sub,
          title: data.title || `Story voiceover ${projectId}`,
          dur: duration, transcript, source: 'story-voiceover',
        });
        if (r.memo && r.memo.id) {
          await ref.set({ voiceover: { memoId: r.memo.id } }, { merge: true }).catch(() => {});
        }
      } catch (e) { console.warn('voiceover memo filing failed:', e.message); }
    };
    if (wantTts) {
      (async () => {
        try {
          const buf = await storyTts(String(vo.text), String(voice || 'nova'));
          const pub = await saveStoryAudioBuffer(buf, 'audio/mpeg', `vo-tts-${projectId}`);
          await finish({ url: pub, source: 'tts' });
        } catch (e) { await finish({ error: 'TTS failed: ' + e.message }); }
      })();
    } else if (wantTranscribe) {
      (async () => {
        let buffer = newAudio && newAudio.buffer, mime = newAudio && newAudio.mime;
        try {
          if (!buffer) {
            const r = await fetch(vo.url);
            if (!r.ok) throw new Error('audio fetch ' + r.status);
            buffer = await r.buffer();
            mime = r.headers.get('content-type') || '';
          }
        } catch (e) { return finish({ error: 'transcription failed: ' + e.message }); }
        let words = null, duration = null;
        try {
          const { transcribeAudio } = require('./movies');
          const sub = ((String(mime).split('/')[1] || 'm4a').split(';')[0] || 'm4a');
          const ext = sub === 'mpeg' ? 'mp3' : (sub === 'mp4' || sub === 'x-m4a' || sub === 'aac') ? 'm4a' : sub;
          const t = await transcribeAudio(buffer, 'voiceover.' + ext);
          words = t.text; duration = t.duration;
          await finish({ text: t.text, duration: t.duration });
        } catch (e) { await finish({ error: 'transcription failed: ' + e.message }); }
        // Archive the recording either way — a Whisper blip must not lose it
        // (fileIntoArchive will retry the words itself when passed none).
        await fileMemoCopy(buffer, words, duration, mime);
      })();
    } else if (newAudio || url) {
      // Recording arrived with its words already known (or transcription was
      // explicitly declined) — still belongs in the archive.
      (async () => {
        try {
          let buffer = newAudio && newAudio.buffer;
          if (!buffer) {
            const r = await fetch(vo.url);
            if (!r.ok) throw new Error('audio fetch ' + r.status);
            buffer = await r.buffer();
          }
          await fileMemoCopy(buffer, vo.text || null, null);
        } catch (e) { console.warn('voiceover memo filing failed:', e.message); }
      })();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TTS for a story voiceover: same chunk-at-sentence + ffmpeg-concat pattern
// as the Chats app's Play button (chatfeed.js /polish) — one OpenAI call per
// ≤3200-char chunk so long narrations aren't silently truncated at the
// API's 4096 cap.
async function storyTts(text, voice) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const clean = String(text).trim().slice(0, 16000);
  const sentences = clean.replace(/\n+/g, ' ').match(/[^.!?…]+[.!?…]+["”']?\s*/g) || [clean];
  const chunks = []; let cur = '';
  for (const s of sentences) {
    if (cur && (cur + s).length > 3200) { chunks.push(cur.trim()); cur = ''; }
    cur += s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  const bufs = [];
  for (const chunk of chunks) {
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts', voice, input: chunk,
        instructions: 'Narrate warmly and naturally, like reading a storybook aloud — unhurried, gentle.',
      }),
    });
    if (!r.ok) throw new Error('tts ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 150));
    bufs.push(Buffer.from(await r.arrayBuffer()));
  }
  if (bufs.length === 1) return bufs[0];
  const os = require('os');
  const { spawn } = require('child_process');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'storyvo-'));
  try {
    const files = bufs.map((b, i) => { const f = path.join(tmp, `c${i}.mp3`); fs.writeFileSync(f, b); return f; });
    const listFile = path.join(tmp, 'list.txt');
    fs.writeFileSync(listFile, files.map((f) => `file '${f}'`).join('\n'));
    const mp3 = path.join(tmp, 'out.mp3');
    const ffmpeg = process.env.FFMPEG_PATH || require('ffmpeg-static');
    await new Promise((resolve, reject) => {
      const p = spawn(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', mp3]);
      let err = ''; p.stderr.on('data', (c) => err += c);
      p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg: ' + err.slice(-200)))));
    });
    return fs.readFileSync(mp3);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ── Draft film: a story's beat art auto-cut into a watchable rough film ──
// (Sophie, Aug 2026: opening a story should show the most immediate draft of
// its film, even if it's not perfect — if all that exists is images, cut them
// with ffmpeg, over the voiceover when there is one, just the images when not.)
// One image per beat — best card by status (approved > candidate > draft, the
// same pick the page's summary art uses) — timed evenly across the voiceover
// (else 2.8s each), stitched to a 1000x1400 (5:7, the shelf's cover ratio)
// h264 mp4 and saved to the boards' Storage. Stored on the doc as
// `draftFilm: { url, at, seconds, art:[urls], voUrl, status?, error? }` — a
// background job on the doc (house rule); the page polls GET /api/story.
// `art`/`voUrl` fingerprint what the film was cut from, so the page can tell
// a stale draft from a current one without re-stitching on every open.
function draftFilmArt(data) {
  const NORM = { approved: 'ok', candidate: 'cand', storyboard: 'draft', 'no art yet': 'miss' };
  const urls = [];
  (data.beats || []).forEach((b) => {
    const cs = (b && b.cards) || [];
    let pick = '';
    for (const want of ['ok', 'cand', 'draft']) {
      const hit = cs.find((c) => c && c.url && (NORM[c.status] || c.status) === want);
      if (hit) { pick = hit.url; break; }
    }
    if (!pick) { const any = cs.find((c) => c && c.url); if (any) pick = any.url; }
    if (pick) urls.push(pick);
  });
  return urls;
}
const DRAFT_FILM_STALE_MS = 15 * 60 * 1000;   // a stitch job older than this is dead
app.post('/api/story/draft-film', express.json(), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { projectId, force } = req.body || {};
    const db = await storyDb();
    if (!db || !storyApp) return res.status(503).json({ error: 'story credential not configured' });
    const ref = db.collection('forge-story').doc(String(projectId));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'unknown project' });
    const data = doc.data();
    const art = draftFilmArt(data);
    if (!art.length) return res.status(400).json({ error: 'no art on the beats yet' });
    const prev = (data.draftFilm && typeof data.draftFilm === 'object') ? data.draftFilm : {};
    const running = prev.status === 'stitching'
      && prev.statusAt && (Date.now() - new Date(prev.statusAt).getTime()) < DRAFT_FILM_STALE_MS;
    if (running && !force) return res.json({ ok: true, draftFilm: prev, running: true });
    const voUrl = (data.voiceover && data.voiceover.url) || '';
    // keep the previous url so the page can show the old cut while the new
    // one stitches; art/voUrl stay the OLD film's until the job lands
    data.draftFilm = { ...prev, status: 'stitching', statusAt: new Date().toISOString() };
    delete data.draftFilm.error;
    await ref.set(data);
    res.json({ ok: true, draftFilm: data.draftFilm });

    // ── background: download art (+ voiceover), stitch, upload, patch doc ──
    const finish = async (patch) => {
      try {
        const snap = await ref.get();
        if (!snap.exists) return;
        const d = snap.data();
        d.draftFilm = { ...(d.draftFilm || {}), ...patch };
        delete d.draftFilm.status; delete d.draftFilm.statusAt;
        if (!patch.error) delete d.draftFilm.error;
        await ref.set(d);
      } catch (e) { console.error('draft film update failed:', e.message); }
    };
    (async () => {
      const os = require('os');
      const { spawn } = require('child_process');
      const ffmpeg = process.env.FFMPEG_PATH || require('ffmpeg-static');
      const ffprobe = process.env.FFPROBE_PATH || require('ffprobe-static').path;
      const run = (bin, args) => new Promise((resolve, reject) => {
        const p = spawn(bin, args);
        let out = '', err = '';
        p.stdout.on('data', (c) => out += c); p.stderr.on('data', (c) => err += c);
        p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(path.basename(bin) + ': ' + err.slice(-300)))));
      });
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'draftfilm-'));
      try {
        const imgs = [];
        for (let i = 0; i < art.length; i++) {
          const r = await fetch(art[i]);
          if (!r.ok) throw new Error('art fetch ' + r.status);
          const f = path.join(tmp, 'img' + i);
          fs.writeFileSync(f, await r.buffer());
          imgs.push(f);
        }
        let audioFile = null, audioDur = 0;
        if (voUrl) {
          const r = await fetch(voUrl);
          if (r.ok) {
            audioFile = path.join(tmp, 'vo');
            fs.writeFileSync(audioFile, await r.buffer());
            const probed = await run(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', audioFile]).catch(() => '');
            audioDur = parseFloat(probed) || 0;
            if (!audioDur) { audioFile = null; }
          }
        }
        // evenly across the narration when there is one; 2.8s a picture when not
        const per = audioDur ? Math.max(1.2, audioDur / imgs.length) : 2.8;
        const segs = [];
        for (let i = 0; i < imgs.length; i++) {
          const seg = path.join(tmp, 'seg' + i + '.mp4');
          await run(ffmpeg, ['-y', '-loop', '1', '-t', per.toFixed(3), '-i', imgs[i],
            '-vf', 'scale=1000:1400:force_original_aspect_ratio=decrease,pad=1000:1400:(ow-iw)/2:(oh-ih)/2:color=#141210,fps=24,format=yuv420p',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-an', seg]);
          segs.push(seg);
        }
        const listFile = path.join(tmp, 'list.txt');
        fs.writeFileSync(listFile, segs.map((f) => `file '${f}'`).join('\n'));
        const silent = path.join(tmp, 'silent.mp4');
        await run(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', silent]);
        let outFile = silent;
        if (audioFile) {
          outFile = path.join(tmp, 'out.mp4');
          await run(ffmpeg, ['-y', '-i', silent, '-i', audioFile,
            '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', outFile]);
        }
        const bucket = storyApp.storage().bucket();
        const dest = bucket.file(`story/draft-film-${projectId}-${Date.now()}.mp4`);
        // streamed from disk, never fs.readFileSync — Render free has 512MB total
        await bucket.upload(outFile, { destination: dest.name, metadata: { contentType: 'video/mp4' }, resumable: false });
        await dest.makePublic();
        await finish({
          url: `https://storage.googleapis.com/${bucket.name}/${dest.name}`,
          at: new Date().toISOString(),
          seconds: Math.round(per * imgs.length),
          art, voUrl,
        });
      } catch (e) {
        await finish({ error: 'stitch failed: ' + e.message });
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Journal scans (JournalReader) ───────────────────────────────────────────
// POST /api/journal/upload-file?filename= — ONE journal PDF as the raw body,
// stored PRIVATE in membry Storage at journal-scans/<name> — the shelf the
// journal extraction pipeline reads, the same one the app's own "Send
// journals to Claude" picker fills — plus the manifest.json index merged the
// way the app merges it (newest record per filename wins). This is the share
// extension's way in ("Send to JournalReader" from Genius Scan / Files): the
// extension stays a plain HTTP client — no Firebase SDK, no per-extension
// auth — because the server's membry credential does the write. NEVER
// makePublic here: these are her private journals.
const JOURNAL_FOLDER = 'journal-scans';
function journalMonthGuess(name) {
  const n = String(name).toLowerCase();
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
    'august', 'september', 'october', 'november', 'december'];
  return months.find((m) => n.includes(m) || n.includes(m.slice(0, 3))) || null;
}
app.post('/api/journal/upload-file', express.raw({ type: () => true, limit: '120mb' }), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    if (!req.body || !req.body.length) {
      return res.status(400).json({ error: 'empty body — POST the file as the request body' });
    }
    const db = await storyDb();   // initializes storyApp (membry) when configured
    if (!db || !storyApp) return res.status(503).json({ error: 'story credential not configured' });
    const name = String(req.query.filename || '').replace(/[/\\]/g, '_').trim()
      || ('scan-' + Date.now() + '.pdf');
    const bucket = storyApp.storage().bucket();
    const mf = bucket.file(`${JOURNAL_FOLDER}/manifest.json`);

    // Two dedupe rules together (Aug 2026): same NAME overwrites (a re-export
    // replaces its older self), same BYTES under a different name is skipped
    // (the exact file can't land twice). Hashing is free — md5 of the body
    // here, and GCS already keeps an md5 on every stored object, so records
    // that predate the hash field heal from object metadata, no downloads.
    const hash = require('crypto').createHash('md5').update(req.body).digest('hex');
    const all = {};
    try {
      const [buf] = await mf.download();
      JSON.parse(buf.toString('utf8')).forEach((r) => { if (r && r.name) all[r.name] = r; });
    } catch (e) { /* first scan ever — start a fresh index */ }
    let healed = false;
    for (const r of Object.values(all)) {
      if (r.hash) continue;
      try {
        const [meta] = await bucket.file(`${JOURNAL_FOLDER}/${r.name}`).getMetadata();
        if (meta.md5Hash) { r.hash = Buffer.from(meta.md5Hash, 'base64').toString('hex'); healed = true; }
      } catch (e) { /* object missing — leave the record unhashed */ }
    }
    const dup = Object.values(all).find((r) => r.hash === hash);
    if (dup) {
      // keep any healing we just learned, then answer without storing twice
      if (healed) {
        const merged = Object.values(all).sort((a, b) => String(a.name).localeCompare(String(b.name)));
        await mf.save(Buffer.from(JSON.stringify(merged)), { contentType: 'application/json', resumable: false }).catch(() => {});
      }
      return res.json({ ok: true, duplicate: true, name: dup.name, size: dup.size });
    }

    await bucket.file(`${JOURNAL_FOLDER}/${name}`).save(req.body, {
      contentType: req.get('content-type') || 'application/pdf', resumable: false,
    });
    // Manifest merge, matching the app's JournalScanRecord shape (the app's
    // decoder ignores the extra hash field): newest wins by name.
    all[name] = {
      month: journalMonthGuess(name), name, size: req.body.length,
      url: '', uploadedAt: Date.now() / 1000, hash,
    };
    try {
      const merged = Object.values(all).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      await mf.save(Buffer.from(JSON.stringify(merged)), { contentType: 'application/json', resumable: false });
    } catch (e) { console.error('journal manifest merge failed:', e.message); }
    res.json({ ok: true, name, size: req.body.length });

    // ── background: a COVER for the shelf — page 1 rendered at ~500px wide,
    // true aspect, stored PRIVATE beside the scans (mupdf WASM, no native
    // deps). Bodies over 40MB skip the render (memory on the free instance);
    // a chat backfills those with `node scripts/journal-thumbs.js`.
    if (req.body.length <= 40 * 1024 * 1024) {
      const body = req.body;
      (async () => {
        try {
          const mupdf = await import('mupdf');
          const doc = mupdf.Document.openDocument(body, 'application/pdf');
          const page = doc.loadPage(0);
          const b = page.getBounds();
          const zoom = 500 / Math.max(1, b[2] - b[0]);
          const pix = page.toPixmap(mupdf.Matrix.scale(zoom, zoom), mupdf.ColorSpace.DeviceRGB, false, true);
          await bucket.file(`${JOURNAL_FOLDER}/thumbs/${name}.png`).save(Buffer.from(pix.asPNG()), {
            contentType: 'image/png', resumable: false,
          });
        } catch (e) { console.error('journal thumb failed:', e.message); }
      })();
    }
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
// THE THUMB GENERATOR IS GATED, DEDUPED AND REMEMBERS ITS FAILURES
// (2026-08-25, read straight off the Render logs the night the box kept
// OOM-restarting: every kill sat seconds after a burst of `thumb failed`
// lines while her phone loaded a grid). The old path ran ONE generation per
// request with no limit: forty tiles asking at once meant forty full
// originals buffered (3-12MB each) and forty sharp decodes in parallel —
// past 512MB on their own. And a FAILED thumb (a 403'd source, a HEIC sharp
// can't read) was never remembered, so every repaint of the same grid
// re-downloaded and re-failed the same images. Now: at most TWO generations
// at a time process-wide (`thumbSlot`), one in-flight promise per url so a
// burst of tiles asking for the same picture costs one download
// (`thumbBusy`), a failure is remembered for 10 minutes and answered with
// the original instead of a retry (`thumbBad`), an over-20MB source is
// refused (a thumb of it is not worth the decode on this box), and when the
// queue is deep the route just serves the original — a slow tile, never a
// dead site.
const thumbBad = new Map(); // url|w → retry-after ms epoch
const thumbBusy = new Map(); // url|w → in-flight promise
let thumbActive = 0; const thumbWaiters = [];
const THUMB_CONCURRENCY = 2;
function thumbSlot() {
  if (thumbActive < THUMB_CONCURRENCY) { thumbActive++; return Promise.resolve(); }
  return new Promise((r) => thumbWaiters.push(r));
}
function thumbDone() {
  const next = thumbWaiters.shift();
  if (next) next(); else thumbActive--;
}
async function makeThumb(url, w) {
  const key = url + '|' + w;
  if (thumbHot.has(key)) return thumbHot.get(key);
  const badUntil = thumbBad.get(key);
  if (badUntil && badUntil > Date.now()) throw new Error('recently failed — serving the original');
  if (thumbBusy.has(key)) return thumbBusy.get(key);
  const job = (async () => {
    const bucket = admin.storage().bucket();
    const file = bucket.file(thumbName(url, w));
    const [exists] = await file.exists();
    if (!exists) {
      await thumbSlot();
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error('fetch ' + r.status);
        const len = Number(r.headers.get('content-length') || 0);
        if (len > 20 * 1048576) throw new Error(`source too big to thumb (${Math.round(len / 1048576)}MB)`);
        const out = await require('sharp')(await r.buffer())
          .resize({ width: w, withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer();
        await file.save(out, { contentType: 'image/webp', resumable: false });
        await file.makePublic();
      } finally { thumbDone(); }
    }
    const pub = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
    thumbHot.set(key, pub);
    return pub;
  })();
  thumbBusy.set(key, job);
  try {
    return await job;
  } catch (e) {
    thumbBad.set(key, Date.now() + 10 * 60 * 1000);
    throw e;
  } finally {
    thumbBusy.delete(key);
  }
}
// Background warmer: pre-makes missing thumbs right after an assets-list
// request (a few at a time), so tiles get direct storage URLs on the next
// load instead of bouncing through this server one image at a time.
const thumbWarmQ = []; const thumbWarmSeen = new Set(); let thumbWarmActive = 0;
// Named in every memwatch snapshot, so a leak here can't hide (see memwatch.js).
memwatch.gauge('thumbHot', () => thumbHot.size);
memwatch.gauge('thumbBad', () => thumbBad.size);
memwatch.gauge('thumbWarmSeen', () => thumbWarmSeen.size);
memwatch.gauge('thumbWarmQ', () => thumbWarmQ.length);

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
    // Overloaded? Serve the original rather than queueing another decode —
    // a slow tile beats an OOM'd server (see the gate above).
    if (!thumbHot.has(url + '|' + w) && thumbWaiters.length > 12) return res.redirect(302, url);
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
// An image can reach a chat's Assets twice — once as a link in the reply, once
// as the inline picture Sophie was sent — so both a canonical URL (query/hash
// stripped) and a sha256 of the decoded bytes identify an asset. Either match
// inside the same chat means "already filed": update the description, never
// add a second tile.
const assetDescription = (d) => String(d == null ? '' : d).trim().slice(0, 300);
function canonicalAssetUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  return s.split('#')[0].split('?')[0];
}
// Hash a hosted image's bytes so a later INLINE post of the same picture lands
// on this asset instead of a second tile (a link post carries no bytes of its
// own). Best-effort: a slow, huge or unreachable image is left un-hashed rather
// than blocking the filing.
async function hashRemoteImage(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length || buf.length > 25e6) return null;
    return require('crypto').createHash('sha256').update(buf).digest('hex');
  } catch (e) { return null; }
}
// Find this chat's existing asset record by content hash or canonical URL.
// Equality-only queries merge single-field indexes, so no composite index.
async function findChatAsset(chat, { hash, url } = {}) {
  if (!chat || !admin.apps.length) return null;
  const col = admin.firestore().collection('forge-chat-assets');
  const tries = [];
  if (hash) tries.push(col.where('chat', '==', chat).where('hash', '==', hash));
  if (url) tries.push(col.where('chat', '==', chat).where('url', '==', url));
  const key = canonicalAssetUrl(url);
  if (key && key !== url) tries.push(col.where('chat', '==', chat).where('urlKey', '==', key));
  for (const q of tries) {
    try {
      const snap = await q.limit(1).get();
      if (!snap.empty) return snap.docs[0];
    } catch (e) { /* a lookup failing must never block filing */ }
  }
  return null;
}
// Audio assets (Aug 2026): the Assets tab holds sound too. An asset is audio
// when the chat filing it says so (kind:'audio') or its url plainly is.
// ONE copy of that rule, shared with the union below.
const assetUnion = require('./asset-union');
const AUDIO_URL_RE = assetUnion.AUDIO_URL_RE;
const pageTemplates = require('./page-templates');

// ─── The content hash that keeps one picture on one tile ─────────────
// A picture filed twice under two filenames (its storage object, and the
// claude-deliveries copy the hook makes when the same image is also sent as a
// chat FILE) used to land as two tiles — the labeled original and an unlabeled
// twin, because the Assets tab could only join copies by filename. So every
// filing now records the Storage object's own md5, read from its METADATA:
// no bytes are downloaded, and `GET /api/gallery/assets` joins on it (see
// asset-union.js). Best-effort throughout — an external url, a missing object
// or a slow metadata call files exactly as before, with no `md5`.
const assetHash = require('./asset-hash');
const assetMd5Cache = new Map();
// The same picture can live in EITHER project's bucket (deckfactory-43176 or
// membry-df528) and a credential for one cannot read the other, so the bucket
// named in the url picks the app — never whichever app happens to be handy.
async function bucketNamed(name) {
  if (!name) return null;
  const apps = [];
  if (admin.apps.length) apps.push(admin.app());
  if (!storyApp && process.env.STORY_FIREBASE_SERVICE_ACCOUNT) {
    try { await storyDb(); } catch (e) { /* membry stays unavailable */ }
  }
  if (storyApp) apps.push(storyApp);
  for (const app of apps) {
    try { const b = app.storage().bucket(); if (b && b.name === name) return b; } catch (e) { /* no bucket */ }
  }
  // Older objects sit in the same project's `<id>.appspot.com` bucket rather
  // than `<id>.firebasestorage.app`; the project prefix still identifies the
  // credential that can read it.
  const project = String(name).split('.')[0];
  for (const app of apps) {
    try {
      const b = app.storage().bucket();
      if (b && String(b.name).split('.')[0] === project) return app.storage().bucket(name);
    } catch (e) { /* not this app's project */ }
  }
  return null;
}
const assetMd5 = (url) => assetHash.readMd5(url, bucketNamed, { cache: assetMd5Cache });

// ─── The guard on the hook's background catches ──────────────────────
// The Stop hook's second scan files every Firebase url that merely PASSED
// THROUGH a turn's tool calls, so an image a chat only looked at lands in that
// chat's Assets tab unlabeled. asset-guard.js holds the whole decision (and
// the reasoning); this is the one query it needs — every record already filed
// at this url, and, only when that misses, at these same bytes. Both are
// single-field equality queries, so no composite index. Best-effort: a lookup
// that fails must never block a filing.
const assetGuard = require('./asset-guard');
async function assetsFiledAt(url, md5) {
  const col = admin.firestore().collection('forge-chat-assets');
  const out = [];
  const collect = async (q) => {
    try {
      const snap = await q.limit(20).get();
      snap.forEach((d) => out.push({ chat: d.get('chat'), description: d.get('description') }));
    } catch (e) { /* a guard lookup failing must never block filing */ }
  };
  await collect(col.where('url', '==', url));
  // A renamed copy of a labeled deliverable can't be found by url. The md5 is
  // read on this path anyway (it goes on the new doc), so this costs one more
  // Firestore query and NO extra Storage read — and only when the url missed.
  if (md5 && !out.some((r) => String(r.description || '').trim())) {
    await collect(col.where('md5', '==', md5));
  }
  return out;
}
// Rule 3's lookup: the Dump photo behind a `drops/…` url. asset-guard says
// WHICH field finds it — the content address in the filename for today's
// layout, the url itself for the pre-2026-07-28 one — and either way it is one
// equality query. A miss is fine; the label just falls back.
async function dumpRecordFor(url) {
  const look = assetGuard.dumpLookup(url);
  if (!look) return null;
  try {
    const snap = await admin.firestore().collection('forge-drops')
      .where(look.by, '==', look.value).limit(1).get();
    return snap.empty ? null : snap.docs[0].data();
  } catch (e) { return null; }
}
app.post('/api/gallery', express.json({ limit: '14mb' }), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { url, image, prompt, created, style, type, dry, chat, assetsOnly, session, explicit,
      fullPrompt, promptPrefix, promptSuffix } = req.body || {};
    const createdMs = Number(created) || Date.now();
    const description = assetDescription(req.body && req.body.description);
    let chatName = chat ? String(chat).slice(0, 60) : '';
    // Same session-first routing as the chat feed: the hook sends its session
    // id so an image files into the chat that SESSION owns, even when the
    // hook's cached slug is stale (and merged chats' tombstones redirect).
    // Best-effort — a resolution hiccup must never block a filing.
    if (chatName && admin.apps.length) {
      try {
        const cf = require('./chatfeed');
        chatName = explicit
          ? await cf.followMoves(chatName)
          : await cf.resolveChat(chatName, String(session || '').slice(0, 120));
      } catch (e) { /* keep the name the hook sent */ }
    }
    // assetsOnly: a work-in-progress image caught behind the scenes — file it to
    // the chat's Assets tab (forge-chat-assets, deckfactory) ONLY, never the main
    // "My Creations" gallery, so that stays curated to finished deliverables.
    // Needs a hosted URL + a chat + the deckfactory admin app (no membry upload).
    if (assetsOnly) {
      if (dry) return res.json({ ok: true, dry: true, assetsOnly: true });
      const wipUrl = url && /^https:\/\/(storage|firebasestorage)\.googleapis\.com\//.test(String(url))
        ? String(url) : null;
      if (!wipUrl) return res.status(400).json({ error: 'assetsOnly requires a hosted url' });
      if (!chatName || !admin.apps.length) return res.json({ ok: true, skipped: 'no chat/admin' });
      const kind = (req.body.kind === 'audio' || AUDIO_URL_RE.test(wipUrl)) ? 'audio' : '';
      const acol = admin.firestore().collection('forge-chat-assets');
      const existing = await findChatAsset(chatName, { url: wipUrl });
      if (existing) {
        // A curated caption (e.g. "gpt-image-2 · medium") or a description may
        // arrive after the hook's generic record — upgrade the existing doc in
        // place instead of silently dropping it.
        const patch = {};
        // What a later filing may do to the caption already on the record —
        // ONE rule, shared with the sweep's own reasoning (asset-guard.js).
        // A curated caption may CORRECT another curated one; the hook's
        // generic "from <chat>" line never overwrites anything.
        const nextCap = assetGuard.captionUpgrade(existing.data().prompt, prompt);
        if (nextCap) patch.prompt = nextCap.slice(0, 500);
        if (description && description !== existing.data().description) patch.description = description;
        if (kind && !existing.data().kind) patch.kind = kind;
        // An older record filed before content-joining existed: give it its
        // md5 now, so it can collapse with the copy that arrives under a
        // different filename.
        if (!existing.data().md5) {
          const md5 = await assetMd5(wipUrl);
          if (md5) patch.md5 = md5;
        }
        if (Object.keys(patch).length) {
          await existing.ref.update(patch);
          // a MODEL · QUALITY caption is one of the variables the auto-compare
          // pages group on — filing one re-plans them (debounced, chatfeed.js)
          if (patch.prompt) require('./chatfeed').autoComparePoke(chatName);
          return res.json({ ok: true, updated: true, deduped: true, url: wipUrl, description: description || existing.data().description || '' });
        }
        return res.json({ ok: true, deduped: true, url: wipUrl, description: existing.data().description || '' });
      }
      // Nothing is filed at this url in this chat yet, so this POST would
      // CREATE a tile — the one moment the guard gets to speak. A prose
      // delivery never reaches here (it has no assetsOnly), and a filing that
      // carries a label or a curated caption is deliberate and always allowed;
      // see asset-guard.js for the rules and what they deliberately don't do.
      const filing = { chat: chatName, url: wipUrl, wip: true, description, prompt };
      let wipMd5 = null;
      if (assetGuard.needsDumpRecord(filing)) {
        filing.dump = await dumpRecordFor(wipUrl);          // Rule 3: name its album
      } else if (assetGuard.needsElsewhereQuery(filing)) {
        wipMd5 = await assetMd5(wipUrl);            // needed for the doc below anyway
        filing.others = await assetsFiledAt(wipUrl, wipMd5);
      }
      const verdict = assetGuard.guardFiling(filing);
      if (verdict.block) {
        // ok:true on purpose — the hook ignores the response, and a refusal is
        // not an error. The marker is what makes the behaviour observable.
        return res.json({ ok: true, skipped: verdict.reason, url: wipUrl });
      }
      // Rule 3's auto-label, never over a description the caller sent.
      const autoDescription = (!description && verdict.description) ? verdict.description : '';
      const wipDoc = {
        chat: chatName, url: wipUrl, urlKey: canonicalAssetUrl(wipUrl),
        prompt: String(prompt || '').slice(0, 500),
        created: new Date(createdMs).toISOString(), wip: true,
      };
      if (wipMd5 === null) wipMd5 = await assetMd5(wipUrl);
      if (wipMd5) wipDoc.md5 = wipMd5;
      if (kind) wipDoc.kind = kind;
      if (description || autoDescription) wipDoc.description = description || autoDescription;
      await acol.add(wipDoc);
      const curatedCap = String(prompt || '').trim();
      if (curatedCap && !/^from /.test(curatedCap)) {
        require('./chatfeed').autoComparePoke(chatName);
      }
      return res.json({
        ok: true, assetsOnly: true, url: wipUrl,
        description: description || autoDescription,
        ...(autoDescription ? { autoLabeled: verdict.reason } : {}),
      });
    }
    await storyDb();
    if (!storyApp) return res.status(503).json({ error: 'membry credential not configured' });
    const uid = await galleryUid();
    if (dry) return res.json({ ok: true, dry: true, uid: uid.slice(0, 6) + '…' });
    let finalUrl = url && /^https:\/\/(storage|firebasestorage)\.googleapis\.com\//.test(String(url))
      ? String(url) : null;
    let bytesHash = null;
    let assetDoc = null;
    if (!finalUrl && image) {
      const m = String(image).match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
      if (!m) return res.status(400).json({ error: 'image must be a data URL' });
      const buf = Buffer.from(m[2], 'base64');
      bytesHash = require('crypto').createHash('sha256').update(buf).digest('hex');
      // Same bytes already filed for this chat (e.g. posted as a link earlier)?
      // Reuse that image instead of uploading a second copy of it.
      assetDoc = await findChatAsset(chatName, { hash: bytesHash });
      if (assetDoc) {
        finalUrl = assetDoc.data().url;
      } else {
        const ext = m[1].split('/')[1].split(';')[0].replace('jpeg', 'jpg');
        const bucket = storyApp.storage().bucket();
        const f = bucket.file(`claude-deliveries/${createdMs}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
        await f.save(buf, { contentType: m[1], resumable: false });
        await f.makePublic();
        finalUrl = `https://storage.googleapis.com/${bucket.name}/${f.name}`;
      }
    }
    if (!finalUrl) return res.status(400).json({ error: 'url (Firebase Storage) or image (data URL) required' });
    // Per-chat asset record (deckfactory, where forge-chat-* live) — powers the
    // Assets tab inside each chat. Independent of the iOS-gallery de-dupe below.
    let assetDeduped = false;
    if (chatName && admin.apps.length) {
      try {
        const acol = admin.firestore().collection('forge-chat-assets');
        if (!assetDoc) assetDoc = await findChatAsset(chatName, { hash: bytesHash, url: finalUrl });
        if (!assetDoc && !bytesHash) {
          // A link post the chat hasn't filed before: hash what it points at, so
          // the same picture arriving inline later converges here.
          bytesHash = await hashRemoteImage(finalUrl);
          if (bytesHash) assetDoc = await findChatAsset(chatName, { hash: bytesHash });
          // Identical bytes are literally the same picture, so keep the copy
          // already on file rather than adding a second one to the gallery too.
          if (assetDoc) finalUrl = assetDoc.data().url;
        }
        if (assetDoc) {
          assetDeduped = true;
          // Converge: a later post may carry the description (or the content
          // hash) the first one lacked — fill those in, never a second tile.
          const cur = assetDoc.data();
          const patch = {};
          if (description && description !== cur.description) patch.description = description;
          if (bytesHash && !cur.hash) patch.hash = bytesHash;
          if (!cur.urlKey) patch.urlKey = canonicalAssetUrl(cur.url);
          if (cur.wip) patch.wip = false;   // it's a finished deliverable now
          if (!cur.md5) {
            const md5 = await assetMd5(cur.url || finalUrl);
            if (md5) patch.md5 = md5;
          }
          if (Object.keys(patch).length) await assetDoc.ref.update(patch);
        } else {
          const aDoc = {
            chat: chatName, url: finalUrl, urlKey: canonicalAssetUrl(finalUrl),
            prompt: String(prompt || '').slice(0, 500),
            created: new Date(createdMs).toISOString(),
          };
          if (description) aDoc.description = description;
          if (bytesHash) aDoc.hash = bytesHash;
          // The Storage object's own md5 (metadata only, no download) — what
          // lets this record collapse with the same bytes filed under any
          // other filename. See asset-union.js.
          const md5 = await assetMd5(finalUrl);
          if (md5) aDoc.md5 = md5;
          await acol.add(aDoc);
        }
      } catch (e) { /* per-chat record is best-effort */ }
    }
    const col = storyApp.firestore().collection('users').doc(uid).collection('creations');
    { // de-dupe hosted URLs — an upload can now resolve to an already-filed image
      const dup = await col.where('url', '==', finalUrl).limit(1).get();
      if (!dup.empty) {
        return res.json({ ok: true, deduped: true, url: finalUrl, description, assetDeduped });
      }
    }
    const doc = {
      type: String(type || 'image'), url: finalUrl,
      prompt: String(prompt || '').slice(0, 500), stickers: null,
      createdAt: admin.firestore.Timestamp.fromMillis(createdMs),
      source: 'auto-hook',
    };
    if (style) doc.style = String(style).slice(0, 80);
    // THE WHOLE PROMPT, when the caller has one (Sophie's hard rule,
    // 2026-08-24). The Scratch Pad files through this route and has always
    // known the exact text it sent; the hook's background catches have no
    // prompt at all and simply send none, which stays absent rather than
    // being guessed.
    Object.assign(doc, promptRecord.promptFields({
      full: fullPrompt, content: prompt, prefix: promptPrefix, suffix: promptSuffix,
    }));
    const ref = await col.add(doc);
    res.json({ ok: true, id: ref.id, url: finalUrl, description, assetDeduped });
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
    // Paged, because this is a hard truncate otherwise: a chat past the cap
    // silently lost its OLDEST images (they were never deleted — just never
    // sent). `offset` walks back through the whole set, and `total` tells the
    // client when to stop asking, so no image can be out of reach.
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 300));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    await storyDb();
    // ONE picture, ONE tile. A picture reaches this tab by more than one road
    // — the storage object where it was generated, and the claude-deliveries
    // copy the server makes when the same image is also sent as a chat FILE —
    // so records are joined by CONTENT (the Storage object's md5, or the
    // sha256 of bytes that arrived inline) as well as by filename. The whole
    // rule, and why it is transitive, lives in asset-union.js.
    const records = [];
    // (a) iOS gallery creations this chat filed (prompt === "from <chat>")
    if (storyApp) {
      try {
        const uid = await galleryUid();
        const snap = await storyApp.firestore().collection('users').doc(uid)
          .collection('creations').where('prompt', '==', 'from ' + chat).get();
        snap.docs.forEach((d) => records.push(assetUnion.creationRecord(d.data())));
      } catch (e) { /* uid discovery unavailable */ }
    }
    // (b) forge-chat-assets (deckfactory) — clean per-chat tags
    if (admin.apps.length) {
      try {
        const asnap = await admin.firestore().collection('forge-chat-assets')
          .where('chat', '==', chat).get();
        asnap.docs.forEach((d) => records.push(assetUnion.assetRecord(d.data())));
      } catch (e) { /* best effort */ }
    }
    const ordered = assetUnion.unionAssets(records).sort((x, y) => y.ms - x.ms);
    const total = ordered.length;
    const assets = ordered.slice(offset, offset + limit)
      .map((a) => {
        const o = { url: a.url, prompt: a.prompt, created: a.ms ? new Date(a.ms).toISOString() : '' };
        if (a.alts.length) o.alts = a.alts;   // the same picture's other path(s)
        if (a.description) o.description = a.description;   // what this image IS, when a chat said so
        if (a.kind) o.kind = a.kind;   // 'audio' → the client renders a player tile, no thumb
        // The generating prompt, split (see POST /api/gallery/assets/prompt).
        if (a.promptStyle) o.promptStyle = a.promptStyle;
        if (a.promptContent) o.promptContent = a.promptContent;
        // This picture's only copy was encoded lossily before the bytes reached
        // us (scripts/tag-compressed-at-birth.js). The flag is the data; the
        // "[compressed]" the client draws in front of the caption and the
        // prompt is presentation.
        if (a.compressedAtBirth) o.compressedAtBirth = true;
        return o;
      });
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
        if (a.kind === 'audio') return;   // no thumbnail to make for a sound
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
          // A ♥ or a note may have been left on this picture's OTHER path
          // before the two collapsed into one tile — don't lose it.
          let v = votes.get(a.url);
          if (!v && a.alts) {
            for (const u of a.alts) { const alt = votes.get(u); if (alt) { v = alt; break; } }
          }
          if (v && v.vote) a.vote = v.vote;
          if (v && v.note) a.note = v.note;
          if (v && v.done) a.done = true;
          // The whole back-and-forth, so the lightbox can render it and a chat
          // reading this list sees its own replies too.
          const thread = v ? assetThread(v) : [];
          if (thread.length) {
            a.thread = thread;
            a.waiting = assetWaiting(thread);
            const last = thread[thread.length - 1];
            // Badge the tile when a chat has written since she last looked.
            if (last.from === 'chat'
              && (Date.parse(last.at || '') || 0) > (Date.parse((v && v.seenAt) || '') || 0)) {
              a.unread = true;
            }
          }
        });
      }
    } catch (e) { /* votes are best-effort */ }
    // total = every unique picture this chat has, so the client knows whether
    // another page exists rather than guessing from a full-looking response.
    res.json({ chat, assets, total, offset, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The Status view's "just delivered" strip: the newest images across EVERY
// chat in one query, so the Chats app never has to ask per-chat to answer
// "what landed recently". Single-field orderBy on `created` — no composite
// index. Same direct-thumb contract as the per-chat route above (content-
// addressed 480px webp URL, warmed in the background when not made yet), so
// the strip never pulls raw generated PNGs onto a phone.
app.get('/api/gallery/assets/recent', async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  res.set('Cache-Control', 'no-store');
  try {
    if (!admin.apps.length) return res.json({ assets: [] });
    const limit = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 24));
    // Over-fetch: audio rides the same collection, and one picture can be
    // filed at two storage paths (where it was generated + the server's
    // claude-deliveries copy) — dedupe the way the per-chat union does, by
    // CONTENT (the object's md5, or a sha256 of bytes that arrived inline)
    // as well as by filename, then cut to `limit`.
    const snap = await admin.firestore().collection('forge-chat-assets')
      .orderBy('created', 'desc').limit(limit * 4).get();
    const seen = new Set();
    const out = [];
    for (const d of snap.docs) {
      const a = d.data() || {};
      const url = String(a.url || '');
      if (!url || a.kind === 'audio' || AUDIO_URL_RE.test(url)) continue;
      // This strip walks newest-first and keeps the first copy it meets, so a
      // per-key Set is enough here — the transitive grouping the per-chat tab
      // needs only matters when copies must be MERGED into one row.
      const keys = assetUnion.joinKeys(a);
      if (keys.some((k) => seen.has(k))) continue;
      keys.forEach((k) => seen.add(k));
      const o = { url, chat: a.chat || '', created: a.created || '' };
      if (a.description) o.description = a.description;
      out.push(o);
      if (out.length >= limit) break;
    }
    const bucket = admin.storage().bucket();
    const warm = [];
    out.forEach((a) => {
      if (!THUMB_HOSTS.test(a.url)) return;
      a.thumb = `https://storage.googleapis.com/${bucket.name}/${thumbName(a.url, 480)}`;
      warm.push(a.url);
    });
    if (warm.length) warmThumbs(warm, 480);
    res.json({ assets: out });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// META ASSETS (Aug 2026, Sophie: "pull every asset from every chat into one
// place … automatic … in order of when it was filed"). The /assets page's one
// read: every chat's Assets tab, interleaved newest-first. NOTHING files into
// this — it is a view over forge-chat-assets, so a filing into any chat's tab
// is here with no extra step. Rows keep their origin `chat` because that is
// the vote's identity: the page ♥/✕/notes against the origin chat's own vote
// doc (same deterministic id the tab uses), which is what makes a heart here
// BE the heart there, in both directions, with no mirroring machinery.
// Ordering/union rules live in meta-assets.js (pure, tested).
const metaAssets = require('./meta-assets');
const searchGrammar = require('./search-grammar');
// The full list is rebuilt at most once a minute — one collection read
// (~5k docs) serving every page of the walk; a fresh filing shows within 60s
// (the page is a review surface, not a live feed).
let metaAssetsCache = null;
let metaAssetsCacheAt = 0;
// Note threads for SEARCH only (chat|url → texts) — the box matches what she
// wrote on a picture, and only the server holds the full list to match over.
let metaAssetsNotes = new Map();
const META_ASSETS_TTL = 60 * 1000;
app.get('/api/gallery/assets/all', async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  res.set('Cache-Control', 'no-store');
  try {
    if (!admin.apps.length) return res.json({ assets: [], total: 0, offset: 0, limit: 0 });
    const limit = Math.min(300, Math.max(1, parseInt(req.query.limit, 10) || 150));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    if (!metaAssetsCache || Date.now() - metaAssetsCacheAt > META_ASSETS_TTL || req.query.fresh) {
      // select() keeps the scan to the fields the union needs — no vote
      // threads, no wip bookkeeping, riding along.
      const snap = await admin.firestore().collection('forge-chat-assets')
        .select('chat', 'url', 'created', 'prompt', 'description',
          'promptStyle', 'promptContent', 'kind', 'hash', 'md5',
          'compressedAtBirth').get();
      // The APP-MADE half of My Creations (stickers, dream pages, in-app
      // generations) lives only in the iOS gallery — pull it in so pointing
      // that tile here loses nothing. Chat deliverables' hook copies (prompt
      // "from <chat>") and urls a chat already filed are skipped in the
      // builder; best-effort, exactly like the per-chat route's creations read.
      let creations = [];
      try {
        await storyDb();
        if (storyApp) {
          const uid = await galleryUid();
          const csnap = await storyApp.firestore().collection('users').doc(uid)
            .collection('creations')
            // `select` is a WHITELIST, so a field left out of it is silently
            // undefined downstream however well the builder handles it — which
            // is exactly what hid two caption slots for weeks (2026-08-24):
            // `size` was never selected, so the required third slot could
            // never show here, and `style` was selected but only read as a
            // fallback. Add the field HERE as well as wherever it is read.
            .select('url', 'prompt', 'type', 'model', 'quality', 'style', 'size', 'createdAt',
              'compressedAtBirth', 'promptStyle', 'promptContent').get();
          creations = csnap.docs.map((d) => {
            const c = d.data() || {};
            return { url: c.url, prompt: c.prompt, type: c.type, model: c.model,
              quality: c.quality, style: c.style, size: c.size,
              promptStyle: c.promptStyle, promptContent: c.promptContent,
              compressedAtBirth: c.compressedAtBirth,
              ms: c.createdAt && c.createdAt.toMillis ? c.createdAt.toMillis() : 0 };
          });
        }
      } catch (e) { /* uid discovery unavailable */ }
      metaAssetsCache = metaAssets.buildMetaAssets(snap.docs.map((d) => d.data()), creations);
      // Note threads ride the same rebuild so search matches what she (or a
      // chat) wrote on a picture — best-effort, like the creations read.
      try {
        const vsnap = await admin.firestore().collection('forge-asset-votes')
          .select('chat', 'url', 'note', 'thread').get();
        const nm = new Map();
        vsnap.docs.forEach((v) => {
          const d = v.data() || {};
          if (!d.chat || !d.url) return;
          const texts = assetThread(d).map((m) => m.text);
          if (texts.length) nm.set(metaAssets.noteKey(d.chat, d.url), texts);
        });
        metaAssetsNotes = nm;
      } catch (e) { /* notes stay searchable from the last build */ }
      metaAssetsCacheAt = Date.now();
    }
    // SEARCH runs here, over the FULL list — the page's box only ever saw the
    // tiles already loaded, so anything past the pages she'd scrolled was
    // unfindable (Aug 2026: she searched "yarn" and got nothing). Same
    // grammar, same word-start anchoring as the box (meta-assets.js).
    const q = String(req.query.q || '').trim();
    let rows = metaAssetsCache;
    if (q) {
      let names = {};
      try {
        const reg = await require('./chatfeed').registry();
        Object.keys(reg.chats || {}).forEach((k) => {
          if (reg.chats[k] && reg.chats[k].displayName) names[k] = reg.chats[k].displayName;
        });
      } catch (e) { /* display names are best-effort */ }
      rows = metaAssets.searchMetaAssets(metaAssetsCache, q,
        { names, notes: metaAssetsNotes });
    }
    const total = rows.length;
    const assets = rows.slice(offset, offset + limit).map((a) => {
      const o = { chat: a.chat, url: a.url, prompt: a.prompt,
        created: a.ms ? new Date(a.ms).toISOString() : '' };
      if (a.alts.length) o.alts = a.alts;
      if (a.description) o.description = a.description;
      if (a.kind) o.kind = a.kind;
      if (a.promptStyle) o.promptStyle = a.promptStyle;
      if (a.promptContent) o.promptContent = a.promptContent;
      if (a.compressedAtBirth) o.compressedAtBirth = true;
      if (a.app) { o.app = true; o.name = 'My Creations'; }
      return o;
    });
    // What she calls each chat — off the registry's own cached read, so this
    // costs nothing (never a second cache of that collection).
    try {
      const reg = await require('./chatfeed').registry();
      assets.forEach((a) => {
        if (a.app) return;
        const c = (reg.chats || {})[a.chat];
        if (c && c.displayName) a.name = c.displayName;
      });
    } catch (e) { /* names are best-effort */ }
    // Same direct-thumb contract as the per-chat route: content-addressed
    // 480px webp straight off storage's CDN, warmed when missing.
    {
      const bucket = admin.storage().bucket();
      const warm = [];
      assets.forEach((a) => {
        if (a.kind === 'audio') return;
        if (!THUMB_HOSTS.test(a.url)) return;
        a.thumb = `https://storage.googleapis.com/${bucket.name}/${thumbName(a.url, 480)}`;
        warm.push(a.url);
      });
      if (warm.length) warmThumbs(warm, 480);
    }
    // Votes/notes for THIS page only, fetched by their deterministic doc ids
    // (chat+url, plus each alt path — a ♥ left on the other copy still counts).
    try {
      const db = admin.firestore();
      const refs = [];
      const slots = [];
      assets.forEach((a) => {
        [a.url].concat(a.alts || []).forEach((u) => {
          refs.push(assetVoteRef(a.chat, u));
          slots.push(a);
        });
      });
      for (let i = 0; i < refs.length; i += 250) {
        const snaps = await db.getAll(...refs.slice(i, i + 250));
        snaps.forEach((s, j) => {
          if (!s.exists) return;
          const v = s.data();
          const a = slots[i + j];
          // The primary url's ref comes first per asset, so it wins over an alt's.
          if (v.vote && !a.vote) a.vote = v.vote;
          if (v.note && !a.note) a.note = v.note;
          if (v.done) a.done = true;
          const thread = assetThread(v);
          if (thread.length && !a.thread) {
            a.thread = thread;
            a.waiting = assetWaiting(thread);
            const last = thread[thread.length - 1];
            if (last.from === 'chat'
              && (Date.parse(last.at || '') || 0) > (Date.parse(v.seenAt || '') || 0)) {
              a.unread = true;
            }
          }
        });
      }
    } catch (e) { /* votes are best-effort */ }
    res.json({ assets, total, offset, limit });
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

// How long one per-image review note may be. Sophie writes these by
// voice-to-text, so long run-on notes are normal — the old 300-char cap cut
// real notes off mid-sentence with no warning. Keep this in sync with
// NOTE_MAX in public/chats.html (the counter/warning there use the same
// number). An over-length note is REFUSED, never silently trimmed.
const ASSET_NOTE_MAX = 2000;

// A note on an image is a THREAD, not a single string: Sophie writes from the
// Assets lightbox and the chat that made the image writes back. Deliberately
// snail mail — a chat reads its threads the next time Sophie messages it, since
// nothing here runs on a timer (house rule: no recurring self-check-ins).
const ASSET_THREAD_MAX = 40;
// One doc per chat+url, id derived from both so any caller finds the same doc.
function assetVoteRef(chat, url) {
  const id = require('crypto').createHash('sha1')
    .update(String(chat) + '|' + String(url)).digest('hex');
  return admin.firestore().collection('forge-asset-votes').doc(id);
}

// ── Hearts sync BOTH WAYS between the Playground and the Assets tabs (Aug
// 2026, Sophie: "i don't know if the hearts in playground are syncing to the
// hearts in meta-assets" — they were not: a Playground ♥ lived only on the
// run doc and an Assets ♥ only in forge-asset-votes; measured that day, 21 of
// the 22 hearted Playground pictures in the newest 100 runs sat unhearted in
// Meta Assets). Each vote still writes where it always did; its route now
// ALSO carries the vote — and a CLEAR — across, so un-hearting on one surface
// cannot leave a stuck heart on the other. Best-effort by design: a sync
// failure must never fail the vote itself. Matching is by exact url (plus the
// canonical urlKey); an md5-only twin (a re-encoded copy under a different
// name) is not chased — the Assets read's union already finds a vote left on
// either path of one picture.
async function syncVoteToAssets(url, vote) {
  if (!url || !admin.apps.length) return;
  try {
    const col = admin.firestore().collection('forge-chat-assets');
    // Two doors to one record: its literal url, and its canonical urlKey —
    // the voted url is usually already canonical, so the urlKey query is the
    // one that finds a record filed with a query-string on its url.
    const queries = [col.where('url', '==', url)];
    const key = canonicalAssetUrl(url);
    if (key) queries.push(col.where('urlKey', '==', key));
    const chats = new Set();
    // Every Playground picture rides into Meta Assets through the My
    // Creations join (the iOS gallery), where its row votes as chat
    // 'my-creations' — no forge-chat-assets record exists for it unless a
    // chat also delivered it. Measured 2026-08-22: 21 of 22 hearted
    // Playground pictures had ONLY that row, so a record-only sync wrote
    // nothing at all.
    if (/\/promptlab\//.test(String(url))) chats.add('my-creations');
    for (const q of queries) {
      try {
        (await q.limit(20).get()).docs.forEach((d) => {
          const chat = (d.data() || {}).chat;
          if (chat) chats.add(chat);
        });
      } catch (e) { /* a lookup failing must never block the vote */ }
    }
    await Promise.all([...chats].map((chat) => assetVoteRef(chat, url).set({
      chat: String(chat).slice(0, 60),
      url: String(url).slice(0, 500),
      vote: (vote === 'like' || vote === 'dislike') ? vote : admin.firestore.FieldValue.delete(),
      updated: new Date().toISOString(),
    }, { merge: true }).catch(() => {})));
  } catch (e) { /* best-effort */ }
}
async function syncVoteToPlayground(url, vote) {
  if (!url || !/\/promptlab\//.test(String(url)) || !admin.apps.length) return;
  try {
    const snap = await admin.firestore().collection('forge-promptlab')
      .where('images', 'array-contains', url).limit(1).get();
    if (snap.empty) return;
    const doc = snap.docs[0];
    const i = (doc.data().images || []).indexOf(url);
    if (i < 0) return;
    await doc.ref.update({
      [`votes.${i}`]: (vote === 'like' || vote === 'dislike')
        ? vote : admin.firestore.FieldValue.delete(),
    });
  } catch (e) { /* best-effort */ }
}
// Legacy docs hold only a single `note` string (everything written before the
// thread existed). Those are PRESENTED as a one-message thread from Sophie, so
// no migration is needed and no old note is lost.
function assetThread(data) {
  const d = data || {};
  if (Array.isArray(d.thread) && d.thread.length) {
    return d.thread
      .filter((m) => m && String(m.text || '').trim())
      .map((m, i) => ({
        id: String(m.id || 'm' + i),
        from: m.from === 'chat' ? 'chat' : 'sophie',
        text: String(m.text || ''),
        at: m.at || d.updated || '',
      }));
  }
  const legacy = String(d.note || '').trim();
  return legacy ? [{ id: 'legacy', from: 'sophie', text: legacy, at: d.updated || '' }] : [];
}
// Who owes the next message: whoever did NOT send the last one.
function assetWaiting(thread) {
  if (!thread || !thread.length) return null;
  return thread[thread.length - 1].from === 'sophie' ? 'chat' : 'sophie';
}
// Append one message. A transaction because Sophie can send from the app while
// a chat is replying to the same image, and a read-modify-write would drop one.
async function appendAssetMessage(ref, chat, url, from, text) {
  const who = from === 'chat' ? 'chat' : 'sophie';
  const msg = {
    id: require('crypto').randomBytes(6).toString('hex'),
    from: who, text, at: new Date().toISOString(),
  };
  const thread = await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = assetThread(snap.exists ? snap.data() : {})
      .concat([msg]).slice(-ASSET_THREAD_MAX);
    const patch = {
      chat: String(chat).slice(0, 60), url: String(url).slice(0, 500),
      thread: next, updated: msg.at,
    };
    if (who === 'sophie') {
      patch.note = text;    // legacy mirror: her LATEST ask, what old readers read
      patch.seenAt = msg.at; // she's writing, so she's caught up on the replies
      // A fresh ask reopens the image even if a chat had marked it handled.
      patch.done = admin.firestore.FieldValue.delete();
    }
    tx.set(ref, patch, { merge: true });
    return next;
  });
  return { message: msg, thread };
}

// Sophie's curation vote on one Assets-tab image: ♥ ('like'), ✕ ('dislike'),
// or null to clear. One doc per chat+url (deterministic id) in deckfactory.
// Chats read the verdicts off GET /api/gallery/assets and act on them.
// Body parsing: the global express.json above is 25mb, so a 2000-char note is
// never anywhere near the request-size limit.
app.post('/api/gallery/assets/vote', express.json(), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { chat, url, vote, note, done } = req.body || {};
    if (!chat || !url) return res.status(400).json({ error: 'chat and url required' });
    if (!admin.apps.length) return res.status(503).json({ error: 'firestore unavailable' });
    const ref = assetVoteRef(chat, url);
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
      // Never truncate her words. Too long = refused with a message the client
      // shows, so nothing is saved half-written and she knows to trim it.
      if (t.length > ASSET_NOTE_MAX) {
        return res.status(413).json({
          error: `That note is ${t.length} characters — the limit is ${ASSET_NOTE_MAX}. `
            + `Nothing was saved; trim it by ${t.length - ASSET_NOTE_MAX} and send again.`,
          limit: ASSET_NOTE_MAX,
          length: t.length,
        });
      }
      // Legacy path: a note sent here APPENDS to the thread (below) rather than
      // replacing it, so an older client can't wipe a conversation. Clearing
      // (empty/null) only drops the `note` mirror; the thread is history.
      if (!t) patch.note = admin.firestore.FieldValue.delete();
    }
    if (done !== undefined) {
      patch.done = done ? true : admin.firestore.FieldValue.delete();
    }
    await ref.set(patch, { merge: true });
    if (note !== undefined && String(note == null ? '' : note).trim()) {
      await appendAssetMessage(ref, chat, url, 'sophie',
        String(note).trim());
    }
    // A ♥/✕ (or a clear) on a Playground-made picture also lands on its run
    // doc, so the Playground's own feed agrees — see syncVoteToPlayground.
    if (vote !== undefined) {
      await syncVoteToPlayground(url, vote);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// One message in an image's note thread. Sophie's box in the Assets lightbox
// posts from:'sophie'; the chat that made the image replies with from:'chat'.
// Also the read receipt: { chat, url, seen:true } with no text marks her caught
// up, which is what clears the unread badge on the tile.
app.post('/api/gallery/assets/note', express.json(), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { chat, url, text, from, seen } = req.body || {};
    if (!chat || !url) return res.status(400).json({ error: 'chat and url required' });
    if (!admin.apps.length) return res.status(503).json({ error: 'firestore unavailable' });
    const ref = assetVoteRef(chat, url);
    const t = String(text == null ? '' : text).trim();
    if (!t) {
      if (!seen) return res.status(400).json({ error: 'text required' });
      const at = new Date().toISOString();
      await ref.set({ chat: String(chat).slice(0, 60), url: String(url).slice(0, 500),
        seenAt: at }, { merge: true });
      return res.json({ ok: true, seenAt: at });
    }
    // Same refusal as the note field: her words are never silently truncated.
    if (t.length > ASSET_NOTE_MAX) {
      return res.status(413).json({
        error: `That note is ${t.length} characters — the limit is ${ASSET_NOTE_MAX}. `
          + `Nothing was saved; trim it by ${t.length - ASSET_NOTE_MAX} and send again.`,
        limit: ASSET_NOTE_MAX,
        length: t.length,
      });
    }
    const out = await appendAssetMessage(ref, chat, url, from, t);
    res.json({ ok: true, message: out.message, thread: out.thread,
      waiting: assetWaiting(out.thread) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// A VOICE note on a film's thread (Aug 2026 — the tap-to-note player on a
// pinned film; chats.html records, this uploads + transcribes and appends
// "[video time] words (voice: url)" onto the same forge-asset-votes thread the
// typed notes use, so a chat's normal notes sweep finds both). The recording
// itself is kept — the transcript is a convenience, never a replacement.
// Transcription is mechanical extraction, so gpt-4o-mini-transcribe is right
// here (the which-model rules).
app.post('/api/gallery/assets/note-voice', express.json({ limit: '8mb' }), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { chat, url, t, audio, hold } = req.body || {};
    if (!chat || !url) return res.status(400).json({ error: 'chat and url required' });
    if (!admin.apps.length) return res.status(503).json({ error: 'firestore unavailable' });
    const m = /^data:(audio\/[\w.+-]+);base64,(.+)$/.exec(String(audio || ''));
    if (!m) return res.status(400).json({ error: 'audio must be a data:audio/… URL' });
    const buf = Buffer.from(m[2], 'base64');
    if (!buf.length) return res.status(400).json({ error: 'empty recording' });
    const ext = m[1].includes('mp4') ? 'm4a' : m[1].split('/')[1].split(';')[0];
    const bucket = admin.storage().bucket();
    const file = bucket.file(`film-notes/${require('crypto').createHash('sha1').update(String(url)).digest('hex').slice(0, 12)}-${Date.now()}.${ext}`);
    await file.save(buf, { contentType: m[1].split(';')[0], resumable: false });
    await file.makePublic();
    const voiceUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
    let transcript = '';
    if (process.env.OPENAI_API_KEY) {
      try {
        const form = new FormData();
        form.append('file', new Blob([buf], { type: m[1].split(';')[0] }), `note.${ext}`);
        form.append('model', 'gpt-4o-mini-transcribe');
        const r = await globalThis.fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body: form,
        });
        const tr = await r.json();
        if (tr && tr.text) transcript = String(tr.text).trim().slice(0, ASSET_NOTE_MAX - 200);
      } catch (err) { console.error('film note transcription failed:', err.message); }
    }
    // hold:true — the player wants the words in the text box for editing
    // first; the note itself is filed by the text route once she is done.
    if (hold) return res.json({ ok: true, url: voiceUrl, transcript, held: true });
    const stamp = /^\d+:\d\d$/.test(String(t || '')) ? `[${t}] ` : '';
    const line = `${stamp}${transcript || '(voice note)'} (voice: ${voiceUrl})`;
    const ref = assetVoteRef(chat, url);
    const out = await appendAssetMessage(ref, chat, url, 'sophie', line);
    res.json({ ok: true, url: voiceUrl, transcript, message: out.message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Every image in this chat that has a note thread — what a chat reads to find
// what Sophie asked and what it already answered. Images she never wrote on are
// omitted, so this stays small next to the full assets list. `waiting:'chat'`
// is the queue: she spoke last and nobody has replied.
// ONE image's note thread, by url (2026-08-26). The sibling `/notes` route
// answers with every threaded image in a chat — it reads that chat's WHOLE
// vote collection and its whole asset collection to do it, which is right for
// a chat sweeping what is waiting for it and far too heavy for a lightbox
// opening on one picture. This is a single doc read.
app.get('/api/gallery/assets/note', async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  res.set('Cache-Control', 'no-store');
  try {
    const chat = String(req.query.chat || '').slice(0, 60);
    const url = String(req.query.url || '').slice(0, 500);
    if (!chat || !url) return res.status(400).json({ error: 'chat and url required' });
    if (!admin.apps.length) return res.status(503).json({ error: 'firestore unavailable' });
    const snap = await assetVoteRef(chat, url).get();
    const v = snap.exists ? snap.data() : {};
    const thread = assetThread(v);
    return res.json({ url, thread, waiting: assetWaiting(thread),
      vote: v.vote || null, done: v.done ? true : false });
  } catch (err) { return res.status(500).json({ error: err.message }); }
});

app.get('/api/gallery/assets/notes', async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  res.set('Cache-Control', 'no-store');
  try {
    const chat = String(req.query.chat || '').slice(0, 60);
    if (!chat) return res.status(400).json({ error: 'chat required' });
    if (!admin.apps.length) return res.status(503).json({ error: 'firestore unavailable' });
    const db = admin.firestore();
    // The label ("what this image is") lives on the asset record, not the vote
    // doc — join it in so a chat can recognise the image without opening it.
    const [vs, as] = await Promise.all([
      db.collection('forge-asset-votes').where('chat', '==', chat).get(),
      db.collection('forge-chat-assets').where('chat', '==', chat).get(),
    ]);
    const labels = new Map();
    as.docs.forEach((d) => {
      const a = d.data();
      if (a.url && a.description) labels.set(a.url, a.description);
    });
    const notes = [];
    vs.docs.forEach((d) => {
      const v = d.data();
      const thread = assetThread(v);
      if (!thread.length) return;
      const o = { url: v.url, thread, waiting: assetWaiting(thread) };
      if (labels.get(v.url)) o.description = labels.get(v.url);
      if (v.vote) o.vote = v.vote;
      if (v.done) o.done = true;
      notes.push(o);
    });
    // The ones waiting on a chat first, then most recently written.
    const lastAt = (n) => Date.parse(n.thread[n.thread.length - 1].at || '') || 0;
    notes.sort((a, b) => {
      const aw = a.waiting === 'chat' ? 0 : 1, bw = b.waiting === 'chat' ? 0 : 1;
      return aw !== bw ? aw - bw : lastAt(b) - lastAt(a);
    });
    res.json({ chat, notes, waiting: notes.filter((n) => n.waiting === 'chat').length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// VARIANT GROUPS in a chat's Assets tab (Aug 2026 — the auto-feed half of the
// stock templates; see page-templates.js). Three outputs, two confidences,
// deliberately kept apart (Sophie's instinct, made the rule):
//   ladders     — SAME prompt content, differing MODEL · QUALITY caption or
//                 style. Objective — the SERVER auto-files these into the
//                 chat's standing auto-compare page (runAutoCompare in
//                 chatfeed.js) whenever a prompt or caption gets filed.
//   contentSets — SAME style prompt, differing content (one style walked
//                 across many dreams). Objective, auto-filed the same way.
//   reruns      — the SAME prompt at the same model/quality, drawn more than
//                 once (her grainy-vs-clean pairs: what differed was a
//                 generation setting nothing ever filed). Auto-filed too, and
//                 it claims only that they ARE the same prompt, never why.
//   variants    — NEAR-identical prompts (one or two lines changed). Only
//                 ever FLAGGED here: where a variation set starts and stops
//                 is the chat's call, so the chat reads this and files the
//                 grid page itself.
app.get('/api/gallery/assets/variants', async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  res.set('Cache-Control', 'no-store');
  try {
    const chat = String(req.query.chat || '').slice(0, 60);
    if (!chat) return res.status(400).json({ error: 'chat required' });
    if (!admin.apps.length) return res.status(503).json({ error: 'firestore unavailable' });
    const snap = await admin.firestore().collection('forge-chat-assets')
      .where('chat', '==', chat).get();
    const rows = assetUnion.unionAssets(snap.docs.map((d) => assetUnion.assetRecord(d.data())))
      .sort((x, y) => y.ms - x.ms);
    const out = pageTemplates.groupAssetVariants(rows);
    res.json({ chat, ladders: out.ladders, contentSets: out.contentSets,
      reruns: out.reruns, variants: out.variants });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The prompt behind an Assets-tab image, split in two: promptStyle (the house
// style / LoRA trigger / look) and promptContent (what is actually depicted).
// Only the chat that generated the image knows where that seam is, so the
// split is posted, never parsed back out of a joined string. Shown in the
// lightbox as an overlay ON the image (Style | Content toggle).
// One image: { chat, url, style, content }. A whole backfill in one call:
// { chat, items:[{url, style, content}, …] }. Idempotent — re-posting the same
// url overwrites that image's split, and an empty string clears a side.
// A truncated prompt is a WRONG prompt — the whole point of the split is that
// it is the exact text the model was sent. The cap used to be 1500 and silently
// sliced, which quietly filed a chopped-off style block against real images. So
// the ceiling is generous enough for a full style prompt, and over-length is
// REFUSED rather than trimmed (same rule the note thread already follows).
const ASSET_PROMPT_MAX = 6000;
app.post('/api/gallery/assets/prompt', express.json({ limit: '2mb' }), async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { chat, items } = req.body || {};
    const chatName = String(chat || '').slice(0, 60);
    if (!chatName) return res.status(400).json({ error: 'chat required' });
    if (!admin.apps.length) return res.status(503).json({ error: 'firestore unavailable' });
    const list = Array.isArray(items) && items.length ? items : [req.body || {}];
    const clean = (v) => String(v == null ? '' : v).trim();
    const acol = admin.firestore().collection('forge-chat-assets');
    const del = admin.firestore.FieldValue.delete();
    const results = [];
    for (const raw of list) {
      const url = String((raw && raw.url) || '');
      if (!/^https:\/\/(storage|firebasestorage)\.googleapis\.com\//.test(url)) {
        results.push({ url, ok: false, error: 'hosted Firebase url required' });
        continue;
      }
      // A side is only touched when it was sent, so posting just the content
      // later never wipes a style filed earlier.
      const patch = {};
      const over = [];
      if (raw.style !== undefined) {
        const s = clean(raw.style);
        if (s.length > ASSET_PROMPT_MAX) over.push('style (' + s.length + ')');
        else patch.promptStyle = s || del;
      }
      if (raw.content !== undefined) {
        const c = clean(raw.content);
        if (c.length > ASSET_PROMPT_MAX) over.push('content (' + c.length + ')');
        else patch.promptContent = c || del;
      }
      if (over.length) {
        results.push({ url, ok: false,
          error: over.join(' and ') + ' over ' + ASSET_PROMPT_MAX + ' chars — refused, not truncated' });
        continue;
      }
      if (!Object.keys(patch).length) {
        results.push({ url, ok: false, error: 'style or content required' });
        continue;
      }
      const existing = await findChatAsset(chatName, { url });
      if (existing) {
        await existing.ref.update(patch);
        results.push({ url, ok: true, updated: true });
      } else {
        // The prompt can land before the Stop hook files the image (same
        // session, image already uploaded). Create the record now; the hook's
        // later post converges onto it by url instead of adding a second tile.
        const doc = { chat: chatName, url, urlKey: canonicalAssetUrl(url),
          prompt: '', created: new Date().toISOString(), wip: true };
        Object.keys(patch).forEach((k) => { if (patch[k] !== del) doc[k] = patch[k]; });
        await acol.add(doc);
        results.push({ url, ok: true, created: true });
      }
    }
    const failed = results.filter((r) => !r.ok);
    // filing a prompt is THE trigger for the automatic compare pages — the
    // groups run on exactly what just landed (debounced per chat, chatfeed.js)
    if (results.length > failed.length) require('./chatfeed').autoComparePoke(chatName);
    res.json({ ok: !failed.length, saved: results.length - failed.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── The Wall: everything every chat produced, in one live feed ─────
// Merges this project's Storage (generated images, movie panels, zine
// pages, dream comics) with the story boards' art (membry bucket) into
// one newest-first list for the /wall page. Same gate as the pipeline.
// The wall lists EVERY object in both buckets — there's no cheaper way to ask
// Storage "what images exist", and it's billed per 1000 objects listed, so a
// page polling it once a minute paid for a full double bucket walk each time
// and got slower with every image ever generated. The listing is held in
// memory instead: `wallInvalidate()` drops it the moment anything uploads
// (saveToFirebase is the shared write path), and the TTL is only a backstop
// for uploads that bypass it. `?fresh=1` forces a walk for the Refresh button.
let wallCache = null;
let wallCacheAt = 0;
const WALL_TTL_MS = 5 * 60 * 1000;
function wallInvalidate() { wallCache = null; }

app.get('/api/wall', async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const limit = Math.min(500, parseInt(req.query.limit, 10) || 200);
    const fresh = req.query.fresh === '1';
    if (!fresh && wallCache && Date.now() - wallCacheAt < WALL_TTL_MS) {
      return res.json({
        images: wallCache.slice(0, limit),
        total: wallCache.length,
        newest: wallCache[0] ? wallCache[0].created : null,
        cached: true,
      });
    }
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
    wallCache = out;
    wallCacheAt = Date.now();
    res.json({ images: out.slice(0, limit), total: out.length, newest: out[0] ? out[0].created : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/wall', serveGated('wall.html'));

// Story Room: the movie asset boards in the Writing Room's frame — narration
// with the art in place, live from /api/story (no deploy needed for content),
// notes per beat via /api/writing/notes (keys "story-<project>:b<beat>").
// THE Story Room is the pad now (Sophie, Aug 2026): /storyroom serves the
// same page as /scratchpad, so the app's Story Room tile opens the pad with
// no build. The OLD board page (storyroom.html + gen-storyroom.py + the
// /api/story routes) is kept in the repo but no longer pointed at — restore
// this line to serveGated('storyroom.html') to bring it back.
app.get('/storyroom', serveGated('scratchpad.html', { pill: true }));

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

// Meta Assets: every chat's Assets tab in one automatic, filing-ordered place
// (nothing files into it — it reads what the tabs already hold). ♥/✕/notes
// land on the origin chat's own vote doc, so curation here and in the chat's
// tab are the same record. Same gate as the Studio.
app.get('/assets', serveGated('assets.html', { pill: true }));

// Blog Studio: SEO blog posts (long-tail keyword research → written post +
// images → publish to the Shopify store blog). Same gate as the Studio.
// On the public witch domain (or with ?public=1 for previewing) /blog is the
// SITE blog, server-rendered from Firestore; elsewhere it's the gated studio.
app.get('/blog', (req, res) => {
  if (isWitchHost(req) || req.query.public === '1') return blogPublic.renderIndex(req, res);
  return serveGated('blog.html', { pill: true })(req, res);
});
app.get('/blog/:slug', (req, res) => blogPublic.renderPost(req, res));

// The witch app's Home screen ends with a "From the blog" section, and this is
// where it reads from. PUBLIC and deliberately tiny — no body HTML, just what a
// card needs. blogPublic.sitePosts() is cached for 5 minutes, so Home asking on
// every load costs no Firestore reads.
app.get('/api/witch/blog', async (req, res) => {
  try {
    const limit = Math.min(12, Math.max(1, parseInt(req.query.limit, 10) || 4));
    const posts = (await blogPublic.sitePosts()).slice(0, limit).map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.metaDescription,
      image: p.image || null,
      // Which part of the square hero survives the feature card's 16:9 crop.
      focal: p.focal,
      date: p.publishedAt ? p.publishedAt.toISOString() : null,
    }));
    res.json({ posts });
  } catch (err) {
    res.status(502).json({ error: String((err && err.message) || err) });
  }
});

// Import Art: drop in card images made elsewhere (e.g. bulk-downloaded from your
// own Midjourney) as a named batch the deck workflow can pull from.
app.get('/import', serveGated('ingest.html', { pill: true }));

// Crystal drop: dump crystal photos (+ whatever's known about each stone) into
// Firebase so a chat can pull them back out to price, sort into listings, and
// build the numbered pick-your-own grids. Engine is /api/crystals (crystals.js).
app.get('/crystals', serveGated('crystals.html', { pill: true }));
// The Crystal Splitter — an album's photos in shooting order, one tap on any
// photo that starts a NEW stone. Most of the dumped albums are catalogue runs
// (20-50 stones each), and nothing in the data says where one stops, so this is
// the surface that asks. Pill injected: it's a long scrolling wall of photos.
app.get('/crystalsplit', serveGated('crystalsplit.html', { pill: true }));

// Audio drop: recordings off the phone (the Files app's picker is multi-select)
// into Firebase, each one back as a permanent public url anything downstream can
// use. Engine is /api/audio (audio.js).
app.get('/audio', serveGated('audio.html', { pill: true }));
// Voice Studio — pick a cloned voice, type text, get it spoken. Engine is
// /api/voicelab (voicelab.js). Gets the shared autoscroll pill.
app.get('/voice', serveGated('voice.html', { pill: true }));

// Episode Editor: select spans of a real interview transcript as snippet cards,
// arrange them with narration + gaps, tap Render, get the finished audio.
// Engine is /api/editor (editor.js). Same gate as the Studio. Episodes get long
// (a 23-card arrangement scrolls for a while), so it carries the shared
// autoscroll pill — the native EpisodeEditorView deliberately ships no pill of
// its own, so this is the only one.
app.get('/editor', serveGated('editor.html', { pill: true }));

// Cutting Room: one of Sophie's OWN recordings marked on its transcript —
// tap words to cut pauses and slice sections off to save or send on (Episode
// Editor / Story Room). Engine is /api/cutroom (cuttingroom.js). Same gate;
// long transcripts get the shared autoscroll pill.
app.get('/cuttingroom', serveGated('cuttingroom.html', { pill: true }));

// Search: every transcript in one place — the interview library and the voice
// memos together. Engine is /api/search (search.js). A results page scrolls,
// so it carries the shared autoscroll pill like its sibling audio tools.
app.get('/search', serveGated('search.html', { pill: true }));
// Cut Marks: the manual sibling — mark your own cut points on a playhead
// (video or audio, no transcript), drop pieces, render a fresh file. Engine
// is /api/cutmarks (cutmarks.js). Same gate; same shared pill.
app.get('/cutmarks', serveGated('cutmarks.html', { pill: true }));
// Cutting Blocks: a recording broken into sentence-level lines to take apart,
// mark, reorder and hear before cutting. Engine is /api/blocks (blocks.js).
// Same gate; the line list scrolls, so it carries the shared autoscroll pill.
app.get('/blocks', serveGated('blocks.html', { pill: true }));
// Pausing: set how long a pause is, add one where there is none, and hear the
// edit rather than the source. Engine is /api/pausing (pausing.js). Same gate;
// the transcript scrolls, so it carries the shared autoscroll pill.
app.get('/pausing', serveGated('pausing.html', { pill: true }));
// The edit itself — the ONE description of what her pause marks do to a
// recording, loaded by the render on the server AND by the page in the
// browser, so the preview she approves by ear is the take she gets. Public
// and immutable-ish: it is code, it holds nothing of hers.
app.get('/pause-plan.js', (req, res) => {
  res.type('application/javascript');
  res.set('Cache-Control', 'no-cache, must-revalidate');
  res.sendFile(__dirname + '/pause-plan.js');
});
// Chunking: the clip library — a shelf of every short self-contained piece the
// app has made, four to a row, with search as the whole interface. Engine is
// /api/clips (clips.js). `/clips` is the honest alias; `/chunking` is the name
// Sophie picked for the tile, and both serve the same page.
//
// It DOES carry the pill (Sophie asked for it back — "I still need it"). The
// page pays the contract's price properly: its sticky search row reserves the
// 56px corner, and it defines the five pill tokens itself, because tool.css
// supplies only `--ink` of them.
app.get('/chunking', serveGated('clips.html', { pill: true }));
app.get('/clips', serveGated('clips.html', { pill: true }));

// Assembly: clips in order on a timeline at the bottom of the screen — tap a
// clip, tap the place indicator in a gap, it drops in between; Render bakes
// the arrangement into one film. Engine is /api/assembly (assembly.js). The
// clip shelf scrolls, so it carries the pill and pays the contract's price
// (five tokens on .float, the 64px corner reserve).
app.get('/assembly', serveGated('assembly.html', { pill: true }));

// Film Editor: her tap editor made real — split / trim / reorder / audio at
// the playhead, one screen that never scrolls, so NO pill. Engine is
// /api/filmeditor (filmeditor.js).
app.get('/filmeditor', serveGated('filmeditor.html'));

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
  // House styles that render through gpt-image-2's EDITS endpoint with Sophie's
  // own style-reference images (the same engine the illustrated lessons use) —
  // NOT a Replicate LoRA. All four attach the SAME two Witch School refs.
  //
  // THESE FOUR ARE A 2x2, ON PURPOSE (Aug 2026, Sophie). The Witch School
  // lesson-card style and the Pastel one differ in more than palette: when the
  // pastel variant was made (July 2026) it was a hand-COPY of the lesson-card
  // generator, and three composition instructions were dropped in the copying
  // without anyone deciding to —
  //     "lots of generous negative space"
  //     "Draw a brand-new, SIMPLE, uncluttered illustration with one clear
  //      subject (not a busy scene)."
  //     "Subject centered with lots of empty cream space around it."
  // So "warm" and "roomy" had been welded together and couldn't be judged
  // apart. The grid crosses them: palette (warm / pastel) x composition
  // (roomy / lean). Run one prompt through all four and the question "is it
  // the colour or the space I like?" answers itself.
  //
  // What is deliberately NOT crossed: the reference clause. Warm says "match
  // their exact look", pastel says "for the linework" — that is what LETS the
  // pastel recolour the warm refs at all, so it stays tied to its palette.
  // Crossing it too would change colour fidelity and muddy the one thing this
  // grid exists to isolate.
  house: [
    {
      id: 'house-witch',
      name: 'Witch School (warm + roomy)',
      // Verbatim from scripts/witch-school-cards.js — this IS the live lesson-
      // card recipe, so the tile shows the real thing, not an approximation.
      stylePrompt: 'Use the attached images ONLY as a STYLE reference — match their exact look: bold confident black ink outlines, a flat limited palette (warm golden yellow, salmon pink, bright orange, black) on a soft cream off-white background, playful modern editorial illustration, flat colors with NO gradients and minimal shading, lots of generous negative space. Draw a brand-new, SIMPLE, uncluttered illustration with one clear subject (not a busy scene). ',
      end: ' Subject centered with lots of empty cream space around it. Absolutely no text, no words, no letters, no numbers, no captions.',
      refs: ['witch-school/refs/sophie-snake.png', 'witch-school/refs/sophie-animals.png'],
    },
    {
      id: 'house-pastel',
      name: 'Pastel (pastel + lean)',
      stylePrompt: 'Use the attached images ONLY as a STYLE reference for the linework: bold confident black ink outlines, flat colors with NO gradients and minimal shading, a soft pastel palette of lilac, pastel pink, mint and pale yellow, on a plain white background, playful modern editorial illustration. ',
      end: ' Absolutely no text, no words, no letters, no numbers, no captions.',
      refs: ['witch-school/refs/sophie-snake.png', 'witch-school/refs/sophie-animals.png'],
      whiten: true,
    },
    {
      id: 'house-pastel-roomy',
      name: 'Pastel + roomy',
      // Pastel, with the three dropped composition lines put back. "cream" in
      // the centering line becomes "white" — this style's ground IS white, and
      // leaving the word in would smuggle a colour instruction into the half
      // of the grid that is supposed to vary only composition.
      stylePrompt: 'Use the attached images ONLY as a STYLE reference for the linework: bold confident black ink outlines, flat colors with NO gradients and minimal shading, a soft pastel palette of lilac, pastel pink, mint and pale yellow, on a plain white background, playful modern editorial illustration, lots of generous negative space. Draw a brand-new, SIMPLE, uncluttered illustration with one clear subject (not a busy scene). ',
      end: ' Subject centered with lots of empty white space around it. Absolutely no text, no words, no letters, no numbers, no captions.',
      refs: ['witch-school/refs/sophie-snake.png', 'witch-school/refs/sophie-animals.png'],
      whiten: true,
    },
    {
      id: 'house-witch-lean',
      name: 'Witch School + lean',
      // The warm lesson-card style with those same three lines taken OUT —
      // i.e. what the warm palette looks like framed the way pastel is.
      stylePrompt: 'Use the attached images ONLY as a STYLE reference — match their exact look: bold confident black ink outlines, a flat limited palette (warm golden yellow, salmon pink, bright orange, black) on a soft cream off-white background, playful modern editorial illustration, flat colors with NO gradients and minimal shading. ',
      end: ' Absolutely no text, no words, no letters, no numbers, no captions.',
      refs: ['witch-school/refs/sophie-snake.png', 'witch-school/refs/sophie-animals.png'],
    },
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

    // STAYS ON gpt-4o-mini (Aug 2026, Sophie's call). It was briefly switched to
    // Claude and she asked for it back: the book's voice is settled, and
    // changing the model changes how the pages read. This one route feeds BOTH
    // the witch app's Miracles tab and /book — they share this endpoint and the
    // same localStorage book — so switching it moves both at once. Don't.
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
// A small set of AI endpoints powering the public app: dream readings,
// spells/rituals, familiar names, the daily reading, and the members-only
// "Ask the cards" question readings. The tarot DECK lives client-side (and
// the FREE daily card meanings now come from a committed corpus, no model
// call at all); the client sends the drawn cards and the server writes the
// interpretation only for the paid ask-a-question flow.
// ═══════════════════════════════════════════════════════════════════

// The house reading voice — shared by the daily tarot prompt and the paid
// "Ask the cards" reading so both sound like the same reader.
const WITCH_VOICE = `warm, plain, and grounded — like a perceptive friend, not a guru or a mystic. Speak directly to them as "you". Never preachy, condescending, bossy, or fatalistic; no woo, no lecturing, no telling them what they "must" or "should" do; no medical/legal/financial certainty.`;

// Strip markdown fences and parse JSON from a chat completion.
function parseJsonReply(data) {
  const text = (data.choices?.[0]?.message?.content || '').trim();
  const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch { return JSON.parse(escapeCtrlInStrings(cleaned)); }
}

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
// Sophie's diary-comic style (refs/dream-mystery.jpg). Fire-and-forget job +
// poll (GET /:id) so a ~1-2 min render survives cold starts / phone lock —
// the same resilient pattern the iOS dreams pipeline uses.
// movies.js is require()d lazily (at request time) so it captures the keys
// config-loader hydrated at boot, not stale ones from an early require.
app.post('/api/witch/dream-illustrate', async (req, res) => {
  try {
    const dream = String((req.body || {}).dream || '').trim();
    // Who the dreamer (and anyone else) looks like — optional, from the
    // describe-yourself step; the client sends a generic fallback when skipped.
    const people = String((req.body || {}).people || '').trim().slice(0, 600);
    if (!dream) return res.status(400).json({ error: 'dream is required' });
    if (dream.length > 20000) return res.status(400).json({ error: 'dream is too long' });
    if (!admin.apps.length) return res.status(503).json({ error: 'image storage not configured' });
    const db = admin.firestore();
    const ref = db.collection('forge-witch-dream-illus').doc();
    await ref.set({
      status: 'running', label: 'illustrating your dream', dream, people: people || null,
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
        await ref.update({ label: 'illustrating your dream', totalPages, title: dr.title || null });
        // page one = first 4 beats; dreamerLook feeds the page prompt so the
        // "me" of the dream is drawn to the given description.
        const first = { ...dr, beats: beats.slice(0, 4), dreamerLook: people || null };
        await movies.makeDreamPages(first, 'medium', async () => {});
        const page1 = first.pages && first.pages[0] && first.pages[0].url;
        if (!page1) throw new Error('no page rendered');
        // THE WHOLE PROMPT (Sophie's hard rule, 2026-08-24). movies.js hands
        // the page back carrying the exact sent text; this doc kept the
        // picture and nothing about how it was made.
        const fullPrompt = String((first.pages[0] || {}).promptUsed || '').slice(0, 6000);
        await ref.update({ status: 'done', label: 'done', page1, ...(fullPrompt ? { fullPrompt } : {}) });
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

Read the user's memory and reduce it to a single simple visual that captures its emotional essence — plus a tiny caption.

Rules for the visual:
* Return only one visual idea.
* Choose the simplest image that still communicates the memory.
* Prefer symbolic or cropped compositions over full scenes.
* Focus on one subject whenever possible.
* Eliminate unnecessary people, backgrounds, and objects.
* If an emotion can be shown through an object instead of a person, prefer the object.
* The illustration should be immediately understandable at a small size.
* Preserve the feeling, not the literal sequence of events.
* Do not describe artistic style, colors, lighting, or rendering.
* 1-3 concise sentences describing only what should appear in the illustration.

Rules for the caption:
* At most 6 words — it must fit on two short lines under a small picture.
* It names WHAT HAPPENED, not the picture (e.g. "Saw the same person twice", "The song answered my question").
* Plain, warm, no punctuation at the end, no quotes.

Return ONLY JSON: {"visual": "...", "caption": "..."}`;
      let visualBrief = desc, caption = null;
      try {
        const chat = await openaiChat({ model: 'gpt-4o-mini', temperature: 0.8, messages: [{ role: 'system', content: DISTILL_SYS }, { role: 'user', content: `Memory:\n${desc.slice(0, 1200)}` }] });
        const t = !chat.error && chat.choices?.[0]?.message?.content?.trim();
        if (t) {
          visualBrief = t; // fallback: the raw reply still works as a brief
          // parseJsonReply takes the whole chat RESPONSE (it digs out the
          // content itself) and throws on non-JSON — hence its own try.
          try {
            const j = parseJsonReply(chat);
            if (j && j.visual) { visualBrief = j.visual; caption = String(j.caption || '').trim().slice(0, 48) || null; }
          } catch {}
        }
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
      result = { url: await saveBufferToFirebase(Buffer.from(b64, 'base64'), 'image/webp', 'openai'), label: caption };
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

    // Claude, not mini (Aug 2026, Sophie) — a spell is prose a reader reads.
    const data = await anthropicChat({
      system,
      messages: [{ role: 'user', content: `Intent: ${intent}. Write one ${kind}.` }],
      max_tokens: 1200,
      temperature: 1,
    });
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json(parseAnthropicJson(data));
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
    // Claude, not mini (Aug 2026, Sophie) — this is teaching copy she ships.
    const data = await anthropicChat({ system, messages: [{ role: 'user', content: user }], max_tokens: 1600, temperature: 1 });
    if (data.error) return res.status(400).json({ error: data.error.message });
    const out = parseAnthropicJson(data);
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

    // Claude, not mini (Aug 2026, Sophie) — a natal reading is the words.
    const data = await anthropicChat({ system, messages: [{ role: 'user', content: user }], max_tokens: 2000, temperature: 1 });
    if (data.error) return res.status(400).json({ error: data.error.message });

    res.json({ chart, reading: parseAnthropicJson(data), place: placeName, coords: { lat, lon }, tz: zone, hasTime });
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
    // Which piece of the day to generate. The client requests two separate
    // parts so each lands as fast as possible: 'astro' (the short teaser +
    // omens shown right after "Reveal today's reading") and 'deep' (the long
    // Dive-deeper page, requested in PARALLEL with the teaser so it's ready
    // by the time the button is tapped). The daily TAROT is no longer
    // generated — the cards read from the committed corpus client-side
    // (witch-tarot-readings.json / GET /api/witch/tarot-readings), instantly
    // and for free. No part = the legacy combined reading (stale cached
    // clients), which still writes a tarot reading so old pages don't break.
    const part = ['astro', 'deep'].includes(req.body && req.body.part) ? req.body.part : null;
    // 13-sign ASTRONOMICAL zodiac (real, unequal constellation boundaries the Sun
    // actually crosses, Ophiuchus included) — boundaries in tropical ecliptic
    // longitude. When zodiac==='astronomical' the reading is built from these
    // constellations instead of the tropical signs. See docs/witch-daily-reading-prompt.md.
    const astronomical = zodiac === 'astronomical';
    const ASTRO_SEG = [['Aries',28,52],['Taurus',52,90],['Gemini',90,118],['Cancer',118,137],['Leo',137,173],['Virgo',173,217],['Libra',217,241],['Scorpio',241,247],['Ophiuchus',247,265],['Sagittarius',265,300],['Capricorn',300,327],['Aquarius',327,350],['Pisces',350,388]];
    const con13 = (lon) => { let L = ((lon % 360) + 360) % 360; for (const [n,a,b] of ASTRO_SEG) { if (b > 360) { if (L >= a || L < b - 360) return n; } else if (L >= a && L < b) return n; } return null; };
    const signOf = (body) => (astronomical && body && isFinite(body.lon)) ? (con13(body.lon) || body.sign) : (body && body.sign);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' });
    if (!part && (!Array.isArray(cards) || cards.length !== 3)) return res.status(400).json({ error: 'cards must be the 3-card daily pull' });

    const db = admin.apps.length ? admin.firestore() : null;

    // Resolve the natal chart if birth details are available (personalizes the
    // astrology). lat/lon/tz can be passed by the client (cached from /natal) to
    // skip geocoding; otherwise geocode once here.
    let natal = null, bigThree = null, transitList = null, tAspects = null, birthErr = null;
    if (birth && birth.date && /^\d{4}-\d{2}-\d{2}$/.test(birth.date) && astro && tzlookup) {
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
    if (astro) {
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
    const partRef = docRef;
    const partHash = part && hashOf({ v: 5, part, z: zodiac, b: bigThree, moonPhase });
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

    const voice = WITCH_VOICE;

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
  "reading": "2 short paragraphs weaving the three cards into one throughline for today"
}`;
    const tarotUser = `Date: ${date}.
Their daily 3-card tarot pull (past / present / future):
${cardLines}

Write the reading now.`;

    // ── Split-part generation (the current client) ────────────────────────
    // 'astro' = the short teaser (headline/reading/omens) on the Today page;
    // 'deep' = the long Dive-deeper page (reading + ingredients + ritual).
    // Both run on gpt-4o at a HIGH temperature (1.2) — Sophie's pick, to make
    // the readings get really weird.
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
        const aData = await openaiChat({ model: 'gpt-4o', temperature: 1.2, response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: teaserSystem }, { role: 'user', content: astroUser }] });
        if (aData.error) return res.status(400).json({ error: (aData.error.message || 'openai error') + ' (astrology)' });
        let astrology;
        try { astrology = parseJsonReply(aData); }
        catch (e) { return res.status(502).json({ error: 'Could not parse the astrology reading — try again.', detail: e.message }); }
        const intention = astrology.intention || '';
        delete astrology.intention;
        out = { astrology, intention, hasChart: Boolean(natal && bigThree) };
        if (bigThree) out.bigThree = bigThree;
      } else {
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
        const dData = await openaiChat({ model: 'gpt-4o', temperature: 1.2, response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: deepSystem }, { role: 'user', content: deepUser }] });
        if (dData.error) return res.status(400).json({ error: (dData.error.message || 'openai error') + ' (deep reading)' });
        let deep;
        try { deep = parseJsonReply(dData); }
        catch (e) { return res.status(502).json({ error: 'Could not parse the deeper reading — try again.', detail: e.message }); }
        out = { deep, hasChart: Boolean(natal && bigThree) };
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
      openaiChat({ model: 'gpt-4o', temperature: 1.2, response_format: { type: 'json_object' },
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
  // Committed static data — cache it like the readings corpus so a repeat open
  // doesn't re-fetch the map before it can show a flipped card's real art.
  res.set('Cache-Control', 'public, max-age=3600');
  if (!TAROT_DECK) return res.json({ configured: false, cards: {} });
  res.json({ configured: true, count: Object.keys(TAROT_DECK).length, cards: TAROT_DECK });
});

// ─── Written card meanings (the committed corpus) ───────────────────────
// The FREE daily pull no longer costs a model call: every card's meanings and
// longer "depth" paragraphs are written once, committed as
// witch-tarot-readings.json, and served here. The client picks a variant with
// the same per-day seed the pull uses, so today's read is stable and instant.
// Shape: { version, advice:[...], cards: { "<card name>": { upright:{meanings,depth}, reversed:{...} } } }
let TAROT_READINGS = null;
try { TAROT_READINGS = require('./witch-tarot-readings.json'); } catch (e) { /* corpus optional — client falls back to the deck's own strings */ }
app.get('/api/witch/tarot-readings', (req, res) => {
  res.set('Cache-Control', 'public, max-age=600');
  if (!TAROT_READINGS) return res.json({ configured: false, version: 0, advice: [], cards: {} });
  res.json({
    configured: true,
    version: TAROT_READINGS.version || 1,
    advice: Array.isArray(TAROT_READINGS.advice) ? TAROT_READINGS.advice : [],
    cards: TAROT_READINGS.cards || {},
  });
});

// ─── "Ask the cards" — members-only question readings (background job) ──
// The paid tarot: their own question + a real spread (one / three / horseshoe
// / Celtic Cross), drawn client-side and interpreted here. Fire-and-forget job
// on a Firestore doc so a reading survives leaving the app (CLAUDE.md
// background-job rule); the client polls GET /api/witch/tarot-ask/:id.
const TAROT_ASK_COLL = 'forge-witch-readings';
const TAROT_ASK_SPREADS = {
  one: 'One Card',
  three: 'Past · Present · Future',
  horseshoe: 'Horseshoe',
  celtic: 'Celtic Cross',
};
const TAROT_ASK_STALE_MS = 5 * 60 * 1000; // a 'working' doc older than this is a dead job
// Verify the caller's Firebase ID token against membry-df528 (where the witch
// app's accounts live). Mirrors stripe.js's identify().
async function witchIdentify(req) {
  const hdr = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const tok = hdr || (req.body && req.body.idToken) || req.query.idToken || '';
  if (!tok) return null;
  try {
    await storyDb();
    if (!storyApp) return null;
    const dec = await storyApp.auth().verifyIdToken(String(tok));
    return { uid: dec.uid };
  } catch { return null; }
}
// A paid feature is never unlocked on the client's word — the membership is
// re-read server-side from the same doc the Stripe webhook writes.
async function witchIsMember(uid) {
  try {
    await storyDb();
    if (!storyApp) return false;
    const snap = await storyApp.firestore().collection('users').doc(uid).get();
    const m = snap.exists ? (snap.data().membership || null) : null;
    return !!(m && m.active);
  } catch { return false; }
}
app.post('/api/witch/tarot-ask', async (req, res) => {
  try {
    const who = await witchIdentify(req);
    if (!who) return res.status(401).json({ error: 'sign in first' });
    // FREE FOR NOW (App Store first review, 2026-07-28): membership gate off
    // until the app passes review and Stripe is live — a reading costs cents
    // and nobody has the feature yet. PUT IT BACK then (the client-side gate
    // in witch.html startAskReading() is commented out the same way):
    // if (!(await witchIsMember(who.uid))) return res.status(402).json({ error: 'membership required' });
    const body = req.body || {};
    const question = String(body.question || '').trim().slice(0, 500);
    const spread = TAROT_ASK_SPREADS[body.spread] ? body.spread : 'three';
    const spreadName = TAROT_ASK_SPREADS[spread];
    const cards = (Array.isArray(body.cards) ? body.cards : []).slice(0, 12).map((c) => ({
      name: String((c && c.name) || '').trim().slice(0, 60),
      orientation: c && c.orientation === 'reversed' ? 'reversed' : 'upright',
      position: String((c && c.position) || '').trim().slice(0, 60),
    })).filter((c) => c.name);
    if (!cards.length) return res.status(400).json({ error: 'cards is required' });
    if (!admin.apps.length) return res.status(503).json({ error: 'readings storage not configured' });

    const db = admin.firestore();
    const ref = db.collection(TAROT_ASK_COLL).doc();
    await ref.set({
      uid: who.uid, question, spread, spreadName, cards,
      status: 'working', result: null, error: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ id: ref.id });

    // Fire-and-forget: the reading is written onto the doc, never awaited here.
    (async () => {
      try {
        const cardList = cards.map((c, i) => `${c.position ? c.position : `Card ${i + 1}`}: ${c.name} (${c.orientation})`).join('\n');
        const system = `You are the tarot reader for "Secretly a Witch". Your voice is ${WITCH_VOICE}
You are reading a ${spreadName} spread (Rider-Waite). Read the cards they actually drew — each one in ITS OWN position, then together as one throughline. Do not mention astrology, transits, or the moon.${question ? `
THEY ASKED A QUESTION. Answer it. Say what the cards say about that exact question, plainly and specifically — never dodge it, never redirect to "what really matters", never give a general reading that could answer anything. If the cards point somewhere uncomfortable, say so kindly and concretely.` : `
They did not ask anything specific, so read the spread as a general reading of where they are right now.`}
Return VALID JSON ONLY, no markdown fences, exactly this shape:
{
  "cards": [ { "name": "...", "position": "...", "meaning": "1-2 sentences for this card in this position and orientation" } ],
  "reading": "2-3 short paragraphs (separate them with a blank line) weaving the cards into one message${question ? ', ending on a clear answer to their question' : ''}"
}
Give one "cards" entry per card drawn, in the order given, with the position copied exactly.`;
        const userMsg = `Spread: ${spreadName}.${question ? `\nTheir question: ${question}` : '\n(No specific question — a general reading.)'}
Cards drawn:
${cardList}

Write the reading now.`;
        const data = await anthropicChat({ system, messages: [{ role: 'user', content: userMsg }], max_tokens: 1800, temperature: 1 });
        if (data.error) throw new Error(data.error.message || 'anthropic error');
        const result = parseAnthropicJson(data);
        if (!result || !result.reading) throw new Error('the reader came back empty');
        await ref.update({ status: 'done', result, error: null });
      } catch (err) {
        console.warn('witch tarot-ask failed —', err.message);
        await ref.update({ status: 'error', error: String(err.message || err) }).catch(() => {});
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Poll one reading. Token-authed and scoped to its owner — a reading already
// started stays readable even if the membership lapses mid-poll.
app.get('/api/witch/tarot-ask/:id', async (req, res) => {
  try {
    const who = await witchIdentify(req);
    if (!who) return res.status(401).json({ error: 'sign in first' });
    if (!admin.apps.length) return res.status(503).json({ error: 'readings storage not configured' });
    const ref = admin.firestore().collection(TAROT_ASK_COLL).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'not found' });
    let d = snap.data();
    if (d.uid !== who.uid) return res.status(404).json({ error: 'not found' });
    // The job is an in-memory closure, so a restart mid-reading orphans the doc
    // at 'working' forever — past this margin, call it what it is.
    if (d.status === 'working' && d.createdAt && Date.now() - d.createdAt.toMillis() > TAROT_ASK_STALE_MS) {
      const error = 'This took much longer than usual — the server may have restarted. Draw again to retry.';
      await ref.update({ status: 'error', error }).catch(() => {});
      d = { ...d, status: 'error', error };
    }
    res.json({
      status: d.status, question: d.question || '', spread: d.spread, spreadName: d.spreadName,
      cards: d.cards || [], result: d.result || null, error: d.error || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Shop proxy (secretlyawitch.com Shopify storefront) ─────────────────
// Pulls the public products.json so the app's Shop tab shows real products
// (image, title, price, link) without any storefront token. Cached in memory
// ~10 min. Every product's own URL still opens the real Shopify checkout.
const SHOP_TTL_MS = 10 * 60 * 1000;
let SHOP_CACHE = { at: 0, data: null, refreshing: false };
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
  // Both card sets shorten to plain "Witchcraft Cards", which read as the same
  // product twice in the Cards tab. Only the newer one is renamed, so the
  // long-standing listing keeps the name it has always had.
  'witchcraft-cards-233495': 'Witchcraft Cards — Set of 4',
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
// ─── Shop categories ────────────────────────────────────────────────
// The store has no usable grouping of its own: `product_type` is empty on
// every product, the 359 tags are SEO keywords, and the 146 Shopify
// collections are stale duplicates shared with the other brands. So the Shop
// tab's categories are derived here from the product name.
// Matched against the SHORT display name, never the full title — the SEO
// titles are keyword soup ("…witchcraft cards gift…") and drag products into
// the wrong bucket. First rule that matches wins, so order matters: 'cards'
// before 'kits' (an "apothecary reference cards" deck is cards, not a kit),
// 'kits' before 'crystals' (a "crystal mystery kit" is a kit).
// Array order = the order the filter bar shows them in (Sophie's call).
const SHOP_CATEGORIES = [
  { key: 'kits', name: 'Kits & sets', re: /\bkits?\b|mystery box|starter|apothecary|tea set/i },
  { key: 'cards', name: 'Cards', re: /tarot|rider-?waite|\bdeck\b|\bcards?\b|journal|book of shadows/i },
  { key: 'altar', name: 'Altar tools', re: /chalice|altar|\bbell\b|cauldron|mortar|pestle|bowl|candle|chest|pendulum|cloth|table|shelf|wand/i },
  { key: 'crystals', name: 'Crystals', re: /crystal|labradorite|selenite|carnelian|fluorite|mineral|palm stone|advent/i },
  { key: 'jewelry', name: 'Jewelry', re: /necklace|pendant|talisman|choker|bracelet|earring/i },
  { key: 'potions', name: 'Potions, oils & herbs', re: /\boils?\b|potion|\bsalt\b|\bherbs?\b|incense/i },
];
// ─── The head of the shelf (Sophie's picks, Aug 2026) ───────────────
// Everything else is ordered by Etsy's `featured_rank`, but Etsy has NO API for
// it — updateListing cannot write featured_rank — so the handful she wants up
// front is pinned here by handle instead. Anything not listed keeps its Etsy
// order behind them, and this changes the APP's shelf only; Etsy's own shop
// order still has to be dragged in Etsy.
// The Cards tab is this same list filtered, so a card's place here IS its place
// there: Magic Rituals sits above the apothecary/mineralogy set so that it
// leads the Cards tab (Sophie: "at the top of the cards tab, the first one"),
// which costs that set one place in All.
const SHOP_PINNED = [
  'huge-witchcraft-kit-witch-alter-sets-86658',      // Witchcraft Kit
  'witchy-essential-43160',                          // Witchy Essential Oils
  'witchcraft-apothecary-w-mortar-and-54053',        // the apothecary kit
  'magic-rituals-card-deck-217746',                  // first card in the Cards tab
  'witchcraft-cards-apothecary-crystal-19221',       // apothecary + mineralogy, set of 2
  'boo-boo-doll-healing-witchcraft-magic-kiss-band-aid-457217',  // near the top, not at it
];
function shopApplyPins(products) {
  const rank = new Map(SHOP_PINNED.map((h, i) => [h, i]));
  const pinned = [], rest = [];
  for (const p of products) (rank.has(p.handle) ? pinned : rest).push(p);
  pinned.sort((a, b) => rank.get(a.handle) - rank.get(b.handle));
  return pinned.concat(rest);
}
// Evaluation order — deliberately NOT the display order above. Changing how
// the bar reads must never change which bucket a product lands in.
const SHOP_CAT_ORDER = ['cards', 'jewelry', 'kits', 'potions', 'crystals', 'altar'];
function shopCategory(shortName) {
  for (const key of SHOP_CAT_ORDER) {
    const c = SHOP_CATEGORIES.find(x => x.key === key);
    if (c && c.re.test(shortName || '')) return c.key;
  }
  return 'altar'; // ritual objects are the catch-all
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
  // Order = Sophie's actual Etsy shop arrangement, which lives in
  // `featured_rank`, NOT the order the API hands listings back (that's by
  // creation date and put oils first instead of the witchcraft kit). Rank is
  // 0-based and 0 IS a real position — the top slot — so only -1/null means
  // "not featured"; those keep the API's own order and sit after the pinned
  // ones. Etsy has no endpoint for the full shop sort, so featured_rank is the
  // closest signal to what a visitor sees.
  const rank = (l) => (typeof l.featured_rank === 'number' && l.featured_rank >= 0
    ? l.featured_rank : Number.POSITIVE_INFINITY);
  const ordered = (r.results || [])
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (rank(a.l) - rank(b.l)) || (a.i - b.i))
    .map(x => x.l);
  const list = ordered.map((l, i) => ({ idx: i, id: l.listing_id, title: l.title, words: new Set(shopWords(l.title)) }));
  ETSY_SHOP_LISTINGS = { at: now, list, shopId };
  return list;
}

// Building the shelf means TWO slow upstreams — Shopify's products.json and the
// Etsy listing order — so it is cached, and (below) served stale while it
// refreshes rather than making whoever opened the tab wait for both.
async function buildShopPayload(debug) {
  {
    // The store's permanent .myshopify.com home — NOT secretlyawitch.com,
    // which now points at this very app (fetching it would loop back to us).
    const base = witchStoreOrigin();
    const r = await fetch(`${base}/products.json?limit=100`, { headers: { 'User-Agent': 'SecretlyAWitch/1.0 (app shop)' } });
    if (!r.ok) throw new Error(`shop returned ${r.status}`);
    const j = await r.json();
    // The store is shared with other brands; drop obvious non-witch items.
    const EXCLUDE = /people\s*watching|in case of amnesia|remember things|custom order|incel/i;
    let products = (j.products || []).filter(p => !EXCLUDE.test(p.title || '')).map(p => {
      const v = (p.variants || [])[0] || {};
      const img = (p.images || [])[0] || {};
      // Price the shelf off the variants a shopper can actually buy — a
      // sold-out cheap option would otherwise advertise a floor that isn't
      // purchasable. Fall back to all variants when nothing is in stock.
      const priceable = (p.variants || []).filter(x => x.available);
      const prices = (priceable.length ? priceable : (p.variants || []))
        .map(x => parseFloat(x.price)).filter(n => isFinite(n));
      return {
        id: p.id, title: p.title, handle: p.handle,
        url: `${base}/products/${p.handle}`,
        image: img.src || null,
        price: v.price || null,
        priceMin: prices.length ? Math.min(...prices).toFixed(2) : null,
        // Lets the tile say "from $X" instead of implying the cheapest option
        // is the product's price (kits start at a just-the-cards variant).
        priceMax: prices.length ? Math.max(...prices).toFixed(2) : null,
        available: (p.variants || []).some(x => x.available),
        type: p.product_type || '',
      };
    });

    // Cross-reference Etsy for ORDER and clean short names. The whole catalog
    // is shown (Sophie, 2026-07: the tab used to hide the ~half of the store
    // with no Etsy twin) — Etsy-matched items lead, in Etsy's featured order,
    // and everything else follows in the store's own order.
    let dbg = null;
    try {
      const listings = await etsyActiveListings();
      if (listings && listings.length) {
        // The Shuttle importer stamped each Shopify handle with the last 4-6
        // digits of the Etsy listing it came from
        // (huge-witchcraft-kit-witch-alter-sets-86658 -> listing 710086658).
        // That is an EXACT key and resolves 39/39 of the suffixed catalog, so
        // it wins outright — word overlap can't separate near-identical titles
        // and was handing "HUGE WITCHCRAFT KIT" to the wrong kit (the 77-review
        // product instead of the 980-review one), which also dropped the real
        // best seller from the shelves entirely.
        const bySuffix = (handle) => {
          const m = /-(\d{4,6})$/.exec(handle || '');
          if (!m) return null;
          const hits = listings.filter(l => String(l.id).endsWith(m[1]));
          return hits.length === 1 ? hits[0] : null; // ambiguous suffix -> fall through
        };
        const scored = products.map(p => {
          const pinned = bySuffix(p.handle);
          if (pinned) return { p, best: pinned, bestScore: Infinity, pinned: true };
          const pw = shopWords(p.title);
          let best = null, bestScore = 0;
          for (const l of listings) {
            let sc = 0; for (const w of pw) if (l.words.has(w)) sc++;
            if (sc > bestScore) { bestScore = sc; best = l; }
          }
          return { p, best, bestScore };
        });
        // One Shopify product per Etsy listing. A handle-pinned match always
        // beats a guessed one, so a fuzzy hit can never steal a listing that
        // its real twin claims by id.
        const byEtsy = new Map();
        for (const s of scored) {
          if (!s.best || s.bestScore < 2) continue;
          const cur = byEtsy.get(s.best.id);
          if (!cur || s.bestScore > cur.bestScore) byEtsy.set(s.best.id, s);
        }
        // A pinned product must never be dropped just because some other
        // product also fuzzy-matched its listing first.
        for (const s of scored) {
          if (s.pinned && byEtsy.get(s.best.id) !== s) byEtsy.set(s.best.id, s);
        }
        const kept = [...byEtsy.values()].sort((a, b) => a.best.idx - b.best.idx);
        const keptIds = new Set(kept.map(s => s.p.id));
        const rest = scored.filter(s => !keptIds.has(s.p.id)); // no Etsy twin — still sold here
        products = [...kept, ...rest].map(s => ({ ...s.p, title: shopShortName(s.p.title, s.p.handle), fullTitle: s.p.title }));
        if (debug) dbg = {
          etsyCount: listings.length, shopifyCount: scored.length, etsyMatched: kept.length, unmatchedShown: rest.length,
          matches: kept.map(s => ({ name: shopShortName(s.p.title, s.p.handle), etsy: s.best.title, score: s.bestScore, handle: s.p.handle })),
          unmatchedEtsy: listings.filter(l => !byEtsy.has(l.id)).map(l => l.title),
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

    // Sophie's pinned picks lead the shelf, whatever Etsy's featured order said.
    products = shopApplyPins(products);

    // Tag each product with its category, and report only the categories that
    // actually have stock so the filter bar never shows an empty tab.
    products = products.map(p => ({ ...p, category: shopCategory(p.title) }));
    const used = new Set(products.map(p => p.category));
    const categories = SHOP_CATEGORIES.filter(c => used.has(c.key))
      .map(c => ({ key: c.key, name: c.name, count: products.filter(p => p.category === c.key).length }));

    const out = { updatedAt: new Date().toISOString(), count: products.length, storeUrl: base, categories, products };
    if (debug) return { ...out, debug: dbg };
    SHOP_CACHE = { at: Date.now(), data: out, refreshing: false };
    return out;
  }
}

// Stale-while-revalidate. A warm cache answers instantly; an EXPIRED cache also
// answers instantly and the rebuild runs behind the response instead of under
// it, so opening the Shop tab stops waiting on Shopify + Etsy once the app has
// served the shelf even once.
app.get('/api/witch/shop', async (req, res) => {
  try {
    if (req.query.debug === '1') return res.json(await buildShopPayload(true));
    if (SHOP_CACHE.data) {
      if (Date.now() - SHOP_CACHE.at >= SHOP_TTL_MS && !SHOP_CACHE.refreshing) {
        SHOP_CACHE.refreshing = true;
        buildShopPayload(false).catch(() => {}).finally(() => { SHOP_CACHE.refreshing = false; });
      }
      return res.json(SHOP_CACHE.data);
    }
    res.json(await buildShopPayload(false));
  } catch (err) {
    // A stale shelf beats an error page.
    if (SHOP_CACHE.data) return res.json(SHOP_CACHE.data);
    res.status(500).json({ error: err.message });
  }
});

// ─── Secretly a Witch: in-app buying (Storefront API cart) ──────────
// The Shop tab sells IN the app: product sheet → cart → hand off to Shopify's
// secure checkout only for the pay screen (the Buy-Button model, but via the
// modern Storefront API instead of the legacy buy-button-js library).
// The token is a PUBLIC storefront token — read-only product/cart scope,
// designed to be embedded in client pages (this one already ships in
// thepeoplewatchingclub.com's page source for the same store), so committing
// it here is safe. Env override for a future store change.
const WITCH_STOREFRONT_DOMAIN = 'cod-god-inc.myshopify.com';
const witchStorefrontToken = () => process.env.WITCH_STOREFRONT_TOKEN || 'fffce1a7cf0342aedd0609333d90e3de';
async function witchStorefront(query, variables) {
  const r = await fetch(`https://${WITCH_STOREFRONT_DOMAIN}/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': witchStorefrontToken() },
    body: JSON.stringify({ query, variables: variables || {} }),
  });
  const j = await r.json();
  if (j.errors && j.errors.length) throw new Error(j.errors[0].message || 'storefront error');
  return j.data || {};
}
const WITCH_CART_FIELDS = `id checkoutUrl totalQuantity
  cost { subtotalAmount { amount currencyCode } }
  lines(first: 60) { edges { node { id quantity
    cost { totalAmount { amount } }
    merchandise { ... on ProductVariant { id title image { url } product { title handle } } } } } }`;
function witchCartSummary(cart) {
  if (!cart) return null;
  return {
    id: cart.id,
    checkoutUrl: cart.checkoutUrl,
    count: cart.totalQuantity || 0,
    subtotal: cart.cost?.subtotalAmount?.amount || '0',
    lines: (cart.lines?.edges || []).map(e => ({
      id: e.node.id,
      quantity: e.node.quantity,
      total: e.node.cost?.totalAmount?.amount || null,
      variantId: e.node.merchandise?.id || null,
      variant: e.node.merchandise?.title || '',
      title: e.node.merchandise?.product?.title || '',
      handle: e.node.merchandise?.product?.handle || '',
      image: e.node.merchandise?.image?.url || null,
    })),
  };
}

// Product detail for the in-app product sheet (images, variants w/ the GIDs
// the cart needs, description). Cached: the sheet opens a lot.
const WITCH_PRODUCT_CACHE = new Map();
app.get('/api/witch/shop/product/:handle', async (req, res) => {
  try {
    const handle = String(req.params.handle || '');
    const hit = WITCH_PRODUCT_CACHE.get(handle);
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return res.json(hit.data);
    // `options` + each variant's `selectedOptions` are what let the sheet show
    // one dropdown PER option (kit type, journal or not) the way Etsy does,
    // instead of one button per combination.
    const data = await witchStorefront(`query($handle: String!) {
      product(handle: $handle) {
        title descriptionHtml
        options { name values }
        images(first: 8) { edges { node { url } } }
        variants(first: 40) { edges { node { id title availableForSale price { amount currencyCode }
          selectedOptions { name value } } } }
      } }`, { handle });
    if (!data.product) return res.status(404).json({ error: 'not found' });
    const p = data.product;
    const out = {
      handle,
      title: p.title,
      descriptionHtml: p.descriptionHtml || '',
      images: (p.images?.edges || []).map(e => e.node.url),
      // Shopify gives every product a synthetic "Title: Default Title" option;
      // it isn't a choice, so it never becomes a dropdown.
      options: (p.options || [])
        .filter(o => (o.values || []).length && !(o.name === 'Title' && o.values.length === 1 && o.values[0] === 'Default Title'))
        .map(o => ({ name: o.name, values: o.values })),
      variants: (p.variants?.edges || []).map(e => ({
        id: e.node.id,
        title: e.node.title,
        available: Boolean(e.node.availableForSale),
        price: e.node.price?.amount || null,
        // { "Kit": "travel kit", "Journal": "yes, include journal" }
        options: (e.node.selectedOptions || []).reduce((m, o) => { m[o.name] = o.value; return m; }, {}),
      })),
    };
    WITCH_PRODUCT_CACHE.set(handle, { at: Date.now(), data: out });
    res.json(out);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Read a cart. Returns { cart: null } for an expired/unknown id so the client
// can quietly start fresh (Shopify carts expire after ~10 days).
app.get('/api/witch/cart', async (req, res) => {
  try {
    const id = String(req.query.id || '');
    if (!id) return res.json({ cart: null });
    const data = await witchStorefront(`query($id: ID!) { cart(id: $id) { ${WITCH_CART_FIELDS} } }`, { id });
    res.json({ cart: witchCartSummary(data.cart) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Add a line. Reuses the caller's cart when it still exists, otherwise (or
// with no cartId) creates one — the client just stores whatever id comes back.
app.post('/api/witch/cart/add', async (req, res) => {
  try {
    const { cartId, variantId } = req.body || {};
    if (!variantId) return res.status(400).json({ error: 'variantId required' });
    const quantity = Math.max(1, Math.min(99, parseInt(req.body?.quantity, 10) || 1));
    const lines = [{ merchandiseId: String(variantId), quantity }];
    let cart = null;
    if (cartId) {
      try {
        const d = await witchStorefront(`mutation($cartId: ID!, $lines: [CartLineInput!]!) {
          cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ${WITCH_CART_FIELDS} } userErrors { message } } }`,
          { cartId: String(cartId), lines });
        if (d.cartLinesAdd?.userErrors?.length && !d.cartLinesAdd?.cart) throw new Error(d.cartLinesAdd.userErrors[0].message);
        cart = d.cartLinesAdd?.cart || null;
      } catch (e) { cart = null; /* expired/bad cart — fall through to a fresh one */ }
    }
    if (!cart) {
      const d = await witchStorefront(`mutation($lines: [CartLineInput!]!) {
        cartCreate(input: { lines: $lines }) { cart { ${WITCH_CART_FIELDS} } userErrors { message } } }`, { lines });
      if (d.cartCreate?.userErrors?.length && !d.cartCreate?.cart) return res.status(400).json({ error: d.cartCreate.userErrors[0].message });
      cart = d.cartCreate?.cart || null;
    }
    res.json({ cart: witchCartSummary(cart) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Change a line's quantity (0 removes it).
app.post('/api/witch/cart/update', async (req, res) => {
  try {
    const { cartId, lineId } = req.body || {};
    if (!cartId || !lineId) return res.status(400).json({ error: 'cartId and lineId required' });
    const quantity = Math.max(0, Math.min(99, parseInt(req.body?.quantity, 10) || 0));
    const d = quantity === 0
      ? await witchStorefront(`mutation($cartId: ID!, $ids: [ID!]!) {
          cartLinesRemove(cartId: $cartId, lineIds: $ids) { cart { ${WITCH_CART_FIELDS} } userErrors { message } } }`,
          { cartId: String(cartId), ids: [String(lineId)] })
      : await witchStorefront(`mutation($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
          cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ${WITCH_CART_FIELDS} } userErrors { message } } }`,
          { cartId: String(cartId), lines: [{ id: String(lineId), quantity }] });
    const node = d.cartLinesRemove || d.cartLinesUpdate || {};
    if (node.userErrors?.length && !node.cart) return res.status(400).json({ error: node.userErrors[0].message });
    res.json({ cart: witchCartSummary(node.cart) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// THE WHOLE PROMPT IS STORED WHEREVER AN IMAGE IS MADE (Sophie's hard rule,
// 2026-08-24; her follow-up 2026-08-25: "any surface or endpoint or route or
// anything"). The four /api/generate/* image routes below were the last
// stateless ones — they built a full prompt, handed the picture back and
// persisted nothing, so the exact text existed for the length of one request.
// Each saved image now files into My Creations with the whole prompt through
// the one shared filer (style-test and deck-batch proxy into these routes
// internally, so they are covered by the same four calls). Fire-and-forget:
// a gallery hiccup must never fail a render that already exists.
function fileGenerateRoute({ url, prompt, full, prefix, suffix, model, quality, canvas, style }) {
  Promise.resolve()
    .then(() => fileCreationDoc({
      url, prompt, fullPrompt: full || prompt, promptPrefix: prefix, promptSuffix: suffix,
      model, quality, canvas, style, source: 'teststation',
    }))
    .catch((err) => console.warn('generate → My Creations failed:', err.message));
}

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
    // What WE sent is the record; DALL·E's own rewrite rides the style slot so
    // neither text is lost and neither is filed as the other.
    fileGenerateRoute({ url: permanentUrl, prompt, full: prompt,
      model: 'dall-e-3', quality, canvas: size,
      style: data.data[0].revised_prompt ? 'dalle rewrote the prompt' : '' });
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
    // Verbatim surface — her words go through untouched, so there is no style
    // half to file and the full prompt IS the content.
    fileGenerateRoute({ url, prompt, full: prompt,
      model: 'gpt-image-2', quality, canvas: size });
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── House style: gpt-image-2 EDITS with Sophie's style-reference images ──
// The same engine the illustrated lessons use (not a LoRA): the two style refs
// are attached as pure STYLE anchors and the house style prompt is prepended.
// Refs live privately in Storage (witch-school/refs/sophie-snake.png and
// sophie-animals.png) and are cached in memory after the first fetch.
const houseRefCache = new Map();
async function loadHouseRef(storagePath) {
  if (houseRefCache.has(storagePath)) return houseRefCache.get(storagePath);
  if (!bucket) throw new Error('Firebase not configured (style refs live in Storage)');
  const [buf] = await bucket.file(storagePath).download();
  houseRefCache.set(storagePath, buf);
  return buf;
}
// Multi-reference gpt-image-2 edit (accepts several image[] style anchors).
// `timeout` is per attempt — a medium 1024x1536 render can run well past the
// 90s that suits the low-quality square calls, so callers can raise it.
async function openaiImageEditRefs(prompt, refBuffers, { quality = 'low', size = '1024x1024', timeout = 90000, moderation = 'low' } = {}, retries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const form = new FormData();
      form.append('model', 'gpt-image-2');
      form.append('prompt', prompt);
      form.append('size', size);
      form.append('quality', quality);
      form.append('output_format', 'webp');
      // MODERATION: LOW BY DEFAULT (Aug 2026, Sophie's call). gpt-image-2's
      // filter is stochastic on identical input — a Dreamy prompt of hers drew
      // fine at two sizes and was then refused twice in a row minutes later
      // with safety_violations=[violence] (raw meat and a bare chest in a
      // cartoon). A refusal costs a run and reads as a bug, and the pictures
      // this app makes are her own illustrations. `low` is OpenAI's documented
      // less-restrictive setting and the ONLY alternative — there is no
      // "none", and CSAM and a handful of other categories are refused at
      // every setting, so this cannot be turned off further and should not be
      // described to her as if it could.
      if (moderation) form.append('moderation', moderation);
      // NO output_compression. This is a LOSSY setting applied by OpenAI
      // BEFORE the bytes come back, so whatever it throws away is gone for
      // good — it cannot be undone later, only re-drawn (and a re-draw is a
      // different picture). It was here by a conflation with the house rule
      // about never SERVING a raw PNG to a page: that rule is about derived
      // display copies (scripts/webp-assets.js, the `thumbs/` service above),
      // and the original it derives from has to stay full quality. Sophie
      // caught it as graininess on fine ink hatching, 2026-08-19. Do not put
      // a compression back on a generation call.
      refBuffers.forEach((b, i) => form.append('image[]', b, { filename: `ref${i + 1}.png`, contentType: 'image/png' }));
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
// The flood-fill whiten pass lives in its own file (whiten-bg.js) since
// 2026-08-26: the Story Room's PASTEL style draws this same recipe from
// scratchpad.js, which cannot reach in here, and a second copy of a
// twenty-line flood fill is exactly the drift this repo keeps paying for.
const { whitenBackground } = require('./whiten-bg');
app.post('/api/generate/housestyle', async (req, res) => {
  try {
    // Default MEDIUM — matches how the illustrated lessons (specA) were rendered.
    const { prompt, styleId = 'house-pastel', quality = 'medium' } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });
    if (!OPENAI_API_KEY) return res.status(400).json({ error: 'OPENAI_API_KEY not set on the server' });
    const style = (MODELS.house || []).find(s => s.id === styleId);
    if (!style) return res.status(400).json({ error: `unknown house style: ${styleId}` });
    const refs = await Promise.all((style.refs || []).map(loadHouseRef));
    if (!refs.length) return res.status(400).json({ error: 'house style has no reference images' });
    const full = (style.stylePrompt || '') + prompt + (style.end || '');
    const data = await openaiImageEditRefs(full, refs, { quality });
    if (data.error) return res.status(400).json({ error: data.error.message || 'gpt-image-2 edit error' });
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return res.status(400).json({ error: 'gpt-image-2 returned no image' });
    let buf = Buffer.from(b64, 'base64');
    if (style.whiten) { try { buf = await whitenBackground(buf); } catch (e) { console.warn('house whiten failed:', e.message); } }
    const url = await saveBufferToFirebase(buf, 'image/webp', 'housestyle');
    // `full` is the literal string handed to the edits call two lines up; the
    // style's own prompt and tail are the wrapper around her words.
    fileGenerateRoute({ url, prompt, full,
      prefix: style.stylePrompt || '', suffix: style.end || '',
      model: 'gpt-image-2', quality, canvas: '1024x1024', style: style.name || styleId });
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
    // PNG by default — Flux's webp/jpg encode is LOSSY (output_quality, its
    // default 80), and these are ORIGINALS: the house-style renders, the wtr
    // dating-book art. Same rule as the gpt-image-2 paths: the original comes
    // back lossless; a page that needs a smaller file derives one. A caller
    // may still ask for webp/jpg explicitly, and then quality rides at 100.
    const outputFormat = settings.output_format ?? 'png';
    const guidanceScale = settings.guidance_scale ?? 3;
    const outputQuality = settings.output_quality ?? 100;
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
    // The LoRA's wrapper is its trigger in front and its suffix behind —
    // `fullPrompt` is what was actually sent. One filing per output.
    for (const u of permanentUrls) {
      fileGenerateRoute({ url: u, prompt, full: fullPrompt,
        prefix: known ? known.trigger : '', suffix: known?.promptSuffix || '',
        model, style: known ? known.name : '' });
    }
    res.json({ url: permanentUrls[0], urls: permanentUrls });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Prompt Lab (try prompts against a LoRA — background jobs) ──────
// Sophie's prompt tester: fixed recipe (always 4 outputs, seed 85, 2:3,
// guidance 3, 28 steps) so runs stay comparable — only the words and the
// LoRA scale vary from the page. The trigger word is always prepended and
// the suffix always appended server-side, matching the hand-typed shape her
// scale tests used ("wtr little girl in a sundress. White background ").
// aspect_ratio / seed / suffix / model are accepted in the body for later
// even though the page doesn't expose them yet.
// House rule: generation is a fire-and-forget job on a Firestore doc — the
// POST returns the id in ~0.2s and the page polls GET /:id, resuming from
// localStorage if it was closed mid-run.
const PROMPTLAB = 'forge-promptlab';

// ─── The Playground's 3rd style: gpt-image-2 + Sophie's style reference ──
// Not a LoRA. Her own scanned ink-and-watercolour page is attached to
// gpt-image-2's EDITS endpoint as a pure STYLE reference at quality MEDIUM,
// 2:3 portrait — the recipe settled in docs/evan-film-style.md. The prefix
// below is baked in server-side and her typed words follow it verbatim,
// separated by a blank line; the page prints the whole thing in its "Sent as"
// line, so nothing about the prompt is hidden from her.
// The scan is the same file the Evan film uses (refs/sage-sandy-mirror.png =
// "datescan0013" — the page she attached when asking for this option).
const PL_GPT = {
  id: 'gpt-image-2', label: 'ChatGPT',
  quality: 'medium', qualities: ['low', 'medium', 'high'],
  size: '1024x1536', aspectRatio: '2:3', outputs: 1, maxOutputs: 4,
  // The canvas toggle (Aug 2026, Sophie: "make it so that you can toggle
  // between portrait and square"). Portrait stays the default — it is what
  // every run to date used, and it is the CHEAPER of the two.
  // **THE SQUARE COSTS MORE**, which is the opposite of everyone's guess:
  // gpt-image-2 charges 0.6c/5.3c/21.1c for 1024x1024 against 0.5c/4.1c/16.5c
  // for 1024x1536 (the one price table, docs/modules/pictures.md). The page
  // prints that on the toggle so she is never guessing.
  sizes: { portrait: { size: '1024x1536', aspectRatio: '2:3' },
           square:   { size: '1024x1024', aspectRatio: '1:1' } },
  // THE RESOLUTION TIERS (Aug 2026, Sophie: "adding the size as a toggle in
  // the playground for things I want to print versus things I'm using for like
  // videos"). Every surface in this repo had been pinned to 1024x1536 or
  // 1024x1024 — the only three sizes the OLD gpt-image-1 took. gpt-image-2
  // accepts ANY resolution inside its constraints (long edge <= 3840, both
  // edges a multiple of 16, ratio <= 3:1, 655,360 <= pixels <= 8,294,400), so
  // the model id was swapped and the size lines were simply never revisited.
  //
  // 2K and 4K here are the biggest EXACT 2:3 and 1:1 canvases at those pixel
  // budgets, not OpenAI's landscape presets: an exact 2:3 needs both edges a
  // multiple of 16, which forces w=2m/h=3m with m itself a multiple of 16, and
  // 2336x3504 is the largest such canvas under the 8,294,400 cap (2352x3528
  // would be 3,456 pixels over it). 1568x2352 lands on 3,687,936 — 2K to
  // within 1,536 pixels. The square tiers are exact: 1920² IS 3,686,400 and
  // 2880² IS 8,294,400.
  //
  // EVERY `cents` FIGURE IS MEASURED, NOT DERIVED (2026-08-22, via
  // scripts/measure-image-cost.js reading the API's own `usage`). The 1K rows
  // are OpenAI's published table; the rest are unpublished — the guide stops
  // at three sizes and says "additional sizes available". They CANNOT be
  // reasoned out from area, because gpt-image-2 does not price by area: 1920²
  // and 1568x2352 hold the same 3.69 megapixels and the square costs 50% more
  // at every quality. Re-measure rather than re-derive if the model changes.
  // (One relationship does hold across every size tested: high is exactly 4x
  // medium. Low is medium/8.71 portrait, medium/9 square.)
  res: {
    portrait: {
      aspectRatio: '2:3',
      tiers: {
        '1k': { size: '1024x1536', label: '1K', cents: { low: 0.5, medium: 4.1, high: 16.5 } },
        '2k': { size: '1568x2352', label: '2K', cents: { low: 0.75, medium: 6.55, high: 26.21 } },
        '4k': { size: '2336x3504', label: '4K', cents: { low: 1.35, medium: 11.74, high: 46.94 } },
      },
    },
    square: {
      aspectRatio: '1:1',
      tiers: {
        '1k': { size: '1024x1024', label: '1K', cents: { low: 0.6, medium: 5.3, high: 21.1 } },
        '2k': { size: '1920x1920', label: '2K', cents: { low: 1.09, medium: 9.83, high: 39.31 } },
        '4k': { size: '2880x2880', label: '4K', cents: { low: 1.98, medium: 17.79, high: 71.16 } },
      },
    },
  },
  resDefault: '1k',
  // Generous — a full style prompt with her own additions. Over-length is cut
  // rather than refused here because this is a live editor, not a filing.
  promptMax: 4000,
  refFile: 'sage-sandy-mirror.png',
  // The Sophie character toggle (Aug 2026): when a run sends character:true,
  // this image rides along as the SECOND attachment and characterLine is
  // appended to the prefix, so "Sophie" in her prompt draws this girl. The
  // file is her hearted Playground render ("girl placing her book face down",
  // run AD3NW4comO2TZYRFjZoD) banked into refs/.
  characterFile: 'sophie-book.png',
  // Keep BOTH in sync with STYLES.chatgpt in public/promptlab.html (the page
  // only uses its copies to PREVIEW the prompt; these are what gets sent).
  prefix: 'Use only the style of the attached style reference and ignore its ' +
    'content — do not copy anything depicted in it. You can choose your own ' +
    'colors rather than copying the colors of the style reference.',
  characterLine: ' Use the second attached image as a character reference. ' +
    'Her name is Sophie. Whenever the prompt mentions Sophie, draw her as that girl.',
  // HER OWN PHOTO REFERENCE (Aug 2026, Sophie: "Freeform has the ability to
  // upload a photo reference, but playground doesn't ... in the case of dreamy
  // or watercolor, where they already have references, it will go as the
  // second reference automatically"). One photo, uploaded per run from the
  // file button on the page — it is NOT a library like Freeform's, because
  // the Playground's whole point is a FIXED recipe per style with one thing
  // changed at a time.
  // It rides LAST, after the style references AND after the Sophie card, so
  // the wording below can name it unambiguously however many images precede
  // it — the character line says "the second attached image", and inserting
  // the photo anywhere earlier would silently make that sentence a lie.
  // The line is DISCLOSED: it is served by GET /api/promptlab/styles and the
  // page prints it in the Prompt panel whenever a photo is attached, so
  // nothing is added to her words without the page saying so.
  photoLine: ' The LAST attached image is a photo reference: use it for the ' +
    'subject described below — the person, place or object in it — and NOT ' +
    'for the drawing style, which comes from the style reference above.',
};
// The ChatGPT engine's selectable styles (Aug 2026). Each is the same recipe
// — gpt-image-2 edits, refs attached as pure STYLE references, quality/size
// from PL_GPT — differing only in which ref images ride along and the prefix
// wording (singular vs several references). 'evan' is the original ChatGPT
// style and the default when the page sends no `style`, so older pages and
// the Scratch Pad's copies keep working unchanged. The page's STYLES entries
// preview these prefixes in the "Sent as" line — keep the copies identical.
// `suffix` (Aug 2026, Sophie) rides at the VERY END of the sent prompt, after
// her words — the no-text rule reads last so the model can't bury it.
const PL_GPT_STYLES = {
  // "Sandy mirror" (Aug 2026, Sophie: "change the one that's called ChatGPT
  // right now to make it be called Sandy mirror"). The KEY stays `evan` — it
  // is what 1,000+ run docs store in `gptStyle`, what ?style= deep links and
  // playground-port.js route onto, and what her per-style prompt override and
  // no-text switch are keyed by in localStorage. Renaming a key would orphan
  // all of that; only the label she reads changed. The name is the reference
  // it attaches: refs/sage-sandy-mirror.png, her scanned ink-and-watercolour
  // page — which is exactly what "ChatGPT" had stopped saying, now that the
  // tile below draws on the same engine with no reference at all.
  evan: {
    label: 'Sandy mirror', refFiles: [PL_GPT.refFile],
    prefix: PL_GPT.prefix, characterLine: PL_GPT.characterLine,
    suffix: 'Do not include any text in the image.',
  },
  // "ChatGPT" (Aug 2026, Sophie: "add one more endpoint option to the
  // playground, which is called ChatGPT … the ChatGPT new one will have no
  // reference image"). Her words, gpt-image-2, and NOTHING else: no style
  // reference, no baked prefix, no baked tail, no Sophie card. It is the
  // model's own idea of her prompt, which is the one thing every other tile
  // here makes impossible — every one of them wraps her words in a reference
  // and a paragraph about it.
  // IT IS LITERALLY A DIFFERENT ENDPOINT, which is why she called it one: with
  // no images to attach there is nothing to EDIT, so runPromptLabGptJob sends
  // it to /v1/images/generations instead of /v1/images/edits (see the branch
  // there). Attaching her own photo reference puts it back on edits with that
  // one photo — the only image in the call, so `photoLine` below says so
  // rather than pointing at a style reference that isn't there.
  // NO Sophie character card: her card is the watercolor look, i.e. a style
  // reference by another name, and this tile's whole point is that none rides
  // along.
  plain: {
    label: 'ChatGPT',
    prefix: '', suffix: '',
    photoLine: 'The attached image is a photo reference: use it for the ' +
      'subject described below — the person, place or object in it.',
    noCharacter: true,
  },
  // "Scarry" (Sophie's name for it): Instagram saves she sent (busy-animal
  // picture-book pages), cropped to the artwork and banked in refs/. TWO of
  // the three attach — the mouse in bed and the taxi jam. The third,
  // `richard-scarry-2.png` (mouse at the table), was taken OUT Aug 2026 at
  // her ask; the file stays in refs/ because she may put it back, so adding
  // it here again is the whole job (mind the "two"/"three" in the prefix).
  // No colors line (that belonged to the watercolor reference) and NO Sophie
  // character card (her card is the watercolor look — wrong reference here),
  // both Sophie's call Aug 2026.
  scarry: {
    label: 'Scarry',
    refFiles: ['richard-scarry-1.png', 'richard-scarry-3.png'],
    prefix: 'Use only the style of the two attached style reference images and ' +
      'ignore their content — do not copy anything depicted in them.',
    suffix: 'Do not include any text in the image.',
    noCharacter: true,
  },
  // "Pastel" (Aug 2026, Sophie) — the pastel-variant-2 house look, the same
  // recipe MODELS.house['house-pastel'] renders (Witch School style refs +
  // its written style line + the whiten pass), offered here as a Playground
  // tile. Its refs live in STORAGE, not refs/, so they load through
  // loadHouseRef; `storageRefs` is what marks that. NO Sophie character card:
  // hers is the watercolor look, the wrong reference for this line.
  // The Story Room pad's PASTEL side draws this same recipe —
  // STYLE_ART.pastel in scratchpad.js copies the prefix, the suffix, the two
  // Storage refs AND the whiten pass (test-scratchpad-style.js pins all four).
  // Reword here → move that copy in the same commit.
  pastel: {
    label: 'Pastel',
    storageRefs: ['witch-school/refs/sophie-snake.png', 'witch-school/refs/sophie-animals.png'],
    prefix: 'Use the attached images ONLY as a STYLE reference for the linework: ' +
      'bold confident black ink outlines, flat colors with NO gradients and minimal ' +
      'shading, a soft pastel palette of lilac, pastel pink, mint and pale yellow, ' +
      'on a plain white background, playful modern editorial illustration.',
    suffix: 'Absolutely no text, no words, no letters, no numbers, no captions.',
    whiten: true,
    noCharacter: true,
  },
  // "Dreamy" (Aug 2026, Sophie: "add the other main style reference we use in
  // the chat, which can be called dreamy") — refs/dream-mystery.jpg, her
  // "1000 Dreams Per Night" diary-comic page. It was the most-used reference
  // in the repo with NO Playground tile: 270 filed images name it (measured
  // 2026-08-20), every one of which used to port onto the ChatGPT tile and
  // silently pick up sage sandy mirror instead.
  // The file on disk is her FULL-QUALITY photo (3370x4096, #1427), not the
  // old 1170x1364 screenshot — same filename, so this reads the good one.
  // The wording is NOT new: it is scripts/nde-panel.py's in-use recipe, the
  // one scripts/style-triptych.js already put beside the house styles.
  // THE ANTI-CONTENT RULE IS BOOKENDED — it opens the prefix and closes the
  // suffix (Sophie's ask). The reference is ITSELF a multi-panel comic page
  // full of drawn people, so it is the one house reference the model will
  // cheerfully redraw the CONTENT of; the suffix rides at the very end of the
  // sent prompt, after her words, which is the last thing the model reads.
  // The anti-grid half of that suffix is load-bearing for the same reason.
  // NO Sophie character card: hers is the watercolor look, and a second
  // reference in a different style is exactly what this prefix forbids.
  dreamy: {
    label: 'Dreamy',
    refFiles: ['dream-mystery.jpg'],
    // HER OWN WORDING, dictated 2026-08-22 ("change the default prompt in the
    // dreamy style in the playground to this one that follows"): the prefix is
    // her first paragraph, the suffix her second, verbatim. The prefix lost the
    // "linework, hand-drawn texture, and muted palette EXACTLY" list — she
    // shortened it to "copy its drawing style" — so do not put that back.
    // The Story Room pad's DREAMY side draws this same recipe —
    // STYLE_ART.dreamy.prefix/.suffix in scratchpad.js are COPIES of these two
    // strings (test-scratchpad-style.js pins them byte-for-byte). Reword here
    // → move that copy in the same commit.
    prefix: 'The FIRST attached image is a STYLE reference — copy its drawing style ' +
      'but do NOT copy its content, subjects, or composition.',
    // THE TAIL IS HERS, dictated verbatim 2026-08-22. Two clauses moved from
    // the wording that shipped 2026-08-20, and both moved BACK to something
    // this file had previously recorded her taking OUT — she changed her mind,
    // so read the history as history, not as a rule that still binds:
    //   • THE BORDER IS ASKED FOR AGAIN: "Draw it inside a hand-drawn border,
    //     like the frames in the style reference." An earlier cut added a
    //     border line and she removed it the same day ("take your borderline
    //     out"); this time she dictated it herself, with the reference named
    //     as what the frame should look like. Do not "restore" the silence.
    //   • "Minimal text only." became a flat "no text." — the handwriting on
    //     that diary-comic page is no longer wanted in the output.
    // Still gone and still deliberately unmentioned: "no caption boxes" and any
    // word about shape ("vertical"), because the canvas toggles portrait/square
    // and a prompt naming one would fight the other.
    // THE ORIGINAL WORDING IS STILL IN THE REPO AND IS STILL VALID for what it
    // was built for — `scripts/nde-panel.py` (a full-bleed NDE panel wants
    // those bans) and `scripts/style-triptych.js`. Both carry a note pointing
    // here. Writing a new surface against this reference? Read both and pick
    // deliberately; this one is Sophie's current wording, not the only one.
    suffix: 'Render as ONE single illustration — NOT a grid, NOT split panels. ' +
      'Draw it inside a hand-drawn border, like the frames in the style ' +
      'reference. no text. Again: the attached image is a STYLE reference ' +
      'only — do not draw its content, its subjects or its composition.',
    // THE NO-TEXT TOGGLE (Aug 2026, Sophie: "add a no text line to the prompt
    // that can be toggled on and off with a little toggle"). It SWAPS the
    // tail's own text clause rather than appending a second sentence arguing
    // with it, so `from` has to track the tail VERBATIM — her 2026-08-22
    // wording says "no text." where the old one said "Minimal text only.", so
    // this moved with it (`test-playground-notext.js` pins the two together).
    // The toggle still earns its place: her tail bans text in three quiet
    // words, and turning it on spells the ban out — no letters, no numbers, no
    // captions, no handwriting. Off is the default and the baked tail is
    // unchanged, so a run with the toggle off is byte-for-byte what she asked
    // for.
    noText: {
      from: 'no text.',
      to: 'NO text anywhere in the image — no words, no letters, no numbers, ' +
        'no captions, no handwriting.',
    },
    // THE PANELS SHEET SWAP (Aug 2026). On a panel-sheet run the tail's
    // anti-grid clause is poison — two sentences arguing about the layout
    // produce one panel with ghosts of the others — so it is SWAPPED, the
    // no-text mechanism again, never argued with. `from` must track the tail
    // VERBATIM through "…style reference. " and stop BEFORE 'no text.', so
    // this swap and the no-text swap touch disjoint clauses of one tail and
    // compose in either order (test-sheet-grid.js pins all of that against
    // these live literals). `{layout}` is filled by sheetGrid.applySheet with
    // the run's real grid. Per-panel hand-drawn borders are truer to the
    // reference than dropping the border ask — that page IS a bordered
    // multi-panel comic. If she has edited the tail, applySheet no-ops and
    // her wording wins.
    sheet: {
      from: 'Render as ONE single illustration — NOT a grid, NOT split panels. ' +
        'Draw it inside a hand-drawn border, like the frames in the style ' +
        'reference. ',
      to: 'Render as {layout} — each panel its own complete illustration, ' +
        'inside its own hand-drawn border like the frames in the style ' +
        'reference. ',
    },
    noCharacter: true,
  },
  // "Hoonies" (Aug 2026, Sophie) — her woodcut smallies, the same drawings the
  // app's loading animation cycles (Dump album "hoonies", #228). Four of them
  // attach, picked for the thing she wants out of this style: two subjects
  // grown into ONE object (a face in an open book, an eye inside a vase, a
  // face as a jug, a face as a candle) — which is what a coincidence looks
  // like, two halves melted together. Refs live in STORAGE, not refs/.
  // The prefix carries NO engraving vocabulary ON PURPOSE: tested side by side,
  // adding a written style description pulled the line finer and more modern,
  // away from the hoonies' blunt woodcut feel (same finding as the Evan style).
  // Everything it does say is composition, not style. NO Sophie character card:
  // hers is the watercolor look, the wrong reference here.
  hoonies: {
    label: 'Hoonies',
    storageRefs: [
      'hoonies/refs/style-1.png', 'hoonies/refs/style-2.png',
      'hoonies/refs/style-3.png', 'hoonies/refs/style-4.png',
    ],
    prefix: 'Use the attached images ONLY as a style reference — copy their ' +
      'drawing style, not their content. Draw the subject below in that exact ' +
      'style, alone on a plain white background, no border, no frame, no text.',
    suffix: 'Do not include any text in the image.',
    noCharacter: true,
  },
};
// The no-text switch on a style's tail. It SWAPS the style's own text clause
// where that clause is there to swap, so the sent prompt says one thing about
// text instead of two contradicting things; if she has edited the tail and her
// wording no longer carries the clause, the line is appended at the very end
// instead — so the toggle always does what it says, whoever wrote the tail.
function applyNoText(suffix, st, on) {
  if (!on || !st || !st.noText) return suffix;
  const { from, to } = st.noText;
  const s = String(suffix || '');
  if (from && s.includes(from)) return s.replace(from, to);
  return s ? `${s} ${to}` : to;
}

const plRefCache = {};
function playgroundRef(file) {
  if (!plRefCache[file]) plRefCache[file] = fs.readFileSync(path.join(__dirname, 'refs', file));
  return plRefCache[file];
}
// A style's reference images, wherever they live: `refFiles` are banked in
// refs/ (read once, cached), `storageRefs` are Firebase Storage paths shared
// with the house styles (downloaded once, cached by loadHouseRef).
async function playgroundRefs(st) {
  const local = (st.refFiles || []).map(playgroundRef);
  const remote = await Promise.all((st.storageRefs || []).map(loadHouseRef));
  return local.concat(remote);
}

// Cancelled run ids (in-process — the job and the cancel route are the same
// instance). Replicate runs only; see the /cancel route.
const plCancelled = new Set();

// Deploys restart the server mid-generation, and an in-flight run's doc is
// then stuck status:'running' forever — a zombie "drawing…" pinned to the top
// of the Playground (happened for real: "I was always bored as a child",
// orphaned by the 2026-08-04 deploy). No legitimate run outlives its 5-minute
// API timeout, so anything 'running' past 10 minutes is dead: sweep it into
// 'failed' shortly after boot and every 10 minutes after.
async function sweepStuckPromptlabRuns() {
  try {
    if (!admin.apps.length) return;
    const q = await admin.firestore().collection(PROMPTLAB).where('status', '==', 'running').get();
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const d of q.docs) {
      const at = d.data().createdAt?.toMillis?.() || 0;
      if (at && at < cutoff) {
        await d.ref.update({ status: 'failed', error: 'interrupted by a server restart' });
        console.log(`promptlab sweep: marked stuck run ${d.id} failed`);
      }
    }
  } catch (e) { console.warn('promptlab sweep:', e.message); }
}
setTimeout(sweepStuckPromptlabRuns, 90 * 1000);
setInterval(sweepStuckPromptlabRuns, 10 * 60 * 1000);

// File ONE thing into the iOS "My Creations" gallery — the same
// `users/{uid}/creations` collection in membry that POST /api/gallery writes.
// Generalized out of fileRunToCreations (below) so a module that isn't holding
// the membry credential can hand its deliverable over: movies.js gets this as
// `movies.init({ fileCreation })`, which is how a clip she animated stops
// living only inside the Movies tab.
//
// `poster` is the still the grid tiles a VIDEO with — a video creation has no
// frame to decode, so without one it would tile as a blank square. Best-effort
// throughout and de-duped by url: filing must never fail the work that made the
// thing, and re-filing the same url must never add a second tile.
async function fileCreationDoc({ url, type, prompt, poster, model, quality, style, source, createdMs, canvas, sizeSlot, fullPrompt, promptPrefix, promptSuffix, promptContent } = {}) {
  try {
    if (!url) return null;
    await storyDb();
    if (!storyApp) return null;
    const uid = await galleryUid();
    const col = storyApp.firestore().collection('users').doc(uid).collection('creations');
    const dup = await col.where('url', '==', url).limit(1).get();
    if (!dup.empty) return dup.docs[0].id;
    const doc = {
      type: String(type || 'image'), url,
      prompt: String(prompt || '').slice(0, 500), stickers: null,
      createdAt: createdMs
        ? admin.firestore.Timestamp.fromMillis(Number(createdMs))
        : admin.firestore.Timestamp.now(),
      source: String(source || 'server'),
    };
    if (poster) doc.poster = String(poster);
    if (style) doc.style = String(style).slice(0, 80);
    // THE WHOLE PROMPT (2026-08-24, Sophie's hard rule: "anytime an image is
    // made ANYWHERE the whole prompt shud be stored"). `prompt` above is her
    // typed words, capped at 500 for the caption; these are the literal text
    // that reached the model and the two halves the PROMPT overlay reads.
    // Built by ONE shared module so no surface invents its own seam.
    // `prompt` above is the CAPTION, and for most callers it is also her
    // words — but not always: a caller may caption a picture with a line this
    // repo wrote. `promptContent` lets it say what her words really were
    // rather than filing ours as hers.
    Object.assign(doc, promptRecord.promptFields({
      full: fullPrompt,
      content: promptContent != null ? promptContent : prompt,
      prefix: promptPrefix, suffix: promptSuffix,
    }));
    if (model) doc.model = String(model).slice(0, 80);
    if (quality) doc.quality = String(quality).slice(0, 40);
    // THE THIRD CAPTION SLOT, same as fileRunToCreations writes for a
    // Playground run. `canvas` is the exact one; `size` is what the caption
    // shows. A caller may pass `sizeSlot` to OVERRIDE the derivation — a
    // picture cut out of a bigger sheet has to, since its own pixels land on
    // a lower rung and would read as an ordinary small picture.
    if (canvas) doc.canvas = String(canvas).slice(0, 40);
    const slot = sizeSlot || (canvas ? require('./size-tier').captionSize(canvas) : '');
    if (slot) doc.size = String(slot).slice(0, 40);
    const ref = await col.add(doc);
    return ref.id;
  } catch (err) {
    console.warn('→ My Creations failed:', err.message);
    return null;
  }
}

// Every finished Playground image also lands in the iOS "My Creations" gallery
// (Sophie asked, Aug 2026) so she can browse them as thumbnails on the phone —
// the same `users/{uid}/creations` collection in membry that POST /api/gallery
// writes, with `source:'playground'` so they're identifiable. De-dupes by url.
// Best-effort by design: a gallery hiccup must never fail a run whose images
// are already saved and on the page.
async function fileRunToCreations(images, { prompt, style, model, quality, size, fullPrompt, promptPrefix, promptSuffix } = {}) {
  const sizeTier = require('./size-tier');
  try {
    if (!images || !images.length) return;
    await storyDb();
    if (!storyApp) return;
    const uid = await galleryUid();
    const col = storyApp.firestore().collection('users').doc(uid).collection('creations');
    for (const url of images) {
      const dup = await col.where('url', '==', url).limit(1).get();
      if (!dup.empty) continue;
      const doc = {
        type: 'image', url, prompt: String(prompt || '').slice(0, 500), stickers: null,
        createdAt: admin.firestore.Timestamp.now(), source: 'playground',
      };
      if (style) doc.style = String(style).slice(0, 80);
      // THE WHOLE PROMPT — see fileCreationDoc. A Playground run has always
      // held `fullPrompt` (the exact text sent) for the length of the request
      // and thrown it away at filing time; this is what keeps it.
      Object.assign(doc, promptRecord.promptFields({
        full: fullPrompt, content: prompt, prefix: promptPrefix, suffix: promptSuffix,
      }));
      // What made the picture, as separate fields — the gallery popup shows
      // "model · quality" and shouldn't have to parse a label back apart.
      if (model) doc.model = String(model).slice(0, 80);
      if (quality) doc.quality = String(quality).slice(0, 40);
      // THE THIRD SLOT (Aug 2026, Sophie: "1K 2K 4K should be a third slot in
      // the model/quality required tagging"). gpt-image-2 draws any canvas, so
      // model and quality alone stopped saying what a picture is — the same
      // prompt at the same quality spans 5x in pixels and 3x in price across
      // the tiers. The gallery and Meta Assets both read it as the caption's
      // last part; absent on anything filed before the field existed, and an
      // absent slot is left out rather than guessed.
      // IT IS THE TIER, NOT THE PIXELS (her correction: "i asked for it to say
      // 1k 2k or 4k") — `size` is what the caption shows and `canvas` keeps
      // the exact one, because 2K portrait and 2K square are different
      // canvases at different prices.
      if (size) {
        doc.canvas = String(size).slice(0, 40);
        doc.size = sizeTier.captionSize(size) || doc.canvas;
      }
      await col.add(doc);
    }
  } catch (err) {
    console.warn('promptlab → My Creations failed:', err.message);
  }
}

// ── A RUN STARTED FROM A STORY BEAT LANDS ON THAT BEAT ──────────────
// Sophie, 2026-08-26: tapping the Playground button on a beat should carry
// its drawing prompt over, and "whatever I just made, there should also be
// for that beat".
//
// THE SERVER PLACES IT, NOT THE PAGE, and that is the whole point: a medium
// picture takes 30-90s, so if the page did it she would lose the picture by
// tapping back before it landed — the house rule that anything slow is a
// background job whose result is persisted, never something to sit and watch.
// Best-effort throughout: a beat she deleted meanwhile, or a pad that has
// moved on, must never fail a paid render.
//
// Pictures are placed OLDEST FIRST, so the newest becomes the beat's art and
// the rest sit in its past-pictures row — the row is what she picks from, and
// scratchpad's swapArt keeps whatever was there before it in that row too.
// Nothing is ever deleted, so this is always two taps from undone.
function padTargetOf(body) {
  const pad = String((body && body.padTarget && body.padTarget.pad) || '').slice(0, 120);
  const beat = String((body && body.padTarget && body.padTarget.beat) || '').slice(0, 120);
  if (!pad || !beat) return null;
  const style = String((body.padTarget.style) || '');
  return { pad, beat, style: ['watercolor', 'dreamy', 'pastel'].includes(style) ? style : 'watercolor' };
}
async function landOnBeat(target, images, runId, meta) {
  if (!target || !images || !images.length) return;
  const { placeOnBeat } = require('./scratchpad');
  for (let i = 0; i < images.length; i++) {
    try {
      await placeOnBeat(target.pad, target.beat, images[i], target.style, {
        runId, i, prompt: meta.prompt || null, model: meta.model || null,
        engine: meta.engine || null, quality: meta.quality || null,
      });
    } catch (err) { console.warn('promptlab → beat failed:', err.message); }
  }
}

// One run = `outputs` independent edits calls, all sent together, each landing
// on the doc as it finishes (status 'ready' on the first, 'done' when all are
// in) so the grid fills in as they arrive. A single failed call costs its
// image, not the run; only an empty result fails the job.
// NOT cancellable, by nature: OpenAI has no cancel for image generation, so
// every image here is billed the moment it's requested. Nothing in the flow
// pretends otherwise — the page shows no X on these runs.
async function runPromptLabGptJob(docRef, cfg) {
  try {
    // Style refs first; the Sophie character card rides LAST when toggled on
    // (each style's characterLine points at it that way).
    const st = PL_GPT_STYLES[cfg.styleId] || PL_GPT_STYLES.evan;
    const refs = await playgroundRefs(st);
    if (cfg.character) refs.push(playgroundRef(PL_GPT.characterFile));
    // Her uploaded photo rides LAST — see PL_GPT.photoLine for why the order
    // matters (the character line names "the second attached image").
    if (cfg.photoBuf) refs.push(cfg.photoBuf);
    const images = [];
    const usage = [];              // the API's own token counts, one per render
    let failed = 0;
    const want = Math.min(Math.max(Number(cfg.outputs) || 1, 1), PL_GPT.maxOutputs);
    await Promise.all(Array.from({ length: want }, async () => {
      try {
        // NO IMAGES TO ATTACH → THE OTHER ENDPOINT (Aug 2026, the plain
        // ChatGPT tile). /v1/images/edits exists to edit something; with an
        // empty image[] it is a malformed request, so a style with no
        // reference goes to /v1/images/generations instead. Same model, same
        // quality/size, same moderation:'low' (the filter is stochastic — see
        // openaiImageEditRefs), same webp bytes back, so everything below this
        // line is unchanged. A photo reference SHE attached is an image like
        // any other, so a plain run carrying one is back on edits.
        const data = refs.length
          ? await openaiImageEditRefs(cfg.fullPrompt, refs, {
            quality: cfg.quality, size: cfg.size || PL_GPT.size, timeout: 300000,
          })
          : await openaiImage({
            model: PL_GPT.id, prompt: cfg.fullPrompt, n: 1,
            size: cfg.size || PL_GPT.size, quality: cfg.quality,
            output_format: 'webp', moderation: 'low',
          }, 2, 300000);
        if (data.error) throw new Error(data.error.message || 'gpt-image-2 error');
        const b64 = data.data?.[0]?.b64_json;
        if (!b64) throw new Error('gpt-image-2 returned no image');
        let buf = Buffer.from(b64, 'base64');
        // The pastel line is defined on a plain white ground, so it gets the
        // same flood-fill whiten the house style does. Best-effort: a failed
        // whiten keeps the picture rather than losing a paid render.
        if (st.whiten) { try { buf = await whitenBackground(buf); } catch (e) { console.warn('promptlab whiten failed:', e.message); } }
        images.push(await saveBufferToFirebase(buf, 'image/webp', 'promptlab'));
        // WHAT IT ACTUALLY COST, kept (2026-08-24). The API returns `usage`
        // on every call and this route was throwing it away, so the only way
        // to answer "what does attaching THIS reference cost" was to spend
        // money drawing a probe — which Sophie has explicitly ruled out.
        // Keeping it makes every ordinary run a free measurement: image input
        // tokens scale with the reference's own dimensions, so the answer is
        // per-reference and cannot be reasoned out from one style's number.
        // (Measured 2026-08-24: dream-mystery.jpg is 1,505 tokens = 1.20c,
        // the same at low and at medium — the reference does not get cheaper
        // when the picture does.)
        // Stored per RENDER because one run can draw several.
        if (data.usage) usage.push(data.usage);
        await docRef.update({ status: 'ready', images: images.slice() });
      } catch (err) {
        failed++;
        console.warn('promptlab gpt-image render failed:', err.message);
      }
    }));
    if (!images.length) throw new Error('every gpt-image-2 render failed — see the server log');
    await docRef.update({ status: 'done', images, failedRenders: failed,
      ...(usage.length ? { usage } : {}) });
    // `cfg.fullPrompt` is the literal string that went to the model two dozen
    // lines up — pass it rather than rebuilding, so the stored text cannot
    // differ from the sent text by so much as a space. The halves come from
    // the style's own baked prefix/suffix (or her edited override, which is
    // what `cfg.head`/`cfg.tail` carry).
    // Started from a story beat? The picture is that beat's now — see
    // landOnBeat. After the doc is done, so the feed shows it either way.
    await landOnBeat(cfg.padTarget, images, docRef.id,
      { prompt: cfg.prompt, model: PL_GPT.id, engine: 'gptimage', quality: cfg.quality });
    fileRunToCreations(images, {
      prompt: cfg.prompt, style: `${st.label} · ${cfg.quality}`,
      model: PL_GPT.id, quality: cfg.quality, size: cfg.size || PL_GPT.size,
      fullPrompt: cfg.fullPrompt,
      promptPrefix: cfg.head != null ? cfg.head : st.prefix,
      promptSuffix: cfg.tail != null ? cfg.tail : st.suffix,
    });
  } catch (err) {
    console.warn('promptlab gpt job failed:', err.message);
    await docRef.update({ status: 'failed', error: err.message }).catch(() => {});
  }
}

// ── A PANELS RUN: one sheet, cut apart ─────────────────────────────────
// (Aug 2026, Sophie: "we make a picture and cut it into panels … describe
// each panel individually. It's a way of saving money on the picture,
// especially if it's done in 2K or 4K — then the pixels come out right
// too.") N panel descriptions drawn TOGETHER on one gpt-image-2 sheet at
// the tier budget, then cut into N pictures locally — the sheet pays the
// style reference once where N separate draws pay it N times.
//
// The cut is exact math on a canvas DERIVED to divide into whole-pixel
// cells (sheet-grid.js), decoded ONCE to a raw buffer and cropped
// SEQUENTIALLY — never Promise.all — with sharp's cache off: this box has
// 512MB, a decoded 4K sheet is ~33MB raw, and per-crop re-decodes with the
// cache on are how a batch of extracts balloons. Lossless webp on every
// panel: the model's own pixels are the source and nothing lossy may stand
// between them and the cut (the house no-generation-compression rule).
async function cutSheet(sheetBuf, plan) {
  const sharp = require('sharp');
  sharp.cache(false);
  const { data, info } = await sharp(sheetBuf).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  // The model answers the requested canvas; anything else means the cut
  // lines would land on the wrong pixels, so refuse and keep the sheet.
  if (info.width !== plan.W || info.height !== plan.H) {
    throw new Error(`sheet came back ${info.width}x${info.height}, wanted ${plan.sheet}`);
  }
  // THE CUT IS IMAGE-AWARE (2026-08-26, Sophie: "the cut should be in the
  // middle of the tan area, but two of them got one side cut right on the
  // black edge"): the model draws the grid slightly off the exact lines, so
  // findSeams reads the picture and cuts through the middle of the real
  // gutter near each math line, falling back to the math line where no
  // gutter qualifies. Luminance derived from the ONE decode already in hand.
  const gray = new Uint8Array(info.width * info.height);
  for (let i = 0, p = 0; i < gray.length; i++, p += info.channels) {
    // Rec. 601 integer luma — close enough for an ink/paper valley.
    gray[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
  }
  const seams = sheetGrid.findSeams(gray, info.width, info.height, plan.across, plan.down);
  const rects = sheetGrid.seamBoxes(seams.xs, seams.ys, info.width, info.height);
  const raw = { width: info.width, height: info.height, channels: info.channels };
  const urls = [];
  for (const r of rects) {
    const buf = await sharp(data, { raw }).extract(r)
      .webp({ lossless: true }).toBuffer();
    urls.push(await saveBufferToFirebase(buf, 'image/webp', 'promptlab'));
  }
  return { urls, rects };
}

// Sibling of runPromptLabGptJob: same refs, same edits/generations choice,
// same whiten and usage capture — one render, then the cut, then filing.
// NOT cancellable, like every gpt run: the sheet is billed when requested.
async function runPromptLabPanelsJob(docRef, cfg) {
  const plan = cfg.plan;
  try {
    const st = PL_GPT_STYLES[cfg.styleId] || PL_GPT_STYLES.evan;
    const refs = await playgroundRefs(st);
    const data = refs.length
      ? await openaiImageEditRefs(cfg.fullPrompt, refs, {
        quality: cfg.quality, size: plan.sheet, timeout: 300000,
      })
      : await openaiImage({
        model: PL_GPT.id, prompt: cfg.fullPrompt, n: 1,
        size: plan.sheet, quality: cfg.quality,
        output_format: 'webp', moderation: 'low',
      }, 2, 300000);
    if (data.error) throw new Error(data.error.message || 'gpt-image-2 error');
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error('gpt-image-2 returned no image');
    let sheetBuf = Buffer.from(b64, 'base64');
    // Pastel's flood-fill whiten runs on the SHEET, before the cut, so every
    // panel inherits it. Best-effort, as on an ordinary run.
    if (st.whiten) { try { sheetBuf = await whitenBackground(sheetBuf); } catch (e) { console.warn('promptlab whiten failed:', e.message); } }
    // THE PAID SHEET IS BANKED BEFORE THE CUT — a failed cut must never lose
    // a picture that has already been billed.
    const sheetUrl = await saveBufferToFirebase(sheetBuf, 'image/webp', 'promptlab');
    await docRef.update({ sheetUrl, ...(data.usage ? { usage: [data.usage] } : {}) });
    const sizeTier = require('./size-tier');
    const style = `${st.label} · ${cfg.quality}`;
    let images, rects;
    try {
      ({ urls: images, rects } = await cutSheet(sheetBuf, plan));
    } catch (err) {
      // The cut failed (a resized answer, a sharp hiccup): the run is still
      // DONE — the sheet is the picture, misdrawn ratio and all, and the doc
      // says why so the page can tell her.
      console.warn('promptlab sheet cut failed:', err.message);
      await docRef.update({ status: 'done', images: [sheetUrl], cutFailed: true });
      fileCreationDoc({
        url: sheetUrl, prompt: `the sheet — ${plan.count} panels`,
        promptContent: cfg.prompt, style, model: PL_GPT.id, quality: cfg.quality,
        canvas: plan.sheet, fullPrompt: cfg.fullPrompt,
        promptPrefix: cfg.head, promptSuffix: cfg.tail, source: 'playground',
      });
      return;
    }
    // One write straight to done — the cut takes seconds against a 30-90s
    // render, and a 'ready' stage showing the SHEET in cells shaped for
    // panels would distort it.
    await docRef.update({ status: 'done', images });
    // File the sheet and every panel into My Creations. The sheet's caption
    // is a line this repo wrote, so `promptContent` says what her words
    // really were (see fileCreationDoc). Each panel files with its OWN
    // description and the '1/9 (4K)' size slot — a cut panel's own pixels
    // land on a lower rung and would read as an ordinary small picture
    // (size-tier.js cutSize; fileCreationDoc's sizeSlot exists for this).
    const cut = sizeTier.cutSize(plan.sheet, plan.count);
    fileCreationDoc({
      url: sheetUrl, prompt: `the sheet — ${plan.count} panels`,
      promptContent: cfg.prompt, style, model: PL_GPT.id, quality: cfg.quality,
      canvas: plan.sheet, fullPrompt: cfg.fullPrompt,
      promptPrefix: cfg.head, promptSuffix: cfg.tail, source: 'playground',
    });
    // A panel's style half is everything around ITS words in the sent text —
    // the panel line sits verbatim in fullPrompt, so the seam is real.
    const seamFor = (text) => {
      const i = cfg.fullPrompt.indexOf(text);
      if (i < 0) return { prefix: cfg.head, suffix: cfg.tail };
      return {
        prefix: cfg.fullPrompt.slice(0, i).trim(),
        suffix: cfg.fullPrompt.slice(i + text.length).trim(),
      };
    };
    images.forEach((url, i) => {
      const seam = seamFor(cfg.panels[i]);
      // The panel's REAL canvas — the seams move to the gutters, so a panel
      // can differ from the nominal cell by a few pixels either side.
      const r = rects && rects[i];
      fileCreationDoc({
        url, prompt: cfg.panels[i],
        canvas: r ? `${r.width}x${r.height}` : plan.cell, sizeSlot: cut,
        style, model: PL_GPT.id, quality: cfg.quality, fullPrompt: cfg.fullPrompt,
        promptPrefix: seam.prefix, promptSuffix: seam.suffix, source: 'playground',
      });
    });
  } catch (err) {
    console.warn('promptlab panels job failed:', err.message);
    await docRef.update({ status: 'failed', error: err.message }).catch(() => {});
  }
}

async function runPromptLabJob(docRef, cfg) {
  try {
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: cfg.version,
        input: {
          prompt: cfg.fullPrompt, model: 'dev', go_fast: false,
          lora_scale: cfg.loraScale, megapixels: '1', num_outputs: cfg.outputs,
          // png: the original must come back lossless (Flux's webp encode is
          // lossy at its output_quality, default 80) — see the replicate route.
          aspect_ratio: cfg.aspectRatio, output_format: 'png',
          guidance_scale: 3, output_quality: 100, prompt_strength: 0.8,
          num_inference_steps: cfg.steps, seed: cfg.seed,
        },
      }),
    });
    let prediction = await createRes.json();
    if (prediction.error) throw new Error(String(prediction.error));
    if (!prediction.urls?.get) throw new Error(prediction.detail || 'Replicate did not return a polling URL');
    // The prediction id is what /cancel needs — Replicate stops charging for
    // the compute it hasn't run yet.
    if (prediction.id) await docRef.update({ predictionId: prediction.id }).catch(() => {});
    while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled') {
      await new Promise(r => setTimeout(r, 1500));
      const poll = await fetch(prediction.urls.get, { headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` } });
      prediction = await poll.json();
    }
    if (prediction.status === 'canceled' || plCancelled.has(docRef.id)) {
      plCancelled.delete(docRef.id);
      await docRef.update({ status: 'cancelled' });
      return;
    }
    if (prediction.status === 'failed') throw new Error(prediction.error || 'generation failed');
    const urls = Array.isArray(prediction.output) ? prediction.output : [prediction.output];
    // Show Replicate's own links the moment they exist (status 'ready' —
    // playground-equal speed), then copy to Storage in parallel and swap the
    // permanent urls in. Replicate deletes API outputs after ~1hr, so the
    // copies are what keep the run history browsable.
    await docRef.update({ status: 'ready', tempImages: urls, predictTime: prediction.metrics?.predict_time || null });
    const images = await Promise.all(urls.map(u => saveToFirebase(u, 'promptlab')));
    plCancelled.delete(docRef.id);
    await docRef.update({ status: 'done', images });
    await landOnBeat(cfg.padTarget, images, docRef.id,
      { prompt: cfg.prompt, model: cfg.styleLabel, engine: 'replicate', quality: null });
    // The LoRA's wrapper is its trigger word in front and its suffix behind —
    // `cfg.fullPrompt` is what was actually sent.
    fileRunToCreations(images, {
      prompt: cfg.prompt, style: cfg.styleLabel, model: cfg.styleLabel,
      fullPrompt: cfg.fullPrompt, promptPrefix: cfg.prefix, promptSuffix: cfg.suffix,
    });
  } catch (err) {
    console.warn('promptlab job failed:', err.message);
    plCancelled.delete(docRef.id);
    await docRef.update({ status: 'failed', error: err.message }).catch(() => {});
  }
}

app.post('/api/promptlab', async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    if (!admin.apps.length) return res.status(500).json({ error: 'Firebase not configured' });
    const typed = String(req.body.prompt || '').trim();
    if (!typed) return res.status(400).json({ error: 'prompt required' });
    const modelId = req.body.model || 'sageryza/watercolordrawings';
    // She came here from a story beat — the picture belongs to it (landOnBeat).
    const padTarget = padTargetOf(req.body);

    // The gpt-image-2 style: her words go through UNTOUCHED (no trigger word,
    // no trailing-period trim, no suffix) after the baked style-ref prefix.
    if (modelId === PL_GPT.id) {
      if (!OPENAI_API_KEY) return res.status(400).json({ error: 'OPENAI_API_KEY not set on the server' });
      // Which ChatGPT-engine style: an unknown/absent `style` falls back to
      // the original ('evan'), so older pages keep working.
      const styleId = Object.hasOwn(PL_GPT_STYLES, String(req.body.style || '')) ? String(req.body.style) : 'evan';
      const st = PL_GPT_STYLES[styleId];
      // A noCharacter style never attaches the Sophie card, whatever the page
      // sends — her card is the watercolor look, the wrong reference there.
      const character = Boolean(req.body.character) && !st.noCharacter;
      // HER OWN prefix/suffix win when she has edited them (Aug 2026, Sophie:
      // "add a prompt button so you can see what's being added and … allow
      // yourself to edit it as well"). Only a STRING counts as an edit, so an
      // absent field keeps the baked text and an empty string genuinely
      // removes that half — she can delete the whole tail if she wants to.
      // `edited` is stored so a run's record says whose words these were;
      // `fullPrompt` has always stored the exact text sent, so nothing about
      // the prompt is hidden either way.
      const over = (v, baked) => (typeof v === 'string' ? v.trim().slice(0, PL_GPT.promptMax) : baked);
      const prefix = over(req.body.prefix, st.prefix);
      const suffix = over(req.body.suffix, st.suffix);
      const edited = prefix !== st.prefix || suffix !== st.suffix;
      // Her own photo reference, uploaded with this run (Aug 2026). The bytes
      // go straight to the job so a failed Storage write costs the record, not
      // the picture; the url is only what the run's doc remembers it by.
      let photoBuf = null;
      let photoUrl = '';
      const photoIn = String(req.body.photo || '');
      const pm = photoIn.match(/^data:(image\/[a-z.+-]+);base64,(.+)$/i);
      if (pm) {
        photoBuf = Buffer.from(pm[2], 'base64');
        const up = await saveBufferToFirebase(photoBuf, pm[1], 'promptlab/photorefs');
        if (/^https?:\/\//.test(up)) photoUrl = up;
      } else if (/^https?:\/\//.test(photoIn)) {
        try {
          const r = await fetch(photoIn);
          if (r.ok) { photoBuf = Buffer.from(await r.arrayBuffer()); photoUrl = photoIn; }
        } catch (e) { console.warn('promptlab photo ref fetch failed:', e.message); }
      }
      // The no-text toggle is NOT an edit of hers — it is a switch on the
      // house tail, so it is applied AFTER the override and left out of
      // `edited`. A style with no `noText` never offers it.
      const noText = Boolean(req.body.noText) && !!st.noText;
      const tail = applyNoText(suffix, st, noText);
      // The head is prefix + whichever extra lines actually ride this run, so
      // the blank line before her words is there whenever ANY of them is —
      // the old separator keyed on the prefix alone, which glued the character
      // line onto her first word if she had deleted the prefix.
      // A style may own its photo line: PL_GPT.photoLine says the drawing
      // style "comes from the style reference above", which is true of every
      // tile that attaches one and a lie on the plain ChatGPT tile, where her
      // photo is the ONLY attachment. Whatever rides is disclosed either way —
      // GET /styles serves the same string the page prints.
      // A style's own line carries no leading space (it can be the whole head
      // on a style with no prefix), so one is added when something precedes
      // it. PL_GPT.photoLine's own leading space is left alone — it is byte
      // for byte what the other five tiles have always sent.
      const photoLine = st.photoLine ? ` ${st.photoLine}` : PL_GPT.photoLine;
      const head = `${prefix}${character ? st.characterLine : ''}${photoBuf ? photoLine : ''}`.trim();
      const fullPrompt = `${head}${head ? '\n\n' : ''}${typed}${tail ? `\n\n${tail}` : ''}`;
      const outputs = Math.min(Math.max(Number(req.body.outputs) || PL_GPT.outputs, 1), PL_GPT.maxOutputs);
      const quality = PL_GPT.qualities.includes(req.body.quality) ? req.body.quality : PL_GPT.quality;
      // Portrait unless she asked for the square; an unknown value is portrait,
      // never an invented canvas. The resolution tier is the same rule, and it
      // defaults to 1k — a page cached on her phone from before the toggle
      // shipped sends no `res` at all, and must keep drawing exactly what it
      // always drew rather than silently jumping to a dearer canvas.
      const shapeId = PL_GPT.res[String(req.body.canvas || '')] ? String(req.body.canvas) : 'portrait';
      const shape = PL_GPT.res[shapeId];
      const resId = shape.tiers[String(req.body.res || '')] ? String(req.body.res) : PL_GPT.resDefault;
      const canvas = { size: shape.tiers[resId].size, aspectRatio: shape.aspectRatio };

      // A PANELS RUN (Aug 2026, Sophie: "cut it into panels … describe each
      // panel individually") — N descriptions drawn together on ONE sheet
      // and cut apart. Same collection, same feed; the doc's `images` become
      // the cut panels so votes, the lightbox and search need nothing new.
      // The canvas toggle picks the CELL shape and the tier the sheet's
      // pixel budget; the sheet canvas itself is derived (sheet-grid.js).
      // The character card and her photo ref are deliberately OFF here —
      // both wordings name "the second/last attached image" for ONE
      // picture, and a sheet is not the surface to argue that on.
      if (Array.isArray(req.body.panels) && req.body.panels.length) {
        const grid = Number(req.body.grid) || req.body.panels.length;
        if (!sheetGrid.GRIDS[grid]) return res.status(400).json({ error: `unknown grid ${grid}` });
        // Cut, not refused, like the prompt itself — this is a live editor.
        const panels = req.body.panels.map((p) => String(p || '').trim().slice(0, 350));
        if (panels.length !== grid || panels.some((p) => !p)) {
          return res.status(400).json({ error: `all ${grid} panels need words` });
        }
        const plan = sheetGrid.sheetFor(shapeId, grid, resId, PL_GPT.res);
        if (!plan) return res.status(400).json({ error: 'no legal sheet for that grid' });
        // The style tail's anti-grid clause is SWAPPED, never argued with
        // (sheet-grid.js applySheet; an edited tail no-ops and her wording
        // wins). The no-text swap composes after it — disjoint clauses.
        const sheetTail = applyNoText(
          sheetGrid.applySheet(suffix, st.sheet, sheetGrid.layoutWords(grid)), st, noText);
        const sheetHead = prefix.trim();
        const blockTxt = sheetGrid.panelBlock(grid, panels);
        const sheetPrompt = `${sheetHead}${sheetHead ? '\n\n' : ''}${blockTxt}${sheetTail ? `\n\n${sheetTail}` : ''}`;
        const docRef = admin.firestore().collection(PROMPTLAB).doc();
        await docRef.set({
          id: docRef.id, status: 'running', engine: 'gptimage', prompt: typed,
          fullPrompt: sheetPrompt, model: PL_GPT.id, gptStyle: styleId, quality,
          // `size` is the SHEET; `aspectRatio` is the CELL's — it is what
          // each finished picture is, and what the feed renders cells with.
          size: plan.sheet, aspectRatio: plan.aspectRatio, res: resId,
          promptEdited: edited, noText,
          styleRef: (st.refFiles || []).concat(st.storageRefs || []).join(','),
          outputs: 1, character: false, photoRef: '', images: [],
          panels, grid: { across: plan.across, down: plan.down, count: plan.count },
          sheet: plan.sheet, cell: plan.cell,
          createdAt: admin.firestore.Timestamp.now(),
        });
        runPromptLabPanelsJob(docRef, {
          fullPrompt: sheetPrompt, head: sheetHead, tail: sheetTail,
          quality, prompt: typed, styleId, panels, plan,
        });
        return res.json({ id: docRef.id, poll: `/api/promptlab/${docRef.id}` });
      }

      const docRef = admin.firestore().collection(PROMPTLAB).doc();
      await docRef.set({
        id: docRef.id, status: 'running', engine: 'gptimage', prompt: typed, fullPrompt,
        model: PL_GPT.id, gptStyle: styleId, quality, size: canvas.size,
        aspectRatio: canvas.aspectRatio, res: resId, promptEdited: edited, noText,
        styleRef: (st.refFiles || []).concat(st.storageRefs || []).join(','), outputs,
        character, photoRef: photoUrl, images: [], createdAt: admin.firestore.Timestamp.now(),
        ...(padTarget ? { padTarget } : {}),
      });
      // head/tail ride along so the filed style half is what ACTUALLY wrapped
      // her words on this run — her prefix/suffix override if she made one,
      // the character line and the photo line only when they were really
      // attached — rather than the style's baked default.
      runPromptLabGptJob(docRef, { fullPrompt, head, tail, outputs, quality, prompt: typed, character, styleId, size: canvas.size, photoBuf, padTarget });
      return res.json({ id: docRef.id, poll: `/api/promptlab/${docRef.id}` });
    }

    const content = typed.replace(/\.+$/, '');
    const known = MODELS.replicate.find(m => m.id === modelId);
    if (!known) return res.status(400).json({ error: `unknown model ${modelId}` });
    const suffix = String(req.body.suffix ?? 'White background').trim();
    const loraScale = Number(req.body.lora_scale ?? 1);
    const seed = Number.isFinite(Number(req.body.seed)) ? Number(req.body.seed) : 85;
    const aspectRatio = String(req.body.aspect_ratio || '2:3');
    // Per-model extras so the other house styles work here too: HOONIE's
    // baked suffix and 40 steps, vict's pen-and-ink suffix, etc.
    const steps = known.defaultSteps ?? 28;
    // ONE image a run (Aug 2026, Sophie) — the LoRAs used to come back with a
    // hard-coded four. The page sends 1; anything else is clamped to 1-4.
    const outputs = Math.min(Math.max(Number(req.body.outputs) || 1, 1), 4);
    const tail = [known.promptSuffix, suffix].filter(Boolean).join(', ');
    const fullPrompt = `${known.trigger} ${content}.${tail ? ` ${tail} ` : ' '}`;
    const version = `${known.id}:${await resolveReplicateVersion(known)}`;
    const docRef = admin.firestore().collection(PROMPTLAB).doc();
    await docRef.set({
      id: docRef.id, status: 'running', engine: 'replicate', prompt: content, fullPrompt, suffix,
      model: modelId, trigger: known.trigger, loraScale, seed, aspectRatio, steps, outputs,
      images: [], createdAt: admin.firestore.Timestamp.now(),
      ...(padTarget ? { padTarget } : {}),
    });
    // The LoRA's wrapper is its TRIGGER in front and `tail` behind; both ride
    // along so the filed style half is the real one.
    runPromptLabJob(docRef, { version, fullPrompt, loraScale, seed, aspectRatio, steps, outputs,
      prompt: content, styleLabel: known.name, prefix: known.trigger, suffix: tail, padTarget });
    res.json({ id: docRef.id, poll: `/api/promptlab/${docRef.id}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The baked style prompt, so the page's PROMPT button can SHOW it (Aug 2026,
// Sophie: "add a prompt button so you can see what's being added and … allow
// yourself to edit it as well").
// SERVED, NOT COPIED. server.js owns the text that is actually sent, and the
// page had no copy of it at all — the old "Sent as" preview was removed for
// exactly the reason a copy is dangerous. So the button reads the real thing
// here rather than a fourth transcription of it drifting out of step.
// MUST stay above `/api/promptlab/:id` — Express matches in order, and `:id`
// would otherwise swallow `styles` and answer "run not found".
app.get('/api/promptlab/styles', (req, res) => {
  const out = {};
  Object.keys(PL_GPT_STYLES).forEach((k) => {
    const st = PL_GPT_STYLES[k];
    out[k] = {
      label: st.label,
      prefix: st.prefix || '',
      suffix: st.suffix || '',
      characterLine: st.noCharacter ? '' : (st.characterLine || ''),
      // What the no-text toggle would put in this style's tail, or null when
      // the style doesn't offer one — that is what hides the button.
      noText: st.noText ? { from: st.noText.from, to: st.noText.to } : null,
      // The photo line this style would really add, so the Prompt panel prints
      // the sentence that is actually sent. Absent = the house one below.
      photoLine: st.photoLine || '',
      // The sheet swap a panels run would apply to this style's tail, or null
      // — served so the Prompt panel can print the tail that is really sent
      // on a sheet, the same disclosure rule as everything above.
      sheet: st.sheet ? { from: st.sheet.from, to: st.sheet.to } : null,
      refs: (st.refFiles || []).concat(st.storageRefs || []),
    };
  });
  // THE PANELS TAB'S GEOMETRY, computed by sheet-grid.js — the page copies
  // nothing: the grids on offer, each grid's cell names (the box
  // placeholders), the grid sentence the prompt will carry, and the derived
  // sheet/cell canvas per shape × grid × tier (what the tooltips show).
  // Adding 25 later is a GRIDS entry in sheet-grid.js and nothing here.
  const panels = { grids: {}, sheets: {} };
  Object.keys(sheetGrid.GRIDS).forEach((g) => {
    panels.grids[g] = {
      ...sheetGrid.GRIDS[g],
      count: sheetGrid.GRIDS[g].across * sheetGrid.GRIDS[g].down,
      positions: sheetGrid.positions(g),
      layout: sheetGrid.layoutWords(g),
      sentence: sheetGrid.panelBlock(g, []),
    };
  });
  Object.keys(sheetGrid.SHAPES).forEach((shape) => {
    panels.sheets[shape] = {};
    Object.keys(sheetGrid.GRIDS).forEach((g) => {
      panels.sheets[shape][g] = {};
      Object.keys(PL_GPT.res[shape].tiers).forEach((tier) => {
        const plan = sheetGrid.sheetFor(shape, Number(g), tier, PL_GPT.res);
        if (plan) panels.sheets[shape][g][tier] = { sheet: plan.sheet, cell: plan.cell };
      });
    });
  });
  // `sizes` is the old flat shape and stays exactly as it was — a page cached
  // on her phone reads it, and this endpoint is the only thing that serves it.
  res.json({ styles: out, sizes: PL_GPT.sizes, res: PL_GPT.res, resDefault: PL_GPT.resDefault,
    max: PL_GPT.promptMax, photoLine: PL_GPT.photoLine, panels });
});

app.get('/api/promptlab/:id', async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(500).json({ error: 'Firebase not configured' });
    const snap = await admin.firestore().collection(PROMPTLAB).doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'not found' });
    const d = snap.data();
    res.json({ ...d, createdAt: d.createdAt?.toMillis?.() || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel a running job — Replicate (the LoRAs) ONLY. Replicate has a cancel
// endpoint: the prediction stops and only the compute already run is billed.
// OpenAI has no cancel for image generation — a requested image is billed
// whether or not anyone waits for the response — so a ChatGPT run is refused
// here rather than offered a cancel that saves nothing (and the page shows no
// X on those runs).
app.post('/api/promptlab/:id/cancel', async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    if (!admin.apps.length) return res.status(500).json({ error: 'Firebase not configured' });
    const ref = admin.firestore().collection(PROMPTLAB).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'not found' });
    const d = snap.data();
    if (d.engine === 'gptimage') {
      return res.status(400).json({ error: 'gpt-image-2 renders cannot be cancelled — OpenAI bills an image as soon as it is requested' });
    }
    if (d.status !== 'running' && d.status !== 'ready') {
      return res.json({ ok: true, status: d.status, note: 'already finished' });
    }
    plCancelled.add(req.params.id);
    await ref.update({ cancelRequested: true });
    if (d.predictionId && REPLICATE_API_TOKEN) {
      try {
        await fetch(`https://api.replicate.com/v1/predictions/${d.predictionId}/cancel`, {
          method: 'POST', headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
        });
      } catch (err) { console.warn('promptlab replicate cancel failed:', err.message); }
    }
    res.json({ ok: true, status: 'cancelling' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ♥/✕ on one image of a run (votes: { <imageIndex>: 'like'|'dislike' } on the
// doc). Sending the same vote again clears it — the page's toggles.
app.post('/api/promptlab/:id/vote', async (req, res) => {
  if (STUDIO_TOKEN && req.get('x-studio-token') !== STUDIO_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    if (!admin.apps.length) return res.status(500).json({ error: 'Firebase not configured' });
    const i = Number(req.body.image);
    // 0-24: a run used to hold at most 4 images, but a panels run's images
    // are its cut panels — up to 9 today, 25 when the 5x5 grid lands. The
    // old `i > 3` cap 400'd a heart on panel 5 of 9.
    if (!Number.isInteger(i) || i < 0 || i > 24) return res.status(400).json({ error: 'image index 0-24 required' });
    const vote = ['like', 'dislike'].includes(req.body.vote) ? req.body.vote : null;
    const ref = admin.firestore().collection(PROMPTLAB).doc(req.params.id);
    await ref.update({ [`votes.${i}`]: vote === null ? admin.firestore.FieldValue.delete() : vote });
    // Carry the ♥/✕ (or the clear) onto any Assets-tab record holding this
    // picture, so the two surfaces agree — see syncVoteToAssets. Awaited so a
    // reload straight after the tap already reads the synced state; a sync
    // failure never fails the vote (the helper swallows its own errors).
    try {
      const run = (await ref.get()).data() || {};
      const url = (run.images || [])[i];
      if (url) await syncVoteToAssets(url, vote);
    } catch (e) { /* best-effort */ }
    res.json({ ok: true, image: i, vote });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The feed, newest first. `before` (a createdAt in millis) pages BACKWARDS
// THROUGH TIME rather than by offset: runs land at the TOP while she reads, so
// an offset would shift under her and repeat or skip a run. `more` tells the
// page whether there is anything older still to ask for.
//
// Until Aug 2026 this route had no cursor at all and the page only ever asked
// for the newest 40 — so every run older than that was unreachable, which read
// as her older pictures having disappeared (213 runs existed, 40 were visible).
// ─── The Playground's search ────────────────────────────────────────────
// A SEARCH READS THE WHOLE FEED, not the page she is looking at — the Assets
// tab's lesson (Aug 2026: she searched "yarn" and got nothing, because that
// box only filtered the tiles already loaded). The Playground pages 40 runs at
// a time out of a few hundred, so a client-only filter would answer "nothing
// matches" for almost everything she has ever drawn.
//
// Firestore has no text search, so this scans — which is affordable here and
// nowhere near it on the big collections: the whole run history is a few
// hundred docs of ~1KB. The scan is capped and held for a minute, so typing
// costs one read of it however many keystrokes land.
const PL_SEARCH_SCAN = 1500;    // newest runs a search ever reads
const PL_SEARCH_MAX = 300;      // matches handed back
let plScan = { at: 0, runs: null };
async function promptlabScan() {
  if (plScan.runs && Date.now() - plScan.at < 60000) return plScan.runs;
  const snap = await admin.firestore().collection(PROMPTLAB)
    .orderBy('createdAt', 'desc').limit(PL_SEARCH_SCAN).get();
  const runs = snap.docs.map((d) => {
    const v = d.data();
    return { ...v, createdAt: v.createdAt?.toMillis?.() || null };
  });
  plScan = { at: Date.now(), runs };
  return runs;
}
// Everything a run's card says: her words, its style (by the label she sees
// AND the key the doc stores), and the tags beside them.
function promptlabHay(r) {
  const st = PL_GPT_STYLES[r.gptStyle || ''] || null;
  // The canvas is stored as a ratio and shown to her as one, but the button
  // she picked it with says Portrait or Square — so both words find it.
  const shape = r.aspectRatio === '1:1' ? 'square' : (r.aspectRatio === '2:3' ? 'portrait' : '');
  return [r.prompt, st && st.label, r.gptStyle, r.model, r.quality, r.aspectRatio, shape,
    r.status === 'failed' ? 'failed' : '', r.status === 'cancelled' ? 'cancelled' : '',
    r.photoRef ? 'photo ref' : '',
    // A panels run: every panel's own words, and the grid by name — so
    // "panels" and "3x3" both find it. `prompt` already joins the texts,
    // but the words are listed too in case a later shape stops joining.
    ...(r.panels || []),
    r.grid && r.grid.count ? `panels ${r.grid.across}x${r.grid.down}` : '',
  ].filter(Boolean).join('  ');
}
// The house grammar (search-grammar.js), matched the FEED's way — every term
// anchored at a word start, a quoted phrase kept adjacent. Same regexes the
// page's own qparse builds, so a search here and the client's instant filter
// over the loaded runs can never disagree. (Deliberately a local copy: the
// grammar module parses only, because its callers disagree about what a match
// is — meta-assets.js carries the identical one for the same reason.)
function plCompileQuery(q) {
  return searchGrammar.parseQuery(q).map((g) => ({
    neg: g.neg,
    terms: g.terms.map((t) => {
      const v = t.value;
      try {
        return new RegExp((/^[a-z0-9]/i.test(v) ? '\\b' : '')
          + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'), 'i');
      } catch (e) { return null; }
    }).filter(Boolean),
  })).filter((g) => g.terms.length);
}
function plSearchRuns(runs, q) {
  const groups = plCompileQuery(q);
  if (!groups.length) return runs;
  return runs.filter((r) => {
    const hay = promptlabHay(r);
    return groups.every((g) => (g.terms.some((rx) => rx.test(hay)) ? !g.neg : g.neg));
  });
}

app.get('/api/promptlab', async (req, res) => {
  try {
    if (!admin.apps.length) return res.status(500).json({ error: 'Firebase not configured' });
    const limit = Math.min(Number(req.query.limit) || 40, 100);
    const before = Number(req.query.before) || 0;
    // A search answers over the whole history at once — there is no `before`
    // walk behind it, so the page hides "Older" while one is running.
    const search = String(req.query.q || '').trim();
    if (search) {
      const hits = plSearchRuns(await promptlabScan(), search);
      return res.json({
        runs: hits.slice(0, Math.min(Math.max(Number(req.query.limit) || PL_SEARCH_MAX, 1), PL_SEARCH_MAX)),
        more: false,
        matched: hits.length,
      });
    }
    let q = admin.firestore().collection(PROMPTLAB).orderBy('createdAt', 'desc');
    // Inequality on the same field the query orders by — no composite index.
    if (before) q = q.where('createdAt', '<', admin.firestore.Timestamp.fromMillis(before));
    const snap = await q.limit(limit).get();
    res.json({
      runs: snap.docs.map(s => { const d = s.data(); return { ...d, createdAt: d.createdAt?.toMillis?.() || null }; }),
      more: snap.size === limit,
    });
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

// Network timeouts for OpenAI image calls, scaled by render quality. High
// (and auto, which may pick high) takes 3-4+ minutes at OpenAI’s end, so the
// old flat 90s cap made EVERY high render fail after three timed-out
// attempts. Low/medium keep the short cap so phone clients still fail fast.
const OPENAI_IMAGE_TIMEOUTS = { low: 90000, medium: 150000, high: 420000, auto: 420000 };

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
// `timeoutOverride` (Aug 2026): the per-quality table below suits the square
// low/medium calls the zine and the single-image routes make. The Playground's
// plain ChatGPT tile draws canvases up to 2336x3504, where a medium render can
// run well past the 150s medium is allowed here — the same reason
// openaiImageEditRefs takes a `timeout`. 0 keeps the table.
async function openaiImage(body, retries = 2, timeoutOverride = 0) {
  const timeout = timeoutOverride || OPENAI_IMAGE_TIMEOUTS[body.quality] || 90000;
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
  styleRefBuffer = fs.readFileSync(__dirname + '/refs/dream-mystery.jpg');
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
      // Moderation low, for the reason spelled out on openaiImageEditRefs.
      form.append('moderation', 'low');
      // NO output_compression. This is a LOSSY setting applied by OpenAI
      // BEFORE the bytes come back, so whatever it throws away is gone for
      // good — it cannot be undone later, only re-drawn (and a re-draw is a
      // different picture). It was here by a conflation with the house rule
      // about never SERVING a raw PNG to a page: that rule is about derived
      // display copies (scripts/webp-assets.js, the `thumbs/` service above),
      // and the original it derives from has to stay full quality. Sophie
      // caught it as graininess on fine ink hatching, 2026-08-19. Do not put
      // a compression back on a generation call.
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
// A rejection escaping a fire-and-forget background job must never take the
// whole service down with it (measured 2026-08-24: the Story Room film job's
// pre-try mkdtempSync did exactly that — every render crashed the process,
// wedging docs on 'making' and answering live requests with dead sockets).
// Log it loudly; the job's own doc-stamping is each module's responsibility.
process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', (err && err.stack) || err);
});

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

// ─── The daily chat-icon sweep ──────────────────────────────────────────
// New chats appear faster than anyone can hand-draw them (104 in one hour the
// day the first batch shipped), so the sweep draws whatever has piled up, 25 to
// a ~6c sheet. See chaticons.js for what it skips and why.
//
// THE TICK IS HOURLY AND THE DUE CHECK IS IN FIRESTORE. This service restarts on
// every deploy and this repo deploys many times a day, so a 24-hour interval
// counted from boot would either never reach 24 hours or start over each time.
// `lastRunAt` on the module's state doc is the only clock that survives a
// restart; the hourly tick just asks whether a day has passed. It also means a
// dev container that boots the app spends nothing — the live service's own
// lastRunAt says the work is already done.
//
// Only where RENDER_EXTERNAL_URL is set, i.e. the deployed service and not a
// laptop or a chat's sandbox.
if (SELF_URL) {
  const ICON_TICK_MS = 60 * 60 * 1000;
  const tick = () => require('./chaticons').sweepDue()
    .then((r) => { if (r && r.started) console.log('chat-icon sweep started', r.started, r.waiting, 'waiting'); })
    .catch((e) => console.log('chat-icon sweep tick failed:', e.message));
  setTimeout(tick, 5 * 60 * 1000);        // not during the boot rush
  setInterval(tick, ICON_TICK_MS);
}
