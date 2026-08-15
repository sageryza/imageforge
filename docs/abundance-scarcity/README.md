# Abundance vs scarcity — the boxes and the one good idea

Sophie's recurring idea, drawn in the sage-sandy-mirror watercolour style
(August 2026). Two halves of one thought:

- **Abundance** — the Uline cardboard boxes. They only sell in quantities of
  ~500, so she had more than she could ever use, everywhere, for days. She
  could not run out, so she used them for everything and kept inventing new
  uses just to burn through them.
- **Scarcity** — one good idea. Most people have exactly one, so they treat it
  the way you'd treat a small animal: a little velvet throne inside a shoebox,
  petted, kept, been nice to.

## How they were made

The settled watercolour recipe, unchanged (`docs/evan-film-style.md`,
`docs/nde-watercolor.md`): OpenAI **gpt-image-2**, the **edits** endpoint,
`refs/sage-sandy-mirror.png` attached as a pure style reference, **no written
style description**, quality **medium**, size **1024x1536**. ~6¢ an image.

    JOBS=3 PANEL_QUALITY=medium python3 scripts/nde-watercolor.py \
      scripts/abundance-scarcity/jobs.json /home/user/out/abundance

    node scripts/nde-file-watercolor.js /home/user/out/abundance \
      scripts/abundance-scarcity/labels.json \
      --chat abundance-scarcity-watercolor --prefix abundance-scarcity

`prompts.json` holds the exact text sent for every image — that is what the
Assets PROMPT overlay reads, and a paraphrase there is not allowed.

## The six

- `abundance-1-the-flood` — a room overrun, boxes to the ceiling and through
  the doorway, her standing in the middle of it unworried.
- `abundance-2-inventing-uses` — a box as a table, a lampshade, a stool, a
  rug, a hat, shelves; she is cutting into the next one.
- `abundance-3-the-mountain` — a small figure from behind at the foot of a
  mountain of boxes that runs off the top of the frame.
- `scarcity-1-velvet-throne` — the shoebox on a bare floor, lined in red
  velvet, a tiny throne, one glowing lightbulb sitting on it like a king.
- `scarcity-2-petting-it` — sitting cross-legged at night, the shoebox in her
  lap, stroking the glowing thing with one finger, a saucer beside her.
- `both-1-diptych` — the two concepts split down the middle of one picture.

## What was invented, and by whom

Sophie described the concepts, not the pictures. Everything below is a choice
made when writing the scenes, recorded here so a later chat does not mistake
it for her direction:

- **What an idea looks like.** She never said. Rendered two ways on purpose so
  she can pick: a small glowing **lightbulb** (throne) and a small round
  glowing thing **about the size of an egg** (petting) — the egg reads closer
  to the animal she described.
- **Deep red velvet.** She said velvet; the colour is a choice.
- **Night, and the saucer** in `scarcity-2` — an extension of "pet it", not
  something she asked for.
- **Hands on her hips, unworried** in `abundance-1` — a pose/mood call.
- **The diptych composition** itself, and the hand reaching in from off-frame
  on its left half.
- **"No text or lettering anywhere."** — the house line, on every scene.
