# Google Ads API setup — progress notes

Goal: get a Google Ads API developer token + OAuth refresh token so a chat can
pull real keyword search-volume data (and whatever else needs Ads API access)
without Sophie in the loop each time. This is a background task with a slow
step (Google's developer-token review) — pick up wherever it left off.

> **SECURITY:** this repo is PUBLIC. NO secret values live in this file — the
> developer token, client ID, client secret, and refresh token are shared
> privately (in-chat / Render env vars) and never committed here.

## Status as of 2026-08-25 (checked live — STILL NOT GRANTED)

Same measurement as 2026-08-07, re-run from a chat, and it has not moved:

- `GET /api/googleads/status` → `allPresent: true`, OAuth valid.
- `POST /api/googleads/keyword-ideas {"keywords":["tarot deck for beginners"]}`
  → `"The caller does not have permission"` — PERMISSION_DENIED, i.e. the
  developer token is **still on Test access**.

**That is now ~4.5 weeks since the 2026-07-24 application**, past the "weeks"
queue this doc has been assuming. A pending application and a **rejected or
info-requested** one look identical from here — the API answers PERMISSION_DENIED
either way — so the API cannot tell us which. The two places that can, both
Sophie's:

- **API Center** — https://ads.google.com/aw/apicenter (sign in as the "Sage
  Ryza" manager account, `237-218-0462`): the access level is printed there, and
  a rejected application shows its reason.
- **The email on that manager account.** Google replies to the application by
  email, often asking follow-up questions about the tool's use case; an
  unanswered question stalls the application indefinitely.

Nothing in the code needs changing either way — the keyword endpoints go live by
themselves the moment the token flips to Basic.

## Status as of 2026-08-07 (checked live)

- **All five env vars ARE set in Render** — `GET /api/googleads/status` returns
  `allPresent: true` and the OAuth layer validates: *"refresh token exchanged
  for an access token — OAuth credentials are valid"*. So step 2 below is DONE.
- **Basic access is STILL NOT granted.** A real call proves it, not the status
  endpoint (which only checks OAuth):
  `POST /api/googleads/keyword-ideas {"keywords":["tarot deck for beginners"]}`
  → `"The caller does not have permission"` (PERMISSION_DENIED = developer token
  still on Test access). Applied 2026-07-24, so this is ~2 weeks in Google's
  queue. Nothing to do but wait — the keyword endpoints go live by themselves
  the moment it clears.
- **Consequence for Blog Studio:** `blog.js` already calls
  `googleads.generateHistoricalMetrics()` to attach REAL monthly search volume
  to each proposed keyword, and silently falls back when it 403s. So keyword
  research is currently running on the model's *estimated* difficulty
  (`volumeSource: "estimated"`), not real demand data. That's the honest
  caveat until approval lands.
- Step 1 (rotate the briefly-exposed client secret) is still open.

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
