# Sean & Jonathan — the film, and its belt

A second film, separate from the ward film under `docs/mental-hospital/`. Her
own two clips for it (2026-09-10 night) were **Seedance 2.0 Mini · 480p · 3:4 ·
15s · sound on, through Atlas Cloud**, drawn on `/footage`, and that is the
shape the belt hands over.

| what | where |
|---|---|
| her script, verbatim | `script.md` |
| the who's-who block + the two reference videos | `refs.json` |
| the belt builder | `scripts/sean-jonathan/belt.py` |
| the test | `node scripts/test-sean-jonathan-belt.js` |
| the live page | `sean-jonathan-script` → Compare tab, *Sean & Jonathan — the draft belt* (`Zsr6Vu1fNtfvpWQy69To`, v1) |

## THE TWO VIDEOS ARE THE WHOLE CAST, AND THE SLOTS ARE HERS

2026-09-11, Sophie: *"take the beginning of my original sean jonathan scene that
has the videos that says who's who."* That beginning is footage job
`86532d0c923d401a8b29060dd673670a` and it is in `refs.json` word for word:

```
sean (brown haired boy, [Video2])

jonathan (blond haired boy, [Video1])

sean voice

jonathan voice
```

- **[Video1] · jonathan** — `drops/_/01433479f5292d2a66ffcbd67fb8d570.mov` (`IMG_0575.mov`)
- **[Video2] · sean** — `drops/_/8635b6017251e49d5ec0c5a491305868.mov` (`IMG_4753.mov`)

**THE ORDER IS LOAD-BEARING.** The footage page assigns `[Video1]`, `[Video2]`
… by the order of the refs list, so swapping the two entries swaps who is who
in every prompt while the page goes on looking correct. `refs.json` carries
`_slot`/`_who` for that reason and the test asserts the pairing.

Her wording describes each man's hair, which the house rule would normally
forbid (*a reference is never described in the prompt*). It stands because it is
**her own prompt, sent as given** — and it is in a box she can edit.

## HER `cut`s ARE THE SCENES

`script.md` is her dictation verbatim — her spelling, her line breaks, her
`cut`s — and the builder splits on a line reading only `cut` and nowhere else.
Six scenes. Nothing is added, dropped, merged, reordered or tidied: the Story
Timeline's rule (*"did u add delete or change my words · if so undo"*) applied
to a script. The card **names** are the only words on the page that are mine,
plus one `setting:` line per card that names the room and nothing else.

**One thing left exactly as she said it, deliberately:** scene 4's *"jonathan's
tongue is in jonathan's mouth"*. It is hers to change, in the box on the card.

## THE BUTTON SENDS NOTHING

*Send to Footage* writes the hand-off (`footage_handoff` in localStorage — the
header, the scene, both videos, Mini · 480p · 3:4 · her seconds) and walks her
to `/footage`, where the star is still her tap. ~16.5¢ a 15-second card at
Atlas's ~1.1¢/s, ~$1 for all six.

## REPAIRING THE LIVE PAGE

A posted page is FROZEN, and a rebuild can lose whatever the owning chat has in
its own container. There is nothing in a container here — the page is built
entirely from these two committed files — so a rebuild is safe for THIS belt and
a re-post plus a supersede is the update:

    python3 scripts/sean-jonathan/belt.py --post --supersede <old id>

Her typed edits live on the verdict sheet (`belt-seanjonathan`) and are never
touched by a rebuild; the page reads them back on open and they win over the
words baked into the html.
