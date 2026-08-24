# What the old Story Room left behind — DO NOT FIX WITHOUT SOPHIE

**Status: DOCUMENTED, DELIBERATELY NOT FIXED (2026-08-24).**
Sophie's words: *"document this as something to possibly fix but that no chat
should fix it without me saying so."* She has seen the inventory below and has
NOT approved the repair. **Do not place beats, pin covers, or write narration
text onto any story pad on the strength of this document.** If you think it
should be done, say so in a reply and wait for her to say go. A chat that
"tidies this up" is rearranging her stories without being asked, and the
arrangement is the part only she can judge.

Everything here is a READ. Nothing in this file is a to-do list.

## The one-line version

The old Story Room (`forge-story`, membry-df528) was migrated to the story pads
(`forge-scratchpad`, deckfactory-43176) by following one field — `voiceover.url`
— and copying the art into each pad's **inbox**. Anything a story kept anywhere
else stayed behind: the narration line attached to each picture, the pinned
cover, the chapter headings, and (for stories with no voiceover) the story
itself.

## What HAS been fixed (2026-08-24, and it is done — don't redo it)

The audio half is across. Each pad now carries `description`,
`descriptionAudio` and `voiceover` copied from its old story doc, so the **About
this story** button appears in a story's header — before this it was hidden on
every one of the ten linked pads, because the page hides it unless one of those
three fields is set (`descbtn.hidden` in `scripts/gen-scratchpad.py`).

Specifically:
- **bath / "thought experiment"** — its 4:20 description recording and its
  50-second alt voiceover take were attached to the pad's `sources` (the
  waveform list) as `story-desc:` / `story-vo-alt:` entries. Only the main
  2:49 voiceover had ever come across.
- **Evan** — 5:25 description recording plus 2,294 characters of description
  text.
- **Wormsicles** — had NO pad at all (it has no voiceover, so nothing ever
  wrote a `story-vo:` link for the migration to follow). Pad
  `ry3TNU2FxfALtr2dqnDn` was created for it and carries its 10:04 description
  recording and 3,900 characters of description.
- Everything else got its `voiceover` object.

## What is still unported — the inventory

### 1. The narration line under each picture (the big one)

An old story beat is `{ vo, cards:[{label,status,url}] }`. The `vo` is what she
says over that picture. The migration copied `cards[].url` into the pad's inbox
and dropped `vo` on the floor. Five stories have a pad with an **empty canvas**,
their art waiting **in the inbox in the correct order**, and their words only on
the old doc.

| story | narrated beats | art in the pad's inbox | pad canvas now |
|---|---|---|---|
| Jonas & the Cookie Crumbs | 10 | 23 | 0 beats |
| Moon Milk | 12 | 12 | 0 beats |
| The Meteorite (`songs-aug-2`) | 12 | 26 | 0 beats |
| Charlie | 14 | 15 | 1 beat, no words |
| My Own Destiny (`controlling-my-own-destiny`) | 8 | 24 | 0 beats |

Real examples of the words that are not on any canvas:

- **Moon Milk**, beat 1 — *"She holds the bucket up to the smiling moon's tap;
  the first drop of milk falls."* → `scene01.png` `[approved]`
- **Moon Milk**, beat 3 — *"She walks home through the pines with the glowing
  bucket."* → `scene03.png` `[approved]`
- **Jonas**, beat 1 — *"Monday was the night Jonas brought cookies to his room.
  He ate them one by one in his bed, and they were delicious…"* → `e01_v2.png`
- **Jonas**, beat 3 — *"All the cookie crumbs had traveled around his bed. Some
  were on sailboats, sailing near his feet. Others took cruise ships…"* → five
  candidates, `x02_cruiseship_v5.png` the approved one
- **Charlie**, beat 1 — *"My friend Charlie had some bad things happen to him a
  while ago."* → `sv_cut_g_extra_charlie_br.webp`
- **The Meteorite**, beat 1 — *"Guys, I think I, like, cursed my ex-boyfriend,
  um, and I'm actually really scared"*
- **My Own Destiny**, beat 1 — *"Here's the honest truth. I didn't know I was a
  witch. Until one day I got so angry, I made something happen that I
  couldn't…"*

**The judgment call, and why this is hers.** The inbox order matches the story
order in all five (verified), so the mechanical part is safe. What is NOT
mechanical:
- A beat often has 2-5 candidate pictures (`status`: `approved` / `ok` /
  `draft` / `cand` / `candidate` / `miss`). Jonas beat 3 has five. Picking one
  is choosing what the story looks like.
- **Charlie has 3 beats whose only card is `miss`** — words with art that was
  never made. Placing the other 11 quietly drops those three lines, or leaves
  three wordless holes, depending on how it is done.
- `Shame`'s single beat reads *"No narration or art yet — project scaffolded,
  assets land here"* — a placeholder, not narration. Porting it verbatim would
  write scaffolding text onto her canvas.
- `you were in my dream last night` has one beat whose whole narration is the
  letter `h`.

### 2. Pinned covers — the shelf face she chose

Nine old stories pinned a specific cover image. The pads derive their shelf tile
from the first art on the canvas instead (`/api/scratchpad/cover` is the pad's
own pin and is unset on all of them). Measured — 7 of 8 checked now show
something other than what she pinned:

| story | she pinned | shelf tile shows now |
|---|---|---|
| Charlie | `sv_ni_charlie_mcd.webp` | `sv_cut_sb_charlie1_br.webp` |
| Evan | `sv_appr_spiderman_wall.webp` | `panel-1a.png` |
| Moon Milk | `scene01.png` | blank tile (no art on canvas) |
| Jonas | `e01_v2.png` | blank tile |
| My Own Destiny | `cover-controlling-my-own-destiny-…webp` | blank tile |
| Soul Leaves the Body | `cover-soul-leaves-…jpg` | blank tile |
| you were in my dream last night | `cover-you-were-in-my-dream-…jpg` | an inbox photo |
| Spellcasting | `sv_sp_candle_circle.webp` | same — the one that survived |

Two of those pinned files (`cover-controlling-my-own-destiny-1784595339429-ouvpzb.webp`
and `cover-soul-leaves-the-body-while-you-sleep-dre-1784853436548-58oqo3.jpg`)
exist in **no pad at all** — they are only on the old doc and in membry Storage.

Note the interaction: four of the blank tiles fix themselves the moment section
1 is done, because the canvas would have art to derive from. Doing covers first
would be the wrong order.

### 3. Chapter headings (`summary`)

Charlie and Evan carry a `summary` array — a label pinned to certain beats, i.e.
the story's chapters:

- Charlie: `beat 0 "Charlie: bad things happened"` · `beat 1 "Sometimes things
  are just bad"` · `beat 4 "But you must find a silver lining"` · `beat 8
  "Then: trauma, NDEs, aliens"` · `beat 12 "We come here to learn lessons"` ·
  `beat 13 "So there IS a reason, Charlie"`
- Evan: `beat 5 "The science: 45%, not 25%"` · `beat 11 "Proof: the light at the
  end"` · `beat 16 "The dying rat was the sign"` (three of its six are blank)

**A pad has no field for this.** There is nowhere to put it that isn't an
invention — folding it into the beat's text mixes a heading with her narration.
Moon Milk's `summary` is an empty array.

### 4. Evan's storyboard panels

Evan's 15 old beat pictures (`sv_cut_sb_evan1_*`, `sv_ni_eyes_in_mind`,
`sv_appr_*` …) are in **no pad anywhere**. Its pad has 21 beats of newer art
with 16 of them narrated, so these read as superseded rather than lost — but
they are the only art in the whole audit that is referenced nowhere on the new
side.

### 5. Prose `text`

`bath` (2,109 chars) and `Believing the Worst / Tolle` (3,303 chars) have a
`text` field. A pad has no equivalent. Both read as the same content as the
voiceover transcript, which is now on the pad inside the `voiceover` object, so
this is probably not a loss.

## Confirmed to be nothing — don't chase these

- **`draftFilm`** on Evan, My Own Destiny and The Meteorite: all three are
  abandoned jobs stuck at `{status:"stitching"}` from 2026-08-02 with no file.
- **`c`**: an empty archived story with no content.
- **The art itself**: apart from Evan's panels and the two cover files above,
  every picture referenced by an old story doc exists somewhere in a pad
  (almost always that pad's inbox). Nothing has been deleted.
- **Tolle's "description audio"** is the same file as its voiceover, so nothing
  was ever missing there. The About sheet collapses that case into one player
  by design.

## How to re-derive any of this

Read `forge-story` in **membry-df528** (`STORY_FIREBASE_SERVICE_ACCOUNT`) and
`forge-scratchpad` in **deckfactory-43176** (`FIREBASE_SERVICE_ACCOUNT`). A pad
is joined to its old story by a `sources[].src` of `story-vo:<slug>` (or, since
2026-08-24, `story-desc:` / `story-vo-alt:`). Match art by the filename at the
end of the URL — the same picture is referenced by identical filenames on both
sides.

## The lesson worth keeping even if this is never fixed

A migration that follows ONE field silently loses every story that does not have
that field, and every field that is not it. Wormsicles vanished entirely because
it had no voiceover to follow. Nobody noticed for months, because a story with
an empty canvas and a blank tile looks exactly like a story that was never
started.
