# Audit — "want me to fix that?" offers that were never answered (2026-08-24)

Sophie's ask: *"can you audit any chats that said 'want me to fix that for you' —
look for bugs that still exist that I never dealt with."*

## How it was measured (not reasoned)

Every chat's full thread was pulled from `GET /api/chatfeed/thread` — **498
chats, 10,218 messages**, i.e. the whole feed, not a search window. A regex over
Claude's messages only (`from !== 'sophie'`) found **350 offers to fix/patch/
redo something, across 178 chats**, then each was classified by what happened
next:

| what followed the offer | count |
|---|---|
| she said yes | 87 |
| she moved on to something else | 120 |
| no reply from her at all (chat carried on) | 121 |
| the offer was the chat's **last word** | 22 |

The bug-shaped ones (an offer naming something *broken*, not an offer to render
or spend) were then checked against the code **as it stands today**. Findings
below are split by that check, not by what the chat said at the time.

## STILL OPEN — confirmed in current code

### 1. The image lightbox reserves a notes strip even when there are no notes
*(chat `lightbox-image-size`, 2026-08-21 — the offer was the last message in the
chat; she never answered.)*

`hastalk` is added **unconditionally** whenever the note box is built —
`public/asset-lightbox.js:332` and `public/assets.html:454` — so a picture with
zero notes is still shrunk to leave room for an empty thread.

And the two copies of the same lightbox have drifted:

- `public/asset-lightbox.js:98` → `max-height:52vh`
- `public/assets.html:113` → `max-height:46vh`

The fix that chat proposed still applies: don't add `hastalk` when the thread is
empty (picture goes to ~62vh), and bring both copies to one number. Note
`assets.html` is the third, unmigrated copy of this lightbox — CLAUDE.md already
records that it drifts and that the real repair is an extras hook on the shared
file.

### 2. A backfilled chat's replies are all stamped "now"
*(chat `voice-memo-ideas`, 2026-08-15 — "that second one is a real bug that'll
bite every future backfill … want me to fix it there?" Never answered.)*

Half of this landed and half didn't:

- **Server side is done.** `POST /api/chatfeed` accepts `created` and its own
  comment names exactly this case ("every backfilled reply would pile up at the
  top").
- **Hook side never followed.** In `.claude/hooks/post-to-feed.sh`, *her*
  messages carry a real time (`mine["created"] = u['at']`, ~line 541), but the
  assistant turn payload (`out = {...}`, ~line 650) has **no `created` field at
  all** — and the turn record built in `flush()` (~line 409) never captures a
  timestamp in the first place.

So any chat recovered with `scripts/backfill-chat-history.sh --go` comes back
with her half in the right order and Claude's half piled at the moment of the
backfill. The fix is small: keep the assistant record's `timestamp` in `flush()`
and send it as `created`.

### 3. Nothing owns the gap above a tool page's header
*(chat `story-room-architecture`, 2026-08-23 — "Want me to fix these?", then her
"is there a reason it keeps happening", then the chat ended.)*

That chat measured all 39 gated tool pages: **the gap above the header runs
0 → 42px and no two pages agree**, and `/dump` sits at −4, where pagehead pulls
the chevron 4px left with no gutter to absorb it, so it hangs off the screen
edge.

Still true: `public/pagehead.js:66` sets the top for exactly one family
(`body.pagehead .tool .head`). Every other page's header spacing is its own
hand-written number. The `.sheethead` half is narrower — only the Story Room
uses it.

### 4. The Dump still can't take audio
*(chat `video-audio-extraction-pipeline`, 2026-08-11 — "Want me to fix that last
part?" Never answered.)*

`dropbox.js` accepts images and video only: `IMAGE_RE` (line 74) and the mime
map (lines 122-129) have no audio type. Audio off her phone goes to
`/api/audio` instead, so this is a gap rather than a crash — but Assembly's "Add
from the Dump" reads the Dump, so an audio file dropped there is still nowhere.

### 5. One stale doc line
*(chat `video-pin-chat-review`, 2026-08-19 — "Want me to fix that line while I'm
in there?" Never answered.)*

`docs/evan-film-collected.md` still names `evan-v13.mp4` as the film in its link
list (lines 193-210) while line 303 records `evan-v17.mp4` as the pinned current
cut.

## ALREADY FIXED SINCE — nothing to do

Each of these was offered and left, and a later chat closed it anyway. Verified
against current code, not assumed:

- **`scripts/test-playground-port.js` stale against the Dreamy rewrite**
  (`playground-priority-toggle`, `playground-search-bar`) — the test runs clean
  now.
- **The injected pill drawn black on every page but `/chunking`**
  (`clips-chunking-library`) — pill v3 reads the five tokens off the host's
  `:root`, so the fix is app-wide.
- **`vector.js` hanging on any sheet over five cells**
  (`vector-pipeline-polaroid`) — diagnosed as an OOM kill on the 512MB instance
  and fixed with an isolated child process in that same chat.
- **Tarot and sky bookmarks landing on the oldest saved reading**
  (`witch-app-saved-items-page`) — both pass `{ entry, newest }` to `openBook`
  now (`public/witch.html:3124`, `:3133`).
- **The hook's mid-turn gap** (`nde-precision-cutting-doc`) — the hook scans
  `queue-operation` enqueue records alongside `user` records.
- **Playground / My Creations display caps** (`missing-playground-images`) — she
  said yes at the time; both are paged.
- **Chats header controls colliding on a 390pt phone**
  (`daily-notifications-tab`) — the trash is an icon now.
- **Witch birth date/time fields reading blank** (`secretly-witch-ui-tweaks`) —
  they are labelled text fields with a calendar button, not native pickers with
  a washed-out placeholder.

## What this audit deliberately did not count

The great majority of the 350 offers are offers to **do work** — render a batch,
kick off a build, run a script, draw another variant. Those are not bugs, and
the ones from July are mostly about art that has long since been redrawn. Only
offers naming something *broken* were carried into the code check above.
