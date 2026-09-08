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
