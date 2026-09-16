# The rough cut (2026-09-08)

Film Editor cut doc `DsekWrOE5sQciRXKwtpr` — "Hospital night — rough cut". Built by
`scripts/hospital-rough-cut.js` (see its header): the pre-ward cut `ClYuZyz0HdflLGzaCJNI`
copied in whole (both lanes, same keys), then the ward in script order — every made
clip, and a 1s cream card for every scene not shot yet (`cards.json` = card → Dump url).
Editor: https://imageforge-q125.onrender.com/filmeditor?c=DsekWrOE5sQciRXKwtpr

When a new clip lands, replace its card in `WARD` with the clip url, rerun `cut`,
`filmcut.js set`, render, pin. Never renumber a key.

## LumaFusion (2026-09-08)
Sophie cuts on her phone in LumaFusion. The scene-36 clips went to her as one
zip (`hospital-night/lumafusion/hospital-scene36-clips.zip` in Storage, files
numbered in order); `lumafusion-media.json` maps those FILENAMES back to their
Storage urls. Two ways her cut comes back:
- **Movie export** — a flattened mp4; upload to the Dump and slot it into the
  rough cut as one piece (v3 did this: `sophie-scene36-lumafusion-v1.mp4`).
- **XML Project Package (FCPXML, a paid LumaFusion add-on)** — the cut LIST.
  `node scripts/fcpxml-to-cut.js <export> --media lumafusion-media.json --out
  cut.json [--set <cutId>]` rebuilds it as a Film Editor cut from the ORIGINAL
  clips (in/out points, connected audio with volume and fades, stills), so
  both of us edit one cut. Test: `node scripts/test-fcpxml-to-cut.js`. Not yet
  driven against a real LumaFusion export — the first one she sends is the
  measurement.
  **THE EASIEST WAY IN IS THE SHARE SHEET (2026-09-16, Sophie: "easiest,
  period?"):** on LumaFusion's export sheet, XML Project Package → media
  **No Relinkable Media** (every clip is already in our Storage — we sent
  them to her — so the zip is kilobytes, not a re-upload of the footage) →
  Share → Deck Factory. It lands in the Dump as a `file` (needs the TestFlight
  build carrying the DumpShare zip rule), and the chat reads it with
  `node scripts/fcpxml-to-cut.js --dump latest --media lumafusion-media.json
  --out cut.json [--set <cutId>]`. Until that build is on her phone: Save to
  Files → Google Drive, and the chat reads it through the Drive connector.
  **THE FIRST REAL EXPORT (2026-09-16, XML only, sent in chat): the reader
  parsed it whole** — nine pieces on the spine, in/out points right — **and
  every filename was `clip-<random>.mp4`**, because the app's Save-to-Photos
  (`VideoSaver`) named clips that way, so nothing joined by name. Two
  answers: (1) the reader now builds its media map from the FOOTAGE LOG by
  itself (every job's video, source and trims, keyed by Storage filename) and
  matches a nameless clip by LENGTH + SHAPE, narrowing to the project the
  sure matches sit in — 3 of 9 pieces resolved (the three trims, whose odd
  lengths are unique), the 15s and 4s Mini clips stayed ambiguous (75 and 30
  candidates) and were SKIPPED with the candidates named, never guessed;
  (2) `VideoSaver` now saves a clip under its STORAGE NAME (the trim key, the
  Atlas job file), so from that build on the FCPXML names the exact object
  and the join is by filename. A cut made from clips saved before the build
  still needs her to name the ambiguous ones.
