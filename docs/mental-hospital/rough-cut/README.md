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
