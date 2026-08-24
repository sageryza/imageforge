/* judge.js — the JUDGE page (Aug 2026, Sophie's ask: "a Tinder style page
   where I can pick and choose things quickly").

   One thing at a time, big, NO SCROLLING ("I hate scrolling") — tap a verdict
   and the next one appears. Four verdicts, her spec:

     ♥  love          → verdict true   (the same boolean older vote readers use)
     ✕  pass          → verdict false
     ◌  maybe         → verdict 'maybe'   (a real pile, reviewable)
     →  later         → verdict 'later'   (declined to sort NOW — grouped so
                                           she can come back to all of them)

   Include after /compare.js on a page built from judge-shell.html:

     <link rel="stylesheet" href="/compare.css">
     <div class="wrap"> …eyebrow / h1 / one-line sub… <div id="judge"></div></div>
     <script src="/compare.js"></script>
     <script src="/judge.js"></script>
     <script>(function(){ window.__judge({ chat, sheet, items }); })();</script>

   items: [{ id, label, img, full? }]                     — one picture
        | [{ id, label, pair: [{img,label},{img,label}] }] — a labeled
          side-by-side judged as ONE thing (medium vs high, PDF page vs text —
          the compare-and-choose case).
        | [{ id, label, card: '<html>' }]                  — a TEXT card (Aug
          2026, the chat-survey page): `card` is PAGE-AUTHORED trusted HTML
          rendered in the picture's place — never user/remote input. In the
          piles view a card item shows as a small text tile named by `label`.

   Verdicts save LIVE to the chat's verdict doc (POST /api/chatfeed/verdict,
   ok = true/false/'maybe'/'later'), so a chat reads them back with
   GET /api/chatfeed/verdict?chat=&sheet= exactly like vote chips. Notes ride
   the same doc's text field (the standing every-reviewable-thing rule).
   Reopening the page resumes at the first unjudged item; when everything is
   judged it opens on the PILES view — Loved / Maybe / Later / Passed — where
   tapping any tile re-opens that item to re-judge it.

   Style: minimal, cream, the Chats-app look — compare.css provides the tokens
   (which also keep the injected pill styled right). Icon-first controls, so
   the "?" circle explains them (the house rule for icon-first tools). */
(function () {
  if (window.__judge) return;


  // The worn spots in the ink — radial holes punched out of the mark by a
  // mask, so the red is never a solid printed rectangle. Two patterns: the
  // second is used by the B side of a spread so a pair never stamps twice
  // the same. (Her artboard's own circles and radii.)
  var HOLES_A = "radial-gradient(circle at 16% 26%,transparent 0 8px,#000 10px),"
    + "radial-gradient(circle at 58% 9%,transparent 0 6px,#000 8px),"
    + "radial-gradient(circle at 87% 68%,transparent 0 7px,#000 9px),"
    + "radial-gradient(circle at 37% 91%,transparent 0 6px,#000 8px),"
    + "radial-gradient(circle at 95% 22%,transparent 0 4px,#000 6px),"
    + "radial-gradient(circle at 6% 78%,transparent 0 5px,#000 7px),"
    + "radial-gradient(circle at 71% 47%,transparent 0 3px,#000 5px)";
  var HOLES_B = "radial-gradient(circle at 22% 18%,transparent 0 5px,#000 7px),"
    + "radial-gradient(circle at 66% 12%,transparent 0 4px,#000 6px),"
    + "radial-gradient(circle at 81% 74%,transparent 0 6px,#000 8px),"
    + "radial-gradient(circle at 31% 86%,transparent 0 4px,#000 6px),"
    + "radial-gradient(circle at 92% 34%,transparent 0 3px,#000 5px),"
    + "radial-gradient(circle at 9% 66%,transparent 0 4px,#000 6px)";
  var css = document.createElement('style');
  css.textContent =
    '.jg{max-width:680px;margin:0 auto;}' +
    '.jg-top{display:flex;align-items:center;gap:10px;padding:2px 56px 10px 0;}' +
    '.jg-count{font:600 12px/1 -apple-system,sans-serif;color:var(--ink2);letter-spacing:.04em;}' +
    '.jg-ic{width:30px;height:30px;border-radius:50%;border:1.5px solid var(--gold);' +
    ' background:var(--surface);color:var(--gold);display:flex;align-items:center;' +
    ' justify-content:center;padding:0;margin-left:auto;}' +
    '.jg-ic+.jg-ic{margin-left:0;}' +
    '.jg-ic svg{width:15px;height:15px;}' +
    '.jg-ic.txt{font:700 15px/1 Georgia,serif;}' +
    // position:relative because the note + is pinned in this card's corner
    // (compare.css .cmp-note-open — see the note-affordance rule there)
    '.jg-card{background:var(--surface);border:1px solid var(--line);border-radius:6px;' +
    ' padding:12px;position:relative;}' +
    // corner controls need their own strip on a SHORT card: a one-line text
    // card put the mic ON the words and the note + out of reach (Sophie
    // caught it live on the XI deck, Aug 2026) — the bottom padding is the
    // controls\' room, reserved whenever a corner control exists
    '.jg-card.ctl{padding-bottom:52px;}' +
    // the card-face menu (square / portrait / landscape — page-templates.js
    // ASPECTS): the ratio is set INLINE per card so one deck can mix shapes;
    // this class carries the rest — images cover the face, words center in
    // it. width:100% is load-bearing: with only an aspect-ratio, the box
    // resolves its width from the 58vh max-height instead.
    '.jg-media.sq figure{overflow:hidden;border-radius:6px;}' +
    '.jg-media.sq img{width:100%;height:100%;max-height:none;object-fit:cover;}' +
    // THE MOMENT CARD — the date card, HER OWN design ("Decision Deck v2",
    // Aug 2026), wired in as the deck's TEXT STYLE and copied EXACTLY at her
    // ask ("exactly exactly exactly like it does in the demo"): each part in
    // its own white rounded box on her cream, the Newsreader serif, her hex
    // palette — deliberately NOT the house tokens. The NAME sits centred on
    // its own line above the boxes, lower than the header row it lived on in
    // the mockup (her ask). The footer is hers too — ✕ · Note for Claude · ♥
    // (the mockup's ✓ swapped for a ♥, her call) — chosen over the four
    // house verdicts, so a moment deck has no maybe/later and no mic.
    // ONE SCREEN, ONE GUTTER (Aug 2026, her report on the live page: "lots of
    // things are misaligned", and the page scrolled when her design does not).
    // Her mockup is a fixed phone frame, so the deck fills the viewport and
    // NOTHING scrolls: the boxes take the middle and centre themselves, the
    // footer sits on the bottom. Every row — progress line, Piles, boxes,
    // footer — shares ONE 22px gutter, so their edges line up down the screen;
    // the old layout inherited compare.css's .wrap padding for the boxes, a
    // 56px pill reservation on the top row and a centred footer, which is
    // three different left edges. The page-level pill is gone too
    // (page-templates.js), so no corner is reserved for it any more.
    '.jg-mombg{background:#F7F2E8;padding:0;height:100vh;height:100dvh;overflow:hidden;}' +
    '.jg-mombg .wrap{max-width:none;height:100%;padding:0;}' +
    '.jg-mombg #judge,.jg-mombg .jg.mom{height:100%;}' +
    '.jg.mom{display:flex;flex-direction:column;box-sizing:border-box;max-width:680px;' +
    ' margin:0 auto;padding:max(14px,env(safe-area-inset-top)) 22px' +
    ' max(10px,env(safe-area-inset-bottom)) 22px;}' +
    '.jg.mom>*{flex:none;}' +
    '.jg-prog{height:3px;border-radius:999px;background:#E7DECF;overflow:hidden;}' +
    '.jg-prog i{display:block;height:100%;border-radius:999px;background:#C25E4C;' +
    ' transition:width .25s ease;}' +
    '.jg-momtop{display:flex;align-items:center;justify-content:flex-end;gap:10px;' +
    ' padding:14px 0 0;}' +
    '.jg-pilesbtn{border:1px solid #DDD3C0;background:#FFFDF8;color:#262016;' +
    ' font:600 12px/1 -apple-system,sans-serif;padding:7px 14px;border-radius:8px;' +
    ' display:flex;align-items:center;justify-content:center;}' +
    // EVERY GLYPH IS CENTRED IN ITS OWN BUTTON (Aug 2026, her report: "the
    // heart and the ex are not aligned with their buttons and neither is the
    // ?"). compare.css's global `button` rule sets display:inline-flex and
    // align-items:center but NO justify-content, so a button with a fixed
    // width holds its glyph against the left edge — invisible on a button
    // that hugs its words, obvious on a 62px square. Any fixed-size button
    // here has to say justify-content:center itself.
    '.jg-momq{width:30px;height:30px;border-radius:50%;border:1px solid #DDD3C0;' +
    ' background:#FFFDF8;color:#262016;font:700 13px/1 -apple-system,sans-serif;padding:0;' +
    ' display:flex;align-items:center;justify-content:center;}' +
    '.jg-momq.has{background:#C25E4C;border-color:#C25E4C;color:#F7F2E8;}' +
    // her boxes sit straight on the cream — the house card chrome disappears,
    // and the stack takes the middle of the screen, centred like her mockup.
    // CENTRED BY AUTO MARGINS, NOT justify-content (Aug 2026, her report:
    // "the text gets truncated if it's too long and hidden"). The first cut
    // said `justify-content:safe center`, but iOS Safari has no `safe`, fell
    // back to plain `center`, and a stack taller than the box was clipped at
    // BOTH ends with the top unreachable by any scroll. The auto margins on
    // .jg-mom centre a short stack identically and resolve to 0 when it
    // overflows, so a tall card scrolls inside this box from its top — in
    // every browser. The page itself still never scrolls.
    // …and the scroller takes NO WIDTH when it does scroll: a desktop
    // scrollbar is 15px of layout inside this box, which would pull the
    // boxes 15px off the edges every other row sits on (iOS overlay
    // scrollbars hide it, so it only shows up on a short window)
    '.jg-card.momcard{background:transparent;border:0;padding:0;flex:1;min-height:0;' +
    ' display:flex;flex-direction:column;overflow-y:auto;scrollbar-width:none;}' +
    '.jg-card.momcard::-webkit-scrollbar,.jg.mom .jg-piles::-webkit-scrollbar' +
    ' {width:0;height:0;}' +
    '.jg.mom .jg-piles{scrollbar-width:none;}' +
    '.jg-mom{display:flex;flex-direction:column;gap:14px;text-align:left;width:100%;' +
    ' margin:auto 0;padding:2px 0;}' +
    // A LONG CARD FITS ITSELF (Aug 2026, her report + her own fix list: the
    // top blurb "is bigger than the other blurbs"): when the stack overflows
    // its box, render() adds `long` — the moment drops from 21px toward the
    // other blurbs' size, the gaps tighten, and most long cards come back to
    // one screen. A card still too tall after that scrolls (above). Short
    // cards keep her Decision Deck sizes exactly.
    '.jg-mom.long{gap:9px;}' +
    '.jg-mom.long .moment{font-size:16px;line-height:1.42;}' +
    '.jg-mom.long .cap{font-size:14px;}' +
    '.jg-mom.long .jg-mombox{padding:12px 14px;gap:5px;}' +
    // THE NAME IS PART OF THE TOP, not of the centred stack (her ask was "a
    // little bit lower down and centered" — one row below where the mockup
    // had it, next to Piles; inside the stack it drifts to mid-screen on a
    // tall phone, which is a lot lower down). Pinned here it always sits the
    // same distance under the Piles row, whatever the card holds.
    // …and it is her RUST, in the sans, sitting a little further down (her
    // ask — the one part of the card that is deliberately NOT the mockup's
    // serif, so the name reads as a label over the moment rather than as
    // more of the writing)
    // CAPS at her ask — and caps in the sans bring the house rule with them
    // (design-rules.md: the sans is caps, NOT bold, with a little tracking,
    // because caps set solid read as a block)
    '.jg.mom>.who,.jg-mom .who{text-align:center;padding:22px 0 4px;' +
    ' font:500 21px/1.25 -apple-system,\'Helvetica Neue\',sans-serif;color:#C25E4C;' +
    ' text-transform:uppercase;letter-spacing:.04em;}' +
    // A LONG CARD PUTS ITS TITLE IN THE TOP-LEFT CORNER (Aug 2026, Sophie:
    // "if the text is really long have the title just go in the top left
    // corner instead of in the middle. I really don't like scrolling"). The
    // centred 21px name costs ~50px of height it does not need when the words
    // underneath are already too many for one screen — so on a long card it
    // becomes a small left-aligned line and the card keeps the difference.
    // A short card is unchanged: there the big centred name is the design.
    '.jg.mom.long>.who{text-align:left;padding:10px 0 2px;' +
    ' font-size:13px;letter-spacing:.1em;}' +
    '.jg-mombox{background:#FFFDF8;border:1px solid #E7DECF;border-radius:10px;' +
    ' padding:16px 18px;display:flex;flex-direction:column;gap:7px;}' +
    '.jg-mombox .eyebrow{font:700 10px/1.3 -apple-system,sans-serif;' +
    ' letter-spacing:.14em;text-transform:uppercase;color:#C25E4C;}' +
    '.jg-mombox .moment{margin:0;font:500 21px/1.34 Newsreader,Georgia,' +
    ' \'Times New Roman\',serif;color:#262016;text-wrap:pretty;}' +
    '.jg-mombox .seclabel{font:700 10px/1.3 -apple-system,sans-serif;' +
    ' letter-spacing:.14em;text-transform:uppercase;color:#8A7F6E;}' +
    '.jg-mombox .sectext{margin:0;font:400 14px/1.5 -apple-system,sans-serif;' +
    ' color:#4C4335;text-wrap:pretty;}' +
    '.jg-mombox .cap{margin:0;font:italic 500 16px/1.4 Newsreader,Georgia,' +
    ' \'Times New Roman\',serif;color:#262016;}' +
    // a picture rides in the stack as its own rounded panel, the boxes\' radius
    // NO OUTLINE, NO ROUNDED CORNER ON A PICTURE (Aug 2026, Sophie, on the
    // two-up card: "gray outlines, rounded corners"). Her rounded white boxes
    // are for WORDS; a picture is shown as it is. The panel used to draw one
    // border and the image another, so a spread wore two.
    '.jg-mom figure{margin:0;}' +
    '.jg-mom figure img{width:100%;display:block;}' +
    '.jg-mom figure img.fill{height:100%;object-fit:cover;}' +
    // a picture with no card-face shape: the panel shrinks to it and the
    // height is capped, so the card stays one screen (Aug 2026 v3, when every
    // deck became hers). object-fit would letterbox inside a full-width box
    // and put cream margins inside her border — hugging avoids that entirely.
    '.jg-mom figure.hug{align-self:center;max-width:100%;}' +
    '.jg-mom figure.hug img{width:auto;height:auto;max-width:100%;max-height:56vh;}' +
    // THE CARD'S WAY OUT — an item's `link`, rendered as her rust text on a
    // white box like the others, and lifted above the browse zones (see
    // linkHtml). `align-self:center` keeps the hit area to the words: a
    // full-width anchor inside the card would swallow the taps that page it.
    '.jg-momlink{position:relative;z-index:3;display:flex;justify-content:center;}' +
    '.jg-momlink a{display:inline-block;background:#FFFDF8;border:1px solid #E7DECF;' +
    ' border-radius:6px;padding:9px 14px;text-decoration:none;color:#C25E4C;' +
    ' font:700 11px/1.2 -apple-system,sans-serif;letter-spacing:.12em;' +
    ' text-transform:uppercase;}' +
    // A SPREAD ON ONE CARD: the pictures share the width so they are compared
    // rather than scrolled between, each under its own name. They shrink as a
    // spread grows — two get half each, three a third — which is the whole
    // point of putting them on one card.
    // THE SPREAD SITS ABOVE THE EDGE ZONES (Aug 2026 — found by measuring, not
    // by looking: the browse zones are 26%-wide strips at z-index 2, and on a
    // two-up card the CENTRE of each picture lands inside one. So a tap on
    // either picture paged the deck instead of opening it, and the "this one"
    // buttons under them were unreachable for the same reason — on the one
    // card whose whole job is choosing between two pictures. Lifting the
    // spread above the zones makes a tap on it hers; the card's margins above
    // and below still page, and the swipe always did.
    '.jg-spread{display:flex;gap:8px;align-items:flex-start;justify-content:center;'
    + 'position:relative;z-index:3;}' +
    // position:relative so a spread's own GOOD / BAD stamp lands on the
    // picture it judges rather than on the pair
    '.jg-spread figure{flex:1 1 0;min-width:0;align-self:stretch;'
    + 'display:flex;flex-direction:column;gap:5px;position:relative;}' +
    '.jg-spread figure img{width:100%;height:auto;max-height:44vh;object-fit:contain;'
    + 'display:block;}' +
    '.jg-spread figcaption{font:700 10px/1.3 -apple-system,sans-serif;letter-spacing:.12em;'
    + 'text-transform:uppercase;color:#8A7F6E;text-align:center;}' +
    '.jg-pick{align-self:center;border:1px solid #DDD3C0;border-radius:6px;'
    + 'background:#FFFDF8;color:#262016;font:600 12px/1 -apple-system,sans-serif;'
    + 'padding:8px 12px;-webkit-tap-highlight-color:transparent;}' +
    '.jg-pick.on{background:#262016;border-color:#262016;color:#F7F2E8;}' +
    // THE FOOTER — TWO ASKS, ONE STACK (Aug 2026, back to back). First: "the
    // note box is just too small — it should be bigger so I can see more of my
    // words in it, and the heart and the ex can go a little above it and maybe
    // be a tiny bit smaller to make room", so the note is FULL WIDTH and about
    // four lines tall and the buttons came down a size. Then, on the result:
    // "there's a lot of space between the X and the heart that's empty. I
    // think you could put the heart and the X on top of the content so the
    // content comes down a little farther and there's just a tiny bit of space
    // between the note and the content" — so the buttons no longer hold a row
    // of their own at all. They FLOAT on the content's bottom corners (keeping
    // the boxes' own left and right edges, so nothing gained a fourth
    // alignment) and the footer is the note box, directly under the content.
    '.jg-momfoot{position:relative;padding:6px 0 2px;}' +
    // the mic sits in the note box's own bottom-right corner, and the box
    // gives it room so her typing never runs under it
    '.jg-momfoot .jg-mic{left:auto;right:10px;bottom:10px;border-color:#DDD3C0;' +
    ' background:#FFFDF8;color:#262016;}' +
    '.jg-momfoot.mic .jg-momnote{padding-right:46px;}' +
    // a LONG card starts its stack at the TOP and runs down under the floating
    // buttons ("so the content comes down a little farther") — centring it
    // would leave exactly the empty band she was pointing at. It reserves the
    // buttons' height at the bottom of the scroller so the last line can never
    // hide under them. A SHORT card is untouched: it centres, and never
    // reaches down there, so it keeps every pixel of the middle.
    '.jg.mom.long .jg-card.momcard{justify-content:flex-start;padding-bottom:58px;}' +
    // AND A CARD WITH A WAY OUT RESERVES THE SAME BAND (Aug 2026, found by
    // measuring when MAYBE arrived). The ✕ and the ♥ hug the card's bottom
    // CORNERS, so a centred link has always sat safely between them — the ?
    // is centred too, and it landed exactly on that anchor. The link is the
    // last thing in the stack, so reserving the buttons' height under it
    // lifts it clear whether the card is centred or top-aligned.
    '.jg-card.momcard.linkroom{padding-bottom:58px;}' +
    // the piles view scrolls inside its own box on a moment deck, so the
    // page still never scrolls
    '.jg.mom .jg-piles{flex:1;min-height:0;overflow-y:auto;}' +
    '.jg.mom .jg-piles h2:first-child{margin-top:14px;}' +
    // pinned just above the note box, i.e. over the content's bottom corners.
    // 52px — a tiny bit smaller than the mockup's 62, her ask, to make room
    // for the bigger note box under them
    '.jg-mombtn{position:absolute;bottom:calc(100% + 4px);z-index:3;' +
    ' width:52px;height:52px;border-radius:10px;' +
    ' border:1.5px solid #C9BFAA;background:#FFFDF8;color:#262016;' +
    ' font-size:18px;line-height:1;padding:0;' +
    ' display:flex;align-items:center;justify-content:center;}' +
    // they keep the boxes' own edges, the way the row used to — and MAYBE
    // sits centred between them (Aug 2026, her ask), so the three read as one
    // scale rather than as two marks plus an extra
    '.jg-mombtn.no{left:0;}.jg-mombtn.yes{right:0;}' +
    '.jg-mombtn.maybe{left:50%;transform:translateX(-50%);}' +
    // the hand-drawn marks (MOM_X / MOM_HEART) are FILLED paths — an explicit
    // fill, because a host page with an `svg{fill:none}` rule would otherwise
    // hollow them out (the trap the injected pill already defends against)
    '.jg-mombtn svg{width:22px;height:22px;fill:currentColor;stroke:none;display:block;}' +
    // the ♥ draws optically smaller than the ✕ at the same size, as it did
    // when both were characters
    '.jg-mombtn.yes svg{width:23px;height:23px;}' +
    '.jg-mombtn.on{background:#262016;border-color:#262016;color:#F7F2E8;}' +
    // the note IS the footer row now — full width, four lines of her words
    '.jg-momnote{display:block;width:100%;margin:0;height:96px;box-sizing:border-box;' +
    ' border-radius:9px;border:1.5px solid #E7DECF;background:#FFFDF8;padding:10px 14px;' +
    // 13px, HER SIZE — and the iOS focus-zoom it would normally cause is
    // headed off by the viewport instead (maximum-scale=1, page-templates.js
    // + compare.js). 16px was tried first and she asked for it back: "I would
    // prefer not to have pinch [zoom] and for it not to be 16 PX… now it's
    // too big… I don't need pinch zoom." Do NOT raise this to dodge the zoom.
    ' font:400 13px/1.45 -apple-system,sans-serif;color:#262016;outline:none;resize:none;}' +
    '.jg-momnote::placeholder{color:#A99E8B;}' +
    '.jg-cardtext.sq{width:100%;display:flex;align-items:center;' +
    ' justify-content:center;text-align:center;padding:10%;box-sizing:border-box;' +
    ' max-height:none;overflow-y:auto;}' +
    '.jg-media{display:flex;gap:8px;justify-content:center;}' +
    '.jg-media figure{margin:0;flex:1;min-width:0;text-align:center;}' +
    '.jg-media .tag{display:block;font:700 11px/1 -apple-system,sans-serif;' +
    ' letter-spacing:.08em;text-transform:uppercase;color:var(--gold);padding-bottom:5px;}' +
    '.jg-media img{max-width:100%;max-height:52vh;width:auto;height:auto;' +
    ' object-fit:contain;border-radius:6px;display:inline-block;}' +
    '.jg-label{font-size:15px;color:var(--ink);padding-top:8px;text-align:center;}' +
    '.jg-row{display:flex;justify-content:center;gap:18px;padding:16px 0 6px;}' +
    '.jg-btn{width:54px;height:54px;border-radius:50%;border:1.5px solid var(--line);' +
    ' background:var(--surface);display:flex;align-items:center;justify-content:center;padding:0;}' +
    '.jg-btn svg{width:24px;height:24px;}' +
    '.jg-btn.no{color:var(--rose);border-color:var(--rose);}' +
    '.jg-btn.later{color:var(--ink2);}' +
    '.jg-btn.maybe{color:var(--gold);}' +
    '.jg-btn.yes{color:var(--chg);border-color:var(--chg);}' +
    // browse mode paints the card's current verdict on its button
    '.jg-btn.on{background:var(--ink);border-color:var(--ink);color:var(--paper);}' +
    // custom states are her words — chips that hug them (never pills)
    '.jg-chip{border:1.5px solid var(--line);border-radius:6px;background:var(--surface);' +
    ' color:var(--ink2);font:600 13px/1 -apple-system,sans-serif;padding:11px 13px;}' +
    '.jg-chip.on{color:var(--paper);background:var(--ink);border-color:var(--ink);}' +
    // the browse tap zones: the card's left/right edges page the deck; the
    // middle stays the picture's own tap (lightbox)
    // -webkit-tap-highlight-color: iOS paints a grey slab over the whole
    // 26%-wide zone on every tap ("gray bars that show up when I tap the side
    // of the page"). The edges are meant to be invisible — the card moving IS
    // the feedback — so the highlight goes.
    '.jg-navzone{position:absolute;top:0;bottom:0;width:26%;background:transparent;' +
    ' border:0;border-radius:0;padding:0;z-index:2;' +
    ' -webkit-tap-highlight-color:transparent;}' +
    '.jg-navzone.prev{left:0;}.jg-navzone.next{right:0;}' +
    // THE EDGES ARE ANCHORED TO THE CARD'S VISIBLE BOX, NOT TO ITS CONTENT
    // (Aug 2026, Sophie: "tapping on the left or right side of the screen
    // doesn't take me to the next option" — found by measuring, not by
    // looking). The zones lived INSIDE .jg-card, which on a moment deck IS
    // the scroller: an absolutely positioned child of a scroll container
    // rides up with the content, so scrolling a long card 232px pulled the
    // zones' bottom from y730 to y498 and the whole lower half of both sides
    // went dead — on exactly the cards long enough to need paging. The
    // wrapper does not scroll, so they hold the card's box however far she
    // reads. It keeps the card's flex slot so the one-screen chain is intact.
    '.jg-cardwrap{position:relative;}' +
    '.jg.mom .jg-cardwrap{flex:1;min-height:0;display:flex;flex-direction:column;}' +
    // THE ONE-SCREEN CHAIN MUST REACH EVERY CARD, NOT JUST `.momcard` (Aug
    // 2026, Sophie: "I just couldn't reach the button… the very top part of
    // the compare tab with the back arrow which has the name" — found by
    // measuring the deck at the height the APP actually gives it).
    // A deck that brings its OWN words (`states`) has momUI false, so its
    // card never got the `momcard` class — and this rule named that class, so
    // the card took NO flex slot and NO scroller. It sized to its CONTENT and
    // simply overflowed the wrapper, painting straight over the verdict row
    // underneath: the chips were on screen and covered, which is the worst
    // shape a control can have — it looks tappable and is not.
    // It only bites when the box is short, which is why the web page looked
    // fine and her phone did not: measured on the real deck, the chips are
    // reachable at 640px of height and BLOCKED at 600px, and chats.html's
    // `.pv-bar` (back chevron + title + the safe-area inset) is what pushes
    // an iPhone 13 across that line.
    '.jg.mom .jg-cardwrap>.jg-card{flex:1;min-height:0;overflow-y:auto;' +
    ' scrollbar-width:none;}' +
    '.jg.mom .jg-cardwrap>.jg-card::-webkit-scrollbar{width:0;height:0;}' +
    // …AND THEY REACH THE SCREEN'S EDGE. Her deck holds a 22px gutter, so the
    // outermost 22px of each side was page background — dead to a tap, and
    // the first place a thumb lands when she means "the side of the screen".
    // The wrapper does not clip (the card did), so the zones can take it back.
    '.jg.mom .jg-navzone.prev{left:-22px;width:calc(26% + 22px);}' +
    '.jg.mom .jg-navzone.next{right:-22px;width:calc(26% + 22px);}' +
    // tap-to-record, bottom-left corner (the note + owns bottom-right)
    '.jg-mic{position:absolute;left:8px;bottom:8px;width:30px;height:30px;z-index:3;' +
    ' border-radius:50%;border:1.5px solid var(--line);background:var(--surface);' +
    ' color:var(--ink2);display:flex;align-items:center;justify-content:center;padding:0;}' +
    '.jg-mic svg{width:15px;height:15px;}' +
    '.jg-mic.rec{color:var(--rose);border-color:var(--rose);animation:jgrec 1.1s infinite;}' +
    '@keyframes jgrec{0%,100%{opacity:1}50%{opacity:.45}}' +
    '.jg-toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:70;' +
    ' background:var(--ink);color:var(--paper);border-radius:6px;padding:9px 13px;' +
    ' font:500 13px/1.3 -apple-system,sans-serif;max-width:86vw;}' +
    // ── BACK TO THE QUEUE (Aug 2026, Sophie: "there should be a way to get
    // back to the queue from an individual swipe deck"). Only on a deck the
    // Review Queue opened (?clean=1 is its door) — a Compare-tab page has the
    // app's own header above it and needs no second back.
    '.jg-back{width:30px;height:30px;border-radius:50%;padding:0;flex:none;' +
    ' border:1px solid var(--line);background:var(--surface);color:var(--ink2);' +
    ' display:flex;align-items:center;justify-content:center;}' +
    // her top row is right-aligned (Piles + ?), so the back mark holds the
    // left end of it; the standard row already pushes its icons right itself
    '.jg-momtop .jg-back{margin-right:auto;}' +
    '.jg-back svg{width:16px;height:16px;}' +
    '.jg.mom .jg-back{border-color:#DDD3C0;background:#FFFDF8;color:#262016;}' +
    // ── THE MINI AUTOSCROLL (Aug 2026, Sophie, on a card too long to fit:
    // "ideally you would add a conditional auto scroll thing, but only appears
    // when the text is very long and is smaller than the normal one and just
    // like on the side of the screen"). A deck carries no house pill — one
    // card at a time never scrolls the PAGE — but a long card scrolls inside
    // itself, and that is the one thing here worth driving. So: the pill's job
    // at the pill's scale, one small button on the side, and only while the
    // card in front of her actually overflows.
    // `[hidden]` needs the attribute selector to out-specify the display rule
    // above it — the house `[hidden]` trap, every toggling page has to.
    '.jg-mini{position:fixed;right:6px;top:50%;transform:translateY(-50%);z-index:40;' +
    ' width:28px;height:28px;border-radius:50%;padding:0;' +
    ' border:1px solid var(--line);background:var(--surface);color:var(--ink);' +
    ' display:flex;align-items:center;justify-content:center;' +
    ' -webkit-tap-highlight-color:transparent;}' +
    '.jg-mini[hidden]{display:none;}' +
    '.jg-mini svg{width:13px;height:13px;fill:currentColor;stroke:none;display:block;}' +
    // on a moment deck it wears her cream palette, like everything else there
    '.jg-mombg .jg-mini{border-color:#DDD3C0;background:#FFFDF8;color:#262016;}' +
    '.jg-piles h2{margin-top:22px;}' +
    // ── THE PILES FOOTER (Aug 2026, Sophie — two asks, one row). "Take away
    // the chat list at the bottom and instead offer a link back to the chat in
    // the piles area": the queue is decks now, and the chat that posted this
    // one is a tap from inside it. "Get rid of the X on all of the icons and
    // instead offer a skip or done button in the piles area": the queue tiles
    // carry no ✕ any more — the two ways off her pile live here, where she
    // already is when she has finished with a deck.
    '.jg-pilefoot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;' +
    ' margin-top:20px;padding-top:14px;border-top:1px solid var(--line);}' +
    '.jg.mom .jg-pilefoot{border-top-color:#E7DECF;}' +
    '.jg-pilelink{margin-right:auto;font:600 13px/1 -apple-system,sans-serif;' +
    ' color:var(--gold);text-decoration:none;}' +
    '.jg.mom .jg-pilelink{color:#C25E4C;}' +
    // rounded rectangles that hug their words — never pills, never full width
    '.jg-pilebtn{border:1px solid var(--line);border-radius:6px;background:var(--surface);' +
    ' color:var(--ink);font:600 13px/1 -apple-system,sans-serif;padding:9px 13px;}' +
    '.jg.mom .jg-pilebtn{border-color:#DDD3C0;background:#FFFDF8;color:#262016;}' +
    '.jg-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}' +
    '.jg-grid button{border:1px solid var(--line);border-radius:6px;background:var(--surface);' +
    ' padding:0;overflow:hidden;aspect-ratio:1;}' +
    '.jg-grid img{width:100%;height:100%;object-fit:cover;display:block;}' +
    '.jg-grid button.txt{aspect-ratio:auto;min-height:64px;padding:6px;' +
    ' font-size:12px;line-height:1.3;color:var(--ink);word-break:break-word;}' +
    '.jg-cardtext{font-size:15px;line-height:1.5;color:var(--ink);text-align:left;' +
    ' overflow-y:auto;max-height:58vh;}' +
    '.jg-cardtext a{color:var(--gold);}' +
    '.jg-help{position:fixed;inset:0;background:rgba(20,18,15,.35);z-index:50;' +
    ' display:flex;align-items:center;justify-content:center;padding:24px;}' +
    '.jg-help>div{background:var(--surface);border:1px solid var(--line);border-radius:6px;' +
    ' padding:16px 18px;max-width:340px;font-size:15px;' +
    // her own words can run to several paragraphs, so the card scrolls
    // rather than growing past the screen and losing its own bottom
    ' max-height:76vh;overflow-y:auto;}' +
    '.jg-said{margin:0 0 4px;font:400 14px/1.5 -apple-system,sans-serif;color:var(--ink);}' +
    '.jg-said i{display:block;font:700 10px/1.3 -apple-system,sans-serif;' +
    ' letter-spacing:.12em;text-transform:uppercase;color:var(--gold);' +
    ' font-style:normal;margin-bottom:2px;}' +
    '.jg-help b{color:var(--gold);font-family:-apple-system,sans-serif;font-size:13px;}' +
    '.jg-flash{animation:jgf .18s;}@keyframes jgf{from{opacity:.35}to{opacity:1}}' +

    // ── THE GOOD / BAD STAMP (Aug 2026, Sophie's own "Decision Deck v3"
    // canvas: "a little good/bad stamp that stamps the ones that you pick or
    // don't pick"). A decided card wears a red rubber stamp; the one just
    // decided SLAMS on. Ported from her artboard, values hers:
    //   · it comes in at 2.5x and blurred, invisible until 38% — so what she
    //     sees is the moment of contact, not the approach — then overshoots
    //     and settles at 1x, tilted, in ~560ms.
    //   · the ink is ROUGH, not clean: an feTurbulence displacement chews the
    //     edges, and a mask of radial holes lifts the worn spots out of the
    //     middle. Two filters and two hole patterns so the two sides of a
    //     spread never stamp identically.
    //   · pointer-events:none, always — the stamp sits over her ♥/✕ and must
    //     never eat a tap meant for them.
    '.jg-stamp{position:absolute;inset:0;display:flex;align-items:center;' +
    ' justify-content:center;pointer-events:none;z-index:9;}' +
    '.jg-stampmark{border:8px solid #C0271F;border-radius:9px;padding:12px 30px;' +
    ' color:#C0271F;font:700 52px/1 Newsreader,Georgia,serif;letter-spacing:.09em;' +
    ' box-shadow:inset 0 0 0 2.5px rgba(192,39,31,.5);opacity:.9;' +
    ' transform:rotate(-8.5deg);filter:url(#jgInk1);' +
    ' -webkit-mask-image:' + HOLES_A + ';mask-image:' + HOLES_A + ';' +
    ' -webkit-mask-composite:source-in;mask-composite:intersect;}' +
    // the B side of a spread: the other tilt, the other filter, other holes
    '.jg-stamp.b .jg-stampmark{transform:rotate(6.5deg);filter:url(#jgInk2);' +
    ' -webkit-mask-image:' + HOLES_B + ';mask-image:' + HOLES_B + ';}' +
    // on a spread each half is small, so the mark is
    '.jg-spread .jg-stampmark{border-width:6px;border-radius:7px;padding:7px 16px;' +
    ' font-size:30px;box-shadow:inset 0 0 0 2px rgba(192,39,31,.5);}' +
    '.jg-stamp.live .jg-stampmark{animation:jgstampA 560ms cubic-bezier(.2,.8,.3,1) both;}' +
    '.jg-stamp.live.b .jg-stampmark{animation:jgstampB 560ms cubic-bezier(.2,.8,.3,1) 200ms both;}' +
    '@keyframes jgstampA{0%{transform:scale(2.5) rotate(-15deg);opacity:0;filter:url(#jgInk1) blur(1.5px)}' +
    ' 38%{opacity:0}52%{transform:scale(.9) rotate(-8.5deg);opacity:.9;filter:url(#jgInk1)}' +
    ' 64%{transform:scale(1.07) rotate(-8.5deg)}78%{transform:scale(.985) rotate(-8.5deg)}' +
    ' 100%{transform:scale(1) rotate(-8.5deg);opacity:.9}}' +
    '@keyframes jgstampB{0%{transform:scale(2.5) rotate(12deg);opacity:0;filter:url(#jgInk2) blur(1.5px)}' +
    ' 38%{opacity:0}52%{transform:scale(.9) rotate(6.5deg);opacity:.9;filter:url(#jgInk2)}' +
    ' 64%{transform:scale(1.07) rotate(6.5deg)}78%{transform:scale(.985) rotate(6.5deg)}' +
    ' 100%{transform:scale(1) rotate(6.5deg);opacity:.9}}' +
    // the card takes the hit — a small jolt under the stamp landing
    '.jg-jolt{animation:jgjolt 560ms cubic-bezier(.2,.8,.3,1) both;}' +
    '@keyframes jgjolt{0%,100%{transform:translateY(0)}30%{transform:translateY(3px)}' +
    ' 55%{transform:translateY(-1.5px)}}' +
    // she asked for no motion? then it is simply a stamp already on the paper
    '@media (prefers-reduced-motion:reduce){.jg-stamp.live .jg-stampmark,' +
    '.jg-stamp.live.b .jg-stampmark,.jg-jolt{animation:none;}}';
  document.head.appendChild(css);

  // The ink filters the stamp is drawn through — an feTurbulence displacement
  // that chews the mark's edges so nothing about it is a clean printed shape.
  // Two of them (different frequency and seed) so the two halves of a spread
  // never wear identically. A `filter:url(#…)` needs the filter to be IN the
  // document, so this rides along with the stylesheet rather than living in
  // any one page's markup.
  var inkDefs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  inkDefs.setAttribute('width', '0');
  inkDefs.setAttribute('height', '0');
  inkDefs.setAttribute('aria-hidden', 'true');
  inkDefs.setAttribute('style', 'position:absolute;pointer-events:none');
  inkDefs.innerHTML =
    '<filter id="jgInk1" x="-25%" y="-25%" width="150%" height="150%">'
    + '<feTurbulence type="fractalNoise" baseFrequency="0.085" numOctaves="3" seed="11" result="n"/>'
    + '<feDisplacementMap in="SourceGraphic" in2="n" scale="6.5" xChannelSelector="R" yChannelSelector="G"/>'
    + '</filter>'
    + '<filter id="jgInk2" x="-25%" y="-25%" width="150%" height="150%">'
    + '<feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves="3" seed="4" result="n2"/>'
    + '<feDisplacementMap in="SourceGraphic" in2="n2" scale="5.5" xChannelSelector="R" yChannelSelector="G"/>'
    + '</filter>';
  document.addEventListener('DOMContentLoaded', function () {
    if (!inkDefs.parentNode) document.body.appendChild(inkDefs);
  });
  if (document.body) document.body.appendChild(inkDefs);

  // the note + — same glyph compare.js draws, so the mark reads the same
  // wherever she meets it
  var PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

  // ── HER ✕ AND ♥, DRAWN BY HAND (Aug 2026, Sophie, pointing at the ✕ inside
  // one of her own cards: "can you make this X that I gave as a screenshot,
  // and make the heart actually kind of a handwriting look?"). The glyphs were
  // the plain ✕ and ♥ CHARACTERS in the system sans — geometric, evenly
  // weighted, and the only two marks on a card that is otherwise all her
  // serif and her cream. These are drawn as filled strokes with real stroke
  // contrast (thick through the middle, tapering at the ends, each stroke
  // slightly bowed and the two of them crossing a hair off-centre) so they
  // read as PEN rather than as UI. Deliberately not Lucide: the house line
  // icons are for chrome, and this is inside her own design.
  // Each stroke is a filled outline, not a `stroke` — that is what buys the
  // weight through the middle and the CHISEL CAP at each end (the short flat
  // the two edges close across), the marks a broad nib leaves. The two strokes
  // cross a little below centre and neither is quite the other's mirror.
  var MOM_X = '<svg viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M4.28 4.92 Q9.31 14.69 19.08 19.72 L19.72 19.08 Q14.69 9.31 4.92 4.28 Z"/>'
    + '<path d="M19.52 5.12 Q14.62 14.82 5.12 19.92 L4.48 19.28 Q9.38 9.58 18.88 4.48 Z"/>'
    + '</svg>';
  // one lopsided heart — the left lobe a little lower and tighter than the
  // right, the tip a hair left of centre, the way one comes out of a pen
  var MOM_HEART = '<svg viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M11.4 21.2 C8.4 18.5 3 14.4 2.6 10.3 C2.2 6.8 5.2 4.2 8.2 5.1'
    + ' C9.9 5.6 11.1 6.8 11.9 8.2 C12.8 6.6 14.3 5.2 16.2 5 C19.4 4.7 21.8 7.4 21.2 10.7'
    + ' C20.5 14.7 14.4 18.6 11.4 21.2 Z"/></svg>';
  // ── AND HER MAYBE (Aug 2026, Sophie: "can you add a maybe option in the
  // Tinder checklist template?"). A question mark, drawn the same way the ✕
  // and the ♥ are — a filled ribbon with real stroke contrast and a chisel
  // cap where it stops, plus a lopsided dot. Deliberately NOT `I.maybe`, the
  // dashed circle: that one is a Lucide-weight LINE icon and belongs to the
  // house chrome, and it would be the only geometric mark on her card.
  // The ribbon is narrow where the nib enters (top left), heaviest over the
  // shoulder, and closes on a chisel cap at the tail; the dot is an egg, not
  // a circle.
  var MOM_MAYBE = '<svg viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M6.75 8.85 C6.55 4.85 10 2.3 13.4 2.6 C16.9 2.9 19.1 5.5 18.6 8.5'
    + ' C18.15 11.3 15.6 12.5 14.05 13.75 C13 14.55 12.8 15.3 12.9 16.4 L10.45 16.55'
    + ' C10.3 13.9 10.95 12.55 12.4 11.45 C13.75 10.35 15.6 9.7 15.65 8.3'
    + ' C15.7 6.85 14.6 5.6 13.1 5.5 C11.6 5.4 9 6.2 8.65 8.95 Z"/>'
    + '<path d="M11.2 18.45 C12.45 18.15 13.75 18.85 13.7 20.05 C13.65 21.05 12.6 21.75'
    + ' 11.55 21.4 C10.5 21.05 10.05 19.85 10.65 19 Z"/></svg>';

  var I = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.4v13.2L18.6 12z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="5.4" width="3.2" height="13.2" rx="1"/><rect x="13.8" y="5.4" width="3.2" height="13.2" rx="1"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    maybe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-dasharray="3.5 3.5"/></svg>',
    later: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
  };
  var DEFAULT_PILES = [
    { key: true,    name: 'Loved' },
    { key: 'maybe', name: 'Maybe' },
    { key: 'later', name: 'Later' },
    { key: false,   name: 'Passed' },
  ];

  window.__judge = function (opts) {
    opts = opts || {};
    var chat = opts.chat, sheet = opts.sheet;
    var items = (opts.items || []).filter(function (it) { return it && it.id; });
    var mount = document.querySelector(opts.mount || '#judge');
    if (!mount || !items.length) return;

    // THE DECK TEMPLATE'S OPTIONS (Aug 2026, Sophie):
    //   states — her own verdicts ('done' / 'in progress') instead of the
    //            four defaults; strings ride the verdict route as-is.
    //   browse — "you don't have to take any action per card… tapping on the
    //            screen to the right or left goes backwards or forwards":
    //            edge taps (and a swipe) navigate, judging is optional, a
    //            judged card advances one step instead of jumping around.
    //   voice  — a tap-to-record mic on every card; the note lands on the
    //            card as her transcribed message (POST /page-voice).
    var states = Array.isArray(opts.states) && opts.states.length >= 2
      ? opts.states.filter(function (s) { return s && s.label !== undefined; }) : null;
    var browse = !!opts.browse;
    var voice = !!opts.voice;
    // ── THE GOOD / BAD STAMP (see the CSS). ON by default — it is what a
    // decided card looks like now; `stamp:false` turns it off for a deck
    // where a red verdict would be wrong. Her words are overridable because
    // her own artboard made them a field.
    var stampOn = opts.stamp !== false;
    var GOOD_WORD = opts.goodWord || 'GOOD';
    var BAD_WORD = opts.badWord || 'BAD';
    // the item whose stamp should ANIMATE on the next paint — set by judge(),
    // consumed by the paint. A card revisited later still WEARS its stamp; it
    // just does not slam on a second time.
    var stampNow = null;
    var piles = (states
      ? states.map(function (s) { return { key: s.key, name: s.label }; })
      : DEFAULT_PILES).concat([{ key: undefined, name: 'Unsorted' }]);

    var verdicts = {}, notes = {}, undoStack = [], cur = 0, view = 'card';
    var noteTimer = null, momNote = null;

    // ── THE REVIEW QUEUE'S DOOR (Aug 2026). `?clean=1` is how the queue opens
    // a deck — no title, straight onto the cards — so it is also how this page
    // knows there is a queue to go back to, and that its Skip/Done belong on
    // screen. A deck opened from the Compare tab has neither.
    var fromQueue = /[?&]clean=1/.test(location.search);
    // `?back=1` — THE CHATS APP OPENED THIS AND DREW NO BAR OF ITS OWN (Aug
    // 2026, Sophie: "give me the option of going back to the compare tab
    // cause that takes a room in the top"). Deliberately NOT `clean=1`: that
    // one means "the Review Queue sent me", and it also turns on Skip/Done in
    // the piles view, which are the queue's verbs and not the Compare tab's.
    // Both show the chevron; only clean=1 claims the queue.
    var wantBack = fromQueue || /[?&]back=1/.test(location.search);
    // the page doc's id, out of the sheet the template renderer set
    var pageId = /^page-(.+)$/.test(sheet || '') ? String(sheet).slice(5) : '';

    // A MOMENT DECK — any deck carrying her date cards — wears her Decision
    // Deck chrome whole: her cream behind the page, the Newsreader serif
    // (fetched once from Google Fonts, Georgia the fallback while it loads),
    // the thin progress line, Piles + ? up top, her footer on every date card.
    var herLook = opts.look === 'mom';
    var momDeck = herLook || opts.style === 'moment'
      || items.some(function (x) { return isMoment(x); });
    if (momDeck && !states) {
      // the piles speak the mockup's words — ♥, ? and ✕ (Aug 2026: maybe
      // joined the two she started with). 'Unsure' is the UNMARKED pile and
      // stays last; Maybe is a mark she gave, so it sits with the others.
      piles = [{ key: true, name: 'Yes' }, { key: 'maybe', name: 'Maybe' },
        { key: false, name: 'No' }, { key: undefined, name: 'Unsure' }];
    }
    if (momDeck) {
      document.body.classList.add('jg-mombg');
      if (!document.getElementById('jg-newsreader')) {
        var pre = document.createElement('link');
        pre.rel = 'preconnect'; pre.href = 'https://fonts.googleapis.com';
        var fl = document.createElement('link');
        fl.id = 'jg-newsreader'; fl.rel = 'stylesheet';
        fl.href = 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght'
          + '@0,6..72,400..700;1,6..72,400..600&display=swap';
        document.head.appendChild(pre); document.head.appendChild(fl);
      }
      // THE KEYBOARD MUST NOT COVER THE NOTE BOX (Aug 2026, her report: "I'm
      // usually using the microphone, but the keyboard still comes up and
      // blocks the note box" — iOS raises the keyboard for dictation too).
      // The deck is one fixed screen with nothing to scroll, so WebKit has no
      // way to bring the box into view itself; instead the column follows the
      // VISUAL viewport: while the note box is focused the deck's height
      // becomes the visible height above the keyboard — the card shrinks
      // (flex:1, and it scrolls inside itself) and the footer stays on
      // screen. In the app the page lives in a SAME-ORIGIN iframe under the
      // viewer's top bar, and the keyboard signal only lands on the TOP
      // window's visualViewport — so we listen there and subtract the
      // iframe's own top. Cleared the moment the keyboard goes.
      (function () {
        var topWin = window;
        try { if (window.top && window.top.document) topWin = window.top; } catch (_) { /* cross-origin — stay local */ }
        var vv = topWin.visualViewport || window.visualViewport;
        if (!vv) return;
        var kbFit = function () {
          var col = mount.querySelector('.jg.mom');
          if (!col) return;
          var el = document.activeElement;
          var typing = el && el.classList && el.classList.contains('jg-momnote');
          // the layout viewport is the keyboard-free baseline (window.innerHeight
          // tracks the visual viewport on iOS, so it can't be the reference)
          var base = topWin.document.documentElement.clientHeight;
          var frameTop = 0;
          try {
            if (window.frameElement) frameTop = window.frameElement.getBoundingClientRect().top;
          } catch (_) { /* cross-origin — treat as top-level */ }
          if (typing && vv.height < base - 60) {
            col.style.height = Math.max(200, Math.round(vv.height - frameTop)) + 'px';
            window.scrollTo(0, 0);   // WebKit nudges the page under the box — pin it back
          } else {
            col.style.height = '';
          }
        };
        vv.addEventListener('resize', kbFit);
        vv.addEventListener('scroll', kbFit);
        document.addEventListener('focusin', kbFit);
        document.addEventListener('focusout', function () { setTimeout(kbFit, 60); });
      })();
    }

    // ── TAPPING THE PICTURE OPENS THE ASSETS LIGHTBOX (Aug 2026, Sophie: "I
    // think I want the same exact asset tab formula w heart ex prompt note
    // chat etc in lightbox view, and u can have tinder one choice when not in
    // lightbox"). So the card keeps ONE choice — her ✕/♥ and the note box at
    // the bottom — and everything else about a picture lives behind the
    // picture: its own ♥/✕, both halves of the prompt, and the note thread.
    // /asset-view.js is the adapter, shared with grid.js so a tile and a swipe
    // card open exactly the same thing. A hand-built judge page that doesn't
    // carry it keeps compare.js's plain lightbox, which is why this is a
    // capability test and not an assumption.
    // A PICTURE INSIDE A SPREAD HAS ITS OWN HEART, AND IT IS THE ASSETS
    // TAB'S (Aug 2026, Sophie, on the witch reels: "the heart doesn't work in
    // the review queue… per image. they're supposed to tie back in to the
    // original chat likes so all likes are synchronized everywhere"). The
    // card's ♥/✕ answers the SPREAD — that is the whole point of a spread key
    // — so a per-picture heart cannot be the card's verdict, and the old cast
    // simply did nothing at all for one: it compared the picture's id against
    // the spread's, which never match, so her tap fell on the floor and
    // NOTHING was written anywhere. A picture's own mark is the asset vote,
    // exactly what the grid's tile casts on an own-states page.
    function onDeck(it) {
      return !!it && items.some(function (x) { return x.id === it.id; });
    }
    var assetVotes = {};   // url → 'like' | 'dislike', the Assets tab's own
    var views = window.__assetViews ? window.__assetViews({
      chat: chat,
      voteOf: function (it) {
        if (!onDeck(it)) return assetVotes[it.url] || null;
        return verdicts[it.id] === true ? 'like'
          : verdicts[it.id] === false ? 'dislike' : null;
      },
      // the lightbox's ♥/✕ is the CARD's mark when she is on that card —
      // one verdict, reachable from either surface, never two that disagree
      cast: function (it, v, a) {
        if (onDeck(it)) { judge(v === 'like'); return; }
        a.vote = a.vote === v ? null : v;
        if (a.vote) assetVotes[it.url] = a.vote; else delete assetVotes[it.url];
        mirrorVote(it, a.vote === 'like' ? true : a.vote === 'dislike' ? false : null);
        if (a._lbPaint) a._lbPaint();
      },
    }) : null;

    // ♥/✕ on an asset-backed card lands in the Assets tab too (Sophie: the
    // page and the tab "should agree"). Only the boolean pair mirrors —
    // 'like'/'dislike' are the only words the asset vote speaks.
    function mirrorVote(it, val) {
      if (!it.url) return;
      var vote = val === true ? 'like' : val === false ? 'dislike' : null;
      fetch('/api/gallery/assets/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: chat, url: it.url, vote: vote }),
      }).catch(function () { /* the page's own verdict still saved */ });
    }
    function mirrorNote(it, text) {
      if (!it.url || !text) return;
      fetch('/api/gallery/assets/note', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: chat, url: it.url, text: text, from: 'sophie' }),
      }).catch(function () { /* the page's own thread still has it */ });
    }

    // ── THE MIC (Aug 2026). One tap starts, one tap stops — and what happens
    // in between decides which kind of note it is, so there is no mode
    // toggle to remember:
    //   stayed on one card  → the transcript lands on THAT card
    //     (pinned to where the recording STARTED, so finishing a sentence
    //     while swiping onward cannot mis-file it — POST /page-voice);
    //   swiped while talking → HANDS-FREE: the page logs when each card came
    //     up, the server transcribes once with sentence start-times, and
    //     each sentence lands on the card showing when she STARTED saying it
    //     (POST /page-voice-session; built the day her in-app mic probe
    //     passed, 2026-08-17). Every note carries the recording's url and
    //     its card's timestamp, so the original is always a tap away.
    var mrec = null, recIt = null, recStart = 0, recTimeline = null;
    function recActive() { return !!mrec; }
    function toast(msg) {
      var t = document.createElement('div');
      t.className = 'jg-toast';
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 3200);
    }
    function toggleRec() {
      if (mrec) { try { mrec.stop(); } catch (_) { mrec = null; } return; }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia
          || typeof MediaRecorder === 'undefined') {
        toast('The mic isn’t available here — typed notes still work.');
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        var chunks = [];
        mrec = new MediaRecorder(stream);
        recIt = items[cur];
        recStart = Date.now();
        recTimeline = [{ item: recIt.id, at: 0 }];
        mrec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        mrec.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          mrec = null;
          var it = recIt || items[cur];
          var tl = recTimeline || [];
          recIt = null; recTimeline = null;
          render();
          var blob = new Blob(chunks, { type: chunks[0] && chunks[0].type || 'audio/webm' });
          if (blob.size > 20000000) { toast('That one’s too long to keep here — under ~20 minutes.'); return; }
          if (!blob.size) return;
          var rd = new FileReader();
          rd.onloadend = function () {
            if (tl.length > 1) {
              // she swiped while talking — split the one recording across
              // the cards, each sentence to the card it started on
              toast('Splitting the voice notes across ' + tl.length + ' cards…');
              fetch('/api/chatfeed/page-voice-session', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat: chat, sheet: sheet, audio: rd.result, timeline: tl }),
              }).then(function (r) { return r.json(); }).then(function (d) {
                if (!d || !d.ok) { toast('Couldn’t save that voice session.'); return; }
                var ids = Object.keys(d.perCard || {});
                Object.keys(d.texts || {}).forEach(function (id) { notes[id] = d.texts[id]; });
                ids.forEach(function (id) {
                  var target = null;
                  items.forEach(function (x) { if (x.id === id) target = x; });
                  if (target) mirrorNote(target, d.perCard[id] + ' (voice: ' + d.url + ')');
                });
                toast('Voice notes on ' + ids.length + ' card' + (ids.length === 1 ? '' : 's')
                  + ' — open a card to read its part.');
                if (view === 'card') render();
              }).catch(function () { toast('Couldn’t save that voice session.'); });
              return;
            }
            toast('Saving the voice note…');
            fetch('/api/chatfeed/page-voice', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat: chat, sheet: sheet, item: it.id, audio: rd.result }),
            }).then(function (r) { return r.json(); }).then(function (d) {
              if (!d || !d.ok) { toast('Couldn’t save that voice note.'); return; }
              notes[it.id] = d.text || notes[it.id];
              toast(d.transcript ? '“' + d.transcript.slice(0, 80) + '…” — on the card.'
                : 'Voice note attached.');
              mirrorNote(it, (d.transcript || 'voice note') + ' (voice: ' + d.url + ')');
              if (items[cur] === it && view === 'card') render();
            }).catch(function () { toast('Couldn’t save that voice note.'); });
          };
          rd.readAsDataURL(blob);
        };
        mrec.start();
        render();
      }).catch(function () {
        toast('Mic permission was refused here — typed notes still work.');
      });
    }

    function post(body) {
      body.chat = chat; body.sheet = sheet;
      return fetch('/api/chatfeed/verdict', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(function (r) { return r.json(); }).then(function (d) {
        // A VERDICT THAT DID SOMETHING SAYS SO (Aug 2026). On an archive-review
        // deck the server acts on her mark, and she has already been burned
        // once by a chip that looked like a button and only filed an opinion —
        // so the confirmation is the point, not decoration.
        if (d && d.archived && d.archived.chat) {
          toast(d.archived.archived ? 'Archived' : 'Back on your list');
        }
        return d;
      }).catch(function () { /* offline — local state still holds */ });
    }
    function saveNote(id, text) {
      notes[id] = text;
      clearTimeout(noteTimer);
      noteTimer = setTimeout(function () { post({ item: id, text: text }); }, 700);
    }
    window.addEventListener('pagehide', function () {
      // a half-typed note survives leaving (same contract as __compareNotes)
      var it = items[cur];
      if (!it) return;
      var text = null;
      var mb = mount.querySelector('.jg-momnote');
      if (mb && momNote && momNote.item === it.id && mb.value.trim()) {
        text = momNote.compose();   // her box edits the thread's last message
      } else {
        var box = mount.querySelector('.cmp-note-box');
        if (box && box.value.trim()) text = box.value;
      }
      if (!text) return;
      try {
        navigator.sendBeacon('/api/chatfeed/verdict', new Blob([JSON.stringify({
          chat: chat, sheet: sheet, item: it.id, text: text,
        })], { type: 'application/json' }));
      } catch (_) { /* nothing else to do */ }
    });

    function firstUnjudged() {
      for (var i = 0; i < items.length; i++) if (verdicts[items[i].id] === undefined) return i;
      return -1;
    }
    function judge(val) {
      var it = items[cur];
      var prev = verdicts[it.id];
      // in browse mode the lit verdict is visible, so tapping it again clears
      if (browse && prev === val) val = null;
      undoStack.push({ i: cur, prev: prev });
      if (val === null) delete verdicts[it.id]; else verdicts[it.id] = val;
      post({ item: it.id, ok: val });
      if (val === true || val === false || prev === true || prev === false) mirrorVote(it, val);
      // …and into an open lightbox, so its ♥ agrees with the card's
      if (views) views.sync(it, val === true ? 'like' : val === false ? 'dislike' : null);
      // a yes / no / pick is the one thing the stamp has anything to say
      // about — so that is what makes it slam on rather than simply sit there
      stampNow = (val === true || val === false || isPick(it, val)) ? it.id : null;
      if (browse) {
        // A MARK NEVER MOVES THE DECK (Aug 2026, Sophie, on her date deck:
        // "hearting, heart or exing should not move the moment, only tapping
        // on the sides should go to the next moment"). Marking and moving are
        // separate gestures here: the ♥/✕ stay put so she can mark, re-read,
        // change her mind, then leave when she is ready. Only the edge taps
        // and the swipe navigate. (A deck with no browse mode has no edges to
        // tap, so there the verdict still advances — that is the classic
        // Tinder page and its only way forward.)
      } else if (stampNow && stampOn) {
        // A DECK WITH NO BROWSE MODE ADVANCES ON THE MARK — so without this
        // the stamp would be painted onto a card that is replaced in the same
        // frame and she would never see it land. The move waits out the
        // animation instead (the stamp's own 560ms), and the card she is
        // leaving is the one that wears it.
        render(true);
        var leaving = cur;
        setTimeout(function () {
          if (cur !== leaving || view !== 'card') return;
          var n = firstUnjudged();
          if (n === -1) { view = 'piles'; } else { cur = n; }
          render(true);
        }, 620);
        return;
      } else {
        var next = firstUnjudged();
        if (next === -1) { view = 'piles'; } else { cur = next; }
      }
      render(true);
    }
    function nav(step) {
      var to = cur + step;
      if (to < 0) return;
      if (to > items.length - 1) { view = 'piles'; render(true); return; }
      cur = to; view = 'card'; render(true);
    }
    function undo() {
      var u = undoStack.pop();
      if (!u) return;
      var it = items[u.i];
      var was = verdicts[it.id];
      if (u.prev === undefined) { delete verdicts[it.id]; post({ item: it.id, ok: null }); }
      else { verdicts[it.id] = u.prev; post({ item: it.id, ok: u.prev }); }
      if (was === true || was === false || u.prev === true || u.prev === false) {
        mirrorVote(it, u.prev === undefined ? null : u.prev);
      }
      cur = u.i; view = 'card'; render(true);
    }

    // the card-face menu (Aug 2026): square (the XI deck), portrait (a story
    // fragment's rectangle), landscape. The page picks one; a single item
    // may pick its own. Anything else keeps the item's natural shape.
    var AR = { square: '1/1', portrait: '5/7', landscape: '7/5' };
    function arOf(it) { return AR[it.aspect] || AR[opts.aspect] || ''; }
    // THE MOMENT CARD (Aug 2026, Sophie's Decision Deck design). Every part is
    // optional and the card renders only what it carries — "some might have
    // just one text or they might have like a text and an image". A card with
    // any of who/eyebrow/sections/caption gets this look automatically;
    // style:'moment' opts PLAIN text cards in too.
    function isMoment(it) {
      if (it.pair || it.card) return false;
      // `look:'mom'` — a TEMPLATE deck, so every card is one of hers, picture
      // or words (Aug 2026 v3: "make the single image review surface the same
      // general template as the text one"). The older tests stand: a page that
      // asked for style:'moment', or a card carrying any of her parts.
      if (herLook && (it.text || it.img || (it.cards && it.cards.length))) return true;
      return !!(it.who || it.eyebrow || it.caption || (it.sections && it.sections.length)
        || (opts.style === 'moment' && it.text));
    }
    // her NAME line: the card's own `who`, else the label it was filed under —
    // which is what a picture card carries ("XI — the hermit v1")
    function momName(it) { return it.who || it.label || ''; }
    /** her verdict on a spread is the WINNING CARD'S ID — a string that is
     *  none of the stock words. That is what "picked" means here. */
    function isPick(it, v) {
      return !!(it && it.cards && typeof v === 'string' && v !== 'maybe' && v !== 'later');
    }
    // "IF THE TEXT IS REALLY LONG" (Aug 2026, Sophie) — the card's own words,
    // counted across every part it carries. Measured against her live deck:
    // the card she reported scrolling holds ~530 characters, and the cards
    // that sit comfortably on one screen are under ~200, so the line is drawn
    // between them. A card with a picture is long the moment it has much to
    // say at all, because the picture is already taking the height.
    function isLong(it) {
      if (!it || !isMoment(it)) return false;
      var n = String(it.text || '').length + String(it.caption || '').length;
      (it.sections || []).forEach(function (s) {
        n += String(s.text || '').length + String(s.label || '').length;
      });
      return n > (it.img ? 150 : 240);
    }
    // `hoisted` — the name is being drawn in the page's top chrome instead
    // (a moment deck), so the stack starts at the first box
    function momentHtml(it, ar, hoisted) {
      var out = '';
      if (momName(it) && !hoisted) out += '<div class="who">' + esc(momName(it)) + '</div>';
      // box one: the eyebrow and the moment share a box, exactly her mockup
      var first = '';
      if (it.eyebrow) first += '<span class="eyebrow">' + esc(it.eyebrow) + '</span>';
      if (it.text) first += '<p class="moment">' + esc(it.text) + '</p>';
      if (first) out += '<div class="jg-mombox">' + first + '</div>';
      (it.sections || []).forEach(function (sec) {
        out += '<div class="jg-mombox">'
          + (sec.label ? '<span class="seclabel">' + esc(sec.label) + '</span>' : '')
          + '<p class="sectext">' + esc(sec.text) + '</p></div>';
      });
      // A SPREAD: several pictures on ONE card, side by side, each named and
      // each opening its own lightbox (Aug 2026, Sophie: "so I can leave a
      // note per card, or per spread. same w heart"). The card's ✕/♥ and the
      // note box below it are the SPREAD's; a picture's own heart, prompt and
      // note thread live behind the picture. This is also, exactly, the
      // two-up picker — it falls out of the shape rather than being a third
      // thing to build.
      if (it.cards && it.cards.length) {
        out += '<div class="jg-spread">' + it.cards.map(function (c) {
          return '<figure class="hug">'
            + '<img' + (views ? ' data-zoom="' + esc(c.id) + '"' : ' class="zoom"')
            + ' src="' + esc(c.img) + '" alt="' + esc(c.label || '') + '"'
            + (c.full ? ' data-full="' + esc(c.full) + '"' : '') + '>'
            + (c.label ? '<figcaption>' + esc(c.label) + '</figcaption>' : '')
            // PICKING ONE OF THEM (Aug 2026, Sophie: "is there a way to pick
            // one or the other if I'm choosing between them? Maybe best is to
            // just have a 'this one' small button underneath each one"). The
            // spread's verdict becomes the WINNING CARD'S ID — so what is
            // recorded is "silkscreen won this spread", not "she liked a
            // card". ♥/✕ below still answer the spread as a whole (both, or
            // neither), and tapping the lit pick clears it.
            + '<button type="button" class="jg-pick'
            + (verdicts[it.id] === c.id ? ' on' : '') + '" data-pick="' + esc(c.id)
            + '">this one</button>'
            + '</figure>';
        }).join('') + '</div>';
      }
      if (it.img) {
        // no card-face shape asked for → the panel HUGS the picture and caps
        // its height, so a picture card is one screen like everything else
        // here (a page or item that names an aspect keeps filling that shape)
        // `zoom` is compare.js's own lightbox, bound at document level. When
        // the Assets adapter is here the picture must open THAT instead, so
        // the class comes off and the tap is ours — swapping handlers on the
        // same class would be a race with a listener we do not own.
        out += '<figure class="' + (ar ? 'ar' : 'hug') + '"'
          + (ar ? ' style="aspect-ratio:' + ar + '"' : '') + '>'
          + '<img class="' + (views ? '' : 'zoom') + (ar ? ' fill' : '') + '"'
          + (views ? ' data-zoom="' + esc(it.id) + '"' : '')
          + ' src="' + esc(it.img) + '"'
          + ' alt="' + esc(it.label || '') + '"'
          + (it.full ? ' data-full="' + esc(it.full) + '"' : '') + '></figure>';
      }
      if (it.caption) {
        out += '<div class="jg-mombox"><span class="seclabel">'
          + esc(it.captionLabel || 'Caption') + '</span>'
          + '<p class="cap">\u201c' + esc(it.caption) + '\u201d</p></div>';
      }
      return '<div class="jg-mom">' + out + '</div>';
    }
    // THE CARD'S WAY OUT — an item's `link` (page-templates.js), as a real
    // anchor. It sits ABOVE the browse zones for the same measured reason the
    // spread does: the zones are 26%-wide strips at z-index 2 and a centred
    // link lands between them, but its ENDS reach into them, so a thumb
    // slightly off centre would page the deck instead of opening the link.
    function linkHtml(it) {
      if (!it || !it.link || !it.link.url) return '';
      return '<div class="jg-momlink"><a href="' + esc(it.link.url) + '"'
        + ' target="_blank" rel="noopener">' + esc(it.link.label || 'Open')
        + ' ›</a></div>';
    }
    function mediaHtml(it, hoisted) {
      return mediaBody(it, hoisted) + linkHtml(it);
    }
    function mediaBody(it, hoisted) {
      var ar = arOf(it);
      var sq = ar ? ' sq' : '';
      var ars = ar ? ' style="aspect-ratio:' + ar + '"' : '';
      if (isMoment(it)) return momentHtml(it, ar, hoisted);
      // a TEMPLATE item's words render ESCAPED — template data carries no
      // HTML by design (page-templates.js); `card` below stays page-authored
      // trusted HTML for hand-built judge pages
      if (it.text && !it.img && !it.pair && !it.card) {
        return '<div class="jg-cardtext' + sq + '"' + ars + '>' + esc(it.text) + '</div>';
      }
      if (it.card) return '<div class="jg-cardtext">' + it.card + '</div>';
      if (it.pair) {
        return '<div class="jg-media">' + it.pair.map(function (p) {
          return '<figure><span class="tag">' + esc(p.label || '') + '</span>'
            + '<img class="zoom" src="' + esc(p.img) + '" alt="' + esc(p.label || '') + '"'
            + (p.full ? ' data-full="' + esc(p.full) + '"' : '') + '></figure>';
        }).join('') + '</div>';
      }
      return '<div class="jg-media' + sq + '"><figure' + ars + '><img class="zoom" src="' + esc(it.img) + '"'
        + ' alt="' + esc(it.label || '') + '"'
        + (it.full ? ' data-full="' + esc(it.full) + '"' : '') + '></figure></div>';
    }
    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    /** ── PAINTING THE STAMP ──
     *  A card that carries a yes/no verdict wears the mark; the one just
     *  decided gets `live` and slams on. It is added to the DOM after the
     *  card is written rather than built into the card's HTML string, because
     *  the two render paths (her moment card returns early) would otherwise
     *  each need their own copy of it.
     *
     *  Which mark:
     *   · a SPREAD she picked a winner on → the winner takes GOOD, the other
     *     takes BAD, each on its own picture. That is the whole point of the
     *     pair — "the ones that you pick or don't pick".
     *   · anything else with ♥ / ✕ → one big stamp across the card.
     *   · maybe / later / a deck's own words → nothing. There is no good and
     *     no bad in "sort this one later", and a red stamp would invent a
     *     verdict she did not give.
     */
    function stampHtml(word, side, live) {
      return '<div class="jg-stamp' + (side === 'b' ? ' b' : '')
        + (live ? ' live' : '') + '" aria-hidden="true">'
        + '<span class="jg-stampmark">' + esc(word) + '</span></div>';
    }
    function paintStamp(it) {
      if (!stampOn || !it) return;
      var v = verdicts[it.id];
      var live = stampNow === it.id;
      stampNow = null;
      var spread = mount.querySelector('.jg-spread');
      if (spread && isPick(it, v)) {
        [].slice.call(spread.querySelectorAll('figure')).forEach(function (fig) {
          var btn = fig.querySelector('[data-pick]');
          if (!btn) return;
          var won = btn.getAttribute('data-pick') === v;
          fig.insertAdjacentHTML('beforeend',
            stampHtml(won ? GOOD_WORD : BAD_WORD, won ? 'a' : 'b', live));
        });
        if (live) joltCard();
        return;
      }
      if (v !== true && v !== false) return;
      var wrap = mount.querySelector('.jg-cardwrap');
      if (!wrap) return;
      wrap.insertAdjacentHTML('beforeend',
        stampHtml(v === true ? GOOD_WORD : BAD_WORD, 'a', live));
      if (live) joltCard();
    }
    // the paper takes the hit — one small jolt, removed when it finishes so a
    // later re-render never inherits a spent animation
    function joltCard() {
      var card = mount.querySelector('.jg-card');
      if (!card) return;
      card.classList.add('jg-jolt');
      setTimeout(function () { card.classList.remove('jg-jolt'); }, 600);
    }

    function render(flash) {
      // the mini autoscroll asks "does this card overflow?" a frame later, so
      // it measures the DOM this call is about to write — scheduled here, at
      // the top, because both branches below end in their own way (the moment
      // branch returns early) and this is the one place that covers all of it
      requestAnimationFrame(miniSync);
      // hands-free: while the mic runs, every card change is logged so the
      // recording can be split back onto the cards afterwards
      if (mrec && recTimeline && view === 'card' && items[cur]
          && recTimeline[recTimeline.length - 1].item !== items[cur].id) {
        recTimeline.push({ item: items[cur].id, at: Date.now() - recStart });
      }
      var judged = items.filter(function (it) { return verdicts[it.id] !== undefined; }).length;
      var momCls = momDeck ? ' mom' : '';
      // a long card drops the big centred title for a small top-left one and
      // reserves room under its words for the floating ✕/♥ (see the CSS)
      if (momDeck && view === 'card' && items[cur] && isLong(items[cur])) momCls += ' long';
      // the way back to the Review Queue, when that is where she came from
      var back = wantBack
        ? '<button class="jg-back" data-act="back" aria-label="Back">'
          + I.back + '</button>' : '';
      var top;
      if (momDeck) {
        // her chrome: the thin progress line (position through the deck, like
        // the mockup), then Piles + ? — the name that lived on this row sits
        // lower now, centred on the card (her ask)
        var pct = Math.round(((view === 'piles' ? items.length : cur) / items.length) * 100);
        top = '<div class="jg-prog"><i style="width:' + pct + '%"></i></div>'
          + '<div class="jg-momtop">' + back
          + '<button class="jg-pilesbtn" data-act="piles">Piles</button>'
          // FILLED WHEN THERE IS SOMETHING OF HERS BEHIND IT — otherwise the
          // "?" looks the same on every card and she has no reason to tap the
          // one that holds her own words about this concept.
          + '<button class="jg-momq' + (items[cur] && items[cur].said ? ' has' : '')
          + '" data-act="help" aria-label="'
          + (items[cur] && items[cur].said ? 'What you said about this'
                                           : 'What the buttons mean') + '">?</button>'
          + '</div>';
      } else {
        top = '<div class="jg-top">' + back + '<span class="jg-count">'
          + (view === 'piles' ? judged + ' of ' + items.length + ' sorted'
                              : (cur + 1) + ' of ' + items.length) + '</span>'
          + '<button class="jg-ic" data-act="undo" aria-label="Undo">' + I.undo + '</button>'
          + '<button class="jg-ic" data-act="piles" aria-label="Piles">' + I.grid + '</button>'
          + '<button class="jg-ic txt" data-act="help" aria-label="What the icons mean">?</button></div>';
      }

      // data-nostop: in the app a Compare page is EMBEDDED (chats.html's
      // parent pill + its tap-to-toggle gesture on this document). A judge
      // page has nothing to scroll, so no tap here may ever START the scroll.
      if (view === 'piles') {
        // HER PILES ARE Yes / Maybe / No / Unsure — but a card marked before
        // this deck became hers may hold 'later', and a pile list that cannot
        // name it would drop those cards off the screen entirely. So a legacy
        // pile is added only when something is actually in it, and it sits
        // before Unsorted, which stays last. ('maybe' left this list in Aug
        // 2026 when she asked for the button — it is a pile of its own now.)
        var shown = piles;
        if (momDeck && !states) {
          var legacy = [];
          // a SPREAD she picked a winner on holds that card's id as its
          // verdict, which matches no pile of its own — and a pile list that
          // cannot name it would drop the spread off this screen entirely
          if (items.some(function (it) { return isPick(it, verdicts[it.id]); })) {
            legacy.push({ key: '__picked', name: 'Picked',
              match: function (v, it) { return isPick(it, v); } });
          }
          [['later', 'Later']].forEach(function (p) {
            if (items.some(function (it) { return verdicts[it.id] === p[0]; })) {
              legacy.push({ key: p[0], name: p[1] });
            }
          });
          if (legacy.length) shown = piles.slice(0, -1).concat(legacy, piles.slice(-1));
        }
        var sections = shown.map(function (p) {
          var members = items.filter(function (it) {
            return p.match ? p.match(verdicts[it.id], it) : verdicts[it.id] === p.key;
          });
          if (!members.length) return '';
          return '<h2>' + p.name + ' · ' + members.length + '</h2><div class="jg-grid">'
            + members.map(function (it) {
              if (it.card || (it.text && !it.img && !it.pair) || (isMoment(it) && !it.img)) {
                return '<button class="txt" data-open="' + esc(it.id) + '">'
                  + esc(it.who || it.label || it.text || it.id) + '</button>';
              }
              var src = it.pair ? it.pair[0].img : it.img;
              return '<button data-open="' + esc(it.id) + '"><img src="' + esc(src)
                + '" alt="' + esc(it.label || '') + '"></button>';
            }).join('') + '</div>';
        }).join('');
        // THE PILES FOOTER — the chat this deck came from, and the two ways
        // off her review pile (Aug 2026, Sophie: "offer a link back to the
        // chat in the piles area" · "instead offer a skip or done button in
        // the piles area"). Skip = this was never a review (a demo, a browse
        // deck); Done = I am finished with it, whatever the cards still say.
        // Both stamp the page doc, the same field the queue reads.
        var foot = '';
        if (chat || (fromQueue && pageId)) {
          foot = '<div class="jg-pilefoot">'
            + (chat ? '<a class="jg-pilelink" href="/chats?chat=' + esc(encodeURIComponent(chat))
              + '">Open the chat</a>' : '')
            + (fromQueue && pageId
              ? '<button class="jg-pilebtn" data-act="skip">Skip</button>'
                + '<button class="jg-pilebtn" data-act="done">Done</button>' : '')
            + '</div>';
        }
        mount.innerHTML = '<div class="jg' + momCls + '" data-nostop>' + top + '<div class="jg-piles">'
          + (sections || '<p class="mini">Nothing here yet.</p>') + foot + '</div></div>';
      } else {
        var it = items[cur];
        var v = verdicts[it.id];
        // a date card gets her footer whole (✕ · note · ♥); her own words
        // (states) still win when a page sends them
        var momUI = isMoment(it) && !states;
        var row;
        if (states) {
          // her own words as chips — a button is only as wide as its words
          row = states.map(function (s, i) {
            return '<button class="jg-chip' + (v === s.key ? ' on' : '')
              + '" data-state="' + i + '">' + esc(s.label) + '</button>';
          }).join('');
        } else if (momUI) {
          // her footer: the rounded-square ✕ and ♥ (the mockup's ✓, swapped
          // for a heart at her ask) FLOAT on the content's bottom corners
          // (Aug 2026 — "put the heart and the X on top of the content so the
          // content comes down a little farther and there's just a tiny bit of
          // space between the note and the content"), with her bigger note box
          // as the row itself underneath. A decided card paints its button
          // dark, like the mockup.
          row = '<button class="jg-mombtn' + (v === false ? ' on' : '') + '" data-act="no"'
            + ' aria-label="No">' + MOM_X + '</button>'
            // MAYBE, between them (Aug 2026, Sophie: "can you add a maybe
            // option in the Tinder checklist template?"). It is a real
            // verdict with a pile of its own, not a way of skipping: it rides
            // the same route as ♥/✕ (ok:'maybe'), clears the Assets-tab vote
            // the way un-marking does, and stamps NOTHING — there is no good
            // and no bad in "maybe", the rule paintStamp already keeps.
            + '<button class="jg-mombtn maybe' + (v === 'maybe' ? ' on' : '') + '"'
            + ' data-act="maybe" aria-label="Maybe">' + MOM_MAYBE + '</button>'
            + '<button class="jg-mombtn yes' + (v === true ? ' on' : '') + '" data-act="yes"'
            + ' aria-label="Yes">' + MOM_HEART + '</button>'
            + '<textarea class="jg-momnote" rows="4" placeholder="Note for Claude…"></textarea>'
            // THE MIC SURVIVED THE MOVE (Aug 2026 v3). Her date decks never had
            // one, but every live picture deck is posted with voice:true —
            // measured, all five — so folding them into her look would have
            // taken the hands-free notes away. It rides in the note box's own
            // corner: the two ways of leaving a note on one card, together.
            + (voice ? '<button type="button" class="jg-mic' + (recActive() ? ' rec' : '')
              + '" data-act="mic" aria-label="voice note">' + I.mic + '</button>' : '');
        } else {
          var lit = function (k) { return browse && v === k ? ' on' : ''; };
          row = '<button class="jg-btn no' + lit(false) + '" data-act="no" aria-label="Pass">' + I.x + '</button>'
            + '<button class="jg-btn later' + lit('later') + '" data-act="later" aria-label="Sort later">' + I.later + '</button>'
            + '<button class="jg-btn maybe' + lit('maybe') + '" data-act="maybe" aria-label="Maybe">' + I.maybe + '</button>'
            + '<button class="jg-btn yes' + lit(true) + '" data-act="yes" aria-label="Love">' + I.heart + '</button>';
        }
        // the controls strip: reserved whenever a corner control could sit on
        // the content — the mic (voice) always, and the note + on a short
        // text-only card (the XI overlap). Her footer has no corner controls,
        // so a date card reserves nothing.
        var ctl = !momUI && (voice || isMoment(it)
          || (it.text && !it.img && !it.pair && !it.card)) ? ' ctl' : '';
        mount.innerHTML = '<div class="jg' + momCls + '" data-nostop>' + top
          + (momUI && momName(it) ? '<div class="who">' + esc(momName(it)) + '</div>' : '')
          // the wrapper is the card's non-scrolling frame — it exists so the
          // edge zones can hold the card's VISIBLE box (see .jg-cardwrap)
          + '<div class="jg-cardwrap">'
          // browse mode: the card's left/right EDGES page through the deck
          // (Sophie: "tapping on the screen to the right or left goes
          // backwards or forwards") — the middle still opens the lightbox
          + (browse ? '<button class="jg-navzone prev" data-act="prev" aria-label="Back"></button>'
            + '<button class="jg-navzone next" data-act="next" aria-label="Forward"></button>' : '')
          + '<div class="jg-card' + (momUI ? ' momcard' : '')
          + (momUI && it.link && it.link.url ? ' linkroom' : '') + ctl
          + (flash ? ' jg-flash' : '') + '">'
          + mediaHtml(it, momUI)
          // a date card carries no label line, no corner note and no mic —
          // her footer below IS the whole control surface (the exact-demo
          // choice, Aug 2026)
          + (!momUI && it.label ? '<div class="jg-label">' + esc(it.label) + '</div>' : '')
          // the note is a small + in the card's bottom-right corner; a
          // written one SHOWS as her words, never as an open textarea
          // (Sophie, Aug 2026 — same contract as compare.js's __compareNotes)
          + (momUI ? '' : '<div class="cmp-note' + (notes[it.id] ? ' has' : '') + '">'
          + '<button type="button" class="cmp-note-open" aria-label="a note about this one">'
          + PLUS_SVG + '</button>'
          + '<div class="cmp-note-text"></div>'
          + '<textarea class="cmp-note-box" rows="2" placeholder="a note about this one…"></textarea></div>')
          + (voice && !momUI ? '<button type="button" class="jg-mic' + (recActive() ? ' rec' : '')
            + '" data-act="mic" aria-label="voice note">' + I.mic + '</button>' : '')
          + '</div></div>'   // the card, then its non-scrolling wrapper
          + '<div class="' + (momUI ? 'jg-momfoot' + (voice ? ' mic' : '') : 'jg-row')
          + '">' + row + '</div></div>';
        // the red mark, over the card she has already decided (see paintStamp)
        paintStamp(it);
        if (momUI) {
          // a card that overflows its box steps its type down (the `long`
          // rules above) — measured on the real layout, so only the cards
          // that need it change and her sizes hold everywhere else
          var mcard = mount.querySelector('.jg-card.momcard');
          var mstack = mount.querySelector('.jg-mom');
          if (mcard && mstack && mcard.scrollHeight > mcard.clientHeight + 1) {
            mstack.classList.add('long');
          }
          // her note box: always open, holds HER latest message and edits it
          // in place — the debounced save and the Assets-tab mirror are the
          // same machinery the + note uses, only the clothes changed
          var mbox = mount.querySelector('.jg-momnote');
          var MS = window.__compareShell || {};
          var mmsgs = MS.parseNoteThread ? MS.parseNoteThread(notes[it.id] || '') : [];
          var mdraft = '';
          if (mmsgs.length && mmsgs[mmsgs.length - 1].who === 'me') mdraft = mmsgs.pop().text;
          mbox.value = mdraft;
          var mcompose = function () {
            return MS.threadField ? MS.threadField(mmsgs, mbox.value) : (mbox.value || '').trim();
          };
          momNote = { item: it.id, compose: mcompose };
          mbox.addEventListener('input', function () { saveNote(it.id, mcompose()); });
          mbox.addEventListener('blur', function () {
            var t = mbox.value.trim();
            if (t && t !== mdraft) { mirrorNote(it, t); mdraft = t; }
          });
          return;
        }
        var box = mount.querySelector('.cmp-note-box');
        var open = mount.querySelector('.cmp-note-open');
        // the thread is painted by the shared kit, so hers and the chat's
        // messages read the same here as on a Compare page; the box always
        // writes the NEXT message and never edits an earlier one
        var wrap = mount.querySelector('.cmp-note');
        var shownNote = mount.querySelector('.cmp-note-text');
        var S = window.__compareShell || {};
        var msgs = S.paintNote ? S.paintNote(wrap, notes[it.id] || '') : [];
        function openBox() { box.value = ''; wrap.classList.add('open'); box.focus(); }
        if (open) open.addEventListener('click', function () {
          if (wrap.classList.contains('open')) { box.blur(); return; }
          openBox();
        });
        if (shownNote) shownNote.addEventListener('click', openBox);
        if (box) box.addEventListener('input', function () {
          saveNote(it.id, S.threadField ? S.threadField(msgs, box.value) : box.value);
        });
        if (box) box.addEventListener('blur', function () {
          var draft = box.value.trim();
          if (draft) {
            saveNote(it.id, S.threadField ? S.threadField(msgs, draft) : draft);
            msgs = S.paintNote ? S.paintNote(wrap, notes[it.id]) : msgs;
            mirrorNote(it, draft);   // asset-backed cards agree with the tab
          }
          wrap.classList.remove('open');
        });
      }
    }

    // THE TOUR (Aug 2026, Sophie): first open of a template deck plays the
    // coach marks once — each control spotlighted, the rest tinted, a line
    // of explanation, tap to step. Replayable from the "?" forever.
    function tourSteps() {
      var steps = [];
      if (browse) {
        steps.push({ sel: '.jg-card', text: 'One card at a time. Tap the left or right '
          + 'edge of the card (or swipe) to move through the deck — that is the only '
          + 'thing that moves you, so marking a card never carries you off it.' });
      }
      steps.push({ sel: momDeck && !states ? '.jg-momfoot' : '.jg-row', text: states
        ? 'Mark a card with one of these — tap the same one again to unmark it.'
        : momDeck
          ? '♥ yes, ? maybe, ✕ no — marking one never moves you on, so you can '
            + 'change your mind. Maybe gets a pile of its own. The box under '
            + 'them is a note for this card, saved as you type.'
          : '♥ love it, ✕ pass, the dashed circle is maybe, the arrow means sort it later. '
          + 'Each one saves the moment you tap it.' });
      if (voice) {
        steps.push({ sel: '.jg-mic', text: 'The mic: tap to start talking, tap again to '
          + 'stop. Stay on one card and the note lands there — or keep talking while you '
          + 'swipe, and each sentence lands on the card you were looking at.' });
      }
      steps.push({ sel: '.cmp-note-open', text: 'The + writes a note on this card — '
        + 'typed notes and voice notes end up in the same thread.' });
      steps.push({ sel: '[data-act="undo"]', text: 'Undo the last thing you marked.' });
      steps.push({ sel: '[data-act="piles"]', text: 'The piles: everything you’ve '
        + 'sorted, grouped. Tap any tile there to open its card again.' });
      steps.push({ sel: '[data-act="help"]', text: 'The ? explains this page any time — '
        + 'and “show me around” in there replays this tour.' });
      return steps;
    }
    function startTour(auto) {
      if (!window.__compareTour) return;
      window.__compareTour({ key: 'deck', auto: !!auto, steps: tourSteps() });
    }

    function showHelp() {
      var h = document.createElement('div');
      h.className = 'jg-help';
      // A page's OWN explanation belongs here and nowhere else (Aug 2026,
      // Sophie: instructions on the page are clutter — "they can put it
      // behind a ? so I can tap it if I don't know what's going on"). Pass
      // `help: '…'` to __judge and it leads the card, above the buttons key.
      var keys = states
        ? 'Tap a word under the card to mark it; tap it again to unmark.'
        : momDeck
          ? '♥ yes · ? maybe (its own pile) · ✕ no — none of them moves you on '
            + '· the box under them is a note that saves as you type.'
          : '♥ love it · ✕ pass · dashed circle = maybe (its own pile) · arrow = sort it later.';
      // WHAT SHE SAID ABOUT THIS CARD LEADS (Aug 2026, Sophie: "everything I
      // personally said about them behind a question button"). It is about the
      // card in front of her, so it goes above the page's own explanation and
      // above the buttons key — and it is absent, silently, on a card that
      // carries no `said`, exactly like every other optional part.
      var mine = (items[cur] && items[cur].said) || [];
      var said = mine.length
        ? '<b>WHAT YOU SAID</b><br>' + mine.map(function (q) {
            return '<p class="jg-said">' + (q.when ? '<i>' + esc(q.when) + '</i>' : '')
              + esc(q.text) + '</p>';
          }).join('') + '<br>'
        : '';
      h.innerHTML = '<div>' + said + (opts.help ? '<div>' + opts.help + '</div><br>' : '')
        + '<b>THE BUTTONS</b><br>' + keys + '<br>'
        + (browse ? 'Tap the card’s left/right edge (or swipe) to move through'
          + ' — nothing has to be marked. ' : '')
        + (voice && !momDeck ? 'The mic records a voice note: tap to start, tap to stop. Stay on one'
          + ' card and it lands there — or keep talking WHILE you swipe, and each'
          + ' sentence lands on the card you were looking at when you started it. ' : '')
        + (momDeck ? 'Piles up top shows everything you’ve sorted —'
          : 'Top row: undo the last one, the grid shows every pile —')
        + ' tap any tile there to open it again.<br><br>'
        + '<button type="button" class="jg-tourgo">SHOW ME AROUND</button></div>';
      h.addEventListener('click', function (e) {
        h.remove();
        if (e.target && e.target.className === 'jg-tourgo') {
          setTimeout(function () { startTour(false); }, 60);
        }
      });
      document.body.appendChild(h);
    }

    mount.addEventListener('click', function (e) {
      // the picture: hers to open, not compare.js's (see `views` above)
      var z = e.target && e.target.closest ? e.target.closest('[data-zoom]') : null;
      if (z && views) {
        e.preventDefault();
        var zid = z.getAttribute('data-zoom');
        // a picture is either a card, or one of the cards ON a spread card —
        // and either way the lightbox is that PICTURE's, not the spread's
        var zit = null;
        items.forEach(function (x) {
          if (x.id === zid) zit = x;
          (x.cards || []).forEach(function (c) { if (c.id === zid) zit = c; });
        });
        if (zit) views.open(zit);
        return;
      }
      var pk = e.target && e.target.closest ? e.target.closest('[data-pick]') : null;
      if (pk) { judge(pk.getAttribute('data-pick')); return; }
      var b = e.target && e.target.closest ? e.target.closest('[data-act],[data-open],[data-state]') : null;
      if (!b) return;
      var open = b.getAttribute('data-open');
      if (open !== null && open !== undefined && open !== '') {
        cur = items.findIndex(function (it) { return it.id === open; });
        if (cur < 0) cur = 0;
        view = 'card'; render(true); return;
      }
      var st = b.getAttribute('data-state');
      if (st !== null && st !== undefined && st !== '' && states) {
        var s = states[parseInt(st, 10)];
        if (s) judge(s.key);
        return;
      }
      var act = b.getAttribute('data-act');
      if (act === 'yes') judge(true);
      else if (act === 'no') judge(false);
      else if (act === 'maybe') judge('maybe');
      else if (act === 'later') judge('later');
      else if (act === 'prev') nav(-1);
      else if (act === 'next') nav(1);
      else if (act === 'mic') toggleRec();
      else if (act === 'undo') undo();
      else if (act === 'help') showHelp();
      else if (act === 'back') backToQueue();
      else if (act === 'skip') stampReview({ hidden: true }, 'Skipped — it’s off the queue.');
      else if (act === 'done') stampReview({ done: true }, 'Marked done.');
      else if (act === 'piles') { view = view === 'piles' ? 'card' : 'piles'; render(); }
    });

    // ── THE MINI AUTOSCROLL — conditional, small, on the side of the screen
    // (Aug 2026, her ask; see the CSS above). It drives the CARD's own
    // scroller, never the window: on a deck the page does not scroll at all,
    // so a house pill would have nothing to move.
    var mini = null, miniRaf = null, miniOn = false, miniFor = null;
    /** The scroller in front of her, only if it actually overflows — that IS
     *  the "only appears when the text is very long" condition, measured
     *  rather than guessed from a character count (the .long class is a
     *  layout rule; this is about what genuinely does not fit). */
    function cardScroller() {
      var els = mount.querySelectorAll('.jg-card.momcard, .jg.mom .jg-card, .jg-cardtext');
      for (var i = 0; i < els.length; i += 1) {
        if (els[i].scrollHeight > els[i].clientHeight + 4) return els[i];
      }
      return null;
    }
    function miniStop() {
      miniOn = false;
      if (miniRaf) cancelAnimationFrame(miniRaf);
      miniRaf = null;
      if (mini) mini.innerHTML = I.play;
    }
    function miniToggle() {
      if (miniOn) { miniStop(); return; }
      var el = cardScroller();
      if (!el) return;
      miniOn = true;
      mini.innerHTML = I.pause;
      var last = 0;
      // THE POSITION IS KEPT HERE, NOT READ BACK OFF THE ELEMENT. At reading
      // pace one frame is ~0.37px, and `scrollTop += 0.37` snaps to the same
      // integer every frame, so the card never moved at all (measured — the
      // first version of this scrolled precisely 0px). Accumulating in JS and
      // assigning the absolute value survives whatever the browser rounds to.
      var pos = el.scrollTop;
      var step = function (ts) {
        if (!miniOn) return;
        // ~22px a second — reading pace, the speed the house pill creeps at
        if (last) { pos += (ts - last) * 0.022; el.scrollTop = pos; }
        last = ts;
        if (pos + el.clientHeight >= el.scrollHeight - 1) { miniStop(); return; }
        miniRaf = requestAnimationFrame(step);
      };
      miniRaf = requestAnimationFrame(step);
    }
    /** After every render (and on a resize): show it only where it has work.
     *  It lives on the BODY, not inside the card, so the deck's edge taps and
     *  swipe never see it — a tap on it must not page the deck. */
    function miniSync() {
      var over = cardScroller();
      if (!over) { miniStop(); miniFor = null; if (mini) mini.hidden = true; return; }
      if (!mini) {
        mini = document.createElement('button');
        mini.type = 'button';
        mini.className = 'jg-mini';
        mini.setAttribute('aria-label', 'scroll this card');
        mini.innerHTML = I.play;
        mini.addEventListener('click', function (e) { e.stopPropagation(); miniToggle(); });
        document.body.appendChild(mini);
      }
      // A NEW CARD starts stopped; the SAME card is left alone. This is not a
      // nicety: the serif lands late and `fonts.ready` re-syncs on top of a
      // scroll she has already started, so a blanket stop here killed the
      // autoscroll a second after she tapped it (caught in headless, and it
      // would have been worse on her phone, where the font comes over the
      // network). A re-render — including the one a ♥ causes — does replace
      // the element, so a tap still pauses the scroll, as the house rule says.
      if (over !== miniFor) { miniStop(); miniFor = over; }
      mini.hidden = false;
    }
    // the serif arrives after first paint and changes every height, so the
    // question "does this overflow?" has to be asked again once it lands
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(miniSync);
    window.addEventListener('resize', miniSync, { passive: true });

    // history.back() returns to the queue exactly as she left it — same scroll,
    // same tab — and the direct link is the fallback for a deck opened cold.
    function backToQueue() {
      // Embedded in the Chats app's page viewer (same-origin iframe): ask IT
      // to close, because `history.back()` here would only navigate the frame
      // and leave her staring at whatever the deck replaced. The parent hook
      // is the same shape as __openThread's — a page hands the app an
      // intention rather than following a link that would trap the whole app
      // inside this frame.
      try {
        if (window.parent && window.parent !== window
            && typeof window.parent.__closePage === 'function'
            && window.parent.__closePage() === true) return;
      } catch (_) { /* cross-origin — fall through */ }
      if (history.length > 1) history.back(); else location.href = '/review';
    }
    // Skip / Done stamp the PAGE doc (chatfeed owns it; the queue only reads),
    // then hand her back to the pile she was working through — the tap only
    // makes sense as "I'm finished with this one".
    function stampReview(patch, said) {
      if (!pageId) return;
      fetch('/api/chatfeed/page/' + encodeURIComponent(pageId) + '/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.ok) { toast('Couldn’t save that.'); return; }
        toast(said);
        setTimeout(backToQueue, 550);
      }).catch(function () { toast('Couldn’t save that.'); });
    }

    // a real SWIPE pages the deck too — it is the Tinder page, after all.
    // Horizontal, decisive (40px+, more sideways than down), card view only.
    if (browse) {
      var swX = null, swY = null;
      mount.addEventListener('pointerdown', function (e) { swX = e.clientX; swY = e.clientY; });
      mount.addEventListener('pointerup', function (e) {
        if (swX === null || view !== 'card') { swX = null; return; }
        var dx = e.clientX - swX, dy = e.clientY - swY;
        swX = null;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        nav(dx < 0 ? 1 : -1);   // swipe left = forward, the deck convention
      });
    }

    // first-ever open of a template deck: the tour plays once, after the
    // resume pass has painted the real state (never again — localStorage)
    if (opts.tour === 'auto') {
      setTimeout(function () { if (view === 'card') startTour(true); }, 600);
    }

    // resume: her earlier verdicts and notes come back off the doc.
    // `move` is false when the deck is only CATCHING UP — the two-view page
    // re-reads on every switch back, and jumping her to the first unjudged
    // card would throw away the place she was reading.
    function resume(move) {
      return fetch('/api/chatfeed/verdict?chat=' + encodeURIComponent(chat)
        + '&sheet=' + encodeURIComponent(sheet))
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; })
        .then(function (d) {
          var iv = (d && d.items) || {}, tx = (d && d.texts) || {};
          items.forEach(function (it) {
            if (iv[it.id] !== undefined && iv[it.id] !== null) verdicts[it.id] = iv[it.id];
            else delete verdicts[it.id];       // cleared in the other view
            if (tx[it.id]) notes[it.id] = tx[it.id];
          });
          if (move) {
            var next = firstUnjudged();
            if (next === -1) view = 'piles'; else cur = next;
          }
          render();
          return loadAssetVotes(move);
        });
    }

    // …THEN THE CHAT'S ASSETS TAB FILLS IN WHAT THE PAGE IS MISSING — the
    // other half of "all likes are synchronized everywhere", and the half the
    // deck never had (the grid has read this since it shipped). A ♥ she gave
    // in the Assets tab shows on the card here, and on a picture inside a
    // spread it is the only place that heart is kept at all.
    function loadAssetVotes(move) {
      var pics = [];
      items.forEach(function (it) {
        if (it.url) pics.push(it);
        (it.cards || []).forEach(function (c) { if (c.url) pics.push(c); });
      });
      if (!pics.length) return null;
      return fetch('/api/gallery/assets?chat=' + encodeURIComponent(chat) + '&limit=500')
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; })
        .then(function (a) {
          var votes = {};
          ((a && a.assets) || []).forEach(function (as) {
            if (!as.vote) return;
            votes[as.url] = as.vote;
            // one picture can sit at two storage paths; the union hands the
            // others along as `alts`, and the page may name either
            (as.alts || []).forEach(function (u) { votes[u] = as.vote; });
          });
          var moved = false;
          pics.forEach(function (it) {
            var v = votes[it.url];
            if (v) assetVotes[it.url] = v; else delete assetVotes[it.url];
            // a TOP-LEVEL card's vote is the page's verdict too, so the two
            // surfaces agree in BOTH directions — the page's own mark wins
            if (!onDeck(it) || !v) return;
            if (verdicts[it.id] !== undefined) return;
            verdicts[it.id] = v === 'like';
            moved = true;
          });
          if (moved && move) {
            var next = firstUnjudged();
            if (next === -1) view = 'piles'; else cur = next;
          }
          if (moved) render();
        });
    }
    resume(true);

    render();
    // the handle the two-view page holds, so a mark made in the grid shows
    // here when she swipes back (both views write the same doc; this is how
    // the one she returns to finds out)
    return { refresh: function () { return resume(false); } };
  };
})();
