/* caretkeep.js — THE CARET STAYS WHERE SHE CAN SEE IT (2026-09-08, Sophie,
   editing a scene on the soap-pill belt: "when i edit the text, the scroll
   position moves, so the cursor is under the textbox").

   Every box she writes a scene in is fitted to its own words — the box never
   scrolls, the PAGE does (the Playground's bigger-box rule, the belt's `fit`,
   the Chats app's script-block editor). That is right for reading and it is
   what breaks the caret: a 2,000-character scene is a 1,500px-tall textarea,
   so WebKit's own "keep the focused element in view" scrolls the top of the
   BOX into view and leaves the line she is typing far below the keyboard —
   and once the keyboard is up, iOS never scrolls again for a box that has no
   scrollbar of its own. Her caret ends up under the keyboard's own bar with
   nothing on screen saying why.

   So the page keeps the caret itself. On focus, on every keystroke, on an
   arrow key and when the keyboard opens or closes, this measures where the
   caret really is and, ONLY when it has fallen outside the visible band,
   scrolls by exactly the difference.

   Three rules it lives by:

   - IT ONLY EVER CORRECTS. A caret comfortably inside the band moves nothing,
     so reading back over a scene while the keyboard is up is untouched. It
     never fires on a scroll event — that is her finger, and a keeper that
     answered it would fight her for the page. And it never measures at the
     moment of a TAP: a tap focuses the box on the press and places the caret
     on the release, so the first keep waits one task for the caret she
     actually put down (2026-09-12, "putting the cursor down also scrolls").
   - THE WINDOW, NEVER `scrollIntoView`. That walks every scrollable ancestor
     (the house rule the chapter bar already learned), and a belt card lives
     in a HORIZONTALLY snapping deck — one call would page her to another
     scene. The nearest box that really scrolls wins, else the window, and
     nothing else is touched.
   - THE CARET IS MEASURED, NOT GUESSED. A hidden mirror wearing the box's own
     font, padding, border and width holds the text up to the caret; the line
     it lands on IS the caret's line. Counting characters would be wrong on
     the first wrapped line.

   The visible band comes from `visualViewport`, which shrinks when the
   keyboard opens. WHERE IT DOES NOT (some web views never report it), a
   touch device with a focused text box is certainly holding a keyboard, so
   the band falls back to a conservative guess — scrolling her caret a little
   higher than needed is a much smaller failure than leaving it under the
   keyboard.

   AND THE KEYBOARD IS NOT THE ONLY THING COVERING THE BOTTOM OF IT
   (2026-09-13, Sophie, typing at the end of a footage block: the ✕, the
   divide and the bigger-box buttons sitting ON the line she was writing).
   `stickybox.js` floats a tall box's corner buttons at the bottom of this
   same band — that is their whole design, the way out of a box she cannot
   scroll to the end of — so the two aimed at the same pixels and the caret
   line landed underneath the button row. Measured on the real footage page
   with the keyboard up: caret line 382–404, the pinned buttons 372–398, and
   `elementFromPoint` on the caret's own line answering the divide button.
   So a control pinned over the box she is typing in narrows the caret's
   band exactly as the keyboard does, and the two stack instead of
   overlapping. `band()` itself is NOT narrowed — stickybox reads it to
   decide where to pin, and a band that moved under it would ratchet the
   buttons up the screen a row at a time.

   AND THE SAME BUG HAS A MIRROR AT THE TOP — A STICKY ROW (2026-09-14,
   Sophie: "any other similar changes? bugs"). The half above lifts a caret
   that has fallen below the band; the other half of `keep()` LOWERS one that
   has risen above it, onto `band.top` — and `band.top` is the visual
   viewport's own top, which knows nothing about a row stuck to it. footage's
   PROMPT fold row went `position:sticky` on 2026-09-13, so typing in the top
   half of a long scene after scrolling down put her caret straight under it.
   MEASURED on the real page: caret line 10–33, the sticky row 4–33, and
   `elementFromPoint` on the caret's own line answering the fold button rather
   than her words; after, the caret sits at 39–62 and the line reads clear.
   So `caretBand` narrows from BOTH ends, and chrome narrows the end it is
   NEARER — no rule about safe-area insets, which is what a "is it at the
   top?" test cannot survive (in the app the row starts at the inset and the
   band still starts at 0). Three things not to undo: a stickybox button is
   excluded from the sticky set and read live instead (it goes fixed and back
   as she scrolls, so a set cached at find time would remember it as chrome
   long after it let go); the set is found once per FOCUS by a bounded walk
   — the box's ancestors' siblings plus body's own children, which is where
   a header lives — because reading every node's computed position on every
   keystroke is the churn the typing rule forbids; and only chrome actually
   PAINTED on top counts (`onTop`), or the Story Room's sticky header, which
   sits under its own beat popup, would lift her caret clear of something she
   cannot see.

   AND IT KEEPS THE FOOT OF THE PAGE REACHABLE, NOT ONLY THE CARET
   (2026-09-16, Sophie, on a long message on her phone: "no way to scroll down
   or split long or bottom messages"). The layout viewport does not shrink
   when the keyboard opens, so `scrollHeight - innerHeight` stops a keyboard's
   height too early: the end of what she is writing, and the Done bar under
   it, sit behind the keys with no page left to scroll. See ROOM UNDER THE
   LAST LINE below for the measurement and the three rules the floor keeps.

   AND THE PAGE IS SCROLLED WHERE SHE IS LOOKING, NOT WHERE THE LAYOUT
   VIEWPORT IS (2026-09-26, Sophie, on Footage: "always has the same bug of
   screen moving every time i type or put the cursor delete etc" — the fourth
   report of the one bug, after 09-12, 09-14 and 09-23). With the keyboard up,
   iOS keeps the LAYOUT viewport where it was and PANS the VISUAL viewport
   inside it to reveal the caret (`visualViewport.offsetTop`, ~115pt on her
   Footage screenshot), and the two window scroll APIs do not agree on which
   one they mean: `window.scrollY` reports the layout viewport, `window
   .scrollTo` moves the scroll view — the visual one. So `scrollTo(0, scrollY
   + d)` with a 115pt pan and a caret 30px too low did not move the view DOWN
   30px: it set the visual viewport to the layout viewport's top plus 30,
   i.e. UP 85px, the caret went off the bottom, iOS panned back to reveal it,
   and the next keystroke — or the next keep of the tap's burst — did it
   again. Every keystroke, every tap, every delete: exactly her words. A
   headless browser never pans (offsetTop is 0 without a pinch zoom), so the
   two coordinates were the same number here and every test was green.
   Now the target is the VISUAL viewport's own page position plus the
   correction (`pageTop()`), which is the same number as before wherever
   there is no pan and the right one where there is. And the keeper WATCHES
   ITS OWN WORK: a correction that had to be made again for the same caret
   line, the same band and the same direction within a second and a half was
   undone by the browser, and a keeper fighting the browser is the epilepsy —
   it stands down for the rest of that focus (`fight`), and the phone's own
   reveal, which is what undid it, keeps the caret. Test:
   `node scripts/test-caret-pan.js` — the phone's own arithmetic stood in
   for `scrollTo` and `visualViewport`; against the old keeper nine letters
   on one line moved the view 27 times.

   Include it once, anywhere: `<script src="/caretkeep.js"></script>`. It
   wires itself to every text box on the page, present and future, and takes
   `data-nocaret` on a box (or any ancestor) as an opt-out. compare.js loads
   it lazily on the first focus, so every Compare page ever posted has this
   with nothing re-posted.
*/
(function () {
  if (window.__caretKeep) return;

  var MARGIN = 26;          // air under the caret line, above the keyboard
  var TOP = 10;             // air above it
  var CHROME = 6;           // air between the caret line and a control pinned over it
  var FLOOR = 44;           // a band this narrow is no band at all
  var mirror = null;
  var focused = null;
  var timers = [];
  var raf = 0;

  function boxy(el) {
    if (!el || !el.tagName) return false;
    var t = el.tagName;
    if (t === 'TEXTAREA') return ok(el);
    if (t !== 'INPUT') return false;
    var ty = (el.getAttribute('type') || 'text').toLowerCase();
    if (['text', 'search', 'url', 'email', 'tel', 'password', 'number'].indexOf(ty) < 0) return false;
    return ok(el);
  }
  function ok(el) {
    try { return !(el.closest && el.closest('[data-nocaret]')); } catch (_) { return true; }
  }

  // ── the visible band, in client (layout-viewport) coordinates ──
  function band() {
    var vv = window.__caretKeep && window.__caretKeep.vv ? window.__caretKeep.vv : window.visualViewport;
    var top = 0, bottom = window.innerHeight;
    if (vv && vv.height) { top = vv.offsetTop || 0; bottom = top + vv.height; }
    // A KEYBOARD THE PAGE CANNOT SEE. If a text box holds the focus on a
    // touch device and the viewport did not shrink, the keyboard is up and
    // nothing reported it — assume it covers the bottom of the screen.
    var blind = bottom >= window.innerHeight - 40;
    if (focused && blind && touch()) {
      bottom = top + Math.max(200, window.innerHeight - Math.min(360, Math.round(window.innerHeight * 0.46)));
    }
    return { top: top + TOP, bottom: bottom - MARGIN };
  }
  function touch() {
    try { return window.matchMedia('(hover: none)').matches; } catch (_) { return false; }
  }
  // where the VISUAL viewport is on the page — what she is looking at, and
  // the number `window.scrollTo` sets on iOS. `scrollY` is the layout
  // viewport; with the keyboard up and iOS panned they differ by `offsetTop`.
  function pageTop() {
    var vv = window.__caretKeep && window.__caretKeep.vv ? window.__caretKeep.vv : window.visualViewport;
    if (vv && typeof vv.pageTop === 'number' && vv.height) return vv.pageTop;
    return window.scrollY + (vv && vv.height ? (vv.offsetTop || 0) : 0);
  }

  // ── the band the CARET aims at: the visible one, minus anything pinned or
  //    stuck over the box she is typing in ──
  // Two kinds of chrome, read two different ways on purpose.
  // stickybox.js floats a tall box's corner buttons at the bottom of the very
  // band above (its own `bandBottom` asks for it), so without this the caret
  // line and the button row are the same pixels — she types under a control.
  // Those pin and unpin as she scrolls, so they are queried every pass.
  // A STICKY ROW is the page's own furniture (footage's PROMPT fold row), so
  // the SET is found once per focus by a bounded walk and only its RECT is
  // read here — walking every node on every keystroke is the churn the
  // typing rule forbids.
  // Only chrome in the box's OWN COLUMN can cover its words, and it narrows
  // the band from whichever END it is nearer, so a header lifts the floor and
  // a pinned button lowers the ceiling with no rule about safe-area insets.
  // `band()` is left alone on purpose: stickybox reads it, and narrowing it
  // there would walk the buttons up the screen a row per pass.
  var stuck = [];           // the sticky/fixed rows over the focused box
  var stuckFor = null;      // the box they were found for

  function findStuck(el) {
    var out = [];
    try {
      var chain = [], n = el, i, j;
      while (n && n !== document.body) { chain.push(n); n = n.parentElement; }
      var cands = [];
      for (i = 0; i < chain.length; i += 1) {
        var sib = chain[i].parentElement ? chain[i].parentElement.children : [];
        for (j = 0; j < sib.length; j += 1) if (sib[j] !== chain[i]) cands.push(sib[j]);
      }
      var kids = document.body ? document.body.children : [];   // a page-level header
      for (i = 0; i < kids.length; i += 1) cands.push(kids[i]);
      for (i = 0; i < cands.length; i += 1) {
        var c = cands[i];
        if (c === el || c.contains(el)) continue;               // it scrolls WITH her
        // a stickybox button is the OTHER loop's: it goes fixed and back as
        // she scrolls, so a set cached at find time would remember it as
        // chrome long after it let go and had gone back to the box's corner
        if (c.hasAttribute && c.hasAttribute('data-stickybox')) continue;
        if (out.indexOf(c) >= 0) continue;
        var p = window.getComputedStyle(c).position;
        if (p !== 'sticky' && p !== 'fixed') continue;
        if (!onTop(c)) continue;                                // a sheet covers it
        out.push(c);
      }
    } catch (_) { return []; }
    return out;
  }

  // only chrome that is really PAINTED over the page counts: the Story Room's
  // sticky header sits under its own beat popup at a higher layer, and lifting
  // her caret clear of something she cannot see is a jump with no cause.
  function onTop(c) {
    try {
      var q = c.getBoundingClientRect();
      var x = Math.round(Math.max(0, Math.min(window.innerWidth - 1, (q.left + q.right) / 2)));
      var y = Math.round(Math.max(0, Math.min(window.innerHeight - 1, (q.top + q.bottom) / 2)));
      var hit = document.elementFromPoint(x, y);
      return !hit || hit === c || c.contains(hit) || hit.contains(c);
    } catch (_) { return true; }
  }

  function narrow(b, q, r) {
    if (!q.width || !q.height) return;
    if (q.right <= r.left || q.left >= r.right) return;       // another column entirely
    if (q.bottom <= b.top || q.top >= b.bottom) return;       // not over the band at all
    if (q.bottom - b.top <= b.bottom - q.top) {               // nearer the TOP
      if (q.bottom + CHROME > b.top) b.top = q.bottom + CHROME;
    } else if (q.top - CHROME < b.bottom) {                   // nearer the BOTTOM
      b.bottom = q.top - CHROME;
    }
  }

  function caretBand(el) {
    var b = band();
    if (!el || !el.getBoundingClientRect) return b;
    var r = el.getBoundingClientRect();
    var over, i;
    try { over = document.querySelectorAll('[data-stickybox].sbx-pin'); } catch (_) { over = []; }
    for (i = 0; i < over.length; i += 1) {
      if (over[i] === el || over[i].contains(el)) continue;
      narrow(b, over[i].getBoundingClientRect(), r);
    }
    if (stuckFor !== el) { stuck = findStuck(el); stuckFor = el; }
    for (i = 0; i < stuck.length; i += 1) narrow(b, stuck[i].getBoundingClientRect(), r);
    if (b.bottom < b.top + FLOOR) b.bottom = b.top + FLOOR;
    return b;
  }

  // ── where the caret really is ──
  var COPY = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing',
    'textTransform', 'textIndent', 'wordSpacing', 'paddingTop', 'paddingRight', 'paddingBottom',
    'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'boxSizing', 'whiteSpace', 'wordBreak', 'overflowWrap', 'tabSize',
    // WebKit's textarea wraps a trailing space `after-white-space`; a div does
    // not, so without this the mirror puts a caret typed after a space at the
    // end of a full line one line lower than the box does (2026-09-14)
    'lineBreak'];
  function ensureMirror() {
    if (mirror && mirror.parentNode) return mirror;
    mirror = document.createElement('div');
    mirror.setAttribute('aria-hidden', 'true');
    mirror.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:hidden;pointer-events:none;'
      + 'white-space:pre-wrap;overflow-wrap:break-word;overflow:hidden;';
    document.body.appendChild(mirror);
    return mirror;
  }
  function caretRect(el) {
    var r = el.getBoundingClientRect();
    var cs = window.getComputedStyle(el);
    var lh = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) || 16) * 1.4;
    if (el.tagName !== 'TEXTAREA') return { top: r.top, bottom: r.bottom, line: 0 };
    var i = el.selectionEnd;
    if (i == null || !document.body) return { top: r.top, bottom: r.bottom, line: 0 };
    var m = ensureMirror();
    for (var k = 0; k < COPY.length; k += 1) {
      try { m.style[COPY[k]] = cs[COPY[k]]; } catch (_) { /* a property this browser has not got */ }
    }
    m.style.width = r.width + 'px';
    m.textContent = el.value.slice(0, i);
    var span = document.createElement('span');
    span.textContent = '​';           // the caret's own zero-width stand-in
    m.appendChild(span);
    var off = span.getBoundingClientRect().top - m.getBoundingClientRect().top;
    m.textContent = '';
    var top = r.top - el.scrollTop + off;
    // never claim the caret is outside the box itself — a mirror that failed
    // to copy something must not send the page anywhere
    if (top < r.top - 4) top = r.top;
    if (top > r.bottom) top = Math.max(r.top, r.bottom - lh);
    // `line` is the caret's line in the WORDS (typing along a line keeps it,
    // a wrap or a Return moves it) — what `keep` tells a repeat by
    return { top: top, bottom: top + lh, line: Math.round(off / lh) };
  }

  // ── who scrolls: the nearest box that really can, else the window ──
  function host(el) {
    var p = el.parentElement, fixed = false;
    while (p && p !== document.body && p !== document.documentElement) {
      var cs = window.getComputedStyle(p);
      var oy = cs.overflowY;
      if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && p.scrollHeight - p.clientHeight > 4) return p;
      if (cs.position === 'fixed') fixed = true;
      p = p.parentElement;
    }
    // inside a fixed sheet with nothing scrollable in it, the window cannot
    // help and moving it would only shift the page behind the sheet
    return fixed ? false : null;
  }

  // ── ROOM UNDER THE LAST LINE ──
  // The end of a scene is the one place the page CANNOT be scrolled far
  // enough: below the last line there is only the card's padding, so lifting
  // the caret over a keyboard 400px tall runs out of page and the caret stays
  // under it — which is exactly where she types, at the end of what she is
  // writing. So the page borrows the room it is short of (padding on the
  // scrolling element, never the body: a flex or grid body would lay a spacer
  // out as one of its own children) and gives it back the moment she is done.
  var room = 0, padWas = null, extra = 0;   // `extra` = what the CARET has had to borrow
  function setRoom(px) {
    px = Math.max(0, Math.min(Math.round(px), window.innerHeight));
    if (px === room) return;
    var de = document.documentElement;
    if (padWas === null) padWas = de.style.paddingBottom || '';
    room = px;
    de.style.paddingBottom = px ? px + 'px' : padWas;
  }

  // AND THE ROOM IS THE WHOLE KEYBOARD, NOT JUST THE CARET'S SHORTFALL
  // (2026-09-16, Sophie, on a long message on her phone: "no way to scroll
  // down or split long or bottom messages").
  //
  // The half above borrows room when the CARET runs out of page — which keeps
  // the line she is typing in view and does nothing at all for the line she is
  // trying to READ. The layout viewport does not shrink when the keyboard
  // opens, so `scrollHeight - innerHeight` still stops a keyboard's height too
  // early: MEASURED on a belt-shaped page at 390x844 with a 336px keyboard,
  // the page scrolled as far as it goes left the box's last line at 683 and
  // the Done bar under it at 731 against a band ending at 482 — 250px of what
  // she was writing with no way to reach it, and nothing on screen saying why.
  // Her finger cannot fix it either: a box fitted to its own words fills the
  // whole band, so there is no page left to drag.
  //
  // So while a box is focused the page simply borrows the keyboard: enough
  // that its LAST pixel lands at the bottom of the visible band instead of
  // behind the keys. It is a FLOOR, re-measured each pass and never added to
  // (a ratchet would walk the foot of the page away from her a screen at a
  // time), the window's alone — an inner scroller has its own end and padding
  // the document would never reach it — and it goes back with the keyboard,
  // like the room above it.
  //
  // `band()`, not `caretBand()`: what puts the foot of the page out of reach
  // is the keyboard, and caretBand is narrowed by chrome pinned over the box
  // (stickybox's own buttons), which would make the floor chase them.
  //
  // THE FLOOR IS THE KEYBOARD, NEVER WHERE iOS HAS PANNED TO (2026-09-23,
  // Sophie, on Footage: "at various times it still switches rapidly between
  // screens when i put my cursor down · i'm going to get epilepsy"). `band()`
  // is in LAYOUT coordinates, so its bottom rides `visualViewport.offsetTop` —
  // and iOS reveals a caret by PANNING the visual viewport inside the layout
  // one (~115pt, measured off her Footage screenshot). Read off the band, the
  // floor shrank by every point iOS panned: the padding changed, the page's
  // scroll range changed with it, iOS panned again to reveal the caret, and
  // the next keep wrote a different padding — the page and the phone taking
  // turns for a second after every tap. The keyboard is the same height
  // however far iOS has panned, so the pan is taken back off: the floor is
  // the largest room the page could need (the pan at 0), and a constant for
  // as long as the keyboard is.
  var FLOOR_MIN = 80;      // less than this is the margin, not a keyboard
  function roomFloor() {
    var b = band();
    var vv = window.__caretKeep && window.__caretKeep.vv ? window.__caretKeep.vv : window.visualViewport;
    var pan = vv && vv.height ? Math.max(0, vv.offsetTop || 0) : 0;
    var gap = window.innerHeight - (b.bottom - pan);
    return gap > FLOOR_MIN ? Math.round(gap) : 0;
  }

  // ── THE KEEPER WATCHES ITS OWN WORK (2026-09-26) ──
  // A window correction is remembered: the caret's line, the direction, and
  // the band it was aimed at (in the VISUAL frame, so a pan does not change
  // it). Having to make the SAME correction again — same line, same band,
  // same way — within a second and a half means the browser undid the first,
  // and a keeper that scrolls back is a page taking turns with the phone.
  // It stands down for the rest of this focus instead; the phone's own reveal
  // is what undid it, and that keeps the caret. A band that changed (a
  // button pinned over the line) is a new correction and is allowed; a
  // different line is her typing on. `fight` is reset by a focus, a blur and
  // the keyboard opening or closing.
  // Two things keep it from mistaking anything else for that. It takes the
  // THIRD identical correction, not the second: her own finger can undo one
  // (a drag between a tap and the first letter lands the caret back where it
  // was, once), and a `touchmove` calms it anyway; a browser undoing it does
  // so every time. And the correction it repeats must be one that never moved
  // the LAYOUT viewport (`took`, read off `scrollY` right after the scroll):
  // the phone's reveal is a PAN of the visual viewport inside a layout
  // viewport that stays put, and so is the scroll that fights it. A page that
  // clamps its own scroll for a frame (a box fitted through `height:auto`
  // shortens the document for one layout — the Playground's, the Chats app's)
  // undoes a correction that DID move the layout viewport, and is re-corrected
  // on every keystroke exactly as it always was.
  var FIGHT_MS = 1500, FIGHT_PX = 6, FIGHT_N = 3;
  var lastFix = null, fight = false;
  function repeat(c, b, d, pan, now) {
    var dir = d > 0 ? 1 : -1, bt = b.top - pan, bb = b.bottom - pan, ly = window.scrollY;
    var same = !!lastFix && lastFix.took === false && lastFix.line === c.line && lastFix.dir === dir
      && Math.abs(lastFix.bt - bt) < 3 && Math.abs(lastFix.bb - bb) < 3
      && now - lastFix.at < FIGHT_MS && Math.abs(d) >= FIGHT_PX;
    var n = same ? lastFix.n + 1 : 1;
    lastFix = { line: c.line, dir: dir, bt: bt, bb: bb, ly: ly, at: now, n: n, took: null };
    return n >= FIGHT_N;
  }
  function calm() { lastFix = null; fight = false; }

  function keep(el) {
    el = el || focused;
    if (!el || el !== document.activeElement || !boxy(el)) return 0;
    var h = host(el);
    if (h === false) return 0;
    if (!h) setRoom(Math.max(extra, roomFloor()));   // the window is the scroller: give her the foot of the page
    var b = caretBand(el);
    var c = caretRect(el);
    var d = 0;
    if (c.bottom > b.bottom) d = c.bottom - b.bottom;
    else if (c.top < b.top) d = c.top - b.top;
    if (Math.abs(d) < 2) return 0;
    if (h) {
      var was = h.scrollTop;
      h.scrollTop = Math.max(0, Math.min(h.scrollHeight - h.clientHeight, was + d));
      return h.scrollTop - was;
    }
    if (fight) return 0;                    // the browser has the caret; a scroll here is the flicker
    var y = pageTop();                      // where she is LOOKING — never `scrollY` while iOS has panned
    var pan = y - window.scrollY;
    if (repeat(c, b, d, pan, Date.now())) { fight = true; return 0; }
    var want = y + d;
    var max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (want > max) {
      extra = Math.max(extra, room + (want - max));
      setRoom(Math.max(extra, roomFloor()));
      max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }
    var to = Math.max(0, Math.min(max, want));
    if (Math.abs(to - y) < 1) return 0;
    window.scrollTo(0, to);                 // the window only: never the deck
    if (lastFix) lastFix.took = Math.abs(window.scrollY - lastFix.ly) >= 1;   // did the LAYOUT viewport move?
    return to - y;
  }

  function soon() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; keep(); });
  }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  // THE KEYBOARD LANDS LATE, AND WEBKIT SCROLLS ONCE OF ITS OWN ACCORD ON THE
  // WAY UP. Running only at focus time would be undone by that scroll a beat
  // later, so the burst runs again after it and has the last word.
  function burst(el) {
    clearTimers();
    keep(el);
    [90, 260, 520, 900].forEach(function (ms) {
      timers.push(setTimeout(function () { keep(el); }, ms));
    });
  }

  // A TAP FOCUSES THE BOX BEFORE IT PLACES THE CARET (2026-09-12, Sophie:
  // "putting the cursor down also scrolls"). `focus` fires on the press and
  // the selection lands on the release, so at focusin `selectionEnd` is
  // STALE — WebKit keeps the old caret (the end of the scene she last typed
  // at, a screen or more below), Chromium resets it to 0. A keep run
  // synchronously here measured that old caret and scrolled the page toward
  // it, and the 90ms retry scrolled back: the lurch she saw on every tap.
  // So a focus ARMS the keeper and the first keep waits for the tap's
  // RELEASE — the CLICK that follows the focus, which is when the caret she
  // put down is really there (measured: with the selection moved during
  // focus, Chromium places the tap's caret at the click and not at mouseup,
  // a task later) — with a short fallback for a focus no tap made (the
  // pencil, a Tab). Until then nothing is measured, and a selection change
  // in that window (the old caret being restored) is ignored; after it,
  // `selectionchange` keeps the caret wherever a tap or a drag really puts it.
  var pending = 0;
  function arm(el) {
    clearTimers();
    calm();
    clearTimeout(pending);
    pending = setTimeout(function () { pending = 0; if (focused === el) burst(el); }, 150);
  }
  function released() {
    if (!pending || !focused) return;
    clearTimeout(pending); pending = 0;
    var el = focused;
    timers.push(setTimeout(function () { if (focused === el) burst(el); }, 0));
  }
  document.addEventListener('focusin', function (e) {
    if (!boxy(e.target)) return;
    focused = e.target;
    stuckFor = null;                  // re-find this box's chrome
    arm(focused);
  }, true);
  document.addEventListener('click', released, true);
  document.addEventListener('selectionchange', function () {
    if (focused && !pending && focused === document.activeElement) soon();
  });
  document.addEventListener('focusout', function (e) {
    if (e.target !== focused) return;
    focused = null;
    clearTimers();
    calm();
    clearTimeout(pending); pending = 0;
    // the borrowed room goes back with the keyboard, after it has gone: a
    // page that shortens under her thumb mid-blur jumps the words she is
    // reading
    setTimeout(function () { if (!focused) { extra = 0; setRoom(0); } }, 400);
  }, true);
  window.addEventListener('pagehide', function () { extra = 0; setRoom(0); });
  // her finger on the page is never the browser undoing a correction
  document.addEventListener('touchmove', function () { lastFix = null; }, { capture: true, passive: true });
  document.addEventListener('wheel', function () { lastFix = null; }, { capture: true, passive: true });
  document.addEventListener('input', function (e) {
    if (e.target === focused) soon();
  }, true);
  document.addEventListener('keyup', function (e) {
    if (e.target !== focused) return;
    if (/^(Arrow|Page|Home|End|Enter|Backspace|Delete)/.test(e.key || '')) soon();
  }, true);
  if (window.visualViewport) {
    // the keyboard opening or closing, and a rotation
    window.visualViewport.addEventListener('resize', function () { stuckFor = null; calm(); if (focused) burst(focused); });
  }

  window.__caretKeep = {
    version: 2,
    keep: keep,
    pageTop: pageTop,        // the visual viewport's page position — what scrollTo sets on iOS
    fighting: function () { return fight; },   // stood down for this focus (the test's read)
    lastFix: function () { return lastFix; },
    calm: calm,
    // compare.js calls this on EVERY focusin (it is how the lazily loaded
    // keeper learns about the box the fetch was started for), so it arms
    // exactly as focusin does — a burst run here would measure the tap's
    // stale caret, which is the scroll she reported
    focus: function (el) { if (boxy(el)) { focused = el; stuckFor = null; arm(el); } },
    caretRect: caretRect,
    band: band,              // what the keyboard leaves — stickybox pins against THIS
    caretBand: caretBand,    // that, minus anything pinned over the box she is in
    // the test's hands on a keyboard a headless browser has not got
    vv: null,
  };
})();
