# The image pipeline — six stops, a lap, and the bank at the end

The picture tools were built one at a time — a playground here, a freeform
surface there, a vector room, a movie factory — and nobody ever wrote down the
road a picture actually walks. This is that road, and the thesis the whole
thing is built on, which is Sophie's (Aug 2026):

> **The prompt is the treasure. The image is a throwaway asset** — more useful
> for gathering information about what we want and conceptualizing it than for
> using as part of the finished piece. And at least the content part can be
> used in multiple styles: if we change direction and want to redo everything
> in a different style, we still have the prompt and can build it up again.

**The map** is `docs/image-pipeline-map.html`, posted into the Chats app as a
Compare page (`image-pipeline-design-018edr` chat, sheet `image-pipeline-s7` —
the sheet name carries the shape of the item set, so a rebuild can't silently
re-point her saved notes). It is the third sibling on the blush board: the
content pipeline's S-curve (`s-curve-content-pipeline`, v8) drew the image
work as four abbreviated stops — WINDOW (panels on low, 2¢) / WOODEN (medium,
6¢) / GOLD (high, 25¢) / WTR WASH — and this map explodes those into the whole
road they abbreviate, exactly the way the audio map exploded CUTTING BLOCKS /
SLICE IN / POLISH into ten. Same board, same road language, same already-paid-
for cut-out drawings. **Keep the family looking like one thing: if the road
changes there, change it here.**

(This file and its map REPLACE an earlier image-pipeline doc + map wholesale —
Sophie asked for a from-scratch restart on 2026-08-15, explicitly without
reading the old attempt, so nothing here inherits from it. The old files are
in git history; `docs/pipeline-walkthrough.json` is the old attempt's data
file, left in place untouched.)

## The walker is the prompt

In the audio pipeline the recording already holds everything, and every stop
takes something away. This road is its mirror. It starts with nothing but
words, and the thing that walks it is the PROMPT — the images it leaves behind
are footprints: worth reading, not worth keeping. Three consequences, all of
them already house law somewhere:

- **Probe on doubt, spend on certainty.** Every question about an idea gets
  asked at the cheapest quality that can answer it — low, four to a sheet,
  **half a cent a frame**. Money only flows where the words have already
  earned it.
- **The content half is style-portable.** The style half is a wrapper (a LoRA
  trigger, a ref-image preamble, a house prefix); the content half describes
  what is IN the picture and survives any change of wardrobe. That is the
  insurance policy: a settled content prompt can rebuild its picture in a new
  style for pennies, years later.
- **The prompt guarantees the idea, never the pixels.** gpt-image-2 never
  draws the same picture twice — it is why the Playground dedupes Replicate
  re-runs (fixed seed, deterministic) and never ChatGPT ones. So what the bank
  insures is the idea; a beloved rendering is one draw of it, kept as a cache.

- **DESCRIBE THE ACTION, NEVER THE LOOK (Sophie, 2026-08-20, from the dream
  feed: "a prompt that mostly describes the action and doesn't really describe
  what it looks like, that way the app can make it up itself and doesn't
  micromanage").** The content half says what HAPPENS; every adjective about
  how a thing appears is a decision taken away from the model, and taken
  badly, because a sentence is a worse specification of a picture than a
  picture is. Her yardstick is the monkey dream, 343 characters of pure
  predicament with not one word about colour, light or composition — and it
  drew clean where a 5,372-character transcript of the same shape collapsed
  into a collage.
  - **This is not the same as being SHORT.** A long prompt that is all action
    still works; a short one that specifies the palette still micromanages.
    Length matters for a different, measured reason (below) — the two rules
    just happen to point the same way.
  - **The measured band:** raw transcript as `[content]` draws ONE image up to
    ~1,000 chars and fails above it (six lengths, one run each, dream feed,
    2026-08-19). So the working move on a long source is not a cleverer
    instruction to the model — it is a WRITER picking the one situation and
    handing over ~300 characters of it.
  - Worked examples: `docs/dream-prompts/action-only-v1.json` — all 19 dreams
    in the feed distilled to that shape, with the rules used and which two
    needed nothing because the dreamer had already told them that way.

- **WRITE IT SHORT — a few clear sentences, not a paragraph of specification
  (2026-08-21).** Nothing says a long prompt gets a worse picture; what is
  established is that a long one buys you nothing and costs you the ability to
  fix it. OpenAI's own gpt-image-2 prompting guide is explicit that minimal
  prompts, paragraphs, tag lists and JSON-ish structures all work equally well
  when the intent is clear, that clarity beats length ("soft natural light
  from a window on the left" over "beautiful lighting"), and that long prompts
  are simply harder to debug — the way through a bad draw is a clean base
  prompt plus one small change at a time, which a paragraph of stacked
  qualifiers makes impossible. Prompt length is tied to NOTHING on the API
  side: not the quality tier, not fidelity, not price.
  - **The blog number going round is unsourced.** "Prompts under 200
    characters score highest, correlation −0.07" is quoted across several
    gpt-image-2 prompt guides; chased 2026-08-21, no paper or benchmark behind
    it could be found. Don't repeat it as a fact, and don't build a rule on it.
  - **Her own images cannot settle it, and that is worth knowing before
    someone re-measures (2026-08-21).** All 379 chats swept: 2,714 captioned
    gpt-image-2 images, 298 carrying BOTH an exact filed prompt and a ♥/✕. The
    aggregate looks like longer wins (liked median 230 chars vs disliked 19)
    and is an artifact of one chat — `character-sheet-portraits`, 130 votes
    all sitting on ~18-char prompts. Compared WITHIN a chat, where the batch is
    otherwise alike, only six chats have enough of both votes and any real
    length spread, and four of the six have the DISLIKED prompts slightly
    longer (335 vs 452, 478 vs 545, 75 vs 89, 160 vs 175) — noise at n=7–27.
    The reason is structural: inside one batch her prompts are near-constant
    length, so a ♥ measures the subject and the draw, never the length. The
    experiment that would answer it is one subject, one style ref, three
    lengths (one sentence · three sentences · a paragraph), four draws each at
    low — about 6¢ — posted as a grid page for her to mark.
  - **So the target is the monkey dream, not the transcript**: ~300 characters
    of the one situation, action-only. Above ~1,000 the model stops drawing one
    image at all (the measured band above); below that the argument for brevity
    is yours, not the model's — a short prompt is one you can debug, re-style
    and re-use, and it is what the bank is actually storing.

- **NAME THE PHENOMENON — DON'T ITEMIZE IT (Sophie, 2026-08-24: "highly
  encourage short prompts that don't describe exact things — for example
  'meat raining from the ceiling' is better than 'ribs, drumsticks, etc.'").**
  A list of exact things is a checklist the model has to satisfy, and it
  satisfies it the literal way: each named object gets drawn, separately,
  laid out where it can be seen — so an inventory comes back instead of an
  event. The compact phrase names the whole happening and leaves the parts to
  the model, which is the one thing the model is better at than the sentence.
  - **It is the third handle on one rule, not a new rule.** Action-only says
    don't specify the LOOK; short says don't specify at LENGTH; this says
    don't specify the PARTS. All three are the same trade — every
    specification is a decision taken away from the model and taken worse.
  - **The test: could that word be swapped for another of its kind without
    changing the idea?** "Ribs" could be "drumsticks" and the dream is the
    same dream — so ribs was never the idea, *meat falling* was. Name the
    class, draw the instance for free.
  - **It is also the collage failure in miniature.** The measured way a long
    prompt breaks is that the model stops drawing one picture and starts
    arranging the things it was handed; an enumeration is that same
    instruction in three words, so a short prompt can micromanage too.
  - **Where her words are the prompt, they stay her words.** This is guidance
    for prompts a chat WRITES, and something to encourage when she asks for
    one — never a licence to trim a prompt she dictated. Anything you change
    or add is named word for word in the reply, exactly as ever.

And the consequence the map itself draws: **the road ends at the BANK, not at
the picture.** GOLD is the second-to-last stop. The finished picture leaves
for its project there — and the road keeps walking, because the prompt still
has somewhere to be.

## The six stops (and the lap)

1. **WORDS** — free. The content prompt gets written: subject, action,
   setting, composition — no style. Sources flow in from the left gutter the
   way they do on the other two maps: a chat, her dictation, the Story Room's
   beats. **No tool** — a chat writes this in conversation today, which is
   fine; what is missing is only what the TREASURY needs later (see the
   holes).
2. **WINDOW** — Sophie's own name for it, from the parent map, and her spec
   verbatim: the cheapest option, **a low-quality sheet cut into four frames,
   so each frame is literally half a cent.** One 2¢ generation, four separate
   ideas — or four tellings of one idea. The question a frame answers: *does
   it read?* Most frames die here, and that is the point — a dead half-cent
   frame that kills a bad composition is the best money on the road.
   Partially built: the **vector room** does exactly this (describe 1–25
   drawings → one sheet → cut into cells, low/medium/high accepted, re-cutting
   free) but welds it to the pastel house style and the tracer. A
   content-probe in any other style is still hand-run.
3. **THE LAP: WINDOW ⇄ RED WORDS.** The road's only loop, and the reason
   this pipeline is the only one of the three with one. A probe comes back,
   the words change, the window runs again — around and around until the idea
   reads. **RED WORDS** is the reword pass drawn as its own place: which words
   changed between v1 and v3 is knowledge, and the Writing Room already marks
   every changed word red for the dating book's prose. Nothing does it for
   prompts — the one text where a single word measurably moves the output.
   Each lap costs 2¢ and should leave a lesson behind it.
4. **WARDROBE** — the settled content prompt tries on styles: WTR, ChatGPT
   (sage sandy mirror), Pastel, Scarry, Hoonie — **2¢ a fitting** on low, in
   the Playground. The content half never changes; only the hanger does. This
   stop is where portability pays for itself, and it is also the door BACK
   into the whole wardrobe later: a banked prompt can walk in here in 2031
   wearing a style that doesn't exist yet.
5. **WOODEN** — **medium, 6¢.** The chosen telling in the chosen style,
   rendered properly. For plenty of real work (the NDE watercolours run
   medium) this IS the keeper and GOLD never fires.
6. **GOLD** — **high, 25¢.** The keeper, and the only expensive call on the
   entire road. The picture leaves for its project here — the Story Room, a
   zine, a deck, a film — drawn on the map as the out-arrow into the left
   gutter. The road walks on without it.
7. **TREASURY** — free, forever. The prompt banked: content half, style half,
   attached refs, size, quality — the full rebuild recipe. Today this exists
   only as the per-image prompt split on a chat's Assets tab, which is the
   treasure stored ON the throwaway (see the holes).

**A full walk costs about 41¢**: 2¢ × two or three laps of the window, three
2¢ fittings, 6¢ wooden, 25¢ gold. Everything before GOLD is ~16¢ — the whole
exploration costs less than the one keeper render. And a walk that stops at
WOODEN — most of them — is ~22¢ end to end.

## The diff — what you can do, and which surface has it

From the repo's own measured record (CLAUDE.md and the module docs; the
caption numbers were measured Aug 2026 across all 171 chats):

- **Send her words verbatim, nothing added** — Freeform (stores `promptSent`
  on every run so anyone can verify nothing was added).
- **Draw four ideas on one cheap sheet, cut into frames** — the vector room
  only, and only in pastel, welded to the tracer.
- **The quality ladder on one prompt** — the Playground (the pyramid:
  low · low · medium).
- **One content prompt across the five house styles** — the Playground, one
  style per run; five runs by hand. Nothing sends the same content through
  the whole rack.
- **Attach one of her pages as a pure style reference** — Freeform (a
  reference LIBRARY, not per-run uploads), the Playground's fixed recipes,
  the movies' style refs.
- **Attach a character card** — the movies' character anchor, the
  Playground/pad character line.
- **Keep every version, nothing overwritten** — the Assets tab ("…v1 —
  superseded" labels), the Playground feed.
- **See which words changed between two versions** — the Writing Room, for
  dating-book prose only. For prompts: nothing.
- **File the exact prompt with its picture** — the Assets prompt split
  (style/content halves), per image, per chat.
- **Find a prompt again months later** — the Assets search, within one chat's
  tab. Across chats: nothing.
- **Know model · quality forever** — the tile caption, when it was filed at
  make-time. 1,938 of 2,488 images have none, and only 31 were ever honestly
  recoverable — the caption cannot be backfilled.
- **Rebuild a body of work in a new style** — nothing has it as an action.
  Today it is archaeology.
- **Draw the same picture twice** — the Replicate styles (fixed seed).
  gpt-image-2: never, by nature.

## The three structural holes

None of these is a missing button:

- **The road's own front door has no general tool.** WINDOW — the stop the
  whole philosophy leans on — is hand-run by chats: nothing takes four content
  lines, makes one low sheet, cuts it, and files the frames labeled with
  their prompts. The vector room owns the sheet-and-cut machinery but welds
  it to pastel + tracing; the Playground owns the styles but is one image per
  run by design. The pieces exist; the door doesn't.
- **The treasure is stored on the throwaway.** A prompt lives on the asset
  record of the image it made, in the chat that made it — findable only
  through the picture, and only 1,168 of 2,488 pictures carry one at all.
  There is no shelf of content prompts as things in their own right, across
  chats, independent of any image. Until there is, "the prompt is the
  treasure" is a philosophy the storage model quietly disagrees with — and
  the style-change insurance can't actually be claimed.
- **No lineage between versions.** A re-roll files as a new image and the old
  one stays — good — but nothing records which prompt begat which, or which
  WORDS changed between rounds, so each lap's lesson evaporates when the chat
  that ran it goes to sleep. The Writing Room's red-marked-words treatment,
  pointed at prompts, is the whole feature.

## The first thing the pipeline probed was itself

Run 2026-08-15, as the worked example — Sophie chose the window icon "cause
it shows four things" but said she'd probably use a different one, so the
first window run probed four candidate emblems for the pipeline itself. One
vector-room sheet, quality **low**, palette pastel, **2¢ total, ½¢ a frame**
(job `sh-msuszrgy-6h29r`; the exact prompt is on each frame's PROMPT overlay
in the Assets tab, filed character-for-character):

- **the seed tray** — four cells, two sprouting: you plant four cheap and pot
  on what germinates. TOP LEFT.
- **the die on four** — every generation is a roll; the prompt is how you
  load the dice. TOP RIGHT.
- **the instant photos** — four polaroids fanned: the test shot before the
  real film, which is this pipeline's whole philosophy. BOTTOM LEFT.
- **the palette** — four wells: dip before you commit to the canvas.
  BOTTOM RIGHT.

What the run taught, beyond the pictures: the house grid held at LOW — clean
gutters, no bleed, all four legible — so half-cent frames are genuinely
usable probes, not a false economy. And the vector room cut AND traced all
four to transparent cut-outs for free after the 2¢, which means an icon she
hearts is already in the family's cut-out format, one recolor away from
sitting on the map.

## Editing the map's geometry?

The board is the family's: 440 wide, `CX = 270` (the widened left gutter is
the lane everything off-road needs), `A = 140`, `R = 22`. Six stops need less
height than audio's ten, so `B = 40` and the viewBox is 495 tall. The road
extremes land on fractions 0.2 / 0.4 / 0.6 / 0.8 of the path; 0.4 and 0.8 are
the LEFT extremes with the wide gutter beside them, which is why **WINDOW is
pinned to 0.40** (the lap needs the gutter for RED WORDS) and **GOLD to 0.80**
(the out-arrow needs it for the destinations). Do not re-derive the arc sweep
flags — moving the start alone leaves the bowls curling the old way and the S
comes out backwards. Stops: WORDS 0.01 · WINDOW 0.40 · WARDROBE 0.60 ·
WOODEN 0.73 · GOLD 0.80 · TREASURY 0.99.
