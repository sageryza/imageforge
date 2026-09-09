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

**Michael has no usable still.** `michaelAud2` is a single figure at the end of
a long hall — the face measures **20–32px** across all 97 frames. Her verdict
("too far away", "4s auditions don't rly work") is confirmed by measurement.
He needs a new audition, close, before he can be referenced at all.

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

## What is still unmeasured — the ladder

**Which rung the filter actually accepts is not known.** Only one point on the
curve has ever been measured: a soft band over Mayra's eyes passed on 2026-09-08
(`aY9LbIGMe9T5lEcA984a`, Mini 1:1, 5.4¢), and the whole photo without it was
refused. Nobody has tested whether a *narrower* bar also passes.

Seven rungs are built and uploaded, all on `sophie-face-A`:

| rung | band | what survives |
|---|---|---|
| Z-none | — | the control; this should be REFUSED |
| A-wide | 488×177 | brow to cheekbone |
| B-measured | 443×133 | the rung that passed on Mayra |
| C-narrow | 399×100 | eyes only |
| D-narrower | 354×75 | lids in, brows out |
| E-slit | 319×58 | a slit across the pupils |
| F-hairline | 288×40 | barely a line |

**A refusal is free and an accepted job is 5.6¢**, so the probe costs
(however many pass) × 5.6¢ — at most 39¢ for all seven, and the control
costing nothing is what proves the test is real rather than measuring an
already-permissive filter.

Narrower is worth chasing for a reason beyond looks: the measurement of
2026-09-08 found the likeness rides on **the rest of the face** — the
eyes-blurred photo still drew Mayra — so the less of the face the bar eats,
the closer the clip lands.

## Where things are

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
- The ladder probe — needs her "go"; ≤39¢.
- Michael's close audition, and the auditions still owed words (Yolanda,
  Nurse Edna, Ms. O'Hara, Nurse Mary + Juanita, the Superintendent +
  Anastasia).
- Whether Mini's output quality holds up against 2.5 on a real scene — one
  card shot both ways would settle it and has not been done.
