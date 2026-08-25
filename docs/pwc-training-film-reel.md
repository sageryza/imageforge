# PWC Training Film No. 001 — the reel

Sophie's seven "People Watching Club: Official Training Film No. 001" cards cut
into a 9:16 reel, opened with a public-domain 3-2-1 Academy leader countdown.

**Live cut — narrated v2:** https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/film-v2-narrated.mp4
(1080x1920, 30fps, 2:03, -15.0 LUFS.)

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
