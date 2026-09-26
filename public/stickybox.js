/* stickybox.js — THE WAY OUT OF A BIG BOX STAYS ON SCREEN (2026-09-10,
   Sophie: "can we get a floating or sticky/pinned contract button for text
   boxes esp in footage so i can close with out having to scroll all the way
   down").

   Every box she writes a scene in is fitted to its own words and never
   scrolls itself — the PAGE scrolls (the Playground's bigger-box rule, the
   belt's `fit`, footage's uncapped `#prompt.big`). The corner toggle that
   opens the box is the same one that closes it, and it lives in the box's
   BOTTOM-RIGHT corner — so the taller the box gets, the further the way out
   is from where she is. On footage, where the big box has no ceiling at all,
   a 2,000-character scene puts the contract button a screen and a half below
   the last thing she can see.

   So the button pins itself to the bottom of what she can actually see, and
   only then:

   - IT ONLY EVER CORRECTS. While the button's own corner is on screen it is
     not touched at all, so a short box behaves exactly as it did. It unpins
     the moment its corner comes back into view, and again once she has
     scrolled past the box entirely — a control floating over a page whose box
     is nowhere near it is worse than one she has to scroll to.
   - THE VISIBLE BAND IS caretkeep's, when caretkeep is on the page. That is
     one definition of "what the keyboard is covering" rather than two, and it
     carries the blind-keyboard guess for the web views that never report
     `visualViewport`. Without it: visualViewport, else the window.
   - IT STAYS INSIDE ITS OWN REGION. A box inside a sheet or any other
     scroller pins to the bottom of THAT box, never to the bottom of the
     screen, so the button can never float below the card it belongs to.
   - AND WHERE `position:fixed` WOULD NOT MEAN THE VIEWPORT, IT DOES NOTHING.
     An ancestor carrying a transform, a filter or `will-change` makes itself
     the containing block for a fixed child, so the arithmetic here would put
     the button somewhere arbitrary. Bailing leaves the page exactly as it is
     today, which is the safe direction.

   Closing a tall box from the pinned button also brings the box back with
   her: she is standing at the bottom of a box whose top is a screen above,
   and shrinking it would otherwise leave her looking at whatever was
   underneath. The window only — never `scrollIntoView`, which walks every
   scrollable ancestor (the caret keeper's own rule).

   Include it once, anywhere: `<script src="/stickybox.js"></script>`, and
   mark the button `data-stickybox`. It picks up marked buttons present and
   future, so a button built in script only needs the attribute.

   TWO BUTTONS ON ONE BOX PIN TOGETHER (2026-09-11 — footage's corner grew a
   DIVIDE HERE beside the bigger-box toggle). "One pinned button at a time"
   is about two different BOXES; buttons sharing a box are one control row,
   and a row that pinned one of them and put the other away would read as
   half a control. Whichever box wins, every marked button on it pins.
   `data-stickybox="nofollow"` opts a button out of the follow-back below —
   for a tap that shrinks the box from its BOTTOM (a divide at the cursor)
   the seam is already where her eyes are, and bringing the box's TOP back
   on screen would walk the page away from it.

   AND A PINNED BUTTON IS NOW CHROME THE CARET MOVES FOR (2026-09-13, Sophie,
   typing at the end of a footage block: the corner buttons sitting ON the
   line she was writing). This pins to the bottom of caretkeep's band and
   caretkeep lifts her caret line to the bottom of the same band, so the two
   landed on each other — measured, 16px of a 22px line, with
   `elementFromPoint` on the caret's own line answering the divide button.
   The keeper reads what is pinned and stands its caret above it; every move
   here tells it (`nudgeCaret`), because a button that pins in this pass
   lands on a line the keeper has already decided was safe. What must NOT
   change is the band this asks for: narrowing THAT would walk these buttons
   up the screen a row per pass.
*/
(function () {
  if (window.__stickyBox) return;

  var GAP = 6;            // air under a pinned button
  var EDGE = 4;           // air inside a scroller's own bottom edge
  var raf = 0;
  var timers = [];
  var seen = [];          // {btn, wrap, dx, dy, w, h} — insets measured unpinned

  // ── one <style> for the pinned look ──
  (function () {
    var s = document.createElement('style');
    s.textContent = '[data-stickybox].sbx-pin{box-shadow:0 2px 8px rgba(43,38,32,.22)}';
    (document.head || document.documentElement).appendChild(s);
  })();

  function marked() {
    var out = [];
    var all = document.querySelectorAll('[data-stickybox]');
    for (var i = 0; i < all.length; i += 1) out.push(all[i]);
    return out;
  }

  // the bottom of what she can see, in client coordinates
  function bandBottom() {
    try {
      if (window.__caretKeep && window.__caretKeep.band) return window.__caretKeep.band().bottom;
    } catch (_) { /* fall through */ }
    var vv = window.visualViewport;
    if (vv && vv.height) return (vv.offsetTop || 0) + vv.height - 26;
    return window.innerHeight - 26;
  }
  function bandTop() {
    try {
      if (window.__caretKeep && window.__caretKeep.band) return window.__caretKeep.band().top;
    } catch (_) { /* fall through */ }
    var vv = window.visualViewport;
    return (vv && vv.height ? (vv.offsetTop || 0) : 0) + 10;
  }

  // PAGE CHROME PINNED TO THE BOTTOM OF THE SAME BAND (2026-09-14). Footage's
  // list/tiles bar is sticky at BOTH ends, so while she is up in the prompt
  // block it sits at the bottom of the viewport — exactly where these buttons
  // aim. Both are right and they cannot share the pixel, so a marked row wins
  // and the button pins above it. Read LIVE, never cached: the bar is at the
  // bottom for one stretch of the scroll, in the flow for the next and at the
  // top after that, and a set remembered at find time would reserve a band
  // that is no longer there. `band()` itself stays un-narrowed — narrowing it
  // for one of THESE buttons is the ratchet the 2026-09-13 note forbids, and
  // this is a row stickybox does not move.
  function chromeBottom() {
    var out = Infinity, all, i, r;
    try { all = document.querySelectorAll('[data-pagechrome]'); } catch (_) { return out; }
    for (i = 0; i < all.length; i += 1) {
      var c = all[i];
      if (c.hidden) continue;
      var cs = window.getComputedStyle(c);
      if (cs.position !== 'sticky' && cs.position !== 'fixed') continue;
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      r = c.getBoundingClientRect();
      if (!r.height) continue;
      // only a row really pinned near the BOTTOM of the band reserves anything;
      // the same bar at the top of the page is somebody else's problem.
      if (r.top > bandBottom() - r.height - 2) out = Math.min(out, r.top);
    }
    return out;
  }

  // A fixed child is only viewport-relative while nothing above it has made
  // itself the containing block. Anything else and this must not pin at all.
  function fixedIsViewport(el) {
    var p = el.parentElement;
    while (p && p !== document.body && p !== document.documentElement) {
      var cs = window.getComputedStyle(p);
      if ((cs.transform && cs.transform !== 'none')
        || (cs.filter && cs.filter !== 'none')
        || (cs.backdropFilter && cs.backdropFilter !== 'none')
        || (cs.perspective && cs.perspective !== 'none')
        || /transform|filter|perspective/.test(cs.willChange || '')
        || /paint|layout|strict|content/.test(cs.contain || '')) return false;
      p = p.parentElement;
    }
    return true;
  }

  // the nearest region the button belongs inside: a real scroller, or a fixed
  // sheet. Its bottom, else the band's.
  function regionBottom(el) {
    var p = el.parentElement, out = Infinity;
    while (p && p !== document.body && p !== document.documentElement) {
      var cs = window.getComputedStyle(p);
      var oy = cs.overflowY;
      var scrolls = (oy === 'auto' || oy === 'scroll' || oy === 'overlay');
      if (scrolls || cs.position === 'fixed') {
        var r = p.getBoundingClientRect();
        if (r.height) out = Math.min(out, r.bottom - EDGE);
        if (cs.position === 'fixed') break;
      }
      p = p.parentElement;
    }
    return out;
  }

  function entry(btn) {
    for (var i = 0; i < seen.length; i += 1) if (seen[i].btn === btn) return seen[i];
    var e = { btn: btn, wrap: btn.offsetParent || btn.parentElement, dx: null, dy: null, w: 0, h: 0, pinned: false };
    seen.push(e);
    if (window.ResizeObserver && e.wrap) {
      try {
        var ro = new ResizeObserver(function () { soon(); });
        ro.observe(e.wrap);
        e.ro = ro;
      } catch (_) { /* no observer — the scroll and input passes still run */ }
    }
    return e;
  }

  function unpin(e) {
    if (!e.pinned) return;
    e.pinned = false;
    e.btn.classList.remove('sbx-pin');
    var s = e.btn.style;
    s.position = ''; s.top = ''; s.left = ''; s.right = ''; s.bottom = ''; s.zIndex = ''; s.margin = '';
  }

  // What this button WANTS, measured: null to let go, else where to pin it and
  // how much of its box is inside the band (the tie-break below).
  function evaluate(e) {
    var btn = e.btn;
    if (!btn.isConnected || btn.hidden) return null;
    var wrap = btn.offsetParent || e.wrap;
    if (!e.pinned) {
      // the button is where the page put it: measure its insets from the wrap
      wrap = btn.offsetParent || btn.parentElement;
      e.wrap = wrap;
      if (!wrap) return null;
      var br = btn.getBoundingClientRect(), wr0 = wrap.getBoundingClientRect();
      if (!br.width || !br.height) return null;     // not laid out (a hidden panel)
      e.dx = br.right - wr0.right;
      e.dy = br.bottom - wr0.bottom;
      e.w = br.width; e.h = br.height;
    }
    if (!wrap || e.dy === null) return null;
    var wr = wrap.getBoundingClientRect();
    if (!wr.height) return null;

    var limit = Math.min(bandBottom(), regionBottom(btn), chromeBottom()) - GAP;
    var top = bandTop();
    var homeBottom = wr.bottom + e.dy;

    // pin only while the button's own corner is out of reach AND the box it
    // belongs to is still on screen
    if (!(homeBottom > limit && wr.top < limit && wr.bottom > top)) return null;
    if (!e.pinned && !fixedIsViewport(btn)) return null;
    return { wr: wr, limit: limit, score: Math.min(wr.bottom, limit) - Math.max(wr.top, top) };
  }

  function pin(e, p) {
    var wantR = p.wr.right + e.dx, wantB = p.limit;
    // A BUTTON ALREADY PINNED WHERE IT WANTS TO BE IS NOT TOUCHED (2026-09-12).
    // The input pass runs this on every keystroke, and it used to rewrite the
    // class and every inline style each time — a mutation and a style recalc
    // on a control inside the box she is typing in, per character, with
    // nothing on screen changing (the every-other-character family). Only a
    // pin that MOVED writes; a wrapped line moves the wrap's bottom and so
    // still lands here.
    if (e.pinned && e.pr === wantR && e.pb === wantB) return;
    e.pinned = true; e.pr = wantR; e.pb = wantB;
    e.btn.classList.add('sbx-pin');
    var s = e.btn.style;
    s.position = 'fixed';
    s.top = Math.round(wantB - e.h) + 'px';
    s.left = Math.round(wantR - e.w) + 'px';
    s.right = 'auto'; s.bottom = 'auto'; s.margin = '0';
    s.zIndex = '8';                                  // under the autoscroll pill's 9
    // A PAGE MAY DRESS THE PINNED BUTTON, so measure it where it landed: the
    // insets above were read while it sat in the page, and `.sbx-pin` styling
    // (footage's "… less" takes padding for its shadow to sit on) changes the
    // box after the arithmetic. One correction, off the real rect.
    var r = e.btn.getBoundingClientRect();
    if (Math.abs(r.right - wantR) > 0.5 || Math.abs(r.bottom - wantB) > 0.5) {
      s.left = Math.round(wantR - r.width) + 'px';
      s.top = Math.round(wantB - r.height) + 'px';
    }
  }

  // ONE PINNED BUTTON AT A TIME — the one whose box she is actually inside.
  // A page can carry several marked buttons (footage's own box, plus a
  // "… less" on every expanded clip in the feed), and two boxes can both end
  // below the fold for a scroll position or two — two floating words stacked
  // in the same spot reads as a broken control. The most-visible box wins.
  // ON A PHONE WITH THE KEYBOARD UP NOTHING PINS (2026-09-26). A pinned
  // button is `position:fixed`, and on iOS that is fixed to the LAYOUT
  // viewport — so it rides every pan the phone makes to reveal the caret,
  // and re-placing it after each pan (this used to resync on every
  // visualViewport scroll) moved the band the caret keeper aimed at and
  // called the keeper again: the two-state flip in her recording. The way
  // out of a tall box while typing is the keyboard's own Done; the button
  // comes back the moment the keyboard goes.
  function phoneTyping() {
    try {
      if (!window.__caretKeep || !window.__caretKeep.phoneOwns || !window.__caretKeep.phoneOwns()) return false;
      var a = document.activeElement;
      return !!a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT');
    } catch (_) { return false; }
  }
  function sync() {
    if (phoneTyping()) { seen.forEach(unpin); return; }
    var list = marked(), plans = [], best = null;
    for (var i = 0; i < list.length; i += 1) {
      var e = entry(list[i]);
      var p = evaluate(e);
      plans.push({ e: e, p: p });
      if (p && (!best || p.score > best.p.score)) best = plans[plans.length - 1];
    }
    for (var k = 0; k < plans.length; k += 1) {
      // the winning box's buttons pin together; every other box lets go
      if (best && plans[k].p && plans[k].e.wrap === best.e.wrap) pin(plans[k].e, plans[k].p);
      else unpin(plans[k].e);
    }
    // an entry whose button has left the page
    seen = seen.filter(function (e) {
      if (e.btn.isConnected) return true;
      if (e.ro) try { e.ro.disconnect(); } catch (_) { /* already gone */ }
      return false;
    });
    nudgeCaret();
  }

  // ── AND THE CARET MUST NOT END UP UNDER WHAT WE JUST PINNED (2026-09-13,
  //    Sophie, typing at the end of a footage block: the corner buttons
  //    sitting ON the line she was writing) ──
  // caretkeep lifts the caret line to the bottom of the same band these
  // buttons pin to, and it measures the chrome as it stood when IT ran — so a
  // button pinning in THIS pass lands on a line the keeper had already decided
  // was safe, and nothing re-checks until her next keystroke: measured, a new
  // line at the end of a scene left the caret 16px under the divide button
  // until something else happened. This move is the one moment that can know,
  // so it tells the keeper. Only when the pinned row really moved (the keeper
  // then scrolls, which brings us straight back here, and an unchanged row
  // says nothing — that is what ends it).
  var chrome = '';
  function nudgeCaret() {
    var now = seen.map(function (e) {
      return e.pinned ? Math.round(e.pb) + ',' + Math.round(e.pr) : '-';
    }).join('|');
    if (now === chrome) return;
    chrome = now;
    try {
      if (window.__caretKeep && window.__caretKeep.keep) window.__caretKeep.keep();
    } catch (_) { /* no keeper on this page */ }
  }
  function soon() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; sync(); });
  }
  // A box that changes height lands over several frames (the fit runs, the
  // font settles, a sheet finishes opening), so a tap re-asks a few times.
  function burst() {
    timers.forEach(clearTimeout); timers = [];
    soon();
    [60, 180, 400].forEach(function (ms) { timers.push(setTimeout(soon, ms)); });
  }

  // ── the box comes back with her when she closes it from the pinned button ──
  function follow(e) {
    if (!e.wrap) return;
    var wr = e.wrap.getBoundingClientRect();
    var top = bandTop();
    if (wr.top >= top - 1) return;                   // its top is already on screen
    if (regionBottom(e.btn) !== Infinity) return;    // a scroller of its own owns this
    // the VISUAL viewport's page position, not `scrollY`: with the keyboard
    // up iOS pans the one inside the other and `scrollTo` sets the visual
    // (caretkeep's 2026-09-26 note); the same number wherever there is no pan
    var y = window.scrollY;
    try { if (window.__caretKeep && window.__caretKeep.pageTop) y = window.__caretKeep.pageTop(); } catch (_) { /* the window's own */ }
    var max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    var to = Math.max(0, Math.min(max, y + (wr.top - top - 12)));
    if (Math.abs(to - y) > 2) window.scrollTo(0, to);
  }

  document.addEventListener('click', function (ev) {
    var btn = ev.target && ev.target.closest && ev.target.closest('[data-stickybox]');
    if (!btn) { soon(); return; }
    var e = entry(btn);
    var was = e.pinned;
    var nofollow = /\bnofollow\b/.test(btn.getAttribute('data-stickybox') || '');
    // the page's own handler runs first and changes the box; then we place
    setTimeout(function () {
      sync();
      if (was && !e.pinned && !nofollow) follow(e);  // it shrank — bring the box back
      burst();
    }, 0);
  }, true);

  window.addEventListener('scroll', soon, true);
  window.addEventListener('resize', function () {
    seen.forEach(unpin);                             // re-measure the insets from scratch
    burst();
  });
  document.addEventListener('input', function () { soon(); }, true);
  document.addEventListener('focusin', function () { burst(); }, true);
  document.addEventListener('focusout', function () { burst(); }, true);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', burst);
    // a pan is the phone revealing the caret (or her finger): the pinned
    // buttons ride it as the same pixels on screen, and re-placing them
    // after it is what kept the caret keeper running — so a pan alone
    // re-syncs nothing; the keyboard opening or closing still does
    window.visualViewport.addEventListener('scroll', function () { if (!phoneTyping()) soon(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', burst);
  else burst();

  window.__stickyBox = {
    version: 4,
    sync: sync,
    pinned: function (btn) { var e = entry(btn); return !!e.pinned; },
  };
})();
