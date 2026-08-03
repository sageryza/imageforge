# Art Mason — noise-art story (pastel vertical short)

The "Art Mason" story: Mason, a poet-philosopher noise artist, feeds inputs
through transformation after transformation until the result *looks* like art —
and the chapter asks who the artist really is, the maker or the viewer whose
metaphor machine finds the meaning. Ends on the checkout-counter sculpture and
"where do you crop art?"

Source: Sophie's voice-memo run of 2026-07-29, 1:47–2:05 pm (eight recordings,
in the memo archive; the 2026-07-28 "metaphor machine" memo is the foundation
concept). Transcripts stay in the private archive — do not commit them here.

- **`render-panels.js`** — renders the 18 storyboard panels: pastel V2
  (`house-pastel` — gpt-image-2 EDITS with the witch-school style refs,
  whitened background) at 1024x1536 (2:3 portrait, per the pipeline
  recording). Mason is a consistent character (reddish shoulder-length hair,
  poet-philosopher beard, sage-green sweater). Uploads to deckfactory Storage
  `story-shorts/art-mason/<id>.webp` (public). Needs `OPENAI_API_KEY` +
  `FIREBASE_SERVICE_ACCOUNT`; run with `NODE_PATH` pointing at installed
  `firebase-admin` + `sharp` (or from the repo root after `npm install`).
  ~$0.90 for the full set at medium.
- **`panels.json`** — the rendered set: id, Assets-tab label, content prompt,
  public URL, generation time. v1 filed to the `nde-precision-cutting-doc`
  chat's Assets tab + My Creations + a Compare page ("Art Mason — storyboard
  v1") on 2026-08-02.

Image-concept formula (from the pipeline recording of 2026-08-02): pairs go
literal first, then the emotional/metaphorical/dream take on the same concept
with the people and conversation unchanged; animating between the two panels
later makes the leap read as commonplace (wan `last_image` pair conditioning,
as in movies.js).

Next steps: Sophie reviews/culls in the Assets tab → re-rolls → voiceover cut
from the actual recordings per `docs/nde-precise-cutting.md` (the memo audio
is in membry Storage `memo-audio/`) → animate literal→metaphor pairs → stitch
(lift `scripts/story-short-pastel/` stages 2–5).

## v2 (2026-08-02) — the animal-bleed fix

v1's panels all inherited the cat/dog/mouse/snake from the style refs
(`style-2.png` is the woman surrounded by five animals; the EDITS endpoint
bleeds ref content). Root causes and the v2 fixes, per the established
exact-prompt patterns from the witch-school `na-*` noise-art set:

- **Character lines only where a person belongs** (`char: true`) — v1 stamped
  Mason + the woman onto every panel, inviting people (and their ref-animal
  entourage) into bare diagrams.
- **Explicit guards** on every panel: "definitely NO animals or creatures",
  "Nobody, no people" on diagrams, "NOT the recurring woman" on Mason.
- **Reused the proven `na-*` content prompts verbatim** (bouncer, viewer,
  campfire, wider net, zoomout5, beef jerky, split, teacup, gold frame,
  ambiguous checkout, pipeline-v2 with the orange pipe / simpler tubing /
  picture hung high), adapted square → 2:3.

`render-panels-v2.js` + `panels-v2.json`; images at
`story-shorts/art-mason/v2/`. v1 tiles stay in Assets labeled superseded.
