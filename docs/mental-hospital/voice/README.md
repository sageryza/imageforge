# Sophie's voice, cut out of the ward footage (2026-09-15)

Her ask: *"i want to train elevenlabs voice from sophie ward voiceover · find
all her scenes · cut just her audio out."*

## The finding that shapes everything: THERE IS NO ONE SOPHIE VOICE

Every ward clip is a separate Seedance job, and each job generates its own
audio — so the Sophie character is voiced by a slightly different person in
almost every clip. Measured over the 63 cuts of her speech (resemblyzer
speaker embeddings, cosine):

- Sophie-to-Sophie, across clips: **mean 0.63**
- the doctor's lines against the Sophie centroid: **0.68**

i.e. two of her own clips are, on average, *less* alike than she is to the
doctor. Training one voice on all of it averages several people into a mush.
So the cuts are grouped by voiceprint (agglomerative, cosine 0.25) and **one
coherent group carries the clone**: 23 cuts, 2:13, and it happens to be the
group holding the narration — the pre-ward city voiceover (`ext`, `p2a`,
`p2a25`, `p2b`, `p2b3`, `cut-1-seedance`) plus her lines in `intakeA3`,
`climax1`, `table-paused` and the metaphor-machine speech.

**The other 40 cuts are her lines in other voices.** They are kept, labelled
and playable — they are not rejects, they are a different take of the
character — but they stay out of the training set.

## What exists

- **The ElevenLabs voice** — `Sophie — ward (Seedance)`, voice id
  `3JpsF6ByJnAOuSXWx4zD`. An INSTANT clone: her Creator plan's one
  professional slot is already spent on `Sophie — morning`
  (`UTkHGl2ImiT6gwtAFCql`), which is untouched. Renders on
  **`eleven_multilingual_v2`** like everything else here — never `eleven_v3`.
- **`sophie-spans.json`** (beside this file) — all 63 spans: the source clip's
  url, the in/out seconds, the transcript of what she says, the voice group,
  and the cut's own permanent url in the Dump (bundle `Sophie ward cuts`).
- **The page** — "Sophie's voice from the ward — v3", posted into the
  `elevenlabs-sophie-ward-voice` chat and pinned. The clone's two samples, the
  training set, all her audio, and every cut with a `her` / `not her` mark.
  Her marks land on verdict sheet `ward-voice-cuts`; a cut she marks *not her*
  comes out of the next build.

## How it was done (re-runnable)

1. 125 ward clips gathered from the Dump bundles (`ward-seedance`,
   `cut-1-seedance`, `part-2/3-seedance`, `pre-ward-doctor-intake`,
   `ward-doctor-cuts`, `ward-eyebar-ladder`, `hospital-night-sophie-s-cuts`)
   plus `belt/clips.json`, the `rough-cut/af-*-final.json` results and the
   jazz reference. 124 carry audio, 35.4 minutes, 91 distinct transcripts.
2. `node scripts/transcribe-media.js <urls…>` — whisper-1 with word timings,
   **banked** in Storage by source url, so asking again costs nothing.
   This run: **21¢**.
3. `scripts/ward-sophie-utterances.py` — words grouped into utterances at a
   0.45s gap, one speaker embedding each.
4. `scripts/ward-sophie-label.py` — the spans. **Who says what is decided by
   the SCRIPT** (`docs/mental-hospital/**/jobs*.json`, `script-*.md`), never by
   the acoustics, for the reason above. A span that holds two speakers names
   the phrase that is hers and the cut lands on whisper's word timings for
   exactly those words.
5. `scripts/ward-sophie-cut.py` — ffmpeg cuts each span out of the original
   mp4 at its own sample rate, mono, 12ms/20ms fades so no cut clicks. The
   source is never re-encoded lossily on the way in.

## Numbers

- her speech in the ward footage: **3:25** across 63 cuts and 34 clips
- the narration (her voiceover): **1:58** · her lines in scenes: **1:26**
- the coherent training group: **2:13** (23 cuts)
- the jazz reference clip (v6) has **no speech in it** — it is music.

## If she wants it rebuilt

Read her marks off
`GET /api/chatfeed/verdict?chat=elevenlabs-sophie-ward-voice&sheet=ward-voice-cuts`,
drop the `false`s, re-POST the remaining cuts to
`POST https://api.elevenlabs.io/v1/voices/add` and delete the old voice
(`DELETE /v1/voices/3JpsF6ByJnAOuSXWx4zD`). 28 of her 30 voice slots were in
use before this one.
