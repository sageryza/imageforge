# Dream idea (docket): the "noun annotator" for dream illustration

Sophie's own idea — she had it *inside* a dream (the "Turquoise Goblet" dream,
in the July 2026 Georgina Ave recording), where she was half-awake planning how
she'd describe the dream so it got drawn right. Captured here to build later.

## The problem it solves
When a dream is illustrated from the transcript, specific objects get flattened
into generic ones — she said "cups," but they were *small, sharp, blue-turquoise
goblets*. The illustrator only sees "cups" and draws ordinary glasses. The
nuance that makes a dream *hers* is lost.

## The idea
After the breakdown, surface the **key nouns** in the dream and let her
optionally describe each one before drawing:

- Pull the concrete nouns out of the dream (cups, net, rug, pizza, goblet…).
- For each, an **optional** description field ("cups" → "small blue turquoise
  goblets, sharp-edged"). Optional is the point — she only annotates the ones
  that matter; the rest draw fine as-is.
- **AI pre-populates** each field from detail she *already gave* in the
  recording, so she never re-describes something she already said. She can
  accept, edit, or clear it.
- The confirmed noun descriptions are then fed into the image prompts for the
  beats those nouns appear in.

## Notes for building
- Sits between the breakdown (`dreamBreakdown`) and the render
  (`makeDreamPages`) in `movies.js` — a new optional review step, alongside the
  existing "check the chronology" step in the iOS `DreamsView`.
- Pre-population = a cheap extra pass over the dream text (or fold it into the
  breakdown so nouns + any stated description come back together).
- Keep it optional and skippable so it never slows down the common case.
- Ties naturally to the character pipeline: named *people* already get locked to
  saved character cards; this does the same for the important *objects*.
