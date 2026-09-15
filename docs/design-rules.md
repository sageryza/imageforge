# Design rules — the deep half

The house rules that only bite when you are actually building a page, an iOS screen or a piece of chrome: where a header lives, how the hairline tab rows measure their own underline, how a custom icon is sized against an SF Symbol, the webp rule for served art, the sans-caps type rule, and the home screen's filter row.

**The always-rules — no gradients, no pills, label and file every image, her voice model, no Claude-isms, background jobs, how to write a reply — stay in `CLAUDE.md`.** Every one of these was earned by shipping it wrong first, so the measurements are kept with the rules.

*(Moved out of `CLAUDE.md` Aug 2026 — see the pointers there. Nothing was rewritten; this is the text as it stood.)*

- **BACK TO THE TOP RIDES IN THE PILL'S RAIL (Aug 2026, Sophie: "add a small
  back to top arrow in playground when i scroll down. as well as other long
  scrolls like meta assets").** A 38px round button under the autoscroll
  pill's speed label, shown only once she is a full screen down.
  - **It goes in the RAIL, not loose on the page.** The pill's top-right
    corner is already reserved everywhere (header rows pad 56px for it), so a
    second free-floating control is a control landing on page content — the
    exact thing that reservation exists to prevent. One rail, not two floats.
  - **It is NOT the pill's ▲.** That segment walks up gradually at the
    autoscroll speed; this one jumps. The glyph says so: arrow-up-TO-LINE, not
    a bare chevron.
  - **A tap stops any running autoscroll FIRST**, then smooth-scrolls. Without
    that the scroll keeps walking the page back down under the animation.
  - **It hides with the pill**, so a page with nothing to scroll never grows
    one, and `<meta name="forge-pill" content="off">` takes it away too
    (`window.__pillTopSync` becomes a no-op alongside `__pillSync`).
  - **The source is `scripts/pill.py`** → `python3 scripts/gen-pill-inject.py`
    → `public/pill-inject.html`, which the server appends to every gated page
    that opts in (`serveGated(..., {pill:true})`) and to every Compare page.
    The pages that BAKE their own pill copy carry it too — and three of them
    (`chats.html`, `gallery.html`, `writing.html`) hold an OLDER hand-drifted
    pill with no conditional-pill pass at all, so they got a self-contained
    copy that leans only on `window.__scrollStop`. Re-generating those pages
    is its own job (see the stale-generator warning in `CLAUDE.md`).
  - Pinned by `node scripts/test-back-to-top.js`.
  - **AND ITS TWIN GOES TO THE BOTTOM (2026-09-03, Sophie: "add a scroll to
    bottom arrow playground").** `#pbot`, the same `.ptop` class and size,
    directly under the top arrow in the rail, arrow-down-TO-LINE — a jump,
    not the pill's ▼. Lit while more than 150px of page is still below the
    fold (so at the very end it goes out exactly as the top one does at the
    very top); a tap stops any running autoscroll first, then smooth-scrolls
    to the end of whatever is scrolling (the window, or an adopted sheet —
    `sEnd()` beside `sHome()`). Both arrows are re-derived by the one
    `syncPtop` / `window.__pillTopSync`. **Injected pill only so far** — it
    reaches the Playground and every `{ pill: true }` page; the five baked
    copies and `mkPagePill` do not carry it yet. Pinned by
    `node scripts/test-scroll-to-bottom.js` (the real Playground included,
    the tap asked with `elementFromPoint`).
  - **IT FOLLOWS WHATEVER IS ACTUALLY SCROLLING (2026-08-24, Sophie: "some
    surfaces scroll but have no to top arrow. like story room shelf").** A
    full-screen sheet (`position:fixed; inset:0; overflow-y:auto` — the Story
    Room's shelf) takes the scroll away from the window, and every check here
    asked the window, so on the shelf there was no pill and no arrow at all;
    the sheet's z-index 40 also sat over the pill's 9, so a lit arrow was
    unreachable (measured with `elementFromPoint`). The pill hears an inner
    scroller through a CAPTURE-phase `scroll` listener (scroll does not bubble
    but it does capture, so `e.target` names the box) and, before she has
    scrolled anything, through `elementsFromPoint` at the middle of the screen
    — asked only when the window itself cannot scroll, and re-asked by a
    MutationObserver, because a fixed sheet opening changes nothing a
    ResizeObserver watches. **Only a nearly-full-screen overlay is adopted**
    (80% wide, 60% tall): a note list or a drawer must never steal the pill
    from the page behind it. Adopting one lifts the pill to that box's
    z-index + 1 and releasing restores its own. Test:
    `node scripts/test-pill-sheet.js`.
  - **AND IT FOLLOWS THE VISUAL VIEWPORT, OR THE KEYBOARD PUSHES IT OFF THE
    TOP OF THE SCREEN (2026-09-13, Sophie, on /footage: "auto scroll bug").**
    iOS does not resize the LAYOUT viewport when the keyboard opens — it
    shrinks the VISUAL one and, to reveal the caret, offsets it inside the
    layout viewport. `position:fixed` pins to the layout viewport, so the whole
    rail slid up out of the visible band by `visualViewport.offsetTop`,
    top-first.
    - **Measured off her screenshot (iPhone 13, 1170x2532, the app's
      full-screen web view, keyboard up, a block textarea focused):** the rail
      was intact and in its own geometry — capsule bottom edge at **92.2pt**,
      the speed label, the back-to-top circle 123.0-160.7pt, to-the-bottom
      169.0-206.7pt, 8pt gaps, every number the pill's own. The capsule is
      160pt tall, so its top sat at **-67.8pt** against the `top:max(14px,
      env(safe-area-inset-top))` = 47pt it should have: the fixed layer was
      **~115pt above what she could see**. Reproduced headless at the same
      offset — **`#vtop` 0 of 52pt inside the band, `#vmid` 3 of 52, `#vbot`
      52 of 52** — so ▲ and play/pause were gone and the one button left was
      ▼, which while playing means FASTER. Her speed label read **Fastest**.
      Tapping the only reachable button is what puts it there.
    - **IT IS THE CHILDREN THAT MOVE, NOT `.float` — that is the load-bearing
      half.** Six pages reserve the pill's column by measuring `body > .float`'s
      own rect (footage, Freeform, the Playground, the Character page, Stitch,
      chats), and a rect that slid 115px down the moment the keyboard opened
      would hand the reserve to a different row and flip the prompt box's width
      mid-sentence — the 2026-09-11 "switches back and forth between narrow and
      full width" complaint arriving by another door. A child's transform never
      moves its parent's border box, so the JS writes `--vvtop` on `.float`,
      `.float > *{transform:translateY(var(--vvtop,0px))}` moves what she sees
      and taps, and **every one of those six readers is correct with no edit**.
      `window.__pillOffset()` publishes the offset for anything that wants it.
    - **IT ONLY EVER CORRECTS.** Where no offset is reported — every desktop
      browser, and the web views that never report one (the same gap
      `caretkeep.js` already names) — nothing is written and the pill is
      byte-for-byte where it has always been.
    - **Ruled out by measurement, not by reading:** it was not page scroll and
      not a transformed ancestor (on /footage the pill's only ancestors are
      BODY and HTML, both `transform:none`, and its client top is 14 at scrollY
      0 and 14 at scrollY 600); nothing hides a SEGMENT (`syncPill` only ever
      hides the whole `.float`); not the typing or caret work
      (`test-footage-typing.js`, `test-caret-keep.js` green throughout); and
      footage wires no `__scrollTap`/`__scrollToggle` at all, so no stray tap
      can start a scroll there.
    - **SEVEN FILES, the house rule** — `scripts/pill.py` →
      `python3 scripts/gen-pill-inject.py` → the five baked copies (chats,
      gallery, storyroom, wall, writing) → `mkPagePill` in `chats.html`, whose
      listener takes itself off once its pill is detached or every page she
      opens leaves one behind. Test:
      `node scripts/test-pill-visual-viewport.js` — the source pin across all
      six copies plus the real footage page driven with a stubbed keyboard
      (the instance's `offsetTop` shadowed, the event fired), every assertion a
      MEASUREMENT, since a pill that reads the offset and never moves, one that
      moves the wrong way, and one that drags six pages' reserve with it all
      look identical in the source. Verified failing pre-fix on her exact
      numbers: `#vtop` 0 of 52pt, `#vmid` 3 of 53pt.
  - **NEVER hand-roll a second one.** `/chunking` carried its own circle at
    the bottom-right from before this existed — two back-to-tops, two corners,
    one job, and a round plate the icon rule has since retired.
  - **A PAGE CAN KILL THE WHOLE INJECTED PILL BY NAMING A VARIABLE.** Its
    script runs in the page's global scope, so a top-level `let`/`const`
    sharing a name with one of the pill's `var`s (`playing`, `raf`, `I`,
    `dir`, `last`, `si`…) is a parse-time SyntaxError that takes the pill with
    it, silently — `/search` had `let playing` and had no autoscroll and no
    arrow for as long as it existed. **Wrap a page script in an IIFE**
    (`/cutmarks` already does, and its comment says why).
    `node scripts/test-pill-globals.js` loads every injected page in a real
    browser and asks whether the pill's script ran.
  - **A PAGE CAN NAME STOPS ON THE WAY (2026-09-14, Sophie, on footage:
    "scroll to top and scroll to bottom shud go to midway references/buttons
    first, then all the way").** `window.__pillStops` — a function answering
    page-y positions — and the rail's ↑ and ↓ go to the nearest stop in their
    direction that is more than 60px away, else all the way, so a second tap
    from a stop finishes the trip. Footage names one: the references bar (the
    buttons row is right under it). No hook, no stops: the jump it always
    was; a scrolling box knows no stops. Source `scripts/pill.py`, rebuilt
    into `pill-inject.html`; measured on footage in
    `node scripts/test-footage-box-width.js` (bottom → 487 → 0, top → 487 →
    end).
- **TRUNCATED TEXT OPENS WITH AN UNDERLINED WORD — NEVER A BUTTON (Aug 2026,
  Sophie, pointing at the Playground: "the ... button for longer than two line
  prompt is huge. why? it shud be fixed everywhere. truncated text shud always
  just be a ...with a line under it that links to open (untruncate) or it can
  say 'more' or 'see more'. never a separate button. document that as a ui
  pattern").** Wherever a page cuts text and offers a way to see the rest, the
  way in is **a word with a line under it**, sitting at the end of the text it
  opens.
  - **IT SITS ON THE LAST LINE OF THE WORDS, NOT BESIDE THEM (Aug 2026,
    Sophie: "Button should be part of the text, not separated from it on the
    side").** Part of the sentence it opens, at the end of the last visible
    line — never parked at the far end of the row the text happens to be in.
    She asked for this once before, on the dream cards ("I want the see more
    button to be on the same last line of the text rather than underneath
    it"), and `.dbody` in `dreamapp.html` is the settled implementation:
    - `-webkit-line-clamp` CANNOT hold the control — anything inside that box
      after the cut is clipped with the text. That is why the first attempt
      made it a SIBLING, and a sibling in a flex header row lands wherever
      the row puts it, which was the complaint.
    - So the clamp is a plain `max-height`, and the opener is a right float
      with `clear: both` sitting below a **zero-width float one line SHORT of
      the cap** (`::before`, `height: calc((lines - 1) * lh)`). The only line
      it can land on is the last one, and the words wrap around it. Both
      floats come BEFORE the text in DOM order, so neither is "after the
      clamped text" and neither is clipped.
    - The `fold` class that adds that `::before` is set by JS and only where
      the words really were cut: `overflow: hidden` makes the block a BFC, so
      the float would otherwise stretch a one-line prompt to the full cap.
    - OPEN, the control moves to the END of the words (`float: none`), because
      unfloated at the front it would read before the first word.
  - **The mark:** `…`, `… more`, `more`, or `see more` — whichever reads best
    where it sits. Underlined. Inline. Inherits the surrounding font, size and
    colour. `border: 0; background: none; padding: 0; margin: 0`. Opened, the
    same control says `less` / `see less` / `Close` and closes it again.
  - **NOT:** a bordered or padded box, a rounded rectangle, a chip, a bare
    unstyled `<button>` (which draws the browser's own grey box), or a control
    parked away from the words it belongs to.
  - **Still a `<button>` element** — it does something, so it must be
    focusable and reachable by a screen reader. This is a rule about how it is
    PAINTED, not about markup.
  - **The class is `.moretxt` on every page**, with the same declarations.
    There is no shared stylesheet across these pages, so the copies are by
    necessity; keeping the name identical is what makes the next one a
    copy-paste instead of a fresh invention. Live copies: `promptlab.html`,
    `dreamapp.html` (beside `.dmore`, which is the same pattern with a dashed
    underline), `dreams-archive.html` (`.more`), `chats.html` (`.wrapmore`,
    and `.wrapmore2`, which keeps its small caps because it sits under a bold
    field label rather than at the end of a sentence).
  - **TWO UNRELATED CONTROLS MUST NEVER SHARE A CLASS NAME — that is what
    actually broke it.** The Playground's opener was written correctly the
    first time: `.morebtn`, borderless, `padding: 0`. Then the "Older" paging
    button took the same class further down the same file with a 1px border
    and `9px 18px` of padding, and the later rule won — so the "…" rendered as
    a big empty box in the middle of a run's header. Nothing was wrong with
    the opener; it lost a name fight. The paging button keeps `.morebtn`, the
    opener is `.moretxt`.
  - **Add it after layout, and measure** `scrollHeight` against `clientHeight`
    rather than counting characters — only the browser knows whether the text
    really overflowed. `applyClamps` in `promptlab.html` is the reference.
  - **Text that is cut with no way to open it is a different thing** and this
    rule does not reach it (a card title clipped to one line, a caption cut to
    three). If you add a way in, it takes this shape.
  - Pinned by `node scripts/test-truncation-opener.js`.
- **Headers: a WEB-WRAPPED tool's PAGE owns its header (Aug 2026 v2, Sophie's
  decision — REVERSES the earlier "forgeToolBar on every tool root" rule for
  web tools).** For any tool that is a WKWebView on a served page, the header
  is built in the page's own HTML/CSS (the Chats/Writing Room pattern), NOT a
  native SwiftUI bar. Two reasons, both Sophie's: full design control (the
  rename pencil, Archive, tabs, toggles, search — none of it fits a native
  bar) and shipping speed (a page header changes with a Render deploy; a
  native bar needs a TestFlight build). The native wrapper stays a bare
  WKWebView host — no `.forgeToolBar`, no in-app title on web tool roots.
  - **One look, shared code.** Pages must still MATCH each other: build page
    headers to one shared pattern the way the autoscroll pill is shared (ONE
    source — `scripts/pill.py` — imported by every gen script / injected by
    the server), not a fresh hand-rolled header per page. The pill defends
    its own glyphs against host-page `svg` globals (a page's `svg{fill:none}`
    hollowed its play triangle — Sophie caught it on the Cutting Room, and
    editor.html had the same hazard); after ANY pill.py edit, re-run
    `python3 scripts/gen-pill-inject.py`. When adding or
    changing a page header, reuse/extract the shared pieces (the eyebrow
    title style, the back control, the pill-corner reservation) instead of
    copying variants around. The Chats header is the reference look.
  - **Reserve the pill's top-right corner on every header row** (see the
    `/chats` section — `padding-right:56px`): with no native bar the page's
    pill floats high over its own header, so no control may live in that
    corner.
  - **THE HEADER TOP IS ONE NUMBER, AND `pagehead.js` ENFORCES IT BY
    MEASUREMENT (2026-08-23, Sophie: "the header is different in both, and
    not at the top" — the Story Room was just the pair she screenshotted).**
    Measured across all 39 gated pages that day: the gap above the header ran
    **0 to 42px** and the chevron's left edge **-4 to 16**, no two families
    agreeing — because no one owned the number. Every page improvised its own
    status-bar clearance (chats' `5vh` IS roughly the notch on an 844pt
    phone, by accident; 16 pages shipped without `viewport-fit=cover`, so
    `env(safe-area-inset-top)` read 0 for them and fixed pixels were the only
    tool they had), and every new page copied its neighbour's number. A page
    alone can't be wrong — a header 40px low is valid markup and looks fine on
    its own screen — so no per-page test could ever catch it.
    - **The number: the header row's CONTENT-BOX top sits at
      `var(--headtop)` = `env(safe-area-inset-top) + 4px`, and the chevron's
      left edge at 16px.** The content-box, not the chevron itself: a tall
      band (search — title + its box) centres the chevron a few px inside
      itself, and that is its own business.
    - **`levelRow()` in `pagehead.js` enforces it the way the pill defends
      its colours: measure the real box, correct, re-check** (fonts,
      resize, a ResizeObserver, an IntersectionObserver for headers that are
      hidden until content loads). A sticky/fixed row is corrected through
      its PADDING (margin cannot pull sticky up — it re-pins at 0; measured
      on /studio, where -10.5px of margin moved the header exactly 0px); an
      in-flow row through its MARGIN, so dead space above it is reclaimed. A
      row is pulled UP only when the space above it is dead, and nothing
      moves more than 64px.
    - **So a page needs NO top-inset code of its own** — write a sane
      `.wrap` and let the injected chrome level it in the app. A page that
      must look right in a plain BROWSER too (nothing injected there) uses
      the token: `:root{--headtop:calc(env(safe-area-inset-top,0px) + 4px)}`
      and `padding-top:var(--headtop)` on its wrap — `scratchpad.html` is the
      worked example.
    - **The test derives its page list from `server.js`** — every
      `serveGated(...)` page is measured against 4/16, so a new page is in
      the test the day it is registered, before anyone remembers it exists.
      That, not the fix, is the half that stops the bug coming back: 39
      pages each got this wrong by faithfully copying the page next door.
      `node scripts/test-header-top.js`.
  - **A page with inner levels answers `window.__navBack`** — one in-page
    level per tap (a sheet shut, a story back to its shelf), then the web
    view's own history via `canGoBack`, then leave the tool. The chevron
    that asks is `pagehead.js`'s now rather than Apple's, but the contract
    is unchanged.
  - **A BACK CHEVRON, NEVER AN ✕ — and it is the same row every time (Aug
    2026, Sophie on the Story Room's shelf: "there's like an X to get out of
    it and a weird icon. I just want it to be a back button and no X … the
    header should be like normal it should say the shelf just like all the
    other pages have a header at the top. Make sure the pattern is
    consistent everywhere").** A page's own full-screen sheets are LEVELS,
    not dialogs, so each one wears the header the page wears: the back
    control in a 34px rounded box at the left, **the name centred**, actions
    at the right. Centre the name ABSOLUTELY (`left:88px;right:88px`,
    `translateY(-50%)`), never with `flex:1` — the two ends are different
    widths because the row reserves the pill's 56px, so a flex-centred name
    reads visibly off-centre. That is `pagehead.js`'s own `.fh` rule, and a
    page drawing its own sheets should copy it so the sheet and the row
    behind it are the same shape. `public/scratchpad.html` (the Story Room)
    is the worked example — one CSS rule over `header,.sheethead`.
  - **PURE-NATIVE tools (no web page — Test Station, Dump, Lessons, My
    Creations, etc.) still use `.forgeToolBar("<Tool title>")`**
    (ForgeNavTitle.swift): eyebrow title in the nav bar, back chevron
    top-left to the PREVIOUS screen (RootView keeps the screen history and
    injects `\.goBack`), per-screen actions top-right, NO in-content
    `StarTitle` rows (the Home grid keeps the serif masthead). There's no
    page to own a header there, so the native pattern stays right.
  - **APPLE'S BAR IS GONE FROM EVERY WEB-WRAPPED TOOL, NEW ONES INCLUDED
    (Aug 2026 v3, Sophie: "yes, definitely pick B … get rid of the apple
    native bar").** This bullet and the one under it used to say the
    opposite — a new tool ships with the native bar, and the tools that
    already had one keep it "until their next real redesign". That is
    history now, and **the stale wording is what left the Story Room
    behind**: it was still carrying a `.toolbar` chevron a week after every
    sibling had moved (Sophie, Aug 2026: "I made the impression that we had
    gotten rid of the Apple native header, but I think story room still has
    it cause there's a back Chevron"). Every web wrapper now uses
    **`.forgeWebToolBar(title, tint:, paper:, failed: loadFailed, back:
    navBack)`** — no bar while the page is up, the bar back for the failure
    screen, which has no page to draw one and would otherwise strand her on
    "Couldn't open …". `PlaygroundView.swift` is the reference wrapper.
    - Swift's one remaining job is LEAVING: `ForgePageHeader.install(into:
      onLeave:)` in `makeUIView` (BEFORE the web view is created — a user
      script added after misses the current load), and the coordinator holds
      the returned `ForgeLeaveHandler`, because `addScriptMessageHandler`
      does not retain.
    - `public/pagehead.js` draws the chevron into the page's own header row
      and walks `__navBack` → web history → `__forgeLeave`. It is injected on
      every gated page by `serveGated`, and self-gates on the bridge, so the
      web and the older build see no change at all.
    - The reason the old rule existed is still real and still binding: a new
      tool must MATCH the tools beside it. That now means no bar, not a bar.
      The Cutting Room v1 was flagged for shipping a bare host while its
      neighbours had bars; today the mismatch runs the other way.
    - Test: `node scripts/test-pagehead.js` (both builds, headless), and
      `node scripts/test-storyroom-header.js` for the three-state check on a
      page that draws its own sheets too.
  - **An icon-first tool carries a "?" circle (Aug 2026, Sophie).** When a
    tool's controls are icons with no words (her preference), add a small
    gold "?" circle that toggles a card explaining what each icon does —
    tap to show, tap anywhere to hide. The Cutting Room's `#help` /
    `#helpcard` is the pattern.

- **CSS gotcha that broke the Episode Editor's back button: `[hidden]` loses
  to any author `display` rule** (e.g. `.icon{display:flex}`), so the "hidden"
  button stays visible and taps do nothing. Every page that toggles the
  `hidden` attribute MUST carry `[hidden]{display:none !important}` in its CSS
  (editor.html has it; set.html always did).

- **A REPAINT NEVER REBUILDS WHAT DID NOT CHANGE (2026-08-28, Sophie, after
  the Story Room fix: "it seems like this shud be the automatic best
  practices").** The Story Room blinked because its render wiped the canvas
  and recreated every `<img>` on every call — and a poll called it every 4
  seconds. The same shape was then found live on THREE more pages (Freeform's
  pending card, Vector's cell grid, the Wall's whole feed), each written
  independently, which is what makes this a house rule rather than one bug:
  a recreated `<img>` decodes async on iOS, so the picture goes blank and
  pops back — a repaint loop over unchanged image DOM is a strobe.
  - **The pattern is a SIGNATURE SKIP, and the signature reads the SAME
    values the render draws** — never a dirty flag kept beside them, which
    can disagree with the screen. Build the string of everything the paint
    depends on (urls, labels, order, states); if it matches the last one,
    return without touching the DOM. The Story Room's `padSig`/`unitSig`
    (gen-scratchpad.py) is the worked example, including the second tier:
    inside a real rebuild, a UNIT whose own signature is unchanged keeps its
    DOM node, so one picture landing repaints one tile, not twenty.
  - **A kept node's closures outlive the data swap** (`items = d.items`
    replaces the objects they captured), so a kept tile's tap must resolve
    its record by id AT TAP TIME — never use the object captured at build.
  - **The guard is not a freeze**: anything that would change the screen must
    still repaint, which is why the signature and the paint read the same
    fields — add a drawn field to one and the other sees it by construction.
  - **Cheap state changes are class toggles on existing nodes** (a pick
    highlight, a working tint), never a rebuild — chats.html's `paintLive`
    and Vector's pick repaint are the pattern.
  - **Every page with a poll, a job tick, or a refresh-on-return gets this
    from day one.** The sweep and the four fixes: `node
    scripts/test-storyroom-blink.js` and `node scripts/test-noblink-repaint.js`
    — both assert NODE IDENTITY, the only honest question (a src assertion
    passes on a freshly recreated img every time).
- **NEVER serve a raw generated PNG to a page — ship webp display copies
  (Aug 2026).** gpt-image-2 writes 1024² PNGs at **~1MB each**, and a page that
  points straight at them is unusably slow on a phone. This was measured, not
  guessed: the Witch School Lessons tab served five ~1.1MB PNGs as small tiles
  (~5.8MB), one lesson's deck ran ~10MB, and the app preloaded the first card of
  all 16 lessons **at boot on the HOME screen** (~16MB) so the tab you'd just
  opened queued behind it. The same image as webp is ~50KB — **about 22×**.
  - **`node scripts/webp-assets.js [set]`** converts a Storage folder into a
    `…/webp/` folder beside it. It does **not resize** (the sources are already
    display-sized, so the whole win is the format and nothing is lost), and it
    uploads with a **one-year immutable** cache header — Firebase hands PNGs
    back as `max-age=3600`, so a repeat visit re-downloaded everything. Safe
    because a changed picture is a new id in these pipelines, never new bytes at
    an existing name. The originals are never touched; the generators keep
    writing them.
  - **`node scripts/webp-assets-verify.js` is the deploy gate.** It collects
    every image id the page can ask for and fails if any lacks a webp. There is
    deliberately **no PNG fallback** (a fallback would re-download the megabyte
    this removes), so a missing copy is a broken picture in a live lesson.
  - **A page must reach its art through a base + extension constant**
    (`SW_IMG` + `SW_EXT`), never a hard-coded `.png`, so one edit moves a whole
    set.
  - **Adding a new image set:** add it to `SETS` in `webp-assets.js`, add its
    page constant to the verifier's id sweep, point the page at the webp folder,
    run both scripts, then deploy. **Regenerating or replacing existing art:
    re-run both scripts before deploying** — a new card with no webp is a
    visibly broken picture.
  - Same idea as `scripts/selfcare-thumbs.js`, which does this for the sticker
    and stamp art.

- **A PAGE SHE CAN TYPE IN PINS ITS SCALE — never inflate the field instead
  (Aug 2026, Sophie, twice, on two different surfaces).** iOS zooms the whole
  page whenever it focuses a field under 16px. There are exactly two cures:
  raise every field to 16px, or pin the page scale with
  `maximum-scale=1, user-scalable=no` in the viewport meta. She saw both and
  settled it — "I would prefer not to have pinch [zoom] and for it not to be
  16 PX… now it's too big… I don't need pinch zoom" — so **the type stays her
  size and the page stops zooming itself.** The Chats app, the pad, the Story
  Room and the Writing Room already did this; it now holds across every page
  in `public/` that carries an input, a textarea or a contenteditable, plus
  the Compare templates (`renderTemplatePage`, and `compare.js` at runtime for
  the frozen hand-built pages).
  - She reported it on a date deck, then on the dream app's character field
    (14px) — one defect that any new page can be born with, which is why it
    is a TEST and not a fix: `node scripts/test-no-zoom.js` fails naming any
    page with a field whose viewport does not pin the scale.

- **THE SANS IS CAPS AND NOT BOLD — the SERIF is untouched by this rule (Aug
  2026, Sophie: "whenever this font is shown it should generally be
  capitalized and not bold", then, when it was read as universal: "that was
  supposed to stay bold actually — it's only that other font I don't like it
  when it's bold").** The rule is about `-apple-system` ONLY. Serif text
  keeps whatever weight it had; do not de-bold a serif element in the name of
  this guideline.** `-apple-system` is the app's LABEL voice — chat
  names, tabs, timestamps, Compare-row titles, chips — and it reads as caps
  at a normal weight with a little tracking (`.03–.04em`; caps set solid read
  as a block). The SERIF stays as it is: the masthead, a thread's own title,
  and message prose are not covered by this.
  - **Bold has to earn itself IN THE SANS.** A lit state that already carries a tinted
    background, a coloured outline or a sliding underline does NOT need
    weight on top — the account tabs, the category chips and the Chat/Assets/
    Compare toggle all had it and lost it. What kept bold: the tiny numbers
    inside the red answered badges (9–10px in a dot, where weight is
    legibility) and the hidden bar (it is the screen's one alarm).
  - **Caps cost width** — roughly a line per long string. A Compare title
    like "Cutting blocks v3 (s96) — punctuated, cut pile, maybe state" went
    from two rendered lines to three. Worth saying to her when a set of
    labels is long, rather than quietly shrinking the type.
  - **THE COMPARE + UPDATE ROW TITLES ARE THE SERIF, and that is her LATER
    word** ("I actually prefer the other font for the updates page and the
    compare pages"). They were the serif, went sans for one evening to match
    the Current/Superseded tabs above them, and she picked the serif back
    after seeing both — so this rule does not apply there at all: they read
    mixed case AND BOLD (600), exactly as they were before the sans evening. `test-chats-superseded` asserts the serif, so
    flipping it back has to be deliberate. **Two chats were editing these
    rows the same evening — check the newest instruction before changing
    them.**

- **THREE OPTIONS = A THREE-WAY TOGGLE, AND THERE IS ONE SHELL (Aug 2026,
  Sophie: "for things with three options, it shud be a three way toggle. add
  the toggle as a likely pattern where it applies. make a reusable three
  toggle shell so we can change the styling all at once. make color a per
  instance option. apply it to the few instances that already exists").**
  `public/tritoggle.css`, class `.tri`. Link it; never copy it.
  - **The contract:** `<button class="tri" data-n="0|1|2" data-i="L">`.
    `data-n` is the stop — ZERO-based and NUMBERED, which is the whole reason
    one rule serves four unrelated controls. `data-i` is the short word riding
    the knob; `attr(data-i)` with no attribute renders nothing, which is how
    the account switcher gets a blank knob out of the same rule.
  - **Per instance:** `--tri-track`, `--tri-knob`, `--tri-ink` (colour, the
    one she named), `--tri-w`, `--tri-k` (size), `--tri-inset`, `--tri-bw`,
    `--tri-fs`. A bare `.tri` IS the account switcher — 48px track, 18px knob,
    the rose `--chg`, a `--paper` knob — so the shell's defaults are not an
    invention, they are the original.
  - **Everything else is DERIVED and must stay that way** — `--tri-h`, the
    capsule `border-radius` and `--tri-gap` all fall out of the width, the
    knob, the inset and the border. This is the hairline rows' lesson applied
    to a second control: a new instance sets a width and is finished, and a
    fourth stop is one `[data-n="3"]` rule plus a wider track. The two
    hand-typed copies had EYEBALLED their gap (11.5 where the geometry says
    11) and one had the knob half a pixel off centre vertically — invisible,
    and exactly the kind of thing a derived value cannot get wrong.
  - **Where it lives now:** the Chats account switcher (bare), the
    Playground's quality and size (`--tri-w:78px; --tri-k:26px`, ink on
    paper), and the Chats search filters (muted at rest,
    the rose `--chg` when the filter is actually narrowing — which is what the
    per-instance colour buys).
  - **THE HISTORY, so nobody re-copies it:** it was `.swi` in `chats.html`
    and `.swtog` twice in `promptlab.html`, the second saying it was "LIFTED
    VERBATIM" in its own comment — three copies, two attribute
    names (`data-a` 1-based and `data-n` 0-based), two palettes, and the only
    thing that ever noticed a copy drifting was a test comparing two files
    property by property. `data-a` survives on the account switcher as a plain
    data attribute (it is the account NUMBER, which several readers want); the
    STOP is `data-n` everywhere.
  - **A stub test server has to serve `/tritoggle.css`.** express.static does
    it in production; a harness that does not renders the toggle as a 4px
    sliver, and three existing tests had to be taught this. If a toggle test
    starts failing with every stop at the same place, check that first.
  - **It stays the sanctioned exception to no-pills** — a toggle is not a text
    button.
  - Test: `node scripts/test-tritoggle.js` — nobody keeps a second copy, every
    page that uses the class links the file, and the geometry is MEASURED in a
    real browser at every stop for every instance (three stops that sit apart,
    evenly spaced, the last one parked symmetrically, the knob square and
    centred, the track a full capsule, and three different track colours off
    the one rule). The tolerance on "parked symmetrically" is 1.5px on
    purpose: the CSS calc works in the specified 1.5px border while Chromium
    lays out with a border snapped to whole device pixels, so the two disagree
    by up to a pixel at any DPR.

- **THE HAIRLINE ROWS' SLIDING LINE MEASURES ITS TAB — no row anywhere
  declares a tab count (Aug 2026, Sophie: "close it so it can't happen
  again").** The `.acctabs` pattern (two or three labels over a rule, the
  line sliding under the one she is reading) used to size the line as a
  PERCENTAGE of the row — a width per row class — and move it with a
  `translateX` step per slot. So the tab count lived in the CSS *and* in the
  markup, and the two drifted.
  - **How it drifted, because it was nobody's mistake and that is the
    point.** The Compare row was written against the two-tab rule on its own
    branch, correct as authored. A third tab (UPDATE) landed on main from
    another chat and made the shared rule 33.33%. The Compare branch merged
    **four minutes later** (`a576e08` → `38aa56e`, 2026-08-11): different
    lines, clean merge, no test failure — and the line sat a third wide under
    the middle of a two-tab row until she spotted it two days on ("the words
    in the middle and on the edge rather than under the line"). Measured at
    390px: SUPERSEDED's word at x=107 with the line at 195; CURRENT's at 283
    with the line at 312.
  - **So the count now lives nowhere.** `tabLine()` reads the `.acctab.on`
    element's real rect and writes `--tw` / `--tx`. Add a tab, remove one,
    change a padding: the line is still under the word, because it asked.
    It also retires the traps that rode with the percentage — the pill's 56px
    reserve (an abspos child resolves percentages against the PADDING box, so
    a row near the top needed `calc((100% - 56px)/N)`), and a tab made wider
    than its neighbours by a two-digit badge, which no percentage could ever
    follow. The reserve is still needed for the TAPS, just not for the line.
  - **Three things about it are load-bearing.** An unmeasured row draws NO
    line (`var(--tw,0)`) rather than a guessed one. The slide is switched on
    a frame AFTER a row's first measurement (`.tl`), so a screen opens with
    the line already in place and only a tap animates it. And the repaint
    must never write the style attribute unconditionally — the observer that
    drives it watches `style`, so an unguarded write is an rAF loop forever.
  - **A resize snaps and measures a FRAME LATER.** `resize` fires before the
    new layout is committed: measured 2026-08-13, a tab read inside the
    handler still reports its old width and the line lands one viewport
    behind (at 390 it kept 375's 140.75px). Anything asserting on the line
    after a resize has to settle a frame first — that is a real property of
    the mechanism, not a flaky test.
  - **Ported to every page that uses the `.acctabs` idiom**: chats.html (all
    five rows), voice.html (SPEAK · CHANGE), cuttingroom.html (TRANSCRIPT ·
    CLIPS, whose line is a real `.tline` span rather than an `::after`).
    **NOT ported, deliberately:** the witch app's `.ps-tabs` (its own visual
    system, one row in one file, and its count sits beside its markup rather
    than in a class shared across rows) and `chapters.js` (which already
    switches to a `/4` rule when a copy level exists). Both are fine; neither
    can drift the way a shared rule did.
  - Tests: `node scripts/test-chats-tab-lines.js` drives all five chats rows
    at 375/390/430 and asserts the line's real rect against the lit tab's,
    plus the no-line default and the no-loop guard. Verified failing when one
    row is put back on a fixed percentage (it reported the line 56–64px wide
    of the tab and 225px adrift). `test-voice-changer` and
    `test-cutroom-handoff` cover the other two pages.

- **Custom-icon sizing has TWO halves, and both were wrong for a long time —
  the numbers below are MEASURED off a real 3x screenshot, never reasoned
  about (Aug 2026, third attempt; the first two failed by reasoning).**
  - **Half one — the frame (`ToolGlyph.customFrame` = 1.11·S).** The old note
    here claimed "an SF Symbol at point size S draws only ~0.75·S of ink", so
    custom art was framed SMALLER, at 0.86·S. **That premise is false.**
    Measured on the home screen at declared S: `briefcase` 22.7w x 19.0h,
    `film` 24.0 x 19.0, `photo` 24.0 x 19.0, `bubble.left.and.bubble.right`
    28.0 x 22.3 — i.e. real symbols draw **0.90-0.95·S tall and ~1.13·S
    wide**, not 0.75. The hand-drawn glyphs measured 15.3pt (test tube) and
    15.7pt (quilt) against those, which is why Sophie kept seeing them as
    different sizes. Custom art fills 0.90 of its frame, so a frame of
    **1.11·S** puts its ink at ~1.00·S, inside the cluster the real symbols
    occupy. History: 1.35·S (far too big — the tubes read half again the size
    of everything), then 0.86·S (too small), now 1.11·S. **Only `ToolGlyph`
    may hold this number** — `ToolGlyph.asset(_:size:)` renders any bundled
    glyph, and a hand-picked frame anywhere else is how it drifts.
  - **Half two — the art. A bundled glyph MUST fill exactly 0.90 of its own
    viewBox, centred — run `python3 scripts/normalize-glyphs.py` after adding
    or editing one** (`--check` measures without writing; it's the gate). One
    frame rule is only correct if every glyph fills the SAME share of its
    box, and measured they filled **0.853 (quilt) / 0.923 (test tube) / 1.000
    (playground)** — `.scaledToFit()` scales by the longer side, so the
    Playground rendered ~17% bigger than the quilt at the same nominal size.
    No frame number can fix that; the difference is in the ART, so the script
    normalizes the art and leaves the Swift rule alone. An earlier pass got
    this wrong by measuring ONE glyph and assuming the rest matched
    (testtube.svg's comment claimed it filled "the same share the Playground
    glyph fills" — 0.923 against 1.000), which is why the script RENDERS
    every file and measures the ink instead of trusting any comment.
  - **How to check this properly next time:** take a screenshot of the real
    screen, find the accent ink with a colour test (`R-B > 45` — borders and
    background are near-neutral), group it into icons by column runs, and
    divide the bounding boxes by the device scale (3 on an iPhone 13). That
    gives every icon's true rendered size in points, custom and SF alike, on
    one comparable scale. It takes minutes and settles the question; two
    earlier attempts guessed instead and shipped wrong.

- **ONE home, with a shortcut row of FILTERS at the top (Aug 2026, Sophie —
  REPLACES the earlier three-home-screens rule).** The home is a single grid;
  above the module cards sits a row of five rounded squares, **icons only**
  ("just the icon" — no labels, `HomeGrid.shortcutRow` in `RootView.swift`).
  TWO are actions — the **house** (below) and **Chats** — and the rest FILTER
  the cards below (`HomeFilter`): **photo** = the picture-makers
  (Playground, Test Station, Freeform — the only place the Test Station has a
  card at all), **film** = everything that makes or cuts moving pictures AND
  sound, drawn as an ordered pipeline rather than a grid (see THE FILM CHIP IS
  A PIPELINE below), and a second film chip that draws the same set as one
  flat pile. **briefcase** = business and **quilt** = old fashioned are the
  same filters and live in the masthead corners only (see below). The lit chip
  clears back to everything when tapped again (the Dump sort page's
  convention).
  **THE HOUSE ON THE LEFT IS THE WAY BACK TO THE PLAIN GRID (2026-08-25,
  Sophie: "add a fifth tile on the home screen on the left, a picture of a home
  that just takes you back to the home grid thing").** Clearing a filter used
  to mean remembering which chip was lit and tapping that same one again — a
  way out she had to find first. The house clears it from anywhere, wears the
  bottom bar's own `house` glyph, and is **never lit**: it is an action like
  Chats, not a fifth filter, and a chip glowing on the screen's normal resting
  state is noise. `BusinessGrid`/`CraftsGrid`
  and `Screen.business`/`.crafts` are GONE; `deckfactory://business` and
  `://crafts` (alias `://quilt`) land on the home with that filter already
  lit. `Tool.isBusiness` / `Tool.isCraft` now decide which FILTER a tool
  answers to, and keep it off the unfiltered list so the default home stays
  scannable.
  **THE FILM FILTER HIDES ITS TOOLS TOO (Aug 2026, Sophie — she spotted the
  asymmetry: "the quilt hides the modules, but the movies tab doesn't —
  they're all still on the default home screen", then "leave the stuff off
  the home screen, just put it in the movie tab").** So `movieTools` is
  SUBTRACTED from the default grid exactly like `isBusiness`/`isCraft`, and
  the old `pinnedBottom` trio is gone with it — Voice Studio, Characters and
  Films were all film tools sitting at the bottom of the home list. Three
  deliberate exceptions to know before "fixing" any of them:
  - **The PICTURES filter is still a pure NARROWING**, not a hiding one:
    Playground and **Freeform** are cards on the default home AND under the
    photo chip (her ask, "put Freeform in the default"). Only the Test
    Station is filter-only there.
  - **Song Station has NO card anywhere** — off the default grid, out of the
    film set, and its tile removed from the web hub too ("get rid of song
    station altogether"). The `.song` case, its view and `deckfactory://song`
    are kept and `/song` still serves; it just joins the
    deliberately-unlinked pages.
  The default home is therefore SHORT on purpose — Lessons, Dump, Playground,
  Freeform, Review Queue — and everything else is one chip away.

  **THE FILM CHIP IS A PIPELINE, NOT A PILE (Aug 2026, Sophie: "right now
  there's so many movie tools it's confusing… my possible fix is changing the
  movies tab to a sort of pipeline that shows the order they're meant to be
  used in").** It is the one filter that does not draw a flat grid: it draws
  SIX NUMBERED STOPS, each with its name in the sans-caps label voice, one
  line of what happens there, a hairline, and that stop's tools as the same
  `HubCard`s every other slice uses — so a tool never looks like a different
  tool depending on which chip is lit. **`HomeGrid.pipeline` is the only place
  the order is written down and `movieTools` is DERIVED from it**, so adding a
  tool to a stage puts it in the tab, takes it off the default home and gives
  it a place in the road in one edit. The road, and the reasoning:
  1. **The story** — Story Room, Story Timeline.
  2. **The voice** — Search, Voice Studio.
  3. **The cut** — Cutting Blocks, Episode Editor, Cut Marks.
  4. **The polish** — Cutting Room, Pausing.
  5. **The pictures** — Characters, Movies, Dreams.
  6. **The shelf** — Chunking, Films.
  Stops 2–4 are `docs/audio-pipeline.md`'s road verbatim (blocks → word cut →
  exact cut → polish); the story stops sit in front of it and the picture
  stops behind, and **movies and sound interleave on ONE road** rather than
  sitting in two piles (her ask the same day: "group movies and audio
  together"). Four of these placements are genuinely arguable and were flagged
  to her rather than settled quietly — **Search and Voice Studio are
  TRIBUTARIES, not stages** (the audio doc draws them flowing *into* blocks,
  and both are also used at the very end), **Chunking is a shelf that is both
  an input and an output**, **Movies is a whole road of its own** rather than
  a stop on this one, and **Dreams** is arguably a picture tool that only
  lives here because `movies.js` owns it.
  - **Story Room CAME BACK into the film set** with that move ("move
    everything onto the movies page like the story boards…"), reversing the
    earlier "story room is no longer movies" — it is stop 1 and has no card on
    the default home any more. If she reverses again, it needs taking out of
    `pipeline` AND re-pinning at the head of `tools`.
  **Four corner icons** beside the
  masthead, Sophie's arrangement: test tube + briefcase LEFT, quilt + Chats
  RIGHT with Chats on the very end (its original spot). The briefcase and
  quilt corners fire the same filters as their row squares — several
  controls live in two places on purpose ("it can be in two places, silly"),
  so don't "fix" those duplicates. **The DUMP square came OFF the row (Aug
  2026, Sophie: "get rid of the dump button in the row at the top since it's
  now in the main home screen as the default")** — a shortcut to a tool whose
  card sits two inches below it stopped earning its slot once the film tools
  left and the grid got short. That is the one duplicate she did want gone;
  Chats stays in both places.
  **The squares are 60pt with a 26pt icon (Aug 2026, Sophie: "the icons are
  too small — they were set when there were six and now there's only five,
  make them fill out the space a little better").** 48 was sized for SIX on a
  375pt phone; five left a quarter of the row as gap. The arithmetic, so the
  next change needn't guess: usable row = width - 32, gap = (usable - 5 x
  side) / 4 — at 375 that is **10.8pt**, at 390 **14.5**, at 430 **24.5**.
  375 is the floor. It makes the row ~12pt taller and pushes the cards down;
  she said that is fine. `squareSide` / `squareIcon` in RootView are the only
  copies of those numbers.
  **They are SQUARES, and the lit state is a thicker gold outline over a
  light gold tint** (`Theme.accent.opacity(0.14)`, 2.5pt stroke, icon stays
  gold) — v1 stretched them into rectangles by sharing the row width out,
  and filled the lit one with solid `Theme.accent`, which Sophie read as
  "turning that beige color". A fixed-size square centred in an equal-width
  flexible cell is what keeps the shape on every screen width.
  **The set is not settled** — Sophie is still working out what the filters
  should be, so treat it as provisional, not as a rule. The filter icon must
  NOT be the generate star: that glyph is reserved for controls that spend a
  model call.


## Moved from CLAUDE.md (2026-09-14)

Moved here verbatim from `CLAUDE.md` on 2026-09-14 so that file stays readable;
CLAUDE.md keeps a one-sentence pointer per entry. Nothing was reworded.

### FILE THE MODEL · QUALITY · SIZE CAPTION

- **FILE THE MODEL · QUALITY · SIZE CAPTION on every image too (Aug 2026,
  Sophie).** The Assets tile's caption is the asset doc's `prompt` field — file
  it as a curated tag like `gpt-image-2 · medium · 2K` via
  `POST /api/gallery
  { assetsOnly:true, chat, url, prompt:"gpt-image-2 · medium · 2K", description }`
  **THE SIZE IS A REQUIRED THIRD SLOT, AND IT IS THE TIER (Aug 2026, Sophie:
  "1K 2K 4K should be a third slot in the model/quality required tagging, in
  the playground and in assets and Meta assets" — then, on the first cut, which
  wrote the raw canvas: "i asked for it to say 1k 2k or 4k").** The pixels are
  the FACT but the rung is what a caption is read for. `size-tier.js` derives
  the tier from pixel count (never a lookup table, so an unseen canvas still
  lands on a rung) and normalises on READ as well as on write, so records filed
  with `1568x2352` display as `2K` with no backfill. The exact canvas is kept
  beside it as `canvas`, because 2K portrait and 2K square are different
  canvases at different prices.
  **A PANEL CUT OUT OF A SHEET SAYS SO INSTEAD — `1/4 (4K)`** (Aug 2026,
  Sophie: "1/4 panel could say 1/4 (4k)"). Its own pixels are the wrong answer
  there: a quarter of a 4K sheet is 1168x1752, which lands on the 1K rung and
  reads as an ordinary small picture, losing the one fact that says what it is
  and what it cost. `cutSize(sheetCanvas, parts)` builds the slot, it passes
  through the normaliser untouched, and `scripts/panel-sheet.js` prints the
  file-ready caption for the sheet and for every piece. Model and quality alone answered the question
  while every surface here drew 1024x1536 and nothing else; gpt-image-2 takes
  any canvas, so the same prompt at the same quality now spans 5x in pixels and
  3x in price and the caption has to say which. It rides all three surfaces:
  the Playground writes `size` onto every creation it files, `post-to-gallery.js`
  takes `--size`, and `meta-assets.js` joins the three parts. **An absent slot
  is left out, never guessed** — nothing on an older record says how big it is,
  exactly as with quality.
  **A CAPTION A PAGE DRAWS ITSELF IS A FOURTH SURFACE, AND IT WAS MISSED FOR
  FOUR DAYS (2026-08-27, Sophie's screenshot of the Playground lightbox:
  "shud say quality and 1k,2k/4k · 1/4 — I thought we already fixed this").**
  She had, and this is the shape of the miss worth remembering: her ask named
  "the playground and assets and Meta assets", and every one of those was built
  as **what a picture is FILED with** — the creation doc, `post-to-gallery.js`,
  the Meta Assets join. But the **Playground page draws its own caption
  client-side out of the RUN doc** (`runParts` in promptlab.html), and that
  builder was never in scope: it had never carried a size at all, for a panels
  run or a plain one. The PANELS tab then added `panels 2x2` and `panel 4 of 4`
  to that same line, which is what finally made the missing required slot loud
  enough to see. **So when a caption rule lands, ask which surfaces DERIVE the
  caption rather than reading the filed one** — a filing fix cannot reach them.
  Swept the same day: the Playground was the only one wrong. Freeform, Meta
  Assets and iOS My Creations (`Creation.madeWith`) all carry the slot; the
  Assets tab and the Compare pages read the filed caption; Character Creator
  draws one canvas and has no tier to say; and the old `/gallery` page reads
  Storage custom metadata, which carries no model or quality either and falls
  back to the folder name — no caption there to be missing a slot from.
  **`/size-tier.js` IS SERVED TO THE PAGE NOW (the `pause-plan.js` pattern),
  so there is one derivation.** `runSize(run)` is the one reader for both
  shapes — a panels run is a cut of its SHEET (`1/4 (4K)`), anything else is
  its own tier — and a run whose cut FAILED is the sheet itself, so it takes
  the sheet's tier rather than a fraction of a thing that was never cut. A
  tier table copied into a page would drift from the boundaries the day they
  move. Pinned by `node scripts/test-playground-panels.js`.
  **AND THE CAPTION IS THOSE THREE SLOTS AND NOTHING ELSE (2026-08-27,
  Sophie's next screenshot of the same line, which by then read "Dreamy ·
  medium · 1/4 (1K) · 1:1 · panels 2x2 · uncut sheet · 2x2": "extra notes -
  dreamy etc … just need model quality and pixels + 1/4").** Six things, of
  which the caption's own three were the first three — the required slot was
  found by adding it beside five other facts rather than by making room for
  it. `lbCaption` in promptlab.html is the lightbox's own builder now:
  **the STYLE · QUALITY · SIZE and nothing else.** `runParts` is untouched and
  still tags the run's CARD with the ratio, the grid, `photo ref` — over a
  picture she is LOOKING at, the ratio and the grid are things she can see and
  the wording is behind the Prompt door. A LoRA run has neither a quality nor
  a tier and keeps its card tags.
  **THREE MEANS THREE, AND SLOT 1 IS THE TILE SHE DREW WITH (2026-08-27, her
  correction the same hour: "u added panel 2/4 and the chatgpt2 … get
  rid").** The first cut read her "model" as the model ID (`gpt-image-2`, to
  match what that picture's FILED caption says in My Creations and Meta
  Assets) and kept `panel 4 of 9` on the end as navigation — which one of the
  run she is looking at. Both were things that had not been on the line
  before, on a line she had just asked to be three: **the Playground's tiles
  ARE the models to her**, and the size slot already says a picture is a
  quarter. So the filed caption and this one disagree about slot 1 on
  purpose.
  **AND THE HARNESSES COULD NOT SERVE IT** — `scripts/lib/public-asset.js`
  answered out of `public/` only, so the three root-level shared files
  (`pause-plan.js`, `pad-characters.js`, `size-tier.js`) 404'd in every
  Playground harness, which is the quiet failure that file exists to end: the
  page guards the global it could not load, renders without that behaviour and
  the test passes. It serves them too now, from a list **derived from
  server.js's own `sendFile` routes**, so the next root-level shared file needs
  no harness change.
  (it upgrades an already-filed tile in place; search matches it).
  **AND A RE-POST CAN NOW CORRECT A CAPTION, WHICH IT COULD NOT UNTIL
  2026-08-23.** The write only landed on a BLANK or a generic `from <chat>`
  record, so re-POSTing to FIX one answered `ok:true, deduped:true` and
  changed nothing, silently — while this file promised it upgraded the tile in
  place. It was found backfilling older captions, and it is why every image
  filed before the third slot became the TIER was stuck showing a raw canvas
  that no chat could correct. One rule now, `assetGuard.captionUpgrade`, read
  by the route: **a curated caption always wins, including over another
  curated one** (nothing but a deliberate chat filing ever sends one, so
  curated → curated is someone fixing something), and **a `from <chat>` line
  never overwrites anything** — that is the hook's background catch, and the
  half the old rule existed to stop. Pinned by
  `node scripts/test-asset-guard.js`, which also fails if the condition is
  ever re-inlined into `server.js`. And when a
  style prompt has an author worth knowing — Claude's own text vs ChatGPT's vs
  Sophie's formula — name it in the description label ("style prompt by
  ChatGPT").
  **SAY THE QUALITY IN THE REPLY TOO, as a word, not "the default" (Aug 2026,
  Sophie: "she doesn't say what quality").** A delivery that says "quality
  copied from the function" or "at the usual settings" leaves her guessing —
  she assumed a medium sheet was high and asked for it to be re-run. Name the
  value (`medium`) and its rough cost in the message that hands over the
  image, every time. The caption is where she checks it LATER; the reply is
  where she reads it NOW, and both have to carry it.
  **THIS CANNOT BE BACKFILLED BY A LATER CHAT — file it when you make the
  image or it is gone (Aug 2026, measured).** A sweep of all 171 chats found
  **2,488 images, 1,938 with no quality caption**, and of those only **31**
  could be recovered honestly (their filed prompt happened to contain both the
  model and the quality). **1,320 had no filed prompt at all**, so nothing on
  the record says how they were made. Guessing a caption is worse than an empty
  one — it puts a confident wrong number in front of her forever — so those
  1,938 stay blank by design and NO chat should invent them. The only chat that
  ever knows an image's quality is the one that generated it, at the moment it
  generated it. If you are backfilling your OWN older images, derive the value
  from your filed prompt or your own run records; where neither exists, leave
  it empty and say so.
  **THE HOLE EVERY CHAT FELL IN IS CLOSED — the server unions by CONTENT HASH
  now (Aug 2026; the hole was found on the hospital film).** Images you send as
  chat FILES are auto-filed by the hook as `claude-deliveries/<random>` copies
  with no label and no quality caption, and the filename union could never join
  them to your captioned tile — so Sophie saw her portraits twice. The Assets
  tab now joins on the Storage object's md5 as well (see "dedupes by CONTENT
  HASH" in the Chats section, and `asset-union.js`), so a byte-identical copy
  collapses onto the labeled tile **by itself, whatever it is called** — no
  sweep, no cleanup, nothing to remember. Two things that still hold:
  - **Old records need the backfill before their duplicates merge** —
    `node scripts/backfill-asset-hashes.js --dry-run` then without the flag.
    A record with no `md5` on file still falls back to its filename.
  - **A RE-ENCODED copy is not the same bytes**, so no hash joins it (see the
    LABEL rule above). That case is still yours to avoid.
  The sweep below remains for the things no hash can recover — labels, MODEL ·
  QUALITY captions and filed prompts.
  **THE SWEEP IS ONE COMMAND NOW —
  `node scripts/sweep-asset-captions.js --chat <your chat slug>` (Aug 2026).**
  It pages the whole Assets tab and names every image short of a label, a
  MODEL · QUALITY caption, a filed prompt, or sitting there as an unlabeled
  `claude-deliveries/*` stray. **A chat that delivered images runs it on
  ITSELF before finishing the turn** — that is the only moment the missing
  captions can still be filed honestly. Default sweeps recently active chats,
  `--active <days>` widens it, `--all` is every chat, `--json` for a reader.
  It is READ-ONLY and stays that way (a test pins it): a caption a later chat
  invents is worse than a blank one — see the measurement above.
  **It does NOT ask a photo out of one of her own SOURCE LIBRARIES for a
  prompt or a MODEL · QUALITY caption (Aug 2026)** — the Dump, the crystal
  photos, her Midjourney exports (`asset-guard.js`'s
  `SOURCE_LIBRARY_PREFIXES`, ONE copy read by the sweep and the guard). Nobody
  typed words to make a phone photo and no model drew it, so counting those
  sent chats hunting something that never existed. A missing **label** is
  still a finding for them — and a Dump photo now arrives with one by itself.

### BACK TO THE TOP RIDES IN THE PILL'S RAIL

- **BACK TO THE TOP RIDES IN THE PILL'S RAIL (Aug 2026, Sophie: "add a small
  back to top arrow in playground when i scroll down. as well as other long
  scrolls like meta assets").** A small round button under the autoscroll
  pill, shown a full screen down, gone at the top — in the rail rather than
  floating loose, because that corner is the only one reserved on every page.
  It is not the pill's ▲ (which walks up gradually): it jumps, and stops any
  running autoscroll first. Source is `scripts/pill.py` (re-run
  `python3 scripts/gen-pill-inject.py` after editing); full rules in
  `docs/design-rules.md`, pinned by `node scripts/test-back-to-top.js`.
  **Its twin, TO THE BOTTOM, sits under it since 2026-09-03** (Sophie: "add a
  scroll to bottom arrow playground") — `#pbot`, lit while there is page
  below; `node scripts/test-scroll-to-bottom.js`. **It was the INJECTED pill's
  alone until 2026-09-13 (Sophie, on a Compare page in the app: "why is there
  no scroll to bottom arrow")** — a page opened in the app runs in an IFRAME
  and the pill she taps there is `mkPagePill`'s, the parent's copy, which had
  grown the back-to-top in Aug 2026 and never this one. So the jump existed on
  every page except inside the app, which is where she reads them. It is
  `.pbot` there (class only — chats.html's own pill owns the ids), the scroller
  learned an `end()` beside its `home()`, and one `syncTop` lights both off the
  same 150. Pinned by `node scripts/test-page-viewer-pill.js`.
  - **"IT'S NOT THERE" CAN MEAN THE PAGE IS OLD, NOT THAT THE ARROW IS
    MISSING (2026-08-27, Sophie about the Playground, twice).** Measured that
    hour before changing anything: the bytes Render answers with carry the
    pill VERBATIM, and the live html renders the arrow at her viewport with
    the iPhone 13's 47px safe-area inset — lit, 38px, tappable, in both list
    and tiles view. Nothing was wrong with the arrow. **The app keeps the
    three recent tools alive in a ZStack, so a wrapped page loads ONCE per app
    process and no deploy can reach it** — the Film Editor's round-three
    finding, arriving at the tool she is in most. The answer was the
    self-heal (see the Playground bullet), not a second arrow. **So when a
    shipped page feature is reported missing, check the SERVED bytes first
    and her page's age second — building it again is the one move that cannot
    help.**
  - **THERE IS A SECOND PILL AND IT DRIFTS — `mkPagePill` in `chats.html`
    (2026-08-24, Sophie on a Compare page: "the auto scroll doesn't work on my
    image prompt artifact so I can't scroll back up only down").** A Compare
    page opened in the app runs in an IFRAME, and iOS renders `position:fixed`
    unreliably inside one, so the pill she taps there lives in the PARENT page
    and scrolls the frame — a whole second implementation, which no pill
    resync and no `gen-*.py` touches. It had missed both of the shared pill's
    can't-get-back-up rules: it never grew a back-to-top at all, and a press at
    an END of the page did nothing rather than turning around. Both are fixed
    and both stand.
  - **AND IT NOW FOLLOWS WHATEVER IS ACTUALLY SCROLLING INSIDE THE FRAME
    (2026-09-02, Sophie: "why does autos roll not work in piles").** The third
    of the shared pill's rules this copy had missed: `mkPagePill` asked the
    frame's WINDOW for everything, so a page whose content scrolls inside its
    own box could not be moved by the pill she taps in the app — and a DECK's
    piles view is exactly that box (`flex:1; overflow-y:auto`). Measured at her
    viewport on the real rendered deck: **672px of piles below the fold, the
    frame's own document with NOTHING to scroll, and a tap on play moving the
    piles 0px.** The 2026-09-01 piles autoscroll reached judge.js's own little
    side-button only, which works — and is not the control she reaches for.
    It is `pill.py`'s own rule ported (`boxOK`/`findBox`/`tgt`): the window
    while the page itself has room, else the nearly-full-screen box under the
    middle of the frame (80% wide, 60% tall, so a note list or a filter drawer
    can never steal the pill from the page behind it), re-validated each call
    rather than hunted every frame. Play, the end-of-page flip, the
    back-to-top and its lit state all ask the same target. `openPage` also
    wires a **capture-phase** `scroll` listener on the frame's document —
    `scroll` does not bubble, so the window listener can never hear an inner
    box move and the back-to-top would stay dark. Test:
    `node scripts/test-page-viewer-piles.js` (the real `mkPagePill` over the
    real rendered deck template in a real iframe; verified failing 3 pre-fix).
  - **A LINK FROM ONE SERVED PAGE TO ANOTHER STAYS AN EMBED — THAT WAS THE
    DOUBLE PILL (2026-09-11, Sophie: "pill is double pill in some places · it
    was in light blue 3d button ward etc · y dies that happen always").** The
    viewer opens a page at `?embed=1` (no injected pill; `mkPagePill` in the
    parent drives the frame), and its click interceptor let a link to
    `/api/chatfeed/page/<x>` load in place AS WRITTEN — a scenes-index key is
    `/api/chatfeed/page/<belt>#j-<key>`, no embed — so the server dressed the
    belt for a browser and pill-inject ran INSIDE the frame under the
    viewer's own pill. Every page-to-page link did it, which is her
    "always". Two nets in `openPage` (chats.html): the click is rewritten
    onto the embed url with the hash kept (a hash-only hop on the page she is
    on is made on the frame's own url, no reload), and the load handler,
    finding `#vtop` in the frame anyway (a script navigation, an old cached
    page), stops the frame's scroller and HIDES its capsule with an
    `!important` stylesheet — never a removal, the injected script keeps
    painting those nodes — and blanks its hooks; the bar retitles to the page
    she is on. Test: `node scripts/test-chats-viewer-page-link.js` (verified
    failing 7 pre-fix).
  - **A RESUME GOES DOWN — SHE REVERTED THE `dir` VERSION (2026-08-26, Sophie:
    "it used to go down after I stopped it even if it was going up before. now
    it doesn't seem to do that" → "can you just revert that one change for the
    pill as well as the page itself").** #1618 also moved resume onto `dir`, so
    that pausing an upward ride and tapping again kept climbing; it was live for
    two days and she asked for the old behaviour back. So `vmid`/`vm`,
    `__scrollTap` and `pill._tap` are a hardcoded 1 again, in `pill.py`, in the
    five baked copies and in `mkPagePill` — the ▲ is how she goes back up, and
    **resuming on `dir` is HISTORY rather than a rule.** What survives from
    #1618 is the END-OF-PAGE FLIP inside `scrollStart`/`start`: a direction with
    no room flips to the one that has room, so a resume at the very bottom turns
    around instead of doing nothing. Don't collapse the two — they look like one
    change and only one of them was reverted.
  - **CHANGE THE PILL? CHANGE BOTH.** `scripts/pill.py` → regenerate →
    hand-patch the five baked copies (`chats.html`, `gallery.html`,
    `storyroom.html`, `wall.html`, `writing.html`) → and `mkPagePill`.
    `node scripts/test-page-viewer-pill.js` drives the REAL `mkPagePill` over
    a real iframe and `test-back-to-top.js` sweeps the baked copies. **Seven
    files, and only a test notices one left behind** — the resume revert had to
    touch all seven.
  - **THERE IS A THIRD PILL — THE NATIVE ONE — AND WHETHER IT DRAWS IS DERIVED
    NOW, NOT LISTED (2026-08-27, Sophie on the Characters page: "two pills").**
    `RootView`'s `AutoScrollPill` shows on every screen that has nothing else
    drawing one, and it used to decide that from a hand-kept BLACKLIST of tools
    whose page already carries one. Forgetting a tool is SILENT — the two
    capsules stack in the same fixed corner, offset by the native one's own
    padding, and "Fast" prints twice. It had been missed once already (Voice
    Studio, Aug 2026, and its own comment says so) and, measured the day this
    was fixed, **five more were still wrong: Dreams, Shop Report, Characters,
    Song Station and Films** — every one of them a page served with
    `{ pill: true }`. So the answer comes from `Tool.webPath` (which page each
    tool hosts) plus `forgePillPages` (every page that carries one — injected,
    or baked from `pill.py`), and `node scripts/test-native-pill.js` derives
    the real set from server.js and fails on drift **in both directions**: a
    page missing from the set draws two pills, a page listed that has none
    draws nothing and leaves her with no way back to the top. It also fails if
    a per-tool `if t == .x` opt-out grows back beside the derived rule. The
    only two that survive are not about a page: `.filmeditor` (one screen,
    never scrolls) and `.movie` while the Story Room is pushed inside it.
    **The fix ships with a TestFlight build, not a deploy** — until she
    installs one, the five above still show two.
  - **`.ptop` IS THE PILL'S OWN CLASS AND IT IS GLOBAL AND UNSCOPED — A PAGE
    THAT NAMES SOMETHING `.ptop` GETS A CREAM 38px CIRCLE (measured 2026-09-11
    on `/footage`).** Its back-to-top button is styled as a bare `.ptop{}` rule
    in `pill-inject.html`, so the Footage player's own top row — `.ptop`, a
    full-width strip holding the ✕ — drew as a **cream ellipse across the
    screen behind the ✕ on every clip she opened**. The page's own
    `#player .ptop` rule out-specified the width and the display and said
    nothing about the paint, so nothing on either side was wrong to look at:
    only a reading of the COMPUTED background found it, and no assertion about
    that row had ever looked. The row is `.pbar` now. **PHOTOGRAPH a page that
    injects the pill, and don't name anything `.ptop`, `.float`, `.vseg` or
    `#spd`.**
  - **The app's copy has no `id="ptop"` on purpose** — `chats.html`'s own pill
    owns that id and the sweep above counts exactly one per file; the viewer's
    button is `class="ptop"` only.
  - **THE PILL FOLLOWS WHATEVER IS ACTUALLY SCROLLING (2026-08-24, Sophie:
    "some surfaces scroll but have no to top arrow. like story room shelf").**
    Every check asked the WINDOW, so a surface whose content scrolls inside a
    full-screen sheet — the Story Room's shelf is `position:fixed; inset:0;
    overflow-y:auto` — looked to the pill like a page with nothing to scroll:
    no pill and no arrow, on the screen the tool now OPENS on. Measured with
    `elementFromPoint`: even a lit arrow was unreachable, because the sheet is
    z-index 40 over the pill's 9.
    - **The scroller ANNOUNCES ITSELF by scrolling.** `scroll` does not bubble
      but it does CAPTURE, so one capture-phase listener on the document hears
      an inner element scroll and takes `e.target` as the box; the window
      scrolling puts it down. No per-page hook, and no walking the DOM looking
      for scrollers on every scroll event.
    - **The PILL cannot wait for her to scroll**, so when the window has
      nothing to scroll `findBox()` asks `elementsFromPoint` at the middle of
      the screen — O(depth), and it finds the topmost overlay covering the
      viewport. A **MutationObserver** on the body is what re-asks, because a
      fixed sheet opening changes nothing the ResizeObserver watches.
    - **Only a NEARLY-FULL-SCREEN overlay is adopted** (80% of the width, 60%
      of the height): a note list or a filter drawer must never steal the pill
      from the page behind it. Adopting one LIFTS the pill to the box's
      z-index + 1 and putting it down restores the pill's own layer.
    - It ships in `pill.py` → `pill-inject.html`, so it reaches the 35 injected
      pages. The five BAKED copies still ride the window only — measured, none
      of them holds a full-screen inner scroller. Test:
      `node scripts/test-pill-sheet.js` (verified failing 4 pre-fix).
  - **A PAGE CAN KILL THE INJECTED PILL BY NAMING A VARIABLE, silently
    (found the same day, sweeping for the same report).** The pill's script
    runs in the page's global scope, so a page-level `let`/`const` sharing a
    name with one of its `var`s is a SyntaxError that takes the WHOLE pill
    script with it at parse time. `/search` had `let playing = null` and
    therefore no autoscroll, no back-to-top and an undefined
    `window.__scrollStop` — with nothing on screen saying so. `/cutmarks` had
    already been bitten and wrapped its page script in an IIFE (its comment
    names the bug), which is the fix; `/search` is renamed.
    **`node scripts/test-pill-globals.js` MEASURES it** — every injected page
    served the way `serveGated` serves it, loaded in a real browser, asked
    whether the pill's script ran. The page list is read out of server.js's own
    `{ pill: true }` calls, so a new page joins the sweep by opting in.
  - **THE PILL IS CONDITIONAL, SO OPT A SCROLLING PAGE IN AND STOP THINKING
    ABOUT IT.** 15 gated pages had no pill at all (the Dump, the Shop Report,
    Studio, Films, the dream archive, the desktop queue, Blog, Crystals…) —
    every one a page that scrolls with no way back up. They carry it now. A
    page that never scrolls shows nothing, so the only pages left out are the
    two that are deliberately one screen (`/filmeditor`, `/opinions`) and the
    five that bake their own copy.
  - **A page must not hand-roll its own** — `/chunking` carried a circle
    floating at the bottom-right, written before the shared arrow existed, so
    it had two back-to-tops in two corners doing one job (and a round plate,
    which the icon rule retired). Removed; `#ptop` is the one.

### THE CARET STAYS WHERE SHE CAN SEE IT

- **THE CARET STAYS WHERE SHE CAN SEE IT — `/caretkeep.js`, ONE FILE, EVERY
  PAGE (2026-09-08, Sophie editing a scene on the soap belt: "when i edit the
  text, the scroll position moves, so the cursor is under the textbox").**
  Every box she writes in is fitted to its own words and never scrolls itself
  (the Playground's bigger box, the belt's `fit`, the Chats app's script-block
  editor) — which is right for reading and is exactly what loses the caret: a
  2,000-character scene is a 1,500px-tall textarea, so WebKit scrolls the TOP
  of the box into view and the line she is typing sits under the keyboard,
  with nothing on screen saying why. Measured on her real soap page at 390x844
  with an iPhone 13's keyboard: the caret at the end of the scene sat at y=805
  under a keyboard starting at 430; with the keeper it lands at 380-404, just
  above it.
  - **IT ONLY EVER CORRECTS** — a caret already in the band moves nothing, and
    it never fires on a scroll event (that is her finger).
  - **THE WINDOW, NEVER `scrollIntoView`** — that walks every scrollable
    ancestor, and a belt card lives in a horizontally snapping deck, so one
    call would page her to another scene. The nearest box that really scrolls
    wins, else the window; a fixed sheet with nothing scrollable is left alone.
  - **THE CARET IS MEASURED**, in a hidden mirror wearing the box's own font,
    padding, border and width — counting characters is wrong on the first
    wrapped line.
  - **A FIT NEVER COLLAPSES THE BOX SHE IS TYPING IN (2026-09-14, Sophie:
    "huge text block bug · rapid movement · in footage · while typing").**
    The 2026-09-12 typing rule (an ordinary letter writes no style on the
    focused box — iOS answers a relayout of it by revealing the caret, the
    keeper corrects a frame later, and the two tick-tock) left the SHRINK
    road as it was: a Backspace, and every word iOS autocorrects
    (`insertReplacementText`, on the full road by design), set the box to
    `height:auto` to read `scrollHeight` and then wrote the real height back
    — so a 120-line scene stood at its floor for one layout with the caret
    somewhere else on the screen, every few words of a dictated scene, and
    the taller the block the bigger the jump. footage's `fitBox` now measures
    the words on a TWIN TEXTAREA (`fitHeight`: off screen, the box's computed
    type/padding/border, the box's width, emptied between fits) and writes
    the box only when the height really changed. A twin rather than a div,
    MEASURED: in Chromium a textarea wraps as if 2px narrower than a div of
    the same outer width, and a div mirror came back one line short on a real
    scene. Not seen in headless Chromium (no engine here reveals the caret on
    relayout), so the test pins the CAUSE — zero style writes and no `auto`
    on the box for a backspace and an autocorrect mid-scene, verified failing
    3 against the live page: 16 writes for four edits. `node
    scripts/test-footage-typing.js`, section 8.
  - **AT THE END OF A SCENE THE PAGE BORROWS THE ROOM IT IS SHORT OF**
    (padding on the scrolling element, given back when the keyboard goes):
    below the last line there is only the card's padding, so without it the
    one place she types most cannot be lifted over the keyboard at all.
  - **AND THE KEYBOARD IS NOT THE ONLY THING COVERING THE BOTTOM OF THE BAND
    — A PINNED BUTTON IS TOO (2026-09-13, Sophie's screenshot of a footage
    block: the ✕, the divide and the bigger-box buttons sitting ON the line
    she was writing, with "appearing on" unreadable behind them).**
    `stickybox.js` floats a tall box's corner buttons at the bottom of
    caretkeep's band — it ASKS caretkeep for it — and caretkeep lifts the
    caret line to the bottom of that same band, so the two landed on each
    other on every surface that carries both. MEASURED on the real footage
    page with the keyboard up: caret line 382–404, the pinned buttons
    372–398, `elementFromPoint` on the caret's own line answering the divide
    button, and **90 of 90 keystrokes** at the end of a scene typed under a
    control. Now `caretBand(el)` is the caret's own band — the visible one
    minus anything pinned over that box's column — and the two stack: the
    caret sits above the buttons, and at the END of a scene that lift brings
    the buttons' own corner back into view so they let go entirely. Three
    things not to undo: **`band()` itself is NOT narrowed** (stickybox reads
    it to decide where to pin, and a band that moved under it would ratchet
    the buttons up the screen a row per pass — that is why this is a second
    function rather than an edit to the first); **only a control in the
    BOX'S OWN COLUMN narrows it**, since a button floating elsewhere covers
    none of her words; and **stickybox tells the keeper when the pinned row
    MOVES** (`nudgeCaret`), because a button that pins in this pass lands on
    a line the keeper had already decided was safe — measured, without it a
    new line at the end of a scene left the caret 16px under the divide
    button until something else happened, and an unchanged row says nothing,
    which is what ends the loop.
  - **AND THE SAME BUG HAS A MIRROR AT THE TOP OF THE BAND — A STICKY ROW
    (2026-09-14, Sophie: "any other similar changes? bugs", audited after the
    fix above).** The rule above lifts a caret that has fallen BELOW the band;
    the other half of `keep()` LOWERS one that has risen above it, onto
    `band.top` — which is the visual viewport's own top and knows nothing
    about a row stuck to it. footage's **PROMPT fold row went
    `position:sticky` on 2026-09-13**, so typing in the top half of a long
    scene after scrolling down put her caret straight under it. MEASURED on
    the real page: caret line 10–33, the sticky row 4–33, and
    `elementFromPoint` on the caret's own line answering the **fold button**
    rather than her words; after, the caret sits at 39–62 and the line reads
    clear. **The bug was on the Playground, Voice Studio and Freeform too**
    (60/60, 59/60 and 29/60 keystrokes under a pinned button at the end of a
    long box, measured against the pre-fix modules) and the 09-13 fix, being
    in the shared file, already covered all three — re-measured, 0/60 each.
    `caretBand` narrows from BOTH ends now, and chrome narrows the end it is
    **NEARER**: no rule about safe-area insets, which is what an "is it at the
    top?" test cannot survive — in the app the row starts at the inset while
    the band still starts at 0. Three things not to undo: a **stickybox button
    is excluded from the sticky set and read live instead** (it goes fixed and
    back as she scrolls, so a set cached at find time remembers it as chrome
    long after it let go and has gone back to the box's corner — MEASURED as a
    band 77px short); the set is found **once per FOCUS by a bounded walk** —
    the box's ancestors' siblings plus body's own children, which is where a
    header lives — because reading every node's computed position on every
    keystroke is the churn the typing rule forbids; and **only chrome actually
    PAINTED on top counts** (`onTop`), or the Story Room's sticky header,
    which sits under its own beat popup at a higher layer, would lift her
    caret clear of something she cannot see. The injected pill is in the set
    and narrows nothing, because every box on these pages already reserves its
    column (measured: box x 25–316, pill x 324–374).
  - **compare.js loads it on the first focus**, so every Compare page ever
    posted has it with nothing re-posted; chats.html, the Playground, the
    Story Room, Freeform, Voice Studio and the Story Timeline link it. A new
    page with a box she writes in adds the one line. `data-nocaret` opts a box
    out. Tests: `node scripts/test-caret-keep.js` (the real belt shape headless
    — the caret measured against a stubbed keyboard, the deck proved not to
    have moved, and a caret already in view proved to move nothing) and
    `node scripts/test-caret-under-button.js` (the real footage page — every
    assertion a MEASUREMENT, since a caret lifted to the right number and one
    lifted onto a button look identical in the source; every keystroke and
    every new line counted rather than one settled reading, and the buttons
    proved still pinned and still tappable mid-scene; verified failing 7
    pre-fix, and 4 more against the bottom-only fix for the sticky-row half).

### THE WAY OUT OF A BIG BOX STAYS ON SCREEN

- **THE WAY OUT OF A BIG BOX STAYS ON SCREEN — `/stickybox.js`, ONE FILE,
  EVERY PAGE (2026-09-10, Sophie: "can we get a floating or sticky/pinned
  contract button for text boxes esp in footage so i can close with out having
  to scroll all the way down").** The corner toggle that opens a box is the
  same one that closes it and it lives in the box's BOTTOM-RIGHT corner — so
  the taller the box, the further the way out is from where she is standing.
  On `/footage`, where the big box has no ceiling at all (2026-09-10, "text
  box doesn't extend enough"), a 70-line scene put the contract button
  **1,649px down an 844px screen — measured on the real page** — so closing it
  meant scrolling the whole scene first. A marked button pins itself to the
  bottom of what she can actually see; the page's own toggle is untouched, so
  the same tap still means expand or contract.
  - **IT ONLY EVER CORRECTS.** While the button's own corner is on screen it
    is not touched at all, so a short box behaves exactly as it did — and it
    lets go the moment the corner is reachable again, and again once she has
    scrolled PAST the box, since a control floating over a page whose box is
    nowhere near it is worse than one she has to scroll to.
  - **THE VISIBLE BAND IS caretkeep's**, when caretkeep is on the page — one
    definition of what the keyboard is covering rather than two, and it
    carries the blind-keyboard guess for the web views that never report
    `visualViewport`. Without it: visualViewport, else the window. **It must
    stay `band()` and never `caretBand()`** — the keeper's own band is
    narrowed by whatever is pinned, so asking for that one here would walk
    these buttons up the screen a row per pass (2026-09-13; the caret half
    of that fix is the bullet above, and every move here tells the keeper).
  - **IT STAYS INSIDE ITS OWN REGION.** A box inside a sheet or any other
    scroller pins to the bottom of THAT box, never to the bottom of the
    screen, so a Story Room caption's button can never float below the card it
    belongs to.
  - **AND WHERE `position:fixed` WOULD NOT MEAN THE VIEWPORT IT DOES
    NOTHING** — an ancestor carrying a transform, a filter or `will-change`
    makes itself the containing block for a fixed child, so the arithmetic
    would put the button somewhere arbitrary. Bailing leaves the page exactly
    as it is today, which is the safe direction.
  - **IT KEEPS THE BUTTON'S OWN COLUMN** (footage's 56px in from the box's
    right edge, the injected pill's reservation) rather than hugging the box's
    corner: nothing jumps sideways as it pins, and a pinned button can never
    land in the pill's rail on a short viewport.
  - **CLOSING FROM A PINNED BUTTON BRINGS THE BOX BACK WITH HER** — she is
    standing at the bottom of a box whose top is a screen above, and shrinking
    it would otherwise leave her looking at whatever was underneath. The
    WINDOW only, never `scrollIntoView` (the caret keeper's own rule), and
    only when the page itself is what scrolls.
  - **Where it is:** footage, the Playground, Freeform, Voice Studio and the
    Story Room's caption and drawing-prompt boxes. A new box adds
    `<script src="/stickybox.js"></script>` and `data-stickybox` on its
    toggle — picked up present and future, so a button built in script needs
    only the attribute.
  - **THE FOOTAGE BOX KEEPS ONE WIDTH WHETHER THE PILL IS DRAWN OR NOT
    (2026-09-11, Sophie: "issue w footage textbox. switches back and forth
    between narrow (viewport - scroll pill), and full width. whyyy · related?
    cursor often covered by keyboard").** The pill is CONDITIONAL — its own
    sync hides it while the page is under one screen tall — and footage's
    `fitPillGap` reserved the pill's column only while the pill had a rect,
    so the box's WIDTH tracked the page's HEIGHT: a short feed, the caret
    keeper borrowing room under the keyboard and giving it back, the keyboard
    itself, a draft growing past the fold — each flipped the box 49px
    (MEASURED on the real page: 340 → 291 → 340) and re-wrapped the line she
    was typing, which is also how her caret landed under the keyboard after
    `caretkeep.js` had put it above (the two reports are one bug). `pillRect`
    measures the pill where it WOULD sit — shown for one synchronous
    measurement, invisible, put back before anything paints — so a row in its
    band keeps its width whether the pill is drawn this second or not. Still
    the pill's REAL rect (its top rides the safe-area inset), never a
    hardcoded band, and a page served with no pill still reserves nothing.
    The same shape lives in Freeform's and the Character page's `fitPillGap`
    and is NOT ported there — neither has a box she writes a scene into; port
    it the day one flickers. Test: `node scripts/test-footage-box-width.js`
    (every assertion a MEASUREMENT of the rendered box across the pill coming
    and going; verified failing 4 pre-fix).
  - **THE AUDIT SHE ASKED FOR — HER THREE GAPS AND FOURTEEN BUGS (2026-09-13,
    Sophie: "did u or could u do a good clean audit - any other bugs you find,
    or features that shud exist but dont now · ex, clearing individual
    separated boxes, sending two boxes at once, collapsing the prompt from
    partway down").** Three parallel read-only audits over the page, then the
    fixes. Her three:
    - **A ✕ IN EVERY BLOCK'S CORNER takes that block off** (`right:120`, drawn
      only with two or more — CSS off the same `.many` class the gold line
      rides). **This RETIRES the 2026-09-11 "there is no ✕ on a block on
      purpose" line**, which is history now, not a rule. It asks nothing: it
      banks the job exactly as `clear` does and the `undo` word puts it back
      (her rule — an undo instead of a confirm). Taking the FIRST block off
      moves the words below UP into `#prompt`, because every reader expects
      that node to stay the first block.
    - **THE ALL STAR IS GONE — SHE HAD IT TAKEN OFF (2026-09-14, on the note
      she left on the checklist item about it: "button is stipid get it
      out").** It shipped 2026-09-13 at her own ask ("sending two boxes at
      once"), corrected the same hour to ONE appended clip rather than N jobs,
      and lived a day. **This is HISTORY now, not a rule — do not build it
      back without her.** What went with it: the second star and its gold
      arm, the union strip (`allStrip`/`allJob`), its own priced estimate
      (`shapeKey`/`askAllCost`/`allFigure`), the over-$3 two-tap arm
      (`ARM_MS`/`ASK_CENTS`/`armed`/`disarm`) and the `job` override that
      threaded a whole job through `sendJob`/`postJob`/`offerDoors`. **The
      star sends the block she is in, and that is the only send on the
      page.** `refCounts` STAYS — the refusal's door words price off it too.
    - **THE PROMPT ROW IS STICKY**, so a long scene folds away from wherever
      she is standing. MEASURED at 390pt on a 40-line scene: at scrollY 600
      the row sat **521px above the viewport** with 1,836px of box below it
      and `elementFromPoint` answered nothing. It is `stickybox.js`'s
      complaint one direction round — those pin to the bottom of the band
      because the way out of a box is below her; this pins to the top because
      the way out of the panel is above her — which is plain `position:sticky`.
      **AND `fitPillGap` NOW JUDGES A STICKY ROW AT ITS STUCK POSITION**: the
      walk normalises rects into PAGE coordinates so a row does not change
      width as it scrolls past the rail, which for a sticky row put it at
      scrollY+10 — far below the pill's band — and REMOVED the reserve at the
      one moment the row was sitting in the pill's corner (caught by the test,
      not by reading). Judging it at its stuck top instead swapped the bug for
      its mirror — at rest the row is lower than that band, so the reserve was
      dropped standing still (caught by `test-footage.js`) — so **the band
      test does not apply to a sticky row at all**: a row pinned to the top of
      the viewport is inside a rail fixed to the top of the viewport for every
      scroll position that matters, and it reserves whenever it reaches into
      that column.
    The bugs, worst first — each one a state that really desyncs or words that
    really go: **a card's PUT-BACK overwrote her scene with no bank** (and an
    `undo` left from an earlier clear then restored a different job — the one
    visible control lying about what it does) **and replaced the whole strip
    without renumbering the other blocks' slot names**, so block 2's
    `[Image1]` named a picture that was no longer there and the clip still
    drew, of the wrong reference; **a TRIM orphaned every note on that clip**
    (`cardOf` repoints `video` at the first baked part, and both note doors
    keyed off it — her thread vanished off the card and the player and the
    card then wrote two different threads, against a comment claiming they
    were one); **the OPTIMISTIC CARD read the live `S` a round trip after the
    tap**, so switching project mid-send filed the clip under the new one,
    where a project-scoped poll could never fetch it — "drawing…" forever;
    **a TRIM on a clip reached through `… older` or the search never resolved**
    (the poll reads the newest 40 of the view, so the part stayed `baking`,
    its `save` never appeared, and the page re-read the whole collection every
    7s for its life) — fixed by `GET /api/footage/jobs/:id` and asking for the
    unfinished ones by name; **one failed read killed the poll outright** (it
    sat inside the `then`); **an EMPTY PROJECT hid `#feedbar`, which is the
    only project picker**, so naming a new project left her with no control to
    get back to All and a reload reopened the same empty one; **switching
    FOLDER left the previous folder's search answer standing**, so the page
    said "Nothing matches that." over clips that matched; **a card first drawn
    while a filter hid it got no "… more"** (the Playground's `resyncClamps`
    lesson through a filter rather than a view); **GRAB FRAME closed the
    trimmer and threw away her marks**, against its own "on the spot" promise;
    **the CHARACTER SHEET counted a keyframe**, so from the moment she marked
    a first frame every slot its line named was one too high (and `withLine`'s
    dedupe then missed, inserting the line twice); **a HAND-OFF left the
    previous seed in the box**, pinning a belt scene to another clip's seed;
    **a JOIN moved the gold line off a third block she was standing in**; **the
    boot never called `paintControls`**, so with `/status` slow or refused a
    restored draft's references were attached and INVISIBLE and a banked job's
    `undo` was hidden; plus the empty-feed line naming the wrong filter, the
    remove toast promising the whole clip back with parts still on it,
    `stepHead` leaving `#tall` lying about the mode, a cancelled "New folder…"
    sticking in the card's Move row, `#tgo` re-enabling mid-flight, the upload
    tally counting uploads rather than attachments, `ftUploading` having no
    `finally` (a throw there would have disabled the self-heal for the life of
    the page), and the folder being unsearchable.
    **AND THE SEVEN THAT WERE NAMED AND LEFT ARE FIXED TOO (2026-09-13,
    Sophie: "good. real bugs. can u fix them all? use agents if u want / then
    find more").** Worst first:
    - **`mark → unmark` NEVER PUT THE RETURNING PICTURE'S NAME BACK** — the
      only one that could send a job she did not mean. A keyframe leaves the
      reference list, so the mark deletes its `[ImageN]` out of her words and
      the POSITION of that name goes with it; unmarking renumbered the others
      and left nothing naming the one that came back, so the clip drew a
      reference short with its thumb still on screen. Inserting the name at
      the end of the box would be writing words where she did not put them, so
      **the words are BANKED at the mark** (the Playground prompt-extra box's
      rule): the text before the rewrite, the text after it, and the strip as
      it stood, renumbered back through `reslotBlocks`'s own arithmetic. The
      restore fires only while the block is **byte-for-byte what the rewrite
      produced** — anything she typed since wins outright — and the bank is
      spent either way, so a stale one can never fire later.
    - **THE WALL'S SIGNATURE IS PER CELL** (`tileSig`). It was one string for
      the whole list, so one clip finishing re-decoded every other poster; a
      cell whose poster, status and ratio are unchanged is REUSED now, and
      putting it back in order MOVES the node, which never re-decodes the
      picture in it. The list signature stays as the fast path.
    - **`… older` HAS ITS OWN CURSOR, `walkAt`** — the bottom of the contiguous
      walk, never the oldest thing in memory. A search ADDS up to 300 hits
      from anywhere on the log, so after searching and clearing, the cursor
      was a clip from months back and the next tap skipped every page between.
      And the cursor is the **smallest sentAt in an answer** (`minSentAt`),
      never its last element.
    - **A SEARCH PAST THE CAP IS PAGEABLE** — the door stays and says `… more
      matches`, walking the search's own pages off the oldest hit's sentAt
      (`qAt`), unioned into `qHits` so nothing already shown leaves. The route
      has always answered `more`; the page hid the door on the reasoning that
      "a search already read the whole log", true only while it fits.
    - **AN EXPANDED PROMPT SURVIVES A REBUILD** — `openPrompt`, in memory,
      keyed by the clip's own id (the chats part-fold's rule) and never
      localStorage, so a reload collapses everything.
    - **AND SO DOES HER CARET** — removing a node blurs what was focused in it,
      so a rebuild mid-sentence left the box on screen with the keyboard gone;
      the focus and the selection are carried across with the node. And
      **Cancel clears the mark she can SEE** (`noteMark(el)` asked when it is
      needed, never captured — the captured one is detached after a rebuild,
      so Cancel put `on` out on a dead node and the live mark stayed lit).
    - **FOUR ACROSS: THE ♥ AND THE ▶ ARE OFF EACH OTHER.** MEASURED at 390pt:
      four across is ~86px wide, so a 16:9 clip is 50px tall and the 26px
      marks at `bottom:4` ran y 18-44 while the 28px doors sat centred at y
      10-38 — 71% overlap both ways, and a tap on either was a coin toss
      (`elementFromPoint` answered `tmark heart` at the ▶'s own centre). Four
      controls cannot share one row at that width, so **a measured `.short`
      class (under 64px) puts the doors in the TOP band and keeps the marks in
      the bottom**, both at 22px: doors y 1-23, marks y 25-47. **The note's
      WORDS give up their band** — they would sit under the doors, and at 86px
      the strip showed about eight characters; the whole note is on the card.
      **The scissors stays**, because "even in the tile view" is her own ask by
      name: the strip moves to the bottom and centres, into the 38px between
      the two marks. **And 21:9 gets a 52px FLOOR** (measured 38px),
      because no geometry fits two bands in 38. The alternatives were shrinking
      every control under the tap floor, or a min-height that crops a third off
      every landscape poster. `SHORT_TILE` is MEASURED rather than derived from
      the ratio and the column count, since the height falls out of the page's
      own width.
    **AND THREE READ-ONLY AUDITS FOUND 36 MORE (2026-09-13, her "then find
    more") — the server module, the page's player/trimmer/cast areas, and the
    shared slot-name and search files. The ones that cost money or draw the
    wrong clip are fixed; the rest are named at the end of this bullet.**
    - **2.0 AT 1080p WAS PRICED OFF THE 480p CANVAS — a 5x under-quote that
      read CHEAPER than 720p.** 2.0 moved onto the 2.5 canvas table on
      2026-09-12 (a real charge measured 560x752), and that table has no
      1080p row, so `canvasOf`'s `fam[res] || fam['480p']` fell through: a 4s
      2.0 1080p 16:9 clip quoted **~30¢ against a real ~151¢**, and $1.11
      against ~$5.67 at 15s. 2.0 is the one row that offers 1080p and only
      OpenRouter takes it, which bills on the real canvas. A resolution its
      own table lacks falls back to the FAMILY's now (`canvasFrom` says
      which), and a borrowed canvas can never answer `exact`.
    - **A REFERENCE THE MODULE WILL NOT SEND REFUSES THE JOB — it is never
      dropped.** The http filter ran BEFORE `slotsOf`, so a url failing it
      vanished and every slot after it renumbered while her prompt named the
      old numbers: the clip drew, of the wrong picture. A keyframe was worse —
      a url that failed the test simply stopped being a keyframe, so the
      picture she marked as the first frame rode as an ordinary slotted
      reference and the job went out references-only.
    - **A REFUSED JOB SPOKE A SECOND VOCABULARY.** It was filed under the
      model's LABEL and under `params.ratio` where every door writes its own
      model id and `aspect_ratio` — so `cardOf` found no model row, and the
      page gates its own "Try again" on `modelOf(j.model)`: **a refused Fast or
      2.5 scene put back from its own card silently drew on MINI** (the model
      is deliberately unsticky, so after any reload that is what is showing).
      `cardOf` matches our own id as well as the doors' three spellings now.
    - **A JOB THE DOOR NEVER ANSWERS FOR STOPS BEING "DRAWING".** Nothing aged
      one out — `pollOne` swallows every error — so a job with an expired id or
      an unmapped answer said "drawing… 4h" forever. That is not only a wrong
      card: `/jobs` reads the WHOLE collection (~500 docs) and the page
      re-arms every 7s while anything is drawing, so **one stuck clip cost ~70
      document reads a second** for as long as the page was open. Two hours
      with no answer reads as failed and the poll stops asking, `whyOf` says
      so in her words, and **nothing is written** — the doc is left as the
      door left it, so a job that lands later is still the record.
    - **A PARTIAL ATLAS PRICE READ dropped that model to the table's LIST rate
      for ten minutes** — the guard protected an EMPTY answer, not an
      incomplete one — and since the door is chosen by price that is a door
      change as well as a figure: every Mini tap billed ~3x (13.59¢ against
      4.40¢), silently. Merged onto the last good map now.
    - **EVERY TRIM WRITE IS PINNED TO THE READ IT WAS PLANNED FROM.** The route
      read the doc, planned, and wrote the whole `trims` list, so a bake
      landing its own `ready` in between put that part back to `baking` for
      good: its mp4 and poster in Storage, the card saying "trimming…" for
      ever, its save and play never appearing. One transaction per call.
    - **AN OVERSIZE REFERENCE VIDEO WAS DIAGNOSED AS "TOO SMALL".** ByteDance
      sends the SAME sentence for both ends of the range, and the one row said
      "too small … the page upscales these by itself now; send it again" — so a
      4K reference was told the fix was already in and re-sent forever
      (nothing downscales, and `planUpscale` returns null above the floor by
      design). Three rows now: the floor, the ceiling, and the bare range
      sentence naming both ends.
    - **THE REFUSAL TABLE'S `code` COLUMN WAS DEAD** — the reader asked for
      `d.errorCode` and the doors' field is `error_code`, so an unmatched
      wording showed raw door text with no line in her words. Either spelling.
    - **A LOOK THAT OWNS A MARKED PICTURE ATTACHED IT TWICE.** The planner is
      fed `slotRefs()` (marked pictures excluded, which is what keeps the slot
      numbers right), so a look whose own references include the still she had
      marked as the first frame got it appended as an ordinary `[ImageN]` and
      her marked copy spliced back in on top: two tiles for one picture, and
      the line named a slot `slotsOf` gives to a DIFFERENT one. Her mark wins,
      and the line is re-resolved against the strip that really rides — a
      `{n}` pointing at a keyframe names the END ("in the first frame")
      rather than leaving a raw `{2}` in her prompt.
    - **`newer ›` STEPPED PAST THE CLIP THE PANEL WAS OPENED ON**, so the whole
      diff rendered backwards: her added words read as struck-out deletions
      and the settings rows read `12s → 8s` when she went the other way. The
      stop is b's own index.
    - **SAVE-ALL WAS A DEAD BUTTON AFTER ONE FAILED FETCH** (a resolved-null
      promise cached forever, while the toast said "tap again in a moment"),
      and outside the app its first tap always failed and blamed the share
      sheet — `navigator.share` was called after awaiting the bytes, which
      spends the tap's transient activation, the trap `primeSave` was written
      for. Not-ready is answered before the await now.
    **AND THE TOP THREE OF THOSE ARE FIXED — the ones that cost money or draw
    the wrong clip (2026-09-14, Sophie: "what's next").**
    - **A KEYFRAME TAKES NO SLOT, AND `POST /api/cast/plan` DID NOT KNOW IT.**
      `castLine.plan` numbers the slots over the strip it is handed and
      `slotsOf` SKIPS a marked picture, so planning over the RAW strip
      numbered every slot after a mark one too high: the line a chat got back
      named a picture that is not there, and **the clip still drew**. The page
      had learned this on 2026-09-13 and **kept the whole rule to itself**,
      which is exactly why the door a CHAT calls went on getting it wrong. It
      is `castLine.planMarked` now — ONE rule, both callers, and a source pin
      that the page keeps no copy (`withMarks`/`castLine` are gone from it).
      Three halves, each measured: it plans over the PLAIN strip; it puts the
      marks back where they were (`plan`'s own `refs` would DELETE them, and a
      look that OWNS a marked picture must not attach it twice — her mark
      wins); and a `{n}` pointing at a marked picture **names the END** ("in
      the first frame") rather than leaving a raw token. The marks ride in as
      `first`/`last` or `firstFrameUrl`/`lastFrameUrl`, since a chat holds one
      spelling or the other. With no mark, `planMarked` IS `plan`, byte for
      byte.
    - **A RENAMED WARDROBE LOOK KEY IS NAMED NOW, NEVER SILENT.** A `wear`
      spec whose entry or whose LOOK KEY has been renamed pushed nothing at
      all, so the pajamas did not ride and the line's `{2}` went out as a
      literal `{2}` — a patient with no pajamas, nothing on screen saying so.
      **Leaving the token alone is still right** (a line that lost a reference
      must read wrong rather than read fine and send one slot short) — what
      was missing is that nobody was told. `plan` answers `missing` (the spec
      and why) and `unresolved` (the tokens still standing), the tap names it
      **in the ONE toast it raises** (a second `toast()` call would simply
      overwrite the first), and **`buildJob` REFUSES a prompt carrying a
      `{n}`** — free, before anything draws, naming what to fix. She never
      types those (she taps a character), so it can only ever be this bug.
    - **`doorTakes` MODELS ATLAS'S OWN CAPS.** At most 9 reference images, 3
      videos and 3 audios, and a reference audio needs a picture or a video
      beside it (atlascloud.js's own numbers, pinned equal by the test). Atlas
      refuses on the POST, free — but **AUTO ranks Atlas FIRST for Mini and
      Fast on its 80% sale**, so a ten-picture job went to the one door that
      must refuse it and the page offered no other. The counts ride the shape
      (`images`/`videos`/`audios`), the page sends them with the estimate so
      the price line is the real door, and `startJob` counts the PLAIN strip —
      a keyframe never among them. **A caller that only says `hasRefs`
      behaves exactly as before**, which is the safe direction: never refuse a
      door for a cap that cannot be seen. OpenRouter's and APIFRAME's own caps
      are UNMEASURED and are deliberately not modelled. A cap refusal is a
      SHAPE refusal, so it is never offered back to the same door.
    Tests: `node scripts/test-footage-audit-4.js` (45 checks, pure plus source
    pins; verified failing **36** pre-fix) and the wardrobe half of
    `node scripts/test-cast.js` (102 now — the real page headless, the token
    MEASURED still standing in her box and the toast MEASURED naming the
    wardrobe, since a plan that reports the miss and a page that says nothing
    about it look identical in the source; verified failing 2 pre-fix). Two
    tests were RED ON MAIN and are repointed rather than left: #2367 turned a
    dropped keyframe url into a refusal and left `test-video-keyframes.js`
    pinning the drop, and the two page pins in `test-footage-audit-3.js` plus
    one in `test-footage-blocks-audit.js` quoted the page code that moved into
    `cast-line.js`.
    **THE FOURTH ROUND (2026-09-14, Sophie: "audit footage for bugs and
    missing features") FIXED ALL BUT ONE OF THE FOURTEEN NAMED BELOW AND
    THIRTY-FOUR MORE — three read-only sweeps again (the server, the prompt
    panel, the feed and player).** The ones that cost money or drew the wrong
    clip: **a put-back doubled CHARACTERS and SETTING** — `j.prompt` is the
    text that WENT, heads on top, and `copyBack` landed it in the scene block
    while the two head boxes still held their own copy, so every "Try again"
    and every re-roll since the heads landed sent the cast and the room twice
    (the current heads' prefix comes off on the way back in); **the All star's
    price ignored the reference COUNTS** and **sent with no figure at all**
    when the estimate had not landed (both fixed, then the button itself was
    removed a day later at her word — see THE ALL STAR IS GONE above);
    **a refusal's door words outlived the job** (nothing hid `#err` on clear, undo, a put-back or a project switch,
    so a word tapped later re-sent words no longer on the page, and priced
    off the LIVE controls) — the line has a ✕, dies with the job, and a door
    word re-sends the exact BODY that was refused; **`reslotPlan` forgot one
    vanished slot name** where a join can take two; **a lone block could be
    left `shut`** with no heading to open it (the page showed no box at all);
    **"New folder…" from a project she was only looking at** made it in the
    one she was standing in; **the heads are per PROJECT now**
    (`footage_heads`, keyed by project — switching films rode the last film's
    cast onto every clip). Server: `/status` handed out her three balances
    unauthenticated (only with the token now); **a trim REPLACE onto a span
    another part already held wrote nothing** and told the page the part was
    gone; **a poster that missed its one bake was never baked again** (tried
    once per process on every read now, and the bake rides `gateTrim` — it
    decoded outside the queue); vote/project/hide on a wrong id CREATED a doc
    that read as drawing forever (they `update` and 404); a pair of long
    reference videos on AUTO died on Atlas's 15.2s cap with two doors open
    (walks off Atlas, card says so); a failed OpenRouter discount read wrote
    full list over a good sale (merges, `null` for "could not read"); the
    pause is checked inside `startJobInner` and, like every refusal footage
    raises itself, LOGGED; a door whose log write fails retries once and
    answers `logged:false`, which rides the card's note; kin reads one
    project; the shelf cache empties on every write; balances keep the last
    good figure per door; `pageJobs` breaks a `sentAt` tie by id and takes
    `beforeId`. Page: a pick opens the NEWER clip as "this clip"; the server's
    search hits are a floor, not a ceiling; a `baking` part over 15 minutes
    old is dead, not working (the poll stopped re-reading the whole
    collection over it); the compare panel never diffs against a hidden or
    failed clip and holds the self-heal; a refused move or mark goes back; the
    emptied line counts the VIEW; the save bank holds one clip's parts and
    revokes its object urls; her notes are in the client-side hay;
    `cleanFootage` passes `firstFrame`/`lastFrame`/`blocks`/`project`/
    `folder`. Test: `node scripts/test-footage-audit-5.js` (67 checks, pure +
    source pins + the two money bugs headless). **STILL NAMED AND NOT FIXED**:
    `caretkeep`'s blind-keyboard band; footage's player keeps native
    `controls` under `/filmnote.js`, so a tap on the native scrubber toggles
    play (the other two hosts use `/filmbar.js` — a transport decision, hers);
    no cancel for a drawing clip, no delete (only `hidden`, and no control on
    this page sets or clears it), no spend by project, no compare mark on the
    tile wall, `… older` walks the feed not the funnel. `test-timeline.js`
    and `test-atlascloud-video.js` are RED ON MAIN independent of this
    (an embedded header-band measurement; a `retry` pin tripped by the
    billing reader's `Retry-After`).
    **The fourteen as they were named on 2026-09-13** (thirteen fixed above;
    `caretkeep` stands): the server's search does not fill `projectName`, so
    searching a
    project's display name shows hits and then blanks them;
    `… older` skips clips that share a `sentAt` to the millisecond;
    the draw-time buckets double-count a clip with no ratio; a 40+ character
    film slug can never be tucked (two truncation lengths); footage's own
    shape refusals are the ones that leave no log; taking a part off resets
    her trim marks; an armed "pick a clip" survives a project switch and
    swallows the next tap; the trim marks are the only playhead controls that
    do not pause; no `error` listener on the player leaves a whole dead trim
    row; a note on a reference VIDEO is filed where no card shows it;
    `viewswitch` is a dead control with localStorage blocked; `caretkeep`'s
    blind-keyboard band can scroll a caret that is already visible;
    `clip-diff`'s `tail()` blanks any readable filename over 20 characters;
    Atlas's spend cache key includes `fresh`, so `?fresh=1` writes a key
    nothing reads. Tests: `node scripts/test-footage-audit-3.js` (34 checks;
    it CRASHES against the pre-fix module, where `canvasFrom` does not exist).
    Tests: `node scripts/test-footage-blocks-audit.js` (55 checks; it CRASHES
    against the pre-fix page, where `#goall` does not exist) and
    `node scripts/test-footage-audit-2.js` (71 checks for the seven — every
    assertion a MEASUREMENT or a reading of what the stub really received,
    since an unmark that renumbers the others and names nothing, a wall that
    re-decodes every poster, a cursor taken from memory, a capped answer, a
    prompt springing shut, a box with its keyboard gone and two controls
    sitting on each other all look identical in the source; verified failing
    30 pre-fix).
    **AND A CLIP SHE JUST SENT IS NEVER FILTERED AWAY (2026-09-13, found on her
    "check for more bugs").** The search's `qHits` is a set of ids the SERVER
    answered with, so a clip that did not exist when it answered can never be
    in it: with a search standing, a send was posted, charged and drawn while
    the feed went on showing only the old hits — **nothing on screen said a job
    had started**, which is how a clip gets paid for twice. The ♥/✕ marks and
    the funnel do it too (a brand-new clip has no vote, and its model may not be
    the one she is filtering on). A clip THIS PAGE sent now rides through the
    search, the marks and the funnel until she next MOVES the view — any change
    to the search or a filter is her re-deciding what the list is, and from then
    on it obeys like everything else. The PROJECT and the folder still apply:
    the card carries the ones it was sent under, so it passes them by
    construction, and a clip must never show in another project's feed. And it
    is **SAID, not done quietly** — the toast adds "shown here though it is
    outside your search", since a card in a feed her own search says nothing
    matches would otherwise read as the filter broken.
    **AND HER OWN MARK ON A CLIP ENDS ITS SHIELD (2026-09-13, Sophie: "exed
    clips in list view don't disappear when no x is selected").** The shield is
    for while she WAITS; a ✕ is her deciding. Only a search or a filter tap
    dropped it, so with "hide the ✕'d" lit she crossed out the clip she had
    just sent and it stayed on screen — in BOTH views, for the rest of the
    session (MEASURED). `castVote` drops that clip's shield, so the mark and
    the filter agree at once; **every other clip she just sent still rides**,
    since the shield is per clip. A ♥ ends it too — un-marking a clip is her
    deciding as deliberately as marking one. Pinned by
    `node scripts/test-footage-just-sent.js` (verified failing 2 pre-fix).
    **AND TWO MORE FROM THE SAME PASS**, both on the All star and both gone
    with it a day later (see THE ALL STAR IS GONE): it stayed at full
    strength while a send was in flight and did nothing on a tap, and an
    armed "send all · $x?" survived a FOLDER switch. **The live-looking
    button is the lesson that outlives them** — `#go` is the gate and greys
    itself (`button[disabled]{opacity:.45}`), and a button that looks alive
    and answers nothing is the shape of every "it didn't work" report. Test:
    `node scripts/test-footage-just-sent.js` (verified failing 4, then 2, on
    the pre-fix page).
    **AND `test-footage.js` IS FLAKY — MEASURED, so do not read one red run as
    a regression (2026-09-13).** Run on clean main it failed one assertion
    twice and passed twice, and the failing assertion DIFFERED between runs
    ("picking the ward re-asks the feed FOR the ward", "bare words AND a
    -\"phrase\" take one clip out"). Re-run before diagnosing anything, and
    check whether the same assertion fails twice. Which of its 425 is timing-
    dependent is unfound; re-measured 2026-09-13 the rotating one is any of
    three, all in the project/search area ("bare words AND a -\"phrase\" take
    one clip out", "picking the ward re-asks the feed FOR the ward", "on All
    the ward's clips are gone from the list and the wall"), which is what
    makes the same-assertion-twice check the honest test. **The MECHANISM is found (2026-09-13), even if the
    exact set is not: the search and project assertions wait with
    `waitForFunction` on a COUNT of visible cards, which is true for a moment
    of the CLIENT-filtered view — and the server's own answer over the whole
    log (the older pool included) lands a beat later and can change the set, so
    the read after the wait catches whichever state it finds. A wait that
    settles on the server's answer rather than on a transient count is the
    fix; not done here.**
  - **AN ORDINARY KEYSTROKE IN THAT BOX TOUCHES NO STYLE (2026-09-12, Sophie:
    "every other character moves textbox").** Two things ran on every
    character with nothing on screen changing: `fitBox` rewrote the focused
    box's height (`auto` → px) and its wrap's min-height on every input, and
    `fitPillGap` — on every document resize, i.e. every wrapping keystroke
    and the caret keeper borrowing room — zeroed every row's reserve and
    forced a layout to measure it, laying the box she was typing in out at
    full width and back inside one task. iOS WebKit answers a relayout of the
    focused textarea by revealing the caret (a scroll), the caret keeper
    corrects it a frame later, and the two settle into a jump on alternate
    keystrokes. **Headless Chromium never shows the jump** (437 keystrokes
    measured, the box moved only where a line wrapped), so the test pins the
    CAUSE: a plain insertion takes a grow-only road and writes nothing while
    the words still fit (the `auto` pass runs only where a shrink is possible
    — a deletion, a paste, a keystroke over a selection marked at
    `beforeinput`, a programmatic refit, and once on blur), and a row already
    wearing the right reserve is skipped by arithmetic (`right + the margin
    it wears`) with no write and no forced layout. Not measured on a phone —
    the mechanism is the one the public iOS autogrow-textarea reports name,
    and it is the churn every one of them removes. Test:
    `node scripts/test-footage-typing.js` (style writes and off-width
    relayouts COUNTED per keystroke on the real page; verified failing 4
    pre-fix, 52 writes for 12 characters).
  - **FOOTAGE HEALS ITS OWN STALENESS — AND THAT IS WHY A FIX "STILL DIDN'T
    WORK" (2026-09-12, Sophie, a day after the width fix above was LIVE:
    "switch between narrow/full screen for example").** Measured before
    touching anything: the served page carried the fix and headless Chromium
    held the box at one width through every transition (keyboard, the pill
    coming and going, the big box, the fold, a divide, a scroll). What she was
    looking at was an OLD PAGE — the app keeps a tool's web view alive for
    the whole app process, and footage had no self-heal, so no deploy could
    reach it (the Playground's and the Chats app's finding, at the page she
    types in most). `GET /api/footage/build` + `ftBuildCheck` in footage.html:
    the Playground's block, with this page's own guards — a field under her
    caret, a tap in 10s, a send or an upload in flight, a refusal on screen,
    the seed box, a search, the trimmer, the character sheet, Recent, a note
    box, an expanded clip. Her words and references ride `footage_draft` and
    come back.
    **AND THE MODEL, THE SIZE AND THE SECONDS RIDE IT TOO SINCE 2026-09-14 —
    THEY HELD THE HEAL FOREVER, AND THAT IS WHY A FIX THAT SHIPPED THAT
    MORNING WAS NOT THERE (Sophie, about the empty-block divide: "it doesn't
    work" · "neither. doesn't work").** All three are deliberately UNSTICKY,
    so the first cut of the guard refused to reload over them — a reload
    would silently put Fast back to Mini and 15s back to 4s. MEASURED on the
    real page: picking **15 seconds** (or 720p, or any model but Mini) made
    `ftHolding()` answer "the seconds off their default" and `ftBuildCheck`
    never reloaded, through any number of new builds — and the ward draft is
    cut at 15s, so **her footage page could never heal at all** and every
    deploy since stopped at her screen with nothing on it saying why. They
    are CARRIED ACROSS the reload now (`healPickStash` / `healPickTake`)
    rather than blocking it. Three things not to undo: it is **SESSION**
    storage, so a cold open still lands on Mini · 480p · 4s and the unsticky
    rule is exactly what it was — only a heal carries them; the key is
    **TAKEN ONCE** as it is read, so a reload she makes later cannot
    resurrect last hour's pick; and the values are **NOT validated at the
    take** — `paintControls` clamps all three against the SERVED table, so a
    build that dropped a model or a size lands on a real value. **The lesson
    beyond this page: a guard that holds on a SETTING rather than on unsaved
    work is a guard that never lets go** — the setting comes with her, it
    does not get to veto the update. **A page loaded BEFORE
    this ships cannot heal itself** — the once-more force-quit is the one
    cure, and after that every fix reaches her on the next return to the
    tool. `ftHolding()` answers the REASON (`window.__ftHeal.holding()`), so
    a held reload is never a silent one. Found on the way: `stickybox.js`
    re-pinned the corner buttons on EVERY keystroke (class + every inline
    style rewritten with nothing moving — 18 writes for nine characters); a
    pin already where it wants to be writes nothing now. Tests:
    `node scripts/test-footage-selfheal.js` (every guard driven both ways
    on the real page, the reload judged by a new document) and section 7 of
    `test-footage-typing.js` (verified failing 1 pre-fix).
  - **A TAP INTO A BOX MEASURES NOTHING UNTIL THE CARET IS DOWN — `caretkeep.js`
    (2026-09-12, Sophie: "putting the cursor down also scrolls").** A tap
    focuses the box on the PRESS and places the caret on the RELEASE, so at
    `focusin` `selectionEnd` is the OLD caret — WebKit keeps it where she last
    typed (the end of the scene, a screen or more below), Chromium resets it to
    0 (which is why headless never showed it). The keeper ran its first `keep`
    synchronously on focus, measured that old caret, scrolled the page toward
    it, and the 90ms retry scrolled back: the lurch on every tap. **And
    compare.js calls `__caretKeep.focus(t)` on EVERY focusin**, so every belt
    page took the same road. A focus now ARMS the keeper and the first keep
    waits for the tap's CLICK (with a 150ms fallback for a focus no tap made —
    the pencil, a Tab); `focus()` arms the same way; `selectionchange` keeps
    the caret wherever a tap or a drag really puts it, ignored only while a
    focus is still armed. Measured: with the selection moved during `focus`,
    Chromium places the tap's caret at the CLICK, a task after mouseup — so
    the release is the click, never mouseup. Pinned by 6b of
    `node scripts/test-caret-keep.js`, which restores WebKit's stale-caret shape
    inside `focus` and counts every scroll the keeper asks for (verified
    failing 2 pre-fix: `[1237, 167]` on a tap at a line in plain view).
  - **AND AN EXPANDED CLIP IN THE FOOTAGE FEED CARRIES ONE TOO (2026-09-11,
    Sophie: "add a floating collapse button for expanded list view videos in
    footage").** The house `.moretxt` opener REMOVED ITSELF on the tap that
    opened it, so an expanded clip had no way back at all — measured on one
    70-line scene at 390x844: a **209px card becomes 4,690px**, six screens of
    prose with no control anywhere in it. It is a TOGGLE now (`… more` /
    `… less`, the same underlined word, never a boxed button) and it is
    marked `data-stickybox`, so from the middle of an expanded card the way
    out is at the bottom of the band and collapsing brings the card's top
    back with her. Pinned it takes a little padding and a radius for the
    shadow to sit on (`.moretxt.sbx-pin`) — floating over her words it is a
    control, not a word riding the last line.
  - **ONE PINNED BUTTON AT A TIME — the box she is actually inside.** A page
    can now carry several marked buttons (footage's own box, plus a `… less`
    on every expanded clip), and two boxes can both end below the fold for a
    scroll position or two; two floating words stacked in the same spot reads
    as a broken control. `sync` scores each by how much of its box is inside
    the band and pins the winner.
  - **THE PINNED PLACEMENT IS CORRECTED OFF THE REAL RECT.** The insets are
    measured while the button sits in the page, so any `.sbx-pin` styling that
    changes its box (footage's padding) would push it off its own column — one
    correction after it lands, never a second guess.
  - **TWO BUTTONS ON ONE BOX PIN TOGETHER, AND `nofollow` KEEPS THE PAGE STILL
    (2026-09-11, footage's corner grew DIVIDE HERE beside the bigger-box
    toggle).** "One pinned button at a time" is about two different BOXES;
    buttons sharing a box are one control row, and a row that pinned one and
    put the other away reads as half a control — whichever box wins, every
    marked button on it pins. `data-stickybox="nofollow"` opts a button out
    of the follow-back: a tap that shrinks the box from its BOTTOM (a divide
    at the cursor) leaves the seam where her eyes are, and bringing the box's
    top back would walk the page away from it. Measured by the pinned-pair
    and pinned-divide blocks of `node scripts/test-footage-divide.js`.
  - Tests: `node scripts/test-footage-collapse.js` (the expanded clip — every
    assertion a MEASUREMENT, since an opener that removes itself, one that
    stays but sits six screens down, and one that collapses the card and
    leaves her staring at the page below all look identical in the source;
    verified failing 13 pre-fix) and `node scripts/test-sticky-box.js` (the real footage page headless —
    every assertion a MEASUREMENT, since a marked button that never pins, one
    pinned somewhere she cannot tap, and one that shrinks the box and leaves
    her staring at the page below all look identical in the source; the tap is
    asked with `elementFromPoint`. Verified failing 5 pre-fix, the button
    1,649px down the page).

### THREE OPTIONS = A THREE-WAY TOGGLE, AND THERE IS EXACTLY ONE SHELL

- **THREE OPTIONS = A THREE-WAY TOGGLE, AND THERE IS EXACTLY ONE SHELL (Aug
  2026, Sophie: "for things with three options, it shud be a three way toggle.
  add the toggle as a likely pattern where it applies. make a reusable three
  toggle shell so we can change the styling all at once. make color a per
  instance option. apply it to the few instances that already exists").**
  `public/tritoggle.css`, class `.tri` — link it, never copy it.
  - **The markup contract is the whole of it:** `<button class="tri"
    data-n="0|1|2" data-i="L">`. `data-n` is the stop, ZERO-based and
    NUMBERED, which is what lets the account switcher (1/2/3), the
    Playground's quality (low/medium/high) and size (1K/2K/4K), and the
    Chats search filters share one rule. `data-i` is the short word on the
    knob; leave it off for a blank knob.
  - **Colour and size are the per-instance options** — `--tri-track`,
    `--tri-knob`, `--tri-ink`, `--tri-w`, `--tri-k`. A bare `.tri` IS the
    account switcher (48px, the rose `--chg`); the Playground sets four
    lines and gets ink-on-paper at 78px. **Everything else is DERIVED** —
    the height, the capsule radius and the travel between stops fall out of
    the width, the knob and the inset, so a new instance sets a width and is
    done. Both hand-typed copies had eyeballed their gap and one had the
    knob half a pixel off centre.
  - **It had been hand-copied THREE times before this** (`.swi` in
    chats.html and `.swtog` twice in promptlab.html, the second saying
    "LIFTED VERBATIM" in its own comment), with two attribute names and
    two palettes, and the only thing that ever noticed a copy drifting was a
    test comparing two files property by property.
  - **WHERE SHE TAPPED IS THE STOP SHE MEANT — the BEHAVIOUR is shared too,
    `public/tritoggle.js` (2026-08-24, Sophie: "when I click the low medium
    high toggle in playground, it always goes to high from medium never low
    even if I click it on that side").** Every copy had been wired as a CYCLE
    — `next = (cur + 1) % count`, tap anywhere, advance one — so from medium
    every tap went to high, a tap on the far-left `L` included. Nothing about
    the control says that: 78px wide, the value written on the knob, three
    legible stops. It reads as a thing you AIM at, and now it is one.
    `triNext(el, count, ev, cur)` divides the track into `count` equal zones
    and answers the one under the thumb; **a tap on the stop she is already
    on does nothing**, because advancing from there is the same surprise
    again.
  - **A tap with NO coordinate still cycles** — a keyboard activation (a
    click with `detail === 0`) and the WORD beside a search-filter row, which
    is part of the control but sits nowhere near the stop it names.
  - **NO TOGGLE CYCLES ON A TAP — NOT ONE (2026-08-24, her second pass: "it
    also applies to the account thing because none of them should cycle —
    that's a really stupid pattern … Cycling is a bad idea").** This rule
    shipped hours earlier carving out the account switcher on the reasoning
    that a blank knob gives her nothing to aim at; she overruled it, and she
    is right — the stops are ordered 1·2·3 left to right and the knob shows
    which one it is on, and a control where account 3 costs two taps from
    account 1 is the identical complaint in a narrower box. Its zones are
    16px on a 48px track, which is small; widening it is hers to ask for.
  - **A LABEL BESIDE A ROW CLEARS, it does not step.** The search filters
    spell their value out next to the knob and that word cannot aim (it is
    nowhere near the stop it names), so tapping it returns that filter to its
    neutral stop. A step there would be the cycle coming back in through the
    label.
  - **THE NEUTRAL STOP GOES IN THE MIDDLE (2026-08-24, Sophie: "the filters
    for searching chats should start in the middle. The middle should be the
    both option or everyone or whatever … that way I can get to either way
    with one tap").** A three-way filter is `everything` plus two OPPOSITE
    narrowings, so the neutral one belongs between them; leading with it put
    one narrowing two stops out at the far end. In `FILTERS` (chats.html) the
    neutral value is **NAMED** (`neutral:'all'`), never positional — every
    reader used to ask `vals.indexOf(v) > 0`, i.e. "not the first one", which
    stopped meaning "not neutral" the moment it moved. **The server's lists
    are untouched and still lead with `all`**, because `pickOne` in
    chatfeed.js leans on exactly that index-0 rule to widen an unknown value:
    this is a display ORDER and the values on the wire never changed.
  - **A stub test server must serve BOTH `/tritoggle.css` and
    `/tritoggle.js`** — express.static does it in production. Without the CSS
    the toggle renders as a 4px sliver; without the JS the page falls back to
    the old CYCLE (each page carries that one line as a floor, never a second
    copy of the aim), which would quietly green-light the bug above.
  - Tests: `node scripts/test-tritoggle.js` (nobody keeps a second copy, and
    the geometry measured in a real browser at every stop, for every
    instance) and `node scripts/test-tritoggle-aim.js` (the aim rule pure,
    then REAL taps at REAL coordinates on the live Playground — verified
    failing 5 against the pre-fix behaviour). **A click on the ELEMENT is not
    a test of this**: playwright aims at an element's centre, which on a
    three-way toggle is the middle stop, so a cycling toggle and an aimed one
    look identical. Click a POSITION.

### Opening an image freezes the page behind it

- **Opening an image freezes the page behind it.** Tapping/clicking a picture
  (lightbox, enlarged view, any overlay) must **pause any autoscroll** and lock
  background scroll (`document.body.style.overflow='hidden'`), restoring on
  close. The page must never scroll or jump while you're looking at an image.
  Applies to every app and every gallery. **AND save `window.scrollY` on open,
  `window.scrollTo(0, savedY)` on close (Aug 2026)** — pausing alone is not
  enough (`overflow:hidden` does not stop `window.scrollBy`, so anything that
  restarts the autoscroll under the overlay moves the page; this bit Sophie
  repeatedly on Compare pages). Restoring the saved position guarantees she
  closes the image exactly where she opened it, whatever happened behind it.
  - **AN OVERLAY MUST NOT DETACH THE TAPPED NODE WHILE THE TAP IS STILL
    BUBBLING (Aug 2026, Sophie: "why does auto scroll get triggered when I tap
    out of the light box in the auto compare page" — and she was right that
    this had been fixed once; it had, for a DIFFERENT overlay).** A host asks
    *was this tap the page's own?* with
    `t.closest('[data-nostop],img,figure,.cmp-lb')` on a bubbling click, which
    runs AFTER the overlay's own onclick. `asset-lightbox.js` closed with
    `lb.innerHTML = ''`, so the tapped caption/row had no parents left and
    `closest()` walked a detached subtree — the `[data-nostop]` marker on the
    overlay was unreachable, the tap fell through to the tap-to-TOGGLE, and the
    autoscroll STARTED behind the closing overlay. Tapping the backdrop (the
    overlay element itself, never detached) was always fine, which is why it
    read as intermittent. Two fixes, both kept: the wipe is deferred one frame,
    and chats.html's embedded handler asks the skip list at **pointerdown**,
    while the target is still in the DOM. `compare.js`'s own lightbox only sets
    `[hidden]` and was never affected — that is the difference between the two.
    Test: `node scripts/test-lightbox-nostop.js` (verified failing against the
    pre-fix file).
  - **`/assets` (Meta Assets) WAS A THIRD COPY OF THAT LIGHTBOX, AND IS NOW
    MIGRATED — the copy is what made both of these bugs reach Sophie a second
    time (2026-08-24: "I can't get out of the light box in Meta assets I think
    with tapping it's considering too many things part of the row").**
    `asset-lightbox.js` was written to end exactly this and `public/assets.html`
    was never moved onto it, so it kept the OLD close rule — a blanket
    `stopPropagation` on each row, which swallows the tap for the row's WHOLE
    width (the ♥/✕ strip is `left:22px; right:22px`; the action icons and the
    note block are full-width flex rows) — leaving her with almost nowhere to
    tap that closes. **The reason nobody had migrated it is the lesson:** it had
    grown two things the shared file had no place for, so every chat that looked
    at it chose to patch the copy. The shared file grew HOOKS for them instead,
    and 226 lines of duplicate came out of the page:
    - **`actions:[{label, icon, onClick}]`** — a row of small circular icon
      buttons directly under the picture (open the chat · Playground · Add to
      Shoebox · Save to Photos). `label` becomes the aria-label AND the title;
      the empty space between them closes the lightbox, because the close rule
      asks the tap's TARGET. `.hasacts` shrinks the picture to 46vh so the
      note box still fits.
      **The Playground door is on EVERY picture and the Shoebox door exists
      since 2026-08-28** (Sophie: "meta assets missing its send to
      playground/shoebox"): with a filed prompt the Playground door ports it
      exactly as before; with none there is nothing to port honestly, so the
      picture rides as the PHOTO REFERENCE instead (`/playground?photo=<url>`
      — promptlab attaches it through the same restore the copy buttons use,
      stepping a LoRA sticky style onto the reference-less ChatGPT tile,
      which has the slot). Add to Shoebox is the Story Room door's twin:
      `POST /api/scratchpad/shoebox-url {url, title}` through the SAME
      content-addressed writer (`shoeboxPut`), so the two doors converge on
      one memory for one picture; the label she reviews by is the polaroid's
      title. Tests: `node scripts/test-meta-assets-page.js`,
      `node scripts/test-storyroom-shoebox.js`,
      `node scripts/test-playground-photo-ref.js`.
    - **`who`** — the small uppercase origin-chat line under the caption, for a
      surface that mixes many chats.
    Both optional and additive, so no existing caller changed. **The next
    surface that needs something extra gets a hook, never a fourth copy.**
    Three things came free with the move: the picture is no longer rounded (her
    rule), the note thread is the settled box-first layout with the CHAT button,
    and the note input's 16px iOS floor — which that copy had and the shared
    file did not — now protects every caller.
    Tests: `node scripts/test-asset-lightbox.js` (the two hooks, and that an
    asset passing neither is untouched) and `node
    scripts/test-meta-assets-page.js` (step 0 is a SOURCE PIN that the page
    opens the shared lightbox and builds none of its own; step 11 taps the dead
    space, found by scanning each row with `elementFromPoint` — the only honest
    way to ask what a tap reaches; verified failing against the pre-fix page).
  - **EVERY SURFACE SHARES THE ONE FILE SINCE 2026-08-28 (Sophie: "create a
    single lightbox view, sync to all surfaces … ex assets, meta assets, story
    room, playground").** And **THE ONE LAYOUT IS THE PLAYGROUND'S,
    EVERYWHERE** (her check the same day: "it's not in meta assets?" — one
    code was not one view while the layout stayed per-page): ♥/✕ lead the
    row UNDER the picture with the caller's actions, all one 46px size, the
    MODEL · QUALITY tag and label directly under the picture, Prompt · Chat
    alone in the top band, the picture at 76vh yielding through flex. The
    old `votesBelow` / `capUnderImage` hooks are accepted and IGNORED — they
    are the layout now; don't reintroduce a per-page layout flag.
    The last three hand copies retired in one pass: the
    STORY ROOM's (its pick and step zones ride two new hooks — `cta`, a
    labeled primary button under the picture for "Use this one", and
    `onClose`, which lets a page whose beat popup holds the body lock
    re-assert it after the shared close clears `body.overflow`; the page's one
    rule is `#clightbox{z-index:60}`, its own overlay layering), FREEFORM's
    (an output opens with the verbatim `promptSent` behind the PROMPT door and
    steps the run's pictures; a reference opens plain) and the CHARACTER
    page's (a bare open). The shared close contract is everyone's now — a tap
    on dead space closes, a tap on the picture never does, the Story Room
    included. `node scripts/test-asset-lightbox.js` carries the SOURCE PIN:
    all six surfaces link the file and none builds a lightbox of its own — a
    seventh surface joins the sweep by linking it. Not migrated, by design:
    compare.js's own `.cmp-lb` zoom (hand-built Compare pages are FROZEN when
    posted, so changing their host risks every page already filed) and the
    public apps with their own identity (dream feed, witch).
  - **AND THE DOORS UNDER THE PICTURE ARE SHARED TOO — `/asset-actions.js`
    (2026-08-31, Sophie: "why the fuck different buttons in assets ex no
    playground button").** One shared lightbox is not one view while every
    caller types out its own `actions`. Measured that day: Meta Assets drew
    four doors (open the chat · Playground · Shoebox · Save), the Playground
    drew its own four, and the chat's own **Assets tab drew NONE** — so the
    surface she reviews every picture in was the one where a picture could not
    be sent anywhere, and getting one into the Playground meant finding it a
    second time in Meta Assets first.
    - **THE STANDARD SET FOR A FILED PICTURE IS `build(url, asset, opts)`** —
      Playground · Shoebox · Save to Photos, plus **Open the chat** behind
      `chatDoor`, which is TRUE only on a surface that mixes chats (Meta
      Assets, the Delivered strip) and false inside a chat's own tab, where it
      is a button back to the screen she is standing on. The icons, the
      three-path saver and the port query moved into that file VERBATIM out of
      assets.html, so nothing about Meta Assets' behaviour moved.
    - **A SURFACE WITH A DOOR OF ITS OWN STILL PASSES ITS OWN ARRAY** — the
      Playground puts the prompt back in its own box and walks to the Story
      Room carrying a RUN id, and neither means anything on a filed record,
      which knows no run. What it must not do is re-type these four.
    - **The page hands in `api` and `toast`** (`init`), because assets.html
      declares them as globals and chats.html wraps its script in an IIFE;
      `window.*` stays the fallback so assets.html did not move.
    - **THE ROW IS MEASURED, NOT COUNTED** — six 46px buttons with 22px gaps
      is **386px of a 390pt phone**, and `.lbacts` does not wrap. Meta Assets
      is at that edge now, so a SEVENTH door needs a layout answer first, not
      another push.
    - **The 70 `test-chats-*` harnesses hand-serve their shared files**, so a
      new `<script src>` on chats.html 404s in every one of them — which is
      why the call is guarded there like `/tritoggle.js` and `/filmnote.js`
      already are. The guard is only safe because the doors are MEASURED on
      the real page by `node scripts/test-asset-doors.js`; without that, "no
      doors" would be the thing every harness silently passed.
    - **AN UNCUT SHEET'S PLAYGROUND DOOR SLOTS ITS PANELS INTO THE BOXES
      (2026-09-06, Sophie, on the 3x3 in her Assets tab: "when i press copy on
      the original uncut grid it shud slot all 9 into panels").** The sheet's
      content half is all N panels, and `?prompt=` put the whole wall in the
      single box. `sheetGrid.panelParse({style, content, label, caption})`
      reads the RECORD and the door sends `?panels=<json>&grid=N` instead
      (seedPanelsFromLink lands them on the Panels tab); style, `sameref`,
      quality and the cast ride exactly as before. Three markers, none of
      them the shape of the text: a `1/9 (4K)` caption is a CUT panel and
      goes to the single box (her 2026-08-27 rule); the grid sentence in the
      style half (a server-filed sheet — sheetSeam puts it in the prefix) says
      N; and for a sheet filed WITHOUT the sentence — the
      mental-hospital-storyboard chat's shape, measured on the live records:
      wrapper + `[content]`, the panels joined by a blank line — the label's
      own `3x3` says N, only when that is a grid the module knows. Labeled
      `Panel k (…):` lines or the blank-line join come apart; anything short
      of exactly N is null and the door sends the one prompt it always did —
      **never dropped, never padded**. The honest fix at the source is to
      file the exact sent text, grid sentence included. **AND THE BACK-CRUMB
      BLOCK USED TO WIPE THE SEED**: promptlab spent the WHOLE query one tick
      after load, and the seed is read only once the styles fetch lands, so
      every sheet that walked in with `&back=` arrived to nine empty boxes;
      `panels`/`grid` now survive that spend and the seed spends them itself
      (a reload is still a plain Playground). Pinned by
      `node scripts/test-sheet-grid.js` (the parser against panelBlock) and
      the sheet half of `test-asset-doors.js` (the REAL Playground behind the
      door — the url read off the browser, then the nine boxes counted and
      read; a cut panel still on the Picture tab).
    - Test: `node scripts/test-asset-doors.js` (both real pages headless —
      the set, the row measured, the Playground door's real url read off the
      browser AFTER it navigates, the no-prompt picture riding as a photo
      reference with nothing invented, the Shoebox POST the server really
      saw, and the source pin that neither page may hand-type a door again).
    - **IT WAS "FIXED" TWICE AND SHE STILL FOUND A PICTURE WITH NO PLAYGROUND
      BUTTON (2026-09-01, on a Compare page's swipe card: "i thought we had
      fixed this").** The 08-28 pass unified the lightbox FILE, and the 08-31
      pass built this shared row — but it SURVEYED by hand the pages she had
      named plus the Playground, and pinned exactly those two files. The
      Compare/deck pages (`asset-view.js`) and Freeform are callers of the
      very same lightbox and were never measured, so both went on drawing ♥/✕
      and nothing else. **A fix to a shared thing is measured against every
      CALLER of the shared thing, found by grep, never against the list of
      surfaces in the ask** — the pin in `test-asset-doors.js` is DERIVED
      from `__assetLightbox(` across `public/` now, with a named reason for
      each exemption (the Playground's own run-id row, the Story Room's
      picker, the Character page's bare open). A new caller fails it until it
      builds the row or names its reason. `scripts/test-template-doors.js`
      drives the Compare page's doors for real, iframe case included.

  - **TAP TO NEXT ON THE ASSETS TAB AND ON META ASSETS (2026-08-31, Sophie:
    "add tap to next on assets like playground").** The two surfaces she
    reviews EVERY picture in were the last feeds where seeing the next one
    meant closing the box, finding the tile and opening again. The zones are
    the shared file's `nav` hook — nothing about the lightbox is copied — so
    all each page owes it is WHAT COMES NEXT.
    - **THE ORDER IS READ OFF THE GRID SHE IS LOOKING AT** — the tiles still
      on screen, in DOCUMENT order — the Playground's settled rule. So the
      ♥/New/Hide ✕ filter, the search box and a dead image narrow the walk by
      THEMSELVES, and there is no second copy of `applyFilter`'s rules to
      drift from it. Document order rather than the `cells` array is
      load-bearing in Meta Assets: a newly-arrived page is `insertBefore`'d at
      the FRONT of the grid while `cells` still pushes it on the end, so the
      array and the screen genuinely disagree.
    - **A FRESH OPEN HAS TO CLEAR THE PROMPT DOOR, which the Playground never
      had to do.** The house rule is that the half she picked rides a STEP and
      a fresh open always starts shut and on content — but these two pages
      hand the lightbox their long-lived ITEM objects, which it writes
      `promptSide`/`promptOpen` onto, where the Playground rebuilds its asset
      every time. So a fresh open deletes both and a step carries them off the
      picture she is LEAVING, both halves, always. (Reopening one tile and
      finding the door still open was a live bug on both pages before this.)
    - **A tap PAST the end lands on the picture, which never closes** — the
      shared close contract, unchanged; only the zone that exists is drawn.
    - **A MARK CAST FROM THE LIGHTBOX CAN TAKE THE PICTURE OFF THE GRID, AND
      THE WALK HAS TO SURVIVE IT (2026-09-03, her "i know one bug").** Every
      vote re-runs `applyFilter`, so with New or ♥ or Hide ✕ lit — which IS
      reviewing a tab — hearting the open picture hides its tile, the walk
      asked "where am I" and got -1, and **both zones went dead while still
      drawn**: stuck on that picture with only the way out working, on the
      loop (heart · next · heart · next) the feature exists for. Her PLACE is
      the fallback: the list closed up over the gap, so what now stands at the
      index she held IS the next one. It heals the moment the picture is back
      on screen, and it can only ever be one tile out, because the only thing
      that re-filters while the box is open is a mark she just cast.
      **The Playground had the same shape and is FIXED since 2026-09-05**
      (Sophie: "tap left right doesn't always work in the playground") —
      worse there, because its re-render REPAINTS the lightbox (`renderFeed`
      → `showLB`) and so both zones were not merely dead but GONE. `lbIdx`
      is her place and `lbNext` is the one reader, for the zones AND the
      step; `node scripts/test-playground-tap-next-vote.js` (verified
      failing 11 pre-fix, against a STATEFUL stub — the vote has to come
      back in the next feed read or the re-render restores the picture and
      the bug cannot be reproduced).
    - **THE CACHED THUMB PAINTS FIRST, the original swaps in behind it** (the
      Playground's 2026-08-26 rule, which these two never had). They painted
      `it.url` — 1-3MB at the 2K and 4K tiers — so the box sat EMPTY through
      the whole download, on every step. `tileSrc(it)` is what the TILE is
      showing: already decoded, and already past the direct-thumb →
      `/api/story/thumb` fallback, so it can never paint the 404 the tile
      itself walked away from. One download either way — the preloader warms
      the cache the swap then reads — and the doors and notes still run off
      the real url (`lightbox(url, asset, shown)`).
    - Test: `node scripts/test-assets-tap-next.js` (all three feeds headless
      in one sweep; verified failing against each pre-fix page). **The stub
      serves the ORIGINAL slowly on purpose**: locally the thumb and the
      original land inside one tick, so a page painting the original looks
      identical to one that doesn't. `test-meta-assets-page.js` asks the
      picture by DISPATCH now: its fixture is a 1×1 PNG, so the two 28% zones
      cover the whole of it and a centre-point click lands on a zone.
  - **IS IT EVERYWHERE? IT IS NOW — AND THREE SURFACES WERE MISSING IT
    (2026-09-03, Sophie: "is tap to next everywhere").** Five stepped and
    three did not, and every gap was invisible from inside its own file:
    - **Compare GRID pages** — the fix is in **`asset-view.js`**, the shared
      adapter, which takes a `seq()` and builds the `nav` itself; `grid.js`
      hands it `img[data-lb]` in document order (only asset-backed pictures
      carry it, which is the same set that opens this lightbox at all). So a
      spread's two ride side by side in the walk exactly as they do on screen.
      The adapter caches its asset per item, so it needed the Assets tab's own
      prompt-door rule — clear on a fresh open, carry on a step.
    - **The DELIVERED tab's picture strip** — the walk is `it.images`, the
      burst as it was handed to her, so the row's three thumbs open onto the
      whole batch.
    - **The CHARACTER sheet** — the walk is `.cell img` in document order, so
      the search narrows it by itself; the big portrait is in no sheet and
      opens alone.
    - **A DECK CARD (judge.js) DELIBERATELY DOES NOT STEP** — it goes through
      the same adapter but hands over no `seq`, so no zones are drawn: a card
      already has its own left/right gesture for the DECK, and a second one
      inside it that steps something else is hers to ask for.
    - `node scripts/test-asset-lightbox.js` carries the sweep: every surface
      that opens a feed hands over a nav hook, and a new picture surface joins
      it by linking the shared file.

