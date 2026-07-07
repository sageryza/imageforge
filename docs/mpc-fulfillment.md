# Card-deck fulfilment — MakePlayingCards (MPC)

The Deck Factory pipeline ends, for **card decks**, at MakePlayingCards.com. This
is the one product type with **no print-on-demand API** — so fulfilment is
semi-automated, not fully hands-off. This doc is the fulfilment tail:

```
deck art (ChatGPT / the Forge)  ->  card image files  ->  order.xml  ->  MPC Autofill desktop  ->  MPC order
```

Everything upstream (mockups, the draft Etsy listing Sophie reviews) is the same
as the rest of the pipeline. The part below only kicks in **after an order comes
in** and it's time to actually print the deck.

## Why it's a hybrid, not a full uploader

**MPC has no public API.** The only way to automate it is to drive their
website. That browser layer breaks every time MPC changes their site — so we do
**not** own it. Instead:

- `scripts/mpc_order_builder.py` (ours, tiny, stable) turns a folder of card
  images into an `order.xml`.
- The maintained community tool **MPC Autofill**
  ([mpcfill.com](https://mpcfill.com) / [github.com/chilli-axe/mpc-autofill](https://github.com/chilli-axe/mpc-autofill))
  reads that XML and does the actual browser upload via Selenium, signing into
  the MPC account and placing every card.

We only own the light, stable XML piece. When MPC changes their layout, the
community tool gets fixed by its maintainers, not us.

## The script: `scripts/mpc_order_builder.py`

Generates `order.xml` in the MPC Autofill **local-files** format, referencing
images by **relative path** in each card's `<id>` (no Google Drive needed). Every
`<card>` carries `<sourceType>Local File</sourceType>` so the desktop tool loads
from disk; `<slots>` is a comma-separated slot list; stock strings are the exact
values MPC's XML accepts (friendly aliases like `superior`/`linen` are mapped
for you). This matches the tool's published
[XML Schema Specification](https://github.com/chilli-axe/mpc-autofill/wiki).

### Folder convention

```
my_deck/
    fronts/            one image per card front (required; natural-sorted -> slot order)
        01_wolf.png
        02_owl.png
    back.png           OPTIONAL: single shared back for the whole deck
    backs/             OPTIONAL: per-card backs (use INSTEAD of back.png)
        01_wolf.png     matched to fronts by filename stem (or --match order)
        02_owl.png
```

- Shared back -> one `<cardback>`, no `<backs>`.
- Per-card backs -> slot 0's back becomes the default `<cardback>`; other slots
  get `<backs>` overrides. (This is the animal-oracle case: unique back per card.)
- Unmatched fronts fall back to the default back, with a printed warning.
- Number filenames (`01_`, `02_`, …) so card order is stable.

### Run

```
python scripts/mpc_order_builder.py my_deck
python scripts/mpc_order_builder.py my_deck --stock superior --foil
python scripts/mpc_order_builder.py my_deck --match order   # pair backs by position, not name
```

Flags: `--fronts`, `--backs`, `--shared-back`, `--match {name,order}`, `--stock`,
`--foil`, `--bracket`, `--out`. Bracket auto-picks the smallest MPC tier ≥ card
count; overridable. Stock accepts the exact MPC string or an alias
(`standard`→S30, `superior`→S33, `linen`→M31, `plastic`→P10).

### Then

```
autofill --directory my_deck
```

Runs the MPC Autofill desktop tool from the deck folder so the relative paths
resolve. It signs into the MPC account, fills every slot, and auto-saves the
project. Review the saved project in the MPC account and check out by hand.

## Cloud path — `/api/mpc` (no files on any computer)

The pipeline generates a deck's card images and they live as **URLs** (Firebase
Storage / Replicate / data URLs), never as files on a laptop. `mpc.js` is the
cloud version of the two scripts above: it does the prep + order.xml + bundling
server-side, straight from those URLs, and hands back one downloadable ZIP.

- `GET /api/mpc/status` (open) — reports readiness (`sharp`/`jszip` present,
  Firebase on, the card sizes + modes).
- `POST /api/mpc/prep-order` (STUDIO_TOKEN-gated) — body:
  ```json
  {
    "deckName": "Wolf Oracle",
    "size": "poker", "mode": "cover", "stock": "superior", "foil": false,
    "fronts": ["https://…/01.png", "https://…/02.png"],
    "back":   "https://…/back.png",
    "backs":  ["https://…/b01.png", "…"],
    "names":  ["wolf", "owl"]
  }
  ```
  `fronts[]` is required; give **either** `back` (one shared back) **or**
  `backs[]` (per-card, matched to fronts by position). It downloads each image,
  preps it to press-ready (same bleed/DPI as `mpc_card_prep.py`), builds the
  `order.xml` (same local-files dialect as `mpc_order_builder.py`), and zips
  `fronts/`, `backs/` or `back.png`, `order.xml`, and a `README.txt`. When
  Firebase is set it uploads the ZIP and returns `{ ok, url, warnings, … }` — a
  tap-to-download link; otherwise it streams the ZIP binary. Low-res / grid
  sources come back in `warnings` (see below).

So the flow is: pipeline → `POST /api/mpc/prep-order` → download the ZIP → run
the desktop tool from it → review + check out. The only step that still needs a
computer is the actual browser upload, which is the maintained tool's job.

**Grid caution:** if a deck's art was generated as a multi-up grid in one image
(e.g. six cards in one 1024×1536 output), each card is only a fraction of that
resolution — a 2×3 grid gives ~512×512 per card, far below the 750×1050 a poker
card needs. `prep-order` flags these in `warnings` ("~186 DPI — likely a
grid/low-res source"). For print, generate each card at full resolution.

## Full auto-upload — `/api/mpc-upload` (everything except paying)

`mpc-upload.js` removes the last manual step: instead of downloading the ZIP and
running the desktop tool, it drives a real (headless) browser in the cloud to log
into MakePlayingCards, create the deck project, upload every prepped card, set the
options, and land in the **cart** — then stops. Sophie logs in, reviews, and pays.
**Payment is never automated** (by design and by request); the engine even has a
payment-page guard that hard-stops if it ever lands on a pay screen.

- `GET /api/mpc-upload/status` (open) — readiness (`playwright` present,
  credentials set) + the runtime/calibration caveats.
- `POST /api/mpc-upload` (gated) — body is the **same deck spec** as
  `/api/mpc/prep-order` (`fronts[]` + `back`/`backs[]`, `size`, `mode`,
  `quantity`, …). Starts a background job and returns `{ jobId, poll }`.
- `GET /api/mpc-upload/:jobId` (gated) — poll status: `queued → running →
  awaiting_payment` (or `error`), with a step `log`, per-step **screenshot** URLs,
  and the `cartUrl` to open and pay.

Config (env or the `config/pipeline` Firestore doc): `MPC_EMAIL`, `MPC_PASSWORD`
(the MPC account to upload into), optional `MPC_LOGIN_URL` / `MPC_PRODUCT_URL`,
and `MPC_BROWSER_PATH` for hosts where the browser lives outside Playwright's
cache.

### Two honest caveats

1. **Runtime.** This needs a browser-capable host (Playwright + Chromium) — that
   is **not** the Render free web service (512 MB, no browser). Run `mpc-upload`
   on a worker / Mac / browser-capable container: `npm i playwright &&
   npx playwright install chromium`. On the Render web app the route reports
   `ready:false` and returns 501, harmlessly dormant. `playwright` is an
   **optionalDependency** so it never blocks the main deploy.
2. **Calibration.** MPC's editor DOM isn't publicly documented and their site
   changes over time (that churn is the reason the maintained desktop tool
   exists). The automation **engine** is generic and tested against a mock site;
   the MPC-specific URLs/selectors live in one block (`DEFAULT_FLOW` in
   `mpc-upload.js`) and every step is screenshotted, so the first supervised real
   run just tunes that block. Treat it as "engine done, selectors need one live
   calibration pass," and expect to keep it in sync when MPC changes — which is
   exactly the fragility the ZIP hand-off avoids. Keep the ZIP path as the
   fallback.

## Before a full deck run — smoke-test 3 cards (IMPORTANT)

The XML *structure* matches the published schema, but the desktop tool is the
source of truth for the local-files dialect. **Test a 2–3 card folder first** and
confirm the tool loads it and places images in the right slots. If a field is
off, it surfaces on the tiny order and it's a one-line fix — cheaper than finding
out on a 72-card deck.

## Print-readiness prep — `scripts/mpc_card_prep.py`

MPC poker cards are 2.5"×3.5" and need a 1/8" bleed all around → a
**2.75"×3.75" @ 300 DPI = 825×1125 px** print file. Art out of ChatGPT / gpt-image
is typically ~1024×1536 at screen res with **no bleed**, so it must be prepped
first or the cut crops into the design and leaves white slivers at the edges.
`mpc_card_prep.py` does that prep; run it **before** the order builder:

```
raw art  ->  mpc_card_prep.py  ->  press-ready PNGs  ->  mpc_order_builder.py  ->  order.xml
```

```
python scripts/mpc_card_prep.py my_deck --out my_deck_print   # deck folder in, prepped deck folder out
python scripts/mpc_order_builder.py my_deck_print              # then build the order
```

It takes a single image, a flat folder, or a **deck folder** (it walks `fronts/`,
`backs/`, and `back.png`, preserving the layout the order builder expects). Output
is always the exact pixel size for the card at 300 DPI with real DPI metadata.
Requires Pillow (`pip install Pillow`).

- `--size` poker (default) / bridge / tarot / square / mini / jumbo
- `--mode`:
  - **cover** (default) — scale to fill the whole card+bleed and center-crop the
    small overflow. Full edge-to-edge bleed, no seams. Best for full-bleed art;
    it reports how much of each image's edge was cropped, so keep important
    content off the very edge.
  - **extend** — scale to the trim size, then *manufacture* the bleed by mirroring
    the outer edge pixels outward. Nothing inside the cut line is lost. Best when
    the art is exactly the card face.
  - **fit** — scale to fit inside the trim with no crop (whole image kept), pad to
    a `--bg` colour, then extend into the bleed.
- `--proof` also writes `_proof` images (into a `proof/` subfolder) with the trim
  line (red) and safe zone (cyan) drawn on, so you can eyeball what gets cut.
  These are review-only and never sent to print.
- Flattens transparency onto `--bg` (white default; MPC prints on opaque stock)
  and **warns when art resolves below 300 DPI** at card size (it upscales, but
  flags it as likely soft).

Accepted input formats: png, jpg, jpeg, bmp, gif, tif, tiff. The desktop tool
downscales to 800 DPI (MPC's press max); orders over 612 cards are split by it.

## Pricing — one deck at a time vs a batch run

MPC bulk discounts are **per design**: one MPC order is *one deck design × a
quantity*. You **cannot** mix six different decks into one order to hit a bulk
tier — a "tier-2 run" means six copies of the **same** deck. That single fact
decides the answer for a made-to-order Etsy shop.

Per-deck price by quantity tier (standard poker deck, no setup fees; MPC runs
coupons often so treat these as list price):

- **S30 Standard Smooth** — 1+: **$13.90** · 6+: **$11.60** · 30+: $9.55 · 50+: $7.95 · 100+: $6.35
- **S33 Superior Smooth / M31 Linen** — 1+: **$15.70** · 6+: **$13.20** · 30+: $10.95 · 50+: $9.15 · 100+: $7.35
- **S27 Promotional** (thinner) — 1+: $13.50 · 6+: $11.30 · 30+: $9.25
- **P10 Plastic** — 1+: $19.90 · 6+: $17.60 (waterproof; niche)

The "second tier" is **6+ decks**. Going from 1 → 6 saves only ~$2.30/deck on
S30, but costs ~$70 upfront and leaves 5 decks of one design in inventory. On top
of the per-deck price, **shipping is the real swing factor** — a single-deck
order pays full shipping on one $14 deck, whereas a 6-pack amortizes one shipment
across six decks. That amortized shipping, not the tier discount, is where
batching actually helps.

### Recommendation

- **Default: one deck at a time (made to order).** When an Etsy order lands, run
  the script + autofill for that specific deck, check out one copy, ship it (or
  ship direct to the buyer). Zero inventory, zero upfront cash, zero risk of
  unsold decks — which is the entire point of an automated print-on-demand
  pipeline. The per-deck cost is highest, but you only ever pay for a deck that
  already sold.
- **Batch a design only once it's a proven repeat seller.** If one deck sells
  several times, pre-print a **6-pack of that design** (tier 2) to shave the
  per-deck cost and amortize shipping, then fulfil the next orders from that
  stock. Don't batch on a guess — batching a design that then doesn't reorder
  turns a $70 "discount" into $70 of dead stock.
- Choose stock by product: **S30** for everyday decks, **S33/M31 (linen)** for a
  premium oracle/tarot feel worth charging more for. The linen upcharge is ~$1.80
  a deck at tier 1 and easy to pass through in the Etsy price.

Sources: MPC
[bulk pricing](https://www.makeplayingcards.com/low-price-for-bulk.aspx) ·
[custom deck product page](https://www.makeplayingcards.com/design/custom-back-standard-mpc-playing-cards.html)
(prices as of July 2026).
