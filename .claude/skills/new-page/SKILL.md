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

Two page kinds, one shared hazard (the autoscroll pill). Decide which you're
building, then read the pill contract — it applies to both.

- **Compare page** — reviewable HTML posted to the app's Compare tab.
- **Tool page** — a new `public/*.html` served by a route (a new room/tool).

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
- Images in **rows of two** (`.imgrow`), never one full-width per row.
  Mobile first; image URLs from Firebase Storage.
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
