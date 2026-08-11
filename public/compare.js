/* compare.js — the shared BEHAVIOUR half of a Compare page (Aug 2026, Sophie's
   ask: "a shell every chat can use for their compare page that has the auto
   scroll pill with everything exempt").

   compare.css gives a page the one house look; this gives it the one house
   behaviour. Include it once, after the content:

     <link rel="stylesheet" href="/compare.css">
     ...
     <script src="/compare.js"></script>

   That is the whole integration. It wires, correctly, the three things every
   hand-rolled Compare page has got wrong at least once:

   1. ANY TAP PAUSES THE AUTOSCROLL — Sophie's rule: while she is voting,
      typing or tapping anything, the page must not keep creeping underneath
      her. Capture phase, so it fires even when the tap lands on a button.
   2. …EXCEPT ON THE PILL ITSELF. `__scrollStop` repaints the pill's glyphs,
      and swapping the tapped element out mid-press EATS the click — an
      unconditional handler makes the pill's own play button dead. Found live
      on Cut Marks, fixed again on the Cutting Room; now it cannot recur.
      Anything inside `[data-nostop]` is skipped too, for a control that must
      not disturb playback.
   3. OPENING AN IMAGE FREEZES THE PAGE BEHIND IT — autoscroll stopped,
      background scroll locked, AND the scroll position saved on open and
      restored on close (locking alone does not stop `window.scrollBy`, so
      anything that restarts the scroll under the overlay still moves the
      page — this bit her repeatedly).
   4. AN EXTERNAL LINK LEAVES THE IFRAME instead of navigating it. In the app
      a Compare page runs EMBEDDED (chats.html opens it in an iframe with
      `?embed=1`), so a plain `<a href="https://claude.ai/…">` tries to load
      that site INSIDE the frame — and claude.ai sends
      `x-frame-options: SAMEORIGIN` (verified 2026-08-10), so the load is
      refused and the tap reads as bouncing back to the page. Sophie hit this
      on the chat-survey page's "Open the chat" link. An off-origin link is
      therefore opened from the TOP document with `target="_blank"` — exactly
      what the Chats app's own Open button does — and never navigates the
      web view away from the app.

   The pill itself is INJECTED BY THE SERVER on every served page — never add
   your own, and never re-implement its script. This file only talks to it
   through the globals it publishes (`__scrollStop`, `__pillInteractive`).

   Everything here is inside an IIFE on purpose: the injected pill snippet runs
   in GLOBAL scope and declares `var raf`, `var I`, `var playing`, … A page (or
   a shared script) that declares those at top level kills the pill's script at
   PARSE time. Your own page script must be wrapped the same way.
*/
(function () {
  if (window.__compareShell) return;          // safe to include twice
  window.__compareShell = { version: 1 };

  /* 1 + 2 — any tap pauses, the pill and opted-out controls exempt. */
  document.addEventListener('pointerdown', function (e) {
    var t = e.target;
    try {
      if (t && t.closest && (t.closest('.float') || t.closest('[data-nostop]'))) return;
    } catch (_) { /* a non-element target (text node in odd browsers) — carry on */ }
    if (window.__scrollStop) window.__scrollStop();
  }, true);

  /* 3 — the image lightbox. Opt in per image with class="zoom", or get it for
     free on any image inside the skeleton's .imgrow block. */
  var lb = null, savedY = 0;

  function ensureLightbox() {
    if (lb) return lb;
    lb = document.createElement('div');
    lb.className = 'cmp-lb';
    lb.setAttribute('hidden', '');
    lb.innerHTML = '<img alt="">';
    lb.addEventListener('click', close);
    document.body.appendChild(lb);
    var css = document.createElement('style');
    css.textContent =
      '.cmp-lb{position:fixed; inset:0; z-index:60; background:rgba(20,18,15,.92);' +
      ' display:flex; align-items:center; justify-content:center; padding:16px; cursor:zoom-out;}' +
      '.cmp-lb[hidden]{display:none !important;}' +
      '.cmp-lb img{max-width:100%; max-height:100%; object-fit:contain; border-radius:4px;}';
    document.head.appendChild(css);
    return lb;
  }

  function open(src, alt) {
    var el = ensureLightbox();
    savedY = window.scrollY;                       // restored on close, always
    if (window.__scrollStop) window.__scrollStop();
    el.querySelector('img').src = src;
    el.querySelector('img').alt = alt || '';
    el.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (!lb || lb.hasAttribute('hidden')) return;
    lb.setAttribute('hidden', '');
    document.body.style.overflow = '';
    window.scrollTo(0, savedY);        // exactly where she opened it, whatever
  }                                    // happened behind the overlay

  document.addEventListener('click', function (e) {
    // .duo joined the list (Aug 2026): a labeled side-by-side's images are as
    // tappable as any other picture on a Compare page.
    var img = e.target && e.target.closest ? e.target.closest('img.zoom, .imgrow img, .duo img') : null;
    if (!img) return;
    e.preventDefault();
    open(img.getAttribute('data-full') || img.src, img.alt);
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  window.__compareShell.openImage = open;
  window.__compareShell.closeImage = close;

  /* 4 — an EXTERNAL link must leave the iframe, never navigate it (see the
     header). Only off-origin http(s) links are touched: a relative or
     same-origin link is the page's own business, and an in-page `#anchor`
     must keep working. Standalone (not embedded) pages are left alone too —
     an ordinary link is already right there. */
  function openOut(href) {
    var doc = null;
    // same-origin parent, so this reaches the app's own document; a
    // cross-origin host would throw, and window.open is the fallback.
    try { doc = window.top.document; } catch (_) { doc = null; }
    if (doc && doc.body) {
      var a = doc.createElement('a');
      a.href = href; a.target = '_blank'; a.rel = 'noopener';
      doc.body.appendChild(a);
      a.click();
      doc.body.removeChild(a);
      return true;
    }
    return !!window.open(href, '_blank', 'noopener');
  }
  document.addEventListener('click', function (e) {
    if (window.top === window.self) return;              // not embedded
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.href;                                   // resolved, absolute
    if (!/^https?:/i.test(href)) return;                 // mailto:, #anchor, …
    if (a.origin === window.location.origin) return;     // our own pages
    e.preventDefault();
    openOut(href);
  });
  window.__compareShell.openExternal = openOut;

  /* 5 — THE FILM ROW: a finished video is A LINE OF TEXT WITH A PLAY BUTTON
     at the TOP of the page, never an embedded <video> (Aug 2026, Sophie:
     "never put a whole video when it's gonna be opened as a lightbox anyway,
     it should just be a line of text with a play button… so I don't just
     scroll through the whole thing").

     Why: a <video> at the top is a huge black box she has to scroll past
     every time she opens the page — and tapping it goes fullscreen anyway,
     so the box bought nothing. The row is one line; the film opens over the
     page when she asks for it.

         <div id="film"></div>
         window.__filmRow({ url: '…/cut-v2.mp4', label: 'Mason — the shape',
                            meta: '4:56', mount: '#film' });

     Same overlay contract as the image lightbox: autoscroll stopped, page
     locked, scroll position restored on close, and the video is torn down on
     close so it can never keep playing behind the page. */
  var vlb = null, vSavedY = 0;
  function ensureVideoLB() {
    if (vlb) return vlb;
    vlb = document.createElement('div');
    vlb.className = 'cmp-vlb';
    vlb.setAttribute('hidden', '');
    vlb.innerHTML = '<button class="cmp-vlb-x" aria-label="Close">✕</button>'
      + '<video controls playsinline preload="metadata"></video>';
    vlb.addEventListener('click', function (e) {
      // only the backdrop and the ✕ close it — a tap on the controls must not
      if (e.target === vlb || (e.target.className || '') === 'cmp-vlb-x') closeVideo();
    });
    document.body.appendChild(vlb);
    var css = document.createElement('style');
    css.textContent =
      '.cmp-vlb{position:fixed; inset:0; z-index:61; background:rgba(20,18,15,.94);'
      + ' display:flex; align-items:center; justify-content:center; padding:14px;}'
      + '.cmp-vlb[hidden]{display:none !important;}'
      + '.cmp-vlb video{max-width:100%; max-height:100%; border-radius:4px; background:#000;}'
      + '.cmp-vlb-x{position:absolute; top:max(10px,env(safe-area-inset-top)); right:12px;'
      + ' width:38px; height:38px; border-radius:50%; border:1.5px solid #fff; background:rgba(0,0,0,.35);'
      + ' color:#fff; font-size:17px; line-height:1; cursor:pointer;}'
      + '.cmp-film{display:flex; align-items:center; gap:10px; width:100%; text-align:left;'
      + ' padding:10px 12px; margin:10px 0 4px; border:1.5px solid var(--ink,#2b2724);'
      + ' border-radius:6px; background:var(--paper,#fff); color:var(--ink,#2b2724);'
      + ' font:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent;}'
      + '.cmp-film .g{flex:0 0 auto; width:30px; height:30px; border-radius:50%;'
      + ' border:1.5px solid var(--ink,#2b2724); display:flex; align-items:center; justify-content:center;}'
      + '.cmp-film .t{flex:1 1 auto; font-size:15px;}'
      + '.cmp-film .m{flex:0 0 auto; font-size:12.5px; color:var(--ink2,#7a736c);}';
    document.head.appendChild(css);
    return vlb;
  }
  function openVideo(src, poster) {
    var el = ensureVideoLB();
    vSavedY = window.scrollY;
    if (window.__scrollStop) window.__scrollStop();
    var v = el.querySelector('video');
    v.src = src;
    if (poster) v.poster = poster;
    el.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    var p = v.play();                       // inside the tap, so iOS allows it
    if (p && p.catch) p.catch(function () { /* she can press play herself */ });
  }
  function closeVideo() {
    if (!vlb || vlb.hasAttribute('hidden')) return;
    var v = vlb.querySelector('video');
    try { v.pause(); } catch (_) { /* already gone */ }
    v.removeAttribute('src'); v.load();     // or it keeps playing behind the page
    vlb.setAttribute('hidden', '');
    document.body.style.overflow = '';
    window.scrollTo(0, vSavedY);
  }
  window.__filmRow = function (opts) {
    opts = opts || {};
    if (!opts.url) return null;
    var mount = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
    if (!mount) {                            // no mount given: under the header
      var wrap = document.querySelector('.wrap') || document.body;
      mount = document.createElement('div');
      var after = wrap.querySelector('.sub') || wrap.querySelector('h1') || wrap.querySelector('.eyebrow');
      if (after && after.parentNode === wrap) wrap.insertBefore(mount, after.nextSibling);
      else wrap.insertBefore(mount, wrap.firstChild);
    }
    var b = document.createElement('button');
    b.className = 'cmp-film';
    b.type = 'button';
    b.innerHTML = '<span class="g"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"'
      + ' stroke="currentColor" stroke-width="1" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg></span>'
      + '<span class="t"></span><span class="m"></span>';
    b.querySelector('.t').textContent = opts.label || 'Play the film';
    b.querySelector('.m').textContent = opts.meta || '';
    b.addEventListener('click', function () { openVideo(opts.url, opts.poster); });
    mount.appendChild(b);
    return b;
  };
  window.__compareShell.openVideo = openVideo;
  window.__compareShell.closeVideo = closeVideo;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeVideo(); });

  /* 6 — NOTES ON ANYTHING (Aug 2026, Sophie's standing rule: "whenever
     applicable notes should be able to be added"). Reviewing is not only
     yes/no — she needs to say WHY, or what to change, next to the thing
     itself. So every Compare page that shows reviewable items gets a note
     box per item, and it lives here rather than being hand-rolled per page.

     Wire it in one line, after your items are in the DOM:

       window.__compareNotes({ chat: 'my-chat', sheet: 'page-thing-v1' });

     Every element carrying `data-item="<id>"` gets a note affordance: a
     SMALL + PINNED IN THAT ITEM'S TOP-RIGHT CORNER, costing no height (Aug
     2026, Sophie — v1 put a "+ note" button on its own line under every item
     and left a written note open, which "takes up too much space and makes
     it hard to see everything at once"). The box opens only while she writes
     in it and folds away on blur; an item that has a note wears a filled
     gold +. Do not put it back in flow and do not auto-open a written note.
     Notes
     save to the SAME verdict doc as votes but a DIFFERENT field (`text` vs
     `ok`), so writing one never clears the other — read both back with
     GET /api/chatfeed/verdict?chat=&sheet= → { items, texts }.

     Never post a note to /api/chatfeed/reply: a note on a page is not a chat
     message (the server reroutes it anyway, but say what you mean).

     Saving is debounced while she types and flushed on blur and on pagehide,
     so a note is never lost by navigating away mid-sentence. */
  var noteCfg = null, noteTimers = {};

  function postNote(item, text) {
    if (!noteCfg) return Promise.resolve();
    return fetch('/api/chatfeed/verdict', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: noteCfg.chat, sheet: noteCfg.sheet, item: item, text: text }),
    }).catch(function () { /* offline — the text stays in the box */ });
  }

  var PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    + 'stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

  function buildNote(host, item, existing) {
    if (host.querySelector(':scope > .cmp-note')) return;
    // the + is pinned in the item's corner, so the host has to be the
    // positioning context — set here rather than in compare.css, so a page's
    // own layout for [data-item] is never overridden
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    var wrap = document.createElement('div');
    wrap.className = 'cmp-note';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cmp-note-open';
    btn.setAttribute('aria-label', 'a note about this one');
    btn.innerHTML = PLUS_SVG;
    var box = document.createElement('textarea');
    box.className = 'cmp-note-box';
    box.rows = 2;
    box.placeholder = 'a note about this one…';
    var flag = document.createElement('span');
    flag.className = 'cmp-note-saved';
    flag.textContent = 'saved';
    wrap.appendChild(btn); wrap.appendChild(box); wrap.appendChild(flag);
    host.appendChild(wrap);

    // A written note does NOT open on load (Aug 2026, Sophie: the note
    // section "takes up too much space and makes it hard to see everything
    // at once") — the + goes solid instead, so the page still says where
    // her notes are without spending a row on each of them.
    if (existing) { box.value = existing; box.dataset.touched = '1'; btn.classList.add('has'); }

    btn.addEventListener('click', function () {
      if (wrap.classList.contains('open')) { box.blur(); wrap.classList.remove('open'); return; }
      wrap.classList.add('open'); box.focus();
    });
    function save() {
      flag.classList.remove('on');
      postNote(item, box.value).then(function () {
        flag.classList.add('on');
        setTimeout(function () { flag.classList.remove('on'); }, 1200);
      });
    }
    box.addEventListener('input', function () {
      clearTimeout(noteTimers[item]);
      noteTimers[item] = setTimeout(save, 700);
    });
    box.addEventListener('blur', function () {
      clearTimeout(noteTimers[item]);
      // an empty box that was never written is not a note — don't POST ''
      if (box.value.trim() || box.dataset.touched) save();
      if (box.value.trim()) box.dataset.touched = '1';
      // always fold back to the corner + — the box is for writing in, not
      // for parking open under every item
      btn.classList.toggle('has', !!box.value.trim());
      wrap.classList.remove('open');
    });
  }

  window.__compareNotes = function (opts) {
    noteCfg = { chat: (opts || {}).chat, sheet: (opts || {}).sheet };
    var sel = (opts || {}).selector || '[data-item]';
    var hosts = Array.prototype.slice.call(document.querySelectorAll(sel));
    if (!hosts.length || !noteCfg.chat || !noteCfg.sheet) return;
    // prefill from whatever she already wrote, then wire every box
    fetch('/api/chatfeed/verdict?chat=' + encodeURIComponent(noteCfg.chat) +
          '&sheet=' + encodeURIComponent(noteCfg.sheet))
      .then(function (r) { return r.ok ? r.json() : { texts: {} }; })
      .catch(function () { return { texts: {} }; })
      .then(function (d) {
        var texts = (d && d.texts) || {};
        hosts.forEach(function (h) {
          var item = h.getAttribute('data-item');
          if (item) buildNote(h, item, texts[item] || '');
        });
      });
  };

  // a half-typed note must survive leaving the page
  window.addEventListener('pagehide', function () {
    if (!noteCfg) return;
    document.querySelectorAll('.cmp-note-box').forEach(function (box) {
      var item = box.closest('[data-item]');
      if (!item || !box.value.trim()) return;
      try {
        navigator.sendBeacon('/api/chatfeed/verdict', new Blob([JSON.stringify({
          chat: noteCfg.chat, sheet: noteCfg.sheet,
          item: item.getAttribute('data-item'), text: box.value,
        })], { type: 'application/json' }));
      } catch (_) { /* nothing more we can do here */ }
    });
  });
})();
