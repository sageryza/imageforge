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

## The shape (2026-08-10) — glance summary sheets + the pad story

The Evan-style "shape of the story" pass, rebuilt from the SOURCE recordings
(the eight 2026-07-29 memos + the 2026-07-28 metaphor machine memo), not from
the earlier panel sets. Four 2x2 comic sheets at gpt-image-2 **low**
(1024x1536; each quarter is 2:3), locally bisected into 16 panels (free), all
filed to the `mason-noise-art-summary` chat's Assets tab with exact prompts.
Style = the established Mason watercolor recipe: datescan0013 style ref (+
mason-char-ref on the Mason sheets, both at membry
`claude-deliveries/refs/`), plain wrapper, no style description, the
colors-don't-have-to-match line, plus the Evan sheets' 2x2 layout line and
no-lettering line. Images at deckfactory Storage `story-shorts/art-mason/shape/`
(sheet-N.png full-res originals, panel-Nx.webp display crops).

The 16 panels are also laid out as the pad story **"Mason — the shape"**
(`forge-scratchpad`) in story order with one-line descriptions and Sophie's
frame colors (mustard/green/blue/pink per her color system; chains on the
dots+teacup pair and the two frame-stamp beats). Panel content prompts stay
out of the repo with the transcripts; the exact prompts are on the Assets
tiles (PROMPT button) and on each pad beat's `src.prompt`.

## Watercolor style test (2026-08-03)

New style direction Sophie is testing: the loose ink-and-watercolor
sketchbook look. Ref = `datescan0013.png` (membry
`claude-deliveries/refs/`, one of her date-journal scan pages; the same
family as the "style-references-for-ai" Dump album's portrait cluster).
Formula from her `chatgpt-image-style-reference` test chat — the plain
wrapper WON over every styled prompt, so add NO style description:

    Use the attached image only as the style reference — do not copy its
    content. Draw: <content>

Quality via `WC_QUALITY` env (`high` default, `medium` → `-med` ids; both rendered 2026-08-03, high-vs-medium Compare page filed). 1024x1536, no whiten (the
paper look must survive). Mason is a poet-philosopher with round glasses
— NOT a Viking. `render-wc-test.js` + `panels-wc.json`; images at
`story-shorts/art-mason/wc-test/`.

### Compare pages need DISPLAY COPIES, not the originals

The watercolor renders are full-res PNGs (~2–3MB each). Eight of them on one
Compare page was **20MB** — unusable on a phone. Same lesson as
`scripts/selfcare-thumbs.js`: serve a resized webp and keep the original as
the untouched full-res file (Assets tiles still point at the originals).

    sharp(file).resize({ width: 720 }).webp({ quality: 82 })
    → story-shorts/art-mason/wc-test/thumbs/<id>-<tier>.webp   (~90–200KB)

720px wide is plenty for a two-per-row layout on an iPhone 13. That took the
high-vs-medium page from 20MB to 1.1MB.

## The eight source recordings — audit (2026-08-26)

Sophie asked whether all eight of her descriptions from that one day were
still there. **They are** — her own transcripts of all eight sit, verbatim and
in order, in the `Where Do You Crop Art?` story pad's `description`
(`forge-scratchpad`, ten paragraphs: a header line, the eight transcripts, and
her closing note). Each paragraph was matched back to its recording through
the search index, so the mapping is measured, not assumed:

| # | memo id (search index) | title | len |
|---|---|---|---|
| 1 | `2026-07-29_1347_2026-07-29T20_47_18Z` | Concept of Noise Art | 181s |
| 2 | `2026-07-29_1351_2026-07-29T20_51_55Z` | Visual Concept for Noise Art | 107s |
| 3 | `2026-07-29_1354_2026-07-29T20_54_01Z` | Visual Concept for Image Design | 52s |
| 4 | `2026-07-29_1355_2026-07-29T20_55_30Z` | Metaphor for Artistic Interpretation | 103s |
| 5 | `2026-07-29_1357_2026-07-29T20_57_38Z` | Art Process and Sculpture Concept | 111s |
| 6 | `2026-07-29_1400_2026-07-29T21_00_14Z` | Art Recap Animation Concept | 136s |
| 7 | `2026-07-29_1403_2026-07-29T21_03_12Z` | Expansion Concept Discussion | 114s |
| 8 | `2026-07-29_1405_2026-07-29T21_05_28Z` | Exploring Noise in Art | 95s |

15 minutes in total, 1:47–2:05 pm — which is where the README's "eight
recordings" line above comes from.

**What WAS missing: the audio.** Only ONE of the eight (1357) was attached to
that story, so the waveform button played one recording out of fifteen
minutes; the other pads in the Mason folder held two (`Mason — the noise art
pipeline`) and three (`Mason — the shape`) as candidates. All eight are now
attached to `Where Do You Crop Art?` in chronological order via
`POST /api/scratchpad/audio` — not as candidates, because her own transcript
of each one is in that same pad, which is not a guess.

**Still open, and hers to call — two of the eight never became beats.** The
pad's 13 beats cover recordings 1-6; #7 (the wider net + the five-rectangle
"you are here" diagram) survives only as half of beat 9, and #8 (the campfire
— noise turning into patterns, plus "research real artists with a weird
process") has no beat at all. The art for all three already exists in
`panels-v2.json` (`wider-net`, `zoomout-diagram`, `campfire-flames`), so this
is a writing decision, not a render. Do not add the beats without asking —
what goes in the story is Sophie's.

Also unexplained, left alone: `Mason — the shape` carries a
`2026-03-03_1217` source ("Reflections on Day and Ideas", 26 min) flagged
`candidate:true` — a chat's guess that nobody has confirmed.
