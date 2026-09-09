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
- **THE CAMERA SHOOTS WHATEVER NOUN THE PROSE LANDS ON (climax 2a).** "as
  though he could get into her mind if he angles his hairy neck right" → a
  close-up of his chin; "seated comfortably in a high-backed leather chair"
  → a shot from the floor up at him. Descriptive flourishes read as shot
  lists. Keep prose to the action she wants SEEN, or name the shot.

## THE JAZZ IS IN EVERY CLIP WITH SOPHIE — no exceptions (2026-09-07, Sophie: "triple flag no stop any clip w her in it without the jazz reference")
The jazz (v6, 15.1s, `apiframe-video/1788736757836-f3j8qh.mp4`) is the only
clip of her face that is not a copy of a copy. Every job that has Sophie in
it carries it as a reference, and the prompt names her off it ("sophie is the
woman in [Video1]" with the jazz as Video1). The scene reference (a room, a
nurse, the previous shot) rides as Video2 and is named for what it carries —
never for her face. References must total ≤30.2s, so a 30s scene clip cannot
pair with the jazz: use the jazz + stills of the room/pajamas instead, or a
≤15s scene clip. 14 ward clips were made without it (every one at 2+ steps
on the face-drift page); they stand as shot and are redo candidates.

## NEVER DESCRIBE WHAT EXISTS AS A PICTURE (2026-09-07, Sophie: "u added a description of the pajamas. no! never describe what exists as a picture")
When a reference image carries the thing, the prompt POINTS at it ("the
blue hospital pajamas in [Image1]") and says nothing else about it. Words
beside a picture give the model a second, competing source and it draws the
words. Describe only what no reference shows.

## A CHARACTER'S FIRST APPEARANCE IS A 4s CLIP, NEVER A 30s SCENE (2026-09-07, Sophie: "any character first scene can't be 30s! … if we decide new character it's only 4s")
The first time anyone new is on screen, they get a 4s audition clip (60¢)
before their scene: if the model draws the wrong person, a redraw costs
60¢, not $4.50, and the clip that lands becomes that character's ≤15s
reference for every scene after (it pairs with the jazz, which a 30s
scene never can). The doctor and the assistant had to be rebuilt this way
after the fact — see the b-roll jobs. Mayra and the white-coat nurse are
the first to get it right.

## TWO LIMITS ON EVERY JOB (2026-09-07, Sophie: "only 30s reference footage per clip · each character appearance must ride w their FIRST appearance")
1. Reference footage totals 30s (30.2 measured) per job — videos only;
   stills are free.
2. Every character rides their ORIGIN clip: Sophie = the jazz (15.1s),
   everyone else = their 4s audition. Never a copy of a copy.
So the budget per scene is the jazz + up to three 4s characters (15 + 4 +
4 + 4 = 27), or without Sophie, seven. A group that always appears
together (the parents; the doctor and the assistant) auditions in ONE 4s
clip and rides it as one. The one exception already made: the doctor and
the assistant were born in intake A (25s), which cannot pair with the
jazz, so their 4s b-roll off intake A stands in as their origin (1 step).

## Redo notes (2026-09-08, Sophie, in the `video-editing-notes` chat) — document, don't act
Her words verbatim; each is a new job and waits for her "go" with the card
(model · seconds · resolution · exact prompt · every reference) shown first.
- **The doctor bump (pre-ward, `c8` in the rough cut — "Part 3 — the doctor,
  v1").** "That part is fine, but we need to bring that energy before of her
  laughing and I want shot of her smiling we can use the clip right before it
  where she falls onto the gutter and just extend it until she smiles." → an
  EXTENSION of the clip before it, run until she smiles (an extension is
  `continue [Video1]` + `AR=adaptive`, see above). In the cut as it stands the
  clip before `c8` is `c10` (Part 3 — the questions in the ambulance, v2);
  confirm with her that `c10` is the fall she means before wiring anything.
- **The art room (`s14` Art class, key `art`, Mrs. Norbert).** "the sound
  effects need to change and that needs to be cut cause it was too long" ·
  "Ideally, the paper would change too, and the character would look a little
  younger and less kindly" (the art teacher). The sound and the length are cut
  work (free, container); the paper and the teacher are a redo.
- **Auditions: "I wanna do a shot of Anastasia on mini and a shot of Michael
  also."** Read as the two 4s audition clips on **Seedance 2.0 Mini** (the
  APIFRAME 2.x family is 2-mini · 2 · 2-fast · 2.5; `model` on the route).
  Anastasia has no audition yet (`super-aud` is "needs your words"); Michael's
  existing 4s clip (`michaelAud2`) she called useless, so this is a new one.

- **The soap pill scene, card 1 (`43a`, Nurse Edna and the half pill — the
  8s clip that landed 2026-09-08, in the `soap-pill-scene` chat).** Her redo
  notes, verbatim: "night time" · "sophie is cousins" · "doesn't show her
  chewing the pill or close up on her mouth" · "pill is in water cup" ·
  "speech is mangled" · "plaque granson" · "she's laying in bed". They also
  sit on the card itself (the belt's *redo notes (yours)* box, sheet
  `belt-soap`, key `43a.redo`), which is where she edits them.

## WHY SEEDANCE REFUSES REAL PEOPLE (researched 2026-09-08, Sophie: "research why the dance keeps refusing real people since I assume that's in every other person's workflow")
- **It is ByteDance's own input filter, not APIFRAME's.** ModelArk answers
  HTTP 400 `InputImageSensitiveContentDetected.PrivacyInformation` — "the
  input image may contain a real person" — from a face classifier that runs on
  every reference image/video BEFORE generation; a score over a threshold is a
  refusal. It applies to the whole 2.x family and 2.5 (BytePlus's own Dreamina
  Seedance 2.5 tutorial: reference images or videos containing real human
  faces are not supported for direct upload). A refusal is refunded.
- **It is a LIKENESS policy, enforced on the pixels.** ByteDance blocks any
  recognizable real person (public or private), and the classifier flags
  "looks like a photograph of a person" rather than "is a known person" — so
  photoreal AI portraits (gpt-image, Flux) are refused too, which is exactly
  what happened to the photoreal doctor/assistant portraits here. Cropping,
  sunglasses, blur and drawn-over faces "mostly fail" — the detector is
  multi-pass. (Our blurred `still-room3` passed once; a pass, not a rule.)
- **So it is NOT in everyone else's workflow — everyone routes around it the
  same three ways:**
  1. **The model's own outputs are trusted.** A face-bearing video Seedance
     2.x/2.5 generated on your own account (its last frame, and Seedream
     images) can be fed back as a reference — ModelArk documents 30 days,
     same account, same platform. This IS the house rule already in force:
     the jazz clip was born from words and every Sophie clip references it.
  2. **A DRAWN character instead of a photo.** Illustrated / stylized
     portraits pass the filter outright ("stylized or illustrated faces
     already pass"). For Michael, Mayra, Anastasia: draw the face from her
     words in a non-photoreal style (a Playground card, a Seedream portrait)
     and reference THAT — never the photo, never a photoreal render.
  3. **Consented real people = `asset://<id>`.** ByteDance takes a signed
     release / life-rights paperwork through enterprise channels and files
     the person as a pre-cleared asset. Not self-service, not on APIFRAME.
- **Two things the blogs sell that are not for us:** third-party "portrait
  tier" platforms that claim to accept real photos (their own relay, their own
  filter layer, unverified), and the "character-sheet trick" (a red cross over
  one eye + a "CHARACTER SHEET REFERENCE" banner) — it only helps a GENERATED
  portrait the classifier misreads as a photo, never a real photograph.
- Sources: BytePlus ModelArk docs (Dreamina Seedance 2.5 tutorial),
  yingtu.ai "Seedance 2.0 'Input Image May Contain a Real Person'",
  clipdance.ai "Seedance 2.0 face limit: the 3 legit workarounds",
  viraltwin.app "pass Seedance face filter", Comfy-Org workflow_templates
  issue #822, apiframe.ai's Seedance 2.5 page (refund on failure; no
  real-person clause of its own).

## Character voices — an mp3 per character, and it works on the cheap door

**Measured 2026-09-09.** A character's voice can ride a Seedance job as
`referenceAudioUrls`, and the prompt names it by slot exactly like a picture:

    her mother is the woman in [Image1] and her voice is in [Audio1].

`mom-character-clip` sent both parents' voices with two stills through
**OpenRouter on `bytedance/seedance-2.0-mini`** and it completed for 5.6¢ — the
person filter did not trip on the audio. So a voice reference is cheap, works on
the cheap door, and is how a character stops sounding like a different person in
every clip.

**Pulling one is free** — ffmpeg in the container, no model call, nothing sent:
`docs/mental-hospital/voices/pull-voice.py <name> <clip-url> <start> <end>`. It
cuts the span, files the mp3 in the Dump under "Ward → voices" and records the
url in `voices/voices.json`.

**Cut only a stretch where that character alone speaks.** Read the card's script
and confirm nobody else has a line inside the span — a voice built on the wrong
speaker poisons every clip that references it, and nothing on screen says so.

On file: **Edna** (soap 43a, hers are the only lines in that card) and the two
**parents**. Missing: **Sophie, Dr. Grayson, the assistant** — no clip with any
of them speaking has been shot yet, since every belt card with dialogue is still
`ready` rather than shot. `mom-character-clip` has those three named as its own
next job, so check with it before pulling them twice.
