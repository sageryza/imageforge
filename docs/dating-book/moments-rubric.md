# Moment extraction — the rubric (per-date read of the pdx date books)

> Working doc for the moments pass over Sophie's Notion date books ("date book
> (pdx)" + "date book pdx part 2", ~41 dates). Sophie's calls, Aug 2026, from
> the portland-dates-moments chat. Read this WITH
> `docs/dating-book/THE-SOPHIE-EXPERIMENT.md` — this doc governs the moments
> pass; where the two disagree on moment ILLUSTRATION STYLE, this one is newer
> (see "Style" below).

## What one date produces (the per-date record)

1. **3 moments + 3 backups.** Each moment = one line of what happened, a
   CAPTION, and an image PROMPT (see below).
2. **A TIMELINE** — the raw events of the date in order, arrow-separated
   ("coffee house → bus → his house → pasta → …"). Extract only; illustration
   of timelines comes later. One per date.
3. **A CAPTION per moment** — **bold title** on top, *italic line* under it.
   **The register is funny — snarky or self-deprecating is welcome (Sophie,
   Aug 2026):** the line is taken out of context, so it's disconnected from
   the source and judged less — that's the opportunity. Her worked example
   for the cheese grater: *"I was starting to understand why he didn't get
   along with his roommate."* Rules of the register:
   - Her journal line verbatim WHEN it already lands (*"I was a sloth, not
     moving at all, waiting for this torture to be over"* needs nothing).
   - A punched-up or composed line is ALLOWED — but in her deadpan, wry
     voice, and flagged as composed when delivered so she can veto.
   - No Claude-isms (see `docs/witch-school-lessons.md` voice rules): no
     negation-pivot, no mic-drop closers, no profound-simplicity.
4. **STATISTICS** — gather per date, for the book's charts:
   - Standard set (collect for every date): how long the date lasted, who
     paid for what, food and drink consumed, transport, locations. Mark
     "unstated" when the journal doesn't say — never guess.
   - Weird/silly per-date stats when the date offers them (cheese graters
     used: 2; physical contact: 0). These feed the "useless but funny"
     infographics.

## What makes a good moment (Sophie's taste, her words paraphrased)

- **Object-oriented, weird, unspecific — but it tells a story with tension
  in it**, and makes a compelling image: "why is this being drawn?" (the
  cheese grater is the archetype).
- **The residue, not the plot** — the thing that stayed with her after the
  date (Tyler's steak left steaming in the pan in a vegan house; the hand
  with the cigarette she never looked at).
- **Things that didn't literally exist in the date are candidates**: a story
  told, a thing imagined by both people (the car full of cats). Her reason:
  it's two levels away from reality — imagining someone imagining it — and
  satisfying to see it really exist, makes it less amorphous.
- A caption can carry a moment whose image is only okay; if the caption is
  doing all the work, keep looking.

## Style — the prompt recipe (moments)

**Sophie's call in this chat (Aug 2026): moments render via the sage sandy
mirror reference**, i.e. the Evan/NDE recipe (`docs/nde-watercolor.md`):

- gpt-image-2 **edits**, `refs/sage-sandy-mirror.png` attached FIRST as the
  style reference
- **NO written style description** — the settled preamble, then `Draw:
  <scene>. No text or lettering anywhere.`
- Preamble (verbatim): "Use the FIRST attached image as a style reference.
  Only use its style, not its content — do not copy anything depicted in it.
  You do not have to copy its colors."
- Narrator, when she appears: "a petite young woman with curly brown hair"
- Quality/size: decided per batch with a cost estimate first; likely medium.
  Batching two moments per image is on the table (they print at 1–2 inches).

NOTE: `THE-SOPHIE-EXPERIMENT.md` still documents the WTR LoRA formula for
moments ("Soft watercolor illustration of …"). Sophie has not yet said whether
that doc should be updated — flag, don't silently rewrite it.

## Cast notes (for prompts that show the man)

- **David (the cheese grater date):** striking red hair, very pale skin,
  looked boyish ("kind of like a little boy") though 22. His height is
  unknown BY DESIGN — he'd only give it in centimeters; never put a height
  in his prompts.

## Process

- Reader: Fable, personally (her call after the David sample — "$3 to 5 is
  nothing").
- Batching: calibration first (David, then griffin solo for the new caption
  register), then batches of ~3, opening up to ~10 once a batch comes back
  without corrections. Not all-at-once — a drifted register discovered after
  40 dates means redoing 240 captions.
- Eventually: picks compiled into a Tinder-style deck (`template:'deck'`
  Compare page) for her ♥/✕ pass, then illustration in batches with a cost
  estimate (ask above $3).
