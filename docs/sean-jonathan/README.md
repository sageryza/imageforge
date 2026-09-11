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
| the two already-drawn scenes, verbatim off the job log | `shot.json` |
| her typos, fixed on the way onto the page | `typos.json` |
| what the model invents, and who has to match it | `continuity.json` |
| the still grabber | `scripts/sean-jonathan/grab-still.js` |
| the live page | `sean-jonathan-script` → Compare tab, *Sean & Jonathan — the draft belt v5* (`Gl0oN5KcfHjTzbIpHrhw`) |

## THE RUNNING ORDER, AND WHY IT IS HERS

2026-09-11, her second message, two scenes run together with no `cut` and
*"slot these in best order."* Her own words chain end to end, so the order is
**read off them** rather than chosen — each link is a sentence answering the one
before it:

| # | key | scene | |
|---|---|---|---|
| 1 | `sj-a` | The couch | **shot** — ends *"i can run faster than you too!"* |
| 2 | `sj-b` | My couch, my bedroom | **shot** — ends *"we have to sleep in the same bed"* |
| 3 | `sj-c` | I just moved IN | opens *"no it doesn't"*, ends *"rubs into the kitchen"* |
| 4 | `sj-d` | The kitchen | opens *"now they are in the kitchen together"* |
| 5 | `sj-1` | The tea party | opens *"…out of the **kitchen cabinet**"* |
| 6-10 | `sj-2`…`sj-6` | Get out · Weeks pass · The white paint · Bedtime · A whole new world | |
| 11 | `sj-e` | The rain | the ending — sean in his lap under the blanket, the same couch he stood ON in card 1 |
| 12 | `sj-cast` | The cast | **reference** — the two videos, playable, no shot |

## A CARD THAT NAMES SOMEONE ELSE'S TITLE SAYS SO

2026-09-11, Sophie: *"will it trip on wonka lion king etc?"* Two cards name a
title — *A whole new world* (Aladdin, and Willy Wonka) and *The rain* (the Lion
King) — and `IP_TITLES` in the builder scans her own scene words for them, so the
warning can only ever land on a card that really names one.

What is measured, and it is the reason the note says *try it*:

- Seedance 2.0 took a **Disney cease-and-desist on 2026-02-13** (Paramount
  Skydance, Netflix, Warner Bros. Discovery, Sony and Universal behind it) and
  ByteDance said on 02-15 it would stop generating IP-protected characters.
- There is an **OUTPUT gate**: a clip draws for a full minute and then fails with
  *"the output video may be related to copyright restrictions"* (`1012004`).
- It is **probabilistic and per MODEL** — it refused a plain reference-free
  dialogue prompt twice on 2.0 Fast and drew the same prompt on Mini, which is
  what this belt uses.
- **A blocked job is unbilled.** Both blocked jobs on file left no
  `generation_id`. So finding out costs the wait and nothing else.

The fix if it trips is to take the title out of the words, not out of the scene:
the TV can be a glow on their faces with the screen off-frame, and the song can
be sung without being named.

## HER FILES ARE NEVER EDITED — `typos.json` IS THE FIX

2026-09-11: *"fix those two typos. are there anymore"*. `script.md` and
`shot.json` keep her words exactly as she said them, because they are the
record; the corrections happen on the way onto the page. Each one is a line in
`typos.json` (`find` · `replace` · `why`, and `hers: true` for the two she named
herself) and the card says how many landed on it.

**A `find` MUST MATCH EXACTLY ONCE across the whole script or the build
REFUSES.** A fix that stopped matching would fail silently and leave the typo on
the page; one that matched twice would rewrite a scene she never looked at.

**Only mechanical fixes go in there.** A missing space, an apostrophe, an
unclosed quote, one word that is plainly another (`rubs` → `runs`, in a sentence
that already says *"about to run into the kitchen"*). Anything where the fix
could go two ways is NOT a fix — it goes to her as a question instead.

## THE ROOMS ARE SCREENSHOTS — `continuity.json`

2026-09-11, Sophie: *"we need to take screenshots of any rooms it invents or
objects that repeat."* Ten scenes drawn as ten separate clips means the model
invents the apartment ten times over. The reference VIDEOS carry the two men;
nothing carried the rooms.

So each thing is grabbed ONCE out of the clip that establishes it and rides as a
reference IMAGE on every later card that needs it:

    node scripts/sean-jonathan/grab-still.js --list
    node scripts/sean-jonathan/grab-still.js --key kitchen --at 6.5        # dry
    node scripts/sean-jonathan/grab-still.js --key kitchen --at 6.5 --go   # files it

**It costs nothing** — one download, one ffmpeg frame, one upload, all on our own
box. **Dry by default on purpose**: it writes the frame to /tmp and prints the
path so it can be LOOKED AT before it starts steering ten clips. Re-running is
free and idempotent (the Dump dedupes by content hash).

**The frame is pulled at the clip's own resolution and never scaled**, and the
clip is never touched — *nothing stands between the source and the output*.

Grabbed (from the two drawn clips): **the living room** · **the bedroom** ·
**what they are wearing**. Waiting on their scenes: the kitchen, the oven, the
dining table. Each card says which it is missing and which card will make it.

**THE VIDEOS LEAD AND THE STILLS FOLLOW.** The footage page slots by the order of
the list, so a still slipping in front would move `[Video1]`/`[Video2]` out from
under her who's-who block. Images and videos are numbered separately, so a card
reads `[Video1] [Video2] [Image1]` and the header names the still by its slot and
never describes it.

**A CHAINED CARD ASKS FOR NO STILL.** `sj-c` continues the clip before it, which
already carries that clip's room and its clothes; adding the same room again as
a still would be the same fact twice. A test pins it.

**`neededBy: []` MEANS A RECORD, NEVER A REFERENCE** — the front door, the
skylight, the easy chair, the desk, the bathroom each appear in one scene only,
so nothing has to carry them and they never ride a card.

## THE CAST CARD

2026-09-11: *"can u also add the original two [reference videos] in case i find
better videos."* The last card is the two reference videos themselves, playable,
named by slot and by file — not a scene, so it carries no Footage button, no
seconds and no price. Swapping one is two lines in `refs.json` and a rebuild,
and it reaches all ten scenes at once.

**A KEY IS IDENTITY AND A NUMBER IS A POSITION.** Her typed edits live on the
verdict sheet under the card's key, so the tea party is still `sj-1` while it is
the FIFTH card. Slotting a scene in never renumbers a key — that would re-point
every edit and every note at a different scene (the Compare pages' *an item's id
is its identity* rule). `RUNNING` in the builder is the order; the numbers fall
out of it.

**A CARD THAT CONTINUES A CLIP CHAINS OFF THAT CLIP** rather than the who's-who
pair — `[Video1]` is the shot before it, and the header says
*this scene continues [Video1].* That is how she drew scene 2 herself. It needs
the previous clip to EXIST, so today only `sj-c` chains; once `sj-c` is drawn,
its clip is one tap away in the Footage page's RECENT drawer for `sj-d`.

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
