# The image pipeline — voice recording → her own style → animation

Sophie's plan for how a concept film gets MADE, recorded as a voice memo on
2026-08-10 ("AI Image Pipeline Concept", memo `2026-08-10_2207`, 2:48) and
extended in chat the next morning. It is the sequel to
`sophies-movie-pipeline.md`, which settles the CONTENT formula (literal image →
metaphorical image, animate between them) and the voiceover alignment. This
file is about the STAGES the pictures pass through, and the money.

**Status: being established.** The stage-1 prompt is still being tuned and the
last stage (LoRA image-to-image) has no code yet — see "What doesn't exist" at
the bottom. Check with Sophie before treating any number here as settled.

## The stages, in order

**0 · Voice recording → beats.** She records the concept. An AI chat reads the
recording and turns it into a set of image descriptions. Her note on the
hand-off: **put the content prompt FIRST so she can read it** — the picture is
below the words, not the other way round. From there, either the beats go into
the story shape (hers or the chat's, then she fixes it), or she leaves comments
on the pictures themselves, or she starts over and describes the pictures
herself.

**1 · Cheap draft sheets — FOUR PANELS IN ONE IMAGE, at low.** The first render
is not one picture per beat. Four beats are drawn as a 2x2 sheet in a single
image, **possibly at `low`**, and then each panel is **cut out** into its own
picture. This is a cost decision: it is one API call instead of four.

  - A `1024x1536` sheet cut 2x2 gives four `512x768` panels — **each one
    already 2:3 portrait**, the aspect the whole pipeline runs in. The cheap
    sheet and the final format agree with no cropping.
  - Resolution doesn't matter at this stage: every panel is re-rendered at
    stage 3, so a stage-1 panel is a composition, not a picture.
  - **The prompt is drafted and tested — see "Stage 1: the prompt" below.**

**2 · Characters — ONE view each, front, slightly smiling.** Before any styled
art, the main characters are drawn. Sophie's rule:

> these characters should only ever have one view of them, like a front view
> where they're slightly smiling

One canonical image per character, and that image is attached as a reference to
every later image that character appears in. This is the character-anchor
technique the movies pipeline already uses (`refs/evan-character.png` is an
existing example), tightened: **do not make a turnaround / model sheet with
several angles** — one front view only.

**3 · The watercolor ChatGPT version.** Each panel is redrawn through
gpt-image-2's **edits** endpoint with `refs/sage-sandy-mirror.png` (her scanned
ink-and-watercolour page, "sage sandy mirror") attached as the style reference,
plus the character card(s) for whoever is in the shot.

  - The recipe is the settled Evan one — **write NO style description**, just
    "use the attached image as a style reference, only its style, not its
    content; you do not have to copy its colors", then the scene. See
    `docs/evan-film-style.md`; every written style block that was tested made
    it worse.
  - **Quality: her memo lands on `high` for the real pipeline** ("we could
    possibly do it from quarter, or low, or medium, probably medium, maybe
    high, anyway, we'll have to experiment with that, so we'll try it with
    high, okay, fine, let's just say high"). Note this **disagrees with the
    Evan finding**, which tested high against medium and chose medium (high
    smooths the washes and reads more finished, less sketchbook). Worth a
    side-by-side before the real run — it's the difference between ~6¢ and
    ~25¢ an image.

**4 · Back through her LoRA, image-to-image.** Each stage-3 image is run
through her own trained LoRA — `sageryza/watercolordrawings`, trigger `wtr` —
as an **image-to-image** pass, "so it gets to be my actual style". Her memo
floats making about **four each** (different seeds, or four outputs) and
picking.

**5 · Animation.** Cheap **480p drafts** first, just to see how the action
works, then better drafts with **Wan** (probably) or Kling. The pair-animation
formula (literal panel → metaphorical panel, animate between them) is in
`sophies-movie-pipeline.md`.

## Stage 1: the prompt (tested 2026-08-11)

Two wordings were run at `low`, `1024x1536`, gpt-image-2 generations endpoint,
no reference images. Both produced four clean quadrants and no text. **The grid
wording is the one to keep** — it says "quadrant", which is what the cut needs,
and it doesn't use the word "numbered", which invites labels:

```
A 2x2 grid of four separate illustrations on one sheet: four equal quadrants
of exactly the same size, separated by thin straight white gutters, filling
the whole image edge to edge with no outer border and no margin.

Top left: <beat 1>.
Top right: <beat 2>.
Bottom left: <beat 3>.
Bottom right: <beat 4>.

Each quadrant is its own complete scene, composed as a tall portrait picture.
Keep the same two characters looking identical in every quadrant they appear
in. Absolutely no text, no words, no letters, no numbers, no captions, no
panel labels, no page numbers.
```

What the test settled:

- **The cut is blind-sliceable.** Measured on the two sheets, the dividers
  landed at x=510 and x=512 against an exact half of 512, and y=767 and y=768
  against 768 — so a flat 50/50 `sharp.extract` gives the four panels with no
  detection needed. Trim ~6px off the inner edges to lose the gutter sliver.
- **A 4-up sheet makes the pair formula MORE exact, not less.** Both panels of
  a literal→metaphorical pair are drawn in the same pass, so "same people, same
  conversation, only the background transformed" comes out matched — same
  poses, same hands, same faces — instead of being negotiated across two
  separate calls. Put each pair side by side in the same ROW.
- **A stage-1 sheet renders photoreal, not illustrated**, because nothing in
  the prompt asks for a style. That is correct for a blocking pass (stage 3
  restyles everything), and it makes the panels good *photographic* references
  to hand to the style pass.
- Cost and time: one low sheet is ~2¢ and took **21-24 seconds** for four
  beats, against roughly 4× that as separate images.

## Stage 2: the character card (tested 2026-08-11)

Her rule works as written, and the card is best built FROM a stage-1 panel —
the person already exists there, so the card is a re-pose, not an invention.
gpt-image-2 **edits**, `1024x1536`, quality `medium`, the panel attached:

```
Use the attached image only as a reference for WHO this person is — her face,
hair, build and clothing. Draw her again as a character reference card: a
single front view, facing the viewer straight on, standing, full figure head
to feet, arms relaxed at her sides, slightly smiling, neutral even lighting,
plain flat empty background, nothing else in the frame. One view only — do not
draw a turnaround, multiple angles, side views, or several poses. No props.
Absolutely no text, no words, no letters, no numbers, no labels.
```

Saying **"one view only — no turnaround, no multiple angles"** out loud is the
load-bearing part: "character reference card" on its own is exactly the phrase
that makes an image model draw a model sheet with four angles, which is the
thing she doesn't want.

Two versions of the card were made and are in the Assets tab — a plain one, and
the same card run through `refs/sage-sandy-mirror.png` so the card is already
in the target style. **Which one is the real card is Sophie's call** (see the
open questions).

## What already exists

- Stage 3 is a solved recipe — `docs/evan-film-style.md`, gpt-image-2 edits,
  `1024x1536`, style ref attached, no style prose.
- The style and character reference files are in `refs/` (`sage-sandy-mirror.png`,
  `sophie-book.png`, `evan-character.png`).
- Stage 5's models are wired in `movies.js` (`VIDEO_MODELS`: `wan-2.2-i2v-fast`
  at 480p for drafts, `kling-v2.1` for quality), including `last_image`
  conditioning, which is what animates BETWEEN two panels of a pair.
- The voiceover half is settled — `docs/nde-precise-cutting.md` and the
  `sophie-audio` skill.

## What doesn't exist yet

- **Stage 1 has no prompt on file.** Being established now.
- **Stage 4 cannot be run by any current route.** `/api/generate/replicate` in
  `server.js` is text-to-image only: it never passes an `image` input, and it
  hard-codes `aspect_ratio: '1:1'`. (`prompt_strength: 0.8` is already in the
  body, but it only does anything when an image is supplied.) Running the LoRA
  image-to-image needs that route to accept an input image and a portrait
  aspect ratio — a small change, not yet made.
- **Nothing cuts a 4-panel sheet into panels yet.** `sharp` is already a
  dependency, so the cut is a few lines; there is just no route for it.
- No orchestration end to end — every stage above is a separate manual step
  today.

## Open questions for Sophie

1. **Four panels, or four versions?** Her chat message says stage 1 is four
   panels in one image to cut cost; the memo's "four each" is at the LoRA
   stage, different seeds, pick the best. Reading both as true: cheap 4-up
   sheets at the start, four LoRA versions at the end. Confirm.
2. **Stage-3 quality: high (memo) or medium (the settled Evan finding)?**
3. **Which character card is the real one** — the plain one, or the same card
   already run through sage sandy mirror? A styled card agrees with the style
   pass; a plain one keeps the character and the style as separate decisions.
   Both are filed in the Assets tab as A and B.
4. **The character card's crop** — full figure (what was tested), or
   head-and-shoulders? "Front view, slightly smiling" fixes the pose and the
   expression, not the crop.

## Verbatim transcript (memo `2026-08-10_2207`, "AI Image Pipeline Concept")

> Theoretically, the pipeline would be like, take a voice recording, have an AI
> chat, translate it into a bunch of images, and cut each one, and then just put
> the content prompt first so I can read it. Then, I don't know, I guess maybe
> two things at once. Story shape, so I add it into the story shape, or they do,
> and I fix it, or, and or, I like leave comments about the pictures themselves,
> or maybe I just start over and describe the pictures, and then the pipeline is
> like, okay, we get a character, or like, all the characters, main characters,
> etc., and then we feed that into the watercolor, sandy sage mirror reference
> thing, and then, and I still might try the contact, or the analogy approach,
> like the one in the last one, but, okay, but then, it goes like, image to
> image, once we get all those done, then we go image to image, I wonder if we
> could go image to image from, do we have to go to medium, there's three, three
> volumes, we could possibly do it from quarter, or low, or medium, probably
> medium, maybe high, anyway, we'll have to experiment with that, so we'll try
> it with high, okay, fine, let's just say high, for the real pipeline, and then
> it gets fed back into my Lora, image to image, for each one, so it gets to be
> my actual style, and we've probably done some 480p drafts so far, just to,
> like, see how the action will work, but, anyway, then we do some more drafts,
> with lawn, or cling, or sea ants, whatever, probably lawn, and then, we take
> the high image to images, maybe probably make, like, four each, maybe, I don't
> know, different seeds, and then, or just output four, and then, finally
> animate.

("lawn" is Wan, "cling" is Kling, "sea ants" is the transcriber giving up.)
