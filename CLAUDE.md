# ImageForge — project notes

## THE CHECKLIST — the rules that actually get skipped

Everything below is written out properly further down; this is the short list,
at the top, because being on line 1,400 of a long file is why these got missed.
The numbers are measured, not guessed.

**Ending a turn that changed anything**
1. **Refresh your STATUS CARD** — `POST /api/chatfeed/status {chat, session,
   need, doing}`. Telegraphic fragments, ~30-60 chars, the way she writes her
   own notes. `need` = what you need from her AND how big the ask is; send `""`
   when nothing is needed.
2. **Write your UPDATE CARD** — `POST /api/chatfeed/update {chat, session,
   asked, did, next}`. *Measured: only 15 of 224 chats had ever posted one.*
3. **Spent real money this turn? Say how much.** ONLY then — a reply that
   reports "$0" or "nothing spent" is noise she has to read (Sophie,
   2026-08-15: "they should just tell me if they DID spend something").
3a. **PIN THE LINK — but ONLY in her two cases** (`POST /api/chatfeed/pin
   {chat, session, url, title}`): a page you are **actively working on**
   (`/science`, `/chunking`), or a deliverable you are **actively handing her
   new versions of** (a film, an episode). In those two, pinning is the
   default and you re-post it every time you update what's behind it — that is
   what lights the *current* tag. **Everything else stays out of that row**:
   most chats should have NO pin. A third case is not yours to declare — run
   it by Sophie first. (Full rules: *THE PINNED LINK* in the Chats app
   section.)

**When the work WRAPS UP (not every turn)**
3b. **Leave a WRAP-UP** — `POST /api/chatfeed/wrapup {chat, session, line,
   text}`. `line` = the one line her archive row shows (≤200); `text` = the
   full what-this-was (≤2000). This is what she reads months later to remember
   what a chat was, so it earns more care than the status card. *Measured
   2026-08-14: 73 of her 88 archived chats showed nothing but a name.* You
   cannot be asked for it later — you are asleep by the time she archives.

**Delivering an image — every single one, including a test**
4. **Label it.** `[Penny — the blue Kleenex](url)`, never `[p01](url)` or a bare
   URL. The label becomes what she reviews by.
5. **File the MODEL · QUALITY caption** — `prompt:"gpt-image-2 · medium"`.
   *Measured: 1,938 of 2,488 images have none, and only 31 could ever be
   recovered.* **No later chat can backfill this** — you are the only one who
   knows. Say the quality as a word in the reply too, not "the default".
6. **Post the EXACT prompt**, split style / content — never a paraphrase. No
   exact text on hand? File nothing.
7. **If you added ANYTHING to a prompt she gave you, say so, word for word.**
8. Run `node scripts/sweep-asset-captions.js --chat <your slug>` before you
   finish. It is read-only and it names what you missed.
   → the `deliver-images` skill walks the whole ritual.

**When she messages you** — check what is waiting, in one sweep: asset ♥/✕ and
notes (`GET /api/gallery/assets/notes?chat=`), Writing Room notes, the running
to-do list. Act on them, then answer on the image itself. **Never on a timer.**

**While you work**
- **Never block the turn on a wait** — background it, or her next message is
  silently swallowed.
- **She is almost never at her desktop.** Anything that can only run on her Mac
  gets APPENDED to `docs/desktop-tasks.md` (the one queue, every repo) and
  mentioned in one line — never asked for. Urgent is the only interrupt.
- **Nothing may live only in the scratchpad.** Commit and push as you go.
- **Estimate the cost before a paid batch, and ASK above $3.**
- **Merge your own PRs** when CI is green — don't park them as drafts.
- **Measure, never reason, about other sessions or the environment.**

**Writing the reply** — **SHORT BY DEFAULT** (a few short paragraphs; only
what changes what she does next — detail goes behind "want the long version?"
or into the PR description) · TLDR first · answer her questions before
anything else, **each answered ONCE — never echo the question back and answer
it a second time** (see *Answering a question*) · small question, short
answer · full clickable links · no markdown tables · times in 12-hour
Pacific · files and images LAST · working links at the very bottom.

## Where everything is

- **This file** = the rules that apply no matter what you are building, plus the
  Chats app (which every chat posts into) and the house design rules.
- **`docs/modules/*.md`** = one reference per domain — see *The other modules —
  the map* near the bottom. Open the one you are working in.
- **`docs/chats-app.md`** = how the Chats app itself is built.
- **`docs/compare-pages.md`** = the full contract for any page you post into the
  app (Compare, judge, cut picker).
- **`docs/design-rules.md`** = the deep half of the design rules — headers, the
  webp rule, icon sizing, the hairline tab rows, the home filter row.
- **`.claude/skills/`** = the rituals: `deliver-images`, `new-tool`, `new-page`,
  `new-module`, `sophie-audio`, `witch-copy`. They load themselves when relevant;
  read the matching one BEFORE starting that kind of work.
- **The pipeline maps** — the road a piece of work actually walks, one doc plus
  one Compare page each, all three drawn as the same blush S-curve:
  `docs/audio-pipeline.md` (subtractive — the recording already holds
  everything) and `docs/image-pipeline.md` (**the prompt is the treasure, the
  image is a throwaway probe** — read it before building any picture surface).
  Each doc also names that pipeline's three structural holes.
- Deep dives that already had their own doc: `docs/nde-precise-cutting.md`,
  `docs/witch-school-lessons.md`, `docs/vector-pipeline.md`,
  `docs/evan-film-style.md`, `docs/nde-watercolor.md`,
  `docs/dating-book/THE-SOPHIE-EXPERIMENT.md`.

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

## SHE IS ALMOST NEVER AT HER DESKTOP — batch desktop tasks, never ask
**Sophie works from her phone (Aug 2026, her rule: "I'm almost never on my
computer… anytime someone has a desktop task they should just batch it").** So
a task that can only run on her Mac must NOT turn into "can you go to your
computer and…" — that is a request to change where she is, and it lands weeks
late or never.
- **Write it into `docs/desktop-tasks.md` instead.** That is THE list, one for
  every chat in every repo, and it lives in her Mac checkout (`~/imageforge`) so
  the machine that has to run it already has it. The file carries the entry
  template, the rules for adding one, and the protocol the terminal chat
  follows; append to **OPEN** at the bottom, exact copy-pasteable commands, no
  secrets (public repo), commit and push the same turn.
- **Say one line in your reply** that you queued it and what it is. She should
  know the pile grew without having to ask, and without it becoming an ask.
- **Then keep going.** A queued desktop task never blocks the rest of the turn —
  do everything that doesn't depend on it and hand the turn back.
- **When she IS at the computer** she says "open `docs/desktop-tasks.md` and run
  the queue" and the terminal chat works it top to bottom, moving each finished
  block to DONE with the date.
- **URGENT is the only interrupt** — she is blocked without it, or it expires.
  Say so plainly in the reply AND queue it anyway, so it survives her not being
  near the computer. "It would be faster" is not urgent.
- **What counts as desktop-only:** YouTube downloads (datacenter IPs are
  bot-blocked — `docs/modules/nde.md`), anything needing her logged-in browser,
  keychain or Photos library, a plugged-in device, local files that live only on
  the Mac, and big uploads that must be chunked on her home connection. Anything
  a cloud session can do, a cloud session does — never queue work here to avoid
  doing it.

## Claims about OTHER sessions or the environment: MEASURE, never reason
**A SECOND CASE, and the same shape (2026-08-14): "a repo-committed hook never
loads (verified live 2026-07-15)".** That sentence sat in
`scripts/build-chats-setup.py` for a year and was true of ONE layout — sessions
starting at `/home/user`, the folder holding the repos, where
`/home/user/.claude/settings.json` really is the project settings file. But a
web session on a SINGLE repo starts INSIDE it (`/home/user/<repo>`), one level
down, where that file registers nothing. Found live: **memory-library-react had
never posted a single turn, ever** — not intermittent, total — and the quoted
sentence is why nobody looked there. **A dated measurement can go stale when the
environment changes underneath it; re-measure before trusting one to rule
something out.** Both repos now also commit their own `.claude/settings.json`
registering the hook (imageforge #1069, memory-library-react #316), and
belt-and-braces is right: double registration is harmless because the server
upserts on `sha1(session|turn)`. **Any new repo whose sessions start inside it
needs its own copy, and the failure is SILENT.** Two related facts measured the
same day, neither a bug: `$HOME` is `/root`, so the hook's `forge-*` ledgers land
in `/root/.claude` while the setup script provisions `/home/user/.claude` (self-
consistent — the hook reads and writes the same `$HOME`, and losing the ledger
re-baselines rather than floods); and `/home/user/.claude/skills` is a symlink
into the imageforge checkout, so it dangles in any layout that puts imageforge
somewhere else.

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
- **Hover** (DNS for BOTH her domains — NOT Shopify, NOT Render):
  - secretlyawitch.com: https://www.hover.com/domain/secretlyawitch.com
  - youwereinmydreams.com: https://www.hover.com/domain/youwereinmydreams.com
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
  - **youwereinmydreams.com → the dream feed (bought Aug 2026, Hover).** The
    front door is `dream-host.js`, mounted above `express.static` in
    `server.js`: on that host `/` IS the dream app (`public/dreamapp.html`),
    `/dreamfeed` 301s to `/`, `robots.txt` keeps the API and the studio out,
    and a studio page typed on that host 301s to the feed. Every other host
    is untouched — `/dreamfeed` still serves the page on onrender. **The
    domain needs three flips, all doable from her phone:** Render → the
    service's Settings → Custom Domains → add the apex and www; Hover → DNS →
    `A @ 216.24.57.1` and `CNAME www imageforge-q125.onrender.com` (Hover has
    no ALIAS, so the apex is an A record; leave the MX records alone or her
    email stops); Firebase → membry-df528 → Authentication → Settings →
    Authorized domains → add both hostnames, or Google sign-in fails on the
    new domain with nothing in the UI to explain it. Test:
    `node scripts/test-dream-host.js`.
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
- **BUILD PIPELINE MINUTES CAN RUN OUT AND SILENTLY STOP EVERY DEPLOY
  (measured 2026-08-19).** ~10 straight deploys failed overnight; the real row
  said "Build canceled: your workspace has run out of build pipeline minutes
  for the current billing period." The service keeps serving its LAST
  successful build while main keeps merging, so **a merged PR is NOT live
  until you verify the change on the live page** — a watcher that greps the
  served page for a new marker is the honest check. Every merge burns build
  minutes, and many chats merging all day burns the month's budget. The fix
  is Sophie's, one screen: Render dashboard → Workspace Settings → Build
  Pipeline → **Set spend limit** (raise it; needs a payment method) —
  pipeline tasks re-enable immediately and the next deploy ships everything
  merged in the gap. Without that, every deploy waits for the billing-period
  reset. Do NOT keep pushing retrigger commits at this error — the build is
  canceled before it starts, whatever the code says.
  **A DOCS-ONLY MERGE IS FREE — put `[skip render]` in the squash-merge
  commit TITLE (Sophie's call, 2026-08-19).** Render skips the deploy
  entirely when the pushed head commit's message carries that marker, and a
  skipped deploy burns ZERO build minutes. Nothing under `docs/` is served,
  so a docs-only diff never needs a deploy, and the next real merge carries
  the docs out anyway. Measured: 88 of 604 pushes in two weeks (~15%) were
  docs-only. Use it ONLY when the WHOLE diff is docs/ — a mixed merge must
  build. (Starter build minutes are $5/1,000 past the included 500; the $25
  Performance tier is 16-CPU build hardware for giant compile jobs — this
  repo's build is a small npm install, so it would cost 5× for nothing.
  Don't suggest it.)
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
    **DO NOT trust `asset-cleanup` to be scoped by `chat` — measured
    2026-08-15 it is not.** Called `{chat:"image-pipeline-design", dry:true}`
    against a tab holding **22** images it answered `wouldDelete: 23`, i.e.
    more records than that chat has. Running it without `dry` on the strength
    of "it's chat-scoped" would have deleted other chats' tiles. **Always run
    it dry and check the number against the chat's real `total`
    (`GET /api/gallery/assets?chat=`) before running it for real** — and if
    the two don't line up, label the stray instead and leave it. A duplicate
    tile beside a labeled one is a much smaller problem than a wrong delete.
    Also measured the same day: a stray that shares a url with an
    already-labeled record can survive re-POSTing the label (the write
    answers `ok:true, deduped:true` and lands on the labeled doc every time,
    never the other one), so the tab keeps one nameless twin. Known, not
    worth chasing.
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

## The Chat app (forge-chat-feed) — every chat posts its replies
- `chatfeed.js` (`/api/chatfeed`, page at `/chats`, iOS tile "Chats") — one
  feed of every project chat's replies so Sophie can read/listen in one place
  (picture icon per chat, tap-to-expand, ▶ Play renders the neural voice on
  tap (cached), orange "Open" button deep-links back to the Claude session,
  List/Tiles view toggle, newest message at the top, reply box).
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
- **Sophie can reply in the app** (`POST /reply`, shows as `from:"sophie"`) — a
  chat picks up replies addressed to its chat name the next time Sophie messages
  it (`GET /api/chatfeed?limit=50`), then acts on them. **NOT on a timer.**
- **THE WAKE DOORBELL (Aug 2026) — the app is not read-only anymore.** Each
  thread has a composer; Send posts her message to the feed AND rings
  `POST /api/chatfeed/wake`, which fires the account's SWITCHBOARD chat over
  the public Routines API; the switchboard then wakes the target chat, which
  sweeps its feed replies and answers. Full design + the measured findings
  that shaped it: `docs/chats-wake-doorbell.md`. What EVERY chat must do:
  - **Register yourself wakeable, once per session** (no token, no Sophie
    step): create a no-schedule self-bound trigger with your own tools —
    `create_trigger { name: "wake: <your slug>", prompt: "<wake prompt
    below>" }` (omit cron/run_once — a poke-only routine), then
    `POST /api/chatfeed/wake-register { chat, session, triggerId, account }`
    (`session` = your `CLAUDE_CODE_REMOTE_SESSION_ID` without `cse_`;
    `account` = your `FORGE_ACCOUNT`). Write the trigger's prompt for a wake:
    "Sophie pinged this chat from the Chats app — sweep your feed replies,
    asset notes/votes and the to-do list, act, and answer."
  - **NEVER attach `text` to a wake fire** — a fire with text spawns a stray
    NEW chat; only a contentless fire re-enters the bound session (measured
    2026-07-31). The message always rides the feed, never the ping.
  - **Waking a sibling chat yourself** (fan-out, e.g. the morning-ideas
    flow): look it up in `GET /api/chatfeed/wake-registry`, post the task as
    a feed reply addressed to it, then `fire_trigger` its `triggerId` with NO
    text (same account only). If it shows in ListAgents it's awake —
    SendMessage it instead.
  - **The account-2 switchboard is the chats-app-messaging chat** (trigger
    `trig_01JWxYFQzEJVRxToP6EdDbmR`, token in Render env
    `WAKE_FIRE_TOKEN_2`). Its duties on a wake ping: `GET
    /api/chatfeed/wake-queue?account=2` → deliver each entry (SendMessage if
    the target is listed awake, else `fire_trigger` its trigger, no text; an
    entry naming ITSELF = just answer Sophie's message, never self-fire) →
    `POST /wake-done {chat}` each. Don't message Sophie about routine
    dispatches. Maintenance: its routine carries a placeholder
    `run_once_at` 2027-06-01 (kept so the routines UI shows it); when it
    fires, the routine self-disables — re-arm with `update_trigger`
    (new far-future `run_once_at`, `enabled:true`) or account-2 wakes die.
  - **Account 1 has no switchboard yet** — building it = any account-1 chat
    repeats the register step, Sophie mints its API token in THAT account's
    routines UI, and `WAKE_TRIGGER_1` + `WAKE_FIRE_TOKEN_1` land in Render
    env.
- **THE ARCHIVE WRAP-UP — what the chat was about and what went down (Aug
  2026, Sophie: "whenever I'm about to archive a chat the last message of the
  chat is them explaining what the chat was about … and that could go into the
  note at the top").** Measured that day: **73 of her 88 archived chats showed
  nothing but a name.**
  - **A chat is ASLEEP by the time she archives it**, so it cannot summarise
    itself then — the whole design follows from that. Written ahead, frozen on
    the way past. Best source first: the chat's own `POST /wrapup`; failing
    that, archiving freezes its **Update card** into one (free, instant —
    `updAsked`/`updDid` already answer the same question); failing both it
    stays blank rather than inventing something.
  - **THE SUMMARIZE BUTTON on the archive pop-up (Aug 2026, Sophie: "I want a
    button on there that automatically asks the chat to give me like a quick
    summary of what we accomplished in that chat, and if there were still any
    questions that were open").** It cannot literally ask the chat — that is
    the asleep problem above — so the SERVER reads the thread the app already
    stores and writes the summary itself (`POST /wrapup/write`, Claude,
    `force:true` because a deliberate tap re-writes). From her side the
    difference is invisible: one tap inside the sheet, no trip back to the
    Claude app, nothing to copy. It **writes as soon as it answers**, so
    Cancel keeps the summary and archiving mid-write loses nothing — which is
    why it is not a background job. The summary reads back in the sheet before
    she commits. ~1-2¢ a tap.
  - **THREE fields, and NONE is `sophieNote`** (`wrapLine` + `wrapUp` +
    `wrapOpen` on the registry). Her own note still wins the row — a chat must
    never overwrite a line she wrote, which is why this did not reuse her note
    field even though she described it as "the note at the top". Row:
    `note || wrapLine || need || doing`. **`wrapOpen` is what was still
    unfinished or unanswered** — its own paragraph behind the expander, never
    the row line. The unanswered questions fed to the model are DERIVED
    (`buildQuestions` over the whole thread, `!q.answer`), not read out of the
    digest, so the line names loose ends that provably exist; a chat writing
    its own wrap-up can pass `open` too.
  - **A freshly written wrap-up reaches an already-open phone on its next
    Refresh**, not instantly: the page paints from its localStorage cache and
    polls only for new MESSAGES (the launch block in `chats.html`). True of
    every registry field, not just this one.
  - **There is NO rule that only she may write her note** — `POST /chatnote`
    has never had a permission check. It was only ever a style guideline
    (her length, her shape). Don't reintroduce one.
  - The expander is a **sibling** of the row, not a child: a row is a
    `<button>`, so a nested button is invalid and the tap would bubble into
    opening the chat.
  - **The sheet the button lives on asks for TAGS, not piles (Aug 2026 v3,
    Sophie).** "Archive this chat?" is the header at the top; the name box is
    GONE ("the chat name can only be changed from within the chat, not this
    archive option"); and a star + bookmark toggle sit left of a row of tag
    chips, all of which save on the tap rather than on Archive. The tags are a
    FIXED vocabulary kept in two places — `TAGS` in `chatfeed.js` and
    `TAG_LIST` in `chats.html`, pinned equal by a test — and they become the
    archive's filter row. Full rules in `docs/chats-app.md`.
  - **THREE LENGTHS OF THE SAME STORY (Aug 2026 v2, Sophie: "ideally would be a
    short summary like three lines at most, and then a longer summary behind an
    arrow").** `wrapLine` is the one line on the archive row, `wrapUp` is THREE
    SENTENCES behind the ⌄, and `wrapLong` is the full account behind a `more`
    inside that. Each is written to stand alone — not an intro, a middle and an
    end — because she stops at whichever depth answers her. A chat too small to
    justify a long version leaves `wrapLong` empty and shows no `more`. The
    fields are asked for shortest-first ON PURPOSE: a truncated answer loses the
    LAST field, so the summary she actually reads is the one least at risk.
    The SHORT one is capped in CHARACTERS (under 180 = three lines on her
    phone), not in sentences — the first cut asked for three sentences and came
    back at 374 characters, seven lines in the expander.
  - **THE LONG ONE IS BULLETS (Aug 2026, Sophie: "I would like bullet points
    especially for the long summary — don't add bullet points where it doesn't
    actually help, but the long summary is one block of text would be great to
    see them separated").** The model returns `long` as an ARRAY of points and
    the route stores it newline-joined, so `wrapLong` stays a plain string and
    the one paragraph written before this still reads. **The array is what makes
    the split reliable** — re-splitting a paragraph on punctuation breaks on
    every abbreviation and file name. `fillWrap()` in `chats.html` draws it,
    ONE renderer for both the archive row's expander and the sheet's read-back:
    more than one line → one `.wrapbul` per line with a CSS `•` and a hanging
    indent; a single line → a plain paragraph, because the short summary is
    always one and a lone bullet in front of one sentence is decoration. The
    prompt says **SPLIT ONLY WHERE THE WORK ACTUALLY SPLIT**, so a chat that did
    one continuous thing gets one or two points rather than a chopped-up list.
  - **A truncated answer is RESCUED, not thrown away (found live 2026-08-15 in
    her hands).** `max_tokens` cut the JSON mid-string and an unclosed brace
    fails both of `parseJSON`'s attempts, so a finished summary line died with
    the unfinished sentence after it. The cap is 1500 now and `salvageJson` in
    `chatfeed.js` closes what the model left open, then trims back to the last
    finished sentence — and, in the bulleted long half, drops the point that
    stopped mid-word while keeping the ones that finished. It is deliberately NOT in `anthropic.js`: half an object
    is exactly what other callers must never be handed silently.
  - Tests: `node scripts/test-chats-wrapup.js` (the freeze rule, the row line,
    the open half, the truncation rescue), `node
    scripts/test-chats-archive-summary.js` (the button) and `node
    scripts/test-chats-archive-tags.js` (the tags, the vocabulary and the
    filter row) — the last two headless against the real page.
- **THE PINNED LINK — if your work lives at a URL, PIN IT (Aug 2026, Sophie:
  "I'm constantly referring to a link to a page… I just wanna make that
  pattern more clear that chats have that option and make it the expected and
  common behavior for chats if a link is involved").** A pinned link sits
  directly under the chat's name, above the messages: one row, the title she
  gave it, one tap. Everything else about a link — where it was mentioned,
  which turn it was in — makes her hunt for it in the scrollback.
  `POST /api/chatfeed/pin { chat, session, url, title, kind? }`.
  - **TWO CASES EARN A PIN, AND ONLY THOSE TWO** (Sophie, same day, after the
    first version of this rule read as "pin whenever a link is involved" and
    chats started pinning anything with a URL: "not every chat deserves one,
    only the two cases I mentioned"). **Most chats should have NO pin** — an
    empty row is the correct, common state, and a pin she does not come back
    to is clutter at the top of a thread she reads every day.
    - **a page this chat is ACTIVELY WORKING ON** — `/science`, `/chunking`, a
      tool page. Pin it the first turn it exists. The
      test is active work, not "a link exists": a page you finished and will
      not touch again does not need the row.
    - **a deliverable you are ACTIVELY HANDING HER NEW VERSIONS OF** — a film,
      an episode, an audio cut. Pin the NEWEST render; the title carries the
      version ("Evan — the long cut v6 (4:54)"). A one-off render you will
      never re-cut is not this.
  - **A COMPARE PAGE IS ALREADY IN THE TAB — NEVER ALSO PIN IT AS A LINK (Aug
    2026, Sophie: "if there's a compare page for the exact same thing … it
    shouldn't be also pinned as a link").** Anything posted with
    `POST /api/chatfeed/page` sits in the chat's **Compare tab**, one tap from
    the same header, so pinning its URL puts the identical thing on screen
    twice and spends the one pin row on something she can already reach. This
    is a carve-out of case 1, not an exception to it: a page you are actively
    working on still earns the row — unless the page IS the Compare page, in
    which case the tab is the row. (This line used to name "a Compare page's
    URL" as a thing to pin, which is how it happened.) Same for the judge and
    cut-picker pages: all three land in that tab. A page you host yourself
    (`/science`, a tool page) is NOT in the tab and still pins normally.
  - **NEVER PIN, without asking:** a PR or a GitHub file/doc link, a dashboard,
    a page you merely referenced, the Chats app itself, a page whose work is
    done, your own chat's admin links, or **anything already sitting in one of
    this chat's own tabs** (a Compare page, an Assets image). **A THIRD CASE
    IS NOT YOURS TO DECLARE** (Sophie: "there might be other cases, but I'd
    like them to be run by me before they're made official") — describe the
    case in your reply and let her say yes; do not pin it and see if she
    objects.
  - **RE-POST IT EVERY TIME YOU UPDATE WHAT'S BEHIND IT.** Same url is fine —
    the re-post is the update, and it is what lights the **current** tag on
    the row (Sophie: "a tag on it that says like current or recent, and it
    only says that if the chat updated the last turn that they finished"). The
    server counts the finished replies since the pin; *current* shows while
    that count is 0 or 1 — the turn that pinned it, and that turn once it has
    ended — and goes out the moment the chat finishes a turn that left the
    link alone. So a lit tag means *what's behind this moved in the last thing
    this chat did*, and nothing else. Nothing decays it on a timer.
  - **ONE pin per chat** — pinning again replaces it. Pin the thing she comes
    back to; when a chat has both a page and a film, the page usually wins
    (the film's newest cut can live on the page). Clear it with `url:""`.
  - `kind` is optional now: a url ending in `.mp4`/`.mov`/`.webm` pins as a
    film (tap = full-screen player), `.m4a`/`.mp3`/`.wav` as audio, anything
    else as a **link** that opens the page. Pass `kind` explicitly when the
    url has no extension to read (a signed media url with no filename).
  - **Read back what you have pinned** with `GET /api/chatfeed/status?chat=&
    session=` → `pinned:{url,title,kind,at,turns}`. `turns` ≤ 1 means the tag
    is still lit.
  - Tests: `node scripts/test-pin-current.js` (the kind + tag rules, pure) and
    `node scripts/test-chats-pin.js` (the real page, headless).
- **A SECOND, UNRELATED PIN — the PUSHPIN keeps a CHAT at the top of her list
  (Aug 2026, Sophie: "an option to pin chat to the top so they always show
  first when they come out of hiding and they never disappeared to the bottom
  if I don't look at them for a while").** Nothing to do with the pinned link
  above, and **not yours to set** — it is hers, tapped on the pushpin on the
  chat's row on the `/chats` HOME screen (it shipped in the thread header and
  she moved it: "I was assuming it would go right on the main page not inside
  of it"). Her override on the recency sort: a pinned chat leads every pile,
  and pinned chats keep their own recency order among themselves.
  - **The names are separate ON PURPOSE and must stay that way:** `pinTop` +
    `POST /api/chatfeed/pin-top` for this, `pinned` + `POST /pin` for the
    deliverable link (which stores an OBJECT under `pinned`). Express matches
    the first route, so a route named `pin` shadows the other one.
  - The whole sort is ONE tier in `sortedChatNames` (chats.html), which every
    list comes through — so the hidden pile, the archive, the ★ chip and the
    account tabs all obey it without knowing about it.
  - **The glyph is a PUSHPIN — round head, straight spike — never the Maps
    teardrop.** It shipped as a `map-pin` and she corrected it ("the pin
    that's like round with a metal thing sticking down from it — that's a
    different one that you made"). Don't drift it back.
  - Test: `node scripts/test-chats-pin-top.js`.
- **ORGANIZE — a chat can be filed and tagged from INSIDE it (Aug 2026,
  Sophie: "an ability to tag or categorize something from within the chat
  itself … an icon that says organize and then it pulls up the ability to tag
  and categorize which is already on the front page but so far it doesn't work
  within there").** The tag icon in a thread's header opens a sheet of her own
  words — one row of chips, several lit at once — which shipped as her FOLDERS
  (one per chat) over a fixed TAG vocabulary (many); both already existed and
  neither was reachable from a thread.
  Everything saves on the tap. **Filing is still HERS, not yours** — the
  server files chats by itself (`chat-sort.js`); do not POST a category.
  **CATEGORIES AND TAGS ARE ONE FIELD SINCE AUG 2026** (Sophie: "you can only
  be in one category at a time … combine them and let you be in multiple
  categories or tags at once") — `labels`, an array, many per chat, her own
  words, one row of chips in the sheet. `POST /api/chatfeed/labels
  {chat|chats, labels?|add?|remove?}` is the write; `category` and `tags` are
  still MIRRORED on every write (first label / whole set) for the cached page
  on her phone and for every reader that was never touched, so don't drop
  them. **A LABEL IS A PILE OR JUST A WORD (Aug 2026 v2, Sophie: "tagging
  shouldn't hide everything … whereas other ones shouldn't take it off the main
  feed")** — only a PILE word takes a chat off the unfiled home list, seeded
  from her folder vocabulary frozen the day the fields merged (`PILE_SEEDS`)
  and switched per word in the Organize sheet (`POST /pile`). **And `to be
  reviewed` also puts the chat in the Review Queue** at `/review`. **And
  `waiting for something` OPENS A BOX** asking what it is waiting for; her
  answer lives in its own field (`waitingFor`, never `sophieNote`), shows as a
  bold **Waiting for:** line on the chat's row and above her note in the
  thread, and is DELETED the moment the tag comes off — a second asking word is
  not yours to declare. Full rules in `docs/chats-app.md`; tests `node
  scripts/test-chats-labels.js` and the same file as the tags above.
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
- **ANSWERING A QUESTION — answer it ONCE, at the top, plainly. Do NOT echo
  the question back in bold.** For one day (2026-08-14→15) this file said the
  opposite — repeat her question verbatim in bold, answer underneath — and
  Sophie retired it after reading the result: **chats answered her question
  first (the older rule) and then echoed it in bold and answered it AGAIN**,
  so every reply carried the same answer twice, and the verbatim echo of her
  dictation read as clutter ("the verbatim is kind of annoying … if they want
  to rephrase it that's fine"). If restating a question helps the answer,
  restate it in your own words — never as a required bold block. And keep the
  answer SHORT; the length rule above applies to answers first of all.
  - **The QUESTIONS button needs nothing from you.** Under a chat's header, on
    the note row, a button **swaps the message list for her questions** and
    swaps it back — the header, tabs and her note stay put; each row is a real
    `.msg` (collapsed to the question, tap to open the answer under it). It is
    **DERIVED, never filed**: `questions.js` pairs her messages
    (`from:'sophie'`) with the reply that followed and shows that reply's
    opening — the TLDR or first paragraph — **which is exactly why answering
    FIRST and ONCE matters: your opening IS what she sees under her question
    forever.** A reply that opens with "Lots here. Let me start the rendering
    first" files a non-answer under her question (real example). Chosen over a
    POSTed card because only 15 of 224 chats ever wrote an Update card; a
    filed list would be empty. **Unanswered questions are never listed**
    (`answeredOnly`), and one answer never repeats across several question
    rows (`collapseSharedAnswers`).
  - It shipped first as a full-screen overlay with an ✕ and that was wrong —
    "not totally separate not an x"; a new surface here should take the
    messages' place, not cover them.
  - Her dictation often carries **no question mark at all** ("I'm wondering if
    this should be part of the message"), so the detector keys off phrasing
    too. Don't assume a question needs a `?` to reach the list.
  - `GET /api/chatfeed/questions?chat=` returns them, newest first
    (`?open=1` includes unanswered ones).
  - Tests: `node scripts/test-questions.js` (the extraction, pure, no
    network) and `node scripts/test-chats-questions.js` (the real page,
    headless).
- **CHATS SORT THEMSELVES INTO HER FOLDERS — and there is NOTHING for you to
  do (Aug 2026, Sophie: "I've been manually sorting all my chats, but they
  could sort themselves").** Do NOT post a category, and do not add one to
  your status card: the server files a chat at the end of its turn by reading
  the thread it already stores (`chat-sort.js`), because a chat-posted
  category would be filed by the same ~7% that ever post an Update card. The
  three rules it obeys: **anything SHE filed is never touched** (`catBy`),
  **"none" is a normal answer** (filing hides a chat from her main list, so a
  wrong folder costs her real work), and **it never invents a folder** — her
  vocabulary is read live and taught by her own filing. Her two WHEN folders,
  `look at` and `come back to`, are off limits to it. Full rules in
  `docs/chats-app.md`; `GET /api/chatfeed/sort` shows the vocabulary and the
  counts.
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
- **EVERY SEARCH BOX SPEAKS ONE GRAMMAR, AND SEARCHES AS SHE DICTATES (Aug
  2026).** Bare words are AND'd **within one message/image** (`witch keywords`
  = both, any order — her ask: two words she knows shared one message where one
  of them appears in hundreds of others), `OR` takes either, `-word` excludes,
  `"quoted"` keeps words adjacent (the old whole-field-as-one-phrase
  behaviour). Parsed in ONE place, `search-grammar.js`, shared with the
  Chunking clip library; matching stays per-caller on purpose (the feed anchors
  terms at a word start against raw text, the clip library normalises). And
  every box runs through `liveInput` — **iOS dictation can fill a field without
  firing `input`**, so the boxes poll the value while focused rather than
  waiting for the keyboard's ✓. Tests: `node scripts/test-search-grammar.js`,
  `node scripts/test-chats-live-search.js`.
- **A claim about what OTHER sessions do is a POPULATION fact — measure it, never
  reason it out.** See the case study at the top of this file. Most chats run an
  older hook than the repo's, so a feature that depends on a new hook simply does
  not fire for them, and that is silence rather than a bug.
- **A chat's identity is its SESSION, not its slug.** Branch names get reused;
  every post carries `session` and the server re-resolves authoritatively, so a
  stale hook cache cannot mis-file a reply.

### Working ON the Chats app itself?

**`docs/chats-app.md` has the rest** — the hook and its versions (live drafts, the
turn-start ping, the working fold, stale-hook detection, the turn-boundary rule),
her own messages in the feed, the home screen's views and piles (hidden, archive,
categories, bookmarks, UPDATE, to-do, trash), the account tabs, the header and
masthead rules, chapters, and the sagas that produced them. Two things from it are
worth knowing even if you never open it:

### Posting a page into the app (Compare / judge / picker)

Sophie asks for a comparison sheet, an options board, a side-by-side, or any
custom viewing page → **post it into her app**, don't make a claude.ai artifact:
`POST /api/chatfeed/page {chat, title, html}`. It lands in your chat's Compare
tab and opens full-screen. **Read the `new-page` skill first; the full contract
is `docs/compare-pages.md`.** The parts you must not get wrong:

- **A LIST FITS A STOCK TEMPLATE — post the DATA, not HTML (Aug 2026).** When
  the page is "review these one at a time" or "these variants side by side",
  don't build HTML at all: `POST /api/chatfeed/page { chat, title,
  template:'deck'|'grid', data }` — the deck is the Tinder pager (browse
  taps/swipe, optional ♥/✕ or her own states, tap-to-record voice notes), the
  grid is rows wrapping at three across with the Assets-style PROMPT overlay;
  items with an asset `url` mirror ♥/✕/notes to the Assets tab so the two
  agree. **The SERVER auto-files the objective comparisons ITSELF (Aug 2026
  v2)**: filing a prompt or a MODEL · QUALITY caption pokes `runAutoCompare`
  (chatfeed.js), which keeps two standing auto grid pages per chat — same
  content with a differing quality/model/style, and same style across
  different subjects — updated in place, her verdicts preserved. So FILE THE
  PROMPTS; an image with no prompt on record can never join a group.
  Near-variant prompts (a line changed) are still only FLAGGED
  (`GET /api/gallery/assets/variants?chat=`) — filing those is the chat's
  call. Full contract in `docs/compare-pages.md` (THE STOCK TEMPLATES).
  **WORDS ON A CARD — a date, a moment, a scene — GO IN HER DATE-CARD DESIGN,
  and it is automatic (Aug 2026, her own "Decision Deck v2", built for the
  dating book).** Give a deck item any of `who` (the name — her rust, centred
  under the header), `eyebrow`, `text` (the moment), `sections:[{label,text}]`,
  `caption`, `img` — every part OPTIONAL, a card renders only what it carries
  — and the deck comes out in her design: white boxes on her cream, the
  Newsreader serif, one screen with no scrolling, her footer — ✕ and ♥ above
  a full-width "Note for Claude…" box. **A hand-built page CANNOT get this** — `card:'<html>'`
  items are excluded by design, and a page posted as `html` is frozen the day
  it is posted. So a text deck that hand-rolls its own card styling is not a
  style choice, it is opting out of hers.
- **START FROM THE SHELL** — `public/compare-shell.html`, which links
  `/compare.css` (the one house look AND the `:root` tokens the injected
  autoscroll pill styles itself from) and `/compare.js` (the one house
  behaviour). Hand-rolling either is how pages shipped with a black, broken pill.
- **Don't reach for a page by default.** A routine options batch is reviewed as
  labeled Assets tiles. When you do build one: images in rows of TWO, minimal
  text, compared things side by side, the deliverable at the TOP, a film as a
  line of text with a play button — never an embedded `<video>`.
- **The title and nothing else at the top** — no eyebrow, no tagline.
  Instructions go behind a `?` via `window.__compareHelp`. Text boxes ship
  empty; buttons hug their words.
- **She must be able to leave a NOTE on anything reviewable** —
  `window.__compareNotes({chat, sheet})`, one line. Answer her on the note
  itself; it renders as a thread. Never post to `/api/chatfeed/reply` from a
  page — the server reroutes it onto the page's verdict doc.
- **A new VERSION is a NEW page**, never an edit of the old one, and the title
  says which version it is. Supersede the one it replaces
  (`POST /page/:id/supersede`) instead of deleting it. A verdict sheet's name
  must carry the shape of the item set (`blocks-s96`), or a rebuild silently
  re-points her saved answers at different content.
- **`POST /page` answers `warnings`** when a page skips the kit. If yours comes
  back with one, fix the page and re-post before you finish the turn.
- **Picking spans of a recording is `public/picker-shell.html` +
  `window.__cutPicker`** — required, not optional. Four chats hand-rolled their
  own in one week and each re-shipped the same bugs.
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
- **MINIMIZE THE SCROLLING — fit it on ONE SCREEN (Aug 2026, Sophie).** If a
  surface can fit on one screen, it fits on one screen. When it can't, it gets a
  **hairline tab row — never a taller page.**
  - **The test for splitting into tabs is REFERENCE, not length:** "is it
    something that's going to be referred to? Are you gonna have to switch
    between the different views often?" Two views she reads against each other
    are two tabs; a long page nobody cross-references is just a long page, and
    tabbing it only hides things.
  - Her worked example, the Episode Editor: "you need to switch between the
    clips and between the raw transcript so you can take things from the
    transcript, add it to the clips, and then go back and add more things. Back
    and forth, back and forth, back and forth. So to make that easy — a
    hairline pattern, 2 tabs."
  - The rows measure their own underline, so adding a tab costs no layout work
    — `.acctabs` in `docs/design-rules.md`.
- **PROGRESSIVE EXPANSION AND CONTRACTION (Aug 2026, Sophie: "this has to do
  with the abstraction principle").** A surface opens at the level of
  abstraction she needs and expands only where she goes into it — so the first
  thing on screen is the shape of the whole thing, not its contents. Her worked
  example, the Story Room: organize by projects and by level of completion,
  with the LAST hairline tab holding the ones she wants to start on.
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
  popup), `ICONS.sparkles` in `promptlab.html` (the Playground's Generate), and
  `GEN_STAR` in `chats.html` (the archive sheet's Summarize — named apart from
  that file's own `STAR`, which is the five-pointed mark on a starred chat).
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
- **Answer questions FIRST — and answer each one ONCE.** If Sophie's message
  contains a question, answer it at the top of the reply, before doing or
  reporting on any tasks from the same message. **Do NOT echo her question
  back in bold and answer it again** — that rule existed for one day and was
  retired (see *Answering a question* in the Chats app section for why).
  Restating a question in your own words, where it helps the answer, is fine.
- **SHORT REPLIES BY DEFAULT — every reply, not just small questions (Aug
  2026, Sophie: "a lot of my responses are really long and it's actually
  annoying cause I don't wanna read through it all").** The default reply is a
  few short paragraphs: the TLDR, her questions answered, and only the facts
  that change what she does or decides next. Cut the rest — play-by-play of
  the work, options you didn't take, recaps of things she already knows,
  restated plans, closing summaries, next-step menus she didn't ask for.
  Detail that genuinely matters goes behind an offer ("want the long
  version?") or into the PR description / a doc she can open — never into the
  reply by default. Output tokens also bill at several times the input rate,
  so a long reply costs real money on top of her reading time — but her
  reading time is the reason. "Small question → short answer" and "quick
  question mode" below are the tighter ends of the same dial, not exceptions
  to a verbose default.
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

### Building a page, a screen or a piece of chrome?

**`docs/design-rules.md` has the deep half** — read it before you lay anything
out. The headlines, so you know when to go and look:

- **A web-wrapped tool's PAGE owns its header**, not a native bar — but a NEW
  tool still ships with the native bar + chevron (copy `EpisodeEditorView.swift`).
  A gated page inside a native tool must be asked for with `?embed=1`, and gated
  pages must not be cached.
- **Never serve a raw generated PNG to a page** — gpt-image-2 writes ~1MB PNGs
  and the same picture as webp is ~50KB, about 22x. Run
  `node scripts/webp-assets.js` then `webp-assets-verify.js` BEFORE deploying;
  there is deliberately no PNG fallback, so a missing copy is a broken picture.
- **The hairline `.acctabs` rows measure their own underline** — no row anywhere
  declares a tab count. Add a tab and the line still lands under the word.
- **Custom icons are framed at 1.11x the SF Symbol point size**, and every
  bundled glyph must fill exactly 0.90 of its own viewBox — run
  `python3 scripts/normalize-glyphs.py` after adding or editing one.
- **The sans is CAPS and not bold; the serif is untouched by that rule.**
- **`[hidden]` loses to any author `display` rule** — every page that toggles the
  attribute needs `[hidden]{display:none !important}`.
- **The home is ONE grid with a shortcut row of five filter squares** — there are
  no separate business/crafts home screens anymore.
## The other modules — the map

Each one's full reference moved into `docs/` (Aug 2026) so this file could stay
readable. The bullet keeps what you need WITHOUT opening the doc; open the doc
before working on that module. Nothing was deleted — the moved text is verbatim.

### Pictures
- **Playground** (`/playground`, `public/promptlab.html` + `/api/promptlab`, iOS
  tile) — the prompt tester. Fixed recipe per style so runs stay comparable: ONE
  image a run, 2:3, Generate is the stars icon. Five styles: WTR (the only
  Replicate LoRA), ChatGPT, Scarry, Pastel, Hoonies (all gpt-image-2 edits with
  her own scans attached as style refs, kept in `PL_GPT_STYLES` in server.js).
  **A Replicate run she already has is never sent again** (Flux with a fixed seed
  is deterministic); ChatGPT is never deduped, because an identical run there
  draws a different picture. Quality low/medium/high 0.5c/4.1c/16.5c at its 2:3
  (the one price table lives in `docs/modules/pictures.md` — and the SQUARE
  canvas is the dear one, not the cheap one), deliberately not
  persisted. Cancel is Replicate-only on purpose. The feed pages backwards through
  time and has LIST and TILES views. **Full details: `docs/modules/pictures.md`.**
- **Freeform** (`freeform.js`, `/api/freeform`, `/freeform`) — the one image
  surface with **no opinion**: the prompt goes to gpt-image-2 verbatim, no prefix,
  no suffix, not even a trailing-period trim. `promptSent` is stored on every run
  so anyone can verify nothing was added — the "if you add anything to a prompt
  Sophie gave, tell her" rule made structural. References are a LIBRARY, not a
  per-run upload. **Full details: `docs/modules/pictures.md`.**
- **Vector pipeline** (`vector.js`, `/api/vector`, page at `/vector`, iOS tile
  under the PICTURES filter) — describe 1-25 drawings -> ONE gpt-image-2 sheet in
  the pastel house style (~6c, the only cost) -> cut into cells -> trace each to
  SVG (free, local). **Making vector art, or touching `vector.js`/`vectorize.js`?
  Read `docs/vector-pipeline.md` FIRST** — it carries the exact style, routes,
  gotchas and tests. The one hard limit is GRADIENTS. Re-cutting a sheet you
  already paid for is free. Recolour after the fact with `POST /recolor`, and
  never turn that into a find-and-replace. **Full details: `docs/modules/pictures.md`.**
- **Card-deck art generator** (`apiframe.js`, `/api/apiframe`) — the deck card art
  via **Midjourney**, which has no official API, so it goes through APIFRAME
  (their own MJ accounts — none of Sophie's is involved). ~6-8c per generate of 4
  options. `ingest.js` (`/api/ingest`, `/import`) is the bring-your-own-Midjourney
  alternative, plus a Chrome extension that posts straight from her logged-in MJ
  session. **Full details: `docs/modules/pictures.md`.**

### Audio & film
- **Movies** (`movies.js`, `/api/movies`, iOS Movies tab — no web page) — story ->
  ~8-12 self-contained scenes -> gpt-image-2 panels -> Replicate image-to-video ->
  ffmpeg stitch, ~$1.35 for a 12-scene film. Also holds **Dreams** (the staged
  dream -> comic pipeline, where a gpt-image-2 SAFETY REFUSAL is terminal and the
  page is redrawn with its narrative softened — never retried), the character
  anchor, dream-bridge clips, the zine, and quick-animate. Editing is free
  server-side ffmpeg; every re-roll is kept.
  **Full details: `docs/modules/audio-and-film.md`.** Making one of her concept
  videos? `docs/movies/sophies-movie-pipeline.md` first.
- **Cutting Blocks** (`blocks.js`, `/api/blocks`, page at `/blocks`, iOS tile
  under the FILM filter) — the TOP of the audio pipeline. A recording comes
  apart into sentence-level LINES to split (tap two words), meld back together
  (the chain), mark **locked in / not sure / out** (three states, not
  keep-or-cut), reorder, respeak in her voice, and **hear as marked before
  anything is cut**. It was a hand-authored Compare page re-posted at v14 with
  no server behind it — five capabilities that existed nowhere else, and every
  improvement cost a chat re-authoring an 87KB artifact.
  **The two-tier timing rule is load-bearing:** the bulk 75s-chunked whisper
  pass places and PREVIEWS a line (via the Episode Editor's `page-cut`), and
  the real render RE-LISTENS per card and cuts through `editor.js`'s validated
  cutter — the Cutting Room's finding, imported rather than re-learned
  (`cuttingroom.js` now exports `chunkedWords` / `cutSection`). Her marking
  state is a whitelisted patch on one Firestore doc (`forge-blocks`,
  content-addressed by the source url, so re-opening resumes); words and
  blocks live in Storage. Transcription is ~$0.006/min, once ever per
  recording; rendering is ffmpeg on our own box, free. Tests:
  `node scripts/test-blocks.js`. **Full details: `docs/audio-pipeline.md`.**
- **Pausing** (`pausing.js`, `/api/pausing`, page at `/pausing`, iOS tile under
  the FILM filter) — the BOTTOM of the audio pipeline, and the other half of
  the polish pass: **how long a beat sits**. The Cutting Room can only REMOVE a
  pause (compressed to ~0.28s, its one length); here she sets a length, ADDS a
  pause where the recording has none, and hears her EDIT rather than the
  source ("I need to be able to hear it to know how long of a pause I want").
  It was a hand-authored Compare page ("Evan — the pause timeline v7b") with
  its whole state in a chat's verdict fields.
  **Three things not to undo.** (1) **Pause detection is IMPORTED** —
  `cuttingroom.js` exports `breathCuts`/`roomToneCuts`/`mergeRanges`/
  `rmsProfile` and this module calls them; every constant in them is a measured
  finding, so a second copy would find different pauses and the same recording
  would read differently in two rooms. Those passes return ranges to REMOVE,
  inset by KEEP/2 either side — Pausing takes the inset back off to get the
  GAP, and no further (the 0.10s margins are speech protection). (2) **A PAUSE
  IS NEVER DIGITAL SILENCE** — it is the recording's own room tone, an existing
  gap lending its own air (trimmed or looped) and an added pause borrowing the
  quietest stretch of the file, baked once at `pausing/<id>/room.wav`. Zero
  samples read as a dropout; that is what made the "45 percent" line sound
  bungled. (3) **The edit is ONE file** — `pause-plan.js`, loaded by the render
  on the server AND served to the page at `/pause-plan.js`, because she
  approves a length by ear and the preview has to be the take. It does not cut
  WORDS (that is the Cutting Room's and Cutting Blocks' job, with the re-listen
  a real word cut needs); "out" is 0.08s of room tone, an elision. Listening is
  per PARAGRAPH — the server cuts that span once via `/api/search/clip-span`
  and the page splices in the browser, so changing a length costs no round
  trip; ninety minutes decoded would be most of a gigabyte in a WKWebView.
  Transcription ~$0.006/min once ever per recording; everything else is free.
  Tests: `node scripts/test-pausing.js` (pure) and `node
  scripts/test-pausing-page.js` (the real page, headless, asserting on the
  SAMPLES — a pause must be quiet and NON-ZERO).
  **Full details: `docs/audio-pipeline.md`.**
- **Chunking** (`clips.js`, `/api/clips`, page at `/chunking` — `/clips` is an
  alias — iOS tile under the FILM filter) — the clip LIBRARY: every short
  self-contained piece the app has made, on one shelf, four to a row with names
  under the posters, so a re-cut reuses clips instead of re-paying for them.
  **A CHUNK (Sophie's word, what the tool is named for) is a named, tagged
  SECTION of a finished video — footage + voiceover together — that she'd
  reuse whole in a different video** (her examples: the Sheldrake telepathy
  bridge in the Evan video; the manifestation trio she visualized at night).
  `POST /api/clips/chunk {url, start, end, title, vo?, tags?, from?}` files
  and bakes one in the background (content-addressed by url+span; `vo` =
  the span's voiceover text, searchable as `vo:`); the harvest never touches
  chunks. Any chat that cuts a section of a finished video should file it.
  **Rebuilt from scratch 2026-08-15** (Sophie asked for a fresh take on the
  first build; the old `forge-clips` collection lies dormant — this one is
  `forge-clip-library`). **It generates and stitches nothing and costs
  nothing.** Harvest = Firestore (movie scene clips + kept re-rolls + dream
  bridges + quick-animates, arriving with real titles and the generation
  PROMPT) + a Storage SWEEP for the shorts chats built into their own
  prefixes. **The skip list is the load-bearing half** (`SKIP_PREFIXES`,
  measured 2026-08-15): the Dump, whole interviews, finished
  episodes/films, `movies/` (the Firestore half covers it), the pad's
  still-encode cache, voice notes; a swept file over 64MB never downloads,
  and one probing over 180s is a film, skipped and counted. Search is the
  whole interface — the house grammar (`search-grammar.js` parses; matching
  is substrings over normalized text) with `tag:`/`title:`/`from:`/`prompt:`/
  `note:`/`kind:`; the box runs through `liveInput` so dictation searches as
  she speaks; semantic search deliberately not built yet. **Her edits always
  win** — `editedFields` on the doc; a re-harvest never overwrites a touched
  field, and there is deliberately NO delete route (hidden is the verb).
  Posters read the bytes via the Admin SDK, NOT the url (ffmpeg can't reach
  the sandbox's HTTPS proxy), frame at ~15% in, 480px webp. Opening the page
  never starts a harvest — it only shows a running one.
  Tests: `node scripts/test-clips.js` (pure, no network).
  **Full details: `docs/modules/audio-and-film.md`.**
- **The audio PROJECT** (`audioproject.js`, `/api/audioproject`,
  `forge-audio-projects` — no page of its own) — the light cross-room id
  Sophie picked (2026-08-19): threaded through every audio hand-off as
  `&project=`, it carries the NAME and WHO-SPEAKS so they are decided once;
  marks/geometry stay room-local ON PURPOSE (each room re-listens anyway).
  `GET /walk?url=` derives full lineage by joining render urls to source urls
  across the room collections — zero stored state, ~60s cache — and feeds the
  one-line "came from · went on to" strip on `/blocks`, `/cutmarks` and
  `/cuttingroom`. Every project write is best-effort: a room must open fine
  with no project at all. The Episode Editor deliberately doesn't mint one.
  Tests: `node scripts/test-audio-wiring.js`.
  **Full details: `docs/audio-pipeline.md` (The PROJECT across the rooms).**
- **Songs** (`songs.js`, `/api/songs`, `/song`) — she sings into her phone, out
  comes a produced track with HER actual voice (resemble-enhance -> musicgen
  melody conditioning -> ffmpeg mix). ~$0.11 per 30s chunk. **It has no tile
  anywhere by request** — see the deliberately-unlinked pages note.
  **Full details: `docs/modules/audio-and-film.md`.**
- **Voice Memos — ONE library, and every path files into it.** membry Storage
  `memo-audio/` + a manifest (`memos.js`, `/api/memos`); the Mac push, the iOS
  share sheet, Story Room pastes and a chat with a pasted file all funnel through
  `memos.fileIntoArchive()`. **A chat files a pasted recording with ONE call —
  never hand-build the stamp:** `POST /api/memos/ingest?title=&dur=&ext=m4a` with
  the raw bytes as the body. Transcription is unconditional. Dedupe is three
  layers (file md5, date-zeroed audio fingerprint, transcript backstop) because
  iOS rewrites an m4a's dates on every share — so identical audio has different
  bytes. **A shared stamp is NOT a duplicate** and never dedupes anything.
  **Full details: `docs/modules/audio-and-film.md`.**
- **Voice Studio** (`voicelab.js`, `/voice`) — her cloned voices, two hairline
  tabs: TEXT (TTS, stock v2 defaults, no settings by design) and VOICE
  (speech-to-speech on `eleven_multilingual_sts_v2`, which keeps the performance
  and swaps only the voice). Her words stay in the box after a render. The page
  carries NO header of its own (the native bar has the title) and no character
  counts; credits live behind the ⓘ on the tab row.
  **Full details: `docs/modules/audio-and-film.md`.**
- **Audio drop** (`audio.js`, `/api/audio`) — the generic destination for audio
  off her phone: dump first, label afterwards, files keyed by byte md5, readable
  Storage paths because these URLs get pasted into other tools by hand. The iOS
  share sheet routes audio here. **Do NOT point Sophie at the `/audio` PAGE to
  find a clip** — it is an uploader whose list only shows the batch typed in its
  box. **Full details: `docs/modules/audio-and-film.md`.**
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
- **YouTube auto-upload** — finished videos post to her business channel as
  **private drafts** for her to publish by hand; nothing goes public
  automatically. `scripts/youtube_upload.py` (stdlib only), auth via a durable
  refresh token, upload-only scope. **Full details: `docs/modules/audio-and-film.md`.**

### Story
- **The pad IS the Story Room now (Aug 2026)** — `/storyroom` serves the pad page
  and the app's Story Room tile opens it. The OLD board surface (`storyroom.html`,
  `/api/story/*`) stays in the repo, unpointed. Stories carry **listen rows**
  behind ONE waveform button on the title row (Aug 2026): the Episode Editor
  episodes cut from the story, resolved to their newest render live, AND the
  **voice memos it came out of** (`POST /api/scratchpad/audio {pad, src}`,
  `src` = the Search index id). No audio attached → no button.
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
- **Story Timeline** (`timeline.js` + `timeline-parse.js`, `/api/timeline`,
  page at `/timeline`, iOS tile) — a dictated list of moments becomes cards she
  can put in order. It started as one Compare page for one story (Aug 2026) and
  became a tool when she asked for it "for other stories". **It costs nothing —
  no model call, no background job**, so opening it and saving are both free.
  **CHATS FILL THE SHELF — the page only lists and arranges (Aug 2026 v2,
  Sophie: "it's for chats to fill themselves… I just wanna see a list of
  stories and I can click on one and the chats will fill the stories").** The
  page shipped first with a name box + paste box and she cut them: nothing on
  `/timeline` creates a story. **When Sophie dictates a story's moments to
  YOU, filing it is YOUR job**: `POST /api/timeline/stories { title, text }`
  (text = her dictation, one moment per line — the parser strips her numbers,
  takes wrapping quotes off, and turns her ALL-CAPS headers into sequences;
  `POST /parse` dry-runs it), then hand her the link
  `https://imageforge-q125.onrender.com/timeline?story=<id>`. Do NOT rebuild
  the retired per-story Compare pages (`scripts/gen-story-timeline.js` and the
  `docs/story-timeline/timeline-v*.html` files are that history; her original
  story was migrated in by `scripts/seed-story-timeline.js`).
  **THE CARD IS THE ATOM, THE UNIT IS WHAT MOVES:** a unit is one moment or a
  run of them that travel together (her word: a SEQUENCE) and carries ONE
  number, because the number is its place in the order. `units` is an array of
  arrays of moment ids and is the whole arrangement — order and grouping in one
  field — while `moments` is keyed by id and holds only words, so moving a
  moment can never alter it and re-ordering can never lose one. **Parsing a
  paste is a STARTING POINT, not a verdict** (an ALL-CAPS line opens a group; an
  END line, a blank line or the next header closes it): it gets some groups
  wrong on purpose, because fixing one on the page is two taps and no parser
  out-guesses her about where a sequence stops. **Nothing is deleted outright**
  — DELETE hides a story, and deleting a moment drops it from `units` while its
  words stay in `moments`. The page's controls are all hers by name: a number
  you can TYPE, single/double arrows (one step / all the way), the marks in the
  GAP (join these two, add one here), the pencil (change the words, and only
  from inside the open editor: divide at the cursor, delete), and a unit of 5+
  FOLDING to its first and last with one line each in between.
  **The editor is behind a pencil and never a tap on the words** — tap-to-edit
  means every stray thumb on the way down the page opens an editor.
  Two bugs worth not repeating, both pinned by the test: a folded middle sets
  `white-space:nowrap`, so its grid track needs `minmax(0,1fr)` or the whole
  unit shoots off the right of the screen; and an editor that holds itself open
  for ANY focus inside its card loses what she typed when a blur leaves focus
  put. Tests: `node scripts/test-timeline.js` (the parser and the validators
  pure, then the real page driven in headless Chromium).
  Firestore `forge-timelines`, one doc per story.
- **Writing Room** (`writing.js`, `/api/writing`, `/writing`, iOS tile) — every
  dating-book date in two versions ("Claude's" and "Mine") with every changed word
  marked red, autoscroll, and per-paragraph notes (text or voice memo). **Notes are
  the review loop**: she annotates on the couch, ANY chat can read them
  (`GET /api/writing/notes`) and apply the edits, then DELETE them. Source of truth
  is `docs/dating-book/working-drafts/featured2.json`; run
  `python3 scripts/gen-writing.py` after editing and commit all three files.
  **Full details: `docs/modules/story.md`.**

### Business
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
- **Photo -> Etsy** (`photostudio.js`, `/api/photostudio`, `/photo`) — a separate
  track from POD, for things Sophie already MADE: one photo of the real product ->
  reviewable Etsy draft. Mockups use gpt-image-2 edits with `input_fidelity:high`
  so the ACTUAL product is preserved, not hallucinated.
  **Full details: `docs/modules/business.md`.**
- **Blog Studio** (`blog.js`, `/api/blog`, `/blog`) — topic -> long-tail keywords
  -> full SEO post -> image -> publish. **Primary destination is the on-site blog
  at secretlyawitch.com/blog**, so organic traffic builds the real domain;
  Shopify is secondary. Keywords AND draft both run on **Claude** (reader-facing
  words). **Full details: `docs/modules/business.md`.**
- **Tarot email** (`tarot-email.js`, `/api/tarot-email`) — the kinetic daily
  spread as three face-down cards with pure-CSS tap-to-reveal (email clients strip
  JS). Apple Mail gets the real flips; Gmail/Outlook fall back gracefully. The
  spread is deterministic per day and MATCHES THE WEBSITE (a verbatim port of
  `witch.html`'s `dailyPull()` — keep the deck data in sync). Campaign sends stay
  in Brevo's dashboard. **Full details: `docs/modules/business.md`.**
- **Crystal drop** (`crystals.js`, `/api/crystals`, `/crystals`) — her mom's
  crystals, photographed, on their way to Etsy listings. **The album-is-one-stone
  model is WRONG for most of the real data**: the photos live in the Dump (15
  albums, 629 photos), and most albums are catalogue runs holding 20-50 separate
  stones — roughly 175 stones in total. Nothing can DERIVE where one stone stops
  and the next begins, so **the Splitter (`/crystalsplit`) asks her**: one tap on
  any photo that starts a new stone. Marks are file ids, never indexes. Tiles must
  use `thumb`, never the full-resolution `url`.
  **Full details: `docs/modules/business.md`.**

### Public apps
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
- **Sticker Day** (`public/selfcare.html`, `/selfcare`, **ungated/public**) —
  seven small acts of self care a day, each one a sticker: an un-earned task is a
  flat grey silhouette, tapping it peels the sticker on in colour and opens a mini
  lesson. State is `localStorage` only, which is why the page is ungated. Sticker
  art must be a transparent die-cut PNG (the silhouette is the same PNG,
  CSS-masked). Its third tab is the **Memory Passport** — four stamps a day, the
  scalloped edge drawn by the PAGE not the model, with a paid draw-your-own that
  spends real money on a public endpoint (rate-limited).
  **Full details: `docs/modules/apps.md`.**

### The Anthony Chene NDE project
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
- **NDE movies — the watercolour look.** Making art for the montages? Read
  `docs/nde-watercolor.md` FIRST; the headline rule is counter-intuitive — write
  NO style description at all, just attach `refs/sage-sandy-mirror.png` as a pure
  style reference (gpt-image-2 edits, quality medium, 1024x1536). The nine
  experiencer character cards are BUILT and public — do not re-derive them.
  **Only nine people have an approved likeness: never invent a face for a real
  person.** **Full details: `docs/modules/nde.md`.**

### The inbox, the doorbell, and odds and ends
- **Favorite fruit poll** (`fruit.js`, `/api/fruit`, pages `/fruit` + `/fruitchart`)
  — the chart for Sophie's fridge. 27 fruits drawn in her ink-and-watercolour
  look (`refs/sage-sandy-mirror.png` through gpt-image-2 edits, medium,
  1024x1024, `scripts/fruit-chart/fruits.json`) become a **Tinder-style swipe
  deck**: ♥/✕ one fruit at a time, then crown a #1. **BOTH PAGES ARE PUBLIC AND
  UNGATED, and that is the design** — they are opened from an email by her
  family, who have no studio token, so the unguessable `who=` token in the link
  IS the identity. Emails live only on the poll doc and the public read strips
  them, so one person's link can never enumerate the others'. A ballot doc is
  content-addressed (`<poll>__<person>`), so swiping twice updates one ballot
  and "close it, come back" works; only `done:true` counts as an answer, so an
  abandoned half-deck never lands in the chart. `/fruitchart` renders the same
  answers three ways (per person · a grid · sized by how many picked it) and
  prints one design per page. **Sending needs `BREVO_API_KEY` +
  `BREVO_FROM_EMAIL`, and as of Aug 2026 NEITHER IS SET** — not in Render env,
  not in `config/pipeline` (measured 2026-08-14: `/api/tarot-email/status`
  answers `brevo:false`). `POST /invite` refuses with which one is missing
  rather than half-sending; run it with `dryRun:true` first, the same guard the
  App Store metadata workflow gets. Tests: `node scripts/test-fruit.js`.
- **Opinions** (`opinions.js`, `/api/opinions`, page at `/opinions`, no iOS
  tile yet) — the decide-on-things game from Sophie's commercial concept (Aug
  2026): two ideas side by side — businesses, things to make, app ideas, or
  two pictures — tap the better one, and the picked side stamps **GOOD IDEA**
  (the other BAD IDEA). Relentlessly encouraging by design: a streak, an
  accolade ladder (Opinion Haver → Chief Opinion Officer), and a headline
  that keeps telling her she has good opinions. **It costs nothing** — no
  model calls; the feed is PRELOADED from committed `opinions-feed.json`
  (image sides point at committed webps) plus Firestore extras any chat can
  add (`POST /api/opinions/items {items:[{kind,category,q,a,b}]}` — commit
  seed edits for curated sets, POST for drive-by ideas; a POSTed id colliding
  with the seed is refused, committed wins). Picks are ONE doc per item id in
  `forge-opinions` (re-picking updates in place — changing her mind, never a
  duplicate); notes ride the same doc via the small + on a card. Item ids
  are permanent — renaming one orphans her pick. One screen, never scrolls,
  no pill. Tests: `node scripts/test-opinions.js` (pure).
  **Scenario art is drawn as 2×2 SHEETS at LOW (Sophie, Aug 2026: "one image
  per quarter so each image will cost a quarter")** — one Playground pastel
  run whose prompt describes a 2x2 grid of four separate small
  illustrations, cut into quarters locally, each quarter filed as its own
  image (~0.125¢ apiece). Candidates go on a grid Compare page for her ♥
  before anything gets wired into a card or re-drawn at medium.
  **SERIALIZE bulk Playground batches (measured 2026-08-19):** two parallel
  4-run × 4-output batches each died "interrupted by a server restart"
  partway (the 512MB box restarting under 16 concurrent buffered images +
  whiten passes is the suspect, though one restart also happened idle);
  13 draws run strictly one-run-at-a-time completed clean. One run at a
  time, poll to done, then the next.
- **The Dump** (`dropbox.js`, `/api/drop`, sort page at `/dump`, iOS tile with
  SEND and SORT tabs) — **dump first, label afterwards**. Dropping asks no
  questions; only the bundle (a Photos album) and the session are captured,
  because they are free then and expensive to reconstruct later. Bytes are stored
  once, content-addressed, so the same photo in two albums is ONE object.
  **FOLDERS CONTAIN ALBUMS — they never merge them** (a folder is the `track`
  field; filing an album moves nothing inside it). `photoIndex` comes from a
  transaction, never from counting — that is the bug that scrambled album order.
  **Full details: `docs/modules/inbox-and-misc.md`.**
- **THE UPDATE BUTTON** (`brief.js`, `/api/brief`, page at `/brief`, the
  **"What's new"** button on the iOS home screen → `BriefView`) — Aug 2026,
  Sophie: "an update button on the home screen that I can just click and then
  it does an API call that gives me the top five things I might want to be
  updated on, and then maybe some lower priority things, and ideally images
  that chats made or links to compare pages". One tap → five cards, the
  quieter ones under them, each carrying the pictures that chat made and the
  Compare pages it posted.
  - **IT SPENDS NOTHING AND WRITES NOTHING.** No model call: the lines it
    shows were already written by the chats themselves (their status card's
    `need`, their Update card's `did`, their TLDR), so a summary here would be
    a paraphrase of a summary. Four Firestore reads, three capped, one of them
    chatfeed's own 5-minute registry cache (`registry` is exported for this —
    do NOT open a second cache of that collection). The answer is held 60s, so
    a double tap is free; `?fresh=1` is the Refresh button.
  - **`notifSeenAt` — the ✓ in the Chats app — is the ONE floor**, the same
    one the Update tab and the widget use. Checking a chat off there empties
    its card here, and anything newer brings it back by itself. **Reading the
    brief marks nothing seen**: a button that silently cleared her Update tab
    would lose news she never read.
  - **Her filing wins the ranking**: `pinTop` and `starred` lift,
    `newsQueue:'later'` sinks, `'never'` drops out, and archived/trashed/hidden
    obey the same rules as the chat list (hidden is a STAMP, so a chat that
    answers her pops back out). A live `need` keeps a card even once she has
    seen it — the ask is still open.
  - **ONE OF THE FIVE IS RESERVED for something to LOOK at** (measured against
    her real data 2026-08-17: **24 of 33 cards carried an open `need`**, so a
    pure score sort filled all five with asks and the pictures and pages —
    half of what she asked the button for — never reached the top of the
    page). It is a reservation, not a re-score: the top four are whatever
    scored highest, and with nothing to look at the fifth goes back to the
    next card by score.
  - **The picture strip merges by md5 and keeps the LABELED record**, not the
    newest one — the unlabeled twin is always the hook's `claude-deliveries`
    copy, so "first one wins" would strip the label off half the strip.
  - **It is a full-screen COVER from the home grid, not a `Tool`.** Opening a
    Tool promotes it into `Recents`, so this button would evict one of her
    three bottom-bar slots on every tap — and it is the button meant to be
    tapped most. The cover also rebuilds fresh each time, which is what makes
    it always current with nothing to refresh. It carries no count badge on
    purpose: a badge means fetching on every home draw, and the number would
    be the only stale thing on that screen.
  - Tests: `node scripts/test-brief.js` (the whole ranking, pure, fixtures) and
    `node scripts/test-brief-page.js` (the real page + the real injected pill,
    headless — pill palette, the pill's corner over the top card, the lightbox
    contract, the ⌄).
- **THE REVIEW QUEUE** (`review.js`, `/api/review`, page at `/review`, iOS
  tile "Review Queue") — Aug 2026, Sophie: "I have a pile of things that need
  to be reviewed and I'd like one screen that shows all the things waiting to
  be reviewed". One screen, every deck/grid TEMPLATE page across every chat,
  with how far through each she is. Measured the day it was built: 9 template
  pages, 285 items, 9 decided.
  - **PAGES ARE SQUARE TILES, THREE TO A ROW (Aug 2026 v2, Sophie: "icons
    three to a row … square and they should just be the first picture of
    whatever the review content is")** — the tile face is the content's first
    picture, or on a text deck (date moments, video ideas — 12 of the 15
    queued pages the day this shipped) the first card's own words in the
    serif (`peek` on the row). Tapping a tile opens the page **CLEAN**:
    `/api/chatfeed/page/<id>?clean=1` renders the template with NO h1,
    straight onto the cards (her ask: "not a compare page because that has a
    header at the top, but instead just a clean Tinder style page … with all
    the content preloaded"). `clean` lives in `renderTemplatePage`
    (page-templates.js) and works on both templates; a deck already has no
    pill, a clean grid keeps its pill because it scrolls.
  - **EVERYTHING ELSE MOVED INSIDE THE DECK (Aug 2026 v2, same conversation:
    "take away the chat list at the bottom and instead offer a link back to
    the chat in the piles area" · "get rid of the X on all of the icons and
    instead offer a skip or done button in the piles area").** The queue is
    now decks and ONLY decks — a chat tagged `to be reviewed` is no longer a
    row here (the word still files it in the Chats app, it just no longer
    puts a second kind of row in front of the pile), and no tile carries an
    ✕. A deck's **piles view** carries all three: *Open the chat*, **Skip**
    (not a review — stamps `reviewHidden`, still reversible with ↩ from the
    hidden pile) and **Done** (`reviewDone` — finished with it whatever the
    cards say; the queue still derives DONE from the counts as well). Both
    stamps go through `POST /api/chatfeed/page/:id/review`, which lives in
    chatfeed because that is where the deck already posts its verdicts —
    the same gate, nothing new to authorize. `/api/review/hide` stays as the
    queue's own ↩, and is the page's only write.
  - **A DECK OPENED FROM THE QUEUE HAS A WAY BACK** (her ask) — `?clean=1` is
    both the door and the signal: judge.js reads it, shows a back chevron in
    the top row, and `history.back()` returns her to the queue exactly as she
    left it (`/review` is the cold-open fallback). A deck opened from the
    Compare tab shows no chevron — the app's own header owns that.
  - **A LONG CARD PUTS ITS TITLE IN THE TOP-LEFT CORNER (Aug 2026, Sophie:
    "if the text is really long have the title just go in the top left corner
    instead of in the middle. I really don't like scrolling").** Over ~240
    characters (~150 with a picture) a moment card wears `.long`: the name
    drops from 21px centred to a small left-aligned line, the stack starts at
    the TOP instead of centring, and the ✕/♥ **float on the content's bottom
    corners** with the note box directly under it — her second ask the same
    day ("there's a lot of space between the X and the heart that's empty…
    put the heart and the X on top of the content so the content comes down a
    little farther"). The old ✕ · note · ♥ row cost ~78px of mostly empty
    band. **A SHORT card is deliberately untouched** — there the big centred
    name is the design.
  - **THE MINI AUTOSCROLL — conditional, small, on the side (Aug 2026,
    Sophie: "ideally you would add a conditional auto scroll thing, but only
    appears when the text is very long and is smaller than the normal one and
    just like on the side of the screen").** A deck carries no house pill —
    one card at a time never scrolls the PAGE — but a long card scrolls
    INSIDE itself, so this drives the card's own scroller: a 28px button on
    the right edge, shown only while the card in front of her actually
    overflows (measured, not guessed from a character count). Two things it
    had to learn: a NEW card starts stopped but the SAME card is left alone
    (the serif lands late and `fonts.ready` re-syncs, which killed a scroll a
    second after she started it), and the position is accumulated in JS —
    `scrollTop += 0.37` snaps to the same integer every frame and moved the
    card exactly 0px.
  - **THE ✕ AND ♥ ARE DRAWN BY HAND (Aug 2026, Sophie, pointing at the ✕
    inside one of her own cards: "can you make this X that I gave as a
    screenshot, and make the heart actually kind of a handwriting look?").**
    They were the plain ✕/♥ CHARACTERS in the system sans — the only two
    geometric marks on a card that is otherwise all her serif and her cream.
    `MOM_X` / `MOM_HEART` in judge.js are filled outlines rather than strokes,
    which is what buys the weight through the middle and the chisel cap at
    each end; the heart is lopsided on purpose. **Not Lucide** — the house
    line icons are chrome, and this is inside her own design.
  - **Everything is DERIVED, nothing is filed**: the item lists are the pages'
    own frozen Storage JSON (cached forever per id — a new version is a new
    page), her progress is the verdict doc (`<chat>__page-<id>`), names come
    from the registry cache. No model call, no cost; the answer is held 60s.
  - **The 'later' rule**: on stock-states pages `'later'` counts as still
    waiting (it is literally "declined to sort now" — judge.js), shown apart
    ("4 of 28 · 2 later"). A page with its OWN states counts every one.
  - **A CHAT TAGGED `to be reviewed` WAS BRIEFLY A ROW HERE, AND IS NOT ANY
    MORE (Aug 2026 v2 — see the bullet above).** It was the one thing on the
    screen with nothing to swipe and no cards to count; the chat is reached
    from inside its own deck now. The label still takes a chat off her main
    list in the Chats app — that half is unchanged, and `REVIEW_LABEL` still
    lives in `chatfeed.js` for it.
  - **Hand-built HTML pages are OUT by design** — their items live in markup,
    and a guessed total is a wrong number in front of her.
  - **Not every deck is a review** (the template demos, a browse deck): SKIP
    in the deck's piles view is hers — "not a review" — and stamps
    `reviewHidden` on the page doc. Hidden tiles keep a pile behind the DONE
    tab and un-hide with ↩; nothing is deleted. A superseded page is on no
    list.
  - The injected pill owns the top-right corner (x 326–374, y 14–192), which
    is exactly the first row's third tile — the reason the hidden pile's ↩
    sits over the face's top-LEFT, and the reason nothing tappable may go on
    the right of a row inside that band.
  - Tests: `node scripts/test-review.js` (the decision table, pure) and
    `node scripts/test-review-page.js` (the real page + the real injected
    pill, headless — tabs, the ✕/↩ POSTs, the pill palette).
- **Push notifications** (`push.js`, `/api/push`) — real APNs lock-screen
  notifications, raw HTTP/2 straight to Apple, no Firebase Messaging. Sent on a
  **finished reply** (never a draft) and on a new Compare page. They are the
  Update tab's **doorbell, not its replacement**, so a dropped push is never
  lost news. A tap opens THE CHAT IT CAME FROM.
  **THE BELL IS A WHITELIST — no bell, no buzz (`chatNotifies` in
  `push-gate.js`, Aug 2026, Sophie: "only the ones I clicked the bell on will
  notify me").** One field, `notify`, on the chat's registry doc beside
  `starred`/`bookmarked`, set by the bell in a chat's thread header
  (`POST /api/chatfeed/notify {chat, notify}`). **Absent means silent**, so
  nothing pushes until she taps one. It is asked BEFORE the timing gate below
  and in front of BOTH doors (a finished reply and a new Compare page), and it
  compares `notify === true` rather than truthiness — silence is the safe
  direction for an opt-in.
  **A REPLY ONLY BUZZES WHEN IT IS ANSWERING HER (`push-gate.js`, Aug 2026,
  Sophie: "I don't need a notification when I send a message. I need a
  notification when they respond to my message").** Two comparisons against
  fields already on the registry: she must have spoken since the last push
  (`lastHerAt > pushedAt`, stamped by `POST /reply` with her REAL send time),
  and the reply must have been written after she spoke (`created >=
  lastHerAt`) — a reply whose text predates her message cannot answer it. That
  kills the three shapes that buzzed her at the wrong moment: a **catch-up
  post** (the hook's final pass runs on UserPromptSubmit, so a reply Stop
  failed to post lands the instant she hits send), a **queued message** (the
  turn already running finishes seconds after she sends), and a **chat
  grinding on its own**. **The per-chat 10-minute debounce is GONE for
  replies** — it swallowed the answer to a follow-up she sent four minutes
  later; her message is the gate now. A chat that has never lifted one of her
  messages keeps the old behaviour rather than going quiet.
  **THE BODY IS NEVER HER OWN WORDS (`pushBody`, found live 2026-08-15 from
  her screenshot — this, not the timing, is what she was actually reporting).**
  Two house rules collided: *Answering a question* at the time REQUIRED a
  reply to open with her question repeated verbatim in bold on its own line
  (that rule is retired — same day — but day-old replies still carry the
  shape, and a reply may still open bold on its own), and the push body was
  `tldr || the reply's first non-empty line` — so every answer buzzed her with
  her own sentence, asterisks and all. Leading **entirely bold** lines are now
  skipped (that is exactly the shape the answering rule produces; `**TLDR** —
  …` has ordinary text after the bold and is kept), and the body is stripped
  of markdown. Deliberately structural, not stored: comparing against her
  message would mean carrying hundreds of characters of every chat's newest
  message on the registry doc, which rides the feed read to her phone 276
  chats at a time.
  Tests: `node scripts/test-push-gate.js`, `node scripts/test-chats-bell.js`.
  Dormant until the APNs key exists — only Sophie can mint it.
  **The home-screen widget** reads one small JSON (`GET /api/chatfeed/widget`) and
  must NEVER pull the real feed. **Full details: `docs/modules/inbox-and-misc.md`.**
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
- **Merging a DOCS-ONLY PR? Put `[skip render]` in the squash title** — the
  deploy is skipped and costs zero build minutes; the next code merge ships
  the docs. Full note in the Render section above.
- **Claude merges its own PRs — always, without asking.** Standing permission
  (July 2026). When the work is ready, merge it, then watch the post-merge
  deploys/TestFlight and fix anything that breaks.
- **Multiple Claude chats work these repos in parallel.** Another chat may
  push, merge, or ship a TestFlight build at any moment — main moves under
  you, TestFlight build numbers race, and code you wrote can get rewritten.
  Re-fetch main before merging, never assume the latest build is yours, and
  re-dispatch from your branch (`imageforge_ref` input) if a main build
  buries it.

