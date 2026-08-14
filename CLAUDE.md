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
- **Cloud environment on ACCOUNT 1 — there is exactly ONE, so the Setup
  script has no wrong box to land in (measured 2026-08-14 via
  `list_environments` on an iOS-origin session).** `env_011CUK6hCggHt2xBmWdmSdND`,
  name "Default", description empty, created 2025-10-20. The two-identical-
  Defaults trap below is an ACCOUNT 2 problem only — don't repeat that warning
  to her when she is pasting on account 1, it just adds a decision that
  doesn't exist. A chat settles which account and environment it is on by
  calling `get_session` on its own session id and reading `environment_id`.
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
  TOUCHED (read, verified, copied a url of) used to be filed into that chat
  unlabelled — see `docs/wip-asset-filing.md`** for the mechanism, how to spot
  one (no `description`, caption reads `from <chat>`) and the measurements.
  **GUARDED SERVER-SIDE SINCE AUG 2026 (`asset-guard.js`, in the `assetsOnly`
  branch of `POST /api/gallery`)** — so it reaches every chat, including ones
  on ancient hooks, with nothing to re-paste. Three rules, and they judge ONLY
  a background catch (that door, plus no description and no curated caption):
  a **prose** delivery and any **labeled** filing are never touched, so "it
  can be in two places" and a chat curating a photo into its own tab both work
  exactly as before.
  - **Labeled elsewhere → refused.** A catch may not create a tile for a url
    already filed WITH a label in a DIFFERENT chat (matched by url, then by
    md5 when that misses — which catches a renamed copy and costs no extra
    Storage read). 144 of the 759 catches on file are this.
  - **A server-derived display copy → refused** (`thumbs/`, `drops/_thumb/`).
    A thumbnail is labeled in no chat, so the rule above can never see it —
    and investigating the first stray filed a thumb of it straight back in.
  - **A Dump photo → LABELED, never refused.** It files carrying its album's
    name ("Dump — Dinner party #3"), read from `forge-drops`. **Refusing
    these was built first and reversed by measurement**: all 90 `drops/`
    records are unlabeled background catches, the 18 in the dinner-party chat
    included, and those are a review workflow Sophie uses — her pull and a
    stray are the same POST. The problem was never that they were filed, it
    was that they tiled nameless.
  - **The safety net is intact for anything a chat MAKES** — a picture labeled
    nowhere still files (523 of the 759), including the unlabeled source sheet
    behind a batch of labeled cut-outs.
  - Still true, and not bugs: the guard needs the deliberate filing to land
    FIRST (a catch that beats it leaves both records — the md5 union and the
    sweep clean up after that), and a RE-ENCODED copy is different bytes under
    a different name, so nothing joins it. `POST /api/gallery/asset-cleanup`
    (with `dry` first) still removes strays.
  - Tests: `node scripts/test-asset-guard.js` (the whole decision table with
    fixtures, no network).
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

- **Product pipeline** — the **Product Creator IS `/studio`** (iOS tile on the
  business filter): describe a vibe -> plan theme/styles/products -> generate
  designs -> real Printify mockups -> AI listing copy -> one Create tap runs the
  whole batch as a server background job. **Nothing goes live from here, ever** —
  apparel/mug become Printify products published to Etsy as DRAFTS, art
  print/card become plain Etsy drafts. Five self-contained modules behind it:
  `pipeline.js` (orchestration), `printify.js` (live-confirmed), `printful.js`,
  `lulu.js` (books), `mpc.js` + `mpc-upload.js` (card decks at MakePlayingCards,
  which has no POD API — payment is never automated). Keys load from env vars OR
  a Firestore doc via `config-loader.js`; host env always wins.
  **Full details: `docs/modules/business.md`, plus `docs/mpc-fulfillment.md`.**
- **Playground** (`/playground`, `public/promptlab.html` + `/api/promptlab`, iOS
  tile) — the prompt tester. Fixed recipe per style so runs stay comparable: ONE
  image a run, 2:3, Generate is the stars icon. Five styles: WTR (the only
  Replicate LoRA), ChatGPT, Scarry, Pastel, Hoonies (all gpt-image-2 edits with
  her own scans attached as style refs, kept in `PL_GPT_STYLES` in server.js).
  **A Replicate run she already has is never sent again** (Flux with a fixed seed
  is deterministic); ChatGPT is never deduped, because an identical run there
  draws a different picture. Quality low/medium/high ~2c/6c/25c, deliberately not
  persisted. Cancel is Replicate-only on purpose. The feed pages backwards through
  time and has LIST and TILES views. **Full details: `docs/modules/pictures.md`.**
- **Vector pipeline** (`vector.js`, `/api/vector`, page at `/vector`, iOS tile
  under the PICTURES filter) — describe 1-25 drawings -> ONE gpt-image-2 sheet in
  the pastel house style (~6c, the only cost) -> cut into cells -> trace each to
  SVG (free, local). **Making vector art, or touching `vector.js`/`vectorize.js`?
  Read `docs/vector-pipeline.md` FIRST** — it carries the exact style, routes,
  gotchas and tests. The one hard limit is GRADIENTS. Re-cutting a sheet you
  already paid for is free. Recolour after the fact with `POST /recolor`, and
  never turn that into a find-and-replace. **Full details: `docs/modules/pictures.md`.**
- **Freeform** (`freeform.js`, `/api/freeform`, `/freeform`) — the one image
  surface with **no opinion**: the prompt goes to gpt-image-2 verbatim, no prefix,
  no suffix, not even a trailing-period trim. `promptSent` is stored on every run
  so anyone can verify nothing was added — the "if you add anything to a prompt
  Sophie gave, tell her" rule made structural. References are a LIBRARY, not a
  per-run upload. **Full details: `docs/modules/pictures.md`.**
- **Writing Room** (`writing.js`, `/api/writing`, `/writing`, iOS tile) — every
  dating-book date in two versions ("Claude's" and "Mine") with every changed word
  marked red, autoscroll, and per-paragraph notes (text or voice memo). **Notes are
  the review loop**: she annotates on the couch, ANY chat can read them
  (`GET /api/writing/notes`) and apply the edits, then DELETE them. Source of truth
  is `docs/dating-book/working-drafts/featured2.json`; run
  `python3 scripts/gen-writing.py` after editing and commit all three files.
  **Full details: `docs/modules/story.md`.**
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
  new-module, new-tool, sophie-audio, …) are only discovered by Claude Code once a chat
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
- **A TURN STARTED BY A BACKGROUND EVENT IS STILL A TURN (v14, Aug 2026).**
  Sophie, across several chats in one week: "your last message didn't show up
  in my chat app." The pattern was exact — every turn that answered HER
  posted, every turn that answered a wake event / task notification did not.
  **The two questions the hook asks about a user record are SEPARATE and must
  stay that way:**
  - **the TURN BOUNDARY takes everything** — ANY non-tool-result user record
    ends the previous turn, machinery included, because a wake really does
    begin a turn whose reply deserves its own message;
  - **`her_words` decides what is POSTED as hers** — machinery is a boundary
    but never a message.
  Merging them (the first fix for the wake-envelopes-as-her-messages bug)
  left a background-event reply keyed to the PREVIOUS turn. The message doc
  id is `sha1(session|turn)`, so it UPSERTED onto that already-finished
  message, inherited its `created` (the upsert preserves it deliberately),
  never rose in the thread, and read as gone. The live-draft pass was worse:
  it re-marked that delivered reply `working:true`, which is why those chats
  ALSO sat parked in the hidden pile waiting for a reply she already had —
  one cause, two symptoms, and worth remembering when the next "it's parked
  and silent" report arrives. `turnkey_of()` (both parsers, kept in step)
  also gives a machinery record with no uuid a STABLE key off its timestamp
  rather than silently inheriting the previous turn's — stable because the
  hook re-parses the whole transcript on every event, so a volatile key
  would fork the doc. Tests: `node scripts/test-chats-turn-boundary.js`
  (drives the REAL hook against a capture server; verified failing on the
  unpatched hook, 9 of 17).
  **THE TWO SYMPTOMS ARE OPPOSITE SIDES OF ONE ROLLOUT, which is why this
  read as "various reasons" (measured 2026-08-14):** a chat on the OLD hook
  files `<wake …>` envelopes into her feed AS HER MESSAGES but posts its
  turns fine; a chat on the in-between hook posts no wake-turn replies at
  all. Diagnose by which hook the chat carries before theorising. The
  population that day: **1 of 235 chats had EVER reported a hook md5**
  (`hookV`, v11+), i.e. essentially every session was on a pre-v11 snapshot,
  and the chats that lost turns were the few recently healed by hand.
- **THE CARD REMINDER IS IN THE HOOK (v13, Aug 2026).** On UserPromptSubmit
  the hook prints one line of `additionalContext`, so every turn begins with
  the reminder to refresh the chat's STATUS CARD and UPDATE card before it
  ends. Why: measured 2026-08-13, only **15 of 224 chats had ever POSTed an
  Update card**, so the ⌄ pop-out almost always fell back to the reply's
  TLDR — the rule was written here and forgotten, which is what machinery is
  for. Three things about it that are deliberate: the text is a FIXED string
  baked into the hook (it is never fetched from the server — a hook that
  relayed server-supplied instructions is the boundary the v11 note below
  describes); it is the ONLY thing the hook ever writes to stdout, on the one
  event whose contract reads stdout as JSON, so nothing else in the script
  may print; and there is no state file — it is one cheap line every turn.
  **Reaching an existing environment still needs Sophie's one-time re-paste**
  of `docs/chats-autopost-setup-script.sh` (the standing distribution caveat
  above) — a chat on an older hook simply gets no reminder, which is silence,
  not a wrong turn.
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
  **THE FOUR RULES SHE KEEPS REPEATING, now baked into the kit (Aug 2026,
  after /vector broke three of them on day one).** They live as comments at
  the top of `tool.css`, in the `new-page` / `new-tool` skills, and — for
  Compare pages — as `warnings` on `POST /api/chatfeed/page`:
  1. **The tool's name appears ONCE.** The native bar carries it, so the page
     must not. `?embed=1` hides the page's own title row — and **the server
     now does that itself** (it injects the style for BOTH `.app-header` and
     `.tool-eyebrow` plus `document.body.classList.add('embed')`), because
     the old rule lived in tool.css behind a `body.embed` that only
     studio.html's hand-written JS ever set. **`GatedWebTool` appends
     `embed=1` to every path** rather than each call site remembering —
     /vector shipped without it and read "VECTOR" twice down the screen.
  2. **No instructions on the page** — behind the `?` (`#help`/`.helpcard`).
  3. **Text boxes ship EMPTY**, not even a `placeholder`: "whenever there's a
     text box there should not be anything in it… I prefer nothing." An
     example belongs in the `?` card.
  4. **A button is only as wide as its words** — never `width:100%` or
     `flex:1`; `.btn` says `width:auto; flex:0 0 auto` out loud so someone
     else's flex row can't stretch it.
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
  - **CONTENT is the side the overlay opens on (Aug 2026, Sophie: "right now
    the style is the default and I want it to be the content, so I don't have
    to click all the time").** What the picture is OF is what she opens the
    overlay for; the style half is the same house prefix across most of a
    batch, so Style-first charged her a tap on every image to reach the half
    that differs. Style still wins when content is the only half missing.
  - An image with no prompt on file shows **no PROMPT button at all** — never
    write "no prompt filed" anywhere; empty is silent by design.
  - These instructions live HERE only. There used to be a "How to post prompts"
    fold at the top of every Assets tab, but chats read this file, not that
    page — so it was clutter only Sophie ever saw, and it's been removed.
  - **The tab is PAGED, and it dedupes by CONTENT HASH as well as by filename
    (Aug 2026 — the fail-safe that replaced "sweep for the duplicates
    afterwards").**
    `GET /api/gallery/assets?chat=&limit=&offset=` returns `{assets, total,
    offset, limit}`; the app loads 150 and pulls the next page as she scrolls.
    It used to be a single capped request, which was a hard truncate — a chat
    past 300 images silently lost its OLDEST ones (never deleted, just never
    sent). **One picture can live at two storage paths** (where it was
    generated, e.g. `witch-school/assets/<id>.png`, and the copy the server
    makes when the same image is also sent as a file,
    `claude-deliveries/<random>.png`): the copies collapse into one tile, every
    field is merged, the url kept is the one carrying the label/prompt, the
    others ride along as `alts`, and a ♥/note left on either path is still
    found. **`asset-union.js` is the whole rule** and it joins on three keys:
    - **`md5`** — the Storage object's own md5, read from object METADATA at
      filing time (`asset-hash.js`; bytes are NEVER downloaded, the
      `drop-dedupe.js` technique). This is what finally kills the
      claude-deliveries twin, whose random filename could never match.
    - **`hash`** — the sha256 `POST /api/gallery` already computes when bytes
      arrive inline. A DIFFERENT algorithm on purpose, so it lives in its own
      key namespace: md5 is free from Storage, sha256 is free from bytes in
      hand, and neither is worth a download to convert into the other.
    - **the filename**, exactly as before, for every record carrying neither.
    **The join is TRANSITIVE (union-find), and it has to be** — A can share an
    md5 with B while B shares a filename with C, and all three are one picture;
    a per-key pass would leave that chain as two tiles.
    **The bucket comes from the URL, never from whichever app is handy** —
    the same picture can sit in deckfactory-43176 or membry-df528 and a
    credential for one cannot read the other. Reading the md5 is best-effort
    everywhere (external url, deleted object, slow call → file with no `md5`,
    exactly as before): a dedupe hint must never fail or stall a filing.
    **Old records need `node scripts/backfill-asset-hashes.js`** (`--dry-run`
    first, `--chat <slug>` for one, idempotent, only ever ADDS `md5`) — until a
    record is hashed it still falls back to the filename, so duplicates already
    in a tab collapse once it has run over them.
    Tests: `node scripts/test-asset-hash-union.js` (the real union against
    fixture records — no network; verified failing against a filename-only
    join).
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
  **THE ARCHIVE IS TWO PILES — BUILT · OTHER (Aug 2026, Sophie: "right now
  the archive is a single list, I want to split it using the hairline pattern
  into two piles, one of things where we built something and something was
  accomplished and everything worked out, and then another one that's pretty
  much trash but I'm just keeping it for bookkeeping").** Her own examples of
  the second pile: the chat where her computer wouldn't turn on ("yeah I did
  fix it but it's not really important") and the one about Google Takeout
  failing on her email. `.acctabs.archtabs` at the top of the archive grid,
  `archiveKind` on the registry doc, `POST /api/chatfeed/archive-kind
  {chat|chats:[…], kind:'built'|'other'}`.
  - **ABSENT MEANS BUILT, and that is the load-bearing half.** 81 chats were
    already archived the day this shipped, so storing only the second pile
    means no backfill — and no risk of the left tab opening empty and reading
    as the archive having been wiped. Only the throwaways carry a mark, which
    is also the smaller and easier judgement.
  - **It is INDEPENDENT of `archived`** and permanent like `starred`, not a
    self-clearing stamp: a chat marked `other` and then pulled back out of the
    archive keeps the mark, so re-archiving it never asks her twice.
  - **The row's button in the archive MOVES the chat, it does not hide it**
    (↓ / ↺, the Compare list's supersede idiom). It replaced the hide ⊖ there,
    which was a dead control and always had been — the hidden pile is derived
    from `live`, which excludes every archived chat, so hiding one could never
    put it behind the red bar. One button per row; two makes the wrong one the
    easy tap.
  - **The tab row needs NO 56px pill reserve** — it is drawn at the top of
    `#grid`, below the hidden bar, so it clears the pill's y 14–192 band. Move
    it higher and it needs the reserve plus `width:calc((100% - 56px)/2)`. No
    count badges: the red one elsewhere means "something answered you", which
    an archived chat doing is not.
  - **THE ACCOUNT TABS ARE HIDDEN IN THE ARCHIVE, AND THE ARCHIVE IS NO
    LONGER SPLIT BY ACCOUNT (Aug 2026, Sophie: "I noticed there's an update
    and account one account two tab in the archive").** `#accrow` had always
    shown there; adding BUILT / OTHER underneath left two hairline rows
    stacked 37px apart, and UPDATE was incoherent in that row regardless — it
    is a whole VIEW, not a way of narrowing the chats below it. So the
    archive shows ONE row, its own.
    **The filter had to go with the row**, not just the row: a pile still
    narrowed by a control no longer on screen is the silent filter this file
    keeps warning about. `renderHome` therefore builds `arch` from
    `everyone` (unfiltered) while every other pile still comes from `all`.
    The cost is small and the error is in the safe direction — she sees MORE
    archived chats than before, never fewer — and the archive is the
    away-for-good pile, where which Claude account a chat ran on is the least
    interesting thing about it. `test-chats-accounts.js` asserts this
    exception (both accounts listed, one visible tab row); it previously
    asserted the opposite.
  - **ARCHIVING ASKS WHICH PILE, AND WHAT TO CALL IT (Aug 2026, Sophie: "the
    archive should have an option to add it into the built or other pile and
    also give an option to type a text box as a title for what it saves
    under… there's already a pop-up for archive so you can just add it to the
    top").** `askArchive()` in chats.html — the existing `askFirst` sheet
    with two controls added ABOVE the question: a name box, then the pile.
    - **The pile picker is `.acctabs` — the SAME hairline row she is about to
      land in**, so the choice looks like its destination. BUILT preselected,
      which is also what happens if she never opens the sheet.
    - **The name box is PREFILLED with the chat's current name** (the /vector
      precedent — a box holding its real current value, not example text; the
      "text boxes ship empty" rule is about examples). Untouched, it renames
      nothing: `askArchive` answers `title:null` unless she actually changed
      it, so an unchanged box never fires `POST /rename`.
    - **The rename and the pile are written BEFORE the archive**, so the chat
      lands already named and already filed rather than sitting on BUILT for
      a moment under its old name. Each write is independent — a failed
      rename must not stop the archive.
    - Taking a chat OUT still asks nothing; that gesture is one decision.
    - Tests: `node scripts/test-chats-archive-sheet.js`.
  - Session-only, every page load opening on BUILT. A first pass of 16 chats
    was flagged 2026-08-13 from the thread contents (empty one-message chats,
    diagnostics, dead ends she had already noted as failed, and sign-in/env
    troubleshooting); a starred chat, or one with an outstanding `need`, was
    never flagged. Tests: `node scripts/test-chats-archive-split.js` (the real
    route against a stubbed Firestore + the real page in headless Chromium;
    verified failing against an inverted default).
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
  - **A PARK IS CLEARED BY A FINISHED REPLY THAT LANDED AFTER IT — compare
    `postedAt`, NEVER `created` (Aug 2026, Sophie: chats "end up in the
    hidden and then they never come out of it so I never know when they're
    done and I forget about them").** `unparked()` in chats.html is the one
    rule, read by BOTH `chatHidden` and `chatBack`.
    - **Why `created` is the wrong field, and it is not obvious:** a turn's
      message doc is CREATED BY ITS FIRST LIVE DRAFT, so `created` is when
      the chat started WRITING, while every park stamp is written when
      something LANDS. So anything that parks a chat mid-turn — her own
      message sent while it works, or a `<wake …>` envelope on a stale hook
      — always out-stamps the very reply that answers it, and the chat can
      never come back on its own. `postedAt` is monotonic and bumped on
      every write, so it answers the honest question: did this chat write
      anything after I parked it?
    - **Measured 2026-08-14: 30 chats stuck in the pile**, two of them
      holding full replies she had never seen — "Baby gets a boost" posted a
      5,233-character draft at 04:47:01 and was buried by a stamp at
      04:48:18, 77 seconds later. **16 were visible to her; the other 14
      were FILED, so they were invisible on the main list AND absent from
      the hidden bar**, reachable only by lighting the right chip. When she
      says a count looks low, check the filed ones before doubting her.
    - **FINISHED, not merely newer — her call, asked directly ("only when
      it's finished").** A live draft (`working:true`) keeps the chat
      parked: it is still typing, and parking means "not now", so it returns
      when it is done rather than the moment it starts.
    - **Her own message can never un-park the chat it just parked** —
      `/reply` writes her message's `postedAt` BEFORE stamping `hiddenAt`,
      so the stamp is always strictly later. Pinned by a test; keep that
      write order if either is ever touched.
    - Tests: `node scripts/test-chats-unpark.js` (lifts the real functions
      out of chats.html and runs them — no browser). Clearing a chat that is
      already stuck needs `POST /hide {chat, hidden:false}`; deleting the
      message that parked it does NOT, because the stamp lives on the
      registry.
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
  - **A starred chat is NOT a kept chat anymore (Aug 2026, Sophie split
    them).** `starred` now means "a chat I'm currently working on" and comes
    off when she's done; **`bookmarked` is the keep-forever mark** and is what
    fills the CHATS tab of the Bookmarks pile. See "THE KEEP-PILE IS THREE
    TABS" for both halves. The description above — "important, work I want to
    refer back to, but I'm not actively using them" — is the BOOKMARK's
    meaning now, not the star's.
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
  - **A kept CHAT is BOOKMARKED, NOT starred — the two were SPLIT APART (Aug
    2026, Sophie: "bookmarking a chat is when I want to keep it in my history
    and go back to it, like if it has useful information — there's only a
    handful of chats like that, such as the dating book chat where we made the
    Writing Room, the moon milk experiments, the Imprint chat… starring chats
    is more of a temporary thing, like a chat I'm currently working on.
    Bookmarks stay forever").** They had been ONE flag, and this file argued
    for that ("a second per-chat keep-flag would only make her remember which
    of two piles a chat went into") — she overruled it, because they answer
    different questions:
    - **`starred`** = what she is on RIGHT NOW, temporary, comes off when
      done. The red star at the front of a row, the ★ chip, `POST /star`.
    - **`bookmarked`** = the handful worth keeping forever. Permanent. Fills
      the Bookmarks pile's **CHATS tab**, `POST /chat-bookmark {chat,
      bookmarked}` (404s on a chat that doesn't exist — the phantom-row
      guard). The row mark is the **filled bookmark glyph** beside the star.
    - **Both controls sit side by side in the thread header** — the bookmark
      then the star — so the difference is a choice she makes in one place.
      The keep button is `.bmk.chatbmk`, written that way and never
      `.chatbmk` (the `.bmk.hdrbmk` trap: the generic `.bmk` rules sit LATER
      and win at equal specificity). Measured at 375/390/430 — five controls
      on that row still fit on one line with none of them buried.
    - **Migration (2026-08-13):** the 22 chats starred under the OLD meaning
      were copied to `bookmarked` and their stars cleared, so nothing was
      lost and the star starts empty under its new meaning. She prunes the
      bookmark list down to her handful.
    - The ★ chip still reaches into the archive. That was justified by the
      old meaning; it is harmless under the new one and was left alone.
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
    anything. It is deliberately separate from `answeredAt` — "I know about
    this" is not "this chat is done".
  - **THE ✓ IS THE ONLY THING THAT TAKES A CARD OFF THIS SCREEN (Aug 2026,
    Sophie: "make the default behavior that it's pinned until I mark the
    checkmark and get rid of the pin").** `newsFloor` is `notifSeenAt` and
    nothing else. It used to be the LATER of that stamp and the per-device
    `seen` mark (localStorage, written when she opens a chat) — so reading a
    thread quietly cleared its card, and a PIN existed to opt one card out of
    that. Every card is kept by default now, so the pin is gone; `seen` still
    drives the unread dot and has no say here.
    - **`markSeen` must NOT post `/notif-seen`.** It used to, purely so the
      widget's count matched the tab's, and that was harmless while opening
      a chat already cleared its card. It would now clear a card she never
      checked. The widget has always counted off `notifSeenAt` alone, so the
      two surfaces agree by construction — that is what `test-chats-news.js`
      §5b2 asserts.
    - **`newsPinned` / `POST /news-pin` are REMOVED.** Stale
      `newsPinned:true` fields may still sit on old registry docs; nothing
      reads them. If you add a route here later, note that `pinned` + `POST
      /pin` are TAKEN by the pinned DELIVERABLE (the film at the top of a
      thread), which stores an OBJECT there — Express takes the first match,
      so a route named `pin` would shadow it and the ✓ would delete the film.
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
  - **THE CARD'S TOP ROW: name · ⌄ · TIME · ✓ (Aug 2026, Sophie: the ⌄ "is a
    little bit close to the check box so I'm worried I'll tap that by
    accident — maybe just move it on the other side of the clock time").**
    The timestamp is lifted OUT of the inner `.crow` and rendered as a
    sibling in `.nwtop` precisely so it sits BETWEEN the expand arrow and the
    clearing ✓; the row gap also went 3px → 9px. Measured at 390px: 68px now
    separates ⌄ from ✓, against 3px before — the pin sat to the LEFT of the ⌄,
    so removing it left that gap alone (67px measured after). Anything added
    to that row must keep the ✓ alone on the far side of the time — it is the
    one tap that makes a card disappear.
  - Tests: `node scripts/test-chats-news.js`, and
    `node scripts/test-chats-news-sticky.js` (hit-measures the ⌄/✓ gap, and
    drives a card through being opened to prove only the ✓ clears it). It
    replaced `test-chats-news-pin.js`, which asserted the opposite contract.
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
  herself.
  **The row is `.acctabs.cmptabs`; `data-on` is the plain SLOT INDEX (0 =
  Superseded, 1 = Current), like every other row. It carries NO width — see
  "THE HAIRLINE ROWS' SLIDING LINE MEASURES ITS TAB" under Design rules,
  which is where this bug was closed for good.**
  **A chat posting a new version should supersede the one it
  replaces** — that is what keeps eleven drafts of one tool out of her way
  WITHOUT deleting the history.
  **Every row (both tabs) also carries a BOOKMARK** that sends the page to
  the Bookmarks view's **ARTIFACTS** tab, alongside her kept chats and
  messages — see "THE KEEP-PILE IS THREE TABS" above. One more reason never
  to delete a superseded page: she may have kept it.
  **THE REFERENCE SHELF — a comparison whose answer stays true is SAVED, and
  every chat reads the shelf before rebuilding one (Aug 2026, Sophie: "we
  should save compare pages if they're comparing things that often need to be
  re-referenced — for example the different qualities of images like high,
  medium and low, or the different styles").**
  - **Posting one:** `POST /page { …, reference:true, topic:"image quality" }`,
    or after the fact `POST /page/:id/reference { reference, topic }`. The
    topic is the QUESTION it answers, plain and reusable — `image quality`,
    `styles`, `lora scale`, `sheet grid` — never the page's own title; it is
    what groups the shelf. Lower-cased and trimmed server-side, 40 chars.
  - **READ IT BEFORE YOU BUILD ONE: `GET /api/chatfeed/references[?topic=]`**
    → every reference page across every chat, newest first, with the url that
    opens it, plus `topics`. If the comparison she is asking for is already on
    the shelf, hand her that link instead of spending her money and her
    attention re-rendering it. This is the half that pays for the feature.
  - **It is the CHATS' flag, `bookmarked` is HERS** — the same split as
    `starred` vs `bookmarked` on a chat. A reference page shows in the
    Bookmarks pile's **ARTIFACTS** tab with no keep-tap from her (the tab
    heads two piles, REFERENCE over KEPT, and only when both exist); its row
    wears its topic and a small **↓** that takes it off the shelf. Nothing
    ever takes one off by itself.
  - **What earns a place:** a comparison that will be asked again — quality
    ladders, style sets, LoRA scale rungs, grid/cell sizes. NOT a one-off
    decision ("which cut", "old tracer vs new", a settled voice A/B). When in
    doubt leave it off; she can't be asked to prune a shelf.
  - Twelve existing pages were seeded 2026-08-14 by
    `node scripts/mark-reference-pages.js` (`--dry-run` first, idempotent) —
    scattered across eight chats, and only 4 of the 333 pages on file had ever
    been bookmarked, which is why her own keep-tap was never going to gather
    them. Tests: `node scripts/test-chats-references.js`.
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
  **The rule kept coming back because THE TEMPLATES TAUGHT THE OPPOSITE
  (fixed Aug 2026):** `judge-shell.html` and `picker-shell.html` both opened
  with an eyebrow + tagline, and compare.css's own skeleton comment listed
  them — so a chat starting from the right file still copied the wrong shape.
  All three are corrected, and `POST /page` now answers a `warning` naming
  the eyebrow / the tagline.
  **INSTRUCTIONS GO BEHIND A "?" — never down the top of the page (Aug 2026,
  Sophie: "every chat seems to include a long list of instructions… if they
  do want to put instructions they can put it behind a ? so I can tap it if I
  don't know what's going on. That's a much better idea").** One line:
  `window.__compareHelp({ html: '…' })` in `/compare.js` — the circle rides
  at the end of the title (the pill owns the top-right corner), the card is
  `position:fixed` so it can't push the page down under her finger, and any
  tap closes it. A judge page passes `help:` to `__judge`; a tool page uses
  tool.css's `#help`. Most pages need none at all.
  **TEXT BOXES SHIP EMPTY, and BUTTONS HUG THEIR WORDS (Aug 2026, Sophie).**
  No example text in a box, not even a `placeholder` ("I prefer nothing") —
  it belongs in the `?` card if anywhere. And "there's no reason to make
  buttons longer than they need to be to hold the text": compare.css's
  `button,.btn` is `inline-flex; width:auto`, never a full-width slab.
  `POST /page` warns about a `placeholder=` too.
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
- **Push notifications** (`push.js`, `/api/push`) — real APNs lock-screen
  notifications, raw HTTP/2 straight to Apple, no Firebase Messaging. Sent on a
  **finished reply** (never a draft) and on a new Compare page, debounced to one
  per chat per 10 min. They are the Update tab's **doorbell, not its replacement**,
  so a dropped push is never lost news. A tap opens THE CHAT IT CAME FROM.
  Dormant until the APNs key exists — only Sophie can mint it.
  **The home-screen widget** reads one small JSON (`GET /api/chatfeed/widget`) and
  must NEVER pull the real feed. **Full details: `docs/modules/inbox-and-misc.md`.**
- **Card-deck art generator** (`apiframe.js`, `/api/apiframe`) — the deck card art
  via **Midjourney**, which has no official API, so it goes through APIFRAME
  (their own MJ accounts — none of Sophie's is involved). ~6-8c per generate of 4
  options. `ingest.js` (`/api/ingest`, `/import`) is the bring-your-own-Midjourney
  alternative, plus a Chrome extension that posts straight from her logged-in MJ
  session. **Full details: `docs/modules/pictures.md`.**
- **Crystal drop** (`crystals.js`, `/api/crystals`, `/crystals`) — her mom's
  crystals, photographed, on their way to Etsy listings. **The album-is-one-stone
  model is WRONG for most of the real data**: the photos live in the Dump (15
  albums, 629 photos), and most albums are catalogue runs holding 20-50 separate
  stones — roughly 175 stones in total. Nothing can DERIVE where one stone stops
  and the next begins, so **the Splitter (`/crystalsplit`) asks her**: one tap on
  any photo that starts a new stone. Marks are file ids, never indexes. Tiles must
  use `thumb`, never the full-resolution `url`.
  **Full details: `docs/modules/business.md`.**
- **The Dump** (`dropbox.js`, `/api/drop`, sort page at `/dump`, iOS tile with
  SEND and SORT tabs) — **dump first, label afterwards**. Dropping asks no
  questions; only the bundle (a Photos album) and the session are captured,
  because they are free then and expensive to reconstruct later. Bytes are stored
  once, content-addressed, so the same photo in two albums is ONE object.
  **FOLDERS CONTAIN ALBUMS — they never merge them** (a folder is the `track`
  field; filing an album moves nothing inside it). `photoIndex` comes from a
  transaction, never from counting — that is the bug that scrambled album order.
  **Full details: `docs/modules/inbox-and-misc.md`.**
- **Photo -> Etsy** (`photostudio.js`, `/api/photostudio`, `/photo`) — a separate
  track from POD, for things Sophie already MADE: one photo of the real product ->
  reviewable Etsy draft. Mockups use gpt-image-2 edits with `input_fidelity:high`
  so the ACTUAL product is preserved, not hallucinated.
  **Full details: `docs/modules/business.md`.**
- **Etsy** (`etsy.js`, `/api/etsy`) — Open API v3, the terminal step of the
  pipeline: generated design -> POD product -> **draft** listing Sophie reviews
  before publishing. Two auth tiers (app-level reads need keystring AND shared
  secret joined by a colon; writes need OAuth+PKCE, tokens persisted to
  Firestore so they survive redeploys). Title <=140 chars, <=13 tags of <=20.
  **Shop Report** at `/report` — numbers are free, the AI advice is opt-in via
  `?advice=1`, because opening a page must never spend money.
  **Full details: `docs/modules/business.md`.**
- **Shopify** (`shopify.js`, `/api/shopify`) — one Admin custom-app token for the
  newsletter audience and blog publishing. **NOT the storefront token.** Three
  auth modes; the client-credentials one silently returns an EMPTY-scope token for
  single-store apps, which is the trap to recognise — use the OAuth `/connect`
  flow instead. **Full details: `docs/modules/business.md`** (including the Dev
  Dashboard setup, which changes often — re-verify the UI before instructing).
- **Tarot email** (`tarot-email.js`, `/api/tarot-email`) — the kinetic daily
  spread as three face-down cards with pure-CSS tap-to-reveal (email clients strip
  JS). Apple Mail gets the real flips; Gmail/Outlook fall back gracefully. The
  spread is deterministic per day and MATCHES THE WEBSITE (a verbatim port of
  `witch.html`'s `dailyPull()` — keep the deck data in sync). Campaign sends stay
  in Brevo's dashboard. **Full details: `docs/modules/business.md`.**
- **Blog Studio** (`blog.js`, `/api/blog`, `/blog`) — topic -> long-tail keywords
  -> full SEO post -> image -> publish. **Primary destination is the on-site blog
  at secretlyawitch.com/blog**, so organic traffic builds the real domain;
  Shopify is secondary. Keywords AND draft both run on **Claude** (reader-facing
  words). **Full details: `docs/modules/business.md`.**
- **Sticker Day** (`public/selfcare.html`, `/selfcare`, **ungated/public**) —
  seven small acts of self care a day, each one a sticker: an un-earned task is a
  flat grey silhouette, tapping it peels the sticker on in colour and opens a mini
  lesson. State is `localStorage` only, which is why the page is ungated. Sticker
  art must be a transparent die-cut PNG (the silhouette is the same PNG,
  CSS-masked). Its third tab is the **Memory Passport** — four stamps a day, the
  scalloped edge drawn by the PAGE not the model, with a paid draw-your-own that
  spends real money on a public endpoint (rate-limited).
  **Full details: `docs/modules/apps.md`.**
- **Secretly a Witch** (`public/witch.html`, `/witch`, **ungated/public**, and
  `secretlyawitch.com`) — mobile-first single-page app, five tabs (Today,
  Miracles, Tarot, Conjure, More), its own dark mystical theme (NOT `forge.css`),
  a shop that sells in-app via the Storefront API, and the Book of Shadows.
  **Shipping it is all CI — no Mac**, including the App Store listing text: three
  workflows in `memory-library-react` (TestFlight, ASC edit metadata, ASC submit
  release). Run the metadata workflow with `dry_run` ON first. The two things that
  still need Sophie are the reviewer's rejection text and any Resolution Center
  reply — Apple exposes neither.
  **Writing a Witch School lesson? `docs/witch-school-lessons.md` FIRST.**
  **Full details: `docs/modules/apps.md`.**
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
  - **AN IDENTICAL copy can no longer duplicate — a RE-ENCODED one still can
    (Aug 2026, updated).** The hook auto-files every image sent with
    SendUserFile. **Byte-identical copies now collapse onto the labeled tile
    whatever they are called**, because the tab joins on the Storage object's
    md5 (see "dedupes by CONTENT HASH" above) — that is the fail-safe, and it
    needs nothing from you. **A CONVERTED copy is the case it cannot catch:**
    a webp→png re-encode for chat preview has NEW bytes AND a new random
    filename, so nothing on the record ties it to the original and it files as
    a fresh tile with NO label beside it. No hash can fix that one — different
    bytes are a different picture as far as any hash is concerned. Labeling
    only the storage URL is therefore still NOT enough. Avoid it: send the ORIGINAL file
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
  **THE HOLE EVERY CHAT FELL IN IS CLOSED — the server unions by CONTENT HASH
  now (Aug 2026; the hole was found on the hospital film).** Images you send as
  chat FILES are auto-filed by the hook as `claude-deliveries/<random>` copies
  with no label and no quality caption, and the filename union could never join
  them to your captioned tile — so Sophie saw her portraits twice. The Assets
  tab now joins on the Storage object's md5 as well (see "dedupes by CONTENT
  HASH" in the Chats section, and `asset-union.js`), so a byte-identical copy
  collapses onto the labeled tile **by itself, whatever it is called** — no
  sweep, no cleanup, nothing to remember. Two things that still hold:
  - **Old records need the backfill before their duplicates merge** —
    `node scripts/backfill-asset-hashes.js --dry-run` then without the flag.
    A record with no `md5` on file still falls back to its filename.
  - **A RE-ENCODED copy is not the same bytes**, so no hash joins it (see the
    LABEL rule above). That case is still yours to avoid.
  The sweep below remains for the things no hash can recover — labels, MODEL ·
  QUALITY captions and filed prompts.
  **THE SWEEP IS ONE COMMAND NOW —
  `node scripts/sweep-asset-captions.js --chat <your chat slug>` (Aug 2026).**
  It pages the whole Assets tab and names every image short of a label, a
  MODEL · QUALITY caption, a filed prompt, or sitting there as an unlabeled
  `claude-deliveries/*` stray. **A chat that delivered images runs it on
  ITSELF before finishing the turn** — that is the only moment the missing
  captions can still be filed honestly. Default sweeps recently active chats,
  `--active <days>` widens it, `--all` is every chat, `--json` for a reader.
  It is READ-ONLY and stays that way (a test pins it): a caption a later chat
  invents is worse than a blank one — see the measurement above.
  **It does NOT ask a photo out of one of her own SOURCE LIBRARIES for a
  prompt or a MODEL · QUALITY caption (Aug 2026)** — the Dump, the crystal
  photos, her Midjourney exports (`asset-guard.js`'s
  `SOURCE_LIBRARY_PREFIXES`, ONE copy read by the sweep and the guard). Nobody
  typed words to make a phone photo and no model drew it, so counting those
  sent chats hunting something that never existed. A missing **label** is
  still a finding for them — and a Dump photo now arrives with one by itself.
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
- **THE HAIRLINE ROWS' SLIDING LINE MEASURES ITS TAB — no row anywhere
  declares a tab count (Aug 2026, Sophie: "close it so it can't happen
  again").** The `.acctabs` pattern (two or three labels over a rule, the
  line sliding under the one she is reading) used to size the line as a
  PERCENTAGE of the row — a width per row class — and move it with a
  `translateX` step per slot. So the tab count lived in the CSS *and* in the
  markup, and the two drifted.
  - **How it drifted, because it was nobody's mistake and that is the
    point.** The Compare row was written against the two-tab rule on its own
    branch, correct as authored. A third tab (UPDATE) landed on main from
    another chat and made the shared rule 33.33%. The Compare branch merged
    **four minutes later** (`a576e08` → `38aa56e`, 2026-08-11): different
    lines, clean merge, no test failure — and the line sat a third wide under
    the middle of a two-tab row until she spotted it two days on ("the words
    in the middle and on the edge rather than under the line"). Measured at
    390px: SUPERSEDED's word at x=107 with the line at 195; CURRENT's at 283
    with the line at 312.
  - **So the count now lives nowhere.** `tabLine()` reads the `.acctab.on`
    element's real rect and writes `--tw` / `--tx`. Add a tab, remove one,
    change a padding: the line is still under the word, because it asked.
    It also retires the traps that rode with the percentage — the pill's 56px
    reserve (an abspos child resolves percentages against the PADDING box, so
    a row near the top needed `calc((100% - 56px)/N)`), and a tab made wider
    than its neighbours by a two-digit badge, which no percentage could ever
    follow. The reserve is still needed for the TAPS, just not for the line.
  - **Three things about it are load-bearing.** An unmeasured row draws NO
    line (`var(--tw,0)`) rather than a guessed one. The slide is switched on
    a frame AFTER a row's first measurement (`.tl`), so a screen opens with
    the line already in place and only a tap animates it. And the repaint
    must never write the style attribute unconditionally — the observer that
    drives it watches `style`, so an unguarded write is an rAF loop forever.
  - **A resize snaps and measures a FRAME LATER.** `resize` fires before the
    new layout is committed: measured 2026-08-13, a tab read inside the
    handler still reports its old width and the line lands one viewport
    behind (at 390 it kept 375's 140.75px). Anything asserting on the line
    after a resize has to settle a frame first — that is a real property of
    the mechanism, not a flaky test.
  - **Ported to every page that uses the `.acctabs` idiom**: chats.html (all
    five rows), voice.html (SPEAK · CHANGE), cuttingroom.html (TRANSCRIPT ·
    CLIPS, whose line is a real `.tline` span rather than an `::after`).
    **NOT ported, deliberately:** the witch app's `.ps-tabs` (its own visual
    system, one row in one file, and its count sits beside its markup rather
    than in a class shared across rows) and `chapters.js` (which already
    switches to a `/4` rule when a copy level exists). Both are fine; neither
    can drift the way a shared rule did.
  - Tests: `node scripts/test-chats-tab-lines.js` drives all five chats rows
    at 375/390/430 and asserts the line's real rect against the lit tab's,
    plus the no-line default and the no-loop guard. Verified failing when one
    row is put back on a fixed percentage (it reported the line 56–64px wide
    of the tab and 225px adrift). `test-voice-changer` and
    `test-cutroom-handoff` cover the other two pages.
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

- **YouTube auto-upload** — finished videos post to her business channel as
  **private drafts** for her to publish by hand; nothing goes public
  automatically. `scripts/youtube_upload.py` (stdlib only), auth via a durable
  refresh token, upload-only scope. **Full details: `docs/modules/audio-and-film.md`.**
- **NDE movies — the watercolour look.** Making art for the montages? Read
  `docs/nde-watercolor.md` FIRST; the headline rule is counter-intuitive — write
  NO style description at all, just attach `refs/sage-sandy-mirror.png` as a pure
  style reference (gpt-image-2 edits, quality medium, 1024x1536). The nine
  experiencer character cards are BUILT and public — do not re-derive them.
  **Only nine people have an approved likeness: never invent a face for a real
  person.** **Full details: `docs/modules/nde.md`.**
- **Anthony Chene NDE moments database** (`nde.js`, `/api/nde`) — reads his
  near-death-experience interviews and extracts illustratable moments unique to
  each experiencer. **Adding videos runs on SOPHIE'S Mac** — YouTube bot-blocks
  datacenter IPs, so a cloud session can never download a new interview. Her one
  command is `cd ~/imageforge && git checkout main && git pull origin main &&
  ./scripts/grab` (the `git checkout main` is load-bearing, not boilerplate).
  `./scripts/clip` pulls short video clips instead.
  **Her home uplink stalls on any single upload over ~1MB**, so every Storage
  upload from her Mac must be chunked via `blob.open("wb", chunk_size=…)` — NOT
  `upload_from_string` with `chunk_size` set on the blob, which looks equivalent
  and silently still sends one request. When `git push` stalls on her Mac, hand
  the commit to a cloud chat rather than fighting the network.
  **Full details: `docs/modules/nde.md`.**
- **Episode Editor** (`editor.js`, `/api/editor`, `/editor`, iOS tile) — she picks
  spans of a real interview transcript as snippet cards, arranges them with
  narration and gap cards, taps Render, gets finished audio. **It owns THE cutter**
  (a faithful port of `scripts/nde-supercut-precise.py`: `phraseSpan` ->
  `clampBounds` -> silence snapping -> micro-fades) — every other tool imports it
  rather than hand-rolling one. Every cut is banked in a permanent clip cache, so
  a clip is cut once ever; bump `CUT_VERSION` when the cutting logic changes.
  Editing during a render is safe. **Full details: `docs/modules/audio-and-film.md`,
  and `docs/nde-precise-cutting.md` for the cutting pipeline itself.**
- **Cutting Room** (`cuttingroom.js`, `/api/cutroom`, `/cuttingroom`, iOS tile) —
  she opens one of her OWN recordings, marks it **on its transcript** (never a
  waveform), cuts pauses out, slices sections off to save or send on. Designed
  around her wrist: everything is a tap, nothing drags or scrubs. **Every real cut
  re-listens first** — the stored bulk-pass words are chips-only accuracy. **Her
  voice is never loudnormed.** A finished Episode Editor render comes here (the
  scissors on each render row) to have its pauses and filler taken out — that is
  deliberately NOT done inside a render, because removing an "um" from the middle
  of a clip is a splice and a splice gets approved by ear.
  **Full details: `docs/modules/audio-and-film.md`.**
- **Search** (`search.js`, `/api/search`, `/search`, iOS tile) — one search across
  BOTH transcript libraries (77 interviews + 1,000+ voice memos). Results are
  PASSAGES with audio, and the hand-offs are the point (interview -> Episode
  Editor, memo -> Cutting Room). Two modes: WORDS (keyword, free) and MEANING
  (int8 embeddings, ~$0.05 to embed the library). **Re-index after ingesting new
  videos or memos, then re-embed** — vectors are keyed to the index build and go
  stale. **Full details: `docs/modules/audio-and-film.md`.**
- **Cut Marks** (`cutmarks.js`, `/api/cutmarks`, `/cutmarks`, iOS tile) — the
  manual sibling of the Cutting Room: no transcript, no waveform. She plays the
  file, taps the scissors at the spot, the marks split it into pieces she keeps or
  drops, render bakes one new file. Audio or video. Renders never overwrite.
  **Full details: `docs/modules/audio-and-film.md`.**
- **Getting original art OUT of a Google Drawing** — for a lot of her old scanned
  artwork the embedded copy is the only one left, and **the SVG export is the only
  way out at full size**. `python3 scripts/gdrawing-extract.py <url-or-id>` does
  the whole job. Don't reach for the Drive API export (~10MB cap); it needs link
  sharing turned on. Anything sitting exactly on 2500px hit Google's upload resize
  ceiling. **Full details: `docs/modules/inbox-and-misc.md`.**
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

- **The pad IS the Story Room now (Aug 2026)** — `/storyroom` serves the pad page
  and the app's Story Room tile opens it. The OLD board surface (`storyroom.html`,
  `/api/story/*`) stays in the repo, unpointed. Stories can carry **listen rows**
  linking to Episode Editor episodes, resolved to their newest render live.
  **Full details: `docs/modules/story.md`.**
- **Scratch Pad / Story Room** (`scratchpad.js`, `/api/scratchpad`, page built by
  `scripts/gen-scratchpad.py`) — thinking with pictures. Hearted Playground images
  are its inbox (read live — nothing is copied). Beats sit four to a row,
  incomplete rows centered; tapping one opens a cream CARD popup with the art at
  thumbnail size, five bare colour chips, and a text box. Her OWN recording always
  wins over TTS, and **every take is kept**. Chunks link contiguous beats into one
  tile. The film stitches every beat with art, each held for its own audio's
  length — per-unit audio is PCM, never aac, or the voice walks out from under the
  pictures. **PHILOSOPHY — do not "improve" this: the pad is minimal, the frame
  colours are deliberately UNLABELLED, and no machinery lives on the canvas.**
  `ART.prefix`/`ART.characterLine` are COPIES of `PL_GPT.*` in server.js — keep
  them identical. **Full details: `docs/modules/story.md`.**
- **Story Room data** (`forge-story` in membry, `/api/story/*`) — one doc per
  story; **every content field is optional**, any one of them starts a project.
  Films live ON their story. Voiceover comes in by PASTE (from iOS Voice Memos) or
  file — there is deliberately no record button. The approve/candidate step is
  **PARKED** by request: the data model keeps `status`, but nothing user-facing may
  show approval state. **Making art for the "Evan" story? `docs/evan-film-style.md`
  FIRST** — write NO style description at all.
  **Full details: `docs/modules/story.md`.**
