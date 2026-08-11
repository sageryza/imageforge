---
name: new-page
description: >
  How to build ANY new web page served into Deck Factory / ImageForge — a
  Compare page posted via /api/chatfeed/page, a comparison sheet or options
  board, or a new tool page in public/. Use this skill EVERY time you create
  or substantially rework a page, even a "quick" one-off sheet: the recurring
  live bugs (autoscroll pill styled black or misplaced, taps on buttons
  restarting the scroll, dead pill play button, page script killed at parse
  time) all come from skipping the contracts below.
---

# Building a new page

Pick the TEMPLATE first (Aug 2026, Sophie: pages should be filled-in
templates — "less choices to make, but not no choices"), then read the pill
contract — it applies to everything.

- **Compare page** (`compare-shell.html`) — she LOOKS at things side by side
  (medium vs high, ref A vs ref B, v1 vs v2).
- **Judge page** (`judge-shell.html`) — she PICKS/CHOOSES across a set, one
  at a time, ♥/✕/maybe/later. Any "which ones do you like" job. A judge item
  can be a labeled pair, which covers compare-AND-choose (PDF page vs text).
- **Cut picker** (`picker-shell.html`) — she picks SPANS of a recording.
- **Tool page** — a new `public/*.html` served by a route (a new room/tool).

Two rules on every review page, both Sophie's, both asked for repeatedly:

- **MINIMAL TEXT.** The page is a VISUAL reference, not an extension of the
  chat — she had to ask for less text on page after page (the dice chat
  progression). Title, ONE line under it, labels on the pictures. No
  paragraphs, no explanations, no recap of the conversation.
- **Compared things sit SIDE BY SIDE, never stacked** so she scrolls between
  them. Use `.duo` (labels ON TOP — "medium" / "high") for every A-vs-B
  pair; `.imgrow` is only for plain sets that aren't versus.

## Compare pages: START FROM THE SHELL, and don't hand-roll ANYTHING

**Copy `public/compare-shell.html` and fill it in** — it links the two shared
halves and carries the rules as comments. Post with
`POST /api/chatfeed/page { chat, title, html }`.

- `/compare.css` = the one house look AND the `:root` tokens the pill needs.
  Do NOT hand-roll a fresh look per page or override the tokens. Skeleton
  blocks are documented at the top of that file.
- `/compare.js` = the one house behaviour: tap-pauses-autoscroll (pill
  exempt), the image lightbox (freezes the page, saves/restores scrollY), and
  `window.__compareNotes()`. A page that includes it has all three right by
  construction — never re-implement them.
- **Notes on everything reviewable** (Sophie's standing rule): mark each item
  `data-item="<id>"` and call `window.__compareNotes({ chat, sheet })` once
  the items are in the DOM. Votes go to `POST /api/chatfeed/verdict` (`ok`
  field); never to `/api/chatfeed/reply`.
  **The affordance is a SMALL + in the item's BOTTOM-right corner; an empty
  one costs no height and a written one SHOWS her words** (Aug 2026, Sophie:
  a note section on its own line "takes up too much space and makes it hard
  to see everything at once", then "put the plus for a note at the bottom not
  the top, and if I left a note, make it show"). The textarea appears only
  while she is writing. Never hand-roll a bigger note box, never leave a
  written note open as a textarea, and never put an empty one in flow.
  **Answer her on the note itself** — append `\n\n— Claude: …` to the same
  `text` field so the item holds the conversation ("otherwise I forget what
  we're talking about"), and she replies under your line.
- Images in **rows of two** (`.imgrow`), never one full-width per row.
  Mobile first; image URLs from Firebase Storage.
- **A VIDEO IS A LINE OF TEXT WITH A PLAY BUTTON, at the TOP — never an
  embedded `<video>`** (Aug 2026, Sophie: "never put a whole video when it's
  gonna be opened as a lightbox anyway, it should just be a line of text with
  a play button… so I don't just scroll through the whole thing"). A player
  parked at the top is a black slab she scrolls past on every visit, and
  tapping it goes fullscreen regardless — so the box bought nothing. One
  line: `window.__filmRow({ url, label, meta: '4:56', mount: '#film' })`,
  which opens the film over the page with the lightbox contract (autoscroll
  stopped, page locked, scroll position restored, video torn down on close).
  **The deliverable goes at the TOP of the page**, above whatever there is to
  decide — that is where she looks for it.
- **A new version is a NEW page** with the version in its title ("Short 1 v4 —
  tightest cut") pointing at NEW version-numbered media. DELETE + re-post is
  only for a typo on the same version. Never re-point an old page at new
  media — cached copies then play stale content.
- **Don't build one by default** — a routine options batch is reviewed as
  labeled Assets tiles. Build a page only when Sophie asks or the set
  genuinely can't be tiles.
- Test: `node scripts/test-compare-shell.js` (drives real taps against the
  real injected pill in headless Chromium; skips without one).

### Picking spans of a recording? Use the SHARED CUT PICKER — never hand-roll

If the page's job is "Sophie picks which parts of a long recording to keep"
(an audiobook passage, an interview, her own recording), **copy
`public/picker-shell.html`** instead and call `window.__cutPicker`
(`/picker.js`). Four chats each hand-rolled this in one week (Aug 2026) and
each re-shipped the same bugs; the shared picker is now the required surface.
It gives you word-tap span picking, a ▶ per pick that plays the exact span in
seconds (server-cut once via `GET /api/search/clip-span`), ▲▼ reorder +
per-pick notes + play-all, and live saving as one verdict field per pick
(a single JSON field truncates at 2000 chars ≈ 15 picks — that's why).
Read picks back: `GET /api/chatfeed/verdict?chat=&sheet=` → keys `<id>:p*`,
`{a, z, o, note}`, empty = removed. Cut the real audio with the precise
cutter (editor.js) — the ▶ clips are previews. Test:
`node scripts/test-cut-picker.js`.

## Judge pages: the ♥/✕/maybe/later template

**Copy `public/judge-shell.html`** — `/judge.js` does the whole surface: one
thing at a time, big, NO scrolling (her explicit spec), verdicts saved live
to the chat's verdict doc (♥ = `true`, ✕ = `false`, `'maybe'` and `'later'`
as their own piles — 'later' is "declined to sort now", grouped so she can
come back to all of them), resume on reopen, the piles view where any tile
re-opens for re-judging, undo, a note box per card, the "?" icon card.
Read her answers back with `GET /api/chatfeed/verdict?chat=&sheet=`.
Item shape: `{id, label, img}` or `{id, label, pair:[{img,label},{img,label}]}`.
Test: `node scripts/test-judge.js`.

## The autoscroll pill contract (BOTH page kinds — this is where pages break)

The pill is ONE shared implementation, `scripts/pill.py`, injected by the
server onto every served page and imported by every `gen-*.py`. **Never add
your own pill and never re-implement its script.** The contract:

1. **The five tokens or the pill renders BLACK on transparent.** The pill
   styles itself from the host page's `--ink` / `--paper` / `--chg` /
   `--ink2` / `--rose` `:root` variables. Linking `/compare.css` provides
   them; a page that genuinely can't link it MUST define those five itself.
2. **The top-right corner belongs to the pill** (`position:fixed`, roughly
   x 324–374, y 14–192 on an iPhone 13). Any header row needs
   `padding-right:56px`; never place a control in that corner — it will be
   untappable (the Chats rename pencil was, for real).
3. **Wrap the page's own script in an IIFE.** The injected pill runs in
   global scope declaring `var raf`, `var I`, `var playing`, … — a page-level
   `let raf` / `const I` kills the pill's script AT PARSE TIME (symptom:
   empty stretched buttons, no scrolling). Expose only `window.__navBack`
   etc.
4. **Any tap pauses the autoscroll — but the pill itself is EXEMPT.**
   `/compare.js` does this for you. If a page can't load it, the handler must
   skip `.float` (capture phase, `pointerdown`): an unconditional
   `__scrollStop()` repaints the pill mid-press and EATS the click, making
   the pill's own play button dead (found live on Cut Marks).
5. **The exempt list is SHARED — never hand-roll one, and always pass the
   event.** `pill.py` owns `PILL_SKIP`
   (`a,button,summary,details,input,textarea,select,label,video,audio,[onclick]`)
   via `window.__scrollTap(e)` and `window.__pillInteractive(el)`.
   `__scrollTap()` with NO argument exempts NOTHING — that's how a copy
   button once both copied and started the scroll. Pages may ADD exemptions
   (`pre`/`code`, a notes box); the shared list is the floor.
6. **Opening an image freezes the page behind it**: pause autoscroll, lock
   scroll (`overflow:hidden`), save `window.scrollY` on open and
   `scrollTo(0, savedY)` on close — locking alone does not stop
   `window.scrollBy`. `/compare.js`'s lightbox does all of it.
7. Editing `pill.py` itself? Re-run `python3 scripts/gen-pill-inject.py`
   after, and know the pill defends its glyphs against host `svg` globals
   (`svg{fill:none}` once hollowed its play triangle).
8. **In the APP the page runs EMBEDDED, and that is a second pill** (Aug
   2026 — Sophie caught this on the judge demo). chats.html opens a Compare
   page in an IFRAME with `?embed=1` (no injected pill) and its own parent
   pill drives the iframe, with a tap-to-TOGGLE gesture bound inside your
   document. The parent forwards `__scrollStop` into the iframe (so
   compare.js's handlers work there) and exempts the interactive skip list
   plus `img`/`figure`/`.cmp-lb` (a tap on a picture or the lightbox never
   starts the scroll). If your page's ordinary content is tappable — a word
   picker, a judge card — mark that region `data-nostop`: its taps still
   PAUSE a running scroll but never start one. Testing only the standalone
   page misses all of this; `scripts/test-page-embed.js` covers the
   embedded path.

## Tool pages (a new room in public/)

- Serve via `serveGated` — it sends `Cache-Control: no-cache, must-revalidate`
  (without it the iOS WKWebView serves stale cached copies; this shipped a
  broken page for real) and honors `?embed=1` (hides `.app-header` when
  hosted inside a native tool — pass it on every new `GatedWebTool` path).
- Use the shared kits: `public/tool.css` for step-flow tool pages
  (`studio.html` is the reference), the shared header pieces for page-owned
  headers (Chats is the reference look). Don't hand-roll per-page variants.
- **iOS wrapper: a NEW web tool ships with the native bar + chevron** — copy
  `EpisodeEditorView.swift` (forgeToolBar, chevron asks `window.__navBack`
  first, `__nativeNavBar` injected so the page hides its own back button via
  `body.native`, media paused on screen change). Only a page replacing the
  whole chrome (Chats, Writing Room) earns a bare WKWebView host.
- Icon-first tool → add the gold "?" circle that explains the icons (Cutting
  Room's `#help`/`#helpcard` is the pattern).
- CSS gotcha: any page that toggles the `hidden` attribute needs
  `[hidden]{display:none !important}` — `[hidden]` loses to any author
  `display` rule.
- Everything slow is a **background job** the page polls and resumes from
  `localStorage` — never a blocking spinner. Opening a page must never spend
  money (model calls are a deliberate tap, `.btn.star`).

## House style (every page)

- **NO gradients**, ever. Flat solid colors.
- **No pill-shaped buttons** — rounded rectangles, `border-radius:6px`
  (circular icon buttons are the exception).
- Lucide line icons inlined (stroke `currentColor`, width ~1.8), never emoji
  for controls. Anything that spends a model call wears the shared star
  glyph.
- Serve **webp display copies**, never raw generated PNGs (~1MB each; webp is
  ~22× smaller — `scripts/webp-assets.js` + the verify gate).
- Full clickable links in the reply when it's ready to test: the page URL and
  the PR.
