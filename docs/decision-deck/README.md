# Decision Deck — Sophie's own canvas for the review deck (Aug 2026)

Her Claude Designs artboards for the Tinder-style review deck. Exported as
`.dc.html` + the canvas runtime (`support.js` lives beside the other export,
in `../dream-feed-designs/`); `ios-frame.jsx` is the phone frame they render
inside. These are mockups, not app code — the live deck is `public/judge.js`,
posted into a chat with `POST /api/chatfeed/page {template:'deck'}`.

- `Decision Deck.dc.html` — the first pass.
- `Decision Deck v2.dc.html` — **the design every deck wears now**: her cream,
  one screen with no scrolling, the progress line with Piles and the "?", the
  ✕ / ♥ floating on the content with a full-width "Note for Claude…" box
  under it. Ported — see THE REVIEW QUEUE in `CLAUDE.md`.
- `Decision Deck v3.dc.html` — v2 plus **the GOOD / BAD stamp** (Sophie: "a
  little good/bad stamp that stamps the ones that you pick or don't pick").
  PORTED: the `jgstampA` / `jgstampB` keyframes, the `#jgInk1` / `#jgInk2`
  turbulence filters and the two radial-hole mask patterns in `judge.js` are
  this artboard's values. Test: `node scripts/test-judge-stamp.js`.
  Departures, all so the stamp says only what she said: `maybe` / `later` /
  a deck's own words stamp nothing, and a deck with no browse mode waits out
  the animation before it advances so the card she is leaving is the one that
  wears the mark.
