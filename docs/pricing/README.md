# Flyer & poster pricing research (Aug 2026)

`uprinting-2026-08-23.json` — 178 live quotes pulled 2026-08-23 straight off
UPrinting's own calculator (`POST calculator.uprinting.com/v1/computePrice`,
the same call their product page makes). Four products:

- `flyers` — product 5, sizes 3x5 (custom) / 4x6 / 4.25x5.5 / 5x7,
  qty 25-1000, 100lb gloss + 14pt cardstock, front-only and both sides.
- `postcards` — product 2, sizes 4x4 / 4x6 / 4.25x6 / 5x7 / 3.5x8.5,
  qty 25-1000, 14pt + 16pt cardstock. Custom sizes bottom out at 4x4.
- `posters_offset` — product 3, 8.5x11 to 27x39, qty 25-250. Big fixed
  setup, then nearly free per piece.
- `posters_largeformat` — product 357, 11x17 to 36x48, qty 1-50. Cheap for
  a handful, never gets cheap per piece.

All 3-business-day turnaround, list price, before shipping/tax/coupons.

## The findings worth keeping

**UPrinting, PrintPlace, 48HourPrint and NextDayFlyers quote the SAME price.**
All four are Digital Room brands on one shared calculator backend
(`shared-calc.digitalroom.com`), and the identical request returns the
identical number on all four `website_code`s — verified, not inferred. Only
the coupons differ.

**A card is cheaper as a FLYER than as a POSTCARD.** Same 4x6, same 14pt
cardstock, both sides: the flyer product is $41.96/100 and $85.00/1000 where
the postcard product is $44.31 and $109.11 — 22% more at 1000 for the same
physical card. And postcard custom sizes stop at 4x4, so a 3x5 can only be
ordered as a flyer here at all ($66.50/1000 on 14pt).

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

`print-prices-v1.html` / `print-prices-v2.html` are the Compare pages posted
into the `flyer-poster-pricing-research` chat (ids `DIWhGw2byUDYzO4Xwhhl`,
superseded, and `9kVPexmomlLi5GwMP6z3`), kept here so a later version can
start from one. A new version is a NEW page, never an edit of the old one.
