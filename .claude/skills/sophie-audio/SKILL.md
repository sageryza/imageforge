---
name: sophie-audio
description: >
  The settled machinery and rules for ANY work on Sophie's audio — cutting her
  recordings, removing pauses/silence/filler, choosing takes, assembling
  narration for a film, or rendering her voice with TTS. Use this skill BEFORE
  touching a recording or a voiceover, even for a "simple" trim: chats keep
  hand-rolling cutters and silence detection that already exist debugged, and
  the failures ship straight to Sophie's ears (a delivered cut full of
  "removed" dead air; a 15-minute film in the wrong voice).
---

# Working with Sophie's audio

Two documents are the law — this skill is the tripwire that gets them read:

- **`docs/nde-precise-cutting.md`** — the doc of record for cutting (word
  alignment, snapping rules, pause detection, data layout).
- **`docs/narration-voice-settings.md`** — the human record for her TTS
  voice; `editor.js` / `scratchpad.js` are the LIVE copies (when a doc and
  the code disagree about her voice, trust the code).

## Removing pauses: NEVER a naive silence threshold

Sophie records in real rooms — fans, blankets, the phone set down mid-take —
so her pauses are **not silent**. Measured on her own recordings (Aug 2026):
after normalizing, pauses sat at **~−20dB RMS while quiet speech was −17dB**
— 4–7dB apart. Any `silencedetect` / fixed-floor approach therefore declares
a track "pause-free" that a human hears as full of gaps. This exact failure
shipped: a chat delivered narration it described as "dead air gone" that was
full of silence.

What works, already debugged — use it, don't re-derive it:

- **`node scripts/vo-remove-pauses.js in.mp3 out.mp3`** — the two-pass
  detector: pass 1 finds pauses by WORD TIMING + relative energy (whisper-1
  word timestamps over 75s chunks, 20ms RMS profile, sustained-energy veto);
  pass 2 finds room-tone runs against the file's own floor. Also handles the
  thump-and-drift case (phone set down registers at full speech level).
- **The Cutting Room** (`cuttingroom.js`) runs the same two passes with
  Sophie approving each cut on the transcript — when she should choose what
  comes out, hand her the recording there instead of cutting blind.
- A removed pause is **compressed to ~0.28s, never deleted outright**.
- **Whisper often doesn't transcribe "uh"/"um" at all**, so filler removal by
  transcript alone is partial — the energy passes catch many of them as
  breath pauses.

## Cutting spans: ONE cutter, and splices are approved by ear

- The precise cutter lives in **`editor.js`** (`phraseSpan` + `clampBounds` +
  `detectSilences` + `snapToSilence`, the permanent clip cache) and is
  imported by every tool that cuts. Do NOT hand-roll span cutting — the
  edge cases (gap-aware padding, snap caps, repeated words) each cost real
  debugging once.
- Removing something from the MIDDLE of speech is a splice, and a splice is
  approved by ear, not shipped invisibly (the reason pause removal lives in
  the Cutting Room, not inside the Episode Editor's render).
- **Before delivering a cut, verify it the way she'll hear it**: measure the
  result (remaining >1s low-energy runs via the same RMS profile — not
  silencedetect) and spot-listen the joins. "The code removed them" is not
  verification — the Evan cut proved that.

## Her voice, rendered or processed

- **NEVER loudnorm her voice** — she rejected the dynamic squeezing. Cuts
  are plain cuts of the original bytes; clips get 12ms edge micro-fades only.
- **TTS: `eleven_multilingual_v2`, NEVER `eleven_v3`** ("no one uses v3 ever
  again" — a stale doc note shipped a 15-minute film in the wrong voice).
  Professional clone "Sophie — morning" `UTkHGl2ImiT6gwtAFCql`, settings of
  record: stability 0.5, similarity_boost 0.75, style 0, use_speaker_boost
  true. `<break time="1.0s" />` tags work; v3-style `[quietly]` tags do not.
- If a delivered piece mixes her real takes with TTS bridges, say WHICH lines
  are TTS, word for word, in the reply (film renders record per-unit
  receipts on `film.notes` — read them before debugging "wrong voice").
- Concatenate per-unit audio as **PCM/WAV, never AAC pieces** — AAC priming
  adds ~24ms per join and walks the sound off the pictures (measured).

## The surfaces (route her to them instead of cutting blind)

- **Cutting Room** — her recordings, marked on the transcript, pause chips.
- **Cut Marks** — manual cuts on a playhead, audio or video.
- **Episode Editor** — transcript spans → snippet cards → rendered episodes.
- **Cut picker** (`picker-shell.html`) — she picks spans on a page you post.

## Memory discipline

An hour of decoded PCM is ~115MB and the server has 512MB total — fold RMS
profiles STREAMING off the decoded file, never into one Buffer.
