# PWC Training Film No. 001 — the reel

Sophie's seven "People Watching Club: Official Training Film No. 001" cards cut
into a 9:16 reel, opened with a public-domain 3-2-1 Academy leader countdown.

**Live cut — v10, tight open + clean marks:** https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/film-v10-tight-clean.mp4
(1080x1920, 30fps, 1:26. v7's audio with two title-gap splices; grain and
flicker halved; 16 marks.)

**v9, the markup redone from the images:** https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/film-v9-fresh-marks.mp4

**v8, v7's marks re-timed only:** https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/film-v8-marks-on-words.mp4

**v7, tight open (marks ran late):** https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/film-v7-tight-open.mp4

**v6, full title line, 1:33:** https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/film-v6-white-ink.mp4

**v5, red ink, 1:42:** https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/film-v5-clyde-ink.mp4

**v4, Bill, no markup, 1:41:** https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/film-v4-moving-camera.mp4

**v3, hard cuts between framings, 1:50:** https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/film-v3-camera.mp4

**v2, narrated, static cards, 2:03:** https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/film-v2-narrated.mp4

**v1, silent, 31.8s:** https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/reel-v1.mp4
Superseded but kept — it is the cards at reel pace with no narration.

## THE ORDER — the zip was reversed, and the cards say so themselves

The cards carry their own numbering, so the order is not a judgement call. The
zip's alphabetical filename order ran the certificate near the front and the
title card in the middle; read off the artwork it is:

| # | Card says | Original filename |
|---|---|---|
| 1 | Official Training Film No. 001 — HOW TO LOOK WITHOUT LOOKING | `People Watching Club: Retro Training Film.png` |
| 2 | THE MISTAKE — "LOOKING." | `Vintage Café Etiquette Training Film.png` |
| 3 | TECHNIQUE No. 1 — THE MIDDLE DISTANCE | `The Middle Distance Café Training Film.png` |
| 4 | TECHNIQUE No. 2 — REFLECTIVE SURFACES | `Retro PWC Training Film Poster.png` |
| 5 | TECHNIQUE No. 3 — THE FRIEND (stamped FAIL) | `The Friend Technique Fails.png` |
| 6 | EMERGENCY PROCEDURE No. 1 — EYE CONTACT | `Emergency Eye Contact Procedure.png` |
| 7 | CONGRATULATIONS — CERTIFIED PEOPLE WATCHER | `Certified People Watcher.png` |

**The filenames are useless for ordering and always will be** — none of them
carries a number, and three of them describe the picture rather than the card's
place in the film. The cards are re-uploaded under numbered names so this never
has to be re-derived:
`pwc-training-film/cards/01-…` through `07-…` (see the URLs at the bottom).

## The countdown

archive.org **`IMB_SF_R30_C3`** — "Film Countdowns", in the `stock_footage`
collection, **CC-BY 3.0**, four Academy leaders with a film-grain filter already
on them. Source is 720x480 MPEG-2, SAR 8:9.

**The usable 3-2-1 is at 23.45s, 3.2s long** — measured frame by frame, not
guessed: the 4→3 wipe runs 23.50-23.75 and "3" reads clean at 23.80, each digit
holds ~1s, and the "1" wipes to black from ~26.1. Taking it to 26.65 ends the
clip on that wipe, so the cut to the title card lands on black the way a real
leader hands off to picture. **The stock is silent** (measured with `astats` —
every window is `-inf`), so there is no Academy beep to preserve.

The other candidate, `countdownleader`, is a nicer-looking transfer but carries
**no licence and no rights statement** and is filed under
`classic_tv_commercials_emperor` — ripped from a 1959 TV episode. Not used.

## The treatment

Each card sits on a blurred, darkened copy of itself (that is what fills 9:16
without cropping a poster that was drawn to be read whole). Over the whole
concatenated reel: gate weave (a ±3px drift from two out-of-phase sines, cropped
from a 1104x1962 upscale), a small brightness flicker, temporal film grain, and
a light vignette. **The vignette is `PI/7`, not the `PI/5` default** — at the
default the sepia cards read noticeably dimmer than the artwork.

Durations: countdown 3.2 · title 2.6 · mistake 4.0 · T1 4.6 · T2 4.6 · T3 4.2 ·
eye contact 4.6 · certificate 4.2. The three densest cards get 4.6s because they
carry diagram labels that have to be read at phone size.

Rebuild the silent v1: `bash scripts/pwc-reel-build.sh <cards> <stock.mpg> <out.mp4>`.

## v2 — the narration, the music and the sepia

Sophie's own shooting script (mid-century educational-film narrator, faintly
cheerful 1950s music, projector hiss) turned the reel into a 2:03 film.

**Narrator is ElevenLabs `Bill` (`pqHfZKP75CvOlQylNhV4`) on
`eleven_multilingual_v2`** — v3 is banned house-wide, and `<break/>` only works
on v2 anyway. Bill is the one premade voice labelled male / old / american /
advertisement. **That pick was made off the LABEL, not by listening** — three
alternates were rendered on the same line so Sophie can swap: `voice-peter.mp3`,
`voice-eric.mp3`, `voice-daniel.mp3` beside `voice-bill.mp3` in
`pwc-training-film/`. Swapping is `PWC_NARRATOR=<id> bash scripts/pwc-film-vo.sh`.
Stability is **0.7**, high on purpose — her direction is "do not perform the
jokes". The watcher's whispered line is a second, younger voice (`Will`) at 0.45,
because it is the one line in the film that is not the narrator.

**The music is three actual Coronet educational films**, all explicitly public
domain via Prelinger: `GoodTabl1951` (Good Table Manners), `SelfCons1951`,
`Developi1951`. Their **title sequences are music-only**, which is where the bed
comes from — 0.4-15s, 0.4-21s and 0.4-21s — and `GoodTabl1951`'s "The End" card
at 611.2s is the triumphant finish her script asks for.
**Each opening was checked for speech with Whisper before use.** Whisper answers
music with a hallucinated "Thanks for Watching" or a `♪♪`, and that — rather than
a transcript — is the confirmation there is no narration to inherit.
The three beds are sequenced rather than looped: one 15s bed under two minutes
would pulse audibly at the loop point.

**Projector sound is synthesised, not sampled** — pink noise band-passed
2-8.5kHz for tape hiss, plus brown noise under 95Hz with a 24Hz tremolo for the
motor and shutter. A sampled loop would repeat; noise never does.

Balance, measured: narration ~-27dB mean, the bed between lines ~-41.5dB, i.e.
about 14dB down. The whole film is normalised to **-15.0 LUFS** for social; the
raw mix was -23.7, which is roughly 10dB under what a phone expects.

**The sepia is a 60% mix toward the classic sepia matrix, applied to the whole
film.** Its real job is the LEADER — the cards were already sepia and the
countdown is neutral B&W, so untreated it reads as a different film spliced on
the front. Measured: it does not darken the cards (a card sits at YAVG 65
against v1's 55, with the untreated source at 77) — the warmth reads as darker
than it is, which is worth knowing before anyone "fixes" the brightness.

**ffmpeg cannot fetch archive.org from inside a session container** — it does not
honour `HTTPS_PROXY`, and it fails by printing its banner and stopping, with no
error. Curl the file down first.

Verification that matters more than a green build: the finished film's audio was
sliced per card window and transcribed, confirming each section's narration sits
entirely inside its own card. Picture drift from frame rounding is ≤0.2s and
always pushes the line further INTO the card, never across the join.

## Card URLs

- 1 https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/cards/01-title-how-to-look-without-looking.png
- 2 https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/cards/02-the-mistake-looking.png
- 3 https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/cards/03-technique-1-middle-distance.png
- 4 https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/cards/04-technique-2-reflective-surfaces.png
- 5 https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/cards/05-technique-3-the-friend.png
- 6 https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/cards/06-emergency-1-eye-contact.png
- 7 https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/cards/07-certified-people-watcher.png


## v3 — the camera, the pacing, and the hole in the music

Three asks off v2, all of them things only she could have caught.

### The camera moves — 38 shots cut to the words

Her ask: "it would be nice if the camera could sort of jump to different parts
of the image to keep the viewers focus so they don't have to look at the whole
image." These are dense posters on a phone; a static hold asks her audience to
read a diagram at thumbnail size.

`scripts/pwc-film-shots.py` is the whole plan and is the file to edit — a rect
per shot in fractions of the card, plus the time that shot ends.
`pwc-film-render-shots.py` renders it.

- **Cuts land ON the word because the times are MEASURED, not guessed.** Every
  narration clip was run through Whisper with segment (and, for the graduation
  card, word) timestamps, and each shot's end time is one of those stamps. That
  is the whole reason the montage on "gestures, habits, mysteries, and extremely
  minor dramas" hits one little labelled drama per noun.
- **A shot keeps its OWN aspect ratio and is fitted into the 1080x1800 box over
  the same blurred card.** The first build kept every crop at the card's aspect,
  and it failed twice over: it cannot isolate a wide band — "LOOKING.", the
  30-degree diagram, "NOTICE THINGS." — and every detail crop sliced the card's
  headline mid-word, which reads as a mistake rather than a choice. The
  background is the same blurred full card in every shot of that card, so only
  the framing moves.
- **`MAX_UP = 2.45` is a hard ceiling on upscale**, and shots that ask for more
  are widened around their centre automatically (the renderer names them). The
  cards are only 1024-1122px wide, so a tight crop on a small label — the
  certificate seal, "OBSERVE DON'T INTERVENE" — would otherwise be mush.
- **Every card opens on a wide** (except the graduation card, which opens on
  CONGRATULATIONS!) so the headline is read before the camera goes in.
- Each shot drifts slowly inside `OVER = 1.05` of headroom, direction
  alternating by index, so no shot is a dead still.

### The narration

**`PWC_TEMPO=1.12`, applied with `atempo`** — she asked for "a bit faster …
but just keep the pitch the same", which is atempo by definition. It runs
after the render, so every clip and every `<break/>` shortens by the same
factor. 1:48 of narration became 1:35.

**The pause on "You were simply looking at… something else." was cut from
1.8s to 0.85s** at her ask. Measured with `silencedetect` rather than Whisper —
Whisper's word timestamps snap shut across a silence and report the gap as
0.00s, which would have made the fix look like it did nothing. Real gap now
0.97s, from ~1.95s.

### The hole in the music — she was right, and it was a bug

She asked "the music doesn't play till the end there's silence towards the end.
Is that intentional?" It was not. v2's bed was four 20.5s pieces starting at 12s
and the last ended at **94s**, with the closing sting at 116.3 — so the whole
graduation card, the longest in the film, carried narration over nothing but
projector hiss.

The bed now runs continuously to the sting, and **the pieces are spaced 15s,
not their full 20.5s**: a piece's fade-out begins at 17.5, so the next must be
fully up by then. At 20s spacing the handover measured **-61dB twice** — an
audible hole at every seam, which is the same bug in miniature.

Verified by rendering the bed with the narration and projector muted and
measuring every 4s: -41 to -48dB unbroken from 6s to the sting.

### Why her replies looked like they were not posting

Not a hook fault and nothing was lost — all seven messages were in the feed.
`hiddenAt` is a self-clearing stamp: `POST /reply` sets it the moment she sends,
and the chat leaves her list until the reply lands. This chat's turns run 7-30
minutes because of video encoding, so any time she looked mid-turn the chat was
behind the HIDDEN bar. Worth knowing before diagnosing a "silent chat" that is
merely a slow one.


## v4 — a camera that MOVES, and the Chicago reference

Sophie pointed at the chat she nicknamed **Chicago** (`stock-footage-backstories`,
ep005): "the way that they did it is they actually zoomed around so they show
the full page and then they zoom in on certain areas **and you can see the
zoom**." v3 hard-CUT between framings; that reel pushes continuously, and the
movement is the point.

**Each card is now ONE shot with a keyframed camera**, not N cut segments.
`scripts/pwc-film-render-cards.py` builds, per card, a 9:16 **page** (the blurred
backdrop with the card fitted into it) and runs a single `zoompan` path over it:
full page first, then a visible push into each area as its beat lands.

- **The page is rendered at 2x the output (2160x3840).** `zoompan` rounds its
  x/y to whole INPUT pixels, so at 1x a slow push visibly stair-steps; at 2x the
  step is half an output pixel.
- **`zoompan` has no `t`.** Its variables are `on` / `in_time` / `out_time` —
  using `t` fails with "Undefined constant", which is what the first build did.
  The path expressions are written against `on/FPS`.
- **Moves ease, they do not snap.** Each transition is a smoothstep over
  `MOVE = 0.9s`, starting `LEADIN = 0.35s` before its beat so the framing
  ARRIVES on the word rather than chasing it. A move is never allowed under
  0.45s — she asked to *see* the zoom, and a 0.06s snap is a cut with extra
  steps (the first build produced exactly that on the end-of-card pull-outs).
- **Beats are stored in CLIP time, not card time** (`shots.py`), with the tempo
  they were measured at. That is what let the narration speed up again without
  re-cutting the camera by hand: the builder rescales every beat by the clip's
  own old/new duration ratio.
- **A full-bleed 9:16 window cannot isolate a wide band the way v3's cuts
  could.** The cards are 2:3 and 4:5, so a window framing a wide strip is
  necessarily much taller than the strip. That is the honest cost of the move
  she asked for, and it is why v3 is kept.
- **The graduation montage was cut from four stops to three.** Four nouns in
  3.4s with 0.9s moves read as constant motion with nothing held; measured on a
  frame sheet before it shipped.

**The narration is faster again — `PWC_TEMPO=1.25`** (was 1.12), her second ask
for it. 1:48 of narration at 1.0x is now 1:25, and the film is 1:41.

**Finding the reference:** the chat is `stock-footage-backstories`; her nickname
lives on the registry doc as `displayName`, which is the only place "Chicago"
appears. `GET /api/chatfeed` returns the registry under **`chats`**, not
`registry`.


## v5 — Clyde, hand-drawn markup, and her five timestamped notes

Sophie leaves notes ON the film in its Assets tab, stamped with the second they
refer to. **Read them with `GET /api/gallery/assets/notes?chat=<slug>` and reply
on the image** — they are a thread, not a one-way drop.

### The narrator is Clyde

`QMJTqaMXmGnG8TCm8WQG` — an ElevenLabs voice-library voice ("a vintage male
announcer"), found by the `people-watching-club-reels` chat, where she settled
it herself: *"Clyde is perfect."* It renders straight from the TTS endpoint by
id with nothing added to the account. His natural pace matches Bill's to within
0.2%, so `PWC_TEMPO=1.25` carried over unchanged.

**Finding a voice another chat picked:** search the feed
(`GET /api/chatfeed/search?q=`), then read the thread — the id is in the
preview URL's `/voices/<id>/` path, which is the only place it appears.

### The hand-drawn markup

Her note: *"maybe draw some sloppy circles over what you're talking about in
white or red ink."* 13 circles and one arrow, red, in `scripts/pwc-film-ink.py`
(the strokes) and `pwc-film-marks.py` (what gets circled, and when).

- **The markup is composited into the PAGE, before the camera.** That is what
  makes a circle zoom and drift with the thing it is circling instead of
  floating over the frame.
- **It draws itself on** — 14 stage PNGs of a growing stroke, fed as an image
  sequence and delayed onto the timeline with `tpad=start_duration=`. Overlaying
  a stream that simply starts late stalls the graph; padding the front with
  transparent frames is what works.
- **Every stroke is seeded**, so a re-render wobbles identically. A circle
  overshoots past its start and the radius breathes on three low-frequency
  sines; three passes at slightly different offsets and alphas read as ink
  rather than as a vector.
- **Place marks against the ART, not from memory** — every one was drawn onto
  the real card and eyeballed before a frame was rendered.

### Her five notes, and what each became

- **[0:28] "hold for a beat on the zoom out"** — every card's pull-out now
  arrives 1.5-3.7s before the card ends instead of landing on the cut.
- **[0:35] "the music here is perfect"** — untouched, deliberately.
- **[0:43] "sloppy circles ... in white or red ink"** — above. Red, because the
  cards already use white for their own callout lines and the printed FAIL is
  red, so red reads as markup rather than as part of the artwork.
- **[1:00] "a fail sound effect and stamp the fail on yourself"** — a
  synthesised rubber-stamp thud (68Hz body + 155Hz thunk + a filtered noise
  click, all exponentially decayed) plus a decaying jolt on the camera at the
  same instant. **The FAIL itself is printed on her artwork**, so it arrives
  with the camera rather than stamping down; stamping a real one means painting
  the printed one out first, which is hers to ask for.
- **[1:15] "when it says NOW ... that's when you should zoom out and it should
  show what you're actually talking about"** — card 6's "now redirect" is a
  pull-out onto the step AND the object panel together, and only then a push
  into ABSOLUTELY NOTHING with an arrow.

Plus her main note, *"zoom in on what you're talking about and include the whole
thing"*: the three-feet shot on card 3 was framed on the gap alone and is now
framed on him, the subject and the measure together.


## v6 — what "a bad circle, not a weird shape" actually meant

Sophie on v5's markup: *"make the circles not like weird faded just normal and
try them in white and maybe not quite so thick just like a bad circle not like a
weird shape."* Four separate faults in one sentence, and the diagnosis matters
more than the fix:

- **"weird faded"** was not opacity — it was the THREE overlapping passes at
  alpha 235/120/90 that were supposed to read as ink. Overlapped and offset,
  they render as a fuzzy double-stroke. One solid pass at full alpha is what
  reads as a pen.
- **"not like a weird shape"** was the geometry. The circle looped **1.14
  turns** past its own start with three wobbles at up to 11% of the radius, so
  it came back as a spiral-ish blob. It closes at **1.04 turns** now with two
  wobbles under 3%, plus a small per-axis bias — round, visibly hand-drawn, and
  it just crosses its own start, which is the actual tell of a fast circle.
- **White**, not red. The cards' own callout lines are white, so white markup
  reads as belonging to the film rather than to a different one.
- **Thinner**: `INK_W` 20 → 15 at page scale. Dropping the extra passes made it
  thinner again on its own.

**The read is `PWC_TEMPO=1.40`** (her third ask for faster), taking the film to
1:33. Because beats are stored in clip time with their measured tempo, this was
one number and a re-render — no beat was re-measured and no mark was re-placed.

**One constant had to become a derivation:** the whisper on the friend card was
placed 2.54s before the narrator, a number true only at 1.25x. It is computed
from the whisper clip's own length now, so the two lines cannot drift apart the
next time the tempo moves.


## v7 — the open

*"make the very beginning faster get rid of official training, film, less
pauses, faster voice."* Four cuts to the same 6.7 seconds:

- **"Official Training Film Number One" is gone from the narration.** It still
  reads on the title card, where it costs nothing.
- **Both `<break/>`s inside the title line are gone.** It is one unbroken
  sentence now.
- **The title card's own lead and tail drop** 0.50/0.80 → 0.30/0.50.
- **`PWC_TEMPO=1.48`** (her fourth ask for faster).

Title card 6.68s → **3.86s**; the film 1:33 → **1:27**, and the first real line
lands about 8 seconds in.

**The 3-2-1 leader was left alone** — it is 3 of those seconds and it is the
thing she asked for in the first place, so shortening it is hers to call.

**When the title line's TEXT changes, its `old` duration must be set equal to
its `new` one** in `vodur.json`. `old/new` is the beat-rescaling ratio, and it
only means anything while the words are the same; card 1 has no beats to
rescale, but a stale ratio there would be a trap for the next card that does.

## v8 — the marks land ON the words (the inverted rescale)

Sophie, handing the chat off (the previous one ran out of Fable usage): *"their
circles just weren't really making sense with the story."* She was right, and it
was ONE line: `pwc-film-render-cards.py` rescaled beats by `old/new` where a
position measured on the old (slower) clip maps to the new one by **`new/old`**.
So from v6 on, every camera move and every ink mark ran ~1.18x LATE in clip
time (at 1.48x): the early beats nearly survived, the late ones drifted seconds
— measured off v7's own frames, the window was still circled on "Mirrors are
suitable", the mirror still circled on "attempt the spoon" — and three things
fell off the END of their cards entirely and never rendered at all: the spoon
circle, the "absolutely nothing" arrow, and card 7's final pull-out + NOTICE
THINGS push. Her [1:15] "on NOW zoom out" fix from v5 was also silently gone.

- **The fix is the one line** (`ratio = new/old`) plus honest `vodur.json`
  values; every beat number in `shots.py`/`marks.py` was already right — they
  are v5's Whisper measurements, and v5 (ratio 1) is the version her notes
  approved.
- **Her unactioned v5 note, now done: "[1:07] circle remain calm, not the
  face."** The circle sits around the words "STEP 1: Remain calm." and draws on
  as Clyde says "Remain calm." The approved-smile face is no longer circled —
  the camera already points at it on "assume a normal facial expression".
- **The audio is v7's, copied** (`-c:a copy`) — narration, music, hiss,
  loudnorm untouched. Only the picture was re-rendered.
- **The previous chat's work dir died with its container**, so the card
  boundaries were re-derived from v7 itself: scene-change detection plus frame
  tiles for the ambiguous cuts (19.4667 / 30.0 / 41.5 / 49.4 / 65.4333 /
  84.7333), narration word times re-measured by Whisper on v7's own audio, and
  the segment frame counts chosen to reproduce those cuts exactly, so the
  reused track lands where it always did. The countdown leader was re-fetched
  from archive.org (`IMB_SF_R30_C3`, CC-BY 3.0 — curl, not ffmpeg).
- Verified before shipping by extracting frames at each word Whisper stamped
  and checking the right thing is circled while it is being said.


## v10 — her five notes on v9

*"less pause after 'pwc presents', less pause after 'without looking' ... just
go right in"* — done in the AUDIO, not by re-rendering the voice: two splices
in v7's finished mix, every cut point inside measured -22dB quiet (keep
[0,4.575) + [4.7417,6.6334) + [7.4667,end) in v7 time), 30 frames out in
total. The picture absorbs the same frames in the title's tail (0.50→0.0667)
and card 2's lead (0.50→0.10), so nothing downstream moved. Measured on the
finished v10: the presents→How gap is under 0.1s and the title→card-2 gap is
0.41s. The film is 1:26.

*"cut down on the grainy flashing a little"* — the flicker amplitudes halved
(0.018/0.011 → 0.008/0.005) and the grain from `noise=alls=4` to `alls=2`.
The sepia, weave and vignette are untouched.

*"end notice things crosses out, shud underline"* — the line sat at y 0.968,
which is INSIDE the letters (the text runs 0.944-0.974); it is at 0.979 now,
between the baseline and the box edge at 0.982, and `line_pts`'s bow dropped
to ±0.6% of length — a ±2% bow climbs out of a 12px channel. Underline a
printed word only after measuring its baseline; eyeballing a fraction is how
this shipped as a strike-through.

*"a couple circles were a little unnecessary"* — three came off, each
redundant with the camera: the 30-degree diagram label (the caption box
already says the line), card 6's STEP 2 (the pull-out already frames it, and
the arrow follows seconds later), and the WE-DON'T-INTERFERE seal (the camera
is fully pushed into it). 16 marks stand.

## v11 — the hook tightened, and the FAIL slams on

**The live cut:** https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/film-v11-stamp-slam.mp4 (1:26)

**The pause she heard inside the title line was REAL and Whisper hid it.**
"How to Look ... Without Looking" carried a 0.23s hole between "Look" and
"Without" — Clyde's own phrasing, no break tag anywhere — and Whisper's word
stamps snapped shut across it (Look 5.16-5.46, Without 5.46-5.90), so every
timestamp-based check said there was no pause. `silencedetect` found it in
one pass. A third splice takes 6 frames out of it, same discipline as the
other two: both cut points inside measured quiet, the picture shortened by
the same frames in the title card. This is the doc's own v3 lesson
("Whisper's word timestamps snap shut across a silence") — trust
silencedetect for gaps, always.

**The FAIL stamps itself on now** (her ask — the card is ChatGPT's, so
redrawing was allowed, and "we have a good bad thing for the Tinder that you
could look into"):

- **The clean plate** is a gpt-image-2 `/edits` inpaint (quality high, ~17¢,
  the one paid step): the original card plus a mask over the stamp region
  only, and the model's pixels composited back ONLY inside that mask — the
  rest of the card is her original, untouched. Filed in the Assets tab with
  its prompt. Note: **gpt-image-2 rejects `input_fidelity`** (that was a
  gpt-image-1 parameter); the mask-and-composite does the same job.
- **The stamp art is HER OWN, not a redraw** — extracted from the original
  card by red chroma (`r-g > 45 & r-b > 55`, softened near strong pixels;
  the stamp is the one saturated-red thing on a sepia card). So the settled
  final frame is pixel-for-pixel the card as it always looked.
- **The animation is the judge deck's GOOD/BAD stamp** — her Decision Deck v3
  values: in at 2.5x and blurred, invisible until it is nearly down, an
  overshoot, settled in 560ms (`scripts/pwc-film-stamp.py`, 17 frames).
- **Contact lands on the thud already in the mix** — the v5 fail-thud was
  placed at the camera's FAIL arrival (beat 1.84), so the stamp uses the same
  beat: camera, sound and slam are one instant, nothing re-timed.
- It rides the same page-space overlay as the ink, so the camera's push keeps
  it registered to the card.
