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
  **Unnamed sessions keep a per-session tail** (July 2026): every unnamed
  session's branch is `claude/new-session-<random>`, and stripping the suffix
  merged four different sessions into ONE chat called "new-session" — so a
  generic slug (`new-session`/`session`/`untitled`) now gets 6 chars of the
  session id appended, e.g. `new-session-7f3e9a`, one chat per session.
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
  `GET /api/chatfeed/name?chat=<slug>` → `{ displayName, name }` (`name` falls
  back to the slug) — use it when referring to yourself in a handoff or a
  message, rather than the raw git-branch slug. The **slug stays the identity
  key** for every route; renaming is cosmetic and never re-keys a chat's history.
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
  Render cold start) — only a real job error surfaces. Characters keep their
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

## Audio drop (`audio.js`) — recordings off the phone → permanent URLs
- `audio.js` (`/api/audio`, page at `/audio`) is the generic destination for
  audio. Nothing else did that job: `/api/story/voiceover` attaches ONE
  recording to ONE story, `/api/songs` runs the whole song pipeline,
  `/api/memos` files into the stamped 993-memo archive (and costs money per
  file), and the Dump takes images + video only. A folder of recordings in the
  Files app had nowhere to go.
- **The iOS Share sheet is NOT a way in.** `DumpShare`'s activation rule is
  `SupportsImageWithMaxCount` / `SupportsMovieWithMaxCount`, so a voice memo
  never offers ImageForge as a destination. The way in is the `/audio` page's
  file picker (multi-select works straight out of the Files app) — or Voice
  Memos → Share → Copy → Story Room's "Paste a recording" when it belongs to
  one story. Adding audio to the share extension is a TestFlight build.
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
- **Every image deliverable goes into the in-app gallery.** See "Deliverables →
  the in-app gallery (ALWAYS)" near the top — post it with
  `scripts/post-to-gallery.js`, stamped with its true make-time.
- **LABEL every image you deliver.** An image link's markdown text becomes its
  Assets-tab description (what Sophie reviews by). ALWAYS write a meaningful
  label — `[Penny — the blue Kleenex](url)` — NEVER `[p01](url)`, `[image](url)`,
  or a bare URL. Applies to every image in a finished reply.
- **POST THE PROMPT for every image you deliver**, split into style + content —
  `POST /api/gallery/assets/prompt`. It's what the PROMPT overlay in the Assets
  tab reads. Full rules in "Prompts on Assets images" above.
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
- **NO GRADIENTS. Ever.** Sophie hates gradients — flat solid colors only, in
  every UI (iOS, web pages, artifacts). No LinearGradient, no CSS gradients.
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
  sequence. Narration = ElevenLabs voice `UTkHGl2ImiT6gwtAFCql`, model
  `eleven_v3`, text prefixed `[quietly] `, then `atempo=1.12` + loudnorm.
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

## Story Room (forge-story) — THE story surface (merged July 2026)
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
