// blog.js — SEO blog generator (mounted at /api/blog, page at /blog).
//
// The idea: a small shop drives free organic search traffic by publishing blog
// posts targeted at LONG-TAIL keywords — specific, low-competition buyer
// phrases that big sites ignore and that Google's AI Overviews can't fully
// answer, so the click still comes to you.
//
// Flow (mirrors the rest of the studio — generate, then a human reviews):
//   topic → long-tail keyword research (gpt-4o-mini)
//         → SEO post: title, meta description, slug, tags, HTML body, FAQ
//         → gpt-image-2 images
//         → draft you review → publish to the Shopify store blog (shopify.js)
//
// Generation endpoints are stateless (robust); saved drafts persist to
// Firestore (`forge-blog`) as a best-effort convenience so a "recent drafts"
// list survives, exactly like the movies/songs docs. Publishing goes through
// the shared Shopify Admin module so the same custom-app token that reads the
// newsletter audience also drops the post onto the store blog.

const express = require('express');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';

function tryRequire(name) {
  try { return require(name); } catch (err) {
    console.warn(`blog: ${name} unavailable —`, err.message);
    return null;
  }
}
const shopify = tryRequire('./shopify');

function db() {
  return admin.apps.length ? admin.firestore() : null;
}
function bucket() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}

// ─── OpenAI text (gpt-4o-mini, JSON) ────────────────────────────────
// Same shape/guards as pipeline.js's openaiJSON.
async function openaiJSON(messages, { temperature = 0.7, retries = 2 } = {}) {
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
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          response_format: { type: 'json_object' },
          temperature,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'openai error');
      return JSON.parse(data.choices?.[0]?.message?.content || '{}');
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// ─── OpenAI image (gpt-image-2) → permanent Firebase URL ────────────
async function generateImage({ prompt, size = '1536x1024', quality = 'medium' }) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  if (!prompt) throw new Error('prompt required');
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2', prompt, n: 1, size, quality, output_format: 'webp' }),
    timeout: 180000,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'gpt-image-2 error');
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('gpt-image-2 returned no image');
  const buffer = Buffer.from(b64, 'base64');
  const b = bucket();
  if (!b) return { url: `data:image/webp;base64,${b64}`, permanent: false };
  const filename = `blog/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const file = b.file(filename);
  await file.save(buffer, { metadata: { contentType: 'image/webp' } });
  await file.makePublic();
  return { url: `https://storage.googleapis.com/${b.name}/${filename}`, permanent: true };
}

// ─── Keyword research ───────────────────────────────────────────────
// Long-tail, low-competition, buyer-intent phrases + a topic-cluster shape.
async function researchKeywords({ topic, context = '' } = {}) {
  if (!topic) throw new Error('topic required');
  const sys = [
    'You are an SEO strategist for a small independent maker/shop with low domain authority.',
    'Your job: propose LONG-TAIL keywords that such a site can realistically rank for in 2026.',
    'Rules: prefer specific 3-6 word buyer-intent phrases over broad head terms; avoid anything a',
    'huge authority site would dominate; each keyword should be something Google AI Overviews cannot',
    'fully answer, so an optimized page still earns the click. Estimate difficulty as low/medium/high.',
    'Also cluster them: one broad PILLAR topic and several specific CLUSTER phrases that would each',
    'be their own post and link back to the pillar.',
    'Return STRICT JSON: {"pillar": string,',
    '"keywords": [{"phrase": string, "intent": "informational"|"commercial"|"transactional", "difficulty": "low"|"medium"|"high", "why": short reason}],',
    '"clusters": [{"title": short post title idea, "keyword": the target phrase}]}.',
    'Return 10-14 keywords and 5-8 cluster post ideas.',
  ].join(' ');
  const raw = await openaiJSON([
    { role: 'system', content: sys },
    { role: 'user', content: `Topic / product: ${topic}\nShop context: ${context || '(a small handmade / illustrated goods shop)'}` },
  ], { temperature: 0.7 });
  return {
    pillar: String(raw.pillar || '').trim(),
    keywords: Array.isArray(raw.keywords) ? raw.keywords.slice(0, 16).map(k => ({
      phrase: String(k.phrase || '').trim(),
      intent: String(k.intent || 'informational').trim(),
      difficulty: String(k.difficulty || 'low').trim(),
      why: String(k.why || '').trim(),
    })).filter(k => k.phrase) : [],
    clusters: Array.isArray(raw.clusters) ? raw.clusters.slice(0, 10).map(c => ({
      title: String(c.title || '').trim(),
      keyword: String(c.keyword || '').trim(),
    })).filter(c => c.title) : [],
  };
}

// ─── Draft a full SEO post ──────────────────────────────────────────
function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
}

async function draftPost({ topic, keyword, context = '', tone = 'warm, personal, expert', wordCount = 900 } = {}) {
  if (!topic && !keyword) throw new Error('topic or keyword required');
  const target = keyword || topic;
  const sys = [
    'You are an expert SEO content writer for a small independent shop.',
    `Write a blog post (~${wordCount} words) that ranks for the target long-tail keyword and reads like a real human wrote it — ${tone}.`,
    'SEO structure rules:',
    '- Put the primary keyword in the title, the first 100 words, one H2, and the meta description.',
    '- Use clear H2/H3 subheadings that mirror how people search (questions where natural).',
    '- Short paragraphs, scannable, genuinely helpful; no keyword stuffing.',
    '- Include a short FAQ (2-4 Q&A) targeting related "People Also Ask" style questions.',
    '- Suggest 2 image ideas that fit the post; write each as a vivid prompt for an illustration generator.',
    'Return STRICT JSON: {',
    '"title": <=60 chars ideally, must contain the keyword,',
    '"metaDescription": 140-160 chars, contains the keyword,',
    '"slug": url slug (lowercase-with-hyphens),',
    '"tags": array of 4-8 short tags,',
    '"excerpt": one-sentence summary,',
    '"bodyHtml": the full post as clean semantic HTML (<h2>/<h3>/<p>/<ul>/<strong> — NO <html>, <head>, <h1>, or inline styles),',
    '"faq": [{"q": string, "a": string}],',
    '"imagePrompts": [string, string]}.',
  ].join(' ');
  const raw = await openaiJSON([
    { role: 'system', content: sys },
    { role: 'user', content: `Target keyword: ${target}\nBroader topic: ${topic || target}\nShop context: ${context || '(a small handmade / illustrated goods shop)'}` },
  ], { temperature: 0.75 });
  const title = String(raw.title || target).trim();
  return {
    title,
    keyword: target,
    metaDescription: String(raw.metaDescription || '').trim().slice(0, 165),
    slug: slugify(raw.slug || title),
    tags: Array.isArray(raw.tags) ? raw.tags.map(t => String(t).trim()).filter(Boolean).slice(0, 10) : [],
    excerpt: String(raw.excerpt || '').trim(),
    bodyHtml: String(raw.bodyHtml || '').trim(),
    faq: Array.isArray(raw.faq) ? raw.faq.slice(0, 5).map(f => ({ q: String(f.q || '').trim(), a: String(f.a || '').trim() })).filter(f => f.q) : [],
    imagePrompts: Array.isArray(raw.imagePrompts) ? raw.imagePrompts.map(p => String(p).trim()).filter(Boolean).slice(0, 3) : [],
  };
}

// Append a rendered FAQ block to the body HTML (kept separate so the editor can
// show it distinctly; joined at publish time).
function composeBodyHtml(post) {
  let html = post.bodyHtml || '';
  if (Array.isArray(post.faq) && post.faq.length) {
    html += '\n<h2>FAQ</h2>\n' + post.faq.map(f => `<h3>${f.q}</h3>\n<p>${f.a}</p>`).join('\n');
  }
  return html;
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
  res.json({
    ready: Boolean(OPENAI_API_KEY),
    firebase: Boolean(bucket()),
    shopify: shopify && typeof shopify.configured === 'function' ? shopify.configured() : false,
  });
});

// topic → keyword research. Body: { topic, context? }.
router.post('/keywords', express.json({ limit: '256kb' }), async (req, res) => {
  try {
    res.json(await researchKeywords(req.body || {}));
  } catch (err) {
    res.status(/required|not set/.test(err.message) ? 400 : 502).json({ error: err.message });
  }
});

// Generate a full SEO post (and best-effort save it to Firestore). Body:
// { topic?, keyword?, context?, tone?, wordCount?, save? }.
router.post('/draft', express.json({ limit: '256kb' }), async (req, res) => {
  try {
    const post = await draftPost(req.body || {});
    let id = null;
    const store = db();
    if (store && req.body?.save !== false) {
      try {
        const ref = await store.collection('forge-blog').add({
          ...post,
          images: [],
          published: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        id = ref.id;
      } catch (e) { console.warn('blog: draft save failed —', e.message); }
    }
    res.json({ id, ...post });
  } catch (err) {
    res.status(/required|not set/.test(err.message) ? 400 : 502).json({ error: err.message });
  }
});

// Generate one image. Body: { prompt, size?, quality?, id? } — if `id` is given
// the URL is appended to that saved draft's images[].
router.post('/image', express.json({ limit: '256kb' }), async (req, res) => {
  try {
    const out = await generateImage(req.body || {});
    const store = db();
    if (store && req.body?.id) {
      try {
        await store.collection('forge-blog').doc(req.body.id).update({
          images: admin.firestore.FieldValue.arrayUnion(out.url),
        });
      } catch (e) { console.warn('blog: image save failed —', e.message); }
    }
    res.json(out);
  } catch (err) {
    res.status(/required|not set/.test(err.message) ? 400 : 502).json({ error: err.message });
  }
});

// Recent saved drafts (best-effort; empty when Firestore is unavailable).
router.get('/posts', async (req, res) => {
  const store = db();
  if (!store) return res.json({ posts: [] });
  try {
    const snap = await store.collection('forge-blog').orderBy('createdAt', 'desc').limit(30).get();
    res.json({ posts: snap.docs.map(d => {
      const v = d.data();
      return { id: d.id, title: v.title, keyword: v.keyword, published: Boolean(v.published), articleUrl: v.articleUrl || null };
    }) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  const store = db();
  if (!store) return res.status(404).json({ error: 'persistence unavailable' });
  try {
    const doc = await store.collection('forge-blog').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const store = db();
  if (!store) return res.status(404).json({ error: 'persistence unavailable' });
  try {
    await store.collection('forge-blog').doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Publish (or draft) to the Shopify store blog. Body: { id?, blogId?, title,
// bodyHtml, faq?, tags?, metaDescription?, imageUrl?, published? }. When `id`
// is given the saved draft is marked published with the resulting article URL.
router.post('/publish', express.json({ limit: '2mb' }), async (req, res) => {
  if (!shopify || !shopify.publishArticle) return res.status(400).json({ error: 'shopify module unavailable' });
  if (!shopify.configured()) return res.status(400).json({ error: 'Shopify not connected — set SHOPIFY_STORE + SHOPIFY_ADMIN_TOKEN' });
  const body = req.body || {};
  try {
    const bodyHtml = body.faq ? composeBodyHtml(body) : (body.bodyHtml || '');
    const result = await shopify.publishArticle({
      blogId: body.blogId,
      title: body.title,
      bodyHtml,
      summaryHtml: body.metaDescription ? `<p>${body.metaDescription}</p>` : (body.excerpt ? `<p>${body.excerpt}</p>` : undefined),
      tags: body.tags,
      imageUrl: body.imageUrl,
      published: Boolean(body.published),
      handle: body.slug,
    });
    const store = db();
    if (store && body.id) {
      try {
        await store.collection('forge-blog').doc(body.id).update({
          published: Boolean(body.published),
          articleUrl: result.adminUrl || null,
          liveUrl: result.liveUrl || null,
        });
      } catch (e) { console.warn('blog: publish mark failed —', e.message); }
    }
    res.json(result);
  } catch (err) {
    res.status(/required|not configured|no blog/.test(err.message) ? 400 : 502).json({ error: err.message });
  }
});

module.exports = {
  router,
  researchKeywords,
  draftPost,
  generateImage,
  composeBodyHtml,
};
