// gdrive.js — Google Drive OAuth 2.0 integration (mounted at /api/gdrive).
//
// Authorizes the app ONCE against the owner's personal Google Drive so it can
// read, move, rename, and trash files on their behalf — the plumbing behind a
// "clean up my Drive" script. Uses the OAuth 2.0 authorization-code flow with a
// durable refresh token (access_type=offline + prompt=consent), the same shape
// as etsy.js: the refresh token is persisted to Firestore so a one-time
// /connect authorization survives Render redeploys / cold restarts, falling
// back to a gitignored JSON file for local dev.
//
// Scope is the FULL Drive scope (drive) so files can be moved between folders,
// renamed, and trashed. Reads use raw REST against the Drive v3 API (no
// googleapis dependency), mirroring the other pipeline modules.
//
// Env vars (Render dashboard or the Firestore config doc, sync:false):
//   GOOGLE_DRIVE_CLIENT_ID       OAuth client id (falls back to GOOGLE_CLIENT_ID)
//   GOOGLE_DRIVE_CLIENT_SECRET   OAuth client secret (falls back to GOOGLE_CLIENT_SECRET)
//   GOOGLE_DRIVE_REDIRECT_URI    optional; defaults to <RENDER_EXTERNAL_URL>/api/gdrive/callback
//
// The refresh token is written to Firestore doc `config/gdrive-tokens`
// (override via GDRIVE_TOKENS_DOC). Everything except /connect, /callback and
// /status is STUDIO_TOKEN-gated.

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

const OAUTH_AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_TOKEN = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';

// Full read/write/move/rename/trash access to the user's Drive.
const SCOPES = ['https://www.googleapis.com/auth/drive'];

// Drive-specific client credentials, falling back to the generic Google OAuth
// client already used for the YouTube uploader if the drive-specific ones are
// unset. (A client authorized for both scopes can serve both.)
const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';

const STUDIO_TOKEN = process.env.STUDIO_TOKEN || '';
function requireToken(req, res, next) {
  if (!STUDIO_TOKEN || req.get('x-studio-token') === STUDIO_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

// Where Google redirects after consent. Must EXACTLY match an authorized
// redirect URI registered on the OAuth client. Defaults to the Render external
// URL when present, else localhost for dev.
function redirectUri() {
  if (process.env.GOOGLE_DRIVE_REDIRECT_URI) return process.env.GOOGLE_DRIVE_REDIRECT_URI;
  const base = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL || 'http://localhost:3001';
  return `${base.replace(/\/$/, '')}/api/gdrive/callback`;
}

function configured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

// ─── Token store ────────────────────────────────────────────────────
// Persist to Firestore when Firebase is up (survives Render restarts), else a
// gitignored local JSON file. An in-memory copy is cached for the process.
const TOKEN_FILE = process.env.GDRIVE_TOKEN_FILE || path.join(__dirname, '.gdrive-tokens.json');
const TOKENS_DOC = process.env.GDRIVE_TOKENS_DOC || 'config/gdrive-tokens';
let tokens = null; // { refresh_token, access_token, expires_at, scopes }

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
      console.warn('gdrive: Firestore token read failed —', err.message);
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
      console.warn('gdrive: Firestore token write failed, falling back to file —', err.message);
    }
  }
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2));
  } catch (err) {
    console.warn('gdrive: could not persist tokens:', err.message);
  }
}

// In-flight OAuth attempts: state values awaiting a callback. Short-lived CSRF
// nonces; single-process.
const pendingStates = new Set();

// ─── OAuth 2.0 (authorization code) ─────────────────────────────────
// Build the consent URL. access_type=offline + prompt=consent forces Google to
// return a refresh token every time (without prompt=consent Google omits it on
// re-authorization once the user has already granted access).
function buildAuthUrl() {
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.add(state);
  setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000).unref?.();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${OAUTH_AUTHORIZE}?${params.toString()}`;
}

// Exchange the authorization code (from the callback) for tokens.
async function exchangeCode(code, state) {
  if (!pendingStates.has(state)) throw new Error('unknown_or_expired_state');
  pendingStates.delete(state);
  const res = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectUri(),
      code,
    }).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`token_exchange_failed: ${JSON.stringify(data)}`);
  await persist(data);
  return tokens;
}

// Persist a token response. Keeps the existing refresh_token if Google omits one
// (it only returns a fresh refresh token on the first consent / with prompt).
async function persist(data) {
  await saveTokens({
    refresh_token: data.refresh_token || (tokens && tokens.refresh_token) || null,
    access_token: data.access_token || null,
    expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    scopes: SCOPES,
  });
}

// Get a valid access token, refreshing via the stored refresh token when the
// cached one is missing or within 60s of expiry. Throws if not connected.
async function accessToken() {
  const t = await loadTokens();
  if (!t || !t.refresh_token) throw new Error('not_connected');
  if (t.access_token && Date.now() < t.expires_at - 60_000) return t.access_token;
  const res = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: t.refresh_token,
    }).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`token_refresh_failed: ${JSON.stringify(data)}`);
  await persist(data);
  return tokens.access_token;
}

// ─── Drive REST helper ──────────────────────────────────────────────
// A user-level Drive call — adds the Bearer access token (refreshing first).
async function driveFetch(pathname, opts = {}) {
  const token = await accessToken();
  const res = await fetch(`${DRIVE_API}${pathname}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, ok: res.ok, body };
}

// Update a single file. `query` carries the addParents/removeParents params
// (move) while `fields` is the JSON metadata patch (name, trashed, …). Drive's
// files.update is a PATCH. supportsAllDrives=true so shared-drive files work too.
async function updateFile(id, { fields = {}, query = {} } = {}) {
  const params = new URLSearchParams({ supportsAllDrives: 'true', fields: 'id,name,parents,trashed' });
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    params.set(k, String(v));
  }
  return driveFetch(`/files/${encodeURIComponent(id)}?${params.toString()}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
}

// Normalize an addParents/removeParents value (array or comma string) → CSV.
function toCsv(v) {
  if (v == null) return undefined;
  if (Array.isArray(v)) return v.filter(Boolean).join(',') || undefined;
  const s = String(v).trim();
  return s || undefined;
}

// Move one file: change its parent folders. addParents/removeParents accept an
// id, an array of ids, or a comma-separated string.
async function moveFile({ id, addParents, removeParents } = {}) {
  if (!id) throw new Error('id required');
  return updateFile(id, {
    query: { addParents: toCsv(addParents), removeParents: toCsv(removeParents) },
  });
}

// Rename one file.
async function renameFile({ id, name } = {}) {
  if (!id) throw new Error('id required');
  if (!name) throw new Error('name required');
  return updateFile(id, { fields: { name: String(name) } });
}

// Trash one file (recoverable — NOT a permanent delete).
async function trashFile(id) {
  if (!id) throw new Error('id required');
  return updateFile(id, { fields: { trashed: true } });
}

// The signed-in user + storage quota — proves the token works and finally lets
// the app read real Drive storage usage.
async function about() {
  return driveFetch('/about?fields=user,storageQuota');
}

// ─── Router ─────────────────────────────────────────────────────────
const router = express.Router();

// Connection status for the UI / Claude Code to inspect. Open (no gate).
router.get('/status', async (req, res) => {
  const t = await loadTokens();
  res.json({
    configured: configured(),
    redirect_uri: redirectUri(),
    scopes: SCOPES,
    connected: Boolean(t && t.refresh_token),
    access_expires_at: t ? t.expires_at : null,
  });
});

// Kick off OAuth — redirect the browser to Google's consent screen.
router.get('/connect', (req, res) => {
  if (!configured()) return res.status(500).send('Google Drive not configured (missing client id/secret).');
  res.redirect(buildAuthUrl());
});

// OAuth redirect target. Google sends ?code & ?state (or ?error).
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(htmlPage('Google Drive authorization failed', String(error)));
  if (!code || !state) return res.status(400).send(htmlPage('Google Drive authorization failed', 'Missing code or state.'));
  try {
    await exchangeCode(String(code), String(state));
    res.send(htmlPage('Google Drive connected ✓', 'You can close this tab and return to the studio.'));
  } catch (err) {
    res.status(400).send(htmlPage('Google Drive authorization failed', err.message));
  }
});

// Signed-in user + storage quota — first call to run after connecting.
router.get('/me', requireToken, async (req, res) => {
  try {
    const r = await about();
    res.status(r.status).json(r.body);
  } catch (err) {
    res.status(err.message === 'not_connected' ? 401 : 502).json({ error: err.message });
  }
});

// Move files. Body: { items: [{ id, addParents?, removeParents? }] }.
// Returns a per-item ok/error summary.
router.post('/move', requireToken, express.json({ limit: '2mb' }), async (req, res) => {
  const items = Array.isArray(req.body && req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: 'items: [{ id, addParents?, removeParents? }] required' });
  try {
    const results = [];
    for (const item of items) {
      try {
        const r = await moveFile(item || {});
        results.push({ id: item && item.id, ok: r.ok, status: r.status, ...(r.ok ? { file: r.body } : { error: r.body }) });
      } catch (err) {
        results.push({ id: item && item.id, ok: false, error: err.message });
      }
    }
    res.json({ results });
  } catch (err) {
    res.status(err.message === 'not_connected' ? 401 : 502).json({ error: err.message });
  }
});

// Rename files. Body: { items: [{ id, name }] }.
router.post('/rename', requireToken, express.json({ limit: '2mb' }), async (req, res) => {
  const items = Array.isArray(req.body && req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: 'items: [{ id, name }] required' });
  try {
    const results = [];
    for (const item of items) {
      try {
        const r = await renameFile(item || {});
        results.push({ id: item && item.id, ok: r.ok, status: r.status, ...(r.ok ? { file: r.body } : { error: r.body }) });
      } catch (err) {
        results.push({ id: item && item.id, ok: false, error: err.message });
      }
    }
    res.json({ results });
  } catch (err) {
    res.status(err.message === 'not_connected' ? 401 : 502).json({ error: err.message });
  }
});

// Trash files (recoverable). Body: { ids: [...] }.
router.post('/trash', requireToken, express.json({ limit: '2mb' }), async (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ error: 'ids: [...] required' });
  try {
    const results = [];
    for (const id of ids) {
      try {
        const r = await trashFile(id);
        results.push({ id, ok: r.ok, status: r.status, ...(r.ok ? {} : { error: r.body }) });
      } catch (err) {
        results.push({ id, ok: false, error: err.message });
      }
    }
    res.json({ results });
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
  // exported for direct/programmatic use (e.g. the gdrive-move.js CLI)
  configured,
  accessToken,
  driveFetch,
  about,
  moveFile,
  renameFile,
  trashFile,
  buildAuthUrl,
};
