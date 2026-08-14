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

**The name.** Sophie's, Aug 2026: *"I like the name chunking but Clips is the
one that makes more sense so we'll call it chunking for now."* So the tile, the
page title and `/chunking` say **Chunking**; the module, the routes, the
collection and this doc say **clips**, because that is what the things are and
it is what a future chat greps for. `/clips` serves the same page.

**Why it exists.** Every film in this app is stitched out of short
self-contained pieces, and each piece was only ever reachable through the ONE
film it was made for. Re-cutting a film with a different emphasis meant
regenerating clips that already existed, because nothing could answer "show me
every clip of the woman on the bench". Chunking is the shelf of those atomic
pieces — the things that get assembled INTO videos and never taken apart.
**It generates and stitches nothing.** It is a shelf and a search box, so it
spends no money at all; a harvest costs time and bandwidth.

**What it holds (measured on the first real build, 2026-08-14): 350 clips.**
Harvest reads three Firestore sources — a movie's per-scene clips, their
`clipHistory` re-rolls (tagged `alt`), its dream `bridges`, and every
quick-animate — and then **sweeps Storage for every other video**, because most
of the shorts were built by chats straight into their own prefixes
(`exile-film/clips`, `hospital-film/pairs`, `witch-shorts/*`, `nde-anim/*`,
`story-shorts/*`, `dinner-party/takes`) and never went through `movies.js` at
all. The sweep gave 296 of the 350; Firestore knew about 54 scene clips and 44
quick-animates.

**The skip list is the load-bearing half of the sweep**, and it was corrected by
running it and reading what it filed rather than by reasoning: the first pass
filed 77 whole hour-long YouTube interviews (`nde-audio/`) and 11 finished
episodes. `SKIP_PREFIXES` now also excludes finished films and supercuts, Cut
Marks renders (whole recordings re-baked), `drops/` (the Dump — her raw phone
footage is a source library, and a phone video is exactly the thing you WOULD
take apart) and `scratchpad/film-cache`, which is not footage at all but an
encode cache of single stills held for a duration. `SKIP_SEGMENTS` catches a
`combined/` or `films/` folder anywhere in a path.
- **The skip list is RECONCILED on every harvest**, so a correction reaches a
  library that was already built: a swept record the current rules would no
  longer file is deleted — unless Sophie has edited it, because her edit means
  she wants it there.
- **A swept file that probes longer than `MAX_SWEEP_SEC` (180s) is a video, not
  a clip.** It is HIDDEN with a `hiddenReason` rather than deleted, so it is
  readable rather than mysteriously absent.

**Search is the whole interface, and `searchClips` is a pure function** (the
tests drive all of it). Bare terms are ANDed, `OR` between two terms binds
TIGHTER than that implicit AND (`a b OR c` = a AND (b OR c)), `-term` / `NOT`
excludes, `"quotes"` keep a phrase whole, and `tag:` `title:` `from:` `prompt:`
`note:` aim a term at one field. There are deliberately **no parentheses** — a
phone search bar is not a place to balance brackets, and everything she
described is expressible without them.
- **A bare term searches the film it came out of too**, so the film's name finds
  its scenes; `title:` is how you narrow that.
- **The generation PROMPT is what makes the library findable**, and it comes
  free with every clip `movies.js` made — it is the only text on the record that
  says what is actually happening in the picture. A swept clip has none, which
  is why its folder becomes tags.
- Ranking is by field weight (title 4, tag 3, source 2, prompt/note 1) with a
  whole-word bonus; with no query the shelf is newest-first.
- **MEANING/semantic search is deliberately not built** (Sophie: "we might have
  to do that later if it's hard"). `search.js` already owns the int8-quantized
  embedding machinery to bolt on — and the prompts are the text worth embedding.

**Posters are the point of the grid**, so harvest is two phases: listing (cheap
— Firestore + Storage metadata, files every doc immediately) then posters
(ffmpeg, one frame each, ~1.6s per clip measured). The frame is taken a third of
the way in, capped at one second: frame zero of a generated clip is usually the
still it was animated FROM, so every panel-pair would tile identically, and on a
fade it is simply black. webp, ~25KB each, into `clips/posters/`.
- **The bytes come from the Admin SDK, NOT from the url.** ffmpeg can read https
  directly and the first version did — but a chat's sandbox sends outbound HTTPS
  through a proxy ffmpeg cannot speak to, and **all 350 posters failed with an
  empty error** (2026-08-14). `googleapis` works everywhere the rest of the app
  works, and for a clip already in our bucket it is the shorter route anyway. An
  external url (a hand-added clip) still goes through fetch.
- ONE download serves the duration, the frame size and the poster, and it is
  deleted before the next clip starts — 350 clips would otherwise be a gigabyte
  on a 512MB instance.
- The phase stops at a wall-clock budget (`POSTER_BUDGET_MS`, 9 min) and reports
  `postersLeft`; a re-run resumes. `scripts/harvest-clips.js` lifts the budget so
  a first build finishes in one go.
- A clip whose frame cannot be read still belongs in the library — it just tiles
  without a picture, marked `posterFailed` so the next run doesn't retry forever.

**HER EDITS ALWAYS WIN.** The doc id is `sha1(url)`, so a re-harvest updates the
record it already made; `upsert` skips every field listed in `edited`, which the
PATCH route appends to. Tags MERGE rather than replace, so a tag she added by
hand and a tag the sweep derives coexist. Nothing in this module deletes a clip
from Storage — dropping one from the shelf removes the record only.

**The page** (`public/clips.html`, `tool.css`, `body.tool`) is the Story Room's
shelf, which is the look she named: four to a row, the poster at 2:3, the name
under it clamped to two lines, a duration badge in the corner. A filter chip
writes its term INTO the search box rather than being a second piece of state,
so there is only ever one thing to understand. Tapping a clip opens it over the
page (locked + scroll restored, house rule) with the video, its name, tags and
notes editable in place, the film it came from, and its prompt. The rebuild
button lives behind the `?`.

Routes (mounted at `/api/clips`, `STUDIO_TOKEN` gate, only `/status` open):
`GET /` (`q` `tag` `source` `sort` `limit` `offset` `hidden`) · `GET /facets` ·
`GET /:id` · `PATCH /:id` (title/tags/notes/hidden only) · `DELETE /:id` ·
`POST /add` · `POST /harvest` (`force:true` takes over a wedged job — this one
is library-wide, so a stale job blocks the whole tool) · `GET /harvest`.

Tests: `node scripts/test-clips.js` — the grammar, the ranking, the naming rules
and the skip list against fixtures, no network.

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
- **A chat files a pasted recording with ONE call — never reconstruct the
  stamp by hand:** `POST /api/memos/ingest?title=…&dur=…&ext=m4a` with the
  raw bytes as the body. `stamp` is optional; without it the server derives
  one from the file's internal clock and the **md5 of the bytes** does the
  real deduping (every manifest record carries `hash`). The internal clock
  is the moment recording STOPPED, which is why hand-built stamps went wrong
  (2026-08-05: filed `_1330`, her phone said 1:28) — don't guess it.
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
  fallback. **`OFFERED_VOICE_IDS` is an explicit ALLOWLIST** — empty would
  sweep in every Voice Library professional on the account. Cloning someone
  new = add the id + a colour there.
- **Her words STAY in the box** (Sophie, Aug 2026): a render does not empty it
  and neither does leaving the page (`localStorage['voicelab_text']`), because
  she runs the same line through voice after voice. **Clear** is the only
  thing that empties it, and it only shows when there is something to clear.
- **TWO TABS — SPEAK · CHANGE (Aug 2026, Sophie: "a separate hairline tab in
  the voice studio").** The house `.acctabs` hairline pattern. The tabs swap
  only the LOWER half; **the voice picker is SHARED**, because "which voice"
  means the same thing on both sides (words to say / voice to become).
  - **CHANGE is speech-to-speech** — `POST /v1/speech-to-speech/{voice}` on
    **`eleven_multilingual_sts_v2`** (verified live against `/v1/models`:
    `can_do_voice_conversion`, 29 languages). It keeps the PERFORMANCE —
    timing, emphasis, where a laugh lands — and swaps only the voice, which
    is the whole reason it isn't just TTS. **No v3 here either**, same rule
    as her TTS.
  - **Two ways in: record in the page, or choose a file** (a Voice Memo, once
    it is in Files). `recMime()` asks the browser what it can record —
    **iOS Safari has no WebM, `audio/mp4` is what it records**, so never
    assume a container. Recording needs `mic: true` on the `/voice`
    `GatedWebTool`; the file picker works with no build.
  - **The SOURCE is uploaded to Storage BEFORE the conversion is attempted**
    (`voice-lab/sources/<id>.<ext>`, her ask: "the recorded voice will also
    save to firebase"), so a failed or refused conversion still leaves her
    the take. A finished change plays BOTH halves.
  - **The take SURVIVES the send**, the same reason her words do.
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
  the memo manifest; a rebuild is FREE (no paid API) and runs as a background
  job via `POST /reindex` (the page has a "Rebuild the index" button). A
  missing index builds itself on first use. **Re-index after ingesting new
  videos or a batch of memos**, or they aren't findable.
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
- **Vectors are KEYED TO THE INDEX BUILD** (`meta.builtAt` + chunk count must
  match). Chunk N in the vector file has to be chunk N in the index, so a
  reindex that re-chunks makes them stale — meaning search returns **409 with
  `code:'stale-vectors'`** (or `'no-vectors'`) and the page offers a one-tap
  re-embed with the price on the button, instead of silently ranking against
  the wrong passages. **Re-embed after any reindex that changes chunking.**
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
  `POST|GET /reindex`, **`POST|GET /embed`** (build/inspect the vectors),
  `GET /clip?src=&t=`, `GET /audio/:id`, `POST /to-editor`, `POST /to-cutroom`.
  Deep link a query with `/search?q=darius`.
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
