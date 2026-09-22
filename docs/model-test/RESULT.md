# Shot 12 — key 48, "door — take the pill / don't take the pill"

Written 2026-09-22 for the reshoot plan (`docs/mental-hospital/reshoot-plan-2026-09-15.md`, row B·12).
**NOT SENT. Nothing drawn, nothing spent.** It waits for her "go" on this exact card
(model · seconds · resolution · exact prompt · every reference), then goes through
`node scripts/atlascloud-send.js --job job.json` — `--dry` first — which logs it to
`forge-video-jobs` the moment it is sent.

## The job card

- **door:** Atlas Cloud (`POST /api/atlascloud` / `scripts/atlascloud-send.js`) — never APIFRAME for Mini
- **model:** Seedance 2.0 Mini — `bytedance/seedance-2.0-mini/reference-to-video`
- **seconds:** 15
- **resolution:** 480p
- **aspect:** 3:4 (`ratio: "3:4"`)
- **audio:** on
- **last frame:** returned (`returnLastFrame: true`, free) — 48 is a candidate ending, so the frame is kept in case something chains off it
- **chat / scene / title on the log:** `hospital-night-reshoots` · `48` · `door — take the pill / don't take the pill`
- **cost:** ~17¢ (Atlas Mini 480p 3:4 measured at ~1.1¢/s; Atlas publishes no billing read, so "about")

## The references, by cast-shelf name (`GET /api/cast?film=ward`)

Slot order is the doors' order — images first, then videos (`cast-line.js`).

- **[Image1]** — wardrobe `blue-pajamas`, look `sophie` — **"A — Sophie alone, full body"**
  `https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/drops/_/52a036179b0e90785fc918e6f95520ec.png`
  The ONE pajama still for Sophie (her 2026-09-11 rule: no tape pocket, no second still). The
  belt's old card for 48 still lists three pajama stills; that card is out of date, not a rule.
- **[Video1]** — person `sophie`, look `pajamas` — **"the jazz (4s)"**
  `https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/ward-refs/jazz-best4s-1789011108116.mp4`

No setting reference: the cast shelf has her room, the office and the dining room, and no
hall. So the hall is the one thing the prompt describes in words, because no reference
carries it. Nobody else is in the scene, so no other person rides — a person is kept out by
not sending a reference that holds her, never by a negation.

## The exact prompt (sent verbatim, line for line)

```
sophie is the woman in [Video1].  she wears the blue hospital pajamas in [Image1], NOT the dress in [Video1]

setting: mental hospital. the far end of a long hallway, night. she sits on the floor with her back against the wall next to a closed door that has no handle on the inside. camera at eye level. one continuous shot, no cuts.

She sits at the end of the hallway, next to the door patients go in and out of as they choose. It's never been locked so long as she's been there but there is no handle on the inside of the door. She is mulling over whether or not to take the pill she's been prescribed.

"Take the pill," she mutters, clenching her fists tightly, then releasing them. "Don't take the pill," she says, clenching her fists again. She repeats the two phrases over and over, "Take the pill. Don't take the pill. Take the pill. Don't take the pill," then screws up her eyes in concentration, as though the decision were laid out in front of her and she has only to read it. She gives up and goes back to clenching her fists, muttering "Take the pill. Don't take the pill" over and over until it sounds like a mantra. she speaks English. no one else in the hallway.
```

## What I changed from her words on the belt card, word for word

Her scene text (key 48 on the pills belt, `docs/mental-hospital/pills/jobs-pills.json`) is
the base. The changes, each named:

- **The cast-shelf line replaces the belt's header lines.** The belt card opened with
  `she wears the blue hospital pajamas in [Image1], [Image2] and [Image3]` (three stills);
  the shelf's own line for Sophie's pajamas look is `she wears the blue hospital pajamas in
  [Image1]` — one still, her rule.
- **Added the setting line** (`the far end of a long hallway, night. she sits on the floor
  with her back against the wall next to a closed door that has no handle on the inside.
  camera at eye level. one continuous shot, no cuts.`) — the hall has no reference on the
  shelf, so it is described; `camera at eye level` is the standing rule; `one continuous
  shot` keeps Mini from cutting a 15s clip into shots.
- **"next to the hallway which patients go in as they choose" → "next to the door patients
  go in and out of as they choose."** Her text says "hallway" twice where the second one is
  the door; the sentence after it is about the door.
- **"mulling over the matter of whether or not…" → "She is mulling over whether or not…"** —
  her fragment made a full sentence.
- **The two lines are QUOTED as the spoken lines, and "eleven times in a row" became the
  words spoken out** (`"Take the pill. Don't take the pill. Take the pill. Don't take the
  pill,"` and the mantra line). Measured 09-07: quoted lines are spoken as written and prose
  is improvised, and a count in prose ("eleven times") is not something the model says or
  counts. Her "the antithesis:" is dropped — it was narration, not a line.
- **"she has just to interpret it in order to know what to do" → "she has only to read
  it"** — shorter; the action is the same.
- **"resorts to clenching her fists again, muttering those words" → "goes back to clenching
  her fists, muttering 'Take the pill. Don't take the pill'"** — the words named so they are
  said, not improvised.
- **Added `she speaks English.`** (the standing line on any card with speech) **and `no one
  else in the hallway.`** (nothing to describe about a person — it names who is absent, and
  no reference of anyone else is sent, which is the half that actually keeps them out).

## `job.json` for `scripts/atlascloud-send.js` (run with `--dry` first)

```json
{
  "chat": "hospital-night-reshoots",
  "scene": "48",
  "title": "door — take the pill / don't take the pill",
  "model": "mini",
  "seconds": 15,
  "res": "480p",
  "ratio": "3:4",
  "audio": true,
  "returnLastFrame": true,
  "promptFile": "prompt-48.txt",
  "images": [
    "https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/drops/_/52a036179b0e90785fc918e6f95520ec.png"
  ],
  "videos": [
    "https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/ward-refs/jazz-best4s-1789011108116.mp4"
  ]
}
```

`returnLastFrame` is not one of the send script's documented job keys (it passes `seed` and
`fileUrl`; `buildRequest` reads `returnLastFrame` off the body) — if the dry run's EXACT
BODY shows `return_last_frame: false`, add the key to the script's `body` object before
sending, or send through `POST /api/atlascloud` with `returnLastFrame: true`.
