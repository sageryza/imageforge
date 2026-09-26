# Fruit Calendar 2027 — the Gelato wall calendar

- `Fruit-Calendar-2027.pptx` — v1, Gelato's 11x16.5in wall-calendar template as she uploaded it (2026-09-25).
- `Fruit-Calendar-2027-v2-Borderless.pptx` — v2, the same without the year line.
- `Fruit-Calendar-2027-v3-Fruits.pptx` / `.pdf` — v3 (2026-09-26): the first twelve fruits of her picked deck
  (`scripts/decks/fruit-picked.json`) in the image slot, the "Image title" caption box removed. 12 pages, trim size.
- `Fruit-Calendar-2027-v3-print.pdf` — the PRINT-READY shape Gelato wants: cover + 12 months + blank = 14 pages,
  4 mm bleed on every side (287.4 x 427.1 mm), the page cream (#F6EDD9) filled out to the bleed. The cover is
  January standing in until she picks one.

Gelato product (measured 2026-09-26 off the catalog):
`wall_calendar_unified_pf_11x16-5-inch-a3_pt_250-gsm-100lb-coated-silk_cl_4-4_bt_wire-with-hook-top_ct_none_prt_none_ver`
— quoted $10.11 a calendar + $7.99 USPS Ground to Portland, `pageCount: 14`, one multi-page PDF as the `default` file.
The key is `GELATO_API_KEY` on `config/pipeline`. A draft order (`orderType: "draft"`) uploads the file to her
dashboard for $0; a real order is a "go".
