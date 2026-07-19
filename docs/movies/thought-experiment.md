# "Thought Experiment" — movie concept (working title)

Sophie's contemplative diary-comic short: the idea that we are a thought
experiment God is running, and the wonder of the mental becoming physical.
Built through the Movies pipeline (`movies.js`), diary-comic watercolor style
(`refs/movie-style.jpg`).

## Source recordings (masters live here so they can't be lost)
- **`assets/voiceover-master.m4a`** — Sophie's real voice reading the narration.
  **2:49.7** long. This is the actual voiceover track that gets muxed into the
  finished film (not a clone).
- **`assets/visual-direction-memo.m4a`** — Sophie describing how it should look
  (a note to Claude, not in the film). Recording trails off at "And then…".
- **`assets/voiceover-whisper.json`** — Whisper verbose transcription of the
  voiceover, with per-segment timestamps (used for the beat timing below).

## Voiceover transcript + timing (from Whisper)
Total **169.7s**. Segment starts:

- `0:00` I've been thinking about how we're kind of a thought experiment that God was having.
- `0:10` Imagine you had a thought experiment in the bath… what would happen if
- `0:13` I ran into my ex… he had another girlfriend or something.
- `0:21` So in your mind, you plan all sorts of possibilities that might take place.
- `0:25` But of course, you're controlling the people in your mind, and they do what you say, except
- `0:30` sometimes they don't do exactly what you say, and you run the experiment to see what
- `0:33` exactly would happen in each set of circumstances.
- `0:36` Like suppose you looked really good that day, or suppose you looked really bad.
- `0:41` You run the experiment and you see the results.
- `0:48` Now imagine that in that experiment, these people were actually real people.
- `0:54` They had their own mind, and they could make choices that you didn't understand or didn't
- `1:07` know about. And you could learn about them through these… what would happen through
- `1:16` This I think is what it's like when God created us.
- `1:20` He created us in this world where we can experience things.
- `1:24` And it's like he's not there thinking about us, even though he actually is, because he
- `1:28` wanted us to feel like we were really
- `1:39` doing stuff and immersed in the experience to see what would happen.
- `1:47` If you want to perform an accurate thought experiment, you can['t] get involved in the choices, right?
- `1:57` Anyway, this got me thinking, what if you had a thought experiment, and then the people
- `2:02` in your thought experiment actually came, they actually existed, and the world that
- `2:07` you created in your head for the experiment was actually a real world, and it started
- `2:13` acting independently of you.
- `2:16` I think that is true… you can't 100% predict what will happen.
- `2:22` But if you were as powerful as God, then you could actually create entire worlds, and they
- `2:29` would actually become physical.
- `2:33` I think Jesus or somebody said this… the most amazing thing
- `2:37` is how the mental became physical, meaning that everything you see started as a thought.
- `2:46` Someone else's thought.

### Two transcription notes to confirm
- **`1:47`** — Whisper heard "you **can** get involved in the choices," but the
  sense (and Sophie's typed version) is "you **can't** get involved in the
  choices" — an accurate experiment requires NOT interfering. Using **can't**.
- **`2:46` (final line)** — Sophie's typed version: "**Someone** else's thought."
  Whisper: "**Everyone** else's thought." Confirm which for the closing beat.

## Visual direction (from the memo, verbatim-ish)
- A girl in her bathtub with a **thought bubble**; inside it she sees her **ex
  with the new girl**, at a **supermarket aisle**. First version: **normal
  clothes**.
- On "suppose you looked really good" — same bubble scene, she's now in an
  almost **Minnie-Mouse dress** (red with large white polka dots) and a **fancy
  wide-brim straw hat with a ribbon**, **fawning over herself** ("oh, look at
  me" — not showing off, just admiring).
- Transition: a **"poof"** — she disappears with **motion lines** radiating out.
- Replaced with her looking **shabby**: **torn green pants** (torn unevenly, one
  leg longer), a **too-loose black shirt**, **messy hair, no hat**, looking
  **anguished/disgruntled**.
- On "what if the world became real" — back to the **bath + thought bubble**; the
  camera **zooms into the bubble** until it fills most of the screen (a thin
  bubble border stays in the corners).
- Just before the room: **outside, a tree materializes** from little colored
  particles (establish the effect as something "normal" first).
- Inside: a **guy in his room** on his bed, **dingy 90s room**, **neckbeard**
  type, lives in mom's basement, eats chicken nuggets. Around him objects
  **materialize from little particles in their final colors** — a **PS3-ish
  console, a microwave, a crappy TV** — everything appears out of thin air.
- Bring it back to the audience — **"this could be me,"** since the listener may
  literally be lying in their room while listening.
- (memo trails off: "And then…")

## Beat sheet (visuals synced to the voiceover)
1. **`0:00–0:20`** Bath + thought bubble; ex + new girl at the supermarket;
   she's in normal clothes. (over "thought experiment… ran into my ex")
2. **`0:36–0:40`** "looked really good" → polka-dot dress + straw hat, fawning.
3. **`0:40–0:41`** poof + motion lines (transition).
4. **`0:41–0:47`** "looked really bad" → shabby torn-pants/loose-shirt version,
   anguished. ("you see the results")
5. **`0:48–2:01`** THE OPEN MIDDLE — a full ~1:15 of abstract theological VO
   ("real people with their own minds… this is what it's like when God created
   us… immersed in the experience") with **no visuals specified yet**. Needs
   direction (held shots? the bubble-people moving on their own? something else).
6. **`2:02–2:16`** "the people actually existed… the world became a real world,
   acting independently" → back to bath + bubble, **zoom into the bubble**.
7. **`2:07–2:16`** Outside: **tree materializes** from particles.
8. **`2:16–2:33`** 90s basement guy on his bed; **console / microwave / TV
   materialize** from colored particles.
9. **`2:33–2:47`** Pull back to the audience / "this could be me"; end on
   **"everything you see started as a thought. [Someone] else's thought."**

## Where this film pushes on the current pipeline (refinement targets)
The pipeline today makes **silent** films of ~8–12 short (~5s) clips with
**subtle, camera-static** motion and a character **anchor that holds clothing
constant**. This film needs several things it can't do yet:

1. **Voiceover track + timing-driven durations.** Mux `voiceover-master.m4a` as
   the audio, and size each on-screen beat to its VO segment (a 170s narration
   over held panels + a few animated beats — not 12×5s of silence).
2. **Same face, deliberately different wardrobe.** The good→shabby switch is the
   SAME girl in DIFFERENT outfits — the opposite of what `anchorClause()`
   enforces ("same clothing"). Need an identity-hold / wardrobe-swap mode.
3. **Bold motion, not just subtle.** The poof-morph, the particle
   materialization, and the zoom-into-the-bubble are big effects; the default
   motion style is "subtle… camera completely static." Need per-beat bold motion
   (bridges / Kling handle morphs better than Wan-fast).
4. **Picture-in-picture + zoom pair.** The thought-bubble composition, then a
   matched-composition pair (bubble small → bubble filling the frame) for the
   zoom-in.
5. **Format/aspect.** The listener "laying in their room" implies a personal
   listen — vertical 9:16 (Shorts/Reels) vs landscape. Panels are 2:3 now.
   Confirm target platform + aspect.

## Decisions
- **Format: portrait, 1080×1920 (9:16)** for Reels/Shorts, artwork letterboxed
  with **black bars top & bottom** (not edge-to-edge tall). Panels are 2:3, so
  they letterbox cleanly. (Sophie, 2026-07-19.)
- **Voiceover: Sophie's real voice recording** (`assets/voiceover-master.m4a`),
  laid down as one unbroken track with visuals timed underneath it. Approach
  approved 2026-07-19 ("I love that idea. Build").

## Pipeline changes — BUILT (this branch)
Additive, backward-compatible with existing movies:
1. **Voiceover attach + Whisper timing** — `POST /api/movies/:id/voiceover`
   (data URL or url; `transcribeAudio()` → word/segment timestamps stored on
   `movie.voiceover`). Accepts precomputed `timing` to skip Whisper.
2. **Timed beats** — `scene.startAt` (seconds into the VO). `POST
   /api/movies/:id/timeline` sets startAt + aspect + per-beat overrides.
3. **Voiceover-clock stitch + letterbox** — `stitchTimeline()`: each beat's
   window = `[startAt, nextStartAt]`; clip fitted (trim / freeze-extend) or
   panel held as a still, letterboxed to `movie.aspect` canvas, then the
   unbroken voiceover muxed under it. `POST /:id/stitch` auto-picks timeline
   mode when a voiceover + timed beats exist (`mode` forces).
4. **Same face, new outfit** — `scene.outfit` → identity-hold wardrobe swap in
   `anchorClause()` (keeps face/hair, changes only clothing). For good↔shabby.
5. **Bold motion** — per-beat `scene.motionPromptOverride` already bypasses the
   static-camera lock (used for the poof / particles / zoom clips). No new code.
6. **Hand-authored scenes** — `POST /api/movies` accepts a `scenes` array (exact
   beats/outfits/startAts) to skip the GPT breakdown.

## Still open
- What plays over the **open middle** (`0:48–2:01`) — needs Sophie's call.
- Final-line wording: "**Someone**" vs "**Everyone**" else's thought.
