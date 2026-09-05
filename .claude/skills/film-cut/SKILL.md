---
name: film-cut
description: How a chat cuts a film of clips and stills so Sophie can edit the same cut in the Film Editor — the cut DOC is the film, both of you edit it, every version is a render of it. Use this skill whenever you are asked to make, re-cut, re-time or re-mix a film, reel, episode or montage out of clips, stills and sound (voice, music, effects), and whenever Sophie says she edited a cut in the Film Editor. Not for a film made entirely of generated video scenes through the Movies pipeline.
---

# Cutting a film she can edit in unison

Sophie, 2026-09-02: "discussing movies w chats is frustrating and difficult to
fine tune … clips laid out exactly the same so we can both edit in parallel …
i need to be able to move the sound around. that's literally what i can't
describe to the chat … they give me a draft, i edit in film editor, i send a
message, they edit, i edit, etc."

**The rule: the Film Editor's cut doc IS the film.** You do not keep a cut list
in your head or in a scratchpad and render it with your own ffmpeg. You write
the doc, render THROUGH it, and pin the render carrying the cut's id. She opens
the same cut in the editor, moves things, and tells you; you read what moved
off the doc and do your half. The full design: `docs/film-editor-parallel-editing-plan.md`.

## The shape (cut-model.js — the one copy)

- **PICTURE lane** `clips` — ordered. A clip is `{key, url, title, seconds, in, out}`;
  a STILL is `{key, kind:'image', url, title, out:<hold seconds>}` (in is 0).
  Pieces butt against each other; a piece's start is the sum of those before.
- **SOUND lane** `sounds` — any number, overlapping. `{key, url, name, at, in,
  out|null, gain (dB), fadeIn, fadeOut, mute, anchor?:{piece, offset}}`.
  **Anchor a sound to a shot when it belongs to that shot** (screams on the
  horror clip): it follows the shot wherever she moves it.
- **A gain ride is pieces, not a curve.** Split the bed into sound pieces with
  their own levels (and fades where they meet); every part of it is then hers
  to move. Measured on The Ant Farm: the cello build is five pieces stepping
  −6.6 → −11.5 dB.
- `key`s are yours and PERMANENT — an anchor names a key, and the diff names
  keys. Never renumber.

## The loop, one command each (`scripts/filmcut.js`)

1. `create --title "…" --chat <your slug>` → the cut id and its editor link.
2. Write `cut.json` (both lanes) and `set <id> cut.json`. It reads `base`
   first; a **409 means she edited since you read** — it prints her cut. Re-read,
   re-apply YOUR change on top of hers, save again. Never overwrite her edit.
3. `render <id>` — renders IN YOUR CONTAINER (the default whenever
   `FIREBASE_SERVICE_ACCOUNT` is set) through filmeditor.js's own renderCut
   and publishes onto the doc; prints the url. Renders never overwrite; every
   one carries `by:'chat'` and a snapshot of the cut it came from. `--box`
   renders on the live box instead — a deliberate exception, never the
   default: the 512MB box OOM-killed a 16-piece render twice in one night
   (2026-09-05) while a container did the same cut in 61s.
4. `pin <id> --chat <slug> --session <sid> --title "The Ant Farm — v8, … (1:48)"`
   — pins the newest render WITH the cut id, which is what puts the editor
   door on the pinned row, and records the deliverable (checklist 3a + 3c).
   The shot map (3f) is written by the render itself.
5. **When she next messages you** (there is NO doorbell — her message is the
   wake, her call): `diff <id>` first. It says in words what she moved ("kid
   horrified earlier (now at 8.4s, was 32.1s)", "screams sound later to …").
   Do your half against THAT, save with `set`, render, pin. Say back what you
   read, briefly.

## Rules

- **NEVER connect footage and voiceover unless it is ON PURPOSE (2026-09-05,
  Sophie: "the methodology is an issue · u shud never connect footage and
  voiceover unless its on purpose").** Every narration part is anchored to
  the SHOT it is about — never to a shot far up the timeline with a
  cumulative offset — and the picture is cut TO the words: a shot's length is
  decided by the line it carries, and each pairing is named in the reply
  ("the fridge sits under *you just fill it out*"). Earned on the desk-sweep
  commercial: the one-take narration was pinned to the Matrix shot, so
  trimming a second and a half out of the fridge slid every later shot under
  different words — *connect it to everything* left the neurons and the
  science line started on top of it. A pairing that happens because of where
  a trim landed is an accident, not a cut; when the words are one continuous
  take, the shots between two lines must add up to the gap between them.
- **Sounds are hers.** Don't bake a bed into another bed, don't pre-mix
  voice + music into one file: every sound she might want to move is its own
  piece on the lane. Her voice at unity, always.
- **Nothing outside the doc.** Text overlays, transitions and speed changes
  are not in the vocabulary yet; if a film truly needs one, say so in the
  reply — that part cannot be edited in unison — rather than rendering it
  privately and pinning the result as if it were the doc's.
- **Draw, bank AND render in your own container; cut through the doc.**
  Stills, MJ clips and beds are uploaded to Storage as usual (the Dump or the
  audio library); the doc references them. "Through the doc" means the doc is
  the film and the render lands on it — not that the ffmpeg runs on the box.
  The box's Render button is hers; a chat's render is free either way.
- **An existing film** (made before this) is migrated once: read its shot map
  (`GET /api/filmshots?url=`) and its banked beds, measure the placements
  (cross-correlate each bed against the mix — `scripts/migrate-ant-cut.js`
  is the worked example), build the doc, render, and confirm the render is
  the film before you pin it.
- Costs nothing. Nothing here calls a model.
