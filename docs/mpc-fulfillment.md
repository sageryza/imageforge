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

## Full auto-upload — `/api/mpc-upload` (saves the project; ordering stays hers)

`mpc-upload.js` removes the last manual step: instead of downloading the ZIP and
running the desktop tool, it drives a real (headless) browser in the cloud to log
into MakePlayingCards, create the deck project, upload every prepped card, set the
options, **save the project to the account** and stop on the review page. Sophie
opens Saved Projects, reviews, and orders. Nothing in it touches the cart or a
payment page (by design and by request).
**Since 2026-09-20 the selectors are PORTED FROM MPC AUTOFILL's `driver.py`**
(the community tool's own ids and JS calls: `#dro_paper_type` /
`#dro_choosesize`, `doPersonalize(...)`, the `sysifm_loginFrame` card-count box,
`#uploadId` + `oDesignImage.dn_getImageList()` keyed by the file's SHA-1,
`PageLayout.prototype.applyDragPhoto(getElement3("dnImg", slot), 0, pid)`,
`oDesign.setTemporarySave()` / `setNextStep()`), so the "calibration pass" below
is by source, not a guess. `opts.deckDir` runs an already-prepped folder (the
zip's contents) with no download. Login refuses to go on when the logout link
does not appear. Still unmeasured on her real account: the container that tried
was not permitted to sign in (2026-09-20), so the first real run is either her
go for the container, or the desktop tool on her Mac (queued in
`docs/desktop-tasks.md`). `node scripts/test-mpc-upload.js` drives the whole
engine against a mock of MPC's editor.

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

### Where it actually runs: a one-off Render JOB, not the web box (2026-09-21)

Sophie: "try render" (the cloud container's browser cannot trust the sandbox
proxy — every network level goes through it, per Anthropic's own docs — and
"i don't like using my desktop cause it hurts my back"). **Measured before
building:** the headless browser peaks at **~225MB PSS** on the mock editor with
the low-memory launch flags (`scripts/test-mpc-upload.js` under a
`/proc/*/smaps_rollup` sampler; the naive RSS sum reads 670-770MB and is wrong,
shared pages counted per process), and the live Starter box idles near 300MB of
its 512 — so the route on the web service would OOM the server under her
draws. `POST /api/mpc-upload` now refuses above 150MB rss and says so.

The door is a **one-off job**: `node scripts/render-job.js --cmd 'node
scripts/mpc-upload-job.js --zip <dump save url> --name "Fruit flash cards v1"
--stock superior'`. Render runs the command on a FRESH Starter instance of the
same build and env (all 512MB to the browser), bills it by the second, and it
exits. `mpc-upload-job.js` unpacks the prep zip, runs the engine with
`deckDir`, puts every step screenshot in Storage and POSTs ONE Compare page into
the chat titled with the outcome. Three things the build and env need, in
order:

1. **The browser in the build** — `buildCommand` is `npm install &&
   (PLAYWRIGHT_BROWSERS_PATH=.pw-browsers npx playwright install
   chromium-headless-shell || true)`; `findBrowser()` in `mpc-upload.js` looks
   in `./.pw-browsers` first. The service is not Blueprint-managed, so this
   was set by API and mirrored in `render.yaml`. **Whether Render's native
   Node image has headless-shell's shared libraries is UNMEASURED until the
   first deploy** — `GET /api/mpc-upload/status` answers `browser:true/false`
   and the first job's log says which library is missing if one is.
2. **`MPC_EMAIL` / `MPC_PASSWORD` in the Render env** — hers to paste
   (https://dashboard.render.com/web/srv-d660igvgi27c73a5u6eg/env). A chat
   never writes a secret into a store, and her password never goes in a chat.
3. **A deploy** — the build has to run once for the browser to exist; her
   Deploy button on /waiting.

Then any chat with `RENDER_API_KEY` fires the job. It never touches the cart:
the deck ends as a saved project in her MPC account, and she orders by hand.

**THE RESULT, MEASURED 2026-09-21 — TWO LIVE JOBS: THE JOB CANNOT SIGN IN.** The
build carried the browser (`browser:true`, `credentials:true`, a job boots and
opens MPC fine), but MPC's login runs **Google reCAPTCHA v3** before its
postback (`btn_submit_onclick` → `oGrectcha.executeGrecaptcha` →
`__doPostBack`), and a headless browser on a server scores as a bot: the page
reloads with the password cleared and no message (the screenshots are on the
"MPC upload — Fruit flash cards v1 — failed" pages in the chat). That gate is
the site's own and is not ours to defeat, so the engine now STOPS before any
attempt when the login page carries reCAPTCHA, rather than piling failed
sign-ins on her account. This is exactly why the community desktop tool makes
the human sign in: a real browser with a real person passes. **So the browser
upload is a person's job, by hand on the phone (Upload images → drag 15) or
the desktop tool on a Mac**; the job stays as the door for anything that does
not need her login.

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

## Trial run, measured 2026-09-20 — the fruit flash cards, no upscale

Sophie: "i'm skeptical · upscale changes art · trial run in ur container would
be good." The whole tail was run in a session container on the 15 picked fruit
pictures (`fruit/full/*.webp`, 532-1024px square): `scripts/flashcard-compose.py`
put each on a white poker card at 2in wide with its name under it,
`mpc_card_prep.py --proof` stamped 825x1125 @ 300 DPI, `mpc_order_builder.py`
wrote the order.xml, and the zip + proofs went to the Dump and a Compare page
("Fruit flash cards — MPC trial v1"). **No model upscale is needed for a flash
card**: the picture is not full-bleed, so its own pixels land at 260-500 DPI
and the only resampling is a plain resize (lime, the smallest at 532px, is
x1.13; everything else downscales). The step nobody has run yet is the browser
upload — the desktop MPC Autofill on the zip, or `/api/mpc-upload` once
`MPC_EMAIL`/`MPC_PASSWORD` are set and its selectors get their first live pass.

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
