# Dreams — dream mystery style, single panel

Sophie's dreams, auto-illustrated. This pack is everything the last chat
made in the **dream mystery** style, the dreams behind each image, and the
exact prompts used.

## The scope you're picking up

- **Dream mystery style ONLY.** The watercolour style (sage sandy mirror)
  was tested against it and dropped. Don't reintroduce it.
- **Single-panel images only for now.** One image per dream.

## THE RECIPE — follow it exactly

`POST https://api.openai.com/v1/images/edits`

```
model              gpt-image-2
size               1024x1024
quality            medium
output_format      webp
output_compression 90
image[]            style-ref/dream-mystery.jpg
```

The prompt is the style prefix, then the subject, then the suffix:

**Prefix (verbatim, always):**
```
The FIRST attached image is a STYLE reference — copy its drawing style,
linework, hand-drawn texture, and muted palette EXACTLY, but do NOT copy its
content, subjects, or composition.
```

**Suffix (verbatim, for single-panel work):**
```
Render as ONE single full-bleed illustration — a single image, NOT a grid,
NOT split panels, no borders, no caption boxes, no text or lettering
anywhere.
```

### Why the suffix matters, and when it's wrong

`dream-mystery.jpg` **is itself a diary-comic page**. Without the anti-grid
line the model copies that layout and returns a comic instead of one picture
— so for single-panel work the suffix is load-bearing, not boilerplate.

The shipped suffix says "full-bleed **vertical** illustration". The word
*vertical* was dropped here because these render square. Put it back if you
move to a portrait slot.

**Known, and out of scope for now:** removing that suffix entirely and
handing the model a whole dream produces a multi-panel diary comic that
captions itself in Sophie's own words. It's very good. It is parked, not
forgotten — don't stumble into it by dropping the suffix by accident.

### Do not write style descriptions

The reference does the work. Every style block that has been tested made the
result worse. This is counter-intuitive and it is the house rule for this
reference — see `docs/evan-film-style.md` and `docs/nde-watercolor.md` in
`sageryza/imageforge`.

## Two ways to build the subject half — both are in here

1. **A scene brief** a chat writes after reading the dream (images 01-03).
   Tight and legible, but it silently throws away everything it didn't pick.
   The Halloween dream travels through six scenes; the brief kept one.
2. **The raw dream text, verbatim** (images 04-05). No brief, no editing —
   the dictation goes in as-is, "um"s and all. On a long dream this fuses
   every beat into one continuous dreamscape rather than picking a moment.

Image 03 and image 05 are the **same dream** built both ways. Compare them
before choosing an approach.

## What's in this pack

```
style-ref/dream-mystery.jpg    the style reference — attach to every call
images/                        5 single-panel images, all dream mystery
dreams/                        the verbatim dream text, one file each
manifest.json                  image → dream → exact prompt, plus the live URL
```

`manifest.json` carries both halves of the real prompt for every image. Use
it rather than reconstructing anything from memory.

## House rules that will bite you

- **Every image gets a label, a `model · quality` caption, and its exact
  prompt filed** at the moment it's made — the caption can never be
  backfilled by a later chat. `POST /api/gallery` and
  `/api/gallery/assets/prompt`. Run
  `node scripts/sweep-asset-captions.js --chat <your slug>` before finishing
  a turn that made images.
- **Never paraphrase a prompt** when filing it. Exact text or nothing.
- **A re-roll gets a new file.** The old one stays, relabelled
  "…v1 — superseded". Nothing is overwritten.
- **Don't put a literal `$VAR` storage URL in a shell command** — the Stop
  hook scans raw tool activity and files a junk tile for it. This happened
  three times and the tiles need an admin delete.
- Sophie reviews in the **Assets tab**, one labelled image at a time. No
  contact sheets, no link dumps in replies.

## Where things live

- Repo `sageryza/imageforge`, branch `dream-feed-art` —
  `dream-feed/` holds every render, and `scripts/dream-*.js` are the
  render scripts (`dream-style-diff.js` is the cleanest starting point).
- Her dreams: Firestore `forge-dreamapp` in **deckfactory-43176**, one doc
  per dream. She has 8. **The collection also holds other people's dreams —
  only hers are in this pack, and only hers should be rendered.**
- The dream app itself is `dreamapp.js` (`/api/dreamapp`, page at `/dreams`).
  Its existing illustrator uses the multi-panel zine engine
  (`movies.js makeDreamPagesV2`) — that is the thing this work is exploring
  an alternative to.
