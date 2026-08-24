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
    // THE ONE TOP INSET (2026-08-23, Sophie: "the header is different in both,
    // and not at the top" — and it was the Nth time). Measured across all 39
    // gated pages: the gap above the header ran 0 to 42px, no two families
    // agreeing, because no one owned the number — every page improvised its
    // own status-bar clearance (chats' 5vh IS ~the notch on an 844pt phone,
    // by accident) and every new page copied its neighbour's. This token is
    // the number now, and levelRow() below ENFORCES it (the pill's lesson:
    // injected chrome declares and defends everything it needs).
    ':root{--headtop:calc(env(safe-area-inset-top,0px) + 4px);}'
    // The chevron sits in the header row's own flow, so the title and the "?"
    // keep their places and nothing overlaps. IT WEARS A SMALL ROUNDED BOX
    // (Aug 2026, Sophie: "a small rounded box around the back chevron so it
    // has a bigger tap target") — a rounded rectangle, 6px, never a pill.
    + '#forgeback{flex:0 0 auto;width:34px;height:34px;margin:0 2px 0 -4px;padding:0;'
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
    // `.tool` is sometimes a wrapper div and sometimes a class on <body>
    // itself (studio, vector, review…) — `body.pagehead .tool .head` silently
    // never matched the second kind, which is why those pages kept tool.css's
    // own 12px and nobody noticed: the rule failing to apply looks identical
    // to the rule not existing.
    + 'body.pagehead .tool .head,body.pagehead.tool .head{position:sticky;top:0;'
    + 'border-bottom:1px solid var(--border);'
    + 'padding-top:var(--headtop);padding-bottom:10px;}'
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
      levelRow(btn, row);
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
      btn.style.top = 'var(--headtop,4px)';
      btn.style.left = '16px';
      btn.style.marginLeft = '0';   // the in-flow -4 pull would land it at 12
      btn.style.zIndex = '30';
      document.body.appendChild(btn);
    }
  }

  /* THE ROW IS LEVELLED BY MEASUREMENT, NOT BY ASKING THE PAGE NICELY
     (2026-08-23). The chevron's top comes from whatever the host page wrapped
     around its header — a `.wrap{padding:5vh …}`, a flat 16px, nothing at all
     — and pagehead cannot reach an unknown ancestor with CSS. So it does what
     the pill does: measure the real box and correct until the chevron's top
     edge sits at var(--headtop) and its left edge at 16px — the values
     Sophie approved on the Story Room. Guards, each earned on a real page:
     - viewport-fit=cover is ensured first — 16 pages ship without it, and
       without it env(safe-area-inset-top) is 0 on a full-bleed build, which
       is exactly why those pages improvised fixed-px clearances (chats' 5vh
       IS roughly the notch on an 844pt phone, by accident).
     - a STICKY or FIXED row is corrected through its PADDING, never its
       margin: margin only moves the static position, and sticky re-pins the
       row at top:0 the moment that goes negative — measured on /studio,
       where a -10.5px margin moved the header exactly 0px.
     - an in-flow row is corrected through its MARGIN, so the whole page
       under it moves too and dead space is reclaimed rather than papered
       over — and pulling one UP only happens when the space above it is
       DEAD (only ancestors of the row paint there); a page that
       deliberately stacks content above its header keeps it.
     - a HIDDEN row (cutmarks, the editor — headers that wait for a
       recording to load) is left alone: correcting a 0x0 rect writes
       garbage. The IntersectionObserver below retries when it appears.
     - nothing moves more than 64px (24px sideways): a page that far off is
       a layout this code does not understand, and a wrong guess pasted over
       it would be worse than the gap.
     - sync() is a NO-OP while the chevron is already on target, which is
       what lets the ResizeObserver watch layout without feeding back: our
       own correction resizes the body, the observer fires, the check
       passes, the loop ends. Measured only at scrollY 0 — a sticky row
       mid-scroll reads its stuck position, not its static one. */
  function levelRow(btn, row) {
    try {
      var vp = document.querySelector('meta[name="viewport"]');
      if (vp && vp.content.indexOf('viewport-fit') < 0) {
        vp.content += ',viewport-fit=cover';
      } else if (!vp) {
        vp = document.createElement('meta');
        vp.name = 'viewport';
        vp.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
        document.head.appendChild(vp);
      }
    } catch (e) { /* the correction below still lands, just without env() */ }
    var probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;top:var(--headtop,4px);' +
      'width:0;height:0;visibility:hidden;pointer-events:none;';
    document.body.appendChild(probe);
    function deadAbove(y) {
      var xs = [window.innerWidth * 0.3, window.innerWidth * 0.7];
      for (var i = 0; i < xs.length; i++) {
        var el = document.elementFromPoint(xs[i], Math.max(1, y));
        if (el && el !== document.documentElement && el !== document.body &&
            !el.contains(row)) return false;
      }
      return true;
    }
    // What is levelled is the row's CONTENT-BOX top, not the chevron's own —
    // a tall band (search: title + its box, 60px) centres the chevron inside
    // itself, and chasing the chevron there would strip the band's padding
    // and pin it to the glass (measured: search lost all 12px and sat at 0).
    function contentTop(r) {
      return r.getBoundingClientRect().top + (parseFloat(getComputedStyle(r).paddingTop) || 0);
    }
    function sync() {
      if (window.scrollY > 0) return;
      if (!btn.getBoundingClientRect().width) return;         // hidden row
      var target = probe.getBoundingClientRect().top;
      if (Math.abs(contentTop(row) - target) <= 1 &&
          Math.abs(btn.getBoundingClientRect().left - 16) <= 1) return;
      var sticky = /sticky|fixed/.test(getComputedStyle(row).position);
      if (sticky) row.style.paddingTop = ''; else row.style.marginTop = '';
      btn.style.marginLeft = '';
      var ct = contentTop(row);                               // the natural box
      var dy = target - ct;
      if (Math.abs(dy) > 1 && Math.abs(dy) <= 64 && (dy > 0 || deadAbove(ct / 2))) {
        if (sticky) {
          var pad = parseFloat(getComputedStyle(row).paddingTop) || 0;
          row.style.paddingTop = Math.max(0, pad + dy) + 'px';
        } else {
          var m = parseFloat(getComputedStyle(row).marginTop) || 0;
          row.style.marginTop = (m + dy) + 'px';
        }
      }
      var dx = 16 - btn.getBoundingClientRect().left;
      // -4 is the chevron's own baked pull (see the #forgeback CSS)
      if (Math.abs(dx) > 1 && Math.abs(dx) <= 24) {
        btn.style.marginLeft = (-4 + dx) + 'px';
      }
    }
    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', function () { setTimeout(sync, 350); });
    window.addEventListener('pageshow', sync);
    if (document.readyState !== 'complete') {
      window.addEventListener('load', function () { setTimeout(sync, 50); });
    }
    try { document.fonts.ready.then(function () { sync(); }); } catch (e) { /* older engine */ }
    try { new ResizeObserver(function () { sync(); }).observe(document.body); } catch (e) { /* older engine */ }
    try {
      new IntersectionObserver(function (es) {
        for (var i = 0; i < es.length; i++) if (es[i].isIntersecting) sync();
      }).observe(btn);
    } catch (e) { /* older engine */ }
  }

  // `defer` normally means the body is parsed by now, but these pages are also
  // opened by hand and by tests where the tag can land early.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', draw);
  } else {
    draw();
  }
})();
