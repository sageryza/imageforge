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
