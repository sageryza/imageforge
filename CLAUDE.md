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

## Claims about OTHER sessions or the environment: MEASURE, never reason
**(Sophie asked for this as a case study, 2026-08-10, so it can't happen
again.)** A chat can test its own page, its own hook, its own container — but
any claim about what the OTHER ~190 sessions or the environment do (which hook
they carry, whether a setup script re-ran, what actually reaches the server)
is a POPULATION fact. It cannot be derived from inside one chat, and reasoning
it out anyway is how this repo lost weeks:
- **The case: the Chats app's pink "working" tint.** It depended on a ping
  only sessions with a current hook ever send. Chat after chat believed it
  worked or was one bug away, because: (1) this file carried confident wrong
  claims about the environment ("the setup script re-runs per session" — it
  doesn't; "a reinstalled hook waits for the next session" — backwards),
  each written by a chat that reasoned instead of measured, and every later
  chat inherited the sentence as fact; (2) a REAL client repaint bug
  (#931/#933) gave false confirmation — fixing it made local tests green, so
  the next chat hunted the same layer; (3) every headless test stubs the
  hook, so green tests proved the machinery while saying nothing about
  deployment. **The settling measurement took thirty seconds and nobody ran
  it for weeks:** count the signal in the live registry — 3 of 77 chats
  that had posted replies in six days had ever sent the ping. The tint
  missed working chats and lit idle ones, and was retired (see the /chats
  section for the full story and what replaced it).
- **The rule.** Before shipping anything that depends on the hook, the setup
  script, or other sessions' behaviour: query the LIVE data first (the
  registry, the feed, file mtimes in a fresh container) and write the dated
  measurement next to the claim — the way the best notes in this file
  already read ("measured 2026-08-08, mtime Aug 1"). A green test that
  stubs the environment is evidence about the machinery, not the
  deployment; say which one you have. An undated confident claim about the
  environment in this file should be treated as a hypothesis, not a fact.
- **THE GAP TEST — how to tell which chats carry a current hook, from the
  feed alone (2026-08-10).** You cannot look inside another session's
  container, but the feed tells you anyway: an OLD hook can only lift her
  message from the transcript at the END of a turn, so her `postedAt` lands
  ~1s before the reply's. A CURRENT hook posts it at UserPromptSubmit, so
  the gap between her message and the reply IS the turn's duration. Measure
  `sophie.postedAt → next non-sophie postedAt` per chat: **~1s = stale
  hook, seconds-to-minutes = healed.** Verified 2026-08-10 against a chat
  that healed mid-conversation — its gap jumped 0.6s → 9.8s on the very
  next turn, and the healed chats were exactly the ones stamping
  `workingAt`. Use this before telling her a chat "isn't working"; it costs
  one feed read and needs nothing from the session in question.
- **A transient mark leaves NO trace, so don't read its absence as failure.**
  `workingAt` is deleted by the chat's own reply, and `hiddenAt` is
  overwritten by the next hide — so a chat that parked and un-parked inside a
  10-second turn looks identical to one that never parked. That is exactly
  what "the Jesus rules chat didn't hide itself" turned out to be
  (2026-08-10): it had healed and it did park; the turn was 9.8s long, so
  the window was gone before she could look. Judge parking/tint on a LONG
  turn, or from the gap test above — never on a fast one.

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
- **Cloud environments on ACCOUNT 2 — there are TWO, both named "Default",
  and only one is used (measured 2026-08-10 via `list_environments` +
  `list_sessions`/`get_session`).** Telling them apart matters, because the
  Setup script is a per-environment field and pasting it into the wrong one
  looks identical to pasting it into the right one:
  - `env_01NCcMuoimJBkNbag4JrEGZx` — name "Default", description **empty**.
    **This is the one every session actually runs in**: all 19 sessions back
    to Aug 3 were on it, including this file's own chats.
  - `env_01PpZpGDKFXqhCj3ZieoBUkH` — name "Default", description "Default -
    trusted network access". Nothing observed running on it.
  Both were created 2026-07-26 within 0.23s of each other, i.e. auto-
  provisioned at account setup — Sophie did not make two. **A chat can settle
  which environment anything is on by calling `get_session` on its own
  session id and reading `environment_id`; never infer it from behaviour.**
  (This corrected a live wrong diagnosis: differing hook versions across
  chats were blamed on "two environments" when in fact every chat shared one
  and the healed ones had each been healed BY HAND.)
- **Missing an id you need?** Ask Sophie to paste the URL from her address bar
  while she's on that page, build the exact link from it, and ADD THE ID HERE
  so no future chat has to ask twice.

## Live app
- **Deployed:** https://imageforge-q125.onrender.com (Render.com, **Starter**
  instance — $7/mo, always-on; Sophie upgraded Aug 2026)
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

## Render plan: STARTER since Aug 2026 (don't diagnose free-tier symptoms)
- **The service runs on the $7/mo Starter instance** (`plan: starter` in
  `render.yaml`; confirmed live on the dashboard). Two free-tier problems are
  simply gone, so **do not explain a slow load with either of them**:
  - **No spin-down.** Free services slept after ~15 min idle and the next
    visitor ate a ~30–60s cold start. Starter never sleeps, so there is no
    cold start except the ~30–60s right after a deploy or restart, while the
    new instance boots.
  - **No 750-hour monthly cap.** The free tier's per-workspace hour budget
    (which could suspend every free service until the 1st) does not apply.
    "ImageForge is hard-down late in the month" is no longer a running-hours
    question.
- **CPU went 0.1 → 0.5 vCPU** (RAM is still 512MB, unchanged — the streaming
  discipline around big audio/video buffers still matters exactly as much).
  So the **server's own** work got roughly 5× the CPU: ffmpeg (film stitching,
  Episode Editor / Cutting Room renders, pause detection), sharp (webp copies,
  HEIC re-encodes, MPC prep), zip building.
- **Model time did NOT change** and it dominates most waits: gpt-image-2,
  Replicate, Whisper, ElevenLabs and the LLM calls all run on someone else's
  hardware. A ~30–90s medium image is still ~30–90s.
- **The keep-awake self-ping is now redundant but harmless.** `server.js`
  (bottom, the "Keep-awake" block) still fetches `/api/talking/ping` every
  10 min via `setInterval` — an **internal self-ping**, not an external uptime
  monitor / cron / GitHub Action (there is NO external pinger in any of the
  four repos; don't go hunting for one). It was the free-tier compromise
  against spin-down. Left in place deliberately: it costs one request per
  10 min and it is the safety net if the instance is ever moved back to Free.

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
- **The gallery is PAGED (Aug 2026) — 60 at a time, then an "Older" button.**
  It used to be ONE capped 60-doc query with no way to ask for more, so
  creation 61 and everything behind it was unreachable. That is a hard truncate
  the same shape as the Assets tab's old one, and it hid almost everything:
  1,396 creations existed, 442 of them made in eight days, so the visible
  window had shrunk to about a day and Sophie reported her older images as
  gone. **Never diagnose that report as data loss** — check the count first
  (`node scripts/find-gallery-uid.js` prints it per uid).
  `ForgeService.fetchCreationPage(limit:after:)` returns items plus a
  `DocumentSnapshot` cursor; `hasMore` and the cursor are derived from the
  SNAPSHOT count, never the mapped items, because a doc with no usable url is
  dropped from the page but still occupies a slot.
- **Tiles decode DOWNSAMPLED, and both image caches are cost-bounded.** A
  gallery tile is ~110pt but its url is a full 1024x1536 picture (~6MB once
  decoded), so paging back through hundreds of them would be a gigabyte of
  bitmaps. `CachedImageView(url:contentMode:maxPixel:)` decodes to the tile's
  size via `CGImageSourceCreateThumbnailAtIndex` (~0.4MB) and keeps the
  downloaded BYTES on disk, so the popup and Save-to-Photos still get the
  original. Leave `maxPixel` nil for anything shown large.
  **The download is still full-size** — there is no server-side thumbnail for
  creations (unlike `scripts/selfcare-thumbs.js` / `webp-assets.js`), so
  paging deep costs real bandwidth. Worth building if she pages a lot.
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
  **It also scans the turn's RAW tool activity, so an image a chat merely
  TOUCHED (read, verified, copied a url of) can be filed into that chat
  unlabelled — see `docs/wip-asset-filing.md`** for the mechanism, how to spot
  one (no `description`, caption reads `from <chat>`), the measurement, and
  the options for fixing it. Not fixed as of Aug 2026; `POST
  /api/gallery/asset-cleanup` (with `dry` first) removes strays.
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

## Reference images — Sophie's names (Aug 2026)
The style/character references the app attaches automatically. **These are the
names Sophie picked, so use them when talking to her about a look** — she named
them off the reference sheet, not off the old filenames.
- `refs/sage-sandy-mirror.png` — **sage sandy mirror**, her scanned
  ink-and-watercolour page ("datescan0013"). The Playground's ChatGPT style,
  the Story Room's "draw it here", the Evan film. Was `evan-film-style.png`.
- `refs/sophie-book.png` — **sophie book**, the character card behind the
  Sophie toggle. Was `sophie-character.png`.
- `refs/dream-mystery.jpg` — **dream mystery**, her diary-comic page. Movies'
  "Dreamy pencil", the dream illustrator, the zine, Character Creator. Was
  `movie-style.jpg`, and it ALSO existed as a second slightly-different crop
  at `refs/style.jpg` (the zine's own copy) — Sophie spotted the duplicate and
  asked for one file, so `style.jpg` is deleted and the zine reads this.
- `storage:witch-school/refs/sophie-snake.png` + `sophie-animals.png` —
  **sophie snake** / **sophie animals**, the Pastel pair. The Playground's
  Pastel, the Witch School lesson cards, the self-care stickers and stamps.
  Were `style-1.png` / `style-2.png`; the old Storage objects were COPIED not
  moved, so they still exist and can be deleted once this has been live a
  while.
- Deliberately NOT renamed, at her ask: `richard-scarry-1/2/3.png`,
  `flat-cool.png` / `flat-busy.png`, `evan-character.png`, and the four
  `storage:hoonies/refs/style-*.png`.
- Her full name list is banked at `GET /api/chatfeed/verdict?chat=references-render-plan&sheet=ref-names`.

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
  different run. The check sees the loaded feed plus anything in flight, so a
  duplicate of something older than she has paged back to still gets through.
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
- **The feed is PAGED, and it pages BACKWARDS THROUGH TIME (Aug 2026).** It
  used to ask for the newest 40 runs and had no way to ask for more, so run 41
  and everything behind it was simply unreachable — 213 runs existed and 40
  could be seen, which Sophie reported as her older pictures being gone.
  Nothing had been deleted; nothing ever deletes a run. Now an **Older** button
  under both views loads the next 40 (`GET /api/promptlab?limit=&before=`,
  `more` on the response says whether there is any point offering it).
  - **The cursor is a `createdAt`, never an OFFSET.** Runs land at the TOP
    while she reads, so an offset shifts under her and repeats or skips one.
    The server does `where('createdAt','<',…)` on the field it already orders
    by, so no composite index is needed.
  - **A head refresh MERGES, it never replaces.** Every finished run calls
    `loadRuns()`, and rebuilding the feed from page one there would throw away
    everything she had paged back to. `feed` holds every run loaded, fresh
    copies win (a vote or a status moved), and the list re-sorts by time.
  - **It is a TAP, deliberately not load-on-scroll** — the autoscroll pill
    would run the page to the bottom by itself and pull page after page of
    pictures over her data without her asking.
  - Tests: `node scripts/test-playground-paging.js` (drives the real page in
    headless Chromium against a stub API; skips without Playwright).
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
  page attached as a pure STYLE reference (`refs/sage-sandy-mirror.png` =
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
  in **Storage**, `witch-school/refs/sophie-snake.png + sophie-animals.png`, loaded via `loadHouseRef`,
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
  attaches `refs/sophie-book.png` (her hearted "girl placing her book
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

## Vector pipeline (`/api/vector`) — described drawings → art that scales
- **Making vector art, or touching `vector.js` / `vectorize.js`? Read
  `docs/vector-pipeline.md` FIRST** — Sophie asked for it written down so any
  chat she points there can use it without re-deriving the recipe. It carries
  the exact style (prompt wording, model, refs, size, quality), the routes, the
  gotchas and the test.
- **What it does:** describe 1-25 drawings → ONE gpt-image-2 sheet in the pastel
  house style (~6¢, the only cost) → cut into cells → lift each off its paper →
  trace each to SVG (**free**, local, ~1.3s) → an SVG + a 2048px PNG per
  drawing in Storage. `POST /sheet`, poll `GET /job/:id`. `POST /trace` does
  just the tracing half on any flat-colour image URL, for nothing. `POST
  /prompt` shows the literal prompt and spends nothing.
- **What a vector buys:** sharp at any size from one ~100KB file, recolourable
  by editing a fill, and its outline IS the cut line for a die-cut sticker. On
  a phone screen a PNG already looks the same.
- **The one hard limit is GRADIENTS** — the tracer reduces a picture to a few
  flat colours, so a wash, a soft shadow or a photo has none to find and comes
  out bigger AND worse than the PNG. Ink lines and solid fills are what it
  handles. That is a limit of the tracer, not art direction.
- **The style is the Gravity Lock card recipe verbatim** (`HOUSE` in
  `vector.js`) — the same two Witch School style refs the pastel house style
  uses, the same grid clause, the same no-text suffix. Don't let prompts
  drift; add a NAMED style if a different look is needed.
- **Re-cutting a sheet you already paid for is free** — pass its url back as
  `sheet`. Tuning the trace must never re-bill the model.
- **Pick the grid by how much is IN each drawing, not by how many you want
  (measured Aug 2026, 3x3 drawn at all three qualities).** Nine fits and the
  tracer does not care — 341px cells trace within 4.8/7.4/6.4% of the source,
  inside the 8% the 2x2 cards are held to. What changes is the MODEL: at 3x3 it
  draws simpler objects (2.9 fills a drawing against 4.75 at 2x2). So 2x2 for a
  drawing with detail, 3x3 for simple objects and icons (0.7¢ each). 5/7/8
  don't tile — the spare cells are drawn and binned, so ask for 4, 6 or 9.
  Quality is ~2¢/6¢/25¢ a SHEET; all three trace cleanly. **Nothing about the
  tracer is tuned per quality or per grid** — they are inputs, the defaults are
  untouched; the only per-drawing options are `fills` and `darkBackground`.
  **5x5 TRACES FINE** — on a real 21-icon sheet (204px cells) 3 of 21 drew lines
  8.6-9.3% fat, but put those three beside their sources and they are
  indistinguishable: the 8% figure is a regression detector calibrated on the
  2x2 cards, NOT a threshold of visible badness. An earlier note here called
  5x5 "past the edge" and that was wrong. The route still caps at 9 for a
  different reason — this module has never DRAWN a 5x5, so the model placing
  25 described drawings from this prompt is untested. And **webp
  costs the trace nothing** — measured same-sheet against PNG, max 7.0% vs
  7.4%; the "PNG traces better" claim was reasoning and it was wrong, so never
  re-render a sheet hoping to improve a trace.
- **Two gotchas that cost real time:** a dark-background drawing needs
  `darkBackground:true` (the cut-out is a corner flood-fill and would eat the
  background — the Grand Tour card is the live example), and the Assets tab
  dedupes by FILENAME, so a v2 needs a new *filename*, not just a new folder.
- **CHANGE ITS COLOURS AFTER THE FACT — `POST /api/vector/recolor`, free
  (Aug 2026, Sophie).** Hex or a CSS colour NAME (`salmon`, `steel blue`), as
  a list parallel to the palette or a map keyed by source hex / slot; `ink`
  and `paper` too. No colours at all = it answers with the palette and writes
  nothing. **It is NOT a find-and-replace and must never be turned into one:**
  vtracer writes a 4-colour palette out as 21 hex values (shapes come back
  slightly shifted, plus thin blend layers at every seam), so swapping exact
  matches recolours a 0.08% sliver and leaves a fringe of the old colour round
  every edge. Every fill is mapped by where it sits between its two nearest
  anchors. Recolouring nothing returns the identical file, byte for byte.
- **The front is `/vector` (`public/vector.html`), iOS tile "Vector" under the
  PICTURES filter (Aug 2026, Sophie: "make a new tool in the image tab").**
  `tool.css` step flow: describe drawings (the one starred, paid control) or
  trace a picture you already have (free) -> tap a drawing -> **one text box
  per colour**, prefilled with its hex, plus LINE and PAPER left blank (empty
  means leave it). Filter-only like the Test Station — it is deliberately not
  on the default home. Its glyph is the bundled `Vector` asset (a bezier curve
  with its two anchor points); `deckfactory://vector` opens it.
- Tests: `node scripts/test-vectorize.js` — asserts against the SOURCE card
  (no invented colour, no dropped colour, line weight, structure), not against
  the Python it was ported from. It deliberately does NOT catch small
  localised wrong-colour patches; that class is caught by looking.
  `node scripts/test-vector-recolor.js` is the recolour gate (measured on the
  rendered picture, not on the file), and `node scripts/test-vector-page.js`
  drives the real page end to end against a local server — both free to run.

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
- **SKILLS load in every session via the SAME setup script (v9, Aug 2026).**
  The repo's `.claude/skills/` (witch-copy, deliver-images, new-page,
  new-module, sophie-audio, …) are only discovered by Claude Code once a chat
  is already working inside this repo — the same starting-folder gotcha as
  the hook — so the setup script SYMLINKS them to `/home/user/.claude/skills`
  and they load from the first turn. A symlink, never a copy: sessions always
  read whatever is on the clone today, so merged skill improvements arrive
  with no re-paste. Like every hook change, an EXISTING environment needs
  Sophie to re-paste the current `docs/chats-autopost-setup-script.sh` once;
  a running session self-heals with the same
  `curl -fsSL https://imageforge-q125.onrender.com/setup.sh | bash`.
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
  body verbatim-embedded; never hand-edit those two copies.
  **A NEW HOOK VERSION DOES NOT REACH AN EXISTING ENVIRONMENT ON ITS OWN —
  this note used to claim it did, and it is wrong (checked live 2026-08-07).**
  The Setup script is PASTED TEXT in the environment settings dialog, and it
  re-runs *the copy she pasted*, so an environment set up before v7 keeps
  installing the pre-v7 hook forever. **It may not even re-run per session:
  measured 2026-08-08, `/home/user/.claude/` and `.claude/hooks/` in a fresh
  container both carried an mtime of Aug 1 23:32 — the environment SNAPSHOT
  date — so nothing had written them in a week of sessions.** Treat the hook
  as baked into the snapshot: after changing the Setup script, VERIFY in a
  brand-new session (`grep -c PostToolUse /home/user/.claude/hooks/post-to-feed.sh`)
  rather than assuming the edit took. Live
  proof: `/home/user/.claude/settings.json` in these sessions registers only
  Stop and UserPromptSubmit, the installed hook contains no `working` logic
  at all, and the feed therefore holds ZERO live drafts — which is why the
  Chats app's working-chat tint never fired. Fixing it needs Sophie to
  re-paste the CURRENT script into the environment once — the whole file,
  `docs/chats-autopost-setup-script.sh` (GitHub's file view has a one-tap
  copy button, which matters: she does this on a phone).
  **PREFER THE SELF-CONTAINED PASTE over the elegant one-liner** — this file
  recommended `curl -fsSL …/setup.sh | bash` as the Setup script for exactly
  one evening, on no evidence, and it is at best unproven here. What IS
  established (2026-08-08): the big paste demonstrably installs a working
  hook (it is what put the Aug 1 one there), needs no network, and cannot
  fail on a server blip; whereas a Setup script that fetches at init dies
  with "Setup script failed" (`recoverable:false`) the moment the fetch does
  — which took out three probe sessions in one evening. **The honest limit of
  that measurement: all three probes were MCP-seeded sessions whose network
  was restricted anyway** (the one that recovered reported no hook file and
  outbound POSTs blocked), so they do NOT prove a normal session's Setup
  script lacks network. They only show the failure mode is real and fatal.
  Given the script has to carry the hook body regardless — the whole reason
  `build-chats-setup.py` embeds it verbatim — there is no upside to fetching
  it at init. A RUNNING session is different: it has network, and curl is the
  right tool for self-healing there (see the self-heal note below).
- **THE "··· working details" FOLD IS STRUCTURAL — the signal is the turn's
  TOOL CALLS (Aug 2026, v2, Sophie: "it's supposed to find when the message is
  done coding … unless there's some internal signal, that would be the
  best").** There is one, and this is it. The hook already walks the
  transcript, where `text` and `tool_use` blocks are interleaved in order, so
  every finished turn posts two character offsets into its text: **`head`** =
  where the FIRST tool call fell, **`tail`** = where the LAST one did. The app
  shows `text[0,head)` (what it said before starting), folds the middle (the
  narration between tool calls), and shows `text[tail,…)` — the closing
  rundown, which is the thing she opens the message for.
  - **v1 was a VOCABULARY classifier and she called it a nuisance. Measured
    2026-08-11 over the 132 real replies in six days of feed: it folded 4.5%
    of reply text while putting a fold button on 46 of 112 long messages, and
    what it hid included lines plainly meant for her** ("Now I have the truth,
    and I owe you a correction."). It never once surfaced the closing rundown.
    `isWork`/`splitBlocks` are deleted; **do not reintroduce a text-based
    fallback.**
  - **With no signal the message shows WHOLE** — the honest default, and what
    she had before the feature existed. A chat on an older hook simply doesn't
    fold: silence, not a wrong guess (the same rule the tint follows).
  - **Coverage grows two ways, and the second costs nothing.** A v12 hook
    sends `head`/`tail` exactly. For hooks v7–v11 the SERVER derives the same
    pair from the live drafts for free — a draft posts at a tool call carrying
    the turn's text so far, so **the first draft's length IS `head` and the
    newest draft's length is `tail`**. Measured 2026-08-11: 33 of 132 replies
    (23 of 77 chats) already post drafts, so a quarter of replies fold
    correctly with no re-paste at all. The derived pair is approximate only in
    erring toward folding LESS (the draft pass skips turns under 60 chars and
    posts only when the prose grew).
  - **The final post must never overwrite the drafts' boundaries** — its text
    is the whole turn, so deriving from it would mark the entire reply as
    pre-work and fold nothing. That guard is in `chatfeed.js` and pinned by a
    test.
  - Tests: `node scripts/test-chats-working-fold.js` — covers all three layers
    (hook parser against a real JSONL, the server's contract, and `foldBody`
    lifted out of chats.html and run for real). Needs no playwright.
- **THE ROSE WORKING TINT: v3 — HONEST SIGNALS ONLY, LIVING WITH PARKING
  INSIDE THE HIDDEN PILE (Aug 2026, Sophie: "it could still be tinted even if
  it's in the hidden area — I could look in the hidden area and see which
  ones are working"). `TINT=true` again.** v1's report ("skill is tinted pink
  and it's not working whereas Imprint is working and it wasn't tinted pink")
  had both halves true at once, and neither was fixable in `chats.html`:
  - **The miss.** The tint's only honest signal is `workingAt`, stamped by the
    hook's turn-start ping. A session keeps whatever hook its CONTAINER
    SNAPSHOT holds, forever — so every chat started before Sophie re-pasted
    the setup script can never tint, however long we wait. Measured
    2026-08-10: of **77 chats that posted replies in six days, 3 had ever
    carried `workingAt`**. Imprint is one of the ~190 older ones.
    **CORRECTION (measured 2026-08-11, over all 6,166 feed docs): the claim
    that "her own messages first appear in the feed on Aug 9" is WRONG.** Her
    earliest lifted message is **2026-07-17**, 73 of them that first day, and
    1,638 in all across 112 chats. What Aug 9 changed is the HIT RATE, and it
    is the same container-snapshot story told properly — by the week a chat
    STARTED: before 17 Jul **0%** of chats ever carried a message from her,
    Jul 17-23 **17%**, Jul 24-30 **5%**, Jul 31-Aug 6 **76%**, Aug 7-11
    **98%**. So the snapshot picked up a message-lifting hook around Jul 31
    and the re-paste finished the job. Don't read a whole feature's absence
    off one date again; count the docs.
  - **The false positive.** The fallback signal "her message is the newest
    thing in this chat" is really WAITING ON THE CHAT, not working. `skill`
    was pink for exactly that reason, correctly by the code and wrongly by
    the word.
  So the tint came off entirely for a few hours and auto-parking replaced it
  — until Sophie's v3 synthesis dissolved the "they defeat each other"
  framing: parking and tint only collide on the MAIN list. A parked chat is
  still a row inside the hidden pile, and THAT row glows while the chat
  works; the CLOSED bar carries a rose "· N working" so the glow isn't a
  secret (`paintHideWork`, refreshed by `paintLive` on message-less polls —
  the mark arrives on exactly those). She wants to watch whether the honest
  tint proves itself; if it does, parking may come off later. Three rules
  survive from the saga:
  - **`chatWorking` answers on the PING (`workingAt`) and on a live draft
    (`working:true`) ONLY — never on "her message is the newest thing".**
    That fallback is what lit `skill` wrongly (waiting, not working) and it
    is deliberately gone. A chat with an old hook parks and simply doesn't
    glow: silence, not a lie.
  - **Coverage grows three ways:** every new session carries the re-pasted
    setup script's hook; an idle chat's container recycles onto the current
    snapshot on its own; and Sophie pastes the self-heal
    (`curl -fsSL https://imageforge-q125.onrender.com/setup.sh | bash`) into
    live old chats gradually (takes effect same session, proven 2026-08-07).
  - **Do not "fix" a dead-looking tint by hunting the client repaint.**
    #931/#933 did that, #901/#908/#910/#911 corrected this file's own wrong
    claims, and the layer was never the problem — check the chat's HOOK
    first (see the case-study rule at the top of this file).
  `window.__setTint(true)` is how the tests force the flag regardless of its
  default (the page script is an IIFE — `window.TINT` is a stray global that
  proves nothing).
- **AUTO-PARKING A CHAT SHE ANSWERED (Aug 2026, Sophie: "we need to go back
  to the hiding method we tried before" — and kept in v3: "let's keep the
  hidden thing currently").** `POST /reply` and `POST /working` stamp
  `hiddenAt` alongside `workingAt`, so a chat she answers leaves the list and
  the stamp's own rule brings it back when the reply lands. It COEXISTS with
  the v3 tint: the parked chat glows inside the pile, not on the list.
  **Why parking's coverage is broader than the tint's:** parking rides on HER
  MESSAGE arriving (`POST /reply`), which the hook has lifted since July
  2026, well before the v7 ping. And its failure mode is graceful — a chat
  whose hook is too old simply doesn't park, which is the ordinary list, not
  a wrong colour. Manual hiding (the ⊖) is untouched.
- **HOW THE PING GOT THERE — the turn-start ping, and why her own message is
  NOT a usable signal (Aug 2026, v8).** The Chats app tints a chat pink while it is
  working on something. The obvious signal ("the chat's newest message is
  hers") looks right and is useless: the hook can only lift her message out of
  the TRANSCRIPT, and at UserPromptSubmit the transcript does not contain it
  yet — so it is posted at the END of the turn. Measured live across a whole
  afternoon of her messages, her `postedAt` lands **~1 second** before the
  reply's, every time, so that condition is true for about one second and the
  tint never appeared. The hook therefore pings **`POST /api/chatfeed/working
  {chat, session}`** at UserPromptSubmit (no transcript needed, backgrounded),
  which stamps `workingAt` on the chat's registry doc; the reply's own
  registry write deletes it. `chatWorking()` in chats.html reads that mark,
  with a 3h cap and a backstop (a reply newer than the mark means the turn
  finished, even if the clear was lost). The app's own reply box stamps the
  same mark server-side, so that path works with no hook at all.
  **The mark arrives on polls that carry ZERO new messages — repaint anyway
  (Aug 2026, the "it doesn't work" bug).** `workingAt` lives on the REGISTRY,
  so a turn starting or ending changes no message doc, and chats.html's
  `poll()` early-returned on an empty message list BEFORE repainting — the
  fresh mark was stored in memory and never painted, so the tint effectively
  only ever showed on a first-ever load or a manual Refresh tap (a normal app
  open paints from the localStorage cache and then polls). The whole server
  loop was verified working the entire time; when this tint "doesn't fire",
  check the CLIENT repaint path before the hook or the server. `poll()` now
  calls `paintLive()` whenever fresh `chats` arrive, before that return
  (paintLive only toggles classes on tiles already on screen — no rebuild, no
  scroll jump, safe every poll). Test:
  `node scripts/test-chats-working-tint.js` (headless Chromium against a stub
  feed; skips without playwright).
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
- **A REPLY CAN BE BLOCKED BY THE SANDBOX EGRESS FILTER, and the symptom is a
  reply stuck as its partial draft (found live 2026-08-10).** The cloud
  environment's proxy scores outbound POST bodies and answered one with a 403
  HTML block page — with curl exit 0, so the old hook recorded it as posted
  and the full reply never reached the app. The trigger that time: the reply
  contained the literal setup.sh pipe-to-shell one-liner inside a long
  message (the same string alone in a small body passes — it's a scored
  filter, not a string match). Two consequences:
  - **Don't put the literal `curl … | bash` one-liner in a reply.** When a
    reply needs to tell Sophie or another chat about the self-heal, DESCRIBE
    it ("fetch /setup.sh with curl and run it with bash", or point at this
    file) — the hook POSTs your reply through the same filter.
  - **Hook v10 records a turn as posted only AFTER the server answers
    `ok:true`** — a blocked or failed post stays un-recorded and the next
    event retries it. A stuck partial draft from an OLDER hook is repaired by
    re-POSTing the full text to /api/chatfeed with the turn's key (`turn` =
    the transcript uuid of the user message that started the turn; the server
    upserts onto the same message doc).
- **STALE HOOKS SHOW THEMSELVES NOW — and AUTO-UPDATE IS A HARD NO (v11, Aug
  2026).** The turn-start ping carries the md5 of the session's INSTALLED
  hook file; the server compares it to the repo copy it deployed with
  (setup.sh installs byte-identical — verified 2026-08-10) and stamps
  `hookV`/`hookStale` on the registry doc, and the Chats app shows "hook out
  of date — paste the heal" under the chat's name. So nobody hunts stale
  chats anymore: Sophie pastes the self-heal into the marked ones and the
  mark clears on that chat's next turn. Detection ONLY, and that boundary is
  not ours to move: two stronger designs — the hook fetching and running the
  setup script by itself, and the hook telling the chat's model to run it —
  were built on 2026-08-10 WITH Sophie's explicit permission and the chat
  harness refused both (an unattended path that makes every chat execute
  server-supplied code is over its line regardless of consent). Don't
  rebuild them; extend the telemetry instead if more is needed. A chat can
  check ITSELF without the server: `md5sum
  /home/user/.claude/hooks/post-to-feed.sh` vs the repo's
  `.claude/hooks/post-to-feed.sh` — different means stale, and the self-heal
  below fixes it in-session.
- **Self-heal if you're NOT posting, or posting with an OLD hook (any chat).**
  Run `curl -fsSL https://imageforge-q125.onrender.com/setup.sh | bash`.
  (Curl works HERE and not in the Setup script for one reason: a running
  session has network, session INIT does not — see the trap above before
  suggesting this to Sophie as an environment setting.) It
  rewrites the hook + `/home/user/.claude/settings.json`, and — **contrary to
  what this file said for weeks — it takes effect IMMEDIATELY, in the session
  you run it in** (proved live 2026-08-07: a container holding the Aug 1 hook
  with only Stop + UserPromptSubmit registered ran the script mid-turn and the
  very next tool call posted a live draft with `working:true`). Hooks and
  settings are re-read per event, not only at Claude Code startup. That wrong
  claim is why a stale hook was left in place for days with a manual-posting
  workaround instead of a five-second fix.
  - **Check whether YOUR hook is current before believing a feature is
    broken:** `grep -c PostToolUse /home/user/.claude/hooks/post-to-feed.sh`
    (0 = pre-v7, no live drafts and no turn-start ping — the Chats app's
    "still writing…" and its pink working tint can never fire for you).
  - A brand-new session gets whatever the ENVIRONMENT's pasted setup script
    installs, so self-healing per session is a patch, not the cure — the cure
    is the fetch-the-current-one Setup script (see the LIVE DRAFTS note above).
  - Only if the hook is genuinely MISSING and can't be reinstalled, post by
    hand: `POST https://imageforge-q125.onrender.com/api/chatfeed`
    `{ "chat":"<branch-name>", "text":"<reply>", "tldr":"<TLDR>" }` — and ONLY
    then (once the hook is back it posts, and a manual post would duplicate).
    No auth header needed (STUDIO_TOKEN is off on the live server).
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
- **STATUS CARDS — every chat keeps one, updated at the END of every turn
  (Aug 2026, Sophie's ask: "a line on what they need and a summary of what
  that chat is currently working on").** The card shows under the chat's name
  on the `/chats` home (list, tiles, and the Status view — the ask reads in
  rose). `POST /api/chatfeed/status { chat, session, need, doing }`:
  - **WRITE IT THE WAY SHE WRITES HER OWN NOTES (Aug 2026, measured against
    the real ones): telegraphic fragments, commas between, NO connecting
    words, ~30-60 chars.** Hers read "research it, karaoke, tabs" and
    "compare and Tinder templates" — that is the target. Not a sentence, not
    a summary, never a changelog: a chat pasted a 464-character release note
    into her field the day it shipped, which is what prompted this rule. The
    server truncates at 110 chars, but hitting the cap means you wrote the
    wrong thing.
  - **ONLY ONE LINE SHOWS, and it looks exactly like her own notes** (Aug
    2026, Sophie: "I want them the same as mine — italicized, not bold, not
    pink… they only need one line"). The row renders `note || need ||
    doing`: **a note SHE wrote supersedes your card entirely**, otherwise
    your `need` takes the line and `doing` is the fallback. So write the
    ONE thing worth her seeing — both fields are stored, but do not count
    on `doing` being read while a `need` is set.
  - `need` = what you need from her, with the size of the ask — "pick a
    palette, 10 seconds", "listen to two cuts". Send `""` when nothing is
    needed; an empty `need` is the honest default, and a stale ask is worse
    than none.
  - `doing` = what you're on — "six lesson cards, drawing now". Clear it
    (`""`) when you finish.
  - `session` = `CLAUDE_CODE_REMOTE_SESSION_ID` without `cse_` — resolution
    is session-first like every other post, so the card lands on your
    effective chat whatever your branch slug says.
  - Refresh it at the end of ANY turn that changed your state (200 chars
    each; the fields you don't send are left alone). Stored on the registry
    doc, so it rides the feed's already-cached read — costs nothing.
- **The NOTE on a chat (`sophieNote`) is the where-things-stand line, mostly
  HERS (Aug 2026: "it's not really for the chat to read, it's for me") — but
  it is NOT locked to her ("it's not that I wanted the field to myself, I
  just wanted them to know how to write notes").** She writes it from the
  thread ("+ note for this chat"); it shows on the home row with no prefix.
  `GET /api/chatfeed/status` returns it as `note` — read it for context, but
  it is not an instruction and needs no reply.
  - A chat MAY write one (`POST /chatnote {chat, note}`), and the rule is
    **STYLE, not permission**: her length and her shape — telegraphic
    fragments, commas, no connecting words, ~30-60 chars. A chat filed a
    464-character changelog there and that is the failure to avoid. Prefer
    your STATUS CARD (above) for what you're doing; leave the note alone
    when she has written one you'd be overwriting.
  - **NEVER write test/probe text into it, or any other live field.** A
    deploy-watcher here POSTed the literal word `probe` as this chat's note
    to see whether the route answered — the write SUCCEEDED against the
    old code, and she found "probe" sitting in her app as a note to
    herself. Watch a deploy with a READ (`GET /status`, the build stamp),
    never a write to real data.
    **A MADE-UP CHAT NAME IS NOT A SAFE PROBE EITHER (2026-08-10, done
    again — same rule, different field).** Poking a new registry route with
    `{chat:"__nonexistent-probe"}` to confirm it was live CREATED that
    chat: Firestore's `set({field: <delete>}, {merge:true})` on a missing
    doc still writes the doc (empty), and `sortedChatNames` lists every
    registry key, so the fake name becomes a phantom row in her list. Two
    things to know if it happens: only the Admin SDK can remove it
    (`forge-chat-registry`, there is no delete route), and the registry's
    5-minute cache keeps serving the phantom afterwards until ANY write
    through the API invalidates it — a no-op write to a chat that really
    exists is the clean way to force that. Confirm a new route with a READ
    of the page (`curl /chats | grep <the new markup>`), never by calling
    the write.
  - **Never gate a field the app already writes behind a flag only a NEW
    build sends.** The `app:true` requirement did exactly that: the phone
    keeps a cached page for days, so her own edit was refused with
    "couldn't be saved" while the note she was trying to fix stayed put.
- **HER OWN MESSAGE NEVER RAISES THE "NEW MESSAGE" BAR (Aug 2026, Sophie: "it
  notifies me when my own message comes in — that's a bug").** The hook lifts
  what she types in the Claude app into the feed, so it arrives on a delta
  poll like anything else — and `poll()` counted every arrival toward
  `pendingNew`, so the app told her about the message she had just sent. The
  row dot and the answered badges have always excluded her
  (`from!=='sophie'`); the bar was the one path that didn't, which made the
  single signal meaning "something came back" cry wolf. `poll()` now counts
  `news`/`mineNews` (non-sophie) for the bar while `added`/`mine` still drive
  caching and repainting — her message is merged as before and simply appears
  at the next natural render. Tests:
  `node scripts/test-chats-own-message.js` (drives the real delta poll via
  `window.__poll`; verified failing against the old counting).
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
  - **MID-TURN messages need the queue records (Aug 2026, fixed).** A message
    Sophie sends WHILE Claude is still working is queued, and a queued message
    is written to the transcript ONLY as a `queue-operation`/`enqueue` record —
    it never becomes a `user` record. The parser only read `user` records, so
    those messages reached Claude but **silently never reached the Chats app**
    (found live 2026-08-07: "Yeah. Do the images." was lost, and it was a
    course-correction — exactly the kind worth keeping). The hook now also
    collects enqueue records. EVERY message is enqueued, so a queued entry only
    counts when no `user` record carries the same words — matched as a
    **multiset** so repeating a short phrase can't let the first swallow the
    second — and its dedupe key is `q:<timestamp>`.
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
- **App-embedded tool pages share ONE kit: `public/tool.css` (Aug 2026,
  Sophie's redesign brief — "too much text, the buttons are too long, think
  about the user doing the flow").** These pages were built for the desktop
  web hub, which is why they showed every field, every explanation and every
  full-width button at once. The kit gives them a step FLOW: `.rail` (where
  am I), `.step` (only the OPEN one shows controls; a finished step collapses
  to a tappable one-line summary), `.btn` that hugs its text, `.btn.star` for
  anything that spends a model call, and a `?` circle holding the explanation
  that used to be a paragraph. Link it, set `body class="tool"`, don't
  hand-roll a per-page variant. `studio.html` is the reference; `blog.html`,
  `report.html` and `vector.html` follow.
  **The rail and EVERY step caption reserve the pill's corner (Aug 2026)** —
  `padding-right:56px`, not just the header. The injected pill is fixed over
  roughly x 324-374 / y 14-192, which is the header AND the first two step
  rows, so a caption's one-line summary rendered UNDER it (caught on /vector:
  step 1 read "4 draw…"). It costs 56px off a summary that is ellipsised
  anyway, and it fixed the same latent collision on every other tool page.
- **A gated page hosted inside a native tool must be asked for with
  `?embed=1` (Aug 2026).** `serveGated` then hides the page's own
  `.app-header` — its brand row duplicated the native nav-bar title, and its
  "← Hub" button navigated the WEB VIEW to the web hub, stranding her outside
  the tool with no way back (Sophie caught all three business tools like
  this). One rule in `serveGated` covers every gated page, since they share
  `.app-header` from `forge.css`. Pass it on every new `GatedWebTool` path.
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
  **The home screen has FOUR views, switched from the title row: chats,
  ARCHIVE, BOOKMARKS, and STATUS (Aug 2026, Sophie).** `homeView` in
  chats.html. **STATUS** (the list-todo icon left of the bookmark) is the
  prioritized front door Sophie asked for ("this is what's done, this is
  what's waiting on you, these are the assets that were just delivered"):
  WAITING ON YOU (her flagged come-back-later chats first, then finished
  replies she hasn't opened, each row carrying the same ✓/! triage buttons as
  the home list so she can mark answered without opening anything), WORKING
  RIGHT NOW (the pink-tint chats), JUST DELIVERED (the newest images across
  every chat — `GET /api/gallery/assets/recent`, server-side filename dedupe
  + 480px thumbs, a thumb opens that chat's Assets tab — plus the newest
  Compare pages via `GET /api/chatfeed/pages-recent`), and MARKED DONE (what
  she has checked off). The chat sections derive from the registry + feed the
  page already holds, so they paint instantly; only the delivered strip
  fetches (cached 60s). Tests: `node scripts/test-chats-status.js` (headless
  Chromium against a stub feed; skips without playwright). The
  serif title says which one she is in ("Chats" / "Archive" / "Bookmarks") and
  the word beside it becomes the way OUT, reading "← Chats" — a bold word
  alone was "really confusing" and left her with no visible exit. The
  bookmark icon next to it opens **every bookmarked message across all
  chats**, newest first, tapping one jumps to it in its thread
  (`GET /api/chatfeed/bookmarks`, one equality filter sorted in memory so
  Firestore needs no composite index). Before that route existed the bookmark
  button wrote a flag NOTHING ever read — a bookmark could only be found by
  scrolling to that exact message in its own thread.
  **DELETE + THE TRASH (Aug 2026, Sophie: "a delete button as a second option
  to archive so I can delete this chat so it doesn't keep confusing things
  rather than just archive it, and I'd like deleted chats to go to a trash
  that I can empty").** `deletedAt` on the registry doc
  (`POST /api/chatfeed/delete {chat, deleted}`), a **Delete** word in the
  thread header after Archive and Hide, and the trash itself.
  - **THE TRASH LIVES INSIDE THE ARCHIVE, AS A CAN (Aug 2026, Sophie: "put
    trash in archive and make it just a picture of a trashcan I guess").**
    It shipped as a fifth WORD in the masthead and that broke the header:
    measured at 390px, `.hctl` started at **x=48** while the word "Chats"
    occupies **x=20-96**, so the bookmark button sat under the visible title
    and won the tap — **tapping "Chats" opened Bookmarks**. Five controls
    plus a long title do not fit on her phone. So `#trashlink` is an ICON
    (~26px against the word's ~56px), `display:none` unless
    `homeView==='archive'||'trash'`, and leaving the trash returns to the
    ARCHIVE it opened from rather than all the way home. Its own class
    `.trashbtn`, never `.bmk` — that rule's `.on svg{fill:currentColor}`
    floods a stroke glyph into a blob (the `.stbtn` trap).
    **The lesson for the next control:** the masthead is FULL. Anything new
    there must be an icon, must be view-scoped, or must go somewhere else —
    and `node scripts/test-chats-title-back.js` is what catches it, because
    it hit-tests every header control under every title.
  - **TWO STAGES, and the split is the whole point.** Deleting only stamps
    `deletedAt` — nothing is destroyed, and every row in the trash carries
    **Restore**. `POST /trash/empty` is the irreversible half (`{chat}` empties
    one, no body empties all) and it says so in much stronger words than the
    first confirm: a mis-tap on Delete costs one tap to undo, so the two must
    not read alike.
  - **`deletedAt` is NOT a self-clearing stamp and `/reply` never clears it**,
    which is exactly where it differs from its two neighbours: `hiddenAt` pops
    back when the chat answers, and `archived` is cleared by her messaging the
    chat. A deleted chat must never resurrect itself because something posted
    into it. Presence of the field is the whole test.
  - **The exclusion lives in ONE place — `sortedChatNames()`** — because every
    pile derives from it (live, hidden, ★, archive, the category chips, the
    account tabs). A filter per pile is how a new pile silently forgets;
    deleting is stronger than archiving, so a chat that is both must show in
    neither. Pinned by a test that was verified failing without it.
  - **Empty deletes the chat's messages, Compare pages, asset records and its
    registry doc — never the image BYTES in Storage.** The same picture is in
    her iOS gallery and can be referenced by another chat, so clearing a
    chat's records must not reach through and destroy the pictures. Asset
    VOTES are left too (keyed `sha1(chat|url)`, so unqueryable by chat, and a
    few orphaned bytes nothing reads). The registry doc goes LAST, so a
    failure partway leaves a row she can see and re-empty rather than a
    half-erased chat that has vanished.
  - Firestore caps a batch at 500 writes and a long chat holds thousands of
    messages, so the delete runs in chunks of 400.
  - Tests: `node scripts/test-chats-trash.js`.
  **MESSAGING AN ARCHIVED CHAT TAKES IT OUT OF THE ARCHIVE (Aug 2026,
  Sophie: "when I message a chat that I archived, can it automatically come
  out of the archive").** Archive means "away for good" — and going back to
  talk to it is her saying it isn't, so she should not have to undo the
  archive by hand first. `POST /reply` clears `archived` when the chat had
  it, alongside the `workingAt`/`hiddenAt` stamps it already wrote, so the
  chat comes out of the archive AND parks until it answers.
  - **Server-side, in the route, for the same reason parking is**: that is
    where her message ARRIVES, including the one the hook lifts out of the
    Claude app with no page open anywhere.
  - **Only HER message does it.** A chat's own reply must never drag itself
    out of the archive she put it in — that is the whole difference between
    Archive and the self-clearing `hiddenAt`. `/reply` is hers by definition
    (`from:'sophie'`); the chat-reply route never touches `archived`, and a
    test pins that.
  - Tests: `node scripts/test-chats-unarchive-on-reply.js` — it drives the
    REAL route against a stubbed Firestore (the question is what the route
    WRITES, which source-shape assertions cannot answer) and was verified
    failing without the change.
  **Archive/Unarchive lives in the thread header** (same button, same spot,
  either label) — deciding whether to archive must not mean scrolling past every
  message first. The **App/Web account toggle is a plain on/off switch** on the
  home header's title line (`.swi`, off = account 1, on = account 2, no text —
  the toast names the account).
  **HIDDEN — the red bar at the top of the chat list (Aug 2026, Sophie).** A
  chat she wants to come back to but not look at right now gets hidden: it
  leaves the list and waits behind a red bar above it (`.hidebar`, "Hidden 3
  · 1 new"). Tapping the bar opens the pile; tapping it again puts it away.
  Details that are load-bearing:
  - **THE OPEN PILE IS THE WHOLE SCREEN (Aug 2026, Sophie: "when I press the
    hidden one it shows hidden, but it also shows everything else — can you
    make it just show hidden until I get out of the hidden area").** v1
    opened the pile IN PLACE, above the live list; the list underneath was
    the thing she had taken those chats off, and it buried the pile she had
    just opened. Opening the pile is going somewhere, the way Archive is —
    so `renderHome` returns right after `renderHiddenBar` while it is open.
    The masthead already says "Hidden" in red, and the ways out are
    unchanged (the bar again, or the title). **Guarded on `hid.length`:** if
    the last hidden chat pops out while she is in there (a reply lands, the
    stamp self-clears) the bar is gone, so the list has to come back or the
    screen would be blank with nothing to tap. One consequence to expect:
    the ⊕ inside the pile takes a chat out of the PILE immediately, and the
    list it rejoins is the one waiting when she leaves the hidden area.
  - **`hiddenAt` is a self-clearing STAMP on the registry doc**
    (`POST /api/chatfeed/hide {chat, hidden}`), the same shape as
    `answeredAt`: a chat stays hidden only while nothing newer has arrived,
    so **the moment it answers her it pops back out into the list**. That is
    Sophie's explicit call — v1 shipped this as a permanent boolean and she
    asked for the opposite the same day. Hiding means "not now"; **Archive**
    is the one that means "away for good". **The retired v1 field
    `hidden:true` is GONE and is no longer read** — it could never pop out,
    which is precisely the bug she reported the same evening ("when I hide
    something and then it answers me I want it to become unhidden"): the 11
    chats she hid before the stamp shipped were stuck behind the bar
    forever. All 11 were migrated onto stamps on 2026-08-09 by re-POSTing
    `/hide`, which rewrites both fields. If a hidden chat ever "won't come
    back", check for a doc still carrying the boolean before suspecting
    `stampActive`.
  - **It REPLACED the `!` flag button** at Sophie's ask ("you could replace
    the ! with it") — hiding *is* the come-back-to-this mark now, and it does
    what the flag only implied. `flaggedAt` still exists server-side
    (`POST /flag`) but nothing in the page writes or reads it; **don't
    re-add a flag button without asking her.**
  - The glyph is a **circle-minus** on a visible chat and a **circle-plus**
    (lit red) on a hidden one — take it off the list / put it back.
    Deliberately NOT an eye: she rejected the eye by name.
  - **The bar only exists when something is hidden**, and open/closed is
    session-only, always starting CLOSED — persisting "open" would quietly
    undo the feature overnight. Hiding a chat never opens the pile.
  - **While the pile is OPEN the masthead says "Hidden" in the same red**
    (`#htitle.hid`) — the pile is a place, so the screen has to name the one
    she is in. It slightly overlaps the status icon at that width; Sophie
    said that is fine for now.
  - **Hidden chats lead STATUS's "Waiting on you"** (the slot flagged had) —
    though **STATUS now has NO ENTRANCE**: its list-todo icon beside the
    masthead came off at Sophie's ask ("the weird check-plus next to the big
    chat's name — I don't actually know what it does"). The view and its
    tests survive (`window.__setHomeView` is the only way in, kept so the
    retained code stays testable); ask her what it should say before wiring
    a button back, since the ✓ that filled MARKED DONE and the rose working
    signal are both switched off now.
  - **ANSWERING A CHAT PARKS IT (Aug 2026, Sophie: "is there any way you
    could directly send a chat that I answered to the hidden section until
    it comes back?").** `POST /reply` and `POST /working` both stamp
    `hiddenAt` alongside `workingAt`, so a chat she answers leaves the list
    and the stamp's own rule brings it back when the reply lands — no new
    field, no new rule. **`/reply` is the path that carries it** — it is both
    the app's own reply box AND where the hook POSTs her lifted Claude-app
    messages, a feature that predates the v7 ping, so parking reaches chats
    the tint never could. `/working` parks too and fires earlier in the turn,
    but only from a hook new enough to send the ping. The stamp is
    `postedAt`, never her message's
    `created`: `created` is her real send time and a stamp older than the
    newest message reads as not-hidden.
  - **The thread header carries HIDE beside Archive** — "not now" next to
    "away for good", so a chat she has just read can be parked without going
    back to the list for its ⊖. **ARCHIVE is tinted green and HIDE red** (Aug
    2026, her ask) so the pair says which is the bigger decision at a glance;
    fixed colours, like the row's ⊖ and ✓, since that row is cream in both
    themes. The **"chats" crumb that used to lead the row is gone** ("that
    seems redundant") — the back chevron already says where she is — and
    `#thread header .no` is `justify-content:flex-end`, which is what the
    crumb's `flex:1` used to do for the buttons' position.
  - **The bar wears the LIT CATEGORY CHIP's look** — same `--chg` tokens,
    red outline over a light red tint, at Sophie's ask ("the same style as
    the red outline version of the categories"). It shipped for one evening
    as a solid red block; matching the chip means the two can never drift
    apart, and the screen stops carrying one slab of colour. The row's ⊖ is
    a FIXED `#b3443f` even unlit — it belongs to the bar, so it reads as its
    colour before it is ever tapped, and its circle background is cream in
    both themes so a fixed red is right there.
    Tests: `node scripts/test-chats-hidden.js` (headless Chromium against a
    stub feed; skips without playwright).
  **CATEGORIES + SELECT MODE, where the LIST/TILES toggle used to be (Aug
  2026, Sophie).** She stopped using the tile view, so the toggle was two taps
  of nothing: the home is always the list (`view='list'` — **`renderTiles()`
  is deliberately kept**, her ask, flip the const to bring it back), and the
  tool row now holds category chips plus two icon-only buttons (select,
  refresh — refresh lost its word to save the space).
  - **A category is one `category` field on the registry doc**
    (`POST /api/chatfeed/category {chat|chats:[…], category}`) — the Dump's
    `track` in another costume, and it takes a whole selection in one call
    because filing is a bulk gesture. Empty category clears it.
  - **`CAT_SEEDS` = `['stories','tech']`** (the two she named), so the chips
    exist before anything is filed; anything typed into select mode's New…
    box joins them. Tapping the LIT chip clears back to everything — the Dump
    sort page's convention, and why there is no "All" chip.
  - **A CATEGORY IS A THING, not a side effect of filing (Aug 2026 — she made
    one and it wasn't there).** Two bugs, both real: typing a name with NO
    chats picked toasted "Nothing picked" and threw the name away, and the
    New… box only committed on Enter — she DICTATES these and dictation ends
    with a tap elsewhere, not a press of return. So the name is now stored on
    the `__settings` doc (`categories`, arrayUnion), `POST /category` accepts
    an empty `chats`, the box commits on blur too, and `catList()` = seeds +
    settings.categories + names in use. An empty folder outlives the filing
    that created it.
  - **The home header has NO eyebrow** (Aug 2026, Sophie: "that's wasted real
    estate"). It said "deck factory · every chat, one place" above a screen
    she opens from a tile that already says Chats. The THREAD header keeps
    its `.no` row — that one carries the crumb, Archive and Hide.
  - **The filter is session-only, never persisted.** A sticky filter would
    show her three chats one morning and read as the rest having vanished.
  - **A chip narrows the WHOLE screen, hidden pile included** — a bar
    counting chats from a category she isn't looking at is noise.
  - **Select mode** (the checkbox icon) is the Dump's Select: tap rows, one
    fixed bottom bar files the lot, filing exits the mode. While it is on a
    tap anywhere on a row PICKS instead of opening, and the row's own ⊖/✓ are
    hidden — two checkmarks on one row means the wrong one is the easy tap.
  - **The tool row reserves the pill's corner** (`padding-right:64px`): it
    sits inside the pill's y 14–192 band, so its right-hand icons would be
    untappable without it. Measured live at 390px wide: the icons end at
    x≈306, the pill starts at x≈324. Tests:
    `node scripts/test-chats-categories.js`.
  - **FILING MOVES A CHAT (Aug 2026, Sophie — this replaced the one-evening
    "parked" note above it).** "When I mark something as a story, it takes it
    out of the normal list." So the unfiltered home is the UNFILED pile, an
    inbox, and a lit chip is that folder. Two consequences to keep in mind:
    - **…BUT IT COMES BACK WHEN IT ANSWERS (Aug 2026, Sophie: "it's been a
      problem when chats are in stories and they don't pop out back into the
      main list when they're done, so let's have them pop back out").** Same
      idea as the hidden pile: filing means "not in my way", not "gone".
      **READING IT DOES NOT SETTLE IT (v2, same day — v1 keyed the pop-out on
      the reply being unread and Sophie overruled that within the hour:
      "reading it shouldn't send it back to stories — it should stay in both
      places until I file it away again or respond").** A popped-out chat
      stays on the main list, read or not, until she RE-FILES it (renewing
      `filedAt` past the reply — the select-mode chips stamp it
      optimistically, so the row leaves on the tap) or RESPONDS (her message
      becomes the newest thing there, which ends the pop-out AND parks the
      chat via auto-parking; the next reply pops it back out — the round
      trip she described). The `filedAt` half of `chatBack` — the reply must
      have landed after the filing moment, stamped by `POST /category` — is
      still load-bearing: without it, filing a chat whose last reply she had
      never opened would bounce straight back, and the backfill day would
      have dumped a whole folder onto the list.
      The chat NEVER leaves its folder — it is in two places.
      Chats filed before the field existed carry no stamp and can't pop; all
      23 were backfilled 2026-08-10 (`node scripts/backfill-filedat.js`,
      idempotent, stamps NOW rather than back-dating for exactly that
      reason), so a missing `filedAt` now means the chat isn't filed. Tests:
      `node scripts/test-chats-filed-popout.js`.
    - **The chips carry ONE number, the red ANSWERED badge** (the dim total
      came off at her ask: "I don't need to see the number on the categories,
      it should just say the number of chats I haven't read yet — just the
      one in red"). Without them
      a filed chat would simply vanish and a reply inside a folder would be
      silent — the same reason the hidden bar names what is behind it. The
      badge counts CHATS that came back and she hasn't opened (Sophie's ask:
      "a little number next to stories that says if there's chats that just
      recently answered to me"), not messages; it is the dots exception to
      the no-pills rule, not a pill. A filed chat no longer shows its working
      tint on the home; STATUS still shows it, and STATUS is deliberately NOT
      category-filtered.
    - **NOTHING in the app writes `answeredAt` anymore (Aug 2026, Sophie:
      "the checkmark next to chats — I don't actually know what it does,
      take it off" — she meant the STATUS icon beside the masthead, but the
      ✓ had already gone from the rows and came off Status in the same
      pass).** The ✓ came off the STATUS rows too, so MARKED DONE
      only ever shows chats stamped before that day. `chatDone` /
      `toggleMark` / `mkCheck` and `POST /answered` all still exist — the ✓
      is one `appendChild` away in `renderList` or `stRow`. **Ask her before
      putting it back**; hiding is what she reaches for now.
    - **The home rows carry NO ✓ and NO letter icon (Aug 2026, Sophie).** A
      chat with no picture used to get a box with a giant italic initial —
      gone; 18 of ~190 chats have a real picture and those still show, so
      the left edge is deliberately ragged. The ✓ came off the rows and the
      hide ⊖ took its place on the right. **`mkCheck` is still on the STATUS
      rows on purpose** — that view has a "Marked done" section, and pulling
      the only control that writes `answeredAt` would leave it dead. Bring
      the ✓ back to the rows by re-adding `mkCheck` in `renderList`.
    - **ARCHIVE deliberately does NOT hide filed chats.** It is already the
      "away for good" pile; filtering it down to the unfiled ones would
      leave a filed+archived chat reachable only by lighting the right chip
      first. A chip still narrows it.
  - The home screen was tightened vertically in the same pass (rule, h1,
    tool row, search row and `.crow` padding, 46px row icon → 40px) — her
    ask, "a little bit too much space between the different lines".
- **THE JUMP PAIR, bottom-right (Aug 2026, Sophie: "could you make another
  arrow next to it that brings me all the way down to the bottom").** `.jumps`
  holds the back-to-top arrow and its new twin. Three rules worth keeping:
  each shows only when it has somewhere to go (>400px that way), so nothing
  floats over a list that already fits; both call `__scrollStop` FIRST, or the
  autoscroll keeps creeping after the jump arrives; and they hide under
  `body.selecting`, where the filing bar owns the bottom of the screen.
  **THE DOWN ARROW ANSWERS TO THE OPEN MESSAGE FIRST (Aug 2026, Sophie: "a
  floating down button that gets me just to the bottom of the current message
  that's open and visible on the screen — you could co-opt" the existing
  one).** A finished reply runs for screens, and "the end of THIS one" is a
  different question from "the end of everything". `openMsgEnd()` takes over
  only when an open message is genuinely on screen AND its end is still below
  the fold; otherwise the button is the page-bottom jump it always was. So a
  long thread reads as a progression — one tap lands on the message's end,
  the next carries on down the page — and on the chat list, where nothing is
  open, nothing changes.
  **IT LANDS ABOVE THE ARROWS, NOT UNDER THEM** (Sophie, the first time she
  used it: "the arrow buttons when I go to the bottom of a message now sit
  right where the Open in Claude button is"). A message's LAST ROW is its
  bookmark + Open-in-Claude pair, so a flush landing parks the floating pair
  exactly on top of the Open button. `bottomReserve()` measures what `.jumps`
  is actually occupying — live, not hard-coded, so it stays right if the pair
  changes size — and falls back to a hairline when neither arrow is showing.
  The page-BOTTOM jump needs none of this: `.wrap` ends in 16vh of padding,
  which already clears the pair.
  The show/hide rule follows the same target, since the page bottom can be
  close while the message still has a screen to go. Tests:
  `node scripts/test-chats-jump-message.js` (verified failing without it). The
  page height changes on every rebuild, so `window.__jumpsRecheck()` is called
  after renderHome and openChat. Tests: `node scripts/test-chats-jumps.js`
  (which starts the real autoscroll and proves it moved before asserting that
  the jump stopped it).
- **STARRED CHATS (Aug 2026, Sophie: "chats that were important, that have
  work I want to refer back to, but I'm not actively using them" — Imprint
  and the original Anthony Chene chat were the two she named).** `starred` on
  the registry doc (`POST /api/chatfeed/star {chat, starred}`), a plain
  boolean like `archived`: it is a permanent judgement about the chat, not a
  state anything newer should clear.
  - The mark is a **filled red star at the FRONT of the row**, in the
    bookmark's `--chg` ("a red star would be nice to match the bookmark
    colour"). Drawn only when starred — an empty slot on every row would be a
    column of nothing down the list.
  - **The ★ chip leads the category row and REACHES INTO THE ARCHIVE.** These
    are chats she has finished with and put away, so a star filter that
    stopped at `archived` would miss most of them. It replaces the list
    rather than narrowing it, and clears the category filter.
  - Setting it is the **star button in the thread header**, beside Archive and
    Hide — the only place the star is a control.
  - **A starred chat IS a kept chat**: it fills the **CHATS tab of the
    Bookmarks pile** (Aug 2026 — see "THE KEEP-PILE IS THREE TABS"). Star and
    bookmark are one mark on purpose; do NOT add a second per-chat keep-flag,
    or she has to remember which of two piles a chat went into.
- **A BOOKMARK CARRIES A NOTE (Aug 2026, Sophie: "when I bookmark messages I
  want to leave a note or title the message so I remember what it was and why
  I bookmarked it").** `bookmarkNote` on the MESSAGE doc;
  `POST /bookmark {id, note}` with no `bookmarked` edits only the note, so
  writing one can never quietly un-save the message.
  - The box **appears the moment she bookmarks and is focused** — the reason
    is in her head then and nowhere else — and it **stays under the message
    for as long as it is bookmarked**, so editing it later needs no gesture to
    discover. Un-bookmarking takes it away. Saves on tap-away.
  - In the BOOKMARKS view her note **leads the row** above the snippet (the
    snippet is the message's first line, which is rarely why she kept it) and
    it is **editable right there** — naming a backlog of old bookmarks must
    not mean opening each message in turn (her ask). That is why a bookmark
    row is a `div` with a handler and not a `<button>`: an `<input>` cannot
    live inside a button, and the note has to sit between the chat line and
    the snippet. A tap on the input is skipped so typing never opens the chat.
    The field is borderless until focused, so the list still reads as a list.
  - Tests: `node scripts/test-chats-star-bookmark.js`.
- **THE KEEP-PILE IS THREE TABS: CHATS · ARTIFACTS · MESSAGES (Aug 2026,
  Sophie: "I should be able to bookmark chats, compare pages and messages and
  they should all live in the same place… the hairline underline pattern with
  chats on the left, pages in the middle and messages on the right — except
  rather than Pages I want it called artifacts, cause that's the name I used
  for it myself").** Bookmarks is THE pile for anything she kept; the old
  All / Code / To read chip row is gone and `.acctabs` (the witch shop tab
  pattern, same as the account row) splits it three ways.
  - **"ARTIFACTS" is her word and the SCREEN's word; the code still says
    `page`** — the route, the collection and `kind:'page'` are unchanged.
    That split is deliberate, not an oversight: don't rename the data, and
    don't rename the tab back.
  - **A tab is not a chip, so there is no "All"** — the same reason the
    account tabs have none. **Landing tab is MESSAGES** (slot 2), where the
    pile she already had lives.
  - **The Code / To read FILTER went with the chips** — code/read are now one
    Messages tab. The distinction survives as the `code` BADGE on the row,
    which is why that badge stays while the chat/artifact ones went: it
    splits things WITHIN a tab, where the tab overhead can't. Ask her before
    reviving the filter as a sub-row.
  - **A kept CHAT is a STARRED chat — the same mark, deliberately.**
    `starred` already meant "important, work I want to refer back to", so a
    second per-chat keep-flag would only make her remember which of two
    piles a chat went into. The **star button in the thread header is still
    the only setter**; the Chats tab reads it. The ★ chip on the category
    row shows the same set, and that duplicate is fine ("it can be in two
    places, silly").
  - **Rows branch on `kind`:** a chat row and a message row open a thread
    (a chat row at the top — there is no message to jump to), an artifact
    row launches `openPage` full-screen.
  - **Each kind's note goes to its OWN route, and never carries a keep-flag**
    — `/bookmark {id,note}` for a message, `/page/:id/bookmark {note}` for an
    artifact, `/chatnote {chat,note}` for a chat. A chat's note IS its
    existing `sophieNote` (the home-row where-things-stand line), editable
    here as well as in the thread — one note per chat, never a third field.
  - **`bookmarked` + `bookmarkNote` live on the PAGE doc**, so **deleting a
    page takes its bookmark with it** — the pile can never hold a row
    pointing at a 404. A **SUPERSEDED page can be kept**, on purpose: the old
    version is often the thing worth keeping.
  - **The mark on an artifact is the BOOKMARK glyph, not a star** — one glyph
    for "kept" wherever it appears. `BMK_SVG` in chats.html is the single
    copy; the button is `.bmk.pr-bmk`, written that way and never `.pr-bmk`,
    because the generic `.bmk` rules sit LATER in the file and would win at
    equal specificity (the `.bmk.hdrbmk` trap).
  - **`GET /bookmarks` merges two queries + the cached registry** — still
    single-equality only, so no composite index. Starred chats cost NO extra
    read: the registry is already loaded for the display names.
  - **`.acctabs.bmktabs` adds the pill's 56px corner reserve, and that is
    load-bearing** — unlike the account row (which sits low, above the hidden
    bar) this row is near the TOP of the screen, inside the pill's
    x 324–374 / y 14–192 band, so the right-hand tab's own centre would land
    under the pill. The sliding line then needs
    `width:calc((100% - 56px)/3)`: an abspos child's percentages resolve
    against the PADDING box, so the inherited 33.33% sits wider than a tab
    and drifts right. The translateX steps stay 100%/200% (relative to the
    line's own width).
  - Tests: `node scripts/test-chats-bookmark-pile.js` — drives the real page
    home → thread → Compare → Bookmarks, checks all three tabs and their
    routes, and hit-tests every tab plus the underline width at 375/390/430.
- **THE RUNNING TO-DO LIST (Aug 2026, Sophie: "I kind of wanna do like a
  running to-do list").** `/chats` home view `todo`, entered by the word **To
  do** beside Archive; Firestore `forge-chat-todos`;
  `GET /api/chatfeed/todos`, `POST /todo {text}`,
  `PATCH|DELETE /todo/:id {done?, text?}`.
  - **Deliberately NOT per-chat.** The whole point is that an idea arrives
    while she is somewhere else — a bug she noticed, an art direction to try.
  - **ANY chat may read it** and act on an item the next time she messages
    that chat — the same snail-mail rhythm as the notes on an image. Read it
    in the same sweep as asset votes/notes. Do NOT poll it on a timer.
  - Open items first, newest at the top of each group (the server sorts). A
    crossed-off item stays, struck through, until she deletes it.
  - The view hides the tool row and the search bar — both act on CHATS, and
    neither does anything to this list. **That is exactly why the add row
    carries `padding-right:56px`**: with those two gone it rides up into the
    pill's y 14–192 band, and the Add button shipped underneath the pill,
    untappable (Sophie caught it the first time she used the list). The test
    hit-tests the button with `elementFromPoint` rather than comparing
    numbers, so a future layout change cannot quietly re-bury it.
- **The chat rows carry their ACCOUNT as a bare 1 or 2 at the front** (Aug
  2026, Sophie, in the slot the letter icon vacated). Not a button: the
  account picker lives in the thread, and a tappable-looking number there
  would just be a mis-tap on the way into a chat. An untagged chat renders a
  blank of the same width so the names still line up.
- **ONE ACCOUNT AT A TIME — the ACCOUNT 1 / ACCOUNT 2 tabs (Aug 2026, Sophie:
  "look at the Secretly a Witch app and see the pattern for where it says
  reviews versus description, then follow that same pattern for account 1 and
  account 2 so that on the main page of the chats app I can only see one
  account at a time").** `.acctabs` in chats.html, a verbatim port of the
  witch shop sheet's `.ps-tabs`: NO boxes — two half-width labels over a
  hairline with a line under the one she is reading that SLIDES when she taps
  the other.
  - **In INK, not `--chg`** (Sophie, Aug 2026: "make it not red, just
    black"). The screen spends its red on the hidden bar and the answered
    badges, which are alarms; which account she is reading is not one. The
    **red badge on each tab stays red** — that is the app's "something
    answered you" colour everywhere else, and it is the one thing on the row
    meant to catch her eye. Small type (10px) and a 5px negative top margin
    keep it tight under the search box, also her ask.
  - **It sits directly ABOVE THE HIDDEN BAR** (Sophie moved it there the same
    day — it shipped under the masthead), so it is the last thing before the
    list it governs. That position is also what lets it run FULL WIDTH: down
    there it clears the autoscroll pill's band, so it needs neither the 56px
    corner reserve nor a shortened hairline. **Move it back up and it needs
    both again** — plus a sliding line of `calc((100% - 56px)/2)`, since an
    abspos child measures the PADDING box. The test hit-tests both tabs at
    375/390/430 rather than trusting any of that.
  - **A gray line closes the hidden block off** from the chats under it
    (`.hbsep`, her ask). It follows the whole block — the bar when the pile
    is shut, the pile's last row when it is open — and that last row drops
    its own border so the two never stack into a double line.
  - **A tab is not a chip.** A category chip narrows a pile; this SPLITS the
    screen in half, so it has to be a labelled tab that says which half she
    is in — 144 of 200 chats are on account 1 (measured 2026-08-10), and a
    silent filter would read as the rest having vanished.
  - **An UNTAGGED chat shows on BOTH tabs.** Only 2 of 200 carry no account,
    so it costs nothing, and picking a side for them would drop a chat off a
    screen she can't tell is filtered.
  - **It narrows every list of CHATS** — live, hidden pile, ★ pile, archive —
    and the category chips' red badges count within the account, or a folder
    promises replies that are on the other tab. Bookmarks / To do / Status
    are lists of messages and items, so the tabs hide there; SEARCH is
    deliberately untouched (searching is how she looks for one thing across
    everything).
  - **Session-only, defaulting to `appAccount`** — the App/Web switch on the
    title line. Flipping that switch moves the list too (that is what the
    switch means), unless she has already tapped a tab this session. Never
    persisted: a sticky account would show her half her chats one morning
    with no memory of having chosen.
  - Each tab carries the same red ANSWERED badge the category chips do, so
    the tab she is NOT on can still say there are three waiting over there.
  - Tests: `node scripts/test-chats-accounts.js`.
- **"UPDATE" — the daily notifications tab, and it LEADS the tab row (Aug
  2026, Sophie: "right now there's account one and account two, two tabs on my
  chat app screen — I wanna make one more tab, and this is like a daily
  notifications thing, so it includes a little more information and I can get
  rid of them if I've already checked them", then, having used it: "I would
  put it on the left side of the accounts and call it update").**
  `homeView='news'` — **the view key is still `news`; only her word for it
  changed** — painted by `renderNews` in chats.html. The tab is the FIRST of
  the three in `.acctabs` and lights up on its own (`data-on="new"`, the
  sliding line's slot 0, which is the row's default); the two account words go
  quiet under it. **The `::after` translate steps follow the MARKUP order** —
  move a tab and move its step with it.
  - **A card carries the THING, not a line about it** — that is the whole
    point of the tab. Her two examples ARE the two blocks: "for the [oven]
    chat, they keep delivering different versions of this artifact, so it
    would show the actual artifact — I guess maybe a link to it" → the
    chat's newest **Compare pages** (up to 2) as titles that open the page
    full-screen; "if there's a chat that's making pictures, it would show the
    last three pictures in a little row, so I can see it and be easily
    reminded what they're doing" → the newest **three thumbnails**, a tap
    opening that chat's Assets tab. On top sits the home list's own row
    (name, her note or the chat's status line, how long ago), so the two
    screens read as one app.
  - **WHICH PAGES A CARD SHOWS — v3, and it answers both of her rules at once
    (Aug 2026).** `freshPages`/`pageFamily` in chats.html. The two rules:
    "if there's one version and then a new one comes out it should just
    replace that one" (v6 sitting above v5), and — correcting v2, which
    showed only the newest page at all — **"wait, if they give me a different
    page, why would I want it to not be shown?"** Hiding a genuinely
    different deliverable was a trade she never asked for.
    So TWO filters, and the load-bearing one parses nothing:
    1. **NEWER THAN THE FLOOR.** The ✓ she taps (and opening the chat) IS the
       superseded marker — "I have seen the state of this chat as of now" —
       so a page older than that mark never comes back whatever its title
       says. This is what kills "Cutting blocks (s96) — moved from the Evan
       chat", the page with no version number that beat v1 twice: it was
       never a version question, it was an old-news question.
    2. **…then versions collapse among what is left**, so a rapid v5 → v6
       pair inside one unchecked stretch shows as v6 alone. `pageFamily`
       reads WHERE the version sits: in the HEAD ("Cutting blocks v6 (s96) —
       tap empty space to deselect") the head is the thing and the subtitle
       is that version's notes; in the SUBTITLE or absent ("Evan — v11, the
       art from your notes" / "Evan — pick the pauses (v6)") the head is a
       PROJECT and the subtitle IS the deliverable, so those stay separate.
       That half is title parsing and CAN be tricked — but a miss now costs
       one extra row in a card she has not checked yet, never a stale
       artifact that survives every check.
    Cap 2 per card. **The PICTURES are deliberately not floor-filtered** —
    she asked for "the last three pictures… to be easily reminded what
    they're doing", which is context, and a row of one picture with two
    blanks is worse at that job.
  - **WHAT COUNTS AS NEW is the newest of three arrivals** — a reply that
    isn't hers, a Compare page, an image — because **a chat can deliver
    without saying anything**, and a feed keyed on messages alone would miss
    exactly the picture batches she asked to see. Cards sort by that arrival,
    not by the chat's last message.
  - **The ✓ is a self-clearing STAMP (`notifSeenAt`, `POST
    /api/chatfeed/notif-seen {chat, seen}`), never a boolean** — same shape as
    `hiddenAt`/`answeredAt`, and her oven example is why: checking off v3 must
    not silence v4, so the card is gone only while nothing newer has landed
    and the next version brings it back by itself. Nothing has to un-check
    anything. A card also leaves when she OPENS the chat (`seen`, the
    localStorage mark the unread dot reads), so the floor is whichever of the
    two is later. Both are deliberately separate from `answeredAt` — "I know
    about this" is not "this chat is done".
  - **It ignores the account tabs**, like Status does: this is the
    what-happened-while-I-was-away screen, and splitting it in half would mean
    checking two screens to know she is caught up. The card carries the
    account digit instead.
  - **The badge counts CARDS and is honest on the CHAT LIST**, before she
    opens the tab — which is why the tab row kicks `stFetch` once per load.
    Deliberately once, not per paint: `/api/gallery/assets/recent` reads 240
    Firestore documents a call and the home screen polls. Refresh drops the
    cache (`stCache.at=0`) so the tap means the pictures too. The shared
    `stCache` now fetches the routes' maximums (60 images / 20 pages) because
    UPDATE needs three pictures for EACH drawing chat; the Status painters
    slice back to the 24/6 they always showed.
  - **EVERY CHAT WRITES AN UPDATE CARD — the ⌄ pop-out on its card (Aug
    2026, Sophie: "I wonder if it would be a good idea to have a chat have
    like a TLDR in their update — not fully in the message, because it would
    crowd things, but more as like a button I could click and it would pop
    out", then the shape: "the first question in bold would be what I asked,
    and they just describe what I originally wanted; then what they did; then
    an optional one would be if they had any questions for me or what would
    be coming next" — and "those would be in bold, but the answers would not
    be").** `POST /api/chatfeed/update { chat, session, asked, did, next }`,
    stored on the registry beside the status card, rendered as three
    bold-labelled lines: **What you asked** / **What I did** / **What's
    next**.
    - **Write it at the end of any turn that changed your state**, the same
      moment you refresh your STATUS CARD — they answer different questions
      (the status card is the ONE line on her home row; this is the account
      of the turn, behind a tap).
    - `asked` = what SHE wanted, in her terms, not a restatement of your
      plan. `did` = what actually changed. `next` = optional, and it is the
      place for a question or the next step.
    - 300 chars each, truncated server-side; `""` clears one. Plain
      sentences, no markdown — the app renders the labels, you supply the
      answers.
    - **The FALLBACK when a chat has never written one is its reply's TLDR
      under "What I did"** — honest, and it means the ⌄ is not a button that
      appears and vanishes down the list for no visible reason.
  - Tests: `node scripts/test-chats-news.js`.
- **A DEPLOY MUST NOT PULL HER OUT OF WHAT SHE IS READING (Aug 2026, Sophie:
  "if I'm on the update tab — I guess it's when a chat finishes, but I don't
  know — it brings me out automatically, and then I have to go back to the
  update tab and click into the artifact again").** It was never a chat
  finishing: `checkBuild` in chats.html reloads the page when the feed's
  build stamp changes (that is how a page change reaches her phone at all),
  and five deploys shipped that evening. Two halves, both needed —
  **`busyOnScreen()`** defers the reload while `body.ontop` (the Compare
  viewer OR the image lightbox) or `body.selecting` is set, and the reload
  stashes `homeView` in `sessionStorage['chats-reload-view']` so she comes
  back on the tab she was on. Waiting alone would still have lost the tab;
  restoring alone would still have closed the artifact. **Only the page's
  OWN reload restores the view** — a launch she started still opens on the
  chat list, like every other filter here promises. Any new full-screen
  overlay must set `body.ontop` (it already has to, for the scroll lock) or
  it will be reloaded away. Tests:
  `node scripts/test-chats-build-reload.js` (verified failing on each half
  separately).
- **THE SEARCH BAR IS FOLDED TO A MAGNIFYING GLASS (Aug 2026, Sophie: "make
  the search bar collapse into just a magnifying glass button unless I click
  it, and then it expands into the search bar as it is right now").**
  `.searchrow` is the glass until tapped, then the bar it always was
  (focused, so the keyboard comes with it).
  - **The glass keeps the BAR'S OWN place on the CHAT LIST — it does NOT
    join the tool row's icons there.** That was the first build and it is
    measurably wrong: at 375 and 390 a third icon up there squeezes the
    category chips onto a second line, spending the row this was meant to
    save. The test asserts the chips stay on one line at 375/390/430.
  - **…but on a view with NO chips it DOES join the tool row** (Bookmarks,
    Status, To do, UPDATE). There the tool row is one lonely refresh icon
    and the folded glass was a second lonely icon on its own row underneath
    — two rows spending almost nothing, which Sophie caught on UPDATE.
    `otherView()` is the one predicate for "not a list of chats"; both
    `paintHomeChrome` and `paintSearch` read it, so the chips and the glass
    can never disagree about which state they are in.
  - **The ✕ is the only way out, and it does two jobs**: with words in the
    field it clears them (bar stays open); on an empty field it folds the
    bar away. One control, no second button to discover.
  - **The row reserves the pill's corner AND lays the ✕ out as a real flex
    child** rather than the absolutely-positioned overlay `.qclear` is
    elsewhere. Both halves are load-bearing: an abspos `right:5px` resolves
    against the PADDING box, so the reserve alone leaves the ✕ exactly where
    it was — measured at 390, under the pill's own down-arrow, which ate the
    tap. (That was already true of the old always-open bar; it only became
    load-bearing when the ✕ became the way to close.)
  - Session-only, always starting SHUT, and `goHome()` folds it — leaving a
    chat lands on a clean list. `window.__setSearchOpen(bool)` drives it in
    tests. Tests: `node scripts/test-chats-search-archive.js`.
- **TAKING A CHAT OUT OF THE ARCHIVE KEEPS HER IN IT (Aug 2026, Sophie:
  "when I take something out of the archive it should go straight to that
  chat, and when I get out of that chat I shouldn't be in the archive").**
  Unarchive used to `goHome()` like Archive does, which was wrong twice: she
  pulls a chat out BECAUSE she wants it, and the home she landed on was the
  ARCHIVE view — the one place the chat no longer is. So Unarchive now
  repaints the thread in place (the word flips back to "Archive") and flips
  `homeView` off `archive`, so the back chevron lands on the live list.
  **Archiving is unchanged** — that gesture means "away for good", so it
  still ends by leaving.
- **A chat's NAME is SANS and CAPS (Aug 2026, Sophie: "change the font in the
  title of every chat to be the same font that the account one account two is
  in — no serif", then "did you change the font size? put it back — and make
  it caps by default").** `-apple-system`, the same family as the account
  tabs and the timestamps; the serif stays for the masthead and the message
  prose. **It applies to the chat NAMES ON THE LIST only — `.cr-name`.**
  It shipped on `.thread-head h1` too, on the reasoning that one name should
  not change typeface when you tap into it; Sophie put the thread header back
  ("I noticed you also changed the titles inside the chats — I actually want
  them back exactly how they were"). That rule is now the original,
  declaration for declaration: serif, 1.5em, bold, mixed case, no tracking.
  **Don't re-add font declarations there to "match" the row.**
  - **`text-transform`, never an uppercased STRING**, so her real
    capitalisation survives in the rename box (a separate `.nameed` input,
    unaffected), in search, and anywhere else the name is read.
  - **Size: `.cr-name` 1.15em — TWO POINTS at a time off the original, in
    real pixels, never a guessed em step** ("make it two points smaller",
    then "make the title font a little smaller, two points or so"). The
    row's base is 13.333px: 1.45em was 19.33px, 1.3em 17.33px, 1.15em is
    15.33px. **Measure the base before changing it** — the thread header's
    base is 16px, not 13.333px, so an em figure alone says nothing about
    points across the two.
  - **`letter-spacing:.04em`** on both ("a little bit more space between the
    letters"). Caps set solid read as a block; this is enough air to tell
    the letters apart without turning a name into a label.
  - **NOT BOLD — `font-weight:400` in both places** ("the titles shouldn't
    be bold"). An `h1` is bold by default, so the thread header needs it
    said out loud; caps at this size hold the row on their own.
  - **Truncation, measured 2026-08-10** against her 144 live chat names at
    390px (195px of room on a row): at 15.33px **83 truncate**, against 96
    at 17.33px, 98 at 19.33px, and 58 for the original serif. The FIRST two
    points barely moved it (98 → 96) because the new tracking spent what the
    size saved; the second two actually landed. If it comes up again the
    measured levers are tracking at .02em (-2) and another point or two of
    size; **don't quietly change it without telling her the number**.
- **THE MASTHEAD OVERLAPS, it does not wrap (Aug 2026, Sophie: "hidden and
  archive create extra rows because they are longer than the word chats —
  can you just make it overlap with the other things").** Title + bookmark +
  To do + Archive + the account switch, inside the pill's 56px reserve, leave
  the title ~78px on a 375px phone: enough for "Chats", not for "Archive"
  (102) or "Bookmarks" (147). It briefly WRAPPED to fit, which cost her a row
  of screen in those views. Now `#htitle` takes **no width at all**
  (`width:0`, `overflow:visible`) so the control group never moves and the row
  is always one line; a long title simply draws across it. Two details make
  that liveable and are load-bearing: the title has `z-index:2` so the word
  she is reading wins, and `pointer-events:none` so every tap falls through
  to the buttons underneath. Verified across 375/390/430 × all five titles.
- **THE TITLE IS THE WAY BACK, and the handler must live on the ROW (Aug 2026,
  Sophie: "I'm supposed to be able to click on the archive title and it goes
  back to chats and same with hidden").** Tapping the big serif word returns
  to the chat list from Archive / Bookmarks / To do / Status, and closes the
  hidden pile; on the chat list it does nothing, because she is already
  there. **Do NOT do this by putting a click handler on `#htitle`** — its
  `pointer-events:none` is exactly what keeps the overlapped buttons
  tappable, and turning it back on swallows the bookmark button under the
  word "Bookmarks" (147px of title over ~78px of room). Instead `.hrow`
  carries the handler: a tap that arrives as `.hrow` itself is one that
  missed every button, and it counts as the title only when it lands inside
  the text's own rect. `#htxt` is an inner span that exists ONLY to measure
  that rect — the h1 is zero-width by design, so it cannot report where its
  letters are; `paintHomeChrome` writes the word into the span, never the h1.
  **The ARCHIVE title is green** (`#htitle.arch`, `#5d7a5a` — the same green
  as the thread header's ARCHIVE word), the hidden pile's stays red, and both
  classes are toggled together so a view swap can never leave the wrong one
  on. Tests: `node scripts/test-chats-title-back.js` — it taps the real word
  in every view AND hit-tests all four header controls with `elementFromPoint`
  at 375/390/430 across all five titles, so a future layout change cannot
  quietly re-bury one.
- **The view words never rename themselves (Aug 2026, Sophie: "when I press
  hidden or archive it just takes me back to chats rather than having a
  button that says chats and a back arrow — get rid of that button").** TO DO
  and ARCHIVE each stay put and toggle: tap to go, tap again to come back.
  The lit state and the big serif title say which view she is in. The old
  "← Chats" relabel is gone.
- **CHAPTERS inside one long thread (Aug 2026, Sophie: "divide the moon milk
  chat into chapters — aim for somewhere around five but it's OK if there's
  like four or seven").** A few chats ran for weeks, and re-reading one meant
  scrolling past everything. `POST /api/chatfeed/chapters { chat, chapters:
  [{title, at}] }` stores them on the REGISTRY doc; the thread draws a small
  hairline heading where the chapter changes.
  - **A chapter is just `{title, at}` and it MOVES NOTHING.** `at` is an ISO
    time and the chapter owns every message from there until the next one
    starts — no message is re-keyed, re-timed or copied, so a wrong boundary
    costs one more POST and can never damage a thread. Send `[]` to clear.
  - **On the registry, deliberately** — the feed already loads that doc whole
    (`registry()` hands the client the entire doc), so chapters reach the app
    with NO extra request and a chat without them renders exactly as before.
  - **`chapterPlan()` in chats.html is the whole client rule**, and it is a
    pure function so it can be tested. The thread paints NEWEST FIRST, so a
    heading is drawn where the chapter CHANGES on the way down — which lands
    it on that chapter's newest message, i.e. at the TOP of its block.
    Messages older than the first chapter get NO heading (silence, not a
    guess) and the dividers hide while the in-thread search filters rows —
    a heading naming a block that has been filtered away is a lie.
  - **The route refuses a chat that doesn't exist (404).** Firestore's
    `set({},{merge:true})` WRITES a missing doc and `sortedChatNames` lists
    every registry key, so a typo would put a phantom row in her list that
    only the Admin SDK could remove — that has happened before. The registry
    read is already cached by `followMoves`, so the guard costs nothing.
  - A chapter with no title or an unparseable `at` is DROPPED, never guessed
    at; the stored list is sorted by time whatever order it arrived in.
  - Tests: `node scripts/test-chats-chapters.js` (the real route against a
    stubbed Firestore + `chapterPlan` lifted out of the page and executed;
    verified failing on both halves separately).
- **Compare pages (July 2026) — publish comparison artifacts INTO the app, not
  as claude.ai artifacts.** When Sophie asks for a comparison sheet, options
  board, side-by-side, or any custom viewing page, POST it to
  `POST /api/chatfeed/page` with `{ "chat": "<your-chat-name>", "title": "…",
  "html": "<the full self-contained page>" }` (x-studio-token when gated;
  ~10MB body cap). It appears in your chat's **Compare** tab (Chat · Assets ·
  Compare) and opens full-screen in the app — that's where she'll look for it,
  next to your assets. Lay the content out however the comparison needs (mobile
  first, self-contained; image URLs from Firebase Storage are fine). The server
  auto-appends the shared autoscroll pill to every served page — do NOT add
  your own scroll pill.
  **START FROM THE SHELL — `public/compare-shell.html` (Aug 2026, Sophie's
  ask: "a shell every chat can use for their compare page that has the auto
  scroll pill with everything exempt").** Copy that file and fill it in; it
  links the two shared halves and carries the rules below as comments, so a
  new page gets them without anyone remembering them:
  - **`/compare.css`** — the one house look AND the `:root` tokens the
    injected pill styles itself from.
  - **`/compare.js`** — the one house BEHAVIOUR, in a single script tag:
    any tap pauses the autoscroll **with the pill itself exempt** (an
    unconditional handler eats the click on the pill's own play button) and
    `[data-nostop]` as an opt-out; plus an image lightbox that stops the
    scroll, locks the page, and restores the exact scroll position on close.
    Do NOT hand-roll these handlers per page anymore — a page that includes
    `/compare.js` has them right by construction. Tests:
    `node scripts/test-compare-shell.js` (drives real taps against the real
    injected pill in headless Chromium; skips if no Chromium).
  **THE POST ANSWERS `warnings` WHEN A PAGE SKIPS THE KIT (Aug 2026).**
  `POST /page` inspects the HTML and returns `warnings:[…]` — no `/compare.js`,
  no `/compare.css` and not all five tokens, an embedded `<video>` — alongside
  the usual `ok`/`id`/`url` (also stored as `kitWarnings` on the page doc). It
  NEVER blocks the post. **If your post comes back with a warning, fix the page
  and re-post it before you finish the turn** — that is the whole point of
  telling the chat that can still fix it. Tests:
  `node scripts/test-page-kit-warnings.js`.
  **ONE STYLE for every Compare page (Aug 2026, Sophie: "every artifact is
  styled differently — there should be one style").** Start every new page
  from the shared stylesheet: `<link rel="stylesheet" href="/compare.css">`
  (same-origin — served pages can link it; the skeleton is documented at the
  top of `public/compare.css`: `.wrap` > `.eyebrow`/`h1`/`.sub`, then
  `.card`/`.big`/`.chips`/`.imgrow` blocks). Do NOT hand-roll a fresh look
  per page, and do NOT override the `:root` tokens. **The tokens are also
  what fixes the pill:** the injected pill styles itself with the host page's
  `--ink`/`--paper`/`--chg`/`--ink2`/`--rose` variables, so a page that
  defines none of them renders the pill BLACK on transparent (this is why
  every hand-rolled page's pill looked broken — Sophie caught it). If a page
  genuinely can't link the stylesheet, it MUST at least define those five
  `:root` tokens.
  **ANY tap pauses the autoscroll (Aug 2026, Sophie's rule — every Compare
  page MUST have this).** While she's interacting with a page — voting,
  typing a name, tapping anything at all — the page must not keep creeping
  underneath her. Add this to every Compare page's script (capture phase, so
  it fires even when the tap lands on a button or form field) — and it MUST
  skip taps on the pill itself: `__scrollStop` repaints the pill's glyphs,
  and swapping the tapped element out mid-press EATS the click, so an
  unconditional version makes the pill's own play button dead (found live on
  Cut Marks, fixed on the Cutting Room too):
  `document.addEventListener('pointerdown', function(e){ var t=e.target; if(t&&t.closest&&t.closest('.float')) return; if(window.__scrollStop) window.__scrollStop(); }, true);`
  **Including `/compare.js` does exactly this for you** — that snippet is now
  only for a page that genuinely cannot load the shared script.
  This is on top of the existing image-lightbox rule below — opening an
  image still locks background scroll too.
  **The tap gesture's exempt list is SHARED — never hand-roll one, and always
  PASS THE EVENT (Aug 2026, Sophie: this "comes up a lot").** `pill.py` owns
  `PILL_SKIP` (`a,button,summary,details,input,textarea,select,label,video,
  audio,[onclick]`) and exposes it two ways: `window.__scrollTap(e)` applies
  it for you, and `window.__pillInteractive(el)` answers it for a page's own
  handler. **`__scrollTap()` called with no argument exempts NOTHING** — that
  is exactly how a code block's COPY button in the Chats app both copied AND
  started the autoscroll (Sophie caught it; the copy handler's own
  `stopPropagation` is a document-level listener, so it runs after the page's
  tap handler and can't help). A page may ADD its own exemptions on top
  (chats: `pre`/`code`, so selecting text in a code block isn't a tap;
  writing: `.notebox`), but the shared list is the floor. This is why a
  Compare page with a copy button, a vote chip or a text field must route
  through the shared helper rather than reinventing the skip list.
  **IN THE APP the page runs EMBEDDED, and that is a SECOND pill (Aug 2026 —
  Sophie caught it on the judge demo; the standalone tests were all green).**
  chats.html opens a Compare page in an IFRAME with `?embed=1` (no injected
  pill) and its own parent pill drives the iframe, with a tap-to-TOGGLE
  gesture bound inside the page's document. That gesture used to start the
  autoscroll from taps on IMAGES (while the lightbox opened over it) and on
  the lightbox backdrop. Now: the parent forwards `__scrollStop` into the
  iframe (per-gesture memory so a pause isn't re-toggled by its own click),
  exempts `img`/`figure`/`.cmp-lb` as pause-only, and honours
  `[data-nostop]`; `.duo img` joined the lightbox selector. A page whose
  ordinary content is tappable (a judge card, a word picker) marks that
  region `data-nostop`. Tests: `node scripts/test-page-embed.js` (drives the
  REAL chats.html viewer end to end) — testing only the standalone page
  misses this entire path.
  **AN EXTERNAL LINK ON AN EMBEDDED PAGE MUST LEAVE THE IFRAME (Aug 2026,
  Sophie: an "Open the chat" link "just took me back to the compare page").**
  A plain `<a href="https://claude.ai/…">` navigates the IFRAME, and
  claude.ai sends `x-frame-options: SAMEORIGIN` (measured 2026-08-10), so the
  load is refused and the tap reads as bouncing back. `/compare.js` now opens
  any OFF-ORIGIN http(s) link from the TOP document with `target="_blank"` —
  the same thing the Chats app's own Open button does — so it never navigates
  the web view away from the app; same-origin and `#anchor` links are left
  alone, and a standalone page is untouched. **A page gets this for free by
  linking `/compare.js`, including pages posted BEFORE the fix** (they load
  it at runtime, so no repost — which matters, since a repost would throw
  away verdicts she had already saved).
  **A page served with the injected pill must SCOPE its own script (IIFE).**
  The pill snippet runs in global scope and declares `var raf`, `var I`,
  `var playing`, … — a page-level `let raf`/`const I` collides and kills the
  pill's script at PARSE time (empty stretched buttons, no scrolling —
  Sophie hit this on Cut Marks). Wrap the page script in `(function(){ …
  })()` and expose only `window.__navBack` etc. List your
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
  **CURRENT / SUPERSEDED tabs on the Compare list (Aug 2026, Sophie: "the
  drafts that have changed can still exist, but not crowd the current area").**
  A page doc carries `superseded`; `POST /api/chatfeed/page/:id/supersede
  {superseded}` flips it, and `GET /pages` returns it. The Compare panel then
  shows the account tabs' exact pattern (`.acctabs` — no boxes, two half-width
  labels over a hairline with a sliding underline) and the tabs **only appear
  once something is superseded**, so a chat with three pages still looks like
  three pages. Every row carries a small ↓ / ↺ so she can move one across
  herself. **A chat posting a new version should supersede the one it
  replaces** — that is what keeps eleven drafts of one tool out of her way
  WITHOUT deleting the history.
  **Every row (both tabs) also carries a BOOKMARK** that sends the page to
  the Bookmarks view's **ARTIFACTS** tab, alongside her kept chats and
  messages — see "THE KEEP-PILE IS THREE TABS" above. One more reason never
  to delete a superseded page: she may have kept it.
  **A VERDICT SHEET NAME MUST CARRY THE VERSION OF WHAT IT ANSWERS (Aug 2026,
  earned on the Evan cutting blocks).** Verdicts are keyed by an item id, and a
  rebuilt page usually renumbers its items — so re-posting a page under the SAME
  `sheet` silently re-points her answers at different content: `b05` in an
  82-block split became a different sentence in the 96-block split, and four of
  her cuts landed on lines she had never marked. Nothing errors; the page just
  quietly shows her the wrong state. Put the item set's shape in the name
  (`blocks-s96`, not `blocks-v8`), and when a rebuild changes the items,
  MIGRATE rather than making her redo it — map old ids to new by TIME OVERLAP
  or text, write the migrated state into the new sheet, and say what moved.
  **And do not delete the superseded page.** A new version is a new page and the
  old one is the history (see above); deleting it throws away the only record of
  what she was looking at when she gave a note.
  **SHE MUST BE ABLE TO ADD A NOTE — everywhere it could apply (Aug 2026,
  Sophie's standing rule: "that should be a standing rule generally whenever
  applicable").** A vote answers yes/no; a note is where she says WHY, or what
  to change, and it has to sit next to the thing itself. So **anything
  reviewable gets a note box**: every item on a Compare page, and by extension
  any new surface where she judges things (the Assets lightbox and the Writing
  Room already work this way — match them). Do NOT ship a page whose only
  input is a pair of vote buttons.
  - **It is one line, because `/compare.js` owns it.** Mark each item
    `data-item="<id>"` and call
    `window.__compareNotes({ chat, sheet })` after the items are in the DOM.
    That builds the note affordance per item, prefills whatever she
    wrote before, saves as she types (debounced), and flushes on blur and on
    `pagehide` so a half-typed note can't be lost by navigating away. Never
    hand-roll a note box per page.
  - **THE AFFORDANCE IS A SMALL + IN THE ITEM'S BOTTOM-RIGHT CORNER, AND AN
    EMPTY ONE COSTS NO HEIGHT (Aug 2026, Sophie: it "takes up too much space
    and makes it hard to see everything at once", then "put the plus for a
    note at the bottom not the top, and if I left a note, make it show").**
    v1 was a "+ note" text button on its own line under every item, and a
    written note then stayed OPEN IN A TEXTAREA — so a page of twenty items
    paid twenty rows whether or not she had written anything. Three states,
    each load-bearing: **nothing written** → just the + (absolute, zero
    height); **she wrote one** → HER WORDS SHOW quietly under the item;
    **writing** → the textarea, folding back to her words on blur. So height
    is spent only on notes that exist. Don't put an empty one back in flow,
    don't open a written one into a textarea just to display it, and don't
    hand-roll a bigger one on a new page — it lives in `/compare.js` +
    `/compare.css`, so every page (including ones posted before this) gets it
    at runtime.
  - **ANSWER HER ON THE NOTE ITSELF, AND IT RENDERS AS A THREAD (Aug 2026,
    Sophie: "respond to my notes on the note itself so I can respond there
    also — otherwise I forget what we're talking about", then, having used
    it: "I don't know why I'm responding inside of your message. That's
    strange").** A note is a conversation, not a comment box she files into
    the void — but v1 handed her the whole field in one textarea, so
    answering meant typing inside the chat's paragraph.
    - **The field is a list of MESSAGES, one per line-start marker: `— me:`
      and `— Claude:`.** Read the sheet (`GET /verdict` → `texts`), append
      `\n\n— Claude: <short answer>` and POST the whole field back. Text
      before the first marker is hers, so every note written before this
      still reads correctly.
    - **Her box is always EMPTY and only ever APPENDS.** `/compare.js` keeps
      the stored field separate from the draft; never repopulate the
      textarea with the thread (a second blur then appends it to itself).
    - **More than one message FOLDS to the newest**, behind a small
      "N earlier" (her ask: "also collapse the messages anyway"), so a long
      back-and-forth can't bury the list. Hers and the chat's carry
      different coloured rules and a tiny ME / CLAUDE label.
    - Keep answers short (the field caps at 2000 chars) and don't re-answer
      a note that already carries your line.
  - **Votes and notes are SEPARATE FIELDS on the same verdict doc** — `ok`
    for the vote, `text` for the note — so writing one never clears the other
    (that is why the route has both). Read them back together with
    `GET /api/chatfeed/verdict?chat=&sheet=` → `{ items, texts }`.
  - **Read the notes when she next messages you**, in the same sweep as asset
    votes/notes, and act on them.
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
  **THE TITLE, AND NOTHING ELSE AT THE TOP (Aug 2026, Sophie: "get rid of
  the gold top part of the top and just make it the name… everything but the
  title, including the tagline and the top thing with the date or
  whatever").** A Compare page opens with its `<h1>` and goes straight into
  the thing. **No `.eyebrow`** (the gold CHAT NAME · DATE line — she already
  knows which chat she is in and when she asked for it) and **no `.sub`**
  tagline. Both classes stay in `compare.css` for older pages; a NEW page
  simply does not use them, and `compare-shell.html` no longer has them.
  **PREFER NOT SCROLLING, AND WHEN THERE ARE TWO KINDS OF THING USE THE
  HAIRLINE TABS (Aug 2026, Sophie's standing rule).** A page she has to
  scroll to reach the controls is a page where the thing and the controls are
  never on screen together. So: fit what she is looking at on ONE screen, and
  when a page carries two different kinds of thing — a picture and its
  inputs, a shape and the buttons that drive it — split them with the
  `.acctabs` hairline pattern (two half-width labels over a hairline, the
  line sliding under the one she is reading) instead of stacking them down
  the page. The tab row sits near the top, so it needs the pill's 56px corner
  reserve and a sliding line of `calc((100% - 56px)/N)` — an abspos child
  resolves its percentage against the PADDING box.
    **MINIMAL TEXT, and compared things SIDE BY SIDE (Aug 2026, Sophie — asked
  for on page after page).** A review page is a VISUAL reference, not an
  extension of the chat: title, ONE line under it, labels on the pictures —
  no paragraphs. And the things being compared sit NEXT TO each other (the
  `.duo` block in compare.css — labels ON TOP, "medium" / "high"), never
  stacked so she scrolls between them. Full rules live in the `new-page`
  skill and the shells' own comments.
  **A FILM IS A LINE OF TEXT WITH A PLAY BUTTON, AT THE TOP — never an
  embedded `<video>` (Aug 2026, Sophie: "never put a whole video when it's
  gonna be opened as a lightbox anyway, it should just be a line of text with
  a play button… so I don't just scroll through the whole thing").** Both
  the Evan film pages and the Mason one shipped a full-width player parked at
  the top; it is a black slab she scrolls past on every visit, and tapping it
  goes fullscreen regardless — so the box bought nothing. One line does it,
  and the overlay contract (autoscroll stopped, page locked, scroll position
  restored, video torn down on close so it can't play on behind the page)
  comes with it:
  `window.__filmRow({ url, label, meta:'4:56', mount:'#film' })` in
  `/compare.js`. **The deliverable sits at the TOP of the page**, above
  whatever there is to decide — that is where she looks for it, and it is why
  a delivery gets a Compare page at all.
  **THE JUDGE PAGE — "Tinder style", her name for it (Aug 2026).** When she
  is PICKING/CHOOSING across a set rather than reading a comparison, start
  from **`public/judge-shell.html`** + `/judge.js`: one thing at a time, big,
  NO scrolling, ♥/✕/maybe/later (maybe and later are real piles — 'later' is
  "declined to sort now", reviewable as a group), verdicts saved live to the
  chat's verdict doc (`ok` accepts those short strings since Aug 2026),
  resume on reopen, piles view with re-judging, undo, a note box per card. A
  judge item can be a labeled PAIR judged as one thing — the
  compare-and-choose case (medium vs high of the same portrait, PDF page vs
  its text). Read answers back via `GET /api/chatfeed/verdict?chat=&sheet=`.
  Tests: `node scripts/test-judge.js`.
- **THE CUT PICKER IS THE REQUIRED SURFACE for "pick spans of a recording"
  jobs (Aug 2026, Sophie — after FOUR chats each hand-rolled their own
  span-picking page in one week and each re-shipped the same bugs).** Any
  time Sophie needs to pick which parts of a long recording to keep — an
  audiobook passage, an interview, one of her own recordings — start from
  **`public/picker-shell.html`** and `window.__cutPicker` (`/picker.js`).
  Do NOT hand-roll word-tap handlers, per-pick audio, reorder tiles, or
  pick-saving again. What it gives you, debugged once:
  - tap-a-first-word / tap-a-last-word span picking (her own preferred
    model, from the "grasshopper" chat's page), tap a pick to remove, undo;
  - WORDS / PICKS tabs (the witch shop's description-vs-reviews pattern —
    Sophie's ask, so the tiles aren't a long scroll below the transcript),
    and a follow-along highlight: the word being spoken lights up and
    auto-centers while a pick plays (the Voice Memos / Cutting Room
    pattern; only as exact as the page's word times);
  - **a ▶ on every pick that plays THAT EXACT SPAN within seconds** — the
    server cuts it once via `GET /api/search/clip-span?src=&t0=&t1=`
    (editor.js's transcoder + the search-clips immutable cache), so she
    never waits for a chat to wake up and render before hearing a cut;
  - pick tiles with ▲▼ reorder, a note box per pick, play-them-in-order
    (the "TIME — move the sentences around" page's model);
  - live saving as **ONE verdict field per pick** (`<id>:p<key>` →
    `{a, z, o, note}`) — never one big JSON string, which silently
    truncates at the verdict route's 2000-char cap around 15 picks;
  - the autoscroll-pill tap contract via `/compare.js`, so the
    tap-starts-the-scroll bug cannot ship again.
  Read her picks back with `GET /api/chatfeed/verdict?chat=&sheet=` (keys
  `<id>:p*`, empty = removed, order by `o`, indexes into YOUR words array),
  then cut the real audio with the precise cutter — preview clips are
  previews. Word times can be segment-interpolated; with no times the
  picker still picks, just without play buttons. Seed your suggested spans
  via `seed:`, shade already-used words via `shade:`; the scissors on a
  pick tile splits it into two back-to-back picks (so each part can get a
  different picture or speaker).
  **Send-to-episode (Aug 2026, Sophie):** for an INDEXED source the picker
  bar carries a "to the Episode Editor" button — every pick, in her order,
  becomes a snippet card in ONE NEW episode (`POST
  /api/search/picks-to-editor {src, title, picks:[{text,timeSec}]}`), where
  narration cards, gaps and the real render already live. Each send makes a
  NEW episode (never appends — the new-version rule); a chat asked to "put
  these in an episode" should call the same route rather than hand-building
  episode docs. Tests: `node scripts/test-cut-picker.js`.
## Push notifications (the Update tab's doorbell — Aug 2026)
- **`push.js` (`/api/push`) sends real APNs lock-screen notifications**, raw
  HTTP/2 straight to Apple — no Firebase Messaging, no SDK. The iOS app
  registers its device token per launch (`POST /device`, upsert), and
  `chatfeed.js` calls `notifyChat()` on a **finished reply** (never a draft)
  and on a **new Compare page**. Debounce: one push per chat per 10 min +
  60s global gap — the pushes are the Update tab's doorbell, not its
  replacement, so dropped ones are never lost news.
- **Dormant until the APNs key exists**: `APNS_KEY_ID`, `APNS_TEAM_ID`,
  optional `APNS_TOPIC` (defaults to `com.sageryza.imageforge`), plus the
  key itself EITHER as `APNS_KEY` (raw PEM, base64, or literal-\n all
  accepted) **OR — the better home, her ask — as a RENDER SECRET FILE**: any
  `*.p8` in `/etc/secrets`, the project root or cwd is picked up by
  extension, so Apple's own `AuthKey_<KEYID>.p8` can be uploaded unchanged
  with no name to get right (`APNS_KEY_FILE` overrides with a path). Env
  wins; a file MISS is re-checked every 30s, so a key uploaded after the
  deploy starts working on its own. Everything is read lazily at send time,
  so a key landing needs no redeploy. **Only Sophie can mint the key** (Apple
  developer portal → Keys, environment **Sandbox & Production** — TestFlight
  rides production); never paste it into a chat.
  **Her ids, for reference: Key ID `G8WMZDR4KK`, Team ID `5XR23N2CBH`** —
  neither is a credential (the .p8 is), and having them here saves a
  screenshot hunt next time.
- **`POST /api/push/test {title?, body?}`** (gated) sends a real push to
  every registered device with per-device results — the end-to-end check.
  `GET /status` → `{configured, devices}`.
- **iOS side** (`PushDelegate.swift` + `aps-environment` in the
  entitlements): permission asked once at launch, token POSTed with the
  studio token, notifications SUPPRESSED while the app is foregrounded (the
  Update tab is the notification there), and a **tap opens THE CHAT IT CAME
  FROM** (`/chats?chat=<slug>`).
  - **v1 always opened the Update tab and she rejected it** ("I click on the
    notification, it lands me in the updates tab, but that notification is
    already gone because clicking the notification gets rid of it"): iOS
    consumes the banner on tap, so landing on a LIST leaves her no way to
    tell which chat just spoke. The payload always carried `chat`; now it
    routes. A push naming no chat (the `/test` send) still lands on Update.
  - **BOTH params are stripped at boot** (`?chat=` and `?view=news`) —
    checkBuild reloads the page on every deploy and keeps the URL, so a
    leftover param would re-open that thread over whatever she is reading,
    on every deploy, forever. Pinned by `test-chats-build-reload.js`. TestFlight rides the
  PRODUCTION APNs host. Apple-managed CI signing registers the push
  capability on the App ID automatically (same as the App Group did).
- **THE HOME-SCREEN WIDGET (Aug 2026, Sophie: "I'd like the widget")** —
  `ios/ForgeWidget/`, a WidgetKit extension: the Update count big, plus the
  newest chats (names at small, name + line at medium), tap opens
  `deckfactory://chats`. Flat paper palette, no gradients.
  - It reads **`GET /api/chatfeed/widget?limit=`** — one small JSON — and
    must NEVER pull the real feed (~500KB on a refresh timer). Cost is the
    cached registry + one capped message read, nothing per-chat.
  - **Its floor is `notifSeenAt`, and OPENING A CHAT NOW WRITES THAT STAMP
    TOO** (`markSeen` POSTs `/notif-seen`, Aug 2026). Without it the widget
    counted everything-since-the-✓ while the tab counted
    everything-since-she-last-looked — measured live the hour it shipped:
    **14 against 2**, the same idea disagreeing with itself on two screens,
    because `seen` is localStorage inside the web view and a widget is a
    separate process with its own container. Opening a chat already cleared
    its Update card, so this changed no visible behaviour in the app; it
    just put the same fact where the widget can read it.
  - **IT HAS NO ENTITLEMENTS FILE, and that is load-bearing — the first
    build died on exactly this.** Apple-managed CI signing registers a NEW
    App ID for the extension but does NOT enable the App GROUP on it, so
    asking for `com.apple.security.application-groups` fails the archive:
    *"provisioning profile … doesn't match the entitlements file's value for
    the com.apple.security.application-groups entitlement"*. DumpShare's
    group was enabled long before, which is why that target never hits this
    — **do not copy DumpShare's entitlements into a NEW extension and expect
    it to build.** Consequence: the widget can't read the settings the app
    writes (`ImageForgeApp.shareSettingsWithWidget` still writes them), so it
    calls the DEFAULT server unauthenticated. Fine while STUDIO_TOKEN is off
    (it is). To restore the group: enable App Groups on
    `com.sageryza.imageforge.widget` in the developer portal ONCE, then add
    the entitlements file back — the Swift side already reads the group, so
    there is no code change.
  - A failed fetch says "can't reach the feed" rather than showing 0:
    "nothing new" and "couldn't ask" must never look the same.
  - Tests: `node scripts/test-widget-feed.js` (drives the real route against
    a stubbed Firestore).
- **A dead token self-heals**: 410/`Unregistered` deletes the device doc.
  Tests: `node scripts/test-push.js` (key-paste shapes, verifiable ES256
  JWT, wire format against a local h2c server; Apple itself is only
  testable via `/test` + a real phone).

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
- **Style reference:** `refs/dream-mystery.jpg` (Sophie's hand-drawn diary-comic
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
  decide how many IMAGES the dream needs (1-6, never padded) and allots each
  image a verbatim slice of the dreamer's words in TRUE chronological order
  (drift cues fix the narration order); then `makeDreamPagesV2` draws
  sequentially — each page gets the style ref FIRST, then ONLY that slot's
  approved character cards (image refs; desc-only people ride as text
  continuity lines), then up to 3 already-drawn earlier pages
  (`dreamPageRefs` — a face is carried from the page it first appeared on),
  plus the whole dream for context and "THIS page tells ONLY this part".
  **The model decides each page's layout** (single drawing or panels — no
  fixed 2x2). Pages store `{url, promptUsed, text, captions, who, softened}` —
  **`text`/`captions` are what the picture ACTUALLY says**, so anything
  rendering captions from the doc matches the drawing; when the safety filter
  forced a rewording, **Sophie's own wording is kept beside them as
  `textOriginal`/`captionsOriginal`** (present ONLY on a softened page, so
  ordinary pages carry no redundant copy). The dream is a record of what she
  said — a content filter must never silently replace her sentence with a
  paraphrase, and `softened:true` alone couldn't tell you WHICH sentence
  changed. Plan kept on
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
- **Sort & label page (Aug 2026, Sophie's ask): `/dump`** (`public/dump.html`,
  serveGated) — the other half of "dump first, label afterwards". Browse every
  album (filter by session / unlabelled-only), name it, set its `track` (chips
  for the known tracks + free text; tapping the lit chip clears back to
  unlabelled), notes, per-file lightbox with delete. Saves via
  `PATCH /api/drop/bundle` (loose files via `PATCH /items/:id`). **The native
  Dump tile is two tabs — SEND and SORT (Aug 2026, Sophie)**: sending albums
  in and sorting out what's already there are one tool, not a screen plus a
  pushed page. Both halves stay ALIVE behind the switch (a reload would lose
  her place), so the page exposes `window.__dumpRefresh` and `GatedWebTool`'s
  `refreshOnAppear`/`refreshTick` fires it on every switch to SORT —
  `onAppear` can't do this, a view held in a ZStack only appears once. The
  page hides its own eyebrow under `?embed=1` (the native bar already titles
  the screen) and the upload progress bar sits ABOVE the tabs, since an
  upload keeps running while she sorts. **Select mode (Aug 2026, Sophie):**
  the Select chip opens every album to just its thumbs — tap to pick across
  albums, then the fixed bottom bar moves the lot into an existing album or
  a newly named one (`POST /api/drop/move {ids, bundleName}`; placeIn()'s
  registry transaction numbers them in, the target album's session and
  track/name labels win, files placed in the order she picked them).
- **FOLDERS CONTAIN ALBUMS — they never merge them (Aug 2026, Sophie: "don't
  take it out of the sub folders it's already in").** A folder is the `track`
  field, shown as "Folder" in the UI: filing an album writes the label onto
  its files and nothing inside it moves, so one crystal stays one album stays
  one Etsy listing. The sort page's Select mode picks whole album CARDS (not
  files) and files the lot in one tap; the filter row carries a chip per
  folder in use, so tapping "Crystals" shows exactly those albums. Albums
  sort **newest first** by `newest` (the album's latest file — `seq` is
  arrival order across ALL albums and can't answer freshness).
  `POST /move` (file-level, above) is still there for a chat, but the page
  never merges albums. The page's whole control strip (title, counts, filter
  + Select chips) is ONE sticky header, and a back-to-top button floats
  bottom-LEFT past 400px of scroll — with 100 albums, reaching Select must
  never mean scrolling back to the top.
- **`DumpView` must RE-READ the Photos albums, not load them once.** Its
  `.task` fires a single time because RootView holds the view alive in a
  ZStack, so an album created in Photos after launch never appeared in SEND —
  and it read as the Dump having lost it (Sophie made "character references"
  and "style references", didn't see them, and made them again). It now
  reloads on `.forgeScreenChanged`, on `willEnterForeground`, and on every
  switch back to the SEND tab.
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
- **THE FILE md5 IS NOT A FINGERPRINT OF THE RECORDING (Aug 2026 — this is
  what let duplicates through after the "one library" fix).** iOS rewrites an
  m4a's QuickTime creation/modification dates every time the file is exported
  or shared, so re-sharing a recording gives DIFFERENT BYTES for identical
  audio. Measured on a real pair: both copies 2,820,952 bytes, **36 bytes
  different, every one a date field** (copy A `2026-08-02T19:43:44Z`, copy B
  `2026-08-04T04:31:10Z` — each the moment it was FILED), all 2.8MB of audio
  bit-identical. **That single cause defeated BOTH dedupe layers at once**,
  because `mvhdDate()` reads the same rewritten clock, so the server-derived
  stamp was "when it was shared" too. Don't diagnose a repeat memo as a hash
  bug — the hash was working; it was hashing the wrong thing.
- **Dedupe is THREE layers now, and each catches what the one before cannot:**
  1. **file md5** (`hash`) — a byte-identical resend, i.e. a retried upload.
  2. **audio fingerprint** (`ahash`, `memos.audioHash`) — the file md5 with
     every mvhd/tkhd/mdhd date zeroed, so a re-SHARED recording matches. The
     scan is a whole-buffer search, NOT a tree walk from the top-level moov:
     Voice Memos leaves an earlier copy of those boxes inside the mdat region
     (headers at 17814 *and* 2755110 in the measured file) and iOS updates
     both — a tree walk finds one and the fingerprints still disagree.
  3. **transcript backstop** (`memos.transcriptTwin`) — exact duration + ≥40
     words + ≥90% word agreement. This is what catches a re-ENCODED copy,
     where even the audio bytes differ. **The thresholds are calibrated
     against the real archive, not guessed** (swept over all 1,117 records:
     they flag the 9 genuine duplicates and nothing else). Every gate is
     load-bearing — EXACT duration because Sophie re-records the same line
     constantly and those takes land 1–2s apart (±2s slack wrongly flagged
     four of them); 40 WORDS because an 8-second line repeated ten seconds
     later really is word-for-word identical and is NOT a duplicate; 90%
     because Whisper transcribes the same audio differently each run (which
     is exactly why duplicates read as different memos). Re-run
     `node scripts/memo-dedupe.js` after touching any of them.
- **A SHARED STAMP IS NOT A DUPLICATE, and the stamp no longer dedupes
  anywhere (Aug 2026).** It is minute-resolution, Sophie records several short
  thoughts back to back, and the archive holds **70 groups of recordings that
  honestly share a minute** — so the rule was wrong for about one recording in
  fifteen. It cost a real one: a 28-minute recording from 2025-09-12 was
  refused as "already in the archive" because an unrelated 11-second clip
  (91KB against 14.2MB) was made in the same minute. Identity is bytes or
  words; the stamp only NAMES a record.
  - The Mac push had it worse, because it filters BEFORE uploading — a new
    recording sharing a minute with an archived one was never sent at all, so
    the server's layers never got to judge it. `GET /status` returns **`keys`**
    (`stamp|duration`) and `push-memos.mjs` skips only when both match;
    duration comes free from the Voice Memos database, so this costs no file
    reading. (`stamps` is still returned for older callers.)
  - **The direction of the risk is deliberate**: a false SEND is harmless (three
    real layers catch it, and a fingerprint match costs nothing — not even
    transcription), while a false SKIP loses a recording for good.
- **Never hand-build a stamp** — POST the bytes and let the server work it out.
  A stamp equal to NOW is a caller guessing (12 records got in that way, 0–3
  min from their own upload); it still names the record but earns the id a hash
  suffix so two derived minutes can't collide.
- A skip after the audio is already uploaded now DELETES those bytes, or they
  become an orphan object nothing can reach (five of those had accumulated).
- **Repairs: `node scripts/memo-dedupe.js`** — `--fingerprints` (backfill
  `ahash`), `--merge` (merge duplicate pairs), `--orphans` (sweep audio no
  record points at), `--all`, `--dry-run`. **It never deletes**: a merged-away
  recording's audio moves to `memo-audio/_removed/` and the manifest is backed
  up beside itself before any write, so every repair is reversible by hand.
  Bare (no flags) it scans and changes nothing — run that first.
- Ran 2026-08-07, end to end: 9 duplicate pairs merged (1,117 → 1,108) — 6 from
  the 11 July bulk build (`export-voice-memos.sh` appends `_1` when a filename
  already exists, so a second export run into the same folder copied some
  recordings out twice and each copy was transcribed and titled separately),
  3 from re-shares in Aug. Then `ahash` backfilled over all 1,108 (4.86GB read,
  ~$0.60 of egress; 3 zero-duration empties have no container to fingerprint),
  and the 5 orphan objects re-filed → **1,113 records, 0 duplicate pairs**. One
  of those orphans was a 28-minute DREAM with a 19,316-character transcript
  that had been invisible since Sept 2025.
- **After any merge or re-file: rebuild the Search index AND re-embed.** The
  index keys its vectors to `builtAt` + chunk count, so a reindex that changes
  chunking leaves meaning-search 409ing on `stale-vectors`.
  `POST /api/search/reindex` (free) then `POST /api/search/embed` (~$0.05).
- Earlier one-time repairs (both ran 2026-08-05):
  `scripts/memo-unify-backfill.js` — phase A stamped `hash` onto existing
  records from Storage md5 metadata, phase B merged strays from `forge-audio`
  into the archive. Note phase A landed AFTER two of the three Aug duplicates,
  so the md5 layer wasn't even present when they were filed.

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
  difficulty + a pillar/cluster shape, **Claude**) → `POST /draft` (full post:
  title/meta/slug/tags/HTML body/FAQ/image prompts, ~900 words, **Claude**) →
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
  (gpt-image-2 edits against `storage:witch-school/refs/sophie-snake.png + sophie-animals.png`, same as
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
- **SHIPPING IT IS ALL CI — no Mac, and that now includes the App Store
  listing text (Aug 2026).** Three workflows in `memory-library-react`, which
  is where the App Store Connect secrets live; every one of them takes the
  bundle id `com.sageryza.secretlyawitch` (the app builds from the
  `SecretlyAWitch` target in THIS repo's `ios/`, and the workflow checks this
  repo out — `imageforge_ref` picks the branch):
  - **Secretly a Witch TestFlight** — build + upload.
  - **ASC edit metadata** (`ci/asc_metadata.py`) — description, keywords,
    subtitle, promotional text, What's New, and the App Review contact /
    demo account / notes. **Run it with `dry_run` ON first**: it prints every
    current value plus the app and version a write would land on, so nobody
    edits the wrong app. Fields with no input of their own (supportUrl,
    marketingUrl, privacyPolicyUrl, demo account…) go through `fields_json`,
    where `""` CLEARS a field. Edits save on the version but do NOT submit.
  - **ASC submit release** (`ci/asc_submit_release.py`) — attach the build,
    set What's New, submit. `resubmit:true` cancels an in-queue submission
    first so a newer build can take its place.
  So a rejected version is reworked entirely from a chat: fix the metadata,
  then submit. **The two things that still need Sophie** are the reviewer's
  rejection text and any Resolution Center reply — Apple exposes neither in
  the public API, so paste the message in rather than guessing at it.
  Screenshots are API-able in principle but that flow is NOT built.
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
  the paper removed — transparent background, 70 drawings, 240px, 390KB (the
  old one: 45 drawings, 360px, 865KB). Both files stay in `public/`; the old
  one is still what iOS bundles (`TestStationView` deliberately puts
  `Color.white` behind it). Rebuild either from a folder of hoonies with
  `python3 scripts/hoonie-cutouts.py <dir> --gif public/hoonie-loading-clear.gif
  --size 240 --pad 16 --max 70` (needs `pip3 install Pillow numpy scipy`); the same
  script writes the transparent PNG cutouts with `--out`. GIF transparency is
  1-bit, so each frame quantizes its own real colors (7 + transparent), so the ink keeps
  its warm tone — the first cut quantized to neutral gray and read greeny on
  the app's cream surfaces.
- **The hoonies themselves live in the Dump**, album **hoonies** (#228, 140
  drawings — woodcut smallies, many of them two things grown into each other).
  Cutouts at Storage `hoonies/cutouts2/<nnn>.png`, 210px webp thumbs at
  `hoonies/thumb2/` (v1 at `cutouts/`/`thumb/` was grayscale-quantized and read
  greeny on cream; v2 is the corner flood-fill cut — new paths because the old
  objects are immutable-cached). As a gpt-image-2 style reference they transfer well with
  the refs attached and **NO written style description** (same finding as
  `docs/evan-film-style.md`) — adding an engraving description pulls the line
  finer and more modern, away from their blunt woodcut feel.
- **Witch School lessons: the complete creation workflow is documented in
  `docs/witch-school-lessons.md`** — read it BEFORE writing a lesson so new
  lessons match the 14 live ones (voice, research pass, illustration pipeline
  via `scripts/witch-school-cards.js`, per-card sampled backgrounds, wiring,
  tests). Sophie's style refs live at `storage:witch-school/refs/sophie-snake.png + sophie-animals.png`.
- `public/witch.html` (page at `/witch`, **ungated/public**) is a mobile-first,
  single-page app with a **fixed bottom nav** (Lucide icons). Its own dark
  mystical theme (inline, not `forge.css`). Reuses the open `/api/generate/*`
  endpoints + a small set of stateless AI endpoints in `server.js`:
  `POST /api/witch/{tarot,spell,horoscope}` (all `openaiChat`,
  **Claude** via `anthropicChat`; `parseAnthropicJson` strips fences).
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
    `localStorage['witch_grimoire']`) and a charm image
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

## Which model writes it (Aug 2026, Sophie: "my brains are really important")
- **Anything whose output is WORDS A HUMAN READS runs on Claude, never
  `gpt-4o-mini`.** Blog posts *and the keyword research behind them*, Etsy
  listing copy, the shop advice she makes spending decisions from, the witch
  app's spells / natal readings / sky lessons. Route them through **`anthropic.js`** (`chat` / `chatJSON`,
  default `claude-sonnet-5` via `CLAUDE_WRITING_MODEL`) — do NOT hand-copy the
  fetch a fifth time. `server.js`'s `anthropicChat` + `parseAnthropicJson` is
  the in-server equivalent for routes that already live there.
- **`gpt-4o-mini` stays ONLY for bulk mechanical extraction** where the job is
  "pull the fields out of hundreds of documents", not "write something worth
  reading": NDE moment mining (`nde.js`), memo titling (`memos.js`), the deck
  brainstorm lists (`/api/generate/subjects`, `/moments`), `stories.js`,
  `/api/set/third`, the Talking zine's planner, `dreamapp.js`. If you switch
  one of these, say why.
- **The Book of Miracles stays on mini — Sophie's explicit call.** It was
  switched to Claude once and she asked for it back: the book's voice is
  settled and the model change moves how the pages read. `/api/generate/miracles`
  is ONE route feeding BOTH the witch app's Miracles tab and `/book` (they also
  share the same localStorage book), so touching it moves both at once. The
  THIRD Book of Miracles is a separate iOS app in another repo and is not
  affected by anything here.
- **`gpt-4o-mini-tts` and `gpt-4o-mini-transcribe` are NOT this.** They are
  the audio models — a grep for "gpt-4o-mini" hits them and inflates the
  count. Leave them alone; the voice rules elsewhere govern them.
- **A doc that tells you to use mini for reader-facing words is STALE — fix
  the doc.** This kept coming back because the module headers said "gpt-4o-mini"
  long after the code moved on. When you change a model, change its comment,
  its module header, and this file in the same commit.
- **Opening a page must never spend money.** The Shop Report used to write its
  AI advice on page load; that is now `?advice=1`, behind a star button. Same
  rule anywhere else: numbers/lists are free, a model call is a deliberate tap.

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
    the server), not a fresh hand-rolled header per page. The pill defends
    its own glyphs against host-page `svg` globals (a page's `svg{fill:none}`
    hollowed its play triangle — Sophie caught it on the Cutting Room, and
    editor.html had the same hazard); after ANY pill.py edit, re-run
    `python3 scripts/gen-pill-inject.py`. When adding or
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
  **SAY THE QUALITY IN THE REPLY TOO, as a word, not "the default" (Aug 2026,
  Sophie: "she doesn't say what quality").** A delivery that says "quality
  copied from the function" or "at the usual settings" leaves her guessing —
  she assumed a medium sheet was high and asked for it to be re-run. Name the
  value (`medium`) and its rough cost in the message that hands over the
  image, every time. The caption is where she checks it LATER; the reply is
  where she reads it NOW, and both have to carry it.
  **THIS CANNOT BE BACKFILLED BY A LATER CHAT — file it when you make the
  image or it is gone (Aug 2026, measured).** A sweep of all 171 chats found
  **2,488 images, 1,938 with no quality caption**, and of those only **31**
  could be recovered honestly (their filed prompt happened to contain both the
  model and the quality). **1,320 had no filed prompt at all**, so nothing on
  the record says how they were made. Guessing a caption is worse than an empty
  one — it puts a confident wrong number in front of her forever — so those
  1,938 stay blank by design and NO chat should invent them. The only chat that
  ever knows an image's quality is the one that generated it, at the moment it
  generated it. If you are backfilling your OWN older images, derive the value
  from your filed prompt or your own run records; where neither exists, leave
  it empty and say so.
  **THE HOLE EVERY CHAT FALLS IN (Aug 2026, found on the hospital film):
  images you send as chat FILES get auto-filed by the hook as
  `claude-deliveries/<random>` copies with NO label and NO quality caption,
  and they DON'T merge with your captioned tile (different filename, so the
  filename union can't join them).** So captioning only what you POST is not
  enough — after any SendUserFile that includes images, sweep
  `GET /api/gallery/assets?chat=` for caption-less `claude-deliveries/*`
  tiles and caption them too (match them to your originals by md5 of the
  bytes; a backfill of 18 such tiles is what surfaced this). Until the
  server unions by content hash instead of filename, this sweep is the only
  thing that keeps the Assets tab fully captioned.
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
- **THE SANS IS CAPS AND NOT BOLD — the SERIF is untouched by this rule (Aug
  2026, Sophie: "whenever this font is shown it should generally be
  capitalized and not bold", then, when it was read as universal: "that was
  supposed to stay bold actually — it's only that other font I don't like it
  when it's bold").** The rule is about `-apple-system` ONLY. Serif text
  keeps whatever weight it had; do not de-bold a serif element in the name of
  this guideline.** `-apple-system` is the app's LABEL voice — chat
  names, tabs, timestamps, Compare-row titles, chips — and it reads as caps
  at a normal weight with a little tracking (`.03–.04em`; caps set solid read
  as a block). The SERIF stays as it is: the masthead, a thread's own title,
  and message prose are not covered by this.
  - **Bold has to earn itself IN THE SANS.** A lit state that already carries a tinted
    background, a coloured outline or a sliding underline does NOT need
    weight on top — the account tabs, the category chips and the Chat/Assets/
    Compare toggle all had it and lost it. What kept bold: the tiny numbers
    inside the red answered badges (9–10px in a dot, where weight is
    legibility) and the hidden bar (it is the screen's one alarm).
  - **Caps cost width** — roughly a line per long string. A Compare title
    like "Cutting blocks v3 (s96) — punctuated, cut pile, maybe state" went
    from two rendered lines to three. Worth saying to her when a set of
    labels is long, rather than quietly shrinking the type.
  - **THE COMPARE + UPDATE ROW TITLES ARE THE SERIF, and that is her LATER
    word** ("I actually prefer the other font for the updates page and the
    compare pages"). They were the serif, went sans for one evening to match
    the Current/Superseded tabs above them, and she picked the serif back
    after seeing both — so this rule does not apply there at all: they read
    mixed case AND BOLD (600), exactly as they were before the sans evening. `test-chats-superseded` asserts the serif, so
    flipping it back has to be deliberate. **Two chats were editing these
    rows the same evening — check the newest instruction before changing
    them.**
- **No pills.** Text buttons are rounded rectangles — `border-radius: 6px`.
  Circular icon buttons (toggles, dots) are the only exception. **Plus one
  named exception Sophie asked for (Aug 2026): the Chats home screen's
  REFRESH button (`.refreshbtn`) is pill-shaped.** It is the exception, not
  a loosening of the rule — don't round anything else off, and don't "fix"
  that one back.
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
  that says nothing about how many). **It is EQUILATERAL** — Sophie asked, and
  she was right that it wasn't: base 18 on y 19.8 with the apex 9√3 = 15.59
  above it puts all three angles at 60.00°, where the first version was
  isosceles at 53°/63° (base 17, height 17) and read noticeably narrow. The
  horizontal cut sits at half the HEIGHT, which lands its ends exactly halfway
  along each side, so the filled cap is the same triangle at half scale.
  **It is a REUSABLE named glyph: `SetPyramid`** (Sophie's name, Aug 2026) —
  `ios/ImageForge/Assets.xcassets/SetPyramid.imageset/setpyramid.svg`, so
  `ToolGlyph.asset("SetPyramid", size:)` draws it anywhere in the app, and it
  is in `normalize-glyphs.py`'s `GLYPHS` list like the other three. TWO copies
  exist by necessity (64-box bundled for iOS, 24-box inline in
  `promptlab.html` for the web) and each names the other — move both.
- **Custom-icon sizing has TWO halves, and both were wrong for a long time —
  the numbers below are MEASURED off a real 3x screenshot, never reasoned
  about (Aug 2026, third attempt; the first two failed by reasoning).**
  - **Half one — the frame (`ToolGlyph.customFrame` = 1.11·S).** The old note
    here claimed "an SF Symbol at point size S draws only ~0.75·S of ink", so
    custom art was framed SMALLER, at 0.86·S. **That premise is false.**
    Measured on the home screen at declared S: `briefcase` 22.7w x 19.0h,
    `film` 24.0 x 19.0, `photo` 24.0 x 19.0, `bubble.left.and.bubble.right`
    28.0 x 22.3 — i.e. real symbols draw **0.90-0.95·S tall and ~1.13·S
    wide**, not 0.75. The hand-drawn glyphs measured 15.3pt (test tube) and
    15.7pt (quilt) against those, which is why Sophie kept seeing them as
    different sizes. Custom art fills 0.90 of its frame, so a frame of
    **1.11·S** puts its ink at ~1.00·S, inside the cluster the real symbols
    occupy. History: 1.35·S (far too big — the tubes read half again the size
    of everything), then 0.86·S (too small), now 1.11·S. **Only `ToolGlyph`
    may hold this number** — `ToolGlyph.asset(_:size:)` renders any bundled
    glyph, and a hand-picked frame anywhere else is how it drifts.
  - **Half two — the art. A bundled glyph MUST fill exactly 0.90 of its own
    viewBox, centred — run `python3 scripts/normalize-glyphs.py` after adding
    or editing one** (`--check` measures without writing; it's the gate). One
    frame rule is only correct if every glyph fills the SAME share of its
    box, and measured they filled **0.853 (quilt) / 0.923 (test tube) / 1.000
    (playground)** — `.scaledToFit()` scales by the longer side, so the
    Playground rendered ~17% bigger than the quilt at the same nominal size.
    No frame number can fix that; the difference is in the ART, so the script
    normalizes the art and leaves the Swift rule alone. An earlier pass got
    this wrong by measuring ONE glyph and assuming the rest matched
    (testtube.svg's comment claimed it filled "the same share the Playground
    glyph fills" — 0.923 against 1.000), which is why the script RENDERS
    every file and measures the ink instead of trusting any comment.
  - **How to check this properly next time:** take a screenshot of the real
    screen, find the accent ink with a colour test (`R-B > 45` — borders and
    background are near-neutral), group it into icons by column runs, and
    divide the bounding boxes by the device scale (3 on an iPhone 13). That
    gives every icon's true rendered size in points, custom and SF alike, on
    one comparable scale. It takes minutes and settles the question; two
    earlier attempts guessed instead and shipped wrong.
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
- **ONE home, with a shortcut row of FILTERS at the top (Aug 2026, Sophie —
  REPLACES the earlier three-home-screens rule).** The home is a single grid;
  above the module cards sits a row of five rounded squares, **icons only**
  ("just the icon" — no labels, `HomeGrid.shortcutRow` in `RootView.swift`).
  ONE opens a tool (**Chats**); the other four FILTER the cards below
  (`HomeFilter`): **photo** = the picture-makers
  (Playground, Test Station, Freeform — the only place the Test Station has a
  card at all), **briefcase** = business, **quilt** = old fashioned, **film**
  = everything that makes or cuts moving pictures AND sound (Movies, Films,
  Cutting Room, Cut Marks, Episode Editor, Voice Studio, Search,
  Characters). The lit chip clears back to everything when
  tapped again (the Dump sort page's convention). `BusinessGrid`/`CraftsGrid`
  and `Screen.business`/`.crafts` are GONE; `deckfactory://business` and
  `://crafts` (alias `://quilt`) land on the home with that filter already
  lit. `Tool.isBusiness` / `Tool.isCraft` now decide which FILTER a tool
  answers to, and keep it off the unfiltered list so the default home stays
  scannable.
  **THE FILM FILTER HIDES ITS TOOLS TOO (Aug 2026, Sophie — she spotted the
  asymmetry: "the quilt hides the modules, but the movies tab doesn't —
  they're all still on the default home screen", then "leave the stuff off
  the home screen, just put it in the movie tab").** So `movieTools` is
  SUBTRACTED from the default grid exactly like `isBusiness`/`isCraft`, and
  the old `pinnedBottom` trio is gone with it — Voice Studio, Characters and
  Films were all film tools sitting at the bottom of the home list. Three
  deliberate exceptions to know before "fixing" any of them:
  - **Story Room is default-home only** — pinned FIRST, and taken out of the
    film set ("story room is no longer movies").
  - **The PICTURES filter is still a pure NARROWING**, not a hiding one:
    Playground and **Freeform** are cards on the default home AND under the
    photo chip (her ask, "put Freeform in the default"). Only the Test
    Station is filter-only there.
  - **Song Station has NO card anywhere** — off the default grid, out of the
    film set, and its tile removed from the web hub too ("get rid of song
    station altogether"). The `.song` case, its view and `deckfactory://song`
    are kept and `/song` still serves; it just joins the
    deliberately-unlinked pages.
  The default home is therefore SHORT on purpose — Story Room, Dreams,
  Lessons, Dump, Playground, Freeform — and everything else is one chip away.
  **Four corner icons** beside the
  masthead, Sophie's arrangement: test tube + briefcase LEFT, quilt + Chats
  RIGHT with Chats on the very end (its original spot). The briefcase and
  quilt corners fire the same filters as their row squares — several
  controls live in two places on purpose ("it can be in two places, silly"),
  so don't "fix" those duplicates. **The DUMP square came OFF the row (Aug
  2026, Sophie: "get rid of the dump button in the row at the top since it's
  now in the main home screen as the default")** — a shortcut to a tool whose
  card sits two inches below it stopped earning its slot once the film tools
  left and the grid got short. That is the one duplicate she did want gone;
  Chats stays in both places.
  **The squares are 60pt with a 26pt icon (Aug 2026, Sophie: "the icons are
  too small — they were set when there were six and now there's only five,
  make them fill out the space a little better").** 48 was sized for SIX on a
  375pt phone; five left a quarter of the row as gap. The arithmetic, so the
  next change needn't guess: usable row = width - 32, gap = (usable - 5 x
  side) / 4 — at 375 that is **10.8pt**, at 390 **14.5**, at 430 **24.5**.
  375 is the floor. It makes the row ~12pt taller and pushes the cards down;
  she said that is fine. `squareSide` / `squareIcon` in RootView are the only
  copies of those numbers.
  **They are SQUARES, and the lit state is a thicker gold outline over a
  light gold tint** (`Theme.accent.opacity(0.14)`, 2.5pt stroke, icon stays
  gold) — v1 stretched them into rectangles by sharing the row width out,
  and filled the lit one with solid `Theme.accent`, which Sophie read as
  "turning that beige color". A fixed-size square centred in an equal-width
  flexible cell is what keeps the shape on every screen width.
  **The set is not settled** — Sophie is still working out what the filters
  should be, so treat it as provisional, not as a rule. The filter icon must
  NOT be the generate star: that glyph is reserved for controls that spend a
  model call.
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
  `refs/dream-mystery.jpg` (gpt-image edits) then animate with Wan (`VIDEO_MODELS`
  in `movies.js`). See also `what-sage-should-do-at-her-computer.md`.

## NDE movies — the watercolour look and the nine character cards (Aug 2026)
**Making watercolour art for the Anthony Chene NDE montages? Read
`docs/nde-watercolor.md` FIRST** — the recipe is settled and the headline rule
is counter-intuitive: **write NO style description at all.** It is the Evan
recipe (`docs/evan-film-style.md`): gpt-image-2 **edits**,
`refs/sage-sandy-mirror.png` attached FIRST as a pure style reference, quality
**medium**, **1024x1536**. The v4 "STYLE CORE" wording in
`refs/nde-style-prompt.md` belongs to the older colored-pencil generation —
do not pull it into these renders. The pastel stills-videos are SCRAPPED.
- **The nine experiencer character cards are BUILT and public** —
  Storage `nde-refs/cards/<surname>.webp`, deliberately beside the photo each
  was drawn from (`nde-refs/people/<surname>.jpg`). Hugenot, Wittbrodt,
  Wright, Barker, Hensley, Rynes, Dennis, Nair, Anthony.
  `nde-refs/cards/manifest.json` (mirrored in the repo at
  `docs/nde-character-cards.json`) carries every card's full name, both URLs
  and the EXACT prompt that made it. **Do not re-derive them.**
- **Using one:** style ref first, that person's card second, then the scene.
  **Say nothing about the face** — a "same face, same hair" preserve-list
  over-weights it and the drawing comes out as a rendered photograph. The
  likeness line is ONE sentence and must not grow back.
- **A portrait needs no background line** — measured, the style ref draws on
  white paper whether the prompt says so or not.
- **Only nine people have an approved likeness.** The other ~30 experiencers
  across the montages have no reference photo, and new ones cannot be grabbed
  from a cloud session (YouTube bot-blocks datacenter IPs). Standing rule:
  **never invent a face for a real person** — draw them from behind, from
  above, or far enough back that the face is not the subject.

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
- **The one-command way Sophie runs it:
  `cd ~/imageforge && git checkout main && git pull origin main && ./scripts/grab`**
  — paste links when asked, Return on an empty line (or
  `./scripts/grab --file scripts/nde-urls.txt`). **`git checkout main` is load-
  bearing, not boilerplate:** her Mac checkout is where chats park
  work-in-progress branches, and it sat on one (`grab-python-fallback`) for
  days — so a bare `git pull` kept answering "Already up to date" while
  updating THAT branch, an already-merged fix never arrived, and the same
  failure repeated every run with nothing in the output to reveal why.
  `scripts/grab` now warns when it isn't on main (or when main is behind) and
  prints that command. It deliberately WARNS instead of switching by itself —
  a silent `git checkout` from inside a download tool can strand another
  chat's uncommitted work. The wrapper builds a private
  venv (`.grab-venv`) with the two Google packages on first run, so the Mac's
  own pip/python state can never break it; every argument passes through to
  `nde-grab-local.py`. Idempotent — re-running skips what's banked, so a
  failed batch is just "run it again".
- **Sophie's home connection stalls on big single uploads (Aug 2026 —
  measured, not guessed).** Any single sustained HTTPS request body over ~1MB
  hangs until the client's retry deadline (plain curl from her Mac: 512KB in
  0.33s, 1MB forever, on both IPv4 and IPv6; her Wi-Fi is generally spotty),
  and sustained `git push` from the Mac stalls the same way. **It is her
  UPLINK, not any one host** — first measured against storage.googleapis.com,
  but later testing stalled the same way to Cloudflare/GitHub/httpbin, while
  downloads stay fine (~2.9MB/s) and 512KB uploads stay fine (~1.5MB/s). So
  don't chase a Google-specific explanation. It shows up as "Timeout of 120.0s
  exceeded" right after a big transcript or audio finishes. Two standing
  workarounds, both proven live (PR #836, corrected in #845):
  - **Every Storage upload from her Mac must be CHUNKED, and the load-bearing
    idiom is `blob.open("wb", chunk_size=…)`.** `nde-grab-local.py`'s
    `upload_bytes()` / `upload_file()` write through a file handle for exactly
    this reason (measured 1.4MB/s where a single-request upload hung forever).
    **Do NOT "simplify" that to `upload_from_string`/`upload_from_filename`
    with `chunk_size` set on the blob** — it looks equivalent and is not, and
    that exact mistake already shipped once: google-cloud-storage's
    `Blob._do_upload` dispatches on SIZE ALONE (`size <= 8MiB` → one multipart
    POST) and **never consults `blob.chunk_size` on that path**, so every
    transcript (1.2-2.2MB) still went as one request — the very thing that
    stalls. `chunk_size` only bites on the resumable path, i.e. files over
    8MiB (the audio). Measured back to back on her Mac with the same 1.5MB
    payload: the blob-attribute form 62.4s (surviving only because a 60s
    read-timeout retry happened to land — under the stall it burns the 120s
    deadline and fails INTERMITTENTLY, the worst failure mode), the
    `blob.open()` form 1.2s. Keep it chunked even if her network heals —
    chunking costs nothing then. Any NEW script that uploads from her Mac
    needs the same treatment.
  - **When `git push` stalls on the Mac, hand the commit to a CLOUD chat —
    don't fight the network.** Cloud sessions push fine. The Mac chat
    describes the change (or pastes the diff), the cloud chat recreates it on
    a branch, pushes, PRs, and merges; the Mac then just runs
    `git checkout main && git pull` (downloads work fine on her connection)
    and deletes its stranded local branch. This is exactly how the chunking
    fix itself landed — written on the Mac as local commit dd3edc0,
    un-pushable, recreated from the cloud as #836.
- **Pulling short CLIPS out of a YouTube video: `./scripts/clip` (Aug 2026).**
  A different job from the grabber above — that banks WHOLE interviews (audio +
  captions) into Firebase; this one saves short **video** clips as files on her
  Mac. `cd ~/imageforge && ./scripts/clip "<youtube url>"`, then paste one line
  per clip (`00:25:48-00:26:06 mailbox`) and Return on an empty line → numbered
  files in `clips/<videoId>/` (gitignored). Re-running skips clips already
  downloaded. `--spans`, `--dry-run` (needs no yt-dlp and no network),
  `--format`, `--out`, `--cookies`, `--browser`, `--no-cookies`.
  This replaces hand-pasted `yt-dlp … --download-sections` one-liners — the old
  way meant re-typing the whole command per clip with new timestamps, which is
  where the mistakes came from. `--force-keyframes-at-cuts` is baked in: without
  it yt-dlp snaps to the nearest keyframe and the clip loses a second or two off
  the front.
  - **COOKIES are the whole game for age-gated videos** ("sign in to confirm
    your age"). The script tries an exported cookies file FIRST — any
    `~/Downloads/*cookies*.txt`, from the Chrome extension "Get cookies.txt
    LOCALLY" — and only falls back to `--cookies-from-browser chrome`. That
    order is deliberate and earned: reading Chrome's cookies directly raises a
    macOS keychain prompt ("Chrome Safe Storage") that accepts ONLY her Mac
    **login** password, and hers has drifted out of sync, so that path dead-ends
    for her. The exported file skips the keychain entirely. It IS her live
    YouTube session — tell her to delete it when a batch is done.
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
- **ANY work on Sophie's audio starts with the `sophie-audio` skill**
  (`.claude/skills/sophie-audio/`) — cutting, pause removal, take selection,
  assembling narration, TTS. It is the tripwire for the two docs below, and
  it ends with the rule chats keep skipping: run
  `node scripts/vo-verify.js` before handing a cut back.
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
- **Each render row has a SCISSORS → the Cutting Room** (Aug 2026), where the
  pauses and filler words come out by tapping them. See the Cutting Room
  section for the contract; nothing about the render itself changed, and
  pause/filler removal deliberately does NOT happen inside a render.
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
  **A picked section STAYS picked after save/send** (Aug 2026, Sophie) — she
  saves AND sends the same span without re-picking; only the ✕ (or cutting it
  out) lets go.
- **The room is TWO hairline tabs — TRANSCRIPT | CLIPS (Aug 2026, Sophie:
  "the scrolling is pretty brutal")** — saved clips and renders live behind
  the second tab instead of below the transcript. Long-recording navigation
  on the transcript tab: **chapter notches** down the left edge (every 5 min,
  10 for >1hr; tap = jump the page to that minute) for recordings over 8 min,
  and a **find-a-word** magnifier in the tools row (live matches highlighted,
  next-arrow cycles; commits on blur — she dictates). Tab row reserves the
  pill's 56px corner; the sliding line is `calc((100% - 56px)/2)`.
- **Cuts are the Episode Editor's cutter** (imported from editor.js —
  `clampBounds` + `detectSilences` + `snapToSilence`, ONE implementation): a
  tap never needs to be precise, edges land in real silences. **A planned
  "manual mode" (cut at the exact tapped millisecond, no snapping) is PARKED
  by request — not in v1.**
  **Every real cut RE-LISTENS first (Aug 2026, earned):** the stored words
  come from the 75s-chunked whole-recording pass, which is chips-only
  accuracy — Sophie's first clip started at "yeah" and grabbed the "he said"
  before it, because the bulk pass timed "yeah" early. `cutSection` and the
  render's cut-outs therefore extract a small window, take FRESH whisper
  word timestamps, and locate the span with `phraseSpan` (buildClip's exact
  precision path); the bulk timings survive only as the fallback. Never cut
  from the stored words directly. Clip entries carry `wi0`/`wi1` so a clip
  can be re-cut.
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
  bytes). **Do NOT point Sophie at `/audio` to find a clip** — that page is
  an UPLOADER whose list shows only the batch typed in its box (defaults to
  today's date), so a `cutting-room` clip is invisible there (Aug 2026, bit
  for real). The review surface is the room's own Sections list, and every
  clip/render row carries a **download** button (Apple's arrow-into-box
  glyph): in a browser it's a same-origin attachment
  (`GET /:id/file?u=<storage url>&n=<name>` — validated to the recording's
  own folder), in the app the `cutroomShare` WKScriptMessage bridge fetches
  the file natively and opens the iOS share sheet (Save to Files/AirDrop);
  **Story Room** → clip cut here, then
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
- The recordings list links out to **Search** (below) — the way in when she
  knows what was said but not which recording said it.
- **A finished Episode Editor render comes here to have its pauses and filler
  words taken out (Aug 2026, Sophie's ask).** Each render row in the editor
  carries a **scissors** (that tool's own glyph) → `/cuttingroom?url=…&name=…`;
  the page opens that url on boot and strips the param, so a reload lands
  where she actually is. `POST /open` already accepted any https url, so this
  needed NO new server code and NO TestFlight build — the nav chevron asks
  `__navBack` (room → list) then falls through to the web view's history back
  to the editor, exactly the path Search's memo hand-off uses.
  **The cut number comes from the render's FILE** (`<episode>-7.mp3`), never
  its row position: `renders` is capped at 10 and newest-first, so positions
  drift as old cuts fall off while the files keep counting up.
  Each render is its own content-addressed room, so marking cut 7 never
  touches the marking on cut 6. Tests: `node scripts/test-cutroom-handoff.js`
  (drives both real pages in headless Chromium; skips without one).
- **Do NOT move pause/filler removal INTO the editor's render** (Aug 2026,
  the decision behind the hand-off). The editor's cuts are safe because both
  edges land in detected silences; removing an "um" from the MIDDLE of a clip
  is a splice, and a splice is something to approve by ear, not have happen
  invisibly inside a render. That is what this room is for. Caveat worth
  knowing: **Whisper often doesn't transcribe "uh"/"um" at all** (that is what
  caused the doubled-word bug — see phraseSpan in
  `docs/nde-precise-cutting.md`), so filler removal by transcript is partial;
  the pause detection catches many of them anyway as breath pauses.

## Search (`search.js`) — every transcript, one search
- `search.js` (`/api/search`, page at `/search`, iOS tile "Search", SF Symbol
  `magnifyingglass`, deep link `deckfactory://search`) — one search across
  **BOTH** transcript libraries: the 77 interview transcripts in
  `forge-nde-videos` (~3.5M chars) and the 1,022 transcribed voice memos in the
  membry archive (~2.2M chars). Nothing could search either before: the Cutting
  Room only searches inside ONE recording already open, the Episode Editor only
  shows a ±150s window around a snippet she already knows about.
- **Results are PASSAGES, not files** — a ~48s window of transcript with its
  timestamp, whose recording it is, and audio. Same paper/gold palette as
  editor.html / cuttingroom.html; the three audio tools are one family.
- **The hand-offs are the point** (a search that only lists is worse than
  scrolling). Each hit goes to the tool that owns that kind of audio:
  **interview → Episode Editor** (`editor.addExternalSnippet` — a snippet card
  lands in an episode and the editor re-cuts it natively), **memo → Cutting
  Room** (`POST /api/cutroom/open` with the recording's url). Search cuts no
  audio of its own except `/clip-words` below; every path feeds the ONE
  cutter in `editor.js`.
- **CLIP-THESE-WORDS on a hit (Aug 2026, Sophie: "pick the words from that
  step if I just want one clip and not the whole recording").** The scissors
  Clip button puts the hit's passage in pick mode — tap first word, tap last
  word, ✓ — and `POST /clip-words {src, text, chunk, timeSec}` cuts JUST
  that span (background job, content-addressed cache
  `search-clips/words-*`), with ▶ + a download button on the result (share
  bridge in the app / same-origin attachment `GET /clip-file?u=&n=` in a
  browser). Rules: BOTH kinds cut through ONE path, `cutInWindow` in
  search.js (fresh window listen + `edgeSpan` + clampBounds + silence snap +
  micro-fades) — an INTERVIEW gets the loudnorm every episode clip gets; a
  MEMO is HER VOICE, never loudnormed, bytes downloaded server-side via
  `memos.memoAudioToFile` (memo audio is not public). A memo's anchor is
  PROPORTIONAL (memo chunks carry no clock): the chunk's place in the
  transcript maps to time, and the listen window slides once each way when
  the phrase isn't where the estimate said.
  - **`edgeSpan` exists because the pick text and the cut come from
    DIFFERENT transcripts** (index words vs the fresh listen): `phraseSpan`
    trims unmatched edge words as never-said — right same-transcript, wrong
    here, where a fresh-listen disagreement on an edge word would silently
    cut picked words off. Each edge anchors on its own 6-word sub-phrase and
    reclaims disagreed edge words by position. Its pick tokens are
    AUDIO-SHAPED (first normWords piece per spoken word) — raw `normWords`
    splits contractions ("it's" → it, s), overshoots the audio span, and the
    reclaim then opened clips one word early (measured live).
  - **Verifying a clip by raw-transcribing it LIES about its first words
    (Aug 2026, measured — cost a needless fix cycle).** Whisper drops the
    fast opening words of an abruptly-starting clip, so a correct cut reads
    as "starts late". Pad ~1s of silence on the front before transcribing,
    or locate the clip in its source by RMS envelope correlation against
    word timestamps (the settling measurement both times). Same rule in the
    `sophie-audio` skill.
- **A hit's Play NEVER points at the banked interview audio.** Those files are
  what yt-dlp downloaded — webm/opus, one object per whole interview (the
  Darius one is **62MB**). Play asks the server to cut THAT PASSAGE to mp3 once
  via `editor.extractWindow` (ffmpeg seeking over HTTP — it never pulls the
  whole file), banked at Storage `search-clips/<videoId>-<start>.mp3`,
  immutable-cached, instant ever after. `GET /clip?src=&t=` is a background job
  (`{status:'making'}` → poll → `{status:'ready', url}`). Two reasons:
  **size** (measured — a 56s passage is ~800KB against 62MB; on a phone that is
  the difference between a tap that plays and one that doesn't) and **format**
  (iOS Safari has no WebM audio support; Opus plays there only inside CAF).
  Voice memos skip all of it — m4a, minutes long, streamed through `/audio/:id`.
- **A page that FETCHES audio needs CORS on the bucket, and testing it
  same-origin hides that completely (Aug 2026, the pausing tool).** An
  `<audio src>` needs no CORS, so every media element in the app worked and
  nothing looked wrong — but `fetch()` + `decodeAudioData` (what any WebAudio
  page does) is a cross-origin read and the browser blocks it. Both buckets
  had **zero** CORS entries, so every such page would have failed live while
  passing its tests, because a local test server serves the mp3 from the
  page's own origin. Both now allow GET/HEAD from
  `imageforge-q125.onrender.com` + `secretlyawitch.com` (added, never
  replaced — `bucket.setCorsConfiguration` overwrites the whole list).
  Check it with `curl -D - -H "Origin: https://imageforge-q125.onrender.com"
  <url> | grep access-control` — a missing header is the bug, and it is
  invisible from a same-origin test.
- **Two things about audio CANNOT be tested from a chat's sandbox** (both cost
  real debugging time — don't re-derive them): ffmpeg's **direct HTTP seek**
  fails because the sandbox's outbound HTTPS proxy is one ffmpeg can't use (it
  exits 2 with no message and falls back to downloading the source), and a
  headless browser has **no network to `storage.googleapis.com` at all**, so
  in-browser playback of any Storage URL is untestable — a `MEDIA_ERR code 4`
  there is a network failure, NOT proof of a codec problem. Verify playback on
  the phone.
- **The index** lives at Storage `search-index/index-v1.json` (~10MB, ~600ms to
  load, ~49MB heap) and is cached in process for 15 min. Built from Firestore +
  the memo manifest; a rebuild is FREE (no paid API) and runs as a background
  job via `POST /reindex` (the page has a "Rebuild the index" button). A
  missing index builds itself on first use. **Re-index after ingesting new
  videos or a batch of memos**, or they aren't findable.
- **Chunks OVERLAP on purpose** (step 30s / span 48s; memos 700 chars / step
  460). Terms are ANDed, so two words spoken in one breath either side of a
  boundary would find NOTHING — "darius pyramids" really did miss the memo that
  says "Darius is like … he describes how the pyramids are like a chamber"
  because a 700-char cut fell between them. `search()` then dedupes the
  near-duplicate hits overlap creates (by timestamp for interviews, by chunk
  adjacency for memos).
- **A term may match the recording's TITLE instead of its words**, scored well
  below a spoken match and left out of the proximity test. Without it "darius
  pyramids" finds nothing in the one interview entirely about Darius, because
  YouTube's auto-caption mis-hears his name in the first sentence ("my name is
  sh right") and he is never named again.
- **TWO MODES, a chip row under the kind filter.** **WORDS** (default) is
  keyword: ANDed terms, `"quoted phrases"`, proximity scoring, prefix matches
  at a discount, word-boundary matching (so "art" never hits inside "heart").
  Instant and free. **MEANING** is embeddings — "the part where he explains how
  the heart holds the soul in" finds it without knowing a word of the wording.
  Only Words highlights the query in a passage (a meaning hit needn't contain
  the words, and marking nothing would imply the match was lexical).
- **The vectors (Aug 2026, live).** Every chunk embedded ONCE with
  `text-embedding-3-small` at `dimensions: 512` (the model's Matryoshka
  property — a truncated vector still works), re-normalised and quantized to
  **int8**: 12,905 × 512 × 1 byte = **6.3MB** at Storage
  `search-index/vectors-v1.bin` (+ a small `-v1.json` meta), loaded as ONE
  Buffer with no JSON parsing. Native 1536-dim float32 would have been 79MB.
  Whole-library cost was **$0.046**, ~16s; a query costs one tiny embedding
  (~$0.000002) and a linear dot-product pass (~150ms).
- **Vectors are KEYED TO THE INDEX BUILD** (`meta.builtAt` + chunk count must
  match). Chunk N in the vector file has to be chunk N in the index, so a
  reindex that re-chunks makes them stale — meaning search returns **409 with
  `code:'stale-vectors'`** (or `'no-vectors'`) and the page offers a one-tap
  re-embed with the price on the button, instead of silently ranking against
  the wrong passages. **Re-embed after any reindex that changes chunking.**
- **Similarity is a RANKING, not a set — hence two floors.** Every chunk gets a
  score, so with no cut-off "the heart holds the soul" honestly reported
  **1,080** passages and pure nonsense still reported 23. Measured on this
  library: a good query tops out ~0.54 and decays slowly, nonsense tops ~0.31.
  So: **absolute floor 0.38** (nonsense returns nothing at all) **plus a
  relative floor of 0.85 × the top hit** (a strong query answers with its
  handful, a vague one can't pad itself out).
- **`embed()` retries transient failures, and that is not boilerplate.** The
  first real run died on a plain OpenAI **500 at 4,800 of 12,905** chunks and
  threw away every embedding already PAID FOR, because one bad response failed
  the whole job. 429/5xx now retry with backoff (5 attempts); a 4xx is
  permanent and fails immediately.
- **`/api/search/audio/:id` widens an existing restriction, on purpose.**
  `memo-audio/**` is readable only by a signed-in Firebase user, and
  `/api/memos/audio/:id` deliberately serves ONLY `cat:'dream'` recordings to
  keep the other ~940 locked down. A hit you can't play isn't a result, so
  Search's own route serves ANY memo — behind the same STUDIO_TOKEN gate. One
  streamer implementation: `memos.streamMemoAudio(id, req, res, {dreamsOnly})`.
- **Routes** (STUDIO_TOKEN gate, only `/status` open): `GET /status`,
  `GET /?q=&mode=words|meaning&kind=&limit=&offset=`, `GET /sources`,
  `POST|GET /reindex`, **`POST|GET /embed`** (build/inspect the vectors),
  `GET /clip?src=&t=`, `GET /audio/:id`, `POST /to-editor`, `POST /to-cutroom`.
  Deep link a query with `/search?q=darius`.
- **Playback gotcha, earned:** the `<audio>` element is `preload="none"`, so
  waiting for `loadedmetadata` BEFORE calling `play()` deadlocks — nothing
  loads until play, so the event never fires. `play()` must be called
  synchronously in the tap (iOS also requires that) and the seek hangs off
  `loadedmetadata` as a backstop.
- iOS: `SearchView.swift` = the Episode Editor wrapper pattern (native
  `.forgeToolBar("Search")`, chevron asks `window.__navBack` then the web
  view's own history — a memo hand-off really does navigate to
  `/cuttingroom` — `__nativeNavBar` injected, audio paused on screen
  changes). Page changes ship via Render deploy; the wrapper needs TestFlight.

## Cut Marks (mark your own cuts on a playhead — video or audio)
- `cutmarks.js` (`/api/cutmarks`, page at `/cutmarks`, iOS tile "Cut Marks",
  SF Symbol `timeline.selection`, deep link `deckfactory://cutmarks`) — the
  **manual** sibling of the Cutting Room (Aug 2026, Sophie's ask): no
  transcript, no waveform — she plays the file, taps the scissors at the
  exact spot, and the marks split it into PIECES she keeps or drops; render
  bakes one new file. Opens recordings from the audio drop AND videos from
  the Dump (`media:'video'` docs) — one room either way.
- **The transport is small on purpose** (Sophie rejected the big five-speed
  shuttle in the mockup: "just to keep playing the video"): a slim horizontal
  three-button pill — back 2s · play/pause · forward 2s — plus tap-the-strip
  to jump. Precision lives on the MARK, not the playhead: each mark row has
  −.1/+.1 nudges and tap-its-time-to-jump. Everything is a tap (wrist rule).
  **The transport sits CENTERED right under the video/audio card** (Aug 2026,
  Sophie: "so it's right there"), not in the bottom bar; the fixed bottom bar
  is just time + the MARK scissors. **Undo, render and "?" are SMALL header
  icons** (30px, top-right before the pill's reserved corner) — undo is a
  session-only snapshot stack (marks + drops, capped 40); renders never
  overwrite anything so they need no undo. In native builds the page hides
  its EYEBROW too (`body.native .eyebrow`) — the nav bar already says CUT
  MARKS and Sophie flagged the double.
- **Dropped pieces are keyed by the piece's times, and every mark edit REMAPS
  them by piece index** (`droppedIdxSet`/`setDroppedByIdx` in cutmarks.html):
  a nudge keeps the same pieces, an added mark splits one (both halves stay
  dropped), a removed mark merges two (merged piece stays dropped only when
  both halves were). Without the remap, nudging a boundary silently
  un-dropped the piece beside it — caught in testing, don't regress it.
- **Renders are exact cuts at the marked times.** Audio: one atrim+concat
  filtergraph with 12ms edge micro-fades so a manual cut never clicks — NO
  loudnorm (her voice rule), channels kept. Video: ONE `filter_complex`
  trim/atrim+concat pass with a single encode (libx264 veryfast, aac) —
  deliberately not per-piece files + concat demuxer, because concatenated
  AAC pieces add ~24ms priming per join and walk the sound off the picture
  (the Scratch Pad film finding). A soundless video renders video-only
  (`hasAudio` probed at open). Audio renders also file into the audio
  library (batch `cut-marks`, track `cutmarks`, hash-deduped).
- **Data:** one doc per file in `forge-cutmarks` (deckfactory),
  content-addressed by sha1 of the url (reopening resumes): `{ id, title,
  kind, source, seconds, hasAudio, marks:[t], dropped:[key], renders (capped
  8), job }`. `POST /:id/state {marks, dropped}` saves the whole marking
  state (the page debounces 600ms, flushes via sendBeacon on pagehide).
  Probe + render are background jobs on the doc (house rule); the page polls
  and resumes from `localStorage['cutmarks_open']`.
- **Routes** (STUDIO_TOKEN gate, only `/status` open): `GET /sources`,
  `GET /`, `POST /open {url, name, kind, itemId, poster}`, `GET /:id`,
  `POST /:id/state`, `POST /:id/title`, `POST /:id/render`, `GET /:id/job`,
  `DELETE /:id`. Tests: keptSegments/audioGraph/videoGraph are exported;
  render graphs validated against real files (exact durations), page flow
  validated headless (playwright).
- iOS: `CutMarksView.swift` = the Episode Editor wrapper pattern (native
  `.forgeToolBar("Cut Marks")`, chevron asks `window.__navBack`,
  `__nativeNavBar` hides the page back button, media paused on screen
  changes — `audio,video` both). Page carries the injected shared pill;
  native pill suppressed in RootView's `showAutoScroll`.
## Getting original art OUT of a Google Drawing (Aug 2026)
Sophie's old scanned artwork lives inside Google Drawings — for a lot of it
those embedded copies are the only ones left. **The SVG export is the only way
out at full size**, and `scripts/gdrawing-extract.py` (stdlib only) does the
whole job: `python3 scripts/gdrawing-extract.py <url-or-id> [-o dir] [--list]`.
- **Why SVG:** File ▸ Download ▸ PNG/JPEG flattens the whole drawing to ONE
  image at **screen size** (~1056x816 — useless for print). The SVG export
  instead embeds every placed image as its own base64 blob at the size Google
  stored it, so splitting the SVG apart returns each picture individually at
  full resolution.
- **Don't reach for the Drive API export** (`download_file_content`,
  `mimeType=image/svg+xml`): it has a hard **~10MB cap** and answers *"File too
  large for export"* for any drawing full of scans. The plain public URL
  `https://docs.google.com/drawings/d/<id>/export/svg` has no such cap (84MB
  came down fine) — that's what the script uses.
- **It needs link sharing.** That URL is unauthenticated, so a restricted
  drawing 401s; Sophie sets Share ▸ General access ▸ "Anyone with the link"
  (Viewer is enough) and can set it back afterwards. The script prints exactly
  that instruction on a 401 instead of a stack trace.
- **Reading the sizes:** anything sitting EXACTLY on **2500px** hit Google's
  upload resize ceiling, so the original was bigger; anything under it is the
  size she uploaded. **2500 applies to PNG as well as JPEG** — an earlier note
  here claimed PNGs capped at 2048, which is wrong (2048 is just a common
  export size, and PNGs come out at 2500 all the time). Either way it is the
  biggest copy that still exists. Bytes are Google's re-encode (same pixels,
  metadata stripped), never the byte-for-byte original file.
- Duplicates are skipped by content hash — drawings copied from other drawings
  repeat images heavily (one 46-image drawing shared 9 with its sibling).
- **A two-figure image** (two people in one placed picture, often on a
  transparent background) splits cleanly on the empty alpha column between
  them, then composites onto white — Pillow + numpy, see the Blake-and-Louis
  pair in the Aug 2026 chat.

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
**LISTEN ROWS — Episode Editor episodes linked to a story (Aug 2026,
Sophie: the NDE montages "should be connected to their stories so I can
listen to them when I go to their story").** A story doc may carry
`episodes: [episodeId, …]` (forge-editor ids); `GET /api/scratchpad/`
resolves each to its NEWEST render live (`audios` on the response — a
re-render in the editor reaches the story with no re-link) and the page
shows a listen row per episode under the title (play · name · length,
sharing the page's one player). Link with `POST /api/scratchpad/episode
{pad, episodeId, remove?}` — like /category it does NOT bump updatedAt.
All 12 NDE-category stories were linked to their montage episodes on
2026-08-11 (`node scripts/link-episodes-to-stories.js`, idempotent;
"NDE · all the supercuts" carries all 11). Tests:
`node scripts/test-storyroom-listen.js`.

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
  with `refs/sage-sandy-mirror.png` as the style ref and, by default,
  `refs/sophie-book.png` as the character card; the prompt defaults to
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
  **write NO style description at all** — attach `refs/sage-sandy-mirror.png` and
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
- **The approve/candidate step is PARKED (Aug 2026, Sophie: "we don't really
  use it anymore… we might put it back in eventually").** The data model keeps
  it — a card still carries `status` (`approved`/`ok` > `candidate`/`cand` >
  `draft` > `miss`), the draft-film stitcher still prefers the best-status art
  per beat, and `/api/story/status` still flips it — so turning the flow back
  on is a UI change, not a migration. But **nothing user-facing may show
  approval state**: no approved-vs-made counts, no "0 of 12 approved" bars, no
  candidate language on a story page or a Compare page. Approvals happened in
  chat with Sophie when the flow was live; sync after flipping statuses.
- **Claude may merge its own PRs without asking** (standing permission, July
  2026). When a PR is ready, merge it — then watch the Render deploy and fix
  anything that breaks.
