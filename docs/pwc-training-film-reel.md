# PWC Training Film No. 001 — the reel

Sophie's seven "People Watching Club: Official Training Film No. 001" cards cut
into a 9:16 reel, opened with a public-domain 3-2-1 Academy leader countdown.

**Live cut:** https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/reel-v1.mp4
(1080x1920, 30fps, 31.8s, silent — audio is chosen in Instagram.)

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

Rebuild: `bash scripts/pwc-reel-build.sh <dir-of-cards> <stock.mpg> <out.mp4>`.

## Card URLs

- 1 https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/cards/01-title-how-to-look-without-looking.png
- 2 https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/cards/02-the-mistake-looking.png
- 3 https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/cards/03-technique-1-middle-distance.png
- 4 https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/cards/04-technique-2-reflective-surfaces.png
- 5 https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/cards/05-technique-3-the-friend.png
- 6 https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/cards/06-emergency-1-eye-contact.png
- 7 https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/pwc-training-film/cards/07-certified-people-watcher.png
