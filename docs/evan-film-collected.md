# The Evan film — handoff

Everything found across the chats that built it, with links. Written
2026-08-16 to hand the project to a chat that has none of the history.

**This is findings only.** Where something is a measurement it says so; where
it is Sophie's recorded words they are quoted. Judgement calls about what to do
next are deliberately not in here — that is the new chat's job, with her.

Companion file: **`docs/evan-film-style.md`** — the art recipe (style prompt,
model, quality, character references). Still current; nothing here changes it.

---

## The story is TWO halves, not one

Worth knowing before anything else, because most of the later chats only ever
saw one half. The source recording runs **Evan → Charlie**. The original chat
built both; every chat after Aug 3 worked only on Evan.

- **Evan** — the phone call, seeing the future, the Sheldrake telephone study,
  the rats, the proof.
- **Charlie** — Dolores Cannon, the hypnotist, the eye over everyone, the
  lantern path, "I love chicken selects". **Art exists (16 filed images), no
  cut, no film.**

---

## The seven chats

| — | chat | dates | holds |
|---|---|---|---|
| 0 | `audio-trim-voice-training` | **Jul 7–11** | **the origin.** Both halves. Recovered Aug 15 |
| 1 | `oven-story-illustrations` | Aug 3–7 | the shot list off her voiceover; first 4 images |
| 2 | `media-asset-survey` | Aug 6–9 | 11 survey/prototype pages |
| 3 | `evan-story-visual-summary` | Aug 9–12 | the cut, 35 renders, 86 images, ~30 of her notes |
| 4 | `cutting-blocks-artifact` | Aug 11–12 | the Cutting Blocks tool v1→v14, **her live marks** |
| 5 | `evan-charlie-voice-clone` | Aug 14–15 | a voice clone, built → rejected → deleted |
| 6 | `evan-film-local` | Aug 16 | the girl settled; 12 beats redrawn at medium |

### 0 · `audio-trim-voice-training` — the origin chat (Jul 7–11)

**This one was lost and recovered on 2026-08-15**, by the `find-lost-chats`
session. It is titled *"Audio segment trimming and voice training"*, which is
why searching "Evan" never surfaced it — its slug contains neither name.
Session id `01TDtvYKkfQqnLn9duWi5UoW`.

It **predates the Chats app** (which starts July 15), so it had never posted
anything. On Aug 15 it was woken and asked to backfill itself; it posted **14
messages with their real July 11 timestamps** and filed **34 images**. Its
thread now runs Jul 11 → Aug 16.

What it made, in its own account of itself:

- **The 339 recording**, denoised master, 33:44 — noise floor taken from
  −55 dB to −91 dB.
- **`rec339_final_draft.mp3`, 9:08** — dead air cut, re-takes trimmed to her
  rules, the psychic-experience section moved up to the first mention.
  **She approved this as the final draft.**
- **The marked 339 transcript.**
- **The "Evan & Charlie — story view" board** — 4 docs in `forge-story`,
  membry-df528, default database (it re-verified these coordinates live with
  the admin SDK on Aug 15; last write was 2026-07-10 03:07 UTC).
- **A rough Evan cut, 6:28**, delivered Jul 11, built with ffmpeg for $0.
  Its own note: six beats had no art at all, six more rode on storyboard
  panels.
- The first storyboard sheets, sliced into quarters.

**Two things it reported as unrecoverable**, both because the scratchpad is
wiped: the full 2×2 storyboard sheets (only the quarters were ever uploaded —
it re-stitched **two** of them exactly on Aug 15, free, and those are filed),
and any video. Its words: *"No videos survive anywhere (only this thread's
attachments)."*

**Her question about exporting it was answered there and the answer is no** —
the official claude.ai export is `conversations.json`, text only, with files as
IDs rather than bytes. Anything delivered only as an attachment in that thread
exists only in that thread.

### 1 · `oven-story-illustrations` (Aug 3–7)

Her opener with the scan attached, then one minute later: **"evan not oven."**
That typo is where this branch's name comes from.

The shot list was built from **her voiceover transcript** at her instruction,
not from the beat cards already in the Story Room. 4 images, `gpt-image-2 ·
medium`. **Swept 2026-08-16: all four have label, caption and filed prompt.**

### 2 · `media-asset-survey` (Aug 6–9)

11 Compare pages — the story surveys and the Story Room working prototype
v1→v5. On Aug 10 she pointed the film chat here: *"there's quite a few other
evan pictures that you can select from the working prototype artifact from the
media asset survey chat."*

- [Everything you said — the whole record (Aug 7)](https://imageforge-q125.onrender.com/api/chatfeed/page/XVFukiBWotMXJuEOT0pl)
- [Which recordings already became something (Aug 7)](https://imageforge-q125.onrender.com/api/chatfeed/page/xxWf6IFuUmUK1SpBfs91)
- [Story Room — working prototype v5](https://imageforge-q125.onrender.com/api/chatfeed/page/JkGqeMkdeeUhMB39gJu0)

### 3 · `evan-story-visual-summary` (Aug 9–12)

148 messages, the longest thread. Where the film was cut.

**Recorded decisions, in her words:**

- **Pause removal is a solved problem in this repo.** Aug 10: *"The cuts you
  handed me still have tons of dead air — my fan and blanket noise put the
  pauses above whatever silence floor you used… read
  `docs/nde-precise-cutting.md`… then re-cut using
  `scripts/vo-remove-pauses.js`."* After: *"wow, this is so much better."*
- **Sheldrake in his own words** beats her explaining him — *"that's way better
  with his words instead of mine."*
- **One pause is protected:** *"I specifically said to keep the pause between
  when the phone ring it was Evan — just keep that pause… I know it will mess
  up your pause thing but I want that exact pause."*
- **The science goes at the end** of the sequence.
- **The telepathy/one-study line is a bridge and is not in the film** —
  *"that was just me talking… It's not going in the film."*
- **Whisper read-back of the RENDERED file**, asked for Aug 12. It caught
  three real defects in a film already handed to her: her last line missing
  entirely (video track 1.5s shorter than audio), and leading words clipped
  on several clips.
- On art style: *"it doesn't really matter the style as long as we know the
  content description… you can intersperse the two styles colored pencil and
  pick the best one from each."*

Pages: [Evan — v11, the art from your notes](https://imageforge-q125.onrender.com/api/chatfeed/page/vIFt86TsWoV2AX8ReUb3) ·
[Pausing tool](https://imageforge-q125.onrender.com/api/chatfeed/page/s9rSf9bZo0AqnScX0OON) ·
[Sophie — pick the one (v1)](https://imageforge-q125.onrender.com/api/chatfeed/page/RoStBmr9AsI7vp1GmmdX) ·
[Sophie — round 2 (C and F crossed)](https://imageforge-q125.onrender.com/api/chatfeed/page/L0iH2PFnlmsSgEPZ9ptK)

### 4 · `cutting-blocks-artifact` (Aug 11–12)

The Compare-page artifact went v1 → **v14** in about 30 hours on her feedback,
and is the ancestor of the shipped **Cutting Blocks** tool (`blocks.js`,
`/blocks`). Behaviours she specified there: marks per line not per block, the
chain (meld), three states, a typed number to reorder, play buttons invisible
until a line is opened, undo/redo, no boxes drawn around words.

- [Cutting blocks v14 (s96)](https://imageforge-q125.onrender.com/api/chatfeed/page/ePKqeMJOATGCz7MJa9lA) — current
- [Evan — v12, rendered from your cut](https://imageforge-q125.onrender.com/api/chatfeed/page/JiGdZxZTIENaLtw5khRF)

### 5 · `evan-charlie-voice-clone` (Aug 14–15)

Source: her voice memo of **July 9, 2026**, *"Discussion on Coincidence and
Science"*, 33m44s — in the memo library and searchable. (Its auto-description
claims it is a conversation with Evan; that is `gpt-4o-mini` misreading
reported speech. She is alone throughout.)

An instant clone was built and **she rejected and deleted it**: *"I don't think
I like this. I think it should just be deleted because it doesn't sound like
me."* Recorded on main in `docs/voice-cloning.md` (line ~152) so it is not
rebuilt: the recording is her **reading a written piece in takes**, ~7 minutes
after silence removal, against the 2.63 hours of ordinary speech behind
*"Sophie — morning"*. Changing settings moved nothing.

Two pipeline bugs fixed and merged along the way: the prep script no longer
rejects mostly-silent recordings by mismeasuring them, and an `alimiter`
auto-level bug that was quietly adding ~3 dB is caught.

**Leftovers still in Storage: `voice-clones/evan-charlie/`** — the training
sample and test renders. She was asked whether to delete them and never
answered.

### 6 · `evan-film-local` (Aug 16)

Twelve beats drawn at `gpt-image-2 · medium`, $0.72. She said: *"It looks like
the girl character changes in each one."* Six faces were then drawn in the same
beat-1 scene varying only face and age; **she picked D — braids**; the six
beats she appears in were redrawn. Chat total **$1.44**.

- [Evan — 12 new beats v1](https://imageforge-q125.onrender.com/api/chatfeed/page/fdj9gfZb2YuEZfDttQAe) (superseded)
- [The girl — pick one (v1)](https://imageforge-q125.onrender.com/api/chatfeed/page/61Ggil0dGQbcQu1nADuz)
- [The girl, locked — v1 vs v2](https://imageforge-q125.onrender.com/api/chatfeed/page/IrslGtVeaQuQSMlvhMMr)

---

## Finding: the cut marks exist as two diverged copies

Measured 2026-08-16 from `GET /api/chatfeed/verdict?chat=<chat>&sheet=blocks-s96`.

When the Cutting Blocks page was copied from `evan-story-visual-summary` into
`cutting-blocks-artifact`, the saved marks were **duplicated, not moved**. Both
pages read and write a sheet named `blocks-s96`, each under its own chat.

- **`cutting-blocks-artifact` — 148 keys.** Contains her melds, her segment
  splits, the two typed rat lines (`n1`, `n2`) and her *maybe* marks.
- **`evan-story-visual-summary` — 42 keys, a strict subset.** **Zero** keys
  exist here that are not also in the other.
- **4 keys conflict:** `__order` (the running order of the whole film), `b38`,
  `b48`, `b37@11`.

**Timeline, from the threads:** `evan-v13.mp4` was rendered **Aug 12 00:54**.
The order corruption in the 42-key sheet was diagnosed and repaired **Aug 12
04:31** — 3h37m later. The mechanism recorded at the time: her page was open
while the data underneath was repaired, and its next save wrote the stale order
back.

Her report of the symptom, Aug 12: *"there were certain things that I thought
were in different places and then they were rendered in the final cut in places
I didn't think they were."*

**`forge-blocks` is empty** (queried 2026-08-16, 0 docs). The marks never
reached the shipped `/blocks` tool and exist only on those two verdict sheets.

**Two renders, measured with ffprobe:**

- `evan-v13.mp4` — **4:21.06**, 1000×1500, h264 + aac mono, 22.8 MB.
  Rendered from the 42-key sheet.
  `https://storage.googleapis.com/membry-df528.firebasestorage.app/story/films/evan-v13.mp4`
- `dd0557cb…mp3` — **4:24.46**, mono, whisper-verified, audio only.
  Cut from the 148-key sheet.
  `https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/nde-episodes/editor/page-cuts/dd0557cb544ff9baa2472014c0a7ae0127337122.mp3`

---

## Finding: none of the art is in git

Checked against `origin/main`, 2026-08-16. **The repo contains exactly two Evan
image files**, both references:

```
refs/evan-character.png
refs/evan-girl-character.png     ← merged today, PR #1296
```

There is no `docs/evan-film/` art folder and no committed beat art. **All ~150
images and all 35 renders live only in Firebase Storage.** The images the Aug 16
local session remade were uploaded to Storage and filed to the Assets tab; they
were **not** committed.

Sophie asked directly whether they got committed. They did not.

Related: **`rec339_final_draft.mp3` (9:08, the approved final draft) is in
neither bucket.** Searched `membry-df528` (`story/`, `memo-audio/`,
`voice-clones/`) and `deckfactory-43176` in full. Per the origin chat it lived
in the scratchpad, which is wiped, and was delivered as a July 11 chat
attachment. The 33m44s **source** memo is safe in the memo library; this
derived cut is not backed up anywhere.

---

## The art — 150 images across four chats

| chat | n | quality | notes |
|---|---|---|---|
| `audio-trim-voice-training` | 36 | mixed | Evan **and Charlie**; 30 have no MODEL·QUALITY caption, 32 no filed prompt |
| `oven-story-illustrations` | 4 | medium | complete: label, caption, prompt |
| `evan-story-visual-summary` | 86 | mostly **low** | what is in v13; 15 unlabeled background catches |
| `evan-film-local` | 24 | medium | newest; 12 beats v1 + 6 girls + 6 beats v2 |

The `low` quality in chat 3 follows her Aug 9 instruction that this was *"just
for me and will never become an actual frame, might as well do it as cheap as
possible."*

**The 15 unlabeled records in chat 3 and the 30 uncaptioned in chat 0 cannot be
filled in honestly by a later chat** — see the measurement in `CLAUDE.md`.
Leave them blank.

### Character references

- **Evan — `refs/evan-character.png`**, on main. Held consistent across every
  beat he appears in.
- **The girl was picked twice, in two chats, with different results.**
  - **Aug 10**, `evan-story-visual-summary`, a "Sophie A–F" round: she ♥'d
    **F** (*"thick auburn bob, round glasses"*; note: *"Jeans and Converse is
    boring, but they probably won't show anyway"*) and **C**. On the round-2
    follow-ups: *"we could use this I guess"* (F3) and *"I like the original
    better sorry"* (C3). **The 86-image set is drawn from this round.**
  - **Aug 16**, `evan-film-local`, a fresh six: **D, braids**, decisive.
    Banked as `refs/evan-girl-character.png`, merged today.
  - Her written description in `docs/evan-film-style.md`: *"curly brown hair
    in a high ponytail with loose strands hanging down around her face …
    that or braids."*

---

## Her art notes — ~30, on the chat-3 images

Read live with `GET /api/gallery/assets?chat=evan-story-visual-summary`. Most
were answered Aug 11. Verbatim, the substantive ones:

- *"OK for some reason in the real thing I was outside on my patio lounging"*
- *"this doesn't make sense. The tunnel isn't in physical reality. It's in the
  rats [minds]"* → *"let's try another version where the rats are actually like
  going down the tunnel"*
- *"it's supposed to be just like a normal sidewalk outside my house"* ·
  *"i'd like a couple more bystanders watching the rat but more casually"*
- *"sorry this might be a little too violent. I'd rather him be just like a
  little s[urprised]"* · *"he shouldn't be smiling"* · *"someone should be
  giving it to her and she can't be dodging it"*
- *"this is good, but they should probably both be the same size"*
- *"sitting on the couch with my mom and we saw the rat through the window"*
- *"we might take this actual beat out. I wanna lean towards the proof not
  heaven"*
- *"redo this in watercolor"*

---

## Open — asked and never answered

1. **The clone leftovers** in `voice-clones/evan-charlie/` — delete or keep?
2. **Low vs medium art** for the final film — never put to her.
3. **Which narrator is canon** — the Aug 10 bob or the Aug 16 braids.

All three are cards on
**[Evan — collected, and the three things only you can settle](https://imageforge-q125.onrender.com/api/chatfeed/page/4cbIMNZhOnXsYpWFjhBM)**
(chat `oven-film-evan-collection`, sheet `evan-collected`). Read her answers
with `GET /api/chatfeed/verdict?chat=oven-film-evan-collection&sheet=evan-collected`.

---

## Every link in one place

**Films** — `story/films/` in `membry-df528`, 35 renders. The lineage is
`evan-long-v1…v16` + `evan-short-v1…v16` (the long/short pair experiment,
Aug 10), then `evan-sheldrake-v1/2/3/5`, then `evan-v6 → v13`.

- newest: [`evan-v13.mp4`](https://storage.googleapis.com/membry-df528.firebasestorage.app/story/films/evan-v13.mp4) (4:21)
- audio from the live marks: [`dd0557cb…mp3`](https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/nde-episodes/editor/page-cuts/dd0557cb544ff9baa2472014c0a7ae0127337122.mp3) (4:24)
- earlier audio cut: [`7e3812df…mp3`](https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/nde-episodes/editor/page-cuts/7e3812df966ab59d6591c39f8c3832abe551d3f0.mp3)
- voiceover on the story doc: `story/vo-evan-1785468267805-v0hcf4.m4a`,
  `story/vo-charlie-1785468272797-ln5s9s.m4a` (Jul 31)

**Data**

- story board: `forge-story/evan`, project **membry-df528**, default database
- cut marks: `GET /api/chatfeed/verdict?chat=cutting-blocks-artifact&sheet=blocks-s96` (148 keys, live)
- stale copy: `GET /api/chatfeed/verdict?chat=evan-story-visual-summary&sheet=blocks-s96` (42 keys)
- assets per chat: `GET /api/gallery/assets?chat=<slug>&limit=300`
- `forge-blocks` — empty

**Repo**

- `docs/evan-film-style.md` — the art recipe
- `docs/nde-precise-cutting.md` — the cutter, and the noisy-pause section she
  pointed at by name
- `scripts/vo-remove-pauses.js` — the two-pass pause detector
- `docs/voice-cloning.md` — the rejected-clone record
- PRs: [#1296](https://github.com/sageryza/imageforge/pull/1296) (girl
  reference) · [#1299](https://github.com/sageryza/imageforge/pull/1299) (this
  collection)

**Chats** — reach any of them with
`GET /api/chatfeed/thread?chat=<slug>`: `audio-trim-voice-training`,
`oven-story-illustrations`, `media-asset-survey`, `evan-story-visual-summary`,
`cutting-blocks-artifact`, `evan-charlie-voice-clone`, `evan-film-local`.

---

*Collected 2026-08-16 from the live feed, Assets tabs, verdict sheets,
Firebase Storage and `origin/main`. Every count and duration in this file was
measured.*
