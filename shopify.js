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
const crypto = require('crypto');
const admin = require('firebase-admin');

const STORE = (process.env.SHOPIFY_STORE || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
// Three ways to authenticate, checked in this order:
//   1. A static Admin API access token (SHOPIFY_ADMIN_TOKEN) — the old
//      "legacy custom app" shpat_… token, if a store still has one.
//   2. An OAuth offline token from the /connect flow (authorization code grant).
//      This is the path for NEW Dev Dashboard apps installed on a single store
//      ("custom distribution"): Shopify docs require them to use token exchange
//      or the authorization code grant — client credentials silently returns a
//      token with NO scopes for these apps. The offline token doesn't expire, so
//      a one-time /connect authorization sticks (persisted to Firestore).
//   3. Client credentials (SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET) — only
//      works for apps developed and installed inside your own org where scopes
//      are attached to the token; kept as a fallback. Short-lived (24h), cached.
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || '';
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID || '';
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET || '';
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
const SCOPES = process.env.SHOPIFY_SCOPES || 'read_customers,read_content,write_content';
const TOKENS_DOC = process.env.SHOPIFY_TOKENS_DOC || 'config/shopify-tokens';

function hasOAuthApp() {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}
function configured() {
  return Boolean(STORE && (ADMIN_TOKEN || hasOAuthApp()));
}

function base() {
  return `https://${STORE}/admin/api/${API_VERSION}`;
}

// ─── OAuth offline token: persisted to Firestore (survives Render restarts) ──
// Mirrors etsy.js: one small doc holds { access_token, scope, shop }. Cached in
// memory for the process lifetime once loaded.
let oauthToken = null;     // { access_token, scope, shop }
let oauthLoaded = false;

function tokensDocRef() {
  if (!admin.apps.length) return null;
  try {
    const slash = TOKENS_DOC.indexOf('/');
    return admin.firestore().collection(TOKENS_DOC.slice(0, slash)).doc(TOKENS_DOC.slice(slash + 1));
  } catch { return null; }
}
async function loadOAuthToken() {
  if (oauthLoaded) return oauthToken;
  const ref = tokensDocRef();
  if (ref) {
    try { const snap = await ref.get(); if (snap.exists) oauthToken = snap.data(); } catch (err) {
      console.warn('shopify: token read failed —', err.message);
    }
  }
  oauthLoaded = true;
  return oauthToken;
}
async function saveOAuthToken(t) {
  oauthToken = t; oauthLoaded = true;
  const ref = tokensDocRef();
  if (ref) { try { await ref.set(t); } catch (err) { console.warn('shopify: token write failed —', err.message); } }
}

// Connected = a usable Admin token exists (static, or a stored OAuth token).
async function connected() {
  if (ADMIN_TOKEN) return true;
  return Boolean(await loadOAuthToken());
}
async function authMode() {
  if (ADMIN_TOKEN) return 'admin_token';
  if (await loadOAuthToken()) return 'oauth';
  if (hasOAuthApp()) return 'client_credentials';
  return null;
}

// ─── /connect + /callback (authorization code grant) ────────────────
function redirectUri() {
  if (process.env.SHOPIFY_REDIRECT_URI) return process.env.SHOPIFY_REDIRECT_URI;
  const b = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL || 'http://localhost:3001';
  return `${b.replace(/\/$/, '')}/api/shopify/callback`;
}
const pendingStates = new Set(); // short-lived CSRF nonces

function buildAuthUrl() {
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.add(state);
  setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000).unref?.();
  const q = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: redirectUri(),
    state,
    // no grant_options[]=per-user → an OFFLINE token that doesn't expire
  });
  return `https://${STORE}/admin/oauth/authorize?${q.toString()}`;
}

// Verify Shopify's HMAC on the callback query (all params except hmac, sorted,
// joined k=v with &, HMAC-SHA256 with the client secret).
function validCallbackHmac(query) {
  const { hmac, signature, ...rest } = query;
  if (!hmac) return false;
  const message = Object.keys(rest).sort().map(k => `${k}=${rest[k]}`).join('&');
  const digest = crypto.createHmac('sha256', CLIENT_SECRET).update(message).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(hmac, 'hex')); } catch { return false; }
}

// Exchange the callback's authorization code for a permanent offline token.
async function exchangeCode(shop, code) {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Connection': 'close' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code }),
    timeout: 20000,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`Shopify code exchange failed: ${data.error_description || data.error || `HTTP ${res.status}`}`);
  }
  await saveOAuthToken({ access_token: data.access_token, scope: data.scope || '', shop });
  return oauthToken;
}

// ─── Access token resolution ────────────────────────────────────────
let ccToken = null; // client-credentials cache { token, expiresAt }

async function mintClientCredentials() {
  const res = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'Connection': 'close' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'client_credentials' }).toString(),
    timeout: 20000,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`Shopify token exchange failed: ${data.error_description || data.error || `HTTP ${res.status}`}`);
  }
  const ttlMs = (Number(data.expires_in) || 86400) * 1000;
  ccToken = { token: data.access_token, expiresAt: Date.now() + ttlMs - 5 * 60 * 1000 };
  return ccToken.token;
}

async function getToken({ force = false } = {}) {
  if (ADMIN_TOKEN) return ADMIN_TOKEN;
  const stored = await loadOAuthToken();
  if (stored && stored.access_token) return stored.access_token;
  if (!hasOAuthApp()) {
    throw new Error('Shopify not connected — visit /api/shopify/connect to authorize, or set SHOPIFY_ADMIN_TOKEN');
  }
  if (!force && ccToken && ccToken.expiresAt > Date.now()) return ccToken.token;
  return mintClientCredentials();
}

// ─── Low-level Admin API callers ────────────────────────────────────
// Add the current access token; on a 401 from a client-credentials token,
// re-mint once and retry so a stale cached token self-heals.
async function shopifyFetch(url, opts, isRetry = false) {
  const token = await getToken({ force: isRetry });
  const res = await fetch(url, { ...opts, headers: { 'X-Shopify-Access-Token': token, ...opts.headers } });
  if (res.status === 401 && !isRetry && !ADMIN_TOKEN && !(await loadOAuthToken())) {
    ccToken = null;
    return shopifyFetch(url, opts, true);
  }
  return res;
}

async function shopifyREST(path, { method = 'GET', body } = {}) {
  if (!configured()) throw new Error('Shopify not configured (SHOPIFY_STORE + SHOPIFY_ADMIN_TOKEN, or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET)');
  const res = await shopifyFetch(`${base()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Connection': 'close' },
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
  if (!configured()) throw new Error('Shopify not configured (SHOPIFY_STORE + SHOPIFY_ADMIN_TOKEN, or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET)');
  const res = await shopifyFetch(`${base()}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Connection': 'close' },
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

// ─── Products (for in-post placement / clickable store links) ───────
// Uses the store's PUBLIC `/products.json` (no auth, no `read_products` scope) —
// the OAuth token here only carries customer/content scopes, and products are
// public on the storefront anyway. Returns title / handle / public URL /
// featured image / price so the blog can weave in a clickable product link.
async function listProducts({ max = 250 } = {}) {
  const out = [];
  let page = 1;
  while (out.length < max && page <= 20) {
    const res = await fetch(`https://${STORE}/products.json?limit=250&page=${page}`, {
      headers: { 'Accept': 'application/json', 'Connection': 'close' },
      timeout: 30000,
    });
    if (!res.ok) throw new Error(`Shopify products.json ${res.status}`);
    const data = await res.json().catch(() => ({}));
    const products = Array.isArray(data.products) ? data.products : [];
    if (!products.length) break;
    for (const p of products) {
      out.push({
        title: p.title,
        handle: p.handle,
        url: `https://${STORE}/products/${p.handle}`,
        image: p.images && p.images[0] ? p.images[0].src : null,
        price: p.variants && p.variants[0] ? p.variants[0].price : null,
        productType: p.product_type || '',
      });
      if (out.length >= max) break;
    }
    page++;
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
// everything except the harmless status read and the browser-facing OAuth
// routes (which are redirects/callbacks and can't carry the header; the OAuth
// `state` nonce + Shopify's HMAC are their protection).
const OPEN_PATHS = new Set(['/status', '/connect', '/callback']);
router.use((req, res, next) => {
  if (!STUDIO_TOKEN) return next();
  if (req.method === 'GET' && OPEN_PATHS.has(req.path)) return next();
  if (req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

router.get('/status', async (req, res) => {
  res.json({
    configured: configured(),
    connected: await connected(),
    store: STORE || null,
    apiVersion: API_VERSION,
    authMode: await authMode(),
    scopes: SCOPES,
  });
});

// Start the OAuth authorization-code flow — redirects to Shopify's consent
// screen. A one-time authorization mints a permanent offline token.
router.get('/connect', (req, res) => {
  if (!STORE) return res.status(400).send('SHOPIFY_STORE not set');
  if (!hasOAuthApp()) return res.status(400).send('SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET not set');
  res.redirect(buildAuthUrl());
});

// Shopify redirects here after the merchant approves. Verify HMAC + state,
// exchange the code for a permanent token, store it.
router.get('/callback', async (req, res) => {
  try {
    const { code, state, shop } = req.query;
    if (!code || !shop) return res.status(400).send('Missing code/shop.');
    if (!state || !pendingStates.has(state)) return res.status(400).send('Invalid or expired state. Start again at /api/shopify/connect.');
    pendingStates.delete(state);
    if (!validCallbackHmac(req.query)) return res.status(400).send('HMAC validation failed.');
    if (STORE && shop !== STORE) return res.status(400).send(`Unexpected shop "${shop}".`);
    const tok = await exchangeCode(shop, code);
    res.type('html').send(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;max-width:520px;margin:60px auto;padding:0 20px;line-height:1.5">
      <h2>✅ Shopify connected</h2>
      <p>Granted scopes: <code>${(tok.scope || '(none)')}</code></p>
      <p>You can close this tab and go back to <a href="/blog">Blog Studio</a>.</p></body>`);
  } catch (err) {
    res.status(502).send(`Connection failed: ${err.message}`);
  }
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

// Active products + public URLs, for in-post product placement.
router.get('/products', async (req, res) => {
  try {
    const products = await listProducts({ max: Math.min(Number(req.query.max) || 250, 1000) });
    res.json({ count: products.length, products });
  } catch (err) {
    res.status(/not configured|not connected/.test(err.message) ? 400 : 502).json({ error: err.message });
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
  connected,
  listSubscribers,
  listProducts,
  listBlogs,
  publishArticle,
};
