# The vector pipeline — describe drawings, get scalable art

**Read this before making vector art, and before changing anything in
`vector.js` / `vectorize.js`.** Sophie asked for it to be written down so any
chat she points here can use it without re-deriving the recipe.

    describe 1-4 drawings
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

So reach for it when something has to be **big, printed, or cut**. On a phone
screen a PNG already looks fine; a vector library for its own sake would not
earn its keep.

**It only works on FLAT art.** Ink lines and solid colour vectorise
beautifully. Shading, texture, a watercolour wash or a photograph do not — the
tracer would emit hundreds of near-duplicate layers and the result would be
bigger AND worse than the PNG. That is why the style below is fixed.

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

- **Grid clause**, next, for 2-4 drawings:

  > A 2x2 grid of four completely separate small illustrations on a plain white
  > background. Wide clean white gutters between them, each drawing sitting well
  > inside its own quarter, nothing crossing or touching between the cells, no
  > grid lines, no borders, no frames.

  For ONE drawing a different clause is used ("ONE small illustration, centred
  …"). Asking for a 2x2 and describing one quadrant gets three cells of
  invented filler.
- **Then the caller's descriptions**, as `TOP LEFT: …  TOP RIGHT: …` etc.
- **Suffix**, at the very end, after everything — the no-text rule:

  > Absolutely no text, no words, no letters, no numbers, no captions.

`POST /api/vector/prompt` returns the literal assembled prompt and spends
nothing. Use it to check the wording before paying.

**A caller supplies only what is IN each drawing.** That is deliberate: a
caller free to describe shading would quietly produce art this pipeline cannot
trace. If a different look is genuinely needed, add a NAMED style to `HOUSE`
rather than letting prompts drift.

### Why a sheet of four instead of four calls

Four times cheaper (one ~6c call rather than four) and — the real reason — the
four come out as a **set**: one pass of the model, so line weight, palette and
scale match across them. Four separate calls drift apart. The cost is
resolution: a cell of a 1024 sheet is only ~512px of picture, which is exactly
the softness the tracer removes.

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
- `kb`, `ms`, `quadrant`, `draw`

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
- **A cell drawing that leans into its neighbour's quarter loses a limb** — the
  sheet is cut on a straight quarter line. The "wide gutters / nothing crossing"
  wording in the grid clause is what prevents it; do not trim it.
- **The sheet is requested as PNG, not webp.** Everywhere else in the app asks
  for webp at compression 80 because a person is looking at it; this one hands
  the image straight to a tracer that clusters flat colours, and webp's ringing
  around a hard ink line is noise the flattener then spends a cluster on.
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
- `scripts/test-vectorize.js` — the quality gate
- `docs/gravity-lock/vector/*.svg` — thirteen traced cards, the worked example
- `@neplex/vectorizer` — native vtracer bindings, an optionalDependency so a
  host without the binary fails on this one route rather than at boot
