# Water reel — handover notes (2026-08-25)

The reel: `scripts/water-reel/` (`build.js` = the TTS-era builder, `build-vo.js`
= the version narrated in Sophie's own recording, `mix-sfx.js` = the effects
bed, `tts-fill.js` = the one borrowed section). Renders live at
`water-reel/water-reel-v<N>.mp4` in deckfactory Storage.

## Every note she has given, in order

From the chat:

1. **v1** — zooms must land exactly on the section being read, and the
   zoomed-out beat must show the WHOLE poster. Less whoosh; lean on water
   sounds — but keep the quirks (she liked the random kid giggling).
2. **v2** — the first sheet is the normal/earnest reasons, so flash it by
   faster (nobody needs to read them). And add narration read out loud.
3. **v3** — "I don't want my voice, maybe someone else's."
4. **v5** — the end run-through is the unhearted WATER sheets, not the People
   Watching ones. And: let her hear voice options before a full render.

From the in-app notes on **v4** (timestamps are hers):

- [0:05] the flashes should be faster, ~2/3 the length
- [0:08] cut the "three reasons why" line
- [0:19] still too much space around each one — cut right to it
- [0:35] voice faster and more excited; try other voices, at least one woman
- [0:47] right now it is sound effect *then* speech — vary it, same time or after
- [1:01] this one cuts twice to the same image
- [0:00] run through the extra sheets at the very end, faster, voice sped up more

From the in-app notes on **v6**:

- [0:46] sound effects a little quieter when they are behind the voice
- [0:46] she should gradually speed up while talking
- [0:46] make her more excited
- [0:10] keep talking continuously — do not wait for the sound effect to finish
- [0:27] that sound effect was too loud
- [0:31] start talking instead of waiting for the effect to finish
- [0:46] one image has no text — take it out; and say in the chat whether every
  image got used

From the chat, on **v8/v9**:

- her own 7m50s recording (`17th St 378`) replaces the TTS: several takes of
  most lines, out of order, **use the LAST take**, and the very last section on
  the tape is the intro
- sound effects are too loud — measure the dB and pull the hot ones down,
  especially toward the end
- she never recorded the ear-goblins sheet — Laura reads it until she does
- **the audio cut is wrong** (2026-08-25) — see below

## The audio-cut fault, measured

Transcribed v8 and v9 (whisper-1, word timings) and diffed against the
intended script in `build-vo.js`. **Both versions have the same fault, so it
is in the cutting, not in v9's effects work.**

- `Scientists did a study` is heard as **`Science did a study`** — the first
  word of the reel is clipped.
- **Seven section numbers are missing entirely**: the "One / Two / Three" that
  opens b1·b2·b3, d1·d2·d3 and e3. Every one of them is the FIRST word of its
  shot.
- `secret fish memories` → `fish memories`; `Less worries more duck` → the
  "Less" is clipped; `You could grow gills You probably will` comes out
  scrambled at the joint.

The pattern is a shot-HEAD trim: it eats the leading word. The suspect is the
`edge` knob added to this spec to silence vo-film's dead-air warning —
`{ max: 0.45, keep: 0.22 }` — which tightened every joint far enough that
`clampBounds`/`snapToSilence` no longer keeps the attack of the first word.
Fixing it means re-cutting from **her original recording**, which is not on any
server: it lived only in the previous session's container and her phone.
