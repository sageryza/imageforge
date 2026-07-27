# Hand-drawn illustration style — test renders

Style experiment for the synchronicity-moment app surface: a delicate
hand-drawn ink look (thin uneven black outlines, flat pastel fills, generous
negative space). All renders are **gpt-image-2**, 1024x1024, PNG, via
`/v1/images/generations` — the same call shape `openaiImage()` uses in
`server.js`.

Every render here is the model's full-size output, unmodified.

## The moments

A "moment" in this app is a **random little synchronicity** someone notices in
their day — a small coincidence that reads as a wink. Not a sentimental
memory, not a life event. Sophie's canonical example:

> I saw two little girls holding hands, and then one of them picked a flower,
> but it was purple.

## What's here

- **`v1-memories/`** — the first pass, before the register was pinned down.
  Sentimental-memory moments (a heart in latte foam, a grandmother's
  handwriting, a hummingbird at the window). Kept because it's the clearest
  evidence for the finding below.
- **`v1-synchronicities/`** — style v1 on three real synchronicity moments.
- **`v2-synchronicities/`** — style v2 (content-stripped) on the same three
  moments, so v1 vs v2 is a controlled comparison.

Each folder has a `results.json` with per-render prompt, quality, wall time,
and token usage.

## Findings

**1. The moment's register matters more than the style prompt.** The same style
text produced noticeably different fidelity depending on subject. Sentimental
scenes (`v1-memories/`) pulled the model toward filling the frame — the
hummingbird scene accumulated a plant, a mug, a blanket, curtains, and a
flowerbed, against a brief that explicitly asks for restraint. Synchronicity
moments are *inherently* simple and pattern-shaped, so they land the style's
minimalism with no extra fighting. `three-birds--low.png` is the cleanest
render in the set and also the simplest moment.

**2. Tight single-object crops break the flat-fill rule.** `latte-heart--low.png`
came back with blended, airbrushed foam — effectively a gradient, which is
against the house rules. With one object filling the frame the model has
nothing to spend detail on but shading. Scenes with 2+ elements and real
negative space stay flat.

**3. `medium` is not simply "more detail" — it's more competent execution.**
Its effect depends on the moment:
- On a **complex** scene it adds *more stuff* (`hummingbird-hold--medium.png`
  gained curtains and a whole flowerbed) — further from the brief.
- On a **simple** scene it *cleans up* (`purple-flower--medium.png` has
  correctly connected hands, cleaner linework, less scattered ground clutter,
  and more open space than the low render) — closer to the brief.

So for simple synchronicity moments medium is a real upgrade, and for busy
scenes it actively hurts. Cost is ~4x and wall time ~2-3x (low 16-32s,
medium 52-58s).

**4. "No text or lettering" is worth keeping in the prompt.** Without it the
model letters things; with it, implied handwriting renders as illegible ink
squiggle, which is the desired effect.

**5. v2 fills backgrounds, because it dropped the background instruction.**
This is the biggest v1-vs-v2 difference and it's a one-line cause. v1 said
*"Clean white or cream background with generous negative space."* v2 says only
*"generous negative space"* — no background colour — while also asking for
**flat opaque fills** and listing **pale aqua** in the palette. The model
resolves that by filling the ground: `v2-synchronicities/three-birds--low.png`
came back with a fully painted aqua sky, where the v1 render of the same moment
sat on open cream. Same effect, milder, in the v2 purple-flower low render
(painted taupe ground).

Net character: **v1 is airier** (cream grounds, more open space); **v2 is
denser and more saturated** — closer to an actual printed sticker sheet, with
subtle paper grain and more incidental detail (v2's yellow-coat render added a
tree, a lamppost, a beanie, a handbag). Neither is wrong; they're different
products. If the app wants the airy look, **add v1's background line back to
v2** — that single sentence is the lever.

**6. Best single render in the set: `v2-synchronicities/purple-flower--medium.png`.**
v2's line quality plus medium's competence, and at medium it kept the cream
ground and open space that v2-low loses. That combination — v2 style, simple
synchronicity moment, medium quality — is the recommended default.

## Style v2 — the content-stripped version

Style v2 as supplied contained subject-steering language ("feminine mystical
stationery aesthetic", "boutique witchy stationery"). Those bias *what gets
drawn*, not *how it's drawn*, so they were removed to make the block reusable
for any subject. Everything mechanical was kept: line quality, flat opaque
fills, the palette list, negative space, and all four negative constraints.
"Independent sticker sheet or boutique stationery print" was kept as a craft
benchmark — it describes production quality, not subject.

```
ILLUSTRATION STYLE:
Delicate hand-drawn ink illustration with thin, slightly irregular black
outlines and flat opaque pastel color fills. Whimsical modern folk art.
Simplified shapes, charming imperfections, restrained detail, minimal or no
shading, and generous negative space. Use dusty blush, muted coral, pale aqua,
mustard gold, lavender-gray, cream, and soft taupe. The result should resemble
a thoughtfully designed independent sticker sheet or boutique stationery print
— not polished vector clip art, not watercolor, not realistic, and not
cartoonish.

Turn the described moment into one clear, simple visual scene. Focus only on
the most emotionally meaningful action or object. Keep the composition
uncluttered and easy to understand at a glance. No text or lettering anywhere
in the image.

THE MOMENT:
<the moment>
```

## Reproducing

The generator scripts are `run-style-test.js`, `run-sync-test.js`, and
`run-style-v2.js` (archived in `scripts/`). Each takes `OPENAI_API_KEY` from
the environment and writes full-res PNGs plus a `results.json`.
