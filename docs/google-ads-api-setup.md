# Google Ads API setup — progress notes

Goal: get a Google Ads API developer token + OAuth refresh token so a chat can
pull real keyword search-volume data (and whatever else needs Ads API access)
without Sophie in the loop each time. This is a background task with a slow
step (Google's developer-token review) — pick up wherever it left off.

> **SECURITY:** this repo is PUBLIC. NO secret values live in this file — the
> developer token, client ID, client secret, and refresh token are shared
> privately (in-chat / Render env vars) and never committed here.

## Status as of 2026-07-24

### ✅ Done
- Free Ads **manager account** created — "Sage Ryza", customer id `237-218-0462`.
- **Developer token** generated (value stored privately, not in this repo).
- **OAuth Client** created — type **Web application**, with
  `https://developers.google.com/oauthplayground` added as an Authorized
  redirect URI. (Client ID + secret stored privately.)
- **Refresh token** minted via OAuth Playground (using own credentials, so it's
  permanent). Stored privately.
- Applied for **Basic access** on the developer token (review pending — Google's
  queue is currently weeks-long as of July 2026; nothing to do but wait).

### ⬜ Still to do

**1. Rotate the secrets that were briefly exposed** *(see incident note below)*
- Regenerate the OAuth **client secret** in
  [Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
  (open the Web-app client → **Reset secret**). The existing refresh token keeps
  working with the new secret (refresh tokens are tied to the client ID, not the
  secret).
- Consider whether the developer token needs regenerating (harder — it's tied to
  the manager account; low risk on its own since it can't access an account
  without OAuth creds + a user grant).

**2. Set the five values in Render** (imageforge service → Environment tab)
```
GOOGLE_ADS_DEVELOPER_TOKEN=<your developer token>
GOOGLE_ADS_CLIENT_ID=<your web-app client id>
GOOGLE_ADS_CLIENT_SECRET=<your NEW client secret after rotation>
GOOGLE_ADS_REFRESH_TOKEN=<the 1// refresh token from OAuth Playground>
GOOGLE_ADS_CUSTOMER_ID=<10-digit id from top of ads.google.com, no dashes>
```
(Render dashboard → the imageforge web service → **Environment** → **Add
Environment Variable**, one per line above, `sync:false` like the other keys.)

**3. Wait for Basic access approval**
- Google reviews the developer-token application before the API will return
  real (non-test-account) data. No action needed — just don't be surprised if
  early API calls 403 with a scope/access error until this clears.

## How to get the refresh token again (if ever needed)
- Open → [OAuth Playground](https://developers.google.com/oauthplayground)
- ⚙ gear (top right) → check **"Use your own OAuth credentials"** → paste the
  Web-app Client ID + secret
- Left scope box, paste: `https://www.googleapis.com/auth/adwords`
  (yes, it says "adwords" — that's the correct legacy scope name for Google Ads)
- **Authorize APIs** → sign in / approve → **Exchange authorization code for
  tokens** → copy the **refresh_token** (starts with `1//`)

## ⚠️ Incident note (2026-07-24)
An earlier version of this doc mistakenly committed the raw developer token,
client ID, and client secret to this PUBLIC repo (they were removed in a
follow-up commit, but remain in git history). Those three values should be
treated as exposed — **rotate the client secret** (step 1). The refresh token
was never committed. Lesson: never write live credentials into a committed file;
they belong in Render env vars only.

## Notes
- The Client ID/secret are a **separate, new Web-application OAuth client** —
  intentionally different from the existing Desktop-app client used for YouTube
  auto-upload (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in Render already).
  Desktop-app clients can't use a custom redirect URI, so they can't go through
  OAuth Playground — this is why a second client was needed, not a duplicate.
- Only the specific chat/feature that calls the Ads API needs to reference these
  five env var **names** in its code — no other chat needs the raw values once
  they're in Render.
- Until this is fully wired up, **Keyword Planner in the Ads UI** is the working
  fallback for real search-volume numbers: paste a phrase list into *Get search
  volume and forecasts*, export the CSV, send it over.
