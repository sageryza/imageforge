# The Meteorite → pastel 2:3 portrait short

Story Room project `songs-aug-2` ("The meteorite") → a 1080x1620 **portrait
2:3** short in the Test Station **Pastel (house)** style, narrated by Sophie's
own Story Room recording, precision-cut to chosen words.

Differences from `story-short-pastel/` (Controlling My Own Destiny):
- **2:3 portrait end to end** — panels are 1024x1536 (exactly 2:3) and the
  final video is 1080x1620 with NO white padding (the 9:16 reel pad is gone).
- **The narration is a SUPERCUT, not a tightened whole take.** The recording
  is a 17-minute ramble with restarts and tangents; `beats.js` lists the exact
  verbatim spans kept per beat, and `02-cut-beats.js` cuts ONLY those words
  using the NDE precise-cutting pipeline (docs/nde-precise-cutting.md):
  full-file whisper words pick the right occurrence of each span → an ~100s
  window around each anchor is re-whispered fresh (short windows barely
  drift) → `phraseSpan` contiguous best-match → `clampBounds` gap-aware pad →
  `snapToSilence` (end forward-only, capped at the next word) → micro-fades →
  per-beat concat with 0.3s breaths → **verification**: every beat wav is
  re-whispered and compared to the words it should contain (fails the run
  otherwise).

Pipeline (run in order from the imageforge root; needs `OPENAI_API_KEY`,
`REPLICATE_API_TOKEN`, `FIREBASE_SERVICE_ACCOUNT`):
1. `01-whisper-full.js` — download the voiceover, whisper-1 word timestamps.
2. `02-cut-beats.js` — the precise cutter + verification (above).
3. `03-render-panels.js` — pastel panels (house character + a consistent
   ex-boyfriend design), whitened bg, uploaded to `story-shorts/songs-aug-2/`.
4. `04-animate.js` — wan-2.2-i2v-fast, 720p, ~7.5s per panel.
5. `05-stitch.js` — slow ≤1.9x toward narration length, hold last frame,
   1080x1620, concat + loudnorm.
6. `06-file-everything.js` — clips + final to Firebase, gallery + prompt
   splits, the 12 Story Room beats + cand cards, Compare page. Idempotent.

Cost for the 12-beat story: ~$0.7 panels + ~$1.9 clips + ~$0.3 whisper ≈ $2.9.
