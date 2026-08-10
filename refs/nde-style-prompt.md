# NDE illustration style prompt — canonical (v4)

ONE source of truth for the style language every NDE panel/page generation uses.
Change it HERE, bump the version, and update the generator scripts to match —
git history of this file is the audit trail Sophie asked for.

## History (why v4)
- v1 `nde-panel.py` (original 12 PROOF panels): "copy its drawing style,
  linework, hand-drawn texture, and muted palette EXACTLY, but do NOT copy its
  content, subjects, or composition" + "ONE single full-bleed vertical
  illustration … no text or lettering anywhere."
- v2 `nde-panel2.py` (mid-story B-panels): same, + a second-reference character
  continuity line.
- v3 `nde-panel3.py` (Assets-notes re-rolls): + "or any of its clothing" in the
  prefix and the wardrobe rule (no tank tops — the style ref's green tank top
  kept bleeding onto characters).
- One-off tests (the six text-only style probes, the first Penny grid page)
  used ad-hoc wording. v4 ends that: everything routes through this file.

## v4 — STYLE CORE (prepend to every generation)
The attached style images are STYLE references from one artist. Copy their
drawing style — hand-inked outlines, flat marker-like color fills, visible
warm paper texture, muted palette — but do NOT copy their content, subjects,
compositions, or any clothing that appears in them.

## v4 — FIGURE RULES (always included)
Every person is a full-bodied figure with real anatomy. An out-of-body spirit
is a full-bodied, slightly translucent copy of the actual person — real legs,
same face, hair, and clothing as their body — never a wispy or legless ghost.
Every person wears exactly the clothing described in the scene text; never put
anyone in a tank top, camisole, or sleeveless vest, and never take garments
from the reference images. Flat solid colors, no gradients.

## v4 — OUTPUT, single panel (append)
Render as ONE single full-bleed vertical illustration — a single image, NOT a
grid, NOT split panels, no borders, no caption boxes, no text or lettering
anywhere.

## v4 — OUTPUT, four-panel page (append)
Render as ONE comic page divided into four equal panels in a 2x2 grid with
clean gutters, telling the story in reading order; the same characters stay
visually consistent across all four panels. NO text, lettering, captions, or
speech bubbles anywhere.

## Reference images
- `refs/dream-mystery.jpg` (committed) — the original anchor page.
- `nde-refs/artist-1-groove.png`, `artist-2-figures.png`,
  `artist-3-fourpanel.png` — additional pages by the same artist, stored
  PRIVATE in the Deck Factory bucket (not committed, not public; fetch with the
  Admin SDK). Cropped from screenshots 2026-07-31.
- Real-face likeness refs ride as additional images per person (see
  `forge-characters` cards and `/home/user/out/ep1/faces/` on a live session).
