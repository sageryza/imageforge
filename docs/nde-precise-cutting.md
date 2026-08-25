# Precise voice cutting — how a transcript snippet becomes a clean audio cut

> Working on Sophie's audio? Load the **`sophie-audio` skill** first — it is
> the short version of this file plus the verification gate
> (`node scripts/vo-verify.js`).

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
   the cut. (`phraseSpan` / `_phrase_span`.) **The span's edges then snap to
   the words that actually MATCHED (Aug 2026, editor.js only):** a phrase word
   the audio never says ("uh", caption garble) makes a window shifted one word
   early score the SAME ratio as the true one, and the tie broke toward the
   earlier start — the cut opened on a stray word from the previous sentence,
   heard as the previous clip's last word played twice (Sophie's doubled
   "coincidence" in the Sheldrake episode, 2026-08-07; three of that episode's
   six clips carried a stray lead). Unmatched window words on either edge are
   trimmed via the matched blocks. Regression: `node
   scripts/test-editor-cutter.js` (the real failing texts).
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
  — content-addressed by `CUT_VERSION|videoId|normalized words|rounded anchor`
  (v2 since 2026-08-07 — the phraseSpan edge snap above; every v1 cut re-cuts
  itself on next use).
  `editor.js` checks this before cutting anything, so a clip is only ever cut
  once; bump `CUT_VERSION` when the cutting logic changes so old cuts expire.
  Narration lives beside it in `narr-cache/` (keyed by voice+model+tempo+
  prefix+text).
- Montage cut lists: `scripts/nde-montages/<slug>.json` — the exact candidate
  lists the delivered montages were cut from; `scripts/seed-editor-montages.js`
  turns them into editor episodes (`--render` warms the clip cache).

## Rules that must survive any refactor
- Never cut on raw Whisper timestamps without alignment or snapping.
- **BULK-PASS TIMINGS LOCATE, A RE-LISTEN CUTS (2026-08-25, shipped wrong on
  the water reel — Sophie heard the clipped word edges herself).** A master's
  chunked whisper words are chips-only accuracy: right enough to FIND a
  phrase, tens of ms off at the word edges — whisper's word ends run
  habitually EARLY and its starts can run late, and on back-to-back takes
  `clampBounds` pads as little as 0.02s/0.03s, so cutting where the bulk pass
  says the word is clips it. The Cutting Room has always known this
  (`cutSection` extracts a padded window, re-transcribes THAT, and cuts on
  the fresh timings); `vo-film.js` did not, and delivered a reel with word
  onsets and tails shaved. Its fix is `"relisten": true` on the spec —
  `relistenSpan`: fresh whisper on a small window (with 1s of prepended
  silence, the short-clip-drops-opening-words rule), relocate, snap to the
  window's real silences, then a VOICING GUARD that walks each cut edge
  outward while the 20ms RMS is still hot, bounded by the neighbouring word
  so another take cannot bleed in. Any new cutter must re-listen before it
  cuts; locating and cutting on one bulk pass is the trap.
- End snapping is forward-only and capped at the next word — both halves of
  that sentence matter.
- `snippet.timeSec` (the anchor) selects the alignment window — keep it
  accurate when creating snippets programmatically.
- Narration cards fail loudly without `ELEVENLABS_API_KEY` — never silently
  skipped.
- Verify batches with `nde-verify-cuts.py` before delivering.
- **THE WHISPERED-WORD RULE: a missed-word test is FLOOR-referenced, never
  speech-referenced (2026-08-25, the water reel's "secret").** She whispers a
  word at ~-38dB against speech at -13; any speech-relative threshold calls
  that a pause and a gap-bridge deletes the word. A whispered word holds
  ~0.3s continuously above floor+10dB while a real pause holds ~0s there —
  the same separation as the laugh test. `vo-film.js`'s gap guard implements
  it (gaps ≤1.6s only, so a fan surge can't protect a long hole).
- **A "CLIPPED WORD" REPORT HAS THREE ROOT CAUSES — measure which before
  cutting differently (2026-08-25, all three live in one film):** (1) the cut
  really clips (bulk-timing cut, no re-listen — the rule above); (2) the cut
  is byte-perfect and the TAKE ITSELF slurs the word — compare the shot's RMS
  bin-for-bin against the source before touching the cutter, then swap takes
  (the water reel's "Scientists"; the evan master's "scientist"/"percent"
  were the same shape: truncated INSIDE the source, fixed only by re-sourcing
  from the original recording); (3) a word whisper never heard was bridged
  away (the rule above). The evan chat's earned rules live in
  `scripts/evan-v14-rebuild/README.md` — including *use word times to
  LOCATE, a 20ms RMS profile to TRIM*, independently re-earned here as the
  re-listen + quiet-landing rule. That double payment is why this list is in
  the doc of record now.
- **THE VERIFY GATE PASSING IS NOT A WORD-LEVEL CLAIM.** The gate fails only
  on ≥4-word contiguous runs, so single clipped or eaten words sail through
  — two shipped that way. `vo-film.js`'s verify now prints a WORD SWEEP:
  every script word it could not hear back, per shot, with context. Most are
  whisper mishears; judge each against the source words and RMS before
  delivering. Her examples are examples, never the list — sweep everything.

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

### Thump-and-drift pauses (Aug 2026, round 2)
One pause survived all of the above and Sophie heard it instantly: she set her
phone down mid-pause. The thump registers at FULL speech level for ~0.3s, so
the "nothing loud inside the cut" safety veto refused the cut — and Whisper
inflated the NEXT word's start backwards across the quiet, so the gap never
showed as a gap. Three fixes, all in `vo-remove-pauses.js`:
- **Transients never veto.** Loud runs ≤0.15s inside a candidate pause are
  bumps, not words — cut straight through them (removing the thump too). Only
  SUSTAINED (≥0.2s) speech-level audio cancels a cut.
- **The cut's end comes from energy, not the next word's timestamp**: first
  point after the pause with ≥0.16s sustained audio above (speech-ref − 7dB).
- **Merge overlapping windows before applying** — two adjacent inflated words
  flag the same pause; unmerged overlaps double-count removal and corrupt the
  arithmetic frame-timing remap.
Ablation while we're at it: on the same track, the word-timing breath pass
found 21 pauses (27.8s) vs room tone's 13 runs (7.1s), with only 3 overlapping
— the breath pass is the workhorse, room tone is the sweeper. Both stay.

### Assembling a narration FILM from a voice memo (Aug 2026, the Evan film)

**Use `node scripts/vo-film.js spec.json --dir work/ --final` — do not
hand-roll this pipeline again.** It encodes everything below plus the Mason
film's later findings (word-timing pause removal for noisy rooms, film-level
quiet thresholds, blip tolerance, long-edge-only trims, exact per-shot video
segments), renders TTS bridges on her clone, and caches per-shot verdicts by
content hash — so a one-beat change re-cuts and re-verifies one beat instead
of re-transcribing the whole film, which is where both film chats' time went.
The spec format is documented in the script's header. What follows is the
WHY, kept because the next new failure will need the reasoning, not just the
tool.

Cutting selected takes out of a long read-through and hanging pictures on them
hits five failures that pause removal alone does not. All five shipped wrong at
least once; the verifier below is what caught them.

1. **Run the detector on the ORIGINAL continuous recording, never on audio you
   already spliced.** A track assembled from padded cuts has no true room tone
   left, so `roomToneCuts`' 8th-percentile floor lands inside quiet speech and
   it deletes whole sentences (measured: verification 90.7%, sixteen contiguous
   runs gone including "I asked God to send me a sign"). On the real master the
   same code verified 94.8%.
2. **Do NOT remap take times arithmetically through `--edits`.** It looks
   equivalent and is not: cuts that straddle a take's boundary collapse it.
   Measured, this lost speech on 9 of 35 takes. Instead re-locate every take in
   the CLEANED master with `editor.js`'s `phraseSpan` + `clampBounds` +
   `snapToSilence` — the one cutter, against fresh chunked word timestamps.
3. **Word gaps do not find holes — energy does.** Whisper folds trailing noise
   into a word, so a span that looks continuous by word timing can carry a
   multi-second hole (one carried **16 seconds** of untranscribed audio). After
   locating a take, measure its own energy and compress any dead run to ~0.28s.
4. **Spans disjoint in WORD INDEX can still overlap in TIME.** `clampBounds`
   pads +0.30s and `snapToSilence` may run to the next word's onset, so a sliver
   of the next word plays at the end of one cut and again at the start of the
   next — Sophie heard "…the proof behind | behind the end of the tunnel". Clamp
   each span's start to the previous span's end in PLAY order (17 joins needed
   it on one film).
5. **Word-anchored cutting drops non-word vocalisations at the edges.** Whisper
   transcribes no word for a laugh, so "He said, HAHA, what…" cut as "what…"
   (Sophie: "I said ha but I was supposed to say ha ha"). Extend each edge
   outward across contiguous audio above **floor + 8dB** before cutting. For the
   same reason a run only counts as DEAD if its PEAK is near the floor — a laugh
   sits below speech−20dB but well above room tone, and compressing it eats a
   syllable.

### Verifying a cut: `node scripts/vo-verify.js cut.mp4 [--script script.txt]`
**"The code removed the pauses" is not verification.** Two checks, both required:
- **Dead air, measured RELATIVE TO SPEECH** (`speech85 − 20dB`), with a blip
  tolerance so a noise tick inside a gap doesn't split the run. A
  floor-relative test (`floor + 4`) is right *inside* the detector but wrong as
  a verifier: her floor wobbles several dB, so a genuinely dead **6.8s** stretch
  broke into sub-second pieces and reported "0 runs". `silencedetect` is worse.
- **Speech loss by LCS diff** against the expected script, reporting CONTIGUOUS
  missing runs. A bag-of-words ratio cannot tell a deleted sentence from
  scattered ASR noise and will pass a cut that ate a whole line.
- The chunker **retries**: one DNS blip put the literal words "dns resolution
  failed" into a transcript and faked a 31.5% loss. Always check `res.ok` and
  reject an error body arriving as text.
Numbers from the Evan film, before → after: dead-air runs ≥1s **18 (29.8s) → 0**,
word match **99.2%**, zero contiguous missing runs.
