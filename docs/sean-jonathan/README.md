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
| the retaliation scene (MINE, a draft for her) | `retaliation.md` |
| the live page | `sean-jonathan-script` → Compare tab, *Sean & Jonathan — the draft belt v11* (`Nr5qmODNwFohgneMPVzS`) |

## THE FILM, AND THE TWO LINKS THAT ARE NOT THE SAME LINK

The cut doc IS the film: **`9WyQ1XE8OvQXrNtnvfsD`**
(`https://imageforge-q125.onrender.com/filmeditor?c=9WyQ1XE8OvQXrNtnvfsD`), built
from the belt order by `scripts/sean-jonathan/build-cut.py` and rendered in the
container (`node scripts/filmcut.js render 9WyQ1XE8OvQXrNtnvfsD`). Renders never
overwrite: `filmeditor/<cut>/film-<n>.mp4`, newest wins. v3 is the pin.

**The pin is how she WATCHES it; the Dump link is how she SAVES it.** They are
different things and a reply gives whichever one the sentence is about (house
rule 3d2 — a `/api/drop/file/<id>` link downloads, so it is never the way to
watch something).

### THE CLEAN EXPORT — 2026-09-11, *"how do i download it to send to my friend wesley"*

House rule 3e, for every final video going out to a person. A stream copy with
the metadata stripped, so the pixels are **byte-identical** and only the
container's tags change:

    ffmpeg -v error -i final.mp4 -map 0 -c copy -map_metadata -1 \
      -movflags +faststart -fflags +bitexact -flags:v +bitexact -flags:a +bitexact \
      "Sean and Jonathan.mp4" -y

**Verified rather than assumed:** the decoded video stream hashes the same
before and after (`MD5=6e01d56f206c7960bedd64cff24c1f90` both ways) and
`ffmpeg -i` shows no encoder line. 44,216,711 → 44,216,683 bytes — 28 bytes of
tags, and not one pixel.

Filed into the Dump with a real filename:
**`wIEEG22Zaw0GtrMBaEOS`** →
`https://imageforge-q125.onrender.com/api/drop/file/wIEEG22Zaw0GtrMBaEOS`.
**The Dump's filename slug drops an ampersand**, so it downloads as
`Sean Jonathan.mp4` rather than `Sean & Jonathan.mp4` — cosmetic, and worth
knowing before promising a filename in a reply.

### AND A SMALL SHARE COPY — 2026-09-11, *"it's too long won't send to wesley"*

44MB is past what a messaging app will carry, so there are two answers and they
are different things:

**A LINK, which is the real answer, because a link does not care how big the
file is.** Every Dump object is PUBLIC and served `video/mp4` with **no
content-disposition**, so the raw Storage url PLAYS inline in any browser with
no login — measured, both copies. That is what you text a friend.
`/api/drop/file/<id>` is the SAVE link and always sets `attachment`, so it is
never the one to send (house rule 3d2).

**A SMALLER FILE, for when she wants to attach one anyway.** This is a DERIVED
display copy — the webp rule applied to video — so unlike the clean export it
is genuinely re-encoded and the pixels are NOT identical:

    ffmpeg -i "Sean and Jonathan.mp4" -c:v libx264 -crf 30 -preset slow \
      -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart -map_metadata -1 \
      "Sean and Jonathan (small).mp4"

**44.2MB → 12.9MB, a 3.4x cut**, same 560x752, same 2:45, video 1936 → 519 kb/s.
PHOTOGRAPHED before it was handed over: four moments pulled from both copies and
stacked side by side (`/tmp/sjc/cmp-strip.jpg`) — indistinguishable at this frame
size, which is the only reason crf 30 is defensible on a film. **Look at the
strip before shipping a re-encode; a bitrate number says nothing about a face.**

| | id | link |
|---|---|---|
| full, clean | `wIEEG22Zaw0GtrMBaEOS` | `drops/_/a51bf794fe29ec67597c153196faf8e4.mp4` |
| small, share | `f0Y6yFw2EjiXiKh7XoXi` | `drops/_/8d43b0066269f2029ba6a33d66253d8d.mp4` |

**The originals are untouched and stay** — `filmeditor/9WyQ1XE8OvQXrNtnvfsD/film-3.mp4`
is still the render and still the pin.

## WHAT MINI GOT WRONG, AND WHAT IS STILL WRONG IN v3

2026-09-11, her notes watching it back, and each one is a line in `herLines`
(`refs.json`) sitting on its card, waiting for a re-shoot she has not asked for:

| what | card | on the card since |
|---|---|---|
| the teapot and cups drew as one fused object | `sj-1` | v2 |
| the thrown cookies hang in midair | `sj-3` | v2 |
| sean's tank top changes colour | all | v2 |
| jonathan PULLS the curtain closed instead of the rod falling | `sj-4` | v3 |

Her word on the film as it stands is **"it's good enough"** — so the three
re-shoots (~50¢ at Atlas) are offered and NOT authorised. Don't send them
without her.

**WHY IT INVENTED SO MUCH DIALOGUE**, since it is the most useful thing this
film taught us: *anything in the prompt the model cannot SHOW, it SAYS.* The
who's-who block carries both men's heights, and a height is not a shot — so
mini put it in their mouths, and the funniest lines in the film are ones she
never wrote. The same mechanism is why the curtain would not fall: *the rod
falls* is an event with no actor, so it reached for the commonest curtain
action instead. Give an unshowable fact a body or it becomes a line; give an
event a cause or it becomes the nearest thing that has one.

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

## TWO LINES ARE MINE, AND THE CARD SAYS SO

2026-09-11, Sophie: *"do u think there's any continuity lost that needs words?"*
Yes — two things, and neither can be carried by a still or a reference video.
They live in `mineLines` in `refs.json`, apart from her own who's-who block, and
the card names them as mine word for word.

- **"jonathan wears his glasses."** — her two takes disagree. He has them in
  `[Video1]` and in both drawn clips; he does not in `[Video3]`. Nothing but a
  word settles which, and the drawn clips are the film.
- **"night, the lamps on, dark outside."** — on `sj-c`, `sj-d`, `sj-1` and `sj-2`
  only. Cards 1 to 6 are ONE continuous evening (the drawn clips are lamp-lit
  with the windows dark) and nothing in a still says what time it is, so a
  kitchen drawn in daylight would fight the clip before it. Off after weeks pass.

Both are READ OFF the drawn clips rather than invented. **The six of wave 1 were
sent before these existed**, so they carry neither.

## STILL OPEN, HERS TO CALL

- **Where the dining table lives.** Her script says "dining room table" and the
  apartment in the clips is one open space. If the tea party draws its own
  dining room, "get out" walking from the table to the front door loses its
  geography.
- **What sean is wearing after the waiter's outfit.** He puts it on inside the
  tea party; "get out" follows immediately and nothing says whether he still
  has it on.

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
