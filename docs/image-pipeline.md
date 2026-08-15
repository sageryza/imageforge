# The image pipeline — the prompt is the treasure

The audio pipeline (`docs/audio-pipeline.md`) is **subtractive**: it starts with
a recording that already contains everything, and every stop after that removes
something. The image pipeline is the other shape. It starts with nothing,
and the thing that grows along the road is **the prompt** — the picture is
instrumentation, bought as cheaply as possible so you can look at the idea and
throw the picture away.

Sophie's framing, Aug 2026, and it is the whole design:

> the prompt is the treasure and the image is just a throwaway asset that's more
> useful for gathering information about what we want and conceptualizing it
> than using as part of the finished piece … at least a content part can be used
> in multiple styles so if we change the direction and want to redo everything
> in a different style, we still have the prompt and can build it up again

Two consequences, and everything below follows from them:

1. **The prompt is the row; the image is an attachment to it.** Today it is
   backwards everywhere in this repo — an image is the record
   (`forge-chat-assets`), and its prompt is two fields hanging off it
   (`promptStyle` / `promptContent`). Nothing versions a prompt, searches
   prompts across chats, or re-renders one.
2. **Content ⟂ style.** They are already stored as two fields. Nothing yet
   treats them as two *axes* — one content across N styles is a script a chat
   runs by hand (`scripts/style-triptych-sheet.js`), not a button.

**The map** is `docs/image-pipeline-map.html`, posted into the Chats app as a
Compare page (`image-pipeline-design` chat, sheet `image-pipeline-s8`). It is
the third in the family after the content pipeline's S-curve (v8,
`s-curve-content-pipeline`) and the audio map — same blush board, same road,
same cut-out drawings. **Keep the three looking like one family: if the road
changes there, change it here.**

**One thing on this map that is not on the other two: a lap.** The audio road is
a walk — you pass each stop once. The image road walks into a loop and goes
round it until the prompt is right (FOUR-UP → READ → REWRITE → FOUR-UP), and
only then continues. The loop is the cheap part; everything after it costs real
money. Drawing it as a lap is the point of the picture.

## The road

    a beat, a memo line, a photo, a lesson
        → SUBJECTS → THE SPLIT ← the shelf, the character
            → ( FOUR-UP → READ → REWRITE ) ↺
                → SPREAD → LADDER → THE PICTURE
                    → vector · animate · print · a page

### 1. SUBJECTS — the list of things to draw

The unit is a **set**, never one picture, because the cheap rung draws four (or
nine) at a time and a set is what re-renders wholesale when the direction
changes. **No tool.** Today a subject list is retyped into every script that
needs it (`style-triptych-sheet.js`'s `SUBJECTS`, `vector`'s `cells`, the
Playground's box), so the same four subjects exist as four unrelated copies.

Things that already produce lists and could feed this: Story Room beats,
`/api/generate/subjects` and `/moments`, NDE moment mining, the dating book's
essay list, a Witch School lesson's cards.

### 2. THE SPLIT — content and style, written as two halves from the start

Not a formatting preference — it is what makes the treasure portable. **Content**
is what is depicted, and it survives a change of direction. **Style** is a named
recipe (a reference image + a prefix + a suffix), and it is a column, not text
you retype.

The storage shape for this already exists (`promptStyle` / `promptContent`,
`POST /api/gallery/assets/prompt`). What is missing is an editor that writes the
two halves *before* an image exists, rather than filing them after one does.

Flowing in:

- **THE SHELF** — the references and their written recipes: `refs/` (sage sandy
  mirror, dream mystery, sophie book, richard scarry, evan, flat cool/busy),
  Storage (`witch-school/refs/sophie-snake.png` + `sophie-animals.png`,
  `hoonies/refs/style-*.png`), the LoRA triggers in `MODELS.replicate`, and the
  prefixes/suffixes in `PL_GPT_STYLES` and `vector.js`'s `HOUSE`. A style is
  those three things together, and they currently live in four places.
- **CHARACTER** — the consistency anchor: `refs/sophie-book.png`,
  `evan-character.png`, the nine approved NDE experiencer cards. A third
  orthogonal axis — content × style × character.

### 3. FOUR-UP — the cheapest picture this repo can make

One **low** 2x2 sheet, four subjects in a single call: **2¢ the sheet, half a
cent a frame**. `slice()` in `vectorize.js` cuts it on the real gutters, not at
the halves. Measured on the three-style run (`out/style-triptych/`,
`manifest-sheet-low.json` / `-medium.json`): **24 of 24 cells found their real
seams, none fell back to a midpoint**, and low cells came out ~530-556 × 760-809
from a 1024x1536 sheet.

**It is cheaper than half a cent if you want it to be.** `vector.js` measured
nine drawings on one sheet with nothing degrading — traced line weight within
4.8% / 7.4% / 6.4% of the source at low / medium / high, inside the 8% the
Gravity Lock cards are held to. A low **3x3** sheet is the same 2¢, which is
**0.22¢ a drawing**. What changes at nine is the drawing, not the trace: a
smaller cell gets a simpler drawing out of the model (2.9 fills per drawing at
3x3 against 4.75 at 2x2). So 2x2 for anything with faces or a mechanism in it,
3x3 for objects and icons.

**No tool.** This is the stop with the most leverage in the whole pipeline and
it exists as `scripts/style-triptych-sheet.js`, a script a chat runs — exactly
the shape of the audio pipeline's BLOCKS being a Compare artifact. `vector.js`
is the closest thing to it that IS a tool, but it ends at SVG rather than at a
prompt you keep working on.

**The icon is the block of four stamps** (`pipeline-icons-cut/stamps-cut.webp`,
served as webp — 143KB against the cut PNG's 437KB). v1 of the map wore the
four-pane window, picked because it shows four things; Sophie chose the stamps
instead, and a window does say window rather than four. See § icons below.

### 4. READ — write down what half a cent bought

Look at four frames and record what you learned **onto the prompt, not onto the
picture**. The mechanism exists — ♥/✕ and note threads in the Assets tab — but
it attaches to an image, so the finding dies when the tile scrolls away and the
next chat re-learns it. This is the stop that turns a spend into a pipeline.

### 5. REWRITE — v2, with the changed words marked

A prompt version chain, and it is free. The Writing Room already has exactly
this interface for prose — two versions with every changed word in red
(`writing.js`, `/writing`) — and it is the right one here: "the prompt is the
treasure" only pays if you can see how a prompt got good.

Then back round to FOUR-UP. **Four laps of four frames is 8¢.**

### 6. SPREAD — one content, every style

The payoff of the split. One sheet per style, 2¢ each: three styles × four
subjects = twelve pictures for 6¢. Built as `scripts/style-triptych-sheet.js`
and the page builders beside it (`build-style-triptych-page.js`,
`scripts/lib/triptych-page.js`); not a tool, and not driven by a stored set.

**A style has to be certified for the cheap rung before it can ride it.** Two
real constraints, both already met in the code:

- `gutters()` needs a seam of luma ≥ 245 to find it, so a style that renders on
  cream paper is expected to miss and fall back to midpoints. Measured zero
  misses on the runs on file — but the risk is in the method, not in the luck.
- **Dream mystery's shipped recipe cannot be used as-is.** Its real suffix is an
  anti-grid line ("NOT a grid, NOT split panels"), which exists because
  `dream-mystery.jpg` is itself a comic page — and it directly contradicts a 2x2
  sheet. The sheet run replaces it (`suffixSwapped: true` on every dream cell).
  So for one of three styles, **the cheap rung is quietly a different recipe
  from the one that ships**, and any comparison has to say so.

### 7. LADDER — climb only for a survivor

Four rungs, ordered by what a picture really costs: **¼ of a medium sheet ~1.5¢
→ low ~2¢ → medium ~6¢ → high ~25¢** (`scripts/build-quality-ladder-page.js`).
The rule that keeps the whole pipeline near free is the promotion rule: **nothing
climbs a rung without a mark against it at the rung below.** Most prompts should
die at half a cent.

### 8. THE PICTURE — filed with everything that made it

The existing ritual, unchanged: labeled, in the gallery, with the exact prompt
split style/content, and the MODEL · QUALITY caption — the one field no later
chat can honestly backfill (see the `deliver-images` skill). From here it goes
out: **vector** (free trace → SVG, and the outline is the cut line), **animate**
(`clips.js` / `movies.js`), **print** (Printify → Etsy draft), or **a page** (a
lesson, a book, a deck).

## The three structural holes

The same shape as the audio pipeline's three, and none of them is a missing
button.

- **There is no prompt library.** A prompt exists only as two fields hanging off
  an image (`forge-chat-assets`), plus whatever each tool keeps on its own run
  doc — `forge-promptlab`, `forge-freeform` (`promptSent`), `forge-vector`
  (`cells`). You cannot search prompts across chats, version one, fork one, or
  say "draw this content in that style". The Assets search bar does match filed
  prompts, but only inside one chat's tab. **This is the hole Sophie's whole
  framing is about**, and it is the one worth building first.
- **Nothing carries a SET across the rooms.** Every picture surface is
  content-addressed by its own run — the Playground by its run doc, Freeform by
  its, Vector by its job, the sheet scripts by a hard-coded array. A set of four
  subjects therefore gets retyped in each, and a change of direction means
  retyping it again.
- **The cheapest rung is not a tool.** No module, no page, no tile, no Firestore
  doc of its own. Every improvement costs a chat editing a script and re-running
  it by hand — and it is the rung everything else is supposed to sit on top of.

## Order of build

1. **The prompt library** (a `forge-prompts` collection: content, style, set,
   version chain, findings, renders). Everything else hangs off it.
2. **The FOUR-UP tool** on top of it — the sheet, the cut, the four tiles, the
   marks, the rewrite, the lap. This is the BLOCKS-equivalent, and building it
   before the library would mean building the thing that has to be rebuilt.
3. **SPREAD and LADDER as buttons** on a set, not scripts.
4. Wiring the existing rooms to read a set instead of their own box.

## The walkthrough — the road actually walked, for 12¢

Sophie asked to be walked through this with an example rather than told about
it (Aug 2026), so it was **run**: one idea, *Too much to carry*, round the lap
twice, then spread into a second style, then one rung up the ladder.

- `docs/pipeline-walkthrough.json` — every prompt, in order, plus the findings
  written at each READ stop. The words are data, so the page and the reply
  quote what was really sent.
- `scripts/pipeline-walkthrough.js <run-id>` — runs one stop. Reuses `slice()`
  and `HOUSE.grid(2,2)`; its two style recipes are copies of
  `style-triptych-sheet.js`'s, so a picture made here stays comparable with the
  style pages on the shelf.
- `scripts/build-walkthrough-page.js` — builds the Compare page out of the
  manifests, so nothing on it is written from memory.
- The page: `/api/chatfeed/page/CQlLvkTABdpEGW7puKem`.

**What the walk actually taught, and none of it was guessable:**

- **Round 1 drew four people coping.** The idea was *too much* to carry and
  every cell came back calm and upright — because the prompt named the subject
  and never named the failure. It also drew the same woman at the same angle
  four times, and handed the laundry a **basket nobody asked for**, which
  tidies away the precariousness that was the whole point.
- **Round 2 fixed it by naming the failure instead of the subject** — the stack
  tipping, the bag splitting, the face covered — and the four cells came back
  unrecognisably better for the same 2¢.
- **At half a cent, ask for BIG visible things.** The one instruction round 2
  lost was "one foot feeling for the next step he cannot see": a small hidden
  action does not survive a ~510px cell. A tipping mass, a spill, a covered
  face all do.
- **A rung up the ladder RE-DRAWS the picture, it does not enlarge it.** The
  medium solo of the winning prompt came back with a different composition —
  she stands beside the stack rather than hidden behind it — and a real
  expression the quarter-sheet could not hold. So the ladder is for the
  PROMPT, never for a particular picture you fell in love with. Anything you
  actually want kept has to be in the words.
- **The spread is the cheapest thing on the road and it reads that way.** The
  same four prompts in the pastel recipe, nothing else changed, 2¢ — a
  different world, and arguably more legible at cell size than the watercolour,
  because flat bold shapes survive being small better than wet line does.

## Icons — drawn on the pipeline's own cheapest rung

The four-up stop needs an icon that is not the four-pane window. Four candidates
were drawn as **one low 2x2 vector sheet** — `POST /api/vector/sheet`,
`quality: low`, 2¢ for the sheet, **half a cent each** — which is the pipeline
demonstrating its own first stop:

1. a sheet ruled into four squares with the fourth peeled up and lifted away
2. a block of four perforated postage stamps with the corner one torn off
3. a press sheet of four pictures with crop marks at the outer corners
4. scissors cutting down the middle gutter of a sheet of four

Job `sh-mstwaqid-bnejd`; the cut-outs and SVGs are in Storage under
`vector/sh-mstwaqid-bnejd/` and archived in `out/pipeline-icons/`.

**Sophie picked #2, the stamps** (Aug 2026). It is published into the family's
own prefix as `vector/pipeline-icons-cut/stamps-cut.png` + `.webp` so anything
else can use it, and the map reads the webp. The other three are kept on the
map's Holes tab rather than deleted — a rejected option is the cheapest thing
on file, which is the morgue idea in miniature.
