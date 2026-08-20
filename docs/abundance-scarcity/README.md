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
- `scarcity-1-velvet-throne-v2` — **an ordinary cardboard shoebox, plain and
  unlined**, with a tiny throne upholstered in red velvet standing in it and
  one glowing lightbulb sitting on the throne like a king. **v1 lined the BOX
  with velvet and that was wrong** (Sophie, Aug 2026: "the shoebox has a
  velvet on the inside which kind of changes it") — her words were "a little
  velvet throne in a shoebox", so the velvet belongs to the throne and the box
  stays a box. v1 is kept in the Assets tab labeled superseded.
  **`both-1-diptych` still carries the lined box** on its right half and has
  not been re-drawn.
- `scarcity-2-petting-it` — sitting cross-legged at night, the shoebox in her
  lap, stroking the glowing thing with one finger, a saucer beside her.
- `both-1-diptych` — the two concepts split down the middle of one picture.

## The film (v2, 0:33)

Draft tier throughout: `wan-2.2-i2v-fast` (movies.js `VIDEO_MODELS.draft`,
same pinned version), **720p, 121 frames** (~7.5s), $0.24 a clip — $1.44 for
six. Narration is her cloned voice, `eleven_multilingual_v2`, settings of
record. Assembled by `scripts/vo-film.js`, which grew a **video shot** for
this (`"video"` instead of `"image"`); it passes the `--final` vo-verify gate
— 0 dead-air runs, 97.7% script match.

**THE NARRATION IS ONE TAKE, SPLIT** (Sophie, Aug 2026: "you're supposed to
pick one clip and then chain them all together so that they don't change the
register so much"). v1 rendered a call per shot and the voice changed register
at every cut. `vo-film.js`'s `joinTTS` now renders every tts line as a single
37.8s take and locates each shot inside it with `phraseSpan`, exactly like one
of her own recordings — so the film is one continuous performance cut up. It
fixed the breathing as a side effect: worst in-shot gap went 1.3s → 0.64s.

**The film is filed as a CHUNK** (`/chunking`, id `8e39179cf7595a3f`) with the
whole narration as its `vo`, so a later video can reuse it whole.

**OPEN: the voice take.** Sophie didn't love the joint take, so the six ORIGINAL
per-line renders (each a different register — the v1 film's) were handed back for
her to pick from. Her pick becomes `"anchor"` on `film.json` and the rest chains
before and after it; the new voiceover then replaces the chunk's audio. **The
anchor has to be RE-RENDERED** — those six takes were made before request ids
were captured, and a stitch can only be seeded by an id.

    node scripts/abundance-scarcity/animate.js /home/user/out/abundance-film
    node scripts/vo-film.js scripts/abundance-scarcity/film.json \
      --dir /home/user/out/abundance-film/work --final

**A clip is RETIMED to its narration line, never frozen or looped.** The lines
run 1.8–9.3s against a fixed 7.57s clip, so each clip is stretched or
compressed to its own line with `setpts`. A held last frame reads as the film
hanging; a loop jumps back to frame one mid-sentence.

Video lives in Storage, not the repo (no `.mp4` has ever been committed here):

- Film — `abundance-scarcity/abundance-scarcity-v2.mp4` (v1 kept)
- Clips — `abundance-scarcity/clips/clip-<id>.mp4`
- both under `https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/`

`clips.json` records the exact motion prompt sent for each clip; `film.json`
holds the exact narration lines.

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

And in the film:

- **Every motion prompt** — she asked for animation, not for these movements.
  They are in `clips.json`, one per clip, exactly as sent.
- **The narration is her own words from the message that started this**, with
  four changes: "I went to spot these cardboard boxes" → "I got these
  cardboard boxes" (a dictation garble); the thesis line ("certain things are
  taken for granted … we have tons of them") moved from the opening to the
  closing shot; "And then" added at the head of the scarcity half; a few
  "like"s dropped. **Written with no internal commas on purpose** — a first
  pass with them made v2 breathe at every one, leaving three ~1s holes the
  dead-air check caught. Her dictation had no commas either, so the
  comma-free lines are the closer copy.
