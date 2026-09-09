# PICKUPS — hospital night

**The word is PICKUPS.** A *pickup* is a short extra shot grabbed after the
scene is already shot, **to SLOT INTO it** — an insert, a detail, a reaction,
a shot the scene needs and does not have. A *reshoot* is redoing a whole clip
because it came out wrong. **This list is pickups only** (Sophie, 2026-09-09:
"these r all reshoots not things to slot in"); reshoots are parked at the
bottom so they are not lost.

**Shooting these on Seedance 2.0 Mini** (Sophie, 2026-09-09), 480p, 3:4 unless
the shot says otherwise — about 5-6¢ a clip. **Mini's shortest clip is 4s**, so
a 1.7s insert is shot at 4s and trimmed in the cut.

Every one of these is still a job that waits for her "go" with the card shown
first — model · seconds · resolution · the exact prompt · every reference.

The live copy of this list is the editable block in the `uptakes-reshoot-list`
chat: `node scripts/chat-block.js read --chat uptakes-reshoot-list`.

---

## 1. The pants insert — Climax 1 v2 (the walk to his office) · HER ITEM

**Too long is the POINT — it is supposed to be funny (Sophie, 2026-09-09).**
So the pants stay comically long. What is wrong is the SHAPE: the hems came out
as a fat coiled doughnut of fabric sitting on top of each sneaker, which reads
as a costume fault rather than a joke, and the shot is static — she just stands
there, so nothing about the length actually plays.

**The og is a QUICK CUT, not one camera** (measured 2026-09-09, ffmpeg):
- `climax1b` (Climax 1 v2) — 30.08s, 560x752, 24fps, **7 shots**; cuts at 7.67 ·
  11.33 · 13.04 · 16.83 · 25.75 · 28.79s. **The pants already have their own
  1.7s insert at 11.33–13.04s** — legs and hands only, no face.
- `climax1` (Climax 1 v1) — 30.08s, **5 shots**. Also quick cut, but she is in
  street clothes there, so v1 carries no pants shot at all.

So this is a pickup: 4s of legs, trimmed to 1.7s, cut in over 11.33–13.04s. The
rest of v2 stands. No face in frame, so it needs no jazz reference and spends
nothing against the 30s reference budget.

**The card (waiting for go):** Mini · 4s · 480p · 3:4 · audio on · reference =
the legs frame off v2 at 0:12 (`drops/_/b8e181a32672c1861a7bad270d8c6c15.jpg`).
Try OpenRouter first — legs only, no face, and a refusal is free — APIFRAME if
it refuses.

    the pajamas, the sneakers and the hallway floor are in [Image1].

    camera at knee height, still. her legs and feet only — no face, no upper
    body in the shot.

    she walks slowly toward the camera and past it. her pajama pants are much
    too long: the extra fabric drags along the floor, the hems folding under
    her sneakers and catching under her heels as she steps.

    setting: mental hospital hallway.

    no talking. footsteps on a hard floor.

The walk is the one thing changed from the og, and it is the change that makes
the length read as a joke: dragging pants play, standing pants just look wrong.
The standing version is the same prompt with the walk line cut.

---

# The pass over the footage (2026-09-09)

**A pickup is a shot to SLOT IN — not a clip to redo (Sophie, 2026-09-09:
"these r all reshoots not things to slot in · ex. sophie mirror shot is
missing").** The first pass listed clips that came out wrong, which is a
different list. This one is coverage: the shot the scene needs and does not
have. The film already works this way — `s8broll` (the pudding cups) and
`s9broll` (the socks on the linoleum) are slot-ins sitting in the rough cut.

All 43 clips in `belt/clips.json` plus the climax and sculpture clips pulled,
scene-detected and read as frame strips. Nothing here has been shot.

## 2. THE MIRROR — Climax 4 and Climax 5 · HER ITEM

**There is no mirror on screen anywhere.** Measured on the clip that landed
2026-09-09 (`md-32b`, Climax 4, 15s): she floats down the hall with the ghost
double behind her, reaches her room, the double rejoins her, and she puts her
hands in her hair — **in a medium shot of the room, with no mirror in frame,
no reflection, and no shot of her looking into one.**

Her script asks for it twice:
- Climax 4 — *"In her room, she looks into the mirror, and her ghostly clone
  floats down to where the mirror is, and tentatively reconnects with her
  body. Looking in the mirror, she begins tugging at the ends of her hair.
  'I don't know who I am anymore.'"*
- Climax 5 — *"the assistant appears behind her in the mirror."* The whole
  scene is played at a mirror, and there is no mirror shot to cut to.

Three shots to slot in, all in the same setup:
- her reflection as she arrives at it, the ghost double sliding into the glass
- the hair-tug in the reflection, with the whisper
- the assistant appearing behind her in the mirror

## 3. Sophie's face at the cafeteria table — `8b`, already carded

`table` never cuts to her while she talks — it holds on Michael and Anastasia
from her side of the table for the whole scene. The card is already on the
belt (`8b`, "The dining room — face insert"); it belongs on this list.

## 4. Her hand — Climax 2a

The scene is *"cut my hand off?"* and there is no shot of her hand. Her hands
are clasped in her lap, held wide, for every frame of `climax2a2`. One insert.

## 5. A clean milk carton — the metaphor machine

`milk1` and `milk2` both hold a close-up of a carton whose label reads as
nonsense — **"MAOLLEH / DHJOMILK"**, **"MILGLK MESIER"**. One insert of a
carton with no legible lettering covers both.

## 6. The finished sculpture wall, wide — scene 23

`md-23a2` builds it beautifully in close-up — the tape torn into tabs, the
spoons and packets going up — and then ends on a medium of her standing beside
it. Nothing shows the whole wall as one thing, which is what "the sculptures"
means for the rest of the story (23b is her finding it gone).

## 7. The restraint going on — the tranquilizer

Her text is *"wide, yellow rubber bands"*, strapped over both wrists and her
feet. On screen it is a thin yellow ribbon looped around one wrist. One insert
of a wide band pulled across her wrist and tightened.

## 8. The nurse rolling up her pajamas — `9b`, already carded

Her own b-roll idea, on the belt and never shot: Sophie walking the halls
alone, a nurse coming up and rolling her pajamas up. It is a slot-in, so it
belongs here.

---

# NOT pickups — reshoots, parked so they are not lost

These came out of the same pass. They are whole clips to redo, not shots to
slot in, so they do not belong on this list — but they are real.

- **`meds3` is the wrong Sophie** — strawberry-blonde and straight, the whole
  clip.
- **The parents read as grandparents** — white hair, stooped, mid-seventies,
  in `parentsAud` and in `s39a3`. The audition is the origin every parents
  scene rides.
- **Michael's audition is a wide** — a speck at the end of a corridor, face
  unreadable. That is why it is useless as his origin clip.
- **The music class instruments are bunches of berries on sticks** — on the
  crying woman it reads as an ice-cream cone.
- **Three different hallways** — `hall` bright white, `hall2` grimy and teal,
  `climax1b` pale institutional green.
- **`annie1c` is very dark** — try a brighten in the cut first; that is free.
- Already in her notes: the braid Sophie in `table` and `hall`, and the art
  room's party-crinkle paper and too-kindly teacher.
