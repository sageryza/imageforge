# The necklace review — the swipe deck for her mom's Lightroom necklaces

## Where this came from
The 17th St 385 recording (2026-09-16), Sophie and her mom deciding how the
review should work. `17th-st-385-transcript.txt` is whisper-1's transcript,
verbatim; the same text is an editable block in the
`transcribe-display-preferences` chat, so her corrections live there rather
than in this file.

## What she asked for, decision by decision
- **Which necklaces:** the necklace folder in Lightroom, titles that are `N`
  and a number and nothing else.
- **Left out:** any title carrying *sold*, *sample bag*, *gave*, *gifted* or
  *donated*.
- **One card per necklace, every photo of it on that card.** Front and back
  where that is all there is, all five where there are five — so one swipe
  does the whole item. This is the `deck` template's `spreadAll: true`
  (a twin set of any size stays ONE card), not a card per photo.
- **Thumbnails, not too small.** No big cover shot — she recognises the piece;
  she only needs to tell them apart.
- **On the computer, not the phone** — "I can't see my photos well enough on
  my phone." Her mom's five-minutes-a-day streak idea needs the phone and was
  set aside for that reason; a phone view is fine to have, it just isn't where
  she will do this.
- **Four answers: yes · maybe · no · star.** Her stated preference. Her mom
  offered 0/1/2/3 and said she has no preference, so yes/maybe/no/star wins.
- **Then a starting twenty.** She expects to keep most of them; a top ~20 is
  what actually gets listed first, so the run doesn't cost a fortune.

## Where it is
- The spec read back to her, as a Compare page in her chat:
  `/api/chatfeed/page/LeNc9LxWJ5A1qJxwG6Zd` (source: `spec-page-v1.html`).
  Her ♥/✕ and notes on each line land on sheet `necklace-review-spec`.
- The photos are not in the app yet. Getting them out of Lightroom is a
  desktop task — see *Export the necklace photos out of Lightroom* in
  `docs/desktop-tasks.md`. Nothing can be built until that runs.

## Related work
- `jewelry-upload-website` — the one-photo-in, five-shots-out page for her mom
  (`jewelry.js`, `/jewelry`).
- `extract-susanryza-photos` — pulling her mom's finished-piece photos off
  susanryza.com and re-shooting them through the image model.

Both are about her mom's jewelry going to Etsy; this deck is the step in front
of them — deciding WHICH pieces are worth the listing.
