# Universe Reel — shot list, prompts, and run log

Sophie's short reel built on one analogy: our world as an elegantly designed,
self-contained creation, told through video game imagery. God shapes the Earth
like clay; souls drop into bodies (match-cut against a video-game character
drop); the universe's suspicious "design choices" (a walkable sphere, reality
rendering only when observed, the speed of light as a hard cap); the soul
ascends after death and quietly levels up. No stated conclusion — the visuals
let the viewer decide.

**Voiceover is not written yet** (her note on the shot list): images and video
clips first, then the VO is fitted to them. VO alignment, when it comes, uses
the NDE precise-cutting pipeline (`docs/nde-precise-cutting.md`), per her
movie-pipeline memo (`docs/movies/sophies-movie-pipeline.md`).

**Working chat:** `thomas-campbell-clip-movie` since 2026-08-27 (Sophie
archived the animation chat — her note: "opus superseded" — and asked this
chat to take the movie over). Stills + prompts live in
`new-session-e0f161`'s Assets tab, storyboard in its Compare tab. Source
shot list: her upload 2026-08-16, reproduced verbatim below.

## Take-over state (2026-08-27, `thomas-campbell-clip-movie`)

- **The VO now EXISTS** — the "not written yet" note below is history. It is
  a 1:49 audio spine: Sophie's Max take (ElevenLabs "Max — 1940s RP British",
  2026-08-27 2:41pm, science-vs-fairies setup ending "Let's ask physics,
  Steven Puddleboots") joined to a Thomas Campbell podcast clip (Bialik
  interview 25:13–26:39, the quantum rendering model — "there is no out
  there. The reality is computed."). Joined by `youtube-video-link-016svr`
  (Max +3dB, stray "Steven" trimmed).
  Spine: https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/drops/_/87cca1463833f59395dc675fa6030468.mp3
  Timed lines: Cutting Blocks doc `75231e6686856cc6` (18 blocks; Max
  0:00–52.76, Campbell 53.5–108.72).
- **Animatic v1 is cut** (free, ffmpeg — 14 cuts of the existing stills on
  the spine's own line boundaries, 1024x1536):
  https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/universe-reel/animatic-v1-campbell-max.mp4
  Unused stills: s04 (Ascension), s10 (Forgetting) — they belong to the
  original soul-journey narrative, not this VO.
- **Her word 2026-08-27: "no images"** — do not generate new stills; the 16
  that exist are the art.
- **APIFrame credits, re-measured 2026-08-27** (`api-frame-credits-status`):
  **3,401 credits, and NO expiry field exists in the API** — the earlier
  "credits do not roll over, they vanish at billing reset" claim in this doc
  was the archived chat's reading, not a measurement. Burn is by spending
  (~50/day observed). Whether the $39/mo `af_basic` sub still renews is only
  visible on https://app.apiframe.ai.
- **Animation: still not started.** Open calls that are hers:
  aspect for animation (seedance returns 3:4 with no override — pad sources
  to 9:16 first, or crop in the edit), the tier, and her ♥/✕ pass on the 16
  stills (0 of 16 voted as of today). `scripts/reel-animate.js` +
  `scripts/reel-shots.json` (built on the archived branch, never merged) are
  now on main via this chat.

## Production state (2026-08-16)

- **Stills v1: DONE.** All 16 images (14 shots + Shot 1's optional macro +
  Shot 13's A/B pair) generated with gpt-image-2, quality **medium**,
  **1024x1536** portrait (2:3 per her movie-pipeline rule), prompts sent
  **verbatim** except the two deviations below. Filed to the Assets tab of
  `new-session-e0f161` (labels, MODEL · QUALITY captions, exact prompts) and
  to My Creations. ~66¢ total.
- **Two deviations from verbatim, both disclosed in the delivery reply:**
  - **Shot 2:** the literal prompt was refused by OpenAI's safety system
    (`[sexual]` — the phrase "empty human bodies"). Softened redraw:
    `empty human bodies` → `serene human figures in simple clothing`.
    Nothing else changed. A safety refusal is terminal per the dreams
    pipeline — never retry it verbatim.
  - **Shot 3:** generated via the **edits** endpoint with the finished Shot 2
    render attached as a framing reference, because the shot list requires
    the match-cut framing to line up with Shot 2. Prompt text itself
    verbatim.
- **Animation: NOT started** — waiting on her pass over the stills (re-rolls
  change what gets animated, the match cut especially). Cost options, per
  clip, from `movies.js` `VIDEO_MODELS`: wan draft 480p ~$0.06 · wan 720p
  ~$0.16 · kling standard 720p $0.25 · kling pro 1080p $0.55 (pro is the tier
  that supports `end_image`, i.e. true animate-BETWEEN-two-panels).
  14 clips ≈ $0.84 / $2.24 / $3.50 / $7.70 by tier.
- **Voiceover: NOT started** (not written yet).

## Stills v1 run log (2026-08-16, gpt-image-2 · medium · 1024x1536)

Storyboard Compare page: "Universe Reel — storyboard v1" in the chat's
Compare tab (sheet `universe-storyboard-s16` holds her notes). Each image's
exact sent prompt is on its PROMPT overlay in the Assets tab.

- **Shot 1 — Clay Creation: hands molding the Earth** — https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1786921990135-ag2cdz.webp
- **Shot 1b — Clay Creation macro: a thumbprint becoming a mountain range** — https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1786921989489-tkb8d1.webp
- **Shot 2 — Souls Descending into bodies** (softened redraw, see above) — https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1786922203433-hrt4ju.webp
- **Shot 3 — Match Cut: game character drop** (edits endpoint, Shot 2 attached as framing ref) — https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1786922338808-0oo5iw.webp
- **Shot 4 — Ascension: light-being leaving the body** (softened: "rising out of the body" → "rising gently above them", safety refusal) — https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1786922248165-sdojrn.webp
- **Shot 5 — Level Up: radiant space above the clouds, golden gate ahead** — https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1786922030992-l8gyo1.webp
- **Shot 6 — Tiny Sphere Walk** (softened: "Super Mario Galaxy" → "a charming cartoon space platformer game", trademark refusal) — https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1786922290538-m34cyo.webp
- **Shot 7 — Render-on-Look: landscape half-loaded into wireframe** — https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1786922069051-fet6rp.webp
- **Shot 8 — Light-Speed Cap: runner at the glowing wall** — https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1786922070019-ttbon6.webp
- **Shot 9 — Waking Up POV: first eyes opening** — https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1786922064756-2zve1q.webp
- **Shot 10 — Forgetting: the inner glow dimming** — https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1786922102884-voy0f5.webp
- **Shot 11 — Rising Through the Clouds** — https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1786922109823-e44jel.webp
- **Shot 12 — Other Players: crowd with the same inner glow** — https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1786922114083-x61y2h.webp
- **Shot 13A — Day/Night Rotation: the real sphere** — https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1786922138496-wvs21k.webp
- **Shot 13B — Day/Night Rotation: game-editor time-of-day slider** — https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1786922152440-az7qsr.webp
- **Shot 14 — Loading Shimmer: transition motif** — https://storage.googleapis.com/membry-df528.firebasestorage.app/claude-deliveries/1786922148600-59xs2h.webp

---

# The shot list (her upload, verbatim)

## PART 1 — Shots in order of importance (make these first)

### 1. Clay Creation
**Image prompt:** Giant weathered hands molding a glowing blue-green clay sphere, visible thumbprints pressed into continents, dark cosmic void background, soft divine light from above, cinematic, hyper-detailed clay texture
**Animation prompt:** Open mid-action: hands already pressing and rotating the sphere, thumbprints forming mountain ranges, clay smoothing into oceans, camera slowly orbiting the hands
**Optional extra image:** Extreme close-up of a single thumbprint becoming a mountain range, macro detail

### 2. Souls Descending
**Image prompt:** Translucent glowing light-beings drifting down from a bright sky toward empty human bodies standing in a misty field, ethereal, volumetric light rays, serene
**Animation prompt:** Orbs of light fall gently from the sky, each merges into a standing body; on contact the body's eyes open and it takes a first breath, color returning to the skin

### 3. Match Cut: Game Drop
**Image prompt:** Third-person video game screenshot style: stylized character skydiving toward a vibrant island landscape below, subtle HUD elements at screen edges, game-engine lighting, crisp stylized rendering
**Animation prompt:** Character falls from the sky in identical framing and motion to the souls shot, lands in a crouch, stands, starts running; a minimal health bar fades in at the corner
**NOTE:** Framing must match Shot 2's descent exactly — this match cut is the core moment of the video.

### 4. Ascension: Leaving the Body
**Image prompt:** An elderly person lying peacefully in a sunlit field, a translucent glowing light-being rising out of the body, a tether of light dissolving, ethereal, volumetric rays
**Animation prompt:** The light-being lifts gently out of the body, hovers a moment looking down, then begins rising — the descent from Shot 2, reversed; its inner glow visibly returns as it rises

### 5. Level Up (Ending)
**Image prompt:** Above the clouds: radiant open space, the light-being glowing brighter and larger than before, a subtle golden ring or gate ahead in the distance
**Animation prompt:** The being breaks through the final cloud layer; minimal glowing text floats upward — "LEVEL 2" — then fades as the being drifts toward the light; cut to black

### 6. Tiny Sphere Walk
**Image prompt:** Tiny stylized planet in the style of Super Mario Galaxy, lone character standing on top, entire sphere visible in frame with miniature trees and hills, curved horizon, space backdrop, charming and clean
**Animation prompt:** Character walks and circles the entire tiny planet in exactly ten steps, camera fixed in space, ending back where they started, casual and loopable

### 7. Render-on-Look
**Image prompt:** Landscape half-loaded like a video game: foreground fully detailed forest, background dissolving into wireframe and blank untextured chunks, split-reality feel
**Animation prompt:** As a character turns their head, terrain chunks pop in — wireframe, then flat color, then full texture — always resolving just ahead of their gaze

### 8. Light-Speed Cap
**Image prompt:** A runner sprinting through a dark cosmic void toward a glowing translucent wall of light stretching infinitely in every direction, speed lines, the barrier faintly shimmering
**Animation prompt:** Runner accelerates, motion blur intensifies, then hits an invisible barrier that ripples like glass; they cannot pass; the wall shimmers and settles

### 9. Waking Up (First-Person POV)
**Image prompt:** First-person POV of eyes opening for the first time: blurry warm light, soft out-of-focus faces or sky above, lens-like vignette of eyelids at frame edges, dreamlike
**Animation prompt:** Black screen; eyelids open slowly, world comes into focus from blur — light, color, a sky or a face above; a faint soft UI flicker at the very edge of vision, almost subliminal

### 10. Forgetting (The Veil)
**Image prompt:** Close-up of a person whose chest and eyes hold a soft inner glow, the glow visibly dimming, expression shifting from serene knowing to ordinary blankness, muted colors creeping in
**Animation prompt:** The inner glow in the person's chest and eyes gently fades to nothing; their gaze changes from wonder to everyday distraction; the world around them desaturates slightly
**Purpose:** Explains why no one remembers arriving; sets up the glow returning in Shot 4 (Ascension).

### 11. Rising Through the Clouds
**Image prompt:** Glowing orb of light ascending through towering golden-white clouds, god rays, vast heavenly scale, soft warm palette
**Animation prompt:** Continuous upward camera move following the light-being through cloud layers, each layer brighter than the last, streaks of light rushing past

### 12. Other Players
**Image prompt:** Busy city crosswalk viewed from above, every person carrying a faint identical glow of light inside their chest, subtle, no one noticing, cinematic wide shot
**Animation prompt:** Crowd walks normally; slowly the camera reveals a soft light pulsing inside every single person in sync, then the glow fades back to invisibility as the shot ends

### 13. Day/Night Rotation
**Image prompt A (real):** Earth-like sphere half in golden sunlight, half in star-speckled night, terminator line crisp, viewed from space, painterly
**Image prompt B (game):** Game engine editor view of the same sphere with a visible "time of day" slider UI at the bottom of the screen
**Animation prompt:** The sphere rotates and sunlight sweeps across its surface; cut to the game-editor version where a slider drags and the same light sweep happens instantly

### 14. Transition Motif — "Loading Shimmer"
**Image prompt:** Abstract soft shimmer of light particles and faint wireframe grid, translucent, gentle blue-gold gradient, minimal, ethereal
**Animation prompt:** A soft wave of shimmering light particles sweeps across the frame left to right, briefly revealing a faint wireframe grid beneath the image before dissolving, 0.5 second wipe
**Use:** Between major beats for visual cohesion.

## PART 2 — Final edit order (clip sequence in the finished film)

1. Clay Creation (hands mid-action)
2. Souls Descending
3. Match Cut — Game Drop
4. Waking Up POV
5. Forgetting (glow fades)
6. Other Players (crowd glow)
7. Tiny Sphere Walk (10 steps around)
8. Day/Night Rotation (real → game slider)
9. Render-on-Look (chunks loading)
10. Light-Speed Cap (invisible wall)
11. Ascension — Leaving the Body (glow returns)
12. Rising Through the Clouds
13. Level Up — "LEVEL 2" — cut to black

*(Loading Shimmer transition used between beats as needed.)*
