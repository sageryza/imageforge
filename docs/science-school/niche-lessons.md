# Science School — the niche pivot

Sophie's redirect (2026-08-17): instead of climbing the biology → chemistry →
physics ladder, the school goes **niche** — self-contained topics she finds
interesting. Status as of 2026-08-18:

- **Lesson text + per-card art prompts live in `niche-lessons-data.json`** —
  the one source of truth. `build-niche-page.js` renders it as the review
  Compare page in the witch-school-lesson-topics chat ("Niche lessons v1 —
  text + art prompts", page id `INtUgsUurbfGNe2U0Q1e`); the same data will
  emit the art spec JSONs once approved. The art STYLE block gets copied from
  `cell-lesson-spec.json` (pastel on white, whiten) at generation time.
- **Ten lessons are drafted, none approved, none illustrated, none wired.**
  Sophie is short on image budget — art is ~7¢ a card, 73 art cards ≈ $5.11
  total — so NOTHING generates until she gives an explicit go-ahead, per
  lesson or for the lot.
- Card counts are deliberately variable (her call: "I don't know if each one
  deserves its own lesson… give them a variable number of cards"): 6 cards
  for the small ones, 8–9 for the rich ones.

## The lessons drafted (prefixes claimed)

`tm-` Theory of Mind (v2) · `hb-` The Habsburgs · `ob-` One Big Bed ·
`dp-` The Dancing Plague · `ph-` The Pump Handle · `rg-` The Radium Girls ·
`mu-` Universe 25 · `lg-` The Longitude Prize · `am-` The Antikythera
Mechanism · `er-` Ergot in Salem?

(Existing prefixes elsewhere: `sw pm pa as dw pc tr rs dv cr tw al sh wy ap
ce sy bh` in Witch School, `cl in dn cd` in Science School.)

## Feedback that shaped v2 (2026-08-18)

- **Theory of Mind v1 "floated too slowly, too many experiments all basically
  talking about the same thing."** v2 is 9 cards, down from 12: Maxi and
  Sally-Anne merged into one card, the infant-studies card folded into a FAQ,
  the raven and ape studies merged into one "the year the animals answered"
  card. Rule to carry forward: **one experiment per beat — a second
  experiment proving the same point is a FAQ, not a card.**
- Her two cognitive-science proposals from the first round (False Memories,
  The Split Brain) were **declined** — do not re-pitch them.
- The whole "anything pile" from the first round was approved and is drafted
  above.

## What follows Theory of Mind (proposed 2026-08-18, not yet approved)

Sophie asked what concept follows theory of mind in a curriculum, plus two
more that come right after. Proposed, in teaching order:

1. **The Curse of Knowledge** — the adult sequel: grown-ups never stop
   failing false-belief tests, just more subtly. Elizabeth Newton's 1990
   tappers-and-listeners study (tappers predicted 50% of tapped songs would
   be recognized; listeners got 2.5%), hindsight bias, why experts explain
   badly. Once you know a thing, you cannot simulate not knowing it.
2. **Metacognition** — the same instrument pointed inward: the
   feeling-of-knowing, tip-of-the-tongue states, judgments of learning (and
   why they mislead students into re-reading instead of testing),
   Dunning-Kruger as a metacognition failure rather than a stupidity story.
3. **Joint Attention** — what theory of mind is FOR: the nine-month
   revolution where a baby starts following a point and checking back,
   Tomasello's argument that pointing-to-share is the human trick chimps
   almost never do, and how shared attention scaffolds language and culture.

## Format rules (carried over from lessons-1-4.md)

Same card shape, quiz cards cost no art, the After card is an OBSERVATION
(never an app feature), every lesson names the experiment with a person and a
date, voice rules per `docs/witch-school-lessons.md` (no AI-tells,
aspirational not consoling). The science school never sneers at what it
corrects.
