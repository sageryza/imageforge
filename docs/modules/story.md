# Story surfaces (Story Room, Scratch Pad, Writing Room)

Thinking with pictures, the story shelf, and the dating-book review loop.

*(Moved out of `CLAUDE.md` Aug 2026 — see the pointer there. Nothing was rewritten; this is the text as it stood.)*

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
**LISTEN ROWS — everything audio attached to a story, behind ONE waveform
button (Aug 2026, Sophie: the NDE montages "should be connected to their
stories so I can listen to them when I go to their story", then "a story can
hold multiple audios … hide them all behind a single icon that has a wave
form so I can click that button and see all the audios that are attached").**
The waveform on the title row opens a sheet holding TWO kinds in one list,
because from her side they are one thing — the audio on this story:
- **Episodes** cut from the story in the Episode Editor. `episodes:
  [episodeId, …]` (forge-editor ids), resolved to their NEWEST render live,
  so a re-render in the editor reaches the story with no re-link. Link with
  `POST /api/scratchpad/episode {pad, episodeId, remove?}`.
- **Source recordings** — the voice memos the story came OUT of. `sources:
  [{src, kind, title, date, seconds, url?}]`, identified by SEARCH INDEX id
  (`m:<id>` / `v:<id>` without the prefix), which is the id the Search page
  and the Cutting Room hand-off already speak. Attach with `POST
  /api/scratchpad/audio {pad, src, remove?}`; it validates the id against
  the index and stores the name/date/length it had then, so drawing the list
  costs no index read. **A memo's URL is built per request, never stored** —
  memo bytes are not public and the proxy carries the studio token, so a
  stored url would bake in a token that can change under it; an interview's
  audio IS public and its url is stored as-is.

Both arrive merged as `audios` on `GET /api/scratchpad/`, each row carrying
its `kind`. Rows share the page's ONE player (play · name · date · length),
so a tap replaces whatever is speaking and never stacks; **the sheet does not
stop the player on close**, so a recording she started keeps going while she
reads the beats it became. No audio attached → **no button at all**. Like
/category, neither route bumps updatedAt: connecting a recording that already
exists is not a story edit, so it must not stale the film or reshuffle the
shelf. Removing one is a chat call (`remove:true`) — there is no ✕ on the row
yet.
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
