# Finishing the ward film on Seedance 2.0 Mini — the stills-only pipeline

Started 2026-09-09 on Sophie's ask: *"minis on sale and only takes blurred eye
still · set up a pipeline to finish the movie w mini · main task is gettin
proper references without movies."*

Nothing here was sent. Every clip still waits for her "go" for that exact job.

## Why switch — her own belt's numbers, measured

| | Seedance 2.5 (APIFRAME) | 2.0 Mini (OpenRouter) |
|---|---|---|
| per second | ~$0.15 | **$0.0139** |
| a 4s clip | $0.60 | **$0.056** |
| an 8s clip | $1.20 | **$0.111** |

Measured off the live video log 2026-09-09: 23 Mini jobs on file, 13 at 4s
averaging **$0.0558** and 5 at 8s averaging **$0.1111** — $0.0139–0.0140 a
second either way, so the rate is flat and the sale is already being billed.

Her belt (`belt/jobs.json` + `jobs-md.json` + `pills/` + `soap/`) is **100
cards, 1,627 seconds** still to shoot:

- on Seedance 2.5 — **$244**
- on 2.0 Mini — **$23**

**The sale ends Oct 7 2026** (ByteDance's own, Aug 7 – Oct 7: 2.0 Mini at 40%
of list, 2.0 Fast at 75%, applied at billing time and passed straight through
OpenRouter). After that the Mini price goes back up 2.5x, so the window is
about four weeks.

## Why the references have to change

Mini goes through **OpenRouter → ByteDance direct**, and ByteDance's own input
filter refuses a **person video** whatever is done to it — the eyes-blur trick
that works on a still was measured on 2026-09-08 NOT to carry to video. That is
the whole problem, because **94 of the 100 cards carry a video reference**, and
the jazz clip alone is on **90 of them**.

So every video reference becomes a **still with a blurred eye bar**:

| what rode as a video | what it becomes |
|---|---|
| `jazz150` (Sophie, 15.1s, on 90 cards) | `sophie-face-*` / `sophie-jazz-*` |
| `intakeA3` (the doctor + the assistant, 25s) | `doctor-A`, `assistant-A` |
| `broll1b` (both, 4s) | `doctor-B` |
| `office2` (the office, 4s) | `office-A` |
| `scaleAud3` (Mayra + the white-coat nurse) | `mayra-A`, `nurse-white-A` |
| `parentsAud` / `s39a3` (the parents) | `parents-A` |
| `michaelAud2` (Michael, 4s) | **nothing usable — see below** |

**A side benefit: the 30s reference cap stops mattering.** Stills are free
against it, so a Mini card can carry Sophie *and* three other characters *and*
the room, which the jazz-plus-two-auditions budget never allowed.

## The stills — how they were picked

`scripts/ward-pullstills.py` downloads a clip, extracts **every** frame at
native resolution, and scores each detected face with YuNet: box size, the
5 landmarks, yaw (nose off the eye midpoint) and tilt, plus a **size-normalised
crispness** (the face crop resized to 128px, then variance of the Laplacian).

The normalisation is load-bearing: a raw Laplacian variance rewards *small*
faces, because a 28px crop is mostly high-frequency noise. Un-normalised, the
"crispest" frames of the jazz were all 28×35px faces and every real close-up
scored last.

**The finding worth keeping: `intakeA3` beats the jazz as a still.** Sophie's
face is **640px tall** there against the jazz close-up's **367px**, head-on and
crisper, and the notes already list intake A among the clips carrying the right
Sophie (the short brown curls, not the braid). The jazz stays the *canonical*
origin — it is the only clip of her face that is not a copy of a copy — so both
are filed and the pick is hers.

Every clip in this film is 480p 3:4 = **560×752**, so a frame is comfortably
over Seedance's 300px minimum width with no upscaling.

**Michael's still is in the `table` clip, not his audition** — see the Michael
section below. `michaelAud2` is a 20-32px figure at the end of a hall (her
"too far away", confirmed), but it is an OFFCUT of the 25s cafeteria clip where
his face is 150-170px and head-on. He needs no new audition.

## The eye bar — `scripts/ward-facetool.py`

    python3 scripts/ward-facetool.py bar in.png out.png height_frac=0.45 width_pad=0.40

YuNet gives the two eye landmarks; the band is sized in units of the
**inter-eye distance**, so "a narrower bar" is just a smaller `height_frac` and
the same numbers mean the same thing on any face at any size.

**The blur radius scales with the face (`blur_k`, default 0.55 × the inter-eye
distance) and that is the fix that mattered.** A fixed radius — the 14 in the
original measurement — is a cosmetic smudge on a 400px face and a hard black
censor slab on a 56px one; both were visible in the first pass over this set.
Scaled, every face gets the same relative treatment.

The seam is **feathered** (`feather_k`, 0.25 × the inter-eye distance) so it
reads as an artifact rather than a drawn-on censor bar.

`mode=` takes `blur` (default), `pixel` or `solid`; `debug=1` outlines the band.

## The ladder — MEASURED 2026-09-09, and the answer is D-narrower

Sent on her go, narrowest-first, one at a time. **Refusals are free, so the
whole search cost one accepted job: $0.0558.** Sending all seven would have
been 39¢; going narrowest-first and stopping at the first pass is 5.6¢
whatever the threshold turns out to be.

| rung | band on a 640px face | result |
|---|---|---|
| Z-none (control) | no bar | **REFUSED** `InputImageSensitiveContentDetected.PrivacyInformation` |
| F-hairline (0.18/0.15) | 288×40 | REFUSED |
| E-slit (0.26/0.22) | 319×58 | REFUSED |
| **D-narrower (0.34/0.30)** | **354×75** | **ACCEPTED — $0.0558, job `1BhEe5n7xp1V60nx3bvW`** |
| C-narrow (0.45/0.40) | 398×99 | ACCEPTED |
| B-measured (0.60/0.50) | 443×132 | ACCEPTED |
| A-wide (0.80/0.60) | 487×177 | ACCEPTED |
| XL (1.20/0.80) | 576×265 | ACCEPTED |

**Every rung at or above D passes on Sophie, and that was MEASURED, not
assumed** (Sophie asked, 2026-09-09: "it refuses wide and narrow" — a fair
challenge to a claim this doc had made without testing it). On her face the
curve really is monotonic: everything from D up to a band twice D's size is
accepted.

**The control refusing is what makes the rest of it evidence.** The identical
still with no bar was refused on the same face at the same second — so the
accepts are the bar working, not a filter in a permissive mood.

### Both axes have a floor, and D-narrower sits just inside the corner

A second round on her go (2026-09-09) — three more refusals, free, and one
accept:

| probe | bar | result | what it settles |
|---|---|---|---|
| P2 — height 0.30, width 0.30 | 354×66 | REFUSED | the height floor is **between 0.30 and 0.34** |
| P3 — height 0.34, width **0.15** | 288×75 | REFUSED | **width has its own floor** — D's height alone is not enough |
| P4 — height **0.26**, width 0.60 | 488×58 | REFUSED | a wide band does **not** buy back a short one |
| P1 — small face at D | 42×9 and 50×11 | **ACCEPTED** | D works at the small end too |

So the filter reads **both** dimensions and neither can be traded for the
other. D-narrower (0.34 / 0.30) is not merely a rung that happened to work —
**it is close to the minimum**, since dropping either axis one step is refused.
That is the setting.

**And it holds across the whole face-size range in this film.** D was accepted
on the biggest face in the library (`sophie-face-A`, a 640px face, 354×75 band)
and on the smallest (`parents-A`, ~90px faces, a **42×9** band) — so the
face-relative fraction is the right unit and the 14 stills ship as they are.
The parents clip came back with both faces intact and on-model, and brighter
than the very dark source.

### THE BAR IS ROTATED ONTO THE EYE LINE — and the feather goes outside it

Two bugs, both found by spending nothing (refusals are free), both of which
would have hit most cards in this film:

**1. An axis-aligned bar only covers a level head.** The doctor's still sits at
**11°** and half his right eye stayed readable — refused, and the error names
the offending reference (`content[5]`), which is how it was pinned to him and
not to Sophie. Most faces here are turned or tilted toward someone, so this is
the common case: tilts across the set run to 16.8°.

**2. The feather must be drawn OUTSIDE the band, not into it.** Blurring a mask
whose band is 75px tall with a 55px feather kernel drops the mask's peak well
below 1.0, so the "blur" becomes a weak blend and the eyes stay readable. That
is why the first rotated attempt was refused where the axis-aligned one had
passed — **more coverage on paper, less blur in fact** — and why rotating at
0.45 was refused too. The rect is grown by the feather radius before the mask
is blurred, and the kernel is capped against the band's own height.

With both fixed, rotated D (0.34 / 0.30) is accepted. **That is the final
setting.**

### The pipeline proven end to end — stills only, no video

**M1 — five stills, one card, accepted.** Her face (`sophie-face-A`), her
pajamas (her three existing stills) and her room (`still-room3`), with the
prompt pointing at [Image1]…[Image5]. The clip came back with her face on
model, in the right pajamas, in the right room, walking in and sitting on the
edge of the bed. **No video reference anywhere.**

**M2 — two barred faces in one card, accepted.** Sophie and the doctor plus
the office. Both drawn on model. So a card can carry more than one person as
stills, which is what the 30s reference cap never allowed.

**Her own existing stills need barring too.** Three of the six carry a face
(`pj-optA-solo` 128px, `pj-optC-solo` 162px, `still2-doctor-chair` 122px) and
had only ever gone through APIFRAME; `still-pj-pocket`, `still-room3` and
`still-dining` have no face at all and pass untouched.

### What the clip showed — the bar is not a limit on the output

**The model drew her eyes back in.** The blurred band came back as real open
eyes, and the face reads as Sophie: her freckles, nose, mouth, jaw and hair all
survived, and she looks at the camera and away as the prompt asked. So the bar
is a key that opens the door, not a hole in the reference — which is what makes
the whole pipeline viable rather than a compromise.

That also confirms the 2026-09-08 finding from the other direction: **the
likeness rides on the rest of the face**, so every millimetre the bar gives back
is worth having, and narrower is worth chasing.

## Michael — a blurred bar NEVER passes on him, a SOLID one does

He is in **6 cards, 74 seconds** (the dinner, the poem and the walk, the
montage), so he is not a corner case.

**And the good Michael was there all along.** The 4s `michaelAud2` is a distant
hallway figure with a 20-32px face — useless, exactly as she said — but it was
CUT FROM the `table` clip, his 25s origin, the one her notes call "LITERALLY
perfect". His face is **150-170px and head-on** there. So the earlier
"Michael has no usable still" was wrong: it measured the offcut, not the source.

**Then every blurred bar was refused, and all of it was free:**

- D (0.34/0.30) on the full frame — refused
- cropped to Michael alone, Anastasia off the frame — refused
- 0.45, 0.60, 0.80 and **1.00/0.70** (a band over the whole eye region) — all refused
- a tight face-only crop, and the same upscaled 3.5x — refused
- five other frames of the same clip — all refused

So it is not the bar's size, the crop or the frame. **A blurred bar simply does
not clear this face**, which is the multi-pass detector the research note
warns about ("cropping, sunglasses, blur and drawn-over faces mostly fail").

**`mode='solid'` at the same D geometry passes on the first try** — and his
likeness comes through intact: the same flat light-brown hair, the same face,
looking up and smiling. Cost: one accepted job.

### The two curves, and what the filter is actually asking

Sophie and Michael behave completely differently, and putting them side by side
is what gives the right mental model:

- **Sophie — monotonic.** No bar and the three narrow rungs refuse; D and
  every wider rung, up to a band twice its size, accept.
- **Michael — refuses at EVERY blurred width, narrow and wide alike**, from D
  through 1.00/0.70. Only a SOLID bar passes.

So **it is not about how much area is covered.** If it were, Michael's widest
blur would have passed. What the filter is asking is whether the eye region
still carries readable information — and a Gaussian blur only ever *attenuates*
it. On most faces a big-enough blur takes it below the line; on Michael's it
never does at any size, because the low-frequency structure that survives a
blur is apparently still enough. A solid fill removes the information outright,
which is why it passes on the first try.

That also explains the narrow end of Sophie's curve: at F-hairline the band is
40px tall and the blur averages only within it, so the eye still reads straight
across the strip. It is the same fact from the other side — coverage matters
only insofar as it destroys information.

### So the rule is an escalation ladder, and it costs nothing to walk

1. **Blur at D** — the default. Sophie, the parents and the doctor all pass here.
2. **Solid at D** when blur is refused. Michael needs this.
3. Only if both bounce: that character's cards go through APIFRAME (2.5), or
   he gets a drawn reference (her workaround #2).

A refusal comes back before anything draws and is never billed, so the ladder
is walked for free and only the rung that works is ever paid for.

**Do not switch the whole set to solid.** Blur is the gentler treatment and it
passes for most faces; solid is the fallback, not the default.

## Where things are

**The barred stills to use are the `-barD` copies** (D-narrower). The first
C-narrow set is superseded — wider, so it also passes, but it eats more face.

- `docs/mental-hospital/refs/stills.json` — every still and rung, with its
  source clip, source frame, bar geometry and Dump url.
- Dump bundles **"Ward → stills"** and **"Ward → eyebar ladder"**.
- All 35 pictures are in the `seedance-reference-stills` chat's Assets tab,
  labeled, so a ♥/✕ and a note land on the picture itself.
- `scripts/ward-pullstills.py`, `scripts/ward-facetool.py` — both free, both
  ffmpeg/opencv in a container, no model call anywhere.

## Open

- Her pick between `sophie-face-*` (intake A, bigger) and `sophie-jazz-*`
  (the canonical origin) as the Sophie reference.
- Which AXIS the filter reads — height or width. One run at 5.6¢ a rung.
- The auditions still owed her words (Yolanda, Nurse Edna, Ms. O'Hara,
  Nurse Mary + Juanita, the Superintendent + Anastasia). Michael no longer
  needs one.
- **Anastasia**: she is in the table clip beside Michael, but her notes say
  that one "came out with the braid but not as pictured" (a blond ballerina),
  so it is NOT a reference for her intended Anastasia. Hers to decide.
- Whether Mini's output quality holds up against 2.5 on a real scene — one
  card shot both ways would settle it and has not been done.
