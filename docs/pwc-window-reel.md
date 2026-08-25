# People Watching Club — "The building across the street" (reel)

Sophie's concept, 2026-08-25, verbatim: *"if you were able to watch like a
building from across the street and then you somehow were able to see inside
each person's window into their lives."*

One reel, vertical, ~28-32s. **The grammar is: wide facade → punch into one
lit window → back out.** Each window is one life and one deadpan line. The
turn at the end is her own club rule — someone looks back.

## Why this shape

The account's thesis is already written down in its own decks: *who's watching
who* (`through-the-glass`), and **Rule 2 — if they catch you, you are now the
watched** (`club-rules`). A building of windows is the cheapest way to tell ten
tiny stories in half a minute, and the reversal at the end is the club's whole
joke landing on the viewer.

## Shot list (v1)

Each beat: what is drawn, and the line that is **typeset over it at edit time**
— never drawn into the picture. The Dreamy tail bans text in the image, and a
caption she may want to reword must not cost a re-draw.

| # | Window | Drawn | On screen |
|---|---|---|---|
| 0 | OPEN | apartment building at dusk from a dark window across the street, every lit window a different life | 8:47pm. the building across the street turns on. |
| 1 | 3F | a man at a microwave in a dark kitchen, mug in hand | fourth trip to the microwave. same cup. |
| 2 | 2B | a woman dancing alone in a living room, big headphones | no music that i can hear. she is having the time of her life. |
| 3 | 4A | two people among furniture parts, one holding a plank, one lying down | hour two. the instructions are on the floor. so is he. |
| 4 | 1C | a man talking to himself in a mirror, hands moving, jacket on | he keeps starting over. so it is an apology, not a toast. |
| 5 | 5D | a cat on the sill facing the street, an old woman asleep behind it | the cat is people watching too. professional. |
| 6 | 3A | a dinner party mid-laugh, one guest on a phone under the table | everyone is laughing. one of them is not. that is the show. |
| 7 | 2D | a dark room, one lamp left on, unmade bed | nobody home. i am going to wait. |
| 8 | 4C — THE TURN | a figure standing at the glass looking straight out | rule 2: if they catch you, you are now the watched. |
| 9 | CLOSE | from the street looking up at one lit window, a single silhouette | she has been at that window an hour. what is her deal. |

Beat 7 is the longest hold — the pause before the turn. Beat 8 holds a moment
in silence before its caption lands.

## Craft notes (the two that decide the whole thing)

- **The windows are drawn SEPARATELY, not cropped out of the facade.** A 4K
  facade gives a single window ~390x440px — nowhere near a full screen. The
  cut works because each interior is drawn **framed by its own window** (frame
  edges visible), so the facade's window and the interior share a shape and
  the punch-in reads as one move.
- **The hero facade is drawn at 2K or 4K** so the push-in has real pixels to
  travel through. Everything else is 1K portrait.

## Style

**Dreamy** (`PL_GPT_STYLES.dreamy` — `refs/dream-mystery.jpg`), the same recipe
the PWC bingo card was drawn in (playground runs, 2026-08-24). Her prefix and
tail go verbatim; the content half is short and names the event rather than
listing its parts.

## Cost

- Stills: hero 2K medium **6.6c**, nine interiors 1K medium **4.1c** each ≈ **43c** total.
- Animation, per clip, from `movies.js` `VIDEO_MODELS`: wan draft 480p ~6c ·
  wan 720p ~16c · kling standard 720p 25c · kling pro 1080p 55c. Ten clips ≈
  **60c / $1.60 / $2.50 / $5.50** by tier. A slow push-in is exactly what the
  draft tier is good at, so **wan 720p (~$1.60) is the pick** unless she wants
  the 4C turn done at a higher tier on its own.
- Captions and the cut: free (typeset in the edit, ffmpeg on our own box).

## Production state

- **v1 shot list: written 2026-08-25** (this file). Posted as a deck in the
  `people-watching-club-reel` chat's Compare tab for her swipe — which lives
  stay, which get rewritten.
- **Stills: hero drawn 2026-08-25.** The nine interiors wait on her pass, the
  same order the universe reel used — a re-roll after animation is a re-pay.
- **Animation: not started.**
- **Sound: not decided.** Street tone under the whole thing is the obvious
  choice; her voice reading the lines is the other, and it is a different reel.
