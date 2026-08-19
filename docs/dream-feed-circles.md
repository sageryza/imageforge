# The InBetween — a circle ☾ (dream feed sharing, design)

**Status: SUPERSEDED the same day it was posted (Aug 2026) — Sophie
simplified it, and the simpler model is BUILT.** Her call: "it's getting too
complicated … let's just do everyone and then friends and then just me — and
then we'll also have something called circles except I won't call it circles
… maybe we'll call them like dream teams." What shipped (THE DIAL in
`dreamapp.js`, `scripts/test-dreamapp-teams.js`):

- The dial is **✳ everyone · ☾ friends · ◦ just me** — friends is a fixed
  middle stop, not a per-post circle picker.
- **Dream teams** (`forge-dreamapp-teams`) are groups joined by invite link
  (`/t/<code>`), managed from the archive's "dream teams" screen. A team is a
  **distribution list, not a second feed**: a post to everyone reaches
  teammates because it is public, and a post to ☾ friends reaches exactly the
  people who share a team the author routed friends-posts into (the
  per-member `friendsToo` toggle — "when you post to friends it also posts to
  that circle, or that it doesn't").
- Kept from this design: no-names inside a group, the invite-link-is-the-key
  pattern, any member can pass the link on. Dropped (for now): the guess
  game, the claim/reveal, per-post circle choice. The rest of this file is
  the original circles design, kept as the study those calls came from.
- **And friends are REAL, mutual people since the same day** (Sophie: "like
  following on Instagram except you have to let them accept you — a two-way
  Facebook model"): ask by personal link (`/f/<code>`), accept on the friends
  screen, the holding-hands moment on the yes. `forge-dreamapp-friends` /
  `forge-dreamapp-profile`; a ☾ friends night reaches accepted friends OR
  routed teams.

The seen-by dial in the live app had two stops (✳ everyone · ◦ just me); this
was the design for the third, the one the Sharing Flow artboard sketched
(`docs/dream-feed-designs/Sharing Flow.dc.html`) and `dreamapp.html`'s own
comment promised ("Circles (☾) arrive with the sharing-flow phase").

## Where the design comes from — Sophie's group dream journals

This feature is a port of something real, twice-proven (her words, Aug 2026):
a social-experiment club in college voted for a group dream journal, and it
worked *because* "it was everyone in the club so you knew some people, but you
didn't know everyone." She then brought it to her polycule: "you knew your
partners of course, but you didn't know your partners' partners, and you
certainly didn't know their friends." The dreams were anonymous, "so you
couldn't tell exactly whose was whose and you just had to guess" — and the
guessing mattered because "you had complicated relationships with everyone in
the group, so their subconscious could be important — expose jealousy etc."

Three design rules fall straight out of that, and they are the spine of
everything below:

1. **A circle is a group you are partly a stranger in.** The InBetween is not
   a friends list; it is a group that grows past what any one member knows.
   So any member can pass the invite on — spread is a feature, not a leak.
2. **The roster is known; the author never is.** You could see who was in the
   club — that is what made guessing possible. The circle screen names its
   members (first names); the dreams stay unattributed, exactly like the live
   feed's ✳ cards. **This resolves the open question at the bottom of
   `docs/dream-feed-designs/README.md`** — the artboard's "jonah ☾ night
   shift" byline is wrong for this app; the live feed's no-names rule wins,
   in circles most of all.
3. **The guessing is the game, and the app never resolves it for you.** In
   the notebooks nobody was ever told whose dream was whose. Any guess
   mechanic must be private, and a reveal only ever comes from the dreamer.

## "Friends OR a close circle of friends" = two circles, one mechanism

Sophie's ask names two middle audiences. They are not two hardcoded tiers —
they are two **named circles**: make one called "friends" and another called
"close circle" (or "night shift", "the inner room" — the name is hers). One
mechanism covers the club, the polycule, and both of her named cases, and you
can be in many circles at once.

## The mechanism

- **A circle** = a name + a roster + an invite code. Anyone can start one.
  Membership travels by **invite link** (`youwereinmydreams.com/c/<code>`) —
  the unguessable code IS the key, the fruit-poll pattern; no user directory,
  no friend requests, no approval queue. Any member may share the link
  onward. The creator can rotate the code (kills the old link) and remove a
  member; nothing about a circle is discoverable without its link.
- **The dial gains ☾**: `✳ everyone · ☾ <circle name> · ◦ just me`. In more
  than one circle, tapping ☾ again cycles them (the artboard's own microcopy:
  "tap ☾ again to switch circles"). In none, ☾ offers "start a circle". One
  audience per night, like all sharing — re-sharing the night switches it.
- **One feed.** Circle nights ride the same feed under the same day dividers,
  wearing the dark card (`.dcard.dark` already exists) with `☾ night shift`
  in the byline slot where ✳ sits today. Open, the card ends with "only
  night shift sees this." Everyone-cards and circle-cards interleave; a
  morning read is one scroll.
- **The guess.** On an open circle dream that isn't yours: *whose dream was
  this?* over the roster as small chips. One tap = your guess — **private,
  changeable, never shown to anyone**. The dreamer sees only a count ("3
  have guessed"). A **claim it** control on your own card reveals your name
  plus the tally ("3 of 5 found you") — per-dream, optional, forever
  optional. No auto-reveal, ever; an unclaimed dream stays unclaimed, which
  is exactly how the notebooks worked. Guesses are counts only even after a
  claim — who guessed what is never shown.
  - The guess row hides in a circle of two — a guess between two people is a
    formality — but sharing to a two-person circle works fine.
- **Comments keep names** (the app's one named place; "an unsigned reply is
  useless"). Commenting on your own circle dream can out you — that is the
  dreamer's choice, same as it was around the notebook.
- **Hearts** stay anonymous counts, unchanged.
- **The vault releases to a circle** — the artboard already shows "release to
  a circle ☾" on a private dream; the release is just a share with
  `audience:'circle'` later.

## Server shape (for the build phase — not built)

- `forge-dreamapp-circles`: one doc per circle
  `{ id, name, code, createdBy, members:[{uid, name, joinedAt}], createdAt }`.
  Rosters are small (a club is dozens, not thousands) — members ride the doc,
  one read per feed.
- Dream docs gain `circleId: string|null` — null + `publicOn` = everyone,
  set + `publicOn` = that circle. Stamped per-night by the share routes
  (`POST /nights/:id/share` gains `{ audience, circleId }`), like every other
  sharing fact.
- Routes: `POST /circles {name}` (creator joins), `POST /circles/join
  {code}`, `GET /circles` (mine, with rosters), `POST /circles/:id/leave`,
  `/rotate` + `/remove` (creator only). `/c/<code>` serves the app with the
  code in the path; after sign-in the client joins and lands in the feed.
- `/feed` keeps its one query and filters server-side: keep dreams where
  `!circleId || myCircleIds.has(circleId)`; a circled night carries
  `circle:{id,name}`. `readableDream` gains the same membership check —
  enforcement stays server-side like everything else in this module.
- Guesses: `forge-dreamapp-guess`, one doc per night+guesser
  (`<nightId>_<uid>`) `{ nightId, uid, guessUid, at }` — re-guessing updates
  in place. `POST /nights/:id/guess {uid}`; `POST /nights/:id/claim` (owner)
  sets `claimed:true` on the spine, after which the feed sends `name` and the
  tally.
- The share-to-see gate (off today): a circle share counts as shared —
  any audience except private opens the feed.
- Leaving a circle does not unpublish what you shared to it while you were in
  it — the dreamer's own per-night controls already withdraw anything,
  anytime.

## Open options, deliberately not in v1

- **"The handwriting."** In the notebooks, anonymous dreams still carried a
  recognizable hand — over weeks you learned a dreamer's texture without
  learning their name. The feed's `by` tag (stable, one-way) could render as
  a small stable anonymous mark per member within a circle, so "the same
  person keeps dreaming about teeth" is followable. It also erodes anonymity
  over time (correlate the mark with comments and absences), which is why it
  is an option for Sophie to call, not a default.
- Guess limits (one guess per dream vs. changeable until claimed — v1 says
  changeable), and whether a claim shows the tally to the whole circle or
  only the dreamer (v1: the whole circle — the reveal is a little event).
