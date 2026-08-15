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
POLISH) into the ten the audio really walks. **Keep the two looking like one
family: if the road changes there, change it here.** The map reuses that
pipeline's already-paid-for icon cut-outs
(`vector/pipeline-icons-cut/`, `vector/pipeline-icons-2-cut/`) rather than
re-rendering a sheet.

## The ten stops

1. **CAPTURE** — voice memos, the drop, the share sheet. One library; every
   path files into it (`memos.fileIntoArchive()`).
2. **SCRIPT** — the memo plus her instructions become a script. **No tool.**
3. **BLOCKS** — the script cut into sentence-level blocks. **Artifact only** —
   the Cutting blocks Compare page, v14.
4. **ARRANGE** — move them, meld two into one, split one in two, drop some,
   add some. Lives inside the same artifact.
5. **SLICE IN** — pull words in from any other recording (`search.js`).
6. **VOICE** — a new line in her voice, or another voice on her take
   (`voicelab.js`).
7. **WORD CUT** — the exact words out of a long transcript (`editor.js`).
8. **EXACT CUT** — tap the spot on the playhead, nudge by a tenth
   (`cutmarks.js`).
9. **POLISH** — pauses out and filler out (`cuttingroom.js`), and their LENGTH
   set (or a new one added) in the **Pausing tool** artifact. The last pass.
10. **THE CUT** — the finished audio.

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
