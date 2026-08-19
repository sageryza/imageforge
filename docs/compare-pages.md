# Pages you post into the app — Compare, judge, picker

The shells and contracts for anything a chat publishes into the Chats app as a page: `compare-shell.html` and the shared `/compare.css` + `/compare.js`, the judge page ("Tinder style"), and the cut picker for choosing spans of a recording.

**The `new-page` skill is the short version and loads itself when you build a page — read it first.** This is the full contract, including the bugs each rule exists to prevent (a pill styled black, taps restarting the autoscroll, a dead play button, a page script killed at parse time, verdicts silently re-pointed at different content).

*(Moved out of `CLAUDE.md` Aug 2026 — see the pointers there. Nothing was rewritten; this is the text as it stood.)*

- **Compare pages (July 2026) — publish comparison artifacts INTO the app, not
  as claude.ai artifacts.** When Sophie asks for a comparison sheet, options
  board, side-by-side, or any custom viewing page, POST it to
  `POST /api/chatfeed/page` with `{ "chat": "<your-chat-name>", "title": "…",
  "html": "<the full self-contained page>" }` (x-studio-token when gated;
  ~10MB body cap). It appears in your chat's **Compare** tab (Chat · Assets ·
  Compare) and opens full-screen in the app — that's where she'll look for it,
  next to your assets. Lay the content out however the comparison needs (mobile
  first, self-contained; image URLs from Firebase Storage are fine). The server
  auto-appends the shared autoscroll pill to every served page — do NOT add
  your own scroll pill.
  **START FROM THE SHELL — `public/compare-shell.html` (Aug 2026, Sophie's
  ask: "a shell every chat can use for their compare page that has the auto
  scroll pill with everything exempt").** Copy that file and fill it in; it
  links the two shared halves and carries the rules below as comments, so a
  new page gets them without anyone remembering them:
  - **`/compare.css`** — the one house look AND the `:root` tokens the
    injected pill styles itself from.
  - **`/compare.js`** — the one house BEHAVIOUR, in a single script tag:
    any tap pauses the autoscroll **with the pill itself exempt** (an
    unconditional handler eats the click on the pill's own play button) and
    `[data-nostop]` as an opt-out; plus an image lightbox that stops the
    scroll, locks the page, and restores the exact scroll position on close.
    Do NOT hand-roll these handlers per page anymore — a page that includes
    `/compare.js` has them right by construction. Tests:
    `node scripts/test-compare-shell.js` (drives real taps against the real
    injected pill in headless Chromium; skips if no Chromium).
  **THE POST ANSWERS `warnings` WHEN A PAGE SKIPS THE KIT (Aug 2026).**
  `POST /page` inspects the HTML and returns `warnings:[…]` — no `/compare.js`,
  no `/compare.css` and not all five tokens, an embedded `<video>` — alongside
  the usual `ok`/`id`/`url` (also stored as `kitWarnings` on the page doc). It
  NEVER blocks the post. **If your post comes back with a warning, fix the page
  and re-post it before you finish the turn** — that is the whole point of
  telling the chat that can still fix it. Tests:
  `node scripts/test-page-kit-warnings.js`.
  **ONE STYLE for every Compare page (Aug 2026, Sophie: "every artifact is
  styled differently — there should be one style").** Start every new page
  from the shared stylesheet: `<link rel="stylesheet" href="/compare.css">`
  (same-origin — served pages can link it; the skeleton is documented at the
  top of `public/compare.css`: `.wrap` > `.eyebrow`/`h1`/`.sub`, then
  `.card`/`.big`/`.chips`/`.imgrow` blocks). Do NOT hand-roll a fresh look
  per page, and do NOT override the `:root` tokens. **The tokens are also
  what fixes the pill:** the injected pill styles itself with the host page's
  `--ink`/`--paper`/`--chg`/`--ink2`/`--rose` variables, so a page that
  defines none of them renders the pill BLACK on transparent (this is why
  every hand-rolled page's pill looked broken — Sophie caught it). If a page
  genuinely can't link the stylesheet, it MUST at least define those five
  `:root` tokens.
  **ANY tap pauses the autoscroll (Aug 2026, Sophie's rule — every Compare
  page MUST have this).** While she's interacting with a page — voting,
  typing a name, tapping anything at all — the page must not keep creeping
  underneath her. Add this to every Compare page's script (capture phase, so
  it fires even when the tap lands on a button or form field) — and it MUST
  skip taps on the pill itself: `__scrollStop` repaints the pill's glyphs,
  and swapping the tapped element out mid-press EATS the click, so an
  unconditional version makes the pill's own play button dead (found live on
  Cut Marks, fixed on the Cutting Room too):
  `document.addEventListener('pointerdown', function(e){ var t=e.target; if(t&&t.closest&&t.closest('.float')) return; if(window.__scrollStop) window.__scrollStop(); }, true);`
  **Including `/compare.js` does exactly this for you** — that snippet is now
  only for a page that genuinely cannot load the shared script.
  This is on top of the existing image-lightbox rule below — opening an
  image still locks background scroll too.
  **The tap gesture's exempt list is SHARED — never hand-roll one, and always
  PASS THE EVENT (Aug 2026, Sophie: this "comes up a lot").** `pill.py` owns
  `PILL_SKIP` (`a,button,summary,details,input,textarea,select,label,video,
  audio,[onclick]`) and exposes it two ways: `window.__scrollTap(e)` applies
  it for you, and `window.__pillInteractive(el)` answers it for a page's own
  handler. **`__scrollTap()` called with no argument exempts NOTHING** — that
  is exactly how a code block's COPY button in the Chats app both copied AND
  started the autoscroll (Sophie caught it; the copy handler's own
  `stopPropagation` is a document-level listener, so it runs after the page's
  tap handler and can't help). A page may ADD its own exemptions on top
  (chats: `pre`/`code`, so selecting text in a code block isn't a tap;
  writing: `.notebox`), but the shared list is the floor. This is why a
  Compare page with a copy button, a vote chip or a text field must route
  through the shared helper rather than reinventing the skip list.
  **IN THE APP the page runs EMBEDDED, and that is a SECOND pill (Aug 2026 —
  Sophie caught it on the judge demo; the standalone tests were all green).**
  chats.html opens a Compare page in an IFRAME with `?embed=1` (no injected
  pill) and its own parent pill drives the iframe, with a tap-to-TOGGLE
  gesture bound inside the page's document. That gesture used to start the
  autoscroll from taps on IMAGES (while the lightbox opened over it) and on
  the lightbox backdrop. Now: the parent forwards `__scrollStop` into the
  iframe (per-gesture memory so a pause isn't re-toggled by its own click),
  exempts `img`/`figure`/`.cmp-lb` as pause-only, and honours
  `[data-nostop]`; `.duo img` joined the lightbox selector. A page whose
  ordinary content is tappable (a judge card, a word picker) marks that
  region `data-nostop`. Tests: `node scripts/test-page-embed.js` (drives the
  REAL chats.html viewer end to end) — testing only the standalone page
  misses this entire path.
  **AN EXTERNAL LINK ON AN EMBEDDED PAGE MUST LEAVE THE IFRAME (Aug 2026,
  Sophie: an "Open the chat" link "just took me back to the compare page").**
  A plain `<a href="https://claude.ai/…">` navigates the IFRAME, and
  claude.ai sends `x-frame-options: SAMEORIGIN` (measured 2026-08-10), so the
  load is refused and the tap reads as bouncing back. `/compare.js` now opens
  any OFF-ORIGIN http(s) link from the TOP document with `target="_blank"` —
  the same thing the Chats app's own Open button does — so it never navigates
  the web view away from the app; same-origin and `#anchor` links are left
  alone, and a standalone page is untouched. **A page gets this for free by
  linking `/compare.js`, including pages posted BEFORE the fix** (they load
  it at runtime, so no repost — which matters, since a repost would throw
  away verdicts she had already saved).
  **A page served with the injected pill must SCOPE its own script (IIFE).**
  The pill snippet runs in global scope and declares `var raf`, `var I`,
  `var playing`, … — a page-level `let raf`/`const I` collides and kills the
  pill's script at PARSE time (empty stretched buttons, no scrolling —
  Sophie hit this on Cut Marks). Wrap the page script in `(function(){ …
  })()` and expose only `window.__navBack` etc. List your
  pages with `GET /api/chatfeed/pages?chat=<name>`; replace by DELETE
  `/api/chatfeed/page/:id` + re-post. Only fall back to a claude.ai artifact if
  the page genuinely can't work as plain HTML.
  **New VERSION of a deliverable = a NEW page, never an edit of the old one
  (Aug 2026, Sophie's rule — earned the hard way).** Deleting-and-reposting a
  page when the work changes made her lose track of what she was looking at,
  and re-pointing an old page at new media (or worse, overwriting the media
  file at the same URL — a cached copy then silently plays STALE content)
  made "which version is this?" unanswerable. So: every new cut/render/version
  gets a NEW page whose TITLE states the version and what it is ("Short 1 v4 —
  tightest cut"), pointing at NEW version-numbered media files; the old pages
  and files stay as history. DELETE+re-post is only for fixing a typo on the
  SAME version.
  **CURRENT / SUPERSEDED tabs on the Compare list (Aug 2026, Sophie: "the
  drafts that have changed can still exist, but not crowd the current area").**
  A page doc carries `superseded`; `POST /api/chatfeed/page/:id/supersede
  {superseded}` flips it, and `GET /pages` returns it. The Compare panel then
  shows the account tabs' exact pattern (`.acctabs` — no boxes, two half-width
  labels over a hairline with a sliding underline) and the tabs **only appear
  once something is superseded**, so a chat with three pages still looks like
  three pages. Every row carries a small ↓ / ↺ so she can move one across
  herself.
  **The row is `.acctabs.cmptabs`; `data-on` is the plain SLOT INDEX (0 =
  Superseded, 1 = Current), like every other row. It carries NO width — see
  "THE HAIRLINE ROWS' SLIDING LINE MEASURES ITS TAB" under Design rules,
  which is where this bug was closed for good.**
  **A chat posting a new version should supersede the one it
  replaces** — that is what keeps eleven drafts of one tool out of her way
  WITHOUT deleting the history.
  **Every row (both tabs) also carries a BOOKMARK** that sends the page to
  the Bookmarks view's **ARTIFACTS** tab, alongside her kept chats and
  messages — see "THE KEEP-PILE IS THREE TABS" above. One more reason never
  to delete a superseded page: she may have kept it.
  **THE REFERENCE SHELF — a comparison whose answer stays true is SAVED, and
  every chat reads the shelf before rebuilding one (Aug 2026, Sophie: "we
  should save compare pages if they're comparing things that often need to be
  re-referenced — for example the different qualities of images like high,
  medium and low, or the different styles").**
  - **Posting one:** `POST /page { …, reference:true, topic:"image quality" }`,
    or after the fact `POST /page/:id/reference { reference, topic }`. The
    topic is the QUESTION it answers, plain and reusable — `image quality`,
    `styles`, `lora scale`, `sheet grid` — never the page's own title; it is
    what groups the shelf. Lower-cased and trimmed server-side, 40 chars.
  - **READ IT BEFORE YOU BUILD ONE: `GET /api/chatfeed/references[?topic=]`**
    → every reference page across every chat, newest first, with the url that
    opens it, plus `topics`. If the comparison she is asking for is already on
    the shelf, hand her that link instead of spending her money and her
    attention re-rendering it. This is the half that pays for the feature.
  - **It is the CHATS' flag, `bookmarked` is HERS** — the same split as
    `starred` vs `bookmarked` on a chat. A reference page shows in the
    Bookmarks pile's **ARTIFACTS** tab with no keep-tap from her (the tab
    heads two piles, REFERENCE over KEPT, and only when both exist); its row
    wears its topic and a small **↓** that takes it off the shelf. Nothing
    ever takes one off by itself.
  - **What earns a place:** a comparison that will be asked again — quality
    ladders, style sets, LoRA scale rungs, grid/cell sizes. NOT a one-off
    decision ("which cut", "old tracer vs new", a settled voice A/B). When in
    doubt leave it off; she can't be asked to prune a shelf.
  - Twelve existing pages were seeded 2026-08-14 by
    `node scripts/mark-reference-pages.js` (`--dry-run` first, idempotent) —
    scattered across eight chats, and only 4 of the 333 pages on file had ever
    been bookmarked, which is why her own keep-tap was never going to gather
    them. Tests: `node scripts/test-chats-references.js`.
  **THE SURVEY, 2026-08-14 — all 336 pages read, and what it settles.** Sophie
  asked for "a comprehensive survey of compare pages… to see if we can pull
  anything out that is actually serving as a good compare page". The seed above
  had been built from TITLES; this pass pulled the whole `forge-chat-pages`
  collection, shortlisted every comparison-shaped title (57), and OPENED each
  one — structure read, every image and audio URL HEAD-checked. The numbers,
  so nobody re-counts them:
  - **336 pages across 66 chats. 112 are superseded** (33%) — version churn is
    the collection's dominant shape, not comparison: `cutting-blocks-artifact`
    is 15 drafts of one tool, `evan-story-visual-summary` 20, and
    `deck-factory-story-room`'s 58 are mostly one page per lesson.
  - **Only ~20 pages actually compare like-for-like variants of one thing**,
    and about half of those answer a question that recurs. The rest of the 336
    are deliverables, prototypes, running orders and pick-one boards — good
    pages, but each one finished when its question was answered.
  - **Nothing is rotting: every media URL checked answered 200.** An old page
    is still a working page, so age is not a reason to leave one off.
  - **A TITLE IS NOT EVIDENCE — open the page before shelving it.** One of the
    twelve seeded entries did not survive being opened: "Playground v4 —
    Watercolor + Hoonie styles" is a MOCKUP of the Playground screen (its `h1`
    is "Playground", it has a Generate button) with **zero images on it**.
    Nothing is compared. It is off the shelf, and it is why the script now
    carries a `DROP` list beside its `WANT` list.
  - **Eight pages no title-scan could rank were added**, because what makes
    them reusable is inside them — the reference sheet with every style ref
    beside what it feeds, the drawing-vs-photo scale/wording pair, our tracer
    measured against the off-the-shelf ones, the three-clones-by-every-setting
    voice grid, 352 prompts each beside the picture it made, and the same hero
    square vs landscape. The shelf grew 12 → 19, across 9 topics.
  - **The gap the survey found: nothing compared ONE prompt across the house
    styles.** Every style page on file tests a single reference (the scan, the
    pastel pair) against itself, so "what do sage sandy mirror / dream mystery
    / pastel do to the same picture" had no page. `compare-page-style-variants`
    shipped "Three styles, one prompt — low (v1)" the same day and it is now
    on the shelf. Still missing, if anyone wants them: the **seven Replicate
    LoRA styles** on one subject (only `public/samples/*.webp` exists, and
    those are tiles, not a comparison), and an aspect-ratio set beyond the
    blog heroes.
  **THE DAY-AFTER PASS, 2026-08-15 — the survey re-dispatched, and what one
  day changed.** The same survey message reached a second chat 24 hours later
  (`compare-pages-survey-013hav`); instead of re-reading everything it measured
  the delta: **374 pages across 74 chats** (+38 pages, +8 chats in a day),
  **137 superseded (37%)** — the churn rate is holding, ~36 new pages a day.
  - **The failure mode the first pass could not have seen: the shelf collects
    superseded drafts.** A chat ships v2 of a reference page, flags it,
    supersedes v1 — and v1 keeps its own flag, so within a day of the shelf
    shipping, **5 of its 28 entries were stale drafts sitting beside their
    replacements** (the ARTIFACTS tab has no superseded filter; the pile shows
    whatever carries the flag). **The rule: superseding a reference-flagged
    page MOVES the flag** — `POST /page/:id/reference {reference:false}` on
    the old page in the same breath as flagging its replacement.
  - The five were unflagged 2026-08-15; the **audio pipeline map (v3)** joined
    the image pipeline's pages under `pipelines` (the maps are the same kind
    of standing page, and a hole beside its sibling is inconsistency, not
    doubt); the fruit chart's quality ladder stayed OFF — a sixth quality page
    answers nothing five didn't, and when in doubt the shelf stays small.
    Shelf after the pass: **24 pages, 10 topics, none superseded**.
  - The survey's two gaps were closed later the same day — see the second
    survey below.
  **THE SECOND SURVEY, 2026-08-15 — an independent pass, by structure instead
  of titles, and what it adds.** Sophie asked for the survey redone from
  scratch (same chat, deliberately ignoring the first pass). Method: pull all
  374 HTML files and classify every page by what its markup actually is —
  no title shortlist. The verdicts converged with the shelf almost everywhere,
  which is now two independent reads agreeing; the differences and the new
  facts:
  - **The census: about half the "Compare" tab has no pictures at all.** 374
    pages → 73 with images laid side-by-side, 22 more multi-image, 59
    film/animation, 9 audio, 6 judge, 3 picker — and ~174 (47%) with no
    images: to-do lists, tool prototypes, path/status pages, transcripts,
    lesson texts. Roughly 35 pages genuinely compare like-for-like variants;
    ~25 answer recurring questions, and that set is the shelf.
  - **A STATIC IMG COUNT IS NOT EVIDENCE EITHER — 25 pages inject their
    pictures by script.** "Blog Heroes — Square vs Landscape" has ZERO
    `<img>` tags and 76 pictures (38 square/landscape pairs in a JS data
    array). Opening a page means reading its script too, or a real
    comparison gets dropped the same way the Playground mockup almost got
    kept.
  - **Recurrence, measured:** quality ladders were built independently by 6
    different chats (7+ pages), style tests by 4 — including two ladders
    built AFTER the shelf shipped, so chats are not reading the shelf before
    building. The recurrence is also the proof of which questions recur.
  - **Topic canon discipline:** `image quality` now holds 5 ladders. A topic
    is a question — a new page joins it only by answering something the
    existing ones don't (a style-specific ladder qualifies; a sixth generic
    one doesn't — the fruit chart's ladder stayed off on exactly this).
  - Flag changes from this pass: **"Vectors against their sources — four
    palettes"** added under `vector tracing` (same subjects in four palettes,
    vector beside source; palette is a live choice, `/recolor` exists), and
    the sundress same-seed flag MOVED v1 → v2 (duplicates removed — the
    strictly better copy of the same rows). Shelf: 25 pages / 10 topics,
    none superseded.
  - **Media health, re-verified independently: 915 of 915 real media URLs
    across the shelf + comparison roster answer 200.** Zero gradient
    violations on any of the 374 pages. `kitWarnings` is only stamped since
    Aug 14 (#1174) — an empty field on an older page means unscanned, not
    clean.
  - **ALL THREE GAPS CLOSED, 2026-08-15, same chat** (Sophie: look for the
    material first, "finish off the isolated variables" where it doesn't
    exist). One subject for everything — the styles sheet's exact "chain came
    off" content line — so the families read across each other:
    - **"Seven LoRA styles, one prompt (v1)"** — all seven `MODELS.replicate`
      styles through the server's own route (triggers + suffixes exact),
      shelved under `styles`.
    - **"One prompt, three shapes — low (v1)"** — gpt-image-2, prompt
      verbatim, square/portrait/landscape, shelved under `image size`.
    - **"One still, two animation tiers — wan vs kling (v1)"** — the Movies
      tool's draft (wan-2.2-i2v-fast) and standard (kling-v2.1) tiers on the
      DNA unzip card with one motion prompt, shelved under `animation` (a new
      topic). The EXISTING DNA clips could not anchor this — the clip library
      records no model or prompt for swept clips, so an honest isolated set
      had to be fresh (~41¢). Whole batch ≈ 65¢.
  **A VERDICT SHEET NAME MUST CARRY THE VERSION OF WHAT IT ANSWERS (Aug 2026,
  earned on the Evan cutting blocks).** Verdicts are keyed by an item id, and a
  rebuilt page usually renumbers its items — so re-posting a page under the SAME
  `sheet` silently re-points her answers at different content: `b05` in an
  82-block split became a different sentence in the 96-block split, and four of
  her cuts landed on lines she had never marked. Nothing errors; the page just
  quietly shows her the wrong state. Put the item set's shape in the name
  (`blocks-s96`, not `blocks-v8`), and when a rebuild changes the items,
  MIGRATE rather than making her redo it — map old ids to new by TIME OVERLAP
  or text, write the migrated state into the new sheet, and say what moved.
  **And do not delete the superseded page.** A new version is a new page and the
  old one is the history (see above); deleting it throws away the only record of
  what she was looking at when she gave a note.
  **SHE MUST BE ABLE TO ADD A NOTE — everywhere it could apply (Aug 2026,
  Sophie's standing rule: "that should be a standing rule generally whenever
  applicable").** A vote answers yes/no; a note is where she says WHY, or what
  to change, and it has to sit next to the thing itself. So **anything
  reviewable gets a note box**: every item on a Compare page, and by extension
  any new surface where she judges things (the Assets lightbox and the Writing
  Room already work this way — match them). Do NOT ship a page whose only
  input is a pair of vote buttons.
  - **It is one line, because `/compare.js` owns it.** Mark each item
    `data-item="<id>"` and call
    `window.__compareNotes({ chat, sheet })` after the items are in the DOM.
    That builds the note affordance per item, prefills whatever she
    wrote before, saves as she types (debounced), and flushes on blur and on
    `pagehide` so a half-typed note can't be lost by navigating away. Never
    hand-roll a note box per page.
  - **THE AFFORDANCE IS A SMALL + IN THE ITEM'S BOTTOM-RIGHT CORNER, AND AN
    EMPTY ONE COSTS NO HEIGHT (Aug 2026, Sophie: it "takes up too much space
    and makes it hard to see everything at once", then "put the plus for a
    note at the bottom not the top, and if I left a note, make it show").**
    v1 was a "+ note" text button on its own line under every item, and a
    written note then stayed OPEN IN A TEXTAREA — so a page of twenty items
    paid twenty rows whether or not she had written anything. Three states,
    each load-bearing: **nothing written** → just the + (absolute, zero
    height); **she wrote one** → HER WORDS SHOW quietly under the item;
    **writing** → the textarea, folding back to her words on blur. So height
    is spent only on notes that exist. Don't put an empty one back in flow,
    don't open a written one into a textarea just to display it, and don't
    hand-roll a bigger one on a new page — it lives in `/compare.js` +
    `/compare.css`, so every page (including ones posted before this) gets it
    at runtime.
  - **ANSWER HER ON THE NOTE ITSELF, AND IT RENDERS AS A THREAD (Aug 2026,
    Sophie: "respond to my notes on the note itself so I can respond there
    also — otherwise I forget what we're talking about", then, having used
    it: "I don't know why I'm responding inside of your message. That's
    strange").** A note is a conversation, not a comment box she files into
    the void — but v1 handed her the whole field in one textarea, so
    answering meant typing inside the chat's paragraph.
    - **The field is a list of MESSAGES, one per line-start marker: `— me:`
      and `— Claude:`.** Read the sheet (`GET /verdict` → `texts`), append
      `\n\n— Claude: <short answer>` and POST the whole field back. Text
      before the first marker is hers, so every note written before this
      still reads correctly.
    - **Her box is always EMPTY and only ever APPENDS.** `/compare.js` keeps
      the stored field separate from the draft; never repopulate the
      textarea with the thread (a second blur then appends it to itself).
    - **More than one message FOLDS to the newest**, behind a small
      "N earlier" (her ask: "also collapse the messages anyway"), so a long
      back-and-forth can't bury the list. Hers and the chat's carry
      different coloured rules and a tiny ME / CLAUDE label.
    - Keep answers short (the field caps at 2000 chars) and don't re-answer
      a note that already carries your line.
  - **Votes and notes are SEPARATE FIELDS on the same verdict doc** — `ok`
    for the vote, `text` for the note — so writing one never clears the other
    (that is why the route has both). Read them back together with
    `GET /api/chatfeed/verdict?chat=&sheet=` → `{ items, texts }`.
  - **Read the notes when she next messages you**, in the same sweep as asset
    votes/notes, and act on them.
  **A page must NEVER post to `/api/chatfeed/reply`** (Aug 2026, Sophie's
  rule): notes she types on a Compare page are not chat messages and must stay
  on the page — use `POST /api/chatfeed/verdict { chat, sheet, item, text }`.
  The server enforces it: a /reply fired from inside a served page is rerouted
  onto the page's verdict doc (sheet `page-<id>`; read it back with
  `GET /api/chatfeed/verdict?chat=&sheet=page-<id>`), never into the thread.
  **Don't reach for a Compare page by default (Aug 2026, Sophie).** A routine
  options batch / small test set does NOT need one — the labeled Assets tiles
  are the review surface. Build a page only when Sophie asks for one or the
  set genuinely can't be reviewed as tiles. And when you DO build one, lay the
  images out in **rows of TWO**, never one full-width image per row.
  **THE TITLE, AND NOTHING ELSE AT THE TOP (Aug 2026, Sophie: "get rid of
  the gold top part of the top and just make it the name… everything but the
  title, including the tagline and the top thing with the date or
  whatever").** A Compare page opens with its `<h1>` and goes straight into
  the thing. **No `.eyebrow`** (the gold CHAT NAME · DATE line — she already
  knows which chat she is in and when she asked for it) and **no `.sub`**
  tagline. Both classes stay in `compare.css` for older pages; a NEW page
  simply does not use them, and `compare-shell.html` no longer has them.
  **The rule kept coming back because THE TEMPLATES TAUGHT THE OPPOSITE
  (fixed Aug 2026):** `judge-shell.html` and `picker-shell.html` both opened
  with an eyebrow + tagline, and compare.css's own skeleton comment listed
  them — so a chat starting from the right file still copied the wrong shape.
  All three are corrected, and `POST /page` now answers a `warning` naming
  the eyebrow / the tagline.
  **ANYTHING TO READ GOES BEHIND A "?" — never down the top of the page (Aug
  2026, Sophie: "every chat seems to include a long list of instructions… if
  they do want to put instructions they can put it behind a ? so I can tap it
  if I don't know what's going on. That's a much better idea").** One line:
  `window.__compareHelp({ html: '…' })` in `/compare.js` — the circle rides
  at the end of the title (the pill owns the top-right corner), the card is
  `position:fixed` so it can't push the page down under her finger, and any
  tap closes it. A judge page passes `help:` to `__judge`; a tool page uses
  tool.css's `#help`. Most pages need none at all.
  **AND IT COVERS AN EXPLANATION SHE ASKED FOR — that is the one that keeps
  getting through (Aug 2026).** The two-panel gallery shipped with two
  paragraphs above the first row because she had said "at the top explain
  briefly the idea behind this concept", and every written copy of this rule
  said *no INSTRUCTIONS*: a premise, a finding or a summary is not an
  instruction, so the paragraph read as exempt and her own words read as
  overriding the rule. Neither is true. **The "?" card IS the top of the
  page** — "explain it at the top" is an ask for the card. The rule is about
  the SHAPE of the top of the page, never the genre of the text. Her asking
  for an explanation changes what the card SAYS, not where it lives.
  **`POST /page` enforces it now**, because three copies of the words did
  not: more than 180 characters of `<p>` before the first picture comes back
  as a warning naming `__compareHelp`. It only fires on a page that HAS
  pictures — a transcript or a read-through is not what the rule is about —
  and only counts prose before the first one, so per-item captions and the
  folds under a row are untouched. Tests:
  `node scripts/test-page-kit-warnings.js`.
  **TEXT BOXES SHIP EMPTY, and BUTTONS HUG THEIR WORDS (Aug 2026, Sophie).**
  No example text in a box, not even a `placeholder` ("I prefer nothing") —
  it belongs in the `?` card if anywhere. And "there's no reason to make
  buttons longer than they need to be to hold the text": compare.css's
  `button,.btn` is `inline-flex; width:auto`, never a full-width slab.
  `POST /page` warns about a `placeholder=` too.
  **PREFER NOT SCROLLING, AND WHEN THERE ARE TWO KINDS OF THING USE THE
  HAIRLINE TABS (Aug 2026, Sophie's standing rule).** A page she has to
  scroll to reach the controls is a page where the thing and the controls are
  never on screen together. So: fit what she is looking at on ONE screen, and
  when a page carries two different kinds of thing — a picture and its
  inputs, a shape and the buttons that drive it — split them with the
  `.acctabs` hairline pattern (two half-width labels over a hairline, the
  line sliding under the one she is reading) instead of stacking them down
  the page. The tab row sits near the top, so it needs the pill's 56px corner
  reserve and a sliding line of `calc((100% - 56px)/N)` — an abspos child
  resolves its percentage against the PADDING box.
    **MINIMAL TEXT, and compared things SIDE BY SIDE (Aug 2026, Sophie — asked
  for on page after page).** A review page is a VISUAL reference, not an
  extension of the chat: title, ONE line under it, labels on the pictures —
  no paragraphs. And the things being compared sit NEXT TO each other (the
  `.duo` block in compare.css — labels ON TOP, "medium" / "high"), never
  stacked so she scrolls between them. Full rules live in the `new-page`
  skill and the shells' own comments.
  **A FILM IS A LINE OF TEXT WITH A PLAY BUTTON, AT THE TOP — never an
  embedded `<video>` (Aug 2026, Sophie: "never put a whole video when it's
  gonna be opened as a lightbox anyway, it should just be a line of text with
  a play button… so I don't just scroll through the whole thing").** Both
  the Evan film pages and the Mason one shipped a full-width player parked at
  the top; it is a black slab she scrolls past on every visit, and tapping it
  goes fullscreen regardless — so the box bought nothing. One line does it,
  and the overlay contract (autoscroll stopped, page locked, scroll position
  restored, video torn down on close so it can't play on behind the page)
  comes with it:
  `window.__filmRow({ url, label, meta:'4:56', mount:'#film' })` in
  `/compare.js`. **The deliverable sits at the TOP of the page**, above
  whatever there is to decide — that is where she looks for it, and it is why
  a delivery gets a Compare page at all.
  **THE STOCK TEMPLATES — post a LIST, not HTML, whenever one fits (Aug 2026,
  Sophie: "ready-made templates that they can use when it is appropriate and
  basically they will be forced into the structure of a page that's already
  built").** Two templates, one item shape, and the server renders the page —
  a chat cannot restyle it, half-copy it, or ship it with the kit missing:
  - **`POST /api/chatfeed/page { chat, title, template:'deck'|'grid', data }`**
    (no `html`). The answer carries `sheet` (`page-<id>`) for reading verdicts
    back. `page-templates.js` is the whole contract: an item is
    `{ id?, label, img?|text?, full?, url?, model?, quality?, promptStyle?,
    promptContent? }` — NO HTML anywhere in `data`, everything renders
    escaped. `deck` data is `{ items:[…], states?, voice?, browse?, aspect? }`;
    `grid` data is `{ groups:[{ label?, items:[…] }], states?, aspect? }`.
    **`aspect` is a MENU, not a free ratio** (Sophie, Aug 2026: square cards
    AND story-fragment rectangles, "options they can pick between"):
    `'square'` (1:1, a card deck's face), `'portrait'` (5:7, the
    playing-card / story-fragment rectangle), `'landscape'` (7:5). Omit it
    for the item's natural shape; one item may carry its own `aspect` to
    differ from its page.
  - **`deck`** = the judge page driven by data: browse mode ON (tap the
    card's left/right edges or swipe — no action required per card), ♥/✕/
    maybe/later or her own words via `states:[{key:'done',label:'done'},…]`,
    and `voice:true` puts a tap-to-record mic on every card (the transcript
    lands on the card's note thread via `POST /page-voice`, audio kept in
    Storage). **HANDS-FREE is the same mic, no toggle** (Aug 2026 — built the
    day her in-app mic probe passed): keep talking WHILE swiping and the page
    logs when each card came up; on stop, `POST /page-voice-session`
    transcribes once (whisper-1 — its segments carry start times) and each
    sentence lands on the card showing when the sentence STARTED
    (`assignVoiceSegments` in page-templates.js, tested). Every note carries
    the recording's url + the card's timestamp. ~0.6c/min. Approving a
    storybook page by page, walking a to-do list, picking keepers — all this
    template.
  - **THE MOMENT CARD — her own design, the deck's TEXT STYLE (Aug 2026,
    Sophie's "Decision Deck v2" canvas: "wire that in as the Tinder text
    style… the dates have multiple components that all need to be included
    together, but some might have just one text or they might have like a
    text and an image" — and "exactly exactly exactly like it does in the
    demo").** Built for the dating book's date cards, and copied EXACTLY
    from her v2 mockup — her hex palette (cream `#F7F2E8`, white boxes
    `#FFFDF8` on `#E7DECF`, rust `#C25E4C`, ink `#262016`), the Newsreader
    serif (Google Fonts, fetched by judge.js once per page), each part in
    its own white rounded box — deliberately NOT the house tokens; do not
    "fix" it back. Every part is OPTIONAL and a card renders only what it
    carries, in this order: `who` (the date's name — **centred, on its own
    line above the boxes**, lower than the mockup's header row, her ask),
    `eyebrow` (the small rust line) + `text` (the moment, in the serif)
    sharing the first box, `sections:[{label,text}]` (any number of labelled
    boxes — "Illustration", …), `img`, then `caption` (an italic quote under
    `captionLabel`, default "Caption"). A card carrying any of
    who/eyebrow/sections/caption gets this look automatically;
    `style:'moment'` opts plain text cards in too. **The date's NAME is drawn
    in the page's top chrome, one row under "Piles" — not inside the card**
    (her ask was "a little bit lower down and centered"; inside the centred
    stack it drifts to mid-screen on a tall phone, which is a lot lower
    down). **A moment deck wears the
    whole mockup chrome** (her second choice, asked and answered Aug 2026):
    the thin progress line + "Piles" + "?" replace the count/undo top row,
    and each date card's footer is her ✕ and ♥ (the mockup's ✓ swapped for a
    ♥ at her ask) in their own row with the "Note for Claude…" box FULL
    WIDTH and about four lines tall under them (Aug 2026, her ask: "the note
    box is just too small… the heart and the ex can go a little above it and
    maybe be a tiny bit smaller to make room" — 52px squares now, down from
    the mockup's 62) — so these decks have only yes/no (piles named
    Yes/No/Unsure, the mockup's words), no maybe/later, no mic and no corner
    note +. The note box saves through the same verdict-doc thread and
    Assets-tab mirror as the + note everywhere else. **And the keyboard may
    not cover it** (her report: "I'm usually using the microphone, but the
    keyboard still comes up and blocks the note box" — iOS raises the
    keyboard for dictation too): while the box is focused, judge.js sizes
    the deck's column to the TOP window's visualViewport (the page sits in
    a same-origin iframe in the app, and the keyboard signal only lands on
    the top window), so the footer rides above the keyboard and the card
    scrolls inside itself; cleared the moment the keyboard goes.
  - **A DECK IS ONE SCREEN, SO IT CARRIES NO AUTOSCROLL PILL AND — when it
    is a moment deck — NO TITLE OF ITS OWN (Aug 2026, her report on the live
    date deck: "the auto scroll pill is still there, but it doesn't need to
    be because the page doesn't scroll at all… you added an extra header at
    the top and very big font").** Three leftovers of the generic page
    skeleton, all fixed in `renderTemplatePage`/judge.js, and worth knowing
    before building anything else that lives on one screen:
    - **The pill.** `renderTemplatePage` emits the pill's own head-safe
      opt-out (`<meta name="forge-pill" content="off">`) for every `deck`
      page — one card at a time never scrolls, so the pill was chrome with
      nothing to drive, parked over the top-right corner. **The `grid`
      template does scroll and keeps its pill.**
    - **The `<h1>`.** A moment deck renders none: the app's own header above
      the page already shows the page's name, so the `<h1>` was the name
      twice, the second time in 26px serif eating the top third of the
      screen. The `<title>` tag still names it in a browser tab.
      **`?clean=1` drops the `<h1>` on ANY template page** (Aug 2026 v2 — the
      Review Queue's door: its tiles open `/api/chatfeed/page/<id>?clean=1`,
      straight onto the cards; her ask was "not a compare page because that
      has a header at the top"). `renderTemplatePage({ …, clean })`; a clean
      grid keeps its pill because it scrolls.
    - **THE ✕ AND ♥ FLOAT ON THE CONTENT, AND A LONG CARD'S TITLE GOES
      TOP-LEFT (Aug 2026 v2, Sophie, on the live deck: "there's a lot of
      space between the X and the heart that's empty… put the heart and the X
      on top of the content so the content comes down a little farther and
      there's just a tiny bit of space between the note and the content" ·
      "if the text is really long have the title just go in the top left
      corner instead of in the middle. I really don't like scrolling").** The
      ✕ · note · ♥ row cost ~78px of mostly empty band; now the two buttons
      are pinned over the content's bottom corners and the note box is the
      footer row under it. Over ~240 characters (~150 with a picture) the
      card also wears `.long`: the name drops to a small top-left line and
      the stack starts at the top instead of centring, reserving the buttons'
      height at the bottom of the scroller. **A short card is untouched** —
      the big centred name is the design there.
    - **A LONG CARD GETS A MINI AUTOSCROLL, AND HER ✕/♥ ARE DRAWN BY HAND
      (Aug 2026 v2).** "Only appears when the text is very long and is smaller
      than the normal one and just like on the side of the screen": a 28px
      button on the right edge driving the CARD's scroller (the page still
      never scrolls), shown only while the card actually overflows. A new card
      starts it stopped; the same card is left alone, because `fonts.ready`
      re-syncs after the serif lands and a blanket stop there killed the
      scroll a second in. The position accumulates in JS — `scrollTop +=
      0.37` snaps to the same integer every frame and moves nothing.
      The ✕ and ♥ (`MOM_X` / `MOM_HEART`) are filled outlines with chisel
      caps rather than the plain characters, at her ask.
    - **A DECK OPENED FROM THE REVIEW QUEUE HAS A BACK MARK** — `?clean=1` is
      both the door (no `<h1>`) and the signal; judge.js draws a chevron at
      the left of the top row and `history.back()`s to the queue. A deck
      opened from the Compare tab shows none. Its **piles view** also carries
      *Open the chat* + **Skip** / **Done**, which stamp the page doc through
      `POST /api/chatfeed/page/:id/review`.
    - **A MARK NEVER MOVES THE DECK** (Aug 2026, Sophie, on her date deck:
      "hearting, heart or exing should not move the moment, only tapping on
      the sides should go to the next moment"). In BROWSE mode — which every
      template deck is — marking and moving are separate gestures: the ♥/✕
      light in place so she can mark, re-read and change her mind, and only
      the edge taps and the swipe navigate. A deck with `browse:false` (and a
      hand-built judge page) has no edges to tap, so there the verdict still
      advances — that is the classic Tinder page and its only way forward.
    - **THE PAGE IS PINNED SO IT CANNOT ZOOM ITSELF — the TYPE STAYS HER SIZE
      (Aug 2026, and she settled it twice).** iOS auto-zooms the whole page
      whenever it focuses a field under 16px, and on a one-screen deck that
      zoom has nowhere to go. There are exactly two cures: inflate every
      field to 16px, or pin the page scale. 16px shipped first and she asked
      for it back — "I would prefer not to have pinch [zoom] and for it not
      to be 16 PX… now it's too big… I don't need pinch zoom" — so the boxes
      are 13px/14px again and `maximum-scale=1, user-scalable=no` rides the
      viewport. **DO NOT raise a field to 16px to dodge the zoom.** The lock
      is applied in TWO places on purpose: `renderTemplatePage`'s meta (no
      flash of a zoomable page) and `compare.js` at runtime, which is what
      reaches the hand-built pages posted months ago — their HTML is frozen,
      but they all still link that file.
    - **AN EDGE TAP FLASHES NOTHING** — `-webkit-tap-highlight-color:
      transparent` on `.jg-navzone`, because iOS paints a grey slab over the
      whole 26%-wide zone otherwise ("gray bars that show up when I tap the
      side of the page"). The card moving is the feedback.
    - **Every fixed-size button says `justify-content:center` ITSELF**
      ("the heart and the ex are not aligned with their buttons and neither
      is the ?"). `compare.css`'s global `button` rule sets
      `display:inline-flex; align-items:center` but no `justify-content` —
      harmless on a button that hugs its words, and a visible mistake on a
      62px square, where the glyph sits against the left edge. Anything
      giving a button a fixed width here has to centre its own contents.
    - **Her radii came DOWN from the mockup at her ask** ("make all the
      rounded corners a little bit less rounded and more square"): boxes and
      the ✕/♥ 10px, the note box 9px, Piles 8px — partway from her mockup's
      16/17/14 toward the house 6px, not all the way.
    - **The NAME is her rust, in the SANS, in CAPS** (asked for after seeing
      it live): `#C25E4C`, `-apple-system`, uppercase, sitting a little
      further down. Caps in the sans bring the house sans rule with them —
      not bold, `.04em` of tracking (design-rules.md). It is the
      one part of the card deliberately not in the Newsreader serif — the
      moment, the caption and everything else still are.
    - **One gutter, so the rows line up** ("lots of things are
      misaligned"). The moment deck fills the viewport (`100dvh`, nothing
      scrolls) and every row — progress line, Piles, boxes, footer ✕/♥ —
      shares the same 22px gutter, where the old layout had three different
      left edges (compare.css's `.wrap` padding, a 56px pill reservation, a
      centred footer). The stack centres itself in what's left with AUTO
      MARGINS — NOT `justify-content:safe center`, which iOS Safari doesn't
      support: it fell back to plain `center` and clipped a tall card at
      both ends with the top unreachable ("the text gets truncated if it's
      too long and hidden", Aug 2026). Auto margins centre a short stack the
      same and resolve to 0 on overflow, so a tall card scrolls INSIDE its
      own box from the top — with `scrollbar-width:none`, because a 15px
      desktop scrollbar inside that box pulls the cards off everyone else's
      edge. **A card that overflows also steps its type down first**
      (`.jg-mom.long`, measured per card at render): the 21px moment drops
      to 16px toward the other blurbs' size — her own suggested fix — so
      most long cards come back to one screen; short cards keep her
      Decision Deck sizes exactly.
  - **`grid`** = the classic one-variable comparison: each group is one row
    wrapping at THREE across (2026-08-19 — six ~50px tiles in one phone row
<<<<<<< HEAD
    was unreadable, whatever the original 2–6 spec said), **ruled off from
    the next group with a hairline** (same day, Sophie: "a line between
    different sets of things being compared, so that if things … wrapped to
    the [next] line, I can still tell the difference between that and the
    next set" — once rows wrap, white space alone cannot say where a set
    ends). The tile is **minimal like an Assets tile** (Sophie: "the things
    I need to compare are staggered and the titles are way too long… just
    the picture and then two lines underneath it saying what changed"): the
    PICTURE first, so a row lines up, then the label clamped to two lines —
    the what-changed line — then **✕ · PROMPT · ♥**, the prompt button in
    the middle, the same order the lightbox row has always had. PROMPT is
    the Assets overlay (content/style split, opens on CONTENT, MODEL ·
    QUALITY at the top; when a row's variants differ in their STYLE half,
    each variant's style tab marks the lines it does not share in rose).
    **There is NO note + on a tile** (her call, Aug 2026: "it's making an
    extra line, so could you make it only appear in lightbox view for now —
    I might rescind that later") — the kit's + sat on its own line under
    every tile and cost a row of height on a surface whose whole point is
    seeing the set at once.
  - **Tapping an asset-backed picture opens THE Assets-tab lightbox** —
    `/asset-lightbox.js`, the exact code lifted out of chats.html (her ask:
    "identical to what happens when I open the image in assets"), so the big
    image, ♥/✕ on its corners, the note box and the Prompt button are one
    implementation on both surfaces; the lightbox ♥ saves the page verdict
    and the asset vote together, and the tile repaints under it. **The
    conversation sits UNDER the box, peeking** (Aug 2026, her rework after
    living with it: "I wanted it below the text box so most of it will be
    out of view, and there can just be a button which makes the note texting
    take up more of a screen, like overlay on top of the actual image") —
    writing is the common act, re-reading the occasional one. A **CHAT**
    button beside PROMPT in the top row throws the thread over the picture,
    centred on the viewport so it always covers it — and it appears **only
    when the thread holds more than the peek can show** (Aug 2026: "only have
    it show up IF there are extra notes that would need to scroll to see"), so
    the button means *there is more up there*, never *notes exist*. That is
    MEASURED (the peek's own overflow, re-checked a frame after the overlay
    has a size and again on `fonts.ready`), never counted — how much fits
    depends on how long the letters are. And the whole overlay carries
    `data-nostop`: the app drives an embedded page's scroll with a
    tap-to-TOGGLE whose skip list is `[data-nostop],img,figure,.cmp-lb`, and
    without the mark the tap that CLOSED the lightbox started the autoscroll
    behind it.
=======
    was unreadable, whatever the original 2–6 spec said), and the tile is
    **minimal like an Assets tile** (same day, Sophie: "the things I need to
    compare are staggered and the titles are way too long… just the picture
    and then two lines underneath it saying what changed"): the PICTURE
    first, so a row lines up, then the label clamped to two lines — the
    what-changed line — then ♥/✕ + note + PROMPT (the Assets overlay:
    content/style split, opens on CONTENT, MODEL · QUALITY at the top; when
    a row's variants differ in their STYLE half, each variant's style tab
    marks the lines it does not share in rose). **Tapping an asset-backed
    picture opens THE Assets-tab lightbox** — `/asset-lightbox.js`, the
    exact code lifted out of chats.html (her ask: "identical to what happens
    when I open the image in assets"), so the big image, ♥/✕ on its corners,
    the note THREAD under it and the Prompt button are one implementation on
    both surfaces; the lightbox ♥ saves the page verdict and the asset vote
    together, and the tile repaints under it.
>>>>>>> origin/main
  - **THE MIRROR: an item with `url` (its Assets-tab identity — a storage
    `img` is its own by default) keeps the page and the Assets tab AGREEING**
    (Sophie's call): ♥/✕ writes through to the asset vote, a committed note
    is appended to the asset's note thread, and on load an Assets-tab ♥
    fills in any item the page has no verdict for.
  - **The chrome is rendered at SERVE time** from the current stock renderer,
    so a fix reaches every template page ever posted; the DATA is what's
    frozen (a new version is still a NEW page, same as always).
  - **THE TITLE FITS ON ONE LINE, and the page's <h1> may be SHORTER than
    the name the tab lists** (Aug 2026). `compare.js` shrinks a `.wrap > h1`
    until it stops wrapping — only ever down, and never past 60% of the
    page's own size, so a title too long even then wraps as before. And
    `renderTemplatePage` takes a `heading` beside `title`: the tab's row
    keeps the full name, the page shows the shorter one (her call on the
    auto pages: "the 'auto compare' only needs to appear in the compare tab,
    not the actual page"). `<title>` always keeps the full name.
  - **AUTO-FEED — THE SERVER FILES THE COMPARE PAGES ITSELF (Aug 2026 v2,
    Sophie: "the automatic thing doesn't work… if an image is exactly the
    same except one or two variables have been changed, for example the
    quality, then this should automatically file into a compare page").**
    The first cut left this to the chats (`{ from:{assets:true} }` was a
    door a chat had to walk through) and nobody walked through it — so
    filing a prompt or a MODEL · QUALITY caption IS the trigger now.
    `POST /api/gallery/assets/prompt` and a curated caption filing both poke
    `runAutoCompare` (chatfeed.js, debounced ~45s per chat), which keeps up
    to TWO standing grid pages per chat in its Compare tab:
    - **"Auto-compare — same prompt, settings changed"** — exact-same
      content prompt, differing quality / model / style half (the ladders).
    - **"Auto-compare — same style, different subjects"** — exact-same
      style prompt across different contents (her dream case: one style
      walked across many dreams), shortest content first.
<<<<<<< HEAD
    - **"Auto-compare — same prompt, drawn again"** (Aug 2026, Sophie: "the
      dream feed chat now has grainy and non-grainy images, can we make this
      auto trigger compare page") — one prompt drawn more than once at the
      same model and quality, in the order they were drawn. Her grainy/clean
      pairs are identical on every FILED field, because what differed was
      `output_compression`, a generation setting nothing ever recorded — so
      the ladder rule ("identical everything is a re-roll, not a comparison")
      correctly could not see them. That rule is right about what it can see
      and was wrong that she never wants them side by side; this page claims
      only *this prompt was drawn twice*, never why they differ. **The line
      under each tile is the half the filing chat wrote after the picture's
      name** — the names are identical by construction — falling back to
      "Draw 1 / Draw 2" when nothing distinguishes them.
    - **A TILE'S LABEL IS THE LINE THAT IS THAT VARIANT'S OWN** (fixed
      2026-08-19 on her live ladders page, where five tiles all read
      "Last-Minute Halloween Party"). "Differs from SOME sibling" is too weak
      a test in a group of many — three variants sharing a first paragraph
      all got handed it — so the label takes the style line unique to that
      item, then the chat's own tail, then the style reference's name, then
      the short name, then the draw number, each tried only while the labels
      still collide. (`diffStyleLine` keeps the weaker test, which is the
      right one for grid.js's rose marking between two variants.)
=======
>>>>>>> origin/main
    A row wears a SHORT tag ("Style 1") with the prompt behind the "?" —
    a group's real header here IS a prompt, and in gold caps between her
    title and the pictures that is exactly the shape the *nothing to read
    above the first picture* rule forbids; a page with one group wears no
    tag at all. Both **update IN PLACE** — the ONE deliberate exception to "a new
    version is a new page": item ids derive from storage filenames, so a
    new image joining a group re-points nothing, the verdict sheet never
    moves, and her ♥/✕/notes survive every update. The doc id is
    deterministic (`auto-<kind>--<chat>`), `updated` bumps per rewrite (the
    Review Queue keys its item cache on it), a push fires only on CREATE,
    and caps are named in the label ("newest 24 of 31"), never silent.
    `POST /api/chatfeed/auto-compare {chat}` runs it deliberately — for
    backfilling a tab whose prompts were filed before this existed.
    **This only sees what gets FILED**: an image with no prompt on record
    can never join a group — one more reason the prompt POST is
    non-negotiable. `{ from:{assets:true} }` still works for a chat that
    wants its own hand-titled ladder page. **Near-identical prompts (a line
    added or changed) are still never auto-filed**:
    `GET /api/gallery/assets/variants?chat=` FLAGS those clusters (and the
    `contentSets` alongside them) and the chat decides where the variation
    set starts and stops (Sophie's rule, Aug 2026: the server files only
    what is provable; the chat deciphers the rest).
    **The style tab marks the differing lines** (grid.js): when a row's
    variants differ in their STYLE half, each variant's style overlay shows
    the lines it does not share with the others in rose — her ask, made for
    exactly the different-styles-same-dream case.
  - **THE TOUR (Aug 2026, Sophie: "a tutorial where the buttons are
    highlighted or everything else is tinted and it has a little
    explanations").** `window.__compareTour({key, steps:[{sel,text}], auto})`
    in `/compare.js` — coach marks: the page dims, each control shows
    through a gold spotlight with one line under it, any tap steps forward.
    A served template page plays its tour ONCE per device (localStorage)
    and offers "SHOW ME AROUND" behind the "?" forever. Any hand-built page
    may call it too — never hand-roll a spotlight overlay.
  - Tests: `node scripts/test-page-templates.js` (validation, rendering,
    grouping — pure) and `node scripts/test-templates-pages.js` (both stock
    pages driven in headless Chromium, mirror posts included, plus the tour
    on a fresh device).
  **THE JUDGE PAGE — "Tinder style", her name for it (Aug 2026).** When she
  is PICKING/CHOOSING across a set rather than reading a comparison, start
  from **`public/judge-shell.html`** + `/judge.js`: one thing at a time, big,
  NO scrolling, ♥/✕/maybe/later (maybe and later are real piles — 'later' is
  "declined to sort now", reviewable as a group), verdicts saved live to the
  chat's verdict doc (`ok` accepts those short strings since Aug 2026),
  resume on reopen, piles view with re-judging, undo, a note box per card. A
  judge item can be a labeled PAIR judged as one thing — the
  compare-and-choose case (medium vs high of the same portrait, PDF page vs
  its text). Read answers back via `GET /api/chatfeed/verdict?chat=&sheet=`.
  Tests: `node scripts/test-judge.js`.

- **THE CUT PICKER IS THE REQUIRED SURFACE for "pick spans of a recording"
  jobs (Aug 2026, Sophie — after FOUR chats each hand-rolled their own
  span-picking page in one week and each re-shipped the same bugs).** Any
  time Sophie needs to pick which parts of a long recording to keep — an
  audiobook passage, an interview, one of her own recordings — start from
  **`public/picker-shell.html`** and `window.__cutPicker` (`/picker.js`).
  Do NOT hand-roll word-tap handlers, per-pick audio, reorder tiles, or
  pick-saving again. What it gives you, debugged once:
  - tap-a-first-word / tap-a-last-word span picking (her own preferred
    model, from the "grasshopper" chat's page), tap a pick to remove, undo;
  - WORDS / PICKS tabs (the witch shop's description-vs-reviews pattern —
    Sophie's ask, so the tiles aren't a long scroll below the transcript),
    and a follow-along highlight: the word being spoken lights up and
    auto-centers while a pick plays (the Voice Memos / Cutting Room
    pattern; only as exact as the page's word times);
  - **a ▶ on every pick that plays THAT EXACT SPAN within seconds** — the
    server cuts it once via `GET /api/search/clip-span?src=&t0=&t1=`
    (editor.js's transcoder + the search-clips immutable cache), so she
    never waits for a chat to wake up and render before hearing a cut;
  - pick tiles with ▲▼ reorder, a note box per pick, play-them-in-order
    (the "TIME — move the sentences around" page's model);
  - live saving as **ONE verdict field per pick** (`<id>:p<key>` →
    `{a, z, o, note}`) — never one big JSON string, which silently
    truncates at the verdict route's 2000-char cap around 15 picks;
  - the autoscroll-pill tap contract via `/compare.js`, so the
    tap-starts-the-scroll bug cannot ship again.
  Read her picks back with `GET /api/chatfeed/verdict?chat=&sheet=` (keys
  `<id>:p*`, empty = removed, order by `o`, indexes into YOUR words array),
  then cut the real audio with the precise cutter — preview clips are
  previews. Word times can be segment-interpolated; with no times the
  picker still picks, just without play buttons. Seed your suggested spans
  via `seed:`, shade already-used words via `shade:`; the scissors on a
  pick tile splits it into two back-to-back picks (so each part can get a
  different picture or speaker).
  **Send-to-episode (Aug 2026, Sophie):** for an INDEXED source the picker
  bar carries a "to the Episode Editor" button — every pick, in her order,
  becomes a snippet card in ONE NEW episode (`POST
  /api/search/picks-to-editor {src, title, picks:[{text,timeSec}]}`), where
  narration cards, gaps and the real render already live. Each send makes a
  NEW episode (never appends — the new-version rule); a chat asked to "put
  these in an episode" should call the same route rather than hand-building
  episode docs. Tests: `node scripts/test-cut-picker.js`.
