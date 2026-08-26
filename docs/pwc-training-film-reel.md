# PWC Training Film No. 001 — the reel

Sophie's seven "People Watching Club: Official Training Film No. 001" cards cut
into a 9:16 reel, opened with a public-domain 3-2-1 Academy leader countdown.

**Live cut — v4, moving camera:** https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/film-v4-moving-camera.mp4
(1080x1920, 30fps, 1:41, -15.0 LUFS.)

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
