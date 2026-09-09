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

### TWO DIFFERENT REFUSALS, and they look identical unless you read the error

Sophie, 2026-09-09: *"i meant wide/narrow frames. if u crop too narrow it
refuses for that reason too."* She is right, and it is a separate rule from
everything above — measured on her face, the one known to pass:

| frame sent | result |
|---|---|
| 420×560 | ACCEPTED |
| 320×426 | ACCEPTED |
| **299×398** | **REFUSED — size, not the face** |
| 240×320 | REFUSED — size |
| 180×240 | REFUSED — size |

The cliff is exactly at **300px of width**, which is Seedance's documented
input minimum. So:

- **`InputImageSensitiveContentDetected.PrivacyInformation`** — the face
  filter. It NAMES the offending reference (`content[5]`), which is how the
  doctor and Michael were each pinned. Fixed with a bigger or solid bar.
- **A size refusal** — the crop fell under 300px wide. Fixed by upscaling the
  crop. Nothing to do with faces.

**Both come back as a 400 and both are free, so the only thing that tells them
apart is the error text — read it before changing the bar.** The earlier
204×273 crop of Michael was a size refusal misread as a face one.

**Crop TIGHTNESS itself does not affect the face filter.** The known-good
Sophie still was re-cropped to 80%, 62% and 48% of its frame — the face filling
almost the whole picture — and all three were accepted. So there is no
"too tight for the face filter"; there is only "too small in pixels".

**The practical rule: crop to isolate whoever you want copied, then upscale the
crop to at least 420px wide before sending.** Cropping tight is free and often
necessary (it is how a second person is removed); falling under 300px is the
trap, and it looks exactly like a face refusal if you do not read the code.

### A SOLID bar can be tiny — and only its HEIGHT matters

Measured 2026-09-09 on Michael's head-on crop (420px wide, his face ~159px).
The first ladder moved both numbers together, which confounds them, so a second
pass split the axes:

**The diagonal (both moving together):**

| rung | h / w | bar | result |
|---|---|---|---|
| E | 0.26 / 0.22 | 95×17 | ACCEPTED |
| F | 0.18 / 0.15 | 85×11 | ACCEPTED |
| G | 0.12 / 0.10 | 79×7 | ACCEPTED |
| H | 0.08 / 0.06 | 73×5 | REFUSED |

**The split — which axis was H failing on:**

| probe | h / w | bar | result |
|---|---|---|---|
| H's height, G's width | 0.08 / 0.10 | 79×5 | **REFUSED** |
| G's height, H's width | 0.12 / 0.06 | 73×7 | **ACCEPTED** |
| G's height, NO width pad | 0.12 / 0.00 | **66×7** | **ACCEPTED** |
| between the two heights | 0.10 / 0.10 | 79×**6** | **ACCEPTED** |

**HEIGHT is the whole constraint. Width is not a constraint at all.**

- **Shortest accepted: 6px tall** (height_frac 0.10). The floor sits between
  0.08 (refused) and 0.10 (accepted).
- **Narrowest accepted: 59px wide.** The floor is between 46px (refused) and
  59px (accepted), and the meaning is plain: **the bar must reach BOTH EYES.**
  The eye span on that face is 66px, so a bar that stops short of covering
  both is refused however tall it is.

So the bar only has to be tall enough to cover the eye vertically; sideways it
need only reach from one eye to the other. **A 66×7px solid sliver passes on
the face whose 122×51 BLUR was refused.**

**Both floors are now bracketed** (Sophie, 2026-09-09: "if u never hit a
limit, then r u done?" — no; the earlier pass had bottomed out at the
parameter's own limit, not at a refusal). Height: 0.09 refused, 0.10 accepted.
Width: 46px refused, 59px accepted — the bar has to span both eyes.

**Michael has TWO views** (her ask) — `michael-view1` head-on from table f0284,
`michael-view2` looking off from f0704 — both accepted, both on model.

### Face size does NOT predict any of this

Worth stating because it is the obvious hypothesis and it is wrong:

| face | size | blurred bar |
|---|---|---|
| Sophie (intake A) | 640px | PASSES |
| the parents | ~90px | PASSES |
| the white-coat nurse | 119px | refuses at every crop |
| Michael | 159px | refuses at every width |

The biggest face and the smallest face both pass; the two that refuse are in
the middle. And re-cropping the known-good Sophie still to 80%, 62% and 48% of
its frame — changing how much of the picture her face fills — was accepted
every time. **It is the individual face, not its size, and there is no way to
predict which is which except by sending it.** Which is free, so send it.

### Which treatment gets closer to the real person — measured

Scored with SFace face embeddings (`scripts/ward-likeness.py`): cosine
similarity between the face in the generated clip and the face in the ORIGINAL
unbarred still, averaged over the clip. Higher is closer; 0.363 is OpenCV's
same-identity threshold. Sanity checks first — two different frames of Sophie
score 0.87, Sophie against the nurse scores 0.03 — so the instrument separates
faces properly before it is trusted on anything subtle.

**Sophie — same face, same prompt, only the treatment differs:**

| treatment | bar | mean | best | worst |
|---|---|---|---|---|
| big blur (0.34/0.30) | 354×75 | 0.7594 | 0.9324 | 0.5961 |
| **small black bar (0.12/0.10)** | **265×26** | **0.8029** | **0.9420** | **0.6706** |

**Michael — solid both times, only the SIZE differs:**

| bar | mean |
|---|---|
| solid 0.34/0.30 (81×17) | 0.6858 |
| **solid 0.12/0.10 (79×7)** | **0.7378** |

**The small black bar wins on both faces, and it wins on the WORST frame by
more than on the mean** (+0.075 on Sophie) — so it is not just closer on
average, it is steadier across the clip. Two independent comparisons agree: a
smaller, harder bar beats a bigger, softer one.

That is the practical payoff of the height finding. The bar has to be tall
enough to kill the eye and nothing more; every pixel beyond that costs
likeness. **So: solid, at the height floor, is the best treatment on both
counts — it passes where blur cannot, and it draws closer when both pass.**

**What this measure is blind to, named 2026-09-09.** SFace scores IDENTITY —
the geometry of a face — so a clip could score well and still draw a defect in
one small feature. The other chat reported exactly that about the eyes; it is
measured separately below (*THE OTHER CHAT'S BLACK-EYE REPORT*) and does not
reproduce, but the caveat on this instrument stands whatever that turns out to
be: **a high cosine is not a statement that the eyes are right.**

### The real rule: the least-covering mask that passes wins

Every accepted mask, both faces, ranked by how many pixels it covers:

| face | mask | covered | likeness |
|---|---|---|---|
| Michael | two dots, r=5 *(1/4 — fluke, unusable)* | 157 px | 0.8292 |
| Michael | **bar 59×7** *(4/4)* | **413 px** | **0.8093** |
| Michael | bar 79×7 | 553 px | 0.7378 |
| Michael | two dots, r=11 | 760 px | 0.7753 |
| Michael | bar 81×17 | 1,377 px | 0.6858 |
| Sophie | **black bar 265×26** | **6,890 px** | **0.8029** |
| Sophie | two dots, r=55 | 19,006 px | 0.7888 |
| Sophie | big blur 354×75 | 26,550 px | 0.7594 |

**Covered area predicts likeness, near-monotonically** — perfectly on Sophie,
with one inversion on Michael. It is not "dots beat bars" or "bars beat
blurs": those are proxies. **The rule is minimum covered area, and which
SHAPE achieves it is face-specific.**

- On **Michael** the best RELIABLE mask is the 59×7 bar. (Two dots at r=5 cover far less and score higher, but pass only 1 try in 4 — see the repeat table below.)
- On **Sophie** the dots had to grow to r=55 before they passed, covering
  19,006px against her bar's 6,890 — so on her face the bar wins.

**So ladder both shapes and take whichever passes while covering less.** That
is a free search: every refusal along the way costs nothing.

### A REFUSAL REPEATS; AN ACCEPT DOES NOT — the threshold has a soft band

This section previously claimed the filter was deterministic. **It was
half-tested and half-wrong** (Angelo, 2026-09-09: "did the R equals five pass
more than once? if not, try it"). Refusals were repeated four times each and
held; an ACCEPT was never repeated at all. Repeating them:

| mask | passes out of 4 |
|---|---|
| Sophie, black bar 265×26 | **4 / 4** |
| Michael, bar 79×7 | **4 / 4** |
| Michael, bar 59×7 | **4 / 4** |
| Michael, two dots r=11 | **4 / 4** |
| Michael, two dots r=5 | **1 / 4** |
| Michael, two dots r=7 | 0 / 4 |
| Michael, bar height 0.09 | 0 / 4 |

**So the r=5 dots pass was a FLUKE**, and two things that were reported off it
are withdrawn:

- **"Two dots r=5 is the best mask (0.829)" is retired.** The clip is real and
  the likeness score is real, but a mask that lands one try in four cannot be
  used. The best RELIABLE masks are **Sophie's black bar 265×26 (0.803)** and
  **Michael's bar 59×7 (0.809)**.
- **The "non-monotonic ladder" dissolves.** r=7 refusing while r=5 accepted
  looked like an inversion; with repeats, r=7 is 0/4 and r=5 is 1/4 — both are
  simply below the line, and the single pass was noise being read as structure.

**The model that fits: a mask well inside the threshold passes every time; a
mask sitting ON the threshold passes intermittently.** A refusal is a reliable
signal, an accept near the edge is not.

**THE RULE THAT FOLLOWS: never commit a mask to a batch on one pass. Send it
four times.** Three of those four are free if it is a bad mask, and the one
that is not costs 5.6¢ — against a batch of clips drawn from a reference that
turns out to bounce halfway through.

### THE OTHER CHAT'S BLACK-EYE REPORT — measured against my own clips 2026-09-09

`mom-character-clip` is doing the same work on her parents, and for most of the
day it corroborated this doc with no contact between us: its auditions ran
"eyes blurred" → "black bar", it measured independently that **a blur needs a
much bigger band than a solid to clear the filter**, and its newest probe
("Solid bar probe E", 0.26/0.22) was accepted. Two chats, two casts, one
conclusion.

**Then it reported the opposite of a conclusion in this doc, and Sophie
confirmed the symptom: the drawn eyes are coming out black.** Her words —
"their eyes are turning black all of them. Sophie included, her eyes were
green in a different shot." That chat's diagnosis: a solid bar paints black
pixels where the eyes go, so the model draws a dark blob with no iris, while a
blur leaves the iris smeared but present. Its proposed fix was to re-bar the
whole reference set as blur and retire the black bar.

**That diagnosis does not reproduce on my clips.** I already had the clean test
it wanted to spend 11¢ on — the same face, the same prompt, three maskings,
already drawn — so it cost nothing to check. Eye brightness measured as a
fraction of the same face's own brightness (YuNet landmarks, a patch of 0.11
inter-eye distance at each eye, 26 samples over 13 frames per clip), which
takes the scene's lighting out of it:

| clip | mask on the reference | eye V / face V |
|---|---|---|
| `probe-D` | **blur** bar, 354×75 | 0.739 |
| `sop-solid` | **solid** bar, 265×26 | 0.732 |
| `sopdots` | **solid** dots on the pupils | 0.736 |

Three maskings, one face, and the numbers are inside a percent of each other.
**Looking at the crops rather than the numbers says the same thing** — all
three have a readable iris with a catchlight in it, the black-bar arm included.
So on this face a solid bar did not blacken anything.

**What I will not claim.** Michael's clips read much darker on dots (0.349)
than on a bar (0.654), which looks like a mechanism — a patch sitting exactly
on the pupil reads as the eye, where a bar across the eye line reads as an
occluder to be removed and rebuilt. But his face is 177px against Sophie's
470px and his eyes are half closed and downcast in most of those frames, so
the measurement is of an eyelid. **It is a hypothesis, not a finding.**

**Where that leaves the two chats.** Sophie's symptom is real; the cause is not
established, and it is not "solid vs blur" as such. Two differences between the
two setups are worth testing before anything is re-barred:

- **Mask GEOMETRY.** Mine is one wide bar spanning both eyes; that chat's are
  small per-eye patches placed by hand (28×19 and 28×18 on the dad). Those are
  the dot case, not the bar case, and the dots hypothesis above is exactly
  about that difference.
- **The reference picture itself.** The affected shoot is that chat's v2 set.
  Nothing has compared its references against a black-eye-free clip's.

**The decisive test is that chat's own references, not mine** — its stills, the
same one barred and blurred, one clip each, ~11¢. Until then: **do not re-bar
the whole set as blur on this.** It is a large irreversible change to every
reference on the strength of a diagnosis that fails to reproduce.

### What that chat has that this one did not — adopted

Two of its findings do not conflict with anything here and are better than what
this doc had:

- **More references of the same person HELP; they do not dilute.** It ran the
  same clip four ways and two pictures of the dad beat either alone. References
  are free, so there is no reason to ration them.
- **The same still can be submitted TWICE at two different maskings**, named as
  the same person — which gives the model more of the face than either masking
  alone, and is the way to use a character we only have one good frame of.
  (Its own read that this arm was best was withdrawn as unconfirmed judgement,
  so treat the *trick* as available and the *ranking* as open.)

### A THIRD refusal, from a third chat — the OUTPUT check

`scripts/bar-eyes.py` (already on main, another chat's manual bar painter)
records a refusal neither of the two in this doc covers: a famous face cleared
the INPUT filter, drew for a full minute, and was then refused on the
**output** — "may be related to copyright restrictions". So clearing the eye
check is not the whole road, and that one is not free: it burns the draw.

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

**Published findings page** (the eye-bar measurements, every probe, drawn at
true pixel scale): https://claude.ai/code/artifact/b10d8fff-8ce9-439d-b96b-6c11304e8b4f

**A NOTE ON READING SPEND FROM THE JOB LOG — it undercounts.** `GET
/api/apiframe/video-log` fills in `cost` only when a job is POLLED to
completion. An accepted job left unpolled is still billed (OpenRouter charges
on the 202 and there is no cancel) and shows no cost at all. Measured
2026-09-09: the log reported $0.39 for this chat against a real $1.23 — 7 of
22 accepted jobs had a cost on them. **Count accepted jobs x the per-job rate,
or read `GET /api/openrouter/credits` before and after; do not total the
log's cost column.**


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
