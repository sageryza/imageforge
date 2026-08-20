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
    // keep their places and nothing overlaps.
    '#forgeback{flex:0 0 auto;width:32px;height:32px;margin:0 2px 0 -6px;padding:0;'
    + 'display:flex;align-items:center;justify-content:center;border:0;border-radius:6px;'
    + 'background:none;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;}'
    + '#forgeback svg{display:block;width:20px;height:20px;fill:none;stroke:currentColor;'
    + 'stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}'
    // THE TITLE COMES BACK. tool.css hides `.tool-eyebrow` under body.embed and
    // body.native because the nav bar was carrying the title; with the bar gone
    // that would leave the row nameless. Same for the band itself, which was
    // collapsed to a bare strip precisely because it held nothing but the "?".
    + 'body.pagehead .tool-eyebrow,body.pagehead .app-header{display:block !important;}'
    + 'body.pagehead .tool .head{position:sticky;top:0;border-bottom:1px solid var(--border);'
    + 'padding-top:calc(10px + env(safe-area-inset-top));padding-bottom:10px;}';

  function chevron() {
    var btn = document.createElement('button');
    btn.id = 'forgeback';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Back');
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>';
    btn.addEventListener('click', function () {
      // 1. the page's own levels, 2. the web view's history, 3. leave the tool
      try {
        if (window.__navBack && window.__navBack() === true) return;
      } catch (e) { /* a page's handler must never trap her inside the tool */ }
      if (window.history.length > 1) { window.history.back(); return; }
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
