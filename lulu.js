// lulu.js — Lulu Print API integration for the product pipeline.
//
// Lulu is the "books" POD service: coloring books and printed books
// specifically (3,200+ book configurations — trim sizes, bindings, paper,
// covers). In the product pipeline it's the POD target for coloring books /
// printed books, while Printful/Printify handle apparel and cards.
//
// Note on paper: Lulu's interior stock tops out around ~90 GSM uncoated — fine
// for coloring books (the use case here) but don't expect heavy coated stock.
//
// Auth: OAuth2 *client-credentials* grant. Lulu issues a client key + secret;
//   we exchange them at the token endpoint for a short-lived access token sent
//   as a Bearer header:
//       Authorization: Bearer <access_token>
//   There's no refresh token in this flow — when the cached token expires we
//   just request a new one. Implemented per Lulu's documented API (no live
//   credentials in this environment, so it's untested against the real API).
//
// Base URL is production (https://api.lulu.com) by default; set LULU_SANDBOX to
// target the sandbox, or LULU_API_BASE to override entirely.
//
// Mounted at /api/lulu by server.js. Self-contained, zero hard deps on the rest
// of the app so it can move into a standalone tool later.

const express = require('express');
const fetch = require('node-fetch');

// Production unless LULU_SANDBOX is set; LULU_API_BASE overrides everything.
const SANDBOX = Boolean(process.env.LULU_SANDBOX);
const API = process.env.LULU_API_BASE
  || (SANDBOX ? 'https://api.sandbox.lulu.com' : 'https://api.lulu.com');

// Lulu's token endpoint lives under the "glasstree" Keycloak realm.
const TOKEN_URL = `${API}/auth/realms/glasstree/protocol/openid-connect/token`;

const API_KEY = (process.env.LULU_API_KEY || '').trim();      // client key
const API_SECRET = (process.env.LULU_API_SECRET || '').trim(); // client secret
// Lulu's dashboard also hands out a single pre-encoded base64(key:secret)
// string for the Basic auth header. If LULU_BASE64 is set we use it directly
// (no need to split it back into key + secret); otherwise we encode the pair.
// Strip any stray whitespace/newlines a copy-paste may have injected — base64
// must be contiguous, and a stray line break silently yields "invalid_client".
const API_BASE64 = (process.env.LULU_BASE64 || '').replace(/\s+/g, '');

function configured() {
  return Boolean(API_BASE64 || (API_KEY && API_SECRET));
}

// ─── Token store ────────────────────────────────────────────────────
// Client-credentials gives a short-lived access token (no refresh token), so we
// just cache it in memory with its expiry and re-fetch when it's gone. Single
// process, so an in-memory cache is enough — nothing to persist.
let token = null; // { access_token, expires_at }

// Request a brand-new access token. HTTP Basic auth carries the client
// key/secret as base64(<key>:<secret>); the body is the grant type.
async function getToken() {
  if (!configured()) throw new Error('not_configured');
  // Prefer the pre-encoded LULU_BASE64 if provided; else encode key:secret.
  const basic = API_BASE64 || Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`token_request_failed: ${JSON.stringify(data)}`);
  token = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return token.access_token;
}

// Return a valid access token, fetching a fresh one if we have none or the
// cached one is expired / within 60s of expiry.
async function ensureFreshToken() {
  if (!token || Date.now() >= token.expires_at - 60_000) {
    await getToken();
  }
  return token.access_token;
}

// Core request helper. Ensures a fresh token, adds the Bearer header, and
// returns { status, ok, body } — body parsed as JSON when possible, else raw
// text (same shape as the other POD modules).
async function luluFetch(pathname, opts = {}) {
  const access = await ensureFreshToken();
  const res = await fetch(`${API}${pathname}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${access}`,
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, ok: res.ok, body };
}

// ─── Print jobs ─────────────────────────────────────────────────────
// Quote what a book will cost to print + ship. Lulu's cost-calculation shape
// (line_items with pod_package_id, page_count, shipping_address, etc.) is rich
// and varies by product, so we pass the caller's payload straight through.
async function printJobCostCalculations(payload) {
  return luluFetch('/print-job-cost-calculations/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
}

// Create a print job. Same deal — the caller supplies the full job spec
// (line_items, shipping_address, contact_email, shipping_level, …) and we pass
// it through. New jobs start unpaid/in-validation until payment is captured.
async function createPrintJob(payload) {
  return luluFetch('/print-jobs/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
}

async function getPrintJob(id) {
  return luluFetch(`/print-jobs/${id}/`);
}

async function listPrintJobs() {
  return luluFetch('/print-jobs/');
}

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();

// Connection status for the pipeline UI / Claude Code to inspect. "connected"
// means we could obtain an access token with the configured credentials.
router.get('/status', async (req, res) => {
  if (!configured()) return res.json({ configured: false, connected: false, sandbox: SANDBOX });
  try {
    await getToken();
    res.json({ configured: true, connected: true, sandbox: SANDBOX });
  } catch (err) {
    res.json({ configured: true, connected: false, sandbox: SANDBOX, error: err.message });
  }
});

// Quote a book print cost. Body = Lulu's cost-calculation payload.
router.post('/cost', express.json({ limit: '5mb' }), async (req, res) => {
  try {
    const r = await printJobCostCalculations(req.body || {});
    res.status(r.status).json(r.body);
  } catch (err) {
    res.status(err.message === 'not_configured' ? 500 : 502).json({ error: err.message });
  }
});

// Create a print job. Body = Lulu's print-job payload.
router.post('/print-jobs', express.json({ limit: '5mb' }), async (req, res) => {
  try {
    const r = await createPrintJob(req.body || {});
    res.status(r.status).json(r.body);
  } catch (err) {
    res.status(err.message === 'not_configured' ? 500 : 502).json({ error: err.message });
  }
});

router.get('/print-jobs/:id', async (req, res) => {
  try {
    const r = await getPrintJob(req.params.id);
    res.status(r.status).json(r.body);
  } catch (err) {
    res.status(err.message === 'not_configured' ? 500 : 502).json({ error: err.message });
  }
});

module.exports = {
  router,
  configured,
  getToken,
  printJobCostCalculations,
  createPrintJob,
  getPrintJob,
  listPrintJobs,
};
