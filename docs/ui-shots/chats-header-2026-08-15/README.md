# The Chats thread header — the shots that settled it (2026-08-15)

What a chat's header row looks like after Sophie's two passes on it that day
(the bell, then "yellow and filled, and stop being red at rest"). The rules
these settled live in `docs/chats-app.md` → *The bell and the two picture
buttons*; these are the pictures behind them, kept because the first round got
one of them wrong by reasoning instead of looking.

- **`bell-candidates.png`** — the one that mattered. Outline vs Lucide-filled
  vs a hand-drawn filled bell, at 16px (real size) and 96px, across three golds
  on cream and two on the dark paper. **It overturned a comment already
  committed** claiming a filled bell "stops reading as a bell": filled reads
  *better* at 16px, where the outline's walls close up. What is true is only
  that filling *Lucide's* path leaves its clapper a detached crescent — hence
  the hand-drawn pair now in `BELL_SVG`.
- **`header-light-live.png`** — an ordinary chat: grey eye, grey can, unset
  bookmark/star/bell.
- **`header-light-belled.png`** — bookmarked, starred and belled: the two reds
  and the gold side by side, which is the comparison the gold had to survive.
- **`header-light-hidden.png`** — a chat in the hidden pile: the eye crossed
  AND red, the only state either picture button is red in.
- **`header-dark-belled.png`** — the same row on the dark paper, which is why
  `--bell` has two values instead of one fixed colour.

Regenerating them is a throwaway harness (a stub feed + `playwright-core` +
`page.screenshot`), not a committed script — `scripts/test-chats-bell.js`
asserts the same things in numbers, and numbers are what a test should watch.
