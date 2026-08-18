# Filming a still page — `scripts/comic-zoom.py`

Sophie, 2026-08-18: *"if we made a movie, do you think you could film yourself
zooming in slowly on different parts of this so that we could focus on different
parts — I want my dad to do a voice."*

So: one drawing, a camera moving over it. No model call, no generation, no cost —
ffmpeg and PIL on our own box, about 100 seconds of CPU for a minute of film.

## How it works

A shot list is JSON. Each shot names a rect on the page to start on and a rect to
end on, and the camera moves between them:

```json
{"name": "Dave", "from": "dave", "to": "dave-eyes", "sec": 6.5}
```

Rects live in `boxes` so the shots read like shots. Each one is grown around its
own centre to the canvas's aspect, so you frame what matters and never do the
arithmetic. `"page"` means the whole thing. `zoom: 1.05` is shorthand for "the
same rect, pushed in a little".

- `python3 scripts/comic-zoom.py shots.json out.mp4` — render.
- `python3 scripts/comic-zoom.py shots.json --stills DIR` — every shot's first
  and last frame as jpgs. **Check framing this way before rendering**; it takes a
  second and a bad box is invisible in a JSON file.
- `--audio dad.m4a --fit-audio` — lay a voiceover under it and stretch every shot
  proportionally to fit the take.

## Two things not to undo

- **Every frame is a float-precision crop, not `zoompan`.** ffmpeg's zoompan
  rounds the zoom to whole pixels each frame, so a slow push visibly steps. Here
  PIL resizes from a subpixel box and the frames are piped in raw, so the move is
  smooth at any speed and pan + zoom can happen at once.
- **The zoom interpolates geometrically, the centre linearly.** That is what
  reads as one steady speed — halving the frame width takes as long coming from
  900px as from 450px. Linear width makes a push start fast and crawl to a stop.

The page is composited onto its own paper colour first (sampled from its border),
so a whole-page shot has air around it instead of a black matte, and shot
coordinates stay in the page's own pixels.

## Resolution — the one real limit

The camera can only push in as far as the scan allows. The daddy-flying page came
in at 1122x1378, so a single panel is ~466px wide and a face is ~230px; filling a
1080-wide frame with that face is a 4-5x upscale and it goes soft. **A bigger scan
is the whole difference** — at 3000px wide the same close-ups are crisp. If only a
Google Drawing copy of a page survives, `scripts/gdrawing-extract.py` gets the
full-size original out (`docs/modules/inbox-and-misc.md`).

## Timing it to a voice

The durations in a shot list are a reading pace, written so the film stands up
silent. When the real voice arrives:

- one take of the whole thing → `--fit-audio` stretches every shot by the same
  factor, which keeps the rhythm and lands the ending;
- per-caption takes, or a take that lingers → set `sec` per shot by hand, using
  the word timestamps from the precise-cutting alignment
  (`docs/nde-precise-cutting.md`) so a line lands on the panel it belongs to.
  That is the rule from `docs/movies/sophies-movie-pipeline.md`: align to the
  actual words and their timestamps, or it gets wonky.

## Built so far

- `daddy-flying.shots.json` + `assets/daddy-flying-page.jpg` — the four-panel
  page about her dad dreaming of flying, and Dave. 12 shots, 51s silent:
  whole page → daddy → the pointing finger to her face → the caption → the bunk
  room rising to the boy on the ceiling → the moon in the window → the second
  boy → Dave → back out to the whole page.
  v1 (silent):
  https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/films/daddy-flying/daddy-flying-v1-silent.mp4
