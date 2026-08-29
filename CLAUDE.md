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
3z. **A MEASUREMENT SHE DID NOT ASK FOR STAYS OUT OF THE REPLY** (Sophie,
   2026-08-28: "why r u telling me that" · "every chat tells me that like 70
   times"). Token counts, what a reference costs, how long a call took, what
   you learned about the pipeline on the way: interesting to you, noise to
   her, and she reads it in every chat. It goes in the PR, the commit or this
   file — never into her reply unless she asked or it changes what she does
   next. Full rule: *DON'T HAND HER YOUR FINDINGS* in Design rules.
3a. **PIN THE LINK — but ONLY in her two cases** (`POST /api/chatfeed/pin
   {chat, session, url, title}`): a page you are **actively working on**
   (`/science`, `/chunking`), or a deliverable you are **actively handing her
   new versions of** (a film, an episode). In those two, pinning is the
   default and you re-post it every time you update what's behind it — that is
   what lights the *current* tag. **Everything else stays out of that row**:
   most chats should have NO pin. A third case is not yours to declare — run
   it by Sophie first. (Full rules: *THE PINNED LINK* in the Chats app
   section.)
3c. **Handed her a FILM, an AUDIO CUT, or a finished page? It goes on the
   DELIVERABLES LIST** (Sophie, 2026-08-27: "watch them all in one place
   newest first"). A media pin records itself; a deliverable you did NOT pin
   gets `POST /api/deliverables {chat, session, url, title, kind?}`. The list
   is https://imageforge-q125.onrender.com/deliverables, and a NEW url buzzes
   her phone past the per-chat bell — so never POST a test render there.
   Re-POSTing the same url updates the row silently. Images stay out (the
   gallery is their place). Full rules: *THE DELIVERABLES LIST* in the
   inbox-and-odds-and-ends section.

3e. **A FINAL video being exported for posting gets a CLEAN COPY** —
   metadata stripped with a stream copy (pixels byte-identical, verified by
   hash), filed into the Dump with a real filename, direct save link
   (`/api/drop/file/<id>`) in the reply. NOT for paid ads — they keep their
   metadata. Full procedure: *THE CLEAN EXPORT* in
   `docs/modules/audio-and-film.md`. (Images: not built yet, hers to ask.)

3f. **Handed her a FILM MADE OF PICTURES? FILE ITS SHOT MAP** —
   `POST /api/filmshots {chat, session, url, seconds, shots:[{at, url}]}`,
   one entry per picture with the second it comes on screen. It is what puts
   the **Prompt** button on the paused player, and you are the only one who
   knows the cut list — the same *file it while you know it* rule as the
   MODEL · QUALITY · SIZE caption. No map, no button (never a wrong prompt
   under her finger). An older film is measured instead:
   `node scripts/film-shots-detect.js --film <url> --chat <slug>` (dry; add
   `--go`). Full rules: *THE PROMPT ON A PAUSED FILM* in the Chats section.

**When the work WRAPS UP (not every turn)**
3b. **Leave a WRAP-UP** — `POST /api/chatfeed/wrapup {chat, session, line,
   asked, did, next}`. It is **her three questions, ONE SENTENCE EACH** (Aug
   2026: "what I really wanted was the what you asked, what I did, and next
   steps"; three sentences in total, not six) — `line` = the one line her
   archive row shows (≤200). **The "what you asked" she reads is HER OWN
   SENTENCE, lifted verbatim from her last message — your `asked` is only the
   fallback** for a chat she never posted into (Sophie asked, 2026-08-25,
   whether chats write it or use her words; the full rule is *AND THAT LINE IS
   HER OWN SENTENCE NOW* in the Chats section). This is what she reads months later to remember
   what a chat was, so it earns more care than the status card. *Measured
   2026-08-14: 73 of her 88 archived chats showed nothing but a name.* You
   cannot be asked for it later — you are asleep by the time she archives.
3d. **Tagged `bug fix`? ARCHIVE YOURSELF when the fix landed clean** (Sophie,
   2026-08-27: "chats tagged bug fix shud auto archive themselves if there's
   no problems or questions"). Read your tags off `GET /api/chatfeed/status
   ?chat=&session=` (`labels`, added the same day). If `bug fix`/`bugfix` is
   on you AND nothing is open — the fix works and is merged, no problem left,
   no question of hers unanswered, your `need` empty — leave the wrap-up (3b)
   and then `POST /api/chatfeed/archive {chat, archived:true}` (it freezes the
   wrap-up for the archive row). Anything still open → stay live and say what
   it is. Full rule: *A BUG-FIX CHAT PUTS ITSELF AWAY* in the Chats section.

**Writing an image prompt (before any of the below)**
- **Short, action-only, and NAME the thing rather than listing its parts** —
  "meat raining from the ceiling", never "ribs, drumsticks, etc." (Sophie,
  2026-08-24). An enumeration is a checklist the model satisfies literally, so
  it lays the items out instead of drawing the event. Encourage the short form
  when she asks for a prompt — but a prompt SHE dictated is sent as given, and
  anything you change is named word for word. Full rules: *DESCRIBE THE
  ACTION* · *WRITE IT SHORT* · *NAME THE PHENOMENON* in
  `docs/image-pipeline.md`.

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
- **AND SWEEP THE NOTES AGAIN BEFORE YOU SAY YOU ARE DONE — HER NOTES ARRIVE
  AFTER THE MESSAGE THAT ANNOUNCES THEM.** Measured 2026-08-28: she wrote
  "added some notes … i suggested 3 examples in the notes" at **23:17:29** and
  the notes themselves landed **23:29:54-23:31:11, twelve minutes later**. The
  chat swept once at 23:18, found nothing, said so, and delivered 135 pictures
  ignoring every ask she had left. She announces the intent, then watches and
  writes WHILE you work — so one read at turn start is the wrong shape.
  **"No notes yet" means NOT YET, never "she left none"**, and a note on a
  FILM never appears in `GET /api/gallery/assets` at all (it rides the pinned
  film's url with no label) — only `/notes` sees it. A note POST now rings
  your wake doorbell (2026-08-28), so a note landing mid-turn can reach you,
  but the re-read is what catches one that lands while you are still writing
  the reply.
- **A QUICK-QUESTION chat SETS ITS OWN BELL** (Sophie, 2026-08-27: "a 'quick
  question' chat shud set its own bell as true"). If she is using you for
  quick questions — she says "quick question mode", or `quick question` is in
  your `labels` on `GET /api/chatfeed/status` — `POST /api/chatfeed/notify
  {chat, notify:true}` once, so the answer buzzes her phone. Turning a bell
  OFF stays hers alone.

**While you work**
- **BUILDING OR POSTING A PAGE? THE RULES FIRST — this is the thing that
  always goes wrong (Sophie, 2026-08-25: "when people make new pages they
  should follow the rules… the header, the pill, the styles").** Read the
  `new-page` skill BEFORE writing any page — start from the SHELL
  (`compare-shell.html` / `judge-shell.html` / `picker-shell.html`), link
  `/compare.css` + `/compare.js`, never hand-roll the pill, the title once
  with nothing above it, boxes empty, buttons hug their words. `POST /page`
  answers `warnings` — a page that comes back with one gets fixed before the
  turn ends.
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
anything else, **each answered ONCE** · **did she MARK a question ("i have a
question" / "quick question" / "file this")? then repeat THAT question in bold
on its own line and answer under it — otherwise never echo a question back**
(see *Answering a question*; the bare word alone is not the mark) · small
question, short answer · **asking HER something? plain text, never the
questions/option-picker UI** (2026-08-28, her rule) · full clickable links · no markdown tables · times in 12-hour
Pacific · files and images LAST · working links at the very bottom ·
**briefing her on OTHER chats? every chat you name gets a
`/chats?chat=<slug>` link back to it at the bottom** (see *BRIEFING HER ON
OTHER CHATS* in Design rules).

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
- **A video url: RUN yt-dlp IN YOUR OWN CONTAINER — not `/api/ytdl/grab`
  (Sophie's call, 2026-08-27: "use container not render for YouTube
  downloads").** Render's IP is the bot-blocked one — 3 of 4 distinct videos
  refused on every player client, including two of her own grabs — and its
  `GET /status?probe=1` stayed green throughout, so the endpoint reads healthy
  while her downloads fail. A session container is a different IP, so a chat
  that needs the bytes fetches `yt-dlp_linux` from the GitHub release, pulls
  the file itself, and POSTs it to the Dump (`/api/drop/upload-file`) or the
  audio library (`/api/audio/upload-file`) — the same two routes `/api/ytdl`
  files through, so it lands where the tools look either way.
  **A CONTAINER IS BETTER ODDS, NOT A GUARANTEE — say what happened.** Measured
  from this container 2026-08-27: metadata read on 3 of 4 videos, and the BYTES
  came down for only **1 of 3** — the other two answered 403 or "sign in to
  confirm you're not a bot" on every player client on the ladder. When the
  container is refused too, queue it here: the desktop trip with her logged-in
  browser's cookies is still the only sure path.
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

## LINKS THAT OPEN THE iOS APP — hand her an https link, not a scheme
**Sophie, 2026-08-25: "is there anyway to do links that go directly and open
in my actual iOS Deck Factory app?"** Yes, two ways, and only one of them is
worth putting in a reply.
- **Give her the ORDINARY page url** —
  `https://imageforge-q125.onrender.com/playground`,
  `…/chats?chat=<slug>`, `…/review` — and on her phone it opens the app on
  that tool instead of Safari. That is a **universal link**: iOS reads
  `/.well-known/apple-app-site-association` (served by `applinks.js`) at
  install/update and remembers which paths are ours. Nothing about the link
  looks special, so it works in a reply, a note, a message, anywhere — which
  is exactly why it is the one to use.
- **`deckfactory://<tool>` still works and is NOT for her.** Any Tool raw
  value plus `home`/`gallery`; the widget deep-links through it. But a custom
  scheme is only tappable where something treats it as a link, and in most of
  what she reads it renders as plain text — so keep it for the widget, a
  Shortcut, and page-to-app hops.
- **THE PATH LIST IS A CONTRACT ACROSS TWO FILES that nothing but a test
  compares** — `LINKS` in `applinks.js` (what the site claims) and
  `ForgeLinks.map` in `ios/ImageForge/ForgeLinks.swift` (what the app knows).
  Claimed-but-unknown opens the app on nothing; known-but-unclaimed never
  reaches it, and **both failures are silent on her phone**. Add a path to
  BOTH; `node scripts/test-applinks.js` fails if they drift.
- **A LINK TAPPED INSIDE THE APP IS NOT A UNIVERSAL LINK — iOS never hands
  one back to the app it is already in (2026-08-25, Sophie: "it didn't work",
  and she was in the Deck Factory app).** That is the whole of the first bug
  report, and nothing about the site half was wrong: Apple's own CDN was
  serving the association file and the build carried the entitlement. Every
  web view here passed a tapped link to `UIApplication.shared.open`, which on
  one of OUR urls opens **Safari** — so the link she tapped to reach a tool
  took her out of the app instead. `ForgeLinks.open(url)` is asked FIRST now
  (in `ChatFeedView`'s `createWebViewWith` and `GatedWebTool`'s navigation
  policy) and routes into the same `handleDeepLink` a real universal link
  walks into, so a link means the same thing wherever it is tapped. **A new
  web view that opens links must ask it too** — `node
  scripts/test-applinks.js` sweeps every `UIApplication.shared.open` in the
  app and fails on an unguarded one (a Settings deep link is exempt).
  The **configured server's host counts as ours** for this, though it can
  never carry a universal link — the entitlement names one fixed domain.
- **The query rides along**, which is what makes a link land on ONE THREAD:
  `?chat=<slug>` and `?view=news` reuse the pending flags a tapped push
  already sets, so there is one mechanism and not two.
- **Only claimed paths are claimed** — the public pages (`/witch`,
  `/selfcare`, `/dreamfeed`, `/fruit`), `/desktop`, and `/instagram` (the
  MOCKUPS page, a different thing from the app's `instagram` tool) keep
  opening in Safari, deliberately.
- **The app half needs a TestFlight build** (the Associated Domains
  entitlement), the site half ships with a deploy. Until she installs a build
  carrying it, every one of those links just opens the page in Safari as
  before — no broken state either way.

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
  hash, so posting the picture inline AND the link files ONE asset. The full
  labeling rule — including the re-encoded-copy trap no hash can catch — is
  *LABEL every image you deliver* in Design rules; this bullet is the hook
  mechanics, that one is the rule.
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
  ink-and-watercolour page ("datescan0013"). The Playground's **Sandy mirror**
  style (called ChatGPT until 2026-08-24 — the tile called ChatGPT now attaches
  no reference at all),
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
  - **IT HAPPENED AGAIN 2026-08-28, IN A CHAT THAT HAD JUST READ THIS RULE, AND
    THE FIX IS A URL RATHER THAN BETTER INTENTIONS (Sophie: "where's ur
    message").** The reply recommending she switch the environment's Setup
    script to the one-liner naturally CONTAINED the one-liner, so the post was
    blocked and her screenshot showed her message with no answer under it. The
    hook behaved correctly — v10 refuses to record an unconfirmed post, so it
    retried on every later event and was blocked every time, i.e. **a reply
    carrying that string is not delayed, it is unpostable forever.** Describing
    the command in prose is the rule, but a command she has to TYPE is no use
    on a phone, which is why the rule kept losing. So the line is SERVED:
    **`/setup-line.txt`** — she opens it, selects all, copies. A chat handing
    her any pipe-to-shell command links that file and never writes the string.
    **AND THE ONE-LINER IS NOT FOR THE SETUP SCRIPT FIELD (Sophie, the same
    day: "no").** Session init has no network, so a Setup script that fetches
    installs nothing — her flat correction retired that recommendation within
    the hour. The field takes the FULL `/setup.sh` paste; the served line
    stays only for telling a RUNNING session to self-heal.
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
- **THE HARNESS JOINS HER BACK-TO-BACK MESSAGES INTO ONE USER RECORD, and the
  hook's queue reconciliation has to know it (hook v18, 2026-08-27).** Measured
  in this fix's own transcript: she sent two messages in a row, the
  `queue-operation` record held the FIRST alone and the user record held the
  first AND the second joined by a blank line. The reconciliation matched on
  WHOLE normalised text only, so the queue entry found no home, posted as a
  message of its own, and **her first message landed twice** — once alone and
  once inside the joined record. Live count that day: **12 such pairs across
  her 3,768 messages**. A queue entry is matched against a record's SEGMENTS as
  a FALLBACK now, and one record can absorb several of them (`aliases`, a list,
  where there used to be one `alias`). **Whole text still wins first** — two
  passes, so nothing about the old matching moved and a joined record can never
  out-bid the plain record that really is that message; and it stays a multiset,
  so repeating a short phrase can't let the first swallow the second. Test:
  `node scripts/test-chats-first-message.js` (verified failing 2 pre-fix).
- **A CHAT NAMED AFTER ITS SESSION ID SWALLOWS HER MESSAGES — hook v19
  (2026-08-28, Sophie: "issues w chat hooks today · slug").** Measured that
  morning: **3 of the day's 29 chats carried a meaningless slug**
  (`chat-5d92c228`, `chat-9cac7ca2`, `new-session-56f2b0`) against **one in the
  whole four days before it** — and `chat-9cac7ca2` held **exactly one message:
  hers, unanswered for seven hours**, because no session was reading a thread
  nobody could recognise. (It had also self-archived at 01:16 under the bug-fix
  rule; her message landed at 01:56, into a chat that was already asleep.)
  - **The cause was the branch scan accepting ONLY `claude/*`.** A session
    created with no repo attached clones it mid-turn and lands on an ORDINARY
    working branch — `chat-5d92c228`'s own first reply says it: "The repo isn't
    cloned in this container. Let me attach it." Its branch was
    `panels-background-draw`, which `claude/*` never matched, so the name fell
    through to `chat-<sid8>` — and **session-first binding makes that permanent
    on the first post**, so the chat can never recover its own name.
  - **The fix is two halves, and the second one is why the slug does not move.**
    The scan now takes a plain working branch when there is no `claude/` one
    (default branches — main/master/develop/trunk — say nothing about the work
    and are skipped), and `name_repair` fills the **DISPLAY name** on a chat
    already stuck with a fallback. It never touches the slug: a moving slug is
    what orphaned "Imprint". It only ever fills a BLANK name, on a slug that is
    plainly the fallback shape, once per session, backgrounded.
  - **The three already stuck were repaired by hand** with `POST
    /api/chatfeed/rename` — cosmetic, reversible with her pencil, and it re-keys
    nothing. That is the repair for any future one too; a merge is heavier and
    is hers to approve.
  - **The FORK tail is NOT this and is working as designed** — 8 of the day's 29
    chats carry a `-<sid6>` tail because the harness re-uses branch names, which
    is what keeps two sessions out of one thread. What it costs is real though:
    her Playground back-to-top question lived across FOUR slugs
    (`playground-back-to-top`, `-01hhcz`, `-01k54v`, `chat-9cac7ca2`), none of
    them knowing the others' history.
  - **AND THE ENVIRONMENT'S PASTED HOOK IS STALE — v14 against the repo's and
    the served one's v18 (measured the same morning in this container).** The
    Setup script field holds a LITERAL copy, so it froze whenever she last
    pasted it; sessions starting at `/home/user` (multi-repo) or with no repo
    run that copy, missing v15/v16/v18 — the two fixes for her back-to-back
    messages vanishing and landing twice. **Not what broke today** (no duplicate
    shape in the live window), but it is one field of hers: re-paste the Setup
    script into the environment. Sessions starting inside imageforge run the
    repo's copy and are unaffected.
  - **THE NEXT PASTE IS THE LAST ONE (2026-08-28, Sophie: "it's gotta be an
    easier way than paste every time" — and her "no" to a fetching Setup
    script: session init has no network, so a curl in that field installs
    nothing).** The pasted settings now register a command that prefers the
    IMAGEFORGE CHECKOUT's hook (`/home/user/imageforge/.claude/hooks/…`) and
    falls back to the baked copy only when no checkout exists. The checkout is
    cloned fresh from main every session, so once this paste is in, a hook fix
    reaches every imageforge-touching session with the deploy — nothing to
    re-paste per version. Resolved at EVENT time (hooks re-read per event), so
    a repo cloned mid-turn upgrades on its very next event — the exact
    no-repo-at-start shape that produced today's nameless chats. The
    registration UPGRADES an old fixed-path entry rather than sitting beside
    it. Test: `node scripts/test-setup-registration.js` (the block extracted
    from the real generated setup.sh, driven against fixtures).
  - Test: `node scripts/test-chat-slug.js` — the naming block EXTRACTED from the
    live hook (never copied) and driven against real fixture repos; verified
    failing 3 against the pre-fix rule via `FORGE_HOOK_FILE`.
- **A HOOK THAT CRASHES POSTS NOTHING AND EXITS 0 — THE SILENCE LOOKS LIKE A
  DEAD CHAT, NOT A BUG (2026-08-28, Sophie: "ur chat hook is weird").** Her
  chat showed ONE mangled message in the app while its transcript held eleven
  turns. The cause was in v18's own queue reconciliation: `segcells` is built
  from `users` BEFORE the loop, and an unmatched queue entry is APPENDED to
  `users` — so the next entry's segment pass walked a record `segcells` had
  never seen, `segcells[id(u)]` raised a KeyError, and the parser died. The
  hook's python is behind `2>/dev/null` and its output is consumed by the
  shell, so the whole thing printed nothing and exited 0: **no replies, none
  of her messages, silently, for the life of the session.** It needs TWO
  queued messages that match no user record — she sends afterthoughts while a
  turn runs, so it is not rare. `segcells.get(id(u)) or ()` is the fix, in all
  THREE copies (`public/setup.sh`, `docs/chats-autopost-setup-script.sh`,
  `.claude/hooks/post-to-feed.sh`), and `node
  scripts/test-chats-first-message.js` now drives that shape against the real
  hook (verified failing: it posted `[]`).
  - **A LIVE SESSION KEEPS THE BROKEN COPY** — the fix reaches a NEW session
    with the deploy, and an existing one only when it re-runs the setup
    script. A chat that has gone quiet in the app is worth healing before it
    is diagnosed as anything else.
  - **`scripts/backfill-chat-history.sh` HAD ITS OWN SILENT FAILURE, found in
    the same sitting:** `FORGE_BACKFILL=1 ${ACCT:+FORGE_ACCOUNT="$ACCT"} bash
    "$HOOK"` — the conditional expands AFTER bash has parsed assignment
    prefixes, so the shell read `FORGE_ACCOUNT=1` as the COMMAND NAME, died
    with "command not found", and the script still printed "done". It is
    `env FORGE_BACKFILL=1 …` now. **Any recovery tool that can report success
    without having posted is worse than no tool.**
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
  - **AND THAT LINE IS HER OWN SENTENCE NOW, VERBATIM (2026-08-24, Sophie:
    "right now the what I asked sentence is paraphrased. can you make it my
    exact sentence and just truncate it if it gets too long, so basically just
    the beginning of my last message. and have it say what I asked in bold
    above it, and then the see more is as it was").** The other two answers are
    the chat's account of its own work and have to be written; hers is the one
    line nobody needs to write, and a model retelling it can only move it
    further from what she meant — the house *nothing stands between the source
    and the output* rule applied to the summary she reads months later. So the
    server lifts the OPENING of her last message off the thread it already
    stores (`herAskOf` + `lastHerText` in `chatfeed.js`) and files that, on all
    three paths: her Summarize tap, a chat's own `POST /wrapup`, and the freeze
    on the way into the archive. A chat's `asked` is the FALLBACK, for a chat
    she never posted into.
    - **TRUNCATED, NOT CUT AT A SENTENCE, and that is the whole difference from
      `wrapPartOf`.** She dictates, so her punctuation is unreliable and a
      sentence rule leaves "I have a question." as the line — the one shape
      that says nothing. It is the first 200 characters at a word boundary
      with an ellipsis. `wrapAskedHers:true` marks the answer as hers so the
      page truncates rather than sentence-cutting it; `herAsk` in `chats.html`
      is its twin, pinned equal by the test.
    - **A COMPACTION SUMMARY IS NOT HER MESSAGE** — the harness hands it over
      as a user turn and the hook lifts it exactly like something she typed, so
      it would file 7,000 characters of recited rules as what she asked for.
      `isCompacted` is exported from `questions.js` — ONE copy of that rule.
    - **AND WHEN SHE SENDS SEVERAL IN A ROW IT IS THE FIRST OF THEM
      (2026-08-27, Sophie: "recurring issue - multiple messages only log the
      last one in chats app" / "first shud be under what i asked").** She talks
      the way she talks: the request, then the qualifications — "also the glove
      ones", "notify when done", "j" — so reading her LAST message filed the
      afterthought as the one line she reads months later to remember what a
      chat was. `herAskText` in `chatfeed.js` (it REPLACED `lastHerText`, so
      there is one reader for one question) takes the START of her latest RUN:
      her consecutive messages with **no reply between them**, which is exactly
      "the chat never got a word in, so all of it is one ask". The moment a
      reply lands the run ends, so an ordinary back-and-forth is untouched and
      this can only ever reach back over messages nothing has answered.
      Measured over her 215 stored wrap-ups the hour it landed: **14 change**,
      from "pills" to "we made a couple panels yesterday and I think they never
      got cut", from "view" to "pressing the playground button on images made
      by panels should copy the prompt", from "j" to "dreamt style".
      **Deliberately NOT time-bounded** — a stretch the chat worked through
      without replying is still one ask, and a clock here is a rule she never
      asked for.
      - **A BARE SLASH COMMAND IS NOT AN ASK** (`SLASH_ONLY` / `isAskable`).
        She types `/concise` and the harness hands it over as an ordinary user
        turn, so the hook lifts it like anything she said — and one of the 14
        chats measured above opened its run on exactly that. Only a message
        that is NOTHING BUT a command is skipped; one that merely mentions one
        is hers. Same family as `isCompacted`, applied in the same place.
      - **AND THE RECORDS ALREADY ON FILE CARRY THE LAST OF A RUN** — a
        wrap-up is STORED, not derived on read, so `POST /wrapup/rehers` grew
        `redo:true`, which reopens the summaries already marked
        `wrapAskedHers`. Dry by default and free, like the rest of that pass;
        `wrapAskedWas` keeps the ORIGINAL paraphrase and is written once, so a
        re-pointing pass cannot overwrite the undo with the sentence it is
        replacing.
    - **The bold question over the line** is `UPD_LABELS[0][1]` ("What you
      asked"), the Update tab's own vocabulary, drawn ONLY when the line really
      is the asked answer (`wrapLineIsAsk`) — labelling a line that fell
      through to what the chat DID with a question it does not answer is worse
      than no label. "See more…" is untouched, still inline on that line.
    - **AND THE ONES ALREADY ON FILE NEEDED THEIR OWN PASS — `POST
      /wrapup/rehers` (2026-08-24, her SECOND ask the next day: "what I asked,
      which is the default note at the top of every chat, is paraphrased … make
      it not paraphrase, just my actual words truncated").** The live paths were
      already right and she was still looking at a paraphrase, because **a
      wrap-up is STORED, not derived on read** — nothing rewrites one, so every
      summary written before the fix kept its model sentence forever. Measured
      the hour she asked: **9 chats carried her words, 70 carried a paraphrase.**
      **A shipped fix to a WRITE path leaves the existing records wrong — ask
      what is already on file before saying it is fixed.**
      Free (pure text surgery, no model call), dry by default, `{chat}` for one
      — the `/wrapup/trim` pattern. Three rules, each about not overreaching:
      it touches **only `wrapAsked`** plus the `wrapUp` prose mirror when that
      mirror provably IS the three answers joined (`wrapDid` / `wrapNext` /
      `wrapLine` / `wrapLong` are the chat's own account of its work and are
      never reworded); it reads her message **as of `wrapUpAt`**, not her
      newest (`lastHerText`'s `before` — a summary is a moment, and pairing
      today's question with last week's answers reads as nonsense); and a chat
      she never posted into is **left alone and NAMED** in the answer, since
      the chat's own `asked` is the honest fallback there exactly as on the
      live paths.
      **AND NOTHING IS DESTROYED — the paraphrase moves to `wrapAskedWas`.**
      Measured over the 62 it rewrites: ~56 are plainly better and about SIX
      come out WORSE, because her last message before that summary was a
      sign-off ("ok build is here now. anything else to do?") or a
      machine-authored prompt the hook lifted as hers (a routine's deploy
      check-in, a handoff brief pasted as a user turn — the same family as the
      compaction summary `isCompacted` already excludes). Those really are the
      words that were sent as her turn, so **the pass applies her rule
      everywhere rather than inventing a quality bar over her own messages** —
      the detector-over-her-words mistake this repo has already made twice (see
      *Answering a question*). Keeping the old line is what makes that the
      cheap, reversible call instead of a permanent one.
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
  - **ONE RENDERER, AND THE WHOLE EDITOR IS THE KEEPING STEP ONLY (Aug 2026,
    two corrections, the second the settled rule).** First the tags: "those tags
    were supposed to only show up in the step when I'm actively bookmarking it.
    Either a chat or an artifact" — so they came off every later paint while the
    note box stayed. Then the box itself: **"the why keep this bookmark button
    should only show up at the time that I'm bookmarking it or if I un bookmark
    and bookmark again"** — the same sentence about the other half of the same
    node. So `mkBmkEdit(m, kind)` is drawn on ONE event, the tap that keeps the
    thing, and a message or artifact she kept last week carries NOTHING under
    it. An empty "Why keep this?" field under every kept thing is a box asking a
    question she already answered, sitting under things she is only trying to
    read.
    - **UN-KEEPING AND KEEPING AGAIN IS THE WAY BACK IN, and it loses nothing** —
      the bookmark toggle sends `bookmarked` alone, so her note survives and the
      re-opened box holds it. That re-keep is her own named gesture, not a
      workaround.
    - **NOTHING IS HIDDEN FOR GOOD:** her note leads that thing's row in the
      keep-pile in its own editable field (`.sr-note-in`), so naming a backlog
      never means opening each message. The pile is where a note is READ BACK;
      the keeping tap is where it is WRITTEN.
    - One node so un-keeping takes the whole editor with it; one renderer so a
      message and an artifact can never end up with two different sets of
      controls.
  - **THE READ BOX IS WHAT THE KEEP-PILE'S ROWS CARRY INSTEAD (Aug 2026,
    Sophie: "a rounded square check box that is empty with a gray outline and
    becomes red with a check in it when I read it I'll mark it manually").**
    `bmkRead`, hers to tick, on a message and on an artifact — a kept CHAT gets
    none, because a chat is not a thing you finish reading once. **Nothing
    derives it**: opening a thing is not reading it, so no view, scroll or tap
    anywhere else may set it. A rounded rectangle at the house 6px, never a
    circle (see *No pills* in Design rules — the old circular-icon exception
    was retired 2026-08-24). Her tick is what takes
    a thing out of the **To read** door's count.
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
    `POST /page/:id/bookmark`) take `note`, `tags`, `level` and `read`, and
    carry no keep-flag unless one is sent — so tagging can never un-keep a
    thing, naming one can never drop its tags, and a tick can never do either.
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
  - **THE ROW ENDS BEFORE THE PILL'S COLUMN, MEASURED (2026-08-26, Sophie's
    screenshot of `people-watching-club-reel`: the row read "PWC ep006 — the
    building across the street (0:41)Fastest").** That tail is `#spd`, the
    autoscroll pill's own speed label, drawn under the capsule in the fixed
    top-right corner — and the pinned row was `width:100%`, so **47px of it sat
    inside that column** and her title's last words were unreadable. It is the
    same collision the QUESTIONS button had, so it is the same answer:
    `fitPillGap` in `chats.html` is now ONE measured pass shared by both rows
    (`pillRows`), never a hardcoded band — the pill is conditional and its top
    rides `env(safe-area-inset-top)`. **The BOX shortens rather than padding**,
    because this row has an outline and a padded one keeps drawing its border
    under the pill. A header row added later joins by pushing itself onto
    `pillRows`. Test: `node scripts/test-chats-pin-pill.js` (verified failing 4
    against the pre-fix page; the tap asked with `elementFromPoint`, which is
    what a covered row passes every width assertion while failing).
  - Tests: `node scripts/test-pin-current.js` (the kind + tag rules, pure) and
    `node scripts/test-chats-pin.js` (the real page, headless).
- **THE PROMPT ON A PAUSED FILM — what drew the picture she just stopped on
  (`filmshots.js`, `/api/filmshots`, 2026-08-27, Sophie: "in the play pause
  feedback pinned video tool, add a way to see image prompts. example: hate
  of the game").** The paused screen already offered a NOTE; it now also
  offers **Prompt**, opposite it, and behind it the picture's label, its
  MODEL · QUALITY · SIZE caption and both halves of its exact prompt.
  - **THE WORDS ARE NEVER COPIED — only the TIMES are stored.** A film's doc
    (`forge-film-shots`, id = sha1(the film's url)) holds `[{at, url}]` and
    nothing else; the label, caption and both prompt halves are resolved from
    the chat's own filed pictures (`forge-chat-assets`) on every read. So a
    prompt corrected in the Assets tab is corrected in the player, and the
    exact-prompt rule keeps ONE copy of the text (*nothing stands between the
    source and the output*). The join is url, then FILENAME — one picture,
    two roads, `asset-union.js`'s own subject.
  - **NO MAP, OR NOTHING FILED FOR THAT SHOT → NO BUTTON.** The Assets tab's
    own silence: reading one picture's prompt believing it belongs to another
    is the one failure this must not have, and a label alone is not a prompt.
    Every film made before this simply looks as it always did.
  - **TWO DOORS IN.** A chat that CUTS a film knows its shot list and POSTs it
    the same turn it pins the film (checklist 3f) — exact, free. An EXISTING
    film is MEASURED: `scripts/film-shots-detect.js` finds the cuts with
    ffmpeg and matches each shot's own frame against the chat's filed
    pictures by perceptual hash (dHash). On her example — Hate of the Game —
    the reel v1, 5:42 — 39 cuts → 40 shots and **40 of 40 matched the right
    picture**, each the nearest candidate by a clear margin. **A shot it is
    not sure about is LEFT OUT, never guessed in** (`--loose` overrides; say
    so if you use it). No model call anywhere; it is bandwidth and ffmpeg on
    our own box.
  - **It rides BOTH hosts of the player** — the Chats app's pinned film and
    compare.js's video lightbox — because the door lives in the ONE shared
    `public/filmnote.js`, beside tap-to-note.
  - **The words stop above the button row, not at the bottom of the screen**:
    the scrubber, play and NOTE stay hers while she reads ("this prompt is
    wrong" is the likeliest thing she has to say about the picture she is
    standing on). Content opens by default and the half she picks rides along
    as she steps; a tap on the words puts them away and never reaches the
    film's own pause/play toggle underneath.
  - Tests: `node scripts/test-filmshots.js` (the map, the join and the
    detector's refusals — pure) and `node scripts/test-film-prompt.js` (the
    real page + the real filmnote.js, headless).
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
  and switched per word in the Organize sheet (`POST /pile`).
  **MAKING A WORD A PILE RE-FILES WHAT ALREADY WEARS IT (2026-08-26, Sophie:
  "middle one goes first chat should've left because I tagged it as PWC
  reel").** The word was already on that chat — the auto-sorter put it there
  the day before — and what she did was flip `pwc reel` ON in the "Which words
  file a chat away?" sheet. That flip wrote `pileLabels` and **nothing else**,
  so every chat wearing the word became filed while still carrying the
  `filedAt` it was given back when the word meant nothing; any reply newer than
  that stamp makes `chatBack` true, the chat pops onto the main list, and it
  never leaves. The sheet's own subtitle promises "a lit word takes a chat off
  the main list until it answers you" — and that chat had answered a day before
  the promise existed. **Measured live: of the 8 chats wearing `pwc reel`, the
  only one that did not leave was the only one whose reply post-dated its
  stamp.** So the flip now renews `filedAt` on every chat wearing the word,
  exactly as filing by hand already does (`saveLabels` writes the stamp itself
  for the same reason). Three things not to undo: it writes `filedAt` **alone**
  and never `labelPatch`, so it cannot stamp `catBy:'sophie'` and lock the
  auto-sorter out of the ten chats it filed itself; turning a word **OFF**
  stamps nothing, since those chats hand themselves back by `chatFiled` going
  false; and the page mirrors the stamp optimistically or the row sits there
  until the next reload. Pinned by `node scripts/test-chats-labels.js`
  (verified failing 2 pre-fix).
  **The OTHER half of that report is her own rule working as written and was
  left alone:** 11 more filed chats are sitting on her main list because they
  answered after she filed them, some since Aug 15 — a pop-out ends only when
  she re-files or responds ("it should stay in both places until I file it away
  again or respond"), and nothing expires one. Changing that is hers to ask
  for. **And `to be
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
  **AND `waiting for a response` WEARS A MARK WHEREVER THE CHAT APPEARS
  (2026-08-24, Sophie: "are there any extra instructions for if I tag a chat
  waiting for a response? Since I'm waiting for it I'd like a chat that's
  tagged like that to come with some extra indication").** The pin was the
  whole of the rule, and a pin only exists on the Update tab — so on the home
  list, and inside the thread itself, a chat she was owed an answer from
  looked like every other chat. It is a Lucide **`watch`** — a wristwatch — in
  the marks' red at the front of the row, beside the star and the bookmark (the
  slot for a state with no control of its own), and in the thread's `<h1>`.
  **THERE IS NO "SOMEONE POINTING AT THEIR WATCH" ICON, and that is measured**
  (her next question the same day): all 2,035 Lucide glyphs read, none holds a
  figure, because the gesture needs a body, an arm and a dial and a line set
  cannot say three things at 14px. Hand-drawn it fails too — rendered at
  14/18/28/64 the figure is mud at the mark's real size and reads as someone
  with a MAGNIFYING GLASS blown up. So the watch alone carries it: the object
  out of her own picture, legible small. It shipped as an hourglass for one
  afternoon. Three things
  worth not undoing: it follows the **TAG**, not the Update tab's card — her ✓
  there settles the CARD and the debt is over when the word comes off, the
  same rule the sibling `Waiting for:` line has always followed; it reads the
  rule off `TAG_RULES` rather than off the string, so the mark and the pin can
  never disagree about which word means this; and it is a `<span>`, because a
  row is a `<button>` and a nested button would eat the tap. `waitMarkHtml` is
  the one renderer and `syncWaitMark` repaints the thread header, which is
  built once — the Organize sheet opens from inside that same thread, so
  without it the screen she is standing on is the last to know. **A chat CAN
  see its labels since 2026-08-27** — `GET /api/chatfeed/status` returns
  `labels` (added for the bug-fix auto-archive and quick-question bell rules);
  this line used to say it carried none. Reading them is fine; FILING is still
  hers and the auto-sorter's. Test:
  `node scripts/test-chats-waiting-mark.js`.
- **A BUG-FIX CHAT WEARS A BUG AND PUTS ITSELF AWAY (2026-08-27, Sophie: "add
  a tag on the chat ex bug fix - a picture of a bug in the list. start w just
  bugs" · "a bug fix tag button on the right in the header on all 3 account
  pages" · "chats tagged bug fix shud auto archive themselves if there's no
  problems or questions").** Three halves, one tag:
  - **THE MARK.** A chat labelled `bug fix` (or `bugfix`/`bug`/`bugs` — her
    dictation) draws a small Lucide bug at the front of its row, in the tile's
    name and in the thread's `<h1>` — the watch's slot, but in the quiet ink,
    not the marks' red: a bug fix is what the chat IS, never a debt she is
    owed. `TAG_MARKS` in `chats.html` is the table (one renderer,
    `tagMarkHtml`), and **the next picture-tag is a row in that table** —
    "start w just bugs" means the bug is the first, not the only shape the
    table will ever hold.
  - **THE BUTTON.** A bug icon at the right of the header's tool row on the
    chat list — the three account tabs are views of that list, so it rides
    all three (the Instagram icon's float, `#bugbtn`). Tapping it narrows the
    screen to the OPEN bug-fix chats; lit while on, sticky with the row's
    third tab (2026-08-28), and it LEAVES THE ARCHIVE ALONE — see the
    reversal in the three-lists section: the emptying as chats auto-archive
    is the feature, not a hole to plug.
  - **THE AUTO-ARCHIVE is the CHAT'S OWN job, at wrap-up** (see 3d in the
    checklist): tagged `bug fix` + nothing open (fix works and is merged, no
    problem left, no unanswered question of hers, `need` empty) → wrap-up,
    then `POST /api/chatfeed/archive {chat, archived:true}`. Anything open →
    stay live and name it. Nothing server-side archives for you — a wrong
    auto-archive hides a chat she is still waiting on, so the judgement stays
    with the chat that did the work. She finds them again on the bug button,
    in the archive, or by un-archiving.
  Tests: `node scripts/test-chats-bug-tag.js` (the real page, headless).
- **EVERY CHAT LIST IS SEPARATED BY DATE, AND THE DAY TURNS OVER AT 5AM
  PACIFIC (2026-08-28, Sophie: "separate chats by date" · "5am pst cut off").**
  A hairline heading — Today · Yesterday · Tue, Aug 26 — over the rows of each
  working day. The list was already newest-first, so this only NAMES where one
  day stops; nothing about the sort moved.
  - **The cut is hers and it is the whole point.** She works past midnight, so
    a reply at 2am belongs to the day she is still having — the clock's own
    midnight would cut one working night into two headings, which is exactly
    what a date heading exists to stop.
  - **Read through the IANA zone (`America/Los_Angeles`), never a fixed -8** —
    she says PST and it is PDT half the year, and an offset would put every
    heading an hour out all summer (the chat-icons sweep's own lesson). The
    hour is asked in WALL CLOCK terms rather than by shifting the instant five
    hours, so it still lands on 5am on a DST day.
  - **A PINNED chat gets its own `Pinned` heading, never a date one.** It sits
    above the sort by her override, so its date says nothing about where it is
    — read as a date it would put an older heading above a newer one and then
    repeat the newer one underneath it.
  - `dayKey` / `dayLabel` / `chatDayKey` / `mkDayRule` in `chats.html` are the
    one implementation, and the headings are drawn inside `renderList` and
    `renderTiles` — so every pile gets them from one place (live, ALL, ★, bug
    fix, the hidden pile, the archive) and a new pile needs nothing.
  - Test: `node scripts/test-chats-day-rules.js` (the real page headless, with
    an INDEPENDENT copy of the 5am rule in the test rather than the page's own
    arithmetic read back to itself; verified failing 10 pre-fix).
- **THE CHAT AREA IS THREE LISTS, AND THE ROW TAKES TURNS WITH THE ACCOUNTS
  (2026-08-28, Sophie: "i'm thinking about restructuring chat area based on bug
  fixes and deliverables, so they're on two separate lists" · "one tab ALL
  chats, in timing order · one - list of deliverables AS they're delivered. so
  - just the link to a movie, previews of images and whatnot · bug fix tab
  third" · "also have a toggle next to account switcher that goes back to 3
  tabs 1 per account").** One hairline row under the header with two modes,
  swapped by `#rowtog` beside the account switcher — the three LISTS, or the
  ACCOUNT tabs it has always been. Sticky, opening on the lists.
  - **ALL IS NOT THE HOME INBOX, and that is the tab.** The ordinary home list
    is the UNFILED pile, so a pile word takes a chat off it; ALL is every chat
    on the account in timing order, filed or not — her word, in caps. The
    ARCHIVE and the TRASH stay their own rooms (she put those away on
    purpose), and **a lit category chip still narrows it** — the chip row is on
    screen there, and a filter she can see that does nothing is the
    silent-filter failure this app keeps getting burned by.
  - **DELIVERED is the only tab whose rows are THINGS, not threads** — the
    films and cuts from `forge-deliverables` (a pinned film is a hand-over, so
    nothing new is filed) interleaved by time with PICTURE rows derived the way
    the Update tab's strip is. **A picture row is a BURST, not a chat**: a
    chat's images split wherever it went `BURST_MS` without filing another, so
    the morning's nine and the evening's three are two rows — "as they're
    delivered" is the ask. Three thumbs, her size, and the row says how many
    there really were. **There is deliberately NO image door into the
    deliverables collection** — 2,488 filed pictures would bury the films — and
    her SOURCE LIBRARIES (the Dump, crystals, ingest), derived `thumbs/` copies
    and audio records are not deliveries. **NOR IS ANYTHING UNLABELED, and
    that is the load-bearing rule** — the house rule that a chat labels every
    image it delivers, used as the test for whether a picture was handed over
    at all. Measured live the hour it shipped: of 18 picture rows, the 7 with
    nothing labeled were ALL background catches (a generated chat icon, a
    film's cover frame, a poster) and every labeled row read as a real
    hand-over. A path blacklist would grow a line per surface forever.
    **TWO RULES SHE ADDED THE HOUR IT SHIPPED** (2026-08-28: "newest replaces
    oldest" · "disappears if i write back"): a film already collapses by title
    stem and a chat's PICTURES collapse by chat, so a second batch REPLACES the
    first — nothing dropped, the earlier ones ride along as `older` and the row
    says how many; and a row LEAVES the list once she has written back to that
    chat since it landed (`lastHerAt`, her real send time, stamped by the one
    route both her doors come through). So the tab is what has been handed to
    her and not yet dealt with, and it empties itself; a chat that delivers
    again after she wrote back comes back on its own.
    `deliverables-feed.js` is the whole
    rule (pure); `GET /api/deliverables/feed` is the read, two cached queries
    and no model call.
  - **AND THE BUG PILE DOES NOT REACH INTO THE ARCHIVE (2026-08-28, Sophie:
    "archive doesn't pop out ur insane that's the point of archive").** It
    shipped reaching in — the 2026-08-27 reasoning was that bug-fix chats
    archive themselves when a fix lands clean, so a live-only pile would empty
    itself exactly as that rule starts working. She overruled it: an archived
    chat is one she put away, and a pile that hands it back is the archive not
    working. **The emptying IS the feature** — the tab is the bug work still
    open, and a finished one is in the archive, which has its own `bug fix`
    filter chip. That old reasoning is history, not a rule.
  - **THE BUG PILE IS ONE STATE UNDER TWO DOORS** — the header's bug button
    (2026-08-27) and this row's third tab both write `listTab`, and the button
    brings the row with it, so the pile she is looking at is always named on
    screen. `bugOnly` is gone; `bugPile()` is the reader.
  - **THE HIDDEN PILE RIDES ALL, BEHIND THE SAME BAR** (2026-08-28, Sophie:
    "put hidden back in the new tab structure · same ui"). It went missing
    because this tab renders its own list rather than falling through to the
    live branch, where the fold lives. `renderHiddenBar` is CALLED, never
    copied — the count, the "N new", the working glow and the
    open-pile-is-the-whole-screen rule are one implementation, so a chat she
    parks behaves the same wherever she is standing.
  - **ONE ROW, SO ONE WRITER (2026-08-28, her screenshot: both rows stacked).**
    `paintHomeChrome` un-hides the account row and EVERY repaint comes through
    it, while `paintListTabs` only runs on the four branches that rebuild the
    list — so the poll, a note save or leaving a search put the account row
    back underneath the lists. `listsOn()` is asked inside `paintHomeChrome`
    now, and the search's own `showAcc` asks it too; nothing else may write
    that row's display.
  - **EVERY DELIVERED ROW HAS A WAY BACK TO ITS CHAT** (2026-08-28, Sophie:
    "add back to chat icon in deliverables tab") — a film row's own tap PLAYS
    the film, so without it a delivery had no route to the one place she can
    say anything about it. Its own `<button>`, a sibling of the row's, never
    nested: a button inside a button is invalid and the tap would bubble into
    the player.
  - **THE UPDATE TAB LIVES ON THE ACCOUNT ROW**, so it is one toggle-tap away
    while the lists are showing — and entering any other view (Update, the
    archive, bookmarks, the to-do) puts the account row back whatever mode she
    left this in. `paintListTabs` speaks ONLY for the live chat list; anywhere
    else `paintHomeChrome`'s answer stands, and it hides that row with
    `style.display`, which beats the `hidden` attribute (the house rule).
  - Tests: `node scripts/test-deliverables-feed.js` (the bursts and the
    exclusions, pure) and `node scripts/test-chats-list-tabs.js` (the real
    page, headless — verified failing against the pre-fix page).
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
  - **Or she said a CODE WORD** — "file this" / "save that answer" / "for the
    questions tab" — which files the exchange even when nothing in it was
    shaped like a question. Same shape of reply: bold the thing she wants kept
    on its own line, answer under it.
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
  - **SHE HAS TO BE ASKING, NOT TALKING ABOUT ASKING — the gate is her
    PHRASES, not the bare word (2026-08-24, Sophie: "i noticed ur still
    structuring ur response w bold questions. is that cuz ur rules are out of
    date?").** The rules were not out of date; the gate fired exactly as
    written, and that WAS the bug. Measured in this chat's own tab that day:
    **all 3 rows were false positives**, none of them a question she had marked
    — "…ur still structuring ur response w bold questions" (describing), "it
    didn't actually answer the question" (complaining), "it ONLY applies if i
    use the word question in my text" (specifying). So `ASKING` — the phrase
    list that already picked WHICH sentence — decides whether the message counts
    at all, plus `BARE_FRAME`, a WHOLE sentence that is nothing but a count of
    them ("Two questions." / "Questions:"). **`BARE_FRAME` is anchored at both
    ends and that is load-bearing**: any looser rule matches the trailing
    `question.` of "it didn't actually answer the question." Measured over her
    120 recent chats, 399 of her messages: **36 flagged → 17**, and the
    survivors read as her genuinely marking one.
  - **THE HAND-OFF IS A LAST RESORT.** Bare framing gives the row to the next
    sentence ONLY when nothing else in the message reads as a question —
    otherwise her setup line ("so basically, I have this idea…") files as a
    second row beside the real ask.
  - **A CODE WORD FILES ON PURPOSE (2026-08-24, her idea: "maybe a code word
    that triggers the chat to file the answer intentionally?").** `file this` ·
    `file that` · `save that answer` · `for the questions tab` — it reaches the
    case no phrase rule can: an exchange that was never shaped like a question,
    where she reads an explanation and decides she wants it back. **A SMALL
    VOCABULARY, NOT ONE MAGIC STRING** — she dictates and paraphrases, so a
    single exact string would silently drop the second spelling. It runs first
    and then falls THROUGH, so a message carrying both still picks the real ask.
  - **A CONTEXT-COMPACTION SUMMARY IS NOT HER MESSAGE (found live 2026-08-24 in
    this feature's own chat).** When a session runs out of context the harness
    hands the model a summary as a USER turn, so the hook lifts it exactly like
    something she typed — 7,232 characters reciting her earlier words, this
    file's rules, and the trigger phrases as examples, which fires every gate
    several times. `COMPACTED` in `questions.js` matches the harness's own
    opening line, **anchored at the start** so a message merely talking about
    compaction is untouched. Measured over her 120 recent chats: only **4 of
    408** of her messages are one, but they produced **5 of the 35** rows — a
    summary quotes, so it trips far above its weight (35 → 30 after).
    **The deeper half is NOT fixed**: the feed still shows the summary as hers
    in the thread and under the search's Mine filter. Only the derived half
    was in reach without a hook change.
  - **The cost, named:** a message that QUOTES the trigger phrases — her own
    spec above literally contains "i have a question" and "my question is:" as
    examples — is indistinguishable from asking one. Irreducible by any phrase
    rule, rare (a message about this feature), and an unanswered row is never
    shown anyway.
  - **THE ANSWER CAN LIVE ANYWHERE IN THE REPLY — `bestParagraph` scores every
    paragraph against the question and takes the one that talks about it
    (2026-08-23, Sophie, looking at a row still opening on progress lines:
    "did u check the answer? it didn't actually answer the question. ull have
    to be smarter about this whole thing").** The reply-opening fallback
    assumed answer-first always holds; on a working turn's reply it often
    doesn't — her "are 2k and 4k the only sizes" was answered with "Now the
    size tiers on the server:" while the reply's FIFTH paragraph literally
    began "2K and 4K are not the only sizes — it's continuous." It is
    `matchBlock` without the bold requirement: ≥3 distinct question words must
    hit (two is a coincidence — "answer"+"question" co-occur in half her
    threads), the score's denominator is capped at 8 (her dictated questions
    run long, and an uncapped fraction buries a real 4-word match under 13
    words of framing), the TLDR competes as a candidate, and below the bar it
    returns null so the old chain runs unchanged — which is also why no row
    can REGRESS: the new path only fires when the paragraph provably shares
    the question's words. **The stem lands singular and plural on one root**
    — the old one sent "images"→`imag` but "image"→`image`, losing the two
    hits on exactly the paragraph that answered her. Measured over her 120
    recent chats, 36 answered rows: answers sharing ≥3 content words with
    their question went 11 → 20. Free, derived, no model call.
  - **A PARAGRAPH ENDING IN A COLON IS AN INTRODUCTION — the fallback keeps
    READING (same day, the earlier half of the fix).** When nothing scores,
    `firstPara` reads past colon-ended lead-ins, up to three paragraphs, and
    only ever reads FURTHER — a mid-turn progress line and a real lead-in
    ("Two things:") are the same shape, so keeping both is merely noisy where
    dropping would be wrong. Going forward the bold echo on questions she
    marks hands `matchBlock` the exact answer before either fallback runs.
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
  `look at` and `come back to`, are off limits to it.
  **WHAT THE WORK IS BEATS WHERE IT HAPPENED (2026-08-24, Sophie: "if it's in
  the story room but it's just a bug fix for the story room then they shouldn't
  tag it story, they should just tag it bug fix — and that applies to all the
  other categories obviously").** Her vocabulary holds two different kinds of
  word and the sorter could not tell them apart: some name a SUBJECT AREA
  (`witch` · `story` · `film` · `dream app` · `tech` · `meta`) and some name
  WHAT THE WORK IS (`bug fix` · `new feature` · `research` · `failure` ·
  `built` · `quick question`). Every chat has a subject, so the subject always
  looked like the safe answer — which fills `story` with plumbing and leaves
  `bug fix`, the pile she reaches for when she wants to know what has been
  going wrong, empty. **It is enforced in CODE, not only in the prompt**: the
  model answers `kind` in its own field and `pickCategory` prefers it, so
  forgetting the rule would take an active "none". Three things not to undo — a
  `kind` that names a SUBJECT is ignored (or the field built to beat subjects
  carries one), an invented kind is refused like any other folder, and a kind
  with no subject beside it still files. `WORK_KINDS` is a HINT over her live
  vocabulary, never an addition to it; `GET /api/chatfeed/sort` prints
  `workKinds` so the day it goes stale against her words is measurable.
  Full rules in `docs/chats-app.md`; `GET /api/chatfeed/sort` shows the
  vocabulary and the counts; test `node scripts/test-chat-sort.js`.
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
  - **HER NOTES USUALLY ARRIVE *AFTER* THE MESSAGE THAT ANNOUNCES THEM — SWEEP
    AGAIN BEFORE YOU SAY YOU ARE DONE (2026-08-28, TO FIX).** Measured on the
    hate-of-the-game reel: she wrote "added some notes … i suggested 3 examples
    in the notes" at **23:17:29**, and the seven notes themselves landed
    **23:29:54-23:31:11 — twelve minutes later**. The chat swept at 23:18,
    correctly found nothing, told her so, and built 135 pictures ignoring
    every one of her specific asks. Reading them at turn START is not enough:
    she announces the intent, then watches the film and writes while the chat
    works. **Re-read `GET /api/gallery/assets/notes?chat=` right before you
    report finished**, and treat "no notes yet" as "not yet", never as "she
    left none".
    - **A NOTE ON A FILM IS NOT ON AN ASSET TILE, so the assets listing never
      shows it.** Those seven landed on the PINNED REEL's url with no
      `description` (the `[0:18] …` timestamp form `filmnote.js` writes). They
      ride the same `forge-asset-votes` doc, so **`/notes` finds them and
      `GET /api/gallery/assets?chat=` does not** — a sweep that walks the
      Assets tab looking for `note`/`thread` fields is blind to every note she
      leaves on a film.
    - **THE BELL IS BUILT NOW (2026-08-28, Sophie: "fix the note bell").** A
      note she writes rings the owning chat's wake doorbell, so a note landing
      while the chat is asleep can reach it instead of waiting for her to
      message again. It lives in **`appendAssetMessage` in server.js** — the
      ONE place all four note paths funnel through (her text note, the legacy
      single note, a voice note, and a film note's timestamped line), so the
      bell has no holes. Three things not to undo: it rings only for
      `who === 'sophie'` (a chat answering on an image would wake itself in a
      loop), it is **never awaited** and its failure is caught (a note must
      land on the doc whether or not anything is wakeable — witchvideo.js's
      `ringChat` has exactly this shape), and it goes through `chat-wake.ring`
      with `registry` + `followMoves` so a forked or re-keyed chat still
      resolves. Pinned by `node scripts/test-asset-note-bell.js`.
    - **THE BELL IS NOT A SUBSTITUTE FOR THE RE-READ.** A chat mid-turn is
      already awake, so nothing wakes it — the doorbell only helps a chat that
      has finished. The note that got ignored landed while a chat was working.
      So the re-read before reporting done is still the protection, and the
      bell is what covers the case after.
    - **AND DO NOT "VERIFY" WITH AN ORDERED FIRESTORE QUERY.** The same
      session reported the notes collection **empty** from
      `.orderBy('updatedAt','desc')` — but the docs carry `updated`, not
      `updatedAt`, and **Firestore silently omits every document missing the
      orderBy field**. The collection held **1,262 docs**. That wrong reading
      is what turned "not yet" into a confident "nothing saved anywhere".
      Count with a bare `.get()` before concluding anything is empty.
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
  still the default. **THE PHRASE RANKS FIRST, AND NOTHING ELSE JUMPS THE
  QUEUE — TWO TIERS (Aug 2026, Sophie: "typing `maybe never` finds … the chats
  where those words appear in the same order as typed should appear at the top
  and the ones where they appear anywhere should appear underneath").** The
  grammar is unchanged and nothing is filtered out; `/search` sorts into **the
  phrase** (adjacent, in her order — exactly what quoting would have found,
  which is why she no longer has to quote) and then **everything else, newest
  first**. The old sort was recency alone, so `maybe never` answered with
  "saving maybe $3-5 a month" above the message that literally says "maybe
  never".
  - **IT SHIPPED WITH A THIRD, MIDDLE TIER AND SHE RETIRED IT (2026-08-24: "you
    mentioned if it's there but there are words between it vs. different order.
    that's stupid … only if no words moves it up").** Her sentence above names
    TWO buckets; the build read "in the same order as typed" as a rung of its
    own, separate from the phrase, so "maybe you'll never" was lifted above a
    newer, plainer message. Scattered-in-order is not a meaningful kind of
    match and lifting it only pushed better answers down. The left-to-right
    walk that detected it is gone with it.
  - **ONE ROW PER CHAT, ITS NEWEST (Aug 2026, Sophie: "if the same word is
    found in the same chat, only show the most recent result").** A chat that
    said her word twenty times filled the whole first screen with twenty rows
    of itself, so every OTHER chat that said it once was pushed off the answer
    — and the twenty rows are one finding twenty times over. `bestPerChat`
    runs BEFORE the 80 cap (deduping after it would answer with fewer rows and
    still hide whole chats). It keeps the best-ranked row and the newest among
    equals, which with two tiers is "the most recent" in almost every search;
    it differs only where a chat holds the exact phrase in an older message and
    a loose scatter in a newer one, and there the newer row would open the chat
    on something she did not search for.
  - **AND THE SNIPPET OPENS ON THE PHRASE when the message has one** (found
    by reading the live answer to her own `maybe never` search, the hour it
    shipped). The top row was first BECAUSE her two words sit adjacent in it,
    and the window was opening on a scattered occurrence further up the same
    message — so the result the ranking was proudest of read as though it did
    not answer the search that put it there. `snippetAnchor` takes the phrase
    regex and prefers it; with no phrase in the message it is the old
    rare-term rule, untouched. A rank and a snippet that disagree are worse
    than either alone, because she judges a row by the words she can see.
  - **AND A WHOLE WORD BEATS A PREFIX, IN THE WINDOW AND IN THE BOLD
    (2026-08-28, her `red dress` screenshot).** Every term is anchored at a
    word START and nowhere else — right for MATCHING, since the prefix `bound`
    must still find "boundaries" — so `red` really does match "redraw", and
    five of her eight rows opened on "redraw"/"redo"/"reduces" with `dress`
    nowhere on screen. **The rows were right and the presentation was lying**:
    every one of them held both her words. Two halves, and each is one rule
    disagreeing with itself:
    - **The WINDOW.** Measured on the row she screenshotted: `red` once,
      inside "redraw", 2,000 characters from the only `dress` — a rarity TIE,
      which the old rule broke by taking the term she typed FIRST. A hit that
      lands on a whole word now wins outright, a term prefers its own
      whole-word occurrence over an earlier prefix one, and rarity only
      decides between two of a kind.
    - **The BOLD.** `hl` in `chats.html` had NO anchor at all, so `red` lit up
      inside "tired" — a word the search itself would never have matched. The
      highlight and the match must be the same question asked twice, or the
      mark claims a row was found for a reason it was not.
    - **AND WHEN NEITHER HIT IS A WHOLE WORD, SHE GETS A WINDOW EACH.** The
      rule above cannot reach her own row: `red` inside "redraw" and `dress`
      inside "dressed" are both prefixes, so the tie falls back to rarity, both
      are 1, and the window opens on "redraw" again. No ordering of ONE window
      answers that — the two words are 2,000 characters apart — so a message
      whose terms are far apart is cut into one window per word, joined by an
      ellipsis, narrower (35/55 rather than 45/70) so the pair still fits the
      row's one line. Windows that overlap merge back into one, a phrase hit
      stays one window, and a one-word query is byte-for-byte what it was.
    Tests: `node scripts/test-search-grammar.js` and `node
    scripts/test-chats-live-search.js` (both verified failing pre-fix).
  - **Two things not to undo:** the phrase is its own regex pass (a
    left-to-right walk takes the EARLIEST match of each word and would miss an
    adjacent pair further along — "maybe … never … maybe never" is the
    phrase), and the scores go in a parallel array rather than onto the
    `searchIndex` rows, which are the long-lived shared index where a leftover
    score would sort the next query. A one-word query has nothing to rank and
    is untouched. Test: `node scripts/test-search-rank.js` (pure).
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
- **THE SEARCH FILTERS — OPT IN, THREE-WAY, AND THE ROW THE NEXT ONES JOIN
  (Aug 2026, Sophie: "I'd like to add some filters to the search in the chats
  thing that are optional … one would be a filter allowing me to search
  through my messages versus Claude's messages" → "now: make the filters opt
  in" → "another filter to add can be archived as in does it search the
  archive or not or just the archive").** One `Filters` chip under the search
  box; the drawer under it is SHUT until she taps it. On the `/chats` home bar
  and inside a thread.
  - **OPT IN IS THE WHOLE SHAPE.** They shipped first as three chips always on
    screen under the bar, which is not optional: every search she ran had to
    step over a control she was not using. **The chip WEARS THE STATE when
    anything is narrowed** ("Mine · Archive only") and lights — a filter she
    cannot see must never be one she has forgotten she set, quietly deleting
    results behind a closed drawer.
  - **EVERY FILTER HERE HAS THREE OPTIONS, SO EVERY ONE IS A THREE-WAY
    TOGGLE** (`/tritoggle.css` — the one shell; see the design rules). That is
    not a coincidence and it is why the pattern fits: a search filter worth
    having is `everything` plus the two OPPOSITE narrowings, and a checkbox
    can only say two of those three. Her own words for the archive one — "or
    not or just the archive" — are that shape exactly.
  - **The value is spelled out BESIDE the knob, and the knob carries no
    letter.** "Claude's" and "Archive only" are not initials, and a code to
    learn is a worse control than a word. **Tapping the word CLEARS that
    filter** (2026-08-24) — it used to step to the next value, which is the
    cycle she retired; the word cannot aim at a stop it sits nowhere near, and
    the one thing it can mean unambiguously is "put this back to Everyone". **They take the Playground's
    78px track, not the account switcher's 48**, and that is measured: at 48
    the three stops are 11px apart, which the account switcher's own note
    calls the floor — it can afford the floor because a toast names the
    account after every tap, and here the stop is something she has to read
    off the control. Two sizes in the house, not three.
  - **The chip carries the state only while the drawer is SHUT.** Open, the
    rows already say "Mine" and "Archive only" in full, and repeating them in
    the heaviest treatment on the screen is the same answer twice — the lesson
    the archive summary's one line already learned. It stays LIT either way,
    because lit is the half that is not redundant.
  - **WHO — hers is `from === 'sophie'` EXACTLY; everything else is
    Claude's.** The asymmetry is load-bearing and is the rule the app already
    used in three places (`renderMsg`'s own me/claude label among them). A
    reply is stamped `from:'claude'` today but older docs carry an empty
    `from` — and those are replies, since her messages have only ever reached
    the feed through `POST /reply` and the hook's her_words path, both of
    which stamp `sophie`. So an unstamped record lands on HIS side: silence is
    the safe direction for the smaller pile. (Measured: she posts about 40
    messages to every 220 replies, which is why a search across both buries
    the shorter one.)
  - **THE NEUTRAL STOP IS THE MIDDLE ONE, on both filters (2026-08-24, her
    ask: "the middle should be the both option or everyone or whatever …
    that way I can get to either way with one tap").** The row reads `Mine ·
    Everyone · Claude's` and `Not archived · Everywhere · Archive only`, so
    either narrowing is one aimed tap from rest and one tap back. `FILTERS`
    carries `neutral` by NAME — see the design rules; the server's own lists
    still lead with `all` and are untouched.
  - **ARCHIVE — `all` · `live` · `only`, filtering by CHAT.** `archived` is a
    flag on the registry doc, so the set is one read of the 5-minute cache the
    route already takes. A chat with no flag at all is live.
  - **THE HOME BAR ASKS THE SERVER — `?from=me&arch=only`.** Filtering the 80
    results already on screen would answer "my messages about the image doc"
    out of whatever survived the UNFILTERED top-80 — the Assets tab's
    hard-truncate lesson, re-learned rather than re-lived. The server holds
    the whole index and filters BEFORE it ranks. **`all` sends the param NOT
    AT ALL**, which is exactly what every older cached page on her phone
    already sends, and an unknown value WIDENS to `all` rather than emptying
    the list (`pickOne` in chatfeed.js is the one reader for both).
  - **ONLY THREE CHAT-NAME ROWS ARE PINNED (Aug 2026, Sophie: "right now, the
    name instances in the name are pinned to the top just pin the first three
    instances and then show content results").** It was ten. A common word
    matches a dozen chat NAMES, and ten of those above the fold pushed the
    message she was actually looking for off the first screen — the name rows
    are a shortcut to the obvious answer, not a second list to read.
    `pickNameRows` + `NAME_ROWS` in chatfeed.js, newest-seen first. They obey
    the ARCHIVE filter (a name row is about the chat) and come off entirely
    while a WHO side is picked (a name was said by nobody).
  - **The THREAD's copy filters what is already rendered** — fully loaded, so
    no truncate to fall through and no request to make — **narrows with an
    EMPTY box** ("just show me what I said in here"), and offers WHO only: a
    thread is one chat, so an archive filter there could show her everything
    or nothing and never anything else.
  - **NEITHER FILTER OUTLIVES ITS HUNT.** They ride the home bar's one-minute
    memory beside the words (and the drawer comes back OPEN when the restored
    hunt is narrowed), the GLASS resets them with the query it forgets, and
    closing a thread's search takes the filter off with the words — a thread
    reopened later silently missing half its messages, with no box on screen
    saying why, is the failure to avoid.
  - **ONE BUILDER for both boxes** — `buildFilters(mount, keys, onChange)` +
    the `FILTERS` table in `chats.html`. The next filter is a row in that
    table (values, words, and the query-string `param` kept together so a
    caller cannot send it under a name the server does not read). **A filter
    that needs the whole history goes to the server like these two; one the
    loaded page can answer honestly may stay client-side — say which you
    built.**
  - Test: `node scripts/test-search-filters.js` (the decision tables and the
    name-row cap pure, then the real page headless — opt-in, both toggles
    reaching the server, the chip wearing the state, and the controls' right
    edge measured against the pill's column).
- **EVERY CHAT HAS A LITTLE DRAWING BESIDE ITS NAME, AND IT SWEEPS ITSELF
  (`chaticons.js`, `/api/chaticons`, Aug 2026, Sophie: "the icons that just
  have big letters next to each chat and the update tab — I'd like to replace
  them with icons").** A chat with no `icon` on its registry doc drew a box
  with a giant letter in it; 356 were drawn by hand in one sitting and the
  rest arrive on their own.
  - **25 TO A SHEET IS THE WHOLE DESIGN.** One gpt-image-2 sheet in the pastel
    house style is ~6c at medium, so an icon costs **0.24c**; drawing each
    chat the moment it appeared would be a separate ~6c call, 25x the price
    for the same pictures. So the sweep WAITS until enough have piled up, and
    a brand-new chat wears a letter for a day or two. That is the trade, and
    it is the right way round. Measured 2026-08-15: **104 new chats in one
    hour**, which is why hand-running batches was never going to hold.
  - **It skips ARCHIVED chats** (her rule: "obviously skip archived chats"),
    the trash, and any chat with **nothing to draw from** — no display name,
    no note, no status/update card, and a generic slug (`new-session-7f3e9a`).
    There is no picture of an unnamed session and a wrong one is worse than a
    letter; it comes back into range by itself when the chat says what it is.
  - **It draws from the REGISTRY, not the threads** — her name for it, her
    note, the chat's own cards, its wrap-up, the slug. 23KB for 250 chats, so
    the reading costs nothing; Claude turns each line into one drawing subject
    (one call per sheet).
  - **It never touches the TRACER.** `/api/vector/sheet` draws, cuts AND traces
    every cell to SVG, and the trace is what hangs — two sheets stalled half an
    hour on one cell with the other 24 done, and pinning `ink` did not stop the
    second. An icon needs the CUT, never the SVG, so this calls `drawSheet` +
    `sheetPrompt` and vectorize's `slice`/`cutout` directly. The same lesson is
    in `scripts/gen-chat-icons.js`, which is still how you redraw a SPECIFIC
    set by hand (`--sheet <n>`, `--recut` off the banked sheet for free).
  - **The daily tick is hourly and the due check is in FIRESTORE** (`lastRunAt`
    on the module's state doc). This service restarts on every deploy, so a
    24-hour interval counted from boot would either never fire or fire on every
    restart — and the stored clock also means a dev container that boots the app
    spends nothing. The tick only runs where `RENDER_EXTERNAL_URL` is set.
  - **THE AUTOMATIC SWEEP KEEPS HER HOURS — 11am to 11pm PACIFIC (Aug 2026,
    Sophie: "i'm on pst not utc jsyk" · "11am-11pm").** Read through the IANA
    zone (`America/Los_Angeles`), never a fixed -8: she says PST but it is PDT
    half the year, and an offset would fire an hour out all summer. A HAND
    `POST /run` ignores the window — she asked for the hours the tick keeps,
    not a curfew on her own button. With the 20-hour due gap the run time drifts
    earlier each day until it hits 11am and settles there.
  - **ONE RUN AT A TIME, tick or hand** — found live: the tick fired four
    minutes into a hand run, each had read who was waiting at its own start,
    and a sheet's worth of chats was drawn and filed twice for about 6c.
    Nothing re-checks mid-run, which is right for one run and exactly what
    makes two collide. A run still `running` after 20 minutes is a dead
    process (a deploy mid-sweep) and stops blocking — cutmarks.js's takeover
    rule. `POST /run` answers 409 with the live run's id; `force:true` is the
    way past it.
  - `POST /run {limit?, dry?}` sweeps on demand — **`dry:true` is free** and
    names exactly who is about to be drawn and what it will cost.
    `GET /status` and `GET /waiting` are free reads. Tests:
    `node scripts/test-chat-icons.js` (the decision table, pure).
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
  (chatfeed.js) — **on the FIRST filing of a batch as well as 45s after the
  last** (2026-08-24: Sophie filed a low sheet beside a medium one, looked, and
  the quality ladder was not there yet; it was, 45 seconds later). The trailing
  run still coalesces a batch, but the leading one means the page is right
  within a second — and it is what makes "automatic" survive a deploy, since
  the debounce timer lives in the server PROCESS and a Render restart inside
  the window used to drop the pending poke with nothing to re-run it. Running
  twice is free: `runAutoCompare` makes no model call, and a test pins that.
  It keeps two standing auto grid pages per chat — same
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
- **WRITE THE PROMPT SHORT, AND NAME THE THING INSTEAD OF LISTING ITS PARTS
  (Aug 2026, Sophie: "highly encourage short prompts that don't describe exact
  things … 'meat raining from the ceiling' is better than 'ribs, drumsticks,
  etc.'").** A list of exact things reads to the model as a checklist and it
  satisfies it literally — every named object drawn, separately, arranged so
  each can be seen — so what comes back is an inventory rather than the event.
  The compact phrase names the whole happening and lets the model pick the
  parts. It is the third handle on one rule: *DESCRIBE THE ACTION* (don't
  specify the look), *WRITE IT SHORT* (don't specify at length), this one
  (don't specify the parts) — all in `docs/image-pipeline.md`. The test is
  whether a word could be swapped for another of its kind without changing the
  idea: if "ribs" could be "drumsticks", ribs was never the idea. **Guidance
  for prompts a CHAT writes** — a prompt Sophie dictated still goes verbatim,
  and anything you add is named word for word (the rule below).
- **THE WHOLE PROMPT IS STORED WHEREVER AN IMAGE IS MADE — a HARD RULE
  (2026-08-24, Sophie: "yes make it store the whole prompt. this is a hard
  rule. anytime an image is made ANYWHERE the whole prompt shud be stored").**
  Nearly every surface here wraps her words in a style prefix and a suffix
  before sending them, and until this landed most of them persisted only the
  TYPED words — so the exact text that drew a picture existed for the length of
  one request and was then gone. That is why Meta Assets could show a picture's
  style LABEL but never its style PROMPT, and why the exact-prompt rule below
  ("never paraphrase; no exact text on hand → file nothing") had nothing to
  file for anything the app made itself.
  - **Use the ONE builder — `prompt-record.js`** (`promptRecord` /
    `promptFields`). It writes three fields: **`fullPrompt`** (the literal text
    sent), **`promptStyle`** (the wrapper, with `[content]` marking where her
    words go — the convention the Assets PROMPT overlay documents) and
    **`promptContent`** (her words verbatim). Empty fields are dropped, so
    nothing writes `""`.
  - **Pass the string you actually sent as `full`.** A rebuild can differ by a
    space and the whole point of the field is that it is literal.
  - **No wrapper → NO style half.** A verbatim surface (Freeform, a blog hero)
    files an empty style half, which is the honest answer and what keeps the
    overlay's STYLE button hidden. Never fill it with the style's LABEL —
    "Dreamy" is the recipe's name, not the text that was sent, and filing it
    there is exactly the reconstruction the exact-prompt rule forbids.
  - **A NEW image surface stores it or the test fails** —
    `node scripts/test-prompt-record.js` sweeps every call of the two gallery
    filers, of the injected `fileCreation` (photostudio, movies) and of
    the `/api/generate/*` helper, and fails if one files a picture without a
    full prompt.
  - **EVERY SURFACE IS COVERED AS OF 2026-08-25 — swept, not assumed (Sophie:
    "any surface or endpoint or route or anything that makes images, the style
    is now always saved never thrown away, is that correct?").** It was not,
    quite: two holes were open a day after the rule landed, and each was
    invisible from inside the surface that had it.
    - **Photostudio** persisted its edit prompt nowhere, and its flatlay half is
      written by the vision model per run — genuinely unrecoverable once the
      response ended, not merely unfiled.
    - **The Test Station routes** (`/api/generate/dalle` · `gptimage` ·
      `housestyle` · `replicate`) had no doc to write to at all. They file
      through `fileGenerateRoute` now, so Test Station images appear in My
      Creations the way Playground images always have. `style-test` and
      `deck-batch` proxy into those four internally and are covered by them.
    **The lesson is the sweep, not the two fixes**: a surface that files a
    picture at all can be checked from OUTSIDE it in one command, and every one
    of these read as fine from inside its own module.
  - **`select()` IS A WHITELIST, and that is how two caption slots hid for
    weeks.** Meta Assets' creations read never asked for `size`, so the
    required third slot could never appear however well the builder handled it;
    `style` was asked for but only read as a fallback, so it was fetched and
    dropped. When you add a field, add it to the read as well as the write.
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
  **A CAPTION A PAGE DRAWS ITSELF IS A FOURTH SURFACE, AND IT WAS MISSED FOR
  FOUR DAYS (2026-08-27, Sophie's screenshot of the Playground lightbox:
  "shud say quality and 1k,2k/4k · 1/4 — I thought we already fixed this").**
  She had, and this is the shape of the miss worth remembering: her ask named
  "the playground and assets and Meta assets", and every one of those was built
  as **what a picture is FILED with** — the creation doc, `post-to-gallery.js`,
  the Meta Assets join. But the **Playground page draws its own caption
  client-side out of the RUN doc** (`runParts` in promptlab.html), and that
  builder was never in scope: it had never carried a size at all, for a panels
  run or a plain one. The PANELS tab then added `panels 2x2` and `panel 4 of 4`
  to that same line, which is what finally made the missing required slot loud
  enough to see. **So when a caption rule lands, ask which surfaces DERIVE the
  caption rather than reading the filed one** — a filing fix cannot reach them.
  Swept the same day: the Playground was the only one wrong. Freeform, Meta
  Assets and iOS My Creations (`Creation.madeWith`) all carry the slot; the
  Assets tab and the Compare pages read the filed caption; Character Creator
  draws one canvas and has no tier to say; and the old `/gallery` page reads
  Storage custom metadata, which carries no model or quality either and falls
  back to the folder name — no caption there to be missing a slot from.
  **`/size-tier.js` IS SERVED TO THE PAGE NOW (the `pause-plan.js` pattern),
  so there is one derivation.** `runSize(run)` is the one reader for both
  shapes — a panels run is a cut of its SHEET (`1/4 (4K)`), anything else is
  its own tier — and a run whose cut FAILED is the sheet itself, so it takes
  the sheet's tier rather than a fraction of a thing that was never cut. A
  tier table copied into a page would drift from the boundaries the day they
  move. Pinned by `node scripts/test-playground-panels.js`.
  **AND THE CAPTION IS THOSE THREE SLOTS AND NOTHING ELSE (2026-08-27,
  Sophie's next screenshot of the same line, which by then read "Dreamy ·
  medium · 1/4 (1K) · 1:1 · panels 2x2 · uncut sheet · 2x2": "extra notes -
  dreamy etc … just need model quality and pixels + 1/4").** Six things, of
  which the caption's own three were the first three — the required slot was
  found by adding it beside five other facts rather than by making room for
  it. `lbCaption` in promptlab.html is the lightbox's own builder now:
  **the STYLE · QUALITY · SIZE and nothing else.** `runParts` is untouched and
  still tags the run's CARD with the ratio, the grid, `photo ref` — over a
  picture she is LOOKING at, the ratio and the grid are things she can see and
  the wording is behind the Prompt door. A LoRA run has neither a quality nor
  a tier and keeps its card tags.
  **THREE MEANS THREE, AND SLOT 1 IS THE TILE SHE DREW WITH (2026-08-27, her
  correction the same hour: "u added panel 2/4 and the chatgpt2 … get
  rid").** The first cut read her "model" as the model ID (`gpt-image-2`, to
  match what that picture's FILED caption says in My Creations and Meta
  Assets) and kept `panel 4 of 9` on the end as navigation — which one of the
  run she is looking at. Both were things that had not been on the line
  before, on a line she had just asked to be three: **the Playground's tiles
  ARE the models to her**, and the size slot already says a picture is a
  quarter. So the filed caption and this one disagree about slot 1 on
  purpose.
  **AND THE HARNESSES COULD NOT SERVE IT** — `scripts/lib/public-asset.js`
  answered out of `public/` only, so the three root-level shared files
  (`pause-plan.js`, `pad-characters.js`, `size-tier.js`) 404'd in every
  Playground harness, which is the quiet failure that file exists to end: the
  page guards the global it could not load, renders without that behaviour and
  the test passes. It serves them too now, from a list **derived from
  server.js's own `sendFile` routes**, so the next root-level shared file needs
  no harness change.
  (it upgrades an already-filed tile in place; search matches it).
  **AND A RE-POST CAN NOW CORRECT A CAPTION, WHICH IT COULD NOT UNTIL
  2026-08-23.** The write only landed on a BLANK or a generic `from <chat>`
  record, so re-POSTing to FIX one answered `ok:true, deduped:true` and
  changed nothing, silently — while this file promised it upgraded the tile in
  place. It was found backfilling older captions, and it is why every image
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
  - **"IT'S NOT THERE" CAN MEAN THE PAGE IS OLD, NOT THAT THE ARROW IS
    MISSING (2026-08-27, Sophie about the Playground, twice).** Measured that
    hour before changing anything: the bytes Render answers with carry the
    pill VERBATIM, and the live html renders the arrow at her viewport with
    the iPhone 13's 47px safe-area inset — lit, 38px, tappable, in both list
    and tiles view. Nothing was wrong with the arrow. **The app keeps the
    three recent tools alive in a ZStack, so a wrapped page loads ONCE per app
    process and no deploy can reach it** — the Film Editor's round-three
    finding, arriving at the tool she is in most. The answer was the
    self-heal (see the Playground bullet), not a second arrow. **So when a
    shipped page feature is reported missing, check the SERVED bytes first
    and her page's age second — building it again is the one move that cannot
    help.**
  - **THERE IS A SECOND PILL AND IT DRIFTS — `mkPagePill` in `chats.html`
    (2026-08-24, Sophie on a Compare page: "the auto scroll doesn't work on my
    image prompt artifact so I can't scroll back up only down").** A Compare
    page opened in the app runs in an IFRAME, and iOS renders `position:fixed`
    unreliably inside one, so the pill she taps there lives in the PARENT page
    and scrolls the frame — a whole second implementation, which no pill
    resync and no `gen-*.py` touches. It had missed both of the shared pill's
    can't-get-back-up rules: it never grew a back-to-top at all, and a press at
    an END of the page did nothing rather than turning around. Both are fixed
    and both stand.
  - **A RESUME GOES DOWN — SHE REVERTED THE `dir` VERSION (2026-08-26, Sophie:
    "it used to go down after I stopped it even if it was going up before. now
    it doesn't seem to do that" → "can you just revert that one change for the
    pill as well as the page itself").** #1618 also moved resume onto `dir`, so
    that pausing an upward ride and tapping again kept climbing; it was live for
    two days and she asked for the old behaviour back. So `vmid`/`vm`,
    `__scrollTap` and `pill._tap` are a hardcoded 1 again, in `pill.py`, in the
    five baked copies and in `mkPagePill` — the ▲ is how she goes back up, and
    **resuming on `dir` is HISTORY rather than a rule.** What survives from
    #1618 is the END-OF-PAGE FLIP inside `scrollStart`/`start`: a direction with
    no room flips to the one that has room, so a resume at the very bottom turns
    around instead of doing nothing. Don't collapse the two — they look like one
    change and only one of them was reverted.
  - **CHANGE THE PILL? CHANGE BOTH.** `scripts/pill.py` → regenerate →
    hand-patch the five baked copies (`chats.html`, `gallery.html`,
    `storyroom.html`, `wall.html`, `writing.html`) → and `mkPagePill`.
    `node scripts/test-page-viewer-pill.js` drives the REAL `mkPagePill` over
    a real iframe and `test-back-to-top.js` sweeps the baked copies. **Seven
    files, and only a test notices one left behind** — the resume revert had to
    touch all seven.
  - **THERE IS A THIRD PILL — THE NATIVE ONE — AND WHETHER IT DRAWS IS DERIVED
    NOW, NOT LISTED (2026-08-27, Sophie on the Characters page: "two pills").**
    `RootView`'s `AutoScrollPill` shows on every screen that has nothing else
    drawing one, and it used to decide that from a hand-kept BLACKLIST of tools
    whose page already carries one. Forgetting a tool is SILENT — the two
    capsules stack in the same fixed corner, offset by the native one's own
    padding, and "Fast" prints twice. It had been missed once already (Voice
    Studio, Aug 2026, and its own comment says so) and, measured the day this
    was fixed, **five more were still wrong: Dreams, Shop Report, Characters,
    Song Station and Films** — every one of them a page served with
    `{ pill: true }`. So the answer comes from `Tool.webPath` (which page each
    tool hosts) plus `forgePillPages` (every page that carries one — injected,
    or baked from `pill.py`), and `node scripts/test-native-pill.js` derives
    the real set from server.js and fails on drift **in both directions**: a
    page missing from the set draws two pills, a page listed that has none
    draws nothing and leaves her with no way back to the top. It also fails if
    a per-tool `if t == .x` opt-out grows back beside the derived rule. The
    only two that survive are not about a page: `.filmeditor` (one screen,
    never scrolls) and `.movie` while the Story Room is pushed inside it.
    **The fix ships with a TestFlight build, not a deploy** — until she
    installs one, the five above still show two.
  - **The app's copy has no `id="ptop"` on purpose** — `chats.html`'s own pill
    owns that id and the sweep above counts exactly one per file; the viewer's
    button is `class="ptop"` only.
  - **THE PILL FOLLOWS WHATEVER IS ACTUALLY SCROLLING (2026-08-24, Sophie:
    "some surfaces scroll but have no to top arrow. like story room shelf").**
    Every check asked the WINDOW, so a surface whose content scrolls inside a
    full-screen sheet — the Story Room's shelf is `position:fixed; inset:0;
    overflow-y:auto` — looked to the pill like a page with nothing to scroll:
    no pill and no arrow, on the screen the tool now OPENS on. Measured with
    `elementFromPoint`: even a lit arrow was unreachable, because the sheet is
    z-index 40 over the pill's 9.
    - **The scroller ANNOUNCES ITSELF by scrolling.** `scroll` does not bubble
      but it does CAPTURE, so one capture-phase listener on the document hears
      an inner element scroll and takes `e.target` as the box; the window
      scrolling puts it down. No per-page hook, and no walking the DOM looking
      for scrollers on every scroll event.
    - **The PILL cannot wait for her to scroll**, so when the window has
      nothing to scroll `findBox()` asks `elementsFromPoint` at the middle of
      the screen — O(depth), and it finds the topmost overlay covering the
      viewport. A **MutationObserver** on the body is what re-asks, because a
      fixed sheet opening changes nothing the ResizeObserver watches.
    - **Only a NEARLY-FULL-SCREEN overlay is adopted** (80% of the width, 60%
      of the height): a note list or a filter drawer must never steal the pill
      from the page behind it. Adopting one LIFTS the pill to the box's
      z-index + 1 and putting it down restores the pill's own layer.
    - It ships in `pill.py` → `pill-inject.html`, so it reaches the 35 injected
      pages. The five BAKED copies still ride the window only — measured, none
      of them holds a full-screen inner scroller. Test:
      `node scripts/test-pill-sheet.js` (verified failing 4 pre-fix).
  - **A PAGE CAN KILL THE INJECTED PILL BY NAMING A VARIABLE, silently
    (found the same day, sweeping for the same report).** The pill's script
    runs in the page's global scope, so a page-level `let`/`const` sharing a
    name with one of its `var`s is a SyntaxError that takes the WHOLE pill
    script with it at parse time. `/search` had `let playing = null` and
    therefore no autoscroll, no back-to-top and an undefined
    `window.__scrollStop` — with nothing on screen saying so. `/cutmarks` had
    already been bitten and wrapped its page script in an IIFE (its comment
    names the bug), which is the fix; `/search` is renamed.
    **`node scripts/test-pill-globals.js` MEASURES it** — every injected page
    served the way `serveGated` serves it, loaded in a real browser, asked
    whether the pill's script ran. The page list is read out of server.js's own
    `{ pill: true }` calls, so a new page joins the sweep by opting in.
  - **THE PILL IS CONDITIONAL, SO OPT A SCROLLING PAGE IN AND STOP THINKING
    ABOUT IT.** 15 gated pages had no pill at all (the Dump, the Shop Report,
    Studio, Films, the dream archive, the desktop queue, Blog, Crystals…) —
    every one a page that scrolls with no way back up. They carry it now. A
    page that never scrolls shows nothing, so the only pages left out are the
    two that are deliberately one screen (`/filmeditor`, `/opinions`) and the
    five that bake their own copy.
  - **A page must not hand-roll its own** — `/chunking` carried a circle
    floating at the bottom-right, written before the shared arrow existed, so
    it had two back-to-tops in two corners doing one job (and a round plate,
    which the icon rule retired). Removed; `#ptop` is the one.
- **TRUNCATED TEXT OPENS WITH AN UNDERLINED WORD, NEVER A BUTTON (Aug 2026,
  Sophie: "the ... button for longer than two line prompt is huge … truncated
  text shud always just be a ...with a line under it that links to open
  (untruncate) or it can say 'more' or 'see more'. never a separate button.
  document that as a ui pattern").** `…` / `… more` / `see more`, underlined,
  inline, inheriting the surrounding type — no border, no padding, no
  background, and never a bare unstyled `<button>` (which draws the browser's
  own box). Still a `<button>` ELEMENT — the rule is about paint, not markup.
  **It rides ON THE LAST LINE of the words, never parked beside them** (Aug
  2026, Sophie: "Button should be part of the text, not separated from it on
  the side") — a `max-height` clamp plus a right float behind a zero-width
  float one line short of the cap, the dream cards' own solution. The class is
  `.moretxt` on every page. The full pattern, and the class-name
  collision that actually caused this (`.morebtn` was the opener AND the
  "Older" paging button in one file, later rule wins), are in
  `docs/design-rules.md`; pinned by `node scripts/test-truncation-opener.js`.
- **THREE OPTIONS = A THREE-WAY TOGGLE, AND THERE IS EXACTLY ONE SHELL (Aug
  2026, Sophie: "for things with three options, it shud be a three way toggle.
  add the toggle as a likely pattern where it applies. make a reusable three
  toggle shell so we can change the styling all at once. make color a per
  instance option. apply it to the few instances that already exists").**
  `public/tritoggle.css`, class `.tri` — link it, never copy it.
  - **The markup contract is the whole of it:** `<button class="tri"
    data-n="0|1|2" data-i="L">`. `data-n` is the stop, ZERO-based and
    NUMBERED, which is what lets the account switcher (1/2/3), the
    Playground's quality (low/medium/high) and size (1K/2K/4K), and the
    Chats search filters share one rule. `data-i` is the short word on the
    knob; leave it off for a blank knob.
  - **Colour and size are the per-instance options** — `--tri-track`,
    `--tri-knob`, `--tri-ink`, `--tri-w`, `--tri-k`. A bare `.tri` IS the
    account switcher (48px, the rose `--chg`); the Playground sets four
    lines and gets ink-on-paper at 78px. **Everything else is DERIVED** —
    the height, the capsule radius and the travel between stops fall out of
    the width, the knob and the inset, so a new instance sets a width and is
    done. Both hand-typed copies had eyeballed their gap and one had the
    knob half a pixel off centre.
  - **It had been hand-copied THREE times before this** (`.swi` in
    chats.html and `.swtog` twice in promptlab.html, the second saying
    "LIFTED VERBATIM" in its own comment), with two attribute names and
    two palettes, and the only thing that ever noticed a copy drifting was a
    test comparing two files property by property.
  - **WHERE SHE TAPPED IS THE STOP SHE MEANT — the BEHAVIOUR is shared too,
    `public/tritoggle.js` (2026-08-24, Sophie: "when I click the low medium
    high toggle in playground, it always goes to high from medium never low
    even if I click it on that side").** Every copy had been wired as a CYCLE
    — `next = (cur + 1) % count`, tap anywhere, advance one — so from medium
    every tap went to high, a tap on the far-left `L` included. Nothing about
    the control says that: 78px wide, the value written on the knob, three
    legible stops. It reads as a thing you AIM at, and now it is one.
    `triNext(el, count, ev, cur)` divides the track into `count` equal zones
    and answers the one under the thumb; **a tap on the stop she is already
    on does nothing**, because advancing from there is the same surprise
    again.
  - **A tap with NO coordinate still cycles** — a keyboard activation (a
    click with `detail === 0`) and the WORD beside a search-filter row, which
    is part of the control but sits nowhere near the stop it names.
  - **NO TOGGLE CYCLES ON A TAP — NOT ONE (2026-08-24, her second pass: "it
    also applies to the account thing because none of them should cycle —
    that's a really stupid pattern … Cycling is a bad idea").** This rule
    shipped hours earlier carving out the account switcher on the reasoning
    that a blank knob gives her nothing to aim at; she overruled it, and she
    is right — the stops are ordered 1·2·3 left to right and the knob shows
    which one it is on, and a control where account 3 costs two taps from
    account 1 is the identical complaint in a narrower box. Its zones are
    16px on a 48px track, which is small; widening it is hers to ask for.
  - **A LABEL BESIDE A ROW CLEARS, it does not step.** The search filters
    spell their value out next to the knob and that word cannot aim (it is
    nowhere near the stop it names), so tapping it returns that filter to its
    neutral stop. A step there would be the cycle coming back in through the
    label.
  - **THE NEUTRAL STOP GOES IN THE MIDDLE (2026-08-24, Sophie: "the filters
    for searching chats should start in the middle. The middle should be the
    both option or everyone or whatever … that way I can get to either way
    with one tap").** A three-way filter is `everything` plus two OPPOSITE
    narrowings, so the neutral one belongs between them; leading with it put
    one narrowing two stops out at the far end. In `FILTERS` (chats.html) the
    neutral value is **NAMED** (`neutral:'all'`), never positional — every
    reader used to ask `vals.indexOf(v) > 0`, i.e. "not the first one", which
    stopped meaning "not neutral" the moment it moved. **The server's lists
    are untouched and still lead with `all`**, because `pickOne` in
    chatfeed.js leans on exactly that index-0 rule to widen an unknown value:
    this is a display ORDER and the values on the wire never changed.
  - **A stub test server must serve BOTH `/tritoggle.css` and
    `/tritoggle.js`** — express.static does it in production. Without the CSS
    the toggle renders as a 4px sliver; without the JS the page falls back to
    the old CYCLE (each page carries that one line as a floor, never a second
    copy of the aim), which would quietly green-light the bug above.
  - Tests: `node scripts/test-tritoggle.js` (nobody keeps a second copy, and
    the geometry measured in a real browser at every stop, for every
    instance) and `node scripts/test-tritoggle-aim.js` (the aim rule pure,
    then REAL taps at REAL coordinates on the live Playground — verified
    failing 5 against the pre-fix behaviour). **A click on the ELEMENT is not
    a test of this**: playwright aims at an element's centre, which on a
    three-way toggle is the middle stop, so a cycling toggle and an aimed one
    look identical. Click a POSITION.
- **No pills.** Text buttons are rounded rectangles — `border-radius: 6px`.
  **AND A CIRCLE IS NOT THE DEFAULT FOR AN ICON EITHER (2026-08-24, Sophie: "i
  prefer rounded squares for buttons, or plain icons, rather than circles").**
  An icon control is a **rounded square** at the house 6px, or the **bare
  glyph** with no plate at all when the background behind it is calm enough to
  read it against — a round plate is the one to stop reaching for. This
  supersedes the line that used to sit here calling circular icon buttons "the
  only exception", so an existing circle is history rather than a rule: don't
  copy one into new work, and change one when you are already in that file.
  Small round DOTS that are a mark rather than a button (a status dot, a
  colour chip) are not this. **Plus one named exception Sophie asked for (Aug
  2026): the Chats home screen's REFRESH button (`.refreshbtn`) is
  pill-shaped.** It is the exception, not a loosening of the rule — don't
  round anything else off, and don't "fix" that one back.
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
  - **`/assets` (Meta Assets) WAS A THIRD COPY OF THAT LIGHTBOX, AND IS NOW
    MIGRATED — the copy is what made both of these bugs reach Sophie a second
    time (2026-08-24: "I can't get out of the light box in Meta assets I think
    with tapping it's considering too many things part of the row").**
    `asset-lightbox.js` was written to end exactly this and `public/assets.html`
    was never moved onto it, so it kept the OLD close rule — a blanket
    `stopPropagation` on each row, which swallows the tap for the row's WHOLE
    width (the ♥/✕ strip is `left:22px; right:22px`; the action icons and the
    note block are full-width flex rows) — leaving her with almost nowhere to
    tap that closes. **The reason nobody had migrated it is the lesson:** it had
    grown two things the shared file had no place for, so every chat that looked
    at it chose to patch the copy. The shared file grew HOOKS for them instead,
    and 226 lines of duplicate came out of the page:
    - **`actions:[{label, icon, onClick}]`** — a row of small circular icon
      buttons directly under the picture (open the chat · Playground · Add to
      Shoebox · Save to Photos). `label` becomes the aria-label AND the title;
      the empty space between them closes the lightbox, because the close rule
      asks the tap's TARGET. `.hasacts` shrinks the picture to 46vh so the
      note box still fits.
      **The Playground door is on EVERY picture and the Shoebox door exists
      since 2026-08-28** (Sophie: "meta assets missing its send to
      playground/shoebox"): with a filed prompt the Playground door ports it
      exactly as before; with none there is nothing to port honestly, so the
      picture rides as the PHOTO REFERENCE instead (`/playground?photo=<url>`
      — promptlab attaches it through the same restore the copy buttons use,
      stepping a LoRA sticky style onto the reference-less ChatGPT tile,
      which has the slot). Add to Shoebox is the Story Room door's twin:
      `POST /api/scratchpad/shoebox-url {url, title}` through the SAME
      content-addressed writer (`shoeboxPut`), so the two doors converge on
      one memory for one picture; the label she reviews by is the polaroid's
      title. Tests: `node scripts/test-meta-assets-page.js`,
      `node scripts/test-storyroom-shoebox.js`,
      `node scripts/test-playground-photo-ref.js`.
    - **`who`** — the small uppercase origin-chat line under the caption, for a
      surface that mixes many chats.
    Both optional and additive, so no existing caller changed. **The next
    surface that needs something extra gets a hook, never a fourth copy.**
    Three things came free with the move: the picture is no longer rounded (her
    rule), the note thread is the settled box-first layout with the CHAT button,
    and the note input's 16px iOS floor — which that copy had and the shared
    file did not — now protects every caller.
    Tests: `node scripts/test-asset-lightbox.js` (the two hooks, and that an
    asset passing neither is untouched) and `node
    scripts/test-meta-assets-page.js` (step 0 is a SOURCE PIN that the page
    opens the shared lightbox and builds none of its own; step 11 taps the dead
    space, found by scanning each row with `elementFromPoint` — the only honest
    way to ask what a tap reaches; verified failing against the pre-fix page).
  - **EVERY SURFACE SHARES THE ONE FILE SINCE 2026-08-28 (Sophie: "create a
    single lightbox view, sync to all surfaces … ex assets, meta assets, story
    room, playground").** And **THE ONE LAYOUT IS THE PLAYGROUND'S,
    EVERYWHERE** (her check the same day: "it's not in meta assets?" — one
    code was not one view while the layout stayed per-page): ♥/✕ lead the
    row UNDER the picture with the caller's actions, all one 46px size, the
    MODEL · QUALITY tag and label directly under the picture, Prompt · Chat
    alone in the top band, the picture at 76vh yielding through flex. The
    old `votesBelow` / `capUnderImage` hooks are accepted and IGNORED — they
    are the layout now; don't reintroduce a per-page layout flag.
    The last three hand copies retired in one pass: the
    STORY ROOM's (its pick and step zones ride two new hooks — `cta`, a
    labeled primary button under the picture for "Use this one", and
    `onClose`, which lets a page whose beat popup holds the body lock
    re-assert it after the shared close clears `body.overflow`; the page's one
    rule is `#clightbox{z-index:60}`, its own overlay layering), FREEFORM's
    (an output opens with the verbatim `promptSent` behind the PROMPT door and
    steps the run's pictures; a reference opens plain) and the CHARACTER
    page's (a bare open). The shared close contract is everyone's now — a tap
    on dead space closes, a tap on the picture never does, the Story Room
    included. `node scripts/test-asset-lightbox.js` carries the SOURCE PIN:
    all six surfaces link the file and none builds a lightbox of its own — a
    seventh surface joins the sweep by linking it. Not migrated, by design:
    compare.js's own `.cmp-lb` zoom (hand-built Compare pages are FROZEN when
    posted, so changing their host risks every page already filed) and the
    public apps with their own identity (dream feed, witch).
- **THE BOTTOM BAR'S THREE ARE PERMANENT — Story Room · Story Timeline ·
  Playground (2026-08-26, Sophie: "right now the bottom real icons switch off
  can you change it so they're permanent I want the story room, the story
  timeline and the playground").** The three middle slots used to rotate by
  most-recently-used, so the tools under her thumb moved every time she opened
  anything else from Home — a bar that can never be learned. `barTools` in
  `RootView.swift` is the whole list and the ONE place the order is written
  down; changing it is that line.
  - **`Recents` still exists and still tracks use order — it ranks the HOME
    GRID's cards.** Only the bar stopped reading it. Do not delete it.
  - **THE ALIVE SET IS NOT THE BAR ANY MORE, and that is the half that breaks
    if it is "tidied".** The ZStack used to keep exactly the bar's three tools
    alive, which only worked because opening a tool from Home promoted it INTO
    that three; with the slots fixed, a tool opened from Home is in neither, so
    `alive` = the three + the currently-open tool + the ONE most recent tool
    from outside the bar. Drop the first and a tool opened from Home renders as
    a blank screen; drop the second and Home → Playground → Home silently
    throws away her half-typed prompt.
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
- **BRIEFING HER ON OTHER CHATS? EVERY CHAT YOU NAME GETS A LINK BACK TO IT, AT
  THE BOTTOM (Aug 2026, Sophie: "i've been asking a couple of chats to give me
  briefings on other chats where they give me status updates … they should
  always have a link back to the chat that they're talking about at the bottom
  of their analysis").** Any reply that reports on OTHER chats — a status
  sweep, a roundup, "what's happening in X", a comparison across threads, an
  audit naming which chat did what — ends with one link per chat you talked
  about, under your analysis. The point is that reading about a chat and
  GOING to it are one tap apart; without the links she has to hunt each name
  down her list.
  - **The link is the chat in Deck Factory, never a claude.ai session url** —
    `https://imageforge-q125.onrender.com/chats?chat=<slug>` — the same rule
    the morning brief already follows. On her phone that is a universal link
    and opens the app on that thread.
  - **Label it with what she calls the chat**, not the slug:
    `[Water reel](https://imageforge-q125.onrender.com/chats?chat=water-reel-v16)`.
    Her `displayName` is on `GET /api/chatfeed/status?chat=&session=` (as
    `note`'s neighbour) and on `GET /api/chatfeed/name?chat=&session=`; the
    feed read you did to write the briefing already carries it, so this costs
    no extra request.
  - **The SLUG must be the effective one** — a chat's identity is its session,
    so a thread can be forked to `<slug>-<sid6>`. Use the slug the feed/registry
    gives you for that thread, never one you reconstructed from a branch name,
    or the link opens nothing.
  - **One link per chat, deduped**, at the very bottom with the rest of the
    working links — the house *files and links last* order, unchanged. Mention
    a chat inline in prose all you like; the links still collect at the end.
  - This is about chats you REPORT ON. A reply about your own work does not
    link to itself.
- **Always include clickable testing links** when something is ready to test:
  the deployed page for the feature plus the PR link.
- **Copy-paste / handoff messages = one code block.** When the user asks for a
  message to copy-paste, forward, or hand off to another chat, put the ENTIRE
  message inside a single fenced code block so it copies in one tap — no
  commentary mixed in, never split across sections or styled headers.
- **No markdown tables in chat replies.** The user reads on a narrow phone
  where wide tables need horizontal sliding and often don't render. Present
  comparisons as short labeled lines or bullet lists instead.
- **Deliverables go last — files and images at the very BOTTOM.** When a
  message includes a generated file — audio, image, video, any downloadable
  deliverable, or an attached image — it is the final item, after all the
  text, never before or in the middle. Write the explanation first, deliver
  last. (This was two separate bullets saying the same thing, written on
  different days; merged 2026-08-24.)
- **Answer questions FIRST — and answer each one ONCE.** If Sophie's message
  contains a question, answer it at the top of the reply, before doing or
  reporting on any tasks from the same message. Whether to also repeat it in
  bold is the echo rule, and it lives in ONE place — *ANSWERING A QUESTION* in
  the Chats app section (short version: only a question she MARKED with an
  asking phrase like "i have a question" / "quick question", or a code word
  like "file this", earns the bold echo; everything else is answered plainly).
  This bullet used to restate the gate and drifted a day behind it — the rule
  is there, this is the pointer.
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
- **DON'T HAND HER YOUR FINDINGS (2026-08-28, Sophie: "why r u telling me
  that", then "every chat tells me that like 70 times").** The reply that
  earned it ended with a free measurement — the style reference costs 1,505
  image tokens, most of the bill on a low run — which she had not asked about
  and which changed nothing she was doing. It is the same reflex in every
  chat: a chat measures something on the way to the work and reports it
  because it was interesting to MEASURE, and she gets the same aside dozens of
  times over.
  - **The test is whether it changes what she does next**, not whether it is
    true or hard-won. Token counts, per-call latencies, cache behaviour, what
    a route does internally, why an approach was slow: out.
  - **Money she is spending is the one that stays in** — the checklist's rule
    is unchanged (say what a turn spent, estimate a batch, ask above $3). A
    per-token breakdown of a bill she has already been told is not that.
  - **The finding is not lost, it is FILED**: the PR description, the commit
    message, or a line in this file where the next chat will read it. That is
    where a measurement belongs, and it is why writing it into her reply buys
    nothing.
- **NEVER THE QUESTIONS UI — ASK IN PLAIN TEXT (2026-08-28, Sophie: "from now
  on never questions mode · questions go as plain text").** When you need
  something from her, ask it as ordinary words in your reply — the option
  picker is out, always, whatever the harness offers. She dictates and reads on
  a phone, so a card of buttons is a shape she has to stop and operate where a
  sentence is one she can answer in the same breath. Ask ONE question, name the
  option you would take, and keep going with everything that does not depend on
  the answer (the *deliver the work* rule is unchanged — a question is a last
  resort, not a way to hand the decision back).
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
  **AND WITHOUT THAT FLAG, `output_format:'webp'` COMES BACK LOSSLESS — webp is
  the CONTAINER, not a compression (measured 2026-08-27, Sophie asked: "why
  webp? are they compressed?").** Read the fourth chunk id of the actual bytes:
  a lossless webp is **`VP8L`**, a lossy one is `VP8 `. Every original this app
  stores is VP8L — a character card is 1,262,818 bytes for 1024x1024 (1.18
  bytes/pixel, which is lossless territory; a lossy webp of the same picture is
  a tenth of that) and a 4K Playground render is 3,051,188. The derived thumbs
  are `VP8 ` and are MEANT to be — that is the display copy the rule above is
  about. So "it's a webp" is never on its own evidence that something was
  compressed: **check the chunk id, and check whether the file is an original
  or a derived copy.** One command:
  `python3 -c "import sys;d=open(sys.argv[1],'rb').read();print(d[12:16])" <file>`.
- **THE HEADER TOP IS ONE NUMBER AND `pagehead.js` ENFORCES IT (2026-08-23,
  Sophie: "the header is different in both, and not at the top").** Measured
  that day: across all 39 gated pages the gap above the header ran 0 to 42px,
  because every page improvised its own status-bar clearance and new pages
  copied their neighbour's. `levelRow()` in `pagehead.js` now measures the
  real box and corrects the row to `var(--headtop)` (safe area + 4px) / left
  16 — so a page writes NO top-inset code of its own, and
  `node scripts/test-header-top.js` measures every `serveGated` page (the
  list is derived from server.js, so a new page is covered the day it is
  registered). Full rules in `docs/design-rules.md`.
- **A REPAINT NEVER REBUILDS WHAT DID NOT CHANGE (2026-08-28, Sophie: "this
  shud be the automatic best practices").** A poll or refresh that wipes and
  recreates image DOM strobes the page blank on iOS — the Story Room's
  "blinks a lot", found live on three more pages the same day. The pattern is
  a signature skip reading the same values the paint draws; full rule and
  worked examples in `docs/design-rules.md`.
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
  tile) — the prompt tester.
  **THE FEED IS HERS — A CHAT DOES NOT DRAW INTO IT (2026-08-28, Sophie: "it
  shouldn't go in the playground. It should go in assets your assets tab which
  it would, and then it would end up in meta assets" · "The playground is for
  me that's why it's called the playground").** A chat making pictures for her
  calls `POST /api/promptlab` because it is the one route that already knows
  the styles, the tiers and the panels cut — and every run it starts lands in
  the feed she scrolls, between the things she drew herself. Ten of a chat's
  test panels at the top of the Picture tab is the same complaint as the rat
  bump, arriving by a different door.
  - **A chat's pictures belong in ITS OWN Assets tab** (`POST /api/gallery`
    with the label, the MODEL · QUALITY · SIZE caption and the filed prompt),
    which is what Meta Assets is a view over — so they are already in the one
    place she reviews everything from, and her feed stays what she put in it.
  - **So DRAW IN YOUR OWN CONTAINER for chat work**: post to OpenAI directly,
    cut with sharp (`cutSheet`'s recipe, `sheet-grid.js` does the geometry),
    upload with the Deck Factory service account, then file. **This file used
    to name the run record — "it shows in your feed, it tiles in the gallery,
    it can be copied back" — as the REASON to prefer Render, and she
    overruled it: that record is the cost, not the benefit.** The container is
    also immune to a deploy restart, which is worth real money on a batch.
  - **Render's `/api/promptlab` is for HER TAPS**, and for a run she asked to
    exist in the Playground (a ladder she wants to compare there, a picture
    she will re-roll from the page). Ask before starting one on her behalf.
  - **There is NO delete route for a run** — `/vote` and `/cancel` are all
    there is, and the ✕ that hides a picture is hers to cast. So a run a chat
    starts in her feed cannot be tidied away afterwards without an Admin
    write. Don't start it. Fixed recipe per style so runs stay comparable: ONE
  image a run, 2:3, Generate is the stars icon. Seven styles: WTR (the only
  Replicate LoRA), **Sandy mirror**, **ChatGPT**, **Dreamy**, Scarry, Pastel,
  Hoonies (all gpt-image-2, her own scans attached as style refs, kept in
  `PL_GPT_STYLES` in server.js).
  **THE PAGE HEALS ITS OWN STALENESS (2026-08-27, Sophie: "it's not there" —
  about the back-to-top arrow, which had been live and correct for a day —
  then "self heal").** The app keeps the three recent tools alive in a ZStack,
  so this page loads ONCE per app process and re-entering the tool shows the
  SAME page: no deploy can reach it. That is the Film Editor's round-three
  finding arriving at the tool she is in most.
  - **THE BUILD ID IS A HASH, NEVER A HAND-BUMPED CONST** — `page-build.js`
    (`pageBuildId(file, pill)`), the content hash of exactly what
    `serveGated` sends, stamped into every gated page as
    `window.__forgeBuild` and answered by `GET /api/promptlab/build`
    (registered ABOVE `/api/promptlab/:id`, like `/styles`). The Film
    Editor keeps `var BUILD = 'fe-2026-08-23d'` in its own html, which is one
    forgotten edit away from a self-heal that never fires. **The PILL is
    folded into the hash** — it lives in another file, and the arrow that
    started this is a pill change and nothing else.
  - **READ THE STAMP LAZILY.** `serveGated` APPENDS it after the page and the
    pill, so at parse time `window.__forgeBuild` does not exist yet; caching
    it in a const leaves the check permanently disabled, and every
    "same build → no reload" assertion still passes, vacuously. The test asks
    whether it really CALLED the server for exactly that reason.
  - **IT RELOADS ONLY WHEN NOTHING WOULD BE LOST, and that is the half the
    Film Editor could take for granted.** Its state is all server-side; this
    page holds real unsaved things, every one of them deliberately not
    persisted: her typed prompt, an attached photo ref, a picked cast, a
    quality or size tier moved off default, a search in progress, an open
    lightbox / cancel dialog / prompt panel / character picker, and any tap in
    the last 10s. A silent reload throwing one of those away is a worse bug
    than the one being fixed. Everything else already survives a reload (the
    view, the filters, the columns, the canvas, the panel words, her prompt
    overrides, pending runs). The DEFAULTS are read at load (`plQ0`/`plR0`),
    never written down, so a moved default cannot make the guard lie.
  - **COMING BACK TO THE TOOL IS THE CHECK THAT MATTERS** —
    `visibilitychange` → visible is the moment a stale page is about to be
    used; the 5-minute timer is only the fallback for a page left open.
  - Test: `node scripts/test-playground-selfheal.js` (the hash pure — both
    files move it — then the real page headless: the stamp, the no-op, the
    heal, every guard, and the release; verified failing against the pre-fix
    page). **Another page wanting this needs two lines** — its own
    `/build` route calling `pageBuildId`, and this block.
  **A hairline PICTURE · PANELS tab sits at the top (2026-08-26, Sophie: "we
  make a picture and cut it into panels … describe each panel individually —
  it could be a feature or Hairline tab in the playground itself").** On
  PANELS the prompt box becomes N boxes laid out AS the grid (2 · 4 · 9; 25
  later is one `GRIDS` entry in `sheet-grid.js`) — **the 2 option is two
  LANDSCAPE panels, one above the other** (2026-08-27, Sophie: "2 option shud
  be landscape in panels"), a `shape` PINNED on that grid, which borrows the
  portrait tier's pixel budget and takes the canvas toggle off screen because
  it decides nothing there. **No new endpoint** (her question the same day): a
  panels run is the same `POST /api/promptlab` with `panels` + `grid`; one gpt-image-2 SHEET draws
  at the tier budget on a canvas DERIVED to divide into whole-pixel cells,
  wrapped in the GRID SENTENCE (`sheetGrid.panelBlock` — **hers, dictated
  2026-08-27, and shorter than what shipped: the second geometry clause
  "with straight edges exactly on the grid lines, no gutters and no outer
  margin" is out at her ask, and `findSeams` is what keeps the cut off the
  borders, so don't restore it**),
  the server cuts it apart (sequential, lossless, sharp cache off — the 512MB
  box; **and ONE CUT AT A TIME ACROSS ALL RUNS since 2026-08-28** — Sophie's
  two-phase rule, "sheets come in, get banked, then cut only after banked":
  waiting sheets cost nothing, a banked arrival is ~3MB, a cut decodes ~33MB,
  so arrivals may stack and the decodes queue (`gateCut` in server.js, which
  every caller of `finishPanelsCut` — the live job, the boot sweep, `/recut` —
  comes through; full rules in the Opinions section's ceiling ledger);
  **the cut is IMAGE-AWARE since 2026-08-27** — `findSeams` cuts through
  the middle of the real gutter near each math line, math as the fallback,
  because the model draws the grid slightly off and a blind cut landed on two
  panels' frame edges in her first live look), and each panel files into My
  Creations with its own words as the
  label and the **`1/9 (4K)`** size slot (`size-tier.js cutSize` — the
  fraction and the SHEET's tier, never the panel's own pixels). Dreamy's
  anti-grid tail clause is SWAPPED for a sheet, the no-text mechanism again
  (`sheet` beside `noText`); the paid sheet is banked BEFORE the cut and a
  failed cut keeps it, disclosed as "uncut sheet". **A DEPLOY RESTART CANNOT
  LOSE A BANKED SHEET (2026-08-27, measured: three merges deployed in a row
  and orphaned four paid 4K sheets mid-run)** — the stuck-run sweep finishes
  an orphaned panels run from its banked sheet (free) instead of marking paid
  work failed, and `POST /api/promptlab/:id/recut` does the same on demand
  for a failed-with-sheet or cutFailed run (recovery-only: an already-cut run
  is refused, a second cut would file duplicates). **AND DRAWING AND CUTTING ARE PACED
  SEPARATELY** — fire the whole sheet batch AT ONCE (the draw is on OpenAI's
  hardware), while the CUT is queued one at a time by the server itself
  (`gateCut`), so a chat never staggers its own launches (Sophie,
  2026-08-28; full rule under *DRAWING AND CUTTING ARE PACED SEPARATELY* in
  the Opinions section).
  **THE BOXES FOLD (2026-08-28, Sophie: "make the panels grid
  collapsible")** — nine 2:3 boxes is most of a screen and the controls and
  Generate sit under them, so a row above the grid puts them away (measured:
  the controls come up ~460px at 390pt). Sticky, and **OPEN by default** —
  the boxes are the prompt on this tab, so shut is a state she has to have
  chosen. Three things not to undo. It hides them with **`display:none`,
  leaving the textareas in the DOM**, so a fold can never lose her words and
  `panelVals()` still reads them: a folded Generate POSTs every panel, and a
  test pins that. **Shut, the row says how many are written** ("Panels · 3 of
  9 written" / "Story · written") and open it does not — the boxes are right
  there, the archive summary's don't-say-it-twice rule. And **anything that
  means "write in these boxes" OPENS it** — picking a grid or Story, a run's
  copy button putting panels back, and a Generate error naming an empty
  panel, because an error pointing at a box she cannot see is no error.
  Full rules: *The PANELS
  tab* in `docs/modules/pictures.md`. Tests: `node
  scripts/test-playground-panel-fold.js`, `node scripts/test-sheet-grid.js`
  and `node scripts/test-playground-panels.js`.
  **SANDY MIRROR AND CHATGPT ARE TWO TILES SINCE 2026-08-24 (Sophie: "add one
  more endpoint option to the playground, which is called ChatGPT and change
  the one that's called ChatGPT right now to make it be called Sandy mirror.
  the ChatGPT new one will have no reference image").** The tile that attaches
  `refs/sage-sandy-mirror.png` is **Sandy mirror**; the new **ChatGPT** tile
  attaches NOTHING — her words to gpt-image-2 alone, no style reference, no
  baked prefix, no baked tail, no Sophie card.
  **THE KEYS DID NOT MOVE — only the label.** `evan` (server) / `chatgpt`
  (page) are stored in every run doc, every `?style=` deep link and her
  localStorage prompt overrides, so renaming either would orphan all of it. The
  new tile is `plain` in both tables.
  **IT IS LITERALLY A DIFFERENT ENDPOINT, which is why she called it one:** with
  no images to attach there is nothing to EDIT, so `runPromptLabGptJob` picks by
  `refs.length` — empty goes to `openaiImage` (`/v1/images/generations`),
  anything else to `openaiImageEditRefs` (`/v1/images/edits`). Same model,
  quality, canvas, `moderation:'low'`, webp, no `output_compression`. **The
  choice is the ARRAY, never the style id** — attaching her own photo gives a
  plain run one image and it belongs on edits, and its photo line is a
  different sentence there (`PL_GPT_STYLES.plain.photoLine`, served per style)
  because the house one names a style reference this tile does not have.
  A picture made here carries NO evidence of where it came from — no reference
  filename, no baked prefix — so `playground-port.js` marks it `evidence:false`
  and nothing ever routes back onto it. Don't invent a fragment to fix that.
  Test: `node scripts/test-playground-plain.js`.
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
  herself), and **"Minimal text only." became a flat "no text."** — **AND ON 2026-08-27 SHE
  MOVED IT BACK: the tail asks for `minimal text.` again and the TOGGLE sends
  `no text.`** ("change the no text thing so there's another option called
  minimal text. This is the default actually just two options minimal and none
  and it should just be those words not the whole paragraph"). So the flat ban
  is what the switch sends, not what ships baked in, and the spelled-out
  paragraph the toggle used to send — no letters, no numbers, no captions, no
  handwriting — is GONE. Two words each, hers. Still gone
  and still unmentioned: **"no caption boxes"** (the reference IS a diary comic
  and its boxes are the look) and **"vertical"** (the canvas toggles, so a
  prompt naming one shape fights the other). The wording before this was the
  dream feed's, imported 2026-08-20.
  **HER CAST RIDES A SHEET — BOTH HALVES, AND THEY ARE DIFFERENT THINGS
  (2026-08-27, Sophie: "I want both. Descriptions as well as pictures: two
  options").** A panels run (and a story sheet) now carries either, both or
  neither:
  - **PICTURES** — the character picker's saved cards, attached last, named by
    the shared `charLine()`. This one could simply be turned ON where the
    Sophie card and her photo still cannot: **`charLine()` says "the last
    attached image(s)", which is as true of a sheet as of a single picture,
    where those two name a POSITION for ONE picture.** That asymmetry is the
    whole reason panels were excluded in the first place, and it is pinned.
  - **DESCRIPTIONS** — her typed name + description rows (`cast` on the
    request), written in as a clause before the panel lines by
    `sheetGrid.castBlock`. **THE CLAUSE ONLY EXISTS IF THERE IS AT LEAST ONE
    CHARACTER** (her rule, stated outright): an empty cast sends nothing at
    all, never an introduction to nobody. A row with a name but no description
    — or the other way round — is written the SHORT way rather than padded
    with invented filler, because the point of the clause is that every word
    in it is hers.
  **BOTH LIVE BEHIND THE ONE CHARACTER ICON (2026-08-28, Sophie: "add
  character description be within the existing icon - hairline toggle between
  description and pictures").** The typed cast shipped as its own box under
  the panel grid, which made two places on the page to say who is in a
  picture; it is the second half of the character sheet now, behind a
  **Pictures · Descriptions** hairline row. Three things not to undo: it is
  the SAME `.plabtabs` rule and the SAME measurer (`plTabLine`, which took an
  id for this) as the PICTURE · PANELS row, so nothing declares a tab count;
  the ROW only exists on the Panels tab, because the clause is written into a
  SHEET's prompt and a tab that changes nothing on the Picture tab is worse
  than no tab; and the **badge counts the whole cast, both halves**, repainted
  as she TYPES (the row is not rebuilt on input, so without that the count sat
  stale until she closed and reopened the sheet — found by the test).
  Both land in the HEAD, which is what a panel's filed style half is cut from,
  so provenance needed no other change; both are stored on the run and are
  absent when unused. **`sheet-grid.js` IS SERVED TO THE PAGE NOW** (the
  `pause-plan.js` pattern, so the harnesses pick it up automatically), which
  is what lets the Prompt panel print the REAL clause instead of keeping a
  second copy of the wording. Tests: `node scripts/test-sheet-grid.js` (the
  clause, pure) and `node scripts/test-playground-panels.js` (the wiring, and
  that the Sophie card and the photo are still off).
  **THE GREEN TANK TOP — a named ban at the very end of the tail (2026-08-27,
  Sophie: "the woman w the green tank top appears nowhere. if text asks for a
  woman, invent a different woman, with different clothing").** `dream-mystery.jpg`
  IS her diary-comic page and is full of drawn people, and the model kept
  lifting one of them; the general "do not draw its content" sentence was not
  enough, so this one names her. It rides AFTER that sentence, at the very end,
  which is also what keeps it clear of both swaps — `noText.from` and
  `sheet.from` target earlier clauses and neither reaches it.
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
  **THE PROMPT PANEL IS FOR EVERY STYLE, THE LoRA INCLUDED (2026-08-24,
  Sophie: "there's no way to see the style prompt in the playground").** She
  was right, and the cause was structural: the panel, its button and the
  stored override all keyed off `S.gptStyle`, so WTR — **the tile the page
  OPENS ON** — fell through to null and the whole thing was hidden. WTR does
  wrap her words (the `wtr` trigger in front, `White background` after) and
  both were invisible on the first screen she sees. `bakedFor` now synthesises
  a LoRA's shape from its own `STYLES` row (there is no server recipe to
  serve — the trigger and the tail ARE the style), `overKey` falls back to the
  style key so a LoRA can carry an edit, and the run sends her edited tail.
  **The trigger is SHOWN, never editable** — changing it stops the LoRA being
  selected at all. The canvas and tier toggles stay gpt-only, which was always
  right: a LoRA has one output size. Test:
  `node scripts/test-playground-prompt-panel.js`.
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
  - **PUTTING A PROMPT BACK PUTS ITS REFERENCE BACK (2026-08-27, Sophie:
    "playground and other image tools shud save the reference photo and reload
    when copy to prompt box").** The photo was already SAVED — `photoRef` on
    the run doc is the Storage url it was uploaded to, and the whole doc rides
    the feed — but nothing on the page ever read it back, so a picture drawn
    with a photo could not be re-run with the same photo: the bytes existed and
    were unreachable. Every copy-back path restores it now (the run card's
    button in both views, the lightbox action, a panels run, a pending run).
    - **THE RULE IS "ONLY CHANGE WHAT THE RECORD KNOWS", and the CLEAR is the
      half that is easy to skip:** a url on the record attaches it, a record
      carrying NONE takes an attached one OFF (a panels run, a LoRA run, a
      picture she drew with nothing on it — leaving one on would put an
      ingredient into the next run that the one she copied never had), and no
      record at all leaves it alone. A test that only checks the attach passes
      against a page that never clears.
    - **The restored value is the URL, not a dataURL**, and `restorePhoto`
      accepts only `^https?://` — the same test server.js applies to `photo`.
      The two agreeing is the point: the page must never attach something the
      run would silently drop, leaving her looking at a thumbnail that did not
      ride the request. Nothing is re-uploaded; the run's record points at the
      same object.
    - **A pending run's doc is stashed by the POLL** (`runsById[d.id] = d`) —
      the pending ENTRY cannot carry a photo, since it lives in localStorage
      where a 1600px dataURL is most of the quota.
    - **NOT PERSISTED across loads is UNTOUCHED and is still hers.** Her tap on
      a copy button is the opposite of silent: the thumbnail appears in the row
      as she taps, and the Prompt panel's photo line comes back with it.
    - **FREEFORM IS THE OTHER IMAGE TOOL, and it had no put-back button at
      all.** It has the Playground's now, and it restores both halves, because
      there the references ARE half the prompt (nothing else is added to her
      words). The run doc has stored `refIds` since the module shipped, so
      nothing new is saved and every run already on file gets this; a reference
      she has since DELETED cannot come back, so the ones still in the library
      are re-selected and the toast SAYS how many were not, rather than quietly
      starting the next run one reference short. The optimistic card carries
      `refIds` too, or copying a run back the second after starting it would
      clear the references it is drawing with.
    - **The Assets PORT is deliberately not this** (`playground-port.js`): it
      identifies a picture by EVIDENCE in its filed prompt text and never knows
      the run, and a filed prompt records no photo. Don't invent one.
    - Test: `node scripts/test-copy-restores-reference.js` (both real pages
      headless — the restore is a state change across three controls and a
      source assertion cannot see it; verified failing pre-fix, 5 in the
      Playground and no button at all in Freeform).
  **AND IT MOVES THE SCREEN TO THE BOX — `scrollToPrompt` (2026-08-28, Sophie:
  "prompt us back in box shud move screen to box").** Every copy path had asked
  for that scroll since the buttons shipped, and from the LIGHTBOX it never
  happened, so on the one path where she cannot see the box at all the words
  landed somewhere she was not. **It is two house rules meeting, not a missing
  call:** closing an overlay RESTORES the position she opened it from (she
  closes an image exactly where she opened it) and `asset-lightbox.js`
  re-asserts that restore on the NEXT frame — which lands on top of a smooth
  scroll started in the same tick and cancels it. So the scroll is asked for
  immediately AND again once the restore's own frames have run: **the last word
  has to be ours.** One helper for all three copy paths (the one box, the panel
  boxes, the story box), so a fourth cannot ship without it. The restore itself
  is untouched — closing the lightbox WITHOUT copying still puts her back where
  she opened it, and the test pins both. **A grep passes against the pre-fix
  page** (the call was always there); the only honest question is where the
  window ends up a moment after her tap. Test:
  `node scripts/test-playground-copy-scroll.js` (the real page headless,
  verified failing pre-fix on the lightbox path).
  **HER OWN CAST — THE CHARACTER PICKER (2026-08-27, Sophie: "add a little
  button in the playground right next to where it says dreamy make sure it's
  the same style with a character icon that shows the five most recent
  characters that were put and then also the rest of the sheet and characters
  with a search").** A Lucide people glyph beside the style picker — the
  picker's own ink border at its own 34px, because that is the row she named —
  opening a sheet of her FIVE most recent across the top and the rest under a
  search. Picking is two taps; up to `MAX_PICKED` ride, lit with the count on
  the button.
  - **IT IS THE CHARACTER CREATOR'S OWN LIBRARY, never a second pile** —
    `forge-characters`, the same 143 the cast sheet and the dream flow read
    (measured live 2026-08-27). `GET /api/promptlab/characters` adds only the
    ORDER: **recent = the last time she DREW with one**, falling back to the
    day it was made, so drawing here moves a face up the row. `markUsed` in
    character.js is that one definition, called by the run AND by the old
    `/used` route.
  - **THE CAST RIDES AT THE VERY END OF THE ATTACHMENTS**, because `charLine()`
    — the SHARED sentence in `pad-characters.js`, the same one the Story Room
    sends — says "the last attached image(s)". **Which is why the photo line
    has a twin**: `PL_GPT.photoLineWithChars` is that identical instruction
    re-anchored, sent only when a character rides behind the photo, because
    "the LAST attached image" is one of THEM by then. A run with no cast sends
    the original byte for byte.
  - **THE WORDING IS SERVED, NOT COPIED** — `pad-characters.js` is UMD-wrapped
    and served at `/pad-characters.js` (the `pause-plan.js` pattern), so the
    Prompt panel prints the REAL `charLine()` and the page owns no transcript
    of it to drift.
  - **NOT `noCharacter`'s business.** That flag is about the SOPHIE CARD,
    which is the watercolor look by another name; a character she picked is
    her own subject and rides on every gpt tile, the reference-less ChatGPT
    one included. Off on the LoRA (no attachment slot) and on PANELS (a sheet
    is not the surface to argue "the last attached image" on).
  - **A face is drawn through the derived-thumb service** — a saved character
    card is a full render (**1.26MB**, measured; its 240px thumb is **5.8KB**),
    and a picker of 143 of them would be tens of megabytes of originals.
  - **A reference that will not fetch FAILS the run** rather than quietly
    drawing a stranger — the Story Room's own rule.
  - **The sheet opens into the pill's corner**, so both card rows reserve a
    MEASURED `--charpill` column (`fitCharPill`): pre-fix the pill's own
    `Fast` label sat on the fifth recent card, and her 47px safe-area inset
    pushes the pill down onto that card's middle.
  - Test: `node scripts/test-playground-characters.js` (verified failing 3
    against the unreserved rows).
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
  disagree). **A tap LANDS ON THE STOP UNDER IT since 2026-08-24** — this used
  to say "tapping anywhere moves to the next notch and WRAPS, exactly as the
  account one does", which is precisely what Sophie reported as broken ("it
  always goes to high from medium never low even if I click it on that side").
  The aim rule is `/tritoggle.js`, shared; see *THREE OPTIONS = A THREE-WAY
  TOGGLE* in the design rules. **The two rules live in
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
  **WHAT AN ATTACHED REFERENCE COSTS IS PER-IMAGE, AND EVERY RUN NOW MEASURES
  IT FOR FREE (2026-08-24).** Sophie: "another chat said it cost 1.85 to attach
  an image can u check". Both numbers can be right — **image input is billed by
  tokens and tokens scale with the reference's own dimensions**, so there is no
  single answer, only a per-reference one. Measured 2026-08-24, same file,
  two qualities: `refs/dream-mystery.jpg` (3370x4096) is **1,505 image
  tokens = 1.20c at $8/1M, identical at low and at medium** — the reference does
  not get cheaper when the picture does. At LOW that is **45% of the whole
  bill**.
  1.85c would be ~2,313 tokens, i.e. a bigger reference (`sage-sandy-mirror.png`
  is 3345x3455 against dream mystery's shape) — plausible, not yet measured.
  **`runPromptLabGptJob` now KEEPS the `usage` the API returns** (one entry per
  render, on the run doc). It was being thrown away, so the only way to price a
  reference was to spend money on a probe — which Sophie has ruled out. Every
  ordinary run is a free measurement now; read `usage.input_tokens_details.
  image_tokens` off any run that used the style you are asking about.
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
  **THREE OR FOUR ACROSS IS HERS TO TAP, AND IT IS THE THIRD SEGMENT OF THE
  VIEW SWITCH (2026-08-25, Sophie: "the 3/4 switch button is in a weird place.
  It should not be in the auto scroll roll row").** List · Tiles · **3** — one
  box, the number as its own segment, never wearing `.on` (it is not a third
  view). Sticky, like the view and the two filters; three is the default.
  - **BOTH EARLIER HOMES ARE RETIRED BY HER, in order.** It shipped at the
    right of the search box and cost the row 38px it did not have; she moved
    it to the pill's rail ("it can go in the same column as the auto scroll
    pill"), where the fixed column floats over the prompt card on her phone
    and the button read as detached — her words above. So the rail is NOT a
    standing home for guest controls any more; this line used to say "the
    next control with nowhere to go belongs there too", and that reasoning is
    history. The row pays for the segment with 11px view-switch paddings and
    a search-box ✕ padding that exists only while the ✕ does (`.hasq`) —
    "Search" still fits, measured (56px for a 51px placeholder at 390pt).
  - **IT IS ONE NUMBER — `--cols` on the root, read by the tile wall AND by a
    run's own row of pictures in list view.** Two rules would let the two
    surfaces disagree about what "3 to a row" means, and it is also what keeps
    the button from being a dead control in list view.
  - **IT SAYS THE NUMBER BECAUSE THE PICTURE DID NOT READ.** It first drew the
    count as N bars and she asked for the number instead ("I asked for the
    button to say three or four, not a picture"). At 16px three bars and four
    bars are the same grey smudge.
  - **TWO STATES IS NOT THE CYCLE THE HOUSE RULE FORBIDS.** *THREE OPTIONS = A
    THREE-WAY TOGGLE* is about a control with stops she can AIM at, where a
    blind step past the one she tapped is the surprise; with two there is
    nowhere else a tap could mean.
  - Test: `node scripts/test-playground-cols.js` — the count MEASURED off the
    real cells (a wrong `--cols` and a wrong `repeat()` both compute to
    plausible-looking text; only the boxes say how many sit on a row), the
    segment measured inside the real view switch, nothing `position:fixed`,
    and the placeholder measured against the room the input actually has.
  **THE PROMPT BOX HAS A BIGGER-BOX TOGGLE (2026-08-25, Sophie: "can you put a
  button so I can see the prompt in a bigger box as an option").** A 26px
  rounded square inside the textarea's bottom-**RIGHT** corner (Lucide
  `maximize-2`/`minimize-2`) toggles the SAME `#prompt` textarea open and shut
  — never a second field, so nothing syncs. The compact box reserves that
  corner with `padding-bottom`, so her last line is never typed under the
  button; the toggle clears any hand-dragged inline height or "back to small"
  would not shrink; deliberately NOT sticky.
  **AND THE BIG BOX FITS THE WORDS — this REPLACES the flat 52vh (2026-08-27,
  Sophie: "why not expand based on text, not static").** A fixed height is an
  empty half under two lines and still a scrollbar under a long dictation, so
  the size said nothing about what was in it. `.big` is now the **CAP**
  (`max-height:52vh`) over a **FLOOR** (`min-height:24vh`), and `fitBig`
  measures the content into the height between them — on the tap, on every
  keystroke while it is open, and on a resize.
  - **BOTH BOUNDS ARE CSS.** The browser clamps the inline height, so the two
    numbers live in one place and no `vh` is re-derived in script.
  - **`height:auto` FIRST or the box can only ever GROW.** `scrollHeight` on a
    box already sized to its old height reports that height, so a fit without
    the reset never shrinks back when she deletes a paragraph.
  - **The border is added back** (`offsetHeight - clientHeight`): the box is
    `border-box` and `scrollHeight` excludes borders, so every fit is
    otherwise two pixels short and the box scrolls its own last line.
  - **THE FLOOR IS WHY THE BUTTON IS NEVER HIDDEN, and that is the difference
    from the `.moretxt` opener.** That opener is drawn only where a
    measurement says text is really cut, because it REVEALS words that already
    exist; this is a field she WRITES in, so "expand" has to mean room to
    write **before** the words are there. Don't "fix" it into hiding itself on
    a short prompt.
  - **PUTTING A PROMPT BACK REFITS IT** — `copyPromptIn` sets `.value`
    directly, which fires no `input` event, so it calls `window.__fitBigPrompt`
    or the copied run sits in a box fitted to whatever was there before.
  - The same rule, and the same two lessons, are in Voice Studio's words box.
  **ON THE RIGHT, SLID CLEAR OF THE PILL'S COLUMN — settled over two rounds
  on 2026-08-26.** The button shipped in the exact bottom-right corner, where
  on her phone the injected autoscroll pill's ▼ sits dead on it (measured at
  390x844 with the iPhone 13's real 47px safe-area inset: #vbot x 325-373 /
  y 153-206 over the button's x 333-359 / y 164-190; the inset is why a plain
  headless check never saw it — at the no-inset 14px the two just clear).
  #1733 moved it bottom-LEFT for a day; Sophie asked for the right side back
  ("put it back exactly where it was"), then reported the exact corner
  untappable ("i was able to click it before … now i cant"). **A z-index lift
  is NOT the fix** — measured, it puts the button over the ▼'s own centre and
  kills the pill's scroll-down instead. The settled answer is `right: 56px`:
  the right end of the box, clear of the pill's column at 390pt and at 320pt,
  both controls tappable at every scroll position. The test simulates the
  inset, asserts the button clears the pill AND that the ▼ still takes its
  own tap. Don't slide it back into the corner, and don't move it off the
  right side — both are hers.
  **AND THE BOX DOES NOT SIT ON THE BUTTON ROW (2026-08-26, Sophie's own
  correction the same day: "my point was that there was no padding between the
  buttons and the bottom of the text prompt box I suspect that that's not what
  you fixed" — she was right, the pill collision above is a real bug and it is
  not what she was pointing at).** Measured: `.styles` gives the prompt box
  10px of air ABOVE it and `.promptwrap` carried no margin at all, so
  `.controls` began at the textarea's exact bottom edge — **gap 0** — and the
  box's bottom line and the first row of buttons drew as one seam.
  `.promptwrap` takes the same 10px, so the card has one rhythm rather than a
  number picked per gap, and the test pins the two gaps EQUAL rather than
  hardcoding 10 (`node scripts/test-playground-controls.js`, verified failing 2
  pre-fix at 0px).
  **THE STORY ROOM CARRIES THE SAME BUTTON AND DOES NOT COLLIDE — measured
  the same day, not assumed.** Its button is inside `#beatpop` at z-index 50,
  over the pill's 9. Leave it bottom-right. Test:
  `node scripts/test-playground-bigprompt.js`.
  **THE CONTROL ROW IS ONE FAMILY — BLACK LINE, PAPER, 34px (2026-08-24,
  Sophie: "the buttons are styled so fucking weird. They should have black
  outlines and they're all different sizes").** Measured that day, three
  things were genuinely out of line and the rest was already right:
  - **The two three-way toggles were solid ink slabs** — the same 34px height
    as their neighbours, but the only controls on the row with no line and no
    paper, which is what read as a different size. `--tri-line` and
    `--tri-fill` split off `--tri-track` in the shared shell (both DEFAULT to
    it, so no other instance moved), and the Playground's instance is paper
    with a black line and a dark knob. **A second copy of the toggle would
    have been the wrong fix** — colour has been a per-instance token since the
    shell was written.
  - **The seed button was the row's one circle** — now a rounded square at the
    house 6px, per the 2026-08-24 rule.
  - **`#stylepick` stood 35px tall beside a row of 34s**, because its height
    rule was written `.controls #stylepick` and the picker lives in `.styles`,
    not in the row. A selector that never matched, quietly, for months.
  - **The two ladders and Generate are deliberately NOT in that family** — the
    ladders wear no box at all (her own earlier ask) and Generate is filled,
    because it is the action. Don't "fix" either.
  - **THE TOGGLES KEEP THEIR CAPSULE**, which is the shared shell's sanctioned
    exception to *no pills*; squaring them off would move the account switcher
    and the search filters too.
  - Test: the `one family` section of `node scripts/test-playground-controls.js`
    — heights, line colours and fills read off the REAL boxes, because that
    complaint is entirely about what renders.
  **THE PILL'S OWN "Fast" LABEL PRINTS OVER THIS ROW, AND IS NOT FIXED
  (2026-08-24, visible in her screenshot as "East" over the Square button).**
  `#spd` is always drawn under the pill, and the Playground's card runs the
  full width of the page — under the reserved column — so on her phone, where
  the safe-area inset pushes the rail down, that label lands on the canvas
  toggle. It is the CARD not reserving the column, not a pill bug, and it is
  the same on any page whose content runs under the rail. **Fixing it costs a
  third line of controls** (reserving 56px wraps the row again at 390pt,
  measured), so it is hers to call. Don't reserve it without asking.
  **A PROMPT'S "… more" IS DECIDED BY MEASUREMENT, SO A BOX WITH NO LAYOUT IS
  LEFT UNDECIDED (2026-08-25, Sophie: "why is there only a Seymour… Button for
  some of the prompts?" — dictation for *see more*).** The opener is added only
  where `scrollHeight` really exceeds `clientHeight`, which is the honest test —
  but **`#runs` is HIDDEN in tiles view**, so every card the feed drew while she
  was on the wall measured 0/0, which reads as *nothing was cut*; the head html
  never changes again, so `applyClamps` never got a second look and those cards
  had NO opener forever, on prompts clipped mid-word. Measured against her real
  feed: 36 of 36 openers in list view, **0 of 36** when the same runs were first
  drawn in tiles. An unlaid-out box now returns undecided and `resyncClamps()`
  asks again when the list is shown — and once `document.fonts.ready` settles,
  since the font moves the wrap. Test:
  `node scripts/test-playground-more-opener.js` (verified failing 2 pre-fix).
  **THE TILE WALL IS THREE TO A ROW, AND THE LIGHTBOX'S SIDE ARROWS ARE A TAP
  WITH NOTHING DRAWN (2026-08-24, Sophie: "make playground thumbnails 3 to a
  row not 4" · "the side arrow bars - buttons shud be smaller, tap targets
  bigger. tap anywhere on the right or left of the screen in the image area
  and it switches left or right" · **"the top left and right bars cover part
  of the image. Can you just make it tap and no buttons showing"**).** Four
  across stopped being enough to judge a picture by once the tiles were no
  longer cropped squares. In the lightbox `.lbnav` is a transparent 28% strip
  running the full height of the image area — **over the picture, which is the
  point** — and **that is the whole control: no chip, no glyph, no plate, no
  background.** The 26x96 `.lbbar` chip that used to be drawn at each zone's
  outer edge is GONE; the zone was always what she was tapping, so the mark
  was buying nothing and paying for it in a covered strip of a portrait 2:3.
  **A tap zone over a picture stays invisible** — the whole point of a big
  target is that it does not have to be shown. The stage (`.lbstage`) exists
  so "the image area" is a real box: the zones are sized to the picture, never
  to the window, so the caption and the ♥/✕ row under it are never covered.
  Hidden at the ends of the feed takes the ZONE with it, so a tap there
  closes.
  **AND THE STAGE IS WHY THE LABEL WENT UNDER THE PICTURE — the picture has to
  SHRINK WITH IT (2026-08-26, Sophie: "the label is covered by the
  picture").** The stage is `position:relative`, so it and the `<img>` inside
  it paint ABOVE the static caption below them, and the picture's own
  `max-height:76vh` never shrank when flex squeezed the stage — so on a SHORT
  viewport the bottom of a portrait 2:3 sat on top of the MODEL · QUALITY ·
  SIZE line. `min(76vh, 100%)` binds the picture to the room the stage really
  has, and `flex:none` on the caption and the ♥/✕ row makes the stage the only
  thing that gives. **The height is the whole bug**: measured, it is 17px of
  the label covered at 560, 10 at 620, 5 at 660 and **nothing at 844** — the
  iPhone 13 in Safari, which is where anyone testing it would look. The app's
  web view is shorter by its bottom bar, which is why it was only ever visible
  in her hand. The shared `asset-lightbox.js` has the same shape and was
  measured clean (its caps are 46-62vh with the note box) — leave it. Test:
  `node scripts/test-playground-lightbox-caption.js` (five heights, the
  overlap asked with `elementFromPoint`, which reports `lbimg` sitting on the
  label pre-fix; verified failing 8).
  Test: `node scripts/test-playground-liked-arrows.js` — nothing drawn
  (child nodes, text, background and border all measured off the real
  buttons), the zone measured over the picture, and the edge tap asked with
  `elementFromPoint`; verified failing 3 against the pre-fix page. Its fixture
  had to become a REAL-SIZED 2:3 picture, because the lightbox sizes itself to
  the picture and a 1x1 pixel put the zones nowhere near it.
  **THE PLAYGROUND'S LIGHTBOX IS THE SHARED ASSETS ONE NOW — `asset-lightbox.js`,
  the exact code, not a lookalike (2026-08-26, Sophie: "I tried to port that
  exact design into the playground and Meta assets and anywhere else that
  images are seen, but the design is different in playground, people keep
  fixing parts of it, but it should be the exact same design — can it not be
  the same exact code?").** It was the LAST hand copy in the house (Meta
  Assets, the Assets tab and the grid/deck pages already shared the one file), and every fix below reached only whichever copy a chat happened
  to touch — the drift she was pointing at. The page now builds NO lightbox of
  its own; what it needs rides the shared file's HOOKS, per the never-a-fourth-
  copy rule:
  - **`nav: {prev, next}`** — the two invisible 28% step zones over the
    picture (her 2026-08-24 tap-anywhere rule, kept); a null side draws
    nothing, so the ends of the feed close on that tap. The order is still
    read off the view behind the lightbox (`lbSeq`).
  - **`promptSide` / `promptOpen`** — the door's state rides a STEP and dies
    with a fresh open (her rule, kept: "the half she picked rides along as
    she steps; a fresh open always starts on content"). The shared file
    writes the state back onto the asset; the page passes it forward.
  - **`window.__assetLightboxClose()`** — for `__navBack` (the app chevron
    closes the box first) and the copy action.
  - **A half with nothing filed shows no Style|Content pair** — the
    Playground's no-style-half silence, now everyone's.
  - **`votesBelow` PUTS TWO BUTTON FAMILIES ON ONE LINE, SO `.vbelow` SIZES
    THEM (2026-08-27, Sophie: "bottom buttons are all different sizes in the
    playground light box … find what size they were 24 hours ago and make them
    all that size").** `.vote` is 38px because it was drawn for the screen's
    TOP CORNERS, and `.lbacts button` is 34px; `votesBelow` moves the votes
    into that row, so ♥ ✕ sat visibly bigger than copy · save · story beside
    them, with the 38px note-send under both. **The size she asked for is the
    Playground's own**, read off its hand-rolled lightbox as it stood the day
    before the port (`.lbbtn` — 46x46, a 21px glyph, 22px apart), where all
    five really were one class. It is a `.vbelow` rule in `asset-lightbox.js`
    — and since 2026-08-28 `.vbelow` IS every caller's layout ("a single
    lightbox view … it's not in meta assets?"), so the Assets tab, Meta
    Assets and the grid pages carry the same 46px row now. **A hook that
    MOVES a control into another row inherits that row's problem: check the
    sizes on both sides of the join.** Pinned by the size block in
    `node scripts/test-playground-lightbox.js`, MEASURED off the real boxes
    (two rules winning on two different buttons is invisible to any class
    assertion) — verified failing 2 pre-fix, naming all three sizes.
  What SURVIVED the move, as caller wiring: the thumb-first open with the
  original swapping in from the ONE fetch Save needs (below); the style half
  derived from THIS run's `fullPrompt` (`runPromptHalves`, below); ♥/✕ to the
  run doc's own vote route; the meta line as the MODEL · QUALITY caption; and
  the actions row — put the prompt back in the box, Save to Photos, Send to
  the Story Room. What came FREE: the note thread on every picture (wired
  into `my-creations`). What is HISTORY, superseded
  by the shared design she asked for: the `.lbtop` band with the back
  chevron (the way out is the Assets rule — a tap on any dead space closes;
  `__navBack` still closes it from the app's chevron), the `capseg` segmented
  pair (the Assets overlay's Style/Content buttons ride inside the words),
  and the meta-only caption band (the caption sits under the note box, where
  the Assets tab puts it). **Do not restyle `#clightbox` from promptlab.html,
  and do not add a playground-only control outside the hooks** — that is the
  copy growing back. Tests: `node scripts/test-playground-lightbox.js` (step 0
  is the SOURCE PIN that the page links the shared file and carries no markup,
  CSS or `#lb` of its own), `test-playground-liked-arrows.js` (the zones,
  now the `nav` hook), `test-playground-lightbox-caption.js`,
  `test-asset-lightbox.js` (the hooks themselves).
  **THE THREE 2026-08-26 ASKS BELOW WERE BUILT ON THE OLD HAND COPY and are
  kept as the record of WHY the behaviours exist — the mechanics described
  (element ids, the band, `.lbpwrap`) are that copy's and are gone.**
  **THE LIGHTBOX OPENS ON THE CACHED THUMB, HAS A WAY OUT AT THE TOP, AND SAYS
  PROMPT (2026-08-26, Sophie: "it seems like it takes quite a while to load the
  images in light box view … it's a little hard to tap out of them. Could you
  have some room at the top … can you have it say prompt and have the prompt in
  there instead of below split into the style and the content and the style
  shouldn't be the default it should actually look at what it was that time
  since I can change it").** Three faults on one overlay.
  - **SLOW: the wall loads a 480px derived thumb and the lightbox loaded the
    untouched ORIGINAL** — 1-3MB at the 2K and 4K tiers, so every tap was a
    fresh download over cell with the PREVIOUS picture still on screen. It
    paints `thumbFor(src)` first (already in the browser's cache — it IS the
    tile she just tapped, so it lands in the same frame) and swaps the original
    in behind it **from the SAME `fetch` that was already being made for Save**:
    one download, not two, and never a blank. `lbSrc` holds the original url —
    Save and the app's native bridge read that, NEVER `lbimg.src`, which is a
    thumb and then a `blob:`.
  - **HARD TO TAP OUT: `.lbtop`, a 40px band ABOVE the stage** with the house
    chevron in it, and the whole strip closes. The two step zones are 28% of the
    width EACH and run the stage's full height with nothing drawn in them
    (2026-08-24), so more than half the picture area pages instead of closing
    and no mark says which part does what — the band is outside both zones, so
    it can never be one.
  - **THE PROMPT SAYS "Prompt" AND SPLITS**, the Assets overlay's own two
    halves, opening on CONTENT per the house rule. **THE WORDS ARE BEHIND THE
    TAP AND COVER THE PICTURE — they are never printed under it (2026-08-26,
    her next message: "something strange is going on with the prompt. It
    shouldn't be there").** The first cut put a "Prompt" label with the
    Content/Style pair over the text and left the text sitting between the
    picture and the ♥/✕ row, which is the half of her ask it missed — "have the
    prompt **in there** instead of below" names the ASSETS overlay's shape,
    where PROMPT is a door and the words cover the art. Printed below, a
    dictated content half takes a third of the screen off the one thing she
    opened the lightbox to look at, on every picture, asked for or not.
    `#lbpwrap` sits over the STAGE (never the caption or the buttons) and above
    the two step zones, so a tap on the words reads them instead of paging;
    tapping them again puts them away, and neither tap leaves the lightbox.
    **The Content/Style pair rides INSIDE the words** — two buttons under a
    shut door change nothing on screen. Shut on every fresh open; the door's
    own state, like the half she picked, rides along as she steps.
    **AND THE DOOR IS IN THE BAND AT THE TOP, ONE WORD, NOTHING ELSE
    (2026-08-26, Sophie: "It should be at the top and it should be hidden.
    Just say prompt like it does in the assets").** It shipped under the
    picture — a row between the art and the ♥/✕ carrying the word AND the
    Content/Style segment, i.e. a control offered before she had asked for
    anything — where the Assets overlay puts ONE button saying Prompt over the
    picture and keeps the pair inside the words it opens. So `.caphd` moved
    into `.lbtop` beside the chevron (`.lbbal` is the chevron's width on the
    other end, so the word is centred on the BAND rather than on the room left
    beside it), `.capseg` moved inside `#lbpwrap`, and the caption band under
    the picture is the MODEL · QUALITY · SIZE line alone, with no control on it
    at all. Two things not to undo: only `#lbpbtn` is in `#lb`'s skip list, so
    the rest of the strip — the empty half of `.caphd` included — still closes
    the lightbox, which is what the band is for; and `#lbpwrap`'s own handler
    skips `button[data-half]`, or every tap on Style would shut the words she
    just opened. **The style half
    is DERIVED
    FROM THIS RUN'S OWN `fullPrompt`** — `runPromptHalves` splits her typed
    words out of the literal text that was sent, so it is the wrapper that
    really rode along (her edited prefix, the no-text swap, the character and
    photo lines) and never the tile's baked default; that is the half of her ask
    that matters, since she can edit the Prompt panel between runs. Nothing new
    is stored and every run already on file gets it. No wrapper (the plain
    ChatGPT tile) → an empty style half and NO Style button, the same silence
    the Assets overlay keeps.
  - The half she picked rides along as she STEPS (comparing a style across two
    pictures is why she would switch it); a fresh open always starts on content.
  - Test: `node scripts/test-playground-lightbox.js` — the original served with
    a real 1200ms delay and the picture asked for its `naturalWidth` and box
    IMMEDIATELY (a src assertion cannot tell a painted picture from a pending
    one), the band's own tap and the chevron asked with `elementFromPoint`, and
    the style half checked for a word the tile's default does not contain.
    What is over the middle of the picture is asked with `elementFromPoint`
    both before and after the PROMPT tap — a hidden box and a covered picture
    look identical to every markup assertion.
    **AND IT HAD BEEN TIMING OUT ON MAIN SINCE /feedkit.js LANDED**: its stub
    served `/tritoggle.*` by hand and 404'd the kit, so the page threw on its
    first line and nothing rendered. It calls `scripts/lib/public-asset.js`
    now, like its siblings — a harness that hand-lists shared files is one
    shared file away from a silent timeout.
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
  **AND IT RUNS INTO THE PILL'S COLUMN, ON THE ROW IT HAS ALWAYS BEEN ON
  (2026-08-28, Sophie, four messages: "search way too small. why can't it show
  behind pill column" → "i don't need to tap" → "put x on other side" → "you
  put it on a separate row? I specifically asked for it to stay where it
  is").** Measured at 390pt: the row is List·Tiles·3 (148) + the filter chips
  (70, or 104 with the sheets chip) + the 56 the injected pill owns, which
  left the box **76px, or 41 on the PANELS tab** — her screenshot shows the
  placeholder clipped to "Se" with the caret in it. **The ROW cannot go under
  the pill and that is the answer to her question:** `.feedbar` is
  `position:sticky; top:0`, so unlike ordinary content — which passes under
  the pill's fixed corner on its way up — it sits inside that corner
  PERMANENTLY, and anything tappable in those 56px is covered for good. **But
  the FIELD can, and does** (`margin-right:-56px`, 76 → 132): the ✕ moved to
  its LEFT end the same day, so nothing on its right is a control any more,
  only the tail of a query she reads from the left, and the pill still floats
  over that tail and still takes its own taps. The other controls keep the
  reservation — every one of those IS a tap target.
  **TWO OTHER SHAPES SHIPPED FIRST AND SHE CUT BOTH; NEITHER IS A RULE.** A
  line that appeared when the box was focused ("i don't need to tap" — a box
  only usable once it is tapped is one she has to ask for), and a second line
  of its own under the controls ("I specifically asked for it to stay where it
  is"). So the box **stays on the row**, there is no `.searching` state,
  nothing to repaint and no JS at all — and stepping a neighbour aside to make
  room is out for its own reason: switching to tiles over the hits and
  lighting the heart on them are two of the things a search is FOR, and a lit
  filter she cannot see is the silent-filter failure this app keeps getting
  burned by.
  **THE ✕ IS AT THE LEFT END OF THE FIELD** (her third message), which is what
  buys the column: the right end is where her caret sits and where dictated
  text grows, and the left end is the one part of the field never doing
  anything else. Its 28px of padding exists only while the ✕ does, so an empty
  box keeps its whole width for the placeholder. Test:
  `node scripts/test-playground-search-room.js` (the real page with the real
  injected pill at the iPhone 13's 47px inset — one row, the field into the
  column, the controls and the pill asked with `elementFromPoint`).
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
  **BUMPING RUNS TO THE TOP RE-DATES THEM, AND THE SET MUST BE EXACTLY WHAT SHE
  NAMED (2026-08-28, Sophie: "why did all the rat images get moved to the top of
  playground" → "I only wanted the dance, creepy guy once").** The feed is
  `orderBy('createdAt','desc')`, so the only way to gather a group at the top is
  to rewrite its dates — `scripts/playground-bump.js` (dry by default, ids TOP
  FIRST, the real date kept as `createdAtWas`, `--undo --go` puts it back).
  It works and it is reversible; what went wrong was the SCOPE. She asked for
  the creepy-guy panels "old and new every version" and then "then same for all
  dance/glove ones" — read as three stories, that bumped **27 single glove/rat
  runs** along with the 5 panels runs, and 27 copies of one picture at the top
  of the Picture tab is what she was looking at.
  - **A bump is a LOUD change to a surface she scans every day**, so it is one
    tap's worth of scope: name the runs back to her BEFORE writing, and when a
    phrase of hers could mean two sets, bump the smaller one and say what the
    other would be. Guessing wide is not the cheap direction here even though
    the write is reversible — she has to notice and ask.
  - **The bumped runs carry `createdAtWas`, which is how you tell a bump from a
    real run** and how any later chat scopes an undo: sweep the feed for it
    rather than trusting an id list from a reply.
  - **Never stamp AHEAD of now.** The first pass stamped a few hours into the
    future so a chat drawing concurrently could not land above the block — which
    means anything she genuinely draws next sorts UNDER it until the clock
    catches up. `--at` defaults to now; leave it there.
  **AND A KIND-FILTERED FEED PAGE IS FILLED, NEVER JUST READ (2026-08-28,
  Sophie, the same morning: "aldo all the older ones r gone").** The PICTURE and
  PANELS tabs have separate galleries, and `kind=single` drops the panels runs
  **after** the page of docs is read — on the reasoning, written into the route,
  that "a short page is fine, the client's Older keeps walking". That is true
  while the page is SHORT and false when it is EMPTY, and empty is what happened:
  measured that morning, **the newest 40 docs were 40 panels runs**, so the
  Picture tab's first page came back with nothing at all over **1,140 runs going
  back to Aug 2** — and an empty page has no oldest single to take a cursor
  from, so `loadMore` bailed on the missing cursor and **Older could not walk
  out of it either**. An empty tab over 1,100 pictures reads as the pictures
  being deleted.
  - **The walk is `pl-feed-fill.js`** — pure, injected with the route's own
    reader, so the paging rules are testable with no Firestore. It keeps
    reading until it HAS its limit, bounded at `PL_FILL_PASSES` (an unbounded
    fill would let one request read the whole collection). **An unfiltered read
    — no `kind`, which is what every older cached page on her phone sends —
    still costs exactly ONE read and answers as it always did**, and a test
    pins that.
  - **`more` means "there are docs behind this page"**, so it is the last
    read being FULL, never the number of keepers — a page of 3 at the end of
    the feed must say false or Older never stops.
  - **The page asks with `kind=single` on its FIRST load too**, not only in
    Older (that was the whole asymmetry), and Older keeps a last-resort cursor
    off the oldest run of ANY kind so a stale cached page can still walk out.
  - **The lesson beyond this feed: "the caller can just ask again" is only a
    design while the caller still HAS something to ask with.** Filter-after-read
    paging hands back an empty page and, with it, the cursor the next request
    needed.
  - Test: `node scripts/test-playground-feed-fill.js` (the walk over fixtures,
    then the two page halves and the route's use of the shared fill).
- **Squaring** (`cropper.js`, `/api/crop`, page at `/crop`, iOS tile under the
  PICTURES filter) — crop pictures to square by TAPPING ARROWS. Sophie's ask
  (2026-08-29), after twelve automatically-squared pictures came back missing
  the thing each one was about: "the shirt is crucial, the elbow isn't" →
  "could you make a cropping tool where I move it up or down with arrows
  rather than dragging."
  **IT COSTS NOTHING** — a download, sharp and an upload on our own box, no
  model call anywhere; opening it spends nothing.
  - **THE WHOLE TOOL IS ONE NUMBER PER PICTURE.** `pos` 0..1 is where the
    square sits along the LONG edge — 0 flush with the top (or the left), 1
    with the bottom, 0.5 dead centre, which is exactly what an automatic crop
    gives and exactly what she was correcting. A square out of a 2:3 has ONE
    degree of freedom, so there is no zoom and nothing to drag; a LANDSCAPE
    source turns the same two arrows into left/right, and a picture that is
    already square disables them rather than leaving two dead controls.
  - **THE PREVIEW SHOWS WHAT IS LOST, NOT ONLY WHAT SURVIVES.** She is looking
    at the WHOLE picture with the discarded bands dimmed and the kept square
    outlined — a square preview alone answers the wrong question, since what
    she is correcting is what falls outside it.
  - **THE PAGE AND THE SERVER CANNOT DISAGREE ABOUT THE CROP** — `cropBox()`
    in cropper.js and `box()` in crop.html are the same arithmetic, and
    `test-cropper.js` EXTRACTS the page's copy out of the real html and drives
    it against the server's over six shapes at five positions. A preview that
    lies about the cut is the one failure this must not have; re-typing the
    page's function into the test would only pin the test against itself.
  - **POSITIONS SAVE THEMSELVES; SAVE IS WHAT CUTS.** An arrow tap is a
    thought, not a commitment, so `POST /pos` writes the number alone
    (debounced — a hold-to-repeat is ONE write, and the debounce is
    deliberately longer than the repeat interval or the first write lands
    mid-hold). **Save crops** is the background job: download, cut, upload,
    apply, poll. Only pictures she has MOVED since their last cut are re-cut,
    compared as numbers — so nudging one away and back costs nothing.
  - **NOTHING IS DESTROYED.** The source is never touched or replaced; a cut
    writes a NEW copy and points whatever asked (`apply`) at it. `pos` rides
    in the filename, so a re-crop is a different object and no year-long CDN
    cache can serve her yesterday's crop. A set is HIDDEN, never deleted.
  - **`apply` IS HOW A SQUARE GETS HOME.** One kind so far —
    `{kind:'memory', uid, id}` → the membry memory doc's `illustration.url`,
    i.e. a Shoebox polaroid. Whitelisted (`cleanApply`), so nothing else on
    the object is ever stored. The membry handle is HANDED IN by server.js
    (`cropperMod.init({ membryDb })`), the scratchpad pattern.
  - **RE-SEEDING KEEPS HER WORK.** The doc id is `sha1(title + the urls)`, so
    the same set POSTed twice IS the same set: `mergeItems` keeps every
    position and every cut copy, and takes only the label and the apply target
    from the new POST.
  - **NO PILL** — one screen, never scrolls, like `/filmeditor` and
    `/opinions`. The page is still written to survive one (its script is in an
    IIFE and declares no pill global), and the test injects the real pill to
    pin that.
  - **A CHAT SEEDS IT AND HANDS HER THE LINK:** `POST /api/crop/sets {title,
    items:[{url, label, pos?, apply?}]}` → `/crop?set=<id>`. The label is what
    the crop has to CONTAIN — her words for that picture — and it is on screen
    under the arrows, because that is the whole question she is answering.
  - Tests: `node scripts/test-cropper.js` (the arithmetic and the set rules,
    pure) and `node scripts/test-crop-page.js` (the real page headless — every
    assertion a MEASUREMENT of the real boxes, since a wrong crop renders as a
    perfectly plausible picture).
- **Freeform** (`freeform.js`, `/api/freeform`, `/freeform`) — the one image
  surface with **no opinion**: the prompt goes to gpt-image-2 verbatim, no prefix,
  no suffix, not even a trailing-period trim. `promptSent` is stored on every run
  so anyone can verify nothing was added — the "if you add anything to a prompt
  Sophie gave, tell her" rule made structural. References are a LIBRARY, not a
  per-run upload.
  **ONE EXCEPTION, AND IT IS A BUTTON — the BOILERPLATE STYLE toggle
  (2026-08-28, Sophie: "add a default boiler style not content prompt to
  freeform with a toggle on off button" · "boiler plate").** While the toggle
  is lit, the house style-reference recipe wraps her words — its prefix before
  them, its tail after — so she can attach her own reference and say "copy the
  style, not the content" with one tap.
  **THE WORDING IS SERVER.JS'S, NOT A NEW ONE, and the first cut got this
  wrong** (Sophie: "the text we use for dreamy or watercolor" · "ex: copy the
  style etc / not content"). It shipped with an invented style line, which is
  exactly the reconstruction the exact-prompt rule forbids — and needless,
  since `PL_GPT_STYLES` already holds the settled recipe. It is
  `PL_GPT_STYLES.evan` (**Sandy mirror**, her ink-and-watercolour page),
  **HANDED IN at mount time** — `require('./freeform').init({gptStyles})` right
  after that table, the movies.js pattern, because freeform is mounted hundreds
  of lines above it and a require would read it before it exists.
  **WHY THAT ONE AND NOT DREAMY:** this wording names "the attached style
  reference" and nothing else, so it travels onto whatever SHE attached here;
  Dreamy's tail names its own picture (its hand-drawn frames, the woman in the
  green tank top) and would be nonsense over her references. Switching is one
  line — `BOILER_STYLE` in freeform.js.
  **ONE CLAUSE IS DROPPED — the colour line** (2026-08-28, Sophie: "get rid of
  the color line"). Sandy mirror invites the model to pick its own palette; in
  Freeform the reference she attached is usually the whole point of attaching
  it, so the sentence argues with her. It is cut as a NAMED clause
  (`COLOR_CLAUSE`, the swap pattern Dreamy's no-text toggle already uses), so
  this stays the house wording minus one sentence and **the Playground's Sandy
  mirror tile is untouched**; `BOILER.colorCut` records that the clause was
  found, and the test fails on a reword rather than letting it silently come
  back.
  Four things keep it from breaking the module's whole promise, and none is
  optional: it is **OFF by default and NOT sticky** (a wrapper remembered from
  last week silently riding today's run is exactly the surprise this surface
  exists to avoid); the lit button **prints both halves and says where each
  lands**, so nothing is ever added invisibly; the **text is SERVED**
  (`GET /api/freeform/style`) and neither the page nor freeform.js keeps a copy,
  so nothing can drift from the table; and the run stores `boiler` plus
  `promptSent`/`promptStyle`/`promptContent` through the ONE builder
  (`prompt-record.js`) — **off files NO style half at all**, which is the honest
  answer rather than a reconstruction. Putting a run back restores the toggle to
  what THAT run had, the same *only change what the record knows* rule the
  references follow. `boilerFields` is the one assembler.
  **AND THE PAGE HAS NO INFO TEXT AT THE TOP** (2026-08-28, Sophie: "get rid of
  the info text at the top of Freeform") — the header is the whole top of the
  page; the lede paragraph explaining the module is gone.
  **AND THAT LEDE WAS RESERVING THE PILL'S COLUMN — TAKING IT OFF BROKE THE
  PILL (2026-08-28, Sophie: "pill broken in freeform").** The paragraph carried
  `padding-right:56px`, so the page's two panels began BELOW the injected
  pill's band; with it gone they moved straight up into it, and nothing
  replaced the reservation. Measured at the iPhone 13's real **47px safe-area
  inset** (which is 0 in headless Chromium, so this was only ever visible in
  her hand): the Reference panel's white box drew under the capsule, the pill's
  own `Fast` label printed inside the Prompt panel, and the fourth-column
  reference tile came back **COVERED BY THE PILL** — `elementFromPoint`
  answered `float`, i.e. a tile she could not tap at all.
  - **`fitPillGap` MEASURES the pill's real rect** — never a hardcoded 56/64
    band, because the pill is conditional and its top rides
    `env(safe-area-inset-top)`.
  - **SHORTEN THE PANEL THAT OWNS THE CORNER, NUDGE THE ONE THAT ONLY DIPS, and
    the threshold is the column's own width.** The Reference panel shortens
    (`--pillgap` on its margin) — that is the only thing that makes its fourth
    tile tappable. The Prompt panel's top merely dips into the bottom of the
    band, and cutting 58px off a row that already fits three controls wraps
    them onto a third line for the sake of ~30px of overlap — the Playground's
    own note about this corner says a third line of controls is not a price to
    pay unasked — so it is moved (`--pilltop`) instead.
  - **EVERY PANEL IS MEASURED WITH BOTH RESERVATIONS AT ZERO FIRST**, in one
    pass, so a panel is never judged on a position this function gave it: nudge
    it clear, find it clear, drop the nudge, find it colliding — forever. For
    the same reason a write that changes nothing is skipped, since the
    observers that call this back are woken by a style attribute.
  - Judged at the TOP OF THE PAGE: a live viewport test would change a panel's
    width as it scrolled past, and the run cards below pass under the rail
    exactly as they do on every other page here.
  - **THE LESSON BEYOND THIS PAGE: a `padding-right` near the top of a page is
    usually load-bearing.** Removing the thing that carried it is a pill bug
    with nothing on screen naming the pill.
  Test: `node scripts/test-freeform-pill.js` (the real page + the real injected
  pill, headless, at both insets with the library folded and open — verified
  failing 14 pre-fix; the covered tile is asked with `elementFromPoint`, which
  is what a covered control passes every width assertion while failing).
  Test: `node scripts/test-freeform-boiler.js` (it reads the real table out of
  server.js, so a stale style id or a pasted copy fails there).
  **Full details: `docs/modules/pictures.md`.**
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
  **480p WAN CANNOT DO A SHORT CLIP — `num_frames` HAS A FLOOR OF 81
  (2026-08-28, Sophie: "does 480p wan have a timing option - can it do 1 or 2
  seconds instead of 5? if so? is it cheaper?").** No, and the question of
  whether short is cheaper does not arise. `wan-2.2-i2v-fast` refuses anything
  under 81 frames at validation — *"input.num_frames: Must be greater than or
  equal to 81"* — so at its 16fps the usable range is **5s to 7.5s** (81-121
  frames), and there is no 1s or 2s clip to price. **The probe cost nothing:
  a 422 is refused before it is billed**, which makes this shape of question
  free to settle — ask the API, do not reason about it.
  The schema also settles why the house price is BANDED rather than
  per-second: it says pricing is "based on the video duration at 16 fps", and
  the only two rungs inside 81-121 frames are the 6c/8c the ledger already
  records. **Want 1-2 seconds of motion? Render 81 frames and TRIM** (ffmpeg
  on our own box, free) — same 6c either way, and she picks which second. Wan
  **2.7** genuinely takes 2-15s and is per-second, but has no 480p at all, so
  a 2s clip there is 20c at 720p rather than 6c.
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
  region it is stalled on was the repeated mid-film pause.
  **A WRAPPED PAGE CAN BE DAYS STALE — THE APP KEEPS RECENT TOOLS ALIVE, SO A
  PAGE LOADS ONCE PER APP PROCESS AND NO DEPLOY CAN REACH IT (2026-08-23, the
  round-three finding, MEASURED: ten Film Editor PRs shipped in one day while
  she kept reporting the pre-fix symptoms verbatim; her play posted no
  telemetry beacon while the live route round-tripped fine — the one honest
  proof her phone was running an old page).** RootView holds the three recent
  tools in a ZStack (state survives tab switches — deliberate), so re-entering
  a tool only toggles opacity; the WKWebView's page is whatever loaded FIRST
  in that app process. Two consequences, both built here and worth copying to
  any wrapped tool where page-version skew bites: **the page heals itself**
  (`buildCheck` — every 5 min it compares its `BUILD` const against
  `GET /api/filmeditor/build`, served from the html itself, and reloads IN
  PLACE only while idle: never mid-play, mid-upload, within 10s of a save, or
  under a sheet; `?c=` puts her back in the same cut), and **every play posts
  a TELEMETRY beacon** (`POST/GET /api/filmeditor/telemetry?cut=` — build id,
  rVFC fire counts, playhead holds, boundary reveal waits, audio start
  latency/entries/stalls, proxy-vs-raw, capped 20 sessions) so a bug report
  from her hand comes with the device's own account. **Before diagnosing ANY
  "still broken" report on a wrapped tool, read the beacon's build id first**
  — a report about an old build is not a bug in the new one), **a source boundary keeps
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
  and swaps only the voice). Her words stay in the box after a render. **The
  page OWNS its header** (one `.app-header` row, the title centred by
  pagehead) — it carried none while Apple's nav bar had the title, and when
  `.forgeWebToolBar` took that bar away the tool went NAMELESS, showing a bare
  chevron and nothing else (2026-08-27, Sophie: "this header doesn't match the
  app pattern"). There are still no character counts; credits live behind the
  ⓘ on the tab row.
  **THE WORDS BOX EXPANDS (2026-08-27, Sophie: "add an expand text box button
  in the voice studio").** A 26px rounded square inside `#text`'s bottom-right
  corner toggles the SAME textarea open and shut — the Playground's
  `#bigprompt` answer lifted in SHAPE, never a second field to keep in sync.
  **IT FITS THE WORDS, IT IS NOT A FIXED SIZE (2026-08-27, Sophie: "why not
  expand based on text, not static")** — `min-height:24vh` / `max-height:46vh`
  are the floor and the cap, and `fitBig` measures the content into the height
  between them on the tap, on every keystroke and on a resize. The three rules
  behind that (both bounds in CSS, `height:auto` before measuring or the box
  can only grow, the border added back on a `border-box` box) and the reason
  the button never hides itself are written out once, under *THE PROMPT BOX HAS
  A BIGGER-BOX TOGGLE* in the Playground section — read them there before
  touching either copy.
  Four things not to undo: the box reserves that corner with `padding-bottom`
  (or her last line is typed under the button); the toggle clears any
  hand-dragged inline height, since the box is `resize:vertical` and "back to
  small" would otherwise leave it where she dragged it; it is **NOT sticky**
  (the compact box is the page's shape — her WORDS are kept in localStorage,
  the size is not); and it sits **56px in from the right**, not in the exact
  corner, because `/voice` is served `{ pill: true }` and the injected pill
  owns that fixed column — a z-index lift is not the fix, it steals the pill's
  own ▼. Test: `node scripts/test-voicelab-bigbox.js` (the real page headless,
  with the real pill and the iPhone 13's 47px inset simulated).
  **♥ / ✕ ON A TAKE, AND THE TWO FILTERS OVER THEM (2026-08-28, Sophie: "add
  the same playground heart x hide pattern in voice studio").** The
  Playground's pattern brought over whole rather than reinvented: both marks on
  every finished take's meta row, tapping the lit one clears it
  (`POST /api/voicelab/render/:id/vote`, one field on the take's own doc), and
  one segmented box of two filters on the list's header line — ♥ keeps only
  what it names, ✕ drops only what it names, and they stack. Five things not to
  undo:
  - **ONE SETTING ACROSS BOTH TABS** (her call): Text and Voice are two views
    of one state (`voicelab_liked` / `voicelab_hidex`), so `paintFilt`
    repaints every copy. A filter lit on the tab she is not looking at is the
    silent-filter failure this app keeps getting burned by.
  - **THE TWO LIT COLOURS MUST DIFFER** — the heart takes the rose and the ✕
    the quiet grey. They do opposite things, and two rose buttons side by side
    read as two of the same thing (the Playground's own `.xfilt.on`).
  - **A ♥ SYNCS WITH THE ASSETS TAB, BOTH WAYS** (her call: "so the two
    agree") — the take is already filed into `professional-voice-plan-review`,
    so the vote route writes the `forge-asset-votes` doc and the Assets vote
    route calls `voicelab.voteFromAssets` back. One direction only would leave
    a stuck heart on whichever surface she did not tap. Best-effort on both
    sides: the mark she tapped has to land whatever the sync does. **Only a
    TTS take has an Assets record** — `fileTakeToAssets` skips the changer —
    so a changed take's mark lives on its doc alone, honestly.
  - **AN UNFINISHED OR FAILED TAKE WEARS NO MARKS** and hearts-only drops it,
    the Playground's rule for a failed run: there is nothing finished to have
    an opinion about. Hide-the-✕'d only ever drops a ✕, so a failure stays.
  - **A filtered-away card is HIDDEN, never removed** (the poll repaints it in
    place), and an emptied list SAYS why — "Nothing hearted yet" /
    "Everything here is crossed out" — rather than looking like a lost history.
  Test: `node scripts/test-voicelab-votes.js` (the server contract by source,
  then the real page headless with the real pill and the iPhone 13's 47px
  inset; verified failing 3 against the pre-fix page).
  **Every take is kept** —
  the output AND, on the changer, the recording that went in — and each card
  has a ⤓ that downloads it through our own server (`GET /api/voicelab/file/:id`,
  `?src=1` for the source); a Storage url alone only plays inline.
  **A RENDER KILLED BY A DEPLOY IS RECOVERED, NEVER RE-RENDERED (2026-08-27,
  Sophie: "voice studio render killed").** A render is a fire-and-forget job in
  this process, so a deploy that swaps the instance out kills it between
  "ElevenLabs finished" and "we saved it": the doc sits on `rendering` forever
  and the page — which polls every 2s while a take says that — **spins on it
  with nothing on screen ever admitting it is dead**.
  **BUT THE TAKE THIS WAS BUILT ON WAS NEVER KILLED — TWO CHATS GUESSED THE
  SAME WRONG CAUSE ON THE SAME NIGHT (2026-08-27).** Her 4,842-character Max
  take started 8:16pm Pacific, four minutes after #1794's deploy merged, which
  is what made "killed by the deploy" look obvious. Measured on the doc
  afterwards: it finished on its own at 8:28:45pm, `done`, with a url and no
  error — it had taken **735 seconds**, and the identical text re-sent twelve
  minutes later came back in **75**. So ElevenLabs' own latency swings 10x on
  the same input, nothing was orphaned, and no credits were lost.
  **What she was looking at was a working render with no clock on its spinner**
  — a slow one and a dead one were the same picture — so `spinLabel` in
  `public/voice.html` counts the minutes now ("rendering… 4m", and past five
  "· long ones can run past 10m"), and a failed take carries a **Render again**
  button instead of being a retype of 4,842 characters. The recovery below is
  still right and still worth having; it just answers a case that had not
  happened yet. **A deploy four minutes before a symptom is a coincidence
  until the doc says otherwise — read `doneAt` before believing it.**
  **The audio was never lost — ElevenLabs keeps every generation in its own
  history and hands the mp3 back for FREE**, so the sweep fetches what she
  already paid for rather than charging her twice (the Playground's
  banked-sheet call, same shape). Recovery is tried BEFORE anything is marked
  failed; `POST /api/voicelab/render/:id/recover` is the hand crank (`dry:true`
  is free) and `node scripts/recover-voicelab-render.js` (dry by default) runs
  the same code from a container.
  - **The one thing it can get wrong is picking the WRONG take**, and that
    lives in `voicelab-recover.js` alone — pure, no network. She re-renders the
    same words over and over (six "magic pills" takes in ninety seconds), so
    "the right voice at about the right time" is not specific enough. The
    rules: the **request id** (stamped the moment the response HEADERS arrive,
    i.e. before nearly every kill — the one exact key), else the **exact text +
    voice + window** for TTS, else **voice + window** for a conversion **and
    only when exactly one qualifies** — an STS item carries no words to tell
    two apart, and handing her another take's audio under this take's name is
    worse than leaving the card failed. In every case an item sitting nearer to
    ANOTHER of her renders belongs to that one, so a stuck doc can never steal
    the generation a doc that finished normally already used.
  - Test: `node scripts/test-voicelab-recover.js` (her real killed take, the
    six-identical-takes case, and the two refusals).
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
  **BUT "RENDER IS NOT BLOCKED" WAS WRONG, AND IT TOOK THREE TRIES TO SEE IT
  (2026-08-27).** Two successful downloads on 08-23 were read as the endpoint
  working. Measured properly four days later: Render refused **3 of 4** distinct
  videos, on EVERY player client, twice over — including two of Sophie's own
  grabs. A session container got **2 of 3** the same minute, so it is Render's
  IP reputation, not YouTube in general. What made this survive so long is that
  `dQw4w9WgXcQ` — the probe's hardcoded video — is one of the few Render still
  serves, so **`GET /status?probe=1` went green throughout two days of her
  grabs failing. A green probe says ONE video on ONE client works and nothing
  more; never quote it as the endpoint being healthy.**
  **SO THE CONTAINER IS THE FIRST MOVE AND THIS ROUTE IS NOT (Sophie's call,
  2026-08-27: "use container not render for YouTube downloads").** A chat that
  needs a YouTube file runs yt-dlp in its OWN container — fetch
  `yt-dlp_linux` from the GitHub release, pull the file, POST it to
  `/api/drop/upload-file` or `/api/audio/upload-file`, which are the exact two
  routes this module files through, so the result is indistinguishable from a
  grab. Reach for `POST /grab` only when the container is refused too and it is
  worth one more IP; it fails honestly with `blocked:true` in yt-dlp's own
  words. **And the container is only better odds** — measured from one
  2026-08-27, metadata read on 3 of 4 videos and the bytes came down for 1 of 3.
  Both refused → **the desktop queue is still the real fallback.**
  Cookies (`--cookies`) are the documented remedy and need her logged-in
  browser, i.e. the desktop trip this was built to avoid.
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
  - **AUDIO DEFAULTS TO `none`, AND THAT IS THE POINT (Aug 2026 v2, Sophie:
    "are you meaning to ask a chat about it?").** This first shipped defaulting
    audio into the audio library with a note saying to pass `to:"none"` for
    music — i.e. a flag someone had to remember, which is not a fix. The audio
    library transcribes everything it receives and files it into her voice-memo
    archive: right for an interview, wrong for a song, and the two are NOT
    tellable apart from the metadata (`categories`/`artist`/`track` all come
    back `NA` on the player client yt-dlp uses here, measured 2026-08-24). So
    the default is the mistake that is cheap to undo — `none` keeps the file
    under `ytdl/` and hands back a url — and a chat grabbing an INTERVIEW asks
    for `to:"audio"` deliberately. The other way round, a music grab nobody
    thought about puts lyrics in among the notes she searches, with no undo
    beyond hunting the memo down.
  - **THE BOT-BLOCK IS PER PLAYER CLIENT — not per IP, and not per video
    (measured 2026-08-27, and this REPLACES the "it is just intermittent
    rate-limiting" reading that stood here for three days).** On ONE box within
    a few seconds, asking for the same video: `default`, `android_vr`,
    `android`, `ios_music` and `android_music` all answered, while `tv`,
    `tv_simply`, `web`, `web_safari`, `web_music`, `ios` and `mweb` were every
    one of them refused. The web/tv clients want a JS challenge the box has no
    runtime for; the android family does not ask.
    **This is why a passing probe proved nothing.** Six real grabs of Sophie's
    on 2026-08-25 failed, four of them bot-blocked, while
    `GET /status?probe=1` answered fine throughout — the probe's video happened
    to be one `default` would still serve. A green probe says that ONE video on
    ONE client works, never that the endpoint works.
    So a refusal now walks the CLIENT ladder first and only then waits, and a
    grab records the `client` that answered. Anything that is not a block (a
    dead url, a private video) still fails at once rather than wasting her
    time.
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
  web / old build / new build).
  **THE VOICEOVER AND THE DESCRIPTION ARE BEHIND ONE BUTTON, AND THE LAYOUT
  IS THE WHOLE OF IT (2026-08-26, Sophie: "put the voiceover and story
  description behind one button but think carefully about the layout").** It
  was two buttons over two sheets — a book glyph over her description text
  plus her two recordings as native `<audio controls>`, and a waveform over
  the memos and episodes as rows. Everything in both is the same thing, so it
  is one sheet, **About this story**, behind one button (`#aboutbtn`;
  `#descbtn` and `#audiobtn` are gone). **The glyph is the PLAIN WAVEFORM, and
  it is hers by name** (2026-08-26: "I like the book idea, but can you just put
  it back to the normal wave form?") — it shipped as Lucide `book-audio`, a
  book with a sound wave inside, on the reasoning that the sheet holds her
  words as well as her recordings; she liked the idea and picked the plain wave
  anyway, so that reasoning is history rather than a rule. It is the exact
  glyph `#audiobtn` wore, so the row looks to her as it always did and only the
  sheet behind it changed.
  - **THE ORDER WAS COUNTED, NOT GUESSED.** All 67 stories read live that
    day: **47 carry anything at all, 43 of those have a RECORDING and only
    17 a description** — and a description is a dictated transcript running
    **~2,300 characters at the median and 10,593 at the longest**. So the
    recordings LEAD (that is what a tap is for) and her words sit under them,
    folded to six lines behind the house `.moretxt` opener. Put the words
    first and every recording is several screens down.
  - **ONE ROW DESIGN, so one way to play anything.** Her "As you told it" and
    "Your narration" are `.aurow`s like the memos, on the page's one shared
    `player` — which is also what lets a recording keep playing while she
    reads the beats it became. The same file under both fields still draws
    ONE row ("Your recording"). The attached list takes a **Recordings**
    header only when hers are above it, so a story with no description looks
    exactly as it did before the merge.
  - **THE MERGE OWED HER A SCRUBBER.** Native `<audio controls>` were
    scrubbable; a list of play buttons is not, and the two recordings most
    worth scrubbing were exactly the ones being folded in. So the ROW grew
    one: the playing row's own bottom hairline fills in ink, no extra height,
    and the memos get it having never had one. Only the playing row carries
    it; the touch strip starts where the TEXT does so a pause tap at the play
    button's lower edge can never land on it instead.
  - **THE SHEET'S PILL OWNS THAT CORNER ALL THE WAY DOWN, and this was a
    LIVE BUG the merge exposed rather than caused.** The sheet is its own
    scroller with its own fixed pill, so every row rides through the top-right
    on the way up — measured pre-fix, rows ran to x=371 against a pill
    starting at x=328, and a tap at the right end of the new scrubber reached
    the PILL (`elementFromPoint`, the only honest question — the QUESTIONS
    button's own lesson). `#audios`/`#deschead`/`#descbody` reserve the house
    56px. **Measure that as INK, never as boxes:** padding keeps a box wide
    while its words stop short, so a box rect reports a collision that is not
    there.
  - A row whose length nothing recorded (her description recording and her
    narration are bare urls on the pad doc, with no `seconds`) learns it from
    the file the moment it plays, and `_url` is RESOLVED on the way in —
    `player.src` reads back absolute, so a relative url would compare unequal
    to itself forever and the row would never show its pause glyph.
  - **ONE FILE, ONE ROW — she found this the day it shipped (2026-08-26: "it
    looks like I pressed play on one and the other one also started
    playing").** Nothing played twice: her voiceover or her description
    recording is very often ALSO in the attached list — **11 of her 67
    stories, measured live** — so two rows carried the same url and one
    playback lit both, pause glyph and scrubber on each. The sheet was lying
    about what it was doing. The row that survives keeps the ATTACHED entry's
    title, date and length (how she recognises a memo) and wears her ROLE
    beside them, so joining the two loses neither half; both her fields on one
    file still say "Your recording" once.
  - **IT STOPS WHEN SHE LEAVES (same day: "it keeps playing even if I leave
    the storage room even if I leave the app that's a problem").** The player
    is a detached `new Audio()` that nothing had ever been asked to stop.
    `auStop()` now runs on `visibilitychange`→hidden, `pagehide` and `freeze`
    (the app backgrounding, the screen locking), on stepping up to the shelf,
    and on the shelf handing the app its exit. **Closing the SHEET while she
    is still on the story deliberately does NOT stop it** — that rule predates
    this and she has not asked to change it.
    **THE ONE GAP, named rather than papered over:** switching to another TOOL
    inside the app. RootView keeps the three recent tools alive in a ZStack
    and only toggles opacity, so the web view may never be told it is hidden
    and no page-side event can catch it. The durable fix is Swift calling a
    `window.__forgeHidden()` bridge on that switch — NOT BUILT, and it needs a
    TestFlight build.
  - **A ROW OPENS ITS OWN WORDS (same day: "there should be a button where I
    can read the transcription").** An underlined `read` on the row's second
    line beside the date — the house opener, and it costs the title no width
    where a fourth control in the row would. The words open UNDER the row,
    folded to six lines behind the same `… more` her description uses, so
    there is ONE reading pattern in the sheet and the row she is playing stays
    on screen above them. Where they come from, cheapest first: **her
    narration carries its own text on the pad doc** (12 of the 20 stories with
    a voiceover, 656-15,647 characters) so that row needs no request at all; a
    memo or an interview is fetched once and cached on the row; an **episode
    render has no transcript on file and shows no way in**, the same
    silent-by-design rule the Assets tab's PROMPT button follows. Her
    description recording is skipped too — its words are already on screen as
    *What you said*.
    - **`GET /api/search/transcript/:id` is the route, and it does NOT rebuild
      the text from the index.** The index's chunks are deliberately
      OVERLAPPING windows (`splitChars` / `ndeChunks` — a phrase landing on a
      boundary has to sit whole inside at least one), so joining them repeats
      text. It reads the transcript from where it is stored whole: the memo
      manifest record, or the interview doc's own `transcript`. Free — one
      manifest read or one Firestore doc, no model call. An id it does not
      know answers with an empty string rather than a 404, because the page
      asks about every row it has.
  - Test: `node scripts/test-storyroom-about.js` (62 checks, headless, driving
    real decodable wavs through the real page — the order, the fold measured
    rather than counted in characters, the pill collision as ink, a real
    pointer at four fifths along the scrubber, and the four shapes her real
    stories come in).
  **THE WHOLE TOP IS ONE STICKY BLOCK, AND THE STORY'S NAME HAS ITS OWN LINE
  (2026-08-26, Sophie: "header layout sucks. back button not sticky. title too
  crowded").** Two faults in one row, both only visible as measurements.
  `.titlerow` was the only thing pinned, so the header above it — the row
  carrying the back chevron and the "?" — scrolled away on a long story and
  there was no way back to the shelf without scrolling to the top first. And
  the name shared its line with six 34px buttons: at 390pt the wrap is 312px
  and the buttons take 34x6 + five 10px gaps + the 56px the injected pill's
  corner owns = 310, leaving the name ~2px, which wrapped it one or two
  LETTERS to a line ("Ev / an / — / the / sha / pe" in her screenshot).
  `#topchrome` wraps header + `.titlerow` + the new `.iconrow` and is the
  sticky one; the name is alone on its row, the buttons are alone on theirs at
  8px apart. **The negative margin on `#topchrome` is load-bearing** — it
  cancels the wrap's own `--headtop` padding while the block is in flow, so
  the header row still starts at `var(--headtop)` (every sheet's row is
  levelled against it, and `pagehead.js` measures it), and once pinned that
  same padding is what clears the status bar. Pinned by
  `node scripts/test-storyroom-header.js` — the name's real width and height,
  the six buttons on ONE line clear of the pill's column, and the chevron
  asked with `elementFromPoint` 900px down the story.
  **THE SHELF IS FRAMED TILES, THREE TO A ROW, AND SHE PINS THE ONES SHE IS ON
  (2026-08-24, Sophie).** A tile is the story's picture on a WHITE MAT inside
  the one hairline outline, both corners slightly rounded, the name centred
  under it. The mat is the `.cov`'s own padding, so the art is placed with
  `top/left` **and an explicit `calc(100% - 10px)` size** — an absolutely
  positioned `<img>` with auto width shrinks to its intrinsic size instead of
  stretching between two offsets, which draws a tiny picture in a big white
  box rather than a framed one. **Pinning**: the pushpin on a tile's top-left
  corner (round head, straight spike — never the Maps teardrop; top-LEFT
  because the injected pill owns the top-right; its plate is a rounded square
  at the house 6px, never a circle) writes `pinned` on the pad doc
  via `POST /api/scratchpad/pads/pin`, which like `/pads/category`
  deliberately does NOT bump `updatedAt` — pinning is not an edit to the
  story. Pinned stories lead the shelf and the rest fold behind an underlined
  **see more**; **with nothing pinned in that category the whole shelf shows**,
  because a fold hiding every story is a shelf with nothing on it. The fold is
  per category and per visit. Nothing to do with `/cover`, which pins a
  story's FACE.
  **A WHOLE FOLDER PINS AT ONCE (2026-08-26, Sophie: "make it possible to pin
  multiple stories that are together so I can pin all my Mason stories at
  once").** A folder tile carries the same pushpin, and it sends every story
  in it — `POST /pads/pin {pads:[…], pinned}`, the batch form `/pads/folder`
  and now `/pads/category` also take. So nothing new is stored: the flag is
  still one per story, and the folder's pin is LIT when any story in it is,
  which is the same rule that decides where the folder sits — the light and
  the position can never disagree. (This line used to say a folder carries no
  pushpin because "a pin belongs to a story"; her ask retires that.)
  **THE CARDS BEHIND A FOLDER COUNT ITS STORIES (2026-08-26, Sophie: "make the
  number of things showing behind a story correlate with how many stories
  there are behind that story").** It was always two cards, so a pair and a
  pile drew identically. A pair shows ONE card behind, a trio two, four or
  more three — the cap is the 14px column gap the deepest card (12px) hangs
  into, and past it the count badge is what says how many. They are real
  `.lay` spans now, deepest first in document order, because two
  pseudo-elements cannot be a number.
  **THE PILES ARE Unsorted · Personal · Witch · Lessons · NDE, AND THE DEFAULT
  IS UNSORTED (2026-08-26, Sophie: "I think personal is the default so can you
  just make a different default and just put the ones I mentioned into
  personal").** An untagged story used to file under Personal, which made
  Personal everything nobody had got to — useless as a pile of her own.
  `SHELF_DEFAULT` in `gen-scratchpad.py` is the one place it lives: the filter
  and the opening chip both read it, so moving the default is that line. The
  shelf opens on Unsorted because that is where a story she just made lands.
  **The chip row now ends before the autoscroll pill** — the sheet's pill is
  fixed at x 328-374, y 14-154 and the row sits at y 52-85, so with three chips
  it simply stopped short and with five the last one was UNREACHABLE.
  `fitCatRow()` measures both real boxes and reserves the column; the row
  scrolls, so a chip in that column is one swipe away.
  Test: `node scripts/test-storyroom-shelf.js` (the frame
  MEASURED off the real boxes — a mat drawn with the wrong inset still renders
  a picture in a frame, it just covers the mat — the layer counts, the folder's
  batch pin, and the chip row's right edge against the pill's left).
  Stories carry **listen rows**
  behind ONE waveform button on the title row (Aug 2026): the Episode Editor
  episodes cut from the story, resolved to their newest render live, AND the
  **voice memos it came out of** (`POST /api/scratchpad/audio {pad, src}`,
  `src` = the Search index id). No audio attached → no button.
  **THE FILM BUTTON IS ONE CONTROL WITH TWO STATES, AND THE "?" IS ON THE
  OTHER ROW (2026-08-23, Sophie: "add a cancel button to the play which makes
  the film button in story room" · "also add an info icon that says what all
  the buttons do").** Both asks landed on a title row that was already full —
  six 34px icons on a 390pt phone, the same measurement that put the style
  toggle on its own line — so neither could simply be a seventh button.
  - **While a render is making, the play button IS the cancel** (an ✕; tap
    starts it again after). That also killed a dead control: it used to sit
    disabled at .45 opacity for the whole render, so the one thing on screen
    she might want to tap did nothing. **No arming delay on the swap** — the
    film is free (ffmpeg on our own box), so a stray double-tap costs one tap
    to restart, and a button that ignores her for a second reads as broken.
  - **`POST /api/scratchpad/film/cancel`** flips the job's token
    (`filmJobs` in scratchpad.js) and SIGKILLs the ffmpeg it is inside, so
    the cancel lands in seconds rather than at the end of a ten-minute
    encode. Two rules keep the doc from lying about the render: every
    progress write goes through the job's `beat()`, which no-ops once
    canceled, and the job re-stamps `canceled` on its way OUT, after the
    child is dead — that closes the one race left, a heartbeat already in
    flight. **A cancel is never `failed`**, and the doc is stamped even when
    no token exists in this process (a render orphaned by a deploy would
    otherwise sit on 'making' until the 15-minute sweep).
  - **A poll IN FLIGHT when she cancels must be dropped, not landed** —
    the server may not have written `canceled` yet, so its answer still says
    `making`, and landing it repaints the ✕ with no timer left to correct
    it: the render she stopped, stuck on screen forever. `filmGen` on the
    page discards a stale poll whole (it also bumps when she opens another
    story). And `/film*` is matched by PREFIX in `api()`, so canceling does
    not mark the story dirty.
  - **The legend clones the page's own buttons** — `HELP` in
    `gen-scratchpad.py` names each control by SELECTOR and the row copies its
    `innerHTML`, built on the tap. A second hand-drawn set of icons would
    drift the first time one changed and the drift would be invisible.
  - Test: `node scripts/test-storyroom-film-cancel.js` (headless — the glyph
    swap, the cancel POST, the in-flight poll, and the legend's drawings
    compared against the real buttons; verified failing against the pre-fix
    page, where the disabled button could not even be clicked).
  **THE CAPTION IS WORDS WITH A PENCIL BESIDE THEM, AND A PICTURE-LESS BEAT
  IS A DIFFERENT SHAPE (2026-08-24, Sophie: "the caption and the drawing
  thing are editable by default. Can you make it that the caption shows not
  in a edit box but default to just the ... text and then there's an edit
  pencil button next to it" · "if there's no image then make the image box
  smaller / and show the caption and the drawing prompt by default instead of
  just the caption").** Two asks about the same card, and both are about a
  beat she is READING rather than typing into.
  - **The caption's default face is `#captext`, the words in the serif**, with
    a bare pencil (`#capedit`) beside them; the pencil swaps in the same
    `#pnote` textarea as before and takes the focus. **The pencil is a
    TOGGLE and the box never closes on its own blur** — a card that
    reshuffles between her mousedown and her mouseup eats the tap she was
    aiming at the button underneath. Blur still SAVES. `#pnote` keeps the
    caption's value whether it is showing or not, which is why `drawPrompt()`
    and `saveNote()` are untouched.
  - **`#beatcard.noart` is the picture-less state, computed once in
    `openBeat`** (no url and not a clip — a beat mid-draw counts, since the
    blank paper is what is on screen). It shrinks `#popblank` to 132px and
    drops `#artwrap`'s `flex:1`, and it opens the drawing prompt beside the
    caption: the empty tile used to take the whole card, on exactly the beat
    whose WORDS are all there is.
  - **AND THE DRAWING PROMPT IS THE SAME SHAPE SINCE 2026-08-26 (Sophie: "can
    you make the default for the caption in the drawing prompt? that they're
    not in a edit text box and that I press the pencil to edit them").** Her
    2026-08-24 message above named BOTH boxes and only the caption got it, so
    a picture-less beat — which opens with both down — showed one set of words
    beside one "type here". `#promtext` + `#promedit` are `#captext` +
    `#capedit`'s twin, and **the words are painted FROM `#dprompt` on every
    paint**, so the textarea is still the one and only value: `drawPrompt()`,
    `savePrompt()` and the hint line read it and cannot disagree with what she
    is looking at. **Folding the prompt away puts it back to WORDS** —
    reopening on a caret she left there last time is the box-by-default she
    asked to be rid of.
  - **The fold rule is now conditional on that** — opening the prompt folds
    the caption away only when a picture is taking the room. And **the star
    (`#ardraw`) opens the drawing box, never closes it**: it would otherwise
    fold away the box a picture-less beat now opens with; the chevron on
    Drawing prompt is the toggle. **The star is also the ONE way in that skips
    the pencil** (`openDraw(ev, true)`) — "draw it here" is her saying she
    wants to write the prompt, so it opens straight into the box with the
    caret in it, where the label opens to the words.
  - Test: `node scripts/test-scratchpad-popup.js` (the real page, headless —
    the pencil measured beside the words, the empty tile measured against the
    same card holding a picture).
  **AND THE TWO FOLDS ARE HERS — A RE-OPEN OF THE BEAT ALREADY ON SCREEN NEVER
  TOUCHES THEM (2026-08-26, Sophie: "the caption keeps reopening after I close
  it on a beat in story room").** `openBeat` set both folds to their ARRIVAL
  defaults — caption open, prompt open only on a picture-less beat — on EVERY
  call, guarded only by `typing`, i.e. only while a box actually held her
  caret. So closing the caption and then doing anything that re-opens the same
  beat sprang it straight back open. Four call sites do that, and **the first
  takes no tap of hers at all**: the gen poll landing a finished draw
  (`startGenPoll` → `openBeat`), Draw itself, picking a past picture out of the
  lightbox, and a chunk link/unlink. The guard is `same` now — the defaults
  belong to ARRIVING at a beat, not to every repaint of the one she is standing
  on. Two things not to undo: the PROMPT fold carries over with the caption (one
  rule for both, or a chat has to remember which of two identical-looking folds
  is hers), and `promEditing` is reset beside `capEditing` on any non-typing
  re-open, which also closes a latent bug where an open prompt BOX carried from
  the last beat onto a fresh picture-less one. Test:
  `node scripts/test-storyroom-caption-fold.js` (the real page headless, driving
  the REAL poll — verified failing 3 pre-fix).
  **THE DRAW ROW: THE STAR, AND QUALITY OPENS ON LOW (2026-08-26, Sophie:
  "can you make the draw button the stars logo we use for generate and can you
  change the default to low instead of medium and can you make the three-way
  toggle for the quality instead of the drop-down").** Three asks about one
  row, all house rules this page had not caught up with.
  - **`#dgo` is the hand-fitted star**, the ONE generate glyph — the same
    `ICON_STAR` `#ardraw` already wore, so the two are compared as markup in
    the test rather than by a path copied into it. A 34px filled ink square at
    the house 6px, the Playground's own Generate box; the word "Draw" is gone.
  - **`#dq` and `#bq` are `.tri` from `/tritoggle.css`** — the shared shell,
    never a fourth hand-copy of the geometry — paper with an ink line and a
    dark knob (the Playground's family, so the toggle sits with `#dchar`'s
    outlined box), 78/26, which lands at 34px tall: exactly `#dchar`'s height.
    `/tritoggle.js` is the aim rule, with the page carrying the old cycle as a
    one-line floor for a stale cache and nothing more.
  - **LOW is where the card's draw opens now** (it was medium — 3x the price
    of a picture she is usually only checking the words against). `#bq` was
    already low. `QUALS`/`qVal`/`qSet`/`wireQ` in the generator are the one
    table and the one reader; a fourth quality is an entry in that list.
  - **THE PAGE HAS ONE FLOOR, NOT ONE PER TOGGLE.** The style switch landed
    on the shell the same day (another chat, `#styletog`) carrying its own
    inline `window.triNext ? … : cycle`; both read the page's single declared
    `triNext` now, so a page can never grow two versions of the fallback and
    have them drift.
  - Test: the draw-row section of `node scripts/test-scratchpad-popup.js`,
    which taps a POSITION on the track (a click on the element's centre is
    where a cycle and an aim agree, so it can never see the bug).
  **AND EITHER BOX OPENS BIGGER, AS AN OPTION (2026-08-26, Sophie: "make it
  possible to open the caption and the drawing prompt in bigger boxes so I can
  edit them but don't make that the default").** A 26px rounded square inside
  each box's bottom-right corner toggles the SAME textarea open and shut —
  the Playground's `#bigprompt` answer lifted in SHAPE, not copied, so there is
  never a second field to sync. **AND IT FITS THE WORDS since 2026-08-27**
  (`min-height:24vh` / `max-height:46vh` as the floor and the cap, `fitBig`
  measuring the content into the height between them, on the tap and on every
  keystroke) — the rule and its two traps are written out once under *THE
  PROMPT BOX HAS A BIGGER-BOX TOGGLE* in the Playground section. Four things
  not to undo: the textarea reserves
  that corner with `padding-bottom` (or her last line is typed under the
  button); `resetBig()` puts both back small on every card open, because *not
  the default* means not sticky either; expanding calls `scrollIntoView` since
  `#cardin` is a scroller and a box that just grew past its bottom is one she
  has to go and find; and **`#pnotewrap` / `#dpromptwrap` carry the `hidden`
  flag now, not the textareas** — since both boxes read as words behind a
  pencil, the button belongs to the EDIT box and must vanish with it rather
  than sit under words she is only reading. `BIGBOX` in
  `gen-scratchpad.py` is ONE glyph pair and one wiring loop over both, so they
  cannot drift. Pinned by the same test — the default size, the button asked
  with `elementFromPoint`, the padding against the button's real height, the
  grown height, how much of the big box is in view after the tap, and the
  reset on reopen.
  **Full details: `docs/modules/story.md`.**
- **Scratch Pad / Story Room** (`scratchpad.js`, `/api/scratchpad`, page built by
  `scripts/gen-scratchpad.py`) — thinking with pictures. Hearted Playground images
  are its inbox (read live — nothing is copied).
  **ADD TO SHOEBOX (2026-08-28, Sophie: "add to shoebox button option in
  share in story room" → "this is too complicated" → the settled one-button
  version).** A share icon (the iOS square-and-arrow-up) in the beat popup's
  art row files the picture she is looking at as a MEMORY in her Memory
  Library — membry `users/{uid}/memories`, the collection the Shoebox at
  incaseofamnesia.com/shoebox is a polaroid view over — with the beat's words
  as the title and the picture as `illustration.url`. It lands in the Shoebox
  LIBRARY as a developed polaroid; pinning it to a board stays hers, in the
  shoebox. `POST /api/scratchpad/shoebox {id, style}` — the /cover shape, so
  the picture comes off the side she is LOOKING at. Four things not to undo:
  a NEW memory is stamped `createdAt` (the library's one query ORDERS BY IT —
  a doc without it is silently omitted, the Firestore orderBy trap) and a
  re-add keeps the original; the memory id is content-addressed off the
  picture (`sb-<sha1>`), so a second tap updates one memory rather than
  making a twin; her uid is DISCOVERED (rank `collectionGroup('memories')`
  parents by count — the find-gallery-uid technique; `SHOEBOX_UID` env
  overrides, a tie REFUSES rather than guessing whose library it is) and is
  never committed; and the tap does not stale the film — nothing on the pad
  changes. server.js hands the membry Firestore in (`scratchpadMod.init`,
  the dreamapp pattern); without `STORY_FIREBASE_SERVICE_ACCOUNT` the route
  refuses honestly. Test: `node scripts/test-storyroom-shoebox.js`.
  **THE ADD SHEET'S PICTURES ARE SEARCHABLE (2026-08-28, Sophie: "add search
  in story room - pictures").** A box over the grid on the PICTURES tab,
  the house grammar and both live-box helpers from `/feedkit.js` — linked,
  never copied. Four things not to undo: it filters **CLIENT-SIDE**, because
  `/inbox` sends the whole inbox in one read and there is no page behind the
  page (the CLIPS tab next door asks the server for the opposite reason — its
  shelf is a library this page never loads whole); it searches the words that
  MADE a picture (prompt, style, model, engine, quality, and an upload's own
  name) and **never the url**, whose Storage filename is a random id that
  would light tiles for no reason she can see; the box is drawn from the
  **UNFILTERED** inbox, so a query matching nothing cannot take the box off
  the screen mid-search; and it is **not drawn at all** when nothing in the
  inbox carries a word — a story's own gathered art can arrive with no
  prompts, and a box that could never match anything is a dead control.
  Test: `node scripts/test-storyroom-picture-search.js` (the real page
  headless; verified failing pre-fix).
  **A picture can be taken OUT of that inbox — the ✕ on its tile (2026-08-26,
  her ask) — and it HIDES rather than deletes**, because a Playground heart
  and a Dump upload belong to other places and only the story's own gathered
  art is local: the removal is a url on the STORY's `inboxHidden`,
  `POST /inbox/hide {url, hide?}` is also the undo, and the picture is
  untouched wherever it really lives. Beats sit four to a row,
  incomplete rows centered; tapping one opens a cream CARD popup with the art at
  thumbnail size, five colour chips, and a text box. Her OWN recording always
  wins over TTS, and **every take is kept**. Chunks link contiguous beats into one
  tile. **A beat can also be a FILM CLIP** (Aug 2026): the add sheet's
  second hairline tab is the Chunking clip library, read-only — a clip is
  referenced not copied, tiles as its POSTER with a film mark (never a
  `<video>` on the pad), draws nothing, and in the film passes through whole
  with its own sound and its own length. The film stitches every beat with art, each held for its own audio's
  length — per-unit audio is PCM, never aac, or the voice walks out from under the
  pictures.
  **A PAST PICTURE CAN BE PICKED BACK, AND THE DECISION HAPPENS BIG (Aug 2026,
  Sophie: "make the past picture thumbnails so that I can actually pick
  one").** The stacked-squares row held every generation a beat had ever had
  and tapping one only opened it big — there was no way to put it back, so a
  re-roll she liked less was final. It still opens big; the big view carries
  **Use this one**, and never for the picture that already is the beat's art
  (a thumb is 44px — she picks by looking, so the button lives where she is
  looking). It is the inbox's own `POST /image`, so a pick and a fresh
  placement are the same write.
  **`pad-art.js` owns the row's bookkeeping — the ONE copy, read by `/image`
  AND by a finished draw**, its own dependency-free file so the rules have a
  test that needs no `node_modules`. Two of them: the picture LEAVING is kept
  (nothing here deletes a picture — that row is what she picks from), and the
  picture ARRIVING comes **OUT** of the history, because a url sitting in both
  places draws TWICE in the row, once ringed as current and once as older —
  the bug a naive pick ships. Provenance follows the picture: a version banked
  from here carries the `src` that made it, so picking it back restores its
  own prompt, and where nothing is known the src is DROPPED rather than left
  behind (the previous picture's run is a lie about what drew this one).
  **AND ONE CAN BE CULLED — the ✕ on each thumbnail (2026-08-28, Sophie: "how
  to cull beat pictures").** "Nothing here deletes a picture" is right for a
  SWAP and had no answer for *this one was never mine*: a picture that landed
  on the wrong beat — the whole of #1889's five strays on one caption — sat in
  that row forever, and the only exits were the trash button (which takes the
  beat, words and all) or drawing over it, which only makes the row longer.
  `forgetArt` in `pad-art.js` beside `swapArt`, so the two ways the row changes
  cannot disagree; `POST /api/scratchpad/image/forget {id, url, style}`.
  - **NOTHING IS DESTROYED.** The picture stays in Storage and in My
    Creations, and what the beat had is banked in `pad.trash` exactly as a
    removed side is. The cull only forgets that this BEAT had it.
  - **CULLING THE CURRENT ART PROMOTES THE NEWEST PICTURE IN THE ROW**, with
    its own `src` — that is what a cull means when you are looking at the
    thing you are culling. An empty row leaves the side with no art, which is
    a normal state (most beats have none) and **never `off`**, which would
    take the beat off that side altogether.
  - **THE ROW OPENS AT ONE PICTURE NOW, not at two.** It used to appear only
    once a draw had replaced something, which was right while it was somewhere
    to LOOK; it is the only place a picture comes off a beat now, so a beat
    left holding one wrong picture has to be reachable.
  - **The ✕ is a SIBLING of the thumbnail, never nested** (a button inside a
    button is invalid and the tap would open the picture), and the row stays
    OPEN after a cull — she is culling several, and a fold that shut under her
    would cost a tap per picture.
  - A **clip** is refused: nothing in that row is a film, and clearing a clip
    slot through here would leave `kind`/`poster`/`seconds` behind. Removing a
    clip is the beat's own delete.
  Tests: `node scripts/test-pad-art.js` (pure) and `node
  scripts/test-scratchpad-pick-version.js` (the real page headless, its stub
  `/image` running the real `pad-art.js`).
  **WHAT THE COLOURS MEAN, AND THE ONE PLACE THAT SAYS SO (2026-08-26,
  Sophie: "can you find where I said with the colors mean in story room and
  then label them in the drop-down").** Her own words, dictated into the memo
  that designed this pad ("Story Room Concept Development", recorded
  2026-08-03): **mustard = examples, green = explanations, blue = the main
  idea, pink = a bridge**; gray she never named, so its chip reads *No
  frame*. They sit on the chips in the colour DROP-DOWN and nowhere else —
  the pad, the beat frames and the popup's picture still say nothing, which
  is the 2026-08-04 rule she gave when a build labelled the cards ("that
  exactly the wrong philosophy… indicators that skip the left brain
  labeling"). Choosing is not reading: the meaning of mustard is the one
  thing that can be forgotten. Pinned verbatim, both halves, by
  `node scripts/test-scratchpad-popup.js`.
  **THE PLAYGROUND BUTTON IS A ROUND TRIP NOW (2026-08-26, Sophie: "if I go
  to the playground from the story room by clicking the playground button, it
  should copy the drawing prompt into the playground text box and if I click
  back to scratch pad button, it should take me exactly back to the beat where
  I was and whatever I just made, there should also be for that beat").** It
  used to be `location.href='/playground?from=scratchpad'` and nothing else —
  she retyped the prompt, landed back on the shelf, and the picture she had
  just made was hers to find and place by hand.
  - **OUT:** `?pad=&beat=&padstyle=&prompt=`, where the prompt is
    `drawPrompt()` — EXACTLY what the star would have sent from that beat (her
    own prompt when the box has one, else the caption as it reads right now),
    so two ways to the same picture cannot disagree about the words.
    `padstyle` is which SIDE of the beat it lands on, the one the story is
    showing. **And `t`, the beat's own words**, so the banner can NAME the
    beat — see below.
  - **THE AIM HAS TO BE PUT DOWN, AND UNTIL 2026-08-28 IT COULD NOT BE
    (Sophie, looking at a caped stranger on a rooftop over a caption reading
    "Folkism,": "this picture doesn't belong here").** `padBack` was set from
    the query and then held for the life of the page, with nothing anywhere to
    end it — and **the app keeps a tool's web view alive for the whole app
    process**, so the Playground stayed pointed at that one beat until a
    force-quit. Measured on her pad that hour: **five runs in six minutes —
    a creepy-guy panels cut, an earthquake news shot at two qualities, her mom
    tearing up at commercials — every one of them landing on "Folkism,"**,
    each pushing the last into that beat's past-pictures row. The banner had
    always disclosed it ("every picture you make here lands on it"), which is
    the half that was right; a state you can read and cannot leave is still a
    trap. Three things end it now, and the third is why the other two are not
    enough alone:
    - **Stop**, inline on the banner (the house underlined opener's paint, no
      box) — her own gesture, named on screen.
    - **Tapping the way back**, because going back to the room is being done
      here, and it is the ONLY one of the three that reaches a kept-alive page
      she returns to later.
    - **The query is SPENT on arrival** (`replaceState`), so a reload can
      never silently re-aim — including the page's OWN self-heal, which
      `location.reload()`s on a new build and would otherwise re-arm an aim
      she had stopped. **Deferred one tick**, because two blocks further down
      the script read `location.search` (the ported prompt this very link
      carries, and `?res=`) and wiping it out from under them drops her words.
    - **The banner NAMES the beat** ("Drawing for "Folkism," …"). "A beat in
      the Story Room" is true of any of them, and the whole failure is a
      picture landing on a beat she was not thinking about. An older room page
      sends no `t` and the line stays generic.
    - **Multi-run is still the design and was not touched** — re-rolling for
      one beat is the feature ("whatever I just made, there should also be for
      that beat"); what was missing was the end of it.
  - **THE PICTURE IS LANDED BY THE SERVER, NEVER BY THE PAGE** (`padTargetOf`
    / `landOnBeat` in server.js, stored on the run doc as `padTarget`). A
    medium picture takes 30-90s, so a page that placed it on the way out would
    lose everything she tapped back before it finished — the house rule that
    anything slow is a background job whose result is persisted. It works for
    the LoRA runs too.
  - **OLDEST FIRST, so the newest is the beat's art and the rest are its past
    pictures** — the row is what she picks from, and `swapArt` keeps whatever
    was there before them in it as well. Nothing is deleted, so every landing
    is two taps from undone.
  - **ONE WRITE: `placeOnBeat` in scratchpad.js**, exported and shared with
    `POST /image` — her inbox pick, her picking an older version back, and a
    Playground landing must bookkeep that row identically.
  - **A PLACEMENT NAMING NO SIDE IS DERIVED FROM THE PICTURE'S OWN RUN RECORD
    (2026-08-26, Sophie: "the dance one went into the watercolor one, but it
    should be dreamy … it could look at the metadata or the prompt").** The
    page always sends the side she is showing, so a style-less `/add` or
    `/image` is a CHAT seeding art — it used to default silently to
    watercolor, which mislaid three stories' dreamy art. `sideFromEvidence`
    reads the run doc the `src` names (or finds it by url) and `padSideOf` in
    `pad-side.js` claims a side only when the run's `style`/`gptStyle` IS one
    — evidence, never a guess; it may also flip the toggle, but only onto a
    story whose showing side holds no art at all. A CHAT placing art should
    still pass `style` when it knows it. Mislaid art moves with
    `scripts/reside-pad-art.js` (dry by default). Full rules:
    `docs/modules/story.md`; test `node scripts/test-pad-side.js`.
  - **The landing is DISCLOSED on screen** (`#beattag`, the reftag's box): a
    side effect she cannot see is a trap. And it is the QUERY STRING only —
    nothing is persisted, so opening the Playground any other way is
    byte-for-byte the page it always was, and an ordinary run sends no
    `padTarget` at all.
  - **BACK:** `/scratchpad?pad=&beat=` opens that story and pops that beat,
    then SPENDS the link (`history.replaceState`) so a refresh after she has
    walked off to another story does not yank her back. A plain open still
    opens on the shelf.
  - Test: `node scripts/test-storyroom-playground-trip.js` (the server
    contract and the placement order pure over the real `pad-art.js`, then both
    real pages headless — verified failing 20 pre-fix).
  **AND THE OTHER DIRECTION IS A WALK TOO — the Playground's send button
  TAKES HER HERE (2026-08-26, Sophie: "rather than this weird pop-up, it
  should take me to the story room so I can pick myself").** It shipped as a
  sheet over the Playground's own lightbox — the shelf as a list of small
  rows, then that story's doors (inbox · a new beat at the end · one of its
  beats) — i.e. a second, worse copy of the shelf and of the placing step,
  built out of 42px rows. The button is a NAVIGATION now
  (`/storyroom?send=<run>&i=<n>`) and decides nothing about a story.
  - **The RUN rides the link, never the url.** One id re-reads the whole
    provenance in the room (prompt · model · quality), which is what a beat's
    past-pictures row and a picked-back version are restored from — the same
    `src` the pad's own inbox pick sends. It is spent with `replaceState`
    before anything opens, so a refresh cannot hand her back a picture she
    has already put down.
  - **`#sendband` is the picture in her hand** — a fixed band over the SHELF
    while she picks a story and over the canvas while she picks the spot, so
    one thing on screen says what is being placed. It outlives `pending` on
    purpose: the document-level tap cancels placing, and without the band
    there would be no way back to the picture but the Playground.
  - **THE MATCH CARD RIDES ABOVE THE BAND (2026-08-26, Sophie: "it does some
    sort of a check to match it to the right beat and then asks me to confirm
    or choose a different one").** The moment she arrives holding a picture,
    the room asks `GET /api/scratchpad/send-match?q=<the run's typed prompt>`
    — FREE, one collection read, no model call — which ranks every beat on
    the shelf against the prompt's words (`send-match.js`, the one tested
    matcher: ≥3 shared stemmed roots or a wholly-contained tiny caption;
    lands/landing/landed fold to one root; an exact copy of a beat's own
    drawing prompt wins outright; capped at 4, recency breaks ties). The card
    proposes them best first — story name, the beat's words, its face —
    and **nothing places without her tap**: a row is the confirm (the same
    `POST /image` every placement takes, aimed cross-pad by naming the pad,
    with NO style so the side comes from the run's own record), the other
    rows are "a different one", and *Pick by hand* (or ending the trip) is
    the ordinary flow untouched. A confirmed match opens that story ON that
    beat's popup — confirmation by sight — with the way-back band intact.
    No match means no card, silently. Test:
    `node scripts/test-send-match.js`.
  - **AND THE ENDED BAND IS THE WAY BACK (2026-08-26, Sophie: "when I go to
    put a picture into the story room there's no way to get back to the
    playground" — she was right, and the cause is that the walk is a
    `location.href` inside the Playground's own web view, so this page ATE
    her Playground screen; the shelf's chevron leaves the whole tool in the
    app, and there was nothing else).** Placing the picture, or putting it
    down with the ✕, turns the band into "Placed · back to the Playground" /
    "Back to the Playground" — tapping it walks
    back, the ✕ then dismisses it for someone staying in the room. A run
    that cannot be read (a pruned run, a deploy mid-fetch) opens the band
    straight in that state instead of stranding her holding nothing. The
    mirror of the Playground's own "‹ Scratch Pad" chip on the reverse trip.
    **AND AN APP EXIT UN-EATS THE SENDER'S WEB VIEW (2026-08-26, her second
    report the same day: "I still can't get out of the story room and back
    into the playground").** The band alone was not enough: the app keeps a
    tool's page alive for the whole app process, so leaving a send-trip page
    through the shelf's chevron parked the PLAYGROUND tool's web view on the
    story room — every later tap on the Playground tile opened the room
    again, band or no band, until a force-quit. On a document that arrived
    with `?send=`, `armTripRestore` wraps `window.__forgeLeave`: the native
    exit still fires first (the tool hides as before), then the web view
    puts itself back on `/playground` with `location.replace`
    behind it. Wrapping the bridge is what catches BOTH exits — the shelf
    chevron's own handler and pagehead's chevron chain — with one hook; a
    plain browser has no `__forgeLeave` and keeps its history fallback
    untouched. **A page loaded BEFORE this shipped is still parked** — the
    one cure for an already-stuck web view is force-quitting the app; the
    fix only keeps it from happening again.
  - **The placement is the room's own** — `pick()`/`place()`, the inbox's
    machinery, so she gets a gap in the ORDER rather than "at the end", and
    an empty story places straight away because it has no gap to tap.
  - **"Into the inbox" is not rebuilt and does not need to be**: the pad's
    inbox already reads her hearted Playground pictures live, so ♥ is that
    door.
  - Test: `node scripts/test-playground-story-share.js` (the trip driven as
    ONE walk — the Playground's real tap lands on the real room).
  **A PICTURE LANDS ON A MOMENT SHE TAPS, NOT ONLY IN A GAP (2026-08-28,
  Sophie: "i can only add between · I can't add to an existing moment by
  clicking that moment").** While she is holding a picture — from the inbox,
  from the + , or walked in from the Playground — a tap on a BEAT now puts the
  picture on that beat, where it used to be a **deliberate no-op** and the gaps
  between beats were the only targets. That reasoning is history: on a pad of
  empty beats waiting for art (her Science story is 20 of them) tapping the
  beat is the first thing anyone tries, and it did nothing at all, with nothing
  on screen saying why.
  - **TWO DOORS, ONE WRITE — `landOn(target, it)`.** The beat popup's own
    "fill it in" (`fillBeat`) and this tap are the same call, so a picture
    landed either way carries the same style side and the same provenance
    `src`, and the beat opens after it — confirmation by sight.
  - **NOTHING IS DESTROYED.** The server banks the picture that side already
    had in the beat's own past-pictures row (`/image` → `placeOnBeat` →
    `pad-art.js`), so a wrong landing is one tap from undone — which is what
    makes this the cheap direction rather than a dangerous one.
  - **AN EMPTY PENDING (the +) LANDS NOWHERE.** There is no picture in it, and
    "add a blank beat onto this beat" means nothing; the gaps stay armed.
  - **The gaps are untouched** — a tap between two beats still adds a new beat
    there, and the band names both ways in ("Tap a moment, or a gap").
  - Test: `node scripts/test-storyroom-land-on-beat.js` (the real page
    headless, asking what the tap actually POSTs — a source assertion cannot
    tell a no-op from a landing; verified failing pre-fix, where the gaps never
    even come down).
  **A STORY IS PORTRAIT OR SQUARE, AND IT IS ONE SHAPE ALL THE WAY DOWN
  (2026-08-28, Sophie: "add a new square story type in story room").** `SHAPES`
  in `scratchpad.js` and its twin in `gen-scratchpad.py` are the whole list —
  portrait 1024x1536 / a 1000x1500 film, square 1024x1024 / 1080x1080 — and
  nothing counts them, so landscape would be a row in each. The shape decides
  the canvas a beat is DRAWN on, every tile on the pad, the popup's blank
  paper and the film's frame; it lives on the PAD, not on a beat, because half
  a story square is a film that letterboxes every other shot (the call
  `movie.aspect` already makes). Six things not to undo:
  - **PORTRAIT IS FIRST AND IS THE FALLBACK.** A pad carrying no `shape` at
    all is portrait, so every story already on the shelf is byte-for-byte what
    it was with nothing to migrate — and `/pads` writes no field unless a
    shape is asked for.
  - **ONE CSS VARIABLE — `--ar` on the root**, set by `renderShape()` when a
    story loads, read by `.beat`, `.chunk`, `#verrow button` and `#popblank`
    with a `2/3` fallback. **NOT the inbox**: those are Playground pictures of
    every shape, not this story's, and cropping them to it would be a lie
    about what she hearted.
  - **THE ROUTE IS `POST /shape`, TOP LEVEL, NEVER `/pads/shape`.** The page
    marks the film stale for any POST outside its own allowlist, and `/pads*`
    is on it (that is the shelf-TIDYING family, which must not stale a
    render). A shape change moves the film's frame, so it has to fall
    outside. Like `/style` it does NOT bump `updatedAt` — the shelf's
    newest-first order is about her words and pictures, not the canvas.
  - **NOTHING ALREADY DRAWN IS TOUCHED.** A portrait picture in a story
    flipped square is kept and letterboxed on white by the film's own
    scale+pad chain — the pad has never destroyed a picture. The frame is IN
    the segment cache key, so a flip re-encodes and a flip back finds the old
    shots still banked.
  - **THE SHELF KEEPS ONE TILE FOOTPRINT** — that is what holds the names
    level across a row — so a square story's cover is sat WHOLE on the white
    mat (`object-fit:contain`) rather than cropped to a portrait tile.
  - **The square film frame is 1.17MP against portrait's 1.5** — UNDER the
    budget the OOM note beside `FILM` proves this 512MB box survives. That
    number, not the width, is what a third shape has to stay inside.
  **THE SHAPE FOLLOWS THE STORY'S FIRST PICTURE, AND THERE IS NO CONTROL FOR
  IT (2026-08-28, "automatic by first picture" then "get rid of button").** The
  first picture PLACED on a story decides — her pick out of the inbox, a
  Playground send, a photo off her phone, a chat seeding art — and that is the
  whole of it. **The toggle shipped for one afternoon and she retired it**: a
  control beside an answer the story already has is a second way to say one
  thing, sitting on the row she reads for the STYLE. `POST /shape` is still
  there for a chat to correct one on her ask; nothing on the page calls it.
  Four things:
  - **"Nobody has decided" is one field: a pad with no `shape` at all**, so
    the rule fires once and the picture that fired it is the one that decided
    — the `catBy` rule, spelled with the value's own presence instead of a
    second field to keep in step. `autoShapePatch` in `scratchpad.js`.
  - **A picture the pad DREW can never decide it** — it was drawn AT the
    story's shape, so reading it back would only confirm the default. A test
    fails if the rule is ever wired into the draw.
  - **A picture that is NEITHER shape decides nothing** (`SHAPE_AUTO_TOL`,
    ±22% in log space): a landscape phone photo or a clip's 16:9 poster leaves
    the story portrait and open for the next one. Portrait is the fallback she
    can see and change; a story silently turned square by a picture that is
    neither is the failure worth avoiding.
  - **The size is read from the picture's HEADER — a ranged request for the
    first 4KB, never a whole 1-3MB original** — by `image-size.js`. That file
    exists for a MEASURED reason: **sharp reads a truncated PNG and JPEG
    header and REFUSES a truncated webp** ("unable to parse image"), and webp
    is what this app stores nearly everything in, so a sharp-only ranged read
    would have failed on exactly the common case. sharp stays the fallback for
    a format `image-size.js` does not know. Best-effort throughout — nothing
    it does may fail a placement.
  The placing routes answer with the `shape` when one was decided, and the
  page applies it without posting it back: her first picture landing is the
  one moment she is actually looking at the tiles.
  Tests: `node scripts/test-storyroom-shape.js` (the two lists pinned equal,
  the copy-paste guards and the automatic rule's decision table pure, then the
  real page headless — every ratio MEASURED off a real box, because the whole
  thing rides one CSS variable and a broken wire renders as a page that looks
  fine and never changes shape) and `node scripts/test-image-size.js` (every
  format driven from REAL encoded files, including the sharp-refuses-webp
  measurement, so the note above cannot go stale unnoticed).
  **PHILOSOPHY — do not "improve" this: the pad is minimal, the frame
  colours are UNLABELLED everywhere but that drop-down, and no machinery
  lives on the canvas.**
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
  - **THE MIGRATION TO THE PADS LEFT THINGS BEHIND, AND FIXING IT IS SOPHIE'S
    CALL — `docs/story-room-unported.md` (2026-08-24, her ask: "document this
    as something to possibly fix but that no chat should fix it without me
    saying so").** Whatever moved `forge-story` onto the story pads followed
    ONE field, `voiceover.url`, and dropped the art into each pad's INBOX. So
    five stories (Jonas, Moon Milk, The Meteorite, Charlie, My Own Destiny)
    have an empty canvas with their pictures waiting unplaced and **the
    narration line that went under each picture carried nowhere**; nine pinned
    covers were lost, so the shelf derives a different face; Charlie's and
    Evan's chapter headings have no field to live in; and Wormsicles, which had
    no voiceover to follow, had no pad at all until one was made. **The audio
    half IS fixed** — every pad carries its `description`/`descriptionAudio`/
    `voiceover` now, which is what finally lights the *About this story* button
    (it had never appeared on any story). **The COVERS and CHARLIE are also
    done, on her word the same day** — her pinned shelf face is back on Moon
    Milk, Jonas, My Own Destiny, Soul Leaves the Body and Evan, under her rule
    **"unless I already chose a different one on purpose"** (a pad carrying its
    own `cover` is left alone), and Charlie is now two versions in one bucket:
    `folder:"Charlie"` over *as it is now* and *as it used to be*. **The other
    four stories' beats are documented and deliberately NOT done.** Do not place
    them from that doc: which of a beat's 2-5 candidate pictures wins is the
    story's look, and that is hers. Propose it in a reply and wait for a go.
  - **PORTING WORDS: ONLY WHAT SHE SAYS (2026-08-24, Sophie: "any words that
    aren't part of the narration need to go like the moon milk ones describing
    the action").** A card's `label` describes the picture ("Final shot",
    "upscaled from the mini panel") and is never narration. And some stories'
    `vo` is stage direction rather than narration — Moon Milk's *"She holds the
    bucket up to the smiling moon's tap"* is the named example — so it must not
    land on a canvas as her words. Charlie's lines were read one by one before
    porting. **Picking the picture is not the status field either**: a card
    whose label calls it a storyboard panel sorts LAST before status is read,
    because the corrected upscale is often only a `cand` while the rough panel
    it replaced is a `draft`.
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
  from inside the open editor: divide at the cursor, delete), and a unit of 3+
  FOLDING to its first and last with one line each in between.
  **THE FOLD THRESHOLD IS `LONG` IN `public/timeline.html`, AND IT IS THREE
  (2026-08-25, Sophie: "I thought that things are supposed to collapse into
  just the first line when they're chained together is there a button I should
  be pushing" — there is no button; it was 5, so her three- and four-card
  chains sat fully open and read as broken).** The fold is automatic and there
  is deliberately nothing to press. At three the fold is first + last with ONE
  trimmed middle; a PAIR has no middle and so never folds, whatever the number
  says. Both ends of that are pinned by `node scripts/test-timeline.js`.
  **The editor is behind a pencil and never a tap on the words** — tap-to-edit
  means every stray thumb on the way down the page opens an editor.
  Two bugs worth not repeating, both pinned by the test: a folded middle sets
  `white-space:nowrap`, so its grid track needs `minmax(0,1fr)` or the whole
  unit shoots off the right of the screen; and an editor that holds itself open
  for ANY focus inside its card loses what she typed when a blur leaves focus
  put. Tests: `node scripts/test-timeline.js` (the parser and the validators
  pure, then the real page driven in headless Chromium).
  **BEATING OUT A VOICEOVER IS A PAID ROUTE HERE SINCE AUG 2026 (Sophie:
  "this needs to be smart… it should go through fable").** `POST
  /api/timeline/beatout { title, text, model? }` hands the transcript to
  Claude — **`claude-fable-5` by default, on purpose; don't downgrade it** —
  which splits it into beats (her words VERBATIM, one line each, ALL-CAPS
  sequence headers, a beat may be several sentences) in the exact dictation
  shape `parseStory` reads, then files the story. A background job (`{job}`
  back at once, `GET /beatout/:job` to poll — jobs are in-memory, so a deploy
  loses the poll, not the story); ~25-40c a run on a ~10-minute transcript.
  Never called by the page — chats only, and never on a page load.
  Firestore `forge-timelines`, one doc per story.
- **Story Link** (`storylink.js` + `storylink-plan.js`, `/api/storylink`, no
  page yet) — **one story, three rooms.** Sophie's ask, 2026-08-26: "a way to
  sync a story in story timeline and story room and probably cutting box"
  (she confirmed **Cutting Blocks** for the third).
  **IT IS WRITING DOWN A WORKFLOW SHE ALREADY HAS, and that is measured, not
  assumed.** Read live the day it was built: **all six of her Story Timeline
  stories already existed as a Story Room pad under the identical title**, two
  of them also as a Cutting Blocks project ("Spellcasting" / "Spellcasting VO",
  "PROOF — reel beats" / "PROOF — reel cut (no Nancy)") — kept in step entirely
  by her naming them the same thing by hand, with **zero cross-linking in any
  of the three modules**. The counts had drifted where the hand-keeping
  slipped: "The house" is 30 moments against 11 beats.
  - **THE SHAPE IS `audioproject.js`'s, DELIBERATELY.** She has already
    decided once (2026-08-19) how a piece of work spans rooms: a small id
    carrying only what should be decided ONCE, with the geometry staying
    room-local. That judgement holds here exactly — a timeline **moment**, a
    pad **beat** and a blocks **line** are three different atoms, and a live
    two-way sync would mean re-ordering the timeline silently rearranges her
    pictures. So a link stores IDENTITY, and the one operation that crosses
    rooms is something **she taps**.
  - **A link is one doc per STORY, not per room** (`forge-story-links`):
    `{ id, title, members:[{room:'timeline'|'pad'|'blocks', doc, title, at}] }`.
    Membership is append-only, deduped by room+doc. **A doc belongs to at most
    ONE link** — linking one that is already in another is REFUSED with the
    other link named, never silently stolen. **A room may appear twice and that
    is not a bug** ("Charlie — as it is now" / "as it used to be" are two pads
    of one story), which is why every write takes an EXPLICIT `to` and nothing
    here ever guesses which pad she meant.
  - **THE PULL ONLY EVER ADDS.** `POST /:id/pull` turns a moment with no beat
    into an EMPTY beat carrying its words (`fromMoment` on the beat is the
    whole join — one additive field, so a pad never pulled into is
    byte-for-byte what it was). A moment that already has a beat is **left
    completely alone**: her caption may have moved on, and the timeline is not
    the authority on what a picture is captioned. A beat matching nothing is
    reported as `extra` and stays exactly where it is — the drift across her
    rooms is usually work, not an error.
  - **THE FIRST PULL READS THE WORDS, or it writes her story in twice
    (2026-08-26, caught by dry-running the real data before ever calling the
    route).** `fromMoment` only exists once a pull has run, so the first pull
    into a pad she has been working in by hand has nothing to join on — and
    against her real "Reflections on Science and Belief" that meant **31
    moments, 27 beats, not one linked, and every one of the 27 already saying
    what a moment says**: a naive pull proposes 31 adds and leaves her with 58
    beats. So `alignByText` walks both lists in step and matches a beat to the
    run of moments whose text it is, then **SEEDS** — stamping `fromMoment` on
    the beats that already are a moment, touching no words, art, colour or
    position. It is greedy and ORDER-PRESERVING rather than a fuzzy
    best-match, because the two lists are the same story in the same order; a
    beat that only half lines up matches **nothing**, which strands no moment
    and adds nothing on its behalf.
  - **A SPLIT BEAT IS THE WHOLE POINT, AND THE NEW BEATS LAND BESIDE IT (her
    ask: "i had separated some beats … and i wanted those to also have more
    beats so i could add the pictures i made").** A beat holding SEVERAL
    moments is one she has since split in the Story Timeline, and its extra
    moments are exactly the beats she wants to put pictures on — so an added
    beat is anchored DIRECTLY AFTER the beat carrying the moment before it
    (`after` on the plan, resolved against the array at write time), never
    appended to the end where she would have to walk it back twenty-five
    places. `applyAdds` splices each anchor's group in one go; inserting one at
    a time reverses them.
  - **A BEAT'S CAPTION IS DERIVED FROM THE MOMENTS IT COVERS — `fromMoments`
    is an ARRAY, and that is the mechanism (2026-08-26, Sophie: "it should not
    be repeated. This calls into question the mechanism by which you have them
    sinking").** The first cut made the join SINGULAR: a beat that is four
    moments joined was stamped with the FIRST of them, the other three became
    new beats, and the parent's caption went on carrying all four sentences —
    so her pad said the same words twice. **Not cosmetic: `ttsFor` speaks
    `beat.text`, so a repeated caption is a repeated line in the film.** She
    was right that the repeat was a symptom rather than the bug. Coverage is
    a PARTITION now — every moment sits under exactly one beat, a duplicate
    claim is dropped — and a caption follows the moments it covers, which is
    the house *nothing stands between the source and the output* rule. Split
    a beat in the timeline and its coverage shrinks, its caption follows, and
    the freed moments become beats of their own.
    - **HER OWN WORDING IS NEVER REWRITTEN**, by the pad's own precedent
      (`drawablePrompt` / `promptFor`: a beat's prompt is stored as NOTHING
      while it still matches its words). `staleRun` asks whether the caption
      is exactly a contiguous run of the timeline's moments starting at the
      one this beat still covers; if it is, it is stale from a split and is
      re-derived, and if it is not, it is hers — left alone and reported as
      `heldBack`.
    - **ASKING IT THAT WAY, RATHER THAN "DID I FREE SOMETHING IN THIS PLAN",
      IS WHAT CATCHES A PAD LEFT MID-MIGRATION.** The live pad had two beats
      whose coverage had already been narrowed by the earlier singular pull
      while their captions still said all four sentences; a plan that only
      looked at the current split reported nothing to do.
    - **ONE EDITED LINE MUST NOT DERAIL THE REST OF THE STORY (2026-08-26,
      measured on her Spellcasting pad).** The walk had no lookahead, so a
      moment she had reworded in the timeline stalled it, every beat after it
      was tried against that same moment, and **the last SIX beats lost their
      match and would have been added as duplicates of beats already sitting
      there** — the exact repeat this rewrite exists to end, arriving by a
      different door. `LOOKAHEAD` (8) lets a beat find its moments a little
      further on; bounded, because both lists are the same story in the same
      order and a match found far away is likelier wrong than right.
    - **THE SAME LINE WORDED DIFFERENTLY IN THE TWO ROOMS IS `diverged`, NOT
      AN ADD.** Adding it would put two versions of one line in her pad. Only
      she knows which wording she means, so it is reported and nothing is
      written. **The bar is deliberately high (`DIVERGED` 0.6 word overlap):
      a false `diverged` loses real work — a new moment never added — which is
      worse than a duplicate.** Her real edit measured 0.80; a half-shared
      sentence is a NEW line and is added. Both ends pinned by the test.
    - **A PAD CAN BE PART-JOINED** — a pull that was interrupted, or beats she
      added by hand afterwards — so beats with no coverage are still matched
      by their words, against the moments no joined beat has claimed. An
      all-or-nothing rule there proposed to add every unjoined beat's moment a
      second time.
    - `fromMoment` (singular) is still READ as the legacy shape and is
      re-stamped as an array on the next pull, so two spellings of one fact
      cannot persist.
  - **A MOMENT IN `moments` BUT IN NO UNIT HAS BEEN DELETED** — that is what
    the Story Timeline's delete does (drop the id out of `units`, keep the
    words as the undo). `momentOrder` appended those last as "still hers" for
    one afternoon, which would have resurrected a line she had taken out; her
    Science story carries exactly one ("But here's where things get tricky.").
    **The arrangement is the story; `moments` is the undo buffer behind it.**
  - **THE RE-ORDER ONLY EVER PERMUTES**, and it is a SEPARATE tap
    (`POST /:id/order`): every beat in, every beat out, and the route refuses
    to write if the count ever changed. **A beat she added by hand rides with
    the linked beat above it** — a picture placed between two moments is about
    the moment it follows, so it travels with it instead of being stranded at
    one end.
  - **THE DRY RUN AND THE WRITE CALL THE SAME PLANNER**, so they cannot
    disagree about what is about to happen; `GET /:id/plan?to=` is the read.
    The pull **re-plans inside the transaction** against what the pad holds
    right now, never against the copy read a moment ago — otherwise a beat she
    added in between is duplicated.
  - **ADOPT IS DRY BY DEFAULT** (the `/wrapup/trim` and `asset-cleanup`
    pattern) — `GET /candidates` proposes, `POST /adopt {dry:false}` writes.
    Matching is **token JACCARD over the distinctive words**, never
    intersection/min (sync.js's Etsy lesson, same failure shape here), with
    room words — `vo`, `cut`, `beats`, `precise`, a `v6` tail — dropped so the
    copies find each other while the stories stay apart. Measured against her
    real titles: it pairs Spellcasting across all three rooms and PROOF across
    two, and correctly refuses the false friend ("Discussion on Coincidence and
    **Science**…" vs "Reflections on **Science** and Belief", 0.22).
  - **CUTTING BLOCKS IS MEMBERSHIP ONLY, on purpose.** Its lines are the
    recording's own words with real timings and a split or a meld changes
    them, so its order cannot follow the timeline's and nothing here tries.
    What the link buys there is the name decided once and a jump between rooms.
  - **It costs nothing** — no model call anywhere, a few small Firestore reads
    behind a 30s cache. `GET /for?room=&doc=` is what a room asks on open.
  - Tests: `node scripts/test-storylink.js` (72 checks, pure — the matcher
    against her REAL titles including the pairs that must NOT match, the
    seeding of a hand-worked pad, the split beat's adds landing in place, the
    re-derived caption and the reworded one that is left alone, and the two
    invariants: a pull never drops a beat, an order never changes the count).
- **Character Creator** (`character.js`, `/api/character`, page at `/character`,
  iOS tile "Characters", and a sheet inside Dreams) — the recurring people in
  her dreams and stories: a photo + a name + her aliases ("me"/"Sophie",
  "Daddy"/"Dad") become a diary-comic reference the dream render matches each
  dream's cast against, so a face stays the same picture to picture. Drawing is
  a DETACHED server job — it saves itself even if she closes the sheet mid-draw,
  and `localStorage` picks an in-flight one back up.
  **IT WAS THE PAGE THE PILL/HEADER RULES CAUGHT UP WITH LAST (2026-08-27,
  Sophie: "two pills and there's no way to search. shud follow pill/header hard
  rules").** Three of the four faults were structural rather than cosmetic and
  are worth not re-earning: it had **no `.app-header`**, so `pagehead.js` had
  nothing to sit in and injected a bare strip of its own — under a "‹ Story
  Room" line that put a second thing above the one title; its rows ran **under
  the injected pill's fixed corner**, so "Hide sheet" read "Hide" (reserved by
  `fitPillGap` against the pill's REAL rect now, re-measured by a
  ResizeObserver because the pill is conditional and this page's content
  arrives from a fetch); and its lightbox locked the background but never
  **stopped the autoscroll or restored the scroll position**, so the pill
  walked the page under an open picture. The SEARCH is the house grammar over
  the sheet — name, aliases, tier, model, quality — through `/feedkit.js`
  (`qparse`/`qmatch`/`liveInput`/`enterSubmits`), and **typing opens the sheet**,
  because a box that only works once she has found and tapped "Show sheet" is
  one more thing to remember. The second pill was NATIVE and is fixed in the
  app — see *THERE IS A THIRD PILL* in the design rules. Test:
  `node scripts/test-character-page.js` (the real page headless, the pill
  collision asked with `elementFromPoint`; verified failing 10 pre-fix).
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
  **Scenario art is drawn as 2×2 SHEETS at MEDIUM (Sophie, Aug 2026: "one
  image per quarter so each image will cost a quarter"; quality raised from
  low the same week — "the little ones are coming out too low"; there is no
  2K size, 1024x1536 is gpt-image-2's ceiling)** — one Playground pastel run
  whose prompt describes a 2x2 grid of four separate small illustrations,
  cut into quarters locally, each quarter filed as its own image (~1¢
  apiece). **Scenarios come in PAIRS and PLAY as pairs (Sophie, Aug 2026:
  "just put easy mode and then the hard mode version right after it")** —
  every scenario exists as an easy card AND its hard twin (same choice,
  escalated picture, a more-information line that flips it; `twin` on the
  easy item names its hard card), and the SCENARIOS tab deals them
  interleaved: the easy one, then its hard version immediately after. There
  are no separate easy/hard tabs any more. **The more-information line is a
  CAPTION, never drawn into the picture** (Sophie, Aug 2026) — a hard twin's
  art changes only when the SCENE itself changes (the puppy dangling the
  baby); otherwise the easy picture carries over and the caption does the
  flip. **A hard joke that doesn't work is removed, not forced** — an easy
  card may stand alone (`twin` optional; the cookie and refund twins were
  cut on her word). The gun is a generated silver-revolver image
  (`public/opinions-gun.png`), not a line icon. Candidate batches go on a
  review deck for her ♥ first; a single-option batch she has delegated goes
  straight in.
  **DRAWING AND CUTTING ARE PACED SEPARATELY — TWO NUMBERS, NOT ONE (Sophie,
  2026-08-28: "ok fine back to notches. but separate running sheets and
  cutting").** One ceiling was always wrong here because the two halves of a
  panels run live on different machines, and conflating them is what made
  every version of this note either too slow or too fragile:
  - **DRAWS: fire the WHOLE batch at once, no ceiling.** The draw happens on
    OpenAI's hardware and costs this box nothing. Serializing them is a chat
    spending her minutes for no protection — the mistake she deleted twice
    (2026-08-27, a 12-minute ten-sheet batch; 2026-08-28, "please all at
    once").
  - **CUTS: one at a time, and the SERVER enforces it now** (`gateCut` in
    server.js, 2026-08-28). A cut decodes the sheet to raw — ~33MB for a 4K
    sheet on a 512MB instance — so N sheets finishing together used to stack
    N decodes and kill the instance mid-batch. A cut takes seconds against a
    60-180s draw, so the queue costs a batch almost nothing and makes peak
    memory independent of batch size. **A chat no longer staggers its
    launches**; if you find yourself wanting to, the gate is broken, say so.
  - **The ledger, which is the CUT ceiling and ratchets like she asked:**
    - **Broke it: 16** concurrent outputs + whiten passes (2026-08-19), and
      **10** concurrent 9-panel 4K sheets whose cuts landed together
      (2026-08-28 — seven runs lost, the crash that produced `gateCut`).
    - **Clean: 5** concurrent 9-panel 4K sheets (2026-08-28), and any number
      of draws once `gateCut` is in.
    - **DO NOT RAISE THE GATE — the cap was MEASURED and it is 1 (2026-08-28,
      container, the exact cutSheet recipe on a 4K sheet):** ONE cut peaks
      **+153MB** over baseline and TWO concurrent peak **+241MB** — sharp's
      pipeline holds several dimension-sized buffers at once, so a cut costs
      ~3x the naive 33MB-decode estimate. The 512MB box's headroom fits ONE.
      The gate at 1 is the ceiling, not caution, and the prize for raising it
      is seconds: a cut is ~2s, so even a ten-sheet batch queues ~20s of
      cutting total. (This retires the "raise a notch and write what you
      measured" ratchet that stood here — the measurement is done.)
  - **A run refused with a 502 on the POST was never created and never
    billed** (measured 2026-08-28) — a start failure is free, so retrying a
    start costs nothing. What is genuinely lost is a run whose sheet died
    in flight: billed, no bytes, unrecoverable at any concurrency. A run
    whose sheet was BANKED recovers free (the 2026-08-27 sweep, and
    `POST /api/promptlab/:id/recut`).
  - **Broke it: 8** concurrent 4K panels SHEETS (2026-08-28, ~6:04pm Pacific,
    another chat's shoebox batches — the box restarted with NO deploy in
    flight, so the concurrency alone did it; 5 of the 8 died mid-generation.
    That measurement is what `gateCut` above now removes the cause of.)
  - **THE RECOVERY ONLY COVERS A KILL AFTER THE SHEET IS BANKED — a restart
    DURING GENERATION loses the paid sheet outright (measured 2026-08-28: 15
    failed panels runs that evening, NONE with a banked sheet — ~$1.75 of 4K
    medium sheets gone, billed when requested and never received).** So a
    deploy landing while sheets are in flight is the expensive kill, and
    merges cannot be paused with many chats working. **A chat running MORE
    than the ledger's clean number of sheets should draw them in its OWN
    CONTAINER** (post to OpenAI directly — the `gen-dream-distilled.js`
    pattern; `OPENAI_API_KEY` is in the environment) **and cut them there
    too** (sharp runs anywhere; the cut recipe is `cutSheet` in server.js),
    then file panels via the normal gallery/prompt POSTs. A container is
    immune to deploys, shares nothing with the 512MB box, and parallel
    generation there is limited only by OpenAI's rate limits (measured
    2026-08-20: 5 parallel in 57s). Render's `/api/promptlab` panels stay
    for HER taps and small batches (≤3).
  **THE SCOPE IS THE BOX, NOT THE WORD "PLAYGROUND" (2026-08-20, Sophie
  mid-run: "why are you doing them one at a time?").** Two things this note
  does NOT cover:
  - **A chat drawing in its OWN container** (`gen-dream-distilled.js` and
    friends, posting straight to OpenAI). The Render box is not in the loop
    at all, so there is nothing to pace — measured 2026-08-20, the same
    five images took 4m39s serial and **57s in parallel**.
  - **The PLAYGROUND ITSELF, which has never serialized** — its ladders fire
    `Promise.all` and `runPromptLabGptJob` is fired without `await`, so
    nothing queues server-side either.
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
    its own, because there is one place kept things live. **The count is what
    is still WAITING**: a row she has ticked read (and a thing she has since
    un-kept) is filtered out of it in memory, because `array-contains` plus an
    equality would need a composite index. The count is its own
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
    evicted one of her three bottom-bar slots on every tap. That HALF is
    history since 2026-08-26 (the bar's three are fixed now — see *THE BOTTOM
    BAR'S THREE ARE PERMANENT* below), but the rest of the reasoning stands
    and is banked in `BriefView.swift` in case the page ever wants a native
    screen again.
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
    - **Four verdicts became two, and MAYBE came back as the third
      (2026-08-24, Sophie: "can you add a maybe option in the Tinder checklist
      template?").** Her footer is **✕ · ? · ♥** — the ? centred between the
      two that hug the card's bottom corners — and Maybe is a first-class
      pile now, not a legacy one. `LATER` stays legacy: it is still listed
      when something is actually in it, so an old mark cannot vanish off the
      screen, but nothing can cast one on a stock deck any more.
      - **The ? is DRAWN, like the ✕ and the ♥** — `MOM_MAYBE`, a filled
        ribbon with the nib thin where it enters, heaviest over the shoulder,
        a chisel cap at the tail, and a lopsided dot. Deliberately not
        `I.maybe`, the dashed circle: that is a Lucide-weight LINE icon and
        would be the only geometric mark inside her design.
      - **A maybe stamps NOTHING and CLEARS the asset vote.** The
        good/bad stamp rule already said there is no good and no bad in a
        maybe; the vote mirror follows the same logic — a maybe is not a like,
        so the Assets tab and the card still agree.
      - **THE CENTRE OF A CARD'S BOTTOM WAS NOT FREE, and only a measurement
        found it.** A card's `link` (its way out — "Open the chat ›") is
        centred at the end of the stack, which was safe while the only two
        buttons hugged the corners; the ? landed exactly on that anchor and
        `elementFromPoint` reported `BLOCKED-by-jg-mombtn maybe`. A card
        carrying a link now wears `linkroom` and reserves the buttons' 58px,
        the same band `.long` already reserves. Pinned by
        `node scripts/test-template-link.js`.
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
  update tab … that leads to two tabs — two mockups of instagram"). Her
  accounts drawn as their profile grids, behind hairline tabs: **DREAM**
  (`you...my.dreams`), **WITCH** (`moonsickbaby`), **PWC** (`peoplewatchclub`,
  since 2026-08-24) and **XI** (`incaseofamnesia`, since 2026-08-26). **It
  costs nothing** — no model call, no job; it reads a committed JSON and one
  free API.
  - **A NEW ACCOUNT IS ONE ROW IN `public/instagram-grids.json` — nothing
    counts the tabs, in the page or in the test (2026-08-24, Sophie: "can you
    add another Hairline tab in my Instagram posting button on the update page
    for my People Watching Club").** The page has said that since it shipped
    and People Watching is the first time it was collected: the page, the
    renderer and `grid.js` needed no change at all. The TEST did — it had
    hardcoded "two hairline tabs" and "Dream · Witch", which is exactly the
    edit the claim exists to prevent, so every assertion is derived from the
    data file now and each account is swept generically (its tiles, its
    buttons, its post count, its handle).
  - **A TAB WORD MUST FIT ITS SHARE OF THE ROW, and that is measured.** The row
    divides 390pt minus the pill's reserved 64 between however many accounts
    there are, so each new one makes every tab narrower: at three, "People
    watching" wrapped to two lines, which pushes the WHOLE row from 26px to
    36px and leaves that one label reading over two lines beside its
    neighbours' one. The tab is **PWC**, her own shorthand for it (her deck
    titles say "PWC Instagram", "PWC memes"). Pinned with a Range over each
    label's own text — a width assertion cannot see a wrap.
  - **PWC HOLDS THE EIGHT REELS PLUS THE BINGO CARD (2026-08-26, Sophie: "pwc
    has none of the reels we made … add them in and make them link so they
    sync w the current version").** A full 3x3, newest first: the Training
    Film No. 001 (prefix `pwc-training-film/film-`, chat
    `account-three-ordering-reel` — currently v8), the Hands reel
    (`pwc/hands-reel/`, `middle-one-goes-first` — the go that chat was
    waiting for), ep006 (`pwc-reels/pwc-ep006-`, `people-watching-club-reel`
    — the chat's PIN is what keeps the 61MB `-master` upload, newest by
    timestamp under that prefix, off the tile), ep005 back to ep001
    (`pwc-reels/pwc-ep00N-`, all `stock-footage-backstories`, the
    ep001–ep005 builder), and her hearted bingo card last. Covers are derived
    640px webps at `pwc-reels/covers/` — poster frames pulled ~15% in from
    the reels themselves; the training film's is its own title card, the
    hands reel's its existing poster. **AND NO EMPTY TILE SAYS "NEXT" ANY
    MORE, on any account** (same message: "get rid of 'NEXT' placeholder
    text") — an empty slot is a bare dashed square in both renderers
    (`instagrid.js` and `grid.js`), and the `label` came off the empty rows
    in the JSON.
  - **The handle and bio are a PLACEHOLDER she has not confirmed** — nothing in
    the feed or the repo records the real PWC Instagram handle, so the mockup
    reads `peoplewatchclub` / "like a ghost among the living, silently
    witnessing." Same for XI (`incaseofamnesia`). Swap them the moment she says
    what they are; they are two strings in the JSON.
  - **XI HOLDS THE TWO MEMORY LIBRARY ADS, ONE CUT EACH (2026-08-26, Sophie:
    "fill it with any reels we made for XI I think there's a couple versions of
    some so just pick one version").** Xi / Memory Library / incaseofamnesia.com
    is one app under three names, so its reels are the two the commercial series
    shot for it: **skipsmalltalk** (the infomercial date, 0:31,
    `fictional-pill-commercial`) and **the couple fight** (0:25,
    `commercial-production-series`). The fight exists as TWO takes — a warm cut
    and a spiky cut of the identical ad — and the grid carries the WARM one,
    because that is the cut the chat pinned as its deliverable and `/newest`
    resolves that prefix from the pin. The spiky cut is not lost: it is one row
    away in `manifest-reel-memoryfight-spiky.json`.
  - **THE STREET-INTERVIEW AD WAS NEVER SHOT** — it is greenlit and waiting on
    her pick between two questions (`fictional-pill-commercial`, 2026-08-16). So
    two real tiles is the honest state of the account, not a gap to fill; the
    tile appears the day the film lands, as one row in the JSON.
  - **THE COVERS ARE DERIVED COPIES, never the raw stills** — `GET
    /api/story/thumb?w=640&url=<still>` bakes a webp into `thumbs/` and answers
    a 302 to its permanent public url, which is what the JSON carries (33-41KB,
    against 2.2MB for the PNG behind it). The house webp rule with no new
    tooling: the originals in `commercials/reels/<slug>/stills/` are untouched.
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
    pure, then both real pages headless — every account's grid swept, the tabs'
    measured underline, no tab word wrapping, a tile playing, the still
    fallback, the pill's palette and corner, and the icon asked with
    `elementFromPoint` at its own centre, which is the only honest way to ask
    whether the pill is sitting on it).
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
  **ONE exception she asked for (2026-08-27): a QUICK-QUESTION chat sets its
  own bell ON** ("a 'quick question' chat shud set its own bell as true") —
  she says "quick question mode" or the chat wears the `quick question` label,
  the chat POSTs `{chat, notify:true}` itself, once. A chat never turns a bell
  OFF; that stays hers alone.
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
  **A CHAT BELLS ITSELF WHEN IT IS BLOCKED ON HER (2026-08-28, Sophie: "can u
  make chats bell themselves based on importance").** The bell is a whitelist
  she taps, which is what keeps 260 live chats off her lock screen — and the
  gap it leaves is the one case where the CHAT, not she, knows something
  matters: it has stopped and is waiting on her. Measured that day: **48 chats
  set a `need` in two days and only 6 of them were belled** — 42 asks she could
  only find by opening the app. So a finished reply whose `need` is NEW buzzes
  her whatever the bell says (`needEscalates` in `push-gate.js`).
  - **IT IS NOT A FLIP OF HER BELL.** A self-set bell sticks (only she turns
    one off), so every chat that ever had one important moment would be belled
    forever and the whitelist would quietly become everything. **Importance is
    a property of the MOMENT, not of the chat** — this escalates ONE reply and
    changes no stored flag of hers. Making it sticky is hers to ask for.
  - **IT IS NOT "a need exists".** A chat re-states its need at the end of
    every turn, so that would buzz her on a loop for one ask. `POST /status`
    stamps **`needSetAt` only when the text CHANGED** (read off the doc, not
    the registry cache — the route runs once a turn, and a stale read would
    either drop a real ask or repeat one), and the reply compares it against
    `needPushedAt`: one buzz per distinct ask.
  - **It skips the answers-her test on purpose** — a chat that hit a blocker
    working on its own is exactly the case that test exists to silence, and
    exactly the case she wants to hear about. Clearing the need (`need:""`)
    deletes the stamp, so a withdrawn ask can never ring later.
  **AND THE BANNER SAYS WHICH CHAT AND WHAT KIND (2026-08-28, Sophie: "and
  notification more informative").** It used to be the chat's name over the
  reply's TLDR, and on a deliverable the words "New deliverable" over a title
  with the chat trailing after an em dash — so the one fact she needs first
  (WHICH chat) moved depending on which door rang, and nothing said what kind
  of arrival it was. One shape now, `pushAlert` in `push-gate.js`: **the CHAT
  is always the title**, and the body leads with the kind — `New film · Evan
  v18 (4:23)` · `New page · Sheet v2` — with an answer still leading on its
  TLDR. **AN ASK CARRIES NO LABEL AT ALL** (2026-08-28, her correction the same
  hour: "they also need you that's redundant. None of them need to say that"):
  a `need` line is already a sentence asking her for something, in the chat's
  own words, so `Needs you ·` in front of it said nothing the sentence had not
  said and spent the banner's first words — the ones a lock screen shows. **The ask WINS the banner** when a reply
  carries one: a chat that just asked her something is not better described by
  its own summary. The 2026-08-15 rule survives inside it — a reply opening
  with her own question in bold never comes back as the banner.
  **THE BUZZ WAITS FOR THE TURN TO END (2026-08-28, Sophie: "I get notified on
  my phone a few seconds before chats actually finish their turn").** The
  FINISHED-REPLY door was always honest — it fires from the hook's Stop pass.
  **The other three doors are filed MID-TURN and used to push the instant they
  were filed:** a media pin recording a DELIVERABLE (the checklist has a chat
  pin its film before its cards and its reply), a new Compare page
  (`POST /page`), and an auto-compare grid the server files when a prompt or
  caption lands. Measured against her real deliverables that day, the gap from
  the filing to that chat's finished reply: **19s, 23s, 42s, 58s, 103s** — her
  "a few seconds", exactly. Those doors call `push.queueChat` now and the
  finished reply calls `push.flushChat`, so the doorbell rings when the turn
  really ends. Three rules not to undo: **a reply push SWALLOWS the held one**
  (same chat, same second, same collapse-id — the reply's TLDR is the better
  banner, and an UNBELLED chat still gets its deliverable buzz because no reply
  push fires there to swallow it, which is the deliverables list's whole ask);
  **one entry per chat, newest news wins, and re-queueing never moves the
  DEADLINE** (or a chat filing every few minutes pushes its own doorbell out
  forever); and **a 15-minute fallback timer**, because a hookless session, a
  chat killed mid-turn or a script filing a film never posts a finished reply
  and a doorbell that waits forever never rings. A deploy drops a held buzz,
  which is fine — the deliverables list and the Update tab are the catch-all.
  Test: `node scripts/test-push-pending.js`.
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
  **LIVE since Aug 2026 (measured 2026-08-27: `GET /api/push/status` answers
  `configured:true, devices:1`)** — the APNs key is in Render's secret files.
  This line used to say "dormant until the key exists"; that is history.
  **The home-screen widget** reads one small JSON (`GET /api/chatfeed/widget`) and
  must NEVER pull the real feed. **Full details: `docs/modules/inbox-and-misc.md`.**
- **THE DELIVERABLES LIST** (`deliverables.js`, `/api/deliverables`, page at
  `/deliverables` — Aug 2026, Sophie: "is there a running list of deliverables?
  … can you make one, and have the notification go off when a new deliverable
  is added, even if I didn't set notifications true for the chat that made it,
  so I can watch them all in one place newest first"). One doc per URL
  (sha1(url), `forge-deliverables`), sorted by `updatedAt` desc — a re-render
  at the same url surfaces with a version count instead of duplicating.
  - **ONE ROW PER WORK, ITS LATEST VERSION (2026-08-27, Sophie: "only put the
    latest version").** A new cut is a new url, so every take had its own row:
    measured that day, the Water reel filled **7 of the 32 rows**, the PWC
    training film 3 and Evan 2 — the newest of each buried among its own older
    takes. The join is the TITLE STEM (`workKey`), which works because every
    title here follows the house shape `<name> v<N> — what changed (0:41)`:
    cut at the version marker and what is left is the work. **It must cross
    CHATS** — the Water reel is cut in three of them — so grouping by chat
    cannot do it. Two things not to undo: **newest is by DATE, never by
    version number** (two chats cutting one reel both call theirs v14), and **a
    title with no version marker is its own whole stem**, which is what keeps
    PWC ep005 and ep006 two rows instead of hiding an episode. Nothing is
    dropped — the earlier takes fold under the row, so a wrong merge costs a
    tap and never a deliverable. Live: 32 rows → 23 works.
  - **Two doors in:** every MEDIA pin (video/audio) records itself from
    chatfeed's `POST /pin` — a pinned film IS a hand-over — and anything else
    is an explicit `POST /api/deliverables {chat, session, url, title, kind?}`
    (checklist item 3c). Link pins do NOT auto-record: most are pages being
    worked on, not deliverables. Images stay out by design — the gallery /
    Meta Assets is their one place, and 2,488 of them would bury the films.
  - **The push BYPASSES the bell ON PURPOSE — that is the whole ask.** A NEW
    url calls `push.notifyChat` directly (`debounce:false`, the module's own
    60s collapse), whatever `chatNotifies` says; tapping it opens the making
    chat. A re-POST of the same url is silent. So never POST a test render.
  - **It spends nothing** — no model calls; one single-orderBy Firestore read
    plus chatfeed's exported registry cache for display names.
  - `POST /backfill {dry?}` (dry by default, never pushes) sweeps existing
    registry media pins in, so the list started full. It dedupes by url
    (two chats pinning one file = one hand-over, newest pin wins), writes
    the PIN's own date, and re-running repairs its own records while never
    touching a live door's — the launch-day version recorded per chat
    through the live update path and stamped today's date on week-old
    films (Sophie caught it: "evan says today"). Tests:
    `node scripts/test-deliverables.js` (pure) and
    `node scripts/test-deliverables-page.js` (the real page headless — the
    fold, and the toggle's own tap asked with `elementFromPoint`, since the
    row is an `<a>` and a nested control would be eaten by the link).
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

