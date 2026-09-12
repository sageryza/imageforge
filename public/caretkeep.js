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

  // ── where the caret really is ──
  var COPY = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing',
    'textTransform', 'textIndent', 'wordSpacing', 'paddingTop', 'paddingRight', 'paddingBottom',
    'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'boxSizing', 'whiteSpace', 'wordBreak', 'overflowWrap', 'tabSize'];
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
    if (el.tagName !== 'TEXTAREA') return { top: r.top, bottom: r.bottom };
    var i = el.selectionEnd;
    if (i == null || !document.body) return { top: r.top, bottom: r.bottom };
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
    return { top: top, bottom: top + lh };
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
  var room = 0, padWas = null;
  function setRoom(px) {
    px = Math.max(0, Math.min(Math.round(px), window.innerHeight));
    if (px === room) return;
    var de = document.documentElement;
    if (padWas === null) padWas = de.style.paddingBottom || '';
    room = px;
    de.style.paddingBottom = px ? px + 'px' : padWas;
  }

  function keep(el) {
    el = el || focused;
    if (!el || el !== document.activeElement || !boxy(el)) return 0;
    var h = host(el);
    if (h === false) return 0;
    var b = band();
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
    var y = window.scrollY;
    var want = y + d;
    var max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (want > max) { setRoom(room + (want - max)); max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight); }
    var to = Math.max(0, Math.min(max, want));
    if (Math.abs(to - y) < 1) return 0;
    window.scrollTo(0, to);                 // the window only: never the deck
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
    clearTimeout(pending); pending = 0;
    // the borrowed room goes back with the keyboard, after it has gone: a
    // page that shortens under her thumb mid-blur jumps the words she is
    // reading
    setTimeout(function () { if (!focused) setRoom(0); }, 400);
  }, true);
  window.addEventListener('pagehide', function () { setRoom(0); });
  document.addEventListener('input', function (e) {
    if (e.target === focused) soon();
  }, true);
  document.addEventListener('keyup', function (e) {
    if (e.target !== focused) return;
    if (/^(Arrow|Page|Home|End|Enter|Backspace|Delete)/.test(e.key || '')) soon();
  }, true);
  if (window.visualViewport) {
    // the keyboard opening or closing, and a rotation
    window.visualViewport.addEventListener('resize', function () { if (focused) burst(focused); });
  }

  window.__caretKeep = {
    version: 1,
    keep: keep,
    // compare.js calls this on EVERY focusin (it is how the lazily loaded
    // keeper learns about the box the fetch was started for), so it arms
    // exactly as focusin does — a burst run here would measure the tap's
    // stale caret, which is the scroll she reported
    focus: function (el) { if (boxy(el)) { focused = el; arm(el); } },
    caretRect: caretRect,
    band: band,
    // the test's hands on a keyboard a headless browser has not got
    vv: null,
  };
})();
