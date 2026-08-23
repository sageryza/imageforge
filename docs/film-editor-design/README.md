# Minimal Film Editing App — Sophie's Claude Design canvas

Her tap-only phone film editor, exported from Claude Design (Aug 2026) and
banked here so the design survives outside that canvas. **Nothing in this
folder ships** — it is a design source, the way `docs/dream-feed-designs/` and
`docs/decision-deck/` are.

## What's in it

- **`Editor Options.dc.html`** — the exploration board: three timeline
  directions (1a filmstrip, 1b clip list, 1c focus mode), static mockups, no
  logic. This is the artboard the direction was picked from.
- **`Tap Editor Prototype.dc.html`** — 1a built for real. React logic in a
  `DCLogic` class: file upload, multi-clip playback, split, trim in/out,
  reorder, delete, one audio track with an offset.
- **`ios-frame.jsx`** — the iOS 26 device frame the artboards mount into
  (Claude Design's stock starter component, not hers).
- **`dc-rt-2.js` / `runtime.js` / `support.js`** — the Claude Design canvas
  runtime. **All three are byte-identical** (md5
  `951ae391b8ae72ef12e671c2fad23353`); the two artboards just reference it by
  different names, so all three are kept or one of them stops opening.
- **`screenshots/proto-check.jpg`** — the design chat's own check shot.

The runtime pulls React, ReactDOM and Lucide from unpkg at load, so opening an
artboard needs network.

## What it actually does (measured 2026-08-22)

Driven in headless Chromium with the unpkg files served locally. It runs: demo
clips play, the playhead advances, it crosses from clip 1 to clip 2 on its own,
the timecode tracks.

## What is missing — why it reads as unfinished

- **No export.** Nothing produces a video file. The whole thing is a `<video>`
  element hopping between blob URLs. No render, no download, no server.
- **No saving.** Clips are in-memory `URL.createObjectURL` blobs; reload and
  the cut is gone.
- **No undo,** on tools that all destroy something.
- **The timeline tiles are a fake filmstrip** — a repeating gradient, never
  real frames. The most visible missing piece on screen.
- Audio can be added and offset but is never mixed and never exported; one
  track only.
- "Untitled Cut" is static text; the film icon top-left is a dead control.

## Bugs found by driving it

- **Selection doesn't follow the playhead.** Step past the end of the selected
  clip and split/trim silently refuse — no message. 12 split attempts in a row
  produced one cut.
- Tapping a clip snaps the playhead to that clip's start, losing your place.
- Dimmed tools (`toolOp` 0.35 with nothing selected) are still tappable and
  silently do nothing — no `pointer-events:none`.
- Swapping `video.src` at every cut will flash black on device; a real cut
  needs two video elements swapped.
- "−1 frame" is `1/fps` seconds on `currentTime`, which browsers round — not
  frame-accurate.
- The timeline row has no wrap and no `overflow-x`; at `min-width:34px` + 4px
  gaps it runs off the right edge of a 390pt phone at roughly nine clips.
- `URL.revokeObjectURL` is never called on delete — a leak with real footage.
- A video the browser can't decode fails silently (`v.onerror` just revokes).

## How it relates to what ImageForge already has

Measured against main at `162649a`:

- **Cutting a span out of a video already exists** — `clips.js`
  `POST /chunk {url,start,end}` trims with `trim`/`atrim`, bakes it, and files
  it on the Chunking shelf, content-addressed by url+span so the same cut is
  never paid for twice. Capped at `MAX_CHUNK_SECONDS` = 600s. What it has no
  UI for is *picking* start and end — today a chat passes numbers it worked out
  by hand.
- **Arranging and baking exists twice** — `/assembly` (tray, Dump import,
  upload, tap-to-place) and the Story Room pad, which since #1537 can hold a
  film clip as a beat.
- **Neither can trim.** `assembly.js`'s `cleanClips` has no in/out and its
  render passes each item through whole; the pad's `clipSegment` has no `-ss`
  or `-to` either.

So the capability this prototype supplies — a tap interface for choosing a
start and an end — is the one nothing else has, and the back end for it is
already built. Wiring split/trim to `POST /chunk` needs no render change in
either arranging tool, because both pull their clips off that same shelf.

Decided and built (Aug 2026, Sophie: "build it with the prototype I got from
Claude design"): the prototype became the **Film Editor** — `filmeditor.js` +
`public/filmeditor.html`, live at `/filmeditor`, iOS tile under the FILM
filter. Every gap and bug listed above was fixed in the build (saving, render,
selection following the playhead, inert dimmed tools, the scrolling timeline,
real posters, the two-element video swap, loud refusals). This folder stays
the design source: when Sophie reworks the canvas in Claude Design, re-bank it
here and fold the look into the live page.
