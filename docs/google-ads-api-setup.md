# Google Ads API setup — progress notes

Goal: get a Google Ads API developer token + OAuth refresh token so a chat can
pull real keyword search-volume data (and whatever else needs Ads API access)
without Sophie in the loop each time. This is a background task with a slow
step (Google's developer-token review) — pick up wherever it left off.

## Status as of 2026-07-20

### ✅ Done
- Free Ads **manager account** created — "Sage Ryza", customer id `237-218-0462`.
- **Developer token** generated: `EOuxKgdNlCx7qZQDYhN6ug`
- **OAuth Client ID** (Web application type, redirect URI = OAuth Playground):
  `258267834361-5d5ml1u3mub3mb-bieil46s3lc758opa4.apps.googleusercontent.com`
- **OAuth Client secret**: `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`
- Applied for **Basic access** on the developer token (review pending — Google's
  queue is currently weeks-long as of July 2026; nothing to do but wait).

### ⬜ Still to do (needs a computer — OAuth Playground doesn't work well on phone)

**1. Get the refresh token** (~5 min)
- Open → [OAuth Playground](https://developers.google.com/oauthplayground)
- Tap the **⚙ gear** (top right) → check **"Use your own OAuth credentials"**
- Paste in:
  - Client ID: `258267834361-5d5ml1u3mub3mb-bieil46s3lc758opa4.apps.googleusercontent.com`
  - Client secret: `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`
- In the left scope box, paste:
  ```
  https://www.googleapis.com/auth/adwords
  ```
- Click **Authorize APIs** → sign in with the Ads account's Google login → approve
- Click **Exchange authorization code for tokens** → copy the **refresh_token**
  it shows on the right

**2. Grab the customer ID**
- Open → [ads.google.com](https://ads.google.com) → the 10-digit number at the
  top of the page (currently showing as `237-218-0462` under "Sage Ryza")

**3. Set the five values in Render** (imageforge service → Environment tab)
```
GOOGLE_ADS_DEVELOPER_TOKEN=EOuxKgdNlCx7qZQDYhN6ug
GOOGLE_ADS_CLIENT_ID=258267834361-5d5ml1u3mub3mb-bieil46s3lc758opa4.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=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
GOOGLE_ADS_REFRESH_TOKEN=<paste from step 1>
GOOGLE_ADS_CUSTOMER_ID=2372180462
```
(Render dashboard → the imageforge web service → **Environment** → **Add
Environment Variable**, one per line above, `sync:false` like the other keys.)

**4. Wait for Basic access approval**
- Google reviews the developer-token application before the API will return
  real (non-test-account) data. No action needed — just don't be surprised if
  early API calls 403 with a scope/access error until this clears.

## Notes
- The Client ID/secret above are a **separate, new Web-application OAuth
  client** — intentionally different from the existing Desktop-app client
  used for YouTube auto-upload (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in
  Render already). Desktop-app clients can't use a custom redirect URI, so
  they can't go through OAuth Playground — this is why a second client was
  needed, not a duplicate/mistake.
- Only the specific chat/feature that calls the Ads API needs to reference
  these five env var **names** in its code — no other chat needs the raw
  values once they're in Render.
- Until this is fully wired up, **Keyword Planner in the Ads UI** is the
  working fallback for real search-volume numbers: paste a phrase list into
  *Get search volume and forecasts*, export the CSV, send it over.
