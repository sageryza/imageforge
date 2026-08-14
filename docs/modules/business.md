# Business modules (POD, Etsy, Shopify, blog, crystals)

The selling half of the app: the product pipeline and its POD services, the Etsy and Shopify modules, the photo-to-listing track, Blog Studio, the tarot email, and the crystal drop.

*(Moved out of `CLAUDE.md` Aug 2026 — see the pointer there. Nothing was rewritten; this is the text as it stood.)*

## Product pipeline
- **The "Product Creator" IS `/studio` (`public/studio.html`) — iOS tile
  "Product Creator" on the BUSINESS home (Aug 2026).** One make-a-product
  flow over the pipeline: describe a vibe → `/api/pipeline/brief` plans
  theme/styles/products → generate designs in the house styles → tap one →
  real Printify mockups with garment-color swatches → AI listing copy →
  **one Create tap runs the whole routed batch as a server BACKGROUND job**
  (`POST /api/pipeline/make` → poll `GET /make/:id`; job doc mirrored to
  Firestore `forge-products`, page resumes from
  `localStorage['product_make_job']`) — apparel/mug → Printify product
  published to Etsy as a DRAFT (auto-fulfils once she publishes), art
  print/card → plain Etsy draft. Nothing goes live from here, ever. Things
  she already MADE (photographed objects) are the separate `/photo` track
  (`photostudio.js`); the page links over. (An earlier note here claimed no
  such front existed — wrong, `/studio` already did; Aug 2026 gave it the
  background-job Create, the rename, and the app tile.)

The full pipeline lives in five self-contained modules wired into `server.js`:
generated design → POD product → **draft Etsy listing** Sophie reviews before
publishing. Each module is a router + exported helpers, decoupled enough to be
lifted into a standalone tool later.

- **`pipeline.js`** (`/api/pipeline`) — orchestration glue. `GET /status`
  aggregates connectivity across every service; `GET /route?product_type=` maps
  a product type to a POD service; `POST /listing-content` AI-writes SEO
  title/13 tags/description (**Claude** — buyer-facing copy, clamped to Etsy limits);
  `POST /publish-draft` creates the Etsy draft **and** uploads the design
  image(s) in one call (auto-generates listing content when `generateContent`;
  category comes from a `productType`→Etsy-taxonomy map — `taxonomyFor()` — so
  drafts land in a relevant category instead of inheriting a random listing's);
  `POST /pod-product` creates a Printify product from a design (accepts a
  `product_type` like `t-shirt`/`mug` that resolves blueprint/provider/default
  variant from `POD_CATALOG`, or explicit ids; upload → variants + front print
  area → create, optionally `publish` to the connected Etsy shop for
  auto-fulfillment); `POST /remove-bg` strips a design's background to a
  transparent PNG (Replicate `851-labs/background-remover`) — apparel products
  pass `removeBackground:true` so the art prints clean, not as a filled box.
  Etsy-draft path = manual fulfilment; Printify publish path = auto-fulfils on
  sale (needs Etsy connected inside Printify). Printify products default to
  **draft** (`visible:false`); pass `goLive:true` to publish a live listing.
- **`printify.js`** (`/api/printify`) — POD, wide catalog / lower cost. Bearer
  PAT (`PRINTIFY_API_KEY`), optional `PRINTIFY_SHOP_ID`. Routes: status, shops,
  catalog/blueprints, products, uploads. *Live-confirmed working.*
- **`printful.js`** (`/api/printful`) — POD, in-house quality apparel/cards.
  Bearer account token (`PRINTFUL_API_KEY`), optional `PRINTFUL_STORE_ID`
  (`X-PF-Store-Id`). Has a direct Etsy integration. *Built, not yet key-tested.*
- **`lulu.js`** (`/api/lulu`) — POD, books / coloring books. OAuth2
  client-credentials (`LULU_API_KEY`+`LULU_API_SECRET`), sandbox via
  `LULU_SANDBOX`/`LULU_API_BASE`. Routes: status, cost, print-jobs. Paper maxes
  ~90 GSM uncoated. *Built, not yet key-tested.*
- Card decks (oracle/tarot) print at **MakePlayingCards (MPC)** — no POD API, so
  fulfilment is semi-automated (see `docs/mpc-fulfillment.md`). After an order
  lands, `scripts/mpc_order_builder.py` turns a folder of card images (fronts/ +
  a shared `back.png` or per-card backs/) into an MPC Autofill `order.xml`
  (local-files dialect: `<sourceType>Local File</sourceType>`, comma-separated
  `<slots>`, exact stock strings). The maintained community **MPC Autofill**
  desktop tool (`autofill --directory my_deck`) then drives the browser upload
  and auto-saves the project; Sophie reviews it in her MPC account and checks
  out by hand. Bulk tiers are **per design** (one order = one deck × qty), so the
  default is **one deck at a time / made-to-order**; batch a 6-pack (tier 2)
  only for a proven repeat seller. `scripts/mpc_card_prep.py` (Pillow) is the
  press-ready prep step run BEFORE the order builder — raw art → 825×1125 px @ 300
  DPI incl. 1/8" bleed (cover/extend/fit modes, deck-folder aware, optional
  trim/safe proof images, low-res warnings). Because the pipeline's card images
  live as **URLs** (Firebase/Replicate), not files on a computer, `mpc.js`
  (`/api/mpc`, `POST /prep-order`) is the cloud version of both scripts: it preps
  from URLs + builds order.xml + bundles a downloadable **ZIP** hand-off (sharp +
  jszip; STUDIO_TOKEN-gated; returns a Firebase link). The only step still needing
  a computer is the desktop tool's browser upload — OR use `mpc-upload.js`
  (`/api/mpc-upload`), the full auto-upload: a headless Playwright browser logs
  into MPC, creates the project, uploads every prepped card, sets options, and
  stops at the **cart** for Sophie to review + pay (payment never automated; a
  payment-page guard hard-stops). Background job with per-step screenshots
  (`POST /api/mpc-upload` → poll `GET /api/mpc-upload/:id`); creds via
  `MPC_EMAIL`/`MPC_PASSWORD`. Two caveats: it needs a browser-capable host (NOT
  the Render free web service; `playwright` is an optionalDependency, route
  dormant/501 there), and the MPC selectors (`DEFAULT_FLOW`) need a live
  calibration pass — the engine is mock-tested, the selectors aren't. The ZIP
  hand-off stays the robust fallback; Robinson Chen remains the manual
  hand-fulfilment fallback.

### Key loading (env vars OR Firestore)
- `config-loader.js` runs at boot (after Firebase init) and hydrates
  `process.env` from a single Firestore doc (default `config/pipeline`,
  overridable via `PIPELINE_CONFIG_DOC`). **Host env vars always win** — a key
  already in the environment is never overwritten; Firestore only fills gaps.
- The pipeline routers are mounted **inside** the loader's `.then()`, so the
  service modules capture their keys *after* hydration (brief startup window
  where `/api/*` pipeline routes 404).
- Mirrors the sibling repo's `config/*` pattern. Populate the doc with
  `node scripts/set-pipeline-keys.js` (needs `FIREBASE_SERVICE_ACCOUNT` + the
  keys in the environment; writes only key names to the log, never values).
- So keys can live in Render env vars, all in Firestore, or a mix.

## Etsy module
- `etsy.js` is a self-contained Etsy Open API v3 module mounted at `/api/etsy`
  (`server.js`). Terminal step of the product pipeline: generated design →
  POD product → **draft Etsy listing** Sophie reviews before publishing.
- **Two auth tiers.** App-level reads (ping, taxonomy) send
  `x-api-key: <ETSY_API_KEY>:<ETSY_SHARED_SECRET>` — the keystring AND shared
  secret joined by a colon (keystring alone → 403 "Shared secret is required").
  Writes (draft listings, image upload) need OAuth 2.0 + PKCE with scopes
  `listings_r`/`listings_w`/`transactions_r`/`shops_r`; access tokens expire
  hourly and auto-refresh. Widening `SCOPES` requires a one-time re-auth at
  `/api/etsy/connect` — stored tokens keep the scopes they were minted with.
- **Routes:** `GET /api/etsy/ping` (health), `GET /api/etsy/status`,
  `GET /api/etsy/connect` (start OAuth), `GET /api/etsy/callback`,
  `GET /api/etsy/me`, `POST /api/etsy/listings/draft`,
  `POST /api/etsy/listings/state` (revert a live listing to draft/inactive),
  `GET/PUT /api/etsy/listings/:id/inventory` (read/set variations),
  `POST /api/etsy/listings/:id/images` (copy an image onto a listing by URL),
  `DELETE /api/etsy/listings/:id` (delete a draft/inactive listing).
- **Variations** live on Etsy's listing INVENTORY endpoint, not the listing.
  `buildBundleInventory(tiers)` builds a single-property "buy N" price ladder
  (custom property 513, `price_on_property`); the PUT route also accepts a
  `{ tiers:[{label,price,quantity?}] }` shorthand. A PUT REPLACES all inventory.
- **Env vars** (Render dashboard, `sync:false`): `ETSY_API_KEY`,
  `ETSY_SHARED_SECRET`, optional `ETSY_REDIRECT_URI`. The callback URL must be
  registered on the Etsy app; defaults to `<RENDER_EXTERNAL_URL>/api/etsy/callback`.
- **Listing rules:** title ≤140 chars, ≤13 tags each ≤20 chars (enforced in
  `validateTags`), `who_made:"i_did"`, `when_made:"2020_2026"`, `legacy=false`
  on writes. Etsy bans apps after 6 months of inactivity — keep it warm.
- **Shop Report** (`etsy-report.js`, `/api/etsy/report`, page at `/report`) —
  shop intelligence from live data: pulls active listings + receipts (windowed
  by `?days=`, default 90) + reviews, cross-references lifetime views/favorites
  vs windowed sales, and buckets listings into top sellers / hidden gems (high
  conversion, low views → visibility problem) / stalled (views, no sales) /
  sale candidates (favorites = Etsy-notified audience) / ad candidates (proven
  converters). **Claude** writes a short advice section — **opt-in via `?advice=1`**
  (the page loads numbers only; opening it must never spend, Aug 2026).
  Same `STUDIO_TOKEN` gate; page uses `serveGated`. If the stored token
  predates `transactions_r` the report degrades to listings-only with a
  reconnect banner instead of failing.
- OAuth tokens persist to **Firestore** (`config/etsy-tokens`, override via
  `ETSY_TOKENS_DOC`) when Firebase is available, so they survive Render
  redeploys / cold restarts. Falls back to gitignored `.etsy-tokens.json` when
  Firebase isn't initialized (local dev). So a one-time `/connect` authorization
  sticks across deploys instead of being wiped each time.

## Shopify (Admin API — newsletter audience + blog destination)
- `shopify.js` (`/api/shopify`) is a self-contained Shopify **Admin API** module.
  ONE custom-app token powers two things: pulling the **newsletter audience**
  (email subscribers) and **publishing blog posts** to the store's built-in blog.
- **This is NOT the storefront token.** The site's Buy Button (on
  thepeoplewatchingclub.com, store `cod-god-inc.myshopify.com`) uses the public
  **Storefront** token — products + carts only, cannot read customers by design.
  Subscribers/blog need an Admin custom-app token (`shpat_…`) with scopes
  `read_customers` + `read_content` + `write_content`, created in Shopify admin
  (Settings → Apps and sales channels → Develop apps → create app → Admin API).
- **Three auth modes**, tried in order (Shopify retired legacy admin-created
  custom apps on 2026-01-01, so new stores can't mint a static `shpat_…` token):
  (1) a static `SHOPIFY_ADMIN_TOKEN` if the store still has one; (2) an **OAuth
  offline token** from `/api/shopify/connect` (authorization code grant) — the
  path that actually works for a **Dev Dashboard** app installed on a single
  store; the offline token doesn't expire and is persisted to Firestore
  (`config/shopify-tokens`, like `etsy-tokens`), so one `/connect` sticks;
  (3) **client credentials** (`SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET`
  exchanged at `POST /admin/oauth/access_token`, 24h token) — kept as a fallback
  but **it silently returns a token with EMPTY scope for single-store /
  "custom-distribution" apps** (Shopify's docs: custom apps must use token
  exchange or the authorization code grant). If subscribers/blogs 403 with
  "requires merchant approval for … scope" and the token's `scope` is empty, that
  is this trap — use the OAuth `/connect` flow instead.
- **Dev Dashboard setup (current as of 2026-07 — verified live; re-verify the UI
  before instructing, it changes):** the store's admin **Settings → Apps → Develop
  apps** now only links out to the **Dev Dashboard** (dev.shopify.com) — legacy
  custom apps are disabled. In the Dev Dashboard app: **Client ID + Secret** live
  on the app's **overview/credentials** page (the `atkn_…` "app automation token"
  there is CI/CD-only and does NOT work for the Admin API — ignore it). App
  **config is versioned**: to change **scopes** or **redirect URLs** you tap
  **Create/New version**, which *copies the current config* (so scopes carry
  over — no need to re-pick), edit, then **Release**. **Scopes must be REQUIRED,
  not "optional scopes"** — optional scopes are not granted and yield an
  empty-scope token. **Redirect/allowed URLs** are in the same version config (or
  under the app's Settings/URLs); the OAuth callback must be listed there. No
  manual "install" step is needed for the OAuth path — visiting `/connect` and
  approving IS the install/authorization.
- **Env vars** (Render dashboard or Firestore config doc, `sync:false`, added to
  `config-loader.js` MANAGED_KEYS): `SHOPIFY_STORE` (e.g.
  `cod-god-inc.myshopify.com`), then EITHER `SHOPIFY_ADMIN_TOKEN` (`shpat_…`) OR
  `SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET` (for the OAuth `/connect` flow);
  optional `SHOPIFY_REDIRECT_URI` (defaults to `<RENDER_EXTERNAL_URL>/api/shopify/callback`),
  `SHOPIFY_SCOPES`, `SHOPIFY_API_VERSION` (default `2025-01`).
- **Routes:** `GET /status` (reports `configured`/`connected`/`authMode`),
  `GET /connect` (start OAuth), `GET /callback` (verifies state + HMAC, stores the
  offline token), `GET /subscribers` (customers with
  `email_marketing_state:subscribed`, GraphQL, paginated), `GET /subscribers.csv`
  (download for Shopify Email / Mailchimp — actual *sending* is still manual, no
  public campaign-send API), `GET /blogs`, `POST /blog-post` (REST article
  create; `published:false` = hidden draft to review in Shopify admin first).
  Customers via GraphQL Admin API (REST is being retired for customer data);
  blogs/articles via REST. Same `STUDIO_TOKEN` gate (only `GET /status`,
  `/connect`, `/callback` open — the last two are browser redirects).

## Photo → Etsy pipeline (no POD)
- `photostudio.js` (`/api/photostudio`, page at `/photo`) is a **separate track**
  from the POD pipeline for items Sophie already MADE (a handmade pouch, a
  ceramic, a print she ships herself). One photo of the real product →
  reviewable Etsy draft. No Printify/Printful/Lulu, no auto-fulfilment.
- **Flow:** `POST /describe` (gpt-4o vision → name/summary/category/materials/
  colors/keywords + 3 staging ideas); `POST /mockups` (gpt-image-2 **edits**
  endpoint with `input_fidelity:high` so the ACTUAL product is preserved, not
  hallucinated — a clean white-background shot + up to 2 styled flatlays, saved
  to Firebase as PNGs); `POST /analyze` (describe + write listing content in one
  call, reuses `pipeline.generateListingContent`); `POST /draft` (derives Etsy
  shipping/return/readiness/taxonomy defaults from an active listing, then
  reuses `pipeline.publishDraft` to create the DRAFT with the mockups attached).
- Mockups need Firebase (permanent public URLs Etsy can fetch); without it they
  fall back to data URLs and the `/draft` step refuses them. Same `STUDIO_TOKEN`
  gate as the POD pipeline (only `GET /status` is open).

## Blog Studio (SEO posts → the site blog and/or Shopify)
- `blog.js` (`/api/blog`, page at `/blog`, hub tile "Blog Studio") turns a topic
  into an SEO blog post. **Primary destination (July 2026): the on-site blog at
  `secretlyawitch.com/blog`** (`POST /api/blog/publish-site` flags the saved
  Firestore draft `site:true`; `blog-public.js` server-renders `/blog` +
  `/blog/:slug` in the witch theme, with canonical/OG/JSON-LD + sitemap) —
  organic traffic now builds the real domain. Publishing to the Shopify store
  blog still works as a secondary option. Built around 2026 SEO reality: target **long-tail**
  keywords (specific 3-6 word buyer phrases, KD low) that big sites ignore and
  Google's AI Overviews can't fully answer, so the click still comes to you;
  organize as topic clusters (a pillar + specific cluster posts).
- **Flow:** `POST /keywords` (topic → long-tail keyword ideas w/ intent +
  difficulty + a pillar/cluster shape, **Claude**) → `POST /draft` (full post:
  title/meta/slug/tags/HTML body/FAQ/image prompts, ~900 words, **Claude**) →
  `POST /image` (gpt-image-2 → permanent Firebase webp URL) → `POST /publish`
  (reuses `shopify.publishArticle`; hidden draft or live). Generation endpoints
  are stateless; drafts best-effort persist to Firestore (`forge-blog`) for a
  "recent drafts" list (`GET /posts`, `GET /:id`, `DELETE /:id`). Same
  `STUDIO_TOKEN` gate; `/blog` served via `serveGated`.

## Tarot email (tap-to-reveal daily spread — Brevo)
- `tarot-email.js` (`/api/tarot-email`) builds the **kinetic** daily tarot
  email: the website's Past/Present/Future pull as three face-down cards, each
  with its own pure-CSS tap-to-reveal (hidden checkboxes + `:checked` sibling
  rules — email clients strip all JS). Apple Mail (iPhone/iPad/Mac) gets the
  real in-email flips; Gmail/Outlook strip the `<input>`s so a pre-checked
  "support test" checkbox never matches and they auto-fall back to the same
  face-down spread linking out to `/witch`. Both versions are fully
  inline-styled, so a stripped `<style>` still renders sane; images-blocked
  keeps framed card shapes. The "tap each card" hint hides itself once all
  three are revealed (chained `:checked ~` selectors).
- The spread is **deterministic per day and MATCHES THE WEBSITE** — a verbatim
  port of `witch.html`'s `dailyPull()` with the logged-out seed
  (`<dateISO>|anon`), same FNV-1a hash + 78-card deck (deck data is a copy in
  the module; **keep in sync**), ~28% reversed per card, baked in at build
  time. Art = the committed `witch-tarot-manifest.json` Rider-Waite Firebase
  URLs (reversed cards render rotated 180°). ~13KB, far under Gmail's 102KB
  clip.
- **Routes:** `GET /status` + `GET /preview?date=YYYY-MM-DD` (both open — it's
  public marketing content; preview returns the raw email HTML, viewable in a
  browser), `POST /send-test {to, date?}` (STUDIO_TOKEN-gated; one real send
  via Brevo's transactional API to verify the flip in a real inbox).
- **Brevo** (the ESP — free tier 300/day, accepts full custom HTML): keys via
  config-loader MANAGED_KEYS or Render env — `BREVO_API_KEY` (app.brevo.com →
  SMTP & API), `BREVO_FROM_EMAIL` (must be a Brevo-verified sender),
  `BREVO_FROM_NAME` (default "Secretly a Witch"). **Campaign sends stay in
  Brevo's dashboard** — paste the `/preview` HTML into a custom-HTML campaign
  (Brevo appends the unsubscribe footer there); `/send-test` is only the
  does-the-checkbox-survive check.

## Crystal drop (crystal photos → Etsy listings)
- `crystals.js` (`/api/crystals`, page at `/crystals`) — the drop box for the
  crystal-listing project (Sophie's mom's crystals, already in hand). Sophie
  dumps photos from her phone; a chat pulls them back out to price them, sort
  them into listings, and build the numbered pick-your-own grids.
- **ON HER PHONE EACH CRYSTAL IS ITS OWN PHOTOS ALBUM** (several shots of the
  one stone) — and that album is exactly one Etsy listing. The data model
  mirrors that: one Firestore doc per PHOTO (`forge-crystals`, deckfactory,
  bytes in Storage `crystals/<batch>/<crystal>/`), each carrying `crystal` (the
  album slug) + `crystalName`, and **every photo of a stone shares one `seq`** —
  the crystal's number in a pick-your-own grid. `photoIndex` orders the shots
  (0 = cover). A photo with no `crystal` is loose and gets its own `seq`.
- `kind` is about what's in the FRAME, not the grouping: `single` = one crystal
  in the shot, `group` = a tray of several (`count` = how many). Every stone
  field is optional — dumping a photo is never blocked on knowing anything.
- **`seq` continues across separate uploads** into the same batch (`batchState`
  scans it), so a second dump doesn't restart numbering and break a grid overlay
  already built on the first; re-uploading into an existing album name lands in
  that same crystal and continues its `photoIndex`.
- **ZIP folders become crystals** — `crystalNamer()` strips the prefix every
  entry shares (the Files-app wrapper) and takes the first folder that remains,
  so `Crystals/Pink quartz/*` → "Pink quartz", a lone `Pink quartz/*` → "Pink
  quartz" (the wrapper IS the album), and a flat zip → loose photos.
  `?crystal=` forces the whole zip into one album. Entries sort by filename
  numerically, so `IMG_2` precedes `IMG_10`; `__MACOSX`/non-images are skipped.
  This is the bulk path — the phone flow (Photos → album → Select All → Share →
  Save to Files → one folder per crystal → Compress) is in the page's own
  collapsible how-to, verified against current iOS.
- **Uploads are one photo per request, at FULL RESOLUTION** — the page never
  downscales (these are the listing photos; Etsy wants 2000px+ on the short
  side), it just loops so no single body is 40MB. **HEIC is re-encoded to JPEG**
  via sharp at the ORIGINAL pixel dimensions (Etsy rejects HEIC and most
  browsers can't show it); if libheif can't decode, the original bytes are kept.
- **Routes:** `GET /status` (open), `GET /batches`, **`GET /crystals?batch=`**
  (the listing view — photos rolled up per stone; what a chat should read),
  `POST /upload` `{batch, crystal?, images:[dataURL|url], kind?, defaults?,
  filenames?}`, `POST /upload-zip?batch=&crystal=&kind=`,
  `GET /items?batch=&crystal=&status=&kind=&limit=`, `GET /items/:id`,
  `PATCH /items/:id`, **`PATCH /group` `{batch, crystal, …}`** (a crystal is ONE
  listing, so stone/price/tags/status write to all its photos at once),
  `DELETE /items/:id`, `DELETE /group?batch=&crystal=`. Same `STUDIO_TOKEN` gate.
- PATCH writes are whitelisted to `EDITABLE` — everything else on the doc
  (url, storagePath, createdAt) is server-owned. Queries use a single equality
  filter and sort in memory, so no composite Firestore index is needed.
### The Splitter — `/crystalsplit` (Aug 2026), where one stone stops and the next begins
- **The album-is-one-stone model above is WRONG for most of the real data.** The
  photos never came through `/upload` — Sophie dumped them into the **Dump**
  (`forge-drops`, folder "Crystals": **15 albums, 629 photos + 33 videos**). Only
  TWO albums are one stone ("Clear quartz cluster", "Selenite sphere", plus the
  one tiger's-eye sphere shot properly). The rest are catalogue runs — one stone,
  a couple of shots, next stone — so a single album holds 20-50 separate stones.
  "Individual crystals" is ~20 labradorite freeforms; "Sectarian day two" is
  **septarian** (voice-to-text) and ~50 pieces in the lightbox. **Roughly 175
  stones in total.** Don't rebuild anything on album=stone.
- **Most stones have 1-3 photos, which is a grid slot but NOT a listing** (Etsy
  wants 5-10). `enoughForOwnListing` derives the re-shoot list from that; the
  re-shoot itself is physical work, not a computer job.
- **How they get sold (Sophie, Aug 2026): treatments 1 and 2 MIXED, per stone** —
  its own listing for the individually striking pieces (big labradorite
  freeforms, amethyst clusters), a numbered **pick-your-own grid** slot for the
  many-similar ones (septarian, tiger's eye spheres, pink quartz). Her older
  idea from the July brief still stands: run "you choose" and "you get what you
  get" as two listings over the same stones, two price points (the one case
  where Etsy's duplicate-listing policy really applies — word them as genuinely
  distinct).
- **Nothing can DERIVE the stone boundaries and a wrong guess is expensive** —
  three consecutive frames of a yellow septarian are either one stone turned
  around or three different stones, and reading it wrong puts a number on a grid
  that two customers can buy. So the splitter asks: the album's photos in
  shooting order, one tap on any photo that starts a NEW stone; everything
  between two marks is one stone is one listing.
- **Marks are FILE IDS, never indexes.** Re-dumping an album tops it up and
  `photoIndex` is allocated per arrival, so an index-keyed split would silently
  re-point at different photos. `names`/`treatment` key off the id of a stone's
  FIRST photo for the same reason.
- **The split is its own doc** (`forge-crystal-splits`, id = the bundle slug) and
  the photos are read live — it never changes any grouping or label in the Dump,
  so a split is always re-editable and throwing one away costs only the taps.
- **TILES MUST USE `thumb`, NEVER `url`.** A Dump photo is the full-resolution
  original (~3.7MB — correct, Etsy wants 2000px+) and an album is up to 100 of
  them. `node scripts/crystal-thumbs.js` writes a 480px webp beside each photo
  (content-addressed off the source bytes, one-year immutable cache) and adds
  `thumbUrl` to the drop doc — the one field the splitter writes back. **Re-run
  it after any new crystal dump**; `--force` rebuilds, `--bundle`/`--track`
  narrow it. Ran once over all 629 on 2026-08-09.
- **Routes** (on `/api/crystals`, same gate): `GET /split/albums` (every Crystals
  album + split progress), `GET /split/:bundle` (photos in order + marks),
  `POST /split/:bundle` `{marks?, skip?, names?, treatment?}` (whole state, merge
  write), `GET /split/:bundle/stones` (the derived stones — what a listing
  writer, a grid builder or the re-shoot list reads).
- **`deriveStones` rules, pinned by tests** (`node scripts/test-crystal-split.js`,
  12 cases): no marks = ONE stone (not zero — the first photo starts a stone by
  definition); a mark on photo 0 is a harmless no-op and the page refuses to
  offer it; **a skipped photo does NOT break the run it sits in** (that is how a
  tray shot or a weight-sticker close-up leaves the count without splitting a
  stone in two); numbering is positional, so **any re-split renumbers and a grid
  must be re-rendered, never patched**. Page tested headless:
  `node scripts/test-crystal-split-page.js`.
- **Weights are already on some stones** — several septarian carry blue stickers
  with the weight written on them (14.4oz, 11.7oz), readable straight off the
  photos.
- The Dump album **"crystals"** (#62, 15 files) is NOT photos — it's AI-generated
  crystal illustrations mis-filed into the Crystals folder. "Light box review" is
  4 shots of Sophie testing the lightbox, not a stone.
- **A/B testing note (July 2026 research):** Etsy has NO native split test, and
  changing tags/title on a live listing resets its ranking clock (7–14 days to
  restabilize, 30–90 to fully re-rank). The safe method is a **duplicate
  listing** — copy A into B, change ONE thing, keep enough else different that
  it isn't a policy-violating duplicate, and run both 2+ weeks. Baseline the
  original for a week first.
