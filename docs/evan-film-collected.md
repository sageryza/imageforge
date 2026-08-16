# The Evan film — everything, collected

Sophie, 2026-08-16: *"it's time to finish the oven film EVAN but rather than
figuring out which chat with him, could you collect all the work we've done in
different chats."*

This file is that collection. The work lived in **six chats over thirteen days**
and no single one of them holds the whole thing — which is why picking "the
right chat" was the wrong move. Everything below was read off the live feed,
the live Assets tabs, the live verdict sheets and Firebase Storage on
2026-08-16, not reconstructed from memory.

Companion file: **`docs/evan-film-style.md`** is the art recipe (style prompt,
model, quality, character references). It is still correct — nothing here
supersedes it. This file is the *state of the project*.

---

## TL;DR — where it actually stands

- **35 film renders** exist in Storage. The newest is **`evan-v13.mp4`, 4:21**,
  Aug 12 00:54, pinned as current in two chats.
- **114 images** exist across three chats, in three generations.
- **The film is NOT finishable as-is, and there is exactly one reason:**
  Sophie's cut marks exist as **two diverged copies of the same sheet**
  (`blocks-s96`) in two different chats. **v13 was rendered from the stale
  one.** See *The blocker* below — everything else is in good shape.

---

## The six chats, and what each one holds

| — | chat | dates | what it holds |
|---|---|---|---|
| 1 | `oven-story-illustrations` | Aug 3–7 | where it started. The shot list off her voiceover; the first 4 images |
| 2 | `media-asset-survey` | Aug 6–9 | the Story Room prototype pages; the extra Evan art she pointed later chats at |
| 3 | `evan-story-visual-summary` | Aug 9–12 | **the bulk.** The cut, 35 renders, 86 images, ~30 of her notes |
| 4 | `cutting-blocks-artifact` | Aug 11–12 | the Cutting Blocks tool (v1→v14) and **her live marks** |
| 5 | `evan-charlie-voice-clone` | Aug 14–15 | a voice clone off the Evan recording — **built, rejected, deleted** |
| 6 | `evan-film-local` | Aug 16 | the girl character settled; 12 beats redrawn at medium |

*(Table kept to this file only — never put one in a reply to her.)*

### 1. `oven-story-illustrations` — the origin (Aug 3)

Her opener, with the scan attached: *"I wanna use this as a style reference to
re-illustrate the oven story Evan is in… There should be absolutely no
instructions on style just the image and it should say use only the style not
the content."* Then, one minute later: **"evan not oven."** That is where the
name in this branch comes from — her own typo, corrected immediately.

The shot list was built from **her voiceover transcript**, at her instruction,
not from the beat cards already in the Story Room. It is the skeleton the whole
film still follows: the call → seeing the future → the science → Spider-Man
world → the proof.

Four images made, `gpt-image-2 · medium`, all four labeled, captioned and
prompt-filed. **All four still clean** (swept 2026-08-16: 0 missing anything).

### 2. `media-asset-survey` — the pile she pointed everyone at

Eight Compare pages, including *"Everything you said — the whole record (Aug
7)"* and the Story Room working prototype v1→v5. On Aug 10 she told the film
chat: *"there's quite a few other evan pictures that you can select from the
working prototype artifact from the media asset survey chat."* That is the only
reason those images ever reached the film.

### 3. `evan-story-visual-summary` — the film itself (Aug 9–12)

148 messages, the longest thread by far. This is where the film was actually
cut, and where most of her direction lives.

**What was settled here, and should not be re-litigated:**

- **Pause removal is a solved problem in this repo.** She had to say so
  explicitly on Aug 10: *"The cuts you handed me still have tons of dead air —
  my fan and blanket noise put the pauses above whatever silence floor you
  used… read `docs/nde-precise-cutting.md`… then re-cut using
  `scripts/vo-remove-pauses.js`."* Her verdict after: *"wow, this is so much
  better."* **Never hand-roll silence detection on her audio.**
- **Sheldrake in his own words beats her explaining him.** *"that's way better
  with his words instead of mine."*
- **One pause is protected.** *"I specifically said to keep the pause between
  when the phone ring it was Evan — just keep that pause… I know it will mess
  up your pause thing but I want that exact pause."*
- **The science goes at the END** of the sequence.
- **The telepathy/one-study line is a bridge and is NOT in the film** —
  *"that was just me talking… It's not going in the film."*
- **Whisper read-back of the RENDERED file is a required step**, not optional.
  She asked for it on Aug 12 and it caught three real defects in a film already
  handed to her: her last line missing entirely (video track 1.5s shorter than
  audio), and leading words clipped on several clips.

**The render lineage** (35 files, `story/films/`): `evan-long-v1…v16` and
`evan-short-v1…v16` (the long/short pair experiment, Aug 10), then
`evan-sheldrake-v1/2/3/5` (the Sheldrake-in-his-own-words fork), then the
single line `evan-v6 → v13` once the shorts were dropped. **`evan-v13.mp4`
(4:21) is the newest and the one pinned.**

### 4. `cutting-blocks-artifact` — the tool, and her real marks

The Compare-page artifact went v1 → **v14** in about 30 hours, driven entirely
by her feedback. It is the ancestor of the shipped **Cutting Blocks** tool
(`blocks.js`, `/blocks`). Things she asked for there that are now house
behaviour: marks per line not per block, the chain (meld), three states
(locked in / not sure / out), a typed number to reorder, invisible play buttons
until a line is opened, undo/redo, and no boxes drawn around words.

Two bugs of note, both hers to have caught: every word was wrapped in `<i>` for
two versions (the whole transcript was italic), and the autoscroll pill sat on
top of the cut button.

**Her marks live on this chat's sheet.** 148 keys, including six typed TTS
lines, her melds, her splits and her *maybe* states.

### 5. `evan-charlie-voice-clone` — closed, do not rebuild

Source found: her voice memo of **July 9, 2026**, *"Discussion on Coincidence
and Science"*, 33m44s — the Evan phone call, the science-vs-magic argument, the
rats, Charlie at the end. (The memo's own auto-description claims it's a
conversation with Evan; that is `gpt-4o-mini` misreading reported speech. It is
her alone throughout.)

An instant clone was built, and **she rejected and deleted it**: *"I don't
think I like this. I think it should just be deleted because it doesn't sound
like me."* The reason is recorded so nobody burns a slot repeating it: the
recording is her **reading a written piece in takes** — a different register
from ordinary speech — and only ~7 minutes of it after silence removal. The
clone she likes, *"Sophie — morning"*, is a professional clone off 2.63 hours
of ordinary speech. **Settings were not the lever; changing them moved
nothing.**

Two pipeline bugs were fixed and merged along the way and those stand: the prep
script no longer rejects mostly-silent recordings by mismeasuring them, and an
`alimiter` auto-level bug that was quietly adding ~3 dB is caught.

Still in Storage under `voice-clones/evan-charlie/`: the training sample and
the test renders. **Her question "delete those too, or leave them?" was never
answered** — see *Open questions*.

### 6. `evan-film-local` — the girl, settled (Aug 16)

Twelve beats drawn fresh at `gpt-image-2 · medium`, $0.72. She spotted the
problem immediately: *"It looks like the girl character changes in each one."*

Cause, and it was written down in advance: `docs/evan-film-style.md` says the
girl character is not settled, and the batch ran anyway. Evan held across his
four beats because `refs/evan-character.png` anchors him; she had nothing.

Six faces were drawn in the same beat-1 bedroom scene, varying only face and
age. **She picked D — braids.** The six beats she appears in were redrawn with
her locked. Total spend in this chat: **$1.44**.

---

## The blocker — two copies of her cut marks

This is the one thing standing between v13 and a finished film.

When the Cutting Blocks artifact was copied from `evan-story-visual-summary`
into `cutting-blocks-artifact`, **her saved marks were duplicated rather than
moved**. Both pages read and write a sheet called `blocks-s96`, but each writes
it under its *own* chat. Measured 2026-08-16:

- **`cutting-blocks-artifact` — 148 keys. This is her live, current sheet.**
  It holds everything the other one has, plus 106 keys it doesn't: her melds,
  her segment splits, the two typed rat lines (`n1`, `n2`), and her *maybe*
  marks.
- **`evan-story-visual-summary` — 42 keys, and a strict subset.** **Zero** keys
  exist here that aren't in the other. It is the frozen copy.
- **4 keys directly conflict**, including `__order` — the running order of the
  whole film — plus `b38`, `b48` and `b37@11`.

**`evan-v13.mp4` — the pinned "current cut" — was rendered from the 42-key
stale sheet.** That is not a guess: v13 was rendered Aug 12 at 00:54, and the
order corruption in that sheet was diagnosed and repaired at 04:31 the same
day, three and a half hours *after* the render.

So her own report is explained exactly: *"there were certain things that I
thought were in different places and then they were rendered in the final cut
in places I didn't think they were."* She was right, and v13 is the evidence.

**There is already a render from the correct sheet — but it has no pictures:**

- **`dd0557cb…mp3` — 4:24, audio only, whisper-verified**, cut from her live
  148-key marks.
  `https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/nde-episodes/editor/page-cuts/dd0557cb544ff9baa2472014c0a7ae0127337122.mp3`
- **`evan-v13.mp4` — 4:21, pictures and audio**, cut from the stale 42-key
  marks.
  `https://storage.googleapis.com/membry-df528.firebasestorage.app/story/films/evan-v13.mp4`

The two differ by 3.4 seconds. **Finishing the film is: take the audio of the
first and the picture treatment of the second.** No new cutting decisions are
needed from her, and no model spend is required for the audio.

**A third copy does not exist.** `forge-blocks` — the collection behind the
shipped `/blocks` tool — is **empty**. Her Evan marks were never migrated into
the real tool and still live only on the two Compare-page verdict sheets. If
either is cleaned up, the marks go with it.

---

## The art — 114 images in three generations

| generation | chat | n | quality | status |
|---|---|---|---|---|
| G1 — the first four | `oven-story-illustrations` | 4 | medium | clean, on-style |
| G2 — the film art | `evan-story-visual-summary` | 86 | mostly **low** | what's in v13; 15 unlabeled |
| G3 — the redraw | `evan-film-local` | 24 | medium | newest, girl locked |

G2 was deliberately cheap — her Aug 9 instruction was that this was *"just for
me and will never become an actual frame, might as well do it as cheap as
possible."* **That decision is now load-bearing in the wrong direction:** the
film she is about to finish is built from `low`-quality art, and she has since
been shown `medium`. Worth asking her before a final render.

**15 of the 86 in G2 carry no label, no prompt and read `from
evan-story-visual-summary`** — background catches, not deliveries. They cannot
be captioned honestly by anyone now (see the measurement in `CLAUDE.md`); leave
them blank.

### The character references — one conflict

- **Evan — settled and stable.** `refs/evan-character.png`, in the repo. Held
  across every beat he appears in.
- **The girl — settled twice, differently, and only the second is in a PR.**
  - Aug 10, in `evan-story-visual-summary`: a "Sophie A–F" round. She ♥'d
    **F** (*"thick auburn bob, round glasses"* — note: *"Jeans and Converse is
    boring, but they probably won't show anyway"*) and **C**, lukewarm on the
    follow-ups (*"we could use this I guess"*, *"I like the original better
    sorry"*). **The G2 art was drawn from this round.**
  - Aug 16, in `evan-film-local`: a fresh six, and a decisive pick —
    **D, braids**. Banked as `refs/evan-girl-character.png`.
  - **These are not the same face.** An auburn bob with round glasses is not
    braids with strong brows. So the 86 G2 images and the 24 G3 images show
    two different narrators, and v13 is built from the G2 set.
  - Her own written description backs the later pick: *"curly brown hair in a
    high ponytail with loose strands… that or braids."* Neither a bob nor
    glasses appears in it.

**`refs/evan-girl-character.png` is not on `main`.** It is in
**[PR #1296](https://github.com/sageryza/imageforge/pull/1296)** — open,
unmerged, 2 files, +14/−3, no conflicts. The chat that opened it was blocked
from merging by the permission system.

---

## Her outstanding art notes

**~30 notes** sit on G2 images. Most were answered on Aug 11, but they are the
best single record of what she wants the pictures to *be*, and several were
never acted on. The substantive ones:

- The opening: *"for some reason in the real thing I was outside on my patio
  lounging"* — not the bedroom.
- The rat and the tunnel: *"this doesn't make sense. The tunnel isn't in
  physical reality. It's in the rats' [minds]"* — then *"let's try another
  version where the rats are actually like going down the tunnel."*
- The dying rat: *"it's supposed to be just like a normal sidewalk outside my
  house"*, and *"i'd like a couple more bystanders watching the rat but more
  casually."*
- The gift punch: *"a little too violent. I'd rather him be just like a little
  s[urprised]"*, *"he shouldn't be smiling"*, and *"someone should be giving it
  to her and she can't be dodging it."*
- Both on the call: *"they should probably both be the same size."*
- The first rat with mom: *"sitting on the couch with my mom and we saw the rat
  through the window."*
- Heaven imagery: *"we might take this actual beat out. I wanna lean towards
  the proof not heaven."*
- Style: *"redo this in watercolor"*, and *"it doesn't really matter the style
  as long as we know the content description… you can intersperse the two
  styles colored pencil and pick the best one from each."*

---

## Open questions — things she asked that were never answered

1. **The voice-clone leftovers.** *"Still sitting in Storage under
   `voice-clones/evan-charlie/`… Want me to delete those too, or leave them?"*
   — asked Aug 15, never answered.
2. **PR #1296** — open since Aug 16, needs a merge.
3. **Low vs medium art for the final film** — never put to her.

---

## What "finishing" now means

In order, and none of it needs a new decision from her except where marked:

1. **Merge PR #1296** so `refs/evan-girl-character.png` is on `main`.
2. **Reconcile the marks onto the 148-key sheet** and retire the 42-key copy —
   or better, migrate both into the shipped `/blocks` tool so this cannot
   happen a third time.
3. **Re-render the film from the live sheet**, keeping the picture treatment
   of v13. The audio is already cut and verified (`dd0557cb`, 4:24).
4. **Whisper read-back the rendered file** — required, not optional.
5. **Ask her** about the narrator conflict (G2 bob vs G3 braids) and about
   low vs medium art, because the honest answer is that a fully consistent
   film means redrawing the G2 set, and that is her call and her money.
6. **Pin the new cut** and re-post it, so the *current* tag lights.

---

*Collected 2026-08-16 from the live feed, Assets tabs, verdict sheets and
Firebase Storage. Every number in this file was measured, not recalled.*
