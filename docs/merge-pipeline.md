# The merge — where the audio road and the image road join

The audio pipeline and the image pipeline were mapped separately
(`docs/audio-pipeline.md`, `docs/image-pipeline.md`) and each one ends up
naming the other's shape without saying so. This is the doc for joining them,
**one module at a time** (Sophie, 2026-08-16). Module 1 is drawn; nothing is
built yet.

**The map** is `docs/merge-map.html`, posted into the Chats app as a Compare
page (`audio-image-pipeline-merge` chat, sheet `merge-m1-s5` — the sheet name
carries the shape of the item set, so a rebuild can't silently re-point her
saved notes). It is the **fourth** sibling on the blush board, after the
content pipeline's S-curve (`s-curve-content-pipeline`, v8), the audio map and
the image map. Same board, same road language, same already-paid-for cut-out
drawings. **Keep the family looking like one thing: if the road changes there,
change it here.**

Three of the five stops deliberately wear the SAME drawing as the stop they
correspond to on a parent map — `inbox` is CAPTURE, `blocks` is BLOCKS, `zine`
is WORDS and SCRIPT, `window` is WINDOW. That is how the board says "this is
the two roads you already know, seen where they touch" rather than "here is a
third pipeline".

## The claim: the roads already touch, and neither map noticed

- On the **audio** map, **BLOCKS** is stop 3, and it is **built** — `blocks.js`
  + `/blocks`, merged 2026-08-16 (#1281). It turns a recording into
  sentence-level lines.
- On the **image** map, **WORDS** is stop 1, and it is **dashed** — *"no tool …
  a chat writes this in conversation today"*. It is where the content prompt
  comes from.

They are the same words. So the merge is not two pipelines being bolted
together — **the audio road hands the image road its missing front door**,
already segmented, already in order, already in her own voice. That is why
module 1 is a wiring job and not a new pipeline, and it is the whole reason to
start here rather than anywhere else on either road.

## The five stops of module 1

1. **INPUT** — a recording. Voice memos, the drop, the share sheet; one
   library and every path already files into it (`memos.fileIntoArchive()`).
   Built.
2. **BLOCKS** — it comes apart into sentence-level lines she can split, meld,
   reorder and mark. Built (`/blocks`). Roughly 180 lines in a 17-minute
   recording, at the rate measured the day it shipped (a 17-second clip made
   3 lines from 45 words).
3. **SCENE** — each line's words become a **content prompt**: what the picture
   is OF. **No tool, and this is the one genuinely new hole the merge opens**
   (see below).
4. **WINDOW** — four blocks to a sheet, one low call, cut apart into quarter
   panels. **Built twice and reachable from neither** (see below).
5. **THE BOARD** — every block wearing its panel, in order: the storyboard.
   **Nothing carries it.** Both roads walk on from here — the audio side to
   WORD CUT / EXACT CUT / POLISH, the image side to WARDROBE / WOODEN / GOLD.

## What the quarter panel actually costs (and why it is a quarter)

Sophie's instinct — *"they're only a quarter of the cost since we're still in
the storyboarding phase"* — is exactly right, and the mechanism is worth
writing down because it is not the obvious one.

All figures gpt-image-2, from the one table in `docs/modules/pictures.md`
(checked against OpenAI's own image guide 2026-08-16):

- A **low** 1024x1536 call is **0.5¢** of output.
- A **style reference** adds about **1.85¢** of input on top — measured across
  3,293 real calls over 31 days. At the cheap end the reference is most of the
  bill.
- So one low sheet with the house refs attached is **2.35¢**, and it carries
  **four panels → 0.59¢ a panel**.
- The same panel drawn one to a call is **2.35¢**.

**Exactly four times, and the reference is why.** The reference is charged
**per call**, so quartering the sheet quarters the reference bill along with
the output. Even with no refs at all the ratio holds (0.5¢ a sheet vs 0.5¢ a
picture), so the quarter is robust either way — but with refs it is the
reference, not the pixels, doing most of the saving.

At the whole-recording scale, for 17 minutes:

- **a panel per line** — ~180 lines → 45 sheets → **~$1.06**
- **a panel per paragraph** — ~23 sections → 6 sheets → **~14¢**
- medium instead of low is 7.15¢ a sheet, **1.79¢** a panel — the polish
  phase's price, and the storyboarding phase does not need it.

**The unit question is already answered by the data model**, which is the nice
surprise: `makeSections` in `blocks.js` groups the lines into paragraphs at the
biggest silences (about eight lines each) and titles each one from its own
first six words — never a model call, never invented. So "a panel per line" and
"a panel per paragraph" are the same feature with a different unit, and the gap
between them is 7x. Worth offering both rather than choosing.

**One stale figure found on the way:** `vector.js`'s `COST` table still reads
`2¢ / 6¢ / 25¢`, which is gpt-image-1's pricing and runs ~25% high at medium
and high. It is only ever displayed, never billed, so nothing is
mis-charged — but fix it when that module is next opened.

## The three holes module 1 has to fill

Only one of them is new, which is the argument for building it.

- **Four to a sheet, cut apart — BUILT TWICE, REACHABLE FROM NEITHER.**
  `movies.js`'s `renderSketchGrid` draws a 2x2 grid at low and slices the
  quadrants with ffmpeg (a 1.5%/side inset so wobbly hand-drawn borders don't
  bleed, then a cream mat) — welded to a movie's scenes and its style.
  `vector.js`'s `POST /sheet` sheets and cuts too — welded to pastel and the
  tracer. This is **not a new hole**: the image map already names it as *"the
  road's own front door has no general tool"*. Module 1 lands on it, which is
  the case for building it as the shared WINDOW tool rather than a third
  private copy.
- **A spoken line turned into a picture description — NEW.** *"and I just got
  in the car and drove"* is what she **said**; it is not what the picture is
  **of**. Something has to make that turn, and it is the only step in module 1
  that costs a model call. **Which model is a decision, not a default** — the
  house rule sends reader-facing words to Claude and bulk mechanical extraction
  to `gpt-4o-mini`, and this sits between them: it is mechanical in volume but
  the image pipeline's whole thesis is that *the prompt is the treasure*. Ask
  before picking. The meteorite short did this step by hand, beat by beat, in
  `beats.js`.
- **A panel living ON its block — NEW-ish.** `blocks.js`'s state whitelist is
  `marks / custom / whoOver / added / ttsUrls / order / secMeld / place /
  sections`; there is no image field, and no image concept anywhere in the
  module (measured: zero occurrences). Both parent maps already name the
  general version of this — *"nothing carries a project across the rooms"* on
  the audio side, *"the treasure is stored on the throwaway"* on the image
  side. Module 1 is the first place it has to be solved concretely rather than
  described.

## The whole walk has already been done once, by hand

`scripts/story-short-meteorite/` is this exact road walked end to end on a
17-minute recording: whisper → hand-listed verbatim spans → pastel panels →
animate → stitch → file, about **$2.90 for twelve beats**. Its README is the
story-short recipe.

**The hand-listing in `beats.js` is the step BLOCKS now does by itself.** That
is the measurement that makes module 1 a wiring job: the expensive, unrepeatable
human part of that folder is the part that got built last week.

## Not done, and deliberately

- **Nothing is built.** This turn is the drawing, at Sophie's ask ("let's do
  this slowly one module at a time and let's just start by drawing").
- **Modules 2+ are not drawn** — what happens to a panel after the board
  (which of the two roads it rejoins, and how a chosen panel gets promoted from
  a half-cent probe to a keeper) is the next map, not this one.

## The audio map is stale about its own third stop

Worth fixing next time that map is versioned, and noted here rather than
silently: `docs/audio-pipeline-map.html` still marks **BLOCKS** as
`none: 'artifact only'` and links it to the old Compare page
(`ePKqeMJOATGCz7MJa9lA`). `blocks.js` and `/blocks` shipped 2026-08-16, and
`docs/audio-pipeline.md` was updated for it (the struck-through hole) — the map
was not. A new version is a new page, so it needs a re-post in the
`audio-pipeline-tool` chat, not an edit.

## Editing the map's geometry?

The board is the family's, identical to the image map's: 440 wide, `CX = 270`,
`A = 140`, `B = 40`, `Y0 = 58`, `R = 22`, viewBox 495 tall. The road extremes
land on fractions 0.2 / 0.4 / 0.6 / 0.8; 0.4 and 0.8 are the LEFT extremes with
the wide gutter beside them, which is why **BLOCKS is pinned to 0.40** (the fan
of lines needs the gutter) and **WINDOW to 0.80** (the sheet being cut needs
it). Do not re-derive the arc sweep flags — moving the start alone leaves the
bowls curling the old way and the S comes out backwards. Stops: INPUT 0.01 ·
BLOCKS 0.40 · SCENE 0.60 · WINDOW 0.80 · THE BOARD 0.99.

The tab row reserves **64px** for the pill, not the 56 the sibling maps use —
measured 2026-08-15, the injected pill's left edge lands at x=326 on a 390pt
phone, so a 56px reserve leaves the last 8px of the rightmost tab dead.
