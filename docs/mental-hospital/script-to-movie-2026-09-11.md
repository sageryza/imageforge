# Feed it the script, get the movie — who sells that in September 2026, and what it does with a real face

Researched 2026-09-11 on Sophie's ask: *"what we're doing w continuity /
characters etc / must exist — program: feed full script → makes it into
movie. research."* Companion to `continuity-landscape-2026-09-09.md`
(Renoise / Runway / Agent Opus, and the plan: last-frame chaining → stills
first → finishing pass). Nothing here was bought or sent; every price is off
the vendor's own page unless marked *reported*.

## The short answer

**Yes, it exists — and in the exact shape she means.** As of this week
about a dozen products take a whole screenplay, break it into scenes and
shots themselves, cast characters from character sheets or reference photos,
keep those characters across every shot, generate each shot, and hand back a
stitched film with voice. The ones that genuinely ingest a *script* (not a
one-line idea): **HeyGen Video Agent, Utopai PAI, LTX Studio, invideo Agent
One/Two, Topview Drama Studio, Katalist, mStudio, Pixo, Dreamina's AI Video
Agent, Mootion (animated)**, plus one open-source program, **ViMax**. Most
of them run **Seedance underneath** — the same model the ward film is drawn
on — so the continuity engine is literally ours; the product is the
storyboard, the cast sheet and the timeline around it.

What none of them sells is the two things the ward film actually needs:

1. **A real private person as themselves, cheaply.** The doors split three
   ways. *Banned:* anything drawing on Veo, Sora (now shut down) or
   ByteDance's own Dreamina. *Lookalike:* PAI ("doesn't do face-swapping").
   *Allowed, with a consent layer or a rights clause:* HeyGen's Digital
   Twin (the person records a consent clip; 3 per shot, 15s), Higgsfield's
   Soul ID (20–80 photos you hold rights to), invideo ("only use likenesses
   you have the rights to", with a per-shot verification pass), Renoise's
   FacePass (a likeness review), and Katalist / mStudio / OpenArt /
   LTX (a photo upload is allowed by policy — whether the model behind it
   then refuses the face is the same 5¢ question we already answered for
   Atlas and APIFRAME, unmeasured there). None of them takes a barred still
   of the doctor or a nurse the way our two doors do.
2. **The price of a 27-minute film.** The belt is ~1,627 seconds still to
   shoot. On Mini through Atlas that is about **$18** (1.1¢/s on the sale).
   The same seconds through the script-to-movie products run **$100 to
   $900** (OpenArt · HeyGen · mStudio · Topview · Higgsfield), and invideo's
   own case study prices its agent films at **$315–750 per finished minute**
   once the re-rolls are counted — $8,500–20,000 for ours.

So the honest read is the one the 09-09 doc reached from the other side:
**the program exists, it is a UI over the same engine, and its two missing
pieces (a real face for cents, a per-shot ledger) are the two pieces we
built.** What is worth stealing from them is the *workflow shape* — every
serious one is **storyboard stills first, video second, one shot at a time,
with the character sheet pinned to every shot, and a verification pass that
compares each shot's face to the sheet** — which is piece 2 of the 09-09
plan and still unbuilt. And one model moved under us: **Wan 3.0** now takes
a script *file* plus 20 references in a single 30-second pass at 5¢/s with
no face rule in its docs — unmeasured on our footage, one 8s draft is 40¢.

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

### invideo — Agent One / Agent Two ("director-led crew of AI agents")
- **In:** "the complete screenplay and your visual treatment"; a *creative
  producer* agent holds the script and "routes each shot to video models
  like Seedance 2.0, Veo, or Kling" (invideo's own blog, 2026-07-15). Agent
  One makes films "up to 30 minutes" from one brief (*reported*); stitched
  with voice, music and subtitles; one shot can be changed without
  re-running the film.
- **Continuity:** "multi-angle reference grids — front, side, profile, back,
  plus close-up panels" attached to every generation, plus **a verification
  pass on every generation, comparing the output against your character
  reference** — drift "flagged and regenerated", enforced at the agent
  layer. Their case study: "Seventy seconds. Two characters. The same
  person across every scene. No LoRA needed."
- **A real face:** allowed by rights — **"Only use likenesses you have the
  rights to"** (vendor). Which model then draws the shot is the agent's
  call, so a real photo can land on Veo and be refused, or on Seedance and
  pass, per shot; that is Agent Opus's problem again (the 09-09 doc).
- **Money:** Starter $20 / 400 credits ("~15 Seedance 2 videos", length
  unstated), Plus $50 / 2,000, Max $100 / 5,000; no rollover. In their own
  words: "documented productions wrapped in 2–5 days" at **"$315–$750 per
  finished minute"** — a 2-minute brand film ≈ $950. That is the real cost
  of the agent way once the re-rolls are counted, 100–200x the Mini door.
- **Hands-on** (Kingy.ai, 2026-05-24, *reported*): a 60s six-scene short —
  characters stayed locked, the first batch "leaned cartoony", 3 of 6 scenes
  usable first try.
- https://invideo.io/blog/ai-filmmaking/ · https://invideo.io/blog/ai-script-breakdown/ ·
  https://help.invideo.io/en/articles/14717491-get-started-with-ai-filmmaking ·
  https://invideo.io/make/character-consistency/ · https://invideo.io/pricing ·
  https://kingy.ai/news/invideo-agent-one-review-the-ai-filmmaker-that-finally-remembers-what-youre-making/

### Higgsfield — Supercomputer + Soul ID + Cinema Studio
- **In:** Popcorn takes a script or scene description and draws 4/6/8-frame
  storyboards; "Supercomputer" is a chat agent — "5-10 minute film — Script,
  cast, scenes, music, edit — done" — that holds the shot list and the
  assembly order and shows the credit cost before each render.
- **Continuity:** **Soul ID** — an identity trained from 20–80 photos —
  "applies automatically across both image generation and video generation
  … including Seedance 2.0, Veo 3.1, and Kling 3.0" (their FAQ, 2026-08-28;
  another of their pages the next day says the persona layer "runs inside
  image generation specifically" — partially contradictory). Popcorn holds
  identity only inside a session; they say "identity and lighting
  consistency degrade past 30 seconds".
- **A real face: yes** — "as long as you hold usage rights for the photos
  you upload". The strongest answer to the real-person question of any
  product here, and the dearest.
- **Money (vendor, approximate):** Soul ID ~$1.25 a character; Cinema
  Studio ~$3.75 per 8s at 720p (≈47¢/s), ~$7.50 per 15s at 1080p; "full
  5-minute short ~$150–160" → **~$850 for the belt**. Plans $19 / $47 / $99.
  Reported limitation: Soul ID does not reach Kling Motion Control, "resulting
  in character face drift".
- https://higgsfield.ai/blog/ai-short-film-pipeline ·
  https://higgsfield.ai/blog/sould-id-best-character-consistency ·
  https://higgsfield.ai/supercomputer-intro

### OpenArt — Story / Smart Shot / Director (Seedance 2.0/2.5, Kling 3.0, Veo 3.1, GPT Image 2)
- **In:** One-Click Story takes "any idea, script, beat, or character" → up
  to 60s; **Director** (2026) takes a text/image/audio/video brief → a
  scene-by-scene storyboard → films "up to five minutes", and a single
  frame, scene or character can be changed after (*reported*).
- **Continuity:** saved Characters ("Upload an existing image to define your
  character's appearance") and Worlds; the vendor's own caveat: "AI
  continuity is not guaranteed and every scene still needs review."
- **A real face:** no ban in the terms (2026-07-30 — only "misrepresents
  someone … Deep Fake"); the model underneath decides, and there is no way
  to pin one model film-wide.
- **Money:** $14 / 4,000 credits ≈ $3.50 a ≤60s story ≈ **6¢/s → ~$100 for
  the belt** in Story mode; Director's per-minute cost is not published.
- https://openart.ai/features/director · https://openart.ai/characters ·
  https://openart.ai/pricing

### Katalist · mStudio · Pixo — script in, storyboard, video, export
- **Katalist**: paste a script (or CSV/Word/PowerPoint) → shots; cast a
  character once ("optionally, you can upload a photo reference for your
  character's face"), @-reference it, swap across the board; Runway, Veo,
  Kling, PixVerse, Wan, LTX-2 inside; full export with 300 voices; $19 /
  700 credits. Hands-on (kripeshadwani, 2026-06-10): consistency praised,
  "disfigured anatomy … unnatural limbs" in frames.
  https://katalist.ai/storytelling ·
  https://help.katalist.ai/en/articles/10720071-how-to-personalize-your-characters-in-katalist
- **mStudio**: screenplay PDF/Fountain → shot-by-shot frames → Veo / Kling /
  Runway → timeline with voice and music → mp4; "add each character once
  with a reference image"; **18¢/s of video** (≈ $290 for the belt), 25¢ a
  frame, $27–199; terms ban only undisclosed deepfakes.
  https://mstudio.ai/features/ai-storyboard-generator · https://mstudio.ai/pricing
- **Pixo**: chat → script → shot-by-shot approval → **Seedance 2.0/2.5, Wan
  3.0, MiniMax H3** → 1080p with voice/SFX/music; an asset library for the
  cast; $19.90 / 1,000 credits; no real-person policy stated.
  https://pixo.video · https://pixo.video/pricing

### Dreamina — AI Video Agent (ByteDance's own door)
- "Text scripts, character designs, and scene outlines" on an infinite
  canvas → "production-ready scene breakdowns, clips, or storyboard
  frames", asset nodes per character, a timeline. Seedance 2.5 at ~9.7¢/s
  on the annual plan (vendor, 2026-08-14). **Real faces rejected** — the
  same filter we measured on 09-08. Hands-on (MindStudio, 2026-08-06,
  *reported*): a 2:22 short from 15 generations with three references,
  "decoherence and morphing still occur, particularly in fast action",
  $90–355. https://dreamina.capcut.com/ai-video/ai-video-agent

### Renoise — FacePass IS on their own pages now
- The 09-09 doc could not find it; it is on renoise.ai/features/seedance-2:
  "Seedance 2.0 blocks any reference image containing a detectable real
  human face … clear it through FacePass first; the cleared face then works
  as a reference"; "public figures and minors are not permitted." Still
  no script→film feature, still ~33¢/s at 720p.
  https://renoise.ai/features/seedance-2 · https://renoise.ai/guides/ai-face-swap

### Not this, briefly
- **Saga** (screenplay in, but shots described by hand, ~$5 a video),
  **Showrunner** (a prompt, not a script; animated episodes in its own
  engine), **Boords / Storyboarder.ai / Filmustage** (stop at the
  storyboard), **Pika, Luma, Magnific (was Freepik), Lovart, Vidu Agent,
  Hailuo Video Agent** (clip tools or marketing agents, no script→film).
- **Sora 2 is discontinued** — app off 2026-04-26, API off 2026-09-24.

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

- **As themselves, through a consent or rights layer:** HeyGen Digital Twin
  (the person records a consent clip; 3 per shot, 15s, Seedance 2.0, ~$3 a
  720p clip) · Higgsfield Soul ID (20–80 photos you hold rights to, ~47¢/s)
  · invideo ("likenesses you have the rights to", verified per shot,
  $315–750 a minute by their own count) · Renoise FacePass (a likeness
  review, ~33¢/s).
- **As a lookalike:** PAI (by design), and anything that redraws from a
  character sheet rather than a photo.
- **Photo accepted by policy, filter unmeasured:** Topview, LTX Studio,
  Katalist, mStudio, OpenArt, Kling 3.0 Elements, Vidu Q3, MiniMax H3,
  Wan 3.0 — whether the face clears the model's door is a 5¢ test each,
  none run on our cast.
- **Banned:** anything drawing on Veo / Gemini Omni, Sora (gone), or
  ByteDance's own Dreamina.
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
3. **A verification pass** — invideo compares every generated shot against
   the character reference and re-rolls on drift. `ward-likeness.py` already
   scores exactly that (SFace cosine against the unbarred still); running it
   on every landed clip and flagging the ones under a threshold is a free
   version of their agent layer.
4. **A single-generation multi-shot** for the dialogue scenes — Kling 3.0's
   six shots, Seedance 2.5's 30s, or **Wan 3.0's 30s with a script file and
   20 references at 5¢/s** — hold a room and a face inside one render better
   than any chain of 4s Mini clips. One office scene shot both ways would
   say whether it is worth a second door; the Wan test is the cheapest and
   the only one with no documented face rule.
5. **Not worth taking:** letting an agent pick the model per shot (Agent
   Opus, invideo) — that is the continuity problem, arriving by another
   door — or paying 6–200x the Mini price for a UI.

## The free version of the program — ViMax, and what open weights can do

- **ViMax (HKUDS, MIT, 12.3k★, v1.2.0 2026-07-20) is the open-source "feed
  the screenplay" program.** Idea2Video / **Script2Video** / Novel2Video:
  "turn a short concept into structured stories, characters, scripts,
  storyboards, shots, and a finished video"; **AutoCameo** "place[s] a
  person or pet from a reference photo into generated stories while
  maintaining a consistent appearance"; it coordinates "references, first
  frames, camera continuity, and final assembly end to end" and stitches
  voice and sound. The catch: its video backends are closed APIs — Veo,
  Seedance 2.0 Fast, MiniMax — configured per provider by YAML/env with a
  base URL, so it inherits whichever door's face filter it is pointed at.
  Pointing it at Atlas or APIFRAME would need a small adapter; it is the
  one place the *shape* of this whole category exists as code we could
  read and bend. https://github.com/HKUDS/ViMax
- **The research frameworks are not products.** MovieAgent (showlab, script
  + a photo/audio bank per character, inference code from March 2025 and
  nothing since), VideoGen-of-Thought (one sentence in), StoryMem (Dec
  2025, the most runnable: a JSON script of per-shot text + character
  stills → minute-long 8–12-shot stories at 832×480 on Wan 2.2), Memento /
  SlotMem / IAMFlow / MovieGrid (2026, research-grade, 8×A100 in one case).
  VideoDirectorGPT, Mora, MovieDreamer, DreamFactory, StoryAgent,
  Anim-Director: paper-only or "code coming soon".
  https://github.com/showlab/MovieAgent · https://github.com/Kevin-thu/StoryMem
- **Open weights that hold a face — and no filter anywhere.** No open model
  ships a safety checker, so a private person's photo is never refused
  locally; the only limits are licences (Apache-2.0 for the Wan family,
  Phantom, MAGREF, Stand-In; LTX's community licence forbids impersonation
  without consent — fine for a consenting cast).
  - **LTX-2.5** (Lightricks, open weights 2026-08-11): 22B, video + audio in
    one pass, **native multishot** (2–4 shots written as one paragraph),
    per-person LoRAs via ltx-trainer, ~23 GiB int8 on a 4090; ~$0.002/s of
    rented GPU, fal $0.09/s 720p. Arena Elo ~150 under Seedance 2.0.
  - **Wan 2.2 + Stand-In** (one photo → identity adapter; its README says
    do not describe the face in the prompt — our rule) / **Phantom** (1–4
    reference images incl. people) / **VACE** / **MAGREF**, all in Kijai's
    ComfyUI wrapper; 480p ≈ $0.04–0.05/s at full steps on a rented H100, a
    tenth of that with the 4–8-step LoRAs. No native audio.
  - **SkyReels-V3** (Jan 2026): reference-to-video from 1–4 stills, 5–30s
    extension, talking heads to 200s — one vendor, thin community.
  - **Wan 2.6 / 2.7 / 3.0 are API-only** (open Wan stops at 2.2);
    **MiniMax H3** has open weights but its licence bars self-hosting in the
    US/EU/UK/KR.
  - What a 25-minute film would cost to *compute*, with retakes: **$10–25
    on LTX-2.5, $50–150 on the Wan stack** — against ~$18 on Mini. The
    price is not the reason to go open; the unfiltered face and the
    fixable pipeline are, and the quality is measurably under Seedance.
  https://github.com/Lightricks/LTX-2 · https://huggingface.co/Lightricks/LTX-2.5 ·
  https://github.com/WeChatCV/Stand-In · https://github.com/Phantom-video/Phantom ·
  https://github.com/kijai/ComfyUI-WanVideoWrapper · https://github.com/SkyworkAI/SkyReels-V3 ·
  https://artificialanalysis.ai/video/leaderboard/text-to-video

## The closed models' own multi-shot, and the real-face policy at each door

Re-measured 2026-09-11 from vendor docs (third-party marked *reported*):

- **Seedance 2.5** (2026-07-31): 30s a pass, "multiple logically connected
  shots" in one generation, multi-round extension, 30 images + 10 videos +
  10 audio. Real faces: ByteDance's own doors "restrict making videos from
  images or videos that contain real faces"; "vetted clients" can
  face-verify a person in the ModelArk console (`asset://`), and BytePlus
  calls the real-human library "invited users only". **Atlas and APIFRAME
  are the doors that do not filter — unchanged.** Price: OpenRouter 10¢/s
  480p, Atlas 13¢ (measured), APIFRAME 13¢; 720p ≈ 2.2x. **No Seedance 3.0
  exists.**
- **Wan 3.0** (Alibaba, GA 2026-08-24, API ref updated 2026-09-10): the
  quiet standout for our shape — **2–30s in ONE pass, 10 images + 5 videos +
  5 audio + ONE DOCUMENT (docx/pdf/txt/md, ≤50 pages — a script rides as a
  reference file), extend forward/backward, 480/720/1080p at $0.05 / $0.10 /
  $0.20 a second**, and **not one sentence about faces or portrait rights in
  its docs**; Atlas's own 30s realistic-face guide reports no refusals
  (*reported*, 2026-08-24). Unmeasured on our footage; one 8s draft is 40¢.
- **Kling 3.0** (2026-02-04): Director Mode, 1–6 shots ≤15s a pass, Elements
  (2–4 images + a video + an audio each, 3 per task); a "Face Model" you
  train from 10–30 selfie videos on Pro/Premier (*reported*); ToS is
  consent-shaped, no documented input face filter. 720p $0.084/s silent,
  $0.126 with audio; no 480p. Retires ten older models 2026-09-15.
- **MiniMax H3 / H3 Max** (2026-07-31 / 08-27): 9 images + 3 videos + 3
  audio, 4–15s, **$0.05/s at 480p**, no documented face filter (*reported*).
- **Vidu Q3** (2026-04-13): up to 7 reference images, 3–16s, camera
  switching inside one clip, $0.035/s at 540p; consent on you, no filter
  documented.
- **Veo 3.1 / Flow / Gemini Omni 1.1 Flash** (2026-08-27): 3 references, 8s
  a pass, extend to 148s at 720p only; `personGeneration=allow_adult` for
  a private adult but a famous-face filter and, on Omni, "uploading and
  editing images containing certain recognizable people is not supported".
  Lite $0.05/s, Standard $0.40/s.
- **Sora 2 is gone** — app off 2026-04-26, API off 2026-09-24. The 09-09
  doc's Sora line is history.
- **Runway**: nothing new on references since 09-01 beyond hosting Seedance
  2.5 (20 credits/s) and Wan 3.0; policy is consent-based.
- **Published consistency tests, none with a real private person across 5+
  shots on every model (all *reported*):** Seedance 2.5 held identity across
  8-shot single prompts in 2 of 3 runs while 2.0 "drifted at shot 5–6"
  (seedance2-video.com, 08-15); Kling 3.0 9.5 / Seedance 2.0 9.4 / Veo 3.1
  9.2 on a 4-scene clip (Brand Hopper, 07-27); Seedance 2.5 and Vidu the
  only ones keeping two characters distinct (neural4d).
- **Cheapest doors that hold one real person and one room, 480p, most shots
  a pass:** Mini via Atlas 1.1¢/s (4–15s, by prompt only) · Wan 3.0 5¢/s
  (30s, 20 refs + a script file) · H3 Max 5¢/s (15s) · Vidu Q3 3.5¢/s (16s,
  540p) · Seedance 2.5 13¢/s (30s, the strongest per pass).
- https://seed.bytedance.com/en/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5 ·
  https://docs.byteplus.com/en/docs/ModelArk/2315856 ·
  https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-api-reference ·
  https://www.atlascloud.ai/blog/tips/wan-3.0-realistic-faces ·
  https://kling.ai/quickstart/klingai-video-3-model-user-guide · https://kling.ai/docs/user-policy ·
  https://huggingface.co/MiniMaxAI/MiniMax-H3 · https://platform.vidu.com/docs/reference-to-video ·
  https://ai.google.dev/gemini-api/docs/veo · https://ai.google.dev/gemini-api/docs/omni ·
  https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation ·
  https://runway.com/changelog · https://seedance2-video.com/blog/seedance-2-5-tested-2026 ·
  https://thebrandhopper.com/learning-resources/best-ai-video-models-for-character-consistency/
