# The Chats app — how it is built

`chatfeed.js` (`/api/chatfeed`) and `public/chats.html` — the app Sophie reads every chat in. This is the app's own build history and interface rules: the hook and its versions, the home screen's views and piles, the tabs, the marks, the Compare-page kit, and the sagas behind them.

**Read this when you are working ON the Chats app.** What every chat must DO — post a status card and an Update card, label and file images, post prompts, answer notes, post a Compare page — stays in `CLAUDE.md`.

*(Moved out of `CLAUDE.md` Aug 2026 — see the pointers there. Nothing was rewritten; this is the text as it stood.)*

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
  - **BOLD IS A SECOND METRIC, AND IT ONLY EVER UN-HIDES (Aug 2026, Sophie:
    "working details was hiding a message meant for me … anything bold is
    always for me. can it be an added decision metric").** The tool calls
    still decide where the work starts and stops; inside that middle, a line
    carrying bold — a markdown heading renders bold too — stays on screen and
    the narration either side of it folds around it, which is why a message
    can carry several fold buttons. **This is NOT the v1 vocabulary
    classifier coming back**: it never HIDES anything the structural signal
    left visible, and with no bold in the middle the output is byte-identical
    to what it was. A run shorter than 200 characters shows rather than
    earning a button of its own, and a middle that turns out to be all bold
    folds nothing at all instead of drawing a row of empty buttons. **A `**`
    inside fenced code does not count** — it is not a line for her, and
    cutting inside a fence would leave it unbalanced and break the render of
    everything after it.
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

- **A WHOLE ACCOUNT CAN BE SILENT, AND THE SILENCE IS SELF-SEALING — the
  backfill flag (Aug 2026).** Measured 2026-08-22 against the live registry:
  **292 chats tagged account 1, 128 tagged account 2, ZERO ever tagged
  account 3** — and nothing posting untagged either (the 5 untagged chats are
  all older account-1/2 legacy), so nothing on that account has ever reached
  the app. Everything the app needs is already there — the third tab, the row
  mark, the thread picker and the header switch all read `ACCOUNTS` and an
  untagged chat shows on EVERY tab — so an empty tab 3 is not an app bug: it
  is that account's ENVIRONMENT missing one of the three per-environment
  settings (**Network access** must allow `imageforge-q125.onrender.com`, the
  **Setup script**, and **`FORGE_ACCOUNT=3`**). Only Sophie can set those.
  - **Healing the hook does NOT bring the history back**, which is the part
    that makes this worth writing down. The hook BASELINES: the first time it
    runs in a session it marks every turn but the latest as already-posted, so
    a chat that heals mid-life never floods the feed — and a chat that never
    posted at all loses its whole past on the very firing that fixes it.
  - **`FORGE_BACKFILL=1` is the deliberate opt-out**, and it is set by ONE
    thing: `bash scripts/backfill-chat-history.sh --go` (`--account 3` tags
    the posts when the environment doesn't). It must never be set on an
    environment, or every new session would dump its backlog on turn one.
  - **It runs INSIDE the chat being recovered** — a session's transcript lives
    only in its own container, so no chat can backfill another one, and no
    chat on another account can do it for her. Run with no flags it only
    diagnoses (hook present, backfill flag present, feed reachable, ledger,
    turn count) and posts nothing.
  - **Re-running is safe**: the server upserts on `sha1(session|turn)`, so a
    turn already on file lands on the same message doc rather than a twin.
  - The script never parses a transcript itself — it drives the real hook, so
    the two can never disagree about a turn's key. Test:
    `node scripts/test-chat-backfill.js` (the real hook against a fixture,
    both halves — verified failing against the pre-flag hook, 4 of 10).

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
  untagged; each thread has a "Claude account 1 · 2 · 3" picker (above
  Archive, `POST /api/chatfeed/account`) so Sophie can tag those with one tap
  — its buttons are built from `ACCOUNTS` in chats.html, the ONE list of the
  accounts she has. The hook
  re-stamps the tag on every post, so a manual tag and the env var must agree.

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
  (`POST /api/chatfeed/delete {chat, deleted}`), a **Delete** button in the
  thread header after Archive and Hide — **a trash can since Aug 2026**, see
  *The bell and the two picture buttons* — and the trash itself.
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
  **THE ARCHIVE IS FILTERED BY TAGS (Aug 2026 v2, Sophie: "rather than having
  the built/other tabs I think it would be better to have actual Tags … then
  those tags become a list of options at the top of the archive that I can
  click on and filter by").** This REPLACED the BUILT / OTHER hairline piles
  below, which were one binary judgement about how well a chat went; a tag says
  what the chat WAS, a chat can carry several, and the row is how she finds one
  again. **The `tags` field is gone — it and `category` became ONE field,
  `labels`, in Aug 2026** (see *ONE PILE OF LABELS* under the category chips
  below); the archive row now offers her folder names too, and the sheet writes
  `POST /api/chatfeed/labels` like every other chip surface.
  - **The words are SEEDS, not the vocabulary** — `TAGS` in `chatfeed.js`
    and `TAG_LIST` in `chats.html`, still pinned equal by
    `node scripts/test-chats-archive-tags.js` because the legacy `/tags` route
    checks a cached page's write against them. Her five are
    `bug fix · new feature · built · story · quick question`, then
    `images · film · audio · writing · research` (added by the chat that built
    the row; `failure` joined them Aug 2026). **Free text was refused
    deliberately and that was REVERSED at her ask** ("you can't add tags"):
    folders were always typed, so a fixed list here is what kept the two halves
    from ever being one. Lower-casing on the way in is what is left of the
    orphan-pile guard.
  - **THERE ARE TWO PROGRESS LISTS AND THEY SHARE NO WORDS (Aug 2026, Sophie,
    after a week of chats reading "progress" as one thing: "when I said progress
    list I was talking about two separate progress lists. One is an archived
    progress list and one is a chat progress list. I didn't know what else to
    call it").** THIS IS THE MODEL — read it before touching any of the rules
    below, which arrived one at a time and each read like a special case until
    she named the shape.
    - the **CHAT progress list** (`TASK_LABELS` in chats.html) — where LIVE work
      stands. Offered on the home row and in Organize, nowhere else.
    - the **ARCHIVE progress list** (`ARCHIVE_PROGRESS`) — how a chat ENDED.
      Offered in the archive sheet and the archive's filter row, nowhere else.
    They are **disjoint**: a word says where live work stands, or how it
    finished, never both. Archiving is the answer to every chat-progress word,
    so asking her to mark a chat she is putting away as `to read` was the bug —
    and `built` on the home row, which counts only live chats, was the same bug
    facing the other way. `paintVocabChips(row, mk, {archive})` picks which list
    a surface speaks.
    **THE ARCHIVE-HIDDEN SET IS DERIVED, NEVER A SECOND HAND-KEPT LIST**, and
    that is the lesson: it shipped as `LIVE_ONLY`, holding exactly the five
    words she had said out loud, so `waiting for something`, `in progress`,
    `in a minute` and `maybe never` went on being offered in the archive because
    nobody had named them. It is `!isChatWord(c)` now — every chat-progress word,
    automatically, including any added later. A test asserts the two lists are
    disjoint and that no second list has reappeared.
  - **EACH SURFACE OFFERS ONE HALF OF THE VOCABULARY (Aug 2026, Sophie: "I
    wanna make certain tags just available in the archived step, these tags are
    failure, bug fix, and new feature for now" · "also put built as one of the
    archive only tags" · "put bug fix and new feature into the progress tags for
    just the archive" · "for the archive, get rid of the following tags: look at,
    come back to, to read, to be reviewed, waiting for answer").** One list had
    been doing two jobs. **HOW A CHAT ENDED** — `built · failure · bug fix ·
    new feature`, `ARCHIVE_ONLY` in chats.html — is a judgement she only makes
    while archiving, so those four are offered ONLY in the archive sheet, where
    they LEAD the progress group; the home row (a filter over LIVE chats) and
    the Organize sheet no longer carry them. **WHERE LIVE WORK STANDS** —
    `look at · come back to · to read · to be reviewed · waiting for a response`,
    `LIVE_ONLY` — is answered BY archiving, so the archive sheet drops all five.
    `paintVocabChips(row, mk, {archive})` is the ONE place either list is
    applied; both are PRESENTATION ONLY, so a word already on a chat still
    renders, filters and saves everywhere it already is. `waiting for a response`
    also joined `TASK_LABELS` the same day, at her ask.
    **`research` and `quick question` joined ARCHIVE_ONLY two days later**
    (Sophie: "research goes in progress not categories" → "so does quick
    question" → "quick question and research should only be in the archive tag
    tab"). Being on that list answers BOTH halves at once — an ARCHIVE_ONLY word
    is offered in the archive and nowhere else, AND is read as a progress word
    there, since `paintVocabChips` puts `ARCHIVE_ONLY.concat(TASK_LABELS)` at the
    head of the group. **So do not also add one to `TASK_LABELS`**: that would
    put it straight back on the home row and into Organize, which is the
    opposite of the ask.
  - **THREE WORDS SHE HAD NEVER MADE WERE FORGOTTEN (Aug 2026, Sophie: "get rid
    of images audio and writing", after asking who had made them — the answer
    being the chat that built the row, not her).** Measured the day they went:
    `images` 0 chats, `writing` 0, `audio` 3 (all archived, which lost the word).
    They came out of `TAGS`/`TAG_LIST` and off every chat via
    `POST /labels/forget`. `film` is the survivor of that group of five, and is
    what tests should reach for when they need a plain tag word. The archive's own filter
    row obeys the SAME split (below). Test:
    `node scripts/test-chats-tag-visibility.js`.
  - **THE ARCHIVE IS TWO SURFACES, AND THE FIRST PASS ONLY FIXED ONE (Aug 2026,
    Sophie the next day: "I suspect you didn't change the categories or some of
    the archive stuff" — she was right).** The archive SHEET took the
    `archive:true` split; the archive's own FILTER ROW (`renderArchive`) builds
    its list straight off `fileVocab()` and never came through
    `paintVocabChips`, so it went on offering all five live-progress words.
    Measured on her real data that day: **`to read` 3 · `to be reviewed` 2 ·
    `come back to` 1 · `look at` 1** — four of the five sitting in front of her
    inside the archive. The row applies `isLiveWord` and the same grouping now
    (ALL, then the outcome words, then the rest of the progress words, then a
    `Categories` rule, then her topics) — a word not offered on the way INTO the
    archive must not be a way of finding things once they are in it. It also
    answers her older ask, "can u also put a dividing line between progress and
    categories in the archive", which had only ever landed in the sheet.
    **Nothing is stripped**: an archived chat keeps every word it wears, still
    lit on its Organize sheet and still found by search. Two details:
    `.arctagrow .catdiv` needs `flex-basis:100%` (a block child in a flex row
    would sit beside a chip), and a lit `archTag` that just left the row is
    cleared BEFORE the row paints — otherwise the archive shows a slice with
    nothing on screen saying why, the silent filter this app keeps warning
    about.
  - **SEE MORE IS DRAWN AS A CONTROL, NOT A CHIP (Aug 2026, Sophie: "see more
    shud look different so as not to be confused with being a category/tag").**
    It shipped as a plain `.catchip`, so the folded row ended in a box the same
    size, shape and colour as the folders beside it — the only thing saying it
    was a door was the words in it. `.catchip.morechip` drops the border and the
    background, wears the accent instead of the chips' quiet grey, and carries a
    Lucide `chevron-down`. The red badge is unchanged: it is the same promise the
    TAGS button makes while the row is shut.
  - **FORGETTING A WORD — `POST /api/chatfeed/labels/forget {label, into?, dry?}`
    (Aug 2026, Sophie: "there's a story and stories tags — get rid of stories,
    but make sure to put everything that's in stories currently into story before
    you get rid of it" · "get rid of the weird games tag, I don't know who made
    that either").** Every other route ADDS to the vocabulary — `rememberLabels`
    writes `__settings.categories` with an `arrayUnion` — so a word she had
    finished with survived being stripped off every chat and came back as an
    empty chip forever. This is the only call that clears all three places a word
    lives: the chats wearing it, the remembered vocabulary, and the pile list.
    `into` runs FIRST on every chat in the same write, so nothing is ever left
    holding neither word; a chat already wearing both keeps one; `catBy` is
    preserved rather than stamped `sophie` (renaming her vocabulary is not a
    filing decision about the chats the auto-sorter had filed). **CHECK
    PILE-NESS BEFORE RUNNING IT** — a merged word does NOT inherit it, and
    `stories` filed a chat away while `story` did not, so the 36 chats would
    have landed back on her main list; `PILE_SEEDS` was edited in the same
    commit to give `story` the seat. `dry:true` names every chat and answers
    `intoIsPile` / `droppedPile` without writing. Ran live 2026-08-20:
    `stories` → `story` (36 chats), `weird games` (4), `failed` (0).
  - **HER OWN LINE IS IN THE SHEET TOO (Aug 2026, Sophie: "I'd like to also be
    able to leave my own note … it would show up in the archive as a little
    italic line underneath the bold title of the chat like the notes to myself
    do before they're archived").** It writes `sophieNote` — the field that
    ALREADY renders as that italic line and already beats anything a chat wrote
    there. A second field would only have raced it for the same row. The box
    arrives prefilled with what she has, saves through `liveInput` (dictation
    can fill a field without firing `input`) and again as the sheet closes, so a
    tap that goes straight from the box to Archive keeps what she typed.
  - **A chat is tagged from the ARCHIVE SHEET, and every tap saves at once** —
    the star, the bookmark and the tags are facts about the chat, not part of
    the archiving decision, so Cancel means "don't archive it" rather than
    "throw that away". There is deliberately no re-tag control on an archived
    row yet (the ↓ pile-mover went with the piles); ask before adding one.
  - **`archiveKind` IS NOT MIGRATED and not deleted.** A chat with no `tags`
    of its own DERIVES one in the page (`chatTags`): archived + not marked
    `other` reads as `built`. That is what put the 97 chats already in the
    archive under a tag on day one with no backfill and nothing destroyed. The
    derivation applies ONLY to archived chats — a live chat opening the sheet
    must show nothing picked, or she archives it pre-tagged with a word she
    never chose.
  - **A MARK HAS TO FILL, not just recolour (Sophie, 2026-08-15: "the bookmark
    doesn't fill in when I click it, that's frustrating").** `BMK_SVG` is drawn
    `fill="none" stroke="currentColor"`, so lighting the button turned the
    outline rose and left the bookmark hollow; the star looked right because it
    is `fill="currentColor"` already. Any new place that lights a bookmark needs
    its own `.on svg{fill:currentColor}` — `.bmk.chatbmk.on svg` and
    `.arctags .arcmark.on svg` are the two copies. A test that asserts only the
    `.on` CLASS passes while she is looking at a dead control, which is exactly
    what happened: assert the computed `fill`.
  - **Only tags that are actually in the archive are offered**, in the
    vocabulary's order, with ALL leading and landing. The full ten on a phone
    would be a row she reads past to reach the two that find anything. The
    filter is session-only like every other one here.

  **(HISTORY) THE ARCHIVE WAS TWO PILES — BUILT · OTHER (Aug 2026, Sophie:
  "right now the archive is a single list, I want to split it using the
  hairline pattern into two piles, one of things where we built something and
  something was accomplished and everything worked out, and then another one
  that's pretty much trash but I'm just keeping it for bookkeeping").** Her own
  examples of the second pile: the chat where her computer wouldn't turn on
  ("yeah I did fix it but it's not really important") and the one about Google
  Takeout failing on her email. Kept here because the FIELD is still live and
  still read: `archiveKind` on the registry, `POST /api/chatfeed/archive-kind
  {chat|chats:[…], kind:'built'|'other'}`, absent meaning built. Nothing in the
  app writes it anymore — the tags above replaced the tabs, the row's ↓ mover
  and the sheet's picker.
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
  message first. The **App/Web account toggle is the same iOS switch it always
  was, with a THIRD NOTCH** (`.swi`) — the knob's stops are left = account 1,
  middle = 2, right = 3, one tap moves to the next and the last wraps home, and
  the toast names where it landed. The account it points at is the one she is
  SIGNED INTO on the phone; every other one's chats open on the web.
  - **It shipped once as a row of digit slots and that was wrong** (Aug 2026,
    Sophie: "i wanted a three way toggle — the exact red toggle, just with a
    third slot/notch added"). A three-state control does not need to be a
    different control; the ask was one more notch on the one she already knows.
  - **The track is red in every position now.** It was grey for OFF and red for
    ON, and with three stops there is no OFF for grey to mean — a third colour
    would invent a state she never asked for.
  - **The stops come from `--k` / `--gap`, and the notches from `ACCOUNTS`**, so
    a fourth account is an entry in that array plus one CSS rule of the same
    shape. Nothing counts accounts by hand — not the switch, not the home tabs,
    not the row's account digit, not the thread's picker.
  - **48px wide, which is measured rather than chosen.** The masthead is the one
    row in this app that has run out of room before (five controls plus the
    title put the bookmark button under the word "Chats", so tapping the title
    opened Bookmarks). The controls fill **205.8px** and the title takes what is
    left; the old two-stop switch was 42px, and the 6px this one costs are paid
    for by tightening `.hctl`'s gap 6px→4px — the row measures 205.8px before
    and after. At 42px the three stops would have sat 8.5px apart, not enough to
    tell the middle from either end. **Anything else added to that row gets
    measured the same way**; `test-chats-title-back.js` and
    `test-chats-accounts.js` both hit-test it.
  - **One browser is the only web slot.** With three accounts, two of them route
    to the web via `#no_universal_links`, and iOS opens both in the same default
    browser — which can only hold one signed-in account at a time. Signing the
    others in separately is a phone-side arrangement (a home-screen web app and
    a second browser each keep their own cookie jar), not something this switch
    can express.
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
  - **THE LEASH — a dead automatic park surfaces after 3 minutes of silence
    (Aug 2026, Sophie: "three hours is way too long to wait … could it just
    be like three minutes").** An AUTOMATIC park promises a reply — the
    turn-start ping (`/working`) and her answered message (`/reply`) both
    tuck the chat away expecting it back — but a chat that dies mid-turn
    never sends the reply that unparks it, and it used to sit in Hidden
    forever (the same shape as the 30-stuck-chats bug above, from the other
    side). `parkTripped()` in chats.html: parked with NO sign of life for
    `PARK_LEASH` (3 min) → back on the list. Life = the newest of the park
    stamps and the last message's `postedAt`, which bumps on every draft
    growth — so a chat that is genuinely working keeps itself hidden, and
    one that trips early (a long silent render) just reappears tinted and
    re-hides when its next draft lands. The misfire is today's behaviour
    for a moment, self-correcting, which is why 3 minutes is safe.
    - **A hide SHE tapped is NEVER leashed** — the discriminator costs no
      new field: both automatic parks stamp `workingAt` equal to
      `hiddenAt`, the hand hide (`POST /hide`) writes `hiddenAt` alone, so
      `workingAt >= hiddenAt` means "a turn was expected here". A hand hide
      placed DURING a turn (hiddenAt newer than workingAt) also never
      trips — her hand wins over the machinery's park.
    - The trip happens by the CLOCK, with no poll delta to announce it, so
      the 20s timer runs `leashCheck()` — it repaints only when some chat's
      hidden state actually changed, and with the same courtesy the poll
      shows (home list, at the top, never rebuilding the grid mid-scroll).
    - Tests: `node scripts/test-chats-park-leash.js` (the real page,
      headless — dead park surfaces, hand hides stay put, the clock-only
      repaint) and the leash block in `test-chats-unpark.js` (pure).
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
    themes. **HIDE is a grey PICTURE of an eye now** — see *The bell and the
    two picture buttons* below; it goes red only once the chat really is
    hidden, and wears the cross then too. The **"chats" crumb that used to
    lead the row is gone** ("that seems redundant") — the back chevron already
    says where she is — and `#thread header .no` is
    `justify-content:flex-end`, which is what the crumb's `flex:1` used to do
    for the buttons' position.
  - **The bar wears the LIT CATEGORY CHIP's look** — same `--chg` tokens,
    red outline over a light red tint, at Sophie's ask ("the same style as
    the red outline version of the categories"). It shipped for one evening
    as a solid red block; matching the chip means the two can never drift
    apart, and the screen stops carrying one slab of colour. **The BAR's own
    ⊖ is a FIXED `#b3443f`**, on a cream background in both themes, so a
    fixed red is right there. The ROW's hide button used to match it and no
    longer does: it is a bare crossed-out eye now, `--ink2` until the chat is
    really parked (Aug 2026 — see *The pushpin* for both changes and why).
    Tests: `node scripts/test-chats-hidden.js` (headless Chromium against a
    stub feed; skips without playwright).
  **MORE — the far end of the list, folded at SEVEN DAYS (Aug 2026, Sophie:
  "if there's a chat that I haven't touched in over seven days, can you add a
  new section underneath all the chats called more, and it's just an arrow
  that opens up the rest").** `chatStale`/`renderMoreBar` in chats.html,
  `STALE_DAYS=7`. The live list splits: what she has touched recently, then a
  quiet hairline bar under it that opens the rest in place.
  - **"Untouched" is read off the SAME timestamp the row already shows** (the
    last message's `postedAt`/`created`), so the fold can never disagree with
    the "9d ago" beside it. A chat with **no message at all** counts as
    untouched; a chat that is **WORKING right now** never does, whatever its
    last message says — folding one away mid-turn is the one case that would
    read as a bug.
  - **The bar carries the unread count** ("More 12 · 2 new"), the same reason
    the hidden bar names what is behind it: a reply she never opened must not
    go silent behind a fold.
  - **Deliberately QUIET, and that is the whole difference from the hidden
    bar above it.** Hidden is an alarm and a pile she PUT things in; this is
    the far end of the same list — ink on a hairline, no tint, sitting UNDER
    the chats, and opening it APPENDS rows rather than taking over the screen
    (the hidden pile's whole-screen contract is deliberately not copied here;
    she asked for "underneath all the chats").
  - **Session-only, always starting CLOSED**, like the hidden pile and every
    other filter here: a fold that remembered itself would hide half her
    chats one morning with no memory of having asked.
  - **AND IT KEEPS HER SPOT — `repaintKeepingBar` (Aug 2026, Sophie: "when I
    click more, it takes me all the way back to the top and should stay where
    I am").** Nothing was scrolling her, which is why this read as
    unexplainable: `renderHome` empties `#grid`, so for that instant the page
    is nothing tall and the BROWSER clamps `scrollY` to 0 — the rebuild puts
    the height back but not the position. Every other `renderHome` caller
    follows it with a deliberate `scrollTo(0,0)` (a filter, a tab and a pile
    change what the list IS), so nothing else ever showed it. The tapped bar
    is put back at its own **viewport offset**, never the old `scrollY`, which
    is already wrong if any chrome above it changed height in the repaint; and
    the hidden bar goes through the same helper.
  - **The split happens in `renderHome`, not inside `renderList`** — so the
    hidden pile, the archive, ★ and Status keep showing their piles whole.
    Those are places she went on purpose, and a second fold inside one is a
    filter on a filter. A category chip DOES narrow it, like everything else
    on the live list.
  - **A CHAT BEHIND THE FOLD CAN OPEN EMPTY, AND IT STILL NEEDS THE DOOR (Aug
    2026: "the messages are gone that might be fine but there's also no button
    to get back into that chat").** The Open-in-Claude button has only ever
    been drawn on a MESSAGE ROW, so a thread with nothing in it had no way back
    into the session at all — and the chats behind this fold are exactly the
    quiet ones whose thread comes back empty. The empty state carries one now.
  - **AND THE DOOR IS DERIVED FROM `sessionId`, BECAUSE `url` IS THE ONE FIELD
    THESE CHATS CAN NEVER HAVE (2026-08-25, Sophie again: "how come I don't see
    any messages not even one and no way to get back into the chat").** The
    first cut of the bullet above read the url off the registry doc and cited
    "476 of 505 chats carry one" as coverage. **That was the wrong population,
    and the fix reached none of her cases.** `url` only ever arrives ON A
    MESSAGE — the hook posts it with the reply and the server copies it onto
    the registry — so a chat whose hook never filed a reply has no url, and it
    is the SAME chat that shows no messages. Both halves of her report are one
    missing post. Measured live that day: of the **19** chats behind the fold
    whose thread really is empty, **19 of 19 also had no url**.
    - **`sessionId` comes through a different door** — `/status`, `/update`,
      `/wrapup`, `/resolve` — so a chat that follows CLAUDE.md and posts its
      status card has one even having never posted a message. **16 of those 19
      do**, several with a full wrap-up and Update card, i.e. chats that
      plainly did the work and only failed to file it.
    - **The url is a pure function of it**: over every chat carrying both,
      **398 of 398** are exactly `https://claude.ai/code/session_<sessionId>`,
      no exceptions. So `claudeSessionUrl` is a derivation, not a guess — done
      on READ, so there is nothing to backfill and nothing that can go stale.
    - It lives in **`claudeUrlFor`**, the one function every door already reads,
      so the message rows get the same floor as the empty state, and
      `openHref`'s cross-account `#no_universal_links` rule still applies to a
      derived url exactly as to a stored one. Order: a stored url wins (it is
      what the session itself reported), then the message tail, then this.
    - **A chat with NEITHER gets no button** — nothing invented to fill a gap.
      10 of her 505 are that, 3 of them behind this fold; they carry only
      `about`/`account`/`icon`, so nothing on the doc names a session.
    - **The missing MESSAGES are not fixable from outside.** A chat that never
      posted holds its transcript only inside its own session, so only that
      session can heal it (`scripts/backfill-chat-history.sh`) — which is
      exactly why the door matters most on the chats that have no messages.
  - Tests: `node scripts/test-chats-more-spot.js` (the empty thread's door —
    the derivation from a `sessionId`, the cross-account fragment on it, the
    reachability asked with `elementFromPoint`, and a chat with nothing to link
    to drawing none), and
    `node scripts/test-chats-more.js` (verified failing without the
    split; covers the boundary, the count, the bar's position under the list,
    open/close, the working exemption, and no bar when nothing is stale).
  **CATEGORIES + SELECT MODE, where the LIST/TILES toggle used to be (Aug
  2026, Sophie).** She stopped using the tile view, so the toggle was two taps
  of nothing: the home is always the list (`view='list'` — **`renderTiles()`
  is deliberately kept**, her ask, flip the const to bring it back), and the
  tool row now holds category chips plus two icon-only buttons (select,
  refresh — refresh lost its word to save the space).
  **ONE PILE OF LABELS — categories AND tags, many per chat (Aug 2026,
  Sophie: "right now you can only be in one category at a time, for example
  witch or to be reviewed, and you can't add tags. I think it would make sense
  to just combine them and let you be in multiple categories or tags at
  once").** Two fields sat side by side and neither could do the other's job:
  `category` was exactly ONE per chat in her own free-text names, `tags` were
  MANY but locked to ten words she could not add to. They are ONE field now —
  `labels`, an array, her vocabulary — and a chat is in every pile it carries a
  word for. `POST /api/chatfeed/labels {chat|chats:[…], labels?|add?|remove?}`
  is the one write; every chip surface (the Select bar, Organize, the archive
  sheet) goes through `saveLabels` in `chats.html` to reach it.
  - **`add`/`remove` are PER-CHAT edits, and that is what a bulk gesture
    needs**: she picks six chats and taps `witch`, and the ones already in
    `to be reviewed` keep it. `labels` replaces the set (that is None, and
    nothing else). A word with no chats picked just MAKES the word.
  - **NOTHING WAS MIGRATED, in either direction.** Reading: a chat with no
    `labels` reads as `category` + `tags` unioned (`labelsOf` in `chatfeed.js`,
    `chatLabels` in `chats.html`), so all 333 chats arrived correctly labelled
    on deploy. Writing: every write MIRRORS the pair — `category` = the first
    label, `tags` = the whole set — because her phone runs a cached page for
    days and because `chat-sort.js`, `brief.js`, the `/sort` diagnostics and
    the backfill scripts were never touched. **Drop a mirror and nothing fails
    loudly**; her filing just quietly stops meaning anything on the build she
    is holding. Drop them only once no cached page can still read them, and
    only by changing those readers in the same commit.
  - **The two legacy routes are kept LOSSLESS** — `/category` replaces only the
    FOLDER words and leaves the tag words alone, `/tags` the reverse. So a tap
    on a cached page can never silently wipe labels it was never able to show.
  - **A PILE, OR JUST A WORD (Aug 2026 v2, Sophie the next day: "tagging
    shouldn't hide everything, or maybe just for certain categories — like
    `to be reviewed` should send it to the review pile … whereas other ones
    shouldn't take it off the main feed").** The merge shipped with one
    consequence nobody asked for: a FOLDER always took a chat off the main list
    (her own rule), so once tags were the same field, tagging a chat `images`
    hid it too. A label now carries one property — is it a **pile**. A pile
    takes the chat off the unfiled home list; every other word is just a word
    on the chat and changes nothing about where it shows.
    - **The seed is FROZEN**: `PILE_SEEDS` is her folder vocabulary as measured
      2026-08-18, the day the fields merged, so the app behaves exactly as it
      did before and a word she invents tomorrow is a plain tag rather than a
      trapdoor. **Reading `__settings.categories` instead would be
      self-defeating** — every new word joins that list, so every new word
      would file. Two copies (`chatfeed.js`, `chats.html`), pinned equal by
      `test-chats-labels.js`, same reason as TAGS/TAG_LIST.
    - **`__settings.pileLabels` replaces the seed WHOLESALE** once she touches
      the switch — it is the answer, not a diff against a default that grows
      every time she types a word. `POST /api/chatfeed/pile {label, pile}`
      writes the whole resulting list; `GET /pile` reads it.
    - **The switch is one line under the Organize sheet's chips** (`.pilelink`,
      naming the words that are doing the hiding) opening a small stacked sheet
      of the whole vocabulary as toggles. It is a sentence rather than a
      control because most days there is nothing to change in there — and it
      puts the answer to "why did that chat disappear" on the same screen as
      the tap that did it. **The toast says which kind of word it was too**
      ("Filed under Stories — off the main list" vs "Tagged images"), because
      the two look identical as chips.
    - The merge itself was **measured before shipping**: of 333 chats only 21
      carried a tag and only 3 of those were live — and all 3 were already in a
      folder, so not one chat changed list on deploy.
  - **ONE WORD ASKS A QUESTION (Aug 2026, Sophie: "I wanna set another
    condition for the `waiting for something` tag — it should also trigger a
    text box that asks me what is it waiting for, and then that gets added to
    the note for the chat at the top: it says in bold `Waiting for:` and then
    my content").** The tag on its own says a chat is stuck and nothing else;
    waiting on WHAT was in her head and nowhere on the screen, so the tag could
    not tell her whether the wait was over.
    - **Its own field, `waitingFor` — never `sophieNote`.** A chat must never
      overwrite a line she wrote (the standing rule), and this line belongs to
      the TAG rather than to the chat: `labelPatch` DELETES it the moment the
      word comes off, whichever way it comes off, so "waiting for the API key"
      cannot outlive the wait. `POST /api/chatfeed/waiting {chat, text}`.
    - **Where it shows.** On the home row it WINS the one line (`waitingHtml`
      before `note || wrap || need || doing`) — only one line shows there, this
      is the most specific thing she deliberately typed, and it clears itself,
      which her note never does. In the thread it sits ABOVE her note rather
      than replacing it: two different things, and that row has room for both.
      Both are tappable and re-open the same box, prefilled.
    - `WAIT_LABEL` / `WAIT_ASK` / `WAIT_PREFIX` are constants in `chatfeed.js`
      with copies in `chats.html`, pinned equal by the test. **A second asking
      word is not mine to declare** — same rule as the pinned link: describe
      the case and let her say yes.
    - The box uses `liveInput`, like every other field here — iOS dictation can
      fill an input without ever firing `input`.
    - **THE REASONS SHE HAS GIVEN BEFORE, BEHIND A ⟲ (Aug 2026, Sophie: "could
      you gather the list of reasons for waiting for something that I enter
      manually and put it behind a button … should be small and unobtrusive
      since I won't use it that often").** A 17px `history` glyph on the
      QUESTION's own line — so it costs no height — opening her past answers
      under the field, newest first, one tap to put one in the box.
      - **There was nothing to gather until this shipped, and that is the
        finding.** `waitingFor` is a live state that `labelPatch` deletes with
        its tag, so every answer she had ever typed was already gone —
        **measured live 2026-08-20: 378 chats, TWO carrying a reason.** A
        button over that would have opened on almost nothing.
      - So the memory is a **SECOND place**: `__settings.waitingReasons`,
        written by `rememberWaiting` in chatfeed.js beside her label
        vocabulary. The field stays live-and-deletable — the whole point of it
        — while the answers accumulate next to it. It rides the feed's
        `settings` object like `pileLabels`, so the button costs no request,
        and `regRef` invalidates the registry cache on write.
      - **Newest first**, and re-picking one moves it back to the top, so the
        list opens on what she is most likely to want. The page mirrors the
        same bookkeeping locally, so a reason she just gave is there the next
        time she opens the list rather than after a poll.
      - **NOTHING GIVEN BEFORE → NO BUTTON.** An empty list paints no control
        at all, the way an empty section on the Update tab paints no header.
      - **It is not a back door for pre-written text.** The box still opens
        empty on a chat with no answer; the list is a thing she OPENS, and
        tapping a row fills the field and leaves the sheet open — a past
        answer is often only nearly right, and she has to be able to edit it.
      - Best-effort on the server and written AFTER the real save: a
        remembered reason must never cost her the answer she just gave. Two
        chats saving in the same second could lose one off the list; that is a
        list, not her data, and `arrayUnion` would have thrown the ORDER away,
        which is the only thing making it useful.
      - **There is deliberately no way to forget one yet** — she asked for the
        list, not for its housekeeping. Worth revisiting once it is long
        enough to be in the way.
      - Test: `node scripts/test-waiting-past.js`.
    - **NO PLACEHOLDER (Aug 2026, Sophie: "it has pre-written text. Can you get
      rid of that and also make it a rule to never add prewritten text unless I
      ask for it").** It shipped with an example answer in the field ("the API
      key, her go-ahead, Tuesday…"); the question above the box is the only
      prompting it gets. Prefilling with HER OWN saved answer is a different
      thing and stays. This became a house rule for every field she writes in —
      **NEVER PUT PRE-WRITTEN TEXT IN ANYTHING SHE WRITES IN** in CLAUDE.md's
      design rules — and the empty field is pinned by
      `node scripts/test-chats-labels.js`.
    - **`threadNote`** is the open thread's note repainter, set in `openChat`:
      the sheets that change this line live outside it and `renderHome` only
      repaints the LIST, so without it her answer appeared only after a reload.
  - **`to be reviewed` ALSO FEEDS THE REVIEW QUEUE** (`REVIEW_LABEL`, one
    constant shared with `review.js`). A chat carrying it becomes a row at
    `/review` — the label is the whole mechanism, nothing is filed or stamped,
    so the row appears when she tags the chat and goes when the word comes off.
    See *THE REVIEW QUEUE* in `CLAUDE.md`.
  - **The home chip row shows LESS than the sheets do** (`catList()` vs
    `fileVocab()`): the ten old tag words are offerable everywhere but only
    reach the row once something is actually wearing one. The row is a filter
    she reads past on every screen; the sheets are somewhere she went on
    purpose.
  - Tests: `node scripts/test-chats-labels.js` (the route, the mirrors, the old
    shape still reading, the legacy routes, and the real Organize sheet).
  - **A category is one `category` field on the registry doc** — was, until the
    merge above; `POST /api/chatfeed/category {chat|chats:[…], category}` is
    still live as the legacy half. It was the Dump's `track` in another
    costume, and it takes a whole selection in one call because filing is a
    bulk gesture. Empty category clears it.
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
  - **…AND THEN THE CHIPS FOLDED AWAY BEHIND ONE WORD (Aug 2026, Sophie:
    "take the categories — like just for fun, stories, pretty much all of
    them — off that page, just have a button that says tags and then once I
    click it that's when it shows all the categories").** The row had grown
    to ten folders and wrapped onto two lines above every list. Filing is a
    burst — she does it in select mode — but the chips were paying rent at
    the top of the screen the rest of the time: the MINIMIZE THE SCROLLING
    rule, and the same argument that collapsed the search bar into its glass.
    - The row at rest is the ★ chip and **TAGS** (`.tagsbtn`). One tap paints
      every folder, another folds them away. `catsOpen` is session-only and
      **always starts SHUT**, exactly like `searchOpen`.
    - **TAGS carries the SUM of the folders' red unread numbers while they
      are away**, and drops it once they are on screen. Filing takes a chat
      off the main list, so without the sum a folded row would make every
      reply inside a folder silent — the thing the per-chip badge was built
      to prevent, hidden one level deeper.
    - **A LIT FOLDER FORCES THE ROW OPEN** (`catsShown() = catsOpen || cat`),
      and **closing clears the filter**. Either half alone gives the silent
      filter this app keeps warning about: she would be looking at seven
      chats with nothing on screen saying why, and no way back out.
    - Select mode's own filing chips are untouched — the whole vocabulary is
      always there to file into, whatever the row above is doing. Test:
      `node scripts/test-chats-tags-button.js`.
  - **TWO KINDS OF TAG, AND ONLY THE TASK ONES SHOW BY DEFAULT (Aug 2026 v2,
    Sophie, from a screenshot of the open row stacking ~18 chips one or two
    to a line: "there are two different types of tags — category tags like
    witch and dream app and xi, and task tags like in progress and come back
    to … the default view should only show the progress tags, but there can
    be a see more button that shows the category tags also, and if they're
    both shown there should be some sort of distinction between them like a
    small red line or a label").**
    - **`TASK_LABELS`** (chats.html) is the split, and it is **presentation
      only** — nothing about filing, piles or chat-sort reads it, and a word
      not on it lands in the categories group, the safe default for anything
      she invents. Task = where the work stands (`look at`, `come back to`,
      `in progress`, `waiting for something`, `to be reviewed`, `to read`,
      `built`, `failed`); category = what the chat is (witch, stories, dream
      app, …). Moving a word between groups is editing that one array.
    - TAGS opens on the task words (in `TASK_LABELS` order) plus **SEE MORE**
      (`.morechip`), which carries the folded categories' summed red number —
      the same never-silence-a-reply rule TAGS itself follows while shut.
      Tapping it unfolds the categories under **`.catdiv`** — a thin red line
      with CATEGORIES under it, her "small red line or a label" — and the
      chip goes. `catsMore` resets when TAGS closes, so every open lands on
      the default; a lit CATEGORY filter forces both open (`catsMoreShown`),
      the same silent-filter rule as `catsShown`.
  - **THE ROW RUNS FULL WIDTH AND FLOWS AROUND THE PILL (Aug 2026 v2, same
    message: "the tags are going really far down because they are not allowed
    to go into the left most part … get rid of the refresh button … make the
    tags take up the full width but skip where the auto scroll pill is").**
    - `.toolrow` is a **block with inline flow** now, not a flex line: the
      select icon is simply first in the flow and chips wrap under it to the
      full width. The old flex layout penned every chip into the column right
      of the icons — that was the stack down the screen.
    - **`#pillnotch`** is a right float sized at paint time
      (`sizePillNotch()`) to however much of the pill's fixed band (y 14-192)
      the row still occupies — lines beside it shorten, lines below run full
      width. It replaces the blanket `padding-right:64px`, which reserved the
      corner on EVERY line including the twenty below the pill.
    - **…AND IT MUST NOT RESERVE MORE THAN THE ROW USES (Aug 2026, Sophie:
      "the space between the chats and the top is ever increasing?" → "the gap
      is empty").** A float taller than the content beside it becomes the
      ROW'S OWN HEIGHT, and the surplus is blank page above everything
      underneath. Measured on her real 365 chats at 390x844: the UPDATE screen
      carries two boxes on one line (34px) against a 90px float, so **70px of
      the screen above her cards was nothing at all**; the chat list paid 56px
      with TAGS shut. `sizePillNotch()` now paints at the full band, measures
      what the row really used, then shrinks to that — **two passes, and the
      second cannot push the chips back up**: a line already sitting above the
      shortened float still dodges it, and when the content runs past the band
      the band is kept and nothing changes. It measures the CHIPS, not
      `#catrow` — that is `display:inline`, so its own rect is a line box and
      stops short of them. Recovered 50px on UPDATE and 49px on the chat list.
      Test: `node scripts/test-chats-pill-notch.js` (verified failing before —
      and it also pins that the chips still dodge the pill, which is the whole
      reason the float exists).
    - **The tool row's refresh icon is GONE** ("I never use it anymore") —
      the page polls on its own; the thread header keeps its own refresh.
      `window.__reload()` keeps the tap's exact behaviour for the tests.
    - The archive's `.catrow.arctagrow` keeps the flex layout — the inline
      flow is scoped `#toolrow .catrow`.
    - Test: `node scripts/test-chats-tags-button.js` — the groups, the sums,
      the reset, and the layout measured on real geometry (a line below the
      pill band may only break when the next chip truly wouldn't fit).
  - **COME BACK TO IS ONE BUCKET (Aug 2026, Sophie: "can you combine the come
    back to and later categories" — confirmed as the chat-list FOLDER and the
    UPDATE screen's BOX).** She had two names for one intention and two places
    to go looking.
    - **One word and one pile — deliberately NOT one field.** A label files a
      chat forever; `newsQueue` files ONE update until something newer lands
      and then hands it back. Folding either into the other loses something
      real: make the folder write a queue and her filing expires on its own.
      (The other half of this argument — that a chat deferred from the Update
      box would be yanked out of Stories, since a chat could only be in one
      folder — died with the merge above. The expiry half is what still keeps
      them apart.)
    - So the Update box is **labelled** "Come back to" (`NEWS_QS`) while its
      **stored value stays `later`** — the rename is a word, not a migration,
      and nothing already filed had to move. `NEWS_QUEUES` in `chatfeed.js`
      carries the note.
    - The folder's chip shows the union: chats filed into `come back to` PLUS
      chats whose update card is in that box right now. `chatInCat()` is the
      one test, read by the chip's count, the live list and the archive alike;
      `rebuildComeBack()` derives the box membership through
      `newsItems`/`newsBoxed` rather than re-deriving it, so the chip and the
      box can never disagree about where something is.
    - **A chat deferred on the Update screen still shows on the main list.**
      Deferring one update is not filing the whole chat away, and making it
      vanish from the list would be a filing she never asked for.
    - A superseded card leaves the pile the same moment it leaves the box —
      the auto-return rule is the box's, and the folder must not contradict it.
    - Test: `node scripts/test-chats-come-back-to.js` (verified failing against
      a folder that only reads `category`).
  - **…AND THEN ALL THREE BOXES GOT ONE (Aug 2026, Sophie, pointing at the
    labels row: "'maybe never' isn't on the tag list in the account area" →
    "give them both a chip").** Only `later` had ever been joined to a word,
    because only `later` already HAD one — she had been filing chats into a
    "come back to" folder by hand long before the Update screen existed.
    `in a minute` and `maybe never` were invented as boxes, so a card she put
    in one was reachable from exactly one screen. Three boxes, one door.
    - The join is a TABLE now, `QUEUE_CATS` in `chats.html`, and the rest of
      the file needed no idea it grew: `cbBox` is keyed by WORD rather than by
      chat, `chatInCat()` reads it, and everything downstream (the counts, the
      live list, the archive, the hidden pile) follows for free.
    - **The two new words are NOT seeded into her vocabulary.** They appear on
      the row only while something is actually in their box and leave again
      when she empties it — `come back to` is a folder she made and stays put,
      which is the whole difference. So a word she never uses never squats on
      her row.
    - They are **TASK words** (`TASK_LABELS`), sat together in `NEWS_QS`'s
      order, so the chips and the boxes read the same way round.
    - Nothing about FILING changed: deferring one update still leaves the chat
      on the main list, and a superseded card still leaves both the box and
      the chip at the same moment.
    - Test: `node scripts/test-chats-queue-chips.js` (verified failing against
      the one-word join — the two chips simply were not on the row).
    - **A derived word is a FILTER, not a folder** (`queueOnly()`): `in a
      minute` and `maybe never` are on the home row but are kept OUT of
      `fileVocab()`, so no filing sheet offers them. Tapping one in a sheet
      would put it on a chat as a real label, where it would not empty itself
      when the card is superseded and would outlive the box entirely. `come
      back to` is exempt — a folder she made by hand.
  - **ONE ROW, TWO GROUPS, A LINE BETWEEN (Aug 2026, Sophie: "can u also put a
    dividing line between progress and categories in the archive").** The home
    row has drawn that line since TAGS folded (`.catdiv`), but the SHEETS
    handed her one jumbled list — `Stories` and `Tech` first because they are
    the seeds, then `Come back to`, then `Witch`, then `Look at`.
    - `paintVocabChips(row, mk)` is the one painter: progress words in
      `TASK_LABELS` order, a `.catdiv` reading CATEGORIES, then the rest. Every
      sheet that draws `fileVocab()` as chips comes through it — the archive
      sheet and both Organize rows — so a word is never in the progress group
      on one screen and the topic group on another.
    - `.catdiv` is a BLOCK in the home row's inline flow, which is what breaks
      the chips there. `.arctags` is a flex row, where a block child would sit
      beside a chip — so inside a sheet it takes `flex-basis:100%`.
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

  **CHATS SORT THEMSELVES (Aug 2026, Sophie: "I've been manually sorting all
  my chats, but they could sort themselves in the chats app, and that could be
  a start of turn or end of turn activity").** `chat-sort.js` holds every
  judgment and its reasoning; `sortChat()` in `chatfeed.js` holds the reads,
  the writes and the money. The parts worth knowing before you touch it:
  - **THE SERVER DECIDES, NOT THE CHAT** — even though her sentence describes
    a chat doing it at the end of its turn. A chat-posted category would be
    filed by the same ~7% that ever post an Update card (**measured: 15 of
    224**), and the chats it missed would be the sleeping ones she most wants
    sorted. So it is DERIVED from the thread the feed already stores, at the
    end of a turn, through the door every chat already posts through
    (`POST /api/chatfeed`, fire-and-forget after the response) — nothing to
    install, nothing for a chat to remember, and it reaches ancient hooks.
    Same call as the Questions button, and for the same measured reason.
  - **END of turn, never start.** At the start of a turn the newest thing in
    the thread is her message and the work hasn't happened — the sorter would
    be judging the chat by what it was before she asked.
  - **HER FILING IS FINAL** — `catBy` on the registry doc. Everything through
    `POST /category` is stamped `sophie` (the app is its only caller), the
    sorter writes `auto`, and it only ever writes into an empty field. One tap
    from her locks a chat forever. Deliberately NOT a flag the page sends: her
    phone runs a cached page for days, so a new-build-only flag would leave
    her own filing looking automatic.
  - **`filedAt` IS STAMPED AT HER LAST MESSAGE, not now** — the one thing here
    that is easy to get wrong and expensive when you do. A sort runs when a
    turn ends, so stamping now would file the chat the instant it finished
    answering her and drop it off the main list with the answer inside it.
    Stamped at `lastHerAt`, the reply that triggered the sort is newer than
    the filing, so the chat pops straight back out — in the folder AND on the
    list, the round trip she designed for manual filing. A BACKFILL stamps now
    on purpose (`stampNow`): those are chats she would have filed by hand.
  - **"none" is a real answer and locks nothing.** Filing hides a chat from
    the list she reads, so a wrong folder costs her real work while an unfiled
    chat costs nothing. The model is told to prefer none; none writes only
    `catTriedAt`, and the chat is asked about again a day later.
  - **THE VOCABULARY IS HERS, AND HER OWN FILING TEACHES IT.** The folders are
    read live (`__settings.categories` + names in use), and each is described
    to the model by up to 8 chats SHE filed there — so "meta" means what she
    uses it for, and a folder she invents next month works as soon as she
    files two chats into it, with no code change. The sorter's own answers are
    excluded from the examples, or one early mistake would become a folder's
    definition and compound.
  - **WHAT THE WORK IS BEATS WHERE IT HAPPENED (2026-08-24, Sophie: "for chats
    that are tagging themselves, if it's in the story room but it's just a bug
    fix for the story room then they shouldn't tag it story, they should just
    tag it bug fix — and that applies to all the other categories
    obviously").** Her vocabulary holds two DIFFERENT kinds of word and the
    sorter could not tell them apart: some name a SUBJECT AREA (`witch` ·
    `story` · `film` · `dream app` · `tech` · `meta` · `xi` · `chunk making` ·
    `just for fun` · `pelt`) and some name WHAT THE WORK IS (`bug fix` · `new
    feature` · `research` · `failure` · `built` · `quick question`). Every chat
    has a subject, so the subject word always looked like the safe answer — and
    that is useless in both directions: `story` fills with plumbing, and `bug
    fix`, the pile she reaches for when she wants to know what has been going
    wrong, stays empty.
    - **ENFORCED IN CODE, NOT ONLY IN THE PROMPT** — the archive summary's
      length cap taught that a prompt instruction is a hope. The model answers
      `kind` in its OWN field beside `category`, and `pickCategory` PREFERS it;
      forgetting the rule would take an active `"none"` rather than a slip.
      The prompt still states the rule and marks each kind folder in the list
      it is handed (`[what the work IS]`), because a model that cannot tell
      which of her words are subjects is guessing.
    - **Three things not to undo**, each a case in the test: a `kind` naming a
      SUBJECT is IGNORED (otherwise the rule inverts — the field built to beat
      subjects would carry one); an invented kind is refused exactly like any
      other invented folder (rule 3 is untouched); and a kind with NO subject
      beside it still files, because "sure it was a bug fix, unsure which
      corner of the app" is an honest answer to what that pile is for.
    - **BUG FIX IS THE LENIENT KIND, and it measures TURNAROUND (2026-08-28,
      Sophie: "square story type should've already existed, so it's a bug" ·
      "it's more about how quickly it'll get done, and how soon I can archive
      it").** Not "was code broken": small bounded work that lands in a turn
      or two and can be put away is a bug fix — gap-fills in an existing
      surface (a missing shape, a control its siblings have, an iOS/web
      mismatch, something a restructure lost), tweaks, repairs. `new feature`
      is reserved for genuinely new capability with real scope, the kind of
      chat that stays open a while. The rule lives in `SORT_SYS`; the test
      pins her turnaround wording.
    - **`WORK_KINDS` is a HINT OVER HER LIVE VOCABULARY, never an addition to
      it.** A word in it she does not have annotates nothing; a folder she
      invents next month is still offered and still fileable, it just is not
      read as a kind until it is named there. `GET /api/chatfeed/sort` prints
      `workKinds` — the folders currently being read that way — so the day the
      list goes stale against her words is measurable in one read rather than
      silent. Deliberately NOT kinds: `to read`, `waiting for something`, `in a
      minute`, `maybe never` — those say WHEN, the same reason `TRIAGE` is off
      limits.
    - **Chats she filed herself never move** (rule 1), and auto-filed ones
      reach the new rule on their next re-check (`RESORT_*`) — or immediately
      with `POST /api/chatfeed/sort {chat, force:true}`, ~a cent a chat.
    - **The re-check keeps pace with KINDS now (2026-08-28, found live: "none
      of my recent bug fix chats are in that tab").** The old rest — a week,
      re-ask after the thread TRIPLED — assumed a tag names the SUBJECT, which
      is stable. A kind names the chat's NEWEST work and turns over in hours:
      the chat-area chat spent a morning repairing the hidden pile its own
      restructure lost — a bug-fix chat by her rule — wearing yesterday's
      `meta` with six days of rest to go, and the Bug fixes tab showed nothing
      newer than 11 hours. Now: a DAY's rest and EIGHT new messages, both
      (`RETRY_MS` + `RESORT_MIN_NEW` in `chat-sort.js`), so only a chat that is
      actively worked re-asks, at most daily, under a cent.
  - **`look at` and `come back to` are OFF LIMITS** (`TRIAGE`). They say WHEN
    she wants something, not what it is; nothing outside her head can know
    that, and guessing buries real work in a to-do folder. She still files
    there by hand.
  - **Cost:** one small Claude call (name + her note + status card + a
    head/tail digest), well under a cent, at most once per chat per day
    (`catTriedAt`). The gate is answered off the CACHED registry, so an
    ordinary finished reply on an already-filed chat spends and reads nothing.
  - `GET /api/chatfeed/sort` is the read — vocabulary, examples, counts, and
    whether the key and the switch are on. `POST /api/chatfeed/sort
    {chat, dry, force, stampNow}` sorts one; `dry:true` answers with the
    folder it would pick and changes nothing. `__settings.autoSort === false`
    stops it dead without a deploy (no UI — a switch she never asked for).
  - **IS THIS CHAT FINISHED? — the same call also flags what could be archived
    (Aug 2026, Sophie: "flag which ones should be archived… whether there was a
    feature that was built that was basically complete, or if we were in the
    middle of something… if there was something that simply couldn't be done,
    or if there was a question I just forgot to answer").** Two halves, and
    only one is a judgment: the model says `done` / `mid` / `blocked`, while
    **the question she forgot to answer is DERIVED** (`pendingAsk`). It
    **outranks everything** — a finished feature with a question of hers
    hanging in it is a chat to answer, not one to put away. Four values on the
    registry as `archiveHint`: `archive`, `dead end`, `needs you`, `keep`.
    **Nothing archives anything** — she asked to be shown which ones, and a
    wrong archive puts real work behind a pile she does not read.
    - **THE DIRECTION WAS BACKWARDS AT FIRST, and the measurement caught it.**
      v1 looked for questions of HERS with no reply (`buildQuestions`,
      `!q.answer`) and flagged **0 of 86 chats** — a chat always answers, so
      that pairing can only ever come up empty on a live thread. Her sentence
      is the other direction: *the chat* asked *her* and she never came back,
      which is exactly why such a chat is not finished.
    - It stays derived because the proof is structural: her answer would be a
      message from her AFTER the question, so a question in the thread's LAST
      message with nothing behind it is unanswered by construction.
    - **It reads only the CLOSING section** (from the message's `tail` offset,
      where the turn's last tool call fell) — mid-narration prose is full of
      rhetorical questions. And it **requires a literal `?`**, which
      `isQuestion` deliberately does not: that detector is tuned for HER
      dictation, which often has no question mark, so a leading auxiliary is
      enough there and "Did all the work here." trips it. A chat writes
      markdown and always punctuates.
    - The closing is picked by SENTENCE, never by slicing at `tail` — a raw
      offset lands mid-word and the fragment reads as its own sentence
      ("ady for the next batch?").
  - **THE OUTPUT GREW AND THE TOKEN CAP DIDN'T — the same truncation the
    archive summary already had.** 300 tokens fitted `{category, why}` and cut
    `{state, stateWhy}` off mid-string; an unclosed brace fails both of
    `parseJSON`'s attempts, so **15 of 86 chats in one pass** came back as
    "Claude did not return parseable JSON". The cap is 700 now AND the call
    runs raw through `salvageJson`, because either fix alone still loses
    answers. **Adding a field to a model's JSON output means raising its cap
    in the same commit.**
  - **THE REVIEW PAGE ANSWERS IN FOLDER NAMES, not yes/no** (`scripts/gen-sort-
    proposal-page.js`, her ask: "a check off mark per chat to say yeah file it
    there, or alternatively file it elsewhere"). One control does both: ✓
    writes the proposed folder into the verdict's `ok`, the picker writes a
    different one, `none` leaves it unfiled — and a row with NO value is one
    she hasn't reached, a state a boolean could not carry. The ✓ lights only
    when her answer IS the proposal, or a lit tick would be claiming she
    agreed with a guess she overrode.
  - **HER TICKS GET APPLIED, AND THAT IS WHAT TEACHES A NEW FOLDER.**
    `node scripts/apply-sort-verdict.js --sheet sort-dryrun-<n>` (dry, then
    `--write`) reads the verdict back and files them through `POST /category`,
    which stamps `catBy:'sophie'` — so the sorter never revisits them AND they
    become the EXAMPLES the folder is taught by. That is the whole loop: "5 of
    these witch ones are really dream app" becomes a `dream app` folder the
    sorter can use, with nobody writing a description of it. A row she never
    touched is left alone — the page is long, so silence means "not yet".
  - **"Leave unfiled" is an ANSWER and needs its own field** (`catNone`,
    `POST /api/chatfeed/sort/none`). An empty `category` is indistinguishable
    from a chat nobody has looked at, so without it the sorter would file the
    chat again tomorrow — rule 1 broken in the one direction `category` cannot
    record.
  - **An EMPTY folder is offered by name, never suppressed.** The first version
    told the model to "prefer none" for a folder with nothing in it, which is
    backwards — an empty folder is one she has just MADE (she made `dream app`
    the day this shipped) and it would have stayed empty forever.
  - Backfilling the ones already there:
    `node scripts/backfill-chat-categories.js` (dry by default, `--write` to
    file, `--limit N` for a sample). Tests: `node scripts/test-chat-sort.js`
    (pure, no network, no key).

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
    - **`notify`** = allowed to buzz her phone. The BELL, added Aug 2026 —
      see *The bell and the two picture buttons* below.
    - **`pinTop`** = stays at the top of every list. The PUSHPIN, added Aug
      2026 — see *The pushpin* below. It is the one mark whose control is
      **not** in the thread header: it lives on the home row, at her ask.
    - **Three of the marks sit side by side in the thread header** — the
      bookmark, the star, then the bell — so the difference is a choice she
      makes in one place. The keep button is `.bmk.chatbmk`, written that way
      and never `.chatbmk` (the `.bmk.hdrbmk` trap: the generic `.bmk` rules
      sit LATER and win at equal specificity). Measured at 375/390/430 — the
      row still fits on one line with none of them buried.
    - **Migration (2026-08-13):** the 22 chats starred under the OLD meaning
      were copied to `bookmarked` and their stars cleared, so nothing was
      lost and the star starts empty under its new meaning. She prunes the
      bookmark list down to her handful.
    - The ★ chip still reaches into the archive. That was justified by the
      old meaning; it is harmless under the new one and was left alone.

  **THE BELL AND THE TWO PICTURE BUTTONS (Aug 2026, Sophie: "add a little bell
  next to the star that I can click in. This will enable notifications for this
  chat and un-click and it will turn them off — only the ones I clicked the
  bell on will notify me. Also, can you make the delete button a picture of a
  trash can and the hide button a picture of an eye that's crossed out if it's
  hidden").** Three changes to `#thread header .no`, one row:
  - **The bell is a WHITELIST, and that is the load-bearing half.** `notify`
    on the registry doc, `POST /api/chatfeed/notify {chat, notify}` (404s on a
    chat that doesn't exist — the phantom-row guard), read server-side by
    `chatNotifies` in `push-gate.js` in front of BOTH push doors: a finished
    reply and a new Compare page. **Absent means silent** — nothing pushes
    until she taps a bell, which is her sentence read literally and also the
    safe failure direction (a caller that forgets the flag goes quiet rather
    than buzzing her). It compares `notify === true`, never truthiness.
    **One exception she asked for (2026-08-27): a quick-question chat sets its
    own bell ON** ("a 'quick question' chat shud set its own bell as true") —
    when she runs a chat in quick-question mode, or it wears the `quick
    question` label, the chat POSTs `{chat, notify:true}` itself. Never OFF;
    that stays hers.
  - **The bell is FILLED, GOLD when lit, and NOT Lucide's** (Sophie's second
    pass, same week: "change the bell colour to yellow and make it filled in
    rather than just the outline"). It shipped stroked, with a comment here
    claiming a filled bell "stops reading as a bell" — **that was reasoned,
    not looked at**, and one screenshot of the candidates at 16px on both
    papers settled it the other way: filled reads BETTER at that size, where
    the outline's 1.8px walls close up into a blob. The half that was true is
    narrow — filling *Lucide's* path leaves its clapper as a detached crescent
    — so `BELL_SVG` is a hand-drawn pair instead, one closed dome and a small
    tab, which is also the `bell.fill` silhouette her phone already knows. It
    is filled in BOTH states; grey `--line` vs gold is the state, exactly like
    the star. Its class is `.bellbtn`, kept out of `.bmk` on purpose (the
    generic `.bmk` rules sit later in the file and win at equal specificity).
    - **`--bell` is the one colour on that row with TWO values**, where the
      ⊖'s red and ARCHIVE's green are fixed across both themes. Measured: no
      single yellow clears 3:1 against BOTH papers — a gold dark enough for
      cream (3.05:1 at `#b5820a`) goes muddy on the dark one, and a yellow
      bright enough for dark sits at 1.9:1 on cream. So it is a token in all
      four theme blocks: `#b5820a` light, `#e8b53a` dark.
  - **The eye carries the HIDE state the word used to.** Open eye = this chat
    is on the list; crossed eye (`eye-off`) = it is parked in the hidden pile,
    which is what "In hidden" said before.
  - **The trash can is the masthead's own glyph** (`TRASH_SVG`, the same
    `trash-2` path `#trashlink` draws), so the button and the pile it sends
    things to read as one idea. `.trashbtn.delbtn`, again never `.bmk`.
  - **NEITHER OF THOSE TWO IS RED AT REST** (Sophie, second pass: "make the
    trash not red until I click it and the hidden icon should also not be red
    until I click it"). They shipped carrying the red their *words* had, and
    two red glyphs in the header read as a warning about a chat with nothing
    wrong with it. Both are `--ink2` at rest now; the eye turns `#b3443f`
    **with its crossing stroke** (the state, not a hover), and the can turns
    red only on `:active`, because deleting has no resting state to show — the
    chat leaves the screen.
  - **The row got NARROWER, not wider, even with a control added** — measured
    at 390px after the change, the six children run x=75→315 inside a 351px
    row with `scrollWidth === clientWidth` and no horizontal body scroll. Two
    words became two ~25px icons, which paid for the bell twice over. Measure
    it the same way before adding a seventh.
  - Tests: `node scripts/test-chats-bell.js` (the real page, headless — the
    bell's two POSTs, the roll-back on a failed save, both eye states, no
    words left in the row, a hit-test on all three, and the COMPUTED colours:
    the bell filled and gold when lit, neither the eye nor the can red at
    rest, the eye red only when crossed) and the bell half of
    `node scripts/test-push-gate.js`. The colours are asserted off
    `getComputedStyle`, not the markup — a stray `.bmk`-style rule landing on
    one of these is exactly the failure worth catching, and it shows up
    nowhere else.
  **THE PUSHPIN — a chat that stays at the top (Aug 2026, Sophie: "an option
  to pin chat to the top so they always show first when they come out of
  hiding and they never disappeared to the bottom if I don't look at them for
  a while, and I guess I can just unpin them if necessary").** The fourth
  per-chat mark, and the only one whose control is on the home ROW rather than
  in the thread header.

  **IT SHIPPED WRONG TWICE IN ONE PASS AND SHE CORRECTED BOTH — read this
  before touching it.** Her first message said "the little dot pin for like
  Maps that people put on Maps", which was built as a Lucide-style teardrop
  marker. What she meant was a PUSHPIN: "sorry I was talking about the pin
  that's like round with a metal thing sticking down from it — that's a
  different one that you made." And it was put in the thread header beside the
  other three marks, which was the wrong screen: "I was assuming it would go
  right on the main page not inside of it." Both are settled now; don't drift
  either back.
  - **It is HER OVERRIDE ON THE RECENCY SORT.** The home list is ordered by
    newest message, which is right for an inbox and wrong for the two or
    three chats she is actually steering: one she leaves alone for a day
    sinks under ~190 others, and one that comes back out of the hidden pile
    re-enters wherever its last message puts it. A pinned chat sorts above
    all of that; pinned chats keep their own recency order among themselves.
  - **ONE LINE, IN `sortedChatNames`, AND THAT IS DELIBERATE.** Every list of
    chats — live, hidden, ★, archive, the category chips, the account tabs,
    Status — comes through that function, so the tier is written once and
    nothing else had to learn about pinning. In particular the hidden pile
    needed no change at all: her sentence about "when they come out of
    hiding" falls out of sorting in the one place.
  - **`pinTop` on the registry, `POST /api/chatfeed/pin-top {chat, pinTop}`**
    (404s on a chat that doesn't exist — the phantom-row guard). **NOT
    `pinned`, and NOT `POST /pin`: both are TAKEN** by the pinned
    *deliverable* — the link/film row at the top of a thread — which stores
    an OBJECT there. Express takes the first match, so a route called `pin`
    would shadow it and a field called `pinned` would collide with a value of
    a completely different shape.
  - **ONLY THE HEAD TURNS RED, which is why the glyph is TWO SHAPES.** Half
    of one path cannot take a different colour, so `PIN_SVG` is a `<circle>`
    (the head, `.pinhead`) over a `<path>` (the straight spike, starting
    exactly at cy+r). Two things to leave alone: **the head is STROKED in
    both states** and only *fills* when set — fill-only was tried and the
    unpinned button read as a bare stick, because unlike the teardrop this
    glyph's outline is not its whole silhouette; and the spike is LONGER than
    the head is wide (10.6 vs 8.8), because at 15px a pin whose halves match
    reads as a magnifying glass.
  - `.pinbtn` is grey `--line` at rest and `--ink2` when set, with the head
    taking `--chg` as both fill and stroke: a grey spike under a red head
    reads as a disabled control. Kept out of `.bmk` for the usual reason.
  - **The control is `mkPinTop`, on the row** — `.pinbtn.pinrow`, beside the
    hide button, and on the TILE cover too (top-left, opposite the hide)
    because a control that works in one of the two views is a bug rather than
    restraint. It repaints with `renderHome`, not a local class flip: pinning
    MOVES the row, which is the whole point. It hides in select mode with the
    hide and the ✓.
  - **NO CIRCLE ON A LIST ROW, for either button** (Aug 2026, Sophie: "I
    don't want in a circle, can you take it out of the circle, and also
    there's a hide button next to it, can you take that out of the circle
    also"). The cream plate and its shadow exist to lift a control off a
    PHOTO; a row has no photo under it, so on a row they were two floating
    buttons in a list made of nothing but hairlines. **The de-plating is
    written `.crow`-scoped, never on the bare classes** — `.t-cover` sits on
    the chat's picture and must keep its plate, and a test asserts that the
    rule has not leaked there. Sizes are unchanged: 31px is the tap target
    and the plate was never what made it one; the glyphs go 14 → 16px now
    that there is no ring to fill.
  - **The row's hide is a CROSSED-OUT EYE, and that REVERSES an earlier call
    of hers.** The comment on `HD` used to read "deliberately NOT an eye
    (Sophie's call) — an eye says 'look at this'", paired with a ⊖/⊕ that
    said what happens to the row. She asked for the eye instead: "can you
    make it an eye that's crossed out" — the same glyph she had already asked
    for in the thread header. **In BOTH states**, note: this ask carried no
    condition, unlike the header's "an eye that's crossed out IF it's
    hidden". So one glyph, and the STATE is the colour — `--ink2` while the
    chat is on the list, red once it is parked, which is her own rule for
    that glyph in the header ("the hidden icon should also not be red until I
    click it") and avoids a wall of red about chats with nothing wrong with
    them. `UNHD` is deleted; `HD` survives only as the hidden BAR's label,
    where the word "Hidden" sits beside it.
  - **There is NO separate pin mark at the front of the row.** One shipped
    and was removed the same day the control moved: a lit control already
    says the chat is pinned, and the mark was showing the same state twice.
    The star and the bookmark stay marks because they have no row control.
  - Tests: `node scripts/test-chats-pin-top.js` (the real page, headless —
    the sort tier including the just-came-back-from-hiding case, the control
    on the row and NOT in the header, no doubled mark, both POSTs, the row
    actually moving, the roll-back on a failed save, a hit-test, the spike
    being a straight line rather than an arc, and the COMPUTED fills proving
    the head is red while the spike is not). Verified failing with the sort
    tier removed.

  **ORGANIZE — filing and tagging from inside a chat (Aug 2026, Sophie: "an
  ability to tag or categorize something from within the chat itself, for
  example I want to be able to tag it as come back to or tech or something
  like that, so maybe just an icon that says organize and then it pulls up the
  ability to tag and categorize which is already on the front page but so far
  it doesn't work within there").** `.orgbtn` in `#thread header .no`, wearing
  Lucide `tag` (`TAG_SVG`), opening `askOrganize`.
  - **Both halves existed and neither was reachable from a thread.** FOLDERS
    were home-screen-only and behind Select — pick rows, then the bar files
    them, which is a round trip out of the chat she is reading and back. TAGS
    only ever appeared on the way past, inside the archive sheet, so a chat
    she was *not* archiving could not be tagged at all.
  - **It shipped as two labelled sections and is ONE ROW OF CHIPS now** (Aug
    2026 — the merge above). FOLDER (exactly one per chat) over TAGS (many, a
    fixed ten words) needed labels because an unlabelled wall of identical
    chips gives no clue which tap is which; with one kind of word there is
    nothing to tell apart, so `.orggrp` went unused (kept in the CSS, with the
    rule: bring it back the moment a second kind of chip lands in that sheet).
    Every chip toggles, several can be lit, and the New… box makes a word that
    did not exist.
  - **Tapping a word a chat already carries takes it off** — one control,
    both directions, like every other toggle on this screen.
  - **The `filedAt` stamp is written client-side here too**, copied from
    `filePicked` and not left to the server's own: without it a chat with an
    unread reply files itself and reappears on the same repaint (`chatBack`),
    which reads as filing doing nothing.
  - **Everything saves on the tap**, like the archive sheet — no OK button to
    miss, and closing can never lose a choice. Done just shuts it and
    repaints the home list, because a filed chat has left the unfiled pile.
    The toast names the folder for the same reason: otherwise picking one
    looks like the chat vanished.
  - The pin used to sit in this slot, which is why the header row is still
    six controls wide after the swap.

  **THE SELECT BAR IS PINNED TO THE TOP (Aug 2026, Sophie: "when I am
  selecting things to change their category right now the selection is at the
  bottom instead — can you pin it to the top. It only shows when I'm actively
  in selected mode by the way").**
  - `.selbar` is `top:0` with a bottom border and a downward shadow. It only
    exists while she is picking, so covering the masthead for the duration is
    the point, not a cost.
  - **The room it needs is measured, not guessed** — `paintSelBar` sets
    `document.body.style.paddingTop` from the bar's real `offsetHeight`,
    because the chips wrap and a long folder list makes the bar taller. It
    goes on BODY, not on `#grid`: the masthead sits above the grid, so
    padding the grid alone would leave the masthead under the bar and open a
    gap below it. `exitSelect` and the not-selecting branch of `paintSelBar`
    both clear it.
  - **Moving it up put it in the autoscroll pill's corner, and the fix is to
    HIDE THE PILL** (`body.selecting > .float`), not to reserve 56px the way
    the tab rows do. Two reasons: a reserve would cost a chip's width on the
    row that has the most chips, and `.float` is layer-promoted
    (`translateZ`), which iOS can paint ABOVE the bar whatever the z-index
    says — the same trap the `body.ontop > .float` rule already exists for.


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

- **ONE ACCOUNT AT A TIME — the 1 · 2 · 3 tabs (Aug 2026, Sophie:
  "look at the Secretly a Witch app and see the pattern for where it says
  reviews versus description, then follow that same pattern for account 1 and
  account 2 so that on the main page of the chats app I can only see one
  account at a time").** `.acctabs` in chats.html, a verbatim port of the
  witch shop sheet's `.ps-tabs`: NO boxes — equal-width labels over a
  hairline with a line under the one she is reading that SLIDES when she taps
  another.
  - **A THIRD ACCOUNT ARRIVED AND THE TABS ARE BARE DIGITS NOW (Aug 2026,
    Sophie: "can you make account three as another toggle tab … and maybe just
    call them 1 2 3 with the numbers rather than account so it fits").** Four
    tabs across a 390pt phone leave ~97px each and "Account 3" plus a
    two-digit badge does not sit in that. The word is not lost — it is the
    tab's `aria-label`, and the switch on the title line is the other half of
    the sentence. **The tabs are built from `ACCOUNTS`** and the sliding line
    measures the lit tab, so a fourth account costs no layout at all.
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
    abspos child measures the PADDING box. The test hit-tests every tab at
    375/390/430 rather than trusting any of that.
  - **A gray line closes the hidden block off** from the chats under it
    (`.hbsep`, her ask). It follows the whole block — the bar when the pile
    is shut, the pile's last row when it is open — and that last row drops
    its own border so the two never stack into a double line.
  - **A tab is not a chip.** A category chip narrows a pile; this SPLITS the
    screen, so it has to be a labelled tab that says which part she is in —
    144 of 200 chats are on account 1 (measured 2026-08-10), and a silent
    filter would read as the rest having vanished.
  - **An UNTAGGED chat shows on EVERY tab.** Only 2 of 200 carry no account,
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
  - **TWO DOORS ABOVE THE TABS — UPDATE and REVIEW (Aug 2026, Sophie: "a
    couple days ago we added a what's new button to the main screen, but I
    wanted it to go on the update screen — could you rename it Update, no
    icon, and put it on the update screen", then "the update and also the
    review button that you probably copied are both supposed to be smaller
    and they're supposed to go above the chats").** `#nwdoors`, filled by
    `paintNewsDoors`: two `.catchip`-sized buttons on one short line between
    the search row and the account tabs. **Update** opens `/brief` — the five
    things worth knowing across every chat at once, the same question this
    tab asks and a different answer to it; **Review** opens `/review` and its
    ⌄ drops that pile's cards into the top of the list.
    - **They are CHROME, not list.** Both shipped as full-width slabs at the
      top of `#grid` — 92px before the first card — and she asked for them
      smaller and above the chats. Now `renderNews` paints the doors and
      leaves only the review cards in the grid, and `paintHomeChrome` empties
      `#nwdoors` on every other view (renderNews is the only thing that ever
      fills it). Measured at 390pt: 26px, and the first card 66px higher.
    - **Update is painted on EVERY pass, the caught-up screen included**, so
      `newsEmptyCheck` takes the review count as an ARGUMENT rather than
      looking for a `.nwrev` in the grid — the door it used to find is not in
      there any more, and a tab holding nothing but review chats must not say
      "you're all caught up" under a chip saying two are waiting.
    - **No count on Update.** A badge would mean reading the brief every time
      this tab paints, and the number would be the only stale thing on the
      screen — the same reasoning that kept it off the home button. Review
      carries one because its pile is already counted in hand.
    - **Rose is Review's alone**: on this screen rose means something is owed,
      and the brief never is.
    - The page keeps the last answer on the phone and re-reads only on its
      own **Refresh** ("rather than immediately doing another API read, I'd
      like to be able to go back and forth"), so walking in and out of it
      while triaging this tab costs nothing. Full rules in `CLAUDE.md` (THE
      UPDATE BUTTON). Tests: `node scripts/test-chats-update-row.js` and
      `node scripts/test-tag-rules.js`.
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
  - **WHICH PAGES A CARD SHOWS — v4: THE NEWEST ONE, full stop (Aug 2026,
    Sophie: "I only want the newest compare page or whatever they posted on
    that turn").** `freshPages` in chats.html, and it is now one filter with
    NO title parsing:
    1. **NEWER THAN THE FLOOR.** The ✓ she taps — or her own reply — IS the
       superseded marker ("I have seen the state of this chat as of now"), so
       a page older than that mark never comes back whatever its title says.
       This is what kills "Cutting blocks (s96) — moved from the Evan chat",
       the page with no version number that beat the v1 rule twice: it was
       never a version question, it was an old-news question.
    2. **…then the newest survivor**, and only it.
    **v3's `pageFamily` title parser is DELETED, and that is the win.** v3
    kept up to two and collapsed versions by reading WHERE the version sat in
    the title (head vs subtitle) — real machinery with real tests, and the one
    half of this that a title could trick. With one page shown there is
    nothing left for it to decide: the newest wins whether or not it is a new
    cut of the same thing.
    **This reverses her own v3 correction** ("wait, if they give me a
    different page, why would I want it to not be shown?") — she asked for it
    directly after living with both. So two different pages inside one
    unchecked stretch now show as the newer alone. Nothing is hidden from the
    CHAT: the Compare tab still holds every page; this is only what the
    notification carries. The rule has gone v2 → v3 → v4; the parser is in git
    history (PR #1182) if a fifth turn ever wants it back.
    One page per card. **The PICTURES are deliberately not floor-filtered** —
    she asked for "the last three pictures… to be easily reminded what
    they're doing", which is context, and a row of one picture with two
    blanks is worse at that job.
  - **WHAT COUNTS AS NEW is the newest of three arrivals** — a FINISHED
    reply that isn't hers, a Compare page, an image — because **a chat can
    deliver without saying anything**, and a feed keyed on messages alone
    would miss exactly the picture batches she asked to see. Cards sort by
    that arrival, not by the chat's last message — **so a card whose page is
    replaced by a newer version JUMPS TO THE TOP** rather than holding its
    old place (Sophie asked, Aug 2026: "does it go to the top or stay where
    it was"). The card is one per chat and updates in place; a chat can
    never stack up two.
    - **A STILL-WRITING DRAFT IS NOT AN ARRIVAL (Aug 2026, Sophie: "the
      update tab seems to give me an update before the turn is even
      done").** A card used to land at the chat's FIRST TOOL CALL — the
      hook's live-draft post is a non-Sophie message, and nothing here
      checked `working` — carrying last turn's ⌄ and a timestamp about
      something she couldn't read yet. The widget and the push both already
      skipped drafts; `newsItems` now agrees: the reply that counts is the
      newest FINISHED one (`lastFin`), so an unchecked reply from an earlier
      turn still holds its card while a new turn runs on top of it, and the
      ⌄ fallback reads `lastFin` too — never half a sentence. **Pictures and
      pages still count the moment they land, mid-turn included** — her call,
      asked directly: "if they finished making something or made images but
      their turn isn't done I kind of want to preserve that" — because a
      filed image is done even when the reply around it isn't. Tests:
      `node scripts/test-chats-news-drafts.js` (the real page, headless;
      verified failing on every point against the pre-change page).
  - **THE MAIN LIST PAINTS AS THREE SECTIONS (Aug 2026, Sophie: "the update
    tab is not working as I'd hoped because it became unmanageable. There's
    like so many things there — a possible fix is to sort it into deliverables
    and things that need to be read and things that just need quick
    decisions").** Measured the day she asked (2026-08-19): 33 cards on the
    main list — 24 carrying an open `need`, 9 reply-only, 0 with a fresh
    deliverable at that moment. One undifferentiated pile, and the asks were
    drowning everything else — the same shape the brief measured (24 of 33)
    when it reserved a slot for something to LOOK at.
    - **DELIVERABLES · TO READ · QUICK DECISIONS, her spoken order, with the
      big ask pile LAST** so the few things to look at are never buried under
      two dozen asks. `.sthead` headers (the Status view's own), each carrying
      its count; an empty section shows NO header. Cards stay newest-first
      within a section, and the cards themselves are unchanged — ✓ picking,
      the boxes, the ⌄ all still work.
    - **`newsKind(it)` decides, exclusive, in priority order (v2, Aug 2026 —
      widened the day after it shipped, from her screenshot):** (1) a fresh
      deliverable — a Compare page newer than the floor, a picture newer than
      it, **or the chat's pinned FILM/AUDIO re-posted since it** (`newsPin`) →
      DELIVERABLES; (2) else **a `need` that tells her to go look at a thing**
      (`NEED_LOOK` — watch/listen/look/peek/open/install/play/tap/test/try/
      check/review, word-anchored) → DELIVERABLES; (3) else an open `need` →
      QUICK DECISIONS; (4) else → TO READ. **A deliverable outranks an open
      `need` on purpose**: when a chat hands her a thing AND asks about it,
      the thing is what she opens, and the ask still reads on the card's own
      status line — need-first would have filed 24 of 33 cards as asks and
      the deliverables would never have surfaced.
    - **v1'S RULE MADE A REAL CARD WRONG, AND THE PIN IS THE FIX (2026-08-19,
      Sophie: "why is this in the quick decision tab? It's obviously a
      deliverable. Tell me the rule that made it wrong").** v1's whole idea of
      a deliverable was Compare pages + gallery images. dream-app-commercial
      delivered a FILM: images 8:41 am → her ✓ 9:21 → "Dream commercial — v2"
      pinned 9:28 with need "watch v2, 45 sec" — invisible to v1, so the need
      filed it under Quick decisions. A film/audio pin re-posted since the
      floor is now an ARRIVAL in `newsItems` too (a chat can deliver a cut
      without saying anything — same rule pictures and pages already had). A
      `link` pin counts for nothing here: it is a bookmark, and Compare pages
      are already counted.
    - **Yes, `NEED_LOOK` reads words, which the v3 title parser died for —
      the stakes are different.** That parser decided what was HIDDEN; a miss
      here files a card one visible section over on the same screen. Her real
      needs the day this shipped: "watch v2, 45 sec", "listen through the
      37", "install build 165" — review tasks wearing a need's clothes.
    - **DERIVED, never filed** — no model call (the screen opens constantly
      and must spend nothing) and nothing new for chats to POST (only ~7%
      ever write a card, the same measurement that made the Questions list
      derived). The freshness test re-checks `created > floor` itself: the
      pictures ROW is deliberately not floor-filtered (context), so the row
      showing pictures says nothing about the card being a deliverable.
    - **An open BOX stays one flat list** — filing a card into Come back to /
      In a minute was the triage; sectioning inside would sort seven cards
      she already sorted.
    - **EACH SECTION FOLDS (Aug 2026, Sophie: "can y make the categories in
      the update [tab] collapsible").** The header IS the button — the whole
      line, ~36px of thumb, absorbed by negative margins so the words sit
      where they always did — with a ⌄ that turns to a › when it is shut. The
      one that needs it is QUICK DECISIONS: 24 of the 33 cards were asks the
      day the sections shipped, so folding it puts the two piles she opens
      this screen to LOOK at back on one screen without filing anything.
      - **The header and its count STAY**, so a folded section is visibly
        folded rather than missing. Nothing is marked seen and nothing is
        filed — this is a fold, not a triage.
      - **SESSION-ONLY, and every load starts OPEN** — the hidden pile's rule
        and the MORE fold's, for the same reason: a fold that remembered
        itself would hide a section one morning with no memory of having
        asked for it.
      - **Folding DROPS the picks inside it**, the way leaving the tab does. A
        picked card she can no longer see is one the next tap on a box would
        file without her, so the DONE chip goes with them.
      - An open BOX has no headers, so there is nothing to fold there.
    - Tests: `node scripts/test-chats-news-sections.js` (the real page,
      headless — the order, the counts, the need-vs-deliverable priority, the
      stale-pictures case, the vanishing empty header, the flat box; v2: the
      pin-raised card, the go-look need, the stale pin, the link pin) and
      `node scripts/test-chats-news-collapse.js` (the fold: the header as the
      tap target, one section folding without moving another, the picks
      dropped with it, session-only across a reload).
  - **MANUAL RULES PER TAG (Aug 2026, Sophie: "i think i'll have to do manual
    rules per tag … more coming").** Until now a word did one of two things and
    the APP decided which — a PILE word took a chat off the main list,
    everything else was decoration. Two of her words now say what should
    HAPPEN to a chat wearing them, and the mechanism is a TABLE (`TAG_RULES`
    in chats.html, `{label, rule, head}`) so the next rule she names is a row
    in it rather than another `if` buried in the render.
    - **`waiting for a response` → PINNED AT THE TOP** ("means i need a
      response and want it, so these get pinned at the top of the updates tab
      until i respond to the chat, or dismiss manually"). **The TAG IS THE
      ARRIVAL** — the card is on the tab whether or not anything new has
      landed, in its own section above all three of the kind sections. That is
      not a shortcut: a chat she owes an answer is usually one that said its
      piece days ago and went quiet, so waiting for the ordinary arrival test
      would show the pin only where it is not needed. `pinLive` is
      `filedAt > notifSeenAt` and nothing else — the tag written after the
      last time she settled the chat.
      - **AND THE CHAT WEARS A MARK, EVERYWHERE (2026-08-24, Sophie: "are
        there any extra instructions for if I tag a chat waiting for a
        response? Since I'm waiting for it I'd like a chat that's tagged like
        that to come with some extra indication").** The pin above was the
        whole of the rule, and a pin only exists on the Update tab — so on the
        home list, and inside the thread itself, a chat she was owed an answer
        from looked like every other chat, and the one screen that knew she
        was waiting was the one screen she had to already be on.
        `waitMarkHtml` is a Lucide **`watch`** — a wristwatch — in the marks'
        red (`--chg`), drawn at the front of the row beside the star and the
        bookmark — the slot this file already reserves for a state with no
        control of its own — and inside the thread's `<h1>`. One renderer, so
        the three row builders that share `starHtml` (the home list, the Status
        row and the Update card) cannot draw it three ways.
        - **THE ICON SHE ASKED FOR DOES NOT EXIST, AND THAT WAS MEASURED
          (2026-08-24, Sophie: "is there an icon of like someone pointing at
          their watch?").** All 2,035 Lucide glyphs were read: not one holds a
          human figure doing anything, because the gesture needs a body, an arm
          and a dial, and a line-icon set cannot say three things inside 14px.
          Two hand-drawn attempts in Lucide's own idiom (dot head, polyline
          legs) were rendered at 14 / 18 / 28 / 64px and both failed: mud at the
          mark's real size, and at 64px they read as someone holding a
          MAGNIFYING GLASS. So the watch alone carries it — the object out of
          her own picture, and legible where the mark actually lives. It
          shipped as an `hourglass` for one afternoon; don't drift it back, and
          don't try the figure again without rendering it at 14px first.
        - **IT FOLLOWS THE TAG, NOT THE CARD.** Her ✓ on the Update tab
          settles the CARD (`pinLive` goes out); the mark stays until the WORD
          comes off, which is the same rule the sibling tag's `Waiting for:`
          line has always followed. Two different questions — "have I dealt
          with this card" and "am I still waiting" — so they end at two
          different moments.
        - **IT READS `TAG_RULES`, NOT THE STRING** (`waitingReply` asks
          `tagRuleOf(name).rule === 'pin'`), so the mark and the pin can never
          disagree about which word means this. First-match ordering means a
          chat wearing both rule words still answers `pin`, which is the right
          answer here for the same reason it is right on the tab.
        - **IT IS A `<span>`.** A row is a `<button>`; a nested button is
          invalid markup and the tap would bubble into opening the chat. The
          word rides `title` + `aria-label` instead.
        - **`syncWaitMark` repaints the THREAD header**, which is built once
          in `openChat` — and the Organize sheet opens from inside that same
          thread, so without it the screen she is standing on is the last to
          know. The lists need no such thing: `saveLabels` mutates `chats`
          synchronously before its callers redraw.
        - **A chat CAN read its labels since 2026-08-27.** `GET
          /api/chatfeed/status` returns `labels` alongside her note, the
          status card and the pinned link (added for the bug-fix auto-archive
          and quick-question bell rules — see CLAUDE.md). Reading is the whole
          grant: filing stays hers and the auto-sorter's.
        - Test: `node scripts/test-chats-waiting-mark.js` (the real page,
          headless — verified failing 8 of 14 against the pre-fix page).
    - **`to be reviewed` → THE REVIEW ROW** ("movies that are done, images
      waiting on my decision, go into a `review` button (which links to the
      review queue) at the top of the updates tab, and get hidden from the
      account 1 or 2 area until i review or respond IF i dismiss manually from
      update tab"). Those cards come OUT of the sections and fold behind one
      row at the very top: the WORD leaves for `/review`, where the work is
      actually done, and a **⌄ opens the cards** — that half is required by
      her own condition, since "if i dismiss manually from update tab" needs
      them to be reachable from this tab at all. The fold starts shut, like
      every other fold here, and shutting it drops the picks inside.
    - **THE HOLD is the second half of the review rule.** Dismissing one of
      those cards writes `reviewHoldAt` beside `notifSeenAt`, and `chatBack`
      stops popping that chat onto her account lists when it delivers again —
      the thing is waiting in the QUEUE now, not on her chat list. **The
      SERVER decides who is held**, by re-reading the chat's labels inside
      `POST /notif-seen`: her phone can be running a build days old, and a
      chat missing from her list for a reason nothing on screen explains is
      the worst failure this app has. The page mirrors the stamp optimistically
      so the chat leaves on the same tap, and takes the server's answer over
      its own.
    - **It ends three ways, all of them hers, and none is a timer** — "until i
      review or respond": `POST /reply` clears it (she responded), `labelPatch`
      clears it with the tag (she took the word off — the same rule
      `waitingFor` follows), and `POST /page/:id/review` clears it when she
      marks a deck done or skipped in the queue (she reviewed it). That last
      one is why the join is cheap: the deck already posts to chatfeed, which
      already knows the page's chat.
    - **BOTH WORDS ARE HERS TO APPLY, and the sorter is forbidden from filing
      into either** — they joined `TRIAGE` in `chat-sort.js` beside `look at`
      and `come back to`. A folder guess costs a wrong pile; a rule guess pins
      a card she never asked for, or hides a chat she was watching.
    - **A pin she files into a box leaves the top**, because filing IS manual
      triage — it falls out of `newsList` already excluding boxed cards, and
      no rule was needed for it.
    - Test: `node scripts/test-tag-rules.js` (the real page, headless — the
      tag-as-arrival, the position, both exits, the row and its count, the
      fold, the hold with its control, and the two words pinned equal across
      chats.html / chatfeed.js / chat-sort.js).
  - **The ✓ is a self-clearing STAMP (`notifSeenAt`, `POST
    /api/chatfeed/notif-seen {chat, seen}`), never a boolean** — same shape as
    `hiddenAt`/`answeredAt`, and her oven example is why: checking off v3 must
    not silence v4, so the card is gone only while nothing newer has landed
    and the next version brings it back by itself. Nothing has to un-check
    anything. It is deliberately separate from `answeredAt` — "I know about
    this" is not "this chat is done".
  - **THE ✓ AND HER REPLY TAKE A CARD OFF THIS SCREEN — OPENING ONE NEVER
    DOES (Aug 2026, Sophie: "make the default behavior that it's pinned until
    I mark the checkmark and get rid of the pin", then, having lived with it:
    "we made it so that opening messages on the update tab doesn't get rid of
    the notification. Is it possible to make it so that if I actually replied
    to the message that does get rid of the notification").** `newsFloor` is
    `notifSeenAt` and nothing else. It used to be the LATER of that stamp and
    the per-device `seen` mark (localStorage, written when she opens a chat) —
    so reading a thread quietly cleared its card, and a PIN existed to opt one
    card out of that. Every card is kept by default now, so the pin is gone;
    `seen` still drives the unread dot and has no say here.
    - **HER REPLY WRITES THE SAME STAMP, server-side in `POST /reply`** — no
      new field, no new rule, and nothing for the page to do, because her
      reply arrives from the CLAUDE app with no page open anywhere (there is
      no reply box on `/chats`; the hook lifts her words out of the
      transcript). Opening a chat is dealing with it later; replying is
      having dealt with it, in her own words, which is exactly the line she
      drew. The stamp is `postedAt`, never her message's `created` — the same
      reason parking uses it.
    - **Because the floor is a STAMP, the answer she gets back is new news.**
      She replies → the card goes quiet → the chat answers → the reply is
      newer than the floor → the card returns carrying it. That is also the
      oven rule holding: answering the v5 chat cannot silence v6.
    - **`POST /working` must NOT write it, and that is deliberate.** The
      turn-start ping fires from UserPromptSubmit, and since hook v14 a turn
      started by a BACKGROUND EVENT (a wake event, a task notification) is
      still a turn — so machinery would clear cards she never saw. `/reply`
      is her words by definition (`from:'sophie'`, `her_words` in the hook).
      Parking still happens on both; only the notification stamp is hers
      alone.
    - A note typed inside a Compare page reaches `/reply` too and is
      REROUTED to the page's verdict doc before any registry write, so it
      clears nothing — a note on a picture is not an answer to the chat.
    - Tests: `node scripts/test-chats-news-reply.js` (drives the real routes;
      verified failing without the stamp).
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
  - **THE TWO BOXES — LATER and IN A MINUTE (Aug 2026, Sophie: "there's no
    categories on the updates page in that same style of those little boxes.
    I'd like to add two categories, one called IN A MINUTE for things I want
    to look at in a minute, but not quite this second, and then next to it on
    the left I want another category called LATER for things I want to look at
    maybe later today or this week. How I want to work is that I tap the item,
    it selects it with a thicker outline, and then I tap the category and
    that's how it gets filed in").** The chips row (`#catrow`) now stays on
    this screen and paints two boxes instead of the chat folders —
    **LATER on the left, IN A MINUTE beside it, her order.**
    - **A CLOSED SET.** No New… box, no star chip: she named the boxes, and a
      box she could type is a folder, which is what the other row already is.
      These file ONE UPDATE for a while; a category files a CHAT forever.
    - **MAYBE NEVER is the third box, and it shows only while she is picking**
      (Aug 2026, Sophie: "can you make one more option called maybe never, and
      this also only shows when I'm actively categorizing stuff") — the same
      rule DONE follows, so the resting row stays the two boxes she browses
      and never changes shape under a thumb reaching for one. It is therefore
      a filing TARGET with no filter of its own: a card put there is out of
      sight until the chat delivers something new, which pops it back onto the
      main list like any other filing. Flagged on delivery; if she wants to
      see inside it, the chip becomes a filter like the other two.
    - **`newsQueue` + `newsQueuedAt` on the registry**, written by `POST
      /api/chatfeed/news-queue { chats:[…], queue:'later'|'soon'|'' }` (the
      same skip-a-missing-doc guard `/archive-kind` has, so a typo can never
      plant a phantom chat).
    - **A card is in EXACTLY ONE PLACE — the main list or a box, never both.**
      That is the deliberate difference from a category chip, where a chat
      rejoins the list and stays in its folder (`chatBack`). A card is the
      newest thing a chat has handed her, so when something NEWER than
      `newsQueuedAt` lands it is new news again and comes back out of the box
      on its own. One place means the number on a box is exactly what she
      finds inside it, and she never deals with the same card twice.
    - **The tab badge counts the MAIN list only** — filing is triaging, and
      the boxes carry their own counts.
    - **TAP TO PICK, TAP A BOX TO FILE.** No select mode: on this screen the
      card itself is the pick target (`.nwcard.picked` — the border goes 2px
      in the filing green, with a pixel of padding given back so nothing
      jumps). Tapping a box with nothing picked OPENS it instead (tap the lit
      box to come back), and tapping the box a card is ALREADY in takes it
      back out — that is the way home, and it needs no third chip.
    - **A TAP ON THE CARD OPENS ITS CHAT, as it always did** — picking is the
      ✓ box and nothing else, so nothing on this card means two things. It
      went the other way for two builds and both were wrong: the card as the
      pick target left no thumb-sized way in ("I don't think there's a way to
      open the chat now cause clicking on it selects it"), and the openers
      tried in the meantime were worse — the NAME sits mid-row, so the
      natural tap at the card's centre landed on it, and the picture ICON is
      a 40px target for the commonest tap on the screen. The ⌄, the ✓, a page
      title and a thumbnail all stop the click and keep their own jobs.
    - **THE ✓ BOX PICKS, AND THE ROW PINS (Aug 2026, Sophie: "we need the
      buttons to become pinned to the top so I can click them — this could
      happen only when I select something. I think the best thing would be
      that I click the checkmark box to select it and then the buttons get
      pinned to the top, and we just add one more, DONE, and that clears it
      without putting it into a category — but the done button does not show
      up unless something is actively selected").**
      - The card's ✓ is the **select box** now: it lights, the card takes the
        thicker outline, and tapping it again lets go.
      - While anything is picked, `body.newspick` makes the whole tool row
        **sticky at the top** so the boxes are always in reach — sticky, not
        fixed, so the row keeps its place in the layout and nothing under it
        jumps as it pins. It needs the page's own background or the cards
        read through it.
      - **DONE** joins the boxes on that row *only* while something is
        picked, and it does what the ✓ used to do: `notifSeenAt`, no filing.
        So clearing a card is two taps now (✓ then DONE) — her design, and
        the reason the ✓ could stop being a one-tap delete on a screen where
        every other gesture is a selection.
      - **THE PINNED ROW WAS PAINTING OVER THE PILL, and the fix is the one
        select mode already uses (Aug 2026, Sophie, from a screenshot with
        one card picked: "something weird - covering the pill").** Sticky
        with `z-index:30` on the page's own paper, that row sits inside the
        autoscroll pill's fixed band (y 14-192), so it covered the pill's
        fill and its glyphs and left her looking at an empty outline.
        `body.newspick > .float{display:none}` — `display`, not a z-index,
        because `.float` is promoted to its own layer (translateZ) and iOS
        composites it above regardless, which is the same reason
        `body.selecting` and `body.ontop` hide it rather than re-stack it.
        `sizePillNotch` reads the same thing from the other end: **no pill on
        screen, no corner reserved**, so the row gets its last 64px back —
        and `paintNewsChips` re-measures it, because DONE and the tag icon
        come and go with the selection.
      - **THE TAG ICON — ANY word on everything picked (Aug 2026, Sophie:
        "add the tag icon to allow me to put any tag on a selected chat — add
        it next to done, it only shows if something is selected").** The
        three boxes beside it file into the update QUEUE (Come back to · In a
        minute · Maybe never), which is a different question from what a chat
        IS; this opens her whole vocabulary. It is a `.catchip` and not an
        `.iconbtn` on purpose — it lives in the chips' flow, wraps with them,
        and reads as the third thing she can do with a picked card. Glyph
        only, the same luggage tag the thread header's Organize button wears.
        - The sheet (`askTagPicked`) shares **`paintVocabChips`** (so the two
          groups and the line between them are the same everywhere) and
          **`saveLabels`** (the one writer, optimistic with the roll-back), so
          it can never disagree with the Organize sheet.
        - **A chip is lit only when EVERY picked chat carries the word**, and
          that is what lets one control do both directions honestly: lit means
          all of them have it, so the tap takes it off all of them; unlit —
          including the half-and-half case — ADDS it to the ones missing it.
          `add`/`remove` are per-chat edits, so a chat keeps its other words.
        - **The picking survives the sheet** — a second word on the same cards
          is one more tap, and clearing them is DONE's job, not this one's.
        - **`waiting for something` does NOT open its what-is-it-waiting-for
          box here.** That answer is per chat, and asking it six times for one
          tap is worse than the prompt each row already carries.
      - Tests: `node scripts/test-chats-news-queue.js` covers the pin, the
        DONE-only-while-picked rule, and DONE clearing without filing.
        `test-chats-news.js` / `test-chats-news-sticky.js` were updated to
        the two-tap clear. `node scripts/test-chats-news-tag.js` covers the
        pill (asked with `elementFromPoint` at its own centre — "is it
        visible" answers yes for an element with something painted on top of
        it, which is the whole bug), the notch, and the tag sheet's add /
        remove; verified failing against the pre-fix page.
    - Tests: `node scripts/test-chats-news-queue.js`.

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
  - **ONE CONTROL PER ACTION — the ✕ LEAVES, the glass starts a NEW search
    (Aug 2026, Sophie: "once I press the X on the search I think the search
    bar should just disappear so it's one tap to get out of search, but it
    has to be intentional as opposed to be for where it was automatic … there
    could be another button to clear the text and write new text").** The ✕
    used to do both jobs in sequence — clear on the first tap, close on the
    second — so leaving a search she could still see cost two taps and the
    first read as "it ate my words".
    - **✕ (right): leave.** One tap, words or no words. The query is thrown
      away with it, so reopening is always a fresh box.
    - **Glass (left): a new search.** It STAYS beside the open bar now (it
      used to hide) and empties the box with the keyboard still up — the
      same button, in the same place, that opened the search in the first
      place, so "tap the glass to search" reads the same whether one is
      already running. No new glyph was invented for this.
    - It costs the box 38px of width. Measured 2026-08-15: **208px at 375,
      221px at 390** (her iPhone 13), against ~246/259 before —
      `test-chats-search-archive.js` A3b pins it at ≥200 so a future control
      in that row can't quietly squeeze the field to a slot.
  - **The row reserves the pill's corner AND lays the ✕ out as a real flex
    child** rather than the absolutely-positioned overlay `.qclear` is
    elsewhere. Both halves are load-bearing: an abspos `right:5px` resolves
    against the PADDING box, so the reserve alone leaves the ✕ exactly where
    it was — measured at 390, under the pill's own down-arrow, which ate the
    tap. (That was already true of the old always-open bar; it only became
    load-bearing when the ✕ became the way to close.)
  - Session-only, always starting SHUT, and `goHome()` folds an EMPTY bar —
    leaving a chat lands on a clean list. `window.__setSearchOpen(bool)`
    drives it in tests. Tests: `node scripts/test-chats-search-archive.js`.
  - **A LIVE SEARCH SURVIVES THE BACK CHEVRON (Aug 2026, Sophie: "when I
    search something and then I click on one of the options if it's not the
    one I want when I go back I want that to still be active so that search
    is still on the search bar rather than clearing automatically").** A
    search is a list she is WORKING THROUGH — opening a hit is trying one of
    them, not finishing — so backing out lands her on the same results, same
    words, ready for the next row. She dictates her queries, so retyping one
    to get back to result #3 was the real cost. Result rows therefore no
    longer call `_resetSearch()` on the way in, and `goHome()` restores the
    results over the grid (`window._searchLive` / `_searchRepaint`, called
    AFTER `renderHome`, which repaints the account tabs the results had
    folded away).
    - **The ways out that END with that chat still clear it** —
      `goHome(true)` from archive, hide and delete, because each changes the
      list underneath the results and a row pointing at a chat she just put
      away is worse than an empty bar.
    - `#back` is wired as `function(){ goHome(); }`, never `goHome` itself:
      passed straight to `onclick` the click Event arrives as `dropSearch`
      and every back-out throws the search away.
    - Tests: `node scripts/test-chats-search-persist.js` (verified failing
      against the old page — it named all five symptoms).

- **THE SEARCH FILTERS — opt in, three-way, and the row the next ones join
  (Aug 2026).** Her asks in order: *"add some filters to the search in the
  chats thing that are optional … my messages versus Claude's messages"* →
  *"now: make the filters opt in"* → *"for things with three options, it shud
  be a three way toggle"* → *"another filter to add can be archived as in does
  it search the archive or not or just the archive"*. The headline rules live
  in CLAUDE.md (*THE SEARCH FILTERS*); what belongs here is the wiring and the
  mistakes it is shaped around.
  - **ONE builder, both boxes** — `buildFilters(mount, keys, onChange)` over
    the `FILTERS` table in `chats.html`. The home bar passes `['who','arch']`,
    a thread passes `['who']`. Two hand-written copies is precisely what
    happened to the toggle's own CSS across three files before it moved into
    `/tritoggle.css`, so there is deliberately no second copy of this either.
    The next filter is a row in `FILTERS`: its values, its words, and the
    query-string `param` kept together, so nothing can send a filter under a
    name the server does not read. **Nothing counts the notches** — the stops
    come from `vals`.
  - **`.searchfilters` is shown by its SIBLING'S state, never its own** —
    `.searchrow.on ~ .searchfilters` on the home screen, `.msgsearch.open ~
    .msgfilters` in a thread. So it inherits `paintSearch` for free, including
    the to-do view where the whole bar hides because that list is not chats,
    and no second predicate can ever disagree with the first about whether a
    search is open. A general sibling (`~`, not `+`) so a row landing between
    the two later cannot silently take the filters off screen.
  - **The drawer declares `display:flex`, so `[hidden]` needs the
    `!important` override** — the house rule, and it is not optional here.
  - **It keeps the search row's 56px pill reserve.** The injected autoscroll
    pill is fixed over x 326-374 / y 14-192 at 390pt and this row sits inside
    that band. The test measures the controls' real right edge rather than
    asking `isVisible()`, which is true either way.
  - **The home request is captured WITH its filters and checked again on the
    way back** (`filt.stamp()` beside the existing `qi.value !== q` guard):
    moving a toggle while a wider request is still in the air would otherwise
    let the older answer land on top of the narrow one. The two guards are the
    same bug at two speeds.
  - **The thread's `mrows` carry `who` as their own field**, derived once at
    render (`m.from === 'sophie' ? 'me' : 'claude'`), not re-read off the
    haystack — the haystack already ENDS with those words for the typed
    search's sake, so matching on it would make searching for the literal word
    "claude" behave like the filter.
  - **`applyMsgFilter` narrows on `q || mfilt.narrowed()`**, which is what
    lets the toggle answer with an empty box — and is also what keeps the
    chapter headings hidden in that case, since a heading labels a block that
    is mostly gone either way.
  - **`pickNameRows` is a pure export** so the three-row cap and its ordering
    can be tested without Firestore. It obeys the ARCHIVE filter and is
    skipped entirely when a WHO side is picked.
  - The tests' way in: `window.__setSearchFilter({who,arch})` on the home bar.

- **TWO WORDS MEAN THE SAME MESSAGE — the boxes speak a small boolean grammar
  (Aug 2026, Sophie: "sometimes I want to narrow it down by finding two words
  I know were in the same message but aren't in any other message but one of
  the words might appear tons of times").** Every box used to search the whole
  field as ONE literal string, so that search — the only way to answer her
  question — returned nothing at all.
  - `witch keywords` = **both**, anywhere in the one message, any order ·
    `witch OR spell` = either · `witch -blog` excludes · `"book of shadows"`
    is the phrase, adjacent (the old behaviour, still one keystroke away).
    OR binds tighter than the implicit AND. **No parentheses**, deliberately:
    a search bar on a phone is not a place to balance brackets.
  - **Parsed in ONE place — `search-grammar.js`** — which the Chunking clip
    library already spoke and now shares, so there is one grammar in the app
    rather than two that drift. **Matching stays per-caller and that is not
    duplication:** the clip library normalises to lowercase alphanumerics
    (punctuation should never decide a hit across a few hundred short
    records), while the feed anchors each term at a word START against raw
    text — so "aries" still doesn't find "boundaries", and `gpt-image-2`
    survives with its hyphens. A shared normaliser would have broken one of
    the two.
  - **The snippet opens on the RAREST word she typed**, not the first: with
    two words the common one is everywhere and shows her nothing — the rare
    one is what found this message.
  - All four boxes answer the same way (all chats, this chat's messages, this
    chat's images, the clip library). The home one asks the server
    (`GET /search`); the in-thread and Assets ones run `qparse`/`qmatch` in
    the page over rows already loaded.
  - Tests: `node scripts/test-search-grammar.js` (the server matcher, pure —
    no Firestore, no browser) and `node scripts/test-chats-live-search.js`
    (the real page, headless).

- **THE BOXES SEARCH AS SHE DICTATES — never on the checkmark (Aug 2026,
  Sophie: "can you change it so that it starts searching as soon as I type it
  in without having to press the checkmark").** Sophie never types, she talks
  into the field, and iOS dictation can hold its text in an input without ever
  firing `input` until she taps the ✓ that ends dictation — so an
  oninput-only box sat there doing nothing through a whole sentence while
  looking, to her, like a search that didn't work.
  - `liveInput(el, fn)` is the one wiring every box goes through: the events
    dictation DOES send are listened for, AND the value is polled while the
    field has focus (one string compare per 150ms, only while she is in the
    box), firing only on a real change. It cannot miss a way the text arrives,
    which is the point — the failure it replaces was silent.
  - **A programmatic clear must not fire as if she typed it**: the ✕ and
    `_resetSearch` call `.sync()` to re-baseline the remembered value.
  - The test dictates the way iOS does — sets `.value` and dispatches
    NOTHING — so an oninput-only regression fails it.

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

- **THE PINNED LINK — the row above the messages, and the *current* tag on it
  (Aug 2026, Sophie: "sometimes I'm constantly referring to a link to a page…
  I just wanna make that pattern more clear that chats have that option and
  make it the expected and common behavior for chats if a link is involved").**
  What every chat must DO about it lives in `CLAUDE.md` (*THE PINNED LINK*);
  this is how it is built.
  - **THE RULE OVERSHOT ON ITS FIRST DAY, and the correction is the load-
    bearing half.** It shipped reading "the expected and common behavior for
    chats if a link is involved", which chats took as *pin something*: within
    minutes one had pinned a GitHub markdown file and this chat had pinned
    `/chats` itself — neither of which she goes back to. Her correction
    (2026-08-15): *"not every chat deserves one, only the two cases I
    mentioned — if we're actively working on the page, or if they're actively
    giving me new versions of a movie"*, plus *"there might be other cases,
    but I'd like them to be run by me before they're made official."*
    - **Measured at the moment she pushed back: 8 pins across 275 chats** —
      so the sprawl was caught early, not after it filled her app. Of those 8,
      the qualifying ones were `/chunking`, `/fruit`, a Compare page, and two
      chats sharing the Evan film; the ones that read as clutter were a repo
      doc link and `/chats` itself.
    - **An empty pin row is the correct, common state.** Anything that makes
      "no pin" feel like a missing step is the bug — the honest default here
      is the same shape as an empty `need` on a status card.
    - **A new case is HERS to approve.** A chat that thinks it has a third
      case describes it in the reply and waits; it does not pin and see
      whether she objects.
  - **One field on the registry doc** (`pinned:{url,title,kind,at,turns}`), so
    it rides the feed's already-cached read and costs the app no request.
    Written by `POST /pin`, cleared with an empty url, read back on
    `GET /status`. The row is a sibling of the thread header, drawn in
    `openChat`.
  - **It started as the pinned DELIVERABLE — a film with a play button** ("a
    play button at the top, just the title, and when I press play it opens
    full screen"), and `kind:'link'` was added when she asked for a PAGE up
    there. The two are one pattern now: same row, same field, a link glyph and
    `window.open` instead of the triangle and the full-screen `<video>`.
  - **A MISSING `kind` IS READ OFF THE URL** (`pinKind`). The old fallback was
    `video`, which was right while only films were pinned and wrong the moment
    pages became the common case — a page dropped into a `<video>` renders a
    black box that never loads, i.e. the failure looks like a broken pin
    rather than a missing argument. An explicit `kind` still wins, so nothing
    pinned the old way moved.
  - **THE TAG COUNTS TURNS, NOT MINUTES** ("it only says that if the chat
    updated the last turn that they finished"). `pinBump` increments
    `pinned.turns` on every FINISHED reply — never a draft — and the tag shows
    while the count is ≤ 1: **0** = the turn that pinned it is still running,
    **1** = that turn has ended and is the chat's most recent one. Both mean
    the last finished turn updated the pin. At 2 the chat has finished a turn
    that left it alone and the tag goes out; the count then stops moving, so
    the reply post isn't rewriting the registry doc for the rest of the chat's
    life.
    - **Why not compare timestamps.** A turn's `created` is the first DRAFT's
      time in a hook-equipped session and the FINAL post's time without one,
      so any `pin.at`-vs-message-time rule is wrong for half the chats — the
      same population trap this file's case study is about. A counter the
      server owns is exact for both, and needs nothing from the hook.
    - **A pin with no `turns` at all** (written before this shipped) gets NO
      tag rather than a guessed one. It earns its count the next time its chat
      pins anything.
  - **The registry read moved ABOVE the reply's own registry write** in the
    POST handler — `regRef()` drops the cache, so reading after it would force
    a fresh ~200-doc collection read on every reply. The push title now reuses
    that same read instead of taking a second one.
  - **The tag is letter-spaced sans in rose, not a chip** — a chip here would
    be a pill, and it is a state, not a control.
  - Tests: `node scripts/test-pin-current.js` (`pinKind` + `pinBump` lifted out
    of `chatfeed.js`, plus `pinCurrent` lifted out of the page so the two sides
    can't drift) and `node scripts/test-chats-pin.js` (the real page, headless:
    the row renders, is tappable where it is drawn, a link pin opens instead of
    embedding, the tag shows on a fresh pin and stays off a stale one and off
    an uncounted one — verified failing without the feature).
  - **TAP-TO-NOTE on a pinned FILM (Aug 2026, Sophie: "I watch the video but I
    can tap it and then the video pauses and a field comes up where I can
    write a note … because this could be reusable not just for this").** Built
    INTO the full-screen player (`openPinned`), so every chat that pins a film
    gets it with zero setup — that is the reusable half of her ask.
    - **A floating NOTE button, never a capture layer (her rework, the same
      day, after first real use: "even pressing play on the video triggers the
      note thing").** v1 covered the picture with a tap layer and it swallowed
      the native play button. Now nothing sits over the video: touching the
      screen shows a floating Note button that fades after ~3.5s or on a
      second touch — the native controls' own rhythm, her explicit design
      ("just like the pause works"). She offered a review-mode alternative
      (a toggle after which every tap pauses); the button was chosen because
      it leaves the player stateless and play/scrub untouched.
    - **The mic is the DEFAULT** ("rather than sliding up immediately to type
      a note, I would prefer if the default was triggering the microphone …
      so I can just talk"). Tapping Note pauses the film and starts recording
      immediately; the sheet shows "Note at 0:41" and a Done button. ONE Done
      stops the mic, resumes the video AT ONCE, and files the note in the
      background — upload + transcribe first (`POST /api/gallery/assets/
      note-voice` with `hold:true`, gpt-4o-mini-transcribe — mechanical
      extraction), then the text route files `[0:41] words (voice: url)`.
    - **Tapping the TEXT BOX is the edit path** — it stops the mic, puts the
      transcript in the box, and only then does the keyboard rise ("I also
      have the option of clicking into the text box … at this point, the
      keyboard does slide up"). Done then files her edited words, still
      carrying the voice url. No mic available → the box is the whole flow.
    - **Notes land on the FILM's own url thread** via the asset-note machinery
      (`POST /api/gallery/assets/note`, from `sophie`) — the same
      `forge-asset-votes` docs the picture notes use, so a chat's normal sweep
      (`GET /api/gallery/assets/notes?chat=`) finds film notes with no new
      reader, and answers ON the note exactly like an image note. Every note
      leads with the `[m:ss]` video position — "towards the beginning"
      arrives as a timestamp.
    - **Cancel (or Done with nothing said and nothing typed) just resumes** —
      no note, no error. Films only: an audio pin draws no Note button.
    - Test: `node scripts/test-chats-film-note.js` (the real page, headless,
      mic faked — the button follows the controls' rhythm and never raises
      the sheet from a video tap, mic-first Done resumes immediately and
      files hold-then-text, the box edit path, Cancel, films-only).
