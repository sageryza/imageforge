# Similitude Dominoes

Her triangular Similitude cards used as the pips of a set of dominoes, played
against the computer. Built 2026-09-02 at her ask — "let's reuse the chosen
triset cards to make dominoes u can play w the computer · no render · just
compare artifact" — so it is a **Compare page in her chat's Compare tab**, not
a tool: nothing was added to `server.js`, nothing deploys, and opening it
spends nothing.

Live: <https://imageforge-q125.onrender.com/api/chatfeed/page/1J7HhyPoOyCKErDcKlK4>

## The shape of it

- **Seven of her nature cards are the seven suits** → 28 dominoes, every
  unordered pair, doubles included. Double-six, with pictures instead of pips.
- Deal 7 and 7, 14 in the pile. The highest double leads (else the highest
  tile), and whoever holds it starts.
- Tap a tile in the hand to lay it on a matching end. Fits both ends → two
  buttons appear **carrying the end pictures**, so the choice is made by
  looking. No move → Draw; no pile → Pass.
- Go out and you score the tiles left in the other hand; blocked, the shorter
  hand scores the difference.
- **New suits** re-deals seven fresh cards out of all 84 in the nature deck —
  the reason the whole deck is embedded, not just the seven.

## Things that are decided, not incidental

- **THE CHAIN WRAPS.** It was a single scrolling row first, and the PHOTO of a
  19-tile game showed 4 tiles with both ends out of reach. Wrapped, a whole
  round sits on one screen and reads like dominoes snaking round a table. It
  also killed the two end-chips at the top, which existed only to stand in for
  ends she could not see — the end pictures now ride the Left/Right buttons,
  where the decision actually is.
- **A DOUBLE LIES CROSSWISE ON THE TABLE AND FLAT IN THE HAND.** Crosswise is a
  table convention; a hand where half the tiles are 90° out is just ragged.
- **THE REPAINT NEVER REBUILDS A TILE.** Both the chain and the hand are keyed
  by domino and reordered in place (`reorder`), because a recreated `<img>`
  decodes async on iOS and the whole board would strobe blank on every move.
  The hand's index rides on the node (`dataset.k`) under one delegated
  listener, so a repaint never re-creates a closure either.
- **THE TOP ROW RESERVES 64px.** The board is a real scroller on a long chain,
  so the pill really appears and really sat on that row.
- **The whole page is `data-nostop`** — every tap here is gameplay and must
  never start the autoscroll.
- **The computer is a plain heuristic in the page**: keep the ends on suits it
  still holds, dump doubles early, remember what she could not play on. No
  model call, no server, no cost.
- The display name is **Similitude** (her rename, 2026-09-01); `triset` stays
  the identity everywhere in code.

## Rebuilding

    node docs/triset-dominoes/build.js           # writes /tmp/dominoes.html
    node docs/triset-dominoes/build.js --post    # publishes a NEW Compare page

A new version is a NEW page — bump `TITLE`'s v number and supersede the old one.

## Testing

    node docs/triset-dominoes/test-dominoes.js   # needs playwright + PLAYWRIGHT_BROWSERS_PATH

Serves the built page with the real `/compare.css`, `/compare.js` and the real
injected pill, plays a whole round by tapping, and asserts what only a
measurement can say: the 28 tiles stay conserved across chain + hand + its hand
+ pile, the round really ends, and the page never scrolls at any chain length.
It proxies the card images off disk, so run it after fetching a few cuts into
`cuts/` (the images are the one thing headless Chromium here cannot reach).
