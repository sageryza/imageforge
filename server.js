// imageforge-server v11 — moments v3 prompts, replicate crash fix, pwcscans model
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const admin = require('firebase-admin');

const app = express();

// ─── CORS ───────────────────────────────────────────────────────────
// The API is called from browser apps on other origins (e.g. a Claude
// artifact), so cross-origin requests must be allowed. Permissive for now
// — any origin — since the endpoints are already open; `origin: true`
// reflects the caller's origin (so it also works if we ever add
// credentials). Tighten `origin` to an allow-list later if needed.
const corsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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
  app.use('/api/etsy', etsy.router);
  app.use('/api/printify', printify.router);
  app.use('/api/printful', printful.router);
  app.use('/api/lulu', lulu.router);
  app.use('/api/pipeline', pipeline.router);
  app.use('/api/photostudio', photostudio.router);
  console.log('Pipeline routes mounted (Etsy + Printify + Printful + Lulu + orchestration + photostudio)');
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
    : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
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
