# Continuity pipelines — who has already built one, and where ours is better or worse

Researched 2026-09-09 on Sophie's question: *"the next step is basically
building a pipeline for continuity, but I feel like people have already done
that. I wonder if we'll be doing it better or worse."* Her three leads:
**RENOISE**, **Runway**, **Agent Opus** (a company, not a model).

Short answer: the continuity *engine* already exists inside the models and
every platform sells a wrapper around it. What nobody sells is the part we
already have — an exact per-shot ledger of prompt + references that can be
re-sent at a higher resolution, real-person references that clear the face
filter, and a door chosen per shot. Build the ledger, a stills-first step and a
finishing pass; don't rebuild the engine.

## Renoise.ai (what RENOISE most likely means)

Multi-model AI video workspace, live in 2026: Seedance 2.5 / 2.0 / 4K, Kling
3.0 Omni, MiniMax H3, Midjourney V7, GPT Image 2 in one canvas. Pitch is
shot-to-shot continuity — multi-reference, first/last-frame chaining, reusable
character/product assets, Seedance 2.5's 50-input mode (30 images, 10 videos,
10 audio). Reported pricing (their marketing, not a measured charge): free
tier, then ~$20/mo for 1,200 credits; ~$0.51 for a 480p 5s clip, ~$1.16 at
720p — i.e. dearer than Atlas (4¢) and APIFRAME (16¢) for a Mini clip. An API
is listed but the endpoint docs were not readable from here — reported, not
verified.

**"FacePass"** — a one-time likeness review that clears a real face you own so
person references stop being refused — was reported by the research pass but
**NOT found on renoise.ai's own pages when fetched directly** (the face-swap
guide only says "your own, or someone else's with their permission; no public
figures"). **Found 2026-09-11 on renoise.ai/features/seedance-2** ("clear it
through FacePass first; the cleared face then works as a reference"; no public
figures or minors) — so it is real on their own page; whether it works is
still unmeasured. It is a compliant version of the eyes-blur trick. The whole
script→movie field, re-read two days later: `script-to-movie-2026-09-11.md`.

Not what she means: the ReNoise inversion paper (image-only, open weights,
cannot touch a closed model), and noise-warping continuity techniques
(Go-with-the-Flow, How I Warped Your Noise) — real and free but need a LOCAL
open-weight model (Wan/CogVideo), so they never reach Seedance through a
reseller. `renoise.com` is the music tracker — a trap for the next chat.

- https://renoise.ai/ · https://renoise.ai/models/seedance-2-5 ·
  https://renoise.ai/guides/ai-face-swap
- https://arxiv.org/abs/2403.14602 (ReNoise) ·
  https://arxiv.org/abs/2501.08331 (Go-with-the-Flow) ·
  https://arxiv.org/html/2504.03072 (∫-noise)

## Runway

- **Gen-4.5 / Gen-4 References** — up to three tagged reference images
  (character, location, object, style) reused across generations; "world
  consistency" is the pitch. ~5-10s clips, 1080p (secondary sources; Runway's
  own page does not state length).
- **Aleph 2** — video-to-video: new angle, relight, add/remove objects while
  keeping the original motion. The genuinely interesting piece for us: coverage
  of a shot she already likes instead of a re-roll. 28¢/s.
- **Act-Two** — performance capture: a driving video + a character image or
  video → the character performs it. 5¢/s. Keeps a face because the face is
  the input.
- **Multi-Shot recipe** — 3-5 shots in 5/10/15s total, optional first frame,
  and the docs give NO consistency mechanism ("reuse the same style
  language"). Shot-list automation, not identity locking.
- **Real people:** ToS is consent-based ("not another person's photo without
  permission"), no public-figure clause; inputs and outputs may train their
  models. Runway's Seedance hosting is reported (third-party, useapi.net) to
  pass an unmodified real portrait.
- **API price** (credits = 1¢): Gen-4.5 12¢/s · Gen-4 Turbo 5¢/s · Seedance
  2.0 Mini **16¢/s, 64-credit minimum = 64¢ a 4s clip** · 2.0 480/720p 36¢/s ·
  2.5 480p 20¢/s + 10¢/s of input video, 720p 30¢ + 15¢, 80-credit minimum.
  4-14x our current door.
- Does not solve: a room staying the same room (references bias, never lock);
  no published multi-shot film case study; the "95% facial consistency"
  figures around are blog claims.
- https://runway.com/research/introducing-runway-gen-4 ·
  https://docs.dev.runwayml.com/guides/models/ ·
  https://docs.dev.runwayml.com/recipes/multi-shot-video/ ·
  https://docs.dev.runwayml.com/guides/pricing/ ·
  https://runway.com/terms-of-use · https://useapi.net/blog/260415

## Agent Opus (OpusClip, opus.pro)

"The first AI video agent for social media": a brief, script, URL or audio in,
a finished captioned 30-90s video out, via a chain of sub-agents (research →
script → storyboard → assets → voice → edit). It aggregates Kling, Hailuo,
Veo, Runway, Sora, Seedance, Luma, Pika and **picks the model per scene
itself** — no pinning a model, a seed, or a per-shot prompt. Continuity is
claimed ("same visual DNA", "consistent characters across scenes") through a
storyboard of keyframes; the only independent hands-on found is a
motion-graphics explainer, and community notes say repeatable characters need
iteration. Up to 8 uploaded photos as Actors/Objects/Logos, "keeps actors
recognizable"; how it handles the Seedance face filter is unmeasured (their
blog says it "routes to alternative models"). Pricing: Pro $29/mo = 120
30-second videos a year (~10¢ a finished second); Max $129/mo. Output 1080p.
API is clipping only, not Agent Opus generation.

For the ward film: better at one-tap voiced/captioned social cuts with failed
renders refunded; worse at everything we need — a shot may land on Kling one
time and Seedance the next, which IS the continuity problem, and there is no
exact-prompt log to re-send at 1080p.

- https://www.opus.pro/agent · https://www.opus.pro/agent/pricing ·
  https://help.opus.pro/agent-opus/article/ao-faq ·
  https://www.opus.pro/blog/multi-model-ai-aggregation-mainstream-agent-opus-leads-video ·
  https://mer.vin/2026/07/agent-opus-explained-opusclip-end-to-end-ai-video-agent/

## The wider field, briefly

- **Model-native:** Seedance 2.5 takes 30 images + 10 videos + 10 audio in one
  pass, makes 30s, and EXTENDS an output holding characters and rooms — our
  last-frame chaining as a first-class feature. Seedance 2.0: the previous clip
  as a video reference carries grade and staging (the guides call continuity a
  craft, identity drift a known failure). Kling 3.0 Elements binds recurring
  characters, 2-6 shots per call. Veo 3.1 "ingredients" + first/last frame,
  rated the strongest reference follower. Sora 2 storyboard holds three shots
  but bans uploaded face images since ~Feb 2026 (self-recorded Cameos only)
  — **and Sora 2 is discontinued: app off 2026-04-26, API off 2026-09-24
  (found 2026-09-11).**
  Open: Wan 2.6 R2V (identity from a 2-30s clip), LTX-2.5 IC-LoRA characters.
- **Products:** LTX Studio (script→storyboard→shots), Higgsfield (a 22-minute
  film cut solo in a week), invideo Agent One, node canvases (Weavy, Flora).
- **What good indie filmmakers do:** still first, animate second — build every
  shot in an image model where iteration is cents (Midjourney sref +
  personalization, Nano Banana refine), then first-frame i2v; character sheets
  over LoRAs; chain a clean face frame forward; finishing pass in this order:
  cleanup → face restore (Topaz Iris) → upscale → grade. That pass is where
  most drift gets hidden.
- https://seed.bytedance.com/en/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5 ·
  https://www.mindstudio.ai/blog/gossip-goblin-ai-filmmaking-workflow ·
  https://invideo.io/blog/kling-3-vs-veo-3-1/ ·
  https://www.creativepadmedia.com/seedance-2-0-video-reference-fixes-continuity-issues/ ·
  https://magichour.ai/blog/how-to-keep-characters-consistent-in-ai-video

## Better or worse — the honest read

**Where ours is better (nobody sells these):**
- the exact prompt + reference ledger per shot (`forge-video-jobs`), which
  makes the 720p/1080p redo a REPLAY rather than a rebuild;
- real-person references — measured which door takes what (Atlas takes a
  person video and a real photo; APIFRAME takes a person video; the eyes-bar
  clears ByteDance direct); Sora bans it, most resellers refuse it;
- a door and a model chosen per shot, at 4¢ a Mini clip against 51-64¢ on
  Renoise or Runway.

**Where ours is worse:**
- no per-shot editing UI — a timeline, variant picking, a re-roll button (the
  belt page is the closest thing);
- weaker than native multi-shot: Kling's 2-6 shots per call and Seedance 2.5's
  30s extension hold continuity INSIDE one generation better than any chain
  of 4-15s clips;
- no finishing pass — face restore → upscale → temporal grade;
- no stills-first step yet: we pay video prices to discover framing.

**What to build next, in order:** (1) a stills-first step — draw each shot's
first frame as a picture, approve it, then animate it; (2) last-frame
chaining through the ledger (by ffmpeg — `return_last_frame` is a measured
no-op on OpenRouter); (3) a finishing pass on the 720p redo. None of it replaces the
"go" rule.

## The plan (2026-09-09, on Sophie's ask; upscaling left out at her word)

Three pieces, all riding the belt and the `forge-video-jobs` ledger that
already exist. Nothing here sends a clip without her "go"; every step is a
card she approves.

**1. Chain the last frame — free, first, and the door hands it over.** The
ledger grows two fields: `lastFrame` (the approved clip's final frame — asked
for on the job on Atlas, scored out of the tail with ffmpeg anywhere else) and
`chainFrom` (which card it came from).

**`return_last_frame` IS THE WAY IN ON ATLAS — MEASURED 2026-09-09, AND IT IS
FREE.** The 2026-09-08 probe that called it a no-op was measuring OPENROUTER,
where it really does return nothing. On Atlas the same flag adds a SECOND
output, `…_last-frame.png`, and it is not a decode of the clip: against the
ffmpeg-decoded frame 96 of the same job it is **1.18x sharper**, carries
**35,125 unique colours against 26,661**, and has **118x the horizontal chroma
detail** (0.1421 against 0.0012 — the decode's chroma is flat between column
pairs, which is exactly 4:2:0). So it is rendered before the h264 encode.
**Atlas billed 40,594 tokens against the video-only formula's 40,594.5** — the
clip's own price to the token, so the frame rides free. Wired the same day,
OFF by default (`returnLastFrame: true`), mirrored to Storage, filed on the log
as `lastFrame`. Full numbers: *`return_last_frame`* in
`docs/modules/audio-and-film.md`.

**AND THE "LAST FRAME IS THE WORST FRAME" WARNING WAS HALF WRONG — measured on
six of her real ward clips the same day.** All six do end on a P-frame, but the
"encoder spends fewest bits there" half is false: the final packet is at or
above the clip's median on four of the six. What is real is CONTENT, about one
clip in six — the last frame's sharpness as a share of the best frame in the
last 25 runs **100% · 100% · 94.8% · 91.4% · 88.9%** and then **27.5%**, and
that one is a shot going soft over its last eight frames, not an encode
artifact. So the rule is **never chain it BLIND**, not never chain it: score
the last half-second and take the crispest frame (`ward-pullstills.py` already
scores exactly this, and it costs nothing), or ask Atlas for the PNG and skip
the question.

**2. Stills first — the frame before the clip.** Every main shot gets a
FRAME step on its belt card before its CLIP step: draw the opening frame,
she approves it (or re-rolls, cents), then it rides as the first image of
the real clip. Two ways to draw it, and the pick is hers:
- **on Mini itself** — a 4s Mini clip on Atlas at ~4¢ is 97 frames drawn by
  the same model, through the same filter, with the same references; pull the
  best frame (the `ward-pullstills.py` scorer already ranks faces). Measured
  cheap, same look as the film. My pick.
- **on gpt-image-2** — 0.5-5¢ at low/medium, but the likeness of a real
  person from an eyes-barred photo is UNMEASURED there, and its look is not
  Seedance's.
Either way the still is filed with its exact prompt and references (the
image ritual), so the 720p redo replays the frame too.

**3. A finishing pass, without the upscale.** Two free ffmpeg passes on the
assembled cut, on the 720p redo not the draft: a grade match across shots
(match each clip's levels and white balance to the shot before it — measured
on the desk-sweep commercial's shape, the seam between two Seedance clips is
mostly colour) and, if she wants it, a face-restore pass on frames (GFPGAN /
CodeFormer, local, unmeasured on her footage). Upscaling is out until she
says.

**Order:** 1 → 2 → 3. Piece 1 is plumbing with no spend; piece 2 changes how
she works the belt and adds ~4¢ a shot (~35 main shots ≈ $1.50); piece 3
waits for the redo.
