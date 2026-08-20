# Dream app commercials — the survey, the shelf, and how posting works

Built 2026-08-20 for the new dream Instagram (`you...my.dreams`), from a scan
of **all 9,342 messages in `forge-chat-feed`** plus a sweep of every
`commercials/` prefix in Storage. Sophie's ask: *"survey what commercials
we've come up with in every chat … and everything I personally said about
them behind a question button and put them all into a compare Tinder page
thingy."*

Nothing here is derived from memory — every quote on a card is her own words,
lifted verbatim from the feed with its date, and every film in the room was
found by listing Storage rather than by reading a chat's claim about it.

## Where it all is

Four surfaces, all in the `dream-app-commercials` chat's **Compare tab**:

- **Dream app commercials — every idea we came up with** — 17 concepts, her
  own words behind each card's `?`.
- **Dream app commercials — the ChatGPT ideas** — the 11 from her pasted
  thread. She has said nothing about these yet, so their `?` is plain;
  ChatGPT's own note on a pitch rides the caption line, labelled as ChatGPT's.
- **The dream commercials room — v2, the current cuts** — every film and every
  still.
- **How the grid will look — v3, always the current cut** — the Instagram
  profile grid, and every tile opens its film full-screen the way a real grid does
  (Sophie: *"what if the instagram play buttons actually worked and opened
  lightbox"*). Somnivex has no film, so its tile opens the storyboard frame —
  no tile on the grid is a dead control. Both lightboxes come from
  `compare.js`, so the overlay contract (autoscroll stopped, page locked,
  scroll position restored, video torn down on close) is right by
  construction, and a tile is a `<button>`, which the pill's own skip list
  already exempts — a tap that plays a film can never also start the page
  scrolling. Test: `node scripts/test-dream-grid.js`.

Scripts that built them: `scripts/dream-commercials/`. `decks.js` holds the
deck data (the quotes live there), `room.js` and `grid.js` build and post
their pages, and `stills.json` / `extra.json` / `boys.json` / `covers.json`
are the derived display copies' URLs.

## The films that exist (measured, not remembered)

**Dream app — six commercials, thirteen cuts.**

| what | newest cut | earlier |
| --- | --- | --- |
| The boys — before / after | `dream-commercial/commercial-v2.mp4` 0:44 | v1 |
| Every night (sad piano) | `commercials/reels/everydream3/…v1.mp4` 0:59 | v2, v1 |
| The bird costume | `commercials/reels/birdcostume/…v1.mp4` 0:41 | — |
| The bird, as a story | `commercials/reels/birdstory/…v2.mp4` 0:41 | v1 |
| Rêverie | `commercials/reels/reverie3/…v1.mp4` 0:27 | v2, v1 |
| The song spot | `dream-commercial/spot-v4.mp4` 0:13 | v3, v2, v1 |

**Storyboarded, never shot:** Somnivex® — six frames, gpt-image-2 · medium,
in `fictional-pill-commercial-01h7qx`.

**Two films nobody in this workspace has mentioned:** `birdstory` v1 and v2,
and `everydream3`, are in Storage but appear in no chat message and in no
`index.json` entry. They were rendered on the other account. Worth knowing
before anyone concludes a cut doesn't exist.

**Not the dream app**, same production run: seven pill TV spots (IDEATROL,
DOOMSCROLLEX, REPLYVA, CANCELLIA, HOBBYSTATIN, TABZOLAM, THRESHOLDYN) and
five reels (Xi, two Secretly a Witch, two Memory Library). All on the room
page's bottom block.

## Two things that keep these pages honest by themselves

**A posted page is frozen HTML**, so it shows the cut that existed the day it
was built — and these films are re-cut daily in other chats. Measured
2026-08-20: the grid pointed at the song spot v4 (0:13) while that chat had
pinned v8 (0:28). Both pages now ask `GET /api/chatfeed/newest` on every open,
which DERIVES the current cut rather than asking chats to file one: the making
chat's **pin** when it points inside that film's own prefix, else the newest
video Storage holds under it. The prefix guard is the load-bearing half — a
chat that makes several films can only pin one, and its pin must never be
served as a different film. Each tile/row names its own `prefix` and `chat` in
`scripts/dream-commercials/`; a failed resolve leaves the built-in url. The
covers are still the older cut's frames, so a moved film says so in rust and
names the new cut rather than showing a duration that belongs to a film no
longer playing. Test: `node scripts/test-newest-film.js`.

**Tap-to-note works on every film here**, not just a pinned one — the mechanism
Sophie designed on the Evan film lived only inside `chats.html`'s pinned player
until Aug 2026. It is `public/filmnote.js` now, shared with `compare.js`'s
video lightbox, so any film row or playable tile on any Compare page has it.
A note lands on the film's own url thread **in the chat that makes that film**,
so it reaches the chat that can act on it.

## The reels are the WRONG SHAPE for Instagram

Measured with ffprobe: **every reel is 480x720 — 2:3.** Instagram Reels wants
**1080x1920 — 9:16**, so as they stand each one letterboxes in the player and
throws away roughly a fifth of the screen. `dream-commercial/*` (the boys, the
song spot) are already 1170x2532, which is 9:16 and correct.

The profile GRID crops a reel cover to **3:4**, which is what the grid mockup
shows — so the crop on that page is the crop she gets.

Fixing the 2:3 reels is a re-render at a taller canvas in
`scripts/ideatrol-commercial/make_reel.py`, not a re-generation: the stills
are already drawn and paid for.

## Posting and scheduling — what is actually possible (Aug 2026)

**A new account is no obstacle.** Nothing about the Content Publishing API is
tied to account age; it is tied to account TYPE and to a Meta app.

**Three routes, in increasing order of work:**

1. **Instagram's own scheduler, in the app.** Since March 2026 any **public**
   account can schedule natively — no Business switch needed, though a private
   account cannot schedule at all. Up to 25 posts a day, 75 days ahead. Zero
   engineering. This is the right answer for a first campaign.
2. **Meta Business Suite**, free, desktop — the same scheduling from a
   computer, and it plans Facebook alongside. Desktop-only, so it goes on the
   desktop queue if it is ever wanted.
3. **The Graph API, from our own server.** Needs: an Instagram **Business**
   account (Creator accounts are NOT supported for content publishing — a
   common trap), linked to a Facebook Page, a Meta developer app, and
   `instagram_business_basic` + `instagram_business_content_publish` approved
   through App Review — **2-4 weeks**. Publishing is two calls (create a media
   container at `/{ig-user-id}/media`, then `/{ig-user-id}/media_publish`),
   with a polling step in between because video processing is not instant.
   Limits: 25 published posts per rolling 24h, 50 unpublished containers, 200
   API calls/hour.

**The API cannot schedule.** `media_publish` fires immediately — there is no
`scheduled_publish_time` for Instagram the way there is for Facebook Pages. A
"schedule" through the API means storing a time on our side and firing the
publish then, i.e. a cron plus a queue. That is a real (small) tool, and it is
only worth building once the volume is past what the native scheduler handles.

## The one thing that cannot be recovered later

Quality captions and exact prompts on the stills. The stills on the room page
are **derived display copies** (2-3MB PNGs and 1.5MB webps down to ~900px
webp) — the originals are untouched where they were made, and each still's
model/quality/prompt stays filed against the ORIGINAL in the chat that drew
it, never against the copy.
