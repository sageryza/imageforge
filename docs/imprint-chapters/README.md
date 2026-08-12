# The Imprint chapters artifacts

Two Compare pages built from this chat's own transcript, both driven by
`public/chapters.js` (the shared accordion + three-level engine).

- **`build-chapters.py`** → *The chapters* — all 28 chapters, both sides of
  the conversation at level 3.
- **`build-hers2.py`** → *The chapters, in your words* — the second
  variation: level 3 is HER messages only, level 2 summarises HER messages,
  and the going-wrong / deploy-chasing / procedural / pasted-from-another-chat
  messages are filtered out. 116 of 165.
- **`build-hers3.py`** → *Just the describing* — the third cut, "literally
  just me describing things": only the messages whose MODE is description.
  Questions, direction, rules, corrections and option-picking all go, even
  where hers2 kept them. 38 of 165, 15 chapters of 29.

## The pieces

| file | what it holds |
|---|---|
| `chapters-data.py` | the spine: chapter start index, title, l1, l2, kind |
| `chapters-icons.py` | chapter number → pastel-sheet icon. **One copy**, read by both builders, so the two pages can never wear different drawings for the same chapter |
| `hers-data.py` | her messages, unioned from both transcript extractions, keyed to chapters by TIME |
| `hers-cuts.py` | which of her messages hers2 leaves out, and why |
| `hers-describing.py` | hers3's explicit KEEP list + its own summaries — a keep list, not a cut list, because at that depth the kept ones are the minority and naming the cuts would be a wall |
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
- A new version is a NEW page; supersede the old one, never delete it. Each
  deeper cut points at the one above it, so nothing removed is unreachable.
- **A CHROME change is not a new version.** The level bar, the numbers and
  the note + all live in `public/chapters.js`, which every posted page loads
  at runtime — changing it reaches all three artifacts with no repost, and
  posting a duplicate page just to record the change would clutter the
  Compare tab that superseding exists to keep clean.

## The recopy (v7) — every lesson in her own words

`copy-batch1a/1b/2a/2b/3.py` hold the 20 recopied lessons (the coffee,
`coffee-copy.py`, was already hers). Sources: her Substack essays, the Read
People booklet PDF, and her chat dictations. The marking contract lives in
`coffee-copy.py`'s docstring — `[[..]]` = my words (rendered red + starred),
unmarked = hers verbatim; a card with no her-words on record keeps its old
copy wrapped WHOLE in `[[..]]` (all-red = still all me). Each lesson sits on
the chapter where it was born (`COPY` in `build-chapters.py`); a chapter
carrying several lessons separates them with heading cards (kicker
"the lesson"). This is the review copy ONLY — the real lesson decks change
only after Sophie approves it.
