// imageforge-server v11 — moments v3 prompts, replicate crash fix, pwcscans model
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => { res.sendFile(__dirname + '/public/index.html'); });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';

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

app.get('/book', (req, res) => { res.sendFile(__dirname + '/public/book.html'); });

// ─── Talking to Myself: standalone dream/memory zine app ────────────
app.get('/talking', (req, res) => { res.sendFile(__dirname + '/public/talking.html'); });

// ─── Available models ───────────────────────────────────────────────
const MODELS = {
  replicate: [
    { id: 'sageryza/gosh', version: 'd337796af9f1cc9566f378d2f78deff7864bd5439247935a9f651e5762cdfb39', name: 'Gouache', trigger: 'gosh' },
    { id: 'sageryza/paint', version: '89efc7b98503ea158b5f848a5edbfd8d9bd24d589ccf34986eeee6b3d87fadcd', name: 'Painterly', trigger: 'pnt' },
    { id: 'sageryza/special', version: '82d7dd7806bf8fb62fb4e36d67ed361d088e10743c56737e0f08904ec8a5a920', name: 'Sketchy', trigger: 'special' },
    { id: 'sageryza/victorianstyle', version: '50684448f55b69edd2ca835099ed927f24690d79bfcc90a1334962c591a78cce', name: 'Book Illustrations', trigger: 'vict' },
    { id: 'sageryza/watercolordrawings', version: 'a6749d940388a669f79efc36018b93436568ca6a6a59c57ddd87dc43fa3e6c1f', name: 'Watercolor Drawings', trigger: 'wtr' },
    { id: 'sageryza/pwcscans', version: 'fdb33f8d1af98c2fd4e736c25d52e307ea88958729ce7319691e5d784f40d18b', name: 'PWC Scans', trigger: 'tok' },
  ],
  dalle: [
    { id: 'dall-e-3', name: 'DALL·E 3 (default)', stylePrompt: '' },
    { id: 'dall-e-3-watercolor', name: 'Soft Watercolor', stylePrompt: 'Soft watercolor illustration with gentle washes, muted pastel palette, minimal background, hand-painted feel.' },
    { id: 'dall-e-3-lineart', name: 'Ink & Line Art', stylePrompt: 'Delicate ink line drawing with fine pen strokes, minimal color accents, white background, editorial illustration style.' },
    { id: 'dall-e-3-woodblock', name: 'Woodblock Print', stylePrompt: 'Japanese woodblock print style with bold outlines, flat color areas, limited palette, ukiyo-e influenced.' },
    { id: 'dall-e-3-risograph', name: 'Risograph', stylePrompt: 'Risograph print style with halftone dots, limited 2-3 color palette, slight misregistration, textured grain.' },
    { id: 'dall-e-3-botanical', name: 'Botanical', stylePrompt: 'Scientific botanical illustration style with precise detail, soft natural colors, cream paper background, vintage naturalist feel.' },
    { id: 'dall-e-3-cutout', name: 'Paper Cutout', stylePrompt: 'Paper cut-out collage style with layered colored paper shapes, subtle shadows, handcraft aesthetic, flat design.' },
  ],
};

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

// ─── Single image: Replicate (custom LoRA) — with settings + crash fix ──
app.post('/api/generate/replicate', async (req, res) => {
  try {
    const { prompt, settings = {} } = req.body;
    const model = req.body.model || 'sageryza/gosh';

    // Look up trigger word and version if it's one of our known models
    const known = MODELS.replicate.find(m => m.id === model);
    const fullPrompt = known ? `${known.trigger}, ${prompt}` : prompt;
    const version = known ? `${known.id}:${known.version}` : model;

    const loraScale = settings.lora_scale ?? 1;
    const megapixels = settings.megapixels ?? '1';
    const numOutputs = settings.num_outputs ?? 1;
    const outputFormat = settings.output_format ?? 'webp';
    const guidanceScale = settings.guidance_scale ?? 3;
    const outputQuality = settings.output_quality ?? 80;
    const numInferenceSteps = settings.num_inference_steps ?? 28;

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

// POST to OpenAI's image endpoint with retries. gpt-image-1 can take a while
// and the connection sometimes drops ("Premature close"); retrying recovers
// from those transient network errors, mirroring openaiChat above. It also
// waits out the per-minute rate limit automatically (a rejected request makes
// no image and isn't billed, so retrying is safe).
async function openaiImage(body, retries = 4) {
  let lastErr, lastData;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json', 'Connection': 'close' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      lastData = data;
      // If we hit the per-minute image rate limit, wait the suggested time
      // (default ~13s) and try again instead of failing the request.
      if (data.error && data.error.code === 'rate_limit_exceeded' && attempt < retries) {
        const m = /try again in ([\d.]+)\s*s/i.exec(data.error.message || '');
        const waitMs = Math.min((m ? Math.ceil(parseFloat(m[1]) * 1000) : 13000) + 800, 20000);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      return data;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
    }
  }
  if (lastData) return lastData;
  throw lastErr;
}

// Generate one illustrated panel with gpt-image-1 (returns base64). If the
// account can't use gpt-image-1 yet, surface a clear error rather than
// silently switching models (which would break the zine's visual style).
async function generateZinePanel(imagePrompt) {
  // WebP + compression keeps the image small (~5-10x smaller than PNG) so that,
  // until cloud storage is on, several pages still fit in the phone's storage.
  const data = await openaiImage({ model: 'gpt-image-1', prompt: imagePrompt, n: 1, size: '1024x1024', quality: 'medium', output_format: 'webp', output_compression: 80 });
  if (data.error) throw new Error(data.error.message || 'gpt-image-1 error');
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('gpt-image-1 returned no image');
  const url = await saveBufferToFirebase(Buffer.from(b64, 'base64'), 'image/webp', 'talking');
  return { url, model: 'gpt-image-1' };
}

// Instant wake-up ping (no external calls) — used by the page on load to
// warm a sleeping free-tier instance before the first illustrate request.
app.get('/api/talking/ping', (req, res) => { res.json({ ok: true }); });

// Status: is cloud image storage (Firebase) connected? When false, images
// come back as big data URLs that have to live in the phone's browser.
app.get('/api/talking/status', (req, res) => { res.json({ firebase: Boolean(bucket) }); });

// Lightweight one-shot check: does this OpenAI account work with gpt-image-1?
app.get('/api/talking/check', async (req, res) => {
  if (!OPENAI_API_KEY) return res.json({ ok: false, error: 'OPENAI_API_KEY not set on the server' });
  try {
    const data = await openaiImage({ model: 'gpt-image-1', prompt: 'a single small ink dot on cream paper', n: 1, size: '1024x1024', quality: 'low' });
    if (data.error) return res.json({ ok: false, error: data.error.message, code: data.error.code });
    return res.json({ ok: Boolean(data.data?.[0]?.b64_json), model: 'gpt-image-1' });
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
// Visual style for grid pages. Unlike TALKING_STYLE, captions ARE allowed
// here because the panels are hand-lettered into the image like a zine page.
const TALKING_STYLE_GRID =
  'Detailed pen-and-ink illustration with dense cross-hatching, softened by ' +
  'muted watercolor washes in a limited dusty palette (sepia, faded indigo, ' +
  'ochre, sage, dusty rose), on aged cream paper. Melancholic, surreal, ' +
  'intimate diary-comic mood, like an outsider-art zine.';

// Build one gpt-image-1 prompt for a page of 1–4 panels.
function buildPagePrompt(beats) {
  const n = beats.length;
  const layout = n >= 4 ? 'a 2x2 grid of four equal framed panels'
    : n === 3 ? 'three equal framed panels in a row'
    : n === 2 ? 'two equal framed panels side by side'
    : 'a single framed panel';
  const lines = beats.map((b, i) =>
    `Panel ${i + 1}: ${b.scene}. Caption beneath the panel: "${b.caption}"`).join('\n');
  return `A single illustrated zine page on aged cream paper: ${layout}, each with a hand-drawn ` +
    `border and equal size. ${TALKING_STYLE_GRID}\n\n${lines}\n\nBeneath each panel, hand-letter its ` +
    `caption in small uppercase letters, spelled exactly as written. The ONLY text anywhere in the ` +
    `image is those short captions — no other words, no title, no signature.`;
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
app.post('/api/talking/render-page', async (req, res) => {
  try {
    const { beats } = req.body || {};
    if (!Array.isArray(beats) || !beats.length) return res.status(400).json({ error: 'beats required' });
    const prompt = buildPagePrompt(beats.slice(0, 4));
    const { url, model } = await generateZinePanel(prompt);
    res.json({ url, model, captions: beats.slice(0, 4).map(b => b.caption) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
