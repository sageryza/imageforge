# The Sophie Experiment — dating book project brief

> Canonical vision for Sophie's dating memoir. Distilled from her own planning
> docs and prior Claude chats (Feb 2026 "Sophie Experiment" sessions) plus the
> July 2026 design sessions. **If you are a Claude session helping Sophie with
> anything "dating book" related, read this first.** It is the source of truth
> for structure, illustration style, essays, infographics, and tone.

## What it is
A square (6×6 or 8×8 in) coffee-table book about ~50 online dates Sophie went on
during her Portland period. Working title:

> **THE SOPHIE EXPERIMENT**
> *50 Dates. 50 Watercolors. 150 Things I Remember.*

Framing conceit: a mock-scientific "experiment" — she approached dating as a
blank slate with rules. Deadpan, wry, literary, frank, self-aware, a little
melancholy. The humor is dry; the data is "useless but funny — that's the point."

(Placeholder title **"Someone I Met Once"** was floated in July 2026 and Sophie
liked it; the canonical working title is still *The Sophie Experiment*. Title is
an open choice — see OPEN-QUESTIONS.)

## Source material
- Raw date journals live in **Notion**: pages **"date book (pdx)"** and
  **"date book pdx part 2"** (~41 dates in part 1: Griffin, Jon, Pratfaller,
  Sean, Matt, Kyle, Jake, Blake, David, Louis, Robin, … Trevor, Gabriel, Jasper,
  Tyler, Jacob, Andrew, Adam, etc.). Some names repeat; some entries are
  multi-person. Chronological; Date 1 = the Cuddle Convention (her birthday).
- Voice rule: **use Sophie's ACTUAL words, trimmed.** Edit down (cut logistics,
  repetition, tangents); do NOT paraphrase into new wording. She confirmed she
  prefers her real sentences lightly stitched over AI-condensed prose.

## Book structure (from her book_skeleton_outline)
**Front matter:** Title Page · "The Sophie Protocol" introduction (becoming a
blank slate, the rules of the experiment) · Hypothesis Page (what she expected).

**The dates (chronological):** each date gets a spread. Essays woven in at
natural breaks. Infographics every 5–10 dates as palette cleansers.

**Back matter:** Conclusion / Data Summary (what she learned, or didn't) · final
infographic spread · Acknowledgments / About the Artist.

**Optional chapter openers** grouping dates into acts ("Early Days", "The
Middle", "Late Stage").

### Page types
- **DATE SPREAD (nominally 2 pages; in practice 1–3 by length).** Her original
  spread = LEFT page a **watercolor portrait / hero scene** + name & number;
  RIGHT page **three small drawings** of remembered details + brief text.
  Longer dates (Trevor, Jake, Griffin, Gabriel) run 3 pages; short ones (David,
  Louis) 1. Each date also carries a **metadata line** (month · venue → venue ·
  duration, e.g. "MARCH 2024 · COFFEE → HIS APARTMENT · 4 HRS") and often a
  **scene timeline** and/or a **bespoke infographic**.
- **ESSAY PAGE (1–2 pages).** Thematic; placed after a relevant date.
- **INFOGRAPHIC PAGE (1 page, can be a spread).** Playful data viz.

## Illustrations — TWO types, one model
All art uses Sophie's Replicate LoRA **`sageryza/watercolordrawings`**
(version `a6749d940388a669f79efc36018b93436568ca6a6a59c57ddd87dc43fa3e6c1f`,
trigger word **`wtr`**), via ImageForge `/api/generate/replicate` (Flux dev,
lora_scale 1, 28 steps, guidance 3, 1:1). Two prompt formulas:

1. **Hero portrait / scene (the big one per date).** Atmospheric full scenes.
   Formula: **`Pen and ink illustration with watercolor washes. <scene>. Muted
   watercolor palette, delicate ink work`** (variant tail: "warm amber light,
   loose brushwork"). Bold ink linework + rich washes, light-vs-dark mood.
   *This is the richer style Sophie remembers as "working."*
2. **Small detail drawings ("moments" — the three per date).** The
   `/api/generate/moments` endpoint (system prompt in `reference/moments-v3.js`)
   turns a date's text into small concrete visual moments. Formula:
   **`Soft watercolor illustration of <one or two subjects, a clear
   arrangement>, minimal background, gentle muted palette`**. Narrator is always
   **"a petite young woman with curly brown hair."**

### ⚠️ Style lesson (July 2026 — the "we're missing something" bug)
The July draft looked pale/sparse/off because the moment prompts appended
**"lots of empty white space"**. That single phrase pushes the LoRA to a thin,
washed-out object-on-white look. **Do NOT add "lots of empty white space."**
Keep the established tail **"minimal background, gentle muted palette"**.
Removing the style words entirely is worse — the model then drifts to
photo-realism. The style lives in those modifiers + the `wtr` trigger.

## Essays (Sophie's own list & titles)
Placed between date spreads. Sophie has drafted/planned these — **replace any
placeholder essays with hers.**
- **On Fighting** — having fights on dates
- **On Sleepovers** — getting to know someone from the inside of their life
- **On Spaces** — the spaces people lived in
- **On Penpals** — people you're romantic with but never meet
- **On Mental Illness** — autism, depression, and dating
- **On Misogyny** — them talking too much (= the "men who talk too much" essay)

## Infographics — "useless but funny is the point"
Two flavors, both wanted:
- **Per-date bespoke figures** (deadpan, specific to that date's absurd
  details). Real examples she built for *Ryan* (see `reference/chart-ideas-ryan.html`):
  "Hours Spent Together vs. Incidents of Physical Contact — A Timeline" (nothing
  until one kiss at hour 22); "Tea Varieties Discussed vs. Teas She Actually
  Likes — A Venn Diagram, overlap: 0"; "Party Game Rule Complexity vs. Player
  Enjoyment — An Inverse Correlation". And *Tyler*: "Tyler's Hinge Age Preference
  vs. the Average 34-Year-Old Man" (min & max both set to 22; Tyler was 34).
- **Aggregate spreads** (her starter list): Height Said vs. Actual · First
  Message Openers (pie) · Where We Met · Who Texted Last · Red Flags Per Date ·
  **Duration of Each Date (timeline)** · Who Ended It / Who Ghosted (pie) · Pets
  Encountered (icons).

## Scene timelines (a signature element)
Per date, a horizontal **segmented bar** where each segment is a scene/location
(e.g. Griffin: BUS · CUDDLE CONVENTION · VALENTINE'S DAY DANCE · BUS · HIS HOUSE
· MORNING), segment width ∝ time, muted watercolor fills, "(ALONE)" tags when she
was by herself. Visualizes each date's arc and length. See
`reference/scene-timelines.html`. Timeline scene breakdowns per date exist in the
Feb chats (batch1–5).

## Design system
- **Type:** **EB Garamond** (body/serif) + **DM Sans** (labels, metadata lines,
  timeline/figure captions, "MEMORY 1", "A TIMELINE"-style small caps). July
  draft substituted Cormorant Garamond for display — fine, but the label/caption
  layer should be a clean sans (DM Sans) per her mockups.
- **Palette:** warm paper, muted watercolor tones, one restrained accent. No
  pills (rounded rectangles, `border-radius:6px`). Small text, generous white
  space.
- Both fonts are embeddable as data URIs (EB Garamond ttf is in
  `imageforge/ios/ImageForge/EBGaramond.ttf`; artifacts block font CDNs).

## Consistency check (Feb ↔ July)
The vision is **remarkably consistent** across all sessions. No hard
contradictions. Deltas are things the July draft under-built, not conflicts:
missing hero portraits, scene timelines, per-date infographics, DM Sans, and the
Experiment/Protocol/Hypothesis framing. See OPEN-QUESTIONS.md for the live
decisions (title, tone, hero+3 vs 3-only, page length).
