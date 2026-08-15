# The audio pipeline — the ten stops, and what is missing

The audio tools were built one at a time, each solving the problem in front of
it, so nobody ever wrote down the path a piece of audio actually walks. This is
that path, plus a measured diff of the five surfaces that cut audio.

**The map** is `docs/audio-pipeline-map.html`, posted into the Chats app as a
Compare page (`audio-pipeline-tool` chat, sheet `audio-pipeline-s10`  — the sheet name
carries the shape of the item set, so a rebuild can't silently re-point her
saved notes). It is the
audio sibling of the content pipeline's S-curve map
(`s-curve-content-pipeline`, v8) — the same road, the same cut-out drawings,
exploded out of that map's three audio stops (CUTTING BLOCKS / SLICE IN /
POLISH) into the eight the audio really walks, plus two tributaries. **Keep the two looking like one
family: if the road changes there, change it here.** The map reuses that
pipeline's already-paid-for icon cut-outs
(`vector/pipeline-icons-cut/`, `vector/pipeline-icons-2-cut/`) rather than
re-rendering a sheet.

**Editing the map's geometry?** The stops sit at CHOSEN fractions of the path,
not evenly spread. The four road extremes land on exactly 0.2 / 0.4 / 0.6 / 0.8
(a quarter plus n halves over 2.5 full ellipse perimeters), and at an extreme
the road is vertical with a clear gutter beside it. **BLOCKS is pinned to 0.40**
because it is the only stop anything flows into — spread evenly it landed on the
pinch between two bowls, where the road returns within ~50px on both sides and
no tributary can reach it without crossing. `CX` is 270 on a 440-wide board (not
v8's 232/400) to widen the left gutter to 130px for that lane. Measured: the
feeders clear the road by 97px and the tightest pair of stops is 103px apart
against a 44px node.

## The path is not a strict line

Two rooms are not stages the audio passes **through** — they are places a block
comes **from** (Sophie, v3: "certain things lead into each other"). **Search**
and **Voice Studio** therefore join the road at BLOCKS as tributaries, and the
walk continues from there:

    capture → script → BLOCKS ← search, voice → arrange → word cut
            → exact cut → polish → the cut

**WORD CUT and EXACT CUT are both real stops, in that order** (Sophie, v3).
The word cut is what the machine can find in a transcript; the exact cut is the
by-ear pass after it, for what the machine could not hear.

## The eight stops on the road

1. **CAPTURE** — voice memos, the drop, the share sheet. One library; every
   path files into it (`memos.fileIntoArchive()`).
2. **SCRIPT** — the memo plus her instructions become the words. **No tool** —
   a chat writes this in conversation today. What it would be: pick a recording
   out of the library (or drop one), say what you want made of it, and get back
   a script already segmented into sentences, ready to become blocks. The
   segmentation is the half that matters — it is what BLOCKS consumes.
3. **BLOCKS** — the words cut into sentence-level blocks. This IS Cutting
   blocks; "not built" means there is no TOOL, not that nothing exists — the
   artifact is at v14 and works. What is missing is the module, the page, the
   doc and the tile behind it.
4. **ARRANGE** — move them, meld two into one, split one in two, drop some,
   add some. Lives inside the same artifact.
5. **WORD CUT** — the exact words out of a long transcript (`editor.js`).
6. **EXACT CUT** — the by-ear pass after it: tap the spot on the playhead,
   nudge by a tenth (`cutmarks.js`).
7. **POLISH** — pauses out and filler out (`cuttingroom.js`), and their LENGTH
   set (or a new one added) in the **Pausing tool** artifact. The last pass.
8. **THE CUT** — the finished audio.

Flowing **into** BLOCKS:

- **SEARCH** (`search.js`) — words pulled out of any other recording.
- **VOICE** (`voicelab.js`) — a line spoken in her voice, or the voice changer
  run on a take until the line is right.

## The diff

Measured Aug 2026 by reading the Cutting blocks artifact (v14), `editor.js` +
`editor.html`, `cuttingroom.js` + `cuttingroom.html`, `cutmarks.js` +
`cutmarks.html`, and `search.js`. Each line is one thing you can do to audio,
and where it lives today.

Only in **Cutting blocks** — and it is not a tool:

- Split one line into two (tap two words)
- Meld two lines into one (link mode)
- Locked in / not sure / out — every other room is keep-or-cut, no maybe
- Hear the whole thing as marked, *before* rendering
- Say who said it — her voice, or TTS (hers to set; a measurement of the film
  recovered only 3 of the 5 known TTS lines)

Only in **Cut Marks**:

- Nudge an edge by a tenth of a second (the Cutting Room's manual mode is
  parked by request)
- Cut at the exact tapped moment
- Video, not just audio

Only in **the Pausing tool** (a Compare page, not a tool):

- Set how LONG a pause is — the Cutting Room only removes one, compressed to
  ~0.28s
- Add a pause where there is none
- Build a pause out of the recording's OWN room tone (the quietest 120ms,
  trimmed or looped), never digital silence — digital silence is what made the
  45% line sound bungled
- Play HER EDIT rather than the film: the page decodes the film once and
  rebuilds it in memory with her pauses and cuts applied, because "I need to be
  able to hear it to know how long of a pause I want"

Only in **the Cutting Room**: pauses and filler out (i.e. *removing* them).

Only in **Search**: search every recording (77 interviews + ~1,100 memos).

In two rooms: reorder (Blocks, Episode Editor) · add a typed line spoken in her
voice (Blocks, Episode Editor) · undo (Blocks, Cut Marks — the Episode Editor
and the Cutting Room have none) · mark it on the transcript (Cutting Room,
Episode Editor) · pull words in from another recording (Search → Episode
Editor).

## The three structural holes

These are the ones worth building, and none of them is a missing button:

- **BLOCKS has no tool.** It is a hand-built Compare page, re-posted at v14,
  which borrows `POST /api/editor/page-cut` to render and saves its whole
  marking state into a chatfeed verdict doc. There is no module, no Firestore
  doc of its own, no page in `public/`, no iOS tile. Every improvement to it
  costs a chat re-authoring an 80KB artifact. It also holds five capabilities
  that exist nowhere else (above), so the most-featured cutting surface in the
  repo is the one with no server behind it.
- **The polish pass is split across a tool and an artifact.** The Cutting Room
  removes a pause; the Pausing tool shapes one. Rhythm — how long a beat sits —
  is the half that only exists as a page, and it is the half that decides how a
  cut actually sounds.
- **Nothing carries a project across the rooms.** Each room is
  content-addressed by its own source url — `forge-cutroom` by sha1 of the
  audio url, `forge-cutmarks` by sha1 of the url, the Episode Editor by
  episode id. The Episode Editor → Cutting Room hand-off passes a url and a
  name and nothing else, so marks, labels, speaker and order do not travel.
  Walking the whole S therefore means re-deciding the same things in four
  places.

## The survey — every audio tool a chat built as a page

Measured Aug 2026 by walking all **253 chats** in the registry and listing their
Compare pages (**353** total), then reading every one that touches audio.

Still only a page:

- **Pausing tool** — `evan-story-visual-summary`, Aug 10, page
  `s9rSf9bZo0AqnScX0OON` (titled "Evan — the pause timeline (v7b)"). The one
  above. This is also the page behind CLAUDE.md's CORS finding: it `fetch()`es
  audio and `decodeAudioData`s it, which a same-origin test cannot exercise.
- **Cutting blocks v14** — `cutting-blocks-artifact`, Aug 12,
  `ePKqeMJOATGCz7MJa9lA`.
- **Every passage — pick the cuts (v3)** — `illustrated-cannon-passage`, Aug 8.
  A hand-rolled span picker over 11 sources.
- **Where the pictures fall — planning cut v1** — `darius-wright-heart-field`,
  Aug 8.

Became a real tool:

- **Cut picker** — `chat-app-recording-trim-ui`, Aug 9 → `picker-shell.html` +
  `/picker.js`, now the required shared surface.
- **Cutting Room — screen sketch v1** — `audio-editor-waveform-marking`, Aug 5
  → `/cuttingroom`.
- **Cut Marks — mockup v1** — `manual-cut-marker-media`, Aug 6 → `/cutmarks`.

The pattern worth noticing: **three of the built audio tools started as a
Compare page**, and the two most-featured surfaces are the two that never made
that jump. The hand-rolled span pickers are also the case CLAUDE.md already
records — four chats each rebuilt one in a week, which is why the shared picker
is now mandatory.

## The Cannon picker is a working prototype of SCRIPT

Measured Aug 2026 by reading `illustrated-cannon-passage`'s "Every passage —
pick the cuts (v3)" against `editor.js` and `/picker.js`.

All three are the same gesture — tap the first word, tap the last word. What
separates them is **what is behind the words**:

- **Episode Editor** and the **shared cut picker** pick spans of words that have
  REAL AUDIO behind them. Every span carries a `timeSec` anchor into a
  recording, `phraseSpan` locates it in the audio's word timestamps, the edges
  snap into real silences, and the picker's ▶ plays the exact span.
- **The Cannon picker** picks spans of a Dolores Cannon book passage. The PAGE
  has no audio: no timestamps, nothing to play, which is why it is the only one
  of the three that estimates **"N picks, about X words — roughly Y seconds read
  aloud"** (`words / 2.6`).

**CORRECTED 2026-08-15 — the books have AUDIOBOOKS, so the words HAVE been
spoken.** This doc first concluded the Cannon picker was categorically different
because its text had no recording behind it, and that it was therefore the
**SCRIPT** stop prototyped. **Both halves of that were wrong**, and the evidence
was already in Storage: `dolores-time/clips/` holds cut audiobook passages
(`A`, `A2`, `B1`–`B5`, `JANET`, `LAUGH`) and the `dolores-cannon-time` chat
built "TIME — listen to the passages (v2)" over them. Cannon passages are
already being cut from audio and reviewed by ear — by hand, outside every tool.

What that makes it: **the Episode Editor pointed at a different library.** A
long transcript with real audio behind it, spans picked out of it, cut. That is
WORD CUT, not SCRIPT. The read-aloud estimate drops from *necessary* to a
*fallback* — useful only for a line that has not been rendered yet (a TTS block),
which is a real case but a narrower one.

**SCRIPT survives; it just loses its prototype.** The voice-memo-plus-an-
instruction becoming written words is still unbuilt and still its own step.

**Worth carrying over:**

- **"Find it" → the Episode Editor.** The Cannon picks sheet jumps back to where
  a pick sits in the transcript; the editor has snippet cards with no way back
  to where they came from.
- Its overlap guard (a pick may not cross another) and tap-inside-to-remove with
  undo are both good, and neither the editor nor the Cutting Room has them.
- **The read-aloud estimate → BLOCKS**, but only for blocks with no audio yet
  (a typed TTS line). Anything cut from a recording has a real duration.

## An audiobook is the EPISODE EDITOR's shape, and only its shape

Two measurements, both load-bearing for anything built on the Cannon books:

- **The Cutting Room and Cut Marks CANNOT take an audiobook.** Both hard-cap at
  90 minutes (`MAX_SECONDS = 5400`, in `cuttingroom.js` and `cutmarks.js`); a
  Cannon audiobook runs 8–12 hours. **The Episode Editor has no cap because it
  never loads the whole file** — `extractWindow` seeks a ±150s window with
  ffmpeg over HTTP and cuts from that (`WINDOW_RADIUS = 150`). Long-form is
  already solved in exactly one room, and it is the one this belongs in.
- **Use `edgeSpan`, NEVER `phraseSpan`, to locate a pick in audiobook audio.**
  The book's text and the narrator's reading are two DIFFERENT transcripts —
  narrators drop and alter words, editions differ, and what we hold may be a
  session transcript rather than the printed page. `phraseSpan` trims unmatched
  edge words as never-said, which is correct within one transcript and **wrong
  across two**: it would silently clip words off the ends of her picks.
  `search.js`'s `edgeSpan` exists for precisely this case (its own header says
  so — "the pick text and the cut come from DIFFERENT transcripts"), anchoring
  each edge on its own 6-word sub-phrase and reclaiming disagreed edge words by
  position. The plumbing is built; point it at the new library.

**Two constraints before anyone starts:**

- **Cost is an ASK, per book.** Whisper is ~$0.006/min, so a 10-hour audiobook
  is ~600 min ≈ **$3.60** — over the $3 line. If the book's TEXT is already in
  hand, forced alignment is cheaper than transcription and the NDE project
  already has the pattern (`nde-align-cache/<videoId>_<winStart>.json`). Price
  it properly before committing to a library of them.
- **Whose voice SHIPS is a separate question from whose voice she picks by.**
  An audiobook is a commercial narrator's recorded performance. Hearing it while
  choosing is one thing; baking it into a film is another. The pipeline already
  has the better answer for the render — narration in HER voice, which is what
  the Episode Editor's narration cards and the Voice Studio already do. So:
  audiobook as the reference track while picking, her voice on the output.

**One latent bug, do not copy it.** The Cannon picker saves every pick —
including each pick's full TEXT — as ONE verdict field, and
`POST /api/chatfeed/verdict` hard-truncates `text` at **2000 chars**
(`chatfeed.js`, the `patch.texts` line). Measured live: her two sheets hold 5
and 6 picks at 659 and 810 chars, so **nothing is lost today** — but at ~130
chars a pick she starts silently losing them around 15. This is exactly the bug
the shared picker was built to avoid, which is why `/picker.js` saves **one
field per pick**. Anything built for SCRIPT uses the shared picker's save model.

## "Where the pictures fall" is not an audio tool

`darius-wright-heart-field`, Aug 8. Worth naming because its title reads like a
cutting tool and it is not one: it is a **timing sheet for a film's pictures**.

The narration was cut FIRST (1:48 of Darius), then 13 pictures were fitted to
it. Each row carries the picture, its number, its exact span (`0:00–0:11 · 12s`)
and the words that play underneath it; "Play the cut" opens the assembled video.
Its job is judging whether each picture holds for the right amount of time
against the words it covers — hence *where the pictures fall*. It even carries
its own known-problems card (shot 13 warps under animation; shots 1, 2, 10 and
12 are stretched over 2× to fill their lines, fix named as two pictures per
line).

It sits downstream of the finished cut, on the **picture** side — so it belongs
to the content pipeline's map, not this one.

## If one tool were built with all of it

The union is: blocks with a tri-state and a speaker badge, that can be split,
melded, reordered and added to, played whole before rendering, with an undo,
whose edges can be nudged to the exact millisecond, that can pull words in from
any other recording, and that can have its pauses and filler taken out **and
their lengths set** — over one project that survives from capture to polish.

Three things must NOT be folded in while doing it, all decided already:

- **Pause/filler removal stays out of a render.** Removing an "um" from the
  middle of a clip is a splice, and a splice gets approved by ear — that is
  what the Cutting Room is for.
- **Her voice is never loudnormed**, anywhere on the path.
- **A pause is never digital silence.** Build it from the recording's own room
  tone, trimmed or looped — the Pausing tool's finding, and it is audible.

And one implementation rule the repo already paid for: **there is ONE cutter**
(`editor.js` — `phraseSpan` → `clampBounds` → `detectSilences`/`snapToSilence`
→ micro-fades). Every room imports it. A unified tool imports it too; it does
not get its own.
