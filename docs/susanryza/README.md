# Susan Ryza Jewelry — her own photos as the raw image

**Sophie, 2026-09-16: "can u pull her photos and use them as the raw image to
extract, the image model can do new pics · one or two w model etc ·
susanryza.com".**

susanryza.com is a Shopify store (Santa Monica, handmade jewelry, plus classes,
repairs, tools and supplies). Two scripts: one pulls her photos, one makes a new
picture of the same real piece out of one of them.

## What is actually there — measured 2026-09-16

- **407 products**, 1,494 photos, read straight off `/products.json` with no key
  and no scraping. Two pages of 250; page 3 is empty.
- **224 of them are finished pieces** and those are the ones worth restaging:
  81 Earrings · 73 Bracelets · 63 Necklaces · 7 Rings. Their **821 photos** are
  1,400-2,500px and already square.
- The other 183 are tools, beads, findings, stretch cord and PDF tutorials —
  supplies rather than pieces. `PIECE_TYPES` in the puller is that line.
- `catalog.json` here is those 224: title, type, price, her own description and
  every photo url. **The photos themselves are NOT committed** (213MB) — her
  store holds them and `--photos` re-pulls the lot in about four minutes.

## HER PHOTOS ARE SHOT TWO WAYS, AND BOTH ARE THE PROBLEM THE EDIT SOLVES

- **Necklaces are on a beige dress form in a white t-shirt.** The piece is
  lit well and shot square-on; what dates the picture is the dress form.
- **Earrings and bracelets lie flat on grey craft paper**, and the frame
  usually catches the dark edge of the table behind the paper.

Neither says how the piece sits on a person, which is the one thing a buyer
wants and the one thing she has no photo of.

## THE PIECE IS REAL, SO IT IS AN EDIT, NEVER A GENERATION

Somebody made each of these by hand — so the new picture has to be of THAT
piece, every bead in the same order. `jewelry-restage.js` walks photostudio.js's
ladder: `images/edits` on **gpt-image-1 with `input_fidelity: high`**, falling
back to gpt-image-2 without the flag only if gpt-image-1 is ever off the account
(gpt-image-2 refuses the flag — "does not support the 'input_fidelity'
parameter" — so the fallback is degraded, not equivalent). The run prints which
model actually drew it, because the caption has to be true.

**The prompts say what happens to the piece, never what the piece looks like.**
The photo carries the piece; words about its colour or its beads only argue with
it. Every scene is a staging instruction plus the word "unchanged".

## Measured on the first run (2026-09-16, four pictures, ~$0.38 all in)

- **gpt-image-1 took every one at fidelity high** — no fallback, 15-21s each.
- **Medium, 1024x1024 for the lift and 1024x1536 for the worn shot** — both are
  the 1K tier, so the caption reads `gpt-image-1 · medium · 1K`.
- **~8.4c for a 1024x1024 lift, ~10.5c for a 1024x1536 worn shot** (the input
  photo is ~4,160 tokens at high fidelity and is most of the bill on the
  square one). `priceOf` in the script prints it before spending it, and
  `--dry` spends nothing at all.
- **Shape and structure came back exact** on both pieces — the bead order, the
  wire mesh, the ear wires, the cluster.
- **COLOUR DRIFTS WARM ON A MIXED-METAL PIECE.** The wire tube necklace's
  bright silver beads came back champagne/cream in both the lift and the worn
  shot. The all-silver earrings did not drift at all. So a piece whose selling
  point is the metal wants a colour check before it goes near a listing —
  naming the metal in the prompt is the obvious next thing to try, and it has
  not been tried yet.

## Usage

```
node scripts/susanryza-pull.js --out ./susanryza                     # catalogue only, free
node scripts/susanryza-pull.js --out ./susanryza --photos            # + all 821 photos
node scripts/jewelry-restage.js --in susanryza/raw/7101973037102_0.jpg \
  --scene necklace-model --out ./out --dry                           # prints the prompt + price, sends nothing
```

Scenes: `white` (lift it off the dress form / the craft paper) · `necklace-model`
· `earring-model` · `bracelet-model`. A scene that does not exist sends nothing.
