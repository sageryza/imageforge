# Wan 3.0 test v1 — what came back (2026-09-11)

The first Wan 3.0 job on the ward cast: `climax3b-wan-v1.json` is the job as
sent, `climax3b-wan-v1.prompt.txt` the exact prompt. Sent from a container
through `scripts/atlascloud-send.js` on her go, so the job was on the
`forge-video-jobs` log the moment it left (`provider:'atlascloud'`, scene
`md-31b`, chat `continuity-characters-research-01mtjq`).

## The numbers

- Atlas job `27fcbe6e73354f0599715eb38dee352f` · `alibaba/wan-3.0/reference-to-video`
- 15s · 480p · 16:9 · sound on · seed `1129231601` (minted by the door; the
  dry run's seed was `601815225`, a fresh mint each build)
- **Drew in 4m16s** (`latency_ms: 256396`, created 08:09:00 → completed
  08:13:16 UTC), polled every 10s from the container.
- **60¢** — Atlas's own `price: "0.6"` on the job record, not an estimate.
  (`~60¢` was the quote; Atlas has no billing API, so the console is still the
  only read that would pin it past the job's own field.)
- The clip: `854x480`, h264 30fps + aac, **15.02s**, 7.6MB. Mirrored by the
  poll to
  `https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/atlascloud-video/1789114400090-3md3gg.mp4`
  and pinned in the chat as *Wan 3.0 test v1 — Climax 3, the grin, the ghost,
  You can go now (0:15)*.
- `has_nsfw_contents: null`, `error: ""` — nothing was refused on either gate.
  Four person references (two stills, two clips with faces) went through
  Atlas's door on the POST without a word.

## What it drew, second by second (frames pulled at 0-13s)

- **0–4s** — the office from Image 2: the doctor at his desk in the white
  coat, Sophie in the blue pajamas seated on the right, one static wide shot
  while he talks. The pajamas are the still's: a blue button-front top and
  trousers, the same shape on her in every shot after.
- **5–7s** — the close-up: her eyes wide, then the face going blank. This is
  the beat the prompt describes and it landed as written.
- **9s** — the ghost: Sophie against the stucco ceiling tiles, seen from
  below, floating in the corner of the room. Landed.
- **11–13s** — she stands, turns, walks out through the office door in the
  pajamas, the doctor in the foreground watching. Landed.

So on one job Wan 3.0 followed a four-beat 15-second scene in order — a
close-up, a point-of-view change, an exit — from one prose block, with the
cast and the wardrobe carried from the references. That is what the Mini
draft's continuity work has been costing a clip at a time.

## What it got wrong — and it is the line, not the picture

**The "does NOT appear" line did not hold.** The prompt's fourth line reads
*"the red haired assistant in Video 2 and Image 2 does NOT appear in this
video."* — and the red-haired assistant stands in the office doorway, purple
sweater, clipboard in hand, for the whole first shot (frames 0, 1, 2, 3, 4s),
then is gone once the close-up begins. Video 2 and Image 2 both hold her (the
doctor's office clip and the office still), and the model drew what the
references hold rather than what a negation asked.

**The rule this measures: a person is kept out of a Wan clip by not sending
her, never by a line.** Her recast note ("we're gonna recast her maybe so best
to leave her out") needs one of: the doctor's SOLO still as Image 2 (the
blurred `86064a…` portrait on the shelf, or a crop of the office frame with
the doorway out of it), or the office clip trimmed/cropped so she is not in
frame. The office clip is the doctor's only moving reference, so the honest
next test is the office still cropped to the desk plus the doctor's still —
free to prepare, one more 60¢ job to measure.

The sentence itself is mine, not hers (her ask was "just add a line like:
'the red haired assistant does NOT appear in the video or something'"), and
it is named as mine in the job's `mine` block.

## Still unmeasured

- Whether the FACE is hers: the clip draws the woman from Video 1 (the jazz
  clip) — the likeness reads close in the close-up, but nobody but Sophie can
  say. Her verdict on the pin is the measurement.
- 30s: Wan 3.0 takes up to 30 seconds and a script FILE; this job was 15s of
  prose. A 30s pass is ~$1.20 at the same rate.
- 720p: 5¢/s list on Atlas (about 10¢/s if the 480p→720p pixel ratio holds
  the way it does on Seedance), unmeasured here.
