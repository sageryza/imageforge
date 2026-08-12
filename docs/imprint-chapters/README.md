# The Imprint chapters artifacts

Two Compare pages built from this chat's own transcript, both driven by
`public/chapters.js` (the shared accordion + three-level engine).

- **`build-chapters.py`** → *The chapters* — all 28 chapters, both sides of
  the conversation at level 3.
- **`build-hers2.py`** → *The chapters, in your words* — the second
  variation Sophie asked for: level 3 is HER messages only, level 2
  summarises HER messages, and the going-wrong / deploy-chasing / procedural
  / pasted-from-another-chat messages are filtered out.

## The pieces

| file | what it holds |
|---|---|
| `chapters-data.py` | the spine: chapter start index, title, l1, l2, kind |
| `chapters-icons.py` | chapter number → pastel-sheet icon. **One copy**, read by both builders, so the two pages can never wear different drawings for the same chapter |
| `hers-data.py` | her messages, unioned from both transcript extractions, keyed to chapters by TIME |
| `hers-cuts.py` | which of her messages the variation leaves out, and why |
| `hers-summaries.py` | l1 + l2 bullets for the variation — summarising HER, never the work |
| `pastel-icons.json` | the 21 icons cut out of the pastel lesson sheet |

`raw-messages.json` / `raw-fresh.json` (the transcript extractions) are NOT
committed — this repo is public and they are the whole conversation.

## Rules that are load-bearing

- **Level 2 of the variation summarises her messages, not the work.** A
  summary of what got built is the other artifact again.
- **Nothing removed goes quiet.** Every filtered message is listed at the
  bottom of the page with its chapter and reason, so she can ask for any of
  them back by name. A chapter left with nothing kept is dropped from the
  spine and says so in that list.
- **`l2` is a LIST, not a paragraph** — `chapters.js` renders it as `<ul>`.
- **The two extractions are unioned, never swapped**, and chapters are
  matched by TIMESTAMP: the two passes number their messages differently, so
  an index-keyed match files her words under the wrong chapter.
- A new version is a NEW page; supersede the old one, never delete it.
