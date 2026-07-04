# Ads / Meta roadmap — Deck Factory

## ✅ Done (live)
- **Meta connection** via System User token (`Deckfactoryads`), stored in
  locked-down Firestore `config/metaAds` (never in git). Sidesteps the
  Facebook-Login-for-Business / App-Review / advanced-access gauntlet.
- Backend: `adsSummary` / `adsCreateCampaign` (PAUSED) / `adsSetStatus`, using
  the system token (`functions/index.js`, deployed from `main`).
- App: **Ads** tool shows **Connected ✓**, ad account **Secretly a Witch**
  (`act_343481229903012`, USD), pixel **FONT x SAW LAUNCH** (`1694963838361146`,
  live/firing). Campaign builder creates a PAUSED campaign shell.

Assets on the system user: 4 Pages, 1 ad account, 3 catalogs, 1 IG, pixel,
datasets, domains. Token scopes: ads_management, ads_read, business_management,
pages_* , instagram_* , catalog_management, read_insights, branded-content.

## 🔜 Next builds (prioritized)

1. **Real campaign engine** (completes the core promise)
   - Add **ad set** (daily budget, Advantage+ audience, optimize for Purchase
     via the pixel) + **ad creative** (Sage's images + primary text/headline)
     so tapping **Launch** runs a genuine Advantage+ Shopping ad.
   - Guardrails: created PAUSED, explicit Launch, hard daily-budget ceiling.

2. **Analytics dashboard** (high value, zero spend risk)
   - One screen: IG insights (reach/follows/top posts) + ad spend/ROAS/CPA +
     best-selling products. Uses `ads_read`, `instagram_manage_insights`, catalog.

3. **Shoppable Instagram posts**
   - Tag catalog products in the posts the app generates → tap-to-buy.
   - NOTE: catalogs are likely **Shopify-synced** (Shopify = source of truth);
     read/tag products, don't create/duplicate them.

4. **Smart audiences**
   - Auto-build retargeting (site visitors, add-to-cart, IG engagers) +
     lookalikes of buyers, from the pixel. Biggest ad-ROI lever for a small brand.

5. **Conversions API (server-side events)**
   - Send Purchase events server-side to recover iOS/ad-blocker tracking loss so
     ads optimize toward real buyers.

## Strategy notes (for the campaign engine)
- Start with **Advantage+ Shopping** (simple, AI-driven) optimizing for Purchase.
- ~**$15–20/day**, judge after a **2-week** learning window.
- Watch **cost-per-purchase vs AOV** and ROAS. If purchase volume too thin,
  temporarily optimize for Add-to-Cart to feed the pixel, then graduate.
- Creative is Sage's department; the app supplies formats/variants if wanted.

## Security TODO
- The app secret and system token were pasted in chat during setup — **regenerate
  both** in Meta when convenient and swap the new values into `config/metaAds`.
