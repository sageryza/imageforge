# PICKUPS — hospital night

**The word is PICKUPS.** A *pickup* is a short extra shot grabbed after the
scene is already shot, to cut into it — an insert, a detail, a reaction. A
*reshoot* is redoing the whole scene. Almost everything here is a pickup.

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

All 43 clips in `belt/clips.json` pulled, scene-detected and read as frame
strips. Nothing below has been shot or changed — this is the list.

## NEW — found in this pass

## 2. The milk cartons carry garbled text

`milk1` and `milk2` both hold a big close-up of the carton and the label reads
as nonsense — **"MILGLK MESIER"**, **"MAOLLEH … DHJOMILK"**. In `milk1` it is
three frames of tight close-up, so it is unmissable.

Pickup: one insert of the carton with no legible lettering — a plain red-and-
white carton, or the label turned away / out of focus. Both clips can take the
same insert.

## 3. `meds3` is the wrong Sophie

The woman in the bed has straight strawberry-blonde hair. Sophie is the
short-brown-curls woman everywhere else. This is not a drift — it is a
different person, for the whole clip. Reshoot, not a pickup.

## 4. The music class instruments came out as bunches of berries

`music5` — the maracas are lumpy clusters of beads on sticks; on the crying
woman it reads as an ice-cream cone. Pickup: an insert of a real maraca /
tambourine, or a reshoot of the wide with the instrument named plainly.

## 5. Michael's audition is a WIDE — his face is unreadable

`michaelAud2` (4s) is a single locked-off shot of a tiny figure at the far end
of a long corridor. That is why it is useless as his origin clip: an audition
has to carry a legible face for every later scene to ride. Reshoot as a medium
or close shot. (She has already asked for a new Michael audition on Mini, and
this is why.)

## 6. The parents read as GRANDparents

`parentsAud` and `s39a3` — white hair, stooped, mid-seventies. For a woman in
her early twenties they should be somewhere around fifty. The audition is the
origin clip every parents scene rides, so the age carries into all of them —
redo the audition first, then anything already shot off it.

## 7. Three different hallways

The same corridor is a different place in every clip: `hall` is bright white
with a high ceiling, `hall2` is grimy with peeling walls and a teal grade,
`climax1b` / `michaelAud2` are pale institutional green. Whichever one is the
ward, the others do not match it.

## 8. `annie1c` is very dark

Faces are hard to read even allowing for night. Worth a brighten in the cut
before it is worth a reshoot — that is free.

## 9. Minor — the restraints in `tranq`

Her text is "wide, yellow rubber bands"; on screen it is a thin yellow ribbon
looped around one wrist rather than strapped down. It plays, but it is not what
the writing says.

## CONFIRMED — already in her notes, no new finding

- `table` (the cafeteria): the seated Sophie is the braid woman, she is across
  the table instead of between Michael and Anastasia, and it never cuts to her
  face — 8b on the belt is the insert that fixes the last one.
- `hall` (v1): the braid Sophie.
- `art`: the paper is bright party crinkle in primary colours; the teacher
  reads kindly and older.
- `climax1b`: the pants — item 1 above.
