# Why an image can land in the wrong chat's Assets tab (Aug 2026)

**BUILT 2026-08-14 — the server-side guard is live** (`asset-guard.js`, called
from `POST /api/gallery`'s `assetsOnly` branch in `server.js`). What follows is
the original investigation, then a "What shipped" section at the bottom with the
three rules as built, the measurement that reversed one of them, and the limits
that remain. Read the bottom first if you are here to change something.

**Symptom (Sophie spotted it, 2026-08-11).** The UPDATE tab showed the "Moon
milk experiments" card with three thumbnails, and the first one was a **Jonas**
panel — the toothy-cookie nightmare — sitting in a chat it has nothing to do
with. Her question was the right one: *is that a sign of a larger error?*

It wasn't. But it is a real, reproducible behaviour worth fixing.

## What actually happens

`.claude/hooks/post-to-feed.sh` scans a finished turn **twice**:

1. **The reply's prose** (`text = turns[-1]['text']`) — every Firebase image URL
   there is filed, and a markdown link's text becomes the asset's description.
2. **The turn's RAW records** (`blob = ''.join(raw_since)` — i.e. tool calls
   and their results). Any Firebase image URL found there that was *not* in the
   prose is filed as `{'wip': u}`, capped at 60 per turn.

Scan 2 is the one that misfires. It is deliberate and it is useful: it is the
safety net that stops an image a chat generated mid-turn from being lost when
the chat forgets to mention it. But it cannot tell the difference between

- an image this chat **made** (a real deliverable), and
- an image this chat merely **touched** — read, verified, tested, or copied a
  URL of while working on something else.

Both get filed, into whichever chat the session posts to.

**How to recognise one of these strays in the data:** it has **no
`description`**, and its caption reads `from <chat-slug>` — that is the hook's
own marker. Anything filed deliberately carries a real label. That single
signal is what separated "the hook did this" from "the backfill mis-filed
something" when this came up.

The one that prompted this doc:

```
url:     …/movies/panels/jonas_e04_teeth_low.png
prompt:  "from deck-factory-movies"      ← hook marker
created: 2026-08-11T22:04
```

A chat was doing Jonas asset work *from inside the Moon Milk chat*, so a Jonas
URL passed through its tool calls, and the wip scan filed it locally.

**This is NOT fixed in the current hook.** Verified 2026-08-11 by diffing the
wip region of the installed hook against the repo copy: byte-identical (the
only difference between those two versions was v12's working-fold telemetry).
Don't assume a newer hook already solved it — check the wip block.

## How common is it

Measured 2026-08-11 against `GET /api/gallery/assets/recent?limit=60`:

- **11 of the 60 most recent assets carried no label at all**, across three
  chats.

**Do not read that 11 as "11 mis-filings".** Unlabelled and wrong-chat are
different problems and the numbers are very different:

- **Unlabelled** is common (~18% of recent assets) and is usually a chat's own
  work-in-progress image, correctly captured by the net. Mildly untidy.
- **Wrong chat** is rare. It needs a chat to handle *another* chat's image URL,
  which mostly happens during cross-chat archaeology or repair work.

Anyone changing this should re-measure first rather than trusting these
numbers — see the MEASURE-never-reason rule at the top of `CLAUDE.md`.

## Options

### 1. Server-side guard (recommended)

One rule in `POST /api/gallery` (the `assetsOnly` branch, `server.js`):

> An **unlabelled** wip filing may not CREATE a new asset for a url that is
> already a **labelled** asset in a different chat.

Why this one is the good trade:

- The wip path is the only path that files without a description, so the rule
  reaches exactly the misfires and nothing else.
- If an image is already filed somewhere *with* a real label, it is someone's
  finished deliverable; a second unlabelled copy in another chat is never what
  anyone wanted.
- Deliberate deliveries (which carry a label) can still file into as many chats
  as they like — the "it can be in two places" case is untouched.
- Genuinely new images keep the whole safety net.

Cost: one extra `where('url','==',…)` query on `forge-chat-assets`, only on the
wip path (single-field index, no composite needed).

**Honest caveat 1 — ordering.** This depends on the deliberate filing landing
first. It would have caught the case above (the panel was already labelled in
`jonas` before the stray was filed), but if a wip catch beats the deliberate
filing, it won't. It is a strong net, not a proof.

**Honest caveat 2 — it does NOT catch derived urls, demonstrated live.**
Investigating the first stray meant printing its asset record, and that record
contains a `thumb` url (`…/thumbs/<sha1>.webp`). The hook filed **that** as a
second stray, in the same chat, minutes later:

```
stray: 597235f0e4c68229ced680a17e7749dae29ad0ee.webp | caption: from deck-factory-movies
```

Looking at the bug printed the bug back into the tab. The rule above would NOT
have stopped it, because a thumbnail is not a labelled asset in any other chat.

So pair it with a second, cheaper rule:

> Never wip-file a url under the server's own `thumbs/` prefix.

Those are derived display copies the server generates itself — they are never a
deliverable, so nothing is lost by refusing them outright. Any other
server-derived prefix (webp display copies, poster frames) deserves the same
treatment.

### 2. Client-side — narrow what the hook scans

Instead of scanning every URL anywhere in the turn's raw activity, scan only
**generation-shaped** activity: results from image endpoints
(`api.openai.com/v1/images`, `replicate.com`) and upload calls. Keeps the net
where it earns its keep, drops "URLs I merely read."

More precise at the source, but see the deployment note below.

### 3. Do nothing; sweep when it bothers her

It is one call, and the failure is cosmetic. See the recipe below.

## Why the server fix should come first

Not elegance — **propagation**. A hook lives in each session's container
snapshot: changing it needs Sophie to re-paste the setup script, and it only
reaches *new* sessions, so ~190 existing chats would keep the old behaviour
indefinitely. A server change deploys in minutes and fixes **every chat
retroactively, including ones on ancient hooks**.

So: do #1 first. Treat #2 as an optional later refinement, not the primary fix.

## Cleaning up strays that already exist

`POST /api/gallery/asset-cleanup` deletes `forge-chat-assets` caption records
for a chat, optionally filtered by a url substring. **It takes `dry` — use it**,
because a loose `urlContains` can match a whole chat's assets:

```
# what would go
{"chat":"deck-factory-movies","urlContains":"jonas_e04_teeth_low","dry":true}
  -> {"ok":true,"dry":true,"wouldDelete":1}
# then, only once the count is what you expect
{"chat":"deck-factory-movies","urlContains":"jonas_e04_teeth_low"}
  -> {"ok":true,"deleted":1}
```

It removes the caption record only — the image itself stays in Storage, and the
correctly-filed copy in its own chat is untouched.

---

# What shipped (2026-08-14)

Option 1 above, plus the thumbs rule — with one rule REVERSED by measurement
before it went in. The whole decision is `asset-guard.js`, a pure module the
route calls; `scripts/test-asset-guard.js` pins the table with fixtures and no
network.

## The door the rules stand at

The hook posts its two scans through two different doors, and only one of them
is judged:

- **scan 1, the reply's PROSE** — `{url, prompt, description?}`, **no**
  `assetsOnly`. Takes the full gallery path. A deliberate delivery; the guard
  never sees it.
- **scan 2, the RAW TOOL ACTIVITY** — `{'wip': u}` → `{url,
  prompt:"from <chat>", assetsOnly:true}`, no description. This is the door.

A filing at that door is a **background catch** only when it also carries no
description and no curated caption. A chat's own
`POST {assetsOnly:true, …, description}` comes through the same door and is
never touched — that is what keeps "it can be in two places" working.

## The three rules

1. **Labeled elsewhere → refused.** An unlabeled background catch may not
   CREATE a tile for a url already filed **with a label in a different chat**.
   One `where('url','==',…)` query, and — only when that finds no label — one
   `where('md5','==',…)`, which catches a renamed copy of a labeled deliverable
   and costs **no extra Storage read** (that md5 is read for the new doc
   anyway). Both single-field, so no composite index.
2. **Derived copy → refused.** `thumbs/` (server.js `thumbName`) and
   `drops/_thumb/` (`scripts/crystal-thumbs.js`). Server-made display copies,
   never anybody's deliverable. Deliberately narrow: `selfcare-thumbs`' copy is
   a filename SUFFIX and can't be a prefix rule, and `witch-school/webp/` was
   left out because those are also the pictures the page serves.
3. **A Dump photo → LABELED, never refused.** The catch files with a generated
   description naming its album — "Dump — Dinner party #3", "Dump — style
   references" — looked up in `forge-drops`. Both layouts are handled: today's
   content-addressed `drops/_/<md5>.<ext>` by its `hash`, and the
   pre-2026-07-28 `drops/<session>/<album>/…` by its `url` (8 of 8 sampled
   resolved live). No record found still files, as "Dump photo".

## Rule 3 was designed as a REFUSAL, and measuring it is what changed it

The design was the same shape as Rule 2: a chat cannot create a file under
`drops/`, so an unlabeled catch of one must be something it merely looked at.

The measurement (2026-08-14, all 4,229 `forge-chat-assets` docs) says
otherwise. **Every one of the 90 `drops/` records in the collection carries
`wip:true`, `prompt:"from <chat>"` and no label** — including the 18 in the
dinner-party chat, which Sophie says were pulled in DELIBERATELY for her to
review, in a chat with no Compare pages, reviewed in its Assets tab. Her
review-pull and a stray arrive as the same POST, through the same door, with
the same fields. Nothing server-side separates them, so the refusal would have
deleted a workflow she uses.

The problem was never that the photo was filed. It was that it tiled nameless.
So Rule 3 fixes that instead — and the tiles stop counting as unlabeled in the
sweep by themselves.

## What the guard would do to the data that already exists

Replayed over every background catch on file (2026-08-14, 759 of the 4,229
records are in that shape):

```
  523  filed   new              ← the safety net, untouched
  144  REFUSED labeled-elsewhere
   88  filed   dump-photo       ← now with a label; 82 get a real album/folder name
    4  REFUSED derived-copy
```

Nothing was rewritten: that is a simulation of what the rules would have done,
not a migration. Existing strays stay until the sweep or a cleanup call names
them.

## The sweep stopped asking library photos for things they never had

`scripts/sweep-asset-captions.js`'s `classifyAsset` no longer counts a missing
prompt or MODEL · QUALITY caption against a picture from one of her own source
libraries (`drops/`, `crystals/`, `ingest/` — the list is
`asset-guard.js`'s `SOURCE_LIBRARY_PREFIXES`, **one copy, two readers**). Nobody
typed words to make a phone photo and no model drew it, so telling a chat to go
and file them sent it after something that does not exist. A missing **label**
is still a finding for them.

## The limits that remain — do not read these as bugs to be surprised by

- **ORDERING.** Rule 1 needs the deliberate filing to land FIRST. If the
  background catch beats it, both records exist and the guard does not go back
  and remove the stray — collapsing identical bytes is `asset-union.js`'s job
  and naming the leftovers is the sweep's. Pinned as a test so the limit stays
  deliberate rather than accidental.
- **A RE-ENCODED copy** (a webp→png conversion for chat preview) is different
  bytes under a different name, so neither the url nor the md5 finds it. Still
  the one case a chat has to avoid by hand — send the original file.
- **`crystals/` and `ingest/`** get no auto-label: only the Dump has a record
  to read one from. They file exactly as before.

## Cleaning up strays that already exist

Unchanged — `POST /api/gallery/asset-cleanup`, `dry` first. See the recipe
above.
