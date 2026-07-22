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

## Live app
- **Deployed:** https://imageforge-q125.onrender.com (Render.com, free plan)
  - Hub: https://imageforge-q125.onrender.com/
  - Test Station: https://imageforge-q125.onrender.com/test
  - Picture Book (Miracles): https://imageforge-q125.onrender.com/book
  - Illustrated Zine (Talking to Myself): https://imageforge-q125.onrender.com/talking
  - Gallery: https://imageforge-q125.onrender.com/gallery
  - **Secretly a Witch** (public witchy app): https://imageforge-q125.onrender.com/witch

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
- **AUTO-FILING (July 2026):** the chats' Stop hook (`post-to-feed.sh` v3) also
  files image deliverables automatically via `POST /api/gallery` — any Firebase
  Storage image URL in the finished reply, plus image files sent with
  SendUserFile. So the normal flow needs NO manual gallery step in
  hook-equipped sessions. Still post manually (below) when the hook is absent,
  for non-image types, per-image prompts/styles, or true generation times on
  a backfill.
- **One command does upload + post:**
  `GALLERY_UID=<uid> node scripts/post-to-gallery.js --file ./image.png --prompt "…"`
  uploads the local file to membry Storage, makes it public, and writes the
  gallery doc — so generate → post is a single step (use `--url` instead for an
  already-hosted image). Needs the `membry-df528` Admin service account via
  `FIREBASE_SERVICE_ACCOUNT`/`GOOGLE_APPLICATION_CREDENTIALS` and the target uid
  (neither in the repo). Doc shape:
  `{ type, url, prompt, stickers:null, createdAt:Timestamp, source, style? }`.
- **The target uid is Sophie's device anonymous-auth id** — a personal
  identifier, so it's kept OUT of the repo (pass `--uid` or set `GALLERY_UID`;
  store it in Render env / a local `.env`, or Sophie shares it in-session).
  Anonymous uids change on reinstall — re-find by scanning every user's
  creations (collectionGroup) for the device with recent real activity.
- **Timestamps = when the image was actually made.** The app sorts by
  `createdAt`, and multiple chats post concurrently, so pass the true generation
  time (`--created <ms>`) — that's what keeps everyone's deliverables in correct
  chronological order (and puts a genuinely-fresh batch at the top). Don't reuse
  a stale/skewed server clock just because it's embedded in a filename.
- **Images must live at a public URL** the app can fetch (Firebase Storage in
  either project, made public). Temporary Replicate/OpenAI URLs expire — upload
  to Storage first (`saveToFirebase()` in `server.js`, or `bucket.upload()`).

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
- **Do NOT also post replies by hand** — the hook already does it, and manual
  posts would duplicate. Check `ls /home/user/.claude/hooks/post-to-feed.sh`;
  only if it's MISSING (hook absent in your session) fall back to the old
  manual post: `POST https://imageforge-q125.onrender.com/api/chatfeed` with
  `{ "chat": "<short-chat-name>", "text": "<reply>", "tldr": "<TLDR>" }`
  (x-studio-token header when gated). The hook names the chat from the git
  branch (e.g. `dating-book-design`); set `FORGE_CHAT` env to override.
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
- **Sophie can reply in the app** (`POST /reply`, shows as `from:"sophie"`) — a
  chat picks up replies addressed to its chat name the next time Sophie messages
  it (`GET /api/chatfeed?limit=50`), then acts on them. **NOT on a timer.**
- **Assets curation (♥/✕ + notes, July 2026):** Sophie hearts/rejects images
  in a chat's Assets tab (tiles AND the lightbox), and the lightbox has a note
  box (under the image) she can send per image. Votes + notes live in
  `forge-asset-votes` (deckfactory, one doc per chat+url) and ride along on
  `GET /api/gallery/assets?chat=<name>` as `vote: "like" | "dislike"` and
  `note` per asset. When Sophie next messages a chat, it should check its
  votes/notes and act on them (favor the hearted ones, re-roll the ✕'d and
  anything noted "redo") — same review-loop pattern as writing notes, NOT on
  a timer.
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
  your own scroll pill. List your
  pages with `GET /api/chatfeed/pages?chat=<name>`; replace by DELETE
  `/api/chatfeed/page/:id` + re-post. Only fall back to a claude.ai artifact if
  the page genuinely can't work as plain HTML.
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
- **Dreams (dream → comic):** the dream-illustration path — replicates the
  daily "get my dream illustrated" experience. `POST /api/movies/dream` is the
  free breakdown. **Model (experiment, July 2026): OpenAI frontier
  `gpt-5.6-sol`** does the WHOLE breakdown — splitting AND the image
  descriptions — set by `DREAM_BREAKDOWN_MODEL` (default `gpt-5.6-sol`; set a
  `claude-*` id to route back through `anthropicChatJSON`/Claude Opus, the prior
  default, for comparison). Chosen deliberately as the smart tier — a small
  model can't split/segment/order a rambling recording — and to test whether the
  model that owns the image generator writes descriptions its own image model
  draws better. **There is NO silent fallback between providers**: whichever
  `DREAM_BREAKDOWN_MODEL` names either works or errors (no drop to gpt-4o-mini).
  `openaiChatJSON` takes a `model` and omits temperature for `gpt-5*` reasoning
  models; ~$0.066 and ~60s per breakdown on Sol. `OPENAI_API_KEY`/
  `ANTHROPIC_API_KEY` are `config-loader` MANAGED_KEYs (Render env OR the
  Firestore config doc). **One recording → one or MORE dreams:**
  `dreamBreakdown()` first SPLITS the recording into the distinct dreams (on the
  dreamer's boundary cues — "that was that dream", "the next dream", "yesterday
  I had a dream") and returns `{dreams:[{title,text,driftCues,cast,beats}]}`;
  `POST /dream` creates one `forge-dreams` doc per dream (staggered `createdAt`
  so array order = time; each stores `dreamText` = its own verbatim slice and
  `driftCues` = the verbatim out-of-order phrases to highlight) and returns
  `{dreams:[doc,…]}`. Within each dream it reconstructs TRUE chronology from the
  cues ("that was before", "at first", "at the very end", "right before I woke
  up"), emits coarse beats already in order, and lists in `driftCues` the exact
  phrases where the narration drifted from chronological (for the review UI to
  highlight; `[]` when told in order). iOS `createDream` returns `[Dream]`; the "check the
  chronology" step shows each split dream as its own titled group (▲▼ within it)
  and "Draw all N" renders each via `POST .../render {order:[beatId]}`.
  `POST /api/movies/dream/:id/render` then draws the beats as hand-lettered
  2x2 comic pages through the SAME style-ref zine engine — `makeDreamPages`
  packs beats **four per image** (an 8-beat dream = two pages; a short tail
  page lays out with fewer), captions = the beats' own lines (no cover),
  ~$0.06/page. Own polled docs (`GET /dream`, `GET/DELETE /dream/:id`),
  background job on the doc, `pageHistory` capped 3. Separate collection so
  dreams never clutter the movies list. **Render survives leaving the app:** the
  render is a fire-and-forget server job, and iOS `DreamsView` records the
  rendering dream ids in `@AppStorage("dreams.activeRenderIDs")`, so closing the
  app or leaving the screen never stops the draw — on return, `resumeActiveRenders`
  re-polls those ids and shows the pages as they land. Polling is resilient to
  dropped connections (phone locked / Render cold start) — a transient failure
  retries instead of surfacing "Couldn't illustrate"; only a real job error does.
  **Multi-character consistency by reusing earlier pages** (a dream usually has
  several recurring people — dad, J, Sean — not one): the breakdown returns a
  `cast:[{name,look}]` (≤5 named figures) and each beat carries a `who:[name]`
  of who appears in it. Pages render **in order** (`makeDreamPages`, a
  sequential loop — dreams are short); each page feeds the **already-drawn
  earlier pages** back in as the reference, NOT freshly-generated solo sheets.
  For every recurring character on a page, `dreamPageRefs` finds the earliest
  page that showed them and attaches it (style ref FIRST, then up to 3 earlier
  pages), and `dreamZinePagePrompt` names each by attachment position ("the #2
  attached image is an EARLIER PAGE — draw J with the exact same face/hair/
  clothing"). A character's FIRST appearance has no earlier page and is drawn
  fresh; the page it lands on then anchors it everywhere after. This is the
  cheaper, more faithful version of the ChatGPT technique — reuse an existing
  image of the character instead of inventing a reference sheet (gpt-image-2
  `edits` attends to the attached images; array up to ~16, we cap at style + 3).
  So an N-character dream generates **only** its comic pages — 0 extra images
  (previously it drew one solo sheet per character, ~$0.06 each). Legacy dreams
  with no `who` fall back to anchoring each page to the most recent earlier one.
  Same `STUDIO_TOKEN` gate. No web page — iOS is the intended frontend, like the
  rest of movies.

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

## Blog Studio (SEO posts → Shopify blog)
- `blog.js` (`/api/blog`, page at `/blog`, hub tile "Blog Studio") turns a topic
  into an SEO blog post and publishes it to the Shopify store blog — free organic
  search traffic to the shop. Built around 2026 SEO reality: target **long-tail**
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

## Secretly a Witch (public witchy app)
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
- **External links** live in a `LINKS` const at the top of the client script.
  Shop = `secretlyawitch.com` (Shopify), Instagram = `@moonsickbaby`. **Watch =
  YouTube is still a placeholder search** — the channel URL isn't stored anywhere
  (the YouTube token is upload-only scope and can't read the channel), so it
  needs Sophie's `@handle` pasted in.

## Design rules (forever)
- **Every image deliverable goes into the in-app gallery.** See "Deliverables →
  the in-app gallery (ALWAYS)" near the top — post it with
  `scripts/post-to-gallery.js`, stamped with its true make-time.
- **NO GRADIENTS. Ever.** Sophie hates gradients — flat solid colors only, in
  every UI (iOS, web pages, artifacts). No LinearGradient, no CSS gradients.
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
  Applies to every app and every gallery.
- **iOS: pin bottom bars below the keyboard (never floating above it).** A
  custom bottom nav/tab bar laid out in a `VStack` rides UP and hovers above the
  keyboard, because SwiftUI's keyboard safe-area inset shrinks the stack. This
  keeps recurring across apps. **The fix is one modifier** on the container that
  holds the bar: `.ignoresSafeArea(.keyboard, edges: .bottom)` (e.g. on
  `RootView`'s outer `VStack`). The bar then stays pinned to the bottom and the
  keyboard covers it, while each screen's own `ScrollView` still lifts its text
  fields. Any app with a persistent bottom bar MUST have this — add it when you
  build the shell, and check for it whenever a keyboard-over-bar bug appears.
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

## Story Boards (forge-story) — how ANY chat adds projects/assets
The video-project asset boards (Evan, Charlie, Spellcasting, …) shown in the
iOS app (Story Boards tile — a VHS-shelf wall, 3 covers per shelf, tap to open
a project's beat board) and mirrored at `/story` (gated snapshot page).

- **Data:** Firestore collection `forge-story`, one doc per project:
  `{ id, title, order, cover, beats:[{ vo, cards:[{ label, status, url }] }] }`.
  `status` ∈ `ok` (approved) | `cand` (candidate) | `draft` (storyboard
  placeholder) | `miss` (no art yet — omit `url`). `vo` is Sophie's actual
  narration for that beat. `cover` is REQUIRED for the shelf (pick one hero
  shot; without it the case renders as a "?" box).
- **To add/update:** build a manifest JSON (array of projects; use
  `file`/`cover_file` with local paths for any new images — ~700px webp
  preferred) and run `node scripts/sync-story.js manifest.json` with
  `FIREBASE_SERVICE_ACCOUNT` (or `FIREBASE_KEY_FILE`) set. Images upload to
  Storage `story/` (content-addressed by basename — reuse basenames to
  overwrite) and docs are replaced wholesale, so ALWAYS write the full project,
  not a partial. The iOS app updates live (snapshot listener) — no build.
- **Clients are read-only** (Firestore rules in memory-library-react allow
  authenticated reads only); all writes go through the sync script.
- **iOS UI changes** (not content) need a TestFlight build: run the
  `ImageForge TestFlight` workflow in memory-library-react (holds the Apple
  secrets; `imageforge_ref` input picks the imageforge branch). The
  imageforge-local `ios-testflight.yml` is a placeholder without secrets.
- Approvals happen in chat with Sophie; sync after flipping statuses.
- **Claude may merge its own PRs without asking** (standing permission, July
  2026). When a PR is ready, merge it — then watch the Render deploy and fix
  anything that breaks.
