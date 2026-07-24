# Secretly a Witch — to-do / backlog

A living list of changes for the Secretly a Witch app (web `/witch` + the iOS
shell). Newest ideas at the top; check things off as they ship.

## Open

### Paywall / subscription across the app ("get a taste, then pay")
The membership model: free users get a *taste* of each generative feature, the
rest is paywalled. Examples: Dream = 1 illustrated page free, rest blurred;
Coincidence = 1 free draw + limited redraws/day. Applies in "all sorts of
places" — treat as ONE membership that unlocks everything (confirm with Sophie).
- **Hard constraint — Apple In-App Purchase.** On iOS, unlocking digital
  features/subscriptions must go through Apple's IAP (StoreKit), Apple takes
  15–30%. Because Secretly a Witch is a WKWebView wrapper, this is the one place
  that likely needs real *native* code (StoreKit purchase in the shell →
  entitlement bridged into the web view) + subscription products configured in
  App Store Connect (which requires the Paid Apps agreement + banking/tax info
  signed first). A 2025 US ruling now lets apps link out to external web
  payment — could allow selling via Stripe on web and skipping Apple's cut —
  but that area is changing fast; **research current App Store rules before
  committing to an approach** (see the "research current dashboards" design rule).
- **Needed from Sophie:** the model (one membership vs per-feature), price +
  billing period (monthly/annual/trial), the full free-vs-paid list per feature,
  App Store Connect Paid-Apps agreement signed, and (if web path) a Stripe acct.
- **Sequence:** build the paywall UI + entitlement scaffolding first (with a
  test/"coming soon" entitlement) so the visible paywall ships now; wire real
  payment once the agreements + products exist.
- **PAYMENT = WEB / STRIPE (decided 2026-07).** Sell the subscription on the
  Secretly a Witch *website* via Stripe (like Claude/Spotify) → sign into the
  app → it unlocks. No Apple IAP, no Apple cut, no native StoreKit. Tradeoff:
  **paid features require being signed in** (that's how the app knows you
  subscribed); the free taste stays signed-out. The in-app "link out to
  subscribe" is US-only / legally shifting — verify current rules before relying
  on it; worst case people subscribe on the site and the app just unlocks. No
  Stripe integration/keys exist in the app yet — Sophie has a Stripe account
  from another project; key gets pasted in at build time.
- **Pricing (Sophie, 2026-07):** **$4/month** to start (may rise depending on
  real per-feature model costs), **monthly only — no annual** (feels deceptive),
  **free trial OK** if it's the standard card-up-front auto-converting kind.
- **Free vs paid map (draft — confirm/expand with Sophie):** ONE membership
  unlocks all of it.
  - **Dream illustration** — 1 illustrated page free, rest paywalled (blurred).
  - **Suspicious Coincidence** — 1 draw/day + 1 redraw/day free; more redraws paid.
  - **Birth chart** — your OWN chart free; charts for friends / other people paid
    (Costar model).
  - **Make-your-own-tarot-deck** (new feature, not built) — major arcana free;
    the full deck (incl. minor arcana) paid.

### Blurred paywalled pages should look DIFFERENT (not the same page repeated)
Right now the blurred/locked pages behind a paywall (e.g. Dream's un-purchased
pages) are literally the SAME page duplicated with a blur, so they all look
identical. They should look like *distinct* pages even though the real ones
don't exist yet — vary the blurred placeholders (different faint layouts /
compositions) so it reads as "there's more real content here," not one page
copied. Applies wherever the taste-then-blur pattern is used.

### Etsy → Shopify product transfer (replace the "Shuttle" app)
Let a chat (or a button in the app) add Etsy listings that aren't yet on Shopify
**into** Shopify automatically — taking over the job Sophie currently does with
the Shuttle app. Right now the app shop mirrors Etsy but can only *show*
products that already exist on Shopify.

- **Blocker — one permission:** the app's Shopify connection is content-only
  (`read_customers, read_content, write_content`). Creating products needs
  **`write_products`** (+ `read_products`). Etsy read access already exists
  (`listings_r`), so that's the only missing piece.
- **Steps:**
  1. **Widen the Shopify scope.** In the Shopify **Dev Dashboard** app
     (dev.shopify.com), create a **new version**, add `write_products` +
     `read_products` to the **required** scopes (not "optional"), and **Release**.
     *(Re-verify the Dev Dashboard UI before doing this — it changes; see the
     Shopify section in the main CLAUDE.md.)*
  2. **Re-authorize.** Visit `/api/shopify/connect` and approve, so a new
     offline token with the product scopes is minted + stored in Firestore.
  3. **Build the transfer endpoint.** Server-side: given an Etsy listing (or all
     currently-unmatched listings), pull its images / title / description /
     price / tags via the Etsy API and create a matching Shopify product
     (Admin API product create + image upload).
  4. **Review before live.** Create the Shopify product as a **draft** so Sophie
     approves it before it publishes (matches how Etsy drafts are reviewed).
  5. **Trigger.** A button in the app's shop (or a chat command) to transfer the
     missing items.
- **Currently missing from Shopify (on Etsy, not shown in the app):**
  - Magic Rituals Card Deck
  - Boo-Boo Doll (healing witchcraft Band-Aid kit)
  - *(A third "Witchcraft Kit" Etsy listing is effectively a duplicate — Sophie
    already has witchcraft-kit products on Shopify.)*

### Background jobs — two minor cases left (Sophie's call)
Everything slow on the Home tab is now a resumable background job (survives
leaving the app). Two low-impact cases were left synchronous on purpose —
convert if Sophie wants, but neither loses real work:
- **Miracles studio illustrations** (Shadows → "Open the Miracles studio",
  legacy/toggle-gated). The page text saves to localStorage immediately; only
  the illustration is synchronous, so leaving mid-render just leaves a page with
  no picture (re-openable), not a lost result. Converting needs per-entry job
  tracking. `/api/generate/replicate` + `/api/generate/dalle`, client
  `genImage()` (~line 2263).
- **Natal chart** ("Cast my birth chart", ~5s: geocode + gpt-4o-mini). Moderate,
  not a long image gen; stateless so a dropped fetch = redo. `/api/witch/natal`.

## Done
- **Background jobs:** Suspicious Coincidence (gpt-image-2 **low**, was the slow
  medium call that lost its image on leaving), Dream "Unlock the symbolism", and
  Dream "Illustrate" are all fire-and-forget jobs that persist a pending id and
  resume polling on return — no spinner-watching, no lost results. Generic
  runner: `POST /api/witch/job` + `GET /:id`. *(2026-07-21)*
- Shop mirrors Etsy: order + filter to Etsy items only, clean one-line display
  names (long SEO titles kept on Shopify). *(2026-07-21)*
- Shop tab is boxless (sharp-corner image + text under, no card outline).
