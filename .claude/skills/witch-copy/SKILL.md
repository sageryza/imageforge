---
name: witch-copy
description: >
  Voice rules for ANY words Sophie's readers see — Witch School lessons, blog
  posts, Etsy/product listing copy, Secretly a Witch app text, spells,
  horoscopes, tarot readings, the tarot email, newsletter copy, self-care
  sticker lessons. Use this skill whenever writing OR editing reader-facing
  copy in this repo, even when the request never mentions voice or style —
  "add a card", "write a listing", "draft a post" all count. Not for code
  comments, commit messages, or replies to Sophie herself.
---

# Witch copy — the house voice

Readers must not be able to tell the text is AI-written, and the school must
never talk down to them. Two documents are the source of truth — this skill is
the checklist, they are the law:

- `docs/witch-school-lessons.md` → **Voice rules** section (read it before
  writing lesson cards; it has worked examples of every rule below).
- `CLAUDE.md` → **"No Claude-isms in public-facing copy"** under Design rules.

## The stance underneath everything: aspirational, not consoling

Never lower the bar to comfort the reader — "X is plenty", "a tea towel
counts", "can come later, or never" all read as "we don't expect much from
you." Frame the small act as the FIRST RUNG and name the higher rungs ("your
first potion — the Apothecary lesson teaches the real blends from there").
Rewording a consolation is not fixing it; change the stance so the text points
upward. Exception: genuine safety guidance (poison path, shadow-work therapist
notes) is craft safety, never coddling — keep it.

## Banned phrasings (all of them, every surface)

- Mic-drop closers: "That's the whole practice." / "That's it." / "Done.
  That's the ritual."
- The negation-pivot reframe of a feeling or practice: "X isn't Y — it's Z" /
  "You're not X-ing; you're Y-ing." (Plain factual contrasts are fine.)
- Therapy-speak verbs on feelings: "name it", "sit with it", "notice what
  comes up", "hold space", "let it land".
- Permission-granting: "you're allowed to", "give yourself permission".
- "Here's the thing", "that's not nothing", "quietly does a lot of work".
- The profound-simplicity pronouncement: "X IS the answer", "the real secret
  is…", "X is the practice; everything else is furniture", and its fragment
  forms ("Unsettlingly good." / "That's a spell by any name.").
- False-easy reassurance: "just tap", "it's that simple", "it's right there" —
  reads condescending. Show the small concrete step and let it BE easy.

Instead: say the content plainly — a concrete instruction, a real fact, or a
specific image beats an aphorism. End on the action or the detail, never a
pronouncement about it. Two escape hatches that keep warmth without the
sermon: ATTRIBUTE the insight to the tradition ("the old folk say…"), and let
images do the charm rather than verdicts about the images.

## Witch-app-specific rules (from the lessons doc — apply to any witchy copy)

- **Never adjudicate the craft against science.** State what the laboratory
  measures, state what the craft claims, let them stand side by side ("a
  laboratory reads that as identity; a witch reads it as contact"). The tell
  is any clause whose job is to say which one is *real*. Discernment content
  (telling a strong sign from a weak one) is the craft's own tool and stays.
- **The app is never the evidence** for its own subject — open from the
  reader's own experience, not "the front door of this app says so".
- **A craft instruction starts with the INTENTION** — name what the working is
  for, give two or three concrete examples, then the physical steps.
- **Researched, not generic** — 1–2 web searches per piece, real names and
  dates (Culpeper 1652, Epidaurus temple sleep). Specificity is the charm.
  Be historically honest.

## Which model writes it (when building/altering generation code)

Reader-facing words run on **Claude** via `anthropic.js` (`chat`/`chatJSON`,
default `claude-sonnet-5`) or `server.js`'s `anthropicChat` — never
`gpt-4o-mini` (mini is only for bulk mechanical extraction). One deliberate
exception: the Book of Miracles stays on mini, Sophie's explicit call. Full
map in CLAUDE.md → "Which model writes it".

## Before shipping

Sweep the draft against the banned list above, and check the MEANING layer
(consolation, verdicts on the craft) — those survive wording changes. The 16
live Witch School lessons were swept three times; new copy ships clean.
