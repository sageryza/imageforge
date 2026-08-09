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

## At generation time (the unrecoverable steps)

1. **Permanent URL first.** Replicate/OpenAI URLs expire in ~1hr — upload to
   Firebase Storage (`saveToFirebase()` in server.js, or `bucket.upload()`)
   before filing anything.
2. **File the MODEL · QUALITY caption — this is the step chats forget.**
   `POST /api/gallery { assetsOnly:true, chat, url, prompt:"gpt-image-2 · medium", description }`
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
with NO label and NO caption, and they don't merge with your captioned tile
(different filename). After any reply that sent image files: sweep
`GET /api/gallery/assets?chat=<name>` for caption-less `claude-deliveries/*`
tiles and label + caption each (match to your originals by md5 of the bytes).
Avoid creating the problem: send ORIGINAL bytes, not re-encoded copies — a
converted copy (webp→png) defeats both dedupe layers.

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
