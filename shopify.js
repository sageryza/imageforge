// shopify.js — Shopify Admin API module (mounted at /api/shopify).
//
// ONE custom-app token powers two ImageForge ideas:
//   • the newsletter — pull email subscribers (customers who opted in to
//     marketing) so a campaign can be written for a real audience.
//   • the blog — publish SEO articles straight to the store's built-in blog,
//     which drives organic search traffic to the shop itself.
//
// The existing storefront token in the site's Buy Button is the PUBLIC
// Storefront API (products + carts only). It cannot read customers — that is by
// design. This module uses the ADMIN API instead, which needs a custom-app
// token (format `shpat_…`) created in the Shopify admin with the scopes
// `read_customers` + `read_content` + `write_content`.
//
// Env vars (Render dashboard or the Firestore config doc, sync:false):
//   SHOPIFY_STORE         e.g. "cod-god-inc.myshopify.com"
//   SHOPIFY_ADMIN_TOKEN   the "shpat_…" Admin API access token
//   SHOPIFY_API_VERSION   optional, defaults to a known-stable version
//
// Customers are read over the GraphQL Admin API (Shopify is retiring REST for
// customer data); blogs/articles use the stable REST endpoints. Both hit the
// same host with the same `X-Shopify-Access-Token` header.

const express = require('express');
const fetch = require('node-fetch');

const STORE = (process.env.SHOPIFY_STORE || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || '';
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';

function configured() {
  return Boolean(STORE && TOKEN);
}

function base() {
  return `https://${STORE}/admin/api/${API_VERSION}`;
}

// ─── Low-level Admin API callers ────────────────────────────────────
async function shopifyREST(path, { method = 'GET', body } = {}) {
  if (!configured()) throw new Error('Shopify not configured (SHOPIFY_STORE + SHOPIFY_ADMIN_TOKEN)');
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: {
      'X-Shopify-Access-Token': TOKEN,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Connection': 'close',
    },
    body: body ? JSON.stringify(body) : undefined,
    timeout: 30000,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data && (data.errors || data.error) ? JSON.stringify(data.errors || data.error) : `HTTP ${res.status}`;
    throw new Error(`Shopify REST ${res.status}: ${msg}`);
  }
  return data;
}

async function shopifyGraphQL(query, variables = {}) {
  if (!configured()) throw new Error('Shopify not configured (SHOPIFY_STORE + SHOPIFY_ADMIN_TOKEN)');
  const res = await fetch(`${base()}/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': TOKEN,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Connection': 'close',
    },
    body: JSON.stringify({ query, variables }),
    timeout: 30000,
  });
  const data = await res.json();
  if (data.errors) throw new Error(`Shopify GraphQL: ${JSON.stringify(data.errors)}`);
  if (data.data == null) throw new Error('Shopify GraphQL returned no data');
  return data.data;
}

// ─── Subscribers (the newsletter audience) ──────────────────────────
// Customers whose email marketing state is SUBSCRIBED. Paginates through the
// whole list (250 at a time). Returns lightweight { email, firstName, lastName }
// records — never raw addresses in logs.
const SUBSCRIBERS_QUERY = `
  query Subscribers($cursor: String) {
    customers(first: 250, after: $cursor, query: "email_marketing_state:subscribed") {
      edges {
        cursor
        node {
          email
          firstName
          lastName
          emailMarketingConsent { marketingState }
        }
      }
      pageInfo { hasNextPage }
    }
  }`;

async function listSubscribers({ max = 5000 } = {}) {
  const out = [];
  let cursor = null;
  let hasNext = true;
  while (hasNext && out.length < max) {
    const data = await shopifyGraphQL(SUBSCRIBERS_QUERY, { cursor });
    const conn = data.customers;
    for (const edge of conn.edges) {
      const n = edge.node;
      if (!n.email) continue;
      if (n.emailMarketingConsent && n.emailMarketingConsent.marketingState !== 'SUBSCRIBED') continue;
      out.push({
        email: n.email,
        firstName: n.firstName || '',
        lastName: n.lastName || '',
      });
      cursor = edge.cursor;
    }
    hasNext = conn.pageInfo.hasNextPage;
  }
  return out;
}

// ─── Blogs + articles (the SEO destination) ─────────────────────────
async function listBlogs() {
  const data = await shopifyREST('/blogs.json');
  return (data.blogs || []).map(b => ({ id: b.id, title: b.title, handle: b.handle }));
}

// Publish (or draft) a blog article. `published:false` creates a hidden draft
// Sophie can review in the Shopify admin before it goes live — same
// review-before-publish philosophy as the Etsy pipeline.
async function publishArticle({ blogId, title, bodyHtml, summaryHtml, tags, author, imageUrl, published = false, handle } = {}) {
  if (!blogId) {
    // Default to the first blog on the store ("News" exists by default).
    const blogs = await listBlogs();
    if (!blogs.length) throw new Error('no blog found on the store — create one in Shopify admin first');
    blogId = blogs[0].id;
  }
  if (!title) throw new Error('title required');
  const article = {
    title,
    body_html: bodyHtml || '',
    published: Boolean(published),
  };
  if (summaryHtml) article.summary_html = summaryHtml;
  if (author) article.author = author;
  if (handle) article.handle = handle;
  if (Array.isArray(tags) && tags.length) article.tags = tags.join(', ');
  else if (typeof tags === 'string' && tags.trim()) article.tags = tags;
  if (imageUrl) article.image = { src: imageUrl };
  const data = await shopifyREST(`/blogs/${blogId}/articles.json`, { method: 'POST', body: { article } });
  const a = data.article || {};
  const adminUrl = `https://${STORE}/admin/articles/${a.id}`;
  const liveUrl = a.handle ? `https://${STORE}/blogs/${a.blog_id}/${a.handle}` : null;
  return { ok: true, id: a.id, blog_id: a.blog_id, handle: a.handle, published: Boolean(a.published_at), adminUrl, liveUrl };
}

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();

// Same access gate as the rest of the studio: STUDIO_TOKEN required on
// everything except the harmless status read.
router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.method === 'GET' && req.path === '/status') return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

router.get('/status', (req, res) => {
  res.json({ configured: configured(), store: STORE || null, apiVersion: API_VERSION });
});

// The newsletter audience. { count, subscribers:[{email,firstName,lastName}] }.
router.get('/subscribers', async (req, res) => {
  try {
    const max = Math.min(Number(req.query.max) || 5000, 20000);
    const subscribers = await listSubscribers({ max });
    res.json({ count: subscribers.length, subscribers });
  } catch (err) {
    res.status(/not configured/.test(err.message) ? 400 : 502).json({ error: err.message });
  }
});

// Same list as a downloadable CSV (drop straight into Shopify Email / Mailchimp).
router.get('/subscribers.csv', async (req, res) => {
  try {
    const subscribers = await listSubscribers({ max: Math.min(Number(req.query.max) || 20000, 20000) });
    const esc = s => `"${String(s || '').replace(/"/g, '""')}"`;
    const rows = [['email', 'first_name', 'last_name'].join(',')]
      .concat(subscribers.map(s => [esc(s.email), esc(s.firstName), esc(s.lastName)].join(',')));
    res.type('text/csv').set('Content-Disposition', 'attachment; filename="subscribers.csv"').send(rows.join('\n'));
  } catch (err) {
    res.status(/not configured/.test(err.message) ? 400 : 502).json({ error: err.message });
  }
});

router.get('/blogs', async (req, res) => {
  try {
    res.json({ blogs: await listBlogs() });
  } catch (err) {
    res.status(/not configured/.test(err.message) ? 400 : 502).json({ error: err.message });
  }
});

// Publish/draft an article. Body: { blogId?, title, bodyHtml, summaryHtml?,
// tags?, author?, imageUrl?, published? }.
router.post('/blog-post', express.json({ limit: '2mb' }), async (req, res) => {
  try {
    const out = await publishArticle(req.body || {});
    res.json(out);
  } catch (err) {
    res.status(/required|not configured|no blog/.test(err.message) ? 400 : 502).json({ error: err.message });
  }
});

module.exports = {
  router,
  configured,
  listSubscribers,
  listBlogs,
  publishArticle,
};
