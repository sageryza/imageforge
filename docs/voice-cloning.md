# Voice cloning (ElevenLabs)

Turning a pile of phone voice memos into a trained voice. Written from doing it
once, badly, and then again correctly — the mistakes are documented here
because they were not obvious and cost a full rebuild.

Two kinds of clone, and they are barely related:

- **Instant (IVC)** — 1–3 minutes of audio, no verification, ready in seconds,
  unlimited-ish slots. Good enough for drafts and tests.
- **Professional (PVC)** — 30 minutes minimum, 2–3 hours recommended, a
  verification gate, 2–6 hours of training, and on most plans exactly one slot.

## The account

- Plan is **Creator** (~$22/mo) = **1** PVC slot. Starter has 0, Scale (~$330/mo)
  has 3, Business (~$1,320/mo) more. A second voice means retraining the one
  slot, not adding to it.
- **Retrain the slot; never delete the voice.** Deleting is permanent and takes
  the `voice_id` with it, breaking everything that points at it (`editor.js`
  narrates with `UTkHGl2ImiT6gwtAFCql`). Replacing a voice's *samples* keeps the
  id, so the voice can change with no code change anywhere.
- Downgrading is not deleting: below Creator the PVC stays in the library,
  locked, and works again on upgrade.
- **Back up the old samples before replacing them.** They are downloadable from
  `GET /v1/voices/{id}/samples/{sample_id}/audio` right up until you delete
  them, and they are the only way to rebuild that voice later. The August 2026
  set is archived at `voice-backup/sage3-pvc-2026-08/` in membry Storage.

## Stage 1 — Choose the recordings

The memo archive (`memo-audio/manifest.json`, see `memos.js`) is the pool. Every
id is stamped `YYYY-MM-DD_HHMM` in **local** time, so "the voice I have in the
morning" is a filterable property: `id[11:13]` is the hour it was recorded.

The August 2026 set: 5–10am, 2025–2026, categories `idea`/`journal`/`todo`/
`dream`/`quote`/`transcription` — which excludes singing and anything with a
second speaker. 42 candidates, 4.3 hours.

Then screen on measurement, not by ear:

- **Reject integrated loudness below -30 LUFS.** Recorded across the room; the
  boost needed to fix it brings the room with it.
- **Reject peaks above 0 dBFS.** Already clipped, and clipping trains as
  distortion.

42 → 36. The gain cap in stage 2 then dropped 6 more, leaving 30 files.

## Stage 2 — Condition each file

`scripts/prep-voice-training.sh`, one file at a time, parallel with `xargs -P`.

1. 70Hz high-pass (handling rumble). The only spectral change.
2. **One fixed gain**, `min(target − measured_RMS, +6dB)`, targeting -23 dBFS RMS.
3. Files needing more than +6 dB are **dropped**, not boosted.
4. `alimiter` at -3 dBFS for stray transients.
5. Pauses over 1.5s cut to 0.5s; anything shorter untouched.
6. Out as 48kHz mono PCM.

### Do not use loudnorm

This is the mistake worth the whole document. The first build used two-pass
`loudnorm` at I=-18. `loudnorm` **silently abandons linear mode for DYNAMIC mode
whenever the required gain is large**, which for arm's-length phone memos is
every file. Dynamic mode is a compressor: it rides gain up through every pause,
lifting room tone and 64kbps codec noise until they audibly swell, then ducks as
speech returns. On one file speech rose ~11 dB while the **noise floor rose
20 dB**. The clone reproduces that pumping perfectly.

It is not even hidden — the pass-1 JSON says `"normalization_type": "dynamic"`.
Read that field. If it says dynamic, stop.

A fixed gain can only lift the noise floor by exactly the gain applied. Hence
also the cap: some recordings simply cannot be levelled, and the correct move is
to discard them.

### Do not denoise

ElevenLabs is explicit that a PVC reproduces "any artifacts and unwanted audio
present in the samples," which reads as an instruction to scrub the input. It
backfires — a denoiser smears timbre and the clone learns the smear. Consistent
room tone beats cleaned-up room tone. ElevenLabs' own `remove_background_noise`
upload flag is left off for the same reason.

### QC — the check that would have caught it

For each file, compare the noise floor before and after:

    ffmpeg -i FILE -af astats -f null -    # read "Noise floor dB"

**The floor should rise by the gain applied, ±1 dB.** If it rises more than the
speech did, something is applying dynamics and the file is ruined. A frame-level
check is stronger: with `astats=reset=1`, the gap between the 10th-percentile
frame RMS (the pauses) and the median (the speech) must not shrink after
processing. Compression narrows that gap; fixed gain preserves it.

## Stage 3 — Assemble

`scripts/chunk-voice-training.py` — chronological order, ~30 minute chunks (the
size ElevenLabs asks for), 0.3s of silence between recordings so the splices
don't click, mono 192k mp3. Final set: 30 recordings, 2.63 hours, 7 chunks.

## Stage 4 — Upload and train

1. `POST /v1/voices/pvc/{voice_id}/samples` — multipart `files`, one chunk per
   request, ~40MB each is fine.
2. **Delete the previous samples only after the new ones are all up**
   (`DELETE …/samples/{sample_id}`). Training with both sets present blends two
   voices.
3. `POST /v1/voices/pvc/{voice_id}` to rename/redescribe.
4. `POST /v1/voices/pvc/{voice_id}/train` `{model_id}`. It trains ~7 model
   variants in parallel; poll `fine_tuning.state` and `progress`.

Instant clones skip all of this: `POST /v1/voices/add`, multipart `name` +
`files`, returns a usable `voice_id` immediately. (`/v1/voices/ivc/create` is
documented but returned 405 in August 2026 — use `/v1/voices/add`.)

## Verification (the part that will waste your day)

Training does not start until the voice is verified — **regardless of what
`voice_verification.requires_verification` says**. `/train` returns
`{"status":"ok"}` and then sits at `fine_tuning.state: not_started` forever.
Signs it is gated: `is_allowed_to_fine_tune: false`, and
`GET /v1/voices/pvc/{voice_id}/captcha` returning a PNG.

- **It is browser-only.** The ElevenLabs mobile app does not support PVC at all;
  it shows a "We are generating your voice, 2 to 6 hours" screen that is pure
  fiction when the voice is actually stuck unverified. Use
  https://elevenlabs.io/app/voice-lab — there is no button labelled "Verify",
  it's a **tick icon** next to the voice name, and the surrounding UI expects a
  mouse.
- **It cannot be relayed through a chat.** The captcha is a phrase rendered as a
  PNG which the speaker reads aloud, submitted to
  `POST /v1/voices/pvc/{voice_id}/captcha` as multipart `recording`. It expires
  in **under two minutes** — a fetch-and-relay round trip fails with "Time limit
  for voice verification exceeded", and each failure **burns an attempt**.
- 5 attempts, then a lockout; the counter refills on a timer visible at
  `fine_tuning.next_max_verification_attempts_reset_unix_ms`. Support can clear
  failed attempts.
- Failures record no reason (`verification_failures: ["None"]`). Documented
  causes: mic not permitted, background noise, delivery not matching the
  training samples, and reading a line more than once instead of reading it once
  and pressing Stop.

## Where things are kept

- Training chunks: `voice-training/morning-2026-08-v2/` (membry Storage).
- Previous voice's samples: `voice-backup/sage3-pvc-2026-08/`.
- Source recordings: the memo archive itself, untouched.
