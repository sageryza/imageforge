# Precise voice cutting — how a transcript snippet becomes a clean audio cut

The documentation of record for the NDE pipeline's millisecond-accurate
cutting. Read this BEFORE cutting interview audio anywhere in this repo.
(CLAUDE.md's Episode Editor section summarizes it; this file is the full story.)

## The problem it solves
Cutting by raw transcript timestamps clips words mid-syllable. Whisper's word
timestamps drift — measured up to ~1.08s off, 14% of words >200ms — so a cut
placed on them slices into speech. Sophie rejected every montage cut that way.
The v7 pipeline below is what finally passed ("Amazing. That's perfect."), and
it is machine-verified, not ear-verified.

## The pipeline (six steps, in order)
1. **Word timestamps — cached forced alignment first, Whisper fallback.**
   Drift-repaired word times live in Storage at
   `nde-align-cache/<videoId>_<winStart>.json` ({videoId, winStart, winDur,
   words}), produced by wav2vec2 CTC forced alignment (`scripts/nde_align.py`,
   the WhisperX approach, <100ms accuracy) and published with
   `node scripts/upload-align-cache.js` (127 windows live, July 2026). A render
   picks the window covering the snippet's anchor (`snippet.timeSec`); with no
   covering window it listens fresh with OpenAI `whisper-1` word timestamps
   (~1c per window).
2. **Phrase location.** The snippet text is located in the window's words by a
   CONTIGUOUS best-match slide (difflib `SequenceMatcher(autojunk=False)`,
   ported verbatim to JS) — a repeated word later in the window cannot stretch
   the cut. (`phraseSpan` / `_phrase_span`.)
3. **Gap-aware padding.** Pad outward for a natural feel, but NEVER past the
   midpoint of the silence to the neighboring word — fixed the swallowed
   first-syllable-of-next-word bug. (`clampBounds`.)
4. **Silence snapping.** Real silences from ffmpeg `silencedetect`
   (noise=-32dB, d=0.2). End snap FORWARD-ONLY and hard-capped at the next
   aligned word's start (snapping can never add words); start snap only into
   silence abutting the first word. (`detectSilences` + `snapToSilence`.)
5. **Finishing.** Micro-fades (~30ms in / ~100ms out) + `loudnorm I=-16`,
   44.1kHz mono.
6. **Verification (batch work).** `scripts/nde-verify-cuts.py` slices the
   stitched result back apart, re-Whispers every clip, and compares first/last
   words against the expected quote — flags stray or missing words with no
   human ear required.

## The two implementations (keep in sync)
- **`editor.js`** — the server port; what the Episode Editor (`/editor`) runs
  on `POST /api/editor/:id/render`. Background job on the `forge-editor` doc;
  each render's `notes[]` records which timestamp path every clip took.
- **`scripts/nde-supercut-precise.py`** — the original validated Python CLI.
  `python3 scripts/nde-supercut-precise.py <candidates.json> <TITLE> <out.mp3>`
  with env flags: `WHOLE=1` (entire quote via head/tail anchors), `TIGHT=1`
  (phrase only), `AUDIO_ONLY=1` (no caption video), `ALIGN=1` (default on),
  `WIN_DUR` (window seconds), `KEEP_CLIPS=dir` (export per-clip files).
  Batch driver: `scripts/nde-rerender-all.py`.

## Where the data lives
- Source audio: Storage `nde-audio/<videoId>.webm` (raw bestaudio; banked by
  `scripts/nde-grab-local.py` from a residential connection).
- Transcripts: Firestore `forge-nde-videos` (one doc per video).
- Episodes/renders: Firestore `forge-editor`; rendered mp3s in Storage
  `nde-episodes/`.
- Alignment caches: Storage `nde-align-cache/` (see step 1).
- Finished cuts (Aug 2026): Storage `nde-episodes/editor/clip-cache/<sha1>.mp3`
  — content-addressed by `CUT_VERSION|videoId|normalized words|rounded anchor`.
  `editor.js` checks this before cutting anything, so a clip is only ever cut
  once; bump `CUT_VERSION` when the cutting logic changes so old cuts expire.
  Narration lives beside it in `narr-cache/` (keyed by voice+model+tempo+
  prefix+text).
- Montage cut lists: `scripts/nde-montages/<slug>.json` — the exact candidate
  lists the delivered montages were cut from; `scripts/seed-editor-montages.js`
  turns them into editor episodes (`--render` warms the clip cache).

## Rules that must survive any refactor
- Never cut on raw Whisper timestamps without alignment or snapping.
- End snapping is forward-only and capped at the next word — both halves of
  that sentence matter.
- `snippet.timeSec` (the anchor) selects the alignment window — keep it
  accurate when creating snippets programmatically.
- Narration cards fail loudly without `ELEVENLABS_API_KEY` — never silently
  skipped.
- Verify batches with `nde-verify-cuts.py` before delivering.

## Noisy pauses in voice-memo narration (Aug 2026 findings — Tolle shorts)
The pipeline above cuts SNIPPETS out of interviews. Cutting a whole read-through
of a narration (Sophie's Story Room voice memos) hits a different failure:
pauses full of breath/mouth/room noise. Measured live: after loudnorm her
pauses sat at **~-20dB RMS while quiet speech was -17dB** — 4-7dB apart — so
NO absolute silence threshold can find them (`silencedetect` at -32dB reported
a track "pause-free" that a human heard as full of gaps). What works:

1. **Locate pauses by WORD TIMING, chunked.** whisper-1 word timestamps over
   **75s chunks** (offsets restored). A hidden pause shows as an inter-word gap
   > 0.4s OR an inflated word span — a short word "lasting" longer than
   `0.55s + 0.07s × chars` means Whisper folded trailing noise into the word
   (observed: "that" spanning 1.7s). **Never transcribe the full file for
   this** — long-file Whisper silently drops stretches and fakes multi-second
   phantom gaps (observed 7s and 14s phantoms that did not exist in the audio).
2. **Find the pause edges by RELATIVE energy.** 20ms RMS profile from PCM; in
   the window [word.start → nextWord.start], speech ends at the last bin
   within 6dB of the window's OWN peak. Safety: skip the cut if anything
   inside it comes within 5dB of that peak.
3. **Then a room-tone pass.** Floor = 8th percentile of all 20ms bins; any
   run ≥ 0.45s within 4dB of the floor is a residual gap. (This one catches
   what pass 1 leaves; on its own it misses the loud breath pauses.)
4. **Compress to ~0.28s, never delete** — zero-gap joins sound robotic.
5. **Verify by chunked re-transcription ratio** (≥93% or fail the run).
   Full-file transcription is NOT a valid verifier (see the phantom gaps).

Tool: `node scripts/vo-remove-pauses.js in.mp3 out.mp3 [--script script.txt]
[--edits edits.json] [--keep 0.28]` — both passes + verification; `--edits`
dumps the cut list so frame timings can be remapped arithmetically instead of
re-transcribed.
