# Sophie — F5-TTS voice preset

A zero-shot voice preset for [F5-TTS](https://replicate.com/x-lance/f5-tts).
F5 has no hosted "voice ID": the voice *is* this reference clip. To reuse the
voice, feed `reference.wav` + `reference.txt` on every call.

## Files
- `reference.wav` — 12s reference (mono 24kHz), from the "17th St" recording
  (the clean 2:32–2:44 stretch). This exact clip is what produces the liked voice.
- `reference.txt` — the transcript of `reference.wav` (F5's `ref_text`).

## How to generate speech in this voice
- Model: `x-lance/f5-tts`
- Version: `87faf6dd7a692dd82043f662e76369cab126a2cf1937e25a9d41e0b834fd230e`
- Inputs:
  - `ref_audio` = `reference.wav` (as a URL or data URI)
  - `ref_text`  = contents of `reference.txt`
  - `gen_text`  = whatever you want the voice to say
  - `remove_silence` = true

## Notes
- Cost ≈ 1¢ per ~10–15s of generated audio (Replicate compute).
- F5 has slight run-to-run randomness in rhythm/prosody; timbre stays consistent.
- For a higher-fidelity, hosted voice ID, see the MiniMax clone (voice_id
  `R8_HERKODDB`) or an ElevenLabs Instant Voice Clone.
