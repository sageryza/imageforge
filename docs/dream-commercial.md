# The dream-app commercial — "the boys, before and after"

Sophie's concept (2026-08-19) for a commercial for the dream app
(youwereinmydreams.com, the dream feed). Format: one group chat — "the boys" —
shown BEFORE the dream app and AFTER it. Before, it's stereotypical guy-chat:
flexing, protein, casual cruelty. After, the same guys are accidentally,
absurdly emotionally fluent — they read each other's dreams with total
sincerity, and the proof is always an illustration from the app, treated as
documentary evidence. The app never argues for itself; the joke does it.

## Video 1 — script beats (her original)

BEFORE THE DREAM APP
1. Photo drops into the chat: a bicep. (Her ask: ideally a boomerang of a guy
   kissing his own bicep.) Caption: "look at the gains boys"
2. Photo: a veritable pile of protein — steaks, eggs, chicken, shakes,
   powder. Bro-science macro talk around it (the made-up grams — a boys-side
   eating-disorder bit; numbers deliberately nonsense).
3. The Melanie beat, before-version: "Melanie is a bitch because she won't
   sleep with me."

— title card: "before the dream" —

AFTER THE DREAM APP
4. "I think Tyler's going through a lot, because he dreamt of french fries
   falling on the floor last night."
5. Tyler: "there were so many fries 😔"
6. The Melanie beat, after-version: "Melanie has intimacy issues" /
   "how do you know" / [the app's illustration: Melanie tangled in balls of
   yarn] / "oh damn" / "yeah"

## The images (made 2026-08-19, this chat)

All four filed in the dream-app-commercial Assets tab and the iOS gallery,
prompts filed on each. The split that matters for authenticity:

- **Before images are photoreal** — gpt-image-2 generations, portrait
  1024x1536, medium, prompted as bad candid phone photos (flash glare, messy
  framing), because they're meant to read as photos guys actually texted.
  - "the gains" — mirror selfie, guy kissing his own flexed bicep
  - the protein pile — overhead counter shot, steaks/eggs/chicken/shakes
- **After images are REAL app output, not imitations** — the dream app's own
  recipe from movies.js `makeDreamImage`: gpt-image-2 EDITS with
  `refs/dream-mystery.jpg` attached as the style reference, SQUARE 1024x1024,
  medium (5.3¢ — the app's exact spend per dream), the exact prompt wrapper
  the server builds ("The FIRST attached image is a STYLE reference … Draw
  this: … The rest of the dream, for context only …"). Any future commercial
  MUST make its in-app images this way — a hand-styled imitation will not
  match what users actually see.
  - Melanie tangled in balls of yarn
  - Tyler's fries falling on the floor

### Her notes on the v1 images (2026-08-19 — all four KEPT for now)

Sophie reviewed the batch: "all the images you made are fine and pretty good
and will keep them for now." Her honest thoughts, recorded for whoever
re-rolls later:

- **Protein pile** — she'd imagined a literal PILE, maybe against a white
  background like a product shot, "so it's extremely comical". The realistic
  one stays for now; a re-roll goes comical-product-shot.
- **Bicep kiss** — "perfect gym bro". Don't touch it.
- **Melanie in yarn** — reads "a little too detailed or grainy" to her; her
  guess is too many words describing the image. A re-roll should use a much
  SHORTER image plan (the app's own plans are one paragraph; hers would be
  2-3 plain sentences).
- **Tyler's fries** — she'd imagined two gym bros at McDonald's, one having
  knocked the fries on the floor, all of them down there. The solo kitchen
  version stays for now.

## Rendering the video (the texting)

`node scripts/dream-commercial/render.js video1.json out.mp4` — no model
calls, costs nothing, ~2 min. `render.html` is the fake iOS group chat (a
filmed prop of Messages, deliberately not house chrome), `video1.json` is the
message script — a future video is a new JSON, nothing else. The driver steps
the chat one message at a time through headless Chromium (deterministic
pop-in frames, no wall-clock animation), then assembles 1080x1920 30fps H.264
with the repo's ffmpeg-static. Title cards and the end card are the dream
app's palette (cream #f4f0e5 / ink #14131a / blush #d9b3c0) in Newsreader
italic, fetched at render time with a Liberation Serif fallback. Silent by
design so far — sound (iMessage pops, VO) is an open question for Sophie.

v1 (0:42, 2026-08-19):
https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/dream-commercial/commercial-v1.mp4

v2 (0:45, 2026-08-19 — her four notes on v1, all shipped): the fries dream
image IS in the chat now (Jake's line → the picture → Tyler's "there were so
many fries 😔"); the canvas is a real iPhone 13 (390x844 points at 3x =
1170x2532 — v1's 540x960 was the wrong aspect ratio and made every message
read small); and the chat is light mode ("make the background white"). The
title/end cards are unchanged — they're the app's brand, not the phone UI.
https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/dream-commercial/commercial-v2.mp4

## Scenario bank — before → after, for future videos

Each is one video, same structure: 2-3 before beats, the title cards, 2-3
after beats, an app illustration as the pivot where it lands.

- **The teeth dream (fantasy football chat).** Before: roasting the league
  loser, "0-6 lmaooo", punishment-draft threats. After: "Derek dreamt his
  teeth fell out again. Third week straight." / "it's about loss of control
  man" / "the draft was never the problem" / Derek: "nothing stays in my
  hands 😔"
- **The gorilla (the could-you-beat-a-bear argument).** Before: the classic
  "100 men vs 1 gorilla" fight thread, guys claiming they'd win. After:
  "Kyle dreamt the gorilla just wanted to be held" / [app image: a man and a
  gorilla sitting quietly on a park bench] / "we're not fighting anything
  anymore" / "the gorilla was you, Kyle"
- **The vending machine (u-up chat).** Before: screenshot of a 2am "u up"
  text, the boys hyping it. After: "Jake dreamt his ex was a vending machine
  that ate his dollar and gave nothing back" / "you keep putting dollars in
  man" / "the machine owes you NOTHING" / Jake: "it was my last dollar"
- **The lighthouse (crying-at-movies roast).** Before: "bro CRIED at
  Interstellar lmaoo" pile-on. After: "Chad dreamt he was a lighthouse but no
  ships came" / [app image: a lighthouse beaming over an empty sea] / "we're
  coming over" / "bringing the boat"
- **The passenger seat (car chat).** Before: horsepower argument, revving
  videos, "your civic is mid". After: "Dev dreamt he was in the passenger
  seat of his own car and nobody was driving" / "who's driving your life
  Dev" / "pull over and switch seats king"
- **The bees (crypto chat).** Before: rocket emojis, diamond hands, "we're
  all gonna make it". After: "Tyler dreamt his money turned into bees and
  flew away" / "did they sting you?" / "no. they just left" / [app image: a
  wallet opening into a swarm]
- **The childhood dog (bench-PR chat).** Before: "315x2, natty btw" gym
  videos. After: "Greg dreamt he couldn't lift his childhood dog" / "some
  weight isn't physical" / "Greg call your mom. Biscuit misses you"
- **The grandma's kitchen (mom-jokes chat).** Before: a your-mom pile-on.
  After: "Sean dreamt about his grandma's kitchen" / "everyone call your
  grandmas today" / "already crying man"
- **Wings for Marcus (logistics chat).** Before: "WINGS?" "wings." "WINGS."
  After: "Marcus had the drowning dream again so wings at mine, 7pm. be
  there for him" / "say less" — the plans are identical, the reason changed.

The same formula flips to other chats for later videos: the girls' chat
(performatively supportive before → surgically honest after), the family
chat, the coworkers chat.
