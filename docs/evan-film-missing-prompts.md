# Evan film — prompts for the pictures still missing (written 2026-08-18)

Written while assembling **evan-v14** (the render from Sophie's live 148-key
Cutting Blocks marks). These are the beats that currently ride on a stand-in
image or on nothing that matches the words. **No images were generated** —
Sophie is choosing a new narrator reference, so these prompts wait for the
locked character card and then finish the film without re-deriving anything.

## How to run these (from `docs/evan-film-style.md` — read it first)

- gpt-image-2 **edits** endpoint, **quality medium**, size **1024x1536**.
- Attach `refs/sage-sandy-mirror.png` as the style reference. **Write NO style
  description** — the preamble below is the entire style half:

```
Use the attached image as a style reference. Only use its style, not its
content — do not copy anything depicted in it. You do not have to copy its
colors.

Draw: <the scene>
```

- Any scene with the narrator: also attach **the girl character card**
  (whichever reference Sophie locks — as of today `refs/evan-girl-character.png`,
  but she has said she will probably supply different pictures) and restate:
  "same face, hair and build as the second attached image — do not redesign
  the character."
- Any scene with Evan: also attach `refs/evan-character.png`, same preserve
  line.
- The prompts below are the CONTENT halves, ready to paste after `Draw:`.

## The missing beats, in film order

Film times are from evan-v14; each names the audio it sits under and the
stand-in currently covering it.

### 1 · Her "statistically significant" skepticism — 1:22–1:29
Audio: "It's hard for me to see that that number is statistically
significant… It doesn't seem like a big number… It's only 20 percent more."
Stand-in: the walking-watching-the-video shot. (An earlier attempt at this
beat was ✕'d in the Assets tab; this is a fresh scene, not that one.)

> A young woman walking on a sidewalk, frowning skeptically at her phone,
> which shows a simple bar chart with one bar only a little taller than the
> other. Her free hand is raised in a doubtful shrug.

### 2 · The 17-year-old and his pajamas / the license plates — 2:14–2:18
Audio (her typed TTS line): "So here you have, the 17 year-old and his
pajamas… And the license plates matched."
Stand-in: "what they saw while they were dead."

> A teenage boy in pajamas floating gently above a hospital bed where his own
> body lies, looking down through the ceiling at a parking lot below, where a
> row of parked cars shows their license plates clearly. A notebook beside
> the bed shows the same plate numbers written down, matching.

### 3 · Isn't the CIA involved? / Why isn't it published? — 2:37–2:42
Audio: "Well, isn't the CIA involved? Yeah. Well then why isn't this
published in science journals?"
Stand-in: the two-on-the-call shot.

> A dim government office at night: a gray filing cabinet with one drawer
> open, folders stamped CLASSIFIED, and on the wall a corkboard of pinned
> photographs connected by string — a battleship, a telephone, a rat. No
> people in the room, one desk lamp lit.

### 4 · Weeks of silence, neither one calls — 3:33–3:37
Audio: "A couple weeks later we still hadn't talked. I didn't call him, and
he didn't call me."
Stand-in: the asked-God-for-a-sign shot.

> Two phones side by side in a split scene divided by a jagged line: on the
> left a young woman's phone dark on her nightstand, on the right a young
> man's phone dark on a cluttered desk. Both screens are off. A wall calendar
> between them shows two weeks crossed out.

### 5 · The rat by the garage door — 3:50–3:52
Audio: "I saw one the other day by the door in my garage."
Stand-in: the patio not-much-of-a-sign shot.

> A small gray rat pausing beside the corner of a garage door, seen from a
> few steps away in ordinary daylight, the door half-open with garden tools
> just visible inside. The rat is unremarkable, just passing through.

### 6 · Dad says he saw something gross — 3:52–4:00
Audio: "Then that night, right before I was going to bed, my dad said he saw
something outside, but he didn't want to tell me because it was gross. I
said, what is it?"
Stand-in: the bedroom phone-rings shot.

> A hallway at night in a warm Spanish-style house: a middle-aged father in
> the doorway, mid-sentence, one hand raised in a hesitant "you don't want to
> know" gesture, while his adult daughter in pajamas leans out of her bedroom
> door listening. Only a hallway lamp lights them.

## Worth a medium redraw once the girl is locked (art exists, but low / unanchored)

Not missing — these have usable low-quality or unanchored-girl art in the cut
today, and are the next tier if she wants the whole film at medium:

- **The closing shot** (b94–b95, "Okay, I said… that was a sign") — currently
  the v10 "her and Evan alone in her bedroom (last shot, pulls back)", low,
  girl unanchored.
- **The vow / hung up / asked God run** (3:18–3:42) — v10 series, low.
- **The gift punch** (0:45–0:52) — the v11 low version honors her note
  ("someone should be giving it to her and she can't be dodging it"); a
  medium redraw should keep exactly that staging.
- **Sheldrake's phone study** (0:59–1:06 and the interleave) — the v11
  watercolour redo of the phone study, low.

## Where the rest of the machinery lives

- The v14 rebuild pipeline (marks → page-cut → stitch → verify):
  `scripts/evan-v14-rebuild/`.
- The shot map (which image covers which unit) is in
  `scripts/evan-v14-rebuild/build-film.js` (`PLAN`).
- One span correction was made against the bulk-pass block times: b16's tail
  (`…He's a scientist.`) ends at **86.17** in `evan-v7-lite.mp3`, not 86.08 —
  measured by word-timestamp transcription of the seam; at 86.08 the last two
  words clip (the defect vo-verify caught on the first assembly).
