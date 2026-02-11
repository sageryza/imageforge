const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => { res.sendFile(__dirname + '/public/index.html'); });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';

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
    res.json({ url: data.data[0].url, revised_prompt: data.data[0].revised_prompt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate/replicate', async (req, res) => {
  try {
    const { prompt, model = 'black-forest-labs/flux-schnell' } = req.body;
    const createRes = await fetch('https://api.replicate.com/v1/models/' + model + '/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: { prompt } }),
    });
    let prediction = await createRes.json();
    if (prediction.error) return res.status(400).json({ error: prediction.error });
    while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
      await new Promise(r => setTimeout(r, 1500));
      const pollRes = await fetch(prediction.urls.get, {
        headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
      });
      prediction = await pollRes.json();
    }
    if (prediction.status === 'failed') return res.status(400).json({ error: prediction.error || 'Generation failed' });
    const output = prediction.output;
    const url = Array.isArray(output) ? output[0] : output;
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate/sticker-sheet', async (req, res) => {
  try {
    const { moments, provider = 'dalle' } = req.body;
    const prompt = `Create a sticker sheet with ${moments.length} individual stickers scattered across a white background. Each sticker should be a cute, kawaii-style illustration with pastel colors, white borders, and no text. The stickers represent these moments:\n${moments.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\nStyle: Hand-drawn quality, soft muted colors (dusty pinks, sage greens, lavender, warm grays), organic scattered layout with varying sizes and angles. No text anywhere.`;
    const endpoint = provider === 'replicate' ? '/api/generate/replicate' : '/api/generate/dalle';
    const internal = await fetch(`http://localhost:${process.env.PORT || 3001}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await internal.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate/deck', async (req, res) => {
  try {
    const { theme, count = 50, provider = 'dalle', stylePrompt = '' } = req.body;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const baseStyle = stylePrompt || 'Trading card illustration, detailed, vibrant colors, white border, centered subject, clean background';
    for (let i = 0; i < count; i++) {
      const cardPrompt = `${baseStyle}. Card ${i + 1} of a ${theme} deck. Each card should depict a unique, distinct ${theme}-themed subject. No text or numbers on the card.`;
      try {
        const endpoint = provider === 'replicate' ? '/api/generate/replicate' : '/api/generate/dalle';
        const internal = await fetch(`http://localhost:${process.env.PORT || 3001}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: cardPrompt }),
        });
        const data = await internal.json();
        res.write(`data: ${JSON.stringify({ index: i, total: count, ...data })}\n\n`);
      } catch (err) {
        res.write(`data: ${JSON.stringify({ index: i, total: count, error: err.message })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
