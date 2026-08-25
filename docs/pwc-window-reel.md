# PWC ep006 — "The building across the street"

Sophie's concept, 2026-08-25, verbatim: *"I kind of wanna do another reel for my
People Watching Club. That's like if you were able to watch like a building from
across the street and then you somehow were able to see inside each person's
window into their lives."*

**It is an episode of the series already running in `stock-footage-backstories`**
(ep001–ep005), built with that chat's own `scripts/pwc-reel.js` — real stock
footage, graded black-and-white, freeze-frames annotated in hand-drawn ink, an
end card. Plan: `scripts/pwc-reels/ep006-windows.json`. No model call; ffmpeg and
sharp on our own box, so the episode costs nothing.

## Why a building suits the form better than a street

Every earlier episode invents a backstory for a stranger walking past. A building
of lit windows does the same trick with the club's actual fantasy — you cannot
see in, so the club makes it up — and it comes with a real, filmed payoff nobody
had to write.

**The payoff is IN THE FOOTAGE, not invented:** two people stand on the bright
balcony from the first frame, and between t=22s and t=26s one of them goes
inside. So her own device from the same day — *"but look closely… I bet you
missed that didn't you?"* — lands on something that actually happened while the
viewer was reading captions about somebody else.

## The footage

Pexels **"A Building with Lights On at Night"**, video id `18029861`, free
licence: `curl -L -o windows.mp4 https://www.pexels.com/download/video/18029861/`
(saved beside the plan as `windows.mp4` — gitignored like every other episode’s source). 2560x1440, 45s, locked off with a
slow zoom-out. The grade crops a **810x1440 portrait window out of the middle**
and scales to 1080x1920, so every coordinate in the plan is in output space.

**The zoom-out moves everything up the frame as the clip runs**, so each freeze's
marks are read off that freeze's own frame — never copied between beats. Render
`--stills` and look before rendering the reel.

## The beats

1. **0:02 — establish.** *8:47 PM. / Twenty-two apartments. / Twenty-two shows.*
2. **0:07 — Marcy, 6B**, circled top-left. *Has had the fridge open for nine
   minutes. She is not hungry. She is thinking about an email.*
3. **0:14 — Denise and Ray**, the bright balcony, both of them in shot. *Eleven
   years. They came out to look at the sky. They are discussing the dishwasher.*
4. **0:20 — 4C**, the impossible one. *Nobody lives in 4C. The light has been on
   since 2019. We have asked around.*
5. **0:26 — the turn.** Same balcony, ONE person. *Look again.* → *Ray left
   ninety seconds ago. I bet you missed that, didn't you?*
6. **End card** — a drawn window, then *people watching club* / *make up your own
   stories* in EB Garamond.

Plausible → plausible → impossible → the real thing, which is the escalation
`pwc-reel.js`'s own header describes.

## Two things that were wrong in the first cut, and why

- **A colour joke cannot survive a black-and-white grade.** Beat 4 was "the green
  room, 4C — that is just the colour the room is". The reel is graded `hue=s=0`,
  so the one word the joke rests on is not on screen. Rewritten to a fact the
  picture can show: a window that is simply always lit.
- **An arrow must land on the thing it names.** Beat 2's arrow ran from the
  circled window down to an unrelated dark one. The circle already says which
  window; the arrow came off. Beat 5 keeps its arrow because there the mark is
  *this one, the one that used to have two people in it*.

## Fonts

`~/.fonts` needs **Permanent Marker** (the ink), **Caveat** and — new for this
episode's end card — **EB Garamond**, all from `google/fonts`, then `fc-cache
-f`. Permanent Marker is under `apache/`, not `ofl/`.

## Costs

Nothing. No model call. The only paid thing in the neighbourhood is a voice take
if the series ever adds narration (~20-30¢ on ElevenLabs, the ep001 figure).

## Production state

- **ep006 v1: rendered and delivered 2026-08-25.** Pinned in the
  `people-watching-club-reel` chat.
- **Not done, and deliberately hers to call:** the elegant end card + logo +
  tagline she asked `stock-footage-backstories` for on ep005 is being designed
  there — this episode's end card is its own drawn window and should be replaced
  with whatever that chat settles on, so the series has ONE end card.
- **No voiceover.** ep002-ep005 are caption-only; the 1950s announcer (ElevenLabs
  **Clyde**) was used on ep001 and is still the pick if she wants one here.
