# Feed it the script, get the movie — who sells that in September 2026, and what it does with a real face

Researched 2026-09-11 on Sophie's ask: *"what we're doing w continuity /
characters etc / must exist — program: feed full script → makes it into
movie. research."* Companion to `continuity-landscape-2026-09-09.md`
(Renoise / Runway / Agent Opus, and the plan: last-frame chaining → stills
first → finishing pass). Nothing here was bought or sent; every price is off
the vendor's own page unless marked *reported*.

## The short answer

**Yes, it exists — and it exists in the exact shape she means.** As of this
week at least six products take a whole screenplay, break it into scenes and
shots themselves, cast characters from character sheets or reference photos,
keep those characters across every shot, generate each shot, and hand back a
stitched film with voice. Three of them run **Seedance underneath** — the same
model the ward film is drawn on — so the continuity engine is literally ours.

What none of them sells is the two things the ward film actually needs:

1. **A real private person as a character.** Every one either bans real faces
   (anything with Veo or Sora inside), draws a *lookalike* instead of the
   person (PAI, "no face-swapping"), or takes the face only through a
   **consent video the person records themself** (HeyGen's Digital Twin — the
   only door that puts a verified real face into Seedance footage, and it
   caps at 3 people and 15 seconds a shot). Our eyes-bar stills through Atlas
   and APIFRAME are still the only way the doctor, the nurses, Michael and
   the parents ride as *themselves* without each recording a consent clip.
2. **The price of a 27-minute film.** The belt is ~1,627 seconds still to
   shoot. On Mini through Atlas that is about **$18** (1.1¢/s on the sale).
   The same seconds through the script-to-movie products run **$120 to $500**
   (HeyGen · Topview), and invideo's own case study prices its agent films at
   **$315–750 per finished minute** — $8,500–20,000 for ours.

So the honest read is the one the 09-09 doc reached from the other side:
**the program exists, it is a UI over the same engine, and its two missing
pieces (a real face, a cheap door) are the two pieces we built.** What is
worth stealing from them is the *workflow shape* — every serious one is
**storyboard stills first, video second, one shot at a time, with the
character sheet pinned to every shot** — which is piece 2 of the 09-09 plan
and still unbuilt.

## The programs, closest to "feed the script" first

### HeyGen — Video Agent + Avatar Shots (Seedance 2.0 inside)
- **In:** "Paste a screenplay or a simple one line idea"; the agent "drafts a
  scene by scene creative blueprint before anything renders"; "Approve or
  rewrite each beat"; a small change "only revises that part." Sequences up
  to 3 minutes per run; Creator/Pro plans allow finished videos up to 30 min.
- **Continuity:** "Avatar V … holds the same face, wardrobe, and
  micro-expressions across wide, medium, and close-up shots." Seedance mode
  is where the cinematic shots come from; multi-shot prompting with
  `[0s–3s]` timestamps is the documented pattern (their 2026-07-28 guide).
- **A real face — the one YES, with a catch.** "Cast Yourself With a Digital
  Twin" from a photo or a 15-second clip, and it is *consent-verified*: the
  subject records a statement on camera, checked "semantically" and
  "identity-matched" to the training footage — so a twin of Mayra needs
  Mayra to record it; no proxy consent. In Seedance shots: "Only Digital
  Clone avatars with uploaded consent are currently supported", **max 3
  avatars per scene, 15 seconds per generation, max 3 reference images —
  and "elements cannot include a human face."** So a non-twin person (the
  doctor, a nurse) can only be described in words, never shown.
- **Money:** Seedance is on **Pro ($49/mo, 1,000 credits), Business and
  Enterprise** ("Creator plans purchased on or before Aug 17th 2026 should
  still have access"; a new Creator gets the same features "powered by
  HeyGen's other engines"). Video Agent in Seedance mode ≈ 90–120
  credits a finished minute (≈ $4.40–5.90/min at Pro's rate, so ~**$120–160**
  for the ward film if the agent's cut were accepted as is); a hand-directed
  Avatar Shot is a flat **60 credits at 720p / 150 at 1080p for any length up
  to 15s** — ≈ $2.94 / $7.35 a clip, i.e. **$290–735 for 100 cards**. No
  per-shot prompt-and-reference log is exposed; "Videos cannot be edited
  after generation — a new prompt is required."
- https://www.heygen.com/tool/ai-movie-maker · https://www.heygen.com/agent ·
  https://help.heygen.com/en/articles/12402907-how-to-get-started-with-video-agent ·
  https://help.heygen.com/en/articles/14448006-avatar-shots-powered-by-seedance2 ·
  https://www.heygen.com/blog/seedance-2-0-prompting-guide ·
  https://developers.heygen.com/docs/avatar-consent ·
  https://www.heygen.com/pricing ·
  https://help.heygen.com/en/articles/15125761-heygen-credit-based-pricing-plans-explained

### Utopai Studios — PAI 2.0 (its own model)
- **In:** a screenplay pasted as text (no .fdx / Fountain import — reported
  by unite.ai, 2026-03-11); "breaks this into scenes, shots, character
  designs, visual direction."
- **Continuity:** "persistent visual identity anchored to your script … the
  same face, the same style, in every shot and every clip"; sequences of up
  to **16 shots, about one minute**, 4K; the site claims up to 180 seconds
  of continuous generation; "Total Regeneration: edits trigger a full
  recalculation of the sequence."
- **A real face:** it is a *lookalike* machine, on purpose — "PAI doesn't do
  face-swapping — it generates entirely new characters extremely close to
  the reference" (reported, unite.ai), and it "blocks generations involving
  … public figures" (reported, aivorapulse 2026-05-28). The FAQ says nothing
  about private people. So Mayra would come out as a woman who looks a lot
  like Mayra.
- **Money:** $15 (1,000 credits) · $49 (3,500) · $129 (10,000) · $379
  (35,000) a month; credits-per-second is not published anywhere I could
  read, so a per-clip price cannot be given honestly. MP4 export only, no
  watermark on any plan.
- https://www.utopaistudios.com/pai · https://www.utopaistudios.com/faq ·
  https://www.unite.ai/from-screenplay-to-cinema-how-utopais-pai-is-turning-written-stories-into-ai-generated-films/ ·
  https://aivorapulse.com/utopai-studios-review-2026-best-cinematic-ai-tool/

### Topview — Drama Studio (Seedance 2.0 / 2.5 + GPT Image 2)
- **In:** "a one-line story idea, a short plot outline, a full drama script,
  a novel chapter, or a serialized story concept"; the agent writes beats,
  casts, storyboards each shot as a STILL first ("fix anything weird, then
  commit credits to the actual video render"), then renders voiced,
  captioned episodes; a project keeps "characters, locations, props" across
  episodes.
- **Continuity:** reusable character/location/prop records with visual
  references attached to every shot — the character-sheet method.
- **A real face:** "upload your own characters and locations" and Topview's
  avatar tools take a real photo ("upload a photo to fix the avatar's
  appearance"); its use rules only say get permission from people in your
  media. Whether ByteDance's face filter then refuses the photo at the
  Seedance door is **unmeasured** (it goes through an official Seedance API,
  so expect the same `PrivacyInformation` refusal APIFRAME does not give).
- **The deal-breaker for us:** Drama Studio outputs **vertical 9:16 only**
  ("formatted for TikTok, Reels, Shorts"). The ward film is landscape now.
- **Money:** Pro $16/mo annual = 960 credits/yr; **Seedance 2.5 720p is 6
  credits per 4s ($1.20, 30¢/s)**, 1080p 14.8 credits; Ultra $50/mo = 500
  credits/mo at 4.8/8.8 credits. ~**$490** for the belt's seconds at 720p.
- https://www.topview.ai/drama-studio · https://www.topview.ai/pricing ·
  https://generativeai.pub/topviews-new-drama-studio-lets-you-create-episodic-ai-dramas-1f534e0173dc
  (Jim Clyde Monge, May 2026 — a nine-year-old made a 15-minute episode in
  40 minutes; behind a paywall from here)

### LTX Studio (Lightricks) — LTX-2, Veo 3.1, Kling 3.0 inside
- **In:** "Paste a screenplay or script, and LTX automatically breaks it into
  scenes, generates storyboard thumbnails, and suggests camera framing";
  characters, objects and locations are extracted as reusable **Elements**.
- **Continuity:** Elements — "define a character's age, ethnicity, hairstyle,
  wardrobe, and facial details once … maintains that exact appearance across
  every shot" and across projects; a character can be made from an
  uploaded photo ("95% facial consistency per LTX benchmarks" — the
  vendor's number). Per-shot re-roll and a full timeline/edit suite.
- **A real face:** policy is consent-shaped, not a ban — the AUP
  (2026-03-30) forbids "impersonat[ing] real entities or creat[ing] fake
  personas without consent" and says commercial output must not "replicate
  any real-world likeness … unless independently cleared." But which MODEL
  draws the shot decides whether the photo is even accepted: Veo refuses
  photorealistic people, Kling and LTX-2 take them. Unmeasured here.
- **Money:** Lite $15 (8,000 credits) · Standard $35 (28,000, commercial) ·
  Pro $125 (110,000); credits are "computing seconds" and vary by model, so
  no honest per-clip figure. Shots 3–20s depending on model, output to 4K.
  ltx.io itself would not load from this container (header overflow) — the
  figures are from dupple's March-2026 review and LTX's own search snippets.
- https://ltx.io/studio/platform/script-to-video · https://ltx.io/pricing ·
  https://dupple.com/reviews/ltx-studio ·
  https://static.lightricks.com/legal/ltx-acceptable-use-policy.pdf

### invideo — Agent Two ("director-led crew of AI agents")
- **In:** "the complete screenplay and your visual treatment"; a *creative
  producer* agent holds the script and "routes each shot to video models
  like Seedance 2.0, Veo, or Kling" (invideo's own blog, 2026-07-15).
- **Continuity:** "multi-angle reference grids — front, side, profile, back,
  plus close-up panels" attached to every generation; their case study:
  "Seventy seconds. Two characters. The same person across every scene. No
  LoRA needed."
- **A real face:** not addressed. Money, in their own words: "documented
  productions wrapped in 2–5 days" at **"$315–$750 per finished minute"** —
  a 2-minute brand film ≈ $950. That is the real cost of the agent way once
  the re-rolls are counted, and it is 100–200x the Mini door.
- https://invideo.io/blog/ai-filmmaking/ · https://invideo.io/blog/ai-script-breakdown/

### Mootion — screenplay to ANIMATED film
- Takes Final Draft / Fountain, "generates scenes, visualizes characters,
  and produces a complete film" with dialogue-to-animation lip sync; the
  output is animation, not photoreal. Not for this film; noted because it is
  the most literal "feed the script" product of the lot.
- https://www.mootion.com/use-cases/en/ai-screenplay-to-video-tool

### Model-native "script in" — Dreamina Seedance 2.5 and Kling 3.0
- **Dreamina / Seedance 2.5** (live since 2026-07-31): 30s a generation, a
  180s "long-video" beta, 4K, and an **Omni-Modal Reference Mode that takes
  up to 50 inputs including "scripts, character sheets, storyboard frames"**
  with `@reference` tagging. It does NOT break a script into shots for you —
  the script rides as a reference and the shots are still yours to write.
  Dreamina is ByteDance's own door, so the real-face filter is the strict
  one (their liveness/avatar route, in the CLAUDE.md Seedance note).
- **Kling 3.0 Director Mode** (2026-02-05): "Smart Storyboard" splits one
  prompt into up to **six shots in a single generation** with the same
  characters and native audio; "Custom Storyboard" lets you set each shot's
  time and camera. The strongest *in-one-generation* continuity of any door
  — but six shots, not a film, and a Kling look, not Seedance's.
- https://dreamina.capcut.com/seedance/seedance-2-5 ·
  https://dreamina.capcut.com/seedance/seedance-2-5-for-ai-short-drama ·
  https://kling.ai/blog/kling-video-3-director-mode-multi-shot-tutorial ·
  https://kling.ai/quickstart/klingai-video-3-model-user-guide

### Google Flow / Veo — a filmmaking tool, not a script reader
- Scenebuilder, Ingredients (up to 3 images), extend, first/last frame,
  4K upscale, vertical outputs. No script ingestion. And the policy is the
  hard one: "prohibits the generation of unauthorized real-world
  individuals," and Flow refuses photorealistic-people uploads outright in
  some regions (UK threads). Not a door for a real cast.
- https://blog.google/innovation-and-ai/products/veo-updates-flow/ ·
  https://support.google.com/gemini/thread/365369272/can-t-upload-images-of-photorealistic-people-in-flow-veo3-us?hl=en

## Where each one puts a real private person (the whole question for us)

- **As themselves, verified:** HeyGen Digital Twin — the person records a
  consent clip; 3 per shot, 15s, Seedance 2.0, ~$3 a 720p clip.
- **As a lookalike:** PAI (by design), and anything that redraws from a
  character sheet rather than a photo.
- **Photo accepted, filter unmeasured:** Topview, LTX Studio (Kling / LTX-2
  routes), Kling 3.0 Elements — the upload is allowed by policy; whether the
  face clears is a 5¢ test each, none run.
- **Banned:** anything drawing on Veo or Sora.
- **Ours:** the eyes-bar still through Atlas (any real face, unbarred, 4¢)
  or APIFRAME — measured across the whole cast on 09-09. Nobody sells this.

## What is worth taking from them

1. **Stills first, then the clip** — Topview, PAI and LTX all make the
   storyboard frame the approval step before video money is spent. That is
   piece 2 of the 09-09 plan, and it is the one structural thing every
   script-to-movie product agrees on.
2. **The character sheet pinned to every shot** — invideo's "front, side,
   profile, back, close-up" grid and LTX's Elements are what our per-card
   reference lists already are; the belt could carry one *cast sheet* per
   character and attach it by name rather than re-picking stills per card.
3. **A single-generation multi-shot** for the dialogue scenes — Kling 3.0's
   six shots, or Seedance 2.5's 30s, hold a room and a face inside one
   render better than any chain of 4s Mini clips. A per-shot test on one
   office scene would say whether it is worth a second door.
4. **Not worth taking:** letting an agent pick the model per shot (Agent
   Opus, invideo) — that is the continuity problem, arriving by another
   door — or paying 10–200x the Mini price for a UI.

## Open-source and self-hosted (the other two research passes)

_See the sections appended below from the parallel research passes on
open-weight pipelines and on the closed models' multi-shot features._
