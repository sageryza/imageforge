# The Chats masthead at 390pt — which control gives way

**The ARCHIVE word gives way.** It is drawn as the archive-box icon now (Lucide
`archive`, 17px, the same `.trashbtn` box the trash can already wears in this
row). Nothing else on the masthead moved, and the word TO DO is the one word
left on it.

Branch `claude/model-test-bug-x`, not merged, not deployed. The change is in
`public/chats.html` (the markup of `#archlink`, one CSS rule, and the two
comments beside them), with the doc note in `docs/chats-app.md` and the pointer
in `CLAUDE.md` updated to match.

## What was wrong, measured

Headless Chromium, the real page over a stubbed feed (`measure-masthead.js`
beside this file), chat list open, before the change:

- 375pt: controls start at x=69.5, "Chats" runs x 18.8 → 95.0. Overlap 25.5px.
  `elementFromPoint` 3px in from the end of the word answers `#bmklink`.
- 390pt: controls start at x=83.8, "Chats" runs x 19.5 → 95.7. Overlap 11.9px.
  Same answer: `#bmklink`.
- 430pt: controls start at x=121.8. Clear.

The five controls on the chat list needed 230.8px: bookmark 25 · TO DO 52.1 ·
ARCHIVE 68.6 · the account switch 48 · the row toggle 21, with four 4px gaps.
(The trash can is the sixth and is hidden on the chat list; it only shows in
the Archive, where the row toggle is hidden instead, so the row is five wide in
every view.)

Why it matters more than "a few pixels": her pull-to-refresh IS the big title
("her pull is the big title", the tool-row note), so a pull that started on the
"s" opened Bookmarks. That is the same bug the trash caused when it shipped as
a fifth word in Aug 2026, and it came back the day the row toggle joined the
row (2026-08-28).

`scripts/test-chats-accounts.js` was red on it at 375 and 390.

## After

- 375pt: controls start at x=117.1. The word has 22px clear.
- 390pt: controls start at x=131.4. The word has 36px clear.
- 430pt: controls start at x=169.4.
- The row is 183.1px (was 230.8).
- In the Archive view (title "Archive", the lit archive box plus the trash):
  the word ends at x=121 and the bookmark starts at x=131. The box is lit in
  full ink (`rgb(38,34,28)`), not the trash's red.

Pictures: `masthead-390-before.png`, `masthead-390-after.png`,
`masthead-390-archive-after.png`.

## Why that control and not another

Every candidate was costed against what she asked for, and the archive word is
the only one whose cost is a glyph she already knows.

- **The title.** It would need 1.68em at 390 and 1.33em at 375 (from 2.0em) to
  clear. It is the thing she reads, her pull, and her way back out of a
  sub-view. It was already taken from 2.3em to 2.0em for this exact row. No.
- **The account switch.** 48px is measured, not chosen: "a 42px track would
  have left the three stops only 8.5px apart, which is not enough to tell the
  middle from either end." No.
- **The bookmark.** Already an icon at 25px; dropping its side padding to zero
  buys 8px, less than the 12 needed at 390 and nowhere near the 25.5 at 375.
  And she placed it: "Bookmark LEFT of the word". No.
- **TO DO.** Turning it into an icon saves 27px, which clears 390 by 15 and
  375 by 1.5, and the obvious glyph is the check-list she had removed from
  this very row: "the weird check-plus next to the big chat's name — I don't
  actually know what it does". A glyph she cannot read is the failure this
  row already had once. No.
- **The row toggle.** 25px with its gap, so it would clear 390 and only just
  touch at 375. But it has nowhere to go. Her words put it "next to account
  switcher". The tab row it swaps is measured full — at 390 "BUG FIXES" plus
  its badge wants 80.5px of a 79.8px tab, and a fifth cell of 25px makes that
  overflow at 390 and 375 both. The tool row above it is measured full too:
  "a FOURTH icon here is not free … at the old 8px gap the Tags chip wraps and
  the whole list drops 32px". Two rows of chrome is against MINIMIZE THE
  SCROLLING. No.
- **ARCHIVE.** 68.6px → 21px saves 47.6, which clears both phones with room
  (22px at 375). The archive box is the standard glyph for the thing, and it
  is her own precedent in this row: "put trash in archive and make it just a
  picture of a trashcan I guess". The screen it opens says ARCHIVE in green
  serif across the masthead, so the tap explains itself, and the lit state
  still darkens to ink the way the word did. Her ask about this control was
  "just the word — no box, no border", which was about stripping the box; the
  no-box rule still holds (bare glyph, no plate, the house rule for icons).

## Things not to undo

- `.trashbtn.archbox.on{color:var(--ink)}` exists because `.trashbtn.on` is
  the trash's red, and on this screen red means "a tap that destroys
  something". The class is `archbox`, not `archbtn` — `.archbtn` is already
  the archive row's move-one-chat button further down the file, and the first
  cut of this change collided with it (the icon came out 31px wide, padding
  0, at 15px font, which is how the collision was found).
- `paintHomeChrome` already set the aria-label on `#archlink` ("Show archived
  chats" / "Back to all chats"), so the icon is read out the same as the word
  was.
- The thread header's own ARCHIVE word (`#thread .archlink.arch-g`) is a
  different control and is untouched.

## Tests

Green on this branch: `test-chats-accounts` (the pin for this row, was red),
`test-chats-title-back`, `test-chats-trash`, `test-chats-bug-tag`,
`test-chats-archive-tags`, `test-chats-tag-visibility`,
`test-chats-search-archive`, `test-chats-list-tabs`,
`test-chats-account-default`, `test-chats-unread-count`, `test-chats-labels`.

Red on this branch AND identically red on the unchanged page, so not this
change: `test-chats-tap-targets` (the page throws `Unexpected token ':'` and a
13.5px/15px size assertion) and `test-chats-archive-summary` (two assertions
about the three-answer summary).
