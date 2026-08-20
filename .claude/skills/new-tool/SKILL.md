---
name: new-tool
description: >
  The whole-tool checklist for adding a NEW TOOL to Deck Factory / ImageForge
  — the thing behind a tile: its server module, its page, its iOS wrapper, and
  the house rules the page must follow. Use this skill whenever Sophie asks
  for a new tool, room, tab or tile ("make a new tool in the image tab"), or
  when a tool that already shipped is being reworked. Start here, then go to
  new-module for the server half and new-page for the page half. It exists
  because a tool built by copying its neighbours inherits their mistakes: the
  newest one (/vector, Aug 2026) shipped with its title on screen twice,
  example text sitting in its boxes, and over-long buttons — all three copied
  faithfully from what was already there.
---

# Building a new tool in Deck Factory

A tool is THREE pieces, and each has its own reference:

- **The module** — `<thing>.js` at the repo root: an Express router, one
  `forge-<thing>` Firestore collection, background jobs, the STUDIO_TOKEN
  gate. → the **`new-module`** skill.
- **The page** — `public/<thing>.html`, served by `serveGated`. → the
  **`new-page`** skill (Tool pages section).
- **The tile** — a `Tool` case in `ios/ImageForge/RootView.swift` plus a
  wrapper view, so it opens from the home grid and from `deckfactory://<name>`.

Copying a sibling is right — the house patterns only exist as code. But copy
the CURRENT reference, and check the four rules below against the running
page before you hand it over, because a mistake in a neighbour gets copied
forward silently.

## The four page rules, checked on a real screen

These are Sophie's, she has asked for each more than once, and /vector broke
three of them on day one. Full versions in the `new-page` skill.

1. **The name appears ONCE.** In the app the native nav bar already carries
   the tool's name — the page must not say it again. Put
   `class="eyebrow tool-eyebrow"` on the page's own title and let
   `?embed=1` hide it (`GatedWebTool` appends the param itself; the server
   hides `.app-header` / `.tool-eyebrow` and sets `body.embed`).
2. **No instructions on the page** — the explanation lives behind the gold
   `?` circle (`#help` / `.helpcard` in tool.css; the Cutting Room is the
   pattern). Tap to show, tap anywhere to hide.
3. **Text boxes ship EMPTY** — no example text, not even a `placeholder`.
   An example she has to clear is work; put it in the `?` card instead.
4. **Buttons hug their words** — never full-width, never `flex:1`, no more
   padding than the text needs.

And the ones that come with the kit: link `public/tool.css` and set
`body class="tool"` (the step flow — only the OPEN step shows controls);
reserve the autoscroll pill's top-right corner (`padding-right:56px`) on the
header, the rail AND every step caption; `.btn.star` only on the ONE control
that spends money; `[hidden]{display:none !important}`.

## The iOS side

- **A new web tool ships with NO NATIVE BAR — the page draws its own header**
  (Aug 2026, Sophie: "get rid of the apple native bar"). Use
  `GatedWebTool(path:…, navTitle: "Name")`, which hides Apple's bar and injects
  `window.__forgeLeave()`; `public/pagehead.js` then draws the back chevron at
  the head of the page's own header row and walks **`__navBack` → web history →
  leave the tool**. A hand-rolled wrapper (one that needs media pausing — copy
  `EpisodeEditorView.swift`) uses `.forgeWebToolBar(title, failed: loadFailed,
  back: navBack)` and `ForgePageHeader.install(into:onLeave:)`.
  - **Do NOT use the plain `.forgeToolBar("Name")` on a web tool.** It paints
    a second title strip above a page that already has one, and its chevron
    lives in Swift — so every fix to how back behaves waits for a TestFlight
    build, which is how "it always goes back too far" stayed broken for weeks.
    `.forgeToolBar` is for NATIVE SwiftUI screens (Creations, Dump, Lessons),
    which have no page to draw a header.
  - **The failure screen keeps the bar** — with no page there is no header, so
    hiding it strands her on "Couldn't open …". `forgeWebToolBar` takes
    `failed:` as a required argument for exactly that reason.
  Only a page that replaces the WHOLE chrome (Chats, Story Room) gets a bare
  host. **A multi-level page should ALSO push a history state per level** —
  then the swipe-back gesture and the browser's back button step levels too
  (timeline.html's `storyUrl`/`popstate` block is the pattern).
- Register the `Tool` case: title, blurb, glyph, deep link, and which home
  FILTER it answers to (pictures / business / quilt / film). A custom glyph
  must fill 0.90 of its viewBox — run `python3 scripts/normalize-glyphs.py`.
- The tile ships in a TestFlight build (run `ImageForge TestFlight` in
  `memory-library-react`, `imageforge_ref` = your branch); the PAGE ships
  with a Render deploy, so page fixes reach her phone the same day.

## Before you call it done

- Its own **CLAUDE.md section**, written the way the siblings' are: what it
  is, what it costs, the gotchas, the routes, the test command.
- A **test script** (`scripts/test-<thing>*.js`) — export the pure functions;
  headless page tests treat playwright as optional and skip cleanly.
- Say the **cost** of anything paid, as a number, in the reply that ships it.
- Hand her the **live link** (`https://imageforge-q125.onrender.com/<page>`)
  and the PR link, both clickable.
