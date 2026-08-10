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

## Assembling a narration FILM: ONE command, don't hand-roll the pipeline

**`node scripts/vo-film.js spec.json --dir work/ [--final]`** — spec in, a
verified mp4 out. It runs the whole settled pipeline (two-pass clean of each
ORIGINAL recording → editor.js's cutter locates every span → word-timing
noise removal → per-shot video segments, PCM audio, one mux) with a
**per-shot verdict cache**, so changing one beat re-cuts and re-verifies one
beat instead of re-transcribing the film — the rebuild-verify toll both the
Evan and Mason chats paid five-plus times each. `--final` runs the
vo-verify full-transcription gate; run it before ANY delivery. TTS bridge
shots (`{ "tts": "line" }`) render on her clone with the settings of record,
and the tool prints the TTS lines so the delivery message can name them word
for word. The spec format and every earned rule are in the file's header —
read it before overriding anything.

**One judgement call the tool can't make for you:** whether loud non-word
sound at a cut's edge is a LAUGH (keep — the Evan film lost one) or the
PHONE being moved (drop — the Mason memos' handling noise measured 10.9dB
above her speech). vo-film drops it by default; if a take ends in a laugh,
widen that phrase to the word after the laugh, or cut that one shot by hand.

## Cutting spans: ONE cutter, and splices are approved by ear

- The precise cutter lives in **`editor.js`** (`phraseSpan` + `clampBounds` +
  `detectSilences` + `snapToSilence`, the permanent clip cache) and is
  imported by every tool that cuts. Do NOT hand-roll span cutting — the
  edge cases (gap-aware padding, snap caps, repeated words) each cost real
  debugging once.
- Removing something from the MIDDLE of speech is a splice, and a splice is
  approved by ear, not shipped invisibly (the reason pause removal lives in
  the Cutting Room, not inside the Episode Editor's render).
- **Before delivering a cut, RUN `node scripts/vo-verify.js cut.mp4
  [--script script.txt]`.** It checks both things and exits non-zero on
  either. "The code removed them" is not verification — the Evan cut proved
  that twice.
  - **Measure silence RELATIVE TO SPEECH (`speech85 - 20dB`), never against
    the floor.** `floor + 4` is correct *inside* the detector and WRONG as a
    verifier: her floor wobbles several dB, so a genuinely dead **6.8s**
    stretch split on noise blips and reported "0 runs". A second cut full of
    dead air was one keystroke from being delivered as clean.
  - **Check speech loss with an LCS diff** reporting CONTIGUOUS missing runs.
    A bag-of-words ratio passes a cut that ate a whole sentence.
  - **A pause SHE ASKED FOR is declared with `--keep a-b,c-d` (seconds), not
    deleted to make the check green (Aug 2026).** The Evan film opens on a
    1.10s gap between the phone ringing and "it was Evan" — that gap IS the
    phone ringing, and she asked for it by name: "I want that exact pause."
    The verifier calls it dead air, and the obvious way to pass is to remove
    it, which is the one thing that must never happen. A listed run prints
    `KEPT — asked for` and does not fail; anything unlisted still fails. If
    `--keep` is passed and NOTHING matches, it says so — that is the signal a
    tightening pass ate her pause.
  - **The other half of that: source the unit from the UNTIGHTENED audio.** A
    floor low enough to catch real dead air (0.36s) also catches a deliberate
    1.10s ring pause, because a pause detector cannot tell intent. Protect
    such units at the BUILD, by name, rather than tuning the floor around them.
  - **Retry every transcription chunk and reject error bodies** — one DNS
    blip put the words "dns resolution failed" into a transcript and faked a
    31.5% loss.

## Assembling a narration film (the five traps, all shipped wrong once)

Full findings in `docs/nde-precise-cutting.md`. In short:
- Run the pause detector on the **original continuous recording**, never on
  audio you already spliced — a pre-spliced track has no room tone left, so
  pass 2's floor lands in quiet speech and deletes sentences.
- **Never remap take times arithmetically through `--edits`** to pick takes;
  it lost speech on 9 of 35 takes. Re-locate each take in the CLEANED master
  with `editor.js`'s `phraseSpan`.
- **Word gaps don't find holes, energy does** — whisper folds trailing noise
  into a word; one "continuous" span hid a 16-second hole.
- **Spans disjoint in word index can still overlap in TIME** and replay a
  word ("…the proof behind | behind the end…"). Clamp in play order.
- **Word-anchored cutting drops laughs and breaths at the edges** — whisper
  transcribes no word for a laugh, so "He said, HAHA, what…" cut as "what…".
  Extend edges across audio above `floor + 8dB`, and treat a run as DEAD only
  if it lacks **sustained** voicing (measured: her laugh holds 0.40s above
  `floor + 10dB`; a real dead stretch holds 0.00s). A PEAK test fails — a fan
  surge inside a pause protected two ~7s holes.

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
