# The Christmas narrator — an ElevenLabs instant clone of the Seedance baritone

**`Christmas narrator (Seedance baritone)` — voice id `1aptBQCDmacSX7YMLuyg`**
(2026-09-16, Sophie: "the voiceover needs instant clone from all voiceovers
not the one 11labs sounds different"). Renders on **`eleven_multilingual_v2`**,
stability 0.5 · similarity 0.75 · style 0 · speaker boost on — never `eleven_v3`.

- **Built from the clips themselves.** There is no recorded narrator: the
  baritone is baked into each Seedance clip's soundtrack, so the sample is the
  14 `vo-gloomiest` takes in `voiceovers.json` whose bed measures *clear*
  (`spread` ≥ 20), each cut to its spoken span (+0.25s), mono 44.1k, 0.3s of
  silence between, 192k mp3 — **3:22**. Takes whose whisper read was garbled
  (Seek Leah, the Chinese one) are out. Mean −19 dB, peak −1.4 dB, no
  loudnorm, no gain.
- **The slot.** Her Creator plan is 30 voices and all 30 were full; on her
  word the same hour four went: Michael White, Miriam, Sophie — doctor and
  Sophie — doctor v2. Three slots are free after this one.
- **The 11labs voice she had cut in** (`gloomy`, a generated voice, the mp3
  named `ElevenLabs_…gloomy_gen…`) says *"Turns out, people were doing quite
  a lot of Christmas, before there was Christmas."* — it is on the audio
  library as `christmas-commercial/01-…` and it stays in her slot list.
- **The first lines in the clone** are on the audio library
  (`christmas-commercial/02…05`) and on the Compare page *Christmas narrator
  clone v1 — the new lines* in the `new-session-962cc0` chat; the three new
  lines there are a chat's draft awaiting her edit, not the script.

**Not the Film Editor for this film (2026-09-16, Sophie: "don't use the film
editor").** She is cutting in LumaFusion; the reader
(`scripts/fcpxml-to-cut.js`) turns her export into a cut doc, and that doc
was rendered once and pinned before she said so. What she gets back is
sounds and clips to drop into LumaFusion, or an mp4 — not a cut to co-edit.

## Where mom's "Presents? Apple cider?" goes (2026-09-17, her go)

Her script asks for the two words on two quick zooms, and both zooms are
really in the cottage clip (`0db2e049`, the one her cut uses whole):

- **the present held up** — 2.75s to 3.45s into the clip
- **the sip from the copper mug** — 3.5s to 4.7s
- robbers from 4.8s, the women with nothing ~9.8s, back out the dark window
  11s to 13s

**The take cannot hit both as one piece.** Measured on the file (40ms RMS
windows): "Presents?" runs 0.00–0.45 and "Apple cider?" 1.86–2.58, so the
words are **1.86s apart** where the pictures are **0.85s apart**. It is split
into two sound pieces instead, each landing ~0.15s after its cut so the
picture registers first:

- `Presents?` — in 0.00 / out 0.60, at **+2.90** into the clip
- `Apple cider?` — in 1.80 / out 2.62, at **+3.70**

**And the narrator's line moved with them.** It sat at +7.04 (over the
robbery) because mom's take was parked at +4.2; with mom on her zooms it
starts at **+8.00**, so "…before there was CHRISTmas" lands over the pull
back out through the dark window and finishes before the boy speaks.
Verified on the render: speech peaks at 45.8s and 46.6s against frames
showing the present and the mug.
