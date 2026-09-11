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
- **The Cully Hill Boys** (Higgsfield's own film, premiered Aug 5 2026 at The
  Glasshouse, New York; written up by Metal Lab) — a **110-minute feature with
  a real cast**, shot on **Seedance 2.5 through Higgsfield**, with Claude
  writing the prompts and Nano Banana editing the stills. Real people (UFC fighters
  Israel Adesanya and Quinton Jackson, streamer N3on) signed **likeness and
  voice rights agreements**; source photos contractually deleted within 30
  days, no training use.

**What it is, and how it landed** (Sophie's questions 2026-09-11: gross?
plot? reaction? whose? why?): Higgsfield is the PLATFORM — CEO Alex Mashrabov
(ex-head of generative AI at Snap), ARR past $500M by June 2026, reportedly
raising at up to $5B — and the film is an advertisement for Cinema Studio 4.0
aimed at studios and brands, plus a proof that licensed real likenesses scale;
every prompt, character sheet and the 137-entry production log were then
open-sourced, which is the half people admired. Plot: an action-comedy —
three broke East London rappers try to shoot a music video, end up with a
stolen boat of loot, and land between rival gangs; screenplay by Timothy
Planagan (paid WGA scale). No theatrical run and no gross: free on YouTube and
higgsfield.ai after the premiere (view count unreadable from this container —
YouTube and Variety both refuse it). Reaction, mixed-polite: The Verge called
it a polished proof of concept "demonstrating a pipeline more than telling a
story", with "the best parts all human"; Forbes was "swept into the story"
after a few minutes; Mindplex found it "interesting and fun enough",
Netflix-grade, with too-white teeth, too-crisp props, garbled on-screen text
and weak character interactions, and said fans of the cast might watch it and
nobody else would seek it out.

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
1. **Does 2.0 Mini hold a face across a multi-shot clip?** Researched
   2026-09-11 (Sophie: "can't u research if mini does it?"): every prompt
   guide agrees that **Seedance 2.0 ignores exact timestamps** — they are a
   2.5 feature (prompt-architects, kapwing, morphic; "forcing exact durations
   onto segments can actively break the generation"). What 2.0 DOES follow is
   an ORDERED shot list with no times — `Shot 1 — … Shot 2 — … Shot 3 — …`,
   camera move, then action, then position, then sound — and it finds its own
   pacing. Nobody has published a Mini-specific test. So the Mini form is a
   15-second clip written as two or three numbered shots, on Atlas at
   **~17¢** (1.1¢/s at the sale price). If the face and the room hold across
   the cut, the draft's card count roughly halves.
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
- **Higgsfield is worth knowing about, not paying for — CORRECTED
  2026-09-11 (Sophie: "my ex bf movie got their faces fine right?").** Right:
  *Sean & Jonathan* (Film Editor cut `9WyQ1XE8OvQXrNtnvfsD`, v3 2:45) was drawn
  on Mini through **Atlas** with three real videos of the two men as
  `[Video1..3]` references, 14 jobs on the log, and they came out as
  themselves. So Atlas already takes a real, non-famous person with no
  clearance step. Soul ID is only ahead for a FAMOUS face (the Radcliffe
  output gate) or on a door that refuses people (OpenRouter → ByteDance
  direct). The first draft of this doc said "worth buying"; that overstated
  it.
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

---

## MEASURED 2026-09-11 — Mini DOES cut between numbered shots, and the face holds

Sophie: "yes lay out test · pick 3 scenes · go · spend less than $1." Three
15-second Mini clips through Atlas, 480p 16:9, her own reference set from the
faint clip (the jazz clip as `[Video1]`, the pajamas still as `[Image1]`),
her scene text verbatim split into `Shot 1 —` / `Shot 2 —` / `Shot 3 —` lines
with no timestamps. Atlas billed **251,518 tokens each** (the reference
videos ride as tokens on top of the 144,510 the picture alone costs), so
about **29¢ a clip, ~86¢ total** by the token count — Atlas has no billing
read, so that is an estimate. Cuts measured with ffmpeg `scene>0.3`; the
five-frame strips are on the Compare page *Mini multi-shot test v1* in the
`continuity-characters-research` chat.

- **C — "Tomorrow?" (3 shots, Sophie + the doctor):** cut **three times**
  — 4.2s, 5.9s, 8.2s — wide two-shot with the assistant behind them → the
  doctor's close-up, arms crossed → Sophie's close-up, lip trembling. Same
  face, same doctor, same office across every cut. The clean win.
- **B — the tape sculptures (2 shots):** cut **once** at 9.1s — wide of her
  taping the contraption to the wall → close on her hands and the roll. Same
  face, same room.
- **A — the tray (2 shots):** **no cut** — one continuous take that does
  both actions in order; and in the second half the other patients vanish
  from the background and the tray slides to a different spot. So a
  single-take Mini clip drifts INSIDE the take; a cut is where it re-anchors.

So the 2.0 guides are right that Mini ignores exact timecodes, and the
ordered-shot form works: **2 of 3 clips cut where asked, 3 of 3 held the
face across the clip.** What that does to the draft: a scene that is now two
or three cards can be one 15-second Mini card at ~17-29¢ with the continuity
inside it free — and shot/reverse-shot dialogue (C) is exactly the shape it
does best. A's miss suggests two ACTIONS in one place read as one shot; two
FRAMINGS (wide → close) read as a cut.

Jobs on the log under `chat: continuity-characters-research`, scenes
`mini-shots-A-tray` · `mini-shots-B-tape` · `mini-shots-C-tomorrow`; each
carries its `lastFrame`.
