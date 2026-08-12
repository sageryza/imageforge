# The vector pipeline — describe drawings, get scalable art

**Read this before making vector art, and before changing anything in
`vector.js` / `vectorize.js`.** Sophie asked for it to be written down so any
chat she points here can use it without re-deriving the recipe.

    describe 1-25 drawings
      -> ONE gpt-image-2 sheet in the pastel house style   (~6c, the only cost)
      -> cut into cells, lift each off its paper
      -> trace each to SVG                                  (free, local, ~1.3s)
      -> an SVG + a 2048px PNG per drawing, in Storage

## Why bother — what a vector is FOR

Everything else in this app ends at a PNG, which is fine on a screen and
useless anywhere else. A card drawn at 1024px cannot go on a poster or a tote,
and a die-cut sticker needs a cut path nothing here was producing.

A vector is **sharp at any size** from one ~100KB file, it **recolours** by
editing a fill, and **its outline IS the cut line** — which is normally the
fiddly part of a sticker listing. It is also **free**: the trace runs locally,
so the only money in the whole pipeline is the one image call.

What it cannot do is a gradient. The tracer's whole method is to reduce the
picture to a handful of flat colours; a wash, a soft shadow or a photograph has
no flat colours to find, so it emits hundreds of near-duplicate layers and the
SVG comes out both bigger and worse than the PNG. Ink lines and solid fills are
what it is for. That is a limit of the tracer, not a view about what to draw.

## The style, exactly

`HOUSE` in `vector.js` is the recipe, and it is the same one the Gravity Lock
teaching cards were drawn with, word for word.

- **Model** `gpt-image-2`, **edits** endpoint, **1024x1024**, quality
  **medium** by default (low / medium / high accepted).
- **Style references**, attached as pure style anchors — the same two the
  pastel house style and the Witch School cards use:
  `witch-school/refs/sophie-snake.png` and `witch-school/refs/sophie-animals.png`
  (Storage, cached in memory after the first fetch).
- **Prefix**, prepended:

  > Use the attached images ONLY as a STYLE reference for the linework: bold
  > confident black ink outlines, flat colors with NO gradients and minimal
  > shading, a soft pastel palette of lilac, pastel pink, mint and pale yellow,
  > on a plain white background, playful modern editorial illustration.

- **Grid clause**, next, sized to the number of drawings. For four:

  > A 2x2 grid of four completely separate small illustrations on a plain white
  > background. Wide clean white gutters between them, each drawing sitting well
  > inside its own quarter, nothing crossing or touching between the cells, no
  > grid lines, no borders, no frames.

  A 2x2 says "quarter" and every other layout says "cell", which keeps the 2x2
  prompt **byte-identical** to the one the Gravity Lock cards were drawn with —
  there is an assertion of exactly that. For ONE drawing a different clause is
  used ("ONE small illustration, centred …"): asking for a grid and describing
  a single cell fills the rest with invented filler.
- **Then the caller's descriptions**, by position — `TOP LEFT: … TOP RIGHT: …`
  for a 2x2, `LEFT: … RIGHT: …` for a 2x1, `TOP LEFT … MIDDLE CENTRE …
  BOTTOM RIGHT` for a 3x3.
- **Suffix**, at the very end, after everything — the no-text rule:

  > Absolutely no text, no words, no letters, no numbers, no captions.

`POST /api/vector/prompt` returns the literal assembled prompt and spends
nothing. Use it to check the wording before paying.

**A caller supplies only what is IN each drawing** — the style comes from
`HOUSE`. That keeps a set consistent and keeps the output flat enough to trace
(see the gradient limit above). To change the look, change `HOUSE`.

### Why a sheet, and how many to put on it

A sheet is N times cheaper than N calls (one ~6c call) and — the real reason —
the drawings come out as a **set**: one pass of the model, so line weight,
palette and scale match across them. Separate calls drift apart.

**Up to nine, and the ceiling is not the tracer.** The pipeline shipped at four
only because the Gravity Lock cards happened to be a 2x2; that was inherited,
not derived. Measured since, on a 3x3 sheet drawn at all three qualities: cells
come out 341px, the drawings ~250-310px of that, and the traced line weight
lands within **4.8% (low) / 7.4% (medium) / 6.4% (high)** of the source — all
inside the 8% the 2x2 cards are held to. Nothing about the trace degrades.

**What changes is the drawing, not the trace.** At 3x3 the model draws simpler
objects, because each one is smaller: fills per drawing averaged **2.9 at 3x3
against 4.75 at 2x2** over the same kind of subject. So pick the grid by how
much is IN each picture:

| grid | cells | cell px | per drawing |
|---|---|---|---|
| 2x2 | 4 | ~512 | 1.5c |
| 3x3 | 9 | ~341 | 0.7c |
| 4x4 | 16 | ~256 | 0.4c |
| 5x5 | 25 | ~205 | 0.24c |

**8% is NOT a quality cliff.** Measured on a
real 21-icon 5x5 sheet another chat made: 204px cells, drawings 111-206px, and
3 of the 21 drew their lines 8.6-9.3% heavier than the source. That was first
written up here as "past the edge", which was wrong, and the correction matters
because the number is easy to misread: **8% is a REGRESSION DETECTOR calibrated
on the 2x2 cards, not a threshold of visible badness.** Put the three worst
side by side with their source cells and they are indistinguishable — the key
and the magnifying glass are identical to the eye, the target is a hair heavier
in the ring outlines and arguably crisper for it. Judge a batch by looking, and
use the percentage only to catch a change.

**A 5x5 drawn by THIS module: 25 for 25, every drawing in the right cell.**
The open question used to be whether the model would place 25 described
drawings correctly from this prompt; it does, and the route now allows up to
25. Past three columns the instruction stops naming positions ("UPPER FAR LEFT"
is a mouthful and an invitation to misplace) and becomes a row-by-row list —
`ROW 1 of 5, left to right: …` — which is a shape models follow well for long
sets. Drawings came out 147-203px, line weight mean 4.3%, 3 of 25 over 8%.

### Where the line is

Cell size does not move the AVERAGE — it moves the WORST CASE. Mean line-weight
error is ~4.3% at 5x5 and ~4.4% at 4x4, i.e. the same; what changes is the tail.

Measured on the SAME subjects drawn at both sizes, which isolates the cell:

| subject | 5x5 (205px) | 4x4 (256px) |
|---|---|---|
| strawberry (seeds) | +14.1% | +9.0% |
| acorn (cross-hatch) | +12.7% | +8.6% |
| cassette | +9.8% | +6.9% |
| bicycle | +0.9% | -1.1% |
| moon | +7.5% | -4.1% |

The pattern is one thing: **error scales with how fine the drawing's detail is
relative to its cell.** Subjects carrying fine repeated marks — seeds,
hatching, stippling, scales — climb as the cell shrinks; subjects made of large
shapes sit in the noise at every size (a bicycle's spokes survive at 200px).

And the percentage only becomes visible somewhere past ~10%. At +9.8% the
cassette is identical to its source; at +14.1% the strawberry's seeds are
visibly chunkier. Under 10% treat the number as a regression signal only, and
judge by looking.

Layouts run 1, 2 (2x1), 3 (3x1), 4 (2x2), 6 (3x2), 9 (3x3), 12 (4x3), 16 (4x4),
20 (5x4), 25 (5x5). **A count that does not tile** takes the next layout up and
the spare cells are drawn and thrown away — the sheet costs the same either
way, so those numbers waste nothing. `POST /prompt` reports the `layout` and
how many cells are `wasted`.

### Quality

`low` / `medium` / `high` — roughly 2c / 6c / 25c a SHEET, not per drawing.
All three trace cleanly (the line-weight numbers above are all three). High
gives the model more detail per object; low is genuinely usable for simple
icons, and at 3x3 a low sheet is nine drawings for about 2c.

## Using it

Gated by `STUDIO_TOKEN` when set (`x-studio-token` header); only
`GET /status` is open. Slow work is a **background job** on a Firestore doc
(`forge-vector`) — the POST returns an id immediately and you poll.

**Make a sheet**

```
POST /api/vector/sheet
{ "name": "kitchen-things",
  "quality": "medium",
  "cells": [
    { "id": "teacup", "draw": "a cat curled asleep inside an oversized teacup, tail hanging over the rim" },
    { "id": "kettle", "draw": "a round kettle with a curl of steam rising and spiralling above it" },
    { "id": "moth",   "draw": "a big soft moth with patterned wings resting on an open matchbox" },
    { "id": "boots",  "draw": "a pair of rain boots with a small plant growing out of one of them" } ] }
-> { ok, id, poll: "/api/vector/job/<id>", cost: 0.06 }
```

Poll `GET /api/vector/job/<id>` until `status` is `done` (or `failed`, with
`error`). Each finished item carries:

- `svg` — the deliverable, resolution-free
- `png` — a 2048px render of it, for a gallery tile
- `cut` — the cut-out cell it was traced from
- `colors` — the fills as hex, for a swatch or a recolour
- `kb`, `ms`, `cell` (where it sat on the sheet), `draw`

Per-cell options: `fills` (0 = work it out, the default) and
`darkBackground: true` — see the gotchas.

**Re-cut a sheet you already paid for**, for nothing: pass the sheet's URL back
as `sheet`. Tuning the trace must never re-bill the model.

```
POST /api/vector/sheet { "name": "...", "sheet": "<the sheet url>", "cells": [ ... ] }
-> cost: 0
```

**Trace a picture you already have** (any flat-colour PNG/JPEG/WEBP URL) — free:

```
POST /api/vector/trace { "urls": ["https://…/thing.png"], "cutout": true, "name": "thing" }
```

`GET /api/vector/jobs` lists recent runs. `GET /api/vector/status` reports
whether the tracer binary, Firebase and the OpenAI key are all present.

## Gotchas that cost real time

- **A dark-background drawing must set `darkBackground: true`.** The cut-out is
  a flood-fill in from the four corners, so on the Grand Tour card (black
  background) it ate the background and the trace came out on white. That is
  also why the first version of the test failed: it was pointed at the
  transparent cut-outs rather than the opaque cells the SVGs were really made
  from.
- **The cut-out is a corner flood-fill, never a white threshold.** The white
  INSIDE a drawing — an astronaut's suit, a badge's face — is the same white as
  the paper, and thresholding punches holes straight through it.
- **Firestore refuses an array inside an array**, which is why `colors` are hex
  strings. The very first live run failed on exactly that, *after* the sheet had
  been paid for.
- **The sheet is cut on its REAL gutters, not on exact fractions** — and that
  was a bug before it was a feature. Cutting at exact thirds looks right and is
  not: the model does not place drawings on a perfect grid, so a boundary can
  land on ink, which does two visible things at once — clips the drawing it
  cuts through, and leaves the severed piece in the NEIGHBOURING cell as a
  stray mark. Sophie caught both on a 3x3: the second row cut fell at y=682
  while the real gutter was 622-674, so the sailboat came out with a dot
  floating above its flag (the tail of the balloons' string from the cell
  above). `gutters()` now finds the widest clear run near each boundary and
  cuts through its middle, and `cutout()` drops a border-touching blob smaller
  than 15% of the main drawing. The "wide gutters / nothing crossing" wording
  in the grid clause still matters — it is what makes a clear run exist to find.
- **webp costs the trace NOTHING — do not re-render a sheet to PNG hoping for a
  better trace.** This module asks for PNG, but the reason first written here
  ("webp's ringing is noise the flattener spends a cluster on") was reasoning
  and it is wrong. Measured on the same 3x3 sheet: PNG 933KB and webp-80 53KB
  trace to the same line weight within noise — max 7.4% against 7.0%, mean 3.6%
  against 3.3%, the webp marginally better. PNG stays only because it is free to
  keep. A sheet made by `/api/generate/housestyle` (which saves webp) is a
  perfectly good input to `/trace`.
- **Filing the results:** the Assets tab dedupes by FILENAME, not URL. Two
  versions of a drawing at `…/v1/moth.png` and `…/v2/moth.png` weld into one
  tile and one of the labels wins. Give a new version a new *filename*
  (`moth-v2.png`), not just a new folder.

## The tracer itself (`vectorize.js`)

The whole job is FLATTENING the picture to exactly `fills + 2` colours — the
fills, the ink and the paper. vtracer then emits one layer per real colour
instead of the 100+ near-duplicates it finds in a raw render. Three parts are
load-bearing and each shipped a visibly wrong result when it was missing:

1. **The anti-aliased band beside every line is not a colour.** It is a ramp
   from ink to paper straight through the range the real fills occupy, so a
   palette built over it spends a whole cluster on the ramp — and the trace then
   wears that colour as a pale halo along every line.
2. **The palette is k-means, not a quantiser.** A quantiser spans the gamut,
   which is exactly wrong for flat art: a grey hammer head (210,204,209) and a
   lilac moon (214,207,232) sit 23 apart and get merged.
3. **Labels propagate, not colours.** Non-fill pixels take the LABEL of the
   nearest fill by distance transform, so no blended in-between colour is ever
   invented.

`ink = 130` sets the STROKE WEIGHT of the whole drawing. At the old 150 every
card drew 6-9% fatter than its source (Sophie: "a little blurry and not
crisp"); at 130 they land inside 2.5%. The test fails at 150.

`fills = 0` works the colour count out from the picture, and that decision is
**unstable at the margin by nature** — a colour occupying under about 1% of the
fill pixels may or may not get its own cluster. Pass an explicit `fills` when a
particular drawing matters and the auto count is one out.

**`scripts/vectorize-card.py` is the original and still the readable reference
for why each step is there.** It is kept as a CLI (it takes a file or a whole
folder); the Node port is what the server runs, because adding Python to the
build for one script is a second language in the deploy forever.

The two are **not** bit-identical and cannot be: k-means starts from a seeded
RNG and PIL's Lanczos differs from sharp's at edges (measured: 4.2% of pixels
off by more than 4). They agree exactly on 8 of the 13 Gravity Lock cards and
differ by one marginal colour — 0.04% to 0.3% of the card — on the rest.
Neither answer is the right one.

## Testing

    node scripts/test-vectorize.js          # all thirteen fixtures
    node scripts/test-vectorize.js weight   # one
    node scripts/test-vector-prompt.js      # the house prompt, no network needed

`test-vector-prompt.js` rebuilds the sheet-A prompt from its four descriptions
and asserts it is **byte-identical** to the one banked in
`cards-manifest.json`. Generalising the grid clause from four cells to any
number nearly broke it — "its own quarter" became "its own cell", which reads
like a tidy-up and is a different prompt.

It re-traces the Gravity Lock cards and asserts against the **source card**,
not against the Python: no invented colour, no dropped colour, line weight
within 8%, and a whole-card structural match. Every cap is set above the
measured spread of the thirteen, with headroom.

**What it does NOT catch, honestly:** small localised wrong-colour patches. The
pink-fleck bug (a `-1` label painted as cluster 0, which put pink crescents
inside the moon's craters) was re-injected deliberately and the test still
passed — those flecks are a real palette colour in the wrong place, so nothing
is invented or dropped and the whole-card average barely moves. That class of
bug is caught by LOOKING at the render. Do that before shipping a batch.

Fixtures are the exact PNGs the committed SVGs were traced from, banked in
Storage and listed in `docs/gravity-lock/trace-fixtures.json`. The test needs
network but no credential, and skips rather than failing when it cannot reach
them.

## Where things are

- `vectorize.js` — the engine (no HTTP): `vectorize`, `flatten`, `cutout`, `slice`
- `vector.js` — the router `/api/vector`, the `HOUSE` style, the background job
- `scripts/vectorize-card.py` — the original CLI and the readable reference
- `scripts/test-vectorize.js` — the trace quality gate
- `scripts/test-vector-prompt.js` — the prompt-drift gate
- `docs/gravity-lock/vector/*.svg` — thirteen traced cards, the worked example
- `@neplex/vectorizer` — native vtracer bindings, an optionalDependency so a
  host without the binary fails on this one route rather than at boot
