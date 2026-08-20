# Narration voice — the settings of record

Everything the NDE films' narration passes through, written down so it can be
removed, compared against, and put back exactly. `editor.js` is the live copy of
these values; this file is the human record.

> **THE MODEL RULE (Aug 2026, Sophie: "no one uses v3 ever again").** Her voice
> renders on **`eleven_multilingual_v2` — never `eleven_v3`**. The professional
> clone is not optimized for v3 and the likeness collapses ("a cousin doing an
> impression"). The v3 stack documented below is the HISTORICAL record of the
> July 2026 NDE renders, kept so those takes can be reproduced or compared —
> it is not a recipe to follow. `editor.js`'s live defaults are
> `eleven_multilingual_v2`, no whisper prefix, tempo 1, constant gain.

> **THE ONE-TAKE RULE (Aug 2026, Sophie: "you're supposed to pick one clip
> and then chain them all together so that they don't change the register so
> much").** A narration spread over several shots is rendered as **ONE**
> ElevenLabs call and then SPLIT, never one call per line. Each request is
> synthesized independently — pitch, pace and warmth land somewhere slightly
> different every time — so a per-line film changes register at every cut, and
> it gets worse the more shots it has. `vo-film.js`'s `joinTTS` does it: the
> lines are joined into one take, then each shot is located inside it with the
> same `phraseSpan` path her real recordings use, so the film is one
> continuous performance cut up. A single-line piece is unaffected (there is
> nothing to drift against).
>
> **AND WHEN SHE PICKS A TAKE, ANCHOR TO IT** (Aug 2026, hearing the joint
> take: "I didn't love the take … I'll pick my favorite and then you can chain
> them to my favorite, you can chain them before and after"). One take removes
> the drift but leaves WHICH take to chance. `"anchor": "<shot id>"` on a
> vo-film spec renders that line alone, then the lines before it with
> `next_request_ids` and the lines after it with `previous_request_ids`, both
> conditioned on her chosen take. **Request stitching is seeded ONLY by a
> request id — audio cannot seed one** — so every take's id is written beside
> its audio (`<take>.wav.id`) at render time. A take whose id was not kept
> cannot be chained to and has to be re-rendered, which is a different take;
> that is exactly what happened to the first six takes of this film.

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
- **The instant clones are separate voices, not versions of her professional
  one.** Newest is **Sophie — instant (Aug 14)**, `t5WywHVtMw3aenhWkKCz`, made
  from a single 3:36 phone voice memo with its two long pauses (12.4s and 17.9s)
  cut out — 3:07 of speech in, one file. It renders on the same
  `eleven_multilingual_v2` + settings of record as everything else. Earlier
  instants (`Sophie — instant (Aug 3)`, `— Evan/Charlie (instant)`, the doctor
  pair) are still on the account and untouched; an instant clone is created, not
  retrained, so making a new one destroys nothing. **`Sophie — instant v2 (Aug
  14, stories)`, `7Se81wBB6ZL5kXV2XKu5`**, supersedes it for narration: 12
  minutes of her telling stories rather than one memo, and properly conditioned.
  How its recordings were chosen is in `docs/voice-cloning.md`.
- **The app's sliders are NOT the voice's saved settings (measured 2026-08-14).**
  Every one of her voices has `stability 0.5 / similarity_boost 0.75 / style 0 /
  speaker_boost true` saved on it — identical to the API default — yet her app
  generations that day went out at `0.77 / 1.0`, a combination appearing nowhere
  else in her history. The ElevenLabs app holds slider positions per session, so
  a render made there can differ from the same voice called through the API with
  nothing on the voice to explain it. Read the `settings` on the HISTORY ITEM,
  not the voice, when reproducing a take.
- **Cutting pauses out of clone SOURCE audio: measure against SPEECH, not a
  fixed floor** — the same rule as everywhere else in `docs/nde-precise-cutting.md`.
  On that memo, speech sat at −17.5dB and the room floor at −58dB, so a run
  quieter than `speech85 − 20dB` for ≥3s is a real pause; 0.4s of it is left at
  each end of a cut with 12ms edge fades, so the joins don't click. Verify the
  removed spans held no **sustained** voicing before trusting the cut (both here
  peaked ≥17dB under speech, i.e. dead).
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
