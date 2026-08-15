# IDEATROL — the fake pill commercial (Aug 2026)

A 74-second parody prescription-drug TV spot for **IDEATROL®** (frivolamine
besylate), the pill for Chronic Idea Overproduction. Built entirely from this
folder in one chat session ("fictional-pill-commercial").

**The film (480p draft v1):**
https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/commercials/ideatrol/ideatrol-draft-480p-v1.mp4

Everything lives under `commercials/ideatrol/` in deckfactory Storage:
`stills/` (full-res gpt-image-2 originals), `crops/` (16:9 crops fed to the
animator), `clips/` (per-scene wan renders), and the final mp4.

## How it was made
- **VO** — ElevenLabs `eleven_multilingual_v2`: Brian (announcer), Sarah (the
  woman). The side-effects block is atempo'd 1.3x, the scope-creep disclaimer
  1.35x. Segment texts live in `pipeline.py` (`SEGS`).
- **Stills** — gpt-image-2, `1536x1024`, quality **medium** (~6c each), 12
  scenes + one re-roll. Prompts in `pipeline.py` (`STILLS`).
- **Animation** — `wan-2.2-i2v-fast` at 480p (the Movies draft tier, same
  version hash), 81f/121f per scene, timed to the measured VO. The three
  montage scenes run ~1.4x slow-motion to cover the fast read.
- **Music** — MusicGen stereo-large, 30s soft piano, looped under at 0.13.
- **Stitch** — ffmpeg: per-scene trim/tpad to the VO timeline, concat, VO at
  absolute offsets + music, alimiter.

## Notes for a future re-render
- `pipeline.py` is resumable: it skips any vo/stills/clips file that already
  exists. Total draft cost ≈ $1.75.
- **720p**: change `resolution` to `720p` in `start_clip` (~2x clip cost), or
  swap to the kling tier for real quality.
- gpt-image-2's safety filter blocked the original "family flinching away"
  scene (s04) — softened to "amused tired glances". A refusal is terminal;
  soften the narrative, never retry verbatim (same rule as Movies' Dreams).
- The first bottle render helpfully labeled the pill **(DESVENLAFAXINE)** — a
  real antidepressant. Re-rolled as `s06b` with the fictional generic spelled
  out in the prompt. Check generated labels for real drug names.
- Replicate 429s prediction creation ~10 in-flight; `start_clip` has backoff,
  `recover.py` re-attaches orphaned predictions by input-image URL.
