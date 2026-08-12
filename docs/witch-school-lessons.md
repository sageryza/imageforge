# Witch School — how to create a lesson (any chat can do this)

The complete workflow behind the 14 live lessons (July 2026). Follow it and a
new lesson will come out matching the others. Everything runs from this repo;
no files from Sophie are needed (her style refs live in Firebase Storage).

## What a lesson is

- **Tap-through cards** in the Secretly a Witch web app
  (https://imageforge-q125.onrender.com/witch → School), Imprint-style:
  full-screen takeover, gold progress dashes, tap right to advance / left edge
  to go back.
- Each card = one illustration + a kicker + a heading + a short body.
- **10 is the house size, not a limit (Sophie, Aug 2026: "you don't have to
  stick to exactly 10 — you'd probably do more rather than less").** Let the
  material decide, and err long. Synchronicity ships at 14. The progress dashes
  and the path's percentage both read `LESSONS[key].length`, so nothing needs
  changing for a longer deck.
- **Arc:** card 1 welcomes ("we'll go one small idea at a time"), the middle
  cards teach one idea each, the LAST card is always kicker **"After"** — a
  tiny concrete action for tonight/this week, ending with **✦**. If the app can
  DO the thing (dream reader, birth chart, tarot draw, Book of Shadows), the
  last card gets a CTA button (see Wiring).
- **A quiz card is optional and costs no art**: `{ bg, kicker, h, know: { qs:
  [{ q, a:[…], ok, tell }] } }` (see `SYNC_CARDS` / `PLANT2_CARDS`). Place it
  AFTER the cards whose facts it tests.

## Voice rules (this is what makes them feel the same)

- Warm, plain, a little literary. Second person. No fluff, no "mystical" filler.
- **Aspirational, not consoling (July 2026 — Sophie's philosophy for the
  school; the rule beneath the phrasing rules).** This is a SCHOOL: students
  are here to learn and should aspire to get genuinely good, not be reassured
  that the easy version already counts. The banned MEANING — regardless of
  wording — is bar-lowering consolation: "X is plenty", "no shop required",
  "can come later, or never", "a tea towel counts", "that counts as a potion",
  "skip the collection". It reads as "we don't expect much from you." Instead,
  frame the small act as the FIRST RUNG and name the higher rungs: tea told
  what you need is "your first potion — the Apothecary lesson teaches the real
  blends from there"; three-card spreads are learned "until fluent, then the
  great spreads open." Rewording a consolation is not fixing it — change the
  stance so the card points upward. (Safety guidance — poison path, shadow-work
  therapist note — is exempt: that's craft safety, never coddling.)
- **No AI-tells (July 2026 — Sophie spotted the pattern).** Readers must not be
  able to tell the text is Claude-written. Banned phrasings, all of them:
  - Mic-drop closers: "That's the whole practice." / "That's the craft." /
    "Done. That's the ritual." / "That's it."
  - The negation-pivot reframe: "X isn't Y — it's Z" / "It's not X. It's Y." /
    "You're not X-ing; you're Y-ing." (Factual contrasts are fine; the banned
    version is the rhetorical *reframe* of a feeling or practice.)
  - Therapy-speak verbs on feelings: "name it/what you feel", "sit with it",
    "notice what comes up", "hold space", "let it land".
  - Permission-granting: "you're allowed to", "give yourself permission to".
  - "Here's the thing", "that's not nothing", "quietly does a lot of work".
  - **The profound-simplicity pronouncement (the deep pattern under all of the
    above — Sophie's diagnosis, July 2026):** "the first line your eye lands on
    IS the answer", "this lesson IS a tour of the hallway", "the real secret
    is…", "its real gift is…", "X is the practice; everything else is
    furniture". Delivering a grand little truth with total confidence, so
    simple the reader won't believe it. Also its fragment form: "Unsettlingly
    good." / "That's a spell by any name." / "The witch is portable."
  - **False-easy reassurance (reads as condescending):** "just tap", "just
    name three shapes", "the Tarot tab is right there", "it's that simple",
    "X is plenty", "everything else is elaboration". Don't keep telling the
    reader things are easy — show the small concrete step and let it be easy.
  Instead: say the content plainly — a concrete instruction, a real fact, or a
  specific image always beats an aphorism. When a card needs a closer, end on
  the action or the detail, not a pronouncement about it. Two escape hatches
  that keep warmth without the sermon: ATTRIBUTE the insight to the tradition
  ("dream lore treats a returning dream as…", "the old folk say…") instead of
  pronouncing it, and let IMAGES do the charm (the mint-tin altar, the magpie
  rhyme) rather than verdicts about the images. Em dashes and playful specifics
  are fine — the ban is on sermonizing, not on personality.
- **NEVER adjudicate the craft against science (Aug 2026, Sophie — a flag she
  raised on a live card).** This is a witch app, written for witches. An honesty
  card presents the skeptical account as something to reckon with; it must not
  hand down a verdict that the craft is false. The line that earned this was in
  the saliva card — *"same material, same logic … except this version works"* —
  which says, plainly, that the magical version doesn't. Also caught in the same
  sweep: *"Frazer's law is wrong about cause and right about material"* and
  *"Frazer's second law with the magic taken out"*. The fix is not softer
  wording, it's dropping the ruling: state what the laboratory can measure, state
  what the craft claims, and let them stand side by side ("a laboratory reads
  that as identity; a witch reads it as contact"). Watch for the tell — any
  clause whose job is to say which one is *real*.
  - Discernment cards are NOT this and stay: apophenia in Reading Signs, the
    frequency illusion, Littlewood's arithmetic. They teach the reader to tell a
    strong sign from a weak one, which is the craft's own tool. The banned move
    is ruling on whether the practice works at all.
- **The app is never the EVIDENCE (Aug 2026, Sophie).** A lesson may point at a
  feature; it may not cite the app as proof of its own subject. *"Synchronicities
  abound — the whole front door of this app says so"* and *"the front door of
  this app asks you every morning …"* are circular, and on a first visit they
  are also just false — she has not been doing this already. Open from the
  READER's own experience instead ("you think of someone you have not spoken to
  in years and they call that afternoon"). Feature pointers on an After card are
  fine; "the site says so, therefore it is so" is not.
- **A craft instruction starts with the INTENTION (Aug 2026, Sophie).** Telling a
  beginner to wind a hair around a key without naming what it is FOR disrespects
  the practice — magic starts with intention, and "write down your working" is
  jargon to someone who has never had one. Name the intention first, give two or
  three concrete examples of one, and only then the physical steps.
- **Researched, not generic** — Sophie asked for real research passes. Do 1–2
  web searches per lesson and put actual material in the cards (Culpeper 1652,
  the horoskopos, Epidaurus temple sleep, witch bottles dug up under
  thresholds). Be historically honest (e.g. the Wheel of the Year card admits
  the 1950s assembly). Name real names and dates — specificity is the charm.
- Bold (`<b>`) the key terms, one or two per card. Italics for asides.
  Escape apostrophes (`\'`) — the cards live in single-quoted JS strings.
- Body length: ~2–4 sentences. The image shrinks to make room, but keep it
  phone-sized.
- Safety cards where the topic needs one (poison path: "never touch or brew";
  shadow work: therapist note, kindness container). Never skip these.

### The ⓘ FAQ on a card (Aug 2026, Sophie — two samples live)

Cards are invitations: they name a real thing in one sentence and point at a
whole bank of knowledge behind it. A card can now answer the obvious follow-ups
in place — add `faq: [{ q, a }, …]` and a small ⓘ appears beside its heading;
tapping opens a panel over the card, tapping anywhere closes it. `a` may carry
`<b>`/`<i>`.

- **Order by which question the reader hits FIRST**, not by importance.
- **Three is the usual number.** Four or five when the subject earns it, more
  only if it genuinely needs it. Don't pad to a quota.
- Live samples to copy: `bh-03` (the forensic laboratory — what it did, whether
  a trace is DNA, whether it solved anything, why it's in a witchcraft lesson)
  and `sy-03` (acausal — what the word means, the coincidence objection, whether
  other psychologists accepted it, where to read the original).
- The ⓘ and its panel both `stopPropagation`, or opening the FAQ also turns the
  card. `scripts/test-lesson-deck.js` checks that for every lesson that has one.
- **Not built yet** (Sophie's ask, on the to-do list): FAQs on every card, and
  an organizational chart for the cards that point at whole *categories* of
  knowledge rather than one fact.

### The CTA button's row

A last-card CTA lives in its own `.cta-row` UNDER the scrolling `.deck-text`,
never inside it. Inside, it rested exactly on the container's clipped edge and
its rounded bottom corners were cut off (Sophie's report). Padding doesn't fix
that — `.deck-text` scrolls, so anything added below the button lands in the
overflow and the button still sits on the edge. Measured before/after: 0px
clearance → 16px.

## Illustrations

1. **Write a spec JSON** (see any `*-spec.json` from past runs; shape below).
   Card ids use a 2-letter lesson prefix: `sw- pm- pa- as- dw- pc- tr- rs- dv-
   cr- tw- al- sh- wy- ap- ce- sy-` are taken.

```json
{
  "refs": ["storage:witch-school/refs/sophie-snake.png",
           "storage:witch-school/refs/sophie-animals.png"],
  "cards": [
    { "id": "xx-01", "char": true, "prompt": "A woman ..." },
    { "id": "xx-02", "prompt": "Three simple emblems ..." }
  ]
}
```

2. **Prompt rules** (the script prepends the house STYLE text and appends the
   no-text suffix automatically):
   - ONE clear subject, generous cream space, flat and simple.
   - **Never any text** — no letters, numbers, labels, clock digits. If an
     idea needs "writing", show blank pages/banners.
   - Small **four-point stars** are the house accent; hearts sparingly.
   - `"char": true` for cards with the recurring woman (reddish-brown topknot,
     pink star jacket, striped pants — the script injects her description).
     Use her on ~3–4 of the 10 cards, incl. usually 01 and 10.
   - Objects over scenes. Diagrams welcome (compass rose, wheel, rows of
     emblems).

3. **Generate** (~$0.70/lesson, ~7 min; run as a background task):

```bash
OPENAI_API_KEY=<key> \
FIREBASE_KEY_FILE=<deckfactory service-account json> \
node scripts/witch-school-cards.js my-lesson-spec.json
```

   - The OpenAI key lives in Firestore doc `config/anthropic` field `openAi`
     (read it with the service account) or in Render env.
   - The deckfactory-43176 service account comes from Render env
     (`FIREBASE_SERVICE_ACCOUNT`) or Sophie shares it in-session.
   - Output: public PNGs at `witch-school/assets/<id>.png` **plus a sampled
     background hex per card** — the script prints paste-ready
     `{ img, bg }` lines. **Never skip the bg step**: each lesson screen tints
     to its own illustration's corner color; that's what makes the art float
     with no box.
   - **Recolored lessons (e.g. the PASTEL palette, on WHITE — Sophie's
     "What Do You Want to Wake Up To?").** A spec may override the palette and
     force a white background so the art floats on white instead of cream:
     - `"style"`: replace the whole style block (keep "bold black outlines,
       flat colors, NO gradients"; state the exact palette with hex codes, e.g.
       lilac `#C9B6E4` / pastel pink `#F6C6DA` / mint `#B6E5CF`, "on a PLAIN
       WHITE background").
     - `"charDesc"` / `"end"`: optional overrides of the character line and the
       trailing "empty space / no text" line.
     - `"whiten": true`: the models still tint the "white" slightly, so this
       flood-fills the **border-connected** background to pure white after each
       render (interior colors walled off by outlines — a bubble, a thought
       cloud — are preserved). Per-card `"whitenMode": "top"` seeds only the top
       edge; use it when foreground content bleeds to the bottom/side in a
       near-background color (else the fill eats it — e.g. a pink duvet on a
       pinkish ground). Default `"all"` seeds all four corners. With `whiten`,
       the sampled bg comes out `#ffffff`.

4. **Review in the Assets tab — NEVER a contact sheet (Sophie's rule, July
   2026).** File EVERY generated image into the chat's Assets tab, **labeled**,
   via `POST /api/gallery { assetsOnly:true, chat, url, description }` (the
   `description` is the label she reviews by — write a meaningful one per
   image). Then LOOK at each yourself (Read the PNGs) for style match, stray
   text, character consistency, image-matches-card. **Do NOT build or send a
   stitched contact sheet** — she reviews in the Assets tab, one labeled image
   at a time. Re-roll a dud to a **NEW id** (e.g. `xx-03-v2`), never
   overwriting: the old version STAYS in the gallery as history (label it
   "…v1 — superseded"). Each re-roll gets its own sampled bg.

## Wiring into `public/witch.html`

All in one place — search for `SPELL_CARDS` and copy the pattern:

1. **Cards array**: `const XX_CARDS = [{ img, bg, kicker, h, body, cta? }, …]`
   with the sampled bg hexes.
2. **LESSONS map**: add `xx: XX_CARDS`.
3. **Menu tile** in `#school-menu`: copy a `.lesson-card` block, new id
   `open-xx`, a Lucide line icon (inline SVG path, stroke-width 1.8), title +
   one-line description.
4. **Handler**: `{ const t = $('open-xx'); if (t) t.addEventListener('click',
   () => openLesson('xx')); }`
5. **CTA (optional, last card)**: `cta: { label, go: '<tab>', el: '<element
   id>', fallback: '<visible anchor id>' }` — or `{ go: 'book', book:
   '<sign|spell|dream|…>' }` to open the Book of Shadows to a section.
6. **Course path**: add the key to the right course's `lessons` array in
   `SCHOOL_COURSES` — its position IS its level on that course's road. Add the
   title to `LESSON_TITLES` too, or the end-of-lesson note screen sends the raw
   key to the AI.
7. **If shipping before the art is done**: hide the tile
   (`$('open-xx').style.display='none'` in a temporary list) and un-hide when
   the batch lands — the live app must never show broken images.
8. **Convert the art to webp before deploying** — `node scripts/webp-assets.js`
   then `node scripts/webp-assets-verify.js`. The page serves
   `witch-school/webp/`, there is deliberately no PNG fallback, and a card with
   no webp copy is a visibly broken picture in a live lesson. The verifier is
   the gate; it sweeps every `img:`/`cover:` id out of the page.

### Double-link it (Aug 2026, Sophie)

A lesson and the app feature it explains should reach each other **both ways**.
The last card's `cta` is the lesson → feature half. For feature → lesson, put a
small **ⓘ circle** (Lucide `info`, 16px, `--gold-dim`) next to that section's
kicker, firing `go('school'); openLesson('<key>')`. `.coin-info` on the Home
coincidence boxes → the Synchronicity lesson is the reference pair. Two rules
learned there: keep the ⓘ in the header row (never on the content, which is
often contenteditable), and give it `flex: none` so it can't squeeze the kicker
into a line break. The backlog of lessons still needing their ⓘ is in
`docs/secretly-a-witch-todo.md`.

## Test, then ship

- Headless check (Playwright, chromium at `/opt/pw-browsers/chromium`): open
  the lesson, count 10 progress segs, tap through all cards, confirm it closes
  on finish and no `pageerror`s. See the transcript's `alllessons.js` pattern.
- Feature branch → commit → push → draft PR → merge (standing permission) →
  watch the Render deploy (background task greping the live page for a new
  card id) → tell Sophie with clickable links.

## Current lessons (prefixes taken)

Spell Work (sw), The Magic of Plants (pm), Plant Magic II (pa), Astrology
Basics (as), Dream Work (dw), Protection & Cleansing (pc), Tarot 101 (tr),
Reading Signs (rs), Divination (dv), Crystals (cr), The Traveling Witch (tw),
Building an Altar (al), Shadow Work (sh), The Wheel of the Year (wy), The
Witch's Apothecary (ap), Crystal Energy (ce), Synchronicity (sy).

## Roadmap notes (Sophie's asks)

- Imprint-style **learning paths** (e.g. Advanced Potion Making, progressing
  through detailed herb lessons) — she'll share a reference screenshot.
- Herb content should feature the **obscure herbs she actually sells**
  (pull the live list from the Shop tab / secretlyawitch.com Shopify), not
  just kitchen basics; link Dream Work to the **Mugwort Dream Tea** product
  once it exists.
- **The deferred list is a NO list, not a queue (Sophie, 2026-08-08: "all the
  ones in the deferred list are ones I probably don't wanna do — that's why
  they're in that list").** Do not pitch one of these as ready to build, and do
  not treat "it's already on the roadmap" as a point in its favour; it is the
  opposite. Deferred: Moon Magic, Candle Magic, Sigil Craft, ~~Familiars~~
  (crossed out by Sophie 2026-08-08 when it was proposed for The Living World),
  Bath & Water Magic, Money Magic, Ancestor Work.
- **Proposed course — The Living World** (Sophie asked for the shape of a
  biology course, 2026-08-08). Shipped: **Blood, Spit and Hair** (`bh-`). The
  rest of the proposed path, in level order, none of them started and none of
  them approved: The Body as Instrument (goosebumps, the vagus nerve,
  interoception — pays off the Synchronicity "does it land in your chest" rule);
  The Moon and the Body (tides, the menstruation claim, the 2021 lunar
  sleep-synchrony work — an honesty lesson); Beasts of the Craft (toads, hares,
  cats, corvids — Betty the crow bending wire at Oxford in 2002); Rot and
  Ferment (decay as transformation, Leeuwenhoek's animalcules); Mycelium (fairy
  rings, plus an honest card on how oversold the "wood wide web" is — the 2023
  *Nature Ecology & Evolution* critique); Bones (Shang oracle bones,
  scapulimancy, and what is legal to keep). **Herbs stay in Plant Magic** — a
  biology course must not re-teach them, and Poison & Dose belongs there too,
  where the poison-path safety rule already lives.
