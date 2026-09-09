# Climax 3 — the gap between the scare shot and the dissociation ghost shot

Sophie, 2026-09-09: *"i think we need some footage between the scare shot and
the dissociation ghost shot."* This note is what the two clips actually
contain, measured off the files, so the next chat does not re-derive it.

## The two shots (both shot, both in the rough cut `DsekWrOE5sQciRXKwtpr`)

- **`s31` — the scare shot.** 20.04s, 560x752, 24fps.
  `drops/_/7bc0ac5dfc7d7963fb8ed6a700d546a1.mp4`
  Card `md-31a` "Climax 3 — Tomorrow? → the judge".
  Beat map: 0-3s wide (her in the chair, then Grayson arms crossed, pill
  bottle on the desk) · 4-8s her close-ups ("Tomorrow?" / "the next day?" /
  "the day after that?") · 10-16s his speech about the judge · **18-20s the
  push-in — the biggest close-up in the film, horror-stricken, mouth open.**
- **`s31b` — the dissociation ghost shot.** 15.07s.
  `drops/_/fa36a5c3fb9c6d019e959849ea347ddf.mp4`
  Card `md-31b` "Climax 3 — the grin, the ghost, You can go now".
  Beat map: **0-4.0s wide on Grayson** at the desk, assistant behind, the grin
  ~3.5s · 4.0-9s her close-up · **9s the ghost's legs enter top of frame** ·
  10-13s the ghost standing over her at the ceiling · 14s she walks to the
  door, the ghost follows · 15s black.

## What is wrong at the join (measured, not guessed)

1. **Extreme close-up cuts to a wide she has already seen twice** inside `s31`
   (at 2s and 10-16s). The scare is cut off at its peak and the room snaps
   back to normal.
2. **No time passes.** Terror to a ghost on the ceiling is ~9 seconds of
   screen time, with a talking wide in the middle.
3. **The panic sound her card promises was never drawn.** `s31`'s tail
   (16-20s) means -23.1 dB, no louder than its own dialogue; `s31b`'s ghost
   section (8-15s) drops to -29.4 dB. So the swell is a Film Editor sound-lane
   job (free), not something to hope Seedance draws.
4. **Her written beat "eyes go wide, even wider … then suddenly blank" is not
   in `s31b`.** Her 4-9s close-up reads as defeated and blinking, never wide
   then blank.

## Where a piece can go

- **A — between the two clips**, before Grayson's "judging by your performance"
  line. What she asked for. The grin then lands through the fog.
- **B — inside `s31b` at 0:07**, after the grin and before the ghost. Free to
  cut there — split `s31b` in the Film Editor, no re-shoot.

## The options put to her (Compare page "The gap — 31 → 31b v3",
`N5PmnUP9eGOdlkYqbIuW`, sheet `gap-31`) — NOTHING SENT, waiting on her go

| | shot | door | cost |
|-|-|-|-|
| A | the ceiling — straight up at the stucco tiles from her chair | OpenRouter (person-free) | 4s ~44¢ |
| B | his mouth, too close — words gone | APIFRAME (his face) | 4s ~60¢ |
| C | her hands in her lap — they stop being hers | APIFRAME (her) | 4s ~60¢ |
| D | the room goes soft, her POV | OpenRouter if he is out of frame | 4s ~44¢ |
| E | hold the last frame of `s31` a beat and a half | ffmpeg, our own box | 0¢ |

A is the pick if she wants one: the camera reaches the ceiling corner before
she does, so the ghost has a place to arrive.

**Pricing, for the next chat:** Seedance 2.5 480p is ~15¢/s on APIFRAME and
~10.9¢/s on OpenRouter. Any reference carrying a face or a person goes
APIFRAME; a person-free still or clip goes OpenRouter. Balances 2026-09-09:
APIFRAME 817 credits ($8.17), OpenRouter $48 left.

## The frames, filed in the chat's Assets tab

`a_scare_peak` (31 @ 0:18) · `a_scare_end` (31 last frame) ·
`a_ghost_first` (31b first frame) · `a_ghost` (31b @ 0:11), Dump bundle
"Climax 3 — the gap".

## The redo of 31's back half (2026-09-09, Sophie: "i think we need more
## breathing room for the dr speaking and the panic music · let's redo that
## part of the clip")

**`s31` splits cleanly at 10.0s** — that is where it cuts from her close-ups to
Grayson's wide, so a trim there is invisible. Front half (0-10s, her
"Tomorrow? / the next day? / the day after that?") is fine and stays; the back
half is what gets redrawn.

**Why it is cramped, measured:** his two sentences run 10→18s (8s) and her
horror-stricken reaction + the push-in gets 18→20s (**2s**). Audio is flat
-21 to -24 dB across the whole tail — no swell anywhere.

**Three takes of `md-31a` are on file** (`GET /api/apiframe/video-log
?chat=climax-dissociation-accounts`), and **all three carried her FULL text
including the panic-music paragraph**:
- take 1, **8s**, completed (`1788906300124-gl2cf6.mp4`) — the whole card in 8s.
- take 2, **20s**, completed (`1788907720566-b34ok7.mp4`) — **this is the clip
  in the cut**, md5 `7bc0ac5dfc7d7963fb8ed6a700d546a1`.
- take 3, **30s**, **FAILED at progress 99** with `Polling timed out after
  1200s`, `result: null`, no video — the $4.50 already on the refund list.

So **30s on this card has been tried once and lost $4.50**, which is the
argument for splitting rather than re-running the whole thing longer.

**Seedance ignored the music line at 8s and again at 20s.** The panic swell is
a Film Editor sound-lane job (free and reliable), not something to buy more
seconds hoping for.

**References for the redo: unchanged from the take that landed** — 4 videos
(jazz 15.10s + office2 4.04 + office 4.04 + broll1 4.04 = **27.2s**, under the
30s cap) and the 5 stills (`pj-optA-solo`, `pj-optC-solo`, the socks still,
`still2a-sophie-chair-wide-blur`, `still2b-doctor-chair-blur`). The exact
wired prompt for all three takes is in the video log — read it from there
rather than rebuilding it.

## The Mini redo (2026-09-09, Sophie: "it works till about 8 seconds · also he
## leans forward and leans back next clip · redo dialogue w open router mini")

- **Cut at 8.0s**, her call. Her third line ("The day after that?") lands ~9s,
  so the new clip carries it.
- **The leaning break is real:** `s31` cuts to Grayson at 10.0s **leaning
  forward, hands on the desk**, and `s31b` opens with him **sitting back,
  hands clasped**. Fix by construction — the Grayson reference still IS
  `s31b`'s own first frame, plus one line of direction: `Dr. Grayson does not
  lean forward at any point.` (Never describe the still; point at it.)
- **OpenRouter takes NO person video**, so the jazz clip cannot ride. Her
  likeness comes off a still with **black bars over the eyes** — bars, not
  blur, are the reliable one on AI-drawn frames (measured 2026-09-08). Two
  stills built from the existing clips and filed in this chat's Assets tab:
  `b_sophie.png` (frame of 31 @ 0:07) and `b_grayson.png` (31b first frame).
- **Mini at 480p 3:4 is 1.4¢/s measured** (job `OudXGDf91uEk1um3pZUt`, 4s =
  5.6¢) — so 8s ≈ 11¢, 12s ≈ 17¢, 15s ≈ 21¢ against $2.25 for 15s of 2.5 on
  APIFRAME. Mini supports 4-15s, 480p/720p, 3:4. Another chat is running the
  same shape right now (`mom-character-clip`, 20 jobs, 15s included), so the
  path is proven.
- **A refusal is free** — nothing is billed until it draws.

## The five Mini takes (2026-09-09) — and the seed trick that makes an A/B real

Five clips, **94¢ for 68 seconds = 1.39¢/s** (read off each job's own
`usage.cost` — an earlier 0.93¢/s here came from the shared account's balance
delta while another chat was spending, and was wrong), all Seedance 2.0 Mini · 480p · 3:4 · audio on, two barred stills, no
video references. Every one landed; nothing was refused.

- **A** — her full text, 15s. her → him → her, and it ends by pushing all the
  way into her EYE. `drops/_/cddc90189262df707b227493763b4247.mp4`
- **B** — dialogue only, 15s. `…/f6ceb928586a178c5093ba1cf260064c.mp4`
- **C** — her reaction alone, 8s. One continuous slow push-in from worried to
  full terror. `…/b86a5217f607a8d5182bbd57725fc7a3.mp4`
- **L1 / L2** — the context-line contest, below.

**The leaning fix worked.** Grayson sits back with his hands clasped through
every take — the reference still is `s31b`'s own first frame plus one line,
`Dr. Grayson does not lean forward at any point.` Never describe the still.

### THE SEED IS A NUDGE, NOT A PIN — AND IT DOES NOT MAKE A PROMPT A/B REAL

**This section replaces a WRONG claim that stood here for one turn.** It said
a seed-pinned pair "came back with identical opening frames" and that a
difference between two such clips is therefore the changed sentence. That was
read off two low-resolution tile strips by eye. Measured properly with
`ffmpeg psnr` (identical video would be infinite; all four md5s differ):

| pair | seed | prompt | PSNR (y) |
|-|-|-|-|
| T1 vs T2 | same (7) | **identical** | **27.1 dB** |
| T1 vs T3 | 7 vs 99 | identical | 21.5 dB |
| L1 vs L2 | same (7) | one sentence differs | 16.8 dB (first 2s: 18.6) |
| A vs B | none | different | 16.1 dB |

So: **the same seed with the identical prompt still draws a different take** —
same framing, same wardrobe, same room, different performance frame by frame.
The seed narrows the spread by about 5.7 dB when nothing else moves, and the
moment the prompt changes by one sentence its effect is gone into the noise
(16.8 against an uncontrolled 16.1).

**Consequences, both of which matter:**
- **You cannot isolate one prompt line with a seed on this model.** To attribute
  a difference to a line you need several takes per arm and a judgement about
  the whole set, not one pair.
- **The context-line result below does NOT stand.** The pill-bottle insert
  appeared in the take carrying her sentence and not in the take carrying the
  chat's, but at 16.8 dB that pair is no more controlled than two unrelated
  runs. It is a thing that happened once, not a finding.

`seed` IS passed through by both doors (`buildRequest` in `openrouter.js`;
`apiframe.js` hands the whole body to `seedanceVideo`, which reads
`opts.seed`), and all four Seedance models declare seed support — so the field
works. It just does not buy reproducibility.

**AND THE SEED DOES NOT CARRY ACROSS RESOLUTION EITHER.** T4 — same prompt,
same seed 7, same reference, 4s, only `resolution: "720p"` — is **16.2 dB**
against its 480p twin, i.e. as different as two unrelated runs (T3 vs T4 is
15.3). So **you cannot block a shot cheaply at 480p and re-render the keeper
at 720p**: the 720p run is a fresh take, not the same shot larger. A clip you
like at 480p is the clip you have.

**What 720p costs and looks like:** "480p" 3:4 comes back **560x752** and
"720p" **834x1112** — 2.20x the pixels, so 3.07¢/s against 1.39¢/s. The 720p
take is visibly sharper AND drew more: a filing cabinet and a plant behind
her, brighter and whiter, where the 480p take is close and moody in the ward's
green. **Caveat: the test prompt carried only [Image1]** (her close-up) and no
office still, so the room was unconstrained in both — that background
difference is the model inventing, not proof that 720p breaks continuity.

**What happened in the one pair, recorded as an anecdote and nothing more:**
the take carrying her own sentence (`sophie and her doctor are in the middle
of a discussion about when she can leave the mental hospital.`) cut to an
insert of the pill bottle on the desk at 0:07 — a shot her scene text asks for
("he nods meaningfully at a bottle of pills on his desk"). The take carrying
the chat's longer backstory sentence stayed on the wide. Suggestive, not
demonstrated; the pair is uncontrolled.

Pages: "Climax 3 redo — three shapes v1" (`lWkWRlZC37pAmsOK3EkQ`) and
"Context line — yours vs mine v2" (`xJrgMSzIPF9xIrWKrHD9`, sheet
`context-line`).
