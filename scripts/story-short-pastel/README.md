# Story Room → pastel vertical short (reels)

Turns a Story Room story into a 1080x1920 vertical short in the Test Station's
**Pastel (house)** style (`house-pastel` in `server.js` MODELS.house), animated
with wan-2.2-i2v-fast and timed to Sophie's own recorded narration.

First produced: **Controlling My Own Destiny** (Aug 2026). The scripts are
parameterized by editing the constants at the top of each file (beat texts,
panel content prompts, project id) — lift them per story.

Pipeline (run in order, `NODE_PATH=<imageforge>/node_modules`, needs
`OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, `FIREBASE_SERVICE_ACCOUNT`):

1. **`render-panels.js`** — one vertical (1024x1536, medium) gpt-image-2 EDITS
   panel per beat, with the witch-school style refs + the house character
   (reddish topknot, pink star jacket, striped pants), whitened background
   (same flood-fill as server.js). Uploads to
   `story-shorts/<project>/panel-<beat>.webp` (deckfactory), writes
   `panels.json`.
2. **`cut-audio.js`** — whisper word timestamps over the story's `voiceover.url`
   recording → aligns each beat's text to its time range → cuts a TIGHTENED
   per-beat wav (internal pauses ≥0.45s collapsed to 0.35s). Sophie's recording
   had a 42s pause in it — 3:24 raw became ~1:20 of speech. Writes
   `timing.json` (per-beat durations = the clip durations).
3. **`animate.js`** — wan-2.2-i2v-fast (same pinned version as movies.js
   VIDEO_MODELS.draft), 720p, 121 frames (~7.5s), one motion prompt per beat
   (gentle motion, no camera moves), concurrency 4, per-item retry.
4. **`stitch.js`** — per beat: slow the clip (≤1.9x) toward the narration
   length, hold the last frame for any remainder, scale + pad on WHITE to
   1080x1920 (the style's white bg makes the pad seamless), mux the beat's
   narration, concat all beats, loudnorm.
5. **`file-everything.js`** — uploads clips + final to Firebase, files every
   panel to the My Creations gallery + chat Assets (with style/content prompt
   split), appends each panel to its Story Room beat as a `cand` card via
   `POST /api/story/art`, and publishes a Compare page (panels + per-beat
   clips + the finished short).

Cost for the 8-beat story: ~$0.50 panels + ~$1.30 clips ≈ **$1.80**.
