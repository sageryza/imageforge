# The image pipeline — voice recording → her own style → animation

How Sophie's concept films get made: what the pictures ARE, and the stages they
pass through. Built from five of her own recordings (listed at the bottom, with
verbatim transcripts) plus the prompt tests that have actually been run.

She named the job herself, in the 2026-08-02 morning memo: *"Oh man, I can
write this in a whole doc for AI to follow. Maybe. That would be really cool."*
and *"maybe the reason is because I need to like spell everything out because
otherwise they fuck it up, you know? So it's like make a formula for it."* This
is that doc.

**Status: being established.** The stage-1 and stage-2 prompts are tested; the
LoRA image-to-image pass has no route yet. Nothing here is settled beyond what
says it was measured — check with Sophie before treating a number as final.

---

# Part one — what the images are

The stages are the easy half. This half is the point, and it's the half a chat
will get wrong if it just follows the steps.

## The goal

> The goal is to basically force the viewer to imagine the concept I'm
> describing or sharing. So first think about how someone might model that
> concept in their mind.

Not to illustrate what she said. To build the picture that's already forming in
the listener's head, so they think it themselves.

## The formula: literal, then metaphorical, and animate between them

Her best formula, "not an exact science because each one will be different":

1. **What is literally happening**, realistic.
2. **The emotional / metaphorical / dream-sequence take on the same moment** —
   same people, same conversation, same poses. Only the context transforms.

Her example: a car ride where she starts feeling like she and the passenger are
in their own little world. Image one is a realistic car. Image two is the same
car drifting into outer space, *with the people still talking inside it*.

**The animation between the two panels is what makes it legal.** Her words:
*"When we animate between the two panels, this will behave as though it is
commonplace. It will seem normal that the two images are next to each other
because we will animate between them."* And later, working out why the formula
holds at all: *"you go back and forth and it works because you're animating
everything."*

So the pair is the unit of the film, not the single image. A metaphorical panel
with no literal panel to leave from is a non-sequitur; the animated transit is
what earns it.

## Go back, too — the loop

From the pizza example: you see the sky; someone takes a nice slice of pizza out
of it; *"and then it turns back into the sky and maybe the pepperoni is like
planets."* The metaphor isn't a destination. It opens, and it closes back onto
the literal thing, changed.

## Establish the noun before you modify it

Her first-principles note, which is a composition rule in disguise:

> the way that a verb and a noun, like English gets it wrong … it's not like
> the wild horse. It should be like the horse that is wild because you need the
> noun so you can modify it, right? So you need the planets, you need to know
> the planets exist before you can like start modifying them, right? You start
> with the thing.

Draw the thing plainly first. The transformation lands only on something the
viewer has already accepted as real. This is the same claim as "literal panel
first", arrived at from a different direction — which is why it's load-bearing
rather than decorative.

## And simplify

> this also goes into like the meta learning lesson, which is like that things
> need to be simplified.

## How she picks a metaphor — the metaphor machine

Her own model of the thinking (2026-07-28). Raw material — things people say,
books, art pieces, moments — goes in; the machine *"discards the physical
aspect of them, and what's left is the abstraction that was inside. It has sort
of the same relationship that a soul has to a body."*

Two ways a run of metaphors can describe one thing, and they are different
tools:

- **The set** — every metaphor shares the SAME quality with the subject.
  *"a cherry because it's red, and then a sun because it's hot"*; a tea set,
  where each piece is different but they all carry the little flowers.
- **The kit** — the pieces have nothing in common with each other, only a
  common PURPOSE. A first-aid kit: band-aids and the little knee hammer share
  nothing except healing you.

And the **evolving metaphor critique**: rather than judging a thing good or
bad, you say it's like this — no, it's like this — no, like this. Either the
metaphors close in on the thing, or each one contributes the quality it shares
with it.

For image work this is a generator, not philosophy: to find panel two, name
what the moment shares with something physical, and draw the something.

## Two-panel before/after, and the cheap hook

From 2026-08-07, and this is where the four-panels-at-low idea comes from:

> I like the before and after two panel thing, I don't know if it actually
> makes sense, but I like it. And I like trying everything out, maybe even like
> four panels at low just to like have an output and like something sticky that
> I can look at, like a hook, to see if I want to keep going.

The cheap sheet is not only a cost trick. It's a **hook** — something sticky to
look at that tells her whether the idea is worth continuing. Which means stage 1
should be fast and disposable, and should never be presented as if it were the
work.

Also from that recording, both open: sorting concepts into *"things that people
would understand normally"* and *"things that you might not understand"*, and a
**wild card** — asking for five, one of them a wild card, five times, and
keeping the wild cards, because otherwise the model *"comes up with like a
little pattern, and then it falls as it never really gets at the heart of it."*
Her rule of thumb for that: *"try to use the weights, not the reasoning, because
it's not good at reasoning. It's good at weights."*

---

# Part two — the route

**0 · Voice recording → beats.** She records the concept. An AI chat reads the
recording and turns it into image descriptions. Her hand-off rule: **put the
content prompt FIRST so she can read it** — words above the picture. From
there, either the beats go into the story shape (hers or the chat's, then she
fixes it), or she leaves comments on the pictures, or she starts over and
describes them herself.

**1 · Cheap draft sheets — FOUR PANELS IN ONE IMAGE, at low.** Four beats drawn
as a 2x2 sheet in a single call, then **cut** into four pictures. One API call
instead of four, and a hook she can look at.

  - A `1024x1536` sheet cut 2x2 gives four `512x768` panels — **each already
    2:3 portrait**, the aspect the whole pipeline runs in. No cropping anywhere.
  - Resolution doesn't matter here; every panel is re-rendered at stage 3. A
    stage-1 panel is a composition, not a picture.
  - **Put each literal→metaphorical pair side by side in the same ROW** (see
    the finding under the prompt below).

**2 · Characters and settings — ONE view each, made in her own style.** Before
any scene art, the recurring things are drawn once and reused as references.
Two rules, from two different recordings:

  - **One view only, front, slightly smiling** (2026-08-11). Not a turnaround,
    not a model sheet.
  - **Make them in the Replicate watercolour LoRA, four at a time** (2026-08-02)
    — *"make the characters in the replicate watercolor thing for my style …
    make like four of them because they're so cheap and then look at them okay
    I like this one describe it maybe change it once and then maybe change the
    clothes and then okay now I use that as a character."* This is also where
    the LoRA earns its keep: *"it means that there was some reason to use
    replicate."*
  - **Settings get the same treatment** — *"okay make the house like that"* —
    and then the trick: *"you can even put them all in the same sheet, this is
    the house, this is the person, blah blah blah, so it's just one image
    reference."* One combined sheet per story instead of juggling several
    attachments per call.

**3 · The watercolour pass.** Each panel is redrawn through gpt-image-2's
**edits** endpoint with `refs/sage-sandy-mirror.png` (her scanned
ink-and-watercolour page) as the style reference, plus the character/setting
sheet for whatever is in the shot.

  - The recipe is the settled Evan one — **write NO style description**, just
    "use the attached image as a style reference, only its style, not its
    content; you do not have to copy its colors", then the scene. See
    `docs/evan-film-style.md`. Every written style block tested made it worse.
  - **Quality: her memo lands on `high` for the real pipeline**, while the Evan
    tests chose `medium` (high smooths the washes and reads more finished, less
    sketchbook). ~6¢ vs ~25¢ an image. Unresolved — see the open questions.

**4 · Back through her LoRA, image-to-image.** Each stage-3 image goes through
`sageryza/watercolordrawings` (trigger `wtr`) as an image-to-image pass, *"so it
gets to be my actual style"* — about **four each**, different seeds, and she
picks. She had circled this before and talked herself out of it once
(2026-08-07: *"trying image to image with the WTR … I sort of dismissed that for
some reason. Maybe because it just sounded like a hassle"*), and WTR is the
style she found already worked for the Sophie experiment.

**5 · Animation.** Cheap **480p drafts** first, *"just to like see how the
action will work"*, then better drafts with **Wan** (probably) or Kling. The
pair transit is the shot: `last_image` conditioning animates from the literal
panel to the metaphorical one.

**The voiceover half** runs alongside and is already settled — align the real
words to their timestamps via `docs/nde-precise-cutting.md` and the
`sophie-audio` skill, *"otherwise it'll get wonky."*

---

# Part three — the prompts that have been run

## Stage 1 (tested 2026-08-11)

Two wordings at `low`, `1024x1536`, gpt-image-2 generations, no reference
images. Both gave four clean quadrants and no text. **Keep the grid wording** —
it says "quadrant", which is what the cut needs, and avoids the word "numbered",
which invites labels:

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

- **The cut is blind-sliceable.** Measured on both sheets: dividers at x=510 and
  x=512 against an exact half of 512, y=767 and y=768 against 768. A flat 50/50
  `sharp.extract` gives the four panels, no detection. Trim ~6px off the inner
  edges to lose the gutter sliver.
- **A 4-up sheet makes the pair formula MORE exact.** Both panels of a pair are
  drawn in one pass, so "same people, same conversation, background transformed"
  comes out matched — same poses, same hands, same faces — instead of being
  negotiated across two calls. This is a real argument for the sheet beyond
  cost, and it's why pairs go side by side in a row.
- **Stage-1 sheets render photoreal**, because nothing asks for a style. Correct
  for a blocking pass, and it makes the panels good photographic references for
  the style pass.
- ~2¢ a sheet, **21-24 seconds** for four beats.

## Stage 2, the character card (tested 2026-08-11)

Built FROM a stage-1 panel — the person already exists there, so the card is a
re-pose, not an invention. gpt-image-2 **edits**, `1024x1536`, quality `medium`:

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
load-bearing part: "character reference card" alone is the exact phrase that
makes a model draw four angles.

**This is not yet the LoRA route she described.** Two versions are filed in the
Assets tab (plain, and the same card through sage sandy mirror), both made with
gpt-image-2. Her 2026-08-02 recording asks for the characters to be made in the
**Replicate watercolour LoRA, four at a time**, which no test has run yet —
`REPLICATE_API_TOKEN` isn't available to a chat session, only to the server.

---

# What exists, and what doesn't

Exists:

- Stage 3's recipe — `docs/evan-film-style.md`.
- The reference files in `refs/` (`sage-sandy-mirror.png`, `sophie-book.png`,
  `evan-character.png`).
- Stage 5's models in `movies.js` (`VIDEO_MODELS`: `wan-2.2-i2v-fast` at 480p
  for drafts, `kling-v2.1` for quality) including `last_image` conditioning.
- The voiceover half.

Doesn't:

- **No route can run stage 4.** `/api/generate/replicate` in `server.js` is
  text-to-image only: it never passes an `image` input and hard-codes
  `aspect_ratio: '1:1'`. (`prompt_strength: 0.8` is already in the body but does
  nothing without an image.) Needs an input-image passthrough and a portrait
  aspect ratio — small, not yet made.
- **Nothing cuts a sheet into panels.** `sharp` is already a dependency; there's
  just no route.
- **No combined character/setting reference sheet** (the "this is the house,
  this is the person" one image).
- No orchestration — every stage is a separate manual step today.

# Open questions for Sophie

1. **Where do characters get made** — the Replicate LoRA four-at-a-time route
   from the 2026-08-02 memo, or the gpt-image-2 cards already filed? The memo
   says LoRA; the cards were the fast thing to test.
2. **Stage-3 quality: high (her memo) or medium (the Evan finding)?**
   6¢ vs 25¢ an image.
3. **Confirm the two "fours" are different things** — four panels in one image
   at the start to cut cost, four versions with different seeds at the LoRA end.
4. **The character card's crop** — full figure (tested), or head-and-shoulders?

# The recordings this is built from

- **2026-07-28_2146 · "The Metaphor Machine Concept"** (5:25) — how she thinks
  about metaphor; set vs kit; the evolving metaphor critique.
- **2026-08-01_1919 · "Pipeline Concept Development"** (5:11) — the two halves,
  the literal→metaphorical formula, the car/outer-space example, animate
  between. Also transcribed verbatim in `sophies-movie-pipeline.md`.
- **2026-08-02_1244 · "Character Design Pipeline Concept"** (2:14) — characters
  and settings made in the Replicate LoRA, four at a time, combined onto one
  reference sheet.
- **2026-08-02_1247 · "Morning Creative Ideas"** (6:30) — pizza slices and the
  sky, going back and forth, establish the noun before modifying it, simplify,
  and the idea of writing this document.
- **2026-08-07_1614 · "Acupuncture Inspired Creative Concepts"** (3:45) — the
  before/after two-panel thing, four panels at low as a hook, the wild card,
  weights not reasoning, WTR image-to-image.
- **2026-08-10_2207 · "AI Image Pipeline Concept"** (2:48) — the stage order end
  to end. Verbatim below.

Note on dates: these stamps are when each recording was SHARED, not when it was
made — iOS rewrites an m4a's internal clock on every export, so a memo filed
from the share sheet is dated at share time. `scripts/push-memos.mjs` heals them
from the Voice Memos database on its next run (see `unstampedRecords`).

## Verbatim — 2026-08-10_2207, "AI Image Pipeline Concept"

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

## Verbatim — 2026-08-02_1244, "Character Design Pipeline Concept"

> um now i'm thinking of a new pipeline and it would be kind of like make the
> characters in the replicate watercolor thing for my style like each time
> there's a new character okay make it in there make like four of them because
> they're so cheap and then look at them okay i like this one describe it maybe
> change it once and then maybe change the clothes and then okay now i use that
> as a character okay make the house like that then you can even put them all in
> the same sheet this is the house this is the person blah blah blah so it's just
> one image reference um and i could even make the image references with that so
> that changes a lot of stuff in a certain way and actually it means that there
> was some reason to use replicate and i could use the hoonie style to make
> references to make maybe to make the xi cards with chat gpt okay that's a good
> idea okay i just like it because it extends the pipeline it makes it really
> long i kind of want to draw it out now it's like one two three four five six
> seven eight so
