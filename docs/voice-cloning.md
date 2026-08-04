# Voice cloning (ElevenLabs PVC)

How Sophie's professional voice clone is built, and the rules that make the
difference between a clone that sounds like her and one that sounds like a
processed recording of her.

## The account

- Plan is **Creator** (~$22/mo). That is **1** professional voice clone (PVC)
  slot — Starter has 0, Scale (~$330/mo) has 3, Business (~$1,320/mo) more.
  So a second voice means retraining the one slot, not adding to it.
- **Retrain the slot in place; never delete the voice.** Deleting is permanent
  and takes the `voice_id` with it, which breaks everything pointing at it —
  `editor.js` narrates episodes with `UTkHGl2ImiT6gwtAFCql`. Replacing that
  voice's *samples* keeps the id, so no code changes when the voice changes.
- Downgrading is not deleting: below Creator the PVC stays in the library,
  locked, and works again on upgrade.
- **Back up the training samples before replacing them.** They stay downloadable
  from `GET /v1/voices/{id}/samples/{sample_id}/audio` right up until you remove
  them, and they are the only way to rebuild a voice later. The August 2026
  set (the three "Sage3" samples, 1.4h) is archived in membry Storage at
  `voice-backup/sage3-pvc-2026-08/`.

## Source material

The 993+ memo archive (`memo-audio/manifest.json` in membry Storage, see
`memos.js`) is the pool. Every memo id is stamped `YYYY-MM-DD_HHMM` **in local
time**, so "the voice I have in the morning" is a real, filterable thing —
`id.slice(11,13)` is the hour it was recorded.

The August 2026 training set: recordings made 5–10am in 2025–2026, categories
`idea`/`journal`/`todo`/`dream`/`quote`/`transcription` (which excludes singing
and anything with a second speaker in it). 42 candidates, 4.3 hours.

Screen those on measured loudness before using them, not by ear:

- Drop integrated loudness below **-30 LUFS** — a distant/quiet recording, and
  normalizing it up brings the room up with it.
- Drop peaks above **0 dBFS** — already clipped, and clipping trains as
  distortion.

That took 42 down to 36 files (3.6h after trimming), which is comfortably past
the 2–3 hours ElevenLabs wants (30 minutes is their hard minimum).

## Preparation

`scripts/prep-voice-training.sh` does one file; the header explains each filter
and why. The short version: a 70Hz high-pass, two-pass loudnorm to I=-18/TP=-3,
then long pauses (>1.5s) cut back to 0.5s. Normalize before trimming — the
silence threshold is absolute.

**Do not denoise.** ElevenLabs is explicit that a PVC reproduces "any artifacts
and unwanted audio present in the samples", and the instinct is to scrub the
recordings first. That backfires: a denoiser smears timbre, and the clone learns
the smear. Consistent room tone across the set beats cleaned-up room tone.
ElevenLabs' own noise removal toggle at upload (`remove_background_noise`) is
left off for the same reason.

Concatenate the prepped files chronologically into **~30 minute chunks** with
0.3s of silence between recordings (a hard splice clicks), then encode mono
192k mp3.

## Uploading

Existing voice, so no `POST /v1/voices/pvc` — add to the one we have:

1. `POST /v1/voices/pvc/{voice_id}/samples` — multipart `files`, one chunk per
   request. ~40MB each uploads fine.
2. Delete the previous samples once the new ones are all up
   (`DELETE /v1/voices/pvc/{voice_id}/samples/{sample_id}`) — training with both
   sets present would blend the two voices.
3. `POST /v1/voices/pvc/{voice_id}` to rename/redescribe.
4. `POST /v1/voices/pvc/{voice_id}/train` `{model_id}`.

**Training will not start until the voice is verified, whatever
`voice_verification.requires_verification` says.** It returns `{"status":"ok"}`
and then sits at `fine_tuning.state: not_started`. Check
`GET /v1/voices/pvc/{voice_id}/captcha` — if that returns a PNG, a verification
is pending. Verification means reading a phrase aloud and is Sophie's step, done
in the ElevenLabs app; a chat cannot do it. Re-call `/train` afterwards if the
UI hasn't already started it. Training itself runs 2–6 hours.

Training chunks are archived at `voice-training/morning-2026-08/` in membry
Storage, so the set can be re-uploaded without rebuilding it.

## Instant clones (IVC) — the cheap path

The Creator plan carries **30 instant-clone slots** alongside the single PVC
slot (checked live Aug 2026: `voice_limit: 30`, `professional_voice_limit: 1`),
so an instant clone costs nothing and never touches the trained voice. That is
the right tool for trying a *register* — the on-camera voice, the tired voice,
the reading voice — before deciding anything is worth the one PVC slot.

Upload is a single multipart `POST /v1/voices/add` with
`remove_background_noise=false` (same reasoning as the PVC — a denoiser smears
timbre and the clone learns the smear). ElevenLabs wants 1–3 minutes; past
that, more source stops helping an IVC and the answer is a PVC instead.

## The video-audio pool — look in `compare-audio/`, not the Dump

**Audio pulled off Sophie's own videos lives in membry Storage at
`compare-audio/`** — 24 named `.m4a` files, **2.6 hours** as of Aug 2026
(`harry-potter-1/2`, `morning-rituals`, `envelope-gap-shirt`, `plants-heal`,
`good-vs-god-1/2`, …), plus whichever ones are attached to a Story Room story
as its `voiceover.url`. That is a **PVC-sized** pool, not just an IVC one.

Do not go looking for this material in `/api/drop` or `/api/audio`. The `.MOV`
files sitting in the Dump are the phone's originals, mostly recorded at arm's
length, and they measure far worse than the extracted set — three of the five
banked there fail the -30 LUFS screen, one at -58 LUFS. The `compare-audio`
files are the same voice recorded close, and 21 of the 24 pass comfortably
(-18 to -28 LUFS; only `morning-rituals`, `spiritual-books` and
`thanks-for-watching` fall below).

**Prep is not automatically the right call for this set.** The PVC chain in
`scripts/prep-voice-training.sh` was tuned for phone voice memos that vary
wildly file to file; the video audio is already close-mic'd and consistently
levelled, so the two-pass loudnorm has much less to correct and the pause trim
changes her natural on-camera timing. A/B before assuming it helps —
`voice-training/video-audio-2026-08/` holds the same 3 minutes both ways
(`source-RAW-3min.mp3` / `source-PREPPED-3min.mp3`) and the clones built from
each: RAW `DUXcVGz5LgXD9sHeMeQ3`, PREPPED `kDyY3bsMGLB2Aq4haSD2`.
