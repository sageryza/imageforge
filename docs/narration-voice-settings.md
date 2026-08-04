# Narration voice — the settings of record

Everything the NDE films' narration passes through, written down so it can be
removed, compared against, and put back exactly. `editor.js` is the live copy of
these values; this file is the human record.

## The voice
- **Sophie — morning**, ElevenLabs voice id `UTkHGl2ImiT6gwtAFCql`, a
  **professional** (fine-tuned) clone, 7 source samples, ~227MB of morning
  voice memos.
- **Retraining a professional clone reuses its voice id.** Nothing in the id,
  the model name, or the settings changes when the voice is retrained — so
  anything keyed on those alone cannot tell the new model from the old. That is
  why the narration cache key carries `NARRATION_REV` (`EDITOR_NARRATION_REV`,
  default `2026-08-04`); bump it after a retrain or old takes are served
  forever.
- **A retrain is destructive at ElevenLabs' end**: the previous model is gone,
  and the only surviving trace of how the voice used to sound is audio already
  rendered from it. Those files are archived at `voice-archive/` in Storage —
  they cannot be regenerated.

## The stack (as shipped, July–August 2026)
Applied in this order to every narration line:

1. **Whisper tag** — the text is prefixed with `[quietly] `. An `eleven_v3`
   audio tag, not a setting: it changes the performance, not the encoder.
2. **Model** — `eleven_v3`.
3. **Voice settings** — `stability 0.4`, `similarity_boost 0.8`, `style 0.3`,
   `use_speaker_boost true`. (Omitting these entirely makes ElevenLabs use the
   voice's own saved defaults, which is not the same as sending zeros.)
4. **Speed-up** — ffmpeg `atempo=1.12`, ~12% faster.
5. **Loudness** — ffmpeg `loudnorm=I=-16:TP=-1.5:LRA=11`, 44.1kHz mono.

Steps 1–4 are choices about how the narrator should sound. **Step 5 is not** —
it is mixing, and it is what makes the narration sit at the same level as the
interview clips (which are cut to the same target). A film built without it has
narration at a different volume from the voices around it.

## Removing them
`scripts/nde-revoice.py --plain` drops the whisper tag, the voice-settings
override and the speed-up (keeping only the loudness match, so a film still
mixes). Adding `--raw` drops the loudness match too — the untouched bytes
ElevenLabs returned, which is the right form for judging the voice itself.

## Env overrides (editor.js)
`EDITOR_NARRATION_VOICE`, `EDITOR_NARRATION_MODEL`, `EDITOR_NARRATION_TEMPO`,
`EDITOR_NARRATION_REV`. The whisper tag and the voice settings are in code
(`NARRATION_PREFIX`, `buildNarration`).
