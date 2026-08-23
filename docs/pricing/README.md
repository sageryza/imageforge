# Flyer & poster pricing research (Aug 2026)

`uprinting-2026-08-23.json` — 128 live quotes pulled 2026-08-23 straight off
UPrinting's own calculator (`POST calculator.uprinting.com/v1/computePrice`,
the same call their product page makes). Three products:

- `flyers` — product 5, sizes 3x5 (custom) / 4x6 / 4.25x5.5 / 5x7,
  qty 25-1000, 100lb gloss + 14pt cardstock, front-only and both sides.
- `posters_offset` — product 3, 8.5x11 to 27x39, qty 25-250. Big fixed
  setup, then nearly free per piece.
- `posters_largeformat` — product 357, 11x17 to 36x48, qty 1-50. Cheap for
  a handful, never gets cheap per piece.

All 3-business-day turnaround, list price, before shipping/tax/coupons.

## The two findings worth keeping

**UPrinting, PrintPlace, 48HourPrint and NextDayFlyers quote the SAME price.**
All four are Digital Room brands on one shared calculator backend
(`shared-calc.digitalroom.com`), and the identical request returns the
identical number on all four `website_code`s — verified, not inferred. Only
the coupons differ.

**The poster crossover is about 40 pieces.** Under ~40, large format
(product 357) wins; over ~40, offset (product 3) wins, and hard. 18x24 at
25 is $300 large-format vs $481 offset; at 50 it is $591 vs $484.

## Re-pulling

`scripts/` is not where this lives — the pull was ad hoc. To redo it:
`POST https://shared-calc.digitalroom.com/get-calculator {product_id,
website_code:"UP", page_type:"pdp"}` returns every attribute id and value
label; then `POST <site>/v1/computePrice` with Basic auth from the site's own
public calculator config, body `{product_id, website_code, productType:
"offset", publishedVersion:true, disableDataCache:true, disablePriceCache:
true, attr<N>:"<valueId>", …}`. Attribute ids are in the get-calculator dump.

`print-prices-v1.html` is the Compare page posted into the
`flyer-poster-pricing-research` chat (page id `DIWhGw2byUDYzO4Xwhhl`), kept
here so a later version can start from it. A new version is a NEW page.
