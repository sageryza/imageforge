# Surgeon's hand / tool flat lay — Pastel, square

Sophie asked (2026-08-15) for "a surgeon's hand picking up a particular tool
from a flat lay of tools that the nurse probably laid out", in the Pastel
variant style, square.

`gen-pastel-square.js` is the Playground's **Pastel** recipe run at
**1024x1024** instead of its fixed 2:3 — same two Storage style refs
(`witch-school/refs/sophie-snake.png`, `witch-school/refs/sophie-animals.png`),
same prefix and suffix as `PL_GPT_STYLES.pastel` in `server.js`, same
flood-fill whiten pass. Run it from the repo root (needs `node_modules`,
`OPENAI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`):

    node illustration-lab/surgeon-tool-flatlay/gen-pastel-square.js "<content prompt>" out.webp

## v1 — `surgeon-tool-flatlay-v1.webp`

gpt-image-2 · medium · 1024x1024 · ~6¢ · 51s.
https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/promptlab/1786830973730-lbq8gd.webp

Content half of the prompt, exactly as sent:

> A surgeon's gloved hand reaching down from the top of the frame and lifting
> one particular instrument out of a neat flat lay of surgical tools — scalpel,
> forceps, scissors, clamps, retractor — arranged in a tidy row on a
> cloth-covered tray, seen from directly overhead.

## v2 — `surgeon-tool-flatlay-v2-weird.webp`

Same recipe, but the tools are invented rather than real — Sophie's follow-up
ask. gpt-image-2 · medium · 1024x1024 · ~6¢ · 57s.
https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/promptlab/1786831135356-rco38r.webp

Content half of the prompt, exactly as sent:

> A surgeon's gloved hand reaching down from the top of the frame and lifting
> one particular instrument out of a neat flat lay of invented, absurd surgical
> tools arranged in a tidy row on a cloth-covered tray, seen from directly
> overhead. None of them are real surgical instruments — they are silly
> inventions with odd features: a tiny butterfly net on a scalpel handle, a
> bubble wand puffing out a little burst of confetti, forceps that end in a
> small grabbing hand, a clamp topped with a spinning windmill, a corkscrew
> with a bell on it, a long spoon with a curly spiral tail, a pair of scissors
> whose blades are tiny leaves.
