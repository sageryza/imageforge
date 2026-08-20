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
//
// MULTI-ACCOUNT (Aug 2026): one Etsy account = one shop, so a second shop
// (the hat shop) means a second Etsy account authorized against the SAME app
// keys. Tokens are keyed by a short account name. The original single-account
// doc keeps its exact path as account "default" — the long-connected shop is
// untouched and every existing caller that doesn't pass an account still hits
// it. A named account lives at `${TOKENS_DOC}-<name>` (config/etsy-tokens-hats).
const admin = require('firebase-admin');
const TOKEN_FILE = process.env.ETSY_TOKEN_FILE || path.join(__dirname, '.etsy-tokens.json');
const TOKENS_DOC = process.env.ETSY_TOKENS_DOC || 'config/etsy-tokens';
const tokensCache = new Map(); // account name -> { access_token, refresh_token, expires_at, ... }

// Account names are short slugs; "default" is the original account. Throws on
// anything else so a typo can never silently mint a new empty account.
function normAccount(account) {
  const a = String(account == null || account === '' ? 'default' : account).toLowerCase().trim();
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(a)) {
    const err = new Error(`bad_account_name: ${JSON.stringify(account)}`);
    err.code = 'VALIDATION';
    throw err;
  }
  return a;
}

function accountDocPath(account) {
  return account === 'default' ? TOKENS_DOC : `${TOKENS_DOC}-${account}`;
}

function accountTokenFile(account) {
  return account === 'default' ? TOKEN_FILE : TOKEN_FILE.replace(/\.json$/i, '') + `-${account}.json`;
}

// The Firestore document handle for an account's tokens, or null when Firebase
// isn't up.
function tokensDocRef(account = 'default') {
  if (!admin.apps.length) return null;
  try {
    const docPath = accountDocPath(account);
    const slash = docPath.indexOf('/');
    return admin.firestore()
      .collection(docPath.slice(0, slash))
      .doc(docPath.slice(slash + 1));
  } catch { return null; }
}

async function loadTokens(account = 'default') {
  if (tokensCache.has(account)) return tokensCache.get(account);
  const ref = tokensDocRef(account);
  if (ref) {
    try {
      const snap = await ref.get();
      if (snap.exists) { tokensCache.set(account, snap.data()); return snap.data(); }
    } catch (err) {
      console.warn('etsy: Firestore token read failed —', err.message);
    }
  }
  let t = null;
  try { t = JSON.parse(fs.readFileSync(accountTokenFile(account), 'utf8')); } catch { t = null; }
  if (t) tokensCache.set(account, t);
  return t;
}

async function saveTokens(t, account = 'default') {
  tokensCache.set(account, t);
  const ref = tokensDocRef(account);
  if (ref) {
    try { await ref.set(t); return; } catch (err) {
      console.warn('etsy: Firestore token write failed, falling back to file —', err.message);
    }
  }
  try {
    fs.writeFileSync(accountTokenFile(account), JSON.stringify(t, null, 2));
  } catch (err) {
    console.warn('etsy: could not persist tokens:', err.message);
  }
}

// Every account with tokens on file: Firestore doc ids under the config
// collection that start with the tokens doc id (plus the local file fallback
// for dev). Each entry is the token doc minus its secrets.
async function listAccounts() {
  const out = new Map();
  const slash = TOKENS_DOC.indexOf('/');
  const collection = TOKENS_DOC.slice(0, slash);
  const prefix = TOKENS_DOC.slice(slash + 1);
  if (admin.apps.length) {
    try {
      const docs = await admin.firestore().collection(collection).listDocuments();
      for (const d of docs) {
        if (d.id !== prefix && !d.id.startsWith(`${prefix}-`)) continue;
        const account = d.id === prefix ? 'default' : d.id.slice(prefix.length + 1);
        const snap = await d.get();
        if (!snap.exists) continue;
        const t = snap.data();
        out.set(account, {
          account,
          connected: Boolean(t && t.refresh_token),
          user_id: t.user_id || null,
          shop_id: t.shop_id || null,
          shop_name: t.shop_name || null,
        });
      }
    } catch (err) {
      console.warn('etsy: account listing failed —', err.message);
    }
  }
  if (!out.has('default')) {
    const t = await loadTokens('default');
    if (t) out.set('default', {
      account: 'default', connected: Boolean(t.refresh_token),
      user_id: t.user_id || null, shop_id: t.shop_id || null, shop_name: t.shop_name || null,
    });
  }
  return [...out.values()].sort((a, b) => a.account.localeCompare(b.account));
}

// In-flight OAuth attempts: state -> { codeVerifier, account }. Single-process,
// short-lived. The account rides the state so the callback knows which token
// slot the freshly authorized Etsy login belongs to.
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
// expired or within 60s of expiry. Throws if not connected. `account` picks
// which connected Etsy account signs the request; omitted = the original shop.
async function userFetch(pathname, opts = {}, account = 'default') {
  await ensureFreshToken(account);
  const tokens = await loadTokens(account);
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
function buildAuthUrl(account = 'default') {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());
  const state = base64url(crypto.randomBytes(16));
  pendingAuth.set(state, { codeVerifier, account });
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

// Exchange an authorization code (from the callback) for tokens. The account
// comes back out of the pending state, so the caller learns which slot filled.
async function exchangeCode(code, state) {
  const pending = pendingAuth.get(state);
  if (!pending) throw new Error('unknown_or_expired_state');
  pendingAuth.delete(state);
  const { codeVerifier, account = 'default' } = pending;
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
  await persist(data, account);
  return { account, tokens: await loadTokens(account) };
}

async function refreshToken(account = 'default') {
  const t = await loadTokens(account);
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
  await persist(data, account);
  return loadTokens(account);
}

async function persist(data, account = 'default') {
  // Etsy returns access_token, refresh_token, expires_in (seconds). The
  // access token's subject is "<user_id>.xxxxx" — user_id is the prefix.
  // Spread the previous doc first so enrichment fields (shop_id, shop_name)
  // survive hourly refreshes.
  const prev = tokensCache.get(account) || await loadTokens(account) || {};
  const userId = typeof data.access_token === 'string' ? data.access_token.split('.')[0] : null;
  await saveTokens({
    ...prev,
    access_token: data.access_token,
    refresh_token: data.refresh_token || prev.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    user_id: userId,
    scopes: SCOPES,
  }, account);
}

async function ensureFreshToken(account = 'default') {
  const t = await loadTokens(account);
  if (!t) return;
  if (Date.now() >= t.expires_at - 60_000) {
    await refreshToken(account);
  }
}

// ─── Seller / write operations ──────────────────────────────────────
// Every function here takes an optional trailing `account` (default 'default'
// = the original shop), so existing callers are untouched and a caller working
// the hat shop passes its account name through.
// The signed-in user (id + primary shop). Use to discover shop_id.
async function getMe(account = 'default') {
  return userFetch('/users/me', {}, account);
}

async function getShops(userId, account = 'default') {
  return userFetch(`/users/${userId}/shops`, {}, account);
}

// ─── Shop data reads (for the report) ───────────────────────────────
// All three return { ok, results } on success or the failed userFetch result
// (with its status/body intact) so callers can surface scope errors — a 403
// here almost always means the token predates the wider SCOPES list and the
// user needs to re-authorize at /api/etsy/connect.

// Every listing in a given state (active / draft / inactive / sold_out),
// paginated 100 at a time. Listings carry views, num_favorers, price, url.
async function getAllListings(shopId, state = 'active', account = 'default') {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const r = await userFetch(`/shops/${shopId}/listings?state=${state}&limit=100&offset=${offset}`, {}, account);
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
async function getReceipts(shopId, { minCreated } = {}, account = 'default') {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const params = new URLSearchParams({ limit: '100', offset: String(offset) });
    if (minCreated) params.set('min_created', String(minCreated));
    const r = await userFetch(`/shops/${shopId}/receipts?${params.toString()}`, {}, account);
    if (!r.ok) return offset === 0 ? r : { ok: true, results: out, truncated: true };
    const page = (r.body && r.body.results) || [];
    out.push(...page);
    if (page.length < 100) break;
  }
  return { ok: true, results: out };
}

// Most recent reviews (rating + text + listing_id), newest first.
async function getReviews(shopId, limit = 100, account = 'default') {
  const r = await userFetch(`/shops/${shopId}/reviews?limit=${Math.min(limit, 100)}`, {}, account);
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
async function createDraftListing(shopId, listing = {}, account = 'default') {
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
  }, account);
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
async function updateListing(shopId, listingId, fields = {}, account = 'default') {
  return userFetch(`/shops/${shopId}/listings/${listingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(
      Object.fromEntries(
        Object.entries(fields).flatMap(([k, v]) => (v == null ? [] : [[k, String(v)]]))
      )
    ).toString(),
  }, account);
}

// Set a listing's state. Etsy may reject "draft" for a listing that has already
// been active; in that case fall back to "inactive" (also non-purchasable).
async function setListingState(shopId, listingId, state = 'draft', account = 'default') {
  const first = await updateListing(shopId, listingId, { state }, account);
  if (first.ok || state === 'inactive') return first;
  const fallback = await updateListing(shopId, listingId, { state: 'inactive' }, account);
  return fallback.ok ? { ...fallback, note: `"${state}" rejected; set to "inactive" instead` } : first;
}

// Upload an image to a listing (required before it can be activated). Accepts a
// remote image URL (downloaded here) or a raw Buffer.
async function uploadListingImage(shopId, listingId, image, opts = {}) {
  const account = normAccount(opts.account);
  await ensureFreshToken(account);
  const tokens = await loadTokens(account);
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

// ─── Keyword research (official public search, no scraping) ─────────
// Uses Etsy's own public listing search (GET /listings/active?keywords=) with
// the app key — no bot-block, no extra accounts, fully automated. Returns
// COMPETITION (total matching active listings) plus the tags most used by the
// top-ranking listings for that keyword — a real, proven-on-Etsy tag signal.
// Note: Etsy exposes no search-VOLUME endpoint; this is competition + what
// actually ranks, which is what you tag against anyway.
async function keywordResearch(keyword, { sample = 100 } = {}) {
  const q = encodeURIComponent(String(keyword).trim());
  const r = await appFetch(`/listings/active?keywords=${q}&limit=${sample}&sort_on=score&sort_order=down`);
  if (!r.ok) return r;
  const results = (r.body && r.body.results) || [];
  const freq = {};
  for (const l of results) {
    for (const t of (l.tags || [])) {
      const k = String(t).toLowerCase().trim();
      if (k) freq[k] = (freq[k] || 0) + 1;
    }
  }
  const top_tags = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([tag, used_by]) => ({ tag, used_by, pct: Math.round((used_by / (results.length || 1)) * 100) }));
  return {
    ok: true,
    keyword,
    competition: (r.body && r.body.count) ?? null, // total active listings for this term
    sampled: results.length,
    top_tags,
  };
}

// Opportunity checker — for a batch of candidate tag phrases, combine the two
// signals we CAN get: competition (how crowded) + a demand proxy (do the
// listings ranking for this phrase actually tag it? if real sellers use it, it
// has some demand). Also returns the top-5 tags of each phrase's results so
// contamination (e.g. Magic-the-Gathering / D&D bleed) is visible. Etsy exposes
// no true search-volume, so this is the best automated niche signal.
async function keywordOpportunity(candidates = []) {
  const out = [];
  for (const raw of candidates) {
    const phrase = String(raw).toLowerCase().trim();
    if (!phrase) continue;
    const kr = await keywordResearch(phrase, { sample: 100 });
    if (!kr || !kr.ok) { out.push({ phrase, error: true }); continue; }
    const self = (kr.top_tags || []).find(t => t.tag === phrase);
    out.push({
      phrase,
      competition: kr.competition,               // fewer = easier to rank
      used_by_winners_pct: self ? self.pct : 0,  // demand proxy: winners tag it?
      sample_tags: (kr.top_tags || []).slice(0, 5).map(t => t.tag), // spot contamination
    });
  }
  // best opportunities first: used by winners AND low competition
  return out.sort((a, b) => {
    const sa = (a.used_by_winners_pct || 0) - Math.log10((a.competition || 1) + 1) * 3;
    const sb = (b.used_by_winners_pct || 0) - Math.log10((b.competition || 1) + 1) * 3;
    return sb - sa;
  });
}

// ─── Variations / inventory ─────────────────────────────────────────
// Etsy models variations through the listing INVENTORY endpoint, not the
// listing itself. Each combination of variation values is a "product" with one
// or more "offerings" (price/quantity/enabled). Custom (text) variations use
// two reserved property ids — 513 and 514 — with a free-text property_name and
// a list of option values. `price_on_property` lists the property ids whose
// value changes the price, which is exactly what a "buy N decks" ladder needs.
const CUSTOM_PROP_IDS = [513, 514];

// Read a listing's current inventory (products/offerings). GET is public-ish
// but we use the user token so drafts are visible too.
async function getListingInventory(listingId, account = 'default') {
  return userFetch(`/listings/${listingId}/inventory`, {}, account);
}

// Replace a listing's inventory. `inventory` must be the full Etsy shape
// ({ products, price_on_property, quantity_on_property, sku_on_property }).
// This is a PUT — it REPLACES everything, so callers build the complete set.
async function updateListingInventory(listingId, inventory, account = 'default') {
  return userFetch(`/listings/${listingId}/inventory`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inventory),
  }, account);
}

// Build the inventory payload for a single-property "how many decks" ladder.
// tiers = [{ label, price, quantity }, ...]; the price varies by the tier, so
// price_on_property points at the custom property. Quantity/sku stay flat.
// propertyName is the dropdown label the buyer sees (e.g. "Bundle").
function buildBundleInventory(tiers, { propertyName = 'Bundle', quantity = 100 } = {}) {
  const propertyId = CUSTOM_PROP_IDS[0];
  return {
    products: tiers.map((t, i) => ({
      sku: t.sku || `BUNDLE-${i + 1}`,
      property_values: [{
        property_id: propertyId,
        property_name: propertyName,
        values: [t.label],
      }],
      offerings: [{
        price: Number(t.price),
        quantity: t.quantity ?? quantity,
        is_enabled: true,
      }],
    })),
    price_on_property: [propertyId],
    quantity_on_property: [],
    sku_on_property: [],
  };
}

// List a listing's images (id + url per image), so photos from one listing can
// be copied onto another (e.g. drop each deck's photo onto the bundle listing).
// Etsy's image READ endpoint is /listings/{id}/images (no shop segment — that
// path is upload-only). shopId is accepted for signature symmetry but unused.
async function getListingImages(shopId, listingId, account = 'default') {
  const id = listingId ?? shopId; // tolerate getListingImages(listingId) too
  const r = await userFetch(`/listings/${id}/images`, {}, account);
  if (!r.ok) return r;
  return { ok: true, results: (r.body && r.body.results) || [] };
}

// Delete a listing outright — used to clean up a throwaway test draft so it
// never lingers in the shop. Etsy only lets you delete drafts / inactive
// listings, which is all we ever call this on.
async function deleteListing(listingId, account = 'default') {
  return userFetch(`/listings/${listingId}`, { method: 'DELETE' }, account);
}

// Delete a single image from a listing. Etsy has no "reorder images" endpoint
// and re-ranking existing images is unreliable, so the safe way to reorder is
// to re-upload copies in the desired order and delete the originals — this is
// the delete half of that. DELETE /shops/{shop}/listings/{listing}/images/{id}.
async function deleteListingImage(shopId, listingId, imageId, account = 'default') {
  return userFetch(`/shops/${shopId}/listings/${listingId}/images/${imageId}`, { method: 'DELETE' }, account);
}

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();

// Which account a request is talking to: ?account= or body.account, default
// the original shop. Answers the 400 itself on a bad name and returns null.
function reqAccount(req, res) {
  try {
    return normAccount((req.query && req.query.account) || (req.body && req.body.account));
  } catch (err) {
    res.status(400).json({ error: err.message });
    return null;
  }
}

// The shop an ACCOUNT writes to: explicit shop_id wins; the default account
// keeps its ETSY_SHOP_ID env fallback; any account falls back to the shop_id
// stored on its token doc at connect time, else null.
//
// THE RULE THAT MATTERS: only "default" may fall back to ETSY_SHOP_ID. That env
// var names ONE shop (the original), so letting a named account borrow it would
// file another seller's listings into someone else's storefront — a mistake
// nobody would notice until the drafts showed up under the wrong shop name.
// A named account with no shop_id yet resolves to null and its caller must
// refuse. (Aug 2026, wiring up a second seller's shop.)
async function shopIdForAccount(account = 'default', explicit = null) {
  if (explicit) return explicit;
  const a = normAccount(account);
  if (a === 'default' && process.env.ETSY_SHOP_ID) return process.env.ETSY_SHOP_ID;
  const t = await loadTokens(a);
  return (t && t.shop_id) || null;
}

// The shop a REQUEST means — the same rule, reading shop_id off query or body.
async function resolveShopId(req, account) {
  const explicit = (req.query && req.query.shop_id) || (req.body && req.body.shop_id);
  return shopIdForAccount(account, explicit);
}

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

// Connection status for the pipeline UI / Claude Code to inspect. ?account=
// picks the account; the response also lists every connected account.
router.get('/status', async (req, res) => {
  const account = reqAccount(req, res);
  if (!account) return;
  const t = await loadTokens(account);
  res.json({
    configured: configured(),
    redirect_uri: redirectUri(),
    scopes: SCOPES,
    account,
    connected: Boolean(t && t.refresh_token),
    user_id: t ? t.user_id : null,
    shop_id: (t && t.shop_id) || null,
    shop_name: (t && t.shop_name) || null,
    access_expires_at: t ? t.expires_at : null,
    accounts: await listAccounts(),
  });
});

// Every connected Etsy account (name, user, shop) — no secrets.
router.get('/accounts', async (req, res) => {
  res.json({ accounts: await listAccounts() });
});

// Kick off OAuth — redirect the browser to Etsy's consent screen. ?account=
// names the slot the authorized login lands in (e.g. /connect?account=hats
// while signed into the hat-shop Etsy account). No account = the original.
router.get('/connect', (req, res) => {
  if (!configured()) return res.status(500).send('Etsy not configured (missing key/secret).');
  const account = reqAccount(req, res);
  if (!account) return;
  res.redirect(buildAuthUrl(account));
});

// OAuth redirect target. Etsy sends ?code & ?state (or ?error). The account
// rides the state, so the callback URL itself never carries it.
router.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  if (error) return res.status(400).send(htmlPage('Etsy authorization failed', `${error}: ${error_description || ''}`));
  if (!code || !state) return res.status(400).send(htmlPage('Etsy authorization failed', 'Missing code or state.'));
  try {
    const { account } = await exchangeCode(String(code), String(state));
    // Best-effort enrichment: remember which shop this account is, so later
    // calls can default their shop_id and the accounts list reads like a list
    // of shops. Failures here never fail the connect.
    try {
      const me = await getMe(account);
      const shopId = me.ok && me.body ? me.body.shop_id : null;
      if (shopId) {
        let shopName = null;
        try {
          const shop = await appFetch(`/shops/${shopId}`);
          shopName = (shop.ok && shop.body && shop.body.shop_name) || null;
        } catch {}
        const t = await loadTokens(account);
        if (t) await saveTokens({ ...t, shop_id: shopId, shop_name: shopName }, account);
      }
    } catch (err) {
      console.warn('etsy: post-connect shop lookup failed —', err.message);
    }
    const label = account === 'default' ? '' : ` (account "${account}")`;
    res.send(htmlPage('Etsy connected ✓', `You can close this tab and return to the pipeline.${label}`));
  } catch (err) {
    res.status(400).send(htmlPage('Etsy authorization failed', err.message));
  }
});

// Listing defaults derived from an existing active listing (for the studio UI).
router.get('/defaults', async (req, res) => {
  const account = reqAccount(req, res);
  if (!account) return;
  const shopId = await resolveShopId(req, account);
  if (!shopId) return res.status(400).json({ error: 'shop_id required (or set ETSY_SHOP_ID / connect the account)' });
  try {
    const r = await getListingDefaults(shopId);
    if (!r.ok) return res.status(502).json({ error: 'no active listing found to derive defaults from', detail: r.body });
    res.json(r.defaults);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Keyword research — competition + top-ranking listings' tags for a term.
// GET /api/etsy/keyword-research?q=witchcraft%20ritual%20cards
router.get('/keyword-research', requireToken, async (req, res) => {
  const q = req.query.q || req.query.keyword;
  if (!q) return res.status(400).json({ error: 'q (keyword) required' });
  try {
    const r = await keywordResearch(q, { sample: Math.min(Number(req.query.sample) || 100, 100) });
    if (!r.ok) return res.status(r.status || 502).json(r.body || { error: 'search failed' });
    res.json(r);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Opportunity checker — POST { candidates: ["phrase", ...] } → competition +
// demand-proxy (used-by-winners) + contamination sample, sorted best-first.
router.post('/keyword-opportunity', requireToken, express.json(), async (req, res) => {
  const candidates = Array.isArray(req.body && req.body.candidates) ? req.body.candidates : [];
  if (!candidates.length) return res.status(400).json({ error: 'candidates: [phrase, ...] required' });
  try {
    const results = await keywordOpportunity(candidates.slice(0, 40));
    res.json({ results });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// List a shop's listings by state (draft/active/inactive/sold_out) — slimmed to
// id/title/state/tags/price so drafts can be found and proven tags read off
// existing listings. ?state= defaults to active; ?shop_id or ETSY_SHOP_ID.
router.get('/listings', requireToken, async (req, res) => {
  const account = reqAccount(req, res);
  if (!account) return;
  const shopId = await resolveShopId(req, account);
  const state = req.query.state || 'active';
  if (!shopId) return res.status(400).json({ error: 'shop_id required (or set ETSY_SHOP_ID / connect the account)' });
  try {
    const r = await getAllListings(shopId, state, account);
    if (!r.ok) return res.status(r.status || 502).json(r.body || { error: 'listings fetch failed' });
    const slim = r.results.map(l => ({
      listing_id: l.listing_id, title: l.title, state: l.state,
      tags: l.tags, price: l.price, num_favorers: l.num_favorers,
    }));
    res.json({ count: slim.length, results: slim });
  } catch (err) {
    res.status(err.message === 'not_connected' ? 401 : 502).json({ error: err.message });
  }
});

// A single listing in full (incl. tags, materials, price, state) — for reading
// an existing listing's SEO before mirroring it onto a new one.
router.get('/listings/:listingId', requireToken, async (req, res) => {
  const account = reqAccount(req, res);
  if (!account) return;
  try {
    const r = await userFetch(`/listings/${req.params.listingId}`, {}, account);
    res.status(r.status).json(r.body);
  } catch (err) {
    res.status(err.message === 'not_connected' ? 401 : 502).json({ error: err.message });
  }
});

// Who am I (and primary shop) — handy first call after connecting.
router.get('/me', async (req, res) => {
  const account = reqAccount(req, res);
  if (!account) return;
  try {
    const me = await getMe(account);
    res.status(me.status).json(me.body);
  } catch (err) {
    res.status(err.message === 'not_connected' ? 401 : 502).json({ error: err.message });
  }
});

// Create a draft listing. Body = the listing fields (see createDraftListing).
router.post('/listings/draft', requireToken, express.json(), async (req, res) => {
  const account = reqAccount(req, res);
  if (!account) return;
  const { shop_id, account: _a, ...listing } = req.body || {};
  const sid = shop_id || await resolveShopId(req, account);
  if (!sid) return res.status(400).json({ error: 'shop_id required' });
  try {
    const r = await createDraftListing(sid, listing, account);
    res.status(r.status).json(r.body);
  } catch (err) {
    const code = err.code === 'VALIDATION' ? 400 : (err.message === 'not_connected' ? 401 : 502);
    res.status(code).json({ error: err.message });
  }
});

// Update fields on an existing listing (PATCH) — title, description, tags, price,
// and personalization toggles. Body: { shop_id, title?, description?, tags?:[],
// is_personalizable?, personalization_is_required?, personalization_instructions?,
// ... }. tags is sent as tags[i]; everything else is passed straight through.
router.patch('/listings/:listingId', requireToken, express.json(), async (req, res) => {
  const account = reqAccount(req, res);
  if (!account) return;
  const { shop_id, tags, account: _a, ...fields } = req.body || {};
  const sid = shop_id || await resolveShopId(req, account);
  if (!sid) return res.status(400).json({ error: 'shop_id required (or set ETSY_SHOP_ID)' });
  try {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined || v === null) continue;
      params.append(k, String(v));
    }
    if (Array.isArray(tags)) validateTags(tags).forEach((t, i) => params.append(`tags[${i}]`, t));
    const r = await userFetch(`/shops/${sid}/listings/${req.params.listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }, account);
    res.status(r.status).json(r.body);
  } catch (err) {
    res.status(err.message === 'not_connected' ? 401 : 502).json({ error: err.message });
  }
});

// Set (or clear) a listing's personalization via Etsy's new personalization
// endpoint (the legacy is_personalizable/... fields were deprecated 2026). Body:
// { shop_id, instructions, required?, max_allowed_characters?, question_text? }.
// Sends a single text-input question; pass instructions:"" to effectively clear.
router.post('/listings/:listingId/personalization', requireToken, express.json(), async (req, res) => {
  const account = reqAccount(req, res);
  if (!account) return;
  const { shop_id, instructions = '', required = false,
          max_allowed_characters = 255, question_text = 'Personalization' } = req.body || {};
  const sid = shop_id || await resolveShopId(req, account);
  if (!sid) return res.status(400).json({ error: 'shop_id required (or set ETSY_SHOP_ID)' });
  const body = {
    personalization_questions: [{
      question_text, instructions, question_type: 'text_input',
      required: Boolean(required), max_allowed_characters,
    }],
  };
  try {
    const r = await userFetch(`/shops/${sid}/listings/${req.params.listingId}/personalization`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, account);
    res.status(r.status).json(r.body);
  } catch (err) {
    res.status(err.message === 'not_connected' ? 401 : 502).json({ error: err.message });
  }
});

// Change a listing's state — e.g. revert a listing that accidentally went live
// back to a draft. Body: { shop_id, listing_id, state? } (state defaults to
// "draft"; falls back to "inactive" if Etsy rejects "draft").
router.post('/listings/state', requireToken, express.json(), async (req, res) => {
  const account = reqAccount(req, res);
  if (!account) return;
  const { shop_id, listing_id, state = 'draft' } = req.body || {};
  const sid = shop_id || await resolveShopId(req, account);
  if (!sid || !listing_id) return res.status(400).json({ error: 'shop_id and listing_id required' });
  try {
    const r = await setListingState(sid, listing_id, state, account);
    res.status(r.status).json(r.note ? { ...r.body, note: r.note } : r.body);
  } catch (err) {
    res.status(err.message === 'not_connected' ? 401 : 502).json({ error: err.message });
  }
});

// Read a listing's inventory/variations.
router.get('/listings/:listingId/inventory', requireToken, async (req, res) => {
  const account = reqAccount(req, res);
  if (!account) return;
  try {
    const r = await getListingInventory(req.params.listingId, account);
    res.status(r.status).json(r.body);
  } catch (err) {
    res.status(err.message === 'not_connected' ? 401 : 502).json({ error: err.message });
  }
});

// Set a listing's variations. Body is either a ready-made Etsy inventory object
// ({ products, price_on_property, ... }) or a convenience ladder:
//   { tiers: [{label,price,quantity?}], property_name?, quantity? }
// The ladder path builds the inventory via buildBundleInventory.
router.put('/listings/:listingId/inventory', requireToken, express.json(), async (req, res) => {
  const account = reqAccount(req, res);
  if (!account) return;
  const { account: _a, ...body } = req.body || {};
  const inventory = Array.isArray(body.tiers)
    ? buildBundleInventory(body.tiers, { propertyName: body.property_name, quantity: body.quantity })
    : body;
  if (!inventory || !Array.isArray(inventory.products) || !inventory.products.length) {
    return res.status(400).json({ error: 'provide { tiers:[...] } or a full inventory { products:[...] }' });
  }
  try {
    const r = await updateListingInventory(req.params.listingId, inventory, account);
    res.status(r.status).json(r.body);
  } catch (err) {
    res.status(err.message === 'not_connected' ? 401 : 502).json({ error: err.message });
  }
});

// List a listing's images (id + url) so photos can be reviewed / copied.
// shop_id from query or ETSY_SHOP_ID.
router.get('/listings/:listingId/images', requireToken, async (req, res) => {
  const account = reqAccount(req, res);
  if (!account) return;
  const shopId = await resolveShopId(req, account);
  if (!shopId) return res.status(400).json({ error: 'shop_id required (or set ETSY_SHOP_ID)' });
  try {
    const r = await getListingImages(shopId, req.params.listingId, account);
    if (!r.ok) return res.status(r.status || 502).json(r.body || { error: 'image fetch failed' });
    res.json({ results: r.results });
  } catch (err) {
    res.status(err.message === 'not_connected' ? 401 : 502).json({ error: err.message });
  }
});

// Add an image onto a listing — by URL (copy another listing's photo) OR by
// raw base64 (upload a brand-new local file that isn't on Etsy yet). Body:
// { shop_id, image_url? , image_base64?, filename?, rank? }.
router.post('/listings/:listingId/images', requireToken, express.json({ limit: '25mb' }), async (req, res) => {
  const account = reqAccount(req, res);
  if (!account) return;
  const { shop_id, image_url, image_base64, filename, rank } = req.body || {};
  const sid = shop_id || await resolveShopId(req, account);
  if (!sid || (!image_url && !image_base64)) {
    return res.status(400).json({ error: 'shop_id and image_url OR image_base64 required' });
  }
  const source = image_base64
    ? Buffer.from(String(image_base64).replace(/^data:[^,]+,/, ''), 'base64')
    : image_url;
  try {
    const r = await uploadListingImage(sid, req.params.listingId, source, { rank, filename, account });
    res.status(r.status).json(r.body);
  } catch (err) {
    res.status(err.message === 'not_connected' ? 401 : 502).json({ error: err.message });
  }
});

// Delete a single image from a listing (the delete half of a reorder). Body/
// query: shop_id. Safe on active listings — removing one photo from a listing
// that has others is non-destructive, unlike deleting the whole listing.
router.delete('/listings/:listingId/images/:imageId', requireToken, async (req, res) => {
  const account = reqAccount(req, res);
  if (!account) return;
  const shopId = await resolveShopId(req, account);
  if (!shopId) return res.status(400).json({ error: 'shop_id required (or set ETSY_SHOP_ID)' });
  try {
    const r = await deleteListingImage(shopId, req.params.listingId, req.params.imageId, account);
    res.status(r.status).json(r.ok ? { deleted: true } : (r.body || { error: 'delete failed' }));
  } catch (err) {
    res.status(err.message === 'not_connected' ? 401 : 502).json({ error: err.message });
  }
});

// Delete a draft/inactive listing (test-draft cleanup). Safety: this route
// REFUSES to delete an "active" (live) listing even when the token gate is
// open, so an accidental or hostile call can never wipe a live money-maker —
// only drafts / inactive listings can be removed here.
router.delete('/listings/:listingId', requireToken, async (req, res) => {
  const account = reqAccount(req, res);
  if (!account) return;
  try {
    const cur = await userFetch(`/listings/${req.params.listingId}`, {}, account);
    const state = cur.ok && cur.body && cur.body.state;
    if (state === 'active') {
      return res.status(409).json({ error: 'refusing to delete an active listing — set it inactive first' });
    }
    const r = await deleteListing(req.params.listingId, account);
    res.status(r.status).json(r.ok ? { deleted: true } : r.body);
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
  keywordResearch,
  keywordOpportunity,
  createDraftListing,
  getListingDefaults,
  updateListing,
  setListingState,
  uploadListingImage,
  getListingInventory,
  updateListingInventory,
  buildBundleInventory,
  getListingImages,
  deleteListing,
  deleteListingImage,
  validateTags,
  buildAuthUrl,
  configured,
  // multi-account
  normAccount,
  shopIdForAccount,
  loadTokens,
  saveTokens,
  listAccounts,
  accountDocPath,
  accountTokenFile,
};
