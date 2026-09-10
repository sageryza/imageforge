# The belt, version by version (audited 2026-09-08)

Sophie, 2026-09-08: *"are chats importing wrong versions · check every version ·
see maybe some even have additional features i asked for that didn't reach all
of them."*

There are five live belt pages, built from four copies of one builder. Each copy
was made by a chat copying its neighbour, so a fix or a feature lands where it
was asked for and nowhere else. This is what each one had the morning of the
audit, measured against the LIVE posted html rather than the repo.

## The live pages

| page | chat | builder |
|---|---|---|
| The soap pill scene v8 | `soap-pill-scene` | `soap/belt-soap.py` |
| Two scenes — the shock treatment, the door v19 | `hospital-severance-rough-cut` | `rough-cut/belt-48.py` |
| Her scenes — the belt v9 | `hospital-night-film` | `belt/belt-md.py` |
| The climax — her scenes v1 | `climax-dissociation-accounts` | `belt/belt-md.py` (`BELT_CHAT`) |
| Her scenes — the belt v5 | `severance-api-multiple-frames` | `belt/belt-md.py` / `belt/conveyor.py` |

## What each had

`✓` = had it, `✗` = missing, `→` = brought over by the 2026-09-08 repair.

| | soap | rough-cut | night film | climax | severance |
|---|---|---|---|---|---|
| a save is read back, nothing cut (was: `slice(0,1900)`) | ✓ | ✓ | → | → | → |
| the box refuses over 8,000 and says by how much | ✓ | ✓ | → | → | → |
| `cut` on a line of its own counts the pieces | ✓ | ✓ | → | → | → |
| redo-notes fold on every card | ✓ | ✗ | ✗ | ✗ | ✗ |
| "what came before", her own, folded above the scene | ✓ | ✓ | ✓ | ✓ | ✗ |
| the reference lines are hers to edit | ✓ | ✓ | ✓ | ✓ | ✗ |
| seconds left blank = the model picks, priced per second | ✓ | ✗ | ✗ | ✗ | ✗ |
| a chat can post its own slice (`BELT_CHAT`/`BELT_KEYS`/`BELT_SEED`) | ✗ | ✗ | ✓ | ✓ | ✗ |
| the whole script in one box (the Script card) | ✗ | ✗ | ✗ | ✗ | ✓ |
| the caret stays above the keyboard | → | → | → | → | → |

## What the repair did, and what it deliberately did not

**Did.** `scripts/fix-belt-truncation.js` patched the three truncating pages —
the POSTED html, byte for byte, with only the saver swapped — re-posted each as
the next version and superseded the old one. Measured before and after on the
live html: 2,500 characters typed into a box saved **1,900** before and **2,500**
after. Her edits live on the verdict sheet and were never touched.

- Her scenes — the belt v10 · `KMGpzR0LNsbk1nVobmEl` (hospital-night-film)
- The climax — her scenes v2 · `PjmfmsULmYB1wtn8TvM1` (climax-dissociation-accounts)
- Her scenes — the belt v6 · `DUiWxHnl0Khm0ymj02QE` (severance-api-multiple-frames)

**Did not.** A REBUILD would have lost work: measured against the live v9, a
rebuild from the committed `jobs-md.json` drops 9 stills, a video and seven of
her reference-line edits, because the chat that posted it has newer job data in
its own container. So the boxes that are missing from the MARKUP — the
redo-notes fold, the model's-pick seconds — are still missing on those three
pages, and belong to the owning chat's next build. Both builders carry them now
(`belt-md.py`, `conveyor.py` got the saver; the redo fold is soap's alone).

**The state files in this repo are behind the chats' own** — `belt-md-state.json`
says v6 while the live page was v9 — so they were left alone. A chat re-running
its builder should read its own state, not this one.

## The guard

`node scripts/test-belt-save-guard.js` sweeps every page builder in the repo and
fails on a save that cuts her words, or on a scene box with no read-back. That
is the durable half: the next copy of the belt cannot lose the fix quietly.

---

# The SCENES-INDEX pages, level (2026-09-10)

Sophie: *"add send to footage button · and chapter buttons etc · so light blue
ward, nautch and ticky tack all have all features."*

One level up from the belts, the same story: a scenes-index page is the wall of
little 3-D keys — one key a scene, in shooting order, a tap opening that
scene's card on its belt page — and there are three of them, each built by a
chat copying its neighbour. Measured against the LIVE posted html that morning:

| | ward (light blue) | nautch (beige) | ticky tack (red) |
|---|---|---|---|
| a Send-to-Footage key on every tile | ✓ | ✗ | ✗ |
| the chapter rail down the right side | ✗ | ✓ | ✗ |
| folding a chapter away | ✗ | ✓ | ✗ |

Every feature on exactly one page. Two of the three builders live in another
chat's container and are not in this repo at all, so a builder fix could not
have reached them even if it existed.

## What was done, and why it is not a fourth copy

The three behaviours live in **`public/scene-index.js`**, one SERVED file, and
a page opts in with one line after `/compare.js`:

    <script src="/scene-index.js"></script>

It reads the markup all three pages already share — `.grid`, `.ep` headings,
`a.b[href="/api/chatfeed/page/<belt>#j-<key>"]` — and builds only the halves
that page does not already have, so nothing is taken away: the nautch page
keeps its own fold and rail, the ward page keeps its own footage keys. **The
belt names itself** (`var CHAT='…', SHEET='…'` on every belt page), so the
hand-off needs no map of pages to chats.

`scripts/level-scene-pages.js` added that one line to the four live page docs
(the Nautchaug page is posted into two chats) — the POSTED html, byte for byte,
re-posted as the next version with the old superseded. **No page was rebuilt**:
the belt repair above measured a rebuild losing 9 stills, a video and seven of
her reference-line edits, and the same holds here.

- The ward film — the scenes v4 · `ward-film-page-duplicate`
- The Nautchaug Boyfriend's — the scenes v7 · `new-script-draft`
- The Nautchaug Boyfriend's — the scenes v7 · `icon-styling-beige-3d`
- Ticky Tack — the scenes v3 · `ticky-tack-film-page-dupe`

**The next fix reaches all three the day it deploys, with nothing re-posted.**
That is the half that stops this drifting a third time.

## Three things measured rather than reasoned

- **The keys go on BEFORE the fold.** A tile gains a `.cell` wrapper, and it is
  the wrapper that is then the grid's child — a fold built first owns the
  tiles and hides nothing (six keys still showing under a shut heading).
- **A page with its OWN fold hides the tile, not the wrapper.** The nautch
  fold runs before the kit and holds references to the bare `<a class="b">`,
  so a folded chapter would be a row of empty grid cells;
  `.grid > .cell:has(> .b.hid)` follows the tile down.
- **A 56px rail key holds about one word.** The heading is cut at its dash
  (or its comma or slash), and a phrase too long to render is boiled down to
  its LONGEST word — "the two beginnings" → BEGINNINGS, "recommend keeping" →
  RECOMMEND, "the sculptures" → SCULPTURES. Measured on her three pages that
  is the difference between a rail of words and a rail of `TWO BEGI…` /
  `RECOMM…` / `SCULPTU…`; no label is cut now. The full heading is on the
  button's title and aria-label either way.

Test: `node scripts/test-scene-index.js` (the kit on all three real shapes,
every assertion a measurement; `--live` also checks the posted pages link it).

## And the Ticky Tack review DECK, which is a different page again

`Ticky Tack — the scenes (56)` in `tiki-tack-draft-commit` is a stock DECK of
her scenes, not a scenes index — so the kit does not reach it, and its own
builder (`scripts/ticky-tack-scene-deck.js`, in this repo) had gained
`it.footage` per card AFTER v2 was posted. A posted page is frozen, so the
button was in the builder and on none of the 56 cards. Re-posted as **v3**,
which was free: measured before touching it, her verdict sheet held no mark
and no note on that deck, only her place.
