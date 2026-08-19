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

## The music — "Venus", Afro Comb feat. DOMAINIQ (Sophie, 2026-08-19)

Sophie found the song and sent it in, in her own words:

> This is actually already one of my favorite songs and I think I like this
> part so it totally fits with my website and would be a good song for one of
> my commercials.

- **The track:** "Venus" — Afro Comb feat. DOMAINIQ, released on Kitsuné
  Musique, June 2021. Afro Comb are a North London duo; this one is their
  deep-house record. https://youtu.be/2uwwVV-bGXU
- **The part she means starts at 1:04, and she was right to the second** —
  measured off the record at **1:04.52**. The words, from the lyrics Spotify
  shows (she found them; a chat here had wrongly reported them unpublished):

  > You was in my dream last night

  (the rest of the verse is in Spotify's now-playing pane — it is a
  copyrighted lyric, so it is referenced here rather than reproduced)

  **It is "dream", singular, and "You was"** — so the hook is not quite the
  domain, which is worth knowing before anyone builds copy on a verbatim
  match.
- **Why it fits, and it is not subtle:** the hook says the domain out loud.
  The site is **youwereinmydreams.com** and the line is *you were in my
  dreams last night* — so the song names the product without a single word
  of ad copy over it. It is also the opposite temperature from the joke: the
  commercial's humour is dry and deadpan, and a warm, sensual deep-house
  record under it is what keeps the whole thing from reading as a sketch.
- **Where it would sit:** the after-the-dream half. The before half is
  stereotypical guy-chat and wants either silence or the iMessage pops; the
  track coming in on the title card is the turn. That is the answer to the
  "sound is an open question" line above, for this cut at least.

### The song spot — a SECOND commercial, hers (2026-08-19)

Not the boys. A short one built on the record, three beats, in her words:

1. **"now it doesn't have to be a secret"**
2. **"you were in my dreams"** — the hook lands, and it is the domain
3. **a person tapping share your dream**

Two notes for whoever shoots it.

- **The button really does say "share your dream"** (`public/dreamapp.html`,
  the composer's last control) — use the app's own words, and the app's own
  screen. Right above it sits **seen by: everyone / friends / just me**, and a
  dream in the feed reads **private** or **shared**. So the secret in her first
  line is a real state in the product, not a metaphor: the shot is a thumb
  moving off *just me*, and then *share your dream*.
- **The line before the hook is the whole ad.** A dream is the most private
  thing a person has, and the app's proposition is that it stops having to be —
  so the copy does the argument and the song says the name. No voiceover, no
  explanation of what the app does.

#### Cutting it (2026-08-19)

`node scripts/dream-commercial/spot.js spot.json out.mp4 [--audio venus.m4a]`
— same camera as the boys film (`film-kit.js` is the shared half: the proxy
fetch, the Google-font pull, the concat encode), a new page and a new script.
No model calls in the render; it costs nothing and takes ~40s.

- **`spot.html` is a prop of OUR app, where `render.html` is a prop of
  Apple's.** So its palette, its EB Garamond / Courier Prime / Baveuse, the
  dial and the blob button are copied from `public/dreamapp.html` verbatim —
  when that screen changes, change this. One deliberate difference: the real
  sheet is bottom-anchored because it scrolls, and for a four-second shot that
  left a dead band, so the block is centred.
- **The app's own wobble/blob keyframes are PAUSED.** A screenshot loop samples
  real time unevenly, so a wall-clock animation plays back at the wrong speed —
  every shape holds its 0% frame, which is already organic. The only motion is
  the thumb, and the thumb is placed off the real elements'
  `getBoundingClientRect`, so a chip that re-wraps is still hit dead centre.
- **The tap dot is blush** (`#d9b3c0`, the end card's own colour) because it
  has to read over cream AND over the brown chip it lands on; in ink it
  disappeared into the button.
- **The picture is the app's real output** — `spot-image.js` calls movies.js
  `makeDreamImage` directly (gpt-image-2 edits, `refs/dream-mystery.jpg` as the
  style reference, square, medium, 5.3¢). It deliberately does NOT go through
  `/api/dreamapp/dreams/:id/draw`, which would write a real dream into a real
  person's feed.

**THE SOUND IS THE POINT, and the film is cut to it.** The script carries the
hook's TIMESTAMP (1:04) rather than an offset, and the driver derives the rest:
the song starts at `hook − (when the end card appears)` = 54.20s, so "you were
in my dreams last night" lands exactly as the end card does, at 9.8s. Change a
`hold` anywhere and the offset re-derives itself.

**THE DREAM IN IT FOLLOWS THE LYRIC (v2, 2026-08-19 — Sophie: "if you're
gonna make a new image, wouldn't you want to use the lyrics to the song").**
v1 showed a dream about someone in her kitchen at 4am, which was a dream but
not THIS song's dream. v2 draws what the hook describes — two people wrapped
together before dawn, a hand caught in her hair — and the ad clicks: the words
on screen are nearly the record's, and the dial under them says *just me*. The
dream is written to MIRROR the lyric, never to quote it: her typed dream has to
read as a person's dream rather than a lyric card, and quoting the words on
screen would drag the licence question onto the picture as well as the audio.
v1's kitchen is kept in the Assets tab, labeled superseded.

**THE LYRICS ARE ON SPOTIFY — a chat here said they were unpublished and that
was wrong (2026-08-19).** Web search turned up no Genius or lyrics-site page
and the wrong conclusion drawn from that was "nobody has transcribed them";
Sophie opened Spotify, where they sit in the now-playing pane, and sent a
screenshot. **A lyric lives inside the streaming apps as often as on a lyrics
site** — check there (or ask her to look, it is one tap) before reporting that
words do not exist.

`node scripts/dream-commercial/song-words.js <audio>` is still the tool for the
other half of the question — WHEN each line is sung. It runs the repo's own
Whisper pass with word timestamps and names the second the hook starts, which
is the one number `song.hook` wants. Whisper heard "touching me bright" where
the printed lyric reads "touching me right", so read its WORDS as a first pass
and its TIMES as the answer.

**THE SONG IS ON IT (v3, 0:14.8, 2026-08-19), and it never needed her Mac.**
The first cuts shipped silent on the standing rule that a cloud session cannot
pull audio — true of YouTube, and re-measured that day (`yt-dlp` gets a 429 and
"Sign in to confirm you're not a bot"). **But the rule is about YouTube, not
about audio**: Kitsune Musique's own SoundCloud carries the full track and
`yt-dlp` pulls it from this sandbox in seconds
(`soundcloud.com/kitsunemusique/afro-comb-venusfeat-domainiq`, kept in
`song.source`). Apple's iTunes Search API is the second door — `previewUrl` is
a free 30-second m4a, and for this track the preview happens to contain the
whole hook. **Before queueing an audio grab as a desktop task, try the label's
SoundCloud and the iTunes preview.**

Checked rather than assumed: the finished film's own audio transcribes with
"You was in my dream last night" starting at 9.5s against an end card at 9.8s,
so the word "dream" lands as the card comes up. The mp4 carries ~15 seconds of
the record — fine for her own review, and exactly what the licence note below
is about for anything public.
v4 (the song from 1:04, the line at the end — the current cut):
https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/dream-commercial/spot-v4.mp4
v3 (the song, building into the hook):
https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/dream-commercial/spot-v3.mp4
v1 (the kitchen dream):
https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/dream-commercial/spot-v1.mp4
v2 (the lyric's dream, silent):
https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/dream-commercial/spot-v2.mp4

#### v4 — the song opens it, and the line closes it (2026-08-19)

Sophie, after v3: start the track **at 1:04** (v3 opened ten seconds early so
the hook would arrive on the end card), and "you forgot the last part that says
now it doesn't have to be a secret". So the film was turned inside out:

- **The hook is the first thing you hear** — `song.landsOn` is the OPENING
  beat now, so the track starts at 1:04.52 over the app screen rather than
  building toward it.
- **"now it doesn't have to be a secret" is the CLOSER**, its own dark card
  after the end card, where it used to open the film. Read that way from "the
  last part" — it also plays better there, because with the hook on top the
  line is the answer to it rather than a set-up for it. If she meant it should
  still open, it is one beat to move back.
- **The music STOPS before the film does** (`song.until`, new): the verse turns
  to getting high about eight seconds past the hook, which is not this ad, so
  the track runs 1:04.5 → 1:12.5 and fades, and the closing line plays in the
  quiet. `apad` fills the rest so the mp4 keeps continuous audio.

https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/dream-commercial/spot-v4.mp4

#### The opening she actually wants — grainy black-and-white, waiting on her yes

Her description (2026-08-19): "black-and-white footage of sort of grainy
close-up, confusing shots of someone getting their hair pulled and just like
hand on leg or thigh, and one more shot". That is the DREAM shown the way it
felt, before the app shows it written down — and the contrast is the point:
photographic and unreadable, then her ink drawing sitting calmly in a text box.
**She asked for the prompts before the pictures**, so nothing is drawn yet;
three portrait 1024x1536 shots at medium (~4.1c each) go in front of the app
beat once she says yes. Written as skin-and-shadow crops with no identifiable
face, both because that is the shot she described and because gpt-image-2
refuses anything more explicit — and a dream-app refusal is terminal.

### Before it can go in a public commercial

Nothing here is blocking — it is the one thing to do before the song is
baked into a video that goes out.

- **A commercial needs a sync licence**, which is a different permission from
  streaming it or playing it. Two rights, always: the **composition** (the
  writers/publishers) and the **master recording** (the label). Posting a
  video with the track and no clearance is what gets a YouTube Content ID
  claim or a takedown, and an ad is the least forgiving use.
- **The label to ask is Kitsuné Musique** (Maison Kitsuné's music arm, Paris)
  — an indie, not a major, and a small-scale ask from a small site is exactly
  the kind of request they answer. Afro Comb themselves are reachable on
  their own channels and can point at who clears it.
- **Until it clears**, the honest way to use it is a private/unlisted cut for
  her own review — the edit gets built to the real song so the timing is real,
  and the public version swaps to whatever is cleared.

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
