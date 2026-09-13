# Stitch — what is broken and what is missing

An audit of the Stitch module (`stitch.js`, `public/stitch.html`, shipped
2026-09-12) done 2026-09-13. **Nothing here is fixed** — this is the reading,
with every number MEASURED against her live Footage log (511 jobs, 484
pickables) or off the real page in headless Chromium, never reasoned about.

`node scripts/test-stitch.js` is **green — 57 passed** with all of the bugs
below live, so none of them is visible to it. Where a test would have caught
one, the reason it did not is named.

---

## BUGS

### 1. EVERY TRIMMED PART IS UNPICKABLE, AND EACH TAP ADDS ANOTHER COPY

The one that matters most, because trimmed parts are the case the module's
own header names ("the chamomile skipping clip is two parts she cut, and the
parts are what go in the film").

A part's pickable id is `<job id>:<trim key>`. The trim key is a **full
40-char sha1** (`trimPlan` in footage.js), so the id is 61–77 characters. Both
copies of `clipOf` — `stitch.js` and the page's mirror — store
`key: String(p.id).slice(0, 40)`, and both `addPick` and `pickIndex` then
compare that truncated key against the **untruncated** `p.id`. They can never
match.

Measured on the real page with a real Atlas job id and a real sha1 trim key:

    three taps on a trimmed part  → order rows: 3 | tile lit: false | badge "+"
    three taps on the whole clip  → order rows: 1 | tile lit: true

So the tile never lights up, never shows its number, the second tap does not
take it out, and the order silently fills with duplicates ("3 clips · 0:12" for
one part tapped three times).

**Live: all 34 trimmed parts on her log are over the 40-char key** (25 clips
have at least one baked part). Every whole clip is fine — job ids are 20, 32
or 36 chars, all inside the cap.

*Why the test misses it:* its fixture ids are `b` and `p1`, so the pickable id
is `b:p1` — four characters. A fixture with a real-shaped id fails at once.

### 2. A CLIP THE LOG HAS NO LENGTH FOR IS SILENTLY DROPPED ON SAVE

`footage.cardOf` answers `seconds: params.duration ?? null`, and `clipOf` turns
a null into `out: 0`. `CutModel.cleanPieces` — which `POST /:id/clips` and the
render both go through — **filters out any piece under `MIN_PIECE` (0.1s)**.

Measured on the real page:

    the page shows : 1 clip · 0:00, the row there with its title
    the server kept: 0 clips

The page never re-reads after a save, so the row sits there looking picked
until she reopens the stitch. With other clips in the order the shot just
goes missing from the film with nothing saying so.

**Live: 9 pickables have no usable length** (Nurse Edna, two cup clips, a
Sophie clip, a Wan job, others).

### 3. EVERY CLIP RENDERS ONE FRAME SHORT

`seconds` is the **requested** duration; a Seedance clip is `24·s + 1` frames,
i.e. a "4s" clip is 4.042s. `clipOf` sets `out` to the requested number and
`renderCut` cuts with `-to`, so ~0.042s comes off the tail of every clip.

Stitch is the only caller that sets `out` from the log rather than from a
probe — `filmcut.js set` probes, and the Film Editor page reads the real length
client-side before a piece joins the timeline.

### 4. A RENDER ORPHANED BY A DEPLOY LOCKS THE BUTTON FOR 20 MINUTES

`startJob` has the stale-takeover (20 min), but the page never reads
`job.startedAt`. Measured with a 40-minute-old `running` job:

    { stitchDisabled: true, status: 'stitching… piece 1 of 2' }

…forever, polling every 2s. The server would accept a new render; she cannot
reach the button. This is the Film Editor complaint verbatim ("the editor
showed the dead job as running for 20 minutes", 2026-09-05) — and there is no
sweep here either, so the doc stays `running` for good.

### 5. THE WAY BACK GOES IN A CIRCLE

`showShelf(true)` **pushes** a history entry, so leaving an open stitch grows
the stack instead of unwinding it. Measured:

    open → "?s=s1"
    chevron → shelf, ✓
    chevron again → __navBack answers false → pagehead does history.back()
                  → lands on ?s=s1 → the stitch opens again

Two more halves of the same thing: the pushed state carries no `__forgeDepth`,
so `entryDepth()` falls through to "deep" and the chevron always tries
`history.back()` first; and a real back fires popstate, which cancels
pagehead's 400ms bail to `__forgeLeave`. So she cannot leave the tool with the
chevron — it bounces her between the shelf and the last stitch.

### 6. A RENDER THAT FINISHES WHILE SHE IS ON THE SHELF TELLS HER NOTHING

`showShelf` clears `pollT`, the `visibilitychange` handler is gated on `S.id`
(empty on the shelf), and `loadShelf` only runs on entering the shelf. So
after tapping Stitch and stepping back, nothing ever updates: no toast, no
shelf row change, and `stitch_pending` is never cleared — which then
force-opens that stitch on the next load.

### 7. THE STITCH BUTTON DOES NOT WAIT FOR THE ORDER TO SAVE

`flushOrder()` is fired and not awaited before the render POST. `runRender`
re-reads the doc, so a reorder in the 500ms before the tap can be rendered
stale. Locally the save landed first every time — unordered rather than
demonstrably wrong, so: latent, one `await` away.

### 8. `POST /:id/hide` EXISTS AND NOTHING CALLS IT

The page never posts to it. There is **no way to put a stitch away** — and
"New stitch" writes a doc on the tap, so every stray tap leaves a permanent
empty row on the shelf.

---

## THINGS THAT SHOULD BE POSSIBLE AND ARE NOT

### A. She cannot tell two takes apart in the order

The row title is `titleOf(prompt, 7)` — the first seven words of the prompt.
Her takes of one scene share their prompt. Measured over the 484 live
pickables:

    484 pickables → 177 distinct row titles
    372 of 484 wear a title another pickable also wears
    the worst: 53 pickables read "sophie is the woman in [Image1]. her…"

So the doctor's-office use case the module was built for — nine takes of one
scene, in story order — produces nine rows of identical text, told apart only
by a 48px poster. Nothing carries the seed, the model, the seconds, the date
or a take number.

### B. She cannot play a clip before adding it

Tapping a tile adds it; the only play button is on a finished render. There is
no way to check which take a poster belongs to without stitching. Footage's
own tiles carry a ▶.

### C. Her ♥ and ✕ are carried and ignored

`pickables` puts `vote` on every clip and the picker never reads it. **Live:
174 pickables carry a vote — 71 ♥ and 103 ✕** — so a hundred clips she has
crossed out are offered exactly like everything else, and there is no ♥-only.

### D. No search

The only narrowing is the project/folder drop-down. Footage grew the house
search (glass + grammar + the funnel) on 2026-09-11; with 300 pickables in a
wall, finding a take is a scroll.

### E. The first clip silently decides the frame

`renderCut` normalizes onto the first video piece's canvas. **Live, every
project mixes shapes** — `ward` holds 16:9, 3:4, 9:16, 1:1 and `adaptive`.
So reordering changes what the film is letterboxed to, and nothing on screen
says so.

### F. A shot cannot be used twice

`addPick` refuses a duplicate id by design (bug 1 aside). A cutaway used twice
in one film has no way in — the key would need to be per-instance.

### G. No preview of the order before stitching

Assembly has a clip-by-clip browser preview. Here the only way to see the cut
is to bake it.

### H. No note on a stitch

The player is a bare `<video controls>` — no `/filmnote.js`, so she cannot
tap-pause and say "wrong order at 0:12" on the one thing that is actually the
deliverable. (Native `controls` also paints iOS's grey tint; Footage's player
is the same, so that is not a Stitch regression.)

### I. The page cannot heal its own staleness

No `__forgeBuild`, no `/build` route, no `buildCheck`. The app keeps a tool's
web view alive for the whole app process, so every fix to this page is
unreachable until a force-quit — the finding Footage acted on 2026-09-12, the
day before this shipped.

### J. The picker reads the whole log, every open, and loads every poster

`GET /clips` does `.collection(forge-video-jobs).get()` with **no limit**
(511 docs today, growing), `no-store`, filtered in JS. The page then builds
BOTH views for all 300 pickables — 600 nodes, 300 poster fetches, **no
`loading="lazy"`** and no paging. Footage pages its feed 40 at a time.

### K. Small things

* The shelf shows no project and cannot be filtered or searched.
* `POST /:id/clips` has no `base`/version guard — two tabs clobber silently
  (the Film Editor refuses a stale save).
* A stitch is never offered to the deliverables list and cannot be pinned.
* No "clear the order", no undo.
