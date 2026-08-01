# Deck Factory — to-do list (Sophie's queue)

Items Sophie has asked to queue up but NOT build yet. When one gets picked
up, confirm the shape with her first if it says "research" or "shaping",
then build it and check it off here.

## Chats app

- [ ] **Tap-to-open needs two taps.** Tapping a message in the Chats app
  seems to CLOSE something first, and only a second tap actually opens it.
  Research why (start in `scripts/gen-chats.py` / `public/chats.html` —
  likely a first tap being consumed by collapsing an already-expanded
  tile, a hover/focus state in the WKWebView, or a tap handler calling
  `__scrollStop` and swallowing the event). Reported by Sophie Aug 2026.

- [ ] **Search should rank chat-NAME matches first.** When searching the
  chats, results whose chat name (displayName or slug) matches the query
  should sort above content matches, not mixed in with them.

- [ ] **Chats getting filed into each other — give chats a unique code.**
  Recurring: two different Claude sessions end up posting into ONE chat
  thread. Root cause to verify: the registry keys on the git-branch slug,
  and a REUSED branch name = the same slug — e.g. the Aug 2026 Story Room
  session's branch `claude/deck-factory-story-room-8xu91f` posted into
  the chat Sophie had renamed "Imprint" (originally a deck-factory-…
  chat with the same slug). Renaming never re-keys, so the collision is
  invisible until posts interleave. The generic-slug fix (July 2026)
  already appends 6 chars of session id to `new-session`/`untitled`
  slugs — consider extending that per-session tail to EVERY slug (or
  keying the registry on session id) so two sessions can never share a
  thread. Needs a migration story for existing chats' history.

## Share sheet

- [ ] **Research: share-sheet button for AUDIO (and images) → Firebase.**
  Sophie wants: in the Files app (e.g. voice memos saved out of videos),
  press Share → "Send to Deck Factory" → it uploads to Firebase. Today
  the `DumpShare` extension activates only for images/movies
  (`SupportsImageWithMaxCount` / `SupportsMovieWithMaxCount`), so audio
  never offers Deck Factory; the `/audio` page's file picker is the
  workaround. Likely shape: extend the extension's activation rule to
  audio/file types and route audio files to the existing
  `POST /api/audio/upload-file` (images keep going to the Dump). Needs a
  TestFlight build. Research effort + confirm before building; she's
  fine dropping it if it's genuinely hard.

## Story Room (the larger change — shaping, discuss UI with Sophie first)

- [ ] **Every story shows its latest draft FILM, auto-stitched.** Opening
  a story should show the most recent film draft, even a rough one: if
  only images exist, stitch them with ffmpeg (each beat's art in order,
  timed to the voiceover when there is one, plain slideshow when not).
  Plus all the thumbnails visible. Goal: UI-friendly at scale — there
  are getting to be tons of stories and browsing must stay easy.
  Missing piece: films (`forge-movies`) carry NO link to their story —
  a movie doc gets its own copy of the text, not a storyId. Add the
  link going forward + best-guess backfill by title/text match.
- [ ] **Take THE FILMS section off the Story Room home.** Several are
  dream experiments, not real story films. Move the grid behind a
  button — an archive of films / experiments — reachable but out of
  the way.
