# Similitude Dominoes

Her triangular Similitude cards played as dominoes against the computer. Built
2026-09-02 at her ask — "reuse the chosen triset cards to make dominoes u can
play w the computer · no render · just compare artifact" — so it is a **Compare
page in her chat's Compare tab**, not a tool: nothing was added to `server.js`,
nothing deploys, and opening it spends nothing.

Live (v2): <https://imageforge-q125.onrender.com/api/chatfeed/page/fCfdW4XnRtkUJ3fluH2x>

## The game

**One card is one tile, and there is only one of each.** A triangle has three
sides, so a card can be joined on three — and what joins two cards is **what
they have in common**. Twenty-four cards a round, seven each, the rest the pile.
Tap a card in your hand, then tap a space. Go out and you score the cards left
in its hand.

## The three things she corrected, in order

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
- **A CARD IS CUT POINT-UP, so a point-down space turns it 180°.** That is what
  a tessellation costs, and a triangular tile is read from whichever side you
  are sitting on. Photographed before shipping: it reads as a quilt, not as a
  mistake. Hers to veto.
- **The whole page is `data-nostop`** — every tap here is gameplay and must
  never start the autoscroll.
- **The top row reserves 64px** for the injected pill, and the say-what-you-see
  box ships **empty** (the message line already asks the question by name; a
  placeholder would be the same question twice, and `POST /page` warns on one).
- The display name is **Similitude** (her rename, 2026-09-01); `triset` stays
  the identity everywhere in code.

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
