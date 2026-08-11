# Why an image can land in the wrong chat's Assets tab (Aug 2026)

Findings and options for the next chat that picks this up. Nothing here is
built yet — this is the investigation, not a fix.

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

**Honest caveat:** this depends on ordering. It would have caught the case
above (the panel was already labelled in `jonas` before the stray was filed),
but if a wip catch beats the deliberate filing, it won't. It is a strong net,
not a proof.

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
