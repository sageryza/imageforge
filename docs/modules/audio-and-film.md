# Audio & film modules

Everything that makes or cuts moving pictures and sound: Movies, Songs, the Voice Memo library, Voice Studio, the audio drop, the Episode Editor, the Cutting Room, Search and Cut Marks — plus the YouTube uploader. The always-rules (her voice model, never loudnorming her voice, one cutter) stay in CLAUDE.md; the machinery lives here.

*(Moved out of `CLAUDE.md` Aug 2026 — see the pointer there. Nothing was rewritten; this is the text as it stood.)*

## Movies (the newest medium — iOS is the frontend)
- **Making one of Sophie's concept videos? Read
  `docs/movies/sophies-movie-pipeline.md` FIRST** — her own recorded
  instructions (Aug 2026): voiceover aligned via the NDE precise cutter,
  images in pastel variant V2 at 2:3 portrait, and her literal-image →
  metaphorical-image formula with animation between the two panels.
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
- **Style reference:** `refs/dream-mystery.jpg` (Sophie's hand-drawn diary-comic
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
  decide how many IMAGES the dream needs (1-6, never padded) and allots each
  image a verbatim slice of the dreamer's words in TRUE chronological order
  (drift cues fix the narration order); then `makeDreamPagesV2` draws
  sequentially — each page gets the style ref FIRST, then ONLY that slot's
  approved character cards (image refs; desc-only people ride as text
  continuity lines), then up to 3 already-drawn earlier pages
  (`dreamPageRefs` — a face is carried from the page it first appeared on),
  plus the whole dream for context and "THIS page tells ONLY this part".
  **The model decides each page's layout** (single drawing or panels — no
  fixed 2x2). Pages store `{url, promptUsed, text, captions, who, softened}` —
  **`text`/`captions` are what the picture ACTUALLY says**, so anything
  rendering captions from the doc matches the drawing; when the safety filter
  forced a rewording, **Sophie's own wording is kept beside them as
  `textOriginal`/`captionsOriginal`** (present ONLY on a softened page, so
  ordinary pages carry no redundant copy). The dream is a record of what she
  said — a content filter must never silently replace her sentence with a
  paraphrase, and `softened:true` alone couldn't tell you WHICH sentence
  changed. Plan kept on
  `dream.pagePlan`. ~$0.06/page medium. Legacy beat docs still render
  through the old `makeDreamPages` 2x2 path (`order:[beatId]` still
  honored). Own polled docs (`GET /dream`, `GET/DELETE /dream/:id`,
  `GET /dream-batch/:id` for the background read), background job on the
  doc, `pageHistory` capped 3, separate `forge-dreams` collection.
  **Render survives leaving the app:** fire-and-forget server job; iOS
  `DreamsView` records rendering ids in `@AppStorage("dreams.activeRenderIDs")`
  and resumes polling on return; transient poll failures retry (phone locked /
  Render cold start) — only a real job error surfaces.
  **A gpt-image-2 SAFETY REFUSAL is terminal, never a retry (Aug 2026).** The
  filter refuses ordinary dream content — the "Mommy Evaluates Kid" render died
  on a breastfeeding line, flagged `safety_violations=[sexual]`. A refusal is
  deterministic, so retrying it is waste: that render burned 9 API calls over
  ~65s of backoff and reported "3 rounds of retries", which reads like a network
  fault. Now `isSafetyRefusal()` short-circuits every retry ladder
  (`openaiPanel`, `openaiPanelEdit`, `drawPagesResilient`'s rounds), and the page
  gets redrawn with its NARRATIVE softened — `softenRefusedNarrative`
  (gpt-4o-mini) rewords only the page's slice of the dream, its captions and the
  context line, and the structural half of the prompt (style ref, continuity
  clauses, attachment numbering) is rebuilt untouched around it, so softening
  can't scramble the references. **Rewording Sophie's own sentences to get past
  the filter is allowed — she asked for it (2026-08-06).** A page that lands
  softened is marked `softened:true`. Softening escalates over TWO passes (pass 2
  rewrites pass 1's output), then gives up with a plain reason instead of a retry
  count. Refused requests are rejected before generation and cost nothing, so the
  extra pass only ever spends a few seconds.
  **`SOFTEN_SYSTEM` is empirically calibrated — don't reword it casually.**
  Probed live against the filter on the refused page (2026-08-06): `feed it milk
  from her breasts`, `breastfeed the baby` and even the VAGUER `feed it milk from
  her body` are all REFUSED; `nurse the baby`, `feed the baby` and `hold the baby
  close and feed it` are ACCEPTED. So being vaguer does not help and euphemism is
  the wrong move — the first version of the prompt said "rephrase only what is
  likely to trip it" and the model produced "from her body", which was refused
  again. The prompt now tells it to REFRAME THE ACTION in ordinary everyday
  verbs, with that worked example baked in; verified end-to-end (pass 1 →
  "Then she went to nurse the baby." → page drawn).
  Tests: `node scripts/test-dream-refusal.js`.
  **The page must not re-render while she scrolls.** `dreams.html` polls every
  3.2s during a render and used to call `render()` each tick, reassigning
  `root.innerHTML` — which re-decodes every image and drops scroll position.
  Scrolling "Past dreams" during a render therefore flickered and jumped to the
  top (her report, 2026-08-06; renderArchive's own comment already warned that
  rebuilding "re-decoded every image"). `liveUpdate()` now patches the status
  line and APPENDS newly-landed pages instead, and returns early when she's on
  the archive/zine tab so a background render never touches the view she's
  reading. Tests: `node scripts/test-dreams-scroll.js` (headless Chromium;
  playwright is an optionalDependency, the script skips without it). Characters keep their
  ORIGINAL backgrounds (the transparent cleanBox step was removed by request
  — background separation only matters if a character is composited later).
  Same `STUDIO_TOKEN` gate. iOS is the frontend; a web page port of the new
  flow is planned to follow the TestFlight build.

## Chunking (`clips.js`) — the clip library, searchable

Rebuilt from scratch 2026-08-15 (Sophie asked for a fresh take on the first
build). Page at `/chunking` (`/clips` is the honest alias), API at
`/api/clips`, iOS tile under the FILM filter. Collection
`forge-clip-library` (+ `forge-clip-library-meta` for the harvest job) in
deckfactory.

**What it is.** The shelf of every small, self-contained clip the studio has
made — the pieces films get cut from, never the films themselves — so a
re-cut with different emphasis reuses clips instead of re-paying for them.
It generates and stitches nothing and costs nothing. The page is a
Story-Room-style shelf: poster tiles four to a row, serif names underneath,
a search bar on top, kind chips (scenes · bridges · quick · shorts), and a
lightbox that plays the clip and edits its name/tags/note.

**A CHUNK is the unit Sophie named the tool for (Aug 2026):** a named,
tagged SECTION of a finished video — footage and voiceover together — that
she would reuse whole in a different video. Her examples: the Sheldrake
telepathy bridge inside the Evan video (reusable anywhere she talks about
telepathy); the manifestation trio — the chocolate bars, the cat, the third
thing she visualized at night (reusable in any witchcraft video about
manifestation); the shirt she imagined and saw the next day; the envelope in
El Salvador. Chunks are kind `chunk` on the same shelf, chip first. File one
with `POST /api/clips/chunk { url, start, end, title, vo?, tags?, from? }`
(or `node scripts/make-chunk.js --url … --start … --end … --title …`): the
doc is content-addressed by url+span (re-filing converges, a failed bake
retries safely) and the BAKE runs in the background on the chunk's own doc —
Admin-SDK download, accurate trim with 12ms audio edge fades (the cutmarks
recipe), poster, its own file under `clip-library/chunks/`. `vo` holds the
span's voiceover text and is searchable (`vo:telepathy`); the span cap is
600s — a chunk is a section, not the video. The harvest never touches
chunks, and PATCH lets her (or a chat) fix title/tags/note/vo/hidden with
the same her-edits-win protection.

**Two sources, one harvest** (`runHarvest` in `clips.js`; CLI
`node scripts/harvest-clips.js [--dry]`, server `POST /api/clips/harvest`
as a background job on the meta doc, polled by the page):

- **Firestore** — `forge-movies` scene clips, kept re-rolls
  (`clipHistory`) and dream bridges; `forge-quick` quick-animates. These
  carry their real titles and the generation PROMPT (the treasure — it is a
  searchable field and shows in the lightbox).
- **A Storage sweep** — the shorts chats built into their own prefixes
  (witch-shorts/, story-shorts/, hospital-film/, two-panel-gallery/ …).
  **The skip list is the load-bearing half** (`SKIP_PREFIXES`, measured
  2026-08-15 against 697 video files): the Dump (`drops/`), whole
  interviews (`nde-audio/`), finished episodes (`nde-episodes/`), the
  movies pipeline's own storage (`movies/` — the Firestore half covers it
  with better metadata), the pad's still-encode cache and films
  (`scratchpad/`), voice notes (`writing-notes/`), Cut Marks / Cutting Room
  renders, and this module's own posters. A swept file over **64MB** is
  skipped before download; anything probing over **180s** is a film wearing
  a clip's name and is skipped and counted, never filed.

**Her edits always win.** `PATCH /:id` (title/tags/note/hidden through an
EDITABLE whitelist) records the touched fields in `editedFields`; a
re-harvest merges through `mergeClip`, which never overwrites a touched
field, and note/hidden are never the harvest's to write at all. Docs are
content-addressed (`sha1(url)`), so re-running the harvest upserts and
nothing ever doubles. There is deliberately NO delete route — hiding is the
verb; a deleted doc would just resurrect on the next harvest.

**Posters read the bytes via the Admin SDK, never the url** — ffmpeg cannot
reach the cloud sandbox's HTTPS proxy, so the harvest downloads with the
SDK (works everywhere, handles private objects), probes with ffprobe (a
file with no video stream is refused), grabs a frame at ~15% in (frame 0 is
often a fade from black), and ships it as a **480px webp** (~15KB, the
webp rule) under `clip-library/posters/`, cache-immutable.

**Search is the whole interface.** `search-grammar.js` parses (the ONE
house grammar); matching is the clip-library way — lowercase alphanumerics,
substring hits, so her punctuation and dictation never decide a match.
Fields: `tag:` `title:` `from:` (the film it came out of) `prompt:` `note:`
`kind:`. The page mirrors the same parse client-side over the loaded shelf
(no request per keystroke) and the box runs through `liveInput`, so iOS
dictation searches as she speaks. `GET /api/clips?q=` answers the same
grammar server-side. Semantic search is deliberately not built yet
(Sophie: fine to do later; it would cost an embedding pass).

**CHUNKS ARE THE DEFAULT VIEW (Sophie, Aug 2026: "since the main point is
chunking not random clips… hide the clips by default and only show them when
asked").** The chip row is TWO piles and nothing finer — **chunks** (what she
named on purpose) and **clips** (every atom, one tap away), plus **hidden**
when it exists; the old per-kind chips (scenes/bridges/quick/shorts) are
gone. A search runs inside the open pile, and when it comes up empty there
but has hits in the other one the state line offers them ("Nothing matches in
clips · 1 in chunks") rather than dead-ending. The page is **cream**
(`--bg:#faf6ee`), and it out-specifies the injected pill's own palette so the
pill matches it — see the pill note in the `new-page` skill, because `:root`
alone cannot reach an injected pill. A **back-to-top** button sits
bottom-right (the pill owns top-right) once the scroll passes 500px.

**Two layout bugs found by MEASURING the rendered page (2026-08-15), both
invisible in a passing test suite:** a tile's `.ph` is a `<span>` inside a
`<button>`, so it was inline and `aspect-ratio:1` never applied — the squares
only looked square while their posters happened to load, and collapsed to
77x111 whenever one was slow or missing (`display:block` fixes it); and the
house 56px pill reserve left the "?" 8px underneath the pill at 390pt (64px
clears it). Screenshot a page before calling it done.

**Gotchas earned elsewhere, honored here:** opening the page never spends
money and never starts a harvest (it only *shows* a running one); the
lightbox freezes the page and restores the exact scroll position; the
video element is torn down on close so the download stops; text boxes ship
empty; the pill's five tokens are defined on `:root` and the page script
is an IIFE.

Tests: `node scripts/test-clips.js` — the grammar matching, the sweep skip
list, the title fallback, the her-edits-win merge, and the gatherers, all
pure, no network.

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

## Voice Memos — ONE library, every path files into it (Aug 2026)
- **The library** = membry Storage `memo-audio/<id>.m4a` + `manifest.json`
  (`memos.js`, `/api/memos`) — the stamped 1100+ recording archive. Every way
  audio arrives now funnels into it through `memos.fileIntoArchive()`: the
  Mac push (`scripts/push-memos.mjs`), the iOS share sheet / audio drop
  (`audio.js` auto-files each new recording, keeping its own `forge-audio`
  doc with `memoId` as the reference), Story Room voiceover pastes
  (recordings only — TTS renders stay out), and a chat with a pasted file.
- **The Mac push is AUTOMATIC once installed (Aug 2026, Sophie's ask):**
  `scripts/install-memo-autopush.sh` (served at `/install-memo-autopush.sh`,
  queued in `docs/desktop-tasks.md`) writes a launchd agent
  (`com.imageforge.push-memos`) that runs the push at every login and daily at
  noon, downloading the CURRENT `push-memos.mjs` from the server each run (with
  an offline fallback to its cached copy), logging to
  `~/Library/Logs/imageforge-push-memos.log`. The one macOS trap: a launchd job
  doesn't inherit Terminal's Full Disk Access, so the agent can be blind to the
  Voice Memos database Terminal reads fine — the installer detects that exact
  failure in the first run's log and prints the one-time System Settings fix
  (add the `node` binary to Full Disk Access). Re-running the installer is
  always safe. Test: `node scripts/test-memo-autopush.js` (generation on a
  scratch HOME, no launchd, no Mac).
- **A chat files a pasted recording with ONE call — never reconstruct the
  stamp by hand:** `POST /api/memos/ingest?title=…&dur=…&ext=m4a` with the
  raw bytes as the body. `stamp` is optional; without it the server derives
  one from the file's internal clock and the **md5 of the bytes** does the
  real deduping (every manifest record carries `hash`). The internal clock
  is the moment recording STOPPED, which is why hand-built stamps went wrong
  (2026-08-05: filed `_1330`, her phone said 1:28) — don't guess it.
- **A filed recording TELLS SEARCH (Aug 2026).** `fileIntoArchive` notifies
  `memos.onFiled` listeners once a record is really appended (never for a
  duplicate; a listener that throws is swallowed — filing is the half that
  must not fail), and `search.js` registers one that arms its append-only
  index sync. That is the whole reason a recording is findable minutes after
  it lands instead of whenever somebody remembers to rebuild the index — see
  the Search section for what the sync does and what it costs. A restamp
  notifies too: a new id is, to an id-keyed index, one gone and one arrived.
- **APPLE'S OWN TRANSCRIPTS FILL THE GAPS — one line on her Mac (Aug 2026).**
  Measured 2026-08-17: **94 of the 1,137 records carry no transcript at all** —
  over the 45-minute ceiling, over Whisper's 24MB cap, heard as empty, or a
  failed enrich that banked the audio and moved on. Search searches WORDS, so
  those recordings are invisible in it. **Realistically ~57 of the 94 can be
  filled** — 11 are zero-length and 26 more are under 5 seconds, so Apple has
  nothing for them either; the 57 with real audio are **66.5 hours**, 14 of
  them over an hour each. Voice Memos already transcribed them on
  the phone, free, the long ones included, and **only her Mac can read that
  database** — so the Mac hands the words over and the server does the rest,
  exactly like the push:
  `curl -fsSL <app>/import-apple-transcripts.mjs -o /tmp/apple-tx.mjs && node
  /tmp/apple-tx.mjs` (`--dry-run` first; queued in `docs/desktop-tasks.md`).
  - **FILL ONLY, NEVER OVERWRITE.** `POST /api/memos/transcript {id,
    transcript}` refuses a record that already has words: two transcripts of
    the same audio disagree in small ways, and swapping the one Search indexed
    for another is how a passage she found yesterday stops matching tomorrow.
    Filling one re-runs `classify` (it had no words, so its `cat` was a
    placeholder) and notifies `onFiled`, so Search picks it up by itself.
    `GET /api/memos/untranscribed` is the list of empty ones with their
    `stamp|duration` match keys.
  - **THE SCRIPT DISCOVERS THE SCHEMA; IT DOES NOT ASSUME ONE.** Apple has
    moved transcripts between layouts across OS versions, and a guessed column
    name that isn't there returns zero rows — which reads exactly like "you
    have no transcripts". So it scans for columns/tables mentioning
    transcription, says what it found and how it read them, and handles three
    layouts: a text column on the recording row, a segment table joined back by
    a recording link (re-joined in time order), and an archived blob (plutil,
    falling back to text runs). Found nothing → it says so, exits non-zero and
    points at `--report`, whose output is what a chat needs to fit the reader.
  - Matching is `stamp|duration`, the same key the push filters on — never the
    stamp alone. Two recordings sharing a minute AND a rounded length are
    reported and left alone rather than guessed.
  - Tests: `node scripts/test-apple-transcripts.js` — drives the real script
    end to end with no Mac and no network (fixture databases in all three
    layouts, `sqlite3` shimmed onto PATH with `node:sqlite`, a stub archive).
    Its own earned bug: the harness first used `execFileSync`, which blocks the
    event loop the stub server runs on, so the child's fetch deadlocked.
- **Transcription is UNCONDITIONAL** (Sophie 2026-08-05) — no toggles;
  `transcribe=0` params are ignored everywhere. Bank first, enrich after: a
  Whisper failure files the audio with `enrichError` on the record instead
  of losing the recording.
- **THE FILE md5 IS NOT A FINGERPRINT OF THE RECORDING (Aug 2026 — this is
  what let duplicates through after the "one library" fix).** iOS rewrites an
  m4a's QuickTime creation/modification dates every time the file is exported
  or shared, so re-sharing a recording gives DIFFERENT BYTES for identical
  audio. Measured on a real pair: both copies 2,820,952 bytes, **36 bytes
  different, every one a date field** (copy A `2026-08-02T19:43:44Z`, copy B
  `2026-08-04T04:31:10Z` — each the moment it was FILED), all 2.8MB of audio
  bit-identical. **That single cause defeated BOTH dedupe layers at once**,
  because `mvhdDate()` reads the same rewritten clock, so the server-derived
  stamp was "when it was shared" too. Don't diagnose a repeat memo as a hash
  bug — the hash was working; it was hashing the wrong thing.
- **Dedupe is THREE layers now, and each catches what the one before cannot:**
  1. **file md5** (`hash`) — a byte-identical resend, i.e. a retried upload.
  2. **audio fingerprint** (`ahash`, `memos.audioHash`) — the file md5 with
     every mvhd/tkhd/mdhd date zeroed, so a re-SHARED recording matches. The
     scan is a whole-buffer search, NOT a tree walk from the top-level moov:
     Voice Memos leaves an earlier copy of those boxes inside the mdat region
     (headers at 17814 *and* 2755110 in the measured file) and iOS updates
     both — a tree walk finds one and the fingerprints still disagree.
  3. **transcript backstop** (`memos.transcriptTwin`) — exact duration + ≥40
     words + ≥90% word agreement. This is what catches a re-ENCODED copy,
     where even the audio bytes differ. **The thresholds are calibrated
     against the real archive, not guessed** (swept over all 1,117 records:
     they flag the 9 genuine duplicates and nothing else). Every gate is
     load-bearing — EXACT duration because Sophie re-records the same line
     constantly and those takes land 1–2s apart (±2s slack wrongly flagged
     four of them); 40 WORDS because an 8-second line repeated ten seconds
     later really is word-for-word identical and is NOT a duplicate; 90%
     because Whisper transcribes the same audio differently each run (which
     is exactly why duplicates read as different memos). Re-run
     `node scripts/memo-dedupe.js` after touching any of them.
- **A SHARED STAMP IS NOT A DUPLICATE, and the stamp no longer dedupes
  anywhere (Aug 2026).** It is minute-resolution, Sophie records several short
  thoughts back to back, and the archive holds **70 groups of recordings that
  honestly share a minute** — so the rule was wrong for about one recording in
  fifteen. It cost a real one: a 28-minute recording from 2025-09-12 was
  refused as "already in the archive" because an unrelated 11-second clip
  (91KB against 14.2MB) was made in the same minute. Identity is bytes or
  words; the stamp only NAMES a record.
  - The Mac push had it worse, because it filters BEFORE uploading — a new
    recording sharing a minute with an archived one was never sent at all, so
    the server's layers never got to judge it. `GET /status` returns **`keys`**
    (`stamp|duration`) and `push-memos.mjs` skips only when both match;
    duration comes free from the Voice Memos database, so this costs no file
    reading. (`stamps` is still returned for older callers.)
  - **The direction of the risk is deliberate**: a false SEND is harmless (three
    real layers catch it, and a fingerprint match costs nothing — not even
    transcription), while a false SKIP loses a recording for good.
- **Never hand-build a stamp** — POST the bytes and let the server work it out.
  A stamp equal to NOW is a caller guessing (12 records got in that way, 0–3
  min from their own upload); it still names the record but earns the id a hash
  suffix so two derived minutes can't collide.
- A skip after the audio is already uploaded now DELETES those bytes, or they
  become an orphan object nothing can reach (five of those had accumulated).
- **Repairs: `node scripts/memo-dedupe.js`** — `--fingerprints` (backfill
  `ahash`), `--merge` (merge duplicate pairs), `--orphans` (sweep audio no
  record points at), `--all`, `--dry-run`. **It never deletes**: a merged-away
  recording's audio moves to `memo-audio/_removed/` and the manifest is backed
  up beside itself before any write, so every repair is reversible by hand.
  Bare (no flags) it scans and changes nothing — run that first.
- Ran 2026-08-07, end to end: 9 duplicate pairs merged (1,117 → 1,108) — 6 from
  the 11 July bulk build (`export-voice-memos.sh` appends `_1` when a filename
  already exists, so a second export run into the same folder copied some
  recordings out twice and each copy was transcribed and titled separately),
  3 from re-shares in Aug. Then `ahash` backfilled over all 1,108 (4.86GB read,
  ~$0.60 of egress; 3 zero-duration empties have no container to fingerprint),
  and the 5 orphan objects re-filed → **1,113 records, 0 duplicate pairs**. One
  of those orphans was a 28-minute DREAM with a 19,316-character transcript
  that had been invisible since Sept 2025.
- **After any merge or re-file: rebuild the Search index AND re-embed.** The
  index keys its vectors to `builtAt` + chunk count, so a reindex that changes
  chunking leaves meaning-search 409ing on `stale-vectors`.
  `POST /api/search/reindex` (free) then `POST /api/search/embed` (~$0.05).
- Earlier one-time repairs (both ran 2026-08-05):
  `scripts/memo-unify-backfill.js` — phase A stamped `hash` onto existing
  records from Storage md5 metadata, phase B merged strays from `forge-audio`
  into the archive. Note phase A landed AFTER two of the three Aug duplicates,
  so the md5 layer wasn't even present when they were filed.

## Voice Studio (`voicelab.js`, `/voice`) — her ElevenLabs voices, two tabs
- Pick a voice, type words, tap Render — TTS without leaving Deck Factory.
  Deliberately NO settings: every render is the stock v2 defaults (stability
  0.5, similarity 0.75, style 0, speaker boost), `eleven_multilingual_v2`.
  Background job on a `forge-voicelab` doc, audio to Storage `voice-lab/`.
- **The voice picker is a row of coloured SQUARES, one per person, ALL ON ONE
  ROW** (Sophie, Aug 2026: "a lot smaller and definitely all fit on one row").
  `.vbtn` is `flex:1 1 0` with `max-width:40px` and `aspect-ratio:1`, so any
  number of people fits any phone; the dropdown under it is the who-is-who
  fallback, and there is **no name line under it** — the dropdown already says
  who is picked. Each square is a FLAT COLOUR, no glyph (Sophie, Aug 2026:
  "make the little icons into squares instead of circles" — the Lucide `user`
  that used to sit on them is mostly a circular head at 30px).
  **`OFFERED_VOICE_IDS` is an explicit ALLOWLIST** — empty would
  sweep in every Voice Library professional on the account. Cloning someone
  new = add the id + a colour there; **culling one is just dropping its id**,
  which is how Richard v1/v2/v3, Miriam, Gilad, Alpha and "Sophie — doctor"
  came off the picker on Aug 18 2026. Nothing was deleted at ElevenLabs.
- **Her words STAY in the box** (Sophie, Aug 2026): a render does not empty it
  and neither does leaving the page (`localStorage['voicelab_text']`), because
  she runs the same line through voice after voice. **Clear** is the only
  thing that empties it, and it only shows when there is something to clear —
  at the FAR RIGHT of the row, as far from Render as the row allows.
- **NO PAGE HEADER, and NO CHARACTER COUNTS ANYWHERE (Aug 18 2026, Sophie:
  "it says Voice Studio twice, once at the top and once below it… get rid of
  basically the whole header, including the line" / "I don't need to know how
  many characters everything is").** The native tool bar carries the title, so
  the page's brand row, h1, credits line and rule are gone and the tabs are the
  first thing on screen. The credits moved **behind an ⓘ** at the left of the
  tab row — the number is still fetched at boot, it just costs a tap to read.
  Render and Apply voice are the same height as Clear (`align-items:stretch`
  on `.renderrow`, because their borders differ by half a pixel).
  The rows that now sit in the injected pill's top-right band each keep the
  56px reserve, `.vsel` included (`max-width:min(22em, calc(100% - 56px))`).
- **TWO TABS — TEXT · VOICE (Aug 2026, Sophie: "a separate hairline tab in
  the voice studio"; renamed from SPEAK · CHANGE on Aug 18 — "rather than
  speak it should say text, because it's text to speech, and change should say
  voice, because it's voice to speech").** The house `.acctabs` hairline
  pattern. The tabs swap only the LOWER half; **the voice picker is SHARED**,
  because "which voice" means the same thing on both sides (words to say /
  voice to become). The picker's own "VOICE" section label is gone — it sat
  above a row of coloured squares and said nothing the squares didn't.
  - **The VOICE tab is speech-to-speech** — `POST /v1/speech-to-speech/{voice}` on
    **`eleven_multilingual_sts_v2`** (verified live against `/v1/models`:
    `can_do_voice_conversion`, 29 languages). It keeps the PERFORMANCE —
    timing, emphasis, where a laugh lands — and swaps only the voice, which
    is the whole reason it isn't just TTS. **No v3 here either**, same rule
    as her TTS.
  - **Two ways in: record in the page, or choose a file** (a Voice Memo, once
    it is in Files). The record button sits in the MIDDLE of its row — three
    grid tracks (`1fr auto 1fr`), not a centred flex row, so the timer growing
    beside it never moves it — and the file picker is a **folder icon**, since
    it is the fallback, not the headline. `recMime()` asks the browser what it can record —
    **iOS Safari has no WebM, `audio/mp4` is what it records**, so never
    assume a container. Recording needs `mic: true` on the `/voice`
    `GatedWebTool`; the file picker works with no build.
  - **The SOURCE is uploaded to Storage BEFORE the conversion is attempted**
    (`voice-lab/sources/<id>.<ext>`, her ask: "the recorded voice will also
    save to firebase"), so a failed or refused conversion still leaves her
    the take. A finished change plays BOTH halves.
  - **The take SURVIVES the send**, the same reason her words do. Dropping it
    is an **✕ in the take card's top-right corner, and it asks first** (Sophie,
    Aug 2026: "drop this take is right next to the play button, so I'm afraid
    I'll accidentally delete my take rather than pressing play"). The confirm
    covers the card rather than opening a dialog, so the answer is where the
    question is. A RECORDED take draws no name — the player already shows its
    length — while a PICKED file keeps its file name, the only thing that says
    which file she chose.
  - `POST /change?voiceId=&voiceName=&ext=&name=` takes the audio as the
    **RAW body** (base64 in JSON inflates a memo by a third — the
    `audio.js` `/upload-file` precedent) and the page sends it with XHR so a
    phone upload shows real progress. Cap 25MB. It writes the body to tmp
    BEFORE responding, so the background job never holds a whole recording
    in memory beside the next request's.
  - `GET /history?kind=tts|sts` filters **in memory, not in the query** — a
    `where()` would silently hide every render made before `kind` existed.
    Absent means `tts`, which is what they all were.
- Tests: `node scripts/test-voice-changer.js` (drives the real page headless
  against a stub API — the tabs, the take, the raw-body send, which list a
  card lands in, and a hit-test of both tabs at 375/390/430).

## Audio drop (`audio.js`) — recordings off the phone → permanent URLs
- `audio.js` (`/api/audio`, page at `/audio`) is the generic destination for
  audio. Nothing else did that job: `/api/story/voiceover` attaches ONE
  recording to ONE story, `/api/songs` runs the whole song pipeline,
  `/api/memos` files into the stamped 993-memo archive (and costs money per
  file), and the Dump takes images + video only. A folder of recordings in the
  Files app had nowhere to go.
- **The iOS Share sheet IS a way in (Aug 2026).** `DumpShare` activates for
  files too and routes audio extensions here (`POST /upload-file`, one
  date-stamped batch per share). The sheet's old "Transcribe the recordings"
  toggle is now a NO-OP — the server transcribes every recording
  unconditionally and also files it into the Voice Memo library (see the
  section above); over-25MB files record a clear error on the doc. Uploads are a BACKGROUND URLSession via the
  `group.com.sageryza.imageforge` App Group — the sheet stages files in the
  shared container, queues the tasks, and dismisses; fire-and-forget, the md5
  dedupe means re-sharing heals a lost upload. Other ways in: the `/audio`
  page's file picker, or Voice Memos → Share → Copy → Story Room's "Paste a
  recording" when it belongs to one story.
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

## Episode Editor (transcript spans → snippet cards → finished audio)
- **ANY work on Sophie's audio starts with the `sophie-audio` skill**
  (`.claude/skills/sophie-audio/`) — cutting, pause removal, take selection,
  assembling narration, TTS. It is the tripwire for the two docs below, and
  it ends with the rule chats keep skipping: run
  `node scripts/vo-verify.js` before handing a cut back.
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
  sequence. Narration = ElevenLabs voice `UTkHGl2ImiT6gwtAFCql` on
  `eleven_multilingual_v2` (**NEVER `eleven_v3`** — voice rule under Design
  rules), no whisper prefix, no tempo nudge, ONE constant gain instead of
  loudnorm (Aug 2026, Sophie — she rejected the dynamic squeezing;
  editor.js is the live copy of all of this, `docs/narration-voice-settings.md`
  the human record).
  `ELEVENLABS_API_KEY` is in config-loader `MANAGED_KEYS` (Render env or
  `config/pipeline`) — **without it narration cards FAIL the render with a clear
  job error, they are never silently skipped**. Output: one 44.1k mono mp3 at
  `nde-episodes/editor/<id>-<n>.mp3`.
- **Seed:** `node scripts/seed-editor-proof.js [--base <url>] [--replace]`
  rebuilds the **PROOF** episode — the 12 verified veridical moments as sources +
  snippets (named by experiencer), the "Pajamas hook" opener, and the v4 running
  order with its narration fills. 23 cards.
- **Each render row has a SCISSORS → the Cutting Room** (Aug 2026), where the
  pauses and filler words come out by tapping them. See the Cutting Room
  section for the contract; nothing about the render itself changed, and
  pause/filler removal deliberately does NOT happen inside a render.
- **iOS:** `EpisodeEditorView.swift` = a WKWebView on `/editor` that answers the
  HTTP Basic gate with the studio token (same wrapper pattern as
  `WritingRoomView`), registered as the `editor` tool in `RootView` — home-grid
  tile "Episode Editor", SF Symbol `waveform`, deep link `deckfactory://editor`.
  It pauses the page's audio on a screen change so a preview never keeps playing
  from a hidden tab. Page changes ship via Render deploy — no TestFlight build.

## Cutting Room (her recordings → marked on the transcript → cut/sent)
- `cuttingroom.js` (`/api/cutroom`, page at `/cuttingroom`, iOS tile "Cutting
  Room", SF Symbol `scissors`, deep link `deckfactory://cutroom`) — Sophie
  opens one of her OWN recordings (the audio-drop list, i.e. everything shared
  off Voice Memos), marks it on its **transcript** — never a waveform — cuts
  pauses out, and slices sections off to save or send on. The hallway between
  Voice Memos and the rooms that use her voice. Designed around her wrist
  (tendinitis): **everything is a tap, nothing drags, scrubs, or scrolls**
  (playback follows itself — current word highlighted, page auto-centers).
- **Design (Aug 2026, Sophie): icon-first, gold-on-cream.** Buttons are GOLD
  outline + GOLD icon on CREAM (never white/text on the accent), words only
  where unavoidable (sheet rows, confirms). Send = the Apple share glyph, cut
  out = scissors, MARK = bookmark, tighten = chevrons pointing inward, render
  = arrow-down-to-line. Same paper/gold palette as editor.html — sibling tools.
- **Marking model:** tap first word, tap last word → a section (bar appears:
  cut out / save-send). Tap a pause chip → cut it (rose, struck; tap again to
  keep). "Tighten" cuts every pause in one tap. MARK drops a pin at the word
  being spoken. Cut-out words show struck-through; tapping them offers restore.
  **A picked section STAYS picked after save/send** (Aug 2026, Sophie) — she
  saves AND sends the same span without re-picking; only the ✕ (or cutting it
  out) lets go.
- **The room is TWO hairline tabs — TRANSCRIPT | CLIPS (Aug 2026, Sophie:
  "the scrolling is pretty brutal")** — saved clips and renders live behind
  the second tab instead of below the transcript. Long-recording navigation
  on the transcript tab: **chapter notches** down the left edge (every 5 min,
  10 for >1hr; tap = jump the page to that minute) for recordings over 8 min,
  and a **find-a-word** magnifier in the tools row (live matches highlighted,
  next-arrow cycles; commits on blur — she dictates). Tab row reserves the
  pill's 56px corner; the sliding line is `calc((100% - 56px)/2)`.
- **Cuts are the Episode Editor's cutter** (imported from editor.js —
  `clampBounds` + `detectSilences` + `snapToSilence`, ONE implementation): a
  tap never needs to be precise, edges land in real silences. **A planned
  "manual mode" (cut at the exact tapped millisecond, no snapping) is PARKED
  by request — not in v1.**
  **Every real cut RE-LISTENS first (Aug 2026, earned):** the stored words
  come from the 75s-chunked whole-recording pass, which is chips-only
  accuracy — Sophie's first clip started at "yeah" and grabbed the "he said"
  before it, because the bulk pass timed "yeah" early. `cutSection` and the
  render's cut-outs therefore extract a small window, take FRESH whisper
  word timestamps, and locate the span with `phraseSpan` (buildClip's exact
  precision path); the bulk timings survive only as the fallback. Never cut
  from the stored words directly. Clip entries carry `wi0`/`wi1` so a clip
  can be re-cut.
- **Pause detection = vo-remove-pauses.js's two passes** (word-timing +
  relative-energy breath pauses, room-tone runs — silencedetect alone CANNOT
  find noisy pauses, see docs/nde-precise-cutting.md). Detection only; nothing
  is removed until she taps. A removed pause is COMPRESSED to ~0.28s (KEEP),
  never deleted outright. The RMS profile is folded streaming off the decoded
  PCM (an hour of 16k s16le is ~115MB — never read into one Buffer on the
  512MB instance).
- **HER VOICE IS NEVER LOUDNORMED** (the Episode Editor narration finding —
  she rejected dynamic squeezing). Renders and clips are cuts of the original
  bytes; clips get micro-fades on the edges only.
- **Hand-offs:** save → clip file + a `forge-audio` doc (batch
  `cutting-room`, track `cutroom`, content-hash deduped, no second copy of
  bytes). **Do NOT point Sophie at `/audio` to find a clip** — that page is
  an UPLOADER whose list shows only the batch typed in its box (defaults to
  today's date), so a `cutting-room` clip is invisible there (Aug 2026, bit
  for real). The review surface is the room's own Sections list, and every
  clip/render row carries a **download** button (Apple's arrow-into-box
  glyph): in a browser it's a same-origin attachment
  (`GET /:id/file?u=<storage url>&n=<name>` — validated to the recording's
  own folder), in the app the `cutroomShare` WKScriptMessage bridge fetches
  the file natively and opens the iOS share sheet (Save to Files/AirDrop);
  **Story Room** → clip cut here, then
  `scratchpad.attachVoiceUrl(padId, beatId, url)` (a normal voice take —
  every take kept); **Episode Editor** → NO audio is cut: the recording gets
  a `forge-nde-videos` doc (`cr-<id>`, segments grouped from our words) and
  `editor.addExternalSnippet()` adds source + snippet card + sequence entry —
  the editor re-cuts it natively (same whisper fallback, same clip cache).
- **Data:** one doc per recording in `forge-cutroom` (deckfactory),
  content-addressed by sha1 of the audio URL (reopening resumes). Word
  timestamps live in Storage `cutroom/<id>/words.json` (chunked whisper-1,
  75s chunks — the honest-on-long-files finding), NOT on the doc. Doc holds
  `pauses` (s/e keep-adjusted + removed flag), `cuts` (word-index spans),
  `pins`, `clips` (saved/sent sections), `renders` (capped 8 — every render a
  NEW file, originals untouched), `job`. All slow steps are background jobs on
  the doc; the page polls and resumes from `localStorage` (`cutroom_open`).
- **Routes** (STUDIO_TOKEN gate, only `/status` open): `GET /sources` (audio
  drop items + project states), `POST /open {url,name}` (starts the listen
  job: transcribe + find pauses), `GET /:id`, `POST /:id/{pause,tighten,pin,
  cutout,uncut,title}`, `POST /:id/section {wi0,wi1,action:'save'|'story'|
  'editor',…}`, `POST /:id/render`, `GET /:id/job`, `DELETE /:id`.
- Transcription cost ≈ $0.006/min of recording (whisper), paid once per
  recording. Caps at 90 min.
- iOS: `CuttingRoomView.swift` = the **Episode Editor wrapper pattern** (v1
  shipped bare and Sophie flagged it — see the Headers design rule): native
  `.forgeToolBar("Cutting Room")` whose chevron asks `window.__navBack`
  first (room → recordings list → leave the tool), `__nativeNavBar`
  injected so the page hides its own back button (`body.native`; the page
  header also folds away on the recordings list, where it would duplicate
  the bar), audio paused on screen changes. The page carries the injected
  shared pill, so the native pill is suppressed (`showAutoScroll`). Page
  changes ship via Render deploy; wrapper changes need TestFlight.
- **The "?" circle on the tools row** is the instructions for an icon-first
  tool: tap → a card naming what every icon does, tap anywhere → hidden.
  Keep it in step with the icons if any control changes.
- The recordings list links out to **Search** (below) — the way in when she
  knows what was said but not which recording said it.
- **A finished Episode Editor render comes here to have its pauses and filler
  words taken out (Aug 2026, Sophie's ask).** Each render row in the editor
  carries a **scissors** (that tool's own glyph) → `/cuttingroom?url=…&name=…`;
  the page opens that url on boot and strips the param, so a reload lands
  where she actually is. `POST /open` already accepted any https url, so this
  needed NO new server code and NO TestFlight build — the nav chevron asks
  `__navBack` (room → list) then falls through to the web view's history back
  to the editor, exactly the path Search's memo hand-off uses.
  **The cut number comes from the render's FILE** (`<episode>-7.mp3`), never
  its row position: `renders` is capped at 10 and newest-first, so positions
  drift as old cuts fall off while the files keep counting up.
  Each render is its own content-addressed room, so marking cut 7 never
  touches the marking on cut 6. Tests: `node scripts/test-cutroom-handoff.js`
  (drives both real pages in headless Chromium; skips without one).
- **Do NOT move pause/filler removal INTO the editor's render** (Aug 2026,
  the decision behind the hand-off). The editor's cuts are safe because both
  edges land in detected silences; removing an "um" from the MIDDLE of a clip
  is a splice, and a splice is something to approve by ear, not have happen
  invisibly inside a render. That is what this room is for. Caveat worth
  knowing: **Whisper often doesn't transcribe "uh"/"um" at all** (that is what
  caused the doubled-word bug — see phraseSpan in
  `docs/nde-precise-cutting.md`), so filler removal by transcript is partial;
  the pause detection catches many of them anyway as breath pauses.

## Pausing (`pausing.js`, `/pausing`) — how long a beat sits

The other half of the polish pass, and the half that decides how a cut
actually sounds. Shipped Aug 2026; before that it existed only as a
hand-authored Compare page, "Evan — the pause timeline (v7b)" in the chat
`evan-story-visual-summary`, page `s9rSf9bZo0AqnScX0OON` — still worth reading
as the reference for what the tool does.

**What it is for.** The Cutting Room can REMOVE a pause: it compresses one to
`KEEP` (~0.28s) and that is the only length it has. Nothing else in the app
could make a pause 1.2 seconds, or put a pause somewhere she never left one.
Four things lived on that page and nowhere else, and they are the tool:

1. **Setting a LENGTH**, not just removing — the whole idea of rhythm.
2. **ADDING a pause** where the recording has none.
3. Building it out of the recording's **OWN ROOM TONE**.
4. **Playing HER EDIT** rather than the source (Sophie: "I need to be able to
   hear it to know how long of a pause I want"). Pressing play used to play
   the recording as it is, so a pause she had just set sounded exactly the
   same and there was no way to judge a length.

**A pause is never digital silence.** This is the finding the tool is built
on: a room has a floor, and a pause rebuilt as zero samples reads as a
dropout — it is what made the "45 percent" line sound bungled. So every pause
is real audio out of her own recording, and the only question is which piece:

- an **existing gap** lends its own air, trimmed if she shortened it and
  repeated if she lengthened it — the best possible source, because it is
  literally the room at that exact moment;
- an **added pause** has no gap of its own, so it borrows the quietest
  sustained stretch of the same file, baked once during the listen job to
  `pausing/<id>/room.wav` and read by both the preview and the render.

Fades are 12ms on the OUTER edges of a pause piece and nowhere else. A fade at
every loop boundary pumps audibly on room tone; a butt join between two copies
of near-silence does not.

**Detection is imported, never re-implemented.** `cuttingroom.js` exports
`breathCuts`, `roomToneCuts`, `mergeRanges` and `rmsProfile` — the
vo-remove-pauses passes (see `docs/nde-precise-cutting.md`, "Noisy pauses":
breath and mouth noise sit only 4-7dB under quiet speech, so no absolute
silence threshold finds these pauses). Every constant in them is a measured
finding. A second copy would find DIFFERENT pauses and the same recording
would read differently in two rooms.

Those passes hand back ranges to REMOVE, **already inset by `KEEP`/2 on both
sides**. Pausing wants the GAP, so `pausesFrom` takes that inset back off —
and no further, because the 0.10s margins inside `breathCuts` are deliberate
protection for the speech either side. Get this wrong and every pause she is
shown is 0.28s shorter than the one she hears: the tool's whole job, silently
off by a beat. Two filters then apply: below **0.35s** a gap is articulation
rather than rhythm and gets no chip (a chip on every comma buries the pauses
that matter), and head/tail air is a TRIM, which is the Cutting Room's job.

**The edit itself is ONE shared file.** `pause-plan.js` is loaded by the
render on the server (`require('./pause-plan')`) and served to the page at
`/pause-plan.js`. She sets a length by EAR, so the 1.2s she approved in the
preview has to be the 1.2s that comes out of the render — two implementations
would drift and the tool would quietly stop being trustworthy. `planEdit`
turns her marks into ITEMS over the original timeline and walks them into
PIECES that tile it exactly: a gap in them is audio silently dropped out of
her recording, an overlap is audio played twice. Picking the length a gap
already had is **not a change** (re-cutting a gap to itself would add two
fade-joins to audio that needed none), and overlaps are dropped rather than
merged.

**It does not cut words.** The reference page had a CUT mode; the Cutting Room
and Cutting Blocks both do that properly, with the re-listen every real word
cut needs. Pausing only ever touches AIR, which is why its word timings never
have to be cut-accurate and it never re-listens. "out" is 0.08s of room tone —
an elision, not a splice.

**The unit of listening is the PARAGRAPH.** The artifact decoded one 90-second
film into memory and rebuilt the whole thing on every play. A real recording
can be ninety MINUTES, which decoded is most of a gigabyte of Float32 in a
WKWebView. So the server cuts a paragraph span once (`/api/search/clip-span`,
banked immutably, ~45KB for a sheet preview), the page decodes it, and her
pauses are spliced in the browser — which keeps the thing that mattered:
changing a length and hearing it with no round trip. Paragraphs are derived
client-side, broken at the LONGEST pauses, and the page opens FOLDED to them
(the progressive-expansion rule) and draws words only where she goes in.

**Undo collapses consecutive changes to one pause into one step.** Deciding a
length is a run of taps — 0.4, then 0.8, then 1.2, listening to each — and one
entry per tap means undo walks back through her auditioning instead of back
out of the pause. Adding a pause opens the sheet, so add-then-length was two
entries and one undo left an unwanted pause sitting at its old length (caught
by the page test).

**Data.** One doc per recording in `forge-pausing` (deckfactory),
content-addressed by a sha1 of the source url so re-opening resumes. Words in
Storage (`pausing/<id>/words.json`); only `set` and `added` — her marking
state, the part that changes — live on the doc, through a whitelisted
`POST /:id/state`. Renders capped at 8. **Her voice is never loudnormed.**

**Money.** Opening a recording transcribes it, ~$0.006/min, once ever per
recording. Previews are ffmpeg span cuts, banked forever. Rendering is ffmpeg
on our own box. Nothing spends on load.

**Routes** (mounted at `/api/pausing`, STUDIO_TOKEN gate, only `/status`
open): `GET /status` · `GET /sources` · `GET /` · `POST /open` ·
`GET /:id` · `POST /:id/state` · `GET /:id/plan` (her edit as the render will
perform it — free, no ffmpeg) · `POST /:id/title` · `POST /:id/render` ·
`GET /:id/job` · `DELETE /:id`.

**Tests.** `node scripts/test-pausing.js` — the inset arithmetic, the room-tone
pick, and the shared plan's tiling, pure and no network. `node
scripts/test-pausing-page.js` — the real page in headless Chromium against a
synthetic recording the stub cuts on demand, asserting on the SAMPLES the page
hands the speakers: the pause must be quiet AND non-zero. A regression there is
invisible in code review and obvious in her ears.

## Search (`search.js`) — every transcript, one search
- `search.js` (`/api/search`, page at `/search`, iOS tile "Search", SF Symbol
  `magnifyingglass`, deep link `deckfactory://search`) — one search across
  **BOTH** transcript libraries: the 77 interview transcripts in
  `forge-nde-videos` (~3.5M chars) and the 1,022 transcribed voice memos in the
  membry archive (~2.2M chars). Nothing could search either before: the Cutting
  Room only searches inside ONE recording already open, the Episode Editor only
  shows a ±150s window around a snippet she already knows about.
- **Results are PASSAGES, not files** — a ~48s window of transcript with its
  timestamp, whose recording it is, and audio. Same paper/gold palette as
  editor.html / cuttingroom.html; the three audio tools are one family.
- **The hand-offs are the point** (a search that only lists is worse than
  scrolling). Each hit goes to the tool that owns that kind of audio:
  **interview → Episode Editor** (`editor.addExternalSnippet` — a snippet card
  lands in an episode and the editor re-cuts it natively), **memo → Cutting
  Room** (`POST /api/cutroom/open` with the recording's url). Search cuts no
  audio of its own except `/clip-words` below; every path feeds the ONE
  cutter in `editor.js`.
- **CLIP-THESE-WORDS on a hit (Aug 2026, Sophie: "pick the words from that
  step if I just want one clip and not the whole recording").** The scissors
  Clip button puts the hit's passage in pick mode — tap first word, tap last
  word, ✓ — and `POST /clip-words {src, text, chunk, timeSec}` cuts JUST
  that span (background job, content-addressed cache
  `search-clips/words-*`), with ▶ + a download button on the result (share
  bridge in the app / same-origin attachment `GET /clip-file?u=&n=` in a
  browser). Rules: BOTH kinds cut through ONE path, `cutInWindow` in
  search.js (fresh window listen + `edgeSpan` + clampBounds + silence snap +
  micro-fades) — an INTERVIEW gets the loudnorm every episode clip gets; a
  MEMO is HER VOICE, never loudnormed, bytes downloaded server-side via
  `memos.memoAudioToFile` (memo audio is not public). A memo's anchor is
  PROPORTIONAL (memo chunks carry no clock): the chunk's place in the
  transcript maps to time, and the listen window slides once each way when
  the phrase isn't where the estimate said.
  - **`edgeSpan` exists because the pick text and the cut come from
    DIFFERENT transcripts** (index words vs the fresh listen): `phraseSpan`
    trims unmatched edge words as never-said — right same-transcript, wrong
    here, where a fresh-listen disagreement on an edge word would silently
    cut picked words off. Each edge anchors on its own 6-word sub-phrase and
    reclaims disagreed edge words by position. Its pick tokens are
    AUDIO-SHAPED (first normWords piece per spoken word) — raw `normWords`
    splits contractions ("it's" → it, s), overshoots the audio span, and the
    reclaim then opened clips one word early (measured live).
  - **Verifying a clip by raw-transcribing it LIES about its first words
    (Aug 2026, measured — cost a needless fix cycle).** Whisper drops the
    fast opening words of an abruptly-starting clip, so a correct cut reads
    as "starts late". Pad ~1s of silence on the front before transcribing,
    or locate the clip in its source by RMS envelope correlation against
    word timestamps (the settling measurement both times). Same rule in the
    `sophie-audio` skill.
- **A hit's Play NEVER points at the banked interview audio.** Those files are
  what yt-dlp downloaded — webm/opus, one object per whole interview (the
  Darius one is **62MB**). Play asks the server to cut THAT PASSAGE to mp3 once
  via `editor.extractWindow` (ffmpeg seeking over HTTP — it never pulls the
  whole file), banked at Storage `search-clips/<videoId>-<start>.mp3`,
  immutable-cached, instant ever after. `GET /clip?src=&t=` is a background job
  (`{status:'making'}` → poll → `{status:'ready', url}`). Two reasons:
  **size** (measured — a 56s passage is ~800KB against 62MB; on a phone that is
  the difference between a tap that plays and one that doesn't) and **format**
  (iOS Safari has no WebM audio support; Opus plays there only inside CAF).
  Voice memos skip all of it — m4a, minutes long, streamed through `/audio/:id`.
- **A page that FETCHES audio needs CORS on the bucket, and testing it
  same-origin hides that completely (Aug 2026, the pausing tool).** An
  `<audio src>` needs no CORS, so every media element in the app worked and
  nothing looked wrong — but `fetch()` + `decodeAudioData` (what any WebAudio
  page does) is a cross-origin read and the browser blocks it. Both buckets
  had **zero** CORS entries, so every such page would have failed live while
  passing its tests, because a local test server serves the mp3 from the
  page's own origin. Both now allow GET/HEAD from
  `imageforge-q125.onrender.com` + `secretlyawitch.com` (added, never
  replaced — `bucket.setCorsConfiguration` overwrites the whole list).
  Check it with `curl -D - -H "Origin: https://imageforge-q125.onrender.com"
  <url> | grep access-control` — a missing header is the bug, and it is
  invisible from a same-origin test.
- **Two things about audio CANNOT be tested from a chat's sandbox** (both cost
  real debugging time — don't re-derive them): ffmpeg's **direct HTTP seek**
  fails because the sandbox's outbound HTTPS proxy is one ffmpeg can't use (it
  exits 2 with no message and falls back to downloading the source), and a
  headless browser has **no network to `storage.googleapis.com` at all**, so
  in-browser playback of any Storage URL is untestable — a `MEDIA_ERR code 4`
  there is a network failure, NOT proof of a codec problem. Verify playback on
  the phone.
- **The index** lives at Storage `search-index/index-v1.json` (~10MB, ~600ms to
  load, ~49MB heap) and is cached in process for 15 min. Built from Firestore +
  the memo manifest; a rebuild is FREE of paid APIs and runs as a background job
  via `POST /reindex` (the page has a "Rebuild the index" button). A missing
  index builds itself on first use.
- **IT CATCHES ITSELF UP NOW — nobody re-indexes after an ingest (Aug 2026).**
  It used to move only when somebody tapped the button, and nobody did:
  **measured Aug 2026 it held 1,035 recordings against the archive's 1,137**.
  Anything she had recorded lately returned nothing, which reads as the
  recording not existing — and it silently broke the SLICE IN hand-off
  (Search → Cutting Room) for everything recent.
  - **A sync APPENDS; it does not rebuild.** A full rebuild re-chunks
    everything, which renumbers every position and so invalidates every vector
    — meaning search then wants the ~$0.05 whole-library re-embed. Per memo
    that is ~$5 and gigabytes of Storage traffic for one Mac catch-up run of
    ~100 recordings. Appending leaves every existing position — and every
    embedding already paid for — untouched, so a new memo costs only its own
    ~2 passages, about **$0.000004**.
  - **A recording that is GONE loses its `sources` entry, and its chunks stay
    where they are.** Both searches already skip a chunk whose source is
    missing, so it vanishes from results without renumbering anything behind
    it. `counts.dead` is what that costs in file size — the honest argument for
    an occasional full rebuild, and the only thing a rebuild now reclaims.
  - **Debounced, and the delta comes from the LIBRARIES, not from a queue.**
    `memos.fileIntoArchive` notifies Search (`memos.onFiled` — one listener
    covers the Mac push, the share sheet, a Story Room paste and a chat's
    pasted file, since they all funnel through it); the flush runs after 45s of
    quiet, capped at 5 min from the first mark, so a 100-recording burst is ONE
    index write and ONE tail embed. It then asks "what does the archive hold
    that the index doesn't", so a restart, a crash, an ingest path that said
    nothing, and the 102-recording backlog all heal through the same code with
    nothing to replay. A search arms the same check at most every 30 min as a
    backstop (that is what catches a video ingested straight into Firestore on
    her Mac). Force it with `POST /api/search/sync`; `GET` it to watch.
  - New interview docs are found with a Firestore `select()` id listing (no
    transcript bodies pulled just to ask what's new), and a doc that has no
    transcript YET adds no source — or it would count as indexed forever after.
- **Chunks OVERLAP on purpose** (step 30s / span 48s; memos 700 chars / step
  460). Terms are ANDed, so two words spoken in one breath either side of a
  boundary would find NOTHING — "darius pyramids" really did miss the memo that
  says "Darius is like … he describes how the pyramids are like a chamber"
  because a 700-char cut fell between them. `search()` then dedupes the
  near-duplicate hits overlap creates (by timestamp for interviews, by chunk
  adjacency for memos).
- **A term may match the recording's TITLE instead of its words**, scored well
  below a spoken match and left out of the proximity test. Without it "darius
  pyramids" finds nothing in the one interview entirely about Darius, because
  YouTube's auto-caption mis-hears his name in the first sentence ("my name is
  sh right") and he is never named again.
- **TWO MODES, a chip row under the kind filter.** **WORDS** (default) is
  keyword: ANDed terms, `"quoted phrases"`, proximity scoring, prefix matches
  at a discount, word-boundary matching (so "art" never hits inside "heart").
  Instant and free. **MEANING** is embeddings — "the part where he explains how
  the heart holds the soul in" finds it without knowing a word of the wording.
  Only Words highlights the query in a passage (a meaning hit needn't contain
  the words, and marking nothing would imply the match was lexical).
- **The vectors (Aug 2026, live).** Every chunk embedded ONCE with
  `text-embedding-3-small` at `dimensions: 512` (the model's Matryoshka
  property — a truncated vector still works), re-normalised and quantized to
  **int8**: 12,905 × 512 × 1 byte = **6.3MB** at Storage
  `search-index/vectors-v1.bin` (+ a small `-v1.json` meta), loaded as ONE
  Buffer with no JSON parsing. Native 1536-dim float32 would have been 79MB.
  Whole-library cost was **$0.046**, ~16s; a query costs one tiny embedding
  (~$0.000002) and a linear dot-product pass (~150ms).
- **Vectors are KEYED TO THE INDEX BUILD** (`meta.builtAt`, the model and the
  dimensions must match). Chunk N in the vector file has to be chunk N in the
  index, so a full reindex re-chunks and makes them stale — meaning search
  returns **409 with `code:'stale-vectors'`** (or `'no-vectors'`) and the page
  offers a one-tap re-embed with the price on the button, instead of silently
  ranking against the wrong passages. **`POST /reindex` now re-embeds by
  itself** (`{embed:false}` opts out): a rebuild that leaves meaning search
  broken until someone happens to switch modes is how it stayed broken.
- **A vector file is valid as a PREFIX, which is what lets the index move
  without paying $0.05 (Aug 2026).** Since a sync only appends, vectors
  covering the first N chunks are still exactly right about those N —
  `vectorState()` calls that **partial**, meaning search ranks the N and
  reports `pending`, and the sync embeds the tail (a fraction of a cent). Only
  a real mismatch is **stale**. So a memo filed a minute ago can never break
  meaning search for the rest of the library, and a missing `OPENAI_API_KEY`
  costs the tail, not the mode.
- **Similarity is a RANKING, not a set — hence two floors.** Every chunk gets a
  score, so with no cut-off "the heart holds the soul" honestly reported
  **1,080** passages and pure nonsense still reported 23. Measured on this
  library: a good query tops out ~0.54 and decays slowly, nonsense tops ~0.31.
  So: **absolute floor 0.38** (nonsense returns nothing at all) **plus a
  relative floor of 0.85 × the top hit** (a strong query answers with its
  handful, a vague one can't pad itself out).
- **`embed()` retries transient failures, and that is not boilerplate.** The
  first real run died on a plain OpenAI **500 at 4,800 of 12,905** chunks and
  threw away every embedding already PAID FOR, because one bad response failed
  the whole job. 429/5xx now retry with backoff (5 attempts); a 4xx is
  permanent and fails immediately.
- **`/api/search/audio/:id` widens an existing restriction, on purpose.**
  `memo-audio/**` is readable only by a signed-in Firebase user, and
  `/api/memos/audio/:id` deliberately serves ONLY `cat:'dream'` recordings to
  keep the other ~940 locked down. A hit you can't play isn't a result, so
  Search's own route serves ANY memo — behind the same STUDIO_TOKEN gate. One
  streamer implementation: `memos.streamMemoAudio(id, req, res, {dreamsOnly})`.
- **Routes** (STUDIO_TOKEN gate, only `/status` open): `GET /status`,
  `GET /?q=&mode=words|meaning&kind=&limit=&offset=`, `GET /sources`,
  `POST|GET /reindex`, **`POST|GET /sync`** (catch up with the libraries — see
  above; normally nobody's job), **`POST|GET /embed`** (build/inspect the
  vectors), `GET /clip?src=&t=`, `GET /audio/:id`, `POST /to-editor`,
  `POST /to-cutroom`. Deep link a query with `/search?q=darius`.
- **Tests:** `node scripts/test-search-sync.js` — the append rules, pure, no
  Firestore and no API key (positions never renumbered, a gone recording
  dropped by source not by slot, a failed manifest read never mistaken for an
  emptied archive, and the prefix/stale vector states).
- **Playback gotcha, earned:** the `<audio>` element is `preload="none"`, so
  waiting for `loadedmetadata` BEFORE calling `play()` deadlocks — nothing
  loads until play, so the event never fires. `play()` must be called
  synchronously in the tap (iOS also requires that) and the seek hangs off
  `loadedmetadata` as a backstop.
- iOS: `SearchView.swift` = the Episode Editor wrapper pattern (native
  `.forgeToolBar("Search")`, chevron asks `window.__navBack` then the web
  view's own history — a memo hand-off really does navigate to
  `/cuttingroom` — `__nativeNavBar` injected, audio paused on screen
  changes). Page changes ship via Render deploy; the wrapper needs TestFlight.

## Cut Marks (mark your own cuts on a playhead — video or audio)
- `cutmarks.js` (`/api/cutmarks`, page at `/cutmarks`, iOS tile "Cut Marks",
  SF Symbol `timeline.selection`, deep link `deckfactory://cutmarks`) — the
  **manual** sibling of the Cutting Room (Aug 2026, Sophie's ask): no
  transcript, no waveform — she plays the file, taps the scissors at the
  exact spot, and the marks split it into PIECES she keeps or drops; render
  bakes one new file. Opens recordings from the audio drop AND videos from
  the Dump (`media:'video'` docs) — one room either way.
- **The transport is small on purpose** (Sophie rejected the big five-speed
  shuttle in the mockup: "just to keep playing the video"): a slim horizontal
  three-button pill — back 2s · play/pause · forward 2s — plus tap-the-strip
  to jump. Precision lives on the MARK, not the playhead: each mark row has
  −.1/+.1 nudges and tap-its-time-to-jump. Everything is a tap (wrist rule).
  **The transport sits CENTERED right under the video/audio card** (Aug 2026,
  Sophie: "so it's right there"), not in the bottom bar; the fixed bottom bar
  is just time + the MARK scissors. **Undo, render and "?" are SMALL header
  icons** (30px, top-right before the pill's reserved corner) — undo is a
  session-only snapshot stack (marks + drops, capped 40); renders never
  overwrite anything so they need no undo. In native builds the page hides
  its EYEBROW too (`body.native .eyebrow`) — the nav bar already says CUT
  MARKS and Sophie flagged the double.
- **Dropped pieces are keyed by the piece's times, and every mark edit REMAPS
  them by piece index** (`droppedIdxSet`/`setDroppedByIdx` in cutmarks.html):
  a nudge keeps the same pieces, an added mark splits one (both halves stay
  dropped), a removed mark merges two (merged piece stays dropped only when
  both halves were). Without the remap, nudging a boundary silently
  un-dropped the piece beside it — caught in testing, don't regress it.
- **Renders are exact cuts at the marked times.** Audio: one atrim+concat
  filtergraph with 12ms edge micro-fades so a manual cut never clicks — NO
  loudnorm (her voice rule), channels kept. Video: ONE `filter_complex`
  trim/atrim+concat pass with a single encode (libx264 veryfast, aac) —
  deliberately not per-piece files + concat demuxer, because concatenated
  AAC pieces add ~24ms priming per join and walk the sound off the picture
  (the Scratch Pad film finding). A soundless video renders video-only
  (`hasAudio` probed at open). Audio renders also file into the audio
  library (batch `cut-marks`, track `cutmarks`, hash-deduped).
- **Data:** one doc per file in `forge-cutmarks` (deckfactory),
  content-addressed by sha1 of the url (reopening resumes): `{ id, title,
  kind, source, seconds, hasAudio, marks:[t], dropped:[key], renders (capped
  8), job }`. `POST /:id/state {marks, dropped}` saves the whole marking
  state (the page debounces 600ms, flushes via sendBeacon on pagehide).
  Probe + render are background jobs on the doc (house rule); the page polls
  and resumes from `localStorage['cutmarks_open']`.
- **Routes** (STUDIO_TOKEN gate, only `/status` open): `GET /sources`,
  `GET /`, `POST /open {url, name, kind, itemId, poster}`, `GET /:id`,
  `POST /:id/state`, `POST /:id/title`, `POST /:id/render`, `GET /:id/job`,
  `DELETE /:id`. Tests: keptSegments/audioGraph/videoGraph are exported;
  render graphs validated against real files (exact durations), page flow
  validated headless (playwright).
- iOS: `CutMarksView.swift` = the Episode Editor wrapper pattern (native
  `.forgeToolBar("Cut Marks")`, chevron asks `window.__navBack`,
  `__nativeNavBar` hides the page back button, media paused on screen
  changes — `audio,video` both). Page carries the injected shared pill;
  native pill suppressed in RootView's `showAutoScroll`.

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
  `refs/dream-mystery.jpg` (gpt-image edits) then animate with Wan (`VIDEO_MODELS`
  in `movies.js`). See also `what-sage-should-do-at-her-computer.md`.
