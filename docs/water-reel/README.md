# The water reel — the whole build, for whoever takes it next

Sophie's Playground sheets ("MORE WATER, RIGHT NOW") cut into one 9:16 reel,
narrated **in her own voice** from a recording she made herself.

**Read `docs/water-reel/sophies-notes.md` first** — every note she gave, in
order, verbatim. This file says how the build answers them.

## Where everything is

| | |
|---|---|
| Her recording | `assets/water-reel/sophie-vo.m4a` (7:50) |
| The nine sheets | `assets/water-reel/sheets/*.webp` (her Playground originals, full res) |
| Sound effects | `assets/water-reel/sfx/*.mp3` |
| Laura's stand-in lines | `assets/water-reel/laura-goblin-sheet.mp3` |
| v12, sped two ways | `assets/water-reel/water-reel-v12-{fast,ramp}.mp4` (720p) |
| The scripts | `scripts/water-reel/` |

Full-resolution masters are NOT in git (62–88MB each) — they live at permanent
public URLs:

- **v13 full speed (2:16)** — https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/water-reel/water-reel-v13.mp4
- **v13 fast 1.7x (1:20), the current pin** — https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/water-reel/water-reel-v13-fast.mp4
- v12 full speed (2:24) — https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/water-reel/water-reel-v12.mp4
- v12 flat 1.7x (1:25) — https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/water-reel/water-reel-v12-fast.mp4
- v12 ramp to 2.0x (1:26) — https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/water-reel/water-reel-v12-ramp.mp4

v13 on top of v12: effects end with their line, the sandpaper shot is out,
sheet F re-centred on its measured panel band (0.36–0.79), and the full-width
rows (sheets E and G) PAN across instead of a token nudge. Frame-checking v13
caught the stitch cache keying pictures by FILENAME — a re-rendered clip at
the same path silently shipped the old framing; it keys by bytes now.

## Rebuilding it

```
node scripts/water-reel/build-vo.js --images assets/water-reel/sheets \
     --montage assets/water-reel/sheets --vo assets/water-reel/sophie-vo.m4a \
     --work /tmp/wr
node scripts/vo-film.js /tmp/wr/spec.json --dir /tmp/wr/film --final
node scripts/water-reel/mix-sfx.js --film /tmp/wr/film --spec /tmp/wr/spec.json \
     --sfx assets/water-reel/sfx --out /tmp/wr/v12.mp4
node scripts/water-reel/speed.js --in /tmp/wr/v12.mp4 --flat 1.7 --out /tmp/wr/v12-fast.mp4
```

`build-vo.js` needs `assets/water-reel/laura-goblin-sheet.mp3` copied to
`/tmp/wr/src/b.wav` first (or re-render it with `tts-fill.js`).

## The three things that decide this reel

**1. TAKES — she recorded out of order and wants the LAST one.**
`SLICES` in `build-vo.js` is one time window per section, each holding only the
take she wants. That is deliberate and not a shortcut: `phraseSpan` scores
every window and ties break to the EARLIEST, so with four near-identical takes
it would pick her first every time. Slicing makes each phrase unique inside its
own source. A per-line sweep of the whole recording confirmed every line rides
her last take; two needed naming explicitly —

- the opening "Scientists did a study…" (her file-END read is her FIRST attempt
  and slurs the word; `intro1` is her real last take at 386s)
- "ghosts that live in your knees" (`f1b`, 234.8s — her literal last re-read at
  261.5s runs gapless into the next section, so the last *cleanly separated*
  take wins)

**2. CUTTING — bulk timings locate, a re-listen cuts.**
`"relisten": true` on the spec. This is the trap that cost this chat four
versions and cost the Evan film its own round; the rule of record is in
`docs/nde-precise-cutting.md` and the `sophie-audio` skill. If a "clipped word"
report comes in, use the TRIAGE there before touching the cutter — the three
causes are a bad cut, a slurred TAKE, and a whispered word a gap-bridge ate,
and all three happened here.

**3. THE WORD SWEEP is the delivery gate, not the PASS line.**
`vo-film.js`'s verify prints every script word it could not hear back, per
shot. The pass/fail gate only fails on 4+ word runs, so single clipped words
sail through it — two shipped that way before the sweep existed. **Read the
sweep and judge every line before delivering.** Most entries are whisper
mishears; check each against the source words and a 20ms RMS profile.

## Everything else her notes bought

- **Zooms** land on measured ink bounds, not guesses. Two sheets lay their
  reasons out as full-width rows (`push`), so they get a gentle 1.0→1.08 push
  instead of a crop that would cut her lettering.
- **The finale glides** — the third-eye shot slides into the "MORE WATER!"
  burst in one move, so the reel never cuts twice to the same image.
- **Sound effects are levelled by measurement**, never by a multiplier: the
  source files span 26 dB, so `mix-sfx.js` measures each and derives the gain
  to a common target, with the whole bed tapering 4 dB across the reel (her
  "especially towards the end") and nothing peaking past −6 dBFS.
- **The fish sing** — a child's "la la la" lullaby under the miniature-fish
  panel, her ask, generated with ElevenLabs sound generation.
- **Laura reads the ear-goblins sheet** (`b1`–`b4`) because Sophie has no take
  of it. When she records those three lines, add a `SLICES` entry and delete
  the `LAURA` const — nothing else changes.
- **Speed**: `speed.js` retimes the finished mixed reel with the pitch kept
  (`atempo`, chained above 2.0), splitting only at shot boundaries so no word
  straddles a seam. `--flat 1.3` or `--ramp 1.15,1.25,…`.

## Open (audited 2026-08-27 — every note v1–v13 checked against the cut)

Everything she asked for is in v13 except these, and each is hers:

- **Laura is down to ONE line (2026-08-27).** Sophie recorded the goblin
  sheet's three reasons (`assets/water-reel/sophie-goblin-sheet.m4a`, the
  `bs` slice — last take, intro ignored, per her message) and b1-b3 ride her
  voice since v14. The sheet's tagline "Drink gallons. Live legendary." has
  no take of hers, so Laura reads exactly that one shot (b4) — her v9 rule.
  When she records it, b4 gets a slice and the `LAURA` const goes.
- **c1's "…than ever before" is a SPLICE** of two moments 14s apart, not a
  take — approved by ear, and she has not ruled on it.
- **The knees/spine echo** — "it says knees twice" is the spine sheet saying
  the same sentence two sheets earlier. Dropping one is hers to call.
- **Speed** — she has flip-flopped honestly here: v11's 1.3x/1.15→1.55 "all
  sounded pretty slow", then 1.7x was "the speed you liked", then 2026-08-27
  "what was the last version it was slower? can u put it back to that" → v13
  is being delivered at v11's two slower speeds (flat 1.3x, ramp 1.15→1.55)
  for her to pick. The landing speed stays hers.
