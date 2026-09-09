# Character voices

An mp3 of one character speaking, cut out of a clip we already shot. It rides a
Seedance job as `referenceAudioUrls` and the prompt names it by slot, the same
way a picture is named:

    her mother is the woman in [Image1] and her voice is in [Audio1].

**It works on the cheap door and costs nothing extra.** Measured 2026-09-09:
`mom-character-clip` sent both parents' voices with two stills on
`bytedance/seedance-2.0-mini` through OpenRouter and it completed for 5.6¢ — the
same price as the identical job with no audio at all. Seedance charges by the
second of output and nothing for what it reads, and the person filter does not
trip on a voice the way it does on a face.

**Mini prices, measured, 480p 3:4:** 4s $0.0558 · 5s $0.0697 · 8s $0.1111.
About 1.4¢ a second.

## 32 kHz is the ceiling — there is no hi-fi original

Every clip in this film, on both doors, comes back **32000 Hz stereo AAC at
~130 kbps** — Seedance 2.5 through APIFRAME and 2.0 Mini through OpenRouter,
identically. So a voice cut is as good as its clip and no better; there is
nothing higher-fidelity to go back to. The cuts here are made at the native
32 kHz in stereo (mp3 160k) so the only loss is the one re-encode.

Nor is any of it dry. The floor under Edna's lines sits about 28 dB below her
peaks — the ward's own room bed is in there with her, in every clip.

## Cut only a stretch where that character alone speaks

Read the card's script and confirm nobody else has a line inside the span. A
voice built on the wrong speaker poisons every clip that references it, and
nothing on screen ever says so.

`python3 pull-voice.py <name> <clip-url> <start> <end>` cuts it, files the mp3
in the Dump under "Ward → voices" and records the url in `voices.json`. Free —
ffmpeg in the container, no model call.

## On file

| voice | from | why the span is safe |
|---|---|---|
| `sophie-voice` 5.4s | climax md-31a | her three questions; the doctor is silent throughout |
| `grayson-voice` 5.9s | climax md-31a | his whole speech; Sophie is silent throughout |
| `assistant-voice` 4.5s | climax md-32b | "Are you ok?" twice; Sophie is dissociated and silent |
| `edna-voice` 5.1s · `edna-voice-alt` 2.6s | soap 43a v3 / v2 | hers are the only lines in the card |
| `mom-voice` · `dad-voice` | the parents' audition | pulled by `mom-character-clip` |

**Sophie's is thin** — 1.2 seconds of actual speech inside 5.4, because her
lines in that scene are three one-word questions with the doctor silent between
them. It is her real voice and it is the best that exists today; the next scene
where she talks at length gives us a better one.

Still nobody: Nurse Mary, Juanita, Yolanda, Mrs. Norbert, Ms. O'Hara, Michael,
the Superintendent, Anastasia, Grandma. Ms. O'Hara and the nurses around her are
already shot in `hospital-severance-rough-cut` (cards 36a, 36b, 37).
