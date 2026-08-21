# Witchcraft reels — scripts + image prompts

Chat: `witchcraft-reels-scripts` · written 2026-08-21 · **no images generated
yet — prompts only, at Sophie's ask.**

## Where the ideas came from

Sophie asked for "the ideas for witchcraft reels from ChatGPT." **Theo's
(her mom's ChatGPT's) ideas were never filed anywhere reachable** — the
witch-video pipeline's idea box is empty (measured 2026-08-21:
`GET /api/witchvideo/list` → `{"videos":[]}`), and the `witch-video-pipeline`
chat is still waiting on the paste. The only witchcraft-reel idea list on
record is the **13-idea list in the `witchcraft-reels-ideas` chat
(2026-08-20)**, so these scripts work from that list. If Theo's list ever
lands, those get scripted as a second batch — nothing here blocks that.

## The eight picks (and the five skipped)

Picked for the movies-pipeline reality: these get produced as **illustrated
animated films** (gpt-image-2 stills → image-to-video → ffmpeg), not filmed
footage — so ideas that need real hands, real screens, or real card pulls
were passed over.

Picked: **Oh, is it?** · **Desk altar tour** · **Green flags** · **The
balcony bowl** · **"Witchcraft isn't real" vs. my morning** · **Mom's
crystals** · **Cleansing after guests** · **Spooky season is our Super
Bowl**.

Skipped: search-history scroll (a screen recording, wrong medium), rating
grocery items (overlaps Green flags), ASMR spell jar (needs real hands —
the whole appeal is real texture), bathroom-break spells (real spell
instruction deserves the Witch School treatment, not a 60-second cartoon),
morning card pulls (a reaction series needs a real face and real pulls).

## Shared production spec

- Portrait **2:3 (1024x1536)** — gpt-image-2's tall canvas, closest to
  IG's 4:5; crop a sliver top/bottom at post time.
- Proposed quality: **medium** (~4.1¢/still). 47 stills ≈ **$1.93** for the
  whole batch of eight. Animation money comes later and gets its own ask.
- Text overlays are added in the edit, never baked into the art — every
  prompt ends with a no-text instruction, and compositions leave head/foot
  room for captions.
- Stills carry **no real person's face**. The recurring witch is an
  invented illustrated character.

### The style half (shared prefix — STYLE IS A PROPOSAL, Sophie settles it)

The witch look is settled with Sophie per series, not invented per video.
This prefix is the proposal on the table; the palette line is word-for-word
the v2 style line she approved in the `secretly-witch-instagram-content`
chat ("the salt line v2 is a big improvement"). Everything else in it is by
Claude (this chat).

> Hand-drawn dark storybook illustration in ink and gouache, deep plum and
> ink palette warmed by generous golden candlelight and a soft ambient fill
> so every detail stays readable in the shadows, gentle chiaroscuro.
> Vertical composition with breathing room at the top and bottom of the
> frame. [content] Render as a single full-bleed illustration, no borders,
> no panels, no text or lettering anywhere in the image.

### The character line (appended only to scenes she appears in)

> The witch is a woman in her late twenties with dark shoulder-length wavy
> hair and bangs, wearing an olive-green cardigan over a black dress and a
> small silver crescent-moon pendant — the same character, same face, same
> outfit in every scene.

---

## 1. "Oh, is it?" — 8 seconds, loops clean

The brand joke in its smallest form. No VO — text overlays only, so it
works muted (most of IG). The loop: the last frame is the moon, the first
frame has the moon out the office window, so it rolls seamlessly.

**Script (text overlays):**
- 0.0–2.5 — Office. Coworker, gesturing at the window: **"big moon
  tonight, huh"**
- 2.5–4.5 — Her, over coffee, dead level: **"huh. hadn't noticed."**
- 4.5–8.0 — Hard cut: her apartment windowsill, every inch crowded with
  jars of water glowing under an enormous full moon. Overlay, small,
  bottom: **"secretly a witch"**

**Stills (4):**
1. `oh-is-it-01 — the coworker` — Inside a dim office at dusk, a cheerful
   middle-aged coworker in a lanyard points out a large window at a huge
   full moon rising over the city skyline, cubicles and a glowing monitor
   in the foreground. *(no character line)*
2. `oh-is-it-02 — hadn't noticed` — Close on the witch seated at an office
   desk holding a steaming mug with both hands, perfectly neutral
   expression, eyes slightly narrowed, the moonlit window reflected small
   in her eyes. *(+ character line)*
3. `oh-is-it-03 — the windowsill` — A cramped apartment windowsill at
   night crowded edge to edge with mismatched glass jars and bowls of
   water, each catching moonlight, an enormous luminous full moon filling
   the window behind them. *(no character line)*
4. `oh-is-it-04 — the moon` — An enormous full moon alone in a deep plum
   night sky over sleeping rooftops, one small lit window in the corner of
   the frame. *(no character line — this is the loop frame)*

**Animation notes (later):** 01 subtle parallax; 02 steam drift; 03 light
shimmer on the water; 04 slow push-in on the moon.

---

## 2. Things on my desk that are secretly an altar — 25 seconds

Deadpan office tour, one item per beat. Coworkers send it to each other.
Text overlays only.

**Script (text overlays):**
- 0–2 — Wide of a tidy office desk: **"a tour of my desk"**
- 2–5.5 — Black stone on papers: **"a paperweight"**
- 5.5–9 — Mug, bay leaf tucked under the coaster: **"tea"**
- 9–12.5 — Thin white line along the monitor base: **"decorative salt"**
- 12.5–16 — Small potted herb by the keyboard: **"a plant"**
- 16–20 — Unlit candle, faint scratched marks on the wax: **"a candle.
  for ambiance."**
- 20–25 — The wide again, golden hour: **"anyway. completely normal
  desk."**

**Stills (7):**
1. `desk-altar-01 — the desk` — A tidy office desk seen straight on:
   monitor, keyboard, mug, a black stone on a paper stack, a small potted
   herb, an unlit candle, warm lamplight. *(no character line)*
2. `desk-altar-02 — the paperweight` — Macro close-up of a rough chunk of
   black tourmaline sitting on a neat stack of printed spreadsheets, office
   lamplight glinting off its facets. *(no character line)*
3. `desk-altar-03 — the tea` — Close-up of a steaming mug on a cork
   coaster with the corner of a dried bay leaf just visible tucked
   underneath, keyboard blurred behind. *(no character line)*
4. `desk-altar-04 — the salt` — Close-up along the base of a computer
   monitor where a thin, perfectly straight line of white salt runs the
   monitor's full width, office clutter softly out of focus. *(no
   character line)*
5. `desk-altar-05 — the plant` — A small terracotta pot of rosemary beside
   a keyboard, one sprig freshly snapped, tiny scissors lying next to it.
   *(no character line)*
6. `desk-altar-06 — the candle` — Close-up of a short unlit cream candle
   on a desk, faint thin lines scratched into the wax catching the light at
   an angle, a matchbook half-hidden under a sticky note. *(no character
   line)*
7. `desk-altar-07 — golden hour` — The same tidy office desk at golden
   hour, low sun striping the wall, everything in its place, the candle
   now lit with a single small flame. *(no character line)*

**Animation notes:** mostly slow push-ins; 07 flame flicker.

---

## 3. Green flags someone is secretly a witch — 25 seconds

Identity content — tags and shares. One flag per beat, text overlays.

**Script (text overlays):**
- 0–2.5 — Title card look, moonlit street: **"green flags someone is
  secretly a witch"**
- 2.5–6 — **"knows the moon phase without checking"**
- 6–9.5 — **"grows rosemary. 'for cooking.'"**
- 9.5–13 — **"suspiciously good parking luck"**
- 13–16.5 — **"there is salt in their bag"**
- 16.5–20 — **"says 'I had a feeling' and is always right"**
- 20–25 — **"their tea is never just tea"** → beat → small, bottom:
  **"send this to them. they know."**

**Stills (7):**
1. `green-flags-01 — title` — A quiet residential street at night under a
   crescent moon, one figure walking away from the viewer with a confident
   stride, cat trotting beside her. *(+ character line)*
2. `green-flags-02 — moon phase` — The witch mid-conversation at an
   outdoor café table, pointing casually up at a daytime half-moon in the
   sky without looking at it, her friend squinting upward to check. *(+
   character line)*
3. `green-flags-03 — rosemary` — A kitchen windowsill overflowing with one
   enormous, clearly thriving rosemary bush in a pot, far too large for
   cooking, morning light through the leaves. *(no character line)*
4. `green-flags-04 — parking` — A busy city street packed nose to tail
   with parked cars, except one perfect empty parking space directly in
   front of a shop door, glowing faintly gold. *(no character line)*
5. `green-flags-05 — the bag` — An open canvas tote bag seen from above:
   keys, a paperback, lip balm, and a small knotted pouch of coarse salt
   sitting matter-of-factly among them. *(no character line)*
6. `green-flags-06 — the feeling` — The witch resting a hand on a friend's
   arm at a bus stop, calm knowing expression, while the bus they were
   about to board pulls away with a flat tire visibly sagging. *(+
   character line)*
7. `green-flags-07 — the tea` — Close-up of a glass teapot mid-pour into a
   cup: inside the pot, flowers, a star anise, a curl of orange peel and a
   sprig of something green swirl in a small deliberate spiral. *(no
   character line)*

**Animation notes:** 04 the glow pulses; 07 the swirl turns.

---

## 4. Explaining the bowl of water on the balcony to my family — 20 seconds

Episode 1 of a series — a new cover story every visit. The recurring bit is
the family member pointing and the cover story getting less convincing.

**Script (text overlays):**
- 0–3 — Family arriving at the door, coats and a casserole dish:
  **"family's visiting"**
- 3–7 — The balcony through the glass door — a bowl of water sitting in
  the moonlight: *(no overlay — let them see it)*
- 7–10.5 — Mom pointing at it through the glass: **"what is that"**
- 10.5–14 — Her, level: **"it's for the birds."**
- 14–17.5 — A crow perched on the balcony rail, looking at the bowl,
  pointedly not drinking: *(no overlay)*
- 17.5–20 — Small, bottom: **"the birds know what it is. — ep. 1"**

**Stills (6):**
1. `balcony-bowl-01 — arrival` — An apartment doorway with a warm family
   crowding in: an older mother holding a foil-covered casserole dish, a
   dad behind her, coats and hugs, the witch opening the door with a
   welcoming smile. *(+ character line)*
2. `balcony-bowl-02 — the bowl` — Through a glass balcony door at night, a
   single ceramic bowl of still water sits centered on a small balcony
   table, full moonlight landing exactly on it. *(no character line)*
3. `balcony-bowl-03 — what is that` — The older mother inside the warm
   apartment pointing through the glass balcony door with a puzzled
   expression, the moonlit bowl visible beyond her finger. *(no character
   line)*
4. `balcony-bowl-04 — for the birds` — Close on the witch's perfectly calm
   face, mid-shrug, holding a dish towel, warm kitchen light behind her.
   *(+ character line)*
5. `balcony-bowl-05 — the crow` — A large crow perched on a balcony
   railing at night beside the bowl of water, head turned to give it a
   long sideways look, distinctly not drinking. *(no character line)*
6. `balcony-bowl-06 — dinner` — The family seated at a warm dinner table
   seen from the balcony's point of view through the glass, the bowl of
   water in the near foreground catching moonlight. *(+ character line)*

**Animation notes:** 02/06 moonlight shimmer on the water; 05 the crow's
head tilt.

---

## 5. "Witchcraft isn't real" vs. my morning — 20 seconds

Smash cuts of the routine going suspiciously well. Comedy carries it — no
claims, no arguing, the morning does the talking.

**Script (text overlays):**
- 0–2.5 — Grey title beat: **"'witchcraft isn't real'"**
- 2.5–5.5 — **"ok. my morning:"** — green light after green light down an
  empty avenue
- 5.5–9 — the parking spot, again, in front of the café
- 9–12.5 — Barista sliding a second cup across: **"'we made an extra'"**
- 12.5–16 — Rain hitting the window the exact second she's inside
- 16–20 — Close on a small charm bag in a coat pocket. Small, bottom:
  **"anyway."**

**Stills (6):**
1. `isnt-real-01 — title` — A flat grey morning sky over city rooftops,
   one thin break of gold light on the horizon. *(no character line)*
2. `isnt-real-02 — green lights` — A morning avenue seen from behind the
   witch walking down the sidewalk, every traffic light down the street
   green at once, stretching into the distance. *(+ character line)*
3. `isnt-real-03 — the spot` — The same perfect empty parking space
   glowing faintly gold in front of a café with a bicycle leaning outside.
   *(no character line)*
4. `isnt-real-04 — the extra` — A smiling barista behind a café counter
   sliding a second paper cup across to the witch, who is reaching for it
   without surprise. *(+ character line)*
5. `isnt-real-05 — the rain` — Heavy rain streaking down a café window
   seen from the warm inside, the witch seated with her cup, completely
   dry, watching pedestrians outside break into a run. *(+ character
   line)*
6. `isnt-real-06 — the charm` — Macro close-up of a small knotted linen
   charm bag tucked inside a coat pocket, a sprig of rosemary and a red
   thread just visible at its mouth. *(no character line)*

**Animation notes:** 02 the lights hold green; 05 rain runs; 06 slow
push-in.

---

## 6. My mom collected crystals for 30 years — this one's story — 40 s

The emotional one. One stone per episode; retention comes from the story,
and it sells the real crystal shop without selling. This one gets **VO**
(whose voice is Sophie's call — never her clone on public content without
her word; TTS or her mom are the other options).

**THE STORY SLOT IS REAL OR THE REEL DOESN'T RUN.** The middle 20 seconds
is the stone's true story in her mom's words — where it came from, who
gave it, what it's been through. Never invented. The frame below is
scripted; the slot is hers. (Alternate first episode that's already true:
Sophie's own multi-faceted garnet that lives in her car for travel
protection — her words, from her own notes.)

**Script (VO over stills):**
- 0–4 — Hands holding the stone. VO: **"My mom has collected crystals for
  thirty years. This one is [stone]."**
- 4–24 — The story, her mom's words, 3–4 sentences. **[MOM'S STORY —
  verbatim, recorded or transcribed from her]**
- 24–32 — The shelf, slow pan. VO: **"It lives on the third shelf, between
  [neighbor stones]."**
- 32–40 — The stone alone by lamplight. VO: **"Next week: the one she
  almost threw away."** *(tease the next episode — whichever stone's story
  she gives next)*

**Stills (5):**
1. `crystal-story-01 — the hands` — An older woman's hands, gentle and
   lined, cradling a deep red multi-faceted garnet in cupped palms,
   lamplight catching the facets. *(no character line)*
2. `crystal-story-02 — the stone` — The garnet alone on dark plum velvet,
   a single warm light source, its facets throwing small red glints onto
   the cloth. *(no character line)*
3. `crystal-story-03 — the shelf` — A wooden shelf crowded with a
   thirty-year crystal collection: clusters, points, tumbled stones, small
   labels in handwriting, warm lamplight raking across them. *(no
   character line)*
4. `crystal-story-04 — the origin` — [WRITTEN FROM THE STORY — one
   illustrated vignette of the moment in her mom's telling; e.g. for the
   garnet: the stone sitting on a car dashboard at dusk, road lights
   streaking past outside the windshield.] *(no character line)*
5. `crystal-story-05 — lamplight` — The garnet on a bedside table beside
   a small lit lamp and a folded pair of reading glasses, the rest of the
   room falling into soft plum darkness. *(no character line)*

**Animation notes:** all slow push-ins; 03 a lateral pan.

---

## 7. Cleansing the house after guests leave — 18 seconds

Everyone who has ever hosted relates. Text overlays, timelapse energy.

**Script (text overlays):**
- 0–3 — Front door just closed, coats gone, cups everywhere: **"I love my
  guests"**
- 3–6 — Her leaning against the closed door, eyes shut: **"and now they're
  gone"**
- 6–9.5 — Every window thrown open, curtains moving: **"step one: air"**
- 9.5–13 — Sweeping toward the door, salt on the threshold: **"step two:
  sweep it OUT the door"**
- 13–16 — Smoke curling from a rosemary bundle into a corner: **"step
  three: corners"**
- 16–18 — Armchair, tea, cat, one candle: **"much better."**

**Stills (6):**
1. `cleanse-01 — just left` — A living room the minute guests leave: empty
   cups and plates on every surface, cushions dented, a front door freshly
   closed, one balloon drifting at half height. *(no character line)*
2. `cleanse-02 — the exhale` — The witch leaning back against the closed
   front door, eyes closed, head tipped back, house keys still in her
   hand. *(+ character line)*
3. `cleanse-03 — air` — A living room with every window thrown wide open
   at once, white curtains billowing inward, night air visibly stirring
   the room. *(no character line)*
4. `cleanse-04 — the sweep` — The witch mid-sweep with a straw broom,
   pushing a small line of dust and salt across the threshold of the open
   front door, purposeful expression. *(+ character line)*
5. `cleanse-05 — corners` — Close-up of a smoking bundle of dried rosemary
   held toward a ceiling corner of a room, the smoke curling up into the
   corner in a soft spiral. *(no character line)*
6. `cleanse-06 — much better` — The witch curled in an armchair with a
   steaming mug, a black cat loafed on the armrest, one lit candle on the
   side table, the room behind her clean and dim and settled. *(+
   character line)*

**Animation notes:** 03 curtains billow; 05 smoke curls; 06 flame + steam.

---

## 8. Spooky season is our Super Bowl — 22 seconds

Dead-serious prep checklist, posted in August. The joke is the seriousness.
Text overlays.

**Script (text overlays):**
- 0–3 — A wall calendar on August, October 31 already circled in red:
  **"71 days out."** *(update the number to the actual post date)*
- 3–7 — Attic boxes, labeled and inventoried: **"decor inventory:
  complete"**
- 7–11 — A broom clamped to a workbench, being re-bristled: **"equipment
  maintenance: underway"**
- 11–15 — A cabinet stacked with candles like a wine cellar: **"candle
  reserves: 84. need more."**
- 15–18.5 — A long black cloak on a hanger, steamer at work: **"game
  uniform: ready"**
- 18.5–22 — Her on the porch at dusk, tea, waiting: **"see you in
  October."**

**Stills (6):**
1. `superbowl-01 — the calendar` — A kitchen wall calendar open to August,
   October 31 circled several times in red ink on a visible October page
   corner, a red marker hanging from a string beside it. *(no character
   line)*
2. `superbowl-02 — inventory` — An attic stacked with tidy cardboard
   boxes, each labeled in neat handwriting-style marker strokes, a
   clipboard resting on the nearest box, one plastic skeleton hand poking
   out of a box flap. *(no character line)*
3. `superbowl-03 — maintenance` — A straw besom broom clamped gently in a
   woodworking bench vise, fresh bristles being bound with cord, wood
   shavings and twine on the bench. *(no character line)*
4. `superbowl-04 — reserves` — A tall cabinet with its doors open,
   stacked floor to top with candles of every color arranged by shade like
   a wine cellar, one shelf conspicuously half empty. *(no character
   line)*
5. `superbowl-05 — the uniform` — A long black hooded cloak on a wooden
   hanger hooked over a door, a garment steamer wand smoothing it, steam
   rising. *(no character line)*
6. `superbowl-06 — see you in october` — The witch sitting on porch steps
   at dusk with a steaming mug, jack-o'-lantern-less pumpkins still green
   on the step below her, patient expression, first fallen leaf on the
   step. *(+ character line)*

**Animation notes:** 05 steam; 06 the leaf skitters.

---

## What happens next (none of it started without a go)

1. Sophie ♥/✕'s scripts on the deck page (Compare tab of this chat) and
   settles the style question.
2. Stills batch for the approved reels (~4.1¢ each at medium; all 47 ≈
   $1.93). Each still gets filed to Assets labeled, with the exact
   style/content split and the MODEL · QUALITY caption, per the
   deliver-images ritual.
3. Animation + stitch is a separate, costed ask (the movies recipe runs
   ~$1–1.50 per short) — over $3 for the batch, so it gets estimated and
   asked first.
