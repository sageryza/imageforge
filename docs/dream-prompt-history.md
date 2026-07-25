# Dream pipeline — prompt history & compare

The living record of the prompts that drive the dream→comic pipeline, so we can
review and iterate on them. The prompts themselves live in `movies.js`
(`dreamSplit`, `dreamPaginate`, `renderDreamPageV2`); this file tracks **what
they say and how they've changed**. Update this whenever a prompt changes.

Model: `DREAM_BREAKDOWN_MODEL` (default `gpt-5.6-sol`; a `claude-*` id routes via
Anthropic). Split runs at `DREAM_SPLIT_EFFORT` (default `none`); paginate at
`low`.

---

## Stage 1 — Split (`dreamSplit`)  ·  fast, free
Only splits the recording into distinct dreams and lists who's in each (with any
description the dreamer gave). **No chronology, no beats, no image prompts** —
kept minimal so the character sheet comes up fast.

Current system prompt:
> Someone tells you their real dream recording. A single recording is often
> SEVERAL separate dreams told in one breath. Do ONLY two things: split it into
> the distinct dreams, and note who appears in each. Do NOT reorder anything, do
> NOT flag chronology, do NOT describe images or break dreams into scenes.
> `{"dreams":[{"title", "text" (verbatim, narrated order), "mentions":[{"name","desc" (only what the dreamer said about their looks, else "")}]}]}`
> Rules: split at boundary cues; keep dreams in narrated order (do NOT reorder);
> `text` verbatim; `mentions` deduped; `desc` only the dreamer's own words.

**History**
- v1: split + true-chronology ordering + `driftCues` (out-of-order phrases) + plain-string mentions.
- v2: dropped all chronology from this call (moved to render); mentions became `{name, desc}` to preload descriptions.
- v3 (current): mentions gained `named` — true for actual names/family titles ("Miriam", "Dad", "me"), false for generic references ("some guy", "that woman"). Named people get card rows in the UI; generic ones go to the tap-to-describe list.

---

## Stage 2 — Paginate + captions (`dreamPaginate`)  ·  after character pick
Decides how many images the dream needs, allots the words per image, and writes
the captions. This is the **caption prompt** we're tuning.

**History**
- v1 (beats era): the old breakdown wrote per-beat captions, packed 4 beats to a fixed 2×2 page.
- v2 "sparse": one `caption` per page, **≤12 words**, dreamer's voice but heavily filler-trimmed, lettered as EXACTLY one box. → came out with almost no text on the page.
- v3 "lenient" (current): **1–3 short caption boxes** per page, each a snippet of the dreamer's *actual* words (lightly de-fil, present tense). Faithful to the dreamer's voice — NOT rewritten darker/haunting to match the art (the drawing carries the mood; the words carry the dreamer). Page count still lean (1–4, merge moments).

See `movies.js:dreamPaginate` for the exact current text.

---

## Stage 3 — Render a page (`renderDreamPageV2`)  ·  paid, gpt-image-2 edits
Draws each page: style ref first, then that slot's approved characters (image
refs or text descriptions), then up to 3 earlier drawn pages for continuity,
plus the whole dream as context and "THIS page covers only this part." The model
decides the layout (one drawing or a few panels — no fixed 2×2) and hand-letters
the caption box(es).

**Style-ref content leak (open issue):** the style reference has a girl in it,
and for a *described* (image-less) character the model sometimes borrows her
face. Mitigations TBD.

See `movies.js:renderDreamPageV2` for the exact current text.
