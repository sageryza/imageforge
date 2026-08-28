---
name: deliver-images
description: >
  The house filing ritual for EVERY image deliverable in this repo — labels,
  gallery, the exact-prompt split, and the MODEL · QUALITY caption. Use this
  skill whenever generating images for Sophie, delivering images in a reply,
  sending image files, re-rolling art, or backfilling a chat's Assets tab —
  even for a single test image. The most-missed step is the quality/model
  caption, and it can never be backfilled by a later chat, so consult this
  BEFORE the generation run, not after.
---

# Delivering images — the filing ritual

Sophie reviews images in the iOS Assets tab and My Creations gallery, not in
chat. An image that isn't filed, labeled, and captioned is effectively lost to
her workflow. The full law lives in `CLAUDE.md` ("Deliverables → the in-app
gallery" + the Design rules on labels/prompts/captions); this is the working
checklist. Do these AT GENERATION TIME — several of them are unrecoverable
later.

## Before you generate — the prompt itself

- **Short, and action-only.** The content half says what HAPPENS; every
  adjective about how a thing looks is a decision taken away from the model
  and taken worse. ~300 characters of one situation is the target; past
  ~1,000 the model stops drawing one picture at all (measured).
- **Name the phenomenon, don't itemize it** (Sophie, Aug 2026): "meat raining
  from the ceiling", never "ribs, drumsticks, etc." A list is a checklist the
  model satisfies literally — each named object drawn separately and arranged
  so it can be seen — so an inventory comes back instead of the event. Test a
  word by swapping it for another of its kind: if "ribs" could be
  "drumsticks", ribs was never the idea.
- **A prompt SHE dictated goes verbatim.** This is how to write one when the
  writing is yours, and what to encourage when she asks for one — never a
  reason to trim her words. Anything you add is named word for word in the
  reply.
- Full rules: `docs/image-pipeline.md` (*DESCRIBE THE ACTION* · *WRITE IT
  SHORT* · *NAME THE PHENOMENON*).

## At generation time (the unrecoverable steps)

1. **Permanent URL first.** Replicate/OpenAI URLs expire in ~1hr — upload to
   Firebase Storage (`saveToFirebase()` in server.js, or `bucket.upload()`)
   before filing anything.
2. **File the MODEL · QUALITY · SIZE caption — this is the step chats forget.**
   `POST /api/gallery { assetsOnly:true, chat, url, prompt:"gpt-image-2 · medium · 2K", description }`
   The SIZE is a required third slot since Aug 2026 — gpt-image-2 draws any
   canvas, so model and quality alone no longer say what a picture is (one
   prompt at one quality spans 5x in pixels and 3x in price). **It is the TIER
   — 1K / 2K / 4K, not the pixels** ("i asked for it to say 1k 2k or 4k").
   Filing a creation as well? `post-to-gallery.js --size 1568x2352` takes the
   real canvas and writes the tier for the caption plus `canvas` beside it.
   **A panel CUT out of a sheet says `1/4 (4K)`, not its own tier** — a quarter
   of a 4K sheet is 1168x1752 and would otherwise read as an ordinary 1K
   picture. `size-tier.js`'s `cutSize(sheetCanvas, parts)` builds the slot, and
   `scripts/panel-sheet.js` prints the ready caption for every piece.
   — the asset doc's `prompt` field is the tile caption. Only the chat that
   generated an image ever knows its quality; a sweep of 171 chats found 1,938
   images with no caption and almost none recoverable. Never invent one for an
   image you didn't make — a confident wrong number is worse than blank.
3. **Post the EXACT prompt, split style/content:**
   `POST /api/gallery/assets/prompt { chat, url, style, content }` — the
   literal text sent to the model, character for character, NEVER a
   paraphrase. Style = trigger words/prefix/suffix/character lines as sent
   (mark the seam with `[content]`, note attached refs + size/quality);
   content = her subject verbatim. No exact text on hand → file nothing.
4. **Label every image.** The `description` is what she reviews by — a real
   scene description (`Penny — the blue Kleenex`), never `p01` or `image`.
   In reply prose, a Firebase image link's markdown text becomes the label —
   same rule.
5. **True timestamps.** Gallery posts carry the real generation time
   (`--created <ms>` on `scripts/post-to-gallery.js`) so concurrent chats
   sort correctly.

## In the reply that hands the images over

- **Say the quality as a word** — "medium, ~6¢ each" — never "the default" or
  "the usual settings". The caption is where she checks later; the reply is
  where she reads now. Both must carry it.
- **If you added ANYTHING to a prompt she gave** — style language, a quality
  hint, a ref preamble — name it word for word in the reply. A "plain" run
  contains only her words.
- **No image-link dumps** at the bottom of replies, and **no contact sheets**
  ever — she reviews labeled tiles one at a time. Mentioning an image inline
  in prose is fine.
- Deliverable files go LAST in the message, after all text.

## After sending files (SendUserFile)

The Stop hook auto-files sent images as `claude-deliveries/<random>` copies
with no label and no caption. **A byte-identical copy now merges onto your
captioned tile by itself** — the Assets tab joins on the Storage object's md5,
not just the filename (`asset-union.js`, Aug 2026), so there is nothing to
clean up afterwards.

What still bites: **a RE-ENCODED copy is different bytes**, so no hash can join
it and it lands as an unlabeled tile beside the original. Send ORIGINAL bytes,
not converted ones (webp→png for preview). If you genuinely had to convert,
sweep `GET /api/gallery/assets?chat=<name>` for caption-less
`claude-deliveries/*` tiles afterwards and label + caption each.

## Before you finish the turn — check your own filing

One command, read-only, no server writes:

```
node scripts/sweep-asset-captions.js --chat <your chat slug>
```

It pages your whole Assets tab and names every image short of a label, a
MODEL · QUALITY caption, a filed prompt, or sitting there as an unlabeled
`claude-deliveries/*` stray. Run it while you still remember the run — you
are the only chat that can honestly file what it finds.

## Re-rolls and batches

- A re-roll gets a **NEW id**; the old version STAYS in the gallery labeled
  "…v1 — superseded". Nothing is overwritten or deleted.
- EVERY image she asked for goes in — never withhold a batch to avoid
  "clutter"; she decides what's too much. Only genuine throwaways stay out.
- A set that belongs together (storyboard, options batch) can ALSO get a
  Compare page — but only when she asks or tiles genuinely can't do the job
  (see the `new-page` skill). Tiles are the default review surface.

## Housekeeping

- The hook auto-files images in finished replies — don't double-post plain
  gallery entries when the hook is present (`ls /home/user/.claude/hooks/post-to-feed.sh`);
  the `assetsOnly` caption/label/prompt POSTs above are always safe (they
  converge on the same record by url).
- When she next messages you, sweep her ♥/✕ votes, notes
  (`GET /api/gallery/assets/notes?chat=`), and reply ON the image
  (`POST /api/gallery/assets/note { chat, url, text, from:"chat" }`).
- **SWEEP THE NOTES AGAIN RIGHT BEFORE YOU REPORT DONE.** Her notes usually
  arrive AFTER the message announcing them — measured 2026-08-28, twelve
  minutes after, while the chat was working — and a chat that read once at the
  start delivered 135 pictures ignoring every ask she had left. "No notes yet"
  means NOT YET. A note on a FILM never shows in `GET /api/gallery/assets`
  either; only `/notes` sees it.
