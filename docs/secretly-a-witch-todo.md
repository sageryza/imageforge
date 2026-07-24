# Secretly a Witch — to-do / backlog

A living list of changes for the Secretly a Witch app (web `/witch` + the iOS
shell). Newest ideas at the top; check things off as they ship.

## Open

### Book of Shadows — Synchronicities 4th box "draw another" is a PAID button (TODO)
The Synchronicities section shows the day's coincidences 4-to-a-page. The 3
Home coincidences file in automatically; the **4th box is left empty on
purpose**. Sophie wants a **"Draw it" / draw-another button on that empty box
that opens the pay screen** (buying an extra synchronicity draw beyond the free
3/day). Not built yet — currently the 4th box is just a plain empty square.
When building: reuse `openUpgrade('coincidence')` / the membership flow, gate
the draw, then write the result into the sync archive (`witch_sync_archive`)
under that day so it fills the 4th slot. Ties into the paywall section below.

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
  on it; worst case people subscribe on the site and the app just unlocks.
- **STRIPE INTEGRATION — SHIPPED (TEST MODE, 2026-07).** `stripe.js`
  (`/api/stripe`): `GET /status`, `GET /entitlement` (verifies the app's
  Firebase ID token vs membry-df528, reads `users/{uid}.membership`),
  `POST /checkout` ($4/mo Checkout Session), `POST /webhook` (crypto-verified;
  `checkout.session.completed` + `customer.subscription.*` flip
  `users/{uid}.membership.active`). Entitlement is server-authoritative, stored
  OUTSIDE the client-synced bundle. `witch.html`: `isPaid()` backed by
  `refreshEntitlement()` on sign-in; "Become a member" → Stripe Checkout
  (external browser on iOS, inline on web); handles `?subscribe=1` / `?sub=success`.
  Test **Product + $4/mo Price + webhook** created via `scripts/stripe-bootstrap.js`;
  test keys stored in the config doc. **Verified live e2e:** status ok, auth
  gating (401 no-token), signed webhook → wrote membership to Firestore, bad
  signature rejected (400). The QA switch `?paid=1`/`?paid=0` still works.
- **LAUNCH CHECKLIST (Sophie + a chat, before real payments):**
  1. Finish the Stripe **account verification** (business name + a reachable
     website — the CWIW account's overdue "confirm your website" task) so
     payouts release. Test mode works without this; live charging needs it.
  2. Create the **LIVE** Product/Price/webhook: `STRIPE_SECRET_KEY=sk_live_… node
     scripts/stripe-bootstrap.js` → put the live `STRIPE_SECRET_KEY` +
     `STRIPE_PRICE_ID` + `STRIPE_WEBHOOK_SECRET` in the config doc (swaps test→live).
  3. Verify the full **card checkout** in a browser with a Stripe test card
     (`4242 4242 4242 4242`) before flipping to live.
  4. (Optional) set `STRIPE_TRIAL_DAYS` for the card-up-front free trial.
  5. Point `secretlyawitch.com` at the witch app (see the Domain item) so the
     subscribe page lives on the real domain.
- **Pricing (Sophie, 2026-07):** **$4/month** to start (may rise depending on
  real per-feature model costs), **monthly only — no annual** (feels deceptive),
  **free trial: CARD UP FRONT** (Stripe collects card, N days free, auto-charges
  when the trial ends; send a reminder email before the charge). Decided 2026-07.
- **Free vs paid map (draft — confirm/expand with Sophie):** ONE membership
  unlocks all of it.
  - **Dream illustration** — LEAVE FULLY OPEN FOR NOW (Sophie, 2026-07): not
    paywalling/capping dreams yet — it's fun to see people's dreams and it's
    marketing research for her planned "Just Dream" shared-dream platform. The
    cost is accepted as research spend. (The 1-page-free/blur-rest paywall is
    still the eventual model, just deferred.)
  - **Suspicious Coincidence** — 3 boxes, drawings persist; 1 redraw/day free;
    more redraws paid.
  - **Birth chart** — your OWN chart free; charts for friends / other people paid
    (Costar model).
  - **Make-your-own-tarot-deck** (new feature, not built) — REVISED (Sophie,
    2026-07) to cap cost: free = **3 cards**; paid = the **major arcana (22)**;
    the **full 78-card deck is never offered** (no minor arcana) — this caps the
    spendiest action at ~22 cards, generated once.
  - **Suspicious Coincidence — generous for paid** (Sophie: "could go forever").
    It's ~1.5¢/draw, so paid = effectively unlimited redraws; free = 1/day.
  - **Advanced / special-topic Witch School lessons** — possible paid tier
    (basic lessons free, advanced or interesting-topic ones paid).
  - **Text coincidence moments in the book** (Book of Miracles / Shadows — which
    one TBD, ties into the BoS rework) — adding a **text-only** moment is free;
    **paying to illustrate it** is the paid action. New feature, not built.
- **Coincidence spec (decided 2026-07, REVISED):** KEEP the **three** Home
  boxes. Within a day the drawings persist (you can't freely change them, only
  redraw). Free = **one redraw per day** (across the boxes); more redraws paid.
  "Draw it!" → "Redraw"; redraw popup + version arrows. **SHIPPED (chunk 1).**
  - **REVISION (Sophie, 2026-07): the 3 boxes RESET at local midnight** — fresh
    empty boxes each day. Before the reset, the day's drawings **archive to the
    Book of Shadows** (Signs & synchronicities) so nothing is lost. If someone
    wants MORE than 3 coincidences in one day, they add them in the **Book of
    Shadows** (text moment → pay to draw). NOT yet built — depends on the Book
    of Shadows rework (larger decision). Chunk 1 shipped the persist-only
    version; this changes it to daily-reset + archive.
  - **Account sync: SHIPPED** — coincidence drawings (`witch_coin_done`) now
    sync to the signed-in account's cloud doc (added to `WITCH_KEYS`; pushes on
    change, re-renders on pull). The redraw counter stays device-local (Sophie
    OK'd a soft limit). Drawings following the account is a pre-release must.

### Domain: point secretlyawitch.com at the witch app (front door)
**CODE SHIPPED (2026-07-24) — waiting on Sophie's DNS/dashboard flip.** The
server is host-aware: requests arriving on `secretlyawitch.com` (or www) get
the witch app at `/`, old Shopify-storefront URLs (`/products/*`,
`/collections/*`, `/cart`, `/pages/*`, …) 301 to the store's permanent home
(`WITCH_STORE_ORIGIN`, default `cod-god-inc.myshopify.com`), old `/blogs/*`
URLs 301 to the new **on-site blog** at `/blog` (+ `/blog/:slug`, server-
rendered from Firestore `forge-blog` — Blog Studio grew a "Publish to
secretlyawitch.com/blog" button, `POST /api/blog/publish-site`; preview at
`/blog?public=1` on the onrender host), plus `robots.txt`, `sitemap.xml`,
canonical/OG tags in `witch.html`, and Stripe checkout returns to the domain
the buyer started on. The onrender host is untouched (hub/studio unchanged;
`/blog` there is still the gated Blog Studio). The SEO story: the blog moves
INTO the witch app, so organic posts now build the real domain instead of
Shopify.
- **Sophie's flip checklist (each step is safe; the site keeps working
  throughout — DNS just switches which thing the domain shows):**
  1. **Render** (dashboard → the imageforge service → Settings → Custom
     Domains → **+ Add Custom Domain**): add `secretlyawitch.com`. Free
     (Hobby) workspaces include 2 custom domains. Render will show the DNS
     records to set and auto-handles the www redirect.
  2. **Hover** (hover.com → secretlyawitch.com → **DNS** tab): DELETE the A
     record `@ → 23.227.38.65` and the CNAME `www → shops.myshopify.com`;
     ADD `A @ → 216.24.57.1` and `CNAME www → imageforge-q125.onrender.com`.
     Delete any AAAA records if present (Render is IPv4-only).
  3. Back in Render: **Verify** → certificate issues automatically (minutes).
  4. **Firebase** (console → project `membry-df528` → Authentication →
     Settings → **Authorized domains**): add `secretlyawitch.com` — sign-in
     (Google popup, email link) fails on the new domain without this.
  5. **Shopify** (admin → Settings → Domains): remove `secretlyawitch.com`
     so the store's primary domain reverts to `cod-god-inc.myshopify.com`
     (checkout + product pages keep working there; the app's Shop tab and the
     redirect layer already point at it).
- **Open (Sophie's call, not blocking):** optionally give Shopify a branded
  subdomain — Hover CNAME `shop → shops.myshopify.com`, add
  `shop.secretlyawitch.com` in Shopify Domains as primary, then set
  `WITCH_STORE_ORIGIN=https://shop.secretlyawitch.com` (Render env or the
  config doc) so store links/redirects use it. And the bigger later item:
  retiring Shopify's themed pages entirely for a **Buy Button** in the Shop
  tab (storefront-token path PWC already uses) — checkout/fulfilment stay
  Shopify; the blog/SEO concern is already solved by the on-site blog.

### App Store screenshots — refresh with the new features (Sophie: "later today")
The `ios-witch-screenshots.yml` workflow (memory-library-react) boots a
simulator and captures per-tab shots via `?shot=<sectionId>` + `WITCH_TAB`.
Now that big features shipped (coincidence redraws, Book of Shadows, dreams,
membership), refresh the App Store set before submission:
- Sophie picks WHICH features to feature (suggested: Home moon+card, daily
  tarot, coincidence, your-sky, School, Book of Shadows, Shop, dream).
- Fresh simulators show EMPTY states — add a `?demo=1` seed that fills demo
  content (sample coincidence drawings, a sample chart, a revealed pull) so
  shots aren't blank. Sophie hasn't approved demo-seeding yet — confirm first.

### ⚠️ Unit economics — check BEFORE committing to $4/mo (Sophie flagged)
Many paid features cost real API money per use, so an unlimited $4/mo membership
can LOSE money on power users. Rough per-action costs (cheap tiers we already use):
- Coincidence draw (gpt-image-2 low): **~1.5¢**
- Dream page (gpt-image-2 medium): **~6¢** (a dream is several pages)
- Full 78-card tarot deck: **~$1.20 (low) – ~$4.70 (medium)** — the spendiest single action
- Friend birth chart (gpt-4o-mini text): **fractions of a cent**
- Advanced lessons: **~$0/user** if pre-generated ONCE and shared (do this)
Stripe fee on $4 ≈ 42¢, so real budget ≈ **$3.58/paying user/mo**. A heavy user
doing daily multi-page dreams alone blows past that. **Levers:** (a) per-feature
fair-use caps even for PAID (e.g. N dreams/day, N deck-gens/mo), (b) a credit/
allowance system, (c) higher price. ALSO watch FREE-user cost (they pay nothing
but still burn API $ — keep the taste genuinely small). Recommend: caps + cheap
tiers + pre-generate shared content. TODO: build a proper break-even model.

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
