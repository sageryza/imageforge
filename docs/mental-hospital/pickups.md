# PICKUPS — hospital night

**The word is PICKUPS.** In film a *pickup* (or pick-up shot) is a small extra
shot grabbed after the main scene is already shot, to cut into it — an insert, a
detail, a reaction, a line redone. A *reshoot* is redoing the whole scene. Almost
everything on this list is a pickup: one short shot spliced into a clip that
otherwise stands.

This is the running list of what still needs shooting. Sophie adds to it; the
same list is an editable block in the `uptakes-reshoot-list` chat, so her edits
there are the live version — read them back with
`node scripts/chat-block.js read --chat uptakes-reshoot-list`.

Every one of these is still a JOB that waits for her "go" with the card shown
first (model · seconds · resolution · the exact prompt · every reference) — the
standing rule for video, unchanged by being on a list.

---

## 1. The pants roll-up insert — Climax 1 v2 (the walk to his office)

**Status:** not shot. **Kind:** pickup (an insert, not a scene redo).

**What is wrong.** The pajama pants come out enormous — a fat bunched doughnut
of fabric sitting on top of each sneaker rather than a roll-up. Her own note
from 2026-09-07: "the too-long pajama pants came out weird", and the line that
drew them was *"rolled up but have fallen down somewhat"*.

**The og check — it is a QUICK CUT, not one camera.** Measured 2026-09-09 off
the clip itself (ffmpeg scene detection + a frame strip):

- `climax1b` — **Climax 1 v2**, 30.08s, 560x752, 24fps, **7 shots**. Cuts at
  7.67 · 11.33 · 13.04 · 16.83 · 25.75 · 28.79s. The shots: the walking
  two-shot down the hall → her close-up → **the pants insert (11.33–13.04s,
  1.7s, legs only, no faces)** → the doctor + assistant two-shot → back to her
  close-up, held → the two-shot → the office door.
- `climax1` — Climax 1 v1, 30.08s, **5 shots** (cuts at 3.04 · 11.38 · 25.33 ·
  28.62s). Also quick cut, but she is in street clothes there — the red tank and
  the floral pants — so **v1 has no pants shot at all**. v2 is the only take
  that carries one.

**So it is a pickup, not a redo.** The pants already live in their own 1.7s
insert with no faces in it, so the fix is a short clip of the legs, cut in over
11.33–13.04s. The rest of v2 stands.

**What that buys.** No faces in frame means it does not need the jazz reference
and does not spend a face against the 30s reference budget — it is the cheapest
shape of job there is.

**Open questions for her before the card is written:**
- Should the pants be rolled NEATLY (a clean cuff at the ankle) or is the joke
  that they are too long — just less of it?
- Does the insert stay 1.7s, or does she want it shorter?
