# The trailer (2026-09-10)

Film Editor cut doc `jPKZif7Q3gI1b8YoPeLK` — "Hospital night — trailer", cut out of the
rough cut `DsekWrOE5sQciRXKwtpr` (render film-7, 12.5 min) as its own doc, so Sophie and a
chat edit it in unison (the `film-cut` skill). 24 pieces, 8 sounds, 1:29. Nothing was drawn;
every piece is an in/out into a clip the rough cut already holds.
Editor: https://imageforge-q125.onrender.com/filmeditor?c=jPKZif7Q3gI1b8YoPeLK

- `build-trailer.py` builds `trailer-cut.json` from the rough cut's live doc (`rough.json`,
  `GET /api/filmeditor/DsekWrOE5sQciRXKwtpr`) — the keys `t01…t26` are permanent (t06 the
  ambulance and t13 the meds were cut before the first render; the gaps in the numbering
  are deliberate, never renumber). Change the cut by editing the doc or the builder, then
  `node scripts/filmcut.js set jPKZif7Q3gI1b8YoPeLK trailer-cut.json`, `render`, `pin`.
- The spine: her VO over the street and the spinning (jazz under, out by 0:17) → the woman,
  the doctor, the tranquilizer, the black → waking up ("this is a mental hospital") → the
  ward in hard cuts on the clips' own sound (Anastasia · Michael, Annie, the metaphor
  machine, the sculptures, "cut my hand off?", when can I leave / tomorrow / the next day /
  the day after that, Ms. O'Hara's ghosts, be a good girl) → the parents' hug and "you can
  go now", the jazz back under the last two.
- In/out points were picked off a Whisper transcript of the rough-cut render
  (`film7-transcript.txt`, ~7¢) and checked against a transcript of the trailer render; the
  line ends that landed clipped in render 1 ("cut my hand—", "when can I—", "I'm—") were
  widened for render 2, two audio tails trimmed for render 3.
- Not in the doc's vocabulary, so not in the trailer: title cards, text, fades between
  shots. Say so before rendering one privately.
- Known: the dining-room piece (t11) is the braid Sophie (a redo candidate on the belt); she
  is off screen for the "I'm Sophie / Anastasia / Michael" beat, so it reads fine until the
  redo lands. The "you can go now" closer wears its cream card's ghost effect as shot.
