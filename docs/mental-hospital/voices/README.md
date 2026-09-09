# Character voices

An mp3 of one character speaking, cut out of a clip we already shot. It rides a
Seedance job as `referenceAudioUrls` and the prompt names it by slot — the same
way a picture is named — so the character sounds the same clip to clip:

    her mother is the woman in [Image1] and her voice is in [Audio1].

**Measured 2026-09-09: reference audio passes the OpenRouter/Mini door.**
`mom-character-clip` sent both parents' voices with two stills on
`bytedance/seedance-2.0-mini` and it completed for 5.6¢ — the person filter did
not trip on the audio. So a voice reference is cheap and works on the cheap door.

**Cut only a stretch where that character alone speaks.** Read the card's script
first and confirm nobody else has a line inside the span; a voice reference built
on the wrong speaker poisons every clip that uses it, silently.

`python3 pull-voice.py <name> <clip-url> <start> <end>` cuts it, files it in the
Dump under the "Ward → voices" bundle and records the url in `voices.json`.
Free — ffmpeg in the container, no model call.

## On file

| voice | source | who pulled it |
|---|---|---|
| `edna-voice` (5.1s) · `edna-voice-alt` (2.6s) | soap 43a v3 / v2 — hers are the only lines in that card | this chat |
| `mom-voice` · `dad-voice` | the parents' audition | `mom-character-clip` |

Missing: **Sophie, Dr. Grayson, the assistant.** No clip with any of them
speaking has been shot yet — every belt card with dialogue is still `ready`, not
shot. `mom-character-clip` has these three named as its own next job, so check
with it before pulling them here.
