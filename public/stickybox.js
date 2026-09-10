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

  function place(e) {
    var btn = e.btn;
    if (!btn.isConnected || btn.hidden) { unpin(e); return; }
    var wrap = btn.offsetParent || e.wrap;
    if (!e.pinned) {
      // the button is where the page put it: measure its insets from the wrap
      wrap = btn.offsetParent || btn.parentElement;
      e.wrap = wrap;
      if (!wrap) return;
      var br = btn.getBoundingClientRect(), wr0 = wrap.getBoundingClientRect();
      if (!br.width || !br.height) return;          // not laid out (a hidden panel)
      e.dx = br.right - wr0.right;
      e.dy = br.bottom - wr0.bottom;
      e.w = br.width; e.h = br.height;
    }
    if (!wrap || e.dy === null) return;
    var wr = wrap.getBoundingClientRect();
    if (!wr.height) { unpin(e); return; }

    var limit = Math.min(bandBottom(), regionBottom(btn)) - GAP;
    var top = bandTop();
    var homeBottom = wr.bottom + e.dy;

    // pin only while the button's own corner is out of reach AND the box it
    // belongs to is still on screen
    var want = homeBottom > limit && wr.top < limit && wr.bottom > top;
    if (want && !e.pinned && !fixedIsViewport(btn)) want = false;

    if (!want) { unpin(e); return; }
    e.pinned = true;
    btn.classList.add('sbx-pin');
    var s = btn.style;
    s.position = 'fixed';
    s.top = Math.round(limit - e.h) + 'px';
    s.left = Math.round(wr.right + e.dx - e.w) + 'px';
    s.right = 'auto'; s.bottom = 'auto'; s.margin = '0';
    s.zIndex = '8';                                  // under the autoscroll pill's 9
  }

  function sync() {
    var list = marked();
    for (var i = 0; i < list.length; i += 1) place(entry(list[i]));
    // an entry whose button has left the page
    seen = seen.filter(function (e) {
      if (e.btn.isConnected) return true;
      if (e.ro) try { e.ro.disconnect(); } catch (_) { /* already gone */ }
      return false;
    });
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
    var max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    var to = Math.max(0, Math.min(max, window.scrollY + (wr.top - top - 12)));
    if (Math.abs(to - window.scrollY) > 2) window.scrollTo(0, to);
  }

  document.addEventListener('click', function (ev) {
    var btn = ev.target && ev.target.closest && ev.target.closest('[data-stickybox]');
    if (!btn) { soon(); return; }
    var e = entry(btn);
    var was = e.pinned;
    // the page's own handler runs first and changes the box; then we place
    setTimeout(function () {
      sync();
      if (was && !e.pinned) follow(e);               // it shrank — bring the box back
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
    window.visualViewport.addEventListener('scroll', soon);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', burst);
  else burst();

  window.__stickyBox = {
    version: 1,
    sync: sync,
    pinned: function (btn) { var e = entry(btn); return !!e.pinned; },
  };
})();
