# The masthead's bookmark taking a tap on "Chats"

## What was wrong (measured, headless Chromium, the real `public/chats.html`)

On the chat list the masthead shows five controls (the trash is hidden off the
Archive, which makes six in all): bookmark · To do · Archive · account switch ·
row toggle. The title `#htitle` takes zero width by design and draws across the
row, with `pointer-events:none`, so a tap on the end of the word falls through
to whatever control is underneath.

- 390pt: controls start at **x=83.8**; "Chats" runs to **x=95.7**. A tap 3px
  from the end of the word hit `#bmklink`, so it opened Bookmarks.
- 375pt: controls start at **x=69.5**, against a title ending at **95.0**, which is
  25px of overlap.
- 430pt: no overlap.

`scripts/test-chats-accounts.js` already checks for exactly this and was
**failing on main** at 375 and 390.

## Which control gives way: the ROW TOGGLE (`#rowtog`)

It moves out of the masthead to **the right end of the tab row it swaps**
(My tray · All · Delivered · Bug fixes, or the account tabs 1 · 2 · 3). The two
tab rows and the toggle now share one line (`.tabline`), and the hairline runs
on under the glyph. Nothing about what it does changed: same id, same handler,
same glyph swap (the glyph shows what a tap gives), still only shown on the
chat list.

Why this one and not another:

- **It is what tipped the row over.** The account-switch note measured the
  masthead's controls at 205.8px, and that fit. The row toggle (2026-08-28) was
  added after that measurement and is the extra 25px. Its own comment already
  noted that "the header's control row is already five wide at 390pt".
- **It isn't a place.** Bookmarks, To do, Archive and the trash each open a
  view whose name the big title then shows, and the title's tap is the way
  back from it. They belong beside the title. The row toggle only swaps the
  tab row, so the honest place for it is on that row, next to what it changes.
- **The other fixes cost more.** The account switch is a measured 48px, three
  notches, and is her app-account setting. Turning "To do" into an icon risks
  the "what does this glyph do" answer she gave the old list-todo icon.
  Shrinking the title was already done once (2.3em → 2.0em).
- **Not the tool row either.** I tried it there first, as a fourth icon beside
  the hourglass, bug and Instagram. It wrapped the Tags chip onto a second line
  and dropped the whole list 32px, and `test-chats-bug-tag.js` failed on it.

## After (measured, 375 / 390 / 430pt)

- Masthead controls start at **x=94.5 / 108.8 / 146.8** against a title ending
  at 95.0 / 95.7 / 97.7. A tap on the end of "Chats" now lands on the title at
  all three widths.
- The toggle is a 30px slot at the row's right end (y 194–224), below the
  pill's reserved corner, and `elementFromPoint` at its centre returns
  `#rowtog`.
- The four tabs lose 30px between them (about 7.5px each). At 390pt, ALL with
  its badge and BUG FIXES still sit on one line (photographed).

## Tests

All ten pass: accounts, bug-tag, unread-count, list-tabs, account-default, title-back, labels, archive-tags, trash, todo. `test-chats-accounts.js` was failing on main
at 375 and 390 for exactly this bug, and it passes with the change.

## Not done

Nothing deployed, merged or spent. The change is only on `claude/model-test-bug-y`.
