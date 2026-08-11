# Deck module — iteration 0 (2026-08-10)

Groundwork for the future "Decks" home-screen module (gpt-image-2 instead of
Midjourney). This run: market research, ten deck ideas, first grid samples.

## Shop signal (Etsy report, 180 days, pulled 2026-08-10)

The deck formula works and converts — the bottleneck is views, not product:
- Witchcraft Cards (apothecary/crystal): 48 units / $1,464, 90k views
- Apothecary reference cards: 34 units, 116k views, 11.9k favorites
- Magic of Flower Cards: 37 units at only 5.9k views → 0.63% conversion (hidden gem)
- Set of 4 bundle: 2.02% conversion on 347 views
- Magic Rituals deck: 2 units on 220 views — new, not a verdict yet

## Deck ideas (half witchy, half not)

Witchy:
1. **Candle Magic** ← PICKED for iteration 1. Color meanings, day/planet,
   dressing herbs & oils, flame omens, wax reading. Demand proven by dozens of
   best-selling *printable* candle-color charts on Etsy; almost no physical
   deck sells it. Cross-sells her ritual oils + witchcraft kits directly.
2. Kitchen Witch / Spice Cabinet — magical properties of pantry spices.
   Fits the apothecary formula; moderate competition (tarot/recipe decks
   exist, the reference-index format mostly doesn't).
3. Protection Magic — wards, amulets, thresholds, salt/iron/rowan.
4. Poison Path / Baneful Botanicals — dark botanical collector appeal,
   less saturated than general herbs.
5. Sigils & Symbols — runes, planetary seals, witch marks as reference cards.

Not witchy:
6. Cloud Spotting & Weather Lore — published decks exist (The Cloud Deck,
   Cloud Spotter) but Etsy indie space is mostly printables. Charming gift.
7. Mushroom Foraging — proven demand, fairly saturated (Wild Card Series etc.).
8. Night Sky / Constellation Myths — moderate saturation.
9. Herbal Tea — brewing + lore per herb; adjacent to her herbal index cards.
10. Backyard Birds — SATURATED (the "houseplant" of this list; skip).

Market notes: oracle is the fastest-growing divination segment (~14%/yr vs
tarot ~7%); trending themes 2026 = shadow work, lunar, ancestral, eco-mystic
botanical; nature ID flash-card decks are a real gift market.

## The style formula (iteration 1 samples)

Sent as `STYLE + " " + content`, gpt-image-2 generations endpoint, 1024x1536,
no reference images. NO text in the image — labels get overlaid in print prep,
same as the Midjourney decks.

> Antique occult grimoire plate illustration: fine hand-inked etching linework
> with muted watercolor wash on aged cream parchment, soft candlelit glow, a
> thin double-line border frame with small corner flourishes, centered single
> subject with generous margins, vintage apothecary aesthetic, muted warm
> palette with one dominant accent color. No text, no lettering, no words
> anywhere in the image.

Samples live at Storage `deck-samples/candle-magic/` (webp display copies in
`webp/`), filed in the chat `deck-factory-image-gen` Assets tab with exact
prompt splits, Compare page "Candle Magic deck — first samples v1".
Timings: low ~22s, medium ~40s, high ~106s. Costs ~2¢/6¢/25¢.

## Module sketch (not built yet — iterate with Sophie first)

Grid-first flow like Midjourney's 2x2: type/pick a card subject → 4 draws at
a chosen quality → heart the keeper → next card. Per-deck locked style
formula; the `deliver-images` filing ritual built in server-side.

## Iteration 0.1 — course correction (2026-08-10, same day)

Sophie: candle magic is out (only ~10 colors, a deck needs 50 cards), the
"unrelated" half read witch-adjacent, and Amazon is available — decks don't
need to fit the Etsy shop. New pick: **Clouds & weather lore** (30+ cloud
types + optical phenomena + lore sayings = 50 cards easily; indie space is
mostly printables). Runner-up worth remembering: **Cryptids of America**.
Rule for future idea lists: every candidate must have 50+ enumerable card
subjects.

Cloud samples: same STYLE formula, Storage `deck-samples/clouds/` (+`webp/`),
Compare page "Clouds deck — first samples v1", filed in Assets with prompt
splits. All medium, ~40s each.

## Iteration 0.2 — monsters + the grid trick + the running list (2026-08-10)

- Clouds archived (Sophie: nothing wrong, not her cup of tea). **Monsters of
  America is the active deck.**
- **Running deck-ideas list** lives as Compare page "Deck ideas — running
  list" (verdict sheet `deck-ideas`, ok = 'todo' | 'archive', notes per idea).
  Update it by re-posting the page with the SAME sheet + item ids — verdicts
  live on the verdict doc, not the page, so her checks survive a re-post.
- **The multi-panel grid trick VALIDATED**: one 1024x1536 medium image
  prompted as "a 3x3 grid of nine equal card panels … The nine panels, in
  reading order: 1) …" reliably yields 9 distinct correct panels in order —
  54-card survey for ~36¢ (6 images). Panels ~341x512 each — survey/planning
  resolution, not print; keepers get drawn full-size individually. Style
  header used: "Antique cryptozoology field-guide plate" variant of the
  STYLE formula (in each image's prompt split).
- Full 54-monster list with per-panel one-liners: `scratchpad gen3.js` copy →
  the prompt splits filed on each grid image in Assets (chat
  deck-factory-image-gen). Storage `deck-samples/monsters/` + `webp/`.
  Survey page: "Monsters of America — 54-card survey v1" (sheet monsters-v1).
