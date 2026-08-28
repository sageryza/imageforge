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
  written by `POST /api/scratchpad/shape {pad, shape}`, and flipped by the
  small button at the far end of the style row — whose glyph IS the shape (a
  tall rectangle, or a square), so there is no word to read. It is the
  pyramid's rule: a picture of the thing beats a name for it.
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
  - **SHE DOES NOT HAVE TO PICK IT — the shape follows the story's FIRST
    PICTURE (2026-08-28, her next message: "automatic by first picture").**
    The toggle stays for when she wants it; the ordinary path is that the
    first picture PLACED on a story decides it. Every door gets it, because
    the decision is made server-side as the picture lands: `POST /add`,
    `POST /image` (her inbox pick, a version picked back, the send-trip
    match) and `landOnBeat` in server.js (a Playground run she sent to a
    beat). `autoShapePatch` is the one rule and it is exported for that last
    one.
    - **"Nobody has decided" is one field — a pad with no `shape` at all.**
      `POST /shape` writes one, so her tap (or a chat's deliberate one) is
      the last word and no later picture can move it under her. That is the
      `catBy` rule, spelled with the value's own presence rather than a
      second field to keep in step.
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
