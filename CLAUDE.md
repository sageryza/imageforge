# ImageForge — project notes

## Never block the turn on a wait — always background it
- **Any "wait for X" step MUST run as a background task**, never a foreground
  blocking wait. This includes waiting on a Render deploy, CI, a build, a
  long poll loop, or anything that doesn't return in a second or two. Use a
  background Bash task (`run_in_background`) or a Monitor, hand the turn back
  immediately, and report when the watcher fires.
- **Why it matters:** a foreground wait holds the turn open, so anything Sophie
  types while it runs is queued but **silently swallowed — her message never
  sends** (this actually happened; she lost a message she'd written). Blocking
  also makes it look like she can't talk to you when she always can.
- Deploys are never worth blocking on: the change is already merged and safe;
  the watcher just tells you when it's live.

## Dashboard deep links (give Sophie EXACT links, never "go find it")
Sophie reads on a phone and hunting through a dashboard's menus wastes her
time, so ALWAYS hand her a full clickable deep link. These ids are the pieces
you can't guess — none of them is a credential (every link still demands her
login), so they're safe here even though this repo is public. Pair them with
the "research the CURRENT UI" design rule: the ids stay valid, the menu labels
around them change, so verify the labels and use these for the URL.
- **Render service** (the ImageForge web service): `srv-d660igvgi27c73a5u6eg`
  - Settings incl. **Custom Domains**: https://dashboard.render.com/web/srv-d660igvgi27c73a5u6eg/settings
  - Env vars: https://dashboard.render.com/web/srv-d660igvgi27c73a5u6eg/env
  - Logs: https://dashboard.render.com/web/srv-d660igvgi27c73a5u6eg/logs ·
    Deploys: https://dashboard.render.com/web/srv-d660igvgi27c73a5u6eg/deploys
  - Pattern: `dashboard.render.com/web/<srv-id>/<settings|env|logs|deploys|metrics>`
- **Firebase** — membry (`membry-df528`, the iOS gallery / witch auth):
  - Auth **Authorized domains**: https://console.firebase.google.com/project/membry-df528/authentication/settings
  - Firestore: https://console.firebase.google.com/project/membry-df528/firestore
  - Deck Factory (`deckfactory-43176`, server data/Storage): swap the project id
    into the same paths.
- **Shopify admin** (store handle `cod-god-inc`):
  - Domains: https://admin.shopify.com/store/cod-god-inc/settings/domains
  - Apps: https://admin.shopify.com/store/cod-god-inc/settings/apps
  - Pattern: `admin.shopify.com/store/cod-god-inc/<path>`
- **Hover** (DNS for secretlyawitch.com — NOT Shopify): https://www.hover.com/domain/secretlyawitch.com
- **Missing an id you need?** Ask Sophie to paste the URL from her address bar
  while she's on that page, build the exact link from it, and ADD THE ID HERE
  so no future chat has to ask twice.

## Live app
- **Deployed:** https://imageforge-q125.onrender.com (Render.com, free plan)
  - Hub: https://imageforge-q125.onrender.com/
  - Test Station: https://imageforge-q125.onrender.com/test
  - Picture Book (Miracles): https://imageforge-q125.onrender.com/book
  - Illustrated Zine (Talking to Myself): https://imageforge-q125.onrender.com/talking
  - Gallery: https://imageforge-q125.onrender.com/gallery
  - **Secretly a Witch** (public witchy app): https://imageforge-q125.onrender.com/witch
  - **secretlyawitch.com → the witch app (July 2026).** The server is
    host-aware: on `secretlyawitch.com` the witch app serves at `/`, old
    Shopify-storefront paths 301 to `WITCH_STORE_ORIGIN` (default
    `cod-god-inc.myshopify.com`), old `/blogs/*` 301 to the on-site blog at
    `/blog` (+ `/blog/:slug`, rendered from Firestore by `blog-public.js`;
    preview via `/blog?public=1` on the onrender host), and `robots.txt` /
    `sitemap.xml` are served for SEO. The onrender host is unaffected. DNS
    lives at **Hover** (not Shopify); the flip checklist is in
    `docs/secretly-a-witch-todo.md` (Domain section).

## Render keep-awake & running hours (READ THIS before blaming cold starts)
- **What pings the app: the app itself.** `server.js` (bottom, the "Keep-awake"
  block) runs a `setInterval` every **10 min** that fetches
  `${RENDER_EXTERNAL_URL}/api/talking/ping` — an **internal self-ping**, not an
  external uptime monitor / cron / GitHub Action. There is NO external pinger
  anywhere in any of the four repos; do not go hunting for one. Render injects
  `RENDER_EXTERNAL_URL` automatically, so the self-ping is live in production
  (log line: `Keep-awake self-ping enabled for …`).
- **Why it exists:** Render **free** web services spin down after ~15 min with
  no inbound traffic, and the next visit eats a ~30–60s cold start ("Load
  failed" / slow first render). The 10-min self-ping (under the 15-min idle
  window) keeps the instance warm so Sophie doesn't hit that wait.
- **A self-ping can't wake a sleeping instance.** If the service ever DOES sleep
  — right after a deploy/restart before any traffic, or if the ping ever lapses
  — it can't ping itself back awake; the *next real visitor* eats the cold
  start. So an occasional slow first load is still expected, especially just
  after a deploy. (A slow generation is usually cold start **plus** the model
  itself, e.g. gpt-image-2 medium ~30–90s.)
- **Limited running hours (the trade-off):** Render's free tier gives **750
  instance hours per workspace per calendar month** (reset on the 1st, no
  rollover). Keeping the app awake 24/7 burns hours continuously — a full month
  is ~730 hours, so a single always-on free service *just* fits under 750 with
  little slack. **If those 750 hours run out, Render suspends ALL free web
  services in the workspace until the next month** — so a second free service,
  or restart churn, can exhaust the budget early and take the app down till the
  1st. If ImageForge is ever hard-down (not just slow) late in the month, this
  is the first thing to check. The real fix is the $7/mo Starter plan (always-on,
  no hour cap); until then, the self-ping is the free-tier compromise.
  (Verified against Render's current free-tier terms, July 2026.)

## Dating book — "The Sophie Experiment"
Sophie's long-running dating-memoir project (square coffee-table book from ~50
Portland dates). The full brief, her own planning docs/mockups, illustration
**style prompt formulas**, essay & infographic lists, and prior-chat transcripts
live in **`docs/dating-book/`** — read `docs/dating-book/THE-SOPHIE-EXPERIMENT.md`
first for anything dating-book related. Art uses the `wtr` watercolor LoRA.

## Dating book — "The Sophie Experiment"
Sophie's long-running dating-memoir project (square coffee-table book from ~50
Portland dates). The full brief, her own planning docs/mockups, illustration
**style prompt formulas**, essay & infographic lists, and prior-chat transcripts
live in **`docs/dating-book/`** — read `docs/dating-book/THE-SOPHIE-EXPERIMENT.md`
first for anything dating-book related. Art uses the `wtr` watercolor LoRA.

## Terminology (Sophie's usage)
- **"app" = the iOS app.** When Sophie says "the app," she means the native
  iOS app (SwiftUI), not the web. Icons/behaviours she describes there may be
  SF Symbols / platform-native (e.g. the "sparkles" star is Apple's SF Symbols
  `sparkles`: big star bottom-RIGHT, medium star left, small star top —
  verified against the actual glyph July 2026; an older note here said
  bottom-left, which is wrong. The witch web app's `STAR` const in
  `witch.html` is an exact bezier-fit match of it).
- **"web app" = the web app** (the `public/*.html` pages served by Render,
  e.g. `/witch`).

## What it is
A hub for making illustrated projects (card decks, picture books, sticker
sheets, zines, single images). Home screen (`/`) is a grid of project types;
each opens a focused workflow that shares the same house styles.

## Deliverables → the in-app gallery (ALWAYS)
- **Any image deliverable made for Sophie — in a chat, via the web generator, a
  pipeline, anything — goes into the iOS app's "My Creations" gallery**
  (`CreationsView.swift`) so she sees it on her phone next to everything else.
  This is the default hand-off surface; don't leave deliverables only as chat
  attachments or web-gallery entries.
- **No exceptions, and never withhold a batch to avoid "cluttering" it.** If
  Sophie asked for images — a set, options, a 20-image backlog, anything — EVERY
  one goes in. She decides what's too much for her gallery, not you. The only
  things that stay out are genuine throwaways she didn't ask to keep (failed
  tests, rejected re-rolls). When in doubt, post it. (The gallery tiles are
  uniform squares, so batch size never breaks the layout — that's not a reason
  to hold anything back.)
- **How the gallery works:** it reads Firestore `users/{uid}/creations` in
  project `membry-df528`, ordered by `createdAt` **DESC**. Normally those docs
  are written by the app's Cloud Functions under the device's **anonymous-auth**
  uid, so images made outside the app never appear on their own — you must write
  the doc yourself with the Admin SDK.
- **Label your images (July 2026).** The hook turns the markdown link text of
  a Firebase image URL in your finished reply into the asset's DESCRIPTION,
  shown on the Assets tile + lightbox (Sophie reviews with ♥/notes there). So
  always write meaningful labels — `[Penny — the blue Kleenex](url)`, never
  `[p01](url)` or a bare URL. Identical images de-dupe server-side by content
  hash, so posting the picture inline AND the link files ONE asset.
- **AUTO-FILING (July 2026):** the chats' Stop hook (`post-to-feed.sh` v3) also
  files image deliverables automatically via `POST /api/gallery` — any Firebase
  Storage image URL in the finished reply, plus image files sent with
  SendUserFile. So the normal flow needs NO manual gallery step in
  hook-equipped sessions. Still post manually (below) when the hook is absent,
  for non-image types, per-image prompts/styles, or true generation times on
  a backfill.
- **NO contact sheets — review happens IN the gallery, labeled (July 2026,
  Sophie's rule).** Every image deliverable goes into the gallery / the chat's
  Assets tab **individually and LABELED** (the label is its `description` — what
  she reviews by), and she reviews it there, one image at a time. **Do NOT build
  or send a stitched contact sheet** — not in chat, not as a file. When you
  re-roll an image, give the new version a **NEW id** and **KEEP** the old one
  in the gallery as history (label it "…v1 — superseded"); nothing is
  overwritten or deleted. To label an already-filed asset, re-POST
  `POST /api/gallery { assetsOnly:true, chat, url, description }` (it dedupes by
  url and updates the label in place).
- **One command does upload + post:**
  `GALLERY_UID=<uid> node scripts/post-to-gallery.js --file ./image.png --prompt "…"`
  uploads the local file to membry Storage, makes it public, and writes the
  gallery doc — so generate → post is a single step (use `--url` instead for an
  already-hosted image). Needs the `membry-df528` Admin service account via
  `STORY_FIREBASE_SERVICE_ACCOUNT` (preferred — see the two-key note below) /
  `FIREBASE_SERVICE_ACCOUNT` (fallback) / `GOOGLE_APPLICATION_CREDENTIALS`, and the target uid
  (neither in the repo). Doc shape:
  `{ type, url, prompt, stickers:null, createdAt:Timestamp, source, style? }`.
- **The target uid is Sophie's device anonymous-auth id** — a personal
  identifier, so it's kept OUT of the repo (pass `--uid` or set `GALLERY_UID`;
  store it in Render env / a local `.env`, or Sophie shares it in-session).
  Anonymous uids change on reinstall — re-find with
  `node scripts/find-gallery-uid.js` (scans every user's creations via
  collectionGroup and ranks them; the device is the uid with hundreds of
  creations and a recent date).
- **Timestamps = when the image was actually made.** The app sorts by
  `createdAt`, and multiple chats post concurrently, so pass the true generation
  time (`--created <ms>`) — that's what keeps everyone's deliverables in correct
  chronological order (and puts a genuinely-fresh batch at the top). Don't reuse
  a stale/skewed server clock just because it's embedded in a filename.
- **Images must live at a public URL** the app can fetch (Firebase Storage in
  either project, made public). Temporary Replicate/OpenAI URLs expire — upload
  to Storage first (`saveToFirebase()` in `server.js`, or `bucket.upload()`).
- **Opening a creation shows MODEL · QUALITY at the top of its caption (Aug
  2026).** The doc carries `model` + `quality` as separate fields (older docs
  have only the single `style` label, "ChatGPT · medium" — the app falls back
  to it), so anything filing a creation should write both. `prompt` stays the
  line underneath.
- **Saving to Photos hands over a FILE, not a UIImage or a data resource**
  (`PhotoSaver`): the original PNG/JPEG/HEIC bytes when the download already is
  one (sniffed by magic number — webp is excluded, Photos rejects it), else a
  PNG re-encode, staged in tmp and added with `shouldMoveFile`. Photos' own
  error text is shown in the toast, and a refused permission raises an alert
  with **Open Settings** — `requestAuthorization` never re-prompts after a
  "Don't Allow", so a toast there was a dead end.

## Stack
- Single-file Node/Express backend: `server.js` (~"v11").
- Static frontend in `public/` (`index.html` = hub, `test.html`, `book.html`,
  `talking.html`, `gallery.html`); shared design system in `public/forge.css`.
- Deployed on Render via `render.yaml`. Env vars set in the Render dashboard
  (all `sync:false`): `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`,
  `FIREBASE_SERVICE_ACCOUNT`. **The server's Firebase project is
  `deckfactory-43176`** (verified 2026-07-11 via a Storage upload URL) — NOT
  membry-df528 as previously documented. The iOS app's direct Firestore reads
  (Story Boards, GoogleService-Info.plist) use `membry-df528`, so data written
  by the server and data read directly by the app live in DIFFERENT projects.
  `/api/story` bridges this with `STORY_FIREBASE_SERVICE_ACCOUNT` (a membry
  service-account JSON) — set it in Render or the boards read as empty.
- **Two service accounts → two env vars (same names for the server AND for a
  chat's local scripts).** Set BOTH so anything works, including the
  network-proof direct-to-Firestore paths:
  - `FIREBASE_SERVICE_ACCOUNT` = **Deck Factory** (`deckfactory-43176`) — the
    chat feed (`forge-chat-feed`), assets/votes, thumbs, Compare pages, Storage.
    Used by `server.js` and `scripts/post-feed-direct.js`.
  - `STORY_FIREBASE_SERVICE_ACCOUNT` = **Memory / membry** (`membry-df528`) —
    the iOS "My Creations" gallery and Story Boards. Used by `/api/story` and
    `scripts/post-to-gallery.js` (which falls back to `FIREBASE_SERVICE_ACCOUNT`).
  For a chat's cloud environment, set both as **environment variables** in the
  environment settings (NEVER commit either to this public repo). Only ONE
  default environment? Set both there once and every session has them.

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

## Playground (`/playground`, iOS tile "Playground") — prompt tester
- `public/promptlab.html` + `/api/promptlab` (inline in server.js), Firestore
  `forge-promptlab`. Fixed recipe per style so runs stay comparable: **ONE
  image a run**, 2:3. Background job on the doc; the page polls and resumes
  from `localStorage`. ♥/✕ per image in the lightbox, plus a copy button
  (Aug 2026) that closes the lightbox and puts that picture's prompt back in
  the prompt box — the tiles-view route to the list boxes' copy button.
- **Generate is the stars icon, and a run makes ONE picture (Aug 2026,
  Sophie).** The button is a Lucide `sparkles` glyph with no word on it, and
  there is no how-many picker at all — every style draws one image per tap
  (the LoRAs used to hard-code `num_outputs: 4` server-side; that is now
  `cfg.outputs`, and `POST /api/promptlab` clamps `outputs` to 1-4 with a
  default of 1). The page's `OUTPUTS` const is the other half of the pair —
  move both if this ever changes.
- **A Replicate run she already has is never sent again (Aug 2026, Sophie).**
  Flux with a fixed seed is deterministic — same prompt + same LoRA scale +
  same seed draws the SAME picture — so re-running one only spends money on a
  duplicate. `alreadyRun()` checks the planned recipe against the runs on the
  page and the ones still drawing, and Generate stops with a toast instead of
  posting. **×3 sends only the rungs she's missing** ("Drawing scale 1.2 and
  1.4 — you already have 1"), so ×3 after a single scale-1 run costs two
  images, not three. Two deliberate exceptions: **ChatGPT is never deduped**
  (an identical run there draws a DIFFERENT picture — that's the point of
  tapping the stars twice, so `plannedKey` answers null for it), and a run
  that **failed or was cancelled never blocks a retry** (only one that really
  produced a picture counts). The prompt is normalized the way the server
  does it — trimmed, trailing periods dropped — or a typed "." reads as a
  different run. The check sees the loaded feed (40 runs) plus anything in
  flight, so a duplicate of something much older still gets through.
- **Identical runs share ONE box (Aug 2026, Sophie).** Tapping the stars twice
  on the same prompt is one job as far as she's concerned, so the feed merges
  runs whose prompt AND settings match — engine, model, status, quality,
  aspect, character toggle, LoRA scale, seed — into a single box: one prompt
  head, the pictures side by side **oldest-first** (the second tap lands to
  the RIGHT of the first). Anything that differs (a different quality, a
  nudged seed) stays its own box, because the head's tags could no longer
  describe every picture under it; failed runs never merge (each carries its
  own error). It is purely a DISPLAY grouping — every cell still points at its
  own run doc, so the lightbox shows that picture's real settings and a ♥
  writes to the right doc. Runs still drawing group the same way, and the one
  X on a merged box cancels every run in it (`data-kill` holds a comma list).
  `groupBy`/`sameRunKey` in `promptlab.html` do it; the server knows nothing
  about it.
- **The feed has TWO views: LIST and TILES** (`promptlab_view` in
  localStorage, default list). List = a box per run, prompt above its
  pictures. Tiles = every picture from every run as uniform SQUARE thumbnails
  **four to a row** (the My Creations look), no prompt on the page — tapping
  one opens the lightbox, which is where the prompt and the model · quality ·
  seed line live. **A run still drawing holds its own empty square at the
  FRONT of the tile wall** (`#tiles .cell.ph`, breathing so it doesn't read as
  a broken image) and the list view's "drawing…" box is hidden in tiles, so
  nothing appears twice — cancelling a run therefore lives in LIST view. Two gotchas, both earned: the switch is a **sticky labelled
  LIST/TILES pair**, never a single icon that scrolls away (the first version
  did, and stranded her in a one-image-per-row view with no way back), and it
  sits on the **LEFT** because the autoscroll pill owns the top-right corner.
- **Five styles: WTR, ChatGPT, Scarry, Pastel, Hoonies (Aug 2026, Sophie).** **WTR**
  (`wtr`, the watercolor LoRA — the tile is labelled WTR, but its STYLES key is
  still `watercolor`, which is what localStorage and `?style=` deep links carry)
  is the only Replicate LoRA on the picker: trigger word prepended, suffix
  appended, LoRA scale + seed + ×3 ladder. **The Hoonie linocut tile was
  removed** at the same time — the model is untouched and still serves the Test
  Station / house styles, and old Hoonie runs keep their label in the feed via
  `RETIRED` in promptlab.html.
  **ChatGPT** (Aug 2026, `engine:'gptimage'`) is a different engine:
  gpt-image-2's **edits** endpoint with Sophie's scanned ink-and-watercolour
  page attached as a pure STYLE reference (`refs/evan-film-style.png` =
  "datescan0013", the same file the Evan film uses), **quality medium**,
  **1024x1536**. LoRA scale / seed / ×3 are hidden for it — it has no
  equivalents. **"Scarry"** (Aug 2026, shortened from "Richard Scarry") is a
  second gpt-image-2 style: same recipe, but the attached style references are
  THREE of Sophie's saved busy-animal picture-book pages
  (`refs/richard-scarry-1..3.png` — TWO of the three attach, the mouse in bed
  and the taxi jam; `-2.png`, the mouse at the table, was taken out Aug 2026 at
  Sophie's ask and the file kept in case she puts it back); its prefix has NO colors
  line (that belonged to the watercolor reference) and it is `noCharacter` —
  the Sophie toggle is hidden and the server refuses the card even if sent,
  because her character card is the watercolor look. **"Pastel"** (Aug 2026) is
  the third: the pastel-variant-2 house look, the same recipe as
  `MODELS.house['house-pastel']` — the two Witch School style refs (which live
  in **Storage**, `witch-school/refs/style-*.png`, loaded via `loadHouseRef`,
  not in `refs/`), that style's written linework/palette line as the prefix, and
  the `whiten` flood-fill pass on every finished image. Also `noCharacter`.
  **"Hoonies"** (Aug 2026) is the fourth gpt style: her woodcut smallies (the
  drawings the witch app's loading animation cycles — Dump album "hoonies",
  #228), four of them attached from **Storage** (`hoonies/refs/style-*.png`),
  picked for two subjects grown into ONE object — a face in an open book, an
  eye inside a vase — because that is what a coincidence looks like. Its prefix
  carries **no engraving vocabulary on purpose**: tested side by side, a written
  style description pulled the line finer and more modern, away from their blunt
  woodcut feel (the same finding as `docs/evan-film-style.md`). `noCharacter`.
  Every gpt style appends a `suffix` at the VERY END of the sent prompt, after
  her words (the no-text rule; Pastel's is the house style's longer wording).
  ChatGPT-engine styles live in `PL_GPT_STYLES` in server.js (keyed `evan` /
  `scarry` / `pastel` / `hoonies`; the page sends `style`, absent/unknown → `evan` so old
  pages keep working) — adding another different-reference style = drop the
  image(s) in `refs/` (or point `storageRefs` at Storage), add a
  `PL_GPT_STYLES` entry + a one-line `STYLES` entry in promptlab.html (the page
  holds NO prompt copies anymore — see below).
- **Its prompt is baked in server-side** (`PL_GPT_STYLES`) and her typed words
  sit between the style's prefix and its no-text suffix verbatim — no trigger
  word, no trailing-period trim. **The "Sent as" preview line is GONE (Aug
  2026, Sophie — "just the text box is fine")**, and with it the page's prompt
  copies: promptlab.html's STYLES entries carry no prefix/characterLine
  anymore (updateShape is a stub kept for its old call sites). The ONLY copies
  left to keep in sync with `PL_GPT.prefix`/`PL_GPT.characterLine` are the
  Scratch Pad's (ART.* in scratchpad.js).
  ~$0.06 an image at medium (a LoRA image is well under a cent).
- **The Sophie character toggle (Aug 2026, ChatGPT style only — a
  `noCharacter` style like Richard Scarry hides it and the server refuses the
  card):** her picture as a small button on the controls row (dim = off, lit
  = on; a plain variable like quality, so every load starts OFF). On, the run
  attaches `refs/sophie-character.png` (her hearted "girl placing her book
  face down" render) as the SECOND image and appends `PL_GPT.characterLine`
  to the prefix — "Use the second attached image as a character reference.
  Her name is Sophie. Whenever the prompt mentions Sophie, draw her as that
  girl." — so typing "Sophie" in a prompt draws that girl.
- **`/playground?from=scratchpad` shows a "‹ Scratch Pad" chip** (fixed
  top-left) — the way back when the Scratch Pad's empty-beat popup sends her
  over; without it the pad's WKWebView strands her on the Playground.
- **Low · low · medium in one tap (Aug 2026, Sophie) — the pyramid button,
  ChatGPT only.** Fires THREE runs from one tap: two at `low` and one at
  `medium`, so she gets two cheap looks at a prompt plus a better one without
  three taps and two trips to the dropdown. ~10¢ a tap. `startRun(scale, q)`
  takes a per-run quality override, so the dropdown is left exactly as she set
  it. ChatGPT is never deduped, so the two lows are two DIFFERENT pictures —
  they merge into one box side by side, and the medium is its own box (its
  tags differ). The icon is NOT a Lucide glyph: Lucide's `pyramid` is a solid
  3D shape that says nothing about how many, so it's three circles in the
  Lucide idiom — two outlined at the base for the lows, one filled on top for
  the better one. The button is a picture of what the tap draws.
- **One ChatGPT-only control, in the space the LoRA knobs vacate: quality — a
  dropdown, low/medium/high, default medium** (sent as `quality`, validated
  against `PL_GPT.qualities`). **Deliberately NOT persisted:** it's a plain JS
  variable, so it holds while the page is open and every fresh load is back to
  medium — localStorage would carry an expensive `high` into next time without
  her meaning it. Roughly 2¢ / 6¢ / 25¢ an image. (The old sticky 1/2/3/4
  count toggle is gone — see the one-image rule above.)
- **Cancel is REPLICATE-ONLY, on purpose (Aug 2026, Sophie's call).** The X on
  a running job → "Are you sure you want to cancel?" → `POST
  /api/promptlab/:id/cancel` → status `cancelled`.
  - **Replicate** has a real cancel endpoint (`predictionId` is stored on the
    doc when the prediction is created) — the run stops and only the compute
    already spent is billed. The poll loop treats `canceled` as terminal, which
    it previously did NOT (that would have spun forever).
  - **A ChatGPT run gets NO X and the route refuses it (400).** OpenAI has no
    cancel for image generation — an image is billed the moment it's requested
    — so a cancel there would save nothing and only look like it did. Don't
    "improve" this by making the renders sequential to claw back the unsent
    ones: that was built, and Sophie rejected it (it slows every run down to
    buy a cancel she doesn't want).
  - Cancellation is an in-process `Set` (`plCancelled`) plus `cancelRequested`
    on the doc.
- A ChatGPT run's images are requested in parallel and each lands on the doc as
  it finishes (`status:'ready'`, then `'done'`), so the grid fills in as they
  arrive. One failed call costs its image, not the run.

## Freeform (`/freeform`) — your own refs, your own words, NOTHING added
- `freeform.js` (`/api/freeform`, page at `public/freeform.html`) — the one image
  surface with **no opinion**. Every other one wraps her words in a house style
  (Playground prepends `PL_GPT.prefix`, the Scratch Pad locks a style per story,
  the passport paints pastel); here the prompt is sent to gpt-image-2 **verbatim**
  — no prefix, no suffix, no trigger word, not even a trailing-period trim. If the
  prompt should mention a style, SHE says it. `promptSent` is stored on every run
  so the page (and any later reader) can verify nothing was added — this is the
  "if you add anything to a prompt Sophie gave, tell her" rule made structural.
- **References are a LIBRARY, not a per-run upload** (`forge-freeform-refs`):
  upload once, attach to any later run and to several at a time — the point is
  trying the same references against different words. Bytes at
  `freeform/refs/<id>.<ext>` + a 512px webp display copy; deleting a ref drops
  the record but KEEPS the bytes, or a finished run's history would break.
- **Quality low / medium / high** (~2¢ / 6¢ / 25¢), size portrait 2:3 (default) /
  square / landscape, 1-4 images a run. With refs attached it calls the **edits**
  endpoint; with none it calls **generations** (edits requires an image).
- Background job on the doc (`forge-freeform`), each output lands as it finishes
  so one failed call costs its image not the run; the page polls, remembers
  pending ids in `localStorage`, and resumes on return. STUDIO_TOKEN-gated
  (only `GET /status` open). Routes: `/status`, `POST/GET/PATCH/DELETE /refs`,
  `POST /run`, `GET /runs`, `GET/DELETE /run/:id`.

## Writing Room (dating-book drafts on the phone)
- `writing.js` (`/api/writing`, page at `/writing`, iOS tile "Writing Room") —
  the dating-book working drafts as a reviewable module. Every date in two
  versions: "Claude's" (current draft) and "Mine" (Sophie's raw journal), with
  every changed/added word marked red (word-level diff, precomputed). Autoscroll
  up/down arrows (0.1×–2× speed), tap text to pause, per-paragraph notes (text
  or voice memo; auto-save on tap-away).
- **Notes → Firestore `forge-writing-notes`** (deterministic doc id per block),
  voice memos to Storage `writing-notes/`. ANY chat can read them
  (`GET /api/writing/notes`, x-studio-token) and apply the edits, then
  `DELETE /api/writing/notes/:id`. This is the review loop: Sophie annotates on
  the couch, a chat applies.
- **Source of truth for the text** is
  `docs/dating-book/working-drafts/featured2.json` (current draft pages +
  moments) and `originals.json` (raw journal). After editing them run
  `python3 scripts/gen-writing.py` → regenerates `public/writing.html` (the
  gated page, font embedded) and `working-drafts/dates.json`
  (`GET /api/writing/dates`, for a future native reader). Commit all three.
- iOS: `WritingRoomView.swift` = a WKWebView on `/writing` that answers the
  HTTP Basic gate with the studio token and grants mic capture for voice notes.
  Content changes ship via Render deploy — no TestFlight build needed.

## The Chat app (forge-chat-feed) — every chat posts its replies
- `chatfeed.js` (`/api/chatfeed`, page at `/chats`, iOS tile "Chats") — one
  feed of every project chat's replies so Sophie can read/listen in one place
  (picture icon per chat, tap-to-expand, ▶ Play renders the neural voice on
  tap (cached), orange "Open" button deep-links back to the Claude session,
  List/Tiles view toggle, newest message at the top, reply box).
- **Auto-posting (July 2026):** a Stop hook (`post-to-feed.sh`) posts each
  finished reply automatically — full text + TLDR + `url` (the
  `claude.ai/code/session_…` deep link built from
  `CLAUDE_CODE_REMOTE_SESSION_ID`), zero model tokens, de-duped per message.
  **GOTCHA (verified live 2026-07-15): repo-committed `.claude/settings.json`
  hooks DO NOT LOAD in these sessions** — the session's starting folder is
  `/home/user` (four repos side by side), and Claude Code only loads project
  settings from the starting folder. The working install path is the cloud
  environment's **Setup script** (environment settings dialog), which writes
  the hook + `/home/user/.claude/settings.json` before Claude Code launches —
  paste `docs/chats-autopost-setup-script.sh` there (kept in sync with
  `.claude/hooks/post-to-feed.sh`, which still covers single-repo sessions).
  **ACTIVE since 2026-07-15** — Sophie installed the setup script and a fresh
  chat's tile appeared on its own (verified live).
- **LIVE DRAFTS (Aug 2026, hook v7):** the same hook is also registered on
  **PostToolUse**, so the prose a chat writes BEFORE/BETWEEN tool calls
  reaches the Chats app while the turn is still running — a long coding turn
  no longer means silence until the very end (Sophie's ask: "it would be nice
  if I could see that before they start coding"). Mechanics: the draft pass
  posts the turn's text-so-far with `{turn, working:true}` (`turn` = the
  transcript uuid of the user message that started the turn); the server
  UPSERTS one message per turn onto a deterministic doc id keyed
  session|turn — NOT the chat slug, so renames/slug re-resolution can't fork
  a draft — and the app shows it as "still writing…" (breathing rose marker,
  no Play button yet). The end-of-turn Stop post carries the same `turn` and
  finalizes the SAME message (TLDR set, marker cleared) — one message per
  turn, never a duplicate. The unread dot pings ONCE when the draft first
  appears (Sophie's choice), never again as it grows/finishes. The whole
  draft pass runs backgrounded (adds zero latency to tool calls), posts only
  when the turn's prose actually GREW (state: `forge-draft-<sid>`), and skips
  turns under 60 chars. An interrupted turn's draft is finalized by the
  UserPromptSubmit sweep. After ANY edit to the hook, run
  `python3 scripts/build-chats-setup.py` — it rebuilds
  `docs/chats-autopost-setup-script.sh` + `public/setup.sh` with the hook
  body verbatim-embedded; never hand-edit those two copies. Existing
  environments pick v7 up automatically (the setup script re-runs each
  session start and appends the missing PostToolUse registration).
- **Do NOT also post replies by hand** — the hook already does it, and manual
  posts would duplicate. Check `ls /home/user/.claude/hooks/post-to-feed.sh`;
  only if it's MISSING (hook absent in your session) fall back to the old
  manual post: `POST https://imageforge-q125.onrender.com/api/chatfeed` with
  `{ "chat": "<short-chat-name>", "text": "<reply>", "tldr": "<TLDR>" }`
  (x-studio-token header when gated). The hook names the chat from the git
  branch (e.g. `dating-book-design`); set `FORGE_CHAT` env to override.
  **Unnamed sessions keep a per-session tail** (July 2026): every unnamed
  session's branch is `claude/new-session-<random>`, and stripping the suffix
  merged four different sessions into ONE chat called "new-session" — so a
  generic slug (`new-session`/`session`/`untitled`) now gets 6 chars of the
  session id appended, e.g. `new-session-7f3e9a`, one chat per session.
  **A chat's identity is its SESSION, not its slug (Aug 2026 v2):** branch
  names get REUSED and naming conventions change, and both broke threads for
  real — first two sessions sharing a slug interleaved into ONE thread (the
  chat Sophie renamed "Imprint"), then the untangle claimed that slug with a
  placeholder session id, which ORPHANED the thread (no live session could
  match it, so even its own session forked away and Imprint went silent).
  Resolution is now **session-first**: the registry doc records which session
  owns each slug, and a session that already owns a chat posts there FOREVER,
  whatever its branch says today. The slug only matters on a session's first
  post — it keeps the pretty name if unclaimed, else forks to `<slug>-<sid6>`.
  The hook resolves once per session (`GET /api/chatfeed/resolve?chat=&session=`)
  as a hint, and **every post — feed, gallery, and Sophie's lifted messages —
  also carries `session`, so the server re-resolves authoritatively** (a stale
  hook cache can't mis-file; `explicit:true` marks a deliberately shared
  FORGE_CHAT, never re-keyed). A merged/repaired chat leaves a registry
  tombstone `{ movedTo }` that redirects anything still addressed to the old
  slug. Untangling: `POST /api/chatfeed/session {chat, sessionId}` binds a
  thread to its REAL session id (never a placeholder — that's what orphaned
  Imprint) and clears that id off every other doc; `scripts/merge-chat.js`
  moves a mis-filed message/asset span between chats, re-keys votes, and
  plants the tombstone (`--dry-run` first; the Imprint repair is its header
  example).
- **Self-heal if you're NOT posting (any chat).** If your replies aren't
  showing up in the Chats app, check `ls /home/user/.claude/hooks/post-to-feed.sh`.
  If it's MISSING, your session's environment didn't install the hook —
  reinstall it: `curl -fsSL https://imageforge-q125.onrender.com/setup.sh | bash`
  (writes the hook + `/home/user/.claude/settings.json`). Hooks only load at
  Claude Code startup, so the reinstall kicks in on your NEXT session — to
  surface THIS session's replies now, post each by hand once with
  `POST https://imageforge-q125.onrender.com/api/chatfeed`
  `{ "chat":"<branch-name>", "text":"<reply>", "tldr":"<TLDR>" }`, but ONLY
  while the hook is missing (once it's back the hook posts, and a manual post
  would duplicate). No auth header needed (STUDIO_TOKEN is off on the live
  server).
  - **If the curl / POST is BLOCKED (network error, not a 4xx):** your cloud
    environment's **Network access** doesn't allow `imageforge-q125.onrender.com`
    (the default **Trusted** level only permits package registries + GitHub +
    cloud SDKs — a Render app isn't on it). This blocks BOTH the reinstall and
    the hook's own POST, so the chat can never appear in the Chats app until
    it's fixed. A chat CANNOT change its own network policy — tell Sophie: edit
    the environment (cloud icon) → **Network access → Custom** → add
    `imageforge-q125.onrender.com` to **Allowed domains** → keep "Also include
    default list of common package managers" checked → Save. It's a one-time
    per-environment flip.
  - **Network-proof path — post straight to Firestore (works even when the
    server is blocked).** With the **Deck Factory JSON** (the deckfactory-43176
    Firebase Admin service account) available as `FIREBASE_SERVICE_ACCOUNT`, a
    chat can write the reply directly to the `forge-chat-feed` collection
    instead of curling the API: `printf '%s' "$reply" | node
    scripts/post-feed-direct.js --chat <name> --tldr "<TLDR>"`. Firestore is on
    `googleapis.com`, which is allowed on EVERY network level, so this posts
    even on the locked-down Trusted level. Provide the JSON as an **env var on
    the environment** (`FIREBASE_SERVICE_ACCOUNT=<json>`, same as the server —
    never commit it to this public repo); if it's missing, ask Sophie for it.
    The robust setup is to configure one environment once with all three:
    Network access (add the domain), the Setup script (auto-poster), and
    `FIREBASE_SERVICE_ACCOUNT`.
- **Two Claude accounts (July 2026) — Open buttons route app vs browser.**
  Sophie runs two Claude accounts: one signed into the Claude iOS app, one used
  on claude.ai in her phone browser (the app can't hold both). Each cloud
  environment sets **`FORGE_ACCOUNT`** (`1` or `2`); the hook tags every feed
  post with it (stored as `account` on the chat's registry doc). The `/chats`
  home screen has an **App/Web toggle** ("App 1 · Web 2") Sophie taps when she
  swaps sign-ins — it writes `appAccount` to the reserved registry doc
  `__settings` via `POST /api/chatfeed/app-account`. Open buttons compare the
  chat's `account` to `appAccount`: match (or untagged) → direct claude.ai link
  (iOS universal link opens the Claude app); mismatch → the same claude.ai
  link with **`#no_universal_links` appended** — claude.ai's own
  apple-app-site-association EXCLUDES any URL carrying that fragment (their
  first match rule, checked July 2026), so iOS never hands it to the Claude
  app and it opens in the BROWSER, where that account is signed in. **Do NOT
  reach for redirect tricks here:** a server 302 to claude.ai (verified
  2026-07-27) AND a self-navigating interstitial page (verified 2026-07-31)
  both bounce into the Claude app on current iOS — the AASA fragment
  exclusion is the only thing that works. `GET /api/chatfeed/go?u=` survives
  as a legacy hop for cached pages; it now just 302s to the fragment-tagged
  URL. Nothing to re-paste when she swaps accounts — only the toggle.
  Existing chats that haven't posted since the env vars were added are
  untagged; each thread has a "Claude account 1 · 2" picker (above Archive,
  `POST /api/chatfeed/account`) so Sophie can tag those with one tap. The hook
  re-stamps the tag on every post, so a manual tag and the env var must agree.
- **Sophie can reply in the app** (`POST /reply`, shows as `from:"sophie"`) — a
  chat picks up replies addressed to its chat name the next time Sophie messages
  it (`GET /api/chatfeed?limit=50`), then acts on them. **NOT on a timer.**
- **HER OWN MESSAGES are in the feed too (July 2026), so a thread reads as the
  conversation it was** instead of a monologue of Claude replies. The same hook
  posts them: it already fires on `UserPromptSubmit` (that firing used to only
  sweep up interrupted replies), and now also lifts her message out of the
  transcript and POSTs it to `/api/chatfeed/reply` as `from:"sophie"`, keyed by
  the transcript record's `uuid` so it can't double-post, carrying her real send
  time via the route's new optional `created` (so hers sorts ABOVE the reply it
  prompted). The app already rendered `from:"sophie"` as **"me"** in rose and
  excludes it from the unread dot, so no client change was needed.
  - **The machinery that also arrives as a "user" record is filtered out:**
    `isMeta` ("Continue from where you left off"), `<task-notification>` /
    `[SYSTEM NOTIFICATION …]`, `<github-webhook-activity>`, slash-command echoes
    (`<command-name>`, `<local-command-stdout>`), `[Request interrupted …]`, and
    the caveat preamble. `<system-reminder>` blocks are STRIPPED from her text
    rather than used to reject the message (they ride inside real messages).
  - First firing in a session **baselines her history and posts only her latest**,
    same policy as the reply poster, so installing it never floods a live feed.
  - State: `~/.claude/forge-user-<sid>.posted` (alongside the feed/gallery ones).
- **Naming a chat: the Chats app is the source of truth (July 2026).** Sophie
  renames a chat with the pencil in its thread header; that writes `displayName`
  on the registry doc and is the name she sees everywhere. **The Claude app's own
  session title cannot be synced** — nothing exposes a session's title to the
  outside and nothing can push a rename back into claude.ai (checked July 2026,
  no API and no MCP tool for it), so the two names are separate by necessity and
  hers wins. A chat reads what she calls it with
  `GET /api/chatfeed/name?chat=<slug>&session=<your session id>` →
  `{ chat, displayName, name }` — ALWAYS pass `session` (the
  `CLAUDE_CODE_REMOTE_SESSION_ID` without `cse_`): the returned `chat` is your
  EFFECTIVE slug (session-first — a fork or re-bound thread, not necessarily
  the branch slug), and that's the slug to use for pages, asset prompts,
  notes, and any other chat-keyed POST. Renaming is cosmetic and never re-keys
  a chat's history.
- **Gated pages must not be cached by the app.** `serveGated` sends
  `Cache-Control: no-cache, must-revalidate` — without it only an ETag shipped
  and the iOS app's WKWebView served a heuristically-cached copy, so a shipped
  page change (a moved button, a new tab) silently never reached her phone. This
  actually happened with the header fixes. Keep that header on any new HTML route.
- **Assets curation (♥/✕ + notes, July 2026):** Sophie hearts/rejects images
  in a chat's Assets tab (tiles AND the lightbox), and the lightbox has a note
  box (under the image) she can send per image. Votes + notes live in
  `forge-asset-votes` (deckfactory, one doc per chat+url) and ride along on
  `GET /api/gallery/assets?chat=<name>` as `vote: "like" | "dislike"` and
  `note` per asset. When Sophie next messages a chat, it should check its
  votes/notes and act on them (favor the hearted ones, re-roll the ✕'d and
  anything noted "redo") — same review-loop pattern as writing notes, NOT on
  a timer.
- **Notes are a THREAD — WRITE BACK on the image (July 2026).** A note is a
  two-way conversation on that picture: she writes from the lightbox, and **the
  chat that made the image replies on the image itself**. Deliberately snail
  mail — you answer when she next messages you, so a reply landing hours later
  is the expected rhythm, and there are still NO timers or self-check-ins.
  - **Read what's waiting:** `GET /api/gallery/assets/notes?chat=<name>` — only
    the images that have a thread, `waiting:"chat"` ones FIRST (she spoke last
    and nobody answered), each with its `thread:[{from:"sophie"|"chat", text,
    at}]`, the image's `description` label, and any `vote`/`done`. The full
    `GET /api/gallery/assets` carries `thread` + `waiting` + `unread` too.
  - **Reply:** `POST /api/gallery/assets/note`
    `{ chat, url, text, from:"chat" }` — appends one message (2000 chars max,
    over-length is REFUSED, never truncated). Answer what she asked, say what
    you changed, and name the new image's label if you re-rolled it.
  - **Check them in the same sweep as votes/prompts** whenever Sophie messages
    you: read the notes, do the work, then reply on each image you acted on.
    `done:true` (via the vote route) still marks one handled; her next message
    on that image reopens it automatically.
  - Legacy single `note` strings show up as a one-message thread from her, so
    old notes are never lost, and `note` keeps mirroring her LATEST ask for any
    older reader. Her tile shows a green count badge until she opens your reply.
- **Prompts on Assets images — POST THE PROMPT FOR EVERY IMAGE YOU MAKE (July
  2026).** Sophie taps **PROMPT** on an image in the Assets tab and the prompt
  covers the picture, with a **Style / Content** toggle (style left, content
  right). Nothing derives it — the chat that generated the image posts the two
  halves itself, because only it knows where the seam is:
  - **style** = the look: house-style/LoRA trigger word and its suffixes, medium,
    palette, rendering notes (`wtr watercolor drawing, loose wet-on-wet wash,
    visible paper grain`).
  - **content** = what is depicted: subject, action, setting, composition
    (`a woman in a yellow raincoat feeding crows on a park bench at dusk`).
  - **THE EXACT PROMPT, character for character — NEVER PARAPHRASE (Aug 2026,
    Sophie's rule).** Both halves are the literal text that was sent to the
    model: the content half verbatim, and the style half the real style
    prefix/suffix/character-consistency lines as sent (when the style is a
    wrapper around the content, mark the seam with `[content]`, and note any
    attached style-ref images + size/quality after it). Never a summary, a
    cleaned-up version, or a reconstruction from memory. If the exact text is
    not available (an older image, an unknown generator), file NOTHING — the
    PROMPT button stays hidden by design — or file `not available`; never
    fill the gap with a paraphrase.
  - `POST /api/gallery/assets/prompt` `{ chat, url, style, content }` — the
    image's Firebase Storage url, x-studio-token when gated. Do this for EVERY
    image deliverable, right after the image exists; it needs no gallery step
    first (post it before the Stop hook files the image and the hook's post
    converges onto the same record by url — never a second tile). Re-posting the
    same url overwrites that image's split, so a fixed prompt is one more POST.
    Sending only one side leaves the other alone; `""` clears a side. 1500 chars
    each. Batch many images in one call with
    `{ chat, items:[{url, style, content}, …] }` (per-item `ok`/`error` back).
  - Stored on the chat's `forge-chat-assets` doc as `promptStyle` /
    `promptContent`, returned by `GET /api/gallery/assets?chat=<name>` — so a
    chat can also READ back what it (or an earlier session) filed.
  - **Backfilling older images:** `node scripts/backfill-asset-prompts.js <chat>
    --list` prints every image in that tab with its label and whether a prompt is
    on file; then write a JSON array and post it with
    `node scripts/backfill-asset-prompts.js <chat> prompts.json [--dry-run]`.
    Each entry identifies its image by `"url"` (exact) or `"match"` (a substring
    of the url OR of the label shown in the app — easier, since a chat remembers
    what it called an image). `FORGE_BASE` overrides the server.
  - An image with no prompt on file shows **no PROMPT button at all** — never
    write "no prompt filed" anywhere; empty is silent by design.
  - These instructions live HERE only. There used to be a "How to post prompts"
    fold at the top of every Assets tab, but chats read this file, not that
    page — so it was clutter only Sophie ever saw, and it's been removed.
  - **The tab is PAGED and dedupes by filename (July 2026).**
    `GET /api/gallery/assets?chat=&limit=&offset=` returns `{assets, total,
    offset, limit}`; the app loads 150 and pulls the next page as she scrolls.
    It used to be a single capped request, which was a hard truncate — a chat
    past 300 images silently lost its OLDEST ones (never deleted, just never
    sent). **One picture can live at two storage paths** (where it was
    generated, e.g. `witch-school/assets/<id>.png`, and the copy the server
    makes when the same image is also sent as a file,
    `claude-deliveries/<id>.png`), so the union keys on the FILENAME, not the
    url: the copies collapse into one tile, every field is merged, the url kept
    is the one carrying the label/prompt, the others ride along as `alts`, and a
    ♥/note left on either path is still found.
  - **The Assets tab has a search bar** that filters the tiles as she types,
    matching an image's label, its model/quality caption, BOTH halves of its
    prompt, and every message in its note thread — so a filed prompt is what
    makes an image findable later. It stacks with the New/♥/Hide ✕ filter and
    runs client-side over the already-loaded tiles (no request per keystroke).
- **The `/chats` header reserves the pill's corner.** The autoscroll pill is
  `position:fixed` over the top-right (x 324–374, y 14–192 on an iPhone 13), so
  ANY header control reaching that corner is untappable — the rename pencil was,
  for real, until `.thread-head`/`.headbtns` got `padding-right:56px`. Keep that
  reservation on any new header row, and never place a control in that corner.
  **Archive/Unarchive lives in the thread header** (same button, same spot,
  either label) — deciding whether to archive must not mean scrolling past every
  message first. The **App/Web account toggle is a plain on/off switch** on the
  home header's title line (`.swi`, off = account 1, on = account 2, no text —
  the toast names the account).
- **Compare pages (July 2026) — publish comparison artifacts INTO the app, not
  as claude.ai artifacts.** When Sophie asks for a comparison sheet, options
  board, side-by-side, or any custom viewing page, POST it to
  `POST /api/chatfeed/page` with `{ "chat": "<your-chat-name>", "title": "…",
  "html": "<the full self-contained page>" }` (x-studio-token when gated;
  ~10MB body cap). It appears in your chat's **Compare** tab (Chat · Assets ·
  Compare) and opens full-screen in the app — that's where she'll look for it,
  next to your assets. Design the HTML however the comparison needs (mobile
  first, self-contained; image URLs from Firebase Storage are fine). The server
  auto-appends the shared autoscroll pill to every served page — do NOT add
  your own scroll pill.
  **ANY tap pauses the autoscroll (Aug 2026, Sophie's rule — every Compare
  page MUST have this).** While she's interacting with a page — voting,
  typing a name, tapping anything at all — the page must not keep creeping
  underneath her. Add this one line to every Compare page's script:
  `document.addEventListener('pointerdown', function(){ if(window.__scrollStop) window.__scrollStop(); }, true);`
  (capture phase, so it fires even when the tap lands on a button or form
  field; the pill's own play button starts scrolling again). This is on top
  of the existing image-lightbox rule below — opening an image still locks
  background scroll too. List your
  pages with `GET /api/chatfeed/pages?chat=<name>`; replace by DELETE
  `/api/chatfeed/page/:id` + re-post. Only fall back to a claude.ai artifact if
  the page genuinely can't work as plain HTML.
  **New VERSION of a deliverable = a NEW page, never an edit of the old one
  (Aug 2026, Sophie's rule — earned the hard way).** Deleting-and-reposting a
  page when the work changes made her lose track of what she was looking at,
  and re-pointing an old page at new media (or worse, overwriting the media
  file at the same URL — a cached copy then silently plays STALE content)
  made "which version is this?" unanswerable. So: every new cut/render/version
  gets a NEW page whose TITLE states the version and what it is ("Short 1 v4 —
  tightest cut"), pointing at NEW version-numbered media files; the old pages
  and files stay as history. DELETE+re-post is only for fixing a typo on the
  SAME version.
  **A page must NEVER post to `/api/chatfeed/reply`** (Aug 2026, Sophie's
  rule): notes she types on a Compare page are not chat messages and must stay
  on the page — use `POST /api/chatfeed/verdict { chat, sheet, item, text }`.
  The server enforces it: a /reply fired from inside a served page is rerouted
  onto the page's verdict doc (sheet `page-<id>`; read it back with
  `GET /api/chatfeed/verdict?chat=&sheet=page-<id>`), never into the thread.
  **Don't reach for a Compare page by default (Aug 2026, Sophie).** A routine
  options batch / small test set does NOT need one — the labeled Assets tiles
  are the review surface. Build a page only when Sophie asks for one or the
  set genuinely can't be reviewed as tiles. And when you DO build one, lay the
  images out in **rows of TWO**, never one full-width image per row.
- **NO recurring hourly self-check-ins / `send_later` loops (July 2026).** Do not
  set up a chat to wake itself every hour to poll for notes/replies/PRs — that
  pattern spread across chats and kept pinging Sophie, and it's been turned off.
  Only schedule a recurring wake-up if Sophie explicitly asks for one in that
  chat; otherwise pick things up when she next messages you.

## Card-deck art generator (Midjourney via APIFRAME)
- `apiframe.js` (`/api/apiframe`) generates the deck card art with **Midjourney**,
  which Sophie's original decks used. Midjourney has no official API, so this goes
  through **APIFRAME** (`APIFRAME_KEY`), which runs its *own* MJ accounts and
  exposes a REST API — no personal MJ account is involved or at risk. Base
  `https://api.apiframe.ai/v2`, `X-API-Key` header. **Gotcha:** APIFRAME sits
  behind Cloudflare bot-protection that 403s ("error code: 1010") any request
  without a browser `User-Agent`, so the module always sends one.
- **Routes:** `GET /status`; `POST /generate` (`{prompt}` or `{plant, style?}` +
  optional `aspectRatio` default `5:7`, `styleRef` = a public image URL used as a
  Midjourney `--sref` to lock Sophie's look) → `{jobId}`; `GET /job/:id` polls,
  and on `COMPLETED` mirrors the **4** MJ options to Firebase (MJ CDN URLs expire;
  `?save=0` to skip). `imagine()`/`job()` are exported helpers. STUDIO_TOKEN-gated.
- **No text in the prompt** — Midjourney is unreliable at spelling; the plant-name
  label is overlaid later in prep, not generated. Pricing: 16 credits per generate
  (=4 options), 4 per upscale; ~6–8¢/generate on a paid plan.
- Flow: generate (MJ) → pick 1 of 4 → label overlay + print prep → MPC fulfilment.
- **Bring-your-own-Midjourney** (`ingest.js`, `/api/ingest`, page at `/import`):
  the alternate art path — Sophie generates in her *own* MJ account and bulk-
  downloads keepers by keyword with a browser export tool (that step runs on her
  computer; the server can't automate MJ's download — no API, her account, needs
  a browser). This module automates everything after: `POST /upload`
  (`{batch, keyword?, images:[dataURL|url]}` → Firebase `ingest/<batch>/`, filename
  keyword-tagged), `POST /upload-zip?batch=&keyword=` (the raw .zip as the request
  body → unzips server-side and ingests every image, skipping `__MACOSX`/non-image
  junk — so a bulk MJ export uploads in one shot, phone or desktop),
  `GET /batch/:batch?keyword=` (list a batch, keyword = filename substring filter),
  `GET /batches`. The `/import` page (serveGated) is a phone/desktop uploader
  (individual images or a whole ZIP). Batches feed the same review → prep → MPC flow. Trade-off vs
  APIFRAME: own-account is cheaper (flat MJ sub, exact personal style) but manual +
  computer-bound; APIFRAME is fully cloud-automated (~7¢/img). Claude reviewing a
  batch and picking the on-style option is the shared payoff of both paths.
  - **`browser-extension/`** (Chrome MV3, "Send to Deck Factory") kills the
    export/import friction: a floating button on midjourney.com grabs the page's
    MJ images and POSTs them straight to `/api/ingest/upload` (runs in Sophie's
    own logged-in session — no MJ password, no server-side MJ automation). Load
    unpacked; set the app URL + STUDIO_TOKEN + batch/keyword in the popup. The
    image-grab (`collectMidjourneyImageUrls`/`toFullRes` in `content.js`) needs a
    first-run calibration pass against MJ's live DOM (it logs what it finds).

## Movies (the newest medium — iOS is the frontend)
- **Making one of Sophie's concept videos? Read
  `docs/movies/sophies-movie-pipeline.md` FIRST** — her own recorded
  instructions (Aug 2026): voiceover aligned via the NDE precise cutter,
  images in pastel variant V2 at 2:3 portrait, and her literal-image →
  metaphorical-image formula with animation between the two panels.
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
- **Style reference:** `refs/movie-style.jpg` (Sophie's hand-drawn diary-comic
  page, never web-served). When present, EVERY panel renders via gpt-image-2's
  **edits** endpoint with it attached as a pure STYLE reference (prefix insists
  style only — never content/subjects/composition). `MOVIE_STYLE_REF=0`
  disables; without the file, panels fall back to the text `imageStyle` lock.
- **Character anchor** (OpenAI cookbook technique — fixes wardrobe drift): the
  breakdown marks ~3 `key` scenes; the app's character-first flow renders just
  those, then `POST /:id/anchor {sceneId}` locks one panel as the character's
  definitive look. Every later render (panels, grids, zine pages) attaches the
  anchor as an extra `image[]` reference with the preserve-list restated
  ("same face, hairstyle, clothing … Do not redesign the character"). The
  breakdown's `characters` tokens must include hair + face + exact outfit.
  `panelQuality` on the movie (set at creation via the app's Storyboard menu)
  is the default for all panel renders. Validated live: checkered flannel held
  across scenes.
- **Gallery:** re-rolls are never lost — superseded generations go to
  `scene.panelHistory`/`clipHistory` (capped 12, each with `promptUsed`); every
  stitch is kept in `movie.cuts[]`, auto-named by diffing edits/sequence vs the
  previous cut ("trimmed sc 3, slowed sc 7"), with an ordered `frames[]`
  snapshot the iOS Gallery renders as a comic-panel contact sheet.
- **Quick animate:** `POST /api/movies/animate` — one image (data URL) → one
  wan clip, default **720p** (~$0.16); its own polled docs in `forge-quick`
  (`GET /quick`, `GET/DELETE /quick/:id`). Home-screen "Animate one image" in
  the app.
- **The zine:** `POST /api/movies/:id/zine` — the same scenes as a printed
  medium: a hand-lettered cover + one captioned 2x2 page per four scenes
  (captions = scene titles, rendered in the style reference's own lettering;
  validated live — text spells exactly at medium). ~$0.06/page. Lands in
  `movie.zine` (prior zines in `zineHistory`, capped 3). Lulu print step is
  the planned follow-up (`lulu.js` keys are live; a 32-page standard-color
  uncoated paperback ≈ $3.40/copy, saddle-stitch premium ≈ $4.34-7.11).
- **Dreams (dream → comic), v2 STAGED pipeline (July 2026):** the
  dream-illustration path, rebuilt around user approval BETWEEN cheap stages
  (Sophie approves order + characters before anything paid runs). **Stage 1 —
  `POST /api/movies/dream`** runs `dreamSplit()`: ONLY splits the recording
  into its distinct dreams (boundary cues — "that was that dream", "the next
  dream"), each `{title, text (verbatim slice), driftCues (out-of-order
  phrases, exact substrings to highlight), mentions (people, "me" first)}` —
  NO beats, NO image descriptions. Runs `DREAM_BREAKDOWN_MODEL` (default
  `gpt-5.6-sol`; a `claude-*` id routes via Anthropic, NO silent fallback) at
  `DREAM_SPLIT_EFFORT` (default `none` — validated: still splits/orders
  right, ~18s vs ~60s). Each split dream doc also gets `castSuggestions`:
  every mention looked up in the saved character sheet via
  `character.js:matchCandidates` — ALL plausible candidates per name (an
  ambiguous "Jonathan" returns both Jonathans; unmatched "Miriam" returns
  `[]` → the UI shows a blank describe-them card). **Stage 2 — approval in
  the app:** "is this the order of your dreams?" (▲▼ moves WHOLE dreams;
  persisted via `POST /dream/reorder {ids}` which re-staggers `createdAt`)
  and "are these the characters?" (pick a candidate / unpick = not them /
  type a description). **Stage 3 — `POST /dream/:id/render {quality,
  characters:[{name, url|image|desc}]}`:** `dreamPaginate()` lets the model
  decide how many IMAGES the dream needs (1-8, never padded) and allots each
  image a verbatim slice of the dreamer's words in TRUE chronological order
  (drift cues fix the narration order); then `makeDreamPagesV2` draws
  sequentially — each page gets the style ref FIRST, then ONLY that slot's
  approved character cards (image refs; desc-only people ride as text
  continuity lines), then up to 3 already-drawn earlier pages
  (`dreamPageRefs` — a face is carried from the page it first appeared on),
  plus the whole dream for context and "THIS page tells ONLY this part".
  **The model decides each page's layout** (single drawing or panels — no
  fixed 2x2). Pages store `{url, promptUsed, text, who}`; plan kept on
  `dream.pagePlan`. ~$0.06/page medium. Legacy beat docs still render
  through the old `makeDreamPages` 2x2 path (`order:[beatId]` still
  honored). Own polled docs (`GET /dream`, `GET/DELETE /dream/:id`,
  `GET /dream-batch/:id` for the background read), background job on the
  doc, `pageHistory` capped 3, separate `forge-dreams` collection.
  **Render survives leaving the app:** fire-and-forget server job; iOS
  `DreamsView` records rendering ids in `@AppStorage("dreams.activeRenderIDs")`
  and resumes polling on return; transient poll failures retry (phone locked /
  Render cold start) — only a real job error surfaces.
  **A gpt-image-2 SAFETY REFUSAL is terminal, never a retry (Aug 2026).** The
  filter refuses ordinary dream content — the "Mommy Evaluates Kid" render died
  on a breastfeeding line, flagged `safety_violations=[sexual]`. A refusal is
  deterministic, so retrying it is waste: that render burned 9 API calls over
  ~65s of backoff and reported "3 rounds of retries", which reads like a network
  fault. Now `isSafetyRefusal()` short-circuits every retry ladder
  (`openaiPanel`, `openaiPanelEdit`, `drawPagesResilient`'s rounds), and the page
  gets redrawn with its NARRATIVE softened — `softenRefusedNarrative`
  (gpt-4o-mini) rewords only the page's slice of the dream, its captions and the
  context line, and the structural half of the prompt (style ref, continuity
  clauses, attachment numbering) is rebuilt untouched around it, so softening
  can't scramble the references. **Rewording Sophie's own sentences to get past
  the filter is allowed — she asked for it (2026-08-06).** A page that lands
  softened is marked `softened:true`. Softening escalates over TWO passes (pass 2
  rewrites pass 1's output), then gives up with a plain reason instead of a retry
  count. Refused requests are rejected before generation and cost nothing, so the
  extra pass only ever spends a few seconds.
  **`SOFTEN_SYSTEM` is empirically calibrated — don't reword it casually.**
  Probed live against the filter on the refused page (2026-08-06): `feed it milk
  from her breasts`, `breastfeed the baby` and even the VAGUER `feed it milk from
  her body` are all REFUSED; `nurse the baby`, `feed the baby` and `hold the baby
  close and feed it` are ACCEPTED. So being vaguer does not help and euphemism is
  the wrong move — the first version of the prompt said "rephrase only what is
  likely to trip it" and the model produced "from her body", which was refused
  again. The prompt now tells it to REFRAME THE ACTION in ordinary everyday
  verbs, with that worked example baked in; verified end-to-end (pass 1 →
  "Then she went to nurse the baby." → page drawn).
  Tests: `node scripts/test-dream-refusal.js`.
  **The page must not re-render while she scrolls.** `dreams.html` polls every
  3.2s during a render and used to call `render()` each tick, reassigning
  `root.innerHTML` — which re-decodes every image and drops scroll position.
  Scrolling "Past dreams" during a render therefore flickered and jumped to the
  top (her report, 2026-08-06; renderArchive's own comment already warned that
  rebuilding "re-decoded every image"). `liveUpdate()` now patches the status
  line and APPENDS newly-landed pages instead, and returns early when she's on
  the archive/zine tab so a background render never touches the view she's
  reading. Tests: `node scripts/test-dreams-scroll.js` (headless Chromium;
  playwright is an optionalDependency, the script skips without it). Characters keep their
  ORIGINAL backgrounds (the transparent cleanBox step was removed by request
  — background separation only matters if a character is composited later).
  Same `STUDIO_TOKEN` gate. iOS is the frontend; a web page port of the new
  flow is planned to follow the TestFlight build.

## Songs (phone recording → real song, keeping the real voice)
- `songs.js` (`/api/songs`, page at `/song`) — Sophie sings a made-up song into
  her phone; out comes a produced track with HER actual voice (built because
  Suno-style covers replace the singer). Pipeline: **resemble-enhance**
  (Replicate, `denoise_flag:true`) strips background noise + restores the vocal
  → **meta/musicgen** `stereo-melody-large` writes an instrumental that follows
  the cleaned vocal's melody (`input_audio` conditioning, `continuation:false`)
  → **ffmpeg** mixes voice over instrumental (adjustable gains, `loudnorm` to
  -14 LUFS) into a 192k mp3. Version hashes pinned in `AUDIO_MODELS`.
- MusicGen holds a melody for ~30s, so longer recordings are cut into ≤30s
  chunks, generated with ONE shared seed (cohesion), padded/trimmed back to
  exact chunk length (`conformChunk` — keeps sync with the voice), and joined.
  Max 4 minutes (`MAX_SONG_SECONDS`); ~$0.11 per 30s chunk + ~$0.03 enhance.
- Uploads arrive as data URLs, are transcoded to mono 44.1k WAV first
  (`toWav` — voice memos are m4a, browser recordings webm), and Firebase
  Storage is REQUIRED (Replicate must fetch the audio by URL). The style
  prompt always gets `STYLE_SUFFIX` ("instrumental backing track, no vocals")
  or MusicGen sings its own oohs.
- Re-mix (gains) is free ffmpeg; re-rolling the instrumental with a new style
  re-runs only MusicGen + mix. Old mixes go to `mixHistory` (capped 12).
- State: movies.js pattern — one Firestore doc per song (`forge-songs`),
  background jobs recorded in the doc, clients poll `GET /api/songs/:id`. Same
  `STUDIO_TOKEN` gate (only `GET /status` open); `/song` served via
  `serveGated` like `/photo`.

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
- **A/B testing note (July 2026 research):** Etsy has NO native split test, and
  changing tags/title on a live listing resets its ranking clock (7–14 days to
  restabilize, 30–90 to fully re-rank). The safe method is a **duplicate
  listing** — copy A into B, change ONE thing, keep enough else different that
  it isn't a policy-violating duplicate, and run both 2+ weeks. Baseline the
  original for a week first.

## The Dump (`dropbox.js`) — one inbox for anything off the phone
- `dropbox.js` (`/api/drop`) is the generalized drop box the crystal box grew
  into: **dump first, label afterwards**. Dropping asks no questions — no type,
  no name, no fields. Only two pieces of structure are captured at dump time,
  because they're free then and expensive to reconstruct later: the **bundle**
  (what arrived together — on the phone a Photos ALBUM, in a zip a folder, from
  the share sheet one share action) and the **session** (the dump, date-stamped).
  `track` (`crystals` / `story-art` / …) is deliberately null on arrival.
- **One Firestore doc per FILE** (`forge-drops`, deckfactory), plus one doc per
  album in `forge-drop-bundles` holding its number, name and file counter.
  Images and videos both (videos get a poster frame).
- **A bundle is keyed by its slug ACROSS dumps** — an album is one thing however
  many times it's sent to. **Re-dumping an album fills its gaps** instead of
  forking a second copy: files are keyed by the **md5 of their bytes** and an
  arrival already in that album is skipped (`duplicate:true`, counted as
  `skipped` in the response). Filenames can't be used for this — the iOS
  uploader names every export `UUID() + originalFilename`, so the same photo
  sent twice arrives under two different names.
- **Bytes are stored once**, content-addressed at `drops/_/<hash>.<ext>` — the
  same photo in two albums is ONE object with two entries pointing at it, like
  Photos. `dropDoc` only deletes bytes when no other doc references the hash.
- **`photoIndex` comes from a transaction** on the bundle doc. It used to be
  derived by counting the album on each request, and the app uploads several
  files at once, so concurrent uploads got the SAME index — album order came out
  scrambled and the holes looked like missing files. Never diagnose "missing
  photos" from index gaps in data dumped before 2026-07-28.
- **`scripts/drop-dedupe.js`** repairs existing data (hashes from Storage
  metadata — no downloads — then removes in-album duplicates, renumbers, seeds
  the registry). `--dry-run` prints the plan. Ran once on 2026-07-28: 2,717
  files → 2,594, 123 exact duplicates removed (~327 MB), 58 albums renumbered.
- **iOS is the main way in:** `ios/ImageForge/DumpUploader.swift` (in-app album
  picker — the share sheet can't see album names, so it's the right tool for a
  pile of named albums) with a background `URLSession` that survives leaving the
  app, plus the `DumpShare` share extension. Routes: `GET /sessions`,
  `GET /bundles?session=`, `GET /items`, `POST /upload` (data URLs),
  `POST /upload-file` (raw body — the iOS path), `POST /upload-zip`,
  `PATCH /bundle` (label a whole album at once), `DELETE /items/:id`.

## Voice Memos — ONE library, every path files into it (Aug 2026)
- **The library** = membry Storage `memo-audio/<id>.m4a` + `manifest.json`
  (`memos.js`, `/api/memos`) — the stamped 1100+ recording archive. Every way
  audio arrives now funnels into it through `memos.fileIntoArchive()`: the
  Mac push (`scripts/push-memos.mjs`), the iOS share sheet / audio drop
  (`audio.js` auto-files each new recording, keeping its own `forge-audio`
  doc with `memoId` as the reference), Story Room voiceover pastes
  (recordings only — TTS renders stay out), and a chat with a pasted file.
- **A chat files a pasted recording with ONE call — never reconstruct the
  stamp by hand:** `POST /api/memos/ingest?title=…&dur=…&ext=m4a` with the
  raw bytes as the body. `stamp` is optional; without it the server derives
  one from the file's internal clock and the **md5 of the bytes** does the
  real deduping (every manifest record carries `hash`). The internal clock
  is the moment recording STOPPED, which is why hand-built stamps went wrong
  (2026-08-05: filed `_1330`, her phone said 1:28) — don't guess it.
- **Transcription is UNCONDITIONAL** (Sophie 2026-08-05) — no toggles;
  `transcribe=0` params are ignored everywhere. Bank first, enrich after: a
  Whisper failure files the audio with `enrichError` on the record instead
  of losing the recording.
- Dedupe is belt and braces: hash match always skips; a caller-supplied
  (trusted) stamp match skips; a server-derived stamp never skips on its own
  and gets a hash suffix in the id so two same-minute recordings can't
  collide. `GET /api/memos/status` returns `stamps` + `hashes`.
- One-time repairs (both ran 2026-08-05): `scripts/memo-unify-backfill.js`
  — phase A stamped `hash` onto existing records from Storage md5 metadata,
  phase B merged strays from `forge-audio` into the archive.

## Audio drop (`audio.js`) — recordings off the phone → permanent URLs
- `audio.js` (`/api/audio`, page at `/audio`) is the generic destination for
  audio. Nothing else did that job: `/api/story/voiceover` attaches ONE
  recording to ONE story, `/api/songs` runs the whole song pipeline,
  `/api/memos` files into the stamped 993-memo archive (and costs money per
  file), and the Dump takes images + video only. A folder of recordings in the
  Files app had nowhere to go.
- **The iOS Share sheet IS a way in (Aug 2026).** `DumpShare` activates for
  files too and routes audio extensions here (`POST /upload-file`, one
  date-stamped batch per share). The sheet's old "Transcribe the recordings"
  toggle is now a NO-OP — the server transcribes every recording
  unconditionally and also files it into the Voice Memo library (see the
  section above); over-25MB files record a clear error on the doc. Uploads are a BACKGROUND URLSession via the
  `group.com.sageryza.imageforge` App Group — the sheet stages files in the
  shared container, queues the tasks, and dismisses; fire-and-forget, the md5
  dedupe means re-sharing heals a lost upload. Other ways in: the `/audio`
  page's file picker, or Voice Memos → Share → Copy → Story Room's "Paste a
  recording" when it belongs to one story.
- **Dump first, label afterwards** (same as the Dump): uploading asks only for a
  batch name, defaulted to the date. `name` (from the filename), `notes`,
  `tags`, `track` are all fillable later, from the page or by a chat.
- **Files are keyed by the md5 of their bytes**, so re-sending a batch after a
  dropped connection tops it up instead of doubling it (`duplicate:true`).
  `seq` comes from a **transaction** on the batch doc, never from counting the
  collection — that's the bug that scrambled album order in `dropbox.js`.
- One Firestore doc per recording (`forge-audio`, deckfactory), bytes at
  `audio/<batch>/<NN>-<name>.<ext>` — a readable path, because these urls get
  pasted into other tools by hand. `seconds` comes from ffprobe (best-effort;
  no binary just leaves the field null). Public url = what every downstream
  step wants: an Episode Editor source, a Story Room voiceover, `/api/nde`'s
  from-video ingest, a chat that needs to hear it.
- **Routes:** `GET /status` (open), `GET /batches`, `GET /items?batch=&track=`,
  `GET /items/:id`, **`POST /upload-file?batch=&filename=&name=`** (ONE file as
  the RAW body — no base64 inflation, and XHR reports real progress on a phone),
  `POST /upload` `{batch, files:[{audio:dataURL|url, filename?, name?}]}` (the
  chat path), `PATCH /items/:id`, `DELETE /items/:id`. Same `STUDIO_TOKEN` gate.
- PATCH writes are whitelisted to `EDITABLE`; url/storagePath/hash/bytes/
  seconds/createdAt are server-owned. Queries use one equality filter and sort
  in memory, so there's no composite index to set up.
- The page uploads **one file at a time** (a phone uplink shared eight ways just
  makes them all slow) and the transfer is foreground — leaving the page stops
  it. Transcription is deliberately NOT wired in; a recording's words come from
  whichever pipeline claims it.

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
  converters). gpt-4o-mini writes a short advice section (`?advice=0` skips).
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
  difficulty + a pillar/cluster shape, gpt-4o-mini) → `POST /draft` (full post:
  title/meta/slug/tags/HTML body/FAQ/image prompts, ~900 words, gpt-4o-mini) →
  `POST /image` (gpt-image-2 → permanent Firebase webp URL) → `POST /publish`
  (reuses `shopify.publishArticle`; hidden draft or live). Generation endpoints
  are stateless; drafts best-effort persist to Firestore (`forge-blog`) for a
  "recent drafts" list (`GET /posts`, `GET /:id`, `DELETE /:id`). Same
  `STUDIO_TOKEN` gate; `/blog` served via `serveGated`.

## Sticker Day (self-care sheet — `/selfcare`)
- `public/selfcare.html` (page at `/selfcare`, **ungated/public** like `/witch`) —
  seven small acts of self care a day, each one a **sticker**. An un-earned task
  shows only as a flat grey **silhouette**; tapping it (= "I did this") peels the
  sticker on in colour AND opens a bottom sheet revealing the art big with a
  **mini lesson** on why it matters. Tapping an earned sticker reopens the
  lesson; **undo lives in that sheet**, so a mis-tap is never permanent.
- **The day's set:** 5 basics every day (water, food, movement, outside, sleep)
  + 2 extras stepping deterministically through a pool of 12 (`setFor(iso)` —
  days-since-epoch × 2), so the sheet changes daily and exhausts the pool before
  repeating. All 7 done → the sheet gets a stamp. **Book** tab = every past
  sheet + how many distinct stickers have been discovered.
- **State is `localStorage` only** (`selfcare_sticker_book`, `{days:{iso:{set,
  done}}}`). Nothing leaves the phone — which is why the page is ungated. Past
  days store their own `set`, so a rendered old sheet is what it actually was.
- **Tasks and packs are SEPARATE** in `public/selfcare-stickers.json`: `tasks`
  = name + mini lesson; `packs.<id>.art.<taskId>.img` = the picture. **A new
  sticker pack is a new art set over the same tasks, so it ships as pure data —
  no app change.** Any task a pack has no art for falls back to the placeholder
  shape drawn inline in `selfcare.html` (`ART`).
- **The silhouette is the SAME PNG, CSS-masked** (`[data-done="0"] .pic::after`,
  `mask-image:var(--u)` + flat `--ghost`), so the shape you see always matches
  the sticker you get exactly. This is why sticker art **must be a transparent
  die-cut PNG** — any background left on it masks as a grey rectangle instead of
  the sticker's outline.
- **Art pipeline: `scripts/selfcare-stickers.js`** — the Witch School look
  (gpt-image-2 edits against `storage:witch-school/refs/style-*.png`, same as
  `witch-school-cards.js`) so stickers and lesson cards read as one set, then
  **background-remover (Replicate) → alpha-trim → upload** to
  `selfcare/stickers/<pack>/<id>.png` (raws kept under `_raw/`). The prompt bans
  cast shadows/surfaces/frames — they survive the cut and read as grime round
  the edge — and the alpha trim + square re-pad is what keeps every sticker the
  same visual size in its tile. Writes the manifest after EVERY sticker, so a
  crash keeps what landed. `--only a,b` / `--force` / `--pack` / `--dry-run`
  (prints cost first). ~$0.042 each, ~$0.71 for all 17.
- **Lesson voice:** aimed at what people don't know, not encouragement (pasta is
  carbohydrate and doesn't rebuild you; the 8-glasses rule came from a misread
  1945 report; light through a window doesn't set your body clock). Same voice
  rules as Witch School — no therapy-speak, aspirational not consoling.
- **Open by design:** how sticker **packs** get unlocked (earned per finished
  sheet? a few new ones a day?) is Sophie's call and is NOT built — only the
  data structure for it is.
- **Finishing all 7 plays the celebration** — a unicorn cantering over a flat
  pastel rainbow (`celebrate()`, SVG `animateMotion`, ~2.8s). Bands are
  concentric solid-stroke arcs, NOT a gradient. It only fires on the tap that
  completes the sheet (`updateProgress(true)`), never on page load, so
  re-opening a finished day doesn't replay it.

### Memory Passport (3rd tab of `/selfcare`)
- **Four stamps a day** — small things that happened. Each is a postage stamp:
  white scalloped paper with a picture inside. Tap an empty slot → the picker.
- **The scalloped edge is drawn by the PAGE, not the model** (`stampSVG()` —
  a square path with circles centred ON each edge punched out via
  `fill-rule="evenodd"`). A model draws a scallop differently every time and
  the point of a stamp is that the frame is identical on all of them. So the
  generated art is only the square INSIDE, and the prompt bans borders/frames.
- **Two ways to fill a slot:**
  - **Free library** — 20 pre-drawn generic moments ("someone gave me a
    compliment", "I got myself a treat"), `public/selfcare-stamps.json`, built
    by `scripts/selfcare-stamps.js` (~$0.28 for all 20). Each sits on its OWN
    flat pastel background colour so a page reads as a set, not one card
    repeated. Reached from the **grey rounded-square button top-right in the
    header** — deliberately above the passport page, never on it.
  - **Draw your own** (the paid feature) — type a moment → `selfcare.js`
    (`/api/selfcare`, PUBLIC, mounted in server.js) draws it with gpt-image-2
    at **`quality:'low'`** (~1¢) in the same house line style but pastel.
    **NOTE: there is no billing wired up** — the UI distinguishes free vs own,
    but nothing actually checks for a subscription yet.
- **Background job, always** (house rule): `POST /api/selfcare/stamp` returns
  an id in ~0.2s, the client stores it in `localStorage` and RESUMES polling on
  return, so leaving the app can't lose a stamp already paid for. State in
  Firestore `forge-selfcare-stamps`; `GET /api/selfcare/stamp/:id` polls.
- **The endpoint is public and spends money**, so it is rate-limited per IP
  (20/hour) behind the app's own 4-a-day rule. Worth revisiting if the page
  ever gets real traffic.
- **A stamp landing plays a stick sound** — synthesised with WebAudio (filtered
  noise burst over a low thud), so there's no audio file to load. iOS only
  allows audio after a gesture, so the context is unlocked on the first tap.
- **Everything is `localStorage`** except the generated images: the moment TEXT
  is sent to OpenAI and the resulting picture lives in public Storage. That is
  a real change from the stickers half, where nothing leaves the phone.
- **Display copies:** `scripts/selfcare-thumbs.js` makes a 512px webp
  (`thumb`) of every sticker/stamp/asset and writes it beside `img` in both
  manifests. The originals are 400–700KB each and the library shows twenty at
  once — serving them raw was ~26MB of page weight. The page uses `thumb` and
  keeps `img` as the untouched full-res original. Costs nothing to re-run.

## Secretly a Witch (public witchy app)
- **School + quiz art is served as WEBP, never the PNG originals (Aug 2026).**
  `SW_IMG` points at `witch-school/webp/` and every reference goes through
  `SW_EXT`, never a hard-coded `.png`; `QZ_IMG` is the SAME folder (the `qz-*`
  quiz cards have always lived in `witch-school/assets/` — `witch-quiz/assets/`
  is the videos). The lesson preload waits for the School tab instead of firing
  at boot on the Home screen. **Anyone adding or replacing cards must run
  `node scripts/webp-assets.js` and then `node scripts/webp-assets-verify.js`
  BEFORE deploying** — see the image-weight rule under Design rules.
- **The loading animation is CUT OUT — `/hoonie-loading-clear.gif` (Aug 2026,
  Sophie).** Every loading spot in the app sits on cream (`--bg #f5efe2`,
  `--surface #fffbf3`, `--panel #efe6d3`), so the old `hoonie-loading.gif`'s
  white square showed as a visible box. The clear one is the same hoonies with
  the paper removed — transparent background, 70 drawings, 240px, 278KB (the
  old one: 45 drawings, 360px, 865KB). Both files stay in `public/`; the old
  one is still what iOS bundles (`TestStationView` deliberately puts
  `Color.white` behind it). Rebuild either from a folder of hoonies with
  `python3 scripts/hoonie-cutouts.py <dir> --gif public/hoonie-loading-clear.gif
  --size 240 --pad 16 --max 70` (needs `pip3 install Pillow numpy`); the same
  script writes the transparent PNG cutouts with `--out`. GIF transparency is
  1-bit, so the ink keeps a short gray ramp that stops short of white — a pale
  antialiased edge would read as a halo on a dark surface.
- **The hoonies themselves live in the Dump**, album **hoonies** (#228, 140
  drawings — woodcut smallies, many of them two things grown into each other).
  Cutouts at Storage `hoonies/cutouts/<nnn>.png`, 210px webp thumbs at
  `hoonies/thumb/`. As a gpt-image-2 style reference they transfer well with
  the refs attached and **NO written style description** (same finding as
  `docs/evan-film-style.md`) — adding an engraving description pulls the line
  finer and more modern, away from their blunt woodcut feel.
- **Witch School lessons: the complete creation workflow is documented in
  `docs/witch-school-lessons.md`** — read it BEFORE writing a lesson so new
  lessons match the 14 live ones (voice, research pass, illustration pipeline
  via `scripts/witch-school-cards.js`, per-card sampled backgrounds, wiring,
  tests). Sophie's style refs live at `storage:witch-school/refs/style-*.png`.
- `public/witch.html` (page at `/witch`, **ungated/public**) is a mobile-first,
  single-page app with a **fixed bottom nav** (Lucide icons). Its own dark
  mystical theme (inline, not `forge.css`). Reuses the open `/api/generate/*`
  endpoints + a small set of stateless AI endpoints in `server.js`:
  `POST /api/witch/{tarot,spell,familiar,horoscope}` (all `openaiChat`,
  `gpt-4o-mini`; `parseJsonReply` helper strips fences).
- **The blog is a real NAVIGATION out of the app page, and the tab re-assert
  must not follow it (Aug 2026 — this bug made the blog unreachable in the
  app: tapping "The blog" bounced to Home instantly).** In the iOS app the
  witch page and the blog share ONE web view, so opening `/blog?app=1`
  replaces the app. The blog page therefore installs its own `window.__setTab`
  shim (`blog-public.js`) that answers the native tab bar by navigating BACK
  into the app — but `WitchWebView`'s `didFinish` also re-asserts the current
  tab on every load, to keep bar and page in step after a reload. That
  re-assert fired the moment the blog finished loading and the shim did what it
  was told: straight back to Home. Fixed on BOTH sides, and both are load-
  bearing — `didFinish` now re-asserts only on the app page (`isAppPage`,
  path `/witch`), and the shim ignores the first call inside a 2s grace window
  (a finger can't beat the page's own load event) so ALREADY-INSTALLED builds
  are fixed by a Render deploy alone. A tab tap from a blog page still works:
  it arrives via `updateUIView`, not `didFinish`. Anything else the app ever
  navigates to in that web view needs the same treatment.
- **Five tabs** (Book of Miracles is locked as the **2nd** icon by request):
  - **Today** — computed **moon phase** (synodic calc from a fixed new-moon
    epoch, client-side), a deterministic **Card of the Day** (per-day hash into
    a full 78-card deck built in JS: 22 majors w/ up/rev meanings + 56 minors by
    suit×rank), an optional AI reflection, a daily **intention**, and a
    **moon calendar** (month grid, glyph per day, new/full highlighted).
  - **Miracles** — the Little Book of Miracles ported in full (capture/imagine →
    illustrated pages → read view). Shares `localStorage['imageforge_miracles_book']`
    with `/book`.
  - **Tarot** — 1 / three-card / yes-no draws + AI reading; **save readings** to
    `localStorage['witch_saved_readings']`.
  - **Conjure** — spell/ritual maker (**save to grimoire**,
    `localStorage['witch_grimoire']`), name-your-familiar, and a charm image
    maker over the house LoRA styles.
  - **More** — daily horoscope, Watch/Shop/Follow tiles, About.
- **Synchronicities order by SLOT, not by timestamp (Aug 2026).** A day's
  coincidences in the Book of Shadows read in the order Sophie WROTE them —
  Home's three boxes are slots 0-1-2, anything added later from inside the book
  takes 3, 4, … Timestamps record when each DRAWING finished and disagree
  constantly (a box typed first can be drawn hours later; a redraw restamps its
  entry), which is what had 24 July reading box 1, 0, 2 in the book while Home
  showed 0, 1, 2. `syncSlotOf()` reads the slot off the archive id
  (`coin_<day>_<i>`) or an explicit `slot` field. `newestFirst` now reverses the
  DAYS only — inside a day the order never flips.
- **Moments can be added from inside the book, not just Home (Aug 2026).** An
  empty cell on a Synchronicities page IS a Home coincidence box — same square,
  same border, same place in the grid, contenteditable, with "Draw it!" under it
  where the caption goes. NOT a dashed placeholder and NOT an "Add a moment"
  label (both shipped once and Sophie rejected them: "go look at what it looks
  like on the home screen"). A day that exactly fills a page turns onto a fresh
  blank page of four more boxes, the way paper does. Two gotchas: the book
  stage's tap-to-turn handler must skip `[contenteditable="true"]` or a tap into
  the box turns the page instead of focusing it, and text typed but not yet
  drawn lives in `syncDrafts` so a repaint can't eat it. The pending job lives
  in `witch_sync_jobs`
  (localStorage, deliberately NOT cloud-synced — a half-finished draw is one
  device's business); `resumeSyncJobs()` picks it up on return, same as the Home
  boxes. A moment added to an old day is stamped at that day's noon so it can't
  hijack "the newest page".
- **Writing a page happens ON A LEAF, never in a pop-up (Aug 2026, Sophie).**
  "Add to your book" turns the book to a blank writing leaf at the BACK (last
  page, so no existing page number moves and the contents is untouched) —
  date eyebrow, an **illuminated capital** opening the heading, the type
  picker set in the book's serif, then the paper you write on. The leaf is a
  real page of `bosPages()` (`{page:'write'}`), pushed only while `bosWriting`
  is set; turn away with nothing written and it's gone the way an unwritten
  page is, turn away WITH writing and it stays at the back so nothing typed
  can be lost (the draft lives in `bosWriteDraft`, same contract as
  `syncDrafts`). A tap on the leaf never turns the page — only the arrows do.
  Saving lands on the page the entry is actually on; "how did it turn out?"
  is the same leaf and lands back on the spell. The illuminated cap is one
  inline vine path mirrored into four corners inside its OWN `<svg>` — never
  a `<use>` of `#bos-corner`, which lives in a tab that can be `display:none`.
- **The book shows a moment in HER OWN WORDS, three lines (Aug 2026).** The
  short AI label is the HOME screen's caption; on a book page (two columns, room
  to spare) showing only the label threw most of what she wrote away. The cap is
  `-webkit-line-clamp: 3` over `desc`, and `more…` is appended AFTER layout only
  where the clamp really cut the text — and OUTSIDE the cap, since a
  line-clamp box clips anything following the clamped text. `more…` is not
  underlined.
- **A saved bookmark can carry a word to its left** (`.bm-save.has-lbl` +
  `.bm-lbl`, hidden until `.filled`) — the tarot one says "see in book", so the
  second tap (jump to the page in the book) isn't a secret. Opt-in per bookmark:
  only markup that includes the span gets one.
- **No "A gentle nudge" advice box on tarot readings (Aug 2026, Sophie).** The
  reading ends on the reading. Removed from the saved-reading render and the
  Ask-the-cards result, and from both server tarot prompts. Old saved readings
  still carry an `advice` string on the doc; it is simply not rendered.
- **The Shop tab sells IN the app (July 2026):** product bottom-sheet →
  cart → hand off to Shopify checkout only for the pay screen. Storefront
  API via server proxy — `GET /api/witch/shop/product/:handle`,
  `GET /api/witch/cart?id=`, `POST /api/witch/cart/{add,update}` (public
  storefront token, committed by design; `WITCH_STOREFRONT_TOKEN` overrides).
  Cart id in `localStorage['witch_cart_id']`; expired carts recreate quietly.
- **External links** live in a `LINKS` const at the top of the client script.
  Shop = `cod-god-inc.myshopify.com` (the store's permanent home —
  `secretlyawitch.com` itself now points at the app), Instagram =
  `@moonsickbaby`. **Watch =
  YouTube is still a placeholder search** — the channel URL isn't stored anywhere
  (the YouTube token is upload-only scope and can't read the channel), so it
  needs Sophie's `@handle` pasted in.

## Design rules (forever)
- **Headers: a WEB-WRAPPED tool's PAGE owns its header (Aug 2026 v2, Sophie's
  decision — REVERSES the earlier "forgeToolBar on every tool root" rule for
  web tools).** For any tool that is a WKWebView on a served page, the header
  is built in the page's own HTML/CSS (the Chats/Writing Room pattern), NOT a
  native SwiftUI bar. Two reasons, both Sophie's: full design control (the
  rename pencil, Archive, tabs, toggles, search — none of it fits a native
  bar) and shipping speed (a page header changes with a Render deploy; a
  native bar needs a TestFlight build). The native wrapper stays a bare
  WKWebView host — no `.forgeToolBar`, no in-app title on web tool roots.
  - **One look, shared code.** Pages must still MATCH each other: build page
    headers to one shared pattern the way the autoscroll pill is shared (ONE
    source — `scripts/pill.py` — imported by every gen script / injected by
    the server), not a fresh hand-rolled header per page. When adding or
    changing a page header, reuse/extract the shared pieces (the eyebrow
    title style, the back control, the pill-corner reservation) instead of
    copying variants around. The Chats header is the reference look.
  - **Reserve the pill's top-right corner on every header row** (see the
    `/chats` section — `padding-right:56px`): with no native bar the page's
    pill floats high over its own header, so no control may live in that
    corner.
  - **A page with inner levels draws its own back affordance** (Story Room's
    in-page back row is the model). Where a native chevron exists on current
    builds it asks the page first (`window.__navBack` steps one in-page
    level, then the web view's own history via `canGoBack`, then leaves the
    tool) — keep that contract working on pages that have it.
  - **PURE-NATIVE tools (no web page — Test Station, Dump, Lessons, My
    Creations, etc.) still use `.forgeToolBar("<Tool title>")`**
    (ForgeNavTitle.swift): eyebrow title in the nav bar, back chevron
    top-left to the PREVIOUS screen (RootView keeps the screen history and
    injects `\.goBack`), per-screen actions top-right, NO in-content
    `StarTitle` rows (the Home grid keeps the serif masthead). There's no
    page to own a header there, so the native pattern stays right.
  - Web tools that shipped WITH a native bar (Playground, Episode Editor,
    Story Room's title/chevron) keep working as-is; move each to a
    page-owned header at its next real redesign, not as churn.
  - **A NEW web tool ships with the NATIVE bar + chevron — the Episode
    Editor wrapper is the reference (Aug 2026, earned on the Cutting Room
    v1).** The page-owns-header rule above describes where headers are
    HEADING, not what a new tool should ship as today: the Cutting Room v1
    followed it literally (bare WKWebView host, page header only) and Sophie
    flagged the mismatch the first time she opened it — "there's no back
    arrow to go back to the home screen and it's a different autoscroll
    pill." A new tool must match the tools BESIDE it: copy
    `EpisodeEditorView.swift` (forgeToolBar + chevron asking
    `window.__navBack` first, `__nativeNavBar` injected so the page hides
    its own back button via `body.native`, audio paused on
    `.forgeScreenChanged`). Only a page that replaces the WHOLE chrome with
    a rich header of its own (Chats, Writing Room) earns the bare host — an
    eyebrow-and-title header does not.
  - **An icon-first tool carries a "?" circle (Aug 2026, Sophie).** When a
    tool's controls are icons with no words (her preference), add a small
    gold "?" circle that toggles a card explaining what each icon does —
    tap to show, tap anywhere to hide. The Cutting Room's `#help` /
    `#helpcard` is the pattern.
- **CSS gotcha that broke the Episode Editor's back button: `[hidden]` loses
  to any author `display` rule** (e.g. `.icon{display:flex}`), so the "hidden"
  button stays visible and taps do nothing. Every page that toggles the
  `hidden` attribute MUST carry `[hidden]{display:none !important}` in its CSS
  (editor.html has it; set.html always did).
- **Every image deliverable goes into the in-app gallery.** See "Deliverables →
  the in-app gallery (ALWAYS)" near the top — post it with
  `scripts/post-to-gallery.js`, stamped with its true make-time.
- **LABEL every image you deliver.** An image link's markdown text becomes its
  Assets-tab description (what Sophie reviews by). ALWAYS write a meaningful
  label — `[Penny — the blue Kleenex](url)` — NEVER `[p01](url)`, `[image](url)`,
  or a bare URL. Applies to every image in a finished reply.
  - **A RE-ENCODED copy defeats BOTH dedupe layers and lands as an unlabeled
    duplicate tile (Aug 2026 — this bit Sophie during the style-ref
    experiments).** The hook auto-files every image sent with SendUserFile;
    identical bytes collapse onto the labeled tile by content hash, and same
    filenames union in the tab — but a converted copy (webp→png for chat
    preview) has NEW bytes AND a NEW random filename, so it files as a fresh
    tile with NO label, next to the labeled original. Labeling only the
    storage URL is therefore NOT enough. Avoid it: send the ORIGINAL file
    (bytes untouched) whenever the image already lives in Storage; if a
    conversion is genuinely needed for chat, then AFTER the reply finishes,
    sweep `GET /api/gallery/assets?chat=` for new unlabeled tiles and label
    each (`POST /api/gallery { assetsOnly:true, chat, url, description }`,
    matching by downloaded content hash when unsure which is which). An
    experiment's versions MUST each carry their version label on EVERY copy —
    an unlabeled variant makes the whole comparison unreadable.
- **POST THE PROMPT for every image you deliver**, split into style + content —
  `POST /api/gallery/assets/prompt`. It's what the PROMPT overlay in the Assets
  tab reads. **The EXACT text sent to the model — NEVER PARAPHRASE**; no exact
  text on hand → file nothing (or `not available`). Full rules in "Prompts on
  Assets images" above.
- **If you ADD anything to a prompt Sophie gave, TELL HER — every time (Aug
  2026, Sophie, VERY IMPORTANT).** When she supplies prompt text, or asks for a
  "plain" run, send it exactly as given. Anything you add — style language, a
  content line she didn't dictate, a style-ref preamble, quality hints — must
  be named explicitly, word for word, in the reply that delivers the result.
  This rule was earned: a "plain" style-ref test shipped with Claude-written
  style description in the prompt and she only found out from the PROMPT
  overlay. A truly plain run contains only her words (plus unavoidable API
  params); if a necessary line has to come from you, say which line is yours.
- **FILE THE MODEL · QUALITY CAPTION on every image too (Aug 2026, Sophie).**
  The Assets tile's caption is the asset doc's `prompt` field — file it as a
  curated tag like `gpt-image-2 · medium` via `POST /api/gallery
  { assetsOnly:true, chat, url, prompt:"gpt-image-2 · medium", description }`
  (it upgrades an already-filed tile in place; search matches it). And when a
  style prompt has an author worth knowing — Claude's own text vs ChatGPT's vs
  Sophie's formula — name it in the description label ("style prompt by
  ChatGPT").
- **Do NOT dump image-link lists at the bottom of replies (Sophie, Aug 2026).**
  She reviews images in the Assets tab, not in chat — a stack of markdown links
  is clutter. Deliver images by filing them directly instead:
  `POST /api/gallery { assetsOnly:true, chat, url, description }` (the
  description = a real scene description, what she reviews by) + the prompt
  POST above for every image, and when a set belongs together (a storyboard,
  an options batch, frames of one video) ALSO compile it as a **Compare page**
  so she sees the whole thing in order in the Compare tab. Mentioning an image
  inline in prose is fine — the rule is that link dumps are not the delivery
  mechanism.
- **NEVER serve a raw generated PNG to a page — ship webp display copies
  (Aug 2026).** gpt-image-2 writes 1024² PNGs at **~1MB each**, and a page that
  points straight at them is unusably slow on a phone. This was measured, not
  guessed: the Witch School Lessons tab served five ~1.1MB PNGs as small tiles
  (~5.8MB), one lesson's deck ran ~10MB, and the app preloaded the first card of
  all 16 lessons **at boot on the HOME screen** (~16MB) so the tab you'd just
  opened queued behind it. The same image as webp is ~50KB — **about 22×**.
  - **`node scripts/webp-assets.js [set]`** converts a Storage folder into a
    `…/webp/` folder beside it. It does **not resize** (the sources are already
    display-sized, so the whole win is the format and nothing is lost), and it
    uploads with a **one-year immutable** cache header — Firebase hands PNGs
    back as `max-age=3600`, so a repeat visit re-downloaded everything. Safe
    because a changed picture is a new id in these pipelines, never new bytes at
    an existing name. The originals are never touched; the generators keep
    writing them.
  - **`node scripts/webp-assets-verify.js` is the deploy gate.** It collects
    every image id the page can ask for and fails if any lacks a webp. There is
    deliberately **no PNG fallback** (a fallback would re-download the megabyte
    this removes), so a missing copy is a broken picture in a live lesson.
  - **A page must reach its art through a base + extension constant**
    (`SW_IMG` + `SW_EXT`), never a hard-coded `.png`, so one edit moves a whole
    set.
  - **Adding a new image set:** add it to `SETS` in `webp-assets.js`, add its
    page constant to the verifier's id sweep, point the page at the webp folder,
    run both scripts, then deploy. **Regenerating or replacing existing art:
    re-run both scripts before deploying** — a new card with no webp is a
    visibly broken picture.
  - Same idea as `scripts/selfcare-thumbs.js`, which does this for the sticker
    and stamp art.
- **NO GRADIENTS. Ever.** Sophie hates gradients — flat solid colors only, in
  every UI (iOS, web pages, artifacts). No LinearGradient, no CSS gradients.
- **Sophie's voice renders on `eleven_multilingual_v2` — NEVER `eleven_v3`
  (Aug 2026, Sophie: "no one uses v3 ever again").** Her professional clone
  ("Sophie — morning", `UTkHGl2ImiT6gwtAFCql`) is not optimized for v3 and
  the likeness collapses — "a cousin doing an impression". v3 was tried and
  REVERTED in the pad and the editor, but stale doc notes kept saying v3 and
  a chat followed one, shipping a 15-minute film in the wrong voice: **when a
  doc and the code disagree about her voice, trust the code** (scratchpad.js
  / editor.js are the live copies). Settings of record:
  `stability 0.5, similarity_boost 0.75, style 0, use_speaker_boost true`.
  `<break time>` tags work on v2; v3's `[quietly]`-style acting tags do not.
- **No Claude-isms in public-facing copy** (lessons, blog posts, app text,
  product listings — anything Sophie's readers see). People shouldn't be able
  to tell it's AI-written. Banned: mic-drop closers ("That's the whole
  practice." / "That's it."), the negation-pivot reframe ("X isn't Y — it's
  Z"), therapy-speak verbs on feelings ("name it", "sit with it", "notice what
  comes up", "hold space"), permission-granting ("you're allowed to", "give
  yourself permission"), "here's the thing", "that's not nothing", the
  profound-simplicity pronouncement ("X IS the answer", "the real secret is…",
  "that's a spell by any name"), and false-easy reassurance ("just name three
  shapes", "it's right there", "it's that simple" — reads condescending). And
  the MEANING-level rule beneath them all: **aspirational, not consoling** —
  never lower the bar to comfort the reader ("X is plenty", "counts as a
  potion", "can come later, or never"); frame small acts as the first rung and
  name the higher rungs. Rewording a consolation is not fixing it. Full list +
  guidance in `docs/witch-school-lessons.md` (Voice rules). Swept the 16 live
  Witch School lessons three times July 2026; keep new copy clean.
- **Everything slow is a background job — never make anyone watch a spinner.**
  Any generation that isn't near-instant (image gen, an LLM reading, audio,
  video, a long fetch) MUST be a fire-and-forget background job that survives
  leaving the app: the server starts the work and returns immediately, the
  result is persisted (Firestore/Storage) so it's never lost, and the client
  records the pending job id (e.g. `localStorage`/`@AppStorage`) and RESUMES
  polling on return — the pattern the dream illustrator uses (`/api/witch/dream-
  illustrate` + poll). Nobody — not even Sophie while testing — should have to
  sit and stare at a spinner or risk losing a result by glancing away. If a case
  genuinely can't be a background job (or it seems not worth it), **check with
  Sophie first** rather than shipping a blocking wait.
- **Research the CURRENT UI before giving click-by-click steps for any external
  dashboard** (Shopify, Render, Google, etc.). These tools change their menus,
  buttons, and URLs constantly, and guessing from memory sends Sophie hunting and
  wastes her time (this rule was earned the hard way on the Shopify Dev Dashboard
  — see the Shopify section). Look up the up-to-date flow (web search / official
  docs), name the exact current labels, and when a deep link needs an account/app
  ID you can't see, say so and ask her to paste the address-bar URL so you can
  build the exact link — don't invent a path.
- **No pills.** Text buttons are rounded rectangles — `border-radius: 6px`.
  Circular icon buttons (toggles, dots) are the only exception.
- **Opening an image freezes the page behind it.** Tapping/clicking a picture
  (lightbox, enlarged view, any overlay) must **pause any autoscroll** and lock
  background scroll (`document.body.style.overflow='hidden'`), restoring on
  close. The page must never scroll or jump while you're looking at an image.
  Applies to every app and every gallery. **AND save `window.scrollY` on open,
  `window.scrollTo(0, savedY)` on close (Aug 2026)** — pausing alone is not
  enough (`overflow:hidden` does not stop `window.scrollBy`, so anything that
  restarts the autoscroll under the overlay moves the page; this bit Sophie
  repeatedly on Compare pages). Restoring the saved position guarantees she
  closes the image exactly where she opened it, whatever happened behind it.
- **iOS: pin bottom bars below the keyboard (never floating above it).** A
  custom bottom nav/tab bar laid out in a `VStack` rides UP and hovers above the
  keyboard, because SwiftUI's keyboard safe-area inset shrinks the stack. This
  keeps recurring across apps. **The fix is one modifier** on the container that
  holds the bar: `.ignoresSafeArea(.keyboard, edges: .bottom)` (e.g. on
  `RootView`'s outer `VStack`). The bar then stays pinned to the bottom and the
  keyboard covers it, while each screen's own `ScrollView` still lifts its text
  fields. Any app with a persistent bottom bar MUST have this — add it when you
  build the shell, and check for it whenever a keyboard-over-bar bug appears.
- **ONE generate glyph, everywhere (Aug 2026, Sophie).** Any control that
  makes something with AI wears the hand-fitted **star** — the witch app's
  `STAR` const in `witch.html`, an exact bezier match of SF Symbols
  `sparkles`. Not Lucide's `sparkles`, not a wand, not a per-page variant: a
  button that spends a model call must read the same in every surface. Live
  copies: `ICON_STAR` in `scripts/gen-scratchpad.py` (the Story Room's beat
  popup) and `ICONS.sparkles` in `promptlab.html` (the Playground's Generate).
  Deliberate exceptions, because they say something the star can't: the pad's
  **wand** (draw every beat that's missing art — a bulk action) and the
  Playground's **pyramid** (low·low·medium, a picture of how many — an actual
  tiered pyramid, two cells along the base for the lows and the filled top
  tier for the better one; NOT Lucide's `pyramid`, which is a solid 3D shape
  that says nothing about how many).
- **A custom (non-SF-Symbol) icon is framed SMALLER than its point size, not
  bigger** (`ToolGlyph`). An SF Symbol at point size S draws only ~0.75·S of
  ink — it sits on a text baseline, so the glyph is about cap height, not the
  full box — while custom art fills ~0.9 of whatever frame it gets. Matching
  the two means a frame of ~0.86·S. `ToolGlyph` scaled UP by 1.35 for a long
  time, which is why the Test Station's tubes read half again the size of
  every symbol beside them. Bundled glyph SVGs should fill ~0.9 of their own
  viewBox, centred (both `TestTube` and `Playground` do) so one rule sizes
  them all.
- **A button that opens another tool wears THAT tool's icon.** The Story
  Room's "make its art in the Playground" is the Playground's own wire-loop
  drawing, not a generic palette — same vector as the iOS tile
  (`Assets.xcassets/Playground.imageset`, mirrored as `ICON_PLAY` in
  `gen-scratchpad.py`). Keep the copies in step.
- **Deliberately UNLINKED pages (Aug 2026, Sophie's call — don't "fix" by
  adding tiles):** the `/audio` page (superseded — the share sheet routes
  audio into the memo library now; the `audio.js` API underneath is still
  live machinery), `/crystals` and `/import` (project-specific drop boxes,
  superseded for day-to-day use by the share sheet / Dump; kept because
  their data and APIs are real), and `/wall` (the everything-feed; no tile
  asked for). The pages still serve at their URLs for a chat or a browser.
- **Two home screens (Aug 2026, Sophie).** The making home (`.home`) and the
  **business** home (`.business`, `BusinessGrid` in `RootView.swift`) — the
  latter behind the **briefcase** beside the test tube, holding Instagram,
  Ads, Blog Studio, the Product Creator and the Shop Report. `Tool.isBusiness` decides which grid a tool lands on;
  a tool is on ONE grid, never both, so each home stays scannable. The
  business home's top-left is a **house** back to the making home; Chats
  keeps its top-right corner on both. Deep link: `deckfactory://business`.
- **Icons: Lucide line icons, not emoji.** Functional UI chrome — bottom-nav
  tabs, buttons, link tiles — uses inline **Lucide** SVGs (stroke
  `currentColor`, `stroke-width` ~1.8, an SF-Symbols-like clean line look), not
  emoji. Pull exact paths from `unpkg.com/lucide-static@latest/icons/<name>.svg`
  and inline them (CSP-safe, no external requests). Emoji are fine ONLY as
  expressive *content* (moon phases 🌑🌕, a decorative ✦), never as the icon for
  a control. (Lucide dropped brand glyphs like YouTube/Instagram for trademark
  reasons — hand-inline a simple equivalent or use `monitor-play`/`camera`.)
- **Each app may have its own visual identity — don't blanket-copy the warm-paper
  studio look.** `forge.css` (warm paper, `--accent` tan) is the *studio/hub*
  system; public apps can and should diverge. Example: **Secretly a Witch** uses
  its own dark, mystical theme (ink/plum + gold + moonlight) defined inline in
  `witch.html`, NOT `forge.css`. When starting a new surface, pick a palette that
  fits *that* product rather than reaching for the studio tokens by reflex.
- **Always use full clickable links** in updates — app pages, the deployed URL,
  PRs — never bare text the user has to assemble.
- **Always include clickable testing links** when something is ready to test:
  the deployed page for the feature plus the PR link.
- **Copy-paste / handoff messages = one code block.** When the user asks for a
  message to copy-paste, forward, or hand off to another chat, put the ENTIRE
  message inside a single fenced code block so it copies in one tap — no
  commentary mixed in, never split across sections or styled headers.
- **No markdown tables in chat replies.** The user reads on a narrow phone
  where wide tables need horizontal sliding and often don't render. Present
  comparisons as short labeled lines or bullet lists instead.
- **Deliverables go last.** When a message includes a generated file — audio,
  image, video, or any downloadable deliverable — send it as the final item,
  after all explanatory text, so it's easy to find and never buried
  mid-message.
- **Delivered files/images go at the BOTTOM.** When sending or attaching any
  file or image, place it at the very END of the message, after all the text —
  never before or in the middle. Write the explanation first, deliver last.
- **Answer questions FIRST.** If Sophie's message contains a question, answer
  it at the top of the reply, before doing or reporting on any tasks from the
  same message.
- **Small question → short answer.** When Sophie asks a quick or small
  question, reply with just the answer — no suggestions about what to do next,
  no updates on work already done, no recaps. Save those for when she asks.
- **Quick-question mode — phrase "quick question mode".** Sophie uses
  voice-to-text (she never types), so the trigger is the spoken phrase
  **"quick question mode"** (case-insensitive, matched anywhere in her message) —
  NOT a typed shorthand. When it appears (she may fire off a couple of rapid
  questions), keep the ENTIRE reply to **one iPhone screen, no scrolling** (she
  has an iPhone 13). Give the needed information — a sentence up to a short
  paragraph, NOT one word — but nothing beyond what's essential: no preamble, no
  options, no next-step suggestions, no reporting on other work, no closing
  recap. If a real answer genuinely can't fit one screen, give the short version
  and offer to expand ("want the long version?"). Answers only.

## YouTube auto-upload (witchy video channel)
- Finished videos post straight to Sophie's business YouTube channel as **private
  drafts** — she reviews in YouTube Studio and taps Publish. Nothing goes public
  automatically. Helper: `scripts/youtube_upload.py` (stdlib only, no deps).
  `python3 scripts/youtube_upload.py clip.mp4 --title "…" --description "…"
  --tags "a,b,c" [--privacy private|unlisted|public] [--short]`. Prints the video
  id + a `studio.youtube.com/video/<id>/edit` review link. Importable: `from
  youtube_upload import upload`.
- **Auth** = one OAuth "Desktop app" client + a durable **refresh token**, read
  from env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`.
  The refresh token mints access tokens forever, so no re-auth per session. Scope
  is **upload-only** (`youtube.upload`) — it can post but not read the channel, so
  a `channels.list` call 403s by design. The OAuth app ("Secretly a Witch") is
  published to Production (unverified) so tokens don't expire in 7 days. Re-auth
  only needed if the token is revoked or a wider scope is required.
- **Shorts** need no special call: a **vertical 9:16 clip that is short** is
  auto-classified by YouTube as a Short. `--short` just appends `#Shorts`.
- **Voiceovers** use Sophie's ElevenLabs Instant Voice Clone "Voice A"
  (`voice_id` `TbXVSG5Ejm1c91umIzJN`, needs `ELEVENLABS_API_KEY`), model
  `eleven_multilingual_v2`, punchy settings (stability ~0.34, style ~0.45) and
  ~6% faster. Illustrated episodes render panels through the diary-comic style ref
  `refs/movie-style.jpg` (gpt-image edits) then animate with Wan (`VIDEO_MODELS`
  in `movies.js`). See also `what-sage-should-do-at-her-computer.md`.

## Anthony Chene NDE moments database
- `nde.js` (`/api/nde`) — pipeline that reads Anthony Chene's near-death-
  experience YouTube interviews and extracts a database of specific,
  illustratable moments for a later illustrated anthology. Per video: YouTube
  Data API for discovery/metadata → captions scraped from the watch page's
  `ytInitialPlayerResponse` (`&fmt=json3`, no dep) → `gpt-4o-mini` extracts 3-5
  moments that are UNIQUE to this experiencer (the system prompt hard-skips
  tunnels / bright lights / overwhelming-love / life-review / floating-above-
  body / beings-of-light / "not your time" / uncrossable-border unless the
  account gives them a specific twist, and prefers concrete objects, named
  places, unusual creatures, oddly specific sensations, and biography-anchored
  details). Empty moment list is a valid answer — filler is worse than nothing.
- **State:** Firestore `forge-nde-videos`, one doc per videoId
  `{ videoId, url, title, publishedAt, channelTitle, transcript:{segments,
  full, autoGenerated}, experiencerName, summary, moments:[{id, title,
  description, quote, timeApprox, visualPrompt, category, uniquenessNote}],
  status:'pending'|'transcribed'|'extracted'|'failed', error? }`.
  `processVideo(id)` is idempotent — skips fetch/extract when data is present
  unless `forceTranscript`/`forceExtract` (or CLI `--force`/`--force-extract`).
- **Routes:** `GET /status`, `GET /videos` (trimmed list), `GET /videos/:id`
  (full record), `GET /moments` (flat cross-video moment list),
  `POST /videos {videoIdOrUrl}` (fetch + extract one), `POST /videos/:id/extract`
  (re-extract), `POST /discover {handle?, channelId?, max?}` (channel enumeration
  without fetching). Same `STUDIO_TOKEN` gate (only `/status` open).
- **Batch CLI:** `node scripts/nde-batch.js` — bulk-runs the pipeline. Sources:
  `--video-ids a,b,c`, `--file <path>`, or `--channel <handle|id>` (default
  handle `anthonychene`, override via `NDE_CHANNEL_HANDLE`). Idempotent by
  default; `--force` re-runs everything, `--force-extract` re-runs only the LLM
  step (use after tuning the prompt). `--max <n>` caps discovery, `--out <path>`
  dumps the full result set to JSON, `--dry-run` prints the plan.
- **Env vars** (config-loader MANAGED_KEYS): `OPENAI_API_KEY` (required for
  extraction), `YOUTUBE_API_KEY` (required for channel discovery + metadata —
  transcript scraping needs no key), plus the usual Firebase creds. Without
  Firebase the pipeline still runs but nothing persists (in-memory only).
- **Adding videos runs on SOPHIE'S Mac** — YouTube bot-blocks datacenter IPs
  (yt-dlp: "Sign in to confirm you're not a bot"), so a cloud session can never
  download a new interview. `scripts/nde-grab-local.py` is the local grabber:
  URLs in → audio + captions down → banked in the exact layout the cutter reads
  (Storage `nde-audio/<videoId>.<ext>` public, raw bestaudio/webm, no re-encode;
  Firestore `forge-nde-videos/<videoId>` merged so existing moments survive).
  Deps: `brew install yt-dlp ffmpeg` + `pip3 install google-cloud-storage
  google-cloud-firestore`; creds via `GOOGLE_APPLICATION_CREDENTIALS` (path to
  the **Deck Factory** service-account JSON) or `FIREBASE_SERVICE_ACCOUNT`
  (inline JSON). Idempotent — re-running skips what's banked. Example:
  `python3 scripts/nde-grab-local.py "https://www.youtube.com/watch?v=XXXXXXXXXXX" "https://youtu.be/YYYYYYYYYYY"`
  (`--file urls.txt`, `--dry-run`, `--force`). Costs nothing; no paid API calls.
- **Ingesting one of Sophie's OWN videos (not YouTube), July 2026.** For a video
  she made herself — no captions, no YouTube id — `POST /videos/from-video`
  `{ url, title? }` fetches it from a URL (Firebase Storage / Drive / Dropbox /
  any public link), `POST /videos/from-video/upload?ext=&title=` takes the raw
  video bytes directly in the request body instead (prefer the URL route for
  anything big — `express.raw` buffers the upload route's whole body in memory
  before the handler runs, so a 200MB upload is a 200MB spike; the URL route
  streams to disk inside the job). `ingestLocalVideo()` does the new part —
  **strip the video track with ffmpeg** (mono 44.1kHz AAC,
  `nde-audio/<videoId>.m4a`) — then reuses `movies.transcribeAudio` (whisper-1)
  for a browsable transcript, chunking at 10 minutes per call when the video
  runs long (each chunk's segment times get its offset added back in;
  everything is transcoded to 16k mono mp3 first because whisper's hard cap is
  25MB and the stored 128k m4a passes it around the 25-minute mark). Saved as
  an ordinary `forge-nde-videos` doc (`source:'local-video'`, no `moments` —
  that extraction step is Anthony-Chene-specific and is simply skipped).
- **Both routes are BACKGROUND JOBS** (house rule — nothing slow blocks a
  request). They write a `status:'processing'` doc, return the `videoId` plus a
  `poll` path immediately (~0.3s), and do the download/extract/transcribe in
  `startLocalVideoIngest()`; the client polls `GET /videos/:videoId` and reads
  `job.label` ("transcribing part 2 of 3"). A failure lands as
  `status:'failed'` + `error` on the doc, never a hung request. Re-POSTing
  while a job is running returns the existing doc instead of starting a second.
- **`videoId` is a content-addressed hash** — of the URL for the URL route, of
  the BYTES for the upload route — so re-ingesting the same video updates the
  same doc instead of piling up duplicates. Storage uploads go through
  `bucket.upload(localFile)` (streamed from disk), never
  `file.save(fs.readFileSync(...))`: an hour of 128k mono audio is ~57MB and
  Render's free instance has 512MB for the whole app.
- **No new cutting code was needed:** add the result as an Episode Editor
  source (`{videoId, audioUrl, timeSec}`) and `editor.js`'s existing
  render/preview path already re-listens to a fresh whisper window around each
  snippet's anchor whenever no align-cache exists for a videoId — true for
  every local video — so the same word-precise cut the NDE interviews get comes
  for free. A ragged word at a 10-minute transcript seam therefore never
  reaches the finished audio. Needs `ffmpeg`/`ffprobe` (already vendored, same
  resolution as `editor.js`) and `OPENAI_API_KEY`.

## Episode Editor (transcript spans → snippet cards → finished audio)
- **Full cutting-pipeline documentation: `docs/nde-precise-cutting.md`** — read
  it before cutting interview audio; it is the doc of record for the precise
  cutter (alignment caches, snapping rules, both implementations, data layout).
- `editor.js` (`/api/editor`, page at `/editor`, iOS tile "Episode Editor") — Sophie selects spans of a real
  interview transcript as **snippet cards**, arranges them (with **narration**
  and **gap** cards) into an episode, taps **Render**, and gets the finished
  audio. The cloud version of the hand-run supercut
  (`scripts/nde-supercut-precise.py`), so no computer is in the loop.
- **The cutting logic is a faithful port of that Python** and the reason the cuts
  sound edited rather than sliced: `phraseSpan` locates the snippet text in the
  REAL AUDIO's word timestamps via a contiguous best-match slide (a repeated word
  later in the window can't stretch the cut); `clampBounds` pads **gap-aware** —
  never past the midpoint of the silence to the neighbouring word, which used to
  swallow the next word's first syllable; `detectSilences`+`snapToSilence` move
  both cut points into REAL silences (forward-only at the end, hard-capped at the
  next word so snapping can't add words); then micro-fades + `loudnorm I=-16`.
  difflib's `SequenceMatcher(autojunk=False)` is ported too, so the JS picks the
  same spans the validated Python cuts did.
- **Word timestamps: cached alignment first, Whisper as the fallback.** The
  drift-repaired forced-alignment caches live in Storage at
  `nde-align-cache/<videoId>_<winStart>.json` as
  `{videoId, winStart, winDur, words}` — publish/refresh them with
  `node scripts/upload-align-cache.js ~/align-cache:80 ~/align-cache-150:150`
  (127 windows live as of July 2026 — pass the 80s dir FIRST so the 12 that also
  exist at 150s overwrite it with the longer window). A render picks the one that covers
  the snippet's anchor; with no covering window (or if the phrase isn't really in
  it) it listens to a fresh window with OpenAI `whisper-1` word timestamps. Each
  render's `notes[]` records which path every clip took.
- **Every finished cut is banked in the permanent clip cache (Aug 2026):**
  `nde-episodes/editor/clip-cache/<sha1>.mp3`, keyed by
  `CUT_VERSION|videoId|normalized words|rounded anchor` — so a clip is cut ONCE
  ever, across previews, renders and episodes; after that it's a single small
  download (render notes say `from clip-cache`). `POST /:id/preview` checks the
  cache first and answers `ready` instantly on a hit — no job. Narration is
  cached the same way (`narr-cache/<sha1>.mp3`, keyed by voice+model+tempo+
  prefix+text), so re-rendering an episode never re-bills ElevenLabs for
  unchanged lines. Bump `CUT_VERSION` in `editor.js` when the cutting logic
  changes — every stale cut re-cuts itself on next use.
- **Editing during a render is safe (Aug 2026).** Jobs persist ONLY
  `job`/`renders` via field-level patches (`patchEpisode`), the page's PUT
  patches only what changed, and preview completions patch their snippet inside
  a transaction — nothing stamps a whole stale doc anymore (the old bug: the
  job's 1.5s progress saves silently reverted anything Sophie edited
  mid-render). A render always uses the arrangement as it was when Render was
  pressed. The page saves are debounced (600ms) and applied optimistically, so
  buttons respond instantly; a pending save flushes on navigation/pagehide.
- **One episode per montage** (Realer Than Real, Telepathy, Not My Body, The
  Colors, Universal Knowledge, The Music, Life Review, Welcomed Home, Deceased
  Loved Ones, The Grass): cut lists banked in `scripts/nde-montages/*.json`
  (the exact lists the delivered montage audios were cut from; PROOF's is
  `proof-veridical.json`), seeded by `node scripts/seed-editor-montages.js`
  (`--render` also renders each sequentially, which warms every clip into the
  clip cache and drops the montage audio in the episode's Renders list;
  `--only slug,…`, `--replace`, `--base`).
- **Data:** Firestore `forge-editor`, one doc per episode —
  `{ id, title, sources:[{videoId, experiencer, timeSec, audioUrl}],
  snippets:[{id, name, videoId, text, timeSec}], sequence:[{type:'clip'|
  'narration'|'gap', snippetId?, text?, dur?}], renders:[{url, at, seconds,
  cards, notes}] (capped 10), job }`. `snippet.timeSec` is the picked span's
  absolute position in the interview — that anchor is what selects the alignment
  window, so it matters. Transcripts are NOT copied into the doc: `GET /:id`
  reads `forge-nde-videos` server-side and returns a word-tokenized ±150s window
  per source (~150KB for 12 sources) so the phone stays light.
- **Routes:** `GET /status`, `GET /` (list), `POST /` `{title, sources}`,
  `GET /:id` (doc + transcript windows), `PUT /:id` `{title?, sources?,
  snippets?, sequence?}`, `POST /:id/render`, `GET /:id/job`, `DELETE /:id`.
  Same `STUDIO_TOKEN` gate as the pipeline (only `GET /status` open).
- **Render = background job on the doc** (movies.js pattern): the POST returns
  immediately, the page polls `GET /:id/job`, records the pending render in
  `localStorage` and RESUMES polling on return — leaving the page never loses it.
  Each UNIQUE snippet is cut once no matter how many times it appears in the
  sequence. Narration = ElevenLabs voice `UTkHGl2ImiT6gwtAFCql` on
  `eleven_multilingual_v2` (**NEVER `eleven_v3`** — voice rule under Design
  rules), no whisper prefix, no tempo nudge, ONE constant gain instead of
  loudnorm (Aug 2026, Sophie — she rejected the dynamic squeezing;
  editor.js is the live copy of all of this, `docs/narration-voice-settings.md`
  the human record).
  `ELEVENLABS_API_KEY` is in config-loader `MANAGED_KEYS` (Render env or
  `config/pipeline`) — **without it narration cards FAIL the render with a clear
  job error, they are never silently skipped**. Output: one 44.1k mono mp3 at
  `nde-episodes/editor/<id>-<n>.mp3`.
- **Seed:** `node scripts/seed-editor-proof.js [--base <url>] [--replace]`
  rebuilds the **PROOF** episode — the 12 verified veridical moments as sources +
  snippets (named by experiencer), the "Pajamas hook" opener, and the v4 running
  order with its narration fills. 23 cards.
- **iOS:** `EpisodeEditorView.swift` = a WKWebView on `/editor` that answers the
  HTTP Basic gate with the studio token (same wrapper pattern as
  `WritingRoomView`), registered as the `editor` tool in `RootView` — home-grid
  tile "Episode Editor", SF Symbol `waveform`, deep link `deckfactory://editor`.
  It pauses the page's audio on a screen change so a preview never keeps playing
  from a hidden tab. Page changes ship via Render deploy — no TestFlight build.

## Cutting Room (her recordings → marked on the transcript → cut/sent)
- `cuttingroom.js` (`/api/cutroom`, page at `/cuttingroom`, iOS tile "Cutting
  Room", SF Symbol `scissors`, deep link `deckfactory://cutroom`) — Sophie
  opens one of her OWN recordings (the audio-drop list, i.e. everything shared
  off Voice Memos), marks it on its **transcript** — never a waveform — cuts
  pauses out, and slices sections off to save or send on. The hallway between
  Voice Memos and the rooms that use her voice. Designed around her wrist
  (tendinitis): **everything is a tap, nothing drags, scrubs, or scrolls**
  (playback follows itself — current word highlighted, page auto-centers).
- **Design (Aug 2026, Sophie): icon-first, gold-on-cream.** Buttons are GOLD
  outline + GOLD icon on CREAM (never white/text on the accent), words only
  where unavoidable (sheet rows, confirms). Send = the Apple share glyph, cut
  out = scissors, MARK = bookmark, tighten = chevrons pointing inward, render
  = arrow-down-to-line. Same paper/gold palette as editor.html — sibling tools.
- **Marking model:** tap first word, tap last word → a section (bar appears:
  cut out / save-send). Tap a pause chip → cut it (rose, struck; tap again to
  keep). "Tighten" cuts every pause in one tap. MARK drops a pin at the word
  being spoken. Cut-out words show struck-through; tapping them offers restore.
- **Cuts are the Episode Editor's cutter** (imported from editor.js —
  `clampBounds` + `detectSilences` + `snapToSilence`, ONE implementation): a
  tap never needs to be precise, edges land in real silences. **A planned
  "manual mode" (cut at the exact tapped millisecond, no snapping) is PARKED
  by request — not in v1.**
- **Pause detection = vo-remove-pauses.js's two passes** (word-timing +
  relative-energy breath pauses, room-tone runs — silencedetect alone CANNOT
  find noisy pauses, see docs/nde-precise-cutting.md). Detection only; nothing
  is removed until she taps. A removed pause is COMPRESSED to ~0.28s (KEEP),
  never deleted outright. The RMS profile is folded streaming off the decoded
  PCM (an hour of 16k s16le is ~115MB — never read into one Buffer on the
  512MB instance).
- **HER VOICE IS NEVER LOUDNORMED** (the Episode Editor narration finding —
  she rejected dynamic squeezing). Renders and clips are cuts of the original
  bytes; clips get micro-fades on the edges only.
- **Hand-offs:** save → clip file + a `forge-audio` doc (batch
  `cutting-room`, track `cutroom`, content-hash deduped, no second copy of
  bytes) so it lists on `/audio`; **Story Room** → clip cut here, then
  `scratchpad.attachVoiceUrl(padId, beatId, url)` (a normal voice take —
  every take kept); **Episode Editor** → NO audio is cut: the recording gets
  a `forge-nde-videos` doc (`cr-<id>`, segments grouped from our words) and
  `editor.addExternalSnippet()` adds source + snippet card + sequence entry —
  the editor re-cuts it natively (same whisper fallback, same clip cache).
- **Data:** one doc per recording in `forge-cutroom` (deckfactory),
  content-addressed by sha1 of the audio URL (reopening resumes). Word
  timestamps live in Storage `cutroom/<id>/words.json` (chunked whisper-1,
  75s chunks — the honest-on-long-files finding), NOT on the doc. Doc holds
  `pauses` (s/e keep-adjusted + removed flag), `cuts` (word-index spans),
  `pins`, `clips` (saved/sent sections), `renders` (capped 8 — every render a
  NEW file, originals untouched), `job`. All slow steps are background jobs on
  the doc; the page polls and resumes from `localStorage` (`cutroom_open`).
- **Routes** (STUDIO_TOKEN gate, only `/status` open): `GET /sources` (audio
  drop items + project states), `POST /open {url,name}` (starts the listen
  job: transcribe + find pauses), `GET /:id`, `POST /:id/{pause,tighten,pin,
  cutout,uncut,title}`, `POST /:id/section {wi0,wi1,action:'save'|'story'|
  'editor',…}`, `POST /:id/render`, `GET /:id/job`, `DELETE /:id`.
- Transcription cost ≈ $0.006/min of recording (whisper), paid once per
  recording. Caps at 90 min.
- iOS: `CuttingRoomView.swift` = the **Episode Editor wrapper pattern** (v1
  shipped bare and Sophie flagged it — see the Headers design rule): native
  `.forgeToolBar("Cutting Room")` whose chevron asks `window.__navBack`
  first (room → recordings list → leave the tool), `__nativeNavBar`
  injected so the page hides its own back button (`body.native`; the page
  header also folds away on the recordings list, where it would duplicate
  the bar), audio paused on screen changes. The page carries the injected
  shared pill, so the native pill is suppressed (`showAutoScroll`). Page
  changes ship via Render deploy; wrapper changes need TestFlight.
- **The "?" circle on the tools row** is the instructions for an icon-first
  tool: tap → a card naming what every icon does, tap anywhere → hidden.
  Keep it in step with the icons if any control changes.

## Sibling repos
- `memory-library-react` — the games (incl. the Xi card deck), live at
  incaseofamnesia.com; Firebase Cloud Functions that read API keys from
  locked-down Firestore docs (`config/replicate`, `config/openai`, etc.).
- `sage-lora-app` — a minimal standalone Replicate LoRA generator.

## Dev workflow
- Develop on a feature branch, commit + push, open a DRAFT PR.
- **Claude merges its own PRs — always, without asking.** Standing permission
  (July 2026). When the work is ready, merge it, then watch the post-merge
  deploys/TestFlight and fix anything that breaks.
- **Multiple Claude chats work these repos in parallel.** Another chat may
  push, merge, or ship a TestFlight build at any moment — main moves under
  you, TestFlight build numbers race, and code you wrote can get rewritten.
  Re-fetch main before merging, never assume the latest build is yours, and
  re-dispatch from your branch (`imageforge_ref` input) if a main build
  buries it.

## Scratch Pad — now THE Story Room (Aug 2026)
**The pad IS the Story Room now**: `/storyroom` serves the pad page, the
app's Story Room tile opens it, the page header says STORY ROOM, and the
Scratch Pad home tile is hidden (case + view kept). The OLD board surface
(`storyroom.html`, `gen-storyroom.py`, `/api/story/*`) stays in the repo,
unpointed — restore `serveGated('storyroom.html')` on the `/storyroom`
route to bring it back. Film renders record per-unit audio receipts on
`film.notes` ('her voice' / 'tts' / 'quiet') — read them before debugging
any "it used the wrong voice" report. The title row is sticky; placement
slots are short centered dashes.

## Scratch Pad (stage ONE of a story — before the Story Room)
- `scratchpad.js` (`/api/scratchpad`, page at `/scratchpad`, built by
  `scripts/gen-scratchpad.py`) — thinking with pictures before the Story Room
  (stage two) makes it a board; a stage ZERO is planned but not designed.
  Sophie hearts images in the Playground; those hearts ARE the pad's inbox
  (read live from `forge-promptlab` votes — nothing is copied, un-hearting
  removes it). Top-right button → popup of hearted thumbnails 4 to a row →
  tap one → it lands on the pad as a beat in a thin gray frame; with beats
  already down, dashed slots appear (front / between / behind) and she taps
  where it goes. **The pad is four to a row and incomplete rows CENTER**
  (flex, not grid — the first beat sits in the middle of the top, Sophie's
  spec). Tapping a beat opens a popup: **an opaque cream/white CARD with a
  light border, centered and only as TALL as its contents — a full-height
  card was "too tall" (Aug 2026, Sophie) — with the pad visible all around
  it; NOT a dark lightbox scrim; everything lives ON the card**
  (`#beatcard`, screen-capped + scrolls inside if it overflows, controls
  styled ink-on-cream, tap anywhere off the controls — the surrounding pad
  or the card's empty cream — to close) — the art at THUMBNAIL
  size (never blown up — Sophie's spec), five bare color chips (gray/
  mustard/green/blue/pink) that set the FRAME color and keep the popup
  open, and a three-line text box (`beat.text`, saved on close). The story TITLE sits
  under the eyebrow in the serif ("Untitled" until she renames it — tap to
  edit, `pad.title`, `POST /title`); a beat with words shows them SMALL
  under its tile — FIRST LINE only, the rest lives in the popup — and
  tapping those words (or the popup speech icon) plays them in her ElevenLabs
  professional clone "Sophie — morning" (`POST /tts {id}` — voice
  UTkHGl2ImiT6gwtAFCql on **`eleven_multilingual_v2`, NEVER `eleven_v3`**
  (see the voice rule under Design rules) at stability 0.5, similarity_boost
  0.75, style 0, use_speaker_boost true — the Voice Studio recipe in
  scratchpad.js, which is the live copy; `<break time="1.0s" />` tags work
  in a note for pauses, v3-style `[quietly]` acting tags do NOT; cached by
  text hash at Storage scratchpad/tts/<hash>.mp3, so replays are free). **Her OWN recording wins over TTS:** the popup's mic icon records
  her reading the line (MediaRecorder → `POST /voice {id, audio:dataURL}` →
  Storage scratchpad/voice/, `beat.voiceUrl`); wherever a recording exists
  the caption and speech icon play IT. EVERY take is kept in
  `beat.voiceTakes` (Sophie's rule) — voiceUrl is just the latest — and
  `audio:null` clears back to TTS. Tapping the popup thumbnail opens a
  lightbox. Placement slots are
  slim dashed LINES between beats, not full dashed tiles. **Chunks (Aug
  2026):** the popup's chain icon links a beat's unit with the NEXT unit —
  unbounded (2, 3, 4… beats). A chunk is contiguous beats sharing `chunk`
  id, drawn in ONE tile's width as side-by-side slices in a shared frame
  (one color chunk-wide — /color applies to all members; caption = first
  member's first line; tapping a slice opens that member's popup). Slots
  never appear inside a chunk. The lit chain icon dissolves the WHOLE
  chunk (`POST /chunk {id}` / `POST /unchunk {id}`). A beat's art is
  made or swapped from the SAME two-or-three icons — centered in the blank
  tile when empty, in a row ABOVE the picture when it already has one:
  **sparkles = draw it here** (`POST /generate {id, prompt, quality,
  character}` — background job on `beat.gen`, gpt-image-2 edits at 1024x1536
  with `refs/evan-film-style.png` as the style ref and, by default,
  `refs/sophie-character.png` as the character card; the prompt defaults to
  the beat's own words, quality low/medium/high default medium, NO style
  picker — one style per story; superseded art goes to `beat.imageHistory`,
  never deleted), palette → `/playground?from=scratchpad`, inbox → pick a
  hearted image straight INTO that beat (`POST /image {id, url, src?}`).
  **Draw-the-missing (Aug 2026):** a wand icon on the title row (visible
  only when some beat has words but no art) → a confirm box stating count
  and cost (`POST /drawall {quality}`, default LOW) → every such beat draws,
  two at a time. Chunk siblings without their own text are deliberately
  skipped (their art is the hand-made literal→metaphorical pair), and
  speech-only markup ([pause], <break/>) is STRIPPED from bulk prompts —
  the single-beat draw box still sends her words untouched. Safe to re-tap:
  it only ever draws what is still missing.
  ART.prefix / ART.characterLine in scratchpad.js are COPIES of
  PL_GPT.prefix / PL_GPT.characterLine in server.js — keep all three
  identical. `/scratchpad-sophie.png` serves the character card to the
  toggle (refs/ is otherwise never web-served). **Versions (Aug 2026):** once a
  beat has more than one generation, the popup shows every one as same-size
  thumbnails, newest first, current ringed — tap for the lightbox
  (`beat.imageHistory` + current). **Delete a beat** from its popup's trash
  icon, behind an are-you-sure; the record moves to `pad.trash` (capped 50,
  never surfaced) and its images stay in Storage / My Creations
  (`POST /remove {id}`; a chunk left with one member un-chunks).
  **My Creations → "Open in Playground"** (iOS): a button on a plain-image
  creation jumps to the Playground with prompt/style/quality prefilled —
  `/playground?prompt=&style=&quality=&character=1` params, handled at the
  end of promptlab.html; iOS side = `PlaygroundPrefill.pending` +
  screen-change reload in PlaygroundView. iOS: home-grid tile
  "Scratch Pad" (`ScratchPadView.swift`, bare WKWebView per the page-owns-
  header rule).
- **PHILOSOPHY (Sophie, Aug 2026 — do not "improve" this):** the pad is a
  place for thinking on paper, so it is MINIMAL. The frame colors are
  deliberately UNLABELLED indicators — never write "example"/"explanation"/
  etc. anywhere; the color skips left-brain labeling by design. No machinery
  on the pad itself (finished artwork only — no draw/redraw buttons on the
  canvas; everything operational lives in popups or off-canvas). Iterating
  fast on this module with her is expected — check the chat before assuming
  the current shape is settled.
- **More than one story (Aug 2026):** every story is its own doc in
  `forge-scratchpad`; the original keeps doc id `pad` and is just one of the
  list. The book icon in the title row opens the shelf (cover = first art,
  name, beat count, newest-touched first); + there starts a new one. The
  open story is remembered per device (`scratchpad_pad` in localStorage) and
  rides on EVERY request — `?pad=` on GETs, `pad` in the body on POSTs
  (`GET /pads`, `POST /pads {title}`).
- **The film (Aug 2026) — a play button at the TOP of the pad.** `POST
  /film` stitches the story: every beat with art is its own shot (CHUNKS ARE
  DISPLAY-ONLY — Sophie), each held for exactly its own audio's length —
  her recording first, else the line's cached TTS, else `FILM.silent` (2s)
  of quiet — hard cuts, 1000x1500 (2:3), pure ffmpeg, no video model, free. It's
  a background job on `pad.film` (`status` making/done/failed); the page
  polls and resumes on return; every previous cut is kept in `pad.films`.
  **The per-unit audio is PCM, never aac:** concatenating aac adds encoder
  priming to every file (~24ms per two units, measured) and the voice walks
  out from under the pictures — WAV concatenates sample-exact and the track
  is encoded once at the mux. Animating between a chunk's panels (her
  literal→metaphorical formula, Wan i2v ~$0.06 a pair) is the planned paid
  follow-up, deliberately not in v1.
- Data: one doc PER STORY in `forge-scratchpad` (deckfactory) — `{ beats:[{id, url,
  color, src:{runId,i,prompt,model,engine,quality}, addedAt}] }`; `src` is
  carried so the later regenerate knows how each image was made. Routes:
  `GET /` (pad), `GET /inbox`, `POST /add {url, at?, src?}`,
  `POST /color {id, color|null}`. STUDIO_TOKEN gate, only `/status` open.

## Story Room (forge-story) — THE story surface (merged July 2026)
- **Making art for the "Evan" story? Read `docs/evan-film-style.md` FIRST.**
  Its style is settled (Aug 2026) and the headline rule is counter-intuitive:
  **write NO style description at all** — attach `refs/evan-film-style.png` and
  say only to use it as a style reference, not its content, colors not required.
  Written style blocks were tested and rejected. gpt-image-2 edits, quality
  **medium** (not high), **1024x1536** portrait. Evan's locked character
  reference is `refs/evan-character.png`.

The three old story features — native Story Boards, the Story Room page, and
the `stories.js`/`forge-stories` saved-text library — are ONE surface now: the
**Story Room** (`/storyroom`, live web page; iOS tile "Story Room" =
`StoryRoomView.swift`, a WKWebView on it). The native `StoryBoardView.swift`
and the static `/story` snapshot are deleted (`/story` 301s to `/storyroom`);
the `forge-stories` collection is retired (see migration below).

- **Data:** Firestore `forge-story` (membry-df528, via
  `STORY_FIREBASE_SERVICE_ACCOUNT`), one doc per story. **Every content field
  is optional — any one of them starts a project:**
  `{ id, title, order, cover, text, voiceover:{ url, text, status?, source? },
  beats:[{ vo, cards:[{ label, status, url }] }],
  summary:[{ beat:<index>, label }], inbox:[], archived }`.
  `summary` = the story's SHAPE at a glance: the few key beats that carry it,
  rendered at the top of the story page as art cards with → arrows between
  (Sophie picks them via the "+ Summary" / "· edit" sheet; tap a moment to
  jump to its beat; `POST /api/story/summary {projectId, summary}`, kept in
  beat order, label optional — defaults to the beat's first narration words).
  `text` = the story prose (what the Movies "saved stories" picker lists);
  `voiceover` = whole-story narration — audio and/or its words, either half
  derivable (text → TTS render, audio → Whisper transcript; `status` =
  `rendering`/`transcribing` while the background job runs). `vo` on a beat
  stays the per-beat script. `voiceover` mirrors `movie.voiceover` so a
  story's narration can hand straight to the film pipeline.
- **Shelf look:** flat tiles in rows of three with a thin `--line` rule under
  each row (`shelfRows()` in `scripts/gen-storyroom.py`). NO shadows, NO wood,
  NO 3D tilt — Sophie asked for "just a line." Rows are TOP-aligned and
  `.t-name` reserves/clamps 2 lines, so covers and the meta line up no matter
  how long a title is (bottom-aligning offsets the covers — that was a bug).
- **Back navigation (Aug 2026): the native nav bar's top-left chevron is THE
  back arrow in the app.** `StoryRoomView`'s toolbar chevron asks the page
  first (`window.__navBack()` steps a story/film view back one level — shelf,
  films archive, or the film's own story); when the page says it's already on
  the shelf, the app pops to the home grid (or back to Movies when pushed,
  `pushed: true`). Builds with the chevron inject `window.__nativeNavBar`
  (WKUserScript), which hides the page's own sticky back row (`body.native`)
  so there's never a second back arrow stranded under the header; older
  builds and plain browsers keep the in-page row. Never key that hiding on
  the `pasteVoiceover` bridge — old chevron-less builds have it too and would
  be left with no way back.
- **Voiceover in: paste, don't record.** There is deliberately NO record
  button — Sophie narrates in iOS Voice Memos. Ways in: **"Paste a
  recording"** (app only, `pasteVoiceover` WKScriptMessage bridge in
  `StoryRoomView.swift`, same pattern as `DreamsView`'s — in Voice Memos:
  Share → Copy, then tap it; the app reads UIPasteboard and POSTs to
  `/api/story/voiceover` natively so the audio never crosses into JS) or
  **"Choose a file"** (`<input type=file accept=audio/*>`, works anywhere).
  Pasted/uploaded audio is auto-transcribed into `voiceover.text`.
- **Server:** `/api/story/*` inline in server.js — project/beat/art/inbox/
  assign/status/archive/delete plus (new) `POST /text` `{projectId, text}` and
  `POST /voiceover` `{projectId, audio?|url?, text?, tts?, voice?, transcribe?}`
  (TTS chunk+ffmpeg-concat like chatfeed's /polish; Whisper via
  movies.transcribeAudio; slow parts are background jobs on the doc).
- **The Movies picker reads the same docs:** `stories.js` (`/api/stories`)
  now lists/saves/deletes `forge-story` docs with `text` (routes and response
  shapes unchanged, so `StoryPickerSheet.swift`/`MovieService` work as-is).
  A story typed in the Movies box appears on the shelf; deleting from the
  picker archives (not deletes) once a story has grown a board.
  **Migration:** `node scripts/migrate-stories.js [--dry-run]` (needs both
  service accounts) moved the old `forge-stories` docs; the old collection is
  left as a backup, delete it once verified.
- **Films live ON their story (Aug 2026).** No more "THE FILMS" pile at the
  bottom of the shelf. A movie doc carries `storyId` (accepted at creation by
  `POST /api/movies`, set after the fact via `POST /api/movies/:id/story`;
  older films backfilled by `node scripts/link-films-to-stories.js`); the
  Story Room shows a story's newest stitched film in a THE FILM section on the
  story page (with its frames as thumbnails, plus "Cuts & rejected art").
  Films with NO story — dream experiments, tests — wait behind the home's
  **Films** button (only visible when any exist). When a story has beat art
  but no real film, the page shows a **draft film** instead: ffmpeg-stitched
  from one image per beat (approved > candidate > draft), timed across the
  voiceover when there is one (2.8s a picture when not), auto-kicked on first
  open and re-stitchable when the art changes. `POST /api/story/draft-film
  {projectId, force?}` — background job on the doc (`draftFilm.status`), the
  page polls `GET /api/story`; result stored as `draftFilm:{url, at, seconds,
  art, voUrl}` on the story doc, video at membry Storage `story/draft-film-*`.
- **Chats add/update boards** the same as before: manifest JSON +
  `node scripts/sync-story.js manifest.json`. Docs are replaced wholesale BUT
  the sync now preserves Story-Room-owned fields (`text`, `voiceover`,
  `inbox`, `archived`) unless the manifest sets them — a board re-sync never
  wipes Sophie's story or voiceover. Sophie also writes directly from the
  page (the old "clients are read-only" note is obsolete — her writes go
  through `/api/story/*`, not Firestore rules).
- **iOS UI changes** (not content) need a TestFlight build: run the
  `ImageForge TestFlight` workflow in memory-library-react (holds the Apple
  secrets; `imageforge_ref` input picks the imageforge branch). Page/content
  changes ship via Render deploy — no build.
- Approvals happen in chat with Sophie; sync after flipping statuses.
- **Claude may merge its own PRs without asking** (standing permission, July
  2026). When a PR is ready, merge it — then watch the Render deploy and fix
  anything that breaks.
