# Similitude Dominoes

Her triangular Similitude cards played as dominoes against the computer. Built
2026-09-02 at her ask — "reuse the chosen triset cards to make dominoes u can
play w the computer · no render · just compare artifact" — so it is a **Compare
page in her chat's Compare tab**, not a tool: nothing was added to `server.js`,
nothing deploys, and opening it spends nothing.

Live (v4): <https://imageforge-q125.onrender.com/api/chatfeed/page/P9iiTPEj0eG4WpCqiivy> (older versions superseded, kept as history)

## The game (v4)

**One card is one tile, only one of each, edge to edge.** A card in a
point-down space is **turned 60°, never upside down** — a 60° turn of a
point-up triangle IS the point-down triangle, so the picture tilts a little and
lands exactly on the space with nothing to clip. A card has three sides, so it
touches up to three cards; tap one on the table to read its links back.

- **Three in hand; draw one after each lay.** 24 cards a round.
- **She says what she sees every turn** — one box per card touched.
- **A point per card touched.** Two may each share something different with
  it; three share the SAME thing or each a DIFFERENT one — the two kinds of
  Similitude set, never two-and-one. The page refuses a 2+1 with the rule on
  screen.
- **Pass = swap any of your cards** (tap the ones to swap), or keep them all.
- The round ends when every card is down, or when the pile is empty and both
  pass in a row. Higher score wins.
- **Every game is recorded** — see *Reading her games* below.

## What she corrected, in order

Each one is why the build looks the way it does; the earlier readings are
history, not options.

1. **v1 made them squares** — two-ended dominoes with her cards as pips. "oops
   no triangle dominoes. u made them into squares. they can connect on 3
   sides."
2. **They do not match by picture** — "the cards connect based on perceived
   commonality." So there is no matching rule in the mechanical sense; the join
   is a judgement.
3. **Only one of each card** — so a tile is not a set of pips drawn from a small
   vocabulary. A tile is one picture.
4. **After the v2 playtest** ("this is much closer to what i envisioned. and:
   it's actually really fun"): white triangles in the corners of some cards
   (v2 rotated a point-up cut 180° inside a point-down clip, and SVG transforms
   the clip along with the image — a hexagon, corners bare); **no 180°, choose
   a different way** → then **"don't include point down ones"**, which settled
   it: no card ever points down, and the point-down spaces became the middles;
   a **pause** for the computer to think; **match on visual cues** (all 84
   cards were LOOKED at on contact sheets and re-tagged by colour, light, shape,
   composition and mood — `cards.json`); **ask what they share every turn**;
   the **scoring** above; **three in hand, draw each turn, pass swaps any
   number**; **record each game**.
5. **v3 read as broken** — the middles looked like "an imaginary card between",
   and she clarified the rotation ask: "just rotate 30 or 60 degrees not upside
   down". So v4 is edge to edge again with the down cards turned 60°. The
   middles are history; the words live on the cards (tap to read).

## Things that are decided, not incidental

- **HER EYE IS THE GAME; THE TAGS ARE ONLY WHAT A PAGE WITH NO MODEL CALL CAN
  READ.** Every card carries a few tags in `cards.json`. The computer may only
  lay a card where it shares a tag with **every** neighbour it touches — so it
  plays honestly and passes rather than stretching, which is already the house
  rule for this opponent ("a stretch is a pass"). **She is not bound by them**:
  any space touching the table is hers, and where the tags see nothing she says
  what she sees and it stands. Nothing on this page judges her.
- **NO MODEL CALL ANYWHERE, and that is what "no render" bought.** A computer
  that could name a commonality in its own words would need a new route in
  `triset.js` and a deploy. The tags are the client-only answer: real links,
  free, and honest about what it cannot see. `/api/triset/opponent` is no help
  here — it wants exactly three cards for the set game.
- **A TAP MUST LAND ON THE TRIANGLE, NOT ITS BOX.** Triangles tessellate, so
  every tile's rectangle overlaps its neighbours'. An HTML box hit-tests its
  whole rectangle however little of it is painted, so both the `<span>` and the
  `<svg>` are `pointer-events: none` and only the drawn polygon takes a tap.
  This was caught by a real click, not by reading the code: the neighbour ate it.
- **THE TABLE ZOOMS OUT AS IT GROWS**, to a floor of 0.55, and is centred with
  `margin:auto` inside a flex board — the one centring that also lets it be
  scrolled to once it outgrows the box.
- **A DOWN SPACE IS A 60° TURN, and the transform is exact.** `rotate(60)`
  about the up card's centroid (50, 57.73) puts its three corners on the
  point-down triangle 28.87 units lower, so `translate(0,-28.87)` after it
  lands the card on the space to the pixel — no clip-path (v2's bug was a
  clip that rotated with the image), no bare corners. The four MADE cards,
  cut point-down by design, stay out of the deck (`build.js` drops `flip`).
- **THE TAGS ARE VISUAL.** The first pass tagged from the titles ("hummingbird",
  "trumpet flower"); she asked for visual cues, so every card was viewed and
  tagged by what is in the picture — `dark`, `round`, `glowing`, `many`,
  `alone`, `close-up`, `pale`. The computer names the rarest shared tag, so
  "both dark" beats "outdoors".
- **The whole page is `data-nostop`** — every tap here is gameplay and must
  never start the autoscroll.
- **The top row reserves 64px** for the injected pill, and the say-what-you-see
  box ships **empty** (the message line already asks the question by name; a
  placeholder would be the same question twice, and `POST /page` warns on one).
- The display name is **Similitude** (her rename, 2026-09-01); `triset` stays
  the identity everywhere in code.

## Reading her games

Every game writes to this page's verdict doc — no server change, the same
route the note box uses:

    GET /api/chatfeed/verdict?chat=triset-dominoes-game&sheet=dominoes-v4

`texts` holds one JSON string per item: `g<game>` is the header (`cards` at
the open, `you`/`it`/`done` when it ends) and `g<game>-<n>-you` /
`g<game>-<n>-it` is each move — `{card, at, pts, links:[[otherCard, why]…]}`
or `{pass:true, swap:n}`. Card ids are the first 8 chars of the triset card
id. **Her `links` are the examples she said to learn the tagging from** — the
v2 playtest's were lost because v2 kept them in memory, which is why this
exists.

## Rebuilding

    node docs/triset-dominoes/build.js           # writes /tmp/dominoes.html
    node docs/triset-dominoes/build.js --post    # publishes a NEW Compare page

The cards are read LIVE off `/api/triset/cards`, so the game is always her real
nature deck; `cards.json` is the name and tags per card **in that collection's
own order**, and the build warns if the deck has grown past the tags. A new
version is a NEW page — bump `TITLE` and supersede the old one.

## Testing

    node docs/triset-dominoes/test-dominoes.js   # needs playwright + PLAYWRIGHT_BROWSERS_PATH

Serves the built page with the real `/compare.css`, `/compare.js` and the real
injected pill, plays a whole round by tapping — laying where the tags see a
link and typing a reason where they do not — and asserts what only a
measurement can say: the 24 cards stay conserved across table + hand + its hand
+ pile, the round really ends, the card images really decode, and the page
never scrolls at any table size. It proxies the cut images off disk (`cuts/`),
the one thing headless Chromium here cannot reach.
