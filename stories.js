// stories.js — the shared story library.
//
// Three of the media are stories wearing different clothes (Movies, Storybook,
// the zine), so stories get their own home: save a story once, reuse it in any
// module. Also hosts the story → storybook-pages breakdown (whole story in,
// per-page words + picture prompts out) so the Storybook can build a whole
// book in one go instead of page by page.
//
// Self-contained module in the movies.js pattern: Firestore-backed
// (`forge-stories`, in-memory fallback for dev), STUDIO_TOKEN gate with only
// GET /status open.

const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');
const admin = require('firebase-admin');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const COLLECTION = process.env.STORIES_COLLECTION || 'forge-stories';

const memStore = new Map();

function firestore() {
  return admin.apps.length ? admin.firestore() : null;
}

function plain(obj) { return JSON.parse(JSON.stringify(obj)); }

async function saveStory(story) {
  story.updatedAt = new Date().toISOString();
  const db = firestore();
  if (db) await db.collection(COLLECTION).doc(story.id).set(plain(story));
  else memStore.set(story.id, plain(story));
  return story;
}

async function listStories() {
  const db = firestore();
  if (db) {
    const snap = await db.collection(COLLECTION).orderBy('updatedAt', 'desc').limit(100).get();
    return snap.docs.map(d => d.data());
  }
  return [...memStore.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

async function deleteStory(id) {
  const db = firestore();
  if (db) await db.collection(COLLECTION).doc(id).delete();
  else memStore.delete(id);
}

async function openaiChatJSON(messages, { temperature = 0.7, retries = 2 } = {}) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
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
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, response_format: { type: 'json_object' }, temperature }),
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

// Break a whole story into picture-book pages: the words that go ON each page
// (drawn from the story's own text, lightly smoothed for read-aloud rhythm)
// plus a self-contained picture prompt for each page's illustration.
async function storybookPages(story, pageCountHint) {
  const target = pageCountHint ? `exactly ${pageCountHint}` : 'between 6 and 14';
  const sys = `You turn a story into the pages of a children's picture book. Return STRICT JSON:
{"title": a short book title,
 "pages": [{"words": the words printed on this page — drawn from the story's own text, lightly smoothed for read-aloud rhythm, 1-3 short sentences,
   "scene": a self-contained picture prompt for this page's illustration — name the location, time of day, and describe every character present with the same physical description every time they appear (hair, clothing, features); one clear moment, one or two subjects}]}

HARD RULES:
- ${target} pages, in story order, covering the WHOLE story with nothing skipped.
- Stay true to the story — never invent events. The words belong to the author; smooth, don't rewrite.
- Every scene prompt must be fully self-contained (each illustration renders alone) and repeat the characters' physical descriptions verbatim on every page where they appear.
- scene describes content and composition only — no style words.`;
  const out = await openaiChatJSON([
    { role: 'system', content: sys },
    { role: 'user', content: `The story:\n\n${story}` },
  ]);
  const pages = (Array.isArray(out.pages) ? out.pages : [])
    .map(p => ({ words: String(p.words || '').trim(), scene: String(p.scene || '').trim() }))
    .filter(p => p.scene);
  if (!pages.length) throw new Error('could not break the story into pages');
  return { title: String(out.title || 'Untitled').trim(), pages };
}

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();

router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

router.get('/status', (req, res) => {
  res.json({ ok: true, openai: Boolean(OPENAI_API_KEY), firebase: Boolean(firestore()) });
});

router.get('/', async (req, res) => {
  try { res.json({ stories: await listStories() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { title, text } = req.body || {};
    const body = String(text || '').trim();
    if (!body) return res.status(400).json({ error: 'text is required' });
    const story = {
      id: 'st' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
      title: (title && String(title).trim()) || body.split(/\s+/).slice(0, 6).join(' ') + '…',
      text: body,
      createdAt: new Date().toISOString(),
    };
    await saveStory(story);
    res.json(story);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await deleteStory(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Whole story → picture-book pages ({words, scene} each). Body: { story }
// or { storyId }, optional pageCount.
router.post('/breakdown', async (req, res) => {
  try {
    let { story, storyId, pageCount } = req.body || {};
    if (!story && storyId) {
      const all = await listStories();
      story = all.find(s => s.id === storyId)?.text;
    }
    if (!story || !String(story).trim()) return res.status(400).json({ error: 'story (or storyId) required' });
    const n = pageCount ? Math.min(24, Math.max(2, parseInt(pageCount, 10) || 0)) : null;
    const plan = await storybookPages(String(story).trim(), n);
    res.json(plan);
  } catch (err) {
    res.status(err.message.includes('required') ? 400 : 502).json({ error: err.message });
  }
});

module.exports = { router, storybookPages };
