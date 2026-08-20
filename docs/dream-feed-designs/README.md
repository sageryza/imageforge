# Dream feed — the Claude Design canvas export (Aug 2026)

Sophie's design canvas for reworking the LIVE dream feed (`dreamapp.js`,
page `/dreamfeed` → `public/dreamapp.html`). Exported from Claude Designs as
`.dc.html` artboards + the canvas runtime (`support.js`); NOTHING here is
wired in yet, and the artboards are mockups, not app code.

- `Dream App Directions.dc.html` — three rounds of options. Round 1: 1a The
  Journal / 1b Night Drift / 1c Fever Scrapbook. Round 2 (the fever-dream
  push): 2a Melt Feed / 2b The Blinking Eye / 2c Desktop Fever Broadsheet.
  Round 3 (refining 2a upright): 3a Fredericka header / 3b Shantell header.
- `Dream Feed Prototype.dc.html` — 2a built as a working prototype (compose,
  feed, tagging, hearts, comments).
- `Sharing Flow.dc.html` — audiences: everyone ✳ / a circle ☾ / just me ◦
  (the vault), the compose toggle, how each looks in the feed.
- `Dream Feed Web.dc.html` — **the DESK** (Aug 2026, Sophie: "the desktop
  version of the dream feed. It's a fun masonry layout, and I want it to look
  good on a desktop. But not on the mobile site"). PORTED — this one is wired
  in: the `@media (min-width:900px)` block plus the `masonry()` column builder
  in `public/dreamapp.html` are its values, and `node
  scripts/test-dream-desktop.js` pins both halves (the desk's mats and the
  phone's untouched flat DOM). Two deliberate departures from the artboard,
  ONE deliberate departure, to protect what she is reading: the columns are
  real elements filled shortest-first rather than `column-count`, which
  re-balances the whole feed the moment a card grows.
  **What the first port got wrong, and why (2026-08-20, Sophie: "you didn't
  even do the masonry layout"):** it kept the phone's rule that cuts a dream's
  words to its picture's height, so every card came out one picture tall and
  the columns ended level — a grid wearing melt shapes. That cut is a
  ONE-COLUMN rule (picture and words side by side, matched so neither leaves a
  hole); in columns it is the thing that destroys masonry. It also broke the
  flow into full-width mats at each day divider, which forced every column to
  end level a second time. Both are fixed: the desk folds at a flat 12 lines
  and the divider rides inside a column, as it does on this artboard.
  **To re-render the artboard** (unpkg is blocked in the sandbox): curl
  `react@18.3.1/umd/react.production.min.js`, `react-dom@18.3.1/umd/…` and
  `@babel/standalone@7.29.0/babel.min.js` to disk, serve this folder over
  http, and `page.route(/unpkg\.com/)` them in from the local copies.
- `renders/` — flat PNGs of each round, for reading on a phone.

The artboards render offline in headless Chromium if React/Babel (unpkg) and
Google Fonts are proxied in; the fonts ARE the difference between 3a and 3b,
so a render without them is misleading.

Open question before any port: the design shows bylines, @tags and named
circles, while the live feed posts dreams UNATTRIBUTED (`byTag` in
`dreamapp.js`) and has one public/private flag per piece.
**Answered for circles (Aug 2026): the no-names rule wins** — see
`docs/dream-feed-circles.md` (the ☾ design: roster visible, author never,
guessing as the game) and `circles-compare-v1.html` here (the Compare page
posted for review, in the live app's melt-feed language rather than this
canvas's).
