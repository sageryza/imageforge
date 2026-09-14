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

**`GET /pads` DOES NOT CARRY `audios` OR `sources` — only the per-story
`GET /?pad=<id>` does (measured 2026-08-20, after it cost a chat real
mistakes).** The list endpoint returns id/title/cover, so an audit that walks
it sees every story as audio-less and concludes **nothing was ever attached**
— which is exactly wrong when a story already holds five recordings. That
chat then reported the five set-theory memos as missing, and "restored" audio
onto stories that already had it. **Check attachments per story, one GET
each** (~60 calls for the whole shelf, all cached reads, no cost), or you are
reading a field that isn't in the response. Same trap for `episodes`.

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

## Leaving a beat fills the empty half (2026-09-06)
**Sophie: "caption and drawing prompt shud auto copy into each other if i
leave the beat and one exists but the other doesn't."** `fillEmptyHalf()` runs
first thing in `closeBeat()`: a beat with a drawing prompt and NO caption gets
the prompt's words as its caption, through `saveNote()` → `POST /text`, so it
is STORED — the tile's caption, the film's voice (`ttsFor` reads `text`) and
the Caption box all carry the words. The other direction is deliberately NOT
a write: an empty prompt already FOLLOWS the caption (`promptOf`, the hint
line under the box), and `POST /prompt` deletes a stored prompt equal to the
caption's drawable form, so copying it would be undone by the server. A beat
with both, or neither, is left alone. Test:
`node scripts/test-storyroom-caption-copy.js` (the real page against a stub
that records what is POSTed).

## The caption shows three lines, then `… more` (2026-09-06)
**Sophie: "caption shud default to showing, but truncated if long, tap to
show more."** The Caption fold still opens OPEN on arriving at a beat; the
words (`#captext`) are now clamped to three lines behind the house `.moretxt`
opener, MEASURED (`capClamp`, the `auClamp` pattern — a short caption carries
no opener at all), and `setCapText()` is the one writer of the words so every
path that changes them re-measures. Tapping the opener shows the whole
caption and it reads `less`. Test: step 5 of
`node scripts/test-storyroom-caption-copy.js`.
## The typed cast — Pictures · Descriptions behind the character button (2026-09-06)
**Sophie: "also add the character description feature as an option that's not
character image, like playground. u can copy the code."** The Playground's
Descriptions half, brought to the Story Room's character sheet: a hairline
**Pictures · Descriptions** row (`#chartabs`, the same `.acctabs` measurer as
the inbox's tabs — measured AFTER the sheet is shown, since a hidden row has
no width), name + one-line description rows (`#castrows`; Enter refused, a
pasted newline collapses to a space — `castBlock` writes one character per
line), a bigger-box toggle per description, and the clause disclosed at the
foot from the SERVED `window.__sheetGrid.castBlock`, so the page holds no copy
of the wording. **The cast lives on the PAD** (`pad.cast = [{name,
description}]`, `POST /api/scratchpad/cast {pad, cast}`, whitelisted, no
`updatedAt` bump, out of `dirtySinceFilm`) — a story's cast is the same for
every beat, unlike the Playground's per-run cast — and the server writes the
clause into every draw's prompt itself (`artPrompt` reads `pad.cast`; the
page sends no cast on `/generate`). An empty cast writes NO clause. The badge
on the button counts pictures + descriptions; the tab she left it on is
remembered. The rows reserve the pill's 56px column. Tests:
`node scripts/test-scratchpad-cast.js` (the clause and the routes, pure) and
`node scripts/test-storyroom-cast.js` (the real page headless).

## Chapters (2026-09-06)
**Sophie, on her hospital story ("nautchaug", ~50 beats): "i want the chapter
within a story. arrow buttons at the top, and a contents page w all the
stories and thumbnails".**

**The data is one string on one beat.** `beat.chapter = 'The ER'` marks the
beat that OPENS a chapter; the chapter runs until the next beat carrying one.
Nothing stores a chapter list — `chapterList()` in the page derives it from
beat order on every paint — so a beat she moves takes its heading with it, a
beat she deletes takes the heading away, a duplicate story (`dupPad` deep-
copies beats) carries them, and there is never a second copy of the order to
drift. `POST /api/scratchpad/chapter {pad, id, title}` sets it; `title:''`
clears it. **No `updatedAt` bump** (the /style, /pads/pin family) and the
page's `api()` leaves `/chapter` out of `dirtySinceFilm`: chapters are not
cuts, the film is made of the beats' pictures and words, and naming a chapter
must not stale a fresh render or reshuffle the shelf.

**The canvas shows ONE chapter at a time (2026-09-06, the same day, Sophie:
"is there a view where i see just one chapter at a time. it's getting
overwhelming").** `render()` filters the units to the chapter's span
(`from`/`to` on each `chapterList()` entry — the first chapter's span starts
at beat 0, so beats before the first marked one are shown somewhere), ‹ ›
and a contents tap swap which chapter (`setChapView`, which re-renders and
scrolls to the top), and `chapView` is remembered per story in localStorage
(`scratchpad_chap_<pad>`) so reopening a story lands on the chapter she was
reading; `openPad` resets it. A remembered chapter that has since gone (its
beat renamed or moved) falls back to the chapter holding that beat now, never
a blank canvas. **Whole story** is the first row of the contents sheet — the
one way back to the scroll-through canvas, where the arrows scroll the window
and the row names the chapter under the sticky block exactly as below. A
placing slot at the END of a chapter view lands at `view.to`, the true index
into `beats`, so a picture dropped after a chapter's last beat sits before the
next chapter's first. A story with no chapters is byte-for-byte untouched.

**Three surfaces, none of them on the canvas** (the pad's rule — no machinery
between the beats; a chapter is never a label on the grid):
- **The ‹ chapter › row**, inside `#topchrome` so it is pinned with the
  chevron and the buttons, and only drawn once the story has a chapter. ‹ and
  › scroll the WINDOW so the previous/next chapter's first tile sits just
  under the sticky block (instant, after `__scrollStop`); the name between
  them is the chapter she is IN, with its place (`The Matrix 4/10`).
  "In" is compare.js's `__pagePlace` rule — the last chapter whose first
  tile's top has passed the block's bottom, else the first — with one
  addition: **the aim.** A short LAST chapter can never pass under the block
  (the page runs out first), so by the top-edge rule alone › would scroll to
  the end and the row would keep naming the chapter before it. A jump
  remembers where it landed (`chapAim`), and while the window still sits
  exactly there the row names the chapter she asked for; her first scroll
  away hands the rule back. Tiles are found by `data-beats` on each
  `.beatwrap` (a chunk is one wrap), which cannot go stale on a kept node
  because a node is only kept on an identical `unitSig`.
- **The CONTENTS sheet**, behind the name: a `.sheet` like the shelf — the
  page's own header, back chevron, no ✕, its own pill (`sheetPill`). One row
  per chapter: the first beat's picture through `/api/story/thumb` (or the
  first beat in it that has one), the name, `N beats`; the row she is in is
  lit; a tap closes the sheet and jumps. On `__navBack` it is a level like
  the About sheet.
- **The bookmark on the Caption line** of a beat's card (`.tlabrow`). A beat
  that opens a chapter shows its name in the header caps beside a lit,
  filled bookmark; every other beat shows the quiet outline alone. The
  bookmark TOGGLES a small box that ships EMPTY (its placeholder names the
  field and nothing more — reopening shows her own saved word, which is her
  text). Return blurs; blur SAVES; an emptied box takes the chapter off.
  **Blur also CLOSES the box here, unlike the caption pencil**: the pencil's
  reason is a card that reshuffles between mousedown and mouseup, and this
  one-line slot cannot reshuffle (words and box share it, the bookmark keeps
  its place). The one tap blur could eat is the bookmark's own, so
  `pointerdown` on it marks the blur as the button's and the tap closes the
  box once instead of closing and reopening it. `closeBeat` saves it like
  the caption and the prompt.

**Seeding by her words:** `node scripts/seed-story-chapters.js` (dry by
default, `--go` writes, `--pad`/`--plan` for another story) finds each opening
beat by a phrase in its caption OR its drawing prompt — on the hospital pad the
words live in the prompts — first match in beat order, refuses a phrase nothing
carries, and **refuses a story already carrying a chapter** (by then she is
naming them herself). Her hospital story's ten were seeded 2026-09-06 as a
starting point: Before · The ER · The ward · The Matrix · The tag guy's wife ·
The boys · Jake · The pills · The doctors · Getting out.

**Not done, on purpose:** no chapter title card in the film (the render is
unchanged), and Charlie's and Evan's old headings from `forge-story` are not
ported — hers to ask for. Test: `node scripts/test-storyroom-chapters.js`
(the real page headless: the row and its pill clearance measured, › and ‹ as
the window really moving and the tile landing under the block, the hand
scroll renaming the row, the sheet's rows/counts/thumbnails decoding and its
tap, the field's POSTs and that none of it stales the film).

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
  size (never blown up — Sophie's spec), five color chips (gray/
  mustard/green/blue/pink) that set the FRAME color and keep the popup
  open — **each carrying her own word for what that colour means since
  2026-08-26 (see WHAT THE COLOURS MEAN below); the pad and the frames
  still say nothing**, and a three-line text box (`beat.text`, saved on close). The story TITLE sits
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
  made or swapped from ONE row of icons UNDER the picture, there whether or
  not there is a picture yet:
  **THE POPUP WAS REMODELLED 2026-08-24 (Sophie, one message: "the whole
  popup gets bigger, so there's only room enough to comfortably see behind
  it. similar aspect ratio as total screen (not square)" · "that image is
  bigger by default" · "stars, playground and inbox buttons get put into
  rounded squares and go under the main (currently chosen) image" · "colors
  become one multicolored rounded square in the corner, drop down" ·
  "drawing a new picture replaces the old, but keeps it in the stacked
  squares icon" · "two text boxes: caption, and drawing prompt. drawing
  prompt is collapsed by default, and uncollapsing draw prompt automatically
  collapses the caption but can be manually expanded again").** Every one of
  those is a MEASUREMENT, which is why `node scripts/test-scratchpad-popup.js`
  drives the real page in headless Chromium rather than grepping markup —
  "square" is two numbers that must match, "under the image" is a y
  coordinate, "multicoloured" is counting distinct fills, and "screen-shaped"
  is the card's own ratio against the viewport's.
  - **The card is `height:100%` of a padded fixed inset**, which IS the
    screen's shape minus the strip of pad left showing all round it — and
    that strip is still the tap-out target. It used to be only as tall as its
    contents, so a beat with a small picture left a squat card mid-screen.
  - **The picture is sized by CSS inside `#artwrap` (flex:1, min-height:0),
    never by a pixel width in JS.** It was pinned to the pad tile's ~90px — a
    thumbnail of a thumbnail — and max-height/max-width keep a 2:3 drawing its
    own shape at any screen size. Measured on a 390pt phone: 79px → 273.
  - **`#popblank` no longer carries its own two icons.** The star, the
    Playground and the inbox live in ONE row of 38px squares under the
    picture whether or not there IS one, so there is a single place to make
    art rather than two that drift apart. The stacked-squares button joins
    that row and appears only once a draw has actually replaced something.
  - **The colour button stays multicoloured even when a colour is picked** —
    the pick is already legible on the picture's own frame, and a single
    filled square stops reading as "colour" at a glance.
  - **`setBoxes(capOpen, promOpen)` is the one switch** behind both text
    boxes. Opening the prompt folds the caption away; CLOSING it leaves the
    caption as she left it rather than forcing it back open.
  - **THE PROMPT BOX IS NOT THE CAPTION, AND AN EMPTY BOX SAYS WHAT IT WILL
    DRAW (2026-08-24, Sophie: "I just made an image and it sent the wrong
    prompt. I think it sent it from the caption part not the drawing
    part").** It shipped seeding `#dprompt` with the caption's words whenever
    the beat had no prompt of its own — so the two labelled boxes showed the
    SAME text, nothing on screen distinguished "this beat has its own prompt"
    from "you are about to draw the caption", and typing into the only box
    that was open (the caption) then tapping Draw sent the caption. Measured
    on the real page before the fix: caption "A RED DOOR IN THE SNOW" → the
    prompt box seeded with it → `/generate` sent it.
    - **The box now holds ONLY her stored `beat.prompt`** — that is her own
      text, which is the one thing the never-pre-written-text rule allows a
      box to open with. Empty is the honest default.
    - **Empty still draws, from the CAPTION, live.** `drawPrompt()` is the
      single place that decides — typed prompt, else the caption box's
      current value with speech markup stripped — so the hint line and the
      Draw button can never disagree. Reading the caption box rather than the
      last SAVED text is what keeps the older "it doesn't take the words I
      put in" fix working.
    - **`#promhint` under the box says `empty — this beat draws from its
      caption`** and clears the moment she types. It is CHROME under the
      field, never text inside it.
  **sparkles = draw it here** (`POST /generate {id, prompt, quality,
  character}` — background job on `beat.gen`, gpt-image-2 edits at 1024x1536
  with `refs/sage-sandy-mirror.png` as the style ref and, by default,
  `refs/sophie-book.png` as the character card; quality low/medium/high
  default medium, NO style picker — one style per story; superseded art
  goes to `beat.imageHistory`, never deleted. **The draw box holds the
  beat's OWN PROMPT since Aug 2026** — `beat.prompt`, its own field, so
  tuning what a picture shows never rewrites what the film says. It saves
  ITSELF (`POST /prompt {id, prompt}` on blur / closing the popup / Draw —
  no save button, her rule), seeds from the words with speech markup
  stripped when empty, and a prompt edited back to just-the-words is
  CLEARED server-side so the beat keeps following its note; `promptFor` in
  scratchpad.js / `promptOf` on the page are the one fallback rule, pinned
  equal by `node scripts/test-scratchpad-prompt.js`), palette → `/playground?from=scratchpad`, inbox → pick a
  hearted image straight INTO that beat (`POST /image {id, url, src?}`).
  **Draw-the-missing (Aug 2026):** a wand icon on the title row (visible
  only when some beat has words but no art) → a confirm box stating count
  and cost (`POST /drawall {quality}`, default LOW) → every such beat draws,
  two at a time. Chunk siblings without their own text are deliberately
  skipped (their art is the hand-made literal→metaphorical pair), and
  the wand draws each beat's `promptFor` — a stored prompt stays tuned in
  the bulk pass, and speech-only markup ([pause], <break/>) is stripped
  wherever words become a prompt, the single-beat seed included. Safe to
  re-tap: it only ever draws what is still missing.
  ART.prefix / ART.characterLine in scratchpad.js are COPIES of
  PL_GPT.prefix / PL_GPT.characterLine in server.js — keep all three
  identical. `/scratchpad-sophie.png` serves the character card to the
  toggle (refs/ is otherwise never web-served). **Versions (Aug 2026):** once a
  beat has more than one generation, the popup shows every one as same-size
  thumbnails, newest first, current ringed — tap for the lightbox
  (`beat.imageHistory` + current). **The lightbox is THE SHARED ONE since
  2026-08-28** (`/asset-lightbox.js` — Sophie: "create a single lightbox view,
  sync to all surfaces … ex assets, meta assets, story room, playground"): the
  page builds none of its own. What it needs rides the shared file's hooks —
  `nav` steps through `lbVers` (the past-pictures row's own order), `cta` is
  the labeled "Use this one" (a hook built for this page: she picks by
  looking, and an icon circle cannot carry that), and `onClose` re-asserts the
  beat popup's body lock, because the lightbox opens OVER the popup and the
  shared close clears `body.overflow`. The one page-level rule is
  `#clightbox{z-index:60}` — this page's overlays run sheet 40 / beatpop 50 /
  filmplay 70 and the shared file ships z-index 30. Closing follows the shared
  contract everywhere now: a tap on any dead space closes, a tap on the
  picture never does. Tests: `node scripts/test-scratchpad-pick-version.js`,
  `node scripts/test-storyroom-lightbox-nav.js`, and the source pin in
  `node scripts/test-asset-lightbox.js`. **Delete a beat** from its popup's trash
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
- **CHARACTER REFERENCES — the story's CAST (2026-08-26, Sophie: "attach one
  or more character references … the characters could exist at the top of the
  story and then there could be like an add character card button and then
  through there I pick one or multiple of the characters that are for the
  story so it's two taps to add a character instead of one, and there's only
  one button not multiple").** A character is `{id, name, url}` on the pad
  doc (`characters`): a reference image plus the NAME a drawing prompt calls
  them by. The rules live in **`pad-characters.js`** (pure, tested without
  node_modules — the pad-art pattern); scratchpad.js holds the routes.
  - **Managed at the top of the story** — the `users-round` icon in the icon
    row opens the Characters sheet: + adds a card (bytes ride the Dump's
    `/api/drop/upload-file`, HEIC→JPEG, md5 dedupe — never a second upload
    path; `POST /api/scratchpad/character {url, name?}` files the finished
    url, `{id, name}` renames, `/character/remove` takes one off the list —
    the image itself is untouched). Cap 30 per story, names 60 chars.
  - **ONE button on the draw row** (`#dchars`, her rule: "only one button not
    multiple") opens the SAME sheet in pick mode — tap cards to toggle them
    in, two taps per character. The count badge on the button is the
    disclosure that references are riding the next draw. The picked set is
    NOT persisted (the Playground's photo-ref rule): it lives for the page
    visit and resets on a story switch or reload.
  - **They ride EVERY style, LAST** — behind the style reference(s) and, on
    watercolor, behind the Sophie card — so one disclosed line ("the last
    attached image(s)…", `charLine()`) stays true everywhere. The line says
    **"NOT a style reference"** on purpose: pastel's prefix claims every
    attached image as a style reference and dreamy's suffix re-asserts its
    own, so the carve-out is explicit; on recipe styles the line rides AFTER
    the suffix (last word wins), on watercolor in the head beside the Sophie
    line. With none picked every prompt is byte-for-byte what it always was.
    Capped at 6 per draw — each reference is paid input tokens (~1.2¢).
  - `/generate` takes `characters:[ids]`, resolved against the pad's own cast
    (story order, deduped; an unknown id is dropped so a stale page never
    fails a draw). Provenance: the gen record and `swapArt`'s src carry the
    names, and the gallery filing's promptPrefix/Suffix include the line.
  - `/character*` does NOT stale the film and does NOT bump `updatedAt` —
    the cast list is not on the timeline; a draw that uses one is.
  - Tests: `node scripts/test-pad-characters.js` (the line, the pick, the
    caps, and source pins on both halves of the wiring).
- **THE STORY'S SHAPE — portrait or SQUARE (2026-08-28, Sophie: "add a new
  square story type in story room").** A story is ONE shape all the way down:
  the canvas its beats are drawn on, the tiles on the pad, the past-pictures
  strip, the popup's blank paper and the film's frame. Stored as `pad.shape`,
  written by `POST /api/scratchpad/shape {pad, shape}` — and **decided
  automatically from the story's first picture, with NO control on the page**
  (see below). It shipped with a small toggle at the far end of the style row
  for one afternoon and she asked for it to go the same day the automatic rule
  landed: "get rid of button". That glyph (a tall rectangle, or a square) and
  its reasoning are history, not a rule.
  - **The list is `SHAPES`, once in `scratchpad.js` and once in
    `gen-scratchpad.py`, pinned equal by the test.** Portrait draws 1024x1536
    and films 1000x1500; square draws 1024x1024 and films 1080x1080. Nothing
    counts them — landscape is a row in each.
  - **PORTRAIT IS FIRST, AND FIRST MEANS THE FALLBACK.** `shapeOf` on the
    server and `SHAPES[0]` on the page both land there, so a pad carrying no
    `shape` — every story made before this — is byte-for-byte what it was.
    `POST /pads` writes no field at all unless a shape is asked for, so the
    shelf's + still makes a portrait story.
  - **It lives on the PAD, not on a beat.** Half a story square is a film
    that letterboxes every other shot. `movie.aspect` in movies.js is the
    same call, and it is the only other per-project shape in the repo.
  - **The page reads ONE variable — `--ar` on the root**, set by
    `renderShape()`, with `2/3` as the CSS fallback everywhere. **The inbox
    is deliberately not on it**: those tiles are Playground pictures of every
    shape, not this story's, and cropping them to it would misdescribe what
    she hearted.
  - **`POST /shape` IS TOP-LEVEL ON PURPOSE.** The page marks the film stale
    for any POST outside its allowlist, and `/pads*` is on that list — that
    family is shelf TIDYING (folder, category, pin), which must never stale a
    render. A shape change moves the film's frame, so it has to fall outside.
    Like `/style` it does NOT bump `updatedAt`.
  - **Nothing already drawn is touched.** A portrait picture in a story
    flipped square is kept and letterboxed on white by the film's own
    scale+pad chain — the pad has never destroyed a picture. The frame is IN
    the segment cache key (`${frame.w}x${frame.h}@fps`), so a flip re-encodes
    its shots rather than serving the other shape back out of the cache, and
    flipping back finds them still banked.
  - **The shelf keeps ONE tile footprint** — that is what holds the names
    level across a row — so a square story's cover sits WHOLE on the white
    mat (`.stile .frame.sq img{object-fit:contain}`) instead of being cropped
    to a portrait tile. A folder takes the shape of the story whose cover it
    is showing.
  - **The square film frame is 1.17MP against portrait's 1.5MP**, i.e. UNDER
    the size the OOM note beside `FILM` proves this 512MB box survives. The
    pixels are the budget, not the width; a third shape has to stay inside
    the same number, and the test fails if one does not.
  - **THE SHAPE FOLLOWS THE STORY'S FIRST PICTURE (2026-08-28: "automatic by
    first picture", then "get rid of button").** The first picture PLACED on a
    story decides it, and there is nothing on the page to override that — a
    control beside an answer the story already has is a second way to say one
    thing, on the row she reads for the style. Every door gets it, because
    the decision is made server-side as the picture lands: `POST /add`,
    `POST /image` (her inbox pick, a version picked back, the send-trip
    match) and `landOnBeat` in server.js (a Playground run she sent to a
    beat). `autoShapePatch` is the one rule and it is exported for that last
    one.
    - **"Nobody has decided" is one field — a pad with no `shape` at all.**
      The rule fires once, so the picture that fired it is the one that
      decided, and `POST /shape` (a chat correcting one on her ask) is the
      last word after that. The `catBy` rule, spelled with the value's own
      presence rather than a second field to keep in step.
    - **The first picture DECIDES, portrait included.** Writing portrait is
      what makes this happen once; leaving it unwritten would let the third
      picture in a story re-decide it.
    - **A picture the pad DREW never decides it.** It was drawn AT the
      story's shape, so reading it back can only confirm the default — the
      test fails if the rule is ever wired into `runArtJob`.
    - **A picture that is neither shape decides NOTHING** (`SHAPE_AUTO_TOL`,
      ±22% measured in log space so both shapes are judged evenly). A 16:9
      clip poster and a landscape phone photo leave the story portrait and
      still open for the next picture. 3:4 is near enough to portrait and
      lands there.
    - **The size comes from the picture's HEADER** — a ranged request for the
      first 4KB, never the whole 1-3MB original — parsed by `image-size.js`.
      **That file exists for a measured reason: sharp reads a truncated PNG
      and JPEG header and REFUSES a truncated webp**, which is the format
      nearly everything here is stored in, so a sharp-only ranged read would
      have fallen back to downloading whole originals on exactly the common
      case. sharp stays the fallback for a format it does not know, and
      `test-image-size.js` re-measures that claim so the note cannot go stale.
    - **Read BEFORE the write, re-checked INSIDE the transaction.** The read
      is a network call, so another placement can decide while it is waiting;
      both writers ask again against the snapshot they are writing on.
    - **The placing routes answer with `shape`**, and the page applies it
      without posting it back — the server has already written it, and her
      first picture landing is the one moment she is looking at the tiles.
  - `dupPad` copies the whole doc minus `DROP`, so a duplicated story keeps
    its shape with nothing added.
  - Test: `node scripts/test-storyroom-shape.js` — the two lists and the
    copy-paste guards pure (the draw must read the story's canvas, the film
    the story's frame), then the real page headless with every ratio
    MEASURED off a real box. A source assertion cannot see this: the whole
    thing rides one CSS variable, and a broken wire renders as a page that
    looks completely fine and just never changes shape.
- **THE STYLE TOGGLE — watercolor · dreamy · pastel (Aug 2026, Sophie: "I
  want to have the same beats but I wanna fill them with new art … a style
  toggle at the top of a story that alternates between dreamy and watercolor …
  the same format that the account's toggle is"; PASTEL added 2026-08-26,
  "can you make another style in the story room called pastel besides
  watercolor and dreamy?").** One story, N sets of art over the SAME beats:
  words, frame colors, voice takes, chunks and order are shared; only the
  pictures differ.
  - **IT IS THE SHARED THREE-WAY TOGGLE — `/tritoggle.css` + `/tritoggle.js`,
    linked and never copied.** It used to be `.swi`, a hand copy of the
    account switcher's TWO-stop geometry, and the day a third style landed
    that copy was the thing in the way: the house rule is that three options
    is a three-way toggle and there is exactly one shell for it. Colour is
    the per-instance option (ink on the cream page, the Playground's
    precedent), the knob carries the style's INITIAL (`data-i` — W/D/P) and
    the three words sit beside it with the lit one where the knob is. That
    is her original shape — "the words either side say which is which" —
    with the switch moved to the front, because three words cannot straddle
    one switch. **A tap lands on the STOP UNDER THE THUMB, never a cycle**;
    tapping a word picks that style outright (a word sits nowhere near its
    stop). Its own line under the title row, since that row already carries
    six icons on a 390pt phone.
  - **NOTHING COUNTS THE STYLES** — `STYLES` in scratchpad.js and its twin in
    the page are the only lists, so a fourth style is an entry in each plus
    its recipe, and the toggle, the film, the delete rule, the shelf face and
    the stuck-job sweep all follow. (Before pastel every one of those was a
    `style === 'dreamy' ? … : …` ternary, which is why adding one was a
    rewrite rather than a line.)
  - **Watercolor is the pad's original look and lives where it always did**
    (`beat.url/src/gen/imageHistory` — nothing that exists migrated), so
    every old story opens exactly as before. **Every other style lives in
    `beat.alt[style]`**, the same four fields, EMPTY until she fills it —
    flipping the toggle shows the same beats with the same writing and
    honestly blank tiles where that side's art isn't drawn yet.
  - `pad.style` remembers the side; `POST /style` sets it (like /category,
    NO updatedAt bump — flipping the view is not a story edit). Every
    request that touches ART carries `style` (`/generate`, `/drawall`,
    `/image`, `/add`, `/cover`), so a stale page can never draw into the
    wrong side. `artSlot(b, style)` in scratchpad.js / `slotOf(b)` in the
    page are the ONE accessor pair.
  - **A PLACEMENT NAMING NO SIDE IS DERIVED FROM THE PICTURE'S OWN RUN
    RECORD (2026-08-26, Sophie: "the dance one went into the watercolor one,
    but it should be dreamy — isn't there some way that it could look at the
    metadata or the prompt to figure out which style it is").** The page
    always sends the side she is showing, so a style-less `/add` or `/image`
    is a CHAT seeding a story — and it used to default silently to
    watercolor, which is how all nine dreamy pictures for "The dance I
    joined by accident" (and "The white gloves", and two beats of the
    Science story) landed on the watercolor side. `sideFromEvidence` in
    scratchpad.js reads the run doc the `src` names (forge-promptlab), falls
    back to finding a Playground run by the url (`images` array-contains),
    and `padSideOf` (pad-side.js, the pure rule) claims a side ONLY
    when the run's `style`/`gptStyle` IS a pad side — evan, plain, scarry,
    or a Replicate run claim nothing and land watercolor as before. It is
    the playground-port evidence rule, never a guess from words. A derived
    placement may also flip the toggle onto its side, but ONLY when the
    showing side holds no art on any beat (`shouldReveal`) — a chat seeding
    a fresh story must not leave her opening it onto blanks, and a side she
    is using is never flipped from under her. Art already mislaid moves with
    `node scripts/reside-pad-art.js <pad> --from watercolor --to dreamy
    [--beats id,…] [--show] --go` (dry by default; refuses a move onto a
    side that already holds anything; leaves no trash entry and no `off`
    mark, unlike the /image + /remove dance). Tests:
    `node scripts/test-pad-side.js` (pure).
  - **Each style draws its PLAYGROUND TILE's recipe**, so a beat drawn here
    and a picture drawn there are the same picture. `STYLE_ART` in
    scratchpad.js holds one entry per non-watercolor style and its
    `prefix`/`suffix` are COPIES of `PL_GPT_STYLES.<style>` in server.js —
    keep them identical; `test-scratchpad-style.js` derives the list from
    `STYLE_ART` itself and pins every pair byte-for-byte, so a fourth style
    cannot ship unchecked. **NONE of them takes the Sophie card**
    (`noCharacter` — her card is the watercolor look, i.e. a style reference
    by another name, and a second reference in a different style is exactly
    what these prefixes forbid).
    - **Dreamy** — `refs/dream-mystery.jpg`, her dictated prefix and suffix
      bookending the words.
    - **Pastel** — the Witch School pair she named *sophie snake* and *sophie
      animals*, which live in **STORAGE, not `refs/`** (that is the one thing
      that makes this style different to wire up, and why `refsFor()` is
      async), plus the **WHITEN pass** on the way out. That pass is part of
      the recipe, not a nicety: the look draws on a plain white ground and
      gpt-image-2 returns it faintly tinted, which reads as grey on the pad's
      cream. It moved into **`whiten-bg.js`** the day this landed — ONE copy,
      shared with the Playground and the house style, rather than a second
      twenty-line flood fill in a module that cannot reach into server.js.
      Best-effort: a failed whiten keeps the picture rather than losing a
      paid render.
  - **The film is the side the story is showing** — `runFilmJob` reads
    `pad.style` and stamps `style` on the render, which is how the page
    knows a watercolor cut is not the pastel film (the toggle never bumps
    updatedAt, so this is the freshness signal across a flip).
  - **DELETING IS PER SIDE TOO (2026-08-23, Sophie: "if I delete a beat in
    one of the styles does it delete it for the other style too? … I don't
    want it to … leave it in the other style cause that one might have an
    image for that").** `POST /remove {id, style}` asks one question first —
    is there still art on ANY other side? **Yes** → only this side goes: its
    picture (or clip) is banked in `pad.trash` (as `{beatId, style, …}`, so a
    per-side removal is never mistaken for a deleted beat), the side is
    emptied and marked `off`, and the beat keeps its place, its words, its
    frame color and her voice takes for the side that still wants it — it is
    simply not drawn where she deleted it. **No** → the whole beat goes,
    exactly as before. Her own reason IS the rule: the thing worth keeping is
    the other side's image, so a words-only beat she deleted is just deleted.
    - **`off` is per SLOT**, `slotOff` server-side / `beatOff` on the page.
      `padUnits()` groups chunks over the whole list, then draws each unit
      from the members THIS side still has (a unit whose every member was
      deleted here isn't drawn) while `at` stays the true index into
      `beats` — so placing next to a visible beat lands where she expects
      however many hidden ones sit between.
    - **Anything that puts art back clears `off`** (`/image`, `/clip`, a
      draw starting and landing) — putting something there is what brings
      the side back. The wand skips a side she deleted from, and the film
      skips it by itself (an emptied slot has no url).
    - **The confirm box says which side is going** and NAMES every side that
      keeps it ("It stays in Watercolor and Dreamy."), because the same
      button means two different things.
  - **A CLIP is per-style TOO (2026-08-23, Sophie — the first live use of
    the toggle taught this).** The design shipped with clips shared between
    the sides ("footage, not drawn art") and she overruled it within the
    hour: three movies she placed under dreamy showed up on watercolor, two
    of them OVER existing panels ("The beats should be added, but the Art
    should not"). So a SLOT holds a picture or a clip — `kind:'clip'` +
    poster/seconds/title/clipId live on the slot, the beat root being the
    watercolor slot (every pre-toggle clip record reads unchanged) —
    `slotClip`/`slotFace` in scratchpad.js, `clipOf`/`slotFor` on the page, and
    `/clip` carries `style` like every other art write. A beat can be a
    movie on one side and a drawn picture (or blank) on the other; drawall
    still fills the non-clip side.
- **ADDING FROM HER PHONE (Aug 2026, Sophie: "add clips right from my phone
  into the inbox … a file picker that looks in my photos so I can add movies
  or photos").** The upload button in the add sheet's header opens the
  system picker (`accept="image/*,video/*" multiple` — that is what reaches
  her Photos library); each file's bytes ride the Dump's
  `/api/drop/upload-file` (md5 dedupe, HEIC→JPEG, video posters — the
  Assembly pattern, never a second upload path), and the finished url is
  filed on the story with `POST /api/scratchpad/upload {item:{url, kind,
  poster?, title?}}` → `pad.uploads`. Uploads lead the PICTURES grid
  (movies as their poster with the film mark, photos through the thumb
  service), place exactly like inbox items — a movie becomes a CLIP beat
  via `/clip`, a photo a picture — and disappear once placed, like the
  hearts do. NO updatedAt bump on /upload: an upload waiting in the sheet
  isn't on the timeline yet, so it must not stale the film.
- **The + button un-arms on a second tap (Aug 2026, Sophie: "if I click the
  plus button … and then change my mind and click it again, the lines
  between the clips should disappear").** The + stops propagation, so the
  document-level cancel never hears it — the handler clears `pending`
  itself. Tests for all three: `node scripts/test-scratchpad-style.js`.
- **WHAT THE COLOURS MEAN — her own words, and where she said them
  (2026-08-26, Sophie: "can you find where I said with the colors mean in
  story room and then label them in the drop-down").** She dictated them into
  the memo that designed this pad — **"Story Room Concept Development"**,
  recorded 2026-08-03, filed in the `last-voice-recording-inbox` chat:
  *"mustard yellow for examples, green for explanations, blue for like the
  main idea, and then maybe pink for like a bridge"*. She confirmed the set
  from memory on 2026-08-09 ("Follow my color rules. So yellow is examples,
  etcetera. There should be in some message a long time ago"). Gray is the
  thin default frame, which she never named — the chip reads **No frame**.
  - **The words live in the DROP-DOWN and NOWHERE ELSE, which is not a
    softening of the rule below — it is the rule's own line.** On 2026-08-04
    she killed a build that put those words on the CARDS: *"You said the
    mustard should be labeled as example, that exactly the wrong philosophy.
    The whole point is that you have indicators that skip the left brain
    labeling."* That is about READING a pad. The drop-down is the moment she
    is CHOOSING, where the meaning of mustard is the one thing that can be
    forgotten — so the chip is a row (a colour dot, then the word) and the
    pad, the beat frames and the popup's picture still say nothing at all.
  - **Pinned VERBATIM by `node scripts/test-scratchpad-popup.js`** (section
    4b) — the five words in her order, AND the negative half: neither the pad
    nor the picture may name any of them. A reworded label is the paraphrase
    this repo keeps having to undo.
- **THE CANVAS ONLY REPAINTS WHAT CHANGED (2026-08-28, Sophie: "story room
  blinks a lot").** render() used to wipe #pad and rebuild every tile on
  every call — and the draw poll calls it every 4 seconds for the whole life
  of a 30-90s draw, closing the beat popup calls it, and every POST that
  answers with beats calls it. Each rebuild recreated every `<img>` with the
  full-size original, which decodes async on iOS, so the whole canvas
  flashed blank and popped back — every 4 seconds, for minutes. Two
  signature rules in `gen-scratchpad.py`, both reading the SAME values
  render draws (art, color, drawing, caption, clip, order): an identical
  canvas is not rebuilt at all (`padSig`), and inside a rebuild a unit whose
  own signature is unchanged KEEPS its DOM node (`unitSig` — which omits the
  position on purpose, so a reorder moves the decoded tiles instead of
  redrawing them). One picture landing repaints one tile, not twenty.
  **Because a kept node's closures outlive a `beats=d.beats` swap, every
  tile tap resolves its beat by id AT TAP TIME (`beatById`)** — never the
  object captured at build; without that, a kept tile would open week-old
  beat data after a poll. Test: `node scripts/test-storyroom-blink.js`
  (node IDENTITY, the only honest question — a src assertion passes on a
  freshly recreated img every time; verified failing 5 pre-fix).
- **PHILOSOPHY (Sophie, Aug 2026 — do not "improve" this):** the pad is a
  place for thinking on paper, so it is MINIMAL. The frame colors are
  deliberately UNLABELLED indicators — never write "example"/"explanation"/
  etc. on the pad, on a beat or under a picture; the color skips left-brain
  labeling by design. (The colour drop-down is the ONE named exception —
  see WHAT THE COLOURS MEAN above.) No machinery
  on the pad itself (finished artwork only — no draw/redraw buttons on the
  canvas; everything operational lives in popups or off-canvas). Iterating
  fast on this module with her is expected — check the chat before assuming
  the current shape is settled.
- **More than one story (Aug 2026):** every story is its own doc in
  `forge-scratchpad`; the original keeps doc id `pad` and is just one of the
  list. The shelf lists them (cover = first art, name, newest-touched first);
  the + on its header starts a new one. The open story is remembered per
  device (`scratchpad_pad` in localStorage) and rides on EVERY request —
  `?pad=` on GETs, `pad` in the body on POSTs (`GET /pads`, `POST /pads
  {title}`).
- **THE SHELF IS THE ROOM, AND THE BACK BUTTON IS THE SHELF BUTTON
  (2026-08-23, Sophie: "i think the story room architecture is backwards. the
  shelf is the main room. the back button goes to the shelf. story room opens
  on the shelf. we don't need a separate shelf button. the back button IS the
  shelf button").** It used to be the other way round: the page opened on the
  story she was last on, a `library` door at the right of the header went and
  fetched the shelf, and the shelf's chevron dropped back onto that story —
  so the tool had two ways up and the pad read as the room.
  - The page **opens on the shelf** and loads no story until she taps a tile.
    `padId` is still remembered, but only to mark that tile as where she left
    off — loading it would spend a fetch nobody is looking at and park a stale
    story one chevron behind the shelf.
  - **`__navBack` runs the other way**: after every layer it already walked
    (film, lightbox, a confirm, the beat popup, the inbox), a bare story
    answers TRUE and opens the shelf, and only the shelf answers false, which
    is where the app leaves the tool.
  - The shelf is still drawn as a `.sheet` — opaque, `inset:0`, its own
    scroller and its own pill — which is why nothing else in the page had to
    move. Its own chevron leaves the tool now (`__forgeLeave`), since nothing
    is behind it.
  - **A plain browser has no injected chevron**, so the page draws its own
    (`#shelfback`, left of the header) and hides it under `body.native` /
    `body.pagehead` — the same "whoever owns back draws it once" rule the ten
    `__nativeNavBar` pages follow. Without it a story is a dead end in a
    browser. Tests: `node scripts/test-storyroom-header.js` (all three
    builds) and `node scripts/test-storyroom-shelf.js`.
- **The film (Aug 2026) — a play button at the TOP of the pad.** `POST
  /film` stitches the story: every beat with art is its own shot (CHUNKS ARE
  DISPLAY-ONLY — Sophie), each held for exactly its own audio's length —
  her recording first, else the line's cached TTS, else `FILM.silent` (2s)
  of quiet — hard cuts, 1000x1500 (2:3), pure ffmpeg, no video model, free. It's
  a background job on `pad.film` (`status` making/done/failed/**canceled**);
  the page polls and resumes on return; every previous cut is kept in
  `pad.films`.
  **The per-unit audio is PCM, never aac:** concatenating aac adds encoder
  priming to every file (~24ms per two units, measured) and the voice walks
  out from under the pictures — WAV concatenates sample-exact and the track
  is encoded once at the mux. Animating between a chunk's panels (her
  literal→metaphorical formula, Wan i2v ~$0.06 a pair) is the planned paid
  follow-up, deliberately not in v1.
- **STOPPING A RENDER: the play button IS the cancel while it is making
  (2026-08-23, Sophie: "add a cancel button to the play which makes the film
  button in story room").** One control, two states, because the title row
  already carries six 34px icons on a 390pt phone. It also replaced a DEAD
  control — the button used to sit disabled at .45 opacity for the whole
  render. `POST /film/cancel` flips the job's token (`filmJobs`) and SIGKILLs
  the running ffmpeg, so the stop lands in seconds instead of at the end of a
  ten-minute encode; the doc is stamped `canceled` even when this process
  holds no token, so a render orphaned by a deploy doesn't wait for the
  15-minute sweep. **A cancel is never `failed`** — she stopped it on purpose,
  and the killed ffmpeg's own error is exactly the shape the cancel arrives
  in. Two rules keep the doc honest: progress writes go through the job's
  `beat()`, which no-ops once canceled, and the job re-stamps `canceled` on
  its way out, after the child is dead — closing the race where a heartbeat
  was already in flight. On the page, `filmGen` drops a POLL that was in
  flight when she cancelled (its answer still says `making`, and landing it
  would repaint the ✕ with no timer left to correct it), and `api()` matches
  `/film*` by PREFIX so stopping a render never marks the story dirty.
  Nothing is deleted and nothing is spent: the next tap starts a fresh render.
- **THE "?" ON THE NAME ROW — what every button does (2026-08-23, Sophie:
  "also add an info icon that says what all the buttons do").** The pad is all
  unlabelled glyphs by design, so the legend is the one place the words live.
  It sits on the STORY ROOM name row rather than the title row (the title row
  is full; that row's right end is empty and already reserves the pill's
  56px), and it is a sheet with the page's own header, like every other level
  here. **Every row's glyph is CLONED from the real control** — `HELP` names
  each one by SELECTOR and the row copies its `innerHTML`, built on the tap so
  the play row follows the live state. A hand-drawn second set would drift the
  first time a button changed, and the drift would be invisible: the legend
  would go on looking right while describing a page that no longer exists.
  Test for both: `node scripts/test-storyroom-film-cancel.js`.
- **A BEAT CAN BE A FILM CLIP (Aug 2026, Sophie: "can u add film clips to
  story room (the new version - aka scratch pad)").** A clip beat is an
  ordinary beat whose `url` is an mp4 — `kind:'clip'` plus `poster`,
  `seconds`, `title` and the `clipId` it came off. It sits in the order like
  any other beat, takes a frame color, carries her words, links into a chunk.
  - **The shelf is the Chunking clip library, read-only** (`forge-clip-library`
    via `GET /shelf?q=`, whose `?q=` is parsed by clips.js's own grammar —
    never a second copy). A clip is REFERENCED, never copied, the same rule
    Assembly follows; and unlike the picture inbox, a clip already on the pad
    is NOT filtered out of the shelf — a library is not an inbox, and a motif
    can legitimately come round twice.
  - **It tiles as its POSTER with a film mark, never as a `<video>`** — a pad
    of decoding films is what makes a phone crawl. The `<video>` exists in
    ONE place, the beat's popup, at the card's width (the never-blow-the-art-
    up rule is about her drawings; a film nobody can see is not a preview).
  - **Nothing draws a clip**, so the star / Playground / inbox doors come off
    its popup — and **its own sound is its voice**, so the speak and record
    icons come off too rather than promising something the render won't do.
  - **In the film it passes through WHOLE** — its pictures, its sound, its
    length — normalized onto the film's canvas with the same
    scale+pad+fps+setsar chain Assembly uses, which is what keeps the
    concat-copy join safe beside the still segments; its audio is cut to the
    SEGMENT's real encoded length, so the sample-exact wav concat can't walk
    off the picture. A clip with no audio track brings its own silence.
    Deliberately NOT segment-cached like a still: a clip's audio has to come
    off the source anyway, so a cache would save the encode and still pay the
    download.
  - The door on the page is the add sheet's second hairline tab (PICTURES ·
    CLIPS) — the title row already carries six 34px icons on a 390pt phone,
    and the line measures the lit tab, so no tab count lives anywhere.
  - Routes: `GET /shelf?q=`, `POST /clip {clip:{id,url,poster,seconds,title},
    at? | id?}` (insert at a place, or drop into an existing blank beat).
    Test: `node scripts/test-scratchpad-clips.js` (the real page, headless).
- Data: one doc PER STORY in `forge-scratchpad` (deckfactory) — `{ beats:[{id, url,
  color, src:{runId,i,prompt,model,engine,quality}, addedAt}] }`; `src` is
  carried so the later regenerate knows how each image was made. Routes:
  `GET /` (pad), `GET /inbox`, `POST /inbox/hide {url, hide?}`,
  `POST /add {url, at?, src?}`,
  `POST /color {id, color|null}`. STUDIO_TOKEN gate, only `/status` open.
- **TAKING ONE OUT OF THE INBOX — it HIDES, it does not delete (2026-08-26,
  Sophie: "can you make a way to delete certain items from the inbox in story
  room?").** A small ✕ in each tile's top corner, on every tile because a
  phone has no hover; an undo line under the grid for the visit's removals.
  - **Hidden and not deleted, for a structural reason and not squeamishness:**
    the three kinds of item in that grid belong to three different places and
    only one of them is the story's to destroy. A **Playground heart** lives on
    its run doc, so un-hearting it here would reach back and change what she
    sees in the PLAYGROUND; an **upload's** bytes are the Dump's,
    content-addressed and possibly shared with an assembly; only a story's own
    gathered `inbox` entry is local. So the removal is recorded on the STORY —
    the one thing the route owns — as a url on `inboxHidden`, and every read
    filters against it. Same verb the clip shelf uses (`clips.js` has
    deliberately no delete route).
  - **The ✕ is a `<span>`, never a nested `<button>`** — the tile IS a button
    whose whole job is placing the picture, so a mark that let the tap bubble
    would remove a picture and start placing it in one gesture. Rounded square
    at the house 6px, never a circle.
  - **The SOURCE is decided by the unfiltered list.** A story that gathered its
    own art keeps showing its own art even once she has taken every picture out
    of it — falling back to the Playground hearts on an emptied inbox would
    answer with a stranger's pictures.
  - **No `updatedAt` bump**, like `/upload` and `/category`: what waits in the
    add sheet is not on the timeline, so taking one out must not stale the film.
  - The undo line is per VISIT (a removal from last time is already gone from
    what the server sends). The route is the recovery path after that —
    `{hide:false}` for the url.
  - Test: `node scripts/test-scratchpad-inbox-remove.js` (the real page,
    headless — the tap asked with `elementFromPoint` at the mark's own centre,
    which is the only honest way to ask what a tap reaches).

### DUPLICATE A STORY — the same words, drawn twice (2026-08-27)
Sophie: "can u duplicate the hate of the game story room story so i can do my
own pictures name one (mine) and the other (claude) as suffix". So "For the
Hate of the Game" is now **(claude)** — the original, with the pictures a chat
drew — and **(mine)**, its twin, carrying the whole story with a blank canvas.
`POST /api/scratchpad/pads/duplicate {pad, title?, art?}`; the rules are in
`pad-duplicate.js`, its own dependency-free file (the pad-art.js / pad-side.js
pattern), tested by `node scripts/test-pad-duplicate.js`.
- **`art:false` is the DEFAULT and is the case she asked for** — the copy keeps
  the beats, their words, their frame colours, their drawing prompts, her voice
  takes, the story's own inbox and its recordings, and takes only the
  PICTURES. A blank canvas carrying the story. `art:true` is a faithful clone.
- **Every beat gets a FRESH id.** A shared id is a beat that belongs to two
  stories: `/text`, `/image`, `/color` and `/remove` all find a beat by id
  inside one pad, and the Story Link's `fromMoments` join is by id too.
- **It is a DENY-list, not a copy-list.** A field a chat adds next month rides
  along by itself; what must NOT travel is the other version's output — its
  renders (`film`/`films`), its Episode Editor `episodes`, and its place on the
  shelf (`pinned`). `gen` is dropped from every slot either way — it marks a
  draw running right now in the OTHER story, and a copy of that marker is a
  beat waiting forever for a job nobody started.
- **The art is emptied through scratchpad.js's own `SLOT_KEYS`, never by wiping
  the beat** — the words, the colour, her voice takes and the chunk link live at
  the beat root and belong to BOTH sides. The lists (`STYLES`, `SLOT_KEYS`) are
  passed IN, so a fourth style needs no change here.
- **The pinned shelf `cover` is dropped when the art is** — it is a URL of the
  other version's picture, so keeping it tiles an artless story with art.
- **It costs nothing and copies no bytes** — one read, one write, no model
  call; both stories point at the same pictures wherever those really live.

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


## Moved from CLAUDE.md (2026-09-14)

Moved here verbatim from `CLAUDE.md` on 2026-09-14 so that file stays readable;
CLAUDE.md keeps a one-sentence pointer per entry. Nothing was reworded.

### The pad IS the Story Room now

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
  **AND THE + MAKES ITS STORY IN THE PILE SHE IS LOOKING AT (2026-09-14,
  Sophie: "story room shud add to current lu selected category").** The chip
  is lit on screen at the moment she taps +, so filing the new story anywhere
  else leaves it off the shelf she just made it on — and **nothing in this
  page files a story at all** (`POST /pads/category` has no caller here), so
  it stayed unsorted until a chat moved it. Three things not to undo: the
  **DEFAULT pile sends NOTHING** — an untagged story falls into Unsorted by
  itself, so a plain new story is written byte-for-byte the doc it always
  was; **inside a FOLDER it sends nothing either**, because the chips come
  off in there (a folder gathers a character's stories wherever they were
  filed) and `shelfCat` is then the pile she came in from, on no screen —
  filing by a chip she cannot see is the hidden-ingredient failure; and the
  route **cleans it exactly as `/pads/category` does** (lowercased, 24), so
  one word means one thing wherever it is written. Test:
  `node scripts/test-storyroom-new-in-category.js` (the real page headless —
  every assertion a reading of what the server REALLY received, since a page
  that reads `shelfCat` correctly and never puts it in the body, one that
  sends the default as a real field, and one that files by an off-screen chip
  all look identical in the source; verified failing 7 pre-fix).
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

### Scratch Pad / Story Room

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
  - **THE LAST THREE STORIES RIDE ABOVE THE BAND, AS THUMBNAILS (2026-08-29,
    Sophie: "auto pick story not work (playground image to story room
    transfer) · instead: use last three stories · just thumbnails · keep
    select by hand button").** The card over the shelf while she is holding a
    picture: the three stories she touched last, each a square cover with its
    name under it. **Tapping one OPENS it and places NOTHING** — the picture
    stays in her hand and the band goes on saying what to do with it, so the
    placing is the room's ordinary flow (tap the band, tap a moment or a
    gap). *Pick by hand* puts the card away and leaves her shelf, her
    picture and every story on it untouched.
    - **The three are the top of `GET /pads`**, which already answers newest
      `updatedAt` first — the top of her shelf, never a second ranking. Not
      the PINNED order: a pin is where a story lives on the shelf, and this
      card is about what she was just doing. A story with no art anywhere
      tiles as an empty square, and the covers ride the derived-thumb
      service like every other tile.
    - **The card is a way INTO a story, so it shows on the shelf only** (and
      stands down under a beat popup, like the band).
    - **THE GUESSING IS HISTORY.** It shipped 2026-08-26 as a MATCH card —
      the room reading the run's prompt against every beat's words and
      proposing a BEAT to confirm, with a cross-pad `POST /image` behind the
      row. She retired it three days later: *auto pick story not work*.
      `send-match.js` and `GET /api/scratchpad/send-match` still exist and
      are still tested, and **nothing calls them** — do not wire the guess
      back without her.
    - Test: `node scripts/test-storyroom-recent-stories.js` (the real page
      headless — the count, the order, the empty tile, that a tap writes
      nothing, and that the picture survives every step; verified failing
      against the pre-fix page). `node scripts/test-send-match.js` still
      covers the dormant matcher.
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
  **ONE TAKE OVER THE WHOLE STORY — `pad-take.js` (2026-09-06, Sophie: "i
  wanna use the words i typed as voiceover … one continuous take · i want the
  pictures to show as a movie during that", then, on the Story Room's own
  film button reading every line separately in the clone voice: "yes my
  take").** A story carrying a whole-take narration — `pad.voiceover.url`,
  her own recording or one continuous read — renders as ONE audio track with
  the pictures CUT TO ITS WORDS: the take is transcribed once (whisper-1 word
  times, banked in Storage under `scratchpad/take-words/<sha1(url)>`), each
  beat's line is found in it in order, and a shot runs from its line to the
  next. A wordless beat between lines SHARES the span of the line before it
  (nothing later moves off its words); one after the last line is a closer;
  one before the first delays the take. The per-beat film (her recording on
  the beat, else the line read aloud, else quiet) is unchanged for a story
  with no take, for a story with a film CLIP among its shots (a clip's length
  would walk every later picture off its line), and for a take that says
  none of the lines. Filing a take onto a story is `voiceover: {url, text,
  kind:'recording'|'tts'}` on the pad doc — no route writes it yet. Test:
  `node scripts/test-pad-take.js` (her real night take as the fixture).
  **THE TYPED CAST — PICTURES · DESCRIPTIONS BEHIND THE CHARACTER BUTTON
  (2026-09-06, Sophie: "add the character description feature as an option
  that's not character image, like playground").** The Playground's
  Descriptions half on the beat card's character sheet: name + one-line
  description rows, the clause from the served `sheetGrid.castBlock`,
  stored on the PAD (`pad.cast`, `POST /cast`, no `updatedAt` bump, out of
  `dirtySinceFilm`) because a story's cast is the same for every beat; the
  SERVER writes the clause into every draw. Full rules: *The typed cast* in
  `docs/modules/story.md`; tests `test-scratchpad-cast.js` +
  `test-storyroom-cast.js`.
  **CHAPTERS (2026-09-06, Sophie, on her hospital story: "i want the chapter
  within a story. arrow buttons at the top, and a contents page w all the
  stories and thumbnails").** A chapter is a STRING ON THE BEAT THAT OPENS IT
  — `beat.chapter = 'The ER'`, `POST /api/scratchpad/chapter {id, title}`
  ('' takes it off) — and nothing else is stored: the page walks the beats
  in order and every beat carrying one starts a chapter that runs to the
  next, so moving a beat moves its chapter and nothing is duplicated. Three
  surfaces, NONE on the canvas: the **‹ chapter ›** row pinned in
  `#topchrome` (shown only once the story has a chapter; the arrows scroll
  the window to the previous/next chapter's first tile, the name is where
  she is — compare.js's `__pagePlace` rule, the last chapter whose tile has
  passed under the block; a jump remembers where it landed so a short last
  chapter, which can never pass under the block, is still named); the
  **CONTENTS** sheet behind the name (a sheet like the shelf — back chevron,
  no ✕ — one row per chapter: its first beat's picture through the thumb
  service, its name, its beat count; tap to jump); and the **bookmark on the
  Caption line** of a beat's card, which swaps in an EMPTY box (Return/blur
  saves, an emptied box clears — and here blur also CLOSES the box, unlike
  the caption pencil, because this one-line slot cannot reshuffle the card).
  **AND THE CANVAS SHOWS ONE CHAPTER AT A TIME (same day, Sophie: "is there
  a view where i see just one chapter at a time. it's getting
  overwhelming").** With a chapter on the story the canvas holds the chapter
  she is in and nothing else; ‹ › swap which, a contents row swaps to that
  one, and the chapter is remembered per story (`scratchpad_chap_<pad>` in
  localStorage) so reopening lands where she was. **Whole story** leads the
  contents sheet and is the one door back to the scroll-through canvas,
  where the arrows scroll and the row names the chapter under the block as
  before. Beats before the first marked beat belong to the first chapter
  (`from`/`to` on `chapterList()`), or a chapter view could show them
  nowhere. A remembered chapter that has gone falls back to the one holding
  that beat now. Two things not to undo: `/chapter` bumps no `updatedAt` and
  is out of the page's `dirtySinceFilm` (chapters are not cuts — the film is
  untouched); and nothing is drawn between the beats. Seeding a story's chapters by her
  words: `node scripts/seed-story-chapters.js` (dry; `--go`; refuses a story
  already carrying one). Test: `node scripts/test-storyroom-chapters.js`
  (the real page headless — the arrows MEASURED as the window moving and
  the tile landing under the block, the sheet's thumbnails decoding, the
  field's POSTs).
  **PHILOSOPHY — do not "improve" this: the pad is minimal, the frame
  colours are UNLABELLED everywhere but that drop-down, and no machinery
  lives on the canvas.**
  `ART.prefix`/`ART.characterLine` are COPIES of `PL_GPT.*` in server.js — keep
  them identical (`node scripts/check-derived.js` pins them).
  **"I" IS HER, AND HER OWN SOPHIE BEATS THE HOUSE CARD (2026-09-06, Sophie,
  drawing her Mental hospital beats: "i added the sophie character but it
  wasn't applied when i made the images" · "it used the watercolor reference
  not the blue pajamas i added").** Her captions are first person — "they
  caught me in the library" — and every character line said only "whenever
  the prompt mentions Sophie", so nothing told the model the I in the caption
  IS the girl on the card and it drew the woman off the watercolor style
  page. Both lines say `or says I or me` now: the house card's
  (`PL_GPT.characterLine` / `ART.characterLine`) always, and the picker's
  `charLine()` in `pad-characters.js` when a picked character's NAME reads
  as her (`isSelf`: sophie · me · i) — Mason never claims "I". And ONE
  SOPHIE PER DRAW: watercolor attaches the house book-girl card by default,
  so her picked blue-pajamas Sophie rode beside it as a second "Sophie" and
  lost; `houseCardRides` stands the house card down whenever a self-named
  character is picked (the page dims `#dchar` to say so). A beat drawn
  before this needs her re-draw to pick it up. Tests:
  `node scripts/test-pad-characters.js`. **Full details: `docs/modules/story.md`.**

### Story Timeline

- **Story Timeline** (`timeline.js` + `timeline-parse.js`, `/api/timeline`,
  page at `/timeline`, iOS tile) — a dictated list of moments becomes cards she
  can put in order. It started as one Compare page for one story (Aug 2026) and
  became a tool when she asked for it "for other stories". **It costs nothing —
  no model call, no background job**, so opening it and saving are both free.
  **CHATS FILL THE SHELF — AND SINCE 2026-09-13 SHE CAN START ONE HERSELF
  (Sophie: "make it possible to add my own new story to story timeline").** The
  shelf leads with a **New story** button: a name, and her moments one to a
  line if she already has them. Three things not to undo: it goes through the
  SAME `POST /stories` a chat uses, so her paste runs through the one parser
  (`parseStory` — an ALL-CAPS line opens a sequence) and nothing new can drift
  from it; **both boxes ship EMPTY** (the house rule) with the two labels above
  them saying what goes in; and **the moments box is optional** — empty makes
  an empty story, which opens saying "Empty — tap + to write the first moment",
  since the gap's `+` is a 15px mark on an otherwise blank screen. Her 2026-08
  word still stands for everything else — "it's for chats to fill themselves… I
  just wanna see a list of stories and I can click on one and the chats will
  fill the stories" — so the shelf is still a list, and a chat filing a
  dictation for her is still the main door. **When Sophie dictates a story's moments to
  YOU, filing it is YOUR job**: `POST /api/timeline/stories { title, text }`
  (text = her dictation, one moment per line — the parser strips her numbers,
  takes wrapping quotes off, and turns her ALL-CAPS headers into sequences;
  `POST /parse` dry-runs it), then hand her the link
  `https://imageforge-q125.onrender.com/timeline?story=<id>`. Do NOT rebuild
  the retired per-story Compare pages (`scripts/gen-story-timeline.js` and the
  `docs/story-timeline/timeline-v*.html` files are that history; her original
  story was migrated in by `scripts/seed-story-timeline.js`).
  **SEND TO FOOTAGE — one connected part is one block (2026-09-13).** A link
  on an open story hands the whole story to `/footage`: one block per UNIT, the
  moments inside one joined by a newline each. Full rules under *DIVIDE HERE* in
  the Footage bullet; nothing is sent, the star is still her tap. **And since
  2026-09-14 the hand-off carries the story by id and its parts by key** (a
  part's first moment id), so Footage binds its blocks to the story's parts,
  merges a second send onto the prompts she wrote there, and walks every prompt
  already sent for a part — *A BLOCK IS A STORY PART* in the Footage bullet.
  **HER WORDS GO ON THE TIMELINE EXACTLY AS SHE SENT THEM — NEVER ADD, DELETE,
  SPLIT, REGROUP OR REORDER A LINE (2026-09-06, Sophie: "did u add delete or
  change my words" · "if so undo" · "add to docs never do this").** The chat
  that earned this filed her hospital memories with twelve ALL-CAPS sequence
  headers of its own, put the lines into what it judged was chronological
  order, split one long message in two, and quietly dropped eight lines it
  read as chat noise — three of which were story ("oh his name was nicholas",
  "cuz she was violent", a character description). She caught it in one
  look. The rules, all of them hers:
  - **One line of hers = one moment, verbatim, in the order she sent them.**
    Chat order, not story order. Do not tidy spelling, spacing or dictation.
  - **NO headers, NO sequences of yours.** Dividing the timeline is HER job
    on the page ("i'll divide it"); a chat grouping it is deciding the story.
  - **Drop NOTHING — not one line, first to last (her second catch the same
    hour: "u changed ur still").** The undo still cut the research questions
    before her account and the "zip it" asks after, and started one line
    late — she saw it at once. If a line is aimed at the chat ("ok",
    "storyboard?", "~9:16") or is another subject, it still goes in; she
    deletes it in one tap on the page, where a line a chat dropped is gone
    until she notices. A chat deciding where her story starts is the same
    mistake as a chat deciding what her story is.
  - **Never re-POST or PUT over a story she may have touched** — read
    `updatedAt` against `createdAt` first; if she has edited, propose in the
    reply and wait.
  - The fixed record is `docs/mental-hospital/` — her whole side of that
    chat verbatim, and the exact text the timeline holds.
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
  **SELECT — pick several cards and delete them together (2026-09-06, Sophie:
  "can u add a select tool so i can mass delete", on the 172-card Mental
  hospital story).** The Playground's SELECT chip ported: a Select button on
  the open story's top row; lit, a tap on a card PICKS it (the pencil hides, a
  folded middle picks rather than unfolds), and the mode bar under the row is
  All/None · the count · Delete · Done. Delete drops every picked card out of
  `units` exactly as the pencil's delete does — `moments` keeps the words, the
  module's rule — then paints and saves once. Four things not to undo: **Delete
  is TWO TAPS** (the first arms it, red, saying how many; the second deletes;
  changing a pick disarms it) and never a browser `confirm()`, which a
  WKWebView may swallow; **the mode is in memory only, never localStorage**
  (the Playground's own call — it is something she is in the middle of doing);
  the mode ends on Done, on leaving the story and on opening another; and it
  is lit in INK, never the accent, which marks a sequence. **The number box is
  `.tool input.no`, not `.no`** — tool.css's `.tool input[type=text]` out-
  specifies a bare class, so its 10px padding won and every number past 9 read
  as "1"; caught by PHOTOgraphing her live story at 390x844. Both pinned by
  `node scripts/test-timeline.js`.
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

### Story Link

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

### Character Creator

- **Character Creator** (`character.js`, `/api/character`, page at `/character`,
  iOS tile "Characters", and a sheet inside Dreams) — the recurring people in
  her dreams and stories: a photo + a name + her aliases ("me"/"Sophie",
  "Daddy"/"Dad") become a diary-comic reference the dream render matches each
  dream's cast against, so a face stays the same picture to picture. Drawing is
  a DETACHED server job — it saves itself even if she closes the sheet mid-draw,
  and `localStorage` picks an in-flight one back up.
  **HER OWN PICTURE CAN BE THE CHARACTER — the button beside ✦ (2026-08-29,
  Sophie: "add my own picture button to characters").** Not every character
  wants to be redrawn: a photo she already has, a Playground picture, a face
  from another story. `POST /api/character/own` saves the picture AS the
  character — no draw, no wait, **no money at all** (one Storage upload and one
  Firestore write). It lands in the same collection with the same name,
  aliases and ★ Add to sheet, so the cast sheet, the Playground's picker and
  the dream matcher know no difference.
  - **HER BYTES ARE STORED UNTOUCHED** (the house *nothing stands between the
    source and the output* rule): a png/jpeg/webp/gif sitting upright goes to
    Storage byte for byte. Only the two shapes that would otherwise arrive
    broken are re-encoded, and only **losslessly to PNG** — an EXIF-rotated
    phone photo (every cell would draw it sideways) and a format no `<img>`
    can decode. Never a lossy webp, which is what the generate path stores
    because a generated picture is born as one.
  - **IT FILES NO PROMPT AND NO MODEL · QUALITY**, because nothing generated
    it — the exact-prompt rule's own answer, file nothing rather than a
    reconstruction. `own:true` on the doc is what lets the cell say **"your
    picture"** instead of leaving the caption blank, and it is why nothing
    invents one.
  - **Regenerate is hidden on an own picture** — a button that would replace
    her picture with a drawn one is the opposite of what she asked this for.
    The flag is state, so `New one` clears it or the next DRAWN character
    silently loses its re-roll.
  - The button is the same 44px square as ✦ but **outlined, never gold**: the
    gold is the house generate treatment, and this tap spends nothing.
  - Test: `node scripts/test-character-own.js` (the byte rule over REAL
    encoded images — a mime assertion passes against a page that silently
    re-encodes everything — then the real page headless).
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

