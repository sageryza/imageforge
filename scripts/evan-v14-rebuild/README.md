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

## v15 (2026-08-18, same day) — the quirks Sophie heard, found and fixed

Sophie reported "weird extra sounds, little uh sounds" near the beginning of
v14. Measured (whisper read-back of the film + windowed re-listens of the
master), they were three classes of defect, all inherited from cutting at the
bulk-pass block times:

1. **Time-overlapping adjacent spans replay a fragment.** b05's block ends at
   29.84 while b06 starts at 29.4 — the film played 0.44s twice ("I sai–said").
   The known trap from `docs/nde-precise-cutting.md`, present in the page's own
   preview cutter because cards cut as separate parts.
2. **Trailing false starts inside kept spans.** b08 ends with an untranscribed
   "I—" grunt plus ~1.3s of air before the next splice; her b12 split kept a
   dangling "I" after "face."; b41 ends with "It—". Sound exactly like stray
   "uh"s.
3. **Clipped words at splice edges.** Bulk block times drift up to ~1.6s on
   this master: "in science journals?", "There's a rat.", "Okay, I said" were
   all partly or wholly cut in v14 (3-word losses sit under vo-verify's
   4-word radar — match% was the only trace).

The fix, in `fix-audio.js` (run before `build-v15.js`):

- **Merge** consecutive same-source parts that overlap or sit within 0.35s —
  continuous audio plays once, natural beats survive, no mid-speech fade dip.
- **Re-listen at every splice edge** (windowed word-timestamp transcription,
  cached in `seam-cache.json`) and set the edge to the real word time ±0.12s.
  **Match the occurrence CLOSEST to the expected time** — first/last matching
  both chose a wrong repeat of a phrase ("He said" pulled a CUT block into the
  film; "the face" left cut words in). That bug shipped in the first v15 build
  and was caught by the read-back gate before delivery.
- **Three trailing fragments dropped**, named to Sophie: b08's "I—", the
  dangling "I" of her b12 split, b41's "It—".

Her notes survey (Assets threads across the four Evan chats) also re-picked
five shots: the patio phone-rings (her "go with it" note), her own Playground
Sheldrake image ("this is a better one for the Sheldrake image"), the
same-size both-on-the-call redraw, the Parent-Trap-wrappers crackly call, the
couch-and-glass-door Spanish-house rat, and the casual-bystanders sidewalk rat
for her dad's story. The dream crowd keeps the medium crowd image — in the
dream "they were ALL watching".

v15 of record: audio
`nde-episodes/editor/page-cuts/a86a026565da41b43792229a8ba17e35e62e3686.mp3`
(after closest-match fix the key changed — see `audio-v15-url.txt` in the work
dir for the live one), film `story/films/evan-v15.mp4` (4:20.5, 52 shots,
vo-verify PASS, keeps at 2.5-4.0, 89.4-90.8, 255.3-256.8).
