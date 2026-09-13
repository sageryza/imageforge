# The movie & sound tools — a plain inventory

Fourteen tools live behind the **Movies & sound** chip in the ImageForge iOS
app. This file describes each one on its own terms: what it is, what goes into
it, what comes out, and what it costs. **It deliberately proposes no order and
no grouping** — it is written to be handed to someone with fresh eyes.

Every tool is a tile in the iOS app. Most are a web page (served from
`imageforge-q125.onrender.com`) wrapped in a native screen; two are fully
native. All state lives in Firestore/Firebase Storage.

---

## Story Room

**Tile:** Story Room · **Page:** `/storyroom` · **Code:** `scratchpad.js`

Thinking with pictures. A story is a row of **beats** — small tiles, four to a
row. Tapping a beat opens a card with its art at thumbnail size, five bare
colour chips, and a text box. Hearted images from the Playground (a separate
picture tool) appear as its inbox, read live.

- **In:** typed or dictated beat text; art (generated in place, or hearted from
  the Playground); voiceover pasted from iOS Voice Memos, or a file.
- **Out:** a story with beats, art and audio; and a stitched **film** — every
  beat that has art, each held for the length of its own audio.
- Her own recording always wins over text-to-speech, and every take is kept.
- Beats can be chained into "chunks" so contiguous beats sit as one tile.
- **Cost:** art generation costs; stitching is free (ffmpeg on our own server).

## Story Timeline

**Tile:** Story Timeline · **Page:** `/timeline` · **Code:** `timeline.js`

A dictated list of moments becomes cards that can be put in order. The page
only lists and arranges — nothing on it creates a story; a chat files the story
by API and hands over a link.

- **In:** a block of dictated text, one moment per line. A parser strips
  numbering, removes wrapping quotes, and reads ALL-CAPS lines as the start of
  a named sequence.
- **Out:** an arrangement. The atom is a **moment** (words, keyed by id); the
  thing that moves is a **unit** — one moment or a run of them that travel
  together, carrying one number, which is its place in the order.
- Controls: a number you can type, single/double arrows (one step / all the
  way), marks in the gap between cards (join these two, insert one here), a
  pencil to change the words, and a unit of 5+ folds to its first and last.
- Nothing is deleted outright — delete hides.
- **Cost:** nothing. No model call, no background job.

## Search

**Tile:** Search · **Page:** `/search` · **Code:** `search.js`

One search box across both transcript libraries: ~77 long interviews and
1,000+ of her own voice memos.

- **In:** words, or a phrase to match by meaning.
- **Out:** **passages** with playable audio, not just file names. Each result
  carries a hand-off button to another tool.
- Two modes: WORDS (keyword matching, free) and MEANING (embeddings, about 5¢
  to embed the whole library once).
- Needs re-indexing after new videos or memos are ingested, then re-embedding —
  the vectors are keyed to the index build.

## Voice Studio

**Tile:** Voice Studio · **Page:** `/voice` · **Code:** `voicelab.js`

Her cloned voices, behind two tabs.

- **TEXT** — type or dictate words, hear them in one of her voices
  (text-to-speech).
- **VOICE** — speech-to-speech: record or upload a take in any voice, and it
  comes back in hers, keeping the performance and swapping only the voice.
- Her words stay in the box after a render, so a line can be tweaked and re-run.
- **Cost:** ElevenLabs credits per render.

## Cutting Blocks

**Tile:** Cutting Blocks · **Page:** `/blocks` · **Code:** `blocks.js`

A recording comes apart into sentence-level **lines** that can be handled
individually.

- **In:** one of her recordings (by URL).
- **Out:** a rendered audio file made of the lines she kept, in the order she
  put them.
- What it does: **split** a line (tap two words), **meld** lines back together,
  **reorder** them, mark each one **locked in / not sure / out** (three states,
  not keep-or-cut), **respeak** a line in her voice, and **hear the whole thing
  as marked** before anything is actually cut.
- **Cost:** transcription about $0.006/min, once ever per recording. Rendering
  is free.

## Episode Editor

**Tile:** Episode Editor · **Page:** `/editor` · **Code:** `editor.js`

Builds an episode out of spans of a real interview transcript.

- **In:** an interview transcript; spans picked off it become **snippet cards**.
- **Out:** one finished audio render.
- Cards are arranged on a board and can be interleaved with **narration cards**
  (words spoken in her voice) and **gap cards** (silence of a chosen length).
- Two hairline tabs — the clips and the raw transcript — because building an
  episode means going back and forth between them.
- Every cut it makes is banked in a permanent cache, so a given clip is only
  ever cut once.
- **Cost:** free once the transcript exists (ffmpeg on our own server);
  narration costs voice credits.

## Cut Marks

**Tile:** Cut Marks · **Page:** `/cutmarks` · **Code:** `cutmarks.js`

Marking cuts by ear, with no transcript and no waveform.

- **In:** any audio **or video** file.
- **Out:** one new rendered file. Renders never overwrite the source.
- She plays the file and taps a scissors at the spot; the marks divide it into
  pieces, and each piece is kept or dropped. Positions can be nudged by a tenth
  of a second.
- **Cost:** nothing.

## Cutting Room

**Tile:** Cutting Room · **Page:** `/cuttingroom` · **Code:** `cuttingroom.js`

Marking one of her own recordings **on its transcript** — never a waveform.

- **In:** one of her recordings.
- **Out:** a cleaned render, and/or sections sliced off to save or send
  elsewhere.
- What it does: cut pauses out (compressed to one length, ~0.28s), cut filler
  words ("um") out, and slice sections off the recording.
- Designed around her wrist: everything is a tap; nothing drags or scrubs.
- Every real cut re-listens to the audio first — the stored bulk transcription
  is only accurate enough to draw the word chips.
- Her voice is never volume-normalised.
- **Cost:** transcription about $0.006/min once per recording; cutting is free.

## Pausing

**Tile:** Pausing · **Page:** `/pausing` · **Code:** `pausing.js`

How long a beat sits. Where the Cutting Room can only remove a pause, here a
pause is given a **length**, or added where the recording has none.

- **In:** a recording plus its transcript, shown as paragraphs.
- **Out:** a render with her chosen pause lengths baked in.
- The point of the tool is hearing the **edit** rather than the source: she
  approves a length by ear, so the preview has to be the take. Listening is per
  paragraph, spliced in the browser, so changing a length costs no round trip.
- A pause is never digital silence — it is the recording's own room tone, either
  an existing gap trimmed/looped or the quietest stretch of the file borrowed.
  Zero samples read as a dropout.
- It does not cut words.
- **Cost:** transcription once per recording; everything else free.

## Characters

**Tile:** Characters · **Page:** `/character` · **Code:** `character.js`

Character reference cards, so a recurring person looks the same across
pictures.

- **In:** a photo and a name (plus optional aliases).
- **Out:** a saved **character card** — a diary-comic style reference image —
  and a compiled sheet of the recurring cast.
- Cards are looked up by name, so a story or dream that mentions a person can
  find plausible candidates for them.
- **Cost:** one image generation per card.

## Movies

**Tile:** Movies · **Native screen, no web page** · **Code:** `movies.js`

The full text-to-film factory, and the biggest tool here.

- **In:** a story typed or dictated into a box.
- **Out:** a finished stitched film, plus an illustrated zine of the same story.
- The chain inside it: the story is broken into ~8–12 self-contained scenes →
  each scene is drawn as a panel (gpt-image-2) → each panel is animated into a
  short clip (Replicate image-to-video) → the clips are stitched (ffmpeg).
- It also holds **quick animate**: one image plus a prompt in, one short clip
  out — no story involved.
- A character anchor locks one panel as a person's reference so faces stay
  consistent across scenes.
- Editing after the fact is free (server-side ffmpeg), and every re-roll is kept.
- **Cost:** about $1.35 for a 12-scene film.

## Dreams

**Tile:** Dreams · **Native screen** · **Code:** `movies.js` (shares the module)

Last night's dream, illustrated, plus a journal of them.

- **In:** a dictated or typed dream.
- **Out:** illustrated comic pages, and short "dream bridge" clips.
- The flow is staged and she approves things before anything paid runs: the
  order of events and the cast are confirmed first, then pages are drawn.
- Named people are matched against saved character cards, so recurring people
  in dreams look like themselves.
- **Cost:** image generation per page.

## Chunking

**Tile:** Chunking · **Page:** `/chunking` · **Code:** `clips.js`

A library — a shelf of every short self-contained video piece the app has ever
made, four to a row with names under the posters.

- **In:** nothing is generated here. It **harvests** — pulling in movie scene
  clips, kept re-rolls, dream bridges and quick-animates, plus a sweep of
  storage for short videos chats built. Anything longer than ~3 minutes is
  treated as a film and skipped.
- A **chunk** (her word, what the tool is named for) is a named, tagged section
  of a finished video — footage and voiceover together — that she would reuse
  whole in a different video. Chunks are filed deliberately, by API, with a
  title, a span, tags, and the voiceover text.
- **Out:** search results. Search is the whole interface: bare words, `OR`,
  `-exclude`, `"quoted"`, plus `tag:` `title:` `from:` `prompt:` `vo:` filters.
- Her edits to a clip's fields always win — a re-harvest never overwrites a
  field she touched. There is deliberately no delete; hiding is the verb.
- **Cost:** nothing. It generates and stitches nothing.

## Films

**Tile:** Films · **Page:** `/films` · **Code:** `films.html` over `movies.js`

Films without a story attached — experiments and one-offs.

- **In:** a story box (with a mic for dictation), optional character cards, and
  a style choice.
- **Out:** a film, shown with its scene grid; below that, a list of recent
  films to open again.
- It drives the same machinery as the Movies tile; the difference is that
  nothing made here is filed against a story project.
- **Cost:** same as Movies.

---

## Things referenced above that are NOT tiles in this tab

Worth knowing, because they explain where material comes from and goes.

- **The voice memo library** — one archive of her recordings (~1,000+),
  transcribed automatically. Everything files into it: a push from her Mac, the
  iOS share sheet, a paste, a chat handing over a file. Several tools above open
  a recording out of it.
- **The interview library** — ~77 long transcribed interviews (a
  near-death-experience documentary project). New ones can only be downloaded on
  her own Mac; a cloud session can never add one.
- **The Playground** — a picture tool (not in this tab). Images hearted there
  are the Story Room's inbox.
- **The audio "project"** — a lightweight shared id threaded through audio
  hand-offs, carrying a name and who-speaks so those are decided once. Each
  tool's marks and geometry stay local to that tool on purpose, because every
  tool re-listens to the audio itself.

## Wiring facts (mechanical, not a workflow)

These are facts about how the code is connected — shared functions and buttons
that exist today. They are listed because a diagram may want them; they are not
a proposed sequence, and several run both directions.

- The Episode Editor owns **the cutter** — the validated routine that turns a
  word span into clean audio. Cutting Blocks imports it rather than having its
  own.
- Cutting Blocks also imports the Cutting Room's transcription pass.
- Pausing imports the Cutting Room's pause-detection passes, so the same
  recording reads identically in both.
- The Cutting Room exposes a scissors button on each finished Episode Editor
  render.
- Search results carry hand-off buttons: an interview passage into the Episode
  Editor, a memo into the Cutting Room.
- The Story Room shows listen rows for the Episode Editor episodes cut from a
  story and for the voice memos the story came out of.
- Movies, Dreams and Films share one module (`movies.js`).
- Chunking harvests from Movies, Dreams and quick-animate.
- Characters is read by both Dreams and Movies when a person is named.
- A shared `GET /walk?url=` derives lineage across tools by joining render URLs
  to source URLs — so a given file can report what it came from and what it went
  on to, with no stored state.
