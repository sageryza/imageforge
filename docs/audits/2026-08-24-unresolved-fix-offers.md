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

## FIXED 2026-08-24 — everything below except #3

Sophie read the audit and said: *"I think I gave the third bug to a different
chat. Can you check if all the other bugs are still there and fix them?"* Each
was re-verified against `main` as it stood that afternoon (which had moved 22
commits since the audit) and then fixed. **#3, the header gap, is another
chat's** and was deliberately left alone.

One thing had already half-fixed itself in those 22 commits: `/assets` was
migrated onto the shared `asset-lightbox.js`, so the 52vh/46vh DRIFT in #1 is
gone. The other half of #1 — the reserved strip — was still there.

## THE FIVE — what each one was, and what happened to it

Each finding below opens with the bug as the audit found it (confirmed in the
code at the time) and closes with what was done about it.

### 1. The image lightbox reserved a notes strip even when there were no notes
*(chat `lightbox-image-size`, 2026-08-21 — the offer was the last message in the
chat; she never answered.)*

`hastalk` is added **unconditionally** whenever the note box is built —
`public/asset-lightbox.js:332` and `public/assets.html:454` — so a picture with
zero notes is still shrunk to leave room for an empty thread.

And the two copies of the same lightbox have drifted:

- `public/asset-lightbox.js:98` → `max-height:52vh`
- `public/assets.html:113` → `max-height:46vh`

**FIXED.** `hasmsgs` is written by `paintThread` from the thread it actually
drew: an image with no notes keeps 62vh (56 with an actions row), and the room
is given up the moment her first letter lands — live, without reopening. The
DRIFT half fixed itself in the meantime: `/assets` was migrated onto the shared
file, so there is no second copy left to disagree.
Test: `node scripts/test-asset-lightbox.js` — the same picture measured taller
with an empty thread than with letters in it, then shrinking on her first note.

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
backfill.

**FIXED — hook v15.** `flush()` keeps the turn's first assistant-record
timestamp and the post carries it as `created`. The turn's START rather than its
end, deliberately: the server documents `bornAt` as the turn's start so that a
turn ALREADY RUNNING when she sends a message loses the push gate's comparison.
Live turns are unchanged — the server keeps a doc's FIRST `created`, which a
draft has already stamped. `public/setup.sh` and the docs copy are rebuilt from
the hook, so a re-paste of the environment's Setup script carries it.
Test: `node scripts/test-chat-backfill.js` — verified failing 2 against the
pre-fix hook.

**It reaches a session only when its hook is re-installed** (the self-heal, or a
re-paste of the Setup script). Nothing to do now: it matters at the moment a
silent chat is recovered, which is always a deliberate act.

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

**LEFT ALONE ON PURPOSE — Sophie gave this one to another chat** (2026-08-24).
It is the only finding here that is not fixed.

### 4. The Dump couldn't take audio
*(chat `video-audio-extraction-pipeline`, 2026-08-11 — "Want me to fix that last
part?" Never answered.)*

`dropbox.js` accepted images and video only: `IMAGE_RE` and the mime map had no
audio type.

**FIXED.** The machinery was always generic — content-addressed bytes, md5
dedupe, albums, folders — so only three type tables and the `media` field said
images and video. A dumped recording now lands as `media:'audio'` and plays from
its own tile on `/dump`; a zip full of recordings is accepted the same way.

Three things worth knowing:
- **An `.m4a` is `audio/mp4`.** A table that asks about the CONTAINER before the
  KIND files every voice recording as a video, with a poster job and a ▶ on its
  tile. `extFor` asks about audio first, and the test pins it.
- **`mediaKind(ct)` is the ONE answer** to "what kind of thing is this", so the
  doc's `media` and any caller asking the same question cannot disagree.
- **Every reader written before audio asks `=== 'video'` and calls the rest an
  image.** Assembly's "Add from the Dump" now SKIPS audio (an assembly item is a
  clip or a still; the Film Editor is the surface with an audio track), and both
  page uploaders already accept `image/*,video/*` only. `crystals.js` still
  counts a non-video as a photo — left alone, because nothing puts audio in a
  crystals album, but it is the next place this would show.
- **It does NOT go to the voice-memo archive.** `/api/audio` transcribes
  everything it receives; the Dump's rule is dump first, label afterwards.

Test: `node scripts/test-dump-audio.js` (pure).

### 5. One stale doc line
*(chat `video-pin-chat-review`, 2026-08-19 — "Want me to fix that line while I'm
in there?" Never answered.)*

`docs/evan-film-collected.md` named `evan-v13.mp4` as the newest film in its
link list while the same file recorded `evan-v17.mp4` as the pinned current cut.

**FIXED.** The link list points at v17 (confirmed live: v17 answers 200, v18
does not exist). Every OTHER mention of v13 in that file is history — what was
rendered when — and was left exactly as written.

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
