# Feed the whole script, get the movie — what already exists

Researched 2026-09-11 on Sophie's ask: *"what we're doing w continuity /
characters etc / must exist — program: feed full script, makes it into movie.
research."*

**Short answer.** It exists in three shapes, four platforms sell exactly the
character-consistency thing we are hand-building (under four different names),
and **not one of them makes a movie you can use without directing it shot by
shot** — that is the consensus of every 2026 hands-on review, and of the one
real feature film made this way (28 people, four weeks, $2M).

**The most useful finding is not a product at all.** Seedance 2.5 now takes a
**timestamped shot list in the plain prompt text** and renders up to **30
seconds of several connected shots in ONE generation** — the continuity inside
that generation is the model's problem, not ours. It works through the doors
we already pay for (Atlas lists 2.5 at 4–30s). **Measured on our own log the
same day: 273 jobs on file, ZERO have ever carried a timestamp.** That is the
cheapest thing on this page and it is one prompt away.

---

## 1. The three shapes of "feed the script"

### A — one button: script in, finished film out

The model is chosen for you, per scene, and you get a cut with voice and
captions. No per-shot prompt, no seed, no ledger.

- **Mootion** — "AI handles scriptwriting, scene creation, character
  consistency and cinematic editing"; claims full-length (30+ min) from a
  single prompt. $19/$39/$99 a month, no free tier. Its own reviewers say the
  consistency is "imperfect in practice".
- **Agent Opus** (opus.pro) — brief/script/URL in, 30–90s captioned video out,
  via sub-agents (research → script → storyboard → assets → voice → edit).
  Aggregates Kling, Hailuo, Veo, Runway, Sora, Seedance, Luma, Pika and
  **picks the model per scene itself**. $29/mo ≈ 10¢ a finished second.
  (Covered in full in `continuity-landscape-2026-09-09.md`.)
- **Pippit / ScreenWeaver / Squibler / Saga** — script writing and free
  storyboard passes bolted onto Veo 3.1 / Sora 2. ScreenWeaver's open beta
  (since July 2026) turns a screenplay into a full storyboard for free.

**Why none of these is ours:** a shot lands on Kling one time and Seedance the
next, which IS the continuity problem; there is no exact-prompt log to re-send
at 720p/1080p; and nothing here would pass a real person's face.

### B — the studio: script → breakdown → storyboard → shots, with a CAST

This is the shape of the belt, sold as a product.

- **LTX Studio** — paste a script, it breaks it into scenes, generates
  storyboard thumbnails and suggests camera framing; a character is saved as a
  reusable **Element** and stays recognisable across every shot it appears in.
  Per-shot camera control in 3D, a timeline editor, multi-model. $0–$125/mo.
  Reviewers: "not a type-a-prompt-get-a-video tool… a production environment
  for people who think in scenes, shots and sequences." The closest published
  thing to what we are building.
- **Higgsfield Cinema Studio** — **Soul Cast** (build an AI actor: physique,
  era, backstory, consistent across every generation) and **Soul ID** (upload
  **20+ photos** of one face, it trains an identity that applies across the
  whole model stack — **Kling 3.0, Veo 3.1 and Seedance 2.0**). Also
  **Popcorn**, frame-by-frame visual memory within a session. From $9/mo.
- **Google Flow** (Veo 3.1) — **Ingredients to Video** (reference images for
  characters/objects/style), **Scene Builder** (a timeline that sequences
  generated clips into a scene), and **Scene Extension**, which reads the last
  frames of a clip for character position, lighting and motion and continues
  from them. 275M+ videos generated.
- **Runway** — Gen-4.5 References (three tagged references: character,
  location, object, style), Aleph 2 (new angle / relight of a shot you already
  like), Act-Two (performance capture). Priced 4–14× our door. Full numbers in
  the 09-09 doc.

### C — open source: the same thing as an agent you run yourself

- **ViMax** (HKUDS) — the closest match to her literal ask. Three modes:
  **Idea2Video**, **Script2Video** ("takes explicit screenplays and produces
  controllable multi-scene, multi-shot video while preserving its creative
  intent") and **Novel2Video** (episodic, with character tracking). It
  orchestrates scriptwriting, storyboarding, character creation and the final
  render end to end; **AutoCameo** places a person from a reference photo into
  the story and holds their appearance. You bring three API keys (LLM, image
  model, video model) in `configs/agent.local.yaml`. **It already lists
  Seedance 2.0 Fast as a backend** (added 2026-07-17). No pricing — you pay
  your own providers, i.e. our own 4¢-a-clip door.
- **CutAgent** — Next.js, runs locally with your own fal.ai key; a
  storyboard-first editor with a "Style Harness" chaining visual continuity
  across shots.
- **PenShot** — an LLM agent that breaks a screenplay into Sora/Veo/Runway-ready
  shots while holding character and plot consistency across segments.
- **ai-video-generation-pipeline** (SainathPattipati) — script → storyboard →
  characters → video with a "character consistency engine", pointed at Kling /
  Runway / Luma.

---

## 2. The same feature, five names

| product | what the cast is called | what it holds |
|---|---|---|
| LTX Studio | **Elements** | character, kept across shots in a script |
| Higgsfield | **Soul Cast** / **Soul ID** | an invented actor / a trained real identity from 20+ photos |
| Google Flow | **Ingredients** | character, object, style references per shot |
| Runway | **References** | three tagged refs (character, location, object, style) |
| Agent Opus | **Actors / Objects / Logos** | up to 8 uploaded photos |
| ViMax | **AutoCameo** | a person or pet from one reference photo |
| Seedance 2.5 itself | **Omni Reference** | 30 images + 10 videos + 10 audio in ONE pass |

Everything in that column is the same mechanism we already use — references
attached to a generation — with a UI for reusing them. **None of it locks
identity**; they all bias it, which is why every guide still says to chain a
clean face frame forward.

---

## 3. The real-person question — the one place someone is ahead of us

Her whole reference problem (eyes-blur, which door takes a person) has a
commercial answer, and it is **Higgsfield**:

- **Soul ID** trains on 20+ photos of one face and applies it across Kling
  3.0, Veo 3.1 and **Seedance 2.0** — i.e. the model that refuses our real
  photos at the input filter accepts a Higgsfield-trained identity.
- **The Curlyhill Boys** (Metal Lab, Aug 2026) — a **110-minute feature with a
  real cast**, shot on **Seedance 2.5 through Higgsfield**, with Claude writing
  the prompts and Nano Banana editing the stills. Real people (UFC fighters
  Israel Adesanya and Quinton Jackson, streamer N3on) signed **likeness and
  voice rights agreements**; source photos contractually deleted within 30
  days, no training use.

Their working method, which is ours with two things we don't do:
- faces extracted **only from close-up portraits** (one smiling, one neutral),
  and **faces erased from wide shots** — "the model tends to copy that blur
  directly rather than reconstruct a clean face." *That is a direct comment on
  our eyes-blur stills.*
- **voice-locked by pasting identical condition sentences verbatim** every
  time; rewording caused drift. (Her clothes line already does this.)
- **a separate asset per state** — Cal clean / Cal soaked / Cal injured.
  "Splitting is cheaper than arguing."

The calibration is worth having: **4 weeks, 28 people, $2M (~$1M of it
compute), ~1,000 video assets, 137 logged generation attempts** for 110
minutes. Their honest limits: garbled on-screen text, weak character
interactions, frame rate dipping under 30fps, faces "a little too perfect",
and no singing or sustained fighting — those were pre-recorded audio in 12s
blocks and stunt footage as motion reference.

---

## 4. The finding: a timestamped shot list is one prompt away

Seedance 2.5, as of the July 31 2026 rollout:

- **30 seconds in a single pass** (2.0 ceiling was 15), extension chains to 60,
  and an ultra-long mode does 30–180s in one pass **on Dreamina only**.
- **Up to 50 references**: 30 images, 10 videos (30s total), 10 audio (30s).
- **Second-level text commands** — *"have the character turn at second 3, cut
  to a new scene at second 5."* ByteDance's own words: organising "multiple
  logically connected shots" within one generation.
- **The timestamps go in the plain `prompt` field.** Verbatim example from the
  API guide:

  > `[0:00–0:03] WIDE SHOT — Aerial view of a volcanic island at sunrise, slow
  > push in. [0:03–0:08] MEDIUM SHOT — A researcher emerges from a tent, looks
  > toward the volcano, rack focus to her face. [0:08–0:15] CLOSE-UP — Her eyes
  > reflecting the distant glow, golden hour light, handheld slight tremor.`

  Guidance: keep each beat 1–2 sentences, and give a beat ~8–10 seconds or it
  doesn't land.

**What that means for the ward film.** A scene that is now three cards — three
generations, three chances for the room and the face to drift, three reference
sets to wire — can be ONE generation where continuity is internal. Our own
`/api/footage/status` already lists 2.5 at **4–30 seconds** on all three doors,
so nothing has to be built to try it.

**Measured, and this is the gap:** of the **273** jobs in `forge-video-jobs`,
**none has ever contained a timestamp** (`[0:` appears in zero prompts). 145 of
them are Mini.

**Two cheap tests, in this order:**
1. **Does 2.0 Mini follow timestamps?** Timestamping is advertised as a 2.5
   feature; Mini is the 2.0 family and it is what the 480p draft runs on. One
   15-second Mini clip on Atlas is **~17¢** (1.1¢/s at the sale price) — write
   one card as two beats and look. If it works, the draft's card count roughly
   halves and continuity inside a card is free.
2. **A 30-second 2.5 scene**, on the 720p redo (step 2 of her plan). Atlas
   prices 2.5 at 13.4¢/s at 480p, so a 30s scene is **~$4.02** at 480p and
   **~$9.05** at 720p (the 2.2482× pixel factor) — against roughly the same
   per-second money spent as several separate cards, but with the drift gone.

Neither is sent without her "go", and both are one card on the belt.

---

## 5. What a "feed the full script" program would be here

We are closer than it looks, because three of the four pieces exist:

| piece | theirs | ours |
|---|---|---|
| script → scenes/shots | LTX/ViMax breakdown | **the belt** (`jobs.json`, film order) + `script-cut.js` splitting on the word `cut` |
| a cast that persists | Elements / Soul ID | `refs.json` — every character's still and clip by key |
| the shot goes to a model | their chosen model | `/api/footage` — three doors, per-shot, 4¢ |
| **the exact record** | **nobody sells this** | `forge-video-jobs` — literal prompt + every reference, so the 720p redo is a REPLAY |
| a per-shot editing UI | LTX timeline | the belt deck, the footage feed, the Film Editor |
| continuity carried automatically | Scene Extension | `lastFrame` on Atlas (free, measured 1.18× sharper than an ffmpeg decode) — **built, not yet chained** |

The one genuinely missing piece is the **automatic** part: nothing yet reads
the script and writes the cards with the right references and the previous
shot's last frame already attached. That is a script, not a platform — and it
is the only part worth building, because everything around it we already have
cheaper than anyone sells it.

---

## 6. Honest read

- **"It must exist" — yes, four times over, and none of them is better than
  what she has for THIS film.** The things they sell (a cast list, a
  storyboard, a timeline) are conveniences; the things they can't sell her are
  the ledger, the per-shot door at 4¢, and a real face that clears the filter.
- **The one thing to consider buying is Higgsfield**, and only for Soul ID: a
  trained identity that works on Seedance 2.0 is exactly the problem the
  eyes-blur stills work around, and a 110-minute feature has already been shot
  with it. From $9/mo. Unmeasured from here — it needs an account and 20+
  photos of a face.
- **The one thing to try for free is the timestamped shot list**, today, on a
  17¢ Mini clip.
- **The one thing worth building is the script→cards writer**, not another
  platform.
- ViMax is worth reading even if we never run it — it is our belt as an agent
  loop, open source, already pointed at Seedance.

## Sources

- ViMax — https://github.com/hkuds/vimax
- CutAgent — https://github.com/rishidandu/cutagent ·
  ai-video-generation-pipeline — https://github.com/SainathPattipati/ai-video-generation-pipeline
- LTX Studio reviews — https://dupple.com/reviews/ltx-studio ·
  https://magiclight.ai/academy/ltx-studio-review/
- Higgsfield — https://higgsfield.ai/soul-cast-intro ·
  https://higgsfield.ai/blog/how-to-keep-ai-persona-consistent-higgsfield-popcorn ·
  https://higgsfield.ai/blog/tools-for-consistent-ai-characters
- The Curlyhill Boys — https://metallab.ai/en/2026/8/we-made-the-first-110-minute-ai-feature-film-with-a-real-cast-the-cully
- Google Flow / Veo 3.1 — https://blog.google/innovation-and-ai/products/veo-updates-flow/ ·
  https://whiskailabs.net/google-flow-ai-filmmaking-tool-veo-guide-2026/
- Mootion — https://www.mootion.com/use-cases/en/ai-screenplay-to-video-tool ·
  https://www.tubegen.ai/reviews/mootion-review
- Seedance 2.5 — https://seed.bytedance.com/en/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5 ·
  https://pixo.video/blog/seedance-2-5 ·
  https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts ·
  https://www.seedance.tv/blog/seedance-2-5-timestamp-prompts
- The honest-review consensus — https://mstudio.ai/insights/best-script-to-video-tools-2026 ·
  https://www.screenweaver.ai/blog/script-to-video-ai-tools-compared-2026
