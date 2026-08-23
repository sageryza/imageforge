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
   asked, did, next}`. It is **her three questions, ONE SENTENCE EACH** (Aug
   2026: "what I really wanted was the what you asked, what I did, and next
   steps"; three sentences in total, not six) — `line` = the one line her
   archive row shows (≤200). This is what she reads months later to remember
   what a chat was, so it earns more care than the status card. *Measured
   2026-08-14: 73 of her 88 archived chats showed nothing but a name.* You
   cannot be asked for it later — you are asleep by the time she archives.

**Delivering an image — every single one, including a test**
4. **Label it.** `[Penny — the blue Kleenex](url)`, never `[p01](url)` or a bare
   URL. The label becomes what she reviews by.
5. **File the MODEL · QUALITY · SIZE caption** — `prompt:"gpt-image-2 · medium
   · 2K"`. **The size is a required third slot since Aug 2026, and it is the
   TIER — 1K / 2K / 4K, never the pixels** (Sophie: "1K 2K 4K should be a third
   slot in the model/quality required tagging" · "i asked for it to say 1k 2k
   or 4k") —
   gpt-image-2 draws any canvas, so the first two stopped saying what a picture
   is: one prompt at one quality spans 5x in pixels and 3x in price.
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
anything else, **each answered ONCE** · **did she say the word "question"?
then repeat THAT question in bold on its own line and answer under it —
otherwise never echo a question back** (see *Answering a question*) · small
question, short answer · full clickable links · no markdown tables · times in 12-hour
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
- **She can SEE the queue on her phone at
  https://imageforge-q125.onrender.com/desktop** (her ask, Aug 2026: "a way to
  see what things are on my queue and have been checked off… somewhere
  out-of-the-way"). Two hairline tabs, WAITING and DONE; a row carries the
  task's name, when it was queued, who queued it, whether a run FAILED, and
  anything it needs from her, and opens to the whole entry on a tap.
  **DELIBERATELY UNLINKED** — no tile, no iOS wrapper.
  It is READ-ONLY and there is no second copy of the queue: `desktop.js` parses
  the same `docs/desktop-tasks.md` the terminal chat runs from, asking GitHub's
  raw copy first (60s cache) so a task queued two minutes ago is visible before
  Render has redeployed, with the server's own checkout as the fallback. So the
  page needs nothing from you beyond writing the entry properly — and the one
  field it leans on is `**Queued:** <date> by <chat>`, which a test now pins.
  Tests: `node scripts/test-desktop-queue.js` (the parser against a fixture AND
  the real file, then the page in headless Chromium).
- **URGENT is the only interrupt** — she is blocked without it, or it expires.
  Say so plainly in the reply AND queue it anyway, so it survives her not being
  near the computer. "It would be faster" is not urgent.
- **A video url is NOT a desktop task** — `POST /api/ytdl/grab` downloads it
  from the cloud (*Grab a video* under Audio & film, measured live 2026-08-23).
  If a grab ever comes back `blocked:true`, then queue it here.
- **What counts as desktop-only:** anything needing her logged-in browser,
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

## WHAT A CHAT COSTS IS READABLE — and the obvious call hides it
**Measured 2026-08-22, and Sophie's own note that no chat had ever managed
this.** A session's spend is on `get_session` at
`external_metadata.usage.cost_usd`, with `input_tokens` / `output_tokens` /
`cache_read_tokens` / `cache_write_tokens` beside it, and `rate_limit_info`
(`resetsAt`, epoch seconds; `isUsingOverage`) beside that. `list_sessions`
carries the same block for every session at once, which is how you total a day.
- **THE TRAP: `get_session` with NO `session_id` — the natural "describe
  myself" call — comes back with NO `usage` block at all.** Pass your own id
  explicitly (`CLAUDE_CODE_REMOTE_SESSION_ID` with `cse_` swapped for
  `session_`) and it is there. That one difference is the likeliest reason
  this went unfound.
- The number is the session's LIFETIME cost, not this turn's — subtract an
  earlier reading to price one turn. A session created today has a clean
  daily figure; one created yesterday and answered today does not.
- **Two figures worth carrying around** (2026-08-22): a fresh container that
  did nothing but ask "What are we working on?" cost **$1.52** — that is the
  floor for opening a chat at all, before any work — and nine sessions across
  that one day came to about **$45**.
- Nothing here is a model call, so reading it is free.

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
- **Hover** (DNS for ALL THREE of her domains — NOT Shopify, NOT Render):
  - secretlyawitch.com: https://www.hover.com/domain/secretlyawitch.com
  - youwereinmydreams.com: https://www.hover.com/domain/youwereinmydreams.com
  - shouldimakethis.com: https://www.hover.com/domain/shouldimakethis.com
  - **shouldimakethis.com is NOT an ImageForge domain and must not become
    one (measured 2026-08-20).** Its site is a separate Firebase-hosted app
    living in `sageryza/memory-library-react` under `shouldimakethis/`, live at
    https://shouldimakethis.web.app. The domain is currently pointed at THIS
    Render service by mistake (apex `A 216.24.57.1`, `www` CNAME to
    `imageforge-q125.onrender.com`), so it serves the ImageForge hub. **Do NOT
    "fix" that by adding a host-aware branch in `server.js`** the way
    `dream-host.js` does for youwereinmydreams.com — the fix is to repoint DNS
    at Firebase Hosting and DROP the domain from this service's Custom Domains.
    Full checklist: the ShouldiMakeThis section of memory-library-react's
    CLAUDE.md.
- **Cloud environment on ACCOUNT 1 — there is exactly ONE, so the Setup
  script has no wrong box to land in (measured 2026-08-14 via
  `list_environments` on an iOS-origin session).** `env_011CUK6hCggHt2xBmWdmSdND`,
  name "Default", description empty, created 2025-10-20. The two-identical-
  Defaults trap below is an ACCOUNT 2 problem only — don't repeat that warning
  to her when she is pasting on account 1, it just adds a decision that
  doesn't exist. A chat settles which account and environment it is on by
  calling `get_session` on its own session id and reading `environment_id`.
- **Cloud environments on ACCOUNT 3 — TWO again, and the live one had the
  WRONG account number baked in (measured 2026-08-22 via `list_environments`
  + `get_session` from inside an account-3 session).** Both named "Default",
  created 2026-08-21 within 0.04s of each other, i.e. auto-provisioned at
  account setup — the same pair-of-Defaults shape as account 2, and the same
  tell: the one with the EMPTY description is the live one.
  - `env_01VB9pNj6pnXgsTxpyeLv14a` — description **empty**. This is the one
    account-3 sessions actually run in.
  - `env_01UhUAKEXwfZZ8M61whDFu9Q` — description "Default - trusted network
    access". Nothing observed running on it.
  **THE FAILURE HERE WAS NOT A MISSING SETTING — IT WAS A WRONG ONE, AND THAT
  IS THE LOUDER LESSON.** The note below says account 3 was silent because the
  three per-environment settings were unset. Measured from inside: two of the
  three were fine (the Render domain answered 200, and the pasted Setup script
  had installed a CURRENT hook, v14), and the third, `FORGE_ACCOUNT`, was set
  to **`2`** — copied from account 2 along with everything else. So account-3
  chats were never silent at all; they posted, correctly, filed into account
  **2**'s pile. A missing setting makes a chat vanish and someone eventually
  looks; a wrong one makes it land somewhere plausible and nobody does. **Any
  chat can settle its own case in one command:** `get_session` for
  `environment_id`, then `echo $FORGE_ACCOUNT`, and check the two agree.
  - **Fixing it is Sophie's, one field** — the environment's env vars (cloud
    icon → the environment → Environment variables) → `FORGE_ACCOUNT` → `3`.
    Until she does, every NEW account-3 session starts mislabeled again.
  - **AND A SAVED ENV-VAR EDIT IS NOT PROOF IT REACHED ANYTHING — MEASURE IT
    (2026-08-22, hours later).** She added the line, screenshotted the box
    showing `FORGE_ACCOUNT=3` at the top, and reported new sessions still
    weren't tagged. A probe container started 17 minutes after that edit read
    **`2`** and stamped its chat 2. Leading hypothesis, unproven: the OLD
    `FORGE_ACCOUNT=2` line is still further down the same box and wins (.env
    duplicate keys, last one wins) — the box scrolls, so a value added at the
    top hides its own twin. Not the wrong-box trap: the other environment
    (`env_01UhUAKEXwfZZ8M61whDFu9Q`) was measured the same hour and has NO
    `FORGE_ACCOUNT` at all and no hook installed, i.e. genuinely unused.
  - **THE PROBE — how to ask what a NEW session sees, in about a minute.**
    `create_session {prompt: "run echo $FORGE_ACCOUNT and reply with just that
    line"}` (it inherits the calling session's environment), then
    `get_session` on the returned id and read
    `external_metadata.post_turn_summary.status_detail` — the child's answer is
    right there, so nothing has to be read out of the feed. Cost ~$0.50-$0.90 a
    probe. Clean up after: the probe's own hook files a stray chat
    (`POST /api/chatfeed/delete {chat}` trashes it, reversibly) and
    `archive_session` closes the session.
  - **THE DURABLE FIX NOBODY HAS BUILT: `CLAUDE_CODE_ACCOUNT_UUID`.** Every
    container carries it — account 3 is
    `226fb540-b801-46a1-9612-09ffd6a973fe` (measured 2026-08-22) — set by the
    platform, not by Sophie, so it cannot be copied from another account or
    pasted into the wrong box the way `FORGE_ACCOUNT` was. A hook that posted
    it plus a uuid→number map on the settings doc would make the account tag
    self-correcting, with the posted `FORGE_ACCOUNT` as the fallback for an
    unmapped uuid. NOT BUILT — it needs a hook change, and a hook change only
    reaches a session when Sophie re-pastes the environment's Setup script
    (session init has no network, so the pasted copy is static: this container
    ran a hook a day older than the served one).
  - **A chat can fix ITSELF for its own session**, no waiting: prefix its
    hook commands in `/home/user/.claude/settings.json` with
    `FORGE_ACCOUNT=3 ` (settings and hooks are re-read per event, so it takes
    effect on the next one), and `POST /api/chatfeed/account {chat,
    account:"3"}` to tag the registry for turns already posted. The hook reads
    the env var on every post and stamps it, so the prefix is the durable half
    of the two — the manual tag alone is overwritten by the next post.
  - **Chats on account 3 from before this was found are tagged `2` and there
    is no way to tell them apart from real account-2 chats** — the tag is all
    that was ever recorded. The environment was created 2026-08-21, so the
    mislabeled ones are only ever that recent.
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
    is untouched — `/dreamfeed` still serves the page on onrender.
    **ON A WIDE SCREEN THE FEED IS A MASONRY DESK, and the phone is untouched
    (Aug 2026, her own `Dream Feed Web` canvas: "a fun masonry layout, and I
    want it to look good on a desktop. But not on the mobile site").**
    **THE FIRST PORT WAS A GRID AND SHE SAW IT IN ONE LOOK ("you didn't even
    do the masonry layout") — the cause is worth knowing, because it is a
    phone rule leaking into a desk.** `fitCard` cuts a dream's words to its
    PICTURE's height (her rule: side by side, matched so neither leaves a
    hole) — true and right in ONE column, and in columns it is the thing that
    kills masonry, because it makes every card with a picture exactly one
    picture tall, so the columns end level. **On the desk the words are not
    cut to the picture at all**: a flat 12-line fold, so a short dream makes a
    short card and a long one makes a tall card, which IS the layout. The same
    mistake had a second half: the day divider was drawn as a full-width band
    with fresh columns either side, which forces every column to end level a
    second time — it rides INSIDE a column now, as it does on her artboard.
    Two more things not to undo. **The columns are real elements filled
    shortest-first, built in JS — never `column-count`**: multicol re-balances the whole feed
    when one card changes height, and opening a dream changes it by a whole
    picture, so every card after it would jump columns while she reads the one
    she just tapped. And **the desk's whole look rides on `data-shape` /
    `data-ar` / `--r`, written on every card and read ONLY inside `@media
    (min-width:900px)`** — that is what keeps the phone byte-for-byte what it
    was. The desk's header button is deliberately NOT hidden while a dream is
    open (unlike the phone's bottom bar, which yields its seat to the floating
    close): it sits in the flow, so hiding it shrank the header and slid the
    feed up under her mid-tap. Test:
    `node scripts/test-dream-desktop.js` (both widths). The artboard and what
    the port changed: `docs/dream-feed-designs/`.
    **The domain needs three flips, all doable from her phone:** Render → the
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
- `refs/dream-mystery.jpg` — **dream mystery**, her diary-comic page ("1000
  Dreams Per Night"). Movies' "Dreamy pencil", the dream illustrator, the
  zine, Character Creator, and since Aug 2026 the Playground's **Dreamy**
  tile. Was `movie-style.jpg`, and it ALSO existed as a
  second slightly-different crop at `refs/style.jpg` (the zine's own copy) —
  Sophie spotted the duplicate and asked for one file, so `style.jpg` is
  deleted and the zine reads this. **Since Aug 2026 the file is the
  full-quality photo (3370x4096) she downloaded herself** — the old copy was
  a 1170x1364 SCREENSHOT with an Instagram speaker icon baked into its
  corner and the frames cropped. Same filename on purpose: every reader
  loads `refs/dream-mystery.jpg` from disk, so nothing else changed.
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
- **A CHAT THAT NEVER POSTED CANNOT HEAL ITS OWN PAST — back it up on purpose
  (Aug 2026).** The hook BASELINES on its first firing in a session (only the
  latest turn posts), so fixing a silent chat also throws its history away.
  Measured 2026-08-22: **zero chats had ever been tagged account 3** — and the
  reason turned out NOT to be the missing-settings one first written here.
  Measured the same day from inside an account-3 session: its network reached
  the app, its Setup script had installed a current hook, and `FORGE_ACCOUNT`
  was set — to **`2`**. Those chats were posting all along, filed into account
  2's pile. **So diagnose a "silent account" by measuring the three settings,
  never by assuming they are unset** — a wrong value looks like silence from
  the outside and needs no backfill at all, just the right tag. The account-3
  environment ids and the fix are in the ACCOUNT 3 bullet up in *Dashboard
  deep links*. Recover a genuinely silent chat from
  INSIDE it (its transcript exists nowhere else):
  `bash scripts/backfill-chat-history.sh` diagnoses and posts nothing;
  `--go` posts every turn and every message of hers, oldest first; `--account 3`
  tags them when the environment doesn't. Re-running is safe (upsert by turn).
  Full rules in `docs/chats-app.md`; test `node scripts/test-chat-backfill.js`.
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
    that, archiving freezes its **Update card** into one (free, instant, and a
    straight copy now — `updAsked`/`updDid`/`updNext` ARE the three questions
    the summary is made of); failing both it stays blank rather than
    inventing something.
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
  - **ONE SENTENCE EACH IS CUT IN CODE, AND THE LINE IS WHAT SHE ASKED FOR
    (Aug 2026, Sophie: "I thought that each of the questions was supposed to be
    just one sentence but the middle question is longer" → "ok hard cap it" ·
    "4 the default line just use what you asked and then the arrow shows the
    next two bolded fields").** Two rules from one screenshot, both about the
    same duplication. `wrapPartOf` (chatfeed.js) cuts every answer to its FIRST
    sentence on the way in and to 200 characters behind that, at a word
    boundary; `onePart` (chats.html) is its twin and cuts on the way OUT, which
    is what reaches the two the server cannot — a wrap-up written before the cap
    existed, and the live **Update card**, whose own 300-character fields stay
    uncut on the Update tab (that is where the two-sentence middle came from:
    the chat had no wrap-up at all, so the summary was falling back to its
    Update card, which never had a sentence rule). A sentence ends at `.!?` plus
    a space plus a CAPITAL, so "e.g." and "12x18." survive. And **the one line
    is now `asked`** — it used to be `wrapLine`, then what the chat DID, which
    on that same chat put the identical sentence on the line and again under
    "What I did"; her question is the one answer that can never repeat what is
    under it. The arrow opens the other two only, and a summary that is `asked`
    alone draws no arrow. `wrapLine` still holds the line for an older record
    with no three answers. Tests: `node scripts/test-chats-wrapup.js` (the two
    copies run over the same cases so they cannot drift).
  - **THE SUMMARY IS THE UPDATE CARD'S THREE QUESTIONS (Aug 2026 v4, Sophie:
    "I think what I really wanted was the what you asked, what I did, and next
    steps. Since chat already answered those three questions could you just
    switch the summary for that … each of the three sections is about two
    sentences that's six sentences in total. I'd prefer to be about three
    sentences").** So the summary behind the expander is `wrapAsked` /
    `wrapDid` / `wrapNext` — **one sentence each, three in total** — drawn as
    the Update tab's own rows (`sumRows` in `chats.html`, ONE renderer, the
    question bold and the answer not). A prose summary was a fourth shape
    saying the same thing in a form she never asked for.
    - **A chat with no wrap-up falls back to its own UPDATE CARD**, which
      answers the identical three questions — that is exactly what she was
      pointing at. Order: the wrap-up's three → an older prose `wrapUp` → the
      live Update card.
    - **`wrapNext` absorbed `wrapOpen`** — what is next and what was left
      unanswered are one question, and two fields would show her the same
      loose end twice. The unanswered questions fed to the model are still
      DERIVED (`buildQuestions` over the whole thread, `!q.answer`), not read
      out of the digest, so `next` names loose ends that provably exist.
      Old records still render their `wrapOpen` paragraph.
    - **`wrapUp` is still written**, as the three joined into plain prose:
      her phone keeps a cached page for days and 312 chats already carry one
      in that shape, so it stays the fallback every older reader can draw.
    - **NONE of it is `sophieNote`.** Her own note still wins the row — a chat
      must never overwrite a line she wrote, which is why this did not reuse
      her note field even though she described it as "the note at the top".
      Row: `note || wrapLine || need || doing`.
  - **IT ALSO SHOWS IN THE THREAD, UNDER HER NOTE (Aug 2026, Sophie: "i want
    the archive summary to show below my note, as u said, including the down
    arrow to make it longer").** It used to live on the ARCHIVE row and only
    there, which had two consequences she was reading as the summary not
    existing: a home row is `note || wrap`, so a note SHE wrote takes the line
    outright (measured 2026-08-19 — **71 of the 312 chats carrying a summary
    also carry a note**), and the ⌄ is painted only in the archive's LIST view,
    so the **162 of 312 not yet archived** had nowhere to open one at all. In a
    thread there is room for both: her note keeps its line and `.threadwrap`
    sits under it with the same three depths and the same ⌄. `wrapBody()` /
    `wrapToggle()` / `wrapHasMore()` are shared with the archive row — ONE
    renderer, so the depths behave the same wherever she opens them — and the
    Summarize button repaints the thread line (`threadWrap`) the moment it
    writes, since that sheet is opened from the thread's own header.
    Test: `node scripts/test-chats-note-wrap-clear.js`.
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
  - **THREE DEPTHS OF THE SAME STORY (Aug 2026 v2, Sophie: "ideally would be a
    short summary like three lines at most, and then a longer summary behind an
    arrow").** `wrapLine` is the one line on the archive row, the three answers
    are behind the expander, and `wrapLong` is the full account behind a `more`
    inside that. Each is written to stand alone — not an intro, a middle and an
    end — because she stops at whichever depth answers her. A chat too small to
    justify a long version leaves `wrapLong` empty and shows no `more`. The
    fields are asked for shortest-first ON PURPOSE: a truncated answer loses the
    LAST field, so the summary she actually reads is the one least at risk.
    **Each answer is capped in CHARACTERS as well as at one sentence** (140) —
    the lesson the old short summary taught: asked for three sentences and
    nothing else, the model came back at 374 characters, seven lines in the
    expander. A rescued half-sentence is dropped whole rather than shown
    ending mid-word, because a one-sentence answer has nothing to trim back to.
    The SHORT one is capped in CHARACTERS (under 180 = three lines on her
    phone), not in sentences — the first cut asked for three sentences and came
    back at 374 characters, seven lines in the expander.
  - **THE CAP IS ENFORCED IN CODE, BECAUSE THE MODEL CANNOT COUNT (Aug 2026,
    measured TWICE over her real summaries).** Asking for "UNDER 180
    CHARACTERS" produced a median of 223 across 318 chats; tightening the
    instruction to two sentences and re-running still left 169 over the cap,
    the worst at 526 characters — eight lines in the expander. `capShort()` in
    `chatfeed.js` cuts it on the way in: whole sentences up to 180, and a first
    sentence already over the cap kept WHOLE rather than cut mid-thought. It
    guards the FREE-TEXT paths only — the THREE-ANSWER prose above is derived
    from three separately-capped sentences, and trimming it would silently drop
    "what's next". Nothing is lost — the detail lives in the bulleted long
    version, which is what makes trimming safe. **A prompt instruction about
    length is a hope; a length that matters gets cut in code.**
  - **`POST /wrapup/trim` shortens the ones ALREADY on file, free** — pure text
    surgery, no model call, dry by default (`{dry:false}` to write). It skips
    any chat already carrying the three-answer fields, so it only ever reaches
    the one-paragraph summaries written before that shape. It only
    ever shortens `wrapUp`; `wrapLine`, `wrapLong` and `wrapOpen` are never
    touched, so it cannot spend money or reword a summary she has read.
    Re-asking Claude for 169 summaries to fix a LENGTH would have cost about
    $1.70 and rewritten their words as a side effect.
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
    the three questions and their fallback to the Update card, the truncation
    rescue), `node
    scripts/test-chats-archive-summary.js` (the button) and `node
    scripts/test-chats-archive-tags.js` (the tags, the vocabulary and the
    filter row) — the last two headless against the real page.
- **A BOOKMARK CARRIES A NOTE AND A TAG SET — on a MESSAGE AND ON AN
  ARTIFACT, identically (Aug 2026, Sophie: "when i bookmark a message it offers
  a textbox to say whi i'm saving it. shud be same for artifact" · "also, both
  shud now have a set of tag buttons: to read, and 'important' level (1-3) -
  icons, and review finished feature, review bug fix or information/question
  answered").** Keeping either one opens the same box straight away and focuses
  it — the reason is in her head at that moment and nowhere else — and it stays
  under the thing for as long as it is kept.
  - **ONE RENDERER, THREE SURFACES.** `mkBmkEdit` (the note + the tags in ONE
    node) is drawn under a message in a thread, under an artifact's row in the
    Compare tab, and — the tags alone — on a row in the keep-pile, where
    triaging a backlog actually happens. One node so un-keeping takes the whole
    editor with it and a row can never keep half of it; one renderer so a
    message and an artifact can never end up with two different sets of
    controls.
  - **THE WORDS ARE A FIXED VOCABULARY** — `BMK_TAGS` in `chatfeed.js` and in
    `chats.html`, pinned equal by `node scripts/test-chats-bookmark-tags.js`,
    the same contract `TAGS`/`TAG_LIST` have kept since the archive sheet:
    `to-read` · `feature` (finished feature) · `bugfix` · `answered`
    (information / question answered). An unknown word is DROPPED server-side
    rather than refused, so an older cached page can never fail a save.
  - **THE IMPORTANCE IS A DIAL, NOT A FIFTH TAG** — `bmkLevel` 1-3 on its own
    field, in one segmented box: a thing has one level where it can carry
    several words. Each button is a meter of three bars with the ones above the
    level left faint, so the picture says "2 of 3" with no number to read;
    tapping the lit one clears it. Icons, never words — her ask.
  - **A PATCH TOUCHES ONLY WHAT IT NAMES.** Both routes (`POST /bookmark`,
    `POST /page/:id/bookmark`) take `note`, `tags` and `level` and carry no
    keep-flag unless one is sent — so tagging can never un-keep a thing, and
    naming one can never drop its tags.
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
  **AND THE SIX LITTLE MARKS LIVE IN THAT SHEET NOW (Aug 2026, Sophie: "put
  the little icons like the bell and the star and the pin and the trashcan and
  the eye hide symbol … take them out of the main thing and put them in little
  boxes like the … category tag things — don't forget to add the pin").** The
  thread header carried seven controls in one row of unlabelled glyphs; five of
  them (star · bell · keep · hide · delete) moved into Organize as boxed chips
  the same shape as the tag chips, with the PUSHPIN she asked for
  added beside them — so the sheet is one screen of decisions about the chat:
  the four states over the two exits, then her words. The header keeps only
  ARCHIVE (a word, deliberately) and the tag icon that opens the sheet. Two
  things not to undo: **the pushpin is ALSO still on the home row** (her
  earlier ask, "right on the main page not inside of it") — this added a place,
  it did not move it; and **the section labels are back** (`.orggrp`, whose own
  CSS comment always said to bring them back "the moment a second kind of chip
  lands in that sheet") because a mark and a tag are different taps in
  identical boxes. **THE MARKS CARRY NO WORDS — JUST THE GLYPH (Aug 2026,
  Sophie: "the top (pin, star, bell etc) of tagging chats shud be just the icon
  not text").** They shipped as boxes with the name in caps beside the picture,
  which ran the six of them onto three lines of a sheet that is meant to be one
  screen; the box is a 34px SQUARE now — the tap target, not the glyph — and
  the word lives on the `aria-label` and the `title`, so nothing is lost to a
  screen reader. The BOXES stay (that was her earlier ask, and it is what makes
  a mark and a tag read as the same kind of thing).
  `mkOrgMarks` in `chats.html` is all six; each keeps its old
  class name, which is what carries its own colour (the bell stays GOLD, the
  crossed eye and the lit pinhead stay red). Test:
  `node scripts/test-chats-pin-top.js`.
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
  not yours to declare. **The reasons she has given before sit behind a small
  ⟲ on that box** (Aug 2026, her ask) — the field is a live state and is
  deleted with the tag, so the answers are remembered separately on
  `__settings.waitingReasons` and the list rides the feed; nothing given
  before shows no button at all. **AND TWO WORDS NOW CARRY A MANUAL RULE ON THE UPDATE
  TAB (Aug 2026, Sophie: "i think i'll have to do manual rules per tag … more
  coming")** — `waiting for a response` PINS the chat's card above every
  section until she answers or dismisses it (the tag itself is the news, so
  the card shows with nothing new), and `to be reviewed` folds its cards
  behind a **Review** row that opens `/review`, where dismissing one HOLDS the
  chat off her account lists until she reviews or responds. Both are HERS to
  apply — the auto-sorter is forbidden from filing into either — and the rules
  live in ONE table (`TAG_RULES` in `chats.html`) so her next one is a row in
  it. Full rules in `docs/chats-app.md`; test `node scripts/test-tag-rules.js`.
  **ALL THREE UPDATE BOXES WEAR A CHIP ON THIS ROW (Aug 2026, Sophie: "'maybe
  never' isn't on the tag list in the account area" → "give them both a
  chip").** `come back to` had one because it was already a folder of hers;
  `in a minute` and `maybe never` were invented as boxes and had no door
  outside the Update tab. `QUEUE_CATS` in `chats.html` is the join, and the
  two new words appear ONLY while their box holds something — they are not
  seeded into her vocabulary and leave the row when she empties it. Filing is
  unchanged: deferring one update still leaves the chat on the main list.
  Full rules in `docs/chats-app.md`; tests `node
  scripts/test-chats-labels.js`, `node scripts/test-chats-queue-chips.js` and
  the same file as the tags above.
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
- **ANSWERING A QUESTION — answer it ONCE, at the top, plainly. THE BOLD ECHO
  FIRES ONLY WHEN SHE SAYS THE WORD "QUESTION" (2026-08-23, Sophie: "get rid of
  the directions for chats to bold question answers. it ONLY applies if i use
  the word question in my text eg i have a question, or my question is: or
  'quick question' etc. THEN it's bolded and put in the questions tab").** One
  rule with a switch on it, and the switch is hers:
  - **She did NOT say it → answer plainly and move on.** No bold heading, no
    restatement as a required block. If restating helps the answer, restate it
    in your own words. Nothing from that message reaches the Questions tab.
  - **She DID say it → repeat THAT question on its own line in bold, verbatim,
    and answer underneath, not bold.** That is the shape `questions.js` reads
    to file the exact answer under the exact question, so it earns its space
    here — and the rest of the reply is unchanged: this is a heading on the
    answer you were already writing first, never a second pass at it.
  - **Keep the answer SHORT either way**; the length rule above applies to
    answers first of all.
  - **Why it has a switch at all.** The blanket version shipped for one day
    (2026-08-14→15) and Sophie retired it: chats answered her question first
    (the older rule) and then echoed it in bold and answered it AGAIN, so every
    reply carried the same answer twice, and the verbatim echo of her dictation
    read as clutter ("the verbatim is kind of annoying"). It was never the bold
    that was wrong — it was bolding EVERY sentence a detector thought was a
    question, on a list she looked at and said "most of them aren't even
    questions". Her word is what makes the echo rare enough to be worth
    reading.
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
  - **THE GATE IS HER WORD, NOT A `?` AND NOT A DETECTOR (2026-08-23).** A
    message with no `question` in it contributes NOTHING to the list, however
    much it reads like an ask; inside a message that has it, the old heuristics
    still pick WHICH sentence — her dictation often carries no question mark at
    all ("I'm wondering if this should be part of the message"), and "quick
    question, can you make the dashes pink" has neither a mark nor an
    auxiliary, so only her word finds it. **Bare framing hands the row to the
    next sentence** — "I have a question." is a heading, so the row reads what
    follows it. The list is DERIVED on every read, so this changed every
    chat's whole history at once, with nothing migrated.
  - **The cost, named:** a message merely ABOUT questions trips the gate — this
    feature's own conversation would. That is one stray row in a message that
    really was about a question, against the 466 rows the ungated version
    produced, and an unanswered row is never shown anyway.
  - **A PARAGRAPH ENDING IN A COLON IS AN INTRODUCTION — THE ANSWER KEEPS
    READING (found live 2026-08-23 in her tab, two of three rows on one
    chat).** `answerFor` falls back to the reply's opening when there is no
    bold block and no TLDR, and it stopped at the FIRST paragraph — so a row
    read *"Now the size tiers on the server:"* and another ended *"…the
    difference between ChatGPT the app and what we call:"*, both fragments
    that answer nothing, with the real answer in the paragraph the colon was
    introducing. It reads on now, up to three paragraphs. **It only ever reads
    FURTHER — it never DROPS one**: a mid-turn progress line and a real
    lead-in ("Two things:") are the same shape and no honest test separates
    them, so keeping both is merely noisy where dropping would be wrong. This
    path matters less going forward — a question she marked gets a bold echo,
    and `matchBlock` hands back the exact answer first.
  - **THE PILL SAT ON THE QUESTIONS BUTTON (2026-08-23, her screenshot: the
    door read "QUES").** The note row is the thread's LAST header line and it
    does not scroll, so its right end is permanently inside the injected
    pill's fixed corner, and the button is the rightmost thing on it —
    47px of it covered on a 390pt phone. `fitNoteRow()` reserves `--pillgap`
    MEASURED against the pill's real rect, not the home screen's hardcoded
    `192-top` band: in a thread the header is a different height and her
    safe-area inset pushes the pill down (measured off the screenshot: y
    63→222pt, not 14→192). It re-measures on a delay and on resize, because
    the pill is conditional and appears only once there is something to
    scroll. **`elementFromPoint` is the only honest test** — the button passed
    `offsetParent !== null` and every width assertion the whole time it was
    unreachable.
  - `GET /api/chatfeed/questions?chat=` returns them, newest first
    (`?open=1` includes unanswered ones).
  - Tests: `node scripts/test-questions.js` (the extraction and the lead-in
    rule, pure, no network) and `node scripts/test-chats-questions.js` (the
    real page, headless — including the pill collision, verified failing 2
    against the pre-fix page).
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
  waiting for the keyboard's ✓. **RETURN ENDS A SEARCH TOO (Aug 2026, Sophie:
  "only the check mark sends the search on its way… I'd like the return button
  to do the same")** — `enterSubmits` runs the query at once (no debounce left
  to wait out) and drops the keyboard, so what she is left looking at is the
  answer; an `<input type=search>` outside a `<form>` has nothing to submit to,
  which is why Return did nothing at all. Wire it beside `liveInput` on any new
  box, and `sync()` the live handle inside the callback or the blur schedules a
  second identical run. **AND THE HOME BAR REMEMBERS THE LAST SEARCH FOR ONE
  MINUTE** (her ask, same day): reopening the bar inside that minute puts the
  words AND the results back — the same hunt continuing — while the glass
  (a NEW search) forgets them outright and anything older opens empty, which is
  still the default. **HER ORDER RANKS FIRST — bare words still AND anywhere,
  but the RESULTS are ordered (Aug 2026, Sophie: "typing `maybe never` finds …
  the chats where those words appear in the same order as typed should appear
  at the top and the ones where they appear anywhere should appear
  underneath").** The grammar is unchanged and nothing is filtered out; the
  feed's `/search` just sorts into three tiers before recency — **the phrase**
  (adjacent, in her order — exactly what quoting would have found, which is why
  she no longer has to quote), then **in her order** with words in between,
  then **anywhere**. The old sort was recency alone, so `maybe never` answered
  with "saving maybe $3-5 a month" above the message that literally says
  "maybe never". Two things not to undo: the phrase is its own regex pass, not
  a by-product of the left-to-right walk (the walk takes the EARLIEST match of
  each word and would miss an adjacent pair further along), and the scores go
  in a parallel array rather than onto the `searchIndex` rows — those objects
  are the long-lived shared index and a leftover score would sort the next
  query. A one-word query has nothing to rank and is untouched. Test:
  `node scripts/test-search-order-rank.js` (pure).
  **RETURN WAS WIRED INTO THE CHATS APP ONLY, AND THAT WAS
  THE WHOLE BUG (Aug 2026, Sophie asking a second time: "I asked a chat to make
  `return` catalyze a search, in addition to the checkmark — what happened").**
  `enterSubmits` shipped into `public/chats.html` and stopped there; `/search`,
  `/chunking` and `/assets` were left on `liveInput` alone, so Return never
  dropped the keyboard and she was left looking at her own words over the
  answer. `/search` was the worst of the three — its box asks iOS for a SEARCH
  key with `enterkeyhint="search"`, so the keyboard offered a key wired to
  nothing, and it had no `liveInput` either, so it never searched as she
  dictated. **Both helpers are on every live search box now, and each page
  keeps its own copy** (there is no shared page script to hang them on) —
  `chats.html` ×3, `search.html`, `clips.html`, `assets.html`;
  `cuttingroom.html` has always had its own Enter handler, and
  `storyroom.html` is the unpointed old board surface. **AND THE HOME BAR HAS A
  CLEAR THAT IS NOT THE WAY OUT (Aug 2026, Sophie: "there's supposed to be an
  extra button to 'clear' the search, but not dismiss the search box").** The
  action already existed — the GLASS on the left starts a new search — but a
  magnifier does not READ as "clear", so it was a control she had no reason to
  try. A round ✕ inside the field now does the same thing (forget, reset, keep
  the focus), shown only while there are words to wipe, and deliberately a
  different mark from the row's bare ✕ so the two never read as one button
  twice. It is repainted from `run()` as well as from the live handler: dictated
  text and Return's own `sync()` both fill the box without the live callback
  ever firing again. Tests:
  `node scripts/test-search-grammar.js`,
  `node scripts/test-chats-live-search.js`,
  `node scripts/test-chats-search-return.js`,
  `node scripts/test-search-return-everywhere.js` (the other three pages,
  headless — verified failing against the pre-fix pages),
  `node scripts/test-chats-note-wrap-clear.js` (the clear control).
- **WHO SAID IT — the search's FIRST filter, and the pattern the next ones
  follow (Aug 2026, Sophie: "I'd like to add some filters to the search in
  the chats thing that are optional. one would be a filter allowing me to
  search through my messages versus Claude's messages. start with that and
  then we can think of other filters").** Three chips under the search box —
  **All · Mine · Claude** — on the `/chats` home bar AND inside a thread. Her
  words and a chat's answers are two haystacks she hunts for different
  reasons, and a search across both buries the shorter one: she posts about
  40 messages to every 220 replies (measured on one live feed read), so the
  one sentence she remembers saying loses to the twelve replies that quoted
  it back at her.
  - **HERS IS `from === 'sophie'` EXACTLY; EVERYTHING ELSE IS CLAUDE'S.** The
    asymmetry is load-bearing and is the rule the app already used in three
    places (`renderMsg`'s own me/claude label among them). A reply is stamped
    `from:'claude'` today but older docs carry an empty `from` — and those are
    replies, since her messages have only ever reached the feed through
    `POST /reply` and the hook's her_words path, both of which stamp `sophie`.
    So an unstamped record lands on HIS side, and a `from` value nobody has
    seen is never counted as hers: silence is the safe direction for the
    smaller pile.
  - **THE HOME BAR ASKS THE SERVER — `GET /api/chatfeed/search?q=&from=me`.**
    Filtering the 80 results already on screen would answer "my messages about
    the image doc" out of whatever survived the UNFILTERED top-80 — the Assets
    tab's hard-truncate lesson, re-learned rather than re-lived. The server
    holds the whole index and filters BEFORE it ranks, so a hit five hundred
    messages back is still found. **`all` sends no `from` at all**, which is
    exactly what every older cached page on her phone already sends, and an
    unknown value WIDENS to `all` rather than emptying the list — a filter she
    cannot see must never silently delete results.
  - **A chat's NAME was said by nobody**, so the `chatMatches` rows come off
    while a side is picked rather than sitting above results that all share
    one voice.
  - **The THREAD's copy filters what is already rendered** — the thread is
    fully loaded, so there is no truncate to fall through and no request to
    make — and **it narrows with an EMPTY box**: "just show me what I said in
    here" is a whole question, and the one a thread can answer without her
    thinking of a search term first.
  - **NEITHER FILTER OUTLIVES ITS HUNT.** It rides the home bar's one-minute
    memory beside the words (the same hunt continuing), the GLASS resets it to
    All with the query it forgets, and closing a thread's search takes the
    filter off with the words — a thread reopened later silently missing half
    its messages, with no box on screen saying why, is the failure to avoid.
  - **Chips, never a typed `from:` prefix.** She dictates every word into that
    box and would have to say the punctuation out loud. They are the house
    `.catchip`, since a filter chip and a tag chip are the same gesture.
  - **The next filter is a chip in the same row** (`SEARCH_WHO` +
    `whoOf`/`whoParam`/`whoMatches` in `chatfeed.js`, `.searchfilters` in
    `chats.html`) — the row keeps the search bar's own 56px pill reserve, so a
    fourth chip cannot slide under the injected autoscroll pill. **A filter
    that needs the whole history goes to the server like this one; one the
    loaded page can answer honestly may stay client-side — say which you
    built.**
  - Test: `node scripts/test-search-who-filter.js` (the decision table pure,
    then the real page headless — including the chips' right edge measured
    against the pill's column; verified failing against the pre-fix page).
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
  grid is rows wrapping at three across, ruled off from each other, each tile
  a picture with one what-changed line under it and ✕ · PROMPT · ♥; tapping a
  picture opens THE Assets-tab lightbox itself (`/asset-lightbox.js`, shared
  with chats.html), so ♥/✕/notes mirror to the Assets tab and the two agree. **The SERVER auto-files the objective comparisons ITSELF (Aug 2026
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
- **NOTHING STANDS BETWEEN THE SOURCE AND THE OUTPUT (Aug 2026, Sophie).** The
  one principle behind several rules that already exist separately, now named
  so new work inherits it whole. Her words reach the model VERBATIM (anything
  added is disclosed word for word — the prompt rule below). The model's
  output comes back at FULL QUALITY (no lossy encode at birth —
  `node scripts/test-no-generation-compression.js` pins it). A style
  reference is always the ORIGINAL — her scan, her photo at its source
  resolution — never a screenshot of it, and never a GENERATED image standing
  in for it: a generated reference makes the next picture a photocopy of a
  photocopy, repainting the last picture's flaws as if they were style (the
  dream feed's continuity refs did exactly this while they were also
  compressed — the two bugs fed each other). When a page needs a smaller
  file, the copy is DERIVED from the original and the original stays. The
  test for any new step in any pipeline: if it silently transforms what she
  gave or what the model made, the step is wrong — make it lossless, or make
  it loud.
- **NEVER PUT PRE-WRITTEN TEXT IN ANYTHING SHE WRITES IN — unless she asked
  for it (Aug 2026, Sophie, pointing at the "What is it waiting for?" box:
  "it has pre-written text. Can you get rid of that and also make it a rule to
  never add prewritten text unless I ask for it").** A box that holds her words
  ships EMPTY: no example answer, no starter sentence, no suggested phrasing,
  no sample she has to clear before she can dictate. The label or the question
  above the field already says what it is for; an example on top of that is
  words she did not ask for sitting where hers go, and it teaches her a shape
  she never chose. Applies everywhere she types or dictates — every web page,
  every iOS screen, every Compare/deck note box, every sheet.
  - **A placeholder may NAME the field, never fill it and never instruct.**
    `Search all chats…`, `Note…`, `New…`, `Back text` are names and they stay;
    a short question that names the box (`What happened?`) is a name too. Out:
    an example answer (`the API key, her go-ahead, Tuesday…`, `you@email.com`),
    a **sentence** (`Say anything. It is sent word for word.`), and a
    **description of what to write** — `A note to yourself about this chat`,
    `Describe what you want to generate…`, `Tell us what happened`. A name with
    an instruction stapled on keeps only the name: `Name (blank = skip)` →
    `Name`.
    - **THE FIRST VERSION OF THIS TEST WAS TOO WEAK AND SHE CAUGHT IT (Aug
      2026, pointing at the archive sheet's note box: "there's still
      pre-written text … makes me wonder if you really audited very well").**
      It read *could what's in the field be a real answer?* — which passes
      every placeholder that merely DESCRIBES what to write, so
      `A note to yourself about this chat` was filed as a field name and
      survived the sweep. Ask instead: **is this a NAME, or is it words?**
  - **AUDIT THE BOX, NOT THE `placeholder=` ATTRIBUTE.** The same sweep
    grepped only for `placeholder=` and therefore never saw the worst case in
    the repo: `/talking`'s entry box shipped with a whole invented paragraph
    **inside** it ("I told my dad that when you dream of flying…"), live, as
    real content. Three greps, not one — `placeholder=`, a `<textarea>` with
    anything between its tags, and `value=` on a text input. And when you
    remove prefilled content, check what READS it: that paragraph was the
    source of `TEST_DREAM`, so the "↺ reset to test dream" link would have
    quietly blanked her entry instead of restoring anything.
  - **Prefilling with HER OWN saved value is not this** — reopening the waiting
    box on a chat that already says what it is waiting for shows her sentence
    back, and that is her text, not yours. Same for the note she wrote.
  - **It goes beyond boxes**: don't seed a text deck, a doc, or a form with
    sample content "to show the shape". If she wants an example she asks for
    one — and then it is a deliverable, not furniture.
  - Where this already bit: `/vector` shipped with example text in its boxes
    (the `new-tool` skill), Compare pages have carried "Text boxes ship empty"
    since the same lesson, and the waiting-for box carried an example answer
    for a week. Pinned by `node scripts/test-chats-labels.js`.
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
- **FILE THE MODEL · QUALITY · SIZE CAPTION on every image too (Aug 2026,
  Sophie).** The Assets tile's caption is the asset doc's `prompt` field — file
  it as a curated tag like `gpt-image-2 · medium · 2K` via
  `POST /api/gallery
  { assetsOnly:true, chat, url, prompt:"gpt-image-2 · medium · 2K", description }`
  **THE SIZE IS A REQUIRED THIRD SLOT, AND IT IS THE TIER (Aug 2026, Sophie:
  "1K 2K 4K should be a third slot in the model/quality required tagging, in
  the playground and in assets and Meta assets" — then, on the first cut, which
  wrote the raw canvas: "i asked for it to say 1k 2k or 4k").** The pixels are
  the FACT but the rung is what a caption is read for. `size-tier.js` derives
  the tier from pixel count (never a lookup table, so an unseen canvas still
  lands on a rung) and normalises on READ as well as on write, so records filed
  with `1568x2352` display as `2K` with no backfill. The exact canvas is kept
  beside it as `canvas`, because 2K portrait and 2K square are different
  canvases at different prices.
  **A PANEL CUT OUT OF A SHEET SAYS SO INSTEAD — `1/4 (4K)`** (Aug 2026,
  Sophie: "1/4 panel could say 1/4 (4k)"). Its own pixels are the wrong answer
  there: a quarter of a 4K sheet is 1168x1752, which lands on the 1K rung and
  reads as an ordinary small picture, losing the one fact that says what it is
  and what it cost. `cutSize(sheetCanvas, parts)` builds the slot, it passes
  through the normaliser untouched, and `scripts/panel-sheet.js` prints the
  file-ready caption for the sheet and for every piece. Model and quality alone answered the question
  while every surface here drew 1024x1536 and nothing else; gpt-image-2 takes
  any canvas, so the same prompt at the same quality now spans 5x in pixels and
  3x in price and the caption has to say which. It rides all three surfaces:
  the Playground writes `size` onto every creation it files, `post-to-gallery.js`
  takes `--size`, and `meta-assets.js` joins the three parts. **An absent slot
  is left out, never guessed** — nothing on an older record says how big it is,
  exactly as with quality.
  (it upgrades an already-filed tile in place; search matches it).
  **AND A RE-POST CAN NOW CORRECT A CAPTION, WHICH IT COULD NOT UNTIL
  2026-08-23.** The write only landed on a BLANK or a generic `from <chat>`
  record, so re-POSTing to FIX one answered `ok:true, deduped:true` and
  changed nothing, silently — while this file promised it upgraded the tile in
  place. It was found backfilling the cut panels, and it is why every image
  filed before the third slot became the TIER was stuck showing a raw canvas
  that no chat could correct. One rule now, `assetGuard.captionUpgrade`, read
  by the route: **a curated caption always wins, including over another
  curated one** (nothing but a deliberate chat filing ever sends one, so
  curated → curated is someone fixing something), and **a `from <chat>` line
  never overwrites anything** — that is the hook's background catch, and the
  half the old rule existed to stop. Pinned by
  `node scripts/test-asset-guard.js`, which also fails if the condition is
  ever re-inlined into `server.js`. And when a
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
- **BACK TO THE TOP RIDES IN THE PILL'S RAIL (Aug 2026, Sophie: "add a small
  back to top arrow in playground when i scroll down. as well as other long
  scrolls like meta assets").** A small round button under the autoscroll
  pill, shown a full screen down, gone at the top — in the rail rather than
  floating loose, because that corner is the only one reserved on every page.
  It is not the pill's ▲ (which walks up gradually): it jumps, and stops any
  running autoscroll first. Source is `scripts/pill.py` (re-run
  `python3 scripts/gen-pill-inject.py` after editing); full rules in
  `docs/design-rules.md`, pinned by `node scripts/test-back-to-top.js`.
- **TRUNCATED TEXT OPENS WITH AN UNDERLINED WORD, NEVER A BUTTON (Aug 2026,
  Sophie: "the ... button for longer than two line prompt is huge … truncated
  text shud always just be a ...with a line under it that links to open
  (untruncate) or it can say 'more' or 'see more'. never a separate button.
  document that as a ui pattern").** `…` / `… more` / `see more`, underlined,
  inline, inheriting the surrounding type — no border, no padding, no
  background, and never a bare unstyled `<button>` (which draws the browser's
  own box). Still a `<button>` ELEMENT — the rule is about paint, not markup.
  The class is `.moretxt` on every page. The full pattern, and the class-name
  collision that actually caused this (`.morebtn` was the opener AND the
  "Older" paging button in one file, later rule wins), are in
  `docs/design-rules.md`; pinned by `node scripts/test-truncation-opener.js`.
- **No pills.** Text buttons are rounded rectangles — `border-radius: 6px`.
  Circular icon buttons (toggles, dots) are the only exception. **Plus one
  named exception Sophie asked for (Aug 2026): the Chats home screen's
  REFRESH button (`.refreshbtn`) is pill-shaped.** It is the exception, not
  a loosening of the rule — don't round anything else off, and don't "fix"
  that one back.
- **THE PILL DEFENDS ITSELF NOW, AND READS ITS COLOURS FROM YOUR PAGE (Aug
  2026 v3, Sophie: "this is the wrong pill" → "it's still the wrong pill … it
  looks different"). Two rounds of the same bug; this is the settled
  contract.** The pill on a Compare page is INJECTED — the server appends
  `pill-inject.html` to a page it has never met — so **every property the pill
  leaves unset is a hole the host falls through**, and CSS is global whichever
  way the pill arrived.
  - **What actually reached it, measured** by diffing every computed property
    of the pill rendered alone against the same markup with only
    `compare.css` added: **four** — `border-radius` (0 → 6px, from a bare
    `button, .btn{…}` rule at specificity (0,0,1), which turned the capsule's
    three segments into three loose rounded boxes and swallowed the hairline
    dividers), `box-sizing` (the host's `*{border-box}` pulled the 1.5px
    stroke inside, 50px → 48), `line-height` (`#spd` 12px → 17px, so the whole
    pill grew 5px taller) and the buttons' `font`. `.vseg button` had always
    out-specified the host for everything it DECLARED — border, background,
    colour, size, padding — which is why nobody found this for months.
  - **All four are declared in `scripts/pill.py` now** (`.float, .float *`
    pins `box-sizing`/`line-height`/`letter-spacing`/`text-transform`;
    `.vseg button` pins `border-radius:0`, `gap`, `margin`, `font`). **Add to
    that line whenever a new host reaches something — don't re-derive it.**
  - **THE FIVE TOKENS ARE READ FROM THE HOST, `var(--x, fallback)`, never
    baked onto `.float`.** The old copy carried its own palette plus a
    `prefers-color-scheme: dark` block, and an element's own custom property
    beats one inherited from `:root` — so a host could not colour the pill by
    defining the tokens, it had to OUT-SPECIFY with `body .float{…}`, which is
    the ten hand-synced lines `compare.css` was carrying (its own comment
    warned they had to be kept in step by hand). Now the host's `:root` wins by
    itself, exactly as it always has for a baked-in pill; a page that defines
    none of the five still gets the studio cream; and a cream page on a dark
    phone stays cream, because the pill has no dark block of its own. **The
    whole contract for a host page is: define the five tokens.**
  - **IT ONLY APPEARS WHEN THERE IS SOMETHING TO SCROLL** (Sophie: "it should
    be a conditional pill that only appears if there's actually content to
    scroll"). **The check keeps watching — a ResizeObserver, not a check at
    load** — because almost every page here fetches its content after it
    loads, so a one-shot check would hide the pill on nearly all of them.
    `window.__pillSync()` re-runs it by hand; the `forge-pill off` /
    `data-nopill` opt-out still removes the pill outright.
  - Tests: `node scripts/test-pill-host.js` (the whole contract against the
    real `pill-inject.html` and the real `compare.css` — verified failing
    against the pre-fix pill, 8 of 16), plus the per-page pill assertions in
    `test-review-page.js` and `test-brief-page.js`.
- **A GENERATED PAGE'S TEMPLATE IS PROBABLY STALE — CHECK BEFORE YOU RUN A
  `gen-*.py` (measured 2026-08-20, caught one command short of shipping it).**
  Running a generator overwrites its page from the template, so if the PAGE has
  been hand-edited since — which it constantly is, several chats at once — the
  edits are gone. Measured that day by running each generator against a clean
  tree and diffing: **not one of the four was in sync.** `gen-chats.py` would
  have dropped **~300KB** of shipped work (1,577KB → 1,275KB); `gen-writing.py`
  deletes a date entry and its cover; `gen-wall.py` / `gen-storyroom.py` are the
  safe direction (the generator is AHEAD — those two pages were missing the
  pill's `forge-pill`/`data-nopill` opt-out block entirely).
  - **The check is one command and costs nothing:** on a clean tree run the
    generator and `git diff --stat` its page. Empty = in sync, safe. Anything
    else = read the diff and find out which side is ahead BEFORE you commit.
  - `scripts/resync-gen-chats.py` exists to pull the page's edits back into
    `gen-chats.py`'s template and is the documented order (edit page → resync →
    generate). **It currently cannot run** — it looks for the pill blocks
    verbatim to turn them back into placeholders and finds zero, so
    `chats.html`'s pill has drifted from `pill.py` by hand. Fixing that is its
    own job; until then treat `chats.html` and `writing.html` as
    HAND-MAINTAINED and patch them in place.
  - `public/gallery.html` has **no generator at all** — its pill is a hand copy
    nothing can keep in step.
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
  - **AN OVERLAY MUST NOT DETACH THE TAPPED NODE WHILE THE TAP IS STILL
    BUBBLING (Aug 2026, Sophie: "why does auto scroll get triggered when I tap
    out of the light box in the auto compare page" — and she was right that
    this had been fixed once; it had, for a DIFFERENT overlay).** A host asks
    *was this tap the page's own?* with
    `t.closest('[data-nostop],img,figure,.cmp-lb')` on a bubbling click, which
    runs AFTER the overlay's own onclick. `asset-lightbox.js` closed with
    `lb.innerHTML = ''`, so the tapped caption/row had no parents left and
    `closest()` walked a detached subtree — the `[data-nostop]` marker on the
    overlay was unreachable, the tap fell through to the tap-to-TOGGLE, and the
    autoscroll STARTED behind the closing overlay. Tapping the backdrop (the
    overlay element itself, never detached) was always fine, which is why it
    read as intermittent. Two fixes, both kept: the wipe is deferred one frame,
    and chats.html's embedded handler asks the skip list at **pointerdown**,
    while the target is still in the DOM. `compare.js`'s own lightbox only sets
    `[hidden]` and was never affected — that is the difference between the two.
    Test: `node scripts/test-lightbox-nostop.js` (verified failing against the
    pre-fix file).
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
  their data and APIs are real), `/wall` (the everything-feed; no tile
  asked for), and `/desktop` (the desktop queue — she asked for it
  "somewhere out-of-the-way"). The pages still serve at their URLs for a chat
  or a browser.
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
  reporting on any tasks from the same message. **Bold the question back ONLY
  when she used the word "question"** ("I have a question", "my question is:",
  "quick question") — then repeat that question verbatim on its own line in
  bold with the answer under it, and it lands in her Questions tab. Any other
  question gets a plain answer and no echo; restating it in your own words,
  where it helps, is fine. Full rules: *Answering a question* in the Chats app
  section.
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

- **A web-wrapped tool's PAGE owns its header, and now it really does — APPLE'S
  NAV BAR IS GONE FROM EVERY ONE OF THEM (Aug 2026, Sophie: "yes, definitely
  pick B … get rid of the apple native bar").** This line used to end "but a NEW
  tool still ships with the native bar + chevron", and that contradiction is
  what she was looking at: two title strips stacked, Apple's on top with the
  chevron and the tool name, the page's own band underneath holding nothing but
  the "?" because it hid its title. **Use `.forgeWebToolBar(title, failed:
  loadFailed, back: navBack)`** on a web-wrapped tool — no bar while the page is
  up, and the bar back for the failure screen, which has no page to draw one and
  would otherwise strand her on "Couldn't open …".
  - **Swift's one remaining job is LEAVING**, because only Swift knows there is
    a screen behind the web view. `ForgePageHeader.install(into:onLeave:)`
    injects `window.__forgeLeave()`; `public/pagehead.js` draws the chevron and
    walks **`__navBack` → web history → `__forgeLeave`**. That order is the fix
    for "the back button always goes back too far", and it now ships with a
    DEPLOY instead of a TestFlight build — which is the real reason to prefer
    the page's header.
  - **`__forgeLeave` IS THE FEATURE FLAG.** The web half ships on merge and the
    Swift half waits for a build, so `pagehead.js` does nothing at all unless
    the bridge is there. Either half can land first; on the older build the app
    looks exactly as it did.
  - **`__nativeNavBar` IS STILL SET and still means what it always meant** —
    "chrome outside your content owns back, don't draw your own". Ten pages read
    it and pagehead.js is that chrome now. Dropping it would give each of them a
    second chevron, and `#back` means different things page to page (the Story
    Timeline's is a "Stories" button back to the shelf, not a way out).
  - **`history.length` CANNOT DECIDE THE CHEVRON'S LAST STEP (2026-08-20,
    Sophie: "the back button doesn't work … or doesn't go anywhere").** After
    a round trip (Review Queue → deck → back) the page sits at history INDEX 0
    with length 2, where `history.back()` is a silent no-op — so the chevron
    read as dead. pagehead.js stamps each entry's depth onto `history.state`
    (`__forgeDepth`) and leaves the tool at depth 0, with a 400ms bail to
    `__forgeLeave` if a back it did attempt turns out to move nothing. It also
    owns the header pattern now: title centred top-middle (`.fh`, direct
    children only — nested `.htext` stacks are left alone), the chevron in a
    small rounded box, and `.app-header` restored to FLEX (the old
    `display:block !important` un-hide is what stacked Meta Assets' title into
    the row below, under the pill). Tests: `node scripts/test-pagehead.js`.
  - A gated page inside a native tool must be asked for with `?embed=1`, and
    gated pages must not be cached. Test: `node scripts/test-pagehead.js` (both
    builds, headless).
- **Never serve a raw generated PNG to a page** — gpt-image-2 writes ~1MB PNGs
  and the same picture as webp is ~50KB, about 22x. Run
  `node scripts/webp-assets.js` then `webp-assets-verify.js` BEFORE deploying;
  there is deliberately no PNG fallback, so a missing copy is a broken picture.
  **This rule is about the DERIVED DISPLAY COPY, never the original — do NOT
  compress a generation call (Aug 2026, Sophie found it).** Shrinking the copy
  a page loads is right; shrinking the picture at birth is not.
  `output_compression` on an OpenAI images call is LOSSY and OpenAI applies it
  BEFORE the bytes come back, so what it discards never existed on our side and
  **no later pass can undo it** — only a re-draw, which is a different picture.
  It had spread by copy-paste to SIX live surfaces (the Playground's four
  gpt-image-2 styles, the Story Room pad's beat art, the Test Station house
  styles + the committed `public/samples`, and the Talking zine) and every
  original they ever made is 5-6x lighter than it should be: measured on one
  prompt, 281KB compressed vs 1,667KB clean. It showed as graininess on fine
  ink hatching, which the house style is full of. All of them are clean now and
  `node scripts/test-no-generation-compression.js` greps the tree so a
  copy-paste into a new module fails there instead of silently costing a batch
  of originals. Need a smaller file for a page? Derive one — `webp-assets.js`,
  or the `thumbs/` service in `server.js`.
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
  image a run, 2:3, Generate is the stars icon. Six styles: WTR (the only
  Replicate LoRA), ChatGPT, **Dreamy**, Scarry, Pastel, Hoonies (all gpt-image-2
  edits with her own scans attached as style refs, kept in `PL_GPT_STYLES` in
  server.js).
  **DREAMY = `refs/dream-mystery.jpg`, added Aug 2026 at Sophie's ask** ("add
  the other main style reference we use in the chat, which can be called
  dreamy"). It was the most-used reference in the repo with no tile — 270 filed
  images name it (measured 2026-08-20) — so every one of them used to port onto
  ChatGPT and silently pick up sage sandy mirror instead. It shipped carrying
  `scripts/nde-panel.py`'s in-use recipe, the one `style-triptych.js` already
  ran beside the house styles. **THE ANTI-CONTENT RULE IS BOOKENDED**
  (her ask) — it opens the prefix and closes the suffix, because that reference
  is itself a multi-panel comic page full of drawn people and is the one house
  ref the model will happily redraw the CONTENT of; the suffix rides at the
  very end of the sent prompt, after her words. The anti-grid half of the
  suffix is load-bearing for the same reason. No Sophie character card.
  **BOTH HALVES ARE HER OWN DICTATED WORDING SINCE 2026-08-22** ("change the
  default prompt in the dreamy style in the playground to this one that
  follows … the first paragraph is the prefix and the second paragraph is the
  suffix") — paste them verbatim, do not reconstruct them from the history
  below. The prefix shortened to "copy its drawing style" (the old "linework,
  hand-drawn texture, and muted palette EXACTLY" list is gone), and the tail
  moved two clauses BACK to things this file previously recorded her taking
  out — **she changed her mind, so those are history now, not rules**:
  **the BORDER is asked for again** ("Draw it inside a hand-drawn border, like
  the frames in the style reference" — an earlier cut added one and she pulled
  it the same day, "take your borderline out"; this time she dictated it
  herself), and **"Minimal text only." became a flat "no text."** Still gone
  and still unmentioned: **"no caption boxes"** (the reference IS a diary comic
  and its boxes are the look) and **"vertical"** (the canvas toggles, so a
  prompt naming one shape fights the other). The wording before this was the
  dream feed's, imported 2026-08-20.
  **THE OLDER WORDING IS SIGNPOSTED, NOT ORPHANED (her ask: "a note that says
  there's a new prompt in town … so other chats can decide if they want that
  one or the new one").** `scripts/nde-panel.py` and
  `scripts/style-triptych.js` still carry the original, which is still right
  for a full-bleed NDE panel, and each now names `PL_GPT_STYLES.dreamy` and
  says the pick is deliberate. **Writing a new surface against this reference?
  Read both and choose; if you reword one, say which you started from.** A
  silent old copy is exactly how this tile shipped a day-stale tail. Pinned by
  the test. Both halves have moved since — the 2026-08-22 rewrite is the first
  time the PREFIX changed, so an older doc quoting it is stale too.
  **THE "NO TEXT" TOGGLE — Dreamy only, off by default (Aug 2026, Sophie: "add
  a no text line to the prompt that can be toggled on and off with a little
  toggle").** A little dark-when-on button beside Prompt. It **SWAPS** the
  tail's own text clause (`no text.` since 2026-08-22; `Minimal text only.`
  before that) for the spelled-out ban — no letters, no numbers, no captions,
  no handwriting — rather than appending a second sentence arguing with it.
  Dreamy is the only tile that shows it: every other style's baked tail already
  bans text outright, so a switch there would change nothing.
  `PL_GPT_STYLES.dreamy.noText {from,to}` + `applyNoText()` own it; the swap is
  applied AFTER her prefix/suffix override and is deliberately NOT counted as
  her edit, and if her edited tail no longer carries the clause the line is
  appended instead. `/api/promptlab/styles` says which styles offer one, so the
  page holds no copy of the wording. **Rewording the tail's text clause without
  moving `noText.from` would make the toggle silently append instead of swap** —
  `node scripts/test-playground-notext.js` pins the two together.
  **THE PROMPT BUTTON — see what is wrapped around her words, and change it
  (Aug 2026, Sophie: "add a prompt button so you can see what's being added
  and … allow yourself to edit it as well").** Two boxes under the style row —
  what goes BEFORE her words and what goes AFTER — with her own text shown in
  between where it lands, and a Reset.
  - **THE TEXT IS SERVED, NEVER COPIED INTO THE PAGE** (`GET
    /api/promptlab/styles`, which MUST stay registered above
    `/api/promptlab/:id` or Express answers "run not found"). server.js owns
    what is actually sent; `promptlab.html` deliberately holds no copy, which
    is the whole reason the old "Sent as" preview was removed. A test pins
    that the page has no prefix of its own.
  - **Her edit is per STYLE and kept in `localStorage`**, and an edited style
    MARKS ITS BUTTON — she can never be running her own wording without the
    page saying so. Editing both halves back to the house text drops the
    override rather than storing an identical twin. `promptEdited` is stored
    on the run, and `fullPrompt` has always stored the exact text sent.
  - **Only a STRING overrides a half.** An absent field keeps the baked text —
    so an ordinary run is byte-for-byte what it always was — and an empty
    string genuinely deletes that half, because she may want no tail at all.
  - **This is NOT pre-written text in a box she writes in.** The fields hold
    the LIVE VALUE that will be sent, the way reopening her waiting-for box
    shows the sentence she already wrote. Her own words go in the main box,
    which still ships empty.
  **A PHOTO REFERENCE OF HER OWN — the file button (Aug 2026, Sophie:
  "Freeform has the ability to upload a photo reference, but playground
  doesn't … in the case of dreamy or watercolor, where they already have
  references, it will go as the second reference automatically").** One photo
  per run, picked from the file button beside the Sophie card — deliberately
  NOT a library like Freeform's, because the Playground's whole point is a
  fixed recipe per style with one thing changed at a time.
  - **IT RIDES LAST, after the style refs AND after the Sophie card**, and
    that order is load-bearing: `characterLine` says "the second attached
    image is a character reference", so slotting the photo in front of her
    card would make that sentence describe the wrong picture. `PL_GPT.photoLine`
    names it as "the LAST attached image" for the same reason — it is true
    however many references precede it.
  - **THE LINE IS DISCLOSED, like everything else wrapped around her words.**
    It is served by `GET /api/promptlab/styles` (never copied into the page)
    and the Prompt panel prints it, with the character line beside it,
    whenever one is actually attached. Read-only there: taking the photo off
    is what removes the line, not editing it.
  - **NOT PERSISTED across loads** (same reasoning as quality and the canvas)
    — a photo attached last week silently riding today's run is exactly the
    hidden ingredient the panel exists to prevent. It survives between runs in
    one sitting, so a re-roll is one tap. The run doc keeps `photoRef` and the
    run's card says **photo ref**, so two runs of the same words are told apart.
  - **A small png/jpeg is sent BYTE-FOR-BYTE.** Only a photo over 1600px or
    over ~9MB of base64 is redrawn through a canvas — a phone photo is 4-12MB
    and often HEIC, which the model refuses.
  - **gpt-image-2 only.** The WTR LoRA takes a trigger word and has no
    attachment slot at all, so the button comes off there rather than sitting
    there doing nothing. Test: `node scripts/test-playground-photo-ref.js`.
  **TWO QUALITY LADDERS, AT THE RIGHT END WITH GENERATE (Aug 2026, Sophie:
  "add a little oval next to the pyramid, colored on top, white empty on
  bottom, signifying medium, and high. when pressed, it kicks off 1 medium and
  1 high job" · "move the pyramid and the oval to the right side so they're
  next to the generate button but still to the left of it" · "make the generate
  button a square").** A ladder is one tap that draws the same prompt at more
  than one quality, and each wears a picture of HOW MANY and at what tier,
  never a word: the **pyramid** is two lows along its split base with the
  better one filling the cap (~10¢), the **oval** is medium under high with the
  top half filled (~21¢ portrait, ~26¢ square). The oval has NO vertical
  divider on purpose — two tiers, one draw each; the split base is what says
  *two lows*. Both go through one `ladder()` starter, and `startRun`'s `q`
  overrides the toggle for that run only, so **neither ladder moves what the
  knob says**.
  - **The two ladders and Generate are ONE group (`.gogroup`), and it has to
    be a group**: `.controls` wraps, so `margin-left:auto` on each button
    separately would right-align whichever ones happened to share a line and
    scatter the rest. The auto margin moved off `.go` onto the group.
  - **Generate is a 38×38 SQUARE** — the box the seed button already is, so the
    three taps at the right end read as one set rather than a wide slab beside
    two small ones. The 6px radius stays: the house rule is rounded rectangles,
    and sharp corners there would be the only ones on the page.
  - **The style picker is NOT filled dark any more** (her ask, same message:
    "just white, even tho it's selected"). It was painted like the old lit
    tile so the selected style read as chosen — but there is only ever ONE
    picker on the row, so there was nothing for it to read as chosen against,
    and a black slab was the heaviest thing on a page of pale controls. The
    INK BORDER stays; it is what still separates the one control that decides
    the run from its pale neighbours.
  - Test: `node scripts/test-playground-controls.js` — the headless half IS
    the test here, because every one of these asks is a measurement: "coloured
    on top" is the filled path's `getBBox` against the oval's centre (a wrong
    arc sweep flag is perfectly valid markup that fills the wrong half),
    "square" is two numbers that must match, "to the left of it" is an x
    coordinate, and the three share a line by their CENTRES (the group centres
    them and the ladders are shorter, so equal tops would be the wrong
    question).
  **THE CANVAS IS REMEMBERED — this REVERSES the note below it (Aug 2026,
  Sophie: "make it not default to square, but just whatever the last option
  was").** This file said a shape she picked once must not carry into every
  later visit; she has since asked for exactly that, so the old reasoning is
  history rather than a rule. `promptlab_canvas` in localStorage, written on
  the TAP rather than on the run (the shape she is looking at is the one she
  comes back to), with `square` surviving only as the FIRST-EVER default and
  as the fallback for an unknown stored value. **QUALITY IS DELIBERATELY NOT
  CHANGED WITH IT** — she named the canvas, and a remembered `high` is
  16.5-21.1¢ a tap arriving unasked, where a remembered shape costs nothing it
  did not cost last time.
  **QUALITY IS THE ACCOUNT SWITCHER'S THREE-WAY TOGGLE, IN BLACK (Aug 2026,
  Sophie: "make the low medium high drop down in the playground into the exact
  three way toggle that the account switcher uses … but black not red. and put
  the initial of the choice - L, M, or H").** It was a native `<select>`, and a
  picker you have to open to read hides which quality a run is about to spend.
  `.qtog` in `promptlab.html` is `.swi` from `chats.html` VERBATIM — 48px track,
  26 tall, an 18px knob, three stops DERIVED from `--gap` — with the track ink
  (`#2b2622`) instead of the rose and the letter riding the knob (`content:
  attr(data-i)`, so the letter and the position are one element and cannot
  disagree). Tapping anywhere moves to the next notch and WRAPS, exactly as the
  account one does, so low → medium → high → low. **The two rules live in
  different files with no shared stylesheet, so nothing but the test would ever
  notice one drifting from the other** — `node
  scripts/test-playground-quality-toggle.js` pins them property by property,
  asserts the colour as a DIFFERENCE (a copy-paste must not bring the rose
  back), and reads the knob's real x at each stop in headless Chromium. A
  fourth quality is an entry in `QUALITIES` plus one CSS rule of the same
  shape; nothing counts the notches. Still not persisted, same as before.
  **PORTRAIT OR SQUARE, opening on SQUARE (Aug 2026, her call).**
  `PL_GPT.sizes`; the run carries `canvas`, and an unknown value still lands on
  a real size server-side, never an invented one. **The square is the DEARER
  one** — 0.6¢/5.3¢/21.1¢ against 0.5¢/4.1¢/16.5¢, the inversion the price
  table warns about — so both buttons print what they cost; she picked it as
  the opening default knowing that. **It is PERSISTED since Aug 2026** (see
  THE CANVAS IS REMEMBERED above) — this line used to read "not persisted,
  same reasoning as quality" and she asked for the opposite.
  gpt-image-2 only — the LoRA has no baked prefix to show and rides
  `aspect_ratio` instead, so both controls hide on WTR.
  **AND THE SIZE TIERS BESIDE IT — 1K · 2K · 4K (Aug 2026, Sophie: "adding the
  size as a toggle in the playground for things I want to print versus things
  I'm using for like videos").** `PL_GPT.res`, a second segmented group next to
  the canvas; the run stores `res`. **Every image surface in this repo had been
  pinned to 1024x1536 or 1024x1024 — the only three sizes the OLD gpt-image-1
  accepted.** gpt-image-2 takes any canvas inside its constraints (long edge
  ≤ 3840, both edges a multiple of 16, ratio ≤ 3:1, 655,360–8,294,400 pixels);
  the model id was swapped and the size lines were never revisited. Sizes are
  CONTINUOUS, not three presets — "2K" and "4K" here are just the names for two
  useful budgets.
  - **The tiers are the biggest EXACT 2:3 and 1:1 canvases at each budget**, so
    a tier is the same picture with more pixels and never a different crop. An
    exact 2:3 with both edges a multiple of 16 forces w=2m/h=3m with m itself a
    multiple of 16 — which is why 4K portrait is **2336x3504** and one step up
    (2352x3528) is 3,456 pixels over the cap. The squares land exactly on their
    budgets: 1920² IS 3,686,400 and 2880² IS 8,294,400.
  - **1K IS STILL THE DEFAULT AND STILL WHAT AN OLD PAGE SENDS.** A phone
    holding a page cached from before this shipped sends no `res` at all, and
    the absent value must land on the old canvas rather than a dearer one.
  - **NOT PERSISTED**, same reasoning as quality and the canvas — 4K at high is
    47¢ a picture, and that must never be something she is spending without
    having just chosen it.
  - **The tooltip prices are SERVED, never copied into the page** —
    `PL_GPT.res` carries a MEASURED `cents` per quality (the table in
    `docs/modules/pictures.md`) and a test pins that promptlab.html holds no
    copy of a cost figure. Same rule as the baked prompts.
  - **Re-rendering an existing run at another size** is
    `node scripts/playground-rerun-size.js <runId> --size WxH` — it re-sends
    the stored `fullPrompt` verbatim and prints the real `usage`.
  Test: `node scripts/test-playground-res.js`.
  **MODERATION IS `low` ON EVERY gpt-image-2 EDIT (Aug 2026, Sophie's call).**
  `openaiImageEditRefs` sends it by default. The filter is STOCHASTIC on
  identical input — a Dreamy prompt of hers drew fine at two sizes and was then
  refused twice in a row minutes later with `safety_violations=[violence]` (raw
  meat and a bare chest, in a cartoon). A refusal costs the run and reads as a
  bug. **There is no `none`** — `auto` and `low` are the only two values, and
  a handful of categories are refused at every setting, so this cannot be
  turned off further and must not be described to her as if it could.
  **THE ROW WRAPS, and that is load-bearing:** with the Prompt button and the
  toggle added, flex squeezed the toggle to 50px on a 390pt phone — "Portrait"
  bled out of its box and **the Square half was clipped off the row**, which is
  why she reported not knowing how to change it. `flex-wrap` plus `flex:none`
  on the segmented groups; the test measures the real boxes, because
  `isVisible()` was true the whole time it was unusable.
  **PORTING AN IMAGE IN FROM ASSETS SAYS WHETHER IT IS HONEST
  (`public/playground-port.js`, served to the page, Aug 2026).** The lightbox's
  Playground button carries the content half, a tile, the quality and
  `sameref=1|0`; the Playground draws one line under the style row saying
  whether this tile really carries the reference and style prompt that picture
  was made with. **The tile is matched on EVIDENCE, never on vibes** — the
  reference FILENAME as the style half names it (old names included:
  `movie-style.jpg` still outnumbers `dream-mystery.jpg` 174:84) or a verbatim
  fragment of that tile's own baked prefix (29 Pastel and 8 Hoonies runs quote
  their prefix and name no file). The old router was four loose regexes and
  sent 224 pictures whose prompts merely said "watercolor wash" to the WTR
  LoRA, a different engine, with nothing on screen admitting it was a guess.
  Live totals after the fix: 2,690 of 3,791 portable images identified, 1,101
  honestly unknown. **A style table now exists in THREE places** —
  `PL_GPT_STYLES` (server.js, owns the sent prompt), `STYLES`
  (promptlab.html, the picker) and `PORT_STYLES` (playground-port.js, the
  routing) — pinned equal by `node scripts/test-playground-port.js`, which also
  checks every prefix fragment is verbatim in the real prefix.
  **THE TILE WALL IS THREE TO A ROW, AND THE LIGHTBOX'S SIDE ARROWS ARE A
  SMALL BAR IN A BIG ZONE (Aug 2026, Sophie: "make playground thumbnails 3 to
  a row not 4" · "the side arrow bars - buttons shud be smaller, tap targets
  bigger. tap anywhere on the right or left of the screen in the image area
  and it switches left or right. arrow bars are just about an inch tall").**
  Four across stopped being enough to judge a picture by once the tiles were
  no longer cropped squares. In the lightbox the two are now separate things:
  `.lbnav` is a transparent 28% strip running the full height of the image
  area — **over the picture, which is the point** — and `.lbbar` is the 26x96
  chip drawn at its outer edge. The 52px of side padding the old 58vh bars
  needed went with them, so the picture is bigger too. The stage
  (`.lbstage`) exists so "the image area" is a real box: the zones are sized
  to the picture, never to the window, so the caption and the ♥/✕ row under it
  are never covered. Hidden at the ends of the feed takes the ZONE with it, so
  a tap there closes exactly as it did before. Test:
  `node scripts/test-playground-liked-arrows.js` — the chip measured small,
  the zone measured over the picture, and the edge tap asked with
  `elementFromPoint`; its fixture had to become a REAL-SIZED 2:3 picture,
  because the lightbox sizes itself to the picture and a 1x1 pixel put the
  zones nowhere near it.
  **THE ✕ FILTER BESIDE THE HEART (Aug 2026, Sophie: "can u also add a button
  next to the heart that hides anything i've 'exed'").** The heart's opposite
  and its twin — a filter over PICTURES in whichever view she is in, sticky,
  and a run left with nothing showing drops out of the list. The two stack
  without arguing: hearts-only has already dropped every ✕'d picture. **Lit,
  the ✕ takes the GREY of the dislike badge, never the rose** — the heart
  keeps only what it names and this one drops it, and two identical-looking
  filters read as two of the same thing. **They share ONE segmented box now**
  (the List/Tiles pattern), and that is not only tidiness: the feed row
  reserves 56px for the injected autoscroll pill, and a second standalone 38px
  button with its own margin left the search box at 80px, clipping its own
  placeholder to "Searc" — one box of two 34px buttons gives it back. Test:
  `node scripts/test-playground-hide-x.js` (headless — including the
  placeholder measured against the room the input actually has, because a
  clipped field passes both `isVisible()` and a width assertion).
  **EVERY TILE WEARS ITS OWN PICTURE'S SHAPE (Aug 2026, Sophie: "i kind of
  want the playground to show portrait aspect ratios to match my 2:3
  pictures").** The wall forced `aspect-ratio: 1 / 1` and `object-fit: cover`
  did the rest, so a 2:3 picture — nearly everything she draws here — lost a
  third of itself to a crop on the one screen meant for scanning them; the
  list view forced 2/3 the same way and cropped the square runs instead. The
  ratio rides on the cell as `--ar`, written from the run's own
  `aspectRatio`, with **portrait the fallback** for a run from before the
  canvas toggle. **`minmax(0, 1fr)` + `align-items: start` on both grids is
  load-bearing** — a bare `1fr` is `minmax(auto, 1fr)` and a square cell's
  automatic minimum width is TRANSFERRED from the row's height through its
  own aspect ratio, so one square on a row of portraits blew its column out
  to 132px and squeezed the other three to 73 (measured). A waiting
  placeholder carries the shape its picture is about to be (`ar` on the
  pending entry), so the wall does not re-flow when it lands. Test: `node
  scripts/test-playground-tile-shape.js` — a MEASUREMENT of the real boxes,
  because `object-fit: cover` makes a wrong ratio look like a fine picture
  (verified failing 4 of 8 against the pre-fix page).
  **A SEARCH BAR SITS IN THE ROW THAT WAS ALREADY THERE (Aug 2026, Sophie: "a
  little search bar that fits in the space between the heart toggle (next to
  tiles/grid)").** `flex: 1` between the heart and the 56px the autoscroll pill
  owns, so nothing moved to make room and the row still fits one line on a
  390pt phone (measured: 126px of box). It filters by RUN — her words belong to
  a run, not a picture — so list view drops whole boxes and tiles drops that
  run's pictures off the wall; it stacks with the heart (search picks the runs,
  the heart the pictures) and hides "Older" while it is running. Searchable:
  her words, the style by its LABEL and its key, quality, the canvas by its
  ratio AND by the word on the button, `photo ref`, failed/cancelled.
  **IT ASKS THE SERVER, and that is the point** — `GET /api/promptlab?q=`
  scans the whole run history (a few hundred ~1KB docs, capped 1500, held
  60s) because a box that only filters the loaded page answers "nothing
  matches" for everything behind the 40-run window: the Assets tab's own
  lesson, re-learned rather than re-lived. The loaded runs are still filtered
  INSTANTLY while that lands. **The two haystacks are pinned equal by the
  test** (`runHay` in promptlab.html, `promptlabHay` in server.js) — if they
  drift, the view changes under her a beat after she types. The house grammar
  and both house helpers (`liveInput`, `enterSubmits`) are wired, and the box
  is deliberately NOT sticky, unlike the view and the heart. Test:
  `node scripts/test-playground-search.js`.
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
  ffmpeg stitch, ~$1.35 for a 12-scene film.
  **THE ANIMATE BUTTON CAN RUN WAN 2.7 SINCE AUG 2026 (Sophie's ask), AND IT IS
  NOT A FREE UPGRADE — it is priced per SECOND** ($0.10/s at 720p, $0.15/s at
  1080p, so 50¢ and 75¢ for the standard five seconds against draft's 16¢).
  What it buys, measured live rather than read off a page: real
  first-and-last-frame conditioning (`last_frame` is a TARGET, where 2.2's
  `last_image` is only a hint), 2-15s instead of a fixed 5, and no 480p at
  all. What it costs besides money: **it writes its own audio** when none is
  handed to it and there is no way to ask for silence, so a 2.7 clip stitched
  under her voice must have its track dropped deliberately. The quality menu
  on the animate button is four wan rows now (480p 6¢ · 720p 16¢ · 720p 50¢ ·
  1080p 75¢) — kling is still a tier on the route and still on the per-scene
  menus inside a movie, it just no longer holds two of those four rows.
  **A MODEL'S INPUT KEYS RIDE ITS `shape`, NEVER ITS TIER NAME**, in one
  builder (`videoInput`): a wrong key does not fail loudly — the model ignores
  it, draws something unconditioned, and the bill arrives anyway. Test:
  `node scripts/test-video-models.js` (pure). Also holds **Dreams** (the staged
  dream -> comic pipeline, where a gpt-image-2 SAFETY REFUSAL is terminal and the
  page is redrawn with its narrative softened — never retried), the character
  anchor, dream-bridge clips, the zine, and quick-animate. Editing is free
  server-side ffmpeg; every re-roll is kept.
  **EVERYTHING IT MAKES GETS OUT OF THE MOVIES TAB (Aug 2026, Sophie: "they
  just stay there. theres no download button and they dont appear in my
  creations").** Every finished video — scene clip, bridge, quick animation,
  stitched cut — files into "My Creations" as `type:'clip'` (a stitch is
  `'film'`), carrying a POSTER, because there is no frame the grid can decode
  out of an mp4 and a video creation without one tiles as a blank square. The
  gallery is in the OTHER Firebase project, so server.js hands movies.js the
  writer at mount time (`movies.init({ fileCreation })`) — filing is
  fire-and-forget and never awaited by the render. The download button lives on
  `ClipPreviewSheet`, the ONE player every clip in Movies opens in, and
  `VideoSaver` (beside `PhotoSaver`) is the one video-to-Photos path: Photos
  takes neither a remote URL nor decoded frames, only a downloaded FILE as a
  `.video` resource.
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
- **Assembly** (`assembly.js`, `/api/assembly`, page at `/assembly`, iOS tile
  under the FILM filter) — put pieces IN ORDER on a timeline, then bake one
  film. Sophie's ask (Aug 2026): like the Story Room's scratch pad but for
  CLIPS — the arrangement rides a **timeline at the bottom**; tapping a piece
  lights a **place indicator in every gap**, and tapping a gap drops it
  between the two already there. Tapping a timeline piece picks it UP (the
  same indicators move it; Take off removes it back out of the film).
  Everything is a tap, nothing drags. **AN OPEN PROJECT'S SURFACE IS ITS OWN
  PIECES, NOT THE LIBRARY (Aug 2026 v4, Sophie: "all these other chunks or
  clips compete for my attention … think carefully if moving them out of the
  way is the best fit, versus detaching or creating a separate surface, with
  the clips to go in").** The main of the screen is the POOL — everything she
  has brought in, READY TO DROP IN, big tiles; the Chunking library sits
  behind its own door (**From the shelf**, a picker sheet with the house
  search — tapping a clip there closes the sheet with the clip IN HAND, ready
  to place; the library loads lazily, never up front). The first cut put the
  whole library on the surface and her nine uploads were invisible in a
  cramped dock strip. **It costs nothing** — the library is
  `forge-clip-library` read-only, and Render is ffmpeg on our own box. One
  doc per assembly (`forge-assemblies`); the arrangement saves WHOLE (order
  and membership change together — an insert is both).
  **AN ITEM IS A CLIP OR A STILL, AND THE DUMP IS THE ONE-BUTTON DOOR (Aug
  2026 v2, Sophie: "i made images in the playground and animated them w
  midjourney and wanted to dump them in — some were just images, some
  animated. one button and they all go into a project, ready to arrange").**
  She dumps the album from her phone (photos and videos together), taps **Add
  from the Dump** inside an assembly, picks the album, and everything in it
  lands **in the TRAY, in album order — NEVER straight onto the timeline**
  (2026-08-21, her live report the first version earned: "they're supposed to
  be above the timeline so i can drop them in. i'm confused"; the import is
  deduped by id, so re-importing — or importing the album her own uploads
  made — doubles nothing). The tray IS the pool — the labeled main surface
  above the timeline (it began as a cramped strip in the dock and she
  couldn't find her own uploads in it) — and new assemblies are named with
  her Pacific date AND time ("Assembly · Aug 21 · 9:50 pm") — five identical
  "Assembly · Aug 21" rows is how her uploads "disappeared" into the wrong
  project that night. A still carries `hold`
  (seconds on screen, default 4 — pick it up on the timeline and the
  2s·4s·6s·8s chips set it) and renders like the pad film's beat art, held on
  the canvas over silence. Imported items reference the Dump's own urls — nothing is copied
  and nothing is filed onto the Chunking shelf (the harvest skips `drops/` on
  purpose; here she picked them herself). A still's timeline thumb is a
  DERIVED copy via `/api/story/thumb` — the original is never touched.
  **AND UPLOAD IS ONE BUTTON, IN THE PAGE (Aug 2026 v3, Sophie: "couldn't it
  just be one. a button in assemblies where u can upload the footage and it
  appears above the timeline, ready to drop in").** Upload opens the phone's
  own picker (photos and videos together); each file rides the Dump's
  `/api/drop/upload-file` (HEIC→JPEG, md5 dedupe, video posters — bytes never
  stored twice, the batch shares one Dump session/album named after the
  assembly) and lands in the doc's TRAY, a strip just above the timeline, as
  it arrives. A tray piece arms like a shelf clip — indicators light, tap a
  gap, it drops in and leaves the tray; Remove discards it. The tray saves
  WHOLE alongside the arrangement (`POST /:id/clips {clips, tray}`), so a
  half-placed batch survives leaving the app; the render reads `clips` only.
  **The render is
  the scratch-pad film's recipe, not a fresh one**: every clip normalized onto
  ONE canvas (the first clip's frame, evened, long edge capped 1280 — 30fps,
  setsar=1, yuv420p) as its own segment so the concat demuxer joins with
  `-c copy`, and audio as per-segment PCM cut/padded to each segment's REAL
  encoded length, concatenated sample-exact, AAC-encoded ONCE at the mux —
  per-piece aac priming walks the sound off the picture (the pad's measured
  finding). A clip re-resolves its CURRENT library doc at render time, so a
  re-baked chunk renders from its newest file. Renders never overwrite
  (`assembly/<id>/film-<n>.mp4`, capped 12, newest first) and `assembly/` is
  on the clip harvest's SKIP_PREFIXES — a film made OF clips must not harvest
  back onto the shelf as a clip. The round ▶ plays the arrangement clip-by-clip
  in the browser as a rough preview; the render is the real join.
  Tests: `node scripts/test-assembly.js` (the place-indicator arithmetic pure,
  then the real page headless). **Full details: `docs/modules/audio-and-film.md`.**
- **Film Editor** (`filmeditor.js`, `/api/filmeditor`, page at `/filmeditor`,
  iOS tile under the FILM filter) — **the one surface that CUTS video**, built
  Aug 2026 from Sophie's own Claude Design canvas (`docs/film-editor-design/`,
  which also carries the other chat's gaps file — the build fixed every bug it
  names). Her tap-only editor: split · trim in · trim out · earlier · later ·
  sync · delete, a transport that steps ±1 frame / ±1s, ONE audio track with
  an offset. **A piece is a REFERENCE into a source file (url + in/out), so
  every tool is non-destructive metadata** — a split is two references into
  one file, a trim can always be trimmed back out, and the render is the only
  moment anything is actually cut. **The selection FOLLOWS the playhead**
  (the prototype's worst bug — split/trim always act on the piece she is
  looking at), refused taps say why in the quiet line, and two swapped
  `<video>` elements keep a source boundary from flashing black. Sources
  arrive through the Dump's `/api/drop/upload-file` (md5 dedupe, posters —
  the assembly pattern), the audio track through `/api/audio/upload-file`;
  lengths are read CLIENT-side before a piece joins the timeline, so an
  undecodable file reports itself. **The render is the scratch-pad recipe via
  assembly.js's own exports** (`targetFrom`/`segmentFilters` — one canvas,
  per-segment PCM, AAC once at the mux) with `-ss/-to` as INPUT options for
  the trim (source timestamps, accurate under a re-encode) and the track
  mixed at the mux with `normalize=0` (amix's default halves both voices).
  One download per unique source url — twelve pieces of one recording cost
  one download. **It costs nothing** — ffmpeg on our own box; the only paid
  side-effect is the audio library's unconditional transcription of an
  uploaded track (~$0.006/min, once ever per file). One doc per cut
  (`forge-film-edits`); arrangement + audio save WHOLE (a split changes two
  pieces and the order at once). Renders never overwrite
  (`filmeditor/<id>/film-<n>.mp4`, capped 12) and `filmeditor/` is on
  clips.js's SKIP_PREFIXES. The film icon top-left (a dead control in the
  prototype) opens the films sheet — Render, the job line, every render kept.
  The page is ONE screen, never scrolls, NO pill. Story Room = think about
  the story, Assembly = arrange footage, this = actually cut it.
  **THE PLAYER RUNS ON PREVIEW PROXIES; THE RENDER CUTS ORIGINALS (Aug 2026,
  from her live stalls).** Her sources are HEAVY, not unplayable — measured:
  a 784x1168 Midjourney export at 19 Mbps, 12.3MB for five seconds — and
  streaming that raw is what stalled the player. Each unique source gets a
  baked preview copy (`forge-film-proxies`, sha1(url), 720p cap / crf 25 /
  maxrate 3M / faststart — measured 12.3MB → 278KB), one bake at a time on
  our own box; `POST/GET /api/filmeditor/proxies` starts and reports them,
  the page polls and **adopts a fresh proxy only between plays**, and a small
  light source is honestly `skip`ped. This is the house display-copy rule
  (the webp rule) applied to video — the original is never touched. Four
  player rules that came from her reports, all pinned by tests: **the video
  is the playhead's clock** (a stall freezes both), **the picture is the
  truth** (no new PRESENTED frame for 350ms → the playhead holds even if the
  clock moves — `requestVideoFrameCallback`, per presented frame; NOT the
  quality counters where rVFC exists: iOS WebKit batches `totalVideoFrames`
  in ~1s clumps, which held the playhead back a beat and leapt it to catch
  up — her lag-and-leap report, 2026-08-23. The counter path survives only
  as the fallback, its hold capped at 1200ms so a flatlined counter can
  never freeze the playhead), **a joint never touches a RUNNING music
  track** (same day, same root: syncAudio compared the music against the
  LAGGING playhead, read >0.35s of "drift" at every joint and yanked the
  music backward — the stop-start chop on same-source cuts too. The joint
  path now only STARTS a paused track — and drift is PACED, never yanked:
  every swap joint holds the playhead a beat while the next piece paints, the
  music rolls on through it, so drift ACCUMULATES joint by joint — her 17.9s
  cut crossed a 0.5s hard-reseek threshold around the 12s mark, which was
  "fine for a while, then choppy at 3/4 of the way through" (2026-08-23).
  `audioPace` leans the rate 4% against a moderate drift (inaudible on a
  music bed, hysteresis 0.3→0.12); only a drift past 2s is hard-resynced.
  **And the music track gets its own audio-only proxy** — measured the same
  day: her "music" was a 13.9MB 480p YouTube VIDEO mp4 streamed through the
  <audio> element for a 17.9s film. `bakeAudioProxy` (filmeditor.js — a
  video file or >12MB always bakes, a small pure-audio file skips) answers on
  the same `/proxies` routes under `audio`, and the page plays `audSrc()`,
  adopted between plays like the video proxies. **AND THE TRACK IS PRIMED
  LIKE A VIDEO (2026-08-23, round two: "starts late" + "keeps pausing about
  3/4 of the way through").** iOS treats `preload=auto` as a suggestion on
  `<audio>` exactly as on `<video>` — the warmNext lesson, never applied to
  the audio element — so the track's fetch began AT her play tap (the late
  start) and the buffer ran dry mid-film (the pause). `primeAudio` is the
  audio twin of warmNext: a muted play parked at the track's spot, retried on
  her next tap when a no-gesture play() is refused; and the track RE-ALIGNS
  the moment it actually starts sounding (`audEntry`, armed by our own play()
  or a genuine `waiting` stall — never a seek's own echo, so pacing still
  owns a rolling track), because the 4% lean needs ~25s to absorb one late
  second. A stalled/buffering element is skipped by pacing and the 2s resync
  outright — a frozen clock is not drift, and reseeking INTO the unbuffered
  region it is stalled on was the repeated mid-film pause), **a source boundary keeps
  the old frame on screen until the new one can paint** (the black-second
  gap), and **a joint never seeks the element on screen** (2026-08-23, her
  "little pauses between all the clips": #1564 fixed the seek-at-every-joint
  chop for the AUDIO track only, and the video half lived on — every joint
  re-seeked the visible element, a decoder flush and, on the phone, a fetch.
  `warmNext` parks the idle element ON the next joint's frame — muted
  prime-play, because iOS treats `preload=auto` as a suggestion — a
  contiguous split joint just ROLLS ON with no seek at all, and a
  same-source JUMP (the middle trimmed out) swaps to the parked element
  instead of seeking the one she is watching. `seekVideo` picks whichever
  element already sits nearest the wanted frame; stepping/scrubbing still
  always seeks, exactness matters there). SVG icons toggle via ATTRIBUTES —
  the `hidden` IDL property is
  HTMLElement-only and `.hidden =` on an SVG is a dead expando (the
  pause-button-that-never-was). The progress line (`#msg`) lives OUTSIDE
  `#editBox`, because the first upload happens while the empty state shows.
  Tests: `node scripts/test-filmeditor.js` (pure + the static page
  contracts, no network) and `node scripts/test-filmeditor-page.js`
  (headless Chromium PLAYS real generated videos through the real page —
  icon swap, moving playhead, boundary crossing, end stop, split, proxies,
  and the joint discipline: `seeking` events on the VISIBLE element are
  counted and must be ZERO across a swap, a split and a jump — verified
  failing 4 against the pre-fix page, 2-3 visible seeks per short film;
  fixtures must be WebM/VP8 — playwright's Chromium has no H.264/AAC — and
  **must be served with Range support** (`serveMedia`): a plain
  `route.fulfill` leaves `seekable` at [0,0], every seek silently clamps to
  0, and the old green playback tests were measuring exactly that).
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
  counts; credits live behind the ⓘ on the tab row. **Every take is kept** —
  the output AND, on the changer, the recording that went in — and each card
  has a ⤓ that downloads it through our own server (`GET /api/voicelab/file/:id`,
  `?src=1` for the source); a Storage url alone only plays inline.
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
  drops, render bakes one new file. Audio or video. Renders never overwrite — an
  audio one also files into the audio library (batch `cut-marks`), a video one
  stays on the recording's Cuts list. **Two hairline tabs at the top, CUT ·
  MARKS & PIECES** (Aug 2026): the cutting (picture, transport, strip) and
  everything she has made (pieces, marks, cuts) take turns on the whole screen,
  so neither is a scroll away; the player, transport and strip never scroll.
  **Full details: `docs/modules/audio-and-film.md`.**
- **YouTube auto-upload** — finished videos post to her business channel as
  **private drafts** for her to publish by hand; nothing goes public
  automatically. `scripts/youtube_upload.py` (stdlib only), auth via a durable
  refresh token, upload-only scope. **Full details: `docs/modules/audio-and-film.md`.**
- **Grab a video** (`ytdl.js`, `/api/ytdl`, no page — a chat calls it) — paste a
  YouTube (or Vimeo, or almost anything yt-dlp knows) url, get the file, already
  filed where the tools look. Sophie's ask, Aug 2026: "can u create an endpoint
  so i can give u a youtube url and download it thru here? otherwise i have to
  do it on my computer" — the alternative was a third-party site on her phone,
  which works but leaves the file in Files, needing a second trip to upload it
  into whichever tool wanted it.
  **THE "DATACENTER IPs ARE BOT-BLOCKED" LINE IS WHY NOBODY BUILT THIS, AND IT
  WAS STALE.** Measured 2026-08-23 from a cloud container: yt-dlp read the
  metadata AND pulled a real 3.3MB m4a and a 17MB 720p mp4, first try, no
  cookies. That is the exact shape CLAUDE.md warns about at the top — a dated
  measurement going stale when the environment moves underneath it.
  **AND THEN MEASURED ON RENDER ITSELF, the same day, because one cloud egress
  is not a population:** probe 4.8s, a 3.4MB m4a down in under 6s, and a 360p
  mp4 merged by ffmpeg, postered by the Dump and filed, at 9.1MB. Both test
  records were deleted afterwards. **Render is not blocked.** It can regress —
  the blocking is YouTube's to change — so `GET /api/ytdl/status?probe=1`
  re-runs the measurement on demand (metadata only, no bytes, no cost), and a
  block lands on the doc as `blocked:true` in yt-dlp's own words, so the one
  failure with a different remedy never reads like a generic error.
  **It costs nothing** — no model call; it is bandwidth and ffmpeg on our own
  box. `POST /grab {url, kind:'audio'|'video', quality?, to?}` returns an id in
  ~0.3s and the work runs behind it (`GET /:id/job` to poll).
  - **It files through the SIBLINGS' OWN ROUTES, never its own copy of them** —
    video to the Dump (`/api/drop/upload-file`, bundle `YouTube`), audio to the
    audio library (`/api/audio/upload-file`, batch `youtube`) — so md5 dedupe,
    the video poster, duration probing and the memo filing each happen once, in
    the place that already knows how. Assembly's "Add from the Dump" and the
    Film Editor read those two libraries already, so a grab is usable the
    moment it lands.
  - **`to:"none"` for MUSIC.** The audio library transcribes unconditionally
    (~$0.006/min) and files into her voice-memo archive — right for an
    interview, wrong for a song, which would put lyrics in among her memos.
    `none` keeps the only copy under `ytdl/` and just hands back the url.
  - **The 300MB cap is a MEMORY fact, not a preference** — both sibling routes
    sit behind `express.raw`, which buffers the whole body, and the box has
    512MB. Raise `YTDL_MAX_MB` only if that changes.
  - **yt-dlp is fetched at RUNTIME and refreshes weekly**, not pinned at build:
    it is the one dependency that goes stale on someone else's schedule (YouTube
    moves its player and last month's binary stops extracting), so a build-time
    pin is a tool that works until it silently doesn't. `yt-dlp_linux` is
    self-contained — Render needs no Python. A failed refresh keeps the cached
    copy; ffmpeg comes from `ffmpeg-static`, already a dependency.
  - The doc id is `sha1(video|kind|quality)`, so the six spellings of one
    YouTube url (`youtu.be`, `/shorts`, `&t=90`, a playlist tail) are ONE grab
    and asking twice never pays twice. `DELETE /:id` forgets the grab but leaves
    the filed copy alone — it belongs to the Dump now, and quietly pulling a clip
    out of an Assembly would be the worst kind of surprise.
  - Tests: `node scripts/test-ytdl.js` (the url rules, the id, the format
    strings and the block detection — pure, no network) and
    `--live`, which drives the REAL argv all the way to a file on disk and is
    the only honest way to ask whether this box can still reach YouTube.

### Story
- **The pad IS the Story Room now (Aug 2026)** — `/storyroom` serves the pad page
  and the app's Story Room tile opens it. The OLD board surface (`storyroom.html`,
  `/api/story/*`) stays in the repo, unpointed.
  **IT WAS THE LAST TOOL STILL WEARING APPLE'S BAR, and the stale doc is why
  (Aug 2026, Sophie: "I made the impression that we had gotten rid of the Apple
  native header, but I think story room still has it cause there's a back
  Chevron").** `StoryRoomView` carried a hand-written `.toolbar` chevron from
  before `.forgeWebToolBar` existed, and `docs/design-rules.md` still told a new
  tool to ship with the native bar — so nothing ever flagged it. Both are fixed;
  the page draws the one chevron via `pagehead.js` now.
  **AND ITS SHEETS ARE LEVELS, NOT DIALOGS** (same message: "there's like an X to
  get out of it and a weird icon. I just want it to be a back button and no X …
  the header should be like normal it should say the shelf"). The shelf and every
  other sheet in the page wear the page's own header — back chevron left, **name
  centred**, actions right, one CSS rule over `header,.sheethead` — the shelf is
  called **The shelf**, and there is no ✕ in this page's chrome at all.
  **AND THE BACK BUTTON IS THE SHELF BUTTON — THE SHELF IS THE ROOM
  (2026-08-23, Sophie: "i think the story room architecture is backwards. the
  shelf is the main room. the back button goes to the shelf. story room opens
  on the shelf. we don't need a separate shelf button. the back button IS the
  shelf button").** The `library` door that had just moved to the RIGHT of the
  header is GONE, and the walk runs the other way: the page **opens on the
  shelf** and loads no story until she taps a tile, a bare story answers
  `__navBack` with TRUE and opens the shelf, and only the shelf answers false —
  which is where the app leaves the tool. It used to be the reverse (open on
  the last story, a door to go and fetch the shelf, the shelf's chevron
  dropping back onto that story), so the tool had two ways up and the pad read
  as the room. The shelf is still a `.sheet` — opaque, `inset:0` — which is why
  nothing else in the page moved; its own chevron leaves the tool now. **A
  plain browser injects no chevron**, so the page draws its own (`#shelfback`)
  and stands it down under `body.native` / `body.pagehead` — the same "whoever
  owns back draws it once" rule the ten `__nativeNavBar` pages follow; without
  it a story is a dead end in a browser. Test:
  `node scripts/test-storyroom-header.js` (three states —
  web / old build / new build). Stories carry **listen rows**
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
  tile. **A beat can also be a FILM CLIP** (Aug 2026): the add sheet's
  second hairline tab is the Chunking clip library, read-only — a clip is
  referenced not copied, tiles as its POSTER with a film mark (never a
  `<video>` on the pad), draws nothing, and in the film passes through whole
  with its own sound and its own length. The film stitches every beat with art, each held for its own audio's
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
  each experiencer. **Adding videos runs on SOPHIE'S Mac** — not for the bytes
  (`/api/ytdl` grabs those from the cloud) but because `nde-grab-local.py` banks
  them in the exact layout the cutter reads. Her one
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
- **Witch-video pipeline** (`witchvideo.js`, `/api/witchvideo`, page at
  `/witchvideo` — PUBLIC, deliberately unlinked, no tile) — Theo's (her mom's
  ChatGPT's) video ideas → a chat's draft 480p cuts → **her MOM reviews on her
  phone**: the unguessable `who=` token in her link is the identity (the fruit
  pattern), **tapping the video pauses it and opens the note box** stamped
  with the second she stopped at, ♥ approves / ✕ reopens, stills batches get
  per-still notes before animation money is spent, and the box at the bottom
  files a new idea. **Every note/verdict/idea rings the owning chat's wake
  doorbell** (`chat-wake.ring` — the ONE shared implementation, exported Aug
  2026 so modules ring in-process; never copy it) and lands in
  `GET /api/witchvideo/inbox?chat=` for the sweep. **The module generates and
  spends NOTHING** — generation is chat work (movies.js recipe, ~$1–1.50 a
  draft; a batch of ideas ≈ $20 gets the >$3 ask). Notes over 2000 chars are
  refused, never truncated; cuts/stills/thread are kept capped 12/8/300;
  emails live only on the `__reviewers` doc and never ride a public read. A
  new cut emails reviewers when Brevo is configured (it was NOT, measured
  2026-08-14 — the response says `emailSkipped` honestly). Full map:
  `docs/witch-video-pipeline.md`. Tests: `node scripts/test-witchvideo.js`
  (pure + the real page headless).
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
  **Update** row at the top of the Chats app's UPDATE tab) — Aug 2026,
  Sophie: "an update button that I can just click and then
  it does an API call that gives me the top five things I might want to be
  updated on, and then maybe some lower priority things, and ideally images
  that chats made or links to compare pages". One tap → five cards, the
  quieter ones under them, each carrying the pictures that chat made and the
  Compare pages it posted.
  - **IT LIVES ON THE UPDATE SCREEN, NOT THE HOME GRID (Aug 2026 v2, Sophie:
    "a couple days ago we added a what's new button to the main screen, but I
    wanted it to go on the update screen — could you rename it Update, no
    icon, and put it on the update screen").** It shipped as "What's new" with
    a list icon on the iOS home screen. It is on EVERY paint of that tab, the
    caught-up one included: the page behind it answers a different question
    from the cards, so an empty list is no reason to take the door away. It
    carries no count, for the same reason it never did on the home screen.
    `BriefView.swift` is kept but unmounted, and /brief opens inside the Chats
    web view with its own chevron back.
  - **IT IS A CHIP, AND IT SITS ABOVE THE ACCOUNT TABS (Aug 2026 v3, Sophie:
    "the update and also the review button that you probably copied are both
    supposed to be smaller and they're supposed to go above the chats").**
    Both doors shipped as full-width slabs at the top of the LIST — 92px of
    screen before the first card, on the screen she opens to find out what
    happened. They are `.catchip`-sized buttons on their own line in
    `#nwdoors` now, between the search row and the account tabs, so they are
    CHROME and not list: `paintNewsDoors` fills that row, `paintHomeChrome`
    empties it on every other view, and only the review CARDS behind the ⌄
    still live in the grid. Measured on a 390pt phone: 26px instead of 92, and
    the first card moved up 66px. Review keeps its ⌄; Update is never owed, so
    it doesn't.
  - **NONE OF THE THREE IS RED (Aug 2026 v4, Sophie: "make the review button on
    updates tab not red").** Review was the one door painted in the accent, on
    the reasoning recorded here that it is "the door that says something is
    owed" — she looked at it and said no, so that reasoning is history rather
    than a rule. Every door now wears the quiet `var(--line)` box every other
    chip on the page wears, and the COUNT beside the word is what says how much
    is waiting. Don't paint one back.
  - **AND A THIRD DOOR — TO READ (Aug 2026 v4, Sophie: "add a to read button
    next to it").** The one bookmark tag with a door of its own: things she
    kept meaning to read back are the pile that goes stale when it can only be
    reached by remembering it is there. It is on EVERY paint (like Update) and
    carries a count (unlike Update, because unlike Update it can be empty), and
    it opens the KEEP-PILE with the To read filter lit — never a fourth pile of
    its own, because there is one place kept things live. The count is its own
    tiny route (`GET /api/chatfeed/to-read`, two array-contains queries), asked
    once per load and repainted when it lands: this tab paints on every poll
    and `GET /bookmarks` returns up to a thousand documents.
  - **IT OPENS ON THE LAST LIST SHE SAW, AND THE READ IS A TAP (Aug 2026 v2,
    Sophie: "rather than immediately doing another API read, I'd like to be
    able to go back and forth, so the update should be behind one more tap …
    there's a button at the top that says refresh which causes another API
    read, and it also says last updated and then the time").** The whole
    answer is kept in `localStorage` (`forge.brief.last`, with the moment it
    was read) and drawn instantly; **Refresh** at the top of the page is the
    only thing that reads, and it sends `?fresh=1` past the server's 60s hold.
    Two things not to undo: the old **auto-reload on `visibilitychange` is
    gone** (it re-read every time she came back — the exact thing she asked to
    stop), and a FAILED refresh keeps the list she was looking at on screen
    with the error in the stamp line. Coming back repaints the stamp only, so
    "5m ago" can never go stale while the tab sits in the background.
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
  - **It was a full-screen COVER from the home grid, never a `Tool`** —
    opening a Tool promotes it into `Recents`, so the button would have
    evicted one of her three bottom-bar slots on every tap. That reasoning is
    banked in `BriefView.swift` in case the page ever wants a native screen
    again.
  - Tests: `node scripts/test-brief.js` (the whole ranking, pure, fixtures),
    `node scripts/test-brief-page.js` (the real page + the real injected pill,
    headless — the cache-first open counted in API calls, Refresh, the pill
    palette, the pill's corner over the top card, the lightbox contract, the
    ⌄) and `node scripts/test-chats-update-row.js` (the row on the real
    Update tab — first, her word, no icon, and still there when caught up).
- **THE MORNING BRIEF — a Compare page, twice a day, on a Routine
  (`scripts/morning-brief.js` + `.tpl.html`, Aug 2026).** Sophie asked for her
  briefing as a page rather than a reply ("this would be more helpful as a
  compare page with the things checked off from yesterday and empty, checked
  boxes for today"), then for it on a schedule. **The FORMAT is code and the
  JUDGEMENT stays with the chat**: a run reads the live sources, decides what
  matters and how urgent each thing is, writes a small JSON, and the script
  turns it into the page. It is NOT the `/brief` Update button — that one is
  derived and free; this one is a chat sitting down and reading everything.
  - **The sections ARE her three timings — Now · Later · At some point** (her
    ask: "can u then group them by importance timing"). The run makes the
    first call in `when`; her tap on one of the three marks under a line MOVES
    it, and that override is what the page reloads to. So the flag and the
    grouping are one control, not two.
  - **ITEM IDS ARE HASHED FROM THE WORDS (`idFor`), never counted.** The
    evening run re-posts onto the SAME per-day sheet (`brief-YYYY-MM-DD`), so
    a positional id would hand her morning tick to whatever task landed in
    that slot at 5pm. Hashing the chat slug + title means a task that survives
    the day keeps its tick, its flag and its star.
  - **A CHAT IS LINKED BY ITS DECK FACTORY SLUG, never a claude.ai session
    url** (her ask: "the links shud go to the chat in deck factory, not the
    Claude app"). Inside the app the page is a same-origin IFRAME of
    chats.html, so a plain link would load the whole Chats app inside the page
    viewer — the row hands the parent `window.__openThread(slug)` and only
    falls back to `/chats?chat=` in a browser. Same bridge judge.js uses to get
    back to the review queue.
  - Ticking drops a line into **Done** at the bottom and unticking returns it
    to its own place; the **star** is "remember this" and outlines the row red;
    the boxes are red because she likes red. The three marks and the star sit
    BOTTOM-LEFT on purpose — the injected pill is fixed over a row's top-right.
  - **Editing the look? Edit `scripts/morning-brief.tpl.html`, never a posted
    page** — a posted page is frozen, and a new version is a new page
    (supersede the one it replaces; `--supersede <id>` does it).
  - Tests: `node scripts/test-morning-brief.js` (the id rule pure, then the
    real page driven in headless Chromium — including inside an iframe host,
    which is the only place the link bridge can be checked).
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
  - **ONE PAGE, TWO VIEWS (Aug 2026 v4, Sophie: "the compare page, and tinder
    swipe shud be TWO views of the the same page, since they have the same
    content. that way I can swipe back and forth, and see them at full size,
    rather than opening and closing").** Every template page now carries BOTH
    halves behind one hairline switch (SWIPE · COMPARE, `page-views.js`);
    `template` only decides which it OPENS on. The half that is missing from
    the data is derived — a grid's groups flatten into the deck's item list, a
    deck's items become one-card groups — so a page posted either way opens
    either way, including every page already posted.
    - **The marks cross by themselves.** Both views have always written the
      same verdict doc under the same item ids, so switching is a repaint:
      each view exposes a `refresh()` and re-reads on the way back in. Her
      place in the deck is kept (`resume(false)` — catching up must not jump
      her to the first unjudged card).
    - **The pill is per VIEW, not per page.** A deck is one screen and a grid
      scrolls, so `meta forge-pill off` could no longer say it: the pill is
      injected and hidden by the body class instead.
    - **The deck's height chain runs through the new wrapper** — judge.js
      sizes off 100% of its mount, so `#pageviews` is a full-height flex
      column and `#judge` takes what the switch does not. Without that the
      card floats at the top of a half-height box.
  - **A PAGE IS SPREADS HOLDING CARDS, AND A MARK LANDS ON EITHER (Aug 2026
    v4, Sophie: "so I can leave a note per card, or per spread. same w
    heart").** A spread of 2+ carries a key of its own — derived in
    `page-views.js` from its label, **`s:` prefixed so it can never collide
    with a card's** (item ids are cut to `[a-z0-9_-]`, so a colon cannot
    appear in one) — and rides the same verdict doc, so nothing new is
    stored and every page already posted gets it. **A one-card spread gets NO
    key**: its card's mark IS the mark, and a second heart for the same
    picture would be two answers to one question.
    - In the COMPARE view the spread's ♥/✕ sit at the end of its name row
      (with the pill's 64px column reserved, because the page scrolls and a
      row passes through that band on its way up), and its note is the shared
      `__compareNotes` + in the corner — a card's note lives on its picture,
      in the lightbox, and a spread has no picture.
    - **A "this one" UNDER EACH PICTURE PICKS THE WINNER (Aug 2026, Sophie:
      "is there a way to pick one or the other if I'm choosing between them?
      Maybe best is to just have a 'this one' small button underneath each
      one").** The spread's verdict becomes the WINNING CARD'S ID, so what is
      recorded is *silkscreen won this spread* rather than *she liked a card*
      — and a picked spread gets its own **Picked** pile, since a card-id
      verdict matches none of Yes/No/Unsure and would otherwise drop off that
      screen. The ✕/♥ still answer the spread as a whole (neither, or both).
    - **THE SPREAD SITS ABOVE THE BROWSE ZONES (Aug 2026, found by measuring
      rather than looking).** The edge zones are 26%-wide strips at z-index 2,
      and on a two-up card the CENTRE of each picture lands inside one — so a
      tap on either picture PAGED THE DECK instead of opening it, and the
      "this one" buttons under them were unreachable for the same reason, on
      the one card whose whole job is choosing between two pictures. The
      spread is lifted above the zones; the card's margins above and below
      still page, and the swipe always did. `elementFromPoint` at a control's
      centre is the only honest way to test this — the element is "visible"
      either way, and the question is what the tap actually reaches.
    - **NO OUTLINE AND NO ROUNDED CORNER ON A PICTURE** (same day: "gray
      outlines, rounded corners" · "are the corners rounded on the actual
      image in the light box? Should not be"). Her rounded white boxes are for
      WORDS. The spread wore two borders — the panel drew one and the image
      another — and the lightbox rounded the art itself, which at that size
      reads as a crop rather than as chrome.
    - **BROWSE IS THE DECK'S DEFAULT and only the deck template's validator
      was setting it**, so a GRID-posted page's swipe view came up without it
      and a mark jumped her to the piles instead of leaving her on the card.
      page-views.js defaults it now.
    - In the SWIPE view a spread is ONE card: its pictures side by side, each
      named, the card's ✕/♥ and note box marking the SPREAD, and tapping
      either picture opening that picture's own lightbox. **That is also
      exactly the two-up picker** she asked for earlier ("comparing two
      different images to each other, and picking between them") — it falls
      out of the shape instead of being a third thing to build.
    - `paintActs` asks for the spread's own row FIRST: a group contains tiles
      and a tile has `.gd-acts`, so the plain descendant selector matched a
      CARD's buttons inside the spread and painted the wrong thing.
  - **TAPPING THE PICTURE OPENS THE ASSETS LIGHTBOX, on a swipe card too (Aug
    2026 v4, Sophie: "I think I want the same exact asset tab formula w heart
    ex prompt note chat etc in lightbox view, and u can have tinder one choice
    when not in lightbox").** So the card keeps ONE choice — her ✕/♥ and the
    note box at the bottom — and everything else about a picture lives behind
    it: its own ♥/✕, both halves of the prompt, the note thread. The adapter
    is `asset-view.js`, lifted out of grid.js so a tile and a swipe card open
    the same thing rather than two copies drifting apart. judge.js drops the
    `zoom` class when the adapter is present, because that class belongs to
    compare.js's own document-level lightbox and racing it would be a bug.
  - **EVERY DECK IS HER DECK NOW (Aug 2026 v3, Sophie: "I think we should
    just make the single image review surface the same general template as
    the text one").** Her Decision Deck chrome — the cream, one screen, the
    progress line with **Piles** and the "?", the ✕/♥ floating on the content
    with the note box under it — was the date cards' alone, and a deck of
    PICTURES wore the house look instead: a count, three unlabelled gold
    circles, four verdict buttons. That is what hid Skip/Done from her: the
    piles view existed, but the way in was an unlabelled grid icon. So
    `renderTemplatePage` tells judge.js `look:'mom'` for every `deck`, and
    every card — picture, words, or both — is one of hers. The item's `label`
    becomes the name over the picture; a picture with no `aspect` sits in a
    panel that HUGS it, capped at 56vh, so a picture card is one screen like
    everything else. **A hand-built judge page (judge-shell.html) never comes
    through the renderer, so nothing already posted restyles itself** — and a
    test pins that.
    - **The mic survived the move**, deliberately: her date decks never had
      one, but all five live picture decks are posted with `voice:true`
      (measured), so folding them into her look would have taken the
      hands-free notes away. It rides in the note box's own corner.
    - **Four verdicts became two**, matching her date cards. Measured across
      her live decks the day this shipped: 16 verdicts, **one** `maybe`, no
      `later`. A **Maybe/Later pile is still listed when something is
      actually in it**, so the one legacy mark cannot vanish off the screen.
    - A deck with its own `states` keeps its chips — her words still win.
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
  - **A DECIDED CARD WEARS A GOOD / BAD STAMP (Aug 2026, her own "Decision
    Deck v3" canvas: "a little good/bad stamp that stamps the ones that you
    pick or don't pick").** Red rubber, tilted, the one just decided slamming
    on — in at 2.5x and blurred, invisible until it is nearly down, an
    overshoot, then settled in 560ms. The ink is rough rather than printed: an
    feTurbulence displacement chews the edges and a mask of radial holes lifts
    the worn spots out of the middle; two filters and two hole patterns so the
    halves of a spread never stamp identically. Values are the artboard's
    (`docs/decision-deck/`).
    - **The SPREAD is the case it is named for** — picking one of two pictures
      stamps GOOD on the winner and BAD on the other. A ♥ or ✕ anywhere else
      stamps the whole card.
    - **maybe / later / a deck's own words stamp NOTHING.** There is no good
      and no bad in "sort this one later", and a red mark there would invent a
      verdict she never gave.
    - **A deck with no browse mode waits out the animation before it
      advances**, so the card she is leaving is the one that wears the mark —
      otherwise the stamp is painted onto a card replaced in the same frame.
      Her decks are all `browse`, where a mark never moves the deck anyway.
    - It is `pointer-events:none` everywhere, so it can never take a tap off
      the ♥ underneath it — measured with `elementFromPoint`, the only honest
      way to ask. `stamp:false` turns it off; `goodWord` / `badWord` are hers
      to change, because her artboard made them fields.
    - Test: `node scripts/test-judge-stamp.js`.
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
  - **A PICTURE INSIDE A SPREAD HEARTS TO THE ASSETS TAB, NOT TO THE PAGE
    (found live 2026-08-22, Sophie on the witch reels: "the heart doesn't work
    in the review queue… per image. they're supposed to tie back in to the
    original chat likes so all likes are synchronized everywhere").** The
    card's ♥/✕ answers the SPREAD — that is what the `s:` key is for — so a
    per-picture heart cannot be the card's verdict. judge.js's lightbox cast
    used to compare the picture's id against the CURRENT CARD's, which for a
    spread's picture never match, so her tap **did nothing at all**: no light,
    no verdict, no vote, nothing written anywhere. It casts the ASSET vote now,
    exactly what the grid's tile does on an own-states page. That page is 47
    pictures in 8 labeled groups, i.e. every picture on it, and it had zero
    marks on file.
  - **AND THE DECK READS THE ASSETS TAB AT LOAD, which it never did** — the
    grid has since it shipped, so "the two surfaces agree in BOTH directions"
    was only ever half true. A ♥ she gave in the Assets tab now fills in a
    top-level card's verdict and lights a spread picture's own heart. Tests:
    `node scripts/test-judge-spread-heart.js` (the real page headless, verified
    failing against the pre-fix file, 6 of 15).
  - **A SPREAD VERDICT COUNTS AS PROGRESS (found live 2026-08-20).** Her ♥/✕
    on a whole spread and her "this one" pick land under the `s:` key, and the
    queue used to count only card ids — she reviewed the "Monkey + summit"
    grid (verdict doc: `s:monkeys-… → the winning card`) and the tile went on
    saying "10 to go", which she reported as "the heart button doesn't work".
    `pageSpreads` in review.js re-derives the `s:` keys EXACTLY the way
    page-views.js does (label slug, in order) — change one and the other or
    spread marks silently stop counting again; `node scripts/test-review.js`
    pins them against each other's shape.
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
- **THE INSTAGRAM MOCKUPS** (page at `/instagram`, reached from the icon at the
  RIGHT of the Chats app's UPDATE tag row — Aug 2026, Sophie: "an icon button
  in the top right within the existing header space where the tags are, of my
  update tab … that leads to two tabs — two mockups of instagram"). Her two
  accounts drawn as their profile grids: **DREAM** (`you...my.dreams`) and
  **WITCH** (`moonsickbaby`), behind two hairline tabs. **It costs nothing** —
  no model call, no job; it reads a committed JSON and one free API.
  - **THE DREAM GRID IS THE ONE THE dream-app-commercial CHAT ALREADY MADE, not
    a copy of it** (her ask: "reuse it exactly, it plays the films"). The phone,
    the 3:4 crop, the tiles that play and the current-cut refresh live in
    `public/instagrid.js`, a faithful lift of `scripts/dream-commercials/grid.js`
    — and **both readers now take their tiles from `public/instagram-grids.json`**.
    That is the load-bearing half: a posted Compare page is FROZEN the day it is
    posted while this page is not, so two hand-kept tile lists would drift into
    two different mockups of one account. `grid.js`'s output was diffed
    byte-for-byte across the change, and a test compares the two as objects.
  - **A TILE PLAYS ITS CURRENT CUT.** The url in the data is only the fallback:
    every tile names its film's Storage `prefix` and the `chat` that makes it,
    and the page asks `GET /api/chatfeed/newest` on every open — so a re-cut in
    another chat reaches both grids with nothing re-posted. A tile with no film
    opens its still instead, so **no tile is a dead control**, and a note left
    on a playing film lands in the chat that can act on it (`filmnote.js`).
  - **THE WITCH GRID HOLDS ONE THING — moon milk — and that is measured, not a
    placeholder.** Her only witch film: swept Storage and the whole feed (Aug
    2026) and there is no moon milk VIDEO in the bucket at all — the story is
    12 beats with no voice, and `moon-milk-meta`'s own note reads "to do:
    download moon milk videos (or remake)", i.e. the real cuts are on her
    phone. So the tile carries the one real still there is
    (`survey/covers/moon-milk.webp`) and says **"no film here yet"** rather
    than a duration that belongs to nothing. Its `prefix` is `moon-milk/`: drop
    a film there and the tile starts playing it by itself.
    **Three finished Secretly a Witch shorts DO exist** and are deliberately
    NOT on the grid (`witch-shorts/believing-the-worst`, `…/rules-review-room`,
    `…/combined/tolle-combined`, newest cuts v7/v7/v6) — she said only moon
    milk, and they are lesson films rather than reels. Adding one is a row in
    the JSON.
  - **THE ICON COSTS THE UPDATE ROW A LINE, and that was the cheaper half.**
    The true top-right corner (x 324-374, y 14-192) belongs to the injected
    pill, so the button is a right FLOAT placed after `#pillnotch` — the
    rightmost place the row actually has. Measured at 390pt: the row runs
    glass(34+8) · "Come back to"(117+6) · "In a minute"(97+6) with 64 reserved,
    leaving 25px, and shrinking the button to 26 and then 24 still wrapped the
    second box (a chip's own 6px right margin counts against the line). Nothing
    ≥20px fits, so the wrap was coming either way and it keeps a full-size tap
    target. UPDATE row 40px → 72px, that screen only.
  - Test: `node scripts/test-instagram-grids.js` (the one-data-source rule
    pure, then both real pages headless — the tabs' measured underline, a tile
    playing, the still fallback, the pill's palette and corner, and the icon
    asked with `elementFromPoint` at its own centre, which is the only honest
    way to ask whether the pill is sitting on it).
- **Push notifications** (`push.js`, `/api/push`) — real APNs lock-screen
  notifications, raw HTTP/2 straight to Apple, no Firebase Messaging. Sent on a
  **finished reply** (never a draft) and on a new Compare page. They are the
  Update tab's **doorbell, not its replacement**, so a dropped push is never
  lost news. A tap opens THE CHAT IT CAME FROM.
  **THE BANNER SHOWS WITH THE APP OPEN TOO, SILENTLY (Aug 2026, Sophie:
  "notifications that come down into the app and appear at the top of the
  screen while I'm in the app").** `willPresent` returned `[]` until then — the
  app suppressed every foregrounded notification on the reasoning that the
  Update tab IS the notification. That is true only on the Chats screen: from
  the Playground or the Story Room a chat answering her said nothing at all,
  and the rose "New message" bar on `/chats` names neither the chat nor what it
  said. It is `[.banner, .list]` and deliberately NOT `.sound` — the buzz is
  what carries a lock-screen push across the room, and in her hand the banner
  has already done that. Do not "fix" this back to `[]`.
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
  (that blanket rule was retired the same day, and since 2026-08-23 the echo is
  back for the questions SHE marks with the word "question" — so this skip
  matters MORE now, not less), and the push body was
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

