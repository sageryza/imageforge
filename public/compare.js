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

  /* 3b — NO SELF-ZOOM ON A FOCUSED FIELD (Aug 2026, Sophie: "I would prefer
     not to have pinch [zoom] and for it not to be 16 PX… I don't need pinch
     zoom"). iOS zooms the whole page whenever it focuses an input under 16px,
     and the only two cures are inflating every field to 16px or pinning the
     page scale. She picked the scale, so her type stays her size.

     Done HERE, at runtime, rather than only in the page skeleton, because
     every Compare page ever posted links this file — a hand-built page from
     months ago is frozen HTML and would otherwise keep zooming forever. A
     page that has already said maximum-scale is left alone. */
  (function () {
    var vp = document.querySelector('meta[name="viewport"]');
    if (!vp) {
      vp = document.createElement('meta');
      vp.setAttribute('name', 'viewport');
      vp.setAttribute('content', 'width=device-width, initial-scale=1');
      document.head.appendChild(vp);
    }
    var content = vp.getAttribute('content') || '';
    if (/maximum-scale/i.test(content)) return;
    vp.setAttribute('content', content.replace(/\s*,\s*$/, '')
      + ', maximum-scale=1, user-scalable=no');
  })();

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
      // the ✕ closes it (the video fills the overlay now, so the backdrop
      // branch is nearly unreachable — kept for a zero-size video edge case);
      // a tap on the video or its controls must never close it
      if (e.target === vlb || (e.target.className || '') === 'cmp-vlb-x') closeVideo();
    });
    document.body.appendChild(vlb);
    ensureMediaCSS();
    return vlb;
  }
  // This sheet styles the film ROW as well as the lightbox, and it used to be
  // appended inside ensureVideoLB — which only runs when the video is first
  // OPENED. So the row rendered as a bare inline-block button with its label
  // and duration jammed together until you tapped it once (measured: display
  // inline-block, gap normal, zero style tags matching .cmp-film). __filmRow
  // asks for it up front now; the lightbox itself stays lazy.
  function ensureMediaCSS() {
    if (document.getElementById('cmp-media-css')) return;
    var css = document.createElement('style');
    css.id = 'cmp-media-css';
    css.textContent =
      // the pinned player's geometry (#pinfull in chats.html), on purpose:
      // the video ELEMENT fills the overlay and letterboxes inside itself
      // (object-fit), so every tap lands ON the video — which is what makes
      // filmnote's Note button reliably appear, and what keeps a stray tap
      // beside a small video from closing the lightbox over a half-written
      // note. Sized-to-content, most of the screen was close-on-tap backdrop
      // ("the note box only appears sometimes"). Close is the ✕, or Esc.
      '.cmp-vlb{position:fixed; inset:0; z-index:61; background:rgba(20,18,15,.94);'
      + ' display:flex; align-items:center; justify-content:center;}'
      + '.cmp-vlb[hidden]{display:none !important;}'
      + '.cmp-vlb video{width:100%; height:100%; object-fit:contain; background:#000;}'
      + '.cmp-vlb-x{position:absolute; top:max(10px,env(safe-area-inset-top)); right:12px;'
      + ' width:38px; height:38px; border-radius:6px; border:1.5px solid #fff; background:rgba(0,0,0,.35);'
      + ' color:#fff; font-size:17px; line-height:1; cursor:pointer;}'
      // a near-miss on the ✕ lands on the film and pauses it ("it's hard to
      // exit the film", 2026-08-27) — the drawn circle stays 38px, the tap
      // box is ~66px via the invisible extension (clicks on a pseudo-element
      // still target the button, so the close handler needs nothing)
      + '.cmp-vlb-x::after{content:\'\'; position:absolute; inset:-14px;}'
      // the film row belongs at the TOP of the page, which puts its right end
      // inside the autoscroll pill's fixed corner (x 326-374, y 14-197 on an
      // iPhone 13) — without the reserve the duration is drawn underneath it
      + '.cmp-film{display:flex; align-items:center; gap:10px; width:100%; text-align:left;'
      + ' padding:10px 56px 10px 12px; margin:10px 0 4px; border:1.5px solid var(--ink,#2b2724);'
      + ' border-radius:6px; background:var(--paper,#fff); color:var(--ink,#2b2724);'
      + ' font:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent;}'
      + '.cmp-film .g{flex:0 0 auto; width:30px; height:30px; border-radius:50%;'
      + ' border:1.5px solid var(--ink,#2b2724); display:flex; align-items:center; justify-content:center;}'
      + '.cmp-film .t{flex:1 1 auto; font-size:15px;}'
      + '.cmp-film .m{flex:0 0 auto; font-size:12.5px; color:var(--ink2,#7a736c);}';
    document.head.appendChild(css);
  }
  /* TAP-TO-NOTE, when the caller says which chat the film belongs to (Aug
     2026, Sophie: the pause-and-note player "was only on the links at the top
     of the page that are pinned, could you somehow bring that mechanism in
     here"). It is /filmnote.js — the same module chats.html's pinned player
     uses, never a second copy — and it is fetched LAZILY, the first time a
     film that wants notes is opened: hundreds of already-posted Compare pages
     link this file and none of them asks for notes, so they must not pay for
     it. A page that does ask gets it on the first tap; the module is idempotent
     and no-ops if the page loaded it itself. */
  var fnote = null;
  function loadFilmNote(cb) {
    if (window.__filmNote) return cb();
    var id = 'filmnote-src', had = document.getElementById(id);
    var sc = had || document.createElement('script');
    sc.addEventListener('load', cb, { once: true });
    sc.addEventListener('error', function () { /* the film still plays */ }, { once: true });
    if (!had) { sc.id = id; sc.src = '/filmnote.js'; document.head.appendChild(sc); }
  }
  function openVideo(src, poster, note) {
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
    if (note && note.chat) {
      loadFilmNote(function () {
        // she may already have closed it while the module was fetching
        if (!window.__filmNote || el.hasAttribute('hidden')) return;
        fnote = window.__filmNote({ wrap: el, video: v, chat: note.chat, url: note.url || src });
      });
    }
  }
  function closeVideo() {
    if (!vlb || vlb.hasAttribute('hidden')) return;
    var v = vlb.querySelector('video');
    try { v.pause(); } catch (_) { /* already gone */ }
    if (fnote) { fnote.destroy(); fnote = null; }   // stops a live mic too
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
    ensureMediaCSS();
    var b = document.createElement('button');
    b.className = 'cmp-film';
    b.type = 'button';
    b.innerHTML = '<span class="g"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"'
      + ' stroke="currentColor" stroke-width="1" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg></span>'
      + '<span class="t"></span><span class="m"></span>';
    b.querySelector('.t').textContent = opts.label || 'Play the film';
    b.querySelector('.m').textContent = opts.meta || '';
    // `chat` opts a row into tap-to-note; `noteUrl` overrides what the note
    // is filed against, for a row whose playable url is not its identity
    b.addEventListener('click', function () {
      openVideo(opts.url, opts.poster,
        opts.chat ? { chat: opts.chat, url: opts.noteUrl || opts.url } : null);
    });
    mount.appendChild(b);
    return b;
  };
  window.__compareShell.openVideo = openVideo;
  window.__compareShell.closeVideo = closeVideo;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeVideo(); });

  /* 5b — THE "?" (Aug 2026, Sophie: pages keep arriving with a list of
     instructions at the top, and "if they do want to put instructions… they
     can put it behind a ? so I can tap it if I don't know what's going on").

     So: a page carries NO explanatory text. Anything a reader might need
     goes here, one line, after the title is in the DOM:

       window.__compareHelp({ html: '<b>Tap a picture</b> to see it big. ' +
                                    'The + in the corner leaves a note.' });

     The circle rides at the END OF THE TITLE — the pill owns the top-right
     corner (x 324-374 / y 14-192), so nothing may be placed there — and the
     card is FIXED, so opening it never pushes the page down under her finger.
     Tap anywhere to close. Only ever ONE circle, so calling this twice (a
     reload of a resumed page) replaces rather than stacks. */
  function ensureHelpCSS() {
    if (document.getElementById('cmp-help-css')) return;
    if (document.querySelector('link[href*="/compare.css"]')) return;  // it's in there
    var st = document.createElement('style');
    st.id = 'cmp-help-css';
    st.textContent = '.cmp-help{display:inline-flex;align-items:center;justify-content:center;'
      + 'width:22px;height:22px;padding:0;margin-left:9px;border-radius:50%;'
      + 'border:1px solid var(--chg,#a8845c);font:600 13px/1 -apple-system,sans-serif;'
      + 'color:var(--chg,#a8845c);background:transparent;vertical-align:middle;cursor:pointer}'
      + '.cmp-helpcard{position:fixed;top:14px;left:14px;right:14px;z-index:60;'
      + 'background:var(--paper,#fffdf8);border:1px solid var(--line,#e7dfd0);border-radius:6px;'
      + 'padding:14px 16px;font-size:15px;line-height:1.5;color:var(--ink2,#6b6255);'
      + 'box-shadow:0 6px 24px rgba(0,0,0,.13);max-height:70vh;overflow:auto}';
    document.head.appendChild(st);
  }

  window.__compareHelp = function (opts) {
    opts = opts || {};
    var host = opts.mount ? document.querySelector(opts.mount)
                          : document.querySelector('h1');
    if (!host) return null;
    ensureHelpCSS();
    var old = document.querySelector('.cmp-help');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var card = document.querySelector('.cmp-helpcard');
    if (card && card.parentNode) card.parentNode.removeChild(card);

    card = document.createElement('div');
    card.className = 'cmp-helpcard';
    card.hidden = true;
    if (opts.html) card.innerHTML = opts.html;
    else card.textContent = opts.text || '';
    document.body.appendChild(card);

    var b = document.createElement('button');
    b.className = 'cmp-help';
    b.type = 'button';
    b.textContent = '?';
    b.setAttribute('aria-label', opts.label || 'what this page is');
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      card.hidden = !card.hidden;
    });
    host.appendChild(b);
    // Tap anywhere (including the card) to put it away — the Cutting Room's
    // gesture, so the whole app answers a "?" the same way.
    document.addEventListener('click', function () { card.hidden = true; });
    return b;
  };

  /* 6 — NOTES ON ANYTHING (Aug 2026, Sophie's standing rule: "whenever
     applicable notes should be able to be added"). Reviewing is not only
     yes/no — she needs to say WHY, or what to change, next to the thing
     itself. So every Compare page that shows reviewable items gets a note
     box per item, and it lives here rather than being hand-rolled per page.

     Wire it in one line, after your items are in the DOM:

       window.__compareNotes({ chat: 'my-chat', sheet: 'page-thing-v1' });

     Every element carrying `data-item="<id>"` gets a note affordance: a
     SMALL + IN THAT ITEM'S BOTTOM-RIGHT CORNER (Aug 2026, Sophie — v1 put a
     "+ note" button on its own line under every item and left a written note
     open in a textarea, which "takes up too much space and makes it hard to
     see everything at once"). Three states: nothing written is just the +
     and costs no height; a written note SHOWS as her words under the item
     ("if I left a note, make it show"); tapping either opens the textarea,
     which folds back on blur. Never open a written note into a textarea just
     to display it, and never put an empty one back in flow.

     ANSWER HER ON THE NOTE ITSELF. A note is a conversation, not a comment
     box — she asked for replies to land there ("otherwise I forget what
     we're talking about"), so a chat appends its answer to the same field
     and she writes back under it. Read them with
     GET /api/chatfeed/verdict?chat=&sheet= → texts, and POST the whole
     field back with your line added. Keep it short; the field caps at 2000.
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
    var shown = document.createElement('div');
    shown.className = 'cmp-note-text';
    var caret = document.createElement('button');
    caret.type = 'button'; caret.className = 'cmp-note-more';
    var box = document.createElement('textarea');
    box.className = 'cmp-note-box';
    box.rows = 2;
    box.placeholder = 'a note about this one…';
    var flag = document.createElement('span');
    flag.className = 'cmp-note-saved';
    flag.textContent = 'saved';
    wrap.appendChild(btn); wrap.appendChild(shown); wrap.appendChild(caret);
    wrap.appendChild(box); wrap.appendChild(flag);
    host.appendChild(wrap);

    // A written note SHOWS as her words (Aug 2026, Sophie: "if I left a note,
    // make it show") — not as an open textarea, which is what made every item
    // cost a box whether or not she had written in it. An empty one is just
    // the + and costs nothing.
    //
    // And it shows as a THREAD, hers and mine in separate blocks (Sophie,
    // Aug 2026: "I don't know why I'm responding inside of your message.
    // That's strange" — v1 handed her the whole field in one textarea, so
    // answering meant typing inside my paragraph). Writing now APPENDS a new
    // message; only the last block is ever hers to extend.
    var thread = [], current = '';   // `current` is the field; the box is only a draft
    function display() {
      thread = parseThread(current);
      wrap.classList.toggle('has', !!thread.length);
      renderThread(shown, thread);
      // more than one message folds down to the newest (Sophie: "also
      // collapse the messages anyway")
      var many = thread.length > 1;
      caret.hidden = !many;
      wrap.classList.toggle('foldable', many);
      if (many && !wrap.dataset.opened) wrap.classList.add('folded');
      if (!many) wrap.classList.remove('folded');
      caret.textContent = (thread.length - 1) + ' earlier';
    }
    if (existing) { current = existing; box.dataset.touched = '1'; }
    display();

    // the box is always EMPTY: it writes the NEXT message, never edits mine
    function open() {
      box.value = '';
      wrap.classList.add('open');
      wrap.classList.remove('folded'); wrap.dataset.opened = '1';
      box.focus();
    }
    btn.addEventListener('click', function () {
      if (wrap.classList.contains('open')) { box.blur(); return; }
      open();
    });
    caret.addEventListener('click', function () {
      wrap.classList.toggle('folded');
      wrap.dataset.opened = '1';
    });
    shown.addEventListener('click', open);   // tap the thread to write back
    // saving writes the WHOLE thread back — her draft appended as one new
    // message — so a debounced save mid-sentence can't lose the earlier ones
    function fieldWith(draft) {
      var msgs = thread.concat(draft.trim() ? [{ who: 'me', text: draft.trim() }] : []);
      return msgs.map(function (m) { return '— ' + (m.who === 'claude' ? 'Claude' : 'me') + ': ' + m.text; })
        .join('\n\n');
    }
    box._cmpField = fieldWith;      // the pagehide beacon needs the thread too
    function save() {
      flag.classList.remove('on');
      postNote(item, fieldWith(box.value)).then(function () {   // draft included

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
      var draft = box.value.trim();
      if (draft) {
        // commit the draft INTO the field, then empty the box. The box must
        // never hold the thread: a second blur (the synthetic one a test
        // fires, or a re-focus) would then append the whole thread to itself.
        current = fieldWith(draft);
        box.dataset.touched = '1';
        box.value = '';
        flag.classList.remove('on');
        postNote(item, current).then(function () {
          flag.classList.add('on');
          setTimeout(function () { flag.classList.remove('on'); }, 1200);
        });
        // a COMMITTED message (never a debounced half-sentence) is handed to
        // the page, which may mirror it — grid.js/judge.js append it to an
        // asset-backed item's Assets-tab note thread (Aug 2026, Sophie: the
        // page and the tab "should agree")
        if (noteCfg && noteCfg.onMessage) {
          try { noteCfg.onMessage(item, draft); } catch (_) { /* mirror only */ }
        }
      }
      // always fold back — the textarea is for writing the next message,
      // the thread is what stays on the page
      display();
      wrap.classList.remove('open');
    });
  }

  /* A note is a CONVERSATION, so the one text field carries both voices,
     each message on its own `— me:` / `— Claude:` line. Anything before the
     first marker is hers (every note written before this existed). */
  function parseThread(text) {
    var out = [];
    String(text || '').split(/\n(?=—\s*(?:me|Claude)\s*:)/).forEach(function (chunk) {
      var s = chunk.trim();
      if (!s) return;
      var m = /^—\s*(me|Claude)\s*:\s*/i.exec(s);
      out.push({
        who: m && m[1].toLowerCase() === 'claude' ? 'claude' : 'me',
        text: m ? s.slice(m[0].length).trim() : s,
      });
    });
    return out.filter(function (m) { return m.text; });
  }

  function renderThread(host, msgs) {
    host.textContent = '';
    msgs.forEach(function (m, i) {
      var d = document.createElement('div');
      d.className = 'cmp-msg ' + m.who + (i === msgs.length - 1 ? ' last' : '');
      var who = document.createElement('span');
      who.className = 'cmp-msg-who';
      who.textContent = m.who === 'claude' ? 'Claude' : 'me';
      var p = document.createElement('div');
      p.className = 'cmp-msg-t';
      p.textContent = m.text;
      d.appendChild(who); d.appendChild(p);
      host.appendChild(d);
    });
  }
  window.__compareShell.parseNoteThread = parseThread;
  // judge.js builds its own card markup, so it paints its note through this
  // rather than re-implementing the thread
  window.__compareShell.paintNote = function (wrap, text) {
    var host = wrap && wrap.querySelector('.cmp-note-text');
    if (!host) return [];
    var msgs = parseThread(text);
    renderThread(host, msgs);
    wrap.classList.toggle('has', !!msgs.length);
    return msgs;
  };
  window.__compareShell.threadField = function (msgs, draft) {
    return msgs.concat(draft && draft.trim() ? [{ who: 'me', text: draft.trim() }] : [])
      .map(function (m) { return '— ' + (m.who === 'claude' ? 'Claude' : 'me') + ': ' + m.text; })
      .join('\n\n');
  };

  /* 7 — THE TOUR (Aug 2026, Sophie: "a tutorial where the buttons are
     highlighted or everything else is tinted and it has a little
     explanations"). Coach marks, one control at a time: the page dims, the
     current control shows through a spotlight, a small card says what it
     does, and ANY tap steps forward (skip is on the card). One shared
     implementation so every page's tour feels the same:

       window.__compareTour({ key: 'deck', steps: [
         { sel: '.jg-mic', text: 'Tap to record…' }, … ] })

     `key` remembers "seen" in localStorage (cmp-tour-<key>), so pass
     auto:true to play it once per device and never again — the caller's
     "?" card should offer a replay. A step whose selector matches nothing
     is skipped, so one steps list serves pages with optional controls. */
  var tourEl = null;
  function tourSeen(key) {
    try { return !!localStorage.getItem('cmp-tour-' + key); } catch (_) { return true; }
  }
  function tourMark(key) {
    try { localStorage.setItem('cmp-tour-' + key, '1'); } catch (_) { /* private mode */ }
  }
  window.__compareTour = function (opts) {
    opts = opts || {};
    var steps = (opts.steps || []).filter(function (s) {
      return s && s.sel && document.querySelector(s.sel);
    });
    if (!steps.length || tourEl) return false;
    if (opts.auto && opts.key && tourSeen(opts.key)) return false;
    if (opts.key) tourMark(opts.key);
    if (!document.getElementById('cmp-tour-css')) {
      var st = document.createElement('style');
      st.id = 'cmp-tour-css';
      st.textContent =
        '.cmp-tour{position:fixed;inset:0;z-index:64;}' +
        // the spotlight IS the tint: one ring whose shadow covers the rest
        '.cmp-tour-ring{position:fixed;border-radius:8px;pointer-events:none;' +
        ' box-shadow:0 0 0 200vmax rgba(20,18,15,.62);border:1.5px solid var(--gold,#b98a2f);' +
        ' transition:all .22s ease;}' +
        '.cmp-tour-card{position:fixed;left:14px;right:14px;background:var(--paper,#fffdf8);' +
        ' border:1px solid var(--line,#e7dfd0);border-radius:6px;padding:12px 14px;' +
        ' font-size:15px;line-height:1.5;color:var(--ink,#2b2724);' +
        ' box-shadow:0 6px 24px rgba(0,0,0,.2);}' +
        '.cmp-tour-card .n{font:700 11px/1 -apple-system,sans-serif;letter-spacing:.08em;' +
        ' color:var(--gold,#b98a2f);padding-bottom:6px;display:flex;justify-content:space-between;}' +
        '.cmp-tour-card .n button{border:0;background:none;padding:0;color:var(--ink2,#7a736c);' +
        ' font:600 11px/1 -apple-system,sans-serif;letter-spacing:.08em;}' +
        '.cmp-tour-card .hint{padding-top:8px;font-size:11.5px;color:var(--ink2,#7a736c);}';
      document.head.appendChild(st);
    }
    var i = 0;
    tourEl = document.createElement('div');
    tourEl.className = 'cmp-tour';
    tourEl.setAttribute('data-nostop', '');   // a tour tap must never start the autoscroll
    tourEl.innerHTML = '<div class="cmp-tour-ring"></div><div class="cmp-tour-card">'
      + '<div class="n"><span class="ct-count"></span><button type="button" class="ct-skip">SKIP</button></div>'
      + '<div class="ct-text"></div><div class="hint">tap anywhere for the next one</div></div>';
    document.body.appendChild(tourEl);
    function close() {
      if (!tourEl) return;
      tourEl.remove(); tourEl = null;
      window.removeEventListener('resize', place);
    }
    function place() {
      if (!tourEl) return;
      var s = steps[i];
      var t = document.querySelector(s.sel);
      if (!t) { next(); return; }
      try { t.scrollIntoView({ block: 'center' }); } catch (_) { /* fixed pages */ }
      var r = t.getBoundingClientRect();
      var ring = tourEl.querySelector('.cmp-tour-ring');
      ring.style.left = (r.left - 6) + 'px';
      ring.style.top = (r.top - 6) + 'px';
      ring.style.width = (r.width + 12) + 'px';
      ring.style.height = (r.height + 12) + 'px';
      tourEl.querySelector('.ct-count').textContent = (i + 1) + ' of ' + steps.length;
      tourEl.querySelector('.ct-text').textContent = s.text || '';
      var card = tourEl.querySelector('.cmp-tour-card');
      // the card sits under the spotlight when there's room, else above it
      card.style.top = ''; card.style.bottom = '';
      if (r.bottom + 130 < window.innerHeight) card.style.top = (r.bottom + 14) + 'px';
      else card.style.top = Math.max(10, r.top - 120) + 'px';
      var last = i === steps.length - 1;
      tourEl.querySelector('.hint').textContent = last ? 'tap anywhere to finish'
        : 'tap anywhere for the next one';
    }
    function next() {
      i += 1;
      if (i >= steps.length) { close(); return; }
      place();
    }
    tourEl.addEventListener('click', function (e) {
      if (e.target && e.target.className === 'ct-skip') { close(); return; }
      next();
    });
    window.addEventListener('resize', place);
    place();
    return true;
  };

  window.__compareNotes = function (opts) {
    noteCfg = { chat: (opts || {}).chat, sheet: (opts || {}).sheet,
      onMessage: (opts || {}).onMessage || null };
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

  /* 5 — THE TITLE FITS ON ONE LINE (Aug 2026, Sophie: "can you make the actual
     title scale down so it fits on one line"). A three-line <h1> at 26px ate
     the top third of her phone before the first picture. Only ever SHRINKS,
     never grows, and stops at 60% of the page's own size, so a title too long
     to fit even then wraps as before rather than dwindling to nothing. The
     right-hand 56px is the pill's corner, already reserved in compare.css. */
  function fitTitle() {
    var h = document.querySelector('.wrap > h1');
    if (!h || !h.textContent.trim()) return;
    h.style.fontSize = '';
    var base = parseFloat(getComputedStyle(h).fontSize) || 26;
    var size = base;
    var floor = Math.max(13, base * 0.6);
    // one line = the box is no taller than a line-height (measured each pass,
    // since compare.css sets line-height relative to the font size)
    function overflows() {
      var lh = parseFloat(getComputedStyle(h).lineHeight) || (size * 1.2);
      return h.scrollHeight > lh * 1.3;
    }
    while (overflows() && size > floor) {
      size -= 1;
      h.style.fontSize = size + 'px';
    }
  }
  function fitSoon() { setTimeout(fitTitle, 0); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fitSoon);
  } else { fitSoon(); }
  // the serif lands late on a cold load, and a rotation changes the width
  try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTitle); } catch (_) {}
  window.addEventListener('resize', fitTitle);
  window.addEventListener('orientationchange', fitSoon);

  // a half-typed note must survive leaving the page
  window.addEventListener('pagehide', function () {
    if (!noteCfg) return;
    document.querySelectorAll('.cmp-note-box').forEach(function (box) {
      var item = box.closest('[data-item]');
      if (!item || !box.value.trim()) return;
      try {
        // the box holds only the DRAFT, so the beacon has to send the whole
        // thread with it or an interrupted message would eat the earlier ones
        var full = box._cmpField ? box._cmpField(box.value) : box.value;
        navigator.sendBeacon('/api/chatfeed/verdict', new Blob([JSON.stringify({
          chat: noteCfg.chat, sheet: noteCfg.sheet,
          item: item.getAttribute('data-item'), text: full,
        })], { type: 'application/json' }));
      } catch (_) { /* nothing more we can do here */ }
    });
  });
})();
