# Hospital night — Sophie's notes on the film (kept, not all acted on)

Her notes on the pinned cut, as she leaves them on the paused player. The ones
about NEW FOOTAGE are for later — "document, don't act" (2026-09-07). Every
clip costs real money ($3-5 on Seedance 2.5) and nothing is sent without her
"go" for that exact job.

## Notes on v15 (2026-09-07, 6:55am Pacific)

Timing / edits to the cut (free, container renders):
- [0:06] at night...1/2...in the summer
- [0:09] start right here: i was...
- [0:18] footsteps are in the jazz track — nonsense
- [0:19] here: "you know..."
- [0:24] game audio cuts in n out
- [0:31] start here: "it was warm"
- [1:25] cut the feet wet part
- [2:06] we might cut her falling back since her arms are sposed to be tied
- [2:17] there shud be a beat here. we can move the voice audio since her lips aren't shown

New footage — for later, not to run:
- [1:37] room part has to be the same room. we can feed this back in
- [2:20] we might want to extend this video for a second to get her reaction — or make a new one w the assistant? unsure

## Cast notes
- Michael (her words, 2026-09-07): he was tall, and kind of awkward. dirty sneakers. very light brown hair in no particular arrangement, just kind of plastered there. falling flat. medium build. wide, searching blue eyes. kind of a forlorn expression
- Real photos of real people are refused as references by Seedance ("may contain real person") — Mayra's and Michael's photos, and photoreal portraits of the doctor and the assistant. People are described in words; the clip that births a face becomes the reference for the next.

## Cast decisions
- **The doctor is the one in intake A** (2026-09-07, Sophie: "that's the doctor so any other clips w him"). Reference for every later doctor clip: the intake A clip (its first 15s, `ward-intake-A-ref15.mp4` in the Dump, so it fits the 30s reference cap beside v6).
- **The assistant changes clothes** so she doesn't match the patients: a skirt and a purple sweater, hair up (her words). Not mid-scene: intake B keeps her in the blue scrubs of intake A; the skirt and sweater start with her next scene (the assistant at the doorway).

## Notes on the ward clips (2026-09-07, for later — new footage, not to run)
- The table: Anastasia is supposed to be a beautiful blond ballerina — she came out with the braid but not as pictured. Michael is "LITERALLY perfect", the reference for him from here.
- The table: Sophie was supposed to slot herself in BETWEEN Anastasia and Michael for the comedy — the clip seats her across from them.
- Music class: could have been redone with the table footage so Michael and Anastasia are in the room.
- A 4s insert of her face while she talks at the table (the clip never cuts to her): reference the whole table clip, prompt the close-up with her line; lay it into the recut.

## Which Sophie is Sophie (2026-09-07)
- **The braid is the wrong person.** The cafeteria/table clip and the hallway walk
  (both born off the table clip) drew her with a long braid; the real Sophie is
  the short-brown-curls woman from v6 / the waking-up clip / intake A + B /
  roommate 1. Both braid clips need redoing — hers to schedule. Michael in them
  is right ("LITERALLY perfect") and the table clip stays the reference for HIM.
- Roommate 1 landed with the right Sophie (short curls) and a good Annie; the
  rerun plan (waking-up clip as Video1 for the room, roommate 1 as Video2 for
  Annie, her fuller Annie line) is drafted and waits for go.
- **Climax 1 v2 (the walk to his office, pajamas) — notes for a redo, not run:**
  the assistant was not supposed to be in it (drop her line from the header;
  "assistant in tow" is in Sophie's own text and is hers to cut), Sophie
  should talk faster, and the too-long pajama pants came out weird (the
  "rolled up but have fallen down somewhat" line is what drew them).

## Seedance and dialogue (2026-09-07, measured on the music class)
- **Words in quotes are spoken as written. Everything in prose is a licence
  to improvise.** "a song she is making up on the spot" → the model wrote the
  song; "informing her that she will be allowed back…" → the model wrote its
  own speech for the teacher; a long clip with people in it and no quoted
  lines → it fills the time with talk. Not a bug — how it fills seconds.
- So for every scene: put anything that must be said in quotes, keep the
  prose to what is VISIBLE, and describe each person's clothes in their own
  line (the music class put the "normal clothes" on Yolanda, not the teacher,
  because the prose left it open).
- Sophie did not know this until 2026-09-07; the drafted scenes with a lot
  of prose (the sculptures, the town hall, the parents at the table) will
  want their lines quoted before a go.
- **And improvised speech is often GIBBERISH, not English** (Sophie: "the
  teacher speaks gibberish like sims") — with no words given, the audio model
  makes the sound of talking, and a prompt naming a nationality in prose
  ("a large Italian woman", "the beaches of Italy") pulls that noise toward
  a pseudo-language. Quoted lines come out as real English. A line of
  "everyone speaks English" is the belt to the quotes' braces.
- **THE NURSES ARE MEAN (Sophie, 2026-09-07: "i keep forgetting to say
  that … it's part of the plot and gets addressed later, the meeting/fishbowl
  scene").** NOT pre-added to any scene (she reversed that within the hour: "no don't
  add those lines, ask per scene") — ASK, per scene with a nurse, whether the
  line goes in. The music teacher's fix is "very short hair, not
  the frail blonde", not bald.
- B-roll idea of hers, on the page as 9b: Sophie walking the halls by
  herself, a nurse spontaneously coming up and rolling up her pajamas.
- The cafeteria is a POSSIBLE redo, not a hard one: the plan is a 4s
  close-up of Sophie talking (8b on the page) to splice in.
- **AN EXTENSION MUST BE SENT WITH `aspectRatio: "adaptive"` (measured
  2026-09-07).** Seedance classifies a prompt beginning "continue [Video1]" as
  a video-extension task and refuses any fixed ratio: "`ratio` must be
  `adaptive` … the output ratio follows the input video". Refused = refunded.
  `runaf3.py` takes `AR=adaptive` for it.
