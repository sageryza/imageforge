# The NDE montages in watercolor — the recipe and the cast

The Anthony Chene montage art, redone in Sophie's ink-and-watercolour look
(August 2026). This replaces nothing that exists — the PROOF montage's twelve
colored-pencil panels and the one first-pass panel per other montage stay as
history — it is the style everything **new** is drawn in. The pastel
stills-videos (PROOF / Telepathy / Realer) are scrapped; do not build on them.

## The recipe — it is the Evan recipe, unchanged

Read `docs/evan-film-style.md` first; this file only records what is specific
to the NDE work. The headline rule bears repeating because it is
counter-intuitive: **do not write a style description.** No ink, no watercolor,
no palette adjectives. Every written style block that has been tested made the
result worse. `refs/nde-style-prompt.md` (the v4 "STYLE CORE" wording) belongs
to the *colored-pencil* generation and must not be pulled into these renders.

- OpenAI **gpt-image-2**, the **edits** endpoint
- style reference `refs/sage-sandy-mirror.png` attached **first** as `image[]`
  (the same scan the Evan film uses; the handoff called it
  `refs/evan-film-style.png`, which is that file's old name)
- **quality `medium`**, **size `1024x1536`**
- prompt = the settled preamble, then any likeness line, then `Draw: <scene>`

`scripts/nde-watercolor.py` is the renderer and holds the wording verbatim. It
takes a jobs JSON and writes the images plus a `prompts.json` recording the
exact text sent for every one — which is what the Assets PROMPT overlay needs,
since a paraphrase there is not allowed.

    JOBS=3 PANEL_QUALITY=medium python3 scripts/nde-watercolor.py \
      scripts/nde-watercolor/grass.json /home/user/out/nde-wc/grass

    node scripts/nde-file-watercolor.js /home/user/out/nde-wc/grass \
      scripts/nde-watercolor/grass-labels.json --prefix nde-watercolor/grass

The filer uploads to Storage, makes the objects public, writes each tile's
label and `gpt-image-2 · medium` caption, and posts the exact prompt split at
the `Draw:` seam (style half keeps every word actually sent, with `[content]`
marking where the scene went).

## Why character references, not the WTR LoRA

WTR is text-only in this codebase — a Flux LoRA with a trigger word prepended
to a text prompt, no image-reference input — so a real person's likeness would
drift on every image. The character-anchor path is validated twice in-house
(the movies pipeline's anchor panel, and the hospital story's A/B/C refs), and
it is what "watercolor" means here anyway: Sophie's scan as a style reference
through gpt-image-2, not the WTR look.

So: photo → watercolour portrait (style ref first, photo second) → that portrait
rides as the character reference on every scene the person appears in.

### The settled card prompt (Aug 2026) — every word of it is Sophie's call

    Use the FIRST attached image as a style reference. Only use its style, not
    its content — do not copy anything depicted in it. You do not have to copy
    its colors.

    The SECOND attached image is a photograph of the person to draw.

    Draw: a head-and-shoulders portrait of that person, facing the viewer, on a
    white background. No text or lettering anywhere.

Two things I wrote into that scene line and did NOT flag, both of which she
caught and removed — the lesson being to name every word that is mine when I
hand the result over:

- `calm and open-faced` — my aesthetic call, never asked for. Removing it
  changed nothing about the expression (a smiling photo still draws a smiling
  face), so it was only ever imposing a mood.
- `against a plain pale background` — "pale" was a vaguer word doing no work.
  Nothing post-processes these images, so it should always have said white.
  Then Sophie asked the better question: is the line needed at all? **It is
  not.** Rendered on Darius with and against, the corner pixels came back
  254,254,252 without the line and 254,254,253 with it — the style reference
  draws on white paper whether or not the prompt says so. So a portrait needs
  NO background line; the nine live cards carry one and are none the worse for
  it, but new prompts should leave it out.

### The likeness line is ONE sentence — do not grow it back

    The SECOND attached image is a photograph of the person to draw.

(`THIRD` when a second style reference rides along.) That is the whole line.
It reached that shape in three steps, each one Sophie's call, and each step
visibly loosened the drawing:

- v1 said `Keep their likeness — same face, same hair, same age. Do not
  redesign the person.` The cards came out as rendered photographs. This was a
  mistake on arrival — `docs/in-the-hospital-film/shot-list.md` already
  records **"Do not add 'same face and same hair' … it over-weights the face
  and hair specifically instead of letting the whole reference carry."**
- v2 dropped the preserve-list clause.
- v3 dropped `Do not redesign the person.` and the person's NAME — the name
  buys nothing when the photograph is right there, and a name in the prompt
  pulls on whatever the model thinks that name looks like.

The realism was never mainly the style reference; it was the photograph plus
these instructions. Adding preserve-list wording back will undo it.

## The nine cards

Built from the reference photos at Storage `nde-refs/people/`, the set Sophie
approved on the **Face check — the real people** Compare page (in the
`anthony-chene-nde-pipeline` chat — nine faces embedded as data URIs, which is
why searching Storage by filename never turns it up). Cards live at
`nde-watercolor/cards/card-<surname>-v3.webp`.

Hugenot, Wittbrodt, Wright, Barker, Hensley, Rynes, Dennis, Nair, Anthony.

**ONE style reference — `refs/sage-sandy-mirror.png`, nothing else.** A date-book
watercolour (`pavel.jpg`) was tried as a second style ref and rejected (Sophie,
Aug 2026). It did loosen the drawing, but so did trimming the likeness line, and
the trimmed line got there without a second reference.

One caveat carried over from the Face check page: **Hugenot's photo is him now
(~80) and his story is from age 17**. The age note goes in the SCENE half —
"drawn as he was at seventeen, a teenage boy" — never in the likeness line,
which stays one sentence. v1 put it in the likeness line and read closer to
mid-twenties; v3 reads properly young.

Older versions are kept in the Assets tab labelled "vN — superseded"; nothing
is deleted.

## The gap that is not solved

The nine cards are PROOF's cast. Across the other ten montages they cover only
about twenty of the ~130 panels — Wittbrodt (7), Wright (4), Dennis (4), Rynes,
Barker, Hensley, Nair (2 each). The remaining panels belong to roughly thirty
experiencers with **no reference photo**: Jeff Olsen, Ingrid Honkala, Heidi,
Ray, Deborah, Graeme, Nadia McCaffrey, Julien Chameroy, Jonathan Ashford, Karen
Thomas, Scott Drummond, Gabe Poirot, Jane Thompson, Tammy Lee Anderson, Rob
Gentile, Bill McDonald, Peggy, Chris Batts, John Paul Martinez, Vinnie and
more. New photos cannot be pulled from a cloud session — YouTube bot-blocks
datacenter IPs — and the face-check approval was a deliberate step of Sophie's.

Until she decides, the standing rule for a panel whose experiencer has no
approved card is: **do not invent a face for a real person.** Draw them from
behind, from above, or far enough back that the face is not the subject, and
let the panel be about what they describe. The Grass set follows this — only
Landon Dennis, who has a card, is shown face-on.

## Panel counts (final Episode Editor cuts)

Telepathy 39 · The Colors 13 · Deceased Loved Ones 12 · Life Review 12 ·
Realer Than Real 12 · Welcomed Home 11 · Universal Knowledge 11 ·
Not My Body 9 · The Music 6 · The Grass 5 — **130** panels, ~$7.80 at medium.
