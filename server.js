// imageforge-server v10 — concurrent generation (max 4 at a time)
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
const MAX_CONCURRENT = 4;

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

// ─── Concurrent pool helper ─────────────────────────────────────────
// Runs tasks with at most `limit` concurrent, calls `onResult` as each finishes
async function runPool(tasks, limit, onResult) {
  let nextIndex = 0;
  let active = 0;

  return new Promise((resolve) => {
    function startNext() {
      while (active < limit && nextIndex < tasks.length) {
        const i = nextIndex++;
        active++;
        tasks[i]().then(
          (result) => { active--; onResult(i, result, null); startNext(); },
          (err) => { active--; onResult(i, null, err); startNext(); },
        );
      }
      if (active === 0 && nextIndex >= tasks.length) resolve();
    }
    startNext();
  });
}

// ─── Internal image generation (no localhost HTTP round-trip) ────────
async function generateImageInternal(provider, prompt, model) {
  if (provider === 'replicate') {
    const known = MODELS.replicate.find(m => m.id === model);
    const fullPrompt = known ? `${known.trigger}, ${prompt}` : prompt;
    const version = known ? `${known.id}:${known.version}` : model;
    console.log('Replicate:', { model, trigger: known?.trigger, promptStart: fullPrompt.slice(0, 60) });

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
          lora_scale: 1,
          megapixels: '1',
          num_outputs: 1,
          aspect_ratio: '1:1',
          output_format: 'webp',
          guidance_scale: 3,
          output_quality: 80,
          prompt_strength: 0.8,
          num_inference_steps: 28,
        },
      }),
    });
    let prediction = await createRes.json();
    if (prediction.error) throw new Error(prediction.error);

    while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
      await new Promise(r => setTimeout(r, 1500));
      const pollRes = await fetch(prediction.urls.get, {
        headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
      });
      prediction = await pollRes.json();
    }
    if (prediction.status === 'failed') throw new Error(prediction.error || 'Generation failed');

    const output = prediction.output;
    const tempUrl = Array.isArray(output) ? output[0] : output;
    const permanentUrl = await saveToFirebase(tempUrl, 'replicate');
    return { url: permanentUrl };
  } else {
    // DALL·E
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024', quality: 'standard' }),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const permanentUrl = await saveToFirebase(data.data[0].url, 'dalle');
    return { url: permanentUrl, revised_prompt: data.data[0].revised_prompt };
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

// ─── Available models ───────────────────────────────────────────────
const MODELS = {
  replicate: [
    { id: 'sageryza/gosh', version: 'd337796af9f1cc9566f378d2f78deff7864bd5439247935a9f651e5762cdfb39', name: 'Gouache', trigger: 'gosh' },
    { id: 'sageryza/paint', version: '89efc7b98503ea158b5f848a5edbfd8d9bd24d589ccf34986eeee6b3d87fadcd', name: 'Painterly', trigger: 'pnt' },
    { id: 'sageryza/special', version: '82d7dd7806bf8fb62fb4e36d67ed361d088e10743c56737e0f08904ec8a5a920', name: 'Sketchy', trigger: 'special' },
    { id: 'sageryza/victorianstyle', version: '50684448f55b69edd2ca835099ed927f24690d79bfcc90a1334962c591a78cce', name: 'Book Illustrations', trigger: 'vict' },
    { id: 'sageryza/watercolordrawings', version: 'a6749d940388a669f79efc36018b93436568ca6a6a59c57ddd87dc43fa3e6c1f', name: 'Watercolor Drawings', trigger: 'wtr' },
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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    const text = data.choices[0].message.content.trim();
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const subjects = JSON.parse(cleaned);
    res.json({ subjects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Extract visual moments from a description ─────────────────────
app.post('/api/generate/moments', async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: 'description is required' });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: `You help illustrate a dating memoir. Given a date description, extract small, specific, visual moments that would make good simple watercolor-style drawings.

CRITICAL RULES:
- ONLY extract moments that are explicitly described in the text. Never invent or assume details.
- Each moment should be a concrete detail — an object, a scene, a gesture — not an abstract feeling.
- If the text only contains 2-3 clear visual moments, return only 2-3. Do NOT pad to 6 with invented scenes.
- Return UP TO 6 moments, but fewer is fine if the text is short.

For each moment, provide:
- "moment": a short 3-5 word label
- "prompt": a detailed image generation prompt for a soft watercolor illustration, under 40 words. Always start with "Soft watercolor illustration of" and include "minimal background, gentle muted palette"

Return valid JSON only, no markdown fences. The JSON should be an array of objects with "moment" and "prompt" fields.`,
          },
          {
            role: 'user',
            content: description,
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    const text = data.choices[0].message.content.trim();
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const moments = JSON.parse(cleaned);
    res.json({ moments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Single image: DALL·E ───────────────────────────────────────────
app.post('/api/generate/dalle', async (req, res) => {
  try {
    const { prompt, size = '1024x1024', quality = 'standard' } = req.body;
    const result = await generateImageInternal('dalle', prompt, 'dall-e-3');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Single image: Replicate (custom LoRA) ──────────────────────────
app.post('/api/generate/replicate', async (req, res) => {
  try {
    const { prompt } = req.body;
    const model = req.body.model || 'sageryza/gosh';
    const result = await generateImageInternal('replicate', prompt, model);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Style test: generate preview images (concurrent) ───────────────
app.post('/api/generate/style-test', async (req, res) => {
  try {
    const { subjects, provider = 'replicate', model, stylePrompt = '' } = req.body;
    if (!subjects || !subjects.length) return res.status(400).json({ error: 'subjects required' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const tasks = subjects.map((subject, i) => () => {
      const prompt = provider === 'replicate'
        ? `${stylePrompt} ${subject}`.trim()
        : (stylePrompt ? `${stylePrompt}. ${subject}` : subject);
      return generateImageInternal(provider, prompt, model || 'sageryza/gosh');
    });

    await runPool(tasks, MAX_CONCURRENT, (i, result, err) => {
      if (err) {
        res.write(`data: ${JSON.stringify({ index: i, total: subjects.length, subject: subjects[i], error: err.message })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ index: i, total: subjects.length, subject: subjects[i], ...result })}\n\n`);
      }
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Deck batch: generate images concurrently ───────────────────────
app.post('/api/generate/deck-batch', async (req, res) => {
  try {
    const { cards, provider = 'replicate', model, stylePrompt = '' } = req.body;
    if (!cards || !cards.length) return res.status(400).json({ error: 'cards required' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const tasks = cards.map((card, i) => () => {
      const prompt = provider === 'replicate'
        ? `${stylePrompt} ${card.subject}`.trim()
        : (stylePrompt ? `${stylePrompt}. ${card.subject}` : card.subject);
      return generateImageInternal(provider, prompt, model || 'sageryza/gosh');
    });

    await runPool(tasks, MAX_CONCURRENT, (i, result, err) => {
      if (err) {
        res.write(`data: ${JSON.stringify({ index: i, total: cards.length, subject: cards[i].subject, error: err.message })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ index: i, total: cards.length, subject: cards[i].subject, ...result })}\n\n`);
      }
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Sticker sheet ──────────────────────────────────────────────────
app.post('/api/generate/sticker-sheet', async (req, res) => {
  try {
    const { moments, provider = 'dalle', model, stylePrompt = '' } = req.body;
    const basePrompt = `Create a sticker sheet with ${moments.length} individual stickers scattered across a white background. Each sticker should be a cute, kawaii-style illustration with pastel colors, white borders, and no text. The stickers represent these moments:\n${moments.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\nStyle: Hand-drawn quality, soft muted colors (dusty pinks, sage greens, lavender, warm grays), organic scattered layout with varying sizes and angles. No text anywhere.`;
    const prompt = stylePrompt ? `${stylePrompt}. ${basePrompt}` : basePrompt;
    const result = await generateImageInternal(
      provider,
      prompt,
      provider === 'replicate' ? (model || 'sageryza/gosh') : 'dall-e-3'
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server v10 running on http://localhost:${PORT}`));
