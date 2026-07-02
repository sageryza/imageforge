# ImageForge — project notes

## Live app
- **Deployed:** https://imageforge-q125.onrender.com (Render.com, free plan)
  - Hub: https://imageforge-q125.onrender.com/
  - Test Station: https://imageforge-q125.onrender.com/test
  - Picture Book (Miracles): https://imageforge-q125.onrender.com/book
  - Illustrated Zine (Talking to Myself): https://imageforge-q125.onrender.com/talking
  - Gallery: https://imageforge-q125.onrender.com/gallery

## What it is
A hub for making illustrated projects (card decks, picture books, sticker
sheets, zines, single images). Home screen (`/`) is a grid of project types;
each opens a focused workflow that shares the same house styles.

## Stack
- Single-file Node/Express backend: `server.js` (~"v11").
- Static frontend in `public/` (`index.html` = hub, `test.html`, `book.html`,
  `talking.html`, `gallery.html`); shared design system in `public/forge.css`.
- Deployed on Render via `render.yaml`. Env vars set in the Render dashboard
  (all `sync:false`): `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`,
  `FIREBASE_SERVICE_ACCOUNT`. Firebase project id: `membry-df528`.

## Image generation
- OpenAI `gpt-image-2` (the zine; single/sticker can also use DALL·E 3).
- Replicate Flux LoRA house styles in `MODELS.replicate` (`server.js`). Each has
  a trigger word prepended to the prompt. A model may pin a `version` hash or
  leave it `null` to resolve the latest from Replicate on first use (cached).
  Styles: Gouache (gosh), Painterly (pnt), Sketchy (special), Book Illustrations
  (vict), Watercolor Drawings (wtr), PWC Scans (tok), **HOONIE** linocut
  (`sageryza/hoonie`, trigger `HOONIE`, suffix "linocut relief print, white
  background", 40 inference steps — applied automatically server-side).
- Committed style previews live in `public/samples/<seg>.webp` (used by the Test
  Station tiles). Regenerate with `node scripts/gen-samples.js` against a running
  server (needs `REPLICATE_API_TOKEN`).
- `saveToFirebase()` uploads generated images to Firebase Storage for permanent
  URLs + the gallery; without `FIREBASE_SERVICE_ACCOUNT` images are temporary
  (~1hr) Replicate/OpenAI URLs.

## Product pipeline
The full pipeline lives in five self-contained modules wired into `server.js`:
generated design → POD product → **draft Etsy listing** Sophie reviews before
publishing. Each module is a router + exported helpers, decoupled enough to be
lifted into a standalone tool later.

- **`pipeline.js`** (`/api/pipeline`) — orchestration glue. `GET /status`
  aggregates connectivity across every service; `GET /route?product_type=` maps
  a product type to a POD service; `POST /listing-content` AI-writes SEO
  title/13 tags/description (OpenAI `gpt-4o-mini`, clamped to Etsy limits);
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
- Card decks (oracle/tarot) are **manual** fulfilment (Robinson Chen) — no API.

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

## Movies (the newest medium — iOS is the frontend)
- `movies.js` (`/api/movies`) — story → movie pipeline, validated end-to-end in
  a July 2026 prototyping run (~$1.35 for a 12-scene film with dream bridges).
  **No web page** — the native iOS app (`ios/`, Movies tab) is the frontend.
- **Pipeline:** GPT breaks the story into ~8-12 SELF-CONTAINED scenes (each
  prompt renders alone — the video model can't infer beats between scenes),
  deliberately creating before/after panel pairs and repeating character
  continuity tokens in every prompt → gpt-image-2 panels (1024x1536,
  medium-quality storyboard first, HIGH re-render for keepers) → Replicate
  image-to-video per scene → ffmpeg edits + stitch.
- **Video tiers:** draft `wan-video/wan-2.2-i2v-fast` (480p, ~$0.06/clip,
  `last_image` conditioning animates BETWEEN the two panels of a pair);
  quality `kwaivgi/kling-v2.1` standard 720p $0.25 / pro 1080p $0.55
  (`end_image` requires pro). Versions pinned in `VIDEO_MODELS`.
- **Dream mode:** bridge clips over every hard cut — start = previous clip's
  last frame (ffmpeg `-sseof` extract), end = next panel, num_frames 121 and an
  AI-written prompt describing one continuous PHYSICAL action (short morphs
  between different compositions read as a jarring leap).
- **Editing is first-class and free:** per-scene trim / speed / freeze / fade /
  drop / reorder, all server-side ffmpeg at stitch time, re-stitch in seconds.
  ffmpeg comes from `ffmpeg-static`/`ffprobe-static` npm packages (or
  `FFMPEG_PATH`/`FFPROBE_PATH`/PATH).
- **State:** one Firestore doc per movie (`forge-movies` collection) — story,
  scenes, prompts, panel/clip URLs, edit list, running job — so movies reopen
  and re-edit later. Long steps run as background jobs recorded in the doc;
  clients poll `GET /api/movies/:id`. Same `STUDIO_TOKEN` gate as the pipeline
  (only `GET /status` open). Panels/clips/films are saved to Firebase Storage
  (Replicate URLs expire ~1hr).
- **Replicate gotchas baked in:** 429 retry with exponential backoff on create,
  download retries + size verification (replicate.delivery truncates under
  parallel load), ~5-parallel prediction pool.

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

## Etsy module
- `etsy.js` is a self-contained Etsy Open API v3 module mounted at `/api/etsy`
  (`server.js`). Terminal step of the product pipeline: generated design →
  POD product → **draft Etsy listing** Sophie reviews before publishing.
- **Two auth tiers.** App-level reads (ping, taxonomy) send
  `x-api-key: <ETSY_API_KEY>:<ETSY_SHARED_SECRET>` — the keystring AND shared
  secret joined by a colon (keystring alone → 403 "Shared secret is required").
  Writes (draft listings, image upload) need OAuth 2.0 + PKCE with scopes
  `listings_r`/`listings_w`; access tokens expire hourly and auto-refresh.
- **Routes:** `GET /api/etsy/ping` (health), `GET /api/etsy/status`,
  `GET /api/etsy/connect` (start OAuth), `GET /api/etsy/callback`,
  `GET /api/etsy/me`, `POST /api/etsy/listings/draft`,
  `POST /api/etsy/listings/state` (revert a live listing to draft/inactive).
- **Env vars** (Render dashboard, `sync:false`): `ETSY_API_KEY`,
  `ETSY_SHARED_SECRET`, optional `ETSY_REDIRECT_URI`. The callback URL must be
  registered on the Etsy app; defaults to `<RENDER_EXTERNAL_URL>/api/etsy/callback`.
- **Listing rules:** title ≤140 chars, ≤13 tags each ≤20 chars (enforced in
  `validateTags`), `who_made:"i_did"`, `when_made:"2020_2026"`, `legacy=false`
  on writes. Etsy bans apps after 6 months of inactivity — keep it warm.
- OAuth tokens persist to **Firestore** (`config/etsy-tokens`, override via
  `ETSY_TOKENS_DOC`) when Firebase is available, so they survive Render
  redeploys / cold restarts. Falls back to gitignored `.etsy-tokens.json` when
  Firebase isn't initialized (local dev). So a one-time `/connect` authorization
  sticks across deploys instead of being wiped each time.

## Design rules (forever)
- **No pills.** Text buttons are rounded rectangles — `border-radius: 6px`.
  Circular icon buttons (toggles, dots) are the only exception.
- **Always use full clickable links** in updates — app pages, the deployed URL,
  PRs — never bare text the user has to assemble.
- **Always include clickable testing links** when something is ready to test:
  the deployed page for the feature plus the PR link.
- **Copy-paste / handoff messages = one code block.** When the user asks for a
  message to copy-paste, forward, or hand off to another chat, put the ENTIRE
  message inside a single fenced code block so it copies in one tap — no
  commentary mixed in, never split across sections or styled headers.

## Sibling repos
- `memory-library-react` — the games (incl. the Xi card deck), live at
  incaseofamnesia.com; Firebase Cloud Functions that read API keys from
  locked-down Firestore docs (`config/replicate`, `config/openai`, etc.).
- `sage-lora-app` — a minimal standalone Replicate LoRA generator.

## Dev workflow
- Develop on a feature branch, commit + push, open a DRAFT PR.
