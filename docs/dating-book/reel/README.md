# The OkCupid reel — VO cut v1

Sophie's second dating-reel take, dictated Aug 2026 into two voice memos
("Healing Mudra 2" = the setup, "Healing Mudra 3" = the body — the names are
her Voice Memos app's, not hers).

- **Raw:** 24.9s + 175.3s = 3:20.1
- **Cut v1:** 1:29.5 — every pause tightened, nothing said removed
  (`vo-verify`: 0 dead-air runs, 0 contiguous missing word runs, 98.9% match)
- **Master (wav):** `dating-reel/vo-v1-master.wav` in deckfactory Storage
- **Delivery (m4a):** `dating-reel/vo-v1.m4a`
- **Shot list page:** posted into the `dating-reel-visuals` chat's Compare tab
  (`shot-list-v1.html` here is the source; a new version is a NEW page)
- `vo-v1-words.json` is the word-by-word timing of the FINAL cut — that is
  what the on-screen counters and cross-outs are keyed to.

## The one pause that is deliberately kept

`0:55.3 → 0:56.6` — the 1.26s she takes hunting for the number in "I met
approximately 50… no, 55…". That is the joke, and it is where the counter
sits before it flips. It is declared to the verifier with
`--keep 55.3-56.6`; do not let a later tightening pass eat it.

## Finding: `vo-remove-pauses.js` badly under-cut these two recordings

Measured 2026-08-25 on this material. The two-pass tool ran clean and
reported "30.7s removed", and the result was still **~95s of gaps** — a 25.4s
hole between "I would go on dates" and "The guys didn't care", plus 14.7s,
12.0s, 11.2s, 9.6s and several more.

Why, on these files specifically:

- **Pass 2 (room tone) is floor-relative** (`floor + 4dB`). This room's floor
  wobbles: inside those holes the 20ms bins average ~-40dB against a floor of
  -43.3dB, with peaks to -30dB, so most bins sit ABOVE `floor + 4` and the
  run never qualifies. Nothing is wrong with the rule — it is tuned for a
  quieter room than this one.
- **Pass 1 (word timing) vetoes on sustained energy.** One 11s stretch inside
  the 25.4s hole carries real energy (peaks -13dB, i.e. speech level) and
  transcribes to nothing at all — whisper-1 and gpt-4o-transcribe both hear
  nothing there, and a 12dB boost still yields nothing. It is handling /
  movement noise, not speech, but it reads to the veto exactly like speech.
- `vo-verify` PASSED that cut, because its silence bar is
  `speech85 - 20dB` = -45.5dB and the gaps sit above it. **A PASS means "no
  DEAD air and no lost speech", not "no gaps"** — on a noisy-room recording,
  check the word timings for gaps as well.

`scripts/vo-tighten-gaps.js` is what actually cut it: it works from the word
timestamps of the ORIGINAL recording, compresses every inter-word gap over
0.55s to a beat (0.40s, or 0.60s where she had stopped for more than 4s), and
protects laughs/breaths by extending each keep edge outward across bins above
`floor + 8dB` (capped at 0.5s, which is what lets it cut through the noisy
hole above). Verify the result with `vo-verify` as always — that is what
proves no speech went with it.
