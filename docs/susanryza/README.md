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

OpenAI has two doors. `images/generations` draws from words alone.
`images/edits` takes a picture in — her photo, and optionally a mask — and
changes it. Somebody made each of these by hand, so the new picture has to be
of THAT piece, every bead in the same order, and only the second door can do
that. `jewelry-restage.js` uses it. The run prints which model actually drew
it, because the caption has to be true.

## THE FIRST RUN USED THE 2025 MODEL, ON THE STRENGTH OF A STALE NOTE (2026-09-16)

`photostudio.js` said gpt-image-1 was the faithful one because gpt-image-2
"refuses the `input_fidelity` flag, so the fallback is degraded". Read against
OpenAI's own docs the same day (Sophie: "4 cents? so all inputs have been low
fidelity" — the question that made me look):

- **gpt-image-2 refuses the flag because it runs every image input at high
  fidelity automatically.** There is nothing to set. Not degraded — the note's
  conclusion is backwards.
- **So the first four pictures came off the oldest model available.** They
  WERE high fidelity — gpt-image-1 accepted the flag on all four (the script
  logs it only when the accepted request carried it), and 4¢ is exactly what
  high fidelity costs there: OpenAI's table puts a square input at ~4,160
  image tokens × $10/1M. Low would have been well under a cent. **But that 4¢
  was an estimate off the table, not a reading** — the response's `usage`
  block was never saved. The script saves it now and prices from it.
- **gpt-image-2 IS THE MODEL NOW, EVERYWHERE, AND THAT IS HER CALL** ("use 2,
  change everywhere and the docs"). `EDIT_MODELS` in `jewelry-restage.js` is
  gpt-image-2 alone; **`photostudio.js` moved with it** — and it had been
  filing `gpt-image-2` as the caption on pictures gpt-image-1 drew, so that
  route's captions were wrong on every mockup it ever made; the ideatrol
  commercial scripts stopped dropping to gpt-image-1 on a third try.
  gpt-image-2 is also cheaper: $8/1M image in and $30/1M image out, against
  gpt-image-1's $10 and $40.
- **`gpt-image-2.5-sunburst` and `-flare` are on her key, dated 2026-09-08,
  and are NOT in use.** OpenAI: "Choose Sunburst for workflows where editing
  precision matters most, and Flare for fast, high-quality everyday image
  generation." Five quality rungs (low · medium · high · xhigh · max) against
  gpt-image-2's three, at the same token rates. UNMEASURED on her pieces —
  `--model gpt-image-2.5-sunburst` sends one for a deliberate test, and
  adopting it anywhere is hers to say.

## A MASK IS GUIDANCE, NOT A LOCK — CORRECTING WHAT THE CHAT SAID FIRST

The reply that proposed the mask said the necklace would "stay her actual
pixels — no drift by construction". **Wrong through OpenAI's door.** Their
docs: "Masking with GPT Image is entirely prompt-based. The model uses the
mask as guidance, but may not follow its exact shape with complete precision."
A mask makes the model TRY to leave the piece alone; it does not stop it
repainting a bead. The only pixel-exact route is a composite we make
ourselves — cut the piece out of her photo (a segmenter on Replicate, ~2¢),
draw the scene around a stand-in, paste her cut-out back over it — which is
free after the draw and is a separate step nobody has built or measured yet.
Its own catch: the pasted piece keeps the lighting of her photo, so the scene
has to be lit to match it (the dress-form shots are soft and even, which is
the easy case).

## THE RE-SHOOT ON gpt-image-2 (2026-09-16, her go: "reshooting · relabel")

Same two pieces, same four prompts, same photos — only the model moved. **24¢
for four, and every figure here is READ OFF the response's `usage` block rather
than estimated:**

- **5.4¢ a worn shot (1024x1536), 6.5¢ a lift (1024x1024)** — 1,372 and 1,756
  output tokens at $30/1M, plus **1,521 image tokens for the reference** at
  $8/1M (1.2¢) on all four. gpt-image-1's own table put the same square
  reference at ~4,160 tokens and $10/1M, so the input is about a third of the
  price here for the fidelity the docs say is automatic.
- **32-37s each**, against gpt-image-1's 15-21s. Slower, and that is the trade.
- **THE COLOUR DRIFT IS MOSTLY GONE.** The wire tube necklace's silver beads
  read as silver in the worn shot now, where v1 came back champagne on both.
  The white lift still runs slightly warm on the pale beads — better, not
  perfect, and the next lever for it is naming the metal (item 4 below).
- **The v1 four are KEPT**, relabelled `… v1 — superseded (gpt-image-1)` in
  the Assets tab, carrying their true `gpt-image-1 · medium · 1K` caption. The
  Compare page is v2 and v1 is superseded.

## WHAT TO TRY FOR "EXACT", IN ORDER — 1 is done, the rest need her go

1. **gpt-image-2 instead of gpt-image-1** — DONE and re-shot, see above. (The
   unmeasured next rung is `--model gpt-image-2.5-sunburst`, hers to ask for.)
2. **Take the warmth out of the scene prompt.** "warm neutral background,
   natural daylight" was the chat's own wording and it tints silver; a neutral
   studio light is a scene word (what no reference carries), so it is inside
   the never-describe-the-reference rule.
3. **A colour-accuracy line** — "colour-accurate, the metal keeps its true
   tone" — positive wording, since a "do not tint" reads as weakly here as a
   "does NOT appear" did on Wan.
4. **Name the metal** ("sterling silver") — would likely help and is the one
   that breaks her never-describe-the-reference rule. Hers to allow.
5. **The composite** above, for a piece whose metal is the selling point.

**The prompts say what happens to the piece, never what the piece looks like.**
The photo carries the piece; words about its colour or its beads only argue with
it. Every scene is a staging instruction plus the word "unchanged".

## Measured on the first run (2026-09-16, four pictures, ~$0.38 all in)

- **gpt-image-1 took every one at fidelity high** — no fallback, 15-21s each.
  (That was the run BEFORE the switch above; the four filed pictures carry
  `gpt-image-1 · medium · 1K` and that caption is true of them.)
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
