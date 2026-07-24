// googleads.js — Google Ads API credential health check (mounted at
// /api/googleads). Read-only. Exists so a chat can confirm the five Ads env
// vars are set on the server AND that the OAuth credentials actually work,
// without ever exposing the values.
//
// Env vars (Render dashboard, sync:false):
//   GOOGLE_ADS_DEVELOPER_TOKEN   22-char token from the Ads API Center
//   GOOGLE_ADS_CLIENT_ID         Web-application OAuth client id
//   GOOGLE_ADS_CLIENT_SECRET     …its secret
//   GOOGLE_ADS_REFRESH_TOKEN     the 1// refresh token (OAuth Playground)
//   GOOGLE_ADS_CUSTOMER_ID       10-digit customer id, no dashes
//
// The actual keyword-data / reporting features are NOT built yet — this is
// just the wiring check. `GET /status` is open (returns booleans only).

const express = require('express');
const fetch = require('node-fetch');

const router = express.Router();

function present() {
  return {
    developerToken: Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN),
    clientId: Boolean(process.env.GOOGLE_ADS_CLIENT_ID),
    clientSecret: Boolean(process.env.GOOGLE_ADS_CLIENT_SECRET),
    refreshToken: Boolean(process.env.GOOGLE_ADS_REFRESH_TOKEN),
    customerId: Boolean(process.env.GOOGLE_ADS_CUSTOMER_ID),
  };
}

// Exchange the refresh token for an access token. This validates the client
// id/secret/refresh-token trio without needing Basic access approval — it's
// pure OAuth, not an Ads API call. Never returns the token itself.
async function refreshCheck() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    return { ok: false, detail: 'missing client id, secret, or refresh token' };
  }
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
      timeout: 15000,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.access_token) {
      return { ok: true, detail: 'refresh token exchanged for an access token — OAuth credentials are valid' };
    }
    // Surface Google's error name (e.g. invalid_client / invalid_grant) but no secrets.
    return { ok: false, detail: `token refresh failed: ${data.error || `HTTP ${res.status}`}${data.error_description ? ` (${data.error_description})` : ''}` };
  } catch (err) {
    return { ok: false, detail: `token refresh request errored: ${err.message}` };
  }
}

router.get('/status', async (req, res) => {
  const p = present();
  const allPresent = Object.values(p).every(Boolean);
  const out = { present: p, allPresent };
  // Only bother with the live OAuth check when the three OAuth creds exist.
  if (p.clientId && p.clientSecret && p.refreshToken) {
    out.credentialCheck = await refreshCheck();
  } else {
    out.credentialCheck = { ok: false, detail: 'skipped — OAuth creds not all present' };
  }
  out.note = 'Wiring check only — the Ads keyword/reporting features are not built yet. Basic-access approval is still needed before live Ads API data calls succeed.';
  res.json(out);
});

module.exports = { router };
