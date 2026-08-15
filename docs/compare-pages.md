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
  - The survey's two gaps are still open: the seven Replicate LoRA styles on
    one subject, and an aspect-ratio set beyond the blog heroes.
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
