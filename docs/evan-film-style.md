# The Evan film — established style + character references

The art style for the **Evan** story (Story Room `forge-story/evan`, eventually
animated). Settled with Sophie in August 2026 after a run of side-by-side tests.
This file is the record — use it, don't re-derive it.

## The style prompt: there ISN'T one

**The rule that matters: do NOT write a style description.** No ink, no
watercolor, no line-quality adjectives, no palette, no negative prompt. The
reference image carries the entire look on its own, and every written style
block that was tested made the result worse — more generic, more "illustrated",
less like Sophie's own page.

Two earlier variants (a long ChatGPT-written style block and a Claude-written
one) were tested and **rejected** — she disliked the ChatGPT one explicitly.
They are deliberately not recorded here; reintroducing either is a regression.

Send exactly this, then the scene:

```
Use the attached image as a style reference. Only use its style, not its
content — do not copy anything depicted in it. You do not have to copy its
colors.

Draw: <the scene>
```

Releasing the colors is deliberate and load-bearing — it's what lets the art
use natural browns, skin tones and greys instead of forcing the scan's
crimson-and-plum palette onto every frame.

## How to call it

- OpenAI **gpt-image-2**, the **image edits** endpoint
  (`POST https://api.openai.com/v1/images/edits`), with the style reference
  attached as `image[]`.
- **quality: `medium`** — not high. Tested repeatedly: high spends the extra
  budget on smoother washes and a more finished, illustrative look, which moves
  away from the sketchbook feel. Medium also costs less.
- **size: `1024x1536`** (portrait, 2:3). The existing Evan story art is 2:3
  portrait and everything new has to match it.
- Requests can run long; retry on an undici headers timeout rather than failing.

## The reference files

- **Style reference — `refs/evan-film-style.png`** (Sophie's own scanned
  sketchbook page, "datescan0013"). Also public at
  `https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/refs/datescan0013.png`
- **Evan character reference — `refs/evan-character.png`**. Sophie picked this
  one (hearted it) as the definitive Evan: it's the medium, no-style-prompt
  render of beat 6. Public at
  `https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1785805498733-yzyi2s.png`
  Attach it as an extra `image[]` reference in any scene Evan appears in, after
  the style reference, and restate the preserve list ("same face, hair and
  build — do not redesign the character"), per the character-anchor technique
  already used by the movies pipeline.
- **The girl character is NOT settled yet** (August 2026) — she's being
  iterated on one scene at a time. When Sophie picks one, save it as
  `refs/evan-girl-character.png` and add it here the same way.

## Character descriptions (Sophie's own words)

- **Evan** — "shoulder length brown hair, blue eyes, kind of a long face with
  an elongated forehead, but not anything crazy. He's a male about five nine."
- **The girl** (the narrator, on the other end of the phone) — "curly brown
  hair in a high ponytail with loose strands hanging down around her face …
  that or braids, she could have a different hairstyle in one image or not.
  Doesn't matter."

## Filing the results

Normal Assets rules (see CLAUDE.md), plus one from this project: **put the
quality in the tile LABEL**, leading — `MEDIUM · Evan beat 6 — …`. The caption
and the prompt note carry it too, but the label is the visible place when
comparing two versions of the same shot.
