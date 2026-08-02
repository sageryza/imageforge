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
