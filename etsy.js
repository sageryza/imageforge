// etsy.js — Etsy Open API v3 integration for the product pipeline.
//
// Two auth tiers:
//   1. App-level (key only) — read-only "public" endpoints like the ping and
//      the seller taxonomy. Auth is the x-api-key header carrying BOTH the
//      keystring and the shared secret joined by a colon:
//          x-api-key: <ETSY_API_KEY>:<ETSY_SHARED_SECRET>
//      (Confirmed working against /v3/application/openapi-ping. Sending the
//      keystring alone returns 403 "Shared secret is required".)
//   2. User-level (OAuth 2.0 + PKCE) — anything that reads private shop data
//      or writes (createDraftListing, image upload). Requires the listings_r /
//      listings_w scopes and a per-user access token that expires hourly and
//      is refreshed with a 90-day refresh token.
//
// Everything here is wired through an Express router mounted at /api/etsy by
// server.js. The module keeps zero hard dependencies on the rest of the app so
// it can be lifted into a standalone tool later (see handoff doc).

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

const API = 'https://openapi.etsy.com/v3/application';
const OAUTH_AUTHORIZE = 'https://www.etsy.com/oauth/connect';
const OAUTH_TOKEN = 'https://api.etsy.com/v3/public/oauth/token';

// Scopes the pipeline needs. listings_r to read the shop's own drafts,
// listings_w to create them, transactions_r for orders/sales data (the shop
// report), shops_r for shop-level info. Widening this list requires a one-time
// re-authorization at /api/etsy/connect — existing tokens keep their old scopes.
const SCOPES = ['listings_r', 'listings_w', 'transactions_r', 'shops_r'];

const API_KEY = process.env.ETSY_API_KEY || '';
const SHARED_SECRET = process.env.ETSY_SHARED_SECRET || '';
// Optional access token — gates the write routes (draft/state) when set.
const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
function requireToken(req, res, next) {
  if (!STUDIO_TOKEN || req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

// Where to land after the Etsy consent screen. Must EXACTLY match a callback
// URL registered on the app in the Etsy developer dashboard. Defaults to the
// Render external URL when present, else localhost for dev.
function redirectUri() {
  if (process.env.ETSY_REDIRECT_URI) return process.env.ETSY_REDIRECT_URI;
  const base = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL || 'http://localhost:3001';
  return `${base.replace(/\/$/, '')}/api/etsy/callback`;
}

// ─── Token store ────────────────────────────────────────────────────
// OAuth tokens persist to FIRESTORE when Firebase is available, so they survive
// Render redeploys / cold restarts (the free-tier disk is wiped on restart,
// which would otherwise log Etsy out on every deploy). Falls back to a local
// JSON file when Firebase isn't initialized (e.g. local dev without a service
// account). Either way an in-memory copy is cached for the process lifetime.
const admin = require('firebase-admin');
const TOKEN_FILE = process.env.ETSY_TOKEN_FILE || path.join(__dirname, '.etsy-tokens.json');
const TOKENS_DOC = process.env.ETSY_TOKENS_DOC || 'config/etsy-tokens';
let tokens = null; // { access_token, refresh_token, expires_at, scopes }

// The Firestore document handle for the tokens, or null when Firebase isn't up.
function tokensDocRef() {
  if (!admin.apps.length) return null;
  try {
    const slash = TOKENS_DOC.indexOf('/');
    return admin.firestore()
      .collection(TOKENS_DOC.slice(0, slash))
      .doc(TOKENS_DOC.slice(slash + 1));
  } catch { return null; }
}

async function loadTokens() {
  if (tokens) return tokens;
  const ref = tokensDocRef();
  if (ref) {
    try {
      const snap = await ref.get();
      if (snap.exists) { tokens = snap.data(); return tokens; }
    } catch (err) {
      console.warn('etsy: Firestore token read failed —', err.message);
    }
  }
  try { tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); } catch { tokens = null; }
  return tokens;
}

async function saveTokens(t) {
  tokens = t;
  const ref = tokensDocRef();
  if (ref) {
    try { await ref.set(t); return; } catch (err) {
      console.warn('etsy: Firestore token write failed, falling back to file —', err.message);
    }
  }
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2));
  } catch (err) {
    console.warn('etsy: could not persist tokens:', err.message);
  }
}

// In-flight OAuth attempts: state -> code_verifier. Single-process, short-lived.
const pendingAuth = new Map();

// ─── Low-level fetch helpers ────────────────────────────────────────
function appKeyHeader() {
  // The validated app-level credential format.
  return `${API_KEY}:${SHARED_SECRET}`;
}

function configured() {
  return Boolean(API_KEY && SHARED_SECRET);
}

// App-level (no user) request — ping, taxonomy, anything "public".
async function appFetch(pathname, opts = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...opts,
    headers: { 'x-api-key': appKeyHeader(), ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, ok: res.ok, body };
}

// User-level request — adds the Bearer access token, refreshing first if it is
// expired or within 60s of expiry. Throws if not connected.
async function userFetch(pathname, opts = {}) {
  await ensureFreshToken();
  if (!tokens) throw new Error('not_connected');
  const res = await fetch(`${API}${pathname}`, {
    ...opts,
    headers: {
      'x-api-key': appKeyHeader(),
      'Authorization': `Bearer ${tokens.access_token}`,
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, ok: res.ok, body };
}

// ─── OAuth 2.0 (PKCE) ───────────────────────────────────────────────
function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Build the consent URL plus the PKCE secrets the callback will need.
function buildAuthUrl() {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());
  const state = base64url(crypto.randomBytes(16));
  pendingAuth.set(state, codeVerifier);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: API_KEY,
    redirect_uri: redirectUri(),
    scope: SCOPES.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${OAUTH_AUTHORIZE}?${params.toString()}`;
}

// Exchange an authorization code (from the callback) for tokens.
async function exchangeCode(code, state) {
  const codeVerifier = pendingAuth.get(state);
  if (!codeVerifier) throw new Error('unknown_or_expired_state');
  pendingAuth.delete(state);
  const res = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: API_KEY,
      redirect_uri: redirectUri(),
      code,
      code_verifier: codeVerifier,
    }).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`token_exchange_failed: ${JSON.stringify(data)}`);
  await persist(data);
  return tokens;
}

async function refreshToken() {
  const t = await loadTokens();
  if (!t || !t.refresh_token) throw new Error('not_connected');
  const res = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: API_KEY,
      refresh_token: t.refresh_token,
    }).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`token_refresh_failed: ${JSON.stringify(data)}`);
  await persist(data);
  return tokens;
}

async function persist(data) {
  // Etsy returns access_token, refresh_token, expires_in (seconds). The
  // access token's subject is "<user_id>.xxxxx" — user_id is the prefix.
  const userId = typeof data.access_token === 'string' ? data.access_token.split('.')[0] : null;
  await saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token || (tokens && tokens.refresh_token),
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    user_id: userId,
    scopes: SCOPES,
  });
}

async function ensureFreshToken() {
  const t = await loadTokens();
  if (!t) return;
  if (Date.now() >= t.expires_at - 60_000) {
    await refreshToken();
  }
}

// ─── Seller / write operations ──────────────────────────────────────
// The signed-in user (id + primary shop). Use to discover shop_id.
async function getMe() {
  return userFetch('/users/me');
}

async function getShops(userId) {
  return userFetch(`/users/${userId}/shops`);
}

// ─── Shop data reads (for the report) ───────────────────────────────
// All three return { ok, results } on success or the failed userFetch result
// (with its status/body intact) so callers can surface scope errors — a 403
// here almost always means the token predates the wider SCOPES list and the
// user needs to re-authorize at /api/etsy/connect.

// Every listing in a given state (active / draft / inactive / sold_out),
// paginated 100 at a time. Listings carry views, num_favorers, price, url.
async function getAllListings(shopId, state = 'active') {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const r = await userFetch(`/shops/${shopId}/listings?state=${state}&limit=100&offset=${offset}`);
    if (!r.ok) return offset === 0 ? r : { ok: true, results: out, truncated: true };
    const page = (r.body && r.body.results) || [];
    out.push(...page);
    if (page.length < 100) break;
  }
  return { ok: true, results: out };
}

// Receipts (orders) since a unix timestamp, paginated. Each receipt includes
// its transactions[] (line items with listing_id, quantity, price) plus
// buyer_user_id and grandtotal — everything the sales report aggregates.
async function getReceipts(shopId, { minCreated } = {}) {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const params = new URLSearchParams({ limit: '100', offset: String(offset) });
    if (minCreated) params.set('min_created', String(minCreated));
    const r = await userFetch(`/shops/${shopId}/receipts?${params.toString()}`);
    if (!r.ok) return offset === 0 ? r : { ok: true, results: out, truncated: true };
    const page = (r.body && r.body.results) || [];
    out.push(...page);
    if (page.length < 100) break;
  }
  return { ok: true, results: out };
}

// Most recent reviews (rating + text + listing_id), newest first.
async function getReviews(shopId, limit = 100) {
  const r = await userFetch(`/shops/${shopId}/reviews?limit=${Math.min(limit, 100)}`);
  if (!r.ok) return r;
  return { ok: true, results: (r.body && r.body.results) || [] };
}

// Validate the tag rules from the handoff: up to 13 tags, each <= 20 chars.
function validateTags(tags) {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags
    .map(t => String(t).trim())
    .filter(Boolean)
    .filter(t => t.length <= 20)
    .slice(0, 13);
  return cleaned;
}

// Create a DRAFT listing. Etsy's POST .../listings always creates in "draft"
// state, which is exactly what the pipeline wants (Sophie reviews before
// publishing). Required fields per Etsy + the handoff: quantity, title,
// description, price, who_made, when_made, taxonomy_id. The caller supplies the
// content; we fill safe defaults and enforce the tag rules.
//
// The `legacy` query param selects the processing-time model: legacy=false
// requires a `readiness_state_id` (new processing profiles), while legacy=true
// uses the shipping profile's traditional processing times. We pick legacy=true
// unless a readiness_state_id is supplied, so shops on either model work. The
// caller can force it with `listing.legacy`.
async function createDraftListing(shopId, listing = {}) {
  const payload = {
    quantity: listing.quantity ?? 1,
    title: listing.title,
    description: listing.description,
    price: listing.price,
    who_made: listing.who_made || 'i_did',
    when_made: listing.when_made || '2020_2026',
    taxonomy_id: listing.taxonomy_id,
    type: listing.type || 'physical',
    ...listing.extra, // shipping_profile_id, readiness_state_id, etc.
  };
  if (listing.tags) payload.tags = validateTags(listing.tags);
  if (Array.isArray(listing.materials)) payload.materials = listing.materials;

  const missing = ['title', 'description', 'price', 'taxonomy_id']
    .filter(k => payload[k] === undefined || payload[k] === null || payload[k] === '');
  if (missing.length) {
    const err = new Error(`missing_required_fields: ${missing.join(', ')}`);
    err.code = 'VALIDATION';
    throw err;
  }

  const legacy = listing.legacy !== undefined
    ? listing.legacy
    : !(listing.extra && listing.extra.readiness_state_id);
  return userFetch(`/shops/${shopId}/listings?legacy=${legacy}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(
      Object.fromEntries(
        Object.entries(payload).flatMap(([k, v]) => {
          if (v === undefined || v === null) return [];
          if (Array.isArray(v)) return v.map((item, i) => [`${k}[${i}]`, String(item)]);
          return [[k, String(v)]];
        })
      )
    ).toString(),
  });
}

// Derive sensible listing defaults (shipping profile, return policy, readiness
// state, taxonomy) from an existing active listing in the shop — read with the
// app key, no OAuth scope needed. Lets the UI create a physical draft without
// the user hunting down these ids.
async function getListingDefaults(shopId) {
  const r = await appFetch(`/shops/${shopId}/listings/active?limit=1`);
  const l = r.ok && r.body && Array.isArray(r.body.results) ? r.body.results[0] : null;
  if (!l) return { ok: false, status: r.status, body: r.body };
  return {
    ok: true,
    defaults: {
      shop_id: Number(shopId),
      shipping_profile_id: l.shipping_profile_id,
      return_policy_id: l.return_policy_id,
      readiness_state_id: l.readiness_state_id,
      taxonomy_id: l.taxonomy_id,
    },
  };
}

// Update fields on an existing listing (PATCH). Most useful for changing
// `state` — e.g. reverting a listing that went live ("active") back to "draft"
// or "inactive" so it's not purchasable. Pass any updatable listing fields.
async function updateListing(shopId, listingId, fields = {}) {
  return userFetch(`/shops/${shopId}/listings/${listingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(
      Object.fromEntries(
        Object.entries(fields).flatMap(([k, v]) => (v == null ? [] : [[k, String(v)]]))
      )
    ).toString(),
  });
}

// Set a listing's state. Etsy may reject "draft" for a listing that has already
// been active; in that case fall back to "inactive" (also non-purchasable).
async function setListingState(shopId, listingId, state = 'draft') {
  const first = await updateListing(shopId, listingId, { state });
  if (first.ok || state === 'inactive') return first;
  const fallback = await updateListing(shopId, listingId, { state: 'inactive' });
  return fallback.ok ? { ...fallback, note: `"${state}" rejected; set to "inactive" instead` } : first;
}

// Upload an image to a listing (required before it can be activated). Accepts a
// remote image URL (downloaded here) or a raw Buffer.
async function uploadListingImage(shopId, listingId, image, opts = {}) {
  await ensureFreshToken();
  if (!tokens) throw new Error('not_connected');
  let buffer = image;
  let filename = opts.filename || 'design.png';
  if (typeof image === 'string') {
    const r = await fetch(image);
    if (!r.ok) throw new Error(`image_download_failed: ${r.status}`);
    buffer = await r.buffer();
  }
  const form = new FormData();
  form.append('image', buffer, { filename });
  if (opts.rank != null) form.append('rank', String(opts.rank));
  const res = await fetch(`${API}/shops/${shopId}/listings/${listingId}/images`, {
    method: 'POST',
    headers: {
      'x-api-key': appKeyHeader(),
      'Authorization': `Bearer ${tokens.access_token}`,
      ...form.getHeaders(),
    },
    body: form,
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, ok: res.ok, body };
}

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();

// Read-only health check — proves the app key authenticates. No user needed.
router.get('/ping', async (req, res) => {
  if (!configured()) return res.status(500).json({ ok: false, error: 'ETSY_API_KEY / ETSY_SHARED_SECRET not set' });
  try {
    const r = await appFetch('/openapi-ping');
    res.status(r.status).json({ ok: r.ok, ...((typeof r.body === 'object') ? r.body : { body: r.body }) });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

// Connection status for the pipeline UI / Claude Code to inspect.
router.get('/status', async (req, res) => {
  const t = await loadTokens();
  res.json({
    configured: configured(),
    redirect_uri: redirectUri(),
    scopes: SCOPES,
    connected: Boolean(t && t.refresh_token),
    user_id: t ? t.user_id : null,
    access_expires_at: t ? t.expires_at : null,
  });
});

// Kick off OAuth — redirect the browser to Etsy's consent screen.
router.get('/connect', (req, res) => {
  if (!configured()) return res.status(500).send('Etsy not configured (missing key/secret).');
  res.redirect(buildAuthUrl());
});

// OAuth redirect target. Etsy sends ?code & ?state (or ?error).
router.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  if (error) return res.status(400).send(htmlPage('Etsy authorization failed', `${error}: ${error_description || ''}`));
  if (!code || !state) return res.status(400).send(htmlPage('Etsy authorization failed', 'Missing code or state.'));
  try {
    await exchangeCode(String(code), String(state));
    res.send(htmlPage('Etsy connected ✓', 'You can close this tab and return to the pipeline.'));
  } catch (err) {
    res.status(400).send(htmlPage('Etsy authorization failed', err.message));
  }
});

// Listing defaults derived from an existing active listing (for the studio UI).
router.get('/defaults', async (req, res) => {
  const shopId = req.query.shop_id || process.env.ETSY_SHOP_ID;
  if (!shopId) return res.status(400).json({ error: 'shop_id required (or set ETSY_SHOP_ID)' });
  try {
    const r = await getListingDefaults(shopId);
    if (!r.ok) return res.status(502).json({ error: 'no active listing found to derive defaults from', detail: r.body });
    res.json(r.defaults);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Who am I (and primary shop) — handy first call after connecting.
router.get('/me', async (req, res) => {
  try {
    const me = await getMe();
    res.status(me.status).json(me.body);
  } catch (err) {
    res.status(err.message === 'not_connected' ? 401 : 502).json({ error: err.message });
  }
});

// Create a draft listing. Body = the listing fields (see createDraftListing).
router.post('/listings/draft', requireToken, express.json(), async (req, res) => {
  const { shop_id, ...listing } = req.body || {};
  if (!shop_id) return res.status(400).json({ error: 'shop_id required' });
  try {
    const r = await createDraftListing(shop_id, listing);
    res.status(r.status).json(r.body);
  } catch (err) {
    const code = err.code === 'VALIDATION' ? 400 : (err.message === 'not_connected' ? 401 : 502);
    res.status(code).json({ error: err.message });
  }
});

// Change a listing's state — e.g. revert a listing that accidentally went live
// back to a draft. Body: { shop_id, listing_id, state? } (state defaults to
// "draft"; falls back to "inactive" if Etsy rejects "draft").
router.post('/listings/state', requireToken, express.json(), async (req, res) => {
  const { shop_id, listing_id, state = 'draft' } = req.body || {};
  if (!shop_id || !listing_id) return res.status(400).json({ error: 'shop_id and listing_id required' });
  try {
    const r = await setListingState(shop_id, listing_id, state);
    res.status(r.status).json(r.note ? { ...r.body, note: r.note } : r.body);
  } catch (err) {
    res.status(err.message === 'not_connected' ? 401 : 502).json({ error: err.message });
  }
});

function htmlPage(title, msg) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:'EB Garamond',Georgia,serif;background:#faf6ef;color:#5a1a1a;
display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{background:#fff;border:1px solid #e7ddca;border-radius:6px;padding:32px 40px;
max-width:420px;text-align:center;box-shadow:0 2px 12px rgba(90,26,26,.06)}
h1{font-size:1.4rem;margin:0 0 8px}p{margin:0;color:#7a5a5a}</style></head>
<body><div class="card"><h1>${title}</h1><p>${msg}</p></div></body></html>`;
}

module.exports = {
  router,
  // exported for direct/programmatic use (e.g. Claude Code driving the pipeline)
  appFetch,
  userFetch,
  getMe,
  getShops,
  getAllListings,
  getReceipts,
  getReviews,
  createDraftListing,
  getListingDefaults,
  updateListing,
  setListingState,
  uploadListingImage,
  validateTags,
  buildAuthUrl,
  configured,
};
