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
- **Six styles: WTR, Sandy mirror, ChatGPT, Scarry, Pastel, Hoonies.** **WTR**
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
  Every gpt style appends a `suffix` at the VERY END of the sent prompt, after
  her words (the no-text rule; Pastel's is the house style's longer wording).
  ChatGPT-engine styles live in `PL_GPT_STYLES` in server.js (keyed `evan` /
  `plain` / `scarry` / `pastel` / `hoonies`; the page sends `style`,
  absent/unknown → `evan` so old pages keep working) — adding another different-reference style = drop the
  image(s) in `refs/` (or point `storageRefs` at Storage), add a
  `PL_GPT_STYLES` entry + a one-line `STYLES` entry in promptlab.html (the page
  holds NO prompt copies anymore — see below).
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
slot at all — and off on PANELS, for the reason the photo ref is: a sheet is
not the surface to argue "the last attached image" on. It is deliberately NOT
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
  exactly as on a grid sheet. Sophie card, photo ref and cast are OFF, the
  panels branch's own reasoning. `'story sheet'` is searchable in both
  haystacks; a story run's copy button refills the story box.
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
