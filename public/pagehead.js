/* pagehead.js — THE PAGE'S OWN HEADER INSIDE THE APP (Aug 2026, Sophie: "get
   rid of the apple native bar").

   Every web tool used to wear two title strips: Apple's nav bar (its chevron,
   the tool's name) and the page's own header underneath it, which hid its
   title because the bar already showed it — so it sat there holding nothing
   but the "?". This draws the one row that replaces both: the page's own
   title and controls, with a back chevron at the left.

   IT ONLY RUNS WHEN THE APP HAS HANDED OVER — the test is `window.__forgeLeave`,
   the bridge that only exists in the build that also hides Apple's bar. On an
   older build this file does nothing at all, so the two halves can ship in
   either order.

   IT ADDS `body.pagehead` ITSELF rather than trusting the server to, because
   only about half these pages are asked for with `?embed=1`: the hand-rolled
   wrappers (Cutting Blocks, Cut Marks, the Cutting Room, Pausing, Playground,
   Search…) load their page at a bare path. Self-gating means one rule covers
   both kinds.

   IT DOES NOT TOUCH A PAGE'S OWN CONTROLS. `__nativeNavBar` is still set by the
   app and still means what it always meant — "back is handled by chrome outside
   your content, don't draw your own" — so the ten pages that honour it go on
   hiding their own chevron, and this one takes its place. Nothing had to be
   re-decided page by page, which matters because `#back` means different things
   on different pages (on the Story Timeline it is a "Stories" button back to the
   shelf, not a way out of the tool).

   THE BACK CHEVRON ASKS THE PAGE FIRST, which is the whole reason this is worth
   moving off the native side: `__navBack` steps a multi-level page back one
   level (a story to its shelf, an open recording to its list), then the web
   view's own history, and only then does it leave the tool. That order used to
   live in Swift, where changing it cost a TestFlight build — "the back button
   always goes back too far" sat on her phone for weeks for exactly that reason.
   Here it ships with a deploy. */
(function () {
  var CSS =
    // The chevron sits in the header row's own flow, so the title and the "?"
    // keep their places and nothing overlaps. IT WEARS A SMALL ROUNDED BOX
    // (Aug 2026, Sophie: "a small rounded box around the back chevron so it
    // has a bigger tap target") — a rounded rectangle, 6px, never a pill.
    '#forgeback{flex:0 0 auto;width:34px;height:34px;margin:0 2px 0 -4px;padding:0;'
    + 'display:flex;align-items:center;justify-content:center;'
    + 'border:1px solid var(--border,#ddd3c4);border-radius:6px;'
    + 'background:var(--surface,transparent);color:inherit;cursor:pointer;'
    + '-webkit-tap-highlight-color:transparent;}'
    + '#forgeback svg{display:block;width:20px;height:20px;fill:none;stroke:currentColor;'
    + 'stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}'
    // THE TITLE COMES BACK. tool.css hides `.tool-eyebrow` under body.embed and
    // body.native because the nav bar was carrying the title; with the bar gone
    // that would leave the row nameless. Same for the band itself, which was
    // collapsed to a bare strip precisely because it held nothing but the "?".
    // `.app-header` is display:FLEX, never block (Aug 2026, Sophie's Meta
    // Assets screenshot): the old block !important killed the page's own flex
    // row, so the inserted chevron and the h1 stacked and the title dropped
    // into the row below, under the injected pill.
    + 'body.pagehead .tool-eyebrow{display:block !important;}'
    + 'body.pagehead .app-header{display:flex !important;position:relative;}'
    // the WEB-HUB BRAND row (report.html / photo.html — "ImageForge · ← Hub")
    // is an .app-header too, but it is not a title band: keep it exactly as
    // the un-hide always left it, and never centre inside it (.fh is skipped
    // for it below).
    + 'body.pagehead .app-header:has(.brand){display:block !important;position:static;}'
    + 'body.pagehead .app-header h1{display:block !important;}'
    + 'body.pagehead .tool .head{position:sticky;top:0;border-bottom:1px solid var(--border);'
    + 'padding-top:calc(10px + env(safe-area-inset-top));padding-bottom:10px;}'
    // THE TITLE SITS IN THE TOP MIDDLE (Aug 2026, Sophie: "the text shud be in
    // the top middle"). Centred on the SCREEN, not on the leftover flex space
    // — the chevron on the left and the "?" + the pill's corner on the right
    // are different widths, so flex centring reads off-centre. The 88px insets
    // keep a long title off both the chevron and the "?", and it ellipsises
    // rather than wrapping into the row below. `.fh` is stamped on whichever
    // header row the chevron was inserted into, so only that row is touched.
    // DIRECT children only: a header that stacks its own eyebrow + title +
    // meta inside a wrapper (Cut Marks, the Cutting Room, Search) keeps its
    // layout — pulling a nested h1 out of that stack would shatter it.
    + '.fh > .tool-eyebrow,.fh > h1{position:absolute;left:88px;right:88px;top:50%;'
    + 'transform:translateY(-50%);margin:0;text-align:center;white-space:nowrap;'
    + 'overflow:hidden;text-overflow:ellipsis;}'
    // the centred title used to be the row's flex spacer, so without this the
    // "?" (or whatever ends the row) slides in next to the chevron
    + '.fh > :last-child:not(h1):not(.tool-eyebrow){margin-left:auto;}';

  /* HOW DEEP IS THIS ENTRY? `history.length` cannot answer it (Aug 2026,
     Sophie: "the back button doesn't work either, or doesn't go anywhere" —
     on the Review Queue, after opening a deck and coming back, the queue sits
     at history index 0 with length 2, so `history.back()` was a silent no-op
     and the chevron read as dead). The entry's own depth is stamped onto
     `history.state` the first time it is seen (0 for the page the tool opened
     on, 1 for a page navigated into, …) and read back on every return —
     including a bfcache restore, which keeps the state. sessionStorage
     carries the "next entry's depth" between navigations. */
  try {
    var st = window.history.state || {};
    var myDepth = typeof st.__forgeDepth === 'number'
      ? st.__forgeDepth
      : Number(sessionStorage.getItem('__forgeDepth') || 0);
    if (typeof st.__forgeDepth !== 'number') {
      window.history.replaceState(
        Object.assign({}, st, { __forgeDepth: myDepth }), document.title);
    }
    sessionStorage.setItem('__forgeDepth', String(myDepth + 1));
    // coming BACK to this entry (bfcache) must re-sync the counter, or the
    // next page she opens inherits a stale, too-deep number
    window.addEventListener('pageshow', function () {
      try { sessionStorage.setItem('__forgeDepth', String(myDepth + 1)); } catch (e) { /* private mode */ }
    });
  } catch (e) { /* private mode — the bail timer below still covers her */ }

  /** This entry's depth inside the tool, read LIVE at tap time: 0 = the page
   *  the tool opened on, more = navigated into. An entry with no stamp (a
   *  page's own pushState, a hash link) was necessarily navigated TO, so it
   *  counts as deep. Read from history.state rather than a closure because a
   *  pushState after load changes which entry is current. */
  function entryDepth() {
    try {
      var st = window.history.state;
      if (st && typeof st.__forgeDepth === 'number') return st.__forgeDepth;
    } catch (e) { /* fall through */ }
    return window.history.length > 1 ? 1 : 0;
  }

  function chevron() {
    var btn = document.createElement('button');
    btn.id = 'forgeback';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Back');
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>';
    btn.addEventListener('click', function () {
      // 1. the page's own levels, 2. the web view's history — but only when
      //    this entry really has somewhere to go back TO, 3. leave the tool.
      //    `history.length` alone cannot tell (Aug 2026, Sophie: "the back
      //    button … doesn't go anywhere" — the Review Queue after a deck
      //    round-trip sits at index 0 with length 2, and history.back() there
      //    is a silent no-op).
      try {
        if (window.__navBack && window.__navBack() === true) return;
      } catch (e) { /* a page's handler must never trap her inside the tool */ }
      if (entryDepth() > 0 && window.history.length > 1) {
        // the belt: if back() turns out to be a no-op anyway (a page wiped the
        // depth stamp), leave the tool rather than reading as a dead button —
        // a real back fires popstate (same-document) or pagehide (navigation)
        // first and cancels this.
        var bail = setTimeout(function () {
          if (window.__forgeLeave) window.__forgeLeave();
        }, 400);
        var cancel = function () { clearTimeout(bail); };
        window.addEventListener('popstate', cancel, { once: true });
        window.addEventListener('pagehide', cancel, { once: true });
        window.history.back();
        return;
      }
      if (window.__forgeLeave) window.__forgeLeave();
    });
    return btn;
  }

  function draw() {
    if (!window.__forgeLeave) return;               // older build — do nothing
    if (!document.body || document.getElementById('forgeback')) return;
    document.body.classList.add('pagehead');

    var css = document.createElement('style');
    css.textContent = CSS;
    document.head.appendChild(css);

    // Whichever kit this page uses. Nothing to sit in (a page with no header
    // row at all) → float it in the corner rather than drop the only way out.
    var btn = chevron();
    var row = document.querySelector('.tool .head')
      || document.querySelector('.app-header')
      || document.querySelector('header');
    if (row) {
      row.insertBefore(btn, row.firstChild);
      // `.fh` centres the row's title (see the CSS above) — but never inside
      // the web-hub brand row, whose h1 is "ImageForge" and not a title. The
      // absolute title needs a positioned row — set relative only where the
      // page left it static, so a sticky header (tool.css's, Cutting
      // Blocks') keeps its own.
      if (!row.querySelector('.brand')) {
        row.classList.add('fh');
        try {
          if (getComputedStyle(row).position === 'static') row.style.position = 'relative';
        } catch (e) { /* headless quirk — the title stays in flow */ }
      }
    } else {
      btn.style.position = 'fixed';
      btn.style.top = 'max(10px, env(safe-area-inset-top))';
      btn.style.left = '8px';
      btn.style.zIndex = '30';
      document.body.appendChild(btn);
    }
  }

  // `defer` normally means the body is parsed by now, but these pages are also
  // opened by hand and by tests where the tag can land early.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', draw);
  } else {
    draw();
  }
})();
