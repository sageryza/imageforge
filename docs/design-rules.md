# Design rules — the deep half

The house rules that only bite when you are actually building a page, an iOS screen or a piece of chrome: where a header lives, how the hairline tab rows measure their own underline, how a custom icon is sized against an SF Symbol, the webp rule for served art, the sans-caps type rule, and the home screen's filter row.

**The always-rules — no gradients, no pills, label and file every image, her voice model, no Claude-isms, background jobs, how to write a reply — stay in `CLAUDE.md`.** Every one of these was earned by shipping it wrong first, so the measurements are kept with the rules.

*(Moved out of `CLAUDE.md` Aug 2026 — see the pointers there. Nothing was rewritten; this is the text as it stood.)*

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
  ONE opens a tool (**Chats**); the other four FILTER the cards below
  (`HomeFilter`): **photo** = the picture-makers
  (Playground, Test Station, Freeform — the only place the Test Station has a
  card at all), **briefcase** = business, **quilt** = old fashioned, **film**
  = everything that makes or cuts moving pictures AND sound, drawn as an
  ordered pipeline rather than a grid (see THE FILM CHIP IS A PIPELINE
  below). The lit chip clears back to everything when
  tapped again (the Dump sort page's convention). `BusinessGrid`/`CraftsGrid`
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
