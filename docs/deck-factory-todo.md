# Deck Factory — to-do list (Sophie's queue)

Items Sophie has asked to queue up but NOT build yet. When one gets picked
up, confirm the shape with her first if it says "research" or "shaping",
then build it and check it off here.

## Chats app

- [x] **Tap-to-open needs two taps.** (Done Aug 2026.) Cause: a thread
  rebuild — the full history landing ~1s after entering a chat, the
  New-message bar, an account change — wiped the `open` class off a
  just-tapped message, so it looked like it closed itself. `openChat`
  now carries open rows across rebuilds, matched by message id.

- [x] **Search should rank chat-NAME matches first.** (Done Aug 2026.)
  `/api/chatfeed/search` returns `chatMatches` (display name or slug
  contains the query) and the page pins them above message hits;
  message hits show the display name now too.

- [x] **Chats getting filed into each other — give chats a unique code.**
  (Done Aug 2026.) Confirmed cause: reused branch names → one slug for
  two sessions. The registry now records the owning session per slug;
  the hook resolves via `GET /api/chatfeed/resolve` (first session keeps
  the name, a different session forks to `<slug>-<sid6>`), the server
  re-resolves url-carrying posts from old hooks, and
  `POST /api/chatfeed/session` claims a slug for its original thread
  when untangling an existing collision (done for "Imprint").

- [x] **Compare-tab notes showed up as Sophie's chat messages.** (Done
  Aug 2026.) Two Compare pages wired their note boxes to
  `/api/chatfeed/reply`. The server now reroutes any /reply fired from
  inside a served page onto the page's verdict doc (sheet `page-<id>`)
  — notes stay in the Compare tab, the thread stays her real
  conversation, nothing she types is dropped. Rule added to CLAUDE.md.

## Share sheet

- [x] **Share-sheet button for AUDIO (and images) → Firebase.** (Built
  Aug 2026 — needs a TestFlight build to reach her phone.) `DumpShare`
  now activates for files too and routes audio extensions to
  `POST /api/audio/upload-file` (one date-stamped batch per share);
  images/clips keep going to the Dump. Trade-off: the generic file rule
  also surfaces "Send to Deck Factory" for non-media files, where the
  sheet just says "Nothing to dump".
- [x] **Share sheet is a true background job + Whisper toggle.** (Aug
  2026, Sophie's call — overriding the old no-App-Group caution.)
  Uploads go through a background URLSession (App Group
  `group.com.sageryza.imageforge`, files staged in the shared
  container), so the sheet dismisses immediately — no "keep this open"
  — for audio, images, and video alike. Audio shares get a "Transcribe
  the recordings" toggle → `?transcribe=1` → background Whisper onto
  the forge-audio doc; the `/audio` page shows the words under each
  recording.

## Story Room

- [x] **Every story shows its latest draft FILM, auto-stitched.** (Done
  Aug 2026.) THE FILM section on the story page: a linked real film
  (newest stitch + frames + "Cuts & rejected art") when one exists,
  else an ffmpeg draft cut from the beat art over the voiceover,
  auto-stitched on first open, restitchable when art changes.
  `POST /api/story/draft-film`; movies carry `storyId`
  (`scripts/link-films-to-stories.js` backfilled 5, run 2026-08-01).
- [x] **Take THE FILMS section off the Story Room home.** (Done Aug
  2026.) Unmatched films (dream experiments, tests) wait behind the
  home's Films button; the button only shows when any exist.

## Voice Memos

- [x] **ONE path into the Voice Memo library — always transcribed,
  never doubled, never lost.** (Sophie 2026-08-05; built same day.)
  Every entry point now funnels through `memos.fileIntoArchive()`:
  the Mac push (unchanged), the iOS share sheet / audio drop
  (`audio.js` auto-files every recording, transcription
  unconditional — the old toggle is ignored), Story Room voiceover
  pastes (recordings file too; TTS renders don't), and a chat's
  pasted recording (`POST /api/memos/ingest`, stamp now OPTIONAL —
  derived server-side, md5 guards). Dedupe is belt and braces:
  `hash` (md5 of bytes) on every record plus the wall-clock stamp;
  derived stamps never skip on stamp alone and carry a hash suffix
  in the id so two recordings in the same minute can't overwrite
  each other. Bank first, enrich after — a Whisper failure files the
  audio with `enrichError` instead of losing it. Backfill:
  `scripts/memo-unify-backfill.js` (phase A hashed the existing
  records from Storage md5 metadata; phase B merged `forge-audio`
  strays via the live server).

## Small things, parked on purpose (2026-08-24)

Sophie's ask, the day the three-way toggles stopped cycling: *"can you make a
list of things that I might want fixed in the future — small bugs that aren't
enough to fix right now because I don't even use the writing room right now,
just document it."* So: found and measured, none of them worth a turn today.
**Each one says what it costs her, because that is what decides whether it is
ever worth doing.** Anything here that turns out to bite, un-park it.

### The cycling controls that are NOT three-way toggles

Her rule, 2026-08-24: *"none of them should cycle — that's a really stupid
pattern … Cycling is a bad idea."* Every `.tri` obeys it now (`/tritoggle.js` —
a tap lands on the stop under her thumb). These three cycle and are **not**
toggle tracks, so each needs a shape she has not seen rather than a fix — which
is why they are here and not done.

- [ ] **Cutting Blocks — the `?` on every line** (`qNext` in `blocks.html`).
  Blank → locked in → not sure → blank. **Read the history before touching
  it:** this is already v2 of a cycle she critiqued ("if I tap it again it
  will just disappear" — the way back to normal ran THROUGH the vanishing
  state), which is why the ✕ was split onto its own button. Cost to her: from
  "not sure" the way back to blank is one more tap through nothing. A 78px
  track per line would not fit; a tap-to-pick popup would.
- [ ] **Cutting Blocks — the paragraph twist** (`cycle(sec)`, same file).
  Closed → prose → its lines → closed. A disclosure with three depths, so
  "cycling" is arguably what a twist IS. Cost to her: to close a paragraph
  she has opened to its lines, she taps forward, not back. Lowest of the
  three.
- [ ] **Writing Room — the status word on each date row** (`.r-status` in
  `writing.html` AND `scripts/gen-writing.py`, both, or the generator
  overwrites the page). Drafting → reviewing → approved → drafting. Cost to
  her: sending a row back from approved is two taps and passes through a
  wrong state that SAVES on the way (each step POSTs `/api/writing/status`),
  so a mis-tap is written down, not just displayed. **She said she is not
  using the Writing Room right now**, which is the whole reason this is
  parked — it is the worst of the three on paper.

### Left over from the toggle work

- [ ] **The account switcher's zones are 16px.** It aims now, on the shell's
  default 48px track (three stops, blank knob). The Playground's is 78px.
  If she starts landing on the wrong account, the fix is one line —
  `--tri-w: 78px` on that instance — optionally with `data-i` carrying the
  account NUMBER, which is what every other aimed instance does. Not done
  unasked because it is her header's title line and it currently fits.
- [ ] **A missing `/tritoggle.js` silently restores cycling.** Every page
  with a toggle carries `var triNext = window.triNext || <the old cycle>` as
  a floor for the file failing to load. Deliberate — a dead toggle is worse
  than a cycling one — but it means a 404 degrades to the exact behaviour she
  retired, with nothing on screen saying so. Only a stub harness or a broken
  deploy can cause it; `scripts/test-tritoggle-aim.js` pins that every page
  links the real file.

### Tests that are quietly not testing

- [ ] **`node scripts/test-chats-search-persist.js` is RED on main** (measured
  2026-08-24 against a clean tree, so it is nobody's new bug). It waits for
  `#thread .archlink.hide-r`, and hide MOVED into the Organize sheet as
  `.markchip.mk-eye` — `.archlink.hide-r` now exists only as a dead CSS rule
  at `chats.html:282`. It dies on a `waitForSelector` timeout, so **everything
  after that line is unverified**: that hiding, archiving and deleting a chat
  each clear the search box on the way out. Fix is the selector, plus deleting
  the orphan CSS rule.
- [ ] **`scripts/resync-gen-chats.py` still cannot run.** It looks for the
  pill blocks verbatim to turn them back into placeholders and finds zero
  ("expected exactly one `__PILL_CSS__` block, found 0"), because
  `chats.html`'s pill has drifted from `scripts/pill.py` by hand. Consequence,
  and it is the reason this matters: `chats.html` and `writing.html` are
  HAND-MAINTAINED until it is fixed — running `gen-chats.py` would overwrite
  the page from a stale template and drop ~300KB of shipped work. Already
  noted in CLAUDE.md; listed here because it is a real job nobody has taken.

- [ ] **`POST /api/chatfeed/wrapup` flattens a bulleted `long` with COMMAS**
  (found 2026-08-24 writing this chat's own wrap-up, which is how it went
  unnoticed — the model path is fine and almost nothing else posts one).
  CLAUDE.md documents `long` as an ARRAY that the route stores newline-joined,
  and `fillWrap` in `chats.html` splits on newlines to draw one bullet per
  line. But this route hands the value straight to `wrapTextOf`, which is
  `String(s)` — so an array arrives comma-joined and the long summary she opens
  months later is one run-on paragraph instead of the bullets she asked for.
  One line: join an array with `\n` before `wrapTextOf`. Workaround until
  then, and what this chat did: post `long` as a newline-joined STRING.

### Known duplication, already written up elsewhere

Not new findings — pointers, so they are on one list she can scan.

- [ ] **`/assets` (Meta Assets) is a third hand-copy of the lightbox.**
  `asset-lightbox.js` exists to end exactly that, and `assets.html` was never
  migrated because it grew extras the shared file has no hook for (the action
  icons, the origin line). Both lightbox bugs have now reached her there a
  second time. The real repair is an extras hook in the shared file and
  deleting the copy. Full story: *Opening an image freezes the page behind it*
  in CLAUDE.md.
