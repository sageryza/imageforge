// googleads.js — Google Ads API client (mounted at /api/googleads).
//
// Purpose: real keyword search-volume data (Keyword Planner via the API) so the
// blog / keyword tooling can rank topics by ACTUAL demand instead of the
// AI-estimated difficulty used until now. Read-only against the Ads account.
//
// Env vars (Render dashboard, sync:false):
//   GOOGLE_ADS_DEVELOPER_TOKEN     22-char token from the Ads API Center
//   GOOGLE_ADS_CLIENT_ID           Web-application OAuth client id
//   GOOGLE_ADS_CLIENT_SECRET       …its secret
//   GOOGLE_ADS_REFRESH_TOKEN       the 1// refresh token (OAuth Playground)
//   GOOGLE_ADS_CUSTOMER_ID         10-digit customer id, no dashes (query target)
//   GOOGLE_ADS_LOGIN_CUSTOMER_ID   optional — manager account id (login-customer-id
//                                  header); defaults to GOOGLE_ADS_CUSTOMER_ID
//   GOOGLE_ADS_API_VERSION         optional — e.g. "v23"; bump to whatever's
//                                  current when we test live (default below)
//
// STATUS: the real keyword calls require the developer token to have **Basic
// access** (Test access only reaches test accounts and returns PERMISSION_DENIED
// against a real customer). Everything is built and validated up to the OAuth
// layer; the keyword calls go live automatically the moment Basic access is
// approved — no code change, just the env token flipping to Basic on Google's side.

const express = require('express');
const fetch = require('node-fetch');

const router = express.Router();

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || 'v23';
const US_GEO = 'geoTargetConstants/2840';      // United States
const EN_LANG = 'languageConstants/1000';      // English

function digits(s) { return String(s || '').replace(/[^0-9]/g, ''); }

function present() {
  return {
    developerToken: Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN),
    clientId: Boolean(process.env.GOOGLE_ADS_CLIENT_ID),
    clientSecret: Boolean(process.env.GOOGLE_ADS_CLIENT_SECRET),
    refreshToken: Boolean(process.env.GOOGLE_ADS_REFRESH_TOKEN),
    customerId: Boolean(process.env.GOOGLE_ADS_CUSTOMER_ID),
  };
}
function configured() {
  const p = present();
  return p.developerToken && p.clientId && p.clientSecret && p.refreshToken && p.customerId;
}

// ─── OAuth access token (cached ~55 min) ────────────────────────────────
let tokenCache = null; // { token, expiresAt }

async function getAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.token;
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new Error('missing OAuth credentials');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: 'refresh_token',
    }).toString(),
    timeout: 15000,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`token refresh failed: ${data.error || `HTTP ${res.status}`}`);
  }
  const ttl = (Number(data.expires_in) || 3600) * 1000;
  tokenCache = { token: data.access_token, expiresAt: Date.now() + ttl };
  return tokenCache.token;
}

// POST to the Ads API against the configured customer, with all required headers.
async function adsPost(method, body) {
  if (!configured()) throw new Error('Google Ads not configured — missing env vars');
  const customerId = digits(process.env.GOOGLE_ADS_CUSTOMER_ID);
  const loginCustomerId = digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || process.env.GOOGLE_ADS_CUSTOMER_ID);
  const token = await getAccessToken();
  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}:${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      'login-customer-id': loginCustomerId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    timeout: 30000,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Ads API errors come back as { error: { message, details:[...] } }.
    const msg = data.error?.message || data[0]?.error?.message || `HTTP ${res.status}`;
    const err = new Error(`Google Ads API ${method} failed: ${msg}`);
    err.status = res.status;
    err.raw = data;
    throw err;
  }
  return data;
}

const COMP = { UNSPECIFIED: null, UNKNOWN: null, LOW: 'low', MEDIUM: 'medium', HIGH: 'high' };
function micros(v) { return v == null ? null : Math.round((Number(v) / 1e6) * 100) / 100; }

function shapeMetrics(m) {
  if (!m) return { avgMonthlySearches: null, competition: null, competitionIndex: null };
  return {
    avgMonthlySearches: m.avgMonthlySearches != null ? Number(m.avgMonthlySearches) : null,
    competition: COMP[m.competition] ?? null,
    competitionIndex: m.competitionIndex != null ? Number(m.competitionIndex) : null,
    lowTopOfPageBid: micros(m.lowTopOfPageBidMicros),
    highTopOfPageBid: micros(m.highTopOfPageBidMicros),
  };
}

// Discover NEW related keywords from seed phrases (and/or a page URL), each with
// real monthly search volume + competition. Great for finding blog topics.
async function generateKeywordIdeas({ keywords = [], pageUrl, max = 60, geo, language } = {}) {
  const body = {
    keywordPlanNetwork: 'GOOGLE_SEARCH',
    geoTargetConstants: [geo || US_GEO],
    language: language || EN_LANG,
    includeAdultKeywords: false,
    pageSize: Math.min(1000, Math.max(1, max)),
  };
  const kws = keywords.filter(Boolean).slice(0, 20);
  if (kws.length && pageUrl) body.keywordAndUrlSeed = { url: pageUrl, keywords: kws };
  else if (kws.length) body.keywordSeed = { keywords: kws };
  else if (pageUrl) body.urlSeed = { url: pageUrl };
  else throw new Error('provide keywords and/or a pageUrl');

  const data = await adsPost('generateKeywordIdeas', body);
  const results = (data.results || []).map((r) => ({ text: r.text, ...shapeMetrics(r.keywordIdeaMetrics) }));
  results.sort((a, b) => (b.avgMonthlySearches || 0) - (a.avgMonthlySearches || 0));
  return results.slice(0, max);
}

// Historical volume/competition for an EXACT list of phrases you already have
// (e.g. rank our existing blog-topic list by real demand).
async function generateHistoricalMetrics({ keywords = [], geo, language } = {}) {
  const kws = keywords.filter(Boolean).slice(0, 10000);
  if (!kws.length) throw new Error('provide a keywords array');
  const data = await adsPost('generateKeywordHistoricalMetrics', {
    keywords: kws,
    keywordPlanNetwork: 'GOOGLE_SEARCH',
    geoTargetConstants: [geo || US_GEO],
    language: language || EN_LANG,
  });
  return (data.results || []).map((r) => ({
    text: r.text,
    closeVariants: r.closeVariants || [],
    ...shapeMetrics(r.keywordMetrics),
  }));
}

// ─── routes ─────────────────────────────────────────────────────────────
async function refreshCheck() {
  try { await getAccessToken(); return { ok: true, detail: 'refresh token exchanged for an access token — OAuth credentials are valid' }; }
  catch (e) { return { ok: false, detail: e.message }; }
}

router.get('/status', async (req, res) => {
  const p = present();
  const out = { present: p, allPresent: Object.values(p).every(Boolean), apiVersion: API_VERSION };
  out.credentialCheck = (p.clientId && p.clientSecret && p.refreshToken)
    ? await refreshCheck()
    : { ok: false, detail: 'skipped — OAuth creds not all present' };
  out.note = 'Keyword calls need the developer token to have Basic access (Test access 403s against a real account). OAuth layer is validated; the keyword endpoints go live automatically once Basic access is granted.';
  res.json(out);
});

// POST { keywords?: [..], pageUrl?, max? } → discovered keyword ideas + volumes
router.post('/keyword-ideas', express.json({ limit: '256kb' }), async (req, res) => {
  try {
    const { keywords, pageUrl, max } = req.body || {};
    res.json({ ideas: await generateKeywordIdeas({ keywords, pageUrl, max }) });
  } catch (err) {
    res.status(err.status === 403 ? 403 : 502).json({ error: err.message, hint: err.status === 403 ? 'likely PERMISSION_DENIED — developer token still on Test access; waiting on Basic-access approval' : undefined });
  }
});

// POST { keywords: [..] } → real historical volume for those exact phrases
router.post('/keyword-metrics', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const { keywords } = req.body || {};
    res.json({ metrics: await generateHistoricalMetrics({ keywords }) });
  } catch (err) {
    res.status(err.status === 403 ? 403 : 502).json({ error: err.message, hint: err.status === 403 ? 'likely PERMISSION_DENIED — developer token still on Test access; waiting on Basic-access approval' : undefined });
  }
});

module.exports = { router, configured, generateKeywordIdeas, generateHistoricalMetrics };
