# Horns of the Goddess — the magic passages

Sophie asked for the parts of the Dolores Cannon audiobook where they talk about
magic. Both parts were already transcribed and sitting in `forge-nde-videos`
(ingested June 2026 through the NDE grabber), so nothing here cost a
transcription — the work was finding the passages and cutting them.

    IJZVNv5O6rA  The Horns Of The Goddess, Part 1   7:39:51
    wwQcSKbqfoQ  The Horns Of The Goddess, Part 2   6:15:51

## The three she named

All three are in Part 1. Text in `passages/`, audio in Storage under
`horns-passages/` (urls in `clips.json`).

| passage | span | length |
| --- | --- | --- |
| `unicorn-rainbow` | 7:08:34 – 7:14:13 | 5:38 |
| `cease-to-function` | 1:42:27 – 1:50:44 | 8:17 |
| `ceremonies-grove` | 4:56:58 – 5:08:45 | 11:47 |

**Boundaries were verified, not assumed** — the head and tail of each finished
clip were re-transcribed with whisper and checked against the words the
transcript says should be there. All six landed clean.

## The reel

`tools/horns/reel-beats.json` — nine beats cut from both parts and butted
together with a 0.45s breath between, 5:18, at `horns-passages/reel-v1.mp3`.
It runs wonder-first and then turns: everybody's a witch, the circle in the
grove, the bad back and the conceiving, the unicorn over the rainbow,
Stonehenge raised by music — then whatever you send out comes back, he called
down a storm, cease to function, and the oath.

Six beats come out of the three cut passages and three out of the flagged
list. **Every beat's edges were checked by re-transcribing the finished reel**,
which caught four tails cut mid-sentence ("I think I…", "Yes, there…") that
reading the timestamps alone would not have.

## The page

The three passages fold their text away behind a **Read it** tap, so the
flagged list is near the top rather than 4,000 words down.

It also **keeps her place** — position and the open/closed state of every fold,
saved together and applied folds-first on the way back, because restoring a
scroll offset against a different set of folds lands somewhere she never was.
The key is the page's own path, so a new version of the page starts clean.

The **jump arrows** (all the way up / all the way down) float **bottom-left**,
which is the only free corner: the injected pill owns the top-right, and every
item's note "+" is pinned in its own bottom-right.

Test: `node scripts/test-horns-page.js` — drives the real generated page
against the real pill in headless Chromium, 15 checks. It reloads the tab
rather than relaunching the browser, because headless Chromium flushes
localStorage to disk lazily and a relaunch lost the entry, which read as a
page bug when it was the harness.

## The other 49

`flagged.json` — 24 more in Part 1, 25 in Part 2, each with its span, what
happens in it, and a quote to identify it by. Found by two agents reading the
full 19,022-line transcript. None of these is cut yet.

## The tools

Run in this order; they need `FIREBASE_SERVICE_ACCOUNT` (Deck Factory).

    node tools/horns/pull.js     # transcripts out of Firestore/Storage
    node tools/horns/flat.js     # → timestamped text, one line per segment
    node tools/horns/dl.js       # the Part 1 audio, via the Admin SDK
    node tools/horns/text.js     # → readable paragraphs per passage
    node tools/horns/cut.js cuts.json   # cut + upload the clips
    node tools/horns/reel.js            # the reel, from reel-beats.json
    node tools/horns/upload.js <file>   # a finished file → Storage
    node tools/horns/page.js --post     # the Compare page

**`dl.js` exists because ffmpeg cannot reach the sandbox's HTTPS proxy** — the
same finding the clip library hit. ffmpeg reads the source off local disk; the
bytes come down through the Admin SDK. Cutting straight from the Storage url
fails, and the failure looks like an ffmpeg error rather than a network one.

`/api/search/clip-span` is the normal way to cut a span of an indexed
recording, but it caps at 180s and these passages run to 11 minutes.
