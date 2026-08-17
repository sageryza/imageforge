# XI cards — new-card design (one type, no event/twist)

Sophie's brief (2026-08-17, this chat): the hard part of XI is the cards —
"the exact right mixture of triggers your memory, but also broadly applicable
to everyone." Cards must work **by themselves** and **paired** (two touching
cards = tell a memory that's both — the Board of the Day / Versus mechanic).
The event/twist distinction is **abandoned: all cards are one type**. Words
first; art comes later for the cards that test well (read
`docs/image-pipeline.md` before starting that phase).

The game lives in `memory-library-react` (`src/xi/decks.js`,
`src/data/xi/deckTrial.json`). The only live deck is **midjourney** (86
cards); internet / dreams / claude / chatgpt are retired but their captions
still count for dedupe (old memories resolve against them).

## The recipe (derived from all five existing decks, 2026-08-17)

- **House voice:** ALL CAPS, first person, past tense, completes "times I
  ___" — `REGRETTED WHAT I SAID`, `NOBODY SHOWED UP`. 2–6 words. No "I" at
  the front.
- **Concrete scene, not concept.** The strongest existing cards name a
  micro-situation you can SEE (`KEPT MY MOUTH SHUT`, `WAITED FOR NOTHING`).
  The weakest are abstractions (`TAPPED INTO THE COLLECTIVE`) or essays (the
  retired internet deck's `NOTICED SOMETHING STRANGE SUDDENLY SEEMING
  STANDARD`). If you can't picture a moment, it won't trigger one.
- **Universal in experience, particular in instances.** Everyone has
  pretended to be asleep; each person's instance is vivid and their own.
  That's the whole trick. Avoid cards that assume siblings, college,
  marriage, driving, money, religion.
- **The old twist lane was adverbial** (`WITHOUT MEANING TO`, `AT THE WORST
  MOMENT`). In the one-type model a pair reads as a **conjunction**: a
  memory that is BOTH cards. So every card must be a full prompt alone, and
  pairs work by intersection, not modification.
- **Pair test before keeping a card:** imagine it beside three random live
  cards. If at least two combos make a findable prompt, it pairs. (Scene
  cards pair with action cards the way twists used to pair with events —
  scene + deed — without needing a second type.)
- **Dedupe against every deck, live and retired**, including near-dupes.
  Mirrors are fine (`MISSED IT BY A MINUTE` mirrors `IN THE NICK OF TIME` —
  deliberate); twins are not.

## Two kinds of card — the APERTURE split (2026-08-17, from her first pair data)

Sophie, after her first pairs session: some pairs were hard "if they're both
concrete… which makes me wonder if you think there should be two different
kinds of cards." The answer settled on: **yes — but the split is APERTURE,
not the old event/twist grammar.**

- **ANCHOR** — names a scene, act, or object specific enough to SEE:
  `THE KITCHEN, LATE AT NIGHT`, `PRETENDED TO BE ASLEEP`, `THE JUNK DRAWER`.
  The picture comes first, the memory follows. Best solo triggers.
- **OPEN** — names a shape or outcome that fits thousands of moments:
  `GOT AWAY WITH IT`, `NEVER TOLD ANYONE`, `DIDN'T WANT IT TO END`. The
  search comes first, a memory condenses out of it. Best pairing glue.

**The pair rule the data supports: deal ANCHOR + OPEN.** The anchor picks
the scene; the open sweeps a searchlight across it. Two anchors only
intersect when both are high-traffic (`THE BACK SEAT` × `FELL ASLEEP ON THE
WAY HOME`); two narrow anchors are usually empty (`THE KITCHEN, LATE AT
NIGHT` × `FAKED BEING SICK` — her exact example). Two opens intersect fine
but go mushy — that is what the retired abstract cards felt like.

Measured on her first session (aggregate only — the memories themselves stay
in the app, not in this public repo): 7 written pair memories; 5 of the 7
held ONE scene anchor (the kitchen) against acts/opens and produced real
memories; the scene × scene pair drifted into a memory of just one card. A
pair that "fails" still tends to trigger off a single card — the pair is a
prompt, not a contract — but a game rule that wants a memory of BOTH cards
should deal anchor + open.

Two design consequences, deliberately NOT built yet:
- **The tag is DEALING logic, not card identity.** All cards stay one type
  (her decision stands); the deck just knows each card's aperture and deals
  pairs one-of-each. On a board, checkerboard the two tags and every
  touching pair is anchor + open — the versus board's cream/white squares
  already do two-role layout, so the machinery exists to repurpose.
- **A card can also be too narrow for a given PERSON** (`FAKED BEING SICK`
  gave her nothing even solo — she never did it). That is a frequency
  problem, not an aperture problem; the sparked/nothing votes find those
  per player, and no theory should defend a card the votes kill.

Reading verdicts by kind: `kinds2()` in `scripts/xi-pages.js` maps batch-2
card ids to `anchor`/`open`; batch 1's split is the two lists below.

## Batch 1 — 67 cards (posted as deck page "XI cards — batch 1")

Two lanes. Lane A is the house voice. **Lane B is an experiment**: scenes &
senses as noun phrases — places, smells, sounds, times. Sensory cues are the
strongest memory triggers there are, and they're also the most illustratable,
but they break the "times i…" frame — that's what the test decides. On the
review deck the lanes are interleaved (a B card after every 4 A cards) so
fatigue doesn't pile on one lane; verdicts key on card ids, so hit-rates per
lane can be computed regardless of order.

### Lane A — story shapes (53)

Sneaking & small crimes:
- PRETENDED TO BE ASLEEP
- SNUCK OUT
- LISTENED AT THE DOOR
- READ SOMETHING I SHOULDN'T HAVE
- FAKED BEING SICK
- GOT AWAY WITH IT
- TOOK THE DARE
- LEARNED A BAD WORD
- GOT CALLED BY MY FULL NAME

People:
- MADE A FRIEND FOR ONE DAY
- NEVER SAW THEM AGAIN
- WAS SOMEBODY'S FAVORITE
- KEPT SOMEONE'S SECRET
- PRETENDED NOT TO SEE THEM
- SHARED A LOOK WITH A STRANGER
- WAITED UP
- WAVED UNTIL THEY WERE OUT OF SIGHT
- DIDN'T KNOW IT WAS THE LAST TIME

Things kept & lost:
- KEPT IT FOR NO REASON
- NEVER GAVE IT BACK
- NEVER FOUND IT
- HID IT SO WELL I LOST IT
- BROKE SOMETHING AND SAID NOTHING
- SAVED UP FOR IT
- WROTE IT AND NEVER SENT IT

Joy:
- LAUGHED UNTIL IT HURT
- TRIED NOT TO LAUGH
- SANG AT THE TOP OF MY LUNGS
- FELL ASLEEP ON THE WAY HOME
- STAYED IN THE CAR FOR THE SONG
- WON SOMETHING SMALL

Small disasters:
- GOT LOCKED OUT
- MISSED IT BY A MINUTE
- SLEPT THROUGH IT
- REGRETTED THE HAIRCUT
- WORE THE WRONG THING
- ATE IT TO BE POLITE
- NODDED LIKE I UNDERSTOOD

Nights, phones & goodbyes:
- STAYED TOO LATE
- LEFT WITHOUT SAYING GOODBYE
- TALKED UNTIL THE PHONE DIED
- GOT THE CALL
- WANTED TO GO HOME

Growing up:
- GOT PICKED LAST
- PACKED IN A HURRY
- TOOK THE LONG WAY HOME
- RACED THE STREETLIGHTS HOME
- WATCHED FROM THE WINDOW
- LET IT RING
- MADE THE SAME WISH EVERY YEAR
- ATE STANDING OVER THE SINK
- STAYED HOME SICK
- WAITED TO BE PICKED UP

### Lane B — scenes & senses (14, the experiment)

- THE KITCHEN, LATE AT NIGHT
- THE BACK SEAT ON A LONG DRIVE
- A WAITING ROOM
- THE SMELL OF SOMEONE ELSE'S HOUSE
- A PARKING LOT AFTER DARK
- THE SMELL OF CHLORINE
- RAIN ON HOT PAVEMENT
- A SONG THAT WAS EVERYWHERE THAT SUMMER
- THE HUM OF A FAN AT NIGHT
- THE FIRST COLD MORNING
- 3 A.M.
- THE LAST DAY OF SCHOOL
- THE JUNK DRAWER
- THE NIGHT THE POWER WENT OUT

### Batch 1 by aperture (44 anchors · 23 opens)

- **Anchors (30 acts + all 14 scenes):** PRETENDED TO BE ASLEEP · SNUCK OUT
  · LISTENED AT THE DOOR · READ SOMETHING I SHOULDN'T HAVE · FAKED BEING
  SICK · TOOK THE DARE · LEARNED A BAD WORD · GOT CALLED BY MY FULL NAME ·
  PRETENDED NOT TO SEE THEM · WAVED UNTIL THEY WERE OUT OF SIGHT · HID IT
  SO WELL I LOST IT · BROKE SOMETHING AND SAID NOTHING · WROTE IT AND NEVER
  SENT IT · SANG AT THE TOP OF MY LUNGS · FELL ASLEEP ON THE WAY HOME ·
  STAYED IN THE CAR FOR THE SONG · GOT LOCKED OUT · REGRETTED THE HAIRCUT ·
  ATE IT TO BE POLITE · NODDED LIKE I UNDERSTOOD · TALKED UNTIL THE PHONE
  DIED · PACKED IN A HURRY · TOOK THE LONG WAY HOME · RACED THE STREETLIGHTS
  HOME · WATCHED FROM THE WINDOW · LET IT RING · MADE THE SAME WISH EVERY
  YEAR · ATE STANDING OVER THE SINK · STAYED HOME SICK · WAITED TO BE PICKED
  UP · plus every Lane B scene/sense card.
- **Opens (23):** GOT AWAY WITH IT · MADE A FRIEND FOR ONE DAY · NEVER SAW
  THEM AGAIN · WAS SOMEBODY'S FAVORITE · KEPT SOMEONE'S SECRET · SHARED A
  LOOK WITH A STRANGER · WAITED UP · DIDN'T KNOW IT WAS THE LAST TIME ·
  KEPT IT FOR NO REASON · NEVER GAVE IT BACK · NEVER FOUND IT · SAVED UP
  FOR IT · LAUGHED UNTIL IT HURT · TRIED NOT TO LAUGH · WON SOMETHING SMALL
  · MISSED IT BY A MINUTE · SLEPT THROUGH IT · WORE THE WRONG THING ·
  STAYED TOO LATE · LEFT WITHOUT SAYING GOODBYE · GOT THE CALL · WANTED TO
  GO HOME · GOT PICKED LAST.
- Borderliners are real (PRETENDED NOT TO SEE THEM is a visible act that
  happens everywhere) — the bin is for dealing, not identity; when in doubt
  file by whether the picture or the search comes first.

### Pairs that show the one-type model working

- NEVER GAVE IT BACK + NEVER SAW THEM AGAIN
- 3 A.M. + TALKED UNTIL THE PHONE DIED
- GOT THE CALL + A WAITING ROOM
- SNUCK OUT + THE FIRST COLD MORNING
- THE JUNK DRAWER + NEVER FOUND IT
- Cross-pair with the live deck: TOOK A GAMBLE + A PARKING LOT AFTER DARK;
  DISCOVERED A SECRET + THE KITCHEN, LATE AT NIGHT.

### Known near-neighbours (deliberate, not dupes)

- WAITED TO BE PICKED UP sits near live `NOTHING TO DO BUT WAIT` (the kid
  ache vs. generic waiting).
- MISSED IT BY A MINUTE mirrors live `IN THE NICK OF TIME`.
- RACED THE STREETLIGHTS HOME is generational — flagged for Sophie's call.

## Batch 2 — 131 cards (posted as deck page "XI cards — batch 2", 2026-08-17)

Sophie's ask: "make a larger deck double or triple the cards for me to
choose from and we'll put that aside for later." Batch 1 + 2 = **198 cards
≈ triple**. The full list lives in `scripts/xi-pages.js` (the ONE source —
`OPEN_2` / `ACTS_2` / `SCENES_2` / `THINGS_2`), aperture-tagged from birth:
**42 opens + 89 anchors** (54 acts, 26 scenes/senses, 9 things/people).
Composition follows the batch-1 lesson: batch 1 ran anchor-heavy in acts, so
batch 2 adds a real OPEN lane (the pairing glue), plus new anchor veins:
rituals (COUNTED SECONDS TO THE THUNDER), the phone suite (WAITED BY THE
PHONE · SAVED THE VOICEMAIL · READ IT OVER AND OVER — pairs with batch 1's
LET IT RING / ALMOST CALLED / TALKED UNTIL THE PHONE DIED), body joys
(RAN JUST TO RUN · COLD IN A WET SWIMSUIT), household lore (THE GOOD
SCISSORS · NEVER USED THE GOOD ONES), and quiet-grief anchors (KEPT THEIR
HANDWRITING · DROVE PAST THE OLD HOUSE · THEIR SONG CAME ON). Regional
cards were screened for HER geography (no fireflies in Portland — cut).

Deck order on the page: anchors round-robin across acts/scenes/things with
an open woven in after every 2, so the swipe stays varied. Read back:
`GET /api/chatfeed/verdict?chat=xi-card-design&sheet=page-TbYkwaqRTKBV0Z013pzG`.
**A written or spoken memory counts as sparked on its own** — she should
never have to double-mark (the help card says so, and any scoring script
must treat `texts[id]` present as a spark).

Pairs testing for batch 2 waits until she has chosen keepers — then a
keepers-only pairs page (optionally + batch-1 keepers and live-deck
cross-pairs) replaces walking all 19,900 combinations.

## Live-deck housekeeping spotted while reading

The live midjourney deck carries two exact duplicate captions:
`UNEXPECTED DISASTER` (nt17 AND nt47) and `IN THE NICK OF TIME` (nt31 AND
nt51). Sophie can retire one of each from Curate / the deck manager if she
wants; ids are stable so old memories keep resolving.

## The test loop

**Singles** — page "XI cards — batch 1" (stock `deck` template, states
**sparked / almost / nothing**, voice notes ON — a spoken sentence of the
memory a card triggers is exactly the material the card's future art gets
designed from; the **+ in the card's corner types one instead**). Read back:
`GET /api/chatfeed/verdict?chat=xi-card-design&sheet=page-v9bIL7ob2HwqWfRnGvPK`
(verdict keys = card ids, slugs of the captions; `texts` = typed/spoken
memories).

**Pairs** — page "XI pairs — batch 1" (custom, Sophie's ask 2026-08-17:
two cards at once, swapping ONE per step so every pairing is reachable, and
memories WRITTEN). Two cards side by side, a `swap` under each; marking a
pair auto-steps the RIGHT card to the next unseen pairing (hold one, walk
the other); `shuffle` jumps to a random unseen pair, `back` re-opens the
last; the + writes the pair's memory (dictation-safe — the box polls while
focused). Same three states as singles. Read back:
`GET /api/chatfeed/verdict?chat=xi-card-design&sheet=xi-pairs-b1x67` — item
keys are the two card slugs **sorted alphabetically, joined by `+`**
(order-independent), `texts` = her written memories per pair. 67 cards =
2,211 possible pairs; the counter on the page tracks coverage.

Both pages are generated by **`scripts/xi-pages.js`** (`deck` / `pairs`
subcommands — re-running posts a NEW page, the new-version rule) and the
pairs page's contract is pinned by **`node scripts/test-xi-pairs.js`**
(headless, the test-judge.js harness). Batch 2 tunes on whichever lane and
categories spark, and on which pairings produce written memories.
