// blog.js — SEO blog generator (mounted at /api/blog, page at /blog).
//
// The idea: a small shop drives free organic search traffic by publishing blog
// posts targeted at LONG-TAIL keywords — specific, low-competition buyer
// phrases that big sites ignore and that Google's AI Overviews can't fully
// answer, so the click still comes to you.
//
// Flow (mirrors the rest of the studio — generate, then a human reviews):
//   topic → long-tail keyword research (Claude — see the model note below)
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
const googleads = require('./googleads'); // real keyword search-volume data (when Basic access is live)
const anthropic = require('./anthropic');   // reader-facing words run on Claude

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';

function tryRequire(name) {
  try { return require(name); } catch (err) {
    console.warn(`blog: ${name} unavailable —`, err.message);
    return null;
  }
}
const shopify = tryRequire('./shopify');
const blogPublic = require('./blog-public'); // the public site blog (secretlyawitch.com/blog)

function db() {
  return admin.apps.length ? admin.firestore() : null;
}
function bucket() {
  try { return admin.apps.length ? admin.storage().bucket() : null; } catch { return null; }
}

// ─── Text: Claude ───────────────────────────────────────────────────
// Both text steps here — the keyword research AND the post itself — run on
// Claude, not gpt-4o-mini (Aug 2026, Sophie). Keyword research is the reason:
// it decides what the whole post is FOR, and a weak call there wastes every
// step after it. See anthropic.js for the model choice and what it costs.
//
// Takes [{role, content}] with the system turn first (the shape the old
// OpenAI helper used, so the callers below didn't change), returns a parsed object.
async function claudeJSON(messages, { temperature = 0.7 } = {}) {
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const turns = messages.filter(m => m.role !== 'system');
  return anthropic.chatJSON({ system, messages: turns, temperature, maxTokens: 8000 });
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
  const raw = await claudeJSON([
    { role: 'system', content: sys },
    { role: 'user', content: `Topic / product: ${topic}\nShop context: ${context || '(a small handmade / illustrated goods shop)'}` },
  ], { temperature: 0.7 });
  const out = {
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
  // Enrich each keyword with REAL monthly search volume from Google Ads when
  // it's wired up + approved. Best-effort: if the token is still on Test access
  // (PERMISSION_DENIED) or anything errors, we silently keep the AI estimates.
  out.volumeSource = 'estimated';
  if (googleads.configured && googleads.configured() && out.keywords.length) {
    try {
      const metrics = await googleads.generateHistoricalMetrics({ keywords: out.keywords.map(k => k.phrase) });
      const byPhrase = new Map(metrics.map(m => [String(m.text || '').toLowerCase(), m]));
      out.keywords = out.keywords.map((k) => {
        const m = byPhrase.get(k.phrase.toLowerCase());
        return m ? { ...k, avgMonthlySearches: m.avgMonthlySearches, competition: m.competition ?? k.difficulty } : k;
      });
      // Sort by real demand when we have it.
      out.keywords.sort((a, b) => (b.avgMonthlySearches || -1) - (a.avgMonthlySearches || -1));
      out.volumeSource = 'google_ads';
    } catch (err) {
      out.volumeNote = `real volumes unavailable (${err.message}) — showing AI estimates`;
    }
  }
  return out;
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
  const raw = await claudeJSON([
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

router.get('/status', async (req, res) => {
  let shopifyConnected = false;
  try {
    if (shopify && typeof shopify.connected === 'function') shopifyConnected = await shopify.connected();
    else if (shopify && typeof shopify.configured === 'function') shopifyConnected = shopify.configured();
  } catch { /* leave false */ }
  res.json({
    ready: Boolean(OPENAI_API_KEY),
    firebase: Boolean(bucket()),
    shopify: shopifyConnected,
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
        // THE WHOLE PROMPT (Sophie's hard rule, 2026-08-24). `images[]` is a
        // bare url array that says nothing about how a picture was made, so
        // the prompt rides a parallel record keyed by url — the array keeps
        // its shape for every existing reader.
        await store.collection('forge-blog').doc(req.body.id).update({
          images: admin.firestore.FieldValue.arrayUnion(out.url),
          imagePrompts: admin.firestore.FieldValue.arrayUnion({
            url: out.url,
            // Nothing is wrapped around a blog prompt — it goes verbatim — so
            // the whole prompt IS her text and there is no style half.
            fullPrompt: String(req.body.prompt || '').slice(0, 6000),
            at: Date.now(),
          }),
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
      return { id: d.id, title: v.title, keyword: v.keyword, published: Boolean(v.published), articleUrl: v.articleUrl || null, site: Boolean(v.site), siteSlug: v.siteSlug || null };
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
    const fields = {
      blogId: body.blogId,
      title: body.title,
      bodyHtml,
      summaryHtml: body.metaDescription ? `<p>${body.metaDescription}</p>` : (body.excerpt ? `<p>${body.excerpt}</p>` : undefined),
      tags: body.tags,
      imageUrl: body.imageUrl,
      published: Boolean(body.published),
      handle: body.slug,
      publishedAt: body.publishedAt,
    };
    // With `articleId`, edit that article in place instead of creating a new
    // draft — so revisions replace the existing post rather than piling up.
    const result = body.articleId
      ? await shopify.updateArticle({ ...fields, articleId: body.articleId })
      : await shopify.publishArticle(fields);
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

// Publish (or unpublish) a saved draft to the SITE blog — the public pages at
// secretlyawitch.com/blog served by blog-public.js. No Shopify involved: it
// just stamps the Firestore doc with the final content + `site: true`.
// Body: { id, title?, bodyHtml?, metaDescription?, tags?, slug?, imageUrl?,
// unpublish? }. Edited fields from the studio override the saved draft.
router.post('/publish-site', express.json({ limit: '2mb' }), async (req, res) => {
  const store = db();
  if (!store) return res.status(400).json({ error: 'persistence unavailable' });
  const b = req.body || {};
  if (!b.id) return res.status(400).json({ error: 'no saved draft — write the post first (drafts save automatically)' });
  try {
    const ref = store.collection('forge-blog').doc(b.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'draft not found' });
    const cur = doc.data();
    if (b.unpublish) {
      await ref.update({ site: false, siteUpdatedAt: admin.firestore.FieldValue.serverTimestamp() });
      blogPublic.bust();
      return res.json({ ok: true, site: false });
    }
    let slug = slugify(b.slug || cur.siteSlug || cur.slug || b.title || cur.title) || b.id;
    // Keep slugs unique across site posts (another doc already using it gets priority).
    const clash = await store.collection('forge-blog').where('siteSlug', '==', slug).limit(2).get();
    if (clash.docs.some((d) => d.id !== b.id)) slug = `${slug}-${b.id.slice(0, 5).toLowerCase()}`;
    await ref.update({
      site: true,
      siteSlug: slug,
      title: b.title || cur.title || '(untitled)',
      metaDescription: b.metaDescription !== undefined ? b.metaDescription : (cur.metaDescription || ''),
      tags: Array.isArray(b.tags) ? b.tags : (cur.tags || []),
      // The studio's body textarea already has the FAQ appended inline; a bare
      // API draft doesn't, so compose it in that case.
      siteBodyHtml: b.bodyHtml || composeBodyHtml(cur),
      siteImage: b.imageUrl || (Array.isArray(cur.images) && cur.images[0]) || null,
      sitePublishedAt: cur.sitePublishedAt || admin.firestore.FieldValue.serverTimestamp(),
      siteUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    blogPublic.bust();
    res.json({ ok: true, site: true, slug, liveUrl: `${blogPublic.siteOrigin()}/blog/${slug}` });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Delete a Shopify article (draft or live). Body: { articleId, blogId? }.
router.post('/delete-article', express.json(), async (req, res) => {
  if (!shopify || !shopify.deleteArticle) return res.status(400).json({ error: 'shopify module unavailable' });
  if (!shopify.configured()) return res.status(400).json({ error: 'Shopify not connected' });
  try {
    res.json(await shopify.deleteArticle(req.body || {}));
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
