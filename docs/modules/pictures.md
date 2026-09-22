# Picture-making modules

The surfaces that draw: the Playground, Freeform, the Vector pipeline, and the Midjourney/APIFRAME card-deck path.

*(Moved out of `CLAUDE.md` Aug 2026 — see the pointer there. Nothing was rewritten; this is the text as it stood.)*

**Writing the words that go in the box? Keep it SHORT — a few clear sentences
of what HAPPENS, not a paragraph of specification.** Length buys nothing from
gpt-image-2 and costs you the ability to fix a bad draw one change at a time;
the evidence, the unsourced blog number to ignore, and the measured ~1,000-char
ceiling are all in `docs/image-pipeline.md` (*The walker is the prompt*).

## Playground (`/playground`, iOS tile "Playground") — prompt tester
- `public/promptlab.html` + `/api/promptlab` (inline in server.js), Firestore
  `forge-promptlab`. Fixed recipe per style so runs stay comparable: **ONE
  image a run**, 2:3. Background job on the doc; the page polls and resumes
  from `localStorage`. ♥/✕ per image in the lightbox, plus a copy action
  (Aug 2026) that closes the lightbox and puts that picture's prompt back in
  the prompt box — the tiles-view route to the list boxes' copy button.
- **THE LIGHTBOX IS THE SHARED ASSETS ONE — `asset-lightbox.js` (2026-08-26,
  Sophie: "it should be the exact same design — can it not be the same exact
  code?").** The page builds no lightbox of its own; stepping (`nav`), the
  door state riding a step (`promptSide`/`promptOpen`) and the programmatic
  close are the shared file's hooks, the thumb-first open / this-run's style
  half / vote route / actions row are caller wiring in `showLB`, and notes
  land on the picture's `my-creations` thread. The full
  record is *THE PLAYGROUND'S LIGHTBOX IS THE SHARED ASSETS ONE NOW* in
  CLAUDE.md's Playground section — do not restyle `#clightbox` from this
  page or add a playground-only control outside the hooks.
- **Generate is the stars icon, and a run makes ONE picture (Aug 2026,
  Sophie).** The button is a Lucide `sparkles` glyph with no word on it, and
  there is no how-many picker at all — every style draws one image per tap
  (the LoRAs used to hard-code `num_outputs: 4` server-side; that is now
  `cfg.outputs`, and `POST /api/promptlab` clamps `outputs` to 1-4 with a
  default of 1). The page's `OUTPUTS` const is the other half of the pair —
  move both if this ever changes.
- **A Replicate run she already has is never sent again (Aug 2026, Sophie).**
  Flux with a fixed seed is deterministic — same prompt + same LoRA scale +
  same seed draws the SAME picture — so re-running one only spends money on a
  duplicate. `alreadyRun()` checks the planned recipe against the runs on the
  page and the ones still drawing, and Generate stops with a toast instead of
  posting. **×3 sends only the rungs she's missing** ("Drawing scale 1.2 and
  1.4 — you already have 1"), so ×3 after a single scale-1 run costs two
  images, not three. Two deliberate exceptions: **ChatGPT is never deduped**
  (an identical run there draws a DIFFERENT picture — that's the point of
  tapping the stars twice, so `plannedKey` answers null for it), and a run
  that **failed or was cancelled never blocks a retry** (only one that really
  produced a picture counts). The prompt is normalized the way the server
  does it — trimmed, trailing periods dropped — or a typed "." reads as a
  different run. The check sees the loaded feed plus anything in flight, so a
  duplicate of something older than she has paged back to still gets through.
- **Identical runs share ONE box (Aug 2026, Sophie).** Tapping the stars twice
  on the same prompt is one job as far as she's concerned, so the feed merges
  runs whose prompt AND settings match — engine, model, status, quality,
  aspect, character toggle, LoRA scale, seed — into a single box: one prompt
  head, the pictures side by side **oldest-first** (the second tap lands to
  the RIGHT of the first). Anything that differs (a different quality, a
  nudged seed) stays its own box, because the head's tags could no longer
  describe every picture under it; failed runs never merge (each carries its
  own error). It is purely a DISPLAY grouping — every cell still points at its
  own run doc, so the lightbox shows that picture's real settings and a ♥
  writes to the right doc. Runs still drawing group the same way, and the one
  X on a merged box cancels every run in it (`data-kill` holds a comma list).
  `groupBy`/`sameRunKey` in `promptlab.html` do it; the server knows nothing
  about it.
- **The feed is PAGED, and it pages BACKWARDS THROUGH TIME (Aug 2026).** It
  used to ask for the newest 40 runs and had no way to ask for more, so run 41
  and everything behind it was simply unreachable — 213 runs existed and 40
  could be seen, which Sophie reported as her older pictures being gone.
  Nothing had been deleted; nothing ever deletes a run. Now an **Older** button
  under both views loads the next 40 (`GET /api/promptlab?limit=&before=`,
  `more` on the response says whether there is any point offering it).
  - **The cursor is a `createdAt`, never an OFFSET.** Runs land at the TOP
    while she reads, so an offset shifts under her and repeats or skips one.
    The server does `where('createdAt','<',…)` on the field it already orders
    by, so no composite index is needed.
  - **A head refresh MERGES, it never replaces.** Every finished run calls
    `loadRuns()`, and rebuilding the feed from page one there would throw away
    everything she had paged back to. `feed` holds every run loaded, fresh
    copies win (a vote or a status moved), and the list re-sorts by time.
  - **It is a TAP, deliberately not load-on-scroll** — the autoscroll pill
    would run the page to the bottom by itself and pull page after page of
    pictures over her data without her asking.
  - **A TAP REVEALS A SET NUMBER OF PICTURES, NEVER A STRETCH OF HISTORY
    (2026-09-21, Sophie: "make the older button reveal a set number not time
    period").** The server still pages 40 RUNS behind the cursor, but what a
    tap put on the wall was whatever those runs held once the heart, the ✕
    and the drawer's chips had run over them — 160 pictures one tap, three
    the next, none on a hearts-only wall. Now `MORE` (40) pictures land per
    tap, counted AFTER the filters: `shownPics` caps what `feedCells()` draws
    (ONE list for both views, so the boxes keep exactly the cells the wall
    shows), a tap raises it by MORE, and `loadMore` walks page after page
    (`MORE_PASSES`, 8) until the loaded feed holds that many or the history
    ends. No cap until the first tap — the first page is the server's, as it
    always was. A run landing at the top grows the cap by what it brings, so
    nothing revealed falls off the bottom; Older stays on screen past the end
    of the history while the cap still hides loaded pictures; and the
    drawer's DATE chip is a floor the walk stops at (nothing behind the
    cursor can pass it). Test: `node scripts/test-playground-older-count.js`
    (four pictures a run with a tap measured at exactly 40, then hide-✕ lit
    with one keeper in four, the walk measured at four pages).
  - Tests: `node scripts/test-playground-paging.js` (drives the real page in
    headless Chromium against a stub API; skips without Playwright).
- **The feed has TWO views: LIST and TILES** (`promptlab_view` in
  localStorage, default list). List = a box per run, prompt above its
  pictures. Tiles = every picture from every run as uniform SQUARE thumbnails
  **four to a row** (the My Creations look), no prompt on the page — tapping
  one opens the lightbox, which is where the prompt and the model · quality ·
  seed line live. **A run still drawing holds its own empty square at the
  FRONT of the tile wall** (`#tiles .cell.ph`, breathing so it doesn't read as
  a broken image) and the list view's "drawing…" box is hidden in tiles, so
  nothing appears twice — cancelling a run therefore lives in LIST view. Two gotchas, both earned: the switch is a **sticky labelled
  LIST/TILES pair**, never a single icon that scrolls away (the first version
  did, and stranded her in a one-image-per-row view with no way back), and it
  sits on the **LEFT** because the autoscroll pill owns the top-right corner.
- **SANDY MIRROR AND CHATGPT ARE TWO DIFFERENT TILES SINCE 2026-08-24 (Sophie:
  "add one more endpoint option to the playground, which is called ChatGPT and
  change the one that's called ChatGPT right now to make it be called Sandy
  mirror. the ChatGPT new one will have no reference image").** The tile that
  attaches `refs/sage-sandy-mirror.png` is **Sandy mirror** now, and **ChatGPT**
  is a NEW tile that attaches nothing: her words go to gpt-image-2 alone, no
  style reference, no baked prefix, no baked tail, no Sophie card.
  - **THE KEYS DID NOT MOVE.** The renamed tile is still `evan` server-side and
    `chatgpt` in the page's `STYLES`, because those two strings are stored — in
    every run doc's `gptStyle`, in `?style=` deep links, in `promptlab_style`,
    and in her per-style prompt override and no-text keys in localStorage.
    Renaming either would orphan all of it, so only the LABEL changed. The new
    tile is `plain` in both tables.
  - **IT IS LITERALLY A DIFFERENT ENDPOINT, which is why she called it one.**
    With no images to attach there is nothing to EDIT, so `runPromptLabGptJob`
    picks by `refs.length`: empty → `openaiImage` (`/v1/images/generations`),
    otherwise the usual `openaiImageEditRefs` (`/v1/images/edits`). Everything
    downstream is identical — same model, quality, canvas, `moderation:'low'`,
    webp bytes, no `output_compression`. **The choice is the ARRAY's length, not
    the style id**: attaching her own photo gives a plain run one image, and it
    belongs on edits.
  - **`openaiImage` takes a timeout override** (0 keeps the per-quality table).
    The table suits the 1024-square calls the zine makes; this tile draws up to
    2336x3504, where a medium render outruns the 150s medium is allowed, so the
    Playground passes 300s exactly as the edits path always has.
  - **Her PHOTO reference gets a different sentence here.** `PL_GPT.photoLine`
    ends "...NOT for the drawing style, which comes from the style reference
    above" — true on every other tile and a lie on this one, where her photo is
    the only attachment. `PL_GPT_STYLES.plain.photoLine` overrides it, is served
    by `GET /api/promptlab/styles` per style, and the Prompt panel prints
    whichever one will really be sent.
  - **No evidence, on purpose.** `playground-port.js` carries a `plain` entry
    with `evidence:false` — a picture made here has no reference filename and no
    baked prefix on its record, so nothing can ever route back to this tile.
    Don't invent a fragment to make it look identifiable; the FALLBACK stays
    `chatgpt` (Sandy mirror), which is what the unidentified history really is.
  - Test: `node scripts/test-playground-plain.js` (pure — 18 of its 22 checks
    verified failing against the pre-change tree).
- **Eight styles: WTR, Sandy mirror, ChatGPT, Dreamy, Triangle, Scarry,
  Pastel, Hoonies.** **WTR**
  (`wtr`, the watercolor LoRA — the tile is labelled WTR, but its STYLES key is
  still `watercolor`, which is what localStorage and `?style=` deep links carry)
  is the only Replicate LoRA on the picker: trigger word prepended, suffix
  appended, LoRA scale + seed + ×3 ladder. **The Hoonie linocut tile was
  removed** at the same time — the model is untouched and still serves the Test
  Station / house styles, and old Hoonie runs keep their label in the feed via
  `RETIRED` in promptlab.html.
  **Sandy mirror** (Aug 2026, `engine:'gptimage'`; called ChatGPT until
  2026-08-24) is a different engine:
  gpt-image-2's **edits** endpoint with Sophie's scanned ink-and-watercolour
  page attached as a pure STYLE reference (`refs/sage-sandy-mirror.png` =
  "datescan0013", the same file the Evan film uses), **quality medium**,
  **1024x1536**. LoRA scale / seed / ×3 are hidden for it — it has no
  equivalents. **"Scarry"** (Aug 2026, shortened from "Richard Scarry") is a
  second gpt-image-2 style: same recipe, but the attached style references are
  THREE of Sophie's saved busy-animal picture-book pages
  (`refs/richard-scarry-1..3.png` — TWO of the three attach, the mouse in bed
  and the taxi jam; `-2.png`, the mouse at the table, was taken out Aug 2026 at
  Sophie's ask and the file kept in case she puts it back); its prefix has NO colors
  line (that belonged to the watercolor reference) and it is `noCharacter` —
  the Sophie toggle is hidden and the server refuses the card even if sent,
  because her character card is the watercolor look. **"Pastel"** (Aug 2026) is
  the third: the pastel-variant-2 house look, the same recipe as
  `MODELS.house['house-pastel']` — the two Witch School style refs (which live
  in **Storage**, `witch-school/refs/sophie-snake.png + sophie-animals.png`, loaded via `loadHouseRef`,
  not in `refs/`), that style's written linework/palette line as the prefix, and
  the `whiten` flood-fill pass on every finished image. Also `noCharacter`.
  **"Hoonies"** (Aug 2026) is the fourth gpt style: her woodcut smallies (the
  drawings the witch app's loading animation cycles — Dump album "hoonies",
  #228), four of them attached from **Storage** (`hoonies/refs/style-*.png`),
  picked for two subjects grown into ONE object — a face in an open book, an
  eye inside a vase — because that is what a coincidence looks like. Its prefix
  carries **no engraving vocabulary on purpose**: tested side by side, a written
  style description pulled the line finer and more modern, away from their blunt
  woodcut feel (the same finding as `docs/evan-film-style.md`). `noCharacter`.
  **"Triangle"** (2026-08-31, Sophie: "add triangle as a new playground style
  · w image and prompt w new equilateral") is the Triset game's triangular
  picture cards as a tile. It is **DERIVED from `dreamy`** at load —
  `PL_GPT_STYLES.triangle = triangleStyle(PL_GPT_STYLES.dreamy)` — so it is the
  same reference image, the same prefix and the same tail, with dreamy's
  rectangular border clause swapped for the equilateral triangle-card clause
  (`triangle-clause.js`, the one copy `triset.js` also reads). Her no-text
  toggle still works on it: that clause sits after the border one and the swap
  never reaches it. It carries its OWN `sheet` swap — dreamy's anchor is the
  clause it just consumed, so without one a panels run would keep "NOT a grid"
  in a grid prompt; with it, every cell of a sheet is a triangle card.
  `noCharacter`, like dreamy. Nothing is written twice, so a reword of hers in
  `dreamy` reaches the tile and the game together.
  Every gpt style appends a `suffix` at the VERY END of the sent prompt, after
  her words (the no-text rule; Pastel's is the house style's longer wording).
  ChatGPT-engine styles live in `PL_GPT_STYLES` in server.js (keyed `evan` /
  `plain` / `dreamy` / `triangle` / `scarry` / `pastel` / `hoonies`; the page sends `style`,
  absent/unknown → `evan` so old pages keep working) — adding another different-reference style = drop the
  image(s) in `refs/` (or point `storageRefs` at Storage), add a
  `PL_GPT_STYLES` entry + a one-line `STYLES` entry in promptlab.html (the page
  holds NO prompt copies anymore — see below) **+ a `PORT_STYLES` entry in
  `public/playground-port.js`**, which `scripts/test-playground-port.js` pins:
  the three tables must hold the same keys, and a tile with no evidence can
  never be ported back onto.
- **Its prompt is baked in server-side** (`PL_GPT_STYLES`) and her typed words
  sit between the style's prefix and its no-text suffix verbatim — no trigger
  word, no trailing-period trim. **The "Sent as" preview line is GONE (Aug
  2026, Sophie — "just the text box is fine")**, and with it the page's prompt
  copies: promptlab.html's STYLES entries carry no prefix/characterLine
  anymore (updateShape is a stub kept for its old call sites). The ONLY copies
  left to keep in sync with `PL_GPT.prefix`/`PL_GPT.characterLine` are the
  Scratch Pad's (ART.* in scratchpad.js).
  ~$0.06 an image at medium (a LoRA image is well under a cent).
- **The Sophie character toggle (Aug 2026, ChatGPT style only — a
  `noCharacter` style like Richard Scarry hides it and the server refuses the
  card):** her picture as a small button on the controls row (dim = off, lit
  = on; a plain variable like quality, so every load starts OFF). On, the run
  attaches `refs/sophie-book.png` (her hearted "girl placing her book
  face down" render) as the SECOND image and appends `PL_GPT.characterLine`
  to the prefix — "Use the second attached image as a character reference.
  Her name is Sophie. Whenever the prompt mentions Sophie, draw her as that
  girl." — so typing "Sophie" in a prompt draws that girl.
- **`/playground?from=scratchpad` shows a "‹ Scratch Pad" chip** (fixed
  top-left) — the way back when the Scratch Pad's empty-beat popup sends her
  over; without it the pad's WKWebView strands her on the Playground.
- **Low · low · medium in one tap (Aug 2026, Sophie) — the pyramid button,
  ChatGPT only.** Fires THREE runs from one tap: two at `low` and one at
  `medium`, so she gets two cheap looks at a prompt plus a better one without
  three taps and two trips to the dropdown. ~5¢ a tap. `startRun(scale, q)`
  takes a per-run quality override, so the dropdown is left exactly as she set
  it. ChatGPT is never deduped, so the two lows are two DIFFERENT pictures —
  they merge into one box side by side, and the medium is its own box (its
  tags differ). The icon is NOT a Lucide glyph: Lucide's `pyramid` is a solid
  3D shape that says nothing about how many, so it's three circles in the
  Lucide idiom — two outlined at the base for the lows, one filled on top for
  the better one. The button is a picture of what the tap draws.
- **One ChatGPT-only control, in the space the LoRA knobs vacate: quality — a
  dropdown, low/medium/high, default medium** (sent as `quality`, validated
  against `PL_GPT.qualities`). **Deliberately NOT persisted:** it's a plain JS
  variable, so it holds while the page is open and every fresh load is back to
  medium — localStorage would carry an expensive `high` into next time without
  her meaning it. At the Playground's 2:3 that is **0.5¢ / 4.1¢ / 16.5¢** an
  image (the table below). (The old sticky 1/2/3/4 count toggle is gone — see
  the one-image rule above.)
- **WHAT A gpt-image-2 PICTURE COSTS — the one table, checked against OpenAI's
  own image-generation guide 2026-08-16.** Every other cost figure in this repo
  should be derived from it rather than restated from memory:
  - **square 1024x1024** — low 0.6¢ · medium 5.3¢ · high 21.1¢
  - **portrait 1024x1536** — low 0.5¢ · medium 4.1¢ · high 16.5¢
  - **landscape 1536x1024** — low 0.5¢ · medium 4.1¢ · high 16.5¢
  **AND THE WHOLE LADDER ABOVE 1K, MEASURED 2026-08-22.** OpenAI's table stops
  at those three sizes and says only "additional sizes available", so every
  figure below came out of the API's own `usage` block via
  `node scripts/measure-image-cost.js <WxH>:<quality>` — 21 renders, $2.92.
  Cents per image, output tokens only (an edits call with one style ref adds
  ~1.2¢ of input on top; see the note below):
  - **portrait 2:3** — 1K `1024x1536` 0.47 / 4.12 / 16.5 · 2K `1568x2352`
    0.75 / 6.55 / 26.21 · 4K `2336x3504` 1.35 / 11.74 / 46.94
  - **landscape 3:2** — 1K `1536x1024` · 2K `2352x1568` · 4K `3504x2336`,
    each one **identical to the portrait of the same tier**
  - **square 1:1** — 1K `1024x1024` 0.6 / 5.3 / 21.1 · 2K `1920x1920`
    1.09 / 9.83 / 39.31 · 4K `2880x2880` 1.98 / 17.79 / 71.16
  - **widescreen 16:9** — 1K `1280x720` 0.32 / 2.84 / 11.36 · 2K `2560x1440`
    0.61 / 5.53 / 22.12 · 4K `3840x2160` 1.11 / 10.01 / 40.03
  Three things fall out of the measurements and are worth more than the table:
  - **ROTATION IS FREE.** `2352x1568` returned byte-identical token counts to
    `1568x2352` at both qualities tested, and the same at 4K. Cost tracks the
    RATIO, never which edge is longer.
  - **THE SQUARER THE DEARER, at identical pixel counts.** `1920x1920`,
    `1568x2352` and `2560x1440` are all 3.69 megapixels and cost 9.83¢, 6.55¢
    and 5.53¢ at medium — a 78% spread with no change in resolution. This is
    the general form of the square-vs-portrait inversion below.
  - **HIGH IS EXACTLY 4x MEDIUM**, measured at seven sizes across three aspect
    ratios, and it reproduces OpenAI's own published 1K highs to the rounding
    (4 × 4.12 = 16.48 against their 16.5). The highs above marked as derived
    use it; low → medium is NOT a constant (8.71x at 2:3, 9.0x at 1:1 and 16:9)
    and was measured everywhere.
  **RESOLUTION IS THE CHEAP KNOB, QUALITY IS THE DEAR ONE** — 8x the pixels is
  2.9x the money, one step of quality is 4x.
  **DO NOT EXTEND THIS TABLE BY ARITHMETIC** except by the 4x rule above —
  measure the new size with the script, which is one command and reads the real
  token count. Nothing here is derivable from area.
  **THE SQUARE IS THE EXPENSIVE ONE**, which is the opposite of the guess
  everyone makes: a 1536x1024 canvas holds 1.5x the pixels of a 1024x1024 one
  and costs 22% LESS. So "it's bigger, it must cost more" is wrong here, and
  scaling a price by area — which is how this file's old figures were talked
  about — gets it wrong by 2x.
  **AND IT IS TRUE OF gpt-image-2 ONLY — the older models price it the
  intuitive way round**, which is why the inversion reads as a typo and must
  not be "corrected" back. Same page, same day: gpt-image-1 high is 16.7c
  square against 25c for either rectangle, and gpt-image-1.5 is 13.3c against
  20c — both charge MORE for the bigger canvas. gpt-image-2 alone charges
  less. The billing is per OUTPUT TOKEN, never per pixel, and OpenAI's own
  guide says so out loud: *"a larger non-square resolution can sometimes
  produce fewer output tokens than a smaller or square resolution at the same
  quality setting."* **They do not publish gpt-image-2's per-size token
  counts** (they do for the older models), so the mechanism behind it is not
  knowable from the docs — take the price as given and don't reason from area.
  **The old ~2¢ / 6¢ / 25¢ was gpt-image-1** (whose real numbers were 1.6¢ /
  6.3¢ / 25¢ at square, and which DID charge more for the bigger canvas). It
  sat in this file, in CLAUDE.md and in the vector doc long after every
  surface moved to gpt-image-2, so estimates given to Sophie ran ~25% high.
  When a model changes, its price changes with it — fix the figure in the same
  commit.
  **An EDITS call also pays for what it reads, and it is NOT small — measured
  against Sophie's real invoice, 2026-08-16.** A style reference is charged as
  input image tokens at $8/1M, and over 3,293 gpt-image-2 calls in 31 days the
  refs averaged **2,310 tokens = 1.85¢ a call** — more than the whole output of
  a `low` picture. So a low run with refs attached costs about **2.4¢, not
  0.5¢**: at the cheap end the reference is most of the bill, and adding a
  second or third ref adds that again. Medium and high barely notice it.
  A `generations` call with no refs is the table exactly.
  **The whole-month average was 6.3¢ an image all-in** (4.31¢ output + 1.85¢
  refs + 0.09¢ text), i.e. the house default of medium-with-references — which
  is the number to reach for when estimating a batch of ordinary runs rather
  than the table's medium.
  **The rates behind all of this** (gpt-image-2): text in $5/1M, image in
  $8/1M, image out $30/1M. Verified end to end — pricing those tokens against
  the usage export predicted $6.97 for a day the invoice billed at $7.10, the
  gap being the handful of other models on it.
- **WHAT A WTR PICTURE COSTS — about 1.2¢, and it is MEASURED (2026-09-15,
  Sophie: "add pricing to wtr in playground").** Every gpt style prints its
  price on the toggle that SETS it — the canvas, the tier, the quality. WTR has
  none of those knobs (one output size, one step count, one picture a run), so
  its price had nowhere to live and the page said nothing at all. It now has a
  quiet line of its own under the controls — `~1.2¢`, the number and the
  cent sign and nothing else (2026-09-15, Sophie: "make it just say ~1.2" ·
  "cent symbol"): the style is named in the picker two rows up and one run is
  one picture, so every other word was already on screen — `PL_LORA` in `server.js` owns the
  number, and `/api/promptlab/styles` serves it — the page holds no copy, the
  rule the tier prices already follow.
  - **REPLICATE PUBLISHES NO PER-IMAGE PRICE FOR A PRIVATE FINE-TUNE, and a
    prediction carries NO cost field** — only `metrics.predict_time`. So the
    figure is the one thing it can be: the real time × the published hardware
    rate. **$0.001525/sec** (replicate.com/pricing, Nvidia H100) ×
    **7.61s** = **1.16¢**.
  - **A FAST-BOOTING FINE-TUNE BILLS ACTIVE TIME ONLY**, which is what makes
    that arithmetic legal: `predict_time` IS the billed time, no boot, no idle.
    A private model that is NOT fast-booting bills the instance's whole life
    and this would be wrong — check that before adding a model to the table.
  - **The seconds are the MEDIAN over every real one-output 28-step WTR
    prediction in Replicate's own history** — 21 of them, 7.42s min / 7.61s
    median / 10.86s max, i.e. **1.1¢ to 1.7¢** — read back from
    `GET /v1/predictions`. All of them are Playground runs at the settings the
    page really sends: 1 megapixel, 1 output, 28 steps. The spread is the box's,
    not the prompt's, which is why the line says "about".
  - **Re-measure rather than re-derive** when the step count, the hardware or
    Replicate's rate moves: `node scripts/measure-lora-cost.js` reads the
    prediction history and prints the row to paste. **It spends nothing** — no
    prediction is created, nothing is drawn.
  - **THE ASPECT ROW DOES NOT MOVE THE PRICE, and that is measured.**
    `megapixels: '1'` is pinned on every run, so every ratio draws the same
    number of pixels — 2:3 came back at a 7.92s median and 1:1 at 7.61s over
    the same history, inside the spread of either on its own. If that pin ever
    becomes a knob, this stops being one number.
  - **A model with no row serves no price and the page prints nothing** — an
    invented figure is worse than a blank. ×3 (the LoRA's own three-in-one-tap)
    prints 3× the figure on its tooltip and likewise says nothing without one.
  - Test: `node scripts/test-playground-lora-price.js` (the arithmetic pinned
    against the row's own seconds and rate, then the real page headless with a
    deliberately WRONG figure served — a page printing its own copy would pass
    any check that used 1.16; verified failing 8 pre-fix).
- **Cancel is REPLICATE-ONLY, on purpose (Aug 2026, Sophie's call).** The X on
  a running job → "Are you sure you want to cancel?" → `POST
  /api/promptlab/:id/cancel` → status `cancelled`.
  - **Replicate** has a real cancel endpoint (`predictionId` is stored on the
    doc when the prediction is created) — the run stops and only the compute
    already spent is billed. The poll loop treats `canceled` as terminal, which
    it previously did NOT (that would have spun forever).
  - **A ChatGPT run gets NO X and the route refuses it (400).** OpenAI has no
    cancel for image generation — an image is billed the moment it's requested
    — so a cancel there would save nothing and only look like it did. Don't
    "improve" this by making the renders sequential to claw back the unsent
    ones: that was built, and Sophie rejected it (it slows every run down to
    buy a cancel she doesn't want).
  - Cancellation is an in-process `Set` (`plCancelled`) plus `cancelRequested`
    on the doc.
- A ChatGPT run's images are requested in parallel and each lands on the doc as
  it finishes (`status:'ready'`, then `'done'`), so the grid fills in as they
  arrive. One failed call costs its image, not the run.

#### A failed run says WHY (2026-08-27)

From Sophie's screenshot of the Playground list: a red card reading **"every
gpt-image-2 render failed — see the server log"** — an instruction she cannot
follow, on the one card whose whole job is telling her what happened. The real
reason was `console.warn`'d inside the per-render catch and thrown away, so the
API's own sentence lived for the length of one request.

- **`render-fail.js` owns the message** (`renderFailMessage(errs, want)`), pure
  and dependency-free. The API's own sentence leads VERBATIM, identical errors
  collapse with the COUNT behind them (`(3 of 4 renders)` — the difference
  between a bad prompt and a bad minute), different errors are all carried, and
  a run with genuinely nothing to say falls back to a plain sentence that
  **never points her at a log**. Capped at 300 chars and flattened to one line,
  because the card draws it under the prompt.
- **A PARTIAL failure is recorded too** — `renderErrors` beside `failedRenders`
  on a `done` run, so "3 of 4 came back" carries the reason the fourth didn't.
- **The panels job was already right** (it surfaces `err.message` straight to
  the doc); only the multi-output gpt job swallowed it.
- **The failure that prompted this was TRANSIENT, and that is measured.** Her
  run `HPpZc0SkXJtbj8Ukl1lN` (5:22am, dreamy + a photo ref, low, 1K) died with
  nothing to say; the identical `fullPrompt`, style reference and photo re-sent
  by hand came back with a picture first try, and her own re-runs at 5:24 and
  5:25 both drew. So the whole cost of the old message was that she could not
  tell "tap Generate again" from "change the prompt".
- **What is NOT built, and is hers to ask for:** `openaiImageEditRefs` retries
  only a THROWN error (network, timeout) — an `error` BODY from OpenAI (a
  stochastic moderation refusal, a 5xx, a rate limit) fails the render on the
  first try, which is what she is working around by tapping Generate again. An
  automatic retry there would spend input tokens (~1.2¢ a reference) on every
  refusal, so it is a money decision, not a bug fix.
- Test: `node scripts/test-render-fail.js` (pure — the rules, plus a source pin
  that the log sentence cannot come back into `server.js`).

### The character picker (2026-08-27)

Sophie: "add a little button in the playground right next to where it says
dreamy make sure it's the same style with a character icon that shows the five
most recent characters that were put and then also the rest of the sheet and
characters with a search."

`#charsbtn` sits in `.styles` beside `#stylepick`, wearing that control's own
ink border at its own 34px — the row she named, not the control row under it.
It opens `#charpanel`: the five most recent across the top, then a search box,
then the rest. Typing searches the WHOLE library (names and aliases), because a
search that skipped the five she can see would answer "no such character" about
one of them; with the box empty the lower grid is the REST, so the top row is
not printed twice.

**Where the library comes from.** `GET /api/promptlab/characters` →
`character.js`'s own `listCharacters()` over `forge-characters` — the same pile
the cast sheet and the dream flow read (143 of them, measured live
2026-08-27), never a second one. The only thing the route adds is the ORDER
Sophie's ask names: **recent = `lastUsedAt`, falling back to `createdAt`**, so
the five slots are the five she reached for last. Drawing here calls
`markUsed()`, which is also what the old `POST /api/character/used` route
calls — one definition of "recent", so the picker and the cast sheet can never
disagree.

**What rides, and in what order.** The picked ids resolve through
`charactersByIds()` and their bytes attach at the VERY END, after the style
references, after the Sophie card and after her photo reference. That order is
forced by the disclosure: `charLine()` in `pad-characters.js` — the same
sentence the Story Room sends — says "the last attached image(s)".

Which is why `PL_GPT.photoLineWithChars` exists. The photo's line has always
said "the LAST attached image is a photo reference", and the moment a character
rides behind it that sentence describes the wrong picture. The twin is the
identical instruction re-anchored ("the attached image just before the
character reference(s) at the end"), sent only when characters really ride;
the reference-less ChatGPT tile owns its own copy of both, since neither of
its lines may mention a style reference it does not have. **A run with no cast
sends the original byte for byte.**

**One copy of the wording.** `pad-characters.js` is UMD-wrapped (the
`pause-plan.js` pattern) and served at `/pad-characters.js`, so the Prompt
panel prints the REAL `charLine()` rather than a transcription of it that
drifts the day the sentence is reworded.

**Where it is NOT.** Off on the WTR LoRA — a trigger word and no attachment
slot at all. (This line used to say "and off on PANELS, for the reason the
photo ref is" — both are ON for a sheet now: the cast since 2026-08-27, the
photo since 2026-09-06. See *HER PHOTO RIDES A SHEET* below.) It is deliberately NOT
gated on `noCharacter`: that flag is about the SOPHIE CARD, which is the
watercolor look by another name, where a character Sophie picked herself is her
own subject and belongs on every gpt tile.

**Details worth not undoing.**

- **Not persisted**, the rule quality and the photo reference already follow —
  a cast picked last week riding today's run is a hidden ingredient that costs
  money (~1.2c a reference). It survives between runs in one sitting.
- **The cap is the shared `MAX_PICKED`** (6), served to the page, hardcoded
  nowhere.
- **A reference that will not fetch FAILS the run** rather than best-effort
  skipping it — a picture she aimed at Doug must not quietly come back without
  him. Bytes are cached per process.
- **Faces are derived display copies** — `FeedKit.thumbFor(url, 240)`. A saved
  character card is a full render (1.26MB measured; its thumb is 5.8KB), and a
  picker of 143 originals would be tens of megabytes over cell.
- **Both card rows reserve the pill's column**, measured by `fitCharPill()`:
  the sheet opens exactly where the injected autoscroll pill is fixed, and
  pre-fix its own `Fast` label sat on the fifth recent card — with her phone's
  47px safe-area inset the pill rides lower still, onto that card's middle.
- **`imageTypeOf()`** declares each attached reference as what its BYTES say it
  is. Every reference used to be labelled `image/png` whatever it held, which
  happened to work while they were PNGs from `refs/`; a character card off
  Storage is a webp.
- Test: `node scripts/test-playground-characters.js` (the server contract and
  the one-copy rules pure, then the real page with the real injected pill —
  verified failing 3 against the unreserved rows).

### The PANELS tab (Aug 2026, Sophie: "cut it into panels … describe each panel individually")

A hairline **PICTURE · PANELS** row at the top of `/playground`. On PANELS the
one prompt box becomes N boxes laid out AS the grid — she writes into the
layout she gets back — and Generate draws ONE gpt-image-2 sheet at the tier
budget, cuts it into N pictures server-side, and the run's `images` ARE the
cut panels, so the feed, tiles, votes, lightbox and search need nothing new.
Grids: **2 (two LANDSCAPE panels, stacked), 4 (2x2), 9 (3x3)** — 25 later is
one `GRIDS` entry in `sheet-grid.js` (plus a `promptMax` look: nine dictated
panels fit under 4000 chars at ~350 each; twenty-five will not).

- **THE BOXES FOLD (2026-08-28, Sophie: "make the panels grid collapsible").**
  Nine 2:3 boxes is most of a screen, and the controls and Generate sit under
  them — measured at 390pt, folding brings `.controls` up about 460px. A row
  above the grid (`#panelfold`, the page's own section label with a chevron)
  puts them away. Sticky in localStorage (`promptlab_panelfold`) and **OPEN by
  default**: the boxes ARE the prompt on this tab, so shut has to be a state
  she chose. Four rules, each of them a thing a fold must not cost:
  - **It hides with `display:none` and leaves the textareas in the DOM.** A
    fold can never lose her words, and `panelVals()` still reads them — so a
    folded Generate POSTs every panel and a folded story run sends the story.
    The tab's own `hidden` is separate and always wins (the page's
    `[hidden]{display:none!important}`). `buildPanelGrid` writes the mode onto
    `data-mode` and `paintPanelFold` is the ONE place that sets `display`, so
    a rebuild can never reopen a shut fold.
  - **Shut, the row says how many are written** — "Panels · 3 of 9 written",
    or "Story · written". **Open it does not**: the boxes are right there, and
    saying it twice is the archive summary's own lesson.
  - **Anything that means "write in these boxes" OPENS it** — picking a grid
    or Story, a run's copy button ("panels are back in the boxes" has to be
    true on screen), and a Generate error naming an empty panel, because an
    error pointing at a box she cannot see is no error.
  - Test: `node scripts/test-playground-panel-fold.js` (the real page
    headless — the fold measured as the controls moving, the words read out of
    the hidden boxes, the POST, the stickiness across a reload, and each door
    that reopens it).
- **AND THE ROW CARRIES A CLEAR (2026-08-29, Sophie: "add a clear button at
  the top of panels").** `#panelclear`, an underlined word at the end of the
  fold row — the house inline opener's paint (no box, no plate), because the
  row is a 10.5px label line where a bordered control would be the heaviest
  thing on the screen. It empties the grid she is ON, or the story box, and
  nothing else. Four rules:
  - **It is a SIBLING of the fold, never inside it.** `#panelfold` is a
    `<button>`, so a nested button is invalid AND the tap would bubble into
    folding the boxes away; `#panelrow` is the flex wrapper that holds the two
    side by side, and it is the wrapper `paintPanelFold` hides off the Picture
    tab now.
  - **It is drawn only while something is written** — `anyWords(panelWords())`
    on every repaint, which is why `stashPanels` and the story box's own input
    handler call `paintPanelFold`: the clear arrives with her first word and
    leaves with her last, and is never a control that does nothing.
  - **It asks first ONLY over UNSEEN work.** A draft that matches
    `promptlab_panels_drawn_<g>` clears silently — that sheet is in her feed
    with its prompt one tap from copying back — and one that never drew asks
    through the page's one `askOpen` box. Same question as the carry, for the
    same reason.
  - **Clearing OPENS the fold**, since she is about to write in the boxes
    again, and it goes through `buildPanelGrid`, which closes an open panel
    popup rather than leaving it pointed at a dead node.
  - Test: `node scripts/test-playground-panel-clear.js` (the real page
    headless — the tap asked with `elementFromPoint`, the boxes still open
    after it, both answers to the pop-up, the other grid's draft untouched,
    the drawn draft's silence, and Story).

- **HER WORDS COME WITH HER WHEN SHE CHANGES GRID (2026-08-29, Sophie: "if
  there's text in one of the grids if I transferred to that grid, my words
  don't transfer. They should transfer, but if the text that was saved as a
  draft has never been drawn trigger a pop-up").** Each grid keeps its own
  draft (`promptlab_panels_<g>`), which is right for coming BACK to one and
  was the whole of the behaviour — so switching 4 → 9 gave her nine empty
  boxes and the paragraph she had just dictated was reachable only by tapping
  back. `carryInto(to)` reads the boxes and writes them into the arriving
  grid, first cell to first cell, before the switch paints.
  - **The grid she LEAVES is never written to.** Its own copy is already
    saved (every box stashes on input), so a carry can only overwrite the
    grid she is ARRIVING at. That is what makes one question enough, and what
    makes 9 → 2 safe: the seven that do not fit are still in the nine, and
    the pop-up's fine print says how many stayed behind.
  - **The pop-up is only ever about UNSEEN WORK.** It is silent when the
    target is empty, when it already says the same thing, or when what it
    says has been **drawn** — that sheet is in her feed and its prompt copies
    back in one tap, so replacing the draft costs her nothing.
  - **"Drawn" is the EXACT array that was sent**, stamped per grid at the
    moment a panels run starts (`promptlab_panels_drawn_<g>`) and by a run's
    copy-back button (words put back out of a finished run were drawn by
    definition). So editing one box after a draw makes that grid undrawn
    again — which is honest, because the words sitting there are not the
    words that were drawn. Nothing clears a stamp; it only stops matching.
    A draft written before this shipped matches no stamp and asks once.
  - **A carry that would land empty-handed is not a carry** — going 9 → 2
    with words only in panels 3-9 must not wipe the target with blanks.
  - **"Keep what's there" still takes her to the grid she tapped.** She asked
    to go there; the only question was whose words it holds.
  - **STORY IS OUT OF IT, BOTH DIRECTIONS.** A story is one prose block and
    the panels are a line per cell, so a transfer either way would mean
    rewriting her words rather than moving them.
  - **The cancel dialog became THE confirm box** (`askOpen({msg, fine, no,
    yes, onYes, onNo})`) rather than a second copy of itself; both answers
    close the box FIRST, because either may repaint the page. A third thing
    that needs to ask her something calls it.
  - Test: `node scripts/test-playground-panel-carry.js` (the real page
    headless — a source assertion cannot tell a carry from a grid that
    happened to hold the same words, nor see a pop-up that never opened;
    verified failing 8 pre-fix). `test-playground-panels.js`'s old
    "9 → 4 → 9 loses nothing" assertion was the OLD separate-drafts contract
    and is superseded, not broken.

- **THE 2 OPTION PINS ITS CELL SHAPE (2026-08-27, Sophie: "2 option shud be
  landscape in panels").** It used to be two PORTRAIT panels side by side,
  following the canvas toggle like 4 and 9 — the one grid where the toggle
  produced a shape nobody wants: a pair of tall narrow panels on a wide sheet.
  A `GRIDS` entry may now carry `shape`, and 2 is `{ across: 1, down: 2, shape:
  'landscape' }` — two wide panels one above the other, which is what a
  two-panel page is. Three things fall out of the pin, and none of them is a
  new route (her question, "add endpoint?": **no** — a panels run is the same
  `POST /api/promptlab` with `panels` + `grid`, and the geometry is derived):
  - **`landscape` is the portrait cell rotated and has NO res row of its own**
    — `SHAPES.landscape.budget = 'portrait'` names the tier table it borrows
    its pixel budget from, so a landscape 2K panel is exactly as many pixels as
    a portrait 2K one and there is no second copy of the budgets to keep in
    step. Sheets: 1K **1104x1472** · 2K **1680x2240** · 4K **2448x3264**, cells
    3:2 (1104x736 · 1680x1120 · 2448x1632).
  - **The canvas toggle decides NOTHING for a pinned grid, so the page hides
    it** (`canvasApplies()` in promptlab.html) rather than leaving a control
    that changes nothing — the same rule the LoRA's hidden knobs follow.
    `sheetFor('square', 2, …)` and `sheetFor('portrait', 2, …)` derive the
    identical sheet, which is what makes hiding it honest.
  - **The naming and the grid sentence follow the geometry**: a single column
    is named `top` / `bottom` (never "top left" — there is no right-hand one)
    and its reading order is "top to bottom" alone. A run's cell ratio `3:2` is
    searchable as **landscape** (`PL_SHAPE_WORD`, one map in server.js and one
    in promptlab.html, pinned equal by the panels test).

- **THE SHEETS VIEW (2026-08-27, Sophie: "add a section to see just the
  finished sheets, uncut, by themselves").** A third chip in the filter box,
  PANELS tab only, sticky like its neighbours: lit, the gallery shows ONE
  cell per run — the banked uncut sheet (`sheetUrl`). A story sheet and a
  cut-failed run already ARE their sheet, so they open at their ordinary
  index; a cut grid run's sheet opens at the VIRTUAL index `-1`.
  **THAT INDEX IS A REAL PICTURE, NOT A PREVIEW (2026-08-27, Sophie:
  "missing three buttons too").** It was view-only, because a vote is an
  index into `images` and the sheet is not in it — so the one picture of the
  run she actually paid a 4K sheet for had no ♥, no ✕ and no way to the
  Story Room. All three ride `-1` now: the vote route takes it (keyed
  `votes["-1"]`, synced onto the Assets record its own filing made, "the
  sheet — N panels"), the note thread loads, and the Story Room walk carries
  `&i=-1` which `loadSend` resolves to `sheetUrl`. So the ♥/✕ chips STAY lit
  in this view and filter it like any other. `sheetCellOf` / `sheetArOf` in
  promptlab.html are the cell rule.
  **And its caption is `sizeTier.sheetSize` — the sheet's OWN tier (`4K`),
  never the run's fraction**: printing `1/9 (4K)` over the picture that is
  every panel at once is what made the old caption contradict itself two
  slots later ("1/4 (1K) … uncut sheet").
- **THE STORY OPTION (2026-08-27, Sophie: "a sheet where i give instructions
  for a story, and have the image model decide the exact panels").** A
  fourth stop on the grid picker — **2 · 4 · 9 · Story** — where the boxes
  become ONE box (placeholder "The story", her words persisted like the
  panel texts) and the MODEL decides the panel count, sizes and arrangement.
  There is no grid to cut along, so the sheet is delivered UNCUT — it is a
  story, not a failed cut, and the card says **story sheet**. Mechanically a
  single run (`story: true` on the POST): the plain tier canvas the toggle
  picked (the toggle stays on screen — it decides the SHEET here),
  `runPromptLabGptJob`, votes and the lightbox as-is; `storySheet` on the
  doc is what files it in the panels gallery and under Sheets, and both
  kind-rule twins carry it. The wrapper is `PL_STORY` in server.js — the
  `line` rides the head directly before her words (served by /styles,
  printed in the Prompt panel, landing in the filed style half), and
  `layout` fills the sheet swap so a tail's anti-grid clause is swapped
  exactly as on a grid sheet. The Sophie card is OFF (the panels branch's
  own reasoning); her cast and her photo ride it on the same terms as a grid
  sheet. `'story sheet'` is searchable in both
  haystacks; a story run's copy button refills the story box.
- **HER PHOTO RIDES A SHEET (2026-09-06, Sophie: "i can add a photo
  reference in playground but not in panels").** The photo button was hidden
  on the Panels tab and the server ignored `photo` on a panels or story run,
  on the reasoning that keeps the Sophie card off there — "the wording names
  the second/last attached image for ONE picture". That reasoning was wrong
  for the photo: its line says "the LAST attached image … use it for the
  subject described below", the same shape as `charLine()`'s, which was
  turned on for sheets for exactly that reason. So a sheet takes her photo(s)
  in the single run's own seat — after the style refs, before her cast, the
  line re-anchored (`photoLineWithChars`) when cards ride behind it — the run
  doc stores `photoRef`/`photoRefs`, `panelsCfgOf` rebuilds the urls and the
  sweep's panels redraw re-fetches the bytes first (a sheet without its photo
  is a different sheet, the single run's own rule), and a panels run's copy
  button puts the photo back. The Sophie card stays off. Test:
  `node scripts/test-playground-panels-photo.js`.
- **THE GALLERY UNDER THE TAB IS SEPARATE PER TAB (2026-08-27, Sophie:
  "separate the gallery for playground for single pics vs panels").** The
  feed follows the PICTURE · PANELS row: each tab shows only its own runs —
  pendings, list, tiles, the search and the lightbox walk all scoped the same
  way, because they all come through `visibleRuns`/`pendingKept`. The kind
  rule is `runIsPanels` (promptlab.html) / `plRunIsPanels` (server.js), the
  identical expression pinned by the panels test — a failed panels run still
  carries `panels`, so it stays in the panels gallery where its retry belongs.
  Three mechanics worth knowing:
  - **The PANELS tab has no "Older"** — panels runs are a sliver of the feed,
    so paging 40 mixed docs to find them would make Older a button that
    mostly adds nothing. Opening the tab sweeps its WHOLE history in one read
    (`GET /api/promptlab?kind=panels`, the search path's 60s-cached scan).
  - **The PICTURE tab's Older cursor is the oldest SINGLE run**, never the
    oldest anything: the sweep merges ancient panels runs into the shared
    `feed`, and a cursor off one of those would skip every single run between
    here and it. The walk asks `kind=single`.
  - **A search is scoped to the tab server-side too** (`kind=` on the query),
    so the 300-hit cap can never hide a panels hit behind single ones; the
    client still filters `hits` by tab, because a stale answer from before a
    tab switch can land. An older cached page sends no `kind` and the route
    answers exactly as it always did.
- **The geometry lives in `sheet-grid.js` and is SERVED, never copied** —
  `GET /api/promptlab/styles` answers `panels` (grids, cell names, the grid
  sentence, derived sheet/cell canvases per shape × grid × tier). The canvas
  is DERIVED so every cut lands on whole pixels: the 2x2 grids land exactly on
  the live tier canvases, and a 1×1 derivation reproduces all six Playground
  canvases from the constraints alone (`scripts/test-sheet-grid.js` pins it).
  The canvas toggle picks the CELL's shape — unless the grid PINS one (the 2
  option), and then the toggle comes off; the 1K/2K/4K tier is the SHEET's
  pixel budget either way.
- **The style tail's anti-grid clause is SWAPPED, never argued with** —
  Dreamy's "Render as ONE single illustration — NOT a grid…" is load-bearing
  on an ordinary run and poison on a sheet, so `PL_GPT_STYLES.dreamy.sheet`
  carries a `{from, to}` the same shape as the no-text toggle
  (`sheetGrid.applySheet`; the two swaps touch disjoint clauses and compose).
  An edited tail no-ops the swap — her wording wins, disclosed in the Prompt
  panel. Hoonies' PREFIX also fights grids ("alone on a plain white
  background") and is deliberately left as-is — she can edit it per style.
- **The cut is IMAGE-AWARE — mid-gutter, never blindly on the math line
  (2026-08-26, Sophie's first live look: "the cut should be in the middle of
  the tan area, but two of them got one side cut right on the black edge").**
  The model draws the grid slightly off the exact lines, so `findSeams`
  (sheet-grid.js) profiles the ink near each math line — a window of ±12% of
  the cell, small so a pale patch inside a panel can never pull a seam into
  the art — and cuts through the middle of the real paper valley between the
  frame edges; no qualifying valley (a full-bleed style, no contrast) falls
  back to the exact math line, so the worst case is the old behavior.
  Verified against the very sheet she screenshotted: seams moved x 512→507,
  y 768→774 and both flagged panels came out framed. Each panel files its
  REAL post-seam canvas. Mechanics otherwise unchanged (`cutSheet`): decode
  ONCE to raw (~33MB for a 4K sheet on the 512MB box), `extract` each cell
  in a plain for-loop, `webp({lossless:true})`. The paid sheet is banked to
  Storage BEFORE the cut; a failed cut ends
  `done, images:[sheetUrl], cutFailed:true` — the money is never lost, and
  the card says "uncut sheet".
- **Filing**: the sheet files once (caption = the sheet's own tier), each
  panel files with ITS OWN words as the caption and
  `sizeSlot = sizeTier.cutSize(sheet, count)` → **`1/9 (4K)`** — the fraction
  and the SHEET's tier, because a ninth of a 4K sheet lands on the 1K rung by
  its own pixels and would read as an ordinary small picture.
- **Cost is shown as APPROXIMATE, on purpose**: gpt-image-2 does not price by
  area, so a derived sheet canvas has no measured price — the tier tooltip
  says "about … (nearest measured tier)" and the run stores the API's own
  `usage`, which is the truth. Never print an invented exact number.
- **The honest quality risk**: the model does not always draw panels exactly
  on the grid lines, so a cut can shave a border. The grid sentence asks for
  equal rectangles with edges on the lines and no gutters; Dreamy asks for a
  hand-drawn border per panel, which absorbs small misalignment; and the
  uncut sheet is always kept on the doc (`sheetUrl`).
- **A PANEL'S PUT-BACK IS ONE PICTURE'S WORDS, ON THE PICTURE TAB (2026-08-27,
  Sophie: "pressing the playground button on images made by panels should copy
  text into the single picture … not the whole panel").** Two per-PICTURE
  controls were handing her the whole sheet instead, and the second one was
  silent:
  - **The lightbox's "Put this prompt back in the box"** called `copyRunIn`,
    which for a panels run refills all nine boxes — so the button on panel 4
    answered with the other eight. `copyPictureIn(r, i)` puts THAT panel's own
    words in the one box and switches to PICTURE; a panel is a complete
    picture and re-running it is a single-picture job. **The run card's copy
    button still refills the grid** (`copyPanelsIn`) — that card IS the run,
    and those boxes are where its words came from. Two different questions.
  - **An arriving `?prompt=` now lands on the PICTURE tab.** The tab is
    STICKY, and the Panels tab is exactly where she is when she taps a panel
    image's Playground button in Meta Assets — so the ported prompt was
    landing in `.promptwrap`, which that tab HIDES, and the Generate she fired
    next drew her saved panel boxes instead. Nothing on screen said so and the
    ported words were never used. It is a `localStorage` write, deliberately
    **not `setTab()`**: that block runs partway down the script where syncTab's
    painters are not all wired yet (`rpick` is a `var` several hundred lines
    below, and calling it there threw before the prompt could even be filled).
    Boot's own `syncTab()` paints it. A PLAIN open still honours her sticky
    tab — the switch belongs to the port. The Story Room's beat trip carries
    `?prompt=` too, so it is fixed by the same line.
- Character card, photo ref, the ladders and `padTarget` are OFF on this tab
  (each names or prices ONE picture). The vote route's image-index cap was
  widened 0-3 → 0-24 for panel hearts — it 400'd on panel 5 of 9.
- Tests: `node scripts/test-sheet-grid.js` (pure — geometry, naming, the
  swap pins against the live literals) and
  `node scripts/test-playground-panels.js` (the real page, headless).

## Freeform (`/freeform`) — your own refs, your own words, NOTHING added
- `freeform.js` (`/api/freeform`, page at `public/freeform.html`) — the one image
  surface with **no opinion**. Every other one wraps her words in a house style
  (Playground prepends `PL_GPT.prefix`, the Scratch Pad locks a style per story,
  the passport paints pastel); here the prompt is sent to gpt-image-2 **verbatim**
  — no prefix, no suffix, no trigger word, not even a trailing-period trim. If the
  prompt should mention a style, SHE says it. `promptSent` is stored on every run
  so the page (and any later reader) can verify nothing was added — this is the
  "if you add anything to a prompt Sophie gave, tell her" rule made structural.
- **References are a LIBRARY, not a per-run upload** (`forge-freeform-refs`):
  upload once, attach to any later run and to several at a time — the point is
  trying the same references against different words. Bytes at
  `freeform/refs/<id>.<ext>` + a 512px webp display copy; deleting a ref drops
  the record but KEEPS the bytes, or a finished run's history would break.
- **Quality low / medium / high** (0.5¢ / 4.1¢ / 16.5¢ at 2:3 — the table in the
  Playground section above; the SQUARE is the dearer canvas, not the cheaper),
  size portrait 2:3 (default) /
  square / landscape, 1-4 images a run. With refs attached it calls the **edits**
  endpoint; with none it calls **generations** (edits requires an image).
- Background job on the doc (`forge-freeform`), each output lands as it finishes
  so one failed call costs its image not the run; the page polls, remembers
  pending ids in `localStorage`, and resumes on return. STUDIO_TOKEN-gated
  (only `GET /status` open). Routes: `/status`, `POST/GET/PATCH/DELETE /refs`,
  `POST /run`, `GET /runs`, `GET/DELETE /run/:id`.
- **The lightbox is THE SHARED ONE since 2026-08-28** (`/asset-lightbox.js` —
  Sophie: "create a single lightbox view, sync to all surfaces"): the page
  builds none of its own. An OUTPUT opens with this run's prompt behind the
  PROMPT door (the verbatim `promptSent` as the content half; a style half
  only when the boiler really rode along — no wrapper, no Style button, the
  module's whole promise made readable) and steps through the run's pictures
  with the invisible `nav` zones; a REFERENCE thumbnail opens plain — her own
  photo, no prompt to show. Pinned by the source pin in
  `node scripts/test-asset-lightbox.js`.

## Vector pipeline (`/api/vector`) — described drawings → art that scales
- **Making vector art, or touching `vector.js` / `vectorize.js`? Read
  `docs/vector-pipeline.md` FIRST** — Sophie asked for it written down so any
  chat she points there can use it without re-deriving the recipe. It carries
  the exact style (prompt wording, model, refs, size, quality), the routes, the
  gotchas and the test.
- **What it does:** describe 1-25 drawings → ONE gpt-image-2 sheet in the pastel
  house style (5.3¢, the only cost) → cut into cells → lift each off its paper →
  trace each to SVG (**free**, local, ~1.3s) → an SVG + a 2048px PNG per
  drawing in Storage. `POST /sheet`, poll `GET /job/:id`. `POST /trace` does
  just the tracing half on any flat-colour image URL, for nothing. `POST
  /prompt` shows the literal prompt and spends nothing.
- **What a vector buys:** sharp at any size from one ~100KB file, recolourable
  by editing a fill, and its outline IS the cut line for a die-cut sticker. On
  a phone screen a PNG already looks the same.
- **The one hard limit is GRADIENTS** — the tracer reduces a picture to a few
  flat colours, so a wash, a soft shadow or a photo has none to find and comes
  out bigger AND worse than the PNG. Ink lines and solid fills are what it
  handles. That is a limit of the tracer, not art direction.
- **The style is the Gravity Lock card recipe verbatim** (`HOUSE` in
  `vector.js`) — the same two Witch School style refs the pastel house style
  uses, the same grid clause, the same no-text suffix. Don't let prompts
  drift; add a NAMED style if a different look is needed.
- **Re-cutting a sheet you already paid for is free** — pass its url back as
  `sheet`. Tuning the trace must never re-bill the model.
- **Pick the grid by how much is IN each drawing, not by how many you want
  (measured Aug 2026, 3x3 drawn at all three qualities).** Nine fits and the
  tracer does not care — 341px cells trace within 4.8/7.4/6.4% of the source,
  inside the 8% the 2x2 cards are held to. What changes is the MODEL: at 3x3 it
  draws simpler objects (2.9 fills a drawing against 4.75 at 2x2). So 2x2 for a
  drawing with detail, 3x3 for simple objects and icons (0.7¢ each). 5/7/8
  don't tile — the spare cells are drawn and binned, so ask for 4, 6 or 9.
  Quality is 0.6¢ / 5.3¢ / 21.1¢ a SHEET (it draws square); all three trace
  cleanly. **Nothing about the
  tracer is tuned per quality or per grid** — they are inputs, the defaults are
  untouched; the only per-drawing options are `fills` and `darkBackground`.
  **5x5 TRACES FINE** — on a real 21-icon sheet (204px cells) 3 of 21 drew lines
  8.6-9.3% fat, but put those three beside their sources and they are
  indistinguishable: the 8% figure is a regression detector calibrated on the
  2x2 cards, NOT a threshold of visible badness. An earlier note here called
  5x5 "past the edge" and that was wrong. The route still caps at 9 for a
  different reason — this module has never DRAWN a 5x5, so the model placing
  25 described drawings from this prompt is untested. And **webp
  costs the trace nothing** — measured same-sheet against PNG, max 7.0% vs
  7.4%; the "PNG traces better" claim was reasoning and it was wrong, so never
  re-render a sheet hoping to improve a trace.
- **Two gotchas that cost real time:** a dark-background drawing needs
  `darkBackground:true` (the cut-out is a corner flood-fill and would eat the
  background — the Grand Tour card is the live example), and the Assets tab
  dedupes by FILENAME, so a v2 needs a new *filename*, not just a new folder.
- **CHANGE ITS COLOURS AFTER THE FACT — `POST /api/vector/recolor`, free
  (Aug 2026, Sophie).** Hex or a CSS colour NAME (`salmon`, `steel blue`), as
  a list parallel to the palette or a map keyed by source hex / slot; `ink`
  and `paper` too. No colours at all = it answers with the palette and writes
  nothing. **It is NOT a find-and-replace and must never be turned into one:**
  vtracer writes a 4-colour palette out as 21 hex values (shapes come back
  slightly shifted, plus thin blend layers at every seam), so swapping exact
  matches recolours a 0.08% sliver and leaves a fringe of the old colour round
  every edge. Every fill is mapped by where it sits between its two nearest
  anchors. Recolouring nothing returns the identical file, byte for byte.
- **The front is `/vector` (`public/vector.html`), iOS tile "Vector" under the
  PICTURES filter (Aug 2026, Sophie: "make a new tool in the image tab").**
  `tool.css` step flow: describe drawings (the one starred, paid control) or
  trace a picture you already have (free) -> tap a drawing -> **one text box
  per colour**, prefilled with its hex, plus LINE and PAPER left blank (empty
  means leave it). Filter-only like the Test Station — it is deliberately not
  on the default home. Its glyph is the bundled `Vector` asset (a bezier curve
  with its two anchor points); `deckfactory://vector` opens it.
  **v1 broke three house rules by copying its neighbours, and the fix went
  into the KIT, not just this page (Aug 2026, Sophie).** It said "VECTOR"
  twice (its own eyebrow under the native bar's title — `GatedWebTool` now
  appends `?embed=1` for every tool and `serveGated` hides `.tool-eyebrow`),
  it shipped example drawings sitting in its text box (now empty; the example
  moved into the `?` card), and its buttons were longer than their words. See
  the four rules in the tool.css note above.
- Tests: `node scripts/test-vectorize.js` — asserts against the SOURCE card
  (no invented colour, no dropped colour, line weight, structure), not against
  the Python it was ported from. It deliberately does NOT catch small
  localised wrong-colour patches; that class is caught by looking.
  `node scripts/test-vector-recolor.js` is the recolour gate (measured on the
  rendered picture, not on the file), and `node scripts/test-vector-page.js`
  drives the real page end to end against a local server — both free to run.

## Pattern — animals and fruits on one tile, it repeats (a Compare page)

2026-09-22, Sophie: "we need to make a program that lets me choose and arrange
animals and or fruits into a repeating pattern" · "i need to choose the
constituents, choose how much to rotate, choose how far apart, and choose
where they go" · and, on the first cut (a served page with an iOS tile):
"does it need to be a page · can't it just be in compare · make a note saying
things start in compare unless i explicitly ask for page". So it is a COMPARE
PAGE: `docs/pattern/pattern.tpl.html` built and posted by
`scripts/pattern-page.js` into the animal-fruit-pattern-tool chat's Compare
tab. Behind it, not needed by it: `pattern.js` (`/api/pattern` — the pieces
list, a server-side sharp export, the paid DRAW of a new piece),
`pattern-plan.js` (the arithmetic, inlined), `scripts/pattern-seed.js` (fills
the pieces list), `scripts/test-pattern.js`.

### Her four choices are four fields
An item on the tile is `{ piece, x, y, size, rot, flip }`:
- **the constituents** — `piece`, ticked on the PIECES tab (tap a picture; tap
  again to take every copy of it off);
- **how much to rotate** — `rot`, degrees: the box under the tile takes a
  typed number, −15/+15 step it, **Spin** turns every piece at random within
  the ± she sets (seeded by the tap, so twice is two spins);
- **how far apart** — the tile's size against the pieces': `x`,`y` are
  FRACTIONS of the tile, so the **spacing** slider (tile side 500–2500 units)
  spreads every repeat without moving anything's place;
- **where they go** — drag on the canvas; **Scatter** is an even staggered
  grid to start from; **+** adds another of the selected piece at the freest
  spot (the torus distance, since the tile wraps).

### No deploy, by construction
- **Her patterns live on a verdict doc** — chat `animal-fruit-pattern-tool`,
  sheet `pattern`, one JSON text per pattern config (`p:cfg:<id>`: name, tile,
  layout, the last six exports) and one per item (`p:it:<id>:<k>`; a removed
  item is blanked). Its OWN sheet and a `p:` prefix on every key, so the note
  thread (`pattern-notes`, `__compareNotes`) can never overwrite one — the
  2026-09-07 rule, and the page-kit warning that enforces it is part of the
  test. A pattern never saved yet writes its config with its first item.
- **The export is drawn on the page** — the output image on a canvas at
  1024 / 2048 / 4096 px per tile width, `toBlob`, POSTed to
  `/api/drop/upload-file?bundle=Patterns&filename=<name>-<size>-<layout>.png`
  — so it has a permanent url and the Dump's save link. A 4K export is 16M
  pixels on the phone; the page says "too big" and suggests 2K if the canvas
  refuses.
- **The pieces are baked in** — `pattern-page.js` reads every ready, unhidden
  doc on `forge-pattern-pieces` (id, name, kind, thumb, cut, w, h — ~300 bytes
  each) and inlines the list; a new piece reaches her through a re-post
  (`--go --supersede <old id>`, the version off `docs/pattern/VERSIONS`).
  `--pieces file.json` hands a list in (the test), `--out` writes the page.

### The plan is the file
`pattern-plan.js` is inlined into the page and required by the module.
`tileDraws` lists every draw for the tile with its wrap copies (nine per item,
the ones that cannot touch the tile dropped); `draws` lists the OUTPUT image
for a layout — `grid` (w×h), `half` (2w×h, the second column dropped h/2 and
wrapping), `mirror` (2w×2h, the copies carrying `mx`/`my`, which the renderer
applies as a scale OUTSIDE the item's own turn and flip — a reflection by
construction). The page draws that list on a canvas (translate → mirror →
rotate → flip → drawImage) and tiles the result with CSS for the previews;
the module's `renderPattern` draws the same list with sharp. The test rolls
every item half a tile and requires the identical picture rolled, byte for
byte — a seam is a failure.

### The pieces list
`forge-pattern-pieces`, one doc per piece, id = sha1(source url). `src` is
the picture on its paper, `cut` a transparent LOSSLESS webp (trimmed to the
ink, NOT re-padded square, so `size` means the ink's longest side), `thumb` a
320px lossy copy, `w`/`h` the cut's box. The cut is `vectorize.cutout` —
corner flood-fill at tol 22 — run on filing (`status: cutting → ready |
failed`). Seeded 2026-09-22 with 175 pictures — the card-pattern chat's
decks (`scripts/decks/animals-drawn.json`, 72 animals; `plants-drawn.json`,
30 plants; `fruits-finished.json`, her 15 finished fruit picks) and the fruit
chart's records (the 27 fruits, the hq/redo/2K passes, the v4 vegetables) —
one per name, the FIRST source in the script's preference order winning and
an older twin hidden (8 were), card-only pictures under 500px skipped. Kinds:
animal · fruit · vegetable · plant · other. Re-running the seed is one list.
Once the module is deployed, `POST /api/pattern/pieces {name, kind, src}`
files another and `POST /pieces/draw {name, kind}` draws one in the fruit
chart's recipe (`scripts/fruit-redraw.js`: `refs/sage-sandy-mirror.png`,
gpt-image-2, medium, 1024x1024, ~6c) — stamped, filed into My Creations, cut.

### What the first cut was, so nobody rebuilds it
A `public/pattern.html` at `/pattern` on tool.css with an iOS tile, merged
2597/2599 and removed the same day (the route, the page, the `Tool` case,
the applinks entries). The module and the seed stayed; the page moved into
the Compare tab. That is the rule now — *THINGS START IN COMPARE* in
CLAUDE.md's checklist.

## Card-deck art generator (Midjourney via APIFRAME)
- `apiframe.js` (`/api/apiframe`) generates the deck card art with **Midjourney**,
  which Sophie's original decks used. Midjourney has no official API, so this goes
  through **APIFRAME** (`APIFRAME_KEY`), which runs its *own* MJ accounts and
  exposes a REST API — no personal MJ account is involved or at risk. Base
  `https://api.apiframe.ai/v2`, `X-API-Key` header. **Gotcha:** APIFRAME sits
  behind Cloudflare bot-protection that 403s ("error code: 1010") any request
  without a browser `User-Agent`, so the module always sends one.
- **Routes:** `GET /status`; `POST /generate` (`{prompt}` or `{plant, style?}` +
  optional `aspectRatio` default `5:7`, `styleRef` = a public image URL used as a
  Midjourney `--sref` to lock Sophie's look) → `{jobId}`; `GET /job/:id` polls,
  and on `COMPLETED` mirrors the **4** MJ options to Firebase (MJ CDN URLs expire;
  `?save=0` to skip). `imagine()`/`job()` are exported helpers. STUDIO_TOKEN-gated.
- **No text in the prompt** — Midjourney is unreliable at spelling; the plant-name
  label is overlaid later in prep, not generated. Pricing: 16 credits per generate
  (=4 options), 4 per upscale; ~6–8¢/generate on a paid plan.
- Flow: generate (MJ) → pick 1 of 4 → label overlay + print prep → MPC fulfilment.
- **Bring-your-own-Midjourney** (`ingest.js`, `/api/ingest`, page at `/import`):
  the alternate art path — Sophie generates in her *own* MJ account and bulk-
  downloads keepers by keyword with a browser export tool (that step runs on her
  computer; the server can't automate MJ's download — no API, her account, needs
  a browser). This module automates everything after: `POST /upload`
  (`{batch, keyword?, images:[dataURL|url]}` → Firebase `ingest/<batch>/`, filename
  keyword-tagged), `POST /upload-zip?batch=&keyword=` (the raw .zip as the request
  body → unzips server-side and ingests every image, skipping `__MACOSX`/non-image
  junk — so a bulk MJ export uploads in one shot, phone or desktop),
  `GET /batch/:batch?keyword=` (list a batch, keyword = filename substring filter),
  `GET /batches`. The `/import` page (serveGated) is a phone/desktop uploader
  (individual images or a whole ZIP). Batches feed the same review → prep → MPC flow. Trade-off vs
  APIFRAME: own-account is cheaper (flat MJ sub, exact personal style) but manual +
  computer-bound; APIFRAME is fully cloud-automated (~7¢/img). Claude reviewing a
  batch and picking the on-style option is the shared payoff of both paths.
  - **`browser-extension/`** (Chrome MV3, "Send to Deck Factory") kills the
    export/import friction: a floating button on midjourney.com grabs the page's
    MJ images and POSTs them straight to `/api/ingest/upload` (runs in Sophie's
    own logged-in session — no MJ password, no server-side MJ automation). Load
    unpacked; set the app URL + STUDIO_TOKEN + batch/keyword in the popup. The
    image-grab (`collectMidjourneyImageUrls`/`toFullRes` in `content.js`) needs a
    first-run calibration pass against MJ's live DOM (it logs what it finds).


## Moved from CLAUDE.md (2026-09-14)

Moved here verbatim from `CLAUDE.md` on 2026-09-14 so that file stays readable;
CLAUDE.md keeps a one-sentence pointer per entry. Nothing was reworded.

### Playground

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
  - **BUT A PANEL SHEET GOES IN PANELS (2026-08-28, Sophie: "the playground
    is for me, but panels should go in panels").** The PICTURE tab is hers
    alone; a container-drawn PANEL SHEET files its finished record into the
    Panels tab — `POST /api/promptlab/panels-import` writes a DONE run doc
    (no generation, no cut, no money on Render), and kind=single can never
    see it, so the Picture tab stays untouched by construction.
    `scripts/draw-panel-sheet.js` calls it by itself; a hand-rolled container
    draw must POST it too (panels+images PAIRED, the real draw time, the
    exact fullPrompt or nothing — `panels-import.js` refuses a mismatch).
    This does not replace the Assets-tab filing — the ritual still runs; the
    import deliberately files no creations, or it would double every picture.
  - **Render's `/api/promptlab` is for HER TAPS**, and for a run she asked to
    exist in the Playground (a ladder she wants to compare there, a picture
    she will re-roll from the page). Ask before starting one on her behalf.
  - **There is NO delete route for a run** — `/vote` and `/cancel` are all
    there is, and the ✕ that hides a picture is hers to cast. So a run a chat
    starts in her feed cannot be tidied away afterwards without an Admin
    write. Don't start it. Fixed recipe per style so runs stay comparable: ONE
  image a run, 2:3, Generate is the stars icon. Eight styles: WTR (the only
  Replicate LoRA), **Sandy mirror**, **ChatGPT**, **Dreamy**, **Triangle**,
  Scarry, Pastel, Hoonies (all gpt-image-2, her own scans attached as style
  refs, kept in `PL_GPT_STYLES` in server.js).
  **TRIANGLE IS DERIVED FROM DREAMY, NOT WRITTEN BESIDE IT (2026-08-31,
  Sophie: "add triangle as a new playground style · w image and prompt w new
  equilateral")** — the Triset game's triangular picture cards, offered as a
  tile so she can draw one of anything instead of only getting them out of a
  found set. Same reference image (`refs/dream-mystery.jpg` — her "w image"),
  same anti-content prefix, same tail, with dreamy's rectangular BORDER clause
  swapped for the equilateral triangle-card one; her no-text toggle sits after
  that clause and rides along untouched. **The wording and the swap live in
  `triangle-clause.js`, the ONE copy shared with `triset.js`** — the "new
  equilateral" half of her ask is that clause, so a card she likes in the game
  and one she draws here can never drift apart. (An earlier "USE THE TRIANGLE"
  composition line is HISTORY, not a rule — she cut it the same day, "i didn't
  ask you to add the triangle lines"; the way to better cards is to say
  EQUILATERAL harder rather than to say more things.) Three things not to
  undo: it is **built by `triangleStyle(PL_GPT_STYLES.dreamy)`**, so a reword
  of hers reaches the tile the day she makes it; it carries **its own panels
  swap**, because dreamy's sheet anchor is the clause this tile consumed and
  `applySheet` no-ops on a missed anchor (a sheet run would otherwise ship
  "NOT a grid" into a grid prompt); and the **port's evidence is a SHORT
  DURABLE STEM PLUS EVERY PAST WORDING, and Triangle out-ranks Dreamy by
  DECLARATION** (`playground-port.js`) — a triangle card carries Dreamy's
  filename AND Dreamy's prefix by construction, so the two always match
  together and the only question is which wins.
  **QUOTING THE CLAUSE LONG WAS THE OLD ANSWER AND IT WENT STALE TWICE, THE
  SECOND TIME SILENTLY (2026-09-02, Sophie: "triangle cards are not being
  identified as triangle").** Longest-evidence-wins meant the port had to
  out-reach Dreamy's 49 characters, so every reword shortened the fragment
  below the bar and handed her cards back to Dreamy with nothing on screen
  saying so. **Measured over all 715 of her filed triangle cards: 565 were
  porting back as plain Dreamy pictures** — four generations of the wording
  are on file and only the newest one matched. Two changes, and the second is
  what ends the class of bug: the evidence is now the stem
  `triangle-shaped card` (the three words every generation has held) with the
  older wordings listed beside it, **only ever GROWING, exactly the way `refs`
  lists old reference FILENAMES — a reword never rewrites the thousands of
  style halves already filed**; and `beats:['dreamy']` names the derivation, so
  a short quote wins anyway. **A wrong route is invisible from inside the
  Playground** (the picture still draws, on the wrong reference), so it is
  measured against her real library rather than reasoned about.
  Test: `node scripts/test-playground-port.js` (the derivation driven
  over the real dreamy literal, the sheet swap, the reworded-tail fallback,
  the one-copy pin on triset.js, and — the durable half — TODAY's real
  triangle style half driven through the matcher plus one fixture per past
  wording, verbatim off her cards; verified failing 9 pre-fix).
  **TRIANGLE v2 IS HER OWN HAND-EDITED WORDING, BANKED AS A TILE (2026-09-03,
  Sophie: "i modified the triangle prompt in triangle … save it as a new option
  (triangle v2)").** The Prompt panel's edit lives ONLY in her phone's
  localStorage, per style key — so switching tiles never loses it (Dreamy shows
  Dreamy's text, Triangle shows her edit again), but no server and no other
  device can see it. It was recovered off her runs' stored `fullPrompt` (one
  wording across all 100 triangle runs, every one with the no-text toggle ON)
  and written VERBATIM as `PL_GPT_STYLES.triangle2` in server.js — NOT derived
  from dreamy/triangle, because a banked version must not move when the house
  wording does. The tail bakes `minimal text.` and the toggle swaps it, so with
  the toggle on the sent text is byte-for-byte her runs'. No sheet swap (her
  anti-grid sentence is in the PREFIX, which `applySheet` never touches), so
  Panels on v2 sends her prefix unchanged — the original Triangle tile is the
  one that swaps for a sheet. Port evidence is her own sentence
  (`playground-port.js`, `beats: ['dreamy','triangle']`); the port test's
  literal-block check reads a `PL_GPT_STYLES.<id> = {` block as well as the
  in-table shape. Banking the NEXT version she edits is the same three rows
  (server.js, `STYLES` in promptlab.html, `PORT_STYLES`) plus a fixture.
  **AND THE TILE PINS THE CANVAS TO SQUARE (2026-08-31, Sophie: "triangle mode
  shud auto switch to square in playground")** — a Triset card is square
  (`triset.js` draws every one at 1024x1024), and the canvas toggle is
  REMEMBERED, so arriving at the tile from a portrait picture drew the card on
  the wrong shape with nothing on screen saying why. `canvasPin` on the style's
  own row in `STYLES` (promptlab.html) — a table, so the next pinned style is
  one field. Three things not to undo: it is a **SWITCH, NOT A LOCK** (the
  toggle stays on screen, her next tap wins, and nothing re-pins it under her);
  it fires on **ARRIVAL, which includes opening the page on the tile** — a
  setStyle-only fix leaves a stored portrait drawing the session's first card
  wrong; and the load-time half is where the pin is applied for a **ported
  `?style=triangle`**, because that query is read hundreds of lines above the
  toggle, where `canvas` is still hoisted-undefined and `paintRes` would throw
  and take the ported prompt with it. Test:
  `node scripts/test-playground-canvas-pin.js` (the real page headless — the lit
  half MEASURED off the two backgrounds and the shape read off what the run
  really POSTs, since a `.on` class whose CSS never landed and a pin that never
  reaches the request both pass every markup assertion; verified failing 8
  pre-fix).
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
  failed cut keeps it, disclosed as "uncut sheet".
  **A RUN THAT STOPS DRAWING LANDS IN ITS OWN GALLERY — `landRun` (2026-08-28,
  Sophie on the PANELS tab: "the tile appears and then disappears. Is the date
  wrong?").** The dates were fine (measured: no run in the top 40 was
  future-dated, nothing carried a bump's `createdAtWas`). What happened is that
  the poll drops the "drawing…" placeholder the moment a run reaches `ready`
  and then asked `loadRuns()` for the real run — and **`loadRuns` only ever
  fetches `kind=single`** (2026-08-28, so a morning of panels runs cannot fill
  all 40 slots of the Picture tab's page), while the PANELS gallery comes from
  `loadPanelsSweep`, which was then asked **ONCE per page load and never
  again** (that latch is gone — see the next paragraph). So
  on that tab the placeholder came down and nothing replaced it: the tile
  vanished and **stayed vanished until the page itself was reloaded** — which
  inside the app is the whole app process. The poll is holding the finished
  doc, so nothing needs fetching: `landRun(d)` merges it, which is exact, costs
  no request, and lands the run in whichever gallery it belongs to. The single
  gallery still refreshes its page, because `loadRuns` owns `feedMore` and the
  newest-page walk that one merged doc says nothing about.
  **IT IS ALSO WHAT FINALLY LETS THE UNCUT SHEET SHOW** — `cuttingSheet` was
  built for her 2026-08-27 ask ("the uncut sheet shud show before it's cut as
  soon as it's done") and could never appear, because at `ready` the run
  reached the feed on neither tab. `gateCut` (one cut at a time) is what made
  that gap long enough to see. Test:
  `node scripts/test-playground-ready-tile.js` — the run walked through
  running → ready → done and COUNTED at every step, because a test that looks
  only once it is `done` passes against the pre-fix page: the bug is the gap
  (verified failing 8 pre-fix, including 45 of 45 blank samples across the cut).
  **AND THE PANELS SWEEP RE-ASKS NOW, WHICH IS WHAT A CONTAINER-DRAWN SHEET
  NEEDED (2026-08-29, Sophie about a sheet drawn in a chat's container: "is not
  in playground").** `landRun` above lands a run THIS PAGE STARTED — the poll
  is holding the doc. But the house path for a chat's panels is to draw in its
  own container and file the finished run with `POST
  /api/promptlab/panels-import` ("the playground is for me, but panels should
  go in panels"), and **no poll of hers is behind one of those**: it is `done`
  the moment it exists. With the sweep a one-shot, such a run sat on the
  server, inside the very answer that query returns, and was unreachable until
  the page itself reloaded — which inside the app is the whole app process,
  since a tool's web view is kept alive. **The run had landed correctly and
  read as lost**, which is the worst shape a filing bug can take. So the latch
  is a THROTTLE (`panelsSweptAt` / `PANELS_RESWEEP`, 20s) rather than a
  one-shot: entering the tab re-asks, and `visibilitychange`→visible asks
  **past** the throttle while she is on that tab — coming back to the tool is
  the moment a stale gallery is about to be read, and the throttle is only
  there for a tab tap she may repeat. Safe because `mergeRuns` is keyed by id,
  so a re-sweep can only ADD; her votes and her place are untouched, and the
  first paint is still instant off what the feed already holds. Test:
  `node scripts/test-playground-imported-run.js` — and **it must never
  reload**, because a reload sweeps the run in on the pre-fix page too and the
  test would pass against the bug (verified failing 3 pre-fix).
  **A DEPLOY RESTART CANNOT
  LOSE A BANKED SHEET (2026-08-27, measured: three merges deployed in a row
  and orphaned four paid 4K sheets mid-run)** — the stuck-run sweep finishes
  an orphaned panels run from its banked sheet (free) instead of marking paid
  work failed, and `POST /api/promptlab/:id/recut` does the same on demand
  for a failed-with-sheet or cutFailed run (recovery-only: an already-cut run
  is refused, a second cut would file duplicates).
  **AND A RESTART DURING GENERATION REDRAWS ITSELF NOW (2026-08-29, Sophie —
  her creepy-guy sheet died at 14 minutes to a deploy: "this can't happen
  again").** A panels run killed before its sheet was banked used to be
  marked failed with the money already spent; the sweep REDRAWS it instead —
  the run doc stores everything the draw needs (`promptlab-sweep.js`, the
  pure decision). One more sheet's cost, capped at 2 redraws (deploys land in
  bursts), `redrawnAt` restarts the staleness clock so the next tick cannot
  kill the draw the last one started, and her feed position is kept. A
  SINGLE run is redrawn the same way since 2026-09-02 (`singleCfgOf` —
  the OOM kill under her first bracket batch; a photo ref that will not
  re-fetch fails it honestly). Test: `node scripts/test-promptlab-sweep.js`. **AND DRAWING AND CUTTING ARE PACED
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
  **AND THE ROW CARRIES A CLEAR (2026-08-29, Sophie: "add a clear button at
  the top of panels")** — an underlined word at the end of the fold row, the
  house inline opener's paint, emptying the grid she is ON (or the story box)
  and no other grid's draft. Four things not to undo: it is a **SIBLING** of
  the fold, since that row is a `<button>` and a nested button is invalid and
  would fold the boxes away on the tap; it is **drawn only while something is
  written**, so it is never a control that does nothing; it asks first **only
  over UNSEEN work** — a draft that was DRAWN clears silently, because that
  sheet is in her feed with its prompt one tap from copying back, which is the
  carry's own question for the carry's own reason; and clearing **OPENS the
  fold**, since she is about to write in the boxes again. Test: `node
  scripts/test-playground-panel-clear.js`.
  **HER WORDS COME WITH HER WHEN SHE CHANGES GRID (2026-08-29, Sophie: "if
  there's text in one of the grids if I transferred to that grid, my words
  don't transfer. They should transfer, but if the text that was saved as a
  draft has never been drawn trigger a pop-up").** Each grid kept its own
  separate draft (`promptlab_panels_<g>`), so switching 4 → 9 showed her nine
  empty boxes and the words she had just typed were reachable only by tapping
  back. A switch now CARRIES what is in the boxes into the grid she is
  arriving at, first cell to first cell. Five things not to undo:
  - **The grid she LEAVES keeps its own copy**, untouched — so a carry can
    only ever overwrite the grid she is ARRIVING at, which is what makes one
    question enough, and what makes 9 → 2 safe (the seven that do not fit are
    still in the nine, and the pop-up's fine print says how many).
  - **The pop-up asks only over UNSEEN WORK.** Silent when the target is
    empty, when it already says the same thing, or when what it says has been
    **drawn** — that sheet is in her feed and its prompt copies back with one
    tap, so replacing the draft costs nothing.
  - **"Drawn" is the EXACT array that was sent** (`promptlab_panels_drawn_<g>`,
    stamped by a panels run and by a run's copy-back button), so editing one
    box after a draw makes that grid undrawn again — the words sitting there
    are not the words that were drawn. A draft from before this shipped
    matches no stamp and asks once, which is the safe direction.
  - **"Keep what's there" still takes her to the grid she tapped.** She asked
    to go there; the only question was whose words it holds.
  - **STORY IS OUT OF IT, BOTH DIRECTIONS** — a story is one prose block and
    the panels are a line per cell, so "transfer" there would mean rewriting
    her words rather than moving them.
  The cancel dialog became **the one confirm box** (`askOpen`, words and both
  answers per opening) rather than a second copy of itself. Test: `node
  scripts/test-playground-panel-carry.js` (the real page — a source assertion
  cannot tell a carry from a grid that happened to hold the same words, nor
  see a pop-up that never opened; verified failing 8 pre-fix).
  `test-playground-panels.js`'s old "9 → 4 → 9 loses nothing" assertion was
  the OLD separate-drafts contract and is superseded, not broken.
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
  **AND A DESCRIPTION OPENS IN A BIGGER BOX (2026-08-29, Sophie: "expand
  character description button add").** A description is a sentence of hers —
  "long beard, glasses, all black, with a cape and a belt, sickeningly sweet
  smile" — and the compact row showed about a third of it, so the field she
  writes the most in was the one on the page with no way to see what was in
  it. The corner toggle is `#prompt.big`'s answer in SHAPE, not a copy of its
  code: one field, two sizes, never a second box to keep in sync, and the two
  measuring lessons (`height:auto` before measuring or the box can only grow;
  add the border back on a `border-box` box) are lifted with it. Four things
  not to undo:
  - **Expanding drops the description onto its OWN LINE at full width** — the
    row wraps and `order` keeps the name, the toggle and the ✕ on the line
    above. On a 390pt phone a taller box three columns wide is still a column
    (measured: 153px of a 318px row), so the WIDTH is half of what expanding
    has to buy here; the prompt box is already full width and never needed it.
  - **The field is a `<textarea>` and is still ONE LINE by contract.**
    `castBlock` writes a character per line and `castParse` reads them back
    that way, so a newline inside a description would cut a clause in half on
    the road home from Meta Assets. Enter is refused and a pasted newline
    collapses to a space — exactly what the `<input>` it replaced already did,
    so nothing about what she can put in the field changed.
  - **`min-height: 0` on the compact box**, or the page-wide
    `textarea { min-height: 64px }` makes the row two lines tall and
    "expand" starts from nowhere. Both `.big` bounds are CSS (18vh floor,
    44vh cap) so the browser clamps the fitted height and no `vh` is
    re-derived in script.
  - **NOT sticky, and it stores nothing** — the compact row is the sheet's
    shape and a big box is a moment, the same call `#prompt.big` makes; the
    size is not one of her words. The FLOOR is what keeps the button worth
    tapping on an EMPTY row: this is a field she WRITES in, so it never hides
    itself the way the `.moretxt` opener does.
  Test: `node scripts/test-playground-expand-cast.js` (every assertion a
  MEASUREMENT — a `.big` class and a real bigger box look identical to any
  markup assertion; verified failing pre-fix).
  Both land in the HEAD, which is what a panel's filed style half is cut from,
  so provenance needed no other change; both are stored on the run and are
  absent when unused. **`sheet-grid.js` IS SERVED TO THE PAGE NOW** (the
  `pause-plan.js` pattern, so the harnesses pick it up automatically), which
  is what lets the Prompt panel print the REAL clause instead of keeping a
  second copy of the wording. Tests: `node scripts/test-sheet-grid.js` (the
  clause, pure) and `node scripts/test-playground-panels.js` (the wiring, and
  that the Sophie card is still off). **HER PHOTO RIDES A SHEET SINCE
  2026-09-06 (Sophie: "i can add a photo reference in playground but not in
  panels")** — same seat as a single run, after the style refs and before her
  cast, on a grid sheet and a story sheet; the button stays on the Panels tab
  and the Prompt panel prints the line there. The Sophie card is the only
  attachment still off on a sheet. Full note: *HER PHOTO RIDES A SHEET* in
  `docs/modules/pictures.md`; test `node scripts/test-playground-panels-photo.js`.
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
  - **THE "ALSO ADDED BEFORE YOUR WORDS" BLOCK IS A THIRD BOX SINCE 2026-09-06
    (Sophie, circling it: "why is there no way to edit this??").** It was
    printed read-only because every line in it is DERIVED and tied to an
    attachment — the Sophie card's line, the photo line, the picked cards'
    sentence, her typed cast's clause, the story line. It edits like the two
    halves now, with one rule that keeps a derived block safe to edit:
    **her edit is stored beside the text it replaced (`extraOf`) and a run
    sends `extra` only while the derived block is byte-for-byte that text.**
    Change the cast or the photos and the box shows the house lines again
    and the run sends none — an edit written for one cast never rides the
    next run silently; the same cast again brings her edit back. Server:
    a STRING `extra` stands in for the whole block on all three assemblies
    (single, grid, story); absent keeps every line as it was, so an ordinary
    run is byte-for-byte what it always was. `extraBlock()` is the one
    derivation (the panel's box and `extraSent()` both read it). The GRID
    sentence stays read-only under its own label — it WRAPS the panel lines
    server-side and is not a block an edit can stand in for. Test:
    `node scripts/test-playground-prompt-extra.js`.
  - **EITHER HALF OPENS BIGGER (2026-08-31, Sophie: "add extend textbox button
    to both halves of style prompt playground").** These two boxes hold the
    longest text on the page — Dreamy's tail is a paragraph — and the compact
    box showed about two lines of it, so the half she reads most was the one
    with no way to see what was in it. `#prompt.big`'s corner toggle lifted in
    SHAPE, never a second field: one textarea, two sizes, both bounds in CSS
    (24vh floor / 46vh cap), `fitBig` measuring the content between them. The
    two rules that make the measurement honest — `height:auto` before measuring
    or the box can only grow, and adding the border back on a `border-box` box
    — are written out once, under *THE PROMPT BOX HAS A BIGGER-BOX TOGGLE* in
    this section. Five things not to undo:
    - **The compact box is 92px, not the 66 it was** — it has to reserve the
      button's corner with `padding-bottom` or her last line is typed under it,
      and 92 is what keeps the same two lines of text visible above that band.
    - **56px in from the right, not the exact corner** — the injected pill owns
      that fixed column on this page, and a z-lift steals the pill's own ▼
      instead (the settled answer `#bigprompt` already reached on this card).
    - **A REPAINT OF THE PANEL SHE IS STANDING ON DOES NOT SHUT THE BOX.** The
      panel is rebuilt whole whenever anything it prints changes — attaching a
      photo, tapping the Sophie card, typing in the cast sheet — and springing
      an expanded box back to compact under her is the Story Room caption's own
      complaint. `panelBig` is in memory only and is **not sticky**: nothing is
      stored, and closing the panel or changing style puts both halves back
      small, because a different style is a different wrapper.
    - **The fit is re-run after the box is in the document** — `scrollHeight`
      on a detached node is 0, so a restored `.big` would open at the CSS floor
      and only find its real height on her next keystroke.
    - **The LoRA's trigger carries no button.** It is shown read-only (editing
      it stops the LoRA being selected at all), and the control belongs to the
      EDIT box — the Story Room's own rule.
    Test: `node scripts/test-playground-expand-style-prompt.js` (the real page
    headless; every assertion a MEASUREMENT, since a `.big` class whose CSS
    never landed, a button under the pill, and a restored box fitted while
    detached all pass every markup assertion ever written about them —
    verified failing pre-fix, where neither half has a button at all).
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
  - **SEVERAL PHOTOS SINCE 2026-09-04 (Sophie: "add a second reference photo
    to the playground … make a way to add a second or third etc photo").** A
    dashed plus after the first photo adds another (up to six, `PL_PHOTO_MAX`);
    each rides as its own thumb with its own x, in the order she added them,
    which is the order they attach — behind the style refs and the Sophie
    card, before her cast. The POST carries `photos` (the list) beside `photo`
    (the first, for an older cached page); the doc carries `photoRefs` beside
    `photoRef`; a copy-back puts every photo back. **Two or more swap the
    photo line for its PLURAL twin with the count written in** (`The LAST two
    attached images are photo references…`, `PL_GPT.photoLineMany` /
    `photoLineManyWithChars`, and the plain tile's own pair) — one photo still
    sends the singular line byte for byte. The page's `photoRef` is a read-only
    getter over `photoRefs[0]` for the tests and any older reader. Test:
    `node scripts/test-playground-photo-refs.js`.
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
  **AND A GENERATE TAP CONFIRMS ITSELF WHERE SHE IS STANDING — IT NEVER MOVES
  THE PAGE, `confirmStarted` (2026-08-29, Sophie: "it scrolls me down in the
  playground").** This shipped 2026-08-28 as `scrollToPending`, a walk down to
  the new run's placeholder, for a real report of hers ("why didn't it draw" —
  it had, twice: on the PANELS tab the boxes plus the character sheet fill the
  app's web view, so the card saying "drawing…" was off the bottom edge and the
  tap changed nothing where she was standing). **She overruled the ANSWER, not
  the reading**: the window moving under her on EVERY generation is worse than
  the card being out of sight — she is looking at the box she just typed in,
  often about to type the next one. So the tap raises the toast ("Drawing…")
  and the scroll position is left exactly where she put it. **A scroll on
  Generate is HISTORY, not a rule — do not bring one back**, conditional or
  otherwise, and that includes the reasoning above about the card being off
  screen. All three starters call it (`startRun` · `startPanelsRun` ·
  `startStoryRun` — the shape of the miss is a fourth one shipping silent, so
  the test sweeps them by name; it reads each function to the NEXT top-level
  one rather than a fixed window, which `startRun` has outgrown twice, passing
  the sweep vacuously both times).
  **IT IS ONLY EVER A MEASUREMENT** — "did it start a run?" is true either way,
  so the honest question is where the window ends up a moment after her tap,
  and whether the toast is really PAINTED (a hidden element carrying the right
  words says nothing to her). The test stands her at 390x700 — the app's web
  view with its own bottom bar taken off — because that is her screenshot's
  viewport and the one the old walk moved the furthest. Test:
  `node scripts/test-playground-generate-scroll.js` (verified failing 5 against
  the pre-fix page, which walked her 670px down the Panels tab).
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
  - **THE LIGHTBOX SAYS WHO IS IN THE PICTURE, AND PUTTING THE PROMPT BACK PUTS
    THE CAST BACK (2026-08-29, Sophie: "light box view / characters in
    playground").** The run doc has carried `characters:[{id,name,url}]` since
    the picker shipped and **nothing ever read it back**, so both halves were
    invisible: a picture drawn with a cast looked like one drawn with nobody
    (except as a sentence buried in the style half behind the Prompt door), and
    copying its prompt back re-ran it with the cast missing.
    - **`cast:[{name,url}]` is a new hook on `asset-lightbox.js`** — a small
      face and its NAME under the caption — never a Playground-only control
      (the never-a-fourth-copy rule). The **name** is the load-bearing half:
      it is what she writes in a prompt to draw that character again. They are
      MARKS, not buttons, so the row stays dead space that closes the box. A
      caller passing none draws nothing, so no other surface moved. Faces go
      through the derived-thumb service — a card is a ~1.26MB render.
    - **`restoreChars` is `restorePhoto`'s twin**, on the same *only change
      what the record knows* rule, wired into every copy path: characters on
      the record pick exactly those, **a record with NONE puts down whoever is
      picked** (leaving them on would add a paid reference the run she copied
      never had), and no record at all leaves it alone. The **ids are what the
      run POSTs**, so restoring them is enough on its own; the library is
      fetched behind it only so the picker and the Prompt panel can NAME them.
    - **Not persisted across loads** — that rule is hers and is untouched: a
      cast picked last week silently riding today's run is the hidden
      ingredient the Prompt panel exists to prevent.
    - Test: `node scripts/test-playground-cast-lightbox.js` (the real page
      headless — the row's names, its faces really decoding, the tap that must
      still close, and the restore read off the button's count and the
      picker's lit cards; verified failing 7 pre-fix).
  - **THE LIBRARY IS RE-READ ON EVERY OPEN (2026-09-06, Sophie, after saving
    her own picture in Characters: "i uploaded but don't see my pic in
    character … in panels").** It was fetched ONCE per page life, and the app
    keeps the Playground alive for the whole app process — so a character
    saved five minutes ago could not reach the picker until a force-quit,
    while the server listed it first the whole time. `loadChars` is a
    THROTTLE now (`charsAt` / `CHAR_RESWEEP`, 20s — the panels sweep's own
    shape): the old list paints instantly, the fresh one repaints when it
    lands, and a visibility flip with the sheet open asks past the throttle.
    Test: `node scripts/test-playground-chars-refresh.js` (the stub's library
    GROWS between two opens; verified failing 9 pre-fix).
  - **The sheet opens into the pill's corner**, so both card rows reserve a
    MEASURED `--charpill` column (`fitCharPill`): pre-fix the pill's own
    `Fast` label sat on the fifth recent card, and her 47px safe-area inset
    pushes the pill down onto that card's middle.
  - **THE SHEET SAYS WHAT IT ADDS TO HER PROMPT (2026-08-29, Sophie: "when I
    click characters, it doesn't show how it looks in the Full prompt on
    playground").** The Prompt panel had printed both lines since the picker
    shipped — the picked faces' `charLine()` and her typed cast's
    `castBlock()` — and **the panel is not where she is standing**: it is
    CLOSED by default and it lives BELOW the sheet, which is a library.
    Measured with a 25-face cast at 390x844, with the sheet open and the panel
    opened by hand, the panel began **703px down an 844px viewport**; her real
    library is 143. So the sheet discloses its own lines at its foot, from the
    SAME served rules (`window.__padCharacters.charLine` /
    `window.__sheetGrid.castBlock`) — the page still holds no copy of either
    wording, and the panel and the sheet cannot disagree about the prompt.
    Four things not to undo: **nothing riding draws nothing at all** (an empty
    cast adds no clause — her rule — so there is nothing to disclose and no
    empty box); it is at the **FOOT** of the sheet because appearing there
    moves no card row, where a block above the cards would shift a face out
    from under her thumb between two picks; the **note under the cards stopped
    naming who rides** the day the real sentence started naming them; and
    `.says` gives the library grid's slack back (26vh) while it shows, because
    the first cut passed at 844 and left **21px of itself showing at 390x700**
    — the app's own web view, and the identical failure one box higher.
    Test: `node scripts/test-playground-char-says.js` (both heights, every
    assertion a MEASUREMENT — a block that renders below the fold passes every
    markup assertion ever written about it).
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
  **AND THAT DOOR LEAVES A WAY BACK — IT USED TO EAT THE TOOL IT WAS TAPPED IN
  (2026-09-02, Sophie: "playground from assets · now i'm stuck").** "Open in
  Playground" is a `location.href` inside the tool's OWN web view, and the app
  keeps a tool's page alive for the whole app process — so the walk parked Meta
  Assets (or Freeform, or the CHATS app when the tap came from a Compare page,
  whose lightbox navigates the top window) on `/playground`, and every later tap
  on that tile opened the Playground again until a force-quit. The Story Room's
  send trip learned this on 2026-08-26; this is the identical bug at the door
  she uses most.
  - **The walk names the page it is leaving** (`backCrumb` in
    `asset-actions.js` → `&back=<path>`), same-origin path only, and it is read
    off the window that really navigates, so a framed Compare page hands back
    `/chats` rather than its own url.
  - **TWO HALVES, AND THE CHIP IS ONLY THE FIRST.** The chip walks her back;
    `armTripRestore` (lifted from `scratchpad.html`, wrapping `__forgeLeave`) is
    what puts the eaten web view back when she leaves the tool the ordinary way
    — the only thing that helps a kept-alive page she returns to later. **The
    Story Room's own room→Playground walk arms it now too**, which it never did.
  - **The chip is SEATED IN THE HEADER ROW beside the app's chevron**, never
    left floating at top-left where pagehead.js draws that chevron — measured,
    it was landing on it. An old native build hides the row and keeps the fixed
    corner rather than dropping the only way back.
  - **The query is spent on arrival** (`replaceState`), deferred one tick
    because the blocks below it read the ported prompt off `location.search`.
  - **STILL OPEN, deliberately: the "Open the chat" door does the same thing** —
    it walks Meta Assets or Freeform to `/chats` with no crumb read at the other
    end. `backCrumb` is exported and ready; chats.html has to seat a chip and
    arm the restore.
  - Test: `node scripts/test-playground-back-trip.js` (the crumb pure, then the
    real page headless with the REAL injected chevron — the chip asked with
    `elementFromPoint`, and the restore measured as where the window really ends
    up after an app exit; verified failing 14 pre-fix).

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
  **ADD TO SHOEBOX — THE THIRD DOOR ONTO THE ONE MEMORY (2026-08-29, Sophie:
  "how do i send a picture to shoebox in the playground").** She could not:
  the Story Room's beat popup and Meta Assets both grew one on 2026-08-28 and
  the tool she actually DRAWS in had none, so keeping a Playground picture
  meant hearting it, walking to Meta Assets and finding it again. It is
  `POST /api/scratchpad/shoebox-url` — the same route, the same
  content-addressed id (`sb-<sha1>` off the picture) — so adding one picture
  from two doors updates ONE memory rather than making twins, and a re-add
  keeps the original's `createdAt` (the field the library's one query orders
  by). Three things not to undo:
  - **THE TITLE IS HER OWN WORDS** — the picture's content half
    (`runPromptHalves`), which on a panels run is THAT panel's line, never the
    style wrapper and never the MODEL · QUALITY caption. It becomes the
    polaroid's title, so it has to be what the picture is OF.
  - **THE LIT BUTTON IS THE RECEIPT.** This door WALKS NOWHERE, unlike the two
    others in that row, so without a mark a tap that landed and a tap that did
    nothing render identically.
  - **THE SHARE GLYPH BELONGS TO THE SHOEBOX, so the Story Room walk gave it
    up.** The two sibling doors both wear the square-and-arrow-up, and it was
    the WALK's mark here — two buttons in one row drawn identically is
    invisible to every label assertion. The walk wears `ICONS.books` now, the
    web mirror of the Story Room tile's own `books.vertical` (a button that
    opens another tool wears THAT tool's icon).
  Test: `node scripts/test-playground-shoebox.js` (the real page headless —
  what the request CARRIES, the receipt, the panel's own line, and the two
  doors' glyphs compared; verified failing 11 pre-fix).
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
  **A MARK ON A SHEET IS A MARK ON ITS PANELS (2026-09-06, Sophie: "when i x a
  uncut panels sheet it shud x every panel in it unless i hearted it or heart
  it after or unex", then — looking at a hearted sheet whose panels had not
  moved — "it shud work both ways - heart or x").** A panels run is ONE paid
  picture cut into pieces, so a sheet she marks in the Sheets view is a sheet
  whose pieces she has marked — until this she had to mark the sheet and then
  mark every panel again in the panel view, or live with a run saying two
  different things about itself on two screens. `sheet-cascade.js` is the ONE
  rule (pure, served to the page); the vote routes turn it into a patch through
  `votePatchFor`. **THREE CASES PER PANEL, and that is the whole of it:** the
  cascade's own mark follows the sheet wherever it goes, a mark of HERS is
  never touched, and a panel with no mark takes the sheet's. Four things not to
  undo:
  - **A CASCADED MARK IS TAGGED — `voteFrom.<i> = 'sheet'` beside the vote it
    explains — and that is what makes "unex" possible at all.** Without it the
    release could only be all-or-nothing and would wipe the mark she cast on a
    panel herself. It is also what lets ✕ → ♥ on the sheet flip those panels
    with it, which is her "both ways".
  - **A DIRECT MARK ON A PANEL MAKES IT HERS** — any vote at `i >= 0` DROPS
    that tag, which is her "or heart it after": once she has decided a panel,
    the sheet has no claim on it. A panel already marked when the sheet is
    marked is left as it is and never tagged, for the same reason.
  - **THE PAGE APPLIES THE SAME PLAN OPTIMISTICALLY, and it has to.** A vote
    is followed by `loadRuns()`, which asks `kind=single` — a panels run's real
    votes never come back from that read; they wait on the panels sweep and its
    20s throttle. Without `markLocal` she marks a sheet, steps to the panel
    view and finds the panels unmarked, which reads as the rule not working.
  - **IT SHIPPED ✕-ONLY FOR AN HOUR AND SHE CAUGHT IT IN ONE LOOK.** The first
    cut read "unless i hearted it" as *a ♥ is only ever hers*, so hearting a
    sheet released the ✕ and did nothing else — and this file recorded that as
    a rule ("hearting everything under a sheet is a rule she never asked for").
    That reasoning is HISTORY: a mark is a mark, both directions, and the
    asymmetry is the thing not to bring back.
  It also reaches the two doors that are not the Sheets view: a sheet marked
  while it is still CUTTING marks the panels the cut lands seconds later
  (`planForCut`, applied at the end of `finishPanelsCut`), and a mark cast on
  the sheet in Meta Assets comes back through `syncVoteToPlayground`, which now
  finds a run by `sheetUrl` as well as by `images` (the sheet is not in
  `images`, so that door used to reach nothing at all). A cut-FAILED run IS its
  sheet and has no panels, so it cascades to nothing by construction. Tests:
  `node scripts/test-sheet-cascade.js` (the rule and the source pins, pure) and
  `node scripts/test-playground-sheet-x.js` (the real page headless — every
  assertion a MEASUREMENT of the rendered badge or a reading of what the server
  really received, since a cascade that plans correctly and never reaches the
  page, one that never reaches the doc, and one that wipes her ♥ all look
  identical in markup; verified failing 2 pre-fix).
  **A ♥ ON A PANEL USED TO COME OFF ON THE NEXT TAP — THE SCAN CACHE NEVER
  HEARD ABOUT THE VOTE (2026-09-06, Sophie: "when i heart individual panels the
  heart gets removed 😡").** The Panels tab reads its whole gallery through
  `promptlabScan()`, the same 60s cache a search takes, and a vote wrote the run
  DOC and never the cache — so the sweep the NEXT tap arms (pointerdown,
  throttled 20s) handed back the run as it stood before her heart, `mergeRuns`
  let the fresh copy win, and the mark she had just cast was gone. The page's
  optimistic mark was right the whole time; the server was handing back the
  past. Two halves, and both stand: **every run-vote write applies its own patch
  to the cached copy** (`plScanApply` → `pl-scan-patch.js`, pure; the single
  route, the batch route, the Assets→Playground sync and the cut landing — a
  source pin counts four), and **the page shields a mark cast in the last 90s
  from a stale read** (`recentMarks`/`shieldRun` in `mergeRuns`), for the sweep
  already in flight when she tapped and for any cache a vote cannot reach.
  After the shield the server's word stands, as it always did. Test:
  `node scripts/test-playground-panel-heart.js` (the stub's kind=panels answer
  is DELIBERATELY the pre-heart copy; verified failing 2 pre-fix).
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
  **IT OPENED ON BY DEFAULT FROM 2026-09-14 (Sophie: "default to hide x") ON
  ALL FIVE SURFACES — AND SHE TOOK THE PLAYGROUND BACK OFF A DAY LATER
  (2026-09-15: "filter changed · change back · playground" · "filter used to
  be different").** So the default is now **OFF on the Playground and ON on
  the other four** (Footage, Freeform, Voice Studio, Stitch), and that split
  is deliberate rather than drift. **Do not "fix" the Playground back to ON.**
  - **WHY THIS PAGE IS THE EXCEPTION, in her terms:** the Playground's feed IS
    her history. A ✕ here means *not that one* about a picture she drew, not
    *file it away* — so a default-on filter opened her own history with runs
    missing from it, which is what she was looking at when she said the filter
    used to be different. On the other four the ✕ is closer to housekeeping.
  - **THE SPLIT IS PINNED, NOT ASSUMED.** `scripts/test-hide-x-default.js`
    carries the default as a COLUMN per page and asserts the count — exactly
    one off, four on — because one page differing on purpose reads identically
    to one page drifting, and only a table that names which is which can tell
    them apart. Everything else about the pattern is unchanged, and the ♥ is
    untouched: hearts-only still opens OFF everywhere.
  Four things not to undo on the four that stayed ON:
  - **ABSENT IS THE DEFAULT, AND HER TAP IS NOT.** Each reader asks ABSENT
    FIRST — `null` takes the default, `'1'` is on, `''` is off — and the write
    still stores `'1'`/`''` exactly as before, so a phone that had already
    turned it on, or deliberately off, keeps what she chose and only an
    untouched one changes. The bell's own default-on shape (OFF is the thing
    that gets stored), spelled with the value's own presence.
  - **THE CHIP IS LIT ON A FRESH PAGE**, which is the whole of what keeps a
    default-on filter from being the silent filter this app keeps getting
    burned by — and it is why this is safe where the Assets tab and Meta
    Assets are not.
  - **THE ASSETS TAB AND META ASSETS ARE DELIBERATELY NOT THIS.** Their
    New · ♥ · Hide ✕ mark filter stores nothing on purpose ("those are places
    she arrives to look at everything, and a filter left on from last week
    silently hiding most of her library is what the chip's state-wearing
    exists to stop"), so it still opens showing everything.
  - **HEARTS-ONLY IS UNTOUCHED** and still opens OFF — it KEEPS only what it
    names, where this one only ever DROPS a ✕.
  Test: `node scripts/test-hide-x-default.js` — every check RUNS the real
  reader lifted out of the real page against a fake store, since a reader that
  reads perfectly and answers the old default looks identical in the source
  (verified failing 5 pre-fix). A test that needs to see a crossed-out picture
  stores her own explicit `''` and says why.
  **PICK SEVERAL AT ONCE — THE SELECT CHIP (2026-09-02, Sophie: "add a select
  button to playground so i can x a bunch of things at once").** A fourth chip
  in the filter box; lit, a tap on a picture PICKS it instead of opening it,
  and a mode bar under the row marks everything picked at once — All/None, the
  count, ✕, ♥, Done. Crossing a batch out one at a time is a tap into the
  lightbox, a tap on the ✕ and a tap back out, times twenty, and on the PANELS
  tab — a sheet arriving as nine panels she keeps two of — that is the ordinary
  case rather than the rare one. Five things not to undo:
  - **THE MARK BUTTONS OBEY THE SINGLE-PICTURE RULE — tap again to clear.**
    If every picked picture already wears that mark the button CLEARS it, which
    is what makes a bulk ✕ **undoable with one tap** — and it is why the picks
    are KEPT after a mark rather than dropped. (With "hide the ✕'d" lit the
    pictures go with the mark; the count still says how many are held.)
  - **ALL READS THE VIEW SHE IS LOOKING AT** — the pictures rendered right now,
    in either view — so the ♥/✕ filters, the sheets chip and the search box
    narrow it by themselves and there is no second copy of their rules to
    drift. The Playground's own tap-to-next rule, one screen over.
  - **THE MODE IS IN MEMORY, NEVER localStorage.** The view, the filters and
    the columns are settings; this is something she is in the middle of doing,
    and coming back to the tool tomorrow already picking is nobody's idea of
    where she left off. Same call the bigger-prompt-box toggle makes.
  - **ONE REQUEST — `POST /api/promptlab/votes`**, grouped by run (one write
    per run) with the Assets-tab sync five at a time. Twenty separate `/vote`
    posts would each re-read the run doc and sweep the Assets tab for one
    picture. Registered ABOVE the per-run routes so `votes` can never be read
    as a run id.
  - **IT SHARES THE FILTER BOX, AND THAT IS WHAT PAYS FOR IT.** MEASURED at
    390pt: the PANELS tab (four chips) had **78px** of room in the search field
    against the **51** its placeholder needs, and a chip in a box of its own
    costs 42 of that — the exact "Searc" clipping the two mark filters were put
    in one box to end. Sharing the border costs 34 and the view switch's 11px →
    8px paid back 12, leaving 56 on panels and 90 on the picture tab. **A fifth
    chip needs a layout answer first, not another push.** (At 320pt this row has
    been over budget since the columns segment landed — the field measured
    EIGHT pixels — so `.feedbar` now wraps and the search drops to its own line
    whole rather than collapsing. That is a fallback for a width nothing here is
    designed at, not the second row she cut: at 390 the box has not moved.)
  Test: `node scripts/test-playground-select.js` (the real page headless —
  every assertion a MEASUREMENT or a reading of what the server really
  received, since a `.picked` class whose CSS never landed, a tap that picked
  AND opened the lightbox, and a batch carrying the wrong indices all look fine
  in markup; verified failing against the pre-fix page).
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
  **AND THE SEARCH DECIDES MEMBERSHIP AND ORDER, NEVER WHAT A RUN SAYS
  (2026-09-03, Sophie: "hearts…", with two screenshots a second apart — the
  tile wall showing hearts on two patchwork triangles, and the lightbox on one
  of those same pictures showing no heart at all).** `hits` is the ARRAY OF
  OBJECTS the search answered with, and it was the one store on the page
  nothing ever refreshed: `castLB` mutates `runsById[id]`, and `mergeRuns` —
  which every vote reaches through `loadRuns` — REPLACES `runsById[id]` with a
  fresh doc, so the identity the two shared at search time broke on the first
  refresh. From then on, **for as long as her query stood, the wall painted the
  votes the search had frozen**: a ♥ she cast never appeared and one she
  CLEARED never came off. Measured against her real data that afternoon — four
  taps in ninety seconds, two likes and two clears, and the wall showed the
  opposite of all four while the lightbox was right, which is exactly the pair
  of screenshots. `visibleRuns()` resolves every hit through `runsById` now:
  ONE live doc per run. **Nothing was lost** — the server had her real answer
  the whole time; only the badges lied. Test:
  `node scripts/test-playground-search-vote.js` (verified failing 2 pre-fix;
  every assertion a MEASUREMENT of the rendered badge against what the stub
  server really received, because the wall and the lightbox read the same
  expression off two different objects and the source cannot tell them apart).
  **AND `.filttog` HID THE SELECT CHIP ON THE PICTURE TAB, silently
  (2026-09-03, found by the same sweep).** `paintFiltRow` hid the whole
  segmented box with `!onPanels()` — right when the sheets chip was the only
  thing in it, and wrong the moment #2058 moved the ♥/✕ pair into the filters
  drawer and left `#v-select` alone in there: **"pick several at once" (#2030,
  her own ask) had no door at all on the tab she draws in.** The box is hidden
  only when every child is, derived from the children, so the next chip added
  there needs nothing. `node scripts/test-playground-select.js` had been RED on
  main since #2058 for the same reason (it still tapped `#v-liked`/`#v-hidex`,
  which that PR replaced) — a test left behind by a move is how a regression
  gets to sit on main unnoticed.
  **{CURLY BRACKETS} ARE MIDJOURNEY'S PERMUTATION PROMPTS (Aug 2026, Sophie:
  "u know in midjourney using curly brackets to do multiple prompts" →
  "yes :)").** `a {red, blue} bird` is two prompts, separate groups multiply,
  groups nest, `\{` `\}` `\,` are literal, and an unmatched brace is literal
  (a typo must not eat the prompt). ONE copy of the rule — `public/permute.js`
  — and EVERY starter (Generate, ×3, both ladders) expands through it, so the
  braces mean one thing everywhere; each run's doc carries ITS expanded
  prompt, never the braces. A count line under the controls shows while the
  prompt really expands ("{…} 4 prompts — Generate draws all 4"), priced from
  the SERVED cents — the tier table on a gpt style, `PL_LORA` on the LoRA
  (see WHAT A WTR PICTURE COSTS below).
  **The cap is 12 TOTAL RUNS PER TAP, checked as prompts × tiers** — a ladder
  on a big set is refused with the reason on screen and ZERO runs started,
  because 12 keeps the 512MB box under the measured 16-concurrent-output
  ceiling that has restarted it. The LoRA dedupe runs per expanded prompt.
  **Freeform deliberately does NOT expand** — it is the verbatim, no-opinion
  surface, and braces there go to the model as typed. Test:
  `node scripts/test-playground-permute.js`.
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

### Shoebox

- **Shoebox** (`shoebox.js`, `/api/shoebox`, page at `/shoebox`, iOS tile
  under the PICTURES filter) — the WHOLE Shoebox inside Deck Factory
  (2026-08-29, Sophie: "can u add the shoebox as a module on deck factory",
  then on the first cut that shipped only a picture shelf: "you forgot the
  library and the boards and the strings in the play button and everything
  else"). A faithful vanilla port of memory-library-react's
  `src/components/shoebox/` — read that source before reworking this page;
  the two should stay siblings. **It costs nothing** — no model call
  anywhere.
  - **TWO SURFACES OVER THE SAME MEMORIES, exactly like the real Shoebox at
    incaseofamnesia.com/shoebox.** The LIBRARY: every memory as a true
    600-film polaroid (square picture, deep chin in the Caveat handwriting,
    stable tilt per memory; a pictureless memory shows its words on
    undeveloped film), Developed/All filter + the house search. The BOARD: a
    corkboard camera (pan / pinch / ± / Fit), draggable pins, red-string
    constellations tied by taps (**String** mode — tap cards one after
    another; tapping two chains' members merges them), **Order** numbering
    the play sequence, and **▶ Play** — the camera glides pin to pin, and on
    the star paper the closing wide shot ignites every constellation into
    real four-point stars while the polaroids fade into the night.
  - **THE BOARD DOC IS THE REAL SHOEBOX'S OWN — same doc, same shape.**
    `GET/POST /api/shoebox/board-state` reads and writes membry
    `users/{uid}/preferences/shoebox` (boards, current, per-board `bg`
    paper, top-level pins/strings MIRRORED for older cached pages of the
    app), normalized server-side by `normBoard`/`fromRaw` — ported from
    `useShoeboxState.js`, every shape the doc has ever had, an unknown paper
    id surviving a round trip. So a board arranged here IS the board there
    (verified live 2026-08-29: her 12 real boards — Memories 27 pins /
    6 strings, the two star-paper boards — read back exactly). The page
    debounces whole-state saves 700ms, flushes on pagehide, and **never
    saves before a load succeeded** (the hook's own clobber guard).
  - **MEMORIES STAY READ-ONLY, WITH ONE CARVE-OUT SHE ASKED FOR (2026-08-29:
    "a step to add tags and customize the actual card writing").** The detail
    card's **Edit** opens two fields prefilled with her saved values — the
    card's writing (the title) and its tags — saved by `POST /api/shoebox/
    memory`, a whitelisted patch of `title` + `hashtags` and nothing else (it
    refuses a missing doc — an edit must never invent a memory). Everything
    else about a memory is untouchable here; **Square it** still builds a
    one-picture Squaring set through `cropper.createSet` (a NEW copy, never
    the source). Tags show as chips on the card and are searchable.
  - **Round 3 (2026-08-29, her asks):** search covers the FULL prompt, the
    memory's words, tags, caption and source (never the url) — and
    `shoeboxPut` now keeps a >140-char title's full text in `content` on
    first filing, so a Playground prompt survives whole; the hand is
    **Indie Flower with the chin in CAPS at 11px** (her 2026-09-04 pick off
    the shoebox-fonts-v2 Compare sheet, then "text shud be smaller" the same
    day — Darb, the font she found, lost; its woff stays committed at
    `public/fonts/darb.woff`, harmless); **no date on the chin**; **PUT
    AWAY** (same day, "some pics were accidental like the pine forest"):
    the detail card hides an accidental memory from the shoebox — one
    field, `shoeboxHidden`, via `POST /api/shoebox/putaway`, nothing
    deleted — and the dimmed put-away pile behind the underlined opener at
    the end of the library is the way back (Bring back on its card); the finale is **v3** ported verbatim from
    memory-library-react #354 (five-point stars, dashes not dots, 3s
    twinkle, polaroids fade to a ghost); and **▶ Play opens ON the first
    card** — no whole-board shot first; the wide shot lives only at the
    end, where the finale needs the zoom-out.
  - **The library is one cheap read** — measured 2026-08-29: 626 memories,
    all carrying `createdAt`; the whole `select()` index cached 90s, the
    feed's `q` filtered over the FULL index (the Assets-tab truncate
    lesson), never the url. The page loads the whole library once, so its
    own search box is honestly client-side. Whose library it is comes from
    scratchpad.js's `shoeboxUid` (exported — the ONE copy of the uid
    discovery); the uid never rides a response.
  - **The detail card is the SHOEBOX'S OWN, not the shared asset lightbox**
    — the dream-feed/witch rule: an app with its own identity keeps it. The
    big polaroid, the memory's words on paper, the honest MODEL · QUALITY ·
    SIZE line, Pin/Take off, Square it.
  - **Tiles are derived thumbs** (`FeedKit.thumbFor`); the board and the
    detail card load the ORIGINAL — a pinned polaroid is looked at up close.
    The star paper tile is committed at `public/shoebox-papers/star-paper.webp`
    (mirrored/seamless, fixed 1600px so the stars stay her photographed
    size). **NEVER `public/shoebox/` — a `public/<name>/` DIRECTORY shadows
    `app.get('/<name>')` (found live 2026-08-29):** express.static is mounted
    above every page route and answers a request matching a directory with a
    301 to the slash form, so committing the tile there took the whole
    /shoebox route down to a redirect loop the moment it deployed. Reproduced
    and pinned: an asset directory for a tool must not share the tool's route
    name.
  - Tests: `node scripts/test-shoebox.js` — the index/caption/search rules
    and the board doc's compatibility rules pure, then the real page
    headless: pinning from the detail card, string-tying by taps, order
    numbering, the play walk really MOVING the camera, the finale lighting
    real stars, and every edit reaching the debounced `POST /board-state`.

### Squaring

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

### Freeform

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
  **♥ / ✕ AND THE BIGGER BOX (2026-09-04, Sophie: "freeform has no heart x?" ·
  "that and an expand textbox button").** Measured before the fix: nothing in
  Freeform could be marked at all — no vote field, no route, no `_cast` wired
  into the shared lightbox, so it drew no ♥/✕ there either. Now the
  Playground's pattern whole: one mark per PICTURE on the run doc
  (`votes.{i}`, `POST /api/freeform/run/:id/vote`), the Assets tab's own two
  marks on each picture's top corners on the card AND in the lightbox (one
  reader, `runsById`, so a mark cast anywhere shows everywhere), tapping the
  lit one clears it, and the ♥-only / hide-✕'d pair over the feed, sticky
  (`freeform_liked` / `freeform_hidex`). **Hide-the-✕'d opens ON since 2026-09-14** (her "default to hide x" — the rule and its four guards are in the Playground's ✕-filter note, which also carries the 2026-09-15 split: the PLAYGROUND went back to default-off and these four did not). **Both directions with the Assets
  tab**: the route calls server.js's `syncVoteToAssets` (handed in at init —
  a Freeform output is a My Creations picture, so the my-creations rule reaches
  `/freeform/out/` too) and the Assets vote route calls `freeform.voteFromAssets`
  back. The lightbox's note box lands on the picture's my-creations thread,
  the Playground's wiring. `#bigprompt` is the Playground's corner toggle in
  shape — `.big` cap over floor in CSS, `fitBig` measuring the words, 56px in
  from the right for the pill's column, not sticky; `applyRunIn` refits it.
  Test: `node scripts/test-freeform-votes.js` (the server half by source, then
  the real page headless against a stub that RECORDS every vote and note the
  page really POSTs).
  **Full details: `docs/modules/pictures.md`.**

