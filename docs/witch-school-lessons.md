# Witch School — how to create a lesson (any chat can do this)

The complete workflow behind the 14 live lessons (July 2026). Follow it and a
new lesson will come out matching the others. Everything runs from this repo;
no files from Sophie are needed (her style refs live in Firebase Storage).

## What a lesson is

- **10 tap-through cards** in the Secretly a Witch web app
  (https://imageforge-q125.onrender.com/witch → School), Imprint-style:
  full-screen takeover, gold progress dashes, tap right to advance / left edge
  to go back.
- Each card = one illustration + a kicker + a heading + a short body.
- **Arc:** card 1 welcomes ("we'll go one small idea at a time"), cards 2–9
  teach one idea each, card 10 is always kicker **"After"** — a tiny concrete
  action for tonight/this week, ending with **✦**. If the app can DO the thing
  (dream reader, birth chart, tarot draw, Book of Shadows), the last card gets
  a CTA button (see Wiring).

## Voice rules (this is what makes them feel the same)

- Warm, plain, a little literary. Second person. No fluff, no "mystical" filler.
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

## Illustrations

1. **Write a spec JSON** (see any `*-spec.json` from past runs; shape below).
   Card ids use a 2-letter lesson prefix: `sw- pm- pa- as- dw- pc- tr- rs- dv-
   cr- tw- al- sh- wy-` are taken.

```json
{
  "refs": ["storage:witch-school/refs/style-1.png",
           "storage:witch-school/refs/style-2.png"],
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

4. **Review before shipping.** Download the 10 images, build a contact sheet,
   LOOK at it. Check: style match, no stray text, character consistency, each
   image matches its card. Re-roll single duds by making a mini-spec with just
   those ids (same id = overwrites in Storage; use the NEW sampled bg).
   Send Sophie the contact sheet in chat.

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
6. **If shipping before the art is done**: hide the tile
   (`$('open-xx').style.display='none'` in a temporary list) and un-hide when
   the batch lands — the live app must never show broken images.

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
Building an Altar (al), Shadow Work (sh), The Wheel of the Year (wy).

## Roadmap notes (Sophie's asks)

- Imprint-style **learning paths** (e.g. Advanced Potion Making, progressing
  through detailed herb lessons) — she'll share a reference screenshot.
- Herb content should feature the **obscure herbs she actually sells**
  (pull the live list from the Shop tab / secretlyawitch.com Shopify), not
  just kitchen basics; link Dream Work to the **Mugwort Dream Tea** product
  once it exists.
- Deferred lesson ideas: Moon Magic, Candle Magic, Sigil Craft, Familiars,
  Bath & Water Magic, Money Magic, Ancestor Work.
