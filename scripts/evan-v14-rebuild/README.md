# evan-v14 rebuild — from her live Cutting Blocks marks to a verified mp4

How evan-v14.mp4 was assembled (2026-08-18), so the next render is a re-run,
not a re-derivation. No model spend except whisper verification (~5¢); the
cutting and stitching are free.

The pipeline:

1. **Inputs** (place beside these scripts):
   - `blocks-v14.html` — the Cutting Blocks page,
     `GET /api/chatfeed/page/ePKqeMJOATGCz7MJa9lA`
   - `marks-148.json` — her live marks,
     `GET /api/chatfeed/verdict?chat=cutting-blocks-artifact&sheet=blocks-s96`
   - `model.json` — `{MODEL, SECS, TOTAL}` eval'd out of the page's data line.
2. **`extract-units.js`** — runs the REAL page in headless Chromium
   (`/opt/pw-browsers/chromium`) with the marks injected, reads the card order
   and states out of the DOM (per-paragraph order, the part branch-name logic
   gets wrong when reimplemented by hand), and computes the page-cut `parts`
   with the page's own span math (`segSpansOf`, seam bridging included).
   Writes `units.json`.
3. **POST the parts to `/api/editor/page-cut`** with
   `film = story/films/evan-v7-lite.mp3` — the server's content-addressed
   cutter renders the audio once and answers a Storage url. The cut is plain
   `atrim` per span + 12ms fades, so **every part's output duration is exactly
   `t1 − t0`**, and TTS parts are their file's decoded length — the whole
   image timeline follows arithmetically (`timeline.json`), no alignment pass.
4. **`build-film.js`** — the shot map (`PLAN`: unit index → image) over the
   Assets-tab art, per-shot h264 segments at exact cumulative frame
   boundaries (never the ffconcat stills demuxer), one concat, one mux with
   the decoded wav. Fails hard if video < audio (the v13 defect).
5. **Verify before delivering** — `node scripts/vo-verify.js evan-v14.mp4
   --script script.txt --keep 2.5-4.0,87.4-89.0,244.5-246.2`. The first keep
   is the phone-ring pause she asked for by name; the other two are ~1s
   sentence beats inside spans she kept (they are in the source her marks
   point at, not assembly artifacts).

Corrections against the bulk-pass block times (the two-tier rule: the stored
words are chips-only accuracy):

- **b16 ends 86.17, not 86.08** — "…He's a scientist." clips at 86.08;
  measured by padded word-timestamp transcription of the 82–90s window of
  `evan-v7-lite.mp3`. Applied in `units.json` before POSTing. Any future
  render from these marks needs the same widening (or a re-listen pass).

The audio of record for v14:
`nde-episodes/editor/page-cuts/dcfcc1b923d09f7d1e826025af33b29a1aca6420.mp3`
(4:09.6, deckfactory). The film:
`story/films/evan-v14.mp4` (membry).
